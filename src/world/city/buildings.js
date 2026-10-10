// Small industrial / lab buildings and raised walkway bridges for the city fabric.
// Every part is pushed into the shared Kit (merged per material, repeated parts instanced).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { BUILDINGS, BRIDGES, COL } from './plan.js';
import { trs } from '../../core/geom.js';
import { mulberry32 } from '../../core/noise.js';
import { FACADE_STRIP } from './citytex.js';
import { roadDist } from './network.js';

const ROOF = 0x9aa5b2, PLINTH = 0x5f6875, FRAME = 0x2c3038, DOOR = 0x3a404a, CONCRETE = 0xc9cdd2;
const rbox = (w, h, d, r = 0.03, s = 1) => new RoundedBoxGeometry(w, h, d, s, Math.min(r, 0.03, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));
const at = (g, x, y, z, ry = 0, rx = 0, rz = 0) => g.applyMatrix4(trs(x, y, z, rx, ry, rz));
const FACADES = [{ ang: 0, span: 'w', dep: 'd' }, { ang: Math.PI / 2, span: 'd', dep: 'w' }, { ang: Math.PI, span: 'w', dep: 'd' }, { ang: -Math.PI / 2, span: 'd', dep: 'w' }];
const STRIP = FACADE_STRIP;
const WIN_SETS = { lab: ['cool', 'tall', 'blinds'], tower: ['cool', 'blinds', 'tall', 'warm'], depot: ['industrial', 'warm'], factory: ['industrial', 'industrial', 'warm'], kiosk: ['shop', 'warm'], pump: ['industrial', 'blinds'] };

function seedOf(id) { let h = 7; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; }

/** Sign labels used by buildings & bridges (feeds the sign atlas). */
export function signEntries() {
  const e = BUILDINGS.map((b) => ({ text: b.sign, bg: b.accent }));
  e.push({ text: 'NUCLEUS', bg: 0x7a3fd0 }, { text: 'GOLGI EXPORT', bg: 0xd0508f }, { text: 'WELCOME', bg: 0x2f78e0 }, { text: 'SER  >', bg: 0x7f9a2a }, { text: '< MITO', bg: 0xe0702a }, { text: 'PORT', bg: 0x9156e0 });
  return e;
}

export function buildBuildings(kit) {
  for (const b of BUILDINGS) building(kit, b);
  for (const br of BRIDGES) bridge(kit, br);
}

/** World-placed sub-block of a composite building (local offset lx, lz in the parent's frame). */
function sub(b, lx, lz, o) {
  const c = Math.cos(b.rot), s = Math.sin(b.rot);
  return { ...b, ...o, x: b.x + lx * c + lz * s, z: b.z - lx * s + lz * c };
}

