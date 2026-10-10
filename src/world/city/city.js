// City fabric: roads, buildings, trees, lamps, railings, pipes, props.
// Road graph for traffic / workers lives in ./network.js (re-exported here).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from '../../core/geom.js';
import { trs } from '../../core/geom.js';
import { buildRoads } from './roads.js';
import { buildBuildings, signEntries } from './buildings.js';
import { buildProps } from './props.js';
import { Bucket, UVBucket, Glow, Parts, colored, cityMaterials } from './kit.js';
import { facadeAtlas, signAtlas } from './citytex.js';
import { NETWORK } from './network.js';

export { NETWORK, ROADS, nearestNode, pathBetween, pathPoints, lanePoints, edgeBetween, roadDist } from './network.js';

const rbox = (w, h, d, r = 0.05) => new RoundedBoxGeometry(w, h, d, 2, r);
const mv = (g, x, y, z, rx = 0, ry = 0, rz = 0) => g.applyMatrix4(trs(x, y, z, rx, ry, rz));

function acGeo() {
  return mergeGeometries([
    colored(mv(new RoundedBoxGeometry(0.62, 0.34, 0.46, 1, 0.05), 0, 0.17, 0), 0xdfe3e8),
    colored(mv(new THREE.CylinderGeometry(0.15, 0.15, 0.03, 16), 0.12, 0.35, 0), 0x3a3f47),
    colored(mv(new THREE.TorusGeometry(0.15, 0.018, 4, 16), 0.12, 0.36, 0, Math.PI / 2), 0xb9c0c8),
    colored(mv(new THREE.BoxGeometry(0.2, 0.22, 0.02), -0.17, 0.17, 0.235), 0x8d96a1),
    colored(mv(new THREE.BoxGeometry(0.66, 0.04, 0.5), 0, 0.02, 0), 0x7d8692),
  ]);
}
function ventGeo() {
  return mergeGeometries([
    colored(mv(new THREE.CylinderGeometry(0.07, 0.07, 0.42, 10), 0, 0.21, 0), 0xc4cbd3),
    colored(mv(new THREE.CylinderGeometry(0.15, 0.09, 0.1, 12), 0, 0.46, 0), 0x9aa3ad),
    colored(mv(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 10), 0, 0.03, 0), 0x7d8692),
  ]);
}

export function buildCity() {
  const g = new THREE.Group(); g.name = 'city';
  const mats = cityMaterials();
  const signs = signAtlas(signEntries());
  const kit = {
    paint: new Bucket(), walls: new Bucket(), metal: new Bucket(), contacts: [], windows: new UVBucket(), signs: new UVBucket(), glow: new Glow(),
    parts: { ac: new Parts(acGeo(), mats.paint, { cast: true, name: 'roofAC' }), vent: new Parts(ventGeo(), mats.metal, { name: 'roofVents' }) },
    footprints: [], anchors: {},
    sign(text, B, x, y, z, w, h, ry = 0) { const M = B.clone().multiply(trs(x, y, z, 0, ry, 0)); this.signM(text, M, 0, 0, 0, w, h); },
    signM(text, M, x, y, z, w, h) {
      const r = signs.uv(text); if (!r) return;
      const q = new THREE.PlaneGeometry(w, h); const uv = q.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, r[0] + (r[2] - r[0]) * uv.getX(i), r[1] + (r[3] - r[1]) * uv.getY(i));
      q.translate(x, y, z); this.signs.add(q, M);
    },
  };

  const roads = buildRoads();
  g.add(roads);
  buildBuildings(kit);
  g.add(buildProps(kit, roads.userData.info));

  // ---- finalize merged / instanced meshes ----
  const fac = facadeAtlas();
  const winMat = new THREE.MeshStandardMaterial({ map: fac.map, emissiveMap: fac.emissive, emissive: 0xffffff, emissiveIntensity: 1.0, roughness: 0.08, metalness: 0.15, envMapIntensity: 1.1 });
  const signMat = new THREE.MeshStandardMaterial({ map: signs.texture, emissiveMap: signs.texture, emissive: 0xffffff, emissiveIntensity: 0.55, roughness: 0.3 });
  const parts = [
    kit.paint.mesh(mats.paint, { name: 'cityPaint' }),
    kit.walls.mesh(mats.walls, { name: 'cityWalls' }),
    contactMesh(kit.contacts),
    kit.metal.mesh(mats.metal, { name: 'cityMetal' }),
    kit.windows.mesh(winMat, { name: 'cityWindows' }),
    kit.signs.mesh(signMat, { name: 'citySigns' }),
    kit.parts.ac.mesh(), kit.parts.vent.mesh(),
    kit.glow.mesh(),
  ].filter(Boolean);
  parts.forEach((m) => g.add(m));
  const glow = parts.find((m) => m.name === 'cityGlow');

  // warm local light pools (few, no shadows)
  for (const [x, z] of [[-1.5, 40.5], [7.5, 2.5]]) {
    const L = new THREE.PointLight(0xffc98a, 7, 11, 2); L.position.set(x, 2.6, z); g.add(L);
  }

  // ---- gameplay data ----
  const node = (id) => { const n = NETWORK.node(id); return [n.x, 0, n.z]; };
  Object.assign(kit.anchors, {
    frontGate: node('gateF'), leftGate: node('gateL'), portR: node('portR'), portFR: node('portFR'),
    plazaCentre: [-1.0, 0, 39.6], nucleusAvenue: node('avenue'), storageYard: node('westYard'), centralQuarter: [7.6, 0, 3.0],
    frontRightBlock: [8.2, 0, 34.2], golgiShipping: node('golgiF'), golgiReceiving: node('golgiB'), serEntrance: node('ser'),
    mitoAEntrance: node('mito1'), mitoBEntrance: node('mito2'), backYard: node('backYard'),
  });
  g.userData.footprints = kit.footprints;
  g.userData.anchors = kit.anchors;
  g.userData.network = NETWORK;
  g.userData.update = (t, dt) => { glow?.userData.update?.(t, dt); };
  return g;
}

/** Soft dark contact pads under buildings (one merged, transparent decal mesh). */
function contactMesh(list) {
  if (!list.length) return null;
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  const img = x.createImageData(128, 128);
  for (let j = 0; j < 128; j++) for (let i = 0; i < 128; i++) {
    const u = Math.abs(i / 63.5 - 1), v = Math.abs(j / 63.5 - 1);
    const e = Math.max(u, v); const a = e < 0.55 ? 1 : Math.max(0, 1 - (e - 0.55) / 0.45);
    const k = (j * 128 + i) * 4; img.data[k] = 20; img.data[k + 1] = 22; img.data[k + 2] = 34; img.data[k + 3] = a * a * 255;
  }
  x.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const geos = list.map((q) => { const g = new THREE.PlaneGeometry(q.w + 1.1, q.d + 1.1); g.rotateX(-Math.PI / 2); g.rotateY(q.rot); g.translate(q.x, 0.012, q.z); return g; });
  const m = new THREE.Mesh(mergeGeometries(geos), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.42, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
  m.renderOrder = 1; m.name = 'cityContact';
  return m;
}
