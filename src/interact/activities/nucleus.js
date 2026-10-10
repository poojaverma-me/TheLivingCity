// Activity · Nucleus — "Transcribe a Gene".
// Pick a gene at the holo-console → RNA polymerase II opens the helix and copies the template strand into
// pre-mRNA → 5′ cap, splicing, poly(A) tail → guide the mature mRNA to a nuclear pore and watch it leave.
// Takeaway: DNA stays in the nucleus; an mRNA copy is processed and exported through pores to the ribosomes.
import * as THREE from 'three';
import { runActivity, framePose } from './_shared.js';
import { NUCLEUS } from '../../world/layout.js';

const PH = NUCLEUS.plinthH, R = NUCLEUS.r, NZ = NUCLEUS.z;
const GENES = [
  { id: 'ACTB', name: 'β-actin', what: 'a cell-skeleton protein', color: '#59e0ff' },
  { id: 'GAPDH', name: 'GAPDH', what: 'a sugar-splitting enzyme', color: '#ffd25e' },
  { id: 'COL1A1', name: 'collagen', what: 'a tough structural protein', color: '#ff8ac4' },
];
// gene layout along the inset DNA (plate-local x)
const X0 = -3.2, X1 = 3.2, G0 = -2.3, G1 = 2.75;
const SEG = [ // exon / intron segments of the gene
  { a: -2.3, b: -1.25, exon: true }, { a: -1.25, b: -0.45, exon: false }, { a: -0.45, b: 0.75, exon: true },
  { a: 0.75, b: 1.55, exon: false }, { a: 1.55, b: 2.75, exon: true },
];
const segAt = (x) => SEG.findIndex((s) => x >= s.a - 1e-6 && x < s.b + 1e-6);
const BASE = { A: 0x6cff9a, T: 0xff6a8a, G: 0xffd45c, C: 0x5cb8ff };
const PAIR = { A: 'T', T: 'A', G: 'C', C: 'G' };
const EXON = 0xffb340, INTRON = 0x9c8cff, CAP = 0xff4fd8, POLYA = 0x7ff7ff;

export function start(ctx) {
  return runActivity(ctx, (kit, api) => build(ctx, kit, api));
}

