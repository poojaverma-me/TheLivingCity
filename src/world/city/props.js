// Street furniture & greenery: stylised trees, lawns, hedges, planters, lamps, benches, bollards,
// membrane-side pipe runs, crates/barrels/pallets, parked cargo carts, manholes, drains, cafe umbrellas.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, mergeVertices } from '../../core/geom.js';
import { trs } from '../../core/geom.js';
import { fbm3, mulberry32 } from '../../core/noise.js';
import { organelleDist, membraneDist, apronDist } from './obstacles.js';
import { NETWORK, roadDist } from './network.js';
import { BUILDINGS, YARDS, COL } from './plan.js';
import { cellContour } from '../membrane.js';
import { GATES } from '../layout.js';
import { Parts, colored, cityMaterials } from './kit.js';
import { frameAt, Y_ROAD } from './roads.js';
import { lawnTexture, manholeTexture } from './citytex.js';
import { LIVE_FOOTPRINTS } from './liveFootprints.js';
import { createVehicle } from '../../life/vehicles.js';

const LIVERY = [0xffffff, 0xe4e8ec, 0xc9d3dc, 0xdfe6ea].map((c) => new THREE.Color(c));
const FLOWERS = [0xff6f9a, 0xffd34d, 0xffffff, 0xb98cff, 0xff8a4d].map((c) => new THREE.Color(c));
const rbox = (w, h, d, r = 0.06, s = 1) => new RoundedBoxGeometry(w, h, d, s, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));
const mv = (g, x, y, z, rx = 0, ry = 0, rz = 0, s = 1) => g.applyMatrix4(trs(x, y, z, rx, ry, rz, s));

// ---------------------------------------------------------------- prop geometries
function canopyBlob(r, seed, sy = 1, detail = 2) {
  let g = new THREE.IcosahedronGeometry(r, detail);
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  g = mergeVertices(g);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = fbm3(x * 3.2 / r + seed, y * 3.2 / r, z * 3.2 / r + seed * 0.7, 3);
    const k = 1 + n * 0.32 + 0.06 * Math.sin(seed + x * 9);
    p.setXYZ(i, x * k, y * k * sy, z * k);
  }
  g.computeVertexNormals();
  return g;
}
/** Tree with gradient-coloured lumpy canopy (vertex colours) + trunk. variant: 0 round, 1 poplar, 2 bush */
/**
 * Tree species (vertex-coloured, gradient lit canopy). 0 round broadleaf (~1.45u), 1 conical conifer (~1.7u),
 * 2 palm-ish blob tree (~1.8u, slim trunk + flattened lobes), 3 low shrub (~0.6u).
 */
const SPECIES = [
  { dark: 0x2d5f2a, mid: 0x4f8a37, light: 0x95c15e },   // 0 round broadleaf
  { dark: 0x1f4f35, mid: 0x356f45, light: 0x6fa36a },   // 1 conifer
  { dark: 0x4a7a2a, mid: 0x7aa83c, light: 0xc0d872 },   // 2 palm-ish
  { dark: 0x2f6a2c, mid: 0x5a9a3c, light: 0x9cc866 },   // 3 shrub
  { dark: 0x3a5a22, mid: 0x5f8a30, light: 0xa8c060 },   // 4 columnar poplar
  { dark: 0x5a6a26, mid: 0x8a9a3a, light: 0xc8c878 },   // 5 umbrella / acacia
].map((q) => { const o = {}; for (const k in q) { const c = new THREE.Color(q[k]); const h = {}; c.getHSL(h); o[k] = c.setHSL(h.h, h.s * 0.85, h.l).getHex(); } return o; });
function treeGeo(variant) {
  const rnd = mulberry32(100 + variant);
  const parts = [];
  const trunkH = [0.5, 0.28, 0.95, 0.06, 0.25, 1.0][variant];
  const trunkR = [0.06, 0.06, 0.04, 0.03, 0.05, 0.045][variant];
  parts.push(colored(mv(new THREE.CylinderGeometry(trunkR * 0.65, trunkR, trunkH + 0.2, 7), 0, (trunkH + 0.2) / 2, 0), variant === 2 ? 0x8a6a48 : 0x6a4a30));
  const blobs = [];
  if (variant === 0) {
    blobs.push([0, trunkH + 0.4, 0, 0.42]);
    for (let k = 0; k < 5; k++) { const a = k * 1.3 + rnd(); blobs.push([Math.cos(a) * 0.27, trunkH + 0.28 + rnd() * 0.25, Math.sin(a) * 0.27, 0.27 + rnd() * 0.08]); }
    blobs.push([0.04, trunkH + 0.7, -0.02, 0.27]);
  } else if (variant === 1) {
    for (let k = 0; k < 5; k++) blobs.push([0, trunkH + 0.22 + k * 0.27, 0, 0.36 - k * 0.065, 0.75]);
  } else if (variant === 2) {
    for (let k = 0; k < 5; k++) { const a = k * 1.256 + rnd() * 0.3; blobs.push([Math.cos(a) * 0.24, trunkH + 0.2 + rnd() * 0.08, Math.sin(a) * 0.24, 0.22 + rnd() * 0.05, 0.55]); }
    blobs.push([0, trunkH + 0.32, 0, 0.2, 0.7]);
  } else if (variant === 3) {
    for (let k = 0; k < 4; k++) { const a = k * 1.6 + rnd(); blobs.push([Math.cos(a) * 0.17, 0.2 + rnd() * 0.1, Math.sin(a) * 0.17, 0.2 + rnd() * 0.05, 0.85]); }
  } else if (variant === 4) {
    for (let k = 0; k < 4; k++) blobs.push([(rnd() - 0.5) * 0.06, trunkH + 0.3 + k * 0.3, (rnd() - 0.5) * 0.06, 0.2 - Math.abs(k - 1.2) * 0.02, 1.6]);
  } else {
    blobs.push([0, trunkH + 0.28, 0, 0.42, 0.35]);
    for (let k = 0; k < 4; k++) { const a = k * 1.57 + rnd() * 0.4; blobs.push([Math.cos(a) * 0.36, trunkH + 0.22 + rnd() * 0.06, Math.sin(a) * 0.36, 0.26, 0.4]); }
  }
  const sp = SPECIES[variant];
  const dark = new THREE.Color(sp.dark), mid = new THREE.Color(sp.mid), light = new THREE.Color(sp.light);
  let ymin = Infinity, ymax = -Infinity;
  const bg = blobs.map(([x, y, z, r, sy], i) => { const g = canopyBlob(r, i * 3.1 + variant * 7, sy || 1, variant === 3 ? 1 : 2); g.translate(x, y, z); g.computeBoundingBox(); ymin = Math.min(ymin, g.boundingBox.min.y); ymax = Math.max(ymax, g.boundingBox.max.y); return g; });
  const c = new THREE.Color();
  for (const g of bg) {
    const p = g.attributes.position, n = g.attributes.normal; const col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const t = (p.getY(i) - ymin) / (ymax - ymin || 1);
      const up = Math.max(0, n.getY(i));
      c.copy(dark).lerp(mid, Math.min(1, t * 1.4)).lerp(light, Math.max(0, up * t - 0.25) * 0.9);
      const v = 1 + fbm3(p.getX(i) * 6, p.getY(i) * 6, p.getZ(i) * 6, 2) * 0.22;
      col[i * 3] = c.r * v; col[i * 3 + 1] = c.g * v; col[i * 3 + 2] = c.b * v;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(p.count * 2), 2));
    parts.push(g.toNonIndexed());
  }
  return mergeGeometries(parts);
}
/** Ground cover tuft: three low flattened blobs (instance colour = foliage or flowers). */
function tuftGeo() {
  const parts = [];
  for (let k = 0; k < 3; k++) { const g = canopyBlob(0.1 + k * 0.02, 90 + k, 1.0, 1); g.translate(Math.cos(k * 2.1) * 0.1, 0.1 + k * 0.02, Math.sin(k * 2.1) * 0.1); parts.push(colored(g, 0xffffff).toNonIndexed()); }
  return mergeGeometries(parts);
}

