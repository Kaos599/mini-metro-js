import { Point } from '../types';

export const dist = (p1: Point, p2: Point): number => {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
};

export const lerp = (p1: Point, p2: Point, t: number): Point => {
  return {
    x: p1.x + (p2.x - p1.x) * t,
    y: p1.y + (p2.y - p1.y) * t,
  };
};

// Check if segment AB intersects segment CD
export const linesIntersect = (a: Point, b: Point, c: Point, d: Point): boolean => {
  const v1x = d.x - c.x;
  const v1y = d.y - c.y;

  const v2x = a.x - c.x;
  const v2y = a.y - c.y;

  const v3x = b.x - c.x;
  const v3y = b.y - c.y;

  const cross1 = v1x * v2y - v1y * v2x;
  const cross2 = v1x * v3y - v1y * v3x;

  if ((cross1 > 0 && cross2 > 0) || (cross1 < 0 && cross2 < 0)) return false;

  const u1x = b.x - a.x;
  const u1y = b.y - a.y;

  const u2x = c.x - a.x;
  const u2y = c.y - a.y;

  const u3x = d.x - a.x;
  const u3y = d.y - a.y;

  const cross3 = u1x * u2y - u1y * u2x;
  const cross4 = u1x * u3y - u1y * u3x;

  return (cross3 > 0 !== cross4 > 0) || (cross3 < 0 !== cross4 < 0);
};

// Check if a line segment crosses a polygon (water)
export const lineIntersectsPolygon = (a: Point, b: Point, polygon: Point[]): boolean => {
  const len = polygon.length;
  if (len === 0) return false;

  const u1x = b.x - a.x;
  const u1y = b.y - a.y;

  for (let i = 0; i < len; i++) {
    const c = polygon[i];
    const d = polygon[i === len - 1 ? 0 : i + 1];

    const v1x = d.x - c.x;
    const v1y = d.y - c.y;

    const v2x = a.x - c.x;
    const v2y = a.y - c.y;

    const v3x = b.x - c.x;
    const v3y = b.y - c.y;

    const cross1 = v1x * v2y - v1y * v2x;
    const cross2 = v1x * v3y - v1y * v3x;

    // If a and b are on the same side of line cd, they don't intersect
    if ((cross1 > 0 && cross2 > 0) || (cross1 < 0 && cross2 < 0)) continue;

    const u2x = c.x - a.x;
    const u2y = c.y - a.y;

    const u3x = d.x - a.x;
    const u3y = d.y - a.y;

    const cross3 = u1x * u2y - u1y * u2x;
    const cross4 = u1x * u3y - u1y * u3x;

    if ((cross3 > 0 !== cross4 > 0) || (cross3 < 0 !== cross4 < 0)) return true;
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

export const distToSegment = (p: Point, v: Point, w: Point): number => {
  const dx = w.x - v.x;
  const dy = w.y - v.y;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return dist(p, v);
  let t = ((p.x - v.x) * dx + (p.y - v.y) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  const projX = v.x + t * dx;
  const projY = v.y + t * dy;
  const pdx = projX - p.x;
  const pdy = projY - p.y;
  return Math.sqrt(pdx * pdx + pdy * pdy);
};
