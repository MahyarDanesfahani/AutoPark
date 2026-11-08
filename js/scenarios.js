/**
 * scenarios.js — Parking scenarios. Each scenario returns a full world
 * description: obstacle rectangles (body-center), drivable bounds, the
 * target slot pose, and the ego start pose. The difficulty slider shrinks
 * the gap between the obstacle cars.
 *
 * All poses follow the vehicle convention: rear-axle center, theta from +X.
 * Slot poses are given as (slotX, slotY, slotTheta) for the REAR AXLE of a
 * perfectly parked car: for parallel parking the car ends up centered in
 * the slot; for perpendicular/angled, the car backs into the slot until the
 * rear bumper almost touches the curb.
 */

import { VEHICLE } from './vehicle.js';

const L = VEHICLE.length;
const W = VEHICLE.width;

function rect(x, y, halfL, halfW, theta = 0) {
  return { x, y, halfL, halfW, theta };
}

/** Slot dimensions as a function of difficulty t in [0,1] (0 = easy). */
function slotLengths(base, t) {
  // Plan spec: slot shrinks from ~1.4x car length down to 1.2x — anything
  // tighter than 1.2x is beyond every planner's exact-pose finish.
  const min = L * 1.2;
  return base - t * (base - min);
}

/**
 * Build a scenario.
 * @param {string} type 'parallel' | 'perpendicular' | 'angled'
 * @param {number} difficulty 0..1
 */
export function buildScenario(type, difficulty = 0.3) {
  switch (type) {
    case 'parallel': return parallel(difficulty);
    case 'perpendicular': return perpendicular(difficulty);
    case 'angled': return angled(difficulty);
    default: throw new Error('unknown scenario ' + type);
  }
}

// ---------------------------------------------------------------- parallel
// Road along X. Parking lane at the top (y > 0), driving lane below.
// Curb wall at y = LANE_TOP. Cars parked along the lane; one gap is free.
function parallel(difficulty) {
  const slotLen = slotLengths(6.4, difficulty);
  const slotW = 2.35;
  const laneY = slotW / 2 + 0.15;         // center of parking lane (slot center y)
  const curbY = slotW + 0.15;             // curb face
  const gapX = 12;                        // center X of the free slot

  const obstacles = [
    // curb as a long thin wall
    rect(0, curbY + 0.15, 40, 0.15, 0),
    // parked cars: before and after the gap
    rect(gapX - slotLen / 2 - L / 2, laneY, L / 2, W / 2, 0),
    rect(gapX + slotLen / 2 + L / 2, laneY, L / 2, W / 2, 0),
    // far parked cars for realism
    rect(gapX - slotLen / 2 - L / 2 - (L + 0.6), laneY, L / 2, W / 2, 0),
    rect(gapX + slotLen / 2 + L / 2 + (L + 0.6), laneY, L / 2, W / 2, 0),
  ];

  const bounds = { minX: -6, maxX: 26, minY: -5.5, maxY: curbY };

  // Goal: car centered in the slot, aligned with the road.
  // Rear axle = slot center - bodyCenterOffset * heading direction.
  const goal = {
    x: gapX - VEHICLE.bodyCenterOffset,
    y: laneY,
    theta: 0,
  };
  // Start: behind the slot in the driving lane, driving forward (+X) so the
  // natural manoeuvre is: pull up alongside the gap, then reverse in.
  const start = { x: gapX - slotLen / 2 - 3.5, y: laneY - slotW - 1.1, theta: 0 };

  return {
    type: 'parallel',
    slot: { x: gapX, y: laneY, theta: 0, len: slotLen, wid: slotW },
    start, goal,
    obstacles,
    bounds,
    camera: { pos: [gapX + 2, -18, 15], target: [gapX, 0, 0] },
    worldSize: 40,
  };
}

