# CONQUER

Settlement builder / manager prototype.

## V0.3 scope
- 200×200U persistent seeded world buffer
- 100×100U central buildable area
- Castle builder: square/round towers, walls, built wall-sections, gates
- Construction economy using gold, stone, wood and metal
- Function slots on towers, gates and built sections
- Village founding through a player-placed well
- Deterministic auto-spawn of roads, houses and fields around the village core
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

## Construction economy
Current values are provisional balancing values.
- Towers: cost rises by size
- Walls and built sections: cost scales with actual segment length
- Gate and well: fixed cost
- Placement is blocked when resources are insufficient
- Removing a player-built structure refunds its stored construction cost during the current builder/prototype phase

## Village generation
- Placing the well opens the village naming popup
- Confirming the name founds the village
- A deterministic road grid is generated from the settlement seed + well position
- Houses use an attractiveness gradient favouring the core and proximity to roads
- Fields use an outer-ring attractiveness gradient with weaker road preference
- Auto-generated structures are tagged `auto:true`
- Player-built structures remove overlapping auto-generated houses, fields and road segments
- Removed auto-spawn does not regenerate on reload; the edited settlement state is persisted