function lampGeo() {
  return mergeGeometries([
    colored(mv(new THREE.CylinderGeometry(0.11, 0.13, 0.16, 10), 0, 0.08, 0), 0x50565f),
    colored(mv(new THREE.CylinderGeometry(0.035, 0.05, 2.15, 8), 0, 1.15, 0), 0x5b626c),
    colored(mv(new THREE.CylinderGeometry(0.025, 0.025, 0.55, 6), 0, 2.18, 0.24, Math.PI / 2 - 0.25), 0x5b626c),
    colored(mv(rbox(0.2, 0.08, 0.32, 0.03), 0, 2.2, 0.5), 0x3d434c),
  ]);
}
function benchGeo() {
  const parts = [];
  const S = 0.82;
  for (let k = 0; k < 3; k++) parts.push(colored(mv(new THREE.BoxGeometry(0.9, 0.035, 0.08), 0, 0.36, -0.1 + k * 0.1), 0xc1824a));
  for (let k = 0; k < 2; k++) parts.push(colored(mv(new THREE.BoxGeometry(0.9, 0.08, 0.035), 0, 0.5 + k * 0.11, -0.17, -0.2), 0xc1824a));
  for (const s of [-1, 1]) parts.push(colored(mv(new THREE.BoxGeometry(0.05, 0.36, 0.34), s * 0.38, 0.18, -0.03), 0x3a3f47));
  return mergeGeometries(parts).scale(S, S, S);
}
function bollardGeo() {
  return mergeGeometries([
    colored(mv(new THREE.CylinderGeometry(0.07, 0.08, 0.5, 10), 0, 0.25, 0), 0x6b737e),
    colored(mv(new THREE.CylinderGeometry(0.073, 0.073, 0.08, 10), 0, 0.38, 0), 0xf2c21b),
    colored(mv(new THREE.SphereGeometry(0.07, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), 0, 0.5, 0), 0x6b737e),
  ]);
}
function planterGeo() {
  const parts = [colored(mv(rbox(0.9, 0.4, 0.5, 0.06), 0, 0.2, 0), 0xd9dce1), colored(mv(rbox(0.82, 0.04, 0.42, 0.02), 0, 0.4, 0), 0x5a3f2c)];
  for (let k = 0; k < 3; k++) { const g = canopyBlob(0.2, 40 + k, 0.85, 1); g.translate(-0.26 + k * 0.26, 0.52, 0); parts.push(colored(g, [0x4f9e32, 0x63b83a, 0x3f8c2c][k]).toNonIndexed()); }
  // flowers
  for (let k = 0; k < 5; k++) parts.push(colored(mv(new THREE.SphereGeometry(0.045, 6, 4), -0.32 + k * 0.16, 0.66, (k % 2 - 0.5) * 0.12), [0xff5d8f, 0xffd23f, 0xff7a3d, 0xffffff, 0xc77dff][k]));
  return mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g))).scale(0.85, 0.85, 0.85);
}
function hedgeGeo() {
  const parts = [colored(mv(rbox(1.2, 0.12, 0.42, 0.04), 0, 0.06, 0), 0xcfd3d8)];
  for (let k = 0; k < 4; k++) { const g = canopyBlob(0.24, 70 + k, 0.9, 1); g.scale(1.25, 1, 0.85); g.translate(-0.42 + k * 0.28, 0.32, 0); parts.push(colored(g, k % 2 ? 0x4c9a30 : 0x5aae36).toNonIndexed()); }
  return mergeGeometries(parts);
}
function crateGeo() { return mergeGeometries([colored(rbox(0.5, 0.5, 0.5, 0.04), 0xffffff), colored(mv(rbox(0.52, 0.06, 0.52, 0.02), 0, 0.17, 0), 0xdddddd), colored(mv(rbox(0.52, 0.06, 0.52, 0.02), 0, -0.17, 0), 0xdddddd)].map((g) => g)).scale(0.72, 0.72, 0.72); }
function barrelGeo() {
  return mergeGeometries([
    colored(new THREE.CylinderGeometry(0.2, 0.2, 0.56, 14), 0xffffff),
    colored(mv(new THREE.TorusGeometry(0.205, 0.018, 4, 14), 0, 0.15, 0, Math.PI / 2), 0xbbbbbb),
    colored(mv(new THREE.TorusGeometry(0.205, 0.018, 4, 14), 0, -0.15, 0, Math.PI / 2), 0xbbbbbb),
    colored(mv(new THREE.CylinderGeometry(0.05, 0.05, 0.02, 8), 0.08, 0.285, 0), 0x777777),
  ]).scale(0.85, 0.85, 0.85);
}
function palletGeo() {
  const parts = [];
  for (let k = 0; k < 5; k++) parts.push(colored(mv(new THREE.BoxGeometry(0.9, 0.03, 0.14), 0, 0.13, -0.32 + k * 0.16), 0xc99a62));
  for (let k = 0; k < 3; k++) parts.push(colored(mv(new THREE.BoxGeometry(0.12, 0.1, 0.8), -0.38 + k * 0.38, 0.06, 0), 0xa87a48));
  return mergeGeometries(parts).scale(0.8, 0.8, 0.8);
}
function umbrellaGeo() {
  const parts = [
    colored(mv(new THREE.CylinderGeometry(0.02, 0.02, 1.3, 6), 0, 0.65, 0), 0xdddddd),
    colored(mv(new THREE.ConeGeometry(0.6, 0.25, 12), 0, 1.38, 0), 0xffffff),
    colored(mv(new THREE.CylinderGeometry(0.3, 0.3, 0.04, 14), 0, 0.5, 0), 0xf3f3f3),
    colored(mv(new THREE.CylinderGeometry(0.04, 0.06, 0.48, 6), 0, 0.24, 0), 0x666b73),
  ];
  for (let k = 0; k < 3; k++) { const a = k * 2.1; parts.push(colored(mv(new THREE.CylinderGeometry(0.1, 0.1, 0.3, 8), Math.cos(a) * 0.5, 0.15, Math.sin(a) * 0.5), 0x9aa3ae)); }
  return mergeGeometries(parts);
}
function binGeo() { return mergeGeometries([colored(mv(new THREE.CylinderGeometry(0.13, 0.11, 0.45, 10), 0, 0.225, 0), 0x3f9b4a), colored(mv(new THREE.CylinderGeometry(0.14, 0.14, 0.05, 10), 0, 0.47, 0), 0x2f7a39)]); }
function hydrantGeo() { return mergeGeometries([colored(mv(new THREE.CylinderGeometry(0.07, 0.08, 0.36, 8), 0, 0.18, 0), 0xe0352b), colored(mv(new THREE.SphereGeometry(0.075, 8, 5), 0, 0.37, 0), 0xe0352b), colored(mv(new THREE.CylinderGeometry(0.035, 0.035, 0.22, 6), 0, 0.22, 0, 0, 0, Math.PI / 2), 0xc22a22)]); }
function coneGeo() { return mergeGeometries([colored(mv(rbox(0.26, 0.03, 0.26, 0.01), 0, 0.015, 0), 0x333333), colored(mv(new THREE.ConeGeometry(0.09, 0.36, 10), 0, 0.2, 0), 0xff6a1a), colored(mv(new THREE.CylinderGeometry(0.06, 0.07, 0.06, 10), 0, 0.2, 0), 0xffffff)]); }

