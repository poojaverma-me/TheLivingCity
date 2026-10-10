// Nucleus: violet hemispherical command center, front cut away to reveal the operations floor,
// curved wall of glowing screens, workstations and the luminous blue nucleolus.
import * as THREE from 'three';
import { NUCLEUS, RER } from '../layout.js';
import * as M from '../../core/materials.js';
import * as T from '../../core/textures.js';
import { mergeGeometries, trs, instanced, place } from '../../core/geom.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mulberry32, tileFbm } from '../../core/noise.js';
import { organic } from '../../core/lookdev.js';

const D = Math.PI / 180;

/** Console arcs [radius, count] and which stations have a standing operator (src/life/staff.js). */
export const CONSOLE_ARCS = [[3.3, 7], [4.7, 10]];
export const isStaffed = (arc, i) => (arc === 0 ? i % 3 === 1 : i % 3 === 0);
/** Operator standing spot (local to the nucleus centre) for console arc/index: on the chair side. */
export function consoleSpot(arc, i) {
  const [rr, n] = CONSOLE_ARCS[arc], span = 130 * D;
  const a = -90 * D - span / 2 + (i + 0.5) * (span / n), r = rr - 0.62;
  return { x: Math.cos(a) * r, z: Math.sin(a) * r, yaw: Math.atan2(Math.cos(a), Math.sin(a)) };
}

/** Is a direction (phi around Y, measured like Math.atan2(z,x)) / elevation inside the front opening? */
function inOpening(phi, elev) {
  let d = phi - NUCLEUS.cutCenter;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  const half = NUCLEUS.cutWidth / 2;
  if (Math.abs(d) >= half) return false;
  const s = d / half;
  const maxE = 72 * D * Math.pow(1 - s * s, 0.36);
  return elev < maxE;
}

/** Hemisphere shell with the arched front opening removed. */
function shellGeometry(r, seg = 160, rings = 72) {
  const g = new THREE.SphereGeometry(r, seg, rings, 0, Math.PI * 2, 0, Math.PI / 2);
  const pos = g.attributes.position; const idx = g.index.array;
  const keep = [];
  const v = new THREE.Vector3();
  for (let i = 0; i < idx.length; i += 3) {
    let cx = 0, cy = 0, cz = 0;
    for (let k = 0; k < 3; k++) { v.fromBufferAttribute(pos, idx[i + k]); cx += v.x; cy += v.y; cz += v.z; }
    const phi = Math.atan2(cz, cx), elev = Math.atan2(cy, Math.hypot(cx, cz));
    if (!inOpening(phi, elev)) keep.push(idx[i], idx[i + 1], idx[i + 2]);
  }
  g.setIndex(keep);
  return g;
}

/** Boundary curve of the opening at radius r (arch from left base, over, to right base). */
function openingCurve(r, n = 90) {
  const pts = [];
  const half = NUCLEUS.cutWidth / 2;
  for (let i = 0; i <= n; i++) {
    const s = -1 + (2 * i) / n;
    const phi = NUCLEUS.cutCenter + s * half;
    const elev = 72 * D * Math.pow(Math.max(0, 1 - s * s), 0.36);
    pts.push(new THREE.Vector3(r * Math.cos(elev) * Math.cos(phi), r * Math.sin(elev), r * Math.cos(elev) * Math.sin(phi)));
  }
  return pts;
}

