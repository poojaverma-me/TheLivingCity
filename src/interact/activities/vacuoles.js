// Vacuoles — "Fill and Drain" (balance the stores).
// The three storage tanks (water, nutrients, waste) drift out of balance one event at a time: the cell swells in a
// dilute bath, a meal arrives, waste piles up, the cell needs fuel, the bath turns salty. The player fixes each by
// clicking the glowing control (3 clicks): Na⁺/K⁺ pumps move ions and water follows through aquaporins (osmosis);
// nutrients are stored or released; waste is sent to the lysosomes. Each tank has a floating gauge with a green
// "balanced" band. The rubber duck rides the water level (and enjoys a good bounce). Finale: a hologram contrasts the
// animal cell's many small vacuoles with a plant cell's single central vacuole, which the player inflates to show
// turgor pressure against the cell wall.
// Takeaway: Vacuoles store water, nutrients and waste; animal cells keep theirs small and balance water with ion
// pumps, while plants rely on one large central vacuole for turgor.
import * as THREE from 'three';
import { runActivity, anchorsOf, framePose, tweenAlong } from './_shared.js';
import { VACUOLES, LYSO, MITO } from '../../world/layout.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const D = Math.PI / 180;
const CLICKS = 3;
const KIND = [
  { key: 'water', name: 'WATER', color: 0x5fe8ff, css: '#7ff0ff' },
  { key: 'nutrient', name: 'NUTRIENTS', color: 0xffc25a, css: '#ffd27a' },
  { key: 'waste', name: 'WASTE', color: 0xb8c860, css: '#d0dc80' },
];
// one event at a time; `to` is how far out of balance the level drifts (+ over / − under), `dir` the fix direction
const EVENTS = [
  { tank: 0, to: +1, title: 'Swelling!', btn: 'PUMP IONS OUT', particle: 'ionsOut',
    goal: 'The cell is sitting in a <b>dilute</b> bath, so water rushes in by <b>osmosis</b> and the cell swells. Animal cells have no wall to push back, so they <b>pump ions out</b>. <b>Click the water valve</b> to run the <b>Na⁺/K⁺ pumps</b>.',
    done: 'Ions pumped out, and <b>water followed them out through aquaporins</b>. Balanced!' },
  { tank: 1, to: -1, title: 'Meal time!', btn: 'STORE NUTRIENTS', particle: 'nutrIn',
    goal: 'A meal has arrived: <b>glucose and amino acids</b> are flooding in, but the nutrient store is low. <b>Click the nutrient tank</b> to store some for later.',
    done: 'Nutrients stored for later. Balanced!' },
  { tank: 2, to: +1, title: 'Waste piling up!', btn: 'SEND TO LYSOSOMES', particle: 'wasteOut',
    goal: 'Metabolic <b>waste</b> is piling up. <b>Click the waste tank</b> to ship it to the <b>lysosomes</b> for digestion (or out of the cell by exocytosis).',
    done: 'Waste sent off for digestion. Balanced!' },
  { tank: 1, to: +1, title: 'Need fuel!', btn: 'RELEASE NUTRIENTS', particle: 'nutrOut',
    goal: 'Between meals the cell needs fuel. <b>Click the nutrient tank</b> to release stored nutrients to the <b>mitochondria</b>.',
    done: 'Fuel delivered to the mitochondria. Balanced!' },
  { tank: 0, to: -1, title: 'Shrinking!', btn: 'PUMP IONS IN', particle: 'ionsIn',
    goal: 'Now the bath is <b>salty</b>: water leaves by osmosis and the cell shrinks. <b>Click the water valve</b> to take ions in; water will follow.',
    done: 'Ions in, water followed back in. Balanced!' },
];

export function start(ctx) {
  const hooks = {};
  const inst = runActivity(ctx, (kit, api) => build(kit, api, ctx, hooks));
  inst._auto = () => hooks.auto?.();
  return inst;
}

