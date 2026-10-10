// Activity · Transport Vesicles — "Launch a Vesicle".
// Bud a vesicle from the Golgi's trans face, hook it to a kinesin motor, walk it along a microtubule to the
// front-right membrane port, zip the SNAREs and fuse: exocytosis releases the cargo outside the cell.
// Takeaway: vesicles bud from one membrane, are carried by motor proteins along microtubules, and fuse with their
// target; fusion with the plasma membrane is exocytosis.
import * as THREE from 'three';
import { runActivity, framePose } from './_shared.js';
import { organic } from '../../core/lookdev.js';
import { GATES, GOLGI } from '../../world/layout.js';
import { membranePoint } from '../../world/membrane.js';

const VR = 0.55; // vesicle radius

export function start(ctx) { return runActivity(ctx, (kit, api) => build(ctx, kit, api)); }

function build(ctx, kit, api) {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const anchors = ctx.game?._anchors?.() || {};
  const A = (k, fb) => (Array.isArray(anchors[k]) ? V(...anchors[k]) : fb);
  const bud = A('golgiBudding', V(GOLGI.x + 4, 8.3, GOLGI.z + 3.3));
  const pad = A('golgiLaunchPad', V(GOLGI.x + 6.4, 0, GOLGI.z + 8.7));
  const g = GATES.find((q) => q.id === 'portFR');
  const mp = membranePoint(g.angle, 0), n = V(mp.nx, 0, mp.nz);
  const mouth = A('vesicleFuse_portFR', V(mp.x - n.x * 0.55, 1.7, mp.z - n.z * 0.55));
  const dock = mouth.clone().addScaledVector(n, -0.9).setY(1.75);

  // ---------- microtubule track: pad → port (minus end at the Golgi, plus end at the cell edge) ----------
  // spline lifted to roof height + 1 over the warehouse block between the Golgi and the port (roofs reach y ≈ 3.9)
  const t0 = pad.clone().setY(3.5);
  const mid1 = t0.clone().lerp(dock, 0.3).setY(5.2), midC = t0.clone().lerp(dock, 0.5).setY(5.1), mid2 = t0.clone().lerp(dock, 0.72).setY(4.3);
  const trackEnd = dock.clone().addScaledVector(n, -1.2).setY(2.55);
  const track = new THREE.CatmullRomCurve3([t0, mid1, midC, mid2, trackEnd], false, 'centripetal');
  const TL = track.getLength();
  const stripes = stripeTexture(); kit.own(stripes);
  stripes.repeat.set(Math.round(TL / 0.5), 1);
  const mtMat = kit.own(new THREE.MeshStandardMaterial({ color: 0x1a2a3a, map: stripes, emissive: 0xffffff, emissiveMap: stripes, emissiveIntensity: 2.4, roughness: 0.35 }));
  const mt = new THREE.Mesh(new THREE.TubeGeometry(track, 220, 0.12, 12, false), mtMat);
  mt.visible = false; kit.add(mt);
  const endTag = (txt, p, col) => { const s = kit.text(txt, { h: 0.5, fg: col, font: '900 96px Montserrat, sans-serif', glow: 16, sprite: true }); s.position.copy(p).add(V(0, 0.55, 0)); s.visible = false; kit.add(s); return s; };
  const minusTag = endTag('−', t0, '#9fe6ff'), plusTag = endTag('+', trackEnd, '#9fe6ff');

  // ---------- the vesicle ----------
  const ves = new THREE.Group(); kit.add(ves);
  const shellMat = organic(kit.gloss(0xb47cff, { ei: 0.55, opacity: 0.55, rough: 0.12 }), { rim: 0xf0e0ff, rimPower: 2.0, rimStrength: 1.2, sss: 0xa865ff, sssStrength: 0.3 });
  shellMat.depthWrite = false;
  const shell = new THREE.Mesh(new THREE.SphereGeometry(VR, 40, 28), shellMat); shell.renderOrder = 6; ves.add(shell);
  const cargo = [];
  for (let k = 0; k < 4; k++) { const c = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), kit.glow([0xffc85a, 0x6affd0, 0xff7ab8, 0xffc85a][k], 3.8)); c.visible = false; ves.add(c); cargo.push(c); }
  // coat proteins (knobs) while budding
  const coatGeo = new THREE.SphereGeometry(0.06, 8, 6);
  const coat = new THREE.InstancedMesh(coatGeo, kit.gloss(0xe8d8ff, { ei: 0.5 }), 48); coat.frustumCulled = false; ves.add(coat);
  { const m = new THREE.Matrix4(), ga = Math.PI * (3 - Math.sqrt(5)); for (let i = 0; i < 48; i++) { const y = 1 - (i / 47) * 2, r = Math.sqrt(1 - y * y); m.makeTranslation(Math.cos(i * ga) * r * VR * 1.04, y * VR * 1.04, Math.sin(i * ga) * r * VR * 1.04); coat.setMatrixAt(i, m); } }
  const halo = kit.sprite(0xc08bff, 2.6, 0.45); ves.add(halo);
  const vLight = kit.light(0xc08bff, 6, 6); ves.add(vLight);
  // v-SNARE stalks on the vesicle (hidden until docking)
  const vsnare = new THREE.Group(); ves.add(vsnare); vsnare.visible = false;
  // neck to the Golgi membrane while budding
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.32, 0.4, 20), shellMat); kit.add(neck);
  const VS = { p: bud.clone(), grow: 0, coat: 1, neck: 1 };

  // ---------- kinesin-1: two heads on the track, a coiled-coil stalk up to the vesicle ----------
  const kin = new THREE.Group(); kin.visible = false; kit.add(kin);
  const headMat = kit.gloss(0x5cf0b8, { ei: 1.0, rough: 0.2 });
  const heads = [0, 1].map(() => { const h = new THREE.Mesh(new THREE.SphereGeometry(0.13, 18, 12), headMat); h.scale.set(1.2, 0.9, 0.9); kin.add(h); return h; });
  const legs = [0, 1].map(() => { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1, 8), headMat); kin.add(l); return l; });
  const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1, 8), kit.glow(0x9affd8, 2.6)); kin.add(stalk);
  const KS = { s: 0, phase: 0 }; // arc-length position of the motor on the track, stepping phase
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), up = V(0, 1, 0);
  function rod(m, a, b) { m.position.copy(a).lerp(b, 0.5); const d = _b.copy(b).sub(a); m.scale.set(1, d.length(), 1); m.quaternion.setFromUnitVectors(up, d.normalize()); }
  function trackAt(s) { return track.getPointAt(THREE.MathUtils.clamp(s / TL, 0, 1)); }
  function drawKinesin() {
    const s = KS.s, ph = KS.phase % 1, lead = Math.floor(KS.phase) % 2;
    const step = 0.4; // visual step length (real kinesin: 8 nm)
    const back = trackAt(s - step * 0.5), front = trackAt(s + step * 0.5);
    // the trailing head swings forward over the leading head in an arc
    const swingFrom = trackAt(s - step * 0.5), swingTo = trackAt(s + step * 0.5);
    const hA = heads[lead], hB = heads[1 - lead];
    hB.position.copy(front).add(V(0, 0.13, 0));
    hA.position.copy(swingFrom).lerp(swingTo, ph).add(V(0, 0.13 + Math.sin(ph * Math.PI) * 0.3, 0));
    if (ph < 0.02) hA.position.copy(back).add(V(0, 0.13, 0));
    const hip = trackAt(s).add(V(0, 0.55, 0));
    rod(legs[0], heads[0].position, hip); rod(legs[1], heads[1].position, hip);
    rod(stalk, hip, VS.p.clone().add(V(0, -VR * 0.85, 0)));
  }

  // ---------- t-SNAREs on the plasma membrane + fusion fx ----------
  const tsn = new THREE.Group(); tsn.visible = false; kit.add(tsn);
  const snareMat = kit.glow(0xffc04a, 3.2), vMat = kit.glow(0xd08bff, 3.4);
  const tStrands = [], vStrands = [];
  for (let k = 0; k < 3; k++) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1, 8), snareMat); tsn.add(m); tStrands.push(m); }
  for (let k = 0; k < 3; k++) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1, 8), vMat); kit.add(m); m.visible = false; vStrands.push(m); }
  const ZS = { zip: 0 };
  const side = new THREE.Vector3().crossVectors(up, n).normalize();
  function drawSnares(t) {
    if (!tsn.visible) return;
    for (let k = 0; k < 3; k++) {
      const off = (k - 1) * 0.28;
      const base = mouth.clone().addScaledVector(n, -0.15).addScaledVector(side, off).setY(1.75 + (k - 1) * 0.12);
      const ves0 = VS.p.clone().addScaledVector(n, VR * 0.9).addScaledVector(side, off * 0.6).setY(VS.p.y + (k - 1) * 0.1);
      // zipping: both strands meet in the middle, twisting around each other
      const midT = base.clone().lerp(ves0, 0.5 + 0.5 * (1 - ZS.zip) * 0.3);
      const tw = Math.sin(t * 3 + k * 2) * 0.06 * ZS.zip;
      rod(tStrands[k], base, midT.clone().add(V(0, tw, 0)));
      rod(vStrands[k], ves0, midT.clone().add(V(0, -tw, 0)));
    }
  }

  // ---------- per-frame ----------
  let follow = null;
  const update = (dt, t) => {
    // vesicle pose
    ves.position.copy(VS.p);
    ves.scale.setScalar(Math.max(0.001, VS.grow));
    coat.visible = VS.coat > 0.02; coat.scale.setScalar(Math.max(0.001, VS.coat));
    cargo.forEach((c, k) => { c.rotation.set(t * (0.6 + k * 0.2), t * 0.8, k); });
    halo.material.opacity = 0.35 + 0.15 * Math.sin(t * 3);
    // neck back to the membrane
    neck.visible = VS.neck > 0.02;
    if (neck.visible) {
      const base = bud.clone(), top = VS.p.clone().add(V(0, -VR * VS.grow * 0.8, 0));
      rod(neck, base, top); neck.scale.x = neck.scale.z = Math.max(0.05, VS.neck);
    }
    if (kin.visible) drawKinesin();
    drawSnares(t);
    if (follow) kit.steer(follow(), 1 - Math.exp(-dt * 4));
  };

  // ---------- flow ----------
  let busy = false, step = 'bud', buds = 0;
  api.goal('<b>Bud a vesicle.</b> At the Golgi’s trans face, coat proteins gather cargo and bend the membrane into a bud. Click the glowing spot three times.', true);
  api.progress(0.02, 'Step 1 / 5 · budding');
  kit.fly(bud.clone().add(V(-0.6, -0.6, 0)), { yaw: 32, pitch: 22, dist: 9.5, fov: 40 }, 1.8);
  kit.label('tgn', 'trans-Golgi network', 'TGN', () => bud.clone().add(V(-1.6, -0.6, 0)));
  const spot = new THREE.Group(); spot.position.copy(bud); kit.add(spot);
  const spotGlow = kit.sprite(0xd8a8ff, 1.8, 0.8); spot.add(spotGlow);
  const spotRing = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.03, 8, 48), kit.additive(0xd8a8ff, 0.9, 3)); spotRing.rotation.x = Math.PI / 2; spot.add(spotRing);
  const spotHit = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 8), kit.own(new THREE.MeshBasicMaterial({ visible: false }))); spot.add(spotHit);
  const spotOff = kit.onUpdate((dt, t) => { spotRing.scale.setScalar(1 + 0.2 * Math.sin(t * 5)); });
  VS.p.copy(bud); VS.grow = 0.001;
  const growBud = async () => {
    if (busy || step !== 'bud') return; busy = true; buds++;
    ctx.sfx('vesicle_bud', { position: bud, pitch: 0.9 + buds * 0.1 });
    const g = buds / 3;
    // cargo parcel slides in
    const c = cargo[buds - 1]; c.visible = true; c.position.set(0, -VR * 1.4, 0);
    kit.tween(c.position, { x: (buds - 2) * 0.17, y: -0.05 + (buds % 2) * 0.12, z: 0.05 * buds, duration: 0.8, ease: 'power2.out' });
    if (buds === 3) { cargo[3].visible = true; cargo[3].position.set(0, -VR * 1.4, 0); kit.tween(cargo[3].position, { x: 0.06, y: 0.16, z: -0.12, duration: 0.8 }); }
    await kit.to(VS, { grow: g, duration: 0.7, ease: 'back.out(1.6)', onUpdate: () => VS.p.copy(bud).add(V(0, VR * VS.grow * 0.95, 0)) });
    kit.burst(VS.p, 0xd8a8ff, { count: 14, speed: 1, size: 0.14 });
    if (buds === 1) { kit.label('coat', 'Coat proteins bend the membrane', 'Coat', () => VS.p.clone().add(V(0.6, 0.55, 0))); kit.label('cargo', 'Cargo proteins inside', 'Cargo', () => VS.p.clone().add(V(-0.5, -0.2, 0))); }
    api.progress(0.06 + 0.06 * buds, `Step 1 / 5 · bud ${buds} / 3`);
    busy = false;
    if (buds === 3) pinch();
  };
  const spotPick = kit.pick(spot, growBud);
  api.buttons([{ label: 'Grow the bud', solid: true, onClick: growBud }]);

  async function pinch() {
    step = 'busy'; api.buttons([]); kit.unpick(spotPick); spotOff(); kit.tween(spot.scale, { x: 0.001, y: 0.001, z: 0.001, duration: 0.4 });
    await kit.wait(0.3);
    ctx.sfx('vesicle_bloop');
    await kit.to(VS, { neck: 0, duration: 0.6, ease: 'power3.in' });
    kit.ring(bud.clone().add(V(0, 0.1, 0)), 0xffffff, { r: 0.2, to: 1.0, normal: up });
    kit.burst(bud, 0xffffff, { count: 24, speed: 1.4, size: 0.14 });
    kit.unlabel('coat'); kit.unlabel('tgn');
    kit.label('ves', 'Transport vesicle (lipid bilayer)', 'Vesicle', () => VS.p.clone().add(V(0, 0.85, 0)));
    // uncoat, then float down to the start of the microtubule
    kit.tween(VS, { coat: 0, duration: 0.8 });
    api.goal('<b>Pinched off!</b> The vesicle sheds its coat. It must now travel ~30 city blocks to the cell membrane. It hitches a ride on a <b>motor protein</b>…');
    api.progress(0.25, 'Step 2 / 5 · find a motor');
    kit.fly(t0.clone().lerp(mid1, 0.15), { yaw: 24, pitch: 26, dist: 13, fov: 40 }, 2.2);
    await kit.to(VS.p, { ...xyz(trackAt(0).add(V(0, 1.15, 0))), duration: 2.0, ease: 'power2.inOut' });
    kit.unlabel('cargo');
    mt.visible = true; minusTag.visible = plusTag.visible = true;
    mt.scale.setScalar(1);
    ctx.sfx('zap', { volume: 0.4, pitch: 0.8 });
    kit.label('mt', 'Microtubule (α/β-tubulin) · plus end at the cell edge', 'MT', () => trackAt(TL * 0.22).add(V(0, 0.45, 0)));
    // kinesin waiting on the track
    kin.visible = true; KS.s = 0.2; kin.scale.setScalar(0.001); kit.tween(kin.scale, { x: 1, y: 1, z: 1, duration: 0.5, ease: 'back.out(2)' });
    kit.label('kin', 'Kinesin-1 motor', 'Kinesin', () => heads[0].position.clone().add(V(0.6, 0.15, 0)));
    api.goal('<b>Hook up kinesin.</b> Kinesin walks toward the microtubule’s <b>plus end</b>, out toward the cell edge. Click the motor to attach your vesicle.');
    step = 'attach';
    const kp = kit.pick(kin, () => attach(kp));
    api.buttons([{ label: 'Attach kinesin', solid: true, onClick: () => attach(kp) }]);
  }

  async function attach(kp) {
    if (step !== 'attach') return; step = 'busy'; api.buttons([]); kit.unpick(kp);
    ctx.sfx('parcel_thunk', { volume: 0.6 });
    await kit.to(VS.p, { ...xyz(trackAt(KS.s).add(V(0, 1.15, 0))), duration: 0.6, ease: 'power2.inOut' });
    kit.ring(VS.p.clone().add(V(0, -VR, 0)), 0x9affd8, { r: 0.2, to: 0.9, normal: up });
    api.goal('<b>Walk!</b> Each click sends kinesin a stretch along the track, hand over hand. Every step burns one ATP. Keep going to the membrane.');
    api.progress(0.32, 'Step 3 / 5 · walking');
    follow = null; // each Walk click flies the camera to the segment's end instead (a lagging follow lost the vesicle)
    kit.fly(VS.p.clone(), { yaw: 38, pitch: 30, dist: 12, fov: 42 }, 1.0);
    step = 'walk';
    walkPick = kit.pick(ves, walk);
    kit.pick(kin, walk);
    api.buttons([{ label: 'Walk ▶ (ATP)', solid: true, onClick: walk }]);
  }
  let walkPick = null, walks = 0; const NW = 5;
  let atpCount = 0;
  async function walk() {
    if (busy || step !== 'walk') return; busy = true; walks++;
    const sEnd = walks >= NW ? TL - 0.2 : (TL * walks) / NW;
    const steps = 7;
    const s0 = KS.s;
    // frame where this stretch ends, clear of the left panel, arriving together with the vesicle
    ctx.rig.flyTo(framePose(ctx, trackAt(sEnd).add(V(0, 0.6, 0)), { yaw: 38, pitch: 30, dist: 12, fov: 42, sx: 0.12, sy: 0 }), steps * 0.2 + 0.1, 'power1.inOut');
    for (let k = 0; k < steps && kit.alive; k++) {
      const a = s0 + ((sEnd - s0) * (k + 1)) / steps;
      kit.tween(KS, { phase: Math.floor(KS.phase) + 1, duration: 0.2, ease: 'power1.inOut' });
      await kit.to(KS, { s: a, duration: 0.2, ease: 'power1.inOut', onUpdate: () => VS.p.copy(trackAt(KS.s).add(V(0, 1.15, 0))) });
      atpCount++;
      if (k % 2 === 0) atpPop(heads[(Math.floor(KS.phase)) % 2].position);
      ctx.sfx('footstep_metal', { volume: 0.25, pitch: 1.6 });
    }
    api.progress(0.32 + 0.48 * (walks / NW), `Step 3 / 5 · ${atpCount} ATP spent · ${Math.round((100 * KS.s) / TL)} % of the way`);
    busy = false;
    if (walks >= NW) arrive();
  }
  function atpPop(p) {
    const s = kit.text('ATP', { h: 0.29, fg: '#1a1200', bg: '#ffd24a', font: '900 64px Montserrat, sans-serif', pad: 14, sprite: true });
    s.position.copy(p).add(V(0, 0.3, 0)); kit.add(s);
    kit.tween(s.position, { y: s.position.y + 0.8, duration: 0.9, ease: 'power1.out' });
    kit.tween(s.material, { opacity: 0, duration: 0.9, ease: 'power2.in', onComplete: () => s.removeFromParent() });
    ctx.sfx('atp_pop', { volume: 0.35, pitch: 1.2 + Math.random() * 0.3 });
  }

  async function arrive() {
    step = 'busy'; api.buttons([]);
    follow = null;
    kit.unlabel('mt'); kit.unlabel('kin');
    const yawIn = Math.atan2(-n.x, -n.z) * 180 / Math.PI;
    kit.fly(dock.clone().add(V(0, 0.2, 0)), { yaw: yawIn + 28, pitch: 16, dist: 7.5, fov: 42 }, 1.6);
    // kinesin lets go; the vesicle drifts the last stretch to the membrane (short trips often use actin + myosin)
    kit.tween(kin.scale, { x: 0.001, y: 0.001, z: 0.001, duration: 0.5, delay: 0.3, onComplete: () => { kin.visible = false; } });
    await kit.to(VS.p, { ...xyz(dock), duration: 1.6, ease: 'power2.inOut' });
    kit.label('pm', 'Plasma membrane (target)', 'PM', () => mouth.clone().add(V(0, 1.6, 0)));
    tsn.visible = true; vStrands.forEach((m) => { m.visible = true; });
    ZS.zip = 0;
    kit.label('snare', 'v-SNARE (vesicle) meets t-SNAREs (membrane)', 'SNARE', () => dock.clone().addScaledVector(n, 0.5).add(V(0, 0.7, 0)));
    api.goal('<b>Dock.</b> The vesicle has reached its target. Click to let the <b>SNARE</b> proteins on the vesicle and the membrane zip together.');
    api.progress(0.84, 'Step 4 / 5 · docking');
    step = 'dock';
    const dp = kit.pick(ves, () => zip(dp));
    api.buttons([{ label: 'Zip the SNAREs', solid: true, onClick: () => zip(dp) }]);
  }

  async function zip(dp) {
    if (step !== 'dock') return; step = 'busy'; api.buttons([]); kit.unpick(dp);
    ctx.sfx('valve_turn');
    await kit.to(ZS, { zip: 1, duration: 1.2, ease: 'power2.inOut', onUpdate: () => VS.p.copy(dock).addScaledVector(n, 0.35 * ZS.zip) });
    kit.label('snare', 'SNAREs zipped: the bilayers are pulled together', 'SNARE', () => dock.clone().addScaledVector(n, 0.5).add(V(0, 0.7, 0)));
    api.goal('<b>Fuse!</b> The SNARE zipper pulls the two bilayers into one. Click to open the fusion pore and release the cargo outside the cell.');
    api.progress(0.92, 'Step 5 / 5 · fusion');
    step = 'fuse';
    const fp = kit.pick(ves, () => fuse(fp));
    api.buttons([{ label: 'Fuse (exocytosis)', solid: true, onClick: () => fuse(fp) }]);
  }

  async function fuse(fp) {
    if (step !== 'fuse') return; step = 'done'; api.buttons([]); kit.unpick(fp);
    ctx.sfx('vesicle_bloop'); ctx.sfx('whoosh', { volume: 0.6 });
    const at = mouth.clone();
    kit.ring(at, 0xd8a8ff, { r: 0.3, to: 2.6, normal: n, life: 1.0 });
    kit.ring(at, 0xffffff, { r: 0.2, to: 1.6, normal: n, life: 0.6 });
    // vesicle membrane flattens into the plasma membrane; cargo sprays out of the cell
    kit.tween(ves.scale, { x: 0.001, y: 0.001, z: 0.001, duration: 0.6, ease: 'power2.in' });
    kit.tween(VS, { grow: 0.001, duration: 0.6, ease: 'power2.in' });
    for (const c of [0xffc85a, 0x6affd0, 0xff7ab8]) kit.burst(at.clone().addScaledVector(n, 0.3), c, { count: 40, speed: 2.4, size: 0.24, dir: n.clone().add(V(0, 0.35, 0)), life: 1.6 });
    // reuse the vesicle's own light for the fusion flash (one PointLight per activity)
    kit.root.attach(vLight); vLight.position.copy(at.clone().addScaledVector(n, -0.5)); vLight.color.set(0xd8a8ff); vLight.distance = 8; vLight.intensity = 30;
    kit.tween(vLight, { intensity: 0, duration: 1.4 });
    kit.tween(tsn.scale, { x: 0.001, y: 0.001, z: 0.001, duration: 0.5, delay: 0.4 });
    vStrands.forEach((m) => kit.tween(m.scale, { x: 0.001, z: 0.001, duration: 0.3 }));
    kit.unlabel('snare'); kit.unlabel('ves'); kit.unlabel('pm');
    kit.label('exo', 'Exocytosis: cargo released outside the cell', 'Exo', () => at.clone().add(V(0, 1.2, 0)));
    // ending reveal: pull up and back so the fusion pore, the cargo leaving the cell and the end of the
    // microtubule all read in one frame (centred right of the activity panel)
    const yawEnd = Math.atan2(-n.x, -n.z) * 180 / Math.PI + 32;
    ctx.rig.flyTo(framePose(ctx, at.clone().addScaledVector(n, -1.6), { yaw: yawEnd, pitch: 46, dist: 14, fov: 40, sx: 0.12, sy: 0.04 }), 1.8);
    await kit.wait(1.2);
    api.finish('<b>Delivered!</b> Your vesicle budded from the trans-Golgi, rode a <b>kinesin</b> motor along a <b>microtubule</b> (one ATP per step), docked with <b>SNAREs</b> and fused with the plasma membrane. Fusing with the cell membrane to release cargo is <b>exocytosis</b>.');
  }

  function stripeTexture() {
    const c = document.createElement('canvas'); c.width = 64; c.height = 8; const g = c.getContext('2d');
    g.fillStyle = '#7fd8ff'; g.fillRect(0, 0, 32, 8); g.fillStyle = '#c9a8ff'; g.fillRect(32, 0, 32, 8);
    g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(30, 0, 2, 8); g.fillRect(62, 0, 2, 8);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
  }

  return update;
}

function xyz(v) { return { x: v.x, y: v.y, z: v.z }; }
