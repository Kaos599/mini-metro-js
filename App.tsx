import React, { useEffect, useRef, useState, useCallback } from 'react';
import { CoreSim } from './engine/CoreSim';
import { Renderer } from './engine/Renderer';
import { GameUI } from './components/GameUI';
import { GameMode, Point, InteractionState, AssetType } from './types';
import { dist } from './utils/geometry';
import { CONFIG } from './constants';

const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<CoreSim | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const animationFrameRef = useRef<number>(0);
  
  // React State for UI updates (updated less frequently than 60hz ideally)
  const [uiState, setUiState] = useState<any>(null);
  const [mode, setMode] = useState<GameMode>(GameMode.NORMAL);
  const [menuOpen, setMenuOpen] = useState(true);

  // Interaction State
  const interactionRef = useRef<InteractionState>({
      isDragging: false,
      dragStartStationId: null,
      dragCurrentPos: null,
      activeLineId: null,
      hoverStationId: null
  });

  const initGame = (selectedMode: GameMode) => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      engineRef.current = new CoreSim(selectedMode, width, height);
      if (canvasRef.current) {
          rendererRef.current = new Renderer(canvasRef.current.getContext('2d')!, width, height);
      }
      setMode(selectedMode);
      setMenuOpen(false);
      
      // Update UI state immediately
      if (engineRef.current) setUiState({...engineRef.current.state});
  };

  const loop = useCallback(() => {
      if (!engineRef.current || !rendererRef.current) return;
      
      const engine = engineRef.current;
      
      // Update logic
      engine.update(1); // 1 tick
      
      // Render
      rendererRef.current.render(engine.state, interactionRef.current);
      
      // Sync React UI State (throttled or every frame? Every frame is fine for simple HUD)
      // Check for major state changes to update React
      if (engine.state.isGameOver || engine.state.pendingUpgrade || engine.state.time % 60 === 0) {
          setUiState({...engine.state});
      }

      animationFrameRef.current = requestAnimationFrame(loop);
  }, []);

  useEffect(() => {
      if (!menuOpen) {
          animationFrameRef.current = requestAnimationFrame(loop);
      }
      return () => cancelAnimationFrame(animationFrameRef.current);
  }, [loop, menuOpen]);

  // Input Handling
  const getMousePos = (e: React.MouseEvent | React.TouchEvent): Point => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
      return {
          x: clientX - rect.left,
          y: clientY - rect.top
      };
  };

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
      if (!engineRef.current || menuOpen) return;
      const pos = getMousePos(e);
      const engine = engineRef.current;

      // Find station under cursor
      const station = engine.state.stations.find(s => dist(s.pos, pos) < CONFIG.STATION_RADIUS * 2);
      
      if (station) {
          interactionRef.current.isDragging = true;
          interactionRef.current.dragStartStationId = station.id;
          interactionRef.current.dragCurrentPos = pos;
          
          // Check if this station is an END or START of an existing line to extend it
          // Logic: If station is endpoint of line X, make line X active.
          // Prioritize lines where this station is an endpoint.
          const existingLine = engine.state.lines.find(l => 
              l.stationIds[0] === station.id || l.stationIds[l.stationIds.length - 1] === station.id
          );
          
          if (existingLine) {
              interactionRef.current.activeLineId = existingLine.id;
          } else {
              interactionRef.current.activeLineId = null;
          }
      } else {
          // Maybe remove line? (Right click or specialized input)
          // For MVP, simplistic line creation only.
      }
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
      if (!engineRef.current || menuOpen) return;
      const pos = getMousePos(e);
      const engine = engineRef.current;
      
      if (interactionRef.current.isDragging) {
          interactionRef.current.dragCurrentPos = pos;
          // Snap to station
          const hoverStation = engine.state.stations.find(s => dist(s.pos, pos) < CONFIG.STATION_RADIUS * 2.5);
          if (hoverStation) {
               interactionRef.current.hoverStationId = hoverStation.id;
               interactionRef.current.dragCurrentPos = hoverStation.pos;
          } else {
              interactionRef.current.hoverStationId = null;
          }
      }
  };

  const handlePointerUp = (e: React.MouseEvent | React.TouchEvent) => {
      if (!engineRef.current || !interactionRef.current.isDragging) return;
      
      const engine = engineRef.current;
      const startId = interactionRef.current.dragStartStationId;
      const endId = interactionRef.current.hoverStationId;
      const activeLineId = interactionRef.current.activeLineId;

      if (startId && endId && startId !== endId) {
          // Attempt to connect
          if (activeLineId) {
              // Extend existing
              const line = engine.state.lines.find(l => l.id === activeLineId);
              if (line) {
                  // Determine if we are extending head or tail
                  const isHead = line.stationIds[0] === startId;
                  const isTail = line.stationIds[line.stationIds.length - 1] === startId;
                  
                  if (isHead) engine.extendLine(activeLineId, endId, true);
                  else if (isTail) engine.extendLine(activeLineId, endId, false);
              }
          } else {
              // Create new line
              // Determine next color index
              const colorIdx = engine.state.lines.length;
              engine.createLine([startId, endId], colorIdx);
          }
      }
      
      // Reset interaction
      interactionRef.current.isDragging = false;
      interactionRef.current.dragStartStationId = null;
      interactionRef.current.dragCurrentPos = null;
      interactionRef.current.activeLineId = null;
      interactionRef.current.hoverStationId = null;
  };

  const handleUpgrade = (type: AssetType) => {
      engineRef.current?.selectUpgrade(type);
      if (engineRef.current) setUiState({...engineRef.current.state});
  };

  const togglePause = () => {
     if (engineRef.current) {
         engineRef.current.state.isPaused = !engineRef.current.state.isPaused;
         setUiState({...engineRef.current.state});
     }
  };

  return (
    <div className="w-full h-screen overflow-hidden relative select-none">
      {/* Menu */}
      {menuOpen && (
         <div className="absolute inset-0 z-50 bg-[#fcf9f2] flex flex-col items-center justify-center p-4">
            <h1 className="text-6xl font-black tracking-tighter text-slate-800 mb-8">METRO MINI</h1>
            <div className="flex flex-col gap-4 w-64">
                <button onClick={() => initGame(GameMode.NORMAL)} className="bg-slate-800 text-white p-4 rounded text-xl font-bold hover:bg-slate-700 transition">Play Normal</button>
                <button onClick={() => initGame(GameMode.EXTREME)} className="bg-red-700 text-white p-4 rounded text-xl font-bold hover:bg-red-600 transition">Play Extreme</button>
                <button onClick={() => initGame(GameMode.ENDLESS)} className="bg-blue-600 text-white p-4 rounded text-xl font-bold hover:bg-blue-500 transition">Play Endless</button>
                <div className="text-slate-400 text-sm text-center mt-4">
                    Connect stations with lines.<br/>
                    Deliver passengers.<br/>
                    Don't let stations overcrowd.
                </div>
            </div>
         </div>
      )}

      <canvas
        ref={canvasRef}
        width={window.innerWidth}
        height={window.innerHeight}
        className="block cursor-crosshair active:cursor-grabbing"
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
            onReset={() => setMenuOpen(true)}
            onUpgradeSelect={handleUpgrade}
            onTogglePause={togglePause}
          />
      )}
    </div>
  );
};

export default App;
