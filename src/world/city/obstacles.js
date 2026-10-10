// Organelle footprints as signed-distance helpers (pure math, no three.js) so the city fabric can
// keep clear of every district. Distances are in world units; negative = inside a footprint.
import { NUCLEUS, RER, SER, GOLGI, MITO, LYSO, VACUOLES, VESICLES, insideCell } from '../layout.js';
import { LIVE_FOOTPRINTS, APRONS } from './liveFootprints.js';

const RER_R = RER.rings[RER.rings.length - 1] + 1.6; // outer terrace edge (~25.1)

function boxSD(x, z, cx, cz, w, d, rot) {
  // rot = THREE Y rotation: local +X -> world (cos, -sin)
  const c = Math.cos(rot), s = Math.sin(rot);
  const dx = x - cx, dz = z - cz;
  const lx = dx * c - dz * s, lz = dx * s + dz * c;
  const qx = Math.abs(lx) - w / 2, qz = Math.abs(lz) - d / 2;
  const ox = Math.max(qx, 0), oz = Math.max(qz, 0);
  return Math.hypot(ox, oz) + Math.min(Math.max(qx, qz), 0);
}

function capsuleSD(x, z, m) {
  const c = Math.cos(m.rot), s = Math.sin(m.rot);
  const ax = c, az = -s; // long axis
  const h = Math.max(0, m.len / 2 - m.wid / 2);
  const dx = x - m.x, dz = z - m.z;
  const t = Math.max(-h, Math.min(h, dx * ax + dz * az));
  return Math.hypot(dx - ax * t, dz - az * t) - m.wid / 2;
}

/** List of named footprint SDFs. */
export const OBSTACLES = [
  { id: 'rer', sd: (x, z) => Math.hypot(x - RER.cx, z - RER.cz) - RER_R },
  { id: 'ser', sd: (x, z) => boxSD(x, z, SER.x, SER.z, SER.w, SER.d, SER.rot) },
  // Golgi: the built crescent's live footprints replace the layout box when available
  ...(LIVE_FOOTPRINTS.some((f) => f.src === 'golgi') ? [] : [{ id: 'golgi', sd: (x, z) => boxSD(x, z, GOLGI.x, GOLGI.z, GOLGI.w, GOLGI.d, GOLGI.rot) }]),
  ...MITO.map((m, i) => ({ id: `mito${i}`, sd: (x, z) => capsuleSD(x, z, m) })),
  ...LYSO.map((l, i) => ({ id: `lyso${i}`, sd: (x, z) => Math.hypot(x - l.x, z - l.z) - (l.r + 0.6) })),
  ...VACUOLES.map((l, i) => ({ id: `vac${i}`, sd: (x, z) => Math.hypot(x - l.x, z - l.z) - (l.r + 0.6) })),
  ...VESICLES.map((l, i) => ({ id: `ves${i}`, sd: (x, z) => Math.hypot(x - l.x, z - l.z) - (l.r + 0.25) })),
];

/** Snapshot of the built districts' own footprints (see liveFootprints.js). */
export const LIVE = LIVE_FOOTPRINTS.map((f) => ({
  id: `live:${f.src}`, src: f.src,
  sd: f.type === 'circle' ? (x, z) => Math.hypot(x - f.x, z - f.z) - f.r
    : f.type === 'capsule' ? (x, z) => { const dx = f.bx - f.ax, dz = f.bz - f.az, L2 = dx * dx + dz * dz || 1; const t = Math.max(0, Math.min(1, ((x - f.ax) * dx + (z - f.az) * dz) / L2)); return Math.hypot(x - f.ax - dx * t, z - f.az - dz * t) - f.r; }
    : (x, z) => boxSD(x, z, f.x, f.z, f.w, f.d, f.rot),
}));

/**
 * Min signed distance to any organelle footprint (optionally skipping ids).
 * roads=true ignores the conservative mitochondria bounding boxes (capsule walls are used instead).
 */
export function organelleDist(x, z, skip = null, roads = false) {
  let d = Infinity;
  for (const o of OBSTACLES) { if (skip && skip.includes(o.id)) continue; const v = o.sd(x, z); if (v < d) d = v; }
  for (const o of LIVE) { if (roads && o.src === 'mitochondria') continue; const v = o.sd(x, z); if (v < d) d = v; }
  return d;
}

// Golgi shipping forecourt (concave front between the loading dock and the launch pad) stays open for the hero view.
const forecourt = (() => {
  const d = APRONS.find((q) => q.id === 'golgiLoadingDock'), p = APRONS.find((q) => q.id === 'golgiLaunchPad');
  return d && p ? [{ id: 'golgiForecourt', x: (d.x + p.x) / 2 - 0.6, z: (d.z + p.z) / 2 + 1.6, r: 5.2 }] : [];
})();
const ALL_APRONS = [...APRONS, ...forecourt];

/** Distance outside the keep-clear aprons in front of district docks / entrances (negative = inside). */
export function apronDist(x, z) { let d = Infinity; for (const a of ALL_APRONS) d = Math.min(d, Math.hypot(x - a.x, z - a.z) - a.r); return d; }
export { APRONS };

/** Approx distance from the membrane's inner face (positive inside). */
export function membraneDist(x, z) {
  if (!insideCell(x, z, 0)) return -1;
  let lo = 0, hi = 12;
  if (insideCell(x, z, hi)) return hi;
  for (let k = 0; k < 14; k++) { const m = (lo + hi) / 2; insideCell(x, z, m) ? (lo = m) : (hi = m); }
  return lo;
}

/** Free clearance at a point: min of organelle and membrane distance. */
export function clearance(x, z, skip = null) { return Math.min(organelleDist(x, z, skip), membraneDist(x, z)); }

export { RER_R, NUCLEUS };
