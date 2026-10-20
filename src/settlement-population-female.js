'use strict';
// CONQUER: women have a visual household/social cycle separate from male jobs.
// The named social activity is "leisure Female"; there is no economy production.
(() => {
  const LEAVE=.075,ARRIVE=.15,NOON=.50,LEISURE_ARRIVE=.57;
  const RETURN=.625,HOME=.70;
  let targetsRevision=-1,targetsCount=-1;
  const targetCache=new Map();
  function weekday(day){
    return window.ConquerEconomy?.weekday?.(day)??((Math.floor(day)%7+7)%7);
  }
  // Pure schedule for repeatable QA and future activity labels.
  function activity(tier,week,frac){
    const level=Math.min(4,Math.max(1,Math.floor(Number(tier)||1)));
    const dow=((Math.floor(week)%7)+7)%7;
    if(frac<LEAVE||frac>=HOME)return 'home';
    if(frac>=NOON)return 'leisure Female';
    if(dow===6)return 'church';
    if(dow===5)return 'market';
    if(level<=2)return 'lot';
    return level===3?'market':'leisure Female';
  }
  function refreshCache(){
    const revision=typeof urbanRevision==='number'?urbanRevision:0;
    const count=State.structures?.length??0;
    if(revision!==targetsRevision||count!==targetsCount){
      targetCache.clear();targetsRevision=revision;targetsCount=count;
    }
  }
  function reachable(house,start,goal,tag){
    if(!goal)return null;
    const path=villagerPathBetween(house,start,goal,tag);
    return path?.length&&dist(path.at(-1),goal)<.35?path:null;
  }
  function plotAnchor(house,identity){
    const home=houseDoorInfo(house).outside;
    const parcel=typeof urbanLots==='function'
      ?urbanLots().find(l=>l.houseId===house.id):null;
    if(!parcel?.points?.length)return null;
    const phase=(peasantHash(identity+'-garden')%360)*Math.PI/180;
    // Sample only inside a real plot and outside house/fence colliders.
    // A house's centre may lie inside its footprint, so it is never a goal.
    for(const radius of [1.15,1.65,2.05,.85]){
      for(let i=0;i<8;i++){
        const angle=phase+i*Math.PI/4;
        const p={x:house.x+radius*Math.cos(angle),y:house.y+radius*Math.sin(angle)};
        if(typeof urbanContains==='function'&&!urbanContains(parcel.points,p,.10))continue;
        if(typeof pointBlockedForPeasant==='function'&&pointBlockedForPeasant(p,house.id))continue;
        if(reachable(house,home,p,'female-lot'))return p;
      }
    }
    return null;
  }
  function destination(house,kind,from,id){
    const target=nearestCompletedStructure(kind,from);
    if(!target)return null;
    if(kind==='well'){
      const path=wellApproachPath(house,target);
      const point=path?.at(-1);
      if(!point||path.length<2||dist(point,houseDoorInfo(house).outside)<.03)return null;
      return{point,id:target.id,kind:'well'};
    }
    return{point:structureAccessPoint(target,from,id),id:target.id,kind};
  }
  function socialDestination(house,resident,from){
    const choices=[];
    const source=houseDoorInfo(house).outside;
    for(const kind of ['market','well']){
      // All completed destinations, not just the nearest centre: select the
      // nearest reachable access, not an inaccessible geometric shortcut.
      for(const s of State.structures||[]){
        if(s.type!==kind||underConstruction(s))continue;
        const point=kind==='well'?wellApproachPath(house,s)?.at(-1):
          structureAccessPoint(s,source,resident.id+'-leisure');
        if(!point||kind==='well'&&dist(point,source)<.03)continue;
        choices.push({kind,id:s.id,point});
      }
    }
    // The only current garden geometry is a household's Voronoi garden lot.
    // Respect fences: unreachable private gardens are not instant teleports.
    if(typeof urbanLots==='function'&&window.ConquerLivestock?.lotKindForHouse){
      const byId=new Map((State.structures||[]).filter(s=>s.type==='house'&&!underConstruction(s)).map(s=>[s.id,s]));
      for(const lot of urbanLots()){
        const owner=byId.get(lot.houseId);
        if(!owner||window.ConquerLivestock.lotKindForHouse(owner)!=='garden')continue;
        const point=plotAnchor(owner,owner.id+'-female-social');
        if(point)choices.push({kind:'garden',id:lot.id,point});
      }
    }
    choices.sort((a,b)=>dist(from,a.point)-dist(from,b.point)||
      String(a.id).localeCompare(String(b.id)));
    for(const c of choices){
      if(reachable(house,from,c.point,'female-leisure'))return c;
    }
    return null;
  }
  function targets(house,resident,week){
    refreshCache();
    const key=house.id+':'+resident.id+':'+week;
    if(targetCache.has(key))return targetCache.get(key);
    const home=houseDoorInfo(house).outside,tier=houseLevel(house);
    const first=activity(tier,week,.25);
    let morning=null;
    if(first==='lot'){
      const point=plotAnchor(house,resident.id);
      if(point)morning={point,kind:'lot',id:house.id};
    }else if(first==='market'||first==='church'){
      morning=destination(house,first,home,resident.id+'-female-morning');
      if(morning&&!reachable(house,home,morning.point,'female-morning'))morning=null;
    }
    const origin=morning?.point||home;
    const leisure=socialDestination(house,resident,origin);
    const result={home,morning,leisure};
    targetCache.set(key,result);
    return result;
  }
  function position(house,resident,day=State.clock.day){
    const frac=day-Math.floor(day),week=weekday(day),tier=houseLevel(house);
    const stage=activity(tier,week,frac);
    if(stage==='home')return null;
    const t=targets(house,resident,week);
    // L4 visits a social spot directly every weekday, without an artificial
    // noon return to the house.
    const morning=stage==='leisure Female'&&frac<NOON?t.leisure:t.morning;
    if(frac<NOON){
      if(!morning)return null;
      if(frac<ARRIVE)return routineTravel(house,t.home,morning.point,frac,LEAVE,ARRIVE,'female-morning');
      return residentIdlePoint(morning.point,resident.id+'-'+morning.kind+'-morning',day,
        morning.kind==='lot'?.15:.17);
    }
    const from= t.morning?.point||t.home;
    if(!t.leisure){
      if(t.morning&&frac<HOME)
        return routineTravel(house,from,t.home,frac,NOON,LEISURE_ARRIVE,'female-back-home');
      return null;
    }
    // When morning itself was leisure (L4 weekdays), remain at the same social
    // destination until the shared late-afternoon return.
    if(activity(tier,week,.25)==='leisure Female'){
      if(frac<RETURN)return residentIdlePoint(t.leisure.point,resident.id+'-leisure-female',day,.18);
      return routineTravel(house,t.leisure.point,t.home,frac,RETURN,HOME,'female-leisure-home');
    }
    if(frac<LEISURE_ARRIVE)
      return routineTravel(house,from,t.leisure.point,frac,NOON,LEISURE_ARRIVE,'female-noon-leisure');
    if(frac<RETURN)return residentIdlePoint(t.leisure.point,resident.id+'-leisure-female',day,.18);
    return routineTravel(house,t.leisure.point,t.home,frac,RETURN,HOME,'female-leisure-home');
  }
  window.ConquerFemaleRoutines=Object.freeze({activity,position});
})();
