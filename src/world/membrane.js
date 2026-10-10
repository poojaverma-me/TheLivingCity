// Cell membrane: thick, softly irregular, glassy pale blue-gray rim + floor slab + gates/ports.
import * as THREE from 'three';
import { CELL, cellWarp, GATES, insideCell, NUCLEUS, RER } from './layout.js';
import { superellipse, offsetContour, sweepXZ, mergeGeometries, bakeStatic } from '../core/geom.js';
import { fbm3 } from '../core/noise.js';
import * as M from '../core/materials.js';
import * as T from '../core/textures.js';
import { organic } from '../core/lookdev.js';
import { mulberry32 } from '../core/noise.js';

export function cellContour(offset = 0, count = 360) {
  const pts = superellipse(CELL.a, CELL.b, CELL.n, count, 0, 0, (x, z) => cellWarp(x, z));
  return offset ? offsetContour(pts, offset) : pts;
}

/** Point on the membrane centre-line at polar angle (0=+X, 90°=+Z). Returns {x,z,nx,nz} with outward normal. */
export function membranePoint(angle, offset = CELL.wall / 2) {
  const c = Math.cos(angle), s = Math.sin(angle);
  let x = CELL.a * Math.sign(c) * Math.pow(Math.abs(c), 2 / CELL.n);
  let z = CELL.b * Math.sign(s) * Math.pow(Math.abs(s), 2 / CELL.n);
  ({ x, z } = cellWarp(x, z));
  // numeric outward normal
  const e = 0.002;
  const c2 = Math.cos(angle + e), s2 = Math.sin(angle + e);
  let x2 = CELL.a * Math.sign(c2) * Math.pow(Math.abs(c2), 2 / CELL.n);
  let z2 = CELL.b * Math.sign(s2) * Math.pow(Math.abs(s2), 2 / CELL.n);
  ({ x: x2, z: z2 } = cellWarp(x2, z2));
  let tx = x2 - x, tz = z2 - z; const l = Math.hypot(tx, tz); tx /= l; tz /= l;
  const nx = tz, nz = -tx;
  return { x: x + nx * offset, z: z + nz * offset, nx, nz };
}

