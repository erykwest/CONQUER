'use strict';
// CONQUER autonomous L3 street-front workshops (from feature/autonomous-urban-economy).
// Pure rules: eligibility, weighted trade choice, daily state. ConquerCommerce
// owns the saved registry and calls these from the simulation calendar.
(() => {
  const WORKSHOP_TYPES = Object.freeze({
    leatherworker: Object.freeze({ label: 'Pelletteria', demand: 'clothing', weight: 1 }),
    blacksmith: Object.freeze({ label: 'Fabbro', demand: 'tools', weight: 1.2 }),
    potter: Object.freeze({ label: 'Vasaio', demand: 'household', weight: 1 }),
    weaver: Object.freeze({ label: 'Tessitore', demand: 'clothing', weight: 1 }),
    tailor: Object.freeze({ label: 'Sarto', demand: 'clothing', weight: .9 }),
    carpenter: Object.freeze({ label: 'Falegname', demand: 'household', weight: 1 }),
    goldsmith: Object.freeze({ label: 'Orafo', demand: 'luxury', weight: .35 })
  });
  const WORKSHOP_STATES = Object.freeze(['closed', 'open', 'working', 'selling', 'vacant']);
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const unit = n => Number.isFinite(n) ? clamp(n, 0, 1) : 0;
  function eligibleForWorkshop(house) {
    return Boolean(house && Number(house.level ?? house.tier) === 3 && house.completed !== false &&
      house.accessible !== false && house.streetFacing !== false);
  }
  // A city's workshop register: coverage counts, not player-managed jobs.
  function workshopRegistry(existing = []) {
    const counts = Object.fromEntries(Object.keys(WORKSHOP_TYPES).map(type => [type, 0]));
    for (const workshop of existing) if (Object.hasOwn(counts, workshop.type)) counts[workshop.type]++;
    return counts;
  }
  // Gentle biases preserve diversity without guaranteeing every profession.
  function chooseWorkshopType({ demand = {}, supply = {}, registry = {}, resources = {}, prosperity = 0, random = Math.random } = {}) {
    const choices = Object.entries(WORKSHOP_TYPES).map(([type, spec]) => {
      const demandFactor = .7 + .3 * unit(demand[spec.demand] ?? .5);
      const availability = unit(resources[type] ?? .5);
      const resourceFactor = .75 + .5 * availability;
      const count = registry[type] ?? supply[type] ?? 0;
      const diversityFactor = count === 0 ? 1.7 : 1 / (1 + .25 * count);
      const luxuryFactor = type === 'goldsmith' ? .25 + .75 * unit(prosperity) : 1;
      return { type, score: spec.weight * demandFactor * resourceFactor * diversityFactor * luxuryFactor };
    });
    // No demand for any sector: no workshop is opened.
    if (Object.keys(demand).length && Object.values(demand).every(v => !(v > 0))) return null;
    const total = choices.reduce((sum, item) => sum + item.score, 0);
    if (!total) return null;
    let target = clamp(random(), 0, .999999) * total;
    for (const item of choices) { target -= item.score; if (target < 0) return item.type; }
    return choices[choices.length - 1].type;
  }
  function createWorkshop({ house, artisanId, type, day = 0 }) {
    if (!eligibleForWorkshop(house) || !artisanId || !WORKSHOP_TYPES[type]) return null;
    return { id: `workshop:${house.id}`, houseId: house.id, artisanId, type, state: 'closed',
      createdDay: day, revenue: 0, activity: 0, streetFacing: true };
  }
  function updateWorkshop(workshop, { hour = 12, demand = .5, visitors = 0, connected = true, artisanAvailable = true } = {}) {
    if (!workshop) return null;
    const open = connected && artisanAvailable && hour >= 7 && hour < 19;
    const state = !artisanAvailable ? 'vacant' : !open ? 'closed' : visitors > 0 ? 'selling' : demand > 0 ? 'working' : 'open';
    return { ...workshop, state, activity: open ? unit(demand) : 0,
      revenue: workshop.revenue + (state === 'selling' ? Math.max(0, visitors) * unit(demand) : 0) };
  }
  function proposeWorkshops({ houses = [], artisans = [], existing = [], demand = {}, supply = {}, resources = {}, prosperity = 0, random = Math.random, day = 0 } = {}) {
    const occupied = new Set(existing.map(w => w.houseId));
    const assigned = new Set(existing.map(w => w.artisanId));
    const available = artisans.filter(a => (Number(a.level ?? a.tier) === 3) && !assigned.has(a.id) && a.available !== false);
    const proposals = [];
    const registry = workshopRegistry(existing);
    for (const house of houses) {
      if (!eligibleForWorkshop(house) || occupied.has(house.id) || !available.length) continue;
      const type = chooseWorkshopType({ demand, supply, registry, resources, prosperity, random });
      if (!type) continue;
      const artisan = available.shift();
      const workshop = createWorkshop({ house, artisanId: artisan.id, type, day });
      if (workshop) { proposals.push(workshop); occupied.add(house.id); registry[type]++; }
    }
    return proposals;
  }
  window.ConquerUrbanEconomy = Object.freeze({ WORKSHOP_TYPES, WORKSHOP_STATES, eligibleForWorkshop,
    workshopRegistry, chooseWorkshopType, createWorkshop, updateWorkshop, proposeWorkshops });
})();
