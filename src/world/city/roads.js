// Road surfaces: warm asphalt carriageways (UV along length), filleted junction pads built from the road
// mouths, painted markings (dashes, edge lines, zebras, stop bars, arrows), loading docks and yards.
//
// Sidewalks and curbs are NOT swept per road. They are extracted from 2D distance fields sampled on a fine
// grid, so every junction gets one continuous surface with correct geometry:
//   Da = signed distance to the asphalt actually rendered (strip quads ∪ junction pads)
//   Dw = distance to the parts of the asphalt that carry a footway (walk roads + their junction corners)
//   sidewalk = { WALK_IN < Da } ∩ { Dw < WALK_OUT } minus organelles / membrane / yards / open road ends
//   curb     = the Da = CURB_W/2 iso-line (one continuous curb per asphalt boundary, cut at open ends)
// Offsetting the asphalt union (instead of sweeping strips) means corner returns are always rounded the
// right way, sidewalks can never lie on asphalt or overlap each other, and curbs never double up.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { NETWORK } from './network.js';
import { YARDS } from './plan.js';
import { sweepXZ, mergeGeometries } from '../../core/geom.js';
import { organelleDist, membraneDist } from './obstacles.js';
import { paintAtlas, PAINT_UV, paverTexture, concreteTexture, asphaltSet } from './citytex.js';

// Vertical layering (top faces): ground 0 < asphalt Y_ROAD < paint (+0.004/5, polygonOffset) < dock pads 0.06 <
// yards 0.07 < sidewalk slab Y_WALK < curb top CURB_H. Sidewalks are one non-overlapping mesh at a single height.
export const Y_ROAD = 0.035;
export const Y_WALK = 0.115;
const CURB_H = 0.12, CURB_W = 0.14;
const WALK_IN = CURB_W / 2;          // slab starts under the curb (no crack between curb and pavers)
const WALK_OUT = CURB_W + 0.85;      // outer sidewalk edge, measured from the asphalt edge
const GRID = 0.1;                    // field sample spacing (world units)
const BEND_PAD = 60 * Math.PI / 180; // degree-2 turns sharper than this get a junction pad
const PAINTED = new Set(['spine', 'main', 'ring', 'street', 'avenue']);
const norm = (x, z) => { const l = Math.hypot(x, z) || 1; return { x: x / l, z: z / l }; };

// ---------- chains: edges merged through degree-2 nodes ----------
function buildChains() {
  const nodes = new Map(NETWORK.nodes.map((n) => [n.id, n]));
  const used = new Set();
  const inc = new Map(NETWORK.nodes.map((n) => [n.id, []]));
  NETWORK.edges.forEach((e, i) => { inc.get(e.a).push(i); inc.get(e.b).push(i); });
  // Degree-2 nodes normally pass straight through (one continuous ribbon). A sharp elbow (jC, the back-yard lane)
  // instead becomes a junction pad: sweeping a ribbon round a radius tighter than its half width folds it onto itself.
  const turn = (id) => {
    const n = nodes.get(id); const dirs = inc.get(id).map((ei) => { const e = NETWORK.edges[ei]; const p = e.a === id ? e.pts : [...e.pts].reverse(); const q = p[Math.min(4, p.length - 1)]; return Math.atan2(q.z - n.z, q.x - n.x); });
    let d = Math.abs(dirs[0] - dirs[1]); if (d > Math.PI) d = Math.PI * 2 - d; return Math.PI - d;
  };
  const isBreak = (id) => { const n = nodes.get(id); return n.degree !== 2 || n.kind === 'gate' || n.kind === 'ramp' || turn(id) > BEND_PAD; };
  const chains = [];
  const walk = (startNode, ei) => {
    const pts = [], meta = [], joins = []; let cur = startNode, e = ei; const kinds = [];
    for (;;) {
      used.add(e); const E = NETWORK.edges[e]; kinds.push(E.kind);
      const fwd = E.a === cur; const ep = fwd ? E.pts : [...E.pts].reverse();
      if (pts.length) joins.push(pts.length - 1);
      ep.forEach((p, k) => { if (pts.length && k === 0) return; pts.push({ x: p.x, z: p.z }); meta.push({ w: E.w, walk: E.walk, kind: E.kind }); });
      cur = fwd ? E.b : E.a;
      if (isBreak(cur)) break;
      const next = inc.get(cur).find((j) => !used.has(j));
      if (next === undefined) break;
      e = next;
    }
    // each edge is its own Catmull-Rom span, so the merged centre line has a tangent kink at every pass-through
    // node; relax it locally (a few cm) so ribbons, kerbs and paint don't crease there
    for (let it = 0; it < 6; it++) for (const j of joins) {
      const c = pts.map((p) => ({ ...p }));
      for (let i = Math.max(1, j - 8); i <= Math.min(pts.length - 2, j + 8); i++) { pts[i].x = 0.25 * c[i - 1].x + 0.5 * c[i].x + 0.25 * c[i + 1].x; pts[i].z = 0.25 * c[i - 1].z + 0.5 * c[i].z + 0.25 * c[i + 1].z; }
    }
    const w = meta.map((m) => m.w);
    meta.forEach((m, i) => { let s = 0; for (let k = -4; k <= 4; k++) s += w[Math.min(w.length - 1, Math.max(0, i + k))]; m.w = s / 9; });
    chains.push({ a: startNode, b: cur, pts, meta, kind: kinds[0] });
  };
  for (const n of NETWORK.nodes) if (isBreak(n.id)) for (const ei of inc.get(n.id)) if (!used.has(ei)) walk(n.id, ei);
  NETWORK.edges.forEach((e, i) => { if (!used.has(i)) walk(e.a, i); });
  return { chains, nodes };
}

function cumLen(pts) { const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z)); return L; }