// ----------------------------------------------------------- perpendicular
// Parking aisle along X at y=0; slots in a row above it (nose-in / back-in).
function perpendicular(difficulty) {
  const slotW = 2.5;                    // slot width (side by side)
  const slotDepth = 5.0;               // slot depth (into the parking bay)
  // Difficulty tightens the neighbour pitch and narrows the aisle.
  const pitch = slotW + 0.25 - difficulty * 0.35;
  const aisleW = 6.5 - difficulty * 1.2;
  const gapX = 8;                       // X of the free slot center
  const slotCenterY = slotDepth / 2 + 0.2;
  const backWallY = slotDepth + 0.4;

  const obstacles = [
    rect(0, backWallY + 0.15, 30, 0.15, 0),               // back wall
    rect(gapX - pitch, slotCenterY, L / 2, W / 2, Math.PI / 2), // left neighbour
    rect(gapX + pitch, slotCenterY, L / 2, W / 2, Math.PI / 2), // right neighbour
    rect(gapX - 2 * pitch, slotCenterY, L / 2, W / 2, Math.PI / 2),
    rect(gapX + 2 * pitch, slotCenterY, L / 2, W / 2, Math.PI / 2),
  ];

  const bounds = { minX: -8, maxX: 24, minY: -aisleW, maxY: backWallY };

  // Goal: backed into the slot, nose out toward the aisle (+Y),
  // body centered in the slot.
  const goal = {
    x: gapX,
    y: slotCenterY - VEHICLE.bodyCenterOffset,
    theta: Math.PI / 2,
  };
  const start = { x: gapX + 4, y: -(aisleW / 2), theta: Math.PI };

  return {
    type: 'perpendicular',
    slot: { x: gapX, y: slotCenterY, theta: Math.PI / 2, len: slotDepth, wid: slotW },
    start, goal,
    obstacles,
    bounds,
    camera: { pos: [gapX + 3, -17, 14], target: [gapX, 1, 0] },
    worldSize: 40,
  };
}

// ------------------------------------------------------------------ angled
// 45-degree angled slots along a one-way aisle. Slot axis at 45 deg.
function angled(difficulty) {
  const ang = Math.PI / 4;
  const slotW = 2.5;
  const slotDepth = 5.2;
  // Difficulty tightens the neighbour pitch and narrows the aisle.
  const pitch = slotW / Math.sin(ang) + 0.1 - difficulty * 0.35;
  const aisleW = 6.5 - difficulty * 1.2;
  const gapX = 8;
  const slotCenterY = slotDepth / 2 * Math.cos(ang) + 0.2;
  const backWallY = slotDepth + 0.4;

  const obstacles = [
    rect(0, backWallY + 0.15, 30, 0.15, 0),               // back wall
    rect(gapX - pitch, slotCenterY, L / 2, W / 2, ang),   // neighbours, aligned 45
    rect(gapX + pitch, slotCenterY, L / 2, W / 2, ang),
    rect(gapX - 2 * pitch, slotCenterY, L / 2, W / 2, ang),
    rect(gapX + 2 * pitch, slotCenterY, L / 2, W / 2, ang),
  ];

  const bounds = { minX: -8, maxX: 26, minY: -aisleW, maxY: backWallY };

  // Goal: backed into the angled slot, nose pointing out toward the aisle.
  // Slot axis direction (into the wall): u = (cos ang, sin ang).
  const ux = Math.cos(ang), uy = Math.sin(ang);
  const hd = Math.PI + ang; // heading when parked (nose out)
  const goal = {
    x: gapX - VEHICLE.bodyCenterOffset * Math.cos(hd),
    y: slotCenterY - VEHICLE.bodyCenterOffset * Math.sin(hd),
    theta: hd,
  };

  const start = { x: gapX + 5, y: -(aisleW / 2), theta: Math.PI };

  return {
    type: 'angled',
    slot: { x: gapX, y: slotCenterY, theta: ang, len: slotDepth, wid: slotW },
    start, goal,
    obstacles,
    bounds,
    camera: { pos: [gapX + 3, -17, 14], target: [gapX, 1, 0] },
    worldSize: 40,
  };
}

export const SCENARIO_TYPES = ['parallel', 'perpendicular', 'angled'];
