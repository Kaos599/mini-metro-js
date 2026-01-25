import React, { useEffect, useRef } from 'react';
import { COLORS } from '../constants';

interface AnimatedBackgroundProps {
  width: number;
  height: number;
}

interface BackgroundTrain {
  pathIndex: number;
  t: number; // 0 to 1 progress along path
  speed: number;
  direction: 1 | -1;
  color: string;
  length: number;
}

// Bezier curve path helper
const getBezierPoint = (t: number, p0: number[], p1: number[], p2: number[], p3: number[]): number[] => {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  const uuu = uu * u;
  const ttt = tt * t;
  
  return [
    uuu * p0[0] + 3 * uu * t * p1[0] + 3 * u * tt * p2[0] + ttt * p3[0],
    uuu * p0[1] + 3 * uu * t * p1[1] + 3 * u * tt * p2[1] + ttt * p3[1],
  ];
};

// Get tangent angle at point t on bezier
const getBezierAngle = (t: number, p0: number[], p1: number[], p2: number[], p3: number[]): number => {
  const u = 1 - t;
  const dx = 3 * u * u * (p1[0] - p0[0]) + 6 * u * t * (p2[0] - p1[0]) + 3 * t * t * (p3[0] - p2[0]);
  const dy = 3 * u * u * (p1[1] - p0[1]) + 6 * u * t * (p2[1] - p1[1]) + 3 * t * t * (p3[1] - p2[1]);
  return Math.atan2(dy, dx);
};

export const AnimatedBackground: React.FC<AnimatedBackgroundProps> = ({ width, height }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trainsRef = useRef<BackgroundTrain[]>([]);
  const pathsRef = useRef<number[][][]>([]);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    // Generate bezier paths based on screen size
    const margin = 50;
    const paths: number[][][] = [
      // Horizontal wavy line - top area
      [
        [-100, height * 0.2],
        [width * 0.25, height * 0.15],
        [width * 0.75, height * 0.25],
        [width + 100, height * 0.2],
      ],
      // Diagonal crossing - middle
      [
        [-100, height * 0.7],
        [width * 0.3, height * 0.4],
        [width * 0.7, height * 0.5],
        [width + 100, height * 0.35],
      ],
      // Bottom curve
      [
        [width * 0.1, height + 50],
        [width * 0.3, height * 0.6],
        [width * 0.6, height * 0.65],
        [width * 0.9, height + 50],
      ],
      // S-curve through center
      [
        [-50, height * 0.5],
        [width * 0.2, height * 0.3],
        [width * 0.8, height * 0.7],
        [width + 50, height * 0.5],
      ],
    ];
    pathsRef.current = paths;

    // Initialize trains on each path
    const trains: BackgroundTrain[] = [];
    const lineColors = COLORS.lines;
    
    paths.forEach((_, i) => {
      // 1-2 trains per path
      const numTrains = 1 + Math.floor(Math.random() * 2);
      for (let j = 0; j < numTrains; j++) {
        trains.push({
          pathIndex: i,
          t: Math.random(),
          speed: 0.0003 + Math.random() * 0.0002,
          direction: Math.random() > 0.5 ? 1 : -1,
          color: lineColors[(i + j) % lineColors.length],
          length: 20 + Math.random() * 15,
        });
      }
    });
    trainsRef.current = trains;

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [width, height]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const animate = () => {
      ctx.clearRect(0, 0, width, height);

      // Draw track lines (very subtle)
      ctx.globalAlpha = 0.08;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';

      pathsRef.current.forEach((path, i) => {
        ctx.strokeStyle = COLORS.lines[i % COLORS.lines.length];
        ctx.beginPath();
        ctx.moveTo(path[0][0], path[0][1]);
        ctx.bezierCurveTo(
          path[1][0], path[1][1],
          path[2][0], path[2][1],
          path[3][0], path[3][1]
        );
        ctx.stroke();
      });

      // Update and draw trains
      ctx.globalAlpha = 0.2;
      trainsRef.current.forEach(train => {
        // Update position
        train.t += train.speed * train.direction;
        
        // Bounce at ends
        if (train.t >= 1) {
          train.t = 1;
          train.direction = -1;
        } else if (train.t <= 0) {
          train.t = 0;
          train.direction = 1;
        }

        const path = pathsRef.current[train.pathIndex];
        if (!path) return;

        const pos = getBezierPoint(train.t, path[0], path[1], path[2], path[3]);
        const angle = getBezierAngle(train.t, path[0], path[1], path[2], path[3]);

        ctx.save();
        ctx.translate(pos[0], pos[1]);
        ctx.rotate(angle);
        
        // Draw train body
        ctx.fillStyle = train.color;
        ctx.beginPath();
        ctx.roundRect(-train.length / 2, -8, train.length, 16, 4);
        ctx.fill();

        // Draw train front highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(train.direction === 1 ? train.length / 2 - 6 : -train.length / 2, -8, 6, 16);
        
        ctx.restore();
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
};
