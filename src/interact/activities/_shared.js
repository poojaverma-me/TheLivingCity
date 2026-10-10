// Shared helpers for "Would you like to try?" activities.
// Coordination rule: several agents use this file — only ADD new exports, never change existing ones.
//
// createKit(ctx) → a per-run toolkit that tracks everything it creates so `kit.end()` cleans up perfectly:
//   scene objects, materials/geometries/textures, gsap tweens, delayed calls, sci labels, pick targets, lights.
// runActivity(ctx, build) → wraps a build(kit, api) function with replay support and a single ctx.complete().
import * as THREE from 'three';
import gsap from 'gsap';
import * as T from '../../core/textures.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const _v = new THREE.Vector3();

export function createKit(ctx) {
  const root = new THREE.Group(); root.name = 'activity';
  ctx.scene.add(root);
  const tweens = new Set(), updaters = new Set(), picks = [], labels = new Map(), owned = new Set(), fx = [], endFns = [];
  const ray = new THREE.Raycaster();
  let hovered = null;
  const dom = ctx.game?.renderer?.domElement || document.querySelector('canvas');

  const kit = {
    ctx, root, alive: true, time: 0,
    // ------------------------------------------------ objects & materials
    add(obj, parent = root) { parent.add(obj); return obj; },
    own(x) { if (x) owned.add(x); return x; },
    /** Bright self-lit material (emissive ≥ 3 blooms). */
    glow(color, intensity = 3.5, { base = null, opacity = 1, rough = 0.35, side } = {}) {
      const c = new THREE.Color(color);
      return kit.own(new THREE.MeshStandardMaterial({
        color: base != null ? base : c.clone().multiplyScalar(0.25), emissive: c, emissiveIntensity: intensity, roughness: rough, metalness: 0,
        transparent: opacity < 1, opacity, depthWrite: opacity >= 1, side: side ?? THREE.FrontSide,
      }));
    },
    /** Glossy molecule body (clearcoat miniature look) with a soft self-glow so it reads inside a hologram. */
    gloss(color, { emissive = null, ei = 0.6, rough = 0.28, opacity = 1, clearcoat = 1, metal = 0 } = {}) {
      const c = new THREE.Color(color);
      return kit.own(new THREE.MeshPhysicalMaterial({
        color: c, roughness: rough, metalness: metal, clearcoat, clearcoatRoughness: 0.12,
        emissive: emissive != null ? new THREE.Color(emissive) : c.clone().multiplyScalar(0.5), emissiveIntensity: ei,
        transparent: opacity < 1, opacity, depthWrite: opacity >= 1,
      }));
    },
    /** Unlit additive material (beams, rings, flashes). Colour can exceed 1 to bloom. */
    additive(color, opacity = 1, boost = 2.5) {
      const c = new THREE.Color(color).multiplyScalar(boost);
      return kit.own(new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    },
    /** Per-instance glowing beads: emissive is multiplied by the instance colour. */
    instGlow(geo, count, { intensity = 3.2, rough = 0.3, base = 0x111111 } = {}) {
      const m = kit.own(new THREE.MeshStandardMaterial({ color: base, emissive: 0xffffff, emissiveIntensity: intensity, roughness: rough }));
      m.onBeforeCompile = (s) => {
        s.fragmentShader = s.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#ifdef USE_COLOR\n totalEmissiveRadiance *= vColor.rgb;\n#endif');
      };
      m.customProgramCacheKey = () => 'actInstGlow';
      const mesh = new THREE.InstancedMesh(geo, m, count);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false; mesh.castShadow = false;
      const c = new THREE.Color(1, 1, 1);
      for (let i = 0; i < count; i++) { mesh.setColorAt(i, c); mesh.setMatrixAt(i, new THREE.Matrix4().makeScale(1e-3, 1e-3, 1e-3).setPosition(0, -40, 0)); }
      return mesh;
    },
    /** Instanced glowing bead chain: { mesh, set(i, pos, scale, color), hide(i), commit() }. Added to root. */
    beads(count, r = 0.05, { intensity = 3.2, detail = 1, parent = root } = {}) {
      const mesh = kit.instGlow(new THREE.IcosahedronGeometry(r, detail), count, { intensity });
      parent.add(mesh);
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), col = new THREE.Color();
      return {
        mesh, count,
        set(i, p, scale = 1, color = null) {
          s.setScalar(Math.max(1e-4, scale)); m.compose(p, q, s); mesh.setMatrixAt(i, m);
          if (color != null) mesh.setColorAt(i, col.set(color));
        },
        color(i, c) { mesh.setColorAt(i, col.set(c)); },
        hide(i) { m.makeScale(1e-3, 1e-3, 1e-3).setPosition(0, -40, 0); mesh.setMatrixAt(i, m); },
        commit() { mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; },
      };
    },
    /** Soft additive glow sprite. */
    sprite(color = 0xffffff, size = 1, opacity = 0.8) {
      const m = kit.own(new THREE.SpriteMaterial({ map: T.radialTexture(), color: new THREE.Color(color).multiplyScalar(1.6), transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
      const s = new THREE.Sprite(m); s.scale.setScalar(size); return s;
    },
    /** Canvas text on a plane (or sprite with {sprite:true}). Height in world units; width follows the text. */
    text(str, { h = 0.4, fg = '#ffffff', bg = null, font = '800 92px Montserrat, sans-serif', pad = 24, glow = 0, sprite = false, border = null, radius = 28 } = {}) {
      const c = document.createElement('canvas'); const g = c.getContext('2d');
      g.font = font; const w = Math.ceil(g.measureText(str).width) + pad * 2; const H = 128;
      c.width = w; c.height = H; g.font = font;
      if (bg) { g.fillStyle = bg; g.beginPath(); g.roundRect(2, 2, w - 4, H - 4, radius); g.fill(); }
      if (border) { g.strokeStyle = border; g.lineWidth = 6; g.beginPath(); g.roundRect(4, 4, w - 8, H - 8, radius); g.stroke(); }
      g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
      if (glow) { g.shadowColor = fg; g.shadowBlur = glow; }
      g.fillText(str, w / 2, H / 2 + 4);
      const tex = kit.own(new THREE.CanvasTexture(c)); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
      const aspect = w / H;
      if (sprite) {
        const m = kit.own(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }));
        const s = new THREE.Sprite(m); s.scale.set(h * aspect, h, 1); s.userData.aspect = aspect; s.userData.textH = h; s.userData.text = str; s.userData.fontPx = parseFloat((font.match(/(\d+(?:\.\d+)?)px/) || [0, 92])[1]); return s;
      }
      const m = kit.own(new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(h * aspect, h), m); mesh.userData.aspect = aspect; mesh.renderOrder = 6;
      mesh.userData.textH = h; mesh.userData.text = str; mesh.userData.fontPx = parseFloat((font.match(/(\d+(?:\.\d+)?)px/) || [0, 92])[1]); // for QA: on-screen size
      return mesh;
    },
    light(color, intensity, distance, pos) {
      const l = new THREE.PointLight(color, intensity, distance, 1.6); if (pos) l.position.copy(pos); root.add(l); return l;
    },
    /**
     * Holographic inset: dark translucent rounded plate + glowing frame + corner ticks + faint grid,
     * standing at `pos`, facing yaw `yaw` (radians, 0 = faces +Z).
     */
    holoPlate({ w = 6, h = 3.6, color = 0x7fdcff, pos = new THREE.Vector3(), yaw = 0, opacity = 0.94, title = null, intro = true } = {}) {
      opacity = Math.max(opacity, 0.97); // near-opaque: the city must not ghost through the glass
      // outer group keeps a stable transform (activities place content with localToWorld); the visuals unfold inside
      const outer = new THREE.Group(); outer.position.copy(pos); outer.rotation.y = yaw;
      const grp = new THREE.Group(); outer.add(grp);
      const shape = roundRect(w, h, Math.min(w, h) * 0.08);
      const plate = new THREE.Mesh(new THREE.ShapeGeometry(shape, 8), kit.own(new THREE.MeshBasicMaterial({ map: kit.own(gridTexture(color)), color: 0xffffff, transparent: true, opacity, depthWrite: false, toneMapped: false })));
      // map UVs across the plate
      const uv = plate.geometry.attributes.uv, p = plate.geometry.attributes.position;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) / w + 0.5) * (w / 1.2), (p.getY(i) / h + 0.5) * (h / 1.2));
      plate.renderOrder = 1; grp.add(plate);
      // opaque occluder card just behind the glass: N8AO's depth pre-pass skips transparent objects, so without it the
      // city behind the panel shows up as dark AO silhouettes on the glass
      const occM = kit.own(new THREE.MeshBasicMaterial({ color: 0x0b1430 })); occM.userData.keepOpaque = true;
      const occ = new THREE.Mesh(plate.geometry, occM); occ.position.z = -0.03; grp.add(occ);
      const pts = shape.getPoints(48).map((q) => new THREE.Vector3(q.x, q.y, 0.01));
      const frame = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 160, 0.035, 6, true), kit.glow(color, 3.2));
      grp.add(frame);
      const tick = kit.glow(color, 4.5);
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const a = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.07, 0.05), tick); a.position.set(sx * (w / 2 + 0.12) - sx * 0.25, sy * (h / 2 + 0.12), 0.02);
        const b = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.5, 0.05), tick); b.position.set(sx * (w / 2 + 0.12), sy * (h / 2 + 0.12) - sy * 0.25, 0.02);
        grp.add(a, b);
      }
      if (title) {
        const t = kit.text(title, { h: 0.26, fg: '#dff6ff', font: '700 64px Montserrat, sans-serif' });
        t.position.set(-w / 2 + 0.25 + (0.26 * t.userData.aspect) / 2, h / 2 - 0.25, 0.03); grp.add(t);
      }
      outer.userData.plate = plate; outer.userData.w = w; outer.userData.h = h; outer.userData.inner = grp;
      // Panel layer: the backplate ignores depth (so world props in front of or behind the panel never bleed through)
      // but writes it, and every activity object renders after it (see promote() in update) and depth-tests against it.
      // depthFunc Always (not depthTest:false, which in WebGL also disables the depth WRITE): the plate draws over
      // anything already rendered and leaves its own depth, so AO and panel contents see the plate, not the city behind.
      plate.material.depthWrite = true; plate.material.depthTest = true; plate.material.depthFunc = THREE.AlwaysDepth;
      plate.userData.layer = PANEL_LAYER - 5; plate.renderOrder = PANEL_LAYER - 5;
      root.add(outer); outer.updateMatrixWorld(true);
      if (intro) { grp.scale.set(0.001, 0.001, 1); kit.tween(grp.scale, { x: 1, y: 1, duration: 0.9, ease: 'back.out(1.4)' }); }
      return outer;
    },
    /** Projection beam (soft additive cone) from a world point up to a holo plate. */
    beam(from, to, color = 0x7fdcff, r0 = 0.08, r1 = 1.2, opacity = 0.12) {
      const len = from.distanceTo(to);
      const geo = new THREE.CylinderGeometry(r1, r0, len, 24, 1, true); geo.translate(0, len / 2, 0);
      const m = new THREE.Mesh(geo, kit.additive(color, opacity, 1.4));
      m.position.copy(from); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), _v.copy(to).sub(from).normalize());
      m.renderOrder = 2; m.userData.fx = 'beam'; root.add(m); return m;
    },
    // ------------------------------------------------ time
    tween(target, vars) { const tw = gsap.to(target, vars); tweens.add(tw); return tw; },
    from(target, vars) { const tw = gsap.from(target, vars); tweens.add(tw); return tw; },
    timeline(vars) { const tl = gsap.timeline(vars); tweens.add(tl); return tl; },
    /** Promise-based tween; never resolves after end() (so awaiting sequences just stop). */
    to(target, vars) { return new Promise((res) => { const tw = gsap.to(target, { ...vars, onComplete: () => { vars.onComplete?.(); if (kit.alive) res(); } }); tweens.add(tw); }); },
    wait(sec) { return new Promise((res) => { const d = gsap.delayedCall(sec, () => { if (kit.alive) res(); }); tweens.add(d); }); },
    later(sec, fn) { const d = gsap.delayedCall(sec, () => { if (kit.alive) fn(); }); tweens.add(d); return d; },
    onUpdate(fn) { updaters.add(fn); return () => updaters.delete(fn); },
    /** Run fn during end() (restore visibility/materials you changed on district objects). */
    onEnd(fn) { endFns.push(fn); },
    // ------------------------------------------------ labels
    label(key, text, tag, pos) { const o = labels.get(key); if (o && o.text === text && o.tag === tag) { o.src = pos; return; } labels.delete(key); labels.set(key, { key: `act:${key}`, text, tag, src: pos }); },
    /** At most this many chip labels are shown at once (the most recently added win). */
    maxLabels: 3,
    unlabel(key) { labels.delete(key); },
    clearLabels() { labels.clear(); },
    // ------------------------------------------------ picking
    /** Make object (and descendants) clickable. Returns handle {enabled, obj, hot}. onHover(bool) for custom hover feedback. */
    pick(obj, onClick, { onHover = null } = {}) {
      const h = { obj, onClick, enabled: true, onHover, hot: 0 };
      picks.push(h); return h;
    },
    unpick(h) { const i = picks.indexOf(h); if (i >= 0) picks.splice(i, 1); },
    // ------------------------------------------------ fx
    /** Particle burst (additive points). */
    burst(pos, color = 0xffffff, { count = 40, speed = 2.2, size = 0.22, life = 1.1, gravity = 0, spread = 1, dir = null } = {}) {
      const geo = new THREE.BufferGeometry();
      const P = new Float32Array(count * 3), V = [];
      for (let i = 0; i < count; i++) {
        P[i * 3] = pos.x; P[i * 3 + 1] = pos.y; P[i * 3 + 2] = pos.z;
        const v = new THREE.Vector3().randomDirection().multiplyScalar(speed * (0.35 + Math.random() * 0.65) * spread);
        if (dir) v.addScaledVector(dir, speed * (0.6 + Math.random() * 0.8));
        V.push(v);
      }
      geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
      const m = new THREE.PointsMaterial({ map: T.radialTexture(), color: new THREE.Color(color).multiplyScalar(2.2), size, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
      const pts = new THREE.Points(geo, m); pts.frustumCulled = false; root.add(pts);
      fx.push({ pts, V, age: 0, life, gravity, m });
      return pts;
    },
    /** Expanding glowing ring flash. normal = ring axis. */
    ring(pos, color = 0xffffff, { r = 0.4, to = 2.2, life = 0.8, normal = null, width = 0.05 } = {}) {
      const m = new THREE.Mesh(new THREE.TorusGeometry(1, width, 8, 64), kit.additive(color, 1, 3));
      m.position.copy(pos); m.scale.setScalar(r);
      if (normal) m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal.clone().normalize());
      else m.lookAt(ctx.camera.position);
      m.userData.fx = 'ring'; root.add(m);
      kit.tween(m.scale, { x: to, y: to, z: to, duration: life, ease: 'power2.out' });
      kit.tween(m.material, { opacity: 0, duration: life, ease: 'power1.in', onComplete: () => { root.remove(m); m.geometry.dispose(); } });
      return m;
    },
    // ------------------------------------------------ camera
    fly(target, { yaw, pitch, dist, fov = 40 }, dur = 1.6, ease = 'power2.inOut') {
      const D = Math.PI / 180;
      return ctx.rig.flyTo({ target: target.clone(), yaw: yaw * D, pitch: pitch * D, dist, fov }, dur, ease);
    },
    /** Smoothly steer the locked camera target (call every frame while following something). */
    steer(target, k = 0.06) { const r = ctx.rig; if (r.mode === 'flight') return; r.goal.target.lerp(target, k); },
    // ------------------------------------------------ per-frame
    update(dt, t) {
      kit.time = t;
      promote(root);
      // picking: hover
      const inp = ctx.input; const cam = ctx.camera;
      let hit = null;
      const live = picks.filter((p) => p.enabled && p.obj.visible && p.obj.parent);
      if (live.length) {
        ray.setFromCamera(inp.pointer, cam);
        const hits = ray.intersectObjects(live.map((p) => p.obj), true);
        if (hits.length) hit = live.find((p) => isAncestor(p.obj, hits[0].object)) || null;
      }
      if (hit !== hovered) {
        if (hovered?.onHover) hovered.onHover(false);
        if (hit?.onHover) hit.onHover(true);
        if (hit) ctx.sfx('ui_hover', { volume: 0.35 });
        hovered = hit;
        if (dom) dom.style.cursor = hit ? 'pointer' : '';
      }
      for (const p of picks) p.hot += ((p === hovered ? 1 : 0) - p.hot) * Math.min(1, dt * 12);
      // picking: clicks
      for (const c of inp.clicks) {
        if (!live.length) break;
        ray.setFromCamera(c, cam);
        const hits = ray.intersectObjects(live.map((p) => p.obj), true);
        const h = hits.length ? live.find((p) => isAncestor(p.obj, hits[0].object)) : null;
        if (h && h.enabled) { h.onClick(); break; }
      }
      // fx
      for (let i = fx.length - 1; i >= 0; i--) {
        const f = fx[i]; f.age += dt; const a = f.age / f.life;
        const P = f.pts.geometry.attributes.position;
        for (let k = 0; k < f.V.length; k++) {
          const v = f.V[k]; v.multiplyScalar(1 - dt * 1.6); v.y -= f.gravity * dt;
          P.setXYZ(k, P.getX(k) + v.x * dt, P.getY(k) + v.y * dt, P.getZ(k) + v.z * dt);
        }
        P.needsUpdate = true; f.m.opacity = Math.max(0, 1 - a) ** 1.5;
        if (a >= 1) { root.remove(f.pts); f.pts.geometry.dispose(); f.m.dispose(); fx.splice(i, 1); }
      }
      for (const fn of updaters) fn(dt, t);
      // labels
      const list = [];
      const all = [...labels.values()];
      for (const l of all.slice(Math.max(0, all.length - kit.maxLabels))) {
        const src = typeof l.src === 'function' ? l.src() : l.src?.isObject3D ? l.src.getWorldPosition(new THREE.Vector3()) : l.src;
        if (src) list.push({ key: l.key, text: l.text, tag: l.tag, pos: src });
      }
      ctx.ui.sciLabels(list, cam);
      deconflict(ctx, list, root, cam);
    },
    end() {
      if (!kit.alive) return;
      kit.alive = false;
      for (const tw of tweens) tw.kill(); tweens.clear();
      for (const fn of endFns.splice(0)) { try { fn(); } catch (e) { console.error(e); } }
      updaters.clear(); picks.length = 0; labels.clear();
      ctx.ui.sciLabels([], ctx.camera);
      if (dom) dom.style.cursor = '';
      root.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.isPointLight) o.intensity = 0; });
      for (const f of fx) f.m.dispose(); fx.length = 0;
      for (const x of owned) x.dispose?.(); owned.clear();
      root.removeFromParent();
    },
  };
  return kit;
}

