# CONQUER — Regional map 3D: global microcell-first experiment

**Branch:** \`3dregionmap\` · **Viewer:** \`lab/3dregionmap.html\`  
**Status:** working WebGL2 prototype, source-linked World Lab 2D, synthetic geometry/input regressions. Do not merge to production without real-browser performance/visual review.

## Design reference

Inspired conceptually by [Red Blob Games' Mapgen4](https://github.com/redblobgames/mapgen4): build a dense dual/Voronoi-like mesh first and use that foundation to form terrain, coastlines and outlines. Unlike Mapgen4, this experiment uses its own simple spatially local Voronoi clipper over a jittered triangular lattice. No code or external packages have been copied or vendored from Mapgen4.

The original 2D World Lab is still authoritative: 30 × 21 = 630 gameplay territories by default, one canonical Voronoi polygon per territory; game simulation, roads, rivers, adiacencies, selection and save schemas remain untouched. In particular we do **not** run the original quadratic global \`buildVoronoi\` on 12,600 gameplay cells.

## Updated procedural pipeline

1. **Generate the fine mesh first:** approximately \`630 × detail\` global microcell sites on a triangular, deterministically jittered lattice, for detail 8/20/40. For each site, clip against its two-ring neighbourhood, never against every site in the world. The new **seeded weighted Voronoi/power diagram** uses 30% position jitter and a bounded per-site weight: the distribution has smaller and larger microcells, with the largest approaching **200% of the former mean microcell area** (not twice the linear dimensions). Other cells shrink to conserve total world area, without changing the number of original gameplay territories or the detail target. Generation remains linear in the target site count with a small bounded neighbour set.
2. **Group into territories second:** use the canonical 2D polygons only to assign each fine site's owner, sampling a continuous, seeded 2D warp field before looking up the owner. Warp strength is adjustable from 0 to 100%. The resulting territory aggregates have irregular borders and coastlines made of actual shared microcell edges.
3. **Derive visual outlines:** a paired microcell edge with different territory owners becomes a 3D-view border; land/water owner changes become coastlines. Borders no longer trace the canonical coarse polygons in the 3D preview.
4. **Use actual colours from 2D:** \`ConquerRegion3DSnapshot().fills\` supplies the original World Lab's \`macroFill(macroId)\` output for each cell, including neutral and political colour treatment. The 3D terrain's top faces use the same base RGB values, with subtle deterministic brightness modulation restored on sea, lake and hill microcells only. Plain, forest and swamp stay exactly at their original 2D RGB values. Hill/ridge side faces still receive shading.
5. **Populate regional vegetation:** reuse the original seven Builder forest SVG silhouettes exclusively in forest-owned fine aggregates, with 2.5× the old prototype sprite size (half of the preceding 5× version) and at least 10× the number (30–70 trees per forest macro). In swamp aggregates, use billboard sprites baked from the Builder's existing Blender \`reedBed\` and \`reedClump\` scatter meshes, with 10–30 reed beds per swamp macro and unchanged 5× regional size. Both are seed-deterministic.
6. **Rebalanced relief (latest):** each hill territory generates **2–5** flat-topped, seven- to nine-sided truncated-pyramid mesas, distributed with a seeded separation heuristic. Relative to the earlier 5× frustum, each mesa has **50% XY footprint radius** and **20% Z height**. Mountains along authored ridges retain **200% of the earlier base XY radius** and **3× the earlier number of summits**, but their **Z height has now been halved** while retaining a snow cap above **2/3 of each peak's current height**. Every ridge-group spawns three staggered summits. Distinct mountain and hill counters remain; gameplay topology is unchanged.
7. **Rivers follow organic territory borders:** manual river macro pairs use the matching shared microcell seams in the current visual mesh; automatically generated canonical river edges are snapped to a shortest weighted subpath on the corresponding deformed pair boundary. Only existing paired 3D border edges can be drawn as river segments, preventing straight canonical river lines from cutting across territories. Unmatched river edges are reported in the preview diagnostics and omitted rather than invented. This is a visual mapping only; authoritative river gameplay data and saves remain unchanged.
8. **Present as fixed Builder-style isometry:** middle mouse (mouse3) drag pans, Shift+middle mouse drag rotates yaw around the screen-centre target, wheel zooms around the cursor. No change to camera pitch or height.

The \`1× Originale\` option deliberately uses original coarse macrocell geometry to support A/B comparison. At 8×/20×/40× the global microcell-first pipeline is used.

## Synthetic CPU benchmark

630 adjacent rectangular canonical territories, 30 × 21, 128 × 110 world units each, seed 1943, with representative sea/forest/hill/swamp/plain types. Numbers are for the latest pipeline, not the previous territory-local clipping algorithm. CPU timing varies by machine.

| Detail | Global visual subcells | Mesh triangles | Vertex buffer | CPU generation | Trees | Reeds |
|---|---:|---:|---:|---:|---:|---:|
| 1× canonical | 630 | 9,129 | 0.63 MiB | ~95 ms | 5,545 | 516 |
| 8× global | 5,198 | 37,466 | 2.57 MiB | ~876 ms | 5,545 | 516 |
| 20× global | 12,892 | 83,386 | 5.73 MiB | ~1,999 ms | 5,545 | 516 |
| 40× global | 25,574 | 159,270 | 10.94 MiB | ~4,205 ms | 5,545 | 516 |

With the updated weighting, the synthetic 20× map has microcell areas of about **46% at the 5th percentile**, **149% at the 95th percentile**, and up to **~200% of the original reference area**, while their sum equals the entire map area to numerical tolerance. Global micro Voronoi polygon areas cover the world extent to numerical tolerance. Microcell count is intentionally approximate, because the global site grid is sized by total world area, not split into exactly 20 sites per macro. The deforming owner field does not change the finite rectangular map bounds.

## Verification

- \`qa/regional-map3d-regression.cjs\`: area conservation, deterministic mesh and grouping, deformable borders and coastlines, palette conversion from 2D hex/HSL, finite GPU arrays, forest-only trees and swamp-only reeds, 2.5×/10× forest and 5×/10× marsh scaling. Spatially indexed, depth-correct territory picking is tested under 12 camera transforms. The latest checks also assert that weighted microcell areas spread from below 70% at the 5th percentile to above 138% at the 95th, with a largest cell near 200% and different shapes for different seeds. Other checks include 2–5 mesas per hill territory at 50% XY / 20% Z, triple mountain counts, doubled mountain base size and 50% mountain height reduction, while preserving the one-third snow cap. River tests assert that manual rivers follow an entire deformed border, while generated rivers follow only their intended warped subpath; an integrated microcell test confirms that returned river edges are exact references to the visual territory borders.
- Script syntax and simulated renderer execution: model-based reed sprite construction, WebGL draw submission, border draw, regional forest/reed billboards, middle-mouse pan, Shift+middle yaw and wheel zoom.
- **Not yet established:** real browser screenshots, verified WebGL FPS/GPU profiling, low-end mobile memory/thermal behaviour or full visual art-direction approval. Static server or a Vercel preview is needed for real visual review.

## Regional markers (visual only)

Five marker kinds are drawn by `src/regional-map3d-placeholders.js` on a dedicated upper canvas, so ship animation never rebuilds the terrain mesh. Each marker is drawn as its regional token (see *Map tokens* below) when `lab/3dregionmap.html` has loaded `region-token-models.js` and `region-troop-sprites.js`; without them the original primitives remain as a fallback (and are what the Node regression draws for troops):

| Live condition | Token | Fallback primitive |
|---|---|---|
| Village present | `village1`–`village4` by the source `level`; real villages carry no level yet, so they are L1 (the examples show L1–L4) | Orange cuboid |
| Non-palisade fortification present | `castle` (palisades excluded); flag in the owner's `heraldry.c1` when supplied | Grey cuboid |
| Port present | `port` jetty on the waterline, `heading` pointing out to sea | Narrow brown dock strip |
| Ship present | `ship` cog on the waterline, bow along its route; sail in the owner's `heraldry.c1` when supplied | Brown rectangular vessel |
| Troops with their owner's heraldry present | The game's soldier sprites in a 7-figure formation, livery recoloured from the default `#b32628`/`#eac15b` to `heraldry.c1`/`c2` | Two stacked cylinders in c1/c2 |

