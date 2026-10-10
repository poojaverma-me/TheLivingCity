// Assembles the whole city. Each builder returns an Object3D; userData.update(t, dt) animates it.
import * as THREE from 'three';
import { buildMembrane } from './membrane.js';
import { buildNucleus } from './organelles/nucleus.js';
import { buildRER } from './organelles/rer.js';
import { buildMitochondria } from './organelles/mitochondria.js';
import { buildGolgi } from './organelles/golgi.js';
import { buildVesicles } from './organelles/vesicles.js';
import { buildSER } from './organelles/ser.js';
import { buildLysosomes } from './organelles/lysosomes.js';
import { buildVacuoles } from './organelles/vacuoles.js';
import { buildCity } from './city/city.js';
import { NETWORK, nearestNode, pathBetween, pathPoints, lanePoints, roadDist } from './city/network.js';
import { buildCuriosities } from './curiosities.js';
import { createCrowd } from '../life/crowd.js';
import { createTraffic } from '../life/vehicles.js';
import { createStaff } from '../life/staff.js';
import { createMotes } from '../core/lookdev.js';
import { insideCell, NUCLEUS } from './layout.js';

export function buildWorld(scene, { quality = {} } = {}) {
  const root = new THREE.Group(); root.name = 'world';
  const parts = [
    buildMembrane(),
    buildNucleus(),
    buildRER(),
    buildMitochondria(),
    buildGolgi(),
    buildVesicles(),
    buildSER(),
    buildLysosomes(),
    buildVacuoles(),
    buildCity(),
    createMotes(quality.motes ?? 450, { x: 29, z: 47, y: [0.4, 3.6] }, (x, z) => insideCell(x, z, 3) && Math.hypot(x - NUCLEUS.x, z - NUCLEUS.z) > 13),
  ];
  parts.forEach((p) => root.add(p));
  // curiosity exhibits are placed after everything else so they can find free ground
  const curiosities = buildCuriosities(root, { roadDist });
  root.add(curiosities); parts.push(curiosities);
  // living city: workers + delivery traffic (driven by the road NETWORK)
  const params = new URLSearchParams(location.search);
  const crowd = params.get('crowd') === '0' ? null : createCrowd({ count: quality.crowd ?? 140 });
  const traffic = params.get('traffic') === '0' ? null : createTraffic({ mix: ['box', 'flatbed', 'forklift', 'box', 'box', 'forklift', 'flatbed', 'box', 'forklift'].slice(0, quality.traffic ?? 9) });
  if (crowd) root.add(crowd.object);
  if (traffic) root.add(traffic.object);
  const anchors = {}; root.traverse((o) => { if (o.userData?.anchors) Object.assign(anchors, o.userData.anchors); });
  if (params.get('crowd') !== '0') root.add(createStaff(anchors));
  // Hide districts via ?only=nucleus,golgi (QA isolation)
  const only = new URLSearchParams(location.search).get('only');
  if (only) { const keep = only.split(','); parts.forEach((p) => { if (p.name && !keep.includes(p.name) && !['membrane', 'motes'].includes(p.name)) p.visible = false; }); }
  scene.add(root);
  const updaters = [];
  root.traverse((o) => { if (o.userData.update) updaters.push(o.userData.update); });
  return {
    root, parts,
    network: { NETWORK, nearestNode, pathBetween, pathPoints, lanePoints, roadDist },
    crowd, traffic,
    curiosityAnchors: curiosities.userData.curiosityAnchors,
    curiosityRadii: curiosities.userData.curiosityRadii,
    update(t, dt) {
      for (const u of updaters) u(t, dt);
      crowd?.update(t, dt, arguments[2]); traffic?.update(t, dt, arguments[2]);
    },
  };
}
