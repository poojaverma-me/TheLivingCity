// Road network of the Living City: named junction nodes + road edges (smoothed polylines with widths).
// Used by roads.js for rendering and by traffic / worker systems for pathfinding.
//
//   import { NETWORK, ROADS, nearestNode, pathBetween, pathPoints } from './world/city/network.js';
//   NETWORK.nodes  [{ id, x, z, kind }]                       kind: 'junction' | 'end' | 'gate' | 'entry'
//   NETWORK.edges  [{ a, b, w, len, pts:[{x,z}], kind }]      pts run from node a to node b (≈0.5u spacing)
//   nearestNode(x, z, filter?) -> node                        filter(node) => bool (optional)
//   pathBetween(aId, bId)      -> [nodeId, ...] | null        A* over edge lengths
//   pathPoints(ids)            -> [{x, z}, ...]                dense centre-line polyline along the path
//   lanePoints(ids, side=1)    -> same, offset to the right-hand lane (side=-1 for left)
import { GATES, RER } from '../layout.js';
import { membranePoint } from '../membrane.js';

const D = Math.PI / 180;
const gate = (id, off) => { const g = GATES.find((q) => q.id === id); const p = membranePoint(g.angle, -off); return [p.x, p.z]; };
// Inner ring: an arterial arc hugging the rough-ER terraces in front of the nucleus.
const RER_OUT = RER.rings[RER.rings.length - 1] + 1.6;
export const INNER_RING_R = RER_OUT + 1.55;
const ir = (deg, dr = 0) => [RER.cx + Math.cos(deg * D) * (INNER_RING_R + dr), RER.cz + Math.sin(deg * D) * (INNER_RING_R + dr)];
const arc = (a0, a1, step = 5) => { const out = []; const n = Math.max(1, Math.round(Math.abs(a1 - a0) / step)); for (let k = 1; k < n; k++) out.push(ir(a0 + (a1 - a0) * k / n)); return out; };
const AV = RER.ramp.angle / D;

/** Junctions / ends. kind: junction | gate | entry (dock / district door) | ramp */
const N = {
  ramp: { p: ir(AV, -1.8), kind: 'ramp', label: 'Nucleus avenue ramp' },
  avenue: { p: ir(AV), kind: 'junction', label: 'Nucleus avenue' },
  gateF: { p: gate('front', 1.1), kind: 'gate', label: 'Front gate' },
  gateL: { p: gate('left', 1.2), kind: 'gate', label: 'Left service gate' },
  portFR: { p: gate('portFR', 2.6), kind: 'gate', label: 'Vesicle port (front-right)' },
  portR: { p: gate('portR', 2.6), kind: 'gate', label: 'Vesicle port (right)' },
  // inner ring
  jV: { p: ir(128), kind: 'junction' },
  irG: { p: ir(84), kind: 'junction' },
  jC: { p: ir(66), kind: 'junction' },
  // Main Street (radial spine)
  jF: { p: [-4.4, 41.6], kind: 'junction' },
  jM2: { p: [-2.6, 33.4], kind: 'junction' },
  jG: { p: [-1.0, 23.4], kind: 'junction' },
  jM1: { p: [-5.6, 11.4], kind: 'junction' },
  // east boulevard + outer ring
  ser: { p: [19.8, 6.1], kind: 'entry', label: 'Smooth ER' },
  jR9: { p: [25.6, 8.4], kind: 'junction' },
  jR25: { p: [24.2, 25.4], kind: 'junction' },
  jR33: { p: [21.0, 32.6], kind: 'junction' },
  jPR: { p: [15.6, 38.2], kind: 'junction' },
  jPF: { p: [7.8, 42.4], kind: 'junction' },
  jFL: { p: [-13.0, 39.2], kind: 'junction' },
  ringW: { p: [-20.2, 35.8], kind: 'entry', label: 'Power plant B yard' },
  // district docks
  mito1: { p: [-8.6, 13.4], kind: 'entry', label: 'Mitochondrion A' },
  mito2: { p: [-9.4, 35.2], kind: 'entry', label: 'Mitochondrion B' },
  golgiF: { p: [8.6, 24.6], kind: 'junction', label: 'Golgi shipping hall' },
  golgiDock: { p: [9.4, 22.4], kind: 'entry', label: 'Golgi loading dock' },
  golgiB: { p: [6.0, 4.9], kind: 'entry', label: 'Golgi receiving dock' },
  jFS: { p: [8.2, 32.4], kind: 'junction' },
  // west storage yard (vacuoles / lysosome) + back-left works
  westYard: { p: [-21.0, -1.4], kind: 'junction', label: 'Storage yard' },
  lyso1: { p: [-24.0, 0.4], kind: 'entry', label: 'Lysosome west' },
  lysoDock: { p: [-21.4, 2.8], kind: 'entry', label: 'Lysosome intake dock' },
  backYard: { p: [-25.6, -18.6], kind: 'entry', label: 'Back-left works' },
};

