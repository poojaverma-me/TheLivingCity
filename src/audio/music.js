// Generative ambient score: warm pads, mallet/celesta motifs, bells, soft bass, ping-pong delay.
//
//   const music = createMusic(audio);
//   music.start();               // after audio.resume()
//   music.setMood('golgi');      // 'explore' | 'nucleus' | 'mito' | 'golgi' | 'calm' | 'wonder'
//   music.duck(0.6, 0.4);        // manual duck (dialogue ducking is automatic via the engine)
//   music.stop();
//
// The score is planned one chord at a time (~6-9 s) with a lookahead timer. Mood changes crossfade
// instrument levels immediately (slow ramps) and switch tempo / key / progression at the next chord.

import { mtof, mulberry32, rrange, rpick, clamp, gain, filt, osc, perc, ahr, modal, softSaw, PARTIALS } from './dsp.js';

// Chord shapes: root (semitones above key) + voicing intervals above that root
const CH = {
  I: [0, [0, 7, 11, 14, 16]],        // Imaj9
  I6: [0, [0, 4, 9, 14, 19]],        // I6/9
  ii: [2, [0, 7, 10, 14, 15]],       // ii9
  II: [2, [0, 4, 7, 14, 18]],        // II(add9) - lydian colour
  iii: [4, [0, 7, 10, 15, 19]],      // iii7
  IV: [5, [0, 7, 11, 16, 19]],       // IVmaj7
  IVs: [5, [0, 7, 11, 16, 18]],      // IVmaj7#11
  V: [7, [0, 7, 9, 14, 16]],         // V6/9
  vi: [9, [0, 7, 10, 14, 15]],       // vi9
};
const PROGS = {
  main: [['I', 'vi', 'IV', 'V'], ['IV', 'V', 'iii', 'vi'], ['I', 'IVs', 'vi', 'V'], ['vi', 'IV', 'I', 'V']],
  lydian: [['I', 'II', 'I', 'II'], ['I', 'II', 'vi', 'IVs'], ['IVs', 'I', 'II', 'I6']],
  calm: [['I', 'IV', 'I', 'vi'], ['IV', 'I6', 'vi', 'IVs']],
  bright: [['I', 'V', 'vi', 'IV'], ['IV', 'V', 'I6', 'vi'], ['I', 'iii', 'IV', 'V']],
};

// Mood parameters (levels are relative instrument-bus gains)
export const MOODS = {
  explore: { key: 2, bpm: 70, prog: 'main', beats: 8, padCut: 1150, pad: 1, mallet: 0.9, inst: 'marimba', bell: 0.35, bass: 0.7, arp: 0, density: 0.42, register: 74 },
  nucleus: { key: 5, bpm: 62, prog: 'lydian', beats: 8, padCut: 950, pad: 1, mallet: 0.75, inst: 'celesta', bell: 0.6, bass: 0.5, arp: 0.25, density: 0.34, register: 77 },
  mito:    { key: 2, bpm: 82, prog: 'bright', beats: 8, padCut: 1300, pad: 0.85, mallet: 0.8, inst: 'marimba', bell: 0.25, bass: 0.85, arp: 0.7, density: 0.5, register: 72 },
  golgi:   { key: 7, bpm: 78, prog: 'bright', beats: 8, padCut: 1200, pad: 0.85, mallet: 1, inst: 'kalimba', bell: 0.3, bass: 0.8, arp: 0.3, density: 0.55, register: 74 },
  calm:    { key: 5, bpm: 56, prog: 'calm', beats: 8, padCut: 780, pad: 1.05, mallet: 0.55, inst: 'vibes', bell: 0.2, bass: 0.45, arp: 0, density: 0.2, register: 72 },
  wonder:  { key: 2, bpm: 60, prog: 'lydian', beats: 8, padCut: 1600, pad: 1, mallet: 0.7, inst: 'celesta', bell: 0.9, bass: 0.55, arp: 0.2, density: 0.3, register: 79 },
};
export const MOOD_NAMES = Object.keys(MOODS);

const INST = {
  marimba: { partials: PARTIALS.marimba, gain: 0.2, attack: 0.002 },
  celesta: { partials: PARTIALS.celesta, gain: 0.15, attack: 0.004 },
  kalimba: { partials: PARTIALS.kalimba, gain: 0.18, attack: 0.002 },
  vibes: { partials: PARTIALS.vibes, gain: 0.15, attack: 0.004 },
};

