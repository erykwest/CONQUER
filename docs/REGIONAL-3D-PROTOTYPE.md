# CONQUER — Regional map 3D: global microcell-first experiment

**Branch:** \`3dregionmap\` · **Viewer:** \`lab/3dregionmap.html\`  
**Status:** working WebGL2 prototype, source-linked World Lab 2D, synthetic geometry/input regressions. Do not merge to production without real-browser performance/visual review.

## Design reference

Inspired conceptually by [Red Blob Games' Mapgen4](https://github.com/redblobgames/mapgen4): build a dense dual/Voronoi-like mesh first and use that foundation to form terrain, coastlines and outlines. Unlike Mapgen4, this experiment uses its own simple spatially local Voronoi clipper over a jittered triangular lattice. No code or external packages have been copied or vendored from Mapgen4.

The original 2D World Lab is still authoritative: 30 × 21 = 630 gameplay territories by default, one canonical Voronoi polygon per territory; game simulation, roads, rivers, adiacencies, selection and save schemas remain untouched. In particular we do **not** run the original quadratic global \`buildVoronoi\` on 12,600 gameplay cells.

## Updated procedural pipeline

1. **Generate the fine mesh first:** approximately \`630 × detail\` global microcell sites on a triangular, deterministically jittered lattice, for detail 8/20/40. For each site, clip against its two-ring neighbourhood, never against every site in the world. Generation is linear in the target site count with a small bounded neighbour set.
2. **Group into territories second:** use the canonical 2D polygons only to assign each fine site's owner, sampling a continuous, seeded 2D warp field before looking up the owner. Warp strength is adjustable from 0 to 100%. The resulting territory aggregates have irregular borders and coastlines made of actual shared microcell edges.
3. **Derive visual outlines:** a paired microcell edge with different territory owners becomes a 3D-view border; land/water owner changes become coastlines. Borders no longer trace the canonical coarse polygons in the 3D preview.
4. **Use actual colours from 2D:** \`ConquerRegion3DSnapshot().fills\` supplies the original World Lab's \`macroFill(macroId)\` output for each cell, including neutral and political colour treatment. The 3D terrain's top faces use those RGB values without applying the old alternative palette or a colour-correction curve. Hill/ridge side faces still receive shading.
5. **Populate regional vegetation:** reuse the original seven Builder forest SVG silhouettes exclusively in forest-owned fine aggregates, with 5× the old prototype sprite size and at least 10× the number (30–70 trees per forest macro). In swamp aggregates, use billboard sprites baked from the Builder's existing Blender \`reedBed\` and \`reedClump\` scatter meshes, with 10–30 reed beds per swamp macro and the same 5× regional size. Both are seed-deterministic.
6. **Present as fixed Builder-style isometry:** middle mouse (mouse3) drag pans, Shift+middle mouse drag rotates yaw around the screen-centre target, wheel zooms around the cursor. No change to camera pitch or height.

The \`1× Originale\` option deliberately uses original coarse macrocell geometry to support A/B comparison. At 8×/20×/40× the global microcell-first pipeline is used.

## Synthetic CPU benchmark

630 adjacent rectangular canonical territories, 30 × 21, 128 × 110 world units each, seed 1943, with representative sea/forest/hill/swamp/plain types. Numbers are for the latest pipeline, not the previous territory-local clipping algorithm. CPU timing varies by machine.

| Detail | Global visual subcells | Mesh triangles | Vertex buffer | CPU generation | Trees | Reeds |
|---|---:|---:|---:|---:|---:|---:|
| 1× canonical | 630 | 3,960 | 0.27 MiB | ~48 ms | 5,545 | 516 |
| 8× global | 5,183 | 32,234 | 2.21 MiB | ~602 ms | 5,545 | 516 |
| 20× global | 12,903 | 78,272 | 5.37 MiB | ~1,489 ms | 5,545 | 516 |
| 40× global | 25,551 | 153,987 | 10.57 MiB | ~2,876 ms | 5,545 | 516 |

Global micro Voronoi polygon areas cover the world extent to numerical tolerance. Microcell count is intentionally approximate, because the global site grid is sized by total world area, not split into exactly 20 sites per macro. The deforming owner field does not change the finite rectangular map bounds.

## Verification

- \`qa/regional-map3d-regression.cjs\`: area conservation, deterministic mesh and grouping, deformable borders and coastlines, palette conversion from 2D hex/HSL, finite GPU arrays, forest-only trees and swamp-only reeds, 5×/10× scaling.
- Script syntax and simulated renderer execution: model-based reed sprite construction, WebGL draw submission, border draw, regional forest/reed billboards, middle-mouse pan, Shift+middle yaw and wheel zoom.
- **Not yet established:** real browser screenshots, verified WebGL FPS/GPU profiling, low-end mobile memory/thermal behaviour or full visual art-direction approval. Static server or a Vercel preview is needed for real visual review.

## Visual limitations and future integration

- **This changes the preview's visual borders/coastlines, not simulation ownership.** There is no inverse mapping for clicking newly displaced edges yet. Do not migrate territory selection, pathfinding, game water barriers, saves or AI to this geometry without explicit gameplay remapping.
- Original manual river and mountain barrier paths still reference canonical topology. They are drawn over the new organic geometry and may not perfectly follow newly deformed territory edges. A shared semantic-to-visual edge mapping is a separate task.
- Trees and reeds are 2D billboards projected with the same fixed isometric camera as the mesh, not depth-tested volumetric tree meshes; scenery can overlap mountain faces incorrectly.
- The original map's outer rectangular domain remains the same; the **internal** region/biome boundaries are organic. Distinct sea/land borders are derived from aggregated microcells.
- A production renderer should cache meshes by seed/palette/warp revision, progressively LOD distant geometry, and eventually use worker/OffscreenCanvas and GPU sprite instancing rather than sorting and painting thousands of 2D billboards for every camera update.

## Preview

Serve the repository root over HTTP and open \`/lab/3dregionmap.html\` (do not use \`file://\`). In the left iframe, generate/edit the authoritative 2D map. The right pane detects the 2D revision, then builds its own global microcell mesh. Choose 8/20/40 detail, vary the deformation slider, and toggle tree/reed populations. The benchmark button reports CPU construction time (not GPU FPS).

**Conclusion:** the dense-microcell-first model allows much more organic cartographic contours without changing the canonical game grid. It is a promising experimental direction, but visual and GPU-level assessment is still required.
