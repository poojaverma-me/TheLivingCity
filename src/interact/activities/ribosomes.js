// Activity · Ribosomes — "Translate mRNA".
// A magnified 80S ribosome projected from a ribosome on the rough ER. Codon by codon, the player picks the tRNA
// whose anticodon pairs with the codon in the A site (A–U, G–C). Peptide bonds form at the peptidyl-transferase
// centre, the ribosome translocates, the chain grows out of the exit tunnel, and a release factor reads the stop codon.
// Takeaway: ribosomes read mRNA in three-letter codons; tRNAs bring the matching amino acids until a stop codon.
import * as THREE from 'three';
import { runActivity } from './_shared.js';
import { organic } from '../../core/lookdev.js';
import { NUCLEUS, RER } from '../../world/layout.js';

const BASEC = { A: '#6cff9a', U: '#ff7a9c', G: '#ffd45c', C: '#5cb8ff' };
const PAIR = { A: 'U', U: 'A', G: 'C', C: 'G' };
const anti = (codon) => codon.split('').map((b) => PAIR[b]).join(''); // written 3′→5′ under the codon
// a small, correct subset of the standard genetic code
const CODE = { AUG: 'Met', UUU: 'Phe', GGC: 'Gly', UGG: 'Trp', AAA: 'Lys', GCU: 'Ala', CAU: 'His', UAU: 'Tyr', UUA: 'Leu', GAA: 'Glu', CCC: 'Pro', AGC: 'Ser' };
const AAC = { Met: 0xffd24a, Phe: 0x59e0ff, Gly: 0x7dff9a, Trp: 0xff7ab8, Lys: 0xb48cff, Ala: 0xff9a4a, His: 0x4affd2, Tyr: 0xfff07a, Leu: 0x8ab4ff, Glu: 0xff5a5a, Pro: 0xd6ff5a, Ser: 0xffa8e0 };
const ORF = ['AUG', 'UUU', 'GGC', 'UGG', 'AAA', 'UAA'];
const DISTRACT = [['UUU', 'GGC'], ['GAA', 'GGC'], ['CCC', 'UUU'], ['UAU', 'AAA'], ['UUU', 'GCU'], ['UAU', 'UUA']];
const UTR5 = 'GCCACC', UTR3 = 'GCAUAAAG';
const NT = 0.27, CW = NT * 3; // nucleotide pitch, codon width
const MY = -1.0, AY = MY + 0.34; // mRNA letters y, anticodon letters y (plate-local)
const RIBO_X = -0.95, P_X = RIBO_X, A_X = RIBO_X + CW, E_X = RIBO_X - CW;

export function start(ctx) { return runActivity(ctx, (kit, api) => build(ctx, kit, api)); }

