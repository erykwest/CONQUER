# Autonomous Urban Economy — skeleton

L3 houses may host a street-facing workshop on their ground floor. Workshops are functions of existing houses, not player-placeable buildings. No new player controls.

Pure simulation API in `urbanEconomy.js`:
- `eligibleForWorkshop`: eligibility and street access
- `chooseWorkshopType`: weighted local demand minus existing supply
- `proposeWorkshops`: deterministic when supplied a seeded random function; one workshop per L3 house, one artisan per workshop
- `createWorkshop`: persistent workshop record
- `updateWorkshop`: daily opening and production/sales activity states

The simulation deliberately does not create new resource counters. Workshop specializations are local demand categories and can later contribute abstract prosperity and existing metal-to-equipment conversion. Renderers can use `houseId`, `streetFacing`, `type`, and `state` to place an SVG sign, awning, counter, stock and activity facing the nearest street.

Integration still required: adapt actual L3 house and citizen schemas; read road frontage/pathfinding; register persistence and tick hooks; connect real demand/supply, visitors, income, employment and SVG visuals. The skeleton does not claim these integrations are active.
