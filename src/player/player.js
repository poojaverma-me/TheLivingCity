// Visitor controller: camera-relative WASD, click-to-walk (with road pathfinding when available),
// smooth acceleration/turning, ramp heights, footstep events.
import * as THREE from 'three';

const WALK = 3.4, RUN = 6.2, ACCEL = 14, TURN = 12;

/** Minimal stand-in until the character artist's figures load. */
export function placeholderFigure(color = 0x2bb3a3) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.5, 6, 12), new THREE.MeshStandardMaterial({ color, roughness: 0.5 }));
  body.position.y = 0.5; body.castShadow = true; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), new THREE.MeshStandardMaterial({ color: 0xf0c8a0, roughness: 0.6 }));
  head.position.y = 0.98; head.castShadow = true; g.add(head);
  g.animate = () => {};
  return g;
}

export class Player {
  constructor(figure, collision) {
    this.figure = figure; this.collision = collision;
    this.object = new THREE.Group(); this.object.name = 'player';
    this.object.add(figure);
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3();
    this.heading = Math.PI; this.state = 'idle';
    this.goal = null; this.path = null; this.onArrive = null;
    this.radius = 0.32;
    this.stepDist = 0; this.onStep = null;
    this.frozen = false;
    this.lookAt = null; // face a point while idle (e.g. when talking)
  }
  place(x, z, heading = this.heading) {
    this.pos.set(x, this.collision.heightAt(x, z), z);
    this.collision.unstick(this.pos, this.radius);
    this.heading = heading; this.vel.set(0, 0, 0); this.goal = null; this.path = null;
    this.sync(0, 0);
  }
  /** Walk to a point (optionally via a path of {x,z} points). */
  walkTo(x, z, path = null, onArrive = null) {
    this.path = path && path.length ? path.map((p) => new THREE.Vector3(p.x, 0, p.z)) : null;
    this.goal = new THREE.Vector3(x, 0, z); this.onArrive = onArrive; this._stuck = 0;
  }
  stop() { this.goal = null; this.path = null; }

  update(dt, t, input, camYaw) {
    let ix = 0, iz = 0;
    if (!this.frozen && input) {
      if (input.down('w', 'arrowup')) iz -= 1;
      if (input.down('s', 'arrowdown')) iz += 1;
      if (input.down('a', 'arrowleft')) ix -= 1;
      if (input.down('d', 'arrowright')) ix += 1;
    }
    const run = input && input.down('shift');
    let want = new THREE.Vector3();
    if (ix || iz) {
      this.goal = null; this.path = null;
      // camera-relative: camera sits at +(sin yaw, cos yaw) from its target, so "forward" is the opposite
      const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);
      const rx = -fz, rz = fx;
      want.set(fx * -iz + rx * ix, 0, fz * -iz + rz * ix).normalize().multiplyScalar(run ? RUN : WALK);
    } else if (this.goal && !this.frozen) {
      const tgt = this.path && this.path.length ? this.path[0] : this.goal;
      const d = new THREE.Vector3(tgt.x - this.pos.x, 0, tgt.z - this.pos.z);
      const dist = d.length();
      if (this.path && this.path.length && dist < 0.9) this.path.shift();
      else if (!this.path?.length && dist < 0.25) { const cb = this.onArrive; this.goal = null; this.onArrive = null; cb?.(); }
      else want.copy(d.normalize().multiplyScalar((run ? RUN : WALK) * Math.min(1, dist / 0.8 + 0.35)));
    }
    // accelerate
    const k = 1 - Math.exp(-ACCEL * dt);
    this.vel.x += (want.x - this.vel.x) * k; this.vel.z += (want.z - this.vel.z) * k;
    const before = this.pos.clone();
    this.collision.move(this.pos, this.vel.x * dt, this.vel.z * dt, this.radius);
    const moved = Math.hypot(this.pos.x - before.x, this.pos.z - before.z);
    if (this.goal && want.lengthSq() > 0.01 && moved < 0.2 * WALK * dt) { this._stuck += dt; if (this._stuck > 0.6) { this.goal = null; this.path = null; } } else this._stuck = 0;
    const speed = moved / Math.max(dt, 1e-4);
    // ground height (ramps) with smoothing
    const gy = this.collision.heightAt(this.pos.x, this.pos.z);
    this.pos.y += (gy - this.pos.y) * (1 - Math.exp(-12 * dt));
    // facing
    if (speed > 0.25) {
      const target = Math.atan2(this.vel.x, this.vel.z);
      let dh = target - this.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      this.heading += dh * (1 - Math.exp(-TURN * dt));
    } else if (this.lookAt) {
      const target = Math.atan2(this.lookAt.x - this.pos.x, this.lookAt.z - this.pos.z);
      let dh = target - this.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      this.heading += dh * (1 - Math.exp(-6 * dt));
    }
    this.state = speed > 4.6 ? 'run' : speed > 0.35 ? 'walk' : 'idle';
    // footsteps
    this.stepDist += moved;
    const stride = this.state === 'run' ? 1.05 : 0.72;
    if (this.stepDist > stride) { this.stepDist = 0; this.onStep?.(this.pos, this.state); }
    this.speed = speed;
    this.sync(t, dt);
  }
  sync(t, dt) {
    this.object.position.copy(this.pos);
    this.object.rotation.y = this.heading;
    this.figure.animate?.(this.state, t, dt, { speed: this.speed || 0 });
  }
}