function building(kit, b) {
  const rnd = mulberry32(seedOf(b.id));
  const B = trs(b.x, b.y0 || 0, b.z, 0, b.rot, 0);
  if (b.style === 'tanks') return tankFarm(kit, b, B, rnd);
  if (b.style === 'containers') return containerStack(kit, b, B, rnd);
  if (b.style === 'silo') return roundOffice(kit, b, B, rnd);
  if (b.style === 'stepped') {
    // stepped massing: wide podium + set-back upper block
    const h1 = +(b.h * 0.55).toFixed(2);
    building(kit, sub(b, 0, 0, { id: b.id + 'a', style: 'lab', h: h1, noSign: true, noPent: true }));
    building(kit, sub(b, b.w * 0.08, -b.d * 0.14, { id: b.id + 'b', style: 'office', w: b.w * 0.62, d: b.d * 0.62, h: b.h - h1, y0: h1, noDoor: true, noPlinth: true, noFoot: true }));
    return;
  }
  if (b.style === 'lshape') {
    // L-plan: long rear block + front wing
    building(kit, sub(b, 0, -b.d * 0.22, { id: b.id + 'a', style: 'office', d: b.d * 0.56, noFoot: true, signHalf: true }));
    building(kit, sub(b, -b.w * 0.27, b.d * 0.27, { id: b.id + 'b', style: 'lab', w: b.w * 0.46, d: b.d * 0.46, h: b.h * 0.62, noSign: true, noPent: true, noFoot: true, noRoofKit: true }));
    kit.footprints.push({ type: 'box', x: b.x, z: b.z, w: b.w + 0.2, d: b.d + 0.2, rot: b.rot, id: b.id });
    return;
  }
  const P = (g, color) => kit.paint.add(g, color, B);
  const Mt = (g, color) => kit.metal.add(g, color, B);
  let { w, d, h } = b;
  const style = b.style;
  const accent = b.accent, body = b.body;
  // pump houses: body shares the plot with a tank on the +X side
  let bx = 0, bw = w;
  if (style === 'pump') { bw = w - 1.15; bx = -(w - bw) / 2; }
  const bodyH = style === 'kiosk' ? h - 0.2 : h;

  // plinth + body (crisp small bevels)
  if (!b.noPlinth) P(at(rbox(bw + 0.12, 0.24, d + 0.12, 0.03), bx, 0.12, 0), PLINTH);
  kit.walls.add(at(rbox(bw, bodyH - 0.2, d, 0.03, 1), bx, 0.2 + (bodyH - 0.2) / 2, 0), body, B, { grime: !b.y0 });
  if (!b.y0) contact(kit, b.x, b.z, b.w, b.d, b.rot);

  // facade window bands
  const set = WIN_SETS[style] || ['cool', 'blinds'];
  const winStrip = set[Math.floor(rnd() * set.length)];
  const industrial = style === 'depot' || style === 'factory';
  const floorH = style === 'tower' || style === 'office' ? 0.95 : 1.0;
  const rows = [];
  for (let y = style === 'kiosk' ? 0.95 : 0.95; y + 0.35 < bodyH - 0.25; y += floorH) rows.push(y);
  const doorW = industrial ? 0 : 0.95;
  FACADES.forEach((f, fi) => {
    const span = f.span === 'w' ? bw : d, dep = (f.dep === 'w' ? bw : d) / 2;
    const isFront = fi === 0;
    rows.forEach((y, ri) => {
      const bandH = style === 'kiosk' ? 0.85 : winStrip === 'industrial' ? 0.42 : 0.5;
      if (industrial && isFront && ri === 0) return; // roller doors there
      if (industrial && ri === 0 && rnd() < 0.5) return;
      let segs = [[-span / 2 + 0.3, span / 2 - 0.3]];
      const door = isFront && ri === 0 && doorW && !b.noDoor && !b.y0;
      if (door) segs = [[-span / 2 + 0.3, -doorW / 2 - 0.25], [doorW / 2 + 0.25, span / 2 - 0.3]];
      // ground-floor shopfronts on street faces of labs / offices / towers
      const shop = isFront && ri === 0 && !b.y0 && (style === 'lab' || style === 'office' || style === 'tower');
      for (const [s0, s1] of segs) {
        const len = s1 - s0; if (len < 0.45) continue;
        const cx = (s0 + s1) / 2;
        windowBand(kit, B, f.ang, bx, cx, y + (style === 'kiosk' ? 0.25 : shop ? -0.05 : 0), len, shop ? 0.72 : bandH, dep, shop ? 'shop' : rnd() < 0.2 ? set[Math.floor(rnd() * set.length)] : winStrip, rnd() * 4);
        if (shop) shopAwning(kit, B, bx + cx, len, dep, y + 0.42, b.accent, rnd);
      }
    });
  });

  // accent stripe & corner pilasters
  if (style === 'lab' || style === 'tower') {
    const yS = style === 'tower' ? bodyH - 0.35 : Math.min(bodyH - 0.4, 0.62);
    P(at(rbox(bw + 0.05, 0.14, d + 0.05, 0.05), bx, yS, 0), accent);
  }
  // flat corner pilasters (towers / offices) instead of round tubes
  if (style === 'tower' || style === 'office') for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    P(at(new THREE.BoxGeometry(0.2, bodyH - 0.25, 0.035), bx + sx * (bw / 2 - 0.1), 0.2 + (bodyH - 0.25) / 2, sz * (d / 2 + 0.015)), accent);
    P(at(new THREE.BoxGeometry(0.035, bodyH - 0.25, 0.2), bx + sx * (bw / 2 + 0.015), 0.2 + (bodyH - 0.25) / 2, sz * (d / 2 - 0.1)), accent);
  }
  // storey lines between floors
  if (!industrial) { const sc = new THREE.Color(body).multiplyScalar(0.86).getHex(); for (let k = 1; k < rows.length; k++) P(at(new THREE.BoxGeometry(bw + 0.03, 0.045, d + 0.03), bx, rows[k] - 0.42, 0), sc); }
  // a few balconies on upper floors of towers / offices
  if ((style === 'tower' || style === 'office') && rows.length > 2) for (let k = 1; k < rows.length; k += 2) {
    if (rnd() < 0.35) continue;
    const bwid = Math.min(1.3, bw * 0.5), yb = rows[k] - 0.3, cx = bx + (rnd() - 0.5) * (bw - bwid) * 0.6;
    P(at(new THREE.BoxGeometry(bwid, 0.06, 0.42), cx, yb, d / 2 + 0.21), 0xe6e9ed);
    Mt(at(new THREE.BoxGeometry(bwid, 0.03, 0.03), cx, yb + 0.3, d / 2 + 0.41), 0xd8dde3);
    for (let q = 0; q <= 4; q++) Mt(at(new THREE.BoxGeometry(0.018, 0.3, 0.018), cx - bwid / 2 + 0.02 + q * (bwid - 0.04) / 4, yb + 0.15, d / 2 + 0.41), 0xb9c0c8);
    kit.windows.add(Object.assign(new THREE.PlaneGeometry(bwid - 0.04, 0.26), {}).translate(cx, yb + 0.16, d / 2 + 0.415), B);
  }

  // roof
  const top = bodyH;
  if (industrial) {
    if (style === 'factory') {
      // sawtooth north-light roof + chimneys
      P(at(rbox(bw + 0.08, 0.16, d + 0.08, 0.05), bx, top, 0), 0xe9ecef);
      const nT = Math.max(2, Math.round(bw / 1.05)), tw = (bw - 0.2) / nT, th2 = 0.55;
      for (let k = 0; k < nT; k++) {
        const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(tw, 0); sh.lineTo(tw, th2); sh.lineTo(0, 0);
        const g = new THREE.ExtrudeGeometry(sh, { depth: d - 0.3, bevelEnabled: false }); g.translate(bx - bw / 2 + 0.1 + k * tw, top + 0.08, -(d - 0.3) / 2);
        kit.metal.add(g, k % 2 ? 0xc3ccd6 : 0xb8c2cd, B);
        facadeQuad(kit, B, Math.PI / 2, 0, top + 0.08 + th2 / 2, d - 0.4, th2 - 0.08, 0, STRIP.cool, rnd() * 3, 0.5, bx - bw / 2 + 0.1 + (k + 1) * tw + 0.012);
      }
      const nC = 1 + (rnd() < 0.5 ? 1 : 0);
      for (let k = 0; k < nC; k++) {
        const cx = bx - bw / 2 + 0.3, cz = (k - (nC - 1) / 2) * 0.48, ch = 1.4 + h * 0.45; // chimneys at the left end, clear of the sign
        for (let q = 0; q < 5; q++) Mt(at(new THREE.CylinderGeometry(0.15, 0.17, ch / 5, 12), cx, top + 0.1 + ch * (q + 0.5) / 5, cz), q % 2 ? 0xf3f3f3 : 0xd84a3a);
        Mt(at(new THREE.TorusGeometry(0.16, 0.035, 6, 14), cx, top + 0.1 + ch, cz, 0, Math.PI / 2), 0x3a3f47);
        kit.glow.add(...lw(B, cx, top + 0.2 + ch, cz), 0.05, 0xff3a2a, 5, 0.6);
      }
    } else {
    // barrel-vault roof along X
    const vault = new THREE.CylinderGeometry(d / 2 + 0.05, d / 2 + 0.05, bw + 0.1, 28, 1, false, -Math.PI / 2, Math.PI);
    vault.rotateZ(Math.PI / 2); vault.rotateX(-Math.PI / 2); vault.scale(1, 0.42, 1); vault.translate(bx, top, 0);
    Mt(vault, 0xc9d3de);
    // ribs
    for (let k = -2; k <= 2; k++) { const r = new THREE.TorusGeometry(d / 2 + 0.07, 0.035, 5, 20, Math.PI); r.scale(1, 0.42, 1); r.rotateY(Math.PI / 2); r.translate(bx + k * (bw / 5), top, 0); Mt(r, accent); }
    }
    // roller doors + dock
    const nDoors = bw > 3.4 ? 2 : 1;
    for (let k = 0; k < nDoors; k++) {
      const cx = bx + (nDoors === 1 ? 0 : (k - 0.5) * bw / 2);
      facadeQuad(kit, B, 0, cx, 0.95, 1.2, 1.35, d / 2 + 0.03, STRIP.roller, 0, 0.42);
      P(at(rbox(1.42, 0.12, 0.12, 0.03), cx, 1.68, d / 2 + 0.04), accent);
      for (const s of [-1, 1]) P(at(rbox(0.1, 1.45, 0.12, 0.03), cx + s * 0.66, 0.95, d / 2 + 0.04), accent);
      kit.glow.add(...lw(B, cx, 1.86, d / 2 + 0.12), 0.07, 0xffc46b, 5);
    }
    P(at(rbox(bw, 0.34, 0.75, 0.05), bx, 0.17, d / 2 + 0.37), CONCRETE);
    for (let k = 0; k < nDoors * 2; k++) P(at(rbox(0.14, 0.22, 0.1, 0.03), bx - bw / 2 + (k + 0.5) * bw / (nDoors * 2), 0.24, d / 2 + 0.78), 0x26282d);
    // louvre high on the sides
    for (const s of [-1, 1]) facadeQuad(kit, B, s * Math.PI / 2, 0, top - 0.45, d * 0.5, 0.35, bw / 2 + 0.02, STRIP.louvre, rnd(), 0.6, bx);
  } else {
    const ov = style === 'kiosk' ? 0.32 : 0.05;
    P(at(rbox(bw + 0.06 + ov, 0.18, d + 0.06 + ov, 0.06), bx, top, 0), style === 'kiosk' ? accent : body === COL.white ? 0xe6e9ee : 0xf6f7f9);
    P(at(rbox(bw - 0.22, 0.05, d - 0.22, 0.02), bx, top + 0.1, 0), ROOF);
    if (style === 'kiosk') {
      P(at(rbox(bw + ov + 0.1, 0.06, d + ov + 0.1, 0.03), bx, top - 0.12, 0), 0xffffff);
      // roof dressing: raised lip around the overhang, grey membrane, access hatch, skylight, vent stacks
      const W2 = bw + 0.06 + ov, D2 = d + 0.06 + ov;
      for (const [x2, z2, ww, dd] of [[0, D2 / 2 - 0.03, W2, 0.06], [0, -D2 / 2 + 0.03, W2, 0.06], [W2 / 2 - 0.03, 0, 0.06, D2], [-W2 / 2 + 0.03, 0, 0.06, D2]]) P(at(new THREE.BoxGeometry(ww, 0.08, dd), bx + x2, top + 0.13, z2), new THREE.Color(accent).multiplyScalar(0.8).getHex());
      P(at(new THREE.BoxGeometry(W2 - 0.2, 0.02, D2 - 0.2), bx, top + 0.1, 0), 0x8f99a5);
      P(at(rbox(0.36, 0.1, 0.36, 0.015), bx - bw * 0.28, top + 0.16, -d * 0.2), 0x6d7682);
      P(at(rbox(0.5, 0.12, 0.34, 0.015), bx + bw * 0.22, top + 0.17, -d * 0.22), 0xa9d4ee);
      for (const q of [-1, 1]) Mt(at(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 8), bx + q * 0.15, top + 0.25, -d * 0.35), 0xb7bfc8);
    }
  }

  // lab penthouse with a glass band
  let roofTop = top + 0.12;
  if (style === 'lab' && !b.noPent) {
    const pw = bw * 0.52, pd = d * 0.55, ph = 0.8, px = bx - bw * 0.16;
    kit.walls.add(at(rbox(pw, ph, pd, 0.03), px, top + 0.1 + ph / 2, -d * 0.1), body, B);
    P(at(rbox(pw + 0.08, 0.12, pd + 0.08, 0.05), px, top + 0.1 + ph, -d * 0.1), accent);
    FACADES.forEach((f) => { const span = f.span === 'w' ? pw : pd, dep = (f.span === 'w' ? pd : pw) / 2; windowBand(kit, B, f.ang, px, 0, top + 0.5, span - 0.3, 0.38, dep, 'cool', rnd(), -d * 0.1); });
  }

  // front door, awning, step, lamp
  if (b.noDoor || b.y0) { /* upper / secondary block: no street door */ } else if (!industrial) {
    const fz = d / 2;
    P(at(rbox(1.1, 1.38, 0.08, 0.03), bx, 0.2 + 0.69, fz + 0.01), FRAME);
    P(at(rbox(0.86, 1.2, 0.06, 0.02), bx, 0.2 + 0.62, fz + 0.04), DOOR);
    facadeQuad(kit, B, 0, bx, 0.2 + 1.3, 0.8, 0.12, fz + 0.075, STRIP.warm, 0.1, 0.3);
    const aw = new THREE.BoxGeometry(1.35, 0.06, 0.62); aw.rotateX(0.22);
    P(at(aw, bx, 1.72, fz + 0.31), accent);
    P(at(rbox(1.3, 0.08, 0.5, 0.03), bx, 0.04, fz + 0.27), CONCRETE);
    kit.glow.add(...lw(B, bx, 1.6, fz + 0.06), 0.06, 0xffd28a, 5);
    kit.anchors[`door:${b.id}`] = lw(B, bx, 0, fz + 0.9);
  } else kit.anchors[`door:${b.id}`] = lw(B, bx, 0, d / 2 + 1.4);

  // pump: tank + pipes + valve
  if (style === 'pump') {
    const tr = Math.min(0.62, d / 2 - 0.08), tx = w / 2 - 0.6, th = h * 0.9;
    Mt(at(new THREE.CylinderGeometry(tr, tr, th, 28), tx, th / 2 + 0.05, 0), 0xd7dde4);
    Mt(at(new THREE.SphereGeometry(tr, 28, 10, 0, Math.PI * 2, 0, Math.PI / 2), tx, th + 0.05, 0), 0xd7dde4);
    for (const y of [0.4, th * 0.5, th - 0.25]) Mt(at(new THREE.TorusGeometry(tr + 0.02, 0.04, 6, 28), tx, y, 0, 0, Math.PI / 2), accent);
    P(at(rbox(2 * tr + 0.2, 0.12, 2 * tr + 0.2, 0.04), tx, 0.06, 0), CONCRETE);
    for (const y of [0.7, 1.35]) {
      const p = new THREE.CylinderGeometry(0.08, 0.08, 0.7, 10); p.rotateZ(Math.PI / 2);
      Mt(at(p, (bx + bw / 2 + tx - tr) / 2 + 0.02, y, d * 0.12), accent === COL.green ? 0x5fb34a : 0xbfc6cf);
      Mt(at(new THREE.CylinderGeometry(0.13, 0.13, 0.06, 12), bx + bw / 2 + 0.05, y, d * 0.12, 0, 0, Math.PI / 2), 0x8b939d);
    }
    Mt(at(new THREE.TorusGeometry(0.16, 0.03, 6, 16), tx + tr + 0.08, 0.9, 0, Math.PI / 2), COL.red);
    kit.glow.add(...lw(B, tx, th * 0.62, tr + 0.02), 0.05, 0x7dffb0, 5, 1.3);
    kit.footprints.push({ type: 'circle', ...xz(lw(B, tx, 0, 0)), r: tr + 0.1 });
  }

  // rooftop kit
  const roofSpots = [];
  const rw = (style === 'pump' ? bw : bw) - 0.6, rd = d - 0.6;
  const nAC = b.noRoofKit ? 0 : style === 'kiosk' ? 1 : 1 + Math.floor(rnd() * 3);
  // roof gear keeps ≥1.1u clear of the roof sign line (front edge) so signs read from both sides
  const zMax = Math.max(-rd / 2 + 0.25, d / 2 - 0.12 - 1.1), zMin = -rd / 2 + 0.2;
  for (let k = 0; k < nAC; k++) roofSpots.push(['ac', bx + (rnd() - 0.5) * rw * 0.8, zMin + rnd() * Math.max(0, zMax - zMin)]);
  const nV = b.noRoofKit ? 0 : 1 + Math.floor(rnd() * 3);
  for (let k = 0; k < nV; k++) roofSpots.push(['vent', bx + (rnd() - 0.5) * rw, zMin + rnd() * Math.max(0, zMax - zMin)]);
  const rTop = style === 'depot' ? top + d * 0.2 : style === 'factory' ? top + 0.1 : roofTop;
  for (const [kind, x, z] of roofSpots) {
    if (style === 'lab' && Math.abs(x - (bx - bw * 0.16)) < bw * 0.3 && Math.abs(z + d * 0.1) < d * 0.33) continue;
    if (style === 'factory') continue;
    const yy = style === 'depot' ? top + Math.sqrt(Math.max(0, (d / 2) ** 2 - z * z)) * 0.42 : rTop;
    const m = B.clone().multiply(trs(x, yy, z, 0, rnd() * 0.3, 0));
    if (kind === 'ac') kit.parts.ac.add(m); else kit.parts.vent.add(m);
  }
  if (!b.noSign && (style === 'tower' || style === 'lab' || rnd() < 0.3)) {
    const ax = bx + bw / 2 - 0.35, az = -d / 2 + 0.35, ah = style === 'tower' ? 1.6 : 1.0;
    const yb = style === 'depot' ? top : rTop;
    Mt(at(new THREE.CylinderGeometry(0.025, 0.04, ah, 6), ax, yb + ah / 2, az), 0xd0d5dc);
    Mt(at(new THREE.BoxGeometry(0.4, 0.02, 0.02), ax, yb + ah * 0.7, az), 0xd0d5dc);
    kit.glow.add(...lw(B, ax, yb + ah + 0.04, az), 0.06, 0xff3a2a, 6, 0.9);
  }
  if (style === 'tower') {
    // rooftop water tank on legs
    const tx2 = bx - bw * 0.15, tz2 = -d * 0.18;
    Mt(at(new THREE.CylinderGeometry(0.38, 0.38, 0.55, 18), tx2, rTop + 0.55, tz2), 0xbfc8d2);
    Mt(at(new THREE.ConeGeometry(0.42, 0.22, 18), tx2, rTop + 0.94, tz2), accent);
    for (const s of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) Mt(at(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 5), tx2 + s[0] * 0.25, rTop + 0.15, tz2 + s[1] * 0.25), 0x7a828c);
  }
  // varied roof kit: solar arrays, dishes, skylights, roof railings
  if ((style === 'lab' || style === 'pump' || style === 'kiosk') && rnd() < 0.45) {
    const n = style === 'kiosk' ? 2 : 3, px0 = bx + bw * 0.12;
    for (let k = 0; k < n; k++) { const g = rbox(0.42, 0.03, 0.55, 0.01); g.rotateX(-0.35); kit.paint.add(at(g, px0 + (k - (n - 1) / 2) * 0.46, rTop + 0.16, -d * 0.18), 0x2b4f86, B); Mt(at(new THREE.BoxGeometry(0.04, 0.14, 0.04), px0 + (k - (n - 1) / 2) * 0.46, rTop + 0.07, -d * 0.18 + 0.15), 0x7a828c); }
  }
  if (rnd() < 0.3 && style !== 'factory') {
    const dx = bx - bw / 2 + 0.45, dz = -d / 2 + 0.45;
    const dish = new THREE.SphereGeometry(0.26, 14, 6, 0, Math.PI * 2, 0, 0.9); dish.rotateX(-0.9);
    Mt(at(dish, dx, rTop + 0.42, dz), 0xeef1f4); Mt(at(new THREE.CylinderGeometry(0.03, 0.05, 0.36, 6), dx, rTop + 0.18, dz), 0x7a828c);
  }
  if (style === 'depot' && rnd() < 0.7) for (let k = -1; k <= 1; k += 2) kit.paint.add(at(rbox(0.5, 0.08, 0.36, 0.02), bx + k * bw * 0.25, top + d * 0.42 * 0.5 + 0.04, 0, 0, 0.55), 0xa9d4ee, B);
  if (style === 'tower') for (const [sx, sz, len, r] of [[0, -d / 2 + 0.06, bw - 0.1, 0], [bw / 2 - 0.06, -0.15, d - 0.4, Math.PI / 2], [-bw / 2 + 0.06, -0.15, d - 0.4, Math.PI / 2]]) {
    const rail = new THREE.CylinderGeometry(0.02, 0.02, len, 5); rail.rotateZ(Math.PI / 2); rail.rotateY(r); Mt(at(rail, bx + sx, rTop + 0.38, sz), 0xf2c21b);
  }
  if (style === 'tower') for (const px of [-1, 0, 1]) for (const pz of [-1]) Mt(at(new THREE.CylinderGeometry(0.018, 0.018, 0.38, 5), bx + px * (bw / 2 - 0.06), rTop + 0.19, pz * (d / 2 - 0.06)), 0x9aa2ab);
  // downpipe on a back corner
  if (style !== 'kiosk') Mt(at(new THREE.CylinderGeometry(0.05, 0.05, bodyH, 8), bx - bw / 2 + 0.12, bodyH / 2, -d / 2 - 0.04), 0xaab2bb);
  // rooftop lights
  if (rnd() < 0.6) for (const s of [-1, 1]) kit.glow.add(...lw(B, bx + s * (bw / 2 - 0.15), top + 0.2, d / 2 - 0.15), 0.045, 0xffe2a0, 5);

  // roof sign on the front edge
  if (b.noSign) { if (!b.noFoot) kit.footprints.push({ type: 'box', x: b.x, z: b.z, w: w + 0.2, d: d + 0.2, rot: b.rot, id: b.id }); return; }
  const sw = Math.min(bw * (b.signHalf ? 0.44 : style === 'factory' ? 0.58 : 0.86), style === 'kiosk' ? 2.4 : 2.2), sh = sw / 6.2;
  if (b.signHalf) bx += bw * 0.26;
  if (style === 'factory') bx += bw * 0.19;
  const sy = (style === 'depot' ? top + 0.15 : style === 'factory' ? top + 0.7 : rTop) + sh / 2 + 0.66, sz = style === 'depot' ? d / 2 - 0.05 : d / 2 - 0.12;
  P(at(rbox(sw + 0.08, sh + 0.08, 0.07, 0.025), bx, sy, sz), 0x2a2d34);
  for (const s of [-1, 1]) Mt(at(new THREE.CylinderGeometry(0.025, 0.025, 0.85, 6), bx + s * sw * 0.35, sy - sh / 2 - 0.36, sz - 0.06), 0x8d959f);
  kit.sign(b.sign, B, bx, sy, sz + 0.04, sw, sh, 0);
  kit.sign(b.sign, B, bx, sy, sz - 0.04, sw, sh, Math.PI);

  // footprint (whole plot)
  if (!b.noFoot) kit.footprints.push({ type: 'box', x: b.x, z: b.z, w: w + 0.2, d: d + 0.2, rot: b.rot, id: b.id });
}

