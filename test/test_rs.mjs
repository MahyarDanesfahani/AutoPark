// Node test: verify the Reeds-Shepp port by integrating every shortest word
// and checking that it lands exactly on the goal pose.
import { reedsSheppWords, wordToSegments } from '../js/reedsShepp.js';
import { VEHICLE, sampleSegments, wrapAngle } from '../js/vehicle.js';
import { World, obbOverlap } from '../js/collision.js';

const { maxCurvature: K, maxSteer } = VEHICLE;
let failures = 0;

function deg(d) { return (d * Math.PI) / 180; }

const cases = [];
for (const [sx, sy, st] of [[0, 0, 0], [2, -1, deg(30)]]) {
  for (const [gx, gy, gt] of [
    [6, 0, 0], [6, 3, deg(90)], [-4, 2, 0], [3, -5, deg(-90)],
    [1, 5, deg(180)], [-6, -3, deg(90)], [8, 0, deg(45)], [0.5, 2, deg(90)],
    [-2, 1, deg(-90)], [5, -2, deg(180)], [0, -6, 0], [7, 7, deg(135)],
  ]) {
    cases.push({ x: sx, y: sy, theta: st }, { x: gx, y: gy, theta: gt });
  }
}

console.log('--- Reeds-Shepp endpoint test ---');
for (let i = 0; i < cases.length; i += 2) {
  const s = cases[i], g = cases[i + 1];
  const words = reedsSheppWords(s, g, K);
  if (words.length === 0) { console.log(`case ${i / 2}: NO WORDS FOUND  s=${JSON.stringify(s)} g=${JSON.stringify(g)}`); failures++; continue; }
  const w = words[0];
  const segs = wordToSegments(w, s, K, maxSteer);
  const poses = sampleSegments(segs, 0.05);
  const end = poses[poses.length - 1];
  const perr = Math.hypot(end.x - g.x, end.y - g.y);
  const herr = Math.abs(wrapAngle(end.theta - g.theta));
  const lenM = w.L / K;
  const okPos = perr < 1e-6, okH = herr < 1e-6;
  if (!okPos || !okH) {
    failures++;
    console.log(`case ${i / 2}: FAIL perr=${perr.toExponential(2)} herr=${herr.toExponential(2)} types=${w.ctypes.join('')}`);
  }
}

console.log(failures === 0 ? 'RS endpoint: ALL PASS' : `RS endpoint: ${failures} FAILURES`);

// --- collision sanity ---
console.log('--- collision test ---');
const world = new World({
  obstacles: [{ x: 5, y: 0, halfL: 2.25, halfW: 0.9, theta: 0 }],
  bounds: { minX: -20, maxX: 20, minY: -10, maxY: 10 },
});
const c1 = world.poseCollides({ x: 5, y: 0, theta: 0 }, 0);          // same spot -> collide
const c2 = !world.poseCollides({ x: -6, y: 0, theta: 0 }, 0);         // far behind -> free
const c3 = world.poseCollides({ x: 1.2, y: 0, theta: 0 }, 0);         // overlapping front -> collide
const c4 = !world.poseCollides({ x: -2.6, y: 0, theta: 0 }, 0);       // just clear behind -> free
console.log({ c1, c2, c3, c4 });
if (!(c1 && c2 && c3 && c4)) { console.log('COLLISION TEST FAILED'); process.exit(1); }
console.log('collision: PASS');

// RS geometry should match a known value: straight-line case
{
  const s = { x: 0, y: 0, theta: 0 }, g = { x: 10, y: 0, theta: 0 };
  const words = reedsSheppWords(s, g, K);
  const best = words[0];
  const lenM = best.L / K;
  const straightOK = Math.abs(lenM - 10) < 1e-6; // LSL with zero arcs == straight line
  console.log(`straight case: len=${lenM.toFixed(4)} types=${best.ctypes.join('')} ${straightOK ? 'PASS' : 'FAIL'}`);
  if (!straightOK) process.exit(1);
}
if (failures > 0) process.exit(1);
console.log('ALL GOOD');
