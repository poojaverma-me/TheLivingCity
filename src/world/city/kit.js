// Shared construction kit for the city fabric: vertex-coloured merge buckets, instanced part lists,
// HDR glow points, and the city material set. Builders push into a Kit; kit.finish() emits few meshes.
import * as THREE from 'three';
import { mergeGeometries } from '../../core/geom.js';
import * as T from '../../core/textures.js';

const _c = new THREE.Color();

/** Merge bucket: geometries baked with a per-part vertex colour. */
export class Bucket {
  constructor() { this.geos = []; }
  add(geo, color, matrix = null, { grime = false } = {}) {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (matrix) g.applyMatrix4(matrix);
    const n = g.attributes.position.count; const col = new Float32Array(n * 3);
    _c.set(color); _c.convertSRGBToLinear?.();
    const c = new THREE.Color(color);
    const py = g.attributes.position;
    for (let i = 0; i < n; i++) {
      // grime: base of walls a little darker/warmer (rain splash), fading up over ~0.9u
      const t = Math.min(1, Math.max(0, (py.getY(i) - 0.12) / 1.1));
      const k = grime ? 0.7 + 0.3 * t * t * (3 - 2 * t) : 1;
      col[i * 3] = c.r * (grime ? k * 1.0 : 1); col[i * 3 + 1] = c.g * k; col[i * 3 + 2] = c.b * (grime ? k * 0.97 : 1);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.geos.push(g);
    return g;
  }
  /** Add a geometry that already has a colour attribute. */
  addColored(geo, matrix = null) {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (matrix) g.applyMatrix4(matrix);
    this.geos.push(g); return g;
  }
  mesh(mat, { cast = true, receive = true, name = '' } = {}) {
    if (!this.geos.length) return null;
    const m = new THREE.Mesh(mergeGeometries(this.geos), mat);
    m.castShadow = cast; m.receiveShadow = receive; m.name = name;
    return m;
  }
}

/** Plain (uv-mapped) bucket without colours. */
export class UVBucket {
  constructor() { this.geos = []; }
  add(geo, matrix = null) {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (matrix) g.applyMatrix4(matrix);
    this.geos.push(g); return g;
  }
  mesh(mat, opts = {}) {
    if (!this.geos.length) return null;
    const m = new THREE.Mesh(mergeGeometries(this.geos), mat);
    m.castShadow = !!opts.cast; m.receiveShadow = opts.receive ?? true; m.name = opts.name || '';
    return m;
  }
}

/** Bake a vertex colour into a geometry (for multi-colour instanced prop geometry). */
export function colored(geo, color) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  const c = new THREE.Color(color); const n = g.attributes.position.count; const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
export function mergeColored(parts) { return mergeGeometries(parts); }

/** City materials (created once). */
let MATS = null;
export function cityMaterials() {
  if (MATS) return MATS;
  const pn = T.paintNormal().clone(); pn.repeat.set(6, 6); pn.needsUpdate = true;
  MATS = {
    paint: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.45, metalness: 0, clearcoat: 0.3, clearcoatRoughness: 0.4, normalMap: pn, normalScale: new THREE.Vector2(0.07, 0.07), roughnessMap: T.paintRoughness(), envMapIntensity: 0.75 }),
    // matte plaster walls (rough, no clearcoat) vs satin trims (paint) vs glossy glass (windows)
    walls: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0, normalMap: pn, normalScale: new THREE.Vector2(0.05, 0.05), envMapIntensity: 0.55 }),
    metal: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.6, roughnessMap: T.brushedRoughness(), envMapIntensity: 0.7 }),
    foliage: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.62, clearcoat: 0.25, clearcoatRoughness: 0.5, sheen: 0.6, sheenColor: new THREE.Color(0xc8ff9a), sheenRoughness: 0.6 }),
    glow: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xcfe8f6, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.32, clearcoat: 1, depthWrite: false }),
  };
  return MATS;
}

/** Instanced HDR glow points (lamp heads, beacons, indicator LEDs). */
export class Glow {
  constructor() { this.items = []; }
  add(x, y, z, s, color, k = 4, blink = 0) { this.items.push({ x, y, z, s, color: new THREE.Color(color).multiplyScalar(k), blink }); }
  mesh() {
    const geo = new THREE.SphereGeometry(1, 12, 8);
    const im = new THREE.InstancedMesh(geo, cityMaterials().glow, this.items.length);
    const m = new THREE.Matrix4();
    this.items.forEach((g, i) => { m.makeScale(g.s, g.s, g.s).setPosition(g.x, g.y, g.z); im.setMatrixAt(i, m); im.setColorAt(i, g.color); });
    im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; im.computeBoundingSphere();
    im.castShadow = false; im.receiveShadow = false; im.name = 'cityGlow';
    const blinkers = this.items.map((g, i) => [i, g]).filter(([, g]) => g.blink);
    const off = new THREE.Color(0.62, 0.16, 0.13); // unlit lens (dull red), not black
    im.userData.update = (t) => {
      if (!blinkers.length) return;
      for (const [i, g] of blinkers) { const on = Math.sin(t * g.blink * 2 + i * 1.7) > 0.2; im.setColorAt(i, on ? g.color : off); }
      im.instanceColor.needsUpdate = true;
    };
    return im;
  }
}

/** Instanced part list: geometry + material + transforms (+ optional per-instance colour). */
export class Parts {
  constructor(geo, mat, { cast = false, receive = true, name = '' } = {}) { this.geo = geo; this.mat = mat; this.ms = []; this.cs = []; this.cast = cast; this.receive = receive; this.name = name; }
  add(matrix, color = null) { this.ms.push(matrix); this.cs.push(color); }
  mesh() {
    if (!this.ms.length) return null;
    const im = new THREE.InstancedMesh(this.geo, this.mat, this.ms.length);
    this.ms.forEach((m, i) => im.setMatrixAt(i, m));
    if (this.cs.some((c) => c)) this.cs.forEach((c, i) => im.setColorAt(i, new THREE.Color(c ?? 0xffffff)));
    im.instanceMatrix.needsUpdate = true; im.castShadow = this.cast; im.receiveShadow = this.receive; im.name = this.name;
    im.computeBoundingSphere();
    return im;
  }
}
