// In-page audio QA: renders sounds with OfflineAudioContext and measures them (see scripts/audio-qa.mjs).
import { SPECS, SFX_NAMES, renderRecipe, normalizeVariants } from './sfx.js';
import { EMITTERS, EMITTER_TYPES, buildBed, EMITTER_LEVEL, EMITTER_TARGET, BED_LEVEL, BED_TARGET } from './ambience.js';
import { Score, MOOD_NAMES } from './music.js';
import { buildAudioGraph } from './engine.js';
import { analyze } from './analysis.js';
import { mulberry32, gain, osc } from './dsp.js';

const SR = 48000;
const OAC = () => globalThis.OfflineAudioContext;

export const LIMITS = { peakDb: -1, dc: 0.002, hf8k: 0.02, centroidMax: 4000, loudTol: 1.0 };

function check(m, extra = {}) {
  const issues = [];
  if (m.nan) issues.push('NaN');
  if (m.silent) issues.push('silent');
  if (m.peakDb > LIMITS.peakDb) issues.push(`peak ${m.peakDb.toFixed(1)}`);
  if (Math.abs(m.dc) > LIMITS.dc) issues.push(`DC ${m.dc.toFixed(4)}`);
  if (m.hf8k > LIMITS.hf8k) issues.push(`>8k ${(m.hf8k * 100).toFixed(1)}%`);
  if (m.centroid > LIMITS.centroidMax) issues.push(`centroid ${m.centroid.toFixed(0)}`);
  if (extra.target !== undefined && Math.abs(m.loudS - extra.target) > LIMITS.loudTol) issues.push(`loud ${m.loudS.toFixed(1)} vs ${extra.target}`);
  return issues;
}

export async function qaSfx() {
  const rows = [];
  for (const name of SFX_NAMES) {
    const spec = SPECS[name];
    const bufs = await Promise.all(Array.from({ length: spec.variants }, (_, v) => renderRecipe(name, v, SR)));
    const raw = bufs.map((b) => analyze(b, { spectrum: false }));
    const { gain: g } = normalizeVariants(name, bufs);
    const ms = bufs.map((b) => analyze(b));
    const avg = (k) => ms.reduce((a, m) => a + m[k], 0) / ms.length;
    const m = {
      peakDb: Math.max(...ms.map((x) => x.peakDb)), loudS: avg('loudS'), rmsDb: avg('rmsDb'), dc: Math.max(...ms.map((x) => Math.abs(x.dc))),
      nan: ms.reduce((a, x) => a + x.nan, 0), silent: ms.some((x) => x.silent), centroid: avg('centroid'), hf8k: Math.max(...ms.map((x) => x.hf8k)),
      activeDur: Math.max(...ms.map((x) => x.activeDur)), loudSpread: Math.max(...ms.map((x) => x.loudS)) - Math.min(...ms.map((x) => x.loudS)),
    };
    rows.push({ name, target: spec.target, gainDb: 20 * Math.log10(g), rawLoud: raw.reduce((a, x) => a + x.loudS, 0) / raw.length, ...m, issues: check(m, { target: spec.target }) });
  }
  return rows;
}

async function renderOffline(seconds, build) {
  const ctx = new (OAC())(2, Math.ceil(seconds * SR), SR);
  await build(ctx);
  return ctx.startRendering();
}

export async function qaEmitters(seconds = 10) {
  const rows = [];
  for (const type of EMITTER_TYPES) {
    const buf = await renderOffline(seconds, (ctx) => {
      const out = gain(ctx, EMITTER_LEVEL[type] ?? 1); out.connect(ctx.destination);
      const G = EMITTERS[type](ctx, out, mulberry32(77), 0);
      G.tick(0, seconds);
      if (G.update) G.update(1 / 60, { speed: 0.5 });
      if (G.setReversing && type === 'truck') G.setReversing(true);
      G.tick(0, seconds);
    });
    const m = analyze(buf);
    const lvl = EMITTER_LEVEL[type] ?? 1;
    rows.push({ name: type, ...m, target: EMITTER_TARGET[type], level: lvl, suggest: lvl * Math.pow(10, (EMITTER_TARGET[type] - m.loudI) / 20), issues: check(m) });
  }
  const bed = await renderOffline(20, (ctx) => {
    const o = gain(ctx, BED_LEVEL); o.connect(ctx.destination);
    const wet = gain(ctx, 0.3); wet.connect(o);
    const G = buildBed(ctx, o, wet, mulberry32(5), 0);
    G.tick(0, 20);
  });
  const mb = analyze(bed);
  rows.push({ name: 'bed (stereo)', ...mb, target: BED_TARGET, level: BED_LEVEL, suggest: BED_LEVEL * Math.pow(10, (BED_TARGET - mb.loudI) / 20), issues: check(mb) });
  return rows;
}

export async function qaMusic(seconds = 40) {
  const rows = [];
  for (const mood of MOOD_NAMES) {
    const buf = await renderOffline(seconds, (ctx) => {
      const wet = gain(ctx, 0.25); wet.connect(ctx.destination); // stand-in for the reverb return level
      const s = new Score(ctx, ctx.destination, wet, { seed: 11, mood });
      s.nextChord = 0.05;
      s.scheduleUntil(seconds);
    });
    const m = analyze(buf);
    rows.push({ name: mood, ...m, issues: check(m) });
  }
  // stems for two moods: loudness of each instrument bus alone
  for (const mood of ['explore', 'nucleus']) {
    for (const stem of ['pad', 'mallet', 'bell', 'bass', 'arp']) {
      const buf = await renderOffline(seconds, (ctx) => {
        const wet = gain(ctx, 0.25); wet.connect(ctx.destination);
        const s = new Score(ctx, ctx.destination, wet, { seed: 11, mood });
        for (const k of Object.keys(s.bus)) if (k !== stem) { s.bus[k].gain.cancelScheduledValues(0); s.bus[k].gain.value = 0; s.bus[k].disconnect(); }
        s.nextChord = 0.05; s.scheduleUntil(seconds);
      });
      const m = analyze(buf);
      if (m.silent) continue;
      rows.push({ name: `${mood} · ${stem} stem`, ...m, issues: [] });
    }
  }
  return rows;
}

