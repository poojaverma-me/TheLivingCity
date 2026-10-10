#!/usr/bin/env node
// GPU-bound tier comparison: 2560×1440 at 2× density so the GPU (not vsync) is the limit.
import puppeteer from 'puppeteer-core';
const out = {};
for (const q of ['high', 'medium', 'low']) {
  const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', protocolTimeout: 900000,
    args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'], defaultViewport: { width: 2560, height: 1440, deviceScaleFactor: 2 } });
  const p = await b.newPage();
  await p.evaluateOnNewDocument(() => { window.WebSocket = class { constructor() { this.readyState = 0; } addEventListener() {} removeEventListener() {} send() {} close() {} }; try { localStorage.clear(); } catch {} });
  await p.goto(`http://127.0.0.1:5321/?shot=game&q=${q}`);
  await p.waitForFunction(() => window.__city && window.__city.ready, { timeout: 300000 });
  out[q] = await p.evaluate(async () => {
    const fps = (ms) => new Promise((res) => { let n = 0; const s = performance.now(); (function f() { n++; if (performance.now() - s < ms) requestAnimationFrame(f); else res(+(n / (ms / 1000)).toFixed(1)); })(); });
    __city.game.start(); await new Promise((r) => setTimeout(r, 8000));
    // pin resolution at the tier's top so adaptive DPR doesn't hide the difference
    const top = __city.tiers[__city.quality].dpr[1]; __city.renderer.setPixelRatio(Math.min(2, top)); window.dispatchEvent(new Event('resize'));
    await new Promise((r) => setTimeout(r, 1500));
    return { street: await fps(4000), px: `${__city.renderer.domElement.width}x${__city.renderer.domElement.height}` };
  });
  await b.close();
}
console.log(JSON.stringify(out));