export function buildMembrane() {
  const group = new THREE.Group();
  group.name = 'membrane';
  const W = CELL.wall, H = CELL.height, B = CELL.baseDepth;

  // ---- Wall: pillow cross-section swept around the cell ----
  const path = cellContour(W / 2, 420);
  const rxIn = W / 2, rxOut = W / 2 * 1.12;
  const cy = (H - B) / 2, ry = (H + B) / 2;
  const prof = [];
  const steps = 30;
  for (let k = 0; k <= steps; k++) {
    const th = -Math.PI / 2 + 0.18 + (k / steps) * (2 * Math.PI - 0.36);
    const c = Math.cos(th), s = Math.sin(th);
    const rx = c > 0 ? rxIn : rxOut;
    prof.push([rx * Math.sign(c) * Math.pow(Math.abs(c), 2 / 2.7), cy + ry * Math.sign(s) * Math.pow(Math.abs(s), 2 / 2.4)]);
  }
  let profLen = 0; for (let k = 1; k < prof.length; k++) profLen += Math.hypot(prof[k][0] - prof[k - 1][0], prof[k][1] - prof[k - 1][1]);
  const wallGeo = sweepXZ(path, prof, {
    closed: true, flip: true, uvScale: [0.14, profLen * 0.14],
    displace: (p, N, i, j, u, v) => {
      const du = u / rxOut, dv = (v - cy) / ry; const l = Math.hypot(du, dv) || 1;
      const n = fbm3(p.x * 0.11, p.y * 0.16, p.z * 0.11, 2) * 0.75;
      const d = n * (v > -0.3 ? 1 : 0.4);
      p.x += N.x * (du / l) * d; p.z += N.y * (du / l) * d; p.y += (dv / l) * d * 0.55;
    },
  });
  const wallMat = M.bioGlass(0xa9c0d6, { rough: 0.36, normalScale: 0.09, repeat: 2, key: 'membrane' });
  wallMat.specularIntensity = 0.45;
  wallMat.sheen = 0.25; wallMat.sheenColor.set(0xdfeaf7);
  wallMat.clearcoat = 0.45; wallMat.clearcoatRoughness = 0.42; // no hot softbox smear along the top
  // lipid-head bead texture: the surface reads as a bilayer, not concrete
  // fake glass: transparent at facing angles, denser at grazing edges (no transmission pass needed)
  wallMat.transparent = true; wallMat.depthWrite = true;
  const prevMem = wallMat.onBeforeCompile;
  wallMat.onBeforeCompile = (sh, r) => {
    prevMem?.(sh, r);
    sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', `
      { float ndvG = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
        diffuseColor.a = mix(0.9, 0.5, pow(ndvG, 1.1)); }
      #include <opaque_fragment>`);
  };
  wallMat.customProgramCacheKey = () => 'membraneGlass';
  organic(wallMat, { rim: 0xf2f8ff, rimPower: 2.2, rimStrength: 0.55, sss: 0x8fb3dc, sssStrength: 0.2 });
  const wall = new THREE.Mesh(wallGeo, wallMat);
  wall.castShadow = true; wall.receiveShadow = true;
  wall.name = 'membraneWall';
  group.add(wall);
  group.add(buildMembraneProteins());

  // Inner opaque core so the glass has something to refract (the "bilayer" core, darker blue-gray)
  const coreProf = prof.map(([u, v]) => [u * 0.58, cy + (v - cy) * 0.66]);
  const coreGeo = sweepXZ(path, coreProf, { closed: true, flip: true });
  const core = new THREE.Mesh(coreGeo, M.satin(0xc3d2e0, { rough: 0.45, clearcoat: 0.3, key: 'memcore' }));
  core.receiveShadow = true;
  core.visible = false; // only needed when the wall was transmissive

  // ---- Floor slab (cytosol plaza) ----
  const inner = cellContour(0.6, 240);
  const shape = new THREE.Shape(inner.map((p) => new THREE.Vector2(p.x, -p.z)));
  const floorGeo = new THREE.ShapeGeometry(shape, 1);
  floorGeo.rotateX(-Math.PI / 2);
  // planar UVs in world units / 18
  const pos = floorGeo.attributes.position; const uv = floorGeo.attributes.uv;
  const uv1 = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, pos.getX(i) / 3, pos.getZ(i) / 3);
    uv1[i * 2] = (pos.getX(i) / CELL.a + 1) / 2; uv1[i * 2 + 1] = (pos.getZ(i) / CELL.b + 1) / 2;
  }
  floorGeo.setAttribute('uv1', new THREE.BufferAttribute(uv1, 2));
  const floorMat = M.plaza().clone();
  floorMat.aoMap = T.floorMacro({ a: CELL.a, b: CELL.b }, insideCell, [{ x: RER.cx, z: RER.cz, r: RER.rings[RER.rings.length - 1] + 1 }]);
  floorMat.aoMap.flipY = false;
  floorMat.aoMapIntensity = 1;
  // apply the macro map to direct light too (aoMap alone only darkens ambient)
  floorMat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n diffuseColor.rgb *= texture2D(aoMap, vAoMapUv).rgb;');
  };
  floorMat.customProgramCacheKey = () => 'floorMacro';
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.receiveShadow = true;
  floor.name = 'floor';
  group.add(floor);

  // Underside slab so the cell has volume on the white table
  const slabShape = new THREE.Shape(cellContour(W * 0.9, 240).map((p) => new THREE.Vector2(p.x, -p.z)));
  const slab = new THREE.Mesh(
    new THREE.ExtrudeGeometry(slabShape, { depth: B - 0.05, bevelEnabled: false, curveSegments: 4 }),
    M.satin(0x9fb0c0, { rough: 0.7, clearcoat: 0, key: 'slab' })
  );
  slab.rotation.x = -Math.PI / 2; slab.position.y = -B; slab.receiveShadow = true;
  group.add(slab);

  // Soft contact shadow pooled under the diorama (sells it sitting on the white table)
  const cs = new THREE.Mesh(new THREE.PlaneGeometry((CELL.a + W) * 2.5, (CELL.b + W) * 2.4), new THREE.MeshBasicMaterial({
    map: T.radialTexture('rgba(34,42,62,0.8)', 'rgba(34,42,62,0)', 256), transparent: true, depthWrite: false,
  }));
  cs.rotation.x = -Math.PI / 2; cs.position.y = -B + 0.02; cs.renderOrder = -1; group.add(cs);

  // ---- Gates / ports embedded in the wall ----
  for (const g of GATES) {
    const gate = g.kind === 'port' ? buildPort(g) : buildDoor(g);
    const pos = gate.position.clone(), rot = gate.rotation.y; gate.position.set(0, 0, 0); gate.rotation.y = 0;
    bakeStatic(gate); gate.position.copy(pos); gate.rotation.y = rot;
    group.add(gate);
  }

  bakeStatic(group); // gates share materials: merge them across the whole rim
  return group;
}

function frameAt(angle, offset = CELL.wall / 2) {
  const p = membranePoint(angle, offset);
  const yaw = Math.atan2(p.nx, p.nz); // object +Z faces outward
  return { p, yaw };
}

