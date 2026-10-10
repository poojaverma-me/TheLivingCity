// Field-notebook progress, persisted per viewer in localStorage (best effort).
const KEY = 'livingCity.progress.v1';

export class Progress {
  constructor() {
    this.visited = new Set(); this.tried = new Set(); this.found = new Set(); this.flags = {};
    this.listeners = [];
    try {
      const d = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (d) { d.visited?.forEach((v) => this.visited.add(v)); d.tried?.forEach((v) => this.tried.add(v)); d.found?.forEach((v) => this.found.add(v)); this.flags = d.flags || {}; }
    } catch { /* storage unavailable: progress lives for this session only */ }
  }
  save() {
    try { localStorage.setItem(KEY, JSON.stringify({ visited: [...this.visited], tried: [...this.tried], found: [...this.found], flags: this.flags })); } catch { /* ignore */ }
    this.listeners.forEach((f) => f(this));
  }
  onChange(f) { this.listeners.push(f); }
  /** Returns true when newly added. */
  visit(id) { if (this.visited.has(id)) return false; this.visited.add(id); this.save(); return true; }
  try(id) { if (this.tried.has(id)) return false; this.tried.add(id); this.save(); return true; }
  find(id) { if (this.found.has(id)) return false; this.found.add(id); this.save(); return true; }
  flag(k, v = true) { this.flags[k] = v; this.save(); }
  reset() { this.visited.clear(); this.tried.clear(); this.found.clear(); this.flags = {}; this.save(); }
  get total() { return this.visited.size + this.tried.size + this.found.size; }
}
