// Procedural canvas textures for the city fabric (facades, signage, road paint, pavers, lawn).
import * as THREE from 'three';
import { mulberry32 } from '../../core/noise.js';

const cache = new Map();
const memo = (k, f) => { if (!cache.has(k)) cache.set(k, f()); return cache.get(k); };
function cv(w, h = w) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function tex(c, { srgb = true, wrap = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  if (wrap) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.needsUpdate = true;
  return t;
}

/**
 * Facade atlas (512×1024): 8 horizontal strips of 128px, each tileable along U.
 *   0 warm office · 1 cool lab · 2 roller door · 3 louvre · 4 tall narrow panes · 5 blinds (mixed)
 *   6 industrial (mostly dark, few lit) · 7 shopfront
 * ~30% of panes are dark; lit panes vary in brightness/tint so façades never glow uniformly.
 * Returns { map, emissive }.
 */
export const FACADE_STRIP = { warm: 0, cool: 1, roller: 2, louvre: 3, tall: 4, blinds: 5, industrial: 6, shop: 7 };
export function facadeAtlas() {
  return memo('facade8', () => {
    const S = 512, H = 128, NS = 8;
    const c = cv(S, S * 2), e = cv(S, S * 2); const x = c.getContext('2d'), y = e.getContext('2d');
    const rnd = mulberry32(77);
    y.fillStyle = '#000'; y.fillRect(0, 0, S, S * 2);
    const glassDark = ['#33404f', '#2a3542', '#3c4757'];
    // Daylight glazing: ~35%+ sky-reflective glossy panes (no emission), most others show a softly lit
    // interior (emissive ≈0.18), and only ~12% are warm accent lights (emissive ≈0.9).
    const pane = (px, py, w, h, kind, darkP) => {
      const r = rnd();
      if (r < Math.max(0.35, darkP)) {
        const g = x.createLinearGradient(px, py, px + w * 0.4, py + h); g.addColorStop(0, '#b8d4ec'); g.addColorStop(0.55, '#7ea6cb'); g.addColorStop(1, '#4f7398');
        x.fillStyle = g; x.fillRect(px, py, w, h);
        x.fillStyle = 'rgba(255,255,255,0.35)'; x.beginPath(); x.moveTo(px, py); x.lineTo(px + w * 0.5, py); x.lineTo(px, py + h * 0.7); x.fill();
        x.fillStyle = 'rgba(255,255,255,0.18)'; x.fillRect(px + w * 0.62, py, w * 0.08, h);
        return;
      }
      const warm = r > 0.88;
      const tints = warm ? [['#ffeac0', '#ffc888']] : kind === 'cool' ? [['#dfe8ee', '#a9bccb'], ['#e8ecef', '#b8c4cf']] : [['#ece6da', '#c9bfae'], ['#e2e6ea', '#b3bfca']];
      const [t0, t1] = tints[Math.floor(rnd() * tints.length)];
      const k = warm ? 0.85 + rnd() * 0.15 : 0.14 + rnd() * 0.1;
      for (const [ctx, isE] of [[x, false], [y, true]]) {
        const g = ctx.createLinearGradient(0, py, 0, py + h); g.addColorStop(0, t0); g.addColorStop(1, t1);
        ctx.globalAlpha = isE ? k : 1; ctx.fillStyle = g; ctx.fillRect(px, py, w, h); ctx.globalAlpha = 1;
        ctx.fillStyle = isE ? 'rgba(0,0,0,0.5)' : 'rgba(70,60,50,0.28)';
        if (rnd() > 0.45) ctx.fillRect(px + w * (0.1 + rnd() * 0.55), py + h * 0.4, w * 0.18, h * 0.6);
        if (rnd() > 0.6) ctx.fillRect(px, py + h * 0.62, w, h * 0.08);
      }
      // glass reflection over the interior
      x.fillStyle = 'rgba(200,225,250,0.22)'; x.beginPath(); x.moveTo(px, py); x.lineTo(px + w * 0.45, py); x.lineTo(px, py + h * 0.6); x.fill();
    };
    const frameBg = (oy, col = '#2b2e36') => { x.fillStyle = col; x.fillRect(0, oy, S, H); };
    // 0 warm office, 1 cool lab: 8 panes, glazing bar
    for (const [strip, kind, darkP] of [[0, 'warm', 0.3], [1, 'cool', 0.28]]) {
      const oy = strip * H; frameBg(oy);
      for (let i = 0; i < 8; i++) { const px = i * 64 + 5, py = oy + 12; pane(px, py, 54, H - 24, kind, darkP); x.fillStyle = 'rgba(30,32,40,0.9)'; x.fillRect(px + 25, py, 4, H - 24); y.fillStyle = '#000'; y.fillRect(px + 25, py, 4, H - 24); x.fillStyle = 'rgba(255,255,255,0.3)'; x.fillRect(px, py + H - 27, 54, 3); }
    }
    // 2 roller door
    { const oy = 2 * H; const g = x.createLinearGradient(0, oy, 0, oy + H); g.addColorStop(0, '#b4bcc6'); g.addColorStop(1, '#8a939f'); x.fillStyle = g; x.fillRect(0, oy, S, H);
      for (let k = 0; k < 13; k++) { x.fillStyle = 'rgba(40,46,56,0.4)'; x.fillRect(0, oy + 4 + k * 8.4, S, 2); x.fillStyle = 'rgba(255,255,255,0.3)'; x.fillRect(0, oy + 6 + k * 8.4, S, 1); }
      for (let k = -2; k < 26; k++) { x.fillStyle = k % 2 ? '#e8b81b' : '#24262c'; x.beginPath(); const bx = k * 24; x.moveTo(bx, oy + H); x.lineTo(bx + 24, oy + H); x.lineTo(bx + 36, oy + H - 12); x.lineTo(bx + 12, oy + H - 12); x.fill(); } }
    // 3 louvre
    { const oy = 3 * H; for (let k = 0; k < 16; k++) { const g = x.createLinearGradient(0, oy + k * 8, 0, oy + k * 8 + 8); g.addColorStop(0, '#d0d6dc'); g.addColorStop(1, '#4d545e'); x.fillStyle = g; x.fillRect(0, oy + k * 8, S, 8); } }
    // 4 tall narrow panes (12 per tile)
    { const oy = 4 * H; frameBg(oy, '#30343c'); for (let i = 0; i < 12; i++) { const pw = S / 12; pane(i * pw + 4, oy + 8, pw - 8, H - 16, rnd() < 0.5 ? 'cool' : 'warm', 0.32); } }
    // 5 blinds: panes with half-lowered blinds
    { const oy = 5 * H; frameBg(oy); for (let i = 0; i < 8; i++) { const px = i * 64 + 5, py = oy + 12; pane(px, py, 54, H - 24, 'warm', 0.25); const bh = (H - 24) * (0.2 + rnd() * 0.6); for (const ctx of [x, y]) { ctx.fillStyle = ctx === x ? '#d9d4c8' : '#000'; ctx.fillRect(px, py, 54, bh); } for (let k = 0; k < bh; k += 5) { x.fillStyle = 'rgba(120,110,95,0.35)'; x.fillRect(px, py + k, 54, 1); } } }
    // 6 industrial: small high windows, mostly dark
    { const oy = 6 * H; frameBg(oy, '#3a3f48'); for (let i = 0; i < 6; i++) { const pw = S / 6; pane(i * pw + 8, oy + 20, pw - 16, H - 40, 'warm', 0.62); x.strokeStyle = 'rgba(20,20,25,0.8)'; x.lineWidth = 3; x.strokeRect(i * pw + 8, oy + 20, pw - 16, H - 40); x.beginPath(); x.moveTo(i * pw + pw / 2, oy + 20); x.lineTo(i * pw + pw / 2, oy + H - 20); x.moveTo(i * pw + 8, oy + H / 2); x.lineTo(i * pw + pw - 8, oy + H / 2); x.stroke(); } }
    // 7 shopfront: big panes with a display shelf
    { const oy = 7 * H; frameBg(oy, '#262a31'); for (let i = 0; i < 3; i++) { const pw = S / 3; pane(i * pw + 6, oy + 6, pw - 12, H - 12, 'warm', 0.12); x.fillStyle = 'rgba(90,70,50,0.45)'; x.fillRect(i * pw + 6, oy + H * 0.7, pw - 12, 6); for (let k = 0; k < 5; k++) { x.fillStyle = ['#e05a5a', '#5aa0e0', '#f0c040', '#60c060', '#c070e0'][k]; x.fillRect(i * pw + 16 + k * 28, oy + H * 0.58, 18, 14); } } }
    return { map: tex(c), emissive: tex(e) };
  });
}

/** Sign atlas: labels on coloured boards. Returns { texture, uv(label) -> [u0,v0,u1,v1] }. */
export function signAtlas(entries) {
  const key = 'signs:' + entries.map((q) => q.text + q.bg).join('|');
  return memo(key, () => {
    const W = 1024, rowH = 64, cols = 2, cw = W / cols;
    const rows = Math.ceil(entries.length / cols);
    const H = Math.max(64, 2 ** Math.ceil(Math.log2(rows * rowH)));
    const c = cv(W, H); const x = c.getContext('2d');
    x.fillStyle = '#222'; x.fillRect(0, 0, W, H);
    const uvs = new Map();
    entries.forEach((q, i) => {
      const cx = (i % cols) * cw, cy = Math.floor(i / cols) * rowH;
      const bg = '#' + new THREE.Color(q.bg).getHexString();
      x.fillStyle = bg; x.fillRect(cx, cy, cw, rowH);
      x.fillStyle = 'rgba(255,255,255,0.22)'; x.fillRect(cx, cy, cw, 6);
      x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(cx, cy + rowH - 6, cw, 6);
      // icon disc
      x.fillStyle = '#ffffff'; x.beginPath(); x.arc(cx + 34, cy + rowH / 2, 17, 0, Math.PI * 2); x.fill();
      x.fillStyle = bg; x.beginPath(); x.arc(cx + 34, cy + rowH / 2, 9, 0, Math.PI * 2); x.fill();
      // auto-fit: shrink the font until the label fits the board (never squash or clip)
      x.fillStyle = q.fg || '#ffffff'; x.textBaseline = 'middle'; x.textAlign = 'center';
      const avail = cw - 92; let fs = 40;
      do { x.font = `800 ${fs}px Montserrat, Arial, sans-serif`; } while (x.measureText(q.text).width > avail && --fs > 14);
      const tw = x.measureText(q.text).width;
      x.fillText(q.text, cx + 64 + (cw - 76) / 2, cy + rowH / 2 + 2);
      uvs.set(q.text, [cx / W, 1 - (cy + rowH) / H, (cx + cw) / W, 1 - cy / H, tw]);
    });
    const t = tex(c, { wrap: false });
    return { texture: t, uv: (text) => uvs.get(text) };
  });
}

/**
 * Road-paint atlas 256×256 with alpha: [0..128]x[0..64] white paint, [128..256]x[0..64] yellow paint,
 * [0..128]x[64..192] arrow, [128..256]x[64..128] hatch.  Worn speckle for realism.
 */
export function paintAtlas() {
  return memo('paint', () => {
    const S = 256; const c = cv(S); const x = c.getContext('2d'); const rnd = mulberry32(5);
    x.clearRect(0, 0, S, S);
    x.fillStyle = '#f4f1e8'; x.fillRect(0, 0, 128, 64);
    x.fillStyle = '#f5c42a'; x.fillRect(128, 0, 128, 64);
    // arrow (points to +V = up in texture)
    x.fillStyle = '#f4f1e8';
    x.beginPath(); x.moveTo(64, 70); x.lineTo(110, 120); x.lineTo(80, 120); x.lineTo(80, 188); x.lineTo(48, 188); x.lineTo(48, 120); x.lineTo(18, 120); x.closePath(); x.fill();
    // hatch (yellow/black chevrons)
    for (let k = -4; k < 12; k++) { x.fillStyle = k % 2 ? '#f5c42a' : 'rgba(30,30,34,0.9)'; x.beginPath(); x.moveTo(128 + k * 16, 128); x.lineTo(128 + k * 16 + 16, 128); x.lineTo(128 + k * 16 + 80, 64); x.lineTo(128 + k * 16 + 64, 64); x.fill(); }
    // wear: punch tiny holes into the paint
    const img = x.getImageData(0, 0, S, S);
    for (let i = 0; i < S * S; i++) { const r = rnd(); if (r < 0.08) img.data[i * 4 + 3] *= 0.35; else if (r < 0.2) img.data[i * 4 + 3] *= 0.8; }
    x.putImageData(img, 0, 0);
    return tex(c, { wrap: false });
  });
}
export const PAINT_UV = {
  white: [0.06, 0.78, 0.44, 0.97], yellow: [0.56, 0.78, 0.94, 0.97],
  arrow: [0, 0.25, 0.5, 0.75], hatch: [0.5, 0.5, 1.0, 0.75],
};

/** Small square paver tiles (8×8 per tile) in 3 tones with fine speckle — for sidewalks / walkway decks. */
export function paverTexture(base = '#d7dade', seed = 3) {
  return memo('pav' + base + seed, () => {
    const S = 256; const c = cv(S); const x = c.getContext('2d'); const rnd = mulberry32(seed);
    x.fillStyle = '#8f949b'; x.fillRect(0, 0, S, S);
    const n = 8, p = S / n; const col = new THREE.Color(base);
    const tones = [col.clone(), col.clone().offsetHSL(0.01, 0.02, -0.07), col.clone().offsetHSL(-0.02, -0.03, 0.05)];
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const t = tones[rnd() < 0.55 ? 0 : rnd() < 0.5 ? 1 : 2].clone().multiplyScalar(0.96 + rnd() * 0.06);
      x.fillStyle = '#' + t.getHexString(); x.fillRect(i * p + 1.5, j * p + 1.5, p - 3, p - 3);
      x.fillStyle = 'rgba(255,255,255,0.14)'; x.fillRect(i * p + 1.5, j * p + 1.5, p - 3, 1);
      for (let s2 = 0; s2 < 10; s2++) { x.fillStyle = `rgba(70,70,80,${rnd() * 0.1})`; x.fillRect(i * p + rnd() * p, j * p + rnd() * p, 1.5, 1.5); }
    }
    return tex(c);
  });
}

