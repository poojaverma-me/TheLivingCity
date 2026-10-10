// Miniature people: painted-figurine humans with one continuous skinned body (2-bone blended joints),
// sculpted hair, a lab coat with lapels/collar/flared swinging hem, and blended procedural animation.
// Heroes are THREE.SkinnedMesh (2 draw calls); the crowd is ONE InstancedMesh skinned on the GPU from a bone texture.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, mergeVertices } from '../core/geom.js';
import { organic } from '../core/lookdev.js';

// ---------------------------------------------------------------------------------------------
// Shared paint system
// ---------------------------------------------------------------------------------------------

/** Per-instance colour slots (crowd) — BAKED uses the vertex colour as-is. */
export const SLOT = { BAKED: 0, SKIN: 1, HAIR: 2, ACC: 3, PANTS: 4, SHIRT: 5, COAT: 6, SHOE: 7 };
/** Variant bits (crowd masks) — a piece with v=k is only shown when bit k is set. */
export const BIT = { SHORT: 1, BUN: 2, PONY: 3, LONG: 4, CURLY: 5, BUZZ: 6, HAT: 7, GLASSES: 8, GOGGLES: 9, CLIPBOARD: 10, TABLET: 11, PEN: 12, TOPBUN: 13, FLASK: 14, HAIRLOW: 15 };
export const HAIR_BITS = [BIT.SHORT, BIT.BUN, BIT.PONY, BIT.LONG, BIT.CURLY, BIT.BUZZ];

/** Surface presets: [roughness, metalness, emissive, clearcoat, sheen, skinWarmth] */
export const MAT = {
  cloth: [0.8, 0, 0, 0.0, 0.9, 0],
  coat: [0.6, 0, 0, 0.12, 0.8, 0],
  skin: [0.46, 0, 0, 0.14, 0.25, 1],
  hair: [0.66, 0, 0, 0.12, 0.7, 0],
  shoe: [0.3, 0, 0, 0.75, 0, 0],
  plastic: [0.26, 0, 0, 0.95, 0, 0],
  metal: [0.24, 0.95, 0, 0.4, 0, 0],
  chrome: [0.12, 1.0, 0, 0.6, 0, 0],
  glass: [0.04, 0.25, 0, 1, 0, 0],
  eye: [0.12, 0, 0, 1, 0, 0],
  screen: [0.2, 0, 2.6, 0.9, 0, 0],
  paint: [0.3, 0.04, 0, 0.6, 0, 0],
  rubber: [0.78, 0, 0, 0.05, 0, 0],
  dark: [0.5, 0.15, 0, 0.35, 0, 0],
  light: [0.3, 0, 5.5, 0.6, 0, 0],
  lightRed: [0.3, 0, 4.0, 0.6, 0, 0],
  lightAmber: [0.3, 0, 3.2, 0.6, 0, 0],
  card: [0.55, 0, 0, 0.2, 0, 0],
  liquid: [0.1, 0, 1.2, 1, 0, 0],
};

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();

/** Transform a geometry in place: position, euler rotation [x,y,z,(order)], scale. */
export function xf(geo, pos = [0, 0, 0], rot = null, scl = null) {
  _e.set(rot ? rot[0] : 0, rot ? rot[1] : 0, rot ? rot[2] : 0, rot && rot[3] ? rot[3] : 'XYZ');
  _q.setFromEuler(_e);
  _m.compose(_v.set(...pos), _q, scl ? _s.set(...scl) : _s.set(1, 1, 1));
  geo.applyMatrix4(_m);
  return geo;
}
export const sph = (r, ws, hs, pos, scl, rot, phiS = 0, phiL = Math.PI * 2, thS = 0, thL = Math.PI) =>
  xf(new THREE.SphereGeometry(r, ws, hs, phiS, phiL, thS, thL), pos, rot, scl);
export const cyl = (rt, rb, h, rs, pos, rot, scl, open = false, thS = 0, thL = Math.PI * 2) =>
  xf(new THREE.CylinderGeometry(rt, rb, h, rs, 1, open, thS, thL), pos, rot, scl);
export const rbox = (w, h, d, r, pos, rot, seg = 2) =>
  xf(new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4)), pos, rot);
/** Rounded box when detailed, plain box for the low-poly crowd. */
export const pbox = (d, w, h, dd, r, pos, rot, seg) => d >= 1 ? rbox(w, h, dd, r, pos, rot, seg) : xf(new THREE.BoxGeometry(w, h, dd), pos, rot);
/** Cylinder spanning two points. */
export function rod(a, b, r0, r1 = r0, rs = 6) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const len = A.distanceTo(B);
  const g = new THREE.CylinderGeometry(r1, r0, len, rs, 1, false);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
  g.applyMatrix4(new THREE.Matrix4().compose(A.clone().add(B).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1)));
  return g;
}
/** Tube through a list of points (rolled edges, lanyards). */
export function tube(points, r, rs = 5) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  return new THREE.TubeGeometry(curve, Math.max(2, points.length * 2), r, rs, false);
}

/**
 * Curved shell around the Y axis (garments that follow the body).
 * rows(u) -> {y, r, a0, a1, fold?} for u in [0,1] TOP → BOTTOM (angles: 0 = +Z front, +π/2 = +X).
 */
export function shell(rows, nRows, segs, zScale = 1, zOff = 0) {
  const pos = [], uv = [], idx = [];
  for (let j = 0; j < nRows; j++) {
    const R = rows(j / (nRows - 1));
    for (let i = 0; i <= segs; i++) {
      const a = R.a0 + (R.a1 - R.a0) * (i / segs);
      const r = R.r * (1 + (R.fold || 0) * (0.6 * Math.sin(a * 6 + 0.7) + 0.4 * Math.sin(a * 11 + 2.1)));
      pos.push(Math.sin(a) * r, R.y, Math.cos(a) * r * zScale + zOff);
      uv.push(i / segs, j / (nRows - 1));
    }
  }
  for (let j = 0; j < nRows - 1; j++) for (let i = 0; i < segs; i++) {
    const a = j * (segs + 1) + i, b = a + segs + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
/** Revolved profile [[r,y],...] (bottom → top), seam at the back. */
export function lathe(profile, segs, zScale = 1) {
  const g = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), segs, Math.PI, Math.PI * 2);
  if (zScale !== 1) g.scale(1, 1, zScale);
  g.computeVertexNormals();
  return g;
}
/** Smooth-normal sphere-ish blob sculpted by a radial displacement f(nx,ny,nz) → scale. */
function blob(r, ws, hs, f, thL = Math.PI) {
  let g = new THREE.SphereGeometry(r, ws, hs, 0, Math.PI * 2, 0, thL);
  g.deleteAttribute('uv'); g.deleteAttribute('normal');
  g = mergeVertices(g, 1e-5);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), l = Math.hypot(x, y, z) || 1;
    const k = f(x / l, y / l, z / l);
    p.setXYZ(i, x * k, y * k, z * k);
  }
  return g;
}
function lut(table, x) {
  if (x <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) if (x <= table[i][0]) {
    const [x0, y0] = table[i - 1], [x1, y1] = table[i];
    return y0 + (y1 - y0) * (x - x0) / (x1 - x0);
  }
  return table[table.length - 1][1];
}
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---------------------------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------------------------

export const RIG = {
  hips: [0, 0.5, 0], chest: [0, 0.585, 0], head: [0, 0.818, 0],
  thigh: [0.064, 0.49, 0], shin: [0.064, 0.262, 0],
  arm: [0.136, 0.752, 0], fore: [0.136, 0.585, 0],
};
export const BONES = ['hips', 'chest', 'head', 'thighL', 'shinL', 'thighR', 'shinR', 'armL', 'foreL', 'armR', 'foreR'];
export const BONE = Object.fromEntries(BONES.map((b, i) => [b, i]));
const restOf = (b) => {
  const s = b.endsWith('R') ? -1 : 1, k = b.replace(/[LR]$/, '');
  const r = RIG[k]; return [r[0] * s, r[1], r[2]];
};
export const REST = BONES.map(restOf);

/**
 * Bake pieces into one geometry with the paint attributes.
 * piece: { geo, color, tint, slot, mat, v, bone | skin(x,y,z)→[boneA, boneB, wA], ao(x,y,z)→number|[r,g,b] }
 * skin: 'none' | 'standard' (SkinnedMesh) | 'crowd' (aSkin attribute)
 */
export function bakePieces(pieces, { crowd = false, colors = {}, mask = 0, skin = 'none', origin = null } = {}) {
  const geos = [];
  const col = new THREE.Color(), base = new THREE.Color();
  for (const p of pieces) {
    if (!crowd && p.v && !(mask & (1 << p.v))) continue;
    let g = p.geo.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.index) { const n = g.attributes.position.count; const ix = new Uint32Array(n); for (let i = 0; i < n; i++) ix[i] = i; g.setIndex(new THREE.BufferAttribute(ix, 1)); }
    if (origin) g.translate(-origin[0], -origin[1], -origin[2]);
    const n = g.attributes.position.count, P = g.attributes.position;
    const tint = p.tint ?? 1;
    if (crowd && p.slot) base.setRGB(tint, tint, tint);
    else if (p.slot && colors[p.slot] !== undefined) base.set(colors[p.slot]).multiplyScalar(tint);
    else base.set(p.color ?? 0xffffff);
    const mt = MAT[p.mat || 'cloth'];
    const c = new Float32Array(n * 3), am = new Float32Array(n * 4), ae = new Float32Array(n * 2), asv = new Float32Array(n * 2);
    const sk = skin !== 'none' ? new Float32Array(n * 3) : null;
    for (let i = 0; i < n; i++) {
      const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
      col.copy(base);
      if (p.ao) { const a = p.ao(x, y, z); if (Array.isArray(a)) { col.r *= a[0]; col.g *= a[1]; col.b *= a[2]; } else col.multiplyScalar(a); }
      c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b;
      am[i * 4] = mt[0]; am[i * 4 + 1] = mt[1]; am[i * 4 + 2] = mt[2]; am[i * 4 + 3] = mt[3];
      ae[i * 2] = mt[4]; ae[i * 2 + 1] = mt[5];
      asv[i * 2] = p.slot || 0; asv[i * 2 + 1] = p.v || 0;
      if (sk) {
        const s = p.skin ? p.skin(x, y, z) : [p.bone, p.bone, 1];
        sk[i * 3] = BONE[s[0]]; sk[i * 3 + 1] = BONE[s[1]]; sk[i * 3 + 2] = s[2];
      }
    }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    g.setAttribute('aMat', new THREE.BufferAttribute(am, 4));
    g.setAttribute('aExt', new THREE.BufferAttribute(ae, 2));
    if (crowd) g.setAttribute('aSV', new THREE.BufferAttribute(asv, 2));
    if (skin === 'crowd') g.setAttribute('aSkin', new THREE.BufferAttribute(sk, 3));
    if (skin === 'standard') {
      const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) { si[i * 4] = sk[i * 3]; si[i * 4 + 1] = sk[i * 3 + 1]; sw[i * 4] = sk[i * 3 + 2]; sw[i * 4 + 1] = 1 - sk[i * 3 + 2]; }
      g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
      g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    }
    geos.push(g);
  }
  if (!geos.length) return null;
  const out = mergeGeometries(geos, false);
  out.computeBoundingSphere();
  return out;
}

