// Smooth ER — "Detox Shift".
// Fat-soluble (lipophilic) drug / toxin molecules drift in over the P450 detox stations in the smooth-ER corridor.
// The player clicks each one: it is drawn into the station below, where cytochrome P450 (a heme enzyme, using O₂ and
// NADPH) adds a hydroxyl group (R–H → R–OH). The product turns from oily violet to water-loving aqua and floats away
// toward the blood for excretion by the kidneys / bile. Then the player feeds fatty acids to a lipid droplet budding
// from the ER membrane (3 fatty acids + glycerol → triglyceride) until it pinches off.
// Takeaway: Smooth ER makes lipids and, in liver cells, its P450 enzymes chemically modify fat-soluble drugs and
// toxins so the body can excrete them.
import * as THREE from 'three';
import { runActivity, anchorsOf, framePose, tweenAlong, mergeByMaterial } from './_shared.js';
import { SER } from '../../world/layout.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const GOAL_TOX = 6, GOAL_FA = 6;
const COL = { tox: 0x9a4dff, toxE: 0x7a2cff, sol: 0x3fe6ff, solE: 0x22c8ff, o: 0xff4a4a, h: 0xf4f8ff, fa: 0xffc23a, drop: 0xffb23a, gly: 0xfff2c8, o2: 0xff5a5a, p450: 0x9dff4a };
// real P450 reactions (all hydroxylations): substrate → product (isoform)
const TOXINS = [
  { name: 'Benzene', prod: 'Phenol', cyp: 'CYP2E1', side: [] },
  { name: 'Ibuprofen', prod: 'Hydroxy-ibuprofen', cyp: 'CYP2C9', side: [[0.36, -0.1], [0.52, -0.02], [0.66, -0.14], [-0.36, 0.1], [-0.52, 0.2]] },
  { name: 'Toluene', prod: 'Benzyl alcohol', cyp: 'CYP2E1', side: [[0.38, 0.02]] },
  { name: 'Midazolam', prod: '1′-Hydroxymidazolam', cyp: 'CYP3A4', side: [[-0.36, -0.12], [-0.5, -0.28], [-0.36, -0.44], [0.36, 0.1]] },
  { name: 'Diclofenac', prod: '4′-Hydroxydiclofenac', cyp: 'CYP2C9', side: [[0.36, 0.1], [0.5, 0.24], [0.5, -0.04], [-0.36, -0.1]] },
  { name: 'Phenobarbital', prod: 'p-Hydroxyphenobarbital', cyp: 'CYP2C9', side: [[0.37, 0], [0.52, 0.12], [0.52, -0.12], [0.66, 0]] },
];

export function start(ctx) {
  const hooks = {};
  const inst = runActivity(ctx, (kit, api) => build(kit, api, ctx, hooks));
  inst._auto = () => hooks.auto?.();
  return inst;
}

