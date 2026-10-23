# CONQUER Activity & Navigation System (CANS)

**Status:** architecture proposal — documentation only. **Scope:** shared activity, occupancy and local navigation model; no gameplay code changes in this commit.

## Purpose
Unify assignment, reservation, sequencing and movement of real simulated citizens across interiors, open-air productive areas and moving vehicles. A citizen must never appear as a decorative duplicate or work in two places simultaneously. Reuse existing systems before refactoring; preserve current gameplay rules.

## Core model

### Functional Domain
A persistent logical area owned by a building, worksite, open-air market, field, forest camp or vehicle. A domain has an ID, a reference frame (world or parent vehicle), one or more access points, activity slots, a navigation provider, an occupancy register and versioned layout data. An interior is **not** required: a market square is also a domain. Domains may contain subdomains (farm and its fields; vessel and deck).

### Access points
Zero, one or multiple entry/exit portals connect domain-local navigation with the world navigation network. The chosen portal depends on reachable route and current activity; never assume a single entrance. When docked, vessel gangways connect to the port; when underway, external pedestrian access is disabled.

### Slots
Persistent slot IDs identify compatible activities or positions. **Worker** slots are for assigned staff (priest, bartender, artisan); **Guest** slots are for visitors (congregation, customers). Slots may be fixed (pew, chair, anvil), spatial regions, route/work segments (field furrows) or dynamic target attachments (tree, animal, fish shoal). A slot includes domain, role compatibility, capacity, local transform or target reference, action/animation descriptor and availability state. Furniture may generate slots when the layout is created; changing furniture only updates affected slots.

### Occupancy and reservations
The simulation owns an authoritative mapping of citizen ID to current domain, assignment, slot and activity state. Reservation is distinct from occupancy: reserve a destination before travel, release on cancellation/failure, commit on arrival. Transitions free the previous slot without disturbing unrelated occupants. Enforce one active job and coherent physical location per citizen. Rendering and cutaway read the register; they never invent inhabitants.

### Activity sequences
A reusable state-machine/task sequence selects a compatible target, reserves it, travels, performs an activity, possibly changes slot, and exits or repeats. Activities have conditions, duration/progress, resource effects, interrupt/retry rules and animation cues. Animations express simulation state but do not determine economic results. An interruption may suspend and later resume a task.

## Navigation strategies

**Static local graph:** generated once from stable layout and furnishings, stored with the domain. Nodes connect entrances, circulation corridors and slots. A route is queried between nodes rather than persisted separately for every citizen. On cutaway/zoom, visible agents are reconstructed from simulation state. Rebuild only impacted nodes/edges when furniture or layout changes.

**Outdoor work route:** world pathfinding reaches a field/worksite; a local work pattern handles the action (e.g. agricultural serpentine tracks at the established spacing). The slot may describe a work segment instead of a stationary point. Keep existing farming phases and throughput rules unchanged.

**Dynamic target:** logging, hunting and fishing use targets that can move, disappear or regenerate. Candidate targets are selected within the worker's operational domain; the worker reserves a viable interaction position near the target. Recalculate on demand when an assignment begins, the target becomes invalid/unreachable, moves beyond tolerance, the action finishes or the agent is interrupted. Do not recompute every possible path across the entire map every frame. For moving prey, sensing/fleeing and pursuit are separate behavioral concerns.

**Vehicle navigation:** a vessel has its own world-space movement controller and target, while the crew's activity graph remains in vessel-local coordinates. Docked vessels act as accessible static domains; underway vessels move their parent frame without recalculating all onboard local paths. Fishing boats navigate to fishing grounds/shoals, work and return. Trading ships can navigate to a map-edge exit, leave the active simulation and return by an explicit travel schedule. Vehicle targets may be static or dynamic. The same principle may later support caravans and siege engines.

## Representative flows

**Church:** world path to reachable door → reserve guest pew slot → local aisle route → sit/pray animation → leave through appropriate exit. Priest occupies compatible worker slot.

**Tavern:** door → counter → reserve table/chair → walk/sit → optionally switch to another available slot → exit. The register updates for each transition.

**Market:** choose among multiple square access points → visit one or more stalls → worker merchant and guest customer slots → transaction, if supported by existing economy → exit. No enclosing walls required.

**Farm:** farm worker assigned to field subdomain → world route to plot → local serpentine work segment → aratura/semina/crescita/raccolto according to existing mechanics. Growth need not occupy a worker slot.

**Logging:** search nearest eligible tree within camp influence → reserve work position → approach → chop → invalidate felled target → select next tree.

**Hunting:** choose eligible deer → approach → deer may flee → re-evaluate target/path on trigger → resolve hunt. This is a future extension, not an existing feature claim.

**Fishing vessel:** crew boards at port → departure changes vessel to mobile frame → sail to fishing target → perform onboard fishing actions → return and dock → crew can disembark.

## Persistence and performance
Save domain ID, layout revision, slots, local graph or reproducible graph data, access points, assignments, reservations, and relevant activity progress. Keep occupancy independent of render visibility. Do not regenerate whole interiors on cutaway. Use spatial queries for local dynamic candidates, bounded recalculation and event-driven invalidation. Handle destroyed buildings, removed furniture, deleted trees, missing targets, blocked doors and vehicle departure without orphaned reservations.

## Separation of concerns
Simulation owns jobs, citizens, resource changes and reservations. Navigation providers compute routes and validity. Domain layout defines access, furniture and slots. Presentation draws characters, interiors, cutaway and animations. A vessel movement controller owns world navigation, not the onboard worker animations. Existing field, logging and pathfinding code should be audited and adapted through interfaces rather than replaced blindly.

## Proposed skeleton (subsequent phase, NOT implemented)
Introduce minimal interfaces for FunctionalDomain, AccessPoint, ActivitySlot, OccupancyRegistry, ActivitySequence, NavigationProvider (static-local, outdoor-work, dynamic-target) and MobileDomainAdapter. Start with one static-domain pilot (tavern/church) and one existing dynamic-work pilot (logging or field). Then extend to multi-entry market and vessel; add persistence and cutaway integration. Do not create a new feature branch for each adapter.

## Acceptance criteria for implementation
A citizen cannot occupy two slots; reservations prevent collision; stable occupants survive cutaway and local furniture edits; different entry portals work; work routes respect existing farm logic; tree removal invalidates its slot without global path rebuild; crew remains attached to a moving vessel; hidden interiors do not require rendered NPCs; interrupted tasks release or preserve reservations correctly; old save compatibility and performance are explicitly tested.

## Open design decisions
Exact integration points and naming must be verified against the current CONQUER source. Decide graph serialization/versioning, crowd congestion policy, reservation timeouts, dynamic-target motion thresholds, save migration and vessel edge-of-map lifecycle before implementation. No claim is made that these features are already implemented.
