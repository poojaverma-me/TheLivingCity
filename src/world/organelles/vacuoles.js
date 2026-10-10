// Vacuoles: open cylindrical storage tanks. Brushed-steel base and rim bands frame a glass wall through
// which the turquoise water column glows with moving caustics; glossy rippling water sits just below the
// rim. Rim walkways with railings, ladders, an overhead transfer pipe, a hand-wheel valve and a hidden
// rubber duck (easter egg).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { VACUOLES } from '../layout.js';
import * as M from '../../core/materials.js';
import * as T from '../../core/textures.js';
import { mergeGeometries, instanced, trs, place } from '../../core/geom.js';
import { mulberry32 } from '../../core/noise.js';

const TAU = Math.PI * 2;
const CAM_FACE = { x: 4, z: 40 };

function clean(g) {
  if (!g.index) { const idx = []; for (let i = 0; i < g.attributes.position.count; i++) idx.push(i); g.setIndex(idx); }
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
  if (!g.attributes.normal) g.computeVertexNormals();
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  return g;
}
const lathe = (pts, seg = 72) => new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(a, b)), seg);
function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function tex(c, { srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c); t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t;
}

/** Tileable caustic network (Voronoi F2-F1 ridges): bright cyan-white filaments on black. */
function causticTexture() {
  const S = 256, N = 14, rnd = mulberry32(31);
  const P = Array.from({ length: N }, () => [rnd(), rnd()]);
  const c = makeCanvas(S, S), x = c.getContext('2d'), img = x.createImageData(S, S), d = img.data;
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const u = i / S, v = j / S; let f1 = 9, f2 = 9;
    for (const [px, py] of P) {
      let dx = Math.abs(u - px), dy = Math.abs(v - py); dx = Math.min(dx, 1 - dx); dy = Math.min(dy, 1 - dy);
      const dd = Math.hypot(dx, dy);
      if (dd < f1) { f2 = f1; f1 = dd; } else if (dd < f2) f2 = dd;
    }
    const e = Math.pow(Math.max(0, 1 - (f2 - f1) / 0.07), 2.2);
    const k = (j * S + i) * 4;
    d[k] = 120 * e + 4; d[k + 1] = 245 * e + 10; d[k + 2] = 255 * e + 14; d[k + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  return tex(c);
}

/** Tileable ripple normal map from integer-frequency sine waves. */
function rippleNormal() {
  const S = 256, rnd = mulberry32(5);
  const W = Array.from({ length: 14 }, (_, i) => ({ kx: Math.round((rnd() - 0.5) * (4 + i * 0.6)), ky: Math.round((rnd() - 0.5) * (4 + i * 0.6)), p: rnd() * TAU, a: (0.4 + rnd()) / (1 + i * 0.25) }));
  const h = (u, v) => W.reduce((s, w) => s + w.a * Math.sin(TAU * (w.kx * u + w.ky * v) + w.p), 0);
  const c = makeCanvas(S, S), x = c.getContext('2d'), img = x.createImageData(S, S), d = img.data;
  const e = 1 / S;
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const u = i / S, v = j / S;
    let nx = (h(u - e, v) - h(u + e, v)) * 2.2, ny = (h(u, v - e) - h(u, v + e)) * 2.2, nz = 1;
    const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    const k = (j * S + i) * 4;
    d[k] = (nx * 0.5 + 0.5) * 255; d[k + 1] = (ny * 0.5 + 0.5) * 255; d[k + 2] = (nz * 0.5 + 0.5) * 255; d[k + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  return tex(c, { srgb: false });
}

function gratingTexture() {
  const c = makeCanvas(64, 64), x = c.getContext('2d');
  x.fillStyle = '#5f6871'; x.fillRect(0, 0, 64, 64);
  x.fillStyle = '#aab3bc';
  for (let k = 0; k < 64; k += 16) { x.fillRect(k, 0, 5, 64); x.fillRect(0, k, 64, 3); }
  return tex(c);
}

/** Animated caustics: two scrolled samples of the ridge map multiplied/min'ed into shifting filaments. */
function causticMat(base, emissiveColor, intensity, causTex, repeat = [3, 2]) {
  const t = causTex.clone(); t.repeat.set(...repeat); t.needsUpdate = true;
  const mat = new THREE.MeshStandardMaterial({ color: base, emissive: emissiveColor, emissiveMap: t, emissiveIntensity: intensity, roughness: 0.25, side: THREE.DoubleSide });
  const u = { uTime: { value: 0 } };
  mat.userData.time = u.uTime;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = u.uTime;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <emissivemap_fragment>', `
      #ifdef USE_EMISSIVEMAP
        vec2 cu = vEmissiveMapUv;
        vec3 c1 = texture2D(emissiveMap, cu + vec2(uTime * 0.021, uTime * 0.013)).rgb;
        vec3 c2 = texture2D(emissiveMap, cu * 1.21 + vec2(-uTime * 0.017, uTime * 0.024) + 0.37).rgb;
        totalEmissiveRadiance *= min(c1, c2) * 1.6 + c1 * c2 * 0.8 + 0.06;
      #endif`);
  };
  mat.customProgramCacheKey = () => 'caustic' + intensity;
  return mat;
}

export function buildVacuoles() {
  const g = new THREE.Group(); g.name = 'vacuoles';
  const rnd = mulberry32(4242);

  const steelMat = M.satin(0xa9b3bd, { rough: 0.3, clearcoat: 0.6, metal: 0.55, normalScale: 0.3, key: 'vacSteel' });
  steelMat.roughnessMap = T.brushedRoughness();
  const bandMat = M.satin(0x5d6873, { rough: 0.35, clearcoat: 0.6, metal: 0.5, key: 'vacBand' });
  const plinthMat = M.satin(0xc7ccd3, { rough: 0.55, clearcoat: 0.25, normalScale: 0.6, key: 'vacPlinth' });
  const railMat = M.metal(0xd2d7dd, 0.25);
  const gtex = gratingTexture(); gtex.repeat.set(48, 1);
  const deckMat = new THREE.MeshStandardMaterial({ map: gtex, roughness: 0.5, metalness: 0.5 });
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xd8f6ff, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.2, clearcoat: 1, clearcoatRoughness: 0.03, depthWrite: false, envMapIntensity: 1.6 });
  const caus = causticTexture();
  const rip = rippleNormal();
  rip.repeat.set(3, 3);
  const rip2 = rip.clone(); rip2.repeat.set(5.3, 5.3); rip2.needsUpdate = true;
  const redMat = M.satin(0xd8382a, { rough: 0.35, clearcoat: 0.8, key: 'vacValve' });
  // contents: clear water (with the duck), amber nutrient syrup, murky olive waste
  const CONTENTS = [
    { key: 'water', top: 0x7ff3ff, deep: 0x0b7e9e, surf: 0x2cc6dc, emi: 0x9ff8ff, ci: 1.5, fi: 1.9, surfEmi: 0x0a7f9c, opacity: 0.72, ns: 0.3, sign: 'WATER', bg: '#1f6f86', fg: '#eafcff', bd: '#9ff0ff' },
    { key: 'nutrient', top: 0xffd36a, deep: 0xa3560c, surf: 0xf0a83a, emi: 0xffe09a, ci: 1.0, fi: 1.2, surfEmi: 0x3a1a00, opacity: 0.74, ns: 0.3, sign: 'NUTRIENTS', bg: '#9a5a10', fg: '#fff3d8', bd: '#ffd36a' },
    { key: 'waste', top: 0x8f9a44, deep: 0x2a3310, surf: 0x6a7430, emi: 0xc8d070, ci: 0.45, fi: 0.5, surfEmi: 0x1c2408, opacity: 0.95, ns: 0.11, sign: 'WASTE', bg: '#4a5220', fg: '#f0f4d0', bd: '#b8c060' },
  ];
  const CM = CONTENTS.map((c) => {
    const column = causticMat(0xffffff, c.emi, c.ci, caus, [4, 1.5]); column.vertexColors = true;
    const floor = causticMat(c.deep, c.emi, c.key === 'waste' ? c.fi * 0.4 : c.fi, caus, [1.5, 1.5]);
    const surface = new THREE.MeshPhysicalMaterial({
      color: c.surf, roughness: 0.03, metalness: 0, transparent: true, opacity: c.opacity,
      clearcoat: 1, clearcoatRoughness: 0.02, normalMap: rip, normalScale: new THREE.Vector2(c.ns, c.ns),
      clearcoatNormalMap: rip2, clearcoatNormalScale: new THREE.Vector2(c.ns * 1.15, c.ns * 1.15),
      emissive: c.surfEmi, emissiveIntensity: 0.5, envMapIntensity: 2.2, specularIntensity: 1, depthWrite: false,
    });
    // depth tint (shallow rim → deep centre) + fresnel: grazing views turn opaque & mirror-like
    const su = { uShallow: { value: new THREE.Color(c.top) }, uDeep: { value: new THREE.Color(c.deep) } };
    surface.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, su);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vDUv;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvDUv = uv;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vDUv; uniform vec3 uShallow; uniform vec3 uDeep;')
        .replace('#include <color_fragment>', '#include <color_fragment>\n{ float rr = length(vDUv - 0.5) * 2.0; diffuseColor.rgb *= mix(uDeep * 1.6, uShallow, smoothstep(0.15, 1.0, rr)); }')
        .replace('#include <opaque_fragment>', '{ float fr = pow(1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0), 3.0); diffuseColor.a = mix(diffuseColor.a, 1.0, fr * 0.85); }\n#include <opaque_fragment>');
    };
    surface.customProgramCacheKey = () => 'vacSurface';
    const meniscus = new THREE.MeshBasicMaterial({ color: new THREE.Color(c.top).multiplyScalar(2.2) });
    const st = T.signTexture(c.sign, { bg: c.bg, fg: c.fg, w: 512, h: 128, border: c.bd });
    const sign = new THREE.MeshStandardMaterial({ map: st, roughness: 0.35, emissive: 0xffffff, emissiveMap: st, emissiveIntensity: 0.3 });
    return { ...c, column, floor, surface, meniscus, sign };
  });

  const G = { steel: [], band: [], plinth: [], rail: [], deck: [], glass: [], red: [] };
  const rivets = [], posts = [];
  const anchors = {}, footprints = [];
  const tanks = [];

  VACUOLES.forEach((V, vi) => {
    const r = V.r, H = 1.6 + r * 0.14, WL = H - 0.5;
    const C = CM[vi % CM.length];
    const T0 = new THREE.Matrix4().makeTranslation(V.x, 0, V.z);
    const add = (key, geo) => { geo.applyMatrix4(T0); G[key].push(clean(geo)); };
    const face = Math.atan2(CAM_FACE.z - V.z, CAM_FACE.x - V.x);
    const polar = (a, rr, y) => new THREE.Vector3(Math.cos(a) * rr, y, Math.sin(a) * rr);
    const yawOut = (a) => Math.PI / 2 - a;
    const gB = 0.6, gT = H - 0.2; // tall glass window: the water line shows through it

    add('plinth', place(new THREE.CylinderGeometry(r + 0.28, r + 0.36, 0.12, 72), 0, 0.06, 0));
    // lower steel skirt with a flared foot
    add('steel', lathe([[r + 0.1, 0.12], [r + 0.04, 0.2], [r, 0.3], [r, gB], [r - 0.08, gB + 0.02], [r - 0.08, 0.14]]));
    // top steel band + rounded rim, folding inside down below the waterline
    add('steel', lathe([[r - 0.08, gT - 0.02], [r, gT], [r, H - 0.1], [r - 0.16, H - 0.1], [r - 0.16, gT - 0.04]])); // rim sits under the flush deck
    // dark band rings + rivets
    for (const [yb, hh] of [[0.36, 0.07], [H - 0.1, 0.05]]) {
      add('band', lathe([[r, yb - hh], [r + 0.045, yb - hh + 0.02], [r + 0.045, yb + hh - 0.02], [r, yb + hh]]));
      const n = Math.round(r * 12);
      for (let k = 0; k < n; k++) { const p = polar((k + 0.5) / n * TAU, r + 0.05, yb); rivets.push(trs(V.x + p.x, p.y, V.z + p.z, 0, 0, 0, 0.026)); }
    }
    // glass wall + vertical steel ribs
    add('glass', place(new THREE.CylinderGeometry(r - 0.02, r - 0.02, gT - gB, 72, 1, true), 0, (gB + gT) / 2, 0));
    const nr = Math.max(6, Math.round(r * 3.2));
    for (let k = 0; k < nr; k++) {
      const a = (k / nr) * TAU + 0.2, p = polar(a, r, (gB + gT) / 2);
      add('steel', place(new RoundedBoxGeometry(0.12, gT - gB + 0.04, 0.1, 2, 0.03), p.x, p.y, p.z, 0, yawOut(a), 0));
    }
    // water column (seen through the glass) + caustic floor + glossy surface
    // per-tank liquid (animated level): unit-height column with a top→deep gradient, floor, surface, meniscus
    const colGeo = new THREE.CylinderGeometry(r - 0.12, r - 0.12, 1, 64, 6, true); colGeo.translate(0, 0.5, 0);
    { const cc = new Float32Array(colGeo.attributes.position.count * 3), cT = new THREE.Color(C.top), cD = new THREE.Color(C.deep), tmp = new THREE.Color();
      for (let k = 0; k < colGeo.attributes.position.count; k++) { tmp.copy(cD).lerp(cT, Math.pow(colGeo.attributes.position.getY(k), 1.6)); cc.set([tmp.r, tmp.g, tmp.b], k * 3); }
      colGeo.setAttribute('color', new THREE.BufferAttribute(cc, 3)); }
    const column = new THREE.Mesh(colGeo, C.column); column.position.set(V.x, 0.14, V.z); column.scale.y = WL - 0.14; column.receiveShadow = true;
    const floor = new THREE.Mesh(place(new THREE.CircleGeometry(r - 0.12, 48), 0, 0, 0, -Math.PI / 2), C.floor); floor.position.set(V.x, 0.16, V.z);
    const surface = new THREE.Mesh(place(new THREE.CircleGeometry(r - 0.13, 72), 0, 0, 0, -Math.PI / 2), C.surface); surface.position.set(V.x, WL, V.z); surface.renderOrder = 2;
    const men = new THREE.Mesh(new THREE.TorusGeometry(r - 0.11, 0.022, 6, 96), C.meniscus); men.rotation.x = Math.PI / 2; men.position.set(V.x, WL, V.z);
    g.add(column, floor, surface, men);

    // rim walkway (grating ring on brackets) + railing
    const dY = H + 0.025, dO = r + 0.6;
    add('deck', lathe([[r - 0.17, dY - 0.07], [dO, dY - 0.07], [dO, dY], [r - 0.17, dY]], 96));
    add('band', lathe([[dO - 0.01, dY - 0.1], [dO + 0.03, dY - 0.09], [dO + 0.03, dY + 0.03], [dO - 0.01, dY + 0.04]], 96));
    const nb = Math.round(r * 3.5);
    for (let k = 0; k < nb; k++) {
      const a = (k / nb) * TAU + 0.1, p = polar(a, r + 0.3, dY - 0.3);
      add('band', place(new THREE.BoxGeometry(0.05, 0.4, 0.55), p.x, p.y, p.z, 0, yawOut(a), 0, 1, 1, 1));
    }
    const ladderA = face + 0.55;
    for (const [hh, rad] of [[0.62, 0.045]]) { // single top rail (less moiré at the overview)
      // railing ring broken at the ladder
      const span = TAU - 0.5 / (r + 0.55) * 2;
      const tor = new THREE.TorusGeometry(dO - 0.05, rad, 6, 96, span);
      tor.rotateX(-Math.PI / 2); tor.rotateY(-(ladderA - 0.5 / (r + 0.55))); tor.translate(0, dY + hh, 0);
      add('rail', tor);
    }
    const npst = Math.round((r + 0.55) * TAU / 1.1);
    for (let k = 0; k < npst; k++) {
      const a = (k / npst) * TAU;
      let da = a - ladderA; da = Math.atan2(Math.sin(da), Math.cos(da));
      if (Math.abs(da) < 0.45 / (r + 0.55)) continue;
      const p = polar(a, dO - 0.05, dY + 0.31);
      posts.push(trs(V.x + p.x, p.y, V.z + p.z));
    }
    // ladder from the floor to the walkway
    {
      const m = new THREE.Matrix4().makeRotationY(yawOut(ladderA)).setPosition(polar(ladderA, dO + 0.1, 0));
      const addm = (key, geo) => { geo.applyMatrix4(m); add(key, geo); };
      for (const sx of [-0.2, 0.2]) addm('rail', place(new THREE.CylinderGeometry(0.03, 0.03, dY + 0.75, 8), sx, (dY + 0.75) / 2, 0));
      for (let y = 0.3; y < dY; y += 0.28) addm('rail', place(new THREE.CylinderGeometry(0.018, 0.018, 0.4, 6), 0, y, 0, 0, 0, Math.PI / 2));
      for (const sx of [-0.2, 0.2]) addm('rail', place(new THREE.TorusGeometry(0.12, 0.03, 6, 12, Math.PI), sx, dY + 0.75, -0.12, 0, Math.PI / 2, 0));
    }
    // sign plate on the top band facing the visitor
    {
      const a = face - 0.35, p = polar(a, r + 0.12, 0.92);
      const sg = new THREE.PlaneGeometry(Math.min(1.4, r * 0.55), Math.min(1.4, r * 0.55) / 4);
      sg.rotateY(yawOut(a)); sg.translate(p.x, p.y, p.z); sg.applyMatrix4(T0);
      g.add(new THREE.Mesh(sg, C.sign));
    }
    { // rail-top signboard for every tank: above the railing, clear of posts/pipes/ladder, turned to the overview camera
      const a = Math.atan2(118 - V.z, 5 - V.x) - 0.3, yaw = yawOut(a), tilt = -0.28;
      const pw = Math.min(1.3, r * 0.5), ph = pw * 0.27, yC = dY + 1.0, rC = dO + 0.16;
      const pg = new THREE.PlaneGeometry(pw, ph); pg.rotateX(tilt); pg.rotateY(yaw);
      const pc = polar(a, rC + 0.03, yC); pg.translate(V.x + pc.x, pc.y, V.z + pc.z);
      g.add(new THREE.Mesh(pg, C.sign));
      const bk = new RoundedBoxGeometry(pw + 0.1, ph + 0.1, 0.05, 2, 0.02); bk.rotateX(tilt); bk.rotateY(yaw);
      const pb = polar(a, rC, yC); bk.translate(V.x + pb.x, pb.y, V.z + pb.z); G.steel.push(clean(bk));
      for (const sd of [-1, 1]) { // two posts from the rail up to the board
        const pa = a + sd * (pw * 0.36) / rC, pp = polar(pa, (rC + dO - 0.05) / 2, (dY + 0.62 + yC) / 2);
        G.rail.push(clean(place(new THREE.CylinderGeometry(0.025, 0.025, yC - dY - 0.62 + 0.1, 6), V.x + pp.x, pp.y, V.z + pp.z)));
      }
    }
    tanks.push({ V, r, H, WL, face, C, column, surface, men, level: WL });
    footprints.push({ type: 'circle', x: V.x, z: V.z, r: r + 0.62, id: `vac${vi}` });
    anchors[`vacuole${vi}`] = [V.x, 0, V.z];
    anchors[`vacuole${vi}Rim`] = (() => { const p = polar(ladderA, dO + 0.5, 0); return [+(V.x + p.x).toFixed(2), 0, +(V.z + p.z).toFixed(2)]; })();
  });

  // overhead transfer pipes between neighbouring tanks (walk underneath)
  const pairs = [[0, 2], [1, 2], [0, 1]];
  pairs.forEach(([i, j]) => {
    const A = tanks[i], B = tanks[j];
    const dx = B.V.x - A.V.x, dz = B.V.z - A.V.z, d = Math.hypot(dx, dz), ux = dx / d, uz = dz / d;
    const y0 = Math.max(A.H, B.H) + 0.55;
    const pa = new THREE.Vector3(A.V.x + ux * (A.r - 0.4), A.H + 0.05, A.V.z + uz * (A.r - 0.4));
    const pb = new THREE.Vector3(B.V.x - ux * (B.r - 0.4), B.H + 0.05, B.V.z - uz * (B.r - 0.4));
    const pa2 = new THREE.Vector3(A.V.x + ux * (A.r - 0.1), y0, A.V.z + uz * (A.r - 0.1));
    const pb2 = new THREE.Vector3(B.V.x - ux * (B.r - 0.1), y0, B.V.z - uz * (B.r - 0.1));
    const curve = new THREE.CatmullRomCurve3([pa, pa2, pa2.clone().lerp(pb2, 0.5).add(new THREE.Vector3(0, 0.12, 0)), pb2, pb], false, 'centripetal');
    G.band.push(clean(new THREE.TubeGeometry(curve, 48, 0.1, 10)));
    for (const k of [0.25, 0.5, 0.75]) {
      const p = curve.getPointAt(k), tng = curve.getTangentAt(k);
      const fl = new THREE.CylinderGeometry(0.15, 0.15, 0.07, 14);
      fl.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), tng)));
      fl.translate(p.x, p.y, p.z); G.steel.push(clean(fl));
    }
  });

  // ground valve stand at the largest tank (tankValve)
  {
    const A = tanks[0], a = A.face - 0.4;
    const base = new THREE.Vector3(A.V.x + Math.cos(a) * (A.r - 0.02), 0.32, A.V.z + Math.sin(a) * (A.r - 0.02));
    const out = new THREE.Vector3(A.V.x + Math.cos(a) * (A.r + 0.5), 0.32, A.V.z + Math.sin(a) * (A.r + 0.5));
    const down = out.clone(); down.y = 0.1;
    G.band.push(clean(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([base, out.clone().lerp(base, 0.3), out, down], false, 'catmullrom', 0.1), 20, 0.09, 10)));
    const vw = base.clone().lerp(out, 0.55);
    G.steel.push(clean(place(new THREE.CylinderGeometry(0.14, 0.14, 0.18, 14), vw.x, vw.y, vw.z, 0, -a, Math.PI / 2)));
    G.steel.push(clean(place(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 8), vw.x, vw.y + 0.15, vw.z)));
    G.red.push(clean(place(new THREE.TorusGeometry(0.17, 0.035, 8, 24), vw.x, vw.y + 0.3, vw.z, Math.PI / 2)));
    for (let k = 0; k < 3; k++) G.red.push(clean(place(new THREE.BoxGeometry(0.32, 0.025, 0.025), vw.x, vw.y + 0.3, vw.z, 0, k * Math.PI / 3, 0)));
    anchors.tankValve = [+vw.x.toFixed(2), +(vw.y + 0.3).toFixed(2), +vw.z.toFixed(2)];
    const st = new THREE.Vector3(A.V.x + Math.cos(a) * (A.r + 1.4), 0, A.V.z + Math.sin(a) * (A.r + 1.4));
    anchors.tankValveStand = [+st.x.toFixed(2), 0, +st.z.toFixed(2)];
  }

  const mats = { steel: steelMat, band: bandMat, plinth: plinthMat, rail: railMat, deck: deckMat, glass: glassMat, red: redMat };
  for (const [k, arr] of Object.entries(G)) {
    if (!arr.length) continue;
    const mesh = new THREE.Mesh(mergeGeometries(arr), mats[k]); mesh.name = `vac_${k}`;
    const solid = !['glass', 'water', 'column', 'floor', 'sign'].includes(k);
    mesh.castShadow = solid; mesh.receiveShadow = k !== 'glass';
    if (k === 'glass') mesh.renderOrder = 3;
    if (k === 'water') mesh.renderOrder = 2;
    g.add(mesh);
  }
  g.add(instanced(new THREE.SphereGeometry(1, 8, 6), M.metal(0xdfe4ea, 0.25), rivets, { castShadow: false }));
  g.add(instanced(new THREE.CylinderGeometry(0.034, 0.034, 0.62, 8), railMat, posts, { castShadow: true }));

  // the rubber duck (easter egg) in the clear-water tank
  const DT = tanks[0];
  const duck = new THREE.Group(); duck.name = 'rubberDuck';
  const yellow = new THREE.MeshPhysicalMaterial({ color: 0xffd21f, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1, emissive: 0x5a3c00, emissiveIntensity: 0.25 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.13, 20, 14), yellow); body.scale.set(1.15, 0.78, 0.95); body.position.y = 0.05;
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.1, 10), yellow); tail.position.set(-0.15, 0.1, 0); tail.rotation.z = Math.PI / 2 + 0.7;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.075, 18, 12), yellow); head.position.set(0.07, 0.17, 0);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.07, 10), M.satin(0xff7a1a, { rough: 0.3, clearcoat: 1, key: 'duckBeak' }));
  beak.rotation.z = -Math.PI / 2; beak.position.set(0.155, 0.16, 0); beak.scale.set(1, 1, 0.6);
  const eyeM = M.satin(0x111111, { rough: 0.2, clearcoat: 1, key: 'duckEye' });
  for (const s of [-1, 1]) { const eye = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), eyeM); eye.position.set(0.12, 0.2, s * 0.045); duck.add(eye); }
  duck.add(body, tail, head, beak);
  duck.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.add(duck);
  const duckR = DT.r * 0.48;
  anchors.duck = [+(DT.V.x + duckR).toFixed(2), +DT.WL.toFixed(2), +DT.V.z.toFixed(2)];

  // WOW: the water tank fills and drains; while filling, a spout on a feed pipe pours into it
  const spoutA = -Math.PI / 2 + 0.25; // toward the back, away from the membrane and the other tanks
  const spoutP = new THREE.Vector3(DT.V.x + Math.cos(spoutA) * (DT.r - 0.55), DT.H + 0.62, DT.V.z + Math.sin(spoutA) * (DT.r - 0.55));
  {
    const top = spoutP.clone(); top.y = DT.H + 0.95;
    const out = new THREE.Vector3(DT.V.x + Math.cos(spoutA) * (DT.r + 0.25), DT.H + 0.95, DT.V.z + Math.sin(spoutA) * (DT.r + 0.25));
    const down = out.clone(); down.y = 0.1;
    const pipe = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([spoutP, top, out, down], false, 'catmullrom', 0.08), 36, 0.09, 10);
    const pm = new THREE.Mesh(pipe, bandMat); pm.castShadow = true; g.add(pm);
    g.add(new THREE.Mesh(place(new THREE.CylinderGeometry(0.13, 0.1, 0.1, 14), spoutP.x, spoutP.y, spoutP.z), steelMat));
  }
  const streamTex = caus.clone(); streamTex.repeat.set(1, 3); streamTex.needsUpdate = true;
  const streamMat = new THREE.MeshStandardMaterial({ color: 0x9ff4ff, emissive: 0x7fe8ff, emissiveMap: streamTex, emissiveIntensity: 2.2, transparent: true, opacity: 0.75, roughness: 0.1, depthWrite: false });
  const stream = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.075, 1, 14, 1, true), streamMat); stream.geometry.translate(0, -0.5, 0);
  stream.position.copy(spoutP).add(new THREE.Vector3(0, -0.05, 0)); g.add(stream);
  const splash = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.03, 6, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xdfffff).multiplyScalar(1.6), transparent: true, opacity: 0.7, depthWrite: false }));
  splash.rotation.x = Math.PI / 2; g.add(splash);
  // waste tank: slow murky bubbles surfacing
  // nutrient tank: suspended glowing particles drifting in the amber syrup
  const NT = tanks[1];
  const nPart = Array.from({ length: 40 }, () => ({ a: rnd() * TAU, d: Math.sqrt(rnd()) * (NT.r - 0.3), y: 0.3 + rnd() * (NT.WL - 0.45), ph: rnd() * TAU, s: 0.025 + rnd() * 0.035 }));
  const nPartMesh = instanced(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: 0xfff0c0, emissive: 0xffc860, emissiveIntensity: 2.2, roughness: 0.3 }), nPart.map(() => new THREE.Matrix4()), { castShadow: false });
  g.add(nPartMesh);
  const WT = tanks[2];
  const wBub = Array.from({ length: 16 }, () => ({ a: rnd() * TAU, d: Math.sqrt(rnd()) * (WT.r - 0.35), ph: rnd(), s: 0.04 + rnd() * 0.06 }));
  const wBubMesh = instanced(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshPhysicalMaterial({ color: 0xc8d27a, roughness: 0.15, clearcoat: 1, emissive: 0x4a5418, emissiveIntensity: 0.6 }), wBub.map(() => new THREE.Matrix4()), { castShadow: false });
  g.add(wBubMesh);

  // cool turquoise spill from the tanks onto the pavement
  const cx = tanks.reduce((s, t) => s + t.V.x, 0) / tanks.length, cz = tanks.reduce((s, t) => s + t.V.z, 0) / tanks.length;
  const light = new THREE.PointLight(0x5fe6ff, 5, 11, 1.6); light.position.set(cx + 1, 3.2, cz + 1); g.add(light);

  const c = tanks[0];
  anchors.examineCam = [+(cx + 3).toFixed(2), 7.5, +(cz + 10).toFixed(2)];
  anchors.examineTarget = [+cx.toFixed(2), 1.2, +cz.toFixed(2)];
  void c;
  g.userData.anchors = anchors;
  g.userData.footprints = footprints;
  g.userData.duck = duck;

  const mm = new THREE.Matrix4(), qI = new THREE.Quaternion(), vP = new THREE.Vector3(), vS = new THREE.Vector3();
  g.userData.update = (t) => {
    CM.forEach((c) => { c.column.userData.time.value = t; c.floor.userData.time.value = t; });
    rip.offset.set(t * 0.018, t * 0.011); rip2.offset.set(-t * 0.013, t * 0.02);
    // levels: water tank cycles fill/drain (20 s), the others breathe gently
    tanks.forEach((tk, i) => {
      const lv = i === 0 ? tk.WL + Math.sin(t * TAU / 20) * 0.16 : tk.WL + Math.sin(t * 0.3 + i * 2) * 0.03;
      tk.level = lv; tk.column.scale.y = lv - 0.14; tk.surface.position.y = lv; tk.men.position.y = lv;
    });
    const flow = THREE.MathUtils.smoothstep(Math.cos(t * TAU / 20), -0.1, 0.25); // pours while the level rises
    stream.scale.set(Math.max(0.001, flow), spoutP.y - DT.level, Math.max(0.001, flow));
    streamTex.offset.y = -t * 1.6;
    const ph = (t * 2.2) % 1, sp = (1 + ph * 1.4) * flow + 0.001;
    splash.position.set(spoutP.x, DT.level + 0.01, spoutP.z); splash.scale.set(sp, sp, 1); splash.material.opacity = 0.7 * (1 - ph) * flow;
    wBub.forEach((b, i) => {
      const u = (t * 0.18 + b.ph) % 1;
      wBubMesh.setMatrixAt(i, mm.compose(vP.set(WT.V.x + Math.cos(b.a) * b.d, 0.25 + u * (WT.level - 0.3), WT.V.z + Math.sin(b.a) * b.d), qI, vS.setScalar(b.s * (u > 0.95 ? (1 - u) * 20 : 1) + 0.0001)));
    });
    wBubMesh.instanceMatrix.needsUpdate = true;
    nPart.forEach((b, i) => {
      const a = b.a + t * 0.05 + Math.sin(t * 0.3 + b.ph) * 0.2;
      nPartMesh.setMatrixAt(i, mm.compose(vP.set(NT.V.x + Math.cos(a) * b.d, Math.min(NT.level - 0.08, b.y + Math.sin(t * 0.5 + b.ph) * 0.12), NT.V.z + Math.sin(a) * b.d), qI, vS.setScalar(b.s)));
    });
    nPartMesh.instanceMatrix.needsUpdate = true;
    const a = t * 0.11 + 0.7;
    duck.position.set(DT.V.x + Math.cos(a) * duckR, DT.level - 0.02 + Math.sin(t * 1.9) * 0.012, DT.V.z + Math.sin(a) * duckR);
    duck.rotation.set(Math.sin(t * 1.6) * 0.06, -a - Math.PI / 2, Math.sin(t * 1.3) * 0.05);
    anchors.duck[0] = +duck.position.x.toFixed(2); anchors.duck[2] = +duck.position.z.toFixed(2);
  };
  void rnd;
  return g;
}
