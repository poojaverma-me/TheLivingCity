// Instanced worker crowd: ~140 lab-coat workers in 5 draw calls (+5 shadow), per-instance colour variety,
// waypoint walking, work spots, idle stops, light mutual avoidance, waving at the nearby player, picking.
import * as THREE from 'three';
import {
  buildCrowdGeometry, buildCrowdLowGeometry, paintMaterial, paintDepthMaterial, poseOf, applyHold, groundBob, stride, packColor, poseSkinMatrices,
  createFigure, createPlayer, createGuide, STATES, CH, NCH, BIT, HAIR_BITS,
} from './characters.js';
import { insideCell, NUCLEUS, RER, SER, GOLGI, MITO, LYSO, VACUOLES, VESICLES } from '../world/layout.js';
import { NETWORK, edgeBetween, roadDist } from '../world/city/network.js';
import { BUILDINGS } from '../world/city/plan.js';
import { clearance as cityClearance } from '../world/city/obstacles.js';

export const SKIN_TONES = [0xf6d9c4, 0xeec3a5, 0xe2ae8a, 0xcf9670, 0xb57b55, 0x93603f, 0x74472c, 0x5a3622];
export const HAIR_COLORS = [0x1d1612, 0x2b1e17, 0x3d2a1e, 0x5b3a22, 0x7a5232, 0xc89b5a, 0xd9b77a, 0x8f8a86, 0xa3462a, 0x161618];
export const HAT_COLORS = [0xf2c12e, 0xf2c12e, 0xf08a24, 0xf4f4f0, 0x3a7bd5];
export const PANTS_COLORS = [0x2e3a55, 0x3a3f4a, 0x6b707a, 0x8f7c5a, 0x34507e, 0x5a4636, 0x2f5a52, 0x7a3a3a];
export const SHIRT_COLORS = [0x5aa0d8, 0x7fc4c8, 0xe58fa8, 0x8fc0a0, 0xe3ddd0, 0x4f6f9a, 0xe6b35a, 0x6fae6a, 0xd46a5a, 0x8fd0b8]; // no violet: reserved for Dr. Mendel
export const SHOE_COLORS = [0x2b2420, 0x1c1c20, 0x5a3a26, 0xe8e4dc, 0x3a4658];
export const COAT_COLORS = [0xf6f6f2, 0xf6f6f2, 0xf3f5f8, 0xf7f3ea, 0xf6f6f2, 0xd5e6f3];

// ---------------------------------------------------------------------------------------------
// Obstacles & provisional paths (used until the city road NETWORK exists)
// ---------------------------------------------------------------------------------------------

export function organelleObstacles() {
  const ob = [{ type: 'circle', x: NUCLEUS.x, z: NUCLEUS.z, r: RER.rings[RER.rings.length - 1] + RER.wallW / 2 + 0.25 }];
  ob.push({ type: 'box', x: SER.x, z: SER.z, w: SER.w, d: SER.d, rot: SER.rot });
  ob.push({ type: 'box', x: GOLGI.x, z: GOLGI.z, w: GOLGI.w, d: GOLGI.d, rot: GOLGI.rot });
  for (const m of MITO) ob.push({ type: 'ellipse', x: m.x, z: m.z, a: m.len / 2, b: m.wid / 2, rot: m.rot });
  for (const l of LYSO) ob.push({ type: 'circle', x: l.x, z: l.z, r: l.r + 0.4 });
  for (const v of VACUOLES) ob.push({ type: 'circle', x: v.x, z: v.z, r: v.r + 0.4 });
  for (const v of VESICLES) ob.push({ type: 'circle', x: v.x, z: v.z, r: v.r + 0.25 });
  return ob;
}
/** Approximate signed distance from (x,z) to an obstacle (negative inside). */
export function obstacleSDF(o, x, z) {
  const dx = x - o.x, dz = z - o.z;
  if (o.type === 'circle') return Math.hypot(dx, dz) - o.r;
  const c = Math.cos(o.rot), s = Math.sin(o.rot);
  const lx = c * dx - s * dz, lz = s * dx + c * dz; // world → local (rotation.y = rot)
  if (o.type === 'box') {
    const qx = Math.abs(lx) - o.w / 2, qz = Math.abs(lz) - o.d / 2;
    return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0);
  }
  const k = Math.hypot(lx / o.a, lz / o.b); // ellipse (approximate)
  return (k - 1) * Math.min(o.a, o.b) * (k > 1 ? 1 : 1);
}
export function clearance(x, z, obs) { let m = Infinity; for (const o of obs) m = Math.min(m, obstacleSDF(o, x, z)); return m; }

