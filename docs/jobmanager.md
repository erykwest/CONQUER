# Job Manager V1 — branch `jobmanager`

The civilian workforce uses completed housing cohorts (one adult male per L1/L2/L3 house unit). Job **roles are assignments**, never permanent citizen classes.

- **L1**: goat/sheep tending (food), logging (wood), construction; no fieldwork.
- **L2**: fields (plough, sow, harvest) and specialist extraction (quarry/mine).
- **L3**: workshop jobs; L4, children and women are outside the V1 job scheduler.
- **No** hunting/forest foraging and **no** new women's work loop in this iteration.

## Daily scheduling and food protection

The manager reserves qualified L1 herders using an *indicative* 14-day food cover estimate from **accessible civilian economic food stock** (market lots; castle reserves only with an active ration order) and weekly demand of 0.55 food per resident. Estimated husbandry output is 0.9 food / employed L1 / working day. With any valid herd, at least one L1 is protected. Food risk remains possible when production is structurally insufficient; the scheduler cannot create livestock or feed people if there is none.

If wood stocks are low, up to two L1 stay at an existing logging camp. Then eligible L1 fill accessible active construction sites (priority high > normal > low, oldest first) up to spatial caps. The rest log or care for animals, provided a site/flock exists; otherwise they are idle. Changing topology or a priority invalidates the cached daily plan. Saturday/Sunday and military alarms suspend active labor.

## Construction integration

Manual structures have `workRequired`, `workDone` and `priority` instead of calendar deadlines. Existing calendar-based work in saves migrates on the first simulation tick, preserving the prior fraction. Construction proceeds only with assigned, reachable L1 during the weekday shift 0.14–0.52. Founding well is the bootstrap exception before the first household exists. Procedural auto-spawn structures continue using their existing instant-placement behavior.

The simulation maintenance pass receives the *actual* completed structures. Work is saved in the existing `State.structures` local/cloud serialization; the scheduler's ephemeral assignments are recalculated.

## Food reserves and feudal status

L1 and L2 are bound serfs and cannot emigrate; L3 (freed people) and L4 (nobles) are free to leave when migration is implemented. Ordinary civilian consumption is **market-only**. Castle food is counted as a civilian reserve only while the lord's full/half-ration policy is active, and ration delivery really reduces castle food. Each L1/L2/L3/L4 cohort has its own saved happiness. Emigration and immigration themselves are not part of this iteration.

## Accounting boundaries

The preexisting `ConquerEconomy` food ledger remains distinct from Builder's `State.resources` (test inventory). The stock guard therefore protects **economic consumption**, not the test Builder resources. Agricultural seasonal economy booking is still separate from the field animation calendar, as noted in `docs/economy.md`.

Regression: `node qa/jobmanager-regression.cjs` and existing economy, industry, field suites.
