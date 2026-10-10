// Graphics quality tiers: auto-detected from the GPU, refined by a short frame-time check, and
// overridable by the player (Help → Graphics) or the URL (?q=low|medium|high).
//
// Settings that need a rebuild (crowd size, motes, light slots) are read once at startup; everything
// else (resolution range, AO, shadows, tilt-shift, bloom detail) is applied live by applyQuality().

const KEY_CHOICE = 'livingCity.graphics';   // 'auto' | 'low' | 'medium' | 'high' (player's choice)
const KEY_AUTO = 'livingCity.autoTier';     // tier the auto mode settled on last time (after the fps check)

export const TIERS = {
  low: {
    label: 'Low', dpr: [0.6, 1.0], ao: false, shadowMap: 1024, shadowEvery: 4, tilt: false, bloomLevels: 4,
    crowd: 50, motes: 120, lightSlots: 3, traffic: 6,
  },
  medium: {
    label: 'Medium', dpr: [0.85, 1.25], ao: 'Low', shadowMap: 2048, shadowEvery: 3, tilt: true, bloomLevels: 5,
    crowd: 90, motes: 280, lightSlots: 4, traffic: 8,
  },
  high: {
    label: 'High', dpr: [1.0, 1.5], ao: 'Medium', shadowMap: 4096, shadowEvery: 2, tilt: true, bloomLevels: 6,
    crowd: 140, motes: 450, lightSlots: 6, traffic: 9,
  },
};
const ORDER = ['low', 'medium', 'high'];

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode: session only */ } },
};

/** Best guess from the GPU name, CPU threads and memory (no rendering needed). */
export function detectTier() {
  let gpu = '';
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
    gpu = (ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl?.getParameter(gl.RENDERER)) || '';
  } catch { /* no WebGL2: the game can't run anyway */ }
  const g = gpu.toLowerCase();
  const cores = navigator.hardwareConcurrency || 4, mem = navigator.deviceMemory || 8;
  let tier;
  if (/swiftshader|llvmpipe|software|basic render|microsoft basic/.test(g)) tier = 'low';
  else if (/apple m\d|apple gpu|rtx|gtx 1[06-9]|gtx 16|radeon rx|radeon pro|arc a\d|quadro|geforce [4-9]\d{2}/.test(g)) tier = 'high';
  else if (/iris xe|radeon\(tm\) graphics|radeon graphics|vega|780m|680m|mx\d{3}/.test(g)) tier = 'medium';
  else if (/intel|uhd|hd graphics|mali|adreno|powervr|iris/.test(g)) tier = 'low';
  else tier = 'medium';
  if (mem <= 4 || cores <= 4) tier = ORDER[Math.min(ORDER.indexOf(tier), 1)]; // weak CPU/RAM: at most medium
  if (mem <= 2) tier = 'low';
  return { tier, gpu };
}

/** Resolve the tier to use right now. */
export function resolveQuality() {
  const url = new URLSearchParams(location.search).get('q');
  const choice = store.get(KEY_CHOICE) || 'auto';
  const detected = detectTier();
  let tier;
  if (url && TIERS[url]) tier = url;
  else if (choice !== 'auto' && TIERS[choice]) tier = choice;
  else tier = TIERS[store.get(KEY_AUTO)] ? store.get(KEY_AUTO) : detected.tier;
  return { tier, choice: url ? url : choice, auto: !url && choice === 'auto', gpu: detected.gpu, settings: TIERS[tier] };
}

export function setQualityChoice(choice) { store.set(KEY_CHOICE, choice); }
export function rememberAutoTier(tier) { store.set(KEY_AUTO, tier); }
export const lowerTier = (t) => ORDER[Math.max(0, ORDER.indexOf(t) - 1)];
export const higherTier = (t) => ORDER[Math.min(ORDER.length - 1, ORDER.indexOf(t) + 1)];

/** Apply the live-switchable parts of a tier. `ctx` = { renderer, post, studio, lightPool, setDprRange }. */
export function applyQuality(tier, ctx) {
  const s = TIERS[tier];
  const { renderer, post, studio } = ctx;
  ctx.setDprRange(s.dpr[0], s.dpr[1]);
  post.ao.enabled = !!s.ao;
  if (s.ao) { post.ao.setQualityMode(s.ao); post.ao.configuration.halfRes = true; }
  post.allowTilt = s.tilt;
  if (post.bloom.mipmapBlurPass) post.bloom.mipmapBlurPass.levels = s.bloomLevels;
  const sh = studio.key.shadow;
  if (sh.mapSize.x !== s.shadowMap) {
    sh.mapSize.set(s.shadowMap, s.shadowMap);
    if (sh.map) { sh.map.dispose(); sh.map = null; }
  }
  ctx.shadowEvery = s.shadowEvery;
  ctx.lightPool?.setActive?.(s.lightSlots);
  renderer.shadowMap.needsUpdate = true;
}
