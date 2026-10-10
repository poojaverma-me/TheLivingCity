// Procedural SFX library.
//
//   const sfx = createSfx(audio);              // audio = createAudio()
//   await sfx.ready;                           // optional: all sounds pre-rendered + loudness-normalised
//   sfx.play('ui_click');
//   sfx.play('footstep', { surface: 'metal', volume: 0.8 });
//   sfx.play('parcel_thunk', { position: {x, y, z} });   // positional (HRTF panner)
//   sfx.play('guide_blip', { pitch: 1.1 });               // pitch = playback-rate multiplier
//
// Every sound is a "recipe" (a function that builds a WebAudio graph on any BaseAudioContext). At start-up
// each recipe is rendered into a few variants with OfflineAudioContext, measured (K-weighted short-term
// loudness + peak) and scaled so the whole library sits together at its per-sound target loudness.
// Until a sound is rendered it is played live from the recipe with a static gain hint.

import {
  TAU, mtof, dbToGain, clamp, mulberry32, hashStr, rrange, rpick,
  gain, filt, pan, osc, noise, perc, ahr, modal, burst, tone, cleanupAt,
  softSaw, softSquare, satCurve, PARTIALS, VOWELS,
} from './dsp.js';
import { analyze } from './analysis.js';

// -------------------------------------------------------------------------------------------------
// Small building blocks

/** Bubble (Minnaert-style): sine with fast rising pitch and quick decay. */
function bubbleAt(ctx, out, t, f0, peak = 0.3, len = 0.08) {
  const o = osc(ctx, 'sine', f0);
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f0 * 1.9, t + len * 0.8);
  const g = gain(ctx, 0);
  perc(g.gain, t, peak, 0.002, len);
  o.connect(g); g.connect(out);
  o.start(t); o.stop(t + len * 1.2 + 0.02);
  cleanupAt(ctx, o, [o, g]);
  return t + len * 1.2;
}

/** Formant voice syllable(s): soft-saw glottal source through parallel formant bandpasses. */
function formantVoice(ctx, out, t, { f0Curve, vowelCurve, dur, peak = 0.3, vib = 0.02, breath = 0.04, scale = 1.2 }) {
  const src = osc(ctx, null, f0Curve[0][1], undefined, softSaw(ctx, 40, 1.1));
  src.frequency.setValueAtTime(f0Curve[0][1], t);
  for (const [tt, f] of f0Curve) src.frequency.linearRampToValueAtTime(f, t + tt);
  const vibO = osc(ctx, 'sine', 5.8); const vibG = gain(ctx, f0Curve[0][1] * vib);
  vibO.connect(vibG); vibG.connect(src.frequency);
  const pre = filt(ctx, 'lowpass', 3200, 0.5);
  src.connect(pre);
  const nb = noise(ctx, 'pink', t); const nbG = gain(ctx, breath); nb.connect(nbG); nbG.connect(pre);
  const sum = gain(ctx, 0);
  const nodes = [src, vibO, vibG, pre, nb, nbG, sum];
  const fq = [7, 9, 11], fg = [1, 0.55, 0.22];
  for (let k = 0; k < 3; k++) {
    const bp = filt(ctx, 'bandpass', vowelCurve[0][1][k] * scale, fq[k]);
    bp.frequency.setValueAtTime(vowelCurve[0][1][k] * scale, t);
    for (const [tt, v] of vowelCurve) bp.frequency.linearRampToValueAtTime(v[k] * scale, t + tt);
    const g = gain(ctx, fg[k] * (k === 0 ? 1.6 : 2.2));
    pre.connect(bp); bp.connect(g); g.connect(sum);
    nodes.push(bp, g);
  }
  sum.connect(out);
  return { sum, start: () => { src.start(t); vibO.start(t); const e = t + dur + 0.05; src.stop(e); vibO.stop(e); nb.stop(e); cleanupAt(ctx, src, nodes); } };
}

/** Sparkle: a cloud of tiny high sine grains with stereo spread. */
function sparkle(ctx, out, t, r, { count = 12, span = 0.8, fLo = 2200, fHi = 4200, peak = 0.05, scale } = {}) {
  let end = t;
  for (let i = 0; i < count; i++) {
    const tt = t + Math.pow(r(), 1.4) * span;
    const f = scale ? rpick(r, scale) : rrange(r, fLo, fHi);
    const p = pan(ctx, rrange(r, -0.8, 0.8));
    p.connect(out);
    const e = modal(ctx, p, tt, f, [[1, 1, rrange(r, 0.15, 0.45)], [2.76, 0.12, 0.06]], { gain: peak * rrange(r, 0.4, 1), attack: 0.003, r });
    end = Math.max(end, e);
  }
  return end;
}

/** Soft swish (filtered pink noise sweep). */
function swish(ctx, out, t, { f0 = 500, f1 = 2000, dur = 0.25, peak = 0.15, Q = 1.2, r } = {}) {
  const s = noise(ctx, 'pink', t, { r });
  const bp = filt(ctx, 'bandpass', f0, Q);
  bp.frequency.setValueAtTime(f0, t);
  bp.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = gain(ctx, 0);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + dur * 0.45);
  g.gain.setTargetAtTime(0, t + dur * 0.5, dur * 0.2);
  s.connect(bp); bp.connect(g); g.connect(out);
  s.stop(t + dur * 1.6 + 0.05);
  cleanupAt(ctx, s, [s, bp, g]);
  return t + dur * 1.6;
}

