# CONQUER — Economy branch (V1 foundation)

## Guiding rule
The economic simulation operates on **aggregate social cohorts (L1–L4)**; visible villagers are not individual economic agents. Each economic activity has an independent physical structure, but private ownership belongs to the pooled L4 sector, not a named person.

## Economic goods
- Primary: `food`, `wood`, `stone`, `metal`.
- Manufactured: `equipment` (workshop consumes metal and wood).
- High-value: `luxury`.
- Gold is currency, not a physical commodity in the market books.

## Economic schedules
| Schedule | Action |
| --- | --- |
| Mon–Fri | Daily production where a productive building and matching workforce are present |
| Saturday | Weekly local consumption, trades, price discovery, and any bounded export orders |
| Sunday | No civilian work |
| Month end | L1/L2 aggregate wage transfers; L4 investment capacity assessment |
| Year end | Profitability per activity, abandonment checks, annual wage/benchmark repricing |
| Autumn window | One economic field/vineyard harvest per year, contingent on completed agricultural work |

The **work clock** for field labor skips both Saturday and Sunday; plant growth advances independently of workdays.

## Wage and investment rules
- L1 baseline 1 gold/month; L2 baseline 2 gold/month.
- L3 workshop benchmark 3 gold/month (not a wage deducted again).
- Annual welfare-based wage/benchmark multiplier: `0.5 + welfare / 100` (0.5×–1.5×).
- L4 minimum desirable after-tax margin: 20%.
- Farm/vineyard abandonment: 3 consecutive negative annual operating balances.
- Nonfarm private abandonment: 2 consecutive negative annual operating balances.
- Strategic lord-owned production may continue even when not profitable.

## Castle vs market
- Owner-dependent production: lord or private L4.
- Per-good lord sale share: 0, 25, 50, 75, or 100%.
- The non-sale share is retained up to a configurable **per-good castle reserve target**.
- Once target is reached, all incremental production goes to market.
- Domestic buyers use their aggregate cohort cash, and price is sensitive to relative supply/demand.
- A foreign order must be explicitly available (`setExternalDemand`); absent orders, unsold goods stay for later periods rather than being exported by fiat.
- Activity sale/purchase transfers ownership between lord and aggregate private L4 capital pool at an automatically determined value.
- The market has commodity-specific seller lots, so sales and tax income are not credited until goods actually transact.

## Integration currently present
- Classic-script engine: `src/settlement-economy.js`, invoked from the existing settlement simulation frame.
- Economic state persisted to localStorage and in the cloud settlement policies document.
- Economy tab nested in the Settlement sidebar shows stocks, prices, welfare, cohort population, sale shares, reserve targets, and activity transfers.
- Physically constructed **fields** register as economic activities. Other industry types are supported by the engine contract (`loggingCamp`, `quarry`, `mine`, `workshop`, `vineyard`) but still require Builder/urban placement and rendering implementation.
- On this branch, post-founding `State.resources` reflects the economic castle inventory and treasury. Troop provisioning remains outside the unified ledger.

## Deliberately not claimed as implemented
- No complete region-to-region trading system or dynamically discovered foreign demand yet; export orders are injected via API.
- No automatic physical creation of new industries by L4 yet; month-end currently computes available investment capital only.
- Existing visual field cropping phases have a faster cycle: the economic layer only books at most one autumn harvest; season-specific visual field calendar still needs reconciliation.
- No fully modeled extraction depletion, multi-crop substitutions, housing promotion, alternative commodity quality, collective market storage capacity, or spoilage yet.
- No physical capacity mapping for castle built-sections; reserve targets currently function as provisional per-good caps.
- Manual Builder construction now consumes economic castle reserves on the feature branch; army provisioning and castle upkeep remain separate.

## Builder wages: lord contracts vs spontaneous growth (20 October 2026, PR #55)

**User direction:** the lord hires and pays L1 builders for projects ordered by the player. When a structure emerges from spontaneous village growth, the wage equivalent is a component of its **spawn cost**, not a second invoice to the lord.

