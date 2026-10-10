// Mitochondria: two elongated copper "power plants" with fire burning deep in their folds.
// Tall copper outer shell (metallic, worn, panel seams, dark base -> bright lip, glow strip under the
// lip, louvred heat vents), a glowing intermembrane channel with proton chevrons streaming around it,
// and 12-14 irregular cristae (thin hairpins + fat U-loops) rising from near-black pits whose crests
// glow peach. White-hot pools and furnace columns with rising light shafts sit in the bays.
// ATP synthase (rotor head + stator arm) studs the fin tops; spinning turbine crowns cap every crista
// and throw spark fountains. Short pier + viewing platform, stair, rails, conduits, hatches, Krebs
// reactor cores. ATP tokens rise from the crowns and drift to the roads.
// Curiosity: a violet circular mtDNA ring in a glass display cradle inside plant A.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { MITO } from '../layout.js';
import * as M from '../../core/materials.js';
import * as T from '../../core/textures.js';
import { sweepXZ, superellipse, offsetContour, mergeGeometries, place, trs } from '../../core/geom.js';
import { mulberry32 } from '../../core/noise.js';
import { organic } from '../../core/lookdev.js';

const SE_N = 2.55;          // pod outline exponent (between ellipse and stadium)
const WALL_H = 2.1;         // outer membrane (shell) height
const WALL_HALF = 0.22;     // half thickness of the shell body
const LIP_HW = 0.26;        // lip bead half width
const LIP_HH = 0.13;        // lip bead half height
const GAP = 0.42;           // intermembrane space (visible channel)
const IN_T = 0.14;          // inner membrane thickness
const IN_H = 1.45;          // inner boundary membrane height
const CR_H = 1.2;           // cristae height
const DECK_Y = 1.9;         // catwalk deck height (above the crowns)
const LIP_IN = WALL_HALF + LIP_HW;                 // outline -> inner edge of the lip
const IN_OFF = LIP_IN + GAP + IN_T / 2;            // outline -> inner membrane centreline
const IMS_Y = 1.0;          // raised glowing intermembrane (proton) channel
const CROWN_S = 1.6;        // turbine crown scale
const SPARK_N = 16, SPARK_CYCLE = 1.3, SPARK_LIFE = 0.85;

// ---------------------------------------------------------------- helpers
function norm(g) {
  let geo = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) geo.deleteAttribute(k);
  if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
  if (!geo.attributes.normal) geo.computeVertexNormals();
  return geo;
}
function resampleClosed(pts, step) {
  const n = pts.length, L = [0];
  for (let i = 1; i <= n; i++) { const a = pts[i - 1], b = pts[i % n]; L.push(L[i - 1] + Math.hypot(b.x - a.x, b.z - a.z)); }
  const total = L[n], count = Math.max(8, Math.round(total / step)), out = [];
  let j = 0;
  for (let k = 0; k < count; k++) {
    const s = (k / count) * total;
    while (L[j + 1] < s) j++;
    const a = pts[j], b = pts[(j + 1) % n], f = (s - L[j]) / Math.max(1e-6, L[j + 1] - L[j]);
    const p = { x: a.x + (b.x - a.x) * f, z: a.z + (b.z - a.z) * f };
    if (a.d !== undefined) p.d = a.d + ((b.d ?? 0) - a.d) * f;
    out.push(p);
  }
  return out;
}
function smoothClosed(pts, passes, w = 0.5) {
  let p = pts;
  for (let k = 0; k < passes; k++) {
    const n = p.length;
    p = p.map((q, i) => {
      const a = p[(i - 1 + n) % n], b = p[(i + 1) % n];
      return { x: q.x * (1 - w) + (a.x + b.x) * 0.5 * w, z: q.z * (1 - w) + (a.z + b.z) * 0.5 * w, d: q.d };
    });
  }
  return p;
}
const leftNormal = (pts, i) => {
  const n = pts.length, a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
  const tx = b.x - a.x, tz = b.z - a.z, l = Math.hypot(tx, tz) || 1;
  return { x: -tz / l, z: tx / l };
};
const smooth01 = (e0, e1, x) => { const t = THREE.MathUtils.clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };

