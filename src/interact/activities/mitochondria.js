// Mitochondria — "Proton Power".
// A magnified holographic cut of one crista hovers over the real ATP-synthase crown in power plant A.
// NADH / FADH₂ deliver electrons; the player clicks the glowing complex where the electrons wait
// (I or II → III → IV). Complexes I, III and IV pump H⁺ from the matrix into the intermembrane space
// (4 + 4 + 2 per NADH). Once the gradient is built the player opens ATP synthase: H⁺ flow back through
// the F₀ c-ring, the rotor + γ stalk spin inside the fixed F₁ head and ATP pops out (≈3 H⁺ per ATP shown).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { runActivity, anchorsOf, framePose, tweenAlong } from './_shared.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const D = Math.PI / 180;
const MEM_H = 0.5;          // inner membrane (bilayer) thickness, centred on y = 0
const MEM_L = 6.7;          // membrane length (local x)
const OMM_Y = 1.95;         // outer membrane centre
const IMS = { x0: -3.15, x1: 3.15, y0: 0.42, y1: 1.62, z0: -0.32, z1: 0.38 };
const MAT = { x0: -3.2, x1: 3.2, y0: -2.0, y1: -0.45, z0: -0.25, z1: 0.45 };
const SEQ = ['NADH', 'FADH2', 'NADH'];             // 10 + 6 + 10 = 26 H⁺
const GOAL_H = 26, GOAL_ATP = 8, H_PER_ATP = 3;
const COL = { h: 0xff3d6e, e: 0xfff1a0, nadh: 0x46d4ff, fadh: 0xb6ff3a, q: 0xffd23a, cytc: 0xff7a2a, atp: 0xffc23a, o2: 0xff4a3a, w: 0xe8f6ff };

export function start(ctx) {
  const A = anchorsOf(ctx, 'mitochondria');
  const S = A['mitoA.synthase'] || A.synthase || V(-13.71, 1.52, 3.99);
  const hooks = {};
  const inst = runActivity(ctx, (kit, api) => build(kit, api, ctx, S, hooks));
  inst._auto = () => hooks.auto?.();
  return inst;
}