/** Point/tangent/left-normal at arclength s (extrapolates straight beyond both ends). */
export function frameAt(pts, s) {
  const L = cumLen(pts); const tot = L[L.length - 1];
  if (s <= 0 || s >= tot) {
    const [a, b] = s <= 0 ? [pts[0], pts[1]] : [pts[pts.length - 2], pts[pts.length - 1]];
    const d = norm(b.x - a.x, b.z - a.z); const o = s <= 0 ? pts[0] : pts[pts.length - 1]; const k = s <= 0 ? s : s - tot;
    return { x: o.x + d.x * k, z: o.z + d.z * k, tx: d.x, tz: d.z, nx: -d.z, nz: d.x };
  }
  let i = 1; while (i < pts.length - 1 && L[i] < s) i++;
  const t = (s - L[i - 1]) / (L[i] - L[i - 1] || 1);
  const d = norm(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
  return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t, z: pts[i - 1].z + (pts[i].z - pts[i - 1].z) * t, tx: d.x, tz: d.z, nx: -d.z, nz: d.x };
}

/** Resample a polyline between arclengths s0..s1 at ~step spacing; returns frames. */
function frames(pts, s0, s1, step = 0.35) {
  const n = Math.max(1, Math.ceil((s1 - s0) / step)); const out = [];
  for (let i = 0; i <= n; i++) { const s = s0 + (s1 - s0) * i / n; out.push({ ...frameAt(pts, s), s }); }
  return out;
}

// ---------- geometry builders ----------
class Geo {
  constructor() { this.p = []; this.n = []; this.uv = []; this.i = []; }
  v(x, y, z, u, w, nx = 0, ny = 1, nz = 0) { this.p.push(x, y, z); this.n.push(nx, ny, nz); this.uv.push(u, w); return this.p.length / 3 - 1; }
  tri(a, b, c) { this.i.push(a, b, c); }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.i); return g;
  }
}

/** Up-facing strip between lateral offsets uL(i)..uR(i) (left normal positive) at height y. */
function strip(G, F, uL, uR, y, uvFn) {
  const base = G.p.length / 3;
  F.forEach((f, i) => {
    const a = uL(i, f), b = uR(i, f);
    const [ua, va] = uvFn(i, f, 0), [ub, vb] = uvFn(i, f, 1);
    G.v(f.x + f.nx * a, y, f.z + f.nz * a, ua, va);
    G.v(f.x + f.nx * b, y, f.z + f.nz * b, ub, vb);
  });
  for (let i = 0; i < F.length - 1; i++) {
    const A = base + i * 2, B = A + 2;
    G.tri(A, B, A + 1); G.tri(A + 1, B, B + 1);
  }
}

/** Low rectangular curb with a small bevel, swept along a path of {x,z} with per-point height factor. */
function curbAlong(path, hFn = () => 1, closed = false) {
  // square curb, 0.02 bevel; corner points duplicated so faces stay flat-shaded (no 'bumper' look)
  const b = 0.02, hw = CURB_W / 2;
  const prof = [[hw, 0], [hw, CURB_H - b], [hw, CURB_H - b], [hw - b, CURB_H], [hw - b, CURB_H], [-hw + b, CURB_H], [-hw + b, CURB_H], [-hw, CURB_H - b], [-hw, CURB_H - b], [-hw, 0]];
  return sweepXZ(path, prof, { closed, scale: (i) => ({ v: hFn(i), vc: 0 }), uvScale: [0.5, 1] });
}

function quadBezier(a, c, b, n) { const out = []; for (let k = 0; k <= n; k++) { const t = k / n, q = 1 - t; out.push({ x: q * q * a.x + 2 * q * t * c.x + t * t * b.x, z: q * q * a.z + 2 * q * t * c.z + t * t * b.z }); } return out; }
function lineHit(p, d, q, e) { // p + s*d = q + r*e
  const den = d.x * e.z - d.z * e.x; if (Math.abs(den) < 1e-4) return null;
  const s = ((q.x - p.x) * e.z - (q.z - p.z) * e.x) / den; const r = ((q.x - p.x) * d.z - (q.z - p.z) * d.x) / den;
  return { s, r, x: p.x + d.x * s, z: p.z + d.z * s };
}

// ---------- paint (decal quads) ----------
class Paint {
  constructor() { this.pos = []; this.uv = []; this.idx = []; }
  quad(cx, cz, tx, tz, len, wid, y, r) {
    const nx = -tz, nz = tx, b = this.pos.length / 3, hl = len / 2, hw = wid / 2;
    for (const [a, c] of [[-hl, -hw], [hl, -hw], [hl, hw], [-hl, hw]]) this.pos.push(cx + tx * a + nx * c, y, cz + tz * a + nz * c);
    this.uv.push(r[0], r[1], r[0], r[3], r[2], r[3], r[2], r[1]);
    this.idx.push(b, b + 2, b + 1, b, b + 3, b + 2);
  }
  line(F, off, wid, y, r) {
    const b0 = this.pos.length / 3;
    F.forEach((f, i) => { for (const s of [-1, 1]) this.pos.push(f.x + f.nx * (off + s * wid / 2), y, f.z + f.nz * (off + s * wid / 2)); const v = r[1] + (r[3] - r[1]) * (i % 2 ? 0.8 : 0.2); this.uv.push(r[0], v, r[2], v); });
    for (let i = 0; i < F.length - 1; i++) { const a = b0 + i * 2; this.idx.push(a, a + 1, a + 3, a, a + 3, a + 2); }
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.idx); g.computeVertexNormals();
    const n = g.attributes.normal; for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
    return g;
  }
}

/** Trim distance at a junction so neighbouring road mouths don't overlap. */
function junctionTrim(dirs) {
  const maxW = Math.max(...dirs.map((d) => d.w));
  let t = maxW / 2 + 0.55;
  const sorted = [...dirs].sort((a, b) => a.ang - b.ang);
  for (let it = 0; it < 40; it++) {
    let ok = true;
    for (let k = 0; k < sorted.length; k++) {
      const a = sorted[k], b = sorted[(k + 1) % sorted.length];
      let gap = b.ang - a.ang; if (gap <= 0) gap += Math.PI * 2;
      if (Math.atan2(a.w / 2 + 0.25, t) + Math.atan2(b.w / 2 + 0.25, t) > gap - 0.08) { ok = false; break; }
    }
    if (ok) break; t += 0.12;
  }
  return Math.min(t, 4.5);
}

