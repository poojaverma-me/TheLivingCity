// Golgi apparatus: a stack of six undulating rose-pink cisternae (crescent-shaped, dilated rims) resting
// above a curved "Packaging & Shipping Center" hall with glowing cream windows, loading docks, parcel
// stacks, animated conveyors and forklifts. Cis face (receiving, back, toward the ER/nucleus) and trans
// face (shipping, front-right, toward the membrane ports) are signposted. Vesicles bud off the rims.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { GOLGI } from '../layout.js';
import * as M from '../../core/materials.js';
import * as T from '../../core/textures.js';
import { sweepXZ, mergeGeometries, endTaper, trs } from '../../core/geom.js';
import { mulberry32 } from '../../core/noise.js';
import { organic } from '../../core/lookdev.js';

// ---------------------------------------------------------------- local frame
// Local +X runs along the crescent (left → right). The arc centre lies in FRONT (+Z): the concave trans
// face (shipping courtyard, embraced by the curled horns) faces the camera and the membrane ports, the
// convex cis face (receiving) faces the ER / nucleus. Radial offset u > 0 points toward the concave front.
const RC = 12.5;            // centre-line radius of the crescent
const CZ = RC - 0.9;        // arc centre (local z, in front); apex of the centre-line sits at z = -0.9
const HB = 2.7;             // hall height
const HW = 2.2;             // hall half-width (radial)
const SB = 7.0;             // hall half-length (arc length on RC)
const Y0 = HB + 1.0;        // centre height of the first (cis) cisterna (stack lifted on a rooftop deck)
const SP = 1.0;             // vertical pitch: rim thickness ~0.56 + ~0.44 open air (reads from behind too)
const RIM = 0.28, MID = 0.22; // half-thickness at the swollen rim / across the (flatter) lumen deck

const LAYERS = [ // cis (bottom, deep #9E2F62) → trans (top, pale #FFD3E4); staggered along the arc + in/out so the back never reads as a tyre stack
  { hw: 2.0, half: 7.6, col: 0x9e2f62, dz: 0.1, ph: -0.035 },
  { hw: 1.92, half: 7.0, col: 0xb6447a, dz: -0.18, ph: 0.04 },
  { hw: 1.9, half: 7.5, col: 0xcd5f8f, dz: 0.16, ph: -0.02 },
  { hw: 1.8, half: 6.7, col: 0xe07ea6, dz: -0.2, ph: 0.045 },
  { hw: 1.6, half: 6.3, col: 0xf0a3c2, dz: 0.12, ph: -0.01 },
  { hw: 1.4, half: 5.4, col: 0xffd3e4, dz: -0.08, ph: 0.03 },
];

const cr = Math.cos(GOLGI.rot), sr = Math.sin(GOLGI.rot);
/** Golgi-local point → world [x, y, z]. */
export function golgiToWorld(x, y, z) { return [GOLGI.x + x * cr + z * sr, y, GOLGI.z - x * sr + z * cr]; }
/** Local point on the crescent: angle phi (0 = apex), radius RC+u. */
const P = (phi, r) => ({ x: r * Math.sin(phi), z: CZ - r * Math.cos(phi) });
function at(phi, u = 0) { return P(phi, RC - u); }
/** Matrix for an object whose +Z faces outward (front) or inward (back) at phi. */
function pose(phi, u, y, back = false, extraYaw = 0) {
  const p = at(phi, u);
  return trs(p.x, y, p.z, 0, -phi + (back ? Math.PI : 0) + extraYaw, 0);
}

// sorting conveyor (trans face → vesicle launch pad)
const CONV_A = (() => { const p = at(0.475, HW + 0.15); return { x: p.x, z: p.z }; })();
const CONV_DIR = (() => { const a = -0.475 + 1.25; return { x: Math.sin(a), z: Math.cos(a) }; })();
const CONV_L = 4.6;
const PAD_LOCAL = { x: CONV_A.x + CONV_DIR.x * (CONV_L + 1.05), z: CONV_A.z + CONV_DIR.z * (CONV_L + 1.05) };
/** World point floating ~3.8u above the launch pad: where departing vesicles start their float to the ports. */
export function golgiPadArmTip() { const [x, , z] = golgiToWorld(PAD_LOCAL.x, 0, PAD_LOCAL.z); return { x, y: 3.8, z }; }
/** World position of the vesicle launch pad at the end of the trans sorting conveyor. */
export function golgiTransPad() { const [x, y, z] = golgiToWorld(PAD_LOCAL.x, 0, PAD_LOCAL.z); return { x, y, z }; }

// ---------------------------------------------------------------- small helpers
function prep(g, keepColor = false) {
  let h = g.index ? g.toNonIndexed() : g;
  if (!h.attributes.normal) h.computeVertexNormals();
  if (!h.attributes.uv) h.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(h.attributes.position.count * 2), 2));
  const keep = keepColor ? ['position', 'normal', 'uv', 'color'] : ['position', 'normal', 'uv'];
  for (const k of Object.keys(h.attributes)) if (!keep.includes(k)) h.deleteAttribute(k);
  h.clearGroups();
  return h;
}
function merged(list, mat, { cast = true, receive = true, keepColor = false, name = '' } = {}) {
  const m = new THREE.Mesh(mergeGeometries(list.map((g) => prep(g, keepColor))), mat);
  m.castShadow = cast; m.receiveShadow = receive; m.name = name;
  return m;
}
const box = (w, h, d, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0) => new THREE.BoxGeometry(w, h, d).applyMatrix4(trs(x, y, z, rx, ry, rz));
const rbox = (w, h, d, r, x = 0, y = 0, z = 0, ry = 0) => new RoundedBoxGeometry(w, h, d, 2, r).applyMatrix4(trs(x, y, z, 0, ry, 0));
const cyl = (r0, r1, h, seg, x = 0, y = 0, z = 0, rx = 0, rz = 0) => new THREE.CylinderGeometry(r0, r1, h, seg).applyMatrix4(trs(x, y, z, rx, 0, rz));
const xf = (g, m) => g.applyMatrix4(m);

function canvasTex(w, h, draw, { srgb = true, repeat = [1, 1] } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); t.anisotropy = 8;
  return t;
}
function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

/** Rounded rectangle in (s = arc length on RC, u = radial offset) space, mapped onto the crescent. */
function crescentContour(s0, s1, u0, u1, rf, step = 0.25) {
  const pts = [];
  const seg = (a, b) => { const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step)); for (let k = 0; k < n; k++) pts.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]); };
  const corner = (cs, cu, a0) => { for (let k = 0; k < 8; k++) { const a = a0 + (k / 8) * Math.PI / 2; pts.push([cs + Math.cos(a) * rf, cu + Math.sin(a) * rf]); } };
  seg([s0 + rf, u0], [s1 - rf, u0]); corner(s1 - rf, u0 + rf, -Math.PI / 2);
  seg([s1, u0 + rf], [s1, u1 - rf]); corner(s1 - rf, u1 - rf, 0);
  seg([s1 - rf, u1], [s0 + rf, u1]); corner(s0 + rf, u1 - rf, Math.PI / 2);
  seg([s0, u1 - rf], [s0, u0 + rf]); corner(s0 + rf, u0 + rf, Math.PI);
  return pts.map(([s, u]) => at(s / RC, u));
}
function extrudeContour(pts, y0, h, bevel = 0) {
  const shape = new THREE.Shape(pts.map((p) => new THREE.Vector2(p.x, -p.z)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.01, h - 2 * bevel), bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 4 });
  g.rotateX(-Math.PI / 2); g.translate(0, y0 + bevel, 0);
  return g;
}
function ringContour(outer, inner, y0, h) {
  const shape = new THREE.Shape(outer.map((p) => new THREE.Vector2(p.x, -p.z)));
  shape.holes.push(new THREE.Path(inner.map((p) => new THREE.Vector2(p.x, -p.z))));
  const g = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, curveSegments: 4 });
  g.rotateX(-Math.PI / 2); g.translate(0, y0, 0);
  return g;
}
/** Closed rounded-rect cross-section profile for sweeps. */
function roundRectProfile(u0, u1, v0, v1, r, seg = 3) {
  const P = [];
  const c = [[u1 - r, v0 + r, -Math.PI / 2], [u1 - r, v1 - r, 0], [u0 + r, v1 - r, Math.PI / 2], [u0 + r, v0 + r, Math.PI]];
  for (const [cu, cv, a0] of c) for (let k = 0; k <= seg; k++) { const a = a0 + (k / seg) * Math.PI / 2; P.push([cu + Math.cos(a) * r, cv + Math.sin(a) * r]); }
  P.push(P[0].slice());
  return P;
}
function arcPts(phi0, phi1, r, step = 0.2) {
  const n = Math.max(2, Math.ceil(Math.abs(phi1 - phi0) * r / step)), pts = [];
  for (let k = 0; k <= n; k++) pts.push(P(phi0 + (phi1 - phi0) * k / n, r));
  return pts;
}

