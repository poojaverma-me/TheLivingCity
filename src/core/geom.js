// Geometry helpers: profile sweeps along XZ paths, contours, rounded shapes.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export { mergeGeometries, mergeVertices };

/**
 * Sweep a 2D profile along a path lying in the XZ plane.
 * path: array of {x, z} (or Vector2 with x,y meaning x,z), closed or open.
 * profile: array of [u, v] where u = offset along the path's left-normal, v = height (Y).
 * opts.closed: path closed; opts.scale(i, t) -> {u:1, v:1, dv:0} per-sample profile scaling (for tapers);
 * opts.displace(pos, normal, i, j) -> mutate pos for organic irregularity.
 * opts.uvScale: [uRepeatPerUnitLength, vRepeatPerProfile]
 */
export function sweepXZ(path, profile, opts = {}) {
  const { closed = false, scale = null, displace = null, capEnds = true, uvScale = [1, 1], yOffset = null, flip = false, colorFn = null } = opts;
  const n = path.length, m = profile.length;
  const P = path.map((p) => new THREE.Vector2(p.x, p.z !== undefined ? p.z : p.y));
  // Tangents and in-plane normals
  const N = [];
  for (let i = 0; i < n; i++) {
    const a = P[closed ? (i - 1 + n) % n : Math.max(0, i - 1)];
    const b = P[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
    const t = new THREE.Vector2().subVectors(b, a).normalize();
    N.push(new THREE.Vector2(-t.y, t.x)); // left normal
  }
  // Arc length for UVs
  const L = [0];
  for (let i = 1; i < n; i++) L.push(L[i - 1] + P[i].distanceTo(P[i - 1]));
  const totalLen = L[n - 1] + (closed ? P[n - 1].distanceTo(P[0]) : 0);
  // Profile length for V
  const PL = [0];
  for (let j = 1; j < m; j++) PL.push(PL[j - 1] + Math.hypot(profile[j][0] - profile[j - 1][0], profile[j][1] - profile[j - 1][1]));

  const rows = closed ? n + 1 : n;
  const pos = new Float32Array(rows * m * 3), uv = new Float32Array(rows * m * 2);
  const col = colorFn ? new Float32Array(rows * m * 3) : null;
  const v3 = new THREE.Vector3();
  for (let r = 0; r < rows; r++) {
    const i = r % n;
    const s = scale ? scale(i, (closed && r === n ? totalLen : L[i]) / totalLen) : null;
    const y0 = yOffset ? yOffset(i) : 0;
    for (let j = 0; j < m; j++) {
      let u = profile[j][0], v = profile[j][1];
      if (s) { u = u * (s.u ?? 1) + (s.du ?? 0); v = (v - (s.vc ?? 0)) * (s.v ?? 1) + (s.vc ?? 0) + (s.dv ?? 0); }
      v3.set(P[i].x + N[i].x * u, v + y0, P[i].y + N[i].y * u);
      if (displace) displace(v3, N[i], i, j, u, v);
      const k = (r * m + j) * 3;
      pos[k] = v3.x; pos[k + 1] = v3.y; pos[k + 2] = v3.z;
      if (col) { const c = colorFn(j, u, v); col[k] = c.r; col[k + 1] = c.g; col[k + 2] = c.b; }
      uv[(r * m + j) * 2] = (r === n ? totalLen : L[i]) * uvScale[0];
      uv[(r * m + j) * 2 + 1] = (PL[j] / PL[m - 1]) * uvScale[1];
    }
  }
  const idx = [];
  for (let r = 0; r < rows - 1; r++) for (let j = 0; j < m - 1; j++) {
    const a = r * m + j, b = (r + 1) * m + j, c = (r + 1) * m + j + 1, d = r * m + j + 1;
    flip ? idx.push(a, b, d, b, c, d) : idx.push(a, d, b, b, d, c);
  }
  let g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  if (col) g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  if (!closed && capEnds) {
    // Fan caps at both ends (assumes convex-ish profile)
    const capIdx = [];
    const base = rows * m;
    const extra = [];
    for (const [r, flip] of [[0, true], [rows - 1, false]]) {
      let cx = 0, cy = 0, cz = 0;
      for (let j = 0; j < m; j++) { cx += pos[(r * m + j) * 3]; cy += pos[(r * m + j) * 3 + 1]; cz += pos[(r * m + j) * 3 + 2]; }
      extra.push(cx / m, cy / m, cz / m);
      const ci = base + extra.length / 3 - 1;
      for (let j = 0; j < m - 1; j++) {
        const a = r * m + j, b = r * m + j + 1;
        (flip !== !!opts.flip) ? capIdx.push(ci, b, a) : capIdx.push(ci, a, b);
      }
    }
    const pos2 = new Float32Array(pos.length + extra.length); pos2.set(pos); pos2.set(extra, pos.length);
    const uv2 = new Float32Array(uv.length + (extra.length / 3) * 2); uv2.set(uv);
    g.setAttribute('position', new THREE.BufferAttribute(pos2, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv2, 2));
    if (col) {
      const col2 = new Float32Array(pos2.length); col2.set(col);
      for (let e = col.length; e < col2.length; e += 3) { col2[e] = col[0]; col2[e + 1] = col[1]; col2[e + 2] = col[2]; }
      g.setAttribute('color', new THREE.BufferAttribute(col2, 3));
    }
    g.setIndex(idx.concat(capIdx));
  }
  g.computeVertexNormals();
  return g;
}

/** Superellipse contour (|x/a|^n + |z/b|^n = 1) sampled counter-clockwise, as {x,z}. */
export function superellipse(a, b, n, count, cx = 0, cz = 0, warp = null) {
  const pts = [];
  for (let i = 0; i < count; i++) {
    const t = (i / count) * Math.PI * 2;
    const c = Math.cos(t), s = Math.sin(t);
    let x = a * Math.sign(c) * Math.pow(Math.abs(c), 2 / n);
    let z = b * Math.sign(s) * Math.pow(Math.abs(s), 2 / n);
    if (warp) ({ x, z } = warp(x, z, t));
    pts.push({ x: x + cx, z: z + cz });
  }
  return pts;
}

/** Offset a closed contour outward by d along its normals. */
export function offsetContour(pts, d) {
  const n = pts.length;
  return pts.map((p, i) => {
    const a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
    let tx = b.x - a.x, tz = b.z - a.z; const l = Math.hypot(tx, tz); tx /= l; tz /= l;
    // contour is CCW in x-z (with z down as "y"), outward normal = (tz, -tx)
    return { x: p.x + tz * d, z: p.z - tx * d };
  });
}

/** Rounded-rectangle profile (u,v) for walls: width w, height h, corner radius r, segments per corner. */
export function roundedWallProfile(w, h, r, seg = 4, bottom = 0) {
  const pts = [];
  const hw = w / 2; r = Math.min(r, hw, h / 2);
  pts.push([hw, bottom]);
  pts.push([hw, h - r]);
  for (let k = 1; k <= seg; k++) { const a = (k / seg) * Math.PI / 2; pts.push([hw - r + Math.cos(a) * r, h - r + Math.sin(a) * r]); }
  for (let k = 0; k <= seg; k++) { const a = Math.PI / 2 + (k / seg) * Math.PI / 2; pts.push([-hw + r + Math.cos(a) * r, h - r + Math.sin(a) * r]); }
  pts.push([-hw, bottom]);
  return pts;
}

/** Path along a circular arc in XZ. Angles in radians (0 = +X, PI/2 = +Z). */
export function arcPath(cx, cz, r, a0, a1, steps, rFn = null) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const a = a0 + (a1 - a0) * (i / steps);
    const rr = rFn ? rFn(a, r) : r;
    pts.push({ x: cx + Math.cos(a) * rr, z: cz + Math.sin(a) * rr });
  }
  return pts;
}

