import { GameState, GameMode, Station, Line, Train, Passenger, StationShape, AssetType, Point } from '../types';
import { CONFIG, SHAPE_WEIGHTS, COLORS } from '../constants';
import { dist, lineIntersectsPolygon, isPointInPolygon } from '../utils/geometry';

export class CoreSim {
  state: GameState;
  private stationIdCounter = 0;
  private passengerIdCounter = 0;
  private trainIdCounter = 0;
  private lineIdCounter = 0;

  constructor(mode: GameMode, width: number, height: number) {
    this.state = this.getInitialState(mode, width, height);
    this.generateMap(width, height);
    
    // Initial Spawn
    this.spawnStation(width / 2, height / 2, StationShape.SQUARE);
    this.spawnStation(width / 2 + 150, height / 2 + 50, StationShape.TRIANGLE);
    this.spawnStation(width / 2 - 100, height / 2 + 120, StationShape.CIRCLE);
  }

  private getInitialState(mode: GameMode, w: number, h: number): GameState {
    return {
      stations: [],
      lines: [],
      water: [],
      time: 0,
      week: 1,
      score: 0,
      assets: {
        lines: 3,
        tunnels: 3,
        carriages: 0,
        interchanges: 0,
      },
      activeAssets: {
        linesUsed: 0,
        tunnelsUsed: 0,
      },
      mode,
      isGameOver: false,
      isPaused: false,
      isMenuOpen: false,
      pendingUpgrade: false,
      camera: { x: 0, y: 0, zoom: 1 },
    };
  }

  private generateMap(w: number, h: number) {
    // Generate a simple river
    const riverWidth = 60;
    const river: Point[] = [
      { x: 0, y: h / 2 - riverWidth },
      { x: w * 0.4, y: h / 2 - riverWidth },
      { x: w * 0.6, y: h * 0.7 - riverWidth },
      { x: w, y: h * 0.7 - riverWidth },
      { x: w, y: h * 0.7 + riverWidth },
      { x: w * 0.6, y: h * 0.7 + riverWidth },
      { x: w * 0.4, y: h / 2 + riverWidth },
      { x: 0, y: h / 2 + riverWidth },
    ];
    this.state.water.push(river);
  }

  // --- External Actions (from UI/Input) ---

  public createLine(stationIds: string[], colorIndex: number): string | null {
    if (this.state.activeAssets.linesUsed >= this.state.assets.lines) return null;
    
    // Check tunnels
    let tunnelsNeeded = 0;
    for (let i = 0; i < stationIds.length - 1; i++) {
        const s1 = this.getStation(stationIds[i]);
        const s2 = this.getStation(stationIds[i+1]);
        if (s1 && s2 && this.checkWaterCrossing(s1.pos, s2.pos)) {
            tunnelsNeeded++;
        }
    }

    if (this.state.activeAssets.tunnelsUsed + tunnelsNeeded > this.state.assets.tunnels) {
        return null;
    }

    const id = `line_${this.lineIdCounter++}`;
    const color = COLORS.lines[colorIndex % COLORS.lines.length];
    
    const newLine: Line = {
      id,
      color,
      stationIds,
      trains: []
    };

    this.state.lines.push(newLine);
    this.state.activeAssets.linesUsed++;
    this.state.activeAssets.tunnelsUsed += tunnelsNeeded;

    // Auto-spawn a train on creation
    this.spawnTrain(id);

    return id;
  }

