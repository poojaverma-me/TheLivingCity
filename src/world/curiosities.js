// Curiosity exhibits: small hand-made props for the 24 hidden discoveries that the districts don't
// already provide, auto-placed on free ground near their district. Publishes world-space anchors
// (curiosity id → [x,y,z]) used by the game to place interactables + sparkles.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { NUCLEUS, insideCell } from './layout.js';
import { membranePoint } from './membrane.js';
import * as M from '../core/materials.js';
import * as T from '../core/textures.js';
import { CollisionWorld } from '../player/collision.js';
import { bakeStatic } from '../core/geom.js';

const D = Math.PI / 180;
const N = NUCLEUS, PH = NUCLEUS.plinthH;

function sign(text, w = 1.6, h = 0.42, bg = '#1d2a55', fg = '#ffffff') {
  const tex = T.signTexture(text, { bg, fg, w: 512, h: Math.round(512 * h / w), font: `800 ${Math.round(150 * h / w * 1.9)}px Montserrat, sans-serif` });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.35, roughness: 0.5 }));
  return m;
}
function post(h = 1.3) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, h, 8), M.metal(0x8b929c, 0.35)); p.position.y = h / 2; p.castShadow = true; return p; }
function signPost(text, h = 1.25, w = 1.5) {
  const g = new THREE.Group(); g.add(post(h));
  const s = sign(text, w, 0.36); s.position.set(0, h + 0.05, 0.03); g.add(s);
  const back = new THREE.Mesh(new RoundedBoxGeometry(w + 0.08, 0.44, 0.05, 2, 0.02), M.satin(0x2b3150, { rough: 0.4, key: 'signBack' }));
  back.position.set(0, h + 0.05, -0.01); g.add(back);
  return g;
}
function shadowed(g) { g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); return g; }

