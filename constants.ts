import { StationShape } from './types';

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
