import { Point } from '../types';

export const dist = (p1: Point, p2: Point): number => {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
};

export const lerp = (p1: Point, p2: Point, t: number): Point => {
  return {
    x: p1.x + (p2.x - p1.x) * t,
    y: p1.y + (p2.y - p1.y) * t,
  };
};

// Check if segment AB intersects segment CD
export const linesIntersect = (a: Point, b: Point, c: Point, d: Point): boolean => {
  const ccw = (p1: Point, p2: Point, p3: Point) => {
    return (p3.y - p1.y) * (p2.x - p1.x) > (p2.y - p1.y) * (p3.x - p1.x);
  };
  return (
    ccw(a, c, d) !== ccw(b, c, d) && ccw(a, b, c) !== ccw(a, b, d)
  );
};

// Check if a line segment crosses a polygon (water)
export const lineIntersectsPolygon = (p1: Point, p2: Point, polygon: Point[]): boolean => {
  for (let i = 0; i < polygon.length; i++) {
    const p3 = polygon[i];
    const p4 = polygon[(i + 1) % polygon.length];
    if (linesIntersect(p1, p2, p3, p4)) {
      return true;
    }
  }
  return false;
};

export const isPointInPolygon = (p: Point, polygon: Point[]): boolean => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    const intersect = ((yi > p.y) !== (yj > p.y)) &&
      (p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
};