/** Roads: a -> b through via control points. w = asphalt width. walk = sidewalks. */
const R = [
  // inner ring (arterial arc around the ER terraces)
  { a: 'jV', b: 'avenue', via: arc(128, AV), w: 2.9, kind: 'ring', walk: true },
  { a: 'avenue', b: 'irG', via: arc(AV, 84), w: 2.9, kind: 'ring', walk: true },
  { a: 'irG', b: 'jC', via: arc(84, 66), w: 2.9, kind: 'ring', walk: true },
  { a: 'avenue', b: 'ramp', via: [], w: 3.0, kind: 'spine' },
  // Main Street: radial boulevard from the nucleus avenue to the front gate
  { a: 'avenue', b: 'jM1', via: [[-2.75, 0.4], [-2.7, 3.4], [-4.25, 6.9]], w: 2.0, kind: 'spine' },
  { a: 'jM1', b: 'jG', via: [[-2.6, 15.0], [-0.4, 19.4]], w: 2.2, kind: 'spine' },
  { a: 'jG', b: 'jM2', via: [[-1.6, 28.4]], w: 2.4, kind: 'spine', walk: true },
  { a: 'jM2', b: 'jF', via: [[-3.4, 37.4]], w: 2.6, kind: 'spine', walk: true },
  { a: 'jF', b: 'gateF', via: [], w: 2.8, kind: 'spine', walk: true },
  // east boulevard: inner ring -> SER -> outer ring
  { a: 'jC', b: 'ser', via: [[10.4, -1.4], [10.9, 2.5], [13.8, 4.9], [17.2, 6.1]], w: 2.4, kind: 'avenue', walk: true },
  { a: 'ser', b: 'jR9', via: [[23.4, 5.6]], w: 2.4, kind: 'avenue', walk: true },
  // outer ring (inside the membrane)
  { a: 'jR9', b: 'jR25', via: [[24.8, 14.2], [21.5, 20.9]], w: 2.5, kind: 'ring' },
  { a: 'jR25', b: 'jR33', via: [[23.0, 29.2]], w: 2.9, kind: 'ring', walk: true },
  { a: 'jR33', b: 'jPR', via: [[18.6, 35.8]], w: 2.9, kind: 'ring', walk: true },
  { a: 'jPR', b: 'jPF', via: [[11.8, 40.8]], w: 2.9, kind: 'ring', walk: true },
  { a: 'jPF', b: 'jF', via: [[1.8, 43.6]], w: 2.9, kind: 'ring', walk: true },
  { a: 'jF', b: 'jFL', via: [[-8.6, 41.2]], w: 2.9, kind: 'ring', walk: true },
  { a: 'jFL', b: 'ringW', via: [[-16.8, 38.2]], w: 2.3, kind: 'ring' },
  // port spurs
  { a: 'jPR', b: 'portR', via: [], w: 2.0, kind: 'spur' },
  { a: 'jPF', b: 'portFR', via: [], w: 2.0, kind: 'spur' },
  // secondary streets
  { a: 'jG', b: 'golgiF', via: [[3.4, 24.6]], w: 2.2, kind: 'street', walk: true },
  { a: 'golgiF', b: 'jR25', via: [[16.6, 27.2]], w: 2.2, kind: 'street', walk: true },
  { a: 'jM2', b: 'jFS', via: [[3.0, 32.6]], w: 2.0, kind: 'street', walk: true },
  { a: 'jFS', b: 'jR33', via: [[14.6, 32.4]], w: 2.0, kind: 'street', walk: true },
  { a: 'jFS', b: 'jPF', via: [[8.0, 37.4]], w: 1.8, kind: 'street', walk: true },
  // service lanes to district docks
  { a: 'irG', b: 'golgiB', via: [[3.3, 0.6]], w: 2.4, kind: 'avenue', walk: true },
  { a: 'golgiF', b: 'golgiDock', via: [], w: 2.0, kind: 'service' },
  { a: 'jM2', b: 'mito2', via: [[-6.0, 34.6]], w: 2.0, kind: 'service' },
  { a: 'jM1', b: 'mito1', via: [], w: 1.8, kind: 'service' },
  // west: inner ring -> storage yard -> lysosome / vacuole docks; lane to the left service gate
  { a: 'jV', b: 'westYard', via: [[-17.8, -3.6]], w: 2.2, kind: 'avenue', walk: true },
  { a: 'westYard', b: 'lyso1', via: [], w: 1.8, kind: 'service' },
  { a: 'westYard', b: 'lysoDock', via: [], w: 1.8, kind: 'service' },
  { a: 'jV', b: 'backYard', via: [[-18.2, -11.0], [-22.0, -14.4]], w: 1.5, kind: 'lane' },
  { a: 'backYard', b: 'gateL', via: [], w: 1.6, kind: 'lane' },
];

