// Rough ER: tightly arranged, curved blue membrane corridors wrapping the nucleus as a terraced
// amphitheatre (inner rings stand higher), studded with red-orange ribosomes, pale edge trim,
// staggered passages, and a central avenue ramp climbing to the nucleus balcony.
import * as THREE from 'three';
import { RER, NUCLEUS, insideCell } from '../layout.js';
import * as M from '../../core/materials.js';
import { sweepXZ, roundedWallProfile, mergeGeometries, instanced } from '../../core/geom.js';
import { mulberry32, fbm2 } from '../../core/noise.js';
import { organic } from '../../core/lookdev.js';

const D = Math.PI / 180;
const NR = RER.rings.length;
const BODY = new THREE.Color(0x5f84c8), TRIM = new THREE.Color(0x9dbaf0);

/** Angular segments of a ring after removing gaps. Returns [[a0,a1],...] in radians. */
function ringSegments(i, rnd) {
  const gaps = [[RER.ramp.angle, 2.0 / RER.rings[i]]];
  const count = 1 + (i % 2);
  for (let k = 0; k < count; k++) {
    const a = (i * 47 + k * (360 / count) + 23 + rnd() * 30) * D;
    gaps.push([a, (0.7 + rnd() * 0.4) / RER.rings[i]]);
  }
  const cuts = gaps.map(([c, h]) => [c - h, c + h]).sort((p, q) => p[0] - q[0]);
  const segs = [];
  let cur = cuts[0][1];
  for (let k = 1; k < cuts.length; k++) {
    if (cuts[k][0] > cur) segs.push([cur, cuts[k][0]]);
    cur = Math.max(cur, cuts[k][1]);
  }
  const end = cuts[0][0] + Math.PI * 2;
  if (end > cur) segs.push([cur, end]);
  return segs;
}

/** Split ring segments so no wall pokes through the membrane. */
function clipToCell(i, segs) {
  const out = [];
  for (const [a0, a1] of segs) {
    const n = Math.ceil((a1 - a0) * RER.rings[i] / 0.25);
    let run = null;
    for (let k = 0; k <= n; k++) {
      const a = a0 + (a1 - a0) * (k / n), r = rerRadius(i, a) + 0.6;
      const ok = insideCell(RER.cx + Math.cos(a) * r, RER.cz + Math.sin(a) * r, 1.4);
      if (ok && !run) run = [a, a];
      if (ok) run[1] = a;
      if ((!ok || k === n) && run) { out.push(run); run = null; }
    }
  }
  return out;
}

/** Wavy radius so walls read as soft membrane folds, not machined rings. */
export function rerRadius(i, a) {
  const r = RER.rings[Math.min(i, NR - 1)];
  return r + Math.sin(a * 5 + i * 1.7) * 0.2 + Math.sin(a * 11 + i) * 0.07 + fbm2(Math.cos(a) * 3 + i, Math.sin(a) * 3, 2) * 0.3;
}
/** Corridor floor level outside ring i (between ring i and i+1). */
const floorOut = (i) => (i + 1 < NR ? RER.base[i + 1] : 0);
const floorIn = (i) => (i === 0 ? NUCLEUS.plinthH : RER.base[i]);
const top = (i) => RER.base[i] + RER.heights[i];

/** Height of the avenue ramp at distance r from the nucleus centre. */
export function avenueHeight(r) {
  const r0 = NUCLEUS.plinthR, r1 = RER.rings[NR - 1] + 1.8;
  return NUCLEUS.plinthH * THREE.MathUtils.clamp((r1 - r) / (r1 - r0), 0, 1);
}