/** All activity objects render in a layer above the world (renderOrder ≥ PANEL_LAYER, transparent pass), so holo
 *  backplates can cover world geometry and activity content still depth-sorts normally against them. */
const PANEL_LAYER = 60;
function promote(root) {
  root.traverse((o) => {
    if (o.userData.layer === undefined) { o.userData.layer = PANEL_LAYER + (o.renderOrder || 0); }
    if (o.renderOrder !== o.userData.layer) o.renderOrder = o.userData.layer;
    const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : null;
    if (mats) for (const m of mats) if (!m.transparent && !m.userData.keepOpaque) { m.transparent = true; m.needsUpdate = true; }
  });
}

/**
 * Screen-space tidy-up for the DOM chip labels, run after ui.sciLabels() each frame:
 *  - a chip whose box would sit over the left activity panel (or off-screen) is hidden;
 *  - chips are nudged upward until they clear earlier chips and any visible 3D text of the activity.
 */
const _c = new THREE.Vector3(), _r = new THREE.Vector3(), _u = new THREE.Vector3();
function textRects(root, cam) {
  const W = innerWidth, H = innerHeight, out = [];
  _r.setFromMatrixColumn(cam.matrixWorld, 0); _u.setFromMatrixColumn(cam.matrixWorld, 1);
  root.traverse((o) => {
    if (!o.userData.textH) return;
    for (let q = o; q; q = q.parent) if (!q.visible || q.scale.x < 1e-3) return;
    if ((o.material?.opacity ?? 1) < 0.15) return;
    let xs = [], ys = [];
    const push = (v) => { v.project(cam); if (v.z > 1) return; xs.push((v.x * 0.5 + 0.5) * W); ys.push((-v.y * 0.5 + 0.5) * H); };
    if (o.isSprite) {
      const s = o.getWorldScale(new THREE.Vector3()); o.getWorldPosition(_c);
      for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) push(_c.clone().addScaledVector(_r, a * s.x / 2).addScaledVector(_u, b * s.y / 2));
    } else {
      const p = o.geometry?.parameters; if (!p) return;
      for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) push(new THREE.Vector3(a * p.width / 2, b * p.height / 2, 0).applyMatrix4(o.matrixWorld));
    }
    if (xs.length === 4) out.push({ l: Math.min(...xs), r: Math.max(...xs), t: Math.min(...ys), b: Math.max(...ys) });
  });
  return out;
}
function deconflict(ctx, list, root, cam) {
  const els = ctx.ui.sciEls; if (!els || !list.length) return;
  const panel = document.querySelector('.activity')?.getBoundingClientRect();
  const W = innerWidth, H = innerHeight, M = 6;
  const obstacles = textRects(root, cam);
  const hit = (a, b) => a.l < b.r + M && a.r > b.l - M && a.t < b.b + M && a.b > b.t - M;
  for (const l of list) {
    const el = els.get(l.key); if (!el || el.style.opacity === '0') continue;
    let r = el.getBoundingClientRect(); const box = { l: r.left, r: r.right, t: r.top, b: r.bottom };
    if (panel && hit(box, { l: panel.left, r: panel.right, t: panel.top, b: panel.bottom })) { el.style.opacity = 0; continue; }
    let dy = 0;
    for (let k = 0; k < 8; k++) {
      const o = obstacles.find((q) => hit(box, q)); if (!o) break;
      const step = box.b - o.t + M + 1; box.t -= step; box.b -= step; dy += step;
    }
    if (box.t < 8 || box.l < 8 || box.r > W - 8 || box.b > H - 8 || (panel && hit(box, { l: panel.left, r: panel.right, t: panel.top, b: panel.bottom }))) { el.style.opacity = 0; continue; }
    if (dy) el.style.top = `${parseFloat(el.style.top) - dy}px`;
    obstacles.push(box);
  }
}

