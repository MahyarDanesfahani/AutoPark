/**
 * collision.js — OBB (oriented bounding box) collision tests via SAT.
 * Obstacles are given as body-center rectangles {x, y, halfL, halfW, theta}.
 * The ego car pose is the rear-axle pose; its body rectangle is derived
 * from VEHICLE dimensions plus a safety margin.
 */

import { VEHICLE } from './vehicle.js';

export function obbCorners(ob, grow = 0) {
  const c = Math.cos(ob.theta), s = Math.sin(ob.theta);
  const hl = ob.halfL + grow, hw = ob.halfW + grow;
  return [
    [ob.x + c * hl - s * hw, ob.y + s * hl + c * hw],
    [ob.x + c * hl + s * hw, ob.y + s * hl - c * hw],
    [ob.x - c * hl + s * hw, ob.y - s * hl - c * hw],
    [ob.x - c * hl - s * hw, ob.y - s * hl + c * hw],
  ];
}

function axisOverlap(cA, cB, ax, ay) {
  let minA = Infinity, maxA = -Infinity, minB = Infinity, maxB = -Infinity;
  for (const [x, y] of cA) {
    const p = x * ax + y * ay;
    if (p < minA) minA = p; if (p > maxA) maxA = p;
  }
  for (const [x, y] of cB) {
    const p = x * ax + y * ay;
    if (p < minB) minB = p; if (p > maxB) maxB = p;
  }
  return maxA >= minB && maxB >= minA;
}

export function obbOverlap(a, b) {
  const ca = obbCorners(a);
  const cb = obbCorners(b);
  for (const ob of [a, b]) {
    const c = Math.cos(ob.theta), s = Math.sin(ob.theta);
    // axes = normals of both local axes (SAT needs both rectangles' axes)
    if (!axisOverlap(ca, cb, c, s)) return false;
    if (!axisOverlap(ca, cb, -s, c)) return false;
  }
  return true;
}

export class World {
  /**
   * @param {Object} cfg
   * @param {Array}  cfg.obstacles rectangles {x,y,halfL,halfW,theta}
   * @param {Object} cfg.bounds    {minX,maxX,minY,maxY} drivable area
   */
  constructor(cfg) {
    this.obstacles = cfg.obstacles;
    this.bounds = cfg.bounds;
    this._egoOBB = { x: 0, y: 0, halfL: 0, halfW: 0, theta: 0 };
  }

  /** Ego body OBB for a rear-axle pose. */
  egoOBB(pose, grow = 0) {
    const o = this._egoOBB;
    o.x = pose.x + Math.cos(pose.theta) * VEHICLE.bodyCenterOffset;
    o.y = pose.y + Math.sin(pose.theta) * VEHICLE.bodyCenterOffset;
    o.theta = pose.theta;
    o.halfL = VEHICLE.length / 2 + grow;
    o.halfW = VEHICLE.width / 2 + grow;
    return o;
  }

  poseCollides(pose, grow = VEHICLE.safetyMargin) {
    const obb = this.egoOBB(pose, grow);
    const b = this.bounds;
    const m = grow;
    for (const [x, y] of obbCorners(obb, 0)) {
      if (x < b.minX + m || x > b.maxX - m || y < b.minY + m || y > b.maxY - m) return true;
    }
    for (const obst of this.obstacles) {
      if (obbOverlap(obb, obst)) return true;
    }
    return false;
  }

  /** Check a whole motion segment (arc) by sampling sub-poses. */
  segmentCollides(x0, y0, th0, steer, dir, length, ds = 0.2) {
    let p = { x: x0, y: y0, theta: th0 };
    if (this.poseCollides(p)) return true;
    const n = Math.max(1, Math.ceil(length / ds));
    const step = length / n;
    for (let i = 0; i < n; i++) {
      // inline arc step to avoid object churn
      if (Math.abs(steer) < 1e-9) {
        p = { x: p.x + step * dir * Math.cos(p.theta), y: p.y + step * dir * Math.sin(p.theta), theta: p.theta };
      } else {
        const R = VEHICLE.wheelBase / Math.tan(steer);
        const dth = (step * dir) / R;
        const th2 = p.theta + dth;
        p = { x: p.x + R * (Math.sin(th2) - Math.sin(p.theta)), y: p.y - R * (Math.cos(th2) - Math.cos(p.theta)), theta: th2 };
      }
      if (this.poseCollides(p)) return true;
    }
    return false;
  }
}
