// Lysosomes — "Recycle".
// A magnified hologram of one lysosome's lumen hovers over recycling plant B. First the player runs the V-ATPase proton
// pump until the lumen reaches pH ≈ 4.5 (the acid hydrolases wake up — they barely work at the cytosol's pH 7.2).
// Then the player feeds three worn parts from the tray beside the intake conveyor: an old mitochondrion fragment
// (wrapped in an autophagosome — autophagy), a misfolded protein aggregate (autophagy) and a bacterium (phagosome —
// phagocytosis). Each rides the conveyor in, fuses with the lysosome, and cathepsins / lipases / nucleases /
// glycosidases chop it into building blocks (amino acids, sugars, fatty acids, nucleotides) that leave through
// membrane transporters for reuse.
// Takeaway: Lysosomes use acid hydrolases at pH 4.5–5 to digest worn-out parts and engulfed material into building
// blocks the cell reuses.
import * as THREE from 'three';
import { runActivity, anchorsOf, framePose, tweenAlong, mergeByMaterial } from './_shared.js';
import { LYSO } from '../../world/layout.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const D = Math.PI / 180;
const PI = 1; // which plant (LYSO[1] is the examined district)
const MR = 1.72, MC = V(-1.3, -0.08, 0); // membrane radius / centre (plate local)
const BLOCK = {
  aa: { name: 'Amino acids', color: 0x3fe6ff, y: 1.05, reuse: 'new proteins' },
  sugar: { name: 'Sugars', color: 0xff6ac8, y: 0.45, reuse: 'energy & glycans' },
  lipid: { name: 'Fatty acids', color: 0xffc23a, y: -0.15, reuse: 'new membranes' },
  nt: { name: 'Nucleotides', color: 0xb98aff, y: -0.75, reuse: 'new DNA & RNA' },
};
const ENZ = [
  { id: 'cath', name: 'Cathepsins (proteases)', color: 0x3fe6ff, eats: 'aa' },
  { id: 'lip', name: 'Lipases', color: 0xffc23a, eats: 'lipid' },
  { id: 'nuc', name: 'Nucleases', color: 0xb98aff, eats: 'nt' },
  { id: 'gly', name: 'Glycosidases (e.g. lysozyme)', color: 0xff6ac8, eats: 'sugar' },
];
const ITEMS = [
  { id: 'mito', name: 'Worn mitochondrion fragment', route: 'Autophagy: wrapped in an autophagosome (double membrane)', short: 'autophagy', yields: { aa: 5, lipid: 4, nt: 2 } },
  { id: 'prot', name: 'Misfolded protein aggregate (ubiquitin-tagged)', route: 'Autophagy: the aggregate is wrapped in an autophagosome', short: 'autophagy', yields: { aa: 8 } },
  { id: 'bact', name: 'Engulfed bacterium', route: 'Phagocytosis: enclosed in a phagosome', short: 'phagocytosis', yields: { aa: 4, sugar: 4, lipid: 3, nt: 3 } },
];
const PH0 = 7.2, PH1 = 4.5, PUMPS = 4;

export function start(ctx) {
  const hooks = {};
  const inst = runActivity(ctx, (kit, api) => build(kit, api, ctx, hooks));
  inst._auto = () => hooks.auto?.();
  return inst;
}

