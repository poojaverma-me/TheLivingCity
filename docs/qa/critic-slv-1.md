# Critic Pass 1: Smooth ER, Lysosomes, Vacuoles

Reviewed against `reference/living-city.png` using the screenshots slv-v5-overview, v6-ser, v6-caClose, v6-lysoTop, v3-lysoGauge, v2-vacClose and v4-serCorr.

## Scores (1–10)
| Axis | SER | Lyso | Vac |
|---|---|---|---|
| Fidelity to reference | 3 | 6 | 7 |
| Materials | 3 | 4 | 6 |
| Lighting / glow | 4 | 6 | 6 |
| Surface detail | 3 | 5 | 7 |
| Craft | 4 | 5 | 7 |
| Readability (overview / close) | 5 / 4 | 7 / 5 | 7 / 7 |
| Vibrancy / WOW | 3 | 5 | 6 |
| **Overall** | **3.5** | **5** | **6.5** |

**District overall: 5/10.** The vacuoles come close to the premium bar. The SER is the weakest asset on the map.

## Defects (most severe first)

1. **The SER looks like a topiary maze or bubble-letter "S" shapes, not a membrane network.** It is built from solid, uniform-thickness sausage walls. There is no lumen, no stacked ribbon tiers and no thin-sheet silhouette. In the reference it is a set of tall, folded, thin-walled ribbons with lit inner edges, running through the city.
   - *Fix:* Sweep a thin rectangular profile (about 0.12 thick) along CatmullRom centerlines. Stack 2–3 tiers at different heights and leave the tops open.
   - Give the inner faces a `BackSide` emissive material so the channel reads.
   - Lengthen the loops and let them overlap. Connect them to the road network instead of a fenced island.
2. **The SER colour and material are wrong.** It is saturated chartreuse, not olive or moss. The close-up (caClose) shows vertical UV-stretch streaks and a furry, felt-like normal noise. Wet plastic specular stripes run up every wall.
   - *Fix:* Base colour `#6f8a2e`, highlight `#a3b84f`. Use roughness 0.45 and clearcoat 0.25.
   - Recompute UVs by arc length (u = s/L·k, v = height) or use triplanar mapping, and cut `normalScale` to about 0.2.
   - Add a fresnel rim emissive (`onBeforeCompile`, `#c8e070`, 0.35) to fake the reference's subsurface glow.
3. **The Ca²⁺ tank lid is covered in blotchy yellow noise.** In serCorr it reads as mould or cheese.
   - *Fix:* Remove the noise map and use clean painted metal (`#e9e4d0`, metalness 0.3), with a panel-line normal only.
4. **The lysosome is a single colour.** Hull, rim, acid and emblem are all the same neon lime. At eye level (lysoGauge) about 60% of the frame is one undetailed green drum. The hull also has a water-ripple normal map applied to it. In the overview, the SER and lysosomes merge into one "green blob" family.
   - *Fix:* Hull in deep sage `#2f6e3c` with satin steel bands. Keep lime only for the emissive acid and the emblem. Remove the liquid normal from the hull.
5. **The lysosome emblem is a generic two-arrow "refresh" icon.** It is only readable from above.
   - *Fix:* Use the triangular three-arrow Möbius recycling symbol, and add it as an embossed decal on the side wall facing the camera.
6. **The lysosome portholes are dead.** They show grey glass with nothing behind it. The pH gauge cannot be read, and the steam sprite looks like a smudge on the lens.
   - *Fix:* Put an emissive interior plane behind the portholes with churning debris (scrolling UV). Scale the gauge up 2×.
   - Replace the steam sprite with 20–30 noise-faded particles.
7. **The vacuole water has no depth.** It is flat cyan filled to the rim, with no freeboard and no fresnel. The tank wall looks like a printed cyan decal rather than glass holding water, and all four tanks are identical.
   - *Fix:* Lower the water level about 8% below the rim. Add a depth gradient from `#7ff3ff` to `#0b7e9e` and env reflections with fresnel. Use a transmission glass wall and show the water line.
   - Vary the contents: one amber nutrient tank and one murky olive waste tank with bubbles. The reference label says "water, nutrients and waste".
8. **The scene is lifeless and the props don't sit on the ground.** There are no workers, carts or clutter, while the reference has dozens of lab-coat figures. Everything sits on a vast tiled floor with visible repetition, there is no contact AO, and the sky is blown to white in the eye-level shots.
   - *Fix:* Add GTAO or N8AO. Lower ACES exposure about 0.15 and give the sky a tint.
   - Break up the floor tiling with decals and grime, and instance 6–10 workers per district.
9. **Minor props.** The yellow spheres in the SER read as tennis balls. The banana-shaped green struts (caClose, right side) are unexplained. The thin rails shimmer and alias (raise MSAA, or use thicker rails at a lower LOD).

## Three WOW opportunities

1. **Living SER channels.** Make the ribbon walls semi-translucent (`transmission` 0.3) and send glowing amber lipid droplets through the open channels. Show detox as dark toxin blobs going in and bright clean pellets coming out at the far end.
2. **Lysosome digestion cycle.** A conveyor drops a worn organelle chunk into the vat. The acid swirl speeds up, there is a bloom pulse and a bubble burst, then recycled pellets come out on the other conveyor. This loop runs every 8–10 seconds.
3. **Vacuole waterworks.** Tanks fill and drain with an animated water level. A pipe spills into the neighbouring tank, and a spotlight `.map` projects animated caustics onto the floor and catwalks. The duck bobs on a sine wave and rides the level change.
