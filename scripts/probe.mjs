#!/usr/bin/env node
// Evaluate a JS expression in the running game (headless) and print the JSON result.
// Usage: node scripts/probe.mjs "<expr>" [--params="shot=street&only=nucleus"]
import puppeteer from 'puppeteer-core';
const expr = process.argv[2];
const pArg = process.argv.find((a) => a.startsWith('--params='));
const params = pArg ? pArg.slice(9) : 'shot=overview';
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'], defaultViewport: { width: 1600, height: 900 } });
const p = await b.newPage();
// Stub WebSocket so Vite HMR can't reload the page mid-test while other agents edit files.
await p.evaluateOnNewDocument(() => { window.WebSocket = class { constructor() { this.readyState = 0; } addEventListener() {} removeEventListener() {} send() {} close() {} }; });

const logs = []; p.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()); }); p.on('pageerror', (e) => logs.push(e.message));
await p.goto(`http://127.0.0.1:5321/?${params}`);
await p.waitForFunction(() => window.__city && window.__city.ready, { timeout: 60000 });
await new Promise((r) => setTimeout(r, 800));
const out = await p.evaluate(`(async () => (${expr}))()`);
console.log(JSON.stringify(out, null, 1)); if (logs.length) console.log('ERRORS', logs.slice(0, 10));
await b.close();
