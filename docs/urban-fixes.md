# Urban fixes

Branch: urban. Base: main at 97d24ab18cae55463262160a108bd951c044bb9f.

## Behavior
- The four radial road entries lie on the outer 200U world boundary.
  Saved entries/plans on the former 100U build boundary migrate on load.
- Generated main-road segments can be selected and deleted. Deleted route IDs
  persist in village data so reconciliation and reload cannot restore the gap.
  Remaining segments are preserved; hand-built main roads remain available.
- Reloaded secondary access roads are immediately usable. Newly generated
  branches retain construction progress.
- Houses, extensions and turrets block civilian and military movement.
  Formation offsets and every traversed segment are checked, including short
  steps, cached road routes and the household's own house.
- Analytic footprint/ray intersections block sight through completed houses.
  Ray height permits sufficiently elevated observers to see over roofs.
- World-space house faces clip civilian and military figures (including squad
  flags) on all four camera rotations. Overlapping masks form a union.
- A bounded Euclidean Voronoi cell is generated around each house site.
  Each lot is a four-vertex polygon inscribed in that cell and containing the
  full footprint with a setback. Inscribing can leave space between lots.
  Candidates are validated before a house is committed; extensions that would
  overrun their parcel are rejected.
- Fences include entrance gaps and union collinear shared intervals instead
  of painting duplicate shared boundaries. Fences are visual lot boundaries;
  the house footprint is the physical blocker.

## Verification
Run `node qa/urban-regression.cjs`.
14 regression checks cover road migration, world bounds, four arterial routes,
persistent deletion, instant reload/new construction, all house levels and
rotations, squad clearance, LOS height, Voronoi occupancy, shared fences,
well detours, projection masks and growth across five procedural seeds.

All JS modules passed syntax compilation. Browser visual verification was
unavailable because access to the local preview address was denied.
