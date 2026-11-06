'use strict';
// Local stockyard haulage — purely visual trips driven by booked production.
// ConquerEconomy is the one ledger; arrival and departure NEVER change stock.
// Reuses ConquerVehicles road routing and the existing 2D wagon/horse artwork.
(() => {
  const MAX_ACTIVE=4,MAX_PENDING=32,MAX_WAIT_DAYS=10;
  const ROAD_REACH_SOURCE=3.5,ROAD_REACH_YARD=4.0;
  const LOAD_SECONDS=.45,UNLOAD_SECONDS=.8;
  const pending=new Map(),trips=[],dispatched=new Map();
  let sequence=0,scan=0,completed=0;
  const finite=n=>Number.isFinite(Number(n))?Number(n):0;
  const goodTypes=new Set(['wood','stone','clay','food','metal','equipment','luxury']);
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const source=id=>(State.structures||[]).find(s=>s.id===id);
  function isActive(s){
    return !!s&&!s.destroyed&&!s.abandoned&&!s.burnt&&
      !(typeof underConstruction==='function'&&underConstruction(s));
  }
  function yards(){return (window.ConquerStorageYard?.active?.()||[]).filter(isActive)}
  function reset(){pending.clear();trips.length=0;dispatched.clear();scan=0;completed=0}
  // Called only AFTER ConquerEconomy credits castle stock, for its ACTUAL
  // retained amount. No visual delivery of private output or unsold market lots.
  function record({siteId,origin=null,good,qty,day=State.clock?.day}={}){
    const amount=finite(qty),at=finite(day);
    if(!State.village?.founded||!siteId||!goodTypes.has(good)||amount<=0||!yards().length)return false;
    if(!origin&&!isActive(source(siteId)))return false;
    const key=String(siteId)+'|'+good;
    const current=pending.get(key);
    if(current){
      current.qty=Math.min(1000,current.qty+amount);
      current.lastDay=at;
      return true;
    }
    if(pending.size>=MAX_PENDING)pending.delete(pending.keys().next().value);
    pending.set(key,{key,siteId,origin:origin?{x:origin.x,y:origin.y}:null,
      good,qty:amount,day:at,lastDay:at});
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
    let best=null;
    for(const yard of yards()){
      if(yard.id===job.siteId||nearestRoadDistance(yard,graph)>ROAD_REACH_YARD)continue;
      const raw=V.route(from,yard);
      if(!raw||raw.length<2)continue;
      const length=V.makePath(raw).total;
      if(length<.3||!Number.isFinite(length))continue;
      const score=length+.25*(distance(from,raw[0])+distance(yard,raw[raw.length-1]));
      if(!best||score<best.score)
        best={yardId:yard.id,points:V.smooth(raw),score};
    }
    return best;
  }
  function dispatch(job,day){
    const last=dispatched.get(job.key);
    if(last!=null&&day-last<.5)return false;
    if(trips.some(t=>t.key===job.key))return false;
    const route=plan(job);if(!route)return false;
    const trip={id:'local-haul-'+(++sequence),key:job.key,siteId:job.siteId,yardId:route.yardId,
      good:job.good,qty:job.qty,vehicle:job.good==='wood'||job.qty>45?'wagon':'cart',
      vehicles:1,guards:0,seed:sequence%4,points:route.points,
      distance:0,speed:0,phase:'loading',remain:LOAD_SECONDS,emptyReturn:false,virtualSource:!!job.origin};
    trips.push(trip);pending.delete(job.key);dispatched.set(job.key,day);
    return true;
  }
  function tick(dt){
    if(!State.village?.founded){if(pending.size||trips.length)reset();return false}
    if(!(State.clock?.speed>0)||!Number.isFinite(dt)||dt<=0)return false;
    const V=window.ConquerVehicles;
    if(!V)return false;
    const elapsed=Math.min(dt,.25)*Math.min(4,Math.sqrt(Math.max(1,State.clock.speed)));
    for(let i=trips.length-1;i>=0;i--){
      const t=trips[i];
      if((!t.virtualSource&&!isActive(source(t.siteId)))||
          !yards().some(y=>y.id===t.yardId)){trips.splice(i,1);continue}
      if(t.phase==='loading'||t.phase==='unloading'){
        t.remain-=elapsed;
        if(t.remain>0)continue;
        if(t.phase==='loading'){t.phase='outbound';t.speed=0}
        else{t.phase='returning';t.emptyReturn=true;t.points=t.points.slice().reverse();t.distance=0;t.speed=0}
        continue;
      }
      if(V.advance(t,t.points,elapsed)){
        if(t.phase==='outbound'){t.phase='unloading';t.remain=UNLOAD_SECONDS;t.speed=0}
        else{trips.splice(i,1);completed++}
      }
    }
    scan+=dt;
    if(scan>=.55&&trips.length<MAX_ACTIVE&&pending.size){
      scan=0;const day=finite(State.clock.day);
      for(const job of pending.values()){
        if(day-job.lastDay>MAX_WAIT_DAYS||
          (!job.origin&&!isActive(source(job.siteId)))){pending.delete(job.key);continue}
        if(dispatch(job,day)&&trips.length>=MAX_ACTIVE)break;
      }
    }
    return trips.length>0;
  }
  // Stock is booked immediately by ConquerEconomy. The outbound wagon is a
  // visual representation of that booking, NOT an unbooked in-transit ledger.
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
  function snapshot(){return{active:trips.length,pending:pending.size,completed,
    outbound:trips.filter(t=>t.phase==='loading'||t.phase==='outbound').length,
    returning:trips.filter(t=>t.phase==='returning').length,
    unloading:trips.filter(t=>t.phase==='unloading').length,
    trips:trips.map(t=>({id:t.id,siteId:t.siteId,yardId:t.yardId,good:t.good,qty:t.qty,phase:t.phase,emptyReturn:t.emptyReturn}))}}
  window.ConquerHaulage=Object.freeze({record,tick,draw,reset,snapshot,plan,
    MAX_ACTIVE,MAX_PENDING,ROAD_REACH_SOURCE,ROAD_REACH_YARD});
})();