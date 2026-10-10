# Critic: Whole World, Round 6 (r6 shots vs reference)

**Verdict: 6.6/10. Not signed off.** Two areas are now strong: the district layout matches the reference almost exactly, and street-level vignettes (Golgi plaza, vacuole tanks, mito pits) are genuinely charming. But the frame is dominated by its two weakest assets: an opaque inflatable-pool membrane and a pool-noodle RER bullseye. Every surface shares one inflated-glossy-plastic look. That reads as "polished mobile toy", not "premium miniature".

## Fixed since last rounds
- RER fins merged into continuous rings.
- City ground lifted; roads now read at overview.
- Dark window panes exist.
- Forklift and truck drivers added.
- Vacuole double rail gone; waste camo calmer.
- Mito cristae have flat lit caps; rotors are lobed.
- Golgi has a wavy silhouette with air gaps.
- SER walls are double-skinned with a lumen.

## Still open
- Dome flare sprite (nucleus).
- No workers in the control room.
- Neon floor grid.
- Ribosome size and float scatter.
- Golgi tire stack from the back.
- SER leaf-tip ends and bald apron.
- Lysosome emblem contrast.
- Weak cell contact shadow.

## Scores
| District | Score |
|---|---|
| Nucleus + RER | 6 |
| Membrane | 4 |
| Golgi + vesicles | 7 |
| Mitochondria | 7.5 |
| SER | 6 |
| Lysosomes | 7.5 |
| Vacuoles | 8 |
| City fabric | 6.5 |
| Characters / vehicles | 6 |
| **Overall world** | **6.6** |
| **Overview composition vs reference** | **6.5** |

## District defects (top 3 each, below 8)

**Nucleus + RER (6)**
1. **The RER is pool noodles (rerClose, nucleus).** Fat round tubes have a cream specular stripe and no slat grooves. In the overview, the perfect bullseye reads as an archery target.
   - Flatten the wall tops to a 0.04 bevel and add vertical groove normals.
   - Vary ring radius ±6% with 2–3 offset breaks.
   - Desaturate to #4a6fb5.