// ---------- 2D distance fields ----------
/** Signed distance to a simple polygon [{x,z}] (negative inside). */
function polySD(px, pz, P) {
  let d = Infinity, inside = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const a = P[j], b = P[i];
    const ex = b.x - a.x, ez = b.z - a.z, wx = px - a.x, wz = pz - a.z;
    const t = Math.max(0, Math.min(1, (wx * ex + wz * ez) / (ex * ex + ez * ez || 1)));
    const dx = wx - ex * t, dz = wz - ez * t, q = dx * dx + dz * dz; if (q < d) d = q;
    if ((a.z > pz) !== (b.z > pz) && px < (b.x - a.x) * (pz - a.z) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside ? -Math.sqrt(d) : Math.sqrt(d);
}
/** Rotated box distance (same convention as the yards / dock pads: rot = THREE Y rotation, w along local X). */
function boxDist(x, z, b) {
  const c = Math.cos(b.rot), s = Math.sin(b.rot), dx = x - b.x, dz = z - b.z;
  const qx = Math.abs(dx * c - dz * s) - b.w / 2, qz = Math.abs(dx * s + dz * c) - b.d / 2;
  return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0);
}

class Field {
  constructor(x0, z0, x1, z1, h) {
    this.h = h; this.x0 = x0; this.z0 = z0;
    this.nx = Math.ceil((x1 - x0) / h) + 1; this.nz = Math.ceil((z1 - z0) / h) + 1; this.n = this.nx * this.nz;
  }
  alloc(v = 1e9) { return new Float32Array(this.n).fill(v); }
  x(k) { return this.x0 + (k % this.nx) * this.h; }
  z(k) { return this.z0 + Math.floor(k / this.nx) * this.h; }
  /** min-splat a polygon's signed distance into each target array, within `margin` of its bbox. */
  splat(P, margin, targets) {
    let ax = Infinity, az = Infinity, bx = -Infinity, bz = -Infinity;
    for (const p of P) { ax = Math.min(ax, p.x); az = Math.min(az, p.z); bx = Math.max(bx, p.x); bz = Math.max(bz, p.z); }
    const i0 = Math.max(0, Math.floor((ax - margin - this.x0) / this.h)), i1 = Math.min(this.nx - 1, Math.ceil((bx + margin - this.x0) / this.h));
    const j0 = Math.max(0, Math.floor((az - margin - this.z0) / this.h)), j1 = Math.min(this.nz - 1, Math.ceil((bz + margin - this.z0) / this.h));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const k = j * this.nx + i, d = polySD(this.x0 + i * this.h, this.z0 + j * this.h, P);
      for (const T of targets) if (d < T[k]) T[k] = d;
    }
  }
}

/**
 * Marching-squares fill of the region F < 0 as an up-facing mesh at height y (world-space UVs), plus vertical
 * skirts down to the ground along its boundary. Vertices are shared through corner / edge keys (no cracks).
 */
function isoFill(fd, F, y, G) {
  const { nx, nz } = fd;
  const cIdx = new Int32Array(fd.n).fill(-1), eIdx = new Map();
  const vC = (k) => { if (cIdx[k] < 0) { const x = fd.x(k), z = fd.z(k); cIdx[k] = G.v(x, y, z, x, z); } return cIdx[k]; };
  const vE = (a, b) => {
    const lo = Math.min(a, b), key = lo * 2 + (Math.abs(a - b) === 1 ? 0 : 1);
    let v = eIdx.get(key);
    if (v === undefined) {
      const t = F[a] / (F[a] - F[b]), x = fd.x(a) + (fd.x(b) - fd.x(a)) * t, z = fd.z(a) + (fd.z(b) - fd.z(a)) * t;
      v = G.v(x, y, z, x, z); eIdx.set(key, v);
    }
    return v;
  };
  const rim = [];
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const k0 = j * nx + i, K = [k0, k0 + 1, k0 + nx + 1, k0 + nx];
    let any = false, all = true; for (const k of K) { if (F[k] < 0) any = true; else all = false; }
    if (!any) continue;
    const poly = [];
    for (let c = 0; c < 4; c++) {
      const a = K[c], b = K[(c + 1) % 4];
      if (F[a] < 0) poly.push({ v: vC(a), e: false });
      if ((F[a] < 0) !== (F[b] < 0)) poly.push({ v: vE(a, b), e: true });
    }
    // cell corners run CCW in (x,z) → reverse the fan so faces point up
    for (let q = 1; q < poly.length - 1; q++) G.tri(poly[0].v, poly[q + 1].v, poly[q].v);
    if (!all) for (let q = 0; q < poly.length; q++) { const A = poly[q], B = poly[(q + 1) % poly.length]; if (A.e && B.e) rim.push([A.v, B.v]); }
  }
  // skirts: interior lies left of each rim edge (A→B), outward = (dz, -dx)
  for (const [a, b] of rim) {
    const ax = G.p[a * 3], az = G.p[a * 3 + 2], bx = G.p[b * 3], bz = G.p[b * 3 + 2];
    const o = norm(bz - az, -(bx - ax)), L = Math.hypot(bx - ax, bz - az);
    const At = G.v(ax, y, az, 0, y, o.x, 0, o.z), Bt = G.v(bx, y, bz, L, y, o.x, 0, o.z);
    const Ab = G.v(ax, 0, az, 0, 0, o.x, 0, o.z), Bb = G.v(bx, 0, bz, L, 0, o.x, 0, o.z);
    G.tri(At, Bt, Ab); G.tri(Bt, Bb, Ab);
  }
}