/** Soft pad swell (triangle/sine chord). */
function padSwell(ctx, out, t, midis, { a = 0.25, h = 0.3, rel = 1.4, peak = 0.05, lp = 1800 } = {}) {
  const l = filt(ctx, 'lowpass', lp, 0.6);
  const g = gain(ctx, 0);
  ahr(g.gain, t, peak, a, h, rel);
  l.connect(g); g.connect(out);
  const end = t + a + h + rel * 1.2;
  const nodes = [l, g];
  let first;
  midis.forEach((m, i) => {
    for (const det of [-6, 6]) {
      const o = osc(ctx, i % 2 ? 'sine' : 'triangle', mtof(m)); o.detune.value = det;
      o.connect(l); o.start(t); o.stop(end);
      nodes.push(o); if (!first) first = o;
    }
  });
  cleanupAt(ctx, first, nodes);
  return end;
}

// -------------------------------------------------------------------------------------------------
// Recipes: (ctx, out, t, r, o) => endTime. `o.variant` is the variant index.

export const RECIPES = {
  ui_hover(ctx, out, t, r) {
    const f = rpick(r, [1175, 1319, 1480]) * rrange(r, 0.995, 1.005);
    modal(ctx, out, t, f, [[1, 0.5, 0.11], [2.0, 0.06, 0.05], [3.0, 0.02, 0.03]], { attack: 0.004, r });
    burst(ctx, out, t, { f: 4200, Q: 1.5, t60: 0.012, peak: 0.03, r });
    return t + 0.16;
  },

  ui_click(ctx, out, t, r) {
    tone(ctx, out, t, { f: 230, f1: 135, glide: 0.035, t60: 0.08, peak: 0.55, a: 0.001 });
    modal(ctx, out, t + 0.002, 1046 * rrange(r, 0.99, 1.01), [[1, 0.32, 0.16], [2.76, 0.06, 0.05], [5.4, 0.015, 0.03]], { r });
    burst(ctx, out, t, { f: 2600, Q: 1, t60: 0.012, peak: 0.22, r });
    return t + 0.2;
  },

  ui_open(ctx, out, t, r) {
    const p1 = pan(ctx, -0.15), p2 = pan(ctx, 0.15); p1.connect(out); p2.connect(out);
    modal(ctx, p1, t, mtof(74), PARTIALS.marimba, { gain: 0.32, r });
    modal(ctx, p2, t + 0.075, mtof(81), PARTIALS.marimba, { gain: 0.28, r });
    swish(ctx, out, t, { f0: 500, f1: 2200, dur: 0.22, peak: 0.12, r });
    return t + 0.9;
  },

  ui_close(ctx, out, t, r) {
    const p1 = pan(ctx, 0.15), p2 = pan(ctx, -0.15); p1.connect(out); p2.connect(out);
    modal(ctx, p1, t, mtof(81), PARTIALS.marimba, { gain: 0.26, r });
    modal(ctx, p2, t + 0.075, mtof(74), PARTIALS.marimbaMuted, { gain: 0.3, r });
    swish(ctx, out, t, { f0: 2000, f1: 450, dur: 0.2, peak: 0.1, r });
    return t + 0.7;
  },

  discovery_chime(ctx, out, t, r) {
    const notes = [74, 78, 81, 85, 88, 93];
    notes.forEach((m, i) => {
      const p = pan(ctx, -0.45 + (0.9 * i) / (notes.length - 1)); p.connect(out);
      const tt = t + i * 0.072 + rrange(r, 0, 0.008);
      modal(ctx, p, tt, mtof(m), PARTIALS.celesta, { gain: 0.2 * (1 - i * 0.06), attack: 0.003, maxFreq: 6800, r });
      modal(ctx, p, tt, mtof(m + 12), [[1, 0.04, 0.5]], { attack: 0.003, maxFreq: 6800, r });
    });
    padSwell(ctx, out, t + 0.05, [62, 69, 76, 78], { a: 0.35, h: 0.4, rel: 1.6, peak: 0.07, lp: 1600 });
    sparkle(ctx, out, t + 0.25, r, { count: 20, span: 1.3, peak: 0.045, scale: [2349, 2637, 2960, 3520, 3951, 4699] });
    return t + 3.0;
  },

  success_flourish(ctx, out, t, r) {
    [74, 76, 78, 81].forEach((m, i) => {
      const p = pan(ctx, -0.3 + i * 0.2); p.connect(out);
      modal(ctx, p, t + i * 0.06, mtof(m), PARTIALS.marimba, { gain: 0.22, r });
    });
    const tc = t + 0.3;
    const trem = gain(ctx, 1); trem.connect(out);
    const lfo = osc(ctx, 'sine', 5.2); const lg = gain(ctx, 0.18); lfo.connect(lg); lg.connect(trem.gain);
    lfo.start(tc); lfo.stop(tc + 2.4); cleanupAt(ctx, lfo, [lfo, lg]);
    [74, 78, 81, 86].forEach((m, i) => modal(ctx, trem, tc + i * 0.012, mtof(m), PARTIALS.vibes, { gain: 0.16, r }));
    tone(ctx, out, tc, { f: mtof(50), f1: mtof(50) * 0.98, glide: 0.2, t60: 0.9, peak: 0.35, a: 0.004 });
    padSwell(ctx, out, tc, [62, 66, 69, 73, 76], { a: 0.2, h: 0.4, rel: 1.5, peak: 0.06, lp: 2000 });
    sparkle(ctx, out, tc + 0.05, r, { count: 8, span: 0.8, peak: 0.035, scale: [2349, 2960, 3520] });
    return t + 2.8;
  },

  notebook_page(ctx, out, t, r) {
    const lp = filt(ctx, 'lowpass', 6500, 0.5); lp.connect(out);
    const n = 12 + Math.floor(r() * 6);
    for (let i = 0; i < n; i++) {
      const tt = t + 0.02 + Math.pow(r(), 0.9) * 0.28;
      burst(ctx, lp, tt, { f: rrange(r, 1500, 4200), Q: rrange(r, 0.8, 2), t60: rrange(r, 0.01, 0.03), peak: rrange(r, 0.04, 0.16), r });
    }
    swish(ctx, lp, t, { f0: 700, f1: 2400, dur: 0.3, peak: 0.22, Q: 0.7, r });
    burst(ctx, lp, t + 0.32, { kind: 'pink', type: 'lowpass', f: 380, Q: 0.7, t60: 0.06, peak: 0.35, r });
    tone(ctx, lp, t + 0.32, { f: 120, f1: 80, glide: 0.04, t60: 0.06, peak: 0.12 });
    return t + 0.5;
  },

  footstep_pave(ctx, out, t, r, o) {
    const side = o.variant % 2 ? 0.12 : -0.12;
    const p = pan(ctx, side); p.connect(out);
    tone(ctx, p, t, { f: rrange(r, 100, 125), f1: 62, glide: 0.04, t60: 0.07, peak: 0.42, a: 0.002 });
    burst(ctx, p, t + 0.004, { kind: 'pink', type: 'lowpass', f: rrange(r, 800, 1100), Q: 0.6, t60: rrange(r, 0.05, 0.08), peak: 0.38, r });
    burst(ctx, p, t + 0.012, { f: rrange(r, 2400, 3200), Q: 2, t60: 0.02, peak: 0.05, r });
    // toe scuff
    burst(ctx, p, t + rrange(r, 0.05, 0.07), { kind: 'pink', type: 'bandpass', f: 1400, Q: 0.8, a: 0.008, t60: 0.06, peak: 0.08, r });
    return t + 0.2;
  },

  footstep_metal(ctx, out, t, r, o) {
    const side = o.variant % 2 ? 0.12 : -0.12;
    const p = pan(ctx, side); p.connect(out);
    tone(ctx, p, t, { f: rrange(r, 110, 130), f1: 70, glide: 0.04, t60: 0.08, peak: 0.36, a: 0.002 });
    burst(ctx, p, t + 0.003, { kind: 'pink', type: 'lowpass', f: 1200, Q: 0.6, t60: 0.05, peak: 0.25, r });
    modal(ctx, p, t + 0.004, rrange(r, 360, 470), PARTIALS.metalSmall, { gain: 0.16, r });
    modal(ctx, p, t + 0.006, rrange(r, 900, 1150), [[1, 0.06, 0.07], [1.47, 0.04, 0.05]], { r });
    return t + 0.3;
  },

  interact_ping(ctx, out, t, r) {
    const trem = gain(ctx, 1); trem.connect(out);
    const lfo = osc(ctx, 'sine', 5.5); const lg = gain(ctx, 0.2); lfo.connect(lg); lg.connect(trem.gain);
    lfo.start(t); lfo.stop(t + 1.6); cleanupAt(ctx, lfo, [lfo, lg]);
    modal(ctx, trem, t, mtof(81), PARTIALS.vibes, { gain: 0.3, r });
    modal(ctx, trem, t + 0.085, mtof(88), PARTIALS.vibes, { gain: 0.16, r });
    tone(ctx, out, t, { f: 180, f1: 120, glide: 0.03, t60: 0.06, peak: 0.18 });
    return t + 1.6;
  },

  valve_turn(ctx, out, t, r) {
    // ratchet clicks (ease in/out)
    const clicks = 7;
    for (let i = 0; i < clicks; i++) {
      const u = i / (clicks - 1);
      const tt = t + 0.6 * (0.5 - 0.5 * Math.cos(Math.PI * u)) + rrange(r, -0.006, 0.006);
      modal(ctx, out, tt, rrange(r, 1700, 2100), [[1, 0.1, 0.03], [1.7, 0.07, 0.02], [2.9, 0.03, 0.015]], { r });
      burst(ctx, out, tt, { f: 2800, Q: 1.5, t60: 0.008, peak: 0.08, r });
      tone(ctx, out, tt, { f: 260, f1: 200, glide: 0.02, t60: 0.03, peak: 0.12 });
    }
    // friction squeak
    const sq = osc(ctx, null, 620, undefined, softSaw(ctx, 20, 1.3));
    sq.frequency.setValueAtTime(620, t); sq.frequency.linearRampToValueAtTime(760, t + 0.6);
    const vib = osc(ctx, 'sine', 7); const vg = gain(ctx, 9); vib.connect(vg); vg.connect(sq.frequency);
    const bp = filt(ctx, 'bandpass', 1400, 5); const sg = gain(ctx, 0);
    sg.gain.setValueAtTime(0, t); sg.gain.linearRampToValueAtTime(0.05, t + 0.25); sg.gain.linearRampToValueAtTime(0.0, t + 0.62);
    sq.connect(bp); bp.connect(sg); sg.connect(out);
    sq.start(t); vib.start(t); sq.stop(t + 0.7); vib.stop(t + 0.7); cleanupAt(ctx, sq, [sq, vib, vg, bp, sg]);
    // seat clunk
    const tc = t + 0.68;
    tone(ctx, out, tc, { f: 150, f1: 78, glide: 0.06, t60: 0.15, peak: 0.45 });
    modal(ctx, out, tc, 255, PARTIALS.metalLow, { gain: 0.14, r });
    burst(ctx, out, tc, { kind: 'pink', type: 'lowpass', f: 900, t60: 0.06, peak: 0.25, r });
    return t + 1.4;
  },

  button_press(ctx, out, t, r) {
    burst(ctx, out, t, { f: 2200, Q: 1.2, t60: 0.01, peak: 0.3, r });
    modal(ctx, out, t + 0.001, rrange(r, 370, 400), PARTIALS.wood, { gain: 0.5, r });
    tone(ctx, out, t, { f: 160, f1: 100, glide: 0.03, t60: 0.06, peak: 0.3 });
    const tr = t + 0.11;
    burst(ctx, out, tr, { f: 3000, Q: 1.2, t60: 0.008, peak: 0.12, r });
    modal(ctx, out, tr, 520, [[1, 0.18, 0.05], [2.3, 0.05, 0.03]], { r });
    return t + 0.3;
  },

  parcel_thunk(ctx, out, t, r) {
    tone(ctx, out, t, { f: rrange(r, 90, 105), f1: 52, glide: 0.09, t60: 0.22, peak: 0.75, a: 0.002 });
    burst(ctx, out, t, { kind: 'brown', type: 'lowpass', f: 520, Q: 0.7, t60: 0.15, peak: 0.6, r });
    modal(ctx, out, t + 0.002, rrange(r, 160, 185), PARTIALS.box, { gain: 0.6, r });
    burst(ctx, out, t + 0.002, { kind: 'pink', type: 'bandpass', f: 1300, Q: 0.9, t60: 0.04, peak: 0.12, r });
    // little settle bounce
    const tb = t + rrange(r, 0.09, 0.12);
    tone(ctx, out, tb, { f: 85, f1: 60, glide: 0.05, t60: 0.1, peak: 0.2 });
    modal(ctx, out, tb, 200, PARTIALS.box, { gain: 0.15, r });
    return t + 0.5;
  },

  vesicle_bloop(ctx, out, t, r) {
    const o = osc(ctx, 'sine', 170);
    o.frequency.setValueAtTime(170, t);
    o.frequency.exponentialRampToValueAtTime(rrange(r, 500, 560), t + 0.09);
    o.frequency.exponentialRampToValueAtTime(440, t + 0.2);
    const lp = filt(ctx, 'lowpass', 400, 6);
    lp.frequency.setValueAtTime(400, t); lp.frequency.exponentialRampToValueAtTime(1800, t + 0.08); lp.frequency.exponentialRampToValueAtTime(900, t + 0.25);
    const g = gain(ctx, 0); perc(g.gain, t, 0.5, 0.012, 0.28);
    o.connect(lp); lp.connect(g); g.connect(out);
    o.start(t); o.stop(t + 0.35); cleanupAt(ctx, o, [o, lp, g]);
    // wet squelch
    burst(ctx, out, t, { kind: 'pink', type: 'bandpass', f: 300, f1: 1300, sweep: 0.08, Q: 5, a: 0.01, t60: 0.1, peak: 0.25, r });
    // pop
    bubbleAt(ctx, out, t + 0.085, rrange(r, 850, 1000), 0.22, 0.06);
    // tiny sparkle tail
    const p = pan(ctx, rrange(r, -0.4, 0.4)); p.connect(out);
    modal(ctx, p, t + 0.12, 2349, [[1, 0.05, 0.35]], { r });
    modal(ctx, p, t + 0.17, 2960, [[1, 0.035, 0.3]], { r });
    return t + 0.6;
  },

  vesicle_bud(ctx, out, t, r) {
    const o = osc(ctx, 'sine', 430);
    o.frequency.setValueAtTime(430, t); o.frequency.exponentialRampToValueAtTime(250, t + 0.24);
    const wob = osc(ctx, 'sine', 11); const wg = gain(ctx, 18); wob.connect(wg); wg.connect(o.frequency);
    const g = gain(ctx, 0);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.22, t + 0.08); g.gain.linearRampToValueAtTime(0.0, t + 0.25);
    o.connect(g); g.connect(out);
    o.start(t); wob.start(t); o.stop(t + 0.3); wob.stop(t + 0.3); cleanupAt(ctx, o, [o, wob, wg, g]);
    burst(ctx, out, t, { kind: 'pink', type: 'bandpass', f: 400, f1: 1700, sweep: 0.24, Q: 4, a: 0.12, t60: 0.15, peak: 0.12, r });
    bubbleAt(ctx, out, t + 0.25, rrange(r, 700, 820), 0.3, 0.05);
    modal(ctx, out, t + 0.26, 1760, [[1, 0.05, 0.25]], { r });
    return t + 0.55;
  },

  bubble(ctx, out, t, r, o) {
    const f0 = o.f0 || rrange(r, 380, 900);
    bubbleAt(ctx, out, t, f0, 0.4, rrange(r, 0.06, 0.1) * (600 / f0) ** 0.5);
    burst(ctx, out, t, { f: f0 * 3, Q: 2, t60: 0.006, peak: 0.03, r });
    return t + 0.18;
  },

  whoosh(ctx, out, t, r) {
    const p = pan(ctx, -0.7);
    if (p.pan) { p.pan.setValueAtTime(-0.7, t); p.pan.linearRampToValueAtTime(0.7, t + 1.2); }
    p.connect(out);
    const s = noise(ctx, 'pink', t, { r });
    const bp = filt(ctx, 'bandpass', 300, 0.9);
    bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(1500, t + 0.5); bp.frequency.exponentialRampToValueAtTime(350, t + 1.2);
    const g = gain(ctx, 0);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.5, t + 0.48); g.gain.setTargetAtTime(0, t + 0.52, 0.2);
    s.connect(bp); bp.connect(g); g.connect(p);
    const b = noise(ctx, 'brown', t, { r }); const bl = filt(ctx, 'lowpass', 260, 0.7); const bg = gain(ctx, 0);
    bg.gain.setValueAtTime(0, t); bg.gain.linearRampToValueAtTime(0.35, t + 0.5); bg.gain.setTargetAtTime(0, t + 0.55, 0.22);
    b.connect(bl); bl.connect(bg); bg.connect(p);
    const a = noise(ctx, 'white', t, { r }); const al = filt(ctx, 'bandpass', 2600, 0.8); const ag = gain(ctx, 0);
    ag.gain.setValueAtTime(0, t); ag.gain.linearRampToValueAtTime(0.025, t + 0.45); ag.gain.setTargetAtTime(0, t + 0.5, 0.15);
    a.connect(al); al.connect(ag); ag.connect(p);
    const end = t + 1.6;
    for (const n of [s, b, a]) n.stop(end);
    cleanupAt(ctx, s, [s, bp, g, b, bl, bg, a, al, ag, p]);
    return end;
  },

  zap(ctx, out, t, r) {
    const car = osc(ctx, 'triangle', 1500);
    car.frequency.setValueAtTime(1500, t); car.frequency.exponentialRampToValueAtTime(230, t + 0.14);
    const mod = osc(ctx, 'sine', 95); const mg = gain(ctx, 260);
    mg.gain.setValueAtTime(260, t); mg.gain.exponentialRampToValueAtTime(30, t + 0.15);
    mod.connect(mg); mg.connect(car.frequency);
    const lp = filt(ctx, 'lowpass', 5000, 0.7);
    const g = gain(ctx, 0); perc(g.gain, t, 0.3, 0.002, 0.2);
    car.connect(lp); lp.connect(g); g.connect(out);
    car.start(t); mod.start(t); car.stop(t + 0.3); mod.stop(t + 0.3); cleanupAt(ctx, car, [car, mod, mg, lp, g]);
    // crackle
    const s = noise(ctx, 'white', t, { r }); const bp = filt(ctx, 'bandpass', 2600, 1.3); const cg = gain(ctx, 0);
    for (let k = 0; k < 14; k++) cg.gain.setValueAtTime(r() < 0.5 ? rrange(r, 0.04, 0.12) * (1 - k / 14) : 0, t + k * 0.006);
    cg.gain.setValueAtTime(0, t + 0.09);
    s.connect(bp); bp.connect(cg); cg.connect(out); s.stop(t + 0.12); cleanupAt(ctx, s, [s, bp, cg]);
    tone(ctx, out, t, { f: 110, f1: 70, glide: 0.06, t60: 0.08, peak: 0.25 });
    return t + 0.35;
  },

  atp_pop(ctx, out, t, r) {
    bubbleAt(ctx, out, t, rrange(r, 300, 360), 0.45, 0.06);
    burst(ctx, out, t, { kind: 'pink', type: 'bandpass', f: 900, Q: 2, t60: 0.03, peak: 0.12, r });
    const scale = [1175, 1480, 1760, 2349, 2637];
    for (let i = 0; i < 4; i++) {
      const p = pan(ctx, rrange(r, -0.6, 0.6)); p.connect(out);
      modal(ctx, p, t + 0.03 + i * rrange(r, 0.03, 0.055), scale[(i + Math.floor(r() * 2)) % scale.length], [[1, 1, 0.5], [2.76, 0.22, 0.14]], { gain: 0.11, attack: 0.002, r });
    }
    return t + 0.8;
  },

  truck_honk(ctx, out, t, r) {
    const sat = ctx.createWaveShaper(); sat.curve = satCurve(ctx, 1.6);
    const bp = filt(ctx, 'bandpass', 1150, 0.9); const lp = filt(ctx, 'lowpass', 3000, 0.7);
    sat.connect(bp); bp.connect(lp); lp.connect(out);
    for (const [k, tt] of [[0, 0], [1, 0.2]]) {
      const ts = t + tt, len = k ? 0.17 : 0.12;
      const g = gain(ctx, 0); ahr(g.gain, ts, 0.3, 0.008, len, 0.04); g.connect(sat);
      const nodes = [g];
      let first;
      for (const f of [523.25, 659.25]) {
        const o = osc(ctx, null, f * 0.93, undefined, softSquare(ctx, 13, 1.3));
        o.frequency.setValueAtTime(f * 0.93, ts); o.frequency.exponentialRampToValueAtTime(f, ts + 0.025);
        o.connect(g); o.start(ts); o.stop(ts + len + 0.1); nodes.push(o); if (!first) first = o;
      }
      cleanupAt(ctx, first, nodes);
    }
    setTimeoutCleanup(ctx, t + 0.6, [sat, bp, lp]);
    return t + 0.55;
  },

  wave_hello(ctx, out, t) {
    const v = formantVoice(ctx, out, t, {
      dur: 0.48,
      f0Curve: [[0, 420], [0.1, 470], [0.15, 440], [0.2, 560], [0.32, 610], [0.46, 470]],
      vowelCurve: [[0, VOWELS.e], [0.11, VOWELS.e], [0.16, [380, 1500, 2500]], [0.22, VOWELS.o], [0.46, VOWELS.u]],
      peak: 0.3, scale: 1.25,
    });
    const g = v.sum.gain;
    g.setValueAtTime(0, t); g.linearRampToValueAtTime(0.32, t + 0.025); g.setValueAtTime(0.3, t + 0.11);
    g.linearRampToValueAtTime(0.12, t + 0.16); g.linearRampToValueAtTime(0.36, t + 0.22);
    g.setValueAtTime(0.34, t + 0.36); g.linearRampToValueAtTime(0, t + 0.48);
    v.start();
    return t + 0.6;
  },

  error_soft(ctx, out, t, r) {
    const lp = filt(ctx, 'lowpass', 1800, 0.6); lp.connect(out);
    modal(ctx, lp, t, mtof(64), PARTIALS.marimbaMuted, { gain: 0.45, attack: 0.004, r });
    modal(ctx, lp, t + 0.15, mtof(60), PARTIALS.marimbaMuted, { gain: 0.5, attack: 0.004, r });
    tone(ctx, lp, t + 0.15, { f: mtof(48), t60: 0.3, peak: 0.25, a: 0.005 });
    setTimeoutCleanup(ctx, t + 0.8, [lp]);
    return t + 0.7;
  },

  typewriter_tick(ctx, out, t, r) {
    burst(ctx, out, t, { f: rrange(r, 2800, 3600), Q: 2, t60: 0.012, peak: 0.22, r });
    modal(ctx, out, t, rrange(r, 1500, 1900), [[1, 0.12, 0.025], [2.4, 0.04, 0.015]], { r });
    return t + 0.06;
  },

  guide_blip(ctx, out, t, r, o) {
    const f0 = rpick(r, [233, 262, 294, 311, 349]) * (1 + (o.variant % 3) * 0.01);
    const vow = rpick(r, ['a', 'e', 'o', 'i', 'u']);
    const v = formantVoice(ctx, out, t, {
      dur: 0.085, f0Curve: [[0, f0], [0.08, f0 * rrange(r, 1.02, 1.08)]],
      vowelCurve: [[0, VOWELS[vow]], [0.08, VOWELS[vow]]], scale: 1.1, breath: 0.02,
    });
    const g = v.sum.gain;
    g.setValueAtTime(0, t); g.linearRampToValueAtTime(0.35, t + 0.008); g.setTargetAtTime(0, t + 0.05, 0.015);
    v.start();
    return t + 0.15;
  },
};

