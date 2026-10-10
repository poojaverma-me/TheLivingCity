// Stationed staff on raised floors the ground crowd can't reach: scientists at the nucleus consoles and
// engineers on the mitochondria viewing piers. Individually animated figures (few, so cheap).
import * as THREE from 'three';
import { createFigure } from './characters.js';
import { NUCLEUS } from '../world/layout.js';
import { CONSOLE_ARCS, isStaffed, consoleSpot } from '../world/organelles/nucleus.js';
import { SKIN_TONES, HAIR_COLORS, SHIRT_COLORS } from './crowd.js';
import { mulberry32 } from '../core/noise.js';

export function createStaff(anchors = {}) {
  const group = new THREE.Group(); group.name = 'staff';
  const rnd = mulberry32(404);
  const people = [];
  const add = (x, y, z, yaw, state, opts = {}) => {
    const f = createFigure({
      hairStyle: ['short', 'bun', 'pony', 'buzz', 'long'][Math.floor(rnd() * 5)],
      skin: SKIN_TONES[Math.floor(rnd() * SKIN_TONES.length)], hair: HAIR_COLORS[Math.floor(rnd() * HAIR_COLORS.length)],
      shirt: SHIRT_COLORS[Math.floor(rnd() * SHIRT_COLORS.length)], seed: rnd(), ...opts,
    });
    f.position.set(x, y, z); f.rotation.y = yaw;
    f.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    group.add(f); people.push({ f, state, phase: rnd() * 10, base: state });
  };

  // nucleus control room: operators standing at the staffed console stations, facing the screen wall
  const PH = NUCLEUS.plinthH;
  CONSOLE_ARCS.forEach(([, n], arc) => {
    for (let i = 0; i < n; i++) {
      if (!isStaffed(arc, i)) continue;
      const sp = consoleSpot(arc, i);
      add(NUCLEUS.x + sp.x, PH, NUCLEUS.z + sp.z, sp.yaw, (i + arc) % 4 === 3 ? 'talk' : 'work', { glasses: rnd() < 0.4, clipboard: rnd() < 0.25 });
    }
  });
  // supervisor near the holo-table
  add(NUCLEUS.x + 1.6, PH, NUCLEUS.z + 2.4, -2.4, 'point', { tablet: true, hairStyle: 'short' });

  // mitochondria viewing piers (engineers in hard hats)
  for (const pre of ['mitoA.', 'mitoB.']) {
    for (const k of [0, 2]) {
      const p = anchors[`${pre}catwalk${k}`];
      if (!Array.isArray(p)) continue;
      add(p[0] + (k ? 0.5 : -0.4), p[1], p[2] + (k ? 0.3 : -0.2), rnd() * Math.PI * 2, k ? 'point' : 'work', { hat: true, accent: 0xf2c12e });
    }
  }

  group.userData.update = (t, dt) => {
    for (const p of people) {
      // occasional glance/pose change keeps the room alive
      const cyc = Math.sin(t * 0.21 + p.phase);
      const st = p.base === 'work' && cyc > 0.92 ? 'talk' : p.base;
      p.f.animate?.(st, t, dt, { speed: 0 });
    }
  };
  return group;
}
