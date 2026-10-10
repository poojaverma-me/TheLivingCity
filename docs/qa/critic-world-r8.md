# Critic: Whole World, Round 8 (r8 shots vs reference)

**Verdict: 7.3/10 (up from 6.6). Not signed off.**

The nucleus finally looks like a hero piece. Its glass dome now has a fresnel rim and a staffed control room, and it reads at every distance. Mito, vacuoles and the Golgi plaza are near shippable. The frame is still held back by three things:
- The inflatable-tube membrane, which is still the biggest object on screen.
- Pool-noodle RER rings covered in floating ribosome "measles".
- A tilt-shift that turns the south third of the hero overview into mush.

## Fixed since r6
- Dome is now fake glass with fresnel, and you can read the interior from overview.
- Control room is staffed by seated and standing scientists, with hair variety.
- Mito bloom is tamed, and the matrix floor now has dark, cracked lava detail.
- SER is translucent lime with lipid droplets, rounded end caps and a soft apron.
- Vesicles are glass bubbles carrying cargo crates (ringroad), which works well.
- Membrane portholes are recessed glass rings with a core.
- Lysosomes have steam puffs and a pH gauge.
- Most sign text now fits.
- The cell has a contact shadow.
- Workers have hard-hat and hair variety.

## Scores
| District | r6 | r8 |
|---|---|---|
| Nucleus + RER | 6 | 7 |
| Membrane | 4 | 5 |
| Golgi + vesicles | 7 | 7.5 |
| Mitochondria | 7.5 | 8 |
| SER | 6 | 7 |
| Lysosomes | 7.5 | 7.5 |
| Vacuoles | 8 | 8.5 |
| City fabric | 6.5 | 7 |
| Characters / vehicles | 6 | 7 |
| Curiosity exhibits | – | 6.5 |
| **Overall world** | 6.6 | **7.3** |
| **Title screen** | – | **8** |
| **Overview vs reference** | 6.5 | **7** |

## District defects (below 8)

**Nucleus + RER (7)**
1. **RER walls are still pool noodles (rerClose).** The lips are fat and round, and the horizontal corrugation reads as a cheap inflatable.
   - Square the tops to a 0.03 bevel.
   - Switch to vertical slat grooves.
   - Break 2–3 rings with offset gaps.
   - Desaturate to about #4a6fb5.
2. **Ribosomes float mid-channel at mixed sizes (rerClose, nucleus).**
   - Sample only the outer wall faces with MeshSurfaceSampler.
   - Offset each ribosome by radius along the normal so it sits on the wall.
   - Use scale 0.9–1.1 and a single #9e2236. Half the current count is enough.
3. **Hygiene.**
   - The orange star flare sprite is still on the dome, upper-left (nucleus). Delete it.
   - The pink beaded mRNA strands drift in empty white sky outside the cell. Clip particles to the cell bounds or route them pore to ribosome.
   - The "cheerio" ring decals on the dome make it read as a bubble-wrap ball. Cut 70% of them.

**Membrane (5)**
1. **It is still a thick, soft baby-blue inflatable tube** (overview, title). The reference is a thin, frosted double wall you can see through.
   - Cut the cross-section 40%.
   - Use opacity mix(0.25, 0.85, fresnel^2), an inner backface pass in #9fc6e0, and depthWrite off.
2. **Surface (membrane close).** It reads as crumpled foil with a warm orange specular smear along the crest.
   - Drop the normal strength to about 0.2 and use a lower frequency.
   - Clamp the spec, or tint the key light's spec contribution to neutral.
   - Fix the black ground seam at the foot.
3. **Membrane proteins and portholes.**
   - The proteins are jelly beans hovering in front of the wall. Embed them half-depth through the bilayer.
   - The porthole cores still bleed violet glow sprites outside the silhouette (overview, left, right and bottom). Clip the glow, or replace it with an emissive mesh.

**Golgi + vesicles (7.5)**
1. **Still an identical tire stack from the back (golgiBack).** Taper the top sacs to 0.85 and 0.72, and grade the colour from #B2416F at the base to #F7B8CF at the top.
2. **Stray parts.**
   - The lime blob is still on the top sac. Remove it.
   - The visible dowels and two fat pink pylons pierce through the sacs. Hide them inside, or make them one sculpted stem.
