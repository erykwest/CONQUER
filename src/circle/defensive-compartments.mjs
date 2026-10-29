/**
 * CONQUER /circle — defensive compartment domain skeleton.
 * Pure data contracts: no scene mutations, pathfinding overrides or implicit captures.
 * All geometry, terrain passability and siege occupancy must come from adapters.
 */
export const CIRCLE_STATES = Object.freeze({
  UNASSESSED: 'unassessed', SECURE: 'secure', ALERT: 'alert',
  THREATENED: 'threatened', INFILTRATED: 'infiltrated',
  INVADED: 'invaded', CONTESTED: 'contested', CAPTURED: 'captured'
});
export const CIRCLE_BARRIER_KINDS = Object.freeze({
  FORTIFICATION: 'fortification', NATURAL: 'natural'
});
export const CIRCLE_STORAGE_KINDS = Object.freeze({
  GRANARY: 'granary', WAREHOUSE: 'warehouse', ARMORY: 'armory'
});
export const CIRCLE_RESOURCE_COMPATIBILITY = Object.freeze({
  granary: ['food'], warehouse: ['wood', 'stone', 'metal', 'gold'],
  armory: ['equipment']
});
const states = new Set(Object.values(CIRCLE_STATES));
const storageKinds = new Set(Object.values(CIRCLE_STORAGE_KINDS));
const barrierKinds = new Set(Object.values(CIRCLE_BARRIER_KINDS));
const finiteNonNegative = n => Number.isFinite(n) && n >= 0;
const requiredId = id => typeof id === 'string' && id.length > 0;

/** A polygon must be supplied by the geometry adapter; this does not infer closure. */
export function createCompartment({ id, polygon, depth = 0, adjacentIds = [], mastio = false, state = CIRCLE_STATES.SECURE }) {
  if (!requiredId(id) || !Array.isArray(polygon) || polygon.length < 3 ||
      !polygon.every(p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite)) ||
      !finiteNonNegative(depth) || !states.has(state)) throw new TypeError('Invalid defensive compartment');
  return { id, polygon, depth, adjacentIds: [...new Set(adjacentIds)], mastio: !!mastio, state };
}
/** Only engineered fortifications and actually impassable natural features can seal a sector. */
export function isDefensiveBarrier(candidate) {
  return !!candidate && barrierKinds.has(candidate.kind) &&
    candidate.passable === false && candidate.intact !== false &&
    (candidate.kind === CIRCLE_BARRIER_KINDS.NATURAL ||
      candidate.fortified === true);
}
/** A civilian building cannot close a circle even if its collider blocks movement. */
export function createBarrier({ id, kind, fortified = false, passable, intact = true, geometryRef }) {
  if (!requiredId(id) || !barrierKinds.has(kind) || typeof passable !== 'boolean')
    throw new TypeError('Invalid defensive barrier');
  return { id, kind, fortified, passable, intact, geometryRef };
}
export function createDepot({ id, compartmentId, kind, capacity, inventory = {} }) {
  if (!requiredId(id) || !requiredId(compartmentId) || !storageKinds.has(kind) ||
      !finiteNonNegative(capacity)) throw new TypeError('Invalid defensive depot');
  const allowed = CIRCLE_RESOURCE_COMPATIBILITY[kind];
  if (Object.entries(inventory).some(([resource, amount]) => !allowed.includes(resource) || !finiteNonNegative(amount)) ||
      Object.values(inventory).reduce((sum, n) => sum + n, 0) > capacity)
    throw new RangeError('Invalid depot inventory');
  return { id, compartmentId, kind, capacity, inventory: { ...inventory } };
}
/** Fills deepest (highest depth) compatible depots first; never creates resources. */
export function allocateDefensiveStores(depots, compartments, resource, amount) {
  if (!finiteNonNegative(amount)) throw new RangeError('Invalid amount');
  const depths = new Map(compartments.map(c => [c.id, c.depth]));
  const next = depots.map(d => createDepot(d));
  const ordered = next.filter(d => CIRCLE_RESOURCE_COMPATIBILITY[d.kind].includes(resource))
    .sort((a, b) => (depths.get(b.compartmentId) ?? -1) - (depths.get(a.compartmentId) ?? -1) || a.id.localeCompare(b.id));
  let remaining = amount;
  for (const depot of ordered) {
    const used = Object.values(depot.inventory).reduce((sum, n) => sum + n, 0);
    const stored = Math.min(remaining, Math.max(0, depot.capacity - used));
    depot.inventory[resource] = (depot.inventory[resource] || 0) + stored;
    remaining -= stored;
    if (!remaining) break;
  }
  return { depots: next, unallocated: remaining };
}
/** Capture is explicit: a breach or collapsed tower alone must not trigger it. */
export function captureCompartment(compartmentId, compartments, depots) {
  if (!compartments.some(c => c.id === compartmentId)) throw new Error('Unknown compartment');
  const lost = depots.filter(d => d.compartmentId === compartmentId).map(d => ({ ...d, inventory: { ...d.inventory } }));
  return {
    compartments: compartments.map(c => c.id === compartmentId ? { ...c, state: CIRCLE_STATES.CAPTURED } : { ...c }),
    depots: depots.map(d => d.compartmentId === compartmentId ? { ...d, inventory: {} } : { ...d, inventory: { ...d.inventory } }),
    lost
  };
}
/** Nearest safe reachable adjacent fallback, rather than teleporting to the mastio. */
export function nextCivilianRefuge(fromId, compartments, canReach = () => true) {
  const byId = new Map(compartments.map(c => [c.id, c]));
  const origin = byId.get(fromId);
  if (!origin) return null;
  const visited = new Set([fromId]);
  const queue = origin.adjacentIds.map(id => ({ id, distance: 1 }));
  while (queue.length) {
    const { id, distance } = queue.shift();
    if (visited.has(id)) continue;
    visited.add(id);
    const sector = byId.get(id);
    if (!sector || !canReach(fromId, id)) continue;
    if (sector.state === CIRCLE_STATES.SECURE || sector.state === CIRCLE_STATES.ALERT)
      return { compartmentId: id, distance };
    for (const next of sector.adjacentIds) if (!visited.has(next)) queue.push({ id: next, distance: distance + 1 });
  }
  return null;
}
/** Integration seam: adapters implement topology and occupancy, no heuristic conquest. */
export function createCircleSkeleton({ getFortifications, getNaturalBarriers, detectClosedCompartments, getSiegeControl }) {
  for (const fn of [getFortifications, getNaturalBarriers, detectClosedCompartments, getSiegeControl])
    if (typeof fn !== 'function') throw new TypeError('Missing circle adapter');
  return {
    recompute() {
      const barriers = [...getFortifications(), ...getNaturalBarriers()].filter(isDefensiveBarrier);
      return detectClosedCompartments(barriers).map(c => createCompartment(c));
    },
    getControl: compartmentId => getSiegeControl(compartmentId)
  };
}
