// Shared DSP helpers for the procedural audio system.
// Everything here works on any BaseAudioContext (realtime AudioContext or OfflineAudioContext),
// so the same recipes can be pre-rendered, played live, or analysed by the QA harness.

export const TAU = Math.PI * 2;
export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
export const dbToGain = (db) => Math.pow(10, db / 20);
export const gainToDb = (g) => 20 * Math.log10(Math.max(1e-12, g));
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;

/** Small fast seeded PRNG -> function returning [0,1). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export const rrange = (r, a, b) => a + (b - a) * r();
export const rpick = (r, arr) => arr[Math.floor(r() * arr.length) % arr.length];

// ---------------------------------------------------------------------------------------------
// Per-context caches (noise buffers, periodic waves, curves)
const caches = new WeakMap();
function bank(ctx) {
  let b = caches.get(ctx);
  if (!b) { b = {}; caches.set(ctx, b); }
  return b;
}

/**
 * Cached stereo noise buffer. kind: 'white' | 'pink' | 'brown'. Normalised to ~0.25 RMS.
 * The loop seam is crossfaded so looping brown noise has no step.
 */
export function noiseBuffer(ctx, kind = 'white', seconds = 6) {
  const b = bank(ctx);
  const key = `noise_${kind}_${seconds}`;
  if (b[key]) return b[key];
  const sr = ctx.sampleRate;
  const n = Math.floor(sr * seconds);
  const buf = ctx.createBuffer(2, n, sr);
  for (let ch = 0; ch < 2; ch++) {
    const r = mulberry32(hashStr(key) + ch * 977);
    const d = buf.getChannelData(ch);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
    for (let i = 0; i < n; i++) {
      const w = r() * 2 - 1;
      if (kind === 'white') d[i] = w;
      else if (kind === 'pink') {
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362; b6 = w * 0.115926;
      } else {
        last = (last + 0.02 * w) / 1.02; d[i] = last;
      }
    }
    // remove DC, crossfade seam, normalise
    let mean = 0; for (let i = 0; i < n; i++) mean += d[i]; mean /= n;
    for (let i = 0; i < n; i++) d[i] -= mean;
    const xf = Math.floor(sr * 0.08);
    for (let i = 0; i < xf; i++) {
      const t = i / xf;
      const a = d[n - xf + i], c = d[i];
      d[n - xf + i] = a * Math.cos(t * Math.PI / 2) + c * Math.sin(t * Math.PI / 2);
    }
    let ss = 0; for (let i = 0; i < n; i++) ss += d[i] * d[i];
    const g = 0.25 / Math.sqrt(ss / n);
    for (let i = 0; i < n; i++) d[i] *= g;
  }
  b[key] = buf;
  return buf;
}

/** Started noise source. Returns the AudioBufferSourceNode (looping). */
export function noise(ctx, kind, t, { loop = true, rate = 1, r = Math.random } = {}) {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuffer(ctx, kind);
  s.loop = loop;
  s.playbackRate.value = rate;
  s.start(t, r() * (s.buffer.duration - 0.5));
  return s;
}

/** Soft sawtooth: harmonics rolled off faster than 1/n so pads stay warm, band-limited. */
export function softSaw(ctx, n = 28, tilt = 1.25) {
  const b = bank(ctx); const key = `softsaw_${n}_${tilt}`;
  if (b[key]) return b[key];
  const re = new Float32Array(n + 1), im = new Float32Array(n + 1);
  for (let k = 1; k <= n; k++) im[k] = (1 / Math.pow(k, tilt)) * (k > n * 0.6 ? 1 - (k - n * 0.6) / (n * 0.4) : 1);
  return (b[key] = ctx.createPeriodicWave(re, im));
}
/** Soft square (odd harmonics only, gentle rolloff). */
export function softSquare(ctx, n = 15, tilt = 1.4) {
  const b = bank(ctx); const key = `softsq_${n}_${tilt}`;
  if (b[key]) return b[key];
  const re = new Float32Array(n + 1), im = new Float32Array(n + 1);
  for (let k = 1; k <= n; k += 2) im[k] = 1 / Math.pow(k, tilt);
  return (b[key] = ctx.createPeriodicWave(re, im));
}
/** Engine-like wave: strong low harmonics 2..6 for a small motor "brrr". */
export function engineWave(ctx) {
  const b = bank(ctx); const key = 'enginewave';
  if (b[key]) return b[key];
  const amps = [0, 0.6, 1, 0.8, 0.55, 0.45, 0.3, 0.2, 0.14, 0.1, 0.07, 0.05, 0.03];
  const re = new Float32Array(amps.length), im = new Float32Array(amps);
  re[3] = 0.4; re[5] = 0.25;
  return (b[key] = ctx.createPeriodicWave(re, im));
}