Tokens are sized at about a third of an average territory (never below ~9 screen px of radius) and land markers without a source height sit on the same `elevation()` the terrain mesh uses; ships and ports sit on the sea surface (z = −1.8). Building tokens get a stable per-marker yaw; mesh faces are shaded at runtime from their rotated normals against a light fixed on screen, so the shading follows camera yaw and marker heading. The example ship route is now chosen so it stays on water cells.

The read-only `ConquerRegion3DMarkerSnapshot()` bridge maps real World Lab `villages`, `fortifications`, `ports`, and optional `regionalShips` / `ships` and `regionalArmies` / `armies`. Troops with unavailable heraldic colours are omitted, not assigned invented player colours. Live ships may supply `{route:[{x,y},...],progress}` and the marker follows their simulation-supplied progress. The `window.ConquerRegion3DLiveMarkers` provider offers a compatible extension point for future integration.

**Current source limitation:** the World Lab deliberately freezes its legacy village/road generation and has no integrated regional ship or army simulation yet. The clearly labelled, default-on checkbox **Esempi visivi (non dati di gioco)** therefore displays one example of each shape, including a boat sailing a looping test route. Demo troops use the actual CONQUER default heraldry field colours from `src/heraldry-shapes.js`, but are not real units. Unchecking that control displays only real source-backed markers. Demo entities never change gameplay, ownership, saves or map data.