/** Pack an sRGB hex colour into one float (exact up to 2^24) — unpacked in the crowd shader. */
export const packColor = (hex) => hex & 0xffffff;
const UNPACK = `vec3 lifeUnpack(float f) { int v = int(f + 0.5); return pow(vec3(float((v >> 16) & 255), float((v >> 8) & 255), float(v & 255)) / 255.0, vec3(2.2)); }`;
const MASK_TEST = 'if (aSV.y > 0.5) { int b = int(aSV.y + 0.5); if (((int(iColA.w + 0.5) >> b) & 1) == 0) transformed = vec3(0.0); }';
const BONE_FN = `uniform highp sampler2D uBones; attribute float iAgent;
  mat4 lifeBone(float b) { int x = int(b + 0.5) * 4; int y = int(abs(iAgent) + 0.5) - 1;
    return mat4(texelFetch(uBones, ivec2(x, y), 0), texelFetch(uBones, ivec2(x + 1, y), 0), texelFetch(uBones, ivec2(x + 2, y), 0), texelFetch(uBones, ivec2(x + 3, y), 0)); }`;
const SKIN_M = 'mat4 lifeSkinM = lifeBone(aSkin.x) * aSkin.z + lifeBone(aSkin.y) * (1.0 - aSkin.z);';

/**
 * The miniature "paint" material. Per-vertex: roughness, metalness, emissive, clearcoat, sheen, skin warmth.
 * crowd: { bones: DataTexture } adds GPU skinning from the bone texture, per-instance colour slots and variant masks.
 * rim: optional {color, strength} hero highlight.
 */
export function paintMaterial({ crowd = null, side = THREE.DoubleSide, clearcoatRoughness = 0.3, key = '', rim = null } = {}) {
  const m = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, vertexColors: true, roughness: 0.6, metalness: 0, side,
    clearcoat: 1, clearcoatRoughness, sheen: 1, sheenRoughness: 0.5, sheenColor: new THREE.Color(0xffffff),
    envMapIntensity: 1.0,
  });
  const rimU = { value: new THREE.Color(rim ? rim.color : 0x000000) }, rimS = { value: rim ? rim.strength : 0 };
  m.userData.rim = { color: rimU, strength: rimS };
  m.onBeforeCompile = (sh) => {
    if (crowd) sh.uniforms.uBones = { value: crowd.bones };
    sh.uniforms.uRimC = rimU; sh.uniforms.uRimS = rimS;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute vec4 aMat; attribute vec2 aExt; varying vec4 vMat; varying vec2 vExt;
        ${crowd ? `attribute vec2 aSV; attribute vec3 aSkin; attribute vec4 iColA; attribute vec4 iColB; ${UNPACK} ${BONE_FN}` : ''}`)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        ${crowd ? `${SKIN_M} objectNormal = normalize(mat3(lifeSkinM) * objectNormal);` : ''}`)
      .replace('#include <color_vertex>', `#include <color_vertex>
        vMat = aMat; vExt = aExt;
        ${crowd ? `{
          int sl = int(aSV.x + 0.5);
          if (sl == 1) vColor.rgb *= lifeUnpack(iColA.x); else if (sl == 2) vColor.rgb *= lifeUnpack(iColA.y); else if (sl == 3) vColor.rgb *= lifeUnpack(iColA.z);
          else if (sl == 4) vColor.rgb *= lifeUnpack(iColB.x); else if (sl == 5) vColor.rgb *= lifeUnpack(iColB.y); else if (sl == 6) vColor.rgb *= lifeUnpack(iColB.z);
          else if (sl == 7) vColor.rgb *= lifeUnpack(iColB.w);
        }` : ''}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        ${crowd ? `transformed = (lifeSkinM * vec4(transformed, 1.0)).xyz; ${MASK_TEST} if (iAgent < 0.0) transformed = vec3(0.0);` : ''}`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec4 vMat; varying vec2 vExt; uniform vec3 uRimC; uniform float uRimS;`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = vMat.x;`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
        metalnessFactor = vMat.y;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += diffuseColor.rgb * vMat.z;`)
      .replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>
        #ifdef USE_CLEARCOAT
          material.clearcoat = vMat.w;
        #endif
        #ifdef USE_SHEEN
          material.sheenColor = mix(vec3(1.0), diffuseColor.rgb, 0.35) * vExt.x * 0.6;
        #endif`)
      .replace('#include <opaque_fragment>', `{
          vec3 vdir = normalize(vViewPosition);
          float fres = pow(1.0 - clamp(dot(normal, vdir), 0.0, 1.0), 2.4);
          // skin warmth: soft warm rim + subsurface lift (painted-figurine skin)
          outgoingLight += vExt.y * diffuseColor.rgb * vec3(1.0, 0.62, 0.5) * (0.07 + 0.32 * fres);
          // hero rim highlight
          outgoingLight += uRimC * uRimS * fres * fres;
        }
        #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => `lifePaint2:${crowd ? 'C' : 'S'}:${key}`;
  return m;
}

/** Depth material for crowd shadows: same GPU skinning + variant mask. */
export function paintDepthMaterial(bones) {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uBones = { value: bones };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\nattribute vec2 aSV; attribute vec3 aSkin; attribute vec4 iColA; ${BONE_FN}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        ${SKIN_M} transformed = (lifeSkinM * vec4(transformed, 1.0)).xyz; ${MASK_TEST}`);
  };
  m.customProgramCacheKey = () => 'lifePaintDepth2';
  return m;
}

// ---------------------------------------------------------------------------------------------
// Figure anatomy (figure faces +Z, feet at y=0, ≈1.05u tall), all pieces in rest figure space
// ---------------------------------------------------------------------------------------------

const HC = [0, 0.928, 0.006];           // head centre
const HS = [0.94, 1.03, 0.98];          // head scale
const LEG_T = RIG.thigh[1] - RIG.shin[1];
const LEG_S = RIG.shin[1];

const CHEST_R = [[0.53, 0.1], [0.6, 0.104], [0.68, 0.117], [0.735, 0.122], [0.78, 0.113], [0.806, 0.085], [0.822, 0.04]];
const COAT_R = [[0.545, 0.112], [0.6, 0.115], [0.68, 0.128], [0.742, 0.134], [0.772, 0.131], [0.798, 0.114], [0.818, 0.088], [0.836, 0.054]];
const SKIRT_R = [[0.18, 0.186], [0.27, 0.175], [0.3, 0.168], [0.38, 0.146], [0.46, 0.126], [0.54, 0.114], [0.61, 0.114]];
const JACKET_R = [[0.465, 0.117], [0.53, 0.115], [0.6, 0.12], [0.68, 0.132], [0.74, 0.136], [0.775, 0.131], [0.8, 0.116], [0.822, 0.092], [0.845, 0.058]];

const coatGap = (y) => 0.12 + 0.78 * smooth(0.63, 0.82, y);
const skirtGap = (y) => 0.12 + 0.36 * smooth(0.52, 0.22, y);

/** Skirt skin: hem follows the thigh on its side so the coat swings with the stride. */
const skirtSkin = (hem) => (x, y) => {
  const w = 0.6 * smooth(0.53, hem, y) * Math.min(1, Math.abs(x) / 0.07);
  return [x >= 0 ? 'thighL' : 'thighR', 'hips', w];
};
const legSkin = (S) => (x, y) => {
  if (y > 0.44) return ['hips', 'thigh' + S, smooth(0.44, 0.56, y)];
  if (y > 0.3) return ['thigh' + S, 'thigh' + S, 1];
  return ['shin' + S, 'thigh' + S, smooth(0.3, 0.225, y)];
};
const armSkin = (S) => (x, y) => {
  const ly = y - RIG.arm[1];
  if (ly > -0.12) return ['arm' + S, 'arm' + S, 1];
  return ['fore' + S, 'arm' + S, smooth(-0.12, -0.215, ly)];
};

