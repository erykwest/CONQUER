'use strict';
// Civic-event effects skeleton. No State writes, event scheduling, costs or migration.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ConquerCivicEventEffects = api;
})(typeof window !== 'undefined' ? window : null, function () {
  const DATA = {
    fair:       {label:'Fiera',             setup:'feast',   cost:{gold:40,food:10}, happiness:{1:.025,2:.09,3:.10}, loyaltyL4:.01, prestige:.055, radius:16},
    joust:      {label:'Giostra',           setup:'joust',   cost:{gold:85,food:20}, happiness:{1:.06,2:.03,3:.05}, loyaltyL4:.13, prestige:.10, radius:18},
    religious:  {label:'Festa religiosa',   setup:'feast',   cost:{gold:25,food:30}, happiness:{1:.12,2:.08,3:.05}, loyaltyL4:.025,prestige:.055, radius:14},
    harvest:    {label:'Festa del raccolto',setup:'feast',   cost:{gold:15,food:35}, happiness:{1:.13,2:.075,3:.025},loyaltyL4:.015,prestige:.035, radius:14},
    banquet:    {label:'Banchetto nobiliare',setup:'feast',  cost:{gold:100,food:45},happiness:{1:0,2:0,3:.015},   loyaltyL4:.16, prestige:.08, radius:10},
    tourney:    {label:'Torneo',            setup:'tourney', cost:{gold:60,food:15}, happiness:{1:.09,2:.05,3:.04}, loyaltyL4:.085,prestige:.07, radius:18},
    circus:     {label:'Circo itinerante',  setup:'circus',  cost:{gold:35,food:15}, happiness:{1:.085,2:.07,3:.055},loyaltyL4:.01, prestige:.045, radius:14},
    theatre:    {label:'Spettacolo teatrale',setup:'theatre',cost:{gold:30,food:5},  happiness:{1:.035,2:.065,3:.095},loyaltyL4:.03, prestige:.055, radius:12}
  };
  // Costs and modifiers are placeholders. Existing venues own phase and graphics.
  const CATALOG = Object.freeze(Object.fromEntries(Object.entries(DATA).map(([kind, d]) => [
    kind, Object.freeze({...d, venues:Object.freeze(['festivalGround']),
      cost:Object.freeze({...d.cost}), happiness:Object.freeze({...d.happiness})})
  ])));
  // Feast is intentionally ambiguous: fairs, religious and harvest feasts and
  // banquets share props, so none may acquire a social effect without civicKind.
  const UNIQUE_SETUP = Object.freeze({joust:'joust',tourney:'tourney',circus:'circus',theatre:'theatre'});
  const ACTIVE = new Set(['preparing','active','clearing']);
  const finite = n => typeof n === 'number' && Number.isFinite(n);
  const nonnegative = n => finite(n) ? Math.max(0,n) : 0;
  const clamp = (n,min,max) => Math.max(min,Math.min(max,n));
  const validVenue = venue => !!venue && venue.type === 'eventVenue' && venue.venue === 'festivalGround';
  const repeatFactor = count => 1 / (1 + .5 * Math.floor(nonnegative(count)));
  const scaled = (kind, repeats = 0) => {
    const event = CATALOG[kind];
    if (!event) return null;
    const factor = repeatFactor(repeats);
    return {happiness:{1:event.happiness[1]*factor,2:event.happiness[2]*factor,
      3:event.happiness[3]*factor}, loyaltyL4:event.loyaltyL4*factor,
      prestige:event.prestige*factor, radius:event.radius};
  };
  function preview(kind, venue, {resources, repeats = 0} = {}) {
    const event = CATALOG[kind];
    if (!event) return {eligible:false, affordable:null, reasons:['unknown-event'], action:'preview-only'};
    const reasons = [];
    if (!validVenue(venue)) reasons.push('incompatible-venue');
    if (validVenue(venue) && ((finite(venue.w) && venue.w < 14) ||
        (finite(venue.h) && venue.h < 10))) reasons.push('venue-too-small');
    if (venue?.event && ACTIVE.has(venue.event.phase) &&
        (venue.event.setup !== event.setup ||
          (venue.event.civicKind && venue.event.civicKind !== kind))) {
      reasons.push('venue-occupied');
    }
    const affordable = resources === undefined ? null :
      Object.entries(event.cost).every(([key, amount]) =>
        finite(resources?.[key]) && resources[key] >= amount);
    if (affordable === false) reasons.push('insufficient-resources');
    return {kind, setup:event.setup, eligible:reasons.length===0, affordable,
      cost:{...event.cost}, effects:scaled(kind,repeats), reasons, action:'preview-only'};
  }
  function activeEvents(venues = [], {repeatsByKind = {}} = {}) {
    if (!Array.isArray(venues)) return [];
    const seen = new Set(), result = [];
    for (const venue of venues) {
      if (!validVenue(venue) || venue.event?.phase !== 'active' ||
          !finite(venue.x) || !finite(venue.y)) continue;
      const kind = venue.event.civicKind || UNIQUE_SETUP[venue.event.setup];
      const event = CATALOG[kind];
      if (!event || venue.event.setup !== event.setup ||
          (finite(venue.w) && venue.w < 14) ||
          (finite(venue.h) && venue.h < 10)) continue;
      const id = String(venue.id ?? venue.x + ',' + venue.y);
      if (seen.has(id)) continue;
      seen.add(id);
      result.push({id,kind,x:venue.x,y:venue.y,
        effects:scaled(kind,repeatsByKind?.[kind])});
    }
    return result;
  }
  function settlementEffects(venues = [], options = {}) {
    const result = {happiness:{1:0,2:0,3:0},loyaltyL4:0,activeEvents:0,action:'preview-only'};
    for (const item of activeEvents(venues, options)) {
      result.activeEvents++;
      for (const tier of [1,2,3]) result.happiness[tier] += item.effects.happiness[tier];
      result.loyaltyL4 += item.effects.loyaltyL4;
    }
    // Caps affect only the preview. Real household and feudal scores stay external.
    for (const tier of [1,2,3]) result.happiness[tier] = clamp(result.happiness[tier],0,.25);
    result.loyaltyL4 = clamp(result.loyaltyL4,0,.25);
    return result;
  }
  function localPrestige(venues, x, y, options = {}) {
    if (!finite(x) || !finite(y)) throw new TypeError('finite coordinates required');
    let delta = 0;
    for (const item of activeEvents(venues, options)) {
      const falloff = Math.max(0, 1 - Math.hypot(x-item.x,y-item.y) / item.effects.radius);
      delta += item.effects.prestige * falloff * falloff;
    }
    return clamp(delta,0,.25); // Temporary contribution only.
  }
  // Optional read-only bridge to PR #206. Uses its original at() and BASE; never
  // mutates the heatmap, the serialized State or the existing venue lifecycle.
  function heatmapAt(heatApi, x, y, {sources = [], venues = [], base, repeatsByKind = {}} = {}) {
    if (typeof heatApi?.at !== 'function' || !heatApi.BASE) {
      throw new TypeError('ConquerUrbanHeatmaps API required');
    }
    const sourceBase = base || heatApi.BASE;
    const prestige = finite(sourceBase.prestige) ? sourceBase.prestige : heatApi.BASE.prestige;
    return heatApi.at(x, y, sources, {...sourceBase,
      prestige:prestige + localPrestige(venues,x,y,{repeatsByKind})});
  }
  return Object.freeze({VERSION:1, CATALOG, UNIQUE_SETUP, preview, activeEvents,
    settlementEffects, localPrestige, heatmapAt});
});