/** Marching-squares iso-lines of D = iso, chained into polylines [{pts, closed}]. */
function isoLines(fd, D, iso) {
  const { nx, nz } = fd; const S = (k) => D[k] - iso;
  const pt = new Map(); const segs = []; const adj = new Map();
  const ek = (a, b) => { const lo = Math.min(a, b), key = lo * 2 + (Math.abs(a - b) === 1 ? 0 : 1); if (!pt.has(key)) { const t = S(a) / (S(a) - S(b)); pt.set(key, { x: fd.x(a) + (fd.x(b) - fd.x(a)) * t, z: fd.z(a) + (fd.z(b) - fd.z(a)) * t }); } return key; };
  const add = (p, q) => { const s = segs.length; segs.push([p, q]); for (const e of [p, q]) { if (!adj.has(e)) adj.set(e, []); adj.get(e).push(s); } };
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const k0 = j * nx + i, K = [k0, k0 + 1, k0 + nx + 1, k0 + nx];
    if (K.every((k) => D[k] > 1e8)) continue;
    const neg = K.map((k) => S(k) < 0); const cnt = neg.filter(Boolean).length;
    if (cnt === 0 || cnt === 4) continue;
    const E = []; for (let c = 0; c < 4; c++) E.push(neg[c] !== neg[(c + 1) % 4] ? ek(K[c], K[(c + 1) % 4]) : null);
    const cut = E.map((e, c) => [e, c]).filter(([e]) => e !== null);
    if (cut.length === 2) add(cut[0][0], cut[1][0]);
    else { // saddle: isolate the corners whose sign differs from the cell centre
      const centreNeg = (S(K[0]) + S(K[1]) + S(K[2]) + S(K[3])) / 4 < 0;
      for (let c = 0; c < 4; c++) if (neg[c] !== centreNeg) add(E[(c + 3) % 4], E[c]);
    }
  }
  const used = new Uint8Array(segs.length); const lines = [];
  for (let s0 = 0; s0 < segs.length; s0++) {
    if (used[s0]) continue;
    used[s0] = 1; const chain = [segs[s0][0], segs[s0][1]];
    const grow = (front) => {
      for (;;) {
        const end = front ? chain[chain.length - 1] : chain[0];
        const nxt = (adj.get(end) || []).find((s) => !used[s]); if (nxt === undefined) return;
        used[nxt] = 1; const [p, q] = segs[nxt]; const o = p === end ? q : p;
        front ? chain.push(o) : chain.unshift(o);
      }
    };
    grow(true); grow(false);
    const closed = chain.length > 3 && chain[0] === chain[chain.length - 1];
    if (closed) chain.pop();
    lines.push({ pts: chain.map((k) => pt.get(k)), closed });
  }
  return lines;
}

/** Uniform resample + light smoothing of a polyline. */
function resample(pts, closed, step) {
  const P = closed ? [...pts, pts[0]] : pts; const L = cumLen(P), tot = L[L.length - 1];
  if (tot < step * 1.5) return closed ? null : pts.length > 1 ? [pts[0], pts[pts.length - 1]] : null;
  const n = Math.max(2, Math.round(tot / step)); const out = []; let i = 1;
  for (let k = 0; k <= (closed ? n - 1 : n); k++) {
    const s = tot * k / n; while (i < P.length - 1 && L[i] < s) i++;
    const t = (s - L[i - 1]) / (L[i] - L[i - 1] || 1);
    out.push({ x: P[i - 1].x + (P[i].x - P[i - 1].x) * t, z: P[i - 1].z + (P[i].z - P[i - 1].z) * t });
  }
  for (let it = 0; it < 2; it++) {
    const c = out.map((p) => ({ ...p }));
    for (let k = 0; k < out.length; k++) {
      if (!closed && (k === 0 || k === out.length - 1)) continue;
      const a = c[(k - 1 + c.length) % c.length], b = c[(k + 1) % c.length];
      out[k].x = 0.25 * a.x + 0.5 * c[k].x + 0.25 * b.x; out[k].z = 0.25 * a.z + 0.5 * c[k].z + 0.25 * b.z;
    }
  }
  return out;
}