// ---------------------------------------------------------------- occupancy
class Occupancy {
  constructor(footprints, pads, yards) {
    this.fp = footprints; this.pads = pads; this.yards = yards; this.items = new Map(); this.cell = 2;
  }
  key(x, z) { return `${Math.floor(x / this.cell)},${Math.floor(z / this.cell)}`; }
  near(x, z, r) {
    const cx = Math.floor(x / this.cell), cz = Math.floor(z / this.cell);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const it of this.items.get(`${cx + i},${cz + j}`) || []) if (Math.hypot(it.x - x, it.z - z) < r + it.r) return true;
    return false;
  }
  add(x, z, r) { const k = this.key(x, z); if (!this.items.has(k)) this.items.set(k, []); this.items.get(k).push({ x, z, r }); }
  bldDist(x, z) {
    let d = Infinity;
    for (const f of this.fp) {
      if (f.type === 'circle') d = Math.min(d, Math.hypot(x - f.x, z - f.z) - f.r);
      else { const c = Math.cos(f.rot), s = Math.sin(f.rot); const dx = x - f.x, dz = z - f.z; const lx = dx * c - dz * s, lz = dx * s + dz * c; const qx = Math.abs(lx) - f.w / 2, qz = Math.abs(lz) - f.d / 2; d = Math.min(d, Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0)); }
    }
    return d;
  }
  padDist(x, z) { let d = Infinity; for (const p of this.pads) d = Math.min(d, Math.hypot(x - p.x, z - p.z) - p.r - 0.2); return d; }
  yardDist(x, z) {
    let d = Infinity;
    for (const y of this.yards) { const c = Math.cos(y.rot), s = Math.sin(y.rot); const dx = x - y.x, dz = z - y.z; const lx = dx * c - dz * s, lz = dx * s + dz * c; d = Math.min(d, Math.max(Math.abs(lx) - y.w / 2, Math.abs(lz) - y.d / 2)); }
    return d;
  }
  /** Clearance test. road: min distance from asphalt edge. */
  free(x, z, r, { road = 0.22, org = 0.9, mem = 0.7, bld = 0.25, yard = 0.1, self = true, apron = true } = {}) {
    if (membraneDist(x, z) < r + mem) return false;
    if (apron && apronDist(x, z) < r) return false;
    if (organelleDist(x, z) < r + org) return false;
    if (roadDist(x, z) < r + road) return false;
    if (this.padDist(x, z) < r + road - 0.2) return false;
    if (this.bldDist(x, z) < r + bld) return false;
    if (yard !== null && this.yardDist(x, z) < r + yard) return false;
    if (self && this.near(x, z, r)) return false;
    return true;
  }
}

