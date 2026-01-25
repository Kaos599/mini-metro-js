
import { Station, Line, StationShape, RouteInfo } from '../types';

// Map<StationID, Map<TargetShape, RouteInfo>>
export type RoutingTable = Map<string, Map<StationShape, RouteInfo>>;

export const buildRoutingTable = (stations: Station[], lines: Line[]): RoutingTable => {
    const table: RoutingTable = new Map();

    // Initialize map
    stations.forEach(s => table.set(s.id, new Map()));

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

            // Find neighbors (stations connected by lines)
            // A neighbor N is connected to Current C if they share a line
            // Backwards search: If we go from N to C via Line L, then N's next hop is C via L.
            
            lines.forEach(line => {
                for (let i = 0; i < line.stationIds.length; i++) {
                    const sid = line.stationIds[i];
                    
                    // If this is the current station, look at neighbors in the line
                    if (sid === current.id) {
                        // Check previous and next in line
                        const neighbors = [];
                        if (i > 0) neighbors.push(line.stationIds[i - 1]);
                        if (i < line.stationIds.length - 1) neighbors.push(line.stationIds[i + 1]);

                        neighbors.forEach(nid => {
                            if (!visited.has(nid)) {
                                visited.add(nid);
                                // The neighbor N connects to Current C via 'line'.
                                // So a passenger at N wants to go to C.
                                const route: RouteInfo = {
                                    distance: current.dist + 1,
                                    lineId: line.id,
                                    nextStationId: current.id
                                };
                                table.get(nid)?.set(targetShape, route);
                                queue.push({ id: nid, dist: current.dist + 1, lineId: line.id, nextId: current.id });
                            }
                        });
                    }
                }
            });
        }
    });

    return table;
};
