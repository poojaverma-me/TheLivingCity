// Golgi — "Sort the Cargo".
// Parcels (proteins) roll out of the trans-face hatch on the real sorting conveyor. Their sugar chains were
// remodelled on the way through the stack (N-glycans drawn with SNFG symbols). At the TGN scanner arch the
// player reads the clue and tags the parcel: lysosome (mannose-6-phosphate tag → clathrin-coated vesicle),
// plasma membrane (membrane-spanning protein → transport vesicle that fuses with the membrane) or secretion
// (made for export → secretory vesicle, exocytosis). Correct tags launch a vesicle from the launch pad;
// wrong ones get a gentle, specific hint. While the activity runs, the world's own parcels on that conveyor
// are hidden (restored in end()).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { GOLGI, LYSO } from '../../world/layout.js';
import { golgiToWorld } from '../../world/organelles/golgi.js';
import { runActivity, anchorsOf, framePose, tweenAlong } from './_shared.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
// trans sorting conveyor (mirrors the district builder's local frame)
const RC = 12.5, CZ = RC - 0.9, HW = 2.2, CONV_L = 4.6, BELT_Y = 0.64;
const loc = (phi, u) => ({ x: (RC - u) * Math.sin(phi), z: CZ - (RC - u) * Math.cos(phi) });
const CA = loc(0.475, HW + 0.15), CD = { x: Math.sin(0.775), z: Math.cos(0.775) };
const toW = (x, y, z) => V(...golgiToWorld(x, y, z));
const convAt = (s, y = BELT_Y) => toW(CA.x + CD.x * s, y, CA.z + CD.z * s);

const DEST = {
  lyso: { name: 'Lysosome', sub: 'M6P tag', color: 0x7ee03a, css: '#7ee03a', vesicle: 'Clathrin-coated vesicle → endosome → lysosome',
    hint: 'Look for the <b>M6P tag</b>: mannose-6-phosphate on a sugar chain is the “ship to the lysosome” label, read by M6P receptors in the trans-Golgi network.' },
  pm: { name: 'Plasma membrane', sub: 'membrane protein', color: 0x5ad2ff, css: '#5ad2ff', vesicle: 'Transport vesicle → fuses with the plasma membrane',
    hint: 'Proteins that <b>span the membrane</b> ride in the vesicle’s own membrane; when it fuses with the plasma membrane they end up embedded there.' },
  sec: { name: 'Secretion', sub: 'for export', color: 0xc08bff, css: '#c08bff', vesicle: 'Secretory vesicle → exocytosis',
    hint: 'Proteins <b>made for export</b> are packed inside secretory vesicles and released outside the cell by exocytosis.' },
};
const CARGO = [
  { name: 'Cathepsin D', clue: 'acid protease · carries an M6P tag', dest: 'lyso' },
  { name: 'Na⁺/K⁺ pump', clue: 'spans the membrane', dest: 'pm' },
  { name: 'Insulin', clue: 'hormone made for export', dest: 'sec' },
  { name: 'Glucose transporter', clue: 'transmembrane protein', dest: 'pm' },
  { name: 'β-Hexosaminidase', clue: 'lysosomal enzyme · M6P tag', dest: 'lyso' },
  { name: 'Amylase', clue: 'digestive enzyme for export · no M6P', dest: 'sec' },
];

export function start(ctx) {
  const A = anchorsOf(ctx, 'golgi');
  // hide the world's own parcels riding the trans conveyor so the player's cargo has the belt to itself
  const parcels = ctx.world?.parts?.find((p) => p.name === 'golgi')?.getObjectByName('parcels');
  const hidden = new Set();
  if (parcels) {
    const m = new THREE.Matrix4(), p = new THREE.Vector3(), a = convAt(0, 0), b = convAt(CONV_L, 0), ab = b.clone().sub(a), L2 = ab.lengthSq();
    for (let i = 0; i < parcels.count; i++) {
      parcels.getMatrixAt(i, m); p.setFromMatrixPosition(m);
      const t = THREE.MathUtils.clamp(p.clone().sub(a).dot(ab) / L2, 0, 1), q = a.clone().addScaledVector(ab, t);
      if (Math.hypot(p.x - q.x, p.z - q.z) < 0.35 && p.y > 0.45 && p.y < 1.2) hidden.add(i);
    }
    const zero = new THREE.Matrix4().makeScale(1e-3, 1e-3, 1e-3).setPosition(0, -40, 0);
    parcels.setMatrixAt = function (i, mm) { THREE.InstancedMesh.prototype.setMatrixAt.call(this, i, hidden.has(i) ? zero : mm); };
    for (const i of hidden) THREE.InstancedMesh.prototype.setMatrixAt.call(parcels, i, zero);
    parcels.instanceMatrix.needsUpdate = true;
  }
  const hooks = {};
  const inst = runActivity(ctx, (kit, api) => build(kit, api, ctx, A, hooks));
  inst._auto = (wrong) => hooks.auto?.(wrong);
  const end = inst.end;
  inst.end = () => { end(); if (parcels) delete parcels.setMatrixAt; };
  return inst;
}

