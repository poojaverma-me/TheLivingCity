// Transport vesicles: glassy iridescent lipid spheres (bilayer shell with a glowing fresnel rim, translucent
// violet lumen, a faint glowing cargo parcel inside) resting in toy-like cradles around the city, plus a slow exocytosis loop: vesicles form on
// the Golgi trans launch pad, float to the front-right membrane ports and fuse with a purple flash.
import * as THREE from 'three';
import { VESICLES, GATES } from '../layout.js';
import { membranePoint } from '../membrane.js';
import { golgiTransPad, golgiPadArmTip, parcelTexture } from './golgi.js';
import * as M from '../../core/materials.js';
import * as T from '../../core/textures.js';
import { mergeGeometries, trs } from '../../core/geom.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { organic } from '../../core/lookdev.js';

const CY = 0.98;
const PORT_Y = 1.7;         // centre height of membrane.js's porthole channel (lead-owned)
const MOVER_R = 0.62;       // radius of travelling vesicles
const PAD_S = 0.62;         // launch-pad cradle scale
const FREE_FLOAT = 4;       // VESICLES index that floats free above the ER (no cradle)
const LOOP = 4, SPARE = 4;  // looping exocytosis vesicles + slots for spawnVesicleTrip()

let api = null;

/** Launch an extra vesicle from `from` to `to` ({x,y,z} or [x,y,z]). Optional { duration, fuse, port }. Returns slot or -1. */
export function spawnVesicleTrip(from, to, opts = {}) { return api ? api.spawn(from, to, opts) : -1; }

const v3 = (p) => (Array.isArray(p) ? new THREE.Vector3(...p) : new THREE.Vector3(p.x, p.y ?? 0, p.z));
const smooth = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
const smoother = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * x * (x * (x * 6 - 15) + 10); };

function coatGeometry() { // coat proteins: little knobs over the outer bilayer (fibonacci sphere)
  const parts = [], n = 64, ga = Math.PI * (3 - Math.sqrt(5));
  const knob = new THREE.SphereGeometry(0.075, 8, 6); knob.scale(1, 1, 0.55);
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2, r = Math.sqrt(1 - y * y), a = i * ga;
    const nrm = new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), nrm);
    parts.push(knob.clone().applyMatrix4(new THREE.Matrix4().compose(nrm.clone().multiplyScalar(1.0), q, new THREE.Vector3(1, 1, 1))));
  }
  return mergeGeometries(parts);
}

function cradleGeometries() {
  // rounded plinth with a bevelled lip and a shallow cup
  const prof = [[0, 0], [1.22, 0], [1.31, 0.02], [1.36, 0.07], [1.37, 0.13], [1.34, 0.19], [1.26, 0.23], [1.1, 0.27], [0.98, 0.33],
    [0.92, 0.36], [0.86, 0.36], [0.74, 0.31], [0.42, 0.24], [0, 0.22]].map(([x, y]) => new THREE.Vector2(x, y));
  const plinth = new THREE.LatheGeometry(prof, 64);
  const lip = new THREE.TorusGeometry(1.33, 0.06, 10, 72).rotateX(Math.PI / 2).translate(0, 0.13, 0);
  const ring = new THREE.TorusGeometry(0.92, 0.035, 8, 64).rotateX(Math.PI / 2).translate(0, 0.355, 0);
  const strip = (g) => { const h = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(h.attributes)) if (!['position', 'normal', 'uv'].includes(k)) h.deleteAttribute(k); return h; };
  return {
    plinth: mergeGeometries([plinth, lip].map(strip)),
    glow: strip(ring),
  };
}

