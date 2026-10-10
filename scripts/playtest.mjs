#!/usr/bin/env node
// Functional playthrough: visits every district, finds every curiosity, opens panels, checks progress
// bookkeeping + console errors. Usage: node scripts/playtest.mjs [--shots]
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const shots = process.argv.includes('--shots');
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', protocolTimeout: 900000, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'], defaultViewport: { width: 1600, height: 900, deviceScaleFactor: 1 } });
const p = await b.newPage();
await p.evaluateOnNewDocument(() => { window.WebSocket = class { constructor() { this.readyState = 0; } addEventListener() {} removeEventListener() {} send() {} close() {} }; try { localStorage.clear(); } catch {} });
const errors = [];
p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
p.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const report = [];
const ok = (name, cond, extra = '') => { report.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`); };
fs.mkdirSync('docs/qa/shots', { recursive: true });
const snap = async (n) => { if (shots) await p.screenshot({ path: `docs/qa/shots/pt-${n}.png` }); };

await p.goto('http://127.0.0.1:5321/?shot=game');
await p.waitForFunction(() => window.__city && window.__city.ready && window.__city.game, { timeout: 120000 });
await sleep(800);
ok('title screen visible', await p.evaluate(() => !!document.querySelector('.title-screen')));
ok('11 poster callouts', await p.evaluate(() => document.querySelectorAll('.callout').length === 11));
await snap('title');

await p.click('[data-a=start]');
await sleep(6500);
const st = await p.evaluate(() => ({ state: __city.game.state, hud: !!document.querySelector('.hud-tl'), title: !!document.querySelector('.title-screen') }));
ok('enters explore after descent', st.state === 'explore', JSON.stringify(st));
ok('title removed', !st.title);
await snap('arrive');

// walking moves the player
const p0 = await p.evaluate(() => __city.game.player.pos.toArray());
await p.keyboard.down('w'); await sleep(1500); await p.keyboard.up('w');
const p1 = await p.evaluate(() => __city.game.player.pos.toArray());
ok('WASD moves player', Math.hypot(p1[0] - p0[0], p1[2] - p0[2]) > 1.0, `moved ${Math.hypot(p1[0] - p0[0], p1[2] - p0[2]).toFixed(2)}u`);

// visit each district by placing the player at its centre
const ids = await p.evaluate(() => Object.keys(window.__city.game.constructor ? {} : {}));
const districts = await p.evaluate(async () => {
  const { DISTRICT_ORDER, DISTRICTS } = await import('/src/game/districts.js');
  return DISTRICT_ORDER.map((id) => ({ id, c: DISTRICTS[id].center.toArray() }));
});
for (const d of districts) {
  await p.evaluate((d) => { const g = __city.game; g.director.clear(); g.player.place(d.c[0], d.c[2]); g.guide.place(d.c[0] + 1.2, d.c[2] + 1.2); }, d);
  await sleep(900);
  const v = await p.evaluate((id) => __city.game.progress.visited.has(id), d.id);
  const where = await p.evaluate(() => __city.game.player.pos.toArray().map((x) => +x.toFixed(1)));
  ok(`visit ${d.id}`, v, `player at ${where}`);
}

// examine + leave for each district
for (const d of districts) {
  await p.evaluate((id) => __city.game.examine(id), d.id);
  await sleep(2200);
  const e = await p.evaluate(() => ({ state: __city.game.state, card: !!document.querySelector('.card'), labels: document.querySelectorAll('.sci-label').length }));
  ok(`examine ${d.id}`, e.state === 'examine' && e.card, `labels=${e.labels}`);
  if (['nucleus', 'golgi', 'mitochondria', 'membrane'].includes(d.id)) await snap(`examine-${d.id}`);
  await p.keyboard.press('Escape'); await sleep(1600);
  const back = await p.evaluate(() => __city.game.state);
  ok(`leave examine ${d.id}`, back === 'explore', back);
}

// curiosities: stand at each anchor and press E
const curs = await p.evaluate(() => __city.game.interactables.filter((i) => i.kind === 'curiosity').map((i) => ({ id: i.id.slice(4), at: i.at.toArray() })));
ok('24 curiosities placed', curs.length === 24, `${curs.length} placed`);
for (const c of curs) {
  await p.evaluate((c) => { const g = __city.game; g.ui.closeCard(true); g.director.clear(); g.player.pos.set(c.at[0], 0, c.at[2]); g.player.place(c.at[0], c.at[2]); }, c);
  await sleep(250);
  const near = await p.evaluate(() => { const n = __city.game._nearestInteractable(); return n ? n.id : null; });
  await p.keyboard.press('e'); await sleep(350);
  const found = await p.evaluate((id) => __city.game.progress.found.has(id), c.id);
  ok(`curiosity ${c.id}`, found, `nearest=${near}`);
}

// panels
await p.evaluate(() => { __city.game.ui.closeCard(true); __city.game.director.clear(); });
await p.keyboard.press('n'); await sleep(600);
ok('notebook opens', await p.evaluate(() => !!document.querySelector('.modal')));
await snap('notebook');
await p.keyboard.press('Escape'); await sleep(400);
await p.keyboard.press('h'); await sleep(600);
ok('help opens', await p.evaluate(() => !!document.querySelector('.modal input[type=range]')));
await p.keyboard.press('Escape'); await sleep(400);
await p.keyboard.press('g'); await sleep(800);
ok('guide responds', await p.evaluate(() => !!document.querySelector('.dialogue')));
await p.keyboard.press('t'); await sleep(1200);
ok('tour leads', await p.evaluate(() => __city.game.tour === true));

const prog = await p.evaluate(() => ({ v: __city.game.progress.visited.size, f: __city.game.progress.found.size }));
report.push(`progress: visited ${prog.v}/11, found ${prog.f}/24`);
report.push(`console errors: ${errors.length}`);
errors.slice(0, 15).forEach((e) => report.push(`  ! ${e.slice(0, 240)}`));
console.log(report.join('\n'));
await b.close();
