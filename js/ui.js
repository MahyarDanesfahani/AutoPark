/**
 * ui.js — results table, comparison chart and status line.
 * Pure DOM + 2D canvas; re-renders on language change.
 */

import { t } from './i18n.js';
import { ALGO_COLORS } from './scene3d.js';
import { bestOf } from './metrics.js';

export class UI {
  constructor(onPlay) {
    this.statusEl = document.getElementById('status');
    this.tbody = document.querySelector('#tbl-results tbody');
    this.summaryEl = document.getElementById('summary');
    this.chartEl = document.getElementById('chart');
    this.legendEl = document.getElementById('legend');
    this.results = [];
    this.selected = null;
  }

  setStatus(text, kind = '') {
    this.statusEl.textContent = text;
    this.statusEl.className = 'status ' + kind;
  }

  showResults(results, selectedAlgo) {
    this.results = results;
    this.selected = selectedAlgo;
    this._table();
    this._summary();
    this._chart();
    this._legend();
  }

  refresh() { // after language switch
    if (this.results.length) this.showResults(this.results, this.selected);
  }

  showHistory(rows) {
    const body = document.querySelector('#tbl-history tbody');
    if (!body) return;
    body.innerHTML = '';
    for (const r of rows) {
      const tr = document.createElement('tr');
      for (const v of [r.scenario, r.algorithm, r.success ? t('success') : t('fail'), this._fmt(r.time, 0), this._fmt(r.accuracy), String(r.collisions), this._fmt(r.quality)]) {
        const td = document.createElement('td'); td.textContent = v; tr.appendChild(td);
      }
      body.appendChild(tr);
    }
  }

  _fmt(v, digits = 1) {
    return v == null ? '—' : v.toFixed(digits);
  }

  _table() {
    const best = bestOf(this.results);
    this.tbody.innerHTML = '';
    for (const r of this.results) {
      const tr = document.createElement('tr');
      tr.className = `dot-${r.algorithm}` + (r.algorithm === this.selected ? ' selected' : '');

      const result = r.success
        ? (r.runs && r.runs.n > 1
            ? t('runsOf', { ok: r.runs.ok, n: r.runs.n })
            : t('success'))
        : t('fail');

      const cells = [
        ['algo', r.algorithm, false],
        [r.success ? 'ok' : 'fail', result, false],
        ['', r.success ? this._fmt(r.planningTimeMs, 0) : '—', r.algorithm === best.planningTimeMs],
        ['', r.success ? this._fmt(r.pathLength) : '—', r.algorithm === best.pathLength],
        ['', r.success ? String(r.reversals) : '—', r.algorithm === best.reversals],
        ['', r.success ? this._fmt(r.posErrorM * 100) : '—', r.algorithm === best.posErrorM],
        ['', r.success ? this._fmt(r.headErrorDeg) : '—', r.algorithm === best.headErrorDeg],
        ['', r.runs && r.runs.n > 1
          ? `${r.nodesExpanded ?? 0} (${Math.round(r.runs.successRate * 100)}%)`
          : String(r.nodesExpanded ?? 0), false],
      ];
      for (const [cls, text, isBest] of cells) {
        const td = document.createElement('td');
        td.className = cls + (isBest && r.success ? ' best' : '');
        td.textContent = text;
        tr.appendChild(td);
      }
      this.tbody.appendChild(tr);
    }
  }

  _summary() {
    const ok = this.results.filter(r => r.success);
    if (!this.results.length) { this.summaryEl.textContent = ''; return; }
    if (!ok.length) { this.summaryEl.textContent = t('doneFail'); return; }
    const scored = ok.map(r => ({
      r,
      score: (r.posErrorM ?? 1) * 100 + r.planningTimeMs / 50 + (r.pathLength ?? 0),
    })).sort((a, b) => a.score - b.score);
    const chip = `<span class="chip">${scored[0].r.algorithm}</span>`;
    this.summaryEl.innerHTML = t('bestFor') + ' ' + chip;
  }

  _chart() {
    const ctx = this.chartEl.getContext('2d');
    const W = this.chartEl.width, H = this.chartEl.height;
    ctx.clearRect(0, 0, W, H);
    const ok = this.results.filter(r => r.success);
    if (!ok.length) return;

    const groups = [
      { label: t('chartTime'), get: r => r.planningTimeMs },
      { label: t('chartLen'), get: r => r.pathLength },
      { label: t('chartRev'), get: r => r.reversals },
      { label: t('chartPos'), get: r => (r.posErrorM ?? 0) * 100 },
      { label: t('chartHead'), get: r => r.headErrorDeg },
    ];
    const maxOf = g => Math.max(...ok.map(g.get), 1e-6);

    const padL = 8, padT = 26, groupW = (W - padL * 2) / groups.length;
    const barW = Math.min(26, (groupW - 18) / ok.length);
    const chartH = H - padT - 34;

    ctx.textAlign = 'center';
    for (let gi = 0; gi < groups.length; gi++) {
      const g = groups[gi];
      const gx = padL + gi * groupW;
      const max = maxOf(g);
      ok.forEach((r, ri) => {
        const v = g.get(r);
        const h = Math.max(2, (v / max) * chartH);
        const x = gx + (groupW - ok.length * barW) / 2 + ri * barW;
        const y = padT + chartH - h;
        ctx.fillStyle = '#' + ALGO_COLORS[r.algorithm].toString(16).padStart(6, '0');
        ctx.beginPath();
        ctx.roundRect(x, y, barW - 3, h, [3, 3, 0, 0]);
        ctx.fill();
      });
      ctx.fillStyle = '#9aa5b1';
      ctx.font = '11px Vazirmatn, sans-serif';
      ctx.fillText(g.label, gx + groupW / 2, H - 20);
    }
    ctx.fillStyle = '#6b7683';
    ctx.font = '10px Vazirmatn, sans-serif';
    ctx.fillText(t('legend'), padL + 2, 14);
    let lx = padL + 60;
    for (const r of ok) {
      ctx.fillStyle = '#' + ALGO_COLORS[r.algorithm].toString(16).padStart(6, '0');
      ctx.fillRect(lx, 7, 9, 9);
      ctx.fillStyle = '#c8d0d8';
      ctx.textAlign = 'start';
      ctx.fillText(r.algorithm, lx + 13, 15);
      lx += 26 + ctx.measureText(r.algorithm).width * 1.0;
      ctx.textAlign = 'center';
    }
  }

  _legend() {
    this.legendEl.innerHTML = '';
    for (const r of this.results) {
      const span = document.createElement('span');
      const color = '#' + (ALGO_COLORS[r.algorithm] ?? 0xffffff).toString(16).padStart(6, '0');
      span.innerHTML = `<span class="swatch" style="background:${color}"></span>${r.algorithm}${r.success ? '' : ' (' + t('fail') + ')'}`;
      this.legendEl.appendChild(span);
    }
  }
}
