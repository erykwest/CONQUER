'use strict';
// Village daily routines and movement planning. Extracted verbatim from settlement-population.js.
function peasantPath(house,assignment){
  syncPeasantPathCache();
  const field=assignment.field,cell=assignment.cell,key=house.id+'>'+field.id+':'+cell.index;
  if(peasantPathCache.has(key))return peasantPathCache.get(key);
  const start=houseDoorInfo(house).outside,goal={...cell.world};
  let path=roadNetworkPath(start,goal,house.id);
  if(!path&&peasantSegmentClear(start,goal,house.id))path=[start,goal];
  // A farm can be reachable on foot even without a viable nearby road-anchor
  // connector. Only search the local field route once (then cache it) rather
  // than leaving the worker "assigned" but unable to plough or harvest.
  if(!path&&dist(start,goal)<=18)path=findPeasantPath(start,goal,house.id,3);
  if(!path){navPerf.routeMisses=(navPerf.routeMisses||0)+1;path=[start]}
  peasantPathCache.set(key,path);return path;
}
function nearestCompletedStructure(type,from){
  let best=null,bestD=Infinity;
  for(const s of State.structures){
    if(s.type!==type||underConstruction(s))continue;
    const q=structureCenter(s),d=dist(from,q);
    if(d<bestD){best=s;bestD=d}
  }
  return best;
}
function completedWorkshops(){
  return State.structures.filter(s=>!underConstruction(s)&&Array.isArray(s.functions)&&s.functions.includes('workshop'));
}
function nearestWorkshop(from){
  let best=null,bestD=Infinity;
  for(const s of completedWorkshops()){
    const q=structureCenter(s),d=dist(from,q);
    if(d<bestD){best=s;bestD=d}
  }
  return best;
}
function trimPathBeforeCircle(path,center,radius){
  if(!path?.length)return path;
  const out=path.map(p=>({...p}));
  // Walk backward until we find the first segment entering the exclusion circle.
  for(let i=out.length-1;i>0;i--){
    const insideB=dist(out[i],center)<=radius;
    const insideA=dist(out[i-1],center)<=radius;
    if(!insideB&&!insideA)continue;
    const a=out[i-1],b=out[i],dx=b.x-a.x,dy=b.y-a.y;
    const fx=a.x-center.x,fy=a.y-center.y;
    const A=dx*dx+dy*dy;
    if(A<=1e-9)continue;
    const B=2*(fx*dx+fy*dy),C=fx*fx+fy*fy-radius*radius;
    const disc=B*B-4*A*C;
    if(disc<0)continue;
    const roots=[(-B-Math.sqrt(disc))/(2*A),(-B+Math.sqrt(disc))/(2*A)]
      .filter(t=>t>=0&&t<=1).sort((x,y)=>x-y);
    if(!roots.length)continue;
    const t=roots[0];
    const hit={x:a.x+dx*t,y:a.y+dy*t};
    out.splice(i);
    if(!out.length||dist(out.at(-1),hit)>.02)out.push(hit);
    return out;
  }
  return out;
}
function wellApproachPath(house,well){
  if(!house||!well)return[];
  syncPeasantPathCache();
  const key='well:'+house.id+'>'+well.id;
  if(peasantPathCache.has(key))return peasantPathCache.get(key);

  const start=houseDoorInfo(house).outside,center=structureCenter(well);
  let path=roadNetworkPath(start,center,house.id);
  if(path){
    // Stop outside the physical well collider while still using the central
    // road junction as the graph destination.
    path=trimPathBeforeCircle(path,center,.62+PEASANT_CLEARANCE+.16);
    navPerf.wellGraphRoutes=(navPerf.wellGraphRoutes||0)+1;
  }else{
    // No global A* fallback for well trips. The access road is the contract:
    // if the road graph is temporarily unavailable, keep the resident home.
    navPerf.wellRouteMisses=(navPerf.wellRouteMisses||0)+1;
    path=[start];
  }

  peasantPathCache.set(key,path);
  return path;
}
function wellRoutineTravel(house,well,frac,t0,t1,reverse=false){
  const path=wellApproachPath(house,well);
  const t=routineSmooth((frac-t0)/Math.max(.001,t1-t0));
  return pointAlongPath(path,reverse?1-t:t);
}
function structureAccessPoint(target,from,visitorId=''){
  if(!target)return null;
  const h=peasantHash(String(visitorId)+'>'+target.id),jitter=(((h>>>5)%7)-3)*.12;

  // The market is a walkable plaza, not a solid building.
  // Visitors occupy deterministic positions inside the 4×4U square, between stalls.
  if(target.type==='market'){
    const spots=[
      {x:0,y:0},{x:.72,y:0},{x:-.72,y:0},
      {x:0,y:.72},{x:0,y:-.72},{x:.48,y:.48},{x:-.48,y:-.48}
    ];
    const spot=spots[h%spots.length];
    return houseLocalToWorld(target,spot.x,spot.y);
  }

  if(target.type==='tavern'||target.type==='church'){
    return civicEntranceInfo(target)?.outside||structureCenter(target);
  }

  if(['wall','built'].includes(target.type)){
    const mid={x:(target.a.x+target.b.x)/2,y:(target.a.y+target.b.y)/2};
    const dx=target.b.x-target.a.x,dy=target.b.y-target.a.y,L=Math.hypot(dx,dy)||1;
    const nx=-dy/L,ny=dx/L,side=((from.x-mid.x)*nx+(from.y-mid.y)*ny)>=0?1:-1;
    const along=(((h>>>12)%1000)/1000-.5)*Math.min(1.1,target.length*.45);
    const ux=dx/L,uy=dy/L,off=(Number(target.width)||1)/2+.48;
    return{x:mid.x+ux*along+nx*off*side,y:mid.y+uy*along+ny*off*side};
  }
  const center=structureCenter(target);
  if(target.type==='well'){
    const graphPath=roadNetworkPath(from,center,String(visitorId||'well-access'));
    if(graphPath?.length){
      const trimmed=trimPathBeforeCircle(graphPath,center,.62+PEASANT_CLEARANCE+.16);
      if(trimmed?.length)return trimmed.at(-1);
    }
    const angle=Math.atan2(from.y-center.y,from.x-center.x);
    return{
      x:center.x+Math.cos(angle)*(.62+PEASANT_CLEARANCE+.18),
      y:center.y+Math.sin(angle)*(.62+PEASANT_CLEARANCE+.18)
    };
  }
  let radius=.9;
  if(isCivic(target))radius=civicRadius(target)+.5;
  else if(target.type==='tower')radius=(target.shape==='round'?target.r:Math.hypot(...Object.values(rectDims(target)))/2)+.45;
  else if(target.type==='gate')radius=Math.hypot(...Object.values(rectDims(target)))/2+.45;
  else if(target.w&&target.h)radius=Math.hypot(target.w,target.h)/2+.45;
  let angle=Math.atan2(from.y-center.y,from.x-center.x)+jitter;
  if(!Number.isFinite(angle))angle=jitter;
  return{x:center.x+Math.cos(angle)*radius,y:center.y+Math.sin(angle)*radius};
}
function villagerPathBetween(house,start,goal,tag){
  if(!start||!goal)return start?[start]:[];
  syncPeasantPathCache();
  const pkey=p=>p.x.toFixed(2)+','+p.y.toFixed(2);
  const key='route:'+house.id+':'+pkey(start)+'>'+pkey(goal);
  const reverseKey='route:'+house.id+':'+pkey(goal)+'>'+pkey(start);
  if(peasantPathCache.has(key))return peasantPathCache.get(key);
  if(peasantPathCache.has(reverseKey)){
    const path=peasantPathCache.get(reverseKey).slice().reverse();
    peasantPathCache.set(key,path);
    navPerf.reverseRouteHits=(navPerf.reverseRouteHits||0)+1;
    return path;
  }

  let path=roadNetworkPath(start,goal,house.id);
  if(!path&&peasantSegmentClear(start,goal,house.id))path=[start,goal];
  if(!path){
    navPerf.routeMisses=(navPerf.routeMisses||0)+1;
    path=[start];
  }
  peasantPathCache.set(key,path);
  return path;
}
function routineSmooth(t){t=clamp(t,0,1);return t*t*(3-2*t)}
function routineTravel(house,start,goal,frac,t0,t1,tag){
  const path=villagerPathBetween(house,start,goal,tag);
  return pointAlongPath(path,routineSmooth((frac-t0)/Math.max(.001,t1-t0)));
}
function residentIdlePoint(anchor,id,day,radius=.16){
  if(!anchor)return null;
  const h=peasantHash(String(id)+'-idle');
  const phase=((h>>>7)%1000)/1000*Math.PI*2;
  const speed=(.65+((h>>>18)%1000)/1000*.45)/3;
  const a=phase+day*Math.PI*2*speed*12;
  const b=phase*.71+day*Math.PI*2*(speed*.63)*12;
  return{
    x:anchor.x+Math.cos(a)*radius,
    y:anchor.y+Math.sin(b)*radius*.72
  };
}
function childHomePosition(house,resident,day){
  const frac=day-Math.floor(day);
  if(frac<.06||frac>.64)return null;
  const center=structureCenter(house),door=houseDoorInfo(house).outside;
  let nx=door.x-center.x,ny=door.y-center.y;
  const nL=Math.hypot(nx,ny)||1;nx/=nL;ny/=nL;
  const tx=-ny,ty=nx,h=peasantHash(resident.id+'-child-idle');
  const phase=((h>>>6)%1000)/1000*Math.PI*2;
  const pace=(.75+((h>>>17)%1000)/1000*.55)/3;
  const t=phase+day*Math.PI*2*pace*18;
  const side=Math.sin(t)*(.45+((h>>>10)%1000)/1000*.42);
  const outward=.12+.12*(.5+.5*Math.sin(t*.61+phase));
  let p={x:door.x+tx*side+nx*outward,y:door.y+ty*side+ny*outward};
  const dx=p.x-center.x,dy=p.y-center.y,d=Math.hypot(dx,dy);
  if(d>1.72)p={x:center.x+dx/d*1.72,y:center.y+dy/d*1.72};
  return p;
}
function fallbackSocialTarget(house,from,visitorId){
  const market=nearestCompletedStructure('market',from);
  if(market)return{structure:market,point:structureAccessPoint(market,from,visitorId)};
  const tavern=nearestCompletedStructure('tavern',from);
  if(tavern)return{structure:tavern,point:structureAccessPoint(tavern,from,visitorId)};
  const church=nearestCompletedStructure('church',from);
  if(church)return{structure:church,point:structureAccessPoint(church,from,visitorId)};
  const well=nearestCompletedStructure('well',from);
  if(well)return{structure:well,point:structureAccessPoint(well,from,visitorId)};
  return null;
}
function artisanPosition(house,day){
  const frac=day-Math.floor(day),hash=peasantHash(house.id),stagger=(((hash>>>8)%1000)/1000-.5)*.024;
  const home=houseDoorInfo(house).outside;
  const workshop=nearestWorkshop(home);
  const market=nearestCompletedStructure('market',home);
  let primary=workshop?{structure:workshop,point:structureAccessPoint(workshop,home,house.id+'-work')}:null;
  if(!primary&&market)primary={structure:market,point:structureAccessPoint(market,home,house.id+'-work')};
  if(!primary)primary=fallbackSocialTarget(house,home,house.id+'-work');
  if(!primary)return null;
  let secondary=market&&market.id!==primary.structure?.id?{structure:market,point:structureAccessPoint(market,primary.point,house.id+'-market')}:null;

  const leave0=.08+stagger,arriveWork=.15+stagger,leaveWork=.37+stagger;
  const arriveSecond=.44+stagger,leaveSecond=.55+stagger,homeAt=.63+stagger;
  if(frac<leave0||frac>homeAt)return null;
  if(frac<arriveWork)return routineTravel(house,home,primary.point,frac,leave0,arriveWork,'artisan-home-work');
  if(frac<leaveWork)return residentIdlePoint(primary.point,house.id+'-artisan-work',day,.18);
  if(secondary){
    if(frac<arriveSecond)return routineTravel(house,primary.point,secondary.point,frac,leaveWork,arriveSecond,'artisan-work-market');
    if(frac<leaveSecond)return residentIdlePoint(secondary.point,house.id+'-artisan-second',day,.18);
    return routineTravel(house,secondary.point,home,frac,leaveSecond,homeAt,'artisan-market-home');
  }
  if(frac<leaveSecond)return residentIdlePoint(primary.point,house.id+'-artisan-primary',day,.18);
  return routineTravel(house,primary.point,home,frac,leaveSecond,homeAt,'artisan-work-home');
}
function merchantPosition(house,day){
  const frac=day-Math.floor(day),hash=peasantHash(house.id),stagger=(((hash>>>8)%1000)/1000-.5)*.024;
  const home=houseDoorInfo(house).outside;
  const market=nearestCompletedStructure('market',home);
  const first=market?{structure:market,point:structureAccessPoint(market,home,house.id+'-market')}:fallbackSocialTarget(house,home,house.id+'-market');
  if(!first)return null;
  const tavern=nearestCompletedStructure('tavern',first.point);
  const second=tavern&&tavern.id!==first.structure?.id?{structure:tavern,point:structureAccessPoint(tavern,first.point,house.id+'-tavern')}:null;

  const leave0=.10+stagger,arriveFirst=.17+stagger,leaveFirst=.43+stagger;
  const arriveSecond=.49+stagger,leaveSecond=.57+stagger,homeAt=.65+stagger;
  if(frac<leave0||frac>homeAt)return null;
  if(frac<arriveFirst)return routineTravel(house,home,first.point,frac,leave0,arriveFirst,'merchant-home-market');
  if(frac<leaveFirst)return residentIdlePoint(first.point,house.id+'-merchant-first',day,.20);
  if(second){
    if(frac<arriveSecond)return routineTravel(house,first.point,second.point,frac,leaveFirst,arriveSecond,'merchant-market-tavern');
    if(frac<leaveSecond)return residentIdlePoint(second.point,house.id+'-merchant-second',day,.20);
    return routineTravel(house,second.point,home,frac,leaveSecond,homeAt,'merchant-tavern-home');
  }
  if(frac<leaveSecond)return residentIdlePoint(first.point,house.id+'-merchant-primary',day,.20);
  return routineTravel(house,first.point,home,frac,leaveSecond,homeAt,'merchant-market-home');
}
function elitePosition(house,day){
  const frac=day-Math.floor(day),hash=peasantHash(house.id),stagger=(((hash>>>8)%1000)/1000-.5)*.018;
  const home=houseDoorInfo(house).outside;
  const church=nearestCompletedStructure('church',home);
  const market=nearestCompletedStructure('market',home);
  const tavern=nearestCompletedStructure('tavern',home);
  const stops=[church,market,tavern].filter(Boolean);
  if(!stops.length)return null;
  const points=stops.map((s,i)=>structureAccessPoint(s,i?structureCenter(stops[i-1]):home,house.id+'-elite-'+i));
  const t0=.10+stagger,t1=.17+stagger,t2=.29+stagger,t3=.36+stagger,t4=.46+stagger,t5=.52+stagger,t6=.58+stagger,t7=.65+stagger;
  const a=points[0],b=points[1]||a,d=points[2]||b;
  if(frac<t0||frac>t7)return null;
  if(frac<t1)return routineTravel(house,home,a,frac,t0,t1,'elite-home-a');
  if(frac<t2)return residentIdlePoint(a,house.id+'-elite-a',day,.16);
  if(frac<t3)return routineTravel(house,a,b,frac,t2,t3,'elite-a-b');
  if(frac<t4)return residentIdlePoint(b,house.id+'-elite-b',day,.16);
  if(frac<t5)return routineTravel(house,b,d,frac,t4,t5,'elite-b-c');
  if(frac<t6)return residentIdlePoint(d,house.id+'-elite-c',day,.16);
  return routineTravel(house,d,home,frac,t6,t7,'elite-home');
}
function pointAlongPath(path,t){
  if(!path?.length)return null;if(path.length===1)return path[0];
  t=clamp(t,0,1);const lens=[];let total=0;
  for(let i=0;i<path.length-1;i++){const L=dist(path[i],path[i+1]);lens.push(L);total+=L}
  if(total<=1e-6)return path[0];
  let target=t*total;
  for(let i=0;i<lens.length;i++){
    if(target<=lens[i]){const u=lens[i]?target/lens[i]:0;return{x:path[i].x+(path[i+1].x-path[i].x)*u,y:path[i].y+(path[i+1].y-path[i].y)*u}}
    target-=lens[i];
  }
  return path.at(-1);
}
function peasantPosition(house,assignment,day){
  const frac=day-Math.floor(day);
  const leave0=.06,leave1=.14,return0=.52,return1=.62;
  if(frac<leave0||frac>return1)return null;
  const base=peasantPath(house,assignment);
  if(dist(base.at(-1),assignment.cell.world)>.05)return null;
  const path=base.concat(fieldWorkerRoute(assignment.field,assignment.cell));
  const work=fieldWorkerPosition(assignment.field,assignment.cell);
  const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t)};
  if(frac<leave1)return pointAlongPath(path,smooth((frac-leave0)/(leave1-leave0)));
  if(frac<return0)return work;
  return pointAlongPath(path,1-smooth((frac-return0)/(return1-return0)));
}
