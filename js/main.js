/**
 * main.js — app entry point: wires the UI controls, the planners and the
 * 3D scene together.
 */

import { buildScenario } from './scenarios.js';
import { World } from './collision.js';
import { runSelected } from './metrics.js';
import { Scene3D } from './scene3d.js';
import { UI } from './ui.js';
import { t, apply, setLang, getLang } from './i18n.js';

const $ = id => document.getElementById(id);

const state = {
  type: 'parallel',
  difficulty: 0.3,
  algo: 'hybrid-astar',
  rrtRuns: 3,
  startMode: 'default',
  scenario: null,
  world: null,
  results: [],
  selected: null,
  history: [],
};

const scene = new Scene3D($('canvas-wrap'));
const ui = new UI();

// ---------------------------------------------------------------- scenario

function rebuild() {
  state.scenario = buildScenario(state.type, state.difficulty);
  state.world = new World({ obstacles: state.scenario.obstacles, bounds: state.scenario.bounds });
  // start-position presets: shift the default start along its heading
  const sc = state.scenario;
  if (state.startMode !== 'default') {
    // The default start faces toward the slot, so positive distance along the
    // heading is closer and negative distance is farther away.
    const d = state.startMode === 'near' ? 2.5 : -2.5;
    const p = {
      x: sc.start.x + Math.cos(sc.start.theta) * d,
      y: sc.start.y + Math.sin(sc.start.theta) * d,
      theta: sc.start.theta,
    };
    if (!state.world.poseCollides(p, 0.1)) sc.start = p;
  }
  state.results = [];
  state.selected = null;
  scene.buildWorld(sc);
  $('btn-play').disabled = true;
  ui.setStatus(t('noResults'));
  ui.showResults([], null);
}

// ---------------------------------------------------------------- planning

async function plan() {
  ui.setStatus(t('planning'), 'busy');
  // let the status paint before the (synchronous) search blocks the thread
  setTimeout(async () => {
    let results;
    try {
      results = await runSelected(state.algo, state.scenario, state.world, state.rrtRuns,
        name => ui.setStatus(t('planningAlgo', { algo: name }), 'busy'));
    } catch (err) {
      console.error(err);
      ui.setStatus('Error: ' + err.message, 'bad');
      return;
    }
    state.results = results;
    scene._clearViz();

    // pick the result to animate: the chosen algorithm, or Hybrid A* in compare mode
    let sel = results.find(r => r.algorithm === state.algo);
    if (state.algo === 'all') sel = results.find(r => r.algorithm === 'hybrid-astar') ?? results.find(r => r.success);
    state.selected = sel ? sel.algorithm : null;
    $('active-algo').textContent = state.selected
      ? `${t('activeAlgorithm').replace('—', state.selected)}` : t('activeAlgorithm');

    const showSearch = $('chk-viz').checked;
    for (const r of results) scene.showResult(r, showSearch);
    scene.setAnimation(sel && sel.success ? sel : null, state.world, () => {
      if (sel) {
        sel.collisionCount = (sel.collisionCount ?? 0) + 1;
        const row = state.history.find(h => h.algorithm === sel.algorithm && h.scenario === state.type);
        if (row) row.collisions = sel.collisionCount;
      }
      ui.showResults(state.results, state.selected);
      ui.showHistory(state.history);
      ui.setStatus(t('collisionDetected'), 'bad');
    });
    for (const r of results) state.history.unshift({
      scenario: state.type, difficulty: state.difficulty, algorithm: r.algorithm,
      success: r.success, time: r.planningTimeMs,
      accuracy: r.posErrorM == null ? null : Math.max(0, 100 - r.posErrorM * 100),
      collisions: r.collisionCount ?? 0,
      quality: r.success ? Math.max(0, 100 - r.pathLength - r.reversals * 2 - r.posErrorM * 100) : 0,
    });
    state.history = state.history.slice(0, 30);
    ui.showHistory(state.history);

    $('btn-play').disabled = !(sel && sel.success);
    ui.showResults(results, state.selected);
    ui.setStatus(
      results.some(r => r.success) ? t('doneOK') : t('doneFail'),
      results.some(r => r.success) ? 'ok' : 'bad'
    );
  }, 30);
}

// ---------------------------------------------------------------- wiring

$('sel-scenario').addEventListener('change', e => { state.type = e.target.value; rebuild(); });
$('rng-diff').addEventListener('input', e => { state.difficulty = e.target.value / 100; });
$('rng-diff').addEventListener('change', rebuild);
$('sel-algo').addEventListener('change', e => {
  state.algo = e.target.value;
  $('rrt-runs-row').classList.toggle('hidden', !(state.algo === 'rrt' || state.algo === 'all'));
});
$('num-rrt').addEventListener('change', e => {
  state.rrtRuns = Math.min(9, Math.max(1, Math.round(e.target.value) || 1));
  e.target.value = state.rrtRuns;
});
$('sel-start').addEventListener('change', e => { state.startMode = e.target.value; rebuild(); });

$('btn-plan').addEventListener('click', plan);
$('btn-play').addEventListener('click', togglePlay);
$('btn-reset').addEventListener('click', () => {
  if (state.scenario) scene.resetEgo(state.scenario.start);
  if (state.selected != null) {
    const sel = state.results.find(r => r.algorithm === state.selected);
    scene.setAnimation(sel && sel.success ? sel : null, state.world,
      () => ui.setStatus(t('collisionDetected'), 'bad'));
  }
});

function togglePlay() {
  const playing = scene.playPause();
  $('btn-play').textContent = playing ? t('pause') : t('play');
}

$('rng-speed').addEventListener('input', e => scene.setSpeed(parseFloat(e.target.value)));

for (const [id, preset] of [['btn-cam-scene', 'scene'], ['btn-cam-top', 'top'],
                            ['btn-cam-side', 'side'], ['btn-cam-driver', 'driver']]) {
  $(id).addEventListener('click', () => {
    for (const b of document.querySelectorAll('.cam-group button')) b.classList.remove('active');
    $(id).classList.add('active');
    scene.setCameraPreset(preset);
  });
}

$('chk-viz').addEventListener('change', e => {
  scene._clearViz();
  for (const r of state.results) scene.showResult(r, e.target.checked);
  const sel = state.results.find(r => r.algorithm === state.selected);
  scene.setAnimation(sel && sel.success ? sel : null, state.world,
    () => ui.setStatus(t('collisionDetected'), 'bad'));
});

$('btn-lang').addEventListener('click', () => {
  setLang(getLang() === 'fa' ? 'en' : 'fa');
  $('btn-play').textContent = scene.anim.playing ? t('pause') : t('play');
  ui.refresh();
  if (state.results.length) {
    const ok = state.results.some(r => r.success);
    ui.setStatus(ok ? t('doneOK') : t('doneFail'), ok ? 'ok' : 'bad');
  } else {
    ui.setStatus(t('noResults'));
  }
});

window.addEventListener('keydown', e => {
  if (e.code === 'Space' && !['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(document.activeElement?.tagName)) {
    e.preventDefault();
    if (!$('btn-play').disabled) togglePlay();
  }
});

// ---------------------------------------------------------------- boot

apply();
rebuild();
