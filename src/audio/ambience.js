// Ambient soundscape: a slowly evolving stereo "cell city" bed plus positional emitters.
//
//   const amb = createAmbience(audio);
//   amb.start();                                         // fade the bed in (after audio.resume())
//   const m = amb.addEmitter('mitochondria', {x, y, z}); // PannerNode (HRTF, inverse, ref 4, max 45)
//   const truck = amb.addEmitter('truck', truckMesh.position);
//   each frame: truck.setPosition(truckMesh.position); amb.update(dt);
//   truck.setReversing(true); truck.honk(); m.setVolume(0.5); m.remove();
//
// Emitters are virtualised: only the nearest MAX_ACTIVE emitters inside maxDistance build an audio graph;
// others cost nothing. Each emitter type is a "builder" that creates continuous layers + scheduled events.

import { mulberry32, hashStr, rrange, rpick, mtof, clamp, gain, filt, pan, osc, noise, perc, ahr, modal, burst, tone, softSaw, softSquare, engineWave, PARTIALS, VOWELS } from './dsp.js';
import { RECIPES } from './sfx.js';
import { PANNER_DEFAULTS } from './engine.js';

const MAX_ACTIVE = 14;
const TYPE_CAP = { truck: 4, crowd: 4, mitochondria: 4, golgi: 2, lysosome: 3, vacuole: 3, nucleus: 1, ser: 3, membrane: 3 };
const LOOKAHEAD = 0.45;
// Per-type level trims so every emitter sits at a similar loudness at refDistance (calibrated by QA).
export const EMITTER_LEVEL = { mitochondria: 0.385, golgi: 0.385, lysosome: 1.4, vacuole: 0.77, nucleus: 0.71, ser: 0.89, membrane: 0.69, truck: 0.43, crowd: 2.3 };
export const BED_LEVEL = 0.194;
// Loudness targets (gated integrated, dry at refDistance) the QA script calibrates EMITTER_LEVEL against.
export const EMITTER_TARGET = { mitochondria: -27, golgi: -27, lysosome: -29, vacuole: -29, nucleus: -29, ser: -30, membrane: -30, truck: -26, crowd: -31 };
export const BED_TARGET = -30;

// -------------------------------------------------------------------------------------------------
// Graph helper: registers sources + nodes, stops and disconnects everything together.

class Graph {
  constructor(ctx, out) { this.ctx = ctx; this.out = out; this.sources = []; this.nodes = []; this.events = []; this.dead = false; }
  n(node) { this.nodes.push(node); return node; }
  s(src) { this.sources.push(src); this.nodes.push(src); return src; }
  gain(v) { return this.n(gain(this.ctx, v)); }
  filt(type, f, Q, g) { return this.n(filt(this.ctx, type, f, Q, g)); }
  osc(type, f, t, wave) { return this.s(osc(this.ctx, type, f, t, wave)); }
  noise(kind, t, r) { return this.s(noise(this.ctx, kind, t, { r })); }
  /** LFO on a param: param += depth * sin(rate). */
  lfo(param, rate, depth, t, type = 'sine') {
    const o = this.osc(type, rate, t); const g = this.gain(depth); o.connect(g); g.connect(param); return o;
  }
  /** Recurring event: fn(t) at intervals from intervalFn(). */
  every(firstDelay, intervalFn, fn) { this.events.push({ next: null, firstDelay, intervalFn, fn }); }
  tick(now, ahead = LOOKAHEAD) {
    if (this.dead) return;
    for (const e of this.events) {
      if (e.next === null) e.next = now + e.firstDelay;
      if (e.next < now - 0.05) e.next = now + 0.02;          // fell behind (tab hidden etc.)
      let guard = 0;
      while (e.next < now + ahead && guard++ < 64) { e.fn(e.next); e.next += Math.max(0.01, e.intervalFn()); }
    }
  }
  stop(t) {
    this.dead = true;
    for (const s of this.sources) { try { s.stop(t); } catch {} }
    const nodes = this.nodes;
    if (this.sources.length) this.sources[0].onended = () => { for (const n of nodes) { try { n.disconnect(); } catch {} } };
  }
}

/** Play an sfx recipe live (used for scheduled events inside emitters). */
function recipe(ctx, name, out, t, r, level, extra = {}) {
  const g = gain(ctx, level); g.connect(out);
  const end = RECIPES[name](ctx, g, t, r, { variant: Math.floor(r() * 4), ...extra });
  // disconnect the level node later (silent source as timer)
  const c = ctx.createConstantSource(); const z = gain(ctx, 0); c.connect(z); z.connect(ctx.destination);
  c.start(end + 0.1); c.stop(end + 0.11); c.onended = () => { for (const n of [g, c, z]) { try { n.disconnect(); } catch {} } };
  return end;
}

