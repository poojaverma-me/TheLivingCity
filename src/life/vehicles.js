// Delivery traffic: yellow box trucks, flatbeds with pink/cream parcels and small forklifts, each with a seated driver.
// Each vehicle type is one InstancedMesh (painted-miniature material); plus one for all wheels, one for tinted cab glass
// and one for logo decals.
import * as THREE from 'three';
import { bakePieces, paintMaterial, rbox as rbox0, cyl, sph, rod, xf, lathe, seatedDriverPieces } from './characters.js';
import { Path, organelleObstacles, loopAround, cleanLoop, mulberry, networkRoutes } from './crowd.js';

let LITE = false; // far-LOD build: plain boxes for small parts, 1-segment rounding for big shells
const rbox = (w, h, d, r, pos, rot, seg = 1) => LITE
  ? (Math.max(w, h, d) > 0.45 ? rbox0(w, h, d, r, pos, rot, 1) : xf(new THREE.BoxGeometry(w, h, d), pos, rot))
  : rbox0(w, h, d, r, pos, rot, Math.min(seg, 3));
const lite = (fn) => (isLite = false, ...a) => { LITE = isLite; try { return fn(isLite, ...a); } finally { LITE = false; } };
const YEL = 0xf5bf24, YEL_D = 0xd9a113, YEL_L = 0xf8cb3c, YEL_HI = 0xffe07a, DARK = 0x2a2d33, GREY = 0x51565e, CHROME = 0xd8dde3, INTERIOR = 0x3a3f48;
const PINK = [0xf29bb8, 0xe8789f, 0xf6b3c8], CREAM = [0xf5e3c4, 0xefd3a8, 0xf8ead2];

// ---------------------------------------------------------------------------------------------
// Geometry (vehicle faces +Z, ground y = 0, origin between the axles). Worker ≈ 1.05u; cab roof ≈ 1.95u.
// ---------------------------------------------------------------------------------------------

const CAB = { z0: 0.5, z1: 1.45, x: 0.57, sill: 1.08, roof: 1.8 };
const WHEELS = { r: 0.25, x: 0.5, front: 0.98, rear: -0.78 };

function driver(L, at, look = {}, reach = 1.15) {
  for (const p of seatedDriverPieces({ reach, ...look })) L.push({ ...p, geo: p.geo.translate(...at) });
}

