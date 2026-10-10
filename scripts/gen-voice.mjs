#!/usr/bin/env node
// Offline voice generation for The Living City (Gemini TTS).
//
//   node scripts/gen-voice.mjs [flags]
//
// Reads  src/data/dialogue.js  (export LINES = [{id, speaker, text, style?}], VOICES = {speaker: {voice, style}})
// Writes public/audio/voice/<id>.<hash8>.mp3 (or .wav without ffmpeg) + public/audio/voice/manifest.json
//
// Flags:
//   --only=id1,id2      only these line ids
//   --force             regenerate even if a cached file exists
//   --dry-run           show what would be generated, no API calls
//   --limit=N           generate at most N new lines this run
//   --model=ID          TTS model (default gemini-3.8-flash-tts)
//   --api=interactions|generate   request shape (default interactions; "generate" = models/*:generateContent)
//   --rpm=N             max requests/minute PER KEY (default 6, env GEMINI_TTS_RPM)
//   --concurrency=N     1 or 2 (default 1)
//   --format=mp3|ogg|wav  output format (default mp3; falls back to wav when ffmpeg is missing)
//   --batch=N             pack up to N lines (same voice + style) into ONE request separated by <long pause>
//                         tags, then split the audio at the silences (saves daily quota; falls back to
//                         one request per line when a split doesn't look right)
//   --audition=V1,V2    with --only=<id>: render that line with each voice into _auditions/ (manifest untouched)
//   --max-attempts=N    attempts per line (default 6)
//
// Keys: GEMINI_API_KEYS=k1,k2,... in .env (or the environment). Keys are NEVER printed; any text that
// leaves this script passes through redact(). Auth is the x-goog-api-key header (works with "AQ." keys).

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync, spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIALOGUE = path.join(ROOT, 'src/data/dialogue.js');
const OUT_DIR = path.join(ROOT, 'public/audio/voice');
const AUDITION_DIR = path.join(OUT_DIR, '_auditions');
const MANIFEST = path.join(OUT_DIR, 'manifest.json');
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

// ---------------------------------------------------------------- args
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    if (!m) die(`Unknown argument: ${a}`);
    return [m[1], m[2] ?? true];
  }),
);
const known = ['only', 'force', 'dry-run', 'limit', 'model', 'api', 'rpm', 'concurrency', 'format', 'audition', 'max-attempts', 'help', 'batch', 'debug-batch', 'selftest', 'verify'];
for (const k of Object.keys(args)) if (!known.includes(k)) die(`Unknown flag --${k}`);
if (args.help) {
  console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 22).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
  process.exit(0);
}
const OPT = {
  batch: Math.max(1, Math.min(12, parseInt(args.batch, 10) || 1)),
  debugBatch: !!args['debug-batch'],
  verify: !!args.verify, // transcribe each batched segment and reject mismatches (uses a Gemini text model)
  only: typeof args.only === 'string' ? args.only.split(',').map((s) => s.trim()).filter(Boolean) : null,
  force: !!args.force,
  dryRun: !!args['dry-run'],
  limit: args.limit ? parseInt(args.limit, 10) : Infinity,
  model: typeof args.model === 'string' ? args.model : process.env.GEMINI_TTS_MODEL || 'gemini-3.8-flash-tts',
  api: typeof args.api === 'string' ? args.api : 'interactions',
  rpm: Number(args.rpm || process.env.GEMINI_TTS_RPM || 6),
  concurrency: Math.min(2, Math.max(1, parseInt(args.concurrency || '1', 10))),
  format: typeof args.format === 'string' ? args.format : 'mp3',
  audition: typeof args.audition === 'string' ? args.audition.split(',').map((s) => s.trim()).filter(Boolean) : null,
  maxAttempts: parseInt(args['max-attempts'] || '6', 10),
};
if (!['interactions', 'generate'].includes(OPT.api)) die('--api must be interactions or generate');
if (!['mp3', 'ogg', 'wav'].includes(OPT.format)) die('--format must be mp3, ogg or wav');
if (OPT.audition && (!OPT.only || OPT.only.length !== 1)) die('--audition needs exactly one line via --only=<id>');

