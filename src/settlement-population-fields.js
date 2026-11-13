'use strict';
// Assignments of rural field workers. Extracted verbatim from settlement-population.js.
// `reservedL2` lets the economy pass the L2 already staffed at quarries and
// mines while it is still computing its own allocation (no recursion).
function fieldAvailableHouses(houses,reservedL2=null){
  const reserved={1:0,2:0};
  if(Number.isFinite(reservedL2))reserved[2]=Math.max(0,Math.floor(reservedL2));
  else{
    const economy=window.ConquerEconomy,allocation=economy?.staffing?.()||{};
    for(const s of State.structures){
      const tier=economy?.KIND?.[s.type]?.classId;
      if(s.type!=='field'&&(tier===1||tier===2))reserved[tier]+=allocation[s.id]||0;
    }
  }
  const sorted=tier=>houses.filter(h=>houseLevel(h)===tier&&
    window.ConquerLivestock?.lotKindForHouse(h)!==(tier===1?'shepherd':'cow'))
    .sort((a,b)=>peasantHash(a.id)-peasantHash(b.id)).slice(reserved[tier]);
  return {L1:[],L2:sorted(2),reserved};
}
// Field work is decided once per working day, in the morning: whoever has an
// open strip of the season keeps it until evening; a farmer whose own strip
// has no work takes the nearest open strip of another in-season field;
// everyone left without a strip is lent to the L1 pool by the economy
// (fieldIdleFarmHouses). A strip finished during the day releases its farmer
// home on foot (peasantPosition), never reassigning him mid-shift.
function fieldWorkAssignments(houses,fields,reservedL2=null){
  // Only available L2 adults cultivate fields. L1 retain their other jobs.
  const workforce=fieldAvailableHouses(houses,reservedL2);
  const today=Math.floor(State.clock.day);
  const key=today+'|'+workforce.L2.map(h=>h.id+':'+houseLevel(h)).join(',')+'|'+
    fields.map(f=>f.id).sort().join(',')+'|reserved:'+workforce.reserved[2]+'|seed:'+State.seed;
  const cache=fieldWorkAssignmentCache;
  if(cache.key===key)return cache.map;
  // Month transitions (harvested -> plough, ploughed -> sow, grow -> harvest)
  // must apply before the morning decision, whichever system asks first.
  if(cache.day!==today&&typeof fieldPrepareSeason==='function')fieldPrepareSeason(fields,State.clock.day);
  const sameDay=cache.day===today&&cache.decided instanceof Set;
  const slots=[];
  for(const field of fields){
    // Completed or out-of-season parcels release their workers immediately.
    if(!fieldCropReady(field))continue;
    for(const cell of fieldGrid(field).cells)if(!fieldSlotDone(field,cell))slots.push({field,cell,used:false});
  }
  const assignments=new Map(),decided=new Set(sameDay?cache.decided:[]);
  if(sameDay){
    // Later recomputations of the same day (new field, staffing change) keep
    // the morning roster: nobody is moved or recalled mid-shift.
    const live=new Set(workforce.L2),fieldSet=new Set(fields);
    for(const [id,a] of cache.map)if(live.has(a.house)&&fieldSet.has(a.field)){
      assignments.set(id,a);
      const slot=slots.find(s=>s.field===a.field&&s.cell.index===a.cell.index);
      if(slot)slot.used=true;
    }
  }
  for(const house of workforce.L2){
    if(decided.has(house))continue;
    decided.add(house);
    const door=houseDoorInfo(house).outside;let best=null,bestScore=Infinity;
    for(const slot of slots){
      if(slot.used)continue;
      const score=dist(door,slot.cell.world);
      if(score<bestScore){bestScore=score;best=slot}
    }
    if(best){best.used=true;assignments.set(house.id,{house,field:best.field,cell:best.cell})}
  }
  fieldWorkAssignmentCache={key,map:assignments,day:today,decided};
  return assignments;
}
// Lending applies while the farming year has work in progress (plough, sow,
// harvest windows) and during spring growth (May-June). In September and
// December-February the whole countryside rests, as before.
function fieldLendingMonth(month){
  return fieldSeasonPhase(month)!==null||month===4||month===5;
}
// L2 farmers with no strip this morning, in the stable workforce order.
function fieldIdleFarmHouses(houses,fields,reservedL2=null){
  if(!fieldLendingMonth(calendarDateFromDay(State.clock.day).month))return [];
  const assigned=fieldWorkAssignments(houses,fields,reservedL2);
  return fieldAvailableHouses(houses,reservedL2).L2.filter(h=>!assigned.has(h.id));
}
