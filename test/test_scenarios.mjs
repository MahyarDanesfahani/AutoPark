// Node test: scenarios must have a collision-free goal inside its slot,
// a collision-free start that is not yet parked, and reachable geometry.
import { buildScenario } from '../js/scenarios.js';
import { World } from '../js/collision.js';
import { VEHICLE } from '../js/vehicle.js';

let bad = 0;
for (const type of ['parallel', 'perpendicular', 'angled']) {
  for (const diff of [0, 0.5, 1]) {
    const sc = buildScenario(type, diff);
    const w = new World({ obstacles: sc.obstacles, bounds: sc.bounds });

    const goalFree = !w.poseCollides(sc.goal, 0.0);
    const startFree = !w.poseCollides(sc.start, 0.0);
    const goalMargin = !w.poseCollides(sc.goal, 0.05);

    // distance start->goal should be a few meters (not trivial, not absurd)
    const d = Math.hypot(sc.goal.x - sc.start.x, sc.goal.y - sc.start.y);

    const ok = goalFree && startFree && goalMargin && d > 3 && d < 25;
    console.log(
      `${type} diff=${diff}: goalFree=${goalFree} startFree=${startFree} margin=${goalMargin} d=${d.toFixed(1)}m ${ok ? 'OK' : '** BAD **'}`
    );
    if (!ok) bad++;
  }
}
console.log(bad === 0 ? 'SCENARIOS ALL OK' : `${bad} FAILURES`);
process.exit(bad === 0 ? 0 : 1);
