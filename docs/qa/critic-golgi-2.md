# Critic Pass 2: Golgi Apparatus and Transport Vesicles

Shots reviewed: v11 overview/golgi/buds/fuse, v10 golgi/street, v9 examine/vesex. Compared against `reference/living-city.png` and `critic-golgi-1.md`.

## Scores (1–10)
| Axis | R1 | R2 |
|---|---|---|
| Fidelity to reference | 6 | 7 |
| Materials / shaders | 4 | 6 |
| Lighting / glow | 4 | 6 |
| Surface detail | 4 | 5.5 |
| Geometric craft | 4 | 6 |
| Readability (overview / close-up) | 7 / 5 | 7 / 7 |
| Vibrancy / WOW | 5 | 7 |
| **Overall** | **4.5** | **6.5** |

This is a real jump. The swollen tube rims, the air gaps, the broad 2–3-lobe undulation nesting across layers, the plum facade with cream windows, the stack lifted on struts, the ribbed fusion port and the cargo inside the vesicles all fix R1 items 1–4 and 7–9. v10-street finally reads as a warm, lit shopfront diorama. **It is not sign-off yet.** The vesicles, which are the second half of this brief, are still the weakest element.

## Remaining defects (most severe first)

1. **Vesicles still don't bud. They hover.** In v11-buds the spheres float in front of the rims, intersecting them or sitting in the gaps, with no neck and no deformation of the sac. The "pinch-off" trail renders as a row of shrinking dots (`● ● • ·`), which reads as a UI ellipsis rather than membrane. Fix: grow buds only from the trans-face rim tips, with a smooth-union neck (radius 0.4x) that thins to zero over the animation and a 1.0 → 1.15/0.85 → 1.0 squash at release. Delete the dot trail, or replace it with one soft fading streak.
2. **Vesicle sizes are still uncontrolled.** Specks of about 0.05 sit next to spheres four times larger (v11-buds, v9-examine). Fix: clamp sizes to 0.18–0.24 as specified in R1, and cull anything smaller.
3. **Transparency sorting ghosts on the sacs.** In v11-buds there are darker pink smudge shapes overlapping the rims (right side, rows 3–5) and a hazy sandy fill inside the sac interiors. Fix: set `depthWrite: true` on the sacs, render opaque with fake SSS (wrap lighting plus a rim term) instead of transmission, or sort per layer with `renderOrder`.
4. **Grain is still on the top plates.** The flat inner decks show a frosted, sandy noise (v9-examine, v10-golgi). Fix: remove the normal or roughness noise and use a smooth gradient from rim highlight #F7B8CF to centre #E87DA6.
5. **The overview silhouette reads as a macaron or brain cushion.** The decks widen like a wedding cake and never curve into the reference's crescent. Fix: bend the stack about 30° about its vertical axis (cis side convex), taper the plan so the top and bottom sacs are similar widths, and raise the rim tubes about 15% so the stripes read at overview zoom.
6. **The struts are plain maroon dowels.** They read as table legs. Fix: taper them, add bevelled collars, and make them about 2x thicker at the base, or replace them with organic microtubule-style tethers.
7. **Docking pods still look like UFOs.** The two chrome arcs and the double concentric shell (v9-vesex) look like hardware. Fix: drop the arcs, use a single shell, and add the lilac glow decal at the base.
8. **Traffic near the Golgi is dead.** No moving trucks are visible around the dock in v11-golgi, and the roads in the overview are empty. Fix: run 3–4 vans dock → ring road → ports, which is still outstanding from R1 item 6.
9. **Fusion port polish.** The tube carries a crinkled cling-film normal map, and the floating outer hoop reads as a gyroscope (v11-fuse). Fix: use a smooth satin tube and merge the hoop into the collar.
10. **Lighting context.** The white void and flat overview fill persist. The warm-key/cool-fill split and the vignette from R1 item 10 are still not in.

## Verdict
6.5/10. **No sign-off.** Fix items 1–4 to reach 7.5, and add item 5 plus the traffic for 8+.
