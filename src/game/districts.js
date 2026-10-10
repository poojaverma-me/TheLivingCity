// District definitions: where each poster item lives, its label pin, entry radius and examine camera.
import * as THREE from 'three';
import { NUCLEUS, RER, SER, GOLGI, MITO, LYSO, VACUOLES, VESICLES, GATES } from '../world/layout.js';
import { membranePoint } from '../world/membrane.js';

const v = (x, y, z) => new THREE.Vector3(x, y, z);
const front = membranePoint(GATES.find((g) => g.id === 'portFR').angle, 0);
const leftWall = membranePoint(200 * Math.PI / 180, 0);

/**
 * id → { center (walk-in point), radius (entered when within), pin (label anchor),
 *        examine: { target, yaw (deg, 0 = from +Z), pitch (deg), dist }, mood (music), group (world part name) }
 */
export const DISTRICTS = {
  nucleus: {
    center: v(NUCLEUS.x, NUCLEUS.plinthH, NUCLEUS.z + 4), radius: 11.5, pin: v(NUCLEUS.x, NUCLEUS.plinthH + NUCLEUS.r * 1.2 + 1.5, NUCLEUS.z),
    examine: { target: v(NUCLEUS.x - 0.5, NUCLEUS.plinthH + 2.6, NUCLEUS.z - 2), yaw: 8, pitch: 30, dist: 17 }, mood: 'nucleus', group: 'nucleus',
  },
  nucleolus: {
    center: v(NUCLEUS.nucleolus.x + 1.5, NUCLEUS.plinthH, NUCLEUS.nucleolus.z + 4), radius: 4.5, pin: v(NUCLEUS.nucleolus.x, NUCLEUS.nucleolus.y + 2.2, NUCLEUS.nucleolus.z),
    examine: { target: v(NUCLEUS.nucleolus.x, NUCLEUS.nucleolus.y - 0.5, NUCLEUS.nucleolus.z), yaw: 18, pitch: 18, dist: 7.5 }, mood: 'nucleus', group: 'nucleus',
  },
  ribosomes: {
    center: v(NUCLEUS.x - 2.4, 1.5, NUCLEUS.z + RER.rings[7] + 1.0), radius: 5, pin: v(NUCLEUS.x - 11, 4.6, NUCLEUS.z + 15),
    examine: { target: v(NUCLEUS.x - 9, 1.8, NUCLEUS.z + 20.5), yaw: -10, pitch: 18, dist: 6.5 }, mood: 'explore', group: 'rer',
    callout: v(NUCLEUS.x + 9, 4.2, NUCLEUS.z + 15),
  },
  rer: {
    center: v(NUCLEUS.x - 2.5, 0.8, NUCLEUS.z + RER.rings[7] + 1.4), radius: 7, pin: v(NUCLEUS.x + 16, 5.2, NUCLEUS.z + 12),
    examine: { target: v(NUCLEUS.x + 9, 2.4, NUCLEUS.z + 15), yaw: 20, pitch: 34, dist: 15 }, mood: 'explore', group: 'rer',
  },
  ser: {
    center: v(SER.x - 7, 0, SER.z + 2), radius: 9, pin: v(SER.x, 5, SER.z),
    examine: { target: v(SER.x, 1.6, SER.z), yaw: -35, pitch: 36, dist: 17 }, mood: 'explore', group: 'ser',
  },
  vesicles: {
    center: v(VESICLES[0].x - 2.5, 0, VESICLES[0].z + 1.5), radius: 6, pin: v(VESICLES[0].x, 3.6, VESICLES[0].z),
    examine: { target: v(VESICLES[0].x, 1.2, VESICLES[0].z), yaw: -20, pitch: 26, dist: 8 }, mood: 'golgi', group: 'vesicles',
  },
  golgi: {
    center: v(GOLGI.x - 4, 0, GOLGI.z + 6.5), radius: 10, pin: v(GOLGI.x, 7.5, GOLGI.z),
    examine: { target: v(GOLGI.x - 2.5, 3.2, GOLGI.z + 1), yaw: -14, pitch: 32, dist: 27 }, mood: 'golgi', group: 'golgi',
  },
  mitochondria: {
    center: v(MITO[0].x + 3, 0, MITO[0].z + 6), radius: 11, pin: v(MITO[0].x, 5, MITO[0].z),
    examine: { target: v(MITO[0].x, 1.2, MITO[0].z), yaw: 15, pitch: 42, dist: 18 }, mood: 'mito', group: 'mitochondria',
  },
  lysosomes: {
    center: v(LYSO[1].x + 2.5, 0, LYSO[1].z + 2.5), radius: 5.5, pin: v(LYSO[1].x, 4.5, LYSO[1].z),
    examine: { target: v(LYSO[1].x, 1.6, LYSO[1].z), yaw: 10, pitch: 30, dist: 9 }, mood: 'calm', group: 'lysosomes',
  },
  vacuoles: {
    center: v(VACUOLES[2].x + 3, 0, VACUOLES[2].z + 3), radius: 7, pin: v(VACUOLES[0].x, 4.5, VACUOLES[0].z),
    examine: { target: v(VACUOLES[1].x + 2, 1.4, VACUOLES[1].z - 3), yaw: 30, pitch: 38, dist: 13 }, mood: 'calm', group: 'vacuoles',
  },
  membrane: {
    center: v(front.x - front.nx * 6, 0, front.z - front.nz * 6), radius: 6.5, pin: v(front.x, 6.5, front.z),
    examine: { target: v(front.x - front.nx * 1, 2, front.z - front.nz * 1), yaw: -25, pitch: 22, dist: 11 }, mood: 'wonder', group: 'membrane',
    callout: v(leftWall.x, 5.5, leftWall.z),
  },
};

export const DISTRICT_ORDER = ['nucleus', 'nucleolus', 'ribosomes', 'rer', 'ser', 'vesicles', 'golgi', 'mitochondria', 'lysosomes', 'vacuoles', 'membrane'];

/** Prefer anchors published by the district builders (userData.anchors) when available. */
export function applyAnchors(worldRoot) {
  worldRoot.traverse((o) => {
    const a = o.userData && o.userData.anchors;
    if (!a) return;
    for (const [id, d] of Object.entries(DISTRICTS)) {
      if (d.group !== o.name) continue;
      const ex = a.examineTarget || a[`${id}ExamineTarget`];
      if (ex && Array.isArray(ex)) d.examine.target.set(...ex);
    }
  });
}

/** Examine pose → CameraRig pose. */
export function examinePose(id) {
  const e = DISTRICTS[id].examine; const D = Math.PI / 180;
  return { target: e.target.clone(), yaw: e.yaw * D, pitch: e.pitch * D, dist: e.dist, fov: 40 };
}
