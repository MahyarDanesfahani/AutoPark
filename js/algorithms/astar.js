/**
 * astar.js — A* on a discretized state lattice (x, y, heading).
 *
 * Classic grid-style A* cannot park a car (no heading, no reverse), so the
 * fair baseline is the standard "state-lattice A*": positions and headings
 * are discretized and the search moves on fixed motion primitives
 * (arcs at full lock, straight) forward and backward. Unlike Hybrid A*
 * there is no continuous refinement and no analytic finish, so the path
 * ends *near* the goal but not exactly on it — the classic trade-off this
 * simulator demonstrates.
 */

import { VEHICLE, wrapAngle, sampleSegments, segmentsLength, countReversals } from '../vehicle.js';
import { MinHeap, emptyResult } from '../plannerCommon.js';

const RES = 0.3;          // meters
const N_TH = 16;          // heading bins (22.5 deg)
const DTH = (2 * Math.PI) / N_TH;
// Primitive arc length: one heading bin at full steering lock.
const ARC = VEHICLE.minTurnRadius * DTH;   // ≈ 1.73 m
const SWITCH_PENALTY = 0.55;
const GOAL_POS_TOL = 0.3;
const GOAL_TH_TOL = (16 * Math.PI) / 180;
const MAX_EXPANSIONS = 60000;
const TIME_LIMIT_MS = 2500;

function keyOf(x, y, theta) {
  const ix = Math.round(x / RES);
  const iy = Math.round(y / RES);
  const it = Math.round(((((theta % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) / DTH)) % N_TH;
  return ix * 2000000 + iy * 1000 + it;
}

function heuristic(x, y, theta, goal) {
  // Euclidean lower bound + heading mismatch estimate
  const d = Math.hypot(goal.x - x, goal.y - y);
  const hth = Math.abs(wrapAngle(goal.theta - theta));
  return d + 0.7 * hth;
}

export function planAStar(scenario, world) {
  const res = emptyResult('astar');
  const t0 = performance.now();
  const { start, goal } = scenario;

  const open = new MinHeap();
  const closed = new Set();
  const nodes = new Map();
  let nextId = 0;

  function push(x, y, theta, g, parent, seg) {
    const id = nextId++;
    const node = { id, x, y, theta, g, parent, seg };
    nodes.set(id, node);
    open.push(g + heuristic(x, y, theta, goal), id);
  }

  push(start.x, start.y, start.theta, 0, null, null);

  let expanded = 0;
  let winner = null;

  while (open.size > 0) {
    if (expanded > MAX_EXPANSIONS || performance.now() - t0 > TIME_LIMIT_MS) break;
    const id = open.pop();
    const node = nodes.get(id);
    if (!node) continue;
    const k = keyOf(node.x, node.y, node.theta);
    if (closed.has(k)) continue;
    closed.add(k);
    expanded++;
    if (res.visited.length < 25000) res.visited.push(node.x, node.y, node.theta);

    // goal test (region): the lattice cannot hit the exact pose
    const dp = Math.hypot(goal.x - node.x, goal.y - node.y);
    const dt = Math.abs(wrapAngle(goal.theta - node.theta));
    if (dp < GOAL_POS_TOL && dt < GOAL_TH_TOL) { winner = node; break; }

    for (const steerMul of [-1, 0, 1]) {
      const steer = steerMul * VEHICLE.maxSteer;
      for (const dir of [1, -1]) {
        let nx, ny, nth;
        if (steerMul === 0) {
          nx = node.x + dir * ARC * Math.cos(node.theta);
          ny = node.y + dir * ARC * Math.sin(node.theta);
          nth = node.theta;
        } else {
          const R = VEHICLE.wheelBase / Math.tan(steer);
          const dth = (dir * ARC) / R;
          const th2 = node.theta + dth;
          nx = node.x + R * (Math.sin(th2) - Math.sin(node.theta));
          ny = node.y - R * (Math.cos(th2) - Math.cos(node.theta));
          nth = wrapAngle(th2);
        }
        const nk = keyOf(nx, ny, nth);
        if (closed.has(nk)) continue;
        if (world.segmentCollides(node.x, node.y, node.theta, steer, dir, ARC, 0.2)) continue;

        let g = node.g + ARC;
        if (!node.seg || node.seg.dir !== dir) g += SWITCH_PENALTY;
        const seg = { x0: node.x, y0: node.y, th0: node.theta, steer, dir, length: ARC };
        push(nx, ny, nth, g, node, seg);
      }
    }
  }

  res.nodesExpanded = expanded;
  res.planningTimeMs = performance.now() - t0;

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
  return res;
}
