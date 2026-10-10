// Lysosomes: deep-sage cylindrical recycling plants with satin steel bands. Lime is reserved for what
// glows: the churning acid under a slowly turning lid that carries a three-arrow (Möbius) recycling
// emblem, debris-filled porthole windows, and a matching emblem decal on the camera-facing wall.
// Each plant runs a digestion cycle (WOW): a worn part rides the conveyor into the intake hatch, the
// acid surges (bloom pulse + bubble burst), then recycled pellets roll out of the output chute.
// Also: a large pH 4.5 gauge, rivets, floor pipes and a vent breathing soft steam puffs.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { LYSO } from '../layout.js';
import * as M from '../../core/materials.js';
import { mergeGeometries, instanced, trs, place } from '../../core/geom.js';
import { mulberry32, tileFbm } from '../../core/noise.js';
import { organic } from '../../core/lookdev.js';

const TAU = Math.PI * 2;
const CAM_FACE = { x: 2, z: 40 }; // plants turn their working face toward the visitor / overview camera
const CYCLE = 9; // seconds per digestion cycle

function clean(g, keepColor = false) {
  if (!g.index) { const idx = []; for (let i = 0; i < g.attributes.position.count; i++) idx.push(i); g.setIndex(idx); }
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', ...(keepColor ? ['color'] : [])].includes(k)) g.deleteAttribute(k);
  if (!g.attributes.normal) g.computeVertexNormals();
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  return g;
}
function colorize(g, color) {
  g = clean(g);
  const n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let k = 0; k < n; k++) { a[k * 3] = color.r; a[k * 3 + 1] = color.g; a[k * 3 + 2] = color.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
const canvasTex = (w, h, draw, { wrap = false, srgb = true } = {}) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = 8;
  if (wrap) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
};

/** Tileable churning acid: swirly fbm in lime/acid greens with foam highlights. `debris` adds dark chunks. */
function churnTexture(debris = false) {
  return canvasTex(256, 256, (x, W, H) => {
    const img = x.createImageData(W, H), d = img.data;
    const lo = [6, 30, 3], mid = [100, 210, 30], hi = [215, 255, 130];
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const u = i / W, v = j / H;
      const w = tileFbm(u, v, 3, 3, 7) * 0.5;
      let n = tileFbm(u + w, v - w, 4, 4, 11) * 1.6 + 0.5;
      n = Math.max(0, Math.min(1, n));
      const foam = Math.pow(Math.max(0, tileFbm(u, v, 8, 2, 23) * 2 + 0.2), 3);
      const t = Math.pow(n, 2.6);
      const c = t < 0.5 ? lo.map((a, k) => a + (mid[k] - a) * (t / 0.5)) : mid.map((a, k) => a + (hi[k] - a) * ((t - 0.5) / 0.5));
      const k4 = (j * W + i) * 4;
      d[k4] = Math.min(255, c[0] + foam * 120); d[k4 + 1] = Math.min(255, c[1] + foam * 60); d[k4 + 2] = Math.min(255, c[2] + foam * 90); d[k4 + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    if (debris) { // silhouettes of half-digested parts: gears, protein coils, membrane scraps (wrapped)
      const rnd = mulberry32(99);
      for (let k = 0; k < 22; k++) {
        const cx = rnd() * W, cy = rnd() * H, s = 6 + rnd() * 14, kind = k % 3;
        for (const ox of [-W, 0, W]) for (const oy of [-H, 0, H]) {
          x.save(); x.translate(cx + ox, cy + oy); x.rotate(rnd() * TAU);
          x.fillStyle = `rgba(${20 + rnd() * 30},${40 + rnd() * 30},${15},0.85)`; x.strokeStyle = 'rgba(10,30,5,0.85)'; x.lineWidth = 3;
          if (kind === 0) { x.beginPath(); for (let q = 0; q < 16; q++) { const a = q / 16 * TAU, rr = q % 2 ? s : s * 0.75; x.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } x.fill(); }
          else if (kind === 1) { x.beginPath(); for (let q = 0; q < 30; q++) x.lineTo(q * s * 0.08 - s, Math.sin(q * 0.9) * s * 0.4); x.stroke(); }
          else { x.beginPath(); x.ellipse(0, 0, s, s * 0.45, 0, 0, TAU); x.fill(); }
          x.restore();
        }
      }
    }
  }, { wrap: true });
}

/** Patch a standard material so its emissive map churns (two counter-flowing, warped samples). */
function churning(mat, key) {
  const u = { uTime: { value: 0 } };
  mat.userData.time = u.uTime;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = u.uTime;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <emissivemap_fragment>', `
      #ifdef USE_EMISSIVEMAP
        vec2 eu = vEmissiveMapUv;
        float tt = uTime;
        vec2 warp = vec2(sin(eu.y * 9.0 + tt * 1.3), cos(eu.x * 8.0 - tt * 1.1)) * 0.03;
        vec3 e1 = texture2D(emissiveMap, eu + warp + vec2(tt * 0.031, tt * 0.017)).rgb;
        vec3 e2 = texture2D(emissiveMap, eu * 1.37 - warp + vec2(-tt * 0.022, tt * 0.029)).rgb;
        totalEmissiveRadiance *= mix(e1, e2, 0.5) * 0.7 + e1 * e2 * 0.9;
      #endif`);
  };
  mat.customProgramCacheKey = () => 'lysoChurn' + key;
  return mat;
}

