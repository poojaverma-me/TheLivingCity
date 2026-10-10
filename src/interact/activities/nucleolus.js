// Activity · Nucleolus — "Assemble a Ribosome".
// RNA polymerase I transcribes rDNA repeats into 47S pre-rRNA ("Christmas-tree" pattern) → it is cut into 18S, 5.8S
// and 28S rRNA (5S arrives from elsewhere) → the player sorts each rRNA into the small (40S) or large (60S) subunit →
// imported ribosomal proteins join → the two subunits are exported SEPARATELY through different nuclear pores and
// meet only on an mRNA in the cytoplasm, forming the 80S ribosome.
// Takeaway: the nucleolus builds 40S and 60S subunits from rRNA and imported proteins; they leave the nucleus
// separately and unite only on an mRNA in the cytoplasm.
import * as THREE from 'three';
import { runActivity, makeRibosome, framePose } from './_shared.js';
import { NUCLEUS } from '../../world/layout.js';

const D = Math.PI / 180;
const PH = NUCLEUS.plinthH, R = NUCLEUS.r, NZ = NUCLEUS.z;
const C18 = 0x5ce1ff, C58 = 0xffe14a, C28 = 0xff9a4a, C5 = 0xff7ad8, CSP = 0x8a90a8;
const PIECES = [
  { id: '18S', color: C18, len: 1.3, to: 'small', why: '18S rRNA is the backbone of the <b>small (40S)</b> subunit, the part that reads the mRNA.' },
  { id: '28S', color: C28, len: 2.1, to: 'large', why: '28S rRNA is the giant of the <b>large (60S)</b> subunit; it forms the peptide-bonding centre.' },
  { id: '5.8S', color: C58, len: 0.45, to: 'large', why: '5.8S rRNA pairs with 28S rRNA inside the <b>large (60S)</b> subunit.' },
  { id: '5S', color: C5, len: 0.35, to: 'large', why: '5S rRNA, made by RNA polymerase III elsewhere in the nucleus, also belongs to the <b>large (60S)</b> subunit.' },
];

export function start(ctx) { return runActivity(ctx, (kit, api) => build(ctx, kit, api)); }