function setTimeoutCleanup(ctx, when, nodes) {
  // Recipes may leave shared filters connected; a silent dummy source cleans them up after `when`.
  const c = ctx.createConstantSource ? ctx.createConstantSource() : ctx.createOscillator();
  const g = ctx.createGain(); g.gain.value = 0; c.connect(g); g.connect(ctx.destination);
  c.start(when); c.stop(when + 0.01);
  c.onended = () => { for (const n of [c, g, ...nodes]) { try { n.disconnect(); } catch {} } };
}

// -------------------------------------------------------------------------------------------------
// Specs: loudness target (K-weighted short-term max, dB), variants, reverb send, final lowpass,
// polyphony and retrigger interval.

export const SPECS = {
  ui_hover:         { target: -32, variants: 3, wet: 0.05, poly: 3, minGap: 0.04 },
  ui_click:         { target: -23, variants: 3, wet: 0.06, poly: 4 },
  ui_open:          { target: -23, variants: 2, wet: 0.12, poly: 2 },
  ui_close:         { target: -24, variants: 2, wet: 0.12, poly: 2 },
  discovery_chime:  { target: -17, variants: 2, wet: 0.35, poly: 2, lp: 8000 },
  success_flourish: { target: -17, variants: 2, wet: 0.3, poly: 2, lp: 8000 },
  notebook_page:    { target: -24, variants: 3, wet: 0.06, poly: 2 },
  footstep_pave:    { target: -29, variants: 6, wet: 0.05, poly: 4, minGap: 0.06 },
  footstep_metal:   { target: -28, variants: 6, wet: 0.08, poly: 4, minGap: 0.06 },
  interact_ping:    { target: -21, variants: 2, wet: 0.2, poly: 3 },
  valve_turn:       { target: -22, variants: 2, wet: 0.12, poly: 2 },
  button_press:     { target: -22, variants: 3, wet: 0.08, poly: 3 },
  parcel_thunk:     { target: -20, variants: 4, wet: 0.12, poly: 4 },
  vesicle_bloop:    { target: -20, variants: 4, wet: 0.15, poly: 4 },
  vesicle_bud:      { target: -22, variants: 3, wet: 0.15, poly: 4 },
  bubble:           { target: -27, variants: 6, wet: 0.15, poly: 8, minGap: 0.02 },
  whoosh:           { target: -21, variants: 2, wet: 0.1, poly: 2 },
  zap:              { target: -23, variants: 3, wet: 0.12, poly: 4 },
  atp_pop:          { target: -22, variants: 4, wet: 0.2, poly: 6 },
  truck_honk:       { target: -20, variants: 2, wet: 0.12, poly: 2 },
  wave_hello:       { target: -22, variants: 2, wet: 0.08, poly: 2 },
  error_soft:       { target: -23, variants: 2, wet: 0.1, poly: 2 },
  typewriter_tick:  { target: -36, variants: 5, wet: 0.03, poly: 3, minGap: 0.025 },
  guide_blip:       { target: -26, variants: 8, wet: 0.05, poly: 3, minGap: 0.04 },
};

