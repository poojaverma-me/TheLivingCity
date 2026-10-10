// VoicePlayer: plays pre-generated voice lines (see scripts/gen-voice.mjs).
//
//   const vp = new VoicePlayer(ctx, voiceGain);        // voiceGain: GainNode (e.g. dialogue bus)
//   await vp.ready;                                    // manifest loaded (missing manifest => has() is false)
//   if (vp.has('celia_intro_01')) {
//     const h = vp.play('celia_intro_01', { onStart, onEnd });
//     h.stop();                                        // fades out quickly; onEnd({ stopped: true })
//   }
//
// onEnd is called exactly once per play(): { stopped?: true, error?: Error } on early exit, {} when finished.

const DEFAULT_BASE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) || '/';

export class VoicePlayer {
  /**
   * @param {AudioContext} ctx
   * @param {AudioNode} destination  usually a GainNode for the voice bus
   * @param {{ manifestUrl?: string, cacheSize?: number }} [opts]
   */
  constructor(ctx, destination, opts = {}) {
    this.ctx = ctx;
    this.destination = destination || ctx.destination;
    this.cacheSize = opts.cacheSize ?? 16;
    this.manifestUrl = new URL(opts.manifestUrl || `${DEFAULT_BASE}audio/voice/manifest.json`, location.href);
    this.manifest = {};
    this._cache = new Map(); // id -> Promise<AudioBuffer>, Map order = LRU order (oldest first)
    this._active = new Set();
    this.ready = fetch(this.manifestUrl, { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({}))
      .then((m) => { this.manifest = m || {}; return this; });
  }

  has(id) { return !!this.manifest[id]; }

  /** Duration in seconds, or 0 if unknown. */
  duration(id) {
    const e = this.manifest[id];
    if (!e) return 0;
    const buf = this._cache.get(id)?._buffer;
    return buf ? buf.duration : e.duration || 0;
  }

  text(id) { return this.manifest[id]?.text ?? ''; }

  /** Fetch + decode (cached). Resolves to an AudioBuffer. */
  preload(id) {
    const entry = this.manifest[id];
    if (!entry) return Promise.reject(new Error(`voice: unknown line "${id}"`));
    let p = this._cache.get(id);
    if (p) {
      this._cache.delete(id); // bump to most-recently-used
      this._cache.set(id, p);
      return p;
    }
    const url = new URL(entry.file, this.manifestUrl);
    p = fetch(url)
      .then((r) => { if (!r.ok) throw new Error(`voice: HTTP ${r.status} for ${entry.file}`); return r.arrayBuffer(); })
      .then((ab) => this.ctx.decodeAudioData(ab))
      .then((buf) => { p._buffer = buf; return buf; });
    p.catch(() => this._cache.delete(id)); // allow retry after failures
    this._cache.set(id, p);
    while (this._cache.size > this.cacheSize) this._cache.delete(this._cache.keys().next().value);
    return p;
  }

  /**
   * Play a line. Returns a handle immediately; audio starts once decoded.
   * @param {string} id
   * @param {{ onStart?: (info:{duration:number}) => void, onEnd?: (info:{stopped?:boolean, error?:Error}) => void, gain?: number }} [opts]
   * @returns {{ stop: (fade?: number) => void, done: Promise<void> }}
   */
  play(id, { onStart, onEnd, gain = 1 } = {}) {
    const ctx = this.ctx;
    let src = null, g = null, finished = false, cancelled = false;
    let resolveDone;
    const done = new Promise((r) => (resolveDone = r));
    const finish = (info) => {
      if (finished) return;
      finished = true;
      this._active.delete(handle);
      try { onEnd && onEnd(info); } catch (e) { console.error(e); }
      resolveDone();
    };
    const handle = {
      done,
      stop: (fade = 0.08) => {
        if (finished) return;
        cancelled = true;
        if (src && g) {
          const t = ctx.currentTime;
          g.gain.cancelScheduledValues(t);
          g.gain.setValueAtTime(g.gain.value, t);
          g.gain.linearRampToValueAtTime(0, t + fade);
          src.onended = null;
          try { src.stop(t + fade + 0.01); } catch {}
          setTimeout(() => { try { g.disconnect(); } catch {} }, (fade + 0.1) * 1000);
        }
        finish({ stopped: true });
      },
    };
    this._active.add(handle);

    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    this.preload(id).then(
      (buf) => {
        if (cancelled || finished) return;
        g = ctx.createGain();
        g.gain.value = gain;
        g.connect(this.destination);
        src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(g);
        src.onended = () => { try { g.disconnect(); } catch {} finish({}); };
        src.start();
        try { onStart && onStart({ duration: buf.duration }); } catch (e) { console.error(e); }
      },
      (error) => { if (!finished) queueMicrotask(() => finish({ error })); },
    );
    return handle;
  }

  /** Stop every line currently playing. */
  stopAll(fade) { for (const h of [...this._active]) h.stop(fade); }
}