const _v = new THREE.Vector3();
function lw(B, x, y, z) { _v.set(x, y, z).applyMatrix4(B); return [_v.x, _v.y, _v.z]; }
function xz(p) { return { x: p[0], z: p[2] }; }

/** Framed band of lit windows on one facade. ang = facade rotation, s = position along the facade. */
function windowBand(kit, B, ang, bx, s, y, len, hh, dep, strip, r, zShift = 0) {
  // frame
  const fr = rbox(len + 0.1, hh + 0.12, 0.06, 0.01);
  const M = B.clone().multiply(trs(bx, 0, zShift, 0, 0, 0)).multiply(trs(0, 0, 0, 0, ang, 0));
  kit.paint.add(fr.translate(s, y, dep + 0.015), FRAME, M);
  // sill
  kit.paint.add(new THREE.BoxGeometry(len + 0.16, 0.05, 0.12).translate(s, y - hh / 2 - 0.07, dep + 0.05), 0xf2f3f5, M);
  kit.paint.add(new THREE.BoxGeometry(len + 0.12, 0.04, 0.07).translate(s, y + hh / 2 + 0.07, dep + 0.03), 0xdfe3e8, M);
  const g = new THREE.PlaneGeometry(len, hh);
  setUV(g, r, r + len / 4.8, STRIP[strip]);
  g.translate(s, y, dep + 0.05);
  kit.windows.add(g, M);
}

