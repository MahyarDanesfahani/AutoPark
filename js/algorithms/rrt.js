/**
 * rrt.js — Kinodynamic Rapidly-exploring Random Tree for parking.
 *
 * Random sampling with goal bias; the tree is grown by applying the same
 * steering primitives as the other planners (fair comparison). No analytic
 * finish — the tree stops inside a tolerance region around the goal, so
 * the final pose error is typically larger than Hybrid A*.
 */

import { VEHICLE, wrapAngle, sampleSegments, segmentsLength, countReversals } from '../vehicle.js';
import { emptyResult } from '../plannerCommon.js';

const STEP = 1.0;                        // meters per extension
const STEERS = [-1, -0.5, 0, 0.5, 1];    // × maxSteer
const GOAL_BIAS = 0.12;
const GOAL_POS_TOL = 0.3;
const GOAL_TH_TOL = (11 * Math.PI) / 180;
const MAX_NODES = 12000;
const TIME_LIMIT_MS = 2500;

// Deterministic-ish PRNG (mulberry32) so runs are reproducible per seed.
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function weightedDistance(p, q) {
  return Math.hypot(p.x - q.x, p.y - q.y) + 1.8 * Math.abs(wrapAngle(p.theta - q.theta));
}

export function planRRT(scenario, world, opts = {}) {
  const res = emptyResult('rrt');
  const t0 = performance.now();
  const { start, goal, bounds } = scenario;
  const rand = mulberry32(opts.seed ?? 12345);

  const nodes = [{ pose: { ...start }, parent: null, seg: null }];

  function arcEnd(p, steer, dir, step) {
    if (Math.abs(steer) < 1e-9) {
      return { x: p.x + dir * step * Math.cos(p.theta), y: p.y + dir * step * Math.sin(p.theta), theta: p.theta };
    }
    const R = VEHICLE.wheelBase / Math.tan(steer);
    const dth = (dir * step) / R;
    const th2 = p.theta + dth;
    return { x: p.x + R * (Math.sin(th2) - Math.sin(p.theta)), y: p.y - R * (Math.cos(th2) - Math.cos(p.theta)), theta: wrapAngle(th2) };
  }

  let winner = null;

  while (nodes.length < MAX_NODES) {
    if ((nodes.length & 15) === 0 && performance.now() - t0 > TIME_LIMIT_MS) break;

    // sample a target pose
    let target;
    const r = rand();
    if (r < GOAL_BIAS) {
      target = goal;
    } else if (r < 0.35) {
      // informed sampling near the goal to help the tree reach the slot
      target = {
        x: goal.x + (rand() - 0.5) * 4,
        y: goal.y + (rand() - 0.5) * 4,
        theta: goal.theta + (rand() - 0.5) * Math.PI,
      };
    } else {
      target = {
        x: bounds.minX + rand() * (bounds.maxX - bounds.minX),
        y: bounds.minY + rand() * (bounds.maxY - bounds.minY),
        theta: rand() * 2 * Math.PI - Math.PI,
      };
    }

    // nearest node in the weighted metric
    let best = null, bestD = Infinity;
    for (let i = 0; i < nodes.length; i++) {
      const d = weightedDistance(nodes[i].pose, target);
      if (d < bestD) { bestD = d; best = nodes[i]; }
    }

    // variable step: near the target shrink the extension so the tree can
    // creep into the (tight) goal region instead of overshooting it
    const d0 = weightedDistance(best.pose, target);
    const step = Math.max(0.3, Math.min(STEP, d0));

    // try primitives ordered by how close they land to the target
    const candidates = [];
    for (const sMul of STEERS) {
      const steer = sMul * VEHICLE.maxSteer;
      for (const dir of [1, -1]) {
        const end = arcEnd(best.pose, steer, dir, step);
        candidates.push({ steer, dir, end, d: weightedDistance(end, target) });
      }
    }
    candidates.sort((a, b) => a.d - b.d);

    for (let tries = 0; tries < 3 && tries < candidates.length; tries++) {
      const c = candidates[tries];
      if (world.segmentCollides(best.pose.x, best.pose.y, best.pose.theta, c.steer, c.dir, step, 0.25)) continue;
      const node = {
        pose: c.end,
        parent: best,
        seg: { x0: best.pose.x, y0: best.pose.y, th0: best.pose.theta, steer: c.steer, dir: c.dir, length: step },
      };
      nodes.push(node);

      const dp = Math.hypot(c.end.x - goal.x, c.end.y - goal.y);
      const dt = Math.abs(wrapAngle(c.end.theta - goal.theta));
      if (dp < GOAL_POS_TOL && dt < GOAL_TH_TOL) { winner = node; }
      break; // accept first collision-free candidate
    }

    if (winner) break;
  }

  res.planningTimeMs = performance.now() - t0;
  res.nodesExpanded = nodes.length;

  if (winner) {
    const segs = [];
    let n = winner;
    while (n && n.seg) { segs.push(n.seg); n = n.parent; }
    segs.reverse();
    res.success = true;
    res.segments = segs;
    res.poses = sampleSegments(res.segments, 0.1);
    res.pathLength = segmentsLength(res.segments);
    res.reversals = countReversals(res.segments);
    const end = res.poses[res.poses.length - 1];
    res.finalPose = end;
    res.posErrorM = Math.hypot(end.x - goal.x, end.y - goal.y);
    res.headErrorDeg = (Math.abs(wrapAngle(end.theta - goal.theta)) * 180) / Math.PI;
  }

  // visualization: subsample tree nodes (every 2nd)
  res.visited = [];
  for (let i = 0; i < nodes.length; i += 2) {
    res.visited.push(nodes[i].pose.x, nodes[i].pose.y, nodes[i].pose.theta);
  }
  return res;
}