// ---------------------------------------------------------------- keys (never printed)
function loadKeys() {
  let raw = process.env.GEMINI_API_KEYS || '';
  const envPath = path.join(ROOT, '.env');
  if (!raw && fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*(?:export\s+)?GEMINI_API_KEYS?\s*=\s*(.*)\s*$/);
      if (m) { raw = m[1].replace(/\s+#.*$/, '').replace(/^["']|["']$/g, ''); break; }
    }
  }
  return [...new Set(raw.split(',').map((s) => s.trim()).filter(Boolean))];
}
const KEYS = loadKeys();
const SECRETS = KEYS.slice().sort((a, b) => b.length - a.length);
function redact(s) {
  let out = String(s);
  for (const k of SECRETS) out = out.split(k).join('<REDACTED>');
  return out.replace(/([?&]key=)[^&\s"']+/g, '$1<REDACTED>');
}
const log = (...a) => console.log(redact(a.join(' ')));
const warn = (...a) => console.warn(redact(a.join(' ')));
function die(msg) { console.error(redact(`✖ ${msg}`)); process.exit(1); }

// ---------------------------------------------------------------- util
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jitter = (ms) => Math.round(ms * (0.8 + Math.random() * 0.4));
const backoff = (attempt) => jitter(Math.min(60_000, 2000 * 2 ** attempt));
const fmtS = (ms) => `${(ms / 1000).toFixed(1)}s`;
const hasBin = (b) => spawnSync(b, ['-version'], { stdio: 'ignore' }).status === 0;
const FFMPEG = hasBin('ffmpeg');
const EXT = OPT.format !== 'wav' && !FFMPEG ? 'wav' : OPT.format;

function hash8(model, voice, style, text) {
  return crypto.createHash('sha256').update(JSON.stringify([model, voice, style || '', text])).digest('hex').slice(0, 8);
}
function parseDuration(s) {
  if (typeof s === 'number') return s * 1000;
  const m = String(s || '').match(/^([\d.]+)s$/);
  return m ? parseFloat(m[1]) * 1000 : null;
}
async function writeAtomic(file, data) {
  const tmp = `${file}.tmp-${process.pid}`;
  await fsp.writeFile(tmp, data);
  await fsp.rename(tmp, file);
}

// ---------------------------------------------------------------- audio
// Returns { pcm: Buffer (s16le mono), rate } from either a WAV (RIFF) blob or raw L16 PCM.
function toPcm(buf, mime = '') {
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WAVE') {
    let off = 12, rate = 24000, ch = 1, bits = 16, data = null;
    while (off + 8 <= buf.length) {
      const id = buf.toString('ascii', off, off + 4);
      let size = buf.readUInt32LE(off + 4);
      if (id === 'fmt ') {
        ch = buf.readUInt16LE(off + 10); rate = buf.readUInt32LE(off + 12); bits = buf.readUInt16LE(off + 22);
      } else if (id === 'data') {
        if (size === 0 || size === 0xffffffff || off + 8 + size > buf.length) size = buf.length - off - 8; // streaming-style header
        data = buf.subarray(off + 8, off + 8 + size);
        break;
      }
      off += 8 + size + (size & 1);
    }
    if (!data) throw new Error('WAV without data chunk');
    if (bits !== 16 || ch !== 1) throw new Error(`unexpected WAV format ${ch}ch ${bits}bit`);
    return { pcm: data, rate };
  }
  const m = /rate=(\d+)/i.exec(mime);
  if (/l16|pcm/i.test(mime) || !mime) return { pcm: buf, rate: m ? +m[1] : 24000 };
  throw new Error(`unsupported audio mime type ${mime}`);
}
function wavFromPcm(pcm, rate) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}
// Peak level (0..1) — used to catch silent/garbage responses.
function peak(pcm) {
  let p = 0;
  for (let i = 0; i + 1 < pcm.length; i += 2) { const v = Math.abs(pcm.readInt16LE(i)); if (v > p) p = v; }
  return p / 32768;
}
function encode(wav, outFile) {
  return new Promise((resolve, reject) => {
    const codec = EXT === 'mp3'
      ? ['-c:a', 'libmp3lame', '-q:a', '5'] // VBR ~64-80 kbps for 24 kHz mono speech
      : ['-c:a', 'libopus', '-b:a', '40k', '-application', 'voip'];
    // loudnorm keeps all voices at a consistent level (-18 LUFS, -1.5 dBTP) so the game mix is predictable.
    const p = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'wav', '-i', 'pipe:0',
      '-af', 'loudnorm=I=-18:TP=-1.5:LRA=11', '-ac', '1', '-ar', EXT === 'mp3' ? '24000' : '48000', ...codec, outFile],
    { stdio: ['pipe', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => (err += d));
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}: ${err.trim()}`))));
    p.stdin.end(wav);
  });
}

// ---------------------------------------------------------------- key pool
class KeyPool {
  constructor(keys, rpm) {
    this.minGap = Math.ceil(60_000 / Math.max(0.1, rpm));
    this.keys = keys.map((key, i) => ({ key, label: `key#${i + 1}`, cooldownUntil: 0, lastAt: 0, dead: null, ok: 0, fails: 0, n429: 0 }));
    this.rr = 0;
  }
  alive() { return this.keys.filter((k) => !k.dead); }
  // Wait for the next key that is out of cooldown and under its RPM budget (round-robin on ties).
  async acquire() {
    for (;;) {
      const alive = this.alive();
      if (!alive.length) throw new Error('no usable API keys left (all dead or quota-exhausted)');
      const now = Date.now();
      let best = null, bestAt = Infinity;
      for (let j = 0; j < this.keys.length; j++) {
        const k = this.keys[(this.rr + j) % this.keys.length];
        if (k.dead) continue;
        const at = Math.max(k.cooldownUntil, k.lastAt + this.minGap);
        if (at < bestAt) { best = k; bestAt = at; }
      }
      if (bestAt <= now) {
        best.lastAt = now;
        this.rr = (this.keys.indexOf(best) + 1) % this.keys.length;
        return best;
      }
      const wait = bestAt - now;
      if (wait > 3000) log(`  … waiting ${fmtS(wait)} for ${best.label} (rate limit / cooldown)`);
      await sleep(Math.min(wait, 60_000));
    }
  }
  cooldown(k, ms, why) {
    k.cooldownUntil = Math.max(k.cooldownUntil, Date.now() + ms);
    log(`  ⏸ ${k.label} cooling down ${fmtS(ms)} (${why})`);
  }
  kill(k, why) { k.dead = why; warn(`  ✖ ${k.label} disabled: ${why}`); }
  summary() {
    return this.keys.map((k) => `${k.label}: ${k.ok} ok, ${k.fails} failed, ${k.n429}×429${k.dead ? ` [DISABLED: ${k.dead}]` : ''}`).join('\n  ');
  }
}