function facadeQuad(kit, B, ang, s, y, len, hh, dep, strip, u0, uLen, xShift = 0, zShift = 0) {
  const M = B.clone().multiply(trs(xShift, 0, zShift, 0, 0, 0)).multiply(trs(0, 0, 0, 0, ang, 0));
  const g = new THREE.PlaneGeometry(len, hh);
  setUV(g, u0, u0 + uLen, strip);
  g.translate(s, y, dep);
  kit.windows.add(g, M);
}

function setUV(g, u0, u1, strip) {
  const v0 = 1 - (strip + 1) / 8 + 0.004, v1 = 1 - strip / 8 - 0.004;
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + (u1 - u0) * uv.getX(i), v0 + (v1 - v0) * uv.getY(i));
}

/** Raised walkway bridge with stair towers, railings, lit underside and a banner sign. */
function bridge(kit, br) {
  const dx = br.x1 - br.x0, dz = br.z1 - br.z0, L = Math.hypot(dx, dz);
  const ang = Math.atan2(dx, dz); // local +Z along the bridge
  const B = trs(br.x0, 0, br.z0, 0, ang, 0);
  const P = (g, c) => kit.paint.add(g, c, B), Mt = (g, c) => kit.metal.add(g, c, B);
  const towers = br.towers ?? [true, true];
  const ts = 1.3, h = br.h;
  const z0 = towers[0] ? ts / 2 : 0, z1 = towers[1] ? L - ts / 2 : L;
  const span = z1 - z0, zc = (z0 + z1) / 2;
  // deck + edge beams + soffit lights
  P(at(rbox(1.25, 0.2, span, 0.06), 0, h, zc), 0xe7eaee);
  P(at(rbox(0.12, 0.34, span, 0.04), -0.62, h - 0.05, zc), br.accent ?? COL.blue);
  P(at(rbox(0.12, 0.34, span, 0.04), 0.62, h - 0.05, zc), br.accent ?? COL.blue);
  for (let z = z0 + 0.8; z < z1 - 0.5; z += 1.6) kit.glow.add(...lw(B, 0, h - 0.13, z), 0.06, 0xfff0c8, 4);
  // railings: posts + top rail + mid rail
  for (const s of [-1, 1]) {
    const x = s * 0.56;
    for (let z = z0 + 0.15; z <= z1 - 0.1; z += 0.55) Mt(at(new THREE.CylinderGeometry(0.022, 0.022, 0.62, 5), x, h + 0.41, z), 0xdfe4ea);
    for (const yy of [h + 0.72, h + 0.42]) { const r = new THREE.CylinderGeometry(0.03, 0.03, span, 6); r.rotateX(Math.PI / 2); Mt(at(r, x, yy, zc), yy > h + 0.6 ? 0xf2c21b : 0xcfd5dc); }
  }
  // supports
  const pillars = [];
  if (!towers[0]) pillars.push(z0 + 0.4); if (!towers[1]) pillars.push(z1 - 0.4);
  for (let z = z0 + 1.6; z < z1 - 1.2; z += 2.4) { const p = lw(B, 0, 0, z); if (roadDist(p[0], p[2]) > 0.35) pillars.push(z); }
  for (const z of pillars) {
    for (const s of [-1, 1]) Mt(at(new THREE.CylinderGeometry(0.075, 0.095, h - 0.1, 10), s * 0.45, (h - 0.1) / 2, z), 0xb7c0ca);
    P(at(rbox(1.2, 0.16, 0.3, 0.05), 0, h - 0.18, z), 0x8e98a5);
    P(at(rbox(0.5, 0.1, 0.5, 0.04), -0.45, 0.05, z), CONCRETE); P(at(rbox(0.5, 0.1, 0.5, 0.04), 0.45, 0.05, z), CONCRETE);
    kit.footprints.push({ type: 'circle', ...xz(lw(B, 0, 0, z)), r: 0.7 });
  }
  // stair towers
  [0, 1].forEach((k) => {
    if (!towers[k]) return;
    const z = k ? L : 0;
    const th = h + 1.1;
    P(at(rbox(ts, 0.2, ts, 0.05), 0, 0.1, z), PLINTH);
    kit.walls.add(at(rbox(ts - 0.1, th, ts - 0.1, 0.03), 0, th / 2 + 0.1, z), COL.white, B, { grime: true });
    P(at(rbox(ts + 0.08, 0.16, ts + 0.08, 0.06), 0, th + 0.12, z), br.accent ?? COL.blue);
    // glazed stair slot and door at the outer face
    const out = k ? 1 : -1;
    facadeQuad(kit, B, k ? 0 : Math.PI, 0, th * 0.55, 0.42, th * 0.7, ts / 2 - 0.03, STRIP.cool, 0.2 + k * 0.3, 0.12, 0, z);
    for (const s of [-1, 1]) facadeQuad(kit, B, s * Math.PI / 2, 0, h + 0.35, 0.7, 0.4, ts / 2 - 0.03, STRIP.warm, 0.5 + s * 0.2, 0.15, 0, z);
    // door at ground level on the outer face
    P(at(rbox(0.7, 1.15, 0.06, 0.02), 0, 0.2 + 0.58, z + out * (ts / 2 - 0.02)), DOOR);
    kit.glow.add(...lw(B, 0, th + 0.32, z), 0.08, 0xff4030, 5, 0.7);
    // move tower facades to z
    kit.footprints.push({ type: 'box', ...xz(lw(B, 0, 0, z)), w: ts + 0.1, d: ts + 0.1, rot: ang });
    kit.anchors[`bridge:${br.id}:${k ? 'b' : 'a'}`] = lw(B, 0, 0, z + out * (ts / 2 + 0.6));
  });
  // banner sign hanging on the deck side facing +Z of world? (both faces)
  if (br.sign) {
    const sw = 1.9, sh = sw / 6.2;
    for (const s of [-1, 1]) {
      const M = B.clone().multiply(trs(s * 0.7, h - 0.02, zc, 0, s * Math.PI / 2, 0));
      kit.paint.add(rbox(sw + 0.06, sh + 0.06, 0.05, 0.02), 0x2a2d34, M);
      kit.signM(br.sign, M, 0, 0, 0.03, sw, sh);
    }
  }
}

