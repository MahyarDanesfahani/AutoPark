// Node test: run all planners on all scenarios, validate that every
// returned path is actually collision-free and print a comparison table.
import { buildScenario } from '../js/scenarios.js';
import { World } from '../js/collision.js';
import { planHybridAStar } from '../js/algorithms/hybridAstar.js';
import { planAStar } from '../js/algorithms/astar.js';
import { planRRT } from '../js/algorithms/rrt.js';
import { sampleSegments } from '../js/vehicle.js';

const DIFFS = [0, 0.5, 1];
let problems = 0;

function validate(name, result, world) {
  if (!result.success) return null;
  const poses = sampleSegments(result.segments, 0.1);
  for (const p of poses) {
    if (world.poseCollides(p, 0.0)) {
      console.log(`  !! ${name} PATH COLLIDES at (${p.x.toFixed(2)}, ${p.y.toFixed(2)})`);
      problems++;
      return false;
    }
  }
  return true;
}

const summary = [];
for (const type of ['parallel', 'perpendicular', 'angled']) {
  for (const diff of DIFFS) {
    const sc = buildScenario(type, diff);
    const world = new World({ obstacles: sc.obstacles, bounds: sc.bounds });
    const runners = [
      ['hybrid-astar', () => planHybridAStar(sc, world)],
      ['astar', () => planAStar(sc, world)],
      ['rrt', () => planRRT(sc, world, { seed: 7 })],
    ];
    console.log(`\n=== ${type}  difficulty=${diff} (slot: parallel len / others width) ===`);
    for (const [name, fn] of runners) {
      const r = fn();
      const ok = validate(name, r, world);
      console.log(
        `  ${name.padEnd(12)} ${r.success ? 'OK  ' : 'FAIL'}  t=${r.planningTimeMs.toFixed(0).padStart(5)}ms  ` +
        `len=${(r.pathLength || 0).toFixed(1)}m  rev=${r.reversals}  ` +
        `posErr=${r.success ? (r.posErrorM * 100).toFixed(1) + 'cm' : '-'}  ` +
        `headErr=${r.success ? r.headErrorDeg.toFixed(1) + 'deg' : '-'}  nodes=${r.nodesExpanded}` +
        (ok === false ? '  [COLLISION!]' : '')
      );
      summary.push({ type, diff, name, success: r.success, time: r.planningTimeMs, len: r.pathLength, pos: r.posErrorM });
    }
  }
}

// RRT seed sensitivity: 5 runs on the hardest parallel case
{
  const sc = buildScenario('parallel', 1);
  const world = new World({ obstacles: sc.obstacles, bounds: sc.bounds });
  let wins = 0;
  const times = [];
  for (let seed = 1; seed <= 5; seed++) {
    const r = planRRT(sc, world, { seed });
    if (r.success) { wins++; times.push(r.planningTimeMs); validate(`rrt-s${seed}`, r, world); }
  }
  console.log(`\nRRT x5 seeds on parallel/ hardest: ${wins}/5 success`);
}

console.log(problems === 0 ? '\nALL PATHS VALID' : `\n${problems} PROBLEMS`);
process.exit(problems === 0 ? 0 : 1);