  public extendLine(lineId: string, newStationId: string, addToHead: boolean): boolean {
    const line = this.state.lines.find(l => l.id === lineId);
    if (!line) return false;

    // Check extreme mode constraint
    if (this.state.mode === GameMode.EXTREME) return false;

    const currentEndId = addToHead ? line.stationIds[0] : line.stationIds[line.stationIds.length - 1];
    
    // Prevent cycles for immediate neighbors (A-B-A)
    if (currentEndId === newStationId) return false;
    
    // Check tunnels
    const s1 = this.getStation(currentEndId);
    const s2 = this.getStation(newStationId);
    let tunnelsNeeded = 0;
    if (s1 && s2 && this.checkWaterCrossing(s1.pos, s2.pos)) {
        tunnelsNeeded = 1;
    }

    if (this.state.activeAssets.tunnelsUsed + tunnelsNeeded > this.state.assets.tunnels) return false;

    if (addToHead) {
      line.stationIds.unshift(newStationId);
    } else {
      line.stationIds.push(newStationId);
    }
    
    this.state.activeAssets.tunnelsUsed += tunnelsNeeded;
    
    // Adjust trains if head changed (simple shift logic or reset? reset is safer for MVP)
    // Actually, simple segment index fix is needed if unshifted.
    if (addToHead) {
        line.trains.forEach(t => t.segmentIndex++);
    }

    return true;
  }

  public removeLine(lineId: string) {
    if (this.state.mode === GameMode.EXTREME) return; // Cannot remove in Extreme

    const lineIdx = this.state.lines.findIndex(l => l.id === lineId);
    if (lineIdx === -1) return;

    const line = this.state.lines[lineIdx];
    
    // Refund tunnels
    let tunnelsUsed = 0;
    for (let i = 0; i < line.stationIds.length - 1; i++) {
        const s1 = this.getStation(line.stationIds[i]);
        const s2 = this.getStation(line.stationIds[i+1]);
        if (s1 && s2 && this.checkWaterCrossing(s1.pos, s2.pos)) {
            tunnelsUsed++;
        }
    }
    
    this.state.activeAssets.tunnelsUsed -= tunnelsUsed;
    this.state.activeAssets.linesUsed--;
    
    // Dump passengers back to stations
    line.trains.forEach(t => {
        const currentStation = this.getStation(line.stationIds[Math.floor(t.segmentIndex)]);
        // If between stations, dump at previous. Simple logic.
        if (currentStation) {
            t.passengers.forEach(p => {
                p.waitingAt = currentStation.id;
                currentStation.passengers.push(p);
            });
        }
    });

    this.state.lines.splice(lineIdx, 1);
  }

  public selectUpgrade(type: AssetType) {
      switch(type) {
          case AssetType.LINE: this.state.assets.lines++; break;
          case AssetType.CARRIAGE: this.state.assets.carriages++; break;
          case AssetType.TUNNEL: this.state.assets.tunnels += 2; break; // usually get 2 tunnels
          case AssetType.INTERCHANGE: this.state.assets.interchanges++; break;
      }
      this.state.pendingUpgrade = false;
      this.state.isPaused = false;
  }

  // --- Internal Simulation ---

  public update(dt: number) {
    if (this.state.isPaused || this.state.isGameOver || this.state.pendingUpgrade) return;

    this.state.time++;

    // 1. Spawning
    this.handleSpawning();

    // 2. Train Movement & Logic
    this.state.lines.forEach(line => {
      line.trains.forEach(train => {
        this.updateTrain(train, line);
      });
    });

    // 3. Overcrowding Check
    this.checkOvercrowding();

    // 4. Weekly Progress
    if (this.state.time % CONFIG.WEEK_LENGTH === 0) {
        this.state.week++;
        if (this.state.mode !== GameMode.ENDLESS) { // Endless gets assets by score usually, implementing standard week logic for MVP
             this.state.pendingUpgrade = true;
             this.state.isPaused = true;
        }
    }
  }

  private handleSpawning() {
      // Spawn Station (rarity based on station count and time)
      // Cap stations for MVP to avoid chaos
      const maxStations = 15 + Math.floor(this.state.time / 2000);
      if (this.state.stations.length < maxStations && Math.random() < 0.001) {
          this.spawnRandomStation();
      }

      // Spawn Passengers
      // Rate increases with time/score
      const spawnRate = 0.005 + (this.state.score * 0.0001) + (this.state.week * 0.001);
      if (Math.random() < spawnRate) {
          const stations = this.state.stations;
          if (stations.length < 2) return;
          const origin = stations[Math.floor(Math.random() * stations.length)];
          
          // Pick a target shape different from origin shape
          let targetShape = origin.shape;
          let attempts = 0;
          while (targetShape === origin.shape && attempts < 10) {
              const r = Math.random();
              if (r < 0.6) targetShape = StationShape.TRIANGLE;
              else if (r < 0.9) targetShape = StationShape.SQUARE;
              else targetShape = StationShape.STAR; // Higher tier shapes
              attempts++;
          }
          
          if (targetShape !== origin.shape) {
              const p: Passenger = {
                  id: `p_${this.passengerIdCounter++}`,
                  destination: targetShape,
                  spawnTime: this.state.time,
                  waitingAt: origin.id
              };
              origin.passengers.push(p);
          }
      }
  }