export const SFX_NAMES = Object.keys(SPECS);
const ALIASES = { footstep: (o) => `footstep_${o.surface === 'metal' ? 'metal' : 'pave'}` };

/**
 * Render one recipe variant into an AudioBuffer (stereo). Used by the bank and by QA.
 * Output passes through the recipe's final lowpass + a 35 Hz DC/rumble highpass.
 */
export async function renderRecipe(name, variant = 0, sampleRate = 48000, extra = {}) {
  const spec = SPECS[name] || {};
  const fn = RECIPES[name];
  const OAC = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
  // probe duration with a throwaway pass is overkill; recipes return their end, use a generous max
  const maxDur = 3.4;
  const ctx = new OAC(2, Math.ceil(maxDur * sampleRate), sampleRate);
  const lp = filt(ctx, 'lowpass', spec.lp || 9000, 0.5);
  const hp = filt(ctx, 'highpass', 35, 0.7);
  lp.connect(hp); hp.connect(ctx.destination);
  const r = mulberry32(hashStr(name) + variant * 7919);
  const end = fn(ctx, lp, 0.004, r, { variant, ...extra });
  const buf = await ctx.startRendering();
  return trimBuffer(buf, Math.min(maxDur, end + 0.05));
}

function trimBuffer(buf, seconds) {
  const sr = buf.sampleRate;
  let n = Math.min(buf.length, Math.ceil(seconds * sr));
  // trim trailing near-silence (< -80 dBFS), then a 6 ms fade
  let last = 0;
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = n - 1; i > last; i--) if (Math.abs(d[i]) > 1e-4) { last = i; break; }
  }
  n = Math.min(n, last + Math.ceil(0.01 * sr));
  const out = new AudioBuffer({ length: Math.max(n, 1), numberOfChannels: buf.numberOfChannels, sampleRate: sr });
  const fade = Math.min(n, Math.ceil(0.006 * sr));
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c).subarray(0, n);
    const o = out.getChannelData(c);
    o.set(d);
    for (let i = 0; i < fade; i++) o[n - 1 - i] *= i / fade;
  }
  return out;
}