// -------------------------------------------------------------------------------------------------
// Emitter builders: (ctx, out (mono-ish node -> panner), r, t0) => Graph (+ optional update(dt, state))

export const EMITTERS = {
  mitochondria(ctx, out, r, t0) {
    const G = new Graph(ctx, out);
    // deep electrical hum
    const humLp = G.filt('lowpass', 620, 0.7); const hum = G.gain(0.3);
    humLp.connect(hum); hum.connect(out);
    for (const [f, a, w] of [[55, 0.32, 'sine'], [110, 0.3, 'saw'], [165, 0.15, 'sine'], [220, 0.08, 'sine']]) {
      const o = G.osc(w === 'saw' ? null : w, f * rrange(r, 0.997, 1.003), t0, w === 'saw' ? softSaw(ctx, 16, 1.4) : undefined);
      const g = G.gain(a); o.connect(g); g.connect(humLp);
    }
    G.lfo(hum.gain, rrange(r, 0.5, 0.9), 0.06, t0);
    // electrical buzz shimmer (very low)
    const bz = G.osc(null, 110, t0, softSaw(ctx, 30, 1.0)); const bzBp = G.filt('bandpass', 880, 5); const bzG = G.gain(0.018);
    bz.connect(bzBp); bzBp.connect(bzG); bzG.connect(out);
    // turbine whir: noise band + tonal whine, amplitude-modulated at rotation rate
    const rot = rrange(r, 3.6, 4.6);
    const wn = G.noise('pink', t0, r); const wbp = G.filt('bandpass', 720, 2.5); const wg = G.gain(0.22);
    wn.connect(wbp); wbp.connect(wg); wg.connect(out);
    const rotLfo = G.lfo(wg.gain, rot, 0.16, t0);
    const wh = G.osc('triangle', 330, t0); const whLp = G.filt('lowpass', 1200, 0.7); const whG = G.gain(0.035);
    wh.connect(whLp); whLp.connect(whG); whG.connect(out);
    const vib = G.lfo(wh.frequency, rot, 6, t0);
    G.every(2, () => rrange(r, 4, 8), (t) => {
      const nr = rrange(r, 3.6, 4.8);
      rotLfo.frequency.setTargetAtTime(nr, t, 1.5); vib.frequency.setTargetAtTime(nr, t, 1.5);
      wh.frequency.setTargetAtTime(300 + nr * 10, t, 1.5);
    });
    // ATP release ticks + rare arc crackle
    G.every(rrange(r, 0.5, 2), () => rrange(r, 1.2, 3.5), (t) => recipe(ctx, 'atp_pop', out, t, r, 0.12));
    G.every(4, () => rrange(r, 5, 11), (t) => burst(ctx, out, t, { f: 2400, Q: 1.5, t60: 0.05, peak: 0.03, r }));
    return G;
  },

  golgi(ctx, out, r, t0) {
    const G = new Graph(ctx, out);
    // conveyor rattle (looped click-train buffer)
    const src = G.s(ctx.createBufferSource()); src.buffer = rattleBuffer(ctx); src.loop = true; src.start(t0, r() * 1.5);
    const rl = G.filt('lowpass', 3200, 0.7); const rg = G.gain(0.32);
    src.connect(rl); rl.connect(rg); rg.connect(out);
    // motor hum + belt rumble
    const m = G.osc(null, 82, t0, softSaw(ctx, 12, 1.5)); const ml = G.filt('lowpass', 300, 0.8); const mg = G.gain(0.1);
    m.connect(ml); ml.connect(mg); mg.connect(out);
    const b = G.noise('brown', t0, r); const bl = G.filt('lowpass', 260, 0.7); const bg = G.gain(0.25);
    b.connect(bl); bl.connect(bg); bg.connect(out);
    G.lfo(rg.gain, 0.13, 0.06, t0);
    // parcel thunks, pneumatic hiss + piston
    G.every(rrange(r, 0.5, 2), () => rrange(r, 1.6, 4.5), (t) => recipe(ctx, 'parcel_thunk', out, t, r, 0.55));
    G.every(rrange(r, 3, 6), () => rrange(r, 6, 13), (t) => {
      const s = noise(ctx, 'white', t, { r }); const bp = filt(ctx, 'bandpass', 3200, 0.9); const lp = filt(ctx, 'lowpass', 5500, 0.6);
      bp.frequency.setValueAtTime(3400, t); bp.frequency.exponentialRampToValueAtTime(1700, t + 0.7);
      const g = gain(ctx, 0); ahr(g.gain, t, 0.12, 0.02, 0.3, 0.35);
      s.connect(bp); bp.connect(lp); lp.connect(g); g.connect(out); s.stop(t + 1.1);
      s.onended = () => { for (const n of [s, bp, lp, g]) n.disconnect(); };
      modal(ctx, out, t + 0.02, 210, PARTIALS.metalLow, { gain: 0.12, r });
      tone(ctx, out, t + 0.02, { f: 120, f1: 70, glide: 0.05, t60: 0.12, peak: 0.25 });
    });
    return G;
  },

  lysosome(ctx, out, r, t0) {
    const G = new Graph(ctx, out);
    // gurgle: brown noise through a wandering resonant band
    const n = G.noise('brown', t0, r); const bp = G.filt('bandpass', 220, 4); const gg = G.gain(0.0);
    n.connect(bp); bp.connect(gg); gg.connect(out);
    G.every(0, () => rrange(r, 0.08, 0.2), (t) => {
      bp.frequency.setTargetAtTime(rrange(r, 140, 380), t, 0.04);
      gg.gain.setTargetAtTime(r() < 0.35 ? rrange(r, 0.25, 0.6) : rrange(r, 0.03, 0.12), t, 0.05);
    });
    // acid fizz
    const f = G.noise('white', t0, r); const fb = G.filt('bandpass', 3000, 0.8); const fl = G.filt('lowpass', 5500, 0.5); const fg = G.gain(0.012);
    f.connect(fb); fb.connect(fl); fl.connect(fg); fg.connect(out);
    // bubbles in bursts
    let rate = 4;
    G.every(0, () => rrange(r, 1, 4), () => { rate = r() < 0.3 ? rrange(r, 9, 16) : rrange(r, 2, 6); });
    G.every(0.1, () => -Math.log(1 - r()) / rate, (t) => recipe(ctx, 'bubble', out, t, r, rrange(r, 0.08, 0.22), { f0: rrange(r, 260, 820) }));
    return G;
  },

  vacuole(ctx, out, r, t0) {
    const G = new Graph(ctx, out);
    const base = G.noise('brown', t0, r); const bl = G.filt('lowpass', 320, 0.7); const bg = G.gain(0.1);
    base.connect(bl); bl.connect(bg); bg.connect(out);
    const w = G.noise('pink', t0, r); const wl = G.filt('lowpass', 500, 0.9); const wg = G.gain(0.0);
    w.connect(wl); wl.connect(wg); wg.connect(out);
    const s = G.noise('pink', t0, r); const sb = G.filt('bandpass', 900, 1.5); const sg = G.gain(0.0);
    s.connect(sb); sb.connect(sg); sg.connect(out);
    G.every(0, () => rrange(r, 2.2, 4.8), (t) => {
      const up = rrange(r, 0.6, 1.1), peak = rrange(r, 0.25, 0.45);
      wg.gain.setTargetAtTime(peak, t, up / 3); wg.gain.setTargetAtTime(0.03, t + up, 0.5);
      wl.frequency.setTargetAtTime(rrange(r, 900, 1400), t, up / 3); wl.frequency.setTargetAtTime(450, t + up, 0.6);
      const ts = t + up * 0.8; // slosh against the wall
      sg.gain.setTargetAtTime(peak * 0.25, ts, 0.06); sg.gain.setTargetAtTime(0, ts + 0.2, 0.25);
      sb.frequency.setValueAtTime(rrange(r, 600, 900), ts); sb.frequency.exponentialRampToValueAtTime(1800, ts + 0.3);
    });
    G.every(rrange(r, 1, 4), () => rrange(r, 2.5, 8), (t) => recipe(ctx, 'bubble', out, t, r, 0.12, { f0: rrange(r, 900, 1500) }));
    return G;
  },

  nucleus(ctx, out, r, t0) {
    const G = new Graph(ctx, out);
    const hl = G.filt('lowpass', 300, 0.7); const hg = G.gain(0.1); hl.connect(hg); hg.connect(out);
    for (const [f, a] of [[65.4, 0.45], [130.8, 0.35], [196.2, 0.1]]) { const o = G.osc('sine', f, t0); const g = G.gain(a); o.connect(g); g.connect(hl); }
    const fan = G.noise('pink', t0, r); const fl = G.filt('lowpass', 700, 0.7); const fg = G.gain(0.07);
    fan.connect(fl); fl.connect(fg); fg.connect(out);
    const notes = [79, 81, 84, 86, 88, 91].map(mtof);
    G.every(rrange(r, 0.3, 1.5), () => rrange(r, 1.2, 3.8), (t) => {
      if (r() < 0.7) {
        const k = 2 + Math.floor(r() * 4); let tt = t;
        for (let i = 0; i < k; i++) {
          const f = rpick(r, notes);
          tone(ctx, out, tt, { type: 'sine', f, t60: rrange(r, 0.08, 0.16), peak: 0.07, a: 0.004 });
          tone(ctx, out, tt, { type: 'triangle', f: f * 2, t60: 0.05, peak: 0.012, a: 0.004 });
          tt += rrange(r, 0.08, 0.15);
        }
      } else {
        // data chirp burst
        const k = 4 + Math.floor(r() * 6);
        for (let i = 0; i < k; i++) tone(ctx, out, t + i * 0.035, { f: rrange(r, 1100, 1700), f1: rrange(r, 1800, 2600), glide: 0.025, t60: 0.04, peak: 0.035, a: 0.002 });
      }
    });
    return G;
  },

  ser(ctx, out, r, t0) {
    const G = new Graph(ctx, out);
    const b = G.noise('brown', t0, r); const bl = G.filt('lowpass', 220, 0.8); const bg = G.gain(0.14);
    b.connect(bl); bl.connect(bg); bg.connect(out);
    G.lfo(bg.gain, 0.17, 0.06, t0);
    G.every(rrange(r, 0.5, 2), () => rrange(r, 2, 5.5), (t) => {
      const k = r() < 0.4 ? 2 : 1;
      for (let i = 0; i < k; i++) {
        const tt = t + i * rrange(r, 0.12, 0.2);
        const s = noise(ctx, 'pink', tt, { r }); const bp = filt(ctx, 'bandpass', 300, 6);
        bp.frequency.setValueAtTime(rrange(r, 250, 350), tt); bp.frequency.exponentialRampToValueAtTime(rrange(r, 800, 1100), tt + 0.09); bp.frequency.exponentialRampToValueAtTime(380, tt + 0.24);
        const g = gain(ctx, 0); ahr(g.gain, tt, 0.4, 0.03, 0.06, 0.12);
        s.connect(bp); bp.connect(g); g.connect(out); s.stop(tt + 0.45);
        s.onended = () => { for (const n of [s, bp, g]) n.disconnect(); };
      }
    });
    G.every(rrange(r, 0.2, 1.5), () => rrange(r, 1.4, 4), (t) => recipe(ctx, 'bubble', out, t, r, 0.16, { f0: rrange(r, 1000, 1500) }));
    return G;
  },

  membrane(ctx, out, r, t0) {
    const G = new Graph(ctx, out);
    const n = G.noise('pink', t0, r); const bp = G.filt('bandpass', 600, 0.8); const lp = G.filt('lowpass', 3500, 0.5); const g = G.gain(0.05);
    n.connect(bp); bp.connect(lp); lp.connect(g); g.connect(out);
    const d = G.noise('brown', t0, r); const dl = G.filt('lowpass', 300, 0.7); const dg = G.gain(0.08);
    d.connect(dl); dl.connect(dg); dg.connect(out);
    G.every(0, () => rrange(r, 4.2, 6.5), (t) => {
      const inh = rrange(r, 1.8, 2.6);
      g.gain.setTargetAtTime(rrange(r, 0.28, 0.4), t, inh / 3); bp.frequency.setTargetAtTime(rrange(r, 1100, 1500), t, inh / 3);
      dg.gain.setTargetAtTime(0.2, t, inh / 3);
      g.gain.setTargetAtTime(0.04, t + inh, 0.9); bp.frequency.setTargetAtTime(500, t + inh, 1.0); dg.gain.setTargetAtTime(0.06, t + inh, 1.0);
    });
    return G;
  },

  truck(ctx, out, r, t0) {
    const G = new Graph(ctx, out);
    const eng = G.osc(null, 30, t0, engineWave(ctx));
    const sh = G.n(ctx.createWaveShaper()); sh.curve = satCurveLocal(ctx);
    const lp = G.filt('lowpass', 260, 2.2); const eg = G.gain(0.16); const dc = G.filt('highpass', 45, 0.7);
    eng.connect(sh); sh.connect(dc); dc.connect(lp); lp.connect(eg); eg.connect(out);
    G.lfo(eg.gain, 7.3, 0.025, t0); // idle wobble
    const whine = G.osc('sine', 320, t0); const wg = G.gain(0.0); whine.connect(wg); wg.connect(out);
    const road = G.noise('brown', t0, r); const rl = G.filt('lowpass', 420, 0.7); const rg = G.gain(0.0);
    road.connect(rl); rl.connect(rg); rg.connect(out);
    let reversing = false;
    G.every(0, () => 0.95, (t) => {
      if (!reversing) return;
      const o = osc(ctx, 'sine', 1040); const o2 = osc(ctx, 'sine', 2080); const g2 = gain(ctx, 0.12); const g = gain(ctx, 0);
      ahr(g.gain, t, 0.13, 0.012, 0.42, 0.03);
      o.connect(g); o2.connect(g2); g2.connect(g); g.connect(out);
      o.start(t); o2.start(t); o.stop(t + 0.55); o2.stop(t + 0.55);
      o.onended = () => { for (const n of [o, o2, g2, g]) n.disconnect(); };
    });
    G.update = (dt, st) => {
      const t = ctx.currentTime, s = st.speed;
      eng.frequency.setTargetAtTime(28 + 30 * s, t, 0.25);
      lp.frequency.setTargetAtTime(240 + 520 * s, t, 0.25);
      eg.gain.setTargetAtTime(0.14 + 0.09 * s, t, 0.25);
      whine.frequency.setTargetAtTime(300 + 600 * s, t, 0.25);
      wg.gain.setTargetAtTime(0.025 * s, t, 0.25);
      rg.gain.setTargetAtTime(0.25 * s, t, 0.3);
    };
    G.setReversing = (v) => { reversing = !!v; };
    G.honk = () => recipe(ctx, 'truck_honk', out, ctx.currentTime + 0.01, r, 0.5);
    return G;
  },

  crowd(ctx, out, r, t0) {
    const G = new Graph(ctx, out);
    const lp = G.filt('lowpass', 1900, 0.6); const cg = G.gain(0.55); lp.connect(cg); cg.connect(out);
    const voices = [];
    for (let v = 0; v < 3; v++) {
      const f0 = rrange(r, 150, 290);
      const src = G.osc(null, f0, t0, softSaw(ctx, 30, 1.2));
      const vg = G.gain(0);
      const f1 = G.filt('bandpass', 600, 5), f2 = G.filt('bandpass', 1500, 7);
      const g1 = G.gain(1.6), g2 = G.gain(1.0);
      src.connect(f1); src.connect(f2); f1.connect(g1); f2.connect(g2); g1.connect(vg); g2.connect(vg); vg.connect(lp);
      voices.push({ src, vg, f1, f2, f0, nextTalk: t0 + rrange(r, 0, 3), busyUntil: 0 });
    }
    G.every(0, () => 0.25, (t) => {
      for (const v of voices) {
        if (t < v.nextTalk || t < v.busyUntil) continue;
        let tt = t;
        const syl = 3 + Math.floor(r() * 7);
        for (let i = 0; i < syl; i++) {
          const d = rrange(r, 0.11, 0.24);
          const vw = VOWELS[rpick(r, ['a', 'e', 'i', 'o', 'u'])];
          v.f1.frequency.setTargetAtTime(vw[0] * 1.1, tt, 0.03); v.f2.frequency.setTargetAtTime(vw[1] * 1.1, tt, 0.03);
          v.src.frequency.setTargetAtTime(v.f0 * rrange(r, 0.88, 1.18), tt, 0.05);
          v.vg.gain.setTargetAtTime(rrange(r, 0.05, 0.11), tt, 0.025);
          v.vg.gain.setTargetAtTime(0.0, tt + d * 0.7, 0.03);
          tt += d + rrange(r, 0.0, 0.06);
        }
        v.busyUntil = tt;
        v.nextTalk = tt + rrange(r, 0.8, 4.5);
      }
    });
    // soft footsteps
    G.every(rrange(r, 0.5, 3), () => rrange(r, 2, 6), (t) => {
      const k = 3 + Math.floor(r() * 5), step = rrange(r, 0.42, 0.55);
      for (let i = 0; i < k; i++) recipe(ctx, 'footstep_pave', out, t + i * step, r, 0.18, { variant: i });
    });
    return G;
  },
};
export const EMITTER_TYPES = Object.keys(EMITTERS);

