// Smooth ER: tall, thin-walled folded membrane ribbons — hollow U-channels (two ~0.15u walls around an
// open lumen) that snake in long serpentine loops, stepping down in tiers toward the visitor, with
// elevated "aqueduct" channels crossing over as a top tier. Inner walls glow softly (lit lumen edges),
// glowing amber lipid droplets flow through the channels, NO ribosome studs. P450 detox stations digest
// toxin blobs into clean pellets, and a Ca²⁺ reservoir with a glowing gauge guards the front corner.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { SER, RER, insideCell } from '../layout.js';
import * as M from '../../core/materials.js';
import * as T from '../../core/textures.js';
import { sweepXZ, mergeGeometries, endTaper, instanced, trs, place } from '../../core/geom.js';
import { mulberry32, fbm2 } from '../../core/noise.js';
import { organic } from '../../core/lookdev.js';
import { NETWORK } from '../city/network.js';

// keep ≥1u clear of the rough-ER terraces (outer ring + wall/floor ≈ +1.6)
const ER_CLEAR = RER.rings[RER.rings.length - 1] + 2.6;
const COS = Math.cos(SER.rot), SIN = Math.sin(SER.rot);
/** Local (district) → world XZ. Local frame = group frame (position SER.x/z, rotation.y SER.rot). */
const toWorld = (x, z) => ({ x: SER.x + x * COS + z * SIN, z: SER.z - x * SIN + z * COS });
/** World distance to the nearest road edge (keeps the ER off the street network). */
const ROAD_PTS = NETWORK.edges.flatMap((e) => e.pts.map((p) => ({ x: p.x, z: p.z, hw: e.w / 2 }))).filter((p) => Math.hypot(p.x - SER.x, p.z - SER.z) < 16);
const roadDist = (wx, wz) => { let d = 1e9; for (const p of ROAD_PTS) { const q = Math.hypot(p.x - wx, p.z - wz) - p.hw; if (q < d) d = q; } return d; };
const okAt = (x, z, pad = 0) => {
  const w = toWorld(x, z);
  return Math.abs(x) < SER.w / 2 - pad * 0.5 && Math.abs(z) < SER.d / 2 - pad * 0.5 &&
    insideCell(w.x, w.z, 1.7 + pad) && Math.hypot(w.x - RER.cx, w.z - RER.cz) > ER_CLEAR + pad && roadDist(w.x, w.z) > 0.9 + pad;
};

// olive / moss family (deliberately NOT chartreuse — lysosomes own the lime)
const C_DEEP = new THREE.Color(0x434c30);
const C_BASE = [new THREE.Color(0x8aa850), new THREE.Color(0x78984a), new THREE.Color(0x96a85a)];
const C_CROWN = new THREE.Color(0xd4e892);
const C_INNER = new THREE.Color(0xa0bc66);
const C_LUMEN = new THREE.Color(0x56623c);
const _c = new THREE.Color();

/** Serpentine control points: legs run along z between zA..zB, U-turns alternate ends. */
function meander({ x0, x1, zA, zB, legs, rot = 0, rnd, startDown = true, jag = 0.8 }) {
  const sp = (x1 - x0) / (legs - 1), r = sp / 2;
  const pts = [];
  const cr = Math.cos(rot), sr = Math.sin(rot);
  const push = (x, z) => pts.push(new THREE.Vector3(x * cr + z * sr, 0, -x * sr + z * cr));
  const top = () => zA + r + (rnd() - 0.5) * 0.4 + (rnd() < 0.35 ? jag : 0);
  const bot = () => zB - r + (rnd() - 0.5) * 0.4 - (rnd() < 0.35 ? jag : 0);
  let down = startDown;
  let zStart = down ? top() - 0.4 : bot() + 0.4;
  for (let k = 0; k < legs; k++) {
    const x = x0 + k * sp;
    const zEnd = down ? bot() : top();
    if (k === 0) push(x, zStart);
    push(x + (rnd() - 0.5) * 0.35, (zStart + zEnd) / 2 + (rnd() - 0.5) * 0.4);
    if (k === legs - 1) { push(x, zEnd + (down ? 0.3 : -0.3)); break; }
    const dir = down ? 1 : -1;
    for (let q = 0; q <= 8; q++) {
      const a = Math.PI - (q / 8) * Math.PI;
      push(x + r + Math.cos(a) * r, zEnd + dir * Math.sin(a) * r);
    }
    zStart = zEnd; down = !down;
  }
  return pts;
}

/** Resample a smooth curve and split into runs that stay in the allowed area. */
function smoothRuns(ctrl, step = 0.1, halfW = 0.5) {
  const curve = new THREE.CatmullRomCurve3(ctrl, false, 'centripetal');
  const n = Math.max(8, Math.round(curve.getLength() / step));
  const runs = []; let run = null;
  for (const p of curve.getSpacedPoints(n)) {
    if (okAt(p.x, p.z, halfW)) { if (!run) runs.push(run = []); run.push({ x: p.x, z: p.z }); } else run = null;
  }
  return runs.filter((r) => r.length * step > 1.6);
}

/**
 * Flattened membrane tube: twin translucent sheets (t thick) around a lumen (half-width cw), CLOSED on top
 * by a rounded dome lip; along "window" stretches the dome folds down into the lumen so the channel is
 * open to view. Path samples carry their own base height `b` (tiers / ramps). Ends close into rounded caps.
 * Writes vertex colours + `aGlow` (lit inner lumen).
 */