// ---------------------------------------------------------------- build
export function buildProps(kit, roadInfo) {
  const group = new THREE.Group(); group.name = 'props';
  const mats = cityMaterials();
  const rnd = mulberry32(2024);
  const occ = new Occupancy(kit.footprints, roadInfo.pads, [...YARDS, ...roadInfo.docks]);

  const trees = [0, 1, 2, 3, 4, 5].map((v) => new Parts(treeGeo(v), mats.foliage, { cast: true, name: `trees${v}` }));
  const tufts = new Parts(tuftGeo(), mats.foliage, { name: 'groundCover' });
  const lamps = new Parts(lampGeo(), mats.metal, { cast: true, name: 'lamps' });
  const benches = new Parts(benchGeo(), mats.paint, { name: 'benches' });
  const bollards = new Parts(bollardGeo(), mats.paint, { name: 'bollards' });
  const planters = new Parts(planterGeo(), mats.foliage, { cast: true, name: 'planters' });
  const hedges = new Parts(hedgeGeo(), mats.foliage, { cast: true, name: 'hedges' });
  const crates = new Parts(crateGeo(), mats.paint, { cast: true, name: 'crates' });
  const barrels = new Parts(barrelGeo(), mats.metal, { cast: true, name: 'barrels' });
  const pallets = new Parts(palletGeo(), mats.paint, { name: 'pallets' });
  // parked vehicles reuse the traffic system's real models (merged + instanced)
  const parked = { forklift: vehicleParts('forklift'), flatbed: vehicleParts('flatbed') };
  const umbrellas = new Parts(umbrellaGeo(), mats.paint, { cast: true, name: 'umbrellas' });
  const bins = new Parts(binGeo(), mats.paint, { name: 'bins' });
  const hydrants = new Parts(hydrantGeo(), mats.paint, { name: 'hydrants' });
  const cones = new Parts(coneGeo(), mats.paint, { name: 'cones' });
  const discs = new Parts(new THREE.CylinderGeometry(1, 1, 1, 20), new THREE.MeshStandardMaterial({ map: manholeTexture(), metalness: 0.5, roughness: 0.55 }), { name: 'manholes' });
  const flanges = new Parts(new THREE.CylinderGeometry(1, 1, 1, 12), mats.metal, { name: 'flanges' });

  const tint = () => new THREE.Color().setHSL(0.17 + (rnd() - 0.5) * 0.16, 0.35, 0.86 + rnd() * 0.1);
  const addTree = (x, z, v = null, s = null, onLawn = false) => {
    if (v === null) { const r = rnd(); v = r < 0.3 ? 0 : r < 0.48 ? 1 : r < 0.6 ? 2 : r < 0.72 ? 3 : r < 0.86 ? 4 : 5; }
    s = s ?? 0.75 + rnd() * 0.5;
    trees[v].add(trs(x, 0, z, 0, rnd() * 6.28, 0, s, s * (0.88 + rnd() * 0.24), s), tint());
    if (onLawn) for (let k = 0; k < 3; k++) { const a = rnd() * 6.28, rr = 0.3 + rnd() * 0.3; tufts.add(trs(x + Math.cos(a) * rr, 0.12, z + Math.sin(a) * rr, 0, rnd() * 6, 0, 0.8 + rnd() * 0.5), rnd() < 0.3 ? FLOWERS[Math.floor(rnd() * FLOWERS.length)] : tint().multiplyScalar(0.8)); }
    occ.add(x, z, 0.45 * s);
    if (v !== 2) kit.footprints.push({ type: 'circle', x, z, r: 0.18 * s });
  };

  // ---- street lamps + roadside trees along every road chain ----
  for (const ch of roadInfo.chains) {
    const wAvg = ch.meta.reduce((a, m) => a + m.w, 0) / ch.meta.length;
    const lampStep = ch.kind === 'lane' ? 7 : 5.6;
    let k = 0;
    for (let s = 1.6; s < ch.len - 1.2; s += lampStep, k++) {
      const f = frameAt(ch.pts, s); const side = k % 2 ? 1 : -1;
      const off = wAvg / 2 + 0.36;
      const x = f.x + f.nx * side * off, z = f.z + f.nz * side * off;
      if (!occ.free(x, z, 0.15, { road: 0.18, bld: 0.2, org: 0.5, mem: 0.5, yard: null, apron: false })) continue;
      // arm points toward the road (local +Z) -> rotate so +Z = -side*n
      const ang = Math.atan2(-side * f.nx, -side * f.nz);
      lamps.add(trs(x, 0, z, 0, ang, 0));
      kit.glow.add(x - side * f.nx * 0.5, 2.15, z - side * f.nz * 0.5, 0.08, 0xffd59a, 3.6);
      occ.add(x, z, 0.2);
    }
    // trees: on sidewalks (walk) or verges
    const walk = ch.meta.some((m) => m.walk);
    const step = walk ? 2.8 : 3.4;
    for (let s = 2.2; s < ch.len - 1.6; s += step) {
      for (const side of [-1, 1]) {
        if (!walk && rnd() < 0.35) continue;
        const f = frameAt(ch.pts, s + rnd() * 0.4);
        const off = wAvg / 2 + (walk ? 0.68 : 0.95 + rnd() * 0.4);
        const x = f.x + f.nx * side * off, z = f.z + f.nz * side * off;
        if (!occ.free(x, z, 0.4, { road: walk ? 0.2 : 0.35, bld: 0.35 })) continue;
        addTree(x, z, walk ? (rnd() < 0.55 ? 0 : 1) : null, walk ? 0.75 + rnd() * 0.25 : null);
        if (walk) discs.add(trs(x, 0.117, z, 0, 0, 0, 0.17, 0.012, 0.17), new THREE.Color(0x4a4f58));
      }
    }
    // hedges on some verges of non-walk roads
    if (!walk && ch.kind !== 'lane') {
      for (let s = 2.5; s < ch.len - 2; s += 1.35) {
        if (Math.floor(s / 6) % 2) continue;
        const side = Math.floor(s / 12) % 2 ? 1 : -1;
        const f = frameAt(ch.pts, s); const off = wAvg / 2 + 0.85;
        const x = f.x + f.nx * side * off, z = f.z + f.nz * side * off;
        if (!occ.free(x, z, 0.45, { road: 0.3, bld: 0.3, yard: 0.2 })) continue;
        hedges.add(trs(x, 0, z, 0, Math.atan2(f.tx, f.tz) + Math.PI / 2, 0)); occ.add(x, z, 0.45);
      }
    }
    // manholes & drains on the asphalt
    for (let s = 3; s < ch.len - 2; s += 8.5) { const f = frameAt(ch.pts, s); discs.add(trs(f.x + f.nx * 0.45, Y_ROAD + 0.005, f.z + f.nz * 0.45, 0, 0, 0, 0.14, 0.01, 0.14), new THREE.Color(0x4a4f57)); }
    for (let s = 5; s < ch.len - 2; s += 7) { const f = frameAt(ch.pts, s); const o = (wAvg / 2 - 0.12) * (Math.floor(s) % 2 ? 1 : -1); kit.paint.add(rbox(0.32, 0.02, 0.14, 0.01), 0x2a2e35, trs(f.x + f.nx * o, Y_ROAD + 0.005, f.z + f.nz * o, 0, Math.atan2(f.tx, f.tz), 0)); }
  }

  // ---- direction signposts at main junctions ----
  const POSTS = { jM2: ['< MITO', 'NUCLEUS'], jG: ['GOLGI EXPORT', 'NUCLEUS'], jA: ['SER  >', 'NUCLEUS'], jF: ['WELCOME', 'PORT'], jC: ['SER  >', 'GOLGI EXPORT'], jM1: ['< MITO', 'NUCLEUS'] };
  for (const pad of roadInfo.pads) {
    const labels = POSTS[pad.id]; if (!labels) continue;
    for (let k = 0; k < 12; k++) {
      const a = k * 0.52 + 0.3, rr = pad.r + 0.55;
      const x = pad.x + Math.cos(a) * rr, z = pad.z + Math.sin(a) * rr;
      if (!occ.free(x, z, 0.2, { road: 0.15, bld: 0.2, org: 0.5, yard: null, apron: false })) continue;
      kit.metal.add(new THREE.CylinderGeometry(0.035, 0.045, 2.0, 8).translate(0, 1.0, 0), 0x6d7580, trs(x, 0, z));
      labels.forEach((t, i) => {
        const M = trs(x, 1.72 - i * 0.3, z, 0, a + Math.PI / 2 + i * 0.9, 0);
        kit.paint.add(rbox(1.0, 0.2, 0.04, 0.015).translate(0.45, 0, 0), 0x2a2d34, M);
        kit.signM(t, M, 0.45, 0, 0.022, 0.96, 0.16);
        kit.signM(t, M.clone().multiply(trs(0.9, 0, 0, 0, Math.PI, 0)), 0, 0, 0.022, 0.96, 0.16);
      });
      occ.add(x, z, 0.25);
      break;
    }
  }

  // ---- benches + bins along sidewalks ----
  for (const w of roadInfo.walks) {
    for (let i = 3; i < w.pts.length - 3; i += 11) {
      const p = w.pts[i], q = w.pts[i + 1];
      const tx = q.x - p.x, tz = q.z - p.z, l = Math.hypot(tx, tz) || 1; const nx = -tz / l, nz = tx / l;
      const o = w.off(i) + w.side * 0.62;
      const x = p.x + nx * o, z = p.z + nz * o;
      if (!occ.free(x, z, 0.4, { road: 0.6, bld: 0.25 })) continue;
      // bench faces the road: local -Z toward road... back rest at -Z, so +Z faces road
      benches.add(trs(x, 0, z, 0, Math.atan2(-w.side * nx, -w.side * nz), 0)); occ.add(x, z, 0.5);
      const bx = x + (tx / l) * 0.75, bz = z + (tz / l) * 0.75;
      if (occ.free(bx, bz, 0.14, { road: 0.5, bld: 0.2 })) { bins.add(trs(bx, 0, bz)); occ.add(bx, bz, 0.15); }
    }
  }

  // ---- building surrounds: planters flanking doors, crates & carts at depots, hydrants ----
  for (const b of BUILDINGS) {
    const c = Math.cos(b.rot), s = Math.sin(b.rot);
    const W = (lx, lz) => [b.x + lx * c + lz * s, b.z - lx * s + lz * c];
    if (b.style !== 'depot') {
      for (const sd of [-1, 1]) {
        const [x, z] = W(sd * 0.95, b.d / 2 + 0.45);
        if (occ.free(x, z, 0.35, { road: 0.15, bld: -0.05, yard: null })) { planters.add(trs(x, 0, z, 0, b.rot, 0)); occ.add(x, z, 0.4); }
      }
    } else {
      for (const sd of [-1, 1]) {
        const [x, z] = W(sd * (b.w / 2 + 0.55), b.d / 2 - 0.2);
        stack(x, z, b.rot);
      }
      const [cx, cz] = W(b.w / 2 + 0.9, -0.2);
      if (rnd() < 0.45 && occ.free(cx, cz, 0.95, { road: 0.2, bld: 0.1 })) { parked.forklift.add(trs(cx, 0, cz, 0, b.rot + (rnd() - 0.5) * 0.3, 0), LIVERY[Math.floor(rnd() * LIVERY.length)]); occ.add(cx, cz, 1.0); kit.footprints.push({ type: 'circle', x: cx, z: cz, r: 0.8 }); }
    }
    for (const sd of [-1, 1]) if (rnd() < 0.7) { const [x, z] = W(sd * (b.w / 2 + 0.6), -b.d * 0.2); stack(x, z, b.rot); }
    {
      const [x, z] = W(0, -b.d / 2 - 0.55);
      if (rnd() < 0.6 && occ.free(x, z, 0.35, { road: 0.15, bld: 0.05, yard: null })) { kit.parts.ac.add(trs(x, 0, z, 0, b.rot, 0, 1.15)); occ.add(x, z, 0.4); }
    }
    const [hx, hz] = W(-b.w / 2 - 0.35, b.d / 2 + 0.25);
    if (rnd() < 0.5 && occ.free(hx, hz, 0.1, { road: 0.15, bld: 0.05 })) { hydrants.add(trs(hx, 0, hz)); occ.add(hx, hz, 0.12); }
  }

  function stack(x, z, rot) {
    if (!occ.free(x, z, 0.6, { road: 0.15, bld: 0.05, yard: null })) return false;
    const r = rnd();
    if (r < 0.45) {
      pallets.add(trs(x, 0, z, 0, rot, 0));
      const tint = new THREE.Color([0xc8955a, 0x5aa0d8, 0xe56a3a, 0x9a6ad8, 0x66b85a][Math.floor(rnd() * 5)]);
      crates.add(trs(x - 0.19 * Math.cos(rot), 0.3, z + 0.19 * Math.sin(rot), 0, rot + rnd() * 0.3, 0), tint);
      crates.add(trs(x + 0.19 * Math.cos(rot), 0.3, z - 0.19 * Math.sin(rot), 0, rot, 0), tint.clone().offsetHSL(0, 0, 0.06));
      if (rnd() < 0.6) crates.add(trs(x, 0.66, z, 0, rot + 0.4, 0), tint.clone().offsetHSL(0.02, 0, -0.05));
    } else if (r < 0.8) {
      const col = new THREE.Color([0x2f78e0, 0xe0423a, 0xf4c21f, 0x1fb3a8][Math.floor(rnd() * 4)]);
      for (const [dx, dz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) if (rnd() < 0.85) barrels.add(trs(x + dx, 0.24, z + dz, 0, rnd() * 3, 0), col);
    } else {
      pallets.add(trs(x, 0, z, 0, rot, 0)); pallets.add(trs(x, 0.125, z, 0, rot + 0.1, 0)); pallets.add(trs(x, 0.25, z, 0, rot - 0.05, 0));
    }
    occ.add(x, z, 0.6); kit.footprints.push({ type: 'circle', x, z, r: 0.5 });
    return true;
  }

  // ---- loading yards: carts in bays, stacks, bollards, cones ----
  for (const y of YARDS) {
    const c = Math.cos(y.rot), s = Math.sin(y.rot);
    const W = (lx, lz) => [y.x + lx * c + lz * s, y.z - lx * s + lz * c];
    const bw = (y.w - 0.3) / y.bays;
    for (let k = 0; k < y.bays; k++) {
      const lx = -y.w / 2 + 0.15 + (k + 0.5) * bw;
      const [x, z] = W(lx, 0);
      if (k === 0) { (y.d >= 2.0 ? parked.flatbed : parked.forklift).add(trs(x, 0.075, z, 0, y.rot + (rnd() - 0.5) * 0.12, 0), LIVERY[Math.floor(rnd() * LIVERY.length)]); kit.footprints.push({ type: 'circle', x, z, r: 0.75 }); }
      else if (rnd() < 0.7) { const [sx, sz] = W(lx, -0.2); pallets.add(trs(sx, 0.07, sz, 0, y.rot, 0)); crates.add(trs(sx, 0.37, sz, 0, y.rot + 0.2, 0), new THREE.Color(0xc8955a)); }
      occ.add(x, z, 0.6);
    }
    for (const sd of [-1, 1]) { const [x, z] = W(sd * (y.w / 2 + 0.25), y.d / 2 - 0.1); bollards.add(trs(x, 0, z)); }
    const [cx, cz] = W(y.w / 2 + 0.3, -y.d / 2 + 0.3); cones.add(trs(cx, 0, cz)); const [cx2, cz2] = W(y.w / 2 + 0.55, -y.d / 2 + 0.6); cones.add(trs(cx2, 0, cz2));
    for (let k = 0; k < 3; k++) { const [x, z] = W(-y.w / 2 - 0.8 - k * 0.0, -y.d / 2 + 0.45 + k * 0.85); stack(x, z, y.rot); }
  }

  // ---- boulevard medians: clipped hedge rows on the raised islands ----
  for (const m of roadInfo.medians) {
    let acc = 0;
    for (let i = 1; i < m.pts.length; i++) {
      acc += Math.hypot(m.pts[i].x - m.pts[i - 1].x, m.pts[i].z - m.pts[i - 1].z);
      if (acc < 0.95) continue; acc = 0;
      const p = m.pts[i];
      hedges.add(trs(p.x, 0.1, p.z, 0, Math.atan2(p.tx, p.tz) + Math.PI / 2, 0, 0.75, 0.55, 0.42));
    }
  }

  // ---- SER service yard on the strip between the SER, the rough ER and the membrane ----
  serServiceYard(kit, occ);

  // ---- organelle aprons: concrete plinth rings + fence lines with an opening toward the street ----
  organelleAprons(kit, occ);

  // ---- hedges / ground cover hugging building flanks ----
  for (const b of BUILDINGS) {
    if (b.style === 'tanks' || b.style === 'containers') continue;
    const c = Math.cos(b.rot), s = Math.sin(b.rot);
    const W = (lx, lz) => [b.x + lx * c + lz * s, b.z - lx * s + lz * c];
    for (const sd of [-1, 1]) {
      if (rnd() < 0.4) continue;
      for (let lz = -b.d / 2 + 0.5; lz < b.d / 2 - 0.3; lz += 1.0) {
        const [x, z] = W(sd * (b.w / 2 + 0.38), lz);
        if (!occ.free(x, z, 0.3, { road: 0.2, bld: 0.05, yard: 0.1 })) continue;
        if (rnd() < 0.5) { hedges.add(trs(x, 0, z, 0, b.rot + Math.PI / 2, 0, 0.75)); occ.add(x, z, 0.4); }
        else {
          // flower bed: low kerb box with soil and a row of blooms
          const M = trs(x, 0, z, 0, b.rot + Math.PI / 2, 0);
          kit.paint.add(rbox(0.85, 0.14, 0.38, 0.03).translate(0, 0.07, 0), 0xc4c8cd, M);
          kit.paint.add(new THREE.BoxGeometry(0.77, 0.02, 0.3).translate(0, 0.14, 0), 0x5a3f2c, M);
          const fc = FLOWERS[Math.floor(rnd() * FLOWERS.length)];
          for (let q = -1; q <= 1; q++) tufts.add(M.clone().multiply(trs(q * 0.25, 0.12, 0, 0, rnd() * 6, 0, 0.75)), q === 0 ? tint().multiplyScalar(0.8) : fc);
          occ.add(x, z, 0.45);
        }
      }
    }
  }

  // ---- membrane-side pipe runs ----
  // ---- south strip just inside the front membrane: hedge rows, planters, shrubs and lamps ----
  {
    const strip = cellContour(-1.7, 720);
    let k = 0;
    for (const p of strip) {
      const a = Math.atan2(p.z, p.x); if (a < 0.62 || a > 2.55) continue; // front arc only
      if (k++ % 2) continue;
      if (!occ.free(p.x, p.z, 0.35, { road: 0.3, bld: 0.3, org: 0.9, mem: 0.4, yard: 0.2 })) continue;
      const r = rnd(), tan = Math.atan2(-p.x, p.z);
      if (r < 0.45) { hedges.add(trs(p.x, 0, p.z, 0, tan + Math.PI / 2, 0, 0.9)); occ.add(p.x, p.z, 0.5); }
      else if (r < 0.65) { planters.add(trs(p.x, 0, p.z, 0, tan + Math.PI / 2, 0)); occ.add(p.x, p.z, 0.5); }
      else if (r < 0.85) addTree(p.x, p.z, rnd() < 0.5 ? 3 : 4, 0.8 + rnd() * 0.3);
      else { lamps.add(trs(p.x, 0, p.z, 0, Math.atan2(-p.x, -p.z), 0)); const L = Math.hypot(p.x, p.z) || 1; kit.glow.add(p.x - p.x / L * 0.5, 2.15, p.z - p.z / L * 0.5, 0.08, 0xffd59a, 3.6); occ.add(p.x, p.z, 0.3); }
    }
  }

  const pipeRuns = membranePipes(kit, occ, flanges);
  for (const run of pipeRuns) for (let i = 0; i < run.length; i += 3) kit.footprints.push({ type: 'circle', x: run[i].x, z: run[i].z, r: 0.4 });

  // ---- lawns with tree clusters, benches and cafe umbrellas in open plaza space ----
  const lawnGeos = [], lawnEdge = [];
  const spots = [];
  for (let z = -46; z <= 46; z += 1.1) for (let x = -28; x <= 28; x += 1.1) {
    const jx = x + (rnd() - 0.5) * 0.6, jz = z + (rnd() - 0.5) * 0.6;
    spots.push([jx, jz, rnd()]);
  }
  spots.sort((a, b) => a[2] - b[2]);
  let lawns = 0;
  for (const [x, z] of spots) {
    if (lawns > 34) break;
    const r = 1.1 + rnd() * 0.9;
    if (!occ.free(x, z, r, { road: 0.35, bld: 0.45, org: 0.9, mem: 0.8, yard: 0.4 })) continue;
    lawns++;
    const sx = r * (1 + rnd() * 0.5), sz = r * (0.75 + rnd() * 0.3), rot = rnd() * Math.PI;
    lawnBed(lawnGeos, lawnEdge, x, z, sx, sz, rot);
    occ.add(x, z, Math.max(sx, sz) * 0.6);
    const nT = 2 + Math.floor(rnd() * 3);
    for (let k = 0; k < nT; k++) {
      const a = rnd() * 6.28, rr = rnd() * 0.55;
      const tx = x + Math.cos(a) * sx * rr * Math.cos(rot) - Math.sin(a) * sz * rr * Math.sin(rot);
      const tz = z + Math.cos(a) * sx * rr * Math.sin(rot) + Math.sin(a) * sz * rr * Math.cos(rot);
      if (!occ.near(tx, tz, 0.35) || k === 0) addTree(tx, tz, null, 0.9 + rnd() * 0.5, true);
    }
    if (rnd() < 0.5) {
      const a = rnd() * 6.28; const bx = x + Math.cos(a) * (Math.max(sx, sz) + 0.55), bz = z + Math.sin(a) * (Math.max(sx, sz) + 0.55);
      if (occ.free(bx, bz, 0.45, { road: 0.4, bld: 0.3 })) { benches.add(trs(bx, 0, bz, 0, Math.atan2(bx - x, bz - z), 0)); occ.add(bx, bz, 0.5); }
    }
  }
  // free-standing trees & planters to densify open pavement
  let extra = 0;
  for (const [x, z] of spots) {
    if (extra > 170) break;
    if (!occ.free(x, z, 0.5, { road: 0.45, bld: 0.45, org: 1.0, mem: 0.8, yard: 0.3 })) continue;
    if (rnd() < 0.55) addTree(x, z); else { planters.add(trs(x, 0, z, 0, rnd() * 3, 0)); occ.add(x, z, 0.5); }
    extra++;
  }
  // cafe umbrellas near the gate plaza & front quarter
  const cafe = [[-1.2, 39.6], [0.8, 40.6], [6.4, 39.8], [-9.2, 39.0], [17.6, 41.2], [20.6, 36.6]];
  const ucol = [0xff5d5d, 0x2f9be0, 0xf4c21f, 0x1fb3a8, 0xff8a3d];
  cafe.forEach(([x, z], i) => { if (occ.free(x, z, 0.6, { road: 0.2, bld: 0.25, self: false })) { umbrellas.add(trs(x, 0, z, 0, i, 0), new THREE.Color(ucol[i % ucol.length])); occ.add(x, z, 0.7); kit.footprints.push({ type: 'circle', x, z, r: 0.35 }); } });

  if (lawnGeos.length) {
    const lawnMat = new THREE.MeshStandardMaterial({ map: lawnTexture(), roughness: 0.92, color: 0xffffff });
    const lm = new THREE.Mesh(mergeGeometries(lawnGeos), lawnMat); lm.receiveShadow = true; lm.name = 'lawns'; group.add(lm);
    for (const g of lawnEdge) kit.paint.add(g, 0xd5d9de);
  }

  for (const p of [...trees, tufts, lamps, benches, bollards, planters, hedges, crates, barrels, pallets, parked.forklift, parked.flatbed, umbrellas, bins, hydrants, cones, discs, flanges]) { const m = p.mesh(); if (m) group.add(m); }
  return group;
}

function lawnBed(geos, edges, x, z, sx, sz, rot) {
  // rounded-rect lawn (superellipse) with a pale raised edge
  const shape = new THREE.Shape(); const n = 40;
  const pts = [];
  for (let i = 0; i < n; i++) { const t = (i / n) * Math.PI * 2; const c = Math.cos(t), s = Math.sin(t); pts.push([sx * Math.sign(c) * Math.abs(c) ** 0.6, sz * Math.sign(s) * Math.abs(s) ** 0.6]); }
  pts.forEach(([a, b], i) => (i ? shape.lineTo(a, b) : shape.moveTo(a, b)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: 0.12, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.03, bevelSegments: 2, curveSegments: 4 });
  g.rotateX(-Math.PI / 2); g.rotateY(rot); g.translate(x, 0, z);
  const uv = g.attributes.uv, p = g.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / 3, p.getZ(i) / 3);
  geos.push(g.index ? g.toNonIndexed() : g);
  // edge kerb ring
  const ring = new THREE.Shape(); const outer = pts.map(([a, b]) => [a * (1 + 0.16 / sx), b * (1 + 0.16 / sz)]);
  outer.forEach(([a, b], i) => (i ? ring.lineTo(a, b) : ring.moveTo(a, b)));
  const hole = new THREE.Path(); [...pts].reverse().forEach(([a, b], i) => (i ? hole.lineTo(a, b) : hole.moveTo(a, b))); ring.holes.push(hole);
  const rg = new THREE.ExtrudeGeometry(ring, { depth: 0.2, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2, curveSegments: 4 });
  rg.rotateX(-Math.PI / 2); rg.rotateY(rot); rg.translate(x, 0, z);
  edges.push(rg);
}