function build(kit, api, ctx, hooks) {
  api.buttons([]); // clear the previous run's Play again / Finish buttons on replay
  const A = anchorsOf(ctx, 'vacuoles');
  const grp = ctx.world?.parts?.find((p) => p.name === 'vacuoles') || ctx.scene.getObjectByName('vacuoles');
  const valveP = A.tankValve || V(VACUOLES[0].x + 2.4, 0.62, VACUOLES[0].z + 1.4);
  const camYaw = 28;
  const toCam = V(Math.sin(camYaw * D), 0, Math.cos(camYaw * D)), right = V(Math.cos(camYaw * D), 0, -Math.sin(camYaw * D));

  // ---------------------------------------------------------------- take over the tank liquids (restored on end)
  const proxy = new THREE.Group(); proxy.name = 'vacuoleActivityLiquids'; ctx.scene.add(proxy);
  kit.onEnd(() => proxy.removeFromParent()); // shares the district's geometries/materials: never dispose them
  const near = (o, T, eps = 0.05) => Math.abs(o.position.x - T.x) < eps && Math.abs(o.position.z - T.z) < eps;
  const hidden = [];
  const hide = (o) => { if (o && o.visible) { o.visible = false; hidden.push(o); } };
  kit.onEnd(() => hidden.forEach((o) => { o.visible = true; }));
  const tanks = VACUOLES.map((T, i) => {
    const r = T.r, H = 1.6 + r * 0.14, WL = H - 0.5;
    const tk = { i, T, r, H, WL, level: WL, target: WL, kind: KIND[i], parts: {} };
    if (grp) for (const o of grp.children) {
      if (!o.isMesh || !near(o, T)) continue;
      const gt = o.geometry?.type;
      if (gt === 'CylinderGeometry' && Math.abs(o.position.y - 0.14) < 0.01) tk.parts.column = o;
      else if (o.renderOrder === 2) tk.parts.surface = o;
      else if (gt === 'TorusGeometry' && o.material?.isMeshBasicMaterial) tk.parts.men = o;
    }
    for (const k of ['column', 'surface', 'men']) {
      const o = tk.parts[k]; if (!o) continue;
      const c = new THREE.Mesh(o.geometry, o.material); c.position.copy(o.position); c.rotation.copy(o.rotation); c.scale.copy(o.scale); c.renderOrder = o.renderOrder; c.receiveShadow = o.receiveShadow;
      proxy.add(c); tk[k] = c; hide(o);
    }
    tk.top = V(T.x, H + 0.1, T.z);
    return tk;
  });
  // the pouring stream/splash on the water tank follow the district's own fill cycle: hide them while we drive levels
  if (grp) for (const o of grp.children) {
    if (!o.isMesh) continue;
    const m = o.material;
    if (m?.isMeshStandardMaterial && m.transparent && m.depthWrite === false && o.geometry?.type === 'CylinderGeometry' && m.emissiveIntensity > 2) hide(o);
    if (m?.isMeshBasicMaterial && m.transparent && o.geometry?.type === 'TorusGeometry') hide(o);
  }
  // the duck: hide the district's, ride ours on the activity water level
  const realDuck = grp?.userData?.duck || ctx.scene.getObjectByName('rubberDuck');
  let duck = null;
  if (realDuck) { duck = realDuck.clone(true); proxy.add(duck); hide(realDuck); }
  const duckR = tanks[0].r * 0.48;
  let duckJump = { y: 0, spin: 0 }, duckA = 0.7;

  const setLevel = (tk, lv) => {
    tk.level = lv;
    if (tk.column) tk.column.scale.y = Math.max(0.02, lv - 0.14);
    if (tk.surface) tk.surface.position.y = lv;
    if (tk.men) tk.men.position.y = lv;
  };

  // ---------------------------------------------------------------- gauges (floating, camera-side of each tank)
  const RANGE = (tk) => [0.3, tk.H - 0.12];
  const frac = (tk, lv) => { const [a, b] = RANGE(tk); return THREE.MathUtils.clamp((lv - a) / (b - a), 0, 1); };
  const BAND = 0.12; // ± level tolerance around WL that counts as balanced
  const GH = 1.5;
  tanks.forEach((tk) => {
    const g = new THREE.Group(); g.position.copy(tk.T.x !== undefined ? V(tk.T.x, 0, tk.T.z) : V()).addScaledVector(toCam, tk.r * 0.2).addScaledVector(right, -tk.r * 0.15).setY(tk.H + 1.75);
    g.rotation.y = camYaw * D; g.scale.setScalar(1.35); kit.add(g);
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, GH, 18, 1, true), kit.own(new THREE.MeshPhysicalMaterial({ color: 0xe8fbff, roughness: 0.05, transparent: true, opacity: 0.28, clearcoat: 1, depthWrite: false }))); g.add(glass);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(0.36, GH + 0.1), kit.own(new THREE.MeshBasicMaterial({ color: 0x0a1626, transparent: true, opacity: 0.7, depthWrite: false }))); back.position.z = -0.14; g.add(back);
    const fill = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1, 16), kit.glow(tk.kind.color, 3.4)); fill.geometry.translate(0, 0.5, 0); fill.position.y = -GH / 2; g.add(fill);
    const f0 = frac(tk, tk.WL - BAND), f1 = frac(tk, tk.WL + BAND);
    const band = new THREE.Mesh(new THREE.PlaneGeometry(0.5, (f1 - f0) * GH), kit.additive(0x6aff6a, 0.3, 1.6)); band.position.set(0, -GH / 2 + ((f0 + f1) / 2) * GH, -0.02); g.add(band);
    for (const f of [f0, f1]) { const tick = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.025, 0.02), kit.glow(0x6aff6a, 3.2)); tick.position.set(0, -GH / 2 + f * GH, 0.12); g.add(tick); }
    for (const y of [-GH / 2, GH / 2]) { const cap = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.03, 8, 20), kit.gloss(0xd8dde4, { ei: 0.1, metal: 0.7 })); cap.rotation.x = Math.PI / 2; cap.position.y = y; g.add(cap); }
    const title = kit.text(tk.kind.name, { h: 0.31, fg: tk.kind.css, font: '900 70px Montserrat, sans-serif', bg: 'rgba(8,18,34,0.78)', radius: 40 }); title.position.y = GH / 2 + 0.3; g.add(title);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 10), kit.glow(0x6aff6a, 4)); lamp.position.set(0, -GH / 2 - 0.22, 0.05); g.add(lamp);
    tk.gauge = { g, fill, lamp, title };
  });

  // ---------------------------------------------------------------- controls: an action button above each tank + the valve
  const valveRing = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.04, 8, 40), kit.additive(0xff5a4a, 0.9, 3)); valveRing.rotation.x = Math.PI / 2; valveRing.position.copy(valveP).add(V(0, 0.05, 0)); valveRing.visible = false; kit.add(valveRing);
  const valveHit = new THREE.Mesh(new THREE.SphereGeometry(0.7, 10, 8), kit.own(new THREE.MeshBasicMaterial({ visible: false }))); valveHit.position.copy(valveP); kit.add(valveHit);
  const valveSpin = new THREE.Group(); valveSpin.position.copy(valveP).add(V(0, 0.02, 0)); kit.add(valveSpin);
  for (let k = 0; k < 3; k++) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.03, 0.03), kit.additive(0xffd0a0, 0.0, 2.5)); s.rotation.y = k * Math.PI / 3; valveSpin.add(s); }
  const buttons = tanks.map((tk) => {
    const b = new THREE.Group(); b.position.copy(V(tk.T.x, tk.H + 0.75, tk.T.z)).addScaledVector(toCam, tk.r * 0.35); kit.add(b);
    b.visible = false;
    return { g: b, sprite: null };
  });
  const setButton = (i, label, color) => {
    const b = buttons[i];
    if (b.sprite) { b.g.remove(b.sprite); b.sprite = null; }
    if (!label) { b.g.visible = false; return; }
    const s = kit.text(label, { h: 0.45, fg: '#10131c', bg: color, font: '900 64px Montserrat, sans-serif', radius: 60, pad: 40, sprite: true, border: 'rgba(255,255,255,0.95)' });
    s.renderOrder = 12; s.material.depthTest = false;
    b.g.add(s); b.sprite = s; b.g.visible = true;
  };

  // ---------------------------------------------------------------- particles (ions, water, nutrients, waste)
  const NP = 160;
  const beads = kit.beads(NP, 0.085, { intensity: 4 });
  const parts = Array.from({ length: NP }, () => ({ on: false, p: V(0, 0, 0), s: 1, c: 0xffffff }));
  const fly = (pts, color, { dur = 1.2, delay = 0, scale = 1, onDone } = {}) => {
    const q = parts.find((r) => !r.on); if (!q) return;
    q.on = true; q.c = color; q.s = 0.001; q.p.copy(pts[0]);
    kit.tween(q, { s: scale, duration: 0.25, delay, ease: 'back.out(2)' });
    tweenAlong(kit, pts, { duration: dur, delay, ease: 'sine.inOut', onPos: (v) => q.p.copy(v), onComplete: () => { kit.tween(q, { s: 0.001, duration: 0.2, onComplete: () => { q.on = false; onDone?.(); } }); } });
  };
  const rnd = (a, b) => a + Math.random() * (b - a);
  const inTank = (tk) => V(tk.T.x + rnd(-0.5, 0.5) * tk.r, tk.level - 0.15, tk.T.z + rnd(-0.5, 0.5) * tk.r);
  const lysoP = V(LYSO[0].x, 1.6, LYSO[0].z), mitoP = V(MITO[0].x, 1.6, MITO[0].z), roadP = V(VACUOLES[1].x, 0.6, VACUOLES[1].z).addScaledVector(toCam, 6).addScaledVector(right, 2);
  const outside = (tk) => V(tk.T.x, 0, tk.T.z).addScaledVector(V(tk.T.x - -23.5, 0, tk.T.z - -7.3).normalize(), tk.r + 2.2).setY(1.0);
  const spray = (ev, tk) => {
    const top = (p) => p.clone().setY(tk.H + 1.3);
    if (ev.particle === 'ionsOut' || ev.particle === 'ionsIn') {
      const into = ev.particle === 'ionsIn';
      for (let k = 0; k < 6; k++) {
        const a = inTank(tk), b = outside(tk).add(V(rnd(-0.8, 0.8), rnd(0, 0.8), rnd(-0.8, 0.8)));
        fly(into ? [b, top(a.clone().lerp(b, 0.5)), a] : [a, top(a.clone().lerp(b, 0.5)), b], k % 3 ? 0xb07aff : 0x4ad0ff, { dur: 0.9, delay: k * 0.05, scale: 0.9 });
      }
      for (let k = 0; k < 5; k++) {
        const a = inTank(tk), b = outside(tk).add(V(rnd(-0.8, 0.8), rnd(0, 0.6), rnd(-0.8, 0.8)));
        fly(into ? [b, top(a.clone().lerp(b, 0.5)), a] : [a, top(a.clone().lerp(b, 0.5)), b], 0x9ff8ff, { dur: 1.0, delay: 0.35 + k * 0.06, scale: 1.25 });
      }
    } else if (ev.particle === 'nutrIn') {
      for (let k = 0; k < 9; k++) { const a = roadP.clone().add(V(rnd(-1, 1), rnd(0, 0.5), rnd(-1, 1))), b = inTank(tk); fly([a, top(a.clone().lerp(b, 0.5)).add(V(0, 0.5, 0)), b], k % 2 ? 0xffc25a : 0x3fe6ff, { dur: 1.2, delay: k * 0.06 }); }
    } else if (ev.particle === 'nutrOut') {
      for (let k = 0; k < 9; k++) { const a = inTank(tk), b = mitoP.clone().add(V(rnd(-1, 1), rnd(0, 0.6), rnd(-1, 1))); fly([a, top(a.clone().lerp(b, 0.3)).add(V(0, 1, 0)), b], k % 2 ? 0xffc25a : 0x3fe6ff, { dur: 1.8, delay: k * 0.06 }); }
    } else if (ev.particle === 'wasteOut') {
      for (let k = 0; k < 8; k++) { const a = inTank(tk), b = lysoP.clone().add(V(rnd(-0.8, 0.8), rnd(0, 0.6), rnd(-0.8, 0.8))); fly([a, top(a.clone().lerp(b, 0.3)).add(V(0, 0.8, 0)), b], 0x9aa84a, { dur: 1.7, delay: k * 0.07, scale: 1.2 }); }
    }
  };

  // ---------------------------------------------------------------- state
  let phase = 'intro', ev = -1, clicks = 0, lastAct = 0, finaleArmed = false;
  const progress = () => {
    if (phase === 'done') return;
    if (phase === 'plant') api.progress(0.85, 'Tanks balanced: 5 / 5  ·  now the plant cell');
    else api.progress(0.85 * ((Math.max(0, ev) + clicks / CLICKS) / EVENTS.length), `Events balanced: ${Math.max(0, ev)} / ${EVENTS.length}${ev >= 0 && ev < EVENTS.length ? `  ·  ${EVENTS[ev].btn.toLowerCase()}: ${clicks} / ${CLICKS}` : ''}`);
  };
  const levelFor = (tk, k) => tk.WL + k * 0.55;

  const startEvent = (i) => {
    ev = i; clicks = 0; phase = 'event'; lastAct = kit.time;
    const e = EVENTS[i], tk = tanks[e.tank];
    tk.target = levelFor(tk, e.to);
    tk.alarm = 1;
    api.goal(`<b>${e.title}</b> ${e.goal}`);
    progress();
    ctx.sfx('error_soft', { volume: 0.4, pitch: e.to > 0 ? 0.9 : 1.2 });
    ctx.sfx(e.to > 0 ? 'bubble' : 'whoosh', { volume: 0.4 });
    kit.ring(tk.top.clone().add(V(0, 0.2, 0)), 0xff7a4a, { r: 0.6, to: tk.r * 1.3, life: 0.9, normal: V(0, 1, 0) });
    const isValve = e.tank === 0;
    setButton(e.tank, `${e.btn} ▸`, e.to > 0 ? '#ffd27a' : '#9ff0ff');
    valveRing.visible = isValve;
    if (isValve) kit.label('valve', e.particle === 'ionsOut' ? 'Na⁺/K⁺-ATPase: 3 Na⁺ out, 2 K⁺ in per ATP' : 'Ion uptake: water follows by osmosis', 'pump', valveP.clone().addScaledVector(right, -1.4).add(V(0, 0.5, 0)));
    if (i === 0) kit.label('aqp', 'Water crosses through aquaporins', 'AQP', () => tanks[0].top.clone().addScaledVector(right, tanks[0].r * 0.7).add(V(0, 0.5, 0)));
  };

  const act = (tankIdx) => {
    if (phase !== 'event') {
      if (tankIdx === 0 && duck) return quack();
      return;
    }
    const e = EVENTS[ev];
    if (tankIdx !== e.tank) {
      ctx.sfx('error_soft', { volume: 0.3 });
      api.goal(`<b>${e.title}</b> ${e.goal}<br><i>That tank is fine. Click the glowing <b>${KIND[e.tank].name.toLowerCase()}</b> control.</i>`);
      return;
    }
    const tk = tanks[e.tank];
    clicks++; lastAct = kit.time;
    ctx.sfx(e.tank === 0 ? 'valve_turn' : 'button_press', { volume: 0.55, pitch: 0.9 + clicks * 0.08 });
    spray(e, tk);
    if (e.tank === 0) { kit.tween(valveSpin.rotation, { y: valveSpin.rotation.y + Math.PI * 1.3, duration: 0.6, ease: 'power2.out' }); valveSpin.children.forEach((s) => { s.material.opacity = 0.9; kit.tween(s.material, { opacity: 0, duration: 0.8 }); }); }
    const b = buttons[e.tank].g; kit.tween(b.scale, { x: 0.85, y: 0.85, z: 0.85, duration: 0.08, yoyo: true, repeat: 1 });
    const start = levelFor(tk, e.to);
    tk.target = THREE.MathUtils.lerp(start, tk.WL, clicks / CLICKS);
    kit.later(0.5, () => ctx.sfx('bubble', { volume: 0.35, pitch: 0.7 + clicks * 0.1 }));
    progress();
    if (clicks >= CLICKS) {
      phase = 'settle';
      setButton(e.tank, null); valveRing.visible = false; kit.unlabel('valve');
      kit.later(1.1, () => {
        tk.alarm = 0;
        ctx.sfx('discovery_chime', { volume: 0.45, pitch: 1 + ev * 0.05 });
        kit.ring(tk.top.clone().add(V(0, 0.1, 0)), 0x6aff6a, { r: 0.5, to: tk.r * 1.4, life: 0.9, normal: V(0, 1, 0) });
        kit.burst(tk.gauge.g.position.clone(), 0x6aff6a, { count: 24, speed: 1.4, size: 0.18, life: 0.7 });
        if (e.tank === 0) happyDuck();
        api.goal(e.done + (ev < EVENTS.length - 1 ? ' Watch for the next change…' : ''));
        if (ev === 0) kit.unlabel('aqp');
        if (ev < EVENTS.length - 1) kit.later(1.8, () => startEvent(ev + 1));
        else { ev = EVENTS.length; kit.later(1.6, () => plantFinale()); }
        progress();
      });
    }
  };
  kit.pick(valveHit, () => act(0));
  tanks.forEach((tk, i) => {
    kit.pick(buttons[i].g, () => act(i));
    if (tk.surface) kit.pick(tk.surface, () => act(i));
  });

  // ---------------------------------------------------------------- the duck
  const happyDuck = () => {
    if (!duck) return;
    ctx.sfx('bubble', { volume: 0.6, pitch: 2.2 });
    kit.tween(duckJump, { y: 0.45, duration: 0.28, ease: 'power2.out', yoyo: true, repeat: 1 });
    kit.tween(duckJump, { spin: duckJump.spin + Math.PI * 2, duration: 0.6, ease: 'power2.inOut' });
    kit.later(0.55, () => kit.ring(duck.position.clone().add(V(0, 0.02, 0)), 0x9ff8ff, { r: 0.15, to: 0.9, life: 0.6, normal: V(0, 1, 0) }));
  };
  let quacked = false;
  const quack = () => {
    happyDuck(); ctx.sfx('ui_click', { volume: 0.4, pitch: 2 });
    if (!quacked) { quacked = true; kit.label('duck', 'Rubber duck (not an organelle!)', '🦆', () => duck.position.clone().add(V(0, 0.4, 0))); kit.later(3, () => kit.unlabel('duck')); }
  };
  if (duck) { const dh = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), kit.own(new THREE.MeshBasicMaterial({ visible: false }))); kit.add(dh); kit.onUpdate(() => dh.position.copy(duck.position)); kit.pick(dh, () => quack()); }

  // ---------------------------------------------------------------- finale: animal vs plant vacuoles
  let plantVac = null, plantWall = null, plantHit = null;
  const plantFinale = () => {
    phase = 'plant'; progress(); lastAct = kit.time;
    const c = V(-23.4, 0, -7.4).addScaledVector(right, 0.4).addScaledVector(toCam, -1.2).setY(6.9); // lifted clear of the tanks
    const plate = kit.holoPlate({ w: 7.4, h: 3.5, color: 0x8affc8, pos: c, yaw: camYaw * D, opacity: 0.9, title: 'ANIMAL CELL vs PLANT CELL' });
    plate.updateMatrixWorld(true);
    const P = new THREE.Group(); plate.add(P); P.position.z = 0.08;
    const back = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 3.3), kit.own(new THREE.MeshBasicMaterial({ color: 0x08141c, transparent: true, opacity: 0.85, depthWrite: false }))); back.position.z = -0.1; P.add(back);
    ctx.rig.flyTo(framePose(ctx, c.clone().add(V(0, -0.7, 0)), { yaw: camYaw, pitch: 21, dist: 11.5, fov: 40, sx: 0.12, sy: 0.06 }), 1.6);
    const cap = (s, x, y, col, h = 0.2) => { const t = kit.text(s, { h, fg: col, font: '800 64px Montserrat, sans-serif' }); t.position.set(x, y, 0.05); P.add(t); return t; };
    // animal cell: soft round outline, nucleus, many small vacuoles
    const ax = -1.9;
    const amem = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.04, 8, 64), kit.glow(0xffb070, 3.2)); amem.position.set(ax, -0.2, 0); amem.scale.set(1.15, 0.92, 1); P.add(amem);
    const nucM = new THREE.Mesh(new THREE.SphereGeometry(0.28, 20, 14), kit.gloss(0x7a5cff, { ei: 0.8 })); nucM.position.set(ax - 0.25, -0.15, 0.05); P.add(nucM);
    const vm = kit.gloss(0x7ff0ff, { emissive: 0x3ad0ff, ei: 2.6, rough: 0.15 });
    [[0.45, 0.35, 0.13], [0.6, -0.35, 0.16], [0.15, -0.65, 0.1], [-0.65, 0.35, 0.11], [-0.7, -0.6, 0.12], [0.25, 0.05, 0.09], [-0.2, 0.5, 0.08]].forEach(([x, y, r]) => { const s = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), vm); s.position.set(ax + x, -0.2 + y, 0.05); P.add(s); });
    cap('ANIMAL: many small vacuoles', ax, -1.42, '#ffd2a0', 0.32);
    // plant cell: rigid wall, membrane, one big central vacuole
    const px = 1.9;
    const wallShape = new THREE.Shape(); { const w = 2.2, h = 1.7, r = 0.18, x = -w / 2, y = -h / 2; wallShape.moveTo(x + r, y); wallShape.lineTo(x + w - r, y); wallShape.quadraticCurveTo(x + w, y, x + w, y + r); wallShape.lineTo(x + w, y + h - r); wallShape.quadraticCurveTo(x + w, y + h, x + w - r, y + h); wallShape.lineTo(x + r, y + h); wallShape.quadraticCurveTo(x, y + h, x, y + h - r); wallShape.lineTo(x, y + r); wallShape.quadraticCurveTo(x, y, x + r, y); }
    const wpts = wallShape.getPoints(40).map((p) => V(p.x, p.y, 0));
    plantWall = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(wpts, true), 120, 0.07, 6, true), kit.glow(0x6adf4a, 3.4)); plantWall.position.set(px, -0.2, 0); P.add(plantWall);
    plantVac = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), kit.gloss(0x7ff0ff, { emissive: 0x3ad0ff, ei: 2.2, opacity: 0.88, rough: 0.15 })); plantVac.position.set(px + 0.1, -0.2, 0.05); plantVac.scale.set(0.45, 0.35, 0.2); P.add(plantVac);
    const chl = kit.gloss(0x3acd4a, { ei: 0.9 });
    [[-0.85, 0.55], [-0.85, -0.55], [0.85, 0.6], [0.85, -0.6], [0, 0.68], [0, -0.68]].forEach(([x, y]) => { const s = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), chl); s.position.set(px + x, -0.2 + y, 0.08); s.scale.set(1.4, 0.8, 0.8); P.add(s); });
    plantHit = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.9), kit.own(new THREE.MeshBasicMaterial({ visible: false }))); plantHit.position.set(px, -0.2, 0.1); P.add(plantHit);
    cap('PLANT: one central vacuole', px, -1.42, '#b8ffa0', 0.32);
    const btnT = kit.text('FILL IT ▸', { h: 0.3, fg: '#10131c', bg: '#9ff0ff', font: '900 64px Montserrat, sans-serif', radius: 60, pad: 36, border: 'rgba(255,255,255,0.95)' }); btnT.position.set(px, 0.95, 0.12); P.add(btnT);
    const fillPlant = () => {
      if (phase !== 'plant') return;
      phase = 'done'; lastAct = kit.time; btnT.visible = false;
      ctx.sfx('valve_turn', { volume: 0.5 }); ctx.sfx('bubble', { volume: 0.5, pitch: 0.7 });
      kit.tween(plantVac.scale, { x: 1.0, y: 0.74, z: 0.35, duration: 1.6, ease: 'elastic.out(1, 0.6)' });
      kit.tween(plantWall.scale, { x: 1.04, y: 1.05, duration: 0.5, delay: 0.8, ease: 'power2.out', yoyo: true, repeat: 1 });
      kit.label('turgor', 'Turgor pressure: water pushes the membrane against the wall', 'turgor', () => plate.localToWorld(V(px, 0.62, 0.3)));
      kit.label('tono', 'Tonoplast pumps ions in; water follows', 'tonoplast', () => plate.localToWorld(V(px + 0.6, -0.95, 0.3)));
      kit.later(1.8, () => {
        kit.burst(plate.localToWorld(V(px, -0.2, 0.3)), 0x9ff0ff, { count: 50, speed: 2.2, size: 0.2, life: 1.1 });
        happyDuck();
        api.finish('<b>All balanced!</b> Vacuoles are the cell’s <b>storage tanks</b> for water, nutrients and waste. Animal cells keep <b>many small vacuoles</b> and balance their water with <b>ion pumps</b> (Na⁺/K⁺-ATPase) while water follows through aquaporins. A plant cell instead fills <b>one large central vacuole</b> (up to 80–90 % of the cell), whose <b>turgor pressure</b> against the cell wall keeps leaves and stems firm.');
      });
    };
    kit.pick(plantHit, fillPlant); kit.pick(btnT, fillPlant);
    finaleArmed = true;
    hooks.fillPlant = fillPlant;
    ctx.sfx('discovery_chime', { volume: 0.6 });
    api.goal('All five tanks balanced. Real <b>animal cells</b> keep <b>many small vacuoles</b> (these giant tanks are city-sized artistic licence). A <b>plant cell</b> is different: <b>click its central vacuole</b> to fill it.');
  };

  // ---------------------------------------------------------------- auto hook (tests)
  hooks.auto = () => {
    if (phase === 'event') act(EVENTS[ev].tank);
    else if (phase === 'plant' && finaleArmed) hooks.fillPlant?.();
  };

  // ---------------------------------------------------------------- story
  const story = async () => {
    tanks.forEach((tk) => setLevel(tk, tk.WL));
    api.goal('These tanks are the city’s <b>vacuoles</b>: membrane sacs that store <b>water</b>, <b>nutrients</b> and <b>waste</b>. Keep every gauge in its <b>green band</b> as conditions change. Click the glowing control when a tank drifts.', true);
    progress();
    ctx.sfx('whoosh', { volume: 0.5 });
    const center = V(-23.6, 1.9, -7.2);
    await ctx.rig.flyTo(framePose(ctx, center, { yaw: camYaw, pitch: 44, dist: 17.5, fov: 40, sx: 0.12, sy: 0.04 }), api.replay ? 0.8 : 1.9);
    kit.label('store', 'Vacuole: membrane-bound storage sac', 'vacuole', tanks[2].top.clone().addScaledVector(toCam, tanks[2].r * 0.9).add(V(0, 0.1, 0)));
    kit.later(3.5, () => kit.unlabel('store'));
    await kit.wait(1.2);
    startEvent(0);
  };
  story();

  // ---------------------------------------------------------------- hint
  const hint = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.04, 8, 48), kit.additive(0xfff1a0, 0.9, 3.2)); hint.visible = false; kit.add(hint);
  const clickTip = kit.text('CLICK', { h: 0.24, fg: '#1a1030', bg: '#ffe680', font: '900 64px Montserrat, sans-serif', radius: 50, sprite: true }); clickTip.visible = false; kit.add(clickTip);

  // ---------------------------------------------------------------- per-frame
  const pc = new THREE.Color(), camQ = ctx.camera.quaternion;
  return (dt, t) => {
    tanks.forEach((tk) => {
      const lv = tk.level + (tk.target - tk.level) * Math.min(1, dt * 2.2);
      setLevel(tk, lv + Math.sin(t * 2 + tk.i) * 0.004);
      tk.level = lv;
      const f = frac(tk, lv);
      tk.gauge.fill.scale.y = Math.max(0.001, f * GH);
      const ok = Math.abs(lv - tk.WL) <= BAND + 0.02;
      tk.gauge.lamp.material.emissive.set(ok ? 0x6aff6a : 0xff4a3a);
      tk.gauge.lamp.material.emissiveIntensity = ok ? 3.5 : 3 + 2.5 * (0.5 + 0.5 * Math.sin(t * 8));
      tk.gauge.fill.material.emissiveIntensity = 3.2 + (tk.alarm ? 1.2 * (0.5 + 0.5 * Math.sin(t * 6)) : 0);
    });
    for (let i = 0; i < NP; i++) { const q = parts[i]; if (!q.on) { beads.hide(i); continue; } beads.set(i, q.p, q.s, pc.set(q.c)); }
    beads.commit();
    // buttons bob, valve ring pulse
    buttons.forEach((b, i) => { if (b.g.visible) { b.g.position.y = tanks[i].H + 0.75 + Math.sin(t * 3) * 0.06; } });
    if (valveRing.visible) { valveRing.scale.setScalar(1 + 0.15 * Math.sin(t * 5)); valveRing.material.opacity = 0.6 + 0.4 * Math.sin(t * 5); }
    // duck rides the water level
    if (duck) {
      const W0 = tanks[0];
      duckA += dt * 0.11;
      duck.position.set(W0.T.x + Math.cos(duckA) * duckR, W0.level - 0.02 + Math.sin(t * 1.9) * 0.015 + duckJump.y, W0.T.z + Math.sin(duckA) * duckR);
      duck.rotation.set(Math.sin(t * 1.6) * 0.08, -duckA - Math.PI / 2 + duckJump.spin, Math.sin(t * 1.3) * 0.06 + (W0.target !== W0.level ? Math.sin(t * 9) * 0.05 : 0));
    }
    // hint
    let tgt = null;
    if (phase === 'event') tgt = EVENTS[ev].tank === 0 ? valveP.clone().add(V(0, 0.3, 0)) : buttons[EVENTS[ev].tank].g.position.clone();
    else if (phase === 'plant' && plantVac) tgt = plantVac.getWorldPosition(V(0, 0, 0));
    const late = tgt && t - lastAct > 5;
    hint.visible = !!late; clickTip.visible = !!late;
    if (late) { hint.position.copy(tgt); hint.quaternion.copy(camQ); hint.scale.setScalar(1 + 0.12 * Math.sin(t * 6)); hint.material.opacity = 0.6 + 0.4 * Math.sin(t * 6); clickTip.position.copy(tgt).add(V(0, -0.8, 0)); }
  };
}
