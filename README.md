# CONQUER

Settlement builder / manager prototype.

## V0.5 scope
- 200×200U persistent seeded world buffer
- 100×100U central buildable area
- Castle builder: square/round towers, walls, built wall-sections, gates
- Construction economy using gold, stone, wood and metal
- Timed player construction with visible work-in-progress state
- Function slots on towers, gates and built sections
- Village founding through a player-placed well
- Progressive deterministic village growth instead of instant batch generation
- Border-linked radial road network using global goals + local constraints
- Organic houses and fields driven by attractiveness gradients
- Resource and policy UI shell
- Supabase persistence target: project `fwpmcyxggvdtsuatovzo`

## Castle primitives
- Square towers: 1×1U, 1.5×1.5U, 2×2U
- Round towers: R0.5U, R0.75U, R1U
- Walls: 0.5U thick, 1–8U long, point A→B, snap to towers/gates
- Built wall-sections: 1U thick, 1–4U long, roof + crenellation rendering
- Gate: 1.5×1.5U, tower-like snapping behavior
- Towers and gates always render above linear castle elements

## Functional capacity
- Small tower: 0 function slots
- Medium tower: 1 slot
- Large tower: 2 slots
- Gate: 1 slot
- Built section <2U: 0 slots
- Built section 2–<3U: 1 slot
- Built section 3–4U: 2 slots
- Functions are assignable only after construction completes

## Construction timing
Current values are provisional for simulation testing.
- Small / medium / large tower: 4 / 7 / 11 days
- Gate: 9 days
- Well: 2 days
- Walls: 0.7d base + 0.45d per U
- Built sections: 2d base + 1.5d per U
- Auto road: 1 day
- Auto house: 2.2 days
- Auto field: 1.5 days
- Simulation loads paused; test speeds: ×1 / ×4 / ×16
- ×1 currently advances 0.25 game days per real second

## Construction economy
Current values are provisional balancing values.
- Towers: cost rises by size
- Walls and built sections: cost scales with actual segment length
- Gate and well: fixed cost
- Placement is blocked when resources are insufficient
- Removing a player-built structure refunds its stored construction cost during the current builder/prototype phase

## Village growth V3
- Placing the well opens the village naming popup
- The village is named immediately, but organic growth waits for the well to finish construction
- Growth occurs as one event roughly every 2.5 game days
- The growth radius starts small and expands gradually with growth steps
- Two seeded arterial routes grow progressively from the well toward opposite practical borders, eventually forming a through-route across the settlement
- Secondary roads remain radial-biased, branch at non-orthogonal angles, and obey minimum node/parallel-road spacing
- Candidate roads snap to nearby nodes, stop at intersections to form T-junctions, and are rejected when local spacing/angle constraints fail
- The practical-border hook currently treats all four build-area edges as traversable; later it can consume world-cell terrain and neighbour contracts
- Houses favour road frontage and the compact inner settlement
- Fields become eligible only after a small housing nucleus exists and favour the outer ring
- Auto-generated elements have their own short construction times
- Auto-generated structures are tagged `auto:true`
- Player-built structures remove overlapping auto-generated houses, fields and road segments
- Removed auto-spawn does not regenerate on reload; the edited settlement state is persisted
- Pre-V0.5 auto-road saves are migrated by removing old auto-spawn and restarting growth in V3, preserving player-built structures