/** Nudge a point until it is inside the cell (inset) and `margin` away from every obstacle. */
export function fixPoint(p, obs, margin, inset = 2.2) {
  for (let it = 0; it < 40; it++) {
    let moved = false;
    if (!insideCell(p.x, p.z, inset)) { const l = Math.hypot(p.x, p.z) || 1; p.x -= p.x / l * 0.35; p.z -= p.z / l * 0.35; moved = true; }
    for (const o of obs) {
      const d = obstacleSDF(o, p.x, p.z);
      if (d < margin) {
        const e = 0.05, gx = obstacleSDF(o, p.x + e, p.z) - obstacleSDF(o, p.x - e, p.z), gz = obstacleSDF(o, p.x, p.z + e) - obstacleSDF(o, p.x, p.z - e);
        const gl = Math.hypot(gx, gz) || 1; const push = Math.min(0.6, margin - d + 0.02);
        p.x += gx / gl * push; p.z += gz / gl * push; moved = true;
      }
    }
    if (!moved) break;
  }
  return p;
}
function smoothPoly(pts, closed, passes = 2) {
  let P = pts;
  if (P.length < 3) return P;
  for (let k = 0; k < passes; k++) {
    const Q = [];
    const n = P.length;
    for (let i = 0; i < n; i++) {
      const a = P[closed ? (i - 1 + n) % n : Math.max(0, i - 1)], b = P[i], c = P[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
      Q.push({ x: (a.x + 2 * b.x + c.x) / 4, z: (a.z + 2 * b.z + c.z) / 4 });
    }
    P = Q;
  }
  return P;
}
/** Closed loop hugging an obstacle at `margin`. */
export function loopAround(o, margin, n = 64) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    let x, z;
    if (o.type === 'circle') { x = o.x + Math.cos(t) * (o.r + margin); z = o.z + Math.sin(t) * (o.r + margin); }
    else {
      const A = (o.type === 'box' ? o.w / 2 : o.a) + margin, B = (o.type === 'box' ? o.d / 2 : o.b) + margin;
      const e = o.type === 'box' ? 0.35 : 1; // superellipse for rounded rectangles
      const cx = Math.cos(t), sz = Math.sin(t);
      const lx = A * Math.sign(cx) * Math.pow(Math.abs(cx), e), lz = B * Math.sign(sz) * Math.pow(Math.abs(sz), e);
      const c = Math.cos(o.rot), s = Math.sin(o.rot);
      x = o.x + c * lx + s * lz; z = o.z - s * lx + c * lz;
    }
    pts.push({ x, z });
  }
  return pts;
}
export function cleanLoop(pts, obs, margin, closed = true) {
  let P = pts.map((p) => fixPoint({ ...p }, obs, margin));
  P = smoothPoly(P, closed, 3).map((p) => fixPoint(p, obs, margin * 0.9));
  return P;
}

/** Provisional sidewalk loops for workers (until src/world/city/network.js exists). */
export function provisionalPaths(margin = 1.35) {
  const obs = organelleObstacles();
  const [nuc, ser, golgi, m0, m1, ...rest] = obs;
  const paths = [ser, golgi, m0, m1].map((o) => cleanLoop(loopAround(o, margin, 72), obs, margin * 0.9));
  // vacuole cluster loop
  const vc = VACUOLES.reduce((a, v) => ({ x: a.x + v.x / VACUOLES.length, z: a.z + v.z / VACUOLES.length }), { x: 0, z: 0 });
  paths.push(cleanLoop(loopAround({ type: 'circle', x: vc.x, z: vc.z, r: 6.2 }, 0, 56), obs, 0.9));
  // ER promenade (front arc, walked back and forth)
  const arc = [];
  for (let i = 0; i <= 40; i++) { const a = (18 + i * 3.6) * Math.PI / 180; arc.push({ x: nuc.x + Math.cos(a) * (nuc.r + margin), z: nuc.z + Math.sin(a) * (nuc.r + margin) }); }
  paths.push({ points: cleanLoop(arc, obs, margin * 0.9, false), closed: false });
  // lysosome loops
  for (const l of LYSO.slice(0, 2)) paths.push(cleanLoop(loopAround({ type: 'circle', x: l.x, z: l.z, r: l.r + 0.4 }, 1.1, 32), obs, 0.8));
  // front avenue from the gate to the centre (back and forth)
  const av = []; for (let i = 0; i <= 24; i++) av.push({ x: 1.6 + Math.sin(i * 0.4) * 0.4, z: 44 - i * 1.6 });
  paths.push({ points: cleanLoop(av, obs, 1.0, false), closed: false });
  return paths;
}

/** Provisional work spots: workers stand facing organelle consoles / walls. */
export function provisionalSpots(count = 52, seed = 3) {
  const obs = organelleObstacles();
  const rnd = mulberry(seed);
  const spots = [];
  const targets = [obs[0], obs[1], obs[2], obs[3], obs[4], ...obs.slice(5, 11)];
  let guard = 0;
  while (spots.length < count && guard++ < 4000) {
    const o = targets[Math.floor(rnd() * targets.length)];
    const ring = loopAround(o, 0.55 + rnd() * 0.25, 90);
    const p = { ...ring[Math.floor(rnd() * ring.length)] };
    if (!insideCell(p.x, p.z, 2.4)) continue;
    if (clearance(p.x, p.z, obs.filter((q) => q !== o)) < 0.8) continue;
    if (spots.some((s) => Math.hypot(s.x - p.x, s.z - p.z) < 1.1)) continue;
    // face the obstacle (gradient descent direction)
    const e = 0.05, gx = obstacleSDF(o, p.x + e, p.z) - obstacleSDF(o, p.x - e, p.z), gz = obstacleSDF(o, p.x, p.z + e) - obstacleSDF(o, p.x, p.z - e);
    const r = rnd();
    const state = r < 0.62 ? 'work' : r < 0.82 ? 'idle' : 'talk';
    spots.push({ x: p.x, z: p.z, yaw: Math.atan2(-gx, -gz), state });
    // talking partner facing them
    if (state === 'talk' && spots.length < count) {
      const yaw = Math.atan2(-gx, -gz) + Math.PI * 0.5 * (rnd() < 0.5 ? 1 : -1);
      const q = { x: p.x + Math.sin(yaw) * 0.85, z: p.z + Math.cos(yaw) * 0.85 };
      if (clearance(q.x, q.z, obs) > 0.4) {
        spots[spots.length - 1].yaw = yaw;
        spots.push({ x: q.x, z: q.z, yaw: yaw + Math.PI, state: 'talk' });
      }
    }
  }
  return spots;
}