/** Pipe pairs on saddles running just inside the membrane wherever there is room. */
function membranePipes(kit, occ, flanges) {
  const inner = cellContour(-1.55, 520);
  const gateAng = GATES.map((g) => g.angle);
  const ok = inner.map((p) => {
    const a = Math.atan2(p.z, p.x);
    if (gateAng.some((g) => Math.abs(Math.atan2(Math.sin(a - g), Math.cos(a - g))) < 0.13)) return false;
    return organelleDist(p.x, p.z) > 0.75 && roadDist(p.x, p.z) > 0.55 && occ.bldDist(p.x, p.z) > 0.45 && occ.padDist(p.x, p.z) > 0.3;
  });
  const runs = []; let cur = [];
  for (let i = 0; i < inner.length; i++) { if (ok[i]) cur.push(inner[i]); else { if (cur.length) runs.push(cur); cur = []; } }
  if (cur.length) { if (ok[0] && runs.length) runs[0] = [...cur, ...runs[0]]; else runs.push(cur); }
  const out = [];
  const pal = [0x1fb3a8, 0xff8a3d, 0x9156e0, 0x5cb83a];
  runs.forEach((run, ri) => {
    const pts = run.slice(1, -1); if (pts.length < 10) return;
    out.push(pts);
    const c1 = 0xcfd6de, c2 = pal[ri % pal.length];
    for (const [off, r, y, col] of [[0.0, 0.15, 0.36, c1], [0.34, 0.1, 0.3, c2]]) {
      const v = pts.map((p, i) => {
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
        let tx = b.x - a.x, tz = b.z - a.z; const l = Math.hypot(tx, tz) || 1;
        return new THREE.Vector3(p.x - (tz / l) * off * -1, y, p.z + (tx / l) * off * -1);
      });
      const curve = new THREE.CatmullRomCurve3(v);
      kit.metal.add(new THREE.TubeGeometry(curve, Math.max(8, v.length * 2), r, 8, false), col);
      // flanges & saddles
      const L = curve.getLength();
      for (let s = 0.8; s < L - 0.5; s += 2.2) {
        const t = s / L; const p = curve.getPointAt(t), d = curve.getTangentAt(t);
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
        flanges.add(new THREE.Matrix4().compose(p, q, new THREE.Vector3(r + 0.05, 0.06, r + 0.05)));
        if (off === 0) kit.paint.add(rbox(0.62, y - 0.05, 0.16, 0.03), 0x7c8591, trs(p.x - (d.z) * 0.17 * -1, (y - 0.05) / 2, p.z + d.x * 0.17 * -1, 0, Math.atan2(d.x, d.z), 0));
      }
    }
  });
  return out;
}

