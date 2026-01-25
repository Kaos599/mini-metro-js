import { GameState, GameMode, Station, Line, Train, Passenger, StationShape, AssetType, Point, RouteInfo } from '../types';
import { CONFIG, COLORS } from '../constants';
import { dist, lineIntersectsPolygon, isPointInPolygon, distToSegment } from '../utils/geometry';
import { ObjectPool } from '../utils/pool';
import { buildRoutingTable, RoutingTable } from '../utils/pathfinding';

export class CoreSim {
  state: GameState;
  private stationIdCounter = 0;
  private passengerIdCounter = 0;
  private trainIdCounter = 0;
  private lineIdCounter = 0;

  private passengerPool: ObjectPool<Passenger>;
  private routingTable: RoutingTable = new Map();
  private isNetworkDirty = true; // Flag to rebuild routing

  constructor(mode: GameMode, width: number, height: number) {
    this.state = this.getInitialState(mode, width, height);
    
    // Pool Setup
    this.passengerPool = new ObjectPool<Passenger>(
        () => ({ id: '', destination: StationShape.CIRCLE, spawnTime: 0, waitingAt: '', nextHopLineId: null }),
        (p) => { p.id = ''; p.nextHopLineId = null; }
    );

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
        locomotives: 3, // Start with same amount as lines usually
      },
      activeAssets: {
        linesUsed: 0,
        tunnelsUsed: 0,
        locomotivesUsed: 0,
      },
      mode,
      isGameOver: false,
      isPaused: false,
      isMenuOpen: false,
      pendingUpgrade: false,
      timeScale: 1.0,
      camera: { x: 0, y: 0, zoom: 1 },
    };
  }

  private generateMap(w: number, h: number) {
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

  // --- External Actions ---

  public setTimeScale(scale: number) {
      this.state.timeScale = scale;
  }

  public createLine(stationIds: string[], colorIndex: number): string | null {
    if (this.state.activeAssets.linesUsed >= this.state.assets.lines) return null;
    if (this.state.activeAssets.locomotivesUsed >= this.state.assets.locomotives) return null; // Need a train to start a line
    
    let tunnelsNeeded = 0;
    for (let i = 0; i < stationIds.length - 1; i++) {
        const s1 = this.getStation(stationIds[i]);
        const s2 = this.getStation(stationIds[i+1]);
        if (s1 && s2 && this.checkWaterCrossing(s1.pos, s2.pos)) {
            tunnelsNeeded++;
        }
    }

    if (this.state.activeAssets.tunnelsUsed + tunnelsNeeded > this.state.assets.tunnels) return null;

    const id = `line_${this.lineIdCounter++}`;
    const color = COLORS.lines[colorIndex % COLORS.lines.length];
    
    const newLine: Line = {
      id, color, stationIds, trains: []
    };

    this.state.lines.push(newLine);
    this.state.activeAssets.linesUsed++;
    this.state.activeAssets.tunnelsUsed += tunnelsNeeded;
    this.state.activeAssets.locomotivesUsed++; // Consume 1 locomotive

    this.spawnTrain(id);
    
    this.isNetworkDirty = true; 
    return id;
  }

  public addLocomotiveToLine(lineId: string): boolean {
      if (this.state.activeAssets.locomotivesUsed >= this.state.assets.locomotives) return false;
      const line = this.state.lines.find(l => l.id === lineId);
      if (!line) return false;

      this.spawnTrain(lineId);
      this.state.activeAssets.locomotivesUsed++;
      return true;
  }

  public addCarriageToLine(lineId: string): boolean {
      if (this.state.assets.carriages <= 0) return false;
      const line = this.state.lines.find(l => l.id === lineId);
      if (!line || line.trains.length === 0) return false;

      // Find train with smallest capacity on this line, or just the first one?
      // Logic: Find a train with < max capacity (e.g. max 18 passengers = 3 cars)
      const train = line.trains.find(t => t.capacity < CONFIG.DEFAULT_TRAIN_CAPACITY * 3);
      if (!train) return false; // All trains full length

      train.capacity += CONFIG.DEFAULT_TRAIN_CAPACITY;
      this.state.assets.carriages--; 
      return true;
  }

  public extendLine(lineId: string, newStationId: string, addToHead: boolean): boolean {
    const line = this.state.lines.find(l => l.id === lineId);
    if (!line) return false;
    if (this.state.mode === GameMode.EXTREME) return false;

    const currentEndId = addToHead ? line.stationIds[0] : line.stationIds[line.stationIds.length - 1];
    if (currentEndId === newStationId) return false;
    
    const s1 = this.getStation(currentEndId);
    const s2 = this.getStation(newStationId);
    let tunnelsNeeded = 0;
    if (s1 && s2 && this.checkWaterCrossing(s1.pos, s2.pos)) tunnelsNeeded = 1;

    if (this.state.activeAssets.tunnelsUsed + tunnelsNeeded > this.state.assets.tunnels) return false;

    if (addToHead) line.stationIds.unshift(newStationId);
    else line.stationIds.push(newStationId);
    
    this.state.activeAssets.tunnelsUsed += tunnelsNeeded;
    
    if (addToHead) {
        line.trains.forEach(t => {
            t.segmentIndex++; 
            t.prevSegmentIndex++;
        });
    }

    this.isNetworkDirty = true;
    return true;
  }

  public removeLine(lineId: string) {
    const lineIdx = this.state.lines.findIndex(l => l.id === lineId);
    if (lineIdx === -1) return;
    const line = this.state.lines[lineIdx];
    
    let tunnelsUsed = 0;
    for (let i = 0; i < line.stationIds.length - 1; i++) {
        const s1 = this.getStation(line.stationIds[i]);
        const s2 = this.getStation(line.stationIds[i+1]);
        if (s1 && s2 && this.checkWaterCrossing(s1.pos, s2.pos)) tunnelsUsed++;
    }
    this.state.activeAssets.tunnelsUsed -= tunnelsUsed;
    this.state.activeAssets.linesUsed--;
    
    // Recover Locomotives and Carriages
    line.trains.forEach(t => {
        this.state.activeAssets.locomotivesUsed--;
        // Recover carriages
        const extraCap = t.capacity - CONFIG.DEFAULT_TRAIN_CAPACITY;
        if (extraCap > 0) {
            const carriagesReturned = extraCap / CONFIG.DEFAULT_TRAIN_CAPACITY;
            this.state.assets.carriages += carriagesReturned;
        }

        const currentStation = this.getStation(line.stationIds[Math.floor(t.segmentIndex)]);
        if (currentStation) {
            t.passengers.forEach(p => {
                p.waitingAt = currentStation.id;
                p.nextHopLineId = null;
                currentStation.passengers.push(p);
            });
        } else {
             t.passengers.forEach(p => this.passengerPool.release(p));
        }
    });

    this.state.lines.splice(lineIdx, 1);
    this.isNetworkDirty = true;
  }

  public deleteLineAt(pos: Point, threshold: number = 10): boolean {
    if (this.state.mode === GameMode.EXTREME) return false;
    let foundLineId: string | null = null;
    for (const line of this.state.lines) {
        for (let i = 0; i < line.stationIds.length - 1; i++) {
            const s1 = this.getStation(line.stationIds[i]);
            const s2 = this.getStation(line.stationIds[i+1]);
            if (s1 && s2) {
                const d = distToSegment(pos, s1.pos, s2.pos);
                if (d < threshold) { foundLineId = line.id; break; }
            }
        }
        if (foundLineId) break;
    }
    if (foundLineId) { this.removeLine(foundLineId); return true; }
    return false;
  }

  public selectUpgrade(type: AssetType) {
      switch(type) {
          case AssetType.LINE: 
            this.state.assets.lines++; 
            this.state.assets.locomotives++; // A new line usually comes with a train
            break;
          case AssetType.CARRIAGE: this.state.assets.carriages++; break;
          case AssetType.TUNNEL: this.state.assets.tunnels += 2; break; 
          case AssetType.LOCOMOTIVE: this.state.assets.locomotives++; break;
          case AssetType.INTERCHANGE: this.state.assets.interchanges++; break;
      }
      this.state.pendingUpgrade = false;
      this.state.isPaused = false;
  }

  // --- Simulation ---

  public tick() {
    if (this.state.isPaused || this.state.isGameOver || this.state.pendingUpgrade) return;
    
    this.state.time++;

    if (this.isNetworkDirty) {
        this.routingTable = buildRoutingTable(this.state.stations, this.state.lines);
        this.state.stations.forEach(s => {
            s.passengers.forEach(p => {
                const route = this.routingTable.get(s.id)?.get(p.destination);
                p.nextHopLineId = route ? route.lineId : null;
            });
        });
        this.isNetworkDirty = false;
    }

    this.handleSpawning();

    this.state.lines.forEach(line => {
      line.trains.forEach(train => {
        this.updateTrain(train, line);
      });
    });

    this.checkOvercrowding();

    if (this.state.time % CONFIG.WEEK_LENGTH === 0) {
        this.state.week++;
        if (this.state.mode !== GameMode.ENDLESS) {
             this.state.pendingUpgrade = true;
             this.state.isPaused = true;
        }
    }
  }

  private handleSpawning() {
      if (this.state.mode === GameMode.CREATIVE) return;

      const weekFactor = 1 + (this.state.week * 0.15);
      const stationFactor = Math.max(1, this.state.stations.length / 8);
      let spawnChance = 0.005 * weekFactor * stationFactor;
      
      const nearDeath = this.state.stations.some(s => s.passengers.length > CONFIG.MAX_STATION_CAPACITY * 0.8);
      if (nearDeath) spawnChance *= 0.5;

      const maxStations = 15 + Math.floor(this.state.time / 2000); 
      if (this.state.stations.length < maxStations && Math.random() < 0.001) {
          this.spawnRandomStation();
      }

      if (Math.random() < spawnChance) {
          const stations = this.state.stations;
          if (stations.length < 2) return;
          const origin = stations[Math.floor(Math.random() * stations.length)];
          
          let targetShape = origin.shape;
          let attempts = 0;
          while (targetShape === origin.shape && attempts < 10) {
              const r = Math.random();
              if (r < 0.6) targetShape = StationShape.TRIANGLE;
              else if (r < 0.9) targetShape = StationShape.SQUARE;
              else targetShape = StationShape.STAR;
              attempts++;
          }
          
          if (targetShape !== origin.shape) {
              const p = this.passengerPool.get();
              p.id = `p_${this.passengerIdCounter++}`;
              p.destination = targetShape;
              p.spawnTime = this.state.time;
              p.waitingAt = origin.id;
              
              const route = this.routingTable.get(origin.id)?.get(targetShape);
              p.nextHopLineId = route ? route.lineId : null;

              origin.passengers.push(p);
          }
      }
  }

  private spawnRandomStation() {
      const w = 1000; 
      const h = 800;
      let pos: Point = { x: 0, y: 0 };
      let valid = false;
      let attempts = 0;

      while (!valid && attempts < 50) {
          pos = { x: 50 + Math.random()*(w-100), y: 50 + Math.random()*(h-100) };
          let inWater = false;
          for (const poly of this.state.water) {
              if (isPointInPolygon(pos, poly)) { inWater = true; break; }
          }
          if (inWater) { attempts++; continue; }
          let tooClose = false;
          for (const s of this.state.stations) {
              if (dist(pos, s.pos) < 80) { tooClose = true; break; }
          }
          if (tooClose) { attempts++; continue; }
          valid = true;
      }

      if (valid) {
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
          pos: { x, y }, shape, passengers: [],
          isOvercrowded: false, overcrowdTimer: 0, pulsePhase: 0
      };
      this.state.stations.push(station);
      this.isNetworkDirty = true;
  }

  private spawnTrain(lineId: string) {
      const line = this.state.lines.find(l => l.id === lineId);
      if (!line) return;
      const train: Train = {
          id: `t_${this.trainIdCounter++}`, lineId, passengers: [],
          capacity: CONFIG.DEFAULT_TRAIN_CAPACITY,
          segmentIndex: 0, t: 0, direction: 1,
          prevSegmentIndex: 0, prevT: 0,
          status: 'MOVING', stopTimer: 0
      };
      line.trains.push(train);
  }

  private updateTrain(train: Train, line: Line) {
      if (line.stationIds.length < 2) return;

      train.prevSegmentIndex = train.segmentIndex;
      train.prevT = train.t;

      if (train.status === 'BOARDING' || train.status === 'UNBOARDING') {
          train.stopTimer--;
          if (train.stopTimer <= 0) {
              if (train.status === 'UNBOARDING') {
                  train.status = 'BOARDING';
                  this.handleBoarding(train, line);
              } else {
                  train.status = 'MOVING';
              }
          }
          return;
      }

      const i1 = Math.floor(train.segmentIndex);
      const s1 = this.getStation(line.stationIds[i1]);
      const s2Idx = i1 + train.direction;
      const s2 = this.getStation(line.stationIds[s2Idx]);

      if (!s1 || !s2) {
          if (s2Idx < 0 || s2Idx >= line.stationIds.length) {
              train.direction *= -1;
              return; 
          }
          return; 
      }

      const d = dist(s1.pos, s2.pos);
      const moveAmount = CONFIG.TRAIN_SPEED / d;

      if (train.direction === 1) {
          train.t += moveAmount;
          if (train.t >= 1) {
              train.segmentIndex++;
              train.t = 0;
              this.handleArrival(train, line, line.stationIds[train.segmentIndex]);
          }
      } else {
          train.t -= moveAmount;
          if (train.t <= 0) {
              this.handleArrival(train, line, line.stationIds[train.segmentIndex]);
              if (train.segmentIndex > 0) {
                   train.segmentIndex--; 
                   train.t = 1;
              } else {
                  train.direction = 1; 
              }
          }
      }
  }

  private handleArrival(train: Train, line: Line, stationId: string) {
      train.status = 'UNBOARDING';
      train.stopTimer = 10;
      const station = this.getStation(stationId);
      if (!station) return;
      
      const offloading: Passenger[] = [];
      const staying: Passenger[] = [];

      train.passengers.forEach(p => {
          if (p.destination === station.shape) {
              offloading.push(p);
          } else {
              const route = this.routingTable.get(station.id)?.get(p.destination);
              if (route && route.lineId !== line.id) {
                  p.waitingAt = station.id;
                  p.nextHopLineId = route.lineId;
                  offloading.push(p);
              } else {
                  staying.push(p);
              }
          }
      });

      offloading.forEach(p => {
          if (p.destination === station.shape) {
              this.state.score++;
              this.passengerPool.release(p);
          } else {
              station.passengers.push(p);
          }
      });

      train.passengers = staying;
      train.stopTimer += offloading.length * 5;
  }

  private handleBoarding(train: Train, line: Line) {
      let currentStationId = line.stationIds[train.direction === 1 ? train.segmentIndex : train.segmentIndex + 1];
      if (!currentStationId && train.direction === -1) currentStationId = line.stationIds[train.segmentIndex];
      
      const station = this.getStation(currentStationId);
      if (!station) return;

      const boarding: Passenger[] = [];
      const waiting: Passenger[] = [];

      station.passengers.forEach(p => {
          if (train.passengers.length + boarding.length < train.capacity) {
              if (p.nextHopLineId === line.id) {
                  boarding.push(p);
              } 
              else if (!p.nextHopLineId) {
                  const lineShapes = new Set(line.stationIds.map(sid => this.getStation(sid)?.shape));
                  if (lineShapes.has(p.destination)) {
                      boarding.push(p);
                  } else {
                      waiting.push(p);
                  }
              } else {
                  waiting.push(p);
              }
          } else {
              waiting.push(p);
          }
      });

      train.passengers.push(...boarding);
      station.passengers = waiting;
      train.stopTimer += boarding.length * CONFIG.BOARDING_SPEED;
  }

  private checkOvercrowding() {
      if (this.state.mode === GameMode.ENDLESS || this.state.mode === GameMode.CREATIVE) return;
      this.state.stations.forEach(s => {
          if (s.passengers.length > CONFIG.MAX_STATION_CAPACITY * 0.7) {
              s.pulsePhase = (this.state.time * 0.2) % (Math.PI * 2);
          } else {
              s.pulsePhase = 0;
          }

          if (s.passengers.length > CONFIG.MAX_STATION_CAPACITY) {
              s.isOvercrowded = true;
              s.overcrowdTimer++;
              if (s.overcrowdTimer > CONFIG.OVERCROWD_TIME_LIMIT) this.state.isGameOver = true;
          } else {
              s.isOvercrowded = false;
              s.overcrowdTimer = Math.max(0, s.overcrowdTimer - 1);
          }
      });
  }
  
  private getStation(id: string) { return this.state.stations.find(s => s.id === id); }
  private checkWaterCrossing(p1: Point, p2: Point) { 
      return this.state.water.some(poly => lineIntersectsPolygon(p1, p2, poly)); 
  }
}