import React, { useEffect, useRef, useState, useCallback } from 'react';
import { CoreSim } from './engine/CoreSim';
import { Renderer } from './engine/Renderer';
import { GameUI } from './components/GameUI';
import { GameMode, Point, InteractionState, AssetType } from './types';
import { dist, distToSegment } from './utils/geometry';
import { CONFIG } from './constants';
import { playSound } from './utils/audio';

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
  const [menuOpen, setMenuOpen] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);

  const prevScoreRef = useRef(0);
  const interactionRef = useRef<InteractionState>({
      isDragging: false,
      dragStartStationId: null,
      dragCurrentPos: null,
      activeLineId: null,
      hoverStationId: null,
      selectedLineId: null,
      draggingAssetType: null
  });

  const initGame = (selectedMode: GameMode) => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      engineRef.current = new CoreSim(selectedMode, width, height);
      if (canvasRef.current) {
          rendererRef.current = new Renderer(canvasRef.current.getContext('2d')!, width, height);
      }
      setMenuOpen(false);
      setSpeed(1);
      lastTimeRef.current = performance.now();
      accumulatorRef.current = 0;
      prevScoreRef.current = 0;
      
      if (engineRef.current) setUiState({...engineRef.current.state});
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

      // Render
      interactionRef.current.selectedLineId = selectedLineId;
      rendererRef.current.render(engine.state, interactionRef.current, alpha);

      // Audio & UI Sync
      if (engine.state.score > prevScoreRef.current) {
          playSound('deliver');
          prevScoreRef.current = engine.state.score;
      }
      if (engine.state.isGameOver && speed > 0) {
           setSpeed(0);
           playSound('gameover');
      }
      // Throttled React State Update
      if (engine.state.isGameOver || engine.state.pendingUpgrade || engine.state.time % 30 === 0) {
          setUiState({...engine.state});
      }

      requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
      if (!menuOpen) {
          lastTimeRef.current = performance.now();
          requestRef.current = requestAnimationFrame(animate);
      }
      return () => cancelAnimationFrame(requestRef.current);
  }, [menuOpen, speed]);

  // --- Input Handlers ---
  const getMousePos = (e: React.MouseEvent | React.TouchEvent): Point => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      const clientX = 'touches' in e ? (e as any).touches[0].clientX : (e as React.MouseEvent).clientX;
      const clientY = 'touches' in e ? (e as any).touches[0].clientY : (e as React.MouseEvent).clientY;
      return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
      if (!engineRef.current || menuOpen) return;
      
      const isRightClick = 'button' in e && e.button === 2;
      const pos = getMousePos(e);
      const engine = engineRef.current;

      if (isRightClick) {
          e.preventDefault();
          const deleted = engine.deleteLineAt(pos);
          if (deleted) playSound('warning');
          return;
      }

      const station = engine.state.stations.find(s => dist(s.pos, pos) < CONFIG.STATION_RADIUS * 2);
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
      if (!engineRef.current || menuOpen) return;
      const pos = getMousePos(e);
      interactionRef.current.dragCurrentPos = pos;

      if (interactionRef.current.isDragging) {
          const hoverStation = engineRef.current.state.stations.find(s => dist(s.pos, pos) < CONFIG.STATION_RADIUS * 2.5);
          interactionRef.current.hoverStationId = hoverStation ? hoverStation.id : null;
          if (hoverStation) interactionRef.current.dragCurrentPos = hoverStation.pos;
      }
  };

  const handlePointerUp = (e: React.MouseEvent | React.TouchEvent) => {
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
                  // If selectedLineId is active, we should never reach here due to handlePointerDown restrictions.
                  const colorIdx = engine.state.lines.length;
                  const newId = engine.createLine([dragStartStationId, hoverStationId], colorIdx);
                  if (newId) { success = true; setSelectedLineId(newId); }
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

  return (
    <div className="w-full h-screen overflow-hidden relative select-none" onContextMenu={(e) => e.preventDefault()}>
      {menuOpen && (
         <div className="absolute inset-0 z-50 bg-[#fcf9f2] flex flex-col items-center justify-center p-4">
            <h1 className="text-7xl font-black tracking-tighter text-slate-800 mb-2">METRO MINI</h1>
            <p className="text-slate-500 mb-10 font-bold uppercase tracking-widest">High Performance Sim</p>
            <div className="grid grid-cols-1 gap-4 w-72">
                <button onClick={() => initGame(GameMode.NORMAL)} className="bg-slate-800 text-white p-4 rounded-lg text-xl font-bold hover:bg-slate-700 shadow-lg">Play Normal</button>
                <button onClick={() => initGame(GameMode.EXTREME)} className="bg-red-700 text-white p-4 rounded-lg text-xl font-bold hover:bg-red-600 shadow-lg">Extreme</button>
                <button onClick={() => initGame(GameMode.CREATIVE)} className="bg-teal-600 text-white p-4 rounded-lg text-xl font-bold hover:bg-teal-500 shadow-lg">Creative</button>
            </div>
         </div>
      )}

      <canvas
        ref={canvasRef}
        width={window.innerWidth}
        height={window.innerHeight}
        className={`block touch-none ${interactionRef.current.draggingAssetType ? 'cursor-grabbing' : 'cursor-crosshair active:cursor-grabbing'}`}
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onMouseLeave={handlePointerUp}
        onTouchStart={handlePointerDown}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerUp}
      />
      
      {uiState && !menuOpen && (
          <GameUI 
            gameState={uiState} 
            speed={speed}
            onReset={() => setMenuOpen(true)}
            onUpgradeSelect={handleUpgrade}
            onSetSpeed={setSpeed}
            onSelectLine={setSelectedLineId}
            onDragAssetStart={handleAssetDragStart}
            selectedLineId={selectedLineId}
          />
      )}
    </div>
  );
};

export default App;