// ---------------------------------------------------------------- API
class ApiError extends Error {
  constructor(status, body) {
    const e = Array.isArray(body) ? body[0]?.error : body?.error;
    super(redact(`HTTP ${status} ${e?.status || ''} ${e?.message || (typeof body === 'string' ? body.slice(0, 300) : '')}`.trim()));
    this.status = status;
    this.details = e?.details || [];
    this.reason = this.details.find((d) => d.reason)?.reason || e?.status || '';
    const ri = this.details.find((d) => String(d['@type']).endsWith('RetryInfo'));
    this.retryMs = ri ? parseDuration(ri.retryDelay) : null;
    const qf = this.details.find((d) => String(d['@type']).endsWith('QuotaFailure'));
    this.quotaIds = (qf?.violations || []).map((v) => v.quotaId || v.quotaMetric || '').join(',');
  }
}

function buildRequest(text, voice, style) {
  if (OPT.api === 'interactions') {
    // a batch (array of lines) goes in as separate text items, each followed by an explicit long pause item,
    // so the model treats every line as its own utterance instead of one paragraph it may abridge
    const items = Array.isArray(text)
      ? text.flatMap((t, i) => (i < text.length - 1 ? [{ type: 'text', text: t }, { type: 'text', text: '<long pause> <long pause> <long pause>' }] : [{ type: 'text', text: t }]))
      : [{ type: 'text', text }];
    const content = items[0];
    if (style) for (const it of items) it.annotations = [{ type: 'speech_metadata', style }];
    return {
      url: `${API_BASE}/interactions`,
      body: {
        model: OPT.model,
        input: [{ type: 'user_input', content: items }],
        response_format: { type: 'audio' },
        generation_config: { speech_config: [{ voice }] },
      },
    };
  }
  if (Array.isArray(text)) text = text.join(PAUSE);
  // Legacy generateContent shape: style must be folded into the prompt itself.
  const prompt = style ? `Read the following line aloud. Delivery: ${style}.\n\n${text}` : text;
  return {
    url: `${API_BASE}/models/${encodeURIComponent(OPT.model)}:generateContent`,
    body: {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } },
    },
  };
}
function extractAudio(json) {
  if (OPT.api === 'interactions') {
    const c = (json.steps || []).flatMap((s) => s.content || []).filter((c) => c.type === 'audio' && c.data).pop();
    return c ? { b64: c.data, mime: c.mime_type || '' } : null;
  }
  const parts = json.candidates?.[0]?.content?.parts || [];
  const p = parts.find((p) => p.inlineData?.data);
  return p ? { b64: p.inlineData.data, mime: p.inlineData.mimeType || '' } : null;
}

