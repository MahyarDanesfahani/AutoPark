/**
 * reedsShepp.js — Reeds-Shepp curves (shortest path for a car that steers
 * and reverses). Faithful port of PythonRobotics' implementation
 * (Atsushi Sakai / Videh Patel), which follows Reeds & Shepp (1990) /
 * LaValle's formulas.
 *
 * Conventions here:
 *  - Word lengths are curvature-scaled (radians); multiply by 1/maxCurvature
 *    to obtain meters.
 *  - Geometric integration is done with the same exact-arc stepper as the
 *    rest of the app (vehicle.stepArc), so RS paths, collision checks and
 *    animation are all consistent.
 */

const EPS = 1e-9;

/** C++ fmod semantics, then wrap into [-pi, pi]. Do not "simplify" this. */
function mod2pi(x) {
  const twoPi = 2 * Math.PI;
  let v = x % (x >= 0 ? twoPi : -twoPi);
  if (v < -Math.PI) v += twoPi;
  else if (v > Math.PI) v -= twoPi;
  return v;
}

function polar(x, y) {
  return [Math.hypot(x, y), Math.atan2(y, x)];
}

function timeflip(l) { return l.map(v => -v); }

function reflect(ctypes) {
  return ctypes.map(c => (c === 'L' ? 'R' : c === 'R' ? 'L' : 'S'));
}

// ---------------- the 12 base words ----------------
// Each returns [ok, lengths(radians), ctypes]. Ported 1:1 from the reference.

function left_straight_left(x, y, phi) {
  const [u, t] = polar(x - Math.sin(phi), y - 1.0 + Math.cos(phi));
  if (0.0 <= t && t <= Math.PI) {
    const v = mod2pi(phi - t);
    if (0.0 <= v && v <= Math.PI) return [true, [t, u, v], ['L', 'S', 'L']];
  }
  return [false, [], []];
}

function left_straight_right(x, y, phi) {
  const [u1r, t1] = polar(x + Math.sin(phi), y - 1.0 - Math.cos(phi));
  const u1 = u1r * u1r;
  if (u1 >= 4.0) {
    const u = Math.sqrt(u1 - 4.0);
    const theta = Math.atan2(2.0, u);
    const t = mod2pi(t1 + theta);
    const v = mod2pi(t - phi);
    if (t >= 0.0 && v >= 0.0) return [true, [t, u, v], ['L', 'S', 'R']];
  }
  return [false, [], []];
}

function left_x_right_x_left(x, y, phi) {
  const zeta = x - Math.sin(phi), eeta = y - 1 + Math.cos(phi);
  const [u1, theta] = polar(zeta, eeta);
  if (u1 <= 4.0) {
    const A = Math.acos(0.25 * u1);
    const t = mod2pi(A + theta + Math.PI / 2);
    const u = mod2pi(Math.PI - 2 * A);
    const v = mod2pi(phi - t - u);
    return [true, [t, -u, v], ['L', 'R', 'L']];
  }
  return [false, [], []];
}

function left_x_right_left(x, y, phi) {
  const zeta = x - Math.sin(phi), eeta = y - 1 + Math.cos(phi);
  const [u1, theta] = polar(zeta, eeta);
  if (u1 <= 4.0) {
    const A = Math.acos(0.25 * u1);
    const t = mod2pi(A + theta + Math.PI / 2);
    const u = mod2pi(Math.PI - 2 * A);
    const v = mod2pi(-phi + t + u);
    return [true, [t, -u, -v], ['L', 'R', 'L']];
  }
  return [false, [], []];
}

function left_right_x_left(x, y, phi) {
  const zeta = x - Math.sin(phi), eeta = y - 1 + Math.cos(phi);
  const [u1, theta] = polar(zeta, eeta);
  if (u1 <= 4.0) {
    const u = Math.acos(1 - u1 * u1 * 0.125);
    const A = Math.asin(2 * Math.sin(u) / u1);
    const t = mod2pi(-A + theta + Math.PI / 2);
    const v = mod2pi(t - u - phi);
    return [true, [t, u, -v], ['L', 'R', 'L']];
  }
  return [false, [], []];
}

function left_right_x_left_right(x, y, phi) {
  const zeta = x + Math.sin(phi), eeta = y - 1 - Math.cos(phi);
  const [u1, theta] = polar(zeta, eeta);
  if (u1 <= 2) {
    const A = Math.acos((u1 + 2) * 0.25);
    const t = mod2pi(theta + A + Math.PI / 2);
    const u = mod2pi(A);
    const v = mod2pi(phi - t + 2 * u);
    if (t >= 0 && u >= 0 && v >= 0) return [true, [t, u, -u, -v], ['L', 'R', 'L', 'R']];
  }
  return [false, [], []];
}

