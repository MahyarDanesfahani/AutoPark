/**
 * vehicle.js — Kinematic bicycle model shared by every planner so the
 * comparison between algorithms stays fair.
 *
 * Pose convention: (x, y, theta) is the REAR-AXLE center; theta = heading
 * measured from +X toward +Y (mathematical, top view).
 */

export const VEHICLE = {
  length: 4.5,       // m, bumper to bumper
  width: 1.8,        // m
  wheelBase: 2.7,    // m, rear axle -> front axle
  rearOverhang: 0.8, // m, rear axle -> rear bumper
  maxSteer: 0.55,    // rad (~31.5 deg)
  safetyMargin: 0.03,// m, inflation used in collision checks
};
VEHICLE.maxCurvature = Math.tan(VEHICLE.maxSteer) / VEHICLE.wheelBase;
VEHICLE.minTurnRadius = 1 / VEHICLE.maxCurvature;
// Distance from rear axle to the geometric center of the body, along heading.
VEHICLE.bodyCenterOffset =
  (VEHICLE.wheelBase + (VEHICLE.length - VEHICLE.rearOverhang - VEHICLE.wheelBase) - VEHICLE.rearOverhang) / 2;

export function wrapAngle(a) {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

/** Exact arc integration of the bicycle model. `dist` is signed (+forward). */
export function stepArc(pose, steer, dist) {
  if (Math.abs(steer) < 1e-9) {
    return {
      x: pose.x + dist * Math.cos(pose.theta),
      y: pose.y + dist * Math.sin(pose.theta),
      theta: pose.theta,
    };
  }
  const R = VEHICLE.wheelBase / Math.tan(steer); // signed radius
  const dth = dist / R;
  const th2 = pose.theta + dth;
  return {
    x: pose.x + R * (Math.sin(th2) - Math.sin(pose.theta)),
    y: pose.y - R * (Math.cos(th2) - Math.cos(pose.theta)),
    theta: wrapAngle(th2),
  };
}

/** A drivable motion segment: constant steering angle, constant direction. */
export function makeSegment(x0, y0, th0, steer, dir, length) {
  return { x0, y0, th0, steer, dir, length };
}

/**
 * Sample a list of segments into a fine trajectory of poses.
 * Output poses carry cumulative arc length `s`, steering `steer` and
 * direction `dir` (+1 forward / -1 reverse) for animation and metrics.
 */
export function sampleSegments(segments, ds = 0.1) {
  const poses = [];
  let s = 0;
  let cur = null;
  for (const seg of segments) {
    if (!cur) {
      cur = { x: seg.x0, y: seg.y0, theta: seg.th0 };
      poses.push({ ...cur, steer: seg.steer, dir: seg.dir, s: 0 });
    } else {
      poses.push({ ...cur, steer: seg.steer, dir: seg.dir, s });
    }
    const n = Math.max(1, Math.ceil(seg.length / ds));
    const step = seg.length / n;
    let p = { ...cur };
    for (let i = 0; i < n; i++) {
      p = stepArc(p, seg.steer, step * seg.dir);
      s += step;
      poses.push({ ...p, steer: seg.steer, dir: seg.dir, s });
    }
    cur = p;
  }
  return poses;
}

export function segmentsLength(segments) {
  let L = 0;
  for (const s of segments) L += s.length;
  return L;
}

export function countReversals(segments) {
  let rev = 0;
  let prev = 0;
  for (const s of segments) {
    if (prev !== 0 && s.dir !== prev) rev++;
    prev = s.dir;
  }
  return rev;
}

/** Euclidean distance between poses + absolute heading difference (rad). */
export function poseError(p, g) {
  const d = Math.hypot(p.x - g.x, p.y - g.y);
  const h = Math.abs(wrapAngle(p.theta - g.theta));
  return { dist: d, heading: h };
}