/** Tank farm: concrete pad, 2–4 banded vertical tanks with domes, ladders, a pipe manifold and a pump skid. */
function tankFarm(kit, b, B, rnd) {
  const P = (g, c) => kit.paint.add(g, c, B), Mt = (g, c) => kit.metal.add(g, c, B);
  const { w, d, h } = b;
  P(at(rbox(w, 0.12, d, 0.03), 0, 0.06, 0), CONCRETE);
  contact(kit, b.x, b.z, b.w, b.d, b.rot);
  const n = w > 2.6 ? 3 : 2, r = Math.min((w - 0.3) / (2 * n) * 0.92, d / 2 - 0.2);
  const tankCol = [0xe3e7ec, 0xd6dce3, 0xeef0f2][Math.floor(rnd() * 3)];
  for (let k = 0; k < n; k++) {
    const x = -w / 2 + 0.15 + r + k * ((w - 0.3 - 2 * r) / Math.max(1, n - 1)), z = -d / 2 + 0.15 + r + (k % 2) * Math.max(0, d - 0.3 - 2 * r) * 0.5;
    const th = h * (0.75 + rnd() * 0.25);
    Mt(at(new THREE.CylinderGeometry(r, r, th, 24), x, th / 2 + 0.12, z), tankCol);
    Mt(at(new THREE.SphereGeometry(r, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2), x, th + 0.12, z, 0, 0, 0), tankCol);
    for (const y of [0.35, th * 0.55]) Mt(at(new THREE.TorusGeometry(r + 0.015, 0.035, 5, 24), x, y + 0.12, z, 0, Math.PI / 2), b.accent);
    // ladder on the street side
    for (const s of [-1, 1]) Mt(at(new THREE.CylinderGeometry(0.012, 0.012, th, 4), x + s * 0.08, th / 2 + 0.12, z + r + 0.04), 0x8b939d);
    for (let y = 0.3; y < th; y += 0.18) { const g = new THREE.CylinderGeometry(0.01, 0.01, 0.16, 4); g.rotateZ(Math.PI / 2); Mt(at(g, x, y + 0.12, z + r + 0.04), 0x8b939d); }
    kit.glow.add(...lw(B, x, th + r + 0.14, z), 0.04, 0xff3a2a, 5, 0.8);
  }
  // manifold pipe + pump skid
  const pipe = new THREE.CylinderGeometry(0.07, 0.07, w - 0.3, 10); pipe.rotateZ(Math.PI / 2);
  Mt(at(pipe, 0, 0.45, d / 2 - 0.18), b.accent);
  for (let k = 0; k < 3; k++) Mt(at(new THREE.CylinderGeometry(0.11, 0.11, 0.05, 10), -w / 2 + 0.3 + k * (w - 0.6) / 2, 0.45, d / 2 - 0.18, 0, 0, Math.PI / 2), 0x8b939d);
  P(at(rbox(0.5, 0.36, 0.34, 0.04), w / 2 - 0.4, 0.3, d / 2 - 0.25), 0x5d6672);
  Mt(at(new THREE.TorusGeometry(0.1, 0.022, 5, 12), w / 2 - 0.4, 0.55, d / 2 - 0.06), COL.red);
  kit.footprints.push({ type: 'box', x: b.x, z: b.z, w: w + 0.15, d: d + 0.15, rot: b.rot, id: b.id });
  kit.anchors[`door:${b.id}`] = lw(B, 0, 0, d / 2 + 0.7);
}