/** Torso, coat/jacket, neck, head, hair & head accessories (figure space). */
export function bodyPieces(o, d = 1) {
  const P = [];
  const S = (n) => Math.max(4, Math.round(n * d));
  const LS = d < 1 ? 6 : 8, LS2 = d < 1 ? 4 : 6;
  const add = (geo, p) => P.push({ geo, ...p });
  const coat = o.outfit !== 'jacket';
  const hem = o.coatHem ?? 0.27;
  const coatSlot = { slot: SLOT.COAT, mat: 'coat' };
  const coolHem = (x, y) => { const t = smooth(hem + 0.18, hem, y); return [1 - 0.1 * t, 1 - 0.075 * t, 1 - 0.025 * t]; };

  // trouser seat (hidden mostly) + shirt torso
  add(lathe([[0.0, 0.43], [0.078, 0.436], [0.1, 0.47], [0.104, 0.53], [0.1, 0.6]], S(14), 0.8), { slot: SLOT.PANTS, mat: 'cloth', bone: 'hips', ao: () => 0.7 });
  add(lathe(CHEST_R.map(([y, r]) => [r, y]).concat([[0, 0.826]]), S(16), 0.74), { slot: SLOT.SHIRT, mat: 'cloth', bone: 'chest', ao: (x, y) => 0.8 + 0.15 * smooth(0.6, 0.76, y) });

  if (coat) {
    const zc = 0.78;
    const upperAO = (x, y) => (y > 0.79 ? 0.94 : 1) * (Math.abs(x) > 0.1 && y < 0.74 && y > 0.6 ? 0.92 : 1);
    add(shell((u) => { const y = 0.838 - u * (0.838 - 0.545); const g = coatGap(y); return { y, r: lut(COAT_R, y), a0: g / 2, a1: Math.PI * 2 - g / 2 }; }, S(13), S(24), zc), { ...coatSlot, bone: 'chest', ao: upperAO });
    // lapels: raised panels with a rolled outer edge
    for (const side of [1, -1]) {
      const lap = (y) => { const g = coatGap(y), w = 0.4 * smooth(0.64, 0.8, y) + 0.025; return { g, w, r: lut(COAT_R, y) + 0.009 }; };
      add(shell((u) => {
        const y = 0.81 - u * (0.81 - 0.64); const { g, w, r } = lap(y);
        return side > 0 ? { y, r, a0: g / 2 - 0.02, a1: g / 2 + w } : { y, r, a0: -g / 2 - w, a1: -g / 2 + 0.02 };
      }, S(8), S(5), zc), { ...coatSlot, tint: 0.95, bone: 'chest' });
      const edge = [];
      for (let k = 0; k <= 6; k++) {
        const y = 0.81 - (k / 6) * (0.81 - 0.645); const { g, w, r } = lap(y); const a = side * (g / 2 + w);
        edge.push([Math.sin(a) * (r + 0.002), y, Math.cos(a) * (r + 0.002) * zc]);
      }
      add(tube(edge, 0.0055, d < 1 ? 4 : 6), { ...coatSlot, bone: 'chest' });
    }
    // fold-over collar around the back of the neck + rolled edge
    add(shell((u) => ({ y: 0.872 - u * 0.062, r: 0.066 + u * 0.04, a0: 0.62, a1: Math.PI * 2 - 0.62 }), 4, S(18), 0.88), { ...coatSlot, bone: 'chest', ao: (x, y) => 0.9 + 0.1 * smooth(0.83, 0.87, y) });
    { const e = []; for (let k = 0; k <= 10; k++) { const a = 0.62 + (k / 10) * (Math.PI * 2 - 1.24); e.push([Math.sin(a) * 0.107, 0.81, Math.cos(a) * 0.107 * 0.88]); } add(tube(e, 0.007, d < 1 ? 4 : 6), { ...coatSlot, bone: 'chest' }); }
    // shirt collar points peeking out of the V
    add(shell((u) => ({ y: 0.846 - u * 0.05, r: 0.05 + u * 0.03, a0: -0.75, a1: 0.75 }), 3, S(10), 0.95), { slot: SLOT.SHIRT, tint: 1.12, mat: 'cloth', bone: 'chest' });
    // breast pocket + pen
    add(shell((u) => { const y = 0.728 - u * 0.058; return { y, r: lut(COAT_R, y) + 0.004, a0: 0.62, a1: 1.02 }; }, 3, 4, zc), { ...coatSlot, tint: 0.95, bone: 'chest' });
    { const a = 0.72, y = 0.742, r = lut(COAT_R, y) + 0.006; add(cyl(0.0055, 0.0055, 0.042, 5, [Math.sin(a) * r, y, Math.cos(a) * r * zc]), { color: 0x2f5fb8, mat: 'plastic', bone: 'chest', v: BIT.PEN }); }
    for (const y of [0.565, 0.615, 0.665]) {
      const a = -(coatGap(y) / 2 + 0.07), r = lut(COAT_R, y) + 0.003;
      add(sph(0.0075, 6, 4, [Math.sin(a) * r, y, Math.cos(a) * r * zc], [1, 1, 0.5], [0, a, 0]), { color: 0xdedbd2, mat: 'plastic', bone: 'chest' });
    }
    // flared skirt with soft folds; follows the thighs (swing)
    const sk = skirtSkin(hem), fold = (y) => 0.05 * smooth(0.52, hem, y);
    add(shell((u) => { const y = 0.61 - u * (0.61 - hem); const g = skirtGap(y); return { y, r: lut(SKIRT_R, y), a0: g / 2, a1: Math.PI * 2 - g / 2, fold: fold(y) }; }, S(11), S(30), 0.82), { ...coatSlot, skin: sk, ao: coolHem });
    add(shell((u) => { const y = hem + 0.024 - u * 0.024; const g = skirtGap(y); return { y, r: lut(SKIRT_R, y) + 0.004, a0: g / 2, a1: Math.PI * 2 - g / 2, fold: fold(y) }; }, 2, S(30), 0.82), { ...coatSlot, tint: 0.94, skin: sk, ao: coolHem });
    // back half-belt with buttons + centre vent
    add(shell((u) => { const y = 0.6 - u * 0.04; return { y, r: lut(SKIRT_R, y) + 0.006, a0: Math.PI - 0.55, a1: Math.PI + 0.55 }; }, 3, S(8), 0.82), { ...coatSlot, tint: 0.93, bone: 'hips' });
    for (const s of [1, -1]) { const a = Math.PI + s * 0.42, y = 0.58, r = lut(SKIRT_R, y) + 0.011; add(sph(0.007, LS, 3, [Math.sin(a) * r, y, Math.cos(a) * r * 0.82]), { color: 0xdedbd2, mat: 'plastic', bone: 'hips' }); }
    add(shell((u) => { const y = 0.44 - u * (0.44 - hem - 0.005); return { y, r: lut(SKIRT_R, y) * (1 + fold(y) * (0.6 * Math.sin(Math.PI * 6 + 0.7) + 0.4 * Math.sin(Math.PI * 11 + 2.1))) + 0.002, a0: Math.PI - 0.02, a1: Math.PI + 0.02 }; }, 4, 1, 0.82), { ...coatSlot, tint: 0.8, skin: sk });
    // patch pockets
    for (const s of [1, -1]) add(shell((u) => { const y = 0.475 - u * 0.075; return { y, r: lut(SKIRT_R, y) * (1 + fold(y)) + 0.006, a0: s > 0 ? 0.72 : -1.22, a1: s > 0 ? 1.22 : -0.72 }; }, 3, 4, 0.82), { ...coatSlot, tint: 0.95, skin: sk });
    if (o.badge) { const a = -0.78, y = 0.705, r = lut(COAT_R, y) + 0.006; add(rbox(0.05, 0.026, 0.006, 0.003, [Math.sin(a) * r, y, Math.cos(a) * r * zc], [0, a * 0.8, 0]), { color: o.badge, mat: 'plastic', bone: 'chest' }); }
    if (o.scarf) {
      add(shell((u) => ({ y: 0.842 - u * 0.05, r: 0.058 + u * 0.03, a0: 0, a1: Math.PI * 2 }), 3, S(18), 0.92), { color: o.scarf, mat: 'cloth', bone: 'chest' });
      add(shell((u) => { const y = 0.8 - u * 0.17; return { y, r: lut(COAT_R, y) + 0.016, a0: -0.24, a1: -0.06 }; }, S(6), 2, zc), { color: o.scarf, mat: 'cloth', bone: 'chest' });
      add(shell((u) => { const y = 0.8 - u * 0.12; return { y, r: lut(COAT_R, y) + 0.02, a0: -0.08, a1: 0.08 }; }, S(5), 2, zc), { color: new THREE.Color(o.scarf).multiplyScalar(0.8).getHex(), mat: 'cloth', bone: 'chest' });
    }
  } else {
    // ---- visitor zip jacket ----
    const zc = 0.78, jc = o.jacket ?? 0x1aa6a0, acc = o.jacketAccent ?? 0xff6f5e;
    const gap = (y) => 0.05 + 0.6 * smooth(0.79, 0.85, y);
    add(shell((u) => { const y = 0.846 - u * (0.846 - 0.465); const g = gap(y); return { y, r: lut(JACKET_R, y), a0: g / 2, a1: Math.PI * 2 - g / 2, fold: 0.012 * smooth(0.6, 0.47, y) }; }, S(14), S(24), zc), { color: jc, mat: 'coat', bone: 'chest', ao: (x, y) => (Math.abs(x) > 0.1 && y < 0.74 && y > 0.6 ? 0.9 : 1) });
    add(shell((u) => { const y = 0.81 - u * (0.81 - 0.47); return { y, r: lut(JACKET_R, y) + 0.004, a0: -0.06, a1: 0.06 }; }, S(8), 2, zc), { color: acc, mat: 'plastic', bone: 'chest' });
    add(shell((u) => ({ y: 0.876 - u * 0.045, r: 0.068 + u * 0.024, a0: 0.25, a1: Math.PI * 2 - 0.25 }), 3, S(16), 0.88), { color: acc, mat: 'cloth', bone: 'chest' });
    add(shell((u) => { const y = 0.5 - u * 0.04; return { y, r: lut(JACKET_R, y) + 0.004, a0: 0.05, a1: Math.PI * 2 - 0.05 }; }, 3, S(22), zc), { color: new THREE.Color(jc).multiplyScalar(0.72).getHex(), mat: 'cloth', bone: 'chest' });
    { const a = 0.6, y = 0.72, r = lut(JACKET_R, y) + 0.005; add(sph(0.016, 8, 6, [Math.sin(a) * r, y, Math.cos(a) * r * zc], [1, 1, 0.3], [0, a, 0]), { color: 0xffffff, mat: 'plastic', bone: 'chest' }); }
  }
  if (o.backpack) {
    const bc = o.backpack, dk = new THREE.Color(bc).multiplyScalar(0.65).getHex();
    add(rbox(0.2, 0.235, 0.1, 0.04, [0, 0.66, -0.145], null, S(3)), { color: bc, mat: 'cloth', bone: 'chest' });
    add(rbox(0.15, 0.1, 0.04, 0.018, [0, 0.6, -0.203], null, S(2)), { color: dk, mat: 'cloth', bone: 'chest' });
    add(rbox(0.13, 0.01, 0.006, 0.003, [0, 0.652, -0.224]), { color: o.jacketAccent ?? 0xff6f5e, mat: 'plastic', bone: 'chest' });
    add(xf(new THREE.TorusGeometry(0.025, 0.006, 4, 10, Math.PI), [0, 0.778, -0.145]), { color: dk, mat: 'cloth', bone: 'chest' });
    // straps: over the top of each shoulder, tucking under the arm (no front stripes)
    for (const s of [1, -1]) {
      const pts = [[s * 0.075, 0.71, -0.1], [s * 0.08, 0.8, -0.075], [s * 0.085, 0.825, 0.0], [s * 0.088, 0.8, 0.07], [s * 0.1, 0.73, 0.095]];
      add(tube(pts, 0.011, 5), { color: dk, mat: 'cloth', bone: 'chest' });
    }
  }
  if (o.lanyard) {
    const lc = o.lanyard;
    add(tube([[0.048, 0.83, -0.01], [0.052, 0.81, 0.06], [0.02, 0.73, 0.108], [0.004, 0.69, 0.116]], 0.0042, 4), { color: lc, mat: 'cloth', bone: 'chest' });
    add(tube([[-0.048, 0.83, -0.01], [-0.052, 0.81, 0.06], [-0.02, 0.73, 0.108], [-0.004, 0.69, 0.116]], 0.0042, 4), { color: lc, mat: 'cloth', bone: 'chest' });
    add(rbox(0.056, 0.074, 0.006, 0.006, [0, 0.652, 0.12], [-0.14, 0, 0]), { color: 0xffffff, mat: 'plastic', bone: 'chest' });
    add(rbox(0.056, 0.018, 0.007, 0.004, [0, 0.68, 0.124], [-0.14, 0, 0]), { color: o.jacketAccent ?? 0xff6f5e, mat: 'plastic', bone: 'chest' });
    add(rbox(0.024, 0.024, 0.007, 0.004, [0, 0.645, 0.123], [-0.14, 0, 0]), { color: 0x9fb4c6, mat: 'plastic', bone: 'chest' });
  }

  // --- neck (blends chest → head) + head
  const neckSkin = (x, y) => ['head', 'chest', smooth(0.805, 0.85, y)];
  add(lathe([[0.04, 0.775], [0.037, 0.81], [0.035, 0.85], [0.037, 0.89]], S(12)), { slot: SLOT.SKIN, mat: 'skin', skin: neckSkin, ao: (x, y) => 0.8 + 0.2 * smooth(0.8, 0.86, y) });
  const head = { slot: SLOT.SKIN, mat: 'skin', bone: 'head' };
  add(sph(0.098, S(22), S(16), HC, HS), { ...head, ao: (x, y, z) => (y < 0.87 && z < 0.04 ? 0.88 : 1) });
  add(sph(0.0135, LS, LS2, [0, 0.916, 0.101], [0.85, 1.1, 1]), head);
  for (const s of [1, -1]) {
    add(sph(0.024, LS, LS2, [s * 0.089, 0.923, 0.002], [0.45, 1, 0.75]), head);
    add(sph(0.0118, LS, LS2, [s * 0.034, 0.935, 0.0915], [1, 1.1, 0.6]), { color: 0x1c1716, mat: 'eye', bone: 'head' });
    add(xf(new THREE.CapsuleGeometry(0.0048, 0.024, 2, 4), [s * 0.035, 0.957, 0.093], [0, 0, Math.PI / 2 - s * 0.07]), { slot: SLOT.HAIR, tint: 0.85, mat: 'hair', bone: 'head' });
    if (o.earrings) add(sph(0.007, 6, 4, [s * 0.09, 0.9, 0.006]), { color: o.earrings, mat: 'chrome', bone: 'head' });
  }
  add(xf(new THREE.TorusGeometry(0.017, 0.0036, 4, d < 1 ? 6 : 10, Math.PI * 0.62), [0, 0.899, 0.0955], [0.32, 0, Math.PI + Math.PI * 0.19]), { color: 0x9c4a45, mat: 'skin', bone: 'head' });

  // --- sculpted hair (soft clumped shapes, no sphere clusters)
  const hp = (geo, v, tint = 1) => add(geo, { slot: SLOT.HAIR, mat: 'hair', bone: 'head', v, tint, ao: (x, y) => 0.82 + 0.18 * smooth(0.88, 1.0, y) });
  const at = (x, y, z) => [HC[0] + x, HC[1] + y, HC[2] + z];
  const place = (g, tilt) => { g.rotateX(tilt); g.scale(...HS); g.translate(...HC); g.computeVertexNormals(); return g; };
  const cap = (r, th, tilt, f) => place(blob(r, S(26), S(13), (x, y, z) => {
    const t = Math.acos(Math.max(-1, Math.min(1, y))) / th;
    return (f ? f(x, y, z) : 1) * (1 - 0.05 * smooth(0.82, 1.0, t));
  }, th), tilt);
  const strands = (n, amp) => (x, y, z) => 1 + amp * Math.sin(Math.atan2(x, z) * n) * (1 - y * 0.6);
  const lumps = (fq, amp, seed = 0) => (x, y, z) => 1 + amp * (Math.sin(x * fq + seed) * Math.sin(y * fq * 0.9 + 1.7 + seed) * Math.sin(z * fq * 1.1 + 0.4) + 0.35 * Math.sin((x + z) * fq * 1.9 + seed));
  // short: side-parted cap with combed strands + soft quiff
  hp(cap(0.106, 1.34, -0.5, strands(16, 0.025)), BIT.SHORT);
  hp(xf(blob(0.056, S(12), S(8), lumps(6, 0.12, 1)), at(0.014, 0.07, 0.046), [0, 0, -0.15], [1.55, 0.6, 1.2]), BIT.SHORT);
  // bun: combed-back cap + wrapped bun
  hp(cap(0.105, 1.42, -0.42, strands(22, 0.02)), BIT.BUN);
  hp(xf(blob(0.047, S(12), S(8), (x, y, z) => 1 + 0.07 * Math.sin(Math.atan2(x, z) * 3 + y * 6)), at(0, 0.07, -0.086)), BIT.BUN);
  // ponytail: cap + tapered tail with a tie
  hp(cap(0.105, 1.42, -0.45, strands(22, 0.02)), BIT.PONY);
  hp(xf(new THREE.TorusGeometry(0.02, 0.007, 4, 10), at(0, 0.03, -0.1), [1.2, 0, 0]), BIT.PONY, 0.6);
  hp(xf(lathe([[0.004, -0.15], [0.016, -0.12], [0.03, -0.07], [0.033, -0.03], [0.022, 0.0]], S(10)), at(0, 0.03, -0.11), [0.35, 0, 0]), BIT.PONY);
  // long: full cap + sculpted back mass with strands, tapering to the shoulders
  hp(cap(0.108, 1.52, -0.5, strands(20, 0.03)), BIT.LONG);
  hp(xf(blob(0.1, S(18), S(12), (x, y, z) => (1 + 0.04 * Math.sin(Math.atan2(x, z) * 18)) * (y < 0 ? 1 - 0.18 * -y : 1)), at(0, -0.065, -0.035), null, [1.04, 1.45, 0.7]), BIT.LONG);
  // curly: voluminous cap with large soft lumps (clumps of curls)
  hp(cap(0.112, 1.46, -0.4, lumps(16, 0.07)), BIT.CURLY);
  hp(cap(0.104, 1.3, -0.25, lumps(22, 0.06, 2.3)), BIT.CURLY, 0.9);
  // buzz cut
  hp(cap(0.1, 1.48, -0.5, null), BIT.BUZZ, 0.9);
  // tall curly top-bun (Celia's signature)
  hp(xf(blob(0.066, S(16), S(12), lumps(14, 0.1, 0.7)), at(0, 0.112, -0.045), [-0.3, 0, 0], [1, 1.22, 1]), BIT.TOPBUN);
  hp(xf(new THREE.TorusGeometry(0.05, 0.009, 5, 14), at(0, 0.075, -0.03), [1.27, 0, 0]), BIT.TOPBUN, 0.55);

  // hard hat: dome + brim + ridge that follows the dome (no floating nub)
  {
    const acc = { slot: SLOT.ACC, mat: 'plastic', bone: 'head', v: BIT.HAT };
    const C = at(0, 0.024, -0.004);
    add(sph(0.113, S(22), S(9), C, [1, 0.86, 1.07], null, 0, Math.PI * 2, 0, Math.PI / 2), acc);
    add(lathe([[0.12, -0.004], [0.134, 0.0], [0.133, 0.008], [0.112, 0.01]], S(22)).scale(1, 1, 1.12).translate(C[0], C[1], C[2] + 0.012), acc);
    const ridge = new THREE.TorusGeometry(0.113, 0.011, 5, S(16), Math.PI * 0.7); ridge.rotateZ(Math.PI * 0.15); ridge.rotateY(Math.PI / 2); ridge.scale(1, 0.86, 1.07); ridge.translate(...C);
    add(ridge, acc);
    add(cyl(0.114, 0.114, 0.012, S(20), [C[0], C[1] + 0.01, C[2]], null, [1, 1, 1.07], true), { color: 0x2b2b30, mat: 'rubber', bone: 'head', v: BIT.HAT });
  }
  // glasses (frames)
  {
    const gp = { color: o.glassesColor ?? 0x2a2530, mat: 'plastic', bone: 'head', v: BIT.GLASSES };
    for (const s of [1, -1]) {
      add(xf(new THREE.TorusGeometry(0.022, 0.0042, 5, S(14)), [s * 0.036, 0.936, 0.1]), gp);
      add(rod([s * 0.057, 0.938, 0.096], [s * 0.088, 0.934, 0.01], 0.003, 0.003, 4), gp);
    }
    add(rod([-0.014, 0.94, 0.103], [0.014, 0.94, 0.103], 0.003, 0.003, 4), gp);
  }
  // safety goggles
  add(cyl(0.104, 0.104, 0.036, S(16), at(0, 0.008, 0), null, HS, true, -0.98, 1.96), { color: 0x3b8fb0, mat: 'glass', bone: 'head', v: BIT.GOGGLES });
  add(cyl(0.104, 0.104, 0.012, S(16), at(0, 0.01, 0), null, HS, true, 0.98, Math.PI * 2 - 1.96), { color: 0x2b2b30, mat: 'rubber', bone: 'head', v: BIT.GOGGLES });
  return P;
}