/**
 * The score itself; works on any BaseAudioContext. `out` receives the dry mix, `wetOut` the reverb send.
 */
export class Score {
  constructor(ctx, out, wetOut, { seed = 9, mood = 'explore' } = {}) {
    this.ctx = ctx; this.r = mulberry32(seed);
    this.mood = MOODS[mood] ? mood : 'explore';
    this.p = { ...MOODS[this.mood] };
    this.out = out; this.wetOut = wetOut;
    this.nextChord = 0; this.chordIdx = 0; this.prog = PROGS[this.p.prog][0];
    this.motif = null; this.lastPitch = this.p.register; this.energy = 0.6;
    this.live = new Set();
    this.persist = [];

    const c = ctx;
    // instrument buses
    this.bus = {};
    for (const k of ['pad', 'mallet', 'bell', 'bass', 'arp']) { this.bus[k] = gain(c, 0); }
    // pad: stereo chorus (two modulated delays panned L/R)
    const padSum = gain(c, 1);
    this.bus.pad.connect(padSum);
    const merger = c.createChannelMerger(2);
    [[0.0071, 0.0019, 0.13, 0], [0.0109, 0.0023, 0.171, 1]].forEach(([d, depth, rate, ch]) => {
      const dl = c.createDelay(0.05); dl.delayTime.value = d;
      const l = osc(c, 'sine', rate, 0); this.persist.push(l); const lg = gain(c, depth); l.connect(lg); lg.connect(dl.delayTime);
      padSum.connect(dl); dl.connect(merger, 0, ch);
      padSum.connect(merger, 0, ch);
    });
    merger.connect(out);
    const padWet = gain(c, 0.55); merger.connect(padWet); padWet.connect(wetOut);
    // mallets / arp: ping-pong delay + reverb
    const pp = this._pingPong(); this.delayIn = pp.input; this.delayTimes = pp.times;
    for (const k of ['mallet', 'arp']) {
      this.bus[k].connect(out);
      const s = gain(c, k === 'mallet' ? 0.3 : 0.2); this.bus[k].connect(s); s.connect(pp.input);
      const w = gain(c, 0.35); this.bus[k].connect(w); w.connect(wetOut);
    }
    pp.output.connect(out);
    const ppw = gain(c, 0.3); pp.output.connect(ppw); ppw.connect(wetOut);
    this.bus.bell.connect(out); const bw = gain(c, 0.9); this.bus.bell.connect(bw); bw.connect(wetOut);
    this.bus.bass.connect(out);
    this._applyMood(0, 0.01);
  }

  _pingPong() {
    const c = this.ctx;
    const input = gain(c, 1), output = gain(c, 1);
    const hp = filt(c, 'highpass', 350, 0.7), lp = filt(c, 'lowpass', 2600, 0.6);
    const dL = c.createDelay(2), dR = c.createDelay(2);
    const fb = gain(c, 0.38);
    const merger = c.createChannelMerger(2);
    input.connect(hp); hp.connect(lp); lp.connect(dL);
    dL.connect(dR); dR.connect(fb); fb.connect(dL);
    dL.connect(merger, 0, 0); dR.connect(merger, 0, 1);
    merger.connect(output);
    return { input, output, times: [dL.delayTime, dR.delayTime] };
  }

  _applyMood(t, tc = 2.5) {
    const p = this.p;
    const lv = { pad: 0.8 * p.pad, mallet: 1.6 * p.mallet, bell: 2.4 * p.bell, bass: 0.45 * p.bass, arp: 4 * p.arp };
    for (const k of Object.keys(lv)) this.bus[k].gain.setTargetAtTime(lv[k], t, tc);
    const beat = 60 / p.bpm;
    for (const d of this.delayTimes) d.setTargetAtTime(beat * 0.75, t, 0.5);
  }

  setMood(name, t = this.ctx.currentTime) {
    if (!MOODS[name] || name === this.mood) return;
    this.mood = name;
    this.pendingMood = { ...MOODS[name] };
    // levels start crossfading now; harmony/tempo switch at the next chord boundary
    const old = this.p; this.p = { ...old, pad: this.pendingMood.pad, mallet: this.pendingMood.mallet, bell: this.pendingMood.bell, bass: this.pendingMood.bass, arp: this.pendingMood.arp };
    this._applyMood(t, 3);
  }

