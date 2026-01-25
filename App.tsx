import React, { useEffect, useRef, useState, useCallback } from 'react';
import { CoreSim } from './engine/CoreSim';
import { Renderer } from './engine/Renderer';
import { GameUI } from './components/GameUI';
import { GameMode, Point, InteractionState, AssetType, GamePhase, MapComplexityConfig, TerrainStyle, DifficultyPreset } from './types';
import { dist, distToSegment } from './utils/geometry';
import { CONFIG, COLORS, DIFFICULTY_PRESETS, DEFAULT_COMPLEXITY_CONFIG } from './constants';
import { playSound } from './utils/audio';
import { generateSeed } from './utils/mapGenerator';

const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<CoreSim | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const requestRef = useRef<number>(0);
  
  // Game Loop State
  const accumulatorRef = useRef(0);
  const lastTimeRef = useRef(0);
  const FIXED_TIMESTEP = 1000 / 30; // 30 ticks per second (33ms)

  const [uiState, setUiState] = useState<any>(null);
  const [gamePhase, setGamePhase] = useState<GamePhase>('setup');
  const [speed, setSpeed] = useState(1);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  
  // New line creation state
  const [isCreatingNewLine, setIsCreatingNewLine] = useState(false);
  const [newLineColorIndex, setNewLineColorIndex] = useState<number | null>(null);
  
  // Camera state for pan/zoom
  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 });
  const isPanningRef = useRef(false);
  const lastPanPosRef = useRef<Point | null>(null);
  
  // Setup config state
  const [setupConfig, setSetupConfig] = useState<MapComplexityConfig>({
    ...DEFAULT_COMPLEXITY_CONFIG,
    seed: generateSeed(),
  });
  const [selectedPreset, setSelectedPreset] = useState<DifficultyPreset>('normal');

  const prevScoreRef = useRef(0);
  const interactionRef = useRef<InteractionState>({
      isDragging: false,
      dragStartStationId: null,
      dragCurrentPos: null,
      activeLineId: null,
      hoverStationId: null,
      selectedLineId: null,
      draggingAssetType: null,
      isCreatingNewLine: false,
      newLineColorIndex: null,
  });

  const initGame = (selectedMode: GameMode, config?: Partial<MapComplexityConfig>) => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const finalConfig = { ...setupConfig, ...config };
      engineRef.current = new CoreSim(selectedMode, width, height, finalConfig);
      if (canvasRef.current) {
          rendererRef.current = new Renderer(canvasRef.current.getContext('2d')!, width, height);
      }
      setGamePhase('playing');
      setSpeed(1);
      setCamera({ x: 0, y: 0, zoom: 1 });
      setIsCreatingNewLine(false);
      setNewLineColorIndex(null);
      setSelectedLineId(null);
      lastTimeRef.current = performance.now();
      accumulatorRef.current = 0;
      prevScoreRef.current = 0;
      
      if (engineRef.current) {
        engineRef.current.state.camera = { x: 0, y: 0, zoom: 1 };
        setUiState({...engineRef.current.state});
      }
      playSound('spawn');
  };

  const animate = (time: number) => {
      if (!engineRef.current || !rendererRef.current) return;
      const engine = engineRef.current;

      const deltaTime = time - lastTimeRef.current;
      lastTimeRef.current = time;

      // SPEED FIX: Scale accumulator addition, but clamp based on MAX theoretical frames we want to process.
      // At 20x speed, we want 20x simulation speed.
      // FIXED_TIMESTEP is 33ms. 
      // If speed is 20, we add deltaTime * 20.
      accumulatorRef.current += deltaTime * speed;

      // Dynamic safety clamp: Allow enough buffer for high speed without spiraling
      // Max 10 ticks per frame approx (330ms simulation time)
      const maxAccumulation = Math.max(250, FIXED_TIMESTEP * 10 * Math.max(1, speed * 0.5)); 
      if (accumulatorRef.current > maxAccumulation) accumulatorRef.current = maxAccumulation;

      // Consume accumulator
      while (accumulatorRef.current >= FIXED_TIMESTEP) {
          engine.tick();
          accumulatorRef.current -= FIXED_TIMESTEP;
      }

      // Interpolation
      const alpha = accumulatorRef.current / FIXED_TIMESTEP;

      // Sync interaction state with React state
      interactionRef.current.selectedLineId = selectedLineId;
      interactionRef.current.isCreatingNewLine = isCreatingNewLine;
      interactionRef.current.newLineColorIndex = newLineColorIndex;
      
      // Sync camera
      engine.state.camera = camera;

      // Render
      rendererRef.current.render(engine.state, interactionRef.current, alpha);

      // Audio & UI Sync
      if (engine.state.score > prevScoreRef.current) {
          playSound('deliver');
          prevScoreRef.current = engine.state.score;
      }
      if (engine.state.isGameOver && speed > 0) {
           setSpeed(0);
           setGamePhase('gameover');
           playSound('gameover');
      }
      // Throttled React State Update
      if (engine.state.isGameOver || engine.state.pendingUpgrade || engine.state.time % 30 === 0) {
          setUiState({...engine.state});
      }

      requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
      if (gamePhase === 'playing') {
          lastTimeRef.current = performance.now();
          requestRef.current = requestAnimationFrame(animate);
      }
      return () => cancelAnimationFrame(requestRef.current);
  }, [gamePhase, speed, camera, isCreatingNewLine, newLineColorIndex, selectedLineId]);

  // ESC key to cancel drawing mode
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if (e.key === 'Escape') {
              if (isCreatingNewLine) {
                  setIsCreatingNewLine(false);
                  setNewLineColorIndex(null);
              }
              if (selectedLineId) {
                  setSelectedLineId(null);
              }
          }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCreatingNewLine, selectedLineId]);

  // --- Input Handlers ---
  
  // Convert screen coordinates to world coordinates
  const screenToWorld = (screenPos: Point): Point => {
    return {
      x: (screenPos.x / camera.zoom) + camera.x,
      y: (screenPos.y / camera.zoom) + camera.y,
    };
  };
  
  const getMousePos = (e: React.MouseEvent | React.TouchEvent): Point => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      const clientX = 'touches' in e ? (e as any).touches[0].clientX : (e as React.MouseEvent).clientX;
      const clientY = 'touches' in e ? (e as any).touches[0].clientY : (e as React.MouseEvent).clientY;
      const screenPos = { x: clientX - rect.left, y: clientY - rect.top };
      // Convert to world coordinates
      return screenToWorld(screenPos);
  };
  
  const getScreenMousePos = (e: React.MouseEvent | React.TouchEvent): Point => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      const clientX = 'touches' in e ? (e as any).touches[0].clientX : (e as React.MouseEvent).clientX;
      const clientY = 'touches' in e ? (e as any).touches[0].clientY : (e as React.MouseEvent).clientY;
      return { x: clientX - rect.left, y: clientY - rect.top };
  };

  // Handle mouse wheel for zoom
  const handleWheel = (e: React.WheelEvent) => {
      e.preventDefault();
      const zoomSpeed = 0.001;
      const delta = -e.deltaY * zoomSpeed;
      const newZoom = Math.max(CONFIG.MIN_ZOOM, Math.min(CONFIG.MAX_ZOOM, camera.zoom * (1 + delta)));
      
      // Zoom towards cursor position
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      // Calculate new camera position to zoom towards cursor
      const worldX = (mouseX / camera.zoom) + camera.x;
      const worldY = (mouseY / camera.zoom) + camera.y;
      
      const newCameraX = worldX - (mouseX / newZoom);
      const newCameraY = worldY - (mouseY / newZoom);
      
      setCamera({ x: newCameraX, y: newCameraY, zoom: newZoom });
  };

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
      if (!engineRef.current || gamePhase !== 'playing') return;
      
      const isRightClick = 'button' in e && e.button === 2;
      const isMiddleClick = 'button' in e && e.button === 1;
      const isShiftClick = 'shiftKey' in e && e.shiftKey;
      const pos = getMousePos(e);
      const screenPos = getScreenMousePos(e);
      const engine = engineRef.current;

      // Middle click or shift+click for panning
      if (isMiddleClick || isShiftClick) {
          e.preventDefault();
          isPanningRef.current = true;
          lastPanPosRef.current = screenPos;
          return;
      }

      if (isRightClick) {
          e.preventDefault();
          // Cancel new line creation mode on right click
          if (isCreatingNewLine) {
              setIsCreatingNewLine(false);
              setNewLineColorIndex(null);
              return;
          }
          const worldPos = pos;
          const deleted = engine.deleteLineAt(worldPos);
          if (deleted) playSound('warning');
          return;
      }

      const station = engine.state.stations.find(s => dist(s.pos, pos) < CONFIG.STATION_RADIUS * 2);
      
      // NEW LINE CREATION MODE
      if (isCreatingNewLine && newLineColorIndex !== null && station) {
          interactionRef.current.isDragging = true;
          interactionRef.current.dragStartStationId = station.id;
          interactionRef.current.dragCurrentPos = pos;
          interactionRef.current.activeLineId = null; // Creating new line, not extending
          return;
      }
      
      if (station) {
          // STRICT EDITING: If a line is selected, we only allow dragging endpoints of THAT line.
          if (selectedLineId) {
             const l = engine.state.lines.find(line => line.id === selectedLineId);
             const isEndpoint = l && (l.stationIds[0] === station.id || l.stationIds[l.stationIds.length-1] === station.id);
             
             if (isEndpoint) {
                 interactionRef.current.isDragging = true;
                 interactionRef.current.dragStartStationId = station.id;
                 interactionRef.current.dragCurrentPos = pos;
                 interactionRef.current.activeLineId = selectedLineId;
             }
             // If not an endpoint of selected line, ignore interaction.
             return;
          }

          // Normal Logic (No specific line selected)
          interactionRef.current.isDragging = true;
          interactionRef.current.dragStartStationId = station.id;
          interactionRef.current.dragCurrentPos = pos;
          
          const existingLine = engine.state.lines.find(line => 
            line.stationIds[0] === station.id || line.stationIds[line.stationIds.length - 1] === station.id
          );
          interactionRef.current.activeLineId = existingLine ? existingLine.id : null;
      }
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
      if (!engineRef.current || gamePhase !== 'playing') return;
      
      const screenPos = getScreenMousePos(e);
      
      // Handle panning
      if (isPanningRef.current && lastPanPosRef.current) {
          const dx = (screenPos.x - lastPanPosRef.current.x) / camera.zoom;
          const dy = (screenPos.y - lastPanPosRef.current.y) / camera.zoom;
          setCamera(prev => ({ ...prev, x: prev.x - dx, y: prev.y - dy }));
          lastPanPosRef.current = screenPos;
          return;
      }
      
      const pos = getMousePos(e);
      interactionRef.current.dragCurrentPos = pos;

      if (interactionRef.current.isDragging) {
          const hoverStation = engineRef.current.state.stations.find(s => dist(s.pos, pos) < CONFIG.STATION_RADIUS * 2.5);
          interactionRef.current.hoverStationId = hoverStation ? hoverStation.id : null;
          if (hoverStation) interactionRef.current.dragCurrentPos = hoverStation.pos;
      }
  };

  const handlePointerUp = (e: React.MouseEvent | React.TouchEvent) => {
      // Stop panning
      if (isPanningRef.current) {
          isPanningRef.current = false;
          lastPanPosRef.current = null;
          return;
      }
      
      if (!engineRef.current) return;
      const engine = engineRef.current;
      const pos = getMousePos(e);

      // Handle Asset Drop
      if (interactionRef.current.draggingAssetType) {
          let dropped = false;
          const assetType = interactionRef.current.draggingAssetType;

          // Find line under cursor (approximate by finding closest segment)
          let targetLineId: string | null = null;
          let minDist = 20;

          for (const line of engine.state.lines) {
              for (let i=0; i < line.stationIds.length-1; i++) {
                 const s1 = engine.state.stations.find(s => s.id === line.stationIds[i]);
                 const s2 = engine.state.stations.find(s => s.id === line.stationIds[i+1]);
                 if (s1 && s2) {
                     const d = distToSegment(pos, s1.pos, s2.pos);
                     if (d < minDist) {
                         minDist = d;
                         targetLineId = line.id;
                     }
                 }
              }
          }

          if (targetLineId) {
              // STRICT EDITING: If line selected, can only drop on THAT line.
              if (selectedLineId && targetLineId !== selectedLineId) {
                  playSound('warning');
                  interactionRef.current.draggingAssetType = null;
                  return;
              }

              if (assetType === AssetType.LOCOMOTIVE) {
                  dropped = engine.addLocomotiveToLine(targetLineId);
              } else if (assetType === AssetType.CARRIAGE) {
                  dropped = engine.addCarriageToLine(targetLineId);
              }
          }

          if (dropped) playSound('connect');
          else playSound('warning'); // Invalid drop

          interactionRef.current.draggingAssetType = null;
          setUiState({...engine.state}); // Force update UI counts
          return;
      }

      // Handle Line Dragging
      if (interactionRef.current.isDragging) {
          const { dragStartStationId, hoverStationId, activeLineId } = interactionRef.current;
          let success = false;

          if (dragStartStationId && hoverStationId && dragStartStationId !== hoverStationId) {
              if (activeLineId) {
                  const line = engine.state.lines.find(l => l.id === activeLineId);
                  if (line) {
                      const isHead = line.stationIds[0] === dragStartStationId;
                      const isTail = line.stationIds[line.stationIds.length - 1] === dragStartStationId;
                      if (isHead) success = engine.extendLine(activeLineId, hoverStationId, true);
                      else if (isTail) success = engine.extendLine(activeLineId, hoverStationId, false);
                  }
              } else {
                  // Creating a NEW line - either from new line mode or normal drag
                  const colorIdx = isCreatingNewLine && newLineColorIndex !== null 
                      ? newLineColorIndex 
                      : engine.state.lines.length;
                  const newId = engine.createLine([dragStartStationId, hoverStationId], colorIdx);
                  if (newId) { 
                      success = true; 
                      setSelectedLineId(newId);
                      // Exit new line creation mode after successful creation
                      if (isCreatingNewLine) {
                          setIsCreatingNewLine(false);
                          setNewLineColorIndex(null);
                      }
                  }
              }
          }
          if (success) playSound('connect');
          interactionRef.current.isDragging = false;
          interactionRef.current.dragStartStationId = null;
          interactionRef.current.activeLineId = null;
          interactionRef.current.hoverStationId = null;
      }
  };

  const handleAssetDragStart = (type: AssetType) => {
      interactionRef.current.draggingAssetType = type;
  };

  const handleUpgrade = (type: AssetType) => {
      engineRef.current?.selectUpgrade(type);
      setSpeed(1);
      if (engineRef.current) setUiState({...engineRef.current.state});
  };
  
  // Handle starting new line from Line Manager
  const handleStartNewLine = (colorIndex: number) => {
      setIsCreatingNewLine(true);
      setNewLineColorIndex(colorIndex);
      setSelectedLineId(null); // Deselect any currently selected line
  };
  
  // Handle canceling new line creation
  const handleCancelNewLine = () => {
      setIsCreatingNewLine(false);
      setNewLineColorIndex(null);
  };
  
  // Handle preset change
  const handlePresetChange = (preset: DifficultyPreset) => {
      setSelectedPreset(preset);
      if (preset !== 'custom' && DIFFICULTY_PRESETS[preset]) {
          setSetupConfig(prev => ({
              ...prev,
              ...DIFFICULTY_PRESETS[preset],
          }));
      }
  };
  
  // Determine cursor style
  const getCursorStyle = () => {
      if (interactionRef.current.draggingAssetType) return 'cursor-grabbing';
      if (isPanningRef.current) return 'cursor-move';
      if (isCreatingNewLine) return 'cursor-crosshair';
      return 'cursor-default';
  };

  return (
    <div className="w-full h-screen overflow-hidden relative select-none" onContextMenu={(e) => e.preventDefault()}>
      {/* Setup Screen */}
      {gamePhase === 'setup' && (
         <div className="absolute inset-0 z-50 bg-[#fcf9f2] flex flex-col items-center justify-center p-4 overflow-auto">
            <h1 className="text-7xl font-black tracking-tighter text-slate-800 mb-2">METRO MINI</h1>
            <p className="text-slate-500 mb-8 font-bold uppercase tracking-widest">High Performance Sim</p>
            
            {/* Difficulty Presets */}
            <div className="mb-6">
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3 text-center">Difficulty</h3>
              <div className="flex gap-2">
                {(['easy', 'normal', 'hard', 'extreme'] as DifficultyPreset[]).map(preset => (
                  <button
                    key={preset}
                    onClick={() => handlePresetChange(preset)}
                    className={`px-4 py-2 rounded-lg font-bold capitalize transition-all ${
                      selectedPreset === preset 
                        ? 'bg-slate-800 text-white shadow-lg scale-105' 
                        : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Terrain Style */}
            <div className="mb-6">
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3 text-center">Terrain</h3>
              <div className="flex gap-2">
                {Object.values(TerrainStyle).map(terrain => (
                  <button
                    key={terrain}
                    onClick={() => setSetupConfig(prev => ({ ...prev, terrainStyle: terrain }))}
                    className={`px-4 py-2 rounded-lg font-bold capitalize transition-all ${
                      setupConfig.terrainStyle === terrain 
                        ? 'bg-blue-600 text-white shadow-lg scale-105' 
                        : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                    }`}
                  >
                    {terrain.toLowerCase()}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Seed */}
            <div className="mb-6 flex items-center gap-3">
              <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">Seed:</label>
              <input
                type="number"
                value={setupConfig.seed}
                onChange={(e) => setSetupConfig(prev => ({ ...prev, seed: parseInt(e.target.value) || 0 }))}
                className="w-32 px-3 py-2 rounded-lg border-2 border-slate-200 font-mono text-center"
              />
              <button
                onClick={() => setSetupConfig(prev => ({ ...prev, seed: generateSeed() }))}
                className="px-3 py-2 bg-slate-200 rounded-lg hover:bg-slate-300 font-bold text-slate-600"
              >
                🎲
              </button>
            </div>
            
            {/* Game Mode Buttons */}
            <div className="grid grid-cols-1 gap-4 w-72">
                <button onClick={() => initGame(GameMode.NORMAL)} className="bg-slate-800 text-white p-4 rounded-lg text-xl font-bold hover:bg-slate-700 shadow-lg transition-all hover:scale-105">
                  Play Normal
                </button>
                <button onClick={() => initGame(GameMode.EXTREME)} className="bg-red-700 text-white p-4 rounded-lg text-xl font-bold hover:bg-red-600 shadow-lg transition-all hover:scale-105">
                  Extreme Mode
                </button>
                <button onClick={() => initGame(GameMode.CREATIVE)} className="bg-teal-600 text-white p-4 rounded-lg text-xl font-bold hover:bg-teal-500 shadow-lg transition-all hover:scale-105">
                  Creative Mode
                </button>
            </div>
            
            {/* Controls hint */}
            <div className="mt-8 text-sm text-slate-400 text-center">
              <p><strong>Controls:</strong> Drag between stations to create lines</p>
              <p>Scroll to zoom • Middle-click or Shift+drag to pan</p>
              <p>Right-click to delete lines</p>
            </div>
         </div>
      )}

      <canvas
        ref={canvasRef}
        width={window.innerWidth}
        height={window.innerHeight}
        className={`block touch-none ${getCursorStyle()}`}
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onMouseLeave={handlePointerUp}
        onTouchStart={handlePointerDown}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerUp}
        onWheel={handleWheel}
      />
      
      {uiState && gamePhase === 'playing' && (
          <GameUI 
            gameState={uiState} 
            speed={speed}
            onReset={() => {
              setGamePhase('setup');
              setSetupConfig(prev => ({ ...prev, seed: generateSeed() }));
            }}
            onUpgradeSelect={handleUpgrade}
            onSetSpeed={setSpeed}
            onSelectLine={setSelectedLineId}
            onDragAssetStart={handleAssetDragStart}
            onStartNewLine={handleStartNewLine}
            selectedLineId={selectedLineId}
            isCreatingNewLine={isCreatingNewLine}
            newLineColorIndex={newLineColorIndex}
            onCancelNewLine={handleCancelNewLine}
          />
      )}
    </div>
  );
};

export default App;