/** One continuous sleeve (shoulder → cuff, blended at the elbow) + sculpted hand, in figure space. */
function armPieces(o, side, d = 1) {
  const S = (n) => Math.max(4, Math.round(n * d));
  const sx = side === 'L' ? 1 : -1;
  const ox = RIG.arm[0] * sx, oy = RIG.arm[1];
  const jacket = o.outfit === 'jacket';
  const sleeve = jacket ? { color: o.jacket ?? 0x1aa6a0, mat: 'coat' } : { slot: SLOT.COAT, mat: 'coat' };
  const sk = armSkin(side);
  const T = (g) => g.translate(ox, oy, 0);
  const P = [];
  const pit = (x, y) => { const ly = y - oy, inner = (x - ox) * sx < -0.015; return (inner && ly > -0.09 ? 0.86 : 1) * (ly < -0.27 ? 0.93 : 1); };
  P.push({ geo: T(lathe([[0.041, -0.296], [0.04, -0.284], [0.036, -0.27], [0.036, -0.215], [0.04, -0.17], [0.039, -0.125], [0.043, -0.05], [0.046, -0.005], [0.043, 0.018], [0.03, 0.033], [0.0, 0.038]], S(12))), ...sleeve, skin: sk, ao: pit });
  if (jacket) P.push({ geo: T(xf(new THREE.TorusGeometry(0.037, 0.008, 5, S(12)), [0, -0.289, 0], [Math.PI / 2, 0, 0])), color: o.jacketAccent ?? 0xff6f5e, mat: 'cloth', bone: 'fore' + side });
  else P.push({ geo: T(xf(new THREE.TorusGeometry(0.039, 0.0065, 5, S(12)), [0, -0.29, 0], [Math.PI / 2, 0, 0])), ...sleeve, tint: 0.94, bone: 'fore' + side });
  // hand: wrist, palm, mitten fingers curled slightly inward, thumb
  const hand = { slot: SLOT.SKIN, mat: 'skin', bone: 'fore' + side };
  P.push({ geo: T(cyl(0.021, 0.023, 0.03, 8, [0, -0.302, 0])), ...hand });
  P.push({ geo: T(sph(0.03, S(10), S(8), [0, -0.33, 0.002], [0.6, 1.0, 0.92])), ...hand });
  P.push({ geo: T(xf(sph(0.028, S(10), S(8), [0, 0, 0], [0.5, 1.05, 0.88]), [-sx * 0.004, -0.358, 0.004], [0, 0, sx * 0.2])), ...hand });
  P.push({ geo: T(xf(new THREE.CapsuleGeometry(0.0095, 0.022, 3, 6), [-sx * 0.006, -0.334, 0.028], [0.75, 0, -sx * 0.25])), ...hand });
  if (side === 'L') {
    // props carried in the left hand (positioned for the "hold" pose: close to the chest)
    const fy = RIG.fore[1];
    const hold = (geo) => xf(geo, [0, 0, 0], [-0.4, 0, 0]).translate(ox + 0.0, fy - 0.17, 0.035);
    const add = (geo, color, mat, v) => P.push({ geo: hold(geo), color, mat, v, bone: 'foreL' });
    add(rbox(0.11, 0.15, 0.01, 0.006, [0, 0, 0]), 0x8a5a33, 'plastic', BIT.CLIPBOARD);
    add(rbox(0.094, 0.12, 0.004, 0.002, [0, 0.008, 0.006]), 0xf7f5ee, 'card', BIT.CLIPBOARD);
    add(rbox(0.04, 0.014, 0.014, 0.004, [0, -0.072, 0.008]), 0xc8ccd2, 'chrome', BIT.CLIPBOARD);
    add(xf(new THREE.BoxGeometry(0.07, 0.006, 0.003), [0, 0.02, 0.009]), 0x6f86b0, 'card', BIT.CLIPBOARD);
    add(xf(new THREE.BoxGeometry(0.06, 0.006, 0.003), [0, -0.005, 0.009]), 0x6f86b0, 'card', BIT.CLIPBOARD);
    add(rbox(0.105, 0.145, 0.01, 0.008, [0, 0, 0]), 0x1c2230, 'plastic', BIT.TABLET);
    add(xf(new THREE.BoxGeometry(0.09, 0.126, 0.002), [0, 0, 0.0055]), 0x3fb8ff, 'screen', BIT.TABLET);
    add(xf(new THREE.BoxGeometry(0.07, 0.014, 0.002), [0, -0.04, 0.0068]), 0xbff0ff, 'screen', BIT.TABLET);
    add(xf(new THREE.BoxGeometry(0.032, 0.05, 0.002), [-0.02, 0.01, 0.0068]), 0xffd06a, 'screen', BIT.TABLET);
    add(xf(new THREE.BoxGeometry(0.032, 0.05, 0.002), [0.02, 0.01, 0.0068]), 0xc08bff, 'screen', BIT.TABLET);
    // sample flask (glowing liquid)
    const fl = (geo) => geo.translate(ox - 0.002, fy - 0.17, 0.02);
    P.push({ geo: fl(lathe([[0.0, -0.035], [0.024, -0.034], [0.026, -0.02], [0.012, 0.01], [0.009, 0.03], [0.01, 0.034]], 10)), color: 0xdff4ff, mat: 'glass', v: BIT.FLASK, bone: 'foreL' });
    P.push({ geo: fl(lathe([[0.0, -0.031], [0.021, -0.03], [0.022, -0.02], [0.012, -0.004], [0.0, -0.004]], 10)), color: 0x6fe08a, mat: 'liquid', v: BIT.FLASK, bone: 'foreL' });
  }
  return P;
}

