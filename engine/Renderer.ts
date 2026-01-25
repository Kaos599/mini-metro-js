
import { GameState, Station, Line, Train, InteractionState, Point } from '../types';
import { COLORS, CONFIG } from '../constants';
import { lerp, lineIntersectsPolygon } from '../utils/geometry';

export class Renderer {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;

  constructor(ctx: CanvasRenderingContext2D, width: number, height: number) {
    this.ctx = ctx;
    this.width = width;
    this.height = height;
  }

  // Convert screen coordinates to world coordinates
  screenToWorld(screenX: number, screenY: number, camera: { x: number; y: number; zoom: number }): Point {
    return {
      x: (screenX / camera.zoom) + camera.x,
      y: (screenY / camera.zoom) + camera.y,
    };
  }

  // Convert world coordinates to screen coordinates
  worldToScreen(worldX: number, worldY: number, camera: { x: number; y: number; zoom: number }): Point {
    return {
      x: (worldX - camera.x) * camera.zoom,
      y: (worldY - camera.y) * camera.zoom,
    };
  }

  render(state: GameState, interaction: InteractionState, alpha: number) {
    const { ctx, width, height } = this;
    const camera = state.camera;
    
    // Clear (in screen space, before camera transform)
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, width, height);

    // Apply camera transform
    ctx.save();
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);

    // 1. Draw Water
    ctx.fillStyle = COLORS.water;
    state.water.forEach(poly => {
      if (poly.length === 0) return;
      ctx.beginPath();
      ctx.moveTo(poly[0].x, poly[0].y);
      for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
      ctx.closePath();
      ctx.fill();
    });

    // 2. Batch Draw Lines with tunnel visualization
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = CONFIG.LINE_WIDTH;

    state.lines.forEach(line => {
      if (line.stationIds.length < 2) return;
      
      // Highlight/Dim logic for Line Manager
      if (interaction.selectedLineId && interaction.selectedLineId !== line.id) {
          ctx.globalAlpha = 0.2;
      } else {
          ctx.globalAlpha = 1.0;
      }

      ctx.strokeStyle = line.color;
      const stations = line.stationIds.map(id => state.stations.find(s => s.id === id)).filter(Boolean) as Station[];
      
      if (stations.length > 0) {
          // Draw each segment, checking for water crossings (tunnels)
          for (let i = 0; i < stations.length - 1; i++) {
              const s1 = stations[i];
              const s2 = stations[i + 1];
              const isTunnel = state.water.some(poly => lineIntersectsPolygon(s1.pos, s2.pos, poly));
              
              ctx.beginPath();
              ctx.moveTo(s1.pos.x, s1.pos.y);
              ctx.lineTo(s2.pos.x, s2.pos.y);
              
              if (isTunnel) {
                  // Tunnel segment: dotted line with slightly thinner stroke
                  ctx.setLineDash([8, 6]);
                  ctx.lineWidth = CONFIG.LINE_WIDTH - 1;
                  ctx.stroke();
                  ctx.setLineDash([]);
                  ctx.lineWidth = CONFIG.LINE_WIDTH;
                  
                  // Draw tunnel entry/exit markers (small circles at stations)
                  this.drawTunnelMarker(ctx, s1.pos, line.color);
                  this.drawTunnelMarker(ctx, s2.pos, line.color);
              } else {
                  // Normal segment: solid line
                  ctx.stroke();
              }
          }
      }
    });
    ctx.globalAlpha = 1.0;

    // 3. Interaction Ghost Line (need to convert drag position to world coords)
    if (interaction.isDragging && interaction.dragStartStationId && interaction.dragCurrentPos) {
        const startStation = state.stations.find(s => s.id === interaction.dragStartStationId);
        if (startStation) {
            // dragCurrentPos is in world coordinates (converted in App.tsx)
            const ghostColor = interaction.activeLineId 
                ? (state.lines.find(l => l.id === interaction.activeLineId)?.color || '#999')
                : (interaction.isCreatingNewLine && interaction.newLineColorIndex !== null)
                    ? COLORS.lines[interaction.newLineColorIndex % COLORS.lines.length]
                    : '#333';
            
            ctx.beginPath();
            ctx.strokeStyle = ghostColor;
            ctx.setLineDash([10, 10]);
            ctx.moveTo(startStation.pos.x, startStation.pos.y);
            ctx.lineTo(interaction.dragCurrentPos.x, interaction.dragCurrentPos.y);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }

    // 4. Draw Trains (Interpolated)
    state.lines.forEach(line => {
        // Dim trains on unselected lines
        if (interaction.selectedLineId && interaction.selectedLineId !== line.id) {
             ctx.globalAlpha = 0.2;
        } else {
             ctx.globalAlpha = 1.0;
        }

        line.trains.forEach(train => {
            this.drawTrain(ctx, train, line, state.stations, alpha);
        });
    });
    ctx.globalAlpha = 1.0;

    // 5. Draw Stations
    state.stations.forEach(station => {
        this.drawStation(ctx, station);
    });

    // Draw "creating new line" indicator on stations when in drawing mode
    if (interaction.isCreatingNewLine && interaction.newLineColorIndex !== null) {
        const lineColor = COLORS.lines[interaction.newLineColorIndex % COLORS.lines.length];
        state.stations.forEach(station => {
            ctx.beginPath();
            ctx.arc(station.pos.x, station.pos.y, CONFIG.STATION_RADIUS + 6, 0, Math.PI * 2);
            ctx.strokeStyle = lineColor;
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            ctx.stroke();
            ctx.setLineDash([]);
        });
    }

    // Restore camera transform
    ctx.restore();
  }

  private drawStation(ctx: CanvasRenderingContext2D, station: Station) {
    const { x, y } = station.pos;
    const r = CONFIG.STATION_RADIUS;

    // Pulse Effect
    if (station.pulsePhase > 0) {
        const pulse = Math.sin(station.pulsePhase) * 4;
        ctx.beginPath();
        ctx.arc(x, y, r + 4 + pulse, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 68, 68, 0.3)';
        ctx.fill();
    }

    // Overcrowd indicator
    if (station.overcrowdTimer > 0) {
        const progress = station.overcrowdTimer / CONFIG.OVERCROWD_TIME_LIMIT;
        ctx.beginPath();
        ctx.arc(x, y, r + 8, -Math.PI/2, -Math.PI/2 + (Math.PI * 2 * progress));
        ctx.lineWidth = 4;
        ctx.strokeStyle = COLORS.overcrowd;
        ctx.stroke();
    }

    // Shape
    ctx.fillStyle = COLORS.stationFill;
    ctx.strokeStyle = COLORS.stationStroke;
    ctx.lineWidth = 3;
    this.drawShape(ctx, station.shape, x, y, r);

    // Passengers (Grid)
    const pSize = CONFIG.PASSENGER_RADIUS;
    const offset = r + 8;
    station.passengers.forEach((p, i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        const px = x + offset + (col * (pSize * 2.5));
        const py = y - r + (row * (pSize * 2.5));
        
        ctx.fillStyle = COLORS.passenger;
        this.drawShape(ctx, p.destination, px, py, pSize, true);
    });
  }

  private drawTrain(ctx: CanvasRenderingContext2D, train: Train, line: Line, stations: Station[], alpha: number) {
      // INTERPOLATION LOGIC
      // We need to lerp between (prevSegmentIndex, prevT) and (segmentIndex, t)
      
      const getPos = (segIdx: number, tVal: number) => {
          const i = Math.floor(segIdx);
          if (i >= line.stationIds.length - 1) return null;
          const s1 = stations.find(s => s.id === line.stationIds[i]);
          const s2 = stations.find(s => s.id === line.stationIds[i+1]);
          if (!s1 || !s2) return null;
          return lerp(s1.pos, s2.pos, tVal);
      };

      const currPos = getPos(train.segmentIndex, train.t);
      const prevPos = getPos(train.prevSegmentIndex, train.prevT);

      // If we jumped segments violently (wrapping around or just spawned), don't lerp, just use current
      let pos = currPos;
      if (currPos && prevPos && Math.abs(train.segmentIndex - train.prevSegmentIndex) <= 1) {
          pos = lerp(prevPos, currPos, alpha);
      }

      if (!pos) return;

      ctx.save();
      ctx.translate(pos.x, pos.y);
      // Rotation (simplified, using current segment angle)
      // Getting strict angle interpolation is tricky if turning corners. 
      // MVP: Use current segment angle.
      const i = Math.floor(train.segmentIndex);
      if (i < line.stationIds.length - 1) {
          const s1 = stations.find(s => s.id === line.stationIds[i]);
          const s2 = stations.find(s => s.id === line.stationIds[i+1]);
          if (s1 && s2) {
             const angle = Math.atan2(s2.pos.y - s1.pos.y, s2.pos.x - s1.pos.x);
             ctx.rotate(angle);
          }
      }

      ctx.fillStyle = line.color;
      ctx.fillRect(-CONFIG.TRAIN_LENGTH/2, -CONFIG.TRAIN_WIDTH/2, CONFIG.TRAIN_LENGTH, CONFIG.TRAIN_WIDTH);
      
      // Passengers
      train.passengers.forEach((p, idx) => {
           if (idx > 3) return; 
           ctx.fillStyle = '#fff';
           ctx.beginPath();
           ctx.arc(-8 + idx * 5, 0, 1.5, 0, Math.PI*2);
           ctx.fill();
      });

      ctx.restore();
  }

  private drawShape(ctx: CanvasRenderingContext2D, shape: any, x: number, y: number, r: number, solid: boolean = false) {
      // (Same shape drawing code)
      ctx.beginPath();
      // ... mapping code same as previous ...
      // Just re-implementing switch quickly
      if (shape === 'CIRCLE') ctx.arc(x, y, r, 0, Math.PI*2);
      else if (shape === 'SQUARE') ctx.rect(x-r, y-r, r*2, r*2);
      else if (shape === 'TRIANGLE') { ctx.moveTo(x, y-r); ctx.lineTo(x+r, y+r); ctx.lineTo(x-r, y+r); ctx.closePath(); }
      else { ctx.arc(x, y, r, 0, Math.PI*2); } // fallback
      
      if (solid) ctx.fill(); else { ctx.fill(); ctx.stroke(); }
  }
  
  private drawTunnelMarker(ctx: CanvasRenderingContext2D, pos: Point, color: string) {
      // Draw a small tunnel indicator (arc/semi-circle) at tunnel entry/exit points
      ctx.save();
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, CONFIG.STATION_RADIUS + 4, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
  }
}
