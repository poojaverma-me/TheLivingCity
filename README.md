# The Living City — Inside an Animal Cell

An isometric 3D exploration game (Three.js) that turns the "Animal Cell – The Living City" poster
(`reference/living-city.png`) into an explorable, animated miniature city. Free exploration, no levels:
walk the streets with Dr. Celia Mendel, examine the 11 organelle districts, try a hands-on activity in
each, and hunt for 24 hidden curiosities.

## Run

```bash
npm install
npm run dev        # http://127.0.0.1:5321
```

Production build: `npm run build` → `dist/` (static; serve with any web server, e.g. `npm run preview`).

## Controls

| Action | Input |
|---|---|
| Move | W A S D / arrows, or click the ground |
| Run | Shift |
| Rotate camera | Q / E, or right-drag |
| Zoom | Mouse wheel (all the way out = whole-city poster view) |
| First-person view | V to toggle; click to look around with the mouse (Esc frees the cursor); head bob, footsteps and mouse speed in Help |
| Interact / examine | E, or click |
| Ask Dr. Celia | G |
| Guided tour | T |
| Labels | L |
| Field notebook | N |
| Help & settings | H |
| Back | Esc |

Click a worker to hear what they do; click a truck to honk.

Graphics quality is picked automatically (Help → Graphics to override, or `?q=low|medium|high`).

## Voice (Gemini TTS)

Dialogue lives in `src/data/dialogue.js`; voice files are pre-generated into `public/audio/voice/`.
Put keys in `.env` (git-ignored) as `GEMINI_API_KEYS=key1,key2` and run:

```bash
npm run voice
```

It only generates missing/changed lines (content-hash cache), rotates keys and backs off on quota
errors. Lines without audio still show subtitles with a soft talk-blip.

## Project layout

- `src/main.js` — boot, frame loop, adaptive resolution, QA hooks (`window.__city`)
- `src/core/` — renderer + post (AO, bloom, grade, tilt-shift), studio lighting/env, camera rig, materials, procedural textures, geometry helpers
- `src/world/` — membrane, organelle districts (`organelles/`), city fabric (`city/`), curiosity exhibits; `layout.js` is the single source of truth for positions
- `src/life/` — characters, worker crowd (LOD), vehicles, stationed staff
- `src/game/` — game orchestrator, districts, dialogue director, progress, markers, science labels
- `src/interact/activities/` — the 11 "Would you like to try?" activities
- `src/audio/` — procedural audio engine, ambience, SFX, generative music, voice player
- `src/data/` — science content (cards, deeper science, curiosities) and dialogue
- `docs/` — Game Design Document, build/activity guides, QA critiques and screenshots

## QA tooling

- `node scripts/shoot.mjs --tag=x --shots="overview|cam:name:px,py,pz:tx,ty,tz:fov"` — headless GPU screenshots
- `node scripts/playtest.mjs` — functional playthrough (districts, curiosities, panels, console errors)
- `node scripts/perf.mjs` — frame cost breakdown (draw calls, triangles, per-district)
- `node scripts/audio-qa.mjs` — objective audio metrics
