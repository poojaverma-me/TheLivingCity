// Single source of truth for the city layout. Units: 1u ≈ visitor height.
// +X = right, +Z = toward the overview camera (front), Y = up. Floor top at y = 0.

const D = Math.PI / 180;

export const CELL = {
  a: 30,          // half-width (X) of interior floor
  b: 49,          // half-depth (Z)
  n: 2.45,        // superellipse exponent (2 = ellipse, higher = boxier)
  wall: 2.4,      // membrane thickness
  height: 4.2,    // membrane height above floor
  baseDepth: 1.6, // slab depth below floor
};

/** Gentle asymmetry so the outline isn't a perfect mathematical shape (reference bulges slightly front-right). */
export function cellWarp(x, z) {
  const fx = 1 + 0.035 * Math.max(0, z / CELL.b) * Math.max(0, x / CELL.a);
  const fz = 1 + 0.02 * Math.sin(x * 0.11);
  return { x: x * fx, z: z * fz };
}

export const NUCLEUS = {
  x: 0, z: -29.5,
  r: 11.4,             // dome radius
  domeScaleY: 1.22,    // prolate: reads tall like the reference
  plinthR: 13.0,       // raised base radius (balcony ring around the dome)
  plinthH: 5.2,        // nucleus floor sits on top of the ER mound
  cutCenter: 90 * D,   // cutaway faces +Z (toward camera)
  cutWidth: 118 * D,
  nucleolus: { x: -4.4, y: 8.8, z: -33.2, r: 1.5 },
};

export const RER = {
  cx: NUCLEUS.x, cz: NUCLEUS.z,
  rings: [13.8, 15.2, 16.6, 18.0, 19.4, 20.8, 22.2, 23.6],
  wallW: 0.5,
  // terrace level each ring stands on (inner rings higher: the ER stacks up toward the nucleus)
  base: [4.6, 4.0, 3.4, 2.75, 2.1, 1.45, 0.75, 0.0],
  heights: [2.4, 2.4, 2.35, 2.3, 2.25, 2.2, 2.2, 2.2],
  // angular gaps (center angle, half-width) per ring index; 90° = toward camera
  ramp: { angle: 96 * D, half: 3.6 * D },  // main avenue cut through all rings (toward the spine road)
};

export const SER = { x: 21.3, z: -6.5, rot: -10 * D, w: 16, d: 17 };

export const GOLGI = { x: 9, z: 14, rot: -16 * D, w: 17, d: 8 };

export const MITO = [
  { x: -13.5, z: 6, rot: 33 * D, len: 20, wid: 9.4 },   // centre-left power plant (rot: long axis from front-left to back-right)
  { x: -13.4, z: 28.3, rot: 26 * D, len: 18.4, wid: 9.6 }, // front-left power plant (nudged to clear lysosome at -4.5,19.5)
];

export const LYSO = [
  { x: -25, z: 3.5, r: 2.0 },
  { x: -4.5, z: 19.5, r: 1.9 },
  { x: -1.5, z: 9, r: 1.45 },
];

export const VACUOLES = [
  { x: -26, z: -11.5, r: 2.6 },
  { x: -26.5, z: -3.5, r: 2.4 },
  { x: -20.5, z: -7, r: 2.1 },
];

export const VESICLES = [
  { x: 22.5, z: 10, r: 1.15 },
  { x: 17, z: 3, r: 0.85 },
  { x: 24.5, z: 20, r: 0.9 },
  { x: 25.5, z: -21, r: 0.95 },
  { x: -10, z: -10, r: 0.7 },
];

export const GATES = [
  { id: 'front', angle: 97 * D, kind: 'door' },        // front gate (toward camera, slightly left)
  { id: 'portFR', angle: 78 * D, kind: 'port' },       // purple glowing port front-right
  { id: 'portR', angle: 52 * D, kind: 'port' },        // right port
  { id: 'left', angle: 196 * D, kind: 'door' },        // left service gate
  { id: 'portL', angle: 160 * D, kind: 'port' },
  { id: 'portBR', angle: 330 * D, kind: 'port' },
  { id: 'portBL', angle: 232 * D, kind: 'port' },
];

/** Camera presets. pos/target in world units. */
export const SHOTS = {
  overview: { pos: [5.3, 94, 124], target: [0.5, 0, -6.0], fov: 30 },
  rerEdge: { pos: [-28, 9, -4], target: [-17, 0.5, -14], fov: 40 },
  nucleus: { pos: [0, 27, -2], target: [0, 6.2, -29.5], fov: 40 },
  rer: { pos: [-16, 12, -6], target: [-9, 1.5, -20], fov: 38 },
  golgi: { pos: [-4, 15, 36], target: [8, 2, 17], fov: 38 },
  mito: { pos: [-22, 16, 22], target: [-9, 1, 2], fov: 38 },
  ser: { pos: [8, 15, 12], target: [20, 1.5, -2], fov: 38 },
  left: { pos: [-6, 18, 12], target: [-21, 1, -2], fov: 38 },
  membrane: { pos: [14, 9, 56], target: [4, 1.5, 40], fov: 40 },
  street: { pos: [2, 6, 32], target: [2, 1, 20], fov: 45 },
};

/** Is (x,z) inside the cell interior, at least `inset` units from the membrane's inner face? */
export function insideCell(x, z, inset = 0) {
  // invert the warp approximately (warp is within a few %): test the superellipse with shrunk radii
  const a = CELL.a - inset, b = CELL.b - inset;
  if (a <= 0 || b <= 0) return false;
  const ax = Math.abs(x) / (1 + 0.035 * Math.max(0, z / CELL.b) * Math.max(0, x / CELL.a)), az = Math.abs(z);
  return Math.pow(ax / a, CELL.n) + Math.pow(az / b, CELL.n) < 1;
}