/** One continuous trouser leg (hip → hem, blended at hip and knee) + shoe, in figure space. */
function legPieces(o, side, d = 1) {
  const S = (n) => Math.max(4, Math.round(n * d));
  const sx = side === 'L' ? 1 : -1, ox = RIG.thigh[0] * sx;
  const hem = o.outfit === 'jacket' ? 0.47 : (o.coatHem ?? 0.27);
  const T = (g) => g.translate(ox, 0, 0);
  const shin = 'shin' + side;
  const shoe = o.shoes !== undefined ? { color: o.shoes } : { slot: SLOT.SHOE };
  const P = [
    { geo: T(lathe([[0.042, 0.05], [0.043, 0.075], [0.041, 0.12], [0.044, 0.2], [0.047, 0.262], [0.05, 0.33], [0.054, 0.4], [0.058, 0.46], [0.059, 0.5], [0.05, 0.55]], S(12))), slot: SLOT.PANTS, mat: 'cloth', skin: legSkin(side), ao: (x, y, z) => (y > hem ? 0.72 : 1) * ((x - ox) * sx < -0.02 && y > 0.36 ? 0.85 : 1) },
    { geo: T(xf(new THREE.TorusGeometry(0.042, 0.006, 4, S(12)), [0, 0.06, 0], [Math.PI / 2, 0, 0])), slot: SLOT.PANTS, tint: 0.85, mat: 'cloth', bone: shin },
    { geo: T(sph(0.05, S(12), S(8), [0, 0.04, 0.03], [0.86, 0.62, 1.55])), ...shoe, mat: 'shoe', bone: shin },
    { geo: T(rbox(0.08, 0.02, 0.15, 0.009, [0, 0.01, 0.03], null, d < 1 ? 1 : 2)), color: o.sole ?? 0x1a1614, mat: 'rubber', bone: shin },
  ];
  if (o.sneakers) P.push({ geo: T(rbox(0.03, 0.012, 0.05, 0.005, [0, 0.057, 0.075], [0.5, 0, 0])), color: o.sneakers, mat: 'plastic', bone: shin });
  return P;
}

/** Every piece of a figure (figure space, skinned to BONES). */
export function figurePieces(o, d = 1) {
  return [
    ...bodyPieces(o, d),
    ...armPieces(o, 'L', d), ...armPieces(o, 'R', d),
    ...legPieces(o, 'L', d), ...legPieces(o, 'R', d),
  ];
}

/** Crowd body geometry: all variants, colour slots unresolved, GPU-skin attributes. */
export function buildCrowdGeometry(o = {}) {
  const g = bakePieces(figurePieces({ outfit: 'coat', ...o }, o.detail ?? 0.55), { crowd: true, skin: 'crowd' });
  g.deleteAttribute('uv');
  return g;
}

