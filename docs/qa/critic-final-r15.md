# Critic: Final Review, Round 15 (r15 shots + act9 sheets vs reference)

**Verdict: 7.9/10 (r13: 7.8). NOT signed off.**

The r13 hygiene list was largely closed and the activities improved. But the hero frame still loses to the reference on its two biggest levers: a thick, opaque pool-float membrane (north and east rim) and a cell filling only about 42% of the width. A new ghost text overlay also mars the title.

## Fixed since r13
- **Nucleus dome:** the flare sprite is gone and the sawtooth fringe is gone.
- **Golgi:** the pylons and dowels are gone. It now reads as a clean cisternal stack.
- **Street signs:** "PROTEIN QC" is fully readable.
- **Replay:** Dr. Mendel no longer shows the completion line on replay, across all 11 activities.
- **Nucleolus panel:** the start and mid frames are now densely populated.
- **Mito:** "H⁺ GRADIENT" now sits inside the bezel.
- **Lysosome:** the legend is clear of world cargo.
- **Membrane:**
  - The close-up now reads as frosted glass.
  - The south rim is translucent at the overview, and the city shows through.
- **Frame fill:** up from about 35% to about 42%.

## Scores
| Area | r13 | r15 |
|---|---|---|
| Nucleus + RER | 7.5 | 8 |
| Membrane | 6 | 6.5 |
| Golgi + vesicles | 8 | 8.5 |
| Mitochondria | 8.5 | 8.5 |
| SER | 7.5 | 7.5 |
| Lysosomes | 8 | 8 |
| Vacuoles | 8.5 | 8.5 |
| City | 7.5 | 7.5 |
| Characters / vehicles | 7.5 | 7.5 |
| Curiosity exhibits | 7.5 | 7.5 |
| Activities (visual / clarity) | 8 / 8.5 | 8.5 / 8.5 |
| UI | 8 | 8 |
| Title screen | 8 | 7.5 |
| **Overall** | 7.8 | **7.9** |

## Remaining defects (most severe first)

1. **Ghost "…IVING CITY" text on the title screen (new).**
   - **What's wrong:** large faded caps run across the Golgi and mito in r15-title, at y≈510. They match the loader's "BUILDING THE LIVING CITY" string in `index.html:19`, so the loader overlay is not fully removed.
   - **Fix:** on fade end, set `display:none` on the loader (or remove it), not just a low opacity.
2. **Membrane still a pool float on the hero.**
   - **What's wrong:** the north and east rim is still a fat, opaque baby-blue tube. Only the south lip got the translucency.
   - **Fix:**
     - Apply the fresnel ramp all round: mix(0.25, 0.85, f²).
     - Cut the tube radius by about 40%.
     - Add a thin bilayer stripe along the top edge.
   - This is still the single largest gap to the reference.
3. **Frame fill (title and overview).**
   - **What's wrong:** at about 42% of the width, the cell is still smaller than the reference's 65%. The overview also crops the cell's south edge at the frame bottom.
   - **Fix:** pull the camera in about 12% and re-centre it vertically so there is a margin of at least 3% at top and bottom.
4. **"ENTER THE CITY" still reads as disabled.** It is pale lavender with white text. Use a #6b4fd8 fill with contrast of 4.5:1 or better, and add a hover lift.
5. **Activity label collisions.**
   - **nucleus-mid:** the "ACTB · β-act" chip is overprinted by the "GENE Gene · ACTB" tag.
   - **ribosomes-end:** "N→C New protein" overprints the Met/Phe labels.
   - **ser-mid:** "OH Hydroxy-ibuprofen" starts under the step panel.
   - **golgi-replay:** the "…M6P ta" tag is truncated by a vesicle sphere.
   - **Fix:** run screen-space label de-confliction (an AABB nudge pass) and clamp labels to a 90% safe area, excluding the step-panel rect.
6. **Membrane activity panel:** world geometry still ghosts through the glass in all four frames, as a purple gate disc and a pale rectangle at the right in mid. Raise the backplate opacity to 0.92 or more, or add a depth-only occluder card behind the panel.
7. **Vesicles-mid microtubule:** it passes straight through the roofs and walls of buildings. Route it over a raised spline, at roof height + 1, or hide the occluded segments.
8. **Front gate roof:** the black spheres became red-brown spheres, but they are still unexplained blobs (and there is a pink disc). Delete them or make them vents.
9. **Yellow ringed orb:** still unlabelled (mito shot, lysovac foreground). Add a plaque or delete it.
10. **SER:**
    - It is still an island with no RER→SER causeway.
    - The "CAUTION: GRAPEFRUIT vs P450" board is still micro-text. Scale it ×1.6.
11. **Characters:**
    - Coats are still about 95% white. Add district vests (mito orange, Golgi pink, lysosome green).
    - The trucks still lack panel lines and tyre tread.
12. **Kinesin:**
    - The heads are still orange blobs with no lifted stepping head and no dark neck linker.
    - A tree occludes the "WALKS 8 nm PER ST…" sign.
13. **Nucleus details:**
    - **Ribosomes:** still two hues (red and orange). Lock them to #9e2236.
    - **"Cheerio" pore rings:** still too dense on the dome and the interior window. Cut them by 60%.
    - **RER:** still saturated periwinkle. Pull it toward #4a6fb5.
14. **Street:** the orange foreground roof slab is still featureless. Add a parapet, vents and a trim atlas.

## Top 3 to reach sign-off
1. Fix the loader ghost and the membrane fresnel/thickness pass on the full rim (+0.3).
2. Tighten the hero camera and the CTA button (+0.15).
3. Do the label de-confliction pass and the membrane-panel occlusion (+0.1).

**No sign-off. Overall is 7.9.**