export function buildVesicles() {
  const g = new THREE.Group(); g.name = 'vesicles';

  // ---------- materials ----------
  // glassy iridescent bilayer shell with a glowing fresnel rim (power 3, #C79BFF); denser at grazing angles
  const shellMat = organic(new THREE.MeshPhysicalMaterial({
    color: 0x9d5cf2, roughness: 0.05, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03,
    iridescence: 0.55, iridescenceIOR: 1.35, iridescenceThicknessRange: [220, 640],
    emissive: 0x5a22c0, emissiveIntensity: 0.3, envMapIntensity: 1.6,
    transparent: true, opacity: 1, depthWrite: false, side: THREE.DoubleSide, specularIntensity: 1,
  }), { rim: 0xf0dcff, rimPower: 2.2, rimStrength: 0.5, sss: 0xa865ff, sssStrength: 0.25 });
  {
    const prev = shellMat.onBeforeCompile;
    shellMat.onBeforeCompile = (sh, r) => {
      prev(sh, r);
      sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', `{
        float ndv2 = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
        float f3 = pow(1.0 - ndv2, 3.0);
        outgoingLight += vec3(0.78, 0.61, 1.0) * f3 * 1.4 * (gl_FrontFacing ? 1.0 : 0.2);
        // fake glass: nearly clear where we look straight through, dense bilayer at grazing edges; backface = tinted lumen
        diffuseColor.a = gl_FrontFacing ? mix(0.95, 0.22, pow(ndv2, 1.2)) : mix(0.55, 0.32, ndv2);
      }
      #include <opaque_fragment>`);
    };
    shellMat.customProgramCacheKey = () => 'vesShell4';
  }
  const coatMat = M.satin(0xd9c2ff, { rough: 0.35, clearcoat: 0.8, key: 'vesCoat' });
  const ptex = parcelTexture();
  const cargoMat = new THREE.MeshStandardMaterial({ map: ptex, color: 0xf4c7a6, emissiveMap: ptex, emissive: 0xffb48a, emissiveIntensity: 0.45, roughness: 0.55 });
  const plinthMat = M.satin(0xe6e1ee, { rough: 0.32, clearcoat: 0.9, key: 'vesPlinth2' });
  const glowMat = M.emissive(0xc58cff, 2.6, 0x7a3fd0);
  const poolMat = new THREE.MeshBasicMaterial({ map: T.radialTexture('rgba(190,140,255,1)', 'rgba(190,140,255,0)', 128), transparent: true, depthWrite: false, opacity: 0.35, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });

  // ---------- cradles ----------
  const pad = golgiTransPad();
  const cradles = [];
  VESICLES.forEach((v, i) => { if (i !== FREE_FLOAT) cradles.push({ x: v.x, z: v.z, s: v.r, rot: i * 0.7 }); });
  cradles.push({ x: pad.x, z: pad.z, s: PAD_S, rot: 0.3 });
  const cg = cradleGeometries();
  const cm = cradles.map((c) => trs(c.x, 0, c.z, 0, c.rot, 0, c.s, c.s, c.s));
  const inst = (geo, mat, mats, shadow = true) => {
    const m = new THREE.InstancedMesh(geo, mat, mats.length);
    mats.forEach((x, i) => m.setMatrixAt(i, x)); m.castShadow = shadow; m.receiveShadow = shadow;
    m.computeBoundingSphere(); return m;
  };
  g.add(inst(cg.plinth, plinthMat, cm), inst(cg.glow, glowMat, cm, false));
  const poolGeo = new THREE.PlaneGeometry(4.6, 4.6).rotateX(-Math.PI / 2);
  const pools = inst(poolGeo, poolMat, cradles.map((c) => trs(c.x, 0.02, c.z, 0, 0, 0, c.s, 1, c.s)), false);
  pools.renderOrder = 1;
  g.add(pools);

  // ---------- vesicles (statics + movers share three instanced meshes) ----------
  const NV = VESICLES.length + LOOP + SPARE;
  const shellGeo = new THREE.SphereGeometry(1, 56, 36);
  const shells = new THREE.InstancedMesh(shellGeo, shellMat, NV);
  const coats = new THREE.InstancedMesh(coatGeometry(), coatMat, NV);
  const cargo = new THREE.InstancedMesh(new RoundedBoxGeometry(0.5, 0.4, 0.42, 2, 0.07), cargoMat, NV);
  cargo.castShadow = false; coats.castShadow = false;
  shells.castShadow = true; shells.renderOrder = 4;
  for (const m of [shells, coats, cargo]) { m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); }
  coats.visible = false; // coat knobs read as a virus at distance; reserved for examine LOD
  g.add(cargo, coats, shells);
  let cargoSpin = 0; const _cm = new THREE.Matrix4();
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _v = new THREE.Vector3();
  const setV = (i, p, r, yaw = 0, squash = null) => {
    _q.setFromEuler(_e.set(0.3, yaw, 0.15));
    if (squash) { _q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), squash.dir); _s.set(r, r, r * squash.k); } else _s.setScalar(r);
    if (r < 1e-3) _s.setScalar(1e-4);
    _m.compose(p, _q, _s);
    shells.setMatrixAt(i, _m); coats.setMatrixAt(i, _m);
    _m.multiply(_cm.makeRotationY(cargoSpin)); cargo.setMatrixAt(i, _m);
  };

  // ---------- ports + fusion flash ----------
  const ports = GATES.filter((q) => q.kind === 'port').map((q) => {
    const at = (off, y = PORT_Y) => { const p = membranePoint(q.angle, off); return new THREE.Vector3(p.x, y, p.z); };
    const n = membranePoint(q.angle); const out = new THREE.Vector3(n.nx, 0, n.nz);
    return { id: q.id, approach: at(-4.4, 2.6), near: at(-1.7), lip: at(-0.55), mouth: at(1.3), flashAt: at(-0.15), out, start: -99 };
  });
  const flashRing = new THREE.InstancedMesh(new THREE.TorusGeometry(1, 0.11, 10, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }), ports.length);
  flashRing.frustumCulled = false;
  const black = new THREE.Color(0, 0, 0), flashCol = new THREE.Color(0xc890ff), tmpC = new THREE.Color();
  ports.forEach((p, i) => { flashRing.setMatrixAt(i, new THREE.Matrix4().makeScale(1e-3, 1e-3, 1e-3).setPosition(0, -40, 0)); flashRing.setColorAt(i, black); });
  const sprites = ports.map((p) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.radialTexture('rgba(235,205,255,1)', 'rgba(150,80,255,0)', 128), color: 0xd8b0ff, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 }));
    s.position.copy(p.flashAt); s.scale.setScalar(0.01); return s;
  });
  const flashLight = new THREE.PointLight(0xb98aff, 0, 1.8, 2); // tight: no flat smear across the pavers
  // six-petal fusion-pore iris recessed just inside the porthole barrel (the collar itself is membrane.js's)
  const basis = (P, off) => {
    const c = membranePoint(GATES.find((q) => q.id === P.id).angle, off);
    const z = P.out.clone().negate(), x = new THREE.Vector3(0, 1, 0).cross(z).normalize(), y = z.clone().cross(x);
    return new THREE.Matrix4().makeBasis(x, y, z).setPosition(c.x, PORT_Y, c.z);
  };
  for (const P of ports) P.irisM = basis(P, -0.3);
  const PET = 6;
  const petalShape = new THREE.Shape(); petalShape.moveTo(-0.27, 0); petalShape.quadraticCurveTo(0, 0.06, 0.27, 0); petalShape.lineTo(0.15, 0.46); petalShape.quadraticCurveTo(0, 0.51, -0.15, 0.46); petalShape.closePath();
  const petalGeo = new THREE.ExtrudeGeometry(petalShape, { depth: 0.08, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 3, curveSegments: 10 });
  const iris = new THREE.InstancedMesh(petalGeo, new THREE.MeshStandardMaterial({ color: 0xd9c4ff, emissive: 0x7b45e0, emissiveIntensity: 0.6, roughness: 0.3, metalness: 0.2 }), ports.length * PET);
  iris.frustumCulled = false; iris.castShadow = false;
  const setIris = (pi, open) => { // open 0 = mostly closed aperture, 1 = fully retracted into the collar
    const P = ports[pi];
    for (let k = 0; k < PET; k++) {
      const a = (k / PET) * Math.PI * 2, d = 0.06 + 0.4 * open, tw = 0.4 * (1 - open);
      _im.makeRotationZ(a + tw).multiply(_im2.makeTranslation(0, -(d + 0.46), 0)).multiply(_im3.makeRotationZ(0.12));
      iris.setMatrixAt(pi * PET + k, _im4.multiplyMatrices(P.irisM, _im));
    }
  };
  const _im = new THREE.Matrix4(), _im2 = new THREE.Matrix4(), _im3 = new THREE.Matrix4(), _im4 = new THREE.Matrix4();
  ports.forEach((P, i) => setIris(i, 0.55));
  g.add(flashRing, ...sprites, flashLight, iris);
  const fuse = (pi, t) => { ports[pi].start = t; flashLight.position.copy(ports[pi].flashAt).addScaledVector(ports[pi].out, -0.45); };

  // ---------- trips ----------
  const padTop = new THREE.Vector3(pad.x, CY * PAD_S, pad.z);
  // float routes: lifted out of the launch cradle, then gliding to each exocytosis port
  const arm = golgiPadArmTip(), armV = new THREE.Vector3(arm.x, arm.y, arm.z);
  const EXO = ['portFR', 'portR']; // exocytosis ports served by the Golgi loop (ports[0], ports[1])
  ports.forEach((P, pi) => {
    if (!EXO.includes(P.id)) return;
    const h0 = armV.clone();
    const d = P.approach.clone().sub(h0); d.y = 0;
    const side = new THREE.Vector3(-d.z, 0, d.x).normalize().multiplyScalar(pi ? 0.8 : -0.8);
    const hang = [h0, h0.clone().addScaledVector(d, 0.12).add(new THREE.Vector3(0, 0.35, 0)),
      h0.clone().addScaledVector(d, 0.5).add(side).setY(4.2), h0.clone().addScaledVector(d, 0.82).setY(3.3),
      P.approach.clone().setY(PORT_Y + 0.45), P.near.clone()];
    P.hangCurve = new THREE.CatmullRomCurve3(hang, false, 'centripetal');
  });
  // (no cables or stalks: vesicles float the route freely)
  const loops = [];
  const exoIdx = ports.map((P, i) => (EXO.includes(P.id) ? i : -1)).filter((i) => i >= 0);
  for (let k = 0; k < LOOP; k++) loops.push({ slot: VESICLES.length + k, port: exoIdx[k % exoIdx.length], offset: k * 5.5, fused: -1 });
  const PERIOD = 22, FORM = 2.4, RISE = 2.0, FUSE = 1.4, TRAVEL = 14;
  const TRIP = FORM + RISE + TRAVEL;
  const extra = []; // spawnVesicleTrip
  let clock = 0;
  api = {
    spawn(from, to, { duration = 12, fuse: doFuse = false, port = 0 } = {}) {
      const used = new Set(extra.map((e) => e.slot));
      for (let k = 0; k < SPARE; k++) {
        const slot = VESICLES.length + LOOP + k; if (used.has(slot)) continue;
        const a = v3(from), b = v3(to), mid = a.clone().lerp(b, 0.5); mid.y = Math.max(a.y, b.y) + 2.5;
        extra.push({ slot, curve: new THREE.CatmullRomCurve3([a, mid, b]), t0: clock, dur: duration, fuse: doFuse, port });
        return slot;
      }
      return -1;
    },
  };

  // ---------- local light ----------
  const big = VESICLES.reduce((a, b) => (b.r > a.r ? b : a));
  const purple = new THREE.PointLight(0xb47cff, 9, 7, 1.6); purple.position.set(big.x, big.r * CY + 0.4, big.z + 0.3);
  g.add(purple);

  // ---------- animation ----------
  g.userData.update = (t) => {
    if (g.userData.debugT !== undefined) t = g.userData.debugT; // QA: freeze the loop at a chosen time
    clock = t; cargoSpin = t * 0.25;
    // resting vesicles: gentle levitation bob + slow spin
    VESICLES.forEach((v, i) => {
      if (i === FREE_FLOAT) _p.set(v.x + Math.sin(t * 0.3) * 0.25, 2.9 + Math.sin(t * 0.8) * 0.18, v.z + Math.cos(t * 0.27) * 0.25);
      else _p.set(v.x, v.r * (CY + 0.05 * Math.sin(t * 1.3 + i * 1.7)), v.z);
      setV(i, _p, v.r, t * 0.15 + i);
    });
    // exocytosis loop
    for (const L of loops) {
      const tau = (t + L.offset) % PERIOD, cyc = Math.floor((t + L.offset) / PERIOD);
      const P = ports[L.port];
      const sv = L.slot;
      if (tau < FORM) { // swelling up out of the cradle cup (never smaller than 0.6 R)
        const a = smoother(tau / FORM);
        _p.copy(padTop); _p.y = padTop.y * (0.5 + 0.5 * a);
        setV(sv, _p, MOVER_R * (0.6 + 0.4 * a) * (1 + 0.05 * Math.sin(tau * 9) * (1 - a)), t * 0.4);
      } else if (tau < FORM + RISE) { // lifts gently out of the cradle
        const a = smoother((tau - FORM) / RISE);
        _p.copy(padTop).lerp(P.hangCurve.getPoint(0), a);
        setV(sv, _p, MOVER_R, t * 0.4);
      } else if (tau < TRIP) { // walking along the microtubule, hanging below it
        const u = Math.min(0.9999, Math.max(0, smoother((tau - FORM - RISE) / TRAVEL) || 0)); // clamp: getPointAt indexes past the end at u>1
        P.hangCurve.getPointAt(u, _p);
        setV(sv, _p, MOVER_R, t * 0.4);
        _p.y += Math.sin(t * 2.1 + sv) * 0.06 * Math.sin(u * Math.PI);
      } else if (tau < TRIP + FUSE) {
        const a = (tau - TRIP) / FUSE;
        if (L.fused !== cyc) { L.fused = cyc; fuse(L.port, t); }
        // dock against the pore (z-squash), then sink into the recessed channel and dissolve into the core glow
        if (a < 0.4) { const b = smooth(a / 0.4); _p.copy(P.near).lerp(P.lip, b); setV(sv, _p, MOVER_R, 0, { dir: P.out, k: 1 - 0.35 * b }); }
        else { const b = smooth((a - 0.4) / 0.6); _p.copy(P.lip).lerp(P.mouth, b); setV(sv, _p, MOVER_R * (1 - 0.45 * b), 0, { dir: P.out, k: 0.65 - 0.4 * b }); }
      } else setV(L.slot, _p.set(0, -50, 0), 0);
    }
    // extra trips
    for (let k = extra.length - 1; k >= 0; k--) {
      const e = extra[k], a = (t - e.t0) / e.dur;
      if (a >= 1) { setV(e.slot, _p.set(0, -50, 0), 0); if (e.fuse && ports[e.port]) fuse(e.port, t); extra.splice(k, 1); continue; }
      e.curve.getPointAt(Math.min(0.9999, Math.max(0, smoother(a) || 0)), _p);
      setV(e.slot, _p, MOVER_R * Math.min(1, a * 8, (1 - a) * 8), t * 0.4);
    }
    for (let k = 0; k < SPARE; k++) { const slot = VESICLES.length + LOOP + k; if (!extra.some((e) => e.slot === slot)) setV(slot, _p.set(0, -50, 0), 0); }
    shells.instanceMatrix.needsUpdate = coats.instanceMatrix.needsUpdate = cargo.instanceMatrix.needsUpdate = true;
    // fusion flashes
    let li = 0;
    ports.forEach((P, i) => {
      const a = (t - P.start) / 2.0;
      if (a >= 0 && a < 1) {
        const yaw = Math.atan2(P.out.x, P.out.z), sc = 0.8 + 1.1 * smooth(a);
        flashRing.setMatrixAt(i, _m.compose(P.flashAt, _q.setFromEuler(_e.set(0, yaw, 0)), _s.set(sc, sc, sc)));
        flashRing.setColorAt(i, tmpC.copy(flashCol).multiplyScalar(2.2 * (1 - a) ** 1.5));
        sprites[i].material.opacity = (1 - a) ** 2; sprites[i].scale.setScalar(2.2 + 5.5 * Math.sqrt(a));
        li = Math.max(li, 14 * (1 - a) ** 2);
      } else {
        flashRing.setMatrixAt(i, _m.makeScale(1e-3, 1e-3, 1e-3).setPosition(0, -40, 0)); sprites[i].material.opacity = 0;
      }
    });
    // iris: dilates as a vesicle approaches/fuses, then contracts back to its resting aperture
    ports.forEach((P, i) => {
      let open = 0.55;
      for (const L of loops) if (L.port === i) {
        const tau = (t + L.offset) % PERIOD;
        const near = smooth((tau - (TRIP - 2.0)) / 2.0) * (1 - smooth((tau - (TRIP + FUSE)) / 1.6));
        open = Math.max(open, 0.55 + 0.45 * near);
      }
      setIris(i, open);
    });
    iris.instanceMatrix.needsUpdate = true;
    flashRing.instanceMatrix.needsUpdate = true; flashRing.instanceColor.needsUpdate = true;
    flashLight.intensity = li;
  };
  g.userData.update(0, 0);

  // ---------- gameplay data ----------
  g.userData.footprints = cradles.map((c) => ({ type: 'circle', x: c.x, z: c.z, r: 1.38 * c.s + 0.08 }));
  g.userData.anchors = {
    vesicleExamine: [big.x, big.r * CY, big.z],
    vesicleExamineCam: [big.x - 3.2, big.r * CY + 2.4, big.z + 4.2],
    vesicleLaunchPad: [pad.x, 0, pad.z],
    ...Object.fromEntries(ports.map((p) => [`vesicleFuse_${p.id}`, p.mouth.toArray()])),
  };
  return g;
}