async function callTts(k, text, voice, style) {
  const { url, body } = buildRequest(text, voice, style);
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'x-goog-api-key': k.key, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    });
  } catch (e) {
    const err = new Error(redact(`network: ${e.cause?.code || e.name}: ${e.message}`));
    err.status = 0;
    throw err;
  }
  const raw = await res.text();
  let json;
  try { json = JSON.parse(raw); } catch { json = raw; }
  if (!res.ok) throw new ApiError(res.status, json);
  const audio = typeof json === 'object' ? extractAudio(json) : null;
  if (!audio) {
    const why = json?.candidates?.[0]?.finishReason || json?.status || 'no audio in response';
    const err = new Error(`no audio returned (${why})`);
    err.status = 200;
    throw err;
  }
  return toPcm(Buffer.from(audio.b64, 'base64'), audio.mime);
}

// Synthesize one line with retries, key rotation and quota handling. Returns { pcm, rate }.
async function synth(pool, label, text, voice, style) {
  let lastErr;
  for (let attempt = 0; attempt < OPT.maxAttempts; attempt++) {
    const k = await pool.acquire();
    const t0 = Date.now();
    try {
      const out = await callTts(k, text, voice, style);
      const secs = out.pcm.length / 2 / out.rate;
      const words = wordCount(Array.isArray(text) ? text.join(' ') : text);
      // Sanity: catch silent/truncated/runaway output (normal speech ≈ 1.5–4 words/s).
      const wps = words / Math.max(secs, 0.01);
      k.ok++;
      if ((peak(out.pcm) < 0.01 || wps > 8 || (secs > 6 && wps < 0.6)) && attempt < 2) {
        lastErr = new Error(`implausible audio (${secs.toFixed(2)}s for ${words} words)`);
        log(`  ↻ ${label}: ${lastErr.message}, retrying`);
        continue;
      }
      log(`  ✓ ${label} via ${k.label} in ${fmtS(Date.now() - t0)} → ${secs.toFixed(2)}s audio`);
      return out;
    } catch (e) {
      lastErr = e;
      k.fails++;
      const s = e.status;
      if (s === 429 || e.reason === 'RESOURCE_EXHAUSTED') {
        k.n429++;
        if (/PerDay|per_day|daily/i.test(e.quotaIds + e.message)) {
          pool.kill(k, `daily quota exhausted (${e.quotaIds || 'RESOURCE_EXHAUSTED'})`);
        } else {
          pool.cooldown(k, Math.max(e.retryMs ?? 0, backoff(Math.min(k.n429, 4))) + 500, `429 ${e.quotaIds || ''}`.trim());
        }
      } else if (s === 401 || s === 403 || e.reason === 'API_KEY_INVALID') {
        pool.kill(k, `${s} ${e.reason || ''}`.trim());
      } else if (s === 400 || s === 404) {
        // Request problem (bad voice/model/text) – not a key problem; retrying won't help.
        throw e;
      } else {
        const wait = backoff(attempt);
        log(`  ↻ ${label}: ${e.message} — retry in ${fmtS(wait)}`);
        pool.cooldown(k, wait, `error ${s ?? '?'}`);
      }
    }
  }
  throw lastErr || new Error('failed');
}