// ---------- smoothing ----------
function catmull(points, step = 0.5) {
  // centripetal-ish uniform Catmull-Rom through all points, endpoints duplicated
  const P = points.map(([x, z]) => ({ x, z }));
  if (P.length === 2) {
    const out = []; const L = Math.hypot(P[1].x - P[0].x, P[1].z - P[0].z); const n = Math.max(2, Math.ceil(L / step));
    for (let i = 0; i <= n; i++) out.push({ x: P[0].x + (P[1].x - P[0].x) * i / n, z: P[0].z + (P[1].z - P[0].z) * i / n });
    return out;
  }
  const ext = [{ x: 2 * P[0].x - P[1].x, z: 2 * P[0].z - P[1].z }, ...P, { x: 2 * P[P.length - 1].x - P[P.length - 2].x, z: 2 * P[P.length - 1].z - P[P.length - 2].z }];
  const out = [P[0]];
  for (let i = 1; i < ext.length - 2; i++) {
    const p0 = ext[i - 1], p1 = ext[i], p2 = ext[i + 1], p3 = ext[i + 2];
    const L = Math.hypot(p2.x - p1.x, p2.z - p1.z); const n = Math.max(2, Math.ceil(L / step));
    for (let k = 1; k <= n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push({ x: f(p0.x, p1.x, p2.x, p3.x), z: f(p0.z, p1.z, p2.z, p3.z) });
    }
  }
  return out;
}

const polyLen = (pts) => { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z); return L; };

export const NETWORK = {
  nodes: Object.entries(N).map(([id, n]) => ({ id, x: n.p[0], z: n.p[1], kind: n.kind, label: n.label || null })),
  edges: R.map((r) => {
    const pts = catmull([N[r.a].p, ...r.via, N[r.b].p]);
    return { a: r.a, b: r.b, w: r.w, kind: r.kind, walk: !!r.walk, pts, len: polyLen(pts) };
  }),
};
const nodeById = new Map(NETWORK.nodes.map((n) => [n.id, n]));
const adj = new Map(NETWORK.nodes.map((n) => [n.id, []]));
NETWORK.edges.forEach((e, i) => { adj.get(e.a).push({ to: e.b, e: i, fwd: true }); adj.get(e.b).push({ to: e.a, e: i, fwd: false }); });
NETWORK.nodes.forEach((n) => { n.degree = adj.get(n.id).length; });
NETWORK.node = (id) => nodeById.get(id);
NETWORK.neighbors = (id) => adj.get(id).map((a) => a.to);

