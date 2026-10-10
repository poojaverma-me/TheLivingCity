# Critic Report: Benchmark District (bench1)

Scope: membrane rim, nucleus and rough ER only. Missing districts are not penalised.

## Scores
1. **Fidelity to reference: 3/10.** The nucleus is too small and pushed against the top rim. The RER is a flat stadium of thin rings, not tall tiered cisternae. The membrane is a low, opaque grey gutter instead of a tall glassy wall.
2. **Materials & shaders: 3/10.** Everything reads as one matte plastic. Nothing is translucent where the reference is glassy (the dome and the membrane), and the satin clearcoat is missing.
3. **Lighting & shadows: 2/10.** No key-light shadows, no contact shadows and no AO. The cell floats on the white background. Every surface gets the same flat ambient light.
4. **Textures & surface detail: 3/10.** UVs stretch into vertical streaks (RER walls, membrane wall, dome interior). The floor bricks are oversized and blotchy, and a grungy concrete texture clashes with the clean style.
5. **Geometric detail / craft: 4/10.** The nucleus dome has some craft (ribs, pores, cutaway). The rest is thin sheets, open ends and primitive canisters.
6. **Composition & readability: 3/10.** The overview camera is too high and steep. The hero sits on the top edge, and the ribosome speckle turns the RER into visual noise.
7. **Vibrancy & WOW: 4/10.** The colour is saturated but not rich: royal blue plus pure red dots is a "measles" look, not a premium diorama. Nothing glows with intent.
8. **Overall: 3/10.** It still reads as a simulation or tech demo. It is not the reference's miniature-diorama photograph.

## Defects (most severe first)

1. **No grounding or shadows anywhere (all shots).** In the overview the cell has no contact shadow on the white background, and in the street shot the RER walls cast nothing on the floor. This kills the miniature/tabletop illusion completely.
   **Fix:**
   - Add one warm directional key (about 45° elevation, upper-left) with PCFSoft/VSM shadows on all RER, dome and membrane meshes.
   - Add a cool hemisphere fill.
   - Add SSAO/GTAO (N8AO) at radius ~0.5–1 world unit, intensity ~1.5.
   - Put a large blurred contact-shadow plane (ContactShadows, opacity 0.35, blur 3) under the whole cell.

2. **Ribosomes float in mid-air and read as noise (bench1-ribo, overview).** The red spheres hang between the walls instead of sitting on them, and their random density turns into red static at overview distance.
   **Fix:**
   - Scatter only on the wall surfaces (MeshSurfaceSampler), offset along the normal by 0.5× the radius, in loose rows.
   - Cut the count by about 60% and shrink them by about 30%.
   - Shift the colour to the reference's darker crimson/maroon (#a3203a range) with a satin highlight.
   - LOD them to a baked dot texture on the walls at overview zoom.