/** Concrete apron ring + fence around each round district (lysosomes, vacuoles), open toward the nearest road. */
function organelleAprons(kit, occ) {
  const circles = LIVE_FOOTPRINTS.filter((f) => f.type === 'circle' && (f.src === 'lysosomes' || f.src === 'vacuoles'));
  const N = 72;
  circles.forEach((f, ci) => {
    const r0 = f.r + 0.04, r1 = f.r + 0.95, y = 0.03 + ci * 0.002;
    // opening toward the nearest road node
    let best = null, bd = Infinity; for (const n of NETWORK.nodes) { const d = Math.hypot(n.x - f.x, n.z - f.z); if (d < bd) { bd = d; best = n; } }
    const openA = Math.atan2(best.z - f.z, best.x - f.x);
    const ok = [];
    for (let k = 0; k <= N; k++) {
      const a = (k / N) * Math.PI * 2, x = f.x + Math.cos(a) * r1, z = f.z + Math.sin(a) * r1;
      const others = circles.filter((q) => q !== f).every((q) => Math.hypot(x - q.x, z - q.z) > q.r + 1.0);
      ok.push(roadDist(x, z) > 0.15 && membraneDist(x, z) > 0.2 && others && occ.bldDist(x, z) > 0.1);
    }
    const pos = [], nor = [], uv = [];
    const push = (a, r, yy, nx = 0, ny = 1, nz = 0) => { pos.push(f.x + Math.cos(a) * r, yy, f.z + Math.sin(a) * r); nor.push(nx, ny, nz); uv.push(0, 0); };
    for (let k = 0; k < N; k++) {
      if (!ok[k] || !ok[k + 1]) continue;
      const a0 = (k / N) * Math.PI * 2, a1 = ((k + 1) / N) * Math.PI * 2;
      // top (CCW in atan2 order -> (inner0, inner1, outer0) faces down, so wind the other way)
      push(a0, r0, y); push(a1, r0, y); push(a1, r1, y);
      push(a0, r0, y); push(a1, r1, y); push(a0, r1, y);
      // outer skirt
      const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
      push(a0, r1, y, c0, 0, s0); push(a1, r1, y, c1, 0, s1); push(a1, r1, 0, c1, 0, s1);
      push(a0, r1, y, c0, 0, s0); push(a1, r1, 0, c1, 0, s1); push(a0, r1, 0, c0, 0, s0);
    }
    if (pos.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      kit.paint.add(g, 0xc3c8ce);
    }
    // fence: posts every ~0.5u on the outer rim, two rails, opening ±0.42 rad toward the street
    const rf = r1 - 0.06, step = 0.5 / rf;
    let prev = null;
    const railCol = f.src === 'lysosomes' ? 0x5fae3e : 0x3fb6c8;
    for (let a = 0; a <= Math.PI * 2 + 1e-3; a += step) {
      const k = Math.round((a / (Math.PI * 2)) * N) % N;
      const da = Math.abs(Math.atan2(Math.sin(a - openA), Math.cos(a - openA)));
      if (!ok[k] || da < 0.42) { prev = null; continue; }
      const x = f.x + Math.cos(a) * rf, z = f.z + Math.sin(a) * rf;
      kit.metal.add(new THREE.CylinderGeometry(0.022, 0.026, 0.62, 6).translate(x, 0.34, z), 0x6d7580);
      if (prev) for (const [yy, col] of [[0.6, railCol], [0.36, 0xb9c0c8]]) {
        const L = Math.hypot(x - prev.x, z - prev.z); const r = new THREE.CylinderGeometry(0.016, 0.016, L, 5); r.rotateZ(Math.PI / 2); r.rotateY(-Math.atan2(z - prev.z, x - prev.x));
        kit.metal.add(r.translate((x + prev.x) / 2, yy, (z + prev.z) / 2), col);
      }
      prev = { x, z };
    }
  });
}

