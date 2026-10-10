#!/usr/bin/env node
// Detects transient black blocks: reads back every rendered frame, tracks per-cell darkness, and flags
// cells that turn near-black for 1–3 frames then recover. Usage: node scripts/flashcheck.mjs [--secs=20] [--mode=game|title|street]
import puppeteer from 'puppeteer-core';
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d; };
const secs = +arg('secs', 20), mode = arg('mode', 'game'), q = arg('q', ''), pre = arg('pre', '');
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', protocolTimeout: 900000, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'], defaultViewport: { width: 1600, height: 900 } });
const p = await b.newPage();
await p.evaluateOnNewDocument(() => { window.WebSocket = class { constructor() { this.readyState = 0; } addEventListener() {} removeEventListener() {} send() {} close() {} }; try { localStorage.clear(); } catch {} });
await p.goto(`http://127.0.0.1:5321/?shot=game${q ? '&q=' + q : ''}`);
await p.waitForFunction(() => window.__city?.ready && window.__city.game, { timeout: 120000 });
const res = await p.evaluate(async (secs, mode, pre) => {
  const C = window.__city;
  if (mode !== 'title') { C.game.start(); await new Promise((r) => setTimeout(r, 6500)); }
  if (mode === 'street') { C.game.rig.setZoom(0.0); }
  if (pre) (new Function('C', pre))(C);
  const gl = C.renderer.getContext(); const cv = C.renderer.domElement;
  let W = cv.width, H = cv.height; const GX = 40, GY = 22;
  let buf = new Uint8Array(W * H * 4);
  const hist = []; const events = [];
  const orig = C.post.composer.render.bind(C.post.composer);
  let frame = 0;
  C.post.composer.render = (dt) => {
    orig(dt);
    if (cv.width !== W || cv.height !== H) { W = cv.width; H = cv.height; buf = new Uint8Array(W * H * 4); }
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    const cells = new Float32Array(GX * GY);
    for (let gy = 0; gy < GY; gy++) for (let gx = 0; gx < GX; gx++) {
      let dark = 0, n = 0;
      const x0 = Math.floor(gx * W / GX), x1 = Math.floor((gx + 1) * W / GX), y0 = Math.floor(gy * H / GY), y1 = Math.floor((gy + 1) * H / GY);
      for (let y = y0; y < y1; y += 3) for (let x = x0; x < x1; x += 3) {
        const i = (y * W + x) * 4; if (buf[i] + buf[i + 1] + buf[i + 2] < 24) dark++; n++;
      }
      cells[gy * GX + gx] = dark / n;
    }
    window.__prevBuf = window.__curBuf || buf.slice(); window.__curBuf = buf.slice();
    hist.push({ f: frame++, t: performance.now(), cells });
    if (hist.length > 6) hist.shift();
    // a cell that was light 2 frames ago, is dark now or 1 frame ago, and light again → transient
    if (hist.length >= 4) {
      const a = hist[hist.length - 4].cells, m1 = hist[hist.length - 3].cells, m2 = hist[hist.length - 2].cells, z = hist[hist.length - 1].cells;
      let newDark = 0;
      for (let k = 0; k < cells.length; k++) if (a[k] < 0.1 && m2[k] > 0.5) newDark++;
      if (newDark > 60 && !window.__flashImg) {
        // save the frame that went dark (current buffer is one frame later; re-read prev not possible: grab now)
        const c2 = document.createElement('canvas'); c2.width = W / 2; c2.height = H / 2; const x2 = c2.getContext('2d');
        const id = x2.createImageData(W / 2, H / 2);
        for (let y = 0; y < H / 2; y++) for (let x = 0; x < W / 2; x++) { const si = ((H - 1 - y * 2) * W + x * 2) * 4, di = (y * (W / 2) + x) * 4; id.data[di] = window.__prevBuf[si]; id.data[di + 1] = window.__prevBuf[si + 1]; id.data[di + 2] = window.__prevBuf[si + 2]; id.data[di + 3] = 255; }
        x2.putImageData(id, 0, 0); window.__flashImg = c2.toDataURL('image/png');
      }
      for (let k = 0; k < cells.length; k++) {
        const peak = Math.max(m1[k], m2[k]);
        if (a[k] < 0.1 && z[k] < 0.1 && peak > 0.5) events.push({ frame: hist[hist.length - 2].f, cell: [k % GX, Math.floor(k / GX)], px: [Math.round((k % GX) * 1600 / GX), Math.round(900 - (Math.floor(k / GX) + 1) * 900 / GY)], peak: +peak.toFixed(2) });
      }
    }
  };
  let flips = 0;
  const iv = mode === 'resize' ? setInterval(() => {
    const r = C.renderer; const d = r.getPixelRatio() > 0.9 ? 0.85 : 1.0; r.setPixelRatio(d);
    const el = document.getElementById('app'); r.setSize(el.clientWidth, el.clientHeight); C.post.composer.setSize(el.clientWidth, el.clientHeight); flips++;
  }, 1500) : null;
  await new Promise((r) => setTimeout(r, secs * 1000));
  if (iv) clearInterval(iv);
  C.post.composer.render = orig;
  const byFrame = {}; for (const e of events) byFrame[e.frame] = (byFrame[e.frame] || 0) + 1;
  return { frames: frame, flips, total: events.length, byFrame, img: window.__flashImg || null };
}, secs, mode, pre);
if (res.img) { (await import('node:fs')).writeFileSync('docs/qa/shots/flash-frame.png', Buffer.from(res.img.split(',')[1], 'base64')); delete res.img; console.log('saved docs/qa/shots/flash-frame.png'); }
console.log(JSON.stringify(res));
await b.close();
