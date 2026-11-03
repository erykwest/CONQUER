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
- `cargo` is an array of **at most one** valid market commodity; gold coin cargo is a separate chest (`coinGold`, `chest.gold/reservedGold`). The goods manifest is **declarative**, not loaded from any source inventory yet.
- The role is `tier:4,role:'L4+'`, with statuses `planned → arrived → lodged → departed` (the `lodged` state may be skipped).
- `confirmArrival()` is an explicit integration hook for **future** caravan/route completion; nothing triggers it from the time/calendar simulation today.
- `checkIn()` requires a confirmed local arrival and a real `tavern` service with an available bed. `depart()` frees the bed. An inn cannot reduce capacity below occupied beds.
- A removed inn releases associated traveler lodging entries safely; traveler manifests persist for diagnostics.

**Important:** no automatic departures/arrivals, carriage physics, customer purchases, cargo transfer, taxes, lodging payments or exports exist in this scaffold. The existing economy foreign-demand abstraction remains unchanged. Never enable a sale by changing only `manifest.status`; inventory/funding transfers need a separate atomic accounting design.

## Monotype cargo and physical coin chest (21 October 2026)

A journey is now **one kind of trade good, plus an independent chest of gold coins**. The gold chest is actual movable purchasing power, not a seventh `GOODS` resource and not a second trading commodity. This lets an L4+ merchant (a) export one good, (b) depart with an empty cart and cash to buy imports, or (c) sell abroad and reuse cash for a return purchase, when trade settlement is implemented. The current skeleton **does not yet settle sales or exchange cargo at the destination**.

`planJourney({...,cargo:[{good,qty}],coinGold})` accepts **zero or one** goods line and an optional nonnegative gold amount rounded to thousandths. A proposed purchase-only trip `cargo:[],coinGold>0` quotes one empty wagon. Gold held in the chest **does not occupy trade cargo points**: it is too compact for coins to be a sensible volume-filler. Empty capacity is a legitimate economic inefficiency. Multiple commercial goods are rejected for new trips. Existing old-save mixed manifests remain as legacy data rather than being silently deleted.

**Provisional land cargo model:** 100 capacity points per wagon (or 40 for a small cart), weight per unit: food 2, wood 5, stone 10, metal 8, equipment 3, luxury 1. A wagon carries 10 stone or 100 luxury units under these placeholders. `caravanQuote()` returns `loadPoints`, `wagons`, `freePoints` and an indicative operating cost of **0.2 gold per wagon/day**, *not* a charge yet. There is no second per-good travel price. Future textiles/leather/coins-as-precious-metal should have their own approved weight/provenance when added to the economic goods registry. The future naval model can reuse the monetary/merchandise split with its own capacity and fare tables. **The convoy and noble-coach skeleton** is documented in [convoys-skeleton.md](convoys-skeleton.md).

**No money creation:** simply declaring `coinGold` does not debit any wallet or mint spendable money; `chest:{gold,reservedGold}` distinguishes proposed funds from physically reserved funds. For a **resident outbound** journey, `reserveJourneyCoins(id)` explicitly transfers coins from the existing *aggregate L4 wallet* into journey escrow, with full funding or no action. The wallet loses exactly that amount. A second call does not debit twice; `cancelPlannedJourney(id)` refunds escrow exactly once, only before departure. For inbound **external** merchants, a declared coin chest has foreign provenance and is never credited to local money by itself. Sending, theft, unloading, spending, re-export, and final repatriation require later atomic balance/stock handling; no travel is scheduled by these methods.

**Food is not a generic filler good.** Crew provisions can eventually be a separate upkeep allowance paid or consumed over travel days without becoming a second *commercial* line. Shipping a partly empty cart is allowed; cargo economics should be driven by margin, price, and round-trip transport costs, not fake ballast.

## Mastio, tributes/gifts, escorts, carts and noble coaches

The new `src/settlement-convoys.js` offers `ConquerConvoys` for **player-created** tributes and gifts, explicitly departing from the Mastio in future navigation. The keep menu creates **drafts**; the player may atomically reserve real castle gold and at most one goods type, turning the draft into `ready` — **not yet departed** — or cancel and refund the exact escrow. Guards are requested from existing barracks **capacity**, not fictional assigned soldiers. Merchants can request neutral-brown leather mercenary escorts charged at an estimated **2× L2 daily wage**, when future world travel dates exist. Carts (40 cargo points) handle smaller loads and future local deliveries; wagons (100) carry freight; noble coaches (two seats, preference for noble ladies but men allowed) have no commercial cargo. See [the convoy specification](convoys-skeleton.md) for detailed mechanics, test coverage and deliberate non-implementations.

## Persistence and performance

`State.economy.commerce={version:3,shops:{},services:{},journeys:{}}` lives inside the already-serialized economy for local and Supabase saves. Lazy `state()` migrates older save games, preserving old multi-commodity manifests without copying gold into them or clearing balances/visits. Current commerce schema version is **3** (migrates V2 `purse` to V3 `chest` without repeating cash holds). `reset()` resets it with the economy. `sync()` removes orphan service/shop references and creates only completed-service descriptors. Journeys are **not** stepped each visual frame; no extra navigational agents or dynamic commodity loops were added. A small read-only summary appears in economy overview and selected-structure panels.

## QA and pending milestones

`qa/commerce-skeleton-regression.cjs` and `qa/convoys-skeleton-regression.cjs` test no phantom population/goods, eligibility and exclusivity for L3 shops/services, existing L4 property view, inbound/outbound manifests, rejected invalid cargo, inn bed limits, explicit arrival, removal recovery, reload/reset and page script order. It is included in the economy GitHub Actions workflow.

**Open milestones:** (1) accepted commodity list and pricing for artisan input/output, (2) L3 sales and purchases from real inventories, (3) private investment logic for L4 sites, (4) stable IDs/road links for multiple cities, (5) physical caravans and **atomic** cross-settlement loading/unloading with theft/loss rules, (6) room-derived tavern capacity and payment for stays, (7) services that actually satisfy town demand, (8) UI controls and browser/playtest performance. None of these is implemented by this skeleton.

## Autonomous L3 workshops and the L3 goods market (29 October 2026, `feature/economy-commerce`)

Converted from `feature/autonomous-urban-economy` (`src/economy/*`, ES modules never loaded by the game) into `src/settlement-urban-economy.js` and `src/settlement-market-economy.js`, and driven by `ConquerCommerce.daily(day)` from `ConquerEconomy.tick`:

- **Spawning:** on workdays every completed L3 house with no shop and no service gets one workshop, trade chosen by `chooseWorkshopType` (sector demand from real population, input availability from castle + market wood/metal/clay, prosperity = welfare) with a random seeded by map seed, house and day.
- **Production:** 1 unit/day of the trade's commodity Mon–Fri; closed on Sunday; alarms stop work.
- **Prices:** `stepMarket` reprices one commodity per day using only the previous week's observation; Saturday records the week (`recordMarketWeek`).
- **Sales:** Saturday, households L4→L1 buy `L3_GOODS_NEED × tradeWeight` per resident with their own wallets; takings go to wallet L3 and to each shop's `revenue`.
- **Saved** in `State.economy.commerce` (`version:4`): `shops`, `goods`, `market`, `week`. #55 blueprint trades migrate (`smith→blacksmith`, `tanner→leatherworker`, `jeweler→goldsmith`, `herbalist→potter`).

Regression: `node qa/urban-workshops-regression.cjs`, `node qa/commerce-skeleton-regression.cjs`.