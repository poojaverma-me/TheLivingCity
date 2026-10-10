# THE LIVING CITY — Game Design Document

*An isometric 3D exploration game inside an animal cell, built from the "Animal Cell – The Living City" illustration (`reference/living-city.png`).*

---

## 1. Vision

You step inside the reference illustration. The game opens on the **exact overview shot** of the poster: an elongated, oval cellular city in a thick translucent pale blue‑gray membrane, floating on a clean white studio background. Then the camera descends into the city and you're free to walk its streets.

You can explore freely. There are no levels, locks or quests. Curiosity is the reward loop: every district has something to look at closely, something to operate, and something hidden. A scientist guide, **Dr. Celia Mendel**, walks with you. She explains things when you ask and stays quiet when you don't.

**Audience:** university undergraduates (intro cell biology) and curious adults.
**Session:** about 30 minutes of meaningful exploration, then keep wandering as long as you like.
**Pillars**
1. **The poster, alive.** The overview must read as the reference image: same silhouettes, palette, placement, proportions.
2. **Miniature diorama craft.** It should feel like a physical, hand-built scale model: satin paint, glass, brushed metal, soft studio light, soft contact shadows, tilt-shift depth.
3. **Analogy + accuracy.** The city metaphor (roads, trucks, workers) stays a metaphor. The science overlays (cards, deeper notes, activity labels) are accurate and visually distinct.
4. **Touchable world.** Almost everything reacts: workers wave, machines respond, valves turn, parcels bounce, water ripples.

---

## 2. Player experience (first 5 minutes)

1. **Title / Overview.** The poster view, with the poster's header typography ("ANIMAL CELL — THE LIVING CITY" in navy, tagline in rust orange). Ambient city hum. Numbered infographic pins fade in around the organelles, like the poster labels. Button: **Enter the City**.
2. **Descent.** A 4‑second camera flight from overview down to the front gate (the membrane port at the bottom-front). Dr. Celia greets you: *"Welcome to the Living City. Everything here is slowed down and simplified so we can see it. Real cells are about a hundred times faster, and far more crowded."*
3. **Tutorial (about 60 s, skippable, contextual).** Each hint appears only until you've done the thing once:
   move (WASD / click ground) → camera rotate (Q/E or right‑drag) → zoom (wheel; scroll out to the city overview at any time) → interact (E / click glowing objects) → guide (G) → notebook (N) → help (H).
4. **Free exploration.** Dr. Celia suggests nearby sights but never insists. Press **G** at any time for "What's this place?" or "Where should I go next?". **Guided Tour** mode (toggle T) makes her lead the way along the roads to the nearest unvisited district, with a soft animated path line.

---

## 3. World design

### 3.1 Layout (world units: 1 u ≈ one "visitor" height ≈ 1.1 u)

The cell is a superellipse (stadium/oval) whose long axis points toward the overview camera.

* Interior: **62 u wide (X) × 88 u deep (Z)**.
* Membrane wall: about 3.2 u thick, rising about 3.8 u, with a rounded glassy lip.
* Origin at the cell centre, **+Z toward the camera (front)** and **+X to the right**.

All positions live in **one file**, `src/world/layout.js`, the single source of truth.

