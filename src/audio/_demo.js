import { createAudio } from './engine.js';
import { createSfx } from './sfx.js';
import { createAmbience } from './ambience.js';
import { createMusic } from './music.js';
import { runAudioQA } from './qa.js';

const $ = (s) => document.querySelector(s);
const audio = createAudio();
const sfx = createSfx(audio);
const ambience = createAmbience(audio);
const music = createMusic(audio);
window.__audioDemo = { audio, sfx, ambience, music };
window.__audioQA = runAudioQA;

const stateEl = $('#state');
const showState = () => (stateEl.textContent = `context: ${audio.ctx.state} · ${audio.ctx.sampleRate} Hz · sfx ${sfx.names.filter((n) => sfx.isReady(n === 'footstep' ? 'footstep_pave' : n)).length}/${sfx.names.length} pre-rendered · active emitters ${ambience.activeCount}`);
setInterval(showState, 300);

let bedOn = false;
$('#start').onclick = async () => { await audio.resume(); if (!bedOn) { ambience.start(); bedOn = true; } };

// mix sliders
const vols = audio.getVolumes();
for (const k of Object.keys(vols)) {
  const l = document.createElement('label');
  l.innerHTML = `<span style="width:70px">${k}</span><input type="range" min="0" max="1" step="0.01" value="${vols[k]}">`;
  l.querySelector('input').oninput = (e) => audio.setVolumes({ [k]: +e.target.value });
  $('#vols').appendChild(l);
}

// music
$('#mStart').onclick = async () => { await audio.resume(); music.start(); };
$('#mStop').onclick = () => music.stop();
for (const m of music.moods) {
  const b = document.createElement('button'); b.textContent = m;
  b.onclick = async () => { await audio.resume(); music.setMood(m); if (!music.playing) music.start(); document.querySelectorAll('#moods button').forEach((x) => x.classList.toggle('on', x === b)); };
  $('#moods').appendChild(b);
}

// fake dialogue on the voice bus: formant babble through voiceBus triggers the auto-duck
$('#duckBtn').onclick = async () => {
  await audio.resume();
  const ctx = audio.ctx, t = ctx.currentTime;
  for (let i = 0; i < 14; i++) sfx.play('guide_blip', { delay: i * 0.14 });
  const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 210;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 3;
  const g = ctx.createGain(); g.gain.value = 0;
  for (let k = 0; k < 16; k++) { g.gain.setTargetAtTime(k % 3 === 2 ? 0 : 0.15, t + k * 0.16, 0.03); bp.frequency.setTargetAtTime(600 + Math.random() * 1200, t + k * 0.16, 0.03); }
  g.gain.setTargetAtTime(0, t + 2.6, 0.05);
  o.connect(bp); bp.connect(g); g.connect(audio.voiceBus); o.start(t); o.stop(t + 3);
};
$('#manDuck').onclick = () => { audio.duck(0.7, 0.3); setTimeout(() => audio.duck(0, 1), 2000); };

// sfx buttons
for (const n of sfx.names) {
  const b = document.createElement('button'); b.textContent = n;
  b.onclick = async () => { await audio.resume(); sfx.play(n); };
  b.onmouseenter = n === 'ui_hover' ? () => sfx.play('ui_hover') : null;
  $('#sfx').appendChild(b);
}
const fm = document.createElement('button'); fm.textContent = 'footstep (metal)';
fm.onclick = async () => { await audio.resume(); sfx.play('footstep', { surface: 'metal' }); };
$('#sfx').appendChild(fm);
const walk = document.createElement('button'); walk.textContent = 'walk ×8';
walk.onclick = async () => { await audio.resume(); for (let i = 0; i < 8; i++) setTimeout(() => sfx.play('footstep', { surface: i < 4 ? 'pave' : 'metal' }), i * 420); };
$('#sfx').appendChild(walk);
const type = document.createElement('button'); type.textContent = 'typewriter line';
type.onclick = async () => { await audio.resume(); for (let i = 0; i < 30; i++) setTimeout(() => sfx.play('typewriter_tick'), i * 38 + Math.random() * 8); };
$('#sfx').appendChild(type);

// ambience
$('#bed').onclick = async () => { await audio.resume(); bedOn ? ambience.stop() : ambience.start(); bedOn = !bedOn; };
let placeType = 'mitochondria';
for (const t of ambience.types) {
  const b = document.createElement('button'); b.textContent = t;
  b.onclick = () => { placeType = t; document.querySelectorAll('#etypes button').forEach((x) => x.classList.toggle('on', x === b)); };
  if (t === placeType) b.classList.add('on');
  $('#etypes').appendChild(b);
}
const map = $('#map'), g2 = map.getContext('2d');
const W = 100; // world units across
const toWorld = (px, py) => ({ x: (px / map.width - 0.5) * W, y: 0, z: (py / map.height - 0.5) * W });
const toPx = (p) => [(p.x / W + 0.5) * map.width, (p.z / W + 0.5) * map.height];
map.onclick = async (e) => {
  await audio.resume(); if (!bedOn) { ambience.start(); bedOn = true; }
  const r = map.getBoundingClientRect();
  ambience.addEmitter(placeType, toWorld((e.clientX - r.left) * (map.width / r.width), (e.clientY - r.top) * (map.height / r.height)));
};
$('#clearE').onclick = () => ambience.clear();

