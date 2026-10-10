// Keyboard + pointer input with edge-triggered actions and ground/object picking.
import * as THREE from 'three';

export class Input {
  constructor(dom) {
    this.dom = dom;
    this.keys = new Set();
    this.pressed = new Set();   // edge-triggered this frame
    this.pointer = new THREE.Vector2();
    this.pointerPx = { x: 0, y: 0 };
    this.clicks = [];           // left clicks this frame (NDC)
    this.drag = null;
    this.wheel = 0;
    this.enabled = true;
    this.lastActivity = performance.now();
    const ignore = (e) => e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');
    window.addEventListener('keydown', (e) => {
      if (ignore(e)) return;
      const k = e.key.toLowerCase();
      if (!this.keys.has(k)) this.pressed.add(k);
      this.keys.add(k);
      this.lastActivity = performance.now();
      if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'tab'].includes(k)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
    dom.addEventListener('contextmenu', (e) => e.preventDefault());
    dom.addEventListener('pointerdown', (e) => {
      this.drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, b: e.button, moved: 0, t: performance.now() };
      this.lastActivity = performance.now();
    });
    this.look = { dx: 0, dy: 0 };   // pointer-lock deltas
    this.hover = { dx: 0, dy: 0 };  // free-cursor deltas while the mouse moves over the game (not over UI)
    this._lockChanged = 0;
    document.addEventListener('pointerlockchange', () => { this._lockChanged = performance.now(); this.hover.dx = this.hover.dy = 0; this.look.dx = this.look.dy = 0; });
    window.addEventListener('pointermove', (e) => {
      if (document.pointerLockElement === dom) { this.look.dx += e.movementX || 0; this.look.dy += e.movementY || 0; this.lastActivity = performance.now(); return; }
      // free-cursor look: skip the first event after a lock change (it carries a big accumulated jump) and any spike
      const mx = e.movementX || 0, my = e.movementY || 0;
      if (e.target === dom && e.pointerType === 'mouse' && !this.drag && performance.now() - this._lockChanged > 120 && Math.abs(mx) < 120 && Math.abs(my) < 120) { this.hover.dx += mx; this.hover.dy += my; }
      this._setPointer(e);
      if (this.drag) {
        const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
        this.drag.dx = (this.drag.dx || 0) + dx; this.drag.dy = (this.drag.dy || 0) + dy;
        this.drag.moved += Math.abs(dx) + Math.abs(dy);
        this.drag.x = e.clientX; this.drag.y = e.clientY;
      }
    });
    window.addEventListener('pointerup', (e) => {
      if (this.drag && this.drag.b === 0 && document.pointerLockElement === dom) { this.clicks.push(new THREE.Vector2(0, 0)); this.lockedClick = true; this.drag = null; return; } // crosshair click
      if (this.drag && this.drag.b === 0 && this.drag.moved < 6 && e.target === dom) {
        this._setPointer(e);
        this.clicks.push(this.pointer.clone());
      }
      this.drag = null;
    });
    dom.addEventListener('wheel', (e) => { this.wheel += e.deltaY; this.lastActivity = performance.now(); e.preventDefault(); }, { passive: false });
  }
  _setPointer(e) {
    const r = this.dom.getBoundingClientRect();
    this.pointerPx.x = e.clientX; this.pointerPx.y = e.clientY;
    this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  }
  down(...ks) { return this.enabled && ks.some((k) => this.keys.has(k)); }
  hit(...ks) { return this.enabled && ks.some((k) => this.pressed.has(k)); }
  /** Consume pointer-lock mouse-look deltas (first-person). */
  takeLook() { const d = { dx: this.look.dx, dy: this.look.dy }; this.look.dx = 0; this.look.dy = 0; return d; }
  takeHover() { const d = { dx: this.hover.dx, dy: this.hover.dy }; this.hover.dx = 0; this.hover.dy = 0; return d; }
  /** Capture the mouse for looking around. Must run inside a user gesture (key press / click); failures are harmless. */
  lockPointer() {
    if (document.pointerLockElement === this.dom || !this.dom.requestPointerLock) return;
    try { const r = this.dom.requestPointerLock({ unadjustedMovement: true }); r?.catch?.(() => { try { this.dom.requestPointerLock()?.catch?.(() => {}); } catch { /* unsupported */ } }); } catch { /* unsupported */ }
  }
  unlockPointer() { if (document.pointerLockElement === this.dom) document.exitPointerLock(); }
  get locked() { return document.pointerLockElement === this.dom; }
  /** Consume drag delta (right-button orbit). */
  takeDrag(button) {
    if (!this.drag || this.drag.b !== button) return null;
    const d = { dx: this.drag.dx || 0, dy: this.drag.dy || 0 };
    this.drag.dx = 0; this.drag.dy = 0;
    return d;
  }
  endFrame() { this.pressed.clear(); this.clicks.length = 0; this.wheel = 0; this.lockedClick = false; }
  idleSeconds() { return (performance.now() - this.lastActivity) / 1000; }
}
