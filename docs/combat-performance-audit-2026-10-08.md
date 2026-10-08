# CONQUER — combat performance audit and refactor (2026-10-08)

## Scope and data sources

- Branch: `combat`; no changes to `main`.
- Evidence: Supabase `public.simulation_telemetry` read via connector, latest 4 hours at audit time; full source review of `settlement-app.js`, `settlement-render.js`, `settlement-combat.js`, `settlement-population.js`, `settlement-combat-rules.js`.
- Sample: 67 telemetry rows, average of sampled last-draw duration **52.7 ms**, maximum sampled last-draw duration **325.8 ms**; **160 DRAW_SLOW**, **79 FRAME_SPIKE** (the event totals may include repeated events across samples). Population **~87**, scene **146 structures / 103 roads**.
- Note: multi-second frame gaps, especially when the browser tab may be backgrounded, are *not proof* of continuous CPU blocking. Screen render durations >30–50 ms and explicit DRAW_SLOW are actionable.

## Findings and changes

1. **Two full-world draw loops during Recall/Release** (high priority): dedicated civilian RAF did an extra complete scene render every 50 ms in addition to the simulation's adaptive 30/24/15 FPS loop. Refactored so only paused simulation uses civilian RAF; active time uses the existing frame loop.
2. **Static visibility recalculated every 2.5 seconds** (high for tower-dense maps): changed to stable LOS snapshot reuse, with periodic 12-second safety refresh for in-place landscape changes and immediate update for moving observers.
3. **Archer target update every animation frame**: fixed-frequency tactical evaluation at ~10 Hz while entity movement stays frame continuous. Archer positions are cached for one second or until the structure count changes. Unused archer roster scans are skipped when there are no living enemies.
4. **Seven isometric overlay blits per frame**: fog and three colored territory masks plus three perimeter masks are now composited once offscreen into a single cached 400×400 atlas. A stable frame draws one atlas texture, while invalidation updates it on actual changes (visibility, zones, toggles).
5. **Painting causes full redraw for each mouse move**: defer redraw to the existing simulation frame, or to one coalesced RAF while paused. Defer expensive alert refresh until the brush stroke ends.
6. **No per-phase attribution in scene renderer**: added `RENDER_PHASE_SLOW` logging for scene caches, population sprites, garrison sprites, facade/effect rendering. Added `COMBAT_FOG_SLOW`, `COMBAT_RULES_SLOW`, `COMBAT_BACKDROP_SLOW`, `COMBAT_OVERLAY_SLOW` event telemetry, emitted only above thresholds with cooldowns.

## Pre-existing correctness fixes retained

- Movement across steep cliff bands blocked for civilians and all pikeman formation positions.
- Visibility inside and around forest 6U.
- Coffee Battles-derived combat and shots.
- Circular JSON routes eliminated from local/cloud saves; interrupted orders rebuild their paths upon loading.
- Main animation loop survives errors, and combat faults are isolated.

## Validation

- All edited JavaScript modules pass a syntax check.
- Deterministic renderer harness: 26 screen frames -> **26 overlay atlas blits**, **only one 7-layer offscreen composite**, rather than repeated per-frame composites. Static fog unchanged after 3 seconds; saved combat state remains JSON serializable.
- Tests are structural and deterministic, not a measured end-user browser FPS improvement. Live A/B performance verification needs telemetry from a newly loaded `combat` deployment under equivalent scene and camera conditions.
- Keep `main` unchanged until this validation succeeds.

## Follow-up acceptance criteria

- Compare equivalent scene snapshots at ~87 population / 146 structures / 103 roads before and after.
- Aim for <34 ms last-draw duration in typical views, with **fewer DRAW_SLOW** events and no independent civilian RAF during active simulation.
- If `RENDER_PHASE_SLOW` identifies castle facade or garrison rendering as dominant, focus subsequent render-LOD/caching refactor there instead of blindly lowering FPS.
