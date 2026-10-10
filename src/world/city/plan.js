// City plan: hand-placed landmark buildings + a deterministic lot filler (6–8 archetypes) that packs the
// free land between districts, keeping clear of organelle footprints/aprons, roads + sidewalks and the membrane.
import { organelleDist, membraneDist, apronDist } from './obstacles.js';
import { NETWORK, roadDist } from './network.js';
import { mulberry32 } from '../../core/noise.js';
const D = Math.PI / 180;

// Palette for the miniature industrial fabric
export const COL = {
  white: 0xf3f4f6, cream: 0xf1e7d2, pale: 0xdfe3e8, bluegrey: 0xa9bacb, steel: 0x8f9cab, sand: 0xe6d9bf,
  teal: 0x1fb3a8, orange: 0xff7f2a, yellow: 0xf4c21f, blue: 0x2f78e0, red: 0xe0423a, purple: 0x9156e0, green: 0x5cb83a, pink: 0xe56aa0,
};

/**
 * Hand-placed buildings. style: lab | depot | pump | kiosk | tower | factory | tanks | containers.
 * rot is a THREE Y rotation (radians). The front (door) faces local +Z.
 */
const HAND = [
  // front-right blocks (between the front street, the Golgi road and the ring)
  { id: 'b1', x: 3.6, z: 37.4, w: 4.2, d: 3.0, h: 3.2, rot: 0, style: 'lab', body: COL.white, accent: COL.teal, sign: 'GENE LAB' },
  { id: 'b2', x: 11.4, z: 35.4, w: 3.2, d: 2.8, h: 2.8, rot: 8 * D, style: 'depot', body: COL.bluegrey, accent: COL.yellow, sign: 'CARGO 2' },
  { id: 'b4', x: 4.6, z: 29.0, w: 4.8, d: 2.6, h: 3.4, rot: 180 * D, style: 'lshape', body: COL.cream, accent: COL.blue, sign: 'PROTEIN QC' },
  { id: 'b5', x: 11.2, z: 29.4, w: 4.0, d: 2.6, h: 2.6, rot: 180 * D, style: 'depot', body: COL.pale, accent: COL.orange, sign: 'DEPOT 5' },
  { id: 'b6', x: 17.4, z: 29.9, w: 2.8, d: 2.0, h: 3.6, rot: 180 * D, style: 'tower', body: COL.white, accent: COL.pink, sign: 'EXPORT' },
  // front-left / gate quarter
  { id: 'b8', x: -7.6, z: 37.9, w: 3.0, d: 2.0, h: 2.6, rot: 180 * D, style: 'kiosk', body: COL.white, accent: COL.orange, sign: 'GATE CTRL' },
  { id: 'b19', x: -11.4, z: 43.1, w: 3.0, d: 2.2, h: 2.8, rot: 160 * D, style: 'factory', body: COL.sand, accent: COL.green, sign: 'INTAKE' },
  { id: 'b22', x: -15.2, z: 42.0, w: 2.4, d: 1.8, h: 2.4, rot: 140 * D, style: 'pump', body: COL.pale, accent: COL.teal, sign: 'PUMP 1' },
  { id: 'b26', x: -7.8, z: 44.8, w: 1.8, d: 1.6, h: 2.4, rot: 180 * D, style: 'kiosk', body: COL.white, accent: COL.blue, sign: 'VISITORS' },
  { id: 'b27', x: -0.2, z: 36.6, w: 1.4, d: 1.8, h: 3.8, rot: -90 * D, style: 'tower', body: COL.cream, accent: COL.red, sign: 'NEWS' },
  // central quarter (between the boulevards, Golgi and SER)
  { id: 'b11', x: 20.4, z: 15.4, w: 2.0, d: 2.4, h: 3.2, rot: -70 * D, style: 'tower', body: COL.pale, accent: COL.blue, sign: 'RELAY' },
  { id: 'b17', x: -13.5, z: 17.0, w: 3.6, d: 2.8, h: 4.0, rot: 10 * D, style: 'stepped', body: COL.cream, accent: COL.orange, sign: 'ATP LAB' },
  { id: 'b18', x: -9.0, z: 18.2, w: 1.8, d: 1.8, h: 4.4, rot: 10 * D, style: 'tower', body: COL.white, accent: COL.orange, sign: 'GRID' },
  // west back-lot behind the power plants (along the membrane)
  { id: 'b14', x: -26.0, z: 12.0, w: 2.8, d: 3.6, h: 3.0, rot: 90 * D, style: 'pump', body: COL.bluegrey, accent: COL.orange, sign: 'PUMP 3' },
  { id: 'b15', x: -25.8, z: 17.2, w: 3.0, d: 3.0, h: 4.2, rot: 90 * D, style: 'silo', body: COL.white, accent: COL.teal, sign: 'CONTROL' },
  { id: 'b16', x: -24.6, z: 22.4, w: 3.0, d: 2.4, h: 2.8, rot: 80 * D, style: 'factory', body: COL.pale, accent: COL.yellow, sign: 'STORE' },
  // back-left works by the service gate
  { id: 'b12', x: -26.4, z: -21.8, w: 1.8, d: 2.0, h: 3.4, rot: 75 * D, style: 'lab', body: COL.white, accent: COL.blue, sign: 'WATER LAB' },
  { id: 'b25', x: 13.4, z: 43.4, w: 3.0, d: 1.8, h: 2.6, rot: 200 * D, style: 'depot', body: COL.cream, accent: COL.blue, sign: 'VESICLE BAY' },
  // back-right corner
];