/**
 * Low-poly crowd LOD (≈750 tris): same skeleton, skin weights, colour slots and variant bits as the full figure.
 * Hair is one cap (HAIRLOW bit = "has hair and no hat").
 */
export function buildCrowdLowGeometry() {
  const P = [];
  const add = (geo, p) => P.push({ geo, ...p });
  const hem = 0.27, sk = skirtSkin(hem);
  const coatSkin = (x, y, z) => (y >= 0.6 ? ['chest', 'hips', smooth(0.56, 0.64, y)] : sk(x, y, z));
  add(lathe([[0.172, 0.27], [0.15, 0.36], [0.126, 0.46], [0.115, 0.55], [0.124, 0.65], [0.134, 0.74], [0.122, 0.79], [0.085, 0.82], [0.04, 0.84]], 8, 0.8),
    { slot: SLOT.COAT, mat: 'coat', skin: coatSkin, ao: (x, y) => { const t = smooth(hem + 0.18, hem, y); return [1 - 0.1 * t, 1 - 0.075 * t, 1 - 0.025 * t]; } });
  add(shell((u) => { const y = 0.81 - u * 0.15; const g = 0.5 * smooth(0.64, 0.81, y) + 0.06; return { y, r: lut(COAT_R, y) + 0.004, a0: -g / 2, a1: g / 2 }; }, 3, 2, 0.8), { slot: SLOT.SHIRT, mat: 'cloth', bone: 'chest' });
  add(sph(0.098, 8, 6, HC, HS), { slot: SLOT.SKIN, mat: 'skin', bone: 'head' });
  add(cyl(0.036, 0.04, 0.08, 5, [0, 0.83, 0], null, null, true), { slot: SLOT.SKIN, mat: 'skin', skin: (x, y) => ['head', 'chest', smooth(0.805, 0.85, y)] });
  add(xf(new THREE.SphereGeometry(0.106, 8, 4, 0, Math.PI * 2, 0, 1.42), [0, 0, 0], [-0.45, 0, 0]).scale(...HS).translate(...HC), { slot: SLOT.HAIR, mat: 'hair', bone: 'head', v: BIT.HAIRLOW });
  add(sph(0.115, 8, 3, [HC[0], HC[1] + 0.024, HC[2]], [1, 0.86, 1.07], null, 0, Math.PI * 2, 0, Math.PI / 2), { slot: SLOT.ACC, mat: 'plastic', bone: 'head', v: BIT.HAT });
  add(cyl(0.13, 0.13, 0.012, 8, [HC[0], HC[1] + 0.028, HC[2] + 0.012], null, [1, 1, 1.12]), { slot: SLOT.ACC, mat: 'plastic', bone: 'head', v: BIT.HAT });
  for (const side of ['L', 'R']) {
    const sx = side === 'L' ? 1 : -1, ax = RIG.arm[0] * sx, ay = RIG.arm[1], lx = RIG.thigh[0] * sx;
    add(lathe([[0.039, -0.3], [0.037, -0.21], [0.041, -0.12], [0.046, -0.01], [0.03, 0.03], [0.0, 0.04]], 6).translate(ax, ay, 0), { slot: SLOT.COAT, mat: 'coat', skin: armSkin(side) });
    add(sph(0.032, 5, 4, [ax, ay - 0.335, 0.004], [0.62, 1.15, 0.9]), { slot: SLOT.SKIN, mat: 'skin', bone: 'fore' + side });
    add(lathe([[0.042, 0.05], [0.046, 0.26], [0.056, 0.45], [0.05, 0.55]], 6).translate(lx, 0, 0), { slot: SLOT.PANTS, mat: 'cloth', skin: legSkin(side) });
    add(sph(0.05, 6, 4, [lx, 0.035, 0.03], [0.86, 0.62, 1.55]), { slot: SLOT.SHOE, mat: 'shoe', bone: 'shin' + side });
  }
  const fy = RIG.fore[1], ox = RIG.arm[0];
  const hold = (geo) => xf(geo, [0, 0, 0], [-0.4, 0, 0]).translate(ox, fy - 0.17, 0.035);
  add(hold(new THREE.BoxGeometry(0.11, 0.15, 0.012)), { color: 0x8a5a33, mat: 'plastic', bone: 'foreL', v: BIT.CLIPBOARD });
  add(hold(new THREE.BoxGeometry(0.105, 0.145, 0.012)), { color: 0x2a5070, mat: 'screen', bone: 'foreL', v: BIT.TABLET });
  add(sph(0.026, 5, 4, [ox, fy - 0.19, 0.02]), { color: 0x6fe08a, mat: 'liquid', bone: 'foreL', v: BIT.FLASK });
  const g = bakePieces(P, { crowd: true, skin: 'crowd' });
  g.deleteAttribute('uv');
  return g;
}

// ---------------------------------------------------------------------------------------------
// Procedural animation
// ---------------------------------------------------------------------------------------------

/** Pose channels. Arms are stored symmetric: abd = away from body, inn = yaw toward the midline. */
export const CH = {
  bob: 0, hYaw: 1, hRoll: 2, hX: 3, lean: 4, cYaw: 5, cRoll: 6, nX: 7, nY: 8, nZ: 9,
  lHX: 10, lHZ: 11, lK: 12, rHX: 13, rHZ: 14, rK: 15,
  lSX: 16, lAbd: 17, lIn: 18, lE: 19, rSX: 20, rAbd: 21, rIn: 22, rE: 23, breath: 24, lTw: 25, rTw: 26,
};
export const NCH = 27;
export const STATES = ['idle', 'walk', 'run', 'work', 'wave', 'talk', 'point'];
/** Idle styles (crowd variety): relaxed, hands in coat pockets, arms crossed. */
export const IDLE_STYLES = 3;

function base(o) {
  o.fill(0);
  o[CH.lAbd] = o[CH.rAbd] = 0.1; o[CH.lE] = o[CH.rE] = -0.2; o[CH.lSX] = o[CH.rSX] = 0.04;
  o[CH.lIn] = o[CH.rIn] = -0.05;
  o[CH.lK] = o[CH.rK] = 0.03; o[CH.lean] = 0.02;
  return o;
}
function idleLayer(o, t, s, amt = 1, style = 0) {
  const b = Math.sin(t * 1.55 + s * 7), ws = Math.sin(t * 0.42 + s * 3) + 0.35 * Math.sin(t * 0.93 + s);
  o[CH.breath] += b * amt;
  o[CH.hRoll] += 0.03 * ws * amt; o[CH.hX] += 0.006 * ws * amt; o[CH.cRoll] -= 0.036 * ws * amt;
  o[CH.lHZ] -= 0.03 * ws * amt; o[CH.rHZ] -= 0.03 * ws * amt;
  o[CH.lK] += 0.12 * Math.max(0, -ws) * amt; o[CH.rK] += 0.12 * Math.max(0, ws) * amt;
  o[CH.lean] += 0.012 * b * amt;
  o[CH.nY] += 0.24 * Math.sin(t * 0.21 + s * 5) * Math.sin(t * 0.13 + s) * amt;
  o[CH.nX] += 0.05 * Math.sin(t * 0.29 + s * 2) * amt;
  if (style === 1) { // hands in coat pockets
    o[CH.lSX] = o[CH.rSX] = 0.12; o[CH.lAbd] = o[CH.rAbd] = 0.24; o[CH.lIn] = o[CH.rIn] = 0.18; o[CH.lE] = o[CH.rE] = -0.42;
  } else if (style === 2) { // arms crossed
    o[CH.lSX] = o[CH.rSX] = -0.28; o[CH.lAbd] = o[CH.rAbd] = 0.2; o[CH.lIn] = o[CH.rIn] = 0.62; o[CH.lE] = -1.95; o[CH.rE] = -1.75;
  } else {
    o[CH.lAbd] += 0.015 * b * amt; o[CH.rAbd] += 0.015 * b * amt;
    o[CH.lSX] += 0.04 * Math.sin(t * 0.5 + s) * amt; o[CH.rSX] += 0.04 * Math.sin(t * 0.47 + s * 2) * amt;
    o[CH.lE] -= 0.06 * Math.max(0, ws) * amt; o[CH.rE] -= 0.06 * Math.max(0, -ws) * amt;
  }
}

