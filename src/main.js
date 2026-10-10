import * as THREE from 'three';
import { createRenderer, createStudio, createPost, fitShadow } from './core/renderer.js';
import { CameraRig } from './core/cameraRig.js';
import { buildWorld } from './world/world.js';
import { LightPool } from './core/lightPool.js';
import { SHOTS } from './world/layout.js';
import { resolveQuality, applyQuality, rememberAutoTier, lowerTier, TIERS } from './core/quality.js';
import './ui/styles.css';

const params = new URLSearchParams(location.search);
const Q = resolveQuality();
const quality = Q.tier === 'high' ? 'high' : 'low'; // renderer/post construction flavour
// ?shot=<preset> = static QA camera (no gameplay); otherwise the game runs.
const qaMode = params.has('shot') && params.get('shot') !== 'game';
const container = document.getElementById('app');

const renderer = createRenderer(container, { quality });
const scene = new THREE.Scene();
const studio = createStudio(renderer, scene);
const camera = new THREE.PerspectiveCamera(32, container.clientWidth / container.clientHeight, 0.5, 900);
const rig = new CameraRig(camera);
const post = createPost(renderer, scene, camera, { quality });

const world = buildWorld(scene, { quality: Q.settings });
// Tiny props don't need to cast shadows (they barely show, and the shadow pass is expensive)
{
  const sph = new THREE.Sphere();
  world.root.traverse((o) => {
    if (!o.isMesh || !o.castShadow || o.isInstancedMesh || o.isSkinnedMesh) return;
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
    sph.copy(o.geometry.boundingSphere).applyMatrix4(o.matrixWorld);
    if (sph.radius < 0.35) o.castShadow = false;
  });
}
renderer.shadowMap.autoUpdate = false;
const lightPool = new LightPool(scene, world.root, 6);
const qctx = { renderer, post, studio, lightPool, shadowEvery: 2, setDprRange: (a, b) => setDprRange(a, b) };
rig.shot(qaMode ? params.get('shot') : 'overview');

let game = null;
if (qaMode) installDevCamera();
else {
  const { Game } = await import('./game/game.js');
  game = new Game({ renderer, scene, camera, rig, world, post, studio });
  await game.init();
}

function installDevCamera() {
  let drag = null;
  renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
  renderer.domElement.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, b: e.button }; });
  window.addEventListener('pointerup', () => { drag = null; });
  window.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
    if (drag.b === 2) rig.orbit(dx, dy);
    else {
      const s = rig.dist * 0.0018, fx = Math.sin(rig.yaw), fz = Math.cos(rig.yaw);
      rig.goal.target.x -= (dx * fz + dy * fx) * s; rig.goal.target.z -= (-dx * fx + dy * fz) * s;
    }
  });
  renderer.domElement.addEventListener('wheel', (e) => { rig.goal.dist = THREE.MathUtils.clamp(rig.goal.dist * (1 + e.deltaY * 0.001), 4, 160); }, { passive: true });
  window.addEventListener('keydown', (e) => { if (e.key === 'q') rig.rotateStep(-1); if (e.key === 'e') rig.rotateStep(1); });
}

function resize() {
  const w = container.clientWidth, h = container.clientHeight;
  renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
  post.composer.setSize(w, h);
}
window.addEventListener('resize', resize);

const clock = new THREE.Clock();
let frames = 0;
const focus = new THREE.Vector3(), origin = new THREE.Vector3();
renderer.info.autoReset = false;

// Adaptive resolution: keep frame time near 60 fps by trading pixel density inside the tier's range.
let DPR_MAX = renderer.getPixelRatio(), DPR_MIN = Math.min(1, DPR_MAX);
function setDprRange(lo, hi) {
  const dev = window.devicePixelRatio || 1;
  DPR_MAX = Math.min(dev, hi); DPR_MIN = Math.min(DPR_MAX, lo);
  const cur = renderer.getPixelRatio();
  const next = Math.min(DPR_MAX, Math.max(DPR_MIN, cur));
  if (next !== cur) { renderer.setPixelRatio(next); resize(); }
}
// Timing uses real (unclamped) frame time: the game's dt is capped at 50 ms for animation stability,
// which would make a slow machine's probes take many times longer than intended.
let ftAvg = 16, dprTimer = 0, upHold = 0, upCooldown = 8, lastDown = -1e9, lastRaw = performance.now();

