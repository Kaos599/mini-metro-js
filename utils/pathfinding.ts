
import { Station, Line, StationShape, RouteInfo } from '../types';

// Map<StationID, Map<TargetShape, RouteInfo>>
export type RoutingTable = Map<string, Map<StationShape, RouteInfo>>;

export const buildRoutingTable = (stations: Station[], lines: Line[]): RoutingTable => {
    const table: RoutingTable = new Map();
    // ⚡ Bolt: Precompute an adjacency list (O(L*S)) to avoid iterating over all lines on every BFS pop
    const adj = new Map<string, { neighborId: string, lineId: string }[]>();

    // Initialize map
    stations.forEach(s => {
        table.set(s.id, new Map());
        adj.set(s.id, []);
    });

    lines.forEach(line => {
        for (let i = 0; i < line.stationIds.length; i++) {
            const sid = line.stationIds[i];
            const neighbors = adj.get(sid);
            if (!neighbors) continue;

            if (i > 0) neighbors.push({ neighborId: line.stationIds[i - 1], lineId: line.id });
            if (i < line.stationIds.length - 1) neighbors.push({ neighborId: line.stationIds[i + 1], lineId: line.id });
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

        // ⚡ Bolt: Using pointer qIdx avoids O(N) array shift overhead
        let qIdx = 0;
        while(qIdx < queue.length) {
            const current = queue[qIdx++];

            // Find neighbors using the precomputed adjacency list
            const neighbors = adj.get(current.id);
            if (neighbors) {
                for (let i = 0; i < neighbors.length; i++) {
                    const edge = neighbors[i];
                    const nid = edge.neighborId;
                    if (!visited.has(nid)) {
                        visited.add(nid);
                        // The neighbor N connects to Current C via 'line'.
                        // So a passenger at N wants to go to C.
                        const route: RouteInfo = {
                            distance: current.dist + 1,
                            lineId: edge.lineId,
                            nextStationId: current.id
                        };
                        table.get(nid)?.set(targetShape, route);
                        queue.push({ id: nid, dist: current.dist + 1, lineId: edge.lineId, nextId: current.id });
                    }
                }
            }
        }
    });

    return table;
};