/** Write the pose of `state` into o (Float32Array(NCH)). p = gait phase, s = per-figure seed, style = idle style. */
export function poseOf(state, o, t, p, s, style = 0) {
  base(o);
  switch (state) {
    case 'walk': case 'run': {
      const run = state === 'run';
      const sn = Math.sin(p), cs = Math.cos(p);
      const A = run ? 0.72 : 0.42;
      o[CH.lHX] = -A * sn; o[CH.rHX] = A * sn;
      const kb = run ? 0.32 : 0.06, kg = run ? 1.45 : 0.72;
      o[CH.lK] = kb + kg * Math.pow(Math.max(0, cs), run ? 1.2 : 1.6);
      o[CH.rK] = kb + kg * Math.pow(Math.max(0, -cs), run ? 1.2 : 1.6);
      o[CH.lK] += 0.12 * Math.max(0, -sn) * Math.max(0, cs + 0.3);
      o[CH.rK] += 0.12 * Math.max(0, sn) * Math.max(0, -cs + 0.3);
      const aA = run ? 0.68 : 0.34;
      o[CH.lSX] = aA * sn; o[CH.rSX] = -aA * sn;
      o[CH.lE] = run ? -1.45 + 0.2 * sn : -0.26 - 0.22 * Math.max(0, -sn);
      o[CH.rE] = run ? -1.45 - 0.2 * sn : -0.26 - 0.22 * Math.max(0, sn);
      o[CH.lAbd] = o[CH.rAbd] = run ? 0.2 : 0.1;
      o[CH.lIn] = o[CH.rIn] = run ? 0.25 : 0.02;
      o[CH.hYaw] = -(run ? 0.16 : 0.1) * sn; o[CH.cYaw] = (run ? 0.22 : 0.14) * sn; o[CH.nY] = -0.05 * sn;
      o[CH.hRoll] = 0.03 * Math.sin(p * 2 + 1.2) * (run ? 0.5 : 1);
      o[CH.lean] = run ? 0.24 : 0.06; o[CH.nX] = run ? -0.14 : -0.03;
      o[CH.bob] = run ? 0.045 * Math.max(0, Math.cos(2 * p)) : 0.006 * Math.cos(2 * p);
      o[CH.breath] = Math.sin(t * (run ? 5 : 2.5));
      break;
    }
    case 'work': {
      idleLayer(o, t, s, 0.35);
      o[CH.lean] = 0.14; o[CH.nX] = 0.32 + 0.04 * Math.sin(t * 0.7 + s);
      o[CH.nY] += 0.15 * Math.sin(t * 0.6 + s * 3);
      o[CH.lSX] = -0.62 + 0.13 * Math.sin(t * 2.3 + s); o[CH.rSX] = -0.62 + 0.13 * Math.sin(t * 2.9 + s + 1.3);
      o[CH.lE] = -0.95 + 0.18 * Math.sin(t * 3.1 + s + 0.5); o[CH.rE] = -0.95 + 0.18 * Math.sin(t * 2.7 + s + 2.1);
      o[CH.lIn] = 0.3 + 0.12 * Math.sin(t * 1.7 + s); o[CH.rIn] = 0.3 + 0.12 * Math.sin(t * 1.4 + s + 2);
      o[CH.lAbd] = o[CH.rAbd] = 0.2;
      break;
    }
    case 'wave': {
      idleLayer(o, t, s, 0.6);
      const wv = Math.sin(t * 8.5);
      o[CH.rSX] = -0.3; o[CH.rAbd] = 1.85 + 0.1 * wv; o[CH.rIn] = -0.1; o[CH.rTw] = 1.5; o[CH.rE] = -1.45 - 0.38 * wv;
      o[CH.nZ] = 0.12; o[CH.nX] = -0.08; o[CH.cRoll] += 0.07; o[CH.lean] = -0.03; o[CH.hRoll] -= 0.03;
      break;
    }
    case 'talk': {
      idleLayer(o, t, s, 0.8, style === 2 ? 0 : style);
      const g1 = Math.sin(t * 1.7 + s), g2 = Math.sin(t * 2.3 + s * 2), g3 = Math.sin(t * 1.3 + s * 3);
      o[CH.rSX] = -0.3 + 0.18 * g3; o[CH.rE] = -1.0 + 0.3 * Math.sin(t * 2.1 + s + 1); o[CH.rAbd] = 0.22 + 0.08 * g1; o[CH.rIn] = 0.15; o[CH.rTw] = 0.3;
      if (style !== 1) { o[CH.lSX] = -0.08 + 0.1 * g1 * Math.max(0, g2); o[CH.lE] = -0.35 - 0.4 * Math.max(0, g2); o[CH.lAbd] = 0.14; }
      o[CH.nX] += 0.06 * Math.sin(t * 3.2 + s); o[CH.nZ] = 0.05 * g3; o[CH.cYaw] = 0.06 * g1;
      break;
    }
    case 'point': {
      idleLayer(o, t, s, 0.4);
      o[CH.rSX] = -1.42; o[CH.rAbd] = 0.38; o[CH.rIn] = -0.15; o[CH.rE] = -0.06;
      o[CH.cYaw] = -0.12; o[CH.nY] = -0.32; o[CH.nX] = -0.04; o[CH.lean] = 0.04;
      break;
    }
    default: idleLayer(o, t, s, 1, style);
  }
  return o;
}

/** Left-hand carry (clipboard / tablet / flask held close to the chest), applied with weight w. */
export function applyHold(o, w) {
  if (w <= 0) return;
  o[CH.lSX] += (-0.18 - o[CH.lSX]) * w; o[CH.lAbd] += (0.16 - o[CH.lAbd]) * w;
  o[CH.lIn] += (0.75 - o[CH.lIn]) * w; o[CH.lE] += (-1.55 - o[CH.lE]) * w; o[CH.lTw] += (0 - o[CH.lTw]) * w;
}

/** Plant the lowest foot on the floor: returns the hip drop for these leg angles. */
export function groundBob(o) {
  const rl = LEG_T * Math.cos(o[CH.lHX]) + LEG_S * Math.cos(o[CH.lHX] + o[CH.lK]);
  const rr = LEG_T * Math.cos(o[CH.rHX]) + LEG_S * Math.cos(o[CH.rHX] + o[CH.rK]);
  return Math.max(rl, rr) - (LEG_T + LEG_S);
}

/** Stride length per gait cycle (2π phase) for a walk/run mix. */
export const stride = (runMix) => 0.82 + (1.4 - 0.82) * runMix;

const _e2 = new THREE.Euler(), _M = Array.from({ length: 11 }, () => new THREE.Matrix4()), _A = new THREE.Matrix4(), _vv = new THREE.Vector3();
/**
 * Pose → skin matrices (figure space, bone world × inverse rest) written into out[offset + b*16].
 */
export function poseSkinMatrices(p, out, offset = 0) {
  const rot = (x, y, z, order) => { _e2.set(x, y, z, order); return _A.makeRotationFromEuler(_e2); };
  const [H, C, Hd, TL, SL, TR, SR, AL, FL, AR, FR] = _M;
  H.copy(rot(0, p[CH.hYaw], p[CH.hRoll], 'YXZ')).setPosition(p[CH.hX], RIG.hips[1] + p[CH.bob], 0);
  C.multiplyMatrices(H, rot(p[CH.lean], p[CH.cYaw], p[CH.cRoll], 'YXZ').setPosition(0, RIG.chest[1] - RIG.hips[1], 0));
  Hd.multiplyMatrices(C, rot(p[CH.nX] - p[CH.lean] * 0.5, p[CH.nY], p[CH.nZ], 'YXZ').setPosition(0, RIG.head[1] - RIG.chest[1], 0));
  TL.multiplyMatrices(H, rot(p[CH.lHX], 0, p[CH.lHZ], 'XYZ').setPosition(RIG.thigh[0], RIG.thigh[1] - RIG.hips[1], 0));
  SL.multiplyMatrices(TL, rot(p[CH.lK], 0, 0, 'XYZ').setPosition(0, RIG.shin[1] - RIG.thigh[1], 0));
  TR.multiplyMatrices(H, rot(p[CH.rHX], 0, p[CH.rHZ], 'XYZ').setPosition(-RIG.thigh[0], RIG.thigh[1] - RIG.hips[1], 0));
  SR.multiplyMatrices(TR, rot(p[CH.rK], 0, 0, 'XYZ').setPosition(0, RIG.shin[1] - RIG.thigh[1], 0));
  AL.multiplyMatrices(C, rot(p[CH.lSX], -p[CH.lIn], p[CH.lAbd], 'YZX').setPosition(RIG.arm[0], RIG.arm[1] - RIG.chest[1], 0));
  FL.multiplyMatrices(AL, rot(p[CH.lE], p[CH.lTw], 0, 'YXZ').setPosition(0, RIG.fore[1] - RIG.arm[1], 0));
  AR.multiplyMatrices(C, rot(p[CH.rSX], p[CH.rIn], -p[CH.rAbd], 'YZX').setPosition(-RIG.arm[0], RIG.arm[1] - RIG.chest[1], 0));
  FR.multiplyMatrices(AR, rot(p[CH.rE], -p[CH.rTw], 0, 'YXZ').setPosition(0, RIG.fore[1] - RIG.arm[1], 0));
  for (let b = 0; b < 11; b++) {
    const r = REST[b]; _A.makeTranslation(-r[0], -r[1], -r[2]);
    _A.premultiply(_M[b]);
    const e = _A.elements, k = offset + b * 16;
    for (let i = 0; i < 16; i++) out[k + i] = e[i];
  }
}

// ---------------------------------------------------------------------------------------------
// Hero figures (SkinnedMesh, 2 draw calls)
// ---------------------------------------------------------------------------------------------

let _skinHero = null;
function heroSkin() {
  if (!_skinHero) {
    _skinHero = paintMaterial({ key: 'heroSkin', side: THREE.FrontSide });
    organic(_skinHero, { rim: 0xffd9c4, rimPower: 3.0, rimStrength: 0.12, sss: 0xff9a7a, sssStrength: 0.05, wrap: 0.3 });
    _skinHero.customProgramCacheKey = () => 'lifeSkinHero2';
  }
  return _skinHero;
}
const _paintHero = new Map();
function heroPaint(rim) {
  const k = rim ? `${rim.color}:${rim.strength}` : 'none';
  if (!_paintHero.has(k)) _paintHero.set(k, paintMaterial({ key: 'hero', rim }));
  return _paintHero.get(k);
}

const DEFAULTS = {
  outfit: 'coat', skin: 0xeec3a5, hair: 0x3d2a1e, hairStyle: 'short', coat: 0xf4f4f0, shirt: 0x6fa8dc, pants: 0x2e3a55,
  shoes: 0x2b2420, accent: 0xf2c12e, hat: false, glasses: false, goggles: false, clipboard: false, tablet: false, flask: false, pen: true,
  hold: null, scale: 1, build: 1, detail: 1.6, seed: 0.37, idleStyle: 0, rim: null,
};

/**
 * createFigure(opts) → THREE.Group with a skinned body and `animate(state, t, dt, {speed})`.
 * opts: outfit 'coat'|'jacket', skin, hair, hairStyle ('short'|'bun'|'pony'|'long'|'curly'|'buzz'|'curlyTopBun'|'none'),
 *       coat, shirt, pants, shoes, sole, sneakers, accent (hard-hat colour), hat, glasses, glassesColor, goggles,
 *       clipboard, tablet, flask, hold ('left' carries the item close to the chest), backpack, lanyard, jacket, jacketAccent,
 *       coatHem, badge, scarf, earrings, scale, build (girth), detail, seed, idleStyle, rim {color, strength}, name.
 */