  private spawnRandomStation() {
      // Find a valid spot (not in water, not too close to others)
      const w = 1000; // virtual bounds
      const h = 800;
      let pos: Point = { x: 0, y: 0 };
      let valid = false;
      let attempts = 0;

      while (!valid && attempts < 50) {
          pos = {
              x: 50 + Math.random() * (w - 100),
              y: 50 + Math.random() * (h - 100)
          };
          
          // Check water
          let inWater = false;
          for (const poly of this.state.water) {
              if (isPointInPolygon(pos, poly)) {
                  inWater = true;
                  break;
              }
          }
          if (inWater) {
              attempts++;
              continue;
          }

          // Check proximity
          let tooClose = false;
          for (const s of this.state.stations) {
              if (dist(pos, s.pos) < 80) {
                  tooClose = true;
                  break;
              }
          }
          if (tooClose) {
              attempts++;
              continue;
          }

          valid = true;
      }

      if (valid) {
          // Determine shape based on rarity
          const r = Math.random();
          let shape = StationShape.CIRCLE;
          if (r < 0.2) shape = StationShape.TRIANGLE;
          if (r < 0.05) shape = StationShape.SQUARE;
          
          this.spawnStation(pos.x, pos.y, shape);
      }
  }

  private spawnStation(x: number, y: number, shape: StationShape) {
      const station: Station = {
          id: `s_${this.stationIdCounter++}`,
          pos: { x, y },
          shape,
          passengers: [],
          isOvercrowded: false,
          overcrowdTimer: 0
      };
      this.state.stations.push(station);
  }

  private spawnTrain(lineId: string) {
      const line = this.state.lines.find(l => l.id === lineId);
      if (!line) return;

      const train: Train = {
          id: `t_${this.trainIdCounter++}`,
          lineId,
          passengers: [],
          capacity: CONFIG.DEFAULT_TRAIN_CAPACITY, // Could be upgraded
          segmentIndex: 0,
          t: 0,
          direction: 1,
          status: 'MOVING',
          stopTimer: 0
      };
      line.trains.push(train);
  }

  private updateTrain(train: Train, line: Line) {
      if (line.stationIds.length < 2) return;

      if (train.status === 'BOARDING' || train.status === 'UNBOARDING') {
          train.stopTimer--;
          if (train.stopTimer <= 0) {
              if (train.status === 'UNBOARDING') {
                  // Switch to boarding
                  train.status = 'BOARDING';
                  this.handleBoarding(train, line);
              } else {
                  // Finished boarding, move
                  train.status = 'MOVING';
              }
          }
          return;
      }

      // Moving
      // Calculate distance of current segment
      const i1 = Math.floor(train.segmentIndex);
      let i2 = i1 + train.direction;
      
      // Handle end of line turnaround
      if (i2 < 0) {
          train.direction = 1;
          i2 = 1;
      } else if (i2 >= line.stationIds.length) {
          train.direction = -1;
          i2 = line.stationIds.length - 2;
      }

      const s1 = this.getStation(line.stationIds[i1]);
      const s2 = this.getStation(line.stationIds[i1 + train.direction]); // Target station

      if (!s1 || !s2) return; // Should not happen

      const d = dist(s1.pos, s2.pos);
      const moveAmount = CONFIG.TRAIN_SPEED / d;
      
      // Update t based on direction (we track t from 0..1 relative to segment start index)
      // Actually simpler: t always goes 0 -> 1 for the current segment from s1 to s2?
      // Let's keep t as "progress from station[segmentIndex] to station[segmentIndex+1]"
      // If direction is 1, t increases. If direction is -1, t decreases.
      
      if (train.direction === 1) {
          train.t += moveAmount;
          if (train.t >= 1) {
              // Arrived at i1 + 1
              train.segmentIndex++;
              train.t = 0;
              this.handleArrival(train, line, line.stationIds[train.segmentIndex]);
          }
      } else {
          train.t -= moveAmount;
          if (train.t <= 0) {
              // Arrived at i1
              // train.segmentIndex stays same (we are at the start of it)
              // But we need to decrement index to continue moving left next time?
              // No, if we are at index 2 and t=0, we are at station 2. 
              // To move to 1, we need to be in segment 1.
              this.handleArrival(train, line, line.stationIds[train.segmentIndex]);
              train.segmentIndex--; 
              train.t = 1;
          }
      }
  }