- **Manual, lord-financed:** placement still charges materials and the fixed `constructionCost.gold` from `State.economy.castleGold`. As each manual construction V2 progresses, `ConquerEconomy.payConstructionWork(site,workerDays)` transfers actual wages from castle gold to the aggregate `wallet.L1`. The price is `wage.L1 / 20` gold per completed worker-day (at the initial 1 gold/month rate: **0.05 gold/worker-day**). The builder is paid for *actual work performed*, not for merely being shown or reserved, and not again at month-end. Annual wage repricing automatically affects subsequent work, while the original fixed building cost is not changed.
- **No money, no progress:** if lord's available treasury is insufficient, work is limited proportionally to the affordable fraction and then pauses; it resumes as soon as treasury money is available. The same named construction crew and route remain in effect; no separate fictitious workers. The current pay is recorded as `construction.wagesPaid`, and an aggregated, persistent `State.economy.constructionPayroll.total/bySite` supports audit/UI. The values survive existing local/cloud saves and do not replay on repeated simulation ticks.
- **Cancellation/refunds:** the old rule refunds fixed `buildCost` at deletion, but **previous wages are never refunded**. This separates recoverable goods/capital commitments from consumed labor, without rolling back L1 household wages.
- **Spontaneous spawn:** `beginConstruction(auto)` attaches `spawnCost: {laborDays,laborGold,totalGold,payer:'spontaneous'}` to procedural houses/fields/roads. The quote uses the same current L1 wage-rate equivalence. It is **embedded once in the candidate's spawn valuation** and becomes part of the aggregate `spontaneousSpawnLabor` only when the structure actually exists in `State.structures`. Rejected candidates have no budget effect. Procedural building does not call manual payroll, and the lord is **not** debited. This is an *imputed self-organized cost*: the existing autonomous growth system has no owner-level cash budget or actual payment origin yet, so no fake wage transfer is invented.
- **UI:** economy overview displays lord payroll paid and aggregate spontaneous labor value separately; the selected manual building displays wages paid and estimated remaining wages at the current rate, while spontaneous buildings display the wage component included in spawn.

**Limitations:** the autonomous cost currently models labor only, not a complete materials recipe or a true private finance source; additional resource costs should be added to `spawnCost` when the economic ownership and supply chain exist. Do not confuse this virtual spawn valuation with cash spent by the lord or with actual household income. Browser visual checks and balancing are separate.

Regression: `qa/construction-payroll-regression.cjs` tests partial treasury, pausing/resuming, L1 payments, wages vs fixed material refunds, spontaneous valuation, candidates not committed, re-pricing and save migration.

## Manual construction staffed by idle L1 (20 October 2026, PR #55)

Manual structures (castle towers, gates, walls, palisades, built sections, manually placed roads and industries) now use **construction V2**: a persistent quantity of worker-days, rather than automatically completing after calendar time. The pre-existing `buildDuration` values are interpreted as the effort required from **one L1 builder**. A site may receive up to **three** simultaneously allocated L1s. Workers are distributed breadth-first by stable creation order, one per site before second/third workers, and **cannot be counted again** in an industrial or agricultural workplace.

`ConquerEconomy.availableBuilders()` calculates remaining L1 after industry/active field assignments; finished or seasonally inactive fields no longer reserve L1 forever. If no L1 remains, construction progress freezes. Work is accrued in the same weekday shift window as fields, 0.14–0.52 of each Monday–Friday day; Saturday market and Sunday rest do not add work. Alarm mode suspends the construction pool. The game simulation ticks construction alongside the economy and issues completion/scene maintenance only on a real work-based completion.

Each V2 structure persists `{version,startedDay,workRequired,workDone,lastWorkDay,workers,completedDay}`. Manually built structures saved with V1 deadlines are converted lazily, preserving their already-completed fraction. Already-finished V1 structures remain finished. Existing **procedurally spawned** houses, fields and roads deliberately keep the old timer in this iteration: gating automated founding infrastructure behind L1 work could deadlock settlement population growth. This is a scoped milestone, not a claim that all urban generation is work-driven.

Progress bars and selection UI show worker allocation and remaining effort, with a small builder count above manually constructed sites. The four founding L1s can supply early manual work without requiring a completed house.

