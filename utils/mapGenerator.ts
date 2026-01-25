import { Point, TerrainStyle, MapComplexityConfig, StationShape } from '../types';

// Seeded random number generator (Mulberry32)
export function createSeededRandom(seed: number): () => number {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export interface MapData {
  water: Point[][];
  initialStations: { pos: Point; shape: StationShape }[];
  regions: Point[][]; // Land regions separated by water
}

// Catmull-Rom spline interpolation for smooth curves
function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (
    (2 * p1) +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  );
}

function catmullRomPoint(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  return {
    x: catmullRom(p0.x, p1.x, p2.x, p3.x, t),
    y: catmullRom(p0.y, p1.y, p2.y, p3.y, t),
  };
}

// Generate smooth path through control points
function generateSmoothPath(controlPoints: Point[], segmentsPerCurve: number = 20): Point[] {
  if (controlPoints.length < 2) return controlPoints;
  
  const path: Point[] = [];
  
  for (let i = 0; i < controlPoints.length - 1; i++) {
    const p0 = controlPoints[Math.max(0, i - 1)];
    const p1 = controlPoints[i];
    const p2 = controlPoints[i + 1];
    const p3 = controlPoints[Math.min(controlPoints.length - 1, i + 2)];
    
    for (let t = 0; t < segmentsPerCurve; t++) {
      path.push(catmullRomPoint(p0, p1, p2, p3, t / segmentsPerCurve));
    }
  }
  
  path.push(controlPoints[controlPoints.length - 1]);
  return path;
}

// Convert a centerline to a polygon with width
function centerlineToPolygon(centerline: Point[], width: number, rng: () => number, widthVariation: number = 0.2): Point[] {
  if (centerline.length < 2) return [];
  
  const leftSide: Point[] = [];
  const rightSide: Point[] = [];
  
  for (let i = 0; i < centerline.length; i++) {
    const curr = centerline[i];
    const prev = centerline[Math.max(0, i - 1)];
    const next = centerline[Math.min(centerline.length - 1, i + 1)];
    
    // Calculate perpendicular direction
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    
    // Vary width slightly for natural look
    const localWidth = width * (1 + (rng() - 0.5) * widthVariation);
    
    leftSide.push({ x: curr.x + nx * localWidth, y: curr.y + ny * localWidth });
    rightSide.push({ x: curr.x - nx * localWidth, y: curr.y - ny * localWidth });
  }
  
  // Combine into polygon (left side forward, right side backward)
  return [...leftSide, ...rightSide.reverse()];
}

// Generate a meandering river
function generateMeanderingRiver(
  width: number,
  height: number,
  rng: () => number,
  riverWidth: number = 50,
  curviness: number = 0.3
): Point[] {
  const numControlPoints = 5 + Math.floor(rng() * 3);
  const controlPoints: Point[] = [];
  
  // Decide orientation (horizontal or vertical)
  const horizontal = rng() > 0.5;
  
  for (let i = 0; i <= numControlPoints; i++) {
    const t = i / numControlPoints;
    
    if (horizontal) {
      const baseX = t * width;
      const baseY = height * (0.3 + rng() * 0.4);
      const noise = (rng() - 0.5) * 2 * curviness * height * 0.25;
      controlPoints.push({ x: baseX, y: baseY + noise });
    } else {
      const baseX = width * (0.3 + rng() * 0.4);
      const baseY = t * height;
      const noise = (rng() - 0.5) * 2 * curviness * width * 0.25;
      controlPoints.push({ x: baseX + noise, y: baseY });
    }
  }
  
  const centerline = generateSmoothPath(controlPoints, 15);
  return centerlineToPolygon(centerline, riverWidth, rng);
}

// Generate a river delta (splits into branches)
function generateRiverDelta(
  width: number,
  height: number,
  rng: () => number,
  riverWidth: number = 45
): Point[][] {
  const rivers: Point[][] = [];
  
  // Main river from left
  const mainControlPoints: Point[] = [
    { x: 0, y: height * 0.4 + rng() * height * 0.2 },
    { x: width * 0.3, y: height * 0.45 + (rng() - 0.5) * height * 0.15 },
    { x: width * 0.5, y: height * 0.5 + (rng() - 0.5) * height * 0.1 },
  ];
  
  const mainCenterline = generateSmoothPath(mainControlPoints, 12);
  rivers.push(centerlineToPolygon(mainCenterline, riverWidth, rng));
  
  // Branch 1 - goes up-right
  const branch1Points: Point[] = [
    mainControlPoints[2],
    { x: width * 0.7, y: height * 0.35 + (rng() - 0.5) * height * 0.1 },
    { x: width, y: height * 0.25 + rng() * height * 0.15 },
  ];
  const branch1Centerline = generateSmoothPath(branch1Points, 10);
  rivers.push(centerlineToPolygon(branch1Centerline, riverWidth * 0.7, rng));
  
  // Branch 2 - goes down-right
  const branch2Points: Point[] = [
    mainControlPoints[2],
    { x: width * 0.75, y: height * 0.65 + (rng() - 0.5) * height * 0.1 },
    { x: width, y: height * 0.75 + rng() * height * 0.1 },
  ];
  const branch2Centerline = generateSmoothPath(branch2Points, 10);
  rivers.push(centerlineToPolygon(branch2Centerline, riverWidth * 0.6, rng));
  
  return rivers;
}