/**
 * Recessed glowing porthole (a protein channel): a flared lathe collar on both faces of the membrane,
 * a bevelled rim, and a deep violet luminous core set back inside the wall.
 */
function buildPort(g) {
  const { p, yaw } = frameAt(g.angle);
  const grp = new THREE.Group(); grp.name = `gate:${g.id}`;
  grp.position.set(p.x, 0, p.z); grp.rotation.y = yaw;
  const cy = 1.7, half = CELL.wall / 2 - 0.02; // lips seated on the membrane faces
  // flared collar profile (trumpet), revolved around the channel axis
  const prof = [];
  for (let k = 0; k <= 16; k++) { const t = k / 16; prof.push(new THREE.Vector2(0.95 + Math.pow(t, 2.2) * 0.75 + Math.sin(t * Math.PI) * 0.08, t * 0.9)); }
  const collarGeo = new THREE.LatheGeometry(prof, 48);
  const collarMat = M.satin(0xd9c8ff, { rough: 0.22, clearcoat: 1, metal: 0.35, key: 'portCollar' });
  for (const s of [-1, 1]) {
    const c = new THREE.Mesh(collarGeo, collarMat);
    c.rotation.x = s > 0 ? Math.PI / 2 : -Math.PI / 2; c.position.set(0, cy, s * (half - 0.9));
    grp.add(c);
    const lip = new THREE.Mesh(new THREE.TorusGeometry(1.72, 0.11, 12, 48), M.satin(0xf2ecff, { rough: 0.2, clearcoat: 1, key: 'portLip' }));
    lip.position.set(0, cy, s * half); grp.add(lip);
    const glowRing = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.06, 8, 48), M.emissive(0xd2a8ff, 5));
    glowRing.position.set(0, cy, s * (half - 0.5)); grp.add(glowRing);
  }
  // inner barrel + recessed luminous core (channel subunits as ribs)
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, CELL.wall, 40, 1, true), M.satin(0x3a2368, { rough: 0.35, key: 'portBarrel' }));
  barrel.material.side = THREE.DoubleSide; barrel.rotation.x = Math.PI / 2; barrel.position.y = cy; grp.add(barrel);
  const ribGeo = [];
  for (let k = 0; k < 8; k++) { const r = new THREE.BoxGeometry(0.12, 0.12, CELL.wall * 0.9); const a = (k / 8) * Math.PI * 2; r.translate(Math.cos(a) * 0.88, Math.sin(a) * 0.88 + cy, 0); ribGeo.push(r); }
  grp.add(new THREE.Mesh(mergeGeometries(ribGeo), M.satin(0x7a4fd0, { rough: 0.3, clearcoat: 1, key: 'portRib' })));
  const core = new THREE.Mesh(new THREE.CircleGeometry(0.86, 40), M.emissive(0xb77cff, 4.2, 0x5a20b0));
  core.position.set(0, cy, 0); grp.add(core);
  const core2 = core.clone(); core2.rotation.y = Math.PI; grp.add(core2);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.radialTexture('rgba(190,140,255,0.7)', 'rgba(190,140,255,0)'), depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.setScalar(3.4); halo.position.set(0, cy, -(half + 0.2)); grp.add(halo); // glow stays inside the cell
  grp.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  grp.userData.update = (t) => { core.material.emissiveIntensity = 3.6 + Math.sin(t * 1.6 + g.angle * 3) * 0.8; };
  return grp;
}