function isAncestor(a, o) { while (o) { if (o === a) return true; o = o.parent; } return false; }

function roundRect(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

function gridTexture(color) {
  const S = 128; const c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#0b1430'; g.fillRect(0, 0, S, S);
  const col = new THREE.Color(color);
  g.strokeStyle = `rgba(${(col.r * 255) | 0},${(col.g * 255) | 0},${(col.b * 255) | 0},0.16)`; g.lineWidth = 2;
  g.strokeRect(0, 0, S, S);
  g.strokeStyle = `rgba(${(col.r * 255) | 0},${(col.g * 255) | 0},${(col.b * 255) | 0},0.06)`; g.lineWidth = 1;
  for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(k * 32, 0); g.lineTo(k * 32, S); g.moveTo(0, k * 32); g.lineTo(S, k * 32); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Run an activity with replay. build(kit, api) sets everything up (may be async) and may return an update fn.
 * api.finish(html) → shows the success state (progress 100 %, Play again / Finish buttons) and calls ctx.complete() once.
 */
export function runActivity(ctx, build) {
  let kit = null, upd = null, completed = false, gen = 0;
  const NOTE = '<div style="margin-top:6px;font:italic 500 11.5px Inter;color:#7a8096">Slowed down and simplified so you can see each step.</div>';
  const launch = (replay = false) => {
    const my = ++gen;
    kit = createKit(ctx); upd = null;
    const api = {
      replay,
      note: replay ? '' : NOTE,
      goal: (html, withNote = false) => ctx.panel.setGoal(html + (withNote && !replay ? NOTE : '')),
      progress: (f, label) => ctx.panel.setProgress(f, label),
      buttons: (list) => ctx.panel.buttons(list),
      finish(html) {
        ctx.panel.setGoal(html);
        ctx.panel.setProgress(1, 'Complete!');
        if (!completed) { completed = true; ctx.complete(); } else ctx.sfx('success_flourish');
        ctx.panel.buttons([
          { label: '↻ Play again', onClick: () => { ctx.game?.director?.clear?.(); kit.end(); launch(true); } },
          { label: 'Finish ✓', solid: true, onClick: () => ctx.exit() },
        ]);
      },
    };
    Promise.resolve(build(kit, api)).then((u) => { if (my === gen && typeof u === 'function') upd = u; }).catch((e) => console.error(e));
  };
  launch(false);
  return {
    update(dt, t) { if (!kit?.alive) return; upd?.(dt, t); kit.update(dt, t); },
    end() { gen++; kit?.end(); },
    get kit() { return kit; },
  };
}

/** Ease helpers. */
export const smooth = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };

// ---------------------------------------------------------------------------------------------
// Added for mitochondria / golgi / ser / lysosomes / vacuoles activities (add-only section).

/** District anchors (userData.anchors of the world part named `groupName`) → { name: Vector3 }. */
export function anchorsOf(ctx, groupName) {
  const out = {};
  const part = ctx.world?.parts?.find((p) => p.name === groupName) || ctx.scene.getObjectByName(groupName);
  const a = part?.userData?.anchors || {};
  for (const [k, v] of Object.entries(a)) if (Array.isArray(v)) out[k] = new THREE.Vector3(v[0], v[1], v[2]); else if (v?.isVector3) out[k] = v.clone();
  return out;
}

/**
 * Camera pose (for ctx.rig.flyTo) that puts world point `center` at screen offset (sx, sy) in NDC
 * (+x right, +y up) — e.g. sx ≈ 0.16 keeps the subject clear of the left activity panel. Angles in degrees.
 */
export function framePose(ctx, center, { yaw, pitch, dist, fov = 40, sx = 0.16, sy = 0.05 }) {
  const D = Math.PI / 180, y = yaw * D, p = pitch * D;
  const aspect = ctx.camera?.aspect || (innerWidth / innerHeight);
  const h = dist * Math.tan((fov * D) / 2), w = h * aspect;
  const right = new THREE.Vector3(Math.cos(y), 0, -Math.sin(y));
  const up = new THREE.Vector3(-Math.sin(y) * Math.sin(p), Math.cos(p), -Math.cos(y) * Math.sin(p));
  const target = center.clone().addScaledVector(right, -sx * w).addScaledVector(up, -sy * h);
  return { target, yaw: y, pitch: p, dist, fov };
}

/** Promise-free tween of a point along a smooth path (array of Vector3). onPos(v) each step. Returns the gsap tween. */
export function tweenAlong(kit, pts, { duration = 1, ease = 'power1.inOut', delay = 0, onPos, onComplete } = {}) {
  const curve = pts.length > 2 ? new THREE.CatmullRomCurve3(pts, false, 'centripetal') : new THREE.LineCurve3(pts[0], pts[1]);
  const o = { t: 0 }, v = new THREE.Vector3();
  onPos?.(curve.getPoint(0, v));
  return kit.tween(o, { t: 1, duration, ease, delay, onUpdate: () => onPos?.(curve.getPoint(o.t, v)), onComplete });
}

/**
 * Stylised two-subunit ribosome (glossy, translucent, fresnel rim) in its own group.
 * Local frame: subunit interface (where the mRNA runs) at y = 0, large subunit above, small below, exit tunnel at the top.
 * Returns { group, small, large, tunnelTop: Vector3 (local) }. Units: ~1.6 wide at scale 1.
 */
export function makeRibosome(kit, { scale = 1, small = 0xff7cc0, large = 0xd8489c, opacity = 0.55 } = {}) {
  const group = new THREE.Group();
  const lump = (parts, mat) => {
    const g = new THREE.Group();
    for (const [x, y, z, sx, sy, sz] of parts) { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 36, 22), mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); g.add(m); }
    return g;
  };
  const rim = (m, c) => { const prev = m.onBeforeCompile; m.onBeforeCompile = (s, r) => { prev?.(s, r); s.fragmentShader = s.fragmentShader.replace('#include <opaque_fragment>', `{ float ndv = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0); outgoingLight += vec3(${c.r.toFixed(3)}, ${c.g.toFixed(3)}, ${c.b.toFixed(3)}) * pow(1.0 - ndv, 2.2) * 1.3; }\n#include <opaque_fragment>`); }; m.customProgramCacheKey = () => 'actRiboRim' + c.getHexString(); return m; };
  const sm = rim(kit.gloss(small, { ei: 0.5, opacity: Math.min(1, opacity + 0.12), rough: 0.2 }), new THREE.Color(0xffd6f2));
  const lm = rim(kit.gloss(large, { ei: 0.4, opacity, rough: 0.2 }), new THREE.Color(0xffc8ee));
  sm.depthWrite = false; lm.depthWrite = false;
  const s = lump([[0, -0.3, 0, 0.82, 0.24, 0.44], [-0.5, -0.24, 0.04, 0.3, 0.2, 0.32], [0.52, -0.27, 0, 0.28, 0.19, 0.3]], sm);
  const l = lump([[0, 0.42, 0, 0.88, 0.5, 0.5], [-0.72, 0.6, 0, 0.26, 0.24, 0.26], [0.7, 0.62, 0.03, 0.24, 0.22, 0.24], [0.04, 0.82, 0, 0.46, 0.24, 0.34]], lm);
  s.renderOrder = 4; l.renderOrder = 5;
  group.add(s, l);
  group.scale.setScalar(scale);
  return { group, small: s, large: l, tunnelTop: new THREE.Vector3(-0.15, 1.02, 0.05) };
}

// ---------------------------------------------------------------------------------------------
// Added for ser / lysosomes / vacuoles activities (add-only section).

/**
 * Merge the plain meshes under `group` that share a material into one mesh per material (fewer draw calls for
 * bead-and-stick molecules). Sprites, instanced meshes, meshes with `userData.keep` and invisible proxies are left alone.
 * Call after the group is fully built and before animating its parts individually. Returns the group.
 */
export function mergeByMaterial(group) {
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const byMat = new Map();
  group.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || o.userData.keep || Array.isArray(o.material) || o.material.visible === false) return;
    if (!byMat.has(o.material)) byMat.set(o.material, []);
    byMat.get(o.material).push(o);
  });
  for (const [mat, list] of byMat) {
    if (list.length < 2) continue;
    const geos = list.map((m) => {
      let g = m.geometry.clone();
      if (g.index) g = g.toNonIndexed();
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
      return g;
    });
    const merged = mergeGeometries(geos, false);
    geos.forEach((g) => g.dispose());
    if (!merged) continue;
    for (const m of list) { m.removeFromParent(); m.geometry.dispose(); }
    const mesh = new THREE.Mesh(merged, mat); mesh.renderOrder = list[0].renderOrder; group.add(mesh);
  }
  return group;
}