// ---------------------------------------------------------------------------------------------
// Road-network driven paths (src/world/city/network.js)
// ---------------------------------------------------------------------------------------------

/**
 * Derive loops and dead-end spurs from the live road graph (robust to network edits):
 *  cycles: fundamental cycle basis of a BFS spanning tree (closed node lists)
 *  spurs:  chains from each dead end back to the nearest junction (degree ≥ 3)
 */
export function graphRoutes() {
  const adj = new Map(NETWORK.nodes.map((n) => [n.id, []]));
  for (const e of NETWORK.edges) { adj.get(e.a)?.push(e.b); adj.get(e.b)?.push(e.a); }
  const ids = [...adj.keys()];
  const rootId = ids.reduce((a, b) => (adj.get(b).length > adj.get(a).length ? b : a), ids[0]);
  const parent = new Map([[rootId, null]]), depth = new Map([[rootId, 0]]), q = [rootId], tree = new Set();
  while (q.length) {
    const u = q.shift();
    for (const v of adj.get(u)) if (!parent.has(v)) { parent.set(v, u); depth.set(v, depth.get(u) + 1); tree.add(u < v ? u + '|' + v : v + '|' + u); q.push(v); }
  }
  const cycles = [];
  for (const e of NETWORK.edges) {
    const k = e.a < e.b ? e.a + '|' + e.b : e.b + '|' + e.a;
    if (tree.has(k) || !parent.has(e.a) || !parent.has(e.b)) continue;
    let a = e.a, b = e.b; const pa = [a], pb = [b];
    while (a !== b) { if (depth.get(a) >= depth.get(b)) { a = parent.get(a); pa.push(a); } else { b = parent.get(b); pb.push(b); } }
    pb.pop(); // lca already in pa
    const cyc = [...pa, ...pb.reverse()];
    if (cyc.length >= 3) cycles.push(cyc);
  }
  const spurs = [];
  for (const id of ids) {
    if (adj.get(id).length !== 1) continue;
    const chain = [id]; let prev = id, cur = adj.get(id)[0];
    while (cur && adj.get(cur).length === 2 && chain.length < 12) { chain.push(cur); const nx = adj.get(cur).find((x) => x !== prev); prev = cur; cur = nx; }
    if (cur) chain.push(cur);
    if (chain.length >= 2) spurs.push(chain.reverse());
  }
  return { cycles, spurs };
}

/** Signed distance to the nearest city building footprint. */
export function buildingSD(x, z) {
  let m = Infinity;
  for (const b of BUILDINGS) {
    const c = Math.cos(b.rot), s = Math.sin(b.rot), dx = x - b.x, dz = z - b.z;
    const lx = dx * c - dz * s, lz = dx * s + dz * c;
    const qx = Math.abs(lx) - b.w / 2, qz = Math.abs(lz) - b.d / 2;
    m = Math.min(m, Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0));
  }
  return m;
}
/** Free space for pedestrians: organelles, membrane and buildings. */
export const walkField = (x, z) => Math.min(cityClearance(x, z), buildingSD(x, z));

/** Push a point along the field gradient until field(p) ≥ margin. */
export function fieldFix(p, field, margin) {
  for (let it = 0; it < 30; it++) {
    const d = field(p.x, p.z);
    if (d >= margin) break;
    const e = 0.06, gx = field(p.x + e, p.z) - field(p.x - e, p.z), gz = field(p.x, p.z + e) - field(p.x, p.z - e);
    const gl = Math.hypot(gx, gz) || 1, push = Math.min(0.5, margin - d + 0.03);
    p.x += gx / gl * push; p.z += gz / gl * push;
  }
  return p;
}

/**
 * Offset polyline along a node chain. offset(edge) → distance; side 1 = right-hand lane (as network.lanePoints).
 * closed: chain is a cycle. Returns [{x,z}].
 */
export function chainOffset(ids, offset, side = 1, closed = true) {
  const out = [];
  const n = closed ? ids.length : ids.length - 1;
  for (let i = 0; i < n; i++) {
    const r = edgeBetween(ids[i], ids[(i + 1) % ids.length]); if (!r) continue;
    const pts = r.fwd ? r.edge.pts : [...r.edge.pts].reverse();
    const o = offset(r.edge);
    for (let k = out.length ? 1 : 0; k < pts.length; k++) {
      const a = pts[Math.max(0, k - 1)], b = pts[Math.min(pts.length - 1, k + 1)];
      let tx = b.x - a.x, tz = b.z - a.z; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
      out.push({ x: pts[k].x - tz * o * side, z: pts[k].z + tx * o * side });
    }
  }
  if (!out.length) return [];
  if (closed && out.length > 2) { const a = out[0], b = out[out.length - 1]; if (Math.hypot(a.x - b.x, a.z - b.z) < 0.3) out.pop(); }
  // resample to ~0.5u (drop points bunched at junction corners)
  const res = [out[0]];
  for (const p of out) { const q = res[res.length - 1]; if (Math.hypot(p.x - q.x, p.z - q.z) >= 0.45) res.push(p); }
  return res;
}