/** Grated cast-iron manhole / drain cover (round grille with rim and bolts), for disc tops. */
export function manholeTexture() {
  return memo('manhole', () => {
    const S = 128; const c = cv(S); const x = c.getContext('2d');
    x.fillStyle = '#3c4048'; x.fillRect(0, 0, S, S);
    x.save(); x.beginPath(); x.arc(64, 64, 52, 0, Math.PI * 2); x.clip();
    x.fillStyle = '#23262c'; x.fillRect(0, 0, S, S);
    x.strokeStyle = '#5c616b'; x.lineWidth = 4;
    for (let k = -64; k < 192; k += 12) { x.beginPath(); x.moveTo(k, 0); x.lineTo(k - 64, 128); x.stroke(); x.beginPath(); x.moveTo(k - 64, 0); x.lineTo(k, 128); x.stroke(); }
    x.restore();
    x.strokeStyle = '#6b707a'; x.lineWidth = 7; x.beginPath(); x.arc(64, 64, 55, 0, Math.PI * 2); x.stroke();
    x.fillStyle = '#7d828c'; for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; x.beginPath(); x.arc(64 + Math.cos(a) * 55, 64 + Math.sin(a) * 55, 3, 0, Math.PI * 2); x.fill(); }
    return tex(c, { wrap: false });
  });
}

