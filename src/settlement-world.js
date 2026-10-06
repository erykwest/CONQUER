'use strict';
// CONQUER settlement world module — classic-script shared runtime.
function gatePassageInfo(gate,reference=null){
  if(!gate||gate.type!=='gate')return null;
  const d=rectDims(gate),a=gate.angle||0,ux=Math.cos(a),uy=Math.sin(a),vx=-uy,vy=ux;
  const halfLength=d.w/2,halfWidth=Math.min(d.h*.40,.52);
  const sideA={x:gate.x-ux*(halfLength+.20),y:gate.y-uy*(halfLength+.20)};
  const sideB={x:gate.x+ux*(halfLength+.20),y:gate.y+uy*(halfLength+.20)};
  let near=sideA,far=sideB;
  if(reference&&dist(reference,sideB)<dist(reference,sideA)){near=sideB;far=sideA}
  return{
    center:{x:gate.x,y:gate.y},ux,uy,vx,vy,halfLength,halfWidth,
    sideA,sideB,near,far
  };
}
function gatePointInPassage(gate,p,pad=.04){
  const info=gatePassageInfo(gate);if(!info)return false;
  const q=toLocalPoint(gate,p);
  return Math.abs(q.x)<=info.halfLength+pad&&Math.abs(q.y)<=info.halfWidth+pad;
}
function roadUsesGatePassage(road,gate){
  if(!road||!gate||gate.type!=='gate')return false;
  const info=gatePassageInfo(gate),mid=closestPointOnSegment(info.center,road.a,road.b);
  if(dist(mid,info.center)>info.halfWidth*.82)return false;
  const dx=road.b.x-road.a.x,dy=road.b.y-road.a.y,L=Math.hypot(dx,dy)||1;
  const dot=Math.abs((dx/L)*info.ux+(dy/L)*info.uy);
  return dot>=Math.cos(32*Math.PI/180);
}
function pointSegmentDistance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,L2=dx*dx+dy*dy;if(!L2)return dist(p,a);const t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/L2,0,1);return dist(p,{x:a.x+t*dx,y:a.y+t*dy})}
function segmentsIntersect(a,b,c,d){const cr=(p,q,r)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);const a1=cr(a,b,c),a2=cr(a,b,d),a3=cr(c,d,a),a4=cr(c,d,b);return ((a1>0&&a2<0)||(a1<0&&a2>0))&&((a3>0&&a4<0)||(a3<0&&a4>0))}
function roadTouchesPolygon(road,poly,pad=.08){
  if(!poly?.length)return false;
  const clearance=(Number(road.width)||.3)/2+pad;
  if(pointInPolygon(road.a,poly)||pointInPolygon(road.b,poly))return true;
  for(let i=0;i<poly.length;i++){
    const j=(i+1)%poly.length;
    if(segmentsIntersect(road.a,road.b,poly[i],poly[j]))return true;
    if(segmentDistance(road.a,road.b,poly[i],poly[j])<=clearance)return true;
  }
  return false;
}
function manualRoadConflict(road,manual){
  if(!manual)return false;
  // The market is a paved public square; castle gates contain a real traversable passage.
  if(manual.type==='market')return false;
  if(manual.type==='gate'&&roadUsesGatePassage(road,manual))return false;
  if(['wall','built'].includes(manual.type)){
    return segmentsIntersect(road.a,road.b,manual.a,manual.b)||
      pointSegmentDistance(manual.a,road.a,road.b)<=manual.width/2+(road.width||.3)/2||
      pointSegmentDistance(manual.b,road.a,road.b)<=manual.width/2+(road.width||.3)/2;
  }
  if(manual.type==='tower'&&manual.shape==='round'){
    return pointSegmentDistance(manual,road.a,road.b)<=manual.r+(road.width||.3)/2+.08;
  }
  const rings=manual.type==='house'?houseFootprintParts(manual).map(p=>p.points):
    isCivic(manual)?civicParts(manual).map(p=>p.points):
    [footprintPoints(manual)];
  return rings.some(poly=>roadTouchesPolygon(road,poly,.10));
}
function autoOverlapsManual(auto,manual){
  const linear=['wall','built'].includes(manual.type);
  if(auto.type==='road')return manualRoadConflict(auto,manual);
  const p={x:auto.x,y:auto.y},r=pointRadius(auto);
  if(linear)return pointSegmentDistance(p,manual.a,manual.b)<=r+manual.width/2+.15;
  return dist(p,{x:manual.x,y:manual.y})<=r+pointRadius(manual)+.15;
}
function removeOverlappingAuto(manual){
  let removed=0;const roads=[];
  State.structures=State.structures.filter(s=>{
    const hit=s.auto&&autoOverlapsManual(s,manual);
    if(hit){removed++;if(s.type==='road')roads.push({...s,a:{...s.a},b:{...s.b}})}
    return !hit;
  });
  return{removed,roads};
}
function roadRepairPointClear(p,width=.30,ignoreIds=[]){
  if(!inBuild(p)||environmentBlocksPoint(p,'road'))return false;
  const clearance=width/2+.16;
  for(const s of State.structures){
    if(ignoreIds.includes(s.id)||s.type==='road')continue;
    if(s.type==='market')continue;
    if(s.type==='gate'){
      if(gatePointInPassage(s,p,Math.max(.05,width*.10)))continue;
      const q=toLocalPoint(s,p),d=rectDims(s);
      if(Math.abs(q.x)<=d.w/2+clearance&&Math.abs(q.y)<=d.h/2+clearance)return false;
      continue;
    }
    if(['wall','built'].includes(s.type)){
      if(pointSegmentDistance(p,s.a,s.b)<=Number(s.width)/2+clearance)return false;
      continue;
    }
    if(s.type==='well'){if(dist(p,s)<=.62+clearance)return false;continue}
    if(s.type==='tower'&&s.shape==='round'){if(dist(p,s)<=s.r+clearance)return false;continue}
    let rings=[];
    if(s.type==='house')rings=houseFootprintParts(s).map(q=>q.points);
    else if(isCivic(s))rings=civicParts(s).map(q=>q.points);
    else if(s.type==='field')rings=[rectWorldPoints(s.x,s.y,s.w,s.h,s.angle||0)];
    else if(s.x!=null)rings=[footprintPoints(s)];
    for(const poly of rings){
      if(!poly?.length)continue;
      if(pointInPolygon(p,poly))return false;
      for(let i=0;i<poly.length;i++){
        const j=(i+1)%poly.length;
        if(pointSegmentDistance(p,poly[i],poly[j])<=clearance)return false;
      }
    }
  }
  return true;
}
function roadRepairSegmentClear(a,b,width=.30,ignoreIds=[]){
  const L=dist(a,b),steps=Math.max(2,Math.ceil(L/.24));
  for(let i=0;i<=steps;i++){
    const t=i/steps,p={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};
    if(!roadRepairPointClear(p,width,ignoreIds))return false;
  }
  return true;
}
function findRoadRepairPath(start,goal,width=.30,pad=8,ignoreIds=[],maxGuard=24000){
  const step=.5;
  const minX=Math.floor((Math.min(start.x,goal.x)-pad)/step),maxX=Math.ceil((Math.max(start.x,goal.x)+pad)/step);
  const minY=Math.floor((Math.min(start.y,goal.y)-pad)/step),maxY=Math.ceil((Math.max(start.y,goal.y)+pad)/step);
  const key=(x,y)=>x+','+y,pos=(x,y)=>({x:x*step,y:y*step});
  function nearestFree(p){
    const cx=Math.round(p.x/step),cy=Math.round(p.y/step);let best=null,bestD=Infinity;
    for(let r=0;r<=6;r++)for(let dx=-r;dx<=r;dx++)for(let dy=-r;dy<=r;dy++){
      if(Math.max(Math.abs(dx),Math.abs(dy))!==r)continue;
      const x=cx+dx,y=cy+dy,q=pos(x,y);
      if(x<minX||x>maxX||y<minY||y>maxY||!roadRepairPointClear(q,width,ignoreIds))continue;
      const d=dist(p,q);if(d<bestD){best={x,y,q};bestD=d}
    }
    return best;
  }
  const s=nearestFree(start),g=nearestFree(goal);if(!s||!g)return null;
  const open=new PeasantMinHeap(),gScore=new Map([[key(s.x,s.y),0]]),came=new Map(),closed=new Set();
  open.push({x:s.x,y:s.y,f:dist(s.q,g.q)});
  const dirs=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
  let found=null,guard=0;
  while(open.length&&guard++<maxGuard){
    const cur=open.pop(),ck=key(cur.x,cur.y);if(closed.has(ck))continue;closed.add(ck);
    if(cur.x===g.x&&cur.y===g.y){found=cur;break}
    const cp=pos(cur.x,cur.y);
    for(const [dx,dy] of dirs){
      const nx=cur.x+dx,ny=cur.y+dy;if(nx<minX||nx>maxX||ny<minY||ny>maxY)continue;
      const nk=key(nx,ny),np=pos(nx,ny);if(closed.has(nk)||!roadRepairPointClear(np,width,ignoreIds))continue;
      if(!roadRepairSegmentClear(cp,np,width,ignoreIds))continue;
      const tentative=(gScore.get(ck)??Infinity)+Math.hypot(dx,dy)*step;
      if(tentative>=(gScore.get(nk)??Infinity))continue;
      gScore.set(nk,tentative);came.set(nk,ck);
      open.push({x:nx,y:ny,f:tentative+dist(np,g.q)});
    }
  }
  if(!found)return null;
  const rev=[];let k=key(found.x,found.y);
  while(k){const [x,y]=k.split(',').map(Number);rev.push(pos(x,y));k=came.get(k)}
  rev.reverse();
  if(roadRepairPointClear(start,width,ignoreIds))rev[0]={...start};
  if(roadRepairPointClear(goal,width,ignoreIds))rev[rev.length-1]={...goal};
  return rev;
}
function simplifyRoadRepairPath(points,width=.30,ignoreIds=[]){
  if(!points||points.length<=2)return points||[];
  const out=[points[0]];let i=0;
  while(i<points.length-1){
    let chosen=i+1;
    for(let j=points.length-1;j>i+1;j--){
      if(roadRepairSegmentClear(points[i],points[j],width,ignoreIds)){chosen=j;break}
    }
    out.push(points[chosen]);i=chosen;
  }
  return out;
}
function reactiveRoadExists(a,b,eps=.24){
  return roadList().some(r=>(dist(r.a,a)<eps&&dist(r.b,b)<eps)||(dist(r.a,b)<eps&&dist(r.b,a)<eps));
}
function addReactiveRoadPolyline(points,template={},meta={}){
  if(!points||points.length<2)return 0;
  const width=Number(template.width)||.30,clean=simplifyRoadRepairPath(points,width,meta.ignoreIds||[]);
  let added=0,total=Math.max(1,clean.length-1);
  for(let i=0;i<clean.length-1;i++){
    const a=clean[i],b=clean[i+1];if(dist(a,b)<.24||reactiveRoadExists(a,b))continue;
    const road={
      id:uid(),type:'road',auto:true,roadClass:meta.roadClass||'reactive',
      a:{...a},b:{...b},width,appeal:.95,reactive:true,
      parentRoadId:template.parentRoadId||null
    };
    if(template.routeId)road.routeId=template.routeId;
    if(Number.isFinite(template.routeSeq))road.routeSeq=template.routeSeq+i/total;
    if(meta.repairFor)road.repairFor=meta.repairFor;
    if(meta.accessFor)road.accessFor=meta.accessFor;
    if(!meta.instant)beginConstruction(road);
    State.structures.push(road);added++;
  }
  return added;
}
function arterialRoutePlan(routeId){
  return ensureRoadPlan().find(r=>r.id===routeId)||null;
}
function arterialSegmentOrderValue(r){
  return Number.isFinite(Number(r.routeSeq))?Number(r.routeSeq):0;
}
function arterialRouteContinuous(routeId){
  const well=State.structures.find(s=>s.id===State.village.wellId),plan=arterialRoutePlan(routeId);
  const roads=routeRoads(routeId);if(!well||!plan||!roads.length)return false;
  let cursor={x:well.x,y:well.y};
  for(const r of roads){
    if(dist(cursor,r.a)<=.42)cursor={...r.b};
    else if(dist(cursor,r.b)<=.42)cursor={...r.a};
    else return false;
  }
  return !plan.connected||dist(cursor,plan.target)<=.65;
}
function arterialSourceSegments(routeId,displaced=[]){
  const map=new Map();
  for(const r of [...routeRoads(routeId),...(displaced||[])]){
    if(r.routeId!==routeId)continue;
    const key=(Number.isFinite(Number(r.routeSeq))?Number(r.routeSeq).toFixed(5):r.id);
    // Prefer the displaced/original segment when duplicate metadata exists.
    map.set(key,r);
  }
  return [...map.values()].sort((a,b)=>arterialSegmentOrderValue(a)-arterialSegmentOrderValue(b));
}
function arterialSafeWaypoints(routeId,displaced=[]){
  const well=State.structures.find(s=>s.id===State.village.wellId),plan=arterialRoutePlan(routeId);
  if(!well||!plan)return[];
  const source=arterialSourceSegments(routeId,displaced),width=.62,ignore=[well.id];
  const pts=[{x:well.x,y:well.y}];

  // Preserve the established arterial geometry wherever it is still valid.
  for(const r of source){
    const p={...r.b};
    if(dist(p,pts.at(-1))<.45)continue;
    if(roadRepairPointClear(p,width,ignore))pts.push(p);
  }

  if(plan.connected){
    if(dist(pts.at(-1),plan.target)>.35)pts.push({...plan.target});
  }else if(source.length){
    // An incomplete route should only be rebuilt to its previous frontier,
    // never be magically completed to the border.
    const frontier={...source.at(-1).b};
    if(dist(pts.at(-1),frontier)>.35)pts.push(frontier);
  }
  return pts;
}
function buildArterialRepairPolyline(routeId,displaced=[]){
  const well=State.structures.find(s=>s.id===State.village.wellId),waypoints=arterialSafeWaypoints(routeId,displaced);
  if(!well||waypoints.length<2)return null;
  const width=.62,ignore=[well.id],full=[waypoints[0]];
  for(let i=0;i<waypoints.length-1;i++){
    const a=full.at(-1),b=waypoints[i+1];let leg=null;
    if(roadRepairSegmentClear(a,b,width,ignore))leg=[a,b];
    else leg=findRoadRepairPath(a,b,width,12,ignore,60000);
    if(!leg||leg.length<2)return null;
    for(let j=1;j<leg.length;j++){
      const p=leg[j];if(dist(full.at(-1),p)>.08)full.push(p);
    }
  }
  return simplifyRoadRepairPath(full,width,ignore);
}
function subdivideRoadPolyline(points,maxLen=5.0){
  if(!points||points.length<2)return points||[];
  const out=[{...points[0]}];
  for(let i=0;i<points.length-1;i++){
    const a=points[i],b=points[i+1],L=dist(a,b),n=Math.max(1,Math.ceil(L/maxLen));
    for(let k=1;k<=n;k++){
      const t=k/n;out.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
    }
  }
  return out;
}
function refreshStaleHouseRoadRefs(){
  const roads=roadList(true);if(!roads.length)return;
  for(const h of autoList('house')){
    if(h.roadId&&State.structures.some(r=>r.id===h.roadId&&r.type==='road'))continue;
    let best=null,bestD=Infinity;
    for(const r of roads){
      const d=pointSegmentDistance(h,r.a,r.b);
      if(d<bestD){best=r;bestD=d}
    }
    if(best)h.roadId=best.id;
  }
}
function rebuildArterialRoute(routeId,displaced=[]){
  const plan=arterialRoutePlan(routeId),path=buildArterialRepairPolyline(routeId,displaced);
  if(!plan||!path||path.length<2)return 0;

  // Only replace the route after a complete valid path has been found.
  State.structures=State.structures.filter(r=>!(r.type==='road'&&r.routeId===routeId));
  const pts=subdivideRoadPolyline(path,ROAD_RULES.arterialSegmentMax);
  let added=0,parent=null;
  for(let i=0;i<pts.length-1;i++){
    const a=pts[i],b=pts[i+1];if(dist(a,b)<.18)continue;
    const road={
      id:uid(),type:'road',auto:true,roadClass:'arterial',routeId,routeSeq:added,
      a:{...a},b:{...b},width:.62,appeal:1,parentRoadId:parent,
      reactive:true,arterialRebuilt:true
    };
    // Route repair is topology restoration, not a new growth event: it becomes usable immediately.
    State.structures.push(road);parent=road.id;added++;
  }
  refreshStaleHouseRoadRefs();
  invalidateNavigation();
  return added;
}
function reconcileArterialRoutes(){
  let changed=0;
  for(const route of ensureRoadPlan()){
    const roads=routeRoads(route.id);
    if(roads.length&&!arterialRouteContinuous(route.id))changed+=rebuildArterialRoute(route.id,[]);
  }
  return changed;
}
function repairDisplacedRoads(displaced,manual){
  let added=0;
  const all=displaced||[],arterialIds=[...new Set(all.filter(r=>r.routeId).map(r=>r.routeId))];

  // Primary roads are repaired as complete ordered routes, not as isolated deleted pieces.
  for(const routeId of arterialIds){
    const affected=all.filter(r=>r.routeId===routeId);
    const rebuilt=rebuildArterialRoute(routeId,affected);
    if(rebuilt)added+=rebuilt;
    else{
      // Conservative fallback: if a full route cannot be resolved, at least try each missing span.
      for(const old of affected){
        const well=State.structures.find(s=>s.id===State.village.wellId),ignore=well?[well.id]:[];
        const path=findRoadRepairPath(old.a,old.b,Number(old.width)||.62,12,ignore,50000);
        if(path)added+=addReactiveRoadPolyline(path,old,{repairFor:manual.id,roadClass:'arterial-repair'});
      }
    }
  }

  for(const old of all.filter(r=>!r.routeId)){
    const path=findRoadRepairPath(old.a,old.b,Number(old.width)||.30,10,[]);
    if(path)added+=addReactiveRoadPolyline(path,old,{repairFor:manual.id,roadClass:old.roadClass||'repair'});
  }
  return added;
}
function gateMainRouteId(gate){return 'gate-main:'+gate.id}
function gateMainRouteContinuous(gate){
  const well=State.structures.find(s=>s.id===State.village.wellId),roads=routeRoads(gateMainRouteId(gate));
  if(!well||!roads.length)return false;
  const passage=gatePassageInfo(gate,well);if(!passage)return false;
  let cursor={x:well.x,y:well.y};
  for(const r of roads){
    if(dist(cursor,r.a)<=.48)cursor={...r.b};
    else if(dist(cursor,r.b)<=.48)cursor={...r.a};
    else return false;
  }
  return dist(cursor,passage.far)<=.72;
}
function buildGateMainConnection(gate,force=false){
  const well=State.structures.find(s=>s.id===State.village.wellId);
  if(!gate||gate.type!=='gate'||underConstruction(gate)||!well||underConstruction(well))return 0;
  const routeId=gateMainRouteId(gate);
  if(!force&&gateMainRouteContinuous(gate))return 0;

  const passage=gatePassageInfo(gate,well);if(!passage)return 0;
  const ignore=[well.id],width=.62;
  let approach;
  if(roadRepairSegmentClear({x:well.x,y:well.y},passage.near,width,ignore)){
    approach=[{x:well.x,y:well.y},{...passage.near}];
  }else{
    approach=findRoadRepairPath({x:well.x,y:well.y},passage.near,width,16,ignore,80000);
  }
  if(!approach||approach.length<2)return 0;

  const full=approach.slice();
  for(const p of [passage.center,passage.far]){
    if(dist(full.at(-1),p)>.08)full.push({...p});
  }
  // Validate the explicit passage itself. Gate corridor is transparent, while
  // neighboring walls/towers remain true blockers.
  if(!roadRepairSegmentClear(passage.near,passage.center,width,ignore)||
     !roadRepairSegmentClear(passage.center,passage.far,width,ignore))return 0;

  const clean=simplifyRoadRepairPath(full,width,ignore),pts=subdivideRoadPolyline(clean,ROAD_RULES.arterialSegmentMax);
  if(pts.length<2)return 0;

  // Atomic replacement: the previous gate artery remains until a valid new path exists.
  State.structures=State.structures.filter(r=>!(r.type==='road'&&r.routeId===routeId));
  let added=0,parent=null;
  for(let i=0;i<pts.length-1;i++){
    const a=pts[i],b=pts[i+1];if(dist(a,b)<.16)continue;
    const road={
      id:uid(),type:'road',auto:true,roadClass:'arterial-gate',
      routeId,routeSeq:added,a:{...a},b:{...b},width,appeal:1,
      parentRoadId:parent,gateFor:gate.id,reactive:true
    };
    // A gate becomes part of the primary network as soon as it is completed.
    State.structures.push(road);parent=road.id;added++;
  }
  refreshStaleHouseRoadRefs();
  invalidateNavigation();
  return added;
}
function reconcileGateMainConnections(force=false){
  let changed=0;
  const liveGateIds=new Set();
  for(const gate of State.structures){
    if(gate.type!=='gate'||underConstruction(gate))continue;
    liveGateIds.add(gate.id);
    changed+=buildGateMainConnection(gate,force);
  }
  const before=State.structures.length;
  State.structures=State.structures.filter(s=>!s.gateFor||liveGateIds.has(s.gateFor));
  changed+=before-State.structures.length;
  return changed;
}
function nearestRoadProjection(p,excludeAccessFor=null){
  let best=null,bestD=Infinity;
  for(const r of roadList(true)){
    if(excludeAccessFor&&r.accessFor===excludeAccessFor)continue;
    const q=closestPointOnSegment(p,r.a,r.b),d=dist(p,q);
    if(d<bestD){best={road:r,point:q,d};bestD=d}
  }
  return best;
}
function nearestPrimaryRoadProjection(p){
  let best=null,bestD=Infinity;
  for(const r of primaryRoadList(true)){
    const q=closestPointOnSegment(p,r.a,r.b),d=dist(p,q);
    if(d<bestD){best={road:r,point:q,d};bestD=d}
  }
  return best;
}
function fieldRoadAccessPoint(field,target){
  const q=toLocalPoint(field,target),hw=Math.max(.1,(Number(field.w)||2)/2),hh=Math.max(.1,(Number(field.h)||2)/2);
  let x=clamp(q.x,-hw,hw),y=clamp(q.y,-hh,hh);
  const nx=Math.abs(q.x)/hw,ny=Math.abs(q.y)/hh;
  if(nx>=ny)x=(q.x>=0?1:-1)*hw;
  else y=(q.y>=0?1:-1)*hh;
  const edge=houseLocalToWorld(field,x,y),center={x:field.x,y:field.y};
  const dx=edge.x-center.x,dy=edge.y-center.y,L=Math.hypot(dx,dy)||1;
  return{x:edge.x+dx/L*.28,y:edge.y+dy/L*.28};
}
function settlementRoadAccessPoint(s,target){
  if(s.type==='house')return houseDoorInfo(s).outside;
  if(s.type==='field')return fieldRoadAccessPoint(s,target);
  if(s.type==='market')return marketRoadAccessPoint(s,target);
  if(s.type==='training')return fieldRoadAccessPoint({...s,w:5,h:4},target);
  if(s.type==='tavern'||s.type==='church')return civicEntranceInfo(s)?.outside||structureCenter(s);
  return structureCenter(s);
}
function settlementAccessTargets(){
  return State.structures.filter(s=>
    !underConstruction(s)&&(
      s.type==='house'||s.type==='field'||isCivic(s)
    )
  );
}
function rebuildSecondaryRoadsOnLoad(){
  let removed=0;
  State.structures=State.structures.filter(s=>{
    // Primary arterial routes and gate-main routes always carry routeId.
    // Everything else is derived access geometry and is rebuilt from current
    // entrances/fields against the current primary network on every reload.
    if(s.type==='road'&&!s.routeId){removed++;return false}
    return true;
  });
  State.village.accessRoadVersion=2;
  refreshStaleHouseRoadRefs();
  invalidateNavigation();
  return removed;
}
function ensureSettlementRoadAccess(s,instant=false){
  if(!s||underConstruction(s))return 0;
  if(State.structures.some(r=>r.type==='road'&&r.accessFor===s.id))return 0;
  const nearest=nearestPrimaryRoadProjection(structureCenter(s));if(!nearest)return 0;
  const start=settlementRoadAccessPoint(s,nearest.point),goal=nearest.point;
  if(!start||dist(start,goal)<.58)return 0;
  const width=s.type==='market'?.34:s.type==='field'?.26:.30;
  const ignore=[s.id];
  let path;
  if(roadRepairSegmentClear(start,goal,width,ignore))path=[start,goal];
  else path=findRoadRepairPath(start,goal,width,10,ignore,45000);
  if(!path||path.length<2)return 0;
  return addReactiveRoadPolyline(path,{width,parentRoadId:nearest.road.id},{
    accessFor:s.id,roadClass:'access-primary',ignoreIds:ignore,instant
  });
}
function reconcileSettlementAccessRoads(limit=Infinity,instant=false){
  let changed=0,done=0;
  for(const s of settlementAccessTargets()){
    if(done>=limit)break;
    if(State.structures.some(r=>r.type==='road'&&r.accessFor===s.id))continue;
    const n=ensureSettlementRoadAccess(s,instant);
    if(n){changed+=n;done++}
  }
  if(changed)invalidateNavigation(false);
  return changed;
}
function marketRoadAccessPoint(s,target){
  const q=toLocalPoint(s,target),m=Math.max(Math.abs(q.x),Math.abs(q.y),.001),scale=2.04/m;
  return houseLocalToWorld(s,q.x*scale,q.y*scale);
}
function civicRoadAccessPoint(s,roadPoint){
  if(s.type==='market')return marketRoadAccessPoint(s,roadPoint);
  return civicEntranceInfo(s)?.outside||structureCenter(s);
}
function ensureCivicRoadAccess(s){
  return isCivic(s)?ensureSettlementRoadAccess(s):0;
}
function roadEndpointDegree(p){
  let degree=0;
  for(const r of roadList(true)){
    if(dist(p,r.a)<.28||dist(p,r.b)<.28)degree++;
    else if(pointSegmentDistance(p,r.a,r.b)<.18)degree++;
  }
  return degree;
}
function repairExistingCivicRoadGap(s){
  if(!isCivic(s)||State.structures.some(r=>r.type==='road'&&r.repairFor===s.id))return 0;
  const center=structureCenter(s),radius=civicRadius(s)+5.5,endpoints=[];
  for(const r of roadList(true)){
    for(const p of [r.a,r.b]){
      if(dist(p,center)>radius||roadEndpointDegree(p)!==1)continue;
      if(Math.min(Math.abs(p.x-BUILD_MIN),Math.abs(p.x-BUILD_MAX),Math.abs(p.y-BUILD_MIN),Math.abs(p.y-BUILD_MAX))<.7)continue;
      endpoints.push({p:{...p},road:r});
    }
  }
  let best=null,bestScore=Infinity;
  for(let i=0;i<endpoints.length;i++)for(let j=i+1;j<endpoints.length;j++){
    const a=endpoints[i],b=endpoints[j],d=dist(a.p,b.p);if(d<1.2||d>13)continue;
    const probe={type:'road',a:a.p,b:b.p,width:Math.max(a.road.width||.3,b.road.width||.3)};
    if(s.type!=='market'&&!manualRoadConflict(probe,s))continue;
    const score=d+dist({x:(a.p.x+b.p.x)/2,y:(a.p.y+b.p.y)/2},center)*.4;
    if(score<bestScore){best={a,b,probe};bestScore=score}
  }
  if(!best)return 0;
  const path=findRoadRepairPath(best.a.p,best.b.p,best.probe.width,10,[]);
  if(!path)return 0;
  return addReactiveRoadPolyline(path,best.a.road,{repairFor:s.id,roadClass:'repair'});
}
function reconcileReactiveRoadNetwork(){
  let changed=0;
  changed+=reconcileArterialRoutes();
  changed+=reconcileGateMainConnections(false);
  changed+=reconcileSettlementAccessRoads();
  if(changed)invalidateNavigation(false);
  return changed;
}
function nearestRoadInfo(p,roads){let best={d:Infinity,angle:0};for(const r of roads){const d=pointSegmentDistance(p,r.a,r.b);if(d<best.d)best={d,angle:Math.atan2(r.b.y-r.a.y,r.b.x-r.a.x)}}return best}
function autoBlocked(candidate,placed,manual,margin=.2){
  const p={x:candidate.x,y:candidate.y},r=pointRadius(candidate)+margin;
  if(environmentBlocksPoint(p,'settlement'))return true;
  for(const s of manual){if(['wall','built'].includes(s.type)){if(pointSegmentDistance(p,s.a,s.b)<=r+s.width/2)return true}else if(s.x!=null&&dist(p,s)<=r+pointRadius(s))return true}
  for(const s of placed){if(s.type==='road')continue;if(dist(p,s)<=r+pointRadius(s)+margin)return true}
  return false;
}
function biomeHash(name){let h=2166136261>>>0;for(const ch of name){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
function makeEnvBlob(rnd,type,x,y,rx,ry,fill,edge,count=22,jitter=.16){
  const points=[];for(let i=0;i<count;i++){const a=Math.PI*2*i/count,j=1+(rnd()-.5)*2*jitter;points.push({x:x+Math.cos(a)*rx*j,y:y+Math.sin(a)*ry*j})}
  return{id:'env-'+type+'-'+Math.round(x*10)+'-'+Math.round(y*10),type,points,fill,edge,x,y,rx,ry};
}
function makeEnvEllipse(type,x,y,rx,ry,angle,fill,edge){return{id:'env-'+type+'-'+Math.round(x*10)+'-'+Math.round(y*10),type,x,y,rx,ry,angle,fill,edge}}
function makeEnvWater(rnd,type){
  const horizontal=rnd()>.30,pts=[],n=7;
  if(horizontal){
    const y0=70+rnd()*60;
    for(let i=0;i<n;i++){const t=i/(n-1);pts.push({x:t*WORLD,y:clamp(y0+(rnd()-.5)*(type==='river'?16:22),8,WORLD-8)})}
  }else{
    const x0=70+rnd()*60;
    for(let i=0;i<n;i++){const t=i/(n-1);pts.push({x:clamp(x0+(rnd()-.5)*(type==='river'?16:22),8,WORLD-8),y:t*WORLD})}
  }
  return{id:'env-'+type,type,points,width:type==='river'?3.2:1.25,fill:type==='river'?'#3a7684':'#4f8d95',edge:type==='river'?'#88b4b8':'#9cc6c6'};
}
function makeEnvSea(rnd){
  const sides=['north','east','south','west'],side=sides[Math.floor(rnd()*sides.length)],coast=[],n=14,depth=58+rnd()*28;
  for(let i=0;i<=n;i++){
    const t=i/n,wave=Math.sin(t*Math.PI*2+rnd()*1.2)*5+(rnd()-.5)*5;
    if(side==='north')coast.push({x:t*WORLD,y:depth+wave});
    if(side==='south')coast.push({x:t*WORLD,y:WORLD-depth-wave});
    if(side==='west')coast.push({x:depth+wave,y:t*WORLD});
    if(side==='east')coast.push({x:WORLD-depth-wave,y:t*WORLD});
  }
  let points;
  if(side==='north')points=[{x:0,y:0},{x:WORLD,y:0},...coast.slice().reverse()];
  else if(side==='south')points=[...coast,{x:WORLD,y:WORLD},{x:0,y:WORLD}];
  else if(side==='west')points=[{x:0,y:0},...coast,{x:0,y:WORLD}];
  else points=[{x:WORLD,y:0},{x:WORLD,y:WORLD},...coast.slice().reverse()];
  return{id:'env-sea',type:'sea',side,points,coastline:coast,fill:'#23505a',edge:'#86b3b5'};
}
function randomEnvPoint(rnd,margin=12){return{x:margin+rnd()*(WORLD-margin*2),y:margin+rnd()*(WORLD-margin*2)}}
function polygonGap(a,b){
  if(!a?.length||!b?.length)return Infinity;
  if(a.some(p=>pointInPolygon(p,b))||b.some(p=>pointInPolygon(p,a)))return 0;
  let best=Infinity;
  for(const p of a)for(let i=0;i<b.length;i++)best=Math.min(best,pointSegmentDistance(p,b[i],b[(i+1)%b.length]));
  for(const p of b)for(let i=0;i<a.length;i++)best=Math.min(best,pointSegmentDistance(p,a[i],a[(i+1)%a.length]));
  return best;
}
function forestBlobCanPlace(candidate,env,minGap=3){
  if(environmentConflictsTestRelief(candidate))return false;
  return env.filter(f=>f.type==='forest').every(f=>polygonGap(candidate.points,f.points)>=minGap);
}
function makeForestCandidate(rnd,small=false){
  // Forest centres may sit directly on the world boundary; their masks can
  // therefore enter the map from outside instead of always forming islands.
  const p=randomEnvPoint(rnd,0);
  const rx=small?4+rnd()*3:8+rnd()*7;
  const ry=small?3+rnd()*2:6+rnd()*6;
  return makeEnvBlob(rnd,'forest',p.x,p.y,rx,ry,'#2e3c1d','#5c7438',small?28:32,small?.10:.14);
}
function addForestBlob(env,rnd,small=false,minGap=3,maxAttempts=120){
  for(let attempt=0;attempt<maxAttempts;attempt++){
    const candidate=makeForestCandidate(rnd,small);
    if(!forestBlobCanPlace(candidate,env,minGap))continue;
    env.push(candidate);
    return candidate;
  }
  return null;
}
function estimateForestCoverage(env,samples=72){
  let covered=0,total=0;
  const forests=env.filter(f=>f.type==='forest');
  if(!forests.length)return 0;
  for(let iy=0;iy<samples;iy++){
    const y=(iy+.5)/samples*WORLD;
    for(let ix=0;ix<samples;ix++){
      const x=(ix+.5)/samples*WORLD;
      total++;
      if(forests.some(f=>pointInPolygon({x,y},f.points)))covered++;
    }
  }
  return total?covered/total:0;
}
function ensureForestCoverage(env,rnd,target=.20){
  let coverage=estimateForestCoverage(env),guard=0,failures=0;
  while(coverage<target&&guard++<320&&failures<24){
    if(addForestBlob(env,rnd,false,3,80)){
      coverage=estimateForestCoverage(env);
      failures=0;
    }else failures++;
  }
  return coverage;
}
function generateEnvironment(){
  const rnd=seedRand((State.seed^biomeHash(State.biome))>>>0),env=[];
  const addBlob=(type,count,small=false)=>{for(let i=0;i<count;i++){if(type==='forest'){addForestBlob(env,rnd,small,3);continue}const p=randomEnvPoint(rnd,18),rx=small?4+rnd()*3:7+rnd()*4,ry=small?3+rnd()*2:4+rnd()*3;if(type==='mountain')env.push(makeEnvBlob(rnd,'mountain',p.x,p.y,rx,ry,'#56493c','#968470',24,.11));else if(type==='pond')env.push(makeEnvBlob(rnd,'pond',p.x,p.y,rx,ry,'#3f7f8a','#8ab9bd',20,.20))}};
  const addEllipse=(type,count)=>{for(let i=0;i<count;i++){const p=randomEnvPoint(rnd,18);if(type==='hill')env.push(makeEnvEllipse('hill',p.x,p.y,7+rnd()*4,4+rnd()*2,(rnd()-.5)*1.4,'#5c5235','#927b4f'));else env.push(makeEnvEllipse('rough',p.x,p.y,4.5+rnd()*2.5,3+rnd()*1.5,(rnd()-.5)*1.4,'rgba(105,92,54,.45)','rgba(155,132,79,.55)'))}};
  if(State.biome==='sea')env.push(makeEnvSea(rnd));
  if(State.biome==='valley'||State.biome==='mountains'){
    const count=State.biome==='mountains'?5+Math.floor(rnd()*3):3+Math.floor(rnd()*3);
    const side=rnd()<.5?'west':'east';
    for(let i=0;i<count;i++){
      const t=(i+1)/(count+1),x=side==='west'?52+rnd()*15:148-rnd()*15,y=50+t*100+(rnd()-.5)*10;
      env.push(makeEnvBlob(rnd,'mountain',x,y,8+rnd()*4,5+rnd()*3,'#56493c','#968470',24,.11));
    }
  }
  if(State.biome==='plains'){
    addEllipse('rough',1+Math.floor(rnd()*2));if(rnd()<.45)env.push(makeEnvWater(rnd,'stream'));if(rnd()<.55)addBlob('forest',1,true);
  }else if(State.biome==='hills'){
    addEllipse('hill',3+Math.floor(rnd()*2));addEllipse('rough',1+Math.floor(rnd()*2));if(rnd()<.55)addBlob('forest',1,true);
  }else if(State.biome==='valley'){
    env.push(makeEnvWater(rnd,'stream'));addEllipse('rough',1);
  }else if(State.biome==='river'){
    env.push(makeEnvWater(rnd,'river'));addBlob('forest',1+Math.floor(rnd()*2),true);if(rnd()<.55)addEllipse('hill',1);
  }else if(State.biome==='forest'){
    addBlob('forest',4+Math.floor(rnd()*3),true);env.push(makeEnvWater(rnd,'stream'));if(rnd()<.65)addBlob('pond',1,true);
  }else if(State.biome==='mountains'){
    env.push(makeEnvWater(rnd,'stream'));addEllipse('hill',1+Math.floor(rnd()*2));
  }else if(State.biome==='sea'){
    addEllipse('rough',1);if(rnd()<.55)addBlob('forest',1,true);
  }
  for(let i=env.length-1;i>=0;i--)if(environmentConflictsTestRelief(env[i]))env.splice(i,1);
  ensureForestCoverage(env,rnd,.20);
  State.environment=env;
}
function pointInPolygon(point,pts){
  let inside=false;for(let i=0,j=pts.length-1;i<pts.length;j=i++){const a=pts[i],b=pts[j],hit=((a.y>point.y)!==(b.y>point.y))&&(point.x<(b.x-a.x)*(point.y-a.y)/((b.y-a.y)||1e-9)+a.x);if(hit)inside=!inside}return inside;
}
function environmentContains(f,p,pad=0){
  if(['forest','mountain','pond','sea'].includes(f.type))return pointInPolygon(p,f.points);
  if(['hill','rough'].includes(f.type)){const ca=Math.cos(-(f.angle||0)),sa=Math.sin(-(f.angle||0)),dx=p.x-f.x,dy=p.y-f.y,x=dx*ca-dy*sa,y=dx*sa+dy*ca;return x*x/((f.rx+pad)*(f.rx+pad))+y*y/((f.ry+pad)*(f.ry+pad))<=1}
  if(['stream','river'].includes(f.type)){for(let i=0;i<f.points.length-1;i++)if(pointSegmentDistance(p,f.points[i],f.points[i+1])<=f.width/2+pad)return true}
  return false;
}
function environmentBlocksPoint(p,mode='settlement'){
  const slope=terrainSlopeKind(p);
  if(mode==='road'&&slope==='steep')return true;
  if(mode==='settlement'&&slope)return true;
  for(const f of State.environment){
    if(mode==='road'&&['sea','mountain','pond'].includes(f.type)&&environmentContains(f,p,.25))return true;
    if(mode==='settlement'&&['sea','mountain','pond','forest','river','stream'].includes(f.type)&&environmentContains(f,p,.20))return true;
  }
  return false;
}
function roadEnvironmentConflict(road){
  const len=dist(road.a,road.b),steps=Math.max(6,Math.ceil(len/.35));
  for(let i=1;i<steps;i++){const t=i/steps,p={x:road.a.x+(road.b.x-road.a.x)*t,y:road.a.y+(road.b.y-road.a.y)*t};if(environmentBlocksPoint(p,'road'))return true}
  return false;
}
function edgeSample(edge,t){
  const v=BUILD_MIN+t*(BUILD_MAX-BUILD_MIN);
  if(edge==='north')return{x:v,y:BUILD_MIN};if(edge==='south')return{x:v,y:BUILD_MAX};if(edge==='west')return{x:BUILD_MIN,y:v};return{x:BUILD_MAX,y:v};
}
function villageSeed(well){return (State.seed ^ Math.imul(Math.round(well.x*10),73856093) ^ Math.imul(Math.round(well.y*10),19349663))>>>0}
function rotPoint(cx,cy,x,y,a){const ca=Math.cos(a),sa=Math.sin(a);return{x:cx+x*ca-y*sa,y:cy+x*sa+y*ca}}
function roadList(completedOnly=false){return State.structures.filter(s=>s.auto&&s.type==='road'&&(!completedOnly||!underConstruction(s)))}
function primaryRoadList(completedOnly=false){return roadList(completedOnly).filter(r=>!!r.routeId)}
function autoList(type){return State.structures.filter(s=>s.auto&&(!type||s.type===type))}
function currentGrowthRadius(){
  const step=State.village.growthStep||0;
  return Math.min(18,5.2+step*.30);
}
function growthRng(step,salt=0){
  const well=State.structures.find(s=>s.id===State.village.wellId)||{x:100,y:100};
  return seedRand((villageSeed(well)^Math.imul(step+1,2654435761)^salt)>>>0);
}
function practicalEdges(){
  const sides=['north','east','south','west'];
  return sides.filter(side=>{
    let free=0,total=11;for(let i=0;i<total;i++){const p=edgeSample(side,(i+.5)/total);if(!environmentBlocksPoint(p,'road'))free++}
    return free>=Math.ceil(total*.55);
  });
}
function portalOnEdge(edge,rnd){
  const inset=10+rnd()*80;
  if(edge==='north')return{x:BUILD_MIN+inset,y:BUILD_MIN,edge};
  if(edge==='south')return{x:BUILD_MIN+inset,y:BUILD_MAX,edge};
  if(edge==='west')return{x:BUILD_MIN,y:BUILD_MIN+inset,edge};
  return{x:BUILD_MAX,y:BUILD_MIN+inset,edge};
}
function oppositeEdge(edge){return({north:'south',south:'north',east:'west',west:'east'})[edge]}
function ensureRoadPlan(){
  if(Array.isArray(State.village.roadPlan)&&State.village.roadPlan.length)return State.village.roadPlan;
  const well=State.structures.find(s=>s.id===State.village.wellId);if(!well)return[];
  const rnd=seedRand((villageSeed(well)^0x51f15e)>>>0),edges=practicalEdges();
  if(edges.length<2)return[];
  const first=edges[Math.floor(rnd()*edges.length)];
  const preferred=oppositeEdge(first),second=edges.includes(preferred)?preferred:edges.find(e=>e!==first);
  const chosen=[first,second];
  State.village.roadPlan=chosen.map((edge,i)=>({id:'arterial-'+i,edge,target:portalOnEdge(edge,rnd),connected:false}));
  State.village.baseRoadAngle=Math.atan2(State.village.roadPlan[0].target.y-well.y,State.village.roadPlan[0].target.x-well.x);
  return State.village.roadPlan;
}
function routeRoads(routeId){return roadList().filter(r=>r.routeId===routeId).sort((a,b)=>(a.routeSeq||0)-(b.routeSeq||0))}
function roadAngle(r){return Math.atan2(r.b.y-r.a.y,r.b.x-r.a.x)}
function angleDiff(a,b){let d=Math.abs(a-b)%(Math.PI*2);return d>Math.PI?Math.PI*2-d:d}
function sharesPoint(a,b,eps=.22){return dist(a.a,b.a)<eps||dist(a.a,b.b)<eps||dist(a.b,b.a)<eps||dist(a.b,b.b)<eps}
function segmentIntersectionPoint(a,b,c,d){
  const r={x:b.x-a.x,y:b.y-a.y},s={x:d.x-c.x,y:d.y-c.y},den=r.x*s.y-r.y*s.x;
  if(Math.abs(den)<1e-8)return null;
  const q={x:c.x-a.x,y:c.y-a.y},t=(q.x*s.y-q.y*s.x)/den,u=(q.x*r.y-q.y*r.x)/den;
  if(t>1e-5&&t<.99999&&u>1e-5&&u<.99999)return{x:a.x+t*r.x,y:a.y+t*r.y};
  return null;
}
function segmentDistance(a,b,c,d){
  if(segmentIntersectionPoint(a,b,c,d))return 0;
  return Math.min(pointSegmentDistance(a,c,d),pointSegmentDistance(b,c,d),pointSegmentDistance(c,a,b),pointSegmentDistance(d,a,b));
}
function nearestRoadNode(p,excludeIds=[]){
  let best=null,bestD=Infinity;
  for(const r of roadList()){
    if(excludeIds.includes(r.id))continue;
    for(const q of [r.a,r.b]){const d=dist(p,q);if(d<bestD){bestD=d;best=q}}
  }
  return bestD<=ROAD_RULES.snapNodeDistance?{point:{...best},distance:bestD}:null;
}
function constrainRoadCandidate(candidate){
  if(dist(candidate.a,candidate.b)<1.7)return null;
  if(roadEnvironmentConflict(candidate))return null;
  const manual=State.structures.filter(s=>!s.auto&&s.id!==State.village.wellId);
  if(manual.some(s=>autoOverlapsManual(candidate,s)))return null;

  // Snap candidate end to a nearby network vertex.
  const node=nearestRoadNode(candidate.b,[candidate.parentRoadId].filter(Boolean));
  if(node&&dist(candidate.a,node.point)>=1.7)candidate.b=node.point;

  for(const r of roadList()){
    const startShared=dist(candidate.a,r.a)<.24||dist(candidate.a,r.b)<.24;
    const endShared=dist(candidate.b,r.a)<.24||dist(candidate.b,r.b)<.24;
    const sameRoute=candidate.routeId&&candidate.routeId===r.routeId;
    const ca=roadAngle(candidate),ra=roadAngle(r);

    // Crossings become T-junctions by shortening the candidate to the crossing.
    const ip=segmentIntersectionPoint(candidate.a,candidate.b,r.a,r.b);
    if(ip&&!startShared&&!endShared){
      if(dist(candidate.a,ip)<1.7)return null;
      candidate.b=ip;
      return candidate;
    }

    if(startShared&&!sameRoute){
      // Junction angle is measured between the two rays leaving the shared node.
      // Near-180° is a valid through-road; only near-collinear same-direction branches are rejected.
      const existingOut=dist(candidate.a,r.a)<.24?ra:ra+Math.PI;
      const d=angleDiff(ca,existingOut);
      if(d<ROAD_RULES.minJunctionAngle)return null;
    }

    if(!startShared&&!endShared){
      const dAngle=Math.min(angleDiff(ca,ra),angleDiff(ca,ra+Math.PI));
      if(dAngle<ROAD_RULES.minJunctionAngle&&segmentDistance(candidate.a,candidate.b,r.a,r.b)<ROAD_RULES.minParallelSpacing)return null;
    }
  }
  return dist(candidate.a,candidate.b)>=1.7?candidate:null;
}
function spawnArterial(step){
  const well=State.structures.find(s=>s.id===State.village.wellId),plan=ensureRoadPlan();if(!well||!plan.length)return false;
  for(const route of plan){
    if(routeRoads(route.id).length&&!arterialRouteContinuous(route.id))rebuildArterialRoute(route.id,[]);
  }
  const open=plan.filter(p=>!p.connected);if(!open.length)return false;
  // Alternate progress across the two border routes by choosing the one with fewer accepted segments.
  open.sort((p,q)=>routeRoads(p.id).length-routeRoads(q.id).length);
  const route=open[0],existing=routeRoads(route.id),a=existing.length?{...existing[existing.length-1].b}:{x:well.x,y:well.y};
  const target=route.target,remaining=dist(a,target);if(remaining<.35){route.connected=true;return false}
  const rnd=growthRng(step,401+existing.length),len=Math.min(remaining,ROAD_RULES.arterialSegmentMin+rnd()*(ROAD_RULES.arterialSegmentMax-ROAD_RULES.arterialSegmentMin));
  const desired=Math.atan2(target.y-a.y,target.x-a.x);
  // Global goal = radial/portal direction, with only gentle noise; this keeps the route organic without becoming a grid.
  const curvature=(rnd()-.5)*.26*(remaining>8?1:.45),heading=desired+curvature;
  let b=remaining<=ROAD_RULES.arterialSegmentMax?{x:target.x,y:target.y}:{x:a.x+Math.cos(heading)*len,y:a.y+Math.sin(heading)*len};
  const road=constrainRoadCandidate(beginConstruction({id:uid(),type:'road',auto:true,roadClass:'arterial',routeId:route.id,routeSeq:existing.length,a,b,width:.62,appeal:1,parentRoadId:existing.at(-1)?.id||null}));
  if(!road)return false;
  State.structures.push(road);
  if(dist(road.b,target)<.35)route.connected=true;
  return true;
}
function candidateBranchOrigins(rnd){
  const well=State.structures.find(s=>s.id===State.village.wellId);if(!well)return[];
  const roads=roadList(true).filter(r=>dist({x:(r.a.x+r.b.x)/2,y:(r.a.y+r.b.y)/2},well)<=currentGrowthRadius()+1.5);
  const out=[];
  for(const r of roads){
    const t=.24+rnd()*.52,p={x:r.a.x+(r.b.x-r.a.x)*t,y:r.a.y+(r.b.y-r.a.y)*t};
    let nearest=Infinity;
    for(const other of roadList())for(const q of [other.a,other.b])nearest=Math.min(nearest,dist(p,q));
    if(nearest>=ROAD_RULES.branchSpawnSpacing)out.push({road:r,p});
  }
  return out;
}
function spawnLocalRoad(step){
  return reconcileSettlementAccessRoads(1)>0;
}
function spawnRoad(step){
  const plan=ensureRoadPlan(),incomplete=plan.some(p=>!p.connected);
  if(incomplete)return spawnArterial(step);
  return spawnLocalRoad(step);
}
function spawnHouse(step){
  const well=State.structures.find(s=>s.id===State.village.wellId),roads=primaryRoadList(true);if(!well||!roads.length)return false;
  const rnd=growthRng(step,211),radius=currentGrowthRadius(),manual=State.structures.filter(s=>!s.auto),placed=autoList().filter(s=>s.type!=='road');
  const candidates=[];
  for(let i=0;i<90;i++){
    const road=roads[Math.floor(rnd()*roads.length)],t=.12+rnd()*.76;
    const q={x:road.a.x+(road.b.x-road.a.x)*t,y:road.a.y+(road.b.y-road.a.y)*t};
    const ang=roadAngle(road),side=rnd()<.5?-1:1,offset=1.15+rnd()*1.35;
    const p={x:q.x-Math.sin(ang)*offset*side,y:q.y+Math.cos(ang)*offset*side};
    const d=dist(p,well);if(d>radius||d<1.7||!inBuild(p))continue;
    const core=Math.exp(-Math.pow(d-Math.min(6.5,radius*.62),2)/(2*3.0*3.0));
    const score=core*1.2+(1-offset/3)*.65+rnd()*.20;
    candidates.push({p,ang,score,roadId:road.id,doorSide:-side});
  }
  candidates.sort((a,b)=>b.score-a.score);
  for(const c of candidates.slice(0,24)){
    const h=beginConstruction({id:uid(),type:'house',auto:true,x:snapGrid(c.p.x),y:snapGrid(c.p.y),w:rnd()>.78?2:1.5,h:1,angle:c.ang,appeal:c.score,roadId:c.roadId,doorSide:c.doorSide});
    if(!autoBlocked(h,placed,manual,.38)){State.structures.push(h);ensureSettlementRoadAccess(h);return true}
  }
  return false;
}
function spawnField(step){
  const well=State.structures.find(s=>s.id===State.village.wellId),roads=primaryRoadList(true);if(!well||!roads.length)return false;
  const rnd=growthRng(step,307),radius=currentGrowthRadius()+4,manual=State.structures.filter(s=>!s.auto),placed=autoList().filter(s=>s.type!=='road');
  const houses=autoList('house');if(houses.length<5)return false;
  const inner=Math.max(6.5,currentGrowthRadius()*.72),outer=Math.min(22,radius+4),candidates=[];
  for(let i=0;i<110;i++){
    const d=inner+rnd()*(outer-inner),th=rnd()*Math.PI*2,p={x:well.x+Math.cos(th)*d,y:well.y+Math.sin(th)*d};
    if(!inBuild(p))continue;
    const road=nearestRoadInfo(p,roads),ring=Math.exp(-Math.pow(d-(inner+outer)*.5,2)/(2*4.2*4.2));
    const score=ring+.18*Math.exp(-road.d/4)+rnd()*.20;candidates.push({p,road,score});
  }
  candidates.sort((a,b)=>b.score-a.score);
  for(const c of candidates.slice(0,28)){
    const f=beginConstruction({id:uid(),type:'field',auto:true,x:snapGrid(c.p.x),y:snapGrid(c.p.y),w:2.6+rnd()*1.3,h:1.8+rnd()*1.1,angle:c.road.angle+(rnd()-.5)*.18,appeal:c.score});
    if(!autoBlocked(f,placed,manual,.65)){State.structures.push(f);ensureSettlementRoadAccess(f);return true}
  }
  return false;
}
function processVillageGrowth(){
  if(!State.village.founded)return 0;
  const well=State.structures.find(s=>s.id===State.village.wellId);if(!well||underConstruction(well))return 0;
  ensureRoadPlan();
  if(State.village.nextGrowthDay==null)State.village.nextGrowthDay=State.clock.day+.75;
  let guard=0,changed=0;
  while(State.clock.day>=State.village.nextGrowthDay&&guard++<8){
    const step=State.village.growthStep||0,houses=autoList('house').length,roads=roadList().length,fields=autoList('field').length;
    let kind;
    if(roads===0)kind='road';
    else if(houses<2)kind='house';
    else{
      const rnd=growthRng(step,509)();
      if(houses>=5&&fields<Math.ceil(houses*.50)&&rnd<.17)kind='field';
      else if(rnd<.38)kind='road';
      else kind='house';
    }
    let ok=kind==='road'?spawnRoad(step):kind==='field'?spawnField(step):spawnHouse(step);
    if(!ok&&kind!=='house')ok=spawnHouse(step);
    if(!ok&&kind!=='road')ok=spawnRoad(step);
    State.village.growthStep=step+1;
    State.village.nextGrowthDay+=GROWTH_INTERVAL_DAYS;
    if(ok){
      changed++;
      // New growth starts under construction and is rendered dynamically.
      // Do not rebuild static scene / route caches or synchronously persist here.
      markDirty(false,false,false);
    }
  }
  return changed;
}
function resetLegacyVillageGrowth(){
  if(!State.village.founded||State.village.growthVersion===3)return;
  State.structures=State.structures.filter(s=>!s.auto);
  State.village.growthVersion=3;State.village.accessRoadVersion=0;State.village.growthStep=0;State.village.nextGrowthDay=State.clock.day+.75;State.village.roadPlan=null;State.village.baseRoadAngle=null;
}
function openVillageModal(well){
  State.pendingWellId=well.id;const modal=document.getElementById('foundVillageModal'),input=document.getElementById('villageNameInput');
  modal.classList.add('open');input.value=State.village.name||'';setTimeout(()=>input.focus(),0);
}
function closeVillageModal(){document.getElementById('foundVillageModal').classList.remove('open');State.pendingWellId=null}