/** Raised pedestrian walkway bridges: from (x0,z0) to (x1,z1), deck height h. */
export const BRIDGES = [
  { id: 'br2', x0: 14.5, z0: 30.0, x1: 14.5, z1: 35.6, h: 2.5, accent: COL.pink, sign: 'GOLGI EXPORT' },   // over the front street
  { id: 'br3', x0: -1.0, z0: 39.2, x1: -1.0, z1: 46.0, h: 2.6, accent: COL.purple, sign: 'NUCLEUS' },      // over the outer ring by the gate plaza
];

/** Painted loading yards (concrete pads with bays). rot = THREE Y rotation. bays along local X. */
export const YARDS = [
  { id: 'golgiFront', x: 8.0, z: 27.3, w: 6.4, d: 1.8, rot: -8 * D, bays: 4 },   // kept clear of the Golgi street carriageway
  { id: 'gate', x: 3.0, z: 46.0, w: 6.0, d: 1.8, rot: 3 * D, bays: 4 },
  { id: 'west', x: -17.0, z: -0.6, w: 4.2, d: 1.8, rot: 8 * D, bays: 3 },
];

// ------------------------------------------------------------------ lot filler
const KEEP_OPEN = [
  { x: -1.2, z: 39.8, r: 2.6 },   // gate plaza (cafe)
  { x: 9.0, z: 26.9, r: 4.2 },    // Golgi shipping yard approach
  { x: 3.4, z: 20.4, r: 3.2 },    // in front of the Golgi west wing (hero view)
];
/** Distance from the outer edge of the sidewalk (walk roads) or verge (other roads). */
function streetDist(x, z) {
  let best = Infinity;
  for (const e of NETWORK.edges) {
    const extra = e.walk ? 1.12 : 0.5; const pts = e.pts;
    for (let i = 1; i < pts.length; i++) {
      const ax = pts[i - 1].x, az = pts[i - 1].z, dx = pts[i].x - ax, dz = pts[i].z - az, L2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
      best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t) - e.w / 2 - extra);
    }
  }
  return best;
}
function boxSamples(b, pad = 0) {
  const out = []; const c = Math.cos(b.rot), s = Math.sin(b.rot);
  const W = b.w + pad * 2, Dd = b.d + pad * 2;
  for (let i = 0; i <= 6; i++) for (let j = 0; j <= 6; j++) { const lx = (i / 6 - 0.5) * W, lz = (j / 6 - 0.5) * Dd; out.push([b.x + lx * c + lz * s, b.z - lx * s + lz * c]); }
  return out;
}
function boxDist(x, z, b) {
  const c = Math.cos(b.rot), s = Math.sin(b.rot), dx = x - b.x, dz = z - b.z;
  const lx = dx * c - dz * s, lz = dx * s + dz * c, qx = Math.abs(lx) - b.w / 2, qz = Math.abs(lz) - b.d / 2;
  return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0);
}
const towerBoxes = BRIDGES.flatMap((br) => { const ang = Math.atan2(br.x1 - br.x0, br.z1 - br.z0); return [[br.x0, br.z0], [br.x1, br.z1]].map(([x, z]) => ({ x, z, w: 1.5, d: 1.5, rot: ang })); });
const junctions = NETWORK.nodes.filter((n) => n.degree >= 3 || (n.degree === 1 && n.kind === 'entry'));
function lotOK(b, placed, { road = 0.12, org = 1.2, gap = 0.9 } = {}) {
  for (const [x, z] of boxSamples(b)) {
    if (membraneDist(x, z) < 0.9) return false;
    if (x > 11 && z < -9) return false; // behind the SER / rough-ER clearance band stays open
    if (organelleDist(x, z) < org) return false;
    if (apronDist(x, z) < 0.2) return false;
    if (streetDist(x, z) < road) return false;
    if (KEEP_OPEN.some((k) => Math.hypot(x - k.x, z - k.z) < k.r)) return false;
    if (junctions.some((n) => Math.hypot(x - n.x, z - n.z) < (n.degree === 1 ? 3.0 : 2.3))) return false;
    if (YARDS.some((y) => boxDist(x, z, y) < 0.5)) return false;
    if (towerBoxes.some((t) => boxDist(x, z, t) < 0.6)) return false;
    if (placed.some((q) => q !== b && boxDist(x, z, q) < gap)) return false;
  }
  return true;
}
/** Nearest point on any road centre-line (for facing buildings toward the street). */
function nearestRoadPoint(x, z) {
  let best = null, bd = Infinity;
  for (const e of NETWORK.edges) for (const p of e.pts) { const d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < bd) { bd = d; best = p; } }
  return best;
}
const ARCH = [
  { style: 'lab', wt: 3, w: [3.0, 4.0], d: [2.3, 2.9], h: [3.0, 3.6] },
  { style: 'depot', wt: 3, w: [3.2, 4.2], d: [2.4, 3.0], h: [2.4, 2.9] },
  { style: 'factory', wt: 4, w: [2.8, 3.6], d: [2.2, 2.7], h: [2.5, 3.0] },
  { style: 'pump', wt: 2, w: [2.4, 3.0], d: [1.8, 2.3], h: [2.4, 2.9] },
  { style: 'tanks', wt: 3, w: [2.2, 3.4], d: [1.8, 2.6], h: [2.2, 3.2] },
  { style: 'containers', wt: 2, w: [2.4, 3.2], d: [1.4, 1.9], h: [1.0, 1.6] },
  { style: 'kiosk', wt: 2, w: [1.6, 2.1], d: [1.4, 1.8], h: [2.2, 2.5] },
  { style: 'tower', wt: 1, w: [1.8, 2.3], d: [1.7, 2.1], h: [3.8, 4.5] },
  { style: 'stepped', wt: 3, w: [3.0, 3.9], d: [2.5, 3.0], h: [3.8, 4.6] },
  { style: 'lshape', wt: 3, w: [3.0, 3.8], d: [2.6, 3.2], h: [2.8, 3.4] },
  { style: 'silo', wt: 3, w: [2.0, 2.6], d: [2.0, 2.6], h: [2.9, 3.8] },
];
const BODIES = [COL.white, COL.cream, COL.pale, COL.bluegrey, COL.sand, 0xe9edf1, 0xd8dee6];
const ACCENTS = [COL.teal, COL.orange, COL.yellow, COL.blue, COL.red, COL.purple, COL.green, COL.pink];
const SIGNS = ['ION LAB', 'ATP STORE', 'DEPOT 9', 'PUMP 4', 'KINASE CO', 'LIPID WORKS', 'TANK FARM', 'CHAPERONE', 'FOLDING LAB', 'RNA DEPOT', 'QC 2', 'COOLANT', 'ENZYME CO', 'CARGO 7', 'PORT OPS', 'SIGNAL HQ', 'BUFFER 3', 'RECYCLING', 'AMINO MILL', 'PUMP 8', 'SUGAR CO', 'TOOLS', 'H2O WORKS', 'DEPOT 12', 'LAB 07', 'MEMBRANE CO', 'CHARGE', 'METRO'];