function build(kit, api, ctx, hooks) {
  api.buttons([]); // clear the previous run's Play again / Finish buttons on replay
  const A = anchorsOf(ctx, 'lysosomes');
  const Ld = LYSO[PI], C = V(Ld.x, 0, Ld.z), H = Ld.r * 1.1 + 0.35;
  const intake = A[`lysoIntake${PI}`] || A.lysoIntake || C.clone().add(V(-1.5, 0.6, 2));
  const gaugeP = A[`phGauge${PI}`] || A.phGauge || C.clone().add(V(1.8, 1.2, 0.6));
  const dir = intake.clone().sub(C).setY(0).normalize();           // plant → intake (conveyor axis)
  const perp = V(-dir.z, 0, dir.x);                                // across the conveyor
  const in0 = C.clone().addScaledVector(dir, Ld.r + 1.05).setY(0.55);
  const in1 = C.clone().addScaledVector(dir, Ld.r + 0.25).setY(0.6);
  const camYaw = -14;

  // ---------------------------------------------------------------- hologram: the lumen of one lysosome
  const right = V(Math.cos(camYaw * D), 0, -Math.sin(camYaw * D));
  const plate = kit.holoPlate({ w: 7.0, h: 4.3, color: 0xa6ff5a, pos: C.clone().addScaledVector(right, 4.7).add(V(0, 3.75, -1.3)), yaw: camYaw * D, opacity: 0.8, title: 'MAGNIFIED · INSIDE ONE LYSOSOME' });
  const P = new THREE.Group(); plate.add(P); P.position.z = 0.05;
  const W = (x, y, z = 0.3) => P.localToWorld(V(x, y, z));
  const back = new THREE.Mesh(new THREE.PlaneGeometry(6.8, 4.1), kit.own(new THREE.MeshBasicMaterial({ color: 0x0c1a10, transparent: true, opacity: 0.88, depthWrite: false })));
  back.position.z = -0.04; P.add(back);
  kit.beam(C.clone().add(V(0, H + 0.1, 0)), W(MC.x, MC.y - 0.4, 0), 0xa6ff5a, 0.15, 0.7, 0.1);
  kit.light(0xb8ff7a, 8, 10, C.clone().add(V(0, H + 1.5, 2.5)));
  const topGlow = kit.sprite(0xa6ff4a, 2.6, 0.0); topGlow.position.copy(C).add(V(0, H + 0.2, 0)); kit.add(topGlow);

  // lumen tint (bluish at pH 7.2 → acid lime at 4.5)
  const lumenMat = kit.additive(0x4aa0ff, 0.16, 1);
  const lumen = new THREE.Mesh(new THREE.CircleGeometry(MR - 0.06, 64), lumenMat); lumen.position.copy(MC).setZ(0.02); P.add(lumen);
  const cNeutral = new THREE.Color(0x4aa0ff).multiplyScalar(1.4), cAcid = new THREE.Color(0x9dff3a).multiplyScalar(1.4);
  // membrane: two leaflets of phospholipid heads
  const NH = 64;
  const heads = kit.beads(NH * 2, 0.06, { intensity: 1.6, parent: P });
  for (let k = 0; k < NH; k++) {
    const a = (k / NH) * Math.PI * 2;
    for (const [j, r] of [[0, MR], [1, MR - 0.17]]) heads.set(k * 2 + j, V(MC.x + Math.cos(a) * r, MC.y + Math.sin(a) * r, 0.05), 1, j ? 0xffe0a0 : 0xffc070);
  }
  heads.commit();
  const tails = new THREE.Mesh(new THREE.RingGeometry(MR - 0.15, MR - 0.02, 96), kit.glow(0xffd8a0, 0.5, { opacity: 0.55 })); tails.position.copy(MC).setZ(0.04); P.add(tails);
  // LAMP glycoproteins: sugar coat lining the inside
  const lamp = kit.beads(18, 0.045, { intensity: 2.6, parent: P });
  for (let k = 0; k < 18; k++) { const a = (k / 18) * Math.PI * 2 + 0.1; lamp.set(k, V(MC.x + Math.cos(a) * (MR - 0.3), MC.y + Math.sin(a) * (MR - 0.3), 0.06), 1, 0xff9ad8); }
  lamp.commit();
  const cap = (s, x, y, col = '#d8ffc0', h = 0.18) => { const t = kit.text(s, { h, fg: col, font: '800 64px Montserrat, sans-serif' }); t.position.set(x + (h * t.userData.aspect) / 2, y, 0.08); P.add(t); return t; };
  cap('LUMEN', MC.x - 0.45, MC.y + MR * 0.62, '#c8ffb0', 0.28);
  cap('CYTOSOL pH 7.2', 1.0, -1.62, '#9fd0ff', 0.31);

  // V-ATPase proton pump (upper right of the membrane), clickable
  const pumpA = 38 * D, pumpP = V(MC.x + Math.cos(pumpA) * (MR - 0.08), MC.y + Math.sin(pumpA) * (MR - 0.08), 0.12);
  const pump = new THREE.Group(); pump.position.copy(pumpP); pump.rotation.z = pumpA - Math.PI / 2; P.add(pump);
  const pumpMat = kit.gloss(0x3fd0ff, { emissive: 0x1aa8ff, ei: 0.8, rough: 0.22 });
  const pumpDark = kit.gloss(0x1a7aa8, { ei: 0.4 });
  { const v0 = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.34, 18), pumpDark); pump.add(v0);
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.3, 10), pumpDark); stalk.position.y = 0.3; pump.add(stalk);
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; const s = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 10), pumpMat); s.position.set(Math.cos(a) * 0.15, 0.55, Math.sin(a) * 0.15); pump.add(s); }
    const hit = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), kit.own(new THREE.MeshBasicMaterial({ visible: false }))); hit.position.y = 0.25; pump.add(hit); }
  // transporter (lower right) — building blocks exit here to the cytosol
  const exA = -42 * D, exP = V(MC.x + Math.cos(exA) * (MR - 0.08), MC.y + Math.sin(exA) * (MR - 0.08), 0.12);
  { const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.42, 16, 1, true), kit.gloss(0x9dff6a, { ei: 0.8 })); tr.position.copy(exP); tr.rotation.z = exA - Math.PI / 2; tr.material.side = THREE.DoubleSide; P.add(tr); }
  const exOut = V(MC.x + Math.cos(exA) * (MR + 0.45), MC.y + Math.sin(exA) * (MR + 0.45), 0.2);
  // fusion point (top left): vesicles arrive here
  const fuA = 118 * D, fuP = V(MC.x + Math.cos(fuA) * MR, MC.y + Math.sin(fuA) * MR, 0.2);

  // pH scale (right of the membrane)
  const PX = 0.95, PY0 = -1.25, PY1 = 1.35;
  const phY = (ph) => PY0 + (PY1 - PY0) * ((ph - 4) / (8 - 4));
  { const bar = new THREE.Mesh(new THREE.PlaneGeometry(0.16, PY1 - PY0), kit.own(new THREE.MeshBasicMaterial({ map: kit.own(phTex()), transparent: true, toneMapped: false }))); bar.position.set(PX, (PY0 + PY1) / 2, 0.06); P.add(bar);
    for (const ph of [4, 5, 6, 7, 8]) cap(String(ph), PX + 0.14, phY(ph), '#e8ffe0', 0.3);
    const band = new THREE.Mesh(new THREE.PlaneGeometry(0.34, phY(5) - phY(4.5)), kit.additive(0x9dff3a, 0.35, 1.5)); band.position.set(PX, (phY(4.5) + phY(5)) / 2, 0.05); P.add(band);
    cap('pH', PX - 0.16, PY1 + 0.3, '#e8ffe0', 0.3); }
  const phPtr = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.2, 3), kit.glow(0xffffff, 4)); phPtr.rotation.z = -Math.PI / 2; phPtr.position.set(PX - 0.2, phY(PH0), 0.1); P.add(phPtr);

  // legend / collection bins for building blocks
  const LX = 1.62;
  const bins = {};
  for (const [k, b] of Object.entries(BLOCK)) {
    const bead = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), kit.glow(b.color, 3.6)); bead.position.set(LX, b.y, 0.1); P.add(bead);
    cap(b.name.toUpperCase(), LX + 0.22, b.y, '#' + new THREE.Color(b.color).getHexString(), 0.3);
    bins[k] = { bead, n: 0, pos: V(LX, b.y, 0.15), pulse: 0 };
  }
  cap('REUSED BY THE CELL', LX - 0.12, 1.6, '#e8ffe0', 0.26);

  // ---------------------------------------------------------------- acid hydrolases (pac-man style jaws)
  const enz = ENZ.map((e, i) => {
    const g = new THREE.Group(); P.add(g);
    const m = kit.gloss(e.color, { emissive: e.color, ei: 0.25, rough: 0.25 }); m.side = THREE.DoubleSide;
    const up = new THREE.Mesh(new THREE.SphereGeometry(0.2, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), m);
    const lo = new THREE.Mesh(new THREE.SphereGeometry(0.2, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), m);
    g.add(up, lo);
    const a = (i / ENZ.length) * Math.PI * 2 + 0.4;
    const home = V(MC.x + Math.cos(a) * 0.98, MC.y + Math.sin(a) * 0.92, 0.25);
    g.position.copy(home);
    return { ...e, g, up, lo, m, home, ph: i * 1.7, target: null, chomp: 0 };
  });

  // ---------------------------------------------------------------- worn parts on a tray beside the intake
  const makeItem = (id, s = 1) => {
    const g = new THREE.Group();
    if (id === 'mito') {
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.36, 8, 18), kit.gloss(0xc0682a, { emissive: 0x803010, ei: 0.5 })); body.rotation.z = Math.PI / 2; g.add(body);
      const cr = kit.gloss(0xf3d9b8, { ei: 0.3 });
      for (const x of [-0.17, 0, 0.17]) { const f = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.025, 6, 20), cr); f.position.x = x; f.rotation.y = Math.PI / 2; f.scale.set(1, 1.05, 1); g.add(f); }
      const dent = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), kit.gloss(0x5a3018, { ei: 0.1 })); dent.position.set(0.12, 0.13, 0.08); g.add(dent);
    } else if (id === 'prot') {
      const m = kit.gloss(0x6fc8d8, { emissive: 0x2a8090, ei: 0.5 });
      const bad = kit.gloss(0xff5a4a, { emissive: 0xc02010, ei: 0.8 });
      const ub = kit.glow(0xd8ff5a, 2.8);
      let prev = null;
      for (let k = 0; k < 16; k++) {
        const t = k / 15, p = V(Math.sin(t * 9) * 0.22, Math.cos(t * 7) * 0.18, Math.sin(t * 13) * 0.14);
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), k % 5 === 2 ? bad : m); b.position.copy(p); g.add(b);
        if (prev) { const st = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, prev.distanceTo(p), 6), m); st.position.copy(prev).lerp(p, 0.5); st.quaternion.setFromUnitVectors(V(0, 1, 0), p.clone().sub(prev).normalize()); g.add(st); }
        prev = p;
      }
      for (const [x, y] of [[0.28, 0.14], [0.36, 0.2], [0.42, 0.28]]) { const u = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), ub); u.position.set(x, y, 0); g.add(u); }
    } else {
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.42, 8, 18), kit.gloss(0xd8489c, { emissive: 0x902060, ei: 0.55 })); body.rotation.z = Math.PI / 2; g.add(body);
      const fl = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(-0.34, 0, 0), V(-0.5, 0.08, 0), V(-0.62, -0.06, 0), V(-0.76, 0.06, 0), V(-0.88, -0.02, 0)]), 24, 0.018, 6), kit.gloss(0xffa0d8, { ei: 0.6 })); g.add(fl);
      const pil = kit.gloss(0xffb8e0, { ei: 0.5 });
      for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; const p = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.1, 4), pil); p.position.set(-0.15 + (k % 4) * 0.1, Math.cos(a) * 0.17, Math.sin(a) * 0.17); p.rotation.x = a; g.add(p); }
    }
    mergeByMaterial(g);
    g.scale.setScalar(s);
    return g;
  };
  const toCam = V(Math.sin(camYaw * D), 0, Math.cos(camYaw * D));
  const tray = [];
  ITEMS.forEach((it, i) => {
    const pos = C.clone().addScaledVector(toCam, Ld.r + 1.5).addScaledVector(right, 1.0 + (i - 1) * 1.0).setY(1.15);
    const pad = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.025, 8, 40), kit.additive(0xa6ff5a, 0.7, 2.5)); pad.rotation.x = Math.PI / 2; pad.position.copy(pos).add(V(0, -0.42, 0)); kit.add(pad);
    const padGlow = kit.sprite(0xa6ff5a, 0.9, 0.3); padGlow.position.copy(pad.position); kit.add(padGlow);
    const g = makeItem(it.id, 1.25); g.position.copy(pos); kit.add(g);
    const hit = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), kit.own(new THREE.MeshBasicMaterial({ visible: false }))); g.add(hit);
    const t = { ...it, g, pos, pad, padGlow, state: 'wait', ph: i * 2.1 };
    t.pick = kit.pick(g, () => feed(t), { onHover: (on) => { t.hover = on; } }); t.pick.enabled = false;
    tray.push(t);
  });

  // ---------------------------------------------------------------- state + progress
  let phase = 'intro', ph = PH0, pumps = 0, fed = 0, digested = 0, lastAct = 0, busy = false;
  const totals = { aa: 0, sugar: 0, lipid: 0, nt: 0 };
  const progress = () => {
    if (phase === 'done') api.progress(1, `Complete! · amino acids ${totals.aa} · sugars ${totals.sugar} · lipids ${totals.lipid} · nucleotides ${totals.nt}`);
    else if (phase === 'acid' || phase === 'intro') api.progress(0.2 * pumps / PUMPS, `Lumen pH: ${ph.toFixed(1)}  (target 4.5–5)`);
    else api.progress(0.2 + 0.8 * digested / ITEMS.length, `Parts recycled: ${digested} / ${ITEMS.length}  ·  amino acids ${totals.aa} · sugars ${totals.sugar} · lipids ${totals.lipid} · nucleotides ${totals.nt}`);
  };

  // protons
  const NPH = 40;
  const prot = kit.beads(NPH, 0.05, { intensity: 6, parent: P });
  const protons = Array.from({ length: NPH }, () => ({ on: false, p: V(0, 0, 0), v: V(0, 0, 0) }));
  const pinkC = new THREE.Color(0xff3d6e);

  const pressPump = () => {
    if (phase !== 'acid' || pumps >= PUMPS) return;
    pumps++; lastAct = kit.time;
    ctx.sfx('button_press', { volume: 0.5 }); ctx.sfx('atp_pop', { volume: 0.4, pitch: 0.9 + pumps * 0.06 });
    kit.ring(W(pumpP.x, pumpP.y, 0.4), 0x3fd0ff, { r: 0.25, to: 1.0, life: 0.5 });
    kit.tween(pump.scale, { x: 1.2, y: 1.2, z: 1.2, duration: 0.12, yoyo: true, repeat: 1 });
    // ATP → ADP + Pi spark on the cytosolic side
    kit.burst(W(pumpP.x + 0.35, pumpP.y + 0.4, 0.4), 0xffc23a, { count: 14, speed: 1, size: 0.14, life: 0.5 });
    const n = 8, from = ph, to = pumps >= PUMPS ? PH1 : PH0 - (PH0 - PH1) * (pumps / PUMPS) * 0.92;
    for (let k = 0; k < n; k++) {
      const q = protons.find((r) => !r.on); if (!q) break;
      q.on = true;
      const start = pumpP.clone().add(V(Math.cos(pumpA) * 0.7, Math.sin(pumpA) * 0.7, 0.2));
      const inside = V(MC.x + (Math.random() - 0.5) * 1.6, MC.y + (Math.random() - 0.5) * 1.6, 0.22);
      if (inside.distanceTo(MC) > MR - 0.35) inside.sub(MC).setLength(MR - 0.4).add(MC).setZ(0.22);
      q.p.copy(start); q.v.set(0, 0, 0); q.mode = 'in';
      tweenAlong(kit, [start, pumpP.clone().setZ(0.25), inside], { duration: 0.7, delay: k * 0.07, ease: 'power2.inOut', onPos: (v) => q.p.copy(v), onComplete: () => { q.mode = 'free'; q.v.set((Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4, 0); } });
    }
    const o = { v: from };
    kit.tween(o, { v: to, duration: 0.9, ease: 'power1.out', onUpdate: () => { ph = o.v; progress(); } });
    if (pumps >= PUMPS) kit.later(1.1, () => acidReady());
    else api.goal(`<b>V-ATPase</b> spends ATP to pump <b>H⁺</b> into the lysosome. Lumen pH ${to.toFixed(1)}… keep pumping (${pumps}/${PUMPS}).`);
  };
  kit.pick(pump, () => pressPump(), { onHover: (on) => { pump.userData.hover = on; } });

  const acidReady = () => {
    phase = 'feed'; ph = PH1; progress(); lastAct = kit.time;
    kit.unlabel('vatp'); kit.unlabel('lamp');
    ctx.sfx('discovery_chime', { volume: 0.55 });
    kit.ring(W(MC.x, MC.y, 0.3), 0x9dff3a, { r: 0.5, to: 2.4, life: 0.9 });
    enz.forEach((e) => kit.tween(e.m, { emissiveIntensity: 1.6, duration: 0.8 }));
    kit.label('enz', 'Acid hydrolases: active at pH 4.5–5, nearly idle at pH 7.2', 'pH 4.5', () => W(MC.x - 0.2, MC.y + 0.55, 0.4));
    kit.later(4.5, () => kit.unlabel('enz'));
    api.goal('<b>pH 4.5!</b> The ~60 kinds of <b>acid hydrolases</b> are awake. Now <b>click a worn part</b> on the tray to send it into the recycling plant.');
    for (const t of tray) { t.state = 'ready'; t.pick.enabled = true; }
    kit.label('tray', 'Worn parts waiting for recycling', 'in', () => { const t = tray.find((q) => q.state === 'ready'); return t ? t.g.position.clone().add(V(0, 0.55, 0)) : null; });
  };

  // ---------------------------------------------------------------- feed one worn part
  const feed = (t) => {
    if (t.state !== 'ready' || busy) { if (busy && t.state === 'ready') ctx.sfx('error_soft', { volume: 0.3 }); return; }
    busy = true; t.state = 'going'; t.pick.enabled = false; fed++; lastAct = kit.time;
    kit.unlabel('tray');
    ctx.sfx('ui_click', { volume: 0.5 }); ctx.sfx('vesicle_bud', { volume: 0.5 });
    kit.tween(t.pad.material, { opacity: 0.1, duration: 0.5 }); kit.tween(t.padGlow.material, { opacity: 0, duration: 0.5 });
    // wrap: autophagosome (double membrane) or phagosome (single)
    const shellM = kit.gloss(0xe8ffd8, { emissive: 0xb8ff8a, ei: 0.5, opacity: 0.28, rough: 0.1 });
    const shell = new THREE.Group();
    const s1 = new THREE.Mesh(new THREE.SphereGeometry(0.62, 28, 20), shellM); shell.add(s1);
    if (t.short === 'autophagy') { const s2 = new THREE.Mesh(new THREE.SphereGeometry(0.7, 28, 20), shellM); shell.add(s2); }
    shell.scale.setScalar(0.01); t.g.add(shell);
    kit.tween(shell.scale, { x: 1, y: 1, z: 1, duration: 0.6, ease: 'back.out(1.6)' });
    kit.label('route', t.route, t.short === 'autophagy' ? 'autophagy' : 'phagocytosis', () => (t.g.visible ? t.g.position.clone().add(V(0, 0.75, 0)) : null));
    api.goal(`<b>${t.name}</b>. ${t.route}. It rides the conveyor into the plant…`);
    // ride the conveyor into the intake hatch
    kit.later(0.7, () => {
      ctx.sfx('parcel_thunk', { volume: 0.35 });
      const p0 = t.g.position.clone();
      tweenAlong(kit, [p0, p0.clone().lerp(in0, 0.5).add(V(0, 0.9, 0)), in0.clone().addScaledVector(dir, 0.3).add(V(0, 0.3, 0)), in0.clone().add(V(0, 0.15, 0)), in1.clone().add(V(0, 0.15, 0))], {
        duration: 2.2, ease: 'power1.inOut', onPos: (v) => t.g.position.copy(v),
        onComplete: () => { kit.tween(t.g.scale, { x: 0.01, y: 0.01, z: 0.01, duration: 0.3, onComplete: () => { t.g.visible = false; } }); kit.unlabel('route'); arrive(t); },
      });
    });
  };

  // ---------------------------------------------------------------- fusion + digestion in the hologram
  const arrive = (t) => {
    ctx.sfx('vesicle_bloop', { volume: 0.6, pitch: 0.8 });
    topGlow.material.opacity = 0.9; kit.tween(topGlow.material, { opacity: 0.25, duration: 2.5 });
    const HS = 1.9;
    const hi = makeItem(t.id, HS); hi.position.set(fuP.x - 0.3, fuP.y + 0.55, 0.35); hi.scale.setScalar(0.01); P.add(hi);
    const vm = new THREE.Mesh(new THREE.SphereGeometry(0.5, 28, 20), kit.gloss(0xe8ffd8, { emissive: 0xb8ff8a, ei: 0.6, opacity: 0.22, rough: 0.1 })); hi.add(vm);
    kit.tween(hi.scale, { x: HS, y: HS, z: HS, duration: 0.6, ease: 'back.out(1.5)' });
    tweenAlong(kit, [hi.position.clone(), fuP.clone().setZ(0.35), V(MC.x, MC.y + 0.05, 0.35)], {
      duration: 1.5, delay: 0.3, ease: 'power2.inOut', onPos: (v) => hi.position.copy(v),
      onComplete: () => {
        // vesicle membrane merges with the lysosome membrane
        kit.tween(vm.scale, { x: 1.7, y: 1.7, z: 1.7, duration: 0.5 }); kit.tween(vm.material, { opacity: 0, duration: 0.5, onComplete: () => { vm.visible = false; } });
        kit.ring(W(fuP.x, fuP.y, 0.4), 0xe8ffd8, { r: 0.3, to: 1.4, life: 0.6 });
        ctx.sfx('bubble', { volume: 0.6 });
        digest(t, hi);
      },
    });
  };

  const digest = (t, hi) => {
    const kinds = Object.keys(t.yields);
    const active = enz.filter((e) => kinds.includes(e.eats));
    active.forEach((e, i) => { e.target = hi; e.slot = (i / active.length) * Math.PI * 2 + 0.6; });
    let li = 0;
    const cycle = () => { if (!active[0].target) return; const e = active[li++ % active.length]; kit.unlabel('enzA'); kit.label('enzA' + li, e.name, 'enzyme', () => W(e.g.position.x, e.g.position.y + 0.22, 0.4)); kit.unlabel('enzA' + (li - 1)); kit.later(1.3, cycle); };
    cycle();
    api.goal(`<b>Fusion!</b> Acid hydrolases attack: ${active.map((e) => `<b>${e.name.split(' (')[0]}</b>`).join(', ')} break it into <b>building blocks</b>.`);
    const list = []; for (const k of kinds) for (let n = 0; n < t.yields[k]; n++) list.push(k);
    list.sort(() => Math.random() - 0.5);
    const total = list.length, dur = 3.4;
    list.forEach((k, i) => kit.later(0.5 + (i / total) * dur, () => {
      const from = hi.position.clone().add(V((Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3, 0.05));
      spawnBlock(k, from, i);
      ctx.sfx('atp_pop', { volume: 0.25, pitch: 1.3 + Math.random() * 0.3 });
    }));
    kit.tween(hi.scale, { x: 0.05, y: 0.05, z: 0.05, duration: dur + 0.4, delay: 0.4, ease: 'power1.in', onComplete: () => { hi.visible = false; } });
    kit.tween(hi.rotation, { z: 2.5, duration: dur + 0.4, delay: 0.4 });
    kit.later(0.5 + dur + 1.9, () => {
      active.forEach((e) => { e.target = null; }); for (let k = 0; k <= 20; k++) kit.unlabel('enzA' + k);
      digested++; busy = false; progress(); lastAct = kit.time;
      ctx.sfx('success_flourish', { volume: 0.2 });
      const got = kinds.map((k) => `${t.yields[k]} ${BLOCK[k].name.toLowerCase()}`).join(', ');
      if (digested >= ITEMS.length) finale();
      else {
        api.goal(`Recycled into <b>${got}</b>, sent out through membrane transporters to build ${kinds.map((k) => BLOCK[k].reuse).join(', ')}. <b>Click the next worn part.</b>`);
        kit.label('tray', 'Worn parts waiting for recycling', 'in', () => { const q = tray.find((r) => r.state === 'ready'); return q ? q.g.position.clone().add(V(0, 0.55, 0)) : null; });
      }
    });
  };

  // building blocks: scatter in the lumen, then leave through the transporter to their bin
  const blocks = [];
  const spawnBlock = (k, from, i) => {
    const b = BLOCK[k];
    const m = new THREE.Mesh(new THREE.SphereGeometry(k === 'nt' ? 0.075 : 0.065, 14, 10), kit.glow(b.color, 4)); m.position.copy(from); P.add(m);
    blocks.push(m);
    const mid = V(MC.x + (Math.random() - 0.5) * 1.4, MC.y + (Math.random() - 0.5) * 1.3, 0.3);
    if (mid.distanceTo(MC) > MR - 0.4) mid.sub(MC).setLength(MR - 0.45).add(MC).setZ(0.3);
    kit.burst(W(from.x, from.y, 0.45), b.color, { count: 6, speed: 0.6, size: 0.1, life: 0.4 });
    tweenAlong(kit, [from, mid], { duration: 0.6, ease: 'power2.out', onPos: (v) => m.position.copy(v),
      onComplete: () => tweenAlong(kit, [mid, exP.clone().setZ(0.3), exOut.clone(), bins[k].pos.clone()], { duration: 1.3, delay: 0.2 + (i % 4) * 0.08, ease: 'power1.inOut', onPos: (v) => m.position.copy(v),
        onComplete: () => { m.visible = false; bins[k].n++; bins[k].pulse = 1; totals[k]++; progress(); ctx.sfx('bubble', { volume: 0.2, pitch: 1.6 }); } }) });
  };

  const finale = () => {
    phase = 'done';
    kit.unlabel('tray');
    kit.ring(W(MC.x, MC.y, 0.3), 0x9dff3a, { r: 0.6, to: 3.2, life: 1.1 });
    kit.burst(W(LX, 0.2, 0.4), 0xffffff, { count: 60, speed: 2.4, size: 0.22, life: 1.2 });
    kit.label('ph', 'pH ≈ 4.5–5 (V-ATPase keeps it acidic)', 'pH', gaugeP.clone().add(V(0, 0.35, 0)));
    api.finish(`<b>All recycled!</b> At <b>pH 4.5</b>, the lysosome’s <b>acid hydrolases</b> digested a worn mitochondrion and a misfolded protein (delivered by <b>autophagy</b>) and a bacterium (delivered by <b>phagocytosis</b>) into <b>${totals.aa} amino acids, ${totals.sugar} sugars, ${totals.lipid} lipids and ${totals.nt} nucleotides</b>: building blocks the cell <b>reuses</b>.`);
  };

  // ---------------------------------------------------------------- auto hook (tests)
  hooks.auto = () => {
    if (phase === 'acid') pressPump();
    else if (phase === 'feed' && !busy) { const t = tray.find((q) => q.state === 'ready'); if (t) feed(t); }
  };

  // ---------------------------------------------------------------- story
  const story = async () => {
    api.goal('This recycling plant is a <b>lysosome</b>. Its digestive enzymes only work in <b>acid</b>, so first <b>click the V-ATPase proton pump</b> (blue, on the membrane) to pump H⁺ in until the lumen reaches <b>pH 4.5</b>.', true);
    progress();
    kit.from(P.scale, { x: 0.01, y: 0.01, z: 0.01, duration: 1.0, delay: 0.4, ease: 'back.out(1.4)' });
    ctx.sfx('whoosh', { volume: 0.5 });
    const center = C.clone().addScaledVector(right, 2.6).add(V(0, 2.75, 0.4));
    await ctx.rig.flyTo(framePose(ctx, center, { yaw: camYaw, pitch: 22, dist: 11.8, fov: 40, sx: 0.1, sy: 0.0 }), api.replay ? 0.8 : 1.9);
    phase = 'acid'; lastAct = kit.time;
    kit.label('vatp', 'V-ATPase: ATP-powered H⁺ pump', 'V-ATPase', () => W(pumpP.x - 0.55, pumpP.y - 0.5, 0.4)); // inside the frame, clear of the header and the pH chip
    kit.label('lamp', 'LAMP1/2 glycoproteins shield the membrane', 'LAMP', () => W(MC.x - MR + 0.3, MC.y - 0.85, 0.3));
  };
  story();

  // ---------------------------------------------------------------- hint
  const hint = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.035, 8, 48), kit.additive(0xfff1a0, 0.9, 3.2)); hint.visible = false; kit.add(hint);
  const clickTip = kit.text('CLICK', { h: 0.2, fg: '#1a1030', bg: '#ffe680', font: '900 64px Montserrat, sans-serif', radius: 50, sprite: true }); clickTip.visible = false; kit.add(clickTip);

  // ---------------------------------------------------------------- per-frame
  const camQ = ctx.camera.quaternion, tmp = V(0, 0, 0);
  let shownPh = null;
  return (dt, t) => {
    // pH visuals
    phPtr.position.y += (phY(ph) - phPtr.position.y) * Math.min(1, dt * 8);
    const acid = THREE.MathUtils.clamp((PH0 - ph) / (PH0 - PH1), 0, 1);
    lumenMat.color.copy(cNeutral).lerp(cAcid, acid);
    lumenMat.opacity = 0.12 + 0.1 * acid + (busy ? 0.05 * Math.sin(t * 6) : 0);
    const phs = ph.toFixed(1);
    if ((phase === 'acid' || phase === 'feed' || phase === 'done') && phs !== shownPh) { kit.unlabel('phv' + shownPh); shownPh = phs; kit.label('phv' + phs, `pH ${phs}`, 'lumen', () => W(PX - 0.45, phPtr.position.y + 0.12, 0.3)); }
    // protons drift in the lumen
    for (let i = 0; i < NPH; i++) {
      const q = protons[i];
      if (!q.on) { prot.hide(i); continue; }
      if (q.mode === 'free') {
        q.v.x += (Math.random() - 0.5) * dt * 3; q.v.y += (Math.random() - 0.5) * dt * 3; q.v.multiplyScalar(1 - dt * 1.2);
        q.p.addScaledVector(q.v, dt);
        tmp.copy(q.p).sub(MC); tmp.z = 0;
        if (tmp.length() > MR - 0.32) { tmp.setLength(MR - 0.32); q.p.x = MC.x + tmp.x; q.p.y = MC.y + tmp.y; q.v.multiplyScalar(-0.5); }
      }
      prot.set(i, q.p, 1, pinkC);
    }
    prot.commit();
    // enzymes: wander, or swarm and chomp a target
    for (const e of enz) {
      let goal;
      if (e.target && e.target.visible) { const a = e.slot + t * 0.6; goal = V(e.target.position.x + Math.cos(a) * 0.68, e.target.position.y + Math.sin(a) * 0.62, 0.3); }
      else goal = V(e.home.x + Math.sin(t * 0.5 + e.ph) * 0.2, e.home.y + Math.cos(t * 0.6 + e.ph) * 0.18, 0.25);
      e.g.position.lerp(goal, Math.min(1, dt * 3));
      const look = e.target && e.target.visible ? Math.atan2(e.target.position.y - e.g.position.y, e.target.position.x - e.g.position.x) : Math.sin(t * 0.7 + e.ph) * 0.6 + (e.ph > 3 ? Math.PI : 0);
      e.g.rotation.z += (look - e.g.rotation.z) * Math.min(1, dt * 5);
      const awake = THREE.MathUtils.clamp((PH0 - ph) / (PH0 - PH1), 0, 1);
      const speed = e.target ? 14 : 3 + 3 * awake;
      const open = (0.08 + 0.4 * awake) * (0.5 + 0.5 * Math.sin(t * speed + e.ph));
      e.up.rotation.z = open; e.lo.rotation.z = -open;
    }
    for (const b of Object.values(bins)) { b.pulse = Math.max(0, b.pulse - dt * 3); b.bead.scale.setScalar(1 + b.pulse * 0.6 + Math.min(0.8, b.n * 0.03)); }
    // tray items bob + spin
    for (const it of tray) {
      if (it.state === 'wait' || it.state === 'ready') {
        it.g.position.set(it.pos.x, it.pos.y + Math.sin(t * 1.6 + it.ph) * 0.06, it.pos.z);
        it.g.rotation.y = t * 0.5 + it.ph;
        const s = 1.25 * (it.hover ? 1.15 : 1); it.g.scale.lerp(V(s, s, s), Math.min(1, dt * 10));
        it.pad.material.opacity = it.state === 'ready' ? 0.5 + 0.35 * Math.sin(t * 3 + it.ph) : 0.25;
      }
    }
    pump.children.forEach((c, i) => { if (i >= 2 && i < 8) c.position.y = 0.55 + Math.sin(t * 8 + i) * (phase === 'acid' ? 0.02 : 0.005); });
    pumpMat.emissiveIntensity = phase === 'acid' ? 1.2 + 0.8 * (0.5 + 0.5 * Math.sin(t * 5)) + (pump.userData.hover ? 1 : 0) : 0.8;
    // hint after 5 s of inactivity
    let tgt = null;
    if (phase === 'acid') tgt = W(pumpP.x, pumpP.y + 0.25, 0.45);
    else if (phase === 'feed' && !busy) { const it = tray.find((q) => q.state === 'ready'); if (it) tgt = it.g.position.clone(); }
    const late = tgt && t - lastAct > 5;
    hint.visible = !!late; clickTip.visible = !!late;
    if (late) {
      hint.position.copy(tgt); hint.quaternion.copy(camQ); hint.scale.setScalar(1 + 0.12 * Math.sin(t * 6)); hint.material.opacity = 0.6 + 0.4 * Math.sin(t * 6);
      clickTip.position.copy(tgt).add(V(0, -0.7, 0));
    }
  };
}

/** Vertical pH colour scale (4 at the bottom → 8 at the top): red-orange acid → green neutral → blue base. */
function phTex() {
  const c = document.createElement('canvas'); c.width = 8; c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 256, 0, 0);
  grd.addColorStop(0, '#ff3a2a'); grd.addColorStop(0.25, '#ff9a2a'); grd.addColorStop(0.5, '#ffe23a'); grd.addColorStop(0.78, '#5adf4a'); grd.addColorStop(1, '#3a8aff');
  g.fillStyle = grd; g.fillRect(0, 0, 8, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