/** Flat floor from a closed contour (normals up). */
function floorGeo(pts, y, uvFn) {
  const tris = THREE.ShapeUtils.triangulateShape(pts.map((p) => new THREE.Vector2(p.x, p.z)), []);
  const pos = [], uv = [], nrm = [];
  for (const [i0, i1, i2] of tris) {
    let a = pts[i0], b = pts[i1], c = pts[i2];
    if ((b.z - a.z) * (c.x - a.x) - (b.x - a.x) * (c.z - a.z) < 0) [b, c] = [c, b];
    for (const p of [a, b, c]) { pos.push(p.x, y, p.z); nrm.push(0, 1, 0); const [u, v] = uvFn(p.x, p.z); uv.push(u, v); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}
/** Flat ring strip between two contours (matching sample counts), u = arc length / uLen, v = 0 inner -> 1 outer. */
function ringGeo(inner, outer, y, { skirt = 0, uLen = 4, alpha = null } = {}) {
  const n = inner.length, pos = [], uv = [], col = [];
  const A0 = inner[0], B0 = inner[1], D0 = outer[0];
  // winding so the top faces +Y
  const up = ((D0.z - A0.z) * (B0.x - A0.x) - (D0.x - A0.x) * (B0.z - A0.z)) > 0;
  let s = 0;
  const vert = (p, yy, u, v, a) => { pos.push(p.x, yy, p.z); uv.push(u, v); if (alpha) col.push(0, 0, 0, a); };
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, ds = Math.hypot(inner[j].x - inner[i].x, inner[j].z - inner[i].z);
    const u0 = s / uLen, u1 = (s + ds) / uLen; s += ds;
    const q = [[inner[i], u0, 0, alpha?.[0]], [outer[i], u0, 1, alpha?.[1]], [outer[j], u1, 1, alpha?.[1]], [inner[j], u1, 0, alpha?.[0]]];
    const order = up ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
    for (const k of order) vert(q[k][0], y, q[k][1], q[k][2], q[k][3]);
    if (skirt) {
      const sk = [[outer[i], y], [outer[i], y - skirt], [outer[j], y - skirt], [outer[j], y]];
      const o2 = up ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
      for (const k of o2) vert(sk[k][0], sk[k][1], 0, 0, 0);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  if (alpha) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
  g.computeVertexNormals();
  return g;
}
function tubeAlong(pts, y, r, closed = true, seg = 6) {
  const v = pts.map((p) => new THREE.Vector3(p.x, p.y ?? y, p.z));
  const curve = new THREE.CatmullRomCurve3(v, closed, 'catmullrom', 0.2);
  return new THREE.TubeGeometry(curve, Math.max(8, Math.round(pts.length * 1.2)), r, seg, closed);
}
function cylBetween(a, b, r, seg = 6) {
  const d = new THREE.Vector3().subVectors(b, a), len = d.length();
  const g = new THREE.CylinderGeometry(r, r, len, seg, 1);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  g.applyMatrix4(new THREE.Matrix4().compose(a.clone().lerp(b, 0.5), q, new THREE.Vector3(1, 1, 1)));
  return g;
}
function ladderGeo(h, w = 0.36, rung = 0.24) {
  const parts = [];
  for (const s of [-1, 1]) parts.push(place(new THREE.CylinderGeometry(0.022, 0.022, h + 0.25, 6), s * w / 2, (h + 0.25) / 2, 0));
  for (let y = rung; y < h; y += rung) parts.push(place(new THREE.CylinderGeometry(0.014, 0.014, w, 5), 0, y, 0, 0, 0, Math.PI / 2));
  return mergeGeometries(parts.map(norm));
}


/**
 * Height-ramp patch: albedo follows a colour ramp over world Y (exact per pixel, no extra vertices);
 * optional emissive mask so only crests (y >= e0) glow. Applied before organic() so both chain.
 */
function yRamp(mat, stops, emissive = null) {
  const c = stops.map(([y, hex]) => [y, new THREE.Color(hex)]);
  const v3 = (col) => `vec3(${col.r.toFixed(4)}, ${col.g.toFixed(4)}, ${col.b.toFixed(4)})`;
  let body = `vec3 c = ${v3(c[0][1])};\n`;
  for (let k = 1; k < c.length; k++) body += `c = mix(c, ${v3(c[k][1])}, smoothstep(${c[k - 1][0].toFixed(3)}, ${c[k][0].toFixed(3)}, y));\n`;
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    prev?.(sh, r);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vMY;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMY = (modelMatrix * vec4(transformed, 1.0)).y;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying float vMY;\nvec3 mitoRamp(float y) {\n${body}return c;\n}`)
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= mitoRamp(vMY);')
      .replace('#include <emissivemap_fragment>', emissive ? `#include <emissivemap_fragment>\ntotalEmissiveRadiance *= smoothstep(${emissive[0].toFixed(3)}, ${emissive[1].toFixed(3)}, vMY);` : '#include <emissivemap_fragment>');
  };
  return mat;
}

// ---------------------------------------------------------------- procedural textures
function canvasTex(w, h, draw, { repeat = [1, 1], srgb = true } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); t.anisotropy = 8;
  return t;
}
const hazardTex = () => canvasTex(256, 64, (x, w, h) => {
  x.fillStyle = '#1c1a18'; x.fillRect(0, 0, w, h);
  x.fillStyle = '#ffc21a';
  for (let i = -2; i < 10; i++) { x.beginPath(); x.moveTo(i * 32, h); x.lineTo(i * 32 + 16, h); x.lineTo(i * 32 + 16 + h, 0); x.lineTo(i * 32 + h, 0); x.fill(); }
  x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(0, 0, w, 3); x.fillRect(0, h - 3, w, 3);
});
const gratingTex = () => canvasTex(128, 128, (x, w, h) => {
  x.fillStyle = '#26282d'; x.fillRect(0, 0, w, h);
  x.fillStyle = '#6d727c';
  for (let i = 0; i < 8; i++) x.fillRect(i * 16, 0, 4, h);
  x.fillStyle = '#4a4e57';
  for (let j = 0; j < 4; j++) x.fillRect(0, j * 32, w, 3);
});
/** Shell panels: horizontal seams ~every 0.35u of height on both faces, vertical seams every 2u, rivets. */
const shellTex = (profLen) => canvasTex(256, 1024, (x, w, h) => {
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, h);
  const rowsY = [];
  for (let k = 1; k <= 5; k++) { const v = (k * 0.35) / profLen; rowsY.push(v, 1 - v); }
  // alternating panel tone
  const bands = [0, ...rowsY.filter((v) => v < 0.5).sort((a, b) => a - b), 0.5];
  bands.forEach((v0, i) => {
    if (i === bands.length - 1) return;
    const v1 = bands[i + 1], tone = i % 2 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0)';
    for (const [a, b] of [[v0, v1], [1 - v1, 1 - v0]]) { x.fillStyle = tone; x.fillRect(0, (1 - b) * h, w, (b - a) * h); }
  });
  x.fillStyle = 'rgba(40,12,4,0.95)';
  for (const v of rowsY) x.fillRect(0, (1 - v) * h - 3, w, 6);
  for (const u of [0]) { // vertical seams every 4u on the faces only (not across the lip)
    for (const [a, b] of [[0, 0.4], [0.6, 1]]) x.fillRect(u * w - 2.5, (1 - b) * h, 5, (b - a) * h);
  }
  // grime creeping up from the base on both faces + drips under rivets
  for (const [v0, dir] of [[0, 1], [1, -1]]) {
    const gg = x.createLinearGradient(0, (1 - v0) * h, 0, (1 - v0 - dir * 0.12) * h);
    gg.addColorStop(0, 'rgba(30,10,4,0.55)'); gg.addColorStop(1, 'rgba(30,10,4,0)');
    x.fillStyle = gg; x.fillRect(0, Math.min((1 - v0) * h, (1 - v0 - dir * 0.12) * h), w, 0.12 * h);
  }
  const rr = mulberry32(17);
  for (let k = 0; k < 60; k++) { x.fillStyle = `rgba(40,14,4,${0.08 + rr() * 0.12})`; x.fillRect(rr() * w, rr() * h, 1 + rr() * 2, 10 + rr() * 50); }
  x.fillStyle = 'rgba(255,225,190,0.9)';
  for (const uu of [10, w - 10]) for (const [a, b] of [[0.02, 0.4], [0.6, 0.98]]) for (let v = a; v < b; v += 0.03) { x.beginPath(); x.arc(uu, (1 - v) * h, 2.2, 0, Math.PI * 2); x.fill(); }
  for (const v of rowsY) for (let u = 0.0625; u < 1; u += 0.125) { x.beginPath(); x.arc(u * w, (1 - v) * h + 5, 1.8, 0, Math.PI * 2); x.fill(); }
});
/** Proton chevrons streaming around the intermembrane channel. */
const chevronTex = () => canvasTex(512, 64, (x, w, h) => {
  x.fillStyle = '#120200'; x.fillRect(0, 0, w, h);
  for (let k = 0; k < 4; k++) {
    const x0 = k * 128 + 20;
    const gg = x.createLinearGradient(x0, 0, x0 + 70, 0); gg.addColorStop(0, '#ff6a18'); gg.addColorStop(1, '#fff6d8');
    x.fillStyle = gg;
    x.beginPath(); x.moveTo(x0, 4); x.lineTo(x0 + 44, h / 2); x.lineTo(x0, h - 4); x.lineTo(x0 + 26, h - 4); x.lineTo(x0 + 70, h / 2); x.lineTo(x0 + 26, 4); x.closePath(); x.fill();
  }
});
/** Matrix floor atlas: near-black red-brown matrix with fine grain; faint warmth only around the reactors. */
function matrixFloorTex(plants) {
  const W = 1024, H = 1024, half = H / plants.length;
  return canvasTex(W, H, (x) => {
    plants.forEach((P, i) => {
      const y0 = i * half;
      const cx = (u) => ((u / P.a + 1) / 2) * W;
      const cy = (z) => y0 + (1 - (z / P.b + 1) / 2) * half;
      const sx = W / (2 * P.a);
      x.save(); x.beginPath(); x.rect(0, y0, W, half); x.clip();
      x.save(); x.translate(W / 2, y0 + half / 2); x.scale(1, (half / W) * 1.9);
      const g = x.createRadialGradient(0, 0, 0, 0, 0, W * 0.52);
      g.addColorStop(0, '#3e1407'); g.addColorStop(0.7, '#2c0d04'); g.addColorStop(1, '#170602');
      x.fillStyle = g; x.fillRect(-W, -H, W * 2, H * 2); x.restore();
      x.globalCompositeOperation = 'lighter';
      for (const c of P.cores) {
        const gg = x.createRadialGradient(cx(c.x), cy(c.z), 0, cx(c.x), cy(c.z), 1.1 * sx);
        gg.addColorStop(0, 'rgba(160,70,20,0.6)'); gg.addColorStop(1, 'rgba(120,40,10,0)');
        x.fillStyle = gg; x.fillRect(cx(c.x) - 1.1 * sx, cy(c.z) - 1.1 * sx, 2.2 * sx, 2.2 * sx);
      }
      x.globalCompositeOperation = 'source-over';
      x.restore();
    });
    // fine grain (1px noise), no blobs
    const img = x.getImageData(0, 0, W, H), d = img.data, r = mulberry32(5);
    for (let k = 0; k < d.length; k += 4) { const n = (r() - 0.5) * 18; d[k] += n; d[k + 1] += n * 0.5; d[k + 2] += n * 0.3; }
    x.putImageData(img, 0, 0);
  });
}
/** Tileable caustic net (Voronoi F2-F1 edges) for the matrix fluid. */
function causticTex() {
  const S = 256, r = mulberry32(911), P = [];
  for (let k = 0; k < 14; k++) P.push([r() * S, r() * S]);
  const c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d'), img = x.createImageData(S, S);
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    let f1 = 1e9, f2 = 1e9;
    for (const [px, py] of P) for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      const d = Math.hypot(i - px - ox * S, j - py - oy * S);
      if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
    }
    const v = Math.max(0, 1 - (f2 - f1) / 9);
    const k = (j * S + i) * 4; img.data[k] = img.data[k + 1] = img.data[k + 2] = 255 * v * v; img.data[k + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(9, 9); t.colorSpace = THREE.NoColorSpace; t.anisotropy = 8;
  return t;
}
const floorT = { value: 0 };
/** Additive hot-pool decal: white-hot core -> orange -> transparent. */
const poolTex = () => canvasTex(128, 128, (x, w, h) => {
  const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  g.addColorStop(0, 'rgba(255,240,192,1)'); g.addColorStop(0.22, 'rgba(255,200,110,1)'); g.addColorStop(0.5, 'rgba(255,106,16,0.75)'); g.addColorStop(1, 'rgba(120,20,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
}, { repeat: [1, 1] });
/** Light shaft: static alpha (bright base, long fade upward, soft sides) + scrolling streak colour. */
const shaftAlphaTex = () => canvasTex(64, 256, (x, w, h) => {
  const img = x.createImageData(w, h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const u = i / (w - 1) * 2 - 1, v = 1 - j / (h - 1);
    const a = Math.pow(Math.max(0, 1 - u * u), 1.6) * Math.pow(1 - v, 1.3) * (1 - Math.exp(-v * 40));
    const k = (j * w + i) * 4; img.data[k] = img.data[k + 1] = img.data[k + 2] = 255 * a; img.data[k + 3] = 255;
  }
  x.putImageData(img, 0, 0);
}, { srgb: false });
const shaftStreakTex = () => {
  const t = canvasTex(64, 128, (x, w, h) => {
    const r = mulberry32(77);
    x.fillStyle = 'rgb(225,205,185)'; x.fillRect(0, 0, w, h);
    for (let k = 0; k < 40; k++) { const px = r() * w, c = 180 + r() * 75; const g = x.createLinearGradient(0, 0, 0, h); const y0 = r(); g.addColorStop(0, `rgba(${c},${c},${c},0)`); g.addColorStop(y0, `rgba(${c},${c},${c},0.8)`); g.addColorStop(1, `rgba(${c},${c},${c},0)`); x.fillStyle = g; x.fillRect(px, 0, 2 + r() * 5, h); }
  });
  t.repeat.set(1, 1.5);
  return t;
};
/** Shell wear roughness: vertical streaks + grime band near the base (u along wall, v over profile). */
const wearRoughTex = () => canvasTex(256, 256, (x, w, h) => {
  const r = mulberry32(31);
  x.fillStyle = '#595959'; x.fillRect(0, 0, w, h);
  for (let k = 0; k < 140; k++) { const px = r() * w, len = 20 + r() * 120, c = 60 + r() * 90; x.fillStyle = `rgba(${c},${c},${c},0.35)`; x.fillRect(px, r() * h, 1 + r() * 3, len); }
  for (let k = 0; k < 400; k++) { const c = 40 + r() * 120; x.fillStyle = `rgba(${c},${c},${c},0.4)`; x.beginPath(); x.arc(r() * w, r() * h, 0.5 + r() * 2, 0, 7); x.fill(); }
}, { srgb: false, repeat: [1, 1] });

// ---------------------------------------------------------------- ATP synthase head geometry
/** F1 head: one smooth sphere displaced into 6 alternating α/β lobes, cap, γ stalk. Spins about +Y. */
function rotorGeo() {
  const tint = (g, hex) => { const cc = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = cc.r; a[i * 3 + 1] = cc.g; a[i * 3 + 2] = cc.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
  // egg-shaped lobe (alpha/beta subunit) as a lathe
  const pts = [];
  for (let k = 0; k <= 10; k++) { const t = k / 10; pts.push(new THREE.Vector2(0.056 * Math.pow(Math.sin(Math.PI * t), 0.85) * (1 - 0.18 * t), -0.075 + 0.16 * t)); }
  const parts = [];
  for (let k = 0; k < 6; k++) {
    const an = (k / 6) * Math.PI * 2;
    const lobe = new THREE.LatheGeometry(pts, 14);
    lobe.rotateZ(0.16); // lean inward at the top
    lobe.rotateY(-an); lobe.translate(Math.cos(an) * 0.072, 0.215, Math.sin(an) * 0.072);
    parts.push(norm(tint(lobe, k % 2 ? 0xffe2a0 : 0xd98a24)));
  }
  parts.push(norm(tint(new THREE.SphereGeometry(0.036, 24, 10).translate(0, 0.33, 0), 0xfff0c8)));      // delta cap
  parts.push(norm(tint(new THREE.CylinderGeometry(0.022, 0.03, 0.13, 24, 1, true).translate(0, 0.065, 0), 0xb06a18))); // gamma stalk
  parts.push(norm(tint(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 24).translate(0, 0.135, 0), 0x8a4a12)));        // collar under the head
  return mergeGeometries(parts);
}

// ---------------------------------------------------------------- one plant
function planPlant(P, index) {
  const a = P.len / 2, b = P.wid / 2;
  const rnd = mulberry32(777 + index * 31);
  const S = resampleClosed(superellipse(a, b, SE_N, 400), 0.11);
  const wallC = offsetContour(S, -WALL_HALF);
  const inner = offsetContour(S, -IN_OFF);
  const floorC = offsetContour(S, -(IN_OFF - 0.04));
  const ai = a - IN_OFF, bi = b - IN_OFF;
  const halfZ = (x) => bi * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(x / ai), SE_N)), 1 / SE_N);

  // cristae plan: 12-14 interleaved folds alternating from the +z and -z side, each with its own
  // width (thin hairpins vs fat U-loops with an open intracristal lumen), length, meander amplitude
  // and phase. Three wider gaps form furnace bays.
  const limit = ai - 1.75;
  const N = THREE.MathUtils.clamp(Math.round((2 * limit) / 1.2) + 1, 12, 14);
  const widths = [], gaps = [];
  for (let j = 0; j < N; j++) widths.push(j % 3 === 1 ? 0.78 + rnd() * 0.22 : 0.32 + rnd() * 0.14);
  for (let j = 0; j < N - 1; j++) gaps.push(0.42 + rnd() * 0.3);
  const bayIdx = [Math.round((N - 2) * 0.2), Math.round((N - 2) * 0.52), Math.round((N - 2) * 0.82)];
  for (const k of bayIdx) gaps[k] += 0.75;
  const total = widths.reduce((u, v) => u + v, 0) + gaps.reduce((u, v) => u + v, 0);
  const gs = (2 * limit - widths.reduce((u, v) => u + v, 0)) / (total - widths.reduce((u, v) => u + v, 0));
  for (let k = 0; k < gaps.length; k++) gaps[k] *= gs;
  const span = 2 * limit;
  const folds = [];
  let xcur = -limit;
  for (let j = 0; j < N; j++) {
    const fw = widths[j], xc = xcur + fw / 2; xcur += fw + (gaps[j] ?? 0);
    const s = j % 2 ? -1 : 1, zc = halfZ(xc);
    const frac = j % 2 === Math.floor(j / 2) % 2 ? 0.66 + rnd() * 0.12 : 0.5 + rnd() * 0.1; // alternate long/short
    const amp = 0.06 + rnd() * 0.1, ph = rnd() * Math.PI * 2, fq = 2.2 + rnd() * 1.4;
    folds.push({ xc, s, zc, fw, zTip: s * (zc - frac * 2 * zc), wig: (z, dd) => amp * Math.sin(z * fq + ph) * smooth01(0, 0.35, dd) });
  }
  const path = [];
  const n = inner.length;
  const done = new Set();
  for (let i = 0; i < n; i++) {
    const p = inner[i], q = inner[(i - 1 + n) % n];
    let f = null;
    for (const F of folds) {
      if (done.has(F)) continue;
      const A = F.xc + F.s * F.fw / 2;
      if (Math.sign(p.z) !== F.s) continue;
      if ((F.s > 0 && q.x > A && p.x <= A) || (F.s < 0 && q.x < A && p.x >= A)) { f = F; break; }
    }
    if (!f) { path.push({ x: p.x, z: p.z, d: 0 }); continue; }
    done.add(f);
    const A = f.xc + f.s * f.fw / 2, B = f.xc - f.s * f.fw / 2, wig = f.wig;
    let j = i;
    while (j < i + n && !((f.s > 0 && inner[j % n].x <= B) || (f.s < 0 && inner[j % n].x >= B))) j++;
    const zA = p.z, zB = inner[j % n].z, zT = f.zTip;
    const K = 40;
    for (let k = 0; k <= K; k++) { const z = zA + (zT - zA) * (k / K), dd = Math.abs(z - zA); path.push({ x: A + wig(z, dd), z, d: dd }); }
    const r = f.fw / 2, th0 = f.s > 0 ? 0 : Math.PI, capN = Math.max(10, Math.round(r * 30));
    f.tip = { x: f.xc + wig(zT, 9), z: zT };
    for (let k = 1; k < capN; k++) { const th = th0 - Math.PI * (k / capN); path.push({ x: f.tip.x + Math.cos(th) * r, z: zT + Math.sin(th) * r, d: Math.abs(zT - zA) + 0.05 }); }
    for (let k = 0; k <= K; k++) { const z = zT + (zB - zT) * (k / K), dd = Math.abs(z - zB); path.push({ x: B + wig(z, dd), z, d: dd }); }
    i = j % n === j ? j : n;
    path.push({ x: inner[j % n].x, z: inner[j % n].z, d: 0 });
  }
  const mem = smoothClosed(resampleClosed(path, 0.1), 4, 0.5);
  const corridors = [];
  for (let k = 0; k < folds.length - 1; k++) {
    const L = folds[k], R = folds[k + 1];
    corridors.push({ x: (L.xc + L.fw / 2 + R.xc - R.fw / 2) / 2, w: R.xc - R.fw / 2 - (L.xc + L.fw / 2), L, R, bay: bayIdx.includes(k) });
  }
  const wig = (z, dd) => 0; // legacy (corridor meander handled per fold)
  const coreX = (limit + ai) / 2 + 0.1;
  const cores = [{ x: -coreX, z: 0 }, { x: coreX, z: 0 }];
  // where a corridor point sits: between the two folds' leaves at height z
  const corrX = (c, z) => (c.L.xc + c.L.fw / 2 + c.L.wig(z, 9) + c.R.xc - c.R.fw / 2 + c.R.wig(z, 9)) / 2;
  // white-hot pools: one deep in every bay + two more in random normal corridors (open end of the corridor)
  const hots = [];
  corridors.forEach((c) => { if (c.bay) { const z = -c.L.s * 0.25 * bi; hots.push({ x: corrX(c, z), z, r: 0.5, shaft: true }); } });
  const normal = corridors.filter((c) => !c.bay && c.w > 0.45);
  for (let k = 0; k < 3; k++) {
    const c = normal[Math.floor(rnd() * normal.length)];
    if (hots.some((h) => Math.abs(h.x - c.x) < 0.5)) continue;
    const z = (rnd() < 0.5 ? 1 : -1) * (0.15 + rnd() * 0.35) * bi;
    hots.push({ x: corrX(c, z), z, r: Math.min(0.32, c.w * 0.5), shaft: false });
  }
  const vents = [];
  return { P, a, b, S, wallC, inner, floorC, ai, bi, halfZ, folds, mem, corridors, cores, vents, hots, wig, corrX, span, limit, rnd };
}