/** tanh-style saturation curve (cached). */
export function satCurve(ctx, drive = 1.5) {
  const b = bank(ctx); const key = `sat_${drive}`;
  if (b[key]) return b[key];
  const n = 2048, c = new Float32Array(n), norm = Math.tanh(drive);
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(x * drive) / norm; }
  return (b[key] = c);
}

// ---------------------------------------------------------------------------------------------
// Node helpers

export function gain(ctx, v = 1) { const g = ctx.createGain(); g.gain.value = v; return g; }
export function filt(ctx, type, f, Q = 0.707, g = 0) {
  const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = Q; b.gain.value = g; return b;
}
export function pan(ctx, p = 0) {
  if (!ctx.createStereoPanner) return gain(ctx, 1);
  const s = ctx.createStereoPanner(); s.pan.value = clamp(p, -1, 1); return s;
}
export function osc(ctx, type, f, t, wave) {
  const o = ctx.createOscillator();
  if (wave) o.setPeriodicWave(wave); else o.type = type;
  o.frequency.value = f;
  if (t !== undefined) o.start(t);
  return o;
}
/** Disconnect a list of nodes after `when` (context time) - keeps long sessions free of dead nodes. */
export function cleanupAt(ctx, src, nodes) {
  src.onended = () => { for (const n of nodes) { try { n.disconnect(); } catch {} } };
}

/**
 * Percussive envelope on an AudioParam: 0 -> peak in `a`, then exponential decay with T60 = `t60`.
 */
export function perc(param, t, peak, a, t60) {
  param.setValueAtTime(0, t);
  param.linearRampToValueAtTime(peak, t + Math.max(0.0005, a));
  param.setTargetAtTime(0, t + a, Math.max(0.001, t60 / 6.9));
}
/** Attack / hold / release envelope (linear attack, smooth exponential release). */
export function ahr(param, t, peak, a, h, rel) {
  param.setValueAtTime(0, t);
  param.linearRampToValueAtTime(peak, t + a);
  param.setValueAtTime(peak, t + a + h);
  param.setTargetAtTime(0, t + a + h, Math.max(0.001, rel / 5));
}

/**
 * Modal synthesis: sum of decaying sine partials. partials: [ratio, amp, t60][]
 * Partials above maxFreq are skipped (keeps the top end soft and alias-free).
 * Returns the end time.
 */
export function modal(ctx, out, t, f0, partials, { gain: g0 = 1, attack = 0.0015, maxFreq = 7200, detune = 0, r } = {}) {
  let end = t;
  for (const p of partials) {
    const [ratio, amp, t60] = p;
    const f = f0 * ratio;
    if (f > maxFreq || f > ctx.sampleRate * 0.45) continue;
    const o = ctx.createOscillator();
    o.frequency.value = f * (1 + (r ? (r() - 0.5) * 0.002 : 0));
    if (detune) o.detune.value = detune;
    const g = ctx.createGain();
    g.gain.value = 0;
    perc(g.gain, t, amp * g0, attack, t60);
    o.connect(g); g.connect(out);
    const stop = t + attack + t60 * 1.05 + 0.02;
    o.start(t); o.stop(stop);
    cleanupAt(ctx, o, [o, g]);
    end = Math.max(end, stop);
  }
  return end;
}

/** Filtered noise burst. Returns end time. */
export function burst(ctx, out, t, { kind = 'white', type = 'bandpass', f = 2000, Q = 1, f1, a = 0.001, t60 = 0.05, peak = 0.3, sweep, r } = {}) {
  const s = noise(ctx, kind, t, { r });
  const bf = filt(ctx, type, f, Q);
  if (f1) bf.frequency.exponentialRampToValueAtTime(f1, t + (sweep || t60));
  const g = gain(ctx, 0);
  perc(g.gain, t, peak, a, t60);
  s.connect(bf); bf.connect(g); g.connect(out);
  const stop = t + a + t60 * 1.05 + 0.02;
  s.stop(stop);
  cleanupAt(ctx, s, [s, bf, g]);
  return stop;
}

/** Pitched tone with optional glide, filter and percussive envelope. */
export function tone(ctx, out, t, { type = 'sine', wave, f = 440, f1, glide = 0.05, a = 0.003, t60 = 0.2, peak = 0.3, lp } = {}) {
  const o = osc(ctx, type, f, undefined, wave);
  if (f1) { o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f1, t + glide); }
  const g = gain(ctx, 0);
  perc(g.gain, t, peak, a, t60);
  let head = o;
  const nodes = [o, g];
  if (lp) { const l = filt(ctx, 'lowpass', lp, 0.7); o.connect(l); head = l; nodes.push(l); }
  head.connect(g); g.connect(out);
  const stop = t + a + t60 * 1.05 + 0.02;
  o.start(t); o.stop(stop);
  cleanupAt(ctx, o, nodes);
  return stop;
}

