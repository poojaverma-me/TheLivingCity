// Camera rig: spherical (target, yaw, pitch, distance) with damped follow, eased flights,
// Q/E yaw steps, wheel zoom continuum from visitor level to the poster overview.
import * as THREE from 'three';
import gsap from 'gsap';
import { SHOTS } from '../world/layout.js';

const D = Math.PI / 180;

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.target = new THREE.Vector3();
    this.yaw = 0; this.pitch = 50 * D; this.dist = 30; this.fov = 38;
    this.goal = { target: new THREE.Vector3(), yaw: 0, pitch: 50 * D, dist: 30, fov: 38 };
    this.mode = 'free'; // 'free' | 'follow' | 'flight' | 'locked'
    this.follow = null;  // Object3D or Vector3 provider
    this.zoom = 0.35;    // 0 = visitor, 1 = overview
    this.minDist = 9; this.maxDist = 150;
    this.shake = 0;
    this._flight = null;
  }

  /** Convert a pos/target preset into spherical parameters. */
  static fromPose(pos, target) {
    const p = new THREE.Vector3(...pos), t = new THREE.Vector3(...target);
    const d = p.clone().sub(t);
    const dist = d.length();
    return { target: t, yaw: Math.atan2(d.x, d.z), pitch: Math.asin(d.y / dist), dist };
  }

  setPose({ target, yaw, pitch, dist, fov }) {
    this.target.copy(target); this.yaw = yaw; this.pitch = pitch; this.dist = dist; if (fov) this.fov = fov;
    this.goal.target.copy(target); this.goal.yaw = yaw; this.goal.pitch = pitch; this.goal.dist = dist; if (fov) this.goal.fov = fov;
    this.apply();
  }

  shot(name) {
    const s = SHOTS[name]; if (!s) return;
    this.setPose({ ...CameraRig.fromPose(s.pos, s.target), fov: s.fov });
  }

  /** Eased camera flight to a pose; returns a promise. */
  flyTo({ target, yaw, pitch, dist, fov }, duration = 2.2, ease = 'power2.inOut') {
    if (this._flight) this._flight.kill();
    const from = { tx: this.target.x, ty: this.target.y, tz: this.target.z, yaw: this.yaw, pitch: this.pitch, dist: this.dist, fov: this.fov };
    let dy = yaw - this.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    const to = { tx: target.x, ty: target.y, tz: target.z, yaw: this.yaw + dy, pitch, dist, fov: fov ?? this.fov };
    const prevMode = this.mode; this.mode = 'flight';
    return new Promise((resolve) => {
      this._flight = gsap.to(from, {
        ...to, duration, ease,
        onUpdate: () => {
          this.target.set(from.tx, from.ty, from.tz); this.yaw = from.yaw; this.pitch = from.pitch; this.dist = from.dist; this.fov = from.fov;
          this.goal.target.copy(this.target); this.goal.yaw = this.yaw; this.goal.pitch = this.pitch; this.goal.dist = this.dist; this.goal.fov = this.fov;
        },
        onComplete: () => { this._flight = null; this.mode = prevMode === 'flight' ? 'free' : prevMode; resolve(); },
      });
    });
  }

  flyToShot(name, duration) { const s = SHOTS[name]; return this.flyTo({ ...CameraRig.fromPose(s.pos, s.target), fov: s.fov }, duration); }

  rotateStep(dir) { this.goal.yaw += dir * 45 * D; }
  orbit(dx, dy) { this.goal.yaw -= dx * 0.005; this.goal.pitch = THREE.MathUtils.clamp(this.goal.pitch + dy * 0.004, 28 * D, 80 * D); }

  /** Zoom along the visitor→overview continuum (z in [0,1]). */
  setZoom(z) {
    this.zoom = THREE.MathUtils.clamp(z, 0, 1);
    const e = this.zoom * this.zoom;
    this.goal.dist = THREE.MathUtils.lerp(this.minDist, this.maxDist, e);
    this.goal.pitch = THREE.MathUtils.lerp(44 * D, 53 * D, Math.min(1, this.zoom * 1.4));
    this.goal.fov = THREE.MathUtils.lerp(42, 32, this.zoom);
  }

  update(dt, focusPoint = null) {
    if (this.mode === 'follow' && focusPoint) {
      // when zoomed far out, drift the target toward the cell centre so the overview composes like the poster
      const far = THREE.MathUtils.smoothstep(this.zoom, 0.55, 0.95);
      this.goal.target.set(
        THREE.MathUtils.lerp(focusPoint.x, 1.5, far),
        THREE.MathUtils.lerp(focusPoint.y + 0.8, 0, far),
        THREE.MathUtils.lerp(focusPoint.z, 3, far)
      );
    }
    if (this.mode !== 'flight') {
      const k = 1 - Math.exp(-dt * 5.5), kr = 1 - Math.exp(-dt * 7);
      this.target.lerp(this.goal.target, k);
      this.yaw += (this.goal.yaw - this.yaw) * kr;
      this.pitch += (this.goal.pitch - this.pitch) * kr;
      this.dist += (this.goal.dist - this.dist) * k;
      this.fov += (this.goal.fov - this.fov) * k;
    }
    this.apply();
  }

  apply() {
    const c = this.camera;
    const cp = Math.cos(this.pitch);
    c.position.set(
      this.target.x + Math.sin(this.yaw) * cp * this.dist,
      this.target.y + Math.sin(this.pitch) * this.dist,
      this.target.z + Math.cos(this.yaw) * cp * this.dist
    );
    if (this.shake > 0) { c.position.x += (Math.random() - 0.5) * this.shake; c.position.y += (Math.random() - 0.5) * this.shake; }
    c.lookAt(this.target);
    if (Math.abs(c.fov - this.fov) > 1e-3) { c.fov = this.fov; c.updateProjectionMatrix(); }
    c.near = Math.max(0.1, this.dist * 0.02); c.far = this.dist * 6 + 200; c.updateProjectionMatrix();
  }
}
