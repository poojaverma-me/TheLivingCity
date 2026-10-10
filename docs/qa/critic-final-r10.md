# Critic: Final Review, Round 10 (r10 shots + act7 sheets vs reference)

**Verdict: 7.6/10 (r8: 7.3). NOT signed off.**

The interiors are now AAA-adjacent: the control room, the mito pods, the vacuole tanks, the Golgi plaza and most activities. The hero overview is still undercut by the two largest surfaces on screen, the inflatable membrane and the pool-noodle RER. Several r8 hygiene items are untouched.

## Fixed since r8
- **Golgi** sacs are now organic, wavy cisternae with a lighter top. It no longer reads as a tire stack.
- **SER** is bigger and translucent, with a visible lumen, P450 stations inside and droplets. It reads as tubes now.
- **Rooftop kit** (AC units, solar panels) has been added, and trouser colour varies a little.
- **Aquaporin hourglass** now has a plaque.
- **Title** callouts no longer truncate, and the south of the overview is legible (tilt-shift fixed).
- The **membrane's** front wall is now frosted and see-through at the south rim, and the orange spec smear is gone.

## Still broken from r8
- Orange star flare on the dome (nucleus, upper-left).
- Pink mRNA strands in empty white sky (title, overview, nucleus, nearly every activity).
- Ribosomes float mid-channel at mixed sizes and two hues (rerClose).
- RER horizontal corrugation and fat lips.
- The "WATEF" label is hidden behind a pipe.
- A pole runs through "NEWS", and "OTEIN QC" is clipped.
- The kinesin is still a purple ball on a twisted stalk (a lollipop).
- The yellow ringed orb by mito pod 1 has no label.
- The pink pylons and dowels still pierce the Golgi.
- The trucks are flat yellow.

## Scores
| Area | r8 | r10 |
|---|---|---|
| Nucleus + RER | 7 | 7 |
| Membrane | 5 | 5.5 |
| Golgi + vesicles | 7.5 | 8 |
| Mitochondria | 8 | 8.5 |
| SER | 7 | 7.5 |
| Lysosomes | 7.5 | 7.5 |
| Vacuoles | 8.5 | 8.5 |
| City | 7 | 7.5 |
| Characters / vehicles | 7 | 7 |
| Curiosity exhibits | 6.5 | 7 |
| Activities (visual / clarity) | – | 7.5 / 8.5 |
| UI | – | 8 |
| Title screen | 8 | 8 |
| **Overall** | 7.3 | **7.6** |

## Defects below 8

**Nucleus + RER (7)**
- **RER walls:** soft rounded lips with horizontal ribbing, like a bouncy castle. Fix:
  - Square bevel of about 0.03.
  - Vertical slat normal map.
  - Desaturate to about #4a6fb5.
  - Two or three offset ring breaks.
- **Ribosomes:** reseat them with MeshSurfaceSampler on the outer wall faces, offset by radius. Use one colour (#9e2236), scale 0.9–1.1, and half the count.
- **Dome:** delete the flare sprite and cut the "cheerio" decals by 70%.

**Membrane (5.5)**
- **Still a thick baby-blue pool float.** It takes about 15% of the frame width per side, where the reference wall is thin. Fix:
  - Cut the cross-section by 40%.
  - Opacity mix(0.25, 0.85, fresnel²), with a #9fc6e0 backface pass.
- **Crumpled-foil normal (membrane close).** Lower the frequency and use a strength of about 0.2.
- **Jelly-bean proteins sit on a ledge.** Sink them half-depth through the wall.
- **Ghost artefacts in the south wall (overview):** a rectangular hatch and a porthole double-image. Clip or remove them.

**SER (7.5)**
- The "CAUTION: GRAPEFRUIT vs P450" board is still unreadable micro-text. Scale it ×1.6.
- There is no pipe or road link to the RER, so it is still an island.

**Lysosomes (7.5)**
- The emblem is still pale arrows over green swirl. Add an opaque #163d22 disc behind it.
- The hull is uniform plastic. Add edge wear and AO at the rivet rings.

**City (7.5)**
- **Signs:** raycast-check every sign. "NEWS", "OTEIN QC", "WATEF" and the "POR…" sign are all occluded or clipped.
- **Foreground orange slab (street):** a featureless roof. Add parapet, vents and a trim atlas.

**Characters / vehicles (7)**
- Coats are still 100% white, and trousers are still mostly navy. Add district vests.
- Trucks need panel lines, clearcoat 0.6 and tyre tread.

**Curiosity exhibits (7)**
- **Kinesin:** still unreadable (the kin shot is also occluded by a white truck). Rebuild it with two globular heads, a coiled stalk and a hand-over-hand walk.
- **Yellow orb:** add a plinth and plaque, or delete it.

**Activities (7.5 visual)**
- **The hard parts work.** The framework (step panel, Dr. Mendel line, magnified holo panel, completion toast) is consistent. Replay resets cleanly in all 11, and the science copy is excellent.
- **Defects:**
  1. **In-panel chip labels are about 10px at 1600 wide.** Raise them to 13px or more and cap them at 3 visible.
  2. **Content breaks the holo frame:**
     - ribosomes-end: the protein chain exits the top.
     - rer-start: the mRNA spears through the bezel.
     - vacuoles-end: the panel collides with the tanks.

     Clip to the panel, or keep the content inside a 90% safe-area.
  3. **End cameras are inconsistent.**
     - nucleus-end pulls out to a white void.
     - vesicles-end is a blurry macro on the membrane.

     Author one "reveal" shot per activity, with the result centred.
  4. **Panels are half-empty dark glass.** Scale the subject to fill about 70% of the panel.
  5. **Sky strands photobomb every panel.**

## Title screen (8)
- Copy and callouts match the reference; the cell occupies about 40% of the width against the reference's about 65%.
  - Pull the camera in about 15%.
  - Narrow the callout columns to 240px.

## Top 5 highest-impact improvements
1. **Membrane rebuild:** a thin fresnel double wall, embedded proteins and no ghost artefacts. Worth about +0.5 overall.
2. **RER resurface and ribosome reseat.** The RER is the largest structure after the membrane, and it is still the cheapest-looking.
3. **Hygiene sweep (a one-day job that buys about +0.3):**
   - Remove the dome flare, the sky mRNA strands, the Golgi pylons and dowels, and the unlabeled orb.
   - Fix the occluded and clipped signs.
4. **Kinesin hero rebuild,** plus a walk cycle on the microtubule. It also upgrades the vesicles activity mid-shot.
5. **Activity polish pass:**
   - 13px chip minimum.
   - Holo-frame clipping and a safe-area.
   - Authored end-reveal cameras.
   - Subjects scaled to fill the panels.

**No sign-off. Overall is 7.6.**