function satCurveLocal(ctx) {
  const n = 1024, c = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(x * 2.2) / Math.tanh(2.2); }
  return c;
}

const rattleCache = new WeakMap();
function rattleBuffer(ctx) {
  if (rattleCache.has(ctx)) return rattleCache.get(ctx);
  const sr = ctx.sampleRate, n = Math.floor(sr * 2.0);
  const buf = ctx.createBuffer(1, n, sr), d = buf.getChannelData(0);
  const r = mulberry32(4242);
  // rollers: ~16 clicks/s with jitter, each a damped resonance; plus a slower "joint" bump every 0.5 s
  let t = 0;
  while (t < 2.0) {
    const f = rrange(r, 700, 1900), amp = rrange(r, 0.15, 0.5), dec = rrange(r, 0.004, 0.009);
    const i0 = Math.floor(t * sr);
    for (let i = 0; i < sr * dec * 6 && i0 + i < n; i++) { const tt = i / sr; d[i0 + i] += amp * Math.sin(2 * Math.PI * f * tt) * Math.exp(-tt / dec); }
    t += 1 / 16 + rrange(r, -0.012, 0.012);
  }
  for (let k = 0; k < 4; k++) {
    const i0 = Math.floor((k * 0.5 + 0.05) * sr);
    for (let i = 0; i < sr * 0.08; i++) { const tt = i / sr; d[i0 + i] += 0.6 * Math.sin(2 * Math.PI * 140 * tt) * Math.exp(-tt / 0.02); }
  }
  let peak = 0; for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(d[i]));
  for (let i = 0; i < n; i++) d[i] *= 0.8 / peak;
  rattleCache.set(ctx, buf);
  return buf;
}

