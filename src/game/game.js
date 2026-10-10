// Game orchestrator: title → descent → free exploration, with examine mode, activities, guide, tour,
// tutorial hints, discoveries, notebook, audio and voice.
import * as THREE from 'three';
import gsap from 'gsap';
import { UI } from '../ui/ui.js';
import { Input } from '../core/input.js';
import { CameraRig } from '../core/cameraRig.js';
import { CollisionWorld } from '../player/collision.js';
import { Player, placeholderFigure } from '../player/player.js';
import { Guide } from '../player/guide.js';
import { Progress } from './progress.js';
import { Director } from './director.js';
import { DISTRICTS, DISTRICT_ORDER, examinePose, applyAnchors } from './districts.js';
import { ORGANELLES, CURIOSITIES } from '../data/content.js';
import { SHOTS, GATES } from '../world/layout.js';
import { membranePoint } from '../world/membrane.js';
import { Sparkles, TourPath } from './markers.js';
import { sciLabelsFor } from './sciLabels.js';
import { setQualityChoice } from '../core/quality.js';

const D = Math.PI / 180;
const TUTORIAL = [
  { id: 'move', line: 'tut_move', html: '<span class="kbd">W</span><span class="kbd">A</span><span class="kbd">S</span><span class="kbd">D</span> or click the ground to walk' },
  { id: 'rotate', line: 'tut_rotate', html: '<span class="kbd">Q</span><span class="kbd">E</span> or right-drag to turn the camera' },
  { id: 'zoom', line: 'tut_zoom', html: 'Scroll to zoom — all the way out for the whole city' },
  { id: 'interact', line: 'tut_interact', html: 'Walk up to anything glowing and press <span class="kbd">E</span>' },
  { id: 'guide', line: 'tut_guide', html: 'Press <span class="kbd">G</span> to ask Dr. Celia anything' },
  { id: 'notebook', line: 'tut_notebook', html: '<span class="kbd">N</span> opens your Field Notebook' },
];

export class Game {
  constructor({ renderer, scene, camera, rig, world, post, studio }) {
    Object.assign(this, { renderer, scene, camera, rig, world, post, studio });
    this.input = new Input(renderer.domElement);
    this.ui = new UI(document.getElementById('ui'), this);
    this.progress = new Progress();
    this.state = 'title';
    this.labels = true;
    this.tour = false;
    this.focusDistrict = null;
    this.currentDistrict = null;
    this.tut = { step: 0, done: new Set(), moved: 0, shownAt: 0 };
    this.interactables = [];
    this.raycaster = new THREE.Raycaster();
    this.clock = 0;
    this.settings = { master: 0.85, music: 0.55, sfx: 0.8, ambience: 0.7, voice: 1, footsteps: 0.7, headBob: 0.6, lookSens: 0.5 };
    try { Object.assign(this.settings, JSON.parse(localStorage.getItem('livingCity.settings') || '{}')); } catch { /* ignore */ }
  }

  async init() {
    applyAnchors(this.world.root);
    this.collision = new CollisionWorld();
    this.collision.collectFrom(this.world.root);

    const figs = await this._loadFigures();
    this.player = new Player(figs.player, this.collision);
    this.guide = new Guide(figs.guide, this.collision);
    this.scene.add(this.player.object, this.guide.object);
    const gate = membranePoint(GATES.find((g) => g.id === 'front').angle, 0);
    const sp = this._spawnPair(gate.x - gate.nx * 6, gate.z - gate.nz * 6);
    this.spawn = sp.player;
    this.player.place(sp.player.x, sp.player.z, 0); // heading 0 = facing +Z: down the screen, toward the camera
    this.guide.place(sp.guide.x, sp.guide.z);
    this.guide.heading = Math.atan2(sp.player.x - sp.guide.x, sp.player.z - sp.guide.z); // facing the visitor
    this.player.onStep = (p, st) => {
      const v = (this.settings.footsteps ?? 0.7) * (st === 'run' ? 0.8 : 0.6) * (this.fp ? 1.25 : 1);
      if (v > 0.01) this.sfx('footstep', { position: this.fp ? undefined : p, volume: v, surface: p.y > 0.5 ? 'metal' : 'pave' });
      this._bobKick = 1;
    };

    this.sparkles = new Sparkles(this.scene);
    this.tourPath = new TourPath(this.scene);
    this.director = new Director({ ui: this.ui, voice: null, audio: null, sfx: (n) => this.sfx(n), guide: this.guide });
    this.ui.buildPins(DISTRICTS, (id) => this.onPin(id));
    this.ui.buildCallouts(DISTRICTS, (id) => this.onPin(id));
    this._buildInteractables();
    this.ui.title(() => this.start(), { hasProgress: this.progress.total > 0 });
    // title camera: the poster overview with a slow, breathing drift
    this.rig.shot('overview');
    this.titlePose = { ...CameraRig.fromPose(SHOTS.overview.pos, SHOTS.overview.target), fov: SHOTS.overview.fov };
    this._bindKeys();
  }

