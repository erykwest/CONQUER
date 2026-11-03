'use strict';
// Adult male social schedule. Labour remains owned by the Job Manager;
// leisure male is a visual/social activity, not a productive job.
(() => {
  const WEEKDAY_START=.75;     // 18:00, Mon–Fri
  const WEEKDAY_ARRIVE=.81,WEEKDAY_RETURN=.90,WEEKDAY_HOME=.96;
  const WEEKEND_LEAVE=.075,WEEKEND_ARRIVE=.15;
  const WEEKEND_NOON=.50,WEEKEND_LEISURE_ARRIVE=.57;
  const WEEKEND_RETURN=.75,WEEKEND_HOME=.83;
  // Register future male leisure venues here; current civic destinations:
  // tavern first, then public market plaza, then paved well plaza.
  const LEISURE_VENUES=Object.freeze(['tavern','market','well']);
  let cachedRevision=-1,cachedCount=-1;
  const targetCache=new Map();

  const weekday=day=>window.ConquerEconomy?.weekday?.(day)??((Math.floor(day)%7+7)%7);
  function activity(tier,week,frac){
    const dow=((Math.floor(week)%7)+7)%7;
    if(dow<5){
      if(frac<WEEKDAY_START)return 'regular';
      return frac<WEEKDAY_HOME?'leisure male':'home';
    }
    if(frac<WEEKEND_LEAVE||frac>=WEEKEND_HOME)return 'home';
    if(frac<WEEKEND_NOON)return dow===5?'market':'church';
    return 'leisure male';
  }
  function handles(day){
    const dow=weekday(day),frac=day-Math.floor(day);
    return dow>=5||frac>=WEEKDAY_START;
  }
  function syncCache(){
    const revision=typeof urbanRevision==='number'?urbanRevision:0;
    const count=State.structures?.length??0;
    if(revision!==cachedRevision||count!==cachedCount){
      targetCache.clear();cachedRevision=revision;cachedCount=count;
    }
  }
  function reachable(house,from,to){
    if(!from||!to)return false;
    const path=villagerPathBetween(house,from,to,'leisure-male');
    return !!path?.length&&dist(path.at(-1),to)<.35;
  }
  function access(house,venue,from,id){
    if(venue.type==='well'){
      // Never enter the solid well: share the existing road/plaza approach.
      const path=wellApproachPath(house,venue);
      const point=path?.at(-1);
      const home=houseDoorInfo(house).outside;
      return path?.length>1&&point&&dist(point,home)>.03?point:null;
    }
    return structureAccessPoint(venue,from,id);
  }
  function nearestVenue(house,resident,from,kinds){
    const source=houseDoorInfo(house).outside;
    for(const kind of kinds){
      const choices=(State.structures||[])
        .filter(s=>s.type===kind&&!underConstruction(s))
        .map(s=>({s,point:access(house,s,from,resident.id+'-male-'+kind)}))
        .filter(x=>x.point)
        .sort((a,b)=>dist(from,a.point)-dist(from,b.point)||
          String(a.s.id).localeCompare(String(b.s.id)));
      for(const {s,point} of choices){
        if(kind==='well'&&dist(point,source)<.03)continue;
        if(reachable(house,from,point))return{kind,id:s.id,point};
      }
    }
    return null;
  }
  function targets(house,resident,dow){
    syncCache();
    const schedule=dow<5?'weekday':dow===5?'saturday':'sunday';
    const key=house.id+':'+resident.id+':'+schedule;
    if(targetCache.has(key))return targetCache.get(key);
    const home=houseDoorInfo(house).outside;
    const required=dow===5?'market':dow===6?'church':null;
    const morning=required?nearestVenue(house,resident,home,[required]):null;
    const leisure=nearestVenue(house,resident,morning?.point||home,LEISURE_VENUES);
    const result={home,morning,leisure};
    targetCache.set(key,result);
    return result;
  }
  function position(house,resident,day=State.clock.day){
    const frac=day-Math.floor(day),dow=weekday(day);
    const stage=activity(houseLevel(house),dow,frac);
    if(stage==='home'||stage==='regular')return null;
    const t=targets(house,resident,dow);
    if(dow<5){
      if(!t.leisure)return null;
      if(frac<WEEKDAY_ARRIVE)
        return routineTravel(house,t.home,t.leisure.point,frac,WEEKDAY_START,WEEKDAY_ARRIVE,'male-evening-out');
      if(frac<WEEKDAY_RETURN)
        return residentIdlePoint(t.leisure.point,resident.id+'-leisure-male',day,.16);
      return routineTravel(house,t.leisure.point,t.home,frac,WEEKDAY_RETURN,WEEKDAY_HOME,'male-evening-home');
    }
    if(frac<WEEKEND_NOON){
      if(!t.morning)return null; // No market/church: do not substitute a tavern.
      if(frac<WEEKEND_ARRIVE)
        return routineTravel(house,t.home,t.morning.point,frac,WEEKEND_LEAVE,WEEKEND_ARRIVE,'male-weekend-morning-out');
      return residentIdlePoint(t.morning.point,resident.id+'-'+t.morning.kind+'-morning',day,.16);
    }
    const from=t.morning?.point||t.home;
    if(!t.leisure){
      if(!t.morning||frac>=WEEKEND_HOME)return null;
      return frac<WEEKEND_LEISURE_ARRIVE
        ?routineTravel(house,from,t.home,frac,WEEKEND_NOON,WEEKEND_LEISURE_ARRIVE,'male-weekend-home')
        :null;
    }
    if(frac<WEEKEND_LEISURE_ARRIVE)
      return routineTravel(house,from,t.leisure.point,frac,WEEKEND_NOON,WEEKEND_LEISURE_ARRIVE,'male-weekend-leisure-out');
    if(frac<WEEKEND_RETURN)
      return residentIdlePoint(t.leisure.point,resident.id+'-leisure-male',day,.16);
    return routineTravel(house,t.leisure.point,t.home,frac,WEEKEND_RETURN,WEEKEND_HOME,'male-weekend-leisure-home');
  }
  window.ConquerMaleRoutines=Object.freeze({activity,handles,position,LEISURE_VENUES});
})();
