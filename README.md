# CONQUER

Settlement builder / manager prototype.

## V0.1 scope
- 200×200U persistent seeded world buffer
- 100×100U central buildable area
- Castle builder: square/round towers, walls, built wall-sections, gates
- Resource and policy UI shell
- Supabase persistence target: project `fwpmcyxggvdtsuatovzo`

## Castle primitives
- Square towers: 1×1U, 1.5×1.5U, 2×2U
- Round towers: R0.5U, R0.75U, R1U
- Walls: 0.5U thick, 1–8U long, point A→B, snap to towers/gates
- Built wall-sections: 0.5U thick, 1–4U long
- Gate: 1.5×1.5U, tower-like snapping behavior