  async _loadFigures() {
    try {
      const m = await import('../life/characters.js');
      return { player: m.createPlayer(), guide: m.createGuide() };
    } catch (e) {
      console.warn('characters not available yet, using placeholders', e?.message);
      return { player: placeholderFigure(0x2bb3a3), guide: placeholderFigure(0xf2f2ee) };
    }
  }

  // ------------------------------------------------------------------ audio
  async _initAudio() {
    if (this.audio) return;
    try {
      const { createAudio } = await import('../audio/engine.js');
      this.audio = createAudio();
      await this.audio.resume?.();
      this.audio.setVolumes?.(this.settings);
      try { const S = await import('../audio/sfx.js'); this.sfxLib = S.createSfx ? S.createSfx(this.audio) : S.default?.(this.audio); } catch (e) { console.warn('sfx', e); }
      try { const A = await import('../audio/ambience.js'); this.ambience = A.createAmbience ? A.createAmbience(this.audio) : null; this.ambience?.start?.(); this._placeEmitters(); } catch (e) { console.warn('ambience', e); }
      try { const Mu = await import('../audio/music.js'); this.music = Mu.createMusic ? Mu.createMusic(this.audio) : null; this.music?.start?.(); } catch (e) { console.warn('music', e); }
    } catch (e) { console.warn('audio engine not available', e); }
    try {
      const { VoicePlayer } = await import('../audio/voice.js');
      if (this.audio?.ctx) {
        this.voice = new VoicePlayer(this.audio.ctx, this.audio.voiceBus || this.audio.master);
        await this.voice.ready;
        this.director.voice = this.voice; this.director.audio = this.audio;
      }
    } catch (e) { console.warn('voice', e); }
  }
  _placeEmitters() {
    if (!this.ambience?.addEmitter) return;
    const map = { nucleus: 'nucleus', mitochondria: 'mitochondria', golgi: 'golgi', lysosomes: 'lysosome', vacuoles: 'vacuole', ser: 'ser', membrane: 'membrane' };
    for (const [id, type] of Object.entries(map)) this.ambience.addEmitter(type, DISTRICTS[id].pin.clone().setY(1));
  }
  sfx(name, opts) { try { this.sfxLib?.play?.(name, opts); } catch { /* audio optional */ } }

