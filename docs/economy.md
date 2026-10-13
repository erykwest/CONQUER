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

The economy Builder now offers three manual, lord-owned `2×2U` industry footprints. They must sit **entirely inside the whitezone** (`x,y ∈ [50,150]`), on a single flat terrace, outside water, forest polygons, slopes, and existing manual buildings. Automatic urban objects may be displaced through the existing Builder procedure.

| Building | Graphic placeholder | Placement rule | Workers | Daily workday production |
| --- | --- | --- | --- | --- |
| Logging camp | Brown 2×2U low block | Forest boundary within 10U of building centre; footprint must stay outside forest | 2 × L1 | 1 wood per active worker |
| Quarry | Light-grey 2×2U low block | Elevated flat hill terrace (H1+) within 3.5U of a rocky hillside band | 2 × L2 | 1 stone per active worker |
| Mine | Dark anthracite-grey 2×2U low block | Flat terrace within 3.5U of a steep rock face, not inside the cliff | 2 × L2 | 1 stone per active worker **as currently requested** |

Worker numbers are balancing placeholders (2 each), and are limited by the aggregate L1/L2 labor pool: without enough workers, output is lower or zero. Saturday is market day; Sunday is rest. A logging camp displays two anonymous small walkers heading to the forest edge during workdays (not persistent individual laborers). No forest depletion, individual chopping animation, or regeneration logic has been implemented.

**Open design decision:** the mine currently yields stone according to the latest instruction; earlier economic design assumed metal. Choose the definitive mined good before balancing the metallurgical chain. Rendering intentionally remains temporary while SVG assets are authored in `urban`. No claim is made that the `urban` branch art has been merged.

Regression: `node qa/economy-industries-regression.cjs` (whitezone, forest range, quarry/mine terrain, collisions, staffing, daily output and weekends).
