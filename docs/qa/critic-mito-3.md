# Critic Review — Mitochondria District, Round 3

Shots: s3 overview/district/synth/dna/examineA, s2 examineB/street, vs reference crop.

**Verdict:** Real progress. At overview the pods now read correctly: dark pits, hot pockets, an amber rim, and a stronger landmark than the Golgi. Close up, the cristae are still glossy orange pool noodles and the rotors still look like cartoon baubles. **Not signed off (7.3).**

## Round-2 status
- **Fixed:** Furnace value structure (near-black matrix, hot pools). Cristae are down to about 13 per pod with randomised phase and length, and they now form U-loops. The catwalk is now a short pier. Lantern cores are amber instead of white. The shell has vents, a door, conduits and an emissive lip strip. The spark fountains, chevrons and stator arms are in.
- **Partial:** Wall material, rotor shading, light shafts (invisible at overview).
- **Not fixed:** Mini-synthase confetti.

## Scores
| Axis | Score |
|---|---|
| Fidelity | 7.5 |
| Materials | 6 |
| Lighting/glow | 7.5 |
| Surface detail | 6 |
| Craft | 7 |
| Readability (overview / close) | 8.5 / 7 |
| Vibrancy/WOW | 7.5 |
| **Overall** | **7.3** |

## Remaining defects (by severity)

1. **The cristae are uniform-width glossy tubes** (see synth). They are constant thickness, with soft subsurface-like shading and no edge definition: sausage skins, not membrane shelves. The reference folds are wide, flat-topped shelves with a lit cap and dark flanks.
   - Widen the tops by about 1.6x and make them flat, with a 0.03 bevel.
   - Push the flank albedo to #7a2a10 with roughness 0.6, and give only the cap top an emissive peach band.
   - Add a faint ribbed normal (vertical, about 0.15 spacing) on the flanks.

2. **The rotors still have twin blown specular "eyes"** (synth, the front sphere, and the dna lower-left cap).
   - Set roughness to at least 0.4 and clamp the env intensity on gold.
   - Replace the sphere with a 6-lobe F1 head (3α/3β, `LatheGeometry` lobes) so it reads as a molecule.
   - The drum cap at lower-left of dna is visibly polygonal: use 48 or more segments.

3. **The mini-synthases are still confetti.** In dna they read as gold rubber ducks with halo rings.
   - Cut them by 50%, drop the ring, and seat them flush in the fin flank as a dark socket plus a small gold knob.

4. **The shell reads as a wooden barrel or hot tub** (street, examineA). The vertical seams plus the warm matte brown read as staves.
   - Set metalness 0.75 and roughness 0.35 with noise variation, and add an env reflection of the interior glow.
   - Space the vertical seams twice as wide and add rivet rows.
   - Darken the base 20% to ground it.

5. **The light shafts don't register at overview.** The reference's signature is vertical fire columns poking above the rim.
   - Raise the shafts to 5 or more units so they exceed the wall, set opacity to 0.8 at the base, and add a slow upward-scroll UV.
   - Keep 2 per pod, aligned so they don't X-cross toward the iso camera.

6. **A bloom streak on the front lip** (examineA/B left, and the street rim against the sky) creates a horizontal white smear.
   - Lower the lip-strip emissive near the camera-facing arc, or raise the bloom threshold for that material.

7. **Minor issues:**
   - The stair at overview is still a black diagonal slash across the wall. Tint the stringers copper.
   - The mtDNA ring is too small inside its cradle. Scale it 1.4x and add a slow spin.

## Path to sign-off
Fix items 1, 2 and 5. Those alone should take the close-ups from toy to machine and give the overview its fire columns, which would be about 8.