function build(ctx, kit, api) {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const nlObj = ctx.scene.getObjectByName('nucleolus');
  const nl = nlObj ? nlObj.getWorldPosition(new THREE.Vector3()) : V(NUCLEUS.nucleolus.x, NUCLEUS.nucleolus.y, NUCLEUS.nucleolus.z);
  const yaw = 18 * D;
  const C = nl.clone().add(V(3.35, 0.15, 0.95));
  const plate = kit.holoPlate({ w: 6.6, h: 4.3, color: 0x7fc8ff, pos: C, yaw, title: 'MAGNIFIED · NUCLEOLUS' });
  const L = (x, y, z = 0.3) => plate.localToWorld(new THREE.Vector3(x, y, z));
  // dark backing so the control-room screens behind don't show through the hologram
  { const back = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 4.1), kit.own(new THREE.MeshBasicMaterial({ color: 0x08142a, transparent: true, opacity: 0.82, depthWrite: false }))); back.position.z = -0.05; back.renderOrder = 0; plate.userData.inner.add(back); }
  kit.beam(nl.clone(), L(-3.3, 0, 0), 0x7fc8ff, 0.3, 0.6, 0.1);
  const nlGlow = kit.sprite(0x6cc0ff, 4.8, 0.5); nlGlow.position.copy(nl); kit.add(nlGlow);
  kit.light(0x9fd4ff, 8, 8, L(0, 0, 1.5));
  kit.fly(nl.clone().lerp(C, 0.42).add(V(0, -0.1, 0)), { yaw: 18, pitch: 11, dist: 10.2, fov: 40 }, 1.8);
  const faceQ = new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), yaw);
  const face = (o) => { o.quaternion.copy(faceQ); return o; };
  kit.label('nl', 'Nucleolus · no membrane, a dense RNA–protein cluster', 'NO', () => nl.clone().add(V(-0.6, -1.5, 0.6)));

  // ---------- stage 1: rDNA "Christmas tree" ----------
  const RX0 = -2.75, RX1 = 2.45, RY = -0.15;
  // one rRNA gene (bright, thick) flanked by intergenic spacer DNA (dim): rDNA sits in tandem repeats
  const rod = (x0, x1, r, mat) => { const m = face(new THREE.Mesh(new THREE.CylinderGeometry(r, r, x1 - x0, 12), mat)); m.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), Math.PI / 2)); m.position.copy(L((x0 + x1) / 2, RY, 0.3)); kit.add(m); return m; };
  const rdna = rod(RX0, RX1, 0.07, kit.glow(0x6cb8ff, 3.4));
  const spacerMat = kit.glow(0x3a6aa8, 1.6);
  rod(RX0 - 0.38, RX0, 0.035, spacerMat); rod(RX1, RX1 + 0.38, 0.035, spacerMat);
  const promoter = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), kit.glow(0x9fe8ff, 4)); promoter.position.copy(L(RX0, RY, 0.32)); kit.add(promoter);
  const NPOL = 9;
  const pols = []; const strands = kit.beads(NPOL * 26, 0.035, { intensity: 3.0 });
  for (let k = 0; k < NPOL; k++) { const p = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10), kit.glow(0xc88cff, 3.8)); p.visible = false; kit.add(p); pols.push(p); }
  const TX = { run: 0, on: false, gone: 0 };
  function drawTree(t) {
    let n = 0;
    for (let k = 0; k < NPOL; k++) {
      const f = THREE.MathUtils.clamp(TX.run * 1.6 - k * 0.11, 0, 1); // progress of polymerase k along the gene
      const on = TX.on && f > 0 && TX.gone < 1;
      const idle = !TX.on && TX.run === 0 && k < 4; // Pol I waiting at the promoter before the first click
      pols[k].visible = on || idle;
      const x = RX0 + (RX1 - RX0) * f;
      if (on) pols[k].position.copy(L(x, RY, 0.32));
      else if (idle) pols[k].position.copy(L(RX0 - 0.05 + Math.cos(t * 1.4 + k * 1.6) * 0.22, RY + 0.24 + Math.sin(t * 1.9 + k * 1.6) * 0.13, 0.36));
      const len = Math.round(f * 25); // longer transcripts toward the end of the gene
      for (let j = 0; j < 26; j++) {
        if (!on || j >= len) { strands.hide(n++); continue; }
        const y = RY + 0.08 + j * 0.055 * (1 - TX.gone), wig = Math.sin(j * 0.8 + t * 2 + k) * 0.03 * j * 0.08;
        strands.set(n++, L(x + wig, y, 0.32), 1 - TX.gone, j > 20 ? 0xb8e6ff : 0x7fd8ff);
      }
    }
    strands.commit();
  }

  // ---------- nucleolus cutaway (fills the panel): FC · DFC · GC ----------
  // rDNA sits in the fibrillar centres (FC); Pol I transcribes it at the FC/DFC border; the dense fibrillar component
  // (DFC) processes pre-rRNA; the granular component (GC) is where pre-40S/60S particles assemble.
  const CX = (RX0 + RX1) / 2, CY = RY;
  const zone = (rx, ry, color, op, z) => { const m = face(new THREE.Mesh(new THREE.CircleGeometry(1, 72), kit.additive(color, op, 1.2))); m.scale.set(rx, ry, 1); m.position.copy(L(CX, CY, z)); kit.add(m); return m; };
  const gc = zone(3.05, 1.72, 0x3a7aff, 0.16, 0.12), dfc = zone(2.2, 0.82, 0x9a6aff, 0.22, 0.14), fc = zone(1.4, 0.34, 0x5cd8ff, 0.24, 0.16);
  const rim = face(new THREE.Mesh(new THREE.TorusGeometry(1, 0.012, 6, 120), kit.additive(0x9fd0ff, 0.55, 2))); rim.scale.set(3.05, 1.72, 1); rim.position.copy(L(CX, CY, 0.12)); kit.add(rim);
  const gran = kit.beads(140, 0.045, { intensity: 2.4 });
  { const tmp = V(0, 0, 0); let n = 0;
    while (n < 140) { const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()); const x = Math.cos(a) * r * 2.95, y = Math.sin(a) * r * 1.66;
      if ((x / 2.25) ** 2 + (y / 0.88) ** 2 < 1) continue; tmp.copy(L(CX + x, CY + y, 0.18)); gran.set(n++, tmp, 0.7 + Math.random() * 0.6, Math.random() < 0.5 ? 0x8fc8ff : 0xffc89a); }
    gran.commit(); }
  const zoneCap = (s, x, y, col) => { const t = face(kit.text(s, { h: 0.24, fg: col, font: '800 64px Montserrat, sans-serif' })); t.position.copy(L(x, y, 0.3)); kit.add(t); return t; };
  const zcaps = [zoneCap('GRANULAR · subunit assembly', CX + 0.3, CY - 1.2, '#9fc8ff'), zoneCap('DENSE FIBRILLAR · rRNA processing', CX, CY + 0.58, '#d0b8ff'), zoneCap('FIBRILLAR CENTRE · rDNA', CX + 0.55, CY - 0.22, '#a8f0ff')];
  const dimCutaway = () => {
    for (const m of [gc, dfc, fc]) kit.tween(m.material, { opacity: m.material.opacity * 0.35, duration: 0.8 });
    kit.tween(rim.material, { opacity: 0.18, duration: 0.8 });
    for (const t of zcaps) kit.tween(t.material, { opacity: 0, duration: 0.6, onComplete: () => { t.visible = false; } });
    kit.tween(gran.mesh.scale, { x: 0.001, y: 0.001, z: 0.001, duration: 0.6 });
  };

  // ---------- stage 2: 47S precursor and its cuts ----------
  // segments: 5′ETS | 18S | ITS1 | 5.8S | ITS2 | 28S | 3′ETS
  const SEGS = [['ETS', CSP, 0.3], ['18S', C18, 1.3], ['ITS', CSP, 0.25], ['5.8S', C58, 0.45], ['ITS', CSP, 0.25], ['28S', C28, 2.1], ['ETS', CSP, 0.2]];
  const PRE_Y = 1.15;
  const segObjs = [];
  { let x = -2.6; for (const [id, col, len] of SEGS) { const m = face(new THREE.Mesh(new THREE.CapsuleGeometry(0.075, len, 4, 10), kit.glow(col, id.includes('S') && id !== 'ETS' && id !== 'ITS' ? 3.4 : 1.6))); m.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), Math.PI / 2)); m.userData = { id, len, x: x + len / 2 }; m.position.copy(L(x + len / 2, PRE_Y, 0.34)); m.visible = false; kit.add(m); segObjs.push(m); x += len + 0.02; } }

  // ---------- stage 3: subunit docks (ghost outlines that fill up) ----------
  const docks = {};
  for (const [k, x, lab] of [['small', -1.3, '40S · SMALL SUBUNIT'], ['large', 1.35, '60S · LARGE SUBUNIT']]) {
    const grp = new THREE.Group(); grp.position.copy(L(x, -0.5, 0.35)); face(grp); grp.userData.big = 1.3; kit.add(grp);
    const ghost = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), kit.additive(k === 'small' ? 0x5ce1ff : 0xff9a4a, 0.14, 1.2));
    ghost.scale.set(k === 'small' ? 1.2 : 1.5, k === 'small' ? 0.55 : 0.88, 0.5); grp.add(ghost);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.02, 8, 64), kit.additive(k === 'small' ? 0x5ce1ff : 0xff9a4a, 0.8, 2.5)); ring.scale.copy(ghost.scale); grp.add(ring);
    const tag = kit.text(lab, { h: 0.24, fg: k === 'small' ? '#9fefff' : '#ffc89a', font: '800 64px Montserrat, sans-serif' }); tag.position.set(0, k === 'small' ? -0.85 : -1.1, 0.05); grp.add(tag);
    const hit = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), kit.own(new THREE.MeshBasicMaterial({ visible: false }))); hit.scale.copy(ghost.scale).multiplyScalar(1.1); grp.add(hit);
    grp.visible = false;
    docks[k] = { grp, ghost, ring, fill: 0, parts: [] };
  }
  // real subunit bodies (from the shared ribosome model) that materialise inside the docks
  const subs = {};
  for (const k of ['small', 'large']) {
    const r = makeRibosome(kit, { scale: k === 'small' ? 1.55 : 1.6 });
    const body = k === 'small' ? r.small : r.large;
    (k === 'small' ? r.large : r.small).visible = false;
    r.group.position.copy(docks[k].grp.position).add(V(0, k === 'small' ? 0.45 : -0.7, 0)); face(r.group);
    r.group.visible = false; kit.add(r.group);
    subs[k] = { grp: r.group, body };
  }
  const prots = kit.beads(80, 0.045, { intensity: 3.0 });
  const PR = { n: 0, list: [] };

  // ---------- per-frame ----------
  const update = (dt, t) => {
    drawTree(t);
    nlGlow.material.opacity = 0.35 + 0.15 * Math.sin(t * 2.2);
    for (const d of Object.values(docks)) { const pr = 1 + 0.025 * Math.sin(t * 2.4); d.ring.scale.set(d.ghost.scale.x * pr, d.ghost.scale.y * pr, d.ghost.scale.z); // pulse (an elliptical ring must not spin: it would poke out of the frame)
       d.ghost.material.opacity = 0.1 + 0.12 * d.fill + 0.05 * Math.sin(t * 3) * (d.hot ? 1 : 0); }
    let i = 0;
    for (const p of PR.list) { if (p.a > 0) prots.set(i++, p.pos, Math.min(1, p.a), p.c); }
    for (; i < 80; i++) prots.hide(i);
    prots.commit();
  };

  // ---------- flow ----------
  let step = 'tx';
  const prog = (f, s) => api.progress(f, s);
  api.goal('<b>Make ribosomal RNA.</b> The nucleolus forms around the rRNA genes. Click the rDNA (or the button) to send RNA polymerase I racing along it.', true);
  prog(0.03, 'Step 1 / 4 · rRNA genes');
  kit.label('rdna', 'rDNA repeat (rRNA gene)', 'rDNA', () => L(RX0 + 0.3, RY - 0.25, 0.4));
  const g1 = async () => {
    if (step !== 'tx') return; step = 'busy'; api.buttons([]); kit.unpick(h1);
    TX.on = true; ctx.sfx('valve_turn');
    kit.label('pol1', 'RNA polymerase I (many at once)', 'Pol I', () => pols[2].position.clone().add(V(0, -0.35, 0)));
    let last = 0;
    await kit.to(TX, { run: 1.6, duration: 3.6, ease: 'none', onUpdate: () => { if (kit.time - last > 0.12) { last = kit.time; ctx.sfx('typewriter_tick', { volume: 0.3, pitch: 0.8 + Math.random() * 0.6 }); } } });
    kit.label('tree', '“Christmas tree”: growing pre-rRNA', '47S', () => L(0.4, RY + 1.3, 0.4));
    ctx.sfx('discovery_chime');
    await kit.wait(1.2);
    // collapse the tree into one 47S precursor up top
    kit.unlabel('tree'); kit.unlabel('pol1');
    await kit.to(TX, { gone: 1, duration: 0.6 });
    TX.on = false;
    segObjs.forEach((m, k) => { m.visible = true; m.scale.setScalar(0.001); kit.tween(m.scale, { x: 1, y: 1, z: 1, duration: 0.5, delay: k * 0.05, ease: 'back.out(2)' }); });
    kit.label('pre', '47S pre-rRNA (one long precursor)', '47S', () => L(-0.3, PRE_Y + 0.35, 0.4));
    api.goal('<b>Cut and modify.</b> Small nucleolar RNAs (snoRNAs) guide chemical tags onto the precursor, then it is cut into three rRNAs. Click the precursor to process it.');
    prog(0.2, 'Step 2 / 4 · processing');
    step = 'cut';
    const hit = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.6, 0.4), kit.own(new THREE.MeshBasicMaterial({ visible: false }))); face(hit); hit.position.copy(L(-0.15, PRE_Y, 0.35)); kit.add(hit);
    const h2 = kit.pick(hit, () => g2(h2));
    api.buttons([{ label: 'Process the pre-rRNA', solid: true, onClick: () => g2(h2) }]);
  };
  const rdnaHit = new THREE.Mesh(new THREE.BoxGeometry(RX1 - RX0 + 0.6, 0.5, 0.4), kit.own(new THREE.MeshBasicMaterial({ visible: false }))); face(rdnaHit); rdnaHit.position.copy(L((RX0 + RX1) / 2, RY, 0.35)); kit.add(rdnaHit);
  const h1 = kit.pick(rdnaHit, g1);
  api.buttons([{ label: 'Transcribe rDNA (Pol I)', solid: true, onClick: g1 }]);

  async function g2(h) {
    if (step !== 'cut') return; step = 'busy'; api.buttons([]); kit.unpick(h);
    // snoRNA-guided modifications: sparkles hop along the rRNA parts
    for (let k = 0; k < 8; k++) { const m = segObjs[[1, 3, 5][k % 3]]; kit.burst(L(m.userData.x + (Math.random() - 0.5) * m.userData.len, PRE_Y, 0.4), 0xffffff, { count: 6, speed: 0.6, size: 0.1, life: 0.5 }); ctx.sfx('bubble', { volume: 0.25, pitch: 1.2 + k * 0.05 }); await kit.wait(0.1); }
    kit.label('sno', 'snoRNAs guide modifications', 'snoRNA', () => L(-1.9, PRE_Y + 0.35, 0.4));
    await kit.wait(0.5);
    ctx.sfx('zap', { volume: 0.5 });
    // cut: spacers fade, rRNAs separate
    kit.unlabel('pre'); kit.unlabel('sno');
    segObjs.forEach((m) => {
      if (m.userData.id === 'ETS' || m.userData.id === 'ITS') { kit.burst(m.position, CSP, { count: 10, speed: 0.8, size: 0.1 }); kit.tween(m.scale, { x: 0.001, y: 0.001, z: 0.001, duration: 0.5 }); }
    });
    // lay the three rRNAs out in a row, then 5S flies in from outside the nucleolus
    const row = { '18S': -1.9, '5.8S': -0.75, '28S': 0.85 };
    for (const m of segObjs) if (row[m.userData.id] !== undefined) kit.tween(m.position, { ...xyz(L(row[m.userData.id], PRE_Y, 0.34)), duration: 0.8, ease: 'power2.inOut' });
    const s5 = face(new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.35, 4, 10), kit.glow(C5, 3.4))); s5.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), Math.PI / 2)); s5.userData = { id: '5S' };
    s5.position.copy(L(3.6, 2.4, 0.5)); kit.add(s5);
    kit.tween(s5.position, { ...xyz(L(2.6, PRE_Y, 0.34)), duration: 1.2, delay: 0.5, ease: 'power2.out' });
    await kit.wait(1.0);
    const tags = {};
    for (const m of [...segObjs.filter((q) => row[q.userData.id] !== undefined), s5]) {
      const id = m.userData.id;
      const t = kit.text(`${id} rRNA`, { h: 0.23, fg: '#ffffff', font: '800 60px Montserrat, sans-serif', glow: 8 }); t.position.set(0, 0, 0); kit.add(t); face(t);
      tags[id] = t; m.userData.tag = t;
    }
    kit.label('5s', '5S rRNA arrives (made by Pol III elsewhere)', '5S', () => s5.position.clone().add(V(0, 0.35, 0)));
    const pieces = { '18S': segObjs[1], '5.8S': segObjs[3], '28S': segObjs[5], '5S': s5 };
    kit.onUpdate(() => { for (const m of Object.values(pieces)) if (m.userData.tag) m.userData.tag.position.copy(m.position).add(V(0, 0.22, 0)); });
    await kit.wait(0.8);
    beginSort(pieces);
  }

  // ---------- stage 3: sorting rRNAs into subunits ----------
  let sortIdx = 0, sortBusy = false, piecesRef = null;
  function beginSort(pieces) {
    piecesRef = pieces; step = 'sort';
    dimCutaway();
    for (const d of Object.values(docks)) { d.grp.visible = true; d.grp.scale.setScalar(0.001); kit.tween(d.grp.scale, { x: 1, y: 1, z: 1, duration: 0.6, ease: 'back.out(1.8)' }); }
    for (const k of ['small', 'large']) docks[k].h = kit.pick(docks[k].grp, () => place(k), { onHover: (on) => { docks[k].hot = on; } });
    prog(0.38, 'Step 3 / 4 · build the subunits');
    nextPiece();
  }
  function nextPiece() {
    if (sortIdx >= PIECES.length) return addProteins();
    const P = PIECES[sortIdx], m = piecesRef[P.id];
    kit.tween(m.scale, { x: 1.35, y: 1.35, z: 1.35, duration: 0.25, yoyo: true, repeat: 1 });
    ctx.sfx('interact_ping', { pitch: 1 + sortIdx * 0.08 });
    kit.unlabel('5s');
    kit.label('cur', `${P.id} rRNA · which subunit?`, '?', () => m.position.clone().add(V(0, 0.55, 0)));
    api.goal(`<b>Build the subunits.</b> Where does the <b>${P.id} rRNA</b> go? Click the small (40S) or the large (60S) subunit.`);
    api.buttons([{ label: '→ Small 40S', onClick: () => place('small') }, { label: '→ Large 60S', onClick: () => place('large') }]);
  }
  async function place(k) {
    if (step !== 'sort' || sortBusy) return; sortBusy = true;
    const P = PIECES[sortIdx], m = piecesRef[P.id], d = docks[k];
    const home = m.position.clone();
    if (P.to !== k) {
      ctx.sfx('error_soft');
      await kit.to(m.position, { ...xyz(d.grp.position.clone().add(V(0, 0.6, 0))), duration: 0.5, ease: 'power2.in' });
      kit.ring(d.grp.position.clone().add(V(0, 0.4, 0.1)), 0xff7a7a, { r: 0.2, to: 0.9, life: 0.5 });
      await kit.to(m.position, { ...xyz(home), duration: 0.6, ease: 'back.out(1.5)' });
      api.goal(`<b>Not that one.</b> ${P.why} <i>Try the other subunit.</i>`);
      sortBusy = false; return;
    }
    ctx.sfx('parcel_thunk', { volume: 0.6 });
    d.parts.push(m);
    const slot = d.grp.position.clone().add(V((d.parts.length - 1) * 0.3 - (k === 'large' ? 0.3 : 0), -0.05 + (d.parts.length - 1) * 0.12, 0.05));
    await kit.to(m.position, { ...xyz(slot), duration: 0.7, ease: 'power2.inOut' });
    kit.tween(m.scale, { x: 0.75, y: 0.75, z: 0.75, duration: 0.4 });
    kit.burst(slot, P.color, { count: 18, speed: 1.0, size: 0.13 });
    d.fill = Math.min(1, d.fill + (k === 'small' ? 1 : 0.34));
    api.goal(`<b>Yes!</b> ${P.why}`);
    sortIdx++;
    prog(0.38 + 0.3 * (sortIdx / PIECES.length), `Step 3 / 4 · ${sortIdx} / 4 rRNAs placed`);
    await kit.wait(1.3);
    sortBusy = false;
    nextPiece();
  }

  async function addProteins() {
    step = 'busy'; api.buttons([]); kit.unlabel('cur');
    for (const d of Object.values(docks)) kit.unpick(d.h);
    api.goal('<b>Ribosomal proteins arrive.</b> They are made in the cytoplasm and imported through nuclear pores: about 33 join the small subunit and about 47 the large one.');
    kit.label('rp', 'Ribosomal proteins (imported)', 'RP', () => L(0, 1.8, 0.5));
    ctx.sfx('whoosh', { volume: 0.5 });
    // ~33 + ~47 protein beads stream in from the top of the inset
    for (let i = 0; i < 80; i++) {
      const k = i < 33 ? 'small' : 'large', d = docks[k];
      const p = { pos: L(-3 + Math.random() * 6, 2.3, 0.4), a: 0, c: k === 'small' ? 0xa8f4ff : 0xffd0a8 };
      PR.list.push(p);
      const tgt = d.grp.position.clone().add(V((Math.random() - 0.5) * (k === 'small' ? 1.4 : 1.9), (Math.random() - 0.5) * (k === 'small' ? 0.5 : 0.9), (Math.random() - 0.5) * 0.4));
      kit.tween(p, { a: 1, duration: 0.3, delay: i * 0.02 });
      kit.tween(p.pos, { ...xyz(tgt), duration: 1.0, delay: i * 0.02, ease: 'power2.inOut' });
    }
    for (let k = 0; k < 6; k++) { ctx.sfx('bubble', { volume: 0.25, pitch: 0.8 + k * 0.1 }); await kit.wait(0.25); }
    await kit.wait(0.6);
    // the ghosts condense into finished subunits
    for (const k of ['small', 'large']) {
      const s = subs[k]; s.grp.visible = true; s.grp.scale.setScalar(0.001);
      kit.tween(s.grp.scale, { x: k === 'small' ? 1.55 : 1.6, y: k === 'small' ? 1.55 : 1.6, z: k === 'small' ? 1.55 : 1.6, duration: 0.8, ease: 'back.out(1.6)' });
      kit.tween(docks[k].grp.scale, { x: 0.001, y: 0.001, z: 0.001, duration: 0.6, delay: 0.2 });
      kit.burst(docks[k].grp.position, k === 'small' ? C18 : C28, { count: 40, speed: 1.6, size: 0.18 });
    }
    for (const p of PR.list) kit.tween(p, { a: 0, duration: 0.5, delay: 0.3 });
    for (const m of Object.values(piecesRef)) { kit.tween(m.scale, { x: 0.001, y: 0.001, z: 0.001, duration: 0.5, delay: 0.3 }); if (m.userData.tag) kit.tween(m.userData.tag.material, { opacity: 0, duration: 0.4 }); }
    ctx.sfx('discovery_chime');
    kit.unlabel('rp');
    kit.label('s40', 'Small subunit · 40S', '40S', () => subs.small.grp.position.clone().add(V(0, 0.75, 0)));
    kit.label('s60', 'Large subunit · 60S', '60S', () => subs.large.grp.position.clone().add(V(0, 1.75, 0)));
    await kit.wait(1.0);
    api.goal('<b>Two subunits ready.</b> They are <b>not</b> joined yet: each leaves the nucleus on its own. Click a subunit (or the button) to export them.');
    prog(0.72, 'Step 4 / 4 · export');
    step = 'export';
    const hs = ['small', 'large'].map((k) => kit.pick(subs[k].grp, () => exportBoth(hs)));
    api.buttons([{ label: 'Export separately', solid: true, onClick: () => exportBoth(hs) }]);
  }

  // ---------- stage 4: separate export, joining on mRNA in the cytoplasm ----------
  function poreAt(phiDeg, elevDeg, inset = -0.5) {
    const ph = phiDeg * D, e = elevDeg * D;
    const dir = V(Math.cos(e) * Math.cos(ph), Math.sin(e) * NUCLEUS.domeScaleY, Math.cos(e) * Math.sin(ph));
    const p = V(NUCLEUS.x + Math.cos(e) * Math.cos(ph) * (R + inset), PH + Math.sin(e) * (R + inset) * NUCLEUS.domeScaleY, NZ + Math.cos(e) * Math.sin(ph) * (R + inset));
    return { p, n: dir.normalize() };
  }
  async function exportBoth(hs) {
    if (step !== 'export') return; step = 'busy'; api.buttons([]); hs.forEach((h) => kit.unpick(h));
    kit.unlabel('nl');
    const pores = { small: poreAt(164, 34), large: poreAt(150, 52) };
    // pore rings
    for (const k of ['small', 'large']) {
      const P = pores[k]; const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.07, 8, 40), kit.glow(0x9ff4ff, 4)); ring.position.copy(P.p); ring.quaternion.setFromUnitVectors(V(0, 0, 1), P.n); kit.add(ring);
      const s = kit.sprite(0x9ff4ff, 2.2, 0.5); s.position.copy(P.p); kit.add(s);
    }
    // mRNA waiting in the cytoplasm, over the ER terraces to the left of the nucleus
    const mPos = V(NUCLEUS.x - 15.5, 6.2, NZ + 6.5);
    const mCurve = new THREE.CatmullRomCurve3([mPos.clone().add(V(-2.6, -0.2, -0.6)), mPos.clone().add(V(-1.2, 0.15, -0.2)), mPos.clone(), mPos.clone().add(V(1.3, -0.15, 0.3)), mPos.clone().add(V(2.6, 0.1, 0.5))]);
    const mrna = new THREE.Mesh(new THREE.TubeGeometry(mCurve, 60, 0.07, 8), kit.glow(0xffd27a, 3.6)); kit.add(mrna);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), kit.glow(0xff4fd8, 4)); cap.position.copy(mCurve.getPoint(0)); kit.add(cap);
    mrna.scale.setScalar(0.001); kit.tween(mrna.scale, { x: 1, y: 1, z: 1, duration: 0.8 });
    // camera: pull out to see the dome and the cytoplasm beside it
    kit.unlabel('s40'); kit.unlabel('s60'); kit.unlabel('rdna');
    kit.fly(V(NUCLEUS.x - 11.5, 6.0, NZ + 4.2), { yaw: -32, pitch: 22, dist: 20, fov: 40 }, 2.6);
    ctx.sfx('whoosh', { volume: 0.6 });
    kit.label('sep', 'Exported separately: 40S and 60S travel alone', '≠', () => subs.small.grp.position.clone().add(V(0, 1.0, 0)));
    // world-space flights: subunit → its own pore → out → onto the mRNA
    const fly = async (k, delay, onto) => {
      const s = subs[k]; const P = pores[k];
      const start = s.grp.position.clone();
      const path = new THREE.CatmullRomCurve3([start, start.clone().lerp(P.p, 0.5).add(V(0, 0.8, 0)), P.p.clone().addScaledVector(P.n, -1.0), P.p.clone(), P.p.clone().addScaledVector(P.n, 2.0), onto.clone().add(V(0.6, 2.5, -0.4)), onto], false, 'centripetal');
      await kit.wait(delay);
      ctx.sfx('vesicle_bloop', { pitch: k === 'small' ? 1.3 : 0.9 });
      const o = { u: 0 }; let passed = false;
      await kit.to(o, {
        u: 1, duration: 5.2, ease: 'power1.inOut',
        onUpdate: () => {
          s.grp.position.copy(path.getPointAt(o.u));
          if (!passed && o.u > 0.42) { passed = true; kit.ring(P.p, 0x9ff4ff, { r: 0.5, to: 2.0, normal: P.n }); kit.burst(P.p, 0x9ff4ff, { count: 26, speed: 1.6, size: 0.2 }); ctx.sfx('zap', { volume: 0.35, pitch: 1.5 }); }
        },
      });
    };
    const onSmall = mCurve.getPoint(0.36).add(V(0, -0.38, 0)), onLarge = mCurve.getPoint(0.36).add(V(0, -0.38, 0));
    await Promise.all([fly('small', 0.2, onSmall), fly('large', 1.6, onLarge.clone().add(V(0, 2.4, 0)))]);
    kit.unlabel('sep');
    // ending reveal: close on the mRNA where the two subunits meet, centred right of the activity panel
    ctx.rig.flyTo(framePose(ctx, mCurve.getPoint(0.4).add(V(0, 0.6, 0)), { yaw: -24, pitch: 24, dist: 9.5, fov: 40, sx: 0.12, sy: 0.0 }), 1.6);
    kit.label('m', 'mRNA in the cytoplasm', 'mRNA', () => mCurve.getPoint(0.85).add(V(0, 0.4, 0)));
    kit.label('s40', '40S binds the mRNA first', '40S', () => subs.small.grp.position.clone().add(V(-0.9, -0.4, 0)));
    api.goal('<b>Outside, at last together.</b> The small subunit grabs the mRNA first; now the large subunit joins on top. Click to join them.');
    step = 'join';
    const hj = kit.pick(subs.large.grp, () => join(hj, onLarge));
    api.buttons([{ label: 'Join on the mRNA', solid: true, onClick: () => join(hj, onLarge) }]);
  }
  async function join(h, onLarge) {
    if (step !== 'join') return; step = 'done'; api.buttons([]); kit.unpick(h);
    await kit.to(subs.large.grp.position, { ...xyz(onLarge), duration: 0.9, ease: 'power3.in' });
    const p = subs.large.grp.position.clone().add(V(0, 0.6, 0));
    kit.ring(p, 0xffd27a, { r: 0.4, to: 3.0, life: 1.0 }); kit.burst(p, 0xffd27a, { count: 60, speed: 2.4, size: 0.24 });
    ctx.sfx('parcel_thunk'); ctx.sfx('zap', { volume: 0.4 });
    kit.unlabel('s40');
    kit.label('80s', '80S ribosome, assembled on the mRNA', '80S', () => subs.large.grp.position.clone().add(V(0, 2.0, 0)));
    await kit.wait(0.8);
    api.finish('<b>Ribosome assembled!</b> The nucleolus made rRNA with RNA polymerase I, cut it into 18S, 5.8S and 28S (plus 5S from elsewhere) and packed it with imported proteins into a <b>40S</b> and a <b>60S</b> subunit. They left the nucleus <b>separately</b> and joined only on an <b>mRNA in the cytoplasm</b>, forming the 80S ribosome.');
  }

  return update;
}

function xyz(v) { return { x: v.x, y: v.y, z: v.z }; }
