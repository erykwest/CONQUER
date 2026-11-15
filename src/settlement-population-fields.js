'use strict';
// Assignments of rural field workers. Extracted verbatim from settlement-population.js.
function fieldSocialTier(house){
  return window.ConquerSocialClasses?.tierOfHouse?.(house)??houseLevel(house);
}
function fieldAvailableHouses(houses){
  const economy=window.ConquerEconomy,allocation=economy?.staffing?.()||{};
  const reserved={1:0,2:0};
  for(const s of State.structures){
    const tier=economy?.KIND?.[s.type]?.classId;
    if(s.type!=='field'&&(tier===1||tier===2))reserved[tier]+=allocation[s.id]||0;
  }
  const sorted=tier=>houses.filter(h=>fieldSocialTier(h)===tier&&
    !['shepherd','goat','cow','fisher'].includes(window.ConquerLivestock?.lotKindForHouse(h)))
    .sort((a,b)=>peasantHash(a.id)-peasantHash(b.id)).slice(reserved[tier]);
  return {L1:sorted(1),L2:[],reserved};
}
// The farmers of the day, per field: exactly the named L1 the economy staffs
// there (assignedL1), so nobody is drawn at a field while counted elsewhere.
// Without the economy (isolated tests) every available L1 house head farms.
function fieldDayRoster(houses,fields){
  const byHouse=new Map(houses.map(h=>[String(h.id),h])),roster=[];
  const labor=window.ConquerEconomy?.laborAllocation?.(State.clock.day);
  if(labor?.assignedL1){
    for(const field of fields)for(const w of labor.assignedL1[field.id]||[]){
      const house=byHouse.get(String(w.houseId));
      if(house)roster.push({id:String(w.id),house,field});
    }
    return roster;
  }
  for(const house of fieldAvailableHouses(houses).L1){
    const id=window.ConquerSocialClasses?.householdHeadIds?.(house)?.[0]||String(house.id)+':m:0';
    roster.push({id,house,field:null});
  }
  return roster;
}
// D-FIELD-LEND: field work is decided once per working day, in the morning.
// The economy staffs each in-season field with as many L1 as it has open
// strips (fieldMorningDemand); everyone else is already free for other L1
// jobs. Each farmer takes the nearest open strip of the field he is staffed at
// and keeps it until evening; a strip finished during the shift sends him home
// on foot (fieldSlotRelease, peasantPosition), never to another job mid-shift.
// Assignments are keyed by the worker's resident id.
function fieldWorkAssignments(houses,fields){
  const roster=fieldDayRoster(houses,fields);
  const today=Math.floor(State.clock.day);
  const key=today+'|'+roster.map(r=>r.id+'@'+(r.field?.id??'*')).join(',')+'|'+
    fields.map(f=>f.id).sort().join(',')+'|seed:'+State.seed;
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
    const live=new Map(roster.map(r=>[r.id,r])),fieldSet=new Set(fields);
    for(const [id,a] of cache.map){
      const r=live.get(id);
      if(!r||!fieldSet.has(a.field)||r.field&&r.field!==a.field)continue;
      assignments.set(id,a);
      const slot=slots.find(s=>s.field===a.field&&s.cell.index===a.cell.index);
      if(slot)slot.used=true;
    }
  }
  for(const r of roster){
    if(decided.has(r.id))continue;
    decided.add(r.id);
    const door=houseDoorInfo(r.house).outside;let best=null,bestScore=Infinity;
    for(const slot of slots){
      if(slot.used||r.field&&slot.field!==r.field)continue;
      const score=dist(door,slot.cell.world);
      if(score<bestScore){bestScore=score;best=slot}
    }
    if(best){best.used=true;assignments.set(r.id,{house:r.house,worker:r.id,field:best.field,cell:best.cell})}
  }
  fieldWorkAssignmentCache={key,map:assignments,day:today,decided};
  return assignments;
}
