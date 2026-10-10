# Critic Pass 2: Smooth ER, Lysosomes, Vacuoles

Shots: slv2-v4-overview, v3-ser, v4-serClose, v3-lysoB, v2-lysoTop, v2-vacClose, v3-vacBack. Compared against the reference and against critic-slv-1.

## Scores (1-10), with round-1 scores in brackets
| Axis | SER | Lyso | Vac |
|---|---|---|---|
| Fidelity | 4.5 (3) | 7.5 (6) | 8 (7) |
| Materials | 5 (3) | 7 (4) | 7 (6) |
| Lighting / glow | 5 (4) | 7 (6) | 7 (6) |
| Surface detail | 4.5 (3) | 7.5 (5) | 8 (7) |
| Craft | 6 (4) | 7 (5) | 7.5 (7) |
| Readability | 6 (4.5) | 8 (6) | 8 (7) |
| Vibrancy / WOW | 5 (3) | 7 (5) | 7.5 (6) |
| **Overall** | **5.0** | **7.2** | **7.6** |

**Combined: 6.6/10. NOT signed off.** The lysosomes and vacuoles are now near the bar. The SER still holds the district back.

## Fixed since round 1
- The SER is now olive, and the felt fur and UV streaks are gone.
- The Ca²⁺ tank lid is now clean painted metal.
- The tennis balls are now lipid droplets, and P450 detox stations were added.
- The lysosome hull is deep green with riveted steel bands.
- The lysosome now has a three-arrow Möbius symbol on its side, and the pH gauge is large and legible.
- Conveyors and a steam plume were added.
- The vacuole tanks have different contents (water, nutrients, waste), plus catwalks, pipes and a glass wall with caustics.

## Remaining defects (most severe first)
1. **The SER is still a hedge maze.** It is one tier of thick, solid walls with rounded lips, and the soft shading reads as topiary velvet (serClose). There is no lumen, no stacking, no translucency, and it sits on an island away from the roads. In the overview it is a small dark clump, about half the size of the one in the reference.
   - *Fix:* Build the walls as twin thin sheets (0.08 thick) with an open channel between them.
   - Add 2-3 stacked tiers on struts at about 0.7 and 1.4 units.
   - Use `transmission` 0.3 with `thickness` 0.5 and set `sheen` to 0. Add a long ridge normal running along each sheet.
   - Scale the footprint up about 1.5× and run 2 tendrils into the road network.
   - Run the droplet flow through the whole network, not just the tilted chutes.
2. **The SER is too dark in the overview.** Raise its albedo and emissive rim about 25% at far LOD so it separates from the trees.
3. **The lysosome hull colour is inconsistent.** In lysoTop it is saturated mid-green with a hot plastic specular, which brings back the round-1 "lime drum" look.
   - *Fix:* Lock the hull to `#2f6e3c` with roughness 0.5 and clearcoat 0.3.
4. **The lysosome portholes are still dead (lysoTop).** They show hollow rings with hull colour behind them.
   - *Fix:* Put an emissive interior plane with scrolling debris behind the portholes. Remove the odd pipe loop at the bottom right.
5. **The lid emblem's arrowheads overlap at the corners and the acid bloom clips to white.**
   - *Fix:* Extrude the emblem from a proper SVG path.
   - Cut the acid emissive about 20% and add darker swirl contrast.
6. **The vacuole water surfaces are flat.** The cyan surface uses a low-frequency blob texture that reads as camouflage. The nutrient tank is a flat orange plate with no specular.
   - *Fix:* Use a scrolling dual normal map, a fresnel env reflection and a colour gradient by depth. Apply the same shader to the amber and olive tanks, and add suspended particles in the nutrient tank.
7. **The vacuole railings are cluttered.** Two concentric rails per tank create a moiré of railings at the overview scale.
   - *Fix:* Drop the inner rail, or halve the baluster count.
8. **The water tank has no label.** Nutrients and Waste are labelled, but the water tank is not. Add a "WATER" plate.
9. **The sky is still blown to white** in the eye-level shots (lysoB, serClose). Lower exposure about 0.15 and tint the horizon.

## Path to sign-off
- Fixing #1 and #2 lifts the SER to about 7.
- Fixing #3, #4 and #6 pushes the lysosomes and vacuoles past 8.
- Together these give a combined score of about 8.