3. **Lollipop vesicles remain.** A purple ball sits on a spring stand (golgiBack) and on top of the kinesin tank (kin). Make them float with a bob and a shadow blob.

**SER (7)**
1. **Still undersized and isolated.**
   - Scale it ×1.3.
   - Add two road tendrils and a pipe rack connecting it to the RER.
2. **It is a hedge maze with no top read.** Add a fresnel lip highlight and lumen glow so it reads as tubes, not hedges.
3. **The truncated "CAUTION: GRAPEFRUIT vs P450" board is micro-text.** Enlarge it ×1.6.

**Lysosomes (7.5)**
1. **The emblem is still pale arrows over swirling green acid.** Put an opaque #163d22 disc behind it.
2. **The hull is uniform plastic.** Add edge wear, roughness variation and AO bands at the rivet rings.
3. **There is a stray yellow ringed orb beside mito pod 1 (mito)**, still there. Seat it on a plinth with a label, or delete it.

**City fabric (7)**
1. **Signs are occluded or clipped:** "CEIVING", "OTEIN QC", the "WATEF" tank label hidden behind a pipe, and a pole through "NEWS".
   - Raycast-test each sign's placement.
   - Offset the board from blockers.
2. **Large blank surfaces**, such as the foreground orange slab and grey flat roofs (street).
   - Add rooftop kit: AC units, parapets and solar panels.
   - Add a facade trim atlas.
3. **The south half is undifferentiated clutter at overview.** Add a tree-lined ring boulevard and lighter radial avenues to create hierarchy.

**Characters / vehicles (7)**
1. **Every trouser is navy and every coat is white.** Add 4 trouser colours, coloured vests per district, and ±8% height.
2. **Clipping:** a worker stands inside the kinesin tank base (kin). Fix the spawn exclusion volumes.
3. **The trucks are flat yellow.** Add panel lines, clearcoat 0.6 and tyre tread.

**Curiosity exhibits (6.5)**
1. **The kinesin exhibit reads as two propane tanks.** It needs two globular heads, a coiled stalk and a stepping "walk" animation along the green microtubule, carrying the vesicle.
2. **The cyan hourglass (aquaporin?) has no label at a readable size.** Add a plinth plaque with a lit icon.
3. **Wins worth keeping:** the APOPTOSIS button, the ATP billboard, the rubber duck and the grapefruit gag. Give each one a consistent plinth and plaque language.

## Title screen (8)
It is close to the reference: same title and subtitle, numbered callouts and dotted leaders. Defects:
- **The model is undersized.** The cell fills about 40% of the width against the reference's 70%. Pull the camera in about 15% and narrow the callout columns.
- **Callout text truncates with ellipses** ("made, folded and…"). Rewrite the copy to fit; don't truncate.
- **Tilt-shift blurs the whole lower third,** so mito 2 and the south city look low-res. Narrow the blur band and cap the CoC at about 3px on the title camera.

## Overview vs reference (7)
- Layout and colour coding match.
- The dome scale is now right.
- The camera is still about 50° (reference about 38°), which flattens the RER tiers and makes the membrane a ring donut.
- There is no warm core / cool rim grade.

## Top 5 remaining improvements
1. **Membrane rebuild:** thin double wall, fresnel glass, embedded proteins, clipped porthole glow. This is the single biggest score lever, worth about +0.8 overall.
2. **RER resurface and ribosome reseat:** square bevel, vertical slats, wall-sampled ribosomes, ring breaks.
3. **Camera and post on the hero shots:**
   - Use a 38–40° pitch at FOV about 28.
   - Use a gentler, wider-focus tilt-shift that keeps the southern third legible.
   - Add a warm-core / cool-rim LUT.
4. **Hygiene sweep:**
   - Remove the dome flare, sky mRNA strands, lime Golgi blob, yellow orb and lollipop vesicles.
   - Fix sign occlusion and worker clipping.
5. **Break the plastic monoculture:**
   - Per-material roughness noise, edge-wear masks and stronger AO (N8AO).
   - Distinct surface languages per organelle: grooved RER, bubbled membrane, satin Golgi, translucent SER.
   - Then a hero kinesin rebuild.

**No sign-off; overall is 7.3.**
