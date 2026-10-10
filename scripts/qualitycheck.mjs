#!/usr/bin/env node
// Verifies graphics tiers: applied settings, fps, draw cost, console errors.
// Usage: node scripts/qualitycheck.mjs [--gpu=metal|swiftshader] [--tiers=low,medium,high,auto] [--autoTier=high]
import puppeteer from 'puppeteer-core';
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d; };
const gpu = arg('gpu', 'metal'), tiers = arg('tiers', 'low,medium,high,auto').split(','), autoTier = arg('autoTier', '');
const flags = gpu === 'swiftshader' ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'];
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', protocolTimeout: 900000, args: flags, defaultViewport: { width: 1600, height: 900 } });
for (const t of tiers) {
  const p = await b.newPage();
  await p.evaluateOnNewDocument((autoTier) => {
    window.WebSocket = class { constructor() { this.readyState = 0; } addEventListener() {} removeEventListener() {} send() {} close() {} };
    try { localStorage.clear(); if (autoTier) localStorage.setItem('livingCity.autoTier', autoTier); } catch {}
  }, autoTier);
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  const q = t === 'auto' ? '' : `&q=${t}`;
  const t0 = Date.now();
  await p.goto(`http://127.0.0.1:5321/?shot=game${q}`);
  try { await p.waitForFunction(() => window.__city?.ready && window.__city.game, { timeout: 300000 }); } catch { console.log(t, 'NEVER READY', errs.slice(0, 3)); await p.close(); continue; }
  const loadS = ((Date.now() - t0) / 1000).toFixed(1);
  const r = await p.evaluate(async () => {
    const C = window.__city;
    C.game.start(); await new Promise((r) => setTimeout(r, 6000));          // into gameplay (street-level follow cam)
    const fps = () => new Promise((res) => { let n = 0; const t0 = performance.now(); (function f() { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else res(+(n / 3).toFixed(1)); })(); });
    const street = await fps(); const qStreet = C.quality;
    C.game.rig.setZoom(1); await new Promise((r) => setTimeout(r, 2500)); const overview = await fps();
    await new Promise((r) => setTimeout(r, 9000)); const later = await fps();            // let the auto step-down settle
    let lights = 0; C.scene.traverse((o) => { if (o.isPointLight && o.visible && o.parent === C.scene) lights++; });
    let motes = 0; C.scene.traverse((o) => { if (o.name === 'motes') motes = o.geometry.attributes.position.count; });
    return {
      tier: C.quality, tierAtStreet: qStreet, gpu: C.gpu.slice(0, 50), dpr: +C.renderer.getPixelRatio().toFixed(2),
      ao: C.post.ao.enabled, shadow: C.studio.key.shadow.mapSize.x, bloomLevels: C.post.bloom.mipmapBlurPass?.levels,
      lightSlots: lights, crowd: C.world.crowd?.count ?? C.world.crowd?.agents?.length, traffic: C.world.traffic?.vehicles?.length, motes,
      fps: { street, overview, later }, calls: C.renderer.info.render.calls, mtris: +(C.renderer.info.render.triangles / 1e6).toFixed(2),
      stored: { choice: localStorage.getItem('livingCity.graphics'), autoTier: localStorage.getItem('livingCity.autoTier') },
    };
  });
  console.log(`${t.padEnd(6)} load ${loadS}s`, JSON.stringify(r), errs.length ? `ERRORS: ${errs.slice(0, 3).join(' | ')}` : 'errors: 0');
  await p.close();
}
await b.close();