function cabPieces(L, look, lite = false) {
  const add = (geo, color, mat) => L.push({ geo, color, mat });
  const { z0, z1, x, sill, roof } = CAB, zc = (z0 + z1) / 2, len = z1 - z0;
  add(rbox(0.9, 0.14, 3.0, 0.05, [0, 0.42, -0.08]), DARK, 'dark');                                   // chassis rail
  add(rbox(x * 2, sill - 0.46, len, 0.13, [0, (sill + 0.46) / 2, zc], null, 3), YEL, 'paint');         // lower cab body
  add(rbox(x * 2 + 0.02, 0.1, len + 0.02, 0.04, [0, 0.5, zc]), DARK, 'dark');                           // black lower band
  add(rbox(x * 2, 0.16, len, 0.07, [0, roof + 0.06, zc], null, 2), YEL, 'paint');                       // roof
  add(rbox(x * 2 - 0.12, 0.05, len - 0.2, 0.025, [0, roof + 0.16, zc - 0.04]), YEL_D, 'paint');         // roof cap
  add(rbox(0.5, 0.07, 0.12, 0.03, [0, roof + 0.2, z1 - 0.2]), 0xffa21a, 'lightAmber');                  // beacon bar
  add(rbox(x * 2 + 0.01, 0.025, len + 0.01, 0.01, [0, roof - 0.015, zc]), YEL_HI, 'paint');             // roof edge highlight
  add(rbox(x * 2, roof - sill + 0.04, 0.08, 0.03, [0, (roof + sill) / 2, z0 + 0.04]), YEL, 'paint');    // cab back wall
  add(rbox(x * 2 - 0.1, roof - sill - 0.02, 0.02, 0.01, [0, (roof + sill) / 2, z0 + 0.09]), INTERIOR, 'dark');
  for (const s of [1, -1]) {
    add(xf(rbox(0.07, roof - sill + 0.06, 0.08, 0.03, [0, 0, 0]), [s * (x - 0.035), (roof + sill) / 2, z1 - 0.06], [-0.1, 0, 0]), YEL, 'paint'); // A-pillar
    add(rbox(0.07, roof - sill + 0.04, 0.08, 0.03, [s * (x - 0.035), (roof + sill) / 2, z0 + 0.3]), YEL, 'paint');   // B-pillar
    add(rbox(0.012, sill - 0.56, 0.01, 0.004, [s * (x + 0.002), (sill + 0.56) / 2, z0 + 0.3]), YEL_D, 'paint');      // door seam
    add(rbox(0.012, 0.01, 0.58, 0.004, [s * (x + 0.002), 0.62, z0 + 0.62]), YEL_D, 'paint');                         // panel line
    add(rbox(0.02, 0.025, 0.09, 0.01, [s * (x + 0.008), sill - 0.12, z0 + 0.45]), DARK, 'dark');                     // handle
    add(rbox(0.18, 0.04, 0.2, 0.015, [s * (x - 0.15), 0.42, z0 + 0.42]), GREY, 'dark');                              // step
    // mirror on a proper arm
    add(rod([s * x, sill + 0.28, z1 - 0.08], [s * (x + 0.13), sill + 0.3, z1 - 0.02], 0.016, 0.016, 6), DARK, 'dark');
    add(rod([s * x, sill + 0.06, z1 - 0.08], [s * (x + 0.13), sill + 0.14, z1 - 0.02], 0.014, 0.014, 6), DARK, 'dark');
    add(rbox(0.05, 0.2, 0.09, 0.02, [s * (x + 0.15), sill + 0.2, z1 - 0.02]), DARK, 'dark');
    add(rbox(0.012, 0.16, 0.07, 0.01, [s * (x + 0.178), sill + 0.2, z1 - 0.02]), CHROME, 'chrome');
    add(xf(cyl(0.085, 0.085, 0.04, 16, [0, 0, 0]), [s * 0.36, 0.7, z1 + 0.01], [Math.PI / 2, 0, 0]), 0xfff3d6, 'light'); // headlight
    add(xf(new THREE.TorusGeometry(0.092, 0.016, 6, 18), [s * 0.36, 0.7, z1 + 0.015]), CHROME, 'chrome');
    add(rbox(0.08, 0.07, 0.03, 0.012, [s * 0.48, 0.56, z1 + 0.005]), 0xffa21a, 'lightAmber');
    add(cyl(WHEELS.r + 0.05, WHEELS.r + 0.05, 0.2, 14, [s * WHEELS.x, WHEELS.r, WHEELS.front], [0, 0, Math.PI / 2], null, true, 0, Math.PI), DARK, 'rubber'); // arch
  }
  // interior: dashboard, seats, steering wheel, driver (skipped in the far LOD)
  if (!lite) {
  add(rbox(x * 2 - 0.1, 0.16, 0.24, 0.04, [0, sill + 0.03, z1 - 0.17]), INTERIOR, 'dark');
  for (const s of [1, -1]) {
    add(rbox(0.36, 0.1, 0.34, 0.04, [s * 0.25, sill - 0.02, z0 + 0.42]), 0x2a2e36, 'cloth');
    add(xf(rbox(0.36, 0.42, 0.09, 0.04, [0, 0, 0]), [s * 0.25, sill + 0.2, z0 + 0.22], [-0.1, 0, 0]), 0x2a2e36, 'cloth');
  }
  add(xf(new THREE.TorusGeometry(0.11, 0.014, 5, 16), [0.25, sill + 0.2, z1 - 0.3], [-0.95, 0, 0]), DARK, 'dark');
  driver(L, [0.25, sill + 0.02, z0 + 0.48], look, 1.1);
  } else add(rbox(x * 2 - 0.1, roof - sill - 0.06, len - 0.2, 0.02, [0, (roof + sill) / 2, zc]), INTERIOR, 'dark');
  // nose
  add(rbox(0.66, 0.26, 0.05, 0.03, [0, 0.72, z1 + 0.0]), DARK, 'dark');                                 // grille
  for (let k = 0; k < 4; k++) add(rbox(0.6, 0.02, 0.02, 0.008, [0, 0.62 + k * 0.065, z1 + 0.03]), CHROME, 'chrome');
  add(rbox(x * 2 + 0.06, 0.15, 0.14, 0.05, [0, 0.42, z1 + 0.04]), GREY, 'dark');                       // bumper
  add(rbox(0.22, 0.07, 0.03, 0.01, [0, 0.43, z1 + 0.12]), 0xf4f4f0, 'card');                            // plate
  add(xf(cyl(0.1, 0.1, 0.42, 12, [0, 0, 0]), [0.38, 0.47, 0.0], [Math.PI / 2, 0, 0]), CHROME, 'chrome'); // fuel tank
  add(cyl(0.03, 0.03, 0.7, 8, [-0.46, sill + 0.35, z0 - 0.04]), CHROME, 'chrome');                      // exhaust stack
}
/** Cab glass (separate tinted transparent mesh). */
function cabGlass() {
  const { z0, z1, x, sill, roof } = CAB, h = roof - sill;
  const G = [
    xf(new THREE.BoxGeometry(x * 2 - 0.12, h, 0.02), [0, (roof + sill) / 2, z1 - 0.06], [-0.1, 0, 0]),
    new THREE.BoxGeometry(0.02, h - 0.02, z1 - z0 - 0.42).translate(x - 0.035, (roof + sill) / 2, (z1 + z0 + 0.25) / 2),
    new THREE.BoxGeometry(0.02, h - 0.02, z1 - z0 - 0.42).translate(-(x - 0.035), (roof + sill) / 2, (z1 + z0 + 0.25) / 2),
  ];
  return bakePieces(G.map((geo) => ({ geo, color: 0xffffff, mat: 'glass' })));
}
function rearLights(L, z, y = 0.62) {
  for (const s of [1, -1]) {
    L.push({ geo: rbox(0.1, 0.16, 0.03, 0.012, [s * 0.47, y, z]), color: 0xff2a1e, mat: 'lightRed' });
    L.push({ geo: rbox(0.1, 0.05, 0.03, 0.01, [s * 0.47, y - 0.12, z]), color: 0xffa21a, mat: 'lightAmber' });
  }
  L.push({ geo: rbox(1.04, 0.12, 0.12, 0.04, [0, 0.42, z + 0.02]), color: GREY, mat: 'dark' });
  L.push({ geo: rbox(0.5, 0.03, 0.14, 0.01, [0, 0.33, z + 0.04]), color: CHROME, mat: 'metal' }); // rear step
}
function rearArches(L, z) {
  for (const s of [1, -1]) {
    L.push({ geo: cyl(WHEELS.r + 0.05, WHEELS.r + 0.05, 0.22, 14, [s * WHEELS.x, WHEELS.r, WHEELS.rear], [0, 0, Math.PI / 2], null, true, 0, Math.PI), color: DARK, mat: 'rubber' });
    L.push({ geo: rbox(0.22, 0.2, 0.02, 0.01, [s * WHEELS.x, 0.34, z]), color: DARK, mat: 'rubber' });
  }
}

