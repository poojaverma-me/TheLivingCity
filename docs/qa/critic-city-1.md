# Critic Report: City Fabric, Pass 1

**Verdict:** The city is competent, but it reads as a mobile city-builder rather than a premium diorama. It has the reference's vocabulary (roads, skybridges, signage, docks) but not its density, hierarchy or material richness.

## Scores (1–10)
| Axis | Score |
|---|---|
| Fidelity/composition vs reference | 4 |
| Materials | 4 |
| Lighting | 4 |
| Surface detail | 4 |
| Craft | 5 |
| Street-level richness | 4 |
| Overview readability | 3 |
| Vibrancy/WOW | 4 |
| **Overall** | **4** |

## Defects (most severe first)
1. **Roads don't read as roads.** The carriageway uses the same blue-grey brick tiling as the sidewalks and plazas. In the overview, the network is just a scribble of white curb lines. The asphalt only shows up as dark disc decals at junctions, which look like stickers or holes (v2-district, v4-centre). *Fix:* give the road its own surface mesh with a warm dark asphalt material (~#4b4a50, rough 0.85, low-frequency wear/tyre-streak noise). Keep the lighter paving for sidewalks only. Replace the disc patches with proper junction meshes built from the road splines.
2. **The curbs are fat round tubes.** They read as inflatable bumpers or pipes, are roughly 3x too thick for the lane scale, and dominate every street-level shot. *Fix:* use an extruded rectangular curb profile about 1/3 the current height with a 0.02 bevel, and add drop-kerbs at crosswalks.
3. **The road network has no hierarchy.** Roads are spaghetti curves with dead-ends and stubs that end in grey circles. Unlike the reference, nothing radiates from the nucleus or rings it. *Fix:* build one arterial ring, nucleus-radial boulevards, and secondary lanes feeding each organelle dock. Run a validation pass that removes any spline end that doesn't connect to a junction or dock.
4. **Density is too low and the composition is bald.** Only about 25 buildings sit in two clumps (south grid and west strip). Large empty slate areas remain east of the Golgi, around the SER and below the nucleus. The reference packs every gap. *Fix:* Poisson-disk lot filler that avoids organelle footprints, using InstancedMesh with 6–8 archetypes x palette variants. Aim for about 3x the current count, plus pipe racks, tank clusters, containers and loading bays.
5. **White void and blown highlights.** Sky and horizon clip to pure white in every street shot. The overview leaves about 65% of the frame empty. *Fix:* gradient or HDRI backdrop with matching fog colour, ACES tone mapping at exposure ~0.85, and a raised bloom threshold. Frame the overview so the cell fills about 75% of the screen.
6. **Window emissive is wrong for daylight.** Glowing yellow and blue strips bloom at full sun, and every window band is identical. *Fix:* drive emissive from time-of-day (~0.15 by day). Give each window a random on/off and tint instance attribute so roughly 30% are dark.
7. **Façade material reads as styrofoam.** The stucco normal noise is too strong and too coarse (city-final-street). Metal quonset roofs show hot specular blowouts (Golgi shot). *Fix:* normalScale ≤0.2 at a finer tiling, roughness ≥0.4 on metals, lower envMapIntensity. Add parapet trims, edge wear and varied rooftop kit (AC units, vents, antennae, solar).
8. **Skybridges are not anchored.** They pierce façades mid-window (floor1-plaza) and fade out off the edges of buildings (city-final-street). *Fix:* snap endpoints to door sockets or stair towers, place support columns at fixed spacing, and add stair cores.
9. **Trees are one species with no variation.** They are a uniform lime blob, as tall as a three-storey building. *Fix:* 3–4 species, ±8% hue and ±30% scale jitter, desaturate about 15%, cap height near 1.5 storeys, and add hedges and ground cover.
10. **Organelles sit straight on the slab.** Only the Golgi dock and the mitochondria's hazard ring connect them to the city. *Fix:* give each organelle a plinth apron with a service road, dock bay and fence line.
11. **Scale is inconsistent.** Manholes are about a third of the lane width, crates match the forklift in size, and the benches are oversized. Scale manholes to ×0.4 and run a single scale pass on the whole prop set.
12. **Lighting is flat.** There is no warm/cool contrast and contact shadowing is weak at building bases. *Fix:* warm key + cool sky fill, N8AO/SSAO, and a slightly lower sun so shadows run longer.

## What works
- The NUCLEUS gateway towers and the wayfinding signs.
- The Golgi loading dock with its forklift and pallets.
- The hazard striping at the mitochondria edge.
- The colour-coded building trims.

## 3 WOW opportunities
1. **Living arteries.** Animated emissive lane-flow on the radial boulevards: pulses run from the nucleus to the ER to the Golgi to the membrane ports, readable from the overview as the cell's protein "traffic map".
2. **Two-tier industrial skyline.** A stilted network of glass pipes and a monorail weaving between districts at two heights, carrying glowing cytoplasm fluid and cargo pods. This would deliver the reference's "pipes and raised walkways" in a single signature system.
3. **Diorama finish.** Tilt-shift DOF in the overview, a golden-hour key light with window glow, low drifting cytoplasm fog with particles, and a translucent, subsurface-lit cell floor so the city appears to float on living tissue.