// ------------------------------------------------------------------ props
const PROPS = {
  food_truck() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new RoundedBoxGeometry(2.3, 1.15, 1.1, 3, 0.18), M.satin(0xfff3df, { rough: 0.35, clearcoat: 0.8, key: 'truckCream' }));
    body.position.y = 0.85; g.add(body);
    const cab = new THREE.Mesh(new RoundedBoxGeometry(0.75, 0.8, 1.05, 3, 0.16), M.satin(0xe8503a, { rough: 0.35, clearcoat: 0.9, key: 'truckRed' }));
    cab.position.set(1.4, 0.7, 0); g.add(cab);
    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.32), M.glass(0x9fd6ff, 0.6)); win.position.set(1.78, 0.85, 0); win.rotation.y = Math.PI / 2; g.add(win);
    for (const [x, z] of [[-0.75, 0.56], [0.75, 0.56], [1.4, 0.56], [-0.75, -0.56], [0.75, -0.56], [1.4, -0.56]]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.16, 18), M.matte(0x22252c, 0.6)); w.rotation.x = Math.PI / 2; w.position.set(x, 0.22, z); g.add(w);
    }
    // serving hatch + awning + counter
    const hatch = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.5), M.emissive(0xffe2a8, 1.4, 0x3a2a1a)); hatch.position.set(-0.15, 1.0, 0.56); g.add(hatch);
    const awn = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.04, 0.5), M.satin(0xe8503a, { rough: 0.5, key: 'awnRed' })); awn.position.set(-0.15, 1.36, 0.78); awn.rotation.x = 0.25; g.add(awn);
    // ribosome on the roof: small + large subunit
    const large = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 16), M.satin(0xd8452f, { rough: 0.3, clearcoat: 1, key: 'riboL' })); large.scale.set(1.15, 0.85, 1); large.position.set(-0.3, 1.72, 0); g.add(large);
    const small = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 16), M.satin(0xf08a5a, { rough: 0.3, clearcoat: 1, key: 'riboS' })); small.scale.set(1.2, 0.7, 1); small.position.set(-0.3, 2.12, 0); small.userData.dynamic = true; g.add(small);
    const menu = sign('FREE RIBOSOME · CYTOSOLIC PROTEINS', 1.9, 0.26, '#e8503a'); menu.position.set(-0.15, 1.52, 0.58); g.add(menu);
    g.userData.update = (t) => { small.position.y = 2.12 + Math.sin(t * 2) * 0.03; };
    return g;
  },
  kinesin_walker() {
    // Kinesin: two motor heads stepping hand-over-hand along a microtubule, coiled-coil stalk, cargo vesicle.
    const g = new THREE.Group();
    const L = 4.6, Y = 0.95;
    const plinth = new THREE.Mesh(new RoundedBoxGeometry(L + 0.8, 0.3, 1.5, 2, 0.08), M.satin(0x2b3356, { rough: 0.35, clearcoat: 0.8, key: 'console' })); plinth.position.y = 0.15; g.add(plinth);
    for (const x of [-L / 2 + 0.25, L / 2 - 0.25]) { const p2 = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, Y - 0.3, 10), M.metal()); p2.position.set(x, 0.3 + (Y - 0.3) / 2, 0); g.add(p2); }
    // microtubule: 13 protofilaments of alternating α/β tubulin beads
    const beadGeo = new THREE.SphereGeometry(0.055, 8, 6);
    const aM = [], bM = [];
    const step = 0.105;
    for (let k = 0; k * step < L; k++) for (let f = 0; f < 13; f++) {
      const ang = (f / 13) * Math.PI * 2 + k * 0.05;
      const m = new THREE.Matrix4().makeTranslation(-L / 2 + k * step, Y + Math.sin(ang) * 0.2, Math.cos(ang) * 0.2);
      ((k + f) % 2 ? aM : bM).push(m);
    }
    for (const [list, col] of [[aM, 0x8fdca0], [bM, 0xe3fbe8]]) {
      const im = new THREE.InstancedMesh(beadGeo, M.satin(col, { rough: 0.4, key: `tub${col}` }), list.length);
      list.forEach((m, i) => im.setMatrixAt(i, m)); im.computeBoundingSphere(); g.add(im);
    }
    const walker = new THREE.Group(); walker.userData.dynamic = true; g.add(walker);
    const headMat = M.satin(0xffa63d, { rough: 0.3, clearcoat: 0.8, key: 'kinHead' });
    const lobeMat = M.satin(0xffd27a, { rough: 0.3, clearcoat: 0.8, key: 'kinLobe' });
    const mkHead = () => {
      const h = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.2, 20, 14), headMat); body.scale.set(1.25, 0.85, 0.95); h.add(body);
      const lobe = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10), lobeMat); lobe.position.set(0.12, 0.12, 0); h.add(lobe);
      walker.add(h); return h;
    };
    const heads = [mkHead(), mkHead()];
    const necks = [0, 1].map(() => { const n = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1, 8), lobeMat); walker.add(n); return n; });
    // coiled-coil stalk (two intertwined strands) to the cargo
    for (const ph of [0, Math.PI]) {
      const pts = []; for (let i = 0; i <= 30; i++) { const u = i / 30; pts.push(new THREE.Vector3(Math.cos(u * 14 + ph) * 0.07, Y + 0.62 + u * 1.05, Math.sin(u * 14 + ph) * 0.07)); }
      walker.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.035, 6), M.satin(0xffd27a, { rough: 0.4, key: 'kinStalk' })));
    }
    const vesMat = new THREE.MeshPhysicalMaterial({ color: 0xb58cff, roughness: 0.15, clearcoat: 1, transparent: true, opacity: 0.55, iridescence: 0.5 });
    const ves = new THREE.Mesh(new THREE.SphereGeometry(0.55, 28, 20), vesMat); ves.position.y = Y + 2.15; walker.add(ves);
    const cargo = new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.32, 0.32, 2, 0.05), M.emissive(0xffc36b, 1.6, 0x6a4010)); cargo.position.y = Y + 2.15; walker.add(cargo);
    const s = signPost('KINESIN · WALKS 8 nm PER STEP', 1.15, 2.0); s.position.set(0, 0, 1.2); g.add(s);
    const hip = new THREE.Vector3(0, Y + 0.6, 0);
    g.userData.update = (t) => {
      const span = L - 1.6, ph = (t * 0.7 / span) % 2, x = (ph < 1 ? ph : 2 - ph) * span - span / 2; // 0.7 u/s = stride × step rate
      walker.position.x = x; walker.rotation.y = ph < 1 ? 0 : Math.PI;
      // hand-over-hand: one head stays planted (fixed in the world while the body advances), the other
      // swings from behind to in front. Stride 0.44u per half-cycle matches the body's travel.
      const cyc = (t * 1.6) % 2, k = Math.floor(cyc), u = cyc - k, e = u * u * (3 - 2 * u);
      for (let i = 0; i < 2; i++) {
        const moving = i === k;
        const lx = moving ? -0.22 + e * 0.44 : 0.22 - u * 0.44;
        heads[i].position.set(lx, Y + 0.25 + (moving ? Math.sin(e * Math.PI) * 0.3 : 0), i ? 0.06 : -0.06);
        heads[i].rotation.z = moving ? -Math.sin(e * Math.PI) * 0.5 : 0;
        const nk = necks[i]; const mid = heads[i].position.clone().add(hip).multiplyScalar(0.5);
        nk.position.copy(mid); nk.scale.y = heads[i].position.distanceTo(hip);
        nk.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), hip.clone().sub(heads[i].position).normalize());
      }
      ves.position.y = cargo.position.y = Y + 2.15 + Math.sin(t * 3.2) * 0.03;
      cargo.rotation.y = t * 0.6;
    };
    return g;
  },
  cytoskeleton_cables() {
    const g = new THREE.Group();
    const pts = [-3, 0, 3];
    for (const x of pts) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 2.6, 8), M.metal(0x9aa2ad, 0.3)); p.position.set(x, 1.3, 0); g.add(p); }
    const mat = M.satin(0xe2577a, { rough: 0.35, clearcoat: 0.8, key: 'actin' });
    for (let k = 0; k < 3; k++) {
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-3, 2.4 - k * 0.5, 0), new THREE.Vector3(0, 2.3 - k * 0.5, 0.05), new THREE.Vector3(3, 2.4 - k * 0.5, 0)]);
      const c = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.045, 6), mat); g.add(c);
      for (let i = 0; i < 40; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), mat); b.position.copy(curve.getPoint(i / 40)); b.position.z += Math.sin(i * 1.6) * 0.04; b.position.y += Math.cos(i * 1.6) * 0.04; g.add(b); }
    }
    const s = signPost('ACTIN CABLES · CYTOSKELETON', 1.0, 1.9); s.position.set(0, 0, 0.8); g.add(s);
    return g;
  },
  atp_counter() {
    const g = new THREE.Group();
    for (const x of [-1, 1]) { const p = post(2.2); p.position.x = x; g.add(p); }
    const c = document.createElement('canvas'); c.width = 512; c.height = 256; const ctx = c.getContext('2d');
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.1), new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 1.8 }));
    scr.position.set(0, 2.25, 0.04); g.add(scr);
    const frame = new THREE.Mesh(new RoundedBoxGeometry(2.4, 1.3, 0.12, 2, 0.05), M.satin(0x2b2f3d, { rough: 0.4, metal: 0.3, key: 'boardFrame' }));
    frame.position.set(0, 2.25, -0.04); g.add(frame);
    let n = 0, last = -1;
    g.userData.update = (t) => {
      if (Math.floor(t * 8) === last) return; last = Math.floor(t * 8);
      n += 137 + Math.floor(Math.random() * 40);
      ctx.fillStyle = '#0d1a10'; ctx.fillRect(0, 0, 512, 256);
      ctx.fillStyle = '#ffcc4d'; ctx.font = '800 30px Montserrat, sans-serif'; ctx.fillText('ATP RECYCLED TODAY', 26, 52);
      ctx.fillStyle = '#7dffa0'; ctx.font = '700 74px monospace'; ctx.fillText(String(n).padStart(9, '0'), 26, 140);
      ctx.fillStyle = '#d8ffe0'; ctx.font = '500 22px Inter, sans-serif'; ctx.fillText('≈ your body weight of ATP, every day', 26, 200);
      tex.needsUpdate = true;
    };
    return g;
  },
  receptor_antenna() {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 0.5, 18), M.satin(0x7a4fd0, { rough: 0.3, clearcoat: 1, key: 'recBase' })); base.position.y = 0.25; g.add(base);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 1.6, 12), M.satin(0x9b6ef0, { rough: 0.3, clearcoat: 1, key: 'recStem' })); stem.position.y = 1.2; g.add(stem);
    const tips = [];
    for (const s of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.1, 10), M.satin(0x9b6ef0, { rough: 0.3, clearcoat: 1, key: 'recStem' }));
      arm.position.set(s * 0.35, 2.35, 0); arm.rotation.z = -s * 0.55; g.add(arm);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), M.emissive(0x6ff2ff, 3.5)); tip.position.set(s * 0.68, 2.82, 0); tip.userData.dynamic = true; g.add(tip); tips.push(tip);
    }
    const lig = new THREE.Mesh(new THREE.IcosahedronGeometry(0.18, 1), M.emissive(0xffd25e, 3)); lig.userData.dynamic = true; g.add(lig);
    const s = signPost('RECEPTOR · SIGNAL IN', 1.0, 1.5); s.position.set(1.4, 0, 0.3); g.add(s);
    g.userData.update = (t) => {
      const k = (Math.sin(t * 0.8) * 0.5 + 0.5);
      lig.position.set(0, 3.6 - k * 0.7, 0.2); lig.rotation.y = t;
      tips.forEach((tp) => { tp.material.emissiveIntensity = 2 + k * 3; });
    };
    return g;
  },
  peroxisome() {
    const g = new THREE.Group();
    const shell = new THREE.Mesh(new THREE.SphereGeometry(1.1, 32, 24), M.satin(0xd9e88a, { rough: 0.18, clearcoat: 1, key: 'peroxShell' }));
    shell.material.transparent = true; shell.material.opacity = 0.55; shell.material.depthWrite = false; shell.position.y = 1.25; g.add(shell);
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), M.emissive(0xfff27a, 3.2, 0x8a7a10)); core.position.y = 1.25; core.userData.dynamic = true; g.add(core);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.08, 10, 48), M.satin(0xb8c45a, { rough: 0.3, key: 'peroxRing' })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.5; g.add(ring);
    const legGeo = new THREE.CylinderGeometry(0.05, 0.07, 0.6, 8);
    for (let k = 0; k < 3; k++) { const l = new THREE.Mesh(legGeo, M.metal()); const a = k * 2.094; l.position.set(Math.cos(a) * 0.8, 0.3, Math.sin(a) * 0.8); g.add(l); }
    const s = signPost('PEROXISOME · H₂O₂ → H₂O', 1.0, 1.6); s.position.set(1.6, 0, 0.5); g.add(s);
    g.userData.update = (t) => { core.rotation.y = t * 0.7; core.rotation.x = t * 0.4; };
    return g;
  },
  apoptosis_switch() {
    const g = new THREE.Group();
    const ped = new THREE.Mesh(new RoundedBoxGeometry(0.8, 1.0, 0.8, 3, 0.08), M.satin(0x30343f, { rough: 0.35, metal: 0.4, key: 'pedDark' })); ped.position.y = 0.5; g.add(ped);
    const stripes = document.createElement('canvas'); stripes.width = 128; stripes.height = 32; const x = stripes.getContext('2d');
    for (let i = -2; i < 12; i++) { x.fillStyle = i % 2 ? '#ffcc00' : '#1a1a1a'; x.beginPath(); x.moveTo(i * 16, 32); x.lineTo(i * 16 + 16, 0); x.lineTo(i * 16 + 32, 0); x.lineTo(i * 16 + 16, 32); x.fill(); }
    const st = new THREE.CanvasTexture(stripes); st.colorSpace = THREE.SRGBColorSpace;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 0.12, 4, 1, true), new THREE.MeshStandardMaterial({ map: st, roughness: 0.5 })); band.rotation.y = Math.PI / 4; band.position.y = 0.93; g.add(band);
    const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.12, 24), M.emissive(0xff2a2a, 2.5, 0x6a0000)); btn.position.y = 1.07; g.add(btn);
    const glass = new THREE.Mesh(new THREE.SphereGeometry(0.34, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.glass(0xe8f4ff, 0.25)); glass.position.y = 1.0; g.add(glass);
    const s = signPost('DO NOT PRESS · APOPTOSIS', 1.6, 1.6); s.position.set(0, 0, -0.6); g.add(s);
    g.userData.update = (t) => { btn.material.emissiveIntensity = 1.8 + Math.max(0, Math.sin(t * 3)) * 2; };
    return g;
  },
  nuclear_pore() {
    const g = new THREE.Group();
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 0.8, 24), M.satin(0x3b3552, { rough: 0.3, metal: 0.4, key: 'holoT' })); ped.position.y = 0.4; g.add(ped);
    const pore = new THREE.Group(); pore.position.y = 1.6; pore.rotation.x = -0.5; pore.userData.dynamic = true; g.add(pore);
    pore.add(new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.16, 14, 40), M.satin(0xc9a8ff, { rough: 0.25, clearcoat: 1, key: 'npcRing' })));
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; const sub = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), M.satin(0x8a5ae0, { rough: 0.3, clearcoat: 1, key: 'npcSub' })); sub.position.set(Math.cos(a) * 0.75, Math.sin(a) * 0.75, 0.12); pore.add(sub); }
    const basket = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.6, 8, 1, true), M.emissive(0x9fe3ff, 2.5)); basket.rotation.x = -Math.PI / 2; basket.position.z = -0.35; basket.material.wireframe = true; pore.add(basket);
    const mrna = new THREE.Mesh(new THREE.TorusKnotGeometry(0.16, 0.035, 60, 6), M.emissive(0xff8ad8, 3)); pore.add(mrna);
    const s = signPost('NUCLEAR PORE CHECKPOINT', 1.0, 1.7); s.position.set(0, 0, 0.9); g.add(s);
    g.userData.update = (t) => { mrna.position.z = Math.sin(t * 1.3) * 0.5; mrna.rotation.z = t; };
    return g;
  },
  chromatin_archive() {
    const g = new THREE.Group();
    const shelf = new THREE.Mesh(new RoundedBoxGeometry(2.4, 1.9, 0.6, 2, 0.05), M.satin(0x2b2f4a, { rough: 0.35, metal: 0.3, key: 'archive' })); shelf.position.y = 0.95; g.add(shelf);
    const spool = new THREE.CylinderGeometry(0.16, 0.16, 0.22, 16), thread = new THREE.TorusGeometry(0.17, 0.03, 6, 20);
    const sp = M.satin(0xf2d7a8, { rough: 0.4, key: 'histone' }), th = M.emissive(0xb48cff, 2.2);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) {
      const x = -1.0 + c * 0.4, y = 0.45 + r * 0.6;
      const s1 = new THREE.Mesh(spool, sp); s1.rotation.x = Math.PI / 2; s1.position.set(x, y, 0.32); g.add(s1);
      const t1 = new THREE.Mesh(thread, th); t1.position.set(x, y, 0.32); g.add(t1); t1.scale.z = 1.5;
    }
    const s = sign('CHROMATIN ARCHIVE · DNA ON HISTONES', 2.4, 0.3); s.position.set(0, 2.05, 0.31); g.add(s);
    return g;
  },
  centrosome() {
    const g = new THREE.Group();
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 0.6, 24), M.satin(0xd9dbe6, { rough: 0.25, clearcoat: 1, key: 'pedestal' })); ped.position.y = 0.3; g.add(ped);
    const mk = () => {
      const c = new THREE.Group();
      for (let k = 0; k < 9; k++) { const a = k * (Math.PI * 2 / 9); const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.9, 8), M.emissive(0x7ff0d0, 2.4, 0x0a3a30)); rod.position.set(Math.cos(a) * 0.24, 0, Math.sin(a) * 0.24); c.add(rod); }
      return c;
    };
    const a = mk(); a.position.y = 1.2; g.add(a);
    const b = mk(); b.rotation.z = Math.PI / 2; b.position.set(0.55, 1.2, 0); g.add(b);
    a.userData.dynamic = true;
    const s = signPost('CENTROSOME · MOVING-DAY DEPOT', 0.9, 1.9); s.position.set(0, 0, 0.8); g.add(s);
    g.userData.update = (t) => { a.rotation.y = t * 0.3; };
    return g;
  },
  signal_ticket() {
    const g = new THREE.Group();
    const k = new THREE.Mesh(new RoundedBoxGeometry(0.7, 1.4, 0.5, 3, 0.08), M.satin(0xf2c45a, { rough: 0.35, clearcoat: 0.8, key: 'ticketK' })); k.position.y = 0.7; g.add(k);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.3), M.emissive(0x7fe3ff, 2.2)); scr.position.set(0, 1.05, 0.26); g.add(scr);
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 0.05), M.emissive(0xffffff, 3)); slot.position.set(0, 0.7, 0.26); g.add(slot);
    const tk = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.26), M.emissive(0xffe27a, 2.5)); tk.position.set(0, 0.62, 0.29); tk.userData.dynamic = true; g.add(tk);
    const s = signPost('SIGNAL PEPTIDE TICKETS', 1.6, 1.6); s.position.set(0.9, 0, 0); g.add(s);
    g.userData.update = (t) => { tk.position.y = 0.62 - ((t * 0.5) % 1) * 0.25; tk.material.opacity = 1; };
    return g;
  },
  bip_crew() {
    const g = new THREE.Group();
    const cage = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.1, 18, 4, true), M.metal(0xc9ced6, 0.3)); cage.material.wireframe = true; cage.position.y = 0.95; g.add(cage);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.0, 24, 1, true), M.satin(0x6fd6c8, { rough: 0.3, clearcoat: 1, key: 'bipBarrel' }));
    barrel.material.side = THREE.DoubleSide; barrel.material.transparent = true; barrel.material.opacity = 0.45; barrel.position.y = 0.95; g.add(barrel);
    const chain = new THREE.Mesh(new THREE.TorusKnotGeometry(0.22, 0.06, 80, 8, 2, 5), M.emissive(0xff9a6a, 2.6)); chain.position.y = 0.95; chain.userData.dynamic = true; g.add(chain);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.75, 0.4, 24), M.satin(0x2b3356, { rough: 0.3, clearcoat: 0.8, key: 'console' })); base.position.y = 0.2; g.add(base);
    const s = signPost('BiP CHAPERONE · FOLDING STATION', 1.5, 2.0); s.position.set(0, 0, -0.9); g.add(s);
    g.userData.update = (t) => { chain.rotation.y = t * 0.8; chain.rotation.x = Math.sin(t) * 0.3; };
    return g;
  },
  grapefruit() {
    const g = new THREE.Group();
    const crate = new THREE.Mesh(new RoundedBoxGeometry(0.8, 0.5, 0.6, 2, 0.04), M.satin(0xb98a55, { rough: 0.7, key: 'crateWood' })); crate.position.y = 0.25; g.add(crate);
    const half = new THREE.Mesh(new THREE.SphereGeometry(0.32, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.satin(0xf0866a, { rough: 0.4, clearcoat: 0.6, key: 'grapefruit' })); half.position.set(0, 0.5, 0); half.rotation.x = Math.PI; g.add(half);
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.31, 24), new THREE.MeshStandardMaterial({ map: grapefruitTex(), roughness: 0.5 })); face.rotation.x = -Math.PI / 2; face.position.y = 0.51; g.add(face);
    const s = signPost('CAUTION: GRAPEFRUIT vs. P450', 1.1, 1.8); s.position.set(0, 0, -0.5); g.add(s);
    return g;
  },
  krebs_roundabout() {
    // a little traffic island: 8 glowing "stops" (the cycle's intermediates) light up in sequence
    const g = new THREE.Group();
    const island = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.35, 0.22, 40), M.satin(0xd9dde3, { rough: 0.6, key: 'curb' })); island.position.y = 0.11; g.add(island);
    const lawn = new THREE.Mesh(new THREE.CylinderGeometry(1.08, 1.08, 0.06, 40), M.matte(0x6f9a4a, 0.85)); lawn.position.y = 0.24; g.add(lawn);
    const track = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.05, 8, 48), M.emissive(0xffb54a, 2.2)); track.rotation.x = Math.PI / 2; track.position.y = 0.3; g.add(track);
    const stops = [];
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4;
      const bol = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.32, 10), M.satin(0x2b2f3d, { rough: 0.4, key: 'bollard' })); bol.position.set(Math.cos(a) * 0.85, 0.42, Math.sin(a) * 0.85); g.add(bol);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), new THREE.MeshStandardMaterial({ color: 0x331a00, emissive: 0xffd27a, emissiveIntensity: 1 })); cap.position.set(Math.cos(a) * 0.85, 0.62, Math.sin(a) * 0.85); cap.userData.dynamic = true; g.add(cap); stops.push(cap);
    }
    const p = post(1.5); p.position.y = 0.24; g.add(p);
    const s1 = sign('KREBS CYCLE · 8 STOPS', 1.5, 0.3, '#b8562a'); s1.position.set(0, 1.62, 0.04); g.add(s1);
    const s2 = s1.clone(); s2.rotation.y = Math.PI; s2.position.z = -0.04; g.add(s2);
    g.userData.update = (t) => { const k = Math.floor(t * 2) % 8; stops.forEach((c, i) => { c.material.emissiveIntensity = i === k ? 5 : 0.6; }); };
    return g;
  },
  m6p_tag() {
    const g = new THREE.Group();
    const box = new THREE.Mesh(new RoundedBoxGeometry(0.7, 0.55, 0.6, 2, 0.05), M.satin(0xf2a8c8, { rough: 0.5, key: 'parcelPink' })); box.position.y = 0.28; g.add(box);
    const tag = sign('M6P → LYSOSOME', 0.7, 0.2, '#2e6fb7'); tag.position.set(0, 0.42, 0.31); g.add(tag);
    const s = signPost('ADDRESS LABEL: MANNOSE-6-P', 1.2, 1.8); s.position.set(0.8, 0, -0.2); g.add(s);
    return g;
  },
  aquaporin() {
    const g = new THREE.Group();
    const mat = M.satin(0x5fd8e6, { rough: 0.15, clearcoat: 1, key: 'aqp' }); mat.transparent = true; mat.opacity = 0.75;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.12, 0.9, 24, 1, true), mat); top.position.y = 1.85; top.material.side = THREE.DoubleSide; g.add(top);
    const bot = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.55, 0.9, 24, 1, true), mat); bot.position.y = 0.95; g.add(bot);
    const drops = [];
    for (let k = 0; k < 4; k++) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8), M.emissive(0x9ff4ff, 2.5)); d.userData.dynamic = true; g.add(d); drops.push(d); }
    const s = signPost('AQUAPORIN · WATER CHANNEL', 1.0, 1.8); s.position.set(1.3, 0, 0.3); g.add(s);
    g.userData.update = (t) => { drops.forEach((d, k) => { const p = (t * 0.6 + k / 4) % 1; d.position.set(0, 2.3 - p * 1.8, 0); }); };
    return g;
  },
  endocytosis_gate() {
    const g = new THREE.Group();
    const pit = new THREE.Mesh(new THREE.SphereGeometry(0.9, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ map: hexTex(), roughness: 0.4, color: 0xd8f0ff, side: THREE.DoubleSide }));
    pit.rotation.x = -Math.PI / 2; pit.position.set(0, 1.3, 0); g.add(pit);
    const cargo = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), M.emissive(0xffb36b, 2.6)); cargo.userData.dynamic = true; g.add(cargo);
    const s = signPost('CLATHRIN PIT · ENDOCYTOSIS', 1.0, 1.8); s.position.set(1.4, 0, 0.6); g.add(s);
    g.userData.update = (t) => { const p = (t * 0.25) % 1; cargo.position.set(0, 1.3, 1.2 - p * 1.3); cargo.scale.setScalar(1 - p * 0.3); };
    return g;
  },
};