/** Loudness normalisation: scale each variant to the spec target, peaks capped at -1.5 dBFS. */
export function normalizeVariants(name, buffers) {
  const spec = SPECS[name];
  const stats = buffers.map((b) => analyze(b, { spectrum: false }));
  const gains = stats.map((st, i) => {
    let g = dbToGain(spec.target - st.loudS);
    g = Math.min(g, dbToGain(-1.5) / dbToGain(st.peakDb));
    const b = buffers[i];
    for (let c = 0; c < b.numberOfChannels; c++) { const d = b.getChannelData(c); for (let k = 0; k < d.length; k++) d[k] *= g; }
    return g;
  });
  const gain = Math.exp(gains.reduce((a, g) => a + Math.log(g), 0) / gains.length);
  return { gain, gains, stats };
}

// Static gain hints for live fallback before pre-rendering finishes (generated by scripts/audio-qa.mjs).
export const GAIN_HINTS = {"ui_hover":0.197, "ui_click":0.585, "ui_open":0.447, "ui_close":0.507, "discovery_chime":0.578, "success_flourish":0.442, "notebook_page":2.404, "footstep_pave":0.502, "footstep_metal":0.548, "interact_ping":0.341, "valve_turn":0.718, "button_press":0.712, "parcel_thunk":0.474, "vesicle_bloop":0.541, "vesicle_bud":0.612, "bubble":0.645, "whoosh":0.811, "zap":0.808, "atp_pop":0.767, "truck_honk":0.226, "wave_hello":0.267, "error_soft":0.31, "typewriter_tick":0.918, "guide_blip":0.693};

