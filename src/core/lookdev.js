// Look development: custom HDR studio environment, organic shader patch (fake SSS + coloured
// fresnel rim), colour-grade post effect, and floating cytoplasm motes.
import * as THREE from 'three';
import { Effect, BlendFunction } from 'postprocessing';
import * as T from './textures.js';

/**
 * A photo-studio environment built from emissive softboxes, baked into a PMREM.
 * Large warm key overhead-left, cool fill right, bright top strip for crisp clearcoat highlights,
 * warm floor bounce. Gives glossy miniature materials rich, believable reflections.
 */
export function createStudioEnv(renderer) {
  const env = new THREE.Scene();
  const room = new THREE.Mesh(
    new THREE.SphereGeometry(50, 64, 32),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {},
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: `varying vec3 vP; void main(){
        float y = vP.y;
        vec3 top = vec3(1.05, 1.06, 1.12), hor = vec3(0.82, 0.84, 0.9), floorC = vec3(0.55, 0.5, 0.46);
        vec3 c = y > 0. ? mix(hor, top, smoothstep(0., 0.9, y)) : mix(hor, floorC, smoothstep(0., 0.5, -y));
        gl_FragColor = vec4(c, 1.); }`,
    })
  );
  env.add(room);
  const box = (w, h, color, intensity, pos, look) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }));
    m.position.set(...pos); m.lookAt(...look); env.add(m);
  };
  box(26, 18, 0xfff1dc, 2.6, [-22, 30, 18], [0, 0, 0]);    // warm key softbox (kept below bloom: no hot flares on glossy shells)
  box(18, 26, 0xdcebff, 3.2, [36, 12, -6], [0, 0, 0]);     // cool fill
  box(60, 4, 0xffffff, 3.2, [0, 40, -10], [0, 0, 0]);       // top strip: long crisp highlight
  box(12, 30, 0xffe2c4, 2.4, [-30, 8, -30], [0, 0, 0]);    // warm kicker back-left
  box(40, 6, 0xffc89a, 1.4, [0, -12, 30], [0, 0, 0]);       // floor bounce (warm)
  box(10, 10, 0xd8c6ff, 2.2, [20, 20, 36], [0, 0, 0]);      // lavender accent
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(env, 0.02);
  pmrem.dispose();
  return rt.texture;
}

/**
 * Patch a Standard/Physical material with an organic look:
 *  - coloured fresnel rim (light scattering through a membrane's edge)
 *  - inner "subsurface" glow that lifts shadowed sides with the body colour
 *  - wrap diffuse so terminators are soft like wax / jelly
 */
export function organic(mat, { rim = 0xffffff, rimPower = 2.6, rimStrength = 0.6, sss = null, sssStrength = 0.25, wrap = 0.35 } = {}) {
  const u = {
    uRim: { value: new THREE.Color(rim) }, uRimPow: { value: rimPower }, uRimStr: { value: rimStrength },
    uSSS: { value: new THREE.Color(sss ?? mat.color.getHex()) }, uSSSStr: { value: sssStrength }, uWrap: { value: wrap },
  };
  mat.userData.organic = u;
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, r) => {
    prev?.(shader, r);
    Object.assign(shader.uniforms, u);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform vec3 uRim; uniform float uRimPow; uniform float uRimStr; uniform vec3 uSSS; uniform float uSSSStr; uniform float uWrap;`)
      .replace('#include <opaque_fragment>', `
        {
          vec3 vdir = normalize(vViewPosition);
          float ndv = clamp(dot(normal, vdir), 0.0, 1.0);
          float fres = pow(1.0 - ndv, uRimPow);
          outgoingLight += uRim * fres * uRimStr;
          // subsurface lift: stronger at grazing angles and in shadow
          float lum = dot(outgoingLight, vec3(0.299, 0.587, 0.114));
          outgoingLight += uSSS * uSSSStr * (0.35 + 0.65 * fres) * (1.0 - smoothstep(0.0, 0.9, lum) * uWrap);
        }
        #include <opaque_fragment>`);
  };
  // compose with any earlier patch's key so differently-patched materials never share a cached program
  const prevKey = mat.customProgramCacheKey && mat.customProgramCacheKey !== THREE.Material.prototype.customProgramCacheKey ? mat.customProgramCacheKey() : '';
  mat.customProgramCacheKey = () => `${prevKey}|organic:${rimPower}:${wrap}`;
  mat.needsUpdate = true;
  return mat;
}