function grapefruitTex() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  x.fillStyle = '#f7d1b0'; x.beginPath(); x.arc(64, 64, 62, 0, 7); x.fill();
  x.fillStyle = '#ef6d5a';
  for (let k = 0; k < 10; k++) { const a = k * Math.PI / 5; x.beginPath(); x.moveTo(64, 64); x.arc(64, 64, 54, a + 0.05, a + Math.PI / 5 - 0.05); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function hexTex() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  x.fillStyle = '#cfe9ff'; x.fillRect(0, 0, 256, 256); x.strokeStyle = '#5a7fd0'; x.lineWidth = 4;
  for (let r = 0; r < 9; r++) for (let q = 0; q < 9; q++) {
    const cx = q * 30 + (r % 2) * 15, cy = r * 26; x.beginPath();
    for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3 + Math.PI / 6; x.lineTo(cx + Math.cos(a) * 15, cy + Math.sin(a) * 15); }
    x.closePath(); x.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ------------------------------------------------------------------ placement
// desired spots: [x, z] ground positions (y from ground) or {inside:'nucleus'} etc. `face` = yaw toward the visitor.
function nucPolar(r, deg) { return [N.x + Math.cos(deg * D) * r, N.z + Math.sin(deg * D) * r]; }

export function buildCuriosities(root, network) {
  const group = new THREE.Group(); group.name = 'curiosities';
  const anchors = {};
  // collision from everything built so far (to find free ground)
  const col = new CollisionWorld(); col.collectFrom(root);
  const roadD = network?.roadDist || (() => 99);
  const A = {}; root.traverse((o) => { if (o.userData?.anchors) Object.assign(A, o.userData.anchors); });
  const a3 = (k, fb) => (Array.isArray(A[k]) ? A[k] : fb);

  // [id, propKey|null, [x,z], y, opts]
  const placements = [
    ['nuclear_pore', 'nuclear_pore', nucPolar(7.2, 132), PH, { fixed: true }],
    ['chromatin_archive', 'chromatin_archive', nucPolar(7.3, 42), PH, { fixed: true, faceCenter: true, faceAway: true }],
    ['centrosome', 'centrosome', nucPolar(11.62, -90), PH, { fixed: true, faceCenter: true, scale: 0.7 }],
    ['rrna_genes', null, [N.nucleolus.x + 1.2, N.nucleolus.z + 2.0], PH, { fixed: true }],
    ['food_truck', 'food_truck', [4.5, 37], 0, {}],
    ['signal_ticket', 'signal_ticket', [a3('nucleusAvenue', [-2.6, 0, -4.3])[0] + 3.2, a3('nucleusAvenue', [-2.6, 0, -4.3])[2] + 1.5], 0, {}],
    ['bip_crew', 'bip_crew', [a3('nucleusAvenue', [-2.6, 0, -4.3])[0] - 4.2, a3('nucleusAvenue', [-2.6, 0, -4.3])[2] + 3.5], 0, {}],
    ['calcium_reservoir', null, [a3('calcium', [24.7, 1, -1.2])[0], a3('calcium', [24.7, 1, -1.2])[2]], a3('calcium', [0, 1.1])[1], { fixed: true }],
    ['grapefruit', 'grapefruit', [a3('detox', [22.8, 0, -4.3])[0] - 2.2, a3('detox', [22.8, 0, -4.3])[2] + 7.5], 0, {}],
    ['kinesin_walker', 'kinesin_walker', [3.2, 19.4], 0, { fixed: true, yaw: 0.62, footBox: 5.8 }],
    ['endocytosis_gate', 'endocytosis_gate', null, 0, { wall: 162 }],
    ['cytoskeleton_cables', 'cytoskeleton_cables', null, 0, { wall: 18, clear: 3.6 }],
    ['m6p_tag', 'm6p_tag', [a3('golgiLoadingDock', [9.8, 0, 18.3])[0] + 3.2, a3('golgiLoadingDock', [9.8, 0, 18.3])[2] + 2.5], 0, {}],
    ['cis_trans_signs', null, [a3('golgiReceiving', [7, 0, 4.4])[0], a3('golgiReceiving', [7, 0, 4.4])[2]], 0, { fixed: true }],
    ['mtdna_ring', null, [a3('mtDNA', [-21, 0, 9.4])[0], a3('mtDNA', [-21, 0, 9.4])[2]], 0.4, { fixed: true, radius: 5.5 }],
    ['krebs_roundabout', 'krebs_roundabout', [a3('mitoAEntrance', [-9.2, 0, 13.6])[0] + 1.5, a3('mitoAEntrance', [-9.2, 0, 13.6])[2] + 2.5], 0, {}],
    ['atp_counter', 'atp_counter', [a3('mitoBEntrance', [-9.4, 0, 35.2])[0] + 2.5, a3('mitoBEntrance', [-9.4, 0, 35.2])[2] + 2], 0, { clear: 1.8 }],
    ['autophagy', null, [a3('lysoIntake', [-22.4, 0.6, 6])[0], a3('lysoIntake', [-22.4, 0.6, 6])[2]], 0.6, { fixed: true }],
    ['ph_gauge', null, [a3('phGauge', [-22.9, 1.5, 3])[0], a3('phGauge', [-22.9, 1.5, 3])[2]], 1.5, { fixed: true }],
    ['rubber_duck', null, [a3('duck', [-20.5, 1, -7])[0], a3('duck', [-20.5, 1, -7])[2]], 1.2, { fixed: true, radius: 4.5 }],
    ['aquaporin', 'aquaporin', null, 0, { wall: 40 }],
    ['receptor_antenna', 'receptor_antenna', null, 0, { wall: 30 }],
    ['peroxisome', 'peroxisome', [a3('storageYard', [-21, 0, -1.4])[0] + 1, a3('storageYard', [-21, 0, -1.4])[2] + 1.5], 0, { clear: 1.6 }],
    ['apoptosis_switch', 'apoptosis_switch', [a3('backYard', [-25.6, 0, -18.6])[0] + 1.5, a3('backYard', [-25.6, 0, -18.6])[2] + 1], 0, {}],
  ];

  const radii = {};
  for (const [id, key, xz, y, o] of placements) {
    let x, z, yaw = 0;
    if (o.wall != null) {
      const p = membranePoint(o.wall * D, -(1.4 + (o.clear || 1.2)));
      x = p.x; z = p.z; yaw = Math.atan2(-p.nx, -p.nz);
    } else { [x, z] = xz; }
    if (o.line) [x, z, yaw] = findLine(col, roadD, x, z, o.line);
    else if (!o.fixed) [x, z] = findFree(col, roadD, x, z, o.clear || 1.3, o.road);
    if (o.faceCenter) yaw = Math.atan2(N.x - x, N.z - z) + (o.faceAway ? Math.PI : 0);
    if (o.yaw != null) yaw = o.yaw;
    else if (o.wall == null && !o.fixed && !o.line) yaw = Math.atan2(0 - x, 30 - z) * 0.5; // loosely face the front of the cell
    if (key && PROPS[key]) {
      const prop = bakeStatic(shadowed(PROPS[key]()));
      prop.position.set(x, y, z); prop.rotation.y = yaw; if (o.scale) prop.scale.setScalar(o.scale);
      prop.name = `curiosity:${id}`;
      group.add(prop);
      if (!o.fixed && o.wall == null) col.addFootprints([{ type: 'circle', x, z, r: (o.clear || 1.3) * 0.6 }]);
      if (o.line || o.footBox) col.addFootprints([{ type: 'box', x, z, w: o.line || o.footBox, d: 1.6, rot: yaw }]);
    }
    anchors[id] = [x, y + (key ? 0.2 : 0), z];
    if (o.radius) radii[id] = o.radius;
  }
  // footprints from prop positions before baking (baking re-parents meshes)
  const fps = group.children.filter((c) => c.name.startsWith('curiosity:') && c.position.y < 0.5).map((c) => (c.name === 'curiosity:kinesin_walker'
    ? { type: 'box', x: c.position.x, z: c.position.z, w: 5.4, d: 1.4, rot: c.rotation.y, id: c.name }
    : { type: 'circle', x: c.position.x, z: c.position.z, r: 0.55, id: c.name }));
  bakeStatic(group); // merge identical materials across all exhibits
  group.userData.curiosityAnchors = anchors;
  group.userData.curiosityRadii = radii;
  group.userData.footprints = fps;
  return group;
}

/** Place a long exhibit (length L along its local X): every point along it must be clear. Returns [x, z, yaw]. */
function findLine(col, roadD, x0, z0, L) {
  const ok = (x, z, yaw) => {
    const c = Math.cos(yaw), sn = Math.sin(yaw);
    for (let k = -3; k <= 3; k++) {
      const d = (k / 3) * (L / 2 + 0.3), px = x + c * d, pz = z - sn * d;
      if (!insideCell(px, pz, 2) || col.blockedBy(px, pz, 1.35) || roadD(px, pz) < 0.9 || col.heightAt(px, pz) > 0.05) return false;
    }
    return true;
  };
  for (let r = 0; r < 24; r += 0.5) for (let a = 0; a < Math.PI * 2; a += Math.PI / Math.max(4, r * 3)) {
    const x = x0 + Math.cos(a) * r, z = z0 + Math.sin(a) * r;
    for (const yaw of [0, Math.PI / 2, Math.PI / 4, -Math.PI / 4]) if (ok(x, z, yaw)) return [x, z, yaw];
  }
  return [x0, z0, 0];
}

function findFree(col, roadD, x0, z0, clear, roadClear = clear * 0.7) {
  for (let r = 0; r < 9; r += 0.5) for (let a = 0; a < Math.PI * 2; a += Math.PI / Math.max(4, r * 4)) {
    const x = x0 + Math.cos(a) * r, z = z0 + Math.sin(a) * r;
    if (!insideCell(x, z, 2) || col.blockedBy(x, z, clear) || roadD(x, z) < roadClear || col.heightAt(x, z) > 0.05) continue;
    return [x, z];
  }
  // nothing free nearby: widen the search rather than dropping a prop somewhere unreachable
  for (let r = 9; r < 22; r += 1) for (let a = 0; a < Math.PI * 2; a += Math.PI / 24) {
    const x = x0 + Math.cos(a) * r, z = z0 + Math.sin(a) * r;
    if (insideCell(x, z, 2) && !col.blockedBy(x, z, clear) && roadD(x, z) >= roadClear && col.heightAt(x, z) <= 0.05) return [x, z];
  }
  return [x0, z0];
}