/** Shipping-container stack: rows of corrugated boxes, some double-stacked, with corner castings. */
function containerStack(kit, b, B, rnd) {
  const { w, d } = b;
  const P = (g, c) => kit.paint.add(g, c, B);
  const cols = [0xd8483a, 0x2f78e0, 0xf08a24, 0x2fa88a, 0xf2c21f, 0x8a5ad0, 0x5f6b78];
  const L = Math.min(1.25, w - 0.1), Wc = 0.5, Hc = 0.52;
  const nx = Math.max(1, Math.floor((w + 0.06) / (L + 0.06))), nz = Math.max(1, Math.floor((d + 0.06) / (Wc + 0.06)));
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const x = -w / 2 + L / 2 + i * (L + 0.06) + (w - nx * (L + 0.06) + 0.06) / 2, z = -d / 2 + Wc / 2 + j * (Wc + 0.06);
    const stack = 1 + (rnd() < 0.55 ? 1 : 0) + (rnd() < 0.15 ? 1 : 0);
    for (let k = 0; k < stack; k++) {
      const c = cols[Math.floor(rnd() * cols.length)], y = Hc / 2 + k * (Hc + 0.01);
      P(at(rbox(L, Hc, Wc, 0.02), x, y, z), c);
      // corrugation ribs on the long faces
      for (let q = 1; q < 8; q++) for (const sz of [-1, 1]) P(at(new THREE.BoxGeometry(0.025, Hc - 0.08, 0.012), x - L / 2 + q * L / 8, y, z + sz * (Wc / 2 + 0.004)), new THREE.Color(c).multiplyScalar(0.82).getHex());
      // door end bars
      for (const sx of [-0.08, 0.08]) P(at(new THREE.BoxGeometry(0.02, Hc - 0.06, 0.02), x + L / 2 + 0.006, y, z + sx), 0x9aa2ab);
    }
  }
  kit.footprints.push({ type: 'box', x: b.x, z: b.z, w: w + 0.15, d: d + 0.15, rot: b.rot, id: b.id });
  kit.anchors[`door:${b.id}`] = lw(B, 0, 0, d / 2 + 0.7);
}

