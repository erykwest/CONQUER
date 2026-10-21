# CONQUER — Events skeleton (V0)

This folder defines the initial contracts for social events. It intentionally does not activate gameplay or alter the main simulation.

## Spaces
- **Street performance spot**: player-placed small location; spontaneous performance by one artist or a pair, with a small audience.
- **Stage**: player-placed permanent performance platform; group performances with audience.
- **Festival ground**: player-placed, fixed 6 × 10 world-unit rectangular reservation, green when idle. It is not a constructed building: no materials, labor, or build time. Blocks houses, fields, pastures, buildings and other reservations, but allows normal civilian traversal while idle. Relocatable when no event is active or being assembled. No automatic scanning of empty terrain to discover event locations.

## Event lifecycle
`planned -> preparing -> active -> clearing -> idle` (cancellation allowed before active).
- Spontaneous street performances require an available performer and valid placed spot, and are not player-scheduled.
- Scheduled events (festivals, fairs, traveling circus, tournaments, jousts) require an explicit date/time window, a compatible placed venue, and no conflicting booking.
- Temporary props (tables, tents, stands, barriers, tournament lists) spawn within the venue only during preparation/active phases and despawn during clearing.
- Population joins as spectators/performers using existing routines and pathfinding; attendees temporarily suspend compatible jobs and return afterwards.
- Food and gold consumption, morale, attractiveness and prestige are *hooks*, not active effects until wired to the economy.

## Modules to integrate (future implementation)
1. Venue registry and placement validation / occupancy reservations.
2. Event catalog with venue compatibility, capacity and resource hooks.
3. Schedule and conflict checks, using the existing game clock.
4. Lifecycle manager and deterministic cleanup / save-load.
5. NPC attendance and performer assignments via existing routines.
6. Temporary SVG asset placement; reuse combat engine for tournaments rather than implementing separate combat.

## Acceptance criteria
- Placement/removal of a 6×10 festival ground reserves terrain without a construction bar.
- No building, field or pasture may overlap the reserved rectangle.
- Idle ground remains visually green and passable.
- The player schedules an event only on a placed compatible venue.
- Props and crowds appear during an event and are cleaned up afterwards.
- No automatic discovery of vacant terrain and no new alcohol resource.

Status: **architecture skeleton only**. No runtime behavior is claimed.