let orbit = null, truck = null, truckT = 0;
$('#orbit').onclick = async () => {
  await audio.resume();
  if (orbit) { orbit.remove(); orbit = null; return; }
  orbit = ambience.addEmitter(placeType, { x: 8, y: 0, z: 0 });
};
$('#truckDrive').onclick = async () => {
  await audio.resume();
  if (truck) truck.remove();
  truck = ambience.addEmitter('truck', { x: -50, y: 0, z: -6 }); truckT = 0;
  setTimeout(() => truck && truck.honk(), 3200);
};

const COLORS = { mitochondria: '#ff8a4c', golgi: '#e8c547', lysosome: '#b46cf0', vacuole: '#56b6f0', nucleus: '#5fd3b0', ser: '#8fd36a', membrane: '#c9d6df', truck: '#ffd23f', crowd: '#f58fb3' };
let last = performance.now(), ang = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  ang += dt * 0.6;
  if (orbit) orbit.setPosition({ x: Math.cos(ang) * 9, y: 0, z: Math.sin(ang) * 9 });
  if (truck) { truckT += dt; truck.setPosition({ x: -50 + truckT * 7, y: 0, z: -6 }); if (truckT > 15) { truck.remove(); truck = null; } }
  // listener at origin, camera above-behind looking at it (isometric-ish), screen-up = -z
  audio.update({ x: 0, y: 30, z: 30 }, { x: 0, y: -0.707, z: -0.707 }, { x: 0, y: 0, z: 0 });
  ambience.update(dt);
  // draw
  g2.fillStyle = '#0b1013'; g2.fillRect(0, 0, map.width, map.height);
  g2.strokeStyle = '#24303a'; g2.beginPath(); g2.arc(map.width / 2, map.height / 2, (45 / W) * map.width, 0, Math.PI * 2); g2.stroke();
  g2.beginPath(); g2.arc(map.width / 2, map.height / 2, (4 / W) * map.width, 0, Math.PI * 2); g2.stroke();
  g2.fillStyle = '#fff'; g2.beginPath(); g2.moveTo(map.width / 2, map.height / 2 - 8); g2.lineTo(map.width / 2 - 5, map.height / 2 + 5); g2.lineTo(map.width / 2 + 5, map.height / 2 + 5); g2.fill();
  for (const e of ambience.emitters) {
    const [x, y] = toPx(e.pos);
    g2.fillStyle = COLORS[e.type] || '#fff'; g2.globalAlpha = e.active ? 1 : 0.35;
    g2.beginPath(); g2.arc(x, y, 6, 0, Math.PI * 2); g2.fill();
    g2.font = '10px system-ui'; g2.fillText(e.type, x + 8, y + 3); g2.globalAlpha = 1;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// QA
const f1 = (x, d = 1) => (Number.isFinite(x) ? x.toFixed(d) : '—');
function table(title, rows, cols) {
  return `<h3 style="font-size:13px;margin:12px 0 4px">${title}</h3><table><tr>${cols.map((c) => `<th>${c[0]}</th>`).join('')}<th>issues</th></tr>${rows
    .map((r) => `<tr>${cols.map((c) => `<td>${c[1](r)}</td>`).join('')}<td class="${r.issues.length ? 'bad' : 'ok'}">${r.issues.join(', ') || 'ok'}</td></tr>`).join('')}</table>`;
}
$('#qa').onclick = async () => {
  $('#qaout').textContent = 'Rendering…';
  const res = await runAudioQA();
  const base = [['name', (r) => r.name], ['peak dBFS', (r) => f1(r.peakDb)], ['RMS dB', (r) => f1(r.rmsDb)], ['loud S', (r) => f1(r.loudS)], ['loud I', (r) => f1(r.loudI)], ['dur s', (r) => f1(r.activeDur, 2)], ['DC', (r) => r.dc.toExponential(1)], ['centroid', (r) => f1(r.centroid, 0)], ['>8k %', (r) => f1(r.hf8k * 100, 2)]];
  $('#qaout').innerHTML = `<div class="sub">master chain gain ${f1(res.masterGainDb, 2)} dB · ${f1(res.ms / 1000, 1)} s</div>` +
    table('SFX (normalised)', res.sfx, [...base.slice(0, 4), ['target', (r) => r.target], ['spread', (r) => f1(r.loudSpread)], ...base.slice(5)]) +
    table('Ambience (at ref distance)', res.emitters, base) + table('Music moods', res.music, base) + table('Full mix', res.mix, base);
};