function build(ctx, kit, api) {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  // ---------- staging: hologram rises from the holo-table ----------
  const helixObj = ctx.scene.getObjectByName('holoHelix');
  const table = helixObj ? helixObj.getWorldPosition(new THREE.Vector3()) : V(NUCLEUS.x, PH + 0.85, NZ + 1.2);
  let helixWasVisible = null;
  if (helixObj) { helixWasVisible = helixObj.visible; helixObj.visible = false; kit.onEnd(() => { helixObj.visible = helixWasVisible; }); }
  const plateC = V(table.x + 0.2, PH + 4.25, table.z - 0.6);
  const plate = kit.holoPlate({ w: 7.6, h: 3.9, color: 0x8fdcff, pos: plateC, yaw: 0, title: 'MAGNIFIED · GENE EXPRESSION' });
  const beam = kit.beam(table.clone().setY(table.y - 0.1), plateC.clone().setY(plateC.y - 1.7), 0x8fdcff, 0.9, 2.6, 0.08);
  const L = (x, y, z = 0.3) => plate.localToWorld(new THREE.Vector3(x, y, z));
  plate.updateMatrixWorld(true);
  kit.light(0x9fdcff, 10, 9, L(0, 0, 1.5));
  kit.fly(V(plateC.x - 1.15, plateC.y - 0.35, plateC.z), { yaw: 0, pitch: 9, dist: 10.6, fov: 40 }, 1.8);

  // ---------- DNA double helix (two bead backbones + base-pair rungs) ----------
  const DY = -0.75, HR = 0.24, TURN = 1.05;
  const NB = 150; const bx = (i) => X0 + (X1 - X0) * (i / (NB - 1));
  const seq = []; { let s = 7; for (let i = 0; i < NB; i++) { s = (s * 16807) % 2147483647; seq.push('ATGC'[s % 4]); } }
  // promoter: TATA box near the start of the gene
  'TATAAA'.split('').forEach((b, k) => { seq[Math.round(((G0 - 0.65 - X0) / (X1 - X0)) * (NB - 1)) + k] = b; });
  const coding = kit.beads(NB, 0.05), template = kit.beads(NB, 0.05);
  const rungGeo = new THREE.CylinderGeometry(0.022, 0.022, 1, 6); rungGeo.translate(0, 0.5, 0);
  const rungs = kit.instGlow(rungGeo, NB * 2, { intensity: 2.6 }); kit.add(rungs);
  NB && seq.forEach((b, i) => { rungs.setColorAt(i * 2, new THREE.Color(BASE[b])); rungs.setColorAt(i * 2 + 1, new THREE.Color(BASE[PAIR[b]])); });
  const S = { xp: G0 - 0.25, open: 0, dna: 1, dnaY: 0 };
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  function drawDNA(t) {
    for (let i = 0; i < NB; i++) {
      const x = bx(i), ang = (x / TURN) * Math.PI * 2 + t * 0.35;
      const d = Math.abs(x - S.xp), o = S.open * THREE.MathUtils.smoothstep(0.62, 0.2, d);
      const y = DY + S.dnaY;
      _a.set(x, y + Math.sin(ang) * HR + o * 0.32, Math.cos(ang) * HR * 0.7 + 0.35 + o * 0.12);
      _b.set(x, y - Math.sin(ang) * HR - o * 0.36, -Math.cos(ang) * HR * 0.7 + 0.35 - o * 0.1);
      const wa = plate.localToWorld(_a.clone()), wb = plate.localToWorld(_b.clone());
      const gene = x > G0 && x < G1 ? 1 : 0;
      coding.set(i, wa, S.dna, gene ? 0xbfe9ff : 0x7fb6ff);
      template.set(i, wb, S.dna * (1 + 0.25 * gene * S.highlight), gene ? 0xffffff : 0x7fb6ff);
      // rungs: two half-rungs meeting in the middle, hidden where the bubble is open
      const mid = wa.clone().lerp(wb, 0.5), vis = S.dna * (1 - THREE.MathUtils.smoothstep(0.15, 0.45, o));
      for (const [k, from] of [[0, wa], [1, wb]]) {
        const dir = mid.clone().sub(from); const len = dir.length();
        _q.setFromUnitVectors(up, dir.normalize()); _s.set(vis, len * Math.max(0.001, vis), vis);
        rungs.setMatrixAt(i * 2 + k, _m.compose(from, _q, _s));
      }
    }
    coding.commit(); template.commit(); rungs.instanceMatrix.needsUpdate = true;
  }
  S.highlight = 0;

  // ---------- gene tiles at the console ----------
  const tiles = GENES.map((g, k) => {
    const grp = new THREE.Group();
    const card = kit.text(`${g.id} · ${g.name}`, { h: 0.42, fg: '#0d1530', bg: g.color, font: '800 72px Montserrat, sans-serif', pad: 34 });
    const cw = card.userData.aspect * 0.42; if (cw > 2.0) card.scale.setScalar(2.0 / cw); // three cards fit the 90 % safe area
    grp.add(card);
    const halo = kit.sprite(g.color, 2.4, 0.35); halo.position.z = -0.05; grp.add(halo);
    grp.position.copy(L(-2.2 + k * 2.2, 0.75, 0.55));
    grp.scale.setScalar(0.001); kit.tween(grp.scale, { x: 1, y: 1, z: 1, duration: 0.6, delay: 0.6 + k * 0.12, ease: 'back.out(2)' });
    kit.add(grp); return { g, grp, card };
  });

  // ---------- RNA polymerase II ----------
  const pol = new THREE.Group();
  {
    const mat = kit.gloss(0xd27bff, { ei: 1.1, opacity: 0.8, rough: 0.18 });
    mat.depthWrite = false;
    const parts = [[0, 0.05, 0, 0.6, 0.62, 0.55], [0.36, 0.34, -0.05, 0.36, 0.34, 0.36], [-0.34, 0.36, 0.04, 0.34, 0.32, 0.34], [0.08, -0.42, 0.08, 0.38, 0.26, 0.38], [-0.3, -0.2, 0.32, 0.24, 0.24, 0.24], [0.42, -0.15, 0.25, 0.2, 0.2, 0.2]];
    for (const [x, y, z, sx, sy, sz] of parts) { const s = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), mat); s.position.set(x, y, z); s.scale.set(sx, sy, sz); s.renderOrder = 7; pol.add(s); }
    const core = kit.sprite(0x9ff4ff, 1.5, 0.9); core.position.set(0, 0.0, 0.5); pol.add(core);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.03, 8, 56), kit.glow(0xf0c8ff, 4.5)); ring.rotation.y = Math.PI / 2; pol.add(ring);
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.022, 8, 56), kit.glow(0xf0c8ff, 4.5)); pol.add(ring2);
    pol.userData.core = core; pol.userData.rings = [ring, ring2];
  }
  pol.visible = false; kit.add(pol);

  // ---------- pre-mRNA / mRNA bead chain ----------
  const NR = 104, NA = 14; // transcript beads + poly(A) beads
  const rna = kit.beads(NR + NA + 1, 0.06, { intensity: 3.4 });
  const R0 = []; // per-bead state: x origin on gene, segment, visible, pos (plate-local)
  for (let k = 0; k < NR; k++) { const x = G0 + (G1 - G0) * (k / (NR - 1)); R0.push({ x, seg: segAt(x), made: false, p: new THREE.Vector3(), a: 1 }); }
  const capS = { on: false, p: new THREE.Vector3(), s: 0 };
  const tail = []; for (let k = 0; k < NA; k++) tail.push({ on: false, p: new THREE.Vector3(), s: 0 });
  let rnaMode = 'grow'; // grow | layout | world
  const world = { curve: null, head: 0, sp: 0.075 };
  function drawRNA(t) {
    let n = 0;
    if (rnaMode === 'world') {
      // follow the export path, cap first
      const order = [capS, ...R0.filter((r) => SEG[r.seg].exon && r.a > 0.5), ...tail];
      const len = world.curve.getLength();
      order.forEach((b, i) => {
        const s = world.head - i * world.sp;
        let p;
        if (s >= 0) p = world.curve.getPointAt(Math.min(1, s / len));
        else p = world.start.clone().addScaledVector(world.back, -s);
        const c = b === capS ? CAP : tail.includes(b) ? POLYA : EXON;
        rna.set(n++, p, b === capS ? 1.6 : 1, c);
      });
      for (; n < NR + NA + 1; n++) rna.hide(n);
      rna.commit(); return;
    }
    if (capS.on) rna.set(n++, plate.localToWorld(capS.p.clone()), capS.s * 1.6, CAP);
    for (const r of R0) {
      if (!r.made || r.a <= 0.01) { rna.hide(n++); continue; }
      if (rnaMode === 'grow') {
        const dist = S.xp - r.x;
        const lift = 0.95 * (1 - Math.exp(-dist * 1.2));
        r.p.set(r.x + 0.22 * Math.min(1, dist), DY + 0.3 + lift + Math.sin(dist * 5 + t * 1.5) * 0.06 * Math.min(1, dist), 0.55 + Math.sin(dist * 3.3) * 0.12);
      }
      rna.set(n++, plate.localToWorld(r.p.clone()), r.a, SEG[r.seg].exon ? EXON : INTRON);
    }
    for (const b of tail) { if (b.on) rna.set(n++, plate.localToWorld(b.p.clone()), b.s, POLYA); else rna.hide(n++); }
    for (; n < NR + NA + 1; n++) rna.hide(n);
    rna.commit();
  }

  // ---------- nuclear pores (choices for export) ----------
  const poreAt = (phiDeg, elevDeg) => {
    const ph = (phiDeg * Math.PI) / 180, e = (elevDeg * Math.PI) / 180;
    const n = new THREE.Vector3(Math.cos(e) * Math.cos(ph), Math.sin(e) * NUCLEUS.domeScaleY, Math.cos(e) * Math.sin(ph)).normalize();
    const p = new THREE.Vector3(NUCLEUS.x + Math.cos(e) * Math.cos(ph) * (R - 0.55), PH + Math.sin(e) * (R - 0.55) * NUCLEUS.domeScaleY, NZ + Math.cos(e) * Math.sin(ph) * (R - 0.55));
    return { p, n };
  };
  const pores = [poreAt(-58, 38), poreAt(-90, 44), poreAt(-122, 38)].map(({ p, n }) => {
    const grp = new THREE.Group(); grp.position.copy(p); grp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.09, 10, 40), kit.gloss(0xc9b0ff, { ei: 0.8 })); grp.add(ring);
    const lit = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.035, 8, 40), kit.glow(0x9ff4ff, 4.5)); lit.position.z = -0.07; grp.add(lit);
    for (let k = 0; k < 8; k++) { // nucleoporin spokes
      const sp = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.22, 4, 8), kit.gloss(0xb18cff, { ei: 0.6 }));
      const a = (k / 8) * Math.PI * 2; sp.position.set(Math.cos(a) * 0.36, Math.sin(a) * 0.36, -0.04); sp.rotation.z = a + Math.PI / 2; grp.add(sp);
    }
    const mesh = new THREE.Mesh(new THREE.CircleGeometry(0.4, 32), kit.additive(0x7fe8ff, 0.35, 1.5)); grp.add(mesh);
    const halo = kit.sprite(0x8fe6ff, 2.4, 0.5); grp.add(halo);
    grp.visible = false; kit.add(grp);
    return { grp, p, n, halo, ring };
  });

  // ---------- per-frame ----------
  let stage = 'choose';
  const update = (dt, t) => {
    drawDNA(t);
    drawRNA(t);
    tiles.forEach((tl, k) => { if (tl.grp.visible) tl.grp.position.y += Math.sin(t * 2 + k) * 0.0012; });
    if (pol.visible) { pol.position.copy(L(S.xp, DY + S.dnaY, 0.4)); pol.rotation.x = Math.sin(t * 3) * 0.05; pol.userData.core.material.opacity = 0.7 + Math.sin(t * 9) * 0.25; pol.userData.rings[0].rotation.x = t * 2; pol.userData.rings[1].rotation.z = t * 1.4; }
    for (const P of pores) if (P.grp.visible) P.halo.material.opacity = 0.35 + 0.25 * Math.sin(t * 4 + P.p.x);
  };

  // ---------- stage 1: choose a gene ----------
  api.goal('<b>Pick a gene</b> at the control console. Its DNA stays here in the nucleus — you will send out an RNA copy.', true);
  api.progress(0.02, 'Step 1 / 4 · choose a gene');
  kit.label('dna', 'DNA double helix (chromatin unwound)', 'DNA', () => L(-2.9, DY + 0.55, 0.35));
  kit.label('prom', 'Promoter · TATA box', 'P', () => L(G0 - 0.5, DY - 0.45, 0.35));
  let chosen = null;
  const choose = (k) => {
    if (chosen) return; chosen = GENES[k];
    ctx.sfx('button_press'); ctx.sfx('interact_ping', { pitch: 1.2 });
    tiles.forEach((tl, j) => { kit.unpick(tl.pick); if (j !== k) kit.tween(tl.grp.scale, { x: 0.001, y: 0.001, z: 0.001, duration: 0.35, ease: 'back.in(2)', overwrite: true }); });
    const sel = tiles[k];
    kit.tween(sel.grp.position, { ...xyz(L((G0 + G1) / 2, DY - 0.88, 0.5)), duration: 0.8, ease: 'power3.inOut' });
    kit.tween(sel.grp.scale, { x: 0.8, y: 0.8, z: 0.8, duration: 0.8, overwrite: true });
    kit.tween(S, { highlight: 1, duration: 0.8 });
    beginTranscription();
  };
  tiles.forEach((tl, k) => { tl.pick = kit.pick(tl.grp, () => choose(k), { onHover: (on) => kit.tween(tl.grp.scale, { x: on ? 1.08 : 1, y: on ? 1.08 : 1, duration: 0.2, overwrite: true }) }); });
  api.buttons(GENES.map((g, k) => ({ label: g.id, solid: k === 0, onClick: () => choose(k) })));

  // ---------- stage 2: transcription ----------
  let bursts = 0; const NBURST = 6; let busy = false;
  async function beginTranscription() {
    stage = 'tx';
    kit.label('gene', `Gene · ${chosen.id} (${chosen.what})`, 'GENE', () => L(G1 - 0.6, DY - 1.05, 0.5));
    pol.visible = true; pol.scale.setScalar(0.001);
    await kit.wait(0.5);
    ctx.sfx('vesicle_bud'); kit.tween(pol.scale, { x: 1, y: 1, z: 1, duration: 0.6, ease: 'back.out(2.2)' });
    kit.tween(S, { open: 1, duration: 0.9, ease: 'power2.inOut' });
    kit.ring(L(S.xp, DY, 0.4), 0xc8a0ff, { r: 0.3, to: 1.4 });
    kit.label('pol', 'RNA polymerase II', 'Pol II', () => pol.position.clone().add(new THREE.Vector3(0, 0.55, 0)));
    kit.label('tmpl', 'Template strand is read 3′→5′', '3′→5′', () => L(-1.0, DY - 0.55, 0.35));
    kit.unlabel('prom');
    api.goal(`<b>Transcribe ${chosen.id}.</b> Click RNA polymerase II (or the button) to push it along the gene. It unzips the helix and builds RNA 5′→3′ from the template strand.`);
    api.progress(0.12, 'Step 2 / 4 · transcription');
    kit.pick(pol, transcribe);
    api.buttons([{ label: 'Transcribe ▶', solid: true, onClick: transcribe }]);
  }
  async function transcribe() {
    if (busy || stage !== 'tx') return; busy = true; bursts++;
    const target = G0 + ((G1 - G0) * bursts) / NBURST;
    ctx.sfx('valve_turn', { volume: 0.5, pitch: 0.9 + bursts * 0.05 });
    let lastTick = 0;
    await kit.to(S, {
      xp: target, duration: 1.05, ease: 'power2.inOut',
      onUpdate: () => {
        for (const r of R0) if (!r.made && r.x <= S.xp) { r.made = true; if (kit.time - lastTick > 0.07) { lastTick = kit.time; ctx.sfx('typewriter_tick', { volume: 0.35, pitch: 0.8 + Math.random() * 0.5 }); } }
      },
    });
    kit.burst(L(S.xp, DY + 0.3, 0.6), 0xffc35a, { count: 16, speed: 1.2, size: 0.16, life: 0.6 });
    api.progress(0.12 + 0.38 * (bursts / NBURST), `Step 2 / 4 · ${Math.round((100 * bursts) / NBURST)} % transcribed`);
    if (bursts === 2) kit.label('pre', 'pre-mRNA · exons + introns', 'RNA', () => L(G0 + 0.3, DY + 1.25, 0.55));
    busy = false;
    if (bursts >= NBURST) finishTranscription();
  }
  async function finishTranscription() {
    stage = 'release';
    api.buttons([]);
    ctx.sfx('discovery_chime');
    kit.unlabel('tmpl');
    // polymerase lets go, helix zips back up
    kit.tween(pol.position, { y: pol.position.y + 0.6, duration: 0.6 });
    kit.tween(pol.scale, { x: 0.001, y: 0.001, z: 0.001, duration: 0.6, delay: 0.2, ease: 'back.in(2)', onComplete: () => { pol.visible = false; } });
    kit.unlabel('pol');
    kit.tween(S, { open: 0, highlight: 0.3, duration: 1 });
    // transcript straightens out above the DNA (plate-local layout)
    rnaMode = 'layout';
    layoutRNA(0.9);
    await kit.wait(1.0);
    beginProcessing();
  }
  /** Lay the beads out on a line; introns either in-line or looped (lariat). */
  function layoutRNA(dur, { loop = -1, spliced = false } = {}) {
    const vis = R0.filter((r) => r.a > 0.01 && (!spliced || SEG[r.seg].exon));
    const sp = 0.055, total = vis.length * sp, x0 = -total / 2 + (spliced ? -0.35 : 0);
    let k = 0;
    for (const r of R0) {
      if (r.a <= 0.01 || (spliced && !SEG[r.seg].exon)) continue;
      const tx = x0 + k * sp; let ty = 0.62, tz = 0.5;
      if (loop >= 0 && r.seg === loop) { // pull this intron up into a lariat loop
        const segBeads = R0.filter((q) => q.seg === loop); const j = segBeads.indexOf(r), f = j / (segBeads.length - 1);
        const ang = f * Math.PI * 2 - Math.PI / 2; const cx = x0 + (k - j + segBeads.length / 2) * sp;
        kit.tween(r.p, { x: cx + Math.cos(ang) * 0.32, y: 1.05 + Math.sin(ang) * 0.32 + 0.32, z: 0.55, duration: dur, ease: 'power2.inOut' });
      } else kit.tween(r.p, { x: tx, y: ty, z: tz, duration: dur, ease: 'power2.inOut' });
      k++;
    }
    return { x0, x1: x0 + (k - 1) * sp };
  }

  // ---------- stage 3: processing ----------
  let ends = null;
  function beginProcessing() {
    stage = 'cap';
    ends = { x0: -((R0.length * 0.055) / 2), x1: (R0.length * 0.055) / 2 };
    kit.unlabel('pre'); kit.unlabel('gene');
    kit.label('ex', 'Exons (kept)', 'EXON', () => plate.localToWorld(R0[10].p.clone()).add(new THREE.Vector3(0, 0.12, 0)));
    kit.label('in', 'Introns (to be removed)', 'INTRON', () => plate.localToWorld(R0[R0.findIndex((r) => r.seg === 3) + 8].p.clone()).add(new THREE.Vector3(0, 0.12, 0)));
    api.goal('<b>Process the pre-mRNA.</b> First protect its 5′ end: click the glowing 5′ end to add the cap.');
    api.progress(0.52, 'Step 3 / 4 · RNA processing');
    const marker = endMarker(new THREE.Vector3(ends.x0 - 0.12, 0.62, 0.5), CAP);
    const go = async () => {
      if (stage !== 'cap') return; stage = 'busy'; api.buttons([]); kit.unpick(marker.h); marker.kill();
      capS.on = true; capS.p.set(ends.x0 - 1.4, 1.4, 0.6); capS.s = 0.001;
      ctx.sfx('vesicle_bloop');
      kit.tween(capS, { s: 1, duration: 0.4 });
      await kit.to(capS.p, { x: ends.x0 - 0.1, y: 0.62, z: 0.5, duration: 0.8, ease: 'power3.inOut' });
      ctx.sfx('atp_pop'); kit.burst(L(ends.x0 - 0.1, 0.62, 0.5), CAP, { count: 26, speed: 1.6, size: 0.18 });
      kit.ring(L(ends.x0 - 0.1, 0.62, 0.5), CAP, { r: 0.1, to: 0.9 });
      kit.label('cap', '5′ cap (m⁷G)', 'CAP', () => L(ends.x0 - 0.1, 0.9, 0.5));
      api.progress(0.6, 'Step 3 / 4 · capped');
      splice();
    };
    marker.h = kit.pick(marker.grp, go);
    api.buttons([{ label: 'Add 5′ cap', solid: true, onClick: go }]);
  }
  function endMarker(local, color) {
    const grp = new THREE.Group(); grp.position.copy(L(local.x, local.y, local.z + 0.05));
    const s = kit.sprite(color, 1.1, 0.8); grp.add(s);
    const hit = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 8), kit.own(new THREE.MeshBasicMaterial({ visible: false }))); grp.add(hit);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.02, 6, 32), kit.additive(color, 0.9, 3)); grp.add(ring);
    kit.add(grp);
    const off = kit.onUpdate((dt, t) => { const k = 1 + 0.25 * Math.sin(t * 6); ring.scale.setScalar(k); s.material.opacity = 0.5 + 0.3 * Math.sin(t * 6); });
    return { grp, kill: () => { off(); grp.visible = false; } }; // hide (not detach) so kit.end() disposes it
  }
  async function splice() {
    stage = 'splice';
    api.goal('<b>Splice it.</b> The spliceosome cuts out the introns (violet) and joins the exons (gold). Click an intron, or the button.');
    const introns = [1, 3];
    const markers = introns.map((seg) => {
      const beads = R0.filter((r) => r.seg === seg); const mid = beads[Math.floor(beads.length / 2)];
      const m = endMarker(mid.p.clone().add(new THREE.Vector3(0, 0.0, 0)), INTRON); return m;
    });
    const go = async () => {
      if (stage !== 'splice') return; stage = 'busy'; api.buttons([]); markers.forEach((m) => { kit.unpick(m.h); m.kill(); });
      // spliceosome snRNPs gather on each intron
      const snrps = [];
      for (const seg of introns) {
        const beads = R0.filter((r) => r.seg === seg); const mid = beads[Math.floor(beads.length / 2)].p;
        for (let k = 0; k < 4; k++) {
          const b = new THREE.Mesh(new THREE.SphereGeometry(0.11 + (k % 2) * 0.04, 16, 12), kit.gloss(0x5cf0c8, { ei: 1.6, opacity: 0.92 }));
          const from = L(mid.x + (Math.random() - 0.5) * 3, 2.0, 0.9); b.position.copy(from); kit.add(b); snrps.push(b);
          kit.tween(b.position, { ...xyz(L(mid.x + (k - 1.5) * 0.14, 0.8 + (k % 2) * 0.12, 0.62)), duration: 0.7, delay: k * 0.08, ease: 'power3.out' });
        }
      }
      ctx.sfx('whoosh', { volume: 0.5 });
      kit.label('spl', 'Spliceosome (snRNPs)', 'SPL', () => snrps[1].position.clone().add(new THREE.Vector3(0, 0.2, 0)));
      await kit.wait(0.9);
      for (const seg of introns) {
        layoutRNA(0.7, { loop: seg }); ctx.sfx('valve_turn', { volume: 0.4 });
        await kit.wait(0.8);
      }
      ctx.sfx('zap', { volume: 0.6 });
      for (const seg of introns) {
        const beads = R0.filter((r) => r.seg === seg);
        const c = beads[Math.floor(beads.length / 2)].p.clone();
        kit.burst(L(c.x, c.y, c.z), INTRON, { count: 30, speed: 1.4, size: 0.16 });
        for (const r of beads) kit.tween(r, { a: 0, duration: 0.6, ease: 'power2.in' });
      }
      snrps.forEach((b, k) => kit.tween(b.scale, { x: 0.001, y: 0.001, z: 0.001, duration: 0.5, delay: 0.3 + k * 0.03 }));
      kit.unlabel('spl'); kit.unlabel('in');
      kit.label('lar', 'Introns removed (lariats)', 'CUT', () => L(-0.4, 1.55, 0.5));
      await kit.wait(0.7);
      const ex = layoutRNA(0.8, { spliced: true });
      kit.tween(capS.p, { x: ex.x0 - 0.075, duration: 0.8, ease: 'power2.inOut' });
      ends.x0 = ex.x0 - 0.075; ends.x1 = ex.x1;
      ctx.sfx('parcel_thunk', { volume: 0.6 });
      await kit.wait(0.85);
      kit.unlabel('lar'); kit.unlabel('ex');
      kit.label('ex', 'Exons joined', 'EXONS', () => L((ends.x0 + ends.x1) / 2, 0.92, 0.5));
      api.progress(0.68, 'Step 3 / 4 · spliced');
      polyA();
    };
    markers.forEach((m) => { m.h = kit.pick(m.grp, go); });
    api.buttons([{ label: 'Splice out introns', solid: true, onClick: go }]);
  }
  function polyA() {
    stage = 'tail';
    api.goal('<b>Add the tail.</b> Click the 3′ end: poly(A) polymerase adds a long run of A’s that protects the message.');
    const marker = endMarker(new THREE.Vector3(ends.x1 + 0.1, 0.62, 0.5), POLYA);
    const go = async () => {
      if (stage !== 'tail') return; stage = 'busy'; api.buttons([]); kit.unpick(marker.h); marker.kill();
      for (let k = 0; k < NA; k++) {
        const b = tail[k]; b.on = true; b.p.set(ends.x1 + 0.055 * (k + 1), 0.62 + Math.sin(k * 0.9) * 0.03, 0.5); b.s = 0.001;
        kit.tween(b, { s: 1, duration: 0.25, ease: 'back.out(3)' });
        ctx.sfx('bubble', { volume: 0.35, pitch: 0.9 + k * 0.04 });
        await kit.wait(0.09);
      }
      kit.burst(L(ends.x1 + 0.4, 0.62, 0.5), POLYA, { count: 22, speed: 1.3, size: 0.16 });
      kit.label('tail', 'Poly(A) tail · AAAA…', 'A(n)', () => L(ends.x1 + 0.45, 0.9, 0.5));
      ends.x1 += 0.055 * NA;
      api.progress(0.76, 'Step 3 / 4 · mature mRNA ready');
      ctx.sfx('discovery_chime');
      await kit.wait(0.6);
      exportStage();
    };
    marker.h = kit.pick(marker.grp, go);
    api.buttons([{ label: 'Add poly(A) tail', solid: true, onClick: go }]);
  }

  // ---------- stage 4: export through a nuclear pore ----------
  async function exportStage() {
    stage = 'export';
    kit.unlabel('ex'); kit.unlabel('cap'); kit.unlabel('tail');
    kit.label('m', 'Mature mRNA (cap · exons · tail)', 'mRNA', () => L(0, 1.05, 0.5));
    kit.label('dna', 'DNA stays in the nucleus', 'DNA', () => L(-2.9, DY + 0.55, 0.35));
    api.goal('<b>Export it.</b> mRNA leaves through a nuclear pore. Click any glowing pore in the envelope to guide your mRNA out to the ribosomes.');
    api.progress(0.8, 'Step 4 / 4 · export');
    pores.forEach((P, k) => {
      P.grp.visible = true; P.grp.scale.setScalar(0.001);
      kit.tween(P.grp.scale, { x: 1, y: 1, z: 1, duration: 0.6, delay: k * 0.12, ease: 'back.out(2)' });
      P.h = kit.pick(P.grp, () => sendTo(k));
    });
    kit.label('npc', 'Nuclear pore complexes', 'NPC', () => pores[1].p.clone().add(new THREE.Vector3(0, 0.75, 0)));
    ctx.sfx('interact_ping');
    kit.fly(V(plateC.x - 0.6, plateC.y + 1.6, plateC.z - 2.5), { yaw: 0, pitch: 4, dist: 12.6, fov: 44 }, 1.6);
    api.buttons([{ label: 'Left pore', onClick: () => sendTo(2) }, { label: 'Top pore', solid: true, onClick: () => sendTo(1) }, { label: 'Right pore', onClick: () => sendTo(0) }]);
  }
  async function sendTo(k) {
    if (stage !== 'export') return; stage = 'flying'; api.buttons([]);
    pores.forEach((P) => kit.unpick(P.h));
    pores.forEach((P, j) => { if (j !== k) kit.tween(P.grp.scale, { x: 0.001, y: 0.001, z: 0.001, duration: 0.4, ease: 'back.in(2)' }); });
    const P = pores[k];
    ctx.sfx('button_press'); ctx.sfx('whoosh', { volume: 0.6 });
    // world path: from the mRNA's 5′ end, up to the pore, through it, then out over the dome and down to the ER
    const start = L(ends.x0, 0.62, 0.5), back = L(ends.x0 + 1, 0.62, 0.5).sub(start).normalize().negate();
    const outN = P.n.clone();
    const pts = [
      start, start.clone().add(new THREE.Vector3(-0.4, 0.9, -0.6)),
      P.p.clone().addScaledVector(outN, -2.2).add(new THREE.Vector3(0, -0.5, 0)),
      P.p.clone().addScaledVector(outN, -0.6), P.p.clone(), P.p.clone().addScaledVector(outN, 1.2),
      P.p.clone().addScaledVector(outN, 3.2).add(new THREE.Vector3(0, -1.6, 0)),
      P.p.clone().addScaledVector(new THREE.Vector3(outN.x, 0, outN.z).normalize(), 7.5).setY(PH + 1.6),
    ];
    world.curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    world.start = start; world.back = back.negate(); world.head = 0;
    rnaMode = 'world';
    kit.unlabel('m');
    const len = world.curve.getLength();
    const poreS = len * 0.55;
    kit.label('fly', 'mRNA heading for the pore', 'mRNA', () => world.curve.getPointAt(Math.min(1, Math.max(0, world.head / len))).add(new THREE.Vector3(0, 0.3, 0)));
    await kit.to(world, { head: poreS * 0.9, duration: 2.6, ease: 'power2.inOut' });
    // squeeze through the pore
    kit.ring(P.p, 0x9ff4ff, { r: 0.5, to: 2.0, normal: P.n });
    kit.burst(P.p, 0x9ff4ff, { count: 34, speed: 2.0, size: 0.2, dir: P.n.clone().multiplyScalar(0.6) });
    ctx.sfx('vesicle_bloop'); ctx.sfx('zap', { volume: 0.4, pitch: 1.4 });
    kit.label('npc', 'Nuclear pore complex · export', 'NPC', () => P.p.clone().add(new THREE.Vector3(0, 0.7, 0)));
    // ending reveal: a three-quarter view from just outside the exit pore, looking back at the dome,
    // with the departing mRNA centred (right of the activity panel) — never a wide pull-out to the sky
    const endP = world.curve.getPointAt(1), focus = P.p.clone().lerp(endP, 0.55);
    // the gene card has done its job; tuck it away as the camera leaves the dome (it would be unreadably small)
    tiles.forEach((tl) => kit.tween(tl.grp.scale, { x: 0.001, y: 0.001, z: 0.001, duration: 0.6, ease: 'back.in(2)', overwrite: true }));
    const outYaw = Math.atan2(outN.x, outN.z) * 180 / Math.PI;
    ctx.rig.flyTo(framePose(ctx, endP.clone().lerp(P.p, 0.3).add(new THREE.Vector3(0, 0.8, 0)), { yaw: outYaw + 12, pitch: 38, dist: 17, fov: 40, sx: 0.12, sy: -0.05 }), 3.2);
    await kit.to(world, { head: len, duration: 4.2, ease: 'power1.inOut' });
    kit.unlabel('fly');
    kit.label('cyto', 'mRNA in the cytoplasm → ribosomes', '→', () => world.curve.getPointAt(1).add(new THREE.Vector3(0, 0.4, 0)));
    kit.burst(world.curve.getPointAt(1), EXON, { count: 30, speed: 1.6, size: 0.22 });
    api.finish(`<b>Gene expressed!</b> The DNA of <b>${chosen.id}</b> never left the nucleus: RNA polymerase II copied it into pre-mRNA, which was capped, spliced and given a poly(A) tail, then exported through a nuclear pore to the ribosomes.`);
  }

  return (dt, t) => update(dt, t);
}

function xyz(v) { return { x: v.x, y: v.y, z: v.z }; }
