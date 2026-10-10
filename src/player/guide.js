// Dr. Celia Mendel: walks alongside the visitor, faces them when talking, leads the way in tour mode.
import * as THREE from 'three';

export class Guide {
  constructor(figure, collision) {
    this.figure = figure; this.collision = collision;
    this.object = new THREE.Group(); this.object.name = 'guide';
    this.object.add(figure);
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3();
    this.heading = Math.PI; this.state = 'idle';
    this.talking = false; this.gesture = null; this.gestureT = 0;
    this.lead = null;   // { path:[{x,z}], onArrive } in tour mode
    this.radius = 0.3;
  }
  place(x, z) { this.pos.set(x, this.collision.heightAt(x, z), z); this.collision.unstick(this.pos, this.radius); }
  doGesture(name, dur = 1.6) { this.gesture = name; this.gestureT = dur; }

  update(dt, t, player) {
    let target = null, speedMax = 3.6;
    if (this.lead && this.lead.path.length) {
      // walk ahead along the path, but wait if the visitor falls behind
      const next = this.lead.path[0];
      const dNext = Math.hypot(next.x - this.pos.x, next.z - this.pos.z);
      if (dNext < 0.9) this.lead.path.shift();
      const gap = this.pos.distanceTo(player.pos);
      target = gap > 7 ? null : new THREE.Vector3(next.x, 0, next.z);
      if (!this.lead.path.length) { const cb = this.lead.onArrive; this.lead = null; cb?.(); }
    } else {
      // companion: stay ~2.2u to the visitor's side/behind
      const side = new THREE.Vector3(Math.sin(player.heading + 2.3), 0, Math.cos(player.heading + 2.3)).multiplyScalar(2.1);
      const desired = player.pos.clone().add(side);
      if (this.pos.distanceTo(player.pos) > 3.2 || this.pos.distanceTo(desired) > 2.4) target = desired;
      speedMax = this.pos.distanceTo(player.pos) > 6 ? 6 : 3.6;
    }
    const want = new THREE.Vector3();
    if (target) {
      const d = new THREE.Vector3(target.x - this.pos.x, 0, target.z - this.pos.z);
      const dist = d.length();
      if (dist > 0.3) want.copy(d.normalize().multiplyScalar(Math.min(speedMax, dist * 2.2)));
    }
    const k = 1 - Math.exp(-8 * dt);
    this.vel.x += (want.x - this.vel.x) * k; this.vel.z += (want.z - this.vel.z) * k;
    const before = this.pos.clone();
    this.collision.move(this.pos, this.vel.x * dt, this.vel.z * dt, this.radius);
    // teleport-follow if separated by obstacles for long
    if (this.pos.distanceTo(player.pos) > 18) { this.pos.copy(player.pos).add(new THREE.Vector3(1.5, 0, 1.5)); this.collision.unstick(this.pos, this.radius); }
    const moved = Math.hypot(this.pos.x - before.x, this.pos.z - before.z), speed = moved / Math.max(dt, 1e-4);
    this.pos.y += (this.collision.heightAt(this.pos.x, this.pos.z) - this.pos.y) * (1 - Math.exp(-12 * dt));
    let face;
    if (speed > 0.3) face = Math.atan2(this.vel.x, this.vel.z);
    else face = Math.atan2(player.pos.x - this.pos.x, player.pos.z - this.pos.z);
    let dh = face - this.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    this.heading += dh * (1 - Math.exp(-7 * dt));
    if (this.gestureT > 0) this.gestureT -= dt; else this.gesture = null;
    this.state = speed > 4.4 ? 'run' : speed > 0.3 ? 'walk' : this.gesture || (this.talking ? 'talk' : 'idle');
    this.object.position.copy(this.pos); this.object.rotation.y = this.heading;
    this.figure.animate?.(this.state, t, dt, { speed });
  }
}