export function buildRoads() {
  const group = new THREE.Group(); group.name = 'roads';
  const { chains, nodes } = buildChains();
  const junction = new Map(); // id -> {t}
  const isJunction = (id) => { const n = nodes.get(id); return n.degree >= 3 || (n.degree === 2 && n.kind !== 'gate' && n.kind !== 'ramp'); };
  chains.forEach((ch) => { ch.L = cumLen(ch.pts); ch.tot = ch.L[ch.L.length - 1]; ch.walk = ch.meta.some((m) => m.walk); });

  // incident directions per junction (estimate from chain geometry ~1.5u out)
  const incident = new Map();
  chains.forEach((ch, ci) => {
    for (const end of [0, 1]) {
      const id = end ? ch.b : ch.a; if (!isJunction(id)) continue;
      const n = nodes.get(id);
      const f = frameAt(ch.pts, end ? ch.tot - 1.5 : 1.5);
      const w = end ? ch.meta[ch.meta.length - 1].w : ch.meta[0].w;
      if (!incident.has(id)) incident.set(id, []);
      incident.get(id).push({ ci, end, w, ang: Math.atan2(f.z - n.z, f.x - n.x) });
    }
  });
  for (const [id, dirs] of incident) junction.set(id, { t: junctionTrim(dirs), dirs });

  // Per-end trims. Junction ends step back to the junction mouth; open ends run past their node (gates into the
  // membrane portal, the avenue onto the ramp deck). Short links share their length so no strip collapses and the
  // junction pad always gets a mouth for every incident road (the avenue→ramp stub used to vanish).
  const openExt = (id) => { const n = nodes.get(id); return n.kind === 'gate' ? 1.4 : n.kind === 'ramp' ? 0.35 : 0; };
  for (const ch of chains) {
    let tA = junction.has(ch.a) ? junction.get(ch.a).t : -openExt(ch.a);
    let tB = junction.has(ch.b) ? junction.get(ch.b).t : -openExt(ch.b);
    const room = ch.tot - 0.6;
    if (tA + tB > room) {
      if (tA > 0 && tB > 0) { const k = room / (tA + tB); tA *= k; tB *= k; } else if (tA > 0) tA = room - tB; else tB = room - tA;
    }
    ch.s0 = tA; ch.s1 = ch.tot - tB;
  }

  const asphaltG = new Geo(), junctionG = new Geo(), walkG = new Geo(), curbGeos = [], dockGeos = [];
  const paint = new Paint();
  const out = { chains: [], pads: [], walks: [], docks: [], medians: [] };
  const medianGeos = [];
  const mouths = new Map(); // id -> [{ang, ccwP, cwP, out, w, t, walk}]
  const shapes = [];        // asphalt polygons for the fields: {P, walk}
  const extShapes = [];     // phantom asphalt past open ends (keeps the curb iso-line from wrapping the road end)
  const openEnds = [];      // {o, d, n, hw, curb, walk}
  const zebras = [];        // {x, z, tx, tz, hw} for drop kerbs

  chains.forEach((ch) => {
    const { s0, s1, tot } = ch;
    if (s1 - s0 < 0.25) return;
    const F = frames(ch.pts, s0, s1);
    const W = (f) => { const i = Math.min(ch.meta.length - 1, Math.max(0, Math.round((f.s / tot) * (ch.meta.length - 1)))); return ch.meta[i].w; };
    const len = s1 - s0, kind = ch.kind;
    // carriageway
    strip(asphaltG, F, (i, f) => W(f) / 2, (i, f) => -W(f) / 2, Y_ROAD, (i, f, side) => [side, (f.s - s0) / 6]);
    for (let i = 0; i < F.length - 1; i++) {
      const a = F[i], b = F[i + 1], wa = W(a) / 2, wb = W(b) / 2;
      shapes.push({ P: [{ x: a.x + a.nx * wa, z: a.z + a.nz * wa }, { x: b.x + b.nx * wb, z: b.z + b.nz * wb }, { x: b.x - b.nx * wb, z: b.z - b.nz * wb }, { x: a.x - a.nx * wa, z: a.z - a.nz * wa }], walk: ch.walk });
    }
    const dockEnd = (id) => nodes.get(id).degree === 1 && nodes.get(id).kind === 'entry';
    for (const end of [0, 1]) {
      const id = end ? ch.b : ch.a, f = end ? F[F.length - 1] : F[0], w = W(f), n = nodes.get(id);
      const outD = end ? { x: -f.tx, z: -f.tz } : { x: f.tx, z: f.tz }; // pointing away from the end node
      if (junction.has(id)) {
        // mouth for the junction pad
        const Lp = { x: f.x + f.nx * w / 2, z: f.z + f.nz * w / 2 }, Rp = { x: f.x - f.nx * w / 2, z: f.z - f.nz * w / 2 };
        const ccw = { x: -outD.z, z: outD.x };
        const left = (Lp.x - f.x) * ccw.x + (Lp.z - f.z) * ccw.z > 0;
        if (!mouths.has(id)) mouths.set(id, []);
        mouths.get(id).push({ ang: Math.atan2(f.z - n.z, f.x - n.x), ccwP: left ? Lp : Rp, cwP: left ? Rp : Lp, out: outD, w, t: end ? tot - s1 : s0, walk: ch.walk, kind });
      } else {
        // open end (gate portal / ramp deck / district dock): remember the cut plane, extend the curb field
        const d = { x: -outD.x, z: -outD.z }, hw = w / 2;
        const nrm = { x: -d.z, z: d.x };
        openEnds.push({ o: { x: f.x, z: f.z }, d, n: nrm, hw, curb: dockEnd(id) ? -0.2 : 0 });
        const P = (a, l) => ({ x: f.x + nrm.x * l + d.x * a, z: f.z + nrm.z * l + d.z * a });
        extShapes.push([P(-0.05, hw), P(1.6, hw), P(1.6, -hw), P(-0.05, -hw)]);
      }
    }
    // zebra ends (painted roads into real junctions); a short link between two junctions gets one central zebra
    let zebraEnds = [0, 1].filter((end) => { const id = end ? ch.b : ch.a; return junction.has(id) && nodes.get(id).degree >= 3 && PAINTED.has(kind); });
    const shortLink = zebraEnds.length === 2 && len < 4.2; // one central crossing instead of two crammed together
    // sidewalk centre lines for props (benches / bins)
    if (ch.walk) {
      const trimA = junction.has(ch.a) ? 0 : 0.6, trimB = junction.has(ch.b) ? 0 : 0.6;
      const WF = frames(ch.pts, s0 + trimA, s1 - trimB, 0.3);
      for (const side of [-1, 1]) out.walks.push({ pts: WF.map((f) => ({ x: f.x, z: f.z })), off: (i) => side * (W(WF[Math.min(i, WF.length - 1)]) / 2 + 0.7), side });
    }
    // ---- paint ----
    const zebraAt = (sZ, w) => {
      const fz = frameAt(ch.pts, sZ);
      for (let u = -w / 2 + 0.28; u <= w / 2 - 0.26; u += 0.3) paint.quad(fz.x + fz.nx * u, fz.z + fz.nz * u, fz.tx, fz.tz, 0.7, 0.15, Y_ROAD + 0.005, PAINT_UV.white);
      zebras.push({ x: fz.x, z: fz.z, tx: fz.tx, tz: fz.tz, hw: w / 2 });
    };
    if (PAINTED.has(kind)) {
      const w0 = Math.min(...F.map(W));
      // markings stop short of the zebras (no lines running through crossings)
      const l0 = s0 + (zebraEnds.includes(0) ? 0.95 : 0), l1 = s1 - (zebraEnds.includes(1) ? 0.95 : 0);
      const LF = !shortLink && l1 - l0 > 0.4 ? frames(ch.pts, l0, l1) : null;
      if (kind === 'ring') {
        // boulevard: raised median island with a low hedge (away from junction mouths) + yellow edge of median
        const m0 = s0 + (junction.has(ch.a) ? 1.6 : 0.6), m1 = s1 - (junction.has(ch.b) ? 1.6 : 0.6);
        if (m1 - m0 > 1.5 && w0 >= 2.8) {
          const MF = frames(ch.pts, m0, m1, 0.3);
          medianGeos.push(sweepXZ(MF.map((f) => ({ x: f.x, z: f.z })), [[0.12, 0], [0.12, 0.1], [0.12, 0.1], [-0.12, 0.1], [-0.12, 0.1], [-0.12, 0]], { uvScale: [0.5, 1] }));
          out.medians.push({ pts: MF.map((f) => ({ x: f.x, z: f.z, tx: f.tx, tz: f.tz })) });
          for (const side of [-1, 1]) paint.line(frames(ch.pts, m0 - 0.6, m1 + 0.6, 0.35), side * 0.17, 0.04, Y_ROAD + 0.004, PAINT_UV.yellow);
        } else if (LF) for (const side of [-1, 1]) paint.line(LF, side * 0.07, 0.04, Y_ROAD + 0.004, PAINT_UV.yellow);
      } else if (w0 >= 1.95) {
        const d0 = s0 + (zebraEnds.includes(0) ? 1.6 : 1.0), d1 = s1 - (zebraEnds.includes(1) ? 1.5 : 0.9);
        for (let s = d0; s < d1; s += 1.4) { const f = frameAt(ch.pts, s); paint.quad(f.x, f.z, f.tx, f.tz, kind === 'avenue' || kind === 'spine' ? 0.8 : 0.6, kind === 'avenue' || kind === 'spine' ? 0.12 : 0.075, Y_ROAD + 0.004, PAINT_UV.white); }
      }
      if (kind !== 'street' && LF) for (const side of [-1, 1]) paint.line(LF, side * (w0 / 2 - 0.13), kind === 'ring' ? 0.06 : 0.045, Y_ROAD + 0.004, kind === 'spine' ? PAINT_UV.yellow : PAINT_UV.white);
      if (shortLink) zebraAt((s0 + s1) / 2, W({ s: (s0 + s1) / 2 }));
      else for (const end of zebraEnds) {
        const f = end ? F[F.length - 1] : F[0], w = W(f);
        zebraAt(end ? s1 - 0.53 : s0 + 0.53, w);
        const lane = end ? -1 : 1, sB = end ? s1 - 1.02 : s0 + 1.02, fb = frameAt(ch.pts, sB);
        if (len > 2.3) paint.quad(fb.x + fb.nx * lane * w / 4, fb.z + fb.nz * lane * w / 4, fb.nx, fb.nz, w / 2 - 0.2, 0.09, Y_ROAD + 0.005, PAINT_UV.white);
        if (len > 7 && w >= 2.2) { const sA = end ? s1 - 2.6 : s0 + 2.6, fa = frameAt(ch.pts, sA), dir = end ? 1 : -1; paint.quad(fa.x + fa.nx * lane * w / 4, fa.z + fa.nz * lane * w / 4, fa.tx * dir, fa.tz * dir, 0.9, 0.45, Y_ROAD + 0.005, PAINT_UV.arrow); }
      }
    } else if (kind === 'service') {
      for (const side of [-1, 1]) paint.line(F, side * (Math.min(...F.map(W)) / 2 - 0.12), 0.05, Y_ROAD + 0.004, PAINT_UV.yellow);
    }
    // ---- dock pads at district ends ----
    for (const end of [0, 1]) {
      const id = end ? ch.b : ch.a; if (!dockEnd(id)) continue;
      const f = end ? F[F.length - 1] : F[0], w = W(f);
      const dir = end ? { x: f.tx, z: f.tz } : { x: -f.tx, z: -f.tz };
      const dw = w + 1.8, dd = 2.6, cx = f.x + dir.x * (dd / 2 - 0.15), cz = f.z + dir.z * (dd / 2 - 0.15);
      const rot = Math.atan2(dir.x, dir.z);
      const g = new RoundedBoxGeometry(dw, 0.07, dd, 1, 0.03); g.translate(0, 0.025, 0); g.rotateY(rot); g.translate(cx, 0, cz);
      const uv = g.attributes.uv, pp = g.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, pp.getX(i) / 3, pp.getZ(i) / 3);
      dockGeos.push(g);
      const tx = Math.cos(rot), tz = -Math.sin(rot);
      for (let k = 0; k <= 3; k++) { const lx = -dw / 2 + 0.2 + k * (dw - 0.4) / 3; paint.quad(cx + tx * lx + dir.x * 0.1, cz + tz * lx + dir.z * 0.1, dir.x, dir.z, dd - 0.6, 0.06, 0.064, PAINT_UV.yellow); }
      paint.quad(cx + dir.x * (dd / 2 - 0.2), cz + dir.z * (dd / 2 - 0.2), tx, tz, dw - 0.3, 0.16, 0.064, PAINT_UV.hatch);
      out.docks.push({ id, x: cx, z: cz, w: dw, d: dd, rot, dirx: dir.x, dirz: dir.z });
    }
    out.chains.push({ a: ch.a, b: ch.b, pts: F.map((f) => ({ x: f.x, z: f.z })), meta: F.map((f) => ({ w: W(f), walk: ch.walk, kind })), len, kind });
  });

  // ---- junction pads: filleted polygons built from the road mouths (earcut, so any shape triangulates) ----
  for (const [id] of junction) {
    const n = nodes.get(id); const ms = (mouths.get(id) || []).sort((a, b) => a.ang - b.ang);
    if (ms.length < 2) continue;
    const ring = [];
    for (let k = 0; k < ms.length; k++) {
      const a = ms[k], b = ms[(k + 1) % ms.length];
      let gap = b.ang - a.ang; if (gap <= 0) gap += Math.PI * 2;
      // corner from a.ccwP to b.cwP: fillet tangent to both kerb lines; straight across a T's through side;
      // around the node on a reflex side
      const hit = lineHit(a.ccwP, { x: -a.out.x, z: -a.out.z }, b.cwP, { x: -b.out.x, z: -b.out.z });
      let fil;
      if (hit && hit.s > 0.02 && hit.r > 0.02 && hit.s < a.t * 1.6 && hit.r < b.t * 1.6) fil = quadBezier(a.ccwP, hit, b.cwP, 12);
      else if (gap > Math.PI + 0.05) {
        const foot = (p, o) => { const k2 = (p.x - n.x) * o.x + (p.z - n.z) * o.z; return { x: p.x - o.x * k2, z: p.z - o.z * k2 }; };
        const Pa = foot(a.ccwP, a.out), Pb = foot(b.cwP, b.out);
        const ra = Math.hypot(Pa.x - n.x, Pa.z - n.z), rb = Math.hypot(Pb.x - n.x, Pb.z - n.z);
        const aa = Math.atan2(Pa.z - n.z, Pa.x - n.x); let da = Math.atan2(Pb.z - n.z, Pb.x - n.x) - aa; while (da < 0) da += Math.PI * 2;
        fil = [a.ccwP];
        for (let q = 0; q <= 10; q++) { const t = q / 10, r = ra + (rb - ra) * t; fil.push({ x: n.x + Math.cos(aa + da * t) * r, z: n.z + Math.sin(aa + da * t) * r }); }
        fil.push(b.cwP);
      } else fil = quadBezier(a.ccwP, { x: (a.ccwP.x + b.cwP.x) / 2, z: (a.ccwP.z + b.cwP.z) / 2 }, b.cwP, 4);
      ring.push(a.cwP, a.ccwP, ...fil.slice(1, -1));
      // footway wedge: node → mid-mouth a → corner → mid-mouth b. A corner gets a footway if either road has one,
      // so a sidewalk always wraps the corner and ends in a rounded return along a road without footways.
      const am = { x: (a.cwP.x + a.ccwP.x) / 2, z: (a.cwP.z + a.ccwP.z) / 2 }, bm = { x: (b.cwP.x + b.ccwP.x) / 2, z: (b.cwP.z + b.ccwP.z) / 2 };
      shapes.push({ P: [{ x: n.x, z: n.z }, am, ...fil, bm], walk: a.walk || b.walk });
    }
    // elbow pad (degree-2 bend): carry the centre dashes round the bend so the marking reads continuous
    if (ms.length === 2 && ms.every((m) => PAINTED.has(m.kind))) {
      const mid = (m) => ({ x: (m.cwP.x + m.ccwP.x) / 2, z: (m.cwP.z + m.ccwP.z) / 2 });
      const C = quadBezier(mid(ms[0]), { x: n.x, z: n.z }, mid(ms[1]), 40), CL = cumLen(C), tot = CL[CL.length - 1];
      for (let s = 0.7; s < tot - 0.5; s += 1.4) { const f = frameAt(C, s); paint.quad(f.x, f.z, f.tx, f.tz, 0.8, 0.12, Y_ROAD + 0.004, PAINT_UV.white); }
    }
    const tris = THREE.ShapeUtils.triangulateShape(ring.map((p) => new THREE.Vector2(p.x, p.z)), []);
    const base = junctionG.p.length / 3;
    ring.forEach((p) => junctionG.v(p.x, Y_ROAD, p.z, p.x / 6, p.z / 6));
    for (const [i, j, k] of tris) {
      const A = ring[i], B = ring[j], C = ring[k];
      const up = (B.x - A.x) * (C.z - A.z) - (B.z - A.z) * (C.x - A.x) < 0; // y-normal = -cross2D
      up ? junctionG.tri(base + i, base + j, base + k) : junctionG.tri(base + i, base + k, base + j);
    }
    out.pads.push({ id, x: n.x, z: n.z, r: Math.max(...ms.map((m) => m.t)) + 0.3, degree: n.degree });
  }

  // ---- sidewalks + curbs from distance fields ----
  {
    const M = WALK_OUT + 0.35;
    let ax = Infinity, az = Infinity, bx = -Infinity, bz = -Infinity;
    for (const s of shapes) for (const p of s.P) { ax = Math.min(ax, p.x); az = Math.min(az, p.z); bx = Math.max(bx, p.x); bz = Math.max(bz, p.z); }
    const fd = new Field(ax - M - 1, az - M - 1, bx + M + 1, bz + M + 1, GRID);
    const Da = fd.alloc(), Dw = fd.alloc();
    for (const s of shapes) fd.splat(s.P, M, s.walk ? [Da, Dw] : [Da]);
    const Dc = Da.slice();
    for (const P of extShapes) fd.splat(P, 0.6, [Dc]);
    const blocks = [...YARDS, ...out.docks];
    // district / membrane clearance is smooth: sample it lazily on a 3× coarser lattice and interpolate
    const CS = 3, cnx = Math.ceil(fd.nx / CS) + 1, cache = new Float32Array(cnx * (Math.ceil(fd.nz / CS) + 1)).fill(NaN);
    const clipC = (ci, cj) => {
      const q = cj * cnx + ci; let v = cache[q];
      if (Number.isNaN(v)) { const x = fd.x0 + ci * CS * fd.h, z = fd.z0 + cj * CS * fd.h; v = cache[q] = Math.min(organelleDist(x, z, null, true) - 0.15, membraneDist(x, z) - 0.25); }
      return v;
    };
    const clipAt = (k) => {
      const i = k % fd.nx, j = Math.floor(k / fd.nx), ci = Math.floor(i / CS), cj = Math.floor(j / CS), u = (i - ci * CS) / CS, v = (j - cj * CS) / CS;
      return (clipC(ci, cj) * (1 - u) + clipC(ci + 1, cj) * u) * (1 - v) + (clipC(ci, cj + 1) * (1 - u) + clipC(ci + 1, cj + 1) * u) * v;
    };
    const Fw = new Float32Array(fd.n).fill(1);
    for (let k = 0; k < fd.n; k++) {
      if (Dw[k] > 1e8 || Da[k] > 1e8) continue;
      let f = Math.max(WALK_IN - Da[k], Dw[k] - WALK_OUT);
      if (f < 0.25) {
        const x = fd.x(k), z = fd.z(k);
        // keep clear of districts and the membrane (but always keep 0.3 of pavement behind the curb)
        const c = clipAt(k);
        f = Math.max(f, Math.min(-c, Da[k] - (CURB_W + 0.3)));
        for (const b of blocks) f = Math.max(f, 0.03 - boxDist(x, z, b));       // yards / dock pads own their area
        for (const e of openEnds) {                                               // footways stop 0.6 short of open ends
          const dx = x - e.o.x, dz = z - e.o.z, al = dx * e.d.x + dz * e.d.z, lat = Math.abs(dx * e.n.x + dz * e.n.z);
          if (lat < e.hw + WALK_OUT + 0.4 && al > -4 && al < 4) f = Math.max(f, al + 0.6);
        }
      }
      Fw[k] = f;
    }
    isoFill(fd, Fw, Y_WALK, walkG);

    // curbs: one continuous kerb along every asphalt boundary; dropped at zebras, cut at open road ends
    const dropAt = (p) => { for (const z of zebras) { const dx = p.x - z.x, dz = p.z - z.z; if (Math.abs(dx * z.tx + dz * z.tz) < 0.42 && Math.abs(-dx * z.tz + dz * z.tx) < z.hw + 0.4) return 0.42; } return 1; };
    const cutAt = (p) => blocks.some((b) => boxDist(p.x, p.z, b) < 0.03) || openEnds.some((e) => { const dx = p.x - e.o.x, dz = p.z - e.o.z, al = dx * e.d.x + dz * e.d.z; return al > e.curb && al < 3 && Math.abs(dx * e.n.x + dz * e.n.z) < e.hw + 0.5; });
    for (const line of isoLines(fd, Dc, CURB_W / 2)) {
      const R = resample(line.pts, line.closed, 0.2); if (!R) continue;
      const keep = R.map((p) => !cutAt(p));
      const runs = [];
      if (line.closed && keep.every(Boolean)) runs.push({ pts: R, closed: true });
      else {
        // split at cut points (rotate closed loops so a cut point comes first)
        let start = 0; if (line.closed) start = keep.findIndex((k) => !k);
        let cur = [];
        for (let q = 0; q <= R.length; q++) {
          const idx = (start + q) % R.length; if (q === R.length && !line.closed) break;
          if (keep[idx] && !(line.closed && q === R.length)) cur.push(R[idx]); else { if (cur.length > 1) runs.push({ pts: cur, closed: false }); cur = []; }
        }
        if (cur.length > 1) runs.push({ pts: cur, closed: false });
      }
      for (const r of runs) { const h = r.pts.map(dropAt); curbGeos.push(curbAlong(r.pts, (i) => h[Math.min(i, h.length - 1)], r.closed)); }
    }
  }

  // ---- loading yards ----
  const yardGeos = [];
  for (const y of YARDS) {
    const g = new RoundedBoxGeometry(y.w, 0.1, y.d, 2, 0.04); g.translate(0, 0.02, 0);
    g.rotateY(y.rot); g.translate(y.x, 0, y.z);
    const uv = g.attributes.uv, pos = g.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / 3, pos.getZ(i) / 3);
    yardGeos.push(g);
    const c = Math.cos(y.rot), s = Math.sin(y.rot);
    const tx = c, tz = -s, nx = s, nz = c;
    const P = (lx, lz) => [y.x + tx * lx + nx * lz, y.z + tz * lx + nz * lz];
    const top = 0.075, bw = (y.w - 0.3) / y.bays;
    for (let k = 0; k <= y.bays; k++) { const [px, pz] = P(-y.w / 2 + 0.15 + k * bw, 0.05); paint.quad(px, pz, nx, nz, y.d - 0.35, 0.07, top, PAINT_UV.yellow); }
    const [bx, bz] = P(0, -y.d / 2 + 0.2); paint.quad(bx, bz, tx, tz, y.w - 0.3, 0.07, top, PAINT_UV.yellow);
    const [hx, hz] = P(0, y.d / 2 - 0.12); paint.quad(hx, hz, tx, tz, y.w - 0.3, 0.16, top, PAINT_UV.hatch);
  }

  // ---------- meshes ----------
  const A = asphaltSet(true), AJ = asphaltSet(false);
  const roadMat = new THREE.MeshStandardMaterial({ map: A.map, roughnessMap: A.rough, normalMap: A.normal, normalScale: new THREE.Vector2(0.35, 0.35), roughness: 1, color: 0xffffff, envMapIntensity: 0.6 });
  const junctionMat = new THREE.MeshStandardMaterial({ map: AJ.map, roughnessMap: AJ.rough, normalMap: AJ.normal, normalScale: new THREE.Vector2(0.35, 0.35), roughness: 1, color: 0xffffff, envMapIntensity: 0.6 });
  const road = new THREE.Mesh(asphaltG.build(), roadMat); road.receiveShadow = true; road.name = 'asphalt';
  const junc = new THREE.Mesh(junctionG.build(), junctionMat); junc.receiveShadow = true; junc.name = 'junctions';
  const curbMat = new THREE.MeshStandardMaterial({ color: 0xb9bdc2, roughness: 0.7, side: THREE.DoubleSide });
  const curbs = new THREE.Mesh(mergeGeometries(curbGeos.map((g) => g.toNonIndexed())), curbMat);
  curbs.castShadow = true; curbs.receiveShadow = true; curbs.name = 'curbs';
  const walkMat = new THREE.MeshStandardMaterial({ map: paverTexture('#d3cec6', 4), roughness: 0.84, color: 0xe9e6e1 });
  const walks = new THREE.Mesh(walkG.build(), walkMat); walks.receiveShadow = true; walks.name = 'sidewalks';
  const yardMat = new THREE.MeshStandardMaterial({ map: concreteTexture(), roughness: 0.75, color: 0xdfe3e7 });
  const yards = new THREE.Mesh(mergeGeometries([...yardGeos, ...dockGeos].map((g) => g.toNonIndexed())), yardMat);
  yards.receiveShadow = true; yards.name = 'yards';
  const paintMat = new THREE.MeshStandardMaterial({ map: paintAtlas(), color: 0xd6d4ce, transparent: true, roughness: 0.75, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  const paintMesh = new THREE.Mesh(paint.geometry(), paintMat); paintMesh.receiveShadow = true; paintMesh.renderOrder = 1; paintMesh.name = 'roadPaint';
  if (medianGeos.length) { const med = new THREE.Mesh(mergeGeometries(medianGeos.map((g) => g.toNonIndexed())), curbMat); med.castShadow = true; med.receiveShadow = true; med.name = 'medians'; group.add(med); }
  group.add(road, junc, curbs, walks, yards, paintMesh);
  group.userData.info = out;
  return group;
}