/** Classic three-arrow Möbius recycling triangle as 2D polygons (circumradius R, centred). */
function mobiusPolys(R) {
  const V = [0, 1, 2].map((k) => { const a = Math.PI / 2 + k * TAU / 3; return new THREE.Vector2(Math.cos(a) * R, Math.sin(a) * R); });
  const w = R * 0.24, h = w / 2, side = V[0].distanceTo(V[1]);
  const polys = [];
  for (let k = 0; k < 3; k++) {
    const P = V[(k + 2) % 3], C = V[k], Nn = V[(k + 1) % 3];
    const d1 = C.clone().sub(P).normalize(), d2 = Nn.clone().sub(C).normalize();
    const n1 = new THREE.Vector2(-d1.y, d1.x), n2 = new THREE.Vector2(-d2.y, d2.x);
    const mv = n1.clone().add(n2).normalize(); const ml = h / mv.dot(n1);
    // pull the corner in a little so arrows sit inside a rounded triangle
    const Ci = C.clone().multiplyScalar(0.9);
    const A = Ci.clone().addScaledVector(d1, -side * 0.4), B = Ci.clone().addScaledVector(d2, side * 0.17);
    const head = w * 1.15;
    polys.push([
      A.clone().addScaledVector(n1, h), Ci.clone().addScaledVector(mv, ml), B.clone().addScaledVector(n2, h),
      B.clone().addScaledVector(n2, head * 0.82), B.clone().addScaledVector(d2, head), B.clone().addScaledVector(n2, -head * 0.82),
      B.clone().addScaledVector(n2, -h), Ci.clone().addScaledVector(mv, -ml), A.clone().addScaledVector(n1, -h),
      A.clone().addScaledVector(d1, w * 0.45),
    ]);
  }
  return polys;
}
const mobiusShapes = (R) => mobiusPolys(R).map((p) => new THREE.Shape(p));

/** Emblem decal: dark sage disc, steel ring, glowing lime Möbius arrows (alpha outside the badge). */
function emblemTexture() {
  return canvasTex(512, 512, (x, S) => {
    x.clearRect(0, 0, S, S);
    x.fillStyle = '#163d22'; x.beginPath(); x.arc(S / 2, S / 2, S * 0.47, 0, TAU); x.fill();
    x.strokeStyle = '#c9d2d8'; x.lineWidth = S * 0.035; x.beginPath(); x.arc(S / 2, S / 2, S * 0.45, 0, TAU); x.stroke();
    x.fillStyle = '#fbfff2'; x.shadowColor = '#d8ffa0'; x.shadowBlur = 22;
    for (const poly of mobiusPolys(S * 0.36)) { x.beginPath(); poly.forEach((p, i) => (i ? x.lineTo(S / 2 + p.x, S / 2 - p.y) : x.moveTo(S / 2 + p.x, S / 2 - p.y))); x.closePath(); x.fill(); }
  });
}

function phTexture() {
  return canvasTex(512, 512, (x, S) => {
    x.fillStyle = '#23292f'; x.fillRect(0, 0, S, S);
    const g = x.createRadialGradient(S / 2, S / 2, 10, S / 2, S / 2, S / 2); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#e4ebe2');
    x.fillStyle = g; x.beginPath(); x.arc(S / 2, S / 2, S * 0.47, 0, TAU); x.fill();
    const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25, cols = ['#e8321f', '#f2701c', '#f7b51e', '#e9e021', '#9bd62a', '#36b84a', '#1f9e8a', '#2a6fd0', '#5a3fc0'];
    for (let k = 0; k < cols.length; k++) {
      x.strokeStyle = cols[k]; x.lineWidth = 50; x.beginPath();
      x.arc(S / 2, S / 2, S * 0.37, a0 + (a1 - a0) * (k / cols.length), a0 + (a1 - a0) * ((k + 1) / cols.length) + 0.01); x.stroke();
    }
    x.strokeStyle = '#1d2a22'; x.lineWidth = 4;
    for (let p = 0; p <= 14; p++) { const a = a0 + (a1 - a0) * (p / 14); x.beginPath(); x.moveTo(S / 2 + Math.cos(a) * S * 0.31, S / 2 + Math.sin(a) * S * 0.31); x.lineTo(S / 2 + Math.cos(a) * S * 0.27, S / 2 + Math.sin(a) * S * 0.27); x.stroke(); }
    x.fillStyle = '#1d2a22'; x.font = '800 34px Inter, sans-serif'; x.textAlign = 'center';
    for (const p of [0, 7, 14]) { const a = a0 + (a1 - a0) * (p / 14); x.fillText(String(p), S / 2 + Math.cos(a) * S * 0.21, S / 2 + Math.sin(a) * S * 0.21 + 12); }
    x.font = '900 92px Montserrat, sans-serif'; x.fillText('pH', S / 2, S * 0.63);
    x.fillStyle = '#c0281a'; x.font = '900 72px Montserrat, sans-serif'; x.fillText('4.5', S / 2, S * 0.83);
    x.fillStyle = '#2a3a30'; x.font = '700 24px Inter, sans-serif'; x.fillText('ACIDIC', S / 2, S * 0.9);
  });
}

