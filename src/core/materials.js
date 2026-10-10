// Shared material library. Palette sampled from the reference illustration (see docs/GDD.md §6).
import * as THREE from 'three';
import * as T from './textures.js';

export const PALETTE = {
  membrane: 0xc3d0dc, membraneTint: 0x9fb4c6,
  floor: 0x9aa5b1, asphalt: 0x5e6670, marking: 0xe8e3d6, curb: 0xc9cdd2,
  nucleus: 0x8a5cc8, nucleusDeep: 0x5d3a96, nucleusPlinth: 0x6f55a0, screen: 0x6fd3ff, nucleolus: 0x5bb6ff,
  rer: 0x5f7fb8, rerDeep: 0x4a659b, ribosome: 0xd2452f, trim: 0xdfe6ee,
  ser: 0x8f9a4c, serDeep: 0x6c7b38, serLight: 0xb9c27a,
  golgi: 0xd77fa6, golgiDeep: 0xb85a88, window: 0xffe6b0,
  mito: 0xe07a2e, mitoWall: 0xc75a1d, cristae: 0xf3d9b8, amber: 0xffb54a,
  lyso: 0x6fae3e, lysoDeep: 0x4e8a2e,
  tank: 0xa4adb6, water: 0x3fc0d4,
  vesicle: 0x8e4fd0, vesicleGlow: 0xc08bff,
  truck: 0xe8b62a, coat: 0xf2f2ee, metal: 0xb8bec6, darkMetal: 0x4a4f58,
  leaf: 0x5f9a3c, leafDark: 0x3e7a2a, trunk: 0x6b4a32,
};

const lib = new Map();
function memo(key, make) { if (!lib.has(key)) lib.set(key, make()); return lib.get(key); }

/** Satin painted miniature surface (organelle shells, buildings). */
export function satin(color, { rough = 0.5, clearcoat = 0.25, metal = 0, normalScale = 0.35, repeat = 1, key = '' } = {}) {
  return memo(`satin:${color}:${rough}:${clearcoat}:${metal}:${normalScale}:${repeat}:${key}`, () => {
    const n = T.paintNormal().clone(); n.repeat.set(repeat, repeat); n.needsUpdate = true;
    // Clearcoat is the expensive part of MeshPhysical: only pay for it when it actually shows.
    const params = { color, roughness: rough, metalness: metal, normalMap: n, normalScale: new THREE.Vector2(normalScale, normalScale), roughnessMap: T.paintRoughness() };
    const m = clearcoat >= 0.35
      ? new THREE.MeshPhysicalMaterial({ ...params, clearcoat, clearcoatRoughness: 0.35 })
      : new THREE.MeshStandardMaterial(params);
    return m;
  });
}

/**
 * Biological "glass": glossy, sheened, clearcoated membrane. No real transmission (a transmissive
 * material forces three.js to re-render the whole scene every frame); the translucent read comes from
 * the organic() rim/subsurface patch + sheen + clearcoat.
 */
export function bioGlass(color, { rough = 0.32, normalScale = 0.6, repeat = 3, key = '' } = {}) {
  return memo(`bioGlass:${color}:${rough}:${normalScale}:${repeat}:${key}`, () => {
    const n = T.membraneNormal().clone(); n.repeat.set(repeat, repeat); n.needsUpdate = true;
    return new THREE.MeshPhysicalMaterial({
      color, roughness: rough, metalness: 0,
      clearcoat: 1, clearcoatRoughness: 0.18,
      sheen: 0.6, sheenColor: new THREE.Color(0xeaf2ff), sheenRoughness: 0.5,
      normalMap: n, normalScale: new THREE.Vector2(normalScale, normalScale),
      specularIntensity: 0.9,
    });
  });
}

export function metal(color = PALETTE.metal, rough = 0.38) {
  return memo(`metal:${color}:${rough}`, () => new THREE.MeshStandardMaterial({
    color, metalness: 0.85, roughness: rough, roughnessMap: T.brushedRoughness(),
  }));
}

export function emissive(color, intensity = 2, base = 0x000000) {
  return memo(`emi:${color}:${intensity}:${base}`, () => new THREE.MeshStandardMaterial({
    color: base, emissive: color, emissiveIntensity: intensity, roughness: 0.4,
  }));
}

export function matte(color, rough = 0.85) {
  return memo(`matte:${color}:${rough}`, () => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0 }));
}

export function asphalt(repeat = 0.08) {
  return memo(`asphalt:${repeat}`, () => {
    const c = T.asphaltColor().clone(); c.repeat.set(1, 1); c.needsUpdate = true;
    const n = T.asphaltNormal().clone(); n.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ map: c, normalMap: n, normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.88, color: 0xffffff });
  });
}

export function plaza() {
  return memo('plaza', () => {
    const c = T.plazaColor(); const n = T.plazaNormal(); const r = T.plazaRough();
    return new THREE.MeshStandardMaterial({ map: c, normalMap: n, normalScale: new THREE.Vector2(0.9, 0.9), roughnessMap: r, roughness: 1.0, color: 0xd6dbe3, envMapIntensity: 1.2 });
  });
}

export function glass(color = 0xdfeefa, opacity = 0.28) {
  return memo(`glass:${color}:${opacity}`, () => new THREE.MeshPhysicalMaterial({
    color, roughness: 0.05, metalness: 0, transparent: true, opacity, clearcoat: 1, depthWrite: false,
  }));
}

export function water() {
  return memo('water', () => new THREE.MeshPhysicalMaterial({
    color: PALETTE.water, roughness: 0.06, metalness: 0,
    attenuationColor: new THREE.Color(0x1e8fb0), attenuationDistance: 2, clearcoat: 1, clearcoatRoughness: 0.05,
    emissive: 0x0f6f88, emissiveIntensity: 0.25,
  }));
}