  /** Schedule everything that starts before `until`. */
  scheduleUntil(until) {
    if (!this.nextChord) this.nextChord = this.ctx.currentTime + 0.1;
    while (this.nextChord < until) this._chord(this.nextChord);
  }

  _chord(t) {
    if (this.pendingMood) {
      const keyChanged = this.pendingMood.key !== this.p.key || this.pendingMood.prog !== this.p.prog;
      this.p = this.pendingMood; this.pendingMood = null;
      this._applyMood(t, 3);
      if (keyChanged) { this.chordIdx = 0; this.prog = rpick(this.r, PROGS[this.p.prog]); }
    }
    const r = this.r, p = this.p;
    if (this.chordIdx >= this.prog.length) { this.chordIdx = 0; this.prog = rpick(r, PROGS[p.prog]); }
    const [root, ivs] = CH[this.prog[this.chordIdx++]];
    const beat = 60 / p.bpm;
    const dur = beat * p.beats;
    let rootMidi = 48 + ((p.key + root) % 12);
    if (rootMidi < 50) rootMidi += 12;           // D3..C#4 region
    this.energy = clamp(this.energy + rrange(r, -0.25, 0.25), 0.15, 1);

    this._pad(t, dur, rootMidi, ivs);
    if (p.bass > 0) this._bass(t, dur, rootMidi - 24, beat);
    this._melody(t, beat, rootMidi, ivs);
    if (p.arp > 0) this._arp(t, beat, rootMidi, ivs);
    if (r() < 0.25 + p.bell * 0.6) this._bells(t, dur, rootMidi);
    this.nextChord = t + dur;
  }

  _track(src, end) {
    this.live.add(src);
    const prev = src.onended;
    src.onended = (e) => { this.live.delete(src); if (prev) prev(e); };
  }