/** Painted concrete for loading yards. */
export function concreteTexture() {
  return memo('concrete', () => {
    const S = 256; const c = cv(S); const x = c.getContext('2d'); const rnd = mulberry32(11);
    x.fillStyle = '#c4c9cf'; x.fillRect(0, 0, S, S);
    for (let s = 0; s < 4000; s++) { const v = 150 + rnd() * 80; x.fillStyle = `rgba(${v},${v + 3},${v + 8},0.25)`; x.fillRect(rnd() * S, rnd() * S, 2, 2); }
    for (let s = 0; s < 14; s++) { const g = x.createRadialGradient(0, 0, 0, 0, 0, 30); g.addColorStop(0, 'rgba(70,72,80,0.12)'); g.addColorStop(1, 'rgba(70,72,80,0)'); x.save(); x.translate(rnd() * S, rnd() * S); x.fillStyle = g; x.fillRect(-30, -30, 60, 60); x.restore(); }
    x.strokeStyle = 'rgba(90,95,105,0.5)'; x.lineWidth = 2; x.strokeRect(1, 1, S - 2, S - 2);
    return tex(c);
  });
}

/** Lush lawn with mown stripes and speckle. */
export function lawnTexture() {
  return memo('lawn', () => {
    const S = 256; const c = cv(S); const x = c.getContext('2d'); const rnd = mulberry32(19);
    x.fillStyle = '#5fae3a'; x.fillRect(0, 0, S, S);
    for (let k = 0; k < 8; k++) { x.fillStyle = k % 2 ? 'rgba(255,255,200,0.06)' : 'rgba(0,40,0,0.05)'; x.fillRect(0, k * 32, S, 32); }
    for (let s = 0; s < 9000; s++) { const g = rnd(); x.fillStyle = g > 0.5 ? `rgba(150,210,90,${rnd() * 0.5})` : `rgba(30,90,30,${rnd() * 0.5})`; x.fillRect(rnd() * S, rnd() * S, 1.5, 2.5); }
    return tex(c);
  });
}