// Partial sets (ratio, relative amp, T60 seconds)
export const PARTIALS = {
  marimba: [[1, 1, 0.9], [3.93, 0.22, 0.2], [9.24, 0.05, 0.06]],
  marimbaMuted: [[1, 1, 0.35], [3.93, 0.12, 0.08]],
  celesta: [[1, 1, 1.7], [2, 0.16, 0.7], [3, 0.06, 0.35], [4.16, 0.025, 0.2]],
  vibes: [[1, 1, 2.4], [4, 0.18, 0.6], [10, 0.03, 0.12]],
  kalimba: [[1, 1, 1.2], [5.95, 0.12, 0.12], [2.01, 0.05, 0.5]],
  glock: [[1, 1, 1.6], [2.76, 0.32, 0.5], [5.4, 0.12, 0.18], [8.93, 0.04, 0.08]],
  bell: [[0.5, 0.25, 3.2], [1, 1, 2.6], [1.19, 0.3, 1.8], [1.5, 0.22, 1.4], [2, 0.3, 1.1], [2.51, 0.12, 0.7], [3.0, 0.06, 0.45]],
  wood: [[1, 1, 0.12], [2.3, 0.3, 0.05], [4.4, 0.08, 0.03]],
  metalSmall: [[1, 0.6, 0.18], [2.43, 0.4, 0.12], [4.1, 0.22, 0.08], [6.5, 0.1, 0.05]],
  metalLow: [[1, 0.7, 0.6], [1.58, 0.45, 0.45], [2.71, 0.3, 0.3], [3.95, 0.16, 0.2], [5.3, 0.08, 0.12]],
  box: [[1, 0.5, 0.2], [1.73, 0.32, 0.13], [2.6, 0.18, 0.09], [3.9, 0.07, 0.05]],
};

// Formants (F1, F2, F3) for a small/cute vocal tract
export const VOWELS = {
  a: [800, 1250, 2700], e: [500, 1900, 2600], i: [320, 2300, 3000], o: [520, 900, 2500], u: [350, 800, 2400],
};

/**
 * Synthesised impulse response: stereo decorrelated noise, exponential decay, and a time-varying
 * lowpass so the tail darkens (soft "cathedral of jelly" room). Returns an AudioBuffer.
 */
export function makeImpulse(ctx, { seconds = 2.2, predelay = 0.018, hiStart = 7500, hiEnd = 900, lowCut = 140, seed = 7 } = {}) {
  const sr = ctx.sampleRate;
  const n = Math.floor(sr * (seconds + predelay));
  const buf = ctx.createBuffer(2, n, sr);
  const pd = Math.floor(predelay * sr);
  for (let ch = 0; ch < 2; ch++) {
    const r = mulberry32(seed * 131 + ch * 7919);
    const d = buf.getChannelData(ch);
    let lp = 0, hpState = 0, hpPrev = 0;
    const hpA = Math.exp(-TAU * lowCut / sr);
    for (let i = pd; i < n; i++) {
      const tt = (i - pd) / sr;
      const prog = tt / seconds;
      const env = Math.exp(-6.9 * tt / seconds) * Math.min(1, tt / 0.012); // T60 = seconds, 12 ms fade-in
      const fc = hiStart * Math.pow(hiEnd / hiStart, Math.min(1, prog * 1.3));
      const a = Math.exp(-TAU * fc / sr);
      const w = (r() * 2 - 1);
      lp = (1 - a) * w + a * lp;              // one-pole lowpass (time varying)
      const hp = hpA * (hpState + lp - hpPrev); // one-pole highpass
      hpPrev = lp; hpState = hp;
      d[i] = hp * env;
    }
    // a few soft early reflections
    const taps = [[0.011, 0.35], [0.019, 0.25], [0.027, 0.2], [0.041, 0.14]];
    for (const [tt, g] of taps) {
      const i = pd + Math.floor((tt + (ch ? 0.0031 : 0)) * sr);
      if (i < n) d[i] += g * (ch ? -1 : 1) * 0.5;
    }
    // fade the very end
    const fe = Math.floor(sr * 0.05);
    for (let i = 0; i < fe; i++) d[n - 1 - i] *= i / fe;
  }
  // normalise energy so the wet path has roughly unity power gain
  let ss = 0;
  for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < n; i++) ss += d[i] * d[i]; }
  const g = 1 / Math.sqrt(ss / 2);
  for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < n; i++) d[i] *= g; }
  return buf;
}
