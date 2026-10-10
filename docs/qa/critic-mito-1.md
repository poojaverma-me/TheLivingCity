# Critic Review: Mitochondria District, pass 1

Sources: reference `living-city.png` (cropped and enlarged around the two pods), 9 shots, `src/world/organelles/mitochondria.js` (read only, not edited).

**Verdict:** The layout is competent and readable, but the look is wrong. The reference shows copper furnaces with fire burning in deep, dark folds. Ours look like inflatable pool toys with a cream jelly mould inside, under daylight. Nothing smoulders, so there is still no WOW.

## Scores (1-10)
| Axis | Score |
|---|---|
| Fidelity to reference | 5 |
| Materials/shaders | 4 |
| Lighting/glow | 4 |
| Texture/surface detail | 3 |
| Geometric craft | 5 |
| Readability: overview / close-up | 6 / 5 |
| Vibrancy/WOW | 4 |
| **Overall** | **4.5** |

## Defects (most severe first)

1. **No value contrast inside the pod, so it never reads as a furnace.** In the reference, the folds are dark red-brown pits with white-hot spark clusters. Ours are lit evenly from top to bottom. The causes are `floorMat` (`emissiveMap = floorTex`, intensity 1.25 to 1.75), `memMat` (emissive 0xff7a24 at 0.85 to 1.2) and a single `PointLight(46, 13)` at y=2.3.
   - **Fix:** Drop `floorMat.emissiveIntensity` to 0.25 and darken `floorTex` to around #5a1a08 with a radial falloff.
   - Set `memMat` emissive to 0.15 and drive it from a vertical gradient: 0 at the base, peach only on the top 15% of `CR_H`.
   - Replace the one light with 3 to 4 small `PointLight(0xffb040, 18, 3.5, 2)` at y=0.6 inside alternating corridors.
   - Keep bloom for the hot spots only by raising the threshold to about 0.85.

2. **The outer wall looks like an inflatable vinyl tube or a sausage casing, not machined shell.** `membraneNormal` at 0.3 plus clearcoat 0.85 plus sheen produces a wrinkled-balloon surface (critic-mito-street, v4-entrance). The reference wall is a thin, tall, rigid stadium shell with a crisp lit lip.
   - **Fix:** Lower `LIP_R` from 0.5 to 0.18 and raise `WALL_H` from 1.75 to 2.1, so the wall stops looking like a fat torus.
   - Drop `normalScale` to 0.06 and add horizontal panel seams every 0.35 units (roughness map).
   - Use metalness 0.55, roughness 0.28, and a copper gradient from #8a3a12 at the base to #f08a3a at the lip, with the rim light only on the lip.

3. **The cristae are too few, too thick and too regular.** There are about 6 blunt cream "teeth" per side at `HALF_PITCH` 1.3, `FW` 0.6. The reference shows 10 or more thin, sinuous folds that interlock like a maze.
   - **Fix:** Set `HALF_PITCH` to 0.8, `FW` to 0.38 and `IN_T` to 0.14.
   - Add a sine meander (amplitude 0.12, 2 or 3 periods) along each fold.
   - Tint the folds from peach at the lip to red-orange #c4421a down the flanks, because full cream washes out under bloom.

4. **The catwalk spine kills the silhouette.** At overview, a brown deck about 2.5 m wide splits each pod in two, so it reads as "bridge over a pool". In critic-mito-district, the transverse gangway sticks out past the wall and ends in mid-air over the road.
   - **Fix:** Narrow the deck to 0.45, use dark steel #3a3d44 instead of `0xffd9a8` tan, and raise `DECK_Y` by 0.3 so it sits above the folds.
   - Cut or shorten the perpendicular stub so it lands on the stair landing.

5. **The ATP synthase rotors are faceted and their highlights glitch.** `rotorGeo` uses `SphereGeometry(…, 7, 5)`. In mito-v7-dna, the silhouettes are polygonal and the specular highlights smear into sperm-shaped artifacts (clearcoat 0.8 plus emissive 0.9 on low-poly normals).
   - **Fix:** Always use the `hi` path for anything within 8 units, at 16x12 segments minimum.
   - Lower the rotor clearcoat to 0.3 and drop the emissive to 0.3, so gold reads as metal, not as a lit bulb.
   - Shrink the crown rotors by 25%: they are pumpkins right now.

6. **The bokeh orbs look like lens dirt.** `halos` PointsMaterial at `size: 0.5` produces big soft discs floating in the sky (v4-entrance, v7-synth).
   - **Fix:** Use size 0.18 with `sizeAttenuation`, and fade alpha by distance from the camera when closer than 3 units.

7. **The mtDNA ring reads as a UI selection gizmo.** It is a cyan emissive torus at 3.4 with a halo, lying flat on the floor. Its colour clashes and its scale is ambiguous.
   - **Fix:** Use warm magenta-violet #d04aff at emissive 1.5, give it a slow wobble tilt, and lift it to y=0.5 inside a small glass display cradle.

8. **The matrix floor has road dashes and a tile grid** (v7-dna), so it reads as a parking lot. Remove the dashes and swap in a cellular or granular noise texture.

9. **Placement.** The pods float on a flat, blue-grey grid apron. The reference has dark asphalt and many small figures crowding the pods. Add 4 to 6 worker figures per pod, and add contact AO (an apron decal with a 0.6-unit dark falloff).

## WOW opportunities
1. **Proton "lava" pulse.** Make the IMS channel (`imsMat`) a scrolling flow-map emissive with chevrons travelling around the ring at 0.5 u/s. Have it flare each time a synthase "fires", so the plant visibly breathes.
2. **Spark fountains.** Have each crown rotor emit a 12-particle upward spark burst (white-hot to amber, 0.6 s life) on a staggered 2.4 s cycle. From overview this produces the flickering fire of the reference.
3. **Heat shimmer and volumetric glow.** Add a screen-space distortion quad over each pod (sine noise, 0.004 strength), plus a soft additive light-shaft cone rising from the pod mouth. That reads at overview as "this is the power plant".
4. **Power grid hookup.** Run glowing amber conduits from each pod out along the roads to nearby buildings, with ATP tokens riding them. Light up those buildings' windows in sync with the pod pulse to show the city running on this energy.
