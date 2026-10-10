// DOM overlay: title screen, poster pins, info cards, dialogue, prompts, notebook, help, toasts, hints.
import * as THREE from 'three';
import { ORGANELLES, CURIOSITIES, HELP } from '../data/content.js';
import { DISTRICT_ORDER } from '../game/districts.js';

const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class UI {
  constructor(root, game) {
    this.root = root; this.game = game;
    this.sfx = (n) => game.sfx?.(n);
    this.layers = {};
    for (const k of ['world', 'hud', 'panel', 'dialogue', 'modal', 'top']) { const d = el('div'); d.style.cssText = 'position:absolute;inset:0;pointer-events:none'; root.appendChild(d); this.layers[k] = d; }
    this._v = new THREE.Vector3();
    this.pins = [];
    this.hintEl = null; this.cardEl = null; this.dialogueEl = null; this.modalEl = null;
  }

  // ---------------- loading / title ----------------
  loading(text = 'BUILDING THE CITY…') {
    const l = el('div', 'loading interactive', `<div style="text-align:center"><div class="ring" style="margin:auto"></div><p>${text}</p></div>`);
    this.layers.top.appendChild(l); this.loadingEl = l;
  }
  loaded() { const l = this.loadingEl; if (!l) return; l.classList.add('fadeout'); setTimeout(() => l.remove(), 900); this.loadingEl = null; }

  title(onStart, { hasProgress = false } = {}) {
    const t = el('div', 'title-screen');
    t.innerHTML = `
      <div class="title-head"><h1>ANIMAL CELL <span>—</span> THE LIVING CITY</h1><p>Every Organelle Has a Job. Together They Keep Life Running.</p></div>
      <div class="title-cta">
        <button class="btn-primary" data-a="start">${hasProgress ? 'CONTINUE THE VISIT' : 'ENTER THE CITY'}</button>
        <button class="btn-ghost" data-a="help">Controls &amp; settings</button>
      </div>
      <div class="title-note">Headphones recommended · Biological processes are slowed and simplified so you can see them.</div>`;
    t.querySelector('[data-a=start]').onclick = () => { this.sfx('ui_click'); onStart(); };
    t.querySelector('[data-a=help]').onclick = () => { this.sfx('ui_open'); this.help(); };
    t.querySelectorAll('button').forEach((b) => b.addEventListener('mouseenter', () => this.sfx('ui_hover')));
    this.layers.hud.appendChild(t); this.titleEl = t;
  }

  // ---------------- HUD ----------------
  hud(progress) {
    const tl = el('div', 'hud-tl');
    tl.innerHTML = `<button class="chip" data-a="nb"><span class="ic">📓</span><span>Field Notebook</span><span class="progress"></span><span class="kbd">N</span></button>`;
    tl.querySelector('[data-a=nb]').onclick = () => this.game.toggleNotebook();
    const bl = el('div', 'hud-bl');
    bl.innerHTML = `<button class="guide-btn" data-a="g"><div class="avatar"></div><div><b>DR. CELIA MENDEL</b><span>Ask your guide <span class="kbd" style="transform:scale(.85)">G</span></span></div></button>
      <button class="chip" data-a="tour"><span class="ic">🧭</span><span data-t>Guided tour: off</span><span class="kbd">T</span></button>`;
    bl.querySelector('[data-a=g]').onclick = () => this.game.askGuide();
    bl.querySelector('[data-a=tour]').onclick = () => this.game.toggleTour();
    const br = el('div', 'hud-br');
    br.innerHTML = `<button class="chip" data-a="view"><span class="ic">👁️</span><span data-v>First person</span><span class="kbd">V</span></button>
      <button class="chip" data-a="labels"><span class="ic">🏷️</span><span>Labels</span><span class="kbd">L</span></button>
      <button class="chip" data-a="help"><span class="ic">?</span><span>Help</span><span class="kbd">H</span></button>`;
    br.querySelector('[data-a=labels]').onclick = () => this.game.toggleLabels();
    br.querySelector('[data-a=view]').onclick = () => this.game.toggleView();
    br.querySelector('[data-a=help]').onclick = () => this.game.toggleHelp();
    const banner = el('div', 'district-banner', '<div class="k"></div><div class="n"></div>');
    this.layers.hud.append(tl, bl, br, banner);
    this.hudEls = { tl, bl, br, banner };
    [tl, bl, br].forEach((x) => x.querySelectorAll('button').forEach((b) => b.addEventListener('mouseenter', () => this.sfx('ui_hover'))));
    this.updateProgress(progress);
  }
  showHud(on) { if (!this.hudEls) return; for (const k of ['tl', 'bl', 'br']) this.hudEls[k].style.display = on ? '' : 'none'; }
  updateProgress(p) {
    if (!this.hudEls) return;
    const dots = this.hudEls.tl.querySelector('.progress');
    dots.innerHTML = DISTRICT_ORDER.map((id) => `<i class="${p.visited.has(id) ? 'on' : ''}" style="--c:${ORGANELLES[id].color}"></i>`).join('');
  }
  /** First-person crosshair; when the mouse isn't captured, a hint explains how to capture it. */
  crosshair(on, locked = true) {
    if (!on) { this.crossEl?.remove(); this.crossEl = null; return; }
    if (!this.crossEl) {
      this.crossEl = el('div', 'crosshair', '<i></i><span>Click to steer with the mouse · Esc frees the cursor</span>');
      this.layers.hud.appendChild(this.crossEl);
    }
    this.crossEl.classList.toggle('free', !locked);
  }
  setView(fp) { const e = this.hudEls?.br.querySelector('[data-v]'); if (e) e.textContent = fp ? 'Overhead view' : 'First person'; }
  setTour(on) { if (this.hudEls) this.hudEls.bl.querySelector('[data-t]').textContent = `Guided tour: ${on ? 'on' : 'off'}`; }
  banner(id) {
    const o = ORGANELLES[id]; const b = this.hudEls?.banner; if (!b || !o) return;
    b.style.setProperty('--c', o.color);
    b.querySelector('.k').textContent = `${o.num} · ${o.cityRole.toUpperCase()}`;
    b.querySelector('.n').textContent = o.title;
    b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
  }

  // ---------------- poster callouts (title / overview): infographic cards with dotted leaders ----------------
  buildCallouts(districts, onClick) {
    const SLOTS = {
      nucleolus: ['L', 0.17], membrane: ['L', 0.34], vacuoles: ['L', 0.51], lysosomes: ['L', 0.68], mitochondria: ['L', 0.85],
      nucleus: ['R', 0.17], ribosomes: ['R', 0.31], rer: ['R', 0.45], ser: ['R', 0.59], vesicles: ['R', 0.73], golgi: ['R', 0.87],
    };
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'leaders'); svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;transition:opacity .5s';
    this.layers.world.appendChild(svg);
    const wrap = el('div'); wrap.style.cssText = 'position:absolute;inset:0;pointer-events:none;transition:opacity .5s';
    this.layers.world.appendChild(wrap);
    this.callouts = { svg, wrap, items: [] };
    for (const id of DISTRICT_ORDER) {
      const o = ORGANELLES[id]; const [side, fy] = SLOTS[id];
      const c = el('div', `callout ${side === 'L' ? 'l' : 'r'}`);
      c.style.setProperty('--c', o.color);
      const short = o.cardText.length > 132 ? `${o.cardText.slice(0, o.cardText.lastIndexOf(' ', 128))}…` : o.cardText;
      c.innerHTML = `<div class="head"><div class="num">${o.num}</div><h4>${esc(o.title.toUpperCase())}</h4></div><b>${esc(o.cityRole)}</b><p>${esc(short)}</p>`;
      c.onclick = () => { this.sfx('ui_click'); onClick(id); };
      c.addEventListener('mouseenter', () => this.sfx('ui_hover'));
      wrap.appendChild(c);
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      line.setAttribute('stroke', o.color); line.setAttribute('stroke-width', '2'); line.setAttribute('fill', 'none');
      line.setAttribute('stroke-dasharray', '2 5'); line.setAttribute('stroke-linecap', 'round');
      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.setAttribute('r', '4.5'); dot.setAttribute('fill', o.color); dot.setAttribute('stroke', '#fff'); dot.setAttribute('stroke-width', '2');
      svg.append(line, dot);
      this.callouts.items.push({ id, el: c, line, dot, side, fy, pos: districts[id].callout || districts[id].pin });
    }
  }
  updateCallouts(camera, visible) {
    const C = this.callouts; if (!C) return;
    C.svg.style.opacity = C.wrap.style.opacity = visible ? 1 : 0;
    C.wrap.querySelectorAll('.callout').forEach((e) => { e.style.pointerEvents = visible ? 'auto' : 'none'; });
    if (!visible) return;
    const W = window.innerWidth, H = window.innerHeight;
    const cw = Math.min(250, W * 0.17);
    for (const it of C.items) {
      const x = it.side === 'L' ? W * 0.025 : W * 0.975 - cw;
      const y = H * it.fy;
      it.el.style.left = `${x}px`; it.el.style.top = `${y}px`; it.el.style.width = `${cw}px`;
      this._v.copy(it.pos).project(camera);
      const px = (this._v.x * 0.5 + 0.5) * W, py = (-this._v.y * 0.5 + 0.5) * H;
      const ax = it.side === 'L' ? x + cw + 6 : x - 6, ay = y + 14;
      const mx = it.side === 'L' ? Math.max(ax + 20, px - 40) : Math.min(ax - 20, px + 40);
      it.line.setAttribute('d', `M${ax},${ay} L${mx},${ay} L${px},${py}`);
      it.dot.setAttribute('cx', px); it.dot.setAttribute('cy', py);
    }
  }

  // ---------------- poster pins (numbered hotspots) ----------------
  buildPins(districts, onClick) {
    for (const id of DISTRICT_ORDER) {
      const o = ORGANELLES[id], d = districts[id];
      const p = el('div', 'pin');
      p.style.setProperty('--c', o.color);
      p.innerHTML = `<div class="pulse"></div><div class="dot">${o.num}</div><div class="label">${esc(o.title.toUpperCase())}</div>`;
      p.onclick = () => { this.sfx('ui_click'); onClick(id); };
      p.addEventListener('mouseenter', () => this.sfx('ui_hover'));
      this.layers.world.appendChild(p);
      this.pins.push({ id, el: p, pos: d.pin });
    }
  }
  updatePins(camera, { visible = true, visited, compact = false, focusId = null } = {}) {
    const W = window.innerWidth, H = window.innerHeight;
    for (const pin of this.pins) {
      this._v.copy(pin.pos).project(camera);
      const on = visible && this._v.z < 1 && Math.abs(this._v.x) < 1.05 && Math.abs(this._v.y) < 1.05;
      pin.el.style.opacity = on ? (focusId && focusId !== pin.id ? 0.35 : 1) : 0;
      pin.el.style.pointerEvents = on ? 'auto' : 'none';
      if (!on) continue;
      const x = (this._v.x * 0.5 + 0.5) * W, y = (-this._v.y * 0.5 + 0.5) * H;
      pin.el.style.left = `${x}px`; pin.el.style.top = `${y}px`;
      pin.el.classList.toggle('left', x > W * 0.62);
      pin.el.classList.toggle('visited', visited?.has(pin.id));
      pin.el.querySelector('.label').style.display = compact ? 'none' : '';
    }
  }

  // ---------------- info card ----------------
  card(id, { onTry, onClose, tried }) {
    this.closeCard(true);
    const o = ORGANELLES[id];
    const c = el('div', 'card');
    c.style.setProperty('--c', o.color);
    c.innerHTML = `<button class="close" title="Close (Esc)">×</button>
      <div class="head"><div class="num">${o.num}</div><h2>${esc(o.title)}</h2></div>
      <div class="role">${esc(o.cityRole)}</div>
      <p class="text">${esc(o.cardText)}</p>
      <div class="analogy"><b>City vs. cell · </b>${esc(o.analogyNote)}</div>
      <div class="deep hidden">${o.deep.map((p) => `<p>${esc(p)}</p>`).join('')}<p class="fun">★ ${esc(o.funFact)}</p></div>
      <div class="actions">
        ${o.tryIt ? `<button class="solid" data-a="try">${tried ? '↻ ' : ''}${esc(o.tryIt.title)}</button>` : ''}
        <button data-a="deep">Deeper science ▾</button>
      </div>`;
    c.querySelector('.close').onclick = () => { this.sfx('ui_close'); onClose?.(); };
    c.querySelector('[data-a=deep]').onclick = (e) => {
      const d = c.querySelector('.deep'); d.classList.toggle('hidden'); this.sfx('notebook_page');
      e.target.textContent = d.classList.contains('hidden') ? 'Deeper science ▾' : 'Less ▴';
    };
    const tb = c.querySelector('[data-a=try]'); if (tb) tb.onclick = () => { this.sfx('ui_click'); onTry?.(); };
    c.querySelectorAll('button').forEach((b) => b.addEventListener('mouseenter', () => this.sfx('ui_hover')));
    this.layers.panel.appendChild(c); this.cardEl = c;
    this.sfx('ui_open');
  }
  closeCard(instant = false) {
    const c = this.cardEl; if (!c) return; this.cardEl = null;
    if (instant) { c.remove(); return; }
    c.classList.add('out'); setTimeout(() => c.remove(), 300);
  }

  // ---------------- curiosity card (compact) ----------------
  curiosity(cur, color) {
    this.closeCard(true);
    const c = el('div', 'card');
    c.style.setProperty('--c', color);
    c.innerHTML = `<button class="close">×</button><div class="head"><div class="num">★</div><h2>${esc(cur.title)}</h2></div>
      <div class="role">Curiosity found</div><p class="text">${esc(cur.text)}</p>`;
    c.querySelector('.close').onclick = () => { this.sfx('ui_close'); this.closeCard(); };
    this.layers.panel.appendChild(c); this.cardEl = c;
  }

  // ---------------- dialogue ----------------
  dialogue(speaker, text, { worker = false, choices = null, onChoice } = {}) {
    if (!this.dialogueEl) {
      const d = el('div', 'dialogue');
      d.innerHTML = `<div class="avatar"></div><div style="flex:1"><div class="who"></div><div class="line"></div><div class="choices"></div></div>`;
      this.layers.dialogue.appendChild(d); this.dialogueEl = d;
    }
    const d = this.dialogueEl;
    d.classList.remove('out');
    d.querySelector('.avatar').className = `avatar talking ${worker ? 'worker' : ''}`;
    d.querySelector('.who').textContent = speaker;
    d.querySelector('.who').style.color = worker ? '#b8861a' : '#8a5cc8';
    const line = d.querySelector('.line'); line.textContent = '';
    const ch = d.querySelector('.choices'); ch.innerHTML = '';
    if (choices) for (const [i, c] of choices.entries()) {
      const b = el('button', i === 0 ? 'solid' : '', esc(c.label));
      b.onclick = () => { this.sfx('ui_click'); onChoice?.(c.value); };
      ch.appendChild(b);
    }
    // typewriter
    clearInterval(this._tw);
    let i = 0; const chars = [...text];
    this._tw = setInterval(() => {
      i += 2; line.textContent = chars.slice(0, i).join('');
      if (i >= chars.length) { clearInterval(this._tw); d.querySelector('.avatar').classList.remove('talking'); }
    }, 22);
    return d;
  }
  stopTalking() { this.dialogueEl?.querySelector('.avatar')?.classList.remove('talking'); }
  closeDialogue() {
    const d = this.dialogueEl; if (!d) return; this.dialogueEl = null; clearInterval(this._tw);
    d.classList.add('out'); setTimeout(() => d.remove(), 300);
  }

  // ---------------- prompt ----------------
  prompt(text, screen) {
    if (!text) { if (this.promptEl) this.promptEl.style.opacity = 0; return; }
    if (!this.promptEl) { this.promptEl = el('div', 'prompt'); this.layers.world.appendChild(this.promptEl); }
    const p = this.promptEl;
    if (p.dataset.t !== text) { p.innerHTML = `<span class="kbd">E</span>${esc(text)}`; p.dataset.t = text; }
    p.style.opacity = 1; p.style.left = `${screen.x}px`; p.style.top = `${screen.y}px`;
  }

  // ---------------- hint / toast ----------------
  hint(html) {
    if (!html) { if (this.hintEl) { this.hintEl.remove(); this.hintEl = null; } return; }
    if (this.hintEl && this.hintEl.dataset.h === html) return;
    this.hintEl?.remove();
    this.hintEl = el('div', 'hint', html); this.hintEl.dataset.h = html;
    this.layers.hud.appendChild(this.hintEl);
  }
  toast(kicker, name, color = '#8a5cc8') {
    const t = el('div', 'toast', `<div><div class="t">${esc(kicker)}</div><div class="n">${esc(name)}</div></div>`);
    t.style.setProperty('--c', color);
    const n = this.layers.top.querySelectorAll('.toast').length;
    t.style.top = `${18 + n * 64}px`;
    this.layers.top.appendChild(t); setTimeout(() => t.remove(), 4300);
  }

  // ---------------- modals ----------------
  closeModal() { if (this.modalEl) { this.modalEl.remove(); this.modalEl = null; this.sfx('ui_close'); return true; } return false; }
  _modal(html) {
    this.closeModal();
    const b = el('div', 'modal-back');
    b.innerHTML = `<div class="modal"><button class="x">×</button>${html}</div>`;
    b.onclick = (e) => { if (e.target === b) this.closeModal(); };
    b.querySelector('.x').onclick = () => this.closeModal();
    this.layers.modal.appendChild(b); this.modalEl = b; this.sfx('ui_open');
    return b;
  }
  notebook(progress) {
    const D = DISTRICT_ORDER.map((id) => {
      const o = ORGANELLES[id]; const v = progress.visited.has(id), t = progress.tried.has(id);
      const curs = CURIOSITIES.filter((c) => c.district === id);
      const f = curs.filter((c) => progress.found.has(c.id)).length;
      return `<div class="nb-item ${v ? 'done' : 'locked'}" style="--c:${o.color}"><div class="num">${o.num}</div>
        <div><div class="t">${v ? esc(o.title) : '???'}</div><div class="s">${v ? esc(o.cityRole) : 'Not yet visited'} · ${t ? 'tried it ✓' : 'activity'}${curs.length ? ` · ★ ${f}/${curs.length}` : ''}</div></div>
        <div class="ticks"><i class="${v ? 'on' : ''}"></i><i class="${t ? 'on' : ''}"></i></div></div>`;
    }).join('');
    const C = CURIOSITIES.map((c) => {
      const f = progress.found.has(c.id); const col = ORGANELLES[c.district]?.color || '#888';
      return `<div class="nb-item ${f ? 'done' : 'locked'}" style="--c:${col}"><div class="num">★</div><div><div class="t">${f ? esc(c.title) : 'Undiscovered'}</div><div class="s">${esc(ORGANELLES[c.district]?.title || '')}</div></div></div>`;
    }).join('');
    const tot = progress.visited.size + progress.tried.size + progress.found.size;
    this._modal(`<h2>Field Notebook</h2><p class="sub">${tot} / ${11 + 11 + CURIOSITIES.length} entries · nothing here is required — wander, poke, wonder.</p>
      <h3>DISTRICTS · VISITED & TRIED</h3><div class="grid">${D}</div>
      <h3>CURIOSITIES · ${progress.found.size} / ${CURIOSITIES.length}</h3><div class="grid">${C}</div>`);
  }
  help(settings, onSetting) {
    const rows = HELP.controls.map((c) => `<div style="font-weight:700">${esc(c.action)}</div><div style="color:var(--muted)">${esc(c.keys)}</div>`).join('');
    const s = { master: 0.8, music: 0.6, sfx: 0.8, ambience: 0.7, voice: 1, footsteps: 0.7, headBob: 0.6, lookSens: 0.5, ...(settings || {}) };
    const sl = (k, label) => `<div>${label}</div><input type="range" min="0" max="1" step="0.05" value="${s[k]}" data-k="${k}"><div data-v="${k}">${Math.round(s[k] * 100)}</div>`;
    const b = this._modal(`<h2>Controls & Settings</h2><p class="sub">Explore freely — there are no levels or quests.</p>
      <div class="controls">${rows}</div>
      <h3>GRAPHICS</h3><div class="gfx">${['auto', 'low', 'medium', 'high'].map((g) => `<button data-g="${g}" class="${(s.graphics || 'auto') === g ? 'on' : ''}">${g === 'auto' ? `Auto${s.graphicsTier ? ` · ${s.graphicsTier}` : ''}` : g[0].toUpperCase() + g.slice(1)}</button>`).join('')}</div>
      <div class="gfx-note">Auto picks a level for your computer and steps down if frames drop. Crowd size changes apply next time you open the game.</div>
      <h3>AUDIO</h3><div class="settings">${sl('master', 'Master')}${sl('music', 'Music')}${sl('ambience', 'Ambience')}${sl('sfx', 'Effects')}${sl('voice', 'Voice')}${sl('footsteps', 'Footsteps')}</div>
      <h3>FIRST-PERSON VIEW <span class="kbd" style="transform:scale(.85)">V</span></h3><div class="settings">${sl('headBob', 'Head bob')}${sl('lookSens', 'Mouse speed')}</div>
      <div class="note">🔬 ${esc(HELP.note || '')}</div>`);
    b.querySelectorAll('input[type=range]').forEach((r) => r.oninput = () => { b.querySelector(`[data-v=${r.dataset.k}]`).textContent = Math.round(r.value * 100); onSetting?.(r.dataset.k, +r.value); });
    b.querySelectorAll('[data-g]').forEach((btn) => btn.onclick = () => {
      b.querySelectorAll('[data-g]').forEach((x) => x.classList.toggle('on', x === btn));
      this.sfx('ui_click'); onSetting?.('graphics', btn.dataset.g);
    });
  }

  // ---------------- activity panel ----------------
  activityPanel(color, title, goal) {
    this.closeActivity();
    const a = el('div', 'activity');
    a.style.setProperty('--c', color);
    a.innerHTML = `<h3>${esc(title)}</h3><div class="goal">${goal}</div><div class="meter"><i></i></div><div class="stat"></div><div class="btns"></div>`;
    this.layers.panel.appendChild(a); this.activityEl = a;
    return {
      el: a,
      setGoal: (h) => { a.querySelector('.goal').innerHTML = h; },
      setProgress: (f, label = '') => { a.querySelector('.meter i').style.width = `${Math.round(Math.max(0, Math.min(1, f)) * 100)}%`; a.querySelector('.stat').textContent = label; },
      buttons: (list) => {
        const box = a.querySelector('.btns'); box.innerHTML = '';
        return list.map((b) => { const e = el('button', b.solid ? 'solid' : '', esc(b.label)); e.onclick = () => { this.sfx('ui_click'); b.onClick(); }; box.appendChild(e); return e; });
      },
    };
  }
  closeActivity() { this.activityEl?.remove(); this.activityEl = null; }

  // ---------------- scientific overlay labels (examine mode) ----------------
  sciLabels(list, camera) {
    if (!this.sciEls) this.sciEls = new Map();
    const keep = new Set();
    const W = window.innerWidth, H = window.innerHeight;
    for (const l of list || []) {
      keep.add(l.key);
      let e = this.sciEls.get(l.key);
      if (!e) { e = el('div', 'sci-label', `<span class="tag">${esc(l.tag || '›')}</span>${esc(l.text)}`); this.layers.world.appendChild(e); this.sciEls.set(l.key, e); }
      this._v.copy(l.pos).project(camera);
      e.style.left = `${(this._v.x * 0.5 + 0.5) * W}px`; e.style.top = `${(-this._v.y * 0.5 + 0.5) * H - 18}px`;
      e.style.opacity = this._v.z < 1 ? 1 : 0;
    }
    for (const [k, e] of this.sciEls) if (!keep.has(k)) { e.remove(); this.sciEls.delete(k); }
  }
}
