// Dialogue director: queues spoken lines, plays Gemini-TTS voice files when present (talk-blip fallback),
// drives subtitles and the guide's talk animation, ducks music while speaking.
import { LINES } from '../data/dialogue.js';

const BY_ID = Object.fromEntries(LINES.map((l) => [l.id, l]));
const NAMES = { celia: 'Dr. Celia Mendel', worker1: 'Dock Worker', worker2: 'Engineer', worker3: 'Lab Technician', worker4: 'Plant Operator' };

export class Director {
  constructor({ ui, voice, audio, sfx, guide }) {
    this.ui = ui; this.voice = voice; this.audio = audio; this.sfx = sfx; this.guide = guide;
    this.queue = []; this.current = null; this.subtitles = true;
    this.lastSpoke = 0;
  }
  line(id) { return BY_ID[id]; }
  /** Worker bark ids for a district (falls back to any bark). */
  barks(district) {
    const own = LINES.filter((l) => l.id.startsWith(`bark_${district}_`)).map((l) => l.id);
    return own.length ? own : LINES.filter((l) => l.id.startsWith('bark_')).map((l) => l.id);
  }
  has(id) { return !!BY_ID[id]; }
  get busy() { return !!this.current || this.queue.length > 0; }

  /** Say a line by id (or {speaker,text}). opts: {interrupt, choices, onChoice, onEnd, hold} */
  say(idOrLine, opts = {}) {
    const l = typeof idOrLine === 'string' ? BY_ID[idOrLine] : idOrLine;
    if (!l) { opts.onEnd?.(); return; }
    if (opts.interrupt) { this.queue.length = 0; this.stopCurrent(); }
    this.queue.push({ l, opts });
    if (!this.current) this._next();
  }
  sayAll(ids, opts = {}) { ids.forEach((id, i) => this.say(id, i === ids.length - 1 ? opts : {})); }

  stopCurrent() {
    const c = this.current; if (!c) return;
    this.current = null;
    c.handle?.stop?.(0.15); clearTimeout(c.timer); clearInterval(c.blip);
    if (this.guide) this.guide.talking = false;
  }
  skip() { if (!this.current) return false; const cb = this.current.opts.onEnd; this.stopCurrent(); cb?.(); this._next(); return true; }
  clear() { this.queue.length = 0; this.stopCurrent(); this.ui.closeDialogue(); this.audio?.duck?.(0, 0.6); }

  _next() {
    const item = this.queue.shift();
    if (!item) { this.current = null; this._closeTimer = setTimeout(() => { if (!this.current) { this.ui.closeDialogue(); this.audio?.duck?.(0, 0.8); } }, 900); return; }
    clearTimeout(this._closeTimer);
    const { l, opts } = item;
    const worker = l.speaker !== 'celia';
    this.current = { l, opts };
    this.lastSpoke = performance.now();
    this.ui.dialogue(NAMES[l.speaker] || l.speaker, l.text, { worker, choices: opts.choices, onChoice: (v) => { opts.onChoice?.(v); this.skip(); } });
    if (!worker && this.guide) this.guide.talking = true;
    this.audio?.duck?.(0.55, 0.4);
    const finish = () => {
      if (!this.current || this.current.l !== l) return;
      this.ui.stopTalking();
      if (this.guide) this.guide.talking = false;
      // with choices, wait for the click; otherwise linger so it can be read
      if (opts.choices) return;
      const linger = Math.min(2200, 600 + l.text.length * 12);
      this.current.timer = setTimeout(() => { if (this.current?.l !== l) return; this.current = null; opts.onEnd?.(); this._next(); }, linger);
    };
    if (this.voice?.has?.(l.id)) {
      const h = this.voice.play(l.id, { onEnd: (r) => { if (!r?.stopped) finish(); } });
      this.current.handle = h;
    } else {
      // no voice file: gentle talk blips paced to the typewriter, then linger
      const dur = 700 + l.text.length * 42;
      let n = 0;
      const blip = setInterval(() => { if (n++ % 3 === 0) this.sfx?.('guide_blip'); }, 90);
      this.current.blip = blip;
      setTimeout(() => clearInterval(blip), Math.min(dur, l.text.length * 22));
      this.current.timer = setTimeout(finish, dur);
    }
  }
}