function buildPlan() {
  const rnd = mulberry32(4242);
  const placed = [];
  // hand buildings: nudge away from roads onto clean lots where possible
  for (const h of HAND) {
    const b = { ...h };
    if (roadDist(b.x, b.z) < 99) {
      for (let it = 0; it < 10 && !lotOK(b, placed, { road: 0.05, org: 1.0, gap: 0.8 }); it++) {
        const p = nearestRoadPoint(b.x, b.z); const dx = b.x - p.x, dz = b.z - p.z, l = Math.hypot(dx, dz) || 1;
        b.x += dx / l * 0.12; b.z += dz / l * 0.12;
      }
    }
    placed.push(lotOK(b, placed, { road: -0.3, org: 0.9, gap: 0.7 }) ? b : h);
  }
  // fill
  const cands = [];
  for (let z = -46; z <= 46; z += 1.25) for (let x = -28; x <= 28; x += 1.25) {
    const jx = x + (rnd() - 0.5) * 0.9, jz = z + (rnd() - 0.5) * 0.9;
    // priority lots: east of the Golgi, around the SER, below the nucleus, west back-lot
    const pri = (jx > 14 && jz > 10 && jz < 30) || (jx > 9 && jz < 8 && jz > -18) || (Math.abs(jx) < 13 && jz < 7 && jz > -8) ? 0.45 : 0;
    cands.push([jx, jz, rnd() - pri]);
  }
  cands.sort((a, b) => a[2] - b[2]);
  const weights = ARCH.reduce((a, q) => a + q.wt, 0);
  let n = 0, sign = 0;
  for (const [x, z] of cands) {
    if (n >= 32) break;
    if (streetDist(x, z) < 0.8 || organelleDist(x, z) < 1.8 || membraneDist(x, z) < 1.6) continue;
    const p = nearestRoadPoint(x, z); const rot0 = Math.atan2(p.x - x, p.z - z);
    for (let tries = 0; tries < 7; tries++) {
      let r = rnd() * weights, A = ARCH[0]; for (const q of ARCH) { r -= q.wt; if (r <= 0) { A = q; break; } }
      const L = (a) => a[0] + rnd() * (a[1] - a[0]);
      const scale = 1 - tries * 0.08;
      const b = { id: `f${n}`, x, z, w: +(L(A.w) * scale).toFixed(2), d: +(L(A.d) * scale).toFixed(2), h: +L(A.h).toFixed(2), rot: rot0 + (rnd() < 0.15 ? Math.PI / 2 : 0), style: A.style,
        body: BODIES[Math.floor(rnd() * BODIES.length)], accent: ACCENTS[Math.floor(rnd() * ACCENTS.length)], sign: SIGNS[sign % SIGNS.length] };
      if (b.w < 1.4 || b.d < 1.2) continue;
      if (lotOK(b, placed)) { placed.push(b); n++; sign++; break; }
    }
  }
  // second pass: compact archetypes (tank clusters, container stacks, kiosks, pump houses) squeeze into leftover lots
  const SMALL = [
    { style: 'tanks', w: [1.6, 2.4], d: [1.5, 2.0], h: [1.8, 2.8] },
    { style: 'containers', w: [1.9, 2.5], d: [1.2, 1.5], h: [0.9, 1.5] },
    { style: 'kiosk', w: [1.4, 1.8], d: [1.2, 1.5], h: [2.1, 2.4] },
    { style: 'pump', w: [2.2, 2.5], d: [1.4, 1.8], h: [2.2, 2.6] },
  ];
  let m = 0;
  for (const [x, z] of cands) {
    if (m >= 22) break;
    if (streetDist(x, z) < 0.4 || organelleDist(x, z) < 1.4 || membraneDist(x, z) < 1.2) continue;
    const p = nearestRoadPoint(x, z); const rot0 = Math.atan2(p.x - x, p.z - z);
    for (let tries = 0; tries < 4; tries++) {
      const A = SMALL[tries % SMALL.length];
      const L = (a) => a[0] + rnd() * (a[1] - a[0]);
      const b = { id: `s${m}`, x, z, w: +L(A.w).toFixed(2), d: +L(A.d).toFixed(2), h: +L(A.h).toFixed(2), rot: rot0, style: A.style,
        body: BODIES[Math.floor(rnd() * BODIES.length)], accent: ACCENTS[Math.floor(rnd() * ACCENTS.length)], sign: SIGNS[sign % SIGNS.length] };
      if (lotOK(b, placed, { road: 0.05, org: 1.2, gap: 0.75 })) { placed.push(b); m++; sign++; break; }
    }
  }
  return placed;
}

/** All buildings (hand + filled). Consumed by buildings.js, props.js and the crowd system (footprints). */
export const BUILDINGS = buildPlan();
