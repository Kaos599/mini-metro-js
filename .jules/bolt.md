## 2024-06-11 - Renderer Performance Bottlenecks
**Learning:** Performing complex geometric checks (like `lineIntersectsPolygon` for water body tunneling) and O(N) array lookups (`state.stations.find`) inside the 60fps render loop causes unnecessary CPU strain, especially since stations map data doesn't change every frame and is inherently bound to IDs.
**Action:** Always memoize static geometric checks between consistent elements in a cache, and convert arrays to maps (O(1) lookups) at the top of the render function to avoid O(N) traversals per-entity being rendered.