// ---------------------------------------------------------------- batching
const PAUSE = ' <long pause> <long pause> ';
const wordCount = (t) => t.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;

/** Silent runs in s16le PCM: [{ start, end }] in samples (20 ms RMS frames below an adaptive threshold). */
function silentRuns(pcm, rate) {
  const n = pcm.length / 2, F = Math.round(rate * 0.02), frames = Math.floor(n / F), rms = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    let acc = 0; for (let i = f * F; i < (f + 1) * F; i++) { const v = pcm.readInt16LE(i * 2) / 32768; acc += v * v; }
    rms[f] = Math.sqrt(acc / F);
  }
  const sorted = Array.from(rms).sort((a, b) => a - b), speech = sorted[Math.floor(frames * 0.9)] || 0.1;
  const thr = Math.max(0.004, speech * 0.06);
  const runs = []; let st = -1;
  for (let f = 0; f <= frames; f++) {
    const quiet = f < frames && rms[f] < thr;
    if (quiet && st < 0) st = f;
    if (!quiet && st >= 0) { runs.push({ start: st * F, end: f * F }); st = -1; }
  }
  return runs;
}

/** Split one batched render into `parts.length` segments at the (k-1) longest interior silences. */
function splitBatch(pcm, rate, parts) {
  const n = pcm.length / 2, k = parts.length;
  const runs = silentRuns(pcm, rate).filter((r) => r.start > rate * 0.15 && r.end < n - rate * 0.15); // interior only
  if (runs.length < k - 1) return { ok: false, why: `found ${runs.length} pauses, need ${k - 1}` };
  const byLen = runs.slice().sort((a, b) => (b.end - b.start) - (a.end - a.start));
  const cut = byLen.slice(0, k - 1), nextLen = byLen[k - 1] ? byLen[k - 1].end - byLen[k - 1].start : 0;
  const minCut = Math.min(...cut.map((r) => r.end - r.start));
  // the separator pauses must clearly stand out from ordinary in-sentence pauses
  if (minCut < rate * 0.55 || (nextLen && minCut < nextLen * 1.35)) return { ok: false, why: `pauses not distinct (shortest cut ${(minCut / rate).toFixed(2)}s vs next ${(nextLen / rate).toFixed(2)}s)` };
  cut.sort((a, b) => a.start - b.start);
  const pad = Math.round(rate * 0.12), segs = [];
  let from = 0;
  for (let i = 0; i < k; i++) {
    const to = i < k - 1 ? cut[i].start : n;
    let a = from, b = to;
    // trim leading/trailing silence, keep a little air
    const sr = silentRuns(pcm.subarray(a * 2, b * 2), rate);
    if (sr[0] && sr[0].start === 0) a += Math.max(0, sr[0].end - pad);
    const last = sr[sr.length - 1];
    if (last && last.end >= (b - a) - Math.round(rate * 0.04)) b = Math.min(b, from + last.start + pad);
    segs.push(pcm.subarray(a * 2, Math.max(a + 1, b) * 2));
    if (i < k - 1) from = cut[i].end;
  }
  // each segment must be plausible for its text (≈1.1–5 words/s)
  for (let i = 0; i < k; i++) {
    const secs = segs[i].length / 2 / rate, wps = wordCount(parts[i]) / Math.max(secs, 0.01);
    if (secs < 0.5 || wps > 5.2 || wps < 1.0) return { ok: false, why: `segment ${i + 1} implausible (${secs.toFixed(2)}s for ${wordCount(parts[i])} words)` };
  }
  return { ok: true, segs };
}

