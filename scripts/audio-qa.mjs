#!/usr/bin/env node
// Audio QA: loads src/audio/_demo.html in headless Chrome, renders every sound with OfflineAudioContext,
// measures peak / RMS / K-weighted loudness / DC / NaN / duration / spectral centroid / >8 kHz energy,
// runs a short realtime smoke test, and writes docs/qa/audio-metrics.md (+ .json).
// Usage: node scripts/audio-qa.mjs [--url=http://127.0.0.1:5321/src/audio/_demo.html] [--quick]
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)=?(.*)$/); return m ? [m[1], m[2] || true] : [a, true]; }));
const url = args.url || 'http://127.0.0.1:5321/src/audio/_demo.html';
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'],
});
const page = await browser.newPage();
const logs = [];
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`[${m.type()}] ${m.text()}`); });
page.on('response', (r) => { if (r.status() >= 400) logs.push(`[http ${r.status()}] ${r.url()}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
page.on('error', (e) => console.error('page crashed', e.message));
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__audioQA && window.__audioDemo, { timeout: 30000 });

const quick = !!args.quick;
// The shared Vite dev server may full-reload the page when other files change; retry on that.
let res;
for (let attempt = 1; ; attempt++) {
  try {
    res = await page.evaluate((quick) => window.__audioQA(quick ? { musicSeconds: 16, emitterSeconds: 6, mixSeconds: 12 } : {}), quick);
    break;
  } catch (e) {
    if (attempt >= 4 || !/context was destroyed|navigation/i.test(e.message)) throw e;
    console.error(`page reloaded during QA (attempt ${attempt}), retrying`);
    await page.waitForFunction(() => window.__audioQA && window.__audioDemo, { timeout: 30000 });
  }
}

// realtime smoke test: everything running at once for a few seconds, sampling the master output
const rt = await page.evaluate(async () => {
  const { audio, sfx, ambience, music } = window.__audioDemo;
  await audio.resume();
  const tr = performance.now();
  await sfx.ready;
  const prerenderMs = sfx.stats.prerenderMs;
  const an = audio.ctx.createAnalyser(); an.fftSize = 2048; audio.output.connect(an);
  ambience.start(0.5); music.start(0.5);
  const types = ambience.types;
  types.forEach((t, i) => ambience.addEmitter(t, { x: Math.cos(i) * 10, y: 0, z: Math.sin(i) * 10 }));
  const buf = new Float32Array(2048);
  let peak = 0, frames = 0, nan = 0, errors = 0;
  const t0 = performance.now();
  const names = sfx.names;
  await new Promise((done) => {
    let k = 0;
    const tick = () => {
      try {
        audio.update({ x: 0, y: 30, z: 30 }, { x: 0, y: -0.707, z: -0.707 }, { x: 0, y: 0, z: 0 });
        ambience.update(1 / 60);
        if (frames % 10 === 0) sfx.play(names[k++ % names.length], { position: k % 2 ? { x: 3, y: 0, z: 0 } : undefined });
      } catch (e) { errors++; console.error(e); }
      an.getFloatTimeDomainData(buf);
      for (const v of buf) { if (!Number.isFinite(v)) nan++; else peak = Math.max(peak, Math.abs(v)); }
      frames++;
      if (performance.now() - t0 < 6000) setTimeout(tick, 16); else done();
    };
    tick();
  });
  const active = ambience.activeCount;
  // dialogue auto-duck: voice-like signal on the voice bus
  const ctx = audio.ctx, t = ctx.currentTime;
  const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 200; const vg = ctx.createGain(); vg.gain.value = 0.1;
  o.connect(vg); vg.connect(audio.voiceBus); o.start(t); o.stop(t + 1.5);
  const sampleDuck = (ms) => new Promise((res) => { const t1 = performance.now(); const f = () => { audio.update({ x: 0, y: 30, z: 30 }, { x: 0, y: -0.707, z: -0.707 }, { x: 0, y: 0, z: 0 }); if (performance.now() - t1 < ms) setTimeout(f, 16); else res(audio.buses.music.duck.gain.value); }; f(); });
  const ducked = await sampleDuck(1000);
  const released = await sampleDuck(2500);
  music.stop(0.2); ambience.stop(0.2);
  return { prerenderMs, ducked, released, peakDb: 20 * Math.log10(Math.max(peak, 1e-9)), frames, nan, errors, activeEmitters: active, state: audio.ctx.state, gains: sfx.gains() };
});
await browser.close();

const f = (x, d = 1) => (Number.isFinite(x) ? x.toFixed(d) : '—');
const md = [];
md.push('# Audio metrics (procedural WebAudio)', '');
md.push(`Generated ${new Date().toISOString()} by \`node scripts/audio-qa.mjs\` (headless Chrome, OfflineAudioContext @ 48 kHz).`, '');
md.push('Limits: peak ≤ -1 dBFS · |DC| ≤ 0.002 · energy above 8 kHz ≤ 2 % · spectral centroid ≤ 4 kHz · no NaN / silence · SFX short-term loudness within ±1 dB of its target.', '');
md.push('Loudness columns: **loud S** = max short-term (200 ms) K-weighted loudness (LUFS-like, dB); **loud I** = gated integrated loudness (BS.1770 style). SFX are measured after the runtime normalisation step (`normalizeVariants`).', '');
const hdr = (cols) => [`| ${cols.join(' | ')} |`, `|${cols.map(() => '---').join('|')}|`];
const ok = (r) => (r.issues.length ? `**${r.issues.join(', ')}**` : 'ok');

md.push('## SFX', '', ...hdr(['sound', 'target', 'loud S', 'variant spread dB', 'norm gain dB', 'peak dBFS', 'RMS dB', 'dur s', '|DC|', 'centroid Hz', '>8k %', 'status']));
for (const r of res.sfx) md.push(`| ${r.name} | ${r.target} | ${f(r.loudS)} | ${f(r.loudSpread)} | ${f(r.gainDb)} | ${f(r.peakDb)} | ${f(r.rmsDb)} | ${f(r.activeDur, 2)} | ${r.dc.toExponential(1)} | ${f(r.centroid, 0)} | ${f(r.hf8k * 100, 2)} | ${ok(r)} |`);
const loudDev = res.sfx.map((r) => Math.abs(r.loudS - r.target));
md.push('', `Max deviation from target loudness: ${f(Math.max(...loudDev), 2)} dB.`, '');

const table = (title, rows, note) => {
  md.push(`## ${title}`, '');
  if (note) md.push(note, '');
  md.push(...hdr(['name', 'loud I', 'loud S max', 'peak dBFS', 'RMS dB', 'dur s', '|DC|', 'centroid Hz', '>8k %', 'status']));
  for (const r of rows) md.push(`| ${r.name} | ${f(r.loudI)} | ${f(r.loudS)} | ${f(r.peakDb)} | ${f(r.rmsDb)} | ${f(r.activeDur, 1)} | ${Math.abs(r.dc).toExponential(1)} | ${f(r.centroid, 0)} | ${f(r.hf8k * 100, 2)} | ${ok(r)} |`);
  md.push('');
};
md.push('## Ambience calibration', '', ...hdr(['name', 'target loud I', 'measured', 'level trim', 'suggested trim']));
for (const r of res.emitters) md.push(`| ${r.name} | ${r.target} | ${f(r.loudI)} | ${f(r.level, 3)} | ${f(r.suggest, 3)} |`);
md.push('');
table('Ambience emitters (dry, at refDistance) and bed', res.emitters, 'Each emitter rendered dry for its full graph (continuous layers + scheduled events) at unity panner gain, i.e. what you hear at refDistance = 4 before bus faders.');
table('Music moods', res.music, 'Score rendered per mood (dry + 0.25 reverb-send stand-in), before the music bus fader.');
table('Full mix', res.mix, 'Engine graph end-to-end (buses at default volumes → reverb → glue comp → limiter → soft clip): music + bed + 3 emitters + repeated SFX barrage.');
md.push('## Spatial (HRTF panner, inverse distance, ref 4, max 45)', '', 'Pink-noise emitter, isometric camera at (0,30,30) looking at the origin; ear placed 5 u up the camera ray. L-R > 0 means louder on the left.', '');
md.push(...hdr(['probe', 'L dB', 'R dB', 'L-R dB', 'level vs 4u dB']));
for (const r of res.spatial) md.push(`| ${r.name} | ${f(r.L)} | ${f(r.R)} | ${f(r.lr)} | ${r.rel === undefined ? '' : f(r.rel)} |`);
md.push('', 'Beyond ~36 u the ambience manager additionally fades emitters to silence at maxDistance (45 u) and frees their graphs.', '');
md.push('## Realtime smoke test', '', `Everything running together in a live AudioContext for 6 s (bed, music, all ${res.emitters.length - 1} emitter types, an SFX every ~160 ms, some positional):`, '');
md.push(`- master output peak: ${f(rt.peakDb)} dBFS, NaN samples: ${rt.nan}, update errors: ${rt.errors}, active emitters: ${rt.activeEmitters}, context: ${rt.state}`);
md.push(`- SFX bank pre-render (all ${res.sfx.reduce((a, r) => a + 1, 0)} sounds, all variants, incl. loudness analysis): ${f(rt.prerenderMs, 0)} ms (non-blocking; live fallback until ready)`);
md.push(`- dialogue auto-duck: music bus duck gain ${f(rt.ducked, 2)} while voice plays, ${f(rt.released, 2)} 2.5 s after it stops`);
md.push(`- master chain gain at -24 dBFS: ${f(res.masterGainDb, 2)} dB (trim compensates DynamicsCompressor makeup)`, `- QA render time: ${f(res.ms / 1000, 1)} s`, '');
if (logs.length) md.push('## Console', '', ...logs.slice(0, 40).map((l) => `- \`${l.replace(/`/g, "'")}\``), '');
const all = [...res.sfx, ...res.emitters, ...res.music, ...res.mix];
const failing = all.filter((r) => r.issues.length);
md.push('## Summary', '', failing.length ? `${failing.length} item(s) outside limits: ${failing.map((r) => r.name).join(', ')}` : `All ${all.length} rendered items within limits.`, '');

fs.mkdirSync('docs/qa', { recursive: true });
fs.writeFileSync(path.resolve('docs/qa/audio-metrics.md'), md.join('\n'));
fs.writeFileSync(path.resolve('docs/qa/audio-metrics.json'), JSON.stringify({ res, rt, logs }, null, 1));
console.log(md.join('\n'));