function tubeRibbon(path, { cw = 0.3, t = 0.08, floorY = 0.1, tint = 0, phase = 0, windows = 0.35 }) {
  const n = path.length;
  const L = [0];
  for (let i = 1; i < n; i++) L.push(L[i - 1] + Math.hypot(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z));
  const len = L[n - 1];
  const H = new Float32Array(n), F = new Float32Array(n), B = new Float32Array(n), O = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const sv = L[i], b = path[i].b;
    B[i] = b;
    F[i] = endTaper(sv / len, len, cw + t + 0.03); // plan-view semicircle → half-round end cap
    const hMin = 1.3 + 0.2 * (b / 1.4), hMax = 1.8 + 0.1 * (b / 1.4);
    const wave = 0.5 + 0.5 * (0.6 * Math.sin(sv * 0.42 + phase) + 0.4 * Math.sin(sv * 1.07 + phase * 2.1));
    H[i] = (hMin + (hMax - hMin) * wave) * (0.82 + 0.18 * F[i]);
    // open "windows" along the run (closed near the ends so the caps stay round)
    const w = 0.5 + 0.5 * Math.sin(sv * (Math.PI * 2 / 6.5) + phase);
    O[i] = THREE.MathUtils.smoothstep(w, 1 - windows - 0.12, 1 - windows + 0.12) * THREE.MathUtils.smoothstep(Math.min(sv, len - sv), 0.6, 1.4);
  }
  const R = cw + t, lip = t / 2;
  // cap chain in OPEN form (u, mode, val): 'h' = h - val, 'f' = floorY + val, 'm' = fraction of h
  const C = [];
  for (let k = 1; k <= 6; k++) { const a = (k / 6) * Math.PI; C.push([cw + lip + Math.cos(a) * lip, 'h', lip - Math.sin(a) * lip]); }
  C.push([cw, 'm', 0.66], [cw, 'm', 0.33], [cw, 'f', 0.06], [cw - 0.06, 'f', 0], [0, 'f', -0.02], [-cw + 0.06, 'f', 0], [-cw, 'f', 0.06], [-cw, 'm', 0.33], [-cw, 'm', 0.66], [-cw, 'h', lip]);
  for (let k = 1; k <= 5; k++) { const a = Math.PI - (k / 6) * Math.PI; C.push([-cw - lip + Math.cos(a) * lip, 'h', lip - Math.sin(a) * lip]); }
  const NC = C.length;
  // full profile: outer right (3) + chain + outer left (3)
  const roles = ['o', 'o', 'o', ...C.map(() => 'c'), 'o', 'o', 'o'];
  const prof = roles.map((_, j) => [j < 3 ? R : j >= 3 + NC ? -R : C[j - 3][0], j]); // nominal (uv only)
  const geo = sweepXZ(path, prof.map(([u], j) => [u, j * 0.12]), {
    flip: true, capEnds: true, uvScale: [0.5, 1.6],
    scale: (i) => ({ u: Math.max(0.04, F[i]) }),
    displace: (v, N, i, j, u) => {
      const h = Math.max(H[i], floorY + 0.3), o = O[i], b = B[i];
      const sgn = Math.sign(u) || 1;
      const fu = Math.max(0.04, F[i]);
      let uu, yy;
      if (j < 3 || j >= 3 + NC) {
        const jj = j < 3 ? j : 3 + NC + 2 - j; // 0 bottom flare, 1 foot, 2 top
        uu = (jj === 0 ? R + 0.03 : R) * sgn;
        yy = jj === 0 ? 0 : jj === 1 ? 0.12 : THREE.MathUtils.lerp(h - R, h - lip, o);
      } else {
        const c = j - 3, [cu, m, val] = C[c];
        const yo = m === 'h' ? h - val : m === 'f' ? floorY + val : val * h;
        const th = ((c + 1) / (NC + 1)) * Math.PI;
        const uc = R * Math.cos(th), yc = h - R + R * Math.sin(th);
        uu = THREE.MathUtils.lerp(uc, cu, o); yy = THREE.MathUtils.lerp(yc, yo, o);
      }
      // place relative to the path centre (undo sweep's own u offset, re-apply ours with end scaling)
      v.x += N.x * (uu * fu - u); v.z += N.y * (uu * fu - u);
      v.y = b + yy;
    },
  });
  const pos = geo.attributes.position, m = roles.length;
  const col = new Float32Array(pos.count * 3), glow = new Float32Array(pos.count);
  const baseC = C_BASE[tint % C_BASE.length];
  for (let k = 0; k < pos.count; k++) {
    const i = Math.min(n - 1, Math.floor(k / m)), j = k % m, cap = k >= n * m;
    const h = Math.max(H[i], 0.5), y = (pos.getY(k) - B[i]) / h, o = O[i];
    const drift = 0.5 + 0.5 * Math.sin(L[i] * 0.3 + phase);
    if (!cap && roles[j] === 'o') { _c.copy(C_DEEP).lerp(baseC, THREE.MathUtils.smoothstep(y, 0, 0.45)).lerp(C_CROWN, THREE.MathUtils.smoothstep(y, 0.8, 1) * 0.55); glow[k] = 0; }
    else {
      // chain: closed → pale crown dome; open → lumen gradient with lit upper edges
      _c.copy(C_LUMEN).lerp(C_INNER, THREE.MathUtils.smoothstep(y, 0.15, 1));
      const cc = _c.clone(); _c.copy(baseC).lerp(C_CROWN, 0.7).lerp(cc, o);
      glow[k] = cap ? 0.05 : (0.1 + 0.55 * Math.pow(THREE.MathUtils.clamp(y, 0, 1), 2)) * o + 0.12 * (1 - o);
    }
    _c.offsetHSL(0, 0, (drift - 0.5) * 0.04);
    col[k * 3] = _c.r; col[k * 3 + 1] = _c.g; col[k * 3 + 2] = _c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aGlow', new THREE.BufferAttribute(glow, 1));
  const samples = path.map((p, i) => ({ x: p.x, z: p.z, h: H[i], s: L[i], f: F[i], base: B[i] }));
  return { geo, samples, len };
}