// ---------------------------------------------------------------- textures
function facadeTextures() {
  const W = 2048, H = 512, bays = 16, bw = W / bays;
  const rnd = mulberry32(77);
  const cMap = document.createElement('canvas'); cMap.width = W; cMap.height = H;
  const cEm = document.createElement('canvas'); cEm.width = W; cEm.height = H;
  const a = cMap.getContext('2d'), e = cEm.getContext('2d');
  e.fillStyle = '#000'; e.fillRect(0, 0, W, H);
  const RH = 2.04, py = H / RH, px = bw / 1.05; // px per unit
  const Y = (yu) => (RH - yu) * py;
  const wins = [[0.12, 0.98, 0.74], [1.24, 1.94, 0.62]]; // [y0, y1, width] in ribbon units
  for (let b = 0; b < bays; b++) {
    const cx = b * bw + bw / 2;
    wins.forEach(([y0, y1, ww], row) => {
      const x0 = cx - (ww / 2) * px, x1 = cx + (ww / 2) * px, t = Y(y1), btm = Y(y0);
      const lit = rnd() > (row ? 0.16 : 0.08);
      // frame + sill (cream trim)
      a.fillStyle = '#f7ecdc'; rrect(a, x0 - 7, t - 7, x1 - x0 + 14, btm - t + 14, 8); a.fill();
      a.fillStyle = '#e9d6c4'; a.fillRect(x0 - 12, btm + 2, x1 - x0 + 24, 10);
      a.fillStyle = '#c9b4a6'; a.fillRect(x0 - 12, btm + 10, x1 - x0 + 24, 3);
      // pane
      const g = a.createLinearGradient(0, t, 0, btm);
      const ge = e.createLinearGradient(0, t, 0, btm);
      if (lit) {
        const warm = rnd() > 0.5;
        g.addColorStop(0, warm ? '#fff3cf' : '#ffe9bd'); g.addColorStop(1, warm ? '#ffcf86' : '#ffd99c');
        ge.addColorStop(0, warm ? '#fff0c8' : '#ffe6b0'); ge.addColorStop(1, warm ? '#ffbe6a' : '#ffcd88');
      } else {
        g.addColorStop(0, '#5a5470'); g.addColorStop(1, '#2c2838');
        ge.addColorStop(0, '#120e1a'); ge.addColorStop(1, '#050408');
      }
      a.fillStyle = g; a.fillRect(x0, t, x1 - x0, btm - t);
      e.fillStyle = ge; e.fillRect(x0, t, x1 - x0, btm - t);
      if (lit) { // interior silhouettes: shelving with parcels downstairs, people / plants upstairs
        for (const ctx of [a, e]) {
          ctx.save(); ctx.beginPath(); ctx.rect(x0, t, x1 - x0, btm - t); ctx.clip();
          ctx.globalAlpha = ctx === a ? 0.4 : 0.55;
          if (row === 0) {
            ctx.fillStyle = '#7a4a3a';
            for (let s = 0; s < 3; s++) { const yy = t + (btm - t) * (0.3 + s * 0.25); ctx.fillRect(x0, yy, x1 - x0, 4); }
            ctx.fillStyle = '#b06a4a';
            for (let k = 0; k < 7; k++) { const bx = x0 + rnd() * (x1 - x0 - 16), by = t + (btm - t) * (0.3 + Math.floor(rnd() * 3) * 0.25) - 14; ctx.fillRect(bx, by, 12 + rnd() * 8, 14); }
          } else {
            ctx.fillStyle = '#6b3d3a';
            if (rnd() > 0.45) { const hx = x0 + 10 + rnd() * (x1 - x0 - 30); ctx.beginPath(); ctx.arc(hx + 8, btm - 52, 8, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(hx, btm - 44, 16, 44); }
            if (rnd() > 0.6) { ctx.fillStyle = '#3f6a3a'; ctx.beginPath(); ctx.arc(x1 - 16, btm - 18, 13, 0, Math.PI * 2); ctx.fill(); }
            ctx.fillStyle = '#ffffff'; ctx.globalAlpha = ctx === a ? 0.25 : 0.4; ctx.fillRect(x0, t + 6, x1 - x0, 5); // ceiling light strip
          }
          ctx.restore();
        }
      }
      // mullions
      a.fillStyle = '#f2e6d6'; e.fillStyle = '#000';
      for (const ctx of [a, e]) {
        ctx.fillRect(cx - 3, t, 6, btm - t);
        if (row === 1) ctx.fillRect(x0, t + (btm - t) * 0.42, x1 - x0, 5);
        else ctx.fillRect(x0, t + (btm - t) * 0.22, x1 - x0, 5);
      }
      // glass reflection streak
      a.fillStyle = 'rgba(255,255,255,0.18)';
      a.beginPath(); a.moveTo(x0 + 6, btm); a.lineTo(x0 + 22, btm); a.lineTo(x0 + 46, t); a.lineTo(x0 + 30, t); a.closePath(); a.fill();
    });
  }
  const mk = (c) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping; t.anisotropy = 8; return t; };
  return { map: mk(cMap), emissiveMap: mk(cEm), bayLen: bays * 1.05 };
}

const rollupTex = () => canvasTex(128, 128, (c, w, h) => {
  const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#e2e3e8'); g.addColorStop(1, '#b9bcc6');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  for (let y = 4; y < h - 12; y += 9) { c.fillStyle = 'rgba(70,72,86,0.45)'; c.fillRect(0, y, w, 2); c.fillStyle = 'rgba(255,255,255,0.5)'; c.fillRect(0, y + 2, w, 1); }
  c.fillStyle = '#4a4c58'; c.fillRect(0, h - 12, w, 12);
  c.fillStyle = '#e8b62a'; for (let x = 0; x < w; x += 16) { c.fillRect(x, h - 10, 8, 8); }
  c.fillStyle = '#3a3c46'; c.fillRect(w / 2 - 10, h - 24, 20, 5);
});
const awningTex = () => canvasTex(64, 256, (c, w, h) => {
  const n = 8;
  for (let i = 0; i < n; i++) { c.fillStyle = i % 2 ? '#fff1dc' : '#c9467e'; c.fillRect(0, (i * h) / n, w, h / n); }
  c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(w - 6, 0, 6, h);
});
const beltTex = () => canvasTex(64, 64, (c, w, h) => {
  c.fillStyle = '#2e3038'; c.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 16) { c.fillStyle = '#4c505c'; c.fillRect(x, 0, 5, h); c.fillStyle = '#20222a'; c.fillRect(x + 5, 0, 2, h); }
});
let _parcelTex = null;
/** Shared cardboard parcel texture (tape strip + label), white so instance colours tint it. */
export function parcelTexture() { return _parcelTex || (_parcelTex = parcelTex()); }
const parcelTex = () => canvasTex(128, 128, (c, w, h) => {
  c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h);
  c.fillStyle = 'rgba(120,80,60,0.10)'; for (let i = 0; i < 40; i++) c.fillRect(Math.random() * w, Math.random() * h, 2, 10);
  c.fillStyle = 'rgba(255,255,255,0.9)'; c.fillRect(w * 0.42, 0, w * 0.16, h);      // tape
  c.fillStyle = 'rgba(90,60,50,0.18)'; c.fillRect(w * 0.42, 0, 2, h); c.fillRect(w * 0.58, 0, 2, h);
  c.fillStyle = '#fbfaf6'; c.fillRect(w * 0.1, h * 0.62, w * 0.26, h * 0.22);         // label
  c.fillStyle = '#5a4a58'; for (let k = 0; k < 3; k++) c.fillRect(w * 0.13, h * (0.66 + k * 0.05), w * 0.18 - k * 6, 3);
  c.strokeStyle = 'rgba(80,50,40,0.35)'; c.lineWidth = 3; c.strokeRect(1, 1, w - 2, h - 2);
});

