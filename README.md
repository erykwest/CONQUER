# CONQUER

Settlement builder / manager prototype.

## V0.11 scope
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


## 2.5D renderer
- The simulation and persistence model remain strictly 2D in world units (U)
- Rendering uses a dimetric/isometric projection only at presentation time
- Ground picking uses the inverse projection, so placement still writes normal world X/Y coordinates
- Towers, gates, walls, built sections, wells and houses are rendered as extruded Canvas 2D geometry
- Roads, fields, water and biome footprints remain ground-plane layers
- Mountains and forests receive lightweight vertical treatment for depth
- Raised settlement elements use painter-order sorting by world depth
- Manual structures use screen-space projected hit testing so elevated faces remain selectable
- No Three.js/WebGL/build system dependency has been introduced


## Camera rotation and height levels
- The 2.5D camera can rotate in 90° increments with ↺ / ↻ controls in the top bar
- Rotation is view-only: world coordinates, roads, settlement state and persistence remain unchanged
- Tower height: 1 / 2 / 3 levels
- Wall and built-section height: 1 / 2 levels
- Tower function capacity = footprint capacity × height levels
- Built-section function capacity = length capacity × height levels
- Small towers retain zero function capacity regardless of height
- Height affects 2.5D extrusion, construction time and construction cost
- Builder height selectors set the level for new structures; selected structures expose the level in the structure panel for rapid prototype testing
- Test resources are initialized to 10,000 each; existing saves are raised to at least 10,000 on load during this testing phase


## Structure tiers
- Wall T1: 0.2U thick
- Wall T2: 0.5U thick (normal)
- Wall T3: 1U thick
- Square tower tiers: 1U / 1.5U / 2U
- Round tower tiers: R0.5U / R0.75U / R1U
- Wall thickness tier is selectable before placement
- Selecting an existing wall or tower exposes T1 / T2 / T3 controls for direct upgrade/downgrade during prototype testing
- Tower upgrades preserve shape and height level
- Wall upgrades preserve endpoints, length and height level
- Height remains independent from tier: towers use 1–3 levels, walls/built sections 1–2 levels
- Function capacity recalculates after tower tier or height changes


## Boolean castle renderer
- Completed castle geometry is no longer drawn as independent overlapping prisms
- Tower, gate, wall and built-section footprints are unioned with polygon-clipping 0.15.7
- The castle is rendered in horizontal height bands, so short walls merge into taller towers below wall height while towers continue above
- Polygon holes are preserved with even-odd top filling, so closed courtyards remain open
- Wall/built footprints get a tiny union-only overlap at snapped tower endpoints to guarantee a real boolean intersection, including round towers
- Logical endpoints, construction lengths, costs and persistence remain unchanged
- Under-construction pieces and placement previews remain individual geometry
- If polygon union fails or the library is not yet ready, rendering falls back to the individual-prism renderer