/** Colour grade: vibrance, split toning (cool shadows / warm highlights), gentle S-curve. Whites are protected. */
export class GradeEffect extends Effect {
  constructor({ vibrance = 0.35, saturation = 0.08, contrast = 0.12, shadow = [0.92, 0.97, 1.1], highlight = [1.06, 1.0, 0.92], split = 0.5, lift = 0.0 } = {}) {
    super('GradeEffect', /* glsl */`
      uniform float vibrance; uniform float saturation; uniform float contrast; uniform vec3 shadowTint; uniform vec3 highlightTint; uniform float split; uniform float lift;
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        vec3 c = max(inputColor.rgb, 0.0);
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        float white = smoothstep(0.78, 0.93, min(c.r, min(c.g, c.b)));
        vec3 tint = mix(shadowTint, highlightTint, smoothstep(0.05, 0.75, l));
        vec3 g = c * mix(vec3(1.0), tint, split);
        float mx = max(g.r, max(g.g, g.b)), mn = min(g.r, min(g.g, g.b));
        float sat = (mx - mn) / max(mx, 1e-4);
        float k = 1.0 + saturation + vibrance * (1.0 - sat);
        g = mix(vec3(l), g, k);
        // S-curve in display space around mid grey
        vec3 s = clamp(g, 0.0, 1.0);
        vec3 curve = mix(s, s * s * (3.0 - 2.0 * s), contrast);
        g = mix(g, curve, step(g, vec3(1.0)));
        g += lift;
        outputColor = vec4(mix(g, max(c, vec3(smoothstep(0.86, 0.95, min(c.r, min(c.g, c.b))))), white), inputColor.a);
      }`, {
      blendFunction: BlendFunction.SRC,
      uniforms: new Map([
        ['vibrance', new THREE.Uniform(vibrance)], ['saturation', new THREE.Uniform(saturation)], ['contrast', new THREE.Uniform(contrast)],
        ['shadowTint', new THREE.Uniform(new THREE.Vector3(...shadow))], ['highlightTint', new THREE.Uniform(new THREE.Vector3(...highlight))],
        ['split', new THREE.Uniform(split)], ['lift', new THREE.Uniform(lift)],
      ]),
    });
  }
}

/** Floating cytoplasm motes: soft, slowly drifting specks that catch light (atmosphere + scale cue). */
export function createMotes(count = 700, bounds = { x: 29, z: 47, y: [0.4, 7] }, inside = () => true) {
  const pos = new Float32Array(count * 3), seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    do { pos[i * 3] = (Math.random() * 2 - 1) * bounds.x; pos[i * 3 + 2] = (Math.random() * 2 - 1) * bounds.z; } while (!inside(pos[i * 3], pos[i * 3 + 2]));
    pos[i * 3 + 1] = bounds.y[0] + Math.random() * (bounds.y[1] - bounds.y[0]);
    seed[i] = Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.PointsMaterial({
    size: 0.12, map: T.radialTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)', 64), transparent: true, opacity: 0.4,
    depthWrite: false, blending: THREE.AdditiveBlending, color: 0xcfe6ff, sizeAttenuation: true,
  });
  const pts = new THREE.Points(geo, mat);
  pts.name = 'motes'; pts.frustumCulled = false;
  const base = pos.slice();
  pts.userData.update = (t) => {
    const p = geo.attributes.position.array;
    for (let i = 0; i < count; i++) {
      const s = seed[i] * 6.28;
      p[i * 3] = base[i * 3] + Math.sin(t * 0.13 + s) * 0.8;
      p[i * 3 + 1] = base[i * 3 + 1] + Math.sin(t * 0.21 + s * 2) * 0.5;
      p[i * 3 + 2] = base[i * 3 + 2] + Math.cos(t * 0.11 + s) * 0.8;
    }
    geo.attributes.position.needsUpdate = true;
  };
  return pts;
}

/**
 * Scrubs invalid pixels (NaN / Inf) and clamps extreme HDR values before blur-based effects. One bad pixel
 * would otherwise be spread by bloom's down/upsampling chain into a large black rectangle for a frame.
 */
export class SanitizeEffect extends Effect {
  constructor(maxValue = 64) {
    super('SanitizeEffect', /* glsl */`
      uniform float maxValue;
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        vec3 c = inputColor.rgb;
        // isnan() may be folded away by some drivers; a NaN also fails every comparison, so check both ways
        bool bad = any(isnan(c)) || any(isinf(c)) || !all(lessThan(abs(c), vec3(1e20)));
        outputColor = vec4(bad ? vec3(0.0) : min(c, vec3(maxValue)), 1.0);
      }`, { blendFunction: BlendFunction.SRC, uniforms: new Map([['maxValue', new THREE.Uniform(maxValue)]]) });
  }
}