export function buildNucleus() {
  const g = new THREE.Group(); g.name = 'nucleus';
  g.position.set(NUCLEUS.x, 0, NUCLEUS.z);
  const R = NUCLEUS.r, PH = NUCLEUS.plinthH;
  const rnd = mulberry32(42);

  // ---------- Plinth: drum the dome stands on (mostly hidden by the ER terraces) + balcony ring ----------
  const plinthMat = M.satin(0x7a62a8, { rough: 0.5, clearcoat: 0.3, key: 'plinth' });
  const plinthLight = M.satin(0xbfaee0, { rough: 0.45, clearcoat: 0.4, key: 'plinthL' });
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(NUCLEUS.plinthR, NUCLEUS.plinthR + 0.3, PH, 128), plinthMat);
  drum.position.y = PH / 2; drum.castShadow = drum.receiveShadow = true; g.add(drum);
  const balcony = new THREE.Mesh(new THREE.RingGeometry(R - 0.2, NUCLEUS.plinthR + 0.05, 128, 1), plinthLight);
  balcony.rotation.x = -Math.PI / 2; balcony.position.y = PH + 0.01; balcony.receiveShadow = true; g.add(balcony);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(NUCLEUS.plinthR - 0.1, 0.12, 10, 160), plinthLight);
  lip.rotation.x = Math.PI / 2; lip.position.y = PH + 0.06; g.add(lip);

  const dome = new THREE.Group(); dome.name = 'dome';
  dome.position.y = PH; dome.scale.y = NUCLEUS.domeScaleY; g.add(dome);

  // ---------- Nuclear envelope: double shell ----------
  const outerMat = new THREE.MeshPhysicalMaterial({
    color: 0x9a6ae8, roughness: 0.38, metalness: 0, clearcoat: 0.25, clearcoatRoughness: 0.65, envMapIntensity: 0.55, specularIntensity: 0.5,
    
    sheen: 0.25, sheenColor: new THREE.Color(0xd9c2ff), sheenRoughness: 0.4,
    iridescence: 0.3, iridescenceIOR: 1.3, iridescenceThicknessRange: [200, 600], normalMap: T.paintNormal(), normalScale: new THREE.Vector2(0.15, 0.15),
  });
  organic(outerMat, { rim: 0xb78cff, rimPower: 3.2, rimStrength: 0.22, sss: 0x6a22e0, sssStrength: 0.16 });
  // inner nuclear membrane: same violet glass family seen from inside (no paint texture)
  const innerMat = new THREE.MeshPhysicalMaterial({ color: 0x6a3cc0, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.15, transparent: true, opacity: 0.55, side: THREE.BackSide, depthWrite: false });
  const outer = new THREE.Mesh(shellGeometry(R), outerMat);
  const inner = new THREE.Mesh(shellGeometry(R - 0.26), innerMat);
  outer.castShadow = true; outer.receiveShadow = true; inner.receiveShadow = true;
  dome.add(outer, inner);

  // Cut-edge rim (covers the gap between the two membranes; lighter violet like the reference)
  const rimCurve = new THREE.CatmullRomCurve3(openingCurve(R - 0.13));
  const rim = new THREE.Mesh(new THREE.TubeGeometry(rimCurve, 220, 0.17, 12, false), M.satin(0xc9b6ff, { rough: 0.42, clearcoat: 0.2, metal: 0.45, key: 'nucRim' }));
  rim.castShadow = true; dome.add(rim);
  // perinuclear space glow strip just inside the rim
  const rim2 = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(openingCurve(R - 0.5)), 220, 0.06, 6, false), M.emissive(0xe2c6ff, 4.5, 0x4a2a80));
  dome.add(rim2);

  // Base bands of the envelope (layered perimeter)
  for (let i = 0; i < 2; i++) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(R + 0.05 + i * 0.22, 0.2 - i * 0.04, 10, 180, Math.PI * 2 - NUCLEUS.cutWidth),
      i ? plinthLight : M.satin(0x9476c8, { rough: 0.4, key: 'band' }));
    band.rotation.x = -Math.PI / 2; band.rotation.z = NUCLEUS.cutCenter + NUCLEUS.cutWidth / 2;
    band.position.y = 0.18 + i * 0.32; band.castShadow = true; dome.add(band);
  }

  // ---------- Nuclear pores (instanced ring + dark core) on the outer shell ----------
  const poreRing = new THREE.TorusGeometry(0.15, 0.05, 6, 14);
  const poreCore = new THREE.CircleGeometry(0.11, 10);
  const ringM = [], coreM = [];
  const q = new THREE.Quaternion(), up = new THREE.Vector3(0, 0, 1);
  for (let i = 0; i < 140; i++) {
    const phi = rnd() * Math.PI * 2, elev = Math.asin(rnd() * 0.97);
    if (inOpening(phi, elev + 0.06) || inOpening(phi + 0.05, elev) || inOpening(phi - 0.05, elev)) continue;
    const n = new THREE.Vector3(Math.cos(elev) * Math.cos(phi), Math.sin(elev), Math.cos(elev) * Math.sin(phi));
    if (n.y < 0.05) continue;
    q.setFromUnitVectors(up, n);
    const p = n.clone().multiplyScalar(R + 0.02);
    const ps = 0.7 + rnd() * 0.75;
    ringM.push(new THREE.Matrix4().compose(p, q, new THREE.Vector3(ps, ps, ps)));
    coreM.push(new THREE.Matrix4().compose(n.clone().multiplyScalar(R + 0.04), q, new THREE.Vector3(ps, ps, ps)));
  }
  dome.add(instanced(poreRing, M.satin(0x9d7ad8, { rough: 0.35, clearcoat: 0.7, key: 'pore' }), ringM, { castShadow: false }));
  dome.add(instanced(poreCore, M.emissive(0xc79bff, 3.2, 0x2a1050), coreM, { castShadow: false }));
  dome.add(buildRibs(R));

  // Pole beacon
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 16), M.satin(0x9b72de, { rough: 0.25, clearcoat: 1, key: 'knob' }));
  knob.position.y = PH + R * NUCLEUS.domeScaleY + 0.2; knob.castShadow = true;
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), M.emissive(0xe0c6ff, 3.5));
  beacon.position.y = PH + R * NUCLEUS.domeScaleY + 0.8;
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 8), M.metal());
  mast.position.y = PH + R * NUCLEUS.domeScaleY + 0.55;
  g.add(knob, mast, beacon);

  // ---------- Interior: operations floor ----------
  const floorTex = opsFloorTexture();
  const opsFloor = new THREE.Mesh(new THREE.CircleGeometry(R - 0.45, 96), new THREE.MeshStandardMaterial({ map: floorTex, emissiveMap: floorTex, emissive: 0xffffff, emissiveIntensity: 0.1, roughness: 0.4, metalness: 0.1, envMapIntensity: 1.0 }));
  opsFloor.rotation.x = -Math.PI / 2; opsFloor.position.y = PH + 0.01; opsFloor.receiveShadow = true;
  g.add(opsFloor);

  // Curved freestanding screen wall (the "control center"): 3 tiers of glowing displays facing the opening
  const SW = { r: 6.3, span: 150 * D, h: 4.9 };
  const wallShape = new THREE.Shape();
  const sw0 = -90 * D - SW.span / 2, sw1 = -90 * D + SW.span / 2;
  wallShape.absarc(0, 0, SW.r + 0.35, sw0, sw1, false);
  wallShape.absarc(0, 0, SW.r, sw1, sw0, true);
  const swGeo = new THREE.ExtrudeGeometry(wallShape, { depth: SW.h, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 2, curveSegments: 64 });
  swGeo.rotateX(Math.PI / 2); swGeo.scale(1, -1, 1); // shape XY -> XZ, extrude up
  const screenWall = new THREE.Mesh(swGeo, M.metal(0x2a3360, 0.32));
  screenWall.position.y = PH; screenWall.castShadow = screenWall.receiveShadow = true; g.add(screenWall);
  // glowing trim along the top of the screen wall
  const swTrim = new THREE.Mesh(new THREE.TorusGeometry(SW.r + 0.17, 0.07, 6, 80, SW.span), M.emissive(0x8fdcff, 1.6, 0x123049));
  // torus arc lies in XY from angle 0..span; rotate into XZ so it runs sw0..sw1 (z = sin a)
  swTrim.rotation.set(Math.PI / 2, 0, sw0); swTrim.position.y = PH + SW.h + 0.1; g.add(swTrim);
  const screenGroups = [[], [], [], [], [], [], [], []];
  const bezel = [];
  const tiersY = [1.35, 2.55, 3.75];
  tiersY.forEach((y, t) => {
    const rr = SW.r - 0.06, count = [12, 11, 10][t];
    const span = SW.span - 8 * D;
    for (let i = 0; i < count; i++) {
      const a = -90 * D - span / 2 + (i + 0.5) * (span / count);
      const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      const yaw = Math.atan2(-x, -z);
      screenGroups[(i * 3 + t * 5) % 8].push(trs(x, PH + y, z, 0, yaw, 0, 1, 1, 1));
      bezel.push(place(new THREE.BoxGeometry(1.42, 1.0, 0.08), Math.cos(a) * (rr + 0.02), PH + y, Math.sin(a) * (rr + 0.02), 0, yaw, 0));
    }
  });
  const scrGeo = new THREE.PlaneGeometry(1.3, 0.86);
  scrGeo.translate(0, 0, 0.05);
  screenGroups.forEach((mats, k) => {
    const tex = T.screenTexture(k);
    const mat = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 2.6, roughness: 0.3 });
    g.add(instanced(scrGeo, mat, mats, { castShadow: false }));
  });
  const bezMesh = new THREE.Mesh(mergeGeometries(bezel), M.satin(0x1d2133, { rough: 0.4, metal: 0.3, key: 'bezel' }));
  bezMesh.castShadow = true; g.add(bezMesh);

  // Workstations: two arcs of bevelled consoles (dark body, pale top, glowing control deck) with chairs
  const deskGeo = [], deckGeo = [], chairGeo = [], monGeo = [];
  CONSOLE_ARCS.forEach(([rr, n], k) => {
    const span = 130 * D;
    for (let i = 0; i < n; i++) {
      const a = -90 * D - span / 2 + (i + 0.5) * (span / n);
      const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      const yaw = Math.atan2(x, z) + Math.PI; // console front faces the centre (operator sits inward)
      deskGeo.push(place(new RoundedBoxGeometry(0.95, 0.62, 0.58, 3, 0.08).toNonIndexed(), x, PH + 0.31, z, 0, yaw, 0));
      // sloped glowing control deck on top
      const deck = new RoundedBoxGeometry(0.86, 0.05, 0.42, 2, 0.02).toNonIndexed();
      deck.rotateX(-0.32); deckGeo.push(place(deck, x, PH + 0.66, z, 0, yaw, 0));
      // chair on the inward side
      const cx = x - Math.cos(a) * 0.62, cz = z - Math.sin(a) * 0.62;
      const seat = new THREE.CylinderGeometry(0.2, 0.2, 0.08, 14).toNonIndexed(); seat.translate(0, 0.42, 0);
      const back = new RoundedBoxGeometry(0.36, 0.34, 0.06, 2, 0.03).toNonIndexed(); back.translate(0, 0.66, -0.2);
      const stem = new THREE.CylinderGeometry(0.03, 0.03, 0.38, 6).toNonIndexed(); stem.translate(0, 0.2, 0);
      const ch = mergeGeometries([seat, back, stem]); ch.rotateY(yaw + Math.PI); ch.translate(cx, PH, cz);
      if (!isStaffed(k, i)) chairGeo.push(ch); // staffed stations: the operator stands there instead
      const mx = x + Math.cos(a) * 0.16, mz = z + Math.sin(a) * 0.16;
      monGeo.push(trs(mx, PH + 1.0, mz, 0.12, yaw, 0, 1, 1, 1));
    }
  });
  const desks = new THREE.Mesh(mergeGeometries(deskGeo), M.satin(0x2b3356, { rough: 0.3, clearcoat: 0.9, metal: 0.2, key: 'console' }));
  desks.castShadow = desks.receiveShadow = true; g.add(desks);
  const deckTex = consoleDeckTexture();
  g.add(new THREE.Mesh(mergeGeometries(deckGeo), new THREE.MeshStandardMaterial({ map: deckTex, emissiveMap: deckTex, emissive: 0xffffff, emissiveIntensity: 2.2, roughness: 0.25 })));
  const chairs = new THREE.Mesh(mergeGeometries(chairGeo), M.satin(0xf0eef6, { rough: 0.35, clearcoat: 0.6, key: 'chair' }));
  chairs.castShadow = true; g.add(chairs);
  const monTex = T.screenTexture(2);
  g.add(instanced(new THREE.PlaneGeometry(0.62, 0.38), new THREE.MeshStandardMaterial({ map: monTex, emissiveMap: monTex, emissive: 0xffffff, emissiveIntensity: 2.4 }), monGeo, { castShadow: false }));

  // Central holo-table with DNA helix hologram
  const table = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.4, 0.7, 48), M.satin(0x3b3552, { rough: 0.35, metal: 0.4, key: 'holoT' }));
  table.position.set(0, PH + 0.35, 1.2); table.castShadow = true; g.add(table);
  const tableGlow = new THREE.Mesh(new THREE.CircleGeometry(1.1, 48), M.emissive(0x58d6ff, 1.8, 0x0a3550));
  tableGlow.rotation.x = -Math.PI / 2; tableGlow.position.set(0, PH + 0.71, 1.2); g.add(tableGlow);
  const helix = buildHelix(2.4, 0.42);
  helix.position.set(0, PH + 0.85, 1.2); helix.name = 'holoHelix'; g.add(helix);

  // ---------- Nucleolus: luminous blue orb in the back of the nucleus ----------
  const nl = NUCLEUS.nucleolus;
  const nucleolus = buildNucleolus(nl.r);
  nucleolus.position.set(nl.x - NUCLEUS.x, nl.y, nl.z - NUCLEUS.z);
  g.add(nucleolus);

  // Interior lights
  const cool = new THREE.PointLight(0x7fc8ff, 16, 16, 1.6); cool.position.set(0, PH + 5, -3); g.add(cool);
  const warmPool = new THREE.PointLight(0xffc98a, 14, 10, 1.6); warmPool.position.set(0, PH + 4.2, 1.5); g.add(warmPool);


  const couriers = buildMRNACouriers(R, PH);
  g.add(couriers.object);

  g.userData.update = (t, dt) => {
    helix.rotation.y = t * 0.6;
    nucleolus.userData.update?.(t);
    couriers.update(t, dt || 0.016);
    beacon.material.emissiveIntensity = 2.8 + Math.sin(t * 2.4) * 0.8;
  };
  return g;
}