function left_x_right_left_x_right(x, y, phi) {
  const zeta = x + Math.sin(phi), eeta = y - 1 - Math.cos(phi);
  const [u1, theta] = polar(zeta, eeta);
  const u2 = (20 - u1 * u1) / 16;
  if (0 <= u2 && u2 <= 1) {
    const u = Math.acos(u2);
    const A = Math.asin(2 * Math.sin(u) / u1);
    const t = mod2pi(theta + A + Math.PI / 2);
    const v = mod2pi(t - phi);
    if (t >= 0 && v >= 0) return [true, [t, -u, -u, v], ['L', 'R', 'L', 'R']];
  }
  return [false, [], []];
}

function left_x_right90_straight_left(x, y, phi) {
  const zeta = x - Math.sin(phi), eeta = y - 1 + Math.cos(phi);
  const [u1, theta] = polar(zeta, eeta);
  if (u1 >= 2.0) {
    const u = Math.sqrt(u1 * u1 - 4) - 2;
    const A = Math.atan2(2, Math.sqrt(u1 * u1 - 4));
    const t = mod2pi(theta + A + Math.PI / 2);
    const v = mod2pi(t - phi + Math.PI / 2);
    if (t >= 0 && v >= 0) return [true, [t, -Math.PI / 2, -u, -v], ['L', 'R', 'S', 'L']];
  }
  return [false, [], []];
}

function left_straight_right90_x_left(x, y, phi) {
  const zeta = x - Math.sin(phi), eeta = y - 1 + Math.cos(phi);
  const [u1, theta] = polar(zeta, eeta);
  if (u1 >= 2.0) {
    const u = Math.sqrt(u1 * u1 - 4) - 2;
    const A = Math.atan2(Math.sqrt(u1 * u1 - 4), 2);
    const t = mod2pi(theta - A + Math.PI / 2);
    const v = mod2pi(t - phi - Math.PI / 2);
    if (t >= 0 && v >= 0) return [true, [t, u, Math.PI / 2, -v], ['L', 'S', 'R', 'L']];
  }
  return [false, [], []];
}

function left_x_right90_straight_right(x, y, phi) {
  const zeta = x + Math.sin(phi), eeta = y - 1 - Math.cos(phi);
  const [u1, theta] = polar(zeta, eeta);
  if (u1 >= 2.0) {
    const t = mod2pi(theta + Math.PI / 2);
    const u = u1 - 2;
    const v = mod2pi(phi - t - Math.PI / 2);
    if (t >= 0 && v >= 0) return [true, [t, -Math.PI / 2, -u, -v], ['L', 'R', 'S', 'R']];
  }
  return [false, [], []];
}

function left_straight_left90_x_right(x, y, phi) {
  const zeta = x + Math.sin(phi), eeta = y - 1 - Math.cos(phi);
  const [u1, theta] = polar(zeta, eeta);
  if (u1 >= 2.0) {
    const t = mod2pi(theta);
    const u = u1 - 2;
    const v = mod2pi(phi - t - Math.PI / 2);
    if (t >= 0 && v >= 0) return [true, [t, u, Math.PI / 2, -v], ['L', 'S', 'L', 'R']];
  }
  return [false, [], []];
}

function left_x_right90_straight_left90_x_right(x, y, phi) {
  const zeta = x + Math.sin(phi), eeta = y - 1 - Math.cos(phi);
  const [u1, theta] = polar(zeta, eeta);
  if (u1 >= 4.0) {
    const u = Math.sqrt(u1 * u1 - 4) - 4;
    const A = Math.atan2(2, Math.sqrt(u1 * u1 - 4));
    const t = mod2pi(theta + A + Math.PI / 2);
    const v = mod2pi(t - phi);
    if (t >= 0 && v >= 0) return [true, [t, -Math.PI / 2, -u, -Math.PI / 2, v], ['L', 'R', 'S', 'L', 'R']];
  }
  return [false, [], []];
}

const PATH_FUNCS = [
  left_straight_left, left_straight_right,                                  // CSC
  left_x_right_x_left, left_x_right_left, left_right_x_left,                // CCC
  left_right_x_left_right, left_x_right_left_x_right,                       // CCCC
  left_x_right90_straight_left, left_x_right90_straight_right,              // CCSC
  left_straight_right90_x_left, left_straight_left90_x_right,               // CSCC
  left_x_right90_straight_left90_x_right,                                   // CCSCC
];