/**
 * Warm dark asphalt (≈#4b4a50): fine aggregate, low-frequency wear, patch repairs, hairline cracks and
 * (optionally) polished tyre tracks running along V. U spans the carriageway width (0..1), V = length / 6u.
 * Returns { map, rough, normal }.
 */
export function asphaltSet(tracks = true) {
  return memo('asph' + tracks, () => {
    const S = 512; const rnd = mulberry32(tracks ? 91 : 92);
    const c = cv(S), r = cv(S); const x = c.getContext('2d'), y = r.getContext('2d');
    const img = x.createImageData(S, S), rim = y.createImageData(S, S);
    const H = new Float32Array(S * S);
    // low-frequency value noise (tileable) for wear blotches
    const G = 8, g = Array.from({ length: G * G }, () => rnd());
    const lf = (u, v) => { const X = u * G, Y = v * G, i = Math.floor(X), j = Math.floor(Y), fx = X - i, fy = Y - j; const s = (q) => q * q * (3 - 2 * q); const at = (a, b) => g[((b % G + G) % G) * G + ((a % G + G) % G)]; return (at(i, j) * (1 - s(fx)) + at(i + 1, j) * s(fx)) * (1 - s(fy)) + (at(i, j + 1) * (1 - s(fx)) + at(i + 1, j + 1) * s(fx)) * s(fy); };
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
      const u = i / S, v = j / S, k = j * S + i;
      const grain = rnd();
      let val = 0.295 + (lf(u, v) - 0.5) * 0.035 + (lf((u * 2) % 1, (v * 4) % 1) - 0.5) * 0.03 + (grain - 0.5) * 0.06 + (grain > 0.975 ? 0.09 : 0) - (grain < 0.03 ? 0.06 : 0);
      let ro = 0.9 - (grain > 0.975 ? 0.15 : 0);
      if (tracks) for (const t of [0.17, 0.33, 0.67, 0.83]) { const d = Math.abs(u - t); if (d < 0.045) { const w = 1 - d / 0.045; val -= 0.025 * w; ro -= 0.16 * w; } }
      if (tracks && Math.abs(u - 0.5) < 0.012) val += 0.0; // centre seam handled by paint
      H[k] = grain * 0.7 + lf(u * 3 % 1, v * 3 % 1) * 0.3;
      const R = val * 255 * 1.0, Gc = val * 255 * 0.985, B = val * 255 * 1.06;
      img.data[k * 4] = R; img.data[k * 4 + 1] = Gc; img.data[k * 4 + 2] = B; img.data[k * 4 + 3] = 255;
      rim.data[k * 4] = rim.data[k * 4 + 1] = rim.data[k * 4 + 2] = Math.max(0, Math.min(255, ro * 255)); rim.data[k * 4 + 3] = 255;
    }
    x.putImageData(img, 0, 0); y.putImageData(rim, 0, 0);
    // hairline cracks only (wear is continuous noise, no patch seams)
    x.strokeStyle = 'rgba(25,25,30,0.3)'; x.lineWidth = 1;
    for (let k = 0; k < 5; k++) { let px = rnd() * S, py = rnd() * S; x.beginPath(); x.moveTo(px, py); for (let s = 0; s < 8; s++) { px += (rnd() - 0.5) * 22; py += rnd() * 14; x.lineTo(px, py); } x.stroke(); }
    // normal from height
    const n = cv(S); const nx = n.getContext('2d'); const nim = nx.createImageData(S, S);
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
      const l = H[j * S + ((i - 1 + S) % S)], rr = H[j * S + ((i + 1) % S)], u = H[((j - 1 + S) % S) * S + i], d = H[((j + 1) % S) * S + i];
      let ax = (l - rr) * 1.6, ay = (u - d) * 1.6, az = 1; const L = Math.hypot(ax, ay, az); const k = (j * S + i) * 4;
      nim.data[k] = (ax / L * 0.5 + 0.5) * 255; nim.data[k + 1] = (ay / L * 0.5 + 0.5) * 255; nim.data[k + 2] = (az / L * 0.5 + 0.5) * 255; nim.data[k + 3] = 255;
    }
    nx.putImageData(nim, 0, 0);
    return { map: tex(c), rough: tex(r, { srgb: false }), normal: tex(n, { srgb: false }) };
  });
}
