# Critic: Final Review, Round 17 (r17 shots + act9 sheets vs reference)

**Verdict: 8.0/10 (r15: 7.9). SIGN-OFF**, with the polish list below recommended.

## Verified since r15
- **Title ghost text is gone.** The loader overlay no longer bleeds into the hero.
- **"ENTER THE CITY"** is now a saturated solid violet. It reads as the primary CTA and no longer looks disabled.
- **Membrane:** this is the big win.
  - The rim is now a thin, pale, fresnel-glass band all the way round, with the city visible through the south lip.
  - On the title it finally reads like the reference's glass wall rather than a pool float.
  - The close-up (r17-membrane) is smooth frosted glass.
- **Title framing:** the cell is about 47% of the width, up from 42%. The poster-style bottom behind the buttons works compositionally.
- **UI chips:** they are crisp, with no blur haze.

The district shots (nucleus, Golgi, mito, SER, street, front gate) are unchanged from r15, so those scores carry over.

## Scores
| Area | r15 | r17 |
|---|---|---|
| Nucleus + RER | 8 | 8 |
| Membrane | 6.5 | 7.5 |
| Golgi + vesicles | 8.5 | 8.5 |
| Mitochondria | 8.5 | 8.5 |
| SER | 7.5 | 7.5 |
| Lysosomes | 8 | 8 |
| Vacuoles | 8.5 | 8.5 |
| City | 7.5 | 7.5 |
| Characters / vehicles | 7.5 | 7.5 |
| Curiosity exhibits | 7.5 | 7.5 |
| Activities (visual / clarity) | 8.5 / 8.5 | 8.5 / 8.5 |
| UI | 8 | 8 |
| Title screen | 7.5 | 8.5 |
| **Overall** | 7.9 | **8.0** |

## Remaining defects (most severe first)
1. **Overview framing.** The free-camera overview still has the cell at about 47% of the width, and the south membrane is clipped by the frame bottom. Raise the target by about 4% of the frame height and dolly in about 8%.
2. **Activity label collisions.**
   - **nucleus-mid:** the ACTB chip collides with the GENE tag.
   - **ribosomes-end:** "N→C New protein" collides with the Met/Phe labels.
   - **ser-mid:** "OH Hydroxy-ibuprofen" sits under the step panel.
   - **golgi-replay:** the M6P tag is truncated.
   - **Fix:** add an AABB de-confliction pass and a 90% safe area that excludes the step panel.
3. **Membrane activity panel.** World geometry ghosts through the glass. Raise the backplate opacity to 0.92 or more, or add a depth occluder card.
4. **Vesicle microtubule (mid).** It cuts through buildings. Lift the spline to roof height + 1.
5. **Unexplained props.**
   - The red spheres and pink disc on the front-gate roof.
   - The unlabelled yellow ringed orb (mito area).
   - **Fix:** delete them, or give them a purpose and a plaque.
6. **SER.**
   - There is still no RER→SER causeway.
   - The "CAUTION: GRAPEFRUIT vs P450" board is micro-text. Scale it ×1.6.
7. **Characters.**
   - Coats are about 95% white. Add district vests.
   - The trucks need panel lines and tread.
8. **Kinesin.**
   - The heads are still orange blobs with no lifted stepping head.
   - A tree occludes its sign.
9. **Nucleus palette.**
   - **Ribosomes:** two hues. Lock them to #9e2236.
   - **Pore rings:** too dense. Cut them by 60%.
   - **RER:** still saturated periwinkle. Pull it toward #4a6fb5.
10. **Street.** The orange foreground roof slab is featureless. Add a parapet and vents.

## Recommended next pass (not blocking)
1. Overview camera.
2. Label de-confliction and membrane-panel occlusion.
3. Prop cleanup and the SER causeway.

Each is about +0.1–0.15.

**SIGN-OFF. Overall is 8.0.**
