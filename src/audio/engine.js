// Audio engine: context, mix buses, shared reverb, master dynamics, listener and ducking.
//
//   const audio = createAudio();                 // safe to call before a user gesture (context starts suspended)
//   button.onclick = () => audio.resume();       // MUST be called from a user gesture
//   const vp = new VoicePlayer(audio.ctx, audio.voiceBus);   // voice lines go to the voice bus
//   each frame: audio.update(camera.position, camera.quaternion, player.position)
//
// Buses (all GainNodes you can connect sources to):
//   musicBus, sfxBus, ambienceBus, voiceBus      dry inputs
//   sends.music / sends.sfx / sends.ambience / sends.voice   extra reverb-send inputs (follow the bus fader + duck)
//
// Dialogue ducking is automatic: an envelope follower on voiceBus ducks music (and ambience slightly) while
// anything plays there. duck(amount, time) adds a manual duck (amount 0..1 = attenuation depth; duck(0) releases).

import { makeImpulse, filt, gain, clamp } from './dsp.js';

export const PANNER_DEFAULTS = {
  panningModel: 'HRTF',
  distanceModel: 'inverse',
  refDistance: 4,
  maxDistance: 45,
  rolloffFactor: 1,
  coneInnerAngle: 360,
  coneOuterAngle: 360,
  coneOuterGain: 0,
};

const DEFAULT_VOLUMES = { master: 1, music: 0.7, sfx: 0.9, ambience: 0.8, voice: 1 };

// Master trim compensates the makeup gain the browser's DynamicsCompressor adds (measured in QA).
// Net master gain = trim + makeup. -12.1 dB nets 0 dB; we run +4 dB hotter so the mix lands near -19 LUFS
// and the limiter / soft clip only touch rare peaks.
const MASTER_TRIM_DB = -8.1;

class Bus {
  constructor(ctx, dest, reverbIn, defaultSend) {
    this.ctx = ctx;
    this.input = gain(ctx, 1);   // dry in
    this.send = gain(ctx, 1);    // wet-only in
    this.fader = gain(ctx, 1);
    this.duck = gain(ctx, 1);
    this.faderW = gain(ctx, 1);
    this.duckW = gain(ctx, 1);
    this.autoSend = gain(ctx, defaultSend);
    this.input.connect(this.fader); this.fader.connect(this.duck); this.duck.connect(dest);
    this.input.connect(this.autoSend); this.autoSend.connect(this.send);
    this.send.connect(this.faderW); this.faderW.connect(this.duckW); this.duckW.connect(reverbIn);
  }
  setLevel(v, tc = 0.05) {
    const t = this.ctx.currentTime;
    for (const g of [this.fader, this.faderW]) g.gain.setTargetAtTime(v, t, tc);
  }
  setDuck(v, tc) {
    const t = this.ctx.currentTime;
    for (const g of [this.duck, this.duckW]) g.gain.setTargetAtTime(v, t, tc);
  }
}

/**
 * Build the whole graph on an existing context (realtime or offline). createAudio() wraps this.
 */