**Visual commutes (20/10 tranche):** Each L1 worker has a deterministic display identity, either the working male resident of an L1 house (`houseId:m:0`) or one of the founding L1s near the well. `ConquerEconomy.laborAllocation()` reserves individuals already committed to industry, fields or livestock and provides spare IDs; `constructionCrewAssignments()` is called by BOTH the simulation and figure rendering. There is no parallel decorative pool of constructors. Each builder has a cached pedestrian route from the house door or the well to the actual building's access side, with a morning trip (0.055–0.14 day), presence at the site during paid-work hours (0.14–0.52) and return (0.52–0.63). If no pedestrian route is found, that worker **is not assigned and generates no construction effort**. Industry-assigned founders are hidden from the free crew near the well rather than duplicated. The route cache follows existing navigation invalidation; winter footprints use the actual walking position.

**Further work:** balancing/job policy between urgent repairs, agriculture and industries; integrating construction among automatically generated settlements after bootstrap safeguards; browser end-to-end validation of pathfinding for different building geometries and old saves. Figures are a visual projection of aggregate labor, not separate economic persons. The economy remains aggregate and should not invent personal accounts for each worker.

Regression: `qa/construction-workers-regression.cjs` and `qa/construction-commute-regression.cjs`, alongside the economy, founding, placement and population suites in `.github/workflows/economy-flows-regression.yml`.

## Real construction inventory and founding labor (20 October 2026, feature branch)

The Builder and economic simulation now share a source of truth:
- **Gold:** `State.economy.castleGold`.
- **Construction goods:** `State.economy.castle[good]`. A good offered in `lots` belongs to market sellers and is **not** free construction material: it must be acquired first in a later trade/procurement iteration.
- **`State.resources` is a display/backward-compatible projection** after founding, not a separate source of construction credit. Pre-founding test values of 10,000 are discarded once the charter is initialized.
- Placement preflight and building payments call `ConquerEconomy.canBuild/spendBuild`, with atomic refusal of unaffordable builds. Undo/deletion calls `refundBuild`; existing **full-cost refund semantics** are preserved for now and count as material recovery, not new production.
- Weekly economic balances include actual material spending on constructions as immediate `construction` demand/consumption and material refunds as `recovered`. Gold is a monetary expenditure rather than a physical commodity.
- Initial settlement charter (**one-time, balancing placeholders**): castle food 45, wood 200, stone 180, metal 16, gold +400 on top of the previous economic treasury; lord-owned local market food 55 and wood 20. Founding the well is the start trigger. Without a market food lot, initial residents would starve while food sat locked in castle reserves.
- Founding creates **four visible adult L1 workers without housing**, recorded as `State.village.foundingWorkers` and included in the economic population and labor available to productive buildings. They are not four L1 houses and do not fabricate L4 owners.
- Existing founded savegames with no charter marker receive a **one-time migration charter**. Their legacy 10,000-unit construction-test inventory is never interpreted as genuine stock. The charter marker, workers, stocks and balances persist in existing local/cloud saves.
- Reset/new map returns to the pre-founding provisional environment; deleting the founding well removes that village's economic ledger.

**Not yet implemented:** construction duration staffed by L1 (the old time-based construction progress remains); physical provisioning of troops and castle upkeep; direct purchasing of private market lots for construction; warehouse capacity; realistic salvage fractions; mine stone/metal decision; unified agricultural seasons. This is the Builder/treasury resource connection, not full territorial logistics or a self-building city.

Tests: `qa/economy-builder-integration.cjs`, `qa/economy-balance-regression.cjs`, `qa/founding-regression.cjs`, `qa/builder-placement-regression.cjs`, `qa/refactor-app-population-regression.cjs` in `.github/workflows/economy-flows-regression.yml`.

## Weekly production, consumption and shortage accounting (19 October 2026, feature branch)

The existing economic tick retains its cadence: Mon–Fri production, Saturday household purchases, enterprise input procurement and market settlement, Sunday rest. A **per-good balance** now records gross workday production, intended weekly demand, demand fulfilled by actual transfers, physically consumed units, external exports, remaining market/castle/industry-buffer stocks and unmet demand.