export function buildRER() {
  const g = new THREE.Group(); g.name = 'rer';
  g.position.set(RER.cx, 0, RER.cz);
  const rnd = mulberry32(9001);

  const wallMat = organic(M.satin(0xffffff, { rough: 0.46, clearcoat: 0.3, normalScale: 0.4, repeat: 1, key: 'rerWall' }), { rim: 0x9cc2ff, rimPower: 3.0, rimStrength: 0.18, sss: 0x2f62d0, sssStrength: 0.14 });
  wallMat.vertexColors = true;
  wallMat.normalMap = grooveNormal(); wallMat.normalScale.set(0.32, 0.32);
  const lumenMat = organic(M.satin(0x4466b0, { rough: 0.45, clearcoat: 0.4, key: 'lumen' }), { rim: 0x6f9cff, rimStrength: 0.25, sss: 0x1f3f8f, sssStrength: 0.2 });
  const wallGeos = [], floorGeos = [];
  const studs = [], studColors = [];

  for (let i = 0; i < NR; i++) {
    const W = RER.wallW, H = top(i);
    for (const [a0, a1] of clipToCell(i, ringSegments(i, rnd))) {
      const len = (a1 - a0) * RER.rings[i];
      if (len < 1.2) continue;
      const steps = Math.max(8, Math.round(len / 0.3));
      const path = [];
      for (let s = 0; s <= steps; s++) {
        const a = a0 + (a1 - a0) * (s / steps), r = rerRadius(i, a);
        path.push({ x: Math.cos(a) * r, z: Math.sin(a) * r });
      }
      const lo = Math.min(floorIn(i), floorOut(i));
      const prof = roundedWallProfile(W, H, 0.08, 3, -0.05); // crisp, slightly softened top edge: a membrane sheet, not a tube
      const scale = null; // full section to the ends; rounded capsule caps are added below
      // vertex colour: steel-blue body, pale painted trim band over the rounded top
      const colorFn = (j, u, v) => (v > H - 0.16 ? TRIM : BODY);
      wallGeos.push(sweepXZ(path, prof, { scale, uvScale: [0.45, (2 * H + W) * 0.45], colorFn, capEnds: false, flip: true }));
      for (const e of [path[0], path[path.length - 1]]) wallGeos.push(endCap(e.x, e.z, W / 2, H));

      // ribosomes on both faces, only above that face's corridor floor
      const n = Math.round(len * 5.0);
      for (let s = 0; s < n; s++) {
        const tt = rnd();
        if (tt < 0.05 || tt > 0.95) continue;
        const a = a0 + (a1 - a0) * tt;
        const side = rnd() < 0.5 ? -1 : 1; // -1 inner face, +1 outer face
        const floor = side < 0 ? floorIn(i) : floorOut(i);
        if (H - floor < 0.6) continue;
        const sc = 0.062 + rnd() * 0.012;
        const r = rerRadius(i, a) + side * (W / 2 + sc * 0.55);
        // sit in loose rows that follow the wall's groove bands
        const rows = Math.max(1, Math.floor((H - floor - 0.45) / 0.24));
        const y = floor + 0.3 + Math.floor(rnd() * rows) * 0.24 + (rnd() - 0.5) * 0.04;
        if (tt < 0.1 || tt > 0.9) continue;
        studs.push(new THREE.Matrix4().compose(
          new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd() * 3, rnd() * 3, rnd() * 3)),
          new THREE.Vector3(sc, sc * 0.82, sc)));
        studColors.push(new THREE.Color(0xc63a2a).offsetHSL(0, 0, (rnd() - 0.5) * 0.04));
      }
    }
    // corridor floor (lumen) outside this ring, following both wavy radii, with a skirt under the next wall
    if (i < NR) floorGeos.push(corridorFloor(i));
  }

  const walls = new THREE.Mesh(mergeGeometries(wallGeos.map((g) => (g.index ? g.toNonIndexed() : g))), wallMat);
  walls.castShadow = walls.receiveShadow = true; walls.name = 'rerWalls';
  const floors = new THREE.Mesh(mergeGeometries(floorGeos), lumenMat);
  floors.receiveShadow = true; floors.castShadow = true;
  g.add(walls, floors);

  const studMat = organic(new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.15, emissive: 0x5a0d00, emissiveIntensity: 0.6 }), { rim: 0xffb08a, rimStrength: 0.5, sss: 0xff3b1a, sssStrength: 0.25 });
  const studMesh = instanced(new THREE.IcosahedronGeometry(1, 2), studMat, studs, { castShadow: false, colors: studColors });
  studMesh.name = 'ribosomes';
  g.add(studMesh);

  g.add(buildAvenue());

  // a few ribosomes glow briefly as they translate: each pulse restores its own bead afterwards
  let acc = 0;
  const hot = new THREE.Color(0xff9a6a), lit = [];
  g.userData.update = (t, dt) => {
    acc += dt;
    while (acc > 0.12) {
      acc -= 0.12;
      const k = Math.floor(Math.random() * studs.length);
      studMesh.setColorAt(k, hot); lit.push({ k, until: t + 0.6 });
    }
    while (lit.length && lit[0].until < t) { const { k } = lit.shift(); studMesh.setColorAt(k, studColors[k]); }
    studMesh.instanceColor.needsUpdate = true;
  };
  return g;
}

/** Rounded capsule end for a wall segment (vertical half-pill), coloured like the wall with a pale cap. */
function endCap(x, z, r, H) {
  const body = new THREE.CylinderGeometry(r, r, H - r + 0.05, 20, 1, true);
  body.translate(0, (H - r - 0.05) / 2, 0);
  const top = new THREE.SphereGeometry(r, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);
  top.translate(0, H - r, 0);
  const g = mergeGeometries([body.toNonIndexed(), top.toNonIndexed()]);
  const n = g.attributes.position.count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const c = g.attributes.position.getY(i) > H - 0.05 ? TRIM : BODY; col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.translate(x, 0, z);
  return g;
}

