# Critic Review: Mitochondria District, pass 2

Sources: reference (pods cropped and enlarged), r10 overview/examineA/examineB/synth/dna, r9 street, r8 district.

**Verdict:** This is a big step up. The pods now read as mitochondria at overview and are the strongest landmark on the map after the nucleus. They still read as orange plastic toys full of corrugated bacon, not copper furnaces with fire in their folds. **Not signed off.**

## Round-1 status
- **Fixed:** thin tall wall with a crisp lip; dark steel deck; the stub now lands on a stair; mtDNA is magenta in a cradle; bokeh discs are gone; road dashes are gone; there is a hazard-ringed apron.
- **Partial:** rotor faceting and highlights; value contrast.
- **Overshot:** cristae count. There are now about 22 identical fins per pod.

## Scores
| Axis | Score |
|---|---|
| Fidelity | 6.5 |
| Materials | 5 |
| Lighting/glow | 6 |
| Surface detail | 5 |
| Craft | 6.5 |
| Readability (overview / close) | 8 / 6 |
| Vibrancy/WOW | 6.5 |
| **Overall** | **6.3** |

## Defects (most severe first)

1. **There is still no furnace value structure.** The floor is a uniform saturated red-orange (with a polka-dot bubble texture in the dna shot). The fin flanks are mid-orange and the tops are peach, so every value sits in the 50 to 80% band. The reference keeps its pits near black-brown, with isolated white-hot fire pockets and light columns rising above the rim.
   - **Fix:** Matrix floor albedo to #3a1206 with emissive at or below 0.2. Add 4 to 6 localized hot pools (radial emissive decals, #fff0c0 core to #ff6a10 edge).
   - Add additive vertical light-shaft cards (2 to 3 per pod, 1.5 units tall) so fire is visible from overview.

2. **The cristae are mechanically stamped.** Every fin has the same phase, amplitude, length and spacing, so the pod reads as a radiator or a lasagna (r8). The reference shows fewer, fatter hairpin loops that interlock around an irregular central lumen.
   - **Fix:** Cut the count to 12 to 14 per pod. Randomise phase (0 to 2π), amplitude (0.06 to 0.16) and length (55 to 85% of the half-width), and alternate long and short fins.
   - Join pairs into U-loops with visible rounded caps.

3. **The wall material is painted plastic, not copper.** It is flat #e07020 with no reflection, no gradient and no wear, and the panel seams are barely visible. The r9 street view is a featureless orange gas tank.
   - **Fix:** Metalness 0.7, roughness 0.3 to 0.45 varied by a noise map. Run a base-to-lip gradient from #6e2a0c to #f39a48, and add an env-map so it reflects the warm interior.
   - Darken the seams to read at 2 px. Add a warm emissive strip under the lip, plus 3 to 4 glowing vents or portholes per side so the exterior advertises the heat inside.

4. **The rotors and lanterns are still CG-cheap.** Gold spheres show twin blown specular blobs that read as cartoon eyes (synth, dna). Collars are visibly octagonal, and the lantern caps are faceted hemispheres.
   - **Fix:** Use at least 24 radial segments on every collar and cap. Set roughness to 0.35 and clamp the specular, or switch to an anisotropic brushed map.
   - Add a stator arm (thin peripheral stalk) so each rotor reads as ATP synthase, not a bauble.

5. **Bloom blowout.** The capsule lanterns go pure white, with halos spilling across neighbouring fins (examineA, left). The scattered wall-mounted mini-synthases also read as gold confetti at mid-distance.
   - **Fix:** Cap the lantern emissive at 2.0, tint the cores #ffd28a, and lower the bloom radius.
   - Halve the mini-synthase count and cluster them along the fin tops.

6. **The T-catwalk still bisects the silhouette** at overview (a black line through both pods). Drop it 0.2 below the fin tops so the fins overlap it, or reduce it to a short pier from the stair landing.

7. **The street-level framing exposes the void.** The sky is blown white and a fog band cuts the horizon (r9). Clamp the camera pitch, or add a warm haze dome over the district.

## Missing WOW (carry-over)
None of the round-1 WOW items is visible yet:
- the proton pulse along the inter-membrane channel;
- spark fountains from the crown rotors;
- heat shimmer over each pod;
- glowing conduits out to the city.

Ship at least the spark fountains and the light shafts. They are the difference between "orange tub" and "power plant".