  // ------------------------------------------------------------------ flow
  async start() {
    if (this.state !== 'title') return;
    if (this.ui.titleEl?.isConnected) { const t = this.ui.titleEl; t.style.transition = 'opacity .8s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 800); }
    this._initAudio();
    this.state = 'descent';
    this.ui.showHud(false);
    this.sfx('whoosh');
    const p = this.player.pos;
    await this.rig.flyTo({ target: new THREE.Vector3(p.x, p.y + 0.9, p.z - 1), yaw: 0, pitch: 40 * D, dist: 15, fov: 42 }, 4.2, 'power2.inOut');
    this.rig.mode = 'follow';
    this.rig.setZoom(0.08);
    this.state = 'explore';
    if (!this.ui.hudEls) this.ui.hud(this.progress); else this.ui.showHud(true);
    this.progress.onChange((p) => this.ui.updateProgress(p));
    if (!this.progress.flags.introDone) {
      this.director.sayAll(['intro_01', 'intro_02', 'intro_03', 'intro_04'], { onEnd: () => this.progress.flag('introDone') });
      this.guide.doGesture('wave', 2.2);
    } else this.tut.step = TUTORIAL.length;
  }

  onPin(id) {
    if (this.state === 'title') { this._pendingPin = id; return; }
    // quick travel: carry the visitor and Celia to that district, then examine it
    const c = DISTRICTS[id].center;
    this.player.place(c.x, c.z); this.guide.place(c.x + 1.4, c.z + 1.2);
    this.examine(id);
  }

  examine(id) {
    if (!ORGANELLES[id]) return;
    this.endActivity();
    this.state = 'examine'; this.focusDistrict = id;
    this.player.stop();
    if (this.fp) { this._setFP(false, { silent: true }); this._resumeFP = true; } // examine uses the overhead camera
    this.rig.mode = 'flight';
    this.sfx('whoosh');
    this.rig.flyTo(examinePose(id), 1.8).then(() => { if (this.state === 'examine') this.rig.mode = 'locked'; });
    this.ui.card(id, { onTry: () => this.startActivity(id), onClose: () => this.leaveExamine(), tried: this.progress.tried.has(id) });
    this.examineLabels = sciLabelsFor(id, this._anchors()).map((l, i) => ({ ...l, key: `${id}:${i}` }));
    this.markVisited(id);
    this.music?.setMood?.(DISTRICTS[id].mood);
  }
  leaveExamine() {
    this.ui.closeCard(); this.ui.sciLabels([], this.camera);
    if (this.state !== 'examine' && this.state !== 'activity') return;
    this.endActivity();
    this.state = 'explore'; this.focusDistrict = null;
    const p = this.player.pos;
    this.rig.mode = 'flight';
    this.rig.flyTo({ target: new THREE.Vector3(p.x, p.y + 0.9, p.z), yaw: this.rig.yaw, pitch: 42 * D, dist: 15, fov: 42 }, 1.4).then(() => {
      this.rig.mode = 'follow'; this.rig.setZoom(0.1);
      if (this._resumeFP && this.state === 'explore') { this._resumeFP = false; this._setFP(true, { silent: true }); }
    });
  }

  async startActivity(id) {
    this.ui.closeCard(true);
    let mod;
    try { mod = await import(`../interact/activities/${id}.js`); } catch (e) {
      console.warn('activity missing', id, e);
      this.ui.toast('COMING SOON', `${ORGANELLES[id].tryIt?.title || 'Activity'}`, ORGANELLES[id].color);
      return;
    }
    this.state = 'activity';
    const o = ORGANELLES[id];
    const panel = this.ui.activityPanel(o.color, o.tryIt.title, o.tryIt.prompt);
    const ctx = {
      game: this, scene: this.scene, camera: this.camera, rig: this.rig, world: this.world, panel, ui: this.ui, input: this.input,
      sfx: (n, o2) => this.sfx(n, o2), say: (l, opts) => this.director.say(l, opts), district: DISTRICTS[id],
      complete: () => this.completeActivity(id), exit: () => this.leaveExamine(),
    };
    this.director.say(`${id}_try`, { interrupt: true });
    this.activity = { id, inst: mod.start(ctx) };
  }
  completeActivity(id) {
    const first = this.progress.try(id);
    this.sfx('success_flourish');
    this.director.say(`${id}_done`, { interrupt: true });
    if (first) this.ui.toast('ACTIVITY COMPLETE', ORGANELLES[id].tryIt.title, ORGANELLES[id].color);
    this._checkEnding();
  }
  endActivity() {
    if (!this.activity) return;
    try { this.activity.inst?.end?.(); } catch (e) { console.error(e); }
    this.activity = null; this.ui.closeActivity();
  }

  markVisited(id) {
    if (this.progress.visit(id)) {
      this.ui.toast('DISTRICT VISITED', `${ORGANELLES[id].num} · ${ORGANELLES[id].title}`, ORGANELLES[id].color);
      this.sfx('discovery_chime');
      this._checkEnding();
      return true;
    }
    return false;
  }

  findCuriosity(cur) {
    const first = this.progress.find(cur.id);
    this.sfx(first ? 'discovery_chime' : 'interact_ping');
    this.ui.curiosity(cur, ORGANELLES[cur.district]?.color || '#8a5cc8');
    if (first) this.ui.toast(`CURIOSITY ${this.progress.found.size} / ${CURIOSITIES.length}`, cur.title, ORGANELLES[cur.district]?.color);
    this.director.say(cur.celiaLineId, { interrupt: true });
    this._checkEnding();
  }

  _checkEnding() {
    const p = this.progress;
    if (!p.flags.ended && p.visited.size >= 11 && p.tried.size >= 6 && p.found.size >= 12) {
      p.flag('ended'); setTimeout(() => this.director.sayAll(['end_01', 'end_02']), 3000);
    }
  }

  // ------------------------------------------------------------------ guide
  askGuide() {
    if (this.state === 'title') return;
    this._tutDone('guide');
    this.guide.doGesture('talk', 2);
    const here = this.currentDistrict;
    if (here && this.state === 'explore') {
      const seq = this.progress.visited.has(here) && this._saidMore?.has(here) ? null : `${here}_more`;
      (this._saidMore ||= new Set()).add(here);
      this.director.say(seq || `${here}_arrive`, { interrupt: true, choices: [{ label: `Examine ${ORGANELLES[here].title}`, value: 'ex' }, { label: 'Where next?', value: 'next' }], onChoice: (v) => (v === 'ex' ? this.examine(here) : this.suggestNext(true)) });
    } else this.suggestNext(true);
  }
  nextUnvisited() {
    let best = null, bd = Infinity;
    for (const id of DISTRICT_ORDER) {
      if (this.progress.visited.has(id)) continue;
      const d = DISTRICTS[id].center.distanceTo(this.player.pos);
      if (d < bd) { bd = d; best = id; }
    }
    return best;
  }
  suggestNext(interrupt = false) {
    const id = this.nextUnvisited();
    if (!id) { this.director.say('end_02', { interrupt }); return; }
    const line = this.director.has(`suggest_${id}`) ? `suggest_${id}` : `${id}_arrive`;
    this.director.say(line, { interrupt, choices: [{ label: 'Take me there', value: 'go' }, { label: 'I’ll wander', value: 'no' }], onChoice: (v) => { if (v === 'go') this.leadTo(id); } });
  }
  leadTo(id) {
    const c = DISTRICTS[id].center;
    const path = this._roadPath(this.guide.pos, c);
    this.guide.lead = { path, onArrive: () => { this.tourPath.clear(); if (this.tour) setTimeout(() => this.tour && this.suggestNext(), 4000); } };
    this.navTarget = id;
    this.tourPath.set([{ x: this.player.pos.x, z: this.player.pos.z }, ...path], (x, z) => this.collision.heightAt(x, z));
  }
  toggleTour() {
    this.tour = !this.tour; this.ui.setTour(this.tour); this.sfx('ui_click');
    if (this.tour) { const id = this.nextUnvisited(); if (id) { this.director.say(this.director.has(`suggest_${id}`) ? `suggest_${id}` : `${id}_arrive`, { interrupt: true }); this.leadTo(id); } }
    else { this.guide.lead = null; this.navTarget = null; this.tourPath.clear(); }
  }
  _roadPath(from, to) {
    const net = this.world.network;
    if (net?.pathBetween && net?.nearestNode) {
      try {
        const a = net.nearestNode(from.x, from.z), b = net.nearestNode(to.x, to.z);
        const ids = net.pathBetween(a.id ?? a, b.id ?? b);
        const pts = ids && ids.length ? (net.pathPoints ? net.pathPoints(ids) : ids.map((id) => net.NETWORK.node(id))) : null;
        if (pts && pts.length) {
          // thin the dense centre-line to ~1.5u steps for steering
          const out = []; let last = null;
          for (const p of pts) if (!last || Math.hypot(p.x - last.x, p.z - last.z) > 1.5) { out.push({ x: p.x, z: p.z }); last = p; }
          return [...out, { x: to.x, z: to.z }];
        }
      } catch (e) { console.warn('path', e); }
    }
    return [{ x: to.x, z: to.z }];
  }

  // ------------------------------------------------------------------ first-person view
  toggleView() {
    if (this.state === 'title' || this.state === 'descent') return;
    if (this.state !== 'explore') { this._resumeFP = !this._resumeFP; return; } // applies when you leave examine
    this._setFP(!this.fp);
  }
  _setFP(on, { silent = false } = {}) {
    if (on === !!this.fp) return;
    const R = this.rig, cam = this.camera;
    if (on) {
      this.fp = true; R.fp = true;
      this._isoSaved = { dist: R.dist, fov: R.fov, mode: R.mode };
      // start looking where the overhead camera was facing
      this.fpYaw = R.yaw; this.fpPitch = -0.08;
      this._fpBlend = 0; this._fpFrom = { pos: cam.position.clone(), quat: cam.quaternion.clone(), fov: cam.fov };
      R.mode = 'fp';
      this.player.figure.visible = false;
      this.input.lockPointer();       // V / chip press is a user gesture: capture the mouse right away
      this.ui.crosshair(true);
    } else {
      this.fp = false; R.fp = false;
      this.input.unlockPointer();
      this.ui.crosshair(false);
      this.player.figure.visible = true;
      this.player.lookAt = null;
      R.mode = 'follow'; R.dist = this._isoSaved?.dist ?? R.goal.dist; R.yaw = R.goal.yaw = this.fpYaw ?? R.yaw;
      R.target.copy(this.player.pos); R.apply();
    }
    this.ui.setView(this.fp);
    if (!silent) { this.sfx('whoosh', { volume: 0.45 }); this.sfx('ui_click', { volume: 0.3 }); }
    if (on && !silent && !this.progress.flags.fpHint) { this.progress.flag('fpHint'); this.ui.toast('FIRST-PERSON VIEW', 'Move the mouse to look · Esc frees the cursor · V to switch back', '#6a3ce0'); }
  }
  /** Places the first-person camera at the visitor's eyes, with head bob; blends in from the previous view. */
  _updateFP(dt, t) {
    const inp = this.input, cam = this.camera, P = this.player;
    const sens = 0.0012 + (this.settings.lookSens ?? 0.5) * 0.0036;
    // eyesight follows the mouse: captured-pointer deltas, or (cursor free) plain mouse movement over the game
    const uiOpen = !!(this.ui.modalEl || this.director.current?.opts?.choices);
    if (uiOpen && inp.locked) inp.unlockPointer();     // give the cursor back for menus / choices
    const look = inp.takeLook(), hover = inp.takeHover(), drag = inp.takeDrag(2);
    const free = uiOpen ? { dx: 0, dy: 0 } : hover;
    const dx = look.dx + free.dx + (drag?.dx || 0), dy = look.dy + free.dy + (drag?.dy || 0);
    this.fpYaw -= dx * sens; this.fpPitch = THREE.MathUtils.clamp(this.fpPitch - dy * sens, -1.2, 1.1);
    if (inp.down('q')) this.fpYaw += dt * 1.8;
    if (inp.down('e') && !this._nearestInteractable()) this.fpYaw -= dt * 1.8;
    const fx = -Math.sin(this.fpYaw), fz = -Math.cos(this.fpYaw);
    if (P.state === 'idle') P.lookAt = new THREE.Vector3(P.pos.x + fx * 5, 0, P.pos.z + fz * 5); else P.lookAt = null;
    // head bob: vertical bounce at step rate + small sway, scaled by the setting and walking speed
    const amt = (this.settings.headBob ?? 0.6) * Math.min(1, (P.speed || 0) / 3.4);
    this._bobPhase = (this._bobPhase || 0) + dt * (P.state === 'run' ? 11.5 : 8.4) * (amt > 0.02 ? 1 : 0);
    this._bobAmt = (this._bobAmt || 0) + (amt - (this._bobAmt || 0)) * Math.min(1, dt * 6);
    const bobY = Math.abs(Math.sin(this._bobPhase)) * 0.055 * this._bobAmt, swayX = Math.sin(this._bobPhase) * 0.03 * this._bobAmt;
    const eye = new THREE.Vector3(P.pos.x - fz * swayX, P.pos.y + 0.98 + bobY, P.pos.z + fx * swayX);
    const dir = new THREE.Vector3(fx * Math.cos(this.fpPitch), Math.sin(this.fpPitch), fz * Math.cos(this.fpPitch));
    const m = new THREE.Matrix4().lookAt(eye, eye.clone().add(dir), new THREE.Vector3(0, 1, 0));
    const q = new THREE.Quaternion().setFromRotationMatrix(m);
    q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.sin(this._bobPhase * 0.5) * 0.008 * this._bobAmt));
    // smooth transition from the overhead camera
    this._fpBlend = Math.min(1, (this._fpBlend ?? 1) + dt / 0.6);
    const e = this._fpBlend * this._fpBlend * (3 - 2 * this._fpBlend);
    if (e < 1 && this._fpFrom) { cam.position.lerpVectors(this._fpFrom.pos, eye, e); cam.quaternion.slerpQuaternions(this._fpFrom.quat, q, e); cam.fov = THREE.MathUtils.lerp(this._fpFrom.fov, 72, e); }
    else { cam.position.copy(eye); cam.quaternion.copy(q); cam.fov = 72; }
    cam.near = 0.05; cam.far = 400; cam.updateProjectionMatrix();
    // keep the rig's focus on the visitor so shadows / lights / LOD follow
    this.rig.target.copy(P.pos); this.rig.dist = 14; this.rig.yaw = this.fpYaw;
    // clicks: at the crosshair when captured (talk to workers, honk trucks); a free click re-captures the mouse
    if (inp.clicks.length) {
      if (inp.lockedClick) this._clickLife(new THREE.Vector2(0, 0));
      else if (!uiOpen) inp.lockPointer();
    }
    this.ui.crosshair(true, inp.locked);
  }

  toggleLabels() { this.labels = !this.labels; this.sfx('ui_click'); }
  toggleNotebook() { if (this.ui.modalEl) { this.ui.closeModal(); return; } this._tutDone('notebook'); this.ui.notebook(this.progress); }
  toggleHelp() {
    if (this.ui.modalEl) { this.ui.closeModal(); return; }
    const gfx = (() => { try { return localStorage.getItem('livingCity.graphics') || 'auto'; } catch { return 'auto'; } })();
    this.ui.help({ ...this.settings, graphics: gfx, graphicsTier: window.__city?.quality }, (k, v) => {
      if (k === 'graphics') {
        setQualityChoice(v);
        window.dispatchEvent(new CustomEvent('graphicschange', { detail: v }));
        return;
      }
      this.settings[k] = v; this.audio?.setVolumes?.(this.settings);
      try { localStorage.setItem('livingCity.settings', JSON.stringify(this.settings)); } catch { /* ignore */ }
    });
  }

  // ------------------------------------------------------------------ interactables
  _buildInteractables() {
    // district examine points (walk-up)
    for (const id of DISTRICT_ORDER) {
      const d = DISTRICTS[id];
      this.interactables.push({ id: `ex:${id}`, kind: 'district', district: id, pos: d.pin.clone(), at: d.center.clone(), radius: Math.min(6, d.radius * 0.55), label: `Examine ${ORGANELLES[id].title}`, act: () => this.examine(id) });
    }
    // curiosities: positions from district anchors when published, else near the district
    const anchors = {};
    this.world.root.traverse((o) => { if (o.userData?.anchors) Object.assign(anchors, o.userData.anchors); });
    if (this.world.curiosityAnchors) Object.assign(anchors, this.world.curiosityAnchors);
    for (const cur of CURIOSITIES) {
      const a = anchors[cur.id] || anchors[camel(cur.id)];
      let pos;
      if (Array.isArray(a)) pos = new THREE.Vector3(...a);
      else if (a?.isVector3) pos = a.clone();
      else continue; // not placed in the world yet
      const rad = this.world.curiosityRadii?.[cur.id] || 2.6;
      this.interactables.push({ id: `cur:${cur.id}`, kind: 'curiosity', pos, at: pos.clone().setY(0), radius: rad, label: `Look closer: ${cur.title}`, act: () => this.findCuriosity(cur) });
      this.sparkles.add(cur.id, pos.clone().add(new THREE.Vector3(0, 0.9, 0)));
    }
  }

  /** Nearest walkable spot off the roads (so nobody spawns in front of a truck). */
  /**
   * Start position for the visitor + Dr. Celia: both need generous clearance (no tree canopies or props
   * overlapping either figure), off the road, with Celia exactly where her follow logic places her
   * (front-left of the visitor, facing the camera side) so nobody walks through anybody on frame one.
   */
  _spawnPair(x0, z0) {
    const rd = this.world.network?.roadDist || (() => 9);
    // Celia stands ~1 u from the visitor (about two steps closer than her usual follow distance), at their side
    const heading = 0, side = heading + 2.3, gx = Math.sin(side) * 1.05, gz = Math.cos(side) * 1.05;
    // props such as benches, planters and trees aren't all in the walk-collision data, so also probe the actual
    // geometry: anything rising above ~0.3 u within the figure's footprint disqualifies the spot
    const props = [];
    const box = new THREE.Box3(new THREE.Vector3(x0 - 18, -1, z0 - 18), new THREE.Vector3(x0 + 18, 6, z0 + 18)), ob = new THREE.Box3();
    this.world.root.traverse((o) => {
      if (!o.isMesh || !o.visible || o.isSkinnedMesh || o === this.world.crowd?.object || o === this.world.traffic?.object) return;
      if (o.name === 'floor' || o.parent?.name === 'motes') return;
      ob.setFromObject(o); if (ob.max.y > 0.3 && ob.intersectsBox(box)) props.push(o);
    });
    const rc = new THREE.Raycaster(); rc.far = 10;
    const open = (x, z, r) => {
      for (const [ox, oz] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r], [r * 0.7, r * 0.7], [-r * 0.7, r * 0.7], [r * 0.7, -r * 0.7], [-r * 0.7, -r * 0.7]]) {
        rc.set(new THREE.Vector3(x + ox, 5, z + oz), new THREE.Vector3(0, -1, 0));
        const h = rc.intersectObjects(props, false)[0];
        if (h && h.point.y > 0.3) return false;
      }
      return true;
    };
    const posted = (this.world.crowd?.agents || []).filter((a) => !a.walker).map((a) => [a.x, a.z]);
    const noWorker = (x, z) => posted.every(([wx, wz]) => Math.hypot(wx - x, wz - z) > 2.2);
    const cheap = (x, z, r) => !this.collision.blockedBy(x, z, r) && rd(x, z) > 1.0 && this.collision.heightAt(x, z) < 0.05 && noWorker(x, z);
    for (const need of [1.6, 1.2, 0.8]) {
      for (let r = 0; r < 14; r += 0.5) for (let a = 0; a < Math.PI * 2; a += Math.PI / 12) {
        const x = x0 + Math.cos(a) * r, z = z0 + Math.sin(a) * r;
        // cheap tests first (collision maps), geometry raycasts only for survivors; also require room to walk
        // "forward" (up the screen, -Z) so the first W press doesn't hit a wall
        if (!(cheap(x, z, need) && cheap(x + gx, z + gz, need * 0.8) && [2, 4, 6].every((d) => !this.collision.blockedBy(x, z - d, 0.5)))) continue;
        if (open(x, z, Math.min(need, 0.9)) && open(x + gx, z + gz, Math.min(need * 0.8, 0.9)) && [2, 4, 6].every((d) => open(x, z - d, 0.4))) {
          return { player: new THREE.Vector3(x, 0, z), guide: new THREE.Vector3(x + gx, 0, z + gz) };
        }
      }
    }
    const p = this._freeSpot(x0, z0);
    return { player: p, guide: p.clone().add(new THREE.Vector3(gx, 0, gz)) };
  }

  _freeSpot(x0, z0) {
    const rd = this.world.network?.roadDist || (() => 9);
    for (let r = 0; r < 12; r += 0.5) for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
      const x = x0 + Math.cos(a) * r, z = z0 + Math.sin(a) * r;
      if (!this.collision.blockedBy(x, z, 0.6) && rd(x, z) > 0.9) return new THREE.Vector3(x, 0, z);
    }
    return new THREE.Vector3(x0, 0, z0);
  }

  _anchors() {
    if (!this._anchorCache) { this._anchorCache = {}; this.world.root.traverse((o) => { if (o.userData?.anchors) Object.assign(this._anchorCache, o.userData.anchors); }); }
    return this._anchorCache;
  }

  _nearestInteractable() {
    // curiosities beat the broad district examine zones; otherwise the one we're relatively closest to wins
    let best = null, bd = Infinity;
    for (const it of this.interactables) {
      const d = Math.hypot(it.at.x - this.player.pos.x, it.at.z - this.player.pos.z) / it.radius + (it.kind === 'district' ? 1 : 0);
      if (d < (it.kind === 'district' ? 2 : 1) && d < bd) { bd = d; best = it; }
    }
    return best;
  }

  // ------------------------------------------------------------------ input
  _bindKeys() {
    window.addEventListener('keydown', (e) => {
      if (this.state === 'title' || this.state === 'descent') return;
      const k = e.key.toLowerCase();
      if (k === 'escape') {
        if (this.ui.closeModal()) return;
        if (this.state === 'activity' || this.state === 'examine') { this.leaveExamine(); return; }
        if (this.ui.cardEl) { this.ui.closeCard(); return; }
        this.director.clear();
      }
      if (this.ui.modalEl && !['n', 'h', '?'].includes(k)) return;
      if (k === 'v') this.toggleView();
      if (k === 'g') this.askGuide();
      if (k === 't') this.toggleTour();
      if (k === 'l') this.toggleLabels();
      if (k === 'n') this.toggleNotebook();
      if (k === 'h' || k === '?') this.toggleHelp();
      if (k === ' ') this.director.skip();
    });
  }

  /** Click a worker → they stop and say something about their district; click a truck → friendly honk. */
  _clickLife(ndc) {
    this.raycaster.setFromCamera(ndc, this.camera);
    const crowd = this.world.crowd, traffic = this.world.traffic;
    const wi = crowd?.pick ? crowd.pick(this.raycaster) : -1;
    if (wi >= 0) {
      const wp = crowd.getPosition(wi);
      if (wp && wp.distanceTo(this.player.pos) > 16) return false;
      crowd.interact(wi, 4);
      // nearest district → a matching bark
      let best = 'golgi', bd = Infinity;
      for (const id of DISTRICT_ORDER) { const d = DISTRICTS[id].center.distanceTo(wp || this.player.pos); if (d < bd) { bd = d; best = id; } }
      const barks = this.director.barks?.(best) || [];
      const line = barks.length ? barks[Math.floor(Math.random() * barks.length)] : null;
      this.sfx('wave_hello', { position: wp });
      if (line) this.director.say(line, { interrupt: !this.director.current || this.director.current.l.speaker !== 'celia' });
      return true;
    }
    const vi = traffic?.pick ? traffic.pick(this.raycaster) : -1;
    if (vi >= 0) { const v = traffic.vehicles?.[vi]; this.sfx('truck_honk', { position: v?.object?.position || v?.position }); return true; }
    return false;
  }

  _groundPick(ndc) {
    this.raycaster.setFromCamera(ndc, this.camera);
    const targets = [];
    for (const n of ['floor', 'avenue', 'nucleus']) { const o = this.scene.getObjectByName(n); if (o) targets.push(o); }
    const hits = this.raycaster.intersectObjects(targets, true);
    return hits[0]?.point || null;
  }

  // ------------------------------------------------------------------ tutorial
  _tutDone(id) { this.tut.done.add(id); }
  _updateTutorial() {
    if (this.state !== 'explore' || !this.progress.flags.introDone) { this.ui.hint(null); return; }
    while (this.tut.step < TUTORIAL.length && this.tut.done.has(TUTORIAL[this.tut.step].id)) { this.tut.step++; this.tut.spoke = false; }
    const s = TUTORIAL[this.tut.step];
    if (!s || this.ui.cardEl) { this.ui.hint(null); return; }
    this.ui.hint(s.html);
    if (!this.tut.spoke && !this.director.busy) { this.tut.spoke = true; this.director.say(s.line); }
  }

  // ------------------------------------------------------------------ frame
  update(dt, t) {
    this.clock = t;
    const inp = this.input;
    if (this.state === 'title') {
      // breathing overview
      const tp = this.titlePose;
      this.rig.setPose({ ...tp, yaw: tp.yaw + Math.sin(t * 0.08) * 0.05, pitch: tp.pitch + Math.sin(t * 0.11) * 0.012 });
      this.ui.updatePins(this.camera, { visible: false });
      this.ui.updateCallouts(this.camera, true);
      inp.endFrame();
      return;
    }
    // camera controls (explore)
    if (this.state === 'explore' && this.fp) {
      // first person: mouse/drag look happens in _updateFP; scrolling out returns to the overhead view
      if (inp.wheel > 40) this._setFP(false);
    } else if (this.state === 'explore') {
      if (inp.hit('q')) { this.rig.rotateStep(-1); this._tutDone('rotate'); }
      if (inp.hit('r')) { this.rig.rotateStep(1); this._tutDone('rotate'); }
      const drag = inp.takeDrag(2);
      if (drag && (drag.dx || drag.dy)) { this.rig.orbit(drag.dx, drag.dy); this._tutDone('rotate'); }
      if (inp.wheel) { this.rig.setZoom(this.rig.zoom + inp.wheel * 0.0011); this._tutDone('zoom'); }
      // click to walk / click interactables
      for (const c of inp.clicks) {
        if (this._clickLife(c)) continue;
        const p = this._groundPick(c);
        if (p) { this.player.walkTo(p.x, p.z, this._roadPathIfFar(p)); this.sfx('ui_click', { volume: 0.25 }); this._tutDone('move'); }
      }
    }
    // E: interact (Q/E rotate only when nothing to interact with)
    const near = this.state === 'explore' ? this._nearestInteractable() : null;
    if (this.state === 'explore' && inp.hit('e')) {
      if (near) { this._tutDone('interact'); near.act(); } else if (!this.fp) { this.rig.rotateStep(1); this._tutDone('rotate'); }
    }
    if (this.state === 'explore' && (inp.down('w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'))) this._tutDone('move');

    // simulation
    const frozen = this.state !== 'explore';
    this.player.frozen = frozen;
    this.player.update(dt, t, frozen ? null : inp, this.fp ? this.fpYaw : this.rig.yaw);
    this.guide.update(dt, t, this.player);
    this.world.crowd?.setPlayerPosition?.(this.player.pos);
    if (!this._crowdAvoidSet) { this._crowdAvoidSet = true; this.world.crowd?.setAvoid?.([this.guide.pos]); }
    this.world.traffic?.setPlayerPosition?.(this.player.pos);

    // district tracking
    if (this.state === 'explore') {
      // overlapping zones (nucleolus inside nucleus, ribosomes on the ER…): the one we're deepest inside wins
      let inId = null, best = 1;
      for (const id of DISTRICT_ORDER) {
        const d = DISTRICTS[id];
        const k = Math.hypot(d.center.x - this.player.pos.x, d.center.z - this.player.pos.z) / d.radius;
        if (k < best) { best = k; inId = id; }
      }
      if (inId !== this.currentDistrict) {
        this.currentDistrict = inId;
        if (inId) {
          this.ui.banner(inId);
          this.music?.setMood?.(DISTRICTS[inId].mood);
          if (!this.progress.visited.has(inId)) { this.director.say(`${inId}_arrive`, { interrupt: !this.director.current?.opts?.choices }); this.markVisited(inId); }
          if (this.navTarget === inId) { this.navTarget = null; this.tourPath.clear(); }
        } else this.music?.setMood?.('explore');
      }
      // idle musings / suggestions
      if (inp.idleSeconds() > 28 && !this.director.busy && performance.now() - this.director.lastSpoke > 40000) {
        this.director.lastSpoke = performance.now();
        if (Math.random() < 0.5) this.suggestNext(); else this.director.say(`idle_0${1 + Math.floor(Math.random() * 6)}`);
      }
    }

    // camera follow
    if (this.fp && this.rig.mode === 'fp') this._updateFP(dt, t);
    else if (this.rig.mode === 'follow') this.rig.update(dt, this.player.pos); else this.rig.update(dt);

    // prompt
    if (near && this.state === 'explore') {
      const v = near.pos.clone(); if (near.kind === 'district') v.copy(this.player.pos).add(new THREE.Vector3(0, 2.4, 0));
      v.project(this.camera);
      this.ui.prompt(near.label, { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight });
    } else this.ui.prompt(null);

    // pins: always in overview zoom; when labels on, show as compact numbers at street level
    const far = !this.fp && this.rig.dist > 45, poster = !this.fp && this.rig.dist > 95 && this.state === 'explore';
    this.ui.updateCallouts(this.camera, poster);
    this.ui.updatePins(this.camera, { visible: !this.fp && !poster && ((this.labels && this.state === 'explore') || far), visited: this.progress.visited, compact: !far, focusId: this.focusDistrict });

    if (this.state === 'examine' && this.rig.mode === 'locked') this.ui.sciLabels(this.examineLabels, this.camera);
    else if (this.state !== 'activity') this.ui.sciLabels([], this.camera);
    this.sparkles.update(t, this.player.pos, this.progress.found);
    this.tourPath.update(t, this.player.pos);
    this.activity?.inst?.update?.(dt, t);
    this._updateTutorial();
    this.ambience?.update?.(dt);
    this.audio?.update?.(this.camera.position, this.camera.quaternion, this.player.pos);
    inp.endFrame();
  }
  _roadPathIfFar(p) {
    const d = Math.hypot(p.x - this.player.pos.x, p.z - this.player.pos.z);
    return d > 14 ? this._roadPath(this.player.pos, p) : null;
  }
}

function camel(s) { return s.replace(/_([a-z])/g, (m, c) => c.toUpperCase()); }
