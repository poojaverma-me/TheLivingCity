// Walkability for the visitor: 2D shapes (cell outline + district footprints) and a height field
// for ramps/terraces (nucleus avenue, nucleus balcony & ops floor).
import { NUCLEUS, RER, insideCell } from '../world/layout.js';
import { avenueHeight } from '../world/organelles/rer.js';

const AV = RER.ramp.angle;
const AVX = Math.cos(AV), AVZ = Math.sin(AV);
const AV_HALF_W = 1.35;
const R_OUT = RER.rings[RER.rings.length - 1] + 1.6;

/** Local polar coords around the nucleus. */
function nucLocal(x, z) {
  const dx = x - NUCLEUS.x, dz = z - NUCLEUS.z;
  const r = Math.hypot(dx, dz);
  // distance along / across the avenue axis
  const along = dx * AVX + dz * AVZ, across = -dx * AVZ + dz * AVX;
  return { dx, dz, r, along, across, phi: Math.atan2(dz, dx) };
}
function inOpening(phi) {
  let d = phi - NUCLEUS.cutCenter; d = Math.atan2(Math.sin(d), Math.cos(d));
  return Math.abs(d) < NUCLEUS.cutWidth / 2 - 0.08;
}

export class CollisionWorld {
  constructor() {
    this.shapes = [];   // {type:'circle'|'box', ...} world coords
  }
  addFootprints(list = []) { for (const f of list) this.shapes.push(f); }
  collectFrom(root) {
    root.traverse((o) => { if (o.userData && o.userData.footprints) this.addFootprints(o.userData.footprints); });
  }

  /** Ground height at (x,z) for the walker (ramps, terraces). */
  heightAt(x, z) {
    const L = nucLocal(x, z);
    if (L.r < NUCLEUS.plinthR + 0.2) return NUCLEUS.plinthH;
    if (L.r < R_OUT + 0.3 && Math.abs(L.across) < AV_HALF_W + 0.4 && L.along > 0) return avenueHeight(L.r) + 0.05;
    return 0;
  }

  /** Is the point walkable for a body of radius rad? */
  blockedBy(x, z, rad) {
    if (!insideCell(x, z, 1.2 + rad)) return 'cell';
    const L = nucLocal(x, z);
    // ER terraces: only the avenue strip is walkable
    if (L.r > NUCLEUS.plinthR - 0.2 && L.r < R_OUT) {
      if (!(L.along > 0 && Math.abs(L.across) < AV_HALF_W - rad * 0.5)) return 'rer';
    }
    // dome shell: only enter through the opening
    const R = NUCLEUS.r;
    if (L.r > R - 0.75 - rad && L.r < R + 0.35 + rad && !inOpening(L.phi)) return 'dome';
    // screen wall + holo table inside the nucleus
    if (L.r > 6.0 - rad && L.r < 6.9 + rad && L.dz < -1.5) return 'screens';
    if (Math.hypot(L.dx, L.dz - 1.2) < 1.5 + rad) return 'holo';
    for (const s of this.shapes) if (hitShape(s, x, z, rad)) return s.id || s.type;
    return null;
  }

  /**
   * Move from p by delta, sliding along obstacles. Returns the new position (mutates p).
   */
  move(p, dx, dz, rad = 0.32) {
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.15));
    const sx = dx / steps, sz = dz / steps;
    for (let i = 0; i < steps; i++) {
      if (!this.blockedBy(p.x + sx, p.z + sz, rad)) { p.x += sx; p.z += sz; continue; }
      if (!this.blockedBy(p.x + sx, p.z, rad)) { p.x += sx; continue; }
      if (!this.blockedBy(p.x, p.z + sz, rad)) { p.z += sz; continue; }
      break;
    }
    // stuck inside something (spawn/teleport): nudge out radially
    if (this.blockedBy(p.x, p.z, rad)) this.unstick(p, rad);
    return p;
  }

  unstick(p, rad) {
    for (let r = 0.2; r < 6; r += 0.2) for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
      const x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r;
      if (!this.blockedBy(x, z, rad)) { p.x = x; p.z = z; return; }
    }
  }
}

function hitShape(s, x, z, rad) {
  if (s.type === 'circle') return Math.hypot(x - s.x, z - s.z) < s.r + rad;
  if (s.type === 'box') {
    const c = Math.cos(s.rot || 0), sn = Math.sin(s.rot || 0);
    const lx = (x - s.x) * c - (z - s.z) * sn, lz = (x - s.x) * sn + (z - s.z) * c;
    // NB: three.js rotation.y rotates +X toward -Z; footprints use the same convention
    const cx = Math.max(-s.w / 2, Math.min(s.w / 2, lx)), cz = Math.max(-s.d / 2, Math.min(s.d / 2, lz));
    return Math.hypot(lx - cx, lz - cz) < rad;
  }
  if (s.type === 'capsule') {
    // segment a->b with radius r
    const ax = s.ax, az = s.az, bx = s.bx, bz = s.bz;
    const vx = bx - ax, vz = bz - az; const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz)));
    return Math.hypot(x - (ax + vx * t), z - (az + vz * t)) < s.r + rad;
  }
  return false;
}