/** Airlock gate embedded in the membrane: matching frames on both faces, a lit door on the inner face. */
function buildDoor(g) {
  const { p, yaw } = frameAt(g.angle);
  const grp = new THREE.Group(); grp.name = `gate:${g.id}`;
  grp.position.set(p.x, 0, p.z); grp.rotation.y = yaw;
  const arch = (w, h, r) => {
    const sh = new THREE.Shape();
    sh.moveTo(-w, 0); sh.lineTo(-w, h - r); sh.quadraticCurveTo(-w, h, -w + r, h);
    sh.lineTo(w - r, h); sh.quadraticCurveTo(w, h, w, h - r); sh.lineTo(w, 0); sh.lineTo(-w, 0);
    return sh;
  };
  const outerS = arch(2.05, 2.75, 0.9); outerS.holes.push(arch(1.45, 2.2, 0.6));
  const frameGeo = new THREE.ExtrudeGeometry(outerS, { depth: 0.55, bevelEnabled: true, bevelSize: 0.1, bevelThickness: 0.1, bevelSegments: 3, curveSegments: 14 });
  const frameMat = M.satin(0xe9e4f5, { rough: 0.35, clearcoat: 0.6, key: 'gateFrame' });
  const half = CELL.wall / 2;
  for (const s of [-1]) { // inner face only: an outer frame read as a ghost hatch through the glassy wall
    const f = new THREE.Mesh(frameGeo, frameMat); f.position.z = s > 0 ? half - 0.25 : -half - 0.3; grp.add(f);
    // lavender light strip following the arch inner edge
    const pts = [];
    for (let k = 0; k <= 30; k++) { const t = k / 30; const a2 = Math.PI * t; pts.push(new THREE.Vector3(-Math.cos(a2) * 1.52, 1.45 + Math.sin(a2) * 0.85, 0)); }
    const strip = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-1.52, 0.1, 0), ...pts, new THREE.Vector3(1.52, 0.1, 0)]), 60, 0.05, 6), M.emissive(0xc9a8ff, 4));
    strip.position.z = s > 0 ? half + 0.35 : -half - 0.35; grp.add(strip);
  }
  // door panel on the inner face (two leaves with a seam), clearly opaque
  const leafS = arch(1.42, 2.17, 0.58);
  const door = new THREE.Mesh(new THREE.ExtrudeGeometry(leafS, { depth: 0.18, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2, curveSegments: 12 }), M.satin(0x6c5aa0, { rough: 0.35, clearcoat: 0.6, key: 'gateDoor' }));
  door.position.z = -half - 0.2; grp.add(door);
  const seam = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.0, 0.04), M.emissive(0xe9d8ff, 3)); seam.position.set(0, 1.05, -half - 0.22 - 0.02); grp.add(seam);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.42), new THREE.MeshStandardMaterial({ map: T.signTexture(g.id === 'front' ? 'FRONT GATE' : 'SERVICE GATE', { bg: '#2a2150', fg: '#f3ecff', w: 512, h: 98 }), emissive: 0xffffff, emissiveIntensity: 0.4, emissiveMap: T.signTexture(g.id === 'front' ? 'FRONT GATE' : 'SERVICE GATE', { bg: '#2a2150', fg: '#f3ecff', w: 512, h: 98 }) }));
  sign.position.set(0, 3.2, -half - 0.45); sign.rotation.y = Math.PI; grp.add(sign);
  grp.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return grp;
}

/**
 * Transmembrane proteins studding the inner face: glossy pill-shaped channels, receptor knobs and
 * pump clusters in lavender / teal / gold, half-embedded in the bilayer (instanced, 3 shapes).
 */
function buildMembraneProteins() {
  const grp = new THREE.Group(); grp.name = 'membraneProteins';
  const rnd = mulberry32(77);
  const shapes = [
    { geo: new THREE.CapsuleGeometry(0.32, 0.9, 6, 14), m: [] },
    { geo: new THREE.SphereGeometry(0.42, 18, 12), m: [] },
    { geo: new THREE.CapsuleGeometry(0.22, 0.5, 5, 12), m: [] },
  ];
  const cols = [];
  const palette = [0xb48cf0, 0x6fd6c8, 0xf2c45a, 0x8fb4ff, 0xf29ac0];
  const N = 110;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 + (rnd() - 0.5) * 0.02;
    if (GATES.some((g) => Math.abs(Math.atan2(Math.sin(a - g.angle), Math.cos(a - g.angle))) < 0.07)) continue;
    const p = membranePoint(a, 0.05);
    const k = rnd() < 0.55 ? 0 : 1;
    const y = k === 0 ? 1.5 + rnd() * 0.5 : 1.2 + rnd() * 0.9; // one band: no stacked shapes reading as punctuation
    const s = 0.6 + rnd() * 0.35;
    const yaw = Math.atan2(p.nx, p.nz);
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(p.x, y, p.z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, (rnd() - 0.5) * 0.25)),
      k === 0 ? new THREE.Vector3(s, s, s) : new THREE.Vector3(s * 1.5, s * 0.75, s * 1.0));
    shapes[k].m.push(m);
    (shapes[k].c ||= []).push(new THREE.Color(palette[Math.floor(rnd() * palette.length)]));
  }
  const mat = organic(new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.15 }), { rim: 0xffffff, rimStrength: 0.35, sssStrength: 0.15, sss: 0x9a7ad8 });
  for (const sh of shapes) {
    const im = new THREE.InstancedMesh(sh.geo, mat, sh.m.length);
    sh.m.forEach((m, i) => { im.setMatrixAt(i, m); im.setColorAt(i, sh.c[i]); });
    im.castShadow = false; im.receiveShadow = true; im.computeBoundingSphere();
    grp.add(im);
  }
  return grp;
}