function ix(g) { if (!g.index) { const a = []; for (let i = 0; i < g.attributes.position.count; i++) a.push(i); g.setIndex(a); } return g; }
/** Keep only the listed attributes so geometries merge cleanly. */
function clean(g, keep = ['position', 'normal', 'uv']) {
  g = ix(g);
  for (const k of Object.keys(g.attributes)) if (!keep.includes(k)) g.deleteAttribute(k);
  if (!g.attributes.normal) g.computeVertexNormals();
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  return g;
}

/** Round analogue gauge face (canvas) with coloured arc; needle is a separate mesh. */
function gaugeTexture(title, sub, arc = ['#3fb6ff', '#7ff0ff']) {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(S / 2, S / 2, 10, S / 2, S / 2, S / 2);
  g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#dfe8ee');
  x.fillStyle = '#2a3036'; x.fillRect(0, 0, S, S);
  x.fillStyle = g; x.beginPath(); x.arc(S / 2, S / 2, S * 0.46, 0, Math.PI * 2); x.fill();
  const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
  const grd = x.createLinearGradient(0, S, S, 0); grd.addColorStop(0, arc[0]); grd.addColorStop(1, arc[1]);
  x.strokeStyle = grd; x.lineWidth = 18; x.beginPath(); x.arc(S / 2, S / 2, S * 0.36, a0, a1); x.stroke();
  x.strokeStyle = '#22303a'; x.lineWidth = 3;
  for (let k = 0; k <= 10; k++) {
    const a = a0 + (a1 - a0) * (k / 10), r0 = S * (k % 5 ? 0.3 : 0.27), r1 = S * 0.41;
    x.beginPath(); x.moveTo(S / 2 + Math.cos(a) * r0, S / 2 + Math.sin(a) * r0); x.lineTo(S / 2 + Math.cos(a) * r1, S / 2 + Math.sin(a) * r1); x.stroke();
  }
  x.fillStyle = '#16323f'; x.textAlign = 'center'; x.font = '800 44px Montserrat, sans-serif'; x.fillText(title, S / 2, S * 0.66);
  x.font = '700 20px Inter, sans-serif'; x.fillStyle = '#3d5a66'; x.fillText(sub, S / 2, S * 0.8);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

/** Little LCD for the detox stations. */
function detoxScreen() {
  const W = 256, H = 128, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  x.fillStyle = '#06200c'; x.fillRect(0, 0, W, H);
  x.strokeStyle = 'rgba(140,255,120,0.18)';
  for (let i = 0; i < W; i += 16) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, H); x.stroke(); }
  x.strokeStyle = '#9dff6a'; x.lineWidth = 4; x.beginPath();
  for (let i = 0; i <= W; i += 4) { const y = 82 - Math.exp(-Math.pow((i - 150) / 26, 2)) * 50 - Math.sin(i * 0.2) * 4; i ? x.lineTo(i, y) : x.moveTo(i, y); }
  x.stroke();
  x.fillStyle = '#d8ff9a'; x.font = '800 30px Montserrat, sans-serif'; x.fillText('P450', 12, 36);
  x.font = '700 16px Inter, sans-serif'; x.fillStyle = '#7fe86a'; x.fillText('DETOX  ▸ OK', 12, 116);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Ribbon material: satin olive membrane + fresnel rim + per-vertex lumen glow (aGlow). */
/** Longitudinal ridges: soft horizontal flutes running along each sheet (v = height). */
function ridgeNormal() {
  const W = 16, H = 256, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d'), img = x.createImageData(W, H);
  for (let j = 0; j < H; j++) {
    const v = j / H, dh = Math.cos(v * Math.PI * 2 * 8) * 0.55 + Math.cos(v * Math.PI * 2 * 21 + 1.3) * 0.18;
    const ny = -dh, l = Math.hypot(ny, 1);
    for (let i = 0; i < W; i++) { const k = (j * W + i) * 4; img.data[k] = 128; img.data[k + 1] = (ny / l * 0.5 + 0.5) * 255; img.data[k + 2] = (1 / l * 0.5 + 0.5) * 255; img.data[k + 3] = 255; }
  }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.NoColorSpace;
  return t;
}

function ribbonMaterial() {
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, vertexColors: true, roughness: 0.42, clearcoat: 0.3, clearcoatRoughness: 0.3, sheen: 0,
    normalMap: ridgeNormal(), normalScale: new THREE.Vector2(0.35, 0.35),
  });
  const u = { uGlow: { value: new THREE.Color(0xd8f080) }, uGlowStr: { value: 0.95 } };
  mat.userData.glow = u;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aGlow; varying float vGlow;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = aGlow;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vGlow; uniform vec3 uGlow; uniform float uGlowStr;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += uGlow * vGlow * uGlowStr;')
      // membrane sheets: see-through face-on, solid at grazing angles (like the cell membrane wall)
      .replace('#include <opaque_fragment>', `{ float ndvS = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
          diffuseColor.a = mix(0.99, 0.82, pow(ndvS, 1.3)); }
        #include <opaque_fragment>`);
  };
  mat.transparent = true; mat.depthWrite = true;
  organic(mat, { rim: 0xe2f4a0, rimPower: 2.4, rimStrength: 0.5, sss: 0x6a8a2a, sssStrength: 0.14 });
  mat.customProgramCacheKey = () => 'serRibbonGlow';
  return mat;
}