The distinction matters:
- `unmetSupply`: goods missing from **accessible market lots**.
- `unmetBudget`: unsatisfied purchasing power while goods remain for sale.
- `netProduction = produced - demand`: a structural flow mismatch, not a storage delta.
- `netPhysical = produced - consumed - exported`: actual change in the local physical resource pool, including industry buffers and castle reserves.
- `reserveGap`: target castle stock still unmet; a strategic target, **not** a fabricated purchase or consumption.

For households, weekly baseline food is 0.55 per resident in every cohort, luxury is 0.08 for L3 and 0.25 for L4; these preexisting coefficients are preserved. **New provisional need:** domestic fuel/general upkeep consumes wood per resident per week: L1 0.06, L2 0.08, L3 0.10, L4 0.12. All are balancing parameters, not historical realism claims. Industry input purchases replenish buffers; input goods count as *consumed* only when production actually uses them. Stone, equipment and other strategic categories do **not** acquire arbitrary demand before construction, garrison and castle upkeep draw from the same ledger.

Each Saturday stores a result under `State.economy.lastBalance.goods[good]`; up to eight weeks of history survive save/load and the last four completed markets supply a rolling production/demand signal. The categories are `supply-shortage`, `purchasing-power`, `production-deficit`, `surplus` and `balanced`. Signals are diagnostic, **not automatic construction orders**. Existing v1 saves lazily get flow counters without resetting money or stock.

The monthly `investmentCapacity` can be positive only when an actual L4 housing cohort is present; the private sector's initial capital balance by itself does not authorize spontaneous enterprises. **Not implemented:** automatic business creation or housing promotion, forecast investment profitability, genuine castle/Builder consumption, military provisioning, and full region-to-region flow.