/** Road polylines (for rendering / sampling): [{ id, w, kind, pts }] */
export const ROADS = NETWORK.edges.map((e) => ({ id: `${e.a}-${e.b}`, w: e.w, kind: e.kind, walk: e.walk, pts: e.pts, a: e.a, b: e.b }));

export function nearestNode(x, z, filter = null) {
  let best = null, bd = Infinity;
  for (const n of NETWORK.nodes) { if (filter && !filter(n)) continue; const d = (n.x - x) ** 2 + (n.z - z) ** 2; if (d < bd) { bd = d; best = n; } }
  return best;
}

/** A* shortest path between node ids. Returns array of node ids or null. */
export function pathBetween(aId, bId) {
  if (!nodeById.has(aId) || !nodeById.has(bId)) return null;
  const goal = nodeById.get(bId);
  const h = (id) => { const n = nodeById.get(id); return Math.hypot(n.x - goal.x, n.z - goal.z); };
  const g = new Map([[aId, 0]]), came = new Map(), open = new Set([aId]), f = new Map([[aId, h(aId)]]);
  while (open.size) {
    let cur = null, cf = Infinity;
    for (const id of open) { const v = f.get(id); if (v < cf) { cf = v; cur = id; } }
    if (cur === bId) { const path = [cur]; while (came.has(cur)) { cur = came.get(cur); path.unshift(cur); } return path; }
    open.delete(cur);
    for (const { to, e } of adj.get(cur)) {
      const ng = g.get(cur) + NETWORK.edges[e].len;
      if (ng < (g.get(to) ?? Infinity)) { came.set(to, cur); g.set(to, ng); f.set(to, ng + h(to)); open.add(to); }
    }
  }
  return null;
}

/** Edge between two adjacent nodes (with direction flag). */
export function edgeBetween(aId, bId) {
  const l = adj.get(aId)?.find((q) => q.to === bId);
  return l ? { edge: NETWORK.edges[l.e], fwd: l.fwd } : null;
}

/** Dense centre-line polyline for a node path. */
export function pathPoints(ids) {
  const out = [];
  for (let i = 0; i < ids.length - 1; i++) {
    const r = edgeBetween(ids[i], ids[i + 1]); if (!r) continue;
    const pts = r.fwd ? r.edge.pts : [...r.edge.pts].reverse();
    out.push(...(out.length ? pts.slice(1) : pts));
  }
  return out;
}

/** Polyline offset to a driving lane (side=1 right-hand traffic). */
export function lanePoints(ids, side = 1, offset = null) {
  const pts = pathPoints(ids);
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    let tx = b.x - a.x, tz = b.z - a.z; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
    const o = offset ?? 0.5;
    // right of travel direction (x right, z toward camera): (-tz, tx) is left in XZ when viewed from above with +Z down
    return { x: p.x - tz * o * side, z: p.z + tx * o * side };
  });
}

/** Distance from (x,z) to the nearest road edge surface (negative = on the asphalt). */
export function roadDist(x, z) {
  let best = Infinity;
  for (const e of NETWORK.edges) {
    const pts = e.pts;
    for (let i = 1; i < pts.length; i++) {
      const ax = pts[i - 1].x, az = pts[i - 1].z, bx = pts[i].x, bz = pts[i].z;
      const dx = bx - ax, dz = bz - az; const L2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
      const d = Math.hypot(x - ax - dx * t, z - az - dz * t) - e.w / 2;
      if (d < best) best = d;
    }
  }
  return best;
}