function buildHelix(h, r) {
  const grp = new THREE.Group();
  const n = 46;
  const mats = [M.emissive(0x7fe3ff, 2.4), M.emissive(0xff9ad5, 2.4)];
  for (let s = 0; s < 2; s++) {
    const pts = [];
    for (let i = 0; i <= n; i++) { const a = i * 0.36 + s * Math.PI; pts.push(new THREE.Vector3(Math.cos(a) * r, (i / n) * h, Math.sin(a) * r)); }
    grp.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 90, 0.045, 6), mats[s]));
  }
  const rung = [];
  for (let i = 1; i < n; i += 2) {
    const a = i * 0.36;
    const geo = new THREE.CylinderGeometry(0.022, 0.022, r * 2, 5);
    geo.rotateZ(Math.PI / 2); geo.rotateY(-a);
    geo.translate(0, (i / n) * h, 0);
    rung.push(geo);
  }
  grp.add(new THREE.Mesh(mergeGeometries(rung), M.emissive(0xffe27a, 2)));
  return grp;
}

function buildNucleolus(r) {
  const grp = new THREE.Group(); grp.name = 'nucleolus';
  // Standard material (custom ShaderMaterials upset the AO pass); animated by offsetting a swirl texture.
  const swirl = nucleolusTexture();
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0x2a6cff, roughness: 0.25, metalness: 0, emissive: 0xffffff, emissiveMap: swirl, emissiveIntensity: 2.2, map: swirl,
  });
  const core = new THREE.Mesh(new THREE.SphereGeometry(r, 48, 32), coreMat);
  grp.add(core);
  const shell = new THREE.Mesh(new THREE.SphereGeometry(r * 1.22, 48, 32), new THREE.MeshPhysicalMaterial({ color: 0x9fd4ff, transparent: true, opacity: 0.18, roughness: 0.05, clearcoat: 1, depthWrite: false }));
  grp.add(shell);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.radialTexture('rgba(110,190,255,0.85)', 'rgba(110,190,255,0)'), depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.setScalar(r * 5.2); grp.add(halo);
  // cradle ring + struts
  const cradle = new THREE.Mesh(new THREE.TorusGeometry(r * 1.35, 0.07, 8, 48), M.metal(0xd6dae2, 0.25));
  cradle.rotation.x = Math.PI / 2; grp.add(cradle);
  // pedestal: fluted column with a glowing collar, standing on the ops floor
  const colH = NUCLEUS.nucleolus.y - NUCLEUS.plinthH - r * 1.25;
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.55, colH, 24), M.satin(0xd9dbe6, { rough: 0.25, clearcoat: 1, key: 'pedestal' }));
  col.position.y = -r * 1.25 - colH / 2; col.castShadow = true; grp.add(col);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.05, 0.25, 32), M.satin(0x3b3552, { rough: 0.3, metal: 0.4, key: 'holoT' }));
  foot.position.y = -r * 1.25 - colH + 0.12; grp.add(foot);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.06, 8, 32), M.emissive(0x7fd2ff, 4));
  collar.rotation.x = Math.PI / 2; collar.position.y = -r * 1.25 + 0.05; grp.add(collar);
  const light = new THREE.PointLight(0x6cc0ff, 14, 9, 1.6); grp.add(light);
  grp.userData.update = (t) => {
    swirl.offset.set(t * 0.02, t * 0.013);
    const s = 1 + Math.sin(t * 1.7) * 0.025; core.scale.setScalar(s);
    light.intensity = 12 + Math.sin(t * 1.7) * 3;
    grp.position.y += Math.sin(t * 0.9) * 0.0015;
  };
  return grp;
}

