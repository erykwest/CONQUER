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

## Zoning and construction clearance
- The entire four-corner parcel must be inside the current yellow zone.
  Circle-boundary intersections also detect interior erased areas and gaps
  between painted regions; checking only house centers or parcel corners is
  insufficient.
- Neither parcels nor houses overlap forests or other building footprints,
  including buildings under construction. If possible, a smaller parcel is
  used; otherwise the spawn candidate is rejected.
- Placing a building over any part of a parcel clears the whole parcel, its
  house, fences and house-owned access roads. This happens after placement
  and affordability validation, so failed construction does not clear a lot.
- Brush edits invalidate the parcel cache; topology changes refresh automatic
  yellow circles immediately.

## Occupancy and minimum dimensions
- New lots must contain a usable 2x2 U square. Polygon half-plane offsets
  enforce this for rotated quadrilaterals too; large-area thin slivers fail.
  The tight fallback parcel also has at least 2 U on both local axes.
- Spawn checks cover the entire parcel against current friendly units,
  hostiles and active civilians, including each squad member and clearance.
  Civilian positions are queried without advancing recall/routine state.
- Occupancy only rejects new spawn candidates. A unit walking through an
  existing parcel does not hide or delete that parcel.

## Verification
Run `node qa/urban-regression.cjs`.
25 regression checks cover road migration, world bounds, four arterial routes,
persistent deletion, instant reload/new construction, all house levels and
rotations, squad clearance, LOS height, Voronoi occupancy, shared fences,
well detours, projection masks and growth across five procedural seeds.
Additional checks cover full yellow-zone containment (including erased islands
and disconnected painted disks), forest boundaries, completed/unfinished
buildings, whole-parcel clearance and failed construction preserving the lot.
Minimum-size and occupancy checks include rotated parcels, narrow slivers,
squad offsets, hostile units, active civilians and existing-lot stability.

All JS modules passed syntax compilation. Browser visual verification was
unavailable because access to the local preview address was denied.