/** Full graph (engine master chain + reverb + all buses) with music, bed, emitters and an sfx barrage. */
export async function qaMix(seconds = 24) {
  const { createAmbienceOffline } = await import('./ambience.js');
  const sfxBufs = {};
  for (const n of ['discovery_chime', 'parcel_thunk', 'ui_click', 'vesicle_bloop', 'success_flourish', 'truck_honk']) {
    const b = [await renderRecipe(n, 0, SR)]; normalizeVariants(n, b); sfxBufs[n] = b[0];
  }
  const buf = await renderOffline(seconds, (ctx) => {
    const eng = buildAudioGraph(ctx, {});
    const s = new Score(ctx, eng.musicBus, eng.sends.music, { seed: 3, mood: 'explore' });
    s.nextChord = 0.05; s.scheduleUntil(seconds);
    createAmbienceOffline(eng, seconds, [['mitochondria', { x: 3, y: 0, z: -2 }], ['golgi', { x: -6, y: 0, z: 4 }], ['crowd', { x: 2, y: 0, z: 5 }]]);
    let t = 1;
    for (let k = 0; k < 3; k++) for (const [n, b] of Object.entries(sfxBufs)) {
      const src = ctx.createBufferSource(); src.buffer = b; src.connect(eng.sfxBus); src.start(t); t += 1.1;
    }
  });
  const m = analyze(buf);
  return [{ name: 'full mix (default volumes)', ...m, issues: check(m) }];
}

/** Measures master-chain gain on a -24 dBFS 440 Hz sine (for MASTER_TRIM calibration). */
export async function qaMasterGain() {
  const buf = await renderOffline(3, (ctx) => {
    const eng = buildAudioGraph(ctx, { volumes: { master: 1, sfx: 1 } });
    eng.buses.sfx.autoSend.gain.value = 0;
    const o = osc(ctx, 'sine', 440, 0); const g = gain(ctx, Math.pow(10, -24 / 20)); o.connect(g); g.connect(eng.sfxBus);
  });
  const d = buf.getChannelData(0); let pk = 0; for (let i = buf.length / 2; i < buf.length; i++) pk = Math.max(pk, Math.abs(d[i]));
  return 20 * Math.log10(pk) + 24;
}

/** Panning + distance: pink noise emitter around the listener using the real engine + listener setup. */
export async function qaSpatial() {
  const probe = async (pos) => {
    const buf = await renderOffline(1.5, (ctx) => {
      const eng = buildAudioGraph(ctx, { volumes: { master: 1, ambience: 1 } });
      eng.buses.ambience.autoSend.gain.value = 0;
      eng.update({ x: 0, y: 30, z: 30 }, { x: 0, y: -0.7071, z: -0.7071 }, { x: 0, y: 0, z: 0 });
      const p = eng.createPanner(pos);
      const src = ctx.createBufferSource(); src.buffer = (() => { const b = ctx.createBuffer(1, SR, SR); const d = b.getChannelData(0); const r = mulberry32(3); for (let i = 0; i < SR; i++) d[i] = (r() * 2 - 1) * 0.1; return b; })();
      src.loop = true; src.connect(p); p.connect(eng.ambienceBus); src.start(0);
    });
    const rms = (c) => { const d = buf.getChannelData(c); let s = 0; for (let i = SR / 2; i < buf.length; i++) s += d[i] * d[i]; return Math.sqrt(s / (buf.length - SR / 2)); };
    const L = rms(0), R = rms(1);
    return { L: 20 * Math.log10(L), R: 20 * Math.log10(R), total: 10 * Math.log10((L * L + R * R) / 2) };
  };
  const rows = [];
  for (const [name, pos] of [['right 8u', { x: 8, y: 0, z: 0 }], ['left 8u', { x: -8, y: 0, z: 0 }], ['ahead (screen up) 8u', { x: 0, y: 0, z: -8 }]]) {
    const m = await probe(pos); rows.push({ name, ...m, lr: m.L - m.R });
  }
  let ref = null;
  for (const d of [4, 8, 16, 32, 44]) {
    const m = await probe({ x: 0, y: 3.54, z: 3.54 - d }); // listener sits 5u up the camera ray from the target
    if (ref === null) ref = m.total;
    rows.push({ name: `distance ${d}u`, ...m, lr: m.L - m.R, rel: m.total - ref });
  }
  return rows;
}

export async function runAudioQA(opts = {}) {
  const t0 = performance.now();
  const res = {};
  res.masterGainDb = await qaMasterGain();
  res.sfx = await qaSfx();
  res.emitters = await qaEmitters(opts.emitterSeconds || 10);
  res.music = await qaMusic(opts.musicSeconds || 40);
  res.mix = await qaMix(opts.mixSeconds || 24);
  res.spatial = await qaSpatial();
  res.ms = performance.now() - t0;
  return res;
}