const BOX = { z0: -1.55, z1: 0.44, y0: 0.52, y1: 2.0, w: 1.2 };
export function boxTruckGeometry(lite = false) {
  const L = [];
  cabPieces(L, { accent: 0xf2c12e }, lite);
  const { z0, z1, y0, y1, w } = BOX, zc = (z0 + z1) / 2, len = z1 - z0, yc = (y0 + y1) / 2, h = y1 - y0;
  L.push({ geo: rbox(w + 0.02, 0.08, len + 0.02, 0.03, [0, y0 + 0.02, zc]), color: DARK, mat: 'dark' });               // sub-frame
  L.push({ geo: rbox(w, h, len, 0.07, [0, yc, zc], null, 3), color: YEL_L, mat: 'paint' });                             // cargo box
  L.push({ geo: rbox(w + 0.012, 0.12, len + 0.012, 0.03, [0, y0 + 0.1, zc]), color: 0x9a7414, mat: 'paint' });          // underside AO band
  L.push({ geo: rbox(w + 0.016, 0.035, len + 0.016, 0.015, [0, y1 - 0.02, zc]), color: YEL_HI, mat: 'paint' });          // roof edge highlight
  for (const y of [y0 + 0.42, y1 - 0.3]) L.push({ geo: rbox(w + 0.014, 0.022, len + 0.014, 0.008, [0, y, zc]), color: YEL_D, mat: 'paint' }); // panel rails
  for (const s of [1, -1]) for (let k = 1; k < 5; k++) {
    if (k === 2 || k === 3) continue;
    L.push({ geo: rbox(0.016, h - 0.06, 0.026, 0.006, [s * (w / 2 + 0.004), yc, z0 + k * len / 5]), color: YEL_D, mat: 'paint' }); // seams
  }
  // rear doors: seam, hinges, lock bars, handles
  L.push({ geo: rbox(0.014, h - 0.1, 0.014, 0.004, [0, yc, z0 - 0.004]), color: YEL_D, mat: 'paint' });
  for (const x of [-0.44, -0.16, 0.16, 0.44]) L.push({ geo: cyl(0.013, 0.013, h - 0.08, 6, [x, yc, z0 - 0.02]), color: CHROME, mat: 'chrome' });
  for (const s of [1, -1]) for (const y of [y0 + 0.25, yc, y1 - 0.25]) L.push({ geo: rbox(0.06, 0.04, 0.03, 0.01, [s * 0.57, y, z0 - 0.01]), color: GREY, mat: 'metal' });
  for (const x of [-0.08, 0.08]) L.push({ geo: rbox(0.06, 0.03, 0.03, 0.01, [x, yc - 0.1, z0 - 0.02]), color: DARK, mat: 'dark' });
  rearLights(L, z0 - 0.01, 0.66);
  rearArches(L, WHEELS.rear - 0.32);
  return bakePieces(L);
}