function build(kit, api, ctx, S, hooks) {
  api.buttons([]); // clear the previous run's Play again / Finish buttons on replay
  const YAW = 15 * D;
  // ---------------------------------------------------------------- prop frame (hovers over the real crista)
  const P = new THREE.Group(); P.name = 'protonPowerCutaway';
  P.position.copy(S).add(V(0.25, 3.45, 0.35)); P.rotation.y = YAW; kit.add(P);
  P.updateMatrixWorld(true);
  const W = (x, y, z) => P.localToWorld(V(x, y, z));

  const plate = kit.holoPlate({ w: 8.7, h: 5.5, color: 0xffb070, pos: W(0.25, 0.08, -0.85), yaw: YAW, opacity: 0.75, title: 'MAGNIFIED · ONE CRISTA OF THE INNER MEMBRANE' });
  // dark backing so the molecules read against the busy city behind the hologram
  const back = new THREE.Mesh(new THREE.PlaneGeometry(8.5, 5.3), kit.own(new THREE.MeshBasicMaterial({ color: 0x1a0d16, transparent: true, opacity: 0.8, depthWrite: false })));
  back.position.set(0.25, 0.08, -0.9); back.renderOrder = 0; P.add(back);
  // region tints: intermembrane space glows pinker as the gradient builds; matrix stays cool
  const imsTint = new THREE.Mesh(new THREE.PlaneGeometry(MEM_L, OMM_Y - 0.14 - MEM_H / 2 - 0.02), kit.additive(COL.h, 0.05, 1));
  imsTint.position.set(0, (OMM_Y - 0.14 + MEM_H / 2) / 2, -0.6); P.add(imsTint);
  const matTint = new THREE.Mesh(new THREE.PlaneGeometry(MEM_L, 1.75), kit.additive(0x3aa8ff, 0.06, 1));
  matTint.position.set(0, -MEM_H / 2 - 0.9, -0.6); P.add(matTint);
  const beam = kit.beam(S.clone().add(V(0, 0.15, 0)), W(2.55, -2.55, -0.3), 0xffb070, 0.12, 0.9, 0.16);
  const crownGlow = kit.sprite(0xffb050, 1.4, 0.9); crownGlow.position.copy(S).add(V(0, 0.2, 0)); kit.add(crownGlow);

  // ---------------------------------------------------------------- materials
  const memMat = kit.own(new THREE.MeshPhysicalMaterial({ map: kit.own(bilayerTex()), emissiveMap: null, color: 0xffffff, roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.25, emissive: 0x7a3010, emissiveIntensity: 0.35 }));
  memMat.map.wrapS = THREE.RepeatWrapping; memMat.map.repeat.set(MEM_L / 0.5, 1);
  const memTopMat = kit.gloss(0xf6c9a0, { ei: 0.25, rough: 0.5 });
  const headMat = kit.gloss(0xff9a52, { ei: 0.55, rough: 0.3 });
  const ommMat = kit.own(new THREE.MeshPhysicalMaterial({ map: kit.own(bilayerTex(0.6)), color: 0xffe2c8, roughness: 0.45, clearcoat: 0.5, emissive: 0x5a2008, emissiveIntensity: 0.3, transparent: true, opacity: 0.85 }));
  ommMat.map.wrapS = THREE.RepeatWrapping; ommMat.map.repeat.set(MEM_L / 0.4, 1);

  // ---------------------------------------------------------------- inner membrane (bilayer slab) + heads
  const slab = new THREE.Mesh(new THREE.BoxGeometry(MEM_L, MEM_H, 0.9), [memTopMat, memTopMat, memTopMat, memTopMat, memMat, memMat]);
  slab.position.set(0, 0, 0.05); P.add(slab);
  const proteinsX = [[-3.0, -2.05], [-1.6, -1.05], [-0.62, 0.22], [0.72, 1.38], [2.15, 3.15]];
  const heads = [];
  for (let x = -MEM_L / 2 + 0.08; x <= MEM_L / 2 - 0.06; x += 0.155) {
    if (proteinsX.some(([a, b]) => x > a && x < b)) continue;
    for (const y of [MEM_H / 2, -MEM_H / 2]) for (let z = -0.36; z <= 0.46; z += 0.2) heads.push(V(x, y, z + 0.05));
  }
  const headMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.075, 12, 8), headMat, heads.length);
  heads.forEach((p, i) => headMesh.setMatrixAt(i, new THREE.Matrix4().makeTranslation(p.x, p.y, p.z)));
  P.add(headMesh);
  // outer membrane (porous, VDAC porins)
  const omm = new THREE.Mesh(new THREE.BoxGeometry(MEM_L, 0.28, 0.7), ommMat); omm.position.set(0, OMM_Y, -0.05); P.add(omm);
  const vdacMat = kit.gloss(0x46c8b0, { ei: 0.6 });
  for (const x of [-1.9, 1.7]) {
    const v = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.42, 16, 1, true), vdacMat); v.position.set(x, OMM_Y, 0.1); P.add(v);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.15, 16), kit.glow(0x0a2a26, 0.6)); hole.rotation.x = -Math.PI / 2; hole.position.set(x, OMM_Y + 0.215, 0.1); P.add(hole);
  }
  // region captions on the hologram
  const cap = (s, x, y, col = '#ffd9b0') => { const t = kit.text(s, { h: 0.27, fg: col, font: '800 64px Montserrat, sans-serif' }); t.position.set(x + (0.27 * t.userData.aspect) / 2, y, -0.4); P.add(t); return t; };
  cap('INTERMEMBRANE SPACE', -3.35, 1.62, '#ff9fb8');
  cap('MATRIX', -3.35, -2.25, '#9fe8ff');
  cap('OUTER MEMBRANE', 0.95, 2.38, '#ffd9b0');

  // ---------------------------------------------------------------- respiratory complexes
  const cx = {};
  const mk = (id, color, x) => {
    const g = new THREE.Group(); g.position.set(x, 0, 0.28); P.add(g);
    const mat = kit.gloss(color, { ei: 0.35, rough: 0.26 });
    const dark = kit.gloss(new THREE.Color(color).multiplyScalar(0.55).getHex(), { ei: 0.25, rough: 0.3 });
    const c = { id, g, mat, dark, x, color, glow: 0, base: 0.35 };
    cx[id] = c; return c;
  };
  const cap3 = (c, r, h, x, y, z = 0.05, rz = 0, m = c.mat) => { const s = new THREE.Mesh(new THREE.CapsuleGeometry(r, h, 6, 16), m); s.position.set(x, y, z); s.rotation.z = rz; c.g.add(s); return s; };
  const ball = (c, r, x, y, z = 0.05, m = c.mat) => { const s = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), m); s.position.set(x, y, z); c.g.add(s); return s; };
  // Complex I: L-shape — membrane arm + peripheral arm into the matrix
  const c1 = mk('I', 0x2fa8e8, -2.55);
  cap3(c1, 0.26, 0.75, 0.05, 0.02, 0.05, Math.PI / 2);
  cap3(c1, 0.27, 0.62, 0.38, -0.62, 0.08, 0.32, c1.dark);
  ball(c1, 0.3, 0.55, -1.08, 0.1);
  c1.dock = V(-2.0, -1.45, 0.4); c1.label = 'Complex I · NADH dehydrogenase';
  // Complex II: small, matrix side, does not pump
  const c2 = mk('II', 0x7ccf3a, -1.33);
  ball(c2, 0.24, 0, -0.08); ball(c2, 0.27, 0.02, -0.46, 0.08, c2.dark); ball(c2, 0.18, 0.18, -0.72, 0.1);
  c2.dock = V(-1.15, -1.25, 0.4); c2.label = 'Complex II · succinate dehydrogenase (no pumping)';
  // Complex III: dimer
  const c3 = mk('III', 0x9b6cf0, -0.2);
  cap3(c3, 0.22, 0.62, -0.2, 0.05); cap3(c3, 0.22, 0.62, 0.2, 0.05);
  ball(c3, 0.24, -0.18, -0.55, 0.08, c3.dark); ball(c3, 0.24, 0.2, -0.55, 0.08, c3.dark);
  ball(c3, 0.15, 0, 0.62, 0.08, c3.dark);
  c3.label = 'Complex III · cytochrome bc₁';
  // Complex IV
  const c4 = mk('IV', 0xf0507e, 1.05);
  { const b = new THREE.Mesh(new RoundedBoxGeometry(0.62, 1.05, 0.62, 3, 0.18), c4.mat); b.position.set(0, 0.0, 0.05); c4.g.add(b); }
  ball(c4, 0.2, 0.05, -0.62, 0.1, c4.dark);
  c4.label = 'Complex IV · cytochrome c oxidase';

  // ATP synthase: F₀ c-ring (rotor, in the membrane) + γ stalk (rotor) + F₁ α₃β₃ head (stator) + peripheral stalk
  const syn = mk('SYN', 0xffb23a, 2.55);
  syn.label = 'ATP synthase (F₀F₁)';
  const rotor = new THREE.Group(); syn.g.add(rotor); rotor.position.set(0, 0, 0.05);
  const cA = kit.gloss(0xffc04a, { ei: 0.5, rough: 0.25, metal: 0.2 }), cB = kit.gloss(0xff7a2a, { ei: 0.5, rough: 0.25, metal: 0.2 });
  const NC = 8;
  for (let k = 0; k < NC; k++) {
    const a = (k / NC) * Math.PI * 2;
    const s = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.36, 4, 10), k % 2 ? cB : cA);
    s.position.set(Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3); rotor.add(s);
  }
  const gam = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.25, 12), cA); gam.position.y = -0.62; rotor.add(gam);
  const cam = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 10), cB); cam.position.set(0.09, -0.95, 0); rotor.add(cam);
  const aSub = new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.56, 0.42, 2, 0.1), syn.dark); aSub.position.set(0.5, 0, 0.05); syn.g.add(aSub);
  const per = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.3, 8), syn.dark); per.position.set(0.56, -0.86, 0.05); syn.g.add(per);
  const f1 = new THREE.Group(); f1.position.set(0, -1.38, 0.05); syn.g.add(f1);
  const alpha = kit.gloss(0xffe0a0, { ei: 0.4, rough: 0.28 }), beta = kit.gloss(0xf09030, { ei: 0.45, rough: 0.28 });
  for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2 + 0.3; const s = new THREE.Mesh(new THREE.SphereGeometry(0.22, 20, 14), k % 2 ? beta : alpha); s.position.set(Math.cos(a) * 0.25, 0, Math.sin(a) * 0.25); s.scale.set(1, 1.25, 1); f1.add(s); }
  { const d = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 10), syn.dark); d.position.y = -0.33; f1.add(d); const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 8), syn.dark); bridge.position.set(0.36, -0.12, 0); bridge.rotation.z = 1.2; f1.add(bridge); }
  syn.entry = V(2.95, 0.62, 0.5); syn.exit = V(2.98, -0.55, 0.62); syn.out = V(2.55, -1.42, 0.85);

  const tag = (c, s, x, y) => { const t = kit.text(s, { h: 0.26, fg: '#ffffff', bg: '#' + new THREE.Color(c.color).multiplyScalar(0.7).getHexString(), border: 'rgba(255,255,255,0.85)', font: '800 66px Montserrat, sans-serif', radius: 46, pad: 34 }); t.position.set(x, y, 0.95); P.add(t); c.tag = t; return t; };
  tag(c1, 'Complex I', -2.75, 0.68); tag(c2, 'II', -1.0, -1.02); tag(c3, 'III', -0.2, 1.0); tag(c4, 'IV', 1.05, 0.82); tag(syn, 'F₀F₁', 2.55, 0.62);

  // ---------------------------------------------------------------- gradient gauge (right edge of the hologram)
  const gauge = new THREE.Group(); gauge.position.set(3.72, -0.1, 0); P.add(gauge);
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 3.4, 20, 1, true), kit.own(new THREE.MeshPhysicalMaterial({ color: 0xffe8f0, roughness: 0.05, transparent: true, opacity: 0.25, clearcoat: 1, depthWrite: false })));
  gauge.add(tube);
  const fill = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1, 18), kit.glow(COL.h, 3.4)); fill.geometry.translate(0, 0.5, 0); fill.position.y = -1.68; fill.scale.y = 0.001; gauge.add(fill);
  for (const y of [-1.75, 1.75]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.035, 8, 24), kit.gloss(0xd8dde4, { ei: 0.1, metal: 0.8 })); r.rotation.x = Math.PI / 2; r.position.y = y; gauge.add(r); }
  const gtxt = kit.text('H⁺ GRADIENT', { h: 0.23, fg: '#ff9fb8', font: '800 60px Montserrat, sans-serif' }); gtxt.position.set(-0.45, 2.42, 0.45); gauge.add(gtxt); // above the outer membrane, inside the 90 % safe area

  // ---------------------------------------------------------------- protons (instanced glowing beads)
  const NP = 52;
  const H = kit.beads(NP, 0.082, { intensity: 7, parent: P });
  const prot = Array.from({ length: NP }, () => ({ mode: 'off', p: V(0, 0, 0), v: V(0, 0, 0), s: 0 }));
  const free = () => prot.find((q) => q.mode === 'off');
  const rnd = (a, b) => a + Math.random() * (b - a);
  const inBox = (B) => V(rnd(B.x0, B.x1), rnd(B.y0, B.y1), rnd(B.z0, B.z1));
  const spawnMatrix = (x = null) => { const q = free(); if (!q) return null; q.mode = 'matrix'; q.p.copy(inBox(MAT)); if (x != null) q.p.x = x + rnd(-0.5, 0.5); q.v.set(0, 0, 0); q.s = 0; kit.tween(q, { s: 1, duration: 0.5, ease: 'back.out(2)' }); return q; };
  for (let k = 0; k < 9; k++) spawnMatrix();

  let imsCount = 0, pumped = 0, atp = 0, passed = 0, phase = 'pump';
  const progress = () => {
    if (phase === 'pump') api.progress(0.62 * pumped / GOAL_H, `H⁺ pumped into the intermembrane space: ${pumped} / ${GOAL_H}`);
    else api.progress(0.62 + 0.38 * atp / GOAL_ATP, `ATP made: ${atp} / ${GOAL_ATP}  ·  H⁺ through ATP synthase: ${passed}`);
  };

  /** Pump n protons from the matrix through complex c into the intermembrane space. */
  const pump = (c, n) => {
    for (let k = 0; k < n; k++) {
      let q = prot.filter((r) => r.mode === 'matrix').sort((a, b) => Math.abs(a.p.x - c.x) - Math.abs(b.p.x - c.x))[0] || spawnMatrix(c.x);
      if (!q) continue;
      q.mode = 'tween'; q.s = 1;
      const jx = c.x + (k - (n - 1) / 2) * 0.12;
      const to = V(THREE.MathUtils.clamp(c.x + rnd(-0.9, 0.9), IMS.x0, IMS.x1), rnd(0.8, 1.45), rnd(-0.1, 0.3));
      tweenAlong(kit, [q.p.clone(), V(jx, -0.75, 0.62), V(jx, 0, 0.74), V(jx, 0.55, 0.58), to], {
        duration: 0.9, delay: k * 0.13, ease: 'power2.inOut', onPos: (v) => q.p.copy(v),
        onComplete: () => {
          q.mode = 'ims'; q.v.set(rnd(-0.3, 0.3), rnd(-0.1, 0.2), 0); imsCount++; pumped++; progress();
          ctx.sfx('bubble', { volume: 0.4, pitch: 1 + pumped * 0.02 });
          if (pumped === GOAL_H) kit.label('ims', 'Proton-motive force ≈ 150–200 mV', 'Δp', () => W(-0.6, 1.62, 0.2));
        },
      });
      kit.later(0.9 + k * 0.13 + 0.2, () => { if (prot.filter((r) => r.mode === 'matrix').length < 7) spawnMatrix(c.x); });
    }
    kit.later(0.25, () => kit.burst(W(c.x, 0.55, 0.45), COL.h, { count: 18, speed: 1.4, size: 0.18, life: 0.6, dir: V(0, 1, 0) }));
  };

  // ---------------------------------------------------------------- small molecules
  const mol = (beads, sticks = true) => {
    const g = new THREE.Group();
    beads.forEach(([x, y, r, c, ei = 3.2]) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), kit.glow(c, ei)); m.position.set(x, y, 0); g.add(m); });
    if (sticks) for (let k = 1; k < beads.length; k++) {
      const a = V(beads[k - 1][0], beads[k - 1][1], 0), b = V(beads[k][0], beads[k][1], 0);
      const s = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, a.distanceTo(b), 6), kit.glow(0xffffff, 1.2));
      s.position.copy(a).lerp(b, 0.5); s.quaternion.setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize()); g.add(s);
    }
    P.add(g); return g;
  };
  const carrier = (kind) => kind === 'NADH'
    ? mol([[-0.3, 0.05, 0.13, COL.nadh], [-0.1, -0.06, 0.09, 0x2a8cff], [0.08, 0.03, 0.08, COL.atp], [0.24, -0.05, 0.08, COL.atp], [0.42, 0.04, 0.12, 0x6a9cff]])
    : mol([[-0.32, 0.0, 0.13, COL.fadh], [-0.12, 0.06, 0.1, 0x7ae020], [0.06, -0.03, 0.08, COL.atp], [0.22, 0.04, 0.08, COL.atp], [0.4, -0.02, 0.12, 0x9ad84a]]);

  // electron spark + mobile carriers Q and cytochrome c
  const spark = new THREE.Group(); P.add(spark); spark.visible = false;
  spark.add(kit.sprite(COL.e, 0.55, 1)); spark.add(new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), kit.glow(COL.e, 6)));
  const sparkRun = (pts, dur = 0.7) => new Promise((res) => {
    spark.visible = true; ctx.sfx('zap', { volume: 0.35, pitch: 1.3 });
    tweenAlong(kit, pts.map((p) => p.clone()), { duration: dur, ease: 'power1.inOut', onPos: (v) => spark.position.copy(v), onComplete: () => { spark.visible = false; kit.burst(W(spark.position.x, spark.position.y, spark.position.z), COL.e, { count: 14, speed: 1, size: 0.14, life: 0.45 }); res(); } });
  });
  const Q = mol([[0, 0, 0.12, COL.q, 4]], false); Q.position.set(-1.9, 0.02, 0.62);
  const cyt = mol([[0, 0, 0.13, COL.cytc, 4]], false); cyt.position.set(0.25, 0.62, 0.52);
  const O2 = mol([[-0.08, 0, 0.09, COL.o2], [0.08, 0, 0.09, COL.o2]]); O2.position.set(1.25, -1.1, 0.5);

  // ---------------------------------------------------------------- readiness, picking, hints
  let ready = null, readySince = 0, resolveReady = null;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.045, 8, 64), kit.additive(0xfff0a0, 0.9, 3.5));
  ring.visible = false; P.add(ring);
  const clickTip = kit.text('CLICK', { h: 0.25, fg: '#1a1030', bg: '#ffe680', font: '900 64px Montserrat, sans-serif', radius: 50 });
  clickTip.visible = false; P.add(clickTip);
  const waitFor = (c, goalHtml) => new Promise((res) => {
    ready = c; readySince = kit.time; resolveReady = res;
    ring.visible = true; clickTip.visible = true;
    const ry = c.id === 'SYN' ? -0.4 : c.id === 'II' ? -0.35 : -0.1;
    const rs = c.id === 'SYN' ? 1.55 : c.id === 'II' ? 0.8 : c.id === 'I' ? 1.0 : 0.95;
    ring.position.set(c.x + (c.id === 'I' ? 0.25 : 0), ry, 0.95); ring.scale.setScalar(rs);
    clickTip.position.set(c.x + (c.id === 'I' ? -0.55 : c.id === 'SYN' ? -0.95 : 0), c.id === 'SYN' ? -1.3 : ry - rs * 0.62 - 0.18, 1.0);
    if (c.id !== 'SYN') kit.label('active' + c.id, c.label, c.id, () => W(c.x, 1.1, 0.3));
    if (goalHtml) api.goal(goalHtml);
    ctx.sfx('interact_ping', { volume: 0.4 });
  });
  const press = (c) => {
    if (!ready) return;
    if (c !== ready) {
      ctx.sfx('error_soft', { volume: 0.5 });
      kit.tween(c.g.position, { y: 0.06, duration: 0.07, yoyo: true, repeat: 3, ease: 'sine.inOut', onComplete: () => { c.g.position.y = 0; } });
      api.goal(`The electrons are waiting at <b>${ready.id === 'SYN' ? 'ATP synthase' : 'Complex ' + ready.id}</b> — click the one with the glowing ring.`);
      return;
    }
    ctx.sfx('button_press', { volume: 0.6 });
    c.glow = 1.6; kit.ring(W(ring.position.x, ring.position.y, ring.position.z), COL.e, { r: 0.4, to: 1.6, life: 0.55 });
    kit.unlabel('active' + c.id); ready = null; ring.visible = false; clickTip.visible = false;
    const r = resolveReady; resolveReady = null; r?.();
  };
  for (const c of Object.values(cx)) kit.pick(c.g, () => press(c));
  hooks.auto = () => { if (ready) press(ready); };

  // ---------------------------------------------------------------- the story
  const ATPs = [];
  const makeATP = () => {
    atp++; progress();
    const g = new THREE.Group(); kit.add(g);
    const parts = [[0, 0, 0.12, 0x8ad8ff, 3.4], [0.17, 0.03, 0.08, 0xffffff, 2.6], [0.31, -0.02, 0.075, COL.atp, 4.2], [0.44, 0.03, 0.075, COL.atp, 4.2], [0.57, -0.02, 0.075, 0xffe25a, 5.5]];
    parts.forEach(([x, y, r, c, e]) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), kit.glow(c, e)); m.position.set(x - 0.28, y, 0); g.add(m); });
    g.add(kit.sprite(COL.atp, 0.9, 0.55));
    const p0 = W(syn.out.x, syn.out.y, syn.out.z);
    g.position.copy(p0); g.quaternion.copy(P.quaternion); g.scale.setScalar(0.01);
    kit.ring(p0, COL.atp, { r: 0.2, to: 1.1, life: 0.6 });
    kit.burst(p0, COL.atp, { count: 26, speed: 1.6, size: 0.2, life: 0.7 });
    ctx.sfx('atp_pop', { volume: 0.7, pitch: 0.9 + atp * 0.05 });
    kit.tween(g.scale, { x: 1.25, y: 1.25, z: 1.25, duration: 0.45, ease: 'back.out(3)' });
    // drift out to the side, then sail down into the city (ATP leaves the mitochondrion)
    const side = W(syn.out.x + 0.9 + atp * 0.06, syn.out.y - 0.5 + (atp % 3) * 0.25, 0.9);
    const ang = YAW + 0.6 + atp * 0.5, far = S.clone().add(V(Math.sin(ang) * (6 + atp * 0.4), 0.6, Math.cos(ang) * (4 + atp * 0.3)));
    const mid = side.clone().lerp(far, 0.5).add(V(0, 2.2, 0));
    tweenAlong(kit, [p0, side, mid, far], { duration: 3.4, delay: 0.5, ease: 'power1.inOut', onPos: (v) => g.position.copy(v),
      onComplete: () => { kit.burst(g.position.clone(), COL.atp, { count: 16, speed: 1, size: 0.25, life: 0.6 }); g.visible = false; } });
    kit.tween(g.scale, { x: 0.55, y: 0.55, z: 0.55, duration: 2.5, delay: 1.2 });
    ATPs.push(g);
  };

  const story = async () => {
    api.goal(`Electrons from <b>NADH</b> and <b>FADH₂</b> arrive at the electron transport chain. <b>Click the glowing complex</b> to pass them along — Complexes I, III and IV use their energy to <b>pump H⁺</b> into the intermembrane space.`, true);
    progress();
    // camera: frame the hologram right of the panel
    kit.from(P.scale, { x: 0.01, y: 0.01, z: 0.01, duration: 1.1, delay: 0.5, ease: 'back.out(1.4)' });
    kit.from(plate.scale, { x: 0.01, y: 0.01, duration: 0.9, delay: 0.3, ease: 'power3.out' });
    ctx.sfx('whoosh', { volume: 0.5 });
    await ctx.rig.flyTo(framePose(ctx, W(0.35, -0.05, 0), { yaw: 15, pitch: 17, dist: 10.2, fov: 40, sx: 0.2, sy: 0.04 }), api.replay ? 0.8 : 1.9);
    kit.label('syn', 'ATP synthase (F₀F₁)', 'F₀F₁', () => W(2.55, -1.95, 0.4));

    for (let r = 0; r < SEQ.length; r++) {
      const kind = SEQ[r];
      const first = kind === 'NADH' ? c1 : c2;
      const m = carrier(kind); m.position.set(-4.0, -1.75, 0.45); m.scale.setScalar(0.01);
      kit.label('carrier' + r, kind === 'NADH' ? 'NADH (from the Krebs cycle)' : 'FADH₂ (via Complex II)', kind === 'NADH' ? 'NADH' : 'FADH₂', () => W(m.position.x, m.position.y + 0.22, m.position.z));
      kit.tween(m.scale, { x: 1.3, y: 1.3, z: 1.3, duration: 0.5, ease: 'back.out(2)' });
      await kit.to(m.position, { x: first.dock.x, y: first.dock.y, z: first.dock.z, duration: 1.3, ease: 'power2.out' });
      await waitFor(first, r === 0 ? null : kind === 'NADH'
        ? 'Another <b>NADH</b>! It hands its electrons to <b>Complex I</b>. Click it.'
        : '<b>FADH₂</b> arrives at <b>Complex II</b>, which passes electrons on but pumps no protons. Click it.');
      // oxidise: NADH → NAD⁺ (dims and drifts away)
      kit.unlabel('carrier' + r);
      m.children.forEach((b) => b.material.emissiveIntensity !== undefined && kit.tween(b.material, { emissiveIntensity: 0.6, duration: 0.6 }));
      kit.tween(m.position, { x: m.position.x - 1.2, y: -1.9, duration: 2.2, ease: 'power1.in' });
      kit.tween(m.scale, { x: 0.01, y: 0.01, z: 0.01, duration: 0.6, delay: 1.7 });
      if (kind === 'NADH') {
        sparkRun([first.dock, V(-2.05, -0.7, 0.45), V(-2.5, 0.0, 0.5), V(-2.0, 0.02, 0.62)], 0.7);
        pump(c1, 4);
        api.goal('Complex I pumped <b>4 H⁺</b>. The electrons ride <b>ubiquinone (Q)</b> through the membrane to <b>Complex III</b>.');
      } else {
        sparkRun([first.dock, V(-1.3, -0.6, 0.45), V(-1.6, 0.02, 0.62)], 0.6);
        ctx.sfx('error_soft', { volume: 0.15, pitch: 1.6 });
        api.goal('Complex II feeds electrons into the chain but <b>pumps no H⁺</b> — that is why FADH₂ yields less. On to <b>Complex III</b>.');
      }
      // Q shuttles in the membrane to complex III
      Q.position.set(first.x + 0.45, 0.02, 0.62);
      kit.label('q' + r, 'Ubiquinone (Q)', 'Q', () => W(Q.position.x, Q.position.y + 0.15, Q.position.z));
      await kit.to(Q.position, { x: -0.6, duration: 1.0, ease: 'power2.inOut' });
      kit.unlabel('q' + r);
      await waitFor(c3, null);
      sparkRun([V(-0.45, 0.02, 0.62), V(0, 0.4, 0.55), V(0.25, 0.62, 0.52)], 0.5);
      pump(c3, 4);
      Q.position.set(-1.9, 0.02, 0.62);
      api.goal('Complex III pumped <b>4 H⁺</b>. <b>Cytochrome c</b> carries the electrons to <b>Complex IV</b>.');
      cyt.position.set(0.25, 0.62, 0.52);
      kit.label('cyt' + r, 'Cytochrome c', 'cyt c', () => W(cyt.position.x, cyt.position.y + 0.15, cyt.position.z));
      await kit.to(cyt.position, { x: 0.75, duration: 0.9, ease: 'power2.inOut' });
      kit.unlabel('cyt' + r);
      await waitFor(c4, null);
      sparkRun([V(0.75, 0.62, 0.52), V(1.05, 0.0, 0.6), V(1.25, -1.0, 0.5)], 0.6);
      pump(c4, 2);
      cyt.position.set(0.25, 0.62, 0.52);
      // O₂ + 4e⁻ + 4H⁺ → 2 H₂O : oxygen turns into a water molecule and drifts off
      kit.later(0.6, () => {
        const w = mol([[0, 0, 0.1, COL.o2], [-0.12, -0.08, 0.06, COL.w], [0.12, -0.08, 0.06, COL.w]]);
        w.position.copy(O2.position); O2.scale.setScalar(0.01);
        kit.label('h2o' + r, 'O₂ + H⁺ + e⁻ → H₂O', 'O₂', () => W(w.position.x, w.position.y + 0.14, w.position.z));
        kit.burst(W(O2.position.x, O2.position.y, O2.position.z), 0x9fe8ff, { count: 14, speed: 1, size: 0.16, life: 0.5 });
        kit.tween(w.position, { x: w.position.x + 1.1, y: -1.95, duration: 2.6, ease: 'sine.inOut', onComplete: () => { w.visible = false; kit.unlabel('h2o' + r); } });
        kit.tween(O2.scale, { x: 1, y: 1, z: 1, duration: 0.5, delay: 2.4, ease: 'back.out(2)' });
      });
      api.goal(r < SEQ.length - 1
        ? 'Complex IV pumped <b>2 H⁺</b> and handed the electrons to <b>oxygen</b>, making water. Here comes the next electron carrier…'
        : 'Complex IV pumped <b>2 H⁺</b>. Watch the gradient gauge fill…');
      await kit.wait(1.3);
    }

    // ------------------------------------------------ phase 2: open ATP synthase
    await kit.wait(0.6);
    phase = 'flow'; progress(); kit.unlabel('ims');
    const btn = api.buttons([{ label: 'Open ATP synthase ▶', solid: true, onClick: () => press(syn) }]);
    await waitFor(syn, `<b>Gradient built!</b> ${GOAL_H} H⁺ are crowded into the intermembrane space and want to flow back. <b>Click ATP synthase</b> to let them through.`);
    btn.forEach((b) => b.remove());
    ctx.sfx('valve_turn', { volume: 0.6 });
    api.goal('H⁺ rush back through <b>F₀</b>, turning the c-ring and the γ stalk inside the fixed <b>F₁</b> head, which joins <b>ADP + Pᵢ → ATP</b>. Shown as about <b>3 H⁺ per ATP</b> (a simplification — the real ratio is close to that).');
    kit.label('adp', 'ADP + Pᵢ → ATP', 'F₁', () => W(3.35, -1.4, 0.4));
    kit.label('rot', 'Rotor: c-ring + γ stalk', 'F₀', () => W(2.0, -0.05, 0.6));
    for (let k = 0; k < GOAL_H; k++) {
      const q = prot.filter((r) => r.mode === 'ims').sort((a, b) => a.p.distanceTo(syn.entry) - b.p.distanceTo(syn.entry))[0];
      if (!q) break;
      q.mode = 'tween';
      const path = [q.p.clone(), syn.entry.clone(), V(2.88, 0.12, 0.42)];
      path[2].z = 0.62;
      tweenAlong(kit, path, { duration: 0.45, ease: 'power2.in', onPos: (v) => q.p.copy(v), onComplete: () => {
        // ride the rotating c-ring for most of a turn, then out into the matrix
        q.mode = 'ring'; q.ang = rotorAngle; q.t0 = kit.time;
        imsCount--;
      } });
      await kit.wait(Math.max(0.2, 0.55 - k * 0.025));
    }
    await kit.wait(2.2);
    kit.unlabel('adp'); kit.unlabel('rot');
    kit.ring(W(0.3, 0, 0.3), COL.atp, { r: 1, to: 6, life: 1.4 });
    kit.burst(W(2.55, -1.3, 0.5), COL.atp, { count: 60, speed: 3, size: 0.26, life: 1.3 });
    api.finish(`<b>${atp} ATP made!</b> The electron transport chain spent the electrons’ energy pumping H⁺ to build a gradient; their flow back through <b>ATP synthase</b> spun its rotor and produced <b>ATP</b> — the cell’s energy currency.`);
  };

  // ---------------------------------------------------------------- per-frame
  let rotorAngle = 0, rotorTarget = 0;
  const ringR = 0.3, tmp = V(0, 0, 0), white = new THREE.Color(1, 1, 1);
  const pink = new THREE.Color(COL.h);
  story();

  return (dt, t) => {
    // rotor: each proton turns it 360/8°; spring towards target + gentle idle wobble
    rotorAngle += (rotorTarget - rotorAngle) * Math.min(1, dt * 5);
    rotor.rotation.y = rotorAngle;
    // protons
    for (let i = 0; i < NP; i++) {
      const q = prot[i];
      if (q.mode === 'off') { H.hide(i); continue; }
      if (q.mode === 'matrix' || q.mode === 'ims') {
        const B = q.mode === 'ims' ? IMS : MAT, k = q.mode === 'ims' ? 1.2 : 0.5;
        q.v.x += (Math.random() - 0.5) * k * dt * 6; q.v.y += (Math.random() - 0.5) * k * dt * 6; q.v.z += (Math.random() - 0.5) * k * dt * 2;
        q.v.multiplyScalar(1 - dt * 1.5);
        q.p.addScaledVector(q.v, dt);
        for (const [ax, lo, hi] of [['x', B.x0, B.x1], ['y', B.y0, B.y1], ['z', B.z0, B.z1]]) {
          if (q.p[ax] < lo) { q.p[ax] = lo; q.v[ax] = Math.abs(q.v[ax]); }
          if (q.p[ax] > hi) { q.p[ax] = hi; q.v[ax] = -Math.abs(q.v[ax]); }
        }
      } else if (q.mode === 'ring') {
        const a = q.ang + (rotorAngle - q.ang); // bound to the rotor
        const age = t - q.t0;
        const off = Math.min(1, age / 0.9) * Math.PI * 1.5;
        tmp.set(Math.cos(-a - off - 0.3) * ringR, 0, Math.sin(-a - off - 0.3) * ringR);
        q.p.set(syn.x + tmp.x, 0.02, 0.33 + tmp.z);
        if (age > 0.9) {
          q.mode = 'tween';
          rotorTarget += (Math.PI * 2) / 8; passed++;
          ctx.sfx('bubble', { volume: 0.3, pitch: 0.8 + Math.random() * 0.2 });
          if (passed % H_PER_ATP === 0 && atp < GOAL_ATP) makeATP(); else progress();
          tweenAlong(kit, [q.p.clone(), syn.exit.clone(), V(3.1 + Math.random() * 0.2, -1.0, 0.3)], { duration: 0.6, ease: 'power1.out', onPos: (v) => q.p.copy(v),
            onComplete: () => { q.mode = 'matrix'; q.v.set(0, -0.2, 0); kit.tween(q, { s: 0, duration: 1.5, delay: 1.5, onComplete: () => { q.mode = 'off'; } }); } });
        }
      }
      H.set(i, q.p, q.s * (q.mode === 'ims' ? 1 : 0.9), pink);
    }
    H.commit();
    // complexes: idle glow + pulse when ready + flash on fire
    for (const c of Object.values(cx)) {
      c.glow = Math.max(0, c.glow - dt * 2.2);
      const pulse = ready === c ? 0.9 + 0.7 * (0.5 + 0.5 * Math.sin(t * 6)) : 0;
      c.mat.emissiveIntensity = c.base + pulse + c.glow * 2.2;
    }
    if (ring.visible) {
      ring.rotation.z = t * 0.8; const s = ring.scale.x; ring.material.opacity = 0.55 + 0.45 * Math.sin(t * 6);
      const late = t - readySince > 4 ? 1 : 0;
      clickTip.scale.setScalar(1 + late * 0.15 * Math.abs(Math.sin(t * 5)));
      clickTip.position.y += Math.sin(t * 4) * 0.002;
      void s;
    }
    // gauge, beam, crown glow
    const f = Math.max(0.001, imsCount / GOAL_H);
    fill.scale.y += (f * 3.36 - fill.scale.y) * Math.min(1, dt * 4);
    fill.material.emissiveIntensity = 3 + 1.5 * f + (phase === 'flow' ? Math.sin(t * 8) * 0.4 : 0);
    imsTint.material.opacity = 0.04 + 0.22 * f;
    beam.material.opacity = 0.12 + 0.05 * Math.sin(t * 2.2) + (phase === 'flow' ? 0.08 : 0);
    crownGlow.material.opacity = 0.6 + 0.3 * Math.sin(t * 3);
    Q.rotation.z = t * 2; cyt.rotation.z = -t * 2;
    for (const g of ATPs) if (g.visible) g.rotation.z = Math.sin(t * 3 + g.id) * 0.25;
  };
}

/** Phospholipid bilayer cross-section: heads (orange beads) on both faces, wavy tails inside. */
function bilayerTex(k = 1) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 128);
  grd.addColorStop(0, '#ffcf9a'); grd.addColorStop(0.5, '#fff1d8'); grd.addColorStop(1, '#ffcf9a');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(200,120,60,0.75)'; g.lineWidth = 3 * k + 1; g.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const x = 16 + i * 32;
    for (const [y0, dir] of [[18, 1], [110, -1]]) {
      for (const dx of [-5, 5]) {
        g.beginPath(); g.moveTo(x + dx, y0);
        for (let s = 1; s <= 8; s++) g.lineTo(x + dx + Math.sin(s * 1.3 + dx) * 2.5, y0 + dir * s * 5.3);
        g.stroke();
      }
    }
  }
  for (let i = 0; i < 4; i++) for (const y of [12, 116]) {
    const x = 16 + i * 32, r = 11;
    const rg = g.createRadialGradient(x - 3, y - 3, 1, x, y, r);
    rg.addColorStop(0, '#ffe2b8'); rg.addColorStop(0.6, '#ff8a3a'); rg.addColorStop(1, '#c8501a');
    g.fillStyle = rg; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
