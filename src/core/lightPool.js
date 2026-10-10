// Point-light pool: forward rendering evaluates every light for every lit pixel, so 20 district lights
// were the single biggest GPU cost. District lights become "sources" (detached, still animated by their
// district code); a fixed set of real lights follows the sources nearest the camera's focus. The light
// count never changes, so no shader recompiles.
import * as THREE from 'three';

export class LightPool {
  constructor(scene, worldRoot, slots = 6) {
    this.sources = [];
    const found = [];
    worldRoot.traverse((o) => { if (o.isPointLight) found.push(o); });
    worldRoot.updateMatrixWorld(true);
    for (const l of found) {
      // keep the object in the graph (district update code moves/pulses it) but stop it rendering
      const src = { light: l, pos: new THREE.Vector3() };
      l.getWorldPosition(src.pos);
      l.visible = false;
      this.sources.push(src);
    }
    this.slots = [];
    for (let i = 0; i < Math.min(slots, this.sources.length); i++) {
      const p = new THREE.PointLight(0xffffff, 0, 10, 1.6);
      p.castShadow = false;
      scene.add(p); this.slots.push(p);
    }
    this._t = 0; this._order = [];
  }
  /** Use only the first n slots (fewer per-pixel lights on weak GPUs). Changing it recompiles shaders once. */
  setActive(n) {
    this.active = Math.max(0, Math.min(this.slots.length, n));
    this.slots.forEach((p, i) => { p.visible = i < this.active; });
  }
  update(dt, focus) {
    if (!this.slots.length) return;
    this._t -= dt;
    if (this._t <= 0) {
      this._t = 0.25;
      for (const s of this.sources) { s.light.updateWorldMatrix(true, false); s.light.getWorldPosition(s.pos); s.d = s.pos.distanceToSquared(focus) / Math.max(1, s.light.distance || 10); }
      this._order = [...this.sources].sort((a, b) => a.d - b.d).slice(0, this.active ?? this.slots.length);
    }
    this._order.forEach((s, i) => {
      const p = this.slots[i], l = s.light;
      p.position.copy(s.pos); p.color.copy(l.color);
      // fade in by rank so a newly-chosen light never pops
      p.intensity += (l.intensity - p.intensity) * Math.min(1, dt * 6);
      p.distance = l.distance; p.decay = l.decay;
    });
  }
}
