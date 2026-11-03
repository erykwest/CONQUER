# Autonomous Urban Economy — architecture and integration status

## Scope
CONQUER simulates an autonomous urban economy, **not** player-directed commercial micromanagement. L3 houses can host street-facing ground-floor workshops. Workshops are part of houses, not independently player-placed buildings. A varied catalog of trades gives settlements visual identity, even when the economic UI presents aggregated **Beni L3**.

**Status:** standalone skeleton modules committed on `feature/autonomous-urban-economy`; **not yet connected** to the game's live simulation, calendar, citizen/house schemas, save data, or renderer. No runtime testing is claimed.

## Modules
- `urbanEconomy.js`: L3 eligibility, workshop creation, daily states, registry, weighted selection, and proposals.
- `marketEconomy.js`: expandable commodity catalog, L3 goods aggregation, local price calculations, prior-week observations, staggered pricing, and territory affinity.

## Autonomous workshop spawning
- Each eligible completed, accessible, street-facing L3 house can host **at most one** workshop, assigned to an available L3 artisan.
- `workshopRegistry(existing)` counts shops by trade in the city.
- `chooseWorkshopType` uses **soft probabilistic weights**: baseline trade weight, local demand, resource availability, missing-trade bonus, existing-trade saturation, and prosperity (especially for goldsmiths).
- Missing trades are favored but **never guaranteed**. Multiple workshops of one trade remain possible, especially in resource-specialized settlements.
- `proposeWorkshops` updates the provisional registry between each proposal to avoid over-spawning a specialty in the same batch.
- Small settlements can lack entire trades; their eventual demand should be met through imports once trade flows are integrated.
- `resources[type]` currently expresses normalized local input availability (0..1) **per workshop type**. Connecting geological deposits, actual extraction, inventories, and import access is future work.
- The workshop generator remains autonomous; there are no player shop placement or trading controls.

## Multiresource economy, aggregated presentation
- `COMMODITIES` contains individually addressable L3 goods (leather goods, metal goods, pottery, textiles, jewelry). New commodities can be added without changing the aggregate interface.
- `aggregateGoods(stock, catalog)` returns total quantity and **reference value** for L3 goods; reference value uses base prices, not current market prices.
- `WORKSHOP_OUTPUT` maps trade types to commodity IDs. These are **provisional mappings** for the skeleton and must be validated before production use.
- Distinct commodity stocks, production/consumption flows, imports/exports, trade routes, market inventories, and prosperity/tribute effects **are not yet wired up**.
- Goods are an economic abstraction, not an invitation to add player-facing warehouse micromanagement.

## Local prices: weekly observations and one-week lag
- Each commodity has a local price affected by demand, supply, and optional import cost.
- `recordMarketWeek(state, {week, demand, supply, importCost})` records the **completed** week's observations.
- `stepMarket(state, {week, catalog})` uses **week - 1** observations when calculating prices for week N. Current-week activity cannot affect the current week's prices.
- When the preceding week's observation is missing, the price remains unchanged.
- The target price responds to normalized demand/supply imbalance; a smoothing factor retains 70% of the previous price and incorporates 30% of the target. The result has a minimum floor of 25% of base price.
- Each call to `stepMarket` processes **one commodity per settlement** using a cursor, and each commodity is updated **at most once per week**.
- **Scheduler requirement:** distribute settlement and commodity updates throughout the simulation week, ensuring at least one tick per commodity per settlement. Do not run all settlements/commodities in one synchronous batch.
- **Data lifecycle requirement:** close and record week N before week N+1 pricing; persistence of weekly observations, cursors, and prices must be added.

## Territorial identity and imports
Resource-rich territories should probabilistically favor workshops using those resources. Missing local inputs should raise import dependence/cost, not absolutely prohibit trades. The current skeleton exposes `territoryAffinity` and `resources` weights but **does not yet calculate imports, territorial extraction, or trade connectivity**.

## Implementation checklist (not completed)
1. Connect actual L3 house/artisan records, road frontage, workshop lifecycle and save/load.
2. Connect local resource availability, settlement registry, population demand, supply, production and consumption.
3. Define and persist market-week close snapshots and integrate the staggered update cursor into the game calendar.
4. Connect import supply/cost for uncovered sectors and settlement-to-settlement trading.
5. Expose only aggregated Beni L3 and meaningful prosperity/trade signals in the player UI.
6. Implement street-front SVG shop assets, signs, goods, opening states and ambient artisan activity.
7. Add and execute tests for week-lag boundaries, missing observations, staggered updates, weighted selection, empty-city diversity and small-settlement imports.

## Design constraints
- Avoid uncontrolled commodity proliferation in the player interface.
- Avoid sudden price jumps and full-market calculation spikes.
- Maintain systemic local variation: cities should tend toward diversity, while deposits and trade access create specialization.
- Keep military equipment production distinct when it affects combat or siege readiness.
