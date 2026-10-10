#!/usr/bin/env node
// QA screenshot tool: renders the game in real (GPU) Chrome and saves deterministic shots.
// Usage: node scripts/shoot.mjs --tag=v1 --shots=overview,nucleus [--w=1600 --h=900] [--url=http://127.0.0.1:5321]
//        [--eval="js to run before shots"] [--wait=1500] [--hud=0]
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const m = a.match(/^--([^=]+)=?(.*)$/); return m ? [m[1], m[2] === '' ? true : m[2]] : [a, true];
}));
const url = args.url || 'http://127.0.0.1:5321/';
const tag = args.tag || 'shot';
const W = +(args.w || 1600), H = +(args.h || 900);
const wait = +(args.wait || 1200);
const outDir = path.resolve(args.out || 'docs/qa/shots');
fs.mkdirSync(outDir, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new', protocolTimeout: 600000,
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', `--window-size=${W},${H}`, '--autoplay-policy=no-user-gesture-required'],
  defaultViewport: { width: W, height: H, deviceScaleFactor: 1 },
});
const page = await browser.newPage();
// Stub WebSocket so Vite HMR can't reload the page mid-test while other agents edit files.
await page.evaluateOnNewDocument(() => { window.WebSocket = class { constructor() { this.readyState = 0; } addEventListener() {} removeEventListener() {} send() {} close() {} }; });

const logs = [];
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

const q = new URLSearchParams({ shot: 'overview', ...(args.params ? Object.fromEntries(new URLSearchParams(args.params)) : {}) });
if (args.hud !== undefined) q.set('hud', args.hud);
await page.goto(`${url}?${q}`, { waitUntil: 'domcontentloaded' });
try {
  await page.waitForFunction(() => window.__city && window.__city.ready && !document.getElementById('boot'), { timeout: 60000 });
} catch (e) {
  console.error('Game never became ready.\n' + logs.join('\n'));
  await page.screenshot({ path: path.join(outDir, `${tag}-FAILED.png`) });
  await browser.close(); process.exit(1);
}
if (args.eval) await page.evaluate(args.eval);

const rawShots = args.shots || 'overview';
const shots = rawShots.split(rawShots.includes('|') || rawShots.includes('cam:') ? '|' : ','); // use | to separate when shots contain commas
const saved = [];
for (const s of shots) {
  if (s.startsWith('js:')) { await page.evaluate(s.slice(3)); continue; }
  if (s.startsWith('wait:')) { await new Promise((r) => setTimeout(r, +s.slice(5))); continue; }
  if (s.startsWith('key:')) { await page.keyboard.press(s.slice(4)); continue; }
  if (s.startsWith('hold:')) { const [k, ms] = s.slice(5).split('@'); await page.keyboard.down(k); await new Promise((r) => setTimeout(r, +ms)); await page.keyboard.up(k); continue; }
  let name = s;
  if (s.startsWith('snap:')) {
    name = s.slice(5);
    const file = path.join(outDir, `${tag}-${name}.png`);
    await page.screenshot({ path: file }); saved.push(file); continue;
  }
  if (s.startsWith('cam:')) {
    // cam:<name>:px,py,pz:tx,ty,tz[:fov]  — ad-hoc camera without editing layout.js
    const [, n, p, t, f] = s.split(':'); name = n;
    await page.evaluate((p, t, f) => window.__city.cam(p, t, f), p.split(',').map(Number), t.split(',').map(Number), f ? +f : 38);
  } else await page.evaluate((n) => window.__city.shot(n), s);
  await new Promise((r) => setTimeout(r, wait));
  const file = path.join(outDir, `${tag}-${name}.png`);
  await page.screenshot({ path: file });
  saved.push(file);
}
const info = await page.evaluate(() => window.__city.info && window.__city.info());
const fps = await page.evaluate(() => new Promise((res) => {
  let n = 0; const t0 = performance.now();
  function f() { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else res(n / ((performance.now() - t0) / 1000)); }
  requestAnimationFrame(f);
}));
console.log(JSON.stringify({ saved, info, fps: Math.round(fps), logs: logs.slice(0, 30) }, null, 1));
await browser.close();
