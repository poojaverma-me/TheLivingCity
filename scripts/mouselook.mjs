import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', protocolTimeout: 600000, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'], defaultViewport: { width: 1600, height: 900 } });
const p = await b.newPage();
await p.evaluateOnNewDocument(() => { window.WebSocket = class { constructor() {} addEventListener() {} removeEventListener() {} send() {} close() {} }; try { localStorage.clear(); } catch {} });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto('http://127.0.0.1:5321/?shot=game');
await p.waitForFunction(() => window.__city?.ready && window.__city.game, { timeout: 120000 });
await p.evaluate(() => document.querySelector('[data-a=start]').click()); await new Promise((r) => setTimeout(r, 7000));
await p.mouse.move(800, 450);
console.log(await p.evaluate(() => ({ st: __city.game.state, fp: __city.game.fp, focus: document.activeElement?.tagName })));
await p.keyboard.press('v'); await new Promise((r) => setTimeout(r, 1200));
console.log(await p.evaluate(() => ({ st: __city.game.state, fp: __city.game.fp })));
const g = () => p.evaluate(() => ({ yaw: +__city.game.fpYaw.toFixed(3), pitch: +__city.game.fpPitch.toFixed(3), locked: !!document.pointerLockElement, cross: !!document.querySelector('.crosshair'), free: document.querySelector('.crosshair')?.classList.contains('free') }));
const a = await g();
for (let i = 1; i <= 20; i++) await p.mouse.move(800 + i * 15, 450 - i * 4);   // move right and up
await new Promise((r) => setTimeout(r, 300));
const c = await g();
await p.screenshot({ path: 'docs/qa/shots/mlook-after.png' });
await p.evaluate(() => document.exitPointerLock()); await new Promise((r) => setTimeout(r, 300));
await p.evaluate(() => { window.__mv = []; window.addEventListener('pointermove', (e) => window.__mv.push([e.movementX, e.movementY, e.target.tagName, e.pointerType])); });
const d0 = await g();
for (let i = 1; i <= 20; i++) await p.mouse.move(1100 - i * 15, 370);   // free cursor, move left
await new Promise((r) => setTimeout(r, 300));
const d1 = await g();
await p.screenshot({ path: 'docs/qa/shots/mlook-free.png' });
console.log(JSON.stringify({ freeBefore: d0, freeAfter: d1, mv: await p.evaluate(() => window.__mv.slice(0, 6)) }));
console.log(JSON.stringify({ start: a, afterMove: c, yawChanged: c.yaw !== a.yaw, pitchChanged: c.pitch !== a.pitch, errs }));
await b.close();
