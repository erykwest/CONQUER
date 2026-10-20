'use strict';
// Resident families, demographics and appearance. Extracted verbatim from settlement-population.js.
function peasantAnimationActive(){
  const day=peasantVisualDay(),frac=day-Math.floor(day);
  return frac>=.035&&frac<=.96&&completedSettlement('house').length>0;
}
function housePopulationCapacity(house){
  const level=houseLevel(house);
  return{male:level,female:level,children:level,total:level*3};
}
const houseResidentCache=new Map();
function houseResidents(house){
  const level=houseLevel(house),key=house.id+'|'+level;
  const cached=houseResidentCache.get(key);
  if(cached)return cached;

  const cap=housePopulationCapacity(house),kind=villagerClass(house),out=[];
  const make=(id,sex,age,index)=>{
    const scatterHash=peasantHash(id+'-scatter'),a=(scatterHash%360)*Math.PI/180;
    const scatterR=(age==='child'?.10:.075)+(((scatterHash>>>9)%1000)/1000)*(age==='child'?.08:.07);
    return{
      id,sex,age,index,
      timeOffset:(((peasantHash(id+'-time')>>>8)%1000)/1000-.5)*.055,
      lodHash:peasantHash(id+'-lod'),
      scatterX:Math.cos(a)*scatterR,
      scatterY:Math.sin(a)*scatterR,
      hair:villagerHair(id),
      colors:villagerBodyColors(id,kind)
    };
  };
  for(let i=0;i<cap.male;i++)out.push(make(house.id+':m:'+i,'male','adult',i));
  for(let i=0;i<cap.female;i++)out.push(make(house.id+':f:'+i,'female','adult',i));
  for(let i=0;i<cap.children;i++){
    const id=house.id+':c:'+i;
    out.push(make(id,(peasantHash(id)&1)?'female':'male','child',i));
  }
  houseResidentCache.set(key,out);
  return out;
}
function residentTimeOffset(id){
  return (((peasantHash(id+'-time')>>>8)%1000)/1000-.5)*.055;
}
function residentScatter(p,id,child=false){
  if(!p)return null;
  const h=peasantHash(id+'-scatter'),a=(h%360)*Math.PI/180;
  const r=(child?.10:.075)+(((h>>>9)%1000)/1000)*(child?.08:.07);
  return{x:p.x+Math.cos(a)*r,y:p.y+Math.sin(a)*r};
}
function familyPosition(house,day){
  const frac=day-Math.floor(day),hash=peasantHash(house.id+'-family'),stagger=(((hash>>>8)%1000)/1000-.5)*.022;
  const home=houseDoorInfo(house).outside;
  const market=nearestCompletedStructure('market',home);
  const church=nearestCompletedStructure('church',home);
  const well=nearestCompletedStructure('well',home);
  const tavern=nearestCompletedStructure('tavern',home);
  const target=market||church||well||tavern;
  if(!target)return null;
  const leave0=.17+stagger,arrive=.24+stagger,leave=.48+stagger,homeAt=.58+stagger;
  if(frac<leave0||frac>homeAt)return null;

  // The well is a road-network hub but also a physical obstacle. Route to its
  // graph node once per house, then stop on the perimeter. This prevents the
  // synchronized family outing from triggering a burst of grid A* searches.
  if(target.type==='well'){
    const path=wellApproachPath(house,target),dest=path?.at(-1)||home;
    if(frac<arrive)return wellRoutineTravel(house,target,frac,leave0,arrive,false);
    if(frac<leave)return residentIdlePoint(dest,house.id+'-family-well',day,.16);
    return wellRoutineTravel(house,target,frac,leave,homeAt,true);
  }

  const dest=structureAccessPoint(target,home,house.id+'-family');
  if(frac<arrive)return routineTravel(house,home,dest,frac,leave0,arrive,'family-out');
  if(frac<leave)return residentIdlePoint(dest,house.id+'-family-dest',day,.16);
  return routineTravel(house,dest,home,frac,leave,homeAt,'family-home');
}
function residentClassPosition(house,resident,day,assignment){
  // Male leisure and Sunday church take precedence over all day-job positions,
  // including L1 shepherds/builders. Before 18:00 on weekdays, work is intact.
  if(resident.sex==='male'&&resident.age==='adult'&&
    window.ConquerMaleRoutines?.handles(State.clock.day))
    return window.ConquerMaleRoutines.position(house,resident,State.clock.day);
  // The L1 adult follows their assigned job; no L1 field workers.
  if(houseLevel(house)===1&&resident.sex==='male'&&resident.age==='adult'&&resident.index===0){
    const job=window.ConquerJobManager?.plan(State.clock.day).assigned.get(house.id);
    if(job?.kind==='building'||job?.kind==='logging')
      return window.ConquerJobManager.position(house,State.clock.day);
    if(job?.kind==='herding'){
      const shepherd=window.ConquerLivestock?.shepherdPosition(house);
      if(shepherd)return shepherd;
      // Goatherds work in their courtyard pen instead of disappearing.
      const f=day-Math.floor(day);
      return f>=.10&&f<=.53?residentIdlePoint(houseDoorInfo(house).outside,
        resident.id+'-herd',day,.24):null;
    }
  }
  const weekly=window.ConquerEconomy?.weekday(State.clock.day)??((Math.floor(State.clock.day)%7+7)%7);
  const level=houseLevel(house),shiftedDay=day+(Number.isFinite(resident.timeOffset)?resident.timeOffset:residentTimeOffset(resident.id));
  // Adult women's schedules span Saturday market and Sunday mass; do not apply
  // the old all-civilians Sunday shutdown or male artisan/merchant routines.
  if(resident.sex==='female'&&resident.age==='adult')
    return window.ConquerFemaleRoutines?.position(house,resident,State.clock.day)??null;
  if(weekly===6)return null; // Children retain their old Sunday rest.
  if(weekly===5)return familyPosition(house,State.clock.day);
  if(resident.age==='child')return childHomePosition(house,resident,shiftedDay);
  // Field routes belong exclusively to L2 men.
  if(resident.sex==='male'&&assignment&&level===2)
    return peasantPosition(house,assignment,State.clock.day);
  if(level===1)return null;
  if(level===2)return artisanPosition(house,shiftedDay);
  if(level===3)return merchantPosition(house,shiftedDay);
  return elitePosition(house,shiftedDay);
}
function villagerClass(house){
  const level=houseLevel(house);
  if(level>=4)return'elite';
  if(level===3)return'merchant';
  if(level===2)return'artisan';
  return'peasant';
}
function villagerHair(id){
  const n=(peasantHash(id+'-hair')>>>0)%100;
  if(n<20)return'blonde';
  if(n<50)return'brown';
  if(n<75)return'black';
  if(n<85)return'bald';
  if(n<95)return'gray';
  return'red';
}
function villagerBodyColors(id,kind){
  const palette=kind==='merchant'?MERCHANT_PALETTE:kind==='elite'?ELITE_PALETTE:kind==='artisan'?ARTISAN_PALETTE:PEASANT_PALETTE;
  const h1=peasantHash(id+'-cloth-a'),h2=peasantHash(id+'-cloth-b');
  const a=palette[h1%palette.length];
  let b=palette[h2%palette.length];
  if(b===a)b=palette[(h2+1)%palette.length];
  return[a,b];
}
