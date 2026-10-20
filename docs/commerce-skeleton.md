# CONQUER — Commerce skeleton: L3 / L4 / L4+ (20 October 2026)

**Scope:** code-level contract in `src/settlement-commerce.js`, wired into `index.html` after `settlement-economy.js`. PR #55 remains Draft; **no import/export trades, new goods or visitor spawning are enabled by this milestone**.

## Economic roles

| Role | Scope | Current technical contract |
|---|---|---|
| L1 / L2 | Primary production and labor | Existing worker allocations and wages in economy; unchanged |
| **L3** | Owns and runs local shops and services, sells to local buyers | A completed L3 home can register **one** workshop blueprint or operate **one** service. No fictional production/income |
| **L4** | Owns production sites / invests capital | `primaryPortfolio()` maps existing private site ownership in the economy ledger. No new automatic investments |
| **L4+** | Traveling L4, resident outbound or foreign inbound; international/intercity commerce only | A **temporary travel role**, **not** an extra cohort or population class. Journey manifests are created explicitly and do not move funds, stock or figures |

Local artisan shops can sell their own output directly; no L4 domestic merchant intermediary is required. L4+ concerns only travel between settlements and future import/export. This distinction also changes L3 resident presentation from `merchant` to `artisan` and routes registered L3 workers to their home shop / operated service.

## L3 workshops and services

`WORKSHOP_KINDS` describes **future** recipes, not active production:
- `weaver`: wool → textiles
- `tanner`: hides → leather
- `smith`: metal + wood → tools / weapons / armor
- `herbalist`: herbs → medicines
- `jeweler`: precious metal → jewelry

These resources **do not yet exist** in `ConquerEconomy.GOODS`. No intermediate goods, inventories, output stock, prices or sales are created from the catalogue alone; the recipes are blueprints for future economic decisions. Gold as circulating coin is **not** silently consumed as jewelry metal.

`registerShop(houseId,kind)` validates an actual **completed L3 house** and creates a local workshop **blueprint** only. The blueprint is persisted under `State.economy.commerce.shops`. It cannot also operate an L3 service. When that house ceases to be an eligible L3 home, `sync()` removes the blueprint.

`assignService(structureId,houseId)` binds a completed `tavern` or `church` to a completed L3 household. The system creates **operator-unassigned** service entries from real built structures only; does not invent a private owner, fees, church income or workers.

- **Tavern:** lodging service; bed capacity is an explicit nonnegative integer, initially zero unless `structure.guestCapacity` or `configureInnCapacity()` supplies a value. No money is transferred for lodging yet, nor is a guest automatically spawned.
- **Church:** social/religious service, owned by the existing building contract and **operated** by an L3 household. Donations and tithes, if any, require a later rule; none are imputed.

L3 operating a shop or service cannot simultaneously register another. Existing civic geometry is unchanged.

## L4 primary capital

`primaryPortfolio()` reads (does not recreate) real, completed economic site records from `ConquerEconomy.state().activities`: `field`, `loggingCamp`, `quarry`, `mine`, `vineyard`. It classifies `owner:'private'` as the aggregate L4 capital pool and `owner:'lord'` as signorial. It does **not** mint new L4 residents or investments, and preserves old saves containing private activities. A future `clayPit` needs an actual building and economic definition before being added here.

A future migration must separate the current generic `workshop` business ledger from L4 private property to L3 shop ownership and payouts. This skeleton intentionally does not change its pre-existing accounting.

## L4+ travelers, manifests and inns

An L4+ manifest is explicitly planned through `planJourney()`:
- `source:'resident'`: requires a completed **L4 household**, origins at the current village (identified by its stable well ID), destination is a **different** city.
- `source:'external'`: origin must be a different city and the destination must be the current village; external travelers are never counted in local housing.
- `cargo` is an array of valid, positive existing market goods. It is **a declaration only** and is not loaded from any source inventory yet.
- The role is `tier:4,role:'L4+'`, with statuses `planned → arrived → lodged → departed` (the `lodged` state may be skipped).
- `confirmArrival()` is an explicit integration hook for **future** caravan/route completion; nothing triggers it from the time/calendar simulation today.
- `checkIn()` requires a confirmed local arrival and a real `tavern` service with an available bed. `depart()` frees the bed. An inn cannot reduce capacity below occupied beds.
- A removed inn releases associated traveler lodging entries safely; traveler manifests persist for diagnostics.

**Important:** no automatic departures/arrivals, carriage physics, customer purchases, cargo transfer, taxes, lodging payments or exports exist in this scaffold. The existing economy foreign-demand abstraction remains unchanged. Never enable a sale by changing only `manifest.status`; inventory/funding transfers need a separate atomic accounting design.

## Persistence and performance

`State.economy.commerce={version:1,shops:{},services:{},journeys:{}}` lives inside the already-serialized economy for local and Supabase saves. Lazy `state()` handles older save games without clearing balances or inventing visits. `reset()` resets it with the economy. `sync()` removes orphan service/shop references and creates only completed-service descriptors. Journeys are **not** stepped each visual frame; no extra navigational agents or dynamic commodity loops were added. A small read-only summary appears in economy overview and selected-structure panels.

## QA and pending milestones

`qa/commerce-skeleton-regression.cjs` tests no phantom population/goods, eligibility and exclusivity for L3 shops/services, existing L4 property view, inbound/outbound manifests, rejected invalid cargo, inn bed limits, explicit arrival, removal recovery, reload/reset and page script order. It is included in the economy GitHub Actions workflow.

**Open milestones:** (1) accepted commodity list and pricing for artisan input/output, (2) L3 sales and purchases from real inventories, (3) private investment logic for L4 sites, (4) stable IDs/road links for multiple cities, (5) physical caravans and **atomic** cross-settlement loading/unloading with theft/loss rules, (6) room-derived tavern capacity and payment for stays, (7) services that actually satisfy town demand, (8) UI controls and browser/playtest performance. None of these is implemented by this skeleton.
