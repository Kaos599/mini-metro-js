## 2024-05-15 - Geometry Math Optimizations
**Learning:** `Math.pow` and repetitive `Math.sqrt` calculations in tight simulation loops (`utils/geometry.ts`) caused measurable CPU overhead when computing distances between moving entities and segments.
**Action:** Always prefer direct multiplication (`dx * dx + dy * dy`) over `Math.pow` for distance squares, and avoid recalculating square roots unnecessarily by reusing squared distances when checking thresholds or interpolating.
