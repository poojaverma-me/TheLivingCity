// Activity · Cell Membrane — "Gatekeeper".
// A magnified section of the plasma membrane at the front-right port. Molecules arrive one at a time; the player
// routes each one: O₂ / CO₂ straight through the bilayer, water through aquaporin, glucose through its GLUT carrier,
// Na⁺/K⁺ through the ATP-powered pump (3 Na⁺ out, 2 K⁺ in per ATP). Wrong routes bounce off gently with a reason.
// Takeaway: O₂ diffuses straight through; glucose needs a carrier but still moves down its gradient; the Na⁺/K⁺ pump
// spends ATP to move ions against theirs.
import * as THREE from 'three';
import { runActivity } from './_shared.js';
import { GATES } from '../../world/layout.js';
import { membranePoint } from '../../world/membrane.js';

const MY = -0.15, HT = 0.34; // bilayer centre (plate-local y) and half-thickness to the head groups
const ROUTES = {
  bilayer: { x: 3.35, label: 'Through the bilayer' },
  aqp: { x: -2.75, label: 'Aquaporin' },
  glut: { x: -0.85, label: 'GLUT transporter' },
  pump: { x: 1.25, label: 'Na⁺/K⁺ pump' },
};
const QUEUE = [
  { id: 'o2', name: 'O₂', from: 'out', route: 'bilayer', note: 'Small and nonpolar, O₂ dissolves right through the oily core of the bilayer, down its concentration gradient.',
    wrong: { aqp: 'Aquaporins are water channels. O₂ is small and nonpolar, so it needs no channel at all.', glut: 'GLUT carries glucose. O₂ is small and nonpolar: it can slip between the lipids.', pump: 'The pump moves only Na⁺ and K⁺, and O₂ needs no energy: it simply diffuses in.' } },
  { id: 'glc', name: 'Glucose', from: 'out', route: 'glut', note: 'GLUT changes shape to carry glucose across. No ATP: glucose still flows down its gradient (facilitated diffusion).',
    wrong: { bilayer: 'Glucose is large and polar: the hydrophobic core of the bilayer blocks it. It needs a carrier protein.', aqp: 'Too big for the narrow water pore of an aquaporin. Try its own carrier.', pump: 'No ATP needed here: glucose moves down its gradient, just through a carrier.' } },
  { id: 'h2o', name: 'H₂O', from: 'out', route: 'aqp', note: 'Aquaporins pass water in single file, billions of molecules per second, while blocking ions and protons.',
    wrong: { bilayer: 'A little water does seep through the bilayer, but slowly. Aquaporins are the fast lane for water.', glut: 'GLUT is specific for glucose. Water has its own channel.', pump: 'The pump moves ions, not water. Water follows osmosis through its own channels.' } },
  { id: 'co2', name: 'CO₂', from: 'in', route: 'bilayer', note: 'CO₂ made by your mitochondria is small and nonpolar too: it diffuses straight out through the bilayer.',
    wrong: { aqp: 'Aquaporins are for water. CO₂ is small and nonpolar: no channel needed.', glut: 'GLUT carries glucose. CO₂ can slip between the lipids.', pump: 'CO₂ needs no pump: it simply diffuses out, down its gradient.' } },
  { id: 'nak', name: '3 Na⁺ + 2 K⁺', from: 'both', route: 'pump', note: 'One ATP powers one pump cycle: 3 Na⁺ out, 2 K⁺ in, both against their gradients.',
    wrong: { bilayer: 'Ions are charged: the hydrophobic core of the bilayer repels them.', aqp: 'Aquaporins block ions, even tiny protons.', glut: 'GLUT carries glucose, not ions. And these ions must go against their gradients: that takes energy.' } },
];

export function start(ctx) { return runActivity(ctx, (kit, api) => build(ctx, kit, api)); }