/** Transcribes a PCM segment with a Gemini text model; returns the share of expected words heard (0..1), or null if unavailable. */
async function heardShare(pool, pcm, rate, text) {
  const k = await pool.acquire();
  const b64 = wavFromPcm(pcm, rate).toString('base64');
  try {
    const res = await fetch(`${API_BASE}/models/gemini-3.5-flash:generateContent`, {
      method: 'POST', headers: { 'x-goog-api-key': k.key, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(60_000),
      body: JSON.stringify({ contents: [{ parts: [{ inlineData: { mimeType: 'audio/wav', data: b64 } }, { text: 'Transcribe this audio verbatim. Output only the words spoken.' }] }] }),
    });
    if (!res.ok) return null;
    const said = ((await res.json()).candidates?.[0]?.content?.parts || []).map((p) => p.text).join(' ');
    const norm = (t) => t.toLowerCase().replace(/<[^>]+>/g, ' ').replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).filter(Boolean);
    const want = norm(text), got = norm(said);
    return want.filter((w) => got.includes(w)).length / Math.max(1, want.length);
  } catch { return null; }
}

// ---------------------------------------------------------------- main
async function main() {
  if (!fs.existsSync(DIALOGUE)) die(`missing ${path.relative(ROOT, DIALOGUE)}`);
  const mod = await import(`${pathToFileURL(DIALOGUE).href}?t=${Date.now()}`);
  const LINES = mod.LINES || [];
  const VOICES = mod.VOICES || {};

  // Validate dialogue.
  const seen = new Set();
  for (const l of LINES) {
    if (!l.id || !/^[\w-]+$/.test(l.id)) die(`invalid line id ${JSON.stringify(l.id)} (use [A-Za-z0-9_-])`);
    if (seen.has(l.id)) die(`duplicate line id ${l.id}`);
    seen.add(l.id);
    if (!VOICES[l.speaker]) die(`line ${l.id}: unknown speaker "${l.speaker}" (add it to VOICES)`);
    if (!l.text || !String(l.text).trim()) die(`line ${l.id}: empty text`);
  }
  if (OPT.only) for (const id of OPT.only) if (!seen.has(id)) die(`--only: unknown id ${id}`);

  await fsp.mkdir(OUT_DIR, { recursive: true });
  const selected = LINES.filter((l) => !OPT.only || OPT.only.includes(l.id));

  log(`Gemini TTS · model ${OPT.model} · api ${OPT.api} · ${KEYS.length} key(s) · ≤${OPT.rpm} rpm/key · concurrency ${OPT.concurrency} · ${EXT}${EXT !== OPT.format ? ' (ffmpeg missing)' : ''}`);

  // ---- auditions
  if (OPT.audition) {
    const line = selected[0];
    const style = [VOICES[line.speaker].style, line.style].filter(Boolean).join('; ');
    if (OPT.dryRun) { log(`[dry-run] would audition ${line.id} with: ${OPT.audition.join(', ')}`); return; }
    if (!KEYS.length) die('no GEMINI_API_KEYS found in .env or environment');
    const pool = new KeyPool(KEYS, OPT.rpm);
    await fsp.mkdir(AUDITION_DIR, { recursive: true });
    for (const voice of OPT.audition) {
      const out = path.join(AUDITION_DIR, `${line.id}.${voice}.${EXT}`);
      if (fs.existsSync(out) && !OPT.force) { log(`  • ${path.relative(ROOT, out)} exists (use --force)`); continue; }
      try {
        const { pcm, rate } = await synth(pool, `${line.id} [${voice}]`, line.text, voice, style);
        const wav = wavFromPcm(pcm, rate);
        if (EXT === 'wav') await writeAtomic(out, wav); else await encode(wav, out);
        log(`    → ${path.relative(ROOT, out)}`);
      } catch (e) { warn(`  ✖ ${voice}: ${e.message}`); }
    }
    log(`Keys:\n  ${pool.summary()}`);
    return;
  }

  // ---- plan
  const jobs = [];
  let cachedCount = 0;
  for (const l of selected) {
    const v = VOICES[l.speaker];
    const style = [v.style, l.style].filter(Boolean).join('; ');
    const h = hash8(OPT.model, v.voice, style, l.text);
    const file = `${l.id}.${h}.${EXT}`;
    const exists = fs.existsSync(path.join(OUT_DIR, file));
    if (exists && !OPT.force) { cachedCount++; continue; }
    jobs.push({ line: l, voice: v.voice, style, file });
  }
  const todo = jobs.slice(0, OPT.limit);
  log(`${selected.length} line(s) selected · ${cachedCount} cached · ${jobs.length} to generate${todo.length < jobs.length ? ` (limited to ${todo.length})` : ''}`);

  if (OPT.dryRun) {
    for (const j of todo) log(`  [dry-run] ${j.file}  ${j.line.speaker}/${j.voice}  "${j.line.text.slice(0, 70)}${j.line.text.length > 70 ? '…' : ''}"`);
    return;
  }

  // ---- generate
  let failed = 0, done = 0;
  if (todo.length) {
    if (!KEYS.length) die('no GEMINI_API_KEYS found in .env or environment');
    const pool = new KeyPool(KEYS, OPT.rpm);
    let stop = false;
    process.on('SIGINT', () => { if (stop) process.exit(130); stop = true; log('\n⏹ stopping after in-flight requests (Ctrl-C again to abort)…'); });
    // batches: consecutive lines that share voice + style, up to OPT.batch per request
    const groups = new Map();
    for (const j of todo) { const key = `${j.voice}|${j.style}`; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(j); }
    const queue = [];
    for (const list of groups.values()) for (let i = 0; i < list.length; i += OPT.batch) queue.push(list.slice(i, i + OPT.batch));
    const save = async (j, pcm, rate) => {
      const wav = wavFromPcm(pcm, rate), outPath = path.join(OUT_DIR, j.file);
      if (EXT === 'wav') await writeAtomic(outPath, wav);
      else { const tmp = `${outPath}.part.${EXT}`; await encode(wav, tmp); await fsp.rename(tmp, outPath); }
      await removeStale(j.line.id, j.file);
      DURATIONS.set(j.file, +(pcm.length / 2 / rate).toFixed(3));
      done++;
      await writeManifest(LINES, VOICES);
    };
    const worker = async () => {
      while (queue.length && !stop) {
        const batch = queue.shift();
        if (batch.length > 1) {
          log(`[batch ×${batch.length}] ${batch.map((j) => j.line.id).join(', ')} (${batch[0].line.speaker} → ${batch[0].voice})`);
          try {
            const parts = batch.map((j) => j.line.text);
            const { pcm, rate } = await synth(pool, `batch(${batch.length})`, parts, batch[0].voice, batch[0].style);
            const sp = splitBatch(pcm, rate, parts);
            if (sp.ok) {
              // optional content check: a segment that drops part of its sentence is re-done on its own
              const redo = [];
              for (let i = 0; i < batch.length; i++) {
                const share = OPT.verify ? await heardShare(pool, sp.segs[i], rate, parts[i]) : null;
                if (share != null && share < 0.7) { redo.push(batch[i]); log(`    ✗ ${batch[i].line.id}: only ${(share * 100).toFixed(0)}% of the words heard — will redo alone`); continue; }
                await save(batch[i], sp.segs[i], rate);
                log(`    ✂ ${batch[i].line.id} → ${(sp.segs[i].length / 2 / rate).toFixed(2)}s${share != null ? ` (verified ${(share * 100).toFixed(0)}%)` : ''}`);
              }
              for (const j of redo.reverse()) queue.unshift([j]);
              continue;
            }
            warn(`  ⚠ split failed (${sp.why}) — falling back to one request per line`);
            if (OPT.debugBatch) await writeAtomic(path.join(OUT_DIR, `_batch-debug.wav`), wavFromPcm(pcm, rate));
          } catch (e) {
            warn(`  ✖ batch: ${e.message}`);
            if (/no usable API keys/.test(e.message)) { stop = true; failed += batch.length; continue; }
          }
          // fallback: individual requests for this batch
          for (const j of batch.reverse()) queue.unshift([j]);
          continue;
        }
        const j = batch[0];
        log(`[${done + 1}/${todo.length}] ${j.line.id} (${j.line.speaker} → ${j.voice})`);
        try {
          const { pcm, rate } = await synth(pool, j.line.id, j.line.text, j.voice, j.style);
          await save(j, pcm, rate); // incremental manifest: a crash/Ctrl-C keeps everything finished so far
        } catch (e) {
          failed++;
          warn(`  ✖ ${j.line.id}: ${e.message}`);
          if (/no usable API keys/.test(e.message)) { stop = true; }
        }
      }
    };
    await Promise.all(Array.from({ length: OPT.concurrency }, worker));
    log(`Keys:\n  ${pool.summary()}`);
  }
  const m = await writeManifest(LINES, VOICES);
  const missing = LINES.length - Object.keys(m).length;
  log(`Done: ${done} generated, ${failed} failed, ${cachedCount} cached. Manifest: ${Object.keys(m).length}/${LINES.length} lines${missing ? ` (${missing} without audio — re-run to resume)` : ''}.`);
  if (failed) process.exitCode = 2;
}

