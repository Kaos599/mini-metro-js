const { performance } = require('perf_hooks');

// Benchmark dist
function distOld(p1, p2) {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

function distNew(p1, p2) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

const p1 = {x: 10, y: 20};
const p2 = {x: 100, y: 200};

let start = performance.now();
for (let i = 0; i < 10000000; i++) {
  distOld(p1, p2);
}
console.log("distOld:", performance.now() - start, "ms");

start = performance.now();
for (let i = 0; i < 10000000; i++) {
  distNew(p1, p2);
}
console.log("distNew:", performance.now() - start, "ms");