2. **The dome is opaque lavender plastic with a hot orange flare sprite (nucleus, upper-left).** The cutaway lip is still a thick toothpaste horseshoe.
   - Delete the sprite.
   - Fake the glass (see Global #1).
   - Thin the lip 60% and give it metallic trim.
3. **The ribosomes are measles, and the control room is empty (rerClose, interior).** The red-orange spheres vary about 2× in size and float mid-channel. The 20 chairs have zero scientists. The inner shell's "cheerio" rings and the Tron grid are off-style.
   - Use MeshSurfaceSampler on wall faces only, with scale 0.85–1.15 and #9e2236.
   - Seat 10 idle-animated workers.
   - Set grid emissive ×0.4.

**Membrane (4)**
1. **It is an inflatable kiddie-pool ring (overview).** It is opaque, matte baby-blue and about 2× too thick. The reference is a thin, frosted, see-through double wall.
   - Cut the lip radius by 40%.
   - Use fresnel-alpha fake glass: opacity mix(0.35, 0.9, fresnel), depthWrite off, and an inner backface pass tinted #9fc6e0.
2. **The surface is a golf ball (membrane, ser, lysovac).** A high-frequency dimple normal causes moiré, and an orange-hot specular smear burns on top.
   - Use a low-frequency lipid-bubble normal (scale 0.1, strength 0.25) plus mip bias.
   - Remove the warm specular, or clamp its intensity.
3. **The portals are weak.** There is a grey box door and a violet glow sprite bleeding outside the silhouette (overview, left edge).
   - Place 5 recessed porthole rings with a bevelled torus and an emissive core clipped to the wall.

**Golgi + vesicles (7)**
1. **It is still a tire or pancake stack from behind (golgiBack).** The sacs are identical, with dowel pegs between the layers.
   - Scale the top two sacs to 0.85 and 0.75.
   - Grade the colour from #B2416F to #F7B8CF.
   - Add a fresnel rim at 0.25.
   - Hide the pegs inside the sacs.
2. **The vesicles are lollipops.** Purple balls sit on poles and lamp posts (golgiBack, ringroad).
   - Tether them to sac rims, truck beds or membrane ports, or float them on a slow bob with a shadow blob.
3. **There are stray elements.** A green cable arcs from the top sac to a tower, a lumpy green blob sits on the top sac, and pink pylons pierce through the sacs (golgi).
   - Cull or reroute them.

**Mitochondria (7.5)**
1. **Bloom overdrive (mitoClose).** The crista caps smear into neon tubes.
   - Set the cap emissive to ≤0.6.
   - Set the bloom threshold to 0.85 and radius to 0.4.
2. **The matrix floor is flat brown mud.**
   - Add a dark glossy fluid plane with slow caustic UV scroll and particle drift.
3. **There is a stray yellow ringed orb beside the pod (mito).**
   - Remove it, or seat it as an ATP pickup on a plinth.

**SER (6)**
1. **The ends are leaf or banana peels with vein decals (ser).**
   - Use half-round end caps.
2. **It is a hedge maze on a bald apron.** No roads enter it, and it is still undersized versus the reference.
   - Scale it ×1.3.
   - Add an apron, pipe racks, and 2 road tendrils.
3. **The colour is olive gummy-worm and opaque.**
   - Lift it to #a8d84a.
   - Make the wall top 0.8 alpha with a fresnel rim.
   - Run lipid droplets along the channel.

**Lysosomes (7.5)**
1. **The emblem is green arrows on green acid.**
   - Use a dark #163d22 disc.
2. **The hull is uniform plastic.**
   - Add edge-wear roughness and AO bands.
3. **There is no acid steam or vent glow.**
   - Add 2 soft rising sprites per drum.

**City fabric (6.5)**
1. **Sign text is truncated everywhere:** "AR PORE CHECK", "T PRESS · APOP", "IN PIT · ENDOCY", "DN: GRAPEFRUIT", "WATEI".
   - Auto-fit with `measureText`: shrink the font, then widen the board.
2. **The buildings are toy boxes with big blank walls** (street: the white tower, the Gene Lab upper storey).
   - Add storey lines, pilasters, and 3 new silhouettes.
3. **The overview south half is Lego clutter.** There are about 25 yellow trucks and no hierarchy.
   - Halve the parked trucks.
   - Make one tree-lined ring boulevard.
   - Add 4 lighter radial avenues.

**Characters / vehicles (6)**
1. **The control room and labs are unpopulated.** The reference's density of scientists at the hero spots is missing.
2. **There is no body or trouser variety.**
   - Apply ±8% height and use 4 trouser colours.
3. **The truck body is flat yellow.**
   - Add panel lines, clearcoat 0.6, and tyre tread.

## Overview vs reference
The layout is correct: every organelle is in the right quadrant. Four things are wrong:
- **Camera angle:** the camera is about 55° (reference is about 38°), so the dome and the RER tiers flatten.
- **Dome scale:** the dome is about 20% too small and too short.
- **Membrane:** it dominates the frame.
- **No focal hierarchy:** everything is equally saturated and sharp. The reference has a warm glow core, depth falloff and a translucent rim.

## Top 5 world-wide WOW improvements
1. **One fake-glass shader for the membrane, dome and vesicles** (transmission is gone, so cheat it).
   - Use fresnel alpha, an env-map reflection, a tinted backface pass, a thin iridescence ramp and depthWrite off.
   - Paired with the thinner membrane, this alone moves the overview roughly +1.5.
2. **Photographic diorama post.**
   - Use a 38–40° camera at FOV 28 and scale the dome ×1.2 in Y.
   - Add tilt-shift DOF (depth-based gaussian, focus band about 15%), a soft vignette and a warm-core / cool-rim LUT grade.
   - Add ContactShadows at 0.45 opacity under the cell.
3. **Kill the "inflated plastic" monoculture.**
   - Use a per-material roughness-noise map and a micro-bevel normal.
   - Add edge-wear masks and stronger AO (N8AO/GTAO).
   - Give the RER, membrane, Golgi and SER distinct surface languages (grooved, bubbled, satin, translucent).
4. **Readable life at overview scale.**
   - mRNA ribbons leave the pores and reach the ribosomes, which pulse.
   - Vesicle trucks run along the ring boulevard into the Golgi; crista fire columns rise above the rim.
   - Motion is what sells a "living" city in the first 3 seconds.
5. **Hygiene sweep.** Fix sign auto-fit, delete flare sprites, clamp bloom per material, and remove stray orbs and cables. Add one hero-crowd pass: workers in the control room, Golgi dock and mito pier.