export function createFigure(opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  const colors = { [SLOT.SKIN]: o.skin, [SLOT.HAIR]: o.hair, [SLOT.ACC]: o.accent, [SLOT.PANTS]: o.pants, [SLOT.SHIRT]: o.shirt, [SLOT.COAT]: o.coat, [SLOT.SHOE]: o.shoes };
  let mask = 0;
  const hs = { short: [BIT.SHORT], bun: [BIT.BUN], pony: [BIT.PONY], long: [BIT.LONG], curly: [BIT.CURLY], buzz: [BIT.BUZZ], curlyTopBun: [BIT.CURLY, BIT.TOPBUN], none: [] }[o.hairStyle] || [BIT.SHORT];
  for (const b of hs) mask |= 1 << b;
  if (o.hat) mask |= 1 << BIT.HAT;
  if (o.glasses) mask |= 1 << BIT.GLASSES;
  if (o.goggles) mask |= 1 << BIT.GOGGLES;
  if (o.pen) mask |= 1 << BIT.PEN;
  if (o.clipboard) mask |= 1 << BIT.CLIPBOARD;
  if (o.tablet) mask |= 1 << BIT.TABLET;
  if (o.flask) mask |= 1 << BIT.FLASK;

  const g = new THREE.Group(); g.name = o.name || 'figure';
  const inner = new THREE.Group(); inner.scale.set(o.scale * o.build, o.scale, o.scale * o.build); g.add(inner);
  const J = {}, bones = [];
  const mk = (name, parent) => {
    const j = new THREE.Bone(); j.name = name;
    const r = REST[BONE[name]], pr = parent.isBone ? REST[BONE[parent.name]] : [0, 0, 0];
    j.position.set(r[0] - pr[0], r[1] - pr[1], r[2] - pr[2]);
    parent.add(j); J[name] = j; bones[BONE[name]] = j; return j;
  };
  mk('hips', inner); mk('chest', J.hips); mk('head', J.chest);
  for (const s of ['L', 'R']) { mk('thigh' + s, J.hips); mk('shin' + s, J['thigh' + s]); mk('arm' + s, J.chest); mk('fore' + s, J['arm' + s]); }
  J.hips.rotation.order = J.chest.rotation.order = J.head.rotation.order = 'YXZ';
  for (const s of ['L', 'R']) { J['arm' + s].rotation.order = 'YZX'; J['fore' + s].rotation.order = 'YXZ'; }

  const pieces = figurePieces(o, o.detail);
  inner.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  const paint = heroPaint(o.rim);
  for (const [list, mat] of [[pieces.filter((p) => p.mat !== 'skin'), paint], [pieces.filter((p) => p.mat === 'skin'), heroSkin()]]) {
    const geo = bakePieces(list, { colors, mask, skin: 'standard' });
    if (!geo) continue;
    const mesh = new THREE.SkinnedMesh(geo, mat); mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
    inner.add(mesh); mesh.bind(skeleton);
  }

  const W = new Float32Array(STATES.length); W[0] = 1;
  const pose = new Float32Array(NCH), tmp = new Float32Array(NCH);
  let phase = 0, cur = 'idle';
  const holdW = { v: o.hold ? 1 : 0 };
  const seed = o.seed * 10;

  function apply(P) {
    J.hips.position.set(P[CH.hX], RIG.hips[1] + P[CH.bob], 0);
    J.hips.rotation.set(0, P[CH.hYaw], P[CH.hRoll]);
    J.chest.rotation.set(P[CH.lean], P[CH.cYaw], P[CH.cRoll]);
    J.head.rotation.set(P[CH.nX] - P[CH.lean] * 0.5, P[CH.nY], P[CH.nZ]);
    J.thighL.rotation.set(P[CH.lHX], 0, P[CH.lHZ]); J.shinL.rotation.x = P[CH.lK];
    J.thighR.rotation.set(P[CH.rHX], 0, P[CH.rHZ]); J.shinR.rotation.x = P[CH.rK];
    J.armL.rotation.set(P[CH.lSX], -P[CH.lIn], P[CH.lAbd]); J.foreL.rotation.set(P[CH.lE], P[CH.lTw], 0);
    J.armR.rotation.set(P[CH.rSX], P[CH.rIn], -P[CH.rAbd]); J.foreR.rotation.set(P[CH.rE], -P[CH.rTw], 0);
  }

  /** animate(state, t, dt, {speed}) — blends smoothly (≈0.25s) toward `state`; speed (u/s) drives the gait. */
  g.animate = (state = cur, t = 0, dt = 1 / 60, params = {}) => {
    cur = state;
    const ti = Math.max(0, STATES.indexOf(state));
    const k = 1 - Math.exp(-dt * (params.blend ?? 8));
    let sum = 0;
    for (let i = 0; i < W.length; i++) { W[i] += ((i === ti ? 1 : 0) - W[i]) * k; sum += W[i]; }
    const wWalk = W[1], wRun = W[2], loco = wWalk + wRun;
    const runMix = loco > 1e-3 ? wRun / loco : 0;
    const speed = params.speed || (1.25 * (1 - runMix) + 3.0 * runMix);
    phase += dt * Math.PI * 2 * speed / stride(runMix) * (loco > 0.02 ? 1 : 0);
    pose.fill(0);
    for (let i = 0; i < W.length; i++) {
      if (W[i] < 1e-3) continue;
      poseOf(STATES[i], tmp, t, phase, seed, o.idleStyle);
      const w = W[i] / sum;
      for (let c = 0; c < NCH; c++) pose[c] += tmp[c] * w;
    }
    if (o.hold) {
      const target = (state === 'wave' || state === 'point' || state === 'talk' || state === 'idle') ? 1 : state === 'work' ? 0.3 : state === 'run' ? 0.7 : 0.9;
      holdW.v += (target - holdW.v) * k;
      applyHold(pose, holdW.v);
    }
    pose[CH.bob] += groundBob(pose);
    apply(pose);
  };
  g.setState = (s) => { cur = s; };
  g.userData.joints = J;
  g.userData.opts = o;
  g.userData.update = (t, dt) => g.animate(cur, t, dt);
  g.animate('idle', 0, 1);
  return g;
}

/** The player: a visitor in a teal zip jacket with coral accents, lanyard badge and backpack. */
export function createPlayer(opts = {}) {
  return createFigure({
    name: 'player', outfit: 'jacket', jacket: 0x14a39c, jacketAccent: 0xff6a55, shirt: 0xf3efe6,
    skin: 0xebc2a4, hair: 0x4a2e1f, hairStyle: 'short', pants: 0x34507e, shoes: 0xf4f2ee, sole: 0xe8e2d8, sneakers: 0xff6a55,
    backpack: 0x2f3a5a, lanyard: 0xff6a55, pen: false, seed: 0.81, ...opts,
  });
}

/** Dr. Celia Mendel: long white coat over violet, violet scarf, tall curly top-bun, plum glasses, glowing tablet. */
export function createGuide(opts = {}) {
  return createFigure({
    name: 'guide', outfit: 'coat', coat: 0xf8f8f5, shirt: 0x7a4fc4, skin: 0xc99474, hair: 0x241815, hairStyle: 'curlyTopBun',
    glasses: true, glassesColor: 0x6a2f8a, tablet: true, hold: 'left', pants: 0x2c2838, shoes: 0x4a2238, sole: 0x221418,
    coatHem: 0.19, badge: 0x8e4fd0, scarf: 0x8e4fd0, earrings: 0xe9c46a, scale: 1.05, pen: true, seed: 0.23,
    rim: { color: 0xc9a8ff, strength: 0.22 }, ...opts,
  });
}

/**
 * Seated driver (upper body + arms reaching forward to a wheel), resolved to baked colours, origin at the seat
 * (hip point), facing +Z. Used inside vehicle cabs (merged into the vehicle geometry → no extra draw calls).
 */
export function seatedDriverPieces(opts = {}) {
  const o = { outfit: 'coat', skin: 0xe2ae8a, hair: 0x2b1e17, coat: 0xf6f6f2, shirt: 0x5aa0d8, accent: 0xf2c12e, pants: 0x2e3a55, hat: true, reach: 1.15, ...opts };
  const colors = { [SLOT.SKIN]: o.skin, [SLOT.HAIR]: o.hair, [SLOT.ACC]: o.accent, [SLOT.PANTS]: o.pants, [SLOT.SHIRT]: o.shirt, [SLOT.COAT]: o.coat, [SLOT.SHOE]: 0x2b2420 };
  const mask = (o.hat ? 1 << BIT.HAT : 0) | (1 << BIT.SHORT);
  const keep = (p) => !p.v || (mask & (1 << p.v));
  const out = [];
  const push = (p, geo) => out.push({ geo, color: p.slot ? new THREE.Color(colors[p.slot]).multiplyScalar(p.tint ?? 1).getHex() : p.color, mat: p.mat, ao: p.ao });
  for (const p of bodyPieces(o, 0.6)) {
    if (!keep(p)) continue;
    if (!(p.bone === 'chest' || p.bone === 'head' || (p.skin && p.slot === SLOT.SKIN))) continue;
    push(p, p.geo.clone().translate(0, -RIG.hips[1], 0));
  }
  for (const side of ['L', 'R']) {
    const sx = side === 'L' ? 1 : -1;
    for (const p of armPieces(o, side, 0.6)) {
      if (p.v) continue;
      const g = p.geo.clone().translate(-RIG.arm[0] * sx, -RIG.arm[1], 0);
      g.rotateX(-o.reach); g.rotateY(-sx * 0.12);
      g.translate(RIG.arm[0] * sx, RIG.arm[1] - RIG.hips[1], 0);
      push(p, g);
    }
  }
  return out;
}
