# Critic Pass 3: Golgi Apparatus and Transport Vesicles

Shots reviewed: v14 ov/golgi/street/fuse, v12 buds/vesex/ov, v13 back. Compared against `reference/living-city.png` and R1/R2.

## Scores (1–10)
| Axis | R1 | R2 | R3 |
|---|---|---|---|
| Fidelity to reference | 6 | 7 | 7 |
| Materials / shaders | 4 | 6 | 6.5 |
| Lighting / glow | 4 | 6 | 6.5 |
| Surface detail | 4 | 5.5 | 6 |
| Geometric craft | 4 | 6 | 6.5 |
| Readability (overview / close-up) | 7 / 5 | 7 / 7 | 7.5 / 7 |
| Vibrancy / WOW | 5 | 7 | 7 |
| **Overall** | **4.5** | **6.5** | **7.0** |

## R2 fix check
- **Fixed:** the struts (tapered, collared), the docking pods (single shell, lilac base, no arcs), the dot trail, and most of the transparency ghosting. There's also a kidney bend in plan, and v14-street is a genuinely good shopfront shot.
- **Partially fixed:** budding (teardrop squash on the rims in v12-buds only), the fusion port (iris added), and lighting (warm windows and lamps).
- **Not fixed:** vesicle size clamp, deck grain, side silhouette, and visible traffic.

## Remaining defects (most severe first)
1. **Vesicles still don't bud in the hero view.** In v14-golgi, roughly 10 spheres sit on the decks, in the gaps and on the face of the rims at random, and none has a neck. The v12-buds teardrops never appear at gameplay zoom. Fix: spawn only from trans-side rim tips and use a smooth-union neck that thins to zero. Delete every non-budding sphere on the stack.
2. **Sizes are still uncontrolled.** In v14-golgi, specks of about 0.08 sit beside spheres of about 0.25. Fix: hard-clamp to 0.18–0.24 at spawn.
3. **The tube rims are faceted.** v14-golgi (left side, layers 2–4) shows lumpy diamond facets along the rims, which reads as low-poly. Fix: use at least 24 radial segments and at least 160 path samples, then recompute smooth normals after the undulation offset.
4. **Deck grain persists.** There's frosted, sandy speckle between the rims in v14-golgi and on the top plate in v13-back. Fix: zero the roughness/normal noise on the deck material.
5. **The silhouette is a tire stack.** v13-back reads as a pile of pool floats with no air visible between layers. The top sac also has a dent at its back-left that looks like a bite. Fix: widen the gaps by about 25%, taper the top two sacs smaller, add about 20° of vertical crescent bow, and repair the notch.
6. **No value or glow range.** All six sacs are the same pink, and the rims don't glow. Fix: grade from bottom #B2416F to top #F7B8CF, add a wrap/rim emissive term (#FFC2DA, 0.25) so the rims pop, and add underglow on the deck.
7. **There's no visible traffic around the Golgi.** v14-golgi and v14-ov show empty roads, and the trucks in v14-fuse look parked. Fix: put at least 2 vans in frame on the dock loop at all times.
8. **The fusion port is a decal.** The vesicle sits in front of flat iris petals, and the hoop still floats free. Fix: make the vesicle sink into the pore (scale-Z squash plus dissolve), give the petals thickness, and seat the hoop in a collar.
9. **Pod cargo is a flat pink hex block** (v12-vesex). Fix: use a labelled parcel mesh with a faint emissive.

## Verdict
7.0/10. **No sign-off.** Items 1–4 are cheap and would reach about 7.5. Items 5–7 are needed for 8.