function build(ctx, kit, api) {
  api.buttons([]); // clear the previous run's Play again / Finish buttons on replay
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  // ---------- staging just inside the front-right port ----------
  const g = GATES.find((q) => q.id === 'portFR');
  const mp = membranePoint(g.angle, 0);
  const n = V(mp.nx, 0, mp.nz);
  const yaw = Math.atan2(-n.x, -n.z);
  const C = V(mp.x - n.x * 3.4, 3.7, mp.z - n.z * 3.4);
  const plate = kit.holoPlate({ w: 9.2, h: 5.1, color: 0xffd27a, pos: C, yaw, title: 'MAGNIFIED · PLASMA MEMBRANE' });
  plate.updateMatrixWorld(true);
  const L = (x, y, z = 0.3) => plate.localToWorld(new THREE.Vector3(x, y, z));
  const wallPt = V(mp.x - n.x * 0.4, 2.2, mp.z - n.z * 0.4);
  kit.beam(wallPt, L(0, -1.0, 0), 0xffd27a, 0.05, 0.4, 0.06);
  kit.light(0xffe0a8, 9, 10, L(0, 0, 1.8));
  kit.fly(L(-1.25, -0.15, 0), { yaw: yaw / (Math.PI / 180), pitch: 9, dist: 11.4, fov: 40 }, 1.8);
  const yawQ = new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), yaw);
  const face = (o) => { o.quaternion.copy(yawQ); return o; };

  // tinted halves: outside (top) and cytosol (bottom)
  const outPane = face(new THREE.Mesh(new THREE.PlaneGeometry(8.9, 2.0), kit.additive(0x6ad0ff, 0.1, 1))); outPane.position.copy(L(0, 1.4, 0.05)); kit.add(outPane);
  const inPane = face(new THREE.Mesh(new THREE.PlaneGeometry(8.9, 1.9), kit.additive(0xffb36a, 0.08, 1))); inPane.position.copy(L(0, -1.55, 0.05)); kit.add(inPane);
  const tag = (txt, x, y, col) => { const t = face(kit.text(txt, { h: 0.27, fg: col, font: '800 64px Montserrat, sans-serif' })); t.position.copy(L(x, y, 0.1)); kit.add(t); };
  tag('OUTSIDE THE CELL', -3.2, 2.05, '#9fe6ff'); tag('CYTOSOL (INSIDE)', -3.25, -2.25, '#ffd2a0');

  // ---------- bilayer (heads + tails), with gaps where proteins sit ----------
  const NL = 72, W = 8.8;
  const heads = kit.beads(NL * 2, 0.08, { intensity: 1.5 });
  const tails = kit.instGlow(new THREE.CylinderGeometry(0.014, 0.014, 0.2, 5), NL * 4, { intensity: 0.8 }); kit.add(tails);
  for (let i = 0; i < NL * 4; i++) tails.setColorAt(i, new THREE.Color(0xffe2a8));
  const gaps = [ROUTES.aqp.x, ROUTES.glut.x, ROUTES.pump.x];
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), one = V(1, 1, 1);
  function drawBilayer(t) {
    let a = 0, b = 0;
    for (let i = 0; i < NL; i++) {
      const x = -W / 2 + 0.06 + (i / (NL - 1)) * (W - 0.12);
      const hide = gaps.some((gx, k) => Math.abs(x - gx) < (k === 2 ? 0.62 : 0.42));
      for (const sd of [1, -1]) {
        if (hide) { heads.hide(a++); tails.setMatrixAt(b++, _m.makeScale(1e-3, 1e-3, 1e-3).setPosition(0, -40, 0)); tails.setMatrixAt(b++, _m.makeScale(1e-3, 1e-3, 1e-3).setPosition(0, -40, 0)); continue; }
        const y = MY + sd * HT + Math.sin(t * 1.4 + i * 0.8 + sd) * 0.012;
        heads.set(a++, L(x, y, 0.3), 1, sd > 0 ? 0xffe9c0 : 0xffd9a0);
        for (const dx of [-0.026, 0.026]) {
          _q.setFromAxisAngle(V(0, 0, 1), Math.sin(t * 2.2 + i + dx * 50) * 0.14).premultiply(yawQ);
          tails.setMatrixAt(b++, _m.compose(L(x + dx, y - sd * 0.17, 0.3), _q, one));
        }
      }
    }
    heads.commit(); tails.instanceMatrix.needsUpdate = true;
  }

  // ---------- transport proteins ----------
  const prot = {};
  { // aquaporin: four helix bundles around a narrow glowing pore
    const grp = face(new THREE.Group()); const m = kit.gloss(0x3fa8ff, { ei: 0.8, rough: 0.2 });
    for (const [x, z, r] of [[-0.26, 0, 0.17], [0.26, 0, 0.17], [-0.12, -0.2, 0.13], [0.12, -0.2, 0.13]]) { const c = new THREE.Mesh(new THREE.CapsuleGeometry(r, 0.6, 6, 14), m); c.position.set(x, 0, z); grp.add(c); }
    const pore = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.0, 10), kit.glow(0x8ff0ff, 3.5)); grp.add(pore);
    grp.position.copy(L(ROUTES.aqp.x, MY, 0.3)); kit.add(grp); prot.aqp = grp;
  }
  { // GLUT: two lobes that rock between outward- and inward-open
    const grp = face(new THREE.Group()); const m = kit.gloss(0x52e07a, { ei: 0.8, rough: 0.2 });
    const l = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.62, 6, 14), m); const r = l.clone();
    l.position.x = -0.2; r.position.x = 0.2; grp.add(l, r); grp.userData.lobes = [l, r];
    const site = kit.sprite(0x9affb0, 0.7, 0.6); grp.add(site);
    grp.position.copy(L(ROUTES.glut.x, MY, 0.3)); kit.add(grp); prot.glut = grp;
  }
  { // Na⁺/K⁺-ATPase: big α subunit + small glycosylated β subunit on the outside, ATP site on the inside
    const grp = face(new THREE.Group()); const m = kit.gloss(0xffb52e, { ei: 0.8, rough: 0.22 });
    const a = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.55, 8, 18), m); a.scale.set(1.15, 1, 0.8); grp.add(a);
    const beta = new THREE.Mesh(new THREE.SphereGeometry(0.22, 18, 12), kit.gloss(0xffd98a, { ei: 0.6 })); beta.position.set(0.45, 0.52, 0); grp.add(beta);
    const cyto = new THREE.Mesh(new THREE.SphereGeometry(0.3, 18, 12), m); cyto.position.set(-0.1, -0.68, 0); grp.add(cyto);
    const atpSite = kit.sprite(0xffe14a, 0.8, 0.5); atpSite.position.set(-0.1, -0.78, 0.25); grp.add(atpSite);
    const channel = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.0, 10), kit.glow(0xffe8a0, 3)); channel.position.z = 0.2; grp.add(channel);
    grp.userData.atpSite = atpSite;
    grp.position.copy(L(ROUTES.pump.x, MY, 0.3)); kit.add(grp); prot.pump = grp;
  }
  // invisible hit volumes for each route
  const hits = {};
  for (const [k, r] of Object.entries(ROUTES)) {
    const hm = face(new THREE.Mesh(new THREE.BoxGeometry(k === 'pump' ? 1.3 : k === 'bilayer' ? 1.6 : 0.9, 1.5, 0.6), kit.own(new THREE.MeshBasicMaterial({ visible: false }))));
    hm.position.copy(L(r.x, MY, 0.35)); kit.add(hm); hits[k] = hm;
  }
  // a soft highlight bar under the "plain bilayer" route so it reads as a target
  const lane = face(new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.95), kit.additive(0xffffff, 0.0, 1.2))); lane.position.copy(L(ROUTES.bilayer.x, MY, 0.28)); kit.add(lane);
  const hl = {}; for (const k of Object.keys(ROUTES)) hl[k] = 0;

  kit.label('bil', 'Phospholipid bilayer (~5 nm)', 'Lipids', () => L(ROUTES.bilayer.x, MY + 0.55, 0.4));
  kit.label('aqp', 'Aquaporin', 'AQP', () => L(ROUTES.aqp.x, MY + 0.75, 0.4));
  kit.label('glut', 'GLUT1 carrier', 'GLUT', () => L(ROUTES.glut.x, MY + 0.75, 0.4));
  kit.label('pump', 'Na⁺/K⁺-ATPase pump', 'ATPase', () => L(ROUTES.pump.x, MY + 0.95, 0.4));

  // ---------- molecule factory ----------
  function molecule(id) {
    const grp = face(new THREE.Group());
    const ball = (r, c, x = 0, y = 0, z = 0, ei = 3.4) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 22, 16), kit.glow(c, ei)); m.position.set(x, y, z); grp.add(m); return m; };
    const stick = (a, b) => { const d = b.clone().sub(a); const m = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, d.length(), 8), kit.glow(0xffffff, 1.6)); m.position.copy(a).lerp(b, 0.5); m.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize()); grp.add(m); };
    if (id === 'o2') { ball(0.15, 0xff4a4a, -0.13); ball(0.15, 0xff4a4a, 0.13); }
    if (id === 'co2') { ball(0.15, 0x8a95a8, 0, 0, 0, 1.4); ball(0.13, 0xff4a4a, -0.25); ball(0.13, 0xff4a4a, 0.25); stick(V(-0.25, 0, 0), V(0.25, 0, 0)); }
    if (id === 'h2o') { ball(0.15, 0xff4a4a); ball(0.09, 0xffffff, -0.15, -0.11); ball(0.09, 0xffffff, 0.15, -0.11); }
    if (id === 'glc') {
      const pts = []; for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2 + Math.PI / 6; pts.push(V(Math.cos(a) * 0.24, Math.sin(a) * 0.24, 0)); }
      pts.forEach((p, k) => { ball(k === 5 ? 0.075 : 0.07, k === 5 ? 0xff4a4a : 0xffd24a, p.x, p.y, p.z); stick(p, pts[(k + 1) % 6]); });
      ball(0.06, 0xff4a4a, 0.38, 0.22); ball(0.06, 0xff4a4a, -0.4, -0.2); ball(0.06, 0xff4a4a, 0.05, -0.42);
    }
    const name = QUEUE.find((q) => q.id === id)?.name || id;
    if (id !== 'nak') { const t = face(kit.text(name, { h: 0.33, fg: '#ffffff', font: '800 72px Montserrat, sans-serif', glow: 12 })); t.position.set(0, 0.46, 0.05); t.quaternion.identity(); grp.add(t); }
    kit.add(grp); return grp;
  }
  function ion(kind) {
    const grp = face(new THREE.Group());
    const c = kind === 'na' ? 0xb07cff : 0x3affc8;
    const b = new THREE.Mesh(new THREE.SphereGeometry(kind === 'na' ? 0.13 : 0.16, 20, 14), kit.glow(c, 3.6)); grp.add(b);
    const t = kit.text(kind === 'na' ? 'Na⁺' : 'K⁺', { h: 0.23, fg: '#ffffff', font: '800 72px Montserrat, sans-serif', glow: 10 }); t.position.set(0, 0.26, 0.05); grp.add(t);
    kit.add(grp); return grp;
  }
  const wpos = (o, x, y, z = 0.45) => o.position.copy(L(x, y, z));

  // ---------- flow ----------
  let idx = -1, cur = null, busy = false, picks = [];
  const tally = { done: 0 };
  const update = (dt, t) => {
    drawBilayer(t);
    const lobes = prot.glut.userData.lobes; const rock = prot.glut.userData.rock || 0;
    lobes[0].rotation.z = 0.18 * rock; lobes[1].rotation.z = -0.18 * rock;
    prot.pump.userData.atpSite.material.opacity = 0.4 + 0.3 * Math.sin(t * 5);
    lane.material.opacity = 0.05 + 0.08 * hl.bilayer + 0.04 * Math.sin(t * 3);
    if (cur?.idle) for (const [k, o] of cur.parts.entries()) o.position.y = o.userData.y0 + Math.sin(t * 2.2 + k) * 0.035;
    // hover glow on routes
    for (const k of Object.keys(ROUTES)) {
      const p = picks.find((q) => q.k === k); hl[k] += (((p?.h.hot ?? 0) > 0.5 ? 1 : 0) - hl[k]) * Math.min(1, dt * 10);
      if (prot[k]) prot[k].scale.setScalar(1 + 0.06 * hl[k]);
    }
  };

  api.goal('<b>You are the gatekeeper.</b> Each molecule needs the right way across the membrane. Click a route (or a button) for the molecule waiting by the membrane.', true);
  const prog = () => api.progress(tally.done / QUEUE.length, `${tally.done} / ${QUEUE.length} molecules across`);
  prog();
  kit.later(1.4, next);

  function next() {
    idx++;
    if (idx >= QUEUE.length) return done();
    const q = QUEUE[idx];
    const parts = [];
    if (q.id === 'nak') {
      for (let k = 0; k < 3; k++) { const o = ion('na'); wpos(o, -0.6 + k * 0.36, -1.45 - (k % 2) * 0.18); parts.push(o); }
      for (let k = 0; k < 2; k++) { const o = ion('k'); wpos(o, -0.4 + k * 0.42, 1.45 + (k % 2) * 0.15); parts.push(o); }
    } else {
      const o = molecule(q.id); wpos(o, 0.2, q.from === 'out' ? 1.45 : -1.5); parts.push(o);
    }
    for (const o of parts) { o.userData.y0 = o.position.y; o.userData.home = o.position.clone(); o.scale.setScalar(0.001); kit.tween(o.scale, { x: 1, y: 1, z: 1, duration: 0.5, ease: 'back.out(2.4)' }); }
    cur = { q, parts, idle: true };
    ctx.sfx('bubble', { pitch: 0.9 });
    kit.label('mol', q.id === 'nak' ? '3 Na⁺ inside · 2 K⁺ outside' : `${q.name} · ${q.from === 'out' ? 'outside → in' : 'inside → out'}`, '?', () => parts[0].position.clone().add(V(0, 0.75, 0)));
    api.goal(`<b>${q.id === 'nak' ? 'Sodium and potassium ions' : q.name}</b> ${q.id === 'nak' ? 'need to cross, both against their gradients: Na⁺ out, K⁺ in.' : `wants to get ${q.from === 'out' ? 'into' : 'out of'} the cell.`} Which way across?`);
    picks.forEach((p) => kit.unpick(p.h));
    picks = Object.keys(ROUTES).map((k) => ({ k, h: kit.pick(hits[k], () => route(k)) }));
    api.buttons(Object.entries(ROUTES).map(([k, r]) => ({ label: r.label, onClick: () => route(k) })));
  }

  async function route(k) {
    if (busy || !cur) return; busy = true;
    const q = cur.q, r = ROUTES[k];
    if (k !== q.route) { // gentle bounce + reason
      cur.idle = false;
      ctx.sfx('error_soft');
      const o = cur.parts[q.id === 'nak' ? 0 : 0];
      const side = o.userData.home.y > MY ? 1 : -1;
      const home = o.userData.home.clone();
      await kit.to(o.position, { ...xyz(L(r.x, MY + side * (HT + 0.35), 0.45)), duration: 0.5, ease: 'power2.in' });
      kit.ring(L(r.x, MY + side * (HT + 0.2), 0.5), 0xff7a7a, { r: 0.15, to: 0.7, life: 0.5 });
      await kit.to(o.position, { ...xyz(home), duration: 0.7, ease: 'back.out(1.5)' });
      cur.idle = true;
      api.goal(`<b>Bounced off!</b> ${q.wrong[k]} <i>Try another route.</i>`);
      busy = false; return;
    }
    cur.idle = false;
    picks.forEach((p) => kit.unpick(p.h)); picks = []; api.buttons([]);
    kit.unlabel('mol');
    ctx.sfx('interact_ping', { pitch: 1.1 });
    if (k === 'pump') await pumpCycle();
    else {
      const o = cur.parts[0], dir = q.from === 'out' ? -1 : 1;
      await kit.to(o.position, { ...xyz(L(r.x, MY - dir * (HT + 0.45), 0.45)), duration: 0.6, ease: 'power2.inOut' });
      if (k === 'glut') { kit.tween(prot.glut.userData, { rock: 1, duration: 0.35, yoyo: true, repeat: 1 }); ctx.sfx('valve_turn', { volume: 0.5 }); }
      if (k === 'aqp') ctx.sfx('bubble', { pitch: 1.3 });
      if (k === 'bilayer') ctx.sfx('whoosh', { volume: 0.35, pitch: 1.4 });
      await kit.to(o.position, { ...xyz(L(r.x, MY + dir * (HT + 0.45), 0.45)), duration: k === 'bilayer' ? 0.9 : 0.8, ease: 'sine.inOut' });
      kit.burst(o.position, 0xffffff, { count: 18, speed: 1.2, size: 0.15 });
      kit.tween(o.position, { ...xyz(L(r.x + 0.9, MY + dir * 1.9, 0.45)), duration: 1.2, ease: 'power1.out' });
      kit.tween(o.scale, { x: 0.001, y: 0.001, z: 0.001, duration: 0.5, delay: 0.8 });
    }
    tally.done++; prog();
    ctx.sfx('discovery_chime');
    api.goal(`<b>${q.name}: correct!</b> ${q.note}`);
    await kit.wait(2.2);
    busy = false;
    next();
  }

  async function pumpCycle() {
    const P = ROUTES.pump.x, na = cur.parts.slice(0, 3), k2 = cur.parts.slice(3);
    // 1. three Na⁺ bind from the cytosol side
    for (const [i, o] of na.entries()) kit.tween(o.position, { ...xyz(L(P - 0.22 + i * 0.22, MY - 0.15, 0.55)), duration: 0.7, delay: i * 0.12, ease: 'power2.inOut' });
    kit.label('step', '3 Na⁺ bind inside', '1', () => L(P, MY - 1.3, 0.5));
    await kit.wait(1.0);
    // 2. ATP is spent: phosphate goes onto the pump, ADP leaves
    const atp = face(kit.text('ATP', { h: 0.29, fg: '#1a1200', bg: '#ffd24a', font: '900 64px Montserrat, sans-serif', pad: 16 }));
    atp.position.copy(L(P - 1.6, -1.9, 0.6)); kit.add(atp);
    await kit.to(atp.position, { ...xyz(L(P - 0.1, MY - 0.85, 0.6)), duration: 0.8, ease: 'power2.inOut' });
    ctx.sfx('atp_pop'); ctx.sfx('zap', { volume: 0.5 });
    kit.burst(L(P - 0.1, MY - 0.85, 0.6), 0xffe14a, { count: 40, speed: 2.0, size: 0.2 });
    kit.ring(L(P - 0.1, MY - 0.85, 0.6), 0xffe14a, { r: 0.2, to: 1.3 });
    const adp = face(kit.text('ADP + Pᵢ', { h: 0.29, fg: '#1a1200', bg: '#ffe9a0', font: '900 60px Montserrat, sans-serif', pad: 16 }));
    adp.position.copy(atp.position); kit.add(adp); atp.visible = false;
    kit.tween(adp.position, { ...xyz(L(P - 1.3, -2.0, 0.6)), duration: 1.4, ease: 'power1.out' }); kit.tween(adp.material, { opacity: 0, duration: 0.6, delay: 1.2 });
    kit.label('step', '1 ATP spent → pump changes shape', '2', () => L(P, MY - 1.3, 0.5));
    kit.tween(prot.pump.rotation, { z: 0.12, duration: 0.4, yoyo: true, repeat: 1 });
    await kit.wait(0.6);
    // 3. Na⁺ released outside
    na.forEach((o, i) => kit.tween(o.position, { ...xyz(L(P - 0.5 + i * 0.4, 1.35 + (i % 2) * 0.2, 0.5)), duration: 0.9, delay: i * 0.08, ease: 'power2.out' }));
    ctx.sfx('whoosh', { volume: 0.5 });
    kit.label('step', '3 Na⁺ out', '3', () => L(P, 2.0, 0.5));
    await kit.wait(1.1);
    // 4. two K⁺ bind outside, phosphate released, K⁺ let in
    k2.forEach((o, i) => kit.tween(o.position, { ...xyz(L(P - 0.15 + i * 0.3, MY + 0.15, 0.55)), duration: 0.7, delay: i * 0.1, ease: 'power2.inOut' }));
    kit.label('step', '2 K⁺ bind outside', '4', () => L(P, 2.0, 0.5));
    await kit.wait(0.9);
    kit.tween(prot.pump.rotation, { z: -0.12, duration: 0.4, yoyo: true, repeat: 1 });
    ctx.sfx('valve_turn');
    k2.forEach((o, i) => kit.tween(o.position, { ...xyz(L(P - 0.3 + i * 0.6, -1.5 - (i % 2) * 0.2, 0.5)), duration: 0.9, delay: i * 0.08, ease: 'power2.out' }));
    kit.label('step', '2 K⁺ in · cycle complete', '5', () => L(P, -2.0, 0.5));
    await kit.wait(1.1);
    for (const o of [...na, ...k2]) { kit.burst(o.position, 0xffffff, { count: 8, speed: 0.8, size: 0.12 }); }
    await kit.wait(0.4);
    kit.unlabel('step');
  }

  function done() {
    cur = null;
    kit.burst(L(0, MY, 0.6), 0xffd27a, { count: 70, speed: 3.0, size: 0.24 });
    kit.ring(L(0, MY, 0.6), 0xffd27a, { r: 0.4, to: 4.5, life: 1.2 });
    api.finish('<b>Perfect gatekeeping!</b> O₂ and CO₂ diffuse straight through the bilayer; water uses aquaporins; glucose needs its GLUT carrier but still flows <i>down</i> its gradient; the Na⁺/K⁺ pump spends one ATP to push 3 Na⁺ out and 2 K⁺ in, <i>against</i> their gradients.');
  }

  return update;
}

function xyz(v) { return { x: v.x, y: v.y, z: v.z }; }
