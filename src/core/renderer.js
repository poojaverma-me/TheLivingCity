// Renderer, studio lighting and post-processing pipeline (AO, bloom, tilt-shift, AgX, SMAA).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  EffectComposer, RenderPass, EffectPass, BloomEffect, SMAAEffect, SMAAPreset,
  ToneMappingEffect, ToneMappingMode, VignetteEffect, TiltShiftEffect, BrightnessContrastEffect, HueSaturationEffect,
} from 'postprocessing';
import { N8AOPostPass } from 'n8ao';
import { setMaxAnisotropy } from './textures.js';
import { createStudioEnv, GradeEffect, SanitizeEffect } from './lookdev.js';

export function createRenderer(container, { quality = 'high' } = {}) {
  const renderer = new THREE.WebGLRenderer({
    antialias: false, stencil: false, depth: true, powerPreference: 'high-performance', preserveDrawingBuffer: false,
  });
  const dpr = Math.min(window.devicePixelRatio, quality === 'high' ? 1.5 : 1.0);
  renderer.setPixelRatio(dpr);
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping; // done in post
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);
  setMaxAnisotropy(renderer.capabilities.getMaxAnisotropy());
  return renderer;
}

/** Bright white "photo studio" world: env map, key/fill lights, shadow-catcher table. */
export function createStudio(renderer, scene) {
  const env = createStudioEnv(renderer);
  scene.environment = env;
  scene.environmentIntensity = 0.55;
  // Studio cyclorama: pure white table below the horizon (overview stays poster-white), a soft pastel
  // sky above it so eye-level views don't stare into a void. Intensity >1 keeps white white after tone mapping.
  scene.background = cycloramaTexture();
  scene.backgroundIntensity = 1.4;

  const hemi = new THREE.HemisphereLight(0xe4eeff, 0xc7ab8a, 0.35);
  scene.add(hemi);

  // Key light: large soft source from upper-left-front (matches reference shading on dome & pods)
  const key = new THREE.DirectionalLight(0xffe6c8, 4.4);
  key.position.set(-58, 84, -46); // back-left: shadows fall toward the viewer and ground every object
  key.target.position.set(0, 0, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(4096, 4096);
  const sc = key.shadow.camera;
  sc.left = -62; sc.right = 62; sc.top = 62; sc.bottom = -62; sc.near = 20; sc.far = 260;
  key.shadow.bias = -0.00025;
  key.shadow.normalBias = 0.035;
  key.shadow.radius = 3.5;
  key.shadow.blurSamples = 16;
  scene.add(key, key.target);

  // Cool rim from back-right so silhouettes separate from the white ground
  const rim = new THREE.DirectionalLight(0xc9dcff, 0.9); // cool front-right fill
  rim.position.set(55, 40, 75);
  scene.add(rim);

  // Shadow catcher "table": pure white, only shows shadows
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1200, 1200),
    new THREE.ShadowMaterial({ color: 0x4a5566, opacity: 0.32 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -1.6;
  ground.receiveShadow = true;
  ground.renderOrder = -1;
  scene.add(ground);

  return { env, hemi, key, rim, ground };
}

function cycloramaTexture() {
  const W = 64, H = 512; const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, H);
  // v=0 → zenith (+90°), v=0.5 → horizon, v=1 → nadir
  g.addColorStop(0.0, '#a9c0e8');
  g.addColorStop(0.3, '#c3d3ef');
  g.addColorStop(0.45, '#dde6f6');
  g.addColorStop(0.49, '#eef2fa');
  g.addColorStop(0.515, '#ffffff');
  g.addColorStop(1.0, '#ffffff');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const t = new THREE.CanvasTexture(c);
  t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Fit the shadow frustum around a focus point; tighter when zoomed in for crisp contact shadows. */
export function fitShadow(key, focus, radius) {
  const r = Math.max(14, Math.min(66, radius));
  const sc = key.shadow.camera;
  const dir = new THREE.Vector3().subVectors(key.position, key.target.position).normalize();
  key.target.position.copy(focus);
  key.position.copy(focus).addScaledVector(dir, 140);
  // texel snapping to avoid shimmering
  sc.left = -r; sc.right = r; sc.top = r; sc.bottom = -r;
  sc.updateProjectionMatrix();
  key.target.updateMatrixWorld();
}

export function createPost(renderer, scene, camera, { quality = 'high' } = {}) {
  const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType });
  composer.addPass(new RenderPass(scene, camera));

  const w = renderer.domElement.width, h = renderer.domElement.height;
  const ao = new N8AOPostPass(scene, camera, w, h);
  ao.configuration.aoRadius = 2.8;
  ao.configuration.distanceFalloff = 1.0;
  ao.configuration.intensity = 4.0;
  ao.configuration.color = new THREE.Color(0x221a3a);
  ao.configuration.gammaCorrection = false;
  ao.setQualityMode(quality === 'high' ? 'Medium' : 'Low');
  // half-res AO with depth-aware upsampling: ~2–3× cheaper, visually near-identical at this scale
  ao.configuration.halfRes = true;
  if (quality === 'high') { ao.configuration.aoSamples = 16; ao.configuration.denoiseSamples = 8; ao.configuration.denoiseRadius = 10; }
  if (quality !== 'high') ao.configuration.halfRes = true;
  composer.addPass(ao);
  // scrub NaN/Inf + clamp extreme HDR before any blur (tilt-shift, bloom): a single bad pixel would otherwise
  // be spread by bloom's mip chain into a black rectangle for a frame
  composer.addPass(new EffectPass(camera, new SanitizeEffect(64)));

  const bloom = new BloomEffect({ luminanceThreshold: 1.5, luminanceSmoothing: 0.35, intensity: 1.5, mipmapBlur: true, radius: 0.7, levels: 6 });
  const tilt = new TiltShiftEffect({ offset: 0.0, rotation: 0, focusArea: 0.94, feather: 0.16, kernelSize: 1 });
  const tone = new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL });
  const grade = new GradeEffect({ vibrance: 0.45, saturation: 0.12, contrast: 0.22, split: 0.55 });
  const vig = new VignetteEffect({ offset: 0.5, darkness: 0.1 });
  const tiltPass = new EffectPass(camera, tilt);
  composer.addPass(tiltPass);
  composer.addPass(new EffectPass(camera, bloom, tone, grade, vig));
  const smaa = new SMAAEffect({ preset: SMAAPreset.MEDIUM });
  composer.addPass(new EffectPass(camera, smaa));

  return { composer, ao, bloom, tilt, tiltPass, tone, vig, grade };
}