export function flatbedGeometry(lite = false, seed = 4) {
  const L = [];
  cabPieces(L, { accent: 0xf08a24, skin: 0xb57b55, hair: 0x1d1612 }, lite);
  const z0 = -1.55, z1 = 0.44, zc = (z0 + z1) / 2, len = z1 - z0;
  L.push({ geo: rbox(1.18, 0.1, len, 0.03, [0, 0.62, zc]), color: 0x6e5c4c, mat: 'cloth' });       // deck
  for (let k = 0; k < 7; k++) L.push({ geo: rbox(1.16, 0.012, 0.014, 0.004, [0, 0.675, z0 + 0.1 + k * 0.29]), color: 0x544537, mat: 'cloth' });
  L.push({ geo: rbox(1.2, 0.1, len + 0.01, 0.03, [0, 0.52, zc]), color: 0x9a7414, mat: 'paint' });
  for (const s of [1, -1]) {
    L.push({ geo: rbox(0.04, 0.13, len, 0.015, [s * 0.59, 0.73, zc]), color: YEL, mat: 'paint' });
    for (let k = 0; k < 5; k++) L.push({ geo: rbox(0.04, 0.32, 0.04, 0.01, [s * 0.59, 0.82, z0 + 0.05 + k * 0.47]), color: YEL_D, mat: 'paint' });
  }
  L.push({ geo: rbox(1.14, 0.07, 0.07, 0.02, [0, 1.5, z1 - 0.02]), color: GREY, mat: 'metal' });
  for (let k = 0; k < 7; k++) L.push({ geo: rbox(0.035, 0.84, 0.035, 0.01, [-0.51 + k * 0.17, 1.08, z1 - 0.02]), color: GREY, mat: 'metal' });
  const rnd = mulberry(seed);
  const box = (w, h, d, x, y, z, ry) => {
    const pink = rnd() < 0.55, c = pink ? PINK[Math.floor(rnd() * 3)] : CREAM[Math.floor(rnd() * 3)];
    L.push({ geo: xf(rbox(w, h, d, 0.035, [0, 0, 0], null, 2), [x, y + h / 2, z], [0, ry, 0]), color: c, mat: 'card' });
    L.push({ geo: xf(rbox(w + 0.006, 0.06, d + 0.006, 0.01, [0, 0, 0]), [x, y + h * 0.62, z], [0, ry, 0]), color: pink ? 0xfbe0ea : 0xd8b885, mat: 'card' });
  };
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
    const s = 0.48 + rnd() * 0.08;
    box(s, s * (0.8 + rnd() * 0.25), s, (j - 0.5) * 0.56, 0.68, z0 + 0.38 + i * 0.6, (rnd() - 0.5) * 0.15);
  }
  box(0.44, 0.38, 0.44, -0.22, 1.13, z0 + 0.6, 0.1); box(0.4, 0.34, 0.4, 0.24, 1.13, z0 + 1.2, -0.08);
  rearLights(L, z0 - 0.02, 0.6);
  rearArches(L, WHEELS.rear - 0.32);
  return bakePieces(L);
}

/** Small counterbalance forklift with an open overhead guard and a seated driver (no truck cab). */
export function forkliftGeometry(lite = false) {
  const L = [];
  const add = (geo, color, mat) => L.push({ geo, color, mat });
  add(rbox(0.8, 0.46, 1.06, 0.12, [0, 0.47, 0.0], null, 3), YEL, 'paint');           // body
  add(rbox(0.82, 0.08, 1.08, 0.03, [0, 0.27, 0.0]), DARK, 'dark');
  add(rbox(0.84, 0.48, 0.32, 0.14, [0, 0.58, -0.52], null, 3), 0x3a3e46, 'paint');   // counterweight
  add(rbox(0.6, 0.03, 0.5, 0.01, [0, 0.705, 0.05]), 0x2a2d33, 'rubber');              // floor mat
  add(rbox(0.4, 0.09, 0.36, 0.04, [0, 0.78, -0.16]), 0x1f2125, 'cloth');             // seat
  add(xf(rbox(0.4, 0.36, 0.08, 0.04, [0, 0, 0]), [0, 0.98, -0.33], [-0.12, 0, 0]), 0x1f2125, 'cloth');
  add(rod([0, 0.7, 0.34], [0, 1.0, 0.22], 0.024, 0.024, 6), DARK, 'dark');            // steering column
  add(xf(new THREE.TorusGeometry(0.095, 0.015, 6, 16), [0, 1.02, 0.2], [-1.0, 0, 0]), DARK, 'dark');
  if (!lite) driver(L, [0, 0.8, -0.1], { accent: 0xf08a24, skin: 0xcf9670, hair: 0x3d2a1e, coat: 0xf6f6f2 }, 1.2);
  else { add(rbox(0.26, 0.34, 0.18, 0.06, [0, 1.0, -0.12]), 0xf6f6f2, 'coat'); add(sph(0.1, 6, 4, [0, 1.3, -0.1]), 0xcf9670, 'skin'); add(sph(0.112, 6, 3, [0, 1.33, -0.1], [1, 0.86, 1.07], null, 0, Math.PI * 2, 0, Math.PI / 2), 0xf08a24, 'plastic'); }
  for (const s of [1, -1]) {
    add(rod([s * 0.36, 0.66, 0.4], [s * 0.33, 1.72, 0.28], 0.028, 0.028, 6), DARK, 'dark');
    add(rod([s * 0.36, 0.66, -0.48], [s * 0.33, 1.72, -0.44], 0.028, 0.028, 6), DARK, 'dark');
    add(xf(cyl(0.05, 0.05, 0.045, 12, [0, 0, 0]), [s * 0.33, 1.6, 0.32], [Math.PI / 2, 0, 0]), 0xfff3d6, 'light');
    add(rbox(0.06, 0.14, 0.08, 0.02, [s * 0.42, 0.52, -0.69]), 0xff2a1e, 'lightRed');
  }
  add(rbox(0.8, 0.045, 0.82, 0.02, [0, 1.74, -0.08]), DARK, 'dark');
  for (let k = 0; k < 5; k++) add(rbox(0.72, 0.02, 0.035, 0.008, [0, 1.77, -0.4 + k * 0.16]), YEL, 'paint');
  add(cyl(0.055, 0.055, 0.08, 12, [0, 1.81, -0.36]), 0xffa21a, 'lightAmber');
  // mast, carriage, forks
  for (const s of [1, -1]) {
    add(rbox(0.07, 1.85, 0.08, 0.015, [s * 0.27, 1.02, 0.62]), GREY, 'metal');
    add(rbox(0.045, 1.7, 0.055, 0.01, [s * 0.2, 0.98, 0.67]), 0x6a7079, 'metal');
    add(rbox(0.09, 0.04, 0.8, 0.012, [s * 0.18, 0.17, 1.08]), 0x5c6169, 'metal');
    add(rbox(0.09, 0.34, 0.04, 0.012, [s * 0.18, 0.33, 0.7]), 0x5c6169, 'metal');
  }
  for (const y of [0.32, 1.1, 1.9]) add(rbox(0.6, 0.055, 0.07, 0.015, [0, y, 0.63]), GREY, 'metal');
  add(rbox(0.66, 0.3, 0.04, 0.012, [0, 0.4, 0.69]), DARK, 'dark');
  add(cyl(0.022, 0.022, 1.6, 6, [0, 1.0, 0.59]), CHROME, 'chrome');
  add(rbox(0.8, 0.09, 0.74, 0.012, [0, 0.235, 1.1]), 0xb48a58, 'cloth');               // pallet
  const rnd = mulberry(9);
  for (const [x, z, w] of [[-0.19, 0.93, 0.36], [0.19, 0.93, 0.36], [-0.19, 1.28, 0.34], [0.19, 1.28, 0.34]]) {
    const pink = rnd() < 0.5, c = pink ? PINK[Math.floor(rnd() * 3)] : CREAM[Math.floor(rnd() * 3)];
    add(rbox(w, w * 0.85, w, 0.03, [x, 0.28 + w * 0.425, z]), c, 'card');
  }
  add(rbox(0.34, 0.3, 0.34, 0.03, [0, 0.74, 1.1]), PINK[0], 'card');
  return bakePieces(L);
}

