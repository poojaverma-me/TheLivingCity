# Build Guide for Specialist Agents — The Living City

Read this, then `docs/GDD.md` (§3 world, §6 art bible), then study the reference image `reference/living-city.png` closely (Read it — it is the visual blueprint). Study `src/world/organelles/nucleus.js` and `rer.js` for code conventions and the current quality bar.

## The bar
The director's verdict on early renders: *"looks like a simulation, no WOW factor — shaders, light effects and textures must improve a lot; make it more vibrant."* Your work is judged by a harsh, independent AAA art critic against the reference. Aim for a **premium miniature diorama**: saturated, glossy, richly detailed, with warm local light, crisp contact shadows and lots of small believable detail. Plain primitives with flat colours are a failure.

## Project facts
- Vite + vanilla Three.js r180, ES modules. Dev server is ALREADY running at http://127.0.0.1:5321 (HMR). **Never start another server.**
- World units: 1u ≈ one visitor/worker height (workers are ~1.05u tall). +X right, +Z toward the overview camera (front), Y up, floor top at y=0.
- `src/world/layout.js` is the single source of truth for positions (CELL, NUCLEUS, RER, SER, GOLGI, MITO[], LYSO[], VACUOLES[], VESICLES[], GATES, SHOTS, `insideCell(x,z,inset)`). Read your entries from there. If a position genuinely needs to change, edit ONLY your own entry with a precise Edit and mention it in your report.
- The overview camera pitch is ~34–38° (like the reference): silhouettes must read from there AND hold up in close-ups.

## Your contract
- Only edit the files you are assigned (plus your layout entry). Other agents are editing other files concurrently.
- Export a builder returning a `THREE.Group` (name given in the stub). Optional `group.userData.update = (t, dt) => {}` for animation (t = seconds).
- Also set `group.userData.footprints = [...]` — collision shapes in WORLD coords for the player: `{ type: 'circle', x, z, r }` or `{ type: 'box', x, z, w, d, rot }` (rot = Y rotation radians). Keep them tight to the visible base.
- Set `group.userData.anchors = { <name>: [x, y, z] }` — useful world points (entrance, examine camera target, interaction spots) for the gameplay systems.

## Materials & look (src/core/materials.js, src/core/lookdev.js, src/core/textures.js)
- `M.satin(color, {rough, clearcoat, metal, normalScale, repeat, key})` – painted miniature surfaces (clearcoat gives the glossy model look).
- `organic(material, {rim, rimPower, rimStrength, sss, sssStrength})` – patch ANY biological surface (membranes, sacs, cristae) for fresnel rim glow + subsurface lift. Use it on every organelle membrane surface.
- `M.metal`, `M.emissive(color, intensity, base)`, `M.glass`, `M.water`, `M.asphalt`, `M.matte`.
- Textures: `T.windowsTexture(cols, rows, seed)`, `T.screenTexture(k)`, `T.signTexture(text, opts)`, `T.radialTexture()` (glow sprites), `T.paintNormal()`, `T.membraneNormal()`. Add your own canvas textures locally in your file when needed (procedural, no image files).
- **Bloom threshold is luminance 1.5**: anything meant to glow needs `emissiveIntensity` ≈ 3–6 with a bright emissive colour. Use glow deliberately: windows, machinery cores, indicator lights, energy.
- Add local `THREE.PointLight`s sparingly (≤ 3 per district, no shadows) for warm pools of light.
- **Do NOT use raw `THREE.ShaderMaterial` in the main scene** — it breaks the AO pass (NaN → black screen). Patch standard materials with `onBeforeCompile` instead (see `organic()`).
- No `transmission` (only the membrane uses it; it is expensive). Fake glass with `M.glass` / clearcoat / opacity.
- Palette (from the reference): mitochondria orange `#E07A2E`, walls `#C75A1D`, cristae cream `#F3D9B8`, amber glow `#FFB54A`; Golgi rose `#D77FA6`/`#C25E8C`, cream windows `#FFE6B0`; SER olive `#8E9A4A`/moss `#6C7B38`, highlights `#B9C27A`; lysosome green `#6FAE3E`/`#4E8A2E`; water `#3FC0D4`; vesicle purple `#8E4FD0` glow `#C08BFF`; trucks yellow `#E8B62A`; worker coats `#F2F2EE`. Push saturation a little beyond these — vibrant is the brief.

## Geometry & performance
- Helpers in `src/core/geom.js`: `sweepXZ(path, profile, opts)` (swept walls/ribbons with tapers + displacement), `roundedWallProfile`, `arcPath`, `superellipse`, `mergeGeometries`, `instanced(geo, mat, matrices)`, `trs()`, `place()`. `RoundedBoxGeometry` from `three/examples/jsm/geometries/RoundedBoxGeometry.js` gives the miniature-model softness — prefer it over sharp boxes.
- Merge static meshes per material (`mergeGeometries` — convert all to non-indexed or all indexed first). Use `InstancedMesh` for repeats. Budget: **≤ 35 draw calls per district**, keep triangles sensible (< 400k per district).
- `castShadow`/`receiveShadow` on solid geometry; not on tiny instanced bits.

## QA loop (mandatory, at least 3 iterations before you report)
1. `node scripts/shoot.mjs --tag=<you>-v<N> --params="only=<yourGroupName>" --shots="overview|cam:<name>:px,py,pz:tx,ty,tz:fov|..."`
   - `--params="only=a,b"` hides other districts (membrane always shown); omit it to see everything together.
   - `cam:` shots let you frame any close-up without editing layout.js. Make at least: one district view (~25u away), one street-level view (camera y≈2.5–4, close), one examine close-up.
   - Output prints saved paths, draw calls, fps and console errors. **Any console error must be fixed.**
2. Read the PNGs, compare with `reference/living-city.png`. Be your own harsh critic: silhouette, proportions, colour, materials, lighting, detail density, believable miniature craft.
3. Fix, reshoot. Screenshots go to `docs/qa/shots/`.

## Report (keep concise)
Files changed, final screenshot paths, draw calls / fps observed, footprints/anchors provided, any layout changes, known weaknesses.
