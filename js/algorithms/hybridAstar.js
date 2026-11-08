/**
 * hybridAstar.js — Hybrid A* for autonomous parking.
 *
 * Continuous state (x, y, theta) expanded with fixed steering primitives,
 * cell-based pruning of the search space, hybrid heuristic
 * (max of Euclidean and obstacle-free Reeds-Shepp length) and an analytic
 * Reeds-Shepp expansion ("shot") that finishes the path exactly on the
 * goal pose.
 */

import { VEHICLE, wrapAngle, sampleSegments, segmentsLength, countReversals } from '../vehicle.js';
import { reedsSheppWords, reedsSheppConnection } from '../reedsShepp.js';
import { MinHeap, emptyResult } from '../plannerCommon.js';

const XY_CELL = 0.35;
const TH_BINS = 16;                     // 22.5° bins — 45° bins block shot-ready headings
const REEXPAND_EPS = 0.25;              // re-expand a cell only if g improved by this much
const STEP = 0.7;                       // meters per primitive
const STEERS = [-1, -0.5, 0, 0.5, 1];   // × maxSteer
const SWITCH_PENALTY = 0.55;            // cost of changing travel direction
const REVERSE_PENALTY = 0.09;           // per meter driven in reverse
const STEER_PENALTY = 0.06;             // per primitive spent steering hard
const MAX_EXPANSIONS = 45000;
const TIME_LIMIT_MS = 2500;

