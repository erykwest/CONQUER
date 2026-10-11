# CONQUER Visual QA (branch: visual-qa)

## Status and scope

The runner \`qa/visual-regression.cjs\` opens the **real** browser game with Playwright and tests the active Canvas2D renderer. It does not use mocks of the game's drawing routines and does not modify user saves.

Available now:
- 12 versioned deterministic scenarios (castle, tower variants, cutaway, built roofs, palisade, houses, civics, construction).
- Four camera rotations for every selected scenario at fixed zoom, viewport, pixel ratio, game day, season and seed.
- Real screenshot captures in \`qa/visual-results/actual/\`, nonblank checks and optional pixel-difference baselines.
- Independent scene-geometry sanity checks (heights, finite projected silhouettes).
- Real Canvas clipping mask probes for castle facade occlusion: independently determine which silhouettes should cover sample pixels and verify the actual canvas clip alpha.
- Cached-versus-direct castle bitmap benchmark and repeat-scene determinism test.
- 80 seeded geometry stress combinations, with full error and scene metadata reporting.
- GitHub Actions PR/push smoke run and manually triggered full run, with downloadable report and screenshots.

Note: the semantic probes validate **geometry, mask clips and candidate front/behind relationships**, not all final architectural surfaces. A comprehensive per-part ID render buffer (doors, merlons, windows, units, etc.) is a follow-up.

## Running locally

Install \`playwright@1.55.0\` and \`pngjs@7.0.0\` with Node 20+ and run \`npx playwright install chromium\`. Start the repository as a static site (e.g. \`python3 -m http.server 4173\`).

Commands:
- \`node qa/visual-regression.cjs --smoke\`: six critical scenes × four rotations, plus diagnostics and stress.
- \`node qa/visual-regression.cjs --full\`: all 12 scenes × four rotations.
- \`node qa/visual-regression.cjs --full --update-baselines\`: **explicitly generate/replace** screenshot references at \`qa/visual-baselines/\`. Review the images before committing.
- \`CONQUER_QA_URL=http://127.0.0.1:4173/ node qa/visual-regression.cjs --smoke\`: custom URL.

The runner never updates baseline PNGs unless \`--update-baselines\` is given. If no baseline is committed, the relevant test reports \`PENDING\`, not PASS (and not a blocking failure). Nonblank renders, occlusion rules, repeat determinism, geometry stress, page errors and bitmap parity can still fail CI.

**Important**: Image pixel regression becomes an enforceable gate only after reviewed baseline screenshots are committed. CI does **not** approve its own references.

## Outputs

\`qa/visual-results/report.json\` includes source scene ID, camera rotation, structural bounds/height/depth and precise failures. \`report.md\` contains a readable table. \`actual/\` contains screenshots and \`diff/\` contains highlighted changed pixels (red).

Suggested ongoing workflow:
1. Open the GitHub Actions **Visual QA** workflow after a PR.
2. Read the job summary and download the visual-qa artifact.
3. Inspect mismatches; distinguish intended art changes from regressions.
4. Regenerate and approve reference PNGs only for intended changes, on a separate reviewed commit.

## Determinism safeguards

The runner fixes seed 224466, day 20, summer/day, camera projection, 1280 × 900 viewport and DPR 1, and forces Canvas2D. It also hides the UI and weather canvases and resets the state and render cache for every scene. A second pass of the tower/wall scene detects stale bitmap caches and other nondeterminism.

Only renderer output from an identical Chromium environment should be compared to approved baselines. Do not mix browsers, font environments or DPR. The hybrid WebGPU renderer is deliberately not used for the canonical PNG baseline. The existing WebGPU smoke workflow continues to gate GPU fallback and blank-frame errors; an explicit cross-renderer image parity suite should be added when GPU output is stable in CI.

## Architectural follow-up

A dedicated opt-in QA instrumentation layer should expose for each drawable part \`{structureId,partId,depth,zMin,zMax,polygon,layer}\` and a separate flat-color ID buffer. Then compare ID-buffer coverage against analytically expected visibility, including units behind houses, doors beneath overhangs, roof edges and merlons. This avoids treating every overlap or pixel difference as a defect.
