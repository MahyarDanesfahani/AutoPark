/**
 * plannerCommon.js — shared pieces for the three planners: a binary heap,
 * the common result format, and the steering primitive sets.
 */

export class MinHeap {
  constructor() {
    this.keys = [];
    this.vals = [];
  }
  get size() { return this.keys.length; }
  push(key, val) {
    const k = this.keys, v = this.vals;
    let i = k.length;
    k.push(key); v.push(val);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (k[p] <= k[i]) break;
      [k[p], k[i]] = [k[i], k[p]];
      [v[p], v[i]] = [v[i], v[p]];
      i = p;
    }
  }
  pop() {
    const k = this.keys, v = this.vals;
    if (k.length === 0) return null;
    const top = v[0];
    const lastK = k.pop(), lastV = v.pop();
    if (k.length > 0) {
      k[0] = lastK; v[0] = lastV;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < k.length && k[l] < k[m]) m = l;
        if (r < k.length && k[r] < k[m]) m = r;
        if (m === i) break;
        [k[m], k[i]] = [k[i], k[m]];
        [v[m], v[i]] = [v[i], v[m]];
        i = m;
      }
    }
    return top;
  }
}

/**
 * Steering primitives shared by the planners ( fairness: same set).
 * Each primitive: constant steer for `step` meters, forward or reverse.
 */
export function makePrimitives(steers, dirs, step) {
  const list = [];
  for (const dir of dirs) for (const steer of steers) {
    list.push({ steer, dir, step });
  }
  return list;
}

export const PRIMITIVE_STEERS_FULL = [-1, -0.5, 0, 0.5, 1]; // × maxSteer
export const PRIMITIVE_STEERS_LATTICE = [-1, 0, 1];

export function emptyResult(name) {
  return {
    algorithm: name,
    success: false,
    segments: [],          // motion segments (drivable)
    visited: [],           // [x, y, theta] expanded states for 3D viz
    planningTimeMs: 0,
    nodesExpanded: 0,
    pathLength: 0,
    reversals: 0,
    finalPose: null,
    posErrorM: null,
    headErrorDeg: null,
    collisionCount: 0,
  };
}
