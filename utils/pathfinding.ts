
import { Station, Line, StationShape, RouteInfo } from '../types';

// Map<StationID, Map<TargetShape, RouteInfo>>
export type RoutingTable = Map<string, Map<StationShape, RouteInfo>>;

export const buildRoutingTable = (stations: Station[], lines: Line[]): RoutingTable => {
    const table: RoutingTable = new Map();

    // ⚡ Bolt: Precompute adjacency list to replace O(L*S) neighbor lookup with O(1) inside BFS
    const adj = new Map<string, { nid: string, lineId: string }[]>();

    // Initialize map
    stations.forEach(s => {
        table.set(s.id, new Map());
        adj.set(s.id, []);
    });

    // ⚡ Bolt: Build adjacency list once (O(E)) instead of iterating all lines for every node in BFS
    lines.forEach(line => {
        for (let i = 0; i < line.stationIds.length; i++) {
            const sid = line.stationIds[i];
            const edges = adj.get(sid);
            if (edges) {
                if (i > 0) edges.push({ nid: line.stationIds[i - 1], lineId: line.id });
                if (i < line.stationIds.length - 1) edges.push({ nid: line.stationIds[i + 1], lineId: line.id });
            }
        }
    });

    // We need to calculate the route to EACH shape type from EACH station
    const shapes = Object.values(StationShape) as StationShape[];

    shapes.forEach(targetShape => {
        // BFS for this specific target shape
        // Queue stores { stationId, distance, firstLineIdUsed, nextStationId }
        // Actually, we do backwards BFS from destination stations
        
        const queue: { id: string, dist: number, lineId: string | null, nextId: string | null }[] = [];
        const visited = new Set<string>();

        // Init queue with stations that ARE this shape
        stations.filter(s => s.shape === targetShape).forEach(s => {
            queue.push({ id: s.id, dist: 0, lineId: null, nextId: null });
            visited.add(s.id);
            // Self-route
            // table.get(s.id)?.set(targetShape, { distance: 0, lineId: '', nextStationId: s.id });
        });

        while(queue.length > 0) {
            const current = queue.shift()!;

            // ⚡ Bolt: O(1) neighbor lookup instead of O(L*S) loop
            const neighbors = adj.get(current.id) || [];
            
            for (const neighbor of neighbors) {
                if (!visited.has(neighbor.nid)) {
                    visited.add(neighbor.nid);
                    // The neighbor N connects to Current C via 'line'.
                    // So a passenger at N wants to go to C.
                    const route: RouteInfo = {
                        distance: current.dist + 1,
                        lineId: neighbor.lineId,
                        nextStationId: current.id
                    };
                    table.get(neighbor.nid)?.set(targetShape, route);
                    queue.push({ id: neighbor.nid, dist: current.dist + 1, lineId: neighbor.lineId, nextId: current.id });
                }
            }
        }
    });

    return table;
};
