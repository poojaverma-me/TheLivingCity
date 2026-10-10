# Critic Report: Benchmark District (bench2, reviewing bench4 shots)

Scope: nucleus, rough ER and membrane. The other districts are treated as context only. The cream background and the small overview framing are not scored.

## Scores (round 1 in brackets)
- **Fidelity: 6** (3). The amphitheater RER, cutaway dome, gate road and control room now read like the reference.
- **Materials/shaders: 4** (3). The dome and membrane are still opaque. The ribosomes are plastic.
- **Lighting/shadows: 6** (2). Shadows and AO now exist. Contact grounding is still weak.
- **Textures/surface: 5** (3).
- **Geometric craft: 5** (4).
- **Composition/readability: 6** (3).
- **Vibrancy/WOW: 6** (4).
- **Overall: 5.5** (3). This is a real jump, but it reads as a "good indie" scene, not premium. The two glass heroes still are not glass.

## Round-1 status
- **Fixed:** floor scale and lanes, RER thickness and slat grooves, poles through the control room, screen repetition, membrane UV streaks, AA and bloom.
- **Partial:** shadows and AO, ribosome placement, pore variety, portals, camera.
- **Not fixed:** dome transmission, membrane transmission, crumple-foil membrane lip and seam, thick cutaway lip, workers, interior benches, stray specks, tilt-shift.

## Defects (most severe first)
1. **The dome and membrane are still opaque (nucleus, street, membrane, overview).**
   - The reference's two signature materials are glassy violet and frosted cyan. Here the dome is matte lavender paint.
   - From the street, the dome becomes a saturated "planet" with a cheap neon-pink fresnel band, and its inner face is a starfield nebula (interior shot). That is a different art direction.
   - **Fix:** MeshPhysicalMaterial with transmission 0.55, thickness 0.8, roughness 0.08, clearcoat 1, iridescence 0.25 and attenuationColor #7b4fd0. Delete the nebula/star texture on the backface and render the backface with the same glass material. Clamp the fresnel emissive to ≤0.3, tinted violet rather than pink.
   - **Fix for the membrane:** transmission 0.6, attenuation #9fc6e0, and a soft lipid-bubble normal map.
2. **The ribosomes are still "measles" (ribo, street, nucleus).**
   - The colour is pure saturated red-orange with about 4× size variance. Many are half-sunk hemispheres clipped into the walls.
   - Several float in the gaps between walls, and some sit on the gate road and the handrails (street shot, centre).
   - **Fix:** use MeshSurfaceSampler on the wall faces only, exclude road and rail meshes, and offset along the normal by r×0.6. Clamp the scale to 0.85–1.15. Use colour #9e2236 at roughness 0.35, with a lighter #c84a5a top highlight via vertex AO. Arrange them in rows along the slat grooves.
3. **RER blade ends and the overview "comb" (ribo, overview).**
   - Knife-thin, single-sided sheets with spiked tips still sit between the tubes (ribo shot, centre).
   - At overview distance, the tiers break into dozens of radial fin segments that look like a turbine or a comb, not continuous stacked walls.
   - The royal blue #2a4fd8 is the loudest colour in the cell and fights the dome.
   - **Fix:** delete the sheet geometry and cap every wall end with a half-cylinder. Merge the segments into continuous arcs, with only 3–4 deliberate breaks. Desaturate to #4a6fb5 and make the top faces about 20% lighter.
4. **The membrane lip is frosting with a seam (membrane, ribo).**
   - The crumple noise reads as tinfoil or snow.
   - A dark hard seam line runs where the lip meets the wall.
   - A flat pale skirt band sits at the floor junction.
   - **Fix:** use one continuous lathe/extrude profile with a filleted top, so there is no seam. Apply a low-frequency bubble normal (scale 0.1, strength 0.25). Add a soft AO gradient where it meets the floor.
5. **The cutaway lip and collar are toothpaste (nucleus).** The pale lavender horseshoe is still about 3× too thick and unlit-looking.
   - **Fix:** thin it 60%, give it a metallic trim (metalness 0.8, #c9b6ff), and add a dark inner groove.
6. **The interior is still off-style (interior).**
   - The benches are grainy white styrofoam slabs, and there are no workers.
   - The screen wall's back is a brown cardboard slab.
   - Two blue light-blob sprites sit on the floor like lens dirt.
   - The neon Tron grid persists.
   - **Fix:** bevelled consoles with chairs; 8–12 lab-coat workers (instanced, idle-animated); a navy brushed-metal backing; delete the floor sprites, or turn them into recessed floor lamps; grid emissive ×0.4 plus a warm 3200K overhead pool.
7. **Hot sprite on the dome (nucleus, overview).** A white-orange star flare sits on the upper-left shell like a dead pixel.
   - **Fix:** remove it, or put it inside the glass as a soft bloom point at intensity ≤1.
8. **The grounding is weak (overview).** The cell's contact shadow is barely visible, so the cell still floats on the white background.
   - **Fix:** ContactShadows at opacity 0.45, blur 2.5, scale 1.15× the cell footprint, plus a tighter dark core under the rim.
9. **The portals are still pipes (overview).** The ports are plain cylinders and one grey box (top-left, and bottom-left). The reference shows recessed glowing portholes.
   - **Fix:** recess them into the wall, add bevelled torus rims, use an emissive violet core at intensity 2 with bloom, and place 5 of them evenly.
10. **Camera and particles.** The overview is still about 55° elevation, so the dome's height and the RER tiers are flattened. White specks still float in the sky (street, membrane).
    - **Fix:** use 38–42° elevation at FOV 28. Clip particles to the inside of the membrane volume.

## WOW opportunities
1. **See-through nucleus.** With real transmission, the glowing screens and the DNA helix bleed violet light through the shell and caustic-tint the inner RER tiers. This is the single biggest step toward premium.
2. **Protein assembly lines.** Ribosomes pulse, and amino-acid chains crawl along the slat grooves into vesicle trucks waiting at the gate road.
3. **mRNA couriers.** Glowing ribbons arc out of the nuclear pores (make the pores emissive), dock on the ribosomes and trigger their pulse, so the cause-and-effect is readable from the overview.
4. **Tilt-shift diorama reveal.** Use a bokeh DOF focused on the dome (focal band about 15% of the frame), a slow 3/4 orbit, and a breathing membrane with a sliding iridescent sheen. Together these sell "miniature photograph" in the first three seconds.
