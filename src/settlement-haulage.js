'use strict';
// Carrettieri L1: existing Job Manager owns one named worker per active stockyard.
// Production is credited exclusively by the original ledgers; the journey is visual.
// Driver + horses + wagon + road routing are ConquerVehicles/ConquerWagons 2D.
(() => {
  const MAX_ACTIVE=4,MAX_PENDING=32,MAX_WAIT_DAYS=10;
  const ROAD_REACH_SOURCE=3.5,ROAD_REACH_YARD=4.0,ROAD_REACH_MARKET=4.0;
  const LOAD_SECONDS=.45,UNLOAD_SECONDS=.8;
  const pending=new Map(),trips=[];
  let sequence=0,scan=0,completed=0;
  const finite=n=>Number.isFinite(Number(n))?Number(n):0;
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const source=id=>(State.structures||[]).find(s=>s.id===id);
  function isActive(s){
    return !!s&&!s.destroyed&&!s.abandoned&&!s.burnt&&!s.economyDisabled&&
      !(typeof underConstruction==='function'&&underConstruction(s));
  }
  const yards=()=> (window.ConquerStorageYard?.active?.()||[]).filter(isActive)
    .sort((a,b)=>String(a.id).localeCompare(String(b.id)));
  const markets=()=> (State.structures||[]).filter(s=>s.type==='market'&&isActive(s))
    .sort((a,b)=>String(a.id).localeCompare(String(b.id)));
  const getGood=good=>typeof good==='string'&&
    ((window.ConquerEconomy?.GOODS||[]).includes(good)||
      Object.hasOwn(window.ConquerMarketEconomy?.COMMODITIES||{},good));
  const dayOf=()=>finite(State.clock?.day);
  const weekday=day=>window.ConquerEconomy?.weekday?.(day)??((Math.floor(day)%7+7)%7);
  function onShift(day=dayOf()){
    const frac=day-Math.floor(day);
    return weekday(day)<5&&frac>=.25&&frac<.75&&
      (window.ConquerCombat?.alarmMode?.()||'off')==='off';
  }
  function reset(){pending.clear();trips.length=0;scan=0;completed=0;sequence=0}
  // The source ID is a REAL economic/commerce producer (or a completed forest
  // clearance with a real centre). Event aggregation does not invent supply.
  function record({siteId,origin=null,good,qty,day=dayOf(),destination='yard'}={}){
    const amount=finite(qty),at=finite(day);
    if(!State.village?.founded||!siteId||!getGood(good)||amount<=0||!yards().length||
      !['yard','market'].includes(destination)||
      (destination==='market'&&!markets().length))return false;
    if(!origin&&!isActive(source(siteId)))return false;
    const key=String(siteId)+'|'+good+'|'+destination;
    const current=pending.get(key);
    if(current){
      current.qty=Math.min(1000,current.qty+amount);
      current.lastDay=at;
      return true;
    }
    if(pending.size>=MAX_PENDING)pending.delete(pending.keys().next().value);
    pending.set(key,{key,siteId,origin:origin?{x:origin.x,y:origin.y}:null,
      good,destination,qty:amount,day:at,lastDay:at});
    return true;
  }
  function nearestRoadDistance(p,g){
    let best=Infinity;
    for(const {a,b} of g.segs){
      const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,
        ((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));
      best=Math.min(best,Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t));
    }
    return best;
  }
  function plan(job){
    const V=window.ConquerVehicles;
    if(!V?.route||!V?.makePath||!V?.graph)return null;
    const from=job.origin||source(job.siteId);
    if(!from||!Number.isFinite(from.x)||!Number.isFinite(from.y))return null;
    const graph=V.graph();
    if(!graph?.segs?.length||nearestRoadDistance(from,graph)>ROAD_REACH_SOURCE)return null;
    const bases=yards(),drops=job.destination==='market'?markets():bases;
    // Avoid running Dijkstra on every labor panel repaint. Graph identity
    // changes when completed roads change; physical site list is fingerprinted.
    const sig=bases.concat(drops).map(s=>s.id+':'+s.x+':'+s.y).join('|');
    const cache=job._plan;
    if(cache?.graph===graph&&cache.sig===sig&&cache.fromX===from.x&&cache.fromY===from.y)
      return cache.value;
    let best=null;
    for(const base of bases){
      if(nearestRoadDistance(base,graph)>ROAD_REACH_YARD)continue;
      const first=V.route(base,from);
      if(!first||first.length<2||V.makePath(first).total<.25)continue;
      for(const drop of drops){
        const reach=job.destination==='market'?ROAD_REACH_MARKET:ROAD_REACH_YARD;
        if(nearestRoadDistance(drop,graph)>reach)continue;
        const delivery=V.route(from,drop),home=V.route(drop,base);
        if(!delivery||!home||delivery.length<2||home.length<2)continue;
        const length=V.makePath(delivery).total;
        if(length<.25)continue;
        const score=V.makePath(first).total+length+V.makePath(home).total+
          .2*(distance(base,first[0])+distance(from,first.at(-1))+
          distance(from,delivery[0])+distance(drop,delivery.at(-1)));
        if(!best||score<best.score)best={
          baseId:base.id,destinationId:drop.id,
          legs:[V.smooth(first),V.smooth(delivery),V.smooth(home)],score};
      }
    }
    job._plan={graph,sig,fromX:from.x,fromY:from.y,value:best};
    return best;
  }
  // Each yard is a workplace: never create extra carters for several receipts
  // queued at the same depot. Reserve its worker until the round trip ends.
  function dutyBases(day=dayOf()){
    const bases=new Set(trips.map(t=>t.baseId));
    if(onShift(day))for(const job of pending.values()){
      if(day-job.lastDay>MAX_WAIT_DAYS)continue;
      const route=plan(job);
      if(route)bases.add(route.baseId);
      if(bases.size>=MAX_ACTIVE)break;
    }
    return Array.from(bases).slice(0,MAX_ACTIVE);
  }
  // Queried by ConquerEconomy.laborAllocation AFTER productive L1 industry and
  // BEFORE construction. No parallel workforce and no fictitious workers.
  function workerDemand(day=dayOf()){
    if(!State.village?.founded||!yards().length||!window.ConquerVehicles)return 0;
    return dutyBases(day).length;
  }
  function workerBaseId(worker,roster=[],day=dayOf()){
    const index=roster.findIndex(w=>w.id===worker.id);
    return index<0?null:dutyBases(day)[index]||null;
  }
  function workerStation(worker,roster=[]){
    if(trips.some(t=>t.workerId===worker.id))return null; // carter is drawn on the wagon
    const base=source(workerBaseId(worker,roster));
    return base?{x:base.x+.18,y:base.y+.18}:null;
  }
  function dispatch(job,worker,day){
    const route=plan(job);if(!route)return false;
    const trip={id:'local-haul-'+(++sequence),key:job.key,siteId:job.siteId,
      baseId:route.baseId,destinationId:route.destinationId,destination:job.destination,
      workerId:worker.id,good:job.good,qty:job.qty,origin:job.origin,
      vehicle:job.good==='wood'||job.qty>45?'wagon':'cart',vehicles:1,guards:0,seed:sequence%4,
      legs:route.legs,points:route.legs[0],distance:0,speed:0,phase:'departing',
      remain:0,emptyReturn:true,virtualSource:!!job.origin};
    trips.push(trip);pending.delete(job.key);
    return true;
  }
  function abandon(t,day){
    // Employment or topology may change during a journey. Requeue only the
    // visual receipt: inventory was booked already and will not be booked again.
    const site=source(t.siteId);
    if(t.virtualSource||isActive(site)){
      const original=pending.get(t.key);
      if(original){original.qty=Math.min(1000,original.qty+t.qty);original.lastDay=day}
      else pending.set(t.key,{key:t.key,siteId:t.siteId,
        origin:t.virtualSource?t.origin:null,good:t.good,destination:t.destination,
        qty:t.qty,day,lastDay:day});
    }
  }
  function tick(dt){
    if(!State.village?.founded){if(pending.size||trips.length)reset();return false}
    if(!(State.clock?.speed>0)||!Number.isFinite(dt)||dt<=0)return false;
    const V=window.ConquerVehicles,E=window.ConquerEconomy;
    if(!V||!E?.laborAllocation)return false;
    const day=dayOf(),roster=E.laborAllocation(day).carters||[];
    if(roster.length&&onShift(day)){
      const economy=E.state();
      economy.weekCarterPeak=Math.max(finite(economy.weekCarterPeak),roster.length);
    }
    const ids=new Set(roster.map(w=>w.id));
    const bases=dutyBases(day);
    const workerBaseById=new Map(roster.map((w,i)=>[w.id,bases[i]]));
    const elapsed=Math.min(dt,.25)*Math.min(4,Math.sqrt(Math.max(1,State.clock.speed)));
    const available=roster.slice();
    for(let i=trips.length-1;i>=0;i--){
      const t=trips[i];
      if((!t.virtualSource&&!isActive(source(t.siteId)))||
        !isActive(source(t.baseId))||!isActive(source(t.destinationId))){
        trips.splice(i,1);continue;
      }
      // A carter displaced by a productive job is replaced only by another
      // worker in today's L1 roster. With zero carters the trip is suspended
      // and its visual load requeued, never credited a second time.
      if(!ids.has(t.workerId)){
        const substitute=available.find(w=>workerBaseById.get(w.id)===t.baseId&&
          !trips.some(x=>x!==t&&x.workerId===w.id));
        if(substitute)t.workerId=substitute.id;
        else{abandon(t,day);trips.splice(i,1);continue}
      }
      const slot=available.findIndex(w=>w.id===t.workerId);
      if(slot>=0)available.splice(slot,1);
      if(t.phase==='loading'||t.phase==='unloading'){
        t.remain-=elapsed;
        if(t.remain>0)continue;
        if(t.phase==='loading'){t.phase='outbound';t.emptyReturn=false;t.speed=0}
        else{
          t.phase='returning';t.emptyReturn=true;
          t.points=t.legs[2];t.distance=0;t.speed=0;
        }
        continue;
      }
      if(V.advance(t,t.points,elapsed)){
        if(t.phase==='departing'){
          t.phase='loading';t.remain=LOAD_SECONDS;
          t.points=t.legs[1];t.distance=0;t.speed=0;
        }else if(t.phase==='outbound'){
          t.phase='unloading';t.remain=UNLOAD_SECONDS;t.speed=0;
        }else{
          trips.splice(i,1);completed++;
        }
      }
    }
    scan+=dt;
    if(scan>=.55){
      scan=0;
      for(const job of pending.values()){
        if(day-job.lastDay>MAX_WAIT_DAYS||(!job.origin&&!isActive(source(job.siteId))))
          pending.delete(job.key);
      }
      if(onShift(day)&&available.length&&trips.length<MAX_ACTIVE){
        for(const job of pending.values()){
          if(!available.length||trips.length>=MAX_ACTIVE)break;
          const route=plan(job);
          const worker=available.find(w=>workerBaseById.get(w.id)===route?.baseId);
          if(worker&&dispatch(job,worker,day))available.splice(available.indexOf(worker),1);
        }
      }
    }
    return trips.length>0;
  }
  function draw(){
    const V=window.ConquerVehicles;if(!V?.draw)return 0;
    let count=0;
    for(const t of trips){
      const path=V.makePath(t.points),pos=V.at(path,t.distance);
      if(typeof worldPointVisible==='function'&&!worldPointVisible(pos,0,55))continue;
      count+=V.draw(t,t.points)||0;
    }
    return count;
  }
  function snapshot(){
    const roster=window.ConquerEconomy?.laborAllocation?.(dayOf())?.carters||[];
    return{active:trips.length,pending:pending.size,completed,
      assigned:roster.length,workers:roster.map(w=>w.id),
      toYard:trips.filter(t=>t.destination==='yard').length,
      toMarket:trips.filter(t=>t.destination==='market').length,
      outbound:trips.filter(t=>t.phase==='outbound'||t.phase==='departing'||t.phase==='loading').length,
      returning:trips.filter(t=>t.phase==='returning').length,
      unloading:trips.filter(t=>t.phase==='unloading').length,
      trips:trips.map(t=>({id:t.id,siteId:t.siteId,baseId:t.baseId,destinationId:t.destinationId,
        destination:t.destination,workerId:t.workerId,good:t.good,qty:t.qty,phase:t.phase,emptyReturn:t.emptyReturn}))};
  }
  window.ConquerHaulage=Object.freeze({
    record,tick,draw,reset,snapshot,plan,workerDemand,workerStation,onShift,
    MAX_ACTIVE,MAX_PENDING,ROAD_REACH_SOURCE,ROAD_REACH_YARD,ROAD_REACH_MARKET
  });
})();