// -------------------------------------------------------------------------------------------------
// Stereo bed

export function buildBed(ctx, out, wetOut, r, t0) {
  const G = new Graph(ctx, out);
  // deep cellular rumble (stereo brown noise)
  const rum = G.noise('brown', t0, r); const rl = G.filt('lowpass', 150, 0.7); const rg = G.gain(0.55);
  rum.connect(rl); rl.connect(rg); rg.connect(out);
  G.lfo(rl.frequency, 0.047, 40, t0); G.lfo(rg.gain, 0.031, 0.15, t0);
  // air / cytoplasm hiss
  const air = G.noise('pink', t0, r); const ab = G.filt('bandpass', 700, 0.5); const al = G.filt('lowpass', 2400, 0.5); const ag = G.gain(0.07);
  air.connect(ab); ab.connect(al); al.connect(ag); ag.connect(out);
  G.lfo(ag.gain, 0.023, 0.03, t0); G.lfo(ab.frequency, 0.017, 250, t0);
  // low drones (D/A, filtered) with independent slow swells, spread in stereo
  const dl = G.filt('lowpass', 380, 0.7); dl.connect(out);
  G.lfo(dl.frequency, 0.019, 120, t0);
  [[73.42, -0.5, 0.021], [110, 0.5, 0.034], [146.83, -0.2, 0.027], [164.81, 0.3, 0.041]].forEach(([f, p, rate], i) => {
    const o = G.osc(i % 2 ? 'sine' : null, f, t0, i % 2 ? undefined : softSaw(ctx, 10, 1.6));
    o.detune.value = rrange(r, -5, 5);
    const g = G.gain(0.05); const pp = G.n(pan(ctx, p));
    o.connect(g); g.connect(pp); pp.connect(dl);
    G.lfo(g.gain, rate, 0.045, t0);
  });
  // distant murmur: noise through wandering formants with syllabic AM, mostly to reverb
  const mn = G.noise('pink', t0, r); const mlp = G.filt('lowpass', 1500, 0.6); const mg = G.gain(0.0);
  const forms = [500, 1100, 2300].map((f) => { const b = G.filt('bandpass', f, 4); mn.connect(b); b.connect(mlp); return b; });
  mlp.connect(mg); mg.connect(out); const mw = G.gain(1.5); mg.connect(mw); mw.connect(wetOut);
  G.every(0, () => rrange(r, 0.12, 0.25), (t) => {
    forms.forEach((b, k) => b.frequency.setTargetAtTime([500, 1100, 2300][k] * rrange(r, 0.7, 1.35), t, 0.05));
    mg.gain.setTargetAtTime(r() < 0.6 ? rrange(r, 0.04, 0.09) : 0.01, t, 0.05);
  });
  // distant events: clanks, hisses, horns
  const spot = (t, level, fn) => {
    const p = pan(ctx, rrange(r, -0.9, 0.9)); const l = filt(ctx, 'lowpass', 1600, 0.6); const dry = gain(ctx, level * 0.3); const wet = gain(ctx, level);
    l.connect(dry); dry.connect(p); p.connect(out); l.connect(wet); wet.connect(wetOut);
    const end = fn(l);
    const c = ctx.createConstantSource(); const z = gain(ctx, 0); c.connect(z); z.connect(ctx.destination);
    c.start(end + 0.2); c.stop(end + 0.21); c.onended = () => { for (const n of [p, l, dry, wet, c, z]) { try { n.disconnect(); } catch {} } };
  };
  G.every(rrange(r, 2, 5), () => rrange(r, 5, 13), (t) => spot(t, 0.5, (o) => modal(ctx, o, t, rrange(r, 110, 260), PARTIALS.metalLow, { gain: 0.5, r })));
  G.every(rrange(r, 5, 9), () => rrange(r, 8, 20), (t) => spot(t, 0.35, (o) => {
    const s = noise(ctx, 'white', t, { r }); const b = filt(ctx, 'bandpass', 2000, 0.7); const g = gain(ctx, 0);
    ahr(g.gain, t, 0.3, 0.15, 0.4, 0.6); s.connect(b); b.connect(g); g.connect(o); s.stop(t + 1.6);
    s.onended = () => { for (const n of [s, b, g]) n.disconnect(); };
    return t + 1.6;
  }));
  G.every(rrange(r, 12, 25), () => rrange(r, 25, 60), (t) => spot(t, 0.45, (o) => recipe(ctx, 'truck_honk', o, t, r, 0.6)));
  G.every(rrange(r, 6, 12), () => rrange(r, 9, 22), (t) => spot(t, 0.4, (o) => recipe(ctx, 'parcel_thunk', o, t, r, 0.7)));
  return G;
}