// ---------------------------------------------------------------- cisternae
function layerFrame(li) {
  const L = LAYERS[li], phiH = L.half / RC, c = L.ph || 0;
  return { L, phi0: c - phiH, phi1: c + phiH, y: Y0 + li * SP, cap: L.hw * 0.95 };
}
// horns curl forward around the trans courtyard → crescent; one broad in-plane meander per layer
const sacR = (li, phi) => RC + LAYERS[li].dz - 3.2 * Math.pow(Math.abs(phi) / 0.6, 2.0) + 0.05 * Math.sin(3 * phi + li * 0.4);
/** Broad 2-lobe undulation shared by the stack, phase-shifted 0.4 rad per layer so the sacs nest. */
const wave = (phi, li = 0) => { const L = phi * RC; return 0.17 * Math.sin(L * 0.85 + 0.4 + li * 0.9) + 0.05 * Math.sin(L * 0.37 + 1.1) + 0.85 * (phi / 0.6) ** 2; }; // + ~20° upward bow toward the horns
function sacScale(t, len, cap) {
  const d = Math.min(t, 1 - t) * len, f = endTaper(t, len, cap);
  const dil = 1 + 0.08 * Math.exp(-(((d - cap * 1.05) / 0.9) ** 2)); // gently dilated rims near the ends
  return { u: f * (1 + 0.1 * (dil - 1)), v: Math.pow(f, 0.7) * dil, vc: 0 }; // dome-round tips, no pinched seam
}
function sacDisplace(li, hw, L, p, N, u) {
  const e = Math.min(1, Math.abs(u) / hw);
  const sgn = Math.sign(u) || 1;
  p.y += wave(L / RC, li);
  const w = 0.07 * Math.sin(L * 0.55 + li * 0.4 + (sgn > 0 ? 0.9 : 0)) * e * e * e; // broad rim meander
  p.x += N.x * w * sgn; p.z += N.y * w * sgn;
}
function sacProfile(hw, rr, hm) {
  const P = [], ue = hw - rr, N = 12;
  const surf = (u) => { const a = Math.min(1, Math.abs(u) / ue) ** 2; return hm + (rr - hm) * a * a * (3 - 2 * a); }; // zero-slope blend into the rim tube
  for (let k = 0; k <= N; k++) { const u = (ue * k) / N; P.push([u, -surf(u)]); }
  for (let k = 1; k < 16; k++) { const a = -Math.PI / 2 + (Math.PI * k) / 16; P.push([ue + Math.cos(a) * rr, Math.sin(a) * rr]); }
  for (let k = 0; k <= 2 * N; k++) { const u = ue - (2 * ue * k) / (2 * N); P.push([u, surf(u)]); }
  for (let k = 1; k < 16; k++) { const a = Math.PI / 2 + (Math.PI * k) / 16; P.push([-ue + Math.cos(a) * rr, Math.sin(a) * rr]); }
  for (let k = 0; k <= N; k++) { const u = -ue + (ue * k) / N; P.push([u, -surf(u)]); }
  return P;
}
function buildSac(li, phiA, phiB) {
  const { L, y, cap } = layerFrame(li);
  const len = (phiB - phiA) * RC;
  const steps = Math.max(200, Math.round(len / 0.07));
  const path = [];
  for (let k = 0; k <= steps; k++) { const p = phiA + (phiB - phiA) * (k / steps); path.push(P(p, sacR(li, p))); }
  const g = sweepXZ(path, sacProfile(L.hw, RIM, MID), {
    uvScale: [0.12, 1.2], flip: true,
    scale: (i, t) => sacScale(t, len, cap),
    displace: (p, N, i, j, u, v) => {
      const t = i / steps, d = Math.min(t, 1 - t) * len, fill = 1 - THREE.MathUtils.smoothstep(d, cap * 0.25, cap * 1.0);
      if (fill > 0 && v !== 0) { // blend the cross-section toward an ellipse so the tip closes as a smooth dome
        const sc = sacScale(t, len, cap), w = L.hw * sc.u, H = RIM * sc.v;
        const vt = H * Math.sqrt(Math.max(0, 1 - (Math.abs(u) / w) ** 2));
        p.y += Math.sign(v) * (vt - Math.abs(v)) * fill;
      }
      sacDisplace(li, L.hw, t * len + phiA * RC, p, N, u);
    },
  });
  g.translate(0, y, 0);
  // smooth colour gradient: pale rim highlight (#F7B8CF-ish) → layer rose in the centre → deeper underside
  const prof = sacProfile(L.hw, RIM, MID), m = prof.length, n = g.attributes.position.count;
  const base = new THREE.Color(L.col), rim = base.clone().lerp(new THREE.Color(0xffd6e6), 0.38), under = base.clone().lerp(new THREE.Color(0x7e2450), 0.5);
  const col = new Float32Array(n * 3), c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const j = i % m, [u, v] = prof[Math.min(j, m - 1)];
    const e = Math.min(1, Math.abs(u) / L.hw);
    c.copy(base).lerp(rim, THREE.MathUtils.smoothstep(e, 0.55, 0.98));
    if (v < 0) c.lerp(under, THREE.MathUtils.smoothstep(-v / MID, 0.3, 1.0) * (1 - 0.6 * e));
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
/** Exact surface point on a sac rim (mirrors the sweep), used to seat budding vesicles. */
function rimPoint(li, phi, side = 1) {
  const { L, phi0, phi1, y, cap } = layerFrame(li);
  const a = phi0, b = phi1;
  const len = (b - a) * RC, t = (phi - a) / (b - a);
  const s = sacScale(t, len, cap);
  const r = sacR(li, phi);
  const u = (L.hw - 0.01) * s.u * side;
  const N = new THREE.Vector2(-Math.sin(phi), Math.cos(phi));
  const c = P(phi, r), p = new THREE.Vector3(c.x + N.x * u, 0, c.z + N.y * u);
  sacDisplace(li, L.hw, t * len + a * RC, p, N, u);
  p.y += y;
  return { p, n: new THREE.Vector3(N.x * side, 0.12, N.y * side).normalize() };
}

// ---------------------------------------------------------------- builder
export function buildGolgi() {
  const g = new THREE.Group(); g.name = 'golgi';
  g.position.set(GOLGI.x, 0, GOLGI.z); g.rotation.y = GOLGI.rot;
  const rnd = mulberry32(4242);

  // ---------- materials ----------
  const sacMat = organic(new THREE.MeshPhysicalMaterial({
    color: 0xffffff, vertexColors: true, roughness: 0.36, clearcoat: 1.0, clearcoatRoughness: 0.18,
    emissive: 0xffc2da, emissiveIntensity: 0.06,
  }), { rim: 0xffc2da, rimPower: 2.6, rimStrength: 0.5, sss: 0xff6fa3, sssStrength: 0.08, wrap: 0.45 });
  { // slow peristaltic wave running along the stack (period ~6 s); the base of the stack stays put
    const prev = sacMat.onBeforeCompile;
    sacMat.userData.uTime = { value: 0 };
    sacMat.onBeforeCompile = (sh, r) => {
      prev(sh, r);
      sh.uniforms.uTime = sacMat.userData.uTime;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          { float ph = atan(transformed.x, ${CZ.toFixed(3)} - transformed.z) * ${RC.toFixed(2)};
            transformed.y += 0.05 * sin(ph * 0.9 - uTime * 1.05) * smoothstep(${(HB + 0.4).toFixed(2)}, ${(HB + 1.0).toFixed(2)}, transformed.y); }`);
    };
    sacMat.customProgramCacheKey = () => 'golgiSac2';
  }
  const wallMat = M.satin(0x7a2e55, { rough: 0.45, clearcoat: 0.5, normalScale: 0.2, key: 'golgiWall2' });
  const trimMat = M.satin(0xf6eadb, { rough: 0.38, clearcoat: 0.5, key: 'golgiTrim' });
  const concMat = M.satin(0xa9a6ad, { rough: 0.7, clearcoat: 0.05, normalScale: 0.5, repeat: 2, key: 'golgiConcrete' });
  const darkMat = M.satin(0x34303a, { rough: 0.55, clearcoat: 0.2, key: 'golgiDark' });
  const yellowMat = M.satin(0xf5b316, { rough: 0.35, clearcoat: 0.8, key: 'golgiYellow' });
  const steel = M.metal(0xc6cbd3, 0.3);
  const lampMat = M.emissive(0xffe2a8, 4.5, 0xfff4dc);
  const fac = facadeTextures();
  const winMat = new THREE.MeshStandardMaterial({ map: fac.map, emissiveMap: fac.emissiveMap, emissive: 0xffffff, emissiveIntensity: 2.3, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.22, metalness: 0 });
  const doorMat = new THREE.MeshStandardMaterial({ map: rollupTex(), roughness: 0.45, metalness: 0.35 });
  const awnMat = new THREE.MeshStandardMaterial({ map: awningTex(), roughness: 0.6, side: THREE.DoubleSide });
  const glassLit = M.emissive(0xffe4b4, 3.2, 0x5a4030);

  const hornPillars = [];
  const G = { sac: [], wall: [], trim: [], conc: [], dark: [], yellow: [], steel: [], lamp: [], win: [], door: [], awn: [], glass: [], mark: [], glow: [] };
  const colorize = (geo, hex) => {
    const c = new THREE.Color(hex), n = geo.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(a, 3)); return geo;
  };

  // ---------- cisternae stack ----------
  LAYERS.forEach((L, li) => {
    const { phi0, phi1 } = layerFrame(li);
    const parts = L.split ? [[phi0, L.split[0]], [L.split[1], phi1]] : [[phi0, phi1]];
    for (const [a, b] of parts) G.sac.push(buildSac(li, a, b));
  });
  // designed struts: tapered pink-enamel shafts, bevelled collars, brass caps (rooftop columns 2x at the base)
  const strutGeo = (r0, r1, h) => { // lathe from y=0..h: flared foot, taper, collar ring near the top
    const pts = [[0, 0], [r0 * 1.25, 0], [r0 * 1.25, 0.04], [r0, 0.1], [(r0 + r1) / 2, h * 0.55], [r1, h - 0.16], [r1 * 1.35, h - 0.12], [r1 * 1.35, h - 0.07], [r1, h - 0.04], [r1, h], [0, h]];
    return new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), 18);
  };
  const brass = [];
  const strut = (x, z, y0, y1, r0, r1, hex) => {
    G.sac.push(colorize(strutGeo(r0, r1, y1 - y0).translate(x, y0, z), hex));
    if (y0 > 0.01) brass.push(new THREE.TorusGeometry(r0 * 1.1, 0.03, 8, 20).rotateX(Math.PI / 2).translate(x, y0 + 0.14, z));
    brass.push(new THREE.TorusGeometry(r1 * 1.15, 0.028, 8, 20).rotateX(Math.PI / 2).translate(x, y1 - 0.14, z));
  };
  for (let li = 0; li < LAYERS.length; li++) {
    const span = (LAYERS[li].half / RC) * 0.55;
    for (const f of [-1, -0.33, 0.33, 1]) {
      const phi = f * span;
      if (li === 0) { // rooftop columns lift the stack
        for (const u of [-0.8, 0.8]) {
          const p = P(phi, sacR(0, phi) + u), yTop = Y0 - MID * 0.5 + wave(phi, 0);
          strut(p.x, p.z, HB + 0.17, yTop, 0.22, 0.12, 0xa63a6c);
          const d = new THREE.Vector3(-p.x, 0, CZ - p.z).normalize();
          G.lamp.push(rbox(0.16, 0.06, 0.1, 0.02, p.x + d.x * 0.45, HB + 0.22, p.z + d.z * 0.45, Math.atan2(d.x, d.z)));
        }
      }
    }
  }
  // (no horn pillars or inter-sac dowels: the stack rests only on the short rooftop columns, sacs held by their lumen)

  // ---------- the hall ----------
  const hall = crescentContour(-SB, SB, -HW, HW, 1.1);
  G.wall.push(extrudeContour(hall, 0, HB, 0.12));
  // plinth, belt course and roof cornice
  G.conc.push(extrudeContour(crescentContour(-SB - 0.12, SB + 0.12, -HW - 0.12, HW + 0.12, 1.2), 0, 0.26, 0.05));
  G.trim.push(ringContour(crescentContour(-SB - 0.2, SB + 0.2, -HW - 0.2, HW + 0.2, 1.25), crescentContour(-SB + 0.3, SB - 0.3, -HW + 0.3, HW - 0.3, 0.9), 1.43, 0.1));
  G.trim.push(extrudeContour(crescentContour(-SB - 0.26, SB + 0.26, -HW - 0.26, HW + 0.26, 1.3), HB - 0.04, 0.2, 0.06));
  // rooftop deck under the stack (warm, lit — never a dead slab) + railing
  G.conc.push(extrudeContour(crescentContour(-SB + 0.05, SB - 0.05, -HW + 0.05, HW - 0.05, 1.05), HB + 0.12, 0.05, 0));
  {
    const rail = crescentContour(-SB + 0.1, SB - 0.1, -HW + 0.1, HW - 0.1, 1.0, 0.4).map((q) => new THREE.Vector3(q.x, HB + 0.62, q.z));
    G.steel.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rail, true), 240, 0.03, 6, true));
    for (let i = 0; i < rail.length; i += 2) G.steel.push(cyl(0.022, 0.022, 0.46, 6, rail[i].x, HB + 0.4, rail[i].z));
  }

  // window ribbon wrapped all around the hall
  {
    const pts = crescentContour(-SB, SB, -HW, HW, 1.1, 0.12);
    let A = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; A += p.x * q.z - q.x * p.z; }
    const sgn = A > 0 ? 1 : -1, off = 0.15;
    const pos = [], uv = [], idx = []; let len = 0;
    for (let i = 0; i <= pts.length; i++) {
      const p = pts[i % pts.length], pa = pts[(i - 1 + pts.length) % pts.length], pb = pts[(i + 1) % pts.length];
      if (i > 0) len += Math.hypot(p.x - pa.x, p.z - pa.z);
      let tx = pb.x - pa.x, tz = pb.z - pa.z; const l = Math.hypot(tx, tz); tx /= l; tz /= l;
      const nx = tz * sgn, nz = -tx * sgn;
      pos.push(p.x + nx * off, 0.38, p.z + nz * off, p.x + nx * off, 2.42, p.z + nz * off);
      uv.push(len / fac.bayLen, 0, len / fac.bayLen, 1);
      if (i > 0) { const k = (i - 1) * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    }
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); rg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    rg.setIndex(idx); rg.computeVertexNormals();
    G.win.push(rg);
  }

  const FRONT = HW + 0.12, BACK = -HW - 0.12;
  // ---------- main entrance (visitor) ----------
  const ENT = -0.17;
  {
    const m = pose(ENT, FRONT, 0);
    G.glass.push(xf(box(1.5, 1.32, 0.06, 0, 0.72, 0.04), m));
    G.dark.push(xf(box(0.05, 1.32, 0.08, 0, 0.72, 0.07), m), xf(box(1.5, 0.05, 0.08, 0, 1.12, 0.07), m));
    G.trim.push(xf(box(0.16, 1.62, 0.36, -0.83, 0.81, 0.1), m), xf(box(0.16, 1.62, 0.36, 0.83, 0.81, 0.1), m), xf(rbox(1.95, 0.22, 0.42, 0.05, 0, 1.66, 0.12), m));
    G.conc.push(xf(rbox(2.4, 0.1, 0.9, 0.03, 0, 0.05, 0.42), m), xf(rbox(2.0, 0.1, 0.55, 0.03, 0, 0.14, 0.25), m));
    const aw = new THREE.CylinderGeometry(0.62, 0.62, 2.3, 18, 1, true, 0, Math.PI / 2); aw.rotateZ(Math.PI / 2); aw.translate(0, 1.72, 0.12);
    G.awn.push(xf(aw, m));
    // big fascia sign on the hall's roof line
    for (const sx of [-1.95, 1.95]) { G.lamp.push(xf(box(0.32, 0.07, 0.1, sx * 0.62, 1.44, 0.34), m)); }
    // lamp posts + planters
    for (const s of [-1, 1]) {
      G.steel.push(xf(cyl(0.045, 0.06, 1.75, 8, s * 1.75, 0.88, 0.95), m), xf(cyl(0.12, 0.14, 0.1, 10, s * 1.75, 0.05, 0.95), m));
      G.lamp.push(xf(new THREE.SphereGeometry(0.16, 14, 10).translate(s * 1.75, 1.82, 0.95), m));
      G.trim.push(xf(rbox(0.8, 0.42, 0.5, 0.08, s * 1.4, 0.21, 0.42), m));
    }
  }
  // side door (left end)
  {
    const m = pose(-0.42, FRONT, 0);
    G.glass.push(xf(box(0.82, 1.15, 0.06, 0, 0.62, 0.04), m));
    G.trim.push(xf(box(0.12, 1.3, 0.28, -0.47, 0.65, 0.08), m), xf(box(0.12, 1.3, 0.28, 0.47, 0.65, 0.08), m), xf(box(1.06, 0.14, 0.3, 0, 1.3, 0.08), m));
    const aw = new THREE.CylinderGeometry(0.45, 0.45, 1.3, 14, 1, true, 0, Math.PI / 2); aw.rotateZ(Math.PI / 2); aw.translate(0, 1.42, 0.12);
    G.awn.push(xf(aw, m));
    G.conc.push(xf(rbox(1.3, 0.1, 0.6, 0.03, 0, 0.05, 0.32), m));
  }

  // ---------- trans face: shipping docks (front-right) ----------
  const DOCKS = [0.1, 0.245, 0.39];
  const DH = 0.42; // dock height
  {
    const p0 = 0.03, p1 = 0.462;
    // raised dock platform with bevelled edges + yellow safety lip + bumpers
    G.conc.push(sweepXZ(arcPts(p0, p1, RC), roundRectProfile(HW + 0.05, HW + 1.55, 0, DH, 0.05), { flip: true }));
    G.yellow.push(sweepXZ(arcPts(p0 + 0.004, p1 - 0.004, RC), roundRectProfile(HW + 1.42, HW + 1.58, DH - 0.02, DH + 0.025, 0.012, 1), { flip: true }));
    // dock canopy (long rose overhang on brackets) with lamps under it
    G.wall.push(sweepXZ(arcPts(p0 - 0.01, p1 + 0.01, RC), roundRectProfile(HW + 0.1, HW + 1.75, 1.86, 1.98, 0.04), { flip: true }));
    G.trim.push(sweepXZ(arcPts(p0 - 0.01, p1 + 0.01, RC), roundRectProfile(HW + 1.66, HW + 1.82, 1.8, 2.02, 0.05), { flip: true }));
    for (const ph of [p0 + 0.01, (p0 + p1) / 2, p1 - 0.01]) {
      const m = pose(ph, FRONT, 0);
      G.steel.push(xf(box(0.06, 0.06, 1.62, 0, 1.8, 0.8, 0, -0.18), m), xf(cyl(0.04, 0.04, 1.4, 8, 0, 1.15, 1.58), m));
    }
    DOCKS.forEach((ph, k) => {
      const m = pose(ph, FRONT, 0);
      G.door.push(xf(box(1.22, 1.16, 0.08, 0, DH + 0.6, 0.05), m));
      G.trim.push(xf(box(0.12, 1.3, 0.22, -0.67, DH + 0.63, 0.06), m), xf(box(0.12, 1.3, 0.22, 0.67, DH + 0.63, 0.06), m), xf(box(1.46, 0.14, 0.24, 0, DH + 1.27, 0.06), m));
      G.dark.push(xf(rbox(0.16, 0.3, 0.12, 0.03, -0.5, DH - 0.18, 1.5), m), xf(rbox(0.16, 0.3, 0.12, 0.03, 0.5, DH - 0.18, 1.5), m));
      G.lamp.push(xf(box(0.36, 0.05, 0.14, 0, 1.83, 0.55), m));
      G.dark.push(xf(box(0.86, 0.02, 0.9, 0, DH + 0.012, 0.95), m)); // dock leveller plate
      // dock number plate
      G.trim.push(xf(box(0.28, 0.2, 0.03, 0.82, 1.66, 0.12), m));
    });
    // steps down from the left end of the dock
    for (let s = 0; s < 3; s++) {
      const hh = DH * (1 - s / 3);
      G.conc.push(xf(rbox(0.34, hh, 1.3, 0.03, 0, hh / 2, 0.75), pose(p0 - 0.016 - s * 0.022, FRONT, 0)));
    }
  }

  // ---------- cis face: receiving docks (back, toward the ER / nucleus) ----------
  const RDOCKS = [-0.3, -0.16];
  {
    G.conc.push(sweepXZ(arcPts(-0.37, -0.09, RC), roundRectProfile(-HW - 1.45, -HW - 0.05, 0, DH, 0.05), { flip: true }));
    G.yellow.push(sweepXZ(arcPts(-0.366, -0.094, RC), roundRectProfile(-HW - 1.48, -HW - 1.32, DH - 0.02, DH + 0.025, 0.012, 1), { flip: true }));
    G.wall.push(sweepXZ(arcPts(-0.38, -0.08, RC), roundRectProfile(-HW - 1.6, -HW - 0.1, 1.86, 1.98, 0.04), { flip: true }));
    RDOCKS.forEach((ph) => {
      const m = pose(ph, BACK, 0, true);
      G.door.push(xf(box(1.22, 1.16, 0.08, 0, DH + 0.6, 0.05), m));
      G.trim.push(xf(box(0.12, 1.3, 0.22, -0.67, DH + 0.63, 0.06), m), xf(box(0.12, 1.3, 0.22, 0.67, DH + 0.63, 0.06), m), xf(box(1.46, 0.14, 0.24, 0, DH + 1.27, 0.06), m));
      G.lamp.push(xf(box(0.36, 0.05, 0.14, 0, 1.83, 0.55), m));
      G.dark.push(xf(rbox(0.16, 0.3, 0.12, 0.03, -0.5, DH - 0.18, 1.4), m), xf(rbox(0.16, 0.3, 0.12, 0.03, 0.5, DH - 0.18, 1.4), m));
    });
    for (const ph of [-0.37, -0.09]) { const m = pose(ph, BACK, 0, true); G.steel.push(xf(cyl(0.04, 0.04, 1.86, 8, 0, 0.93, 1.45), m)); }
  }

  // ---------- apron, lane markings ----------
  G.conc.push(extrudeContour(crescentContour(-SB - 1.6, SB + 1.4, -HW - 1.9, HW + 3.9, 1.6, 0.3), 0, 0.045, 0.015));
  const markCol = { w: new THREE.Color(0xf4efe4), y: new THREE.Color(0xf2b51c) };
  const mark = (geo, c) => G.mark.push(colorize(geo, c.getHex()));
  {
    const yM = 0.052;
    // dashed yellow lane following the crescent
    for (let s = -SB - 0.9; s < SB + 0.8; s += 1.7) {
      const ph = s / RC, p = at(ph, HW + 3.35);
      const d = new THREE.PlaneGeometry(0.5, 0.08); d.rotateX(-Math.PI / 2); d.rotateY(-ph); d.translate(p.x, yM, p.z); mark(d, markCol.y);
    }
    // continuous edge line
    { const pth = arcPts(-(SB + 1.1) / RC, (SB + 1.0) / RC, RC); mark(sweepXZ(pth, [[HW + 3.72, yM], [HW + 3.64, yM]], { capEnds: false }), markCol.w); }
    // truck bay (kept clear for the traffic system) in front of docks 2 + 3: bay lines + yellow outline
    for (const ph of [0.172, 0.318, 0.462]) {
      const p = at(ph, HW + 2.5); const d = new THREE.PlaneGeometry(0.08, 1.8); d.rotateX(-Math.PI / 2); d.rotateY(-ph); d.translate(p.x, yM, p.z); mark(d, markCol.w);
    }
    mark(sweepXZ(arcPts(0.168, 0.466, RC), [[HW + 3.46, yM], [HW + 3.36, yM]], { capEnds: false }), markCol.y);
    // zebra crossing from the entrance across the apron
    for (let k = -3; k <= 3; k++) {
      const ph = ENT + k * 0.042, p = at(ph, HW + 2.5);
      const d = new THREE.PlaneGeometry(0.16, 2.0); d.rotateX(-Math.PI / 2); d.rotateY(-ph); d.translate(p.x, yM, p.z); mark(d, markCol.w);
    }
    // hatched no-parking zone by the conveyor
    for (let k = 0; k < 6; k++) {
      const ph = 0.5 + k * 0.04, p = at(ph, HW + 1.2);
      const d = new THREE.PlaneGeometry(0.1, 1.3); d.rotateX(-Math.PI / 2); d.rotateY(-ph + 0.6); d.translate(p.x, yM, p.z); mark(d, markCol.y);
    }
    // arrows pointing to the docks
    for (const ph of [0.245, 0.39]) {
      const sh = new THREE.Shape(); sh.moveTo(0, 0.45); sh.lineTo(0.28, 0.05); sh.lineTo(0.09, 0.05); sh.lineTo(0.09, -0.4); sh.lineTo(-0.09, -0.4); sh.lineTo(-0.09, 0.05); sh.lineTo(-0.28, 0.05); sh.closePath();
      const d = new THREE.ShapeGeometry(sh); d.rotateX(-Math.PI / 2); d.rotateY(-ph); const p = at(ph, HW + 2.9); d.translate(p.x, yM, p.z); mark(d, markCol.w);
    }
  }

  // ---------- conveyors ----------
  const beltMap = beltTex();
  const beltMat = new THREE.MeshStandardMaterial({ map: beltMap, roughness: 0.75, metalness: 0.1 });
  const belts = [];
  const conveyors = [];
  function conveyor(ax, az, dx, dz, L, h = 0.62) {
    const yaw = Math.atan2(-dz, dx), cx = ax + dx * L / 2, cz = az + dz * L / 2;
    const m = trs(cx, 0, cz, 0, yaw, 0);
    const belt = new THREE.PlaneGeometry(L, 0.6); belt.rotateX(-Math.PI / 2); belt.translate(0, h, 0);
    const uvA = belt.attributes.uv; for (let i = 0; i < uvA.count; i++) uvA.setX(i, uvA.getX(i) * L / 0.5);
    belts.push(xf(belt, m));
    G.dark.push(xf(rbox(L + 0.1, 0.16, 0.66, 0.04, 0, h - 0.09, 0), m));
    for (const s of [-1, 1]) G.steel.push(xf(rbox(L + 0.14, 0.1, 0.05, 0.02, 0, h + 0.04, s * 0.34), m));
    for (const x of [-L / 2, L / 2]) G.steel.push(xf(cyl(0.085, 0.085, 0.7, 12, x, h - 0.06, 0, Math.PI / 2), m));
    const nLeg = Math.max(2, Math.round(L / 1.15) + 1);
    for (let k = 0; k < nLeg; k++) {
      const x = -L / 2 + 0.15 + (L - 0.3) * k / (nLeg - 1);
      for (const s of [-1, 1]) G.steel.push(xf(box(0.06, h - 0.1, 0.06, x, (h - 0.1) / 2, s * 0.27), m));
      G.steel.push(xf(box(0.04, 0.04, 0.56, x, 0.22, 0), m));
      G.dark.push(xf(box(0.14, 0.03, 0.62, x, 0.015, 0), m));
    }
    // status light post at the outlet end
    G.steel.push(xf(cyl(0.025, 0.025, 0.7, 6, L / 2 - 0.1, h + 0.35, 0.38), m));
    G.lamp.push(xf(new THREE.SphereGeometry(0.06, 10, 8).translate(L / 2 - 0.1, h + 0.72, 0.38), m));
    conveyors.push({ ax, az, dx, dz, L, y: h + 0.02 });
  }
  // trans sorting conveyor: out of a hatch at the hall's right end to the vesicle launch pad
  conveyor(CONV_A.x, CONV_A.z, CONV_DIR.x, CONV_DIR.z, CONV_L);
  { // hatch with strip curtain on the facade
    const m = pose(0.475, FRONT, 0, false);
    G.trim.push(xf(box(0.95, 0.12, 0.3, 0, 1.12, 0.1), m), xf(box(0.1, 1.0, 0.3, -0.45, 0.6, 0.1), m), xf(box(0.1, 1.0, 0.3, 0.45, 0.6, 0.1), m));
    G.dark.push(xf(box(0.8, 0.45, 0.05, 0, 0.88, 0.08), m));
  }
  // cis receiving conveyor along the back, feeding into the hall
  {
    const a = at(-0.47, -HW - 1.0), b = at(-0.36, -HW - 0.2);
    const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz);
    const A = { x: a.x - dx / l * 2.2, z: a.z - dz / l * 2.2 };
    conveyor(A.x, A.z, dx / l, dz / l, l + 2.2);
    const m = pose(-0.36, BACK, 0, true);
    G.trim.push(xf(box(0.95, 0.12, 0.3, 0, 1.12, 0.1), m), xf(box(0.1, 1.0, 0.3, -0.45, 0.6, 0.1), m), xf(box(0.1, 1.0, 0.3, 0.45, 0.6, 0.1), m));
    G.dark.push(xf(box(0.8, 0.45, 0.05, 0, 0.88, 0.08), m));
  }
  const beltMesh = merged(belts, beltMat, { cast: false, name: 'belts' });

  // ---------- parcels + pallets ----------
  const palletGeo = mergeGeometries([
    ...[-0.36, -0.18, 0, 0.18, 0.36].map((x) => prep(new THREE.BoxGeometry(0.15, 0.03, 0.9).translate(x, 0.115, 0))),
    ...[-0.38, 0, 0.38].map((z) => prep(new THREE.BoxGeometry(0.9, 0.1, 0.12).translate(0, 0.05, z))),
  ]);
  const palletMats = [], parcelMats = [], parcelCols = [];
  const PCOLS = [0xf5a3c7, 0xf3e3c3, 0xd8a56d, 0xc9a6ef, 0xe77fae, 0xf7d6e4, 0xcf9a62, 0xbfe3f0];
  const pcol = () => new THREE.Color(PCOLS[Math.floor(rnd() * PCOLS.length)]);
  const addParcel = (m, x, y, z, w, h, d, yaw) => {
    const p = new THREE.Vector3(x, y, z).applyMatrix4(m);
    parcelMats.push(new THREE.Matrix4().compose(p, new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)), new THREE.Vector3(w, h, d)));
    parcelCols.push(pcol());
  };
  /** Pallet with mixed parcels in three size classes (small / medium / large crate). */
  function stack(lx, lz, yaw, base = 0, layers = 2) {
    const m = trs(lx, base, lz, 0, yaw, 0);
    palletMats.push(m);
    let y = 0.13;
    for (let ly = 0; ly < layers; ly++) {
      const pattern = rnd();
      let top = 0;
      if (pattern < 0.25) { const h = 0.42 + rnd() * 0.1; addParcel(m, 0, y + h / 2, 0, 0.8, h, 0.78, yaw + (rnd() - 0.5) * 0.1); top = h; }
      else if (pattern < 0.55) {
        for (const ox of [-0.21, 0.21]) { const h = 0.34 + rnd() * 0.08; addParcel(m, ox, y + h / 2, 0, 0.38, h, 0.78, yaw + (rnd() - 0.5) * 0.12); top = Math.max(top, h); }
      } else {
        for (const ox of [-0.21, 0.21]) for (const oz of [-0.21, 0.21]) {
          if (ly === layers - 1 && rnd() < 0.3) continue;
          const sm = rnd() < 0.4, s2 = sm ? 0.26 + rnd() * 0.04 : 0.34 + rnd() * 0.06, h = sm ? 0.24 : 0.28 + rnd() * 0.1;
          addParcel(m, ox + (rnd() - 0.5) * 0.04, y + h / 2, oz + (rnd() - 0.5) * 0.04, s2, h, s2, yaw + (rnd() - 0.5) * 0.3);
          top = Math.max(top, h);
        }
      }
      y += top + 0.01;
    }
  }
  const SP_ = (ph, u, yawOff = 0, base = 0, layers = 2) => { const p = at(ph, u); stack(p.x, p.z, -ph + yawOff, base, layers); };
  SP_(0.04, HW + 0.75, 0.1, DH, 2); SP_(0.45, HW + 0.8, -0.05, DH, 3);            // on the shipping dock
  SP_(-0.075, HW + 3.35, 0.3, 0, 3); SP_(-0.005, HW + 3.4, -0.2, 0, 2);            // staging, left of the truck bay
  SP_(-0.34, -HW - 0.75, 0.1, DH, 2); SP_(-0.12, -HW - 0.7, -0.15, DH, 3);           // receiving dock
  SP_(-0.05, -HW - 3.25, 0.2, 0, 2); SP_(0.04, -HW - 3.1, -0.1, 0, 3);               // receiving yard
  { const p = { x: PAD_LOCAL.x - CONV_DIR.z * 1.6, z: PAD_LOCAL.z + CONV_DIR.x * 1.6 }; stack(p.x, p.z, 0.6, 0, 2); }
  const nStatic = parcelMats.length;
  // moving parcels on the conveyors (spacing ~0.6, 0.5 u/s), mixed sizes
  const BELT_V = 0.5;
  const movers = [];
  conveyors.forEach((c, ci) => {
    const n = Math.floor(c.L / 0.6);
    for (let k = 0; k < n; k++) {
      const cls = (k * 7 + ci) % 3, w = [0.26, 0.34, 0.44][cls], h = [0.22, 0.3, 0.34][cls];
      movers.push({ c, s0: (k / n) * c.L, w, h, d: w * (0.85 + 0.3 * rnd()), yaw: (rnd() - 0.5) * 0.3, idx: parcelMats.length });
      parcelMats.push(new THREE.Matrix4()); parcelCols.push(pcol());
    }
  });
  const parcelGeo = new RoundedBoxGeometry(1, 1, 1, 2, 0.08);
  const parcelMat = new THREE.MeshPhysicalMaterial({ map: parcelTexture(), roughness: 0.55, clearcoat: 0.3, clearcoatRoughness: 0.4 });
  const parcels = new THREE.InstancedMesh(parcelGeo, parcelMat, parcelMats.length);
  parcelMats.forEach((m, i) => { parcels.setMatrixAt(i, m); parcels.setColorAt(i, parcelCols[i]); });
  parcels.castShadow = true; parcels.receiveShadow = true; parcels.name = 'parcels';
  parcels.frustumCulled = false;
  const pallets = new THREE.InstancedMesh(palletGeo, M.satin(0xc99a62, { rough: 0.7, clearcoat: 0.1, key: 'golgiPallet' }), palletMats.length);
  palletMats.forEach((m, i) => pallets.setMatrixAt(i, m));
  pallets.castShadow = true; pallets.receiveShadow = true;

  // ---------- forklifts (both animated: pick up at a stack, deliver to a dock) ----------
  function forkliftGeos() {
    const y = [], d = [], l = [];
    y.push(rbox(0.66, 0.42, 0.92, 0.09, 0, 0.42, -0.05), rbox(0.7, 0.44, 0.3, 0.12, 0, 0.47, -0.52), rbox(0.5, 0.12, 0.5, 0.05, 0, 0.66, 0.12));
    for (const s of [-1, 1]) for (const z of [0.27, -0.4]) d.push(cyl(0.17, 0.17, 0.13, 14, s * 0.33, 0.17, z, 0, Math.PI / 2));
    for (const s of [-1, 1]) { d.push(box(0.06, 1.45, 0.08, s * 0.22, 0.8, 0.5)); d.push(box(0.035, 0.72, 0.035, s * 0.29, 0.99, 0.18), box(0.035, 0.76, 0.035, s * 0.29, 1.0, -0.42)); d.push(box(0.08, 0.035, 0.66, s * 0.14, 0.1, 0.88)); }
    d.push(box(0.5, 0.06, 0.08, 0, 1.5, 0.5), box(0.52, 0.3, 0.04, 0, 0.3, 0.56), rbox(0.66, 0.04, 0.7, 0.015, 0, 1.37, -0.12), rbox(0.3, 0.1, 0.28, 0.04, 0, 0.74, -0.18), rbox(0.3, 0.24, 0.06, 0.03, 0, 0.88, -0.33));
    d.push(new THREE.TorusGeometry(0.1, 0.018, 6, 14).applyMatrix4(trs(0, 0.92, 0.12, -1.0, 0, 0)));
    l.push(rbox(0.5, 0.42, 0.5, 0.04, 0, 0.35, 0.9), new THREE.BoxGeometry(0.66, 0.08, 0.66).translate(0, 0.1, 0.88), rbox(0.3, 0.26, 0.3, 0.03, 0.08, 0.69, 0.92));
    return { y, d, l, lampGeo: new THREE.SphereGeometry(0.06, 10, 8).translate(0, 1.43, -0.35) };
  }
  const loadMat = M.satin(0xf2c9a0, { rough: 0.55, key: 'golgiLoad2' });
  const beaconMat = M.emissive(0xffa53a, 4, 0x6a3a10);
  function makeForklift(name) {
    const f = forkliftGeos(), grp = new THREE.Group(); grp.name = name;
    const load = merged(f.l, loadMat);
    grp.add(merged(f.y, yellowMat), merged([...f.d], darkMat), load, merged([f.lampGeo], beaconMat, { cast: false }));
    grp.userData.load = load;
    return grp;
  }
  // route: [pickup position/yaw, drop position/yaw]; yaw faces the stack / the dock
  const route = (aPh, aU, aFace, bPh, bU, bFace) => {
    const a = at(aPh, aU), b = at(bPh, bU);
    return { a: new THREE.Vector3(a.x, 0, a.z), b: new THREE.Vector3(b.x, 0, b.z), ya: -aPh + aFace, yb: -bPh + bFace };
  };
  const lifts = [
    { grp: makeForklift('forkliftA'), r: route(-0.04, HW + 2.55, 0, 0.1, HW + 2.2, Math.PI), period: 16, off: 0 },
    { grp: makeForklift('forkliftB'), r: route(0.0, -HW - 2.45, Math.PI, -0.3, -HW - 2.2, 0), period: 18, off: 7 },
  ];
  lifts.forEach((L) => g.add(L.grp));

  // ---------- bollards ----------
  for (const [ph, u] of [[0.02, HW + 1.75], [0.48, HW + 1.75], [-0.28, HW + 0.9], [0.04, HW + 0.9], [-0.39, -HW - 1.65], [-0.07, -HW - 1.65]]) {
    const p = at(ph, u);
    G.yellow.push(cyl(0.08, 0.09, 0.55, 10, p.x, 0.275, p.z));
    G.dark.push(cyl(0.083, 0.083, 0.06, 10, p.x, 0.4, p.z));
  }

  // ---------- signage ----------
  const signs = [];
  function signBoard(text, w, h, matrix, { bg = '#6a2350', fg = '#ffe6b0', posts = true, font } = {}) {
    const tex = T.signTexture(text, { bg, fg, w: 1024, h: Math.round(1024 * h / w), font: font || `800 ${Math.round(1024 * h / w * 0.5)}px Montserrat, Inter, sans-serif`, border: fg });
    const mat = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.8, roughness: 0.35 });
    const faces = [new THREE.PlaneGeometry(w, h).translate(0, 0, 0.051), new THREE.PlaneGeometry(w, h).rotateY(Math.PI).translate(0, 0, -0.051)];
    signs.push(merged(faces.map((q) => xf(q, matrix)), mat, { cast: false }));
    G.trim.push(xf(rbox(w + 0.14, h + 0.14, 0.1, 0.04), matrix));
    if (posts) {
      const py = new THREE.Vector3().setFromMatrixPosition(matrix).y;
      for (const sx of [-1, 1]) G.steel.push(xf(cyl(0.045, 0.05, py + h / 2, 8, sx * (w / 2 - 0.15), -py / 2 + h / 4, 0), matrix));
    }
  }
  { const p = at(-0.05, HW + 0.36); signBoard('PACKAGING & SHIPPING', 4.4, 0.52, trs(p.x, 2.5, p.z, 0, 0.05, 0), { posts: false }); }
  { const p = at(-0.7, -0.9); signBoard('CIS • RECEIVING', 2.3, 0.5, trs(p.x, 1.55, p.z, 0, -0.35, 0), { bg: '#4f2a6e' }); }
  { const p = at(0.66, HW + 2.6); signBoard('TRANS • SHIPPING', 2.4, 0.5, trs(p.x, 1.55, p.z, 0, -0.25, 0), { bg: '#8a2458' }); }

  // ---------- assemble static meshes ----------
  const sacs = merged(G.sac, sacMat, { keepColor: true, receive: false, name: 'cisternae' });
  const brassMesh = merged(brass, M.metal(0xd9a648, 0.28), { name: 'brass' });
  const markMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  g.add(
    sacs, brassMesh,
    merged(G.wall, wallMat, { name: 'hall' }), merged(G.trim, trimMat), merged(G.conc, concMat),
    merged(G.dark, darkMat), merged(G.yellow, yellowMat), merged(G.steel, steel),
    merged(G.lamp, lampMat, { cast: false }), merged(G.win, winMat, { cast: false, name: 'windows' }),
    merged(G.door, doorMat), merged(G.awn, awnMat), merged(G.glass, glassLit, { cast: false }),
    merged(G.mark, markMat, { cast: false, keepColor: true }),
    beltMesh, parcels, pallets, ...signs,
  );

  // ---------- budding vesicles on the trans (top) horn tips, riding a microtubule rail to the launch pad ----------
  const sites = [];
  for (const li of [3, 4, 5]) {
    const { phi1 } = layerFrame(li), ph = phi1 - 0.03;
    const tipC = P(ph, sacR(li, ph)), back = P(ph - 0.05, sacR(li, ph - 0.05));
    const n = new THREE.Vector3(tipC.x - back.x, 0, tipC.z - back.z).normalize();
    sites.push({ p: new THREE.Vector3(tipC.x, Y0 + li * SP + wave(ph, li), tipC.z), n, li });
  }
  // one lathe mesh per bud: neck smooth-max-blended into the sphere (morph 0) → detached sphere (morph 1)
  const RB = 0.21, YC = 0.34, FLARE = 0.15, WAIST = 0.4 * RB;
  const smax = (a, b, k) => { const h = Math.min(1, Math.max(0, 0.5 + (0.5 * (a - b)) / k)); return b + (a - b) * h + k * h * (1 - h); };
  const budProfile = (attached) => {
    const pts = [], N = 44, H = YC + RB;
    for (let k = 0; k <= N; k++) {
      const y = (H * k) / N, rs = Math.sqrt(Math.max(0, RB * RB - (y - YC) ** 2));
      const rn = y < YC ? WAIST + (FLARE - WAIST) * Math.exp(-y / 0.07) : 0;
      pts.push(new THREE.Vector2(k === N ? 0 : attached ? smax(rs, rn, 0.08) : rs, y));
    }
    return new THREE.LatheGeometry(pts, 28);
  };
  const budA = budProfile(true), budB = budProfile(false);
  budA.morphAttributes.position = [budB.attributes.position];
  budA.morphAttributes.normal = [budB.attributes.normal];
  const budMat = organic(new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.24, clearcoat: 1, clearcoatRoughness: 0.12, emissive: 0x5a1a70, emissiveIntensity: 0.25 }),
    { rim: 0xffd8f0, rimPower: 2.2, rimStrength: 0.6, sss: 0xff6fb0, sssStrength: 0.15, wrap: 0.5 });
  budMat.customProgramCacheKey = () => 'golgiBud4';
  const budStem = new THREE.InstancedMesh(budA, budMat, sites.length);      // attached phase (morphing)
  const buds = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 28, 18), budMat, sites.length); // detached phase
  const railMat = M.satin(0xbfe6a6, { rough: 0.35, clearcoat: 0.8, key: 'microtubule' });
  for (const m of [budStem, buds]) { m.castShadow = true; m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); }
  budStem.name = 'budStems'; buds.name = 'buds';
  const padIn = new THREE.Vector3(PAD_LOCAL.x, 0.32, PAD_LOCAL.z);
  sites.forEach((s, i) => {
    s.phase = i / sites.length + rnd() * 0.05; s.period = 10 + rnd();
    s.r = 0.18 + rnd() * 0.06; s.k = s.r / RB;                  // clamped 0.18–0.24 at spawn, never scaled down
    s.col = new THREE.Color(LAYERS[s.li].col).lerp(new THREE.Color(0xf7b8cf), 0.3);
    s.base = s.p.clone().addScaledVector(s.n, -0.24);            // lathe base sits inside the swollen tip
    s.q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), s.n);
    s.center = s.base.clone().addScaledVector(s.n, YC * s.k);   // sphere centre once fully out
    const c1 = s.center.clone().addScaledVector(s.n, 2.2); c1.y += 0.4;
    const c2 = padIn.clone(); c2.y = s.center.y * 0.55 + 1.0;
    s.hop = new THREE.CubicBezierCurve3(s.center, c1, c2, padIn); // slow free float down into the launch cradle
  });
  const budPurple = new THREE.Color(0xa970f0), tmpC = new THREE.Color();
  for (let i = 0; i < sites.length; i++) { budStem.setColorAt(i, sites[i].col); buds.setColorAt(i, sites[i].col); }
  const morphDummy = { morphTargetInfluences: [0] };
  g.add(budStem, buds);

  // ---------- warm local light ----------
  const warm = new THREE.PointLight(0xffc98f, 6, 8, 1.8); { const p = at(0.18, HW + 2.2); warm.position.set(p.x, 1.6, p.z); }
  const up = new THREE.PointLight(0xffd9a0, 16, 8, 1.5); { const p = at(0, HW + 0.4); up.position.set(p.x, HB + 0.35, p.z); }
  const pink = new THREE.PointLight(0xff9ccc, 5, 7, 1.7); { const p = at(-0.05, HW + 3.4); pink.position.set(p.x, 6.0, p.z); }
  g.add(warm, up, pink);

  // ---------- animation ----------
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _e = new THREE.Euler(), _v = new THREE.Vector3();
  const Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
  const smooth = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
  // hidden instances: tiny and parked under the floor (a zero scale divides by zero in three's instanced
  // normal correction → NaN shading → a black bloom block for a frame)
  const hide = (mesh, i) => mesh.setMatrixAt(i, _m.makeScale(1e-3, 1e-3, 1e-3).setPosition(0, -40, 0));
  g.userData.update = (t, dt) => {
    sacMat.userData.uTime.value = t;
    beltMap.offset.x -= dt * BELT_V / 0.5;
    for (const mv of movers) {
      const c = mv.c, s = (mv.s0 + t * BELT_V) % c.L;
      const sc = Math.min(1, s / 0.35, (c.L - s) / 0.35);
      _p.set(c.ax + c.dx * s, c.y + (mv.h / 2) * sc, c.az + c.dz * s);
      _q.setFromEuler(_e.set(0, Math.atan2(-c.dz, c.dx) + mv.yaw, 0)); _s.set(mv.w * sc + 1e-3, mv.h * sc + 1e-3, mv.d * sc + 1e-3);
      parcels.setMatrixAt(mv.idx, _m.compose(_p, _q, _s));
    }
    parcels.instanceMatrix.needsUpdate = true;
    // forklifts: load at stack (pause) → reverse & swing to the dock → unload (pause) → back
    for (const L of lifts) {
      const q = ((t + L.off) % L.period) / L.period;
      let k, loaded;
      if (q < 0.18) { k = 0; loaded = q > 0.1; } else if (q < 0.5) { k = smooth((q - 0.18) / 0.32); loaded = true; }
      else if (q < 0.68) { k = 1; loaded = q < 0.6; } else { k = 1 - smooth((q - 0.68) / 0.32); loaded = false; }
      const { a, b, ya, yb } = L.r;
      const mid = a.clone().lerp(b, 0.5).addScaledVector(new THREE.Vector3(-(b.z - a.z), 0, b.x - a.x).normalize(), 0.5);
      _p.copy(a).multiplyScalar((1 - k) ** 2).addScaledVector(mid, 2 * k * (1 - k)).addScaledVector(b, k * k);
      let dy = yb - ya; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      L.grp.position.copy(_p); L.grp.rotation.y = ya + dy * k;
      L.grp.userData.load.visible = loaded;
    }
    // buds: swell out of the tip with a blended neck → neck pinches (morph) → jelly release → float down into the pad
    for (let i = 0; i < sites.length; i++) {
      const s = sites[i], q = (t / s.period + s.phase) % 1;
      let attached = false, morph = 0, sq = 1;
      if (q < 0.16) { attached = true; _p.copy(s.base).addScaledVector(s.n, -(YC + RB) * s.k * (1 - smooth(q / 0.16))); }
      else if (q < 0.4) { attached = true; _p.copy(s.base); }
      else if (q < 0.52) { attached = true; _p.copy(s.base); morph = smooth((q - 0.4) / 0.12); }
      else if (q < 0.6) { const a = (q - 0.52) / 0.08; _p.copy(s.center); sq = 1 + 0.15 * Math.sin(a * Math.PI * 2) * (1 - 0.5 * a); }
      else if (q < 0.97) { const a = smooth((q - 0.6) / 0.37); s.hop.getPoint(a, _p); _p.y += Math.sin(t * 1.9 + i) * 0.05 * Math.sin(a * Math.PI); }
      else { hide(budStem, i); hide(buds, i); continue; }
      if (attached) {
        budStem.setMatrixAt(i, _m.compose(_p, s.q, _s.setScalar(s.k)));
        morphDummy.morphTargetInfluences[0] = morph; budStem.setMorphAt(i, morphDummy);
        hide(buds, i);
      } else {
        hide(budStem, i);
        _q.setFromUnitVectors(Z, s.n); _s.set(s.r / Math.sqrt(sq), s.r / Math.sqrt(sq), s.r * sq);
        buds.setMatrixAt(i, _m.compose(_p, _q, _s));
      }
      buds.setColorAt(i, tmpC.copy(s.col).lerp(budPurple, smooth((q - 0.5) / 0.2)));
    }
    budStem.instanceMatrix.needsUpdate = true; if (budStem.morphTexture) budStem.morphTexture.needsUpdate = true;
    buds.instanceMatrix.needsUpdate = true; buds.instanceColor.needsUpdate = true;
  };
  g.userData.update(0, 0);

  // ---------- gameplay data (world coords) ----------
  const W = (x, y, z) => golgiToWorld(x, y, z);
  const fp = [];
  for (let k = 0; k < 4; k++) { // hall as 4 boxes along the arc
    const ph = (-SB + (k + 0.5) * (2 * SB / 4)) / RC, p = at(ph, 0);
    const [x, , z] = W(p.x, 0, p.z);
    fp.push({ type: 'box', x, z, w: (2 * SB / 4) * (RC + HW) / RC + 0.2, d: 2 * HW + 0.3, rot: GOLGI.rot - ph });
  }
  { const ph = (0.03 + 0.462) / 2, p = at(ph, HW + 0.8); const [x, , z] = W(p.x, 0, p.z); fp.push({ type: 'box', x, z, w: (0.462 - 0.03) * (RC - HW - 0.8), d: 1.55, rot: GOLGI.rot - ph }); }
  { const ph = -0.23, p = at(ph, -HW - 0.75); const [x, , z] = W(p.x, 0, p.z); fp.push({ type: 'box', x, z, w: 0.28 * (RC + HW), d: 1.45, rot: GOLGI.rot - ph }); }
  for (const c of conveyors) { const [x, , z] = W(c.ax + c.dx * c.L / 2, 0, c.az + c.dz * c.L / 2); fp.push({ type: 'box', x, z, w: c.L + 0.2, d: 0.8, rot: GOLGI.rot + Math.atan2(-c.dz, c.dx) }); }
  for (const p of hornPillars) { const [x, , z] = W(p.x, 0, p.z); fp.push({ type: 'circle', x, z, r: 0.42 }); }
  for (const m of palletMats) { const v = new THREE.Vector3().setFromMatrixPosition(m); if (v.y < 0.1) { const [x, , z] = W(v.x, 0, v.z); fp.push({ type: 'circle', x, z, r: 0.62 }); } }
  g.userData.footprints = fp;
  const ent = at(ENT, HW + 1.3), dock = at(0.245, HW + 2.4), conv = { x: CONV_A.x + CONV_DIR.x * 2.3 - CONV_DIR.z * 0.9, z: CONV_A.z + CONV_DIR.z * 2.3 + CONV_DIR.x * 0.9 };
  const recv = at(-0.23, -HW - 2.6), bud = sites[1].p, bay = at(0.318, HW + 3.1), bayDock = at(0.318, HW + 1.6);
  g.userData.anchors = {
    golgiEntrance: W(ent.x, 0, ent.z),
    golgiExamine: W(0, 4.8, 0.2),
    golgiExamineCam: W(-3.5, 9.5, 13.5),
    golgiBudding: W(bud.x, bud.y, bud.z),
    golgiLoadingDock: W(dock.x, 0, dock.z),
    golgiSortingConveyor: W(conv.x, 0, conv.z),
    golgiReceiving: W(recv.x, 0, recv.z),
    golgiLaunchPad: W(PAD_LOCAL.x, 0, PAD_LOCAL.z),
    golgiTruckBay: W(bay.x, 0, bay.z),          // truck stops here, reversing toward golgiTruckBayDock
    golgiTruckBayDock: W(bayDock.x, 0, bayDock.z),
  };
  return g;
}