/** Wheel at unit radius, axle along X, hubcap on +X, with tread lugs. */
export function wheelGeometry(lite = false) {
  const L = [];
  const prof = [];
  const n = lite ? 4 : 10;
  for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 + (i / n) * Math.PI; prof.push(new THREE.Vector2(0.84 + Math.cos(a) * 0.14, Math.sin(a) * 0.36)); }
  const tire = new THREE.LatheGeometry(prof, lite ? 10 : 18); tire.rotateZ(Math.PI / 2);
  L.push({ geo: tire, color: 0x1b1c1f, mat: 'rubber' });
  if (lite) {
    L.push({ geo: cyl(0.6, 0.6, 0.66, 10, [0, 0, 0], [0, 0, Math.PI / 2]), color: 0xc9ced6, mat: 'metal' });
    L.push({ geo: cyl(0.28, 0.28, 0.72, 8, [0, 0, 0], [0, 0, Math.PI / 2]), color: YEL, mat: 'paint' });
    return bakePieces(L);
  }
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    for (const sx of [1, -1]) L.push({ geo: xf(new THREE.BoxGeometry(0.28, 0.07, 0.16), [sx * 0.15, Math.cos(a) * 0.98, Math.sin(a) * 0.98], [a + sx * 0.35, 0, 0]), color: 0x202125, mat: 'rubber' });
  }
  L.push({ geo: cyl(0.7, 0.7, 0.6, 18, [0, 0, 0], [0, 0, Math.PI / 2]), color: 0x24262a, mat: 'rubber' });
  L.push({ geo: cyl(0.52, 0.56, 0.08, 16, [0.31, 0, 0], [0, 0, Math.PI / 2]), color: 0xc9ced6, mat: 'metal' });
  L.push({ geo: cyl(0.26, 0.3, 0.1, 12, [0.36, 0, 0], [0, 0, Math.PI / 2]), color: YEL, mat: 'paint' });
  for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; L.push({ geo: sph(0.05, 6, 4, [0.37, Math.cos(a) * 0.4, Math.sin(a) * 0.4]), color: 0x8c939c, mat: 'chrome' }); }
  return bakePieces(L);
}

