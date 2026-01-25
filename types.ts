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

export enum AssetType {
  LINE = 'LINE',
  CARRIAGE = 'CARRIAGE',
  TUNNEL = 'TUNNEL',
  INTERCHANGE = 'INTERCHANGE',
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
}

export interface Station {
  id: string;
  pos: Point;
  shape: StationShape;
  passengers: Passenger[];
  isOvercrowded: boolean;
  overcrowdTimer: number; // 0 to 1 (1 is game over)
}

export interface Train {
  id: string;
  lineId: string;
  passengers: Passenger[];
  capacity: number;
  // Position logic
  segmentIndex: number; // Index of the segment in the line (station A to station B)
  t: number; // 0.0 to 1.0 along the segment
  direction: 1 | -1; // 1 = forward, -1 = backward
  status: 'MOVING' | 'BOARDING' | 'UNBOARDING';
  stopTimer: number;
}

export interface Line {
  id: string;
  color: string;
  stationIds: string[]; // Ordered list of stations
  trains: Train[];
}

export interface GameAssets {
  lines: number;
  tunnels: number;
  carriages: number;
  interchanges: number;
}

export interface GameState {
  stations: Station[];
  lines: Line[];
  water: Point[][]; // Polygons
  time: number; // Total ticks
  week: number;
  score: number;
  assets: GameAssets;
  activeAssets: {
    linesUsed: number;
    tunnelsUsed: number;
  };
  mode: GameMode;
  isGameOver: boolean;
  isPaused: boolean;
  isMenuOpen: boolean;
  pendingUpgrade: boolean;
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
  activeLineId: string | null; // If extending an existing line
  hoverStationId: string | null;
}