function build(kit, api, ctx, A, hooks) {
  const B0 = convAt(0), B1 = convAt(CONV_L);
  const STATION_S = CONV_L - 0.75, station = convAt(STATION_S);
  const pad = A.golgiLaunchPad ? A.golgiLaunchPad.clone() : toW(CA.x + CD.x * (CONV_L + 1.05), 0, CA.z + CD.z * (CONV_L + 1.05));
  const dir = B1.clone().sub(B0).setY(0).normalize();
  const side = V(-dir.z, 0, dir.x); // left of travel when looking down the belt
  const YAW = -52; // from the courtyard side: the belt runs left → right across the screen into the launch pad
  const D = Math.PI / 180;
  const camRight = V(Math.cos(YAW * D), 0, -Math.sin(YAW * D));
  const camBack = V(Math.sin(YAW * D), 0, Math.cos(YAW * D));
  const sortedN = { n: 0 };
  const C = station.clone().lerp(pad, 0.3).add(V(0, 1.15, 0)).addScaledVector(camBack, -0.6);

  // ---------------------------------------------------------------- TGN scanner arch over the belt
  const arch = new THREE.Group(); arch.position.copy(station).setY(0); arch.rotation.y = Math.atan2(-dir.z, dir.x); kit.add(arch);
  const steel = kit.gloss(0xe9e2ee, { ei: 0.08, rough: 0.3, metal: 0.4 });
  const rose = kit.gloss(0xd45c8c, { ei: 0.25, rough: 0.28 });
  for (const s of [-1, 1]) { const post = new THREE.Mesh(new RoundedBoxGeometry(0.14, 1.55, 0.14, 2, 0.04), steel); post.position.set(0, 0.78, s * 0.48); arch.add(post); }
  const beamTop = new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.22, 1.18, 2, 0.06), rose); beamTop.position.y = 1.62; arch.add(beamTop);
  const scanMat = kit.additive(0x9ff0ff, 0.0, 2);
  const scan = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.95), scanMat); scan.rotation.y = Math.PI / 2; scan.position.y = 1.0; arch.add(scan);
  const scanSheet = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.95), kit.additive(0x9ff0ff, 0.0, 1)); scanSheet.rotation.y = Math.PI / 2; scanSheet.position.y = 1.0; arch.add(scanSheet);
  const lampMat = kit.glow(0xffe6b0, 4);
  for (const s of [-1, 1]) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), lampMat); l.position.set(0.16, 1.62, s * 0.42); arch.add(l); }
  kit.light(0xffd6f0, 6, 5, station.clone().add(V(0, 2.2, 0)));

  // ---------------------------------------------------------------- destination gates (clickable holo buttons) above the launch pad
  const gates = {};
  const gateBase = station.clone().lerp(pad, 0.5).setY(2.2).addScaledVector(camBack, -2.6).addScaledVector(camRight, -0.7);
  const order = ['lyso', 'pm', 'sec'];
  order.forEach((k, i) => {
    const d = DEST[k];
    const g = new THREE.Group(); g.position.copy(gateBase).addScaledVector(camRight, (i - 1) * 2.62).add(V(0, i === 1 ? 0.38 : 0, 0));
    g.rotation.y = YAW * D; g.scale.setScalar(1.33); kit.add(g);
    const face = new THREE.Mesh(new RoundedBoxGeometry(1.86, 0.78, 0.1, 3, 0.05), kit.gloss(0x141a34, { ei: 0.2, rough: 0.35, opacity: 0.86 }));
    g.add(face);
    const frameMat = kit.glow(d.color, 3.6);
    const frame = new THREE.Mesh(new THREE.TorusGeometry(1, 0.022, 6, 48), frameMat); frame.scale.set(0.98, 0.42, 1); frame.position.z = 0.06; g.add(frame);
    const t1 = kit.text(d.name.toUpperCase(), { h: 0.24, fg: '#ffffff', font: '800 70px Montserrat, sans-serif' }); t1.position.set(0.12, 0.1, 0.07); g.add(t1);
    if (t1.userData.aspect * 0.24 > 1.3) t1.scale.setScalar(1.3 / (t1.userData.aspect * 0.24));
    const t2 = kit.text(d.sub, { h: 0.25, fg: d.css, font: '700 60px Montserrat, sans-serif' }); t2.position.set(0.12, -0.19, 0.07); g.add(t2);
    if (t2.userData.aspect * 0.25 > 1.36) t2.scale.setScalar(1.36 / (t2.userData.aspect * 0.25));
    const icon = gateIcon(kit, k, d.color); icon.position.set(-0.72, 0, 0.09); g.add(icon);
    g.traverse((o) => { if (o.material) o.material.depthTest = false; }); // floating sign: never clipped by the Golgi stack
    gates[k] = { g, frameMat, d, k, flash: 0, pick: null };
    gates[k].pick = kit.pick(g, () => choose(k));
  });

  // ---------------------------------------------------------------- parcels
  const boxGeo = new RoundedBoxGeometry(0.5, 0.4, 0.46, 3, 0.07);
  const card = kit.own(new THREE.MeshPhysicalMaterial({ color: 0xe9c48e, roughness: 0.5, clearcoat: 0.55, clearcoatRoughness: 0.3, emissive: 0x3a2008, emissiveIntensity: 0.25 }));
  const tape = kit.gloss(0xfff3d8, { ei: 0.15, rough: 0.4 });
  const glyc = {
    glcnac: kit.glow(0x2f7bff, 2.6), man: kit.glow(0x3ccf4a, 2.6), gal: kit.glow(0xffd23a, 2.8), sia: kit.glow(0xb04aff, 3), m6p: kit.glow(0xc8ff3a, 6),
  };
  const sq = new THREE.BoxGeometry(0.075, 0.075, 0.075), ci = new THREE.SphereGeometry(0.045, 12, 8), di = new THREE.OctahedronGeometry(0.055, 0);
  const makeParcel = (cargo) => {
    const g = new THREE.Group();
    const box = new THREE.Mesh(boxGeo, card); box.position.y = 0.2; box.castShadow = true; g.add(box);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.51, 0.41, 0.09), tape); t.position.y = 0.2; g.add(t);
    if (cargo.dest === 'pm') { // hydrophobic transmembrane band (visual clue)
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.515, 0.1, 0.475), kit.glow(0xffc040, 2.2)); band.position.y = 0.2; g.add(band);
    }
    // N-glycan tree on top (SNFG: blue square GlcNAc, green circle mannose, yellow galactose, purple diamond sialic acid)
    const tree = new THREE.Group(); tree.position.set(0.08, 0.4, 0); g.add(tree);
    const put = (geo, mat, x, y) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, 0); tree.add(m); return m; };
    const stick = (x0, y0, x1, y1) => { const a = V(x0, y0, 0), b = V(x1, y1, 0); const s = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, a.distanceTo(b), 5), tape); s.position.copy(a).lerp(b, 0.5); s.quaternion.setFromUnitVectors(V(0, 1, 0), b.sub(a).normalize()); tree.add(s); };
    stick(0, 0, 0, 0.2); stick(0, 0.2, -0.1, 0.3); stick(0, 0.2, 0.1, 0.3);
    put(sq, glyc.glcnac, 0, 0.04); put(sq, glyc.glcnac, 0, 0.13); put(ci, glyc.man, 0, 0.21); put(ci, glyc.man, -0.1, 0.3); put(ci, glyc.man, 0.1, 0.3);
    if (cargo.dest === 'lyso') { stick(0.1, 0.3, 0.16, 0.4); const p = put(new THREE.SphereGeometry(0.05, 12, 8), glyc.m6p, 0.16, 0.41); g.userData.m6p = p; }
    else { stick(-0.1, 0.3, -0.1, 0.4); stick(0.1, 0.3, 0.1, 0.4); put(ci, glyc.gal, -0.1, 0.39); put(ci, glyc.gal, 0.1, 0.39); put(di, glyc.sia, -0.1, 0.48); put(di, glyc.sia, 0.1, 0.48); }
    tree.rotation.y = -Math.PI / 2; // face the camera side
    g.userData.tree = tree;
    // clue card (always faces the camera)
    const lab = kit.text(`${cargo.name} · ${cargo.clue}`, { h: 0.3, fg: '#1b1530', bg: 'rgba(255,248,236,0.95)', border: DEST[cargo.dest] ? 'rgba(212,92,140,0.9)' : null, font: '700 60px Inter, sans-serif', sprite: true, radius: 36, pad: 30 });
    lab.position.y = 1.3; lab.visible = false; lab.material.depthTest = false; g.add(lab); g.userData.lab = lab; // floating UI card: never cut by passing world objects
    kit.add(g);
    return g;
  };

  // ---------------------------------------------------------------- vesicles
  const vesMat = {
    lyso: kit.own(new THREE.MeshPhysicalMaterial({ color: 0xc8ffb0, roughness: 0.15, clearcoat: 1, transparent: true, opacity: 0.38, emissive: 0x3a8a10, emissiveIntensity: 0.6, depthWrite: false })),
    pm: kit.own(new THREE.MeshPhysicalMaterial({ color: 0xb8ecff, roughness: 0.15, clearcoat: 1, transparent: true, opacity: 0.38, emissive: 0x1a6a9a, emissiveIntensity: 0.6, depthWrite: false })),
    sec: kit.own(new THREE.MeshPhysicalMaterial({ color: 0xe0c8ff, roughness: 0.15, clearcoat: 1, transparent: true, opacity: 0.42, emissive: 0x6a2aaa, emissiveIntensity: 0.7, depthWrite: false })),
  };
  const cageMat = kit.own(new THREE.LineBasicMaterial({ color: new THREE.Color(0xd8ff9a).multiplyScalar(2.2), transparent: true, opacity: 0.9, toneMapped: false }));
  const cageGeo = new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(0.66, 1));
  const destPoint = (k) => {
    if (k === 'lyso') { const L = LYSO[2]; return V(L.x, 2.4, L.z); }
    if (k === 'pm') return pad.clone().add(V(-1.5, 0, 11)).setY(2.2);
    return pad.clone().add(V(10, 0, 2)).setY(2.2);
  };

  // ---------------------------------------------------------------- flow
  let current = null, busy = true, attempt = 0;
  const progress = () => api.progress(sortedN.n / CARGO.length, `Parcels sorted: ${sortedN.n} / ${CARGO.length}`);
  const setGates = (on) => { for (const g of Object.values(gates)) g.pick.enabled = on; };
  setGates(false);

  function choose(k) {
    if (busy || !current) return;
    const cargo = current.cargo, gate = gates[k];
    gate.flash = 1;
    ctx.sfx('button_press', { volume: 0.55 });
    if (k !== cargo.dest) {
      attempt++;
      ctx.sfx('error_soft', { volume: 0.5 });
      kit.tween(current.g.rotation, { z: 0.12, duration: 0.08, yoyo: true, repeat: 3, ease: 'sine.inOut', onComplete: () => { current.g.rotation.z = 0; } });
      kit.tween(gate.g.position, { y: gate.g.position.y - 0.08, duration: 0.09, yoyo: true, repeat: 1 });
      api.goal(`Not quite — <b>${cargo.name}</b> (${cargo.clue}). ${DEST[cargo.dest].hint}`);
      return;
    }
    busy = true; setGates(false);
    ship(current, k);
  }
  hooks.auto = (wrong) => {
    if (busy || !current) return;
    if (wrong) choose(order.find((k) => k !== current.cargo.dest)); else choose(current.cargo.dest);
  };

  async function ship(item, k) {
    const { g, cargo } = item, d = DEST[k];
    ctx.sfx('parcel_thunk', { volume: 0.6, position: g.position });
    kit.ring(g.position.clone().add(V(0, 0.4, 0)), d.color, { r: 0.3, to: 1.4, life: 0.6 });
    kit.unlabel('m6pr');
    // tag stamp: coloured band + destination glow
    const stamp = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.42, 0.12), kit.glow(d.color, 3.2)); stamp.position.set(-0.12, 0.2, 0); g.add(stamp);
    kit.from(stamp.scale, { x: 2, y: 2, z: 2, duration: 0.35, ease: 'back.out(3)' });
    g.userData.lab.visible = false; kit.unlabel('glycan');
    api.goal(`Tagged for <b>${d.name}</b>! ${k === 'lyso' ? 'M6P receptors pull it into a <b>clathrin-coated</b> bud.' : k === 'pm' ? 'It buds off in a <b>transport vesicle</b>; when the vesicle fuses with the plasma membrane the pump ends up embedded in it.' : 'It is packed into a <b>secretory vesicle</b> to be released outside the cell.'}`);
    // roll off the end of the belt onto the launch pad
    await kit.to(item, { s: CONV_L + 0.2, duration: 0.7, ease: 'power1.in' });
    item.follow = false;
    await kit.to(g.position, { x: pad.x, y: 0.35, z: pad.z, duration: 0.45, ease: 'power2.out' });
    // vesicle wraps it
    const ves = new THREE.Group(); ves.position.copy(g.position).add(V(0, 0.25, 0)); kit.add(ves);
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.62, 32, 20), vesMat[k]); shell.renderOrder = 4; ves.add(shell);
    if (k === 'lyso') { const cage = new THREE.LineSegments(cageGeo, cageMat); ves.add(cage); ves.userData.cage = cage; }
    if (k === 'pm') { // the cargo sits in the vesicle membrane: little glowing pumps dotted around the shell
      for (let j = 0; j < 6; j++) { const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.1, 4, 8), kit.glow(0xffc040, 3.5)); const v = new THREE.Vector3().randomDirection().multiplyScalar(0.62); m.position.copy(v); m.quaternion.setFromUnitVectors(V(0, 1, 0), v.clone().normalize()); ves.add(m); }
    }
    ves.add(kit.sprite(d.color, 2.0, 0.35));
    ves.scale.setScalar(0.01);
    ctx.sfx('vesicle_bud', { volume: 0.6 });
    await kit.to(ves.scale, { x: 1, y: 1, z: 1, duration: 0.55, ease: 'back.out(2)' });
    g.removeFromParent(); ves.add(g); g.position.set(0, -0.22, 0); g.scale.setScalar(0.85);
    kit.label('ves' + sortedN.n, d.vesicle, k === 'lyso' ? 'CCV' : k === 'pm' ? 'TV' : 'SV', () => ves.position.clone().add(V(0, 0.7, 0)));
    sortedN.n++; progress();
    // launch along an arc to the destination
    const to = destPoint(k), from = ves.position.clone();
    const mid = from.clone().lerp(to, 0.5).add(V(0, 2.6, 0));
    ctx.sfx('whoosh', { volume: 0.45 });
    const idx = sortedN.n - 1;
    tweenAlong(kit, [from, from.clone().add(V(0, 1.2, 0)), mid, to], { duration: 3.0, ease: 'power1.inOut', onPos: (v) => ves.position.copy(v),
      onComplete: () => {
        kit.unlabel('ves' + idx);
        kit.burst(ves.position.clone(), d.color, { count: 40, speed: 2.4, size: 0.3, life: 0.9 });
        ctx.sfx('vesicle_bloop', { volume: 0.5, position: ves.position });
        kit.tween(ves.scale, { x: 0.01, y: 0.01, z: 0.01, duration: 0.35, onComplete: () => { ves.visible = false; } });
      } });
    kit.tween(ves.scale, { x: 0.7, y: 0.7, z: 0.7, duration: 2.5, delay: 0.5 });
    await kit.wait(1.0);
    nextParcel();
  }

  async function nextParcel() {
    if (sortedN.n >= CARGO.length) { finish(); return; }
    const cargo = CARGO[sortedN.n];
    const g = makeParcel(cargo);
    const item = { g, cargo, s: 0, follow: true };
    current = item; attempt = 0;
    g.scale.setScalar(0.01);
    kit.tween(g.scale, { x: 1, y: 1, z: 1, duration: 0.5, ease: 'back.out(2)' });
    ctx.sfx('parcel_thunk', { volume: 0.35, position: B0 });
    api.goal(`Parcel <b>${sortedN.n + 1}</b> of ${CARGO.length} is rolling out of the trans face…`);
    await kit.to(item, { s: STATION_S, duration: api.replay ? 1.6 : 2.0, ease: 'power1.inOut' });
    // scanner sweep → clue revealed
    ctx.sfx('typewriter_tick', { volume: 0.4 });
    kit.tween(scanMat, { opacity: 1, duration: 0.15, yoyo: true, repeat: 3 });
    kit.tween(scanSheet.material, { opacity: 0.25, duration: 0.3, yoyo: true, repeat: 1 });
    g.userData.lab.visible = true; kit.from(g.userData.lab.scale, { x: 0.01, y: 0.01, duration: 0.35, ease: 'back.out(2)' });
    if (sortedN.n < 3 && cargo.dest !== 'lyso') kit.label('glycan', 'N-glycan, remodelled cis → trans', 'glycan', () => g.userData.tree.getWorldPosition(new THREE.Vector3()).add(V(0, 0.25, 0)));
    if (cargo.dest === 'lyso') kit.label('m6pr', 'Mannose-6-phosphate (M6P)', 'M6P', () => g.userData.m6p.getWorldPosition(new THREE.Vector3()));
    api.goal(`<b>${cargo.name}</b> — ${cargo.clue}. <b>Click the destination</b> above the launch pad (or use the buttons below).`);
    busy = false; setGates(true);
    ctx.sfx('interact_ping', { volume: 0.35 });
  }

  function finish() {
    current = null;
    kit.ring(pad.clone().add(V(0, 1.5, 0)), 0xffd6f0, { r: 0.5, to: 5, life: 1.3 });
    kit.burst(pad.clone().add(V(0, 2, 0)), 0xffc8e8, { count: 70, speed: 3.2, size: 0.3, life: 1.3 });
    api.buttons([]);
    api.finish('<b>All cargo shipped!</b> As proteins pass from the cis to the trans face, the Golgi remodels their sugar chains; at the trans-Golgi network it reads molecular tags — like <b>mannose-6-phosphate</b> for lysosomal enzymes — and sends each one off in the right vesicle.');
  }

  // ---------------------------------------------------------------- start
  (async () => {
    api.goal('Proteins arrive from the ER at the <b>cis</b> face and are modified as they move through the stack. At the <b>trans</b> face they must be <b>sorted</b>: read each parcel’s clue and tag it for its destination.', true);
    progress();
    api.buttons(order.map((k) => ({ label: DEST[k].name, onClick: () => choose(k) })));
    kit.label('tgn', 'Trans-Golgi network (TGN) · sorting', 'TGN', () => station.clone().add(V(0, 1.72, 0)));
    ctx.sfx('whoosh', { volume: 0.4 });
    for (const g of Object.values(gates)) kit.from(g.g.scale, { x: 0.01, y: 0.01, z: 0.01, duration: 0.7, delay: 0.9 + order.indexOf(g.k) * 0.12, ease: 'back.out(2)' });
    kit.from(arch.scale, { y: 0.01, duration: 0.6, delay: 0.5, ease: 'back.out(2)' });
    await ctx.rig.flyTo(framePose(ctx, C, { yaw: YAW, pitch: 52, dist: 10, fov: 40, sx: 0.17, sy: 0.02 }), api.replay ? 0.8 : 1.8);
    nextParcel();
  })();

  // ---------------------------------------------------------------- per frame
  const tmp = V(0, 0, 0);
  return (dt, t) => {
    if (current?.follow) {
      const s = current.s;
      tmp.copy(s <= CONV_L ? convAt(s) : convAt(CONV_L).lerp(pad.clone().setY(0.35), (s - CONV_L) / 1.05));
      current.g.position.copy(tmp);
      current.g.rotation.y = Math.atan2(-dir.z, dir.x);
      if (s < STATION_S - 0.01) current.g.position.y += Math.abs(Math.sin(t * 9)) * 0.012; // belt judder
    }
    for (const g of Object.values(gates)) {
      g.flash = Math.max(0, g.flash - dt * 2.5);
      const live = g.pick.enabled ? 1 : 0;
      g.frameMat.emissiveIntensity = 2 + live * (1.2 + 0.8 * Math.sin(t * 4 + g.k.length)) + g.flash * 5;
      g.g.position.y += Math.sin(t * 1.6 + g.k.length) * 0.0015;
    }
    scan.position.z = Math.sin(t * 5) * 0.4;
    for (const c of kit.root.children) if (c.userData.cage) c.userData.cage.rotation.y = t;
  };
}

function gateIcon(kit, k, color) {
  const g = new THREE.Group();
  if (k === 'lyso') { // sphere with a glowing phosphate dot
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.17, 20, 14), kit.gloss(0x6fbe3a, { ei: 0.8 })));
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), kit.glow(0xc8ff3a, 6)); p.position.set(0.12, 0.12, 0.1); g.add(p);
  } else if (k === 'pm') { // bilayer strip with a protein
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.05), kit.gloss(0xbfe8ff, { ei: 0.6 })); g.add(s);
    const p = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.16, 4, 8), kit.glow(0xffc040, 3.5)); g.add(p);
  } else { // vesicle bursting
    g.add(new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.03, 8, 24, Math.PI * 1.5), kit.glow(color, 3)));
    for (let j = 0; j < 4; j++) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), kit.glow(0xffffff, 4)); d.position.set(0.1 + j * 0.05, 0.05 + (j % 2) * 0.06, 0); g.add(d); }
  }
  return g;
}