/** Striped shopfront awning spanning a ground-floor window run. */
function shopAwning(kit, B, cx, len, dep, y, accent, rnd) {
  const n = Math.max(3, Math.round(len / 0.22)), w = len / n;
  const c2 = rnd() < 0.5 ? 0xffffff : 0xf3e6c8;
  for (let k = 0; k < n; k++) {
    const g = new THREE.BoxGeometry(w, 0.035, 0.5); g.rotateX(0.32);
    kit.paint.add(g.translate(cx - len / 2 + (k + 0.5) * w, y, dep + 0.24), k % 2 ? accent : c2, B);
  }
  kit.paint.add(new THREE.BoxGeometry(len, 0.06, 0.03).translate(cx, y - 0.09, dep + 0.48), accent, B);
}

/** Round office / silo: drum body with wrap-around window bands, storey rings, parapet and roof kit. */
function roundOffice(kit, b, B, rnd) {
  const P = (g, c) => kit.paint.add(g, c, B), Mt = (g, c) => kit.metal.add(g, c, B);
  const r = Math.min(b.w, b.d) / 2 - 0.05, h = b.h;
  P(new THREE.CylinderGeometry(r + 0.07, r + 0.09, 0.24, 40).translate(0, 0.12, 0), PLINTH);
  kit.walls.add(new THREE.CylinderGeometry(r, r, h - 0.2, 40).translate(0, 0.2 + (h - 0.2) / 2, 0), b.body, B, { grime: true });
  contact(kit, b.x, b.z, 2 * r, 2 * r, 0);
  const rows = []; for (let y = 0.95; y + 0.35 < h - 0.25; y += 0.95) rows.push(y);
  const strip = STRIP[['cool', 'tall', 'blinds'][Math.floor(rnd() * 3)]];
  rows.forEach((y, k) => {
    P(new THREE.CylinderGeometry(r + 0.012, r + 0.012, 0.62, 40, 1, true).translate(0, y, 0), FRAME);
    const g = new THREE.CylinderGeometry(r + 0.03, r + 0.03, 0.5, 40, 1, true);
    setUV(g, rnd() * 4, rnd() * 4 + (2 * Math.PI * r) / 4.8, k === 0 ? STRIP.shop : strip);
    kit.windows.add(g.translate(0, y, 0), B);
    if (k > 0) P(new THREE.CylinderGeometry(r + 0.03, r + 0.03, 0.05, 40).translate(0, y - 0.42, 0), new THREE.Color(b.body).multiplyScalar(0.86).getHex());
  });
  P(new THREE.CylinderGeometry(r + 0.05, r + 0.05, 0.16, 40).translate(0, h, 0), b.accent);
  P(new THREE.CylinderGeometry(r - 0.08, r - 0.08, 0.05, 40).translate(0, h + 0.08, 0), ROOF);
  Mt(new THREE.SphereGeometry(r * 0.45, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(-r * 0.2, h + 0.1, -r * 0.15), 0xd9dee4);
  kit.parts.ac.add(B.clone().multiply(trs(r * 0.35, h + 0.1, r * 0.25, 0, 0.4, 0)));
  // entrance with canopy
  P(at(rbox(0.9, 1.2, 0.12, 0.01), 0, 0.82, r - 0.02), DOOR);
  const aw = new THREE.BoxGeometry(1.3, 0.06, 0.6); aw.rotateX(0.18); P(at(aw, 0, 1.6, r + 0.25), b.accent);
  kit.glow.add(...lw(B, 0, 1.5, r + 0.05), 0.06, 0xffd28a, 4);
  kit.anchors[`door:${b.id}`] = lw(B, 0, 0, r + 0.9);
  // roof sign
  const sw = Math.min(2 * r * 0.9, 2.0), sh = sw / 6.2;
  P(at(rbox(sw + 0.08, sh + 0.08, 0.07, 0.01), 0, h + 0.38, r * 0.55), 0x2a2d34);
  kit.sign(b.sign, B, 0, h + 0.38, r * 0.55 + 0.04, sw, sh, 0);
  kit.sign(b.sign, B, 0, h + 0.38, r * 0.55 - 0.04, sw, sh, Math.PI);
  kit.footprints.push({ type: 'circle', x: b.x, z: b.z, r: r + 0.12 });
}

/** Soft contact-shadow decal under a footprint (world box), to seat buildings on the ground. */
function contact(kit, x, z, w, d, rot) { kit.contacts.push({ x, z, w, d, rot }); }