export function buildMitochondria() {
  const g = new THREE.Group(); g.name = 'mitochondria';
  const plans = MITO.map(planPlant);
  const W2L = MITO.map((P) => new THREE.Matrix4().compose(new THREE.Vector3(P.x, 0, P.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), P.rot), new THREE.Vector3(1, 1, 1)));

  // ---------- outer shell profile (u > 0 = inward), relative to the wall centreline
  const H = WALL_H, lc = H - LIP_HH;
  const prof = [[WALL_HALF - 0.02, 0], [WALL_HALF - 0.02, lc - 0.16], [WALL_HALF + 0.01, lc - 0.08], [LIP_HW - 0.02, lc - 0.03]];
  for (let k = 0; k <= 10; k++) { const th = (k / 10) * Math.PI; prof.push([Math.cos(th) * LIP_HW, lc + Math.sin(th) * LIP_HH]); }
  prof.push([-(LIP_HW - 0.02), lc - 0.03], [-(WALL_HALF + 0.01), lc - 0.08], [-WALL_HALF, lc - 0.16], [-WALL_HALF, 0.34], [-(WALL_HALF + 0.05), 0.2], [-(WALL_HALF + 0.07), 0.08], [-(WALL_HALF + 0.07), 0]);
  let profLen = 0; for (let k = 1; k < prof.length; k++) profLen += Math.hypot(prof[k][0] - prof[k - 1][0], prof[k][1] - prof[k - 1][1]);

  // ---------- materials
  const shellMap = shellTex(profLen);
  const wallMat = organic(yRamp(new THREE.MeshPhysicalMaterial({
    color: 0xffffff, map: shellMap, metalness: 0.75, roughness: 1.0, roughnessMap: wearRoughTex(), clearcoat: 0.1, clearcoatRoughness: 0.4,
    normalMap: T.paintNormal(), normalScale: new THREE.Vector2(0.06, 0.06), envMapIntensity: 1.0,
  }), [[0, 0x62230a], [0.6, 0x9d4015], [1.3, 0xf07a30], [WALL_H - 0.22, 0xffa452], [WALL_H, 0xffbe84]]),
  { rim: 0xffb070, rimPower: 5.0, rimStrength: 0.12, sss: 0xd04a10, sssStrength: 0.12 });
  wallMat.customProgramCacheKey = () => 'mitoShell';
  // shelf profile: thin flank (IN_T), chamfer out to a flat cap 1.6x wider, 0.03 bevel. Corner points are
  // duplicated so the shading breaks crisply at the cap edges.
  const ct = IN_T / 2, cw2 = IN_T * 0.8, bv = 0.03, Ht = IN_H;
  const memProf = [[0.1, 0], [ct, 0.06], [ct, Ht - 0.13], [ct, Ht - 0.13], [cw2, Ht - 0.07], [cw2, Ht - 0.07], [cw2, Ht - bv], [cw2, Ht - bv], [cw2 - bv, Ht], [cw2 - bv, Ht],
    [-(cw2 - bv), Ht], [-(cw2 - bv), Ht], [-cw2, Ht - bv], [-cw2, Ht - bv], [-cw2, Ht - 0.07], [-cw2, Ht - 0.07], [-ct, Ht - 0.13], [-ct, Ht - 0.13], [-ct, 0.06], [-0.1, 0]];
  const PLm = [0]; for (let k = 1; k < memProf.length; k++) PLm.push(PLm[k - 1] + Math.hypot(memProf[k][0] - memProf[k - 1][0], memProf[k][1] - memProf[k - 1][1]));
  const capV0 = PLm[8] / PLm[PLm.length - 1], capV1 = PLm[11] / PLm[PLm.length - 1];
  const capMask = canvasTex(4, 512, (x, w, h) => {
    x.fillStyle = '#000'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#fff'; x.fillRect(0, (1 - capV1) * h - 1, w, (capV1 - capV0) * h + 2);
  }, { srgb: false });
  capMask.wrapT = THREE.ClampToEdgeWrapping;
  const ribTex = canvasTex(32, 4, (x, w, h) => {
    const img = x.createImageData(w, h);
    for (let i = 0; i < w; i++) { const nx = Math.sin((i / w) * Math.PI * 2) * 0.45; for (let j = 0; j < h; j++) { const k = (j * w + i) * 4; img.data[k] = (nx * 0.5 + 0.5) * 255; img.data[k + 1] = 128; img.data[k + 2] = 255; img.data[k + 3] = 255; } }
    x.putImageData(img, 0, 0);
  }, { srgb: false, repeat: [0.5 / 0.15, 1] });
  const memMat = organic(new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0.6, emissive: 0xffa060, emissiveIntensity: 1.0, emissiveMap: capMask,
    normalMap: ribTex, normalScale: new THREE.Vector2(0.6, 0.6),
  }), { rim: 0xff9a60, rimPower: 3.5, rimStrength: 0.06, sss: 0x7a2a10, sssStrength: 0.03, wrap: 0.1 });
  {
    const prev = memMat.onBeforeCompile;
    memMat.onBeforeCompile = (sh, r) => {
      prev?.(sh, r);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vMY;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMY = (modelMatrix * vec4(transformed, 1.0)).y;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vMY;')
        .replace('#include <color_fragment>', `#include <color_fragment>
          float capM = texture2D(emissiveMap, vEmissiveMapUv).g;
          vec3 flank = mix(vec3(0.010, 0.002, 0.001), vec3(0.06, 0.012, 0.004), smoothstep(0.0, 0.55, vMY));
          flank = mix(flank, vec3(0.195, 0.024, 0.005), smoothstep(0.45, 0.95, vMY));   // #7a2a10 (linear)
          diffuseColor.rgb *= mix(flank, vec3(1.0, 0.62, 0.30), capM);`)
        .replace('#include <normal_fragment_maps>', 'vec3 nCap = normal;\n#include <normal_fragment_maps>\nnormal = normalize(mix(normal, nCap, capM));');
    };
  }
  memMat.customProgramCacheKey = () => 'mitoMem';
  const floorTex = matrixFloorTex(plans.map((p) => ({ a: p.a, b: p.b, cores: p.cores, vents: p.vents })));
  const caustic = causticTex();
  const floorMat = new THREE.MeshPhysicalMaterial({ map: floorTex, emissiveMap: caustic, emissive: 0xff7a2a, emissiveIntensity: 0.35, roughness: 0.18, metalness: 0.0, clearcoat: 1.0, clearcoatRoughness: 0.06, envMapIntensity: 0.5 });
  // second caustic layer (different scale / direction) blended in the shader for a non-repeating shimmer
  floorMat.onBeforeCompile = (sh) => {
    sh.uniforms.uT = floorT;
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uT;')
      .replace('#include <emissivemap_fragment>', `
        vec2 cuv = vEmissiveMapUv;
        float c1 = texture2D(emissiveMap, cuv + vec2(uT * 0.011, uT * 0.007)).g;
        float c2 = texture2D(emissiveMap, cuv * 1.37 + vec2(-uT * 0.009, uT * 0.013)).g;
        totalEmissiveRadiance *= pow(min(c1, c2) * 1.6, 2.0);`);
  };
  floorMat.customProgramCacheKey = () => 'mitoFluid';
  const poolMat = new THREE.MeshBasicMaterial({ map: poolTex(), color: new THREE.Color(2.4, 1.9, 1.4), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  const shaftMat = new THREE.MeshBasicMaterial({ map: shaftStreakTex(), alphaMap: shaftAlphaTex(), color: new THREE.Color(1.5, 0.7, 0.24), transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const ventMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xff7a22, emissiveIntensity: 3.0, roughness: 0.4 });
  const coreMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffd28a, emissiveIntensity: 2.0, roughness: 0.4 });
  const stripMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xff8a30, emissiveIntensity: 2.6, roughness: 0.4 });
  const chev = chevronTex();
  const imsMat = new THREE.MeshStandardMaterial({ color: 0x100200, emissive: 0xffffff, emissiveMap: chev, emissiveIntensity: 4.2, roughness: 0.3 });
  const apronMat = M.satin(0x50545c, { rough: 0.7, clearcoat: 0.05, key: "mitoApron2" }); apronMat.side = THREE.DoubleSide;
  const shadowMat = new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const goldMat = new THREE.MeshPhysicalMaterial({ color: 0xd9983a, metalness: 0.88, roughness: 0.85, clearcoat: 0.0, roughnessMap: T.brushedRoughness(), envMapIntensity: 0.6 });
  const steelMat = M.metal(0xc6ccd4, 0.32);
  const darkSteelMat = new THREE.MeshStandardMaterial({ color: 0x3a3d44, metalness: 0.7, roughness: 0.4, roughnessMap: T.brushedRoughness() });
  const copperMat = new THREE.MeshPhysicalMaterial({ color: 0xb8582e, metalness: 0.85, roughness: 0.32, clearcoat: 0.4, roughnessMap: T.brushedRoughness() });
  const deckMat = new THREE.MeshStandardMaterial({ map: gratingTex(), roughness: 0.5, metalness: 0.6, color: 0xb0b6c0 });
  deckMat.map.repeat.set(10, 1);
  const hazMat = new THREE.MeshStandardMaterial({ map: hazardTex(), roughness: 0.5 });
  const doorMat = M.satin(0x6a2a10, { rough: 0.42, clearcoat: 0.4, metal: 0.3, key: 'mitoDoor2' });
  const glowMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffb040, emissiveIntensity: 5, roughness: 0.4 });
  const ringGlowMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffa53a, emissiveIntensity: 4, roughness: 0.4 });
  const rotorMat = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, metalness: 0.7, roughness: 0.55, emissive: 0x5a2800, emissiveIntensity: 0.25, envMapIntensity: 0.45 });
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xffe9c8, roughness: 0.05, transparent: true, opacity: 0.25, clearcoat: 1, depthWrite: false });

  const B = { pool: [], shaft: [], core: [], strip: [], vent: [], hot: [], wall: [], mem: [], floor: [], ims: [], apron: [], shadow: [], gold: [], steel: [], dark: [], copper: [], deck: [], haz: [], door: [], glow: [], glass: [], screen: [] };
  const add = (k, geo, m) => { const gg = norm(geo); if (m) gg.applyMatrix4(m); B[k].push(gg); };
  const hotWorld = [], rotors = [], f0Rings = [], bolts = [], crowns = [], anchors = {}, footprints = [], lights = [];
  const wp = (m, x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(m);
  const arr = (v) => [+v.x.toFixed(2), +v.y.toFixed(2), +v.z.toFixed(2)];
  const stalkBase = norm(new THREE.CylinderGeometry(0.1, 0.12, 0.035, 48));
  const socketGeo = norm(new THREE.CylinderGeometry(0.075, 0.08, 0.02, 24).translate(0, 0.008, 0));
  const knobGeo = norm(new THREE.SphereGeometry(0.048, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.75, 1).translate(0, 0.012, 0));
  // stator (peripheral stalk, b-subunit): stays still while the head spins
  const statorGeo = mergeGeometries([
    cylBetween(new THREE.Vector3(0.155, 0.02, 0), new THREE.Vector3(0.155, 0.3, 0), 0.014, 8),
    cylBetween(new THREE.Vector3(0.155, 0.3, 0), new THREE.Vector3(0.035, 0.352, 0), 0.012, 8),
    new THREE.SphereGeometry(0.02, 6, 4).translate(0.155, 0.3, 0),
    new THREE.BoxGeometry(0.06, 0.035, 0.05).translate(0.155, 0.03, 0),
  ].map(norm));

  plans.forEach((pl, idx) => {
    const MW = W2L[idx], { S, wallC, mem, folds, corridors, cores, vents, a, b, ai, bi } = pl;
    const tag = idx === 0 ? 'A' : 'B';

    // ---- outer shell: rigid copper, panel seams, dark base -> bright lip
    const wall = sweepXZ(wallC, prof, { closed: true, uvScale: [0.25, 1], flip: true });
    add('wall', wall, MW);

    // ---- inner membrane + dense cristae (one continuous folded sheet)
    const hs = mem.map((p) => (IN_H + (CR_H - IN_H) * smooth01(0.1, 0.6, p.d)) / IN_H);
    const memGeo = sweepXZ(mem, memProf, { closed: true, scale: (i) => ({ v: hs[i], vc: 0 }), uvScale: [0.5, 1], flip: true });
    // keep the cap the same thickness everywhere (only the flank scales with fold height)
    add('mem', memGeo, MW);

    // ---- floors: dark matrix, proton channel (raised, chevrons), apron, soft contact shadow
    const vOff = idx / plans.length, vS = 1 / plans.length;
    add('floor', floorGeo(pl.floorC, 0.03, (x, z) => [(x / a + 1) / 2, 1 - (vOff + (1 - (z / b + 1) / 2) * vS)]), MW);
    add('ims', ringGeo(offsetContour(S, -(IN_OFF - IN_T / 2 + 0.01)), offsetContour(S, -(WALL_HALF * 2 - 0.03)), IMS_Y, { uLen: 4 }), MW);
    add('apron', ringGeo(offsetContour(S, 0.05), offsetContour(S, 0.95), 0.07, { skirt: 0.07 }), MW);
    add('haz', ringGeo(offsetContour(S, 0.82), offsetContour(S, 0.95), 0.075), MW);
    add('shadow', ringGeo(offsetContour(S, 0.0), offsetContour(S, 1.9), 0.082, { alpha: [0.55, 0] }), MW);
    // warm glow strip tucked under the lip (outer face) advertises the heat inside
    add('strip', tubeAlong(offsetContour(S, 0.015).filter((_, i) => i % 2 === 0), H - 0.34, 0.028, true, 6), MW);

    // ---- ATP synthase heads: matrix side of the cristae (one face per corridor) + boundary wall
    const addSynth = (lx, ly, lz, nx, ny, nz, scale, speed, crown = false) => {
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(nx, ny, nz).normalize());
      const base = new THREE.Matrix4().compose(new THREE.Vector3(lx, ly, lz), q, new THREE.Vector3(scale, scale, scale));
      const wm = new THREE.Matrix4().multiplyMatrices(MW, base);
      rotors.push({ m: wm, speed, phase: pl.rnd() * 6, crown });
      f0Rings.push(wm.clone().multiply(trs(0, 0.025, 0)));
      add('gold', stalkBase.clone(), wm);
      add('copper', statorGeo.clone(), wm);
      return wm;
    };
    let acc = 0;
    for (let i = 0; i < mem.length; i++) {
      const p = mem[i], prev = mem[(i - 1 + mem.length) % mem.length];
      acc += Math.hypot(p.x - prev.x, p.z - prev.z);
      const nrm = leftNormal(mem, i);
      const inFold = p.d > 0.35, onWall = p.d < 0.02;
      if (inFold && nrm.x < 0.6) continue;          // only the +x facing leaf of each fold
      if (!inFold && !onWall) continue;
      if (acc < (inFold ? 2.6 : 2.8)) continue;
      if (folds.some((F) => Math.hypot(F.tip.x - p.x, F.tip.z - p.z) < 0.5)) continue;
      acc = 0;
      const off = IN_T / 2 + 0.005;
      const h = inFold ? CR_H - 0.3 - (Math.round(p.d / 1.3) % 2) * 0.12 : IN_H - 0.36;
      // flush ATP-synthase socket on the flank: dark ring + small gold knob
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(nrm.x, 0, nrm.z));
      const km = new THREE.Matrix4().multiplyMatrices(MW, new THREE.Matrix4().compose(new THREE.Vector3(p.x + nrm.x * (IN_T / 2 - 0.004), h, p.z + nrm.z * (IN_T / 2 - 0.004)), q, new THREE.Vector3(1, 1, 1)));
      add('dark', socketGeo.clone(), km); add('gold', knobGeo.clone(), km);
    }
    folds.forEach((F) => {
      const wm = addSynth(F.tip.x, CR_H - 0.02, F.tip.z, 0, 1, 0, CROWN_S, 2.4 + pl.rnd(), true);
      crowns.push({ m: wm, plant: idx, phase: pl.rnd() * SPARK_CYCLE, pos: wp(wm, 0, 0.36, 0) });
      F.crownWorld = wp(wm, 0, 0.21, 0);
    });

    // ---- Krebs reactor cores at both ends + hot floor vents
    cores.forEach((c) => {
      add('core', place(new THREE.CylinderGeometry(0.15, 0.15, 1.0, 48), c.x, 0.62, c.z), MW);
      add('core', place(new THREE.SphereGeometry(0.18, 24, 12), c.x, 0.62, c.z, 0, 0, 0, 1, 2.6, 1), MW);
      add('gold', place(new THREE.CylinderGeometry(0.4, 0.46, 0.16, 64), c.x, 0.11, c.z), MW);
      add('gold', place(new THREE.CylinderGeometry(0.34, 0.38, 0.12, 64), c.x, 1.2, c.z), MW);
      add('gold', place(new THREE.SphereGeometry(0.15, 64, 16, 0, Math.PI * 2, 0, Math.PI / 2), c.x, 1.25, c.z), MW);
      for (let k = 0; k < 4; k++) { const ang = k * Math.PI / 2 + 0.4; add('gold', place(new THREE.CylinderGeometry(0.025, 0.025, 1.0, 6), c.x + Math.cos(ang) * 0.34, 0.66, c.z + Math.sin(ang) * 0.34), MW); }
      add('haz', place(new THREE.CylinderGeometry(0.5, 0.5, 0.06, 64, 1, true), c.x, 0.06, c.z), MW);
      add('glass', place(new THREE.CylinderGeometry(0.31, 0.31, 1.0, 48, 1, true), c.x, 0.66, c.z), MW);
      for (const s of [-1, 1]) add('copper', tubeAlong([{ x: 0.38, y: 0.5, z: s * 0.12 }, { x: 0.58, y: 0.35, z: s * 0.3 }, { x: 0.72, y: 0.06, z: s * 0.5 }].map((q) => ({ ...q, x: c.x - Math.sign(c.x) * q.x })), 0, 0.04, false, 6), MW);
    });
    { const sh = pl.hots.filter((q) => q.shaft); if (sh.length) { sh[0].shaftOn = true; sh[sh.length - 1].shaftOn = true; } }
    pl.hots.forEach((h) => {
      // white-hot pool on the matrix floor
      add('pool', place(new THREE.CircleGeometry(h.r * 1.7, 32), h.x, 0.05, h.z, -Math.PI / 2, 0, 0), MW);
      if (!h.shaft) return;
      // furnace: amber plasma column in a copper cage + rising light shaft (crossed additive cards)
      add('core', place(new THREE.CapsuleGeometry(0.1, 0.6, 8, 24), h.x, 0.5, h.z), MW);
      add('dark', place(new THREE.TorusGeometry(0.3, 0.035, 8, 32), h.x, 0.05, h.z, Math.PI / 2, 0, 0), MW);
      add('copper', place(new THREE.TorusGeometry(0.19, 0.022, 8, 24), h.x, 0.16, h.z, Math.PI / 2, 0, 0), MW);
      add('copper', place(new THREE.TorusGeometry(0.19, 0.022, 8, 24), h.x, 0.9, h.z, Math.PI / 2, 0, 0), MW);
      for (let k = 0; k < 6; k++) { const an = (k / 6) * Math.PI * 2; add('copper', place(new THREE.CylinderGeometry(0.016, 0.016, 0.78, 6), h.x + Math.cos(an) * 0.19, 0.53, h.z + Math.sin(an) * 0.19), MW); }
      if (h.shaftOn) add('shaft', place(new THREE.PlaneGeometry(1.6, 5.6), h.x, 0.1 + 2.8, h.z, 0, -MITO[idx].rot, 0), MW);
      hotWorld.push(wp(MW, h.x, 1.0, h.z));
    });

    // ---- warm pit lights: two small amber pools per plant, low inside the folds
    for (const h of pl.hots.filter((q) => q.shaft).filter((_, k) => k !== 1)) {
      const L = new THREE.PointLight(0xffa838, 60, 4.5, 2);
      L.position.copy(wp(MW, h.x, 0.75, h.z * 0.6)); g.add(L); lights.push(L);
    }

    // ---- short pier: from the stair landing over the wall to a round viewing platform above a corridor
    const pc = corridors.filter((c) => !c.bay && c.w > 0.4).reduce((p, q) => (Math.abs(q.x - 0.6) < Math.abs(p.x - 0.6) ? q : p));
    const pzC = bi * 0.32, px = pl.corrX(pc, pzC), pr = 0.62, cw = 0.45;
    add('deck', place(new THREE.CylinderGeometry(pr, pr, 0.06, 40), px, DECK_Y, pzC), MW);
    add('dark', place(new THREE.CylinderGeometry(pr + 0.03, pr - 0.05, 0.12, 40, 1, true), px, DECK_Y - 0.06, pzC), MW);
    add('dark', place(new THREE.CylinderGeometry(0.05, 0.07, DECK_Y, 10), px, DECK_Y / 2, pzC), MW);
    add('steel', place(new THREE.TorusGeometry(pr - 0.03, 0.018, 6, 40, Math.PI * 1.7), px, DECK_Y + 0.45, pzC, Math.PI / 2, 0, Math.PI / 2 + Math.PI * 0.15), MW);
    add('steel', place(new THREE.TorusGeometry(pr - 0.03, 0.011, 5, 40, Math.PI * 1.7), px, DECK_Y + 0.24, pzC, Math.PI / 2, 0, Math.PI / 2 + Math.PI * 0.15), MW);
    for (let k = 0; k < 9; k++) { const an = Math.PI / 2 + Math.PI * 0.15 + (k / 8) * Math.PI * 1.7; add('steel', place(new THREE.CylinderGeometry(0.015, 0.015, 0.45, 5), px + Math.cos(an) * (pr - 0.03), DECK_Y + 0.23, pzC + Math.sin(an) * (pr - 0.03)), MW); }
    add('glow', place(new THREE.SphereGeometry(0.035, 12, 8), px - (pr - 0.03), DECK_Y + 0.49, pzC), MW);
    add('glow', place(new THREE.SphereGeometry(0.035, 12, 8), px + (pr - 0.03), DECK_Y + 0.49, pzC), MW);

    // ---- gangway: catwalk -> landing over the shell -> straight stair down to the road (local +z)
    const topY = H + 0.12, zL0 = b - LIP_IN - 0.25, zL1 = b + 0.3, gw = 0.5;
    const zB0 = pzC + pr - 0.08;
    const brLen = Math.hypot(zL0 - zB0, topY - DECK_Y), brAng = Math.atan2(topY - DECK_Y, zL0 - zB0);
    add('deck', place(new RoundedBoxGeometry(gw, 0.06, brLen, 2, 0.02), px, (topY + DECK_Y) / 2 - 0.03, (zL0 + zB0) / 2, -brAng, 0, 0), MW);
    add('dark', place(new RoundedBoxGeometry(0.06, 0.1, brLen, 1, 0.01), px, (topY + DECK_Y) / 2 - 0.1, (zL0 + zB0) / 2, -brAng, 0, 0), MW);
    add('deck', place(new RoundedBoxGeometry(gw + 0.1, 0.07, zL1 - zL0, 2, 0.02), px, topY - 0.035, (zL0 + zL1) / 2), MW);
    add('dark', place(new THREE.BoxGeometry(gw + 0.12, 0.12, zL1 - zL0), px, topY - 0.12, (zL0 + zL1) / 2), MW);
    const steps = 11, run = 2.6, z0 = zL1, z1 = zL1 + run;
    for (let k = 0; k < steps; k++) {
      const t0 = (k + 1) / (steps + 1), z = z0 + run * t0, y = topY * (1 - t0);
      add('deck', place(new RoundedBoxGeometry(gw, 0.05, run / (steps + 1) + 0.03, 1, 0.012), px, y - 0.025, z), MW);
      add('haz', place(new THREE.BoxGeometry(gw, 0.052, 0.03), px, y - 0.025, z - run / (steps + 1) / 2 + 0.02), MW);
    }
    const sAng = Math.atan2(topY, run), sLen = Math.hypot(topY, run);
    for (const s of [-1, 1]) {
      const xx = px + s * (gw / 2 + 0.02);
      add('copper', place(new THREE.BoxGeometry(0.05, 0.16, sLen + 0.1), xx, topY / 2 - 0.06, (z0 + z1) / 2, sAng, 0, 0), MW);
      // handrails: stair, landing, bridge
      add('steel', cylBetween(new THREE.Vector3(xx, 0.5, z1), new THREE.Vector3(xx, topY + 0.5, z0), 0.02), MW);
      add('steel', cylBetween(new THREE.Vector3(xx, topY + 0.5, z0), new THREE.Vector3(xx, topY + 0.5, zL0), 0.02), MW);
      add('steel', cylBetween(new THREE.Vector3(xx, topY + 0.5, zL0), new THREE.Vector3(xx, DECK_Y + 0.45, zB0), 0.02), MW);
      for (let k = 0; k <= 4; k++) { const t = k / 4, z = z1 + (z0 - z1) * t; add('steel', place(new THREE.CylinderGeometry(0.015, 0.015, 0.5, 5), xx, t * topY + 0.25, z), MW); }
      for (const z of [zL0, (zL0 + zL1) / 2, zL1]) add('steel', place(new THREE.CylinderGeometry(0.015, 0.015, 0.5, 5), xx, topY + 0.25, z), MW);
      for (let k = 1; k < 4; k++) { const t = k / 4, z = zB0 + (zL0 - zB0) * t; add('steel', place(new THREE.CylinderGeometry(0.015, 0.015, 0.47, 5), xx, DECK_Y + (topY - DECK_Y) * t + 0.24, z), MW); }
    }

    // ---- rim railing on the lip (broken at the gangway)
    const railRuns = [];
    let run0 = [];
    wallC.forEach((p, i) => {
      if (p.z > 0 && Math.abs(p.x - px) < gw / 2 + 0.12) { if (run0.length > 2) railRuns.push(run0); run0 = []; return; }
      run0.push({ x: p.x, z: p.z, i });
    });
    if (run0.length > 2) { if (railRuns.length && railRuns[0][0].i === 0) railRuns[0] = run0.concat(railRuns[0]); else railRuns.push(run0); }
    railRuns.forEach((r) => {
      add('steel', tubeAlong(r, H + 0.4, 0.02, false, 5), MW);
      add('steel', tubeAlong(r, H + 0.21, 0.012, false, 4), MW);
      for (let k = 0; k < r.length; k += 7) add('steel', place(new THREE.CylinderGeometry(0.015, 0.015, 0.42, 5), r[k].x, H + 0.19, r[k].z), MW);
    });

    // ---- conduits on the outside of the shell, clamps + bolts, risers
    const pipeA = offsetContour(S, 0.07), pipeB = offsetContour(S, 0.1);
    add('copper', tubeAlong(pipeA.filter((_, i) => i % 3 === 0), 1.22, 0.06, true, 8), MW);
    add('gold', tubeAlong(pipeB.filter((_, i) => i % 3 === 0), 1.4, 0.04, true, 8), MW);
    for (let i = 0; i < S.length; i += 13) {
      const p = S[i], nn = leftNormal(S, i), yaw = Math.atan2(-nn.x, -nn.z);
      add('dark', place(new THREE.BoxGeometry(0.1, 0.36, 0.1), p.x - nn.x * 0.06, 1.3, p.z - nn.z * 0.06, 0, yaw, 0), MW);
      bolts.push(MW.clone().multiply(trs(p.x - nn.x * 0.12, 1.16, p.z - nn.z * 0.12)));
      bolts.push(MW.clone().multiply(trs(p.x - nn.x * 0.12, 1.46, p.z - nn.z * 0.12)));
    }
    for (let i = 7; i < S.length; i += 52) {
      const p = S[i], nn = leftNormal(S, i);
      if (p.z > 0 && Math.abs(p.x - px) < 0.8) continue;
      add('copper', place(new THREE.CylinderGeometry(0.045, 0.045, 1.22, 8), p.x - nn.x * 0.1, 0.61, p.z - nn.z * 0.1), MW);
      add('gold', place(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 10), p.x - nn.x * 0.1, 0.1, p.z - nn.z * 0.1), MW);
    }

    // ---- maintenance hatches (frame, door, hazard sill, lamp) and exterior ladders
    const nearest = (tx, side) => {
      let best = 0, bd = 1e9;
      S.forEach((p, i) => { if (Math.sign(p.z) === side) { const d = Math.abs(p.x - tx); if (d < bd) { bd = d; best = i; } } });
      return best;
    };
    const hatchAt = (tx, side, big) => {
      const i = nearest(tx, side), p = S[i], nn = leftNormal(S, i), yaw = Math.atan2(-nn.x, -nn.z);
      const sc = big ? 1.25 : 1;
      const m = MW.clone().multiply(trs(p.x - nn.x * 0.02, 0, p.z - nn.z * 0.02, 0, yaw, 0));
      add('gold', place(new RoundedBoxGeometry(0.78 * sc, 0.98 * sc, 0.12, 2, 0.04), 0, 0.49 * sc + 0.02, 0), m);
      add('door', place(new RoundedBoxGeometry(0.62 * sc, 0.86 * sc, 0.1, 2, 0.03), 0, 0.45 * sc + 0.03, 0.05), m);
      add('steel', place(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 14), 0, 0.5 * sc, 0.11, Math.PI / 2, 0, 0), m);
      add('steel', place(new THREE.BoxGeometry(0.2, 0.025, 0.03), 0, 0.5 * sc, 0.13), m);
      add('haz', place(new THREE.BoxGeometry(0.9 * sc, 0.06, 0.32), 0, 0.03, 0.16), m);
      add('glow', place(new THREE.SphereGeometry(0.045, 10, 8), 0, 1.06 * sc + 0.03, 0.08), m);
      add('dark', place(new THREE.BoxGeometry(0.16, 0.05, 0.1), 0, 1.06 * sc - 0.02, 0.06), m);
      return { p, nn };
    };
    const main = hatchAt(-1.6, 1, true);
    hatchAt(5.4, 1, false); hatchAt(-4.2, -1, false); hatchAt(3.6, -1, false);
    for (const [tx, side] of [[-6.2, 1], [1.5, -1]]) {
      const i = nearest(tx, side), p = S[i], nn = leftNormal(S, i), yaw = Math.atan2(-nn.x, -nn.z);
      add('steel', ladderGeo(H + 0.1), MW.clone().multiply(trs(p.x - nn.x * 0.2, 0, p.z - nn.z * 0.2, 0, yaw, 0)));
    }

    // ---- control console on the viewing platform (screen faces the stair)
    add('door', place(new RoundedBoxGeometry(0.4, 0.46, 0.26, 2, 0.04), px, DECK_Y + 0.26, pzC - pr + 0.2), MW);
    add('door', place(new THREE.BoxGeometry(0.4, 0.28, 0.05), px, DECK_Y + 0.56, pzC - pr + 0.3, -0.35, 0, 0), MW);
    B.screen.push(norm(place(new THREE.PlaneGeometry(0.36, 0.22), px, DECK_Y + 0.565, pzC - pr + 0.33, -0.35, 0, 0)).applyMatrix4(MW));

    // ---- glowing heat vents on the outer shell (louvred grilles)
    for (const [tx, side] of [[-7.0, 1], [-3.7, 1], [2.9, 1], [7.0, 1], [-7.0, -1], [-1.9, -1], [5.7, -1]]) {
      if (side > 0 && Math.abs(tx - px) < 1.2) continue;
      const i = nearest(tx, side), p = S[i], nn = leftNormal(S, i), yaw = Math.atan2(-nn.x, -nn.z);
      const m = MW.clone().multiply(trs(p.x - nn.x * 0.03, 0, p.z - nn.z * 0.03, 0, yaw, 0));
      add('dark', place(new RoundedBoxGeometry(0.72, 0.36, 0.08, 2, 0.03), 0, 1.66, 0), m);
      add('vent', place(new THREE.PlaneGeometry(0.6, 0.26), 0, 1.66, 0.045), m);
      for (let k = 0; k < 4; k++) add('dark', place(new THREE.BoxGeometry(0.62, 0.028, 0.04), 0, 1.57 + k * 0.06, 0.06, -0.5, 0, 0), m);
    }

    // ---- footprints + anchors
    // capsule footprint hugs the rounded pod ends (a box would block roads at its empty corners)
    { const m = MITO[idx], r = b + 0.15, half = Math.max(0, a - b), c = Math.cos(m.rot), sn = Math.sin(m.rot);
      footprints.push({ type: 'capsule', ax: m.x - half * c, az: m.z + half * sn, bx: m.x + half * c, bz: m.z - half * sn, r }); }
    const stairC = wp(MW, px, 0, (z0 + z1) / 2);
    footprints.push({ type: 'box', x: +stairC.x.toFixed(2), z: +stairC.z.toFixed(2), w: gw + 0.2, d: +(run + 0.2).toFixed(2), rot: MITO[idx].rot });
    const pre = `mito${tag}.`;
    anchors[pre + 'entrance'] = arr(wp(MW, px, 0, z1 + 0.7));
    anchors[pre + 'stairTop'] = arr(wp(MW, px, topY, (zL0 + zL1) / 2));
    anchors[pre + 'hatch'] = arr(wp(MW, main.p.x - main.nn.x * 0.7, 0, main.p.z - main.nn.z * 0.7));
    anchors[pre + 'examineCam'] = arr(wp(MW, -1.5, 10.5, b + 9));
    anchors[pre + 'examineTarget'] = arr(wp(MW, 0, 0.8, 0));
    const sf = folds.filter((F) => F.s > 0).reduce((p, q) => (Math.abs(q.xc - 1.2) < Math.abs(p.xc - 1.2) ? q : p));
    anchors[pre + 'synthase'] = arr(sf.crownWorld);
    anchors[pre + 'synthaseCam'] = arr(wp(MW, sf.tip.x + 1.1, 2.5, sf.tip.z - 1.6));
    anchors[pre + 'center'] = arr(wp(MW, 0, 0, 0));
    [[-0.3, 0], [0.3, 0], [0, -0.3], [0, 0.25]].forEach(([dx, dz], k) => { anchors[`${pre}catwalk${k}`] = arr(wp(MW, px + dx, DECK_Y + 0.03, pzC + dz)); });
    anchors[`${pre}catwalk4`] = arr(wp(MW, px, (topY + DECK_Y) / 2 + 0.03, (zL0 + zB0) / 2));
    // apron walk spots around the base (skip the stair)
    const ap = offsetContour(S, 0.55);
    for (let k = 0, m = 0; k < 8; k++) {
      const p = ap[Math.floor((k / 8) * ap.length + ap.length / 16) % ap.length];
      if (p.z > 0 && Math.abs(p.x) < 1) continue;
      anchors[`${pre}apron${m++}`] = arr(wp(MW, p.x, 0.07, p.z));
    }
    cores.forEach((c, k) => { anchors[`${pre}reactor${k}`] = arr(wp(MW, c.x, 0, c.z)); });
    pl.MW = MW;
  });

  // ---------- merge static buckets
  const mk = (key, mat, cast = true, recv = true) => {
    if (!B[key].length) return null;
    const mesh = new THREE.Mesh(mergeGeometries(B[key]), mat);
    mesh.castShadow = cast; mesh.receiveShadow = recv; mesh.name = `mito_${key}`;
    g.add(mesh); return mesh;
  };
  mk('wall', wallMat); mk('mem', memMat); mk('floor', floorMat, false); mk('ims', imsMat, false); mk('apron', apronMat, false);
  const sh = mk('shadow', shadowMat, false, false); sh.renderOrder = 1;
  const poolMesh = mk('pool', poolMat, false, false); poolMesh.renderOrder = 3;
  const shaftMesh = mk('shaft', shaftMat, false, false); shaftMesh.renderOrder = 5;
  mk('core', coreMat, false); mk('strip', stripMat, false); mk('vent', ventMat, false);
  mk('gold', goldMat); mk('steel', steelMat); mk('dark', darkSteelMat); mk('copper', copperMat); mk('deck', deckMat); mk('haz', hazMat, false);
  mk('door', doorMat); mk('glow', glowMat, false);
  // soft additive furnace glow over each hot spot (reads as fire from the overview)
  const hotGeo = new THREE.BufferGeometry().setFromPoints(hotWorld);
  const hotGlowMat = new THREE.PointsMaterial({ size: 2.6, sizeAttenuation: true, map: T.radialTexture('rgba(255,210,130,1)', 'rgba(255,110,20,0)', 128), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xff9a40, opacity: 0.35 });
  const hotGlow = new THREE.Points(hotGeo, hotGlowMat); hotGlow.name = 'furnaceGlow'; hotGlow.renderOrder = 4; g.add(hotGlow);
  const glassMesh = mk('glass', glassMat, false, false); glassMesh.renderOrder = 2;
  const scrTex = T.screenTexture(1);
  mk('screen', new THREE.MeshStandardMaterial({ map: scrTex, emissiveMap: scrTex, emissive: 0xffd9a0, emissiveIntensity: 2.2, roughness: 0.3 }), false);

  // ---------- instanced parts
  const rotorSets = [true].map((crown) => {
    const list = rotors.filter((r) => r.crown === crown);
    const mesh = new THREE.InstancedMesh(rotorGeo(), rotorMat, list.length);
    mesh.name = crown ? 'atpSynthaseCrowns' : 'atpSynthase'; mesh.castShadow = crown;
    list.forEach((r, i) => mesh.setMatrixAt(i, r.m));
    g.add(mesh);
    return { mesh, list };
  });
  const ringMesh = new THREE.InstancedMesh(new THREE.TorusGeometry(0.1, 0.02, 6, 48).rotateX(Math.PI / 2), ringGlowMat, f0Rings.length);
  f0Rings.forEach((m, i) => ringMesh.setMatrixAt(i, m)); g.add(ringMesh);
  const boltMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.028, 6, 4), goldMat, bolts.length);
  bolts.forEach((m, i) => boltMesh.setMatrixAt(i, m)); g.add(boltMesh);

  // ---------- mtDNA: violet circular double helix in a glass display cradle (plant A, end bay)
  const pa = plans[0];
  const cradleLocal = new THREE.Vector3(-pa.cores[1].x + 0.12, 0, -1.25);
  const dnaGroup = new THREE.Group(); dnaGroup.name = 'mtDNA';
  dnaGroup.position.copy(cradleLocal.clone().applyMatrix4(pa.MW));
  {
    const parts = [];
    parts.push(norm(new THREE.CylinderGeometry(0.24, 0.28, 0.12, 24).translate(0, 0.06, 0)));
    parts.push(norm(new THREE.TorusGeometry(0.25, 0.02, 6, 28).rotateX(Math.PI / 2).translate(0, 0.62, 0)));
    for (let k = 0; k < 3; k++) { const an = (k / 3) * Math.PI * 2; parts.push(norm(new THREE.CylinderGeometry(0.014, 0.014, 0.5, 5).translate(Math.cos(an) * 0.25, 0.37, Math.sin(an) * 0.25))); }
    const base = new THREE.Mesh(mergeGeometries(parts), goldMat); base.castShadow = true; dnaGroup.add(base);
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.5, 24, 1, true).translate(0, 0.37, 0), glassMat); glass.renderOrder = 2; dnaGroup.add(glass);
    const plate = new THREE.Mesh(new THREE.CircleGeometry(0.2, 24).rotateX(-Math.PI / 2).translate(0, 0.125, 0), new THREE.MeshStandardMaterial({ color: 0x1a0a22, emissive: 0x7a2ab0, emissiveIntensity: 0.35 }));
    dnaGroup.add(plate);
    const strands = [];
    const R0 = 0.15, hr = 0.022, turns = 10;
    for (const ph of [0, Math.PI]) {
      const pts = [];
      for (let k = 0; k <= 160; k++) {
        const t = (k / 160) * Math.PI * 2, tw = t * turns + ph, R = R0 + Math.cos(tw) * hr;
        pts.push(new THREE.Vector3(Math.cos(t) * R, Math.sin(tw) * hr, Math.sin(t) * R));
      }
      strands.push(norm(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 160, 0.008, 5, true)));
    }
    for (let k = 0; k < 40; k++) {
      const t = (k / 40) * Math.PI * 2, tw = t * turns;
      const p1 = new THREE.Vector3(Math.cos(t) * (R0 + Math.cos(tw) * hr), Math.sin(tw) * hr, Math.sin(t) * (R0 + Math.cos(tw) * hr));
      const p2 = new THREE.Vector3(Math.cos(t) * (R0 - Math.cos(tw) * hr), -Math.sin(tw) * hr, Math.sin(t) * (R0 - Math.cos(tw) * hr));
      strands.push(norm(cylBetween(p1, p2, 0.004, 4)));
    }
    const ring = new THREE.Mesh(mergeGeometries(strands), new THREE.MeshStandardMaterial({ color: 0x3a0a4a, emissive: 0xd04aff, emissiveIntensity: 1.5, roughness: 0.35 }));
    ring.name = 'mtDNARing'; ring.position.y = 0.42; ring.scale.setScalar(1.12); dnaGroup.add(ring);
    dnaGroup.scale.setScalar(1.25); // cradle grows with the 1.4x ring
    dnaGroup.userData.ring = ring;
  }
  g.add(dnaGroup);
  const dnaWorld = cradleLocal.clone().setY(0.42).applyMatrix4(pa.MW);
  anchors.mtDNA = arr(dnaWorld);
  anchors['mitoA.mtDNA'] = anchors.mtDNA;
  anchors.mtDNACam = arr(new THREE.Vector3(cradleLocal.x + 0.9, 2.4, cradleLocal.z + 1.6).applyMatrix4(pa.MW));
  for (const k of ['entrance', 'examineCam', 'examineTarget', 'synthase', 'synthaseCam']) anchors[k] = anchors['mitoA.' + k];

  // ---------- ATP tokens: small golden orbs rising from the crowns, drifting to the roads; fade near camera
  const TOK = 16;
  const tokMat = new THREE.MeshStandardMaterial({ color: 0x3a2000, emissive: 0xffc24a, emissiveIntensity: 3.2, roughness: 0.3 });
  const tokMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.09, 2), tokMat, TOK);
  tokMesh.name = 'atpTokens'; tokMesh.frustumCulled = false; g.add(tokMesh);
  // ---------- matrix particles: dim amber specks drifting slowly in the pits (metabolites)
  const MP = 110 * plans.length, mpBase = new Float32Array(MP * 3), mpSeed = new Float32Array(MP);
  { const r = mulberry32(606);
    for (let i = 0; i < MP; i++) {
      const pl = plans[Math.floor(i / 110)], lx = (r() * 2 - 1) * pl.ai * 0.92, hz = pl.halfZ(lx) * 0.9;
      const v = new THREE.Vector3(lx, 0.12 + r() * 0.75, (r() * 2 - 1) * hz).applyMatrix4(W2L[Math.floor(i / 110)]);
      mpBase.set([v.x, v.y, v.z], i * 3); mpSeed[i] = r() * 6.28;
    } }
  const mpGeo = new THREE.BufferGeometry(); mpGeo.setAttribute('position', new THREE.BufferAttribute(mpBase.slice(), 3));
  const matrixMotes = new THREE.Points(mpGeo, new THREE.PointsMaterial({ size: 0.07, sizeAttenuation: true, map: T.radialTexture('rgba(255,200,130,1)', 'rgba(255,120,40,0)', 32), color: 0xffa860, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
  matrixMotes.name = 'matrixMotes'; matrixMotes.frustumCulled = false; g.add(matrixMotes);
  const camPos = new THREE.Vector3(0, 100, 0);
  tokMesh.onBeforeRender = (r, s, cam) => { camPos.copy(cam.position); };
  const haloGeo = new THREE.BufferGeometry();
  haloGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(TOK * 3), 3));
  const halos = new THREE.Points(haloGeo, new THREE.PointsMaterial({ size: 0.3, sizeAttenuation: true, map: T.radialTexture('rgba(255,200,110,0.7)', 'rgba(255,140,30,0)', 64), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffc070 }));
  halos.frustumCulled = false; g.add(halos);
  const trnd = mulberry32(4242);
  const tokens = Array.from({ length: TOK }, () => ({ t: -trnd() * 7, life: 6, p0: new THREE.Vector3(), p1: new THREE.Vector3(), p2: new THREE.Vector3(), live: false }));
  const spawn = (k) => {
    const src = crowns[Math.floor(trnd() * crowns.length)], pl = plans[src.plant];
    k.p0.copy(src.pos);
    k.p1.copy(k.p0).add(new THREE.Vector3(0, 2.6 + trnd() * 0.8, 0));
    k.p2.set((trnd() - 0.5) * pl.a * 1.2, 1.2 + trnd() * 0.6, pl.b + 3.2 + trnd() * 2.5).applyMatrix4(pl.MW);
    k.t = 0; k.life = 5.5 + trnd() * 2; k.live = true;
  };

  // ---------- spark bursts from the turbine crowns (white-hot -> amber, staggered)
  const SP = crowns.length * SPARK_N;
  const spGeo = new THREE.BufferGeometry();
  spGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(SP * 3), 3));
  spGeo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(SP * 3), 3));
  const sparks = new THREE.Points(spGeo, new THREE.PointsMaterial({ size: 0.2, sizeAttenuation: true, vertexColors: true, map: T.radialTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)', 32), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  sparks.frustumCulled = false; sparks.name = 'synthaseSparks'; g.add(sparks);
  const spSeed = Array.from({ length: SP }, () => { const an = trnd() * Math.PI * 2, sp = 0.3 + trnd() * 0.7; return [Math.cos(an) * sp, 2.0 + trnd() * 1.5, Math.sin(an) * sp, trnd() * 0.15]; });
  const crownCycle = crowns.map((c, i) => (i * 0.53 + c.phase) % SPARK_CYCLE);

  // ---------- animation
  const qa = new THREE.Quaternion(), mA = new THREE.Matrix4(), axisY = new THREE.Vector3(0, 1, 0), tmp = new THREE.Vector3(), sc3 = new THREE.Vector3();
  const lightBase = lights.map((l) => l.intensity);
  g.userData.update = (t, dt) => {
    for (const { mesh, list } of rotorSets) {
      for (let i = 0; i < list.length; i++) {
        const r = list[i];
        mA.makeRotationFromQuaternion(qa.setFromAxisAngle(axisY, t * r.speed + r.phase)).premultiply(r.m);
        mesh.setMatrixAt(i, mA);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
    // breathing: a slow pulse plus a sharper "firing" beat every spark cycle
    const pulse = 0.5 + 0.5 * Math.sin(t * 1.7) * Math.sin(t * 0.63 + 1);
    const beat = Math.exp(-((t % SPARK_CYCLE) / 0.25));
    glowMat.emissiveIntensity = 2.4 + pulse * 0.6;
    coreMat.emissiveIntensity = 1.25 + pulse * 0.2 + beat * 0.1;
    stripMat.emissiveIntensity = 1.2 + pulse * 0.4 + beat * 0.3;
    ventMat.emissiveIntensity = 2.2 + pulse * 0.6 + beat * 0.4;
    shaftMat.opacity = 0.6 + pulse * 0.12 + beat * 0.06 + Math.sin(t * 7.3) * 0.02;
    shaftMat.map.offset.y = -t * 0.18;
    poolMat.color.setRGB(1.45 + pulse * 0.25 + beat * 0.15, 1.05 + pulse * 0.18 + beat * 0.1, 0.62 + pulse * 0.1);
    ringGlowMat.emissiveIntensity = 1.8 + pulse * 0.5 + beat * 0.5;
    memMat.emissiveIntensity = 0.42 + pulse * 0.12 + beat * 0.06; // cap glow stays <= 0.6
    floorMat.emissiveIntensity = 0.3 + pulse * 0.12;
    floorT.value = t;
    { const mp = mpGeo.attributes.position.array;
      for (let i = 0; i < MP; i++) { const sd = mpSeed[i]; mp[i * 3] = mpBase[i * 3] + Math.sin(t * 0.21 + sd) * 0.18; mp[i * 3 + 1] = mpBase[i * 3 + 1] + Math.sin(t * 0.33 + sd * 2) * 0.08; mp[i * 3 + 2] = mpBase[i * 3 + 2] + Math.cos(t * 0.17 + sd) * 0.18; }
      mpGeo.attributes.position.needsUpdate = true; }
    hotGlowMat.opacity = 0.62 + pulse * 0.22 + beat * 0.2 + Math.sin(t * 9.7) * 0.05;
    chev.offset.x = -t * 0.125;                     // 0.5 u/s along the channel (texture spans 4u)
    imsMat.emissiveIntensity = 3.0 + 0.5 * Math.sin(t * 2.3) + beat * 1.2;
    lights.forEach((l, i) => { l.intensity = lightBase[i] * (0.75 + 0.35 * pulse + 0.08 * Math.sin(t * 11 + i * 2)); });
    // tokens
    const hp = haloGeo.attributes.position.array;
    tokens.forEach((k, i) => {
      k.t += dt;
      if (!k.live && k.t >= 0) spawn(k);
      if (k.live && k.t >= k.life) spawn(k);
      let s = 0;
      if (k.live) {
        const u = THREE.MathUtils.clamp(k.t / k.life, 0, 1);
        const e = u < 0.35 ? (u / 0.35) * 0.5 : 0.5 + ((u - 0.35) / 0.65) * 0.5;
        const a1 = 1 - e;
        tmp.set(0, 0, 0).addScaledVector(k.p0, a1 * a1).addScaledVector(k.p1, 2 * a1 * e).addScaledVector(k.p2, e * e);
        tmp.y += Math.sin(t * 3 + i) * 0.05;
        s = smooth01(0, 0.06, u) * (1 - smooth01(0.88, 1, u)) * smooth01(1.2, 3.0, tmp.distanceTo(camPos));
      }
      mA.compose(tmp, qa.identity(), sc3.set(s, s, s));
      tokMesh.setMatrixAt(i, mA);
      hp[i * 3] = tmp.x; hp[i * 3 + 1] = s > 0.05 ? tmp.y : -50; hp[i * 3 + 2] = tmp.z;
    });
    tokMesh.instanceMatrix.needsUpdate = true; haloGeo.attributes.position.needsUpdate = true;
    // sparks
    const sp = spGeo.attributes.position.array, sc = spGeo.attributes.color.array;
    for (let c = 0; c < crowns.length; c++) {
      const age0 = (t + crownCycle[c]) % SPARK_CYCLE, P = crowns[c].pos;
      for (let k = 0; k < SPARK_N; k++) {
        const i = c * SPARK_N + k, [vx, vy, vz, dl] = spSeed[i], age = age0 - dl;
        if (age < 0 || age > SPARK_LIFE) { sp[i * 3 + 1] = -50; sc[i * 3] = sc[i * 3 + 1] = sc[i * 3 + 2] = 0; continue; }
        sp[i * 3] = P.x + vx * age; sp[i * 3 + 1] = P.y + vy * age - 3.2 * age * age; sp[i * 3 + 2] = P.z + vz * age;
        const f = age / SPARK_LIFE, heat = 1 - f, br = 3.6 * (1 - f * f);
        sc[i * 3] = br; sc[i * 3 + 1] = br * (0.35 + 0.6 * heat); sc[i * 3 + 2] = br * 0.6 * heat * heat;
      }
    }
    spGeo.attributes.position.needsUpdate = true; spGeo.attributes.color.needsUpdate = true;
    // mtDNA: slow spin with a wobbling tilt
    const ring = dnaGroup.userData.ring;
    ring.rotation.set(0.4 + Math.sin(t * 0.5) * 0.12, t * 0.3, Math.cos(t * 0.4) * 0.1);
    ring.position.y = 0.42 + Math.sin(t * 1.1) * 0.025;
  };

  g.userData.footprints = footprints;
  g.userData.anchors = anchors;
  return g;
}
