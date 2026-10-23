/** Autonomous L3 street-front workshops. Pure simulation; no rendering dependency. */
export const WORKSHOP_TYPES = Object.freeze({
  leatherworker: { label: 'Pelletteria', demand: 'clothing', weight: 1 },
  blacksmith: { label: 'Fabbro', demand: 'tools', weight: 1.2 },
  potter: { label: 'Vasaio', demand: 'household', weight: 1 },
  weaver: { label: 'Tessitore', demand: 'clothing', weight: 1 },
  tailor: { label: 'Sarto', demand: 'clothing', weight: 0.9 },
  carpenter: { label: 'Falegname', demand: 'household', weight: 1 },
  goldsmith: { label: 'Orafo', demand: 'luxury', weight: 0.35 },
});
export const WORKSHOP_STATES = Object.freeze(['closed', 'open', 'working', 'selling', 'vacant']);
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const unit = n => Number.isFinite(n) ? clamp(n, 0, 1) : 0;
export function eligibleForWorkshop(house) {
  return Boolean(house && Number(house.level ?? house.tier) === 3 && house.completed !== false && house.accessible !== false && house.streetFacing !== false);
}
export function chooseWorkshopType({ demand = {}, supply = {}, prosperity = 0, random = Math.random } = {}) {
  const choices = Object.entries(WORKSHOP_TYPES).map(([type, spec]) => ({
    type, score: Math.max(0, (unit(demand[spec.demand] ?? 0.5) - unit(supply[type] ?? 0)) * spec.weight * (type === 'goldsmith' ? unit(prosperity) : 1)),
  }));
  const total = choices.reduce((sum, item) => sum + item.score, 0);
  if (!total) return null;
  let target = clamp(random(), 0, 0.999999) * total;
  for (const item of choices) { target -= item.score; if (target < 0) return item.type; }
  return choices[choices.length - 1].type;
}
export function createWorkshop({ house, artisanId, type, day = 0 }) {
  if (!eligibleForWorkshop(house) || !artisanId || !WORKSHOP_TYPES[type]) return null;
  return { id: `workshop:${house.id}`, houseId: house.id, artisanId, type, state: 'closed', createdDay: day, revenue: 0, activity: 0, streetFacing: true };
}
export function updateWorkshop(workshop, { hour = 12, demand = 0.5, visitors = 0, connected = true, artisanAvailable = true } = {}) {
  if (!workshop) return null;
  const open = connected && artisanAvailable && hour >= 7 && hour < 19;
  const state = !artisanAvailable ? 'vacant' : !open ? 'closed' : visitors > 0 ? 'selling' : demand > 0 ? 'working' : 'open';
  return { ...workshop, state, activity: open ? unit(demand) : 0, revenue: workshop.revenue + (state === 'selling' ? Math.max(0, visitors) * unit(demand) : 0) };
}
export function proposeWorkshops({ houses = [], artisans = [], existing = [], demand = {}, supply = {}, prosperity = 0, random = Math.random, day = 0 } = {}) {
  const occupied = new Set(existing.map(w => w.houseId));
  const assigned = new Set(existing.map(w => w.artisanId));
  const available = artisans.filter(a => (Number(a.level ?? a.tier) === 3) && !assigned.has(a.id) && a.available !== false);
  const proposals = [];
  for (const house of houses) {
    if (!eligibleForWorkshop(house) || occupied.has(house.id) || !available.length) continue;
    const type = chooseWorkshopType({ demand, supply, prosperity, random });
    if (!type) continue;
    const artisan = available.shift();
    const workshop = createWorkshop({ house, artisanId: artisan.id, type, day });
    if (workshop) { proposals.push(workshop); occupied.add(house.id); }
  }
  return proposals;
}
