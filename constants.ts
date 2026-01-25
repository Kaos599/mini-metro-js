import { StationShape, MapComplexityConfig, TerrainStyle } from './types';

export const COLORS = {
  bg: '#fcf9f2',
  water: '#d4f1f9',
  stationStroke: '#333333',
  stationFill: '#ffffff',
  passenger: '#555555',
  overcrowd: '#ff4444',
  lines: [
    '#e74c3c', // Red
    '#3498db', // Blue
    '#f1c40f', // Yellow
    '#2ecc71', // Green
    '#9b59b6', // Purple
    '#e67e22', // Orange
    '#1abc9c', // Teal
  ]
};

export const CONFIG = {
  STATION_RADIUS: 12,
  PASSENGER_RADIUS: 4,
  LINE_WIDTH: 6,
  TRAIN_WIDTH: 14,
  TRAIN_LENGTH: 24,
  MAX_STATION_CAPACITY: 6,
  OVERCROWD_TIME_LIMIT: 400, // Ticks before game over
  WEEK_LENGTH: 3600, // Ticks per week (60fps * 60s)
  TRAIN_SPEED: 2.0, // Pixels per tick
  BOARDING_SPEED: 10, // Ticks per passenger
  DEFAULT_TRAIN_CAPACITY: 6,
  // Camera limits
  MIN_ZOOM: 0.5,
  MAX_ZOOM: 3.0,
  PAN_SPEED: 1.0,
};

// Map shape to drawing function logic (simplified for rendering)
export const SHAPE_WEIGHTS = {
  [StationShape.CIRCLE]: 0.5,
  [StationShape.TRIANGLE]: 0.3,
  [StationShape.SQUARE]: 0.15,
  [StationShape.STAR]: 0.04,
  [StationShape.PENTAGON]: 0.01,
  [StationShape.GEM]: 0.00, // Very rare
};

// Difficulty presets with full configuration
export const DIFFICULTY_PRESETS: Record<string, Omit<MapComplexityConfig, 'seed'>> = {
  easy: {
    preset: 'easy',
    terrainStyle: TerrainStyle.RIVER,
    waterCoverage: 0.15,
    passengerSpawnBase: 0.003,
    passengerSpawnGrowth: 0.08,
    stationSpawnRate: 0.0008,
    maxStations: 18,
    maxStationCapacity: 8,
    overcrowdTimeLimit: 600,
    startingLines: 4,
    startingLocomotives: 4,
    startingTunnels: 5,
    startingCarriages: 1,
    trainCapacity: 6,
    trainSpeed: 2.2,
    boardingSpeed: 8,
    tunnelsPerUpgrade: 3,
  },
  normal: {
    preset: 'normal',
    terrainStyle: TerrainStyle.RIVER,
    waterCoverage: 0.2,
    passengerSpawnBase: 0.005,
    passengerSpawnGrowth: 0.15,
    stationSpawnRate: 0.001,
    maxStations: 20,
    maxStationCapacity: 6,
    overcrowdTimeLimit: 400,
    startingLines: 3,
    startingLocomotives: 3,
    startingTunnels: 3,
    startingCarriages: 0,
    trainCapacity: 6,
    trainSpeed: 2.0,
    boardingSpeed: 10,
    tunnelsPerUpgrade: 2,
  },
  hard: {
    preset: 'hard',
    terrainStyle: TerrainStyle.DELTA,
    waterCoverage: 0.3,
    passengerSpawnBase: 0.007,
    passengerSpawnGrowth: 0.18,
    stationSpawnRate: 0.0015,
    maxStations: 25,
    maxStationCapacity: 5,
    overcrowdTimeLimit: 350,
    startingLines: 3,
    startingLocomotives: 3,
    startingTunnels: 2,
    startingCarriages: 0,
    trainCapacity: 5,
    trainSpeed: 1.8,
    boardingSpeed: 12,
    tunnelsPerUpgrade: 2,
  },
  extreme: {
    preset: 'extreme',
    terrainStyle: TerrainStyle.ISLANDS,
    waterCoverage: 0.35,
    passengerSpawnBase: 0.009,
    passengerSpawnGrowth: 0.22,
    stationSpawnRate: 0.002,
    maxStations: 30,
    maxStationCapacity: 4,
    overcrowdTimeLimit: 250,
    startingLines: 2,
    startingLocomotives: 2,
    startingTunnels: 1,
    startingCarriages: 0,
    trainCapacity: 4,
    trainSpeed: 1.5,
    boardingSpeed: 15,
    tunnelsPerUpgrade: 1,
  },
};

// Default config for custom games
export const DEFAULT_COMPLEXITY_CONFIG: MapComplexityConfig = {
  ...DIFFICULTY_PRESETS.normal,
  seed: Date.now(),
};
