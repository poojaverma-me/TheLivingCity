# Critic: Final Review, Round 13 (r13 shots + act8 sheets vs reference)

**Verdict: 7.8/10 (r10: 7.6). NOT signed off.**

Real progress on the r10 hygiene list. The hero overview is still undercut by the same two problems: the opaque pool-float membrane and a cell that fills only about 35% of the frame. The dome also carries two visible artefacts. A new systemic activity bug turned up in every replay frame.

## Fixed since r10
- **RER:** the walls now have vertical slats in place of horizontal ribbing.
- **Ribosomes:** they now sit on the RER wall faces instead of floating mid-channel. The density is sane.
- **Signs:** "NEWS" is clean, and "WATER" is now readable on the vacuole tanks.
- **Kinesin rebuilt:** two heads, a coiled stalk, a cargo vesicle and a tubulin-bead microtubule, plus a readable "8 nm per step" sign.
- **Lysosome:** the emblem is now opaque and bold, with a pH gauge and rivets. It finally reads as a plant.
- **Trucks** have "CYTO EXPRESS" livery, and some workers wear hard hats.
- **Membrane:** the proteins are now sunk into the wall, and the normal map is finer.
- **Activities:**
  - The ribosome chain stays inside its panel.
  - The vacuoles end shot is now a proper "animal vs plant" reveal.
  - The nucleus end shot reveals the dome instead of a white void.
  - The gene chips are large.

## Still broken
- **Dome flare:** the orange star sprite on the dome is still there, at upper-left in the nucleus shot.
- **New: sawtooth fringe on the dome.** A jagged white saw-edge runs along the inner dome rim (nucleus shot, y≈200). It looks like alpha-sorting or z-fighting against the membrane top.
- **Overview south wall:** the ghost rectangular hatch and the porthole double-image are still there. The city strip just above them is soft or blurred, which may be a tilt-shift regression.
- **Golgi:** the pink pylons and inter-sac dowels still pierce the stack. It reads as a parasol on poles.
- **Yellow ringed orb:** it still has no label (mito shot, and the lysovac foreground).
- **SER:** it is still an island, and the "CAUTION: GRAPEFRUIT vs P450" board is still micro-text.
- **Street:** the "PRO…" sign is occluded, and the foreground orange slab is still featureless.
- **Front gate:** black spheres float on and above the purple roof.
- **Coats** are still 100% white.

## Scores
| Area | r10 | r13 |
|---|---|---|
| Nucleus + RER | 7 | 7.5 |
| Membrane | 5.5 | 6 |
| Golgi + vesicles | 8 | 8 |
| Mitochondria | 8.5 | 8.5 |
| SER | 7.5 | 7.5 |
| Lysosomes | 7.5 | 8 |
| Vacuoles | 8.5 | 8.5 |
| City | 7.5 | 7.5 |
| Characters / vehicles | 7 | 7.5 |
| Curiosity exhibits | 7 | 7.5 |
| Activities (visual / clarity) | 7.5 / 8.5 | 8 / 8.5 |
| UI | 8 | 8 |
| Title screen | 8 | 8 |
| **Overall** | 7.6 | **7.8** |

## Defects below 8

**Nucleus + RER (7.5)**
- **Dome artefacts:** delete the flare sprite. Fix the sawtooth with `depthWrite:false` and an explicit `renderOrder` on the dome shell, or clip the membrane's top inside the dome footprint.
- **RER walls:**
  - The lips are still fat rounded bolsters. Bevel them to 0.03.
  - The colour is still saturated periwinkle. Pull it toward #4a6fb5.
  - Add 2–3 ring breaks.
- **Ribosome colour:** there are still two hues (red and orange). Lock them to #9e2236.
- **"Cheerio" pore decals:** they still crowd the dome and the interior window. Cut them by 60%.

**Membrane (6)**
- **Thickness and opacity:** it is still opaque baby-blue stucco, unlike the reference's thin glass wall.
  - Cut the cross-section by 40%.
  - Use a fresnel opacity ramp, mix(0.25, 0.85, f²), with a #9fc6e0 backface pass.
- **Texture:** the front-gate close-up reads as plaster. Lower the normal strength to about 0.15 and add a faint bilayer stripe band along the rim.
- **South-wall ghosts:** remove the ghost hatch and porthole, or give them a crisp frame so they read as intentional gates.

**SER (7.5)**
- Run a tube or causeway from the outer RER ring into the SER entrance.
- Scale the caution board ×1.6.

**City (7.5)**
- Raycast-check every sign; the "PRO…" sign at the street corner is still occluded.
- Fix the orange foreground roof: add a parapet, vents and a trim atlas.
- Delete or re-model the black roof spheres.

**Characters / vehicles (7.5)**
- **Coats:** add district-coloured vests or lanyards (mito orange, Golgi pink, lysosome green).
- **Trucks:** add panel lines and tyre tread; they are still flat yellow boxes.

**Curiosity exhibits (7.5)**
- **Kinesin:** the heads are orange blobs. Give them a darker neck linker and a visible stepping pose (one head lifted).
- **Yellow orb:** give it a plaque, or delete it.

## Activities (8 / 8.5)
- **Replay bug (systemic, all 11 replay frames).** After replay, Dr. Mendel still shows the *completion* line while the step panel has reset to step 1. Reset the guide line on replay.
- **Panel bleed:**
  - **Membrane:** a world vesicle renders *in front of* the holo panel in replay, and world geometry ghosts through the glass in every frame. Raise the panel's renderOrder and give the backplate an opacity of 0.92 or more.
  - **Lysosomes:** world cargo overlaps the "FATTY ACIDS" and "NUCLEOTIDES" legend, and the V-ATPase tag collides with the panel header.
- **Clipping:**
  - mito: "H⁺ GRADIENT" is cut off at the bezel.
  - nucleus-start: the COL1A1 chip overflows the right bezel.
  - rer: the "80S Ribosome" tag floats above the frame.
- **Empty panels:** nucleolus start and mid are still about 70% empty glass. Put the rDNA locus and the forming subunits in the panel's centre.
- **Small chips:** the step-panel chips are still about 12px. Raise them to 13px or more.

## Title screen (8)
- **Cell size:** the cell is still about 35% of the width, against the reference's 65%. Pull the camera in about 15%.
- **"ENTER THE CITY":** the pale lavender with white text reads as disabled. Use a saturated #6b4fd8 fill with contrast of 4.5:1 or better.

## Top 5 highest-impact improvements
1. **Membrane rebuild** to a thin fresnel glass wall with a bilayer rim stripe, and the south ghosts removed. This is still the largest surface and the biggest gap to the reference (about +0.4).
2. **Fill the frame.** Tighten the overview and title cameras so the cell fills about 60–65% of the width; the white void currently dominates every hero shot.
3. **Hygiene sweep:**
   - Remove the dome flare and fix the sawtooth fringe.
   - Remove the Golgi pylons and dowels.
   - Remove the yellow orb and the black roof spheres.
   - Fix the "PRO…" sign occlusion.
4. **Activity fixes:**
   - Reset the Mendel line on replay.
   - Fix the holo-panel renderOrder and opacity.
   - Pull the clipped labels into a 90% safe area.
   - Re-compose the nucleolus panel.
5. **Connect the districts.** Add an RER→SER tube, district vests on workers, and truck detailing, so the city reads as one system rather than separate dioramas.

**No sign-off. Overall is 7.8.**