// Generate coastal water
function generateCoastline(
  width: number,
  height: number,
  rng: () => number,
  coverage: number = 0.25
): Point[] {
  const edge = rng() > 0.5 ? 'bottom' : 'right';
  const numPoints = 8 + Math.floor(rng() * 5);
  const coastPoints: Point[] = [];
  
  if (edge === 'bottom') {
    const baseY = height * (1 - coverage);
    coastPoints.push({ x: 0, y: baseY + (rng() - 0.5) * height * 0.15 });
    
    for (let i = 1; i < numPoints - 1; i++) {
      const t = i / (numPoints - 1);
      coastPoints.push({
        x: t * width,
        y: baseY + (rng() - 0.5) * height * 0.2,
      });
    }
    
    coastPoints.push({ x: width, y: baseY + (rng() - 0.5) * height * 0.15 });
    
    const smoothCoast = generateSmoothPath(coastPoints, 8);
    
    // Close polygon at bottom
    return [
      ...smoothCoast,
      { x: width, y: height },
      { x: 0, y: height },
    ];
  } else {
    const baseX = width * (1 - coverage);
    coastPoints.push({ x: baseX + (rng() - 0.5) * width * 0.15, y: 0 });
    
    for (let i = 1; i < numPoints - 1; i++) {
      const t = i / (numPoints - 1);
      coastPoints.push({
        x: baseX + (rng() - 0.5) * width * 0.2,
        y: t * height,
      });
    }
    
    coastPoints.push({ x: baseX + (rng() - 0.5) * width * 0.15, y: height });
    
    const smoothCoast = generateSmoothPath(coastPoints, 8);
    
    return [
      ...smoothCoast,
      { x: width, y: height },
      { x: width, y: 0 },
    ];
  }
}

// Generate island archipelago
function generateIslands(
  width: number,
  height: number,
  rng: () => number,
  coverage: number = 0.35
): Point[][] {
  const waters: Point[][] = [];
  
  // Create background water covering more area
  const bgWater: Point[] = [];
  const centerX = width * (0.4 + rng() * 0.2);
  const centerY = height * (0.4 + rng() * 0.2);
  const numPoints = 12;
  const baseRadius = Math.min(width, height) * coverage;
  
  for (let i = 0; i < numPoints; i++) {
    const angle = (i / numPoints) * Math.PI * 2;
    const radiusVar = baseRadius * (0.8 + rng() * 0.4);
    bgWater.push({
      x: centerX + Math.cos(angle) * radiusVar,
      y: centerY + Math.sin(angle) * radiusVar,
    });
  }
  
  waters.push(generateSmoothPath([...bgWater, bgWater[0]], 6));
  
  // Add a secondary water body
  const secondCenterX = width * (rng() > 0.5 ? 0.2 : 0.8);
  const secondCenterY = height * (0.3 + rng() * 0.4);
  const secondRadius = baseRadius * 0.5;
  const secondWater: Point[] = [];
  
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const radiusVar = secondRadius * (0.7 + rng() * 0.6);
    secondWater.push({
      x: secondCenterX + Math.cos(angle) * radiusVar,
      y: secondCenterY + Math.sin(angle) * radiusVar,
    });
  }
  
  waters.push(generateSmoothPath([...secondWater, secondWater[0]], 5));
  
  return waters;
}

// Check if point is inside any water polygon
function isPointInWater(point: Point, waterBodies: Point[][]): boolean {
  for (const water of waterBodies) {
    if (isPointInPolygon(point, water)) return true;
  }
  return false;
}

// Ray casting algorithm for point-in-polygon
function isPointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    
    if (((yi > point.y) !== (yj > point.y)) &&
        (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

// Distance between two points
function dist(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// Place initial stations with balanced distribution
function placeInitialStations(
  width: number,
  height: number,
  waterBodies: Point[][],
  rng: () => number,
  count: number = 3,
  minDistance: number = 100
): { pos: Point; shape: StationShape }[] {
  const stations: { pos: Point; shape: StationShape }[] = [];
  const shapes: StationShape[] = [StationShape.CIRCLE, StationShape.TRIANGLE, StationShape.SQUARE];
  
  const margin = 80;
  let attempts = 0;
  const maxAttempts = 500;
  
  while (stations.length < count && attempts < maxAttempts) {
    attempts++;
    
    const pos: Point = {
      x: margin + rng() * (width - margin * 2),
      y: margin + rng() * (height - margin * 2),
    };
    
    // Check if in water
    if (isPointInWater(pos, waterBodies)) continue;
    
    // Check distance from other stations
    let tooClose = false;
    for (const existing of stations) {
      if (dist(pos, existing.pos) < minDistance) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) continue;
    
    // Valid position found
    stations.push({
      pos,
      shape: shapes[stations.length % shapes.length],
    });
  }
  
  return stations;
}

// Main map generation function
export function generateMap(
  width: number,
  height: number,
  config: MapComplexityConfig
): MapData {
  const rng = createSeededRandom(config.seed);
  
  let water: Point[][] = [];
  const riverWidth = 40 + config.waterCoverage * 60;
  
  switch (config.terrainStyle) {
    case TerrainStyle.RIVER:
      water = [generateMeanderingRiver(width, height, rng, riverWidth, 0.35)];
      break;
      
    case TerrainStyle.DELTA:
      water = generateRiverDelta(width, height, rng, riverWidth * 0.9);
      break;
      
    case TerrainStyle.COASTAL:
      water = [generateCoastline(width, height, rng, config.waterCoverage)];
      break;
      
    case TerrainStyle.ISLANDS:
      water = generateIslands(width, height, rng, config.waterCoverage);
      break;
      
    default:
      water = [generateMeanderingRiver(width, height, rng, riverWidth, 0.3)];
  }
  
  // Place initial stations
  const initialStationCount = 3;
  const initialStations = placeInitialStations(
    width,
    height,
    water,
    rng,
    initialStationCount,
    120
  );
  
  return {
    water,
    initialStations,
    regions: [], // Could be computed for advanced balancing
  };
}

// Generate a random seed
export function generateSeed(): number {
  return Math.floor(Math.random() * 2147483647);
}
