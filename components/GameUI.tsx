import React from 'react';
import { GameState, AssetType } from '../types';
import { CONFIG } from '../constants';

interface GameUIProps {
    gameState: GameState;
    speed: number;
    onReset: () => void;
    onUpgradeSelect: (type: AssetType) => void;
    onSetSpeed: (speed: number) => void;
    onSelectLine: (id: string | null) => void;
    onDragAssetStart: (type: AssetType) => void;
    selectedLineId: string | null;
}

export const GameUI: React.FC<GameUIProps> = ({ 
    gameState, speed, onReset, onUpgradeSelect, onSetSpeed, onSelectLine, onDragAssetStart, selectedLineId 
}) => {
    const progress = (gameState.time % CONFIG.WEEK_LENGTH) / CONFIG.WEEK_LENGTH;
    const weekDay = ['M', 'T', 'W', 'T', 'F', 'S', 'S'][Math.floor(progress * 7)];
    
    // Get info for selected line
    const selectedLine = gameState.lines.find(l => l.id === selectedLineId);

    return (
        <div className="absolute inset-0 pointer-events-none text-slate-800 font-sans">
            {/* Top Right HUD */}
            <div className="absolute top-6 right-6 flex flex-col items-end gap-4 pointer-events-auto">
                <div className="flex items-center gap-4">
                    <div className="text-right">
                        <div className="text-3xl font-black text-slate-800">{gameState.score}</div>
                        <div className="text-xs uppercase tracking-widest text-slate-500 font-bold">Passengers</div>
                    </div>
                    <div className="relative w-14 h-14 bg-white rounded-full shadow-md flex items-center justify-center border-4 border-slate-100">
                        <svg className="absolute inset-0 w-full h-full -rotate-90">
                            <circle cx="50%" cy="50%" r="20" fill="none" stroke="#e2e8f0" strokeWidth="4" />
                            <circle cx="50%" cy="50%" r="20" fill="none" stroke="#3b82f6" strokeWidth="4" strokeDasharray={`${progress * 125} 125`} />
                        </svg>
                        <div className="flex flex-col items-center leading-none">
                           <span className="text-sm font-bold">{weekDay}</span>
                           <span className="text-[10px] text-slate-400">W{gameState.week}</span>
                        </div>
                    </div>
                </div>

                {/* Speed Controls */}
                <div className="flex bg-white/90 backdrop-blur rounded-full shadow-lg border border-slate-100 p-1 gap-1">
                    {[0, 1, 2, 5, 20].map((s) => (
                        <button 
                            key={s}
                            onClick={() => onSetSpeed(s)}
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                                speed === s ? 'bg-slate-800 text-white scale-110 shadow' : 'text-slate-500 hover:bg-slate-100'
                            }`}
                        >
                            {s === 0 ? '||' : `${s}x`}
                        </button>
                    ))}
                </div>

                {/* Assets Overview */}
                <div className="flex flex-col gap-2 w-full">
                    <AssetRow label="Lines" available={gameState.assets.lines - gameState.activeAssets.linesUsed} total={gameState.assets.lines} color="bg-red-500" />
                    <AssetRow label="Tunnels" available={gameState.assets.tunnels - gameState.activeAssets.tunnelsUsed} total={gameState.assets.tunnels} color="bg-slate-400" />
                </div>
            </div>
            
            {/* Bottom Tray */}
            <div className="absolute bottom-6 left-6 right-6 pointer-events-auto flex items-end justify-between gap-4">
                 
                 {/* Left: Line Manager */}
                 <div className="bg-white/90 backdrop-blur px-6 py-4 rounded-2xl shadow-xl border border-slate-100 flex flex-col gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Line Manager</span>
                    <div className="flex gap-3">
                        {gameState.lines.map(line => (
                            <button
                                key={line.id}
                                onClick={() => onSelectLine(selectedLineId === line.id ? null : line.id)}
                                className={`w-10 h-10 rounded-full border-4 transition-all flex items-center justify-center relative group ${
                                    selectedLineId === line.id ? 'scale-110 shadow-lg ring-2 ring-offset-2 ring-slate-300 opacity-100' : (selectedLineId ? 'opacity-30 hover:opacity-100 hover:scale-105' : 'opacity-100 hover:scale-105')
                                }`}
                                style={{ backgroundColor: line.color, borderColor: 'white' }}
                            >
                                <span className="text-white text-xs font-bold">{line.trains.length}</span>
                                {/* Tooltip */}
                                <div className="absolute bottom-full mb-2 hidden group-hover:block bg-slate-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                                    {line.stationIds.length} Stations
                                </div>
                            </button>
                        ))}
                        {Array.from({ length: gameState.assets.lines - gameState.activeAssets.linesUsed }).map((_, i) => (
                             <div key={i} className="w-10 h-10 rounded-full border-2 border-dashed border-slate-300 bg-slate-50 opacity-50" />
                        ))}
                    </div>
                    {selectedLine && (
                        <div className="text-xs text-slate-500 font-mono mt-1">
                            Current: {selectedLine.trains.length} Trains
                        </div>
                    )}
                 </div>

                 {/* Right: Asset Supply (Locomotives & Carriages) */}
                 <div className="bg-white/90 backdrop-blur px-6 py-4 rounded-2xl shadow-xl border border-slate-100 flex flex-col gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Assets</span>
                    <div className="flex gap-4">
                        <div 
                            className="flex flex-col items-center gap-1 cursor-grab active:cursor-grabbing"
                            onMouseDown={() => onDragAssetStart(AssetType.LOCOMOTIVE)}
                            onTouchStart={() => onDragAssetStart(AssetType.LOCOMOTIVE)}
                        >
                            <div className="w-12 h-12 bg-slate-100 rounded-xl border-2 border-slate-200 flex items-center justify-center text-2xl hover:border-blue-400 hover:bg-white transition-colors relative">
                                🚄
                                <span className="absolute -top-2 -right-2 bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                                    {gameState.assets.locomotives - gameState.activeAssets.locomotivesUsed}
                                </span>
                            </div>
                            <span className="text-xs font-bold text-slate-600">Train</span>
                        </div>

                        <div 
                            className="flex flex-col items-center gap-1 cursor-grab active:cursor-grabbing"
                            onMouseDown={() => onDragAssetStart(AssetType.CARRIAGE)}
                            onTouchStart={() => onDragAssetStart(AssetType.CARRIAGE)}
                        >
                            <div className="w-12 h-12 bg-slate-100 rounded-xl border-2 border-slate-200 flex items-center justify-center text-2xl hover:border-purple-400 hover:bg-white transition-colors relative">
                                🚃
                                <span className="absolute -top-2 -right-2 bg-purple-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                                    {gameState.assets.carriages}
                                </span>
                            </div>
                            <span className="text-xs font-bold text-slate-600">Carriage</span>
                        </div>
                    </div>
                 </div>
            </div>

            {/* Game Over Screen */}
            {gameState.isGameOver && (
                <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center pointer-events-auto backdrop-blur-md z-50">
                    <div className="bg-white p-10 rounded-2xl shadow-2xl text-center max-w-md animate-in fade-in zoom-in duration-300">
                        <h2 className="text-3xl font-black mb-2 text-slate-800">Station Overcrowded</h2>
                        <p className="mb-8 text-slate-600">
                            Final Score: <span className="text-2xl font-bold text-blue-600">{gameState.score}</span>
                        </p>
                        <button onClick={onReset} className="bg-slate-900 text-white px-8 py-4 rounded-full font-bold hover:bg-slate-700">Play Again</button>
                    </div>
                </div>
            )}

            {/* Upgrade Modal */}
            {gameState.pendingUpgrade && !gameState.isGameOver && (
                <div className="absolute inset-0 bg-slate-900/40 flex items-center justify-center pointer-events-auto backdrop-blur-sm z-50">
                    <div className="bg-white p-8 rounded-xl shadow-2xl text-center max-w-2xl">
                        <h2 className="text-3xl font-black mb-2 text-slate-800">Week {gameState.week} Complete</h2>
                        <div className="grid grid-cols-4 gap-4 mt-6">
                            <UpgradeCard onClick={() => onUpgradeSelect(AssetType.LINE)} title="New Line" icon="🎨" />
                            <UpgradeCard onClick={() => onUpgradeSelect(AssetType.LOCOMOTIVE)} title="Locomotive" icon="🚄" />
                            <UpgradeCard onClick={() => onUpgradeSelect(AssetType.CARRIAGE)} title="Carriage" icon="🚃" />
                            <UpgradeCard onClick={() => onUpgradeSelect(AssetType.TUNNEL)} title="2 Tunnels" icon="🌉" />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const AssetRow = ({ label, available, color }: any) => (
    <div className="flex items-center justify-between bg-white/80 p-2 rounded shadow-sm backdrop-blur-sm h-8 w-32">
        <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${color}`}></div>
            <span className="text-xs font-bold text-slate-600 uppercase">{label}</span>
        </div>
        <div className="text-sm font-mono font-bold">{available}</div>
    </div>
);

const UpgradeCard = ({ onClick, title, icon }: any) => (
    <button onClick={onClick} className="bg-slate-50 border-2 border-slate-200 p-4 rounded-xl hover:border-blue-500 hover:bg-white hover:shadow-lg transition-all flex flex-col items-center">
        <div className="text-3xl mb-3">{icon}</div>
        <span className="font-bold text-sm text-slate-800">{title}</span>
    </button>
);