/** Sidewalk loops (both sides of every road cycle) + promenades around the organelles. */
export function networkPaths() {
  const paths = [];
  const walk = (e) => e.w / 2 + 0.62;
  const G = graphRoutes();
  for (const ids of G.cycles) for (const side of [1, -1]) {
    let P = chainOffset(ids, walk, side, true).map((p) => fieldFix(p, walkField, 0.35));
    P = smoothPoly(P, true, 3).map((p) => fieldFix(p, walkField, 0.3));
    paths.push(P);
  }
  for (const ids of G.spurs) {
    let P = chainOffset(ids, walk, 1, false).map((p) => fieldFix(p, walkField, 0.35));
    if (P.length > 4) paths.push({ points: smoothPoly(P, false, 3).map((p) => fieldFix(p, walkField, 0.3)), closed: false });
  }
  for (let i = paths.length - 1; i >= 0; i--) { const P = Array.isArray(paths[i]) ? paths[i] : paths[i].points; if (P.length < 6) paths.splice(i, 1); }
  // organelle promenades
  const obs = organelleObstacles();
  for (const o of [obs[1], obs[2], obs[3], obs[4]]) {
    let P = loopAround(o, 1.25, 80).map((p) => fieldFix(p, walkField, 0.35));
    paths.push(smoothPoly(P, true, 3).map((p) => fieldFix(p, walkField, 0.3)));
  }
  return paths;
}

/** Vehicle lanes: right-hand lane of each cycle, plus out-and-back spur routes with turning loops. */
export function networkRoutes() {
  const lane = (e) => Math.min(0.62, e.w * 0.25);
  const G = graphRoutes();
  const routes = G.cycles.map((ids) => ({ points: smoothPoly(chainOffset(ids, lane, 1, true), true, 3), kinds: ['box', 'flatbed'] }));
  const spur = (ids, r = 0.75) => {
    const go = chainOffset(ids, () => r, 1, false), back = chainOffset([...ids].reverse(), () => r, 1, false);
    return smoothPoly([...go, ...back], true, 4);
  };
  for (const ids of G.spurs) {
    const len = ids.slice(1).reduce((L, id, i) => L + (edgeBetween(ids[i], id)?.edge.len || 0), 0);
    if (len > 4) routes.push({ points: spur(ids, 0.6), kinds: len < 14 ? ['forklift'] : ['forklift', 'flatbed'] });
  }
  return routes.filter((r) => r.points.length > 6);
}

/** Work spots near organelles, building doors and loading yards (kept off the asphalt). */
export function networkSpots(count = 56, seed = 3) {
  const rnd = mulberry(seed);
  const obs = organelleObstacles();
  const spots = [];
  const ok = (x, z, gap = 1.0) => insideCell(x, z, 2.2) && roadDist(x, z) > 0.35 && walkField(x, z) > 0.25 && !spots.some((s) => Math.hypot(s.x - x, s.z - z) < gap);
  // at building doors (front faces local +Z)
  for (const b of BUILDINGS) {
    const fx = Math.sin(b.rot), fz = Math.cos(b.rot), rx = Math.cos(b.rot), rz = -Math.sin(b.rot);
    for (const lat of [-0.9, 0.9]) {
      if (rnd() < 0.45) continue;
      const x = b.x + fx * (b.d / 2 + 0.55) + rx * lat * b.w * 0.3, z = b.z + fz * (b.d / 2 + 0.55) + rz * lat * b.w * 0.3;
      if (ok(x, z)) spots.push({ x, z, yaw: b.rot + Math.PI + (rnd() - 0.5) * 0.4, state: rnd() < 0.5 ? 'work' : 'idle' });
    }
  }
  // along organelle walls (consoles), with talking pairs
  let guard = 0;
  while (spots.length < count && guard++ < 6000) {
    const o = obs[Math.floor(rnd() * 11)];
    const ring = loopAround(o, 0.5 + rnd() * 0.3, 120);
    const p = ring[Math.floor(rnd() * ring.length)];
    const others = obs.filter((q) => q !== o);
    if (clearance(p.x, p.z, others) < 0.6 || !ok(p.x, p.z, 1.2)) continue;
    const e = 0.05, gx = obstacleSDF(o, p.x + e, p.z) - obstacleSDF(o, p.x - e, p.z), gz = obstacleSDF(o, p.x, p.z + e) - obstacleSDF(o, p.x, p.z - e);
    const yaw = Math.atan2(-gx, -gz), r = rnd();
    if (r < 0.2) {
      const side = rnd() < 0.5 ? 1 : -1, y2 = yaw + side * Math.PI / 2;
      const q = { x: p.x + Math.sin(y2) * 0.8, z: p.z + Math.cos(y2) * 0.8 };
      if (!ok(q.x, q.z, 0.7)) continue;
      spots.push({ x: p.x, z: p.z, yaw: y2, state: 'talk' }, { x: q.x, z: q.z, yaw: y2 + Math.PI, state: 'talk' });
    } else spots.push({ x: p.x, z: p.z, yaw, state: r < 0.8 ? 'work' : 'idle' });
  }
  return spots.slice(0, count);
}