// Remove older renders of the same line id (different hash/format).
async function removeStale(id, keep) {
  for (const f of await fsp.readdir(OUT_DIR)) {
    if (f !== keep && f.startsWith(`${id}.`) && /^[0-9a-f]{8}\.(mp3|ogg|wav)(\.part\.\w+)?$/.test(f.slice(id.length + 1))) {
      await fsp.rm(path.join(OUT_DIR, f), { force: true });
    }
  }
}

// file -> seconds (exact, from PCM length); seeded from the previous manifest so re-runs don't re-probe.
const DURATIONS = new Map();
try {
  for (const e of Object.values(JSON.parse(fs.readFileSync(MANIFEST, 'utf8')))) if (e?.file && e.duration != null) DURATIONS.set(e.file, e.duration);
} catch {}

// Manifest lists every line whose CURRENT render (current model/voice/style/text) exists on disk.
async function writeManifest(LINES, VOICES) {
  const manifest = {};
  for (const l of LINES) {
    const v = VOICES[l.speaker];
    const style = [v.style, l.style].filter(Boolean).join('; ');
    const file = `${l.id}.${hash8(OPT.model, v.voice, style, l.text)}.${EXT}`;
    const p = path.join(OUT_DIR, file);
    if (!fs.existsSync(p)) continue;
    let duration = DURATIONS.get(file);
    if (duration == null) DURATIONS.set(file, (duration = probeDuration(p)));
    manifest[l.id] = { file, duration, text: l.text, speaker: l.speaker };
  }
  await writeAtomic(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}
function probeDuration(p) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', p], { encoding: 'utf8' });
  const d = parseFloat(r.stdout);
  return Number.isFinite(d) ? +d.toFixed(3) : null;
}

