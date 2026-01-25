import React from 'react';
import { GameState, GameMode, AssetType } from '../types';

interface GameUIProps {
    gameState: GameState;
    onReset: () => void;
    onUpgradeSelect: (type: AssetType) => void;
    onTogglePause: () => void;
}

export const GameUI: React.FC<GameUIProps> = ({ gameState, onReset, onUpgradeSelect, onTogglePause }) => {
    return (
        <div className="absolute inset-0 pointer-events-none text-slate-800">
            {/* HUD */}
            <div className="absolute top-4 right-4 flex flex-col items-end gap-2 pointer-events-auto">
                <div className="text-2xl font-bold">{gameState.score}</div>
                <div className="text-sm">Week {gameState.week}</div>
                <div className="flex gap-4 bg-white/80 p-2 rounded shadow-sm backdrop-blur-sm">
                   <div className="flex flex-col items-center">
                       <span className="text-xs font-bold text-slate-500">LINES</span>
                       <span className="text-lg font-mono">{gameState.assets.lines - gameState.activeAssets.linesUsed}/{gameState.assets.lines}</span>
                   </div>
                   <div className="flex flex-col items-center">
                       <span className="text-xs font-bold text-slate-500">TUNNELS</span>
                       <span className="text-lg font-mono">{gameState.assets.tunnels - gameState.activeAssets.tunnelsUsed}/{gameState.assets.tunnels}</span>
                   </div>
                   <div className="flex flex-col items-center">
                       <span className="text-xs font-bold text-slate-500">CARS</span>
                       <span className="text-lg font-mono">{gameState.assets.carriages}</span>
                   </div>
                </div>
                <button 
                    onClick={onTogglePause}
                    className="mt-2 bg-slate-800 text-white px-3 py-1 rounded hover:bg-slate-700"
                >
                    {gameState.isPaused ? "RESUME" : "PAUSE"}
                </button>
            </div>

            {/* Game Over Screen */}
            {gameState.isGameOver && (
                <div className="absolute inset-0 bg-slate-900/40 flex items-center justify-center pointer-events-auto backdrop-blur-sm">
                    <div className="bg-white p-8 rounded-lg shadow-xl text-center max-w-md">
                        <h2 className="text-3xl font-bold mb-4 text-slate-800">Network Failure</h2>
                        <p className="mb-6 text-slate-600">
                            Overcrowding at a station caused a system-wide shutdown.
                            <br/>
                            <span className="text-xl font-bold text-slate-900 mt-2 block">Final Score: {gameState.score} passengers</span>
                        </p>
                        <button 
                            onClick={onReset}
                            className="bg-slate-800 text-white px-6 py-3 rounded-full text-lg font-semibold hover:bg-slate-700 transition-colors w-full"
                        >
                            Start New City
                        </button>
                    </div>
                </div>
            )}

            {/* Upgrade Modal */}
            {gameState.pendingUpgrade && !gameState.isGameOver && (
                <div className="absolute inset-0 bg-slate-900/40 flex items-center justify-center pointer-events-auto backdrop-blur-sm">
                    <div className="bg-white p-8 rounded-lg shadow-xl text-center max-w-lg">
                        <h2 className="text-2xl font-bold mb-2">Week {gameState.week} Complete</h2>
                        <p className="mb-6 text-slate-500">Choose a new locomotive asset</p>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <button 
                                onClick={() => onUpgradeSelect(AssetType.LINE)}
                                className="border-2 border-slate-200 p-4 rounded hover:border-blue-500 hover:bg-blue-50 transition-all flex flex-col items-center"
                            >
                                <span className="font-bold text-lg">New Line</span>
                                <span className="text-xs text-slate-500 mt-1">Start a new colored route</span>
                            </button>
                            <button 
                                onClick={() => onUpgradeSelect(AssetType.TUNNEL)}
                                className="border-2 border-slate-200 p-4 rounded hover:border-blue-500 hover:bg-blue-50 transition-all flex flex-col items-center"
                            >
                                <span className="font-bold text-lg">2 x Tunnels</span>
                                <span className="text-xs text-slate-500 mt-1">Cross rivers</span>
                            </button>
                            <button 
                                onClick={() => onUpgradeSelect(AssetType.CARRIAGE)}
                                className="border-2 border-slate-200 p-4 rounded hover:border-blue-500 hover:bg-blue-50 transition-all flex flex-col items-center"
                            >
                                <span className="font-bold text-lg">Carriage</span>
                                <span className="text-xs text-slate-500 mt-1">Increase train capacity</span>
                            </button>
                             <button 
                                onClick={() => onUpgradeSelect(AssetType.INTERCHANGE)}
                                className="border-2 border-slate-200 p-4 rounded hover:border-blue-500 hover:bg-blue-50 transition-all flex flex-col items-center opacity-50 cursor-not-allowed"
                                disabled
                            >
                                <span className="font-bold text-lg">Interchange</span>
                                <span className="text-xs text-slate-500 mt-1">Faster loading (Coming soon)</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