| # | District | Centre (x, z) | Footprint / orientation | Reference cue |
|---|---|---|---|---|
| 1 | **Nucleus** (Control Center) | (+3, −23) | Hemispherical violet dome r≈10.5 with the front ~100° cut away; layered perimeter plinth | dominates rear centre |
| 2 | **Nucleolus** | inside nucleus (+3, −27) | Luminous blue sphere r≈1.6 above the ops floor | blue glowing orb inside dome |
| 3 | **Ribosomes** | studs on RER plus free "food-truck" ribosomes | red‑orange studs r≈0.16, thousands instanced | red dots on blue walls |
| 4 | **Rough ER** | rings r = 12…21 around the nucleus, front arc + sides | 7 concentric curved blue corridor walls, terraced, with gaps and a central ramp | blue maze rings |
| 5 | **Smooth ER** | (+20, −3) | Olive/moss ribbon folds about 16 × 12 u, vertical wavy lamellae, tubular branches | green ribbons right middle |
| 6 | **Transport vesicles** | scattered; ports at membrane | Glossy purple spheres r 0.6–1.2; glowing purple membrane ports | purple orbs and port |
| 7 | **Golgi apparatus** | (+8, +17) | 6 stacked rose‑pink undulating cisternae (crescent, about 16 × 7 u) atop a curved shipping hall with cream windows | pink stack front‑right |
| 8 | **Mitochondria** ×2 | A (−8, +1) rot −28°; B (−15, +23) rot −28° | Capsules ≈ 19 × 9 u, thick orange walls, pale cristae, gold machinery | orange pods |
| 9 | **Lysosomes** ×3 | (−23, +9), (−6, +13), (−1, +5) | Green cylinders r≈1.9 with recycling symbol | green tanks with ♻ |
| 10 | **Vacuoles** ×3 | (−22, −8), (−25, +1), (−16, −4) | Open cylindrical tanks r≈2.6, turquoise liquid | cyan tanks left |
| 11 | **Cell membrane** | perimeter | Gates at front (0, +44), right (+31, +28), left (−31, −10) | translucent rim, ports |

**Roads.** One spine road runs from the front gate north to the nucleus ramp. A ring road follows the inside of the membrane, and branches lead to each district. Roads are grey asphalt with pale dashed markings, curbs, sidewalks and loading bays. Some roads double as **microtubule rails** (shown with a subtle pale-green rail inlay), which are the real tracks vesicles ride on.

**Fill.** Small industrial buildings (labs, depots, pump houses) cluster in the back‑left near the rim and between districts. Trees and planters, railings, pipes, crates, light posts and benches fill the rest. The poster's balance is roughly 65% occupied and 35% open pavement.

### 3.2 District content (each = observe + examine close-up + try it + secrets)

| District | Close‑up (Examine) reveals | "Would you like to try?" | Curiosities |
|---|---|---|---|
| Nucleus | Double nuclear envelope cross‑section, nuclear pore complexes, chromatin "archive shelves" (histone spools), control screens | **Transcribe a gene**: pick a gene at the console, watch RNA polymerase run along DNA, then guide the mRNA out through a pore | Nuclear pore checkpoint; Chromatin archive; Centrosome depot (hidden behind dome) |
| Nucleolus | Glowing assembly orb; small/large ribosomal subunits | **Assemble a ribosome**: snap 40S + 60S subunits for export | rRNA genes note |
| Ribosomes | Individual ribosome on the ER surface, nascent chain threading through | **Translate mRNA**: match codons to amino acids; the chain grows | Free ribosome "food truck" (cytosolic proteins) |
| Rough ER | Ribosome studs, Sec61 translocon, lumen with chaperone workers folding | **Watch protein production**: start translation, signal peptide docks, protein folds in lumen | Signal peptide "ticket"; BiP chaperone crew |
| Smooth ER | Ribbon tubules, enzyme stations, no studs | **Detox shift**: click drifting toxin molecules to have P450 enzymes process them; produce lipid droplets | Ca²⁺ reservoir valve |
| Vesicles | Lipid bilayer shell, coat proteins, motor protein on microtubule | **Launch a vesicle**: bud one from the Golgi and follow it to the membrane (exocytosis) | Kinesin walker cameo; Endocytosis at side gate |
| Golgi | Cisternae stack cis→trans, budding sites, cargo handlers | **Sort the cargo**: tag parcels (lysosome / membrane / secretion), conveyor routes them | M6P tag; cis/trans signage |
| Mitochondria | Outer + inner membrane, cristae, matrix, ATP synthase turbines | **Proton power**: pump H⁺ across the inner membrane, then let them flow through ATP synthase; the rotor spins and ATP pops out | mtDNA ring; Krebs roundabout |
| Lysosomes | Acid pH gauge, hydrolase enzymes, intake hatch | **Recycle**: feed worn parts (old mitochondrion piece, damaged protein) and watch them digested | Autophagy; pH 4.5 gauge |
| Vacuoles | Clear liquid tanks, water/nutrient storage | **Fill/drain**: balance storage; note on plant vs animal vacuoles | Rubber duck (easter egg) |
| Membrane | Phospholipid bilayer slice, channels, pumps, receptors | **Gatekeeper**: choose which molecules pass (O₂ diffuses; glucose via transporter; Na⁺/K⁺ via ATP pump) | Aquaporin; Receptor antenna; Peroxisome cameo; "Do Not Press" apoptosis switch |