function hazardTexture() {
  return canvasTex(128, 128, (x, S) => {
    x.fillStyle = '#f2c21b'; x.fillRect(0, 0, S, S);
    x.fillStyle = '#20232a';
    for (let k = -S; k < S * 2; k += 32) { x.beginPath(); x.moveTo(k, 0); x.lineTo(k + 16, 0); x.lineTo(k + 16 - S, S); x.lineTo(k - S, S); x.fill(); }
  }, { wrap: true });
}
function beltTexture() {
  return canvasTex(64, 256, (x, W, H) => {
    x.fillStyle = '#2b2e33'; x.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 16) { x.fillStyle = '#4a4f57'; x.fillRect(0, y, W, 5); x.fillStyle = '#1c1e22'; x.fillRect(0, y + 5, W, 2); }
  }, { wrap: true });
}
/** Cloudy puff sprite: several soft lobes so it reads as vapour, not a lens smudge. */
function puffTexture() {
  return canvasTex(128, 128, (x, S) => {
    const rnd = mulberry32(17);
    for (let k = 0; k < 9; k++) {
      const cx = S / 2 + (rnd() - 0.5) * S * 0.35, cy = S / 2 + (rnd() - 0.5) * S * 0.35, r = S * (0.18 + rnd() * 0.16);
      const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(0.6, 'rgba(255,255,255,0.22)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.fillRect(0, 0, S, S);
    }
  });
}
function steamMaterial() {
  const mat = new THREE.MeshBasicMaterial({ map: puffTexture(), transparent: true, depthWrite: false, color: 0xf2fbf0, opacity: 0.9 });
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aFade; varying float vFade;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFade = aFade;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vFade;')
      .replace('#include <alphamap_fragment>', '#include <alphamap_fragment>\ndiffuseColor.a *= vFade;');
  };
  mat.customProgramCacheKey = () => 'lysoSteam2';
  return mat;
}

