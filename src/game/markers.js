// World-space guidance: twinkling curiosity sparkles and the tour path (glowing chevrons along the road).
import * as THREE from 'three';

function starTexture() {
  const S = 128; const c = document.createElement('canvas'); c.width = c.height = S;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.18, 'rgba(255,240,200,0.85)'); g.addColorStop(1, 'rgba(255,220,150,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 3;
  for (const a of [0, Math.PI / 2]) {
    ctx.beginPath(); ctx.moveTo(S / 2 + Math.cos(a) * S * 0.48, S / 2 + Math.sin(a) * S * 0.48);
    ctx.lineTo(S / 2 - Math.cos(a) * S * 0.48, S / 2 - Math.sin(a) * S * 0.48); ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class Sparkles {
  constructor(scene) {
    this.group = new THREE.Group(); this.group.name = 'sparkles'; scene.add(this.group);
    this.tex = starTexture(); this.items = [];
  }
  add(id, pos) {
    const m = new THREE.SpriteMaterial({ map: this.tex, color: 0xffe9b0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
    const s = new THREE.Sprite(m); s.position.copy(pos); s.scale.setScalar(0.7);
    this.group.add(s); this.items.push({ id, s, phase: Math.random() * 6 });
  }
  update(t, playerPos, found) {
    for (const it of this.items) {
      const d = it.s.position.distanceTo(playerPos);
      const isFound = found.has(it.id);
      const vis = THREE.MathUtils.clamp((16 - d) / 6, 0, 1) * (isFound ? 0.25 : 1);
      const tw = 0.55 + 0.45 * Math.sin(t * 3.1 + it.phase) * Math.sin(t * 1.7 + it.phase * 2);
      it.s.material.opacity = vis * tw;
      it.s.scale.setScalar((isFound ? 0.45 : 0.75) * (0.85 + 0.25 * tw));
      it.s.material.rotation = t * 0.6 + it.phase;
    }
  }
}

export class TourPath {
  constructor(scene) {
    const shape = new THREE.Shape();
    shape.moveTo(-0.32, -0.18); shape.lineTo(0, 0.14); shape.lineTo(0.32, -0.18); shape.lineTo(0.32, -0.02); shape.lineTo(0, 0.3); shape.lineTo(-0.32, -0.02);
    const geo = new THREE.ShapeGeometry(shape); geo.rotateX(-Math.PI / 2); geo.rotateY(Math.PI);
    this.mat = new THREE.MeshBasicMaterial({ color: 0xb98cff, transparent: true, opacity: 0.9, depthWrite: false });
    this.mesh = new THREE.InstancedMesh(geo, this.mat, 160);
    this.mesh.count = 0; this.mesh.frustumCulled = false; this.mesh.renderOrder = 2;
    scene.add(this.mesh);
    this.pts = []; this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler();
  }
  set(points, heightAt) {
    // resample the polyline every 1.3u
    this.pts = [];
    if (!points || points.length < 2) { this.mesh.count = 0; return; }
    let carry = 0;
    for (let i = 0; i < points.length - 1 && this.pts.length < 160; i++) {
      const a = points[i], b = points[i + 1];
      const len = Math.hypot(b.x - a.x, b.z - a.z); const yaw = Math.atan2(b.x - a.x, b.z - a.z);
      for (let d = carry; d < len && this.pts.length < 160; d += 1.3) {
        const x = a.x + (b.x - a.x) * (d / len), z = a.z + (b.z - a.z) * (d / len);
        this.pts.push({ x, y: (heightAt ? heightAt(x, z) : 0) + 0.09, z, yaw });
      }
      carry = 0;
    }
    this.mesh.count = this.pts.length;
  }
  clear() { this.pts = []; this.mesh.count = 0; }
  update(t, playerPos) {
    const n = this.pts.length; if (!n) return;
    for (let i = 0; i < n; i++) {
      const p = this.pts[i];
      const wave = 0.75 + 0.35 * Math.max(0, Math.sin(i * 0.55 - t * 5));
      const near = Math.hypot(p.x - playerPos.x, p.z - playerPos.z) < 1.2 ? 0.0001 : 1;
      this._q.setFromEuler(this._e.set(0, p.yaw, 0));
      this._m.compose(new THREE.Vector3(p.x, p.y, p.z), this._q, new THREE.Vector3(wave * near, 1, wave * near));
      this.mesh.setMatrixAt(i, this._m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mat.opacity = 0.65 + Math.sin(t * 2.2) * 0.15;
  }
}