  _pad(t, dur, rootMidi, ivs) {
    const c = this.ctx, p = this.p;
    const a = Math.min(3, dur * 0.4), rel = 3.5;
    const lp = filt(c, 'lowpass', p.padCut * 0.6, 0.9);
    lp.frequency.setValueAtTime(p.padCut * 0.6, t);
    lp.frequency.linearRampToValueAtTime(p.padCut * rrange(this.r, 1.0, 1.25), t + dur * 0.55);
    lp.frequency.linearRampToValueAtTime(p.padCut * 0.75, t + dur + rel);
    const lp2 = filt(c, 'lowpass', p.padCut * 2.2, 0.5);
    const g = gain(c, 0);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.055, t + a);
    g.gain.setValueAtTime(0.055, t + dur);
    g.gain.setTargetAtTime(0, t + dur, rel / 4);
    lp.connect(lp2); lp2.connect(g); g.connect(this.bus.pad);
    const end = t + dur + rel * 1.4;
    const nodes = [lp, lp2, g];
    let first;
    ivs.forEach((iv, i) => {
      const f = mtof(rootMidi + iv);
      const amp = i === 0 ? 0.8 : 1 - i * 0.08;
      for (const det of [-7, 6]) {
        const o = osc(c, null, f, undefined, softSaw(c, 28, 1.3));
        o.detune.value = det + rrange(this.r, -2, 2);
        const og = gain(c, amp * 0.5); o.connect(og); og.connect(lp);
        o.start(t); o.stop(end); nodes.push(o, og);
        if (!first) first = o;
        this._track(o, end);
      }
      // airy octave sine on top two notes
      if (i >= ivs.length - 2) {
        const s = osc(c, 'sine', f * 2); const sg = gain(c, 0.08); s.connect(sg); sg.connect(g);
        s.start(t); s.stop(end); nodes.push(s, sg); this._track(s, end);
      }
    });
    first.onended = ((prev) => (e) => { prev && prev(e); for (const n of nodes) { try { n.disconnect(); } catch {} } })(first.onended);
  }

  _bass(t, dur, midi, beat) {
    const c = this.ctx, r = this.r;
    const hits = r() < 0.5 ? [[0, dur * 0.95]] : [[0, beat * 4.5], [beat * 5, dur - beat * 5]];
    for (const [off, len] of hits) {
      const m = off === 0 ? midi : midi + 7;
      const tt = t + off;
      const o = osc(c, 'sine', mtof(m)); const o2 = osc(c, 'triangle', mtof(m));
      const g = gain(c, 0); const g2 = gain(c, 0.5);
      ahr(g.gain, tt, 0.16, 0.06, len * 0.5, len * 0.5);
      o.connect(g); o2.connect(g2); g2.connect(g); const lp = filt(c, 'lowpass', 400, 0.7); g.connect(lp); lp.connect(this.bus.bass);
      const end = tt + len + 0.8;
      o.start(tt); o2.start(tt); o.stop(end); o2.stop(end);
      this._track(o, end);
      o.onended = ((prev) => (e) => { prev && prev(e); for (const n of [o, o2, g, g2, lp]) { try { n.disconnect(); } catch {} } })(o.onended);
    }
  }

  _scale() {
    const p = this.p;
    const lyd = p.prog === 'lydian';
    // major pentatonic (+ #4 in lydian moods)
    const base = lyd ? [0, 2, 4, 6, 7, 9, 11] : [0, 2, 4, 7, 9];
    const out = [];
    for (let m = p.register - 10; m <= p.register + 14; m++) if (base.includes(((m - p.key) % 12 + 12) % 12)) out.push(m);
    return out;
  }

  _melody(t, beat, rootMidi, ivs) {
    const r = this.r, p = this.p;
    const density = p.density * (0.5 + this.energy * 0.7);
    if (r() < 0.18) return;                                // breathing room: some chords have no melody
    const scale = this._scale();
    const chordPcs = ivs.map((iv) => (rootMidi + iv) % 12);
    const steps = p.beats * 2;                             // eighth grid
    // motif: reuse (varied) or invent
    if (!this.motif || r() < 0.35) {
      const len = 3 + Math.floor(r() * 4);
      const motif = []; let pos = Math.floor(r() * 3);
      for (let i = 0; i < len && pos < steps; i++) {
        motif.push({ step: pos, move: Math.round(rrange(r, -2.4, 2.4)), vel: rrange(r, 0.6, 1) });
        pos += rpick(r, [1, 2, 2, 3, 4]);
      }
      this.motif = motif;
    }
    let idx = scale.indexOf(this.nearest(scale, this.lastPitch));
    const inst = INST[p.inst];
    const startOff = r() < 0.5 ? 0 : steps / 2;
    for (const n of this.motif) {
      if (r() > 0.55 + density) continue;               // thin out
      let step = (n.step + startOff) % steps;
      let move = n.move + (r() < 0.25 ? rpick(r, [-1, 1]) : 0);
      idx = clamp(idx + move, 0, scale.length - 1);
      let m = scale[idx];
      if (step % 4 === 0) {                             // strong beat -> snap to nearest chord tone
        const ct = scale.filter((x) => chordPcs.includes(x % 12));
        if (ct.length) { m = this.nearest(ct, m); idx = scale.indexOf(m); }
      }
      const swing = step % 2 ? beat * 0.06 : 0;
      const tt = t + step * beat * 0.5 + swing + rrange(r, 0, 0.012);
      this._mallet(tt, m, n.vel * rrange(r, 0.75, 1), inst);
      this.lastPitch = m;
      // occasional grace / echo note an octave up
      if (r() < 0.1) this._mallet(tt + beat * 0.25, m + 12, n.vel * 0.35, inst);
    }
    // second half answer phrase (inverted motif)
    if (r() < density) {
      for (const n of this.motif.slice(0, 3)) {
        const step = (n.step + steps / 2 + 1) % steps;
        idx = clamp(idx - n.move, 0, scale.length - 1);
        const tt = t + step * beat * 0.5 + rrange(r, 0, 0.012);
        this._mallet(tt, scale[idx], n.vel * 0.7, inst);
      }
    }
  }

  nearest(arr, m) { let b = arr[0]; for (const x of arr) if (Math.abs(x - m) < Math.abs(b - m)) b = x; return b; }

  _mallet(t, midi, vel, inst) {
    const c = this.ctx;
    const g = gain(c, 1); g.connect(this.bus.mallet);
    const end = modal(c, g, t, mtof(midi), inst.partials, { gain: inst.gain * vel, attack: inst.attack, maxFreq: 6500, r: this.r });
    // soft mallet "felt" thump
    const n = osc(c, 'sine', mtof(midi) * 0.5); const ng = gain(c, 0); perc(ng.gain, t, 0.03 * vel, 0.002, 0.05);
    n.connect(ng); ng.connect(g); n.start(t); n.stop(t + 0.1);
    this._timer(end, [g, n, ng]);
  }

  _arp(t, beat, rootMidi, ivs) {
    const c = this.ctx, r = this.r, p = this.p;
    const notes = ivs.map((iv) => rootMidi + 12 + iv).filter((m) => m < 86);
    const pattern = rpick(r, [[0, 1, 2, 3], [0, 2, 1, 3], [0, 1, 2, 1], [3, 2, 1, 0]]);
    const steps = p.beats * 2;
    for (let s = 0; s < steps; s++) {
      if (r() < 0.25) continue;
      const m = notes[pattern[s % pattern.length] % notes.length];
      const tt = t + s * beat * 0.5;
      const o = osc(c, 'triangle', mtof(m)); const lp = filt(c, 'lowpass', 1800, 2);
      lp.frequency.setValueAtTime(2600, tt); lp.frequency.exponentialRampToValueAtTime(500, tt + 0.25);
      const g = gain(c, 0); perc(g.gain, tt, 0.06 * (s % 4 === 0 ? 1 : 0.7), 0.004, 0.35);
      o.connect(lp); lp.connect(g); g.connect(this.bus.arp);
      o.start(tt); o.stop(tt + 0.45);
      this._track(o, tt + 0.45);
      o.onended = ((prev) => (e) => { prev && prev(e); for (const n of [o, lp, g]) { try { n.disconnect(); } catch {} } })(o.onended);
    }
  }

  _bells(t, dur, rootMidi) {
    const r = this.r, c = this.ctx;
    const scale = this._scale().map((m) => m + 12).filter((m) => m <= 96);
    const k = 1 + Math.floor(r() * 3);
    for (let i = 0; i < k; i++) {
      const tt = t + rrange(r, 0.2, dur * 0.9);
      const g = gain(c, 1); g.connect(this.bus.bell);
      const end = modal(c, g, tt, mtof(rpick(r, scale)), PARTIALS.glock, { gain: 0.05 * rrange(r, 0.5, 1), attack: 0.003, maxFreq: 6500, r });
      this._timer(end, [g]);
    }
  }

  _timer(end, nodes) {
    const c = this.ctx;
    const s = c.createConstantSource(); const z = gain(c, 0); s.connect(z); z.connect(c.destination);
    s.start(end); s.stop(end + 0.01);
    s.onended = () => { for (const n of [s, z, ...nodes]) { try { n.disconnect(); } catch {} } };
  }

  /** Stop every scheduled/playing source at time t. */
  kill(t) {
    for (const s of this.live) { try { s.stop(t); } catch {} }
    this.live.clear();
    for (const s of this.persist) { try { s.stop(t + 4); } catch {} }
  }
}

