'use strict';
// Assignments of rural field workers. Extracted verbatim from settlement-population.js.
function fieldAvailableHouses(houses){
  const economy=window.ConquerEconomy,allocation=economy?.staffing?.()||{};
  const reserved={1:0,2:0};
  for(const s of State.structures){
    const tier=economy?.KIND?.[s.type]?.classId;
    if(s.type!=='field'&&(tier===1||tier===2))reserved[tier]+=allocation[s.id]||0;
  }
  const sorted=tier=>houses.filter(h=>houseLevel(h)===tier&&
    window.ConquerLivestock?.lotKindForHouse(h)!==(tier===1?'shepherd':'cow'))
    .sort((a,b)=>peasantHash(a.id)-peasantHash(b.id)).slice(reserved[tier]);
  return {L1:sorted(1),L2:sorted(2),reserved};
}
function fieldWorkAssignments(houses,fields){
  // L1 workers occupy available field slots first. Idle L2 workers can farm
  // remaining slots rather than remaining locked to artisan routines.
  const workforce=fieldAvailableHouses(houses);
  const reserved=workforce.reserved;
  const key=houses.map(h=>[h.id,h.x,h.y,houseLevel(h)].join(':')).sort().join(',')+'|'+fields.map(f=>{
    const crop=fieldCrop(f),layout=fieldLayout(f);
    return f.id+':'+layout.poly.map(p=>p.x+','+p.y).join(';')+':'+crop.phase+':'+
      (crop.ploughed?'P':'')+(crop.harvested?'H':'')+':'+fieldSeasonPhase(calendarDateFromDay().month)+
      ':'+layout.cells.map(c=>fieldSlotDone(f,c)?1:0).join('');
  }).sort().join('|')+'|workers-reserved:'+reserved[1]+':'+reserved[2]+'|livestock-seed:'+State.seed;
  if(fieldWorkAssignmentCache.key===key)return fieldWorkAssignmentCache.map;

  const slots=[];
  for(const field of fields){
    // Completed or out-of-season parcels release their workers immediately.
    if(!fieldCropReady(field))continue;
    for(const cell of fieldGrid(field).cells)if(!fieldSlotDone(field,cell))slots.push({field,cell,used:false});
  }
  const assignments=new Map(),ordered=[...workforce.L1,...workforce.L2];
  for(const house of ordered){
    const door=houseDoorInfo(house).outside;let best=null,bestScore=Infinity;
    for(const slot of slots){
      if(slot.used)continue;
      const score=dist(door,slot.cell.world);
      if(score<bestScore){bestScore=score;best=slot}
    }
    if(best){best.used=true;assignments.set(house.id,{house,field:best.field,cell:best.cell})}
  }
  fieldWorkAssignmentCache={key,map:assignments};
  return assignments;
}