**Field Notebook (N).** It records districts visited (11), activities tried (11) and curiosities found (24) as an illustrated checklist with the organelle colours. Nothing is required. A small, satisfying chime plays on each discovery.

---

## 4. Mechanics & controls

| Action | Keyboard / mouse | Notes |
|---|---|---|
| Move | WASD / arrows, or left‑click on the ground (click‑to‑walk along the road graph) | Camera‑relative; smooth acceleration; footsteps |
| Run | Shift | |
| Rotate camera | Q / E (45° eased steps) or right‑drag | |
| Zoom | Mouse wheel | Visitor (≈14 u) ↔ district (≈35 u) ↔ city overview (poster view) |
| Interact / Examine | E or click a glowing interactable | Context prompt appears in world |
| Guide | G | Ask Dr. Celia about the nearest place or for a suggestion |
| Tour mode | T | She leads to the next unvisited district |
| Labels | L | Toggle the numbered poster hotspots |
| Notebook | N | |
| Help | H / ? | Controls and settings (volume, voice, subtitles, quality) |
| Back / Exit | Esc | Leaves the close‑up or activity |

**Collision.** 2D shapes (cell superellipse + organelle footprints) with height ramps (nucleus terrace, Golgi loading dock). Smooth push‑out, so you never snag.

**Examine mode.** A GSAP camera glide to a hand‑authored close‑up. Detail LOD is revealed (cristae, pores, studs), scientific overlay labels appear (thin leader lines, clean sans, distinct from the in‑world signage), the city dims slightly, and DOF focuses on the subject.

**Activities** run inside the 3D scene with the world still visible. Each is a small hand‑crafted interaction (30–90 s) with clear feedback, success flourish and a one‑line takeaway. They can be retried and are never failed.

---

## 5. Living world (ambient simulation)

* **Workers** (about 140, instanced): miniature people in white lab coats, some with hard hats or clipboards. They patrol their district, operate consoles and push carts. They turn and wave when you pass, and say a short line when clicked.
* **Trucks** (about 14): yellow box trucks and flatbeds follow road splines, carrying parcels from Golgi to the gates and lysosomes. They stop for the player.
* **Vesicles**: purple spheres bud from the Golgi trans face, ride microtubule rails to the membrane and fuse (exocytosis flash). Others pinch in at the side gate (endocytosis).
* **Mitochondria**: rotating ATP synthase turbines, pulsing amber light, small golden ATP tokens float to the nearby roads.
* **Lysosomes**: churning green liquid, recycling symbol rotation, steam puffs.
* **Vacuoles**: gentle water caustics and ripples.
* **Nucleus**: flickering screens with readable mini‑UIs (DNA, gene list), mRNA strands emerging from pores, glowing nucleolus pulse.
* **ER**: ribosome studs twinkle as they translate; tiny protein chains trickle into the lumen.

Processes are slowed and selectively shown. Dr. Celia says so in the intro, and the Help screen repeats it.

---

## 6. Art bible (visual fidelity rules)