/** Smoothed capsule taper factor for rounded open-sweep ends. */
export function endTaper(t, len, capLen) {
  const d = Math.min(t * len, (1 - t) * len);
  if (d >= capLen) return 1;
  const x = 1 - d / capLen;
  return Math.sqrt(Math.max(0.0001, 1 - x * x));
}

/** Simple deterministic jitter helper. */
export function jitter(rnd, amt) { return (rnd() - 0.5) * 2 * amt; }

/** Build an InstancedMesh from a list of matrices. */
export function instanced(geo, mat, matrices, { castShadow = true, receiveShadow = true, colors = null } = {}) {
  const im = new THREE.InstancedMesh(geo, mat, matrices.length);
  matrices.forEach((m, i) => im.setMatrixAt(i, m));
  if (colors) colors.forEach((c, i) => im.setColorAt(i, c));
  im.castShadow = castShadow; im.receiveShadow = receiveShadow;
  im.instanceMatrix.needsUpdate = true;
  im.computeBoundingSphere();
  return im;
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _e = new THREE.Euler();
export function trs(x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  _q.setFromEuler(_e.set(rx, ry, rz));
  return new THREE.Matrix4().compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
}

/** Transform a geometry in place by TRS and return it (handy for merging). */
export function place(geo, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  geo.applyMatrix4(trs(x, y, z, rx, ry, rz, sx, sy, sz));
  return geo;
}

/**
 * Merge a prop's static meshes by material (one draw call per material). Meshes (or ancestors) flagged
 * userData.dynamic = true are left untouched so their animation keeps working. Call before positioning
 * the root (or it uses root-relative matrices either way).
 */
export function bakeStatic(root) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map();
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || Array.isArray(o.material)) return;
    for (let p = o; p && p !== root.parent; p = p.parent) if (p.userData.dynamic) return;
    const key = o.material.uuid;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(o);
  });
  for (const list of buckets.values()) {
    if (list.length < 2) continue;
    const geos = list.map((m) => {
      let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      if (!g.attributes.normal) g.computeVertexNormals();
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
      return g;
    });
    const merged = mergeGeometries(geos);
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, list[0].material);
    mesh.castShadow = list.some((m) => m.castShadow); mesh.receiveShadow = list.some((m) => m.receiveShadow);
    mesh.renderOrder = list[0].renderOrder;
    for (const m of list) m.parent.remove(m);
    root.add(mesh);
  }
  return root;
}
