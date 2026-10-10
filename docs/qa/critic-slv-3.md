# Critic Pass 3: Smooth ER, Lysosomes, Vacuoles

Shots reviewed: slv3-v3-overview, slv3-v3-ser, slv3-v3-serClose, slv3-v2-serStreet, slv3-v3-lysoTop and slv3-v3-vacClose. I compared them against the reference image and against critic-slv-2.

## Scores (round 2 in brackets)
| District | Score |
|---|---|
| Smooth ER | **6.3** (5.0) |
| Lysosomes | **7.9** (7.2) |
| Vacuoles | **7.9** (7.6) |
| **Combined** | **7.4 / 10. NOT signed off.** |

## Fixed since round 2
- The SER is now a bright lime colour and separates clearly from the trees in the overview (#2).
- The SER walls are thinner ridged sheets, and some of them sit raised on stilts.
- The lysosome portholes now glow with moving acid behind them (#4).
- The recycling arrows on the lysosome lid no longer overlap, and the acid no longer blows out to white. The swirls now have contrast (#5).
- The vacuole tanks now have ripples, a depth gradient and particles in the waste tank (#6).

## Remaining defects (most severe first)
1. **The SER is still a fence maze, not an organelle.**
   - It is made of separate S-shaped sheets with gaps between them.
   - Each sheet is a single wall. There is no tube and no inner channel (lumen), and the sheets are not see-through.
   - The sheet ends taper like leaves (serStreet), and the tops are rounded and soft like topiary (serClose).
   - It still sits alone on an empty paved area with no roads entering it. In the overview it is about half the size of the reference's SER.
   - *Fix:*
     - Join the segments into one continuous looping ribbon.
     - Build each wall as two sheets with a gap, closed by a lip along the top.
     - Make the walls partly see-through: `transmission` 0.3, `thickness` 0.5.
     - Cap the open sheet ends with half-round end caps.
     - Add a second tier at a height of 1.4.
     - Scale the footprint up 1.4× and run 2 road tendrils into the street grid.
2. **SER flow is missing.** The purple droplets sit scattered on the pavement. Animate them so they move along the top channel and into the P450 hoses.
3. **The lysosome emblem is washed out.** The pale-green arrows sit on a pale-green disc. Make the disc dark (`#163d22`) and keep the arrows emissive.
4. **The lysosome hull is still a uniform plastic green.**
   - Add grime or edge-wear roughness variation.
   - Remove the grey wedge-shaped plate under the left side (lysoTop).
5. **The vacuole railings still overlap.** Each tank still has two concentric rails (#7 is not fixed). Delete the inner rail.
6. **The vacuole tank surfaces still need work.**
   - The waste surface reads as camouflage blotches. Cut the blob contrast by 40%.
   - The orange nutrient surface is still a flat colour plate. Give it the same reflective (fresnel) edge as the water tank.
7. **The water tank still has no label (#8).** Add a "WATER" plate facing the camera.

## Path to sign-off
- Fixing #1 and #2 brings the SER to about 7.5.
- Fixing #3 to #6 brings the lysosomes and vacuoles to about 8.3.
- Together these give a combined score of about 8.