**Camera.** Overview: 32° vertical FOV perspective, elevated about 52°, yaw about 4° (seen from the front, slightly right), matching the poster framing. Gameplay: same pitch family (42–55°), and Q/E rotate yaw.

**Palette** (sampled from the reference)

| Element | Base | Accent |
|---|---|---|
| Membrane | #B9C7D3 translucent, pale blue‑gray | rim highlights #EEF4F8 |
| Floor (cytosol pavement) | #8E9AA6 / asphalt #5E6670 | markings #E8E3D6 |
| Nucleus | violet #7B4FB8 → #A07BD8 glass | screens #6FD3FF, nucleolus #5BB6FF glow |
| Rough ER | blue #5873A8 / #6C8CC4 | ribosomes #D2452F, trim #DCE4EE |
| Smooth ER | olive #8E9A4A / moss #6F7F3A | highlights #B9C27A |
| Golgi | rose #D77FA6 / #C25E8C | windows cream #FFE6B0 (emissive) |
| Mitochondria | orange #E07A2E, wall #C85A1E | cristae #F3D9B8, glow amber #FFB54A |
| Lysosomes | green #6FAE3E / #4E8A2E | symbol #F5F7F0 |
| Vacuoles | steel #9AA3AC tanks | water #49C6D6 → #2A8FB0 |
| Vesicles | purple #8E4FD0 glossy | glow #C08BFF |
| Trucks | yellow #E8B62A | |
| Workers | white coats #F2F2EE | skin varied, hair varied |

**Materials.** The scale-model look comes from these properties:

* Satin paint: roughness 0.45–0.6, with clearcoat on organelle shells.
* Biological membranes: transmission/translucency plus subsurface-like sheen.
* Brushed metal on rails and machinery.
* Clear water with refraction‑like tint.
* Glass windows with emissive interiors.
* Subtle wear and grime in crevices, from procedural AO and noise maps.

**Lighting.** Soft studio key from the upper‑left front (a large soft shadow), cool sky fill and a warm bounce. An environment map (studio room) provides reflections. Local warm point lights come from windows, mitochondria and screens. ACES/AgX filmic tone mapping keeps the image bright and readable. The white background is shared with a ground‑plane shadow catcher, so the cell sits on the "table".

**Post.** GTAO/N8AO contact AO, soft bloom (threshold high, only emissives), SMAA, a subtle tilt‑shift (stronger in overview, weaker at visitor level) and a very light vignette.

**Detail LOD.** Overview shows silhouettes plus mid detail. District distance adds railings, windows and markings. Visitor and examine distance adds instanced bolts, panels, ribosome studs and cristae folds.

**UI.** Matches the poster's infographic cards: white rounded cards, a colour‑coded number badge, a colour title in caps and a bold subtitle. Title font is Montserrat ExtraBold; UI font is Inter. Scientific overlays use thin white leader lines with a monospace tag, kept clearly separate from the in‑world signage.

---

## 7. Audio

* **Ambience bed:** a soft cellular "city hum" (filtered pink noise + low drones), with distant traffic, machinery and murmured activity.
* **Positional emitters** (WebAudio panners):
  * mitochondria turbines and electrical hum
  * Golgi conveyors and parcel thunks
  * lysosome bubbling
  * vacuole water lapping
  * nucleus computer bleeps
  * truck engines and back‑up beepers
  * worker footsteps and chatter
* **Interaction SFX:** synthesised, warm and tactile (UI plinks, discovery chime, success flourish, valve clicks, vesicle "bloop" fusion).
* **Music:** a gentle generative ambient score (soft pads, mallets, slow chord changes). It ducks under dialogue and changes mood subtly by district.
* **Voice:** Dr. Celia uses Google Gemini TTS (warm, articulate, lightly enthusiastic), and a few worker barks use other voices. Lines are **pre‑generated offline** by `scripts/gen-voice.mjs` into `public/audio/voice/` with a manifest and content‑hash caching. API keys live only in `.env`, never in the browser bundle. The script supports multiple keys with rotation on 429/quota errors, exponential backoff and a per‑key rate limit. When a line has no audio file, subtitles still show with a soft "talk blip".