3. **The RER has the wrong silhouette and is paper-thin (overview, street, ribo).** The reference shows tall, stacked, slatted blue walls rising in an amphitheater around the nucleus. Here they are low rings with grey caps bent like single-sided sheets (ribo shot, the end caps), with open hollow arches at the ribbon ends.
   **Fix:**
   - Extrude the walls with real thickness (≥0.15 units) and rounded bevels.
   - Close the ends with capped rounded profiles and delete the grey sheet caps.
   - Raise the wall height about 2× and step the heights up toward the nucleus to form tiers.
   - Add horizontal slat grooves (normal map) like the reference.
   - Desaturate toward steel blue (#4a6fb5), with lighter top faces.

4. **The membrane is opaque grey with streaked UVs (membrane, overview).** The top looks like crumpled foil or frosting, the inner wall has vertical smear streaks, and there is a hard seam where the top meets the wall.
   **Fix:**
   - Use MeshPhysicalMaterial with transmission 0.6–0.8, thickness 1.5, IOR 1.35, attenuationColor pale cyan, clearcoat 1 and roughness 0.15.
   - Replace the crumple noise with a soft, large-scale lipid-bubble normal map (low amplitude).
   - Use triplanar mapping or regenerated UVs to kill the stretching.
   - Raise the wall height about 1.5× and fillet the top edge.

5. **The nucleus dome is opaque matte lavender (nucleus, street).** The reference dome is translucent violet glass. The cutaway lip is a thick, toothpaste-like horseshoe, and the uniform pores look like buttons.
   **Fix:**
   - Give the dome shell transmission (~0.5), roughness 0.1, clearcoat 1 and iridescence 0.3.
   - Darken the fresnel edge toward deep violet (#5b2a9c).
   - Thin the cutaway lip by about 60% and give it a crisp metallic trim.
   - Vary pore size by ±30%, make them recessed with a faint emissive inner glow, and cluster them.

6. **Floating artifacts and intersections (nucleus, street, interior).**
   - A cyan halo ring and a thin grey ring orbit through the dome geometry.
   - Two vertical poles stab through the control room in front of the screens.
   - A white blob sits on the upper-right dome surface.
   - Random white specks float in the sky in the street shot.

   **Fix:** delete the outer grey ring, or seat it on a mount. Move the halo inside the shell. Hang the nucleolus sphere from the dome apex rather than from floor poles. Keep particles inside the cell volume and below horizon height.

7. **The floor is mis-scaled and dirty (street, overview).** The bricks are about half the road width, which makes the nucleus look tiny. Pale blotches read as frost or dirt, and the overview shows flat empty blue-grey.
   **Fix:**
   - Scale the tiles down about 3×.
   - Swap the blotch noise for subtle per-tile hue/roughness variation.
   - Warm the floor toward the reference's cool grey (#8d9bb0).
   - Add painted road lanes and kerbs leading from the nucleus gate.

8. **The control-room interior is off-style (interior).**
   - Five screen textures are tiled in obvious repetition.
   - The grimy concrete wall clashes with the clean style.
   - The white benches are featureless blobs, and there are no workers.
   - The neon Tron grid departs from the reference's warm lit room.
   - A hot orange specular blotch sits on the floor (bottom centre).

   **Fix:**
   - Use 15+ screen variants with per-screen UV scroll animation.
   - Replace the concrete with brushed dark-navy panels.
   - Model consoles with chairs and keyboards.
   - Add about 10 tiny workers in white lab coats.
   - Tone the grid emissive down by 50%, with a warm overhead pool light.
   - Clamp the specular on the floor material (roughness ≥0.35).

9. **The overview camera and composition are wrong (overview).** The view is too top-down (about 60°), and the nucleus is jammed against the top rim, occupying about 25% of the width against about 35% in the reference.
   **Fix:** set camera elevation to about 35–40° in a 3/4 view, FOV about 30 (telephoto diorama). Move the nucleus about 10% inward and scale its district up about 1.3×.

10. **The membrane portals are placeholder primitives (overview, bottom and left edges).** The grey boxes and canisters look like debug geometry, and only one purple glow is visible.
    **Fix:** use beveled porthole tunnels with purple emissive cores (bloom threshold 0.9, intensity 1.2) and inner rings, about 4–6 of them evenly around the rim as in the reference.

11. **There is no post stack and it shows (all shots).** Edges are flat, and the thin ring edges alias and moiré in the overview.
    **Fix:**
    - Use ACES or AgX tonemapping at exposure about 1.1.
    - Add selective bloom on the emissives.
    - Add subtle tilt-shift DOF (diorama cue) in the overview.
    - Use SMAA or MSAA 4×.
    - Add a gentle vignette and a +10% vibrance LUT.

## WOW opportunities
1. **Glass nucleus with a living interior.** Make the dome truly transmissive so the glowing control room, the nucleolus and the DNA helix read *through* the shell from the overview, with caustic light spill onto the RER tiers.
2. **Protein assembly lines.** Ribosomes pulse and extrude glowing amino-acid chains that slide along the RER "highways" into vesicle trucks heading to the rim.
3. **mRNA couriers.** Glowing ribbon packets exit the nuclear pores in arcs and dock onto the ribosomes, giving visible cause and effect.
4. **Breathing membrane.** A slow, subtle vertex undulation plus a moving iridescent sheen on a transmissive bilayer, with channel portholes that flare purple as cargo passes.
5. **Tilt-shift reveal.** An opening dolly from macro DOF on a single worker out to the full 3/4 diorama, with soft studio shadows settling in. Sell the miniature in the first three seconds.