/** Low-profile meridian and latitude ribs: the dome's architectural panelling. */
function buildRibs(R) {
  const geos = [];
  for (let k = 0; k < 24; k++) {
    const phi = (k / 24) * Math.PI * 2 + 0.07;
    const pts = [];
    for (let e = 0; e <= 40; e++) {
      const elev = (e / 40) * (Math.PI / 2 - 0.04);
      if (inOpening(phi, elev + 0.03)) { if (pts.length > 1) break; else { pts.length = 0; continue; } }
      pts.push(new THREE.Vector3(Math.cos(elev) * Math.cos(phi) * (R + 0.03), Math.sin(elev) * (R + 0.03), Math.cos(elev) * Math.sin(phi) * (R + 0.03)));
    }
    if (pts.length > 2) geos.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 2, 0.045, 5));
  }
  for (const elevDeg of [22, 44, 66]) {
    const elev = elevDeg * D; let pts = [];
    const flush = () => { if (pts.length > 2) geos.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 2, 0.05, 5)); pts = []; };
    for (let k = 0; k <= 200; k++) {
      const phi = NUCLEUS.cutCenter + NUCLEUS.cutWidth / 2 + (k / 200) * (Math.PI * 2);
      if (inOpening(phi, elev)) { flush(); continue; }
      const rr = Math.cos(elev) * (R + 0.03);
      pts.push(new THREE.Vector3(Math.cos(phi) * rr, Math.sin(elev) * (R + 0.03), Math.sin(phi) * rr));
    }
    flush();
  }
  const m = new THREE.Mesh(mergeGeometries(geos), M.satin(0x8a62cc, { rough: 0.3, clearcoat: 0.9, key: 'ribs' }));
  m.castShadow = false;
  return m;
}