/** Instanced parked vehicle built from vehicles.js createVehicle(type) (body + wheels merged; decals dropped). */
function vehicleParts(type) {
  const v = createVehicle(type); v.updateMatrixWorld(true);
  const geos = []; let mat = null;
  v.traverse((o) => { if (o.isMesh && !o.material.map) { const g = o.geometry.clone().applyMatrix4(o.matrixWorld); geos.push(g.index ? g.toNonIndexed() : g); mat = mat || o.material; } });
  const common = Object.keys(geos[0].attributes).filter((k) => geos.every((g) => g.attributes[k] && g.attributes[k].itemSize === geos[0].attributes[k].itemSize));
  for (const g of geos) for (const k of Object.keys(g.attributes)) if (!common.includes(k)) g.deleteAttribute(k);
  // parked fleet uses a neutral livery: repaint the yellow body panels white (instance tint adds grey/blue variety)
  for (const g of geos) { const c = g.attributes.color; if (!c) continue; for (let i = 0; i < c.count; i++) { const r = c.getX(i), gg = c.getY(i), b = c.getZ(i); if (r > 0.45 && gg > 0.25 && b < 0.2 && r > b * 3) c.setXYZ(i, 0.86, 0.87, 0.88); } }
  return new Parts(mergeGeometries(geos), mat, { cast: true, name: `parked-${type}` });
}