export function buildLysosomes() {
  const g = new THREE.Group(); g.name = 'lysosomes';
  const rnd = mulberry32(777);

  // ---------- materials (sage hull + steel; lime only where it glows)
  // hull locked to #2f6e3c, rough 0.5 / clearcoat 0.3 so it reads the same from above and at eye level
  // grime + edge wear: darker drips/soot toward the foot, lighter scuffs near the band edges (lathe v = height)
  const grime = canvasTex(256, 256, (x, W, H) => {
    const img = x.createImageData(W, H), d = img.data, rr = mulberry32(5);
    const drips = Array.from({ length: 40 }, () => ({ u: rr(), len: 0.15 + rr() * 0.5, w: 1 + rr() * 2.5, k: 0.08 + rr() * 0.14 }));
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const u = i / W, v = 1 - j / H; // v: 0 bottom → 1 top
      let g = 1 - 0.38 * Math.pow(1 - THREE.MathUtils.smoothstep(v, 0.0, 0.4), 1.5);   // soot at the foot
      g -= 0.12 * (tileFbm(u, v, 6, 3, 41) + 0.5);                                       // mottling
      for (const dr of drips) if (Math.abs(u - dr.u) * W < dr.w && v > 1 - dr.len) g -= dr.k * (1 - (1 - v) / dr.len);
      const scuff = Math.max(0, tileFbm(u * 2, v * 2, 10, 2, 77) * 2 - 0.35);
      g += scuff * 0.12;
      const k = (j * W + i) * 4, c = Math.max(0, Math.min(255, g * 255));
      d[k] = d[k + 1] = d[k + 2] = c; d[k + 3] = 255;
    }
    x.putImageData(img, 0, 0);
  }, { wrap: true });
  grime.repeat.set(3, 1);
  const bodyMat = organic(new THREE.MeshPhysicalMaterial({ color: 0x2f6e3c, map: grime, roughnessMap: grime, roughness: 0.55, clearcoat: 0.3, clearcoatRoughness: 0.4, metalness: 0 }),
    { rim: 0x8fc89a, rimPower: 3.0, rimStrength: 0.16, sss: 0x1a4a26, sssStrength: 0.05 });
  const steelMat = new THREE.MeshPhysicalMaterial({ color: 0xbfc6ce, metalness: 0.8, roughness: 0.3, clearcoat: 0.4, roughnessMap: M.metal().roughnessMap });
  const darkSteel = new THREE.MeshPhysicalMaterial({ color: 0x5b646d, metalness: 0.7, roughness: 0.35, clearcoat: 0.3 });
  const plinthMat = new THREE.MeshPhysicalMaterial({ color: 0xc5cbd2, roughness: 0.6, clearcoat: 0.2 });
  const darkMat = new THREE.MeshPhysicalMaterial({ color: 0x23282d, roughness: 0.5, clearcoat: 0.3 });
  const lidMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.7, clearcoat: 0, envMapIntensity: 0.15 }); // matte dark disc so the glowing arrows pop
  const emblemGlow = new THREE.MeshStandardMaterial({ color: 0xfafff0, emissive: 0xfff8e0, emissiveIntensity: 1.5, roughness: 0.3 }); // cream-white glow on the dark disc
  const emTex = emblemTexture();
  const decalMat = new THREE.MeshStandardMaterial({ map: emTex, emissive: 0xffffff, emissiveMap: emTex, emissiveIntensity: 0.9, transparent: true, alphaTest: 0.05, roughness: 0.35, side: THREE.FrontSide });
  const hazMat = new THREE.MeshPhysicalMaterial({ map: hazardTexture(), roughness: 0.4, clearcoat: 0.6 });
  const beltTex = beltTexture();
  const beltMat = new THREE.MeshStandardMaterial({ map: beltTex, roughness: 0.75 });
  const phTex = phTexture();
  const phMat = new THREE.MeshStandardMaterial({ map: phTex, emissive: 0xffffff, emissiveMap: phTex, emissiveIntensity: 0.55, roughness: 0.25 });
  const churnTex = churnTexture(false), debrisTex = churnTexture(true);
  const portMat = churning(new THREE.MeshStandardMaterial({ color: 0x0c2006, emissive: 0xffffff, emissiveMap: debrisTex, emissiveIntensity: 3.4, roughness: 0.2 }), 'port');
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xe6ffe0, roughness: 0.03, transparent: true, opacity: 0.18, clearcoat: 1, depthWrite: false, envMapIntensity: 1.5 });

  const G = { body: [], steel: [], dark2: [], plinth: [], dark: [], haz: [], belt: [], ph: [], port: [], glass: [], decal: [] };
  const rivets = [], needles = [], steam = [], lids = [], plants = [];
  const anchors = {}, footprints = [];

  LYSO.forEach((L, li) => {
    const r = L.r, H = r * 1.1 + 0.35, rh = r * 1.02; // rh: hull radius at its mid-height bulge
    const T0 = new THREE.Matrix4().makeTranslation(L.x, 0, L.z);
    const add = (key, geo) => { geo.applyMatrix4(T0); G[key].push(clean(geo)); };
    const face = Math.atan2(CAM_FACE.z - L.z, CAM_FACE.x - L.x);
    const polar = (a, rr, y) => new THREE.Vector3(Math.cos(a) * rr, y, Math.sin(a) * rr);
    const yawOut = (a) => Math.PI / 2 - a; // rotation.y so local +Z points along angle a
    const yb0 = 0.42, yb1 = H * 0.82; // steel band heights
    const A = { hatch: face + 0.95, gauge: face - 0.95, chute: face + 2.1, vent: face + Math.PI, ports: [face + 2.95, face + 3.75, face - 2.6, face - 1.85] };

    // plinth + hull + top opening (single lathe: outer wall → lip → inner wall)
    add('plinth', place(new THREE.CylinderGeometry(r + 0.32, r + 0.4, 0.14, 64), 0, 0.07, 0));
    add('dark', place(new THREE.TorusGeometry(r + 0.06, 0.06, 8, 64), 0, 0.15, 0, Math.PI / 2));
    const prof = [[r * 0.995, 0.12], [r * 1.01, 0.3], [r * 1.02, H * 0.5], [r * 1.01, H - 0.3], [r * 0.99, H - 0.12],
      [r - 0.2, H - 0.06], [r - 0.24, H - 0.2], [r - 0.24, H - 0.42]].map(([a, b]) => new THREE.Vector2(a, b));
    add('body', new THREE.LatheGeometry(prof, 80));
    add('steel', place(new THREE.TorusGeometry(r - 0.08, 0.11, 12, 80), 0, H - 0.07, 0, Math.PI / 2));
    // steel band rings + rivets + vertical seams
    for (const yb of [yb0, yb1]) {
      add('steel', new THREE.LatheGeometry([[r + 0.005, yb - 0.11], [r + 0.065, yb - 0.08], [r + 0.075, yb + 0.08], [r + 0.005, yb + 0.11]].map(([a, b]) => new THREE.Vector2(a, b)), 80));
      const n = Math.round(r * 14);
      for (let k = 0; k < n; k++) { const p = polar((k / n) * TAU, r + 0.075, yb); rivets.push(trs(L.x + p.x, p.y, L.z + p.z, 0, 0, 0, 0.028)); }
    }
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * TAU + face + 0.4, p = polar(a, rh + 0.008, (yb0 + yb1) / 2);
      add('dark2', place(new THREE.BoxGeometry(0.03, yb1 - yb0 - 0.2, 0.02), p.x, p.y, p.z, 0, yawOut(a), 0));
    }
    // glowing churning acid (per-plant material so each can surge on its own cycle)
    const acidMat = churning(new THREE.MeshStandardMaterial({ color: 0x173a06, emissive: 0xffffff, emissiveMap: churnTex, emissiveIntensity: 2.1, roughness: 0.18 }), 'acid' + li);
    const acid = new THREE.Mesh(place(new THREE.CircleGeometry(r - 0.23, 56), L.x, H - 0.34, L.z, -Math.PI / 2), acidMat);
    acid.name = `lysoAcid${li}`; g.add(acid);

    // camera-facing emblem decal (curved strip hugging the hull)
    {
      const hgt = Math.min(1.25, yb1 - yb0 - 0.32), dTheta = hgt / r;
      const dg = new THREE.CylinderGeometry(rh + 0.012, rh + 0.012, hgt, 24, 1, true, yawOut(face) - dTheta / 2, dTheta);
      dg.translate(0, (yb0 + yb1) / 2, 0); add('decal', dg);
    }
    // portholes: recessed tunnel, glowing debris churn behind glass, steel frame + bolts
    A.ports.forEach((a) => {
      const yy = (yb0 + yb1) / 2, pr = Math.min(0.24, r * 0.14), yaw = yawOut(a);
      const pIn = polar(a, rh + 0.012, yy), pOut = polar(a, rh + 0.085, yy), pFr = polar(a, rh + 0.09, yy), pT = polar(a, rh + 0.05, yy);
      add('port', place(new THREE.CircleGeometry(pr, 28), pIn.x, pIn.y, pIn.z, 0, yaw, 0));
      add('dark', place(new THREE.CylinderGeometry(pr + 0.01, pr + 0.01, 0.08, 24, 1, true).rotateX(Math.PI / 2).rotateY(yaw), pT.x, yy, pT.z));
      add('glass', place(new THREE.CircleGeometry(pr, 28), pOut.x, pOut.y, pOut.z, 0, yaw, 0));
      add('steel', place(new THREE.TorusGeometry(pr + 0.03, 0.05, 10, 32), pFr.x, pFr.y, pFr.z, 0, yaw, 0));
      for (let k = 0; k < 6; k++) { const q = new THREE.Vector3(Math.cos(k * TAU / 6) * (pr + 0.09), Math.sin(k * TAU / 6) * (pr + 0.09), 0.03).applyEuler(new THREE.Euler(0, yaw, 0)).add(pFr); rivets.push(trs(L.x + q.x, q.y, L.z + q.z, 0, 0, 0, 0.022)); }
    });

    // rotating lid: sage disc + steel ring + raised glowing Möbius emblem + spokes
    const R = r * 0.6;
    const lidG = [
      colorize(place(new THREE.CylinderGeometry(R, R * 1.02, 0.14, 64), 0, 0, 0), new THREE.Color(0x163d22)),
      colorize(place(new THREE.TorusGeometry(R, 0.05, 8, 64), 0, 0.07, 0, Math.PI / 2), new THREE.Color(0xc4ccd4)),
      colorize(place(new THREE.CylinderGeometry(0.1, 0.1, 0.5, 12), 0, -0.3, 0), new THREE.Color(0x9aa3ad)),
    ];
    for (let k = 0; k < 3; k++) {
      const a = k * TAU / 3 + 1.3, len = r - 0.2 - R + 0.1;
      const sp = new THREE.BoxGeometry(len, 0.05, 0.08); sp.translate(R + len / 2 - 0.05, -0.02, 0); sp.rotateY(-a);
      lidG.push(colorize(sp, new THREE.Color(0x9aa3ad)));
    }
    const lid = new THREE.Mesh(mergeGeometries(lidG), lidMat);
    lid.position.set(L.x, H - 0.02, L.z); lid.castShadow = lid.receiveShadow = true; lid.name = `lysoLid${li}`;
    lid.userData.speed = 0.16 + rnd() * 0.06;
    const sym = new THREE.ExtrudeGeometry(mobiusShapes(R * 0.82), { depth: 0.06, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.012, bevelSegments: 2 });
    sym.rotateX(-Math.PI / 2); sym.translate(0, 0.07, 0);
    const symMesh = new THREE.Mesh(sym, emblemGlow); symMesh.castShadow = true; lid.add(symMesh);
    g.add(lid); lids.push(lid);

    // intake hatch + conveyor (worn part rides in)
    const plant = { li, r, H, acidMat, acid, phase: li * 3.1 };
    {
      const a = A.hatch, yaw = yawOut(a);
      const m = new THREE.Matrix4().makeRotationY(yaw).setPosition(polar(a, r, 0));
      const addm = (key, geo) => { geo.applyMatrix4(m); add(key, geo); };
      const hw = Math.min(0.9, r * 0.5), cl = 0.85, cy = 0.42;
      addm('haz', place(new RoundedBoxGeometry(hw + 0.16, 0.8, 0.42, 2, 0.05), 0, 0.55, 0.12));
      addm('dark', place(new RoundedBoxGeometry(hw - 0.06, 0.55, 0.1, 2, 0.03), 0, 0.5, 0.31));
      addm('steel', place(new RoundedBoxGeometry(hw + 0.24, 0.08, 0.5, 2, 0.03), 0, 0.98, 0.14));
      for (let k = 0; k < 4; k++) addm('dark', place(new THREE.BoxGeometry((hw - 0.12) / 4 - 0.015, 0.4, 0.015), -((hw - 0.12) / 2) + ((hw - 0.12) / 4) * (k + 0.5), 0.56, 0.36));
      addm('steel', place(new RoundedBoxGeometry(hw - 0.02, 0.1, cl, 2, 0.03), 0, cy - 0.06, 0.33 + cl / 2));
      const belt = new THREE.PlaneGeometry(hw - 0.14, cl); belt.rotateX(-Math.PI / 2); belt.translate(0, cy + 0.003, 0.33 + cl / 2); addm('belt', belt);
      for (const sx of [-1, 1]) {
        addm('steel', place(new THREE.BoxGeometry(0.04, 0.1, cl), sx * (hw / 2 - 0.02), cy + 0.03, 0.33 + cl / 2));
        addm('dark', place(new THREE.CylinderGeometry(0.03, 0.03, cy - 0.1, 8), sx * (hw / 2 - 0.08), (cy - 0.1) / 2, 0.33 + cl - 0.08));
      }
      plant.in0 = new THREE.Vector3(0, cy + 0.1, 0.33 + cl - 0.05).applyMatrix4(m).applyMatrix4(T0);
      plant.in1 = new THREE.Vector3(0, cy + 0.1, 0.3).applyMatrix4(m).applyMatrix4(T0);
      plant.yaw = yaw;
      const an = new THREE.Vector3(0, 0.6, 0.33 + cl + 0.4).applyMatrix4(m).applyMatrix4(T0);
      anchors[li === 0 ? 'lysoIntake' : `lysoIntake${li}`] = [+an.x.toFixed(2), 0.6, +an.z.toFixed(2)];
      const fc = new THREE.Vector3(0, 0, 0.33 + cl / 2).applyMatrix4(m).applyMatrix4(T0);
      footprints.push({ type: 'box', x: fc.x, z: fc.z, w: hw + 0.1, d: cl + 0.2, rot: yaw, id: `lyso${li}` });
    }
    // output chute (recycled pellets roll out)
    {
      const a = A.chute, yaw = yawOut(a);
      const m = new THREE.Matrix4().makeRotationY(yaw).setPosition(polar(a, r, 0));
      const addm = (key, geo) => { geo.applyMatrix4(m); add(key, geo); };
      addm('steel', place(new RoundedBoxGeometry(0.5, 0.36, 0.22, 2, 0.04), 0, 0.72, 0.08));
      addm('dark', place(new RoundedBoxGeometry(0.34, 0.22, 0.05, 2, 0.02), 0, 0.72, 0.2));
      const ch = new THREE.CylinderGeometry(0.13, 0.13, 0.62, 16, 1, true, Math.PI / 2, Math.PI); ch.rotateX(Math.PI / 2 + 0.62); ch.translate(0, 0.42, 0.4); addm('steel', ch);
      const bin = new THREE.CylinderGeometry(0.2, 0.17, 0.2, 20, 1, true); bin.translate(0, 0.1, 0.72); addm('dark2', bin);
      addm('dark', place(new THREE.CylinderGeometry(0.17, 0.17, 0.02, 20), 0, 0.02, 0.72));
      plant.out0 = new THREE.Vector3(0, 0.66, 0.16).applyMatrix4(m).applyMatrix4(T0);
      plant.out1 = new THREE.Vector3(0, 0.12, 0.72).applyMatrix4(m).applyMatrix4(T0);
    }
    // pH gauge (2× size, on a bracket so it stands proud of the bands)
    {
      const a = A.gauge, yaw = yawOut(a), yy = Math.min(H * 0.55, yb1 - 0.55), gr = Math.min(0.48, r * 0.27);
      const p = polar(a, r + 0.09, yy);
      add('dark', place(new THREE.CylinderGeometry(gr + 0.04, gr + 0.04, 0.12, 40).rotateX(Math.PI / 2).rotateY(yaw), p.x, p.y, p.z));
      const fp = polar(a, r + 0.155, yy);
      add('ph', place(new THREE.CircleGeometry(gr, 48), fp.x, fp.y, fp.z, 0, yaw, 0));
      add('steel', place(new THREE.TorusGeometry(gr + 0.02, 0.045, 10, 48), fp.x, fp.y, fp.z, 0, yaw, 0));
      const np = polar(a, r + 0.17, yy);
      needles.push({ x: L.x + np.x, y: np.y, z: L.z + np.z, yaw, ph: rnd() * 6, s: gr / 0.27 });
      const key = li === 0 ? 'phGauge' : `phGauge${li}`, ap = polar(a, r + 1.1, 0);
      anchors[key] = [+(L.x + fp.x).toFixed(2), +yy.toFixed(2), +(L.z + fp.z).toFixed(2)];
      anchors[key + 'Stand'] = [+(L.x + ap.x).toFixed(2), 0, +(L.z + ap.z).toFixed(2)];
    }
    // vent stack on the rim (steam source)
    {
      const p = polar(A.vent, r - 0.08, H);
      add('steel', place(new THREE.CylinderGeometry(0.09, 0.11, 0.55, 14), p.x, H + 0.2, p.z));
      add('dark', place(new THREE.CylinderGeometry(0.14, 0.1, 0.08, 14), p.x, H + 0.5, p.z));
      for (let k = 0; k < 24; k++) steam.push({ x: L.x + p.x, y: H + 0.55, z: L.z + p.z, ph: k / 24 + rnd() * 0.02, drift: rnd() * TAU, spin: (rnd() - 0.5) * 2, sz: 0.7 + rnd() * 0.6, plant });
    }
    footprints.push({ type: 'circle', x: L.x, z: L.z, r: r + 0.4, id: `lyso${li}` });
    anchors[`lyso${li}`] = [L.x, 0, L.z];
    if (li === 0) {
      const c = polar(face, r + 7, 0);
      anchors.examineCam = [+(L.x + c.x).toFixed(2), +(H + 4.5).toFixed(2), +(L.z + c.z).toFixed(2)];
      anchors.examineTarget = [L.x, +(H * 0.6).toFixed(2), L.z];
    }
    plant.light = new THREE.PointLight(0xa6ff4a, 2 + r * 0.5, r * 3, 1.8); plant.light.position.set(L.x, H + 0.8, L.z); g.add(plant.light);
    plant.baseLight = plant.light.intensity;
    plants.push(plant);
  });

  const addMerged = (key, mat, shadow = true) => {
    if (!G[key].length) return null;
    const mesh = new THREE.Mesh(mergeGeometries(G[key]), mat); mesh.name = `lyso_${key}`;
    mesh.castShadow = shadow; mesh.receiveShadow = true; g.add(mesh); return mesh;
  };
  addMerged('body', bodyMat); addMerged('steel', steelMat); addMerged('dark2', darkSteel); addMerged('plinth', plinthMat);
  addMerged('dark', darkMat); addMerged('haz', hazMat); addMerged('belt', beltMat); addMerged('ph', phMat, false);
  addMerged('port', portMat, false); addMerged('decal', decalMat, false);
  const glassMesh = addMerged('glass', glassMat, false); if (glassMesh) glassMesh.renderOrder = 3;
  g.add(instanced(new THREE.SphereGeometry(1, 8, 6), M.metal(0xd8dde3, 0.25), rivets, { castShadow: false }));

  const needleGeo = new THREE.BoxGeometry(0.022, 0.21, 0.014); needleGeo.translate(0, 0.09, 0);
  const needleMesh = instanced(needleGeo, M.emissive(0xff3a1a, 2.5), needles.map(() => new THREE.Matrix4()), { castShadow: false });
  g.add(needleMesh);
  // worn parts (one per plant per cycle, kind cycles) + recycled pellets + digestion bubbles
  const itemCols = [new THREE.Color(0xe07a2e), new THREE.Color(0x8e4fd0), new THREE.Color(0x8a8f96)];
  const itemMesh = instanced(new RoundedBoxGeometry(0.24, 0.18, 0.24, 2, 0.05), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.4, clearcoat: 0.6 }), plants.map(() => new THREE.Matrix4()), { castShadow: true, colors: plants.map((p, i) => itemCols[i % 3]) });
  const pelletMesh = instanced(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshStandardMaterial({ color: 0xeaffd0, emissive: 0xc8ff6a, emissiveIntensity: 2.4, roughness: 0.3 }), plants.flatMap(() => [0, 1, 2].map(() => new THREE.Matrix4())), { castShadow: false });
  const bubbleMesh = instanced(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshStandardMaterial({ color: 0xd8ffb0, emissive: 0xb8ff5a, emissiveIntensity: 3, roughness: 0.2, transparent: true, opacity: 0.85 }), plants.flatMap(() => Array.from({ length: 14 }, () => new THREE.Matrix4())), { castShadow: false });
  const bubbleSeeds = plants.flatMap(() => Array.from({ length: 14 }, () => ({ a: rnd() * TAU, d: Math.sqrt(rnd()), ph: rnd(), s: 0.04 + rnd() * 0.06 })));
  g.add(itemMesh, pelletMesh, bubbleMesh);
  // steam puffs
  const steamGeo = new THREE.PlaneGeometry(1, 1);
  const fade = new THREE.InstancedBufferAttribute(new Float32Array(steam.length), 1);
  steamGeo.setAttribute('aFade', fade);
  const steamMesh = new THREE.InstancedMesh(steamGeo, steamMaterial(), steam.length);
  steamMesh.frustumCulled = false; steamMesh.renderOrder = 5; steamMesh.name = 'lysoSteam';
  g.add(steamMesh);

  g.userData.anchors = anchors;
  g.userData.footprints = footprints;

  const q = new THREE.Quaternion(), qz = new THREE.Quaternion(), s = new THREE.Vector3(), pV = new THREE.Vector3(), mm = new THREE.Matrix4(), e = new THREE.Euler();
  const Z = new THREE.Vector3(0, 0, 1);
  let camQ = new THREE.Quaternion();
  steamMesh.onBeforeRender = (r, sc, cam) => { camQ = cam.quaternion; };
  let last = 0;
  const smooth = (a, b, x) => THREE.MathUtils.smoothstep(x, a, b);
  g.userData.update = (t) => {
    const dt = Math.min(0.1, Math.max(0, t - last)); last = t;
    portMat.userData.time.value = t * 0.8;
    lids.forEach((l) => { l.rotation.y = -t * l.userData.speed; });
    beltTex.offset.y = (t * 0.35) % 1;
    plants.forEach((p, pi) => {
      const c = (t + p.phase) % CYCLE;
      // 0–3.2 s: worn part rides in · 3.2–6 s: digestion surge · 5.6–8.8 s: pellets roll out
      const surge = smooth(3.0, 3.6, c) * (1 - smooth(5.4, 6.4, c));
      p.acidTime = (p.acidTime || 0) + dt * (1 + surge * 3.5);
      p.acidMat.userData.time.value = p.acidTime;
      p.acidMat.emissiveIntensity = 2.1 + surge * (1.8 + Math.sin(t * 14) * 0.3);
      p.light.intensity = p.baseLight * (1 + surge * 1.8);
      const k = Math.min(1, c / 3.2);
      pV.copy(p.in0).lerp(p.in1, k);
      const sc = c < 3.2 ? (k > 0.9 ? (1 - k) / 0.1 : Math.min(1, k / 0.05)) : 0;
      itemMesh.setMatrixAt(pi, mm.compose(pV, q.setFromEuler(e.set(0, p.yaw + k * 0.5, 0)), s.setScalar(Math.max(0.001, sc))));
      for (let j = 0; j < 3; j++) {
        const w = THREE.MathUtils.clamp((c - 5.6 - j * 0.8) / 1.6, 0, 1);
        pV.copy(p.out0).lerp(p.out1, w); pV.y += Math.sin(w * Math.PI) * 0.05;
        const vis = w > 0 && w < 1 ? 1 : (w >= 1 && c < 8.8 ? 1 : 0);
        pelletMesh.setMatrixAt(pi * 3 + j, mm.compose(pV, q.identity(), s.setScalar(0.07 * vis + 0.0001)));
      }
      for (let j = 0; j < 14; j++) {
        const b = bubbleSeeds[pi * 14 + j];
        const u = ((t * 0.9 + b.ph) % 1);
        const rr = (p.r - 0.35) * b.d;
        pV.set(LYSO[p.li].x + Math.cos(b.a + u) * rr, p.H - 0.34 + u * 0.9, LYSO[p.li].z + Math.sin(b.a + u) * rr);
        bubbleMesh.setMatrixAt(pi * 14 + j, mm.compose(pV, q.identity(), s.setScalar(b.s * surge * (1 - u * 0.7) + 0.0001)));
      }
    });
    itemMesh.instanceMatrix.needsUpdate = true; pelletMesh.instanceMatrix.needsUpdate = true; bubbleMesh.instanceMatrix.needsUpdate = true;
    needles.forEach((n, i) => {
      needleMesh.setMatrixAt(i, mm.compose(pV.set(n.x, n.y, n.z), q.setFromEuler(e.set(0, n.yaw, 0.84 + Math.sin(t * 1.7 + n.ph) * 0.05 + Math.sin(t * 9 + n.ph) * 0.015, 'YXZ')), s.set(n.s, n.s, 1)));
    });
    needleMesh.instanceMatrix.needsUpdate = true;
    steam.forEach((p, i) => {
      const k = (t * 0.16 + p.ph) % 1;
      const boost = 1 + (p.plant.acidMat.emissiveIntensity - 2.1) * 0.15;
      const turb = Math.sin(t * 1.3 + i) * 0.12 * k;
      pV.set(p.x + Math.sin(p.drift) * k * 0.7 + turb, p.y + Math.pow(k, 0.8) * 2.2, p.z + Math.cos(p.drift) * k * 0.7 - turb);
      qz.setFromAxisAngle(Z, p.spin * t + i);
      steamMesh.setMatrixAt(i, mm.compose(pV, q.copy(camQ).multiply(qz), s.setScalar((0.18 + k * 0.75) * p.sz * boost)));
      fade.array[i] = Math.pow(Math.sin(Math.PI * Math.min(1, k * 1.05)), 1.3) * 0.5;
    });
    fade.needsUpdate = true;
    steamMesh.instanceMatrix.needsUpdate = true;
  };
  return g;
}