let tier = Q.tier;
applyQuality(tier, qctx);
let probe = { t: 0, n: 0, sum: 0 };
function autoQuality(dt) {
  if (!Q.auto || qaMode || tier === 'low') return;
  probe.t += dt;
  if (probe.t < 3) return;                 // let shaders compile / caches warm first
  probe.n++; probe.sum += dt;              // dt here is real seconds (see frame())
  if (probe.t < 7) return;
  const ms = (probe.sum / probe.n) * 1000;
  if (ms > 30 && renderer.getPixelRatio() <= DPR_MIN + 0.01) {
    tier = lowerTier(tier); rememberAutoTier(tier); applyQuality(tier, qctx);
    window.__city.quality = tier;
  } else if (ms <= 30) rememberAutoTier(tier);
  probe = { t: 0, n: 0, sum: 0 };
}
window.addEventListener('graphicschange', (e) => {
  // the choice is already saved; re-resolve so "auto" falls back to detection / the remembered auto tier
  const R = resolveQuality();
  Q.auto = R.auto; tier = R.tier; probe = { t: 0, n: 0, sum: 0 };
  applyQuality(tier, qctx);
  window.__city.quality = tier;
});
function adaptResolution(dt) {
  if (qaMode) return;
  const ms = dt * 1000, now = performance.now();
  ftAvg += (ms - ftAvg) * 0.05; dprTimer += dt;
  const cur = renderer.getPixelRatio();
  // step down quickly when frames are slow
  if (dprTimer >= 1.5 && ftAvg > 21 && cur > DPR_MIN) {
    renderer.setPixelRatio(Math.max(DPR_MIN, cur - 0.15)); resize(); dprTimer = 0; upHold = 0;
    if (now - lastDown < upCooldown * 1000 + 3000) upCooldown = Math.min(60, upCooldown * 2); // flapping: back off
    lastDown = now; return;
  }
  // step back up only after holding vsync-speed (~60 fps) for a while; on a 60 Hz screen frames never
  // get much under 16.7 ms, so "has headroom" means "steadily at the refresh rate"
  upHold = ftAvg < 18 ? upHold + dt : 0;
  if (upHold > 4 && cur < DPR_MAX && now - lastDown > upCooldown * 1000) {
    renderer.setPixelRatio(Math.min(DPR_MAX, cur + 0.1)); resize(); dprTimer = 0; upHold = 0;
  }
}
function frame() {
  renderer.info.reset();
  const dt = Math.min(clock.getDelta(), 0.05);
  const nowRaw = performance.now(), rawDt = Math.min((nowRaw - lastRaw) / 1000, 1); lastRaw = nowRaw;
  const t = clock.elapsedTime;
  if (game) game.update(dt, t); else rig.update(dt);
  // shadow frustum follows the view: whole cell in overview, tight around the target up close
  focus.copy(rig.target); focus.y = 0;
  fitShadow(studio.key, rig.dist > 80 ? origin : focus, rig.dist > 80 ? 62 : Math.max(16, rig.dist * 1.15));
  // miniature-photo tilt-shift only for the far poster overview (never at street level)
  post.tiltPass.enabled = post.allowTilt !== false && !rig.fp && rig.dist > 120;
  world.update(t, dt, camera);
  lightPool.update(dt, rig.target);
  // shadows refresh every other frame (or immediately when the camera jumps)
  if (frames % qctx.shadowEvery === 0 || rig.mode === 'flight') renderer.shadowMap.needsUpdate = true;
  adaptResolution(rawDt);
  autoQuality(rawDt);
  post.composer.render(dt);
  if (++frames === 30) window.__city.ready = true;
  if (frames === 12) { const b = document.getElementById('boot'); if (b) { b.style.transition = 'opacity .45s'; b.style.opacity = '0'; setTimeout(() => { b.style.display = 'none'; b.remove(); }, 500); } }
  requestAnimationFrame(frame);
}

window.__city = {
  ready: false, scene, camera, rig, renderer, world, post, studio, get game() { return game; },
  quality: Q.tier, gpu: Q.gpu, tiers: TIERS,
  shot: (n) => rig.shot(n), shots: Object.keys(SHOTS),
  cam: (pos, target, fov = 38) => rig.setPose({ ...CameraRig.fromPose(pos, target), fov }),
  info: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, geos: renderer.info.memory.geometries, tex: renderer.info.memory.textures }),
};
requestAnimationFrame(frame);
