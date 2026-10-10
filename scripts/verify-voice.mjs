#!/usr/bin/env node
// Transcribes voice files with a Gemini text model and compares them to the dialogue text (word overlap).
// Usage: node scripts/verify-voice.mjs --only=id1,id2   (keys from .env; prints a match score per line)
import fs from 'node:fs';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
const KEY = (env.match(/^GEMINI_API_KEYS=(.*)$/m)?.[1] || '').split(',')[0].trim();
const only = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const model = (process.argv.find((a) => a.startsWith('--model=')) || '--model=gemini-3.5-flash').slice(8);
const man = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/audio/voice/manifest.json'), 'utf8'));
const norm = (t) => t.toLowerCase().replace(/<[^>]+>/g, ' ').replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).filter(Boolean);
for (const id of only) {
  const e = man[id]; if (!e) { console.log(id, 'NOT IN MANIFEST'); continue; }
  const b64 = fs.readFileSync(path.join(ROOT, 'public/audio/voice', e.file)).toString('base64');
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST', headers: { 'x-goog-api-key': KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ inlineData: { mimeType: 'audio/mp3', data: b64 } }, { text: 'Transcribe this audio verbatim. Output only the words spoken.' }] }] }),
  });
  const j = await res.json();
  const said = j.candidates?.[0]?.content?.parts?.map((p) => p.text).join(' ') || `ERROR ${res.status} ${JSON.stringify(j.error?.message || '').slice(0, 120)}`;
  const want = norm(e.text), got = norm(said);
  const hit = want.filter((w) => got.includes(w)).length / Math.max(1, want.length);
  const extra = got.filter((w) => !want.includes(w)).length;
  console.log(`${hit >= 0.85 && extra <= 3 ? 'OK  ' : 'BAD '} ${id}  match ${(hit * 100).toFixed(0)}%  extra words ${extra}\n      heard: ${said.trim().slice(0, 160)}`);
}