export function buildAudioGraph(ctx, { volumes = {} } = {}) {
  // ---- master chain: sum -> DC block -> glue comp -> tilt EQ -> limiter -> soft clip -> out
  const master = gain(ctx, 1);
  const dcBlock = filt(ctx, 'highpass', 24, 0.6);
  const glue = ctx.createDynamicsCompressor();
  glue.threshold.value = -20; glue.knee.value = 14; glue.ratio.value = 2.2; glue.attack.value = 0.02; glue.release.value = 0.3;
  const trim = gain(ctx, Math.pow(10, MASTER_TRIM_DB / 20));
  const air = filt(ctx, 'highshelf', 9500, 0.7, -2.5);
  const warmth = filt(ctx, 'lowshelf', 180, 0.7, 1.0);
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -4; limiter.knee.value = 2; limiter.ratio.value = 20; limiter.attack.value = 0.002; limiter.release.value = 0.12;
  const clip = ctx.createWaveShaper();
  clip.curve = softClipCurve(); clip.oversample = '2x';
  const out = gain(ctx, 1);
  master.connect(dcBlock); dcBlock.connect(glue); glue.connect(trim); trim.connect(warmth); warmth.connect(air);
  air.connect(limiter); limiter.connect(clip); clip.connect(out); out.connect(ctx.destination);

  // ---- shared reverb (synthesised IR)
  const reverbIn = gain(ctx, 1);
  const verbPre = filt(ctx, 'highpass', 160, 0.7);
  const verbTone = filt(ctx, 'lowpass', 6500, 0.5);
  const convolver = ctx.createConvolver();
  convolver.normalize = false;
  convolver.buffer = makeImpulse(ctx, { seconds: 2.2 });
  const reverbReturn = gain(ctx, 0.5);
  reverbIn.connect(verbPre); verbPre.connect(verbTone); verbTone.connect(convolver); convolver.connect(reverbReturn); reverbReturn.connect(master);

  // ---- buses
  const buses = {
    music: new Bus(ctx, master, reverbIn, 0.0),
    sfx: new Bus(ctx, master, reverbIn, 0.08),
    ambience: new Bus(ctx, master, reverbIn, 0.12),
    voice: new Bus(ctx, master, reverbIn, 0.035),
  };
  const voiceFollower = ctx.createAnalyser ? ctx.createAnalyser() : null;
  if (voiceFollower) { voiceFollower.fftSize = 1024; buses.voice.input.connect(voiceFollower); }

  const listenerPos = { x: 0, y: 0, z: 0 };
  const listenerFwd = { x: 0, y: 0, z: -1 };
  const vol = { ...DEFAULT_VOLUMES };
  let manualDuck = 0, manualTc = 0.15, autoDuck = 0, voiceHoldUntil = 0, lastDuckApplied = -1;
  const duckDepth = 0.62; // auto-duck depth under dialogue (music to ~38%, -8.4 dB)
  const tmp = new Float32Array(1024);

  const api = {
    ctx,
    master,
    output: out,
    musicBus: buses.music.input,
    sfxBus: buses.sfx.input,
    ambienceBus: buses.ambience.input,
    voiceBus: buses.voice.input,
    sends: { music: buses.music.send, sfx: buses.sfx.send, ambience: buses.ambience.send, voice: buses.voice.send },
    reverbIn,
    buses,
    listenerPos,
    listenerFwd,
    /** perceptual volume (0..1 slider) -> gain, square law */
    setVolumes(v = {}) {
      Object.assign(vol, v);
      const curve = (x) => clamp(x, 0, 1.5) ** 2;
      master.gain.setTargetAtTime(curve(vol.master), ctx.currentTime, 0.05);
      buses.music.setLevel(curve(vol.music));
      buses.sfx.setLevel(curve(vol.sfx));
      buses.ambience.setLevel(curve(vol.ambience));
      buses.voice.setLevel(curve(vol.voice));
      return { ...vol };
    },
    getVolumes() { return { ...vol }; },
    /** Must be called from a user gesture (click / key). Resolves when running. */
    resume() {
      if (ctx.state === 'running' || !ctx.resume) return Promise.resolve();
      return ctx.resume();
    },
    suspend() { return ctx.suspend ? ctx.suspend() : Promise.resolve(); },
    get state() { return ctx.state; },
    /** Manual music duck. amount 0..1 attenuation depth (0.6 => music at 40%); duck(0) releases. */
    duck(amount = 0.6, time = 0.35) {
      manualDuck = clamp(amount, 0, 1);
      manualTc = Math.max(0.01, time / 3);
      applyDuck(true);
    },
    /** A PannerNode with game defaults at `position` ({x,y,z} or Vector3). */
    createPanner(position, opts = {}) {
      const p = ctx.createPanner();
      const o = { ...PANNER_DEFAULTS, ...opts };
      for (const k of Object.keys(PANNER_DEFAULTS)) p[k] = o[k];
      if (position) setPannerPos(p, position, ctx, 0);
      return p;
    },
    setPannerPosition(p, pos, smooth = 0.03) { setPannerPos(p, pos, ctx, smooth); },
    /**
     * Per-frame listener update. camPos: Vector3-like. camRot: Quaternion (x,y,z,w) or a forward vector.
     * target: optional point of interest (player). The ear is placed near the target, nudged towards the
     * camera, so isometric distances feel intimate and panning matches the screen.
     */
    update(camPos, camRot, target) {
      let fx = 0, fy = 0, fz = -1, ux = 0, uy = 1, uz = 0;
      if (camRot && camRot.w !== undefined) {
        [fx, fy, fz] = rotate(camRot, 0, 0, -1);
        [ux, uy, uz] = rotate(camRot, 0, 1, 0);
      } else if (camRot) {
        const l = Math.hypot(camRot.x, camRot.y, camRot.z) || 1;
        fx = camRot.x / l; fy = camRot.y / l; fz = camRot.z / l;
        // up = orthogonalised world up
        const d = fy; ux = -d * fx; uy = 1 - d * fy; uz = -d * fz;
        const ul = Math.hypot(ux, uy, uz) || 1; ux /= ul; uy /= ul; uz /= ul;
      }
      let px = camPos ? camPos.x : 0, py = camPos ? camPos.y : 0, pz = camPos ? camPos.z : 0;
      if (target) {
        const dx = px - target.x, dy = py - target.y, dz = pz - target.z;
        const dist = Math.hypot(dx, dy, dz) || 1;
        const k = Math.min(dist, api.listenerLift) / dist;
        px = target.x + dx * k; py = target.y + dy * k; pz = target.z + dz * k;
      }
      listenerPos.x = px; listenerPos.y = py; listenerPos.z = pz;
      listenerFwd.x = fx; listenerFwd.y = fy; listenerFwd.z = fz;
      const L = ctx.listener;
      const t = ctx.currentTime, tc = 0.04;
      if (L.positionX) {
        L.positionX.setTargetAtTime(px, t, tc); L.positionY.setTargetAtTime(py, t, tc); L.positionZ.setTargetAtTime(pz, t, tc);
        L.forwardX.setTargetAtTime(fx, t, tc); L.forwardY.setTargetAtTime(fy, t, tc); L.forwardZ.setTargetAtTime(fz, t, tc);
        L.upX.setTargetAtTime(ux, t, tc); L.upY.setTargetAtTime(uy, t, tc); L.upZ.setTargetAtTime(uz, t, tc);
      } else {
        L.setPosition(px, py, pz);
        L.setOrientation(fx, fy, fz, ux, uy, uz);
      }
      // dialogue envelope follower -> auto duck
      if (voiceFollower) {
        voiceFollower.getFloatTimeDomainData(tmp);
        let s = 0; for (let i = 0; i < tmp.length; i++) s += tmp[i] * tmp[i];
        const rms = Math.sqrt(s / tmp.length);
        if (rms > 0.004) voiceHoldUntil = t + 0.6;
        autoDuck = t < voiceHoldUntil ? duckDepth : 0;
      }
      applyDuck(false);
    },
    /** How far (world units) from the target towards the camera the ear sits. */
    listenerLift: 5,
  };

  function applyDuck(force) {
    const depth = Math.max(manualDuck, autoDuck);
    if (!force && depth === lastDuckApplied) return;
    const rising = depth > lastDuckApplied;
    lastDuckApplied = depth;
    const tc = force ? manualTc : rising ? 0.08 : 0.5;
    buses.music.setDuck(1 - depth, tc);
    buses.ambience.setDuck(1 - depth * 0.35, tc);
  }

  api.setVolumes(volumes);
  return api;
}

