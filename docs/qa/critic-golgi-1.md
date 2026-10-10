# Critic Pass 1: Golgi Apparatus and Transport Vesicles

Reference: `reference/living-city.png`. Shots reviewed: v6 fuse/vesex/traffic, v7 overview/golgi/back, v8 golgi/street/examine.

## Scores (1–10)
| Axis | Score |
|---|---|
| Fidelity to reference | 6 |
| Materials / shaders | 4 |
| Lighting / glow | 4 |
| Surface detail | 4 |
| Geometric craft | 4 |
| Readability (overview / close-up) | 7 / 5 |
| Vibrancy / WOW | 5 |
| **Overall** | **4.5** |

From the overview, the Golgi works as a landmark: you can find it in one glance. Up close it looks like a stack of bubblegum pancakes melting onto a toy shop. It doesn't read as a premium diorama yet.

## Defects (most severe first)

1. **The sacs look like slabs, not cisternae.** Each layer is a flat top with a wobbly extruded rim (v8-examine). The reference has inflated, tube-like sacs with swollen rounded rims and clear air between layers. Fix: build each cisterna as a lofted, closed, flattened tube with a cross-section about 0.35 thick, a rim bulge of about 1.4x the centre thickness, and a 0.25–0.3 gap between layers. Curve the whole stack into a shallow crescent (about 25–35° of arc, cis side convex). Right now it's a straight pile, which looks like a blob from behind (v7-back).

2. **The undulation noise is too fine and looks like melting.** The rim wobble frequency is about 3x too high and the amplitude is random, so it reads as molten jelly. Fix: drop to 2–3 broad lobes per sac, use one coherent sine plus low-octave noise (freq about 0.6/unit, amp 0.15), and phase-offset each layer by about 0.4 rad so the layers nest instead of colliding. Remove the noisy normal map that produces glitter speckles across every surface (v8-street, v8-examine).

3. **The colour is one hot magenta with no value range.** The sacs, the building facade, the awnings, the signage and the apron are all the same pink, so the building disappears into the stack. Fix: shift the sacs to rose (about #E87DA6 base, #F7B8CF rim highlight, #B2416F in the crevices) and add a value gradient from bottom to top. Lower facade saturation by about 40%, or push it toward plum (#7A2E55) so the cream windows stand out. Add soft SSS or transmission to the sacs (thickness 0.4, attenuation pinkish) so the rims glow where light grazes them.

4. **The stack crushes the facility.** The stack takes up about 70% of the silhouette and hangs over the facade. In v7-back there's a dead black slab between the roof and the lowest sac. Fix: scale the stack to about 0.8x and lift it 0.5 onto visible support struts or a rooftop deck. Light the gap underneath with warm uplights (PointLight intensity 2–3, #FFD9A0, distance 6) and add AO, never black.

5. **Vesicles sit on the stack like loose gumballs.** The purple spheres are placed randomly on the top surfaces with no relationship to the sacs. Fix: bud them from the rims. Use metaball or smooth-union necks (neck radius 0.4x the sphere) on the trans face. Animate a pinch-off every 3–5 s that drifts toward the TRANS · SHIPPING dock. Keep sizes in a narrow band (0.18–0.24).

6. **Delivery traffic is missing.** There's one static forklift and a few boxes on the conveyors. The reference shows trucks and vans leaving the dock. Fix: add 3–4 animated box trucks or vans looping dock → road → membrane ports, plus more conveyor cargo (spacing 0.6, speed 0.5/s). Add parcel variety: tape strips, labels and 3 size classes.

7. **Vesicle material is flat.** The purple has weak fresnel, no inner cargo and no rim light. Fix: use MeshPhysicalMaterial with transmission 0.6, ior 1.35, clearcoat 1, iridescence 0.3, and an emissive rim at fresnel power 3 (#C79BFF). Put a faint glowing parcel silhouette inside. The docking pod in v8-street shows 3 overlapping spheres, which looks like ghosting or duplicate instances. Investigate it.

8. **Docking pods read as sci-fi UFO props.** The flat holographic UI rings with orange chevrons (v6-vesex) are off-style for an organic, toylike diorama. Fix: replace them with a soft lilac glow pool (radial gradient decal, opacity 0.35) and a bevelled lip on the base. Cut the chrome arcs from 4 to 2.

9. **The membrane ports are plain cylinders.** The v6-fuse port is an untextured chrome tube, and its glow lands as a flat additive smear on the pavers. Fix: add a ribbed collar, a bevel of 0.03 or more, and a fusion-pore ring that iris-opens when a vesicle docks. Cap the floor spill at a 1.5 radius.

10. **The lighting is overcast simulation light.** The white void behind the wall is shadowless and flat, and bloom barely fires. Fix: add a warm key (#FFE4C4, 2.5) and a cool fill (#9FB4FF, 0.6), set the bloom threshold to about 0.8 and strength to 0.6 on emissives only, enable SSAO/GTAO, and give the background a vignette gradient. The empty paver field in v6-traffic and v8-golgi needs props or decals.

## WOW Opportunities

1. **A visible cargo flow.** Show a glowing parcel entering CIS · RECEIVING, travelling up through the cisternae as a light pulse that shifts colour from layer to layer (pink to violet), then budding as a vesicle at the trans face. That teaches the biology and gives the eye something to follow.
2. **Golden-hour windows.** Animate the cream windows (flicker, silhouettes of workers walking past), and add volumetric light shafts spilling under the stack onto the dock at dusk.
3. **Bud and fusion close-up.** On examine, a vesicle pinches off with a jelly squash-and-stretch (scale 1.0 → 1.15/0.85 → 1.0 over 0.4 s), then fuses into a membrane port with a ripple ring and a particle burst.
4. **Living surface.** Give the sacs a slow peristaltic wave (period about 6 s) running along the stack, with an animated caustic sheen in the clearcoat, so the organelle breathes like the rest of the cell.
