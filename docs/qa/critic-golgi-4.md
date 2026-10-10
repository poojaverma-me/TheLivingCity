# Critic Pass 4: Golgi Apparatus and Transport Vesicles

Shots reviewed: v17 overview/golgi/back/buds, v16 street, v15 fuse/vesex. AO speckle and traffic were excluded per the brief.

## Scores (1–10)
| Axis | R3 | R4 |
|---|---|---|
| Fidelity to reference | 7 | 7.5 |
| Materials / shaders | 6.5 | 7 |
| Lighting / glow | 6.5 | 6.5 |
| Surface detail | 6 | 6.5 |
| Geometric craft | 6.5 | 7 |
| Readability (overview / close-up) | 7.5 / 7 | 8 / 7.5 |
| Vibrancy / WOW | 7 | 7 |
| **Overall** | **7.0** | **7.3** |

## R3 fix check
- **Fixed:** the faceting (rims are now smooth), the size clamp, the random spheres on the decks, and the cargo (the parcel in v15-vesex reads well). v16-street is still the best shot.
- **Partially fixed:** budding happens at the rim tips now, but the neck is wrong (see 1). Deck grain is mostly gone, though faint frost remains on the top sac in v17-buds. The fusion petals now have thickness.
- **Not fixed:** the silhouette and notch, value grading and rim glow, and the floating hoop.

## Remaining defects (most severe first)
1. **The bud neck is a lollipop, not a pinch.** In v17-buds, the rim extrudes into a straight cone that butts into the sphere with a visible crease. The lower-left bud is a half-dome with a hard crescent boolean cut. Fix: use a smooth-min blend (k≈0.08) with a neck radius that animates from the rim radius to 0, and delete the half-buried dome.
2. **The silhouette is still a tire stack.** In v17-back, the six identical sacs have almost no air between them, and the top sac's back-left "bite" notch is still there. Fix: widen the gaps by 25%, scale the top two sacs to 0.85 and 0.75, add the crescent bow, and patch the notch.
3. **The stack is a flat pink monolith.** All layers have the same value and there is no rim pop. Fix: grade from #B2416F at the bottom to #F7B8CF at the top, add a fresnel rim emissive (#FFC2DA, 0.25), and add a warm underglow from the shopfront onto the lowest sac.
4. **There are dark pores on the deck tops** (v17-golgi, v17-back). They read as bolt holes or bullet holes. Fix: delete them, or turn them into raised lilac bud scars.
5. **The fusion hoop still floats.** In v15-fuse, the two arcs hover off the wall and the lower one clips the floor. The vesicle sits in front of the pore rather than inside it. Fix: seat the hoop in a collar flush to the membrane, and sink and squash the vesicle into the iris.
6. **There are stray detached spheres.** In v16-street, a purple ball hangs in open air beside the stack. In v15-fuse, a pill above a dot reads as a "!". Fix: tether every floater to a rim or the membrane, or cull it.

## Verdict
7.3/10. **No sign-off.** Items 1–3 are needed for 8. Items 4–6 are cheap polish.
