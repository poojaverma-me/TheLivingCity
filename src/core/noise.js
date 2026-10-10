// Small deterministic noise toolkit (seeded RNG, 2D/3D value-gradient noise, fbm).

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PERM = new Uint8Array(512);
{
  const r = mulberry32(1337);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
}
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a, b, t) => a + (b - a) * t;
function grad3(h, x, y, z) {
  const u = h < 8 ? x : y, v = h < 4 ? y : (h === 12 || h === 14 ? x : z);
  return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
}

/** Classic Perlin noise, range ~[-1,1]. */
export function perlin3(x, y, z) {
  const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
  x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
  const u = fade(x), v = fade(y), w = fade(z);
  const A = PERM[X] + Y, AA = PERM[A] + Z, AB = PERM[A + 1] + Z;
  const B = PERM[X + 1] + Y, BA = PERM[B] + Z, BB = PERM[B + 1] + Z;
  return lerp(
    lerp(lerp(grad3(PERM[AA] & 15, x, y, z), grad3(PERM[BA] & 15, x - 1, y, z), u),
      lerp(grad3(PERM[AB] & 15, x, y - 1, z), grad3(PERM[BB] & 15, x - 1, y - 1, z), u), v),
    lerp(lerp(grad3(PERM[AA + 1] & 15, x, y, z - 1), grad3(PERM[BA + 1] & 15, x - 1, y, z - 1), u),
      lerp(grad3(PERM[AB + 1] & 15, x, y - 1, z - 1), grad3(PERM[BB + 1] & 15, x - 1, y - 1, z - 1), u), v),
    w);
}
export const perlin2 = (x, y) => perlin3(x, y, 0.5);

export function fbm3(x, y, z, oct = 4, lac = 2, gain = 0.5) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { s += a * perlin3(x * f, y * f, z * f); f *= lac; a *= gain; }
  return s;
}
export const fbm2 = (x, y, oct, lac, gain) => fbm3(x, y, 0.37, oct, lac, gain);

function grad2(h, x, y) {
  const g = h & 7;
  const u = g < 4 ? x : y, v = g < 4 ? y : x;
  return ((g & 1) ? -u : u) + ((g & 2) ? -2 * v : 2 * v);
}
/** Periodic 2D Perlin noise (period px, py in lattice cells). */
export function perlin2p(x, y, px, py, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const s = seed & 255;
  const h = (i, j) => PERM[(PERM[(((i % px) + px) % px + s) & 255] + (((j % py) + py) % py)) & 511];
  const u = fade(xf), v = fade(yf);
  return lerp(
    lerp(grad2(h(xi, yi), xf, yf), grad2(h(xi + 1, yi), xf - 1, yf), u),
    lerp(grad2(h(xi, yi + 1), xf, yf - 1), grad2(h(xi + 1, yi + 1), xf - 1, yf - 1), u), v) * 0.5;
}
/** Seamlessly tileable fbm over u,v in [0,1). `scale` = lattice cells per tile (int). */
export function tileFbm(u, v, scale = 4, oct = 4, seed = 0) {
  let s = 0, amp = 0.5, f = scale;
  for (let i = 0; i < oct; i++) {
    s += amp * perlin2p(u * f, v * f, f, f, seed + i * 31);
    f *= 2; amp *= 0.5;
  }
  return s;
}