/** Create the realtime engine. opts: { context?, volumes?, autoSuspend?=true } */
export function createAudio(opts = {}) {
  const AC = window.AudioContext || window.webkitAudioContext;
  const ctx = opts.context || new AC({ latencyHint: 'interactive' });
  const api = buildAudioGraph(ctx, opts);
  // Pause the whole graph while the tab is hidden (timers are throttled there anyway); resume on return.
  if (opts.autoSuspend !== false && typeof document !== 'undefined') {
    let wasRunning = false;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { wasRunning = ctx.state === 'running'; if (wasRunning) ctx.suspend(); }
      else if (wasRunning) ctx.resume();
    });
  }
  return api;
}

function softClipCurve() {
  // linear to 0.6, then smooth knee asymptotic to 0.88 (-1.1 dBFS): the graph can never hard clip
  const n = 4096, c = new Float32Array(n);
  const k = 0.6, ceil = 0.88, span = ceil - k;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 4 - 2;
    const a = Math.abs(x);
    const y = a <= k ? a : k + span * Math.tanh((a - k) / span);
    c[i] = Math.sign(x) * y;
  }
  return c;
}

function rotate(q, x, y, z) {
  // v' = q v q*
  const { x: qx, y: qy, z: qz, w: qw } = q;
  const ix = qw * x + qy * z - qz * y;
  const iy = qw * y + qz * x - qx * z;
  const iz = qw * z + qx * y - qy * x;
  const iw = -qx * x - qy * y - qz * z;
  return [
    ix * qw + iw * -qx + iy * -qz - iz * -qy,
    iy * qw + iw * -qy + iz * -qx - ix * -qz,
    iz * qw + iw * -qz + ix * -qy - iy * -qx,
  ];
}

export function setPannerPos(p, pos, ctx, smooth = 0.03) {
  if (p.positionX) {
    if (smooth > 0) {
      const t = ctx.currentTime;
      p.positionX.setTargetAtTime(pos.x, t, smooth); p.positionY.setTargetAtTime(pos.y, t, smooth); p.positionZ.setTargetAtTime(pos.z, t, smooth);
    } else {
      p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z;
    }
  } else p.setPosition(pos.x, pos.y, pos.z);
}