export function createMusic(engine, { mood = 'explore', seed } = {}) {
  const ctx = engine.ctx;
  const out = gain(ctx, 0);
  const wet = gain(ctx, 0);
  out.connect(engine.musicBus);
  wet.connect(engine.sends.music);
  let score = null, timer = null, currentMood = mood, playing = false;

  const LOOKAHEAD = 1.5;
  function pump() {
    if (!score) return;
    score.scheduleUntil(ctx.currentTime + LOOKAHEAD);
  }

  return {
    start(fade = 5) {
      if (playing) return;
      playing = true;
      const t = ctx.currentTime;
      const s = new Score(ctx, gain(ctx, 1), gain(ctx, 1), { seed: seed ?? (Math.random() * 1e9) | 0, mood: currentMood });
      // route through per-score gains so an old score can fade independently
      s.out.connect(out); s.wetOut.connect(wet);
      score = s;
      for (const g of [out, wet]) { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(1, t + fade); }
      s.nextChord = t + 0.15;
      pump();
      timer = setInterval(pump, 200);
    },
    stop(fade = 3) {
      if (!playing) return;
      playing = false;
      clearInterval(timer); timer = null;
      const t = ctx.currentTime, s = score; score = null;
      for (const g of [out, wet]) { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0, t + fade); }
      s.kill(t + fade + 0.05);
      setTimeout(() => { try { s.out.disconnect(); s.wetOut.disconnect(); } catch {} }, (fade + 4.5) * 1000);
    },
    setMood(name) {
      if (!MOODS[name]) { console.warn('[music] unknown mood', name); return; }
      currentMood = name;
      if (score) score.setMood(name);
    },
    get mood() { return currentMood; },
    get playing() { return playing; },
    /** Manual duck hook (delegates to the engine's music duck). */
    duck(amount = 0.6, time = 0.35) { engine.duck(amount, time); },
    moods: MOOD_NAMES,
  };
}