function setPath(paths, lengths, ctypes, stepSize) {
  const L = lengths.reduce((a, b) => a + Math.abs(b), 0);
  for (const p of paths) {
    const sameType = p.ctypes.length === ctypes.length && p.ctypes.every((c, i) => c === ctypes[i]);
    if (sameType && Math.abs(p.L - L) <= stepSize) return paths; // duplicate
  }
  if (L <= stepSize) return paths; // too short to be valid here
  paths.push({ ctypes: [...ctypes], lengths: [...lengths], L });
  return paths;
}

/**
 * All candidate words between two poses (unsorted).
 * Lengths are in radians (curvature-scaled).
 */
export function reedsSheppWords(start, goal, maxCurvature, stepSizeRad = 0.02) {
  const dx = goal.x - start.x, dy = goal.y - start.y;
  const dth = goal.theta - start.theta;
  const c = Math.cos(start.theta), s = Math.sin(start.theta);
  const x = (c * dx + s * dy) * maxCurvature;
  const y = (-s * dx + c * dy) * maxCurvature;

  const paths = [];
  for (const fn of PATH_FUNCS) {
    const variants = [
      { x, y, dth, tf: false, rf: false },
      { x: -x, y, dth: -dth, tf: true, rf: false },
      { x, y: -y, dth: -dth, tf: false, rf: true },
      { x: -x, y: -y, dth, tf: true, rf: true },
    ];
    for (const v of variants) {
      let [flag, lengths, ctypes] = fn(v.x, v.y, v.dth);
      if (!flag) continue;
      // reject paths with degenerate sub-step segments (reference behaviour)
      const sumAbs = lengths.reduce((a, b) => a + Math.abs(b), 0);
      let degenerate = false;
      for (const d of lengths) {
        if (0.1 * sumAbs < Math.abs(d) && Math.abs(d) < stepSizeRad) degenerate = true;
      }
      if (degenerate) continue;
      if (v.tf) lengths = timeflip(lengths);
      if (v.rf) ctypes = reflect(ctypes);
      setPath(paths, lengths, ctypes, stepSizeRad);
    }
  }
  paths.sort((a, b) => a.L - b.L);
  return paths;
}

/** Convert a word into our motion-segment format, in world meters. */
export function wordToSegments(word, start, maxCurvature, maxSteer) {
  const segs = [];
  let p = { ...start };
  for (let i = 0; i < word.ctypes.length; i++) {
    const t = word.ctypes[i];
    const steer = t === 'L' ? maxSteer : t === 'R' ? -maxSteer : 0;
    const lenRad = word.lengths[i];
    const dir = lenRad >= 0 ? 1 : -1;
    const lenM = Math.abs(lenRad) / maxCurvature;
    if (lenM < EPS) continue;
    segs.push({ x0: p.x, y0: p.y, th0: p.theta, steer, dir, length: lenM });
    // advance pose to the start of the next segment
    if (Math.abs(steer) < 1e-9) {
      p = { x: p.x + lenM * dir * Math.cos(p.theta), y: p.y + lenM * dir * Math.sin(p.theta), theta: p.theta };
    } else {
      const R = 1 / maxCurvature * Math.sign(steer); // signed radius: L>0, R<0
      const dth = (lenM * dir) / R;
      const th2 = p.theta + dth;
      p = { x: p.x + R * (Math.sin(th2) - Math.sin(p.theta)), y: p.y - R * (Math.cos(th2) - Math.cos(p.theta)), theta: th2 };
    }
  }
  return segs;
}

/**
 * Shortest collision-free Reeds-Shepp connection (used by the analytic
 * expansion of Hybrid A*). Tries words in ascending length order.
 * Returns { segments, length } or null.
 */
export function reedsSheppConnection(start, goal, maxCurvature, maxSteer, world, tryWords = 6, sampleStep = 0.25) {
  const words = reedsSheppWords(start, goal, maxCurvature);
  const n = Math.min(tryWords, words.length);
  for (let i = 0; i < n; i++) {
    const segs = wordToSegments(words[i], start, maxCurvature, maxSteer);
    let free = true;
    for (const s of segs) {
      if (world.segmentCollides(s.x0, s.y0, s.th0, s.steer, s.dir, s.length, sampleStep)) { free = false; break; }
    }
    if (free) return { segments: segs, length: words[i].L / maxCurvature };
  }
  return null;
}
