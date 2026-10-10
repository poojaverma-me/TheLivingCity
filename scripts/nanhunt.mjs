#!/usr/bin/env node
// Renders the raw scene (no post) into a float target every frame and reports pixels that are NaN/Inf,
// then raycasts those pixels to name the offending object. Usage: node scripts/nanhunt.mjs [--secs=30] [--mode=title|game]
import puppeteer from 'puppeteer-core';
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d; };
const secs = +arg('secs', 30), mode = arg('mode', 'title');
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', protocolTimeout: 900000, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'], defaultViewport: { width: 1600, height: 900 } });
const p = await b.newPage();
await p.evaluateOnNewDocument(() => { window.WebSocket = class { constructor() { this.readyState = 0; } addEventListener() {} removeEventListener() {} send() {} close() {} }; try { localStorage.clear(); } catch {} });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto('http://127.0.0.1:5321/?shot=game');
await p.waitForFunction(() => window.__city?.ready && window.__city.game, { timeout: 120000 });
const res = await p.evaluate(async (secs, mode) => {
  const C = window.__city; const THREE = await import('/node_modules/.vite/deps/three.js');
  if (mode === 'game') { C.game.start(); await new Promise((r) => setTimeout(r, 6500)); }
  const R = C.renderer, gl = R.getContext();
  const W = 400, H = 225;
  const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.FloatType, depthBuffer: true });
  const buf = new Float32Array(W * H * 4);
  const hits = new Map(); let frames = 0;
  const orig = C.post.composer.render.bind(C.post.composer);
  C.post.composer.render = (dt) => {
    orig(dt);
    if (frames++ % 2) return;
    const prevRT = R.getRenderTarget(); const prevTM = R.toneMapping;
    R.setRenderTarget(rt); R.render(C.scene, C.camera); R.readRenderTargetPixels(rt, 0, 0, W, H, buf); R.setRenderTarget(prevRT);
    for (let i = 0; i < W * H; i++) {
      const r = buf[i * 4], g = buf[i * 4 + 1], bb = buf[i * 4 + 2];
      const mx = Math.max(r, g, bb);
      if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(bb) || mx > 1000) {
        const x = i % W, y = Math.floor(i / W);
        // raycast to find object
        const ndc = new THREE.Vector2((x + 0.5) / W * 2 - 1, (y + 0.5) / H * 2 - 1);
        const rc = new THREE.Raycaster(); rc.setFromCamera(ndc, C.camera);
        rc.params.Points.threshold = 0.05;
        const hs = rc.intersectObjects(C.scene.children, true).filter((h) => !h.object.isSprite).slice(0, 3);
        const name = hs.map((hit) => { let o = hit.object; const chain = []; while (o && chain.length < 4) { chain.push(o.name || o.type); o = o.parent; } return chain.join('<') + `[${hit.object.material?.type}${hit.object.material?.blending === 2 ? ',add' : ''}${hit.object.material?.transparent ? ',tr' : ''}]`; }).join('  |  ') || 'none';
        const k = name; const e = hits.get(k) || { name, count: 0, firstFrame: frames, px: [x, H - y], max: 0 }; e.count++; e.max = Math.max(e.max, Number.isFinite(mx) ? mx : 1e30); hits.set(k, e);
      }
    }
  };
  await new Promise((r) => setTimeout(r, secs * 1000));
  C.post.composer.render = orig;
  return { frames, hits: [...hits.values()].sort((a, b) => b.count - a.count).slice(0, 15) };
}, secs, mode);
console.log(JSON.stringify(res, null, 1)); if (errs.length) console.log('ERR', errs.slice(0, 3));
await b.close();
