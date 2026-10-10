#!/usr/bin/env node
// Stress: rapidly start/exit every activity and examine mode while the world animates; report page errors.
import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', protocolTimeout: 900000, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'], defaultViewport: { width: 1600, height: 900 } });
const p = await b.newPage();
await p.evaluateOnNewDocument(() => { window.WebSocket = class { constructor() { this.readyState = 0; } addEventListener() {} removeEventListener() {} send() {} close() {} }; });
const errs = [];
p.on('pageerror', (e) => errs.push(e.stack || e.message));
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto('http://127.0.0.1:5321/?shot=game');
await p.waitForFunction(() => window.__city?.ready && window.__city.game, { timeout: 120000 });
await p.evaluate(() => __city.game.start()); await new Promise((r) => setTimeout(r, 6000));
const ids = ['nucleus', 'nucleolus', 'ribosomes', 'rer', 'ser', 'vesicles', 'golgi', 'mitochondria', 'lysosomes', 'vacuoles', 'membrane'];
for (let round = 0; round < 3; round++) for (const id of ids) {
  await p.evaluate((id) => __city.game.examine(id), id); await new Promise((r) => setTimeout(r, 400 + round * 300));
  await p.evaluate((id) => __city.game.startActivity(id), id); await new Promise((r) => setTimeout(r, 300 + Math.random() * 1500));
  await p.keyboard.press('Escape'); await new Promise((r) => setTimeout(r, 250 + round * 200));
}
console.log(JSON.stringify({ errors: errs.length, first: errs.slice(0, 5).map((e) => e.slice(0, 600)) }, null, 1));
await b.close();