// -------------------------------------------------------------------------------------------------

export function createAmbience(engine, { seed = 1234 } = {}) {
  const ctx = engine.ctx;
  const r = mulberry32(seed);
  const bedOut = gain(ctx, 0);
  const bedTrim = gain(ctx, BED_LEVEL);
  bedOut.connect(bedTrim); bedTrim.connect(engine.ambienceBus);
  let bed = null;
  let bedLevel = 1;
  const emitters = new Set();
  let idSeq = 1;

  class Emitter {
    constructor(type, position, opts) {
      this.type = type; this.id = idSeq++;
      this.pos = { x: position?.x || 0, y: position?.y || 0, z: position?.z || 0 };
      this.prev = { ...this.pos };
      this.volume = opts.volume ?? 1;
      this.maxDistance = opts.maxDistance ?? PANNER_DEFAULTS.maxDistance;
      this.speed = 0; this.manualSpeed = null; this.reversing = false;
      this.graph = null; this.dist = Infinity; this.removed = false;
      this.seed = opts.seed ?? hashStr(type) + this.id * 7919;
    }
    setPosition(v) { this.pos.x = v.x; this.pos.y = v.y; this.pos.z = v.z; return this; }
    setVolume(v) { this.volume = v; return this; }
    /** Trucks: 0..1 drive amount (otherwise estimated from movement). null = auto. */
    setSpeed(v) { this.manualSpeed = v; return this; }
    setReversing(v) { this.reversing = !!v; if (this.graph?.g.setReversing) this.graph.g.setReversing(v); return this; }
    honk() { if (this.graph?.g.honk) this.graph.g.honk(); return this; }
    remove() { this.removed = true; emitters.delete(this); this._release(0.6); }
    get active() { return !!this.graph; }
    _build() {
      const t0 = ctx.currentTime + 0.02;
      const panner = engine.createPanner(this.pos, { maxDistance: this.maxDistance });
      const cull = gain(ctx, 0);
      const vol = gain(ctx, this.volume * (EMITTER_LEVEL[this.type] ?? 1));
      const wet = gain(ctx, 0.18);
      const g = EMITTERS[this.type](ctx, vol, mulberry32(this.seed), t0);
      vol.connect(cull); cull.connect(panner); panner.connect(engine.ambienceBus);
      cull.connect(wet); wet.connect(engine.sends.ambience);
      cull.gain.setValueAtTime(0, ctx.currentTime);
      if (g.setReversing) g.setReversing(this.reversing);
      this.graph = { g, panner, cull, vol, wet };
    }
    _release(fade = 1.2) {
      const gr = this.graph; if (!gr) return;
      this.graph = null;
      const t = ctx.currentTime;
      gr.cull.gain.cancelScheduledValues(t);
      gr.cull.gain.setTargetAtTime(0, t, fade / 4);
      gr.g.stop(t + fade + 0.1);
      setTimeout(() => { for (const n of [gr.panner, gr.cull, gr.vol, gr.wet]) { try { n.disconnect(); } catch {} } }, (fade + 0.4) * 1000);
    }
  }

  function addEmitter(type, position, opts = {}) {
    if (!EMITTERS[type]) throw new Error(`ambience: unknown emitter type "${type}"`);
    const e = new Emitter(type, position, opts);
    emitters.add(e);
    return e;
  }

  let lastNow = 0;
  function update(dt = 1 / 60) {
    const now = ctx.currentTime;
    if (ctx.state !== 'running') return;
    dt = Math.max(1e-3, dt || now - lastNow || 1 / 60); lastNow = now;
    if (bed) bed.tick(now);
    const L = engine.listenerPos;
    const list = [...emitters];
    for (const e of list) {
      const dx = e.pos.x - L.x, dy = e.pos.y - L.y, dz = e.pos.z - L.z;
      e.dist = Math.hypot(dx, dy, dz);
      const v = Math.hypot(e.pos.x - e.prev.x, e.pos.y - e.prev.y, e.pos.z - e.prev.z) / dt;
      e.prev.x = e.pos.x; e.prev.y = e.pos.y; e.prev.z = e.pos.z;
      const target = e.manualSpeed ?? clamp(v / 7, 0, 1);
      e.speed += (target - e.speed) * Math.min(1, dt * 3);
    }
    list.sort((a, b) => a.dist - b.dist);
    const counts = {}; let active = 0;
    for (const e of list) {
      counts[e.type] = counts[e.type] || 0;
      const want = e.volume > 0 && e.dist < e.maxDistance && active < MAX_ACTIVE && counts[e.type] < (TYPE_CAP[e.type] ?? 4);
      const keep = e.graph && e.dist < e.maxDistance * 1.08 && active < MAX_ACTIVE + 2 && counts[e.type] < (TYPE_CAP[e.type] ?? 4) + 1;
      if (want || keep) {
        if (!e.graph) e._build();
        active++; counts[e.type]++;
        const gr = e.graph;
        engine.setPannerPosition(gr.panner, e.pos, e.type === 'truck' ? 0.03 : 0.05);
        // fade out over the last 20% of the range so emitters never pop in/out
        const edge = clamp((e.maxDistance - e.dist) / (e.maxDistance * 0.2), 0, 1);
        gr.cull.gain.setTargetAtTime(edge * edge, now, 0.25);
        gr.vol.gain.setTargetAtTime(e.volume * (EMITTER_LEVEL[e.type] ?? 1), now, 0.1);
        gr.g.tick(now);
        if (gr.g.update) gr.g.update(dt, e);
      } else if (e.graph) e._release();
    }
  }

  return {
    addEmitter,
    update,
    types: EMITTER_TYPES,
    emitters,
    /** Fade in the stereo bed. */
    start(fade = 4) {
      if (!bed) bed = buildBed(ctx, bedOut, engine.sends.ambience, r, ctx.currentTime + 0.02);
      bedOut.gain.cancelScheduledValues(ctx.currentTime);
      bedOut.gain.setTargetAtTime(bedLevel, ctx.currentTime, fade / 3);
    },
    stop(fade = 2) {
      const b = bed; bed = null;
      bedOut.gain.setTargetAtTime(0, ctx.currentTime, fade / 4);
      if (b) b.stop(ctx.currentTime + fade + 0.2);
      for (const e of emitters) e._release(fade);
    },
    /** Bed level 0..1 (e.g. lower it inside quiet interiors). */
    setBedLevel(v, time = 2) { bedLevel = v; if (bed) bedOut.gain.setTargetAtTime(v, ctx.currentTime, time / 3); },
    clear() { for (const e of [...emitters]) e.remove(); },
    get activeCount() { let n = 0; for (const e of emitters) if (e.graph) n++; return n; },
  };
}

/** QA helper: bed + positional emitters rendered on an offline engine (listener at origin facing -z). */
export function createAmbienceOffline(engine, seconds, list) {
  const ctx = engine.ctx;
  const r = mulberry32(99);
  const bo = gain(ctx, BED_LEVEL); bo.connect(engine.ambienceBus);
  const bed = buildBed(ctx, bo, engine.sends.ambience, r, 0);
  bed.tick(0, seconds);
  for (const [type, pos] of list) {
    const p = engine.createPanner(pos);
    const vol = gain(ctx, EMITTER_LEVEL[type] ?? 1);
    const wet = gain(ctx, 0.18);
    const G = EMITTERS[type](ctx, vol, mulberry32(hashStr(type)), 0);
    vol.connect(p); p.connect(engine.ambienceBus); vol.connect(wet); wet.connect(engine.sends.ambience);
    if (G.update) G.update(1 / 60, { speed: 0.4 });
    G.tick(0, seconds);
  }
}
