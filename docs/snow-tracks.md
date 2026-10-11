# Winter snow tracks

Troops (including each squad member, ground patrols, trainees and recalled
militia) and visible villagers leave small alternating soles when moving on
snowy winter ground. Tracks fade linearly over 2.5 real seconds, including
while simulation time is paused. Elevated guards, exposed roads and water do
not receive ground tracks. Teleports and a return from off-screen reset the
emitter instead of drawing a connecting line. Tracks are cosmetic and unsaved.

Algorithm: fixed Object Pool with limited-lifetime particles, adapted from
Robert Nystrom's original chapter:
https://github.com/munificent/game-programming-patterns/blob/master/book/object-pool.markdown

The implementation uses typed arrays and a chronological ring buffer: 768
tracks, at most 512 tracked actors and 64 new tracks per visual frame. A full
pool replaces its oldest mark in constant time. Emitters trigger every 0.32
world units, not on each redraw; stationary actors avoid terrain queries.
Ground checks occur only on an emission attempt. Camera transforms project
world-space tracks each draw; drawing is culled to the viewport and batched in
16 opacity levels (at most 16 fill calls). No additional
pathfinding, scene-cache invalidation, save data or RAF loop is introduced.
The existing paused-effects redraw handles the last 2.5 seconds at ~12 FPS.
In the hybrid WebGPU path, only frames with visible tracks re-blit the existing
base cache to keep house surfaces above the tracks.

Run `node qa/snow-tracks-regression.cjs`. The printed full-pool timing measures
JavaScript with a stub canvas, not real browser rasterization or total FPS.
