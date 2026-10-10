# Critic Report: City Fabric, Pass 2

**Verdict:** This is a real step up. Roads now read as roads, density has roughly tripled, and the rooftops have detail. It still looks like a polished mobile city-builder rather than the reference's dense, premium diorama. **NOT signed off.**

## Round-1 fix check
- **Fixed:** asphalt separated from paving, with lane dashes, crosswalks and drop-kerbs (r2a-street, r2b-east); building density about 3x; rooftop kit (tanks, antennae, AC units, railings); the NUCLEUS skybridge now lands on towers (r2c-gate); warm key light with long shadows; dock and gatehouse props at the organelle edges.
- **Partial:** curbs are thinner but still round-topped cream bumpers (the inner kerb in r2c-gate); tree scale.
- **Not fixed:** every window glows warm in full daylight with zero dark panes; the road hierarchy has no legible ring or radials; the SER has no apron.

## Scores (1–10)
| Axis | R1 | R2 |
|---|---|---|
| Fidelity/composition | 4 | 6 |
| Materials | 4 | 5 |
| Lighting | 4 | 6 |
| Surface detail | 4 | 5 |
| Craft | 5 | 6 |
| Street-level richness | 4 | 7 |
| Overview readability | 3 | 5 |
| Vibrancy/WOW | 4 | 6 |
| **Overall** | **4** | **6** |

## Remaining defects (most severe first)
1. **The overview reads as noodles on navy.** The asphalt (~#4a4a55) and the navy ground slab are nearly the same value, so blocks and roads merge into one dark mush, and no arterial ring is visible. *Fix:* lift the plaza and ground to a warm light concrete (~#b9b3a8). Widen one ring boulevard 1.5x with a tree median. Add 4 nucleus-radial avenues with a lighter centre line so the network reads at 1600px.
2. **The buildings are pillowy toy boxes.** One archetype (rounded box, one window band, coloured corner tubes) repeats everywhere. Large blank white walls appear in r2a-street (left) and r2c-gate (left tower), and the pink corner columns in r3-street read as pool noodles. *Fix:* reduce the bevel radius to about 0.03, swap the corner tubes for flat pilasters, add storey lines, mullions, balconies, ground-floor shopfronts with awnings and signage, and add 3 more silhouettes (stepped, L-plan, sawtooth-roof industrial).
3. **The window emissive is still wrong.** Every pane is lit amber at noon. *Fix:* set day emissive to about 0.1, make 35% of panes dark or reflective with a sky tint, and drive it from time of day.
4. **The SER district is bald.** The ribbons stand on stilts over bare navy slab, the floor between them is empty, and the north-east rim strip is unused (r3-ser). *Fix:* a plinth apron, pipe racks and tank clusters between the ribbons, a service loop road and a fence line. Fill the strip along the membrane with a Poisson pass.
5. **Ground decal junk.** The random pink and yellow splats and grey pebble blobs on the paving (r3-street, r2b-east) read as spilled paint. *Fix:* remove them, or turn them into recognisable flower beds and leaf litter.
6. **Paving and road surface.** The sidewalk tiles are person-sized and identical. The road shows dark rectangular patches that look like tiling seams (r3-street foreground). The manholes are flat black discs. *Fix:* use 0.5x tile scale with a 3-tone variance, continuous wear noise instead of patches, and a grated manhole texture.
7. **The trees are still lollipops.** There are only two forms (blob and stacked-sphere topiary), both saturated lime. *Fix:* add 2 more species, desaturate 15%, and add hedge rows and ground cover along the boulevards.
8. **Curbs.** *Fix:* a square extrusion with a 0.02 bevel everywhere, including organelle approaches.

## What works
The street-level vignettes (the gatehouse with forklift, the GENE LAB frontage, the crowds at the crosswalk), the rooftop kit, the anchored NUCLEUS gateway bridge and the Golgi loading plaza are now genuinely charming.

## Path to 8
Fix defects 1–3. They change every frame, and together they move overview readability and materials up 2 points each.
