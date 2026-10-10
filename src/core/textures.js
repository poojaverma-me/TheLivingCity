// Procedural canvas textures. Everything is generated at boot, so the game ships no texture files.
import * as THREE from 'three';
import { tileFbm, mulberry32, fbm2 as fbm2l } from './noise.js';

const cache = new Map();
let maxAniso = 8;
export function setMaxAnisotropy(a) { maxAniso = a; }

function canvas(size, h = size) {
  const c = document.createElement('canvas');
  c.width = size; c.height = h;
  return c;
}

function finish(c, { srgb = true, repeat = 1, wrap = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  if (wrap) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.repeat.set(repeat, repeat);
  t.anisotropy = maxAniso;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.needsUpdate = true;
  return t;
}

function memo(key, fn) {
  if (!cache.has(key)) cache.set(key, fn());
  return cache.get(key);
}

/** Sample a tileable height field into a Float32Array. */
function heightField(size, fn) {
  const h = new Float32Array(size * size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) h[y * size + x] = fn(x / size, y / size);
  return h;
}

function normalCanvas(h, size, strength) {
  const c = canvas(size); const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size); const d = img.data;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const l = h[y * size + ((x - 1 + size) % size)], r = h[y * size + ((x + 1) % size)];
    const u = h[((y - 1 + size) % size) * size + x], dn = h[((y + 1) % size) * size + x];
    let nx = (l - r) * strength, ny = (u - dn) * strength, nz = 1;
    const len = Math.hypot(nx, ny, nz); nx /= len; ny /= len; nz /= len;
    const i = (y * size + x) * 4;
    d[i] = (nx * 0.5 + 0.5) * 255; d[i + 1] = (ny * 0.5 + 0.5) * 255; d[i + 2] = (nz * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function grayCanvas(h, size, map = (v) => v) {
  const c = canvas(size); const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size); const d = img.data;
  for (let i = 0; i < size * size; i++) {
    const v = Math.max(0, Math.min(255, map(h[i]) * 255));
    d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Soft organic bumps for biological membranes (blobby, slightly cellular). */
export function membraneNormal() {
  return memo('membraneNormal', () => {
    const S = 512;
    const h = heightField(S, (u, v) => {
      const a = tileFbm(u, v, 6, 3, 3);
      const b = Math.abs(tileFbm(u, v, 14, 2, 9));
      return a * 0.8 - b * 0.5;
    });
    return finish(normalCanvas(h, S, 9), { srgb: false });
  });
}

/** Fine satin/paint micro-variation normal (subtle orange-peel). */
export function paintNormal() {
  return memo('paintNormal', () => {
    const S = 256;
    const h = heightField(S, (u, v) => tileFbm(u, v, 16, 3, 5));
    return finish(normalCanvas(h, S, 2.2), { srgb: false });
  });
}

/** Roughness variation for satin painted surfaces: mostly even, faint smudges. */
export function paintRoughness() {
  return memo('paintRough', () => {
    const S = 256;
    const h = heightField(S, (u, v) => tileFbm(u, v, 4, 4, 21));
    return finish(grayCanvas(h, S, (x) => 0.82 + x * 0.35), { srgb: false });
  });
}

/** Asphalt colour map: fine aggregate grain + soft large stains. */
export function asphaltColor() {
  return memo('asphalt', () => {
    const S = 512; const rnd = mulberry32(7);
    const big = heightField(S, (u, v) => tileFbm(u, v, 3, 4, 41));
    const c = canvas(S); const ctx = c.getContext('2d');
    const img = ctx.createImageData(S, S); const d = img.data;
    for (let i = 0; i < S * S; i++) {
      const g = rnd(), k = big[i];
      let v = 0.40 + k * 0.10 + (g - 0.5) * 0.10 + (g > 0.985 ? 0.12 : 0) - (g < 0.02 ? 0.08 : 0);
      d[i * 4] = v * 255 * 0.97; d[i * 4 + 1] = v * 255 * 1.0; d[i * 4 + 2] = v * 255 * 1.06; d[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return finish(c);
  });
}
export function asphaltNormal() {
  return memo('asphaltN', () => {
    const S = 512; const rnd = mulberry32(8);
    const h = heightField(S, (u, v) => tileFbm(u, v, 32, 2, 3) * 0.6 + (rnd() - 0.5) * 0.35);
    return finish(normalCanvas(h, S, 3), { srgb: false });
  });
}

/**
 * Cytosol plaza pavers: running-bond stones with bevelled edges, per-stone tone variation,
 * large-scale colour drift (cool blue-grey to faint lavender), grime in the joints.
 * Returns {map, normal, rough} sharing one layout. 1 texture tile = 16 x 32 stones.
 */
function paverField(S) {
  const cols = 16, rows = 32;
  const rnd = mulberry32(31);
  const tone = Array.from({ length: cols * rows }, () => rnd());
  const big = heightField(128, (u, v) => tileFbm(u, v, 3, 4, 77));
  const wet = heightField(128, (u, v) => tileFbm(u, v, 5, 4, 13));
  const grain = heightField(S, (u, v) => tileFbm(u, v, 64, 2, 5));
  const H = new Float32Array(S * S), C = new Float32Array(S * S * 3), R = new Float32Array(S * S);
  const sw = S / cols, sh = S / rows;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const row = Math.floor(y / sh);
    const xo = (x + (row % 2) * sw / 2) % S;
    const col = Math.floor(xo / sw);
    const fx = (xo % sw) / sw, fy = (y % sh) / sh;
    const ex = Math.min(fx, 1 - fx) * sw, ey = Math.min(fy, 1 - fy) * sh; // px to edge
    const e = Math.min(ex, ey);
    const bevel = Math.min(1, e / 2.6);
    const joint = e < 0.9;
    const i = y * S + x;
    const tn = tone[(row * cols + col) % tone.length];
    const b = big[((y >> 3) % 128) * 128 + ((x >> 3) % 128)];
    const w = wet[((y >> 3) % 128) * 128 + ((x >> 3) % 128)];
    const g = grain[i];
    H[i] = joint ? -0.6 : bevel * 0.5 + g * 0.15;
    let v = 0.78 + (tn - 0.5) * 0.05 + b * 0.03 + g * 0.035;
    if (joint) v *= 0.7; else v *= 0.93 + 0.07 * bevel;
    const cool = 0.5 + b;
    C[i * 3] = v * (0.90 + 0.04 * (1 - cool)); C[i * 3 + 1] = v * 0.97; C[i * 3 + 2] = v * (1.06 + 0.04 * cool);
    // wet sheen in patches: lower roughness
    const wetMask = Math.max(0, Math.min(1, (w - 0.12) * 3)) * 0.6;
    R[i] = joint ? 0.95 : 0.7 - wetMask * 0.2 + (tn - 0.5) * 0.08;
  }
  return { H, C, R };
}
function plazaSet() {
  return memo('plazaSet', () => {
    const S = 1024; const { H, C, R } = paverField(S);
    const c = canvas(S); const ctx = c.getContext('2d'); const img = ctx.createImageData(S, S);
    for (let i = 0; i < S * S; i++) {
      img.data[i * 4] = Math.min(255, C[i * 3] * 255); img.data[i * 4 + 1] = Math.min(255, C[i * 3 + 1] * 255);
      img.data[i * 4 + 2] = Math.min(255, C[i * 3 + 2] * 255); img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    const rough = grayCanvas(R, S);
    return { map: finish(c), normal: finish(normalCanvas(H, S, 3.2), { srgb: false }), rough: finish(rough, { srgb: false }) };
  });
}
export const plazaColor = () => plazaSet().map;
export const plazaNormal = () => plazaSet().normal;
export const plazaRough = () => plazaSet().rough;

/** Brushed metal (anisotropic-looking streaks). */
export function brushedRoughness() {
  return memo('brushed', () => {
    const S = 256; const rnd = mulberry32(5);
    const rows = Array.from({ length: S }, () => rnd());
    const c = canvas(S); const ctx = c.getContext('2d');
    const img = ctx.createImageData(S, S); const d = img.data;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const v = 0.32 + rows[y] * 0.18 + (rnd() - 0.5) * 0.05;
      const i = (y * S + x) * 4; d[i] = d[i + 1] = d[i + 2] = v * 255; d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return finish(c, { srgb: false });
  });
}

/** Grid of warm, lit windows with mullions; used as emissive+color. rows×cols panes. */
export function windowsTexture(cols = 8, rows = 3, seed = 1, warm = '#ffe2a8') {
  return memo(`win${cols}x${rows}:${seed}:${warm}`, () => {
    const W = 512, H = Math.round(512 * rows / cols * 1.6);
    const c = canvas(W, H); const ctx = c.getContext('2d'); const rnd = mulberry32(seed);
    ctx.fillStyle = '#1b1a22'; ctx.fillRect(0, 0, W, H);
    const pw = W / cols, ph = H / rows;
    for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
      const lit = rnd() > 0.12;
      const x = q * pw + pw * 0.12, y = r * ph + ph * 0.14, w = pw * 0.76, h = ph * 0.72;
      const g = ctx.createLinearGradient(0, y, 0, y + h);
      if (lit) { g.addColorStop(0, warm); g.addColorStop(1, '#f6b765'); }
      else { g.addColorStop(0, '#3a3c4a'); g.addColorStop(1, '#23242e'); }
      ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
      // interior silhouettes
      if (lit && rnd() > 0.5) {
        ctx.fillStyle = 'rgba(80,50,30,0.35)';
        ctx.fillRect(x + w * rnd() * 0.6, y + h * 0.45, w * 0.18, h * 0.55);
      }
      ctx.fillStyle = 'rgba(40,30,30,0.5)'; ctx.fillRect(x + w / 2 - 1, y, 2, h);
    }
    const t = finish(c, { wrap: true });
    return t;
  });
}

/** Animated-looking control-room screen: DNA helix, bar charts, scrolling text. */
export function screenTexture(kind = 0) {
  return memo(`screen${kind}`, () => {
    const W = 256, H = 160; const c = canvas(W, H); const ctx = c.getContext('2d');
    const rnd = mulberry32(100 + kind);
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0b2a4a'); bg.addColorStop(1, '#06182e');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(120,220,255,0.18)'; ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 16) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 16) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    const k = kind % 8;
    if (k === 0) { // DNA helix
      for (let i = 0; i < 2; i++) {
        ctx.strokeStyle = i ? '#ff9ad5' : '#7fe3ff'; ctx.lineWidth = 3; ctx.beginPath();
        for (let x = 10; x < W - 10; x += 2) {
          const y = H / 2 + Math.sin(x * 0.06 + i * Math.PI) * 40;
          x === 10 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      for (let x = 14; x < W - 10; x += 9) {
        const y1 = H / 2 + Math.sin(x * 0.06) * 40, y2 = H / 2 + Math.sin(x * 0.06 + Math.PI) * 40;
        ctx.strokeStyle = ['#ffd75e', '#8dff8a', '#ff7a7a', '#a49bff'][Math.floor(rnd() * 4)];
        ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y1); ctx.lineTo(x, y2); ctx.stroke();
      }
    } else if (k === 1) { // bars
      for (let i = 0; i < 14; i++) {
        const h = 20 + rnd() * 100; ctx.fillStyle = i % 3 ? '#4cc9ff' : '#9b7bff';
        ctx.fillRect(14 + i * 16, H - 16 - h, 10, h);
      }
    } else if (k === 2) { // sequence text
      ctx.font = 'bold 13px monospace';
      const b = 'ATGC';
      for (let r = 0; r < 9; r++) {
        let s = ''; for (let i = 0; i < 28; i++) s += b[Math.floor(rnd() * 4)];
        ctx.fillStyle = r === 4 ? '#ffe27a' : '#8fe6ff'; ctx.fillText(s, 10, 22 + r * 16);
      }
    } else if (k === 4) { // protein ribbon render
      ctx.lineWidth = 6; ctx.lineCap = 'round';
      const cols = ['#ff7ab8', '#ffd25e', '#6ef0c2'];
      for (let s = 0; s < 3; s++) {
        ctx.strokeStyle = cols[s]; ctx.beginPath();
        for (let x = 20; x < W - 20; x += 3) { const y = H / 2 + Math.sin(x * 0.07 + s * 2) * 30 + Math.sin(x * 0.023 + s) * 18; x === 20 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
        ctx.stroke();
      }
    } else if (k === 5) { // chromosome karyogram
      for (let i = 0; i < 12; i++) {
        const h = 30 + rnd() * 70, x = 14 + i * 20;
        ctx.fillStyle = '#c9a8ff'; ctx.beginPath(); ctx.roundRect(x, H - 20 - h, 8, h, 4); ctx.fill();
        ctx.fillStyle = 'rgba(40,10,80,0.6)'; for (let b = 0; b < 4; b++) ctx.fillRect(x, H - 20 - h + rnd() * h, 8, 3);
      }
    } else if (k === 6) { // waveform / transcription rate
      ctx.strokeStyle = '#7dffb0'; ctx.lineWidth = 2; ctx.beginPath();
      for (let x = 0; x < W; x += 2) { const y = H / 2 + Math.sin(x * 0.15) * Math.sin(x * 0.02) * 45; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke();
      ctx.fillStyle = '#ffe27a'; ctx.font = 'bold 22px monospace'; ctx.fillText('mRNA 1,284/s', 60, 40);
    } else if (k === 7) { // pie / gauges
      const vals = [0.35, 0.25, 0.2, 0.2], cs = ['#4cc9ff', '#9b7bff', '#ff8fb8', '#ffd25e']; let a0 = -Math.PI / 2;
      vals.forEach((v, i) => { ctx.fillStyle = cs[i]; ctx.beginPath(); ctx.moveTo(80, H / 2 + 6); ctx.arc(80, H / 2 + 6, 50, a0, a0 + v * Math.PI * 2); ctx.fill(); a0 += v * Math.PI * 2; });
      for (let i = 0; i < 4; i++) { ctx.fillStyle = cs[i]; ctx.fillRect(150, 40 + i * 26, 70 * vals[i] * 3, 14); }
    } else { // cell map radar (k === 3)
      ctx.strokeStyle = '#7fe3ff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(W / 2, H / 2, 90, 60, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#b48cff'; ctx.beginPath(); ctx.arc(W / 2, H / 2 - 20, 22, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff9a4a'; ctx.fillRect(W / 2 - 60, H / 2 + 6, 30, 14); ctx.fillRect(W / 2 - 40, H / 2 + 30, 30, 14);
      ctx.fillStyle = '#ff7fb0'; ctx.fillRect(W / 2 + 20, H / 2 + 22, 30, 16);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = 'bold 10px sans-serif';
    ctx.fillText(['GENOME VIEW', 'EXPRESSION', 'SEQUENCER', 'CELL MAP', 'PROTEIN FOLD', 'KARYOTYPE', 'TRANSCRIPTION', 'RESOURCES'][k], 8, 12);
    return finish(c, { wrap: false });
  });
}

/** Generic RGBA radial blob used for glows, soft shadows, sprites. */
export function radialTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)', size = 128) {
  return memo(`radial${inner}${outer}${size}`, () => {
    const c = canvas(size); const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, inner); g.addColorStop(1, outer);
    ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
    return finish(c, { wrap: false });
  });
}

/** Text/sign texture. */
export function signTexture(text, { bg = '#2b2f3a', fg = '#ffffff', w = 512, h = 128, font = '700 64px Montserrat, sans-serif', border = null } = {}) {
  return memo(`sign:${text}:${bg}:${fg}:${w}x${h}`, () => {
    const c = canvas(w, h); const ctx = c.getContext('2d');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    if (border) { ctx.strokeStyle = border; ctx.lineWidth = 8; ctx.strokeRect(4, 4, w - 8, h - 8); }
    ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    // auto-fit: shrink the font until the text fits inside the board with a margin
    const m = font.match(/(\d+(?:\.\d+)?)px/); let size = m ? +m[1] : 64;
    const setFont = () => { ctx.font = font.replace(/\d+(?:\.\d+)?px/, `${size}px`); };
    setFont();
    while (size > 8 && (ctx.measureText(text).width > w * 0.9 || size > h * 0.72)) { size -= 2; setFont(); }
    ctx.fillText(text, w / 2, h / 2 + 2);
    return finish(c, { wrap: false });
  });
}

/**
 * Whole-floor macro map (used as aoMap on uv1 spanning the cell): large non-repeating tone drift,
 * darkening toward the membrane, soft contact darkening around given footprints [{x,z,r}].
 * insideFn(x,z,inset) tests the cell outline; extent = {a,b}.
 */
export function floorMacro(extent, insideFn, footprints = []) {
  const S = 512; const c = canvas(S); const ctx = c.getContext('2d'); const img = ctx.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const wx = (x / S * 2 - 1) * extent.a, wz = (y / S * 2 - 1) * extent.b;
    let v = 1;
    // edge darkening: sample how far inside the outline we are
    let edge = 1;
    for (const d of [0.6, 1.5, 3, 5]) if (!insideFn(wx, wz, d)) edge -= 0.09;
    v *= edge;
    const n1 = fbm2l(wx * 0.045, wz * 0.045) * 0.5 + 0.5, n2 = fbm2l(wx * 0.11 + 9, wz * 0.11 - 4) * 0.5 + 0.5;
    v *= 0.84 + 0.16 * n1;
    for (const f of footprints) {
      const dd = Math.hypot(wx - f.x, wz - f.z) - f.r;
      if (dd < 3.5) v *= 0.78 + 0.22 * Math.max(0, dd) / 3.5;
    }
    // faint hue drift: lavender ↔ teal patches so the plaza never reads as one repeated tile
    const tr = 1 + (n2 - 0.5) * 0.10, tg = 1 - (n2 - 0.5) * 0.02, tb = 1 - (n2 - 0.5) * 0.06;
    const i = (y * S + x) * 4;
    img.data[i] = Math.max(0, Math.min(255, v * tr * 255)); img.data[i + 1] = Math.max(0, Math.min(255, v * tg * 255));
    img.data[i + 2] = Math.max(0, Math.min(255, v * tb * 255)); img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = finish(c, { srgb: false, wrap: false });
  t.channel = 1;
  return t;
}

/** Hex-packed bead bumps: the phospholipid-head surface of a bilayer (tileable). beadsX beads per row. */
export function beadNormal(beadsX = 24) {
  return memo(`beads${beadsX}`, () => {
    const S = 512; const rnd = mulberry32(17);
    const r = S / beadsX / 2, rowH = r * Math.sqrt(3);
    const rows = Math.round(S / rowH); const rh = S / rows;
    const h = new Float32Array(S * S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const row = Math.round(y / rh);
      let best = 1e9;
      for (let dr = -1; dr <= 1; dr++) {
        const rr = row + dr, cy = rr * rh, off = (((rr % 2) + 2) % 2) * r;
        const col = Math.round((x - off) / (2 * r));
        for (let dc = -1; dc <= 1; dc++) {
          const cx = (col + dc) * 2 * r + off;
          const d = Math.hypot(x - cx, y - cy); if (d < best) best = d;
        }
      }
      const t = Math.max(0, 1 - best / (r * 0.98));
      h[y * S + x] = Math.sqrt(t) + (rnd() - 0.5) * 0.04;
    }
    return finish(normalCanvas(h, S, 5), { srgb: false });
  });
}