function cellKey(x, y, theta) {
  const ix = Math.round(x / XY_CELL);
  const iy = Math.round(y / XY_CELL);
  let t = Math.round((((theta % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) / (2 * Math.PI) * TH_BINS) % TH_BINS;
  return ix * 100000 + iy * 100 + t;
}

function rsLengthNoObstacles(from, goal) {
  const words = reedsSheppWords(from, goal, VEHICLE.maxCurvature);
  return words.length ? words[0].L / VEHICLE.maxCurvature : Infinity;
}

export function planHybridAStar(scenario, world) {
  const res = emptyResult('hybrid-astar');
  const t0 = performance.now();
  const { start, goal } = scenario;

  // Trivial case: direct Reeds-Shepp connection already collision-free.
  const direct = reedsSheppConnection(start, goal, VEHICLE.maxCurvature, VEHICLE.maxSteer, world, 4, 0.2);
  if (direct) {
    res.success = true;
    res.segments = direct.segments;
    finalize(res, goal, t0, 1);
    return res;
  }

  const open = new MinHeap();
  const closed = new Map(); // cellKey -> g
  const nodes = new Map();  // id -> node
  let nextId = 0;

  function pushNode(x, y, theta, g, h, parent, seg) {
    const id = nextId++;
    nodes.set(id, { id, x, y, theta, g, parent, seg });
    open.push(g + h, id);
  }

  const h0 = Math.max(
    Math.hypot(goal.x - start.x, goal.y - start.y),
    rsLengthNoObstacles(start, goal)
  );
  pushNode(start.x, start.y, start.theta, 0, h0, null, null);

  let expanded = 0;
  let winner = null;
  let rsShot = null;
  // fallback finish: if no exact Reeds-Shepp shot exists (physically impossible
  // in the tightest slots), end on the closest reachable pose instead.
  let tolNode = null;
  let tolScore = Infinity;

  while (open.size > 0) {
    if (expanded > MAX_EXPANSIONS || performance.now() - t0 > TIME_LIMIT_MS) break;
    const id = open.pop();
    const node = nodes.get(id);
    if (!node) continue;
    const key = cellKey(node.x, node.y, node.theta);
    const prevG = closed.get(key);
    if (prevG !== undefined && prevG <= node.g + REEXPAND_EPS) continue;
    closed.set(key, node.g);

    expanded++;
    if (res.visited.length < 25000) res.visited.push(node.x, node.y, node.theta);

    const dist = Math.hypot(goal.x - node.x, goal.y - node.y);

    // tolerance-finish candidate (used only if no analytic shot ever succeeds)
    const dth2 = Math.abs(wrapAngle(goal.theta - node.theta));
    if (dist < 0.35 && dth2 < (12 * Math.PI) / 180 && dist + 2 * dth2 < tolScore) {
      tolNode = node;
      tolScore = dist + 2 * dth2;
    }

    // Analytic expansion: try to finish with a Reeds-Shepp word.
    const tryShot = dist < 5.0 ? expanded % 3 === 0 : expanded % 60 === 0;
    if (tryShot) {
      rsShot = reedsSheppConnection(
        { x: node.x, y: node.y, theta: node.theta }, goal,
        VEHICLE.maxCurvature, VEHICLE.maxSteer, world, 5, 0.25
      );
      if (rsShot) {
        winner = node;
        break;
      }
    }

    const prevSeg = node.seg;
    for (const sMul of STEERS) {
      const steer = sMul * VEHICLE.maxSteer;
      for (const dir of [1, -1]) {
        if (prevSeg && prevSeg.dir === -dir && Math.abs(prevSeg.steer - steer) < 1e-9) {
          // exact inverse of the last primitive — pointless
          continue;
        }
        // integrate the arc
        let nx, ny, nth;
        if (Math.abs(steer) < 1e-9) {
          nx = node.x + dir * STEP * Math.cos(node.theta);
          ny = node.y + dir * STEP * Math.sin(node.theta);
          nth = node.theta;
        } else {
          const R = VEHICLE.wheelBase / Math.tan(steer);
          const dth = (dir * STEP) / R;
          const th2 = node.theta + dth;
          nx = node.x + R * (Math.sin(th2) - Math.sin(node.theta));
          ny = node.y - R * (Math.cos(th2) - Math.cos(node.theta));
          nth = wrapAngle(th2);
        }
        const nkey = cellKey(nx, ny, nth);
        if (closed.has(nkey)) continue;
        if (world.segmentCollides(node.x, node.y, node.theta, steer, dir, STEP, 0.2)) continue;

        let cost = STEP;
        if (!prevSeg || prevSeg.dir !== dir) cost += SWITCH_PENALTY;
        if (dir < 0) cost += REVERSE_PENALTY * STEP;
        if (Math.abs(sMul) === 1) cost += STEER_PENALTY;

        const h = Math.max(
          Math.hypot(goal.x - nx, goal.y - ny),
          rsLengthNoObstacles({ x: nx, y: ny, theta: nth }, goal)
        );
        const seg = { x0: node.x, y0: node.y, th0: node.theta, steer, dir, length: STEP };
        pushNode(nx, ny, nth, node.g + cost, h, node, seg);
      }
    }
  }

  res.nodesExpanded = expanded;

  if (winner && rsShot) {
    // stitch: tree segments up to `winner` + the analytic RS shot
    const segs = [];
    let n = winner;
    while (n && n.seg) { segs.push(n.seg); n = n.parent; }
    segs.reverse();
    segs.push(...rsShot.segments);
    res.success = true;
    res.segments = segs;
    finalize(res, goal, t0, expanded);
    return res;
  }

  if (!winner && tolNode) {
    const segs = [];
    let n = tolNode;
    while (n && n.seg) { segs.push(n.seg); n = n.parent; }
    segs.reverse();
    res.success = true;
    res.segments = segs;
    finalize(res, goal, t0, expanded);
    return res;
  }

  res.planningTimeMs = performance.now() - t0;
  return res; // failure
}

function finalize(res, goal, t0, expanded) {
  res.planningTimeMs = performance.now() - t0;
  res.poses = sampleSegments(res.segments, 0.1);
  res.pathLength = segmentsLength(res.segments);
  res.reversals = countReversals(res.segments);
  const end = res.poses[res.poses.length - 1];
  res.finalPose = end;
  res.posErrorM = Math.hypot(end.x - goal.x, end.y - goal.y);
  res.headErrorDeg = (Math.abs(wrapAngle(end.theta - goal.theta)) * 180) / Math.PI;
}
