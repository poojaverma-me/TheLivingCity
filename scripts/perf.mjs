#!/usr/bin/env node
// Frame-cost breakdown: renders N frames per variant and reports ms/frame + draw calls + triangles.
// Usage: node scripts/perf.mjs [--params="shot=overview"] [--frames=40]
import puppeteer from 'puppeteer-core';
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=').slice(1).join('=') : d; };
const params = arg('params', 'shot=overview'), frames = +arg('frames', 40);
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', protocolTimeout: 600000, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'], defaultViewport: { width: 1600, height: 900, deviceScaleFactor: 1 } });
const p = await b.newPage();
// Stub WebSocket so Vite HMR can't reload the page mid-test while other agents edit files.
await p.evaluateOnNewDocument(() => { window.WebSocket = class { constructor() { this.readyState = 0; } addEventListener() {} removeEventListener() {} send() {} close() {} }; });

await p.goto(`http://127.0.0.1:5321/?${params}`);
await p.waitForFunction(() => window.__city && window.__city.ready, { timeout: 120000 });
const res = await p.evaluate(async (frames) => {
  const C = window.__city; const R = C.renderer, gl = R.getContext();
  const measure = async () => {
    // render synchronously with a GPU sync per frame (readPixels forces completion)
    const px = new Uint8Array(4); let t = 0, calls = 0, tris = 0;
    for (let i = 0; i < frames; i++) {
      R.info.reset(); const t0 = performance.now();
      C.post.composer.render(0.016); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      t += performance.now() - t0; calls = R.info.render.calls; tris = R.info.render.triangles;
      await new Promise((r) => setTimeout(r, 0));
    }
    return { ms: +(t / frames).toFixed(1), calls, mtris: +(tris / 1e6).toFixed(2) };
  };
  const out = {};
  out.baseline = await measure();
  const trans = []; C.scene.traverse((o) => { if (o.material && o.material.transmission > 0) { trans.push([o.material, o.material.transmission]); } });
  trans.forEach(([m]) => { m.transmission = 0; m.needsUpdate = true; });
  out.noTransmission = await measure(); trans.forEach(([m, v]) => { m.transmission = v; m.needsUpdate = true; });
  R.shadowMap.enabled = false; out.noShadows = await measure(); R.shadowMap.enabled = true;
  C.post.ao.enabled = false; out.noAO = await measure(); C.post.ao.enabled = true;
  if (C.world.crowd) { C.world.crowd.object.visible = false; out.noCrowd = await measure(); C.world.crowd.object.visible = true; }
  if (C.world.traffic) { C.world.traffic.object.visible = false; out.noTraffic = await measure(); C.world.traffic.object.visible = true; }
  const parts = {};
  for (const part of C.world.parts) { if (!part.name || !part.visible) continue; part.visible = false; parts[part.name] = (await measure()).ms; part.visible = true; }
  out.withoutPart_ms = parts;
  out.transmissiveMaterials = trans.length;
  return out;
}, frames);
console.log(JSON.stringify(res, null, 1));
await b.close();
