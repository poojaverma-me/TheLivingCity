# Critic pass: Characters and Vehicles (life-1)

Bar: premium painted-miniature figurines and toy vehicles. Reference: tiny white-coat scientists and yellow delivery trucks.

| Axis | Score |
|---|---|
| Appeal / silhouette | 5 |
| Materials | 4 |
| Detail | 4 |
| Animation readability (from poses) | 4 |
| Scale consistency | 5 |
| Integration in scene | 6 |
| **Overall** | **4.5** (characters 4, vehicles 5.5) |

At the isometric gameplay distance (district, west, street shots) the crowd reads correctly: white specks with cast shadows, like the reference. It falls apart at close range, where the lineup, faces and vehicle shots show a 2015-era primitive kitbash rather than a painted figurine.

## Defects (most severe first)

1. **The "forklift" is a truck cab with a mast bolted on** (v8-veh). It has a full truck cab, door and mirror, plus an overhead guard floating above it. It is a hybrid that reads as a bug. *Fix:* use the proper small forklift from life-v7-west (seat, guard, counterweight) everywhere, and delete the cab variant.
2. **Every vehicle drives itself.** Truck cab windows are opaque slate panels with no interior and no driver, and the forklifts have empty seats. A toy diorama lives on its tiny drivers. *Fix:* add a seated half-body worker (hard hat, hands on wheel) and a tinted, slightly reflective glass with an interior silhouette.
3. **Placeholder green box vehicles** (west parking lot). They are untextured stacked cubes with no visible wheels and the wrong palette. *Fix:* replace them with fleet variants (yellow flatbed, a small van), or cut them.
4. **Primitive joint seams.** Arms are straight cylinders with visible shoulder spheres and a break at the elbow (Celia's tablet arm). Hands are mitten blobs. There is no neck, so cylinder heads sit on box shoulders. *Fix:* sculpt one continuous skinned body with sleeves that taper at the cuff, a short neck and a sculpted 4-finger hand. Bake AO into the armpit and under the collar.
5. **Lab coats are rigid tubes.** There is no lapel volume, no flare at the hem and no swing. In walk poses the legs poke out of a static cylinder like stilts. *Fix:* add a lapel or collar mesh, a hem flared about 15%, and 2 hem bones driven by stride phase. Add a subtle cloth normal map and a cool AO gradient so white is not flat paper.
6. **Idle pose is "zombie forearms".** Most idlers hold empty forearms horizontally. The wave is a straight, locked arm. *Fix:* relax the idle (arms at sides, slight elbow bend, weight shift), vary per agent, and give the props a purpose: clipboards, crates, flasks.
7. **Hair and hat assets are weak.** Curly hair is a cluster of glossy black spheres that reads as grapes or caviar. Red hair is a smooth helmet that reads as a red ball from behind (v6-back). The orange hard hat has a stray protruding nub. *Fix:* use sculpted clumped hair with a roughness of about 0.7 and an anisotropic hint. Fix the hat brim and ridge geometry.
8. **Stains read as holes.** Black blobs on the coats look like missing geometry. *Fix:* use a desaturated brown-grey with soft edges, or remove them.
9. **The hero is not distinct.** Celia shares her curly-hair and purple-glasses kit with crowd members (lineup and faces show duplicates). *Fix:* make her assets exclusive. Give her a unique silhouette (longer coat, scarf or bun, signature colour sash) and a subtle rim or outline when in view. The visitor's teal jacket works; keep it, but fix the boxy jacket top and the stray navy stripes that read as UV errors.
10. **Scale mismatch.** The truck cab is barely 1.3 times worker height (v8-veh), while the figures have roughly 5-head realistic proportions. The chibi truck and the semi-real human clash. *Fix:* either go chibi on the people (bigger heads, about 3.5 heads tall) or raise the cab to about 1.8 times worker height.
11. **Truck materials are flat.** The box body is one saturated yellow with thin strips, there are no panel seams or edge highlights, the tyres have no tread and the mirrors float. *Fix:* add bevelled panel lines, a slight clearcoat (clearcoat 0.6), tread normals, mirror arms, and a darker underside AO band. The cab shape, glowing headlights, chrome grille and CYTO EXPRESS livery are the best assets here; protect them.
12. **No body variety.** All agents share one height and girth and the same navy trousers. *Fix:* apply ±8% height and ±10% girth scale per agent, and use 4 trouser or shoe colours.

## Keep

- Toy-pill truck cab
- Pastel pillow cargo
- Contact shadows
- Visitor colour blocking
- Crowd density at district zoom (matches the reference)
