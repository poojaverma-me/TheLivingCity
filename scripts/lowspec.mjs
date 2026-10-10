#!/usr/bin/env node
// Worst-case check: run the game on SwiftShader (CPU-only software WebGL) and report the tier chosen + fps.
// Usage: node scripts/lowspec.mjs [--q=low|medium|high]
import puppeteer from 'puppeteer-core';
const qArg = process.argv.find((a) => a.startsWith('--q='));
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', protocolTimeout: 900000,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'], defaultViewport: { width: 1366, height: 768, deviceScaleFactor: 1 } });
const p = await b.newPage();
await p.evaluateOnNewDocument(() => { window.WebSocket = class { constructor() { this.readyState = 0; } addEventListener() {} removeEventListener() {} send() {} close() {} }; try { localStorage.clear(); } catch {} });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
const t0 = Date.now();
await p.goto(`http://127.0.0.1:5321/?shot=game${qArg ? '&' + qArg.slice(2) : ''}`);
await p.waitForFunction(() => window.__city && window.__city.ready, { timeout: 600000, polling: 1000 });
const loadS = ((Date.now() - t0) / 1000).toFixed(1);
const r = await p.evaluate(async () => {
  const fps = (ms) => new Promise((res) => { let n = 0; const s = performance.now(); (function f() { n++; if (performance.now() - s < ms) requestAnimationFrame(f); else res(+(n / (ms / 1000)).toFixed(1)); })(); });
  const g = __city.game; g.start(); await new Promise((r) => setTimeout(r, 9000));
  const street = await fps(6000);
  await new Promise((r) => setTimeout(r, 9000)); // let the auto check run again
  return { tier: __city.quality, gpu: __city.gpu, dpr: __city.renderer.getPixelRatio(), street, after: await fps(5000) };
});
console.log(JSON.stringify({ loadS, ...r, errors: errs.slice(0, 3) }));
await b.close();