let _logo = null;
function logoTexture() {
  if (_logo) return _logo;
  const c = document.createElement('canvas'); c.width = 1024; c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 256); grd.addColorStop(0, '#6a3bc0'); grd.addColorStop(1, '#4b2690');
  g.fillStyle = grd; g.fillRect(0, 0, 1024, 256);
  g.fillStyle = '#ff6f8f'; g.fillRect(0, 214, 1024, 16);
  g.fillStyle = '#f8c94a'; g.fillRect(0, 26, 1024, 8);
  // vesicle logo
  const rg = g.createRadialGradient(150, 122, 10, 150, 122, 88); rg.addColorStop(0, '#f1dcff'); rg.addColorStop(0.55, '#b07bff'); rg.addColorStop(1, '#7a43d8');
  g.fillStyle = rg; g.beginPath(); g.arc(150, 122, 78, 0, Math.PI * 2); g.fill();
  g.lineWidth = 10; g.strokeStyle = '#ffffff'; g.beginPath(); g.arc(150, 122, 78, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#ffffff'; g.beginPath(); g.arc(128, 100, 18, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#ffffff'; g.font = '800 92px Montserrat, Arial Black, sans-serif'; g.textBaseline = 'middle';
  g.fillText('CYTO EXPRESS', 262, 112);
  g.font = '600 38px Inter, Arial, sans-serif'; g.fillStyle = '#e9dcff';
  g.fillText('Golgi  →  Membrane  •  Express', 266, 180);
  _logo = new THREE.CanvasTexture(c); _logo.colorSpace = THREE.SRGBColorSpace; _logo.anisotropy = 8;
  return _logo;
}

// ---------------------------------------------------------------------------------------------
// Provisional routes (until the city road NETWORK exists)
// ---------------------------------------------------------------------------------------------

export function provisionalRoutes(margin = 3.1) {
  const obs = organelleObstacles();
  const [, ser, golgi, m0, m1] = obs;
  return [golgi, ser, m0, m1].map((o) => cleanLoop(loopAround(o, margin, 96), obs, margin * 0.75));
}

// ---------------------------------------------------------------------------------------------
// Traffic
// ---------------------------------------------------------------------------------------------

const TW = [[WHEELS.x, WHEELS.r, WHEELS.front, WHEELS.r, 1], [-WHEELS.x, WHEELS.r, WHEELS.front, WHEELS.r, 1], [WHEELS.x, WHEELS.r, WHEELS.rear, WHEELS.r, 0], [-WHEELS.x, WHEELS.r, WHEELS.rear, WHEELS.r, 0]];
const TYPES = {
  box: { make: lite(boxTruckGeometry), wheels: TW, vmax: 2.4, len: 3.1, base: WHEELS.front - WHEELS.rear, cab: true },
  flatbed: { make: lite(flatbedGeometry), wheels: TW, vmax: 2.2, len: 3.1, base: WHEELS.front - WHEELS.rear, cab: true },
  forklift: { make: lite(forkliftGeometry), wheels: [[0.4, 0.19, 0.32, 0.19, 0], [-0.4, 0.19, 0.32, 0.19, 0], [0.38, 0.15, -0.46, 0.15, 1], [-0.38, 0.15, -0.46, 0.15, 1]], vmax: 1.2, len: 2.2, base: 0.78 },
};
const DECAL = { w: 1.72, h: 0.43, x: BOX.w / 2 + 0.0185, y: 1.3, z: (BOX.z0 + BOX.z1) / 2 };

/**
 * createTraffic({ routes, mix, seed })
 *  routes: arrays of {x,z} closed loops (or {points, closed}). Default: provisionalRoutes().
 *  mix: list of vehicle types, one per vehicle (default 12: 7 box, 3 flatbed, 2 forklift).
 * Returns { object, update(t,dt), setPlayerPosition(v3), vehicles, pick(raycaster) → index|-1 }
 */
