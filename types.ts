export enum StationShape {
  CIRCLE = 'CIRCLE',
  TRIANGLE = 'TRIANGLE',
  SQUARE = 'SQUARE',
  STAR = 'STAR',
  PENTAGON = 'PENTAGON',
  GEM = 'GEM',
}

export enum GameMode {
  NORMAL = 'NORMAL',
  EXTREME = 'EXTREME',
  ENDLESS = 'ENDLESS',
  CREATIVE = 'CREATIVE',
}

export enum TerrainStyle {
  RIVER = 'RIVER',
  DELTA = 'DELTA',
  COASTAL = 'COASTAL',
  ISLANDS = 'ISLANDS',
}

export type DifficultyPreset = 'easy' | 'normal' | 'hard' | 'extreme' | 'custom';

export interface MapComplexityConfig {
  // Difficulty preset (for quick selection)
  preset: DifficultyPreset;
  
  // Terrain settings
  terrainStyle: TerrainStyle;
  waterCoverage: number; // 0.1 to 0.5
  seed: number;
  
  // Spawn rates
  passengerSpawnBase: number; // 0.003 to 0.01
  passengerSpawnGrowth: number; // 0.08 to 0.25 per week
  stationSpawnRate: number; // 0.0005 to 0.003
  maxStations: number; // 12 to 30
  
  // Station settings
  maxStationCapacity: number; // 4 to 10
  overcrowdTimeLimit: number; // 200 to 800 ticks
  
  // Starting assets
  startingLines: number; // 2 to 5
  startingLocomotives: number; // 2 to 5
  startingTunnels: number; // 0 to 6
  startingCarriages: number; // 0 to 3
  
  // Train settings
  trainCapacity: number; // 4 to 8
  trainSpeed: number; // 1.0 to 3.0
  boardingSpeed: number; // 5 to 20 ticks per passenger
  
  // Upgrades
  tunnelsPerUpgrade: number; // 1 to 3
}

export enum AssetType {
  LINE = 'LINE',
  CARRIAGE = 'CARRIAGE',
  TUNNEL = 'TUNNEL',
  INTERCHANGE = 'INTERCHANGE',
  LOCOMOTIVE = 'LOCOMOTIVE',
}

export interface Point {
  x: number;
  y: number;
}

export interface Passenger {
  id: string;
  destination: StationShape;
  spawnTime: number;
  waitingAt: string; // stationId
  nextHopLineId: string | null; // Smart pathfinding
}

export interface Station {
  id: string;
  pos: Point;
  shape: StationShape;
  passengers: Passenger[];
  isOvercrowded: boolean;
  overcrowdTimer: number; // 0 to 1
  pulsePhase: number; // For visual effect
}

export interface Train {
  id: string;
  lineId: string;
  passengers: Passenger[];
  capacity: number;
  
  // Logic Position
  segmentIndex: number; 
  t: number; 
  direction: 1 | -1;
  
  // Interpolation State (Previous Tick)
  prevSegmentIndex: number;
  prevT: number;
  
  status: 'MOVING' | 'BOARDING' | 'UNBOARDING';
  stopTimer: number;
}

export interface Line {
  id: string;
  color: string;
  stationIds: string[]; 
  trains: Train[];
}

export interface GameAssets {
  lines: number;
  tunnels: number;
  carriages: number;
  interchanges: number;
  locomotives: number;
}

export interface GameState {
  stations: Station[];
  lines: Line[];
  water: Point[][]; 
  time: number; // Logic ticks
  week: number;
  score: number;
  assets: GameAssets;
  activeAssets: {
    linesUsed: number;
    tunnelsUsed: number;
    locomotivesUsed: number;
  };
  mode: GameMode;
  isGameOver: boolean;
  isPaused: boolean;
  isMenuOpen: boolean;
  pendingUpgrade: boolean;
  timeScale: number; // Speed multiplier
  camera: {
    x: number;
    y: number;
    zoom: number;
  };
}

export interface InteractionState {
  isDragging: boolean;
  dragStartStationId: string | null;
  dragCurrentPos: Point | null;
  activeLineId: string | null; 
  hoverStationId: string | null;
  selectedLineId: string | null; // For Line Manager UI
  draggingAssetType: AssetType | null; // For Asset Dragging
  isCreatingNewLine: boolean; // For creating new lines from Line Manager
  newLineColorIndex: number | null; // Color index for new line being created
}

export interface RouteInfo {
    nextStationId: string;
    lineId: string;
    distance: number;
}

export type GamePhase = 'setup' | 'playing' | 'gameover';