function build(ctx, kit, api) {
  api.buttons([]); // clear the previous run's Play again / Finish buttons on replay
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  // ---------- staging: hologram above the outer rough-ER ring, projected from one of its ribosomes ----------
  const ringR = RER.rings[RER.rings.length - 1];
  const ang = 101 * Math.PI / 180;
  const src = V(NUCLEUS.x + Math.cos(ang) * (ringR + 0.55), 1.25, NUCLEUS.z + Math.sin(ang) * (ringR + 0.55));
  const C = V(src.x - 0.6, 4.15, src.z + 3.4);
  const yaw = -6 * Math.PI / 180;
  const plate = kit.holoPlate({ w: 8.2, h: 4.6, color: 0xff9ad8, pos: C, yaw, title: 'MAGNIFIED · 80S RIBOSOME' });
  plate.updateMatrixWorld(true);
  kit.beam(src, C.clone().add(V(-0.6, -2.3, 0)), 0xff9ad8, 0.04, 0.32, 0.08);
  const srcGlow = kit.sprite(0xff6a4a, 1.3, 0.9); srcGlow.position.copy(src); kit.add(srcGlow);
  const L = (x, y, z = 0.3) => plate.localToWorld(new THREE.Vector3(x, y, z));
  kit.light(0xffb0e0, 9, 9, L(-0.5, 0, 1.6));
  kit.fly(L(-1.05, 0.1, 0), { yaw: -6, pitch: 7, dist: 10.4, fov: 40 }, 1.8);
  kit.label('src', 'Ribosome on the rough ER (real size ≈ 25 nm)', '80S', () => src.clone().add(V(0, 0.35, 0)));

  // ---------- ribosome: small (40S) + large (60S) subunits ----------
  const ribo = new THREE.Group(); ribo.position.copy(L(RIBO_X + CW * 0.35, 0, 0.0)); ribo.rotation.y = yaw; kit.add(ribo);
  const lumpy = (parts, mat) => { const g = new THREE.Group(); for (const [x, y, z, sx, sy, sz] of parts) { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 24), mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); g.add(m); } return g; };
  const smallMat = organic(kit.gloss(0xff7cc0, { ei: 0.5, opacity: 0.6, rough: 0.2 }), { rim: 0xffd0f0, rimPower: 2.2, rimStrength: 1.2, sss: 0xff5ab0, sssStrength: 0.3 });
  const largeMat = organic(kit.gloss(0xd8489c, { ei: 0.35, opacity: 0.36, rough: 0.2 }), { rim: 0xffc0ec, rimPower: 2.0, rimStrength: 1.4, sss: 0xd8489c, sssStrength: 0.25 });
  smallMat.depthWrite = false; largeMat.depthWrite = false;
  const small = lumpy([[0, MY - 0.4, 0, 1.4, 0.3, 0.6], [-0.88, MY - 0.3, 0.05, 0.5, 0.28, 0.45], [0.9, MY - 0.34, 0, 0.45, 0.26, 0.44]], smallMat);
  const large = lumpy([[0, 0.02, 0, 1.45, 0.82, 0.7], [-1.18, 0.3, 0, 0.4, 0.38, 0.4], [1.12, 0.35, 0.05, 0.36, 0.32, 0.36], [0.05, 0.66, 0, 0.75, 0.38, 0.5]], largeMat);
  small.renderOrder = 4; large.renderOrder = 5;
  ribo.add(small, large);
  // exit tunnel mouth + PTC glow
  const tunnel = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.04, 8, 28), kit.glow(0xffc6f0, 4)); tunnel.position.set(-0.35, 1.05, 0.1); tunnel.rotation.x = Math.PI / 2; ribo.add(tunnel);
  const ptc = kit.sprite(0xfff0a0, 0.9, 0.0); kit.add(ptc);
  ribo.scale.setScalar(0.001);
  kit.tween(ribo.scale, { x: 1, y: 1, z: 1, duration: 0.8, delay: 0.4, ease: 'back.out(1.6)' });
  // site markers
  const siteTag = (txt, x) => { const t = kit.text(txt, { h: 0.23, fg: '#ffe6f6', font: '800 70px Montserrat, sans-serif' }); t.position.copy(L(x, MY - 0.98, 0.62)); t.rotation.y = yaw; kit.add(t); return t; };
  siteTag('E', E_X); siteTag('P', P_X); siteTag('A', A_X);
  const aFrame = new THREE.Group(); aFrame.rotation.y = yaw; kit.add(aFrame);
  const frameMat = kit.additive(0xfff07a, 0.9, 3);
  for (const [w, h, x, y] of [[CW + 0.12, 0.03, 0, 0.2], [CW + 0.12, 0.03, 0, -0.2], [0.03, 0.43, -(CW + 0.12) / 2, 0], [0.03, 0.43, (CW + 0.12) / 2, 0]]) {
    const b = new THREE.Mesh(new THREE.PlaneGeometry(w, h), frameMat); b.position.set(x, y, 0); aFrame.add(b);
  }
  aFrame.material = frameMat;

  // ---------- mRNA: glowing backbone + nucleotide letters ----------
  const fullSeq = (UTR5 + ORF.join('') + UTR3).split('');
  const startIdx = UTR5.length; // index of the A of AUG
  const mrna = new THREE.Group(); kit.add(mrna);
  mrna.rotation.y = yaw;
  const letters = fullSeq.map((b, i) => {
    const t = kit.text(b, { h: 0.26, fg: BASEC[b], font: '900 96px Montserrat, sans-serif', glow: 18, pad: 10 });
    t.userData.i = i; mrna.add(t); return t;
  });
  const back = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, fullSeq.length * NT + 0.4, 10), kit.glow(0xffe0a0, 3.2));
  back.rotation.z = Math.PI / 2; mrna.add(back);
  const capB = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), kit.glow(0xff4fd8, 4)); mrna.add(capB);
  const S = { shift: 0, fade: 1 }; // shift: how many nucleotides the mRNA has moved left
  // P-site codon index (0 = AUG): mRNA x so that codon c sits in the P site
  const mrnaX = (c) => P_X - (startIdx + c * 3 + 1) * NT;
  S.shift = mrnaX(-3.5);
  kit.tween(S, { shift: mrnaX(0), duration: 1.6, delay: 0.8, ease: 'power2.out' });
  // keep the mRNA inside the hologram frame: letters fade out near the edges, the backbone is trimmed to the window
  const WIN = 8.2 / 2 - 0.3, FADE = 0.45, BLEN = fullSeq.length * NT + 0.4;
  function drawMRNA() {
    const len = fullSeq.length * NT;
    letters.forEach((t, i) => {
      const x = S.shift + i * NT + NT / 2; t.position.set(x, MY, 0.32);
      const edge = THREE.MathUtils.clamp((WIN - Math.abs(x)) / FADE, 0, 1);
      t.material.opacity = S.fade * edge; t.visible = edge > 0.01;
    });
    const x0 = Math.max(-WIN, S.shift - 0.2), x1 = Math.min(WIN, S.shift + len + 0.2);
    back.visible = x1 > x0;
    if (back.visible) { back.position.set((x0 + x1) / 2, MY - 0.17, 0.3); back.scale.set(1, (x1 - x0) / BLEN, 1); }
    capB.position.set(S.shift - 0.1, MY - 0.17, 0.3); capB.visible = Math.abs(S.shift - 0.1) < WIN;
    mrna.position.copy(plate.position);
  }

  // ---------- tRNA factory ----------
  const bodyMat = kit.gloss(0xffe3c4, { ei: 0.55, rough: 0.25 });
  const rfMat = kit.gloss(0x8ff0c8, { ei: 0.7, rough: 0.25 });
  function makeTRNA(codon, { rf = false } = {}) {
    const grp = new THREE.Group(); grp.rotation.y = yaw;
    const mat = rf ? rfMat : bodyMat;
    // anticodon arm (bar) + stem + two side loops + acceptor stem
    const bar = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, CW - 0.12, 4, 10), mat); bar.rotation.z = Math.PI / 2; bar.position.y = 0.16; grp.add(bar);
    const stem = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.62, 4, 10), mat); stem.position.y = 0.6; grp.add(stem);
    const lobeL = new THREE.Mesh(new THREE.SphereGeometry(0.15, 18, 12), mat); lobeL.position.set(-0.2, 0.62, 0); grp.add(lobeL);
    const lobeR = new THREE.Mesh(new THREE.SphereGeometry(0.13, 18, 12), mat); lobeR.position.set(0.19, 0.7, 0); grp.add(lobeR);
    const elbow = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.26, 4, 10), mat); elbow.position.set(0.12, 1.02, 0); elbow.rotation.z = -0.9; grp.add(elbow);
    let aa = null, aaName = null, ac = null;
    if (rf) {
      const t = kit.text('eRF1', { h: 0.25, fg: '#0d1f1a', bg: '#8ff0c8', font: '800 70px Montserrat, sans-serif', pad: 18 }); t.position.set(0, 1.35, 0.05); grp.add(t);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), kit.glow(0x6affc0, 4)); tip.position.set(0, 0.08, 0.06); grp.add(tip);
    } else {
      const name = CODE[codon];
      aa = new THREE.Mesh(new THREE.SphereGeometry(0.15, 22, 16), kit.glow(AAC[name], 3.6)); aa.position.set(0.24, 1.22, 0); grp.add(aa);
      aaName = kit.text(name, { h: 0.25, fg: '#ffffff', font: '800 70px Montserrat, sans-serif', glow: 10 }); aaName.position.set(0.24, 1.5, 0.05); grp.add(aaName);
      ac = anti(codon).split('').map((b, k) => { const t = kit.text(b, { h: 0.24, fg: BASEC[b], font: '900 96px Montserrat, sans-serif', glow: 18, pad: 10 }); t.position.set((k - 1) * NT, 0.0, 0.12); grp.add(t); return t; });
    }
    const hit = new THREE.Mesh(new THREE.BoxGeometry(CW + 0.2, 1.75, 0.5), kit.own(new THREE.MeshBasicMaterial({ visible: false }))); hit.position.y = 0.75; grp.add(hit);
    grp.userData = { codon, rf, aa, aaName, ac, name: rf ? 'eRF1' : CODE[codon] };
    kit.add(grp); return grp;
  }
  // tRNA "anchor" = centre of its anticodon (plate-local); world placement via L()
  const placeT = (grp, x, y) => grp.position.copy(L(x, y, 0.32));

  // ---------- polypeptide chain (newest residue at the PTC, Met farthest out) ----------
  const chain = []; // { name, color, mesh, label }
  const chainS = { base: new THREE.Vector3(), released: 0, relOff: new THREE.Vector3() };
  const tunnelOut = () => ribo.localToWorld(new THREE.Vector3(-0.35, 1.12, 0.1));
  function chainPoint(k, t) {
    // k = 0 at PTC base; path: base → tunnel exit → curls to the upper left
    const base = chainS.base, exit = tunnelOut();
    if (k === 0) return base.clone();
    if (k === 1) return base.clone().lerp(exit, 0.6);
    const d = k - 1.5;
    const out = exit.clone().add(plate.localToWorld(new THREE.Vector3(-0.36 * d, 0.12 * d + 0.1 * Math.sin(d * 1.6 + t * 1.3), 0.15 * Math.sin(d + t))).sub(plate.position));
    return out;
  }
  function addResidue(name) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.15, 22, 16), kit.glow(AAC[name], 3.6));
    const label = kit.text(name, { h: 0.25, fg: '#ffffff', font: '800 70px Montserrat, sans-serif', glow: 10, sprite: true });
    kit.add(mesh); kit.add(label);
    chain.unshift({ name, mesh, label });
  }
  const bondMat = kit.glow(0xfff2c0, 3);
  const bonds = []; // little rods between residues
  function drawChain(t) {
    chain.forEach((r, k) => {
      const p = chainPoint(k, t).add(chainS.relOff);
      r.mesh.position.lerp(p, r.mesh.userData.placed ? 0.18 : 1); r.mesh.userData.placed = true;
      r.label.position.copy(r.mesh.position).add(V(0, 0.27, 0));
    });
    while (bonds.length < chain.length - 1) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1, 8), bondMat); kit.add(b); bonds.push(b); }
    bonds.forEach((b, k) => {
      const a = chain[k]?.mesh.position, c = chain[k + 1]?.mesh.position;
      if (!a || !c) { b.visible = false; return; }
      b.visible = true; b.position.copy(a).lerp(c, 0.5); b.scale.set(1, a.distanceTo(c), 1);
      b.quaternion.setFromUnitVectors(V(0, 1, 0), c.clone().sub(a).normalize());
    });
  }

  // ---------- per-frame ----------
  let pT = null, aT = null, eT = null; // tRNAs in P, A, E sites
  const update = (dt, t) => {
    drawMRNA();
    // A-site highlight frame
    aFrame.position.copy(L(A_X, MY, 0.34)); aFrame.material.opacity = S.aGlow * (0.6 + 0.4 * Math.sin(t * 6));
    if (pT && pT.userData.aa) chainS.base.copy(pT.userData.aa.getWorldPosition(new THREE.Vector3()));
    drawChain(t);
    for (const o of options) if (o.grp.userData.idle) o.grp.position.y = o.y0 + Math.sin(t * 2 + o.k) * 0.05;
    srcGlow.material.opacity = 0.6 + 0.3 * Math.sin(t * 5);
  };
  S.aGlow = 0;

  // ---------- options ----------
  let options = [];
  const OPT_X = [0.35, 1.6, 2.85], OPT_Y = 0.55;
  function showOptions(codon, step) {
    const correct = codon === 'UAA' ? { rf: true } : { codon };
    const pool = [correct, ...DISTRACT[step].map((c) => ({ codon: c }))];
    // deterministic shuffle per step so the right answer moves around
    const order = [[1, 0, 2], [0, 2, 1], [2, 1, 0], [1, 2, 0], [0, 1, 2], [2, 0, 1]][step];
    options = order.map((j, k) => {
      const o = pool[j];
      const grp = o.rf ? makeTRNA('UAA', { rf: true }) : makeTRNA(o.codon);
      const ok = o.rf ? true : o.codon === codon;
      placeT(grp, OPT_X[k], OPT_Y); grp.scale.setScalar(0.001);
      kit.tween(grp.scale, { x: 0.86, y: 0.86, z: 0.86, duration: 0.5, delay: k * 0.08, ease: 'back.out(2)' });
      grp.userData.idle = true;
      const opt = { grp, ok, k, y0: grp.position.y, codon: o.codon, rf: !!o.rf };
      opt.h = kit.pick(grp, () => choose(opt), { hover: false, onHover: (on) => { grp.userData.hot = on; kit.tween(grp.scale, { x: on ? 0.95 : 0.86, y: on ? 0.95 : 0.86, z: on ? 0.95 : 0.86, duration: 0.2 }); } });
      return opt;
    });
    api.buttons(options.map((o) => ({ label: o.rf ? 'Release factor eRF1' : `${CODE[o.codon]} · 3′-${anti(o.codon)}-5′`, onClick: () => choose(o) })));
  }

  // ---------- flow ----------
  let step = 0, busy = false;
  const codonAt = (c) => ORF[c];
  api.goal('<b>Translate the mRNA.</b> The start codon <b>AUG</b> sits in the ribosome. Pick the tRNA whose <b>anticodon</b> pairs with it: A pairs with U, G with C.', true);
  api.progress(0.02, `Codon 1 / ${ORF.length}`);
  kit.label('mrna', 'mRNA · read 5′→3′ in codons', 'mRNA', () => L(2.6, MY - 0.42, 0.4));
  kit.label('small', 'Small subunit (40S)', '40S', () => ribo.localToWorld(V(-1.6, MY - 0.75, 0.3)));
  kit.label('large', 'Large subunit (60S)', '60S', () => ribo.localToWorld(V(-1.7, 0.6, 0.3)));
  kit.later(1.6, () => { S.aGlow = 0; showOptions('AUG', 0); ctx.sfx('interact_ping'); });

  async function choose(o) {
    if (busy || !options.includes(o)) return; busy = true;
    const codon = codonAt(step);
    const site = step === 0 ? P_X : A_X;
    if (!o.ok) {
      ctx.sfx('error_soft');
      o.grp.userData.idle = false;
      const home = o.grp.position.clone();
      await kit.to(o.grp.position, { ...xyz(L(site, AY + 0.55, 0.32)), duration: 0.45, ease: 'power2.out' });
      o.ac?.forEach((t) => kit.tween(t.scale, { x: 1.25, y: 1.25, duration: 0.12, yoyo: true, repeat: 3 }));
      kit.ring(L(site, MY + 0.15, 0.4), 0xff6a6a, { r: 0.2, to: 0.8, life: 0.5 });
      await kit.to(o.grp.position, { ...xyz(home), duration: 0.55, ease: 'back.out(1.6)' });
      o.grp.userData.idle = true;
      const need = codon === 'UAA' ? null : anti(codon);
      api.goal(codon === 'UAA'
        ? `<b>No tRNA pairs with UAA</b> — it is a <b>stop codon</b>. A protein called a release factor reads stop codons instead. Try again!`
        : `<b>Not a match.</b> Anticodon 3′-${anti(o.codon)}-5′ pairs with codon <b>${o.codon}</b> (${CODE[o.codon]}). This codon is <b>${codon}</b>, so it needs <b>3′-${need}-5′</b>. Try again!`);
      busy = false; return;
    }
    // correct!
    api.buttons([]);
    for (const x of options) kit.unpick(x.h);
    for (const x of options) if (x !== o) { x.grp.userData.idle = false; kit.tween(x.grp.scale, { x: 0.001, y: 0.001, z: 0.001, duration: 0.35, ease: 'back.in(2)', onComplete: () => { x.grp.visible = false; } }); } // hide (not detach) so kit.end() disposes it
    o.grp.userData.idle = false;
    ctx.sfx('interact_ping', { pitch: 1.1 + step * 0.05 });
    kit.tween(o.grp.scale, { x: 1, y: 1, z: 1, duration: 0.5 });
    await kit.to(o.grp.position, { ...xyz(L(site, AY + 0.4, 0.32)), duration: 0.55, ease: 'power2.inOut' });
    await kit.to(o.grp.position, { ...xyz(L(site, AY, 0.32)), duration: 0.3, ease: 'power2.in' });
    // base-pairing flash
    ctx.sfx('atp_pop', { pitch: 1.3 });
    for (let k = 0; k < 3; k++) kit.burst(L(site + (k - 1) * NT, (MY + AY) / 2, 0.45), 0xffffff, { count: 8, speed: 0.6, size: 0.12, life: 0.5 });
    kit.ring(L(site, (MY + AY) / 2, 0.45), o.rf ? 0x6affc0 : 0xfff07a, { r: 0.2, to: 0.95, life: 0.6 });
    options = [];
    if (o.rf) return terminate(o.grp);
    if (step === 0) {
      // initiator tRNA-Met sits in the P site; first residue appears
      pT = o.grp; addResidue('Met'); pT.userData.aa.visible = false; pT.userData.aaName.visible = false;
      kit.label('ptRNA', 'Initiator tRNA-Met (P site)', 'tRNA', () => pT.getWorldPosition(new THREE.Vector3()).add(V(-0.55, 1.15, 0)));
      api.goal('<b>Start!</b> The initiator tRNA carries <b>methionine (Met)</b> into the P site. Now the next codon waits in the <b>A site</b> — find its tRNA.');
    } else {
      aT = o.grp;
      kit.unlabel('ptRNA');
      await kit.wait(0.25);
      // peptide bond at the PTC: chain moves from the P-site tRNA onto the A-site tRNA's amino acid
      const pp = pT.userData.aa.getWorldPosition(new THREE.Vector3()), ap = aT.userData.aa.getWorldPosition(new THREE.Vector3());
      ptc.position.copy(pp).lerp(ap, 0.5); ptc.material.opacity = 1; kit.tween(ptc.material, { opacity: 0, duration: 0.8 });
      kit.burst(ptc.position, 0xfff0a0, { count: 26, speed: 1.4, size: 0.16 });
      ctx.sfx('zap', { volume: 0.45, pitch: 1.5 });
      kit.label('ptc', 'Peptide bond · made by rRNA (ribozyme)', 'PTC', () => ptc.position.clone().add(V(0, 0.75, 0)));
      addResidue(aT.userData.name);
      chain[0].mesh.position.copy(ap); chain[0].mesh.userData.placed = true;
      pT.userData.aa.visible = false; pT.userData.aaName.visible = false;
      aT.userData.aa.visible = false; aT.userData.aaName.visible = false;
      chainS.base.copy(ap);
      const prevP = pT; pT = aT; aT = null;
      await kit.wait(0.7);
      // translocation: mRNA + tRNAs move one codon (P→E, A→P)
      ctx.sfx('valve_turn', { volume: 0.45 });
      kit.tween(S, { shift: mrnaX(step), duration: 0.7, ease: 'power2.inOut' });
      kit.tween(prevP.position, { ...xyz(L(E_X, AY, 0.32)), duration: 0.7, ease: 'power2.inOut' });
      await kit.to(pT.position, { ...xyz(L(P_X, AY, 0.32)), duration: 0.7, ease: 'power2.inOut' });
      // the deacylated tRNA leaves from the E site
      if (eT) eT.visible = false; // hide (not detach) so kit.end() disposes it
      eT = prevP;
      const leaving = eT;
      kit.tween(leaving.position, { ...xyz(L(E_X - 1.4, AY + 2.0, 0.6)), duration: 1.3, ease: 'power1.in' });
      kit.tween(leaving.scale, { x: 0.001, y: 0.001, z: 0.001, duration: 1.3, ease: 'power2.in', onComplete: () => { leaving.visible = false; } });
      kit.unlabel('ptc');
      if (step === 1) kit.label('tun', 'Exit tunnel · chain emerges', 'Tunnel', () => tunnelOut().add(V(0.5, 0.25, 0)));
      api.goal(`<b>${CODE[codonAt(step)]} added!</b> The ribosome shifted one codon along the mRNA; the empty tRNA leaves from the E site. Match the next codon in the A site.`);
    }
    step++;
    api.progress(step / ORF.length * 0.92, `Codon ${Math.min(step + 1, ORF.length)} / ${ORF.length} · chain: ${chain.slice().reverse().map((r) => r.name).join('–')}`);
    await kit.wait(0.4);
    S.aGlow = 1;
    showOptions(codonAt(step), step);
    if (codonAt(step) === 'UAA') api.goal('<b>UAA</b> is in the A site. Is there a tRNA for it? Choose what reads this codon.');
    busy = false;
  }

  async function terminate(rf) {
    S.aGlow = 0;
    ctx.sfx('discovery_chime');
    kit.label('rf', 'Release factor reads the stop codon', 'eRF1', () => rf.getWorldPosition(new THREE.Vector3()).add(V(0.6, 1.5, 0)));
    await kit.wait(0.7);
    // chain is released from the last tRNA and floats away, folding up
    pT.userData.aa && (pT.userData.aa.visible = false);
    ctx.sfx('whoosh', { volume: 0.5 });
    kit.burst(chainS.base, 0xffffff, { count: 30, speed: 1.6, size: 0.18 });
    kit.unlabel('tun');
    // the released chain drifts into the open right half of the panel (kept inside the frame)
    await kit.to(chainS.relOff, { ...xyz(plate.localToWorld(V(2.95, -0.35, 0.4)).sub(plate.position)), duration: 1.4, ease: 'power2.inOut' });
    kit.label('prot', `New protein: ${chain.slice().reverse().map((r) => r.name).join('–')}`, 'N→C', () => chain[Math.floor(chain.length / 2)].mesh.position.clone().add(V(0, 0.55, 0)));
    // subunits separate, tRNA + eRF1 leave
    ctx.sfx('vesicle_bloop');
    kit.tween(small.position, { y: -0.7, duration: 1.0, ease: 'power2.inOut' });
    kit.tween(large.position, { y: 0.6, duration: 1.0, ease: 'power2.inOut' });
    for (const g of [pT, rf, eT].filter(Boolean)) kit.tween(g.scale, { x: 0.001, y: 0.001, z: 0.001, duration: 0.8, delay: 0.2 });
    kit.unlabel('rf');
    api.progress(1, `Protein made: ${chain.slice().reverse().map((r) => r.name).join('–')}`);
    await kit.wait(0.6);
    kit.burst(chain[2].mesh.position, 0xffd24a, { count: 40, speed: 2.0, size: 0.22 });
    api.finish(`<b>Protein made: Met–Phe–Gly–Trp–Lys!</b> The ribosome read the mRNA three letters at a time; each tRNA’s anticodon paired with a codon and delivered its amino acid, until the stop codon <b>UAA</b> called in a release factor. (Real ribosomes add about 5 amino acids per second.)`);
  }

  return update;
}

function xyz(v) { return { x: v.x, y: v.y, z: v.z }; }
