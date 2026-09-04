## 2024-05-18 - Math.pow vs multiply
**Learning:** Found that geometry math uses Math.pow for squaring in dist calculation, which runs many times per tick.
**Action:** Replace Math.pow(a, 2) with a * a in critical path distance calculations since this is heavily used in geometry calculations.