Verification: `qa/regional-map3d-placeholders-regression.cjs` covers all five primitives, palisade exclusion, real heraldic colours, route movement and no-fabrication rules. A simulated DOM/WebGL/Canvas integration run validated the independent overlay, live polling and toggle. Full visual/FPS inspection in a real browser remains pending.

## Visual limitations and future integration

- **This changes the preview's visual borders/coastlines, not simulation ownership.** Left-click selection now picks the exact rendered 3D microcell triangle, maps it back to its original macro territory ID, and delegates selection (including Shift+click multi-selection) to the World Lab. The selected aggregate is highlighted in 3D, and selections from 2D synchronize back to 3D. Do not migrate gameplay ownership, pathfinding, game water barriers, saves or AI to this geometry without explicit gameplay remapping.
- Mountain ridge/barrier peaks still use canonical edge positions; mountain placement can differ from the organic visual borders. Rivers are now explicitly remapped to organic shared edges, but if deformation removes the original pair's visual adjacency, the corresponding river is reported as unmatched instead of crossing territory interiors. Full path continuity at multi-pair confluences is not yet verified in a real browser.
- Trees and reeds are 2D billboards projected with the same fixed isometric camera as the mesh, not depth-tested volumetric tree meshes; scenery can overlap mountain faces incorrectly.
- The original map's outer rectangular domain remains the same; the **internal** region/biome boundaries are organic. Distinct sea/land borders are derived from aggregated microcells.
- A production renderer should cache meshes by seed/palette/warp revision, progressively LOD distant geometry, and eventually use worker/OffscreenCanvas and GPU sprite instancing rather than sorting and painting thousands of 2D billboards for every camera update.

## Map tokens

`tools/blender/build_region_tokens.py` → `src/assets/region-token-models.js` (`window.ConquerRegionTokenModels`) provides flat-coloured, very low-poly tokens distilled from the Builder kits: `village1`–`village4` (56/102/130/188 tris, the four evolution states of the game's L1–L4 houses, in their colours), `castle` (91), `port` (56), `ship` (33). Troops are not meshes: `tools/bake-region-troops.mjs` bakes the game's own soldier painters from the Asset Lab into `src/assets/regional/troop-*.png`, with feet anchors, a 7-figure formation and `pxPerToken` in `src/assets/region-troop-sprites.js`, to be drawn as billboards like the forest sprites.

They replace the five placeholder primitives one to one: `ConquerRegionTokenModels.markers` maps the marker kinds `village` (→ `village1`–`village4` by settlement level), `castle`, `port`, `ship`; `troops` → the sprite formation. Owner colours follow the marker contract: the meshes' `team`/`teamDark` keys default to the CONQUER heraldry c1 `#b32628` (castle flag, sail) and take the owner's `heraldry.c1`; the troop sprites are painted in the default field colours `heraldry: ['#b32628','#eac15b']` (realm helmet, no foe cap), so a troops marker recolours exactly those pixels with its own `colors`. Ships orient along the marker `heading` (+X is the bow). Token units: origin on the ground (waterline for pier and ship), +X forward, +Z up, footprint radius ~1, so the renderer scales each by one number. Indexed `p`/`i` plus one palette index per triangle (`c`), the same layout as the other Blender registries; `team`/`teamDark` are meant to take the owner's political colour, `*Dark` keys are pre-shaded faces because this renderer has no lighting. Flags and the sail are single planes and rely on the renderer's lack of back-face culling. They are listed in the Asset Lab under Territorio › Mappa regionale (token) and (truppe), and drawn by the regional markers above.

## Preview

Serve the repository root over HTTP and open \`/lab/3dregionmap.html\` (do not use \`file://\`). In the left iframe, generate/edit the authoritative 2D map. The right pane detects the 2D revision, then builds its own global microcell mesh. Choose 8/20/40 detail, vary the deformation slider, and toggle tree/reed populations. The benchmark button reports CPU construction time (not GPU FPS).

**Conclusion:** the dense-microcell-first model allows much more organic cartographic contours without changing the canonical game grid. It is a promising experimental direction, but visual and GPU-level assessment is still required.

## Mappa locale ereditata (branch `feature/local-hex-shape`)

Il pulsante «Apri demo locale» passa anche `shape`: contorno del territorio e contorni dei vicini fisici. La mappa locale usa quel poligono come zona edificabile (sempre 40000 U² dal 25/11/2026, prima 10000 U², omogeneizzazione salvata) e il suo offset di 50U come bordo del mondo; l'anello è diviso fra i vicini con le loro celle Voronoi reali. Codice in `src/regional-local-shape.js`, test in `qa/local-hex-shape-regression.cjs`.
