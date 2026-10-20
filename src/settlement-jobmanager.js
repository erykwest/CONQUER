'use strict';
// CONQUER Job Manager — one adult L1 worker per completed L1 household.
// Jobs and assignments are ephemeral; only construction work is persisted.
(() => {
  const START=.14,END=.52,LEAVE=.06,RETURN=.62;
  const HERD_FOOD_PER_DAY=.9,FOOD_DAYS=14;
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const num=x=>Number.isFinite(Number(x))?Number(x):0;
  let cached=null,revision=0;
  function invalidate(){revision++;cached=null}
  const complete=s=>!s?.construction||constructionProgress(s)>=1;
  const workdays=day=>((Math.floor(day)%7)+7)%7<5;
  function houses(tier){
    return (State.structures||[]).filter(s=>s.type==='house'&&complete(s)&&houseLevel(s)===tier)
      .sort((a,b)=>String(a.id).localeCompare(String(b.id)));
  }
  function siteCap(s){
    if(s.a&&s.b)return clamp(Math.ceil(num(s.length||Math.hypot(s.a.x-s.b.x,s.a.y-s.b.y))/2),1,8);
    const area=s.type==='tower'?Math.pow(num(s.size)||1,2):
      s.type==='gate'?num(s.size||1.5)*num(s.w||1):
      num(s.w||s.size||2)*num(s.h||s.size||2);
    return clamp(Math.ceil(Math.max(1,area)/4),1,8);
  }
  function foodStocks(e){
    return num(e?.castle?.food)+(e?.lots?.food||[]).reduce((a,l)=>a+num(l.qty),0);
  }
  function woodStocks(e){
    return num(e?.castle?.wood)+(e?.lots?.wood||[]).reduce((a,l)=>a+num(l.qty),0);
  }
  function place(house,s){
    if(typeof houseDoorInfo!=='function'||typeof structureAccessPoint!=='function')return null;
    const start=houseDoorInfo(house)?.outside;
    if(!start)return null;
    return structureAccessPoint(s,start,house.id+'-job')||null;
  }
  function route(house,s){
    const start=typeof houseDoorInfo==='function'?houseDoorInfo(house)?.outside:null;
    const goal=place(house,s);
    if(!start||!goal)return null;
    if(typeof villagerPathBetween!=='function')return [start,goal];
    const path=villagerPathBetween(house,start,goal,'job');
    return path?.length&&Math.hypot(path.at(-1).x-goal.x,path.at(-1).y-goal.y)<.65?path:null;
  }
  function plan(day=State.clock.day){
    const dayNo=Math.floor(num(day));
    if(cached&&cached.day===dayNo&&cached.revision===revision)return cached;
    const econ=window.ConquerEconomy,ledger=econ?.state?.(),all=State.structures||[];
    const l1=houses(1),l2=houses(2),l3=houses(3);
    const assigned=new Map(),staffing={},siteWorkers=new Map();
    const active=all.filter(s=>complete(s)&&!s.economyDisabled&&!s.destroyed&&!s.abandoned);
    const industries=active.filter(s=>s.type==='loggingCamp'||s.type==='mine'||s.type==='quarry'||s.type==='workshop');
    const fields=active.filter(s=>s.type==='field');
    // L2 alone farms. Quarries and mines retain first claim on specialist capacity.
    let specialists=l2.length;
    for(const s of industries.filter(s=>s.type==='mine'||s.type==='quarry')
      .sort((a,b)=>String(a.id).localeCompare(String(b.id)))){
      const n=Math.min(2,specialists);staffing[s.id]=n;specialists-=n;
    }
    for(const s of fields.sort((a,b)=>String(a.id).localeCompare(String(b.id)))){
      const demand=typeof fieldLayout==='function'?Math.max(1,fieldLayout(s).cells.length):1;
      const n=Math.min(demand,specialists);staffing[s.id]=n;specialists-=n;
    }
    // L3 shops do not take L1/L2 jobs.
    const workshops=industries.filter(s=>s.type==='workshop');
    let artisans=l3.length;
    for(const s of workshops){staffing[s.id]=Math.min(1,artisans);artisans-=staffing[s.id]}
    const available=new Map(l1.map(h=>[h.id,h]));
    const herd=l1.filter(h=>['goat','shepherd'].includes(window.ConquerLivestock?.lotKindForHouse?.(h)));
    const population=(l1.length+l2.length*2+l3.length*3+houses(4).length*4)*3;
    const weeklyDemand=population*.55;
    const stock=foodStocks(ledger);
    // Fourteen-day safety cover, conservatively excluding speculative harvests.
    // At least one qualified herder stays when a flock exists.
    const projectedGap=Math.max(0,weeklyDemand*2-stock);
    const herdReserve=herd.length?clamp(Math.ceil(projectedGap/(HERD_FOOD_PER_DAY*10)),1,herd.length):0;
    function reserve(h,kind,site=null){
      if(!available.has(h.id))return false;
      available.delete(h.id);assigned.set(h.id,{kind,siteId:site?.id||null});
      if(site){staffing[site.id]=(staffing[site.id]||0)+1;siteWorkers.set(site.id,[...(siteWorkers.get(site.id)||[]),h.id])}
      return true;
    }
    for(const h of herd.slice(0,herdReserve))reserve(h,'herding');
    const logging=industries.filter(s=>s.type==='loggingCamp')
      .sort((a,b)=>String(a.id).localeCompare(String(b.id)));
    let woodReserve=woodStocks(ledger)<Math.min(20,num(ledger?.target?.wood)||20)
      ?Math.min(2,logging.length*2):0;
    function assignSites(sites,kind,limits){
      for(const s of sites){
        let occupied=0,capacity=limits(s);
        while(occupied<capacity&&available.size){
          const candidates=[...available.values()].sort((a,b)=>{
            const ca=typeof structureCenter==='function'?structureCenter(s):s;
            const da=Math.hypot(num(a.x)-num(ca.x),num(a.y)-num(ca.y));
            const db=Math.hypot(num(b.x)-num(ca.x),num(b.y)-num(ca.y));
            return da-db||String(a.id).localeCompare(String(b.id));
          });
          let chosen=null;
          for(const h of candidates)if(route(h,s)){chosen=h;break}
          if(!chosen)break;
          reserve(chosen,kind,s);occupied++;
        }
      }
    }
    // Essential wood before construction, but only while the economic reserve is low.
    for(const s of logging){
      if(!woodReserve)break;
      const n=Math.min(2,woodReserve);
      assignSites([s],'logging',()=>n);
      woodReserve-=staffing[s.id]||0;
    }
    const sites=all.filter(s=>s.construction&&!complete(s))
      .sort((a,b)=>num(b.construction.priority||1)-num(a.construction.priority||1)||
        num(a.construction.startedDay)-num(b.construction.startedDay)||
        String(a.id).localeCompare(String(b.id)));
    assignSites(sites,'building',siteCap);
    // Once builders have been staffed, fill unused logging capacity.
    for(const s of logging){
      const used=staffing[s.id]||0;
      if(used<2)assignSites([s],'logging',()=>2-used);
    }
    // Fallback: available qualified shepherds tend their flocks.
    for(const h of herd)if(available.has(h.id))reserve(h,'herding');
    for(const h of available.values())reserve(h,'idle');
    const foodOutput=[...assigned.values()].filter(j=>j.kind==='herding').length*HERD_FOOD_PER_DAY;
    cached={day:dayNo,revision,assigned,staffing,siteWorkers,herdReserve,
      foodStocks:stock,foodDemandWeekly:weeklyDemand,foodOutputDaily:foodOutput,
      risk:stock+foodOutput*10<weeklyDemand*2,
      availableWorkers:l1.length,builders:[...assigned.values()].filter(j=>j.kind==='building').length,
      idle:[...assigned.values()].filter(j=>j.kind==='idle').length};
    return cached;
  }
  function progress(s){
    const c=s?.construction;
    if(!c)return 1;
    if(Number.isFinite(c.workRequired)&&c.workRequired>0)return clamp(num(c.workDone)/c.workRequired,0,1);
    const a=num(c.startedDay),b=num(c.completeDay);
    return b>a?clamp((State.clock.day-a)/(b-a),0,1):1;
  }
  function adopt(s,referenceDay=State.clock.day){
    const c=s?.construction;if(!c||Number.isFinite(c.workRequired))return;
    const duration=Math.max(.001,num(c.completeDay)-num(c.startedDay)||buildDuration(s)||1);
    c.workRequired=duration;
    c.workDone=clamp((num(referenceDay)-num(c.startedDay))/duration,0,1)*duration;
    delete c.completeDay;
  }
  function tick(from,to){
    if(to<=from)return[];
    const finished=[],any=State.structures||[];
    for(const s of any)adopt(s,from);
    const fromDay=Math.floor(from),toDay=Math.floor(to);
    for(let day=fromDay;day<=toDay;day++){
      if(!workdays(day)||(window.ConquerCombat?.alarmMode?.()||'off')!=='off')continue;
      const effort=Math.max(0,Math.min(to,day+END)-Math.max(from,day+START))/(END-START);
      if(effort<=0)continue;
      const scheduled=plan(day);
      for(const s of any){
        if(!s.construction||progress(s)>=1||num(s.construction.startedDay)>day+END)continue;
        const workers=(scheduled.siteWorkers.get(s.id)||[]).filter(id=>{
          const home=any.find(h=>h.id===id);
          return home&&route(home,s);
        }).length;
        if(!workers)continue;
        const c=s.construction,before=progress(s);
        c.workDone=Math.min(c.workRequired,num(c.workDone)+workers*effort);
        if(before<1&&progress(s)>=1){finished.push(s);invalidate()}
      }
    }
    // Completed geometry is reconciled once by the simulation maintenance step.
    if(finished.length)State.dirty=true
    return finished;
  }
  function position(house,day=State.clock.day){
    if(!workdays(day))return null;
    const entry=plan(day).assigned.get(house.id);
    if(!entry||!['building','logging'].includes(entry.kind))return null;
    const site=State.structures.find(s=>s.id===entry.siteId);
    if(!site)return null;
    const path=route(house,site);if(!path)return null;
    const f=day-Math.floor(day);
    if(f<LEAVE||f>RETURN)return null;
    const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t)};
    if(typeof pointAlongPath!=='function')return path.at(-1);
    if(f<START)return pointAlongPath(path,smooth((f-LEAVE)/(START-LEAVE)));
    if(f<END)return typeof residentIdlePoint==='function'
      ?residentIdlePoint(path.at(-1),house.id+'-job',day,.10):path.at(-1);
    return pointAlongPath(path,1-smooth((f-END)/(RETURN-END)));
  }
  function summary(){
    const p=plan();
    return{L1:p.availableWorkers,building:p.builders,herding:[...p.assigned.values()].filter(j=>j.kind==='herding').length,
      logging:[...p.assigned.values()].filter(j=>j.kind==='logging').length,idle:p.idle,
      protectedHerders:p.herdReserve,foodStocks:p.foodStocks,foodDemandWeekly:p.foodDemandWeekly,
      foodOutputDaily:p.foodOutputDaily,foodRisk:p.risk,sites:Object.fromEntries(p.siteWorkers)};
  }
  function setPriority(id,priority){
    const s=State.structures.find(s=>s.id===id&&s.construction&&!complete(s));
    if(!s||![0,1,2].includes(priority))return false;
    s.construction.priority=priority;invalidate();
    if(typeof scheduleLocalSave==='function')scheduleLocalSave(200);
    return true;
  }
  window.ConquerJobManager=Object.freeze({invalidate,plan,tick,adopt,progress,position,summary,setPriority,workdays});
})();
