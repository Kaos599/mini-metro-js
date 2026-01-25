import { GameState, Station, Line, Train, Passenger, StationShape, Point, InteractionState } from '../types';
import { COLORS, CONFIG, SHAPE_WEIGHTS } from '../constants';
import { lerp } from '../utils/geometry';

export class Renderer {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;

  constructor(ctx: CanvasRenderingContext2D, width: number, height: number) {
    this.ctx = ctx;
    this.width = width;
    this.height = height;
  }

  render(state: GameState, interaction: InteractionState) {
    const { ctx, width, height } = this;
    
    // Clear
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, width, height);

    // Camera Transform (MVP: No zoom/pan implementation for brevity, assume 1:1)
    ctx.save();
    // ctx.translate(state.camera.x, state.camera.y);
    // ctx.scale(state.camera.zoom, state.camera.zoom);

    // Draw Water
    ctx.fillStyle = COLORS.water;
    state.water.forEach(poly => {
      ctx.beginPath();
      ctx.moveTo(poly[0].x, poly[0].y);
      for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
      ctx.closePath();
      ctx.fill();
    });

    // Draw Lines
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    state.lines.forEach(line => {
      if (line.stationIds.length < 2) return;
      ctx.lineWidth = CONFIG.LINE_WIDTH;
      ctx.strokeStyle = line.color;
      ctx.beginPath();
      
      const stations = line.stationIds.map(id => state.stations.find(s => s.id === id)).filter(Boolean) as Station[];
      
      if (stations.length > 0) {
          ctx.moveTo(stations[0].pos.x, stations[0].pos.y);
          for (let i = 1; i < stations.length; i++) {
              ctx.lineTo(stations[i].pos.x, stations[i].pos.y);
          }
      }
      ctx.stroke();
    });

    // Draw Interaction Line (Dragging)
    if (interaction.isDragging && interaction.dragStartStationId && interaction.dragCurrentPos) {
        const startStation = state.stations.find(s => s.id === interaction.dragStartStationId);
        if (startStation) {
            ctx.beginPath();
            ctx.strokeStyle = interaction.activeLineId 
                ? (state.lines.find(l => l.id === interaction.activeLineId)?.color || '#999')
                : (COLORS.lines[state.lines.length % COLORS.lines.length] || '#000'); // Prediction color
            
            ctx.lineWidth = CONFIG.LINE_WIDTH;
            ctx.setLineDash([10, 10]);
            ctx.moveTo(startStation.pos.x, startStation.pos.y);
            ctx.lineTo(interaction.dragCurrentPos.x, interaction.dragCurrentPos.y);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }

    // Draw Trains
    state.lines.forEach(line => {
        line.trains.forEach(train => {
            this.drawTrain(ctx, train, line, state.stations);
        });
    });

    // Draw Stations
    state.stations.forEach(station => {
        this.drawStation(ctx, station);
    });

    ctx.restore();
  }

  private drawStation(ctx: CanvasRenderingContext2D, station: Station) {
    const { x, y } = station.pos;
    const r = CONFIG.STATION_RADIUS;

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

    // Passengers
    // Draw them in a grid/cluster to the side
    const pSize = CONFIG.PASSENGER_RADIUS;
    const offset = r + 8;
    station.passengers.forEach((p, i) => {
        // Simple stacking logic
        const col = i % 3;
        const row = Math.floor(i / 3);
        const px = x + offset + (col * (pSize * 2.5));
        const py = y - r + (row * (pSize * 2.5));
        
        ctx.fillStyle = COLORS.passenger;
        this.drawShape(ctx, p.destination, px, py, pSize, true);
    });
  }

  private drawTrain(ctx: CanvasRenderingContext2D, train: Train, line: Line, stations: Station[]) {
      // Calculate position
      const i = Math.floor(train.segmentIndex);
      if (i >= line.stationIds.length - 1 && train.t > 0) return; // End of line guard
      
      const s1 = stations.find(s => s.id === line.stationIds[i]);
      const s2 = stations.find(s => s.id === line.stationIds[i+1]);
      
      if (!s1 || !s2) return;

      const pos = lerp(s1.pos, s2.pos, train.t);

      // Save, translate, rotate
      ctx.save();
      ctx.translate(pos.x, pos.y);
      const angle = Math.atan2(s2.pos.y - s1.pos.y, s2.pos.x - s1.pos.x);
      ctx.rotate(angle);

      // Draw body
      ctx.fillStyle = line.color;
      ctx.fillRect(-CONFIG.TRAIN_LENGTH/2, -CONFIG.TRAIN_WIDTH/2, CONFIG.TRAIN_LENGTH, CONFIG.TRAIN_WIDTH);
      
      // Draw passengers onboard
      train.passengers.forEach((p, idx) => {
           if (idx > 3) return; // visual cap
           ctx.fillStyle = '#fff';
           // simplified dots
           ctx.beginPath();
           ctx.arc(-8 + idx * 5, 0, 1.5, 0, Math.PI*2);
           ctx.fill();
      });

      ctx.restore();
  }

  private drawShape(ctx: CanvasRenderingContext2D, shape: StationShape, x: number, y: number, r: number, solid: boolean = false) {
      ctx.beginPath();
      switch(shape) {
          case StationShape.CIRCLE:
              ctx.arc(x, y, r, 0, Math.PI * 2);
              break;
          case StationShape.SQUARE:
              ctx.rect(x - r, y - r, r * 2, r * 2);
              break;
          case StationShape.TRIANGLE:
              ctx.moveTo(x, y - r);
              ctx.lineTo(x + r, y + r);
              ctx.lineTo(x - r, y + r);
              ctx.closePath();
              break;
          case StationShape.STAR:
               // Simple cross/star
               ctx.moveTo(x - r, y - r/2);
               ctx.lineTo(x + r, y + r/2);
               ctx.moveTo(x + r, y - r/2);
               ctx.lineTo(x - r, y + r/2);
               ctx.moveTo(x, y-r); ctx.lineTo(x, y+r);
               break;
          default:
               ctx.arc(x, y, r, 0, Math.PI * 2);
      }
      
      if (solid) {
          ctx.fill();
      } else {
          ctx.fill();
          ctx.stroke();
      }
  }
}
