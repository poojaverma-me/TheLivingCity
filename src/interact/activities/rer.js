// Activity · Rough ER — "Watch Protein Production".
// A magnified cut through the ER membrane above the real rough-ER terraces. The player triggers each step:
// translation starts → signal sequence emerges → SRP binds (translation pauses) → docks on the SRP receptor at the
// Sec61 translocon → chain threads into the lumen → signal peptidase trims, OST adds an N-linked glycan →
// BiP chaperones help it fold.
// Takeaway: a signal sequence brings the ribosome to the ER via SRP; the chain threads through Sec61 into the lumen,
// where it is trimmed, glycosylated and folded with chaperones.
import * as THREE from 'three';
import { runActivity, makeRibosome } from './_shared.js';
import { NUCLEUS } from '../../world/layout.js';

const D = Math.PI / 180;
const MEM_Y = -0.45, MEM_T = 0.5, PORE_X = 0.95;
const NCH = 32, SIG = 8, ASN = 17, SP = 0.13;
const C_SIG = 0xffe14a, C_PRO = 0x4affd2, C_HYD = 0xff9a4a, C_ASN = 0x7dff7a;

export function start(ctx) { return runActivity(ctx, (kit, api) => build(ctx, kit, api)); }

function build(ctx, kit, api) {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  // ---------- staging above the rough-ER terraces ----------
  const yaw = 20 * D;
  const C = V(8.2, 6.3, -12.6);
  const plate = kit.holoPlate({ w: 8.8, h: 5.0, color: 0x9ec4ff, pos: C, yaw, title: 'MAGNIFIED · ROUGH ER MEMBRANE' });
  plate.updateMatrixWorld(true);
  const L = (x, y, z = 0.3) => plate.localToWorld(new THREE.Vector3(x, y, z));
  const src = V(C.x, 3.55, C.z);
  kit.beam(src, L(0, -2.5, 0), 0x9ec4ff, 0.05, 0.4, 0.08);
  const srcGlow = kit.sprite(0x9ec4ff, 1.4, 0.8); srcGlow.position.copy(src); kit.add(srcGlow);
  kit.light(0xbfd8ff, 9, 10, L(0, 0, 1.8));
  kit.fly(L(-1.1, -0.1, 0), { yaw: 20, pitch: 8, dist: 11.2, fov: 40 }, 1.8);
  kit.label('src', 'Rough ER membrane (real thickness ≈ 5 nm)', 'RER', () => src.clone().add(V(0, 0.3, 0)));

  // ---------- membrane cross-section: bilayer of lipid heads + tails, lumen below ----------
  const W = 8.2, NL = 60;
  const heads = kit.beads(NL * 2, 0.075, { intensity: 1.6 });
  const tailGeo = new THREE.CylinderGeometry(0.014, 0.014, 0.16, 5);
  const tails = kit.instGlow(tailGeo, NL * 4, { intensity: 0.9 }); kit.add(tails);
  const lumen = new THREE.Mesh(new THREE.PlaneGeometry(W, 1.75), kit.additive(0x3a7cff, 0.3, 1));
  lumen.position.copy(L(0, MEM_Y - MEM_T / 2 - 0.9, 0.05)); lumen.rotation.y = yaw; kit.add(lumen);
  const lumenTag = kit.text('ER LUMEN', { h: 0.28, fg: '#9ec4ff', font: '800 64px Montserrat, sans-serif' });
  lumenTag.position.copy(L(-3.45, -2.15, 0.1)); lumenTag.rotation.y = yaw; kit.add(lumenTag);
  const cytoTag = kit.text('CYTOSOL', { h: 0.28, fg: '#ffd6f2', font: '800 64px Montserrat, sans-serif' });
  cytoTag.position.copy(L(-3.5, 1.95, 0.1)); cytoTag.rotation.y = yaw; kit.add(cytoTag);
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1);
  const memState = { gap: 0 };
  function drawMembrane(t) {
    let n = 0, k = 0;
    for (let i = 0; i < NL; i++) {
      let x = -W / 2 + 0.07 + (i / (NL - 1)) * (W - 0.14);
      const near = Math.abs(x - PORE_X);
      if (near < 0.5) { heads.hide(n++); heads.hide(n++); for (let j = 0; j < 4; j++) tails.setMatrixAt(k++, _m.makeScale(1e-3, 1e-3, 1e-3).setPosition(0, -40, 0)); continue; }
      for (const side of [1, -1]) {
        const y = MEM_Y + side * (MEM_T / 2) + Math.sin(t * 1.3 + i * 0.7 + side) * 0.012;
        heads.set(n++, L(x, y, 0.3), 1, side > 0 ? 0xcfe2ff : 0xb8d0ff);
        for (const dx of [-0.025, 0.025]) {
          _q.setFromAxisAngle(V(0, 0, 1), Math.sin(t * 2 + i + dx * 40) * 0.12);
          _m.compose(L(x + dx, y - side * 0.14, 0.3), _q.premultiply(plate.quaternion), _s); tails.setMatrixAt(k++, _m);
        }
      }
    }
    heads.commit(); tails.instanceMatrix.needsUpdate = true;
  }
  tails.count = NL * 4; for (let i = 0; i < NL * 4; i++) tails.setColorAt(i, new THREE.Color(0x8fb4ff));

  // ---------- Sec61 translocon (two lobes that part) + SRP receptor ----------
  const secMat = kit.gloss(0x2fd6c8, { ei: 0.8, rough: 0.22 });
  const lobes = [-1, 1].map((sd) => {
    const g = new THREE.Group();
    const a = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.42, 6, 16), secMat); g.add(a);
    const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.32, 6, 12), secMat); b.position.set(sd * 0.16, 0.05, -0.1); g.add(b);
    g.rotation.y = yaw; kit.add(g); g.userData.sd = sd; return g;
  });
  const poreGlow = kit.sprite(0x7ffff0, 1.0, 0.0); kit.add(poreGlow);
  const plug = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), kit.glow(0x7ffff0, 3.5)); kit.add(plug);
  const recep = new THREE.Group(); recep.rotation.y = yaw; kit.add(recep);
  { const m = kit.gloss(0xff9a3a, { ei: 0.9 }); const a = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.3, 6, 12), m); a.position.y = 0.05; recep.add(a); const b = new THREE.Mesh(new THREE.SphereGeometry(0.16, 18, 12), m); b.position.set(0.05, 0.32, 0); recep.add(b); }
  recep.position.copy(L(PORE_X - 0.75, MEM_Y + 0.2, 0.32));
  function drawSec61(t) {
    lobes.forEach((g) => g.position.copy(L(PORE_X + g.userData.sd * (0.2 + memState.gap * 0.12), MEM_Y, 0.32)));
    plug.position.copy(L(PORE_X, MEM_Y - memState.gap * 0.55, 0.36)); plug.scale.setScalar(1 - memState.gap * 0.6);
    poreGlow.position.copy(L(PORE_X, MEM_Y, 0.45)); poreGlow.material.opacity = memState.gap * (0.6 + 0.2 * Math.sin(t * 6));
  }

  // ---------- ribosome + mRNA ----------
  const R = makeRibosome(kit, { scale: 1.0 });
  const ribo = R.group; kit.add(ribo);
  const mrnaCurve = new THREE.CatmullRomCurve3([V(-1.7, -0.02, 0.15), V(-0.8, 0.04, 0.12), V(0, 0, 0.1), V(0.8, -0.04, 0.12), V(1.7, 0.03, 0.15)]);
  const mrna = new THREE.Mesh(new THREE.TubeGeometry(mrnaCurve, 40, 0.035, 8), kit.glow(0xffd27a, 3.4)); ribo.add(mrna);
  const RS = { x: -2.3, y: 1.3, rot: -2.79, s: 1 }; // ribosome pose in plate-local (shallow tilt keeps the mRNA inside the frame)
  const RDOCK = { x: PORE_X - 0.15, y: MEM_Y + MEM_T / 2 + 1.0, rot: -Math.PI };
  const pauseIcon = kit.text('❚❚ PAUSED', { h: 0.26, fg: '#ffffff', bg: 'rgba(160,110,255,0.9)', font: '800 64px Montserrat, sans-serif', pad: 22 });
  pauseIcon.visible = false; pauseIcon.rotation.y = yaw; kit.add(pauseIcon);
  function riboTunnelLocal() { // tunnel exit in plate-local coords
    const c = Math.cos(RS.rot), s = Math.sin(RS.rot), tx = R.tunnelTop.x, ty = R.tunnelTop.y;
    return { x: RS.x + tx * c - ty * s, y: RS.y + tx * s + ty * c, dx: -s, dy: c };
  }
  function drawRibo(t) {
    ribo.position.copy(L(RS.x, RS.y, 0.2));
    ribo.quaternion.copy(plate.quaternion).multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), RS.rot));
    ribo.scale.setScalar(RS.s);
    pauseIcon.position.copy(L(RS.x, RS.y + 1.05, 0.6));
  }

  // ---------- SRP (signal recognition particle): kinked rod ----------
  const srp = new THREE.Group(); srp.rotation.y = yaw; kit.add(srp);
  {
    const m = kit.gloss(0xa77bff, { ei: 1.1, rough: 0.2 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.9, 6, 12), m); body.rotation.z = Math.PI / 2 - 0.25; srp.add(body);
    const alu = new THREE.Mesh(new THREE.SphereGeometry(0.17, 18, 12), m); alu.position.set(-0.55, 0.14, 0); srp.add(alu);
    const sdom = new THREE.Mesh(new THREE.SphereGeometry(0.2, 18, 12), m); sdom.position.set(0.5, -0.12, 0); srp.add(sdom);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.08, 14, 10), kit.glow(0xe0c8ff, 4.5)); tip.position.set(0.62, -0.24, 0.05); srp.add(tip);
    const halo = kit.sprite(0xb48cff, 1.6, 0.35); srp.add(halo);
  }
  const SRPS = { x: 3.4, y: 2.0, rot: 0, on: false };
  srp.visible = false;
  function drawSRP(t) { srp.position.copy(L(SRPS.x, SRPS.y + (SRPS.on ? 0 : Math.sin(t * 1.8) * 0.06), 0.45)); srp.rotation.z = SRPS.rot; }

  // ---------- nascent chain ----------
  const chainB = kit.beads(NCH + 14, 0.075, { intensity: 3.4 });
  const pos = []; for (let i = 0; i < NCH; i++) pos.push({ p: new THREE.Vector3(), tgt: new THREE.Vector3(), placed: false });
  const CH = { E: 0, route: 'free', sigCut: 0, fold: 0 };
  const colorOf = (i) => (i < SIG ? C_SIG : i === ASN ? C_ASN : [11, 12, 21, 22, 27].includes(i) ? C_HYD : C_PRO);
  const foldPts = []; { const n = NCH - SIG, ga = Math.PI * (3 - Math.sqrt(5)); for (let k = 0; k < n; k++) { const y = 1 - (k / (n - 1)) * 2, r = Math.sqrt(1 - y * y); foldPts.push(V(Math.cos(k * ga) * r * 0.42, y * 0.36, Math.sin(k * ga) * r * 0.3)); } }
  const FOLD_C = V(PORE_X + 1.75, -1.35, 0.35);
  function routePoint(s, t) {
    const tl = riboTunnelLocal();
    if (CH.route === 'free') { // out of the tunnel into the cytosol, gently wiggling
      const px = tl.x + tl.dx * s + Math.sin(s * 3 + t * 1.4) * 0.1 * Math.min(1, s), py = tl.y + tl.dy * s + Math.cos(s * 2.3) * 0.05 * s;
      return V(px, py, 0.35);
    }
    // docked: straight down through Sec61, then meandering through the lumen
    const top = V(tl.x, tl.y, 0.35), drop = top.y - (MEM_Y - MEM_T / 2 - 0.3);
    if (s <= drop) return V(PORE_X + (tl.x - PORE_X) * (1 - s / drop), top.y - s, 0.35);
    const u = s - drop;
    return V(PORE_X + u * 0.62, MEM_Y - MEM_T / 2 - 0.3 - Math.sin(u * 2.2) * 0.32 - u * 0.12, 0.35 + Math.sin(u * 1.7) * 0.08);
  }
  const glycan = []; // 14 sugars: 2 GlcNAc, 9 Man, 3 Glc
  const GLY = [[0, 0.16, 0x4a8bff], [0, 0.32, 0x4a8bff], [0, 0.48, 0x5cff7a], [-0.13, 0.6, 0x5cff7a], [0.13, 0.6, 0x5cff7a], [-0.22, 0.74, 0x5cff7a], [-0.06, 0.76, 0x5cff7a], [0.13, 0.76, 0x5cff7a], [0.26, 0.74, 0x5cff7a], [-0.24, 0.9, 0x5cff7a], [0.14, 0.92, 0x5cff7a], [-0.25, 1.05, 0xe0ecff], [-0.25, 1.2, 0xe0ecff], [-0.25, 1.35, 0xe0ecff]];
  const glyS = { n: 0 };
  function drawChain(t, dt) {
    const k = 1 - Math.exp(-dt * 7);
    for (let i = 0; i < NCH; i++) {
      const b = pos[i];
      const s = (CH.E - 1 - i) * SP;
      if (s < 0) { chainB.hide(i); b.placed = false; continue; }
      if (i < SIG && CH.sigCut > 0) {
        // cleaved signal peptide slides into the membrane and fades
        b.tgt.set(PORE_X - 0.42 - (SIG - i) * 0.07, MEM_Y + (i % 2) * 0.05, 0.38);
      } else if (CH.fold > 0 && i >= SIG) {
        const f = foldPts[i - SIG];
        const free = routePoint(s - (CH.sigCut ? 0 : 0), t);
        b.tgt.copy(free).lerp(V(FOLD_C.x + f.x, FOLD_C.y + f.y, FOLD_C.z + f.z), CH.fold);
      } else b.tgt.copy(routePoint(s, t));
      if (!b.placed) { b.p.copy(b.tgt); b.placed = true; } else b.p.lerp(b.tgt, k);
      const fade = i < SIG ? 1 - CH.sigCut * CH.sigFade : 1;
      chainB.set(i, L(b.p.x, b.p.y, b.p.z), fade, colorOf(i));
      if (i === 0) chainB.set(i, L(b.p.x, b.p.y, b.p.z), fade * 1.25, colorOf(i));
    }
    // glycan tree on Asn (follows the residue, points "down" into the lumen)
    for (let g = 0; g < 14; g++) {
      if (g >= glyS.n || CH.E <= ASN) { chainB.hide(NCH + g); continue; }
      const a = pos[ASN].p, [gx, gy, c] = GLY[g];
      chainB.set(NCH + g, L(a.x + gy * 0.62, a.y + gx * 0.62 - 0.05, a.z + 0.06), 0.62, c);
    }
    chainB.commit();
  }
  CH.sigFade = 0;

  // ---------- BiP chaperones (Hsp70) waiting in the lumen ----------
  const bipMat = kit.gloss(0xffb43a, { ei: 1.0, rough: 0.22 });
  const bips = [0, 1].map((k) => {
    const g = new THREE.Group(); g.rotation.y = yaw;
    const a = new THREE.Mesh(new THREE.SphereGeometry(0.24, 22, 16), bipMat); a.scale.set(1.15, 0.8, 0.8); g.add(a);
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.15, 18, 12), bipMat); b.position.set(0.24, 0.12, 0); g.add(b);
    const glow = kit.sprite(0xffc04a, 0.9, 0.3); g.add(glow);
    g.userData.home = V(k ? 3.6 : -1.2, -1.95 + k * 0.2, 0.4); g.userData.p = g.userData.home.clone();
    g.visible = false; kit.add(g); return g;
  });
  function drawBiP(t) { bips.forEach((g, k) => { g.position.copy(L(g.userData.p.x, g.userData.p.y + Math.sin(t * 2 + k) * 0.04, g.userData.p.z)); g.rotation.z = Math.sin(t + k) * 0.2; }); }

  // ---------- per-frame ----------
  const update = (dt, t) => {
    drawMembrane(t); drawSec61(t); drawRibo(t); drawSRP(t); drawChain(t, dt); drawBiP(t);
    srcGlow.material.opacity = 0.55 + 0.3 * Math.sin(t * 4);
    for (const m of markers) m.update(t);
  };
  const markers = [];
  function marker(getPos, color = 0xffffff) { // pulsing ring that tells the player what to click
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.025, 8, 40), kit.additive(color, 0.9, 3));
    ring.rotation.y = yaw; kit.add(ring);
    const m = { ring, update: (t) => { ring.position.copy(getPos()); const s = 1 + 0.18 * Math.sin(t * 6); ring.scale.setScalar(s); } };
    markers.push(m);
    return () => { markers.splice(markers.indexOf(m), 1); ring.visible = false; }; // hide (not detach) so kit.end() disposes it
  }

  // ---------- flow ----------
  let step = 'start';
  const STEPS = 6; const prog = (k, label) => api.progress(k / STEPS, `Step ${Math.min(k + 1, STEPS)} / ${STEPS} · ${label}`);
  api.goal('<b>Start translation.</b> A free ribosome is reading an mRNA for a protein that must be secreted. Click the ribosome to begin.', true);
  prog(0, 'free ribosome');
  kit.label('ribo', 'Ribosome (free in the cytosol)', '80S', () => L(RS.x + 1.25, RS.y + 0.55, 0.4)); // beside it, inside the frame
  kit.label('sec', 'Sec61 translocon', 'Sec61', () => L(PORE_X + 0.2, MEM_Y - 0.55, 0.4));
  const g1 = async () => {
    if (step !== 'start') return; step = 'busy'; api.buttons([]); un1(); kit.unpick(h1);
    ctx.sfx('button_press');
    let last = 0;
    await kit.to(CH, { E: SIG + 1, duration: 2.6, ease: 'none', onUpdate: () => { const e = Math.floor(CH.E); if (e !== last) { last = e; ctx.sfx('typewriter_tick', { volume: 0.4, pitch: 0.9 + e * 0.04 }); } } });
    kit.label('sig', 'Signal sequence (hydrophobic)', 'SIGNAL', () => L(pos[0].p.x, pos[0].p.y + 0.25, 0.4));
    ctx.sfx('discovery_chime');
    // SRP drifts in
    srp.visible = true; srp.scale.setScalar(0.001); kit.tween(srp.scale, { x: 1, y: 1, z: 1, duration: 0.6, ease: 'back.out(2)' });
    kit.label('srp', 'SRP (signal recognition particle)', 'SRP', () => L(SRPS.x, SRPS.y + 0.45, 0.5));
    api.goal('<b>A signal sequence!</b> Its hydrophobic stretch is a ticket to the ER. Click the <b>SRP</b> so it can catch the signal.');
    prog(1, 'signal emerged');
    step = 'srp';
    const un = marker(() => L(SRPS.x, SRPS.y, 0.5), 0xb48cff);
    const h = kit.pick(srp, () => g2(un, h));
    api.buttons([{ label: 'SRP: catch the signal', solid: true, onClick: () => g2(un, h) }]);
  };
  const un1 = marker(() => L(RS.x, RS.y + 0.35, 0.5), 0xff9ad8);
  const h1 = kit.pick(ribo, g1);
  api.buttons([{ label: 'Start translation', solid: true, onClick: g1 }]);

  async function g2(un, h) {
    if (step !== 'srp') return; step = 'busy'; api.buttons([]); un(); kit.unpick(h);
    ctx.sfx('whoosh', { volume: 0.5 });
    SRPS.on = true;
    const tip = pos[0].p;
    kit.tween(SRPS, { rot: -0.5, duration: 0.9 });
    await kit.to(SRPS, { x: tip.x - 0.35, y: tip.y + 0.2, duration: 0.9, ease: 'power3.inOut' });
    kit.ring(L(tip.x, tip.y, 0.5), 0xb48cff, { r: 0.15, to: 1.0 });
    ctx.sfx('valve_turn', { volume: 0.5 }); ctx.sfx('atp_pop', { pitch: 0.8 });
    pauseIcon.visible = true; pauseIcon.scale.setScalar(0.001); kit.tween(pauseIcon.scale, { x: 1, y: 1, z: 1, duration: 0.4, ease: 'back.out(2)' });
    kit.label('srp', 'SRP binds the signal · translation pauses', 'SRP', () => L(SRPS.x, SRPS.y + 0.45, 0.5));
    api.goal('<b>Translation paused.</b> SRP holds the signal and slows the ribosome. Now click the <b>SRP receptor</b> on the ER membrane to dock.');
    prog(2, 'SRP bound');
    kit.label('rec', 'SRP receptor', 'SR', () => recep.position.clone().add(V(0, 0.5, 0)));
    step = 'dock';
    const un2 = marker(() => recep.position.clone().add(V(0, 0.15, 0.1)), 0xff9a3a);
    const h2 = kit.pick(recep, () => g3(un2, h2));
    api.buttons([{ label: 'Dock at the ER', solid: true, onClick: () => g3(un2, h2) }]);
  }

  async function g3(un, h) {
    if (step !== 'dock') return; step = 'busy'; api.buttons([]); un(); kit.unpick(h);
    ctx.sfx('whoosh', { volume: 0.6 });
    kit.unlabel('ribo'); kit.unlabel('sig');
    // ribosome + SRP glide to the membrane; the ribosome turns its exit tunnel toward Sec61
    const from = { ...RS }, srpOff = { x: SRPS.x - RS.x, y: SRPS.y - RS.y };
    const o = { a: 0 };
    await kit.to(o, {
      a: 1, duration: 2.2, ease: 'power2.inOut',
      onUpdate: () => {
        RS.x = from.x + (RDOCK.x - from.x) * o.a; RS.y = from.y + (RDOCK.y - from.y) * o.a + Math.sin(o.a * Math.PI) * 0.5; RS.rot = from.rot + (RDOCK.rot - from.rot) * o.a;
        const recT = { x: PORE_X - 0.75, y: MEM_Y + 0.62 };
        SRPS.x = (from.x + srpOff.x) * (1 - o.a) + recT.x * o.a; SRPS.y = (from.y + srpOff.y) * (1 - o.a) + recT.y * o.a; SRPS.rot = -0.5 + o.a * 1.2;
      },
    });
    CH.route = 'dock';
    kit.ring(L(PORE_X, MEM_Y + 0.3, 0.5), 0x7ffff0, { r: 0.2, to: 1.3 });
    ctx.sfx('parcel_thunk', { volume: 0.7 });
    kit.label('ribo', 'Ribosome docked on the ER', '80S', () => L(RS.x - 0.9, RS.y + 0.6, 0.4));
    kit.label('srp', 'SRP meets its receptor', 'SRP', () => L(SRPS.x - 0.2, SRPS.y + 0.4, 0.5));
    api.goal('<b>Docked!</b> The ribosome sits on the Sec61 channel. Click <b>Sec61</b> to release SRP and let the chain thread into the ER lumen.');
    prog(3, 'docked at Sec61');
    step = 'thread';
    const un3 = marker(() => L(PORE_X, MEM_Y, 0.5), 0x7ffff0);
    const h3 = kit.pick(lobes[0], () => g4(un3, [h3, h3b])); const h3b = kit.pick(lobes[1], () => g4(un3, [h3, h3b]));
    api.buttons([{ label: 'Thread through Sec61', solid: true, onClick: () => g4(un3, [h3, h3b]) }]);
  }

  async function g4(un, hs) {
    if (step !== 'thread') return; step = 'busy'; api.buttons([]); un(); hs.forEach((h) => kit.unpick(h));
    // SRP lets go (GTP hydrolysis) and drifts off; translation resumes
    const gtp = kit.text('GTP → GDP', { h: 0.28, fg: '#ffffff', bg: 'rgba(120,80,220,0.85)', font: '800 60px Montserrat, sans-serif', pad: 16 });
    gtp.position.copy(L(SRPS.x, SRPS.y + 0.4, 0.6)); gtp.rotation.y = yaw; kit.add(gtp);
    kit.tween(gtp.position, { y: gtp.position.y + 0.6, duration: 1.6 }); kit.tween(gtp.material, { opacity: 0, duration: 1.6, delay: 0.4 });
    ctx.sfx('atp_pop');
    kit.tween(SRPS, { x: 3.6, y: 2.0, rot: 0.3, duration: 1.8, ease: 'power2.in' });
    kit.tween(srp.scale, { x: 0.001, y: 0.001, z: 0.001, duration: 0.5, delay: 1.4 });
    kit.unlabel('srp'); kit.unlabel('rec');
    kit.tween(pauseIcon.scale, { x: 0.001, y: 0.001, z: 0.001, duration: 0.3 });
    await kit.to(memState, { gap: 1, duration: 0.6, ease: 'back.out(2)' });
    ctx.sfx('valve_turn');
    kit.label('sec', 'Sec61 opens · co-translational translocation', 'Sec61', () => L(PORE_X - 0.3, MEM_Y - 0.6, 0.45));
    let last = 0;
    await kit.to(CH, { E: NCH, duration: 4.5, ease: 'none', onUpdate: () => { const e = Math.floor(CH.E); if (e !== last) { last = e; ctx.sfx('typewriter_tick', { volume: 0.35, pitch: 0.8 + (e % 7) * 0.06 }); } } });
    kit.label('lum', 'Chain enters the ER lumen', 'Lumen', () => L(pos[SIG].p.x, pos[SIG].p.y - 0.3, 0.4));
    api.goal('<b>Inside the lumen!</b> Now trim and tag it: click the chain to let <b>signal peptidase</b> snip the signal off and <b>OST</b> attach a sugar tree to an asparagine.');
    prog(4, 'in the lumen');
    step = 'trim';
    const un4 = marker(() => L(pos[ASN].p.x, pos[ASN].p.y, 0.5), C_ASN);
    const hit = new THREE.Mesh(new THREE.SphereGeometry(1.0, 12, 8), kit.own(new THREE.MeshBasicMaterial({ visible: false }))); hit.position.copy(L(PORE_X + 0.9, -1.4, 0.4)); kit.add(hit);
    const h4 = kit.pick(hit, () => g5(un4, h4));
    api.buttons([{ label: 'Snip & glycosylate', solid: true, onClick: () => g5(un4, h4) }]);
  }

  async function g5(un, h) {
    if (step !== 'trim') return; step = 'busy'; api.buttons([]); un(); kit.unpick(h);
    kit.unlabel('lum');
    // snip
    const cut = pos[SIG].p.clone();
    kit.burst(L(cut.x, cut.y, 0.45), 0xffe14a, { count: 30, speed: 1.6, size: 0.16 });
    kit.ring(L(cut.x, cut.y, 0.45), 0xffffff, { r: 0.1, to: 0.8, life: 0.5 });
    ctx.sfx('zap', { volume: 0.55, pitch: 1.3 });
    CH.sigCut = 1;
    kit.label('spase', 'Signal peptidase cuts off the signal', 'SPase', () => L(PORE_X - 0.8, MEM_Y + 0.55, 0.45));
    kit.tween(CH, { sigFade: 1, duration: 2.5, delay: 0.6 });
    await kit.wait(0.9);
    // glycosylation: OST transfers a 14-sugar tree onto Asn (in an Asn-X-Ser/Thr motif)
    kit.label('gly', 'N-linked glycan (14 sugars) on Asn', 'Glyco', () => L(pos[ASN].p.x + 0.7, pos[ASN].p.y + 0.35, 0.45));
    for (let g = 0; g < 14; g++) { glyS.n = g + 1; ctx.sfx('bubble', { volume: 0.3, pitch: 0.9 + g * 0.04 }); await kit.wait(0.08); }
    kit.burst(L(pos[ASN].p.x, pos[ASN].p.y - 0.5, 0.45), C_ASN, { count: 24, speed: 1.2, size: 0.15 });
    kit.unlabel('spase');
    api.goal('<b>Trimmed and tagged.</b> The new chain is still floppy. Click the <b>BiP</b> chaperones to help it fold correctly.');
    prog(5, 'glycosylated');
    bips.forEach((g, k) => { g.visible = true; g.scale.setScalar(0.001); kit.tween(g.scale, { x: 1, y: 1, z: 1, duration: 0.5, delay: k * 0.15, ease: 'back.out(2)' }); });
    kit.label('bip', 'BiP chaperones (Hsp70)', 'BiP', () => bips[1].position.clone().add(V(0, 0.4, 0)));
    step = 'fold';
    const unB = marker(() => bips[1].position.clone(), 0xffc04a);
    const hb = bips.map((g) => kit.pick(g, () => g6(unB, hb)));
    api.buttons([{ label: 'Fold with BiP', solid: true, onClick: () => g6(unB, hb) }]);
  }

  async function g6(un, hs) {
    if (step !== 'fold') return; step = 'busy'; api.buttons([]); un(); hs.forEach((h) => kit.unpick(h));
    // BiP grips exposed hydrophobic stretches (orange), spending ATP to bind and release
    const grip = [pos[12].p, pos[22].p];
    for (let k = 0; k < 2; k++) kit.tween(bips[k].userData.p, { x: grip[k].x + 0.2, y: grip[k].y - 0.22, z: 0.5, duration: 0.8, ease: 'power2.inOut' });
    ctx.sfx('whoosh', { volume: 0.4 });
    await kit.wait(0.85);
    for (let k = 0; k < 3; k++) {
      const atp = kit.text('ATP', { h: 0.28, fg: '#1a1200', bg: '#ffd24a', font: '900 60px Montserrat, sans-serif', pad: 14 });
      const b = bips[k % 2]; atp.position.copy(b.position).add(V(0, 0.3, 0.1)); atp.rotation.y = yaw; kit.add(atp);
      kit.tween(atp.position, { y: atp.position.y + 0.5, duration: 0.9 }); kit.tween(atp.material, { opacity: 0, duration: 0.9 });
      ctx.sfx('atp_pop', { pitch: 1 + k * 0.1 });
      await kit.wait(0.35);
    }
    kit.label('bip', 'BiP uses ATP to bind and release', 'BiP', () => bips[0].position.clone().add(V(0, 0.4, 0)));
    // fold up
    ctx.sfx('valve_turn', { volume: 0.4 });
    await kit.to(CH, { fold: 1, duration: 2.0, ease: 'power2.inOut', onUpdate: () => { for (let k = 0; k < 2; k++) bips[k].userData.p.lerp(V(FOLD_C.x + (k ? 0.75 : -0.75), FOLD_C.y + 0.1, 0.5), 0.05); } });
    kit.burst(L(FOLD_C.x, FOLD_C.y, FOLD_C.z + 0.2), 0x4affd2, { count: 50, speed: 2.0, size: 0.2 });
    kit.ring(L(FOLD_C.x, FOLD_C.y, FOLD_C.z + 0.2), 0x4affd2, { r: 0.3, to: 1.8 });
    for (let k = 0; k < 2; k++) kit.tween(bips[k].userData.p, { ...bips[k].userData.home, duration: 1.4, ease: 'power2.inOut' });
    kit.unlabel('bip'); kit.unlabel('sec');
    kit.label('fold', 'Folded, glycosylated protein → off to the Golgi', '✓', () => L(FOLD_C.x, FOLD_C.y + 0.75, 0.5));
    api.finish('<b>Protein made and folded!</b> Its signal sequence brought the ribosome to the ER via <b>SRP</b>; the chain threaded through <b>Sec61</b> into the lumen, was trimmed by signal peptidase, given an N-linked glycan, and folded with help from <b>BiP</b>. Next stop: a vesicle to the Golgi.');
  }

  return update;
}