/** Horizontal groove bands (membrane lamellae) for the ER walls; tiles in both directions. */
function grooveNormal() {
  // vertical lamellae (folded membrane sheet), with a faint horizontal undulation
  const S = 256; const c = document.createElement('canvas'); c.width = c.height = S;
  const ctx = c.getContext('2d'); const img = ctx.createImageData(S, S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4;
      const ph = (x / S) * Math.PI * 2 * 7;
      const nx = Math.sin(ph) * 0.42 * Math.pow(Math.abs(Math.sin(ph)), 0.5);
      const ny = Math.sin((y / S) * Math.PI * 2 * 2 + x * 0.02) * 0.05;
      const l = Math.hypot(nx, ny, 1);
      img.data[i] = (nx / l * 0.5 + 0.5) * 255; img.data[i + 1] = (ny / l * 0.5 + 0.5) * 255; img.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.NoColorSpace; t.anisotropy = 8;
  return t;
}

function corridorFloor(i) {
  const y = Math.max(floorOut(i), 0.06);
  const steps = 360;
  const pos = [], idx = [];
  const rOuter = (a) => (i + 1 < NR ? rerRadius(i + 1, a) : RER.rings[NR - 1] + 1.3);
  for (let s = 0; s <= steps; s++) {
    const a = (s / steps) * Math.PI * 2;
    const ri = rerRadius(i, a) - 0.1, ro = rOuter(a);
    const c = Math.cos(a), sn = Math.sin(a);
    pos.push(c * ri, y, sn * ri, c * ro, y, sn * ro, c * ro, 0, sn * ro);
  }
  const inside = [];
  for (let s = 0; s <= steps; s++) {
    const a = (s / steps) * Math.PI * 2, ro = rOuter(a);
    inside.push(insideCell(RER.cx + Math.cos(a) * ro, RER.cz + Math.sin(a) * ro, 1.0));
  }
  for (let s = 0; s < steps; s++) {
    if (!inside[s] || !inside[s + 1]) continue;
    const a = s * 3, b = (s + 1) * 3;
    idx.push(a, b, a + 1, a + 1, b, b + 1);       // top
    idx.push(a + 1, b + 1, a + 2, a + 2, b + 1, b + 2); // skirt
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx); geo.computeVertexNormals();
  return geo;
}

/** Raised avenue climbing from the city floor to the nucleus balcony, with curbs, lamps, rails. */
function buildAvenue() {
  const grp = new THREE.Group(); grp.name = 'avenue';
  const a = RER.ramp.angle, dx = Math.cos(a), dz = Math.sin(a);
  const r0 = NUCLEUS.plinthR - 0.4, r1 = RER.rings[NR - 1] + 1.8, w = 3.0;
  const n = 40;
  const pos = [], idx = [];
  const px = -dz, pz = dx; // lateral
  for (let k = 0; k <= n; k++) {
    const r = r0 + (r1 - r0) * (k / n), y = avenueHeight(r) + 0.05;
    const cx = dx * r, cz = dz * r;
    for (const s of [-1, 1]) pos.push(cx + px * s * w / 2, y, cz + pz * s * w / 2);
    for (const s of [-1, 1]) pos.push(cx + px * s * w / 2, 0, cz + pz * s * w / 2);
  }
  for (let k = 0; k < n; k++) {
    const A = k * 4, B = (k + 1) * 4;
    idx.push(A, A + 1, B, A + 1, B + 1, B);          // top
    idx.push(A, B, A + 2, A + 2, B, B + 2);          // left side
    idx.push(A + 1, A + 3, B + 1, A + 3, B + 3, B + 1); // right side
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const uv = [];
  for (let k = 0; k <= n; k++) { const v = (r1 - r0) * (k / n) / 6; uv.push(0, v, 0.5, v, 0, v, 0.5, v); }
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx); geo.computeVertexNormals();
  const road = new THREE.Mesh(geo, M.asphalt());
  road.receiveShadow = true; road.castShadow = true;
  grp.add(road);
  // curbs + rails + lamps
  const curbGeo = [], postGeo = [];
  for (const s of [-1, 1]) {
    const pts = [];
    for (let k = 0; k <= n; k++) {
      const r = r0 + (r1 - r0) * (k / n);
      pts.push(new THREE.Vector3(dx * r + px * s * (w / 2 - 0.12), avenueHeight(r) + 0.16, dz * r + pz * s * (w / 2 - 0.12)));
    }
    curbGeo.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.14, 6));
    const rail = pts.map((p) => p.clone().add(new THREE.Vector3(0, 0.75, 0)));
    curbGeo.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rail), 60, 0.045, 6));
    for (let k = 0; k <= n; k += 3) {
      const p = pts[k];
      const pg = new THREE.CylinderGeometry(0.035, 0.035, 0.75, 6); pg.translate(p.x, p.y + 0.37, p.z); postGeo.push(pg);
    }
  }
  const curbs = new THREE.Mesh(mergeGeometries(curbGeo), M.satin(0xd9dde3, { rough: 0.5, key: 'curb' }));
  curbs.castShadow = true; grp.add(curbs);
  grp.add(new THREE.Mesh(mergeGeometries(postGeo), M.metal(0xc9ced6, 0.3)));
  // centre dashes
  const dash = [];
  for (let k = 1; k < n; k += 2) {
    const r = r0 + (r1 - r0) * (k / n);
    const d = new THREE.PlaneGeometry(0.12, 0.55); d.rotateX(-Math.PI / 2);
    d.rotateY(-(a - Math.PI / 2)); d.translate(dx * r, avenueHeight(r) + 0.07, dz * r);
    dash.push(d);
  }
  grp.add(new THREE.Mesh(mergeGeometries(dash), M.matte(0xf1ead8, 0.6)));
  return grp;
}