// -------------------------------------------------------------------------------------------------

export function createSfx(engine, { prerender = true } = {}) {
  const ctx = engine.ctx;
  const bank = new Map(); // name -> { buffers, gain }
  const lastPlay = new Map();
  const lastVariant = new Map();
  const voices = new Map(); // name -> [{src, end}]
  let footParity = 0;
  let resolveReady;
  const ready = new Promise((r) => (resolveReady = r));

  const stats = { prerenderMs: 0 };
  async function prerenderAll() {
    const t0 = performance.now();
    // UI first (title screen), the rest after
    const order = [...SFX_NAMES].sort((a, b) => (b.startsWith('ui_') ? 1 : 0) - (a.startsWith('ui_') ? 1 : 0));
    for (const name of order) {
      try {
        const n = SPECS[name].variants;
        const bufs = await Promise.all(Array.from({ length: n }, (_, v) => renderRecipe(name, v, ctx.sampleRate)));
        const { gain: g } = normalizeVariants(name, bufs);
        bank.set(name, { buffers: bufs, gain: g });
      } catch (e) { console.warn('[sfx] prerender failed', name, e); }
      await new Promise((r) => setTimeout(r, 0)); // keep the main thread responsive
    }
    stats.prerenderMs = performance.now() - t0;
    resolveReady();
  }
  if (prerender) prerenderAll(); else resolveReady();

  function pickVariant(name, n) {
    if (name.startsWith('footstep')) { footParity ^= 1; const k = Math.floor(Math.random() * (n / 2)) * 2 + footParity; return k % n; }
    let v = Math.floor(Math.random() * n);
    if (n > 1 && v === lastVariant.get(name)) v = (v + 1) % n;
    lastVariant.set(name, v);
    return v;
  }

  function route(src, { position, volume = 1, pan: p, wet }, spec) {
    const g = gain(ctx, volume);
    src.connect(g);
    let head = g; const nodes = [src, g];
    if (position) {
      const pn = engine.createPanner(position); g.connect(pn); head = pn; nodes.push(pn);
    } else if (p) {
      const sp = pan(ctx, p); g.connect(sp); head = sp; nodes.push(sp);
    }
    head.connect(engine.sfxBus);
    const w = wet ?? spec.wet ?? 0.08;
    if (w > 0) { const wg = gain(ctx, w); g.connect(wg); wg.connect(engine.sends.sfx); nodes.push(wg); }
    return nodes;
  }

  function trackVoice(name, src, end, spec) {
    let list = voices.get(name);
    if (!list) voices.set(name, (list = []));
    const now = ctx.currentTime;
    for (let i = list.length - 1; i >= 0; i--) if (list[i].end < now) list.splice(i, 1);
    while (list.length >= (spec.poly || 4)) {
      const old = list.shift();
      try { old.gainNode.gain.setTargetAtTime(0, now, 0.01); old.src.stop(now + 0.05); } catch {}
    }
    list.push({ src, end, gainNode: src._g });
  }

  /**
   * Play a sound. opts: { position?, volume?=1, pitch?=1 (rate multiplier), pan?, wet?, surface?, delay? }
   * Returns { stop(fade), source } or null when rate-limited / unknown.
   */
  function play(name, opts = {}) {
    const key = ALIASES[name] ? ALIASES[name](opts) : name;
    const spec = SPECS[key];
    if (!spec) { console.warn('[sfx] unknown sound', name); return null; }
    const now = ctx.currentTime;
    if (spec.minGap && now - (lastPlay.get(key) ?? -1) < spec.minGap) return null;
    lastPlay.set(key, now);
    const t = now + (opts.delay || 0);
    const entry = bank.get(key);
    const pitch = (opts.pitch ?? 1) * (1 + (Math.random() - 0.5) * 0.03);
    if (entry) {
      const n = entry.buffers.length;
      const src = ctx.createBufferSource();
      src.buffer = entry.buffers[pickVariant(key, n)];
      src.playbackRate.value = pitch;
      const nodes = route(src, opts, spec);
      src._g = nodes[1];
      src.onended = () => { for (const x of nodes) { try { x.disconnect(); } catch {} } };
      src.start(t);
      trackVoice(key, src, t + src.buffer.duration / pitch, spec);
      return { source: src, stop: (fade = 0.05) => { try { nodes[1].gain.setTargetAtTime(0, ctx.currentTime, fade / 3); src.stop(ctx.currentTime + fade + 0.02); } catch {} } };
    }
    // live fallback (pre-render still running)
    const g = gain(ctx, GAIN_HINTS[key] ?? 0.5);
    const nodes = route(g, opts, spec);
    const r = mulberry32((Math.random() * 1e9) | 0);
    const end = RECIPES[key](ctx, g, t + 0.005, r, { variant: Math.floor(Math.random() * spec.variants) });
    const killer = ctx.createConstantSource(); const kg = gain(ctx, 0); killer.connect(kg); kg.connect(ctx.destination);
    killer.start(t); killer.stop(end + 0.1);
    killer.onended = () => { for (const x of [...nodes, killer, kg]) { try { x.disconnect(); } catch {} } };
    return { source: null, stop: (fade = 0.05) => g.gain.setTargetAtTime(0, ctx.currentTime, fade / 3) };
  }

  return {
    play,
    ready,
    stats,
    names: SFX_NAMES.filter((n) => !n.startsWith('footstep_')).concat('footstep'),
    isReady: (name) => bank.has(name),
    /** Normalisation gains actually applied (for QA). */
    gains: () => Object.fromEntries([...bank].map(([k, v]) => [k, v.gain])),
  };
}