/**
 * mRNA couriers: glowing magenta ribbons that leave through nuclear pores on the dome, arc over the ER
 * terraces and land on the ribosome-studded walls (gene expression made visible from the overview).
 * Each courier is a trail of instanced beads following a quadratic arc.
 */
function buildMRNACouriers(R, PH) {
  const N = 10, TRAIL = 22;
  const mat = new THREE.MeshStandardMaterial({ color: 0x3a0020, emissive: 0xff5fc8, emissiveIntensity: 4.2, roughness: 0.4 });
  const mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.26, 10, 8), mat, N * TRAIL);
  mesh.frustumCulled = false; mesh.castShadow = false;
  const flashMat = new THREE.SpriteMaterial({ map: T.radialTexture('rgba(255,140,220,1)', 'rgba(255,140,220,0)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const grp = new THREE.Group(); grp.add(mesh);
  const flashes = Array.from({ length: N }, () => { const f = new THREE.Sprite(flashMat.clone()); f.scale.setScalar(0); grp.add(f); return f; });
  const rnd = mulberry32(77);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3();
  const spawn = (c, t0) => {
    // start: a pore on the dome's side/back (outside the cut-away opening), end: an ER wall top
    let phi, elev;
    do { phi = rnd() * Math.PI * 2; elev = (6 + rnd() * 26) * D; } while (inOpening(phi, elev + 0.1));
    const sy = NUCLEUS.domeScaleY;
    c.a.set(Math.cos(elev) * Math.cos(phi) * (R + 0.1), PH + Math.sin(elev) * (R + 0.1) * sy, Math.cos(elev) * Math.sin(phi) * (R + 0.1));
    const ring = RER.rings.length - 1 - Math.floor(rnd() * 4);
    const ang = phi + (rnd() - 0.5) * 0.9, rr = RER.rings[ring];
    c.b.set(Math.cos(ang) * rr, RER.base[ring] + RER.heights[ring] + 0.15, Math.sin(ang) * rr);
    c.m.copy(c.a).lerp(c.b, 0.5); c.m.y = Math.max(c.a.y, c.b.y) + 0.9 + rnd() * 1.0;
    c.t0 = t0; c.dur = 3.6 + rnd() * 1.8;
  };
  const cs = Array.from({ length: N }, (_, i) => { const c = { a: new THREE.Vector3(), b: new THREE.Vector3(), m: new THREE.Vector3() }; spawn(c, -i * 0.7); return c; });
  const bez = (c, u, out) => out.set(
    (1 - u) * (1 - u) * c.a.x + 2 * (1 - u) * u * c.m.x + u * u * c.b.x,
    (1 - u) * (1 - u) * c.a.y + 2 * (1 - u) * u * c.m.y + u * u * c.b.y,
    (1 - u) * (1 - u) * c.a.z + 2 * (1 - u) * u * c.m.z + u * u * c.b.z);
  return {
    object: grp,
    update(t) {
      cs.forEach((c, i) => {
        let u = (t - c.t0) / c.dur;
        if (u > 1.25) { spawn(c, t); u = 0; }
        for (let k = 0; k < TRAIL; k++) {
          const uk = u - k * 0.009;
          const vis = uk >= 0 && uk <= 1 ? 1 : 0;
          bez(c, Math.min(1, Math.max(0, uk)), p);
          const s = vis * (1 - k / TRAIL) * (0.6 + 0.4 * Math.sin(t * 8 + k));
          m4.compose(p, q, sc.setScalar(Math.max(0.0001, s)));
          mesh.setMatrixAt(i * TRAIL + k, m4);
        }
        // landing flash on the ribosomes
        const f = flashes[i], land = u - 1;
        if (land > 0 && land < 0.25) { f.position.copy(c.b); f.scale.setScalar(1.8 * Math.sin(land / 0.25 * Math.PI)); f.material.opacity = 1; }
        else f.scale.setScalar(0);
      });
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}

function consoleDeckTexture() {
  const W = 256, H = 128; const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d'); const rnd = mulberry32(5);
  ctx.fillStyle = '#0c1630'; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 22; i++) {
    ctx.fillStyle = ['#59e0ff', '#ffd25e', '#ff7ab8', '#7dffb0'][Math.floor(rnd() * 4)];
    ctx.beginPath(); ctx.roundRect(12 + (i % 11) * 21, 18 + Math.floor(i / 11) * 26, 13, 9, 3); ctx.fill();
  }
  ctx.fillStyle = '#123a66'; ctx.fillRect(14, 74, 120, 40);
  ctx.strokeStyle = '#59e0ff'; ctx.lineWidth = 2; ctx.beginPath();
  for (let x = 16; x < 132; x += 3) ctx.lineTo(x, 94 + Math.sin(x * 0.2) * 10);
  ctx.stroke();
  ctx.fillStyle = '#2a7cff'; ctx.beginPath(); ctx.arc(196, 94, 20, 0, Math.PI * 2); ctx.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function nucleolusTexture() {
  const S = 256; const c = document.createElement('canvas'); c.width = c.height = S;
  const ctx = c.getContext('2d'); const img = ctx.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = x / S, v = y / S;
    const n = tileFbm(u, v, 4, 4, 17) * 0.7 + tileFbm(u, v, 9, 2, 3) * 0.3;
    const k = Math.min(1, Math.max(0, n * 1.6 + 0.5));
    const i = (y * S + x) * 4;
    img.data[i] = (0.08 + k * 0.5) * 255; img.data[i + 1] = (0.3 + k * 0.6) * 255; img.data[i + 2] = (0.85 + k * 0.15) * 255; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function buildFrontSteps(PH) {
  const grp = new THREE.Group();
  const a = NUCLEUS.cutCenter;
  const dirx = Math.cos(a), dirz = Math.sin(a);
  const rTop = NUCLEUS.plinthR - 0.3;
  const n = 6, w = 4.2, run = 0.62;
  const geo = [];
  for (let i = 0; i < n; i++) {
    const h = PH * (1 - i / n);
    const r = rTop + 0.3 + i * run + run / 2;
    const s = new THREE.BoxGeometry(w, h, run + 0.02);
    s.translate(0, h / 2, 0);
    s.rotateY(Math.atan2(dirx, dirz));
    s.translate(dirx * r, 0, dirz * r);
    geo.push(s);
  }
  const steps = new THREE.Mesh(mergeGeometries(geo), M.satin(0xb7a6d6, { rough: 0.55, key: 'steps' }));
  steps.castShadow = steps.receiveShadow = true;
  grp.add(steps);
  // handrails
  for (const side of [-1, 1]) {
    const px = -dirz * side * (w / 2 - 0.1), pz = dirx * side * (w / 2 - 0.1);
    const p0 = new THREE.Vector3(dirx * (rTop + 0.3) + px, PH + 0.75, dirz * (rTop + 0.3) + pz);
    const p1 = new THREE.Vector3(dirx * (rTop + 0.3 + n * run) + px, 0.75, dirz * (rTop + 0.3 + n * run) + pz);
    const rail = new THREE.Mesh(new THREE.TubeGeometry(new THREE.LineCurve3(p0, p1), 4, 0.045, 6), M.metal(0xd0d4dc, 0.3));
    grp.add(rail);
    for (let k = 0; k <= 3; k++) {
      const p = p0.clone().lerp(p1, k / 3);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.75, 6), M.metal(0xd0d4dc, 0.3));
      post.position.set(p.x, p.y - 0.375, p.z); grp.add(post);
    }
  }
  return grp;
}

function opsFloorTexture() {
  const S = 1024; const c = document.createElement('canvas'); c.width = c.height = S;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, '#3a3560'); g.addColorStop(1, '#221d3a');
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  ctx.strokeStyle = 'rgba(120,210,255,0.55)'; ctx.lineWidth = 3;
  for (const r of [0.14, 0.3, 0.46]) { ctx.beginPath(); ctx.arc(S / 2, S / 2, r * S, 0, Math.PI * 2); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(200,160,255,0.35)'; ctx.lineWidth = 2;
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(S / 2 + Math.cos(a) * S * 0.16, S / 2 + Math.sin(a) * S * 0.16);
    ctx.lineTo(S / 2 + Math.cos(a) * S * 0.44, S / 2 + Math.sin(a) * S * 0.44); ctx.stroke();
  }
  // floor panels
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 2;
  for (let x = 0; x < S; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, S); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, x); ctx.lineTo(S, x); ctx.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
