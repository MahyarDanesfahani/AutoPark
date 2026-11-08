/**
 * i18n.js — bilingual dictionary (fa default RTL / en LTR) and DOM applier.
 * Static texts are tagged with data-i18n in index.html; dynamic strings
 * come from t(key, vars).
 */

const DICT = {
  fa: {
    title: 'شبیه‌ساز سه‌بعدی پارک خودکار',
    subtitle: 'مقایسه Hybrid A* ، A* و RRT',
    controls: 'کنترل‌ها',
    scenario: 'سناریو',
    parallel: 'پارک موازی',
    perpendicular: 'پارک عمودی',
    angled: 'پارک مورب ۴۵°',
    difficulty: 'سختی فضا',
    easy: 'آسان',
    hard: 'سخت',
    algorithm: 'الگوریتم',
    hybrid: 'Hybrid A*',
    astar: 'A* (شبکه حالت)',
    rrt: 'RRT',
    all: 'مقایسه هر سه',
    rrtRuns: 'تعداد اجرای RRT (میانگین)',
    startOffset: 'موقعیت شروع',
    startDefault: 'پیش‌فرض',
    startNear: 'نزدیک‌تر به جایگاه',
    startFar: 'دورتر از جایگاه',
    plan: 'محاسبه مسیر',
    play: 'پخش مسیر',
    pause: 'توقف',
    reset: 'بازنشانی',
    speed: 'سرعت پخش',
    searchViz: 'نمایش گره‌های جستجو',
    results: 'نتایج و مقایسه',
    colAlgo: 'الگوریتم',
    colResult: 'نتیجه',
    colTime: 'زمان (ms)',
    colLen: 'طول (m)',
    colRev: 'دنده‌عقب',
    colPos: 'خطا (cm)',
    colHead: 'زاویه (°)',
    colNodes: 'گره‌ها (میانگین)',
    success: 'موفق',
    fail: 'ناموفق',
    noResults: 'هنوز محاسبه‌ای انجام نشده — «محاسبه مسیر» را بزنید.',
    planning: 'در حال محاسبه…',
    planningAlgo: 'در حال اجرای {algo}…',
    collisionDetected: 'هشدار: برخورد خودرو با مانع تشخیص داده شد.',
    activeAlgorithm: 'الگوریتم در حال پخش: —', historyTitle: 'سوابق پارک', historyScenario: 'فضا', historyAlgo: 'الگوریتم', historyTime: 'زمان (ms)', historyAccuracy: 'دقت (%)', historyCollisions: 'برخورد', historyQuality: 'کیفیت',
    doneOK: 'محاسبه تمام شد — دکمه «پخش مسیر» انیمیشن پارک را نشان می‌دهد.',
    doneFail: 'هیچ الگوریتمی در این تنظیمات مسیر پیدا نکرد. سختی را کمتر کنید.',
    camScene: 'نمای صحنه',
    camTop: 'نمای بالا',
    camSide: 'نمای کنار',
    camDriver: 'نمای راننده',
    bestFor: 'بهترین گزینه برای این فضا:',
    runsOf: '{ok} از {n} اجرا موفق',
    legend: 'راهنما:',
    chartTime: 'زمان',
    chartLen: 'طول',
    chartRev: 'دنده‌عقب',
    chartPos: 'خطای مکان',
    chartHead: 'خطای زاویه',
    footerHint: 'چرخش/زوم با موس • Space = پخش/توقف • همه‌چیز آفلاین است',
    langBtn: 'EN',
  },
  en: {
    title: '3D Auto-Parking Simulator',
    subtitle: 'Comparing Hybrid A*, A* and RRT',
    controls: 'Controls',
    scenario: 'Scenario',
    parallel: 'Parallel parking',
    perpendicular: 'Perpendicular parking',
    angled: 'Angled (45°) parking',
    difficulty: 'Slot difficulty',
    easy: 'Easy',
    hard: 'Hard',
    algorithm: 'Algorithm',
    hybrid: 'Hybrid A*',
    astar: 'A* (state lattice)',
    rrt: 'RRT',
    all: 'Compare all three',
    rrtRuns: 'RRT runs (averaged)',
    startOffset: 'Start position',
    startDefault: 'Default',
    startNear: 'Closer to slot',
    startFar: 'Farther from slot',
    plan: 'Plan path',
    play: 'Play path',
    pause: 'Pause',
    reset: 'Reset',
    speed: 'Playback speed',
    searchViz: 'Show search nodes',
    results: 'Results & comparison',
    colAlgo: 'Algorithm',
    colResult: 'Result',
    colTime: 'Time (ms)',
    colLen: 'Length (m)',
    colRev: 'Reversals',
    colPos: 'Pos err (cm)',
    colHead: 'Head err (°)',
    colNodes: 'Nodes (avg)',
    success: 'Success',
    fail: 'Failed',
    noResults: 'Nothing computed yet — press "Plan path".',
    planning: 'Planning…',
    planningAlgo: 'Running {algo}…',
    collisionDetected: 'Warning: vehicle collision detected.',
    activeAlgorithm: 'Playing algorithm: —', historyTitle: 'Parking history', historyScenario: 'Space', historyAlgo: 'Algorithm', historyTime: 'Time (ms)', historyAccuracy: 'Accuracy (%)', historyCollisions: 'Collisions', historyQuality: 'Quality',
    doneOK: 'Done — press "Play path" to watch the parking animation.',
    doneFail: 'No algorithm found a path with these settings. Lower the difficulty.',
    camScene: 'Scene view',
    camTop: 'Top view',
    camSide: 'Side view',
    camDriver: 'Driver view',
    bestFor: 'Best choice for this slot:',
    runsOf: '{ok}/{n} runs succeeded',
    legend: 'Legend:',
    chartTime: 'Time',
    chartLen: 'Length',
    chartRev: 'Reversals',
    chartPos: 'Pos error',
    chartHead: 'Head error',
    footerHint: 'Orbit/zoom with mouse • Space = play/pause • Fully offline',
    langBtn: 'فا',
  },
};

let current = localStorage.getItem('autopark-lang') || 'fa';

export function t(key, vars) {
  let s = (DICT[current] && DICT[current][key]) ?? DICT.fa[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll('{' + k + '}', v);
  return s;
}

export function getLang() { return current; }

export function setLang(lang) {
  current = lang;
  localStorage.setItem('autopark-lang', lang);
  apply();
}

/** Apply current language to <html> dir/lang and every [data-i18n] node. */
export function apply() {
  document.documentElement.lang = current;
  document.documentElement.dir = current === 'fa' ? 'rtl' : 'ltr';
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const txt = t(key);
    if (txt != null) el.textContent = txt;
  });
  const langBtn = document.getElementById('btn-lang');
  if (langBtn) langBtn.textContent = t('langBtn');
}