/**
 * SER service yard: searches the free strip behind the smooth ER (clear of the SER box, the rough-ER circle and
 * the membrane) for the largest oriented apron, then dresses it: concrete apron with a painted service loop,
 * a twin tank cluster with pump skid, a fence line on the SER side and a pipe rack running along the membrane.
 */
function serServiceYard(kit, occ) {
  const free = (x, z, m = 0.9) => organelleDist(x, z) > m && membraneDist(x, z) > 0.6 && roadDist(x, z) > 0.4;
  let best = null;
  for (let cx = 22; cx <= 29; cx += 0.4) for (let cz = -27; cz <= -13; cz += 0.4) for (let rot = -1.2; rot <= 1.2; rot += 0.15) for (const [w, d] of [[5, 3], [4.6, 2.8], [4.2, 2.6], [3.8, 2.4], [3.4, 2.2], [3, 2]]) {
    if (best && w * d <= best.w * best.d) continue;
    const c = Math.cos(rot), s = Math.sin(rot); let ok = true;
    for (let i = 0; i <= 6 && ok; i++) for (let j = 0; j <= 4 && ok; j++) { const lx = (i / 6 - 0.5) * w, lz = (j / 4 - 0.5) * d; if (!free(cx + lx * c + lz * s, cz - lx * s + lz * c)) ok = false; }
    if (ok) best = { x: cx, z: cz, w, d, rot };
  }
  if (!best) return;
  const { x, z, w, d, rot } = best; const B = trs(x, 0, z, 0, rot, 0);
  const P = (g, c) => kit.paint.add(g, c, B), Mt = (g, c) => kit.metal.add(g, c, B);
  P(rbox(w, 0.08, d, 0.03).translate(0, 0.03, 0), 0xc9cdd2);
  // painted service loop (yellow dashed oval) + hatched end
  for (let k = 0; k < 22; k++) { const a = (k / 22) * Math.PI * 2; const ex = Math.cos(a) * (w / 2 - 0.45), ez = Math.sin(a) * (d / 2 - 0.4); const g = new THREE.BoxGeometry(0.22, 0.01, 0.05); g.rotateY(-a + Math.PI / 2); P(g.translate(ex, 0.075, ez), 0xf2c21f); }
  // twin tanks + pump skid at the +X end
  for (const [tx, tz] of [[w / 2 - 0.7, -d / 4], [w / 2 - 0.7, d / 4]]) {
    const r = Math.min(0.5, d / 4 - 0.05), th = 1.6;
    Mt(new THREE.CylinderGeometry(r, r, th, 22).translate(tx, th / 2 + 0.07, tz), 0xe6eaee);
    Mt(new THREE.SphereGeometry(r, 22, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(tx, th + 0.07, tz), 0xe6eaee);
    for (const y of [0.4, 1.05]) Mt(new THREE.TorusGeometry(r + 0.015, 0.03, 5, 22).rotateX(Math.PI / 2).translate(tx, y, tz), 0x7f9a2a);
    kit.glow.add(...[0, 0, 0].map((_, i) => new THREE.Vector3(tx, th + r + 0.1, tz).applyMatrix4(B).toArray()[i]), 0.04, 0xff3a2a, 5, 0.8);
  }
  P(rbox(0.6, 0.38, 0.45, 0.03).translate(-w / 2 + 0.6, 0.26, -d / 2 + 0.45), 0x5d6672);
  Mt(new THREE.CylinderGeometry(0.06, 0.06, w - 1.4, 8).rotateZ(Math.PI / 2).translate(0, 0.42, -d / 2 + 0.35), 0x7f9a2a);
  // fence along the edge facing the SER
  const serSide = (() => { const p1 = new THREE.Vector3(0, 0, d / 2).applyMatrix4(B), p2 = new THREE.Vector3(0, 0, -d / 2).applyMatrix4(B); return organelleDist(p1.x, p1.z) < organelleDist(p2.x, p2.z) ? 1 : -1; })();
  for (let lx = -w / 2 + 0.1; lx <= w / 2 - 0.1; lx += 0.5) Mt(new THREE.CylinderGeometry(0.02, 0.024, 0.6, 5).translate(lx, 0.36, serSide * (d / 2 - 0.06)), 0x6d7580);
  for (const [yy, col] of [[0.62, 0x7f9a2a], [0.38, 0xb9c0c8]]) Mt(new THREE.CylinderGeometry(0.014, 0.014, w - 0.2, 5).rotateZ(Math.PI / 2).translate(0, yy, serSide * (d / 2 - 0.06)), col);
  // pipe rack: H-frames every 1.1u along the long edge, three pipes on top running past the apron ends
  const rackZ = -serSide * (d / 2 - 0.25);
  for (let lx = -w / 2 + 0.3; lx <= w / 2 - 0.2; lx += 1.1) {
    for (const s of [-0.18, 0.18]) Mt(new THREE.BoxGeometry(0.05, 1.2, 0.05).translate(lx, 0.6, rackZ + s), 0x8a939d);
    Mt(new THREE.BoxGeometry(0.06, 0.05, 0.48).translate(lx, 1.18, rackZ), 0x8a939d);
  }
  [[0x1fb3a8, -0.12], [0xcfd6de, 0], [0xff8a3d, 0.12]].forEach(([c, o]) => Mt(new THREE.CylinderGeometry(0.045, 0.045, w - 0.2, 8).rotateZ(Math.PI / 2).translate(0, 1.26, rackZ + o), c));
  occ.add(x, z, Math.max(w, d) * 0.55);
  kit.footprints.push({ type: 'box', x, z, w: w + 0.1, d: d + 0.1, rot, id: 'serYard' });
  kit.anchors.serServiceYard = [x, 0, z];
}
