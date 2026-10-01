# CONQUER

Settlement builder / manager prototype.

## V0.2 scope
- 200×200U persistent seeded world buffer
- 100×100U central buildable area
- Castle builder: square/round towers, walls, built wall-sections, gates
- Towers and gates render above linear castle elements
- Built sections have roof/ridge + crenellation treatment
- Geometry-driven function capacity with a dedicated assignment panel
- Resource and policy UI shell
- Supabase persistence target: project `fwpmcyxggvdtsuatovzo`

## Castle primitives
- Square towers: 1×1U, 1.5×1.5U, 2×2U
- Round towers: R0.5U, R0.75U, R1U
- Walls: 0.5U thick, 1–8U long, point A→B, snap to towers/gates
- Built wall-sections: 1U thick, 1–4U long, roof + crenellations
- Gate: 1.5×1.5U, tower-like snapping behavior

## Function capacity
- Small tower: 0 slots
- Medium tower: 1 slot
- Large tower: 2 slots
- Gate 1.5×1.5U: 1 slot
- Built section <2U: 0 slots
- Built section 2–<3U: 1 slot
- Built section ≥3U: 2 slots

Current function catalogue is provisional and can be replaced without changing the geometry/capacity model.