// --selftest: stitch existing renders together with gaps (plus short in-line pauses as decoys) and check the splitter
async function selftest() {
  const m = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const ids = Object.keys(m).filter((id) => id.startsWith('intro') || id.startsWith('nucleus')).slice(0, 4);
  const rate = 24000, pcms = [];
  for (const id of ids) {
    const r = spawnSync('ffmpeg', ['-v', 'error', '-i', path.join(OUT_DIR, m[id].file), '-f', 's16le', '-ac', '1', '-ar', String(rate), 'pipe:1'], { maxBuffer: 1 << 28 });
    pcms.push(r.stdout);
  }
  const gap = (s) => Buffer.alloc(Math.round(rate * s) * 2);
  for (const sep of [1.0, 1.6]) {
    const joined = Buffer.concat(pcms.flatMap((p, i) => (i < pcms.length - 1 ? [p, gap(sep)] : [p])));
    const sp = splitBatch(joined, rate, ids.map((id) => m[id].text));
    log(`separator ${sep}s → ${sp.ok ? 'OK ' + sp.segs.map((x, i) => `${ids[i]} ${(x.length / 2 / rate).toFixed(2)}s (orig ${m[ids[i]].duration}s)`).join(' | ') : 'FAIL ' + sp.why}`);
  }
}
(args.selftest ? selftest() : main()).catch((e) => die(e.stack || e.message));