export function createTraffic({ routes = null, mix = null, seed = 5 } = {}) {
  const rnd = mulberry(seed);
  const R = (routes || networkRoutes()).map((q) => {
    const p = Array.isArray(q) ? new Path(q, true) : new Path(q.points, q.closed !== false);
    p.kinds = q.kinds || null; return p;
  });
  const M = mix || ['box', 'flatbed', 'box', 'forklift', 'box', 'box', 'flatbed', 'box', 'forklift', 'box', 'flatbed', 'box', 'forklift', 'flatbed'];
  const rr = {};
  const routeFor = (type) => {
    const ok = R.filter((r) => !r.kinds || r.kinds.includes(type)), list = ok.length ? ok : R;
    rr[type] = (rr[type] ?? Math.floor(rnd() * list.length)) + 1; return list[rr[type] % list.length];
  };
  const group = new THREE.Group(); group.name = 'traffic';
  const mat = paintMaterial({ key: 'vehicle', side: THREE.FrontSide, clearcoatRoughness: 0.12 });

  // vehicles distributed over routes, evenly spaced per route
  const vehicles = M.map((type, i) => ({ i, type, route: routeFor(type), s: 0, v: 0, yaw: 0, wheel: 0, steer: 0, x: 0, z: 0, stopT: 0, ignoreT: 0, vmax: TYPES[type].vmax * (0.9 + rnd() * 0.2) }));
  R.forEach((r) => {
    const on = vehicles.filter((v) => v.route === r);
    on.forEach((v, k) => { v.s = (k / on.length) * r.len + rnd() * 1.5; });
  });

  // separate vehicles that start on top of each other (routes share road segments)
  const tmp = { x: 0, z: 0, tx: 0, tz: 1 };
  for (let it = 0; it < 60; it++) {
    let moved = false;
    for (const v of vehicles) { v.route.at(v.s, tmp); v.x = tmp.x; v.z = tmp.z; }
    for (let a = 0; a < vehicles.length; a++) for (let b = a + 1; b < vehicles.length; b++) {
      const A = vehicles[a], B = vehicles[b];
      if (Math.hypot(A.x - B.x, A.z - B.z) < 3.4) { B.s += 1.7; B.route.at(B.s, tmp); B.x = tmp.x; B.z = tmp.z; moved = true; }
    }
    if (!moved) break;
  }

  // LOD: each type has a full mesh (near the camera: interior, driver, tread) and a lite mesh (far / overview)
  const meshes = {}, lods = {};
  const inst = (geo, n, shadow = true) => {
    const m = new THREE.InstancedMesh(geo, mat, Math.max(1, n));
    m.castShadow = shadow; m.receiveShadow = true; m.frustumCulled = false; m.count = 0;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); group.add(m); return m;
  };
  for (const type of Object.keys(TYPES)) {
    const n = vehicles.filter((v) => v.type === type).length;
    if (!n) continue;
    lods[type] = { hi: inst(TYPES[type].make(false), n), lo: inst(TYPES[type].make(true), n) };
    meshes[type] = lods[type].hi;
  }
  const nWheels = vehicles.length * 4;
  const wheelsHi = inst(wheelGeometry(false), nWheels), wheelsLo = inst(wheelGeometry(true), nWheels);
  const wheels = wheelsHi;
  const boxes = vehicles.filter((v) => v.type === 'box');
  const decalMat = new THREE.MeshPhysicalMaterial({ map: logoTexture(), roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.15, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const decals = new THREE.InstancedMesh(new THREE.PlaneGeometry(DECAL.w, DECAL.h), decalMat, Math.max(1, boxes.length * 2));
  decals.frustumCulled = false; decals.receiveShadow = true; decals.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  group.add(decals);
  const cabbed = vehicles.filter((v) => TYPES[v.type].cab);
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x5f86a0, transparent: true, opacity: 0.38, roughness: 0.05, metalness: 0.1, clearcoat: 1, envMapIntensity: 1.6, depthWrite: false });
  const glass = new THREE.InstancedMesh(cabGlass(), glassMat, Math.max(1, cabbed.length));
  glass.frustumCulled = false; glass.instanceMatrix.setUsage(THREE.DynamicDrawUsage); group.add(glass);

  const player = new THREE.Vector3(1e6, 0, 1e6);
  const smp = { x: 0, z: 0, tx: 0, tz: 1 }, smp2 = { x: 0, z: 0, tx: 0, tz: 1 };
  const mV = new THREE.Matrix4(), mA = new THREE.Matrix4(), mO = new THREE.Matrix4(), e = new THREE.Euler(), q = new THREE.Quaternion();
  const one = new THREE.Vector3(1, 1, 1), sc = new THREE.Vector3(), pos = new THREE.Vector3();
  const heading = (r, s) => { r.at(s + 0.6, smp2); const x2 = smp2.x, z2 = smp2.z; r.at(s - 0.6, smp2); return Math.atan2(x2 - smp2.x, z2 - smp2.z); };
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

  const camPos = new THREE.Vector3();
  let wHi = 0, wLo = 0;
  function update(t, dt, camera) {
    dt = Math.min(dt, 0.05);
    let far = true;
    if (camera) { camera.getWorldPosition(camPos); far = camPos.y > 30; }
    for (const L of Object.values(lods)) { L.hi.count = 0; L.lo.count = 0; }
    wHi = 0; wLo = 0;
    for (const v of vehicles) {
      const T = TYPES[v.type];
      // corner easing: look ahead for heading change
      const h0 = heading(v.route, v.s), h1 = heading(v.route, v.s + 2.6);
      let target = v.vmax * Math.max(0.38, 1 - Math.abs(wrap(h1 - h0)) * 0.85);
      // stop for the player (in front cone)
      const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw);
      const half = T.len / 2;
      const px = player.x - v.x, pz = player.z - v.z;
      const pf = px * fx + pz * fz, pl = Math.abs(px * fz - pz * fx);
      if (pf > 0 && pf < half + 2.8 && pl < 1.05) target = Math.min(target, Math.max(0, (pf - half - 0.9) * 1.2));
      // keep distance from other vehicles ahead
      if (v.ignoreT > 0) v.ignoreT -= dt;
      else for (const o of vehicles) {
        if (o === v) continue;
        const dx = o.x - v.x, dz = o.z - v.z;
        const f = dx * fx + dz * fz, l = Math.abs(dx * fz - dz * fx);
        if (f > 0 && f < half + TYPES[o.type].len / 2 + 1.6 && l < 1.15) target = Math.min(target, Math.max(0, (f - half - TYPES[o.type].len / 2 - 0.5) * 1.1));
      }
      v.stopT = v.v < 0.05 && target < 0.05 ? v.stopT + dt : 0;
      if (v.stopT > 4 && pl >= 1.05) { v.ignoreT = 1.5; v.stopT = 0; } // deadlock breaker (never ignores the player)
      const dv = target - v.v;
      v.v += Math.max(-3.2 * dt, Math.min(1.1 * dt, dv));
      v.v = Math.max(0, v.v);
      v.s += v.v * dt;
      v.route.at(v.s, smp);
      v.x = smp.x; v.z = smp.z;
      const hy = heading(v.route, v.s);
      v.yaw = hy;
      // steering: curvature * wheelbase
      const k = wrap(heading(v.route, v.s + 0.8) - heading(v.route, v.s - 0.8)) / 1.6;
      v.steer += (Math.atan(k * T.base) * 1.4 - v.steer) * Math.min(1, dt * 6);
      v.wheel += v.v * dt;
      // body (tiny suspension bob when moving)
      const bob = v.v > 0.1 ? Math.sin(t * 11 + v.i) * 0.006 : 0;
      e.set(Math.sin(t * 7 + v.i * 2) * 0.004 * Math.min(1, v.v), v.yaw, 0, 'YXZ'); q.setFromEuler(e);
      mV.compose(pos.set(v.x, bob, v.z), q, one);
      const d = camera ? Math.hypot(v.x - camPos.x, v.z - camPos.z, camPos.y * 0.6) : 1e9;
      v.hi = !far && (v.hi ? d < 24 : d < 20);
      const tm = v.hi ? lods[v.type].hi : lods[v.type].lo;
      tm.setMatrixAt(tm.count++, mV);
      const wm = v.hi ? wheelsHi : wheelsLo;
      // wheels
      T.wheels.forEach(([wx, wy, wz, wr, front], j) => {
        const right = wx < 0;
        e.set(right ? -v.wheel / wr : v.wheel / wr, (front ? v.steer : 0) + (right ? Math.PI : 0), 0, 'YXZ'); q.setFromEuler(e);
        mA.compose(pos.set(wx, wy - bob, wz), q, sc.set(wr, wr, wr));
        mO.multiplyMatrices(mV, mA);
        if (v.hi) wm.setMatrixAt(wHi++, mO); else wm.setMatrixAt(wLo++, mO);
      });
      if (TYPES[v.type].cab) glass.setMatrixAt(cabbed.indexOf(v), mV);
      // decals
      if (v.type === 'box') {
        const bi = boxes.indexOf(v);
        for (const s of [1, -1]) {
          e.set(0, s * Math.PI / 2, 0, 'XYZ'); q.setFromEuler(e);
          mA.compose(pos.set(s * DECAL.x, DECAL.y, DECAL.z), q, one);
          mO.multiplyMatrices(mV, mA);
          decals.setMatrixAt(bi * 2 + (s > 0 ? 0 : 1), mO);
        }
      }
    }
    for (const L of Object.values(lods)) { L.hi.instanceMatrix.needsUpdate = true; L.lo.instanceMatrix.needsUpdate = true; }
    wheelsHi.count = wHi; wheelsLo.count = wLo;
    wheelsHi.instanceMatrix.needsUpdate = true; wheelsLo.instanceMatrix.needsUpdate = true; decals.instanceMatrix.needsUpdate = true; glass.instanceMatrix.needsUpdate = true;
  }

  const segA = new THREE.Vector3(), segB = new THREE.Vector3();
  function pick(raycaster) {
    let best = -1, bt = Infinity;
    for (const v of vehicles) {
      const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw), h = TYPES[v.type].len / 2;
      segA.set(v.x - fx * h * 0.8, 0.8, v.z - fz * h * 0.8); segB.set(v.x + fx * h * 0.8, 0.8, v.z + fz * h * 0.8);
      const d2 = raycaster.ray.distanceSqToSegment(segA, segB, pos);
      if (d2 < 0.6 * 0.6) { const tt = pos.distanceTo(raycaster.ray.origin); if (tt < bt) { bt = tt; best = v.i; } }
    }
    return best;
  }

  update(0, 1 / 60);
  return { object: group, vehicles, routes: R, update, setPlayerPosition: (p) => player.set(p.x, 0, p.z), pick, meshes: { ...meshes, wheels, decals } };
}

/** A single static vehicle mesh (for props / parked trucks): type 'box' | 'flatbed' | 'forklift'. */
export function createVehicle(type = 'box') {
  const g = new THREE.Group();
  const mat = paintMaterial({ key: 'vehicle', side: THREE.FrontSide, clearcoatRoughness: 0.12 });
  const body = new THREE.Mesh(TYPES[type].make(), mat); body.castShadow = body.receiveShadow = true; g.add(body);
  const wg = wheelGeometry();
  for (const [wx, wy, wz, wr] of TYPES[type].wheels) {
    const w = new THREE.Mesh(wg, mat); w.position.set(wx, wy, wz); w.scale.setScalar(wr); if (wx < 0) w.rotation.y = Math.PI; w.castShadow = true; g.add(w);
  }
  if (type === 'box') for (const s of [1, -1]) {
    const d = new THREE.Mesh(new THREE.PlaneGeometry(DECAL.w, DECAL.h), new THREE.MeshPhysicalMaterial({ map: logoTexture(), roughness: 0.32, clearcoat: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    d.position.set(s * DECAL.x, DECAL.y, DECAL.z); d.rotation.y = s * Math.PI / 2; g.add(d);
  }
  return g;
}