---

## 8. Technical architecture

**Stack.**

* Build: Vite and vanilla **Three.js** (r17x, WebGL2), ES modules.
* Post: `postprocessing` with `n8ao`.
* Camera and UI tweens: GSAP.
* Audio: WebAudio.
* Fonts: `@fontsource`.
* No physics engine is needed. Collision is custom 2D shapes plus ramps (cheap and robust), and small physics flourishes (bouncing parcels, toxins) are hand‑simulated.
* Blender (headless Python scripts in `scripts/blender/`) is used for hero meshes where procedural Three.js geometry falls short, exported as GLB.

```
src/
  main.js                 boot, loop
  core/  renderer.js      renderer + post pipeline + quality tiers
         cameraRig.js     overview / follow / examine, Q/E yaw, zoom
         input.js         keyboard / mouse / pointer picking
         textures.js      procedural canvas textures (noise, normal, pavement, windows, screens)
         materials.js     shared material library (palette above)
  world/ layout.js        ALL positions (single source of truth)
         ground.js membrane.js roads.js props/*.js
         organelles/ nucleus.js rer.js ser.js golgi.js mitochondria.js lysosomes.js vacuoles.js vesicles.js
  life/  workers.js traffic.js vesicleTraffic.js ambient.js
  player/ player.js guide.js collision.js
  interact/ interactables.js examine.js activities/*.js discoveries.js
  ui/    hud.js cards.js notebook.js tutorial.js dialogue.js title.js styles.css
  audio/ engine.js ambience.js sfx.js music.js voice.js
  data/  content.js (cards, deep science, discoveries), dialogue.js (lines + ids)
scripts/ gen-voice.mjs  shoot.mjs (headless screenshots for QA)
docs/    GDD.md  qa/ (critic reports, screenshots)
```

**Debug and QA hooks.** URL params `?shot=<preset>&hud=0&t=<sec>` and a `window.__city` API (`goto(preset)`, `teleport(x,z)`, `startActivity(id)`) let `scripts/shoot.mjs` capture deterministic screenshots of every preset for the critic loop.

**Performance budget.** 60 fps on an M‑series laptop at 1080p (High), with a Medium tier for weaker GPUs.

* Draw calls are kept below about 400 through merged static geometry per district and instancing for studs, trees, workers, railings and windows.
* One 4096 shadow map, whose frustum is fitted to the current view.
* Transmission only on the membrane.
* Adaptive DPR.

---

## 9. Development process (quality loop)

For every component (benchmark environment, each district, characters, interactions, UI, audio):

1. **Implement.**
2. **Capture.** `scripts/shoot.mjs` renders the game in real Chrome (GPU) and saves the overview plus district and visitor presets.
3. **Independent critique.** A separate critic sub‑agent compares the screenshots with `reference/living-city.png` and scores silhouette, composition, materials, lighting, detail, animation and UI. It lists concrete, prioritised defects. The critic never edits code and never reviews its own work.
4. **Refine.** Address every major defect, then go back to step 2.

Stop only when the critic signs off or the remaining issues are marginal. Reports are saved in `docs/qa/`.

**Order.**

1. Benchmark: the base city (ground, membrane, lighting, post) plus the **nucleus and RER**, polished first.
2. Expand to the other districts, at the same bar.
3. Life simulation.
4. Player, guide and interactions.
5. Activities.
6. UI.
7. Audio and voice.
8. Full playthrough QA (navigation, discoverability, performance, consistency).

---

## 10. Scope guardrails

* **In scope:** one cohesive city, 11 districts, 11 activities, 24 curiosities, a guide, a notebook, audio and voice.
* **Out of scope:** combat, inventory, save slots (progress persists via localStorage only), multiplayer, mobile touch controls (desktop first; touch is best‑effort).