function build(kit, api, ctx, hooks) {
  api.buttons([]); // clear the previous run's Play again / Finish buttons on replay
  const A = anchorsOf(ctx, 'ser');
  const grp = ctx.world?.parts?.find((p) => p.name === 'ser') || ctx.scene.getObjectByName('ser');
  // SER local frame (group rotation) — fall back to the layout entry if the group is missing
  const frame = new THREE.Object3D();
  if (grp) { grp.updateMatrixWorld(true); frame.matrixWorld.copy(grp.matrixWorld); } else { frame.position.set(SER.x, 0, SER.z); frame.rotation.y = SER.rot; frame.updateMatrixWorld(true); }
  const L = (x, y, z) => V(x, y, z).applyMatrix4(frame.matrixWorld);
  const yawDeg = (grp ? grp.rotation.y : SER.rot) * 180 / Math.PI;

  // P450 stations (local x positions from the district builder; dome on top, outlet chute on the left)
  const ST = [{ x: -3.5, z: 1.6 }, { x: 0.0, z: 1.55 }, { x: 3.5, z: 1.65 }].map((s, i) => ({
    i, dome: L(s.x + 0.14, 1.12, s.z), out: L(s.x - 0.7, 0.55, s.z + 0.25), slot: L(s.x + 0.1, 2.35 + (i === 1 ? 0.3 : 0), s.z + 0.7), busy: false,
  }));
  // detox anchor (middle station) is the hero point
  if (A.detox) ST[1].dome.set(A.detox.x + 0.0, A.detox.y + 0.32, A.detox.z - 0.45);
  const calcium = A.calcium || L(5, 1.05, 4.0);
  // droplet bud site: on top of the middle-tier ER tube behind the middle station
  const BUD = L(0.6, 2.75, -0.1);
  const center = L(0, 1.7, 1.2);

  kit.light(0xd8ff9a, 10, 11, L(0, 3.4, 3.2));
  const heroGlow = ST.map((s) => { const sp = kit.sprite(COL.p450, 1.1, 0.55); sp.position.copy(s.dome); kit.add(sp); return sp; });

  // ---------------------------------------------------------------- molecule builders
  const beadGeo = (r) => new THREE.SphereGeometry(r, 18, 12);
  const stick = (a, b, mat, r = 0.026) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, a.distanceTo(b), 8), mat);
    m.position.copy(a).lerp(b, 0.5); m.quaternion.setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize()); return m;
  };
  const toxins = [];
  let made = 0, done = 0, lastAct = 0;
  const makeToxin = (spec, slot) => {
    const g = new THREE.Group(); const body = new THREE.Group(); g.add(body);
    const mat = kit.gloss(COL.tox, { emissive: COL.toxE, ei: 1.1, rough: 0.18 });
    const bond = kit.gloss(0xe6dcff, { ei: 0.4, rough: 0.3 });
    const R = 0.22, ring = [];
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2 + Math.PI / 6; ring.push(V(Math.cos(a) * R, Math.sin(a) * R, 0)); }
    ring.forEach((p, k) => { const b = new THREE.Mesh(beadGeo(0.075), mat); b.position.copy(p); body.add(b); body.add(stick(p, ring[(k + 1) % 6], bond)); });
    // inner aromatic ring
    const aro = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.018, 6, 28), bond); body.add(aro);
    let prev = null;
    spec.side.forEach(([x, y], k) => {
      const p = V(x, y, 0); const b = new THREE.Mesh(beadGeo(0.068), mat); b.position.copy(p); body.add(b);
      const from = k === 0 || Math.hypot(x - prev.x, y - prev.y) > 0.25 ? ring.reduce((best, q) => (q.distanceTo(p) < best.distanceTo(p) ? q : best), ring[0]) : prev;
      body.add(stick(from, p, bond)); prev = p;
    });
    const sheen = kit.sprite(COL.tox, 1.25, 0.45); g.add(sheen);
    const proxy = new THREE.Mesh(new THREE.SphereGeometry(0.62, 10, 8), kit.own(new THREE.MeshBasicMaterial({ visible: false }))); g.add(proxy);
    // hydroxyl to be attached (hidden until the P450 step): on the ring carbon facing up-left, or the methyl for toluene
    const anchor = spec.name === 'Toluene' ? V(0.38, 0.02, 0) : spec.name === 'Midazolam' ? V(-0.5, -0.28, 0) : ring[1];
    const dir = anchor.clone().normalize();
    const oPos = anchor.clone().addScaledVector(dir, 0.17), hPos = oPos.clone().add(V(-0.09, 0.09, 0).applyAxisAngle(V(0, 0, 1), Math.atan2(dir.y, dir.x) - Math.PI / 2));
    const oh = new THREE.Group(); oh.visible = false; body.add(oh);
    const oMat = kit.glow(COL.o, 4.2), hMat = kit.glow(COL.h, 3.2);
    const ob = new THREE.Mesh(beadGeo(0.082), oMat); ob.position.copy(oPos); oh.add(ob);
    const hb = new THREE.Mesh(beadGeo(0.05), hMat); hb.position.copy(hPos); oh.add(hb);
    oh.add(stick(anchor, oPos, bond), stick(oPos, hPos, bond, 0.02));
    oh.traverse((o) => { o.userData.keep = true; });
    mergeByMaterial(body);
    kit.add(g);
    const tox = { g, body, spec, slot, mat, sheen, state: 'in', ph: Math.random() * 6, oh, home: ST[slot].slot.clone(), hint: 0 };
    // drift in from the bloodstream side (right of the view) to its slot above a station
    const from = L(7.5 + Math.random(), 3.4 + Math.random() * 0.6, 3.5 + Math.random());
    g.position.copy(from); g.scale.setScalar(0.01);
    kit.tween(g.scale, { x: 1, y: 1, z: 1, duration: 0.6, ease: 'back.out(2)' });
    const mid = from.clone().lerp(tox.home, 0.5).add(V(0, 0.5, 0));
    tweenAlong(kit, [from, mid, tox.home.clone()], { duration: 2.4, ease: 'sine.inOut', onPos: (v) => g.position.copy(v), onComplete: () => { if (tox.state === 'in') tox.state = 'idle'; } });
    tox.pick = kit.pick(g, () => catchToxin(tox), { onHover: (on) => { tox.hover = on; } });
    toxins.push(tox); made++;
    ctx.sfx('vesicle_bloop', { volume: 0.35, pitch: 0.7 + Math.random() * 0.2 });
    return tox;
  };

  const freeSlot = () => [1, 0, 2].find((i) => !toxins.some((t) => t.slot === i && t.state !== 'gone' && t.state !== 'out'));
  const progress = (phase) => {
    if (phase === 'tox') api.progress(0.65 * done / GOAL_TOX, `Toxins made water-soluble: ${done} / ${GOAL_TOX}`);
    else api.progress(0.65 + 0.35 * fa / GOAL_FA, `Fatty acids packaged: ${fa} / ${GOAL_FA}  ·  triglycerides: ${Math.floor(fa / 3)}`);
  };

  // ---------------------------------------------------------------- the P450 reaction
  let firstCatch = true;
  const catchToxin = (tox) => {
    if (tox.state !== 'idle' && tox.state !== 'in') return;
    const st = ST[tox.slot];
    tox.state = 'react'; tox.pick.enabled = false; lastAct = kit.time;
    kit.unlabel('hint'); hint.visible = false;
    ctx.sfx('ui_click', { volume: 0.5 }); ctx.sfx('whoosh', { volume: 0.25, pitch: 1.4 });
    kit.ring(tox.g.position.clone(), COL.tox, { r: 0.3, to: 1.2, life: 0.5 });
    const p0 = tox.g.position.clone();
    tweenAlong(kit, [p0, p0.clone().lerp(st.dome, 0.5).add(V(0, 0.4, 0)), st.dome.clone().add(V(0, 0.15, 0))], {
      duration: 0.75, ease: 'power2.in', onPos: (v) => tox.g.position.copy(v),
      onComplete: () => react(tox, st),
    });
    kit.tween(tox.g.scale, { x: 0.55, y: 0.55, z: 0.55, duration: 0.75, ease: 'power2.in' });
    // O₂ joins at the heme iron (NADPH supplies the electrons)
    const o2 = new THREE.Group();
    const om = kit.glow(COL.o2, 4);
    for (const s of [-1, 1]) { const b = new THREE.Mesh(beadGeo(0.06), om); b.position.x = s * 0.06; o2.add(b); }
    kit.add(o2);
    const oFrom = st.dome.clone().add(V(-1.2, 1.4, 0.6));
    tweenAlong(kit, [oFrom, st.dome.clone().add(V(-0.4, 0.6, 0.3)), st.dome.clone().add(V(0, 0.1, 0))], { duration: 0.8, ease: 'power1.in', onPos: (v) => o2.position.copy(v), onComplete: () => { o2.visible = false; } });
    if (firstCatch) kit.label('o2', 'O₂ + NADPH (electrons via P450 reductase)', 'O₂', () => o2.visible ? o2.position.clone().add(V(0, 0.15, 0)) : null);
  };

  const react = (tox, st) => {
    const g = tox.g;
    ctx.sfx('zap', { volume: 0.45, pitch: 1.1 });
    kit.ring(st.dome.clone(), COL.p450, { r: 0.25, to: 1.4, life: 0.6, normal: V(0, 1, 0) });
    kit.burst(st.dome.clone().add(V(0, 0.1, 0)), COL.p450, { count: 26, speed: 1.4, size: 0.16, life: 0.6 });
    st.flash = 1;
    kit.tween(tox.body.rotation, { z: tox.body.rotation.z + Math.PI * 2, duration: 0.9, ease: 'power2.inOut' });
    kit.later(0.75, () => {
      // R–H → R–OH: hydroxyl appears, colour shifts from oily violet to water-loving aqua
      tox.oh.visible = true; tox.oh.scale.setScalar(0.01);
      kit.tween(tox.oh.scale, { x: 1, y: 1, z: 1, duration: 0.4, ease: 'back.out(3)' });
      kit.tween(tox.mat.color, { r: 0.25, g: 0.9, b: 1.0, duration: 0.6 });
      kit.tween(tox.mat.emissive, { r: 0.13, g: 0.78, b: 1.0, duration: 0.6 });
      kit.tween(tox.mat, { emissiveIntensity: 1.6, duration: 0.6 });
      tox.sheen.material.color.set(COL.sol).multiplyScalar(1.6);
      ctx.sfx('vesicle_bud', { volume: 0.55, pitch: 1.2 });
      kit.burst(g.position.clone(), COL.sol, { count: 20, speed: 1.2, size: 0.15, life: 0.6 });
      // pop out of the outlet chute, then float away toward the blood → kidneys / bile
      const out = st.out.clone().add(V(0, 0.35, 0.3));
      tweenAlong(kit, [g.position.clone(), g.position.clone().add(V(-0.3, 0.5, 0.3)), out], { duration: 0.6, ease: 'power1.out', onPos: (v) => g.position.copy(v) });
      kit.tween(g.scale, { x: 0.9, y: 0.9, z: 0.9, duration: 0.6, ease: 'back.out(2)' });
      done++; progress('tox');
      tox.state = 'out';
      kit.label('prod' + tox.spec.name, `${tox.spec.prod} · water-soluble`, '–OH', () => (g.visible ? g.position.clone().add(V(0, 0.32, 0)) : null));
      if (firstCatch) {
        firstCatch = false; kit.unlabel('o2');
        kit.unlabel('p450');
        kit.label('rx', 'R–H + O₂ + NADPH → R–OH + H₂O + NADP⁺', 'P450', () => st.dome.clone().add(V(0, 0.55, 0)));
        kit.later(4.5, () => { kit.unlabel('rx'); if (phase === 'tox') kit.label('p450', 'Cytochrome P450 (heme enzyme in the ER membrane)', 'P450', ST[1].dome.clone().add(V(0, 0.45, 0))); });
        api.goal(`<b>${tox.spec.cyp}</b> turned <b>${tox.spec.name}</b> into <b>${tox.spec.prod}</b>. The new <b>–OH (hydroxyl) group</b> makes it water-soluble, so the blood can carry it to the kidneys to be excreted. Catch the rest!`);
      } else api.goal(`<b>${tox.spec.cyp}</b>: ${tox.spec.name} → <b>${tox.spec.prod}</b> (+ –OH). ${done < GOAL_TOX ? 'Keep catching the violet, fat-soluble molecules.' : ''}`);
      const far = L(-2 + Math.random() * 4, 6.5, -6 - Math.random() * 2);
      kit.later(0.9, () => {
        tweenAlong(kit, [g.position.clone(), g.position.clone().add(V(0.4, 1.5, -0.5)), far], { duration: 3.2, ease: 'sine.in', onPos: (v) => g.position.copy(v),
          onComplete: () => { g.visible = false; tox.state = 'gone'; kit.unlabel('prod' + tox.spec.name); } });
        kit.tween(g.scale, { x: 0.3, y: 0.3, z: 0.3, duration: 3.0, ease: 'power1.in' });
      });
      // a water molecule drips out too
      const w = new THREE.Group(); const wo = new THREE.Mesh(beadGeo(0.06), kit.glow(COL.o, 3.2)); w.add(wo);
      for (const s of [-1, 1]) { const h = new THREE.Mesh(beadGeo(0.035), kit.glow(COL.h, 3)); h.position.set(s * 0.065, -0.045, 0); w.add(h); }
      w.position.copy(st.dome); kit.add(w);
      kit.tween(w.position, { x: w.position.x + 0.5, y: w.position.y - 0.9, z: w.position.z + 0.3, duration: 1.4, ease: 'power1.in', onComplete: () => { w.visible = false; } });
      if (done >= GOAL_TOX) kit.later(1.6, () => startLipids());
    });
  };

  // ---------------------------------------------------------------- hint ring (if the player waits)
  const hint = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.035, 8, 48), kit.additive(0xfff1a0, 0.9, 3.2)); hint.visible = false; kit.add(hint);
  const clickTip = kit.text('CLICK', { h: 0.2, fg: '#1a1030', bg: '#ffe680', font: '900 64px Montserrat, sans-serif', radius: 50, sprite: true });
  clickTip.visible = false; kit.add(clickTip);

  // ---------------------------------------------------------------- phase 2: lipid droplet
  let phase = 'tox', fa = 0;
  const fats = [];
  const dropMat = kit.gloss(COL.drop, { emissive: 0xff8a1a, ei: 1.4, rough: 0.12 });
  const drop = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 28), dropMat); drop.position.copy(BUD); drop.scale.setScalar(0.001); kit.add(drop);
  const dropShell = new THREE.Mesh(new THREE.SphereGeometry(1.07, 40, 28), kit.own(new THREE.MeshPhysicalMaterial({ color: 0xfff2c0, roughness: 0.1, clearcoat: 1, transparent: true, opacity: 0.22, depthWrite: false, emissive: 0xffd080, emissiveIntensity: 0.4 })));
  drop.add(dropShell);
  const dropGlow = kit.sprite(COL.drop, 1, 0.0); drop.add(dropGlow); dropGlow.scale.setScalar(3);
  let dropR = 0.001;
  const makeFA = (k) => {
    const g = new THREE.Group();
    const m = kit.glow(COL.fa, 3.2, { rough: 0.3 });
    const head = new THREE.Mesh(beadGeo(0.08), kit.glow(COL.o, 3.4)); g.add(head);
    let p = V(0, 0, 0);
    for (let s = 1; s <= 7; s++) { const q = V(s * 0.1, (s % 2 ? 0.05 : -0.02), 0); const b = new THREE.Mesh(beadGeo(0.045), m); b.position.copy(q); g.add(b); p = q; }
    void p;
    mergeByMaterial(g);
    const fs = kit.sprite(COL.fa, 0.9, 0.4); fs.position.x = 0.35; g.add(fs);
    const proxy = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), kit.own(new THREE.MeshBasicMaterial({ visible: false }))); proxy.position.x = 0.35; g.add(proxy);
    const ang = (k / GOAL_FA) * Math.PI * 2;
    const home = BUD.clone().add(L(Math.cos(ang) * 2.3, 0, 0).sub(L(0, 0, 0))).add(V(0, 0.75 + Math.sin(ang) * 0.55, 0)).add(L(0, 0, 1.0).sub(L(0, 0, 0)));
    const from = BUD.clone().add(V(0, -1.2, 0));
    g.position.copy(from); g.scale.setScalar(0.01); kit.add(g);
    const f = { g, home, state: 'in', ph: Math.random() * 6 };
    kit.tween(g.scale, { x: 1.45, y: 1.45, z: 1.45, duration: 0.5, delay: k * 0.12, ease: 'back.out(2)' });
    tweenAlong(kit, [from, from.clone().lerp(home, 0.5).add(V(0, 0.6, 0)), home.clone()], { duration: 1.4, delay: k * 0.12, ease: 'sine.out', onPos: (v) => g.position.copy(v), onComplete: () => { f.state = 'idle'; } });
    f.pick = kit.pick(g, () => feed(f));
    fats.push(f);
  };
  const feed = (f) => {
    if (f.state !== 'idle' && f.state !== 'in') return;
    f.state = 'fly'; f.pick.enabled = false; lastAct = kit.time;
    hint.visible = false;
    ctx.sfx('ui_click', { volume: 0.45 });
    tweenAlong(kit, [f.g.position.clone(), f.g.position.clone().lerp(BUD, 0.5).add(V(0, 0.5, 0)), BUD.clone()], { duration: 0.6, ease: 'power2.in', onPos: (v) => f.g.position.copy(v),
      onComplete: () => {
        f.g.visible = false; fa++; progress('lipid');
        ctx.sfx('bubble', { volume: 0.5, pitch: 0.8 + fa * 0.06 });
        kit.burst(BUD.clone(), COL.fa, { count: 14, speed: 1, size: 0.14, life: 0.5 });
        if (fa % 3 === 0) {
          // glycerol + 3 fatty acids → triglyceride: the droplet swells
          dropR = 0.22 + (fa / 3) * 0.2;
          kit.tween(drop.scale, { x: dropR, y: dropR, z: dropR, duration: 0.7, ease: 'elastic.out(1, 0.5)' });
          kit.ring(BUD.clone(), COL.drop, { r: 0.3, to: 1.4, life: 0.6 });
          ctx.sfx('vesicle_bloop', { volume: 0.6, pitch: 0.8 });
          const n = fa / 3;
          kit.label('tg', `Triglyceride ×${n} (glycerol + 3 fatty acids)`, 'TAG', () => BUD.clone().add(V(0, dropR + 0.25, 0)));
          if (fa >= GOAL_FA) kit.later(0.9, () => finale());
          else api.goal('One <b>triglyceride</b> made: glycerol + 3 fatty acids, joined by ER enzymes. It slips <b>between the two leaflets</b> of the ER membrane, swelling a lens of fat. Three more!');
        } else {
          dropR = Math.max(dropR, 0.14 + fa * 0.03);
          kit.tween(drop.scale, { x: dropR, y: dropR, z: dropR, duration: 0.4, ease: 'back.out(2)' });
        }
      } });
  };
  const startLipids = () => {
    phase = 'lipid'; progress('lipid');
    kit.unlabel('p450');
    api.goal('Detox done! The smooth ER is also the cell’s <b>lipid factory</b>: its enzymes make <b>phospholipids</b>, <b>cholesterol</b> and <b>fats</b>. <b>Click the fatty acids</b> to feed them to the budding <b>lipid droplet</b>.');
    ctx.sfx('discovery_chime', { volume: 0.5 });
    kit.label('bud', 'Lipid droplet budding from the ER membrane', 'LD', () => BUD.clone().add(V(0, Math.max(0.3, dropR + 0.25), 0)));
    drop.scale.setScalar(0.12); dropR = 0.12;
    kit.from(drop.scale, { x: 0.001, y: 0.001, z: 0.001, duration: 0.6, ease: 'back.out(2)' });
    for (let k = 0; k < GOAL_FA; k++) makeFA(k);
    kit.label('fa', 'Fatty acids (from acetyl-CoA)', 'FA', () => { const f = fats.find((q) => q.state === 'idle' || q.state === 'in'); return f ? f.g.position.clone().add(V(0.35, 0.25, 0)) : null; });
  };

  const finale = () => {
    kit.unlabel('fa'); kit.unlabel('bud'); kit.unlabel('tg');
    // the droplet pinches off: a neutral-lipid core wrapped in a phospholipid monolayer
    ctx.sfx('vesicle_bud', { volume: 0.7, pitch: 0.9 });
    kit.ring(BUD.clone(), COL.drop, { r: 0.4, to: 2.4, life: 0.9, normal: V(0, 1, 0) });
    kit.burst(BUD.clone(), COL.drop, { count: 50, speed: 2.2, size: 0.22, life: 1.1 });
    const lift = BUD.clone().add(V(0, 1.0, 0.4));
    kit.tween(drop.position, { x: lift.x, y: lift.y, z: lift.z, duration: 1.4, ease: 'power2.out' });
    // ending reveal: gentle push-in on the finished droplet above the P450 stations
    ctx.rig.flyTo(framePose(ctx, lift.clone().lerp(ST[1].dome, 0.35), { yaw: yawDeg - 4, pitch: 33, dist: 9.2, fov: 40, sx: 0.13, sy: 0.0 }), 1.8);
    kit.tween(dropGlow.material, { opacity: 0.55, duration: 0.8 });
    kit.label('ld', 'Lipid droplet: fat core in a phospholipid monolayer', 'LD', () => drop.position.clone().add(V(0, dropR + 0.3, 0)));
    const caP = calcium.clone().add(V(0, 0.9, 0)), ndc = caP.clone().project(ctx.camera);
    if (Math.abs(ndc.x) < 0.7 && Math.abs(ndc.y) < 0.85) kit.label('ca', 'Ca²⁺ store: SERCA pumps load the ER lumen', 'Ca²⁺', caP);
    kit.burst(ST[1].dome.clone(), COL.sol, { count: 40, speed: 2.6, size: 0.2, life: 1.2 });
    api.finish(`<b>Shift complete!</b> Cytochrome <b>P450</b> enzymes added –OH groups to <b>${GOAL_TOX} fat-soluble drugs and toxins</b>, making them water-soluble so the body can <b>excrete</b> them, and the ER packed fresh <b>triglycerides</b> into a lipid droplet. Smooth ER: the cell’s <b>lipid factory</b>, <b>detox centre</b> (busiest in liver cells) and <b>calcium store</b>.`);
  };

  // ---------------------------------------------------------------- auto hook for tests
  hooks.auto = () => {
    if (phase === 'tox') { const t = toxins.find((q) => q.state === 'idle' || q.state === 'in'); if (t) catchToxin(t); }
    else if (phase === 'lipid') { const f = fats.find((q) => q.state === 'idle' || q.state === 'in'); if (f) feed(f); }
  };

  // ---------------------------------------------------------------- story
  const story = async () => {
    api.goal('Fat-soluble <b>drugs and toxins</b> (violet) are drifting into the smooth ER. <b>Click each one</b> to send it into a <b>P450 detox station</b>, which bolts on an <b>–OH group</b> so it can be washed out of the body.', true);
    progress('tox');
    ctx.sfx('whoosh', { volume: 0.5 });
    await ctx.rig.flyTo(framePose(ctx, center, { yaw: yawDeg - 4, pitch: 40, dist: 11.5, fov: 40, sx: 0.17, sy: 0.0 }), api.replay ? 0.8 : 1.9);
    kit.label('p450', 'Cytochrome P450 (heme enzyme in the ER membrane)', 'P450', ST[1].dome.clone().add(V(0, 0.45, 0)));
    lastAct = kit.time;
    // feed toxins: keep up to 3 waiting, one per station
    let spawned = 0;
    const spawnNext = () => {
      if (!kit.alive || spawned >= GOAL_TOX) return;
      const s = freeSlot();
      if (s === undefined) { kit.later(0.6, spawnNext); return; }
      makeToxin(TOXINS[spawned % TOXINS.length], s); spawned++;
      kit.later(spawned < 3 ? 1.1 : 1.8, spawnNext);
    };
    spawnNext();
  };
  story();

  // ---------------------------------------------------------------- per-frame
  const camQ = ctx.camera.quaternion;
  return (dt, t) => {
    for (const tox of toxins) {
      if (!tox.g.visible) continue;
      if (tox.state === 'idle') {
        tox.g.position.set(tox.home.x + Math.sin(t * 0.9 + tox.ph) * 0.35, tox.home.y + Math.sin(t * 1.3 + tox.ph * 2) * 0.18, tox.home.z + Math.cos(t * 0.7 + tox.ph) * 0.2);
      }
      tox.g.quaternion.copy(camQ);
      if (tox.state === 'idle' || tox.state === 'in') tox.body.rotation.z = Math.sin(t * 0.8 + tox.ph) * 0.5 + t * 0.2;
      const s = tox.hover ? 1.18 : 1;
      if (tox.state === 'idle') tox.g.scale.lerp(V(s, s, s), Math.min(1, dt * 10));
      tox.sheen.material.opacity = 0.35 + 0.15 * Math.sin(t * 3 + tox.ph) + (tox.hover ? 0.3 : 0);
    }
    for (const f of fats) {
      if (!f.g.visible) continue;
      if (f.state === 'idle') f.g.position.set(f.home.x + Math.sin(t * 1.1 + f.ph) * 0.15, f.home.y + Math.sin(t * 1.7 + f.ph) * 0.12, f.home.z);
      f.g.quaternion.copy(camQ); f.g.rotateZ(Math.sin(t * 2 + f.ph) * 0.3);
    }
    ST.forEach((s, i) => {
      s.flash = Math.max(0, (s.flash || 0) - dt * 1.5);
      heroGlow[i].material.opacity = 0.35 + 0.15 * Math.sin(t * 2.4 + i) + s.flash * 0.9;
      heroGlow[i].scale.setScalar(1.1 + s.flash * 1.2);
    });
    if (phase === 'lipid' || phase === 'tox') {
      drop.position.y += (Math.sin(t * 1.6) * 0.002);
      dropShell.scale.setScalar(1 + Math.sin(t * 2.2) * 0.02);
    }
    // hint if idle > 5 s
    const waiting = phase === 'tox' ? toxins.find((q) => q.state === 'idle') : phase === 'lipid' ? fats.find((q) => q.state === 'idle') : null;
    const late = waiting && t - lastAct > 5;
    hint.visible = !!late; clickTip.visible = !!late;
    if (late) {
      hint.position.copy(waiting.g.position); hint.quaternion.copy(camQ); hint.scale.setScalar(1 + 0.12 * Math.sin(t * 6));
      hint.material.opacity = 0.6 + 0.4 * Math.sin(t * 6);
      clickTip.position.copy(waiting.g.position).add(V(0, -0.75, 0));
      if (phase === 'tox' && waiting.spec) kit.label('hint', `${waiting.spec.name} · fat-soluble`, 'toxin', () => waiting.state === 'idle' ? waiting.g.position.clone().add(V(0, 0.5, 0)) : null);
    }
  };
}
