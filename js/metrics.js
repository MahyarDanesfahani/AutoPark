/**
 * metrics.js — run the selected planner(s) on a scenario and aggregate
 * the numbers shown in the comparison table / chart.
 */

import { planHybridAStar } from './algorithms/hybridAstar.js';
import { planAStar } from './algorithms/astar.js';
import { planRRT } from './algorithms/rrt.js';

const RUNNERS = {
  'hybrid-astar': planHybridAStar,
  'astar': planAStar,
  'rrt': planRRT,
};
export const ALGO_ORDER = ['hybrid-astar', 'astar', 'rrt'];

/**
 * Run the selected algorithm(s). Returns an array of result objects
 * (one per algorithm). RRT is run `rrtRuns` times with different seeds
 * and averaged — planning is stochastic, a single run proves little.
 */
export async function runSelected(algo, scenario, world, rrtRuns = 3, onProgress = () => {}) {
  if (algo === 'all') {
    onProgress('hybrid-astar'); await new Promise(requestAnimationFrame);
    const h = planHybridAStar(scenario, world);
    onProgress('astar'); await new Promise(requestAnimationFrame);
    const a = planAStar(scenario, world);
    onProgress('rrt'); await new Promise(requestAnimationFrame);
    const r = runRRTMultiple(scenario, world, rrtRuns);
    return [h, a, r];
  }
  onProgress(algo); await new Promise(requestAnimationFrame);
  if (algo === 'rrt') return [runRRTMultiple(scenario, world, rrtRuns)];
  return [RUNNERS[algo](scenario, world)];
}

function runRRTMultiple(scenario, world, n) {
  const runs = [];
  for (let seed = 1; seed <= n; seed++) {
    runs.push(planRRT(scenario, world, { seed }));
  }
  const ok = runs.filter(r => r.success);
  const mean = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
  // keep a successful run's segments/poses for animation; else the last attempt's tree for viz
  const keeper = ok[0] ?? runs[runs.length - 1];
  // Time and search effort must include failed attempts; otherwise RRT looks
  // better than it is when some seeds time out.
  const totalTime = mean(runs.map(r => r.planningTimeMs));
  const meanNodes = mean(runs.map(r => r.nodesExpanded));
  return {
    ...keeper,
    planningTimeMs: totalTime,
    pathLength: mean(ok.map(r => r.pathLength)),
    reversals: ok.length ? Math.round(mean(ok.map(r => r.reversals))) : 0,
    posErrorM: ok.length ? mean(ok.map(r => r.posErrorM)) : null,
    headErrorDeg: ok.length ? mean(ok.map(r => r.headErrorDeg)) : null,
    nodesExpanded: Math.round(meanNodes),
    runs: { ok: ok.length, n: runs.length, successRate: ok.length / runs.length },
  };
}

/** Per-column best (minimum) among successful results. Returns a Set of algorithm names per column. */
export function bestOf(results) {
  const cols = ['planningTimeMs', 'pathLength', 'reversals', 'posErrorM', 'headErrorDeg'];
  const best = {};
  for (const col of cols) {
    let winner = null, val = Infinity;
    for (const r of results) {
      if (!r.success || r[col] == null) continue;
      if (r[col] < val) { val = r[col]; winner = r.algorithm; }
    }
    best[col] = winner;
  }
  return best;
}
