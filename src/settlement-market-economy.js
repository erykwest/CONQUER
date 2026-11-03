'use strict';
// CONQUER L3 goods market (from feature/autonomous-urban-economy): expandable
// commodity catalog, aggregated "Beni L3", weekly prices with a one-week lag.
// Pure rules; ConquerCommerce saves the state and drives the calendar.
(() => {
  const COMMODITIES = Object.freeze({
    leatherGoods: Object.freeze({ group: 'L3', basePrice: 12, inputs: ['wood'], tradeWeight: 1 }),
    metalGoods: Object.freeze({ group: 'L3', basePrice: 18, inputs: ['metal'], tradeWeight: 1 }),
    pottery: Object.freeze({ group: 'L3', basePrice: 8, inputs: [], tradeWeight: 1 }),
    textiles: Object.freeze({ group: 'L3', basePrice: 11, inputs: [], tradeWeight: 1 }),
    jewelry: Object.freeze({ group: 'L3', basePrice: 45, inputs: ['metal'], tradeWeight: .5 })
  });
  // Provisional trade → commodity mapping, to be validated with real recipes.
  const WORKSHOP_OUTPUT = Object.freeze({
    leatherworker: 'leatherGoods', blacksmith: 'metalGoods', potter: 'pottery',
    weaver: 'textiles', tailor: 'textiles', carpenter: 'metalGoods', goldsmith: 'jewelry'
  });
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  function priceFromMarket({ basePrice, previousPrice = basePrice, demand = 0, supply = 0, importCost = 0, elasticity = .3 }) {
    const imbalance = (Math.max(0, demand) - Math.max(0, supply)) / Math.max(1, demand, supply);
    const target = basePrice * (1 + clamp(imbalance, -1, 1) * elasticity) + Math.max(0, importCost);
    return Math.round(Math.max(basePrice * .25, previousPrice * .7 + target * .3) * 100) / 100;
  }
  function aggregateGoods(stock = {}, catalog = COMMODITIES) {
    return Object.entries(catalog).reduce((acc, [id, item]) => {
      if (item.group !== 'L3') return acc;
      const quantity = Math.max(0, stock[id] ?? 0);
      acc.quantity += quantity;
      acc.referenceValue += quantity * item.basePrice;
      return acc;
    }, { quantity: 0, referenceValue: 0 });
  }
  // Stable staggering: one commodity per settlement per call; each commodity
  // is repriced at most once per simulation week.
  function createMarketState(settlementId, prices = {}) {
    return { settlementId, prices: { ...prices }, lastUpdatedWeek: {}, cursor: 0, weeklyObservations: {} };
  }
  // Record a completed week. Week N prices use observations from week N-1.
  function recordMarketWeek(state, { week, demand = {}, supply = {}, importCost = {} }) {
    const weeklyObservations = { ...state.weeklyObservations, [week]: { demand: { ...demand }, supply: { ...supply }, importCost: { ...importCost } } };
    for (const key of Object.keys(weeklyObservations)) if (Number(key) < week - 3) delete weeklyObservations[key];
    return { ...state, weeklyObservations };
  }
  function stepMarket(state, { week, catalog = COMMODITIES }) {
    const ids = Object.keys(catalog);
    if (!ids.length) return state;
    const cursor = state.cursor % ids.length, id = ids[cursor], item = catalog[id];
    const prices = { ...state.prices }, lastUpdatedWeek = { ...state.lastUpdatedWeek };
    const observation = state.weeklyObservations?.[week - 1];
    if (observation && lastUpdatedWeek[id] !== week) {
      prices[id] = priceFromMarket({ basePrice: item.basePrice, previousPrice: prices[id] ?? item.basePrice,
        demand: observation.demand[id] ?? 0, supply: observation.supply[id] ?? 0, importCost: observation.importCost[id] ?? 0 });
      lastUpdatedWeek[id] = week;
    }
    return { ...state, prices, lastUpdatedWeek, cursor: (cursor + 1) % ids.length };
  }
  function territoryAffinity({ localInput = 0, importAvailability = 0, localDemand = 0 } = {}) {
    return clamp(.55 * localInput + .2 * importAvailability + .25 * localDemand, 0, 1);
  }
  window.ConquerMarketEconomy = Object.freeze({ COMMODITIES, WORKSHOP_OUTPUT, priceFromMarket, aggregateGoods,
    createMarketState, recordMarketWeek, stepMarket, territoryAffinity });
})();