export function mulberry(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---------------------------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------------------------

export class Path {
  constructor(points, closed = true) {
    this.p = points.map((q) => ({ x: q.x, z: q.z }));
    this.closed = closed;
    const n = this.p.length;
    this.L = [0];
    for (let i = 1; i < n + (closed ? 1 : 0); i++) {
      const a = this.p[i - 1], b = this.p[i % n];
      this.L.push(this.L[i - 1] + Math.hypot(b.x - a.x, b.z - a.z));
    }
    this.len = this.L[this.L.length - 1];
  }
  /** Sample at arc length s → out {x, z, tx, tz}. Open paths ping-pong over 2·len. */
  at(s, out) {
    let dir = 1;
    if (this.closed) s = ((s % this.len) + this.len) % this.len;
    else { const per = 2 * this.len; s = ((s % per) + per) % per; if (s > this.len) { s = per - s; dir = -1; } }
    const L = this.L; let lo = 0, hi = L.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (L[m] <= s) lo = m; else hi = m; }
    const n = this.p.length, a = this.p[lo % n], b = this.p[(lo + 1) % n];
    const seg = L[lo + 1] - L[lo] || 1, f = (s - L[lo]) / seg;
    out.x = a.x + (b.x - a.x) * f; out.z = a.z + (b.z - a.z) * f;
    out.tx = (b.x - a.x) / seg * dir; out.tz = (b.z - a.z) / seg * dir;
    return out;
  }
}

// ---------------------------------------------------------------------------------------------
// Crowd
// ---------------------------------------------------------------------------------------------

const angLerp = (a, b, k) => { let d = b - a; d = Math.atan2(Math.sin(d), Math.cos(d)); return a + d * k; };

/**
 * createCrowd({ count, paths, spots, walkerRatio, seed })
 *  paths: arrays of {x,z} (closed loops) or { points, closed:false } (walked back and forth). Default: provisionalPaths().
 *  spots: [{x, z, yaw, state:'work'|'idle'|'talk'}] stationary workers. Default: provisionalSpots().
 * Returns { object, update(t,dt), setPlayerPosition(v3), pick(raycaster) → index|-1, interact(i, seconds), agents, count, getPosition(i, v3) }
 */