  private handleArrival(train: Train, line: Line, stationId: string) {
      train.status = 'UNBOARDING';
      train.stopTimer = 10; // Base stop time

      const station = this.getStation(stationId);
      if (!station) return;

      // 1. Unload passengers
      const offloading = train.passengers.filter(p => p.destination === station.shape);
      const staying = train.passengers.filter(p => p.destination !== station.shape);
      
      // Score logic
      this.state.score += offloading.length;
      train.passengers = staying;
      train.stopTimer += offloading.length * 5;

      // (Advanced: Transfers - unload if this station connects to a line that leads to target)
      // For MVP: Simple unloading only at destination.
  }

  private handleBoarding(train: Train, line: Line) {
      // Determine current station based on direction and segmentIndex logic from updateTrain
      let currentStationId: string;
      if (train.direction === 1) {
           // We just arrived at segmentIndex (which was incremented).
           currentStationId = line.stationIds[train.segmentIndex];
      } else {
          // We arrived at station[segmentIndex+1] relative to the NEW segmentIndex (after decrement).
          currentStationId = line.stationIds[train.segmentIndex + 1];
      }

      const station = currentStationId ? this.getStation(currentStationId) : undefined;
      if (!station) return;

      // Board passengers
      // Heuristic: Does this line contain a station with the passenger's shape?
      // Or does it connect to a line that does?
      // MVP: Only board if this line has the destination shape.
      
      const lineShapes = new Set(line.stationIds.map(sid => this.getStation(sid)?.shape));

      const boarding = [];
      const waiting = [];

      for (const p of station.passengers) {
          if (train.passengers.length + boarding.length < train.capacity) {
              // Does this line go to destination?
              if (lineShapes.has(p.destination)) {
                  boarding.push(p);
              } else {
                  // Allow random boarding if line doesn't match? No, that causes loops.
                  // Just wait.
                  waiting.push(p);
              }
          } else {
              waiting.push(p);
          }
      }

      train.passengers.push(...boarding);
      station.passengers = waiting;
      train.stopTimer += boarding.length * CONFIG.BOARDING_SPEED;
  }

  private checkOvercrowding() {
      if (this.state.mode === GameMode.ENDLESS || this.state.mode === GameMode.CREATIVE) return;

      this.state.stations.forEach(s => {
          if (s.passengers.length > CONFIG.MAX_STATION_CAPACITY) {
              s.isOvercrowded = true;
              s.overcrowdTimer++;
              if (s.overcrowdTimer > CONFIG.OVERCROWD_TIME_LIMIT) {
                  this.state.isGameOver = true;
              }
          } else {
              s.isOvercrowded = false;
              s.overcrowdTimer = Math.max(0, s.overcrowdTimer - 1);
          }
      });
  }

  // --- Helpers ---

  private getStation(id: string): Station | undefined {
      return this.state.stations.find(s => s.id === id);
  }

  private checkWaterCrossing(p1: Point, p2: Point): boolean {
      for (const poly of this.state.water) {
          if (lineIntersectsPolygon(p1, p2, poly)) return true;
      }
      return false;
  }
}