export function buildSER() {
  const g = new THREE.Group(); g.name = 'ser';
  g.position.set(SER.x, 0, SER.z); g.rotation.y = SER.rot;
  const rnd = mulberry32(2024);
  const footprints = [], anchors = {};
  const W3 = (x, y, z) => { const w = toWorld(x, z); return [+w.x.toFixed(2), +y.toFixed(2), +w.z.toFixed(2)]; };

  // ---------------------------------------------------------------- one continuous folded ribbon network
  // A single flattened membrane tube folds back and forth (boustrophedon) through three terraced tiers:
  // back rows on struts at 1.4u, middle rows at 0.7u, front rows on the floor, ramping between tiers, then
  // runs out as a tendril toward the east boulevard; a second branch buds off toward the dock road.
  const ribbonMat = ribbonMaterial();
  const MAIN = [[4.6, -7.3, 1.4], [2.4, -7.3, 1.4], [0.4, -7.3, 1.4], [-0.5, -6.4, 1.4], [0.2, -5.5, 1.4], [2.6, -5.5, 1.4], [4.4, -5.5, 1.4], [5.2, -4.6, 1.4], [4.5, -3.7, 1.4],
    [2.0, -3.7, 1.4], [-1.4, -3.7, 1.4], [-2.6, -3.6, 1.35], [-3.5, -2.8, 1.05], [-2.8, -1.9, 0.75], [0, -1.9, 0.7], [3, -1.9, 0.7], [5.0, -1.9, 0.7], [5.8, -1.0, 0.7], [5.1, -0.1, 0.7],
    [2, -0.1, 0.7], [-2, -0.1, 0.7], [-4.8, -0.1, 0.7], [-5.8, 0.6, 0.6], [-6.3, 1.7, 0.3], [-6.0, 2.8, 0.05], [-4.8, 3.5, 0], [-1.5, 3.5, 0], [2.4, 3.5, 0], [4.0, 4.0, 0], [4.0, 5.0, 0],
    [2.6, 5.3, 0], [-1, 5.3, 0], [-3.8, 5.3, 0], [-4.7, 5.9, 0], [-5.0, 6.9, 0]];
  const BRANCH = [[1.4, 5.0, 0], [1.9, 6.3, 0], [1.6, 7.3, 0], [0.9, 7.9, 0]];
  const resample = (cp, step = 0.1, wob = 0.1) => {
    const curve = new THREE.CatmullRomCurve3(cp.map(([x, z, b]) => new THREE.Vector3(x, b, z)), false, 'centripetal');
    const pts = curve.getSpacedPoints(Math.max(8, Math.round(curve.getLength() / step)));
    // gentle lateral wobble so the folds read organic, not drafted
    return pts.map((p, i) => {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      const tx = b.x - a.x, tz = b.z - a.z, l = Math.hypot(tx, tz) || 1, w = Math.sin(i * step * 1.25) * wob * Math.min(1, i * step, (pts.length - 1 - i) * step);
      return { x: p.x - (tz / l) * w, z: p.z + (tx / l) * w, b: Math.max(0, p.y) };
    });
  };
  const geos = [], allSamples = [], channels = [], struts = [];
  const addRibbon = (run, opt) => {
    const ch = tubeRibbon(run, opt);
    geos.push(ch.geo); channels.push({ run, ...ch, floorY: 0.1 });
    ch.samples.forEach((sm) => allSamples.push({ ...sm, id: channels.length - 1 }));
    for (let k = 0; k < run.length - 1; k += 8) {
      const a = run[k], e = run[Math.min(run.length - 1, k + 8)];
      const wa = toWorld(a.x, a.z), we = toWorld(e.x, e.z), dx = we.x - wa.x, dz = we.z - wa.z;
      footprints.push({ type: 'box', x: (wa.x + we.x) / 2, z: (wa.z + we.z) / 2, w: Math.hypot(dx, dz) + 0.25, d: 0.95, rot: Math.atan2(-dz, dx), id: 'ser' });
    }
    ch.samples.forEach((sm, k) => {
      if (k % 10 !== 5 || sm.base < 0.2 || sm.f < 0.6) return;
      const a = run[Math.max(0, k - 1)], b = run[Math.min(run.length - 1, k + 1)];
      const tx = b.x - a.x, tz = b.z - a.z, l = Math.hypot(tx, tz) || 1, nx = -tz / l, nz = tx / l;
      for (const sd of [-1, 1]) struts.push(trs(sm.x + nx * 0.3 * sd, sm.base / 2, sm.z + nz * 0.3 * sd, 0, 0, 0, 1, sm.base, 1));
    });
  };
  addRibbon(resample(MAIN), { tint: 0, phase: 0.7 });
  addRibbon(resample(BRANCH, 0.1, 0.05), { tint: 2, phase: 2.1, windows: 0.5 });
  const ribbons = new THREE.Mesh(mergeGeometries(geos.map((q) => clean(q, ['position', 'normal', 'uv', 'color', 'aGlow']))), ribbonMat);
  ribbons.castShadow = ribbons.receiveShadow = true; ribbons.name = 'serRibbons';
  g.add(ribbons);
  {
    // soft-edged membrane apron: radial outline hugging the ribbon footprint, wobbly, kept off roads
    const cx = 0.3, cz = -0.6, NA = 120, Rr = new Float32Array(NA);
    for (const sm of allSamples) {
      const a = Math.atan2(sm.z - cz, sm.x - cx), k = ((Math.round(a / (Math.PI * 2) * NA) % NA) + NA) % NA;
      Rr[k] = Math.max(Rr[k], Math.hypot(sm.x - cx, sm.z - cz) + 1.1);
    }
    const sm2 = Rr.map((_, k) => { let mx = 0; for (let d = -4; d <= 4; d++) mx = Math.max(mx, Rr[(k + d + NA) % NA] * (1 - Math.abs(d) * 0.02)); return mx; });
    const inner = [], outer = [];
    for (let k = 0; k < NA; k++) {
      const a = (k / NA) * Math.PI * 2, c = Math.cos(a), s2 = Math.sin(a);
      let R = Math.max(2.5, sm2[k]) * (1 + fbm2(c * 1.7 + 3, s2 * 1.7, 2) * 0.12);
      while (R > 1 && !okAt(cx + c * R, cz + s2 * R, -0.45)) R -= 0.1;
      inner.push([cx + c * R, cz + s2 * R]);
      let R2 = R + 0.9; while (R2 > R + 0.1 && !okAt(cx + c * R2, cz + s2 * R2, -0.55)) R2 -= 0.1;
      outer.push([cx + c * R2, cz + s2 * R2]);
    }
    const pos = [cx, 0.025, cz], col = [1, 1, 1, 1], idx = [];
    inner.forEach(([x, z]) => { pos.push(x, 0.025, z); col.push(1, 1, 1, 1); });
    outer.forEach(([x, z]) => { pos.push(x, 0.02, z); col.push(1, 1, 1, 0); });
    for (let k = 0; k < NA; k++) {
      const a = 1 + k, b = 1 + ((k + 1) % NA), oa = 1 + NA + k, ob = 1 + NA + ((k + 1) % NA);
      idx.push(0, b, a, a, b, ob, a, ob, oa);
    }
    const ag = new THREE.BufferGeometry();
    ag.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    ag.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
    const uvs = []; for (let k = 0; k < pos.length; k += 3) uvs.push(pos[k] * 0.35, pos[k + 2] * 0.35);
    ag.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    ag.setIndex(idx); ag.computeVertexNormals();
    const nrm = T.membraneNormal().clone(); nrm.repeat.set(1, 1); nrm.needsUpdate = true;
    const apronMat = new THREE.MeshStandardMaterial({ color: 0x6f7a58, roughness: 0.7, vertexColors: true, opacity: 0.85, transparent: true, depthWrite: false, normalMap: nrm, normalScale: new THREE.Vector2(0.5, 0.5), polygonOffset: true, polygonOffsetFactor: -2 });
    const apron = new THREE.Mesh(ag, apronMat); apron.receiveShadow = true; apron.renderOrder = -1; apron.name = 'serApron';
    g.add(apron);
  }
  const strutMat = new THREE.MeshPhysicalMaterial({ color: 0x8a9a62, roughness: 0.4, clearcoat: 0.4 });
  g.add(instanced(new THREE.CylinderGeometry(0.045, 0.06, 1, 8), strutMat, struts, { castShadow: true }));

  // ---------------------------------------------------------------- shared prop materials (clean enamel, no blotch maps)
  const enamel = (color, rough = 0.32, metal = 0.0) => new THREE.MeshPhysicalMaterial({ color, roughness: rough, metalness: metal, clearcoat: 0.6, clearcoatRoughness: 0.2 });
  const creamMat = enamel(0xe9e4d0, 0.3, 0.3);
  const darkMat = enamel(0x3a4046, 0.45, 0.3);
  const steelMat = M.metal(0xc7cdd4, 0.28);
  const accentMat = enamel(0x5f7f26, 0.35);
  const glowGreen = new THREE.MeshStandardMaterial({ color: 0x2a5a10, emissive: 0x9dff4a, emissiveIntensity: 4.2, roughness: 0.3 });
  const glassMat = M.glass(0xe8fff0, 0.3);
  const redMat = enamel(0xd8382a, 0.35);
  const creamGeos = [], darkGeos = [], steelGeos = [], accentGeos = [], glowGeos = [], glassGeos = [], redGeos = [], bulbGeos = [];
  const indicators = [], indColors = [];
  const nearestWall = (x, z) => { let b = null, bd = 1e9; for (const s of allSamples) { if (s.f < 1) continue; const d = Math.hypot(s.x - x, s.z - z); if (d < bd) { bd = d; b = s; } } return b; };

  // ---------------------------------------------------------------- detox (P450) stations in the corridor
  const detoxTex = detoxScreen();
  const screenMat = new THREE.MeshStandardMaterial({ map: detoxTex, emissive: 0xffffff, emissiveMap: detoxTex, emissiveIntensity: 1.6, roughness: 0.25 });
  const screenGeos = [];
  const stations = [{ x: -3.5, z: 1.6, a: 0.04 }, { x: 0.0, z: 1.55, a: -0.03 }, { x: 3.5, z: 1.65, a: 0.05 }];
  const flows = []; // hose (ribbon → station) + pellet chute paths (local)
  stations.forEach((st, si) => {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(st.x, 0, st.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), st.a), new THREE.Vector3(1.15, 1.15, 1.15));
    const add = (arr, geo) => { geo.applyMatrix4(m); arr.push(clean(geo)); };
    add(darkGeos, place(new RoundedBoxGeometry(1.05, 0.12, 0.8, 2, 0.04), 0, 0.06, 0));
    add(creamGeos, place(new RoundedBoxGeometry(0.8, 0.62, 0.52, 3, 0.09), 0, 0.43, 0));
    add(accentGeos, place(new RoundedBoxGeometry(0.83, 0.09, 0.55, 2, 0.03), 0, 0.5, 0));
    add(creamGeos, place(new THREE.CylinderGeometry(0.16, 0.22, 0.12, 20), 0.12, 0.8, 0));
    add(steelGeos, place(new THREE.TorusGeometry(0.2, 0.03, 8, 24), 0.12, 0.87, 0, Math.PI / 2));
    add(glassGeos, place(new THREE.SphereGeometry(0.2, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), 0.12, 0.86, 0));
    add(glowGeos, place(new THREE.IcosahedronGeometry(0.1, 2), 0.12, 0.95, 0));
    // intake funnel (toxins in) on the right, outlet chute (pellets out) on the left
    add(steelGeos, place(new THREE.CylinderGeometry(0.16, 0.07, 0.2, 16, 1, true), 0.5, 0.62, 0.05));
    add(steelGeos, place(new THREE.CylinderGeometry(0.06, 0.06, 0.3, 10), -0.52, 0.32, 0.05, 0, 0, 0.9));
    add(darkGeos, place(new THREE.CylinderGeometry(0.12, 0.12, 0.5, 16), -0.47, 0.37, -0.15));
    const sg = new THREE.PlaneGeometry(0.42, 0.21); sg.translate(-0.08, 0.6, 0.265); sg.applyMatrix4(m); screenGeos.push(sg);
    for (let k = 0; k < 3; k++) {
      const p = new THREE.Vector3(0.2 + k * 0.08, 0.32, 0.27).applyMatrix4(m);
      indicators.push(trs(p.x, p.y, p.z, 0, 0, 0, 0.042)); indColors.push(new THREE.Color([0x8dff3a, 0xffd23a, 0x8dff3a][k]));
    }
    const wl = nearestWall(st.x, st.z - 1.6);
    let hose = null;
    if (wl) {
      const p0 = new THREE.Vector3(0.12, 1.0, -0.05).applyMatrix4(m), p1 = new THREE.Vector3(wl.x, wl.base + 0.35, wl.z);
      const mid = p0.clone().lerp(p1, 0.5); mid.y = Math.max(p0.y, p1.y) + 0.45;
      hose = new THREE.CatmullRomCurve3([p1, mid, p0]);
      // clear hose: glass sleeve + steel collars so the droplets inside are visible
      glassGeos.push(clean(new THREE.TubeGeometry(hose, 24, 0.07, 10)));
      for (const k of [0.04, 0.96]) { const c = hose.getPointAt(k); steelGeos.push(clean(place(new THREE.SphereGeometry(0.09, 12, 8), c.x, c.y, c.z))); }
    }
    // pellet tray beside the outlet chute (clean product collects here)
    add(darkGeos, place(new RoundedBoxGeometry(0.42, 0.1, 0.42, 2, 0.03), -0.82, 0.05, 0.12));
    add(accentGeos, place(new RoundedBoxGeometry(0.46, 0.04, 0.46, 2, 0.015), -0.82, 0.11, 0.12));
    flows.push({ hose, out0: new THREE.Vector3(-0.55, 0.36, 0.05).applyMatrix4(m), out1: new THREE.Vector3(-0.82, 0.13, 0.12).applyMatrix4(m) });
    const w = toWorld(st.x, st.z); footprints.push({ type: 'circle', x: w.x, z: w.z, r: 0.7, id: 'serDetox' });
  });
  anchors.detox = W3(stations[1].x, 0.8, stations[1].z + 0.5);
  anchors.detoxStand = W3(stations[1].x, 0, stations[1].z + 1.2);

  // clean pellets (pale lime) roll out of the chute into the tray
  const pelMat = new THREE.MeshStandardMaterial({ color: 0xe8ffc0, emissive: 0xc8ff7a, emissiveIntensity: 2.2, roughness: 0.3 });
  const pelMesh = instanced(new THREE.SphereGeometry(1, 12, 8), pelMat, flows.flatMap(() => [0, 1, 2].map(() => new THREE.Matrix4())), { castShadow: false });
  g.add(pelMesh);

  // ---------------------------------------------------------------- lipid droplets flowing through the channels (glowing amber)
  const dropMat = organic(new THREE.MeshPhysicalMaterial({ color: 0xffc04a, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05, emissive: 0xff9a1a, emissiveIntensity: 1.1 }),
    { rim: 0xfff0b0, rimPower: 2, rimStrength: 0.6, sss: 0xffa020, sssStrength: 0.3 });
  const drops = [];
  channels.forEach((ch, ci) => {
    const cnt = Math.max(3, Math.round(ch.len / 0.9));
    for (let k = 0; k < cnt; k++) drops.push({ ci, s0: (k / cnt) * ch.len + rnd() * 0.5, r: 0.09 + rnd() * 0.06, v: 0.5 * (0.85 + rnd() * 0.3) });
  });
  const dropMesh = instanced(new THREE.SphereGeometry(1, 18, 12), dropMat, drops.map(() => new THREE.Matrix4()), { castShadow: false });
  dropMesh.name = 'lipidDroplets'; g.add(dropMesh);
  // droplets drawn off through each hose into the P450 stations
  const hoseDrops = flows.flatMap((f, fi) => (f.hose ? [0, 1, 2, 3].map((k) => ({ fi, ph: k / 4 })) : []));
  const hoseMesh = instanced(new THREE.SphereGeometry(1, 12, 8), dropMat, hoseDrops.map(() => new THREE.Matrix4()), { castShadow: false });
  g.add(hoseMesh);
  const sampleAt = (ch, s) => {
    const smp = ch.samples; s = ((s % ch.len) + ch.len) % ch.len;
    let lo = 0, hi = smp.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; smp[mid].s < s ? (lo = mid) : (hi = mid); }
    const a = smp[lo], b = smp[hi], t = (s - a.s) / Math.max(1e-5, b.s - a.s);
    return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, f: Math.min(a.f, b.f), base: a.base + (b.base - a.base) * t };
  };

  // ---------------------------------------------------------------- Ca²⁺ reservoir (front-right corner)
  const CA = { x: 6.1, z: 4.6 };
  const caParts = (() => {
    const m = new THREE.Matrix4().makeTranslation(CA.x, 0, CA.z);
    const add = (arr, geo) => { geo.applyMatrix4(m); arr.push(clean(geo)); };
    add(darkGeos, place(new THREE.CylinderGeometry(1.0, 1.06, 0.16, 40), 0, 0.08, 0));
    add(creamGeos, place(new THREE.CylinderGeometry(0.82, 0.86, 0.4, 40), 0, 0.36, 0));
    add(glassGeos, place(new THREE.CylinderGeometry(0.8, 0.8, 1.45, 40, 1, true), 0, 1.28, 0));
    for (const y of [0.56, 1.28, 2.0]) add(steelGeos, place(new THREE.TorusGeometry(0.81, 0.045, 10, 48), 0, y, 0, Math.PI / 2));
    for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3 + 0.3; add(steelGeos, place(new THREE.BoxGeometry(0.05, 1.45, 0.05), Math.cos(a) * 0.81, 1.28, Math.sin(a) * 0.81)); }
    add(creamGeos, place(new THREE.SphereGeometry(0.83, 40, 14, 0, Math.PI * 2, 0, Math.PI / 2), 0, 2.0, 0, 0, 0, 0, 1, 0.42, 1));
    // panel seam + hatch ring on the dome (clean painted-metal look)
    add(darkGeos, place(new THREE.TorusGeometry(0.62, 0.014, 6, 48), 0, 2.235, 0, Math.PI / 2));
    add(steelGeos, place(new THREE.TorusGeometry(0.2, 0.025, 8, 24), 0, 2.33, 0, Math.PI / 2));
    add(steelGeos, place(new THREE.CylinderGeometry(0.08, 0.1, 0.35, 12), 0, 2.45, 0));
    add(redGeos, place(new THREE.SphereGeometry(0.07, 12, 8), 0, 2.65, 0));
    const pipeA = new THREE.Vector3(-0.7, 0.75, -0.35), pipeB = new THREE.Vector3(-1.45, 0.75, -0.75), pipeC = new THREE.Vector3(-1.75, 0.95, -1.1);
    add(steelGeos, new THREE.TubeGeometry(new THREE.CatmullRomCurve3([pipeA, pipeB, pipeC]), 20, 0.09, 10));
    const vw = new THREE.Vector3(-1.12, 0.75, -0.55);
    add(steelGeos, place(new THREE.CylinderGeometry(0.035, 0.035, 0.32, 8), vw.x, vw.y + 0.16, vw.z));
    add(redGeos, place(new THREE.TorusGeometry(0.17, 0.035, 8, 24), vw.x, vw.y + 0.33, vw.z, Math.PI / 2));
    for (let k = 0; k < 3; k++) add(redGeos, place(new THREE.BoxGeometry(0.32, 0.025, 0.025), vw.x, vw.y + 0.33, vw.z, 0, k * Math.PI / 3, 0));
    add(steelGeos, place(new THREE.CylinderGeometry(0.13, 0.13, 0.12, 14), pipeA.x - 0.04, pipeA.y, pipeA.z, 0, 0, Math.PI / 2));
    return { vw };
  })();
  const caLiquidMat = new THREE.MeshStandardMaterial({ color: 0x9fe8ff, emissive: 0x6fd8ff, emissiveIntensity: 1.9, roughness: 0.15, transparent: true, opacity: 0.92 });
  const caLiquid = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 1, 36), caLiquidMat);
  caLiquid.geometry.translate(0, 0.5, 0); caLiquid.position.set(CA.x, 0.56, CA.z); caLiquid.scale.y = 1.2;
  g.add(caLiquid);
  const bubBase = [];
  for (let k = 0; k < 18; k++) { const a = rnd() * 6.28, r = rnd() * 0.55; bubBase.push({ x: CA.x + Math.cos(a) * r, z: CA.z + Math.sin(a) * r, ph: rnd(), s: 0.03 + rnd() * 0.04 }); }
  const bubMesh = instanced(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xdff8ff, emissiveIntensity: 3.2 }), bubBase.map(() => new THREE.Matrix4()), { castShadow: false, receiveShadow: false });
  g.add(bubMesh);
  const gTex = gaugeTexture('Ca²⁺', 'RESERVOIR');
  const gaugeMat = new THREE.MeshStandardMaterial({ map: gTex, emissive: 0xffffff, emissiveMap: gTex, emissiveIntensity: 1.25, roughness: 0.2 });
  const gauge = new THREE.Group(); gauge.position.set(CA.x + 0.2, 0.42, CA.z + 0.87); gauge.rotation.y = 0.22;
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.3, 40), gaugeMat); face.position.z = 0.03; gauge.add(face);
  const bezel = new THREE.Mesh(new THREE.TorusGeometry(0.305, 0.035, 10, 40), steelMat); bezel.position.z = 0.03; gauge.add(bezel);
  const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.06, 32), darkMat); housing.rotation.x = Math.PI / 2; gauge.add(housing);
  const needle = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.24, 0.012), M.emissive(0xff4a2a, 3)); needle.geometry.translate(0, 0.11, 0); needle.position.z = 0.045; gauge.add(needle);
  g.add(gauge);
  anchors.calcium = W3(CA.x + caParts.vw.x, 1.05, CA.z + caParts.vw.z);
  anchors.calciumGauge = W3(CA.x + 0.2, 0.42, CA.z + 0.9);
  { const w = toWorld(CA.x, CA.z); footprints.push({ type: 'circle', x: w.x, z: w.z, r: 1.08, id: 'serCalcium' }); }

  // ---------------------------------------------------------------- entrance: sign + two lamps (no fence — the ER flows into the city)
  const signTex = T.signTexture('SMOOTH ER', { bg: '#4f6a1c', fg: '#f6fbd8', w: 512, h: 128, border: '#c8e070', font: '800 56px Montserrat, sans-serif' });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.375), new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.4, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 0.35 }));
  const signX = -2.4, signZ = 8.0;
  sign.position.set(signX, 1.35, signZ + 0.045); g.add(sign);
  creamGeos.push(clean(place(new RoundedBoxGeometry(1.62, 0.47, 0.06, 2, 0.02), signX, 1.35, signZ)));
  for (const s of [-0.7, 0.7]) steelGeos.push(clean(place(new THREE.CylinderGeometry(0.04, 0.04, 1.15, 8), signX + s, 0.58, signZ)));
  for (const [lx, lz] of [[-4.2, 8.1], [3.6, 7.6]]) {
    if (!okAt(lx, lz, -0.5)) continue;
    steelGeos.push(clean(place(new THREE.CylinderGeometry(0.04, 0.06, 2.2, 8), lx, 1.1, lz)));
    steelGeos.push(clean(place(new THREE.CylinderGeometry(0.13, 0.17, 0.08, 12), lx, 2.24, lz)));
    bulbGeos.push(clean(place(new THREE.SphereGeometry(0.1, 12, 8), lx, 2.15, lz)));
    const w = toWorld(lx, lz); footprints.push({ type: 'circle', x: w.x, z: w.z, r: 0.12, id: 'serLamp' });
  }

  // ---------------------------------------------------------------- merge prop meshes per material
  const addMerged = (arr, mat, name, shadow = true) => {
    if (!arr.length) return null;
    const mesh = new THREE.Mesh(mergeGeometries(arr), mat); mesh.name = name;
    mesh.castShadow = shadow; mesh.receiveShadow = true; g.add(mesh); return mesh;
  };
  addMerged(creamGeos, creamMat, 'serCream');
  addMerged(darkGeos, darkMat, 'serDark');
  addMerged(steelGeos, steelMat, 'serSteel');
  addMerged(accentGeos, accentMat, 'serAccent');
  addMerged(glowGeos, glowGreen, 'serGlow', false);
  addMerged(glassGeos, glassMat, 'serGlass', false);
  addMerged(redGeos, redMat, 'serRed');
  addMerged(bulbGeos, M.emissive(0xffd79a, 4.5, 0xfff2d8), 'serBulbs', false);
  addMerged(screenGeos.map((q) => clean(q)), screenMat, 'serScreens', false);
  const indMesh = instanced(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 4, 4) }), indicators, { castShadow: false, colors: indColors });
  g.add(indMesh);

  const corridorLight = new THREE.PointLight(0xd0f070, 4, 9, 1.6); corridorLight.position.set(0, 2.4, 1.8); g.add(corridorLight);
  const caLight = new THREE.PointLight(0x8fe6ff, 3, 5, 1.8); caLight.position.set(CA.x, 1.6, CA.z + 0.6); g.add(caLight);

  anchors.center = W3(0, 0, 0);
  anchors.entrance = W3(-2.4, 0, 8.6);
  anchors.corridor = W3(1.6, 0, 2.6);
  anchors.examineCam = W3(-2.5, 8.5, 16.5);
  anchors.examineTarget = W3(0.5, 1.6, -1.5);
  g.userData.anchors = anchors;
  g.userData.footprints = footprints;

  // ---------------------------------------------------------------- animation
  const mm = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), pV = new THREE.Vector3(), sV = new THREE.Vector3();
  const indBase = indColors.map((c) => c.clone());
  const off = new THREE.Color(0x0a1a06);
  g.userData.update = (t) => {
    // lipid droplets ride the channel lumens
    drops.forEach((d, i) => {
      const ch = channels[d.ci], p = sampleAt(ch, d.s0 + t * d.v);
      const sc = d.r * THREE.MathUtils.smoothstep(p.f, 0.7, 1);
      dropMesh.setMatrixAt(i, mm.compose(pV.set(p.x, p.base + ch.floorY + d.r * 0.9 + Math.sin(t * 2 + i) * 0.02, p.z), q.identity(), sV.setScalar(sc)));
    });
    dropMesh.instanceMatrix.needsUpdate = true;
    // detox flow: lipid droplets through the hoses in, clean pellets out into the tray
    hoseDrops.forEach((h, i) => {
      const u = (t * 0.22 + h.ph + h.fi * 0.13) % 1;
      hoseMesh.setMatrixAt(i, mm.compose(flows[h.fi].hose.getPointAt(u), q.identity(), sV.setScalar(0.05 * Math.min(1, u * 8, (1 - u) * 8))));
    });
    hoseMesh.instanceMatrix.needsUpdate = true;
    flows.forEach((f, fi) => {
      for (let k = 0; k < 3; k++) {
        const w = (t * 0.28 + k / 3 + fi * 0.21 + 0.5) % 1;
        pV.copy(f.out0).lerp(f.out1, w); pV.y = THREE.MathUtils.lerp(f.out0.y, 0.08, Math.min(1, w * 1.5));
        pelMesh.setMatrixAt(fi * 3 + k, mm.compose(pV, q.identity(), sV.setScalar(0.055 * Math.min(1, w * 5) * (w > 0.9 ? (1 - w) * 10 : 1))));
      }
    });
    pelMesh.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < indicators.length; i++) indMesh.setColorAt(i, Math.sin(t * (2.2 + (i % 3) * 1.3) + i * 1.7) > -0.2 ? indBase[i] : off);
    indMesh.instanceColor.needsUpdate = true;
    glowGreen.emissiveIntensity = 3.6 + Math.sin(t * 2.4) * 0.9;
    ribbonMat.userData.glow.uGlowStr.value = 0.95 + Math.sin(t * 0.8) * 0.08;
    caLiquid.scale.y = 1.25 + Math.sin(t * 0.4) * 0.1;
    caLiquidMat.emissiveIntensity = 1.8 + Math.sin(t * 1.7) * 0.25;
    needle.rotation.z = -0.4 + Math.sin(t * 0.4) * 0.35 + Math.sin(t * 7.3) * 0.02;
    const top = 0.56 + caLiquid.scale.y;
    bubBase.forEach((b, i) => {
      const k = (t * 0.25 + b.ph) % 1;
      bubMesh.setMatrixAt(i, trs(b.x + Math.sin(t * 3 + i) * 0.03, 0.6 + k * (top - 0.65), b.z, 0, 0, 0, b.s * (1 - k * 0.5)));
    });
    bubMesh.instanceMatrix.needsUpdate = true;
  };
  void fbm2;
  return g;
}