export function createCrowd({ count = 140, paths = null, spots = null, walkerRatio = 0.6, seed = 11 } = {}) {
  const rnd = mulberry(seed);
  const P = (paths || networkPaths()).map((q) => Array.isArray(q) ? new Path(q, true) : new Path(q.points, q.closed !== false));
  const nWalk = Math.round(count * walkerRatio);
  const S = spots || networkSpots(count - nWalk, seed + 1);

  const N = count;
  // GPU skinning: one InstancedMesh for the whole crowd; 11 bone matrices per instance in a float texture
  const boneData = new Float32Array(N * 11 * 16);
  const bones = new THREE.DataTexture(boneData, 44, N, THREE.RGBAFormat, THREE.FloatType);
  bones.needsUpdate = true;
  // LOD: `low` holds every agent (draws far ones; near ones are collapsed in the colour pass but still cast
  // the cheap shadow), `high` holds only the agents near the camera (no shadow → low-poly shadow for all).
  const mat = paintMaterial({ crowd: { bones }, key: 'crowd' });
  const depth = paintDepthMaterial(bones);
  const group = new THREE.Group(); group.name = 'crowd';
  const mkMesh = (geo, name, shadow) => {
    geo.setAttribute('iColA', new THREE.InstancedBufferAttribute(new Float32Array(N * 4), 4).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('iColB', new THREE.InstancedBufferAttribute(new Float32Array(N * 4), 4).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('iAgent', new THREE.InstancedBufferAttribute(new Float32Array(N), 1).setUsage(THREE.DynamicDrawUsage));
    const m = new THREE.InstancedMesh(geo, mat, N);
    m.name = name; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.frustumCulled = false; m.castShadow = shadow; m.receiveShadow = true; m.customDepthMaterial = depth;
    group.add(m); return m;
  };
  const low = mkMesh(buildCrowdLowGeometry(), 'crowdLow', true);
  const body = mkMesh(buildCrowdGeometry(), 'crowdBody', false);
  body.count = 0;
  const geo = low.geometry;
  const colA = new Float32Array(N * 4), colB = new Float32Array(N * 4);

  // ---- agents ----
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const agents = [];
  const pathWeights = P.map((p) => p.len * (p.closed ? 1 : 1.6));
  const wSum = pathWeights.reduce((a, b) => a + b, 0);
  const tmpS = { x: 0, z: 0, tx: 0, tz: 1 };
  for (let i = 0; i < N; i++) {
    const walker = i < nWalk || i - nWalk >= S.length;
    const hairBit = pick(HAIR_BITS);
    let mask = 1 << hairBit;
    const hat = rnd() < 0.2;
    if (hat) mask = (1 << BIT.HAT) | (1 << (rnd() < 0.5 ? BIT.BUZZ : BIT.SHORT));
    const r = rnd();
    if (r < 0.14) mask |= 1 << BIT.GOGGLES; else if (r < 0.32 && hairBit !== BIT.CURLY) mask |= 1 << BIT.GLASSES; // curly+glasses is Dr. Mendel's look
    if (rnd() < 0.55) mask |= 1 << BIT.PEN;
    const hr = rnd();
    const handBit = hr < 0.18 ? BIT.CLIPBOARD : hr < 0.25 ? BIT.TABLET : hr < 0.33 ? BIT.FLASK : 0;
    if (handBit) mask |= 1 << handBit;
    const st = rnd();
    const a = {
      i, walker, seed: rnd() * 10, mask, height: 0.92 + rnd() * 0.16, girth: 0.9 + rnd() * 0.2, hold: handBit ? 1 : 0, holdW: handBit ? 1 : 0,
      style: handBit ? 0 : st < 0.5 ? 0 : st < 0.8 ? 1 : 2,
      x: 0, z: 0, yaw: 0, tyaw: 0, ox: 0, oz: 0, v: 0, vBase: 0.75 + rnd() * 0.45,
      path: null, s: 0, lane: 0, phase: rnd() * 6.28,
      state: 'idle', prev: 'idle', fade: 1, timer: 4 + rnd() * 20, pause: 0, pauseState: 'idle',
      waveCD: rnd() * 4, react: 0, talkT: 0, friendly: rnd() < 0.8, home: null, homeState: 'idle', stateT: 6 + rnd() * 10,
    };
    if (walker) {
      let w = rnd() * wSum, k = 0; while (k < P.length - 1 && w > pathWeights[k]) { w -= pathWeights[k]; k++; }
      a.path = P[k]; a.s = rnd() * a.path.len * (a.path.closed ? 1 : 2);
      a.lane = (rnd() < 0.5 ? -1 : 1) * (0.25 + rnd() * 0.4);
      a.path.at(a.s, tmpS); a.x = tmpS.x - tmpS.tz * a.lane; a.z = tmpS.z + tmpS.tx * a.lane;
      a.yaw = a.tyaw = Math.atan2(tmpS.tx, tmpS.tz); a.v = a.vBase; a.state = a.prev = 'walk';
    } else {
      const sp = S[i - nWalk];
      a.home = sp; a.x = sp.x; a.z = sp.z; a.yaw = a.tyaw = sp.yaw ?? 0; a.homeState = sp.state || 'work';
      a.state = a.prev = a.homeState;
    }
    agents.push(a);
    // colours
    const skin = pick(SKIN_TONES), hair = pick(HAIR_COLORS), acc = pick(HAT_COLORS), pants = pick(PANTS_COLORS), shirt = pick(SHIRT_COLORS), coat = pick(COAT_COLORS), shoe = pick(SHOE_COLORS);
    const lowMask = mask | (hat ? 0 : 1 << BIT.HAIRLOW);
    colA.set([packColor(skin), packColor(hair), packColor(acc), lowMask], i * 4);
    colB.set([packColor(pants), packColor(shirt), packColor(coat), packColor(shoe)], i * 4);
    geo.attributes.iColA.setXYZW(i, colA[i * 4], colA[i * 4 + 1], colA[i * 4 + 2], lowMask);
    geo.attributes.iColB.setXYZW(i, colB[i * 4], colB[i * 4 + 1], colB[i * 4 + 2], colB[i * 4 + 3]);
    geo.attributes.iAgent.setX(i, i + 1);
  }

  // ---- per-frame ----
  const player = new THREE.Vector3(1e6, 0, 1e6);
  const avoid = [player];
  const pA = new Float32Array(NCH), pB = new Float32Array(NCH);
  const mRoot = new THREE.Matrix4(), v = new THREE.Vector3();
  const setState = (a, s) => { if (a.state !== s) { a.prev = a.state; a.state = s; a.fade = 0; } };

  function behave(a, t, dt) {
    const dxp = player.x - a.x, dzp = player.z - a.z, dp = Math.hypot(dxp, dzp);
    a.waveCD -= dt;
    if (a.talkT > 0) { // clicked: chat with the player
      a.talkT -= dt; a.tyaw = Math.atan2(dxp, dzp); a.vT = 0; setState(a, 'talk'); return;
    }
    if (a.react <= 0 && a.waveCD <= 0 && dp < 3 && dp > 1.6) { // wave from a polite distance, never at elbow range
      a.waveCD = 12 + rnd() * 12;
      if (a.friendly) a.react = 2.4 + rnd() * 0.8;
    }
    if (a.react > 0) {
      a.react -= dt; a.tyaw = Math.atan2(dxp, dzp); a.vT = 0;
      setState(a, a.react > 0.35 ? 'wave' : (a.walker ? 'idle' : a.homeState)); return;
    }
    if (a.walker) {
      a.timer -= dt;
      if (a.pause > 0) { a.pause -= dt; a.vT = 0; setState(a, a.pauseState); return; }
      if (a.timer <= 0) {
        a.timer = 10 + rnd() * 25;
        if (rnd() < 0.55) { a.pause = 2 + rnd() * 4; const r = rnd(); a.pauseState = r < 0.6 ? 'idle' : r < 0.85 ? 'talk' : 'point'; }
      }
      a.vT = a.vBase;
      if (a.v > 0.12) setState(a, 'walk');
    } else {
      a.vT = 0;
      a.stateT -= dt;
      if (a.stateT <= 0) {
        a.stateT = 6 + rnd() * 12;
        if (a.homeState === 'work') a.curHome = rnd() < 0.75 ? 'work' : 'idle';
        else if (a.homeState === 'idle') a.curHome = rnd() < 0.7 ? 'idle' : 'point';
        else a.curHome = 'talk';
      }
      a.tyaw = a.home.yaw ?? a.tyaw;
      setState(a, a.curHome || a.homeState);
    }
  }

  // ---- LOD selection (hysteresis; all-low from high/overview cameras) ----
  const camPos = new THREE.Vector3();
  const LOD_IN = 13, LOD_OUT = 16, MAX_HIGH = 28;
  const hiList = [];
  function selectLOD(camera) {
    hiList.length = 0;
    if (camera) {
      camera.getWorldPosition(camPos);
      if (camPos.y < 30) {
        for (const a of agents) {
          const d = Math.hypot(a.x - camPos.x, a.z - camPos.z, camPos.y * 0.6);
          a.hi = a.hi ? d < LOD_OUT : d < LOD_IN; a.camD = d;
          if (a.hi) hiList.push(a);
        }
        if (hiList.length > MAX_HIGH) { hiList.sort((p, q) => p.camD - q.camD); for (const a of hiList.splice(MAX_HIGH)) a.hi = false; }
      } else for (const a of agents) a.hi = false;
    }
    const lA = low.geometry.attributes.iAgent, hg = body.geometry.attributes;
    for (const a of agents) lA.array[a.i] = a.hi ? -(a.i + 1) : a.i + 1;
    hiList.forEach((a, k) => {
      hg.iAgent.array[k] = a.i + 1;
      for (let c = 0; c < 4; c++) { hg.iColA.array[k * 4 + c] = colA[a.i * 4 + c]; hg.iColB.array[k * 4 + c] = colB[a.i * 4 + c]; }
      hg.iColA.array[k * 4 + 3] = a.mask;
    });
    body.count = hiList.length;
    lA.needsUpdate = true; hg.iAgent.needsUpdate = hg.iColA.needsUpdate = hg.iColB.needsUpdate = true;
  }

  function update(t, dt, camera) {
    dt = Math.min(dt, 0.05);
    selectLOD(camera);
    for (const a of agents) behave(a, t, dt);
    // light avoidance (pairwise, cheap for ~140)
    for (let i = 0; i < N; i++) {
      const a = agents[i]; a.slow = 1;
      for (let j = i + 1; j < N; j++) {
        const b = agents[j];
        const dx = b.x - a.x, dz = b.z - a.z;
        if (Math.abs(dx) > 0.8 || Math.abs(dz) > 0.8) continue;
        const d = Math.hypot(dx, dz) || 1e-3;
        if (d < 0.62) {
          const push = (0.62 - d) * 1.6 * dt / d;
          if (a.walker) { a.ox -= dx * push; a.oz -= dz * push; }
          if (b.walker) { b.ox += dx * push; b.oz += dz * push; }
          // slow down if someone is right ahead
          const fa = Math.sin(a.yaw) * dx + Math.cos(a.yaw) * dz;
          if (a.walker && fa > 0.2 && d < 0.55) a.slow = Math.min(a.slow, 0.45);
          const fb = -(Math.sin(b.yaw) * dx + Math.cos(b.yaw) * dz);
          if (b.walker && fb > 0.2 && d < 0.55) b.slow = Math.min(b.slow ?? 1, 0.45);
        }
      }
    }
    for (const a of agents) {
      const k = 1 - Math.exp(-dt * 4);
      a.v += ((a.vT || 0) * (a.slow ?? 1) - a.v) * k;
      if (a.walker) {
        a.s += a.v * dt;
        a.path.at(a.s, tmpS);
        a.ox *= Math.exp(-dt * 0.8); a.oz *= Math.exp(-dt * 0.8);
        // personal space: walkers step around the visitor and the guide instead of walking through them
        for (const q of avoid) {
          const ex = a.x - q.x, ez = a.z - q.z, ed = Math.hypot(ex, ez);
          if (ed < 1.3 && ed > 1e-3) { const push = (1.3 - ed) * 3.2 * dt / ed; a.ox += ex * push; a.oz += ez * push; }
        }
        const tx = tmpS.x - tmpS.tz * a.lane + a.ox, tz = tmpS.z + tmpS.tx * a.lane + a.oz;
        a.x += (tx - a.x) * Math.min(1, dt * 8); a.z += (tz - a.z) * Math.min(1, dt * 8);
        if (a.v > 0.08 && a.react <= 0 && a.talkT <= 0 && a.pause <= 0) a.tyaw = Math.atan2(tmpS.tx, tmpS.tz);
      }
      a.yaw = angLerp(a.yaw, a.tyaw, 1 - Math.exp(-dt * 5));
      a.fade = Math.min(1, a.fade + dt * 3.2);
      a.phase += dt * Math.PI * 2 * Math.max(a.v, 0.0) / stride(0);
      // pose blend
      const f = a.fade * a.fade * (3 - 2 * a.fade);
      poseOf(a.state, pA, t, a.phase, a.seed, a.style);
      if (f < 1) { poseOf(a.prev, pB, t, a.phase, a.seed, a.style); for (let c = 0; c < NCH; c++) pA[c] = pB[c] + (pA[c] - pB[c]) * f; }
      if (a.hold) {
        const tgt = a.state === 'wave' || a.state === 'talk' || a.state === 'point' || a.state === 'idle' ? 1 : a.state === 'work' ? 0.3 : 0.85;
        a.holdW += (tgt - a.holdW) * (1 - Math.exp(-dt * 5));
        applyHold(pA, a.holdW);
      }
      pA[CH.bob] += groundBob(pA);
      writeMatrices(a, pA);
    }
    hiList.forEach((a, k) => { low.getMatrixAt(a.i, mRoot); body.setMatrixAt(k, mRoot); });
    low.instanceMatrix.needsUpdate = true; body.instanceMatrix.needsUpdate = true; bones.needsUpdate = true;
    if (lineup) lineup.update(t, dt);
  }

  function writeMatrices(a, p) {
    mRoot.makeRotationY(a.yaw).scale(v.set(a.girth, a.height, a.girth)).setPosition(a.x, 0, a.z);
    low.setMatrixAt(a.i, mRoot);
    poseSkinMatrices(p, boneData, a.i * 176);
  }

  // optional QA lineup (?lineup=1&lx=..&lz=..): one hero figure per animation state + player + guide
  const lineup = new URLSearchParams(globalThis.location?.search || '').get('lineup') === '1' ? makeLineup(group) : null;

  // ---- picking: ray vs. per-worker capsule ----
  const segA = new THREE.Vector3(), segB = new THREE.Vector3(), onRay = new THREE.Vector3();
  function pickFn(raycaster, maxDist = 200) {
    const ray = raycaster.ray; let best = -1, bestT = Infinity;
    for (const a of agents) {
      segA.set(a.x, 0.15, a.z); segB.set(a.x, 0.98, a.z);
      const d2 = ray.distanceSqToSegment(segA, segB, onRay);
      if (d2 < 0.22 * 0.22) { const tt = onRay.distanceTo(ray.origin); if (tt < bestT && tt < maxDist) { bestT = tt; best = a.i; } }
    }
    return best;
  }

  update(0, 1 / 60);
  return {
    object: group, agents, count: N, paths: P,
    update,
    setPlayerPosition: (p) => player.set(p.x, p.y || 0, p.z),
    /** Extra people walkers keep personal space from (e.g. the guide). */
    setAvoid: (list) => { avoid.length = 0; avoid.push(player, ...list); },
    pick: pickFn,
    /** Make worker i stop, face the player and talk for `seconds`. */
    interact: (i, seconds = 4) => { const a = agents[i]; if (a) { a.talkT = seconds; a.react = 0; } },
    getPosition: (i, out = new THREE.Vector3()) => out.set(agents[i].x, 0, agents[i].z),
    meshes: { body, low },
    /** Number of agents currently drawn with the full-detail mesh. */
    get highCount() { return hiList.length; },
  };
}

function makeLineup(group) {
  const q = new URLSearchParams(location.search);
  const X = +(q.get('lx') ?? 46), Z = +(q.get('lz') ?? 0), Y = +(q.get('ly') ?? -1.6);
  const looks = [
    { hairStyle: 'short', hat: true, accent: 0xf2c12e, clipboard: true, hold: 'left', pants: 0x6b707a },
    { hairStyle: 'pony', skin: 0xf3d0b5, hair: 0xc89b5a, shirt: 0xe58fa8, goggles: true, pants: 0x8f7c5a },
    { hairStyle: 'curly', skin: 0x8d5a36, hair: 0x1a1a1f, shirt: 0x7fc4c8, idleStyle: 1 },
    { hairStyle: 'long', skin: 0xe8b894, hair: 0xa8452a, shirt: 0x8fc0a0, idleStyle: 2, pants: 0x2f5a52 },
    { hairStyle: 'buzz', skin: 0xb57a4d, hat: true, accent: 0xf08a24, pants: 0x4a4f58 },
    { hairStyle: 'bun', skin: 0xf6dcc8, hair: 0x5b3a22, flask: true, hold: 'left', build: 1.1 },
    { hairStyle: 'short', skin: 0x6b4128, hair: 0x1a1a1f, shirt: 0xe6b35a, glasses: true, scale: 1.07 },
  ];
  const figs = STATES.map((s, i) => { const f = createFigure({ ...looks[i], seed: i * 0.13 }); f.position.set(X - 3 + i, Y, Z); group.add(f); return { f, s }; });
  const player = createPlayer(); player.position.set(X - 1.2, Y, Z + 1.6); group.add(player);
  const guide = createGuide(); guide.position.set(X + 0.3, Y, Z + 1.6); guide.rotation.y = -0.5; group.add(guide);
  const st = { player: q.get('pstate') || 'idle', guide: q.get('gstate') || 'talk' };
  globalThis.__lifeLineup = { figs, player, guide, st };
  return { update: (t, dt) => { for (const { f, s } of figs) f.animate(s, t, dt); player.animate(st.player, t, dt); guide.animate(st.guide, t, dt); } };
}