Tests: `qa/economy-regression.cjs`, `qa/economy-industries-regression.cjs`, `qa/economy-balance-regression.cjs`, run in `.github/workflows/economy-flows-regression.yml`. [CI success, branch](https://github.com/erykwest/CONQUER/actions/runs/39253184968). The workflow is deterministic Node QA, **not** a browser or live simulation certification.

## Single L1 allocator, grazing, logging, rations and happiness (28 October 2026, `feature/economy-labour`)

`laborAllocation(day)` is the only L1 scheduler (the `jobmanager` branch's `ConquerJobManager` was not ported). Order: industries → protected herders → construction crews → logging fill → herders back to flocks → idle.

- **Herders:** L1 houses whose lot is `goat` or `shepherd`. At least one herds while any flock exists; more while accessible food (market lots, plus castle food only under a ration order) covers less than 14 days of household food need. Each herder adds 0.9 private food per working day; alarms stop grazing.
- **Logging:** while castle + market wood is below min(20, wood reserve) up to two L1 go to logging camps before construction; otherwise camps take the L1 left after open sites (3 per site) are staffed. Loggers walk to the camp like builders.
- **Rations:** `State.policies.rations` = `market` (default), `half`, `full`. At the Saturday market the castle issues need × 0, ½ or 1, proportionally when stock is short; households buy the rest.
- **Happiness:** `economy.happiness.L1..L4`, 0–100. Fully fed +0.2/week, hungry −max(0.5, 5×shortfall), half rations −1.2, full rations up to +0.8. `welfare` is the resident-weighted mean.
- **Open:** whether L1 may farm (decision D-051).

Regression: `node qa/labor-jobs-regression.cjs`, `node qa/economy-rations-regression.cjs`.
## Regression
Run `node qa/economy-regression.cjs` in a local checkout. The test suite covers labor weekends, aggregate cohorts, reserve saturation, sales, exports, ownership, and monthly boundaries.

## Extractive buildings — placeholder implementation (economy branch)

The economy Builder offers three manual, lord-owned industry footprints of differing sizes. The **entire footprint** must remain in the whitezone (`x,y ∈ [50,150]`) and avoid water, forests and existing manual buildings. **Quarry and mine are deliberately allowed directly on steep rocky slopes**; a flat-terrace requirement applies only to logging camps. Existing 2×2U saved quarries/mines migrate to the new footprints.

| Building | Graphic placeholder | Placement rule | Workers | Daily workday production |
| --- | --- | --- | --- | --- |
| Logging camp | Brown 2×2U low block | Flat ground with forest boundary within 10U of building centre | 2 × L1 | 1 wood per active worker |
| Quarry | Light-grey **3×3U** low block | **Any part** of the rotated 3×3U footprint must overlap a steep rocky slope; centre need not be on the slope | 2 × L2 | 1 stone per active worker |
| Mine | Dark anthracite-grey **1×1U** low block | **Centre point** must sit directly on a steep rocky slope; edge overlap alone is insufficient | 2 × L2 | 1 stone per active worker **as currently requested** |

Worker numbers are balancing placeholders (2 each), and are limited by the aggregate L1/L2 labor pool: without enough workers, output is lower or zero. Saturday is market day; Sunday is rest. A logging camp displays two anonymous small walkers heading to the forest edge during workdays (not persistent individual laborers). No forest depletion, individual chopping animation, or regeneration logic has been implemented.

**Open design decision:** the mine currently yields stone according to the latest instruction; earlier economic design assumed metal. Choose the definitive mined good before balancing the metallurgical chain. Rendering intentionally remains temporary while SVG assets are authored in `urban`. No claim is made that the `urban` branch art has been merged.

Regression: `node qa/economy-industries-regression.cjs` (whitezone, forest range, quarry/mine terrain, collisions, staffing, daily output and weekends).

## General Builder feature: rotate existing buildings and invalid red ghosts

This behavior is **shared across the Builder**, not a special rule of industrial structures.

- After placement: select a house, market, tavern, church, training ground, logging camp, quarry or mine, then rotate by **±15° or 180°** in the structure panel.
- Existing tower and gate ±15°/180° controls remain, but now also run collision/terrain preflight before changing orientation.
- Rotation keeps the original world centre and construction progress, and is rejected without modifying the structure if its new footprint is blocked.
- Placement previews are translucent in their ordinary style when permitted; rejected footprints receive a **red fill and red outline** (including roads, walls, civic buildings, towers, industries, and the village well). A rejected oriented placement retains its preview rather than disappearing.
- The shared `src/settlement-placement.js` validator checks whitezone boundaries, ground/terrain, nature obstacles, manual collisions, village-well uniqueness and construction affordability. Existing intended tower/gate/wall sockets and market-road crossings are preserved.
- Industry 2×2 / 3×3 / 1×1U placeholders include a direction marker so rotations are visually distinguishable before their SVGs are introduced.
- Tests: `node qa/builder-placement-regression.cjs`. The Builder remains a classic-script Canvas application; no extra rendering dependencies.

## Proposal: clay construction alternative (branch `clay`, 2026-10-19)

**DOCUMENTATION ONLY — not present in the economy engine yet.** The approved design adds `clay` to the economic commodities without adding a separate brick good. A `quarry` placed within 6 U of a river/stream/lake bank may specialize in `clay`; existing stone quarries remain unchanged. Stone-consuming construction costs may be substituted 1:1 in quantity with clay when `brick` is selected as the building material, yielding a brown/red visual variant and 80% of the equivalent masonry structural integrity. The already noted gap between ledger goods and `State.resources` must be handled without inventing an independent clay storage system. No kilns, pottery or additional production chain in the first implementation.

See [clay development guide](CLAY-DEVELOPMENT.md) and [clay QA](CLAY-REGRESSION-PLAN.md).

## Weekly management-panel history (branch `panels`, 29/10/2026)

After the actual Saturday market, the existing Economy V1 state stores up to **26 market-week snapshots** in `panelHistory`: day, aggregate population, welfare, happiness per tier, market prices per good, L1 job allocation, and site output/ownership captured at production time. This is a bounded projection of the same ledger, **not a second inventory**. `weekProducedSites` is reset after each weekly sample; historical ownership is not retroactively changed when an enterprise is sold. Old version-1 saves acquire these optional fields lazily without reset. Outputs processed by a mill are attributed to the mill as output of that conversion; this history is not a per-crop agronomic ledger. No historical values are inferred for prior saves.

