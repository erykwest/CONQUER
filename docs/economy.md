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

## Rations and happiness by class (branch `jobmanager`, 20/10/2026)

- **Default civilian food consumption uses the market only.** The lord's food store is not used automatically, even when residents cannot afford food. Builder's test resources are still a separate inventory.
- The management Policies panel explicitly authorizes **full castle rations** (up to 100% of a cohort's weekly food requirement) or **half castle rations** (up to 50%). Available food is shared proportionally across L1–L4, never fabricated, and deducted from the castle ledger. Households may buy the remainder from market lots.
- Four saved happiness values (`economy.happiness.L1`, `L2`, `L3`, `L4`) change separately during Saturday market accounting. Insufficient food lowers the affected class happiness; half rations lower morale even when households can buy the remainder. Delivered full rations give a small bonus. Existing saves migrate their former `welfare` to each class, then `welfare` becomes a population-weighted aggregate used by the preexisting wage calculation.
- The former inert 0–100 `rations` slider is replaced by `market` (default), `full`, `half`, persisted in `economy.rationMode` for local and cloud saves.
- L1/L2 are bound serfs who cannot emigrate; L3/L4 are free to leave. **The migration simulation itself remains unimplemented**, distinct from the food and happiness rules.
- Run `node qa/economy-rations-regression.cjs` and existing economy/jobmanager QA suites.

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
- Construction-testing resources (`State.resources`, currently initialized at 10,000) remain separate from the economic ledger intentionally until construction and troop provisioning are migrated.

## Deliberately not claimed as implemented
- No complete region-to-region trading system or dynamically discovered foreign demand yet; export orders are injected via API.
- No automatic physical creation of new industries by L4 yet; month-end currently computes available investment capital only.
- Existing visual field cropping phases have a faster cycle: the economic layer only books at most one autumn harvest; season-specific visual field calendar still needs reconciliation.
- No fully modeled extraction depletion, multi-crop substitutions, housing promotion, alternative commodity quality, collective market storage capacity, or spoilage yet.
- No physical capacity mapping for castle built-sections; reserve targets currently function as provisional per-good caps.
- No automatic matching of army/castle construction resource costs to the economic reserve (testing inventory is separate).

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
