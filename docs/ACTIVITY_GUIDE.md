# Activity Guide — "Would you like to try?" interactions

Read `docs/BUILD_GUIDE.md` (rules, look, QA loop), `docs/GDD.md` §3.2/§4, and `src/data/content.js` (each organelle's `tryIt` {title, prompt, takeaway} and `deep` science — your activity must teach exactly that takeaway, accurately).

## Where activities live
`src/interact/activities/<organelleId>.js` — one file per organelle id:
nucleus, nucleolus, ribosomes, rer, ser, vesicles, golgi, mitochondria, lysosomes, vacuoles, membrane.

The game loads it lazily when the player presses the card's try-it button (`src/game/game.js → startActivity`). Read that function and `src/ui/ui.js → activityPanel()`.

## Contract
```js
export function start(ctx) {
  // build temporary objects, fly the camera, set up the panel …
  return {
    update(dt, t) {},  // called every frame while active (before input.endFrame())
    end() {},          // MUST remove every object/listener/label you created and restore anything you changed
  };
}
```
`ctx` provides:
- `ctx.scene`, `ctx.camera`, `ctx.world` (`world.root`, `world.parts` — the district groups by `.name`), `ctx.district` (entry from `src/game/districts.js`: center, pin, examine…)
- `ctx.rig` — CameraRig. `ctx.rig.flyTo({ target: Vector3, yaw, pitch, dist, fov }, seconds)` (radians); the game leaves the rig in 'locked' mode during activities, so set the camera you want and it stays.
- `ctx.panel` — the left-hand activity panel: `setGoal(html)`, `setProgress(0..1, label)`, `buttons([{label, solid, onClick}]) → HTMLButtonElement[]`.
- `ctx.ui.sciLabels([{ key, text, tag, pos: Vector3 }], ctx.camera)` — call every frame to show scientific overlay labels (leader-line chips, visually distinct from the city); call with `[]` in `end()`.
- `ctx.input` — `input.clicks` (array of NDC `Vector2` clicks this frame), `input.pointer` (NDC), `input.hit('key')`, `input.down('key')`. Use a `THREE.Raycaster` with `ctx.camera` for picking your own meshes.
- `ctx.sfx(name, {position, volume, pitch})` — names: ui_hover, ui_click, ui_open, ui_close, discovery_chime, success_flourish, notebook_page, footstep_pave, footstep_metal, interact_ping, valve_turn, button_press, parcel_thunk, vesicle_bloop, vesicle_bud, bubble, whoosh, zap, atp_pop, truck_honk, wave_hello, error_soft, typewriter_tick, guide_blip.
- `ctx.say(lineIdOrObject)` — Dr. Celia speaks (`{ speaker: 'celia', text }` for ad-hoc lines; keep them rare and short — the voiced lines `<id>_try` / `<id>_done` are already played for you).
- `ctx.complete()` — call ONCE when the player succeeds (plays flourish + `<id>_done` line + notebook tick). The activity may keep running for replay; Esc exits.
- `ctx.exit()` — leave the activity and examine mode.

## Design rules
- 30–90 seconds, never fail-able, clear goal text, a progress meter, satisfying feedback on every action (sound + motion + light), a visible success moment.
- **Integrated in the world**: animate things at the real district location (e.g. parcels on the Golgi conveyor, protons flowing in a mitochondrion's cristae, mRNA leaving a nuclear pore). Temporary hero props are fine (holographic cutaway, magnified inset, glowing molecules) but keep the city visible and consistent with the art bible (vibrant, glossy, emissive accents ≥3 intensity to bloom; no raw ShaderMaterial).
- Scientific overlays (sciLabels) name the real molecules/structures (e.g. "ATP synthase (F₀F₁)", "Sec61 translocon", "SRP", "M6P tag", "RNA polymerase II") — distinct from the city metaphor.
- Remind (once, via panel text) that the process is slowed and simplified.
- Clean up perfectly in `end()`; restore any material/visibility changes on district objects.

## Testing
Each activity can be started headlessly:
`node scripts/shoot.mjs --tag=act-<id> --params="shot=game" --shots="js:document.querySelector('[data-a=start]').click()|wait:6000|js:__city.game.examine('<id>')|wait:2500|js:__city.game.startActivity('<id>')|wait:2500|snap:start|js:<simulate inputs via __city.game.activity.inst or dispatch clicks>|wait:2000|snap:mid|..."`
Check console errors in the output. Iterate ≥3 times on visuals and feel.
