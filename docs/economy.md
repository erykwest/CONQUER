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
