# CONQUER — 3D regional map visual experiment

**Branch:** 3dregionmap (from main, 16 November 2026)  
**Preview:** lab/3dregionmap.html  
**Status:** runnable WebGL2 prototype + synthetic geometry benchmark; visual browser validation on representative GPUs remains pending. Do not merge as production renderer.

## Hypothesis

The canonical World Lab deliberately uses one Voronoi cell per territory. In CONQUER_WORLD_LAB.html, buildVoronoi() clips each site against every other site (quadratic). At the default 30 x 21 territories there are 630 original sites. Replacing each with 20 gameplay sites would increase them to 12,600 and raise pairwise site comparisons by approximately 400x; worse, it would change adjacency, rivers, selection, battle and save semantics. This is deliberately NOT implemented.

The experiment keeps the exact original regional polygons and builds 1/8/20/40 *visual-only* clipped Voronoi polygons **independently inside each territory**, with a single Lloyd relaxation pass. As a result, there are 630 independent local tessellations, each at most 40 sites, not one global N=12,600 tessellation. Polygon areas add up to the original territory areas and the source game remains unchanged.

## What has been implemented

- Read-only CONQUER_WORLD_LAB.html bridge with revision counter, original cell polygons, biomes, river edges, impassable mountain chain edges. The existing generation, simulation, UI, and persistence are untouched (apart from a link and the bridge).
- Side-by-side viewer with the original editable 2D World Lab in an iframe and a 3D WebGL2 landscape at right.
- 3D terrain mesh per visual subcell, smooth heights within each original polygon, independent low-poly mountain peaks and actual barrier ridges using the original mountain-edge definitions. The mesh stays static for zoom/orbit.
- Reuse of all seven Builder SVG tree silhouettes, transformed into cartographic green-canopy screen-aligned billboards. Source SVG files are not modified; their existing 3D Builder rendering model also uses billboards.
- Water at a lower elevation, optional displayed territory boundaries, original manual + auto-generated river-edge overlays, adjustable camera yaw, pitch and zoom.
- A/B detail selector at 1, 8, 20 and 40 visual subcells/territory, local CPU mesh-generation time, GPU upload CPU time and CPU draw submission time. The A/B 1x/20x benchmark can be rerun for the current source map.

## Preliminary reproducible synthetic benchmark

Environment: V8 isolated CPU evaluation, synthetic 30 x 21 grid of 630 convex territories, 1943 seed, the same biome distribution rule across runs. **Not** a frame-rate measurement or a browser/GPU certification.

| Visual detail | Visual polygons | Approx triangles | Vertex buffer | CPU generation |
|---|---:|---:|---:|---:|
| 1x | 630 | 3,960 | 0.27 MiB | 36 ms |
| 8x | 5,040 | 25,924 | 1.78 MiB | 353 ms |
| 20x | 12,600 | 67,506 | 4.64 MiB | 1,461 ms |
| 40x | 25,200 | 138,860 | 9.53 MiB | 4,836 ms |

These numbers were measured before adding canonical mountain-ridge cones; a recheck with an example barrier produced 67,534 triangles, 4.64 MiB and about 1,857 ms at 20x. CPU timing depends strongly on the JS runtime, machine, source polygon complexity and visual density.

## Verification

- Script syntax: checked for all new .js/.cjs files.
- Local tessellation: area preservation tested on rectangular and irregular convex polygons at 1, 8, 20, and 40 sites, with zero material area error.
- Determinism: same seed + source snapshot + detail produces the same vertices, trees and peaks.
- Synthetic stress: 630 source territories, 12,600 visual polygons and finite vertex data.
- Automated test checked in: node qa/regional-map3d-regression.cjs.
- **Not yet measured:** actual rendered WebGL2 FPS, GPU time, mobile memory, browser screenshots, real-world browser load times, GPU crash recovery beyond the displayed fallback notice. The viewer will fall back to the original 2D editor if WebGL2 is unavailable; it does not itself render a Canvas-only 3D replacement.

## How to try

1. Serve the repository with a static HTTP server (for example, python -m http.server 4193 in the repo root). Do not use file:// because the iframe and Builder SVG fetches require same-origin HTTP.
2. Open http://localhost:4193/lab/3dregionmap.html, or launch the preview from the World Lab sidebar.
3. Generate a map in the left iframe (changing seed/terrain is supported). The right pane detects the revision change and rebuilds only the *visual* mesh.
4. Compare 1x versus 20x and run the benchmark button. Move camera sliders: zoom and rotation are GPU uniform updates; they do not regenerate Voronoi geometry.
5. Inspect low-end devices and GPU load before recommending any migration.

## Known limits and next steps

- This is a regional **3D visual layer**, not a conversion of simulation topology to 3D.
- Forest tree graphics are billboard sprites, not volumetric 3D meshes. Overlays do not yet have per-tree occlusion against mountain polygons.
- The renderer does not yet render settlements, army agents, roads, ports, nation colors, or player-selection picking in 3D. Keep the 2D source map for these functions.
- Relief height here is cartographic and procedural, not sourced from elevation data in the Builder. Matching persistent hills and combat terrain across scales requires a shared world elevation field.
- At 20x the startup CPU generation is material (~1-2s synthetic). Cache meshes by seed/terrain revision, add progressive detail by zoom and frustum culling, batch sprites into GPU instancing, and use a web worker/OffscreenCanvas if this becomes production.
- Do not run the original global Voronoi routine on 20x gameplay cells. Preserve original territory IDs, hydrology, adjacency, actions, pathfinding, saves, and transition to the local builder.
- In production, consider making 8x the distant LOD, 20x only near the camera and 1x for strategic silhouettes, rather than defaulting to 20x everywhere.

**Recommendation:** Technically feasible with a single visual 3D map layer on top of original Voronoi gameplay data. The current prototype establishes the data boundary and CPU scaling, but does not yet establish full visual quality or device-level performance.
