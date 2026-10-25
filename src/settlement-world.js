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
  const info=gatePassageInfo(gate),dx=road.b.x-road.a.x,dy=road.b.y-road.a.y,L=Math.hypot(dx,dy)||1;
  const dot=Math.abs((dx/L)*info.ux+(dy/L)*info.uy);
  if(dot<Math.cos(32*Math.PI/180))return false;
  // Wherever the road strip meets the gatehouse its centreline must run inside the passage,
  // entering and leaving by the mouths: a segment ending inside or bending there is fine.
  const a=toLocalPoint(gate,road.a),b=toLocalPoint(gate,road.b),reach=rectDims(gate).h/2+(Number(road.width)||.3)/2;
  const steps=Math.max(4,Math.ceil(L/.05));let inside=false;
  for(let i=0;i<=steps;i++){
    const t=i/steps,x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t;
    if(Math.abs(x)>info.halfLength+.02||Math.abs(y)>reach)continue;
    if(Math.abs(y)>info.halfWidth*.82)return false;
    inside=true;
  }
  return inside;
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
  if(['wall','palisade','built'].includes(manual.type)){
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
  const linear=['wall','palisade','built'].includes(manual.type);
  if(auto.type==='road')return manualRoadConflict(auto,manual);
  const p={x:auto.x,y:auto.y},r=pointRadius(auto);
  if(linear)return pointSegmentDistance(p,manual.a,manual.b)<=r+manual.width/2+.15;
  return dist(p,{x:manual.x,y:manual.y})<=r+pointRadius(manual)+.15;
}
function removeOverlappingAuto(manual){
  let removed=0;const roads=[];
  const clearedHouses=new Set(urbanLotsOverlappingBuilding(manual).map(lot=>lot.houseId));
  for(const house of autoList('house'))if(autoOverlapsManual(house,manual))clearedHouses.add(house.id);
  State.structures=State.structures.filter(s=>{
    // House-owned access spurs disappear with the parcel and must not be repaired.
    if(s.type==='road'&&clearedHouses.has(s.accessFor)){removed++;return false}
    const hit=s.auto&&(clearedHouses.has(s.id)||autoOverlapsManual(s,manual));
    if(hit){removed++;if(s.type==='road')roads.push({...s,a:{...s.a},b:{...s.b}})}
    return !hit;
  });
  if(clearedHouses.size)invalidateUrbanGeometry();
  return{removed,roads};
}
const ROAD_REPAIR_INDEX_CELL=4;
const ROAD_REPAIR_INDEX_PAD=1;
function roadRepairEntryBounds(entry){
  if(entry.kind==='linear'){
    const pad=(Number(entry.s.width)||0)/2+ROAD_REPAIR_INDEX_PAD;
    return{
      minX:Math.min(entry.s.a.x,entry.s.b.x)-pad,maxX:Math.max(entry.s.a.x,entry.s.b.x)+pad,
      minY:Math.min(entry.s.a.y,entry.s.b.y)-pad,maxY:Math.max(entry.s.a.y,entry.s.b.y)+pad
    };
  }
  if(entry.kind==='circle'){
    const r=entry.r+ROAD_REPAIR_INDEX_PAD;
    return{minX:entry.s.x-r,maxX:entry.s.x+r,minY:entry.s.y-r,maxY:entry.s.y+r};
  }
  const pts=entry.rings.flat();
  if(!pts.length)return{minX:0,maxX:0,minY:0,maxY:0};
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const p of pts){minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);maxX=Math.max(maxX,p.x);maxY=Math.max(maxY,p.y)}
  return{
    minX:minX-ROAD_REPAIR_INDEX_PAD,maxX:maxX+ROAD_REPAIR_INDEX_PAD,
    minY:minY-ROAD_REPAIR_INDEX_PAD,maxY:maxY+ROAD_REPAIR_INDEX_PAD
  };
}
function roadRepairBlockerEntry(s){
  if(!s||s.type==='road'||s.type==='market'||s.primaryBridgeFor)return null;
  if(['wall','palisade','built'].includes(s.type))return{kind:'linear',s};
  if(s.type==='well')return{kind:'circle',s,r:.62};
  if(s.type==='tower'&&s.shape==='round')return{kind:'circle',s,r:Number(s.r)||.5};

  let rings=[];
  if(s.type==='house')rings=houseFootprintParts(s).map(q=>q.points);
  else if(isCivic(s))rings=civicParts(s).map(q=>q.points);
  else if(s.type==='field')rings=[fieldPoints(s)];
  else if(s.x!=null)rings=[footprintPoints(s)];
  if(!rings.some(poly=>poly?.length))return null;
  return{kind:s.type==='gate'?'gate':'rings',s,rings};
}
function buildRoadRepairSpatialIndex(ignoreIds=[]){
  const ignored=new Set(ignoreIds||[]),cells=new Map(),entries=[];
  const key=(x,y)=>x+','+y;
  for(const s of State.structures){
    if(ignored.has(s.id))continue;
    const entry=roadRepairBlockerEntry(s);if(!entry)continue;
    entries.push(entry);
    const b=roadRepairEntryBounds(entry);
    const x0=Math.floor(b.minX/ROAD_REPAIR_INDEX_CELL),x1=Math.floor(b.maxX/ROAD_REPAIR_INDEX_CELL);
    const y0=Math.floor(b.minY/ROAD_REPAIR_INDEX_CELL),y1=Math.floor(b.maxY/ROAD_REPAIR_INDEX_CELL);
    for(let cy=y0;cy<=y1;cy++)for(let cx=x0;cx<=x1;cx++){
      const k=key(cx,cy),list=cells.get(k);
      if(list)list.push(entry);else cells.set(k,[entry]);
    }
  }
  return{cells,entries,cell:ROAD_REPAIR_INDEX_CELL};
}
function roadRepairIndexedCandidates(index,p){
  if(!index)return null;
  return index.cells.get(Math.floor(p.x/index.cell)+','+Math.floor(p.y/index.cell))||[];
}
function roadRepairEntryBlocksPoint(entry,p,clearance,width){
  const s=entry.s;
  if(entry.kind==='gate'){
    if(gatePointInPassage(s,p,Math.max(.05,width*.10)))return false;
    const q=toLocalPoint(s,p),d=rectDims(s);
    return Math.abs(q.x)<=d.w/2+clearance&&Math.abs(q.y)<=d.h/2+clearance;
  }
  if(entry.kind==='linear'){
    return pointSegmentDistance(p,s.a,s.b)<=Number(s.width)/2+clearance;
  }
  if(entry.kind==='circle'){
    return dist(p,s)<=entry.r+clearance;
  }
  for(const poly of entry.rings){
    if(!poly?.length)continue;
    if(pointInPolygon(p,poly))return true;
    for(let i=0;i<poly.length;i++){
      const j=(i+1)%poly.length;
      if(pointSegmentDistance(p,poly[i],poly[j])<=clearance)return true;
    }
  }
  return false;
}
function roadRepairPointClear(p,width=.30,ignoreIds=[],spatialIndex=null,allowPrimaryNature=false){
  if(p.x<0||p.x>WORLD||p.y<0||p.y>WORLD||
    (allowPrimaryNature
      ?primaryRoadTerrainBlocked(p):environmentBlocksPoint(p,'road')))return false;
  const clearance=width/2+.16;

  if(spatialIndex){
    for(const entry of roadRepairIndexedCandidates(spatialIndex,p)){
      if(roadRepairEntryBlocksPoint(entry,p,clearance,width))return false;
    }
    return true;
  }

  const ignored=new Set(ignoreIds||[]);
  for(const s of State.structures){
    if(ignored.has(s.id))continue;
    const entry=roadRepairBlockerEntry(s);if(!entry)continue;
    if(roadRepairEntryBlocksPoint(entry,p,clearance,width))return false;
  }
  return true;
}
function finishRoadWork(work){let step;do{step=work.next()}while(!step.done);return step.value}
function roadRepairSegmentClear(a,b,width=.30,ignoreIds=[],spatialIndex=null,allowPrimaryNature=false){
  return finishRoadWork(roadRepairSegmentWork(a,b,width,ignoreIds,spatialIndex,allowPrimaryNature));
}
function* roadRepairSegmentWork(a,b,width=.30,ignoreIds=[],spatialIndex=null,allowPrimaryNature=false){
  const L=dist(a,b),steps=Math.max(2,Math.ceil(L/.09));
  for(let i=0;i<=steps;i++){
    if(i%16===0)yield;
    const t=i/steps,p={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};
    if(!roadRepairPointClear(p,width,ignoreIds,spatialIndex,allowPrimaryNature))return false;
  }
  return true;
}
function findRoadRepairPath(...args){return finishRoadWork(findRoadRepairWork(...args))}
function* findRoadRepairWork(start,goal,width=.30,pad=8,ignoreIds=[],maxGuard=24000,allowPrimaryNature=false){
  const analyticsT0=performance.now();
  const spatialIndex=buildRoadRepairSpatialIndex(ignoreIds);
  const pointMemo=new Map(),segmentMemo=new Map();
  let pointHits=0,segmentHits=0;
  const pointKey=p=>(Math.round(p.x*1000)/1000)+','+(Math.round(p.y*1000)/1000);
  const pointClear=p=>{
    const k=pointKey(p);
    if(pointMemo.has(k)){pointHits++;return pointMemo.get(k)}
    const ok=roadRepairPointClear(p,width,ignoreIds,spatialIndex,allowPrimaryNature);
    pointMemo.set(k,ok);return ok;
  };
  const segmentClear=(a,b)=>{
    const ak=pointKey(a),bk=pointKey(b),k=ak<bk?ak+'|'+bk:bk+'|'+ak;
    if(segmentMemo.has(k)){segmentHits++;return segmentMemo.get(k)}
    const L=dist(a,b),steps=Math.max(2,Math.ceil(L/.09));
    let ok=true;
    for(let i=0;i<=steps;i++){
      const t=i/steps,p={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};
      if(!pointClear(p)){ok=false;break}
    }
    segmentMemo.set(k,ok);return ok;
  };

  const step=.5;
  const minX=Math.floor((Math.min(start.x,goal.x)-pad)/step),maxX=Math.ceil((Math.max(start.x,goal.x)+pad)/step);
  const minY=Math.floor((Math.min(start.y,goal.y)-pad)/step),maxY=Math.ceil((Math.max(start.y,goal.y)+pad)/step);
  const key=(x,y)=>x+','+y,pos=(x,y)=>({x:x*step,y:y*step});
  function* nearestFree(p){
    const cx=Math.round(p.x/step),cy=Math.round(p.y/step);let best=null,bestD=Infinity;
    for(let r=0;r<=6;r++)for(let dx=-r;dx<=r;dx++)for(let dy=-r;dy<=r;dy++){
      if(dy===-r)yield;
      if(Math.max(Math.abs(dx),Math.abs(dy))!==r)continue;
      const x=cx+dx,y=cy+dy,q=pos(x,y);
      if(x<minX||x>maxX||y<minY||y>maxY||!pointClear(q))continue;
      const d=dist(p,q);if(d<bestD){best={x,y,q};bestD=d}
    }
    return best;
  }
  const s=yield* nearestFree(start),g=yield* nearestFree(goal);
  if(!s||!g){
    window.__conquerAnalytics?.measure('ROAD_REPAIR',performance.now()-analyticsT0,{
      found:false,reason:'endpoint',blockers:spatialIndex.entries.length,
      pointMemo:pointMemo.size,pointHits,segmentMemo:segmentMemo.size,segmentHits
    });
    return null;
  }

  const open=new PeasantMinHeap(),gScore=new Map([[key(s.x,s.y),0]]),came=new Map(),closed=new Set();
  open.push({x:s.x,y:s.y,f:dist(s.q,g.q)});
  const dirs=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
  let found=null,guard=0;
  while(open.length&&guard++<maxGuard){
    if(guard%4===0)yield;
    const cur=open.pop(),ck=key(cur.x,cur.y);if(closed.has(ck))continue;closed.add(ck);
    if(cur.x===g.x&&cur.y===g.y){found=cur;break}
    const cp=pos(cur.x,cur.y);
    for(const [dx,dy] of dirs){
      const nx=cur.x+dx,ny=cur.y+dy;if(nx<minX||nx>maxX||ny<minY||ny>maxY)continue;
      const nk=key(nx,ny),np=pos(nx,ny);
      if(closed.has(nk)||!pointClear(np))continue;
      if(!segmentClear(cp,np))continue;
      const tentative=(gScore.get(ck)??Infinity)+Math.hypot(dx,dy)*step;
      if(tentative>=(gScore.get(nk)??Infinity))continue;
      gScore.set(nk,tentative);came.set(nk,ck);
      open.push({x:nx,y:ny,f:tentative+dist(np,g.q)});
    }
  }

  const telemetry={
    guard,blockers:spatialIndex.entries.length,
    pointMemo:pointMemo.size,pointHits,
    segmentMemo:segmentMemo.size,segmentHits
  };
  if(!found){
    window.__conquerAnalytics?.measure('ROAD_REPAIR',performance.now()-analyticsT0,{found:false,...telemetry});
    return null;
  }
  const rev=[];let k=key(found.x,found.y);
  while(k){const [x,y]=k.split(',').map(Number);rev.push(pos(x,y));k=came.get(k)}
  rev.reverse();
  if(pointClear(start))rev[0]={...start};
  if(pointClear(goal))rev[rev.length-1]={...goal};
  window.__conquerAnalytics?.measure('ROAD_REPAIR',performance.now()-analyticsT0,{found:true,points:rev.length,...telemetry});
  return rev;
}
function simplifyRoadRepairPath(...args){return finishRoadWork(simplifyRoadRepairWork(...args))}
function* simplifyRoadRepairWork(points,width=.30,ignoreIds=[],allowPrimaryNature=false){
  if(!points||points.length<=2)return points||[];
  const out=[points[0]];let i=0;
  while(i<points.length-1){
    let chosen=i+1;
    for(let j=points.length-1;j>i+1;j--){
      if(yield* roadRepairSegmentWork(points[i],points[j],width,ignoreIds,null,allowPrimaryNature)){chosen=j;break}
    }
    out.push(points[chosen]);i=chosen;
  }
  return out;
}
function reactiveRoadExists(a,b,eps=.24){
  return roadList().some(r=>(dist(r.a,a)<eps&&dist(r.b,b)<eps)||(dist(r.a,b)<eps&&dist(r.b,a)<eps));
}
function addReactiveRoadPolyline(...args){return finishRoadWork(addReactiveRoadWork(...args))}
function* addReactiveRoadWork(points,template={},meta={},stillValid=()=>true){
  if(!points||points.length<2)return 0;
  const width=Number(template.width)||.30,clean=yield* simplifyRoadRepairWork(points,width,meta.ignoreIds||[]);
  if(!stillValid())return 0;
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
    if(meta.branchTargetId)road.branchTargetId=meta.branchTargetId;
    if(!meta.instant)beginConstruction(road);
    State.structures.push(road);added++;
  }
  return added;
}
function mainRoadRouteDeleted(routeId){return (State.village.deletedMainRoutes||[]).includes(routeId)}
function arterialRoutePlan(routeId){
  return mainRoadRouteDeleted(routeId)?null:ensureRoadPlan().find(r=>r.id===routeId)||null;
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
  return dist(cursor,plan.target)<=.65;
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

  if(plan.connected||plan.planningToBorder||!source.length){
    if(dist(pts.at(-1),plan.target)>.35)pts.push({...plan.target});
  }else if(source.length){
    // An incomplete route should only be rebuilt to its previous frontier,
    // never be magically completed to the border.
    const frontier={...source.at(-1).b};
    if(dist(pts.at(-1),frontier)>.35)pts.push(frontier);
  }
  return pts;
}
function buildArterialRepairPolyline(...args){return finishRoadWork(buildArterialRepairWork(...args))}
function* buildArterialRepairWork(routeId,displaced=[]){
  const well=State.structures.find(s=>s.id===State.village.wellId),waypoints=arterialSafeWaypoints(routeId,displaced);
  if(!well||waypoints.length<2)return null;
  const width=.62,ignore=[well.id],full=[waypoints[0]];
  for(let i=0;i<waypoints.length-1;i++){
    const a=full.at(-1),b=waypoints[i+1];let leg=null;
    if(yield* roadRepairSegmentWork(a,b,width,ignore,null,true))leg=[a,b];
    else{
      // Forest belts and hill contours can require detours beyond the local
      // 12U corridor. Widen only after a failed bounded search; each search
      // still yields cooperatively to keep village founding responsive.
      for(const [pad,maxGuard] of [[12,60000],[24,85000],[42,130000]]){
        leg=yield* findRoadRepairWork(a,b,width,pad,ignore,maxGuard,true);
        if(leg?.length>1)break;
        window.__conquerAnalytics?.event('ARTERIAL_DETOUR_RETRY',{
          routeId,pad,from:a,to:b
        },'warn',5000);
      }
    }
    // If a broad woodland makes the original gate on the border unreachable,
    // choose another *clear* entrance on the SAME map edge instead of cutting
    // down trees or leaving one of the four master roads disconnected.
    if((!leg||leg.length<2)&&i===waypoints.length-2){
      const plan=arterialRoutePlan(routeId),edge=plan?.edge,old=plan?.target;
      if(edge&&old){
        const preferred=edge==='north'||edge==='south'?old.x/WORLD:old.y/WORLD;
        const alternatives=BORDER_ENTRY_BACKUP_FRACTIONS
          .filter(t=>Math.abs(t-preferred)>.001)
          .sort((a,b)=>Math.abs(a-preferred)-Math.abs(b-preferred));
        for(const t of alternatives){
          const alt=edgeSample(edge,t);
          if(primaryRoadTerrainBlocked(alt))continue;
          const option=(yield* roadRepairSegmentWork(a,alt,width,ignore,null,true))
            ?[a,alt]
            :yield* findRoadRepairWork(a,alt,width,48,ignore,180000,true);
          if(!option||option.length<2)continue;
          plan.target={x:alt.x,y:alt.y,edge};
          const entry=State.village.borderEntries?.find(e=>e.edge===edge);
          if(entry){entry.x=alt.x;entry.y=alt.y;entry.t=t;entry.index=-1;entry.id='border-'+edge+'-alternate-'+Math.round(t*100)}
          plan.entryId=entry?.id||plan.entryId;
          window.__conquerAnalytics?.event('ARTERIAL_ENTRY_REROUTED',{
            routeId,edge,oldTarget:old,newTarget:plan.target
          },'info');
          leg=option;break;
        }
      }
    }
    if(!leg||leg.length<2)return null;
    for(let j=1;j<leg.length;j++){
      const p=leg[j];if(dist(full.at(-1),p)>.08)full.push(p);
    }
  }
  return yield* simplifyRoadRepairWork(full,width,ignore,true);
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
function rebuildArterialRoute(...args){return finishRoadWork(rebuildArterialWork(...args))}
function* rebuildArterialWork(routeId,displaced=[],stillValid=()=>true){
  const plan=arterialRoutePlan(routeId),path=yield* buildArterialRepairWork(routeId,displaced);
  if(!stillValid()||mainRoadRouteDeleted(routeId))return 0;
  if(!plan||!path||path.length<2)return 0;

  // Only replace the route after a complete valid path has been found.
  const oldRoadIds=new Set(routeRoads(routeId).map(r=>r.id));
  State.structures=State.structures.filter(r=>!(r.type==='road'&&r.routeId===routeId)&&!oldRoadIds.has(r.primaryBridgeFor));
  const pts=subdivideRoadPolyline(alignedRiverRoadPolyline(path),ROAD_RULES.arterialSegmentMax);
  let added=0,parent=null;
  for(let i=0;i<pts.length-1;i++){
    const a=pts[i],b=pts[i+1];if(dist(a,b)<.18)continue;
    const road={
      id:uid(),type:'road',auto:true,roadClass:'arterial',routeId,routeSeq:added,
      a:{...a},b:{...b},width:.62,appeal:1,parentRoadId:parent,
      reactive:true,arterialRebuilt:true
    };
    // Route repair is topology restoration, not a new growth event: it becomes usable immediately.
    State.structures.push(road);if(isPrimaryRoad(road))autoPrimaryRoadBridges(road);parent=road.id;added++;
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
function gateMainTrunkProjection(gate,point){
  const ownRoute=gateMainRouteId(gate);
  let best=null,bestD=Infinity;
  for(const r of primaryRoadList(true)){
    if(r.routeId===ownRoute||r.roadClass==='arterial-gate')continue;
    const q=closestPointOnSegment(point,r.a,r.b),d=dist(point,q);
    if(d<bestD){best={road:r,point:q,d};bestD=d}
  }
  return best;
}
function gateMainTopologyKey(gate){
  const d=rectDims(gate),parts=[
    gate.id,
    Number(gate.x).toFixed(2),Number(gate.y).toFixed(2),
    Number(gate.angle||0).toFixed(3),
    Number(d.w).toFixed(2),Number(d.h).toFixed(2)
  ];
  const trunks=primaryRoadList(true)
    .filter(r=>r.routeId!==gateMainRouteId(gate)&&r.roadClass!=='arterial-gate')
    .map(r=>[
      r.routeId||r.id,
      Number(r.a.x).toFixed(1),Number(r.a.y).toFixed(1),
      Number(r.b.x).toFixed(1),Number(r.b.y).toFixed(1)
    ].join(':'))
    .sort();
  parts.push(trunks.join('|'));
  return parts.join('#');
}
function gateMainRouteContinuous(gate){
  const roads=routeRoads(gateMainRouteId(gate));
  if(!roads.length)return false;

  const passage=gatePassageInfo(gate);if(!passage)return false;
  const endpoints=[passage.sideA,passage.sideB];
  const trunk=gateMainTrunkProjection(gate,{x:gate.x,y:gate.y});
  if(!trunk)return false;

  // Follow the stored route from the trunk-side endpoint through the gate.
  let cursor={...trunk.point};
  for(const r of roads){
    if(dist(cursor,r.a)<=.72)cursor={...r.b};
    else if(dist(cursor,r.b)<=.72)cursor={...r.a};
    else return false;
  }
  return Math.min(dist(cursor,endpoints[0]),dist(cursor,endpoints[1]))<=.90;
}
function buildGateMainConnection(...args){return finishRoadWork(buildGateMainConnectionWork(...args))}
function* buildGateMainConnectionWork(gate,force=false,stillValid=()=>true){
  if(!gate||gate.type!=='gate'||underConstruction(gate)||mainRoadRouteDeleted(gateMainRouteId(gate)))return 0;
  const routeId=gateMainRouteId(gate),attemptKey=gateMainTopologyKey(gate);

  if(!force&&gateMainRouteContinuous(gate)){
    gate.gateMainAttemptKey=attemptKey;
    gate.gateMainBlocked=false;
    return 0;
  }
  // A failed path search is deterministic for the same gate + primary-road
  // topology. Never repeat it on maintenance/completion until topology changes.
  if(!force&&gate.gateMainBlocked&&gate.gateMainAttemptKey===attemptKey)return 0;

  const trunk=gateMainTrunkProjection(gate,{x:gate.x,y:gate.y});
  if(!trunk){
    gate.gateMainAttemptKey=attemptKey;
    gate.gateMainBlocked=true;
    return 0;
  }

  // The trunk projection determines which mouth is inside. The generated route
  // runs from the primary network, through the gate, to the exterior mouth.
  const passage=gatePassageInfo(gate,trunk.point);if(!passage)return 0;
  const width=.62,ignore=[];
  let approach;
  if(yield* roadRepairSegmentWork(trunk.point,passage.near,width,ignore)){
    approach=[{...trunk.point},{...passage.near}];
  }else{
    // This is intentionally a short local repair search, not a settlement-wide
    // well→gate A*. The primary road already provides global connectivity.
    approach=yield* findRoadRepairWork(trunk.point,passage.near,width,10,ignore,18000);
  }
  if(!stillValid())return 0;
  if(!approach||approach.length<2){
    gate.gateMainAttemptKey=attemptKey;
    gate.gateMainBlocked=true;
    return 0;
  }

  const full=approach.slice();
  for(const p of [passage.center,passage.far]){
    if(dist(full.at(-1),p)>.08)full.push({...p});
  }
  if(!(yield* roadRepairSegmentWork(passage.near,passage.center,width,ignore))||
     !(yield* roadRepairSegmentWork(passage.center,passage.far,width,ignore))){
    if(!stillValid())return 0;
    gate.gateMainAttemptKey=attemptKey;
    gate.gateMainBlocked=true;
    return 0;
  }

  const clean=yield* simplifyRoadRepairWork(full,width,ignore),pts=subdivideRoadPolyline(clean,ROAD_RULES.arterialSegmentMax);
  if(!stillValid())return 0;
  if(pts.length<2){
    gate.gateMainAttemptKey=attemptKey;
    gate.gateMainBlocked=true;
    return 0;
  }

  const oldRoadIds=new Set(routeRoads(routeId).map(r=>r.id));
  State.structures=State.structures.filter(r=>!(r.type==='road'&&r.routeId===routeId)&&!oldRoadIds.has(r.primaryBridgeFor));
  let added=0,parent=trunk.road.id;
  for(let i=0;i<pts.length-1;i++){
    const a=pts[i],b=pts[i+1];if(dist(a,b)<.16)continue;
    const road={
      id:uid(),type:'road',auto:true,roadClass:'arterial-gate',
      routeId,routeSeq:added,a:{...a},b:{...b},width,appeal:1,
      parentRoadId:parent,gateFor:gate.id,reactive:true
    };
    State.structures.push(road);if(isPrimaryRoad(road))autoPrimaryRoadBridges(road);parent=road.id;added++;
  }
  if(!added){
    gate.gateMainAttemptKey=attemptKey;
    gate.gateMainBlocked=true;
    return 0;
  }

  gate.gateMainAttemptKey=attemptKey;
  gate.gateMainBlocked=false;
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
  if(field.type==='field'){
    const poly=fieldPoints(field);let best=null,bestD=Infinity;
    for(let i=0;i<poly.length;i++){
      const a=poly[i],b=poly[(i+1)%poly.length],dx=b.x-a.x,dy=b.y-a.y;
      const t=clamp(((target.x-a.x)*dx+(target.y-a.y)*dy)/(dx*dx+dy*dy),0,1);
      const edge={x:a.x+t*dx,y:a.y+t*dy},d=dist(edge,target);
      if(d<bestD){best=edge;bestD=d}
    }
    const dx=best.x-field.x,dy=best.y-field.y,L=Math.hypot(dx,dy)||1;
    return{x:best.x+dx/L*.28,y:best.y+dy/L*.28};
  }
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
function towerSecondaryBranchAccessPoint(tower,target){
  if(!tower||tower.type!=='tower'||tower.parentTowerId)return null;

  // Masonry towers use their real ground-floor front door. Timber towers do
  // not have a masonry door, so their facing direction defines the service entrance.
  if(!isWoodTower(tower)&&typeof towerDoorSpecs==='function'){
    const front=towerDoorSpecs(tower).find(spec=>spec.kind==='front');
    if(front){
      return{
        x:front.contact.x+front.outward.x*.30,
        y:front.contact.y+front.outward.y*.30
      };
    }
  }

  const a=Number(tower.angle)||0,ray={x:tower.x+Math.cos(a)*4,y:tower.y+Math.sin(a)*4};
  const edge=typeof boundaryPoint==='function'?boundaryPoint(tower,ray):{x:tower.x,y:tower.y};
  return{x:edge.x+Math.cos(a)*.30,y:edge.y+Math.sin(a)*.30};
}
function towerSecondaryBranchCandidates(tower){
  const out=[];
  for(const gate of State.structures){
    if(gate.type!=='gate'||underConstruction(gate))continue;
    const passage=gatePassageInfo(gate,tower);if(!passage)continue;
    out.push({id:gate.id,type:'gate',point:{...passage.near},distance:dist(tower,passage.near)});
  }
  const well=State.structures.find(s=>s.type==='well'&&!underConstruction(s));
  if(well)out.push({id:well.id,type:'well',point:{x:well.x,y:well.y},distance:dist(tower,well)});
  return out.sort((a,b)=>a.distance-b.distance);
}
function towerSecondaryRoads(towerId){
  return State.structures.filter(r=>r.type==='road'&&r.roadClass==='secondary-tower'&&r.accessFor===towerId);
}
function removeTowerSecondaryBranch(towerId){
  const before=State.structures.length;
  State.structures=State.structures.filter(r=>!(r.type==='road'&&r.roadClass==='secondary-tower'&&r.accessFor===towerId));
  const removed=before-State.structures.length;
  if(removed)invalidateNavigation(false);
  return removed;
}
function ensureTowerSecondaryBranch(...args){return finishRoadWork(ensureTowerSecondaryBranchWork(...args))}
function* ensureTowerSecondaryBranchWork(tower,instant=false,stillValid=()=>true){
  if(!tower||tower.type!=='tower'||tower.parentTowerId||underConstruction(tower))return 0;
  if(towerSecondaryRoads(tower.id).length)return 0;

  const width=.28,candidates=towerSecondaryBranchCandidates(tower);
  for(const target of candidates){
    const start=towerSecondaryBranchAccessPoint(tower,target.point),goal=target.point;
    if(!start||dist(start,goal)<.58)continue;
    const ignore=[tower.id];
    if(target.type==='well')ignore.push(target.id);

    let path;
    if(yield* roadRepairSegmentWork(start,goal,width,ignore))path=[start,goal];
    else path=yield* findRoadRepairWork(start,goal,width,14,ignore,60000);
    if(!stillValid())return 0;
    if(!path||path.length<2)continue;

    const added=yield* addReactiveRoadWork(path,{width},{
      accessFor:tower.id,
      branchTargetId:target.id,
      roadClass:'secondary-tower',
      ignoreIds:ignore,
      instant
    },stillValid);
    if(added)return added;
  }
  return 0;
}
function rebuildTowerSecondaryBranch(tower,instant=true){
  if(!tower||tower.type!=='tower')return 0;
  const removed=removeTowerSecondaryBranch(tower.id);
  const added=ensureTowerSecondaryBranch(tower,instant);
  return removed+added;
}
function reconcileTowerSecondaryBranches(limit=Infinity,instant=false){
  let changed=0,done=0;
  const liveTargets=new Set(
    State.structures
      .filter(s=>(s.type==='gate'||s.type==='well')&&!underConstruction(s))
      .map(s=>s.id)
  );

  for(const tower of State.structures){
    if(done>=limit)break;
    if(tower.type!=='tower'||tower.parentTowerId||underConstruction(tower))continue;

    const existing=towerSecondaryRoads(tower.id);
    const stale=existing.some(r=>r.branchTargetId&&!liveTargets.has(r.branchTargetId));
    if(existing.length&&!stale)continue;
    if(stale)changed+=removeTowerSecondaryBranch(tower.id);

    const n=ensureTowerSecondaryBranch(tower,instant);
    if(n){changed+=n;done++}
  }
  if(changed)invalidateNavigation(false);
  return changed;
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
function ensureSettlementRoadAccess(...args){return finishRoadWork(ensureSettlementRoadAccessWork(...args))}
function* ensureSettlementRoadAccessWork(s,instant=false,stillValid=()=>true){
  if(!s||underConstruction(s))return 0;
  if(State.structures.some(r=>r.type==='road'&&r.accessFor===s.id))return 0;
  const nearest=nearestPrimaryRoadProjection(structureCenter(s));if(!nearest)return 0;
  const start=settlementRoadAccessPoint(s,nearest.point),goal=nearest.point;
  if(!start||dist(start,goal)<.58)return 0;
  const width=s.type==='market'?.34:s.type==='field'?.26:.30;
  const ignore=[s.id];
  let path;
  if(yield* roadRepairSegmentWork(start,goal,width,ignore))path=[start,goal];
  else path=yield* findRoadRepairWork(start,goal,width,10,ignore,45000);
  if(!stillValid())return 0;
  if(!path||path.length<2)return 0;
  return yield* addReactiveRoadWork(path,{width,parentRoadId:nearest.road.id},{
    accessFor:s.id,roadClass:'access-primary',ignoreIds:ignore,instant
  },stillValid);
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
  // This entry point is used after load, when derived branches must be restored
  // as existing geometry rather than re-enter construction.
  changed+=reconcileTowerSecondaryBranches(Infinity,true);
  changed+=reconcileSettlementAccessRoads(Infinity,true);
  if(changed)invalidateNavigation(false);
  return changed;
}
function nearestRoadInfo(p,roads){let best={d:Infinity,angle:0};for(const r of roads){const d=pointSegmentDistance(p,r.a,r.b);if(d<best.d)best={d,angle:Math.atan2(r.b.y-r.a.y,r.b.x-r.a.x)}}return best}
function autoBlocked(candidate,placed,manual,margin=.2){
  const p={x:candidate.x,y:candidate.y},r=pointRadius(candidate)+margin;
  if(environmentBlocksPoint(p,'settlement'))return true;
  for(const s of manual){if(['wall','palisade','built'].includes(s.type)){if(pointSegmentDistance(p,s.a,s.b)<=r+s.width/2)return true}else if(s.x!=null&&dist(p,s)<=r+pointRadius(s))return true}
  for(const s of placed){
    if(s.type==='road'||candidate.type==='house'&&s.type==='field')continue;
    if(dist(p,s)<=r+pointRadius(s)+margin)return true
  }
  return false;
}
function biomeHash(name){let h=2166136261>>>0;for(const ch of name){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
function makeEnvBlob(rnd,type,x,y,rx,ry,fill,edge,count=22,jitter=.16){
  const points=[];for(let i=0;i<count;i++){const a=Math.PI*2*i/count,j=1+(rnd()-.5)*2*jitter;points.push({x:x+Math.cos(a)*rx*j,y:y+Math.sin(a)*ry*j})}
  return{id:'env-'+type+'-'+Math.round(x*10)+'-'+Math.round(y*10),type,points,fill,edge,x,y,rx,ry};
}
function makeEnvEllipse(type,x,y,rx,ry,angle,fill,edge){return{id:'env-'+type+'-'+Math.round(x*10)+'-'+Math.round(y*10),type,x,y,rx,ry,angle,fill,edge}}
// Meandering watercourse across the map: two sine bends (long meanders plus tighter
// wiggles) and a little smoothed noise, sampled every 2.5U.
function makeEnvWater(rnd,type){
  const horizontal=rnd()>.30,river=type==='river',pts=[],step=2.5,n=Math.round(WORLD/step);
  const base=70+rnd()*60;
  const a1=river?biomeRand(rnd,14,22):biomeRand(rnd,9,15),f1=river?biomeRand(rnd,1.5,2.5):biomeRand(rnd,2,3.5);
  const a2=river?biomeRand(rnd,4,7):biomeRand(rnd,3,5),f2=biomeRand(rnd,4,6.5);
  const p1=rnd()*Math.PI*2,p2=rnd()*Math.PI*2;
  let noise=0;
  for(let i=0;i<=n;i++){
    const t=i/n;noise=noise*.8+(rnd()-.5)*1.6;
    const off=clamp(base+a1*Math.sin(t*Math.PI*2*f1+p1)+a2*Math.sin(t*Math.PI*2*f2+p2)+noise,8,WORLD-8);
    pts.push(horizontal?{x:t*WORLD,y:off}:{x:off,y:t*WORLD});
  }
  return{id:'env-'+type,type,points:pts,width:river?3.2:1.25,fill:river?'#3a7684':'#4f8d95',edge:river?'#88b4b8':'#9cc6c6'};
}
// The sea covers at most 20% of the map: its mean coast depth is held at or under 40U.
const SEA_MAX_COVERAGE=.20;
function makeEnvSea(rnd){
  const sides=['north','east','south','west'],side=sides[Math.floor(rnd()*sides.length)],coast=[],n=14;
  const waves=Array.from({length:n+1},(_,i)=>Math.sin(i/n*Math.PI*2+rnd()*1.2)*5+(rnd()-.5)*5);
  const meanWave=waves.reduce((s,w)=>s+w,0)/waves.length;
  const depth=Math.min(26+rnd()*12,WORLD*SEA_MAX_COVERAGE-Math.max(0,meanWave)-.5);
  for(let i=0;i<=n;i++){
    const t=i/n,wave=waves[i];
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
const LANDSCAPE_GENERATION_VERSION=4;
function reliefShuffle(list,rnd){
  for(let i=list.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[list[i],list[j]]=[list[j],list[i]]}
  return list;
}
function reliefEdgeWidth(kind){return kind==='steep'?.5:2}
const STEEP_RATIO_BY_LEVEL=Object.freeze({1:.20,2:.30,3:.40,4:.50,5:.60});
const RELIEF_MAX_EDGE=4;
const RELIEF_L1_MIN_GAP=3;
function resampleClosedPolygonMaxEdge(points,maxLen=RELIEF_MAX_EDGE){
  const out=[];
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length],L=dist(a,b),steps=Math.max(1,Math.ceil(L/maxLen));
    for(let j=0;j<steps;j++){
      const t=j/steps;
      out.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
    }
  }
  return out;
}
function assignSteepEdgesByLevel(relief,rnd){
  const groups=new Map();
  for(const hill of relief.hills||[])for(const level of hill.levels||[]){
    level.edgeKinds=Array(level.top?.length||0).fill('gentle');
    const h=level.z1;
    if(!groups.has(h))groups.set(h,[]);
    for(let i=0;i<level.edgeKinds.length;i++)groups.get(h).push({level,index:i});
  }
  for(const [h,refs] of groups){
    reliefShuffle(refs,rnd);
    const ratio=STEEP_RATIO_BY_LEVEL[h]??.20;
    const count=Math.min(refs.length,Math.round(refs.length*ratio));
    for(let i=0;i<count;i++)refs[i].level.edgeKinds[refs[i].index]='steep';
  }
}
function makeProceduralHill(rnd,index,spec=null){
  const controlCount=12+Math.floor(rnd()*5),maxHeight=spec?.maxHeight??(index===0?5:2+Math.floor(rnd()*4));
  const center=spec?.center??{x:-18+rnd()*(WORLD+36),y:-18+rnd()*(WORLD+36)};
  const rx=spec?.rx??22+rnd()*16,ry=spec?.ry??15+rnd()*13,angle=spec?.angle??rnd()*Math.PI;
  const ca=Math.cos(angle),sa=Math.sin(angle),angles=[];
  const phaseA=rnd()*Math.PI*2,phaseB=rnd()*Math.PI*2;
  for(let i=0;i<controlCount;i++)angles.push(i/controlCount*Math.PI*2+(rnd()-.5)*.055);
  const control=angles.map(a=>{
    const rr=1
      +Math.sin(a*2+phaseA)*(.055+rnd()*.025)
      +Math.sin(a*3+phaseB)*(.035+rnd()*.018)
      +(rnd()-.5)*.035;
    const x=Math.cos(a)*rx*rr,y=Math.sin(a)*ry*rr;
    return{x:center.x+x*ca-y*sa,y:center.y+x*sa+y*ca};
  });
  const base=resampleClosedPolygonMaxEdge(control,RELIEF_MAX_EDGE);
  const levels=Array.from({length:maxHeight},(_,i)=>({
    id:`hill-${index+1}-l${i+1}`,hillId:`hill-${index+1}`,level:i+1,z0:i,z1:i+1,
    center:{x:center.x,y:center.y},
    gentleBase:2,steepBase:.5,edgeKinds:[],multiEdges:[],top:[]
  }));
  levels[0].top=base;
  levels[0].edgeKinds=Array(base.length).fill('gentle');
  const multiEligibleRatio=maxHeight>1?Math.min(.92,.36*maxHeight/(maxHeight-1)):0;
  for(let l=1;l<maxHeight;l++){
    const prev=levels[l-1],cur=levels[l],n=prev.top.length,refs=Array.from({length:n},(_,i)=>i);
    reliefShuffle(refs,rnd);
    prev.multiEdges=refs.slice(0,Math.min(n,Math.round(n*multiEligibleRatio)));
    const multi=new Set(prev.multiEdges);
    const raw=prev.top.map((p,i)=>{
      const d=dist(p,center)||1,prevEdge=(i-1+n)%n;
      const stacked=multi.has(i)||multi.has(prevEdge);
      let inset=stacked?.9+rnd()*.35:3.6+rnd()*1.8;
      inset=Math.min(inset,d*.20);
      const factor=Math.max(.48,(d-inset)/d),vx=p.x-center.x,vy=p.y-center.y;
      return{x:center.x+vx*factor,y:center.y+vy*factor};
    });
    cur.top=resampleClosedPolygonMaxEdge(raw,RELIEF_MAX_EDGE);
    cur.edgeKinds=Array(cur.top.length).fill('gentle');
  }
  return{id:`hill-${index+1}`,center,rx,ry,maxHeight,levels};
}
function hillIntersectsWorld(hill){
  const pts=hill.levels[0]?.top||[];if(!pts.length)return false;
  const minX=Math.min(...pts.map(p=>p.x))-2,maxX=Math.max(...pts.map(p=>p.x))+2;
  const minY=Math.min(...pts.map(p=>p.y))-2,maxY=Math.max(...pts.map(p=>p.y))+2;
  return maxX>=0&&minX<=WORLD&&maxY>=0&&minY<=WORLD;
}
function hillL1Gap(a,b){
  const pa=a?.levels?.[0]?.top||[],pb=b?.levels?.[0]?.top||[];
  if(pa.length<3||pb.length<3)return Infinity;
  const ba=environmentPolygonBounds(pa),bb=environmentPolygonBounds(pb),far=RELIEF_L1_MIN_GAP+1;
  if(ba.minX>bb.maxX+far||bb.minX>ba.maxX+far||ba.minY>bb.maxY+far||bb.minY>ba.maxY+far)return far;
  if(polygonsOverlapSimple(pa,pb))return 0;
  return polygonGap(pa,pb);
}
function hillSpacingOk(hill,hills){
  return hills.every(other=>hillL1Gap(hill,other)>=RELIEF_L1_MIN_GAP-.001);
}
function reliefFootprintContains(p){
  for(const hill of State.relief?.hills||[]){
    const level=hill.levels?.[0];if(!level?.top?.length)continue;
    if(pointInPolygon(p,level.top))return true;
    for(const band of reliefEdgeBands(level))if(pointInPolygon(p,band.poly))return true;
  }
  return false;
}
function estimateReliefCoverage(samples=56){
  if(!State.relief?.hills?.length)return 0;
  let covered=0,total=samples*samples;
  for(let iy=0;iy<samples;iy++){
    const y=(iy+.5)/samples*WORLD;
    for(let ix=0;ix<samples;ix++){
      const x=(ix+.5)/samples*WORLD;
      if(reliefFootprintContains({x,y}))covered++;
    }
  }
  return covered/total;
}
function reliefStats(){
  let edges=0,steep=0,multi=0,maxHeight=0,maxEdge=0,minL1Gap=Infinity;
  const steepByLevel={};
  for(const hill of State.relief?.hills||[]){
    maxHeight=Math.max(maxHeight,hill.maxHeight||0);
    for(const level of hill.levels||[]){
      const kinds=level.edgeKinds||[],h=level.z1;
      edges+=kinds.length;
      const levelSteep=kinds.filter(k=>k==='steep').length;
      steep+=levelSteep;multi+=level.multiEdges?.length||0;
      if(!steepByLevel[h])steepByLevel[h]={edges:0,steep:0,ratio:0};
      steepByLevel[h].edges+=kinds.length;steepByLevel[h].steep+=levelSteep;
      for(let i=0;i<(level.top?.length||0);i++)maxEdge=Math.max(maxEdge,dist(level.top[i],level.top[(i+1)%level.top.length]));
    }
  }
  for(const h of Object.keys(steepByLevel)){
    const s=steepByLevel[h];s.ratio=s.edges?s.steep/s.edges:0;
  }
  const hills=State.relief?.hills||[];
  for(let i=0;i<hills.length;i++)for(let j=i+1;j<hills.length;j++)minL1Gap=Math.min(minL1Gap,hillL1Gap(hills[i],hills[j]));
  return{
    coverage:estimateReliefCoverage(64),
    steepRatio:edges?steep/edges:0,
    steepByLevel,
    multiRatio:edges?multi/edges:0,
    maxHeight,maxEdge,
    minL1Gap:Number.isFinite(minL1Gap)?minL1Gap:null,
    hillCount:hills.length
  };
}
// ---------- biome recipes (COFFEE BATTLES MapEngine) ----------
// Feature counts per biome follow COFFEE BATTLES generateOrography / generateHydrology /
// generateTactical. Sizes are COFFEE BATTLES units scaled from its 90U battlefield to the
// 200U CONQUER world. Hills become terraced relief; forests keep the organic outlines.
// COFFEE BATTLES "rough" patches are not generated: CONQUER retired the rough ellipses.
const BIOME_SCALE=2.2,BIOME_ZONE_INSET=2*BIOME_SCALE;
const BIOME_RECIPES=Object.freeze({
  // TEST (default): the settings used while developing — procedural terraced hills up to 20% of
  // the map and many small woods up to 12% coverage.
  test:{legacyRelief:.20,smallForestCoverage:.12},
  plains:{stream:.45,forests:[0,1]},
  hills:{hills:[3,4],hillHeight:[2,3],forests:[0,1]},
  valley:{mountains:[3,5],stream:1},
  river:{river:true,forests:[1,2],hills:[0,1],hillHeight:[1,2]},
  forest:{stream:1,continuousForest:.20,ponds:[0,1]},
  mountains:{mountains:[4,7],stream:1,hills:[1,2],hillHeight:[3,4],hillCoverage:.30},
  village:{forests:[1,2],hills:[0,1],hillHeight:[1,2]},
  sea:{sea:true,forests:[0,1]}
});
function biomeRecipe(){return BIOME_RECIPES[State.biome]||BIOME_RECIPES.plains}
function biomeRange(rnd,[lo,hi]=[0,0]){return lo+Math.floor(rnd()*(hi-lo+1))}
function biomeRand(rnd,lo,hi){return lo+rnd()*(hi-lo)}
// randomCenter(marginU) inside the COFFEE BATTLES map zone (battlefield inset by 2U).
function biomeCenter(rnd,marginU=0){
  const m=BIOME_ZONE_INSET+marginU*BIOME_SCALE;
  return{x:m+rnd()*(WORLD-2*m),y:m+rnd()*(WORLD-2*m)};
}
// makeHill / makeForest sizes: large rx 8-10, ry 4-5.5; small rx 5-7, ry 3-4 (centre margin 7 / 4).
function biomeFeatureSize(rnd,small){
  return small
    ?{margin:4,rx:biomeRand(rnd,5,7)*BIOME_SCALE,ry:biomeRand(rnd,3,4)*BIOME_SCALE}
    :{margin:7,rx:biomeRand(rnd,8,10)*BIOME_SCALE,ry:biomeRand(rnd,4,5.5)*BIOME_SCALE};
}
// Coast, orography and hydrology come from their own seeded streams, so generateRelief() and
// generateEnvironment() see the same sea, mountains and water and can avoid each other.
function biomeStream(salt){return seedRand((State.seed^biomeHash(State.biome||'plains')^salt)>>>0)}
function biomeSea(){return biomeRecipe().sea?makeEnvSea(biomeStream(0x51ea51ea)):null}
// makeMountainSectorChain: a contiguous run of perimeter sectors (4x4 grid on the square map),
// never a whole side, each holding a mountain about 0.52-0.60 of a sector across in radius.
function biomeMountains(){
  const recipe=biomeRecipe();if(!recipe.mountains)return[];
  const rnd=biomeStream(0x60a4f7e1),cells=4,cw=WORLD/cells,ring=[];
  for(let c=0;c<cells;c++)ring.push({r:0,c});
  for(let r=1;r<cells;r++)ring.push({r,c:cells-1});
  for(let c=cells-2;c>=0;c--)ring.push({r:cells-1,c});
  for(let r=cells-2;r>0;r--)ring.push({r,c:0});
  for(let attempt=0;attempt<80;attempt++){
    const len=Math.min(biomeRange(rnd,recipe.mountains),ring.length-2),start=Math.floor(rnd()*ring.length);
    const chosen=Array.from({length:len},(_,i)=>ring[(start+i)%ring.length]);
    const fullSide=[r=>r.r===0,r=>r.r===cells-1,r=>r.c===0,r=>r.c===cells-1].some(t=>chosen.filter(t).length>=cells);
    if(fullSide)continue;
    const clip=m=>{
      // Perimeter mountains are cut at the map edge rather than spilling past it.
      if(typeof clipTerrainPolygon==='function')m.points=clipTerrainPolygon(m.points).map(p=>({x:p.x,y:p.y}));
      return m;
    };
    const peaks=chosen.map(cell=>{
      const x=(cell.c+.5)*cw,y=(cell.r+.5)*cw;
      const m=makeEnvBlob(rnd,'mountain',x,y,cw*biomeRand(rnd,.52,.60),cw*biomeRand(rnd,.54,.62),'#56493c','#968470',24,.11);
      // Steep peaks: apex height about the base radius. In this isometric view a cone below
      // ~0.6 height/radius keeps its apex inside the base outline and reads as flat.
      m.height=Math.sqrt(m.rx*m.ry)*biomeRand(rnd,MOUNTAIN_STEEPNESS[0],MOUNTAIN_STEEPNESS[1]);
      m.mapSector={row:cell.r,col:cell.c};return clip(m);
    });
    // Secondary summits: about twice as many as the main peaks, 50-75% of their height,
    // clustered on their flanks so the chain reads as a massif.
    const subCount=Math.max(peaks.length,peaks.length*2+Math.floor(rnd()*3)-1),subs=[];
    for(let i=0;i<subCount;i++){
      const main=peaks[i%peaks.length],r=Math.sqrt(main.rx*main.ry),a=rnd()*Math.PI*2,d=r*biomeRand(rnd,.55,.95);
      const x=clamp(main.x+Math.cos(a)*d,6,WORLD-6),y=clamp(main.y+Math.sin(a)*d,6,WORLD-6),k=biomeRand(rnd,.45,.65);
      const sub=makeEnvBlob(rnd,'mountain',x,y,main.rx*k,main.ry*k,'#56493c','#968470',20,.13);
      sub.height=main.height*biomeRand(rnd,.50,.75);sub.subPeak=true;sub.mainPeakId=main.id;
      subs.push(clip(sub));
    }
    // Slope from 40deg (smallest summit) to 60deg (largest), interpolated by base radius; the
    // height follows from slope and radius, so the tallest summit is also the steepest.
    const all=[...peaks,...subs],rs=all.map(m=>Math.sqrt(m.rx*m.ry)),lo=Math.min(...rs),hi=Math.max(...rs);
    for(const m of all){
      const t=hi>lo?(Math.sqrt(m.rx*m.ry)-lo)/(hi-lo):1,deg=MOUNTAIN_SLOPE_DEG[0]+(MOUNTAIN_SLOPE_DEG[1]-MOUNTAIN_SLOPE_DEG[0])*t;
      m.slopeDeg=deg;m.height=Math.sqrt(m.rx*m.ry)*Math.tan(deg*Math.PI/180);
    }
    return all;
  }
  return[];
}
const MOUNTAIN_STEEPNESS=[.95,1.15],MOUNTAIN_SLOPE_DEG=[40,60];
// makeWatercourseAvoiding: the stream/river must stay clear of the mountain chain.
function biomeWater(mountains){
  const recipe=biomeRecipe(),rnd=biomeStream(0x3a7684c1);
  const type=recipe.river?'river':recipe.stream&&rnd()<recipe.stream?'stream':null;
  if(!type)return null;
  let best=null,bestClear=-Infinity;
  for(let attempt=0;attempt<40;attempt++){
    const water=makeEnvWater(rnd,type);
    let clear=Infinity;
    for(const m of mountains)for(let i=1;i<water.points.length;i++)
      for(const p of m.points)clear=Math.min(clear,pointSegmentDistance(p,water.points[i-1],water.points[i]));
    if(clear>water.width/2+2)return water;
    if(clear>bestClear){bestClear=clear;best=water}
  }
  return best;
}
// Outline used to keep hills, forests, ponds, sea and mountains apart.
function reliefHillFootprint(hill){return hill.levels?.[0]?.top||[]}
function biomeFeatureClear(points,obstacles,gap){
  const a=environmentPolygonBounds(points);
  for(const o of obstacles){
    // Bounding-box rejection before the O(n*m) polygon distance.
    const b=environmentPolygonBounds(o.line||o.points),pad=(o.line?o.clear:gap)+.01;
    if(a.minX>b.maxX+pad||b.minX>a.maxX+pad||a.minY>b.maxY+pad||b.minY>a.maxY+pad)continue;
    if(o.line){
      for(let i=1;i<o.line.length;i++)for(const p of points)if(pointSegmentDistance(p,o.line[i-1],o.line[i])<o.clear)return false;
      continue;
    }
    if(polygonGap(points,o.points)<gap)return false;
  }
  return true;
}
function biomeTerrainObstacles(){
  const sea=biomeSea(),mountains=biomeMountains(),water=biomeWater(mountains),out=[];
  // Hills may run into the mountains: foothills continue the massif instead of avoiding it.
  if(sea)out.push({points:sea.points});
  if(water)out.push({line:water.points,clear:water.width/2+2});
  return out;
}
const BIOME_TOWN={x:WORLD/2,y:WORLD/2},BIOME_TOWN_CLEARANCE=7;
function biomeTownClear(points){
  if(pointInPolygon(BIOME_TOWN,points))return false;
  for(let i=0;i<points.length;i++)if(pointSegmentDistance(BIOME_TOWN,points[i],points[(i+1)%points.length])<BIOME_TOWN_CLEARANCE)return false;
  return true;
}
function generateRelief(){
  const reliefSeed=(State.seed^0x5f356495)>>>0,rnd=seedRand(reliefSeed);
  State.relief={version:LANDSCAPE_GENERATION_VERSION,seed:reliefSeed,biome:State.biome,hills:[],stats:null};
  clearReliefBandCache();
  // generateTactical: hills placed after coast, mountains and water, never overlapping them.
  const recipe=biomeRecipe(),count=biomeRange(rnd,recipe.hills),obstacles=biomeTerrainObstacles();
  if(recipe.legacyRelief){
    // Former test relief: random procedural hills anywhere (also past the edge) until coverage.
    let coverage=0,attempts=0;
    while(coverage<recipe.legacyRelief&&State.relief.hills.length<14&&attempts<320){
      const candidate=makeProceduralHill(rnd,State.relief.hills.length);attempts++;
      if(!hillIntersectsWorld(candidate)||!hillSpacingOk(candidate,State.relief.hills))continue;
      State.relief.hills.push(candidate);clearReliefBandCache();coverage=estimateReliefCoverage(44);
    }
  }
  // Foothills: a biome may ask for a minimum relief coverage (Montagne: 30% of the map); extra
  // hills, up to 1.7x larger, keep being placed after the recipe count until it is reached.
  let coverage=0,extra=0;
  for(let i=0;i<count||(recipe.hillCoverage&&coverage<recipe.hillCoverage&&extra<90);i++){
    if(i>=count)extra++;
    for(let attempt=0;attempt<(i>=count?70:420);attempt++){
      const size=biomeFeatureSize(rnd,false),center=biomeCenter(rnd,i>=count?0:size.margin);
      // Foothills range from half to twice a recipe hill, so smaller ones fill the gaps.
      if(i>=count){const k=attempt<35?biomeRand(rnd,1,2):biomeRand(rnd,.5,1);size.rx*=k;size.ry*=k}
      // Every terrace needs room: about one level per 3U of the short radius.
      const maxHeight=Math.max(1,Math.min(biomeRange(rnd,recipe.hillHeight||[1,2]),Math.floor(size.ry/3)));
      const candidate=makeProceduralHill(rnd,State.relief.hills.length,{center,rx:size.rx,ry:size.ry,maxHeight});
      const foot=reliefHillFootprint(candidate);
      if(!hillIntersectsWorld(candidate)||!hillSpacingOk(candidate,State.relief.hills))continue;
      // Foothills (beyond the recipe count) may reach the mountain bases: only their slope band apart.
      if(!biomeTownClear(foot)||!biomeFeatureClear(foot,obstacles,reliefEdgeWidth('gentle')+(i>=count?.1:1)))continue;
      State.relief.hills.push(candidate);
      clearReliefBandCache();
      if(recipe.hillCoverage)coverage=estimateReliefCoverage(40);
      break;
    }
  }
  assignSteepEdgesByLevel(State.relief,seedRand((reliefSeed^0x735a2d97)>>>0));
  clearReliefBandCache();
  State.relief.stats=reliefStats();
  State.relief.forestTerrainRuleVersion=FOREST_TERRAIN_RULE_VERSION;
  clearReliefBandCache();
  return State.relief;
}
function ensureStaticLandscape(){
  let generated=false;
  if(!State.relief||State.relief.version!==LANDSCAPE_GENERATION_VERSION||!Array.isArray(State.relief.hills)){
    generateRelief();generated=true;
  }else clearReliefBandCache();
  if(!Array.isArray(State.environment)||!State.environment.length){
    generateEnvironment();generated=true;
  }
  // Remove obsolete brown hill/rough ellipses from existing saved maps as well.
  // True relief remains in State.relief; it is not flattened or regenerated.
  const withoutOvals=State.environment.filter(f=>f.type!=='rough'&&f.type!=='hill');
  if(withoutOvals.length!==State.environment.length){State.environment=withoutOvals;generated=true}
  if(repairForestsAgainstSteepSlopes())generated=true;
  return generated;
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
const FOREST_TERRAIN_RULE_VERSION=1;
function polygonsOverlapSimple(a,b){
  if(!a?.length||!b?.length)return false;
  if(a.some(p=>pointInPolygon(p,b))||b.some(p=>pointInPolygon(p,a)))return true;
  for(let i=0;i<a.length;i++){
    const a2=a[(i+1)%a.length];
    for(let j=0;j<b.length;j++){
      const b2=b[(j+1)%b.length];
      if(segmentsIntersect(a[i],a2,b[j],b2))return true;
    }
  }
  return false;
}
function forestIntersectsSteepRelief(forest){
  const pts=forest?.points;if(!pts?.length||!State.relief?.hills?.length)return false;
  for(const level of reliefLevels()){
    for(const band of reliefEdgeBands(level)){
      if(band.kind!=='steep')continue;
      if(polygonsOverlapSimple(pts,band.poly))return true;
    }
  }
  return false;
}
function repairForestsAgainstSteepSlopes(){
  if(!State.relief?.hills?.length||!Array.isArray(State.environment))return false;
  const already=State.relief.forestTerrainRuleVersion===FOREST_TERRAIN_RULE_VERSION;
  let removed=0;
  State.environment=State.environment.filter(f=>{
    if(f.type!=='forest')return true;
    if(!forestIntersectsSteepRelief(f))return true;
    removed++;return false;
  });
  // Woods are counted per biome now: removed ones are not topped up to a coverage target.
  State.relief.forestTerrainRuleVersion=FOREST_TERRAIN_RULE_VERSION;
  return removed>0||!already;
}

const ENV_POLYGON_BOUNDS=new WeakMap();
function environmentPolygonBounds(points){
  let bounds=ENV_POLYGON_BOUNDS.get(points);
  if(bounds)return bounds;
  bounds={minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity};
  for(const p of points){
    bounds.minX=Math.min(bounds.minX,p.x);bounds.maxX=Math.max(bounds.maxX,p.x);
    bounds.minY=Math.min(bounds.minY,p.y);bounds.maxY=Math.max(bounds.maxY,p.y);
  }
  ENV_POLYGON_BOUNDS.set(points,bounds);
  return bounds;
}
function forestBlobCanPlace(candidate,env,minGap=3){
  if(forestIntersectsSteepRelief(candidate))return false;
  // Do not trap the initial settlement inside an unbreakable forest ring.
  // This protects only the immediate hub, not radial road corridors.
  const town={x:WORLD/2,y:WORLD/2},townClearance=7;
  if(pointInPolygon(town,candidate.points))return false;
  for(let i=0;i<candidate.points.length;i++)
    if(pointSegmentDistance(town,candidate.points[i],candidate.points[(i+1)%candidate.points.length])<townClearance)return false;
  // Keep both riverbanks clear and never cover the river centerline.
  for(const water of env.filter(f=>f.type==='river'||f.type==='stream')){
    const clearance=(water.width||1.25)/2+2;
    for(let i=1;i<water.points.length;i++){
      const a=water.points[i-1],b=water.points[i];
      for(const p of candidate.points)if(pointSegmentDistance(p,a,b)<clearance)return false;
      const steps=Math.max(1,Math.ceil(dist(a,b)));
      for(let j=0;j<=steps;j++){
        const p={x:a.x+(b.x-a.x)*j/steps,y:a.y+(b.y-a.y)*j/steps};
        if(pointInPolygon(p,candidate.points))return false;
      }
    }
  }
  // O(1) bounding-box rejection before O(vertices²) polygon distance:
  // most forest patches are far apart, especially in high-density biomes.
  const a=environmentPolygonBounds(candidate.points);
  return env.filter(f=>f.type==='forest').every(f=>{
    const b=environmentPolygonBounds(f.points);
    if(a.minX>b.maxX+minGap||b.minX>a.maxX+minGap||
       a.minY>b.maxY+minGap||b.minY>a.maxY+minGap)return true;
    return polygonGap(candidate.points,f.points)>=minGap;
  });
}
function forestBeltOutline(kind,rx,ry,rotation,phase){
  // Rounded thickened spline, supporting horseshoe C, curved L and meander S.
  const spine=[],n=36;
  for(let i=0;i<=n;i++){
    const t=i/n,a=t*Math.PI*1.5-Math.PI*.75;
    const p=kind==='C'?{x:.43*Math.cos(a),y:.43*Math.sin(a)}:
      kind==='L'?{x:-.43+.86*t*t,y:-.43+.86*(2*t-t*t)}:
      {x:-.44+.88*t,y:.29*Math.sin(t*Math.PI*2)};
    spine.push(p);
  }
  const sides=sign=>spine.map((p,i)=>{
    const prev=spine[Math.max(0,i-1)],next=spine[Math.min(n,i+1)];
    const dx=next.x-prev.x,dy=next.y-prev.y,len=Math.hypot(dx,dy)||1;
    const w=(kind==='S'?.05:.14)*(1+.13*Math.sin(phase+i/n*Math.PI*4));
    return{x:p.x-sign*dy/len*w,y:p.y+sign*dx/len*w};
  });
  const ca=Math.cos(rotation),sa=Math.sin(rotation);
  return [...sides(1),...sides(-1).reverse()].map(p=>{
    const xx=p.x*rx,yy=p.y*ry;return{x:xx*ca-yy*sa,y:xx*sa+yy*ca};
  });
}
function makeOrganicForestBlob(rnd,x,y,rx,ry,small=false){
  // Correlated, low-frequency lobes rather than independent radial jitter:
  // recognisably rounded tree lines with coves, bulges and asymmetry.
  // Only the vertex polygon changes; collision/paths use these same points.
  const tau=Math.PI*2,rotation=rnd()*tau,phase2=rnd()*tau,phase3=rnd()*tau;
  const phase5=rnd()*tau,stretch=.84+rnd()*.32,angleCount=small?40:56;
  const cr=Math.cos(rotation),sr=Math.sin(rotation),points=[];
  const outlineType=rnd();
  if(outlineType>.55){
    const kind=outlineType<.72?'C':outlineType<.86?'L':'S';
    const outline=forestBeltOutline(kind,rx,ry,rotation,phase3);
    for(const p of outline)points.push({x:x+p.x,y:y+p.y});
    return{id:'env-forest-'+Math.round(x*10)+'-'+Math.round(y*10),
      type:'forest',points,fill:'#2e3c1d',edge:'#5c7438',x,y,rx,ry,outlineType:kind};
  }
  for(let i=0;i<angleCount;i++){
    const a=i*tau/angleCount;
    const lobes=1+.15*Math.sin(2*a+phase2)+.11*Math.sin(3*a+phase3)
      +.045*Math.cos(5*a+phase5);
    const ux=Math.cos(a)*rx*lobes*stretch,uy=Math.sin(a)*ry*lobes/stretch;
    points.push({x:x+ux*cr-uy*sr,y:y+ux*sr+uy*cr});
  }
  return{id:'env-forest-'+Math.round(x*10)+'-'+Math.round(y*10),
    type:'forest',points,fill:'#2e3c1d',edge:'#5c7438',x,y,rx,ry};
}
function makeForestCandidate(rnd,small=false){
  // Preserve the previous minimum radii (small 4x3, large 8x6), while
  // allowing up to 300% of the previous maxima (small 21x15, large 45x36).
  // Forest centres can fall on the world border, producing partial woods.
  const p=randomEnvPoint(rnd,0);
  // Prioritize broad woodlands over dozens of tiny dots. The minimum and
  // the 300% maximum stay unchanged; x/y sizes are gently correlated.
  const size=Math.pow(rnd(),small?.82:.62),aspect=.78+rnd()*.44;
  const rx=small?4+17*size:8+37*size;
  const ry=small?3+12*Math.min(1,size*aspect):6+30*Math.min(1,size*aspect);
  return makeOrganicForestBlob(rnd,p.x,p.y,rx,ry,small);
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
function ensureForestCoverage(env,rnd,target=.20,small=false){
  // Maintain an incremental raster rather than rescanning every existing
  // tree line after each accepted forest (previously quadratic in patch count).
  const samples=72,total=samples*samples,occupied=new Uint8Array(total);
  let covered=0,guard=0,failures=0;
  const maxForests=small?40:State.biome==='forest'?20:13;
  let forestCount=env.filter(f=>f.type==='forest').length;
  function markForest(f){
    const b=environmentPolygonBounds(f.points);
    const x0=Math.max(0,Math.floor(b.minX/WORLD*samples)-1);
    const x1=Math.min(samples-1,Math.ceil(b.maxX/WORLD*samples)+1);
    const y0=Math.max(0,Math.floor(b.minY/WORLD*samples)-1);
    const y1=Math.min(samples-1,Math.ceil(b.maxY/WORLD*samples)+1);
    for(let iy=y0;iy<=y1;iy++){
      const y=(iy+.5)/samples*WORLD;
      for(let ix=x0;ix<=x1;ix++){
        const i=iy*samples+ix;
        if(occupied[i])continue;
        const p={x:(ix+.5)/samples*WORLD,y};
        if(pointInPolygon(p,f.points)){occupied[i]=1;covered++}
      }
    }
  }
  for(const f of env)if(f.type==='forest')markForest(f);
  // The cap is deliberate: no more proliferating tiny woodland patches just
  // to meet a fixed coverage percentage in constrained geography.
  while(covered/total<target&&forestCount<maxForests&&guard++<320&&failures<24){
    const forest=addForestBlob(env,rnd,small,3,80);
    if(forest){forestCount++;markForest(forest);failures=0}else failures++;
  }
  return covered/total;
}
// COFFEE BATTLES phase order: Coast, Orography, Hydrology, then the tactical woods and ponds.
// Each woodland/pond is tried up to 420 times (MapEngine.place) and skipped if it never fits.
function biomeHillObstacles(){
  return(State.relief?.hills||[]).map(h=>({points:reliefHillFootprint(h)})).filter(o=>o.points.length>=3);
}
function addBiomeForest(env,rnd,small){
  const others=()=>[...biomeHillObstacles(),...env.filter(f=>['sea','mountain','pond'].includes(f.type)).map(f=>({points:f.points}))];
  for(let attempt=0;attempt<420;attempt++){
    const size=biomeFeatureSize(rnd,small),p=biomeCenter(rnd,size.margin);
    const candidate=makeOrganicForestBlob(rnd,p.x,p.y,size.rx,size.ry,small);
    if(!forestBlobCanPlace(candidate,env,3)||!biomeFeatureClear(candidate.points,others(),1))continue;
    env.push(candidate);return candidate;
  }
  return null;
}
function addBiomePond(env,rnd){
  const others=[...biomeHillObstacles(),...env.filter(f=>f.points&&!['stream','river'].includes(f.type)).map(f=>({points:f.points})),
    ...env.filter(f=>['stream','river'].includes(f.type)).map(f=>({line:f.points,clear:f.width/2+2}))];
  for(let attempt=0;attempt<420;attempt++){
    // makePond: rx 4-5, ry 2.5-3.3, centre margin 4.
    const p=biomeCenter(rnd,4),pond=makeEnvBlob(rnd,'pond',p.x,p.y,biomeRand(rnd,4,5)*BIOME_SCALE,biomeRand(rnd,2.5,3.3)*BIOME_SCALE,'#3f7f8a','#8ab9bd',20,.20);
    if(!biomeTownClear(pond.points)||!biomeFeatureClear(pond.points,others,1))continue;
    env.push(pond);return pond;
  }
  return null;
}
// Foresta: the whole map is woodland; organic clearings cover about `ratio` of it, the first
// one holding the settlement hub. Watercourse banks and ponds are holes too; main roads add
// their grooves later (carveForestGroove).
function clearingCoverage(holes,samples=64){
  let covered=0;
  for(let iy=0;iy<samples;iy++)for(let ix=0;ix<samples;ix++){
    const p={x:(ix+.5)/samples*WORLD,y:(iy+.5)/samples*WORLD};
    if(holes.some(h=>pointInPolygon(p,h)))covered++;
  }
  return covered/(samples*samples);
}
function makeContinuousForest(env,rnd,ratio){
  const clearing=(x,y,rx,ry)=>makeEnvBlob(rnd,'clearing',x,y,rx,ry,null,null,30,.14).points;
  const clearings=[clearing(BIOME_TOWN.x,BIOME_TOWN.y,biomeRand(rnd,24,28),biomeRand(rnd,20,24))];
  for(let attempt=0;attempt<60&&clearingCoverage(clearings,40)<ratio;attempt++){
    const p=biomeCenter(rnd,0),hole=clearing(p.x,p.y,biomeRand(rnd,9,20),biomeRand(rnd,7,15));
    // Clearings stay distinct glades: no merging into the hub or into each other.
    if(clearings.some(h=>polygonGap(hole,h)<4))continue;
    clearings.push(hole);
  }
  const holes=[...clearings];
  for(const w of env.filter(f=>f.type==='stream'||f.type==='river'))holes.push(...corridorHolePolygons(w.points,w.width/2+2));
  for(const pond of env.filter(f=>f.type==='pond'))holes.push(pond.points.map(q=>({x:pond.x+(q.x-pond.x)*1.25,y:pond.y+(q.y-pond.y)*1.25})));
  return{id:'env-forest-continuous',type:'forest',continuous:true,
    points:[{x:0,y:0},{x:WORLD,y:0},{x:WORLD,y:WORLD},{x:0,y:WORLD}],
    holes,clearings:clearings.length,clearingRatio:clearingCoverage(clearings),
    fill:'#2e3c1d',edge:'#5c7438',x:WORLD/2,y:WORLD/2,rx:WORLD/2,ry:WORLD/2};
}
function generateEnvironment(){
  const rnd=seedRand((State.seed^biomeHash(State.biome))>>>0),env=[],recipe=biomeRecipe();
  const sea=biomeSea();if(sea)env.push(sea);
  const mountains=biomeMountains();env.push(...mountains);
  const water=biomeWater(mountains);if(water)env.push(water);
  const ponds=biomeRange(rnd,recipe.ponds);
  if(recipe.continuousForest){
    for(let i=0;i<ponds;i++)addBiomePond(env,rnd);
    env.push(makeContinuousForest(env,rnd,recipe.continuousForest));
  }else if(recipe.smallForestCoverage){
    ensureForestCoverage(env,rnd,recipe.smallForestCoverage,true);
  }else{
    const forests=biomeRange(rnd,recipe.forests);
    for(let i=0;i<forests;i++)addBiomeForest(env,rnd,!!recipe.smallForests);
    for(let i=0;i<ponds;i++)addBiomePond(env,rnd);
  }
  environmentRevision++;
  // Relief from an older generator may still cross water or mountains laid out here.
  for(let i=env.length-1;i>=0;i--)if(environmentConflictsTestRelief(env[i])||['hill','rough'].includes(env[i].type))env.splice(i,1);
  State.environment=env;
}
// ---------- woodland holes ----------
// The Foresta biome is one woodland over the whole map (f.continuous) with holes: clearings,
// the watercourse and ponds, and the grooves main roads cut through it. Every hole is a
// polygon in f.holes, so containment, edge distance and drawing treat them uniformly.
function forestHoleAt(f,p){
  for(const hole of f.holes||[]){
    const b=environmentPolygonBounds(hole);
    if(p.x<b.minX||p.x>b.maxX||p.y<b.minY||p.y>b.maxY)continue;
    if(pointInPolygon(p,hole))return hole;
  }
  return null;
}
function forestRings(f){return f.points?.length?[f.points,...(f.holes||[])]:[]}
// Nearest point on any woodland edge (outline, clearing, groove).
function forestNearestEdge(f,p){
  let best=null,distance=Infinity;
  for(const ring of forestRings(f))for(let i=0;i<ring.length;i++){
    const a=ring[i],b=ring[(i+1)%ring.length],dx=b.x-a.x,dy=b.y-a.y;
    const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));
    const q={x:a.x+dx*t,y:a.y+dy*t},d=Math.hypot(p.x-q.x,p.y-q.y);
    if(d<distance){best=q;distance=d}
  }
  return{point:best,distance};
}
// Buffer a polyline into overlapping quads plus joint octagons (groove / riverbank holes).
function corridorHolePolygons(line,half){
  const out=[];
  for(let i=1;i<line.length;i++){
    const a=line[i-1],b=line[i],L=dist(a,b)||1,nx=-(b.y-a.y)/L*half,ny=(b.x-a.x)/L*half;
    out.push([{x:a.x+nx,y:a.y+ny},{x:b.x+nx,y:b.y+ny},{x:b.x-nx,y:b.y-ny},{x:a.x-nx,y:a.y-ny}]);
  }
  for(const p of line)out.push(Array.from({length:8},(_,k)=>({x:p.x+Math.cos(k*Math.PI/4)*half,y:p.y+Math.sin(k*Math.PI/4)*half})));
  return out;
}
// True if any part of the polygon lies in the woodland: outline every 0.5U plus a 4x4 interior grid.
function forestCoversPolygon(f,points){
  if(!points?.length)return false;
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length],n=Math.max(1,Math.ceil(dist(a,b)/.5));
    for(let k=0;k<n;k++)if(environmentContains(f,{x:a.x+(b.x-a.x)*k/n,y:a.y+(b.y-a.y)*k/n}))return true;
  }
  const b=environmentPolygonBounds(points);
  for(let iy=1;iy<=4;iy++)for(let ix=1;ix<=4;ix++){
    const p={x:b.minX+(b.maxX-b.minX)*ix/5,y:b.minY+(b.maxY-b.minY)*iy/5};
    if(pointInPolygon(p,points)&&environmentContains(f,p))return true;
  }
  return false;
}
let environmentRevision=0;
// Main roads are the one exception to the woodland rule: they cut a groove through a
// continuous forest instead of failing to reach the map edge.
const FOREST_GROOVE_HALF=2.4;
function carveForestGroove(road){
  let carved=false;
  for(const f of State.environment||[]){
    if(f.type!=='forest'||!f.continuous)continue;
    const line=[road.a,road.b];
    const key=[road.a.x,road.a.y,road.b.x,road.b.y].map(v=>Math.round(v*10)).join(',');
    if((f.grooves||[]).includes(key))continue;
    f.grooves=[...(f.grooves||[]),key];
    f.holes=[...(f.holes||[]),...corridorHolePolygons(line,FOREST_GROOVE_HALF)];
    carved=true;
  }
  if(carved){
    environmentRevision++;
    if(typeof clearForestLayoutCache==='function')clearForestLayoutCache();
    if(typeof invalidateSceneCache==='function')invalidateSceneCache('landscape');
  }
  return carved;
}
function pointInPolygon(point,pts){
  let inside=false;for(let i=0,j=pts.length-1;i<pts.length;j=i++){const a=pts[i],b=pts[j],hit=((a.y>point.y)!==(b.y>point.y))&&(point.x<(b.x-a.x)*(point.y-a.y)/((b.y-a.y)||1e-9)+a.x);if(hit)inside=!inside}return inside;
}
function environmentContains(f,p,pad=0){
  if(['forest','mountain','pond','sea'].includes(f.type)){
    if(!f.points?.length)return false;
    const bounds=environmentPolygonBounds(f.points);
    if(p.x<bounds.minX||p.x>bounds.maxX||p.y<bounds.minY||p.y>bounds.maxY)return false;
    if(!pointInPolygon(p,f.points))return false;
    return !forestHoleAt(f,p);
  }
  if(['hill','rough'].includes(f.type)){const ca=Math.cos(-(f.angle||0)),sa=Math.sin(-(f.angle||0)),dx=p.x-f.x,dy=p.y-f.y,x=dx*ca-dy*sa,y=dx*sa+dy*ca;return x*x/((f.rx+pad)*(f.rx+pad))+y*y/((f.ry+pad)*(f.ry+pad))<=1}
  if(['stream','river'].includes(f.type)){for(let i=0;i<f.points.length-1;i++)if(pointSegmentDistance(p,f.points[i],f.points[i+1])<=f.width/2+pad)return true}
  return false;
}
// Primary roads are allowed to carve woods and cross natural waterways.
function isPrimaryRoad(s){return s?.type==='road'&&(!!s.manualMain||s.roadClass==='arterial'||s.roadClass==='arterial-manual'||!!s.routeId&&String(s.routeId).startsWith('arterial-'))}
function primaryRoadCarvesPoint(p,extra=.62){
  return State.structures.some(s=>isPrimaryRoad(s)&&
    pointSegmentDistance(p,s.a,s.b)<=(Number(s.width)||.62)/2+extra);
}
function primaryRoadTerrainBlocked(p){
  // Primary roads have the same forest and slope exclusions as local paths,
  // except a continuous woodland (Foresta biome): there they cut a groove.
  // Rivers and streams are traversable only through their timber bridges.
  return environmentBlocksPoint(p,'primary');
}
function environmentBlocksPoint(p,mode='settlement'){
  const slope=terrainSlopeKind(p),primary=mode==='primary';
  if(primary)mode='road';
  // Main roads, arterial connections and road repairs must avoid all relief
  // bands, including gentle hill slopes (not just cliff/steep bands).
  if(mode==='road'&&slope)return true;
  if(mode==='settlement'&&slope)return true;
  for(const f of State.environment){
    if(primary&&f.type==='forest'&&f.continuous)continue;
    if(mode==='road'&&['sea','mountain','pond','forest','hill','rough'].includes(f.type)&&environmentContains(f,p,.45))return true;
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
  const v=t*WORLD;
  if(edge==='north')return{x:v,y:0};if(edge==='south')return{x:v,y:WORLD};if(edge==='west')return{x:0,y:v};return{x:WORLD,y:v};
}
function villageSeed(well){return (State.seed ^ Math.imul(Math.round(well.x*10),73856093) ^ Math.imul(Math.round(well.y*10),19349663))>>>0}
function rotPoint(cx,cy,x,y,a){const ca=Math.cos(a),sa=Math.sin(a);return{x:cx+x*ca-y*sa,y:cy+x*sa+y*ca}}
function roadList(completedOnly=false){return State.structures.filter(s=>s.type==='road'&&(!completedOnly||!underConstruction(s)))}
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
const BORDER_ENTRY_SIDES=['north','east','south','west'];
const BORDER_ENTRY_FRACTIONS=[.25,.50,.75];
const BORDER_ENTRY_BACKUP_FRACTIONS=Array.from({length:19},(_,i)=>(i+1)*.05);
const ROAD_PLAN_VERSION=3;
function borderEntryCandidates(){
  const out=[];
  for(const edge of BORDER_ENTRY_SIDES){
    BORDER_ENTRY_FRACTIONS.forEach((t,index)=>{
      const p=edgeSample(edge,t);
      out.push({id:`border-${edge}-${index}`,edge,index,t,x:p.x,y:p.y});
    });
  }
  return out;
}
function validBorderEntrySelection(entries){
  return Array.isArray(entries)&&entries.length===4&&BORDER_ENTRY_SIDES.every(edge=>
    entries.some(e=>e?.edge===edge&&(BORDER_ENTRY_FRACTIONS.includes(e.t)||BORDER_ENTRY_BACKUP_FRACTIONS.some(t=>Math.abs(t-e.t)<1e-6))&&
      dist(e,edgeSample(edge,e.t))<.001)
  );
}
function ensureBorderEntrySelection(){
  if(validBorderEntrySelection(State.village.borderEntries))return State.village.borderEntries;

  const all=borderEntryCandidates(),rnd=seedRand((State.seed^0x6d2b79f5)>>>0),selected=[];
  for(const edge of BORDER_ENTRY_SIDES){
    const options=all.filter(e=>e.edge===edge);
    const start=Math.floor(rnd()*options.length);
    const ordered=options.map((_,i)=>options[(start+i)%options.length]);
    // Main roads open a cut through woods and get wooden bridges over water.
    // Target selection should reject slopes/sea, not forest or river banks.
    let choice=ordered.find(e=>!primaryRoadTerrainBlocked(e));
    if(!choice){
      const base=ordered[0]?.t||.5;
      choice=BORDER_ENTRY_BACKUP_FRACTIONS.slice().sort((a,b)=>Math.abs(a-base)-Math.abs(b-base))
        .map((t,i)=>({id:'border-'+edge+'-alternate-'+i,edge,index:-1,t,...edgeSample(edge,t)}))
        .find(e=>!primaryRoadTerrainBlocked(e));
    }
    selected.push({...choice||ordered[0]});
  }
  State.village.borderEntries=selected;
  return selected;
}
function selectedBorderEntry(edge){
  return ensureBorderEntrySelection().find(e=>e.edge===edge)||null;
}
function ensureRoadPlan(){
  const well=State.structures.find(s=>s.id===State.village.wellId);if(!well)return[];
  const entries=ensureBorderEntrySelection();

  if(State.village.roadPlanVersion===ROAD_PLAN_VERSION&&Array.isArray(State.village.roadPlan)&&State.village.roadPlan.length===4){
    return State.village.roadPlan;
  }

  State.village.roadPlan=entries.map((entry,i)=>({
    id:'arterial-'+i,
    edge:entry.edge,
    entryId:entry.id,
    target:{x:entry.x,y:entry.y,edge:entry.edge},
    connected:false
  }));
  State.village.roadPlanVersion=ROAD_PLAN_VERSION;
  State.village.baseRoadAngle=Math.atan2(State.village.roadPlan[0].target.y-well.y,State.village.roadPlan[0].target.x-well.x);
  return State.village.roadPlan;
}
function connectSelectedBorderMainRoads(){
  // Synchronous helper for deterministic QA and explicit repair calls.
  // The real app uses connectBorderMainRoadsInFrames, including on reload.
  const well=State.structures.find(s=>s.id===State.village.wellId),plan=ensureRoadPlan();
  if(!well||plan.length!==4)return 0;
  let changed=0;
  for(const route of plan){
    if(mainRoadRouteDeleted(route.id))continue;
    route.planningToBorder=true;
    try{
      if(!arterialRouteContinuous(route.id))changed+=rebuildArterialRoute(route.id,[]);
      route.connected=arterialRouteContinuous(route.id);
    }finally{delete route.planningToBorder}
    window.__conquerAnalytics?.event('MAIN_ROAD_RESULT',{
      routeId:route.id,edge:route.edge,connected:route.connected,segments:routeRoads(route.id).length,
      mode:'sync'
    },route.connected?'info':'warn');
  }
  if(changed)invalidateNavigation(false);
  return changed;
}
let foundingRoadJob=null;
function connectBorderMainRoadsInFrames(onDone=()=>{}){
  const village=State.village,well=State.structures.find(s=>s.id===village.wellId);
  const plan=ensureRoadPlan();
  if(!well||plan.length!==4)return;
  const job={village};foundingRoadJob=job;
  const active=()=>foundingRoadJob===job&&State.village===village&&village.founded&&State.structures.includes(well);
  function* work(){
    let changed=0;
    for(const route of plan){
      if(!active())break;
      if(mainRoadRouteDeleted(route.id))continue;
      const t0=performance.now();
      let attempted=0;
      route.planningToBorder=true;
      try{
        while(active()&&!mainRoadRouteDeleted(route.id)&&!arterialRouteContinuous(route.id)){
          attempted++;
          const revision=navPerf.navInvalidations||0;
          const added=yield* rebuildArterialWork(route.id,[],()=>active()&&(navPerf.navInvalidations||0)===revision);
          changed+=added;
          if(added||(navPerf.navInvalidations||0)===revision)break;
          // A building changed the terrain while planning: recompute the route.
          yield;
        }
      }finally{
        if(active()){
          route.connected=arterialRouteContinuous(route.id);
          delete route.planningToBorder;
          window.__conquerAnalytics?.event('MAIN_ROAD_RESULT',{
            routeId:route.id,edge:route.edge,connected:route.connected,
            segments:routeRoads(route.id).length,attempted,
            elapsedMs:+(performance.now()-t0).toFixed(1),
            target:route.target
          },route.connected?'info':'warn');
        }
      }
      if(changed){markDirty(true,['ground','base']);draw()}
      yield;
    }
    return changed;
  }
  const iterator=work();
  function tick(){
    if(!active()){if(foundingRoadJob===job)foundingRoadJob=null;return}
    const deadline=performance.now()+6;
    let step;
    do{step=iterator.next()}while(!step.done&&performance.now()<deadline);
    if(step.done){foundingRoadJob=null;onDone(step.value);return}
    setTimeout(tick,0);
  }
  // Keep all initial and reloaded main-road routing off the input/load handler.
  setTimeout(tick,0);
}
// Road magnet on the two mouths of a gate: the road ends at the gate centre, after a straight
// approach along the passage, so roads drawn to either mouth meet inside and join up.
function gateRoadPort(p){
  let best=null;
  for(const gate of State.structures){
    if(gate.type!=='gate')continue;
    const info=gatePassageInfo(gate);if(!info)continue;
    const q=toLocalPoint(gate,p),d=rectDims(gate);
    for(const side of [-1,1]){
      const mouth={x:gate.x+info.ux*side*d.w/2,y:gate.y+info.uy*side*d.w/2};
      const inside=Math.abs(q.x)<=d.w/2&&Math.abs(q.y)<=d.h/2&&Math.sign(q.x||side)===side;
      const distance=inside?0:dist(p,mouth);
      if(distance>ROAD_RULES.snapNodeDistance||(best&&distance>=best.distance))continue;
      const reach=d.w/2+.75;
      best={gateId:gate.id,distance,center:{x:gate.x,y:gate.y},
        approach:{x:gate.x+info.ux*side*reach,y:gate.y+info.uy*side*reach}};
    }
  }
  return best;
}
// The legs of a manual road whose ends may sit on gate mouths: A, its approach, B's approach, B.
function manualRoadLegs(a,b,aPort=null,bPort=null){
  const pts=[a];
  if(aPort)pts.push(aPort.approach);
  if(bPort&&!(aPort&&aPort.gateId===bPort.gateId))pts.push(bPort.approach);
  pts.push(b);
  const legs=[];
  for(let i=0;i+1<pts.length;i++)if(dist(pts[i],pts[i+1])>.05)legs.push({a:{...pts[i]},b:{...pts[i+1]}});
  return legs;
}
function mainRoadSnapAnchor(p){
  const port=gateRoadPort(p);
  if(port)return{point:{...port.center},magnet:true,gatePort:port};
  let best={point:{x:snapGrid(p.x),y:snapGrid(p.y)},distance:Infinity};

  const consider=q=>{
    if(!q)return;
    const d=dist(p,q);
    if(d<=ROAD_RULES.snapNodeDistance&&d<best.distance)best={point:{x:q.x,y:q.y},distance:d};
  };

  for(const entry of ensureBorderEntrySelection())consider(entry);
  const well=State.structures.find(s=>s.id===State.village.wellId&&s.type==='well');
  if(well)consider(well);

  for(const road of roadList()){
    consider(road.a);consider(road.b);
    const q=closestPointOnSegment(p,road.a,road.b),d=dist(p,q);
    if(d<=ROAD_RULES.snapNodeDistance&&d<best.distance)best={point:q,distance:d};
  }
  return{point:best.point,magnet:Number.isFinite(best.distance)};
}
// Major roads cut through riverbeds on existing, selectable wooden decks.
function autoPrimaryRoadBridges(road){
  if(!isPrimaryRoad(road)||!road?.a||!road?.b)return 0;
  // Every main-road segment also opens its groove through a continuous woodland.
  carveForestGroove(road);
  if(State.structures.some(s=>s.type==='bridge'&&s.primaryBridgeFor===road.id))return 0;
  const water=State.environment.filter(f=>['river','stream'].includes(f.type));
  if(!water.length)return 0;
  const length=dist(road.a,road.b),steps=Math.max(3,Math.ceil(length/.20));
  const waterAt=p=>water.some(f=>f.points.slice(1).some((end,i)=>
    pointSegmentDistance(p,f.points[i],end)<=(Number(f.width)||1.25)/2+.07));
  let start=-1,index=0,created=0;
  function addSpan(from,to){
    if(to-from<.001)return;
    // Build over the local river normal, not along an oblique road segment.
    const midT=(from+to)/2,intersection={
      x:road.a.x+(road.b.x-road.a.x)*midT,
      y:road.a.y+(road.b.y-road.a.y)*midT
    };
    let closest=null,best=Infinity;
    for(const river of water)for(let i=1;i<river.points.length;i++){
      const p=river.points[i-1],q=river.points[i],distance=pointSegmentDistance(intersection,p,q);
      if(distance<best){best=distance;closest={river,p,q}}
    }
    if(!closest)return;
    const tx=closest.q.x-closest.p.x,ty=closest.q.y-closest.p.y,tLen=Math.hypot(tx,ty)||1;
    const nx=-ty/tLen,ny=tx/tLen;
    const riverHalf=(closest.river.width||1.25)/2+.48;
    const bankA={x:intersection.x-nx*riverHalf,y:intersection.y-ny*riverHalf};
    const bankB={x:intersection.x+nx*riverHalf,y:intersection.y+ny*riverHalf};
    // Projection onto the new bridge normal is the shortest legal span.
    if(!terrainSlopeKind(bankA)&&!terrainSlopeKind(bankB)){
      const za=terrainPlateauElevation(bankA),zb=terrainPlateauElevation(bankB);
      if(za!=null&&zb!=null&&Math.abs(za-zb)<=.01){
        State.structures.push({id:'river-bridge-'+road.id+'-'+index++,
          type:'bridge',auto:true,primaryBridgeFor:road.id,
          variant:'wood',a:bankA,b:bankB,
          width:Math.max(1.2,(road.width||.62)+.58),
          length:dist(bankA,bankB),groundZ:za,
          ...(road.construction?{construction:{...road.construction}}:{})});
        created++;return;
      }
    }

  }
  for(let i=0;i<=steps;i++){
    const t=i/steps,p={x:road.a.x+(road.b.x-road.a.x)*t,y:road.a.y+(road.b.y-road.a.y)*t};
    if(waterAt(p)){if(start<0)start=t}
    else if(start>=0){addSpan(start,(i-1)/steps);start=-1}
  }
  if(start>=0)addSpan(start,1);
  return created;
}
function syncPrimaryRoadBridges(){
  const activeRoads=new Set(State.structures.filter(isPrimaryRoad).map(r=>r.id));
  State.structures=State.structures.filter(s=>!s.primaryBridgeFor||activeRoads.has(s.primaryBridgeFor));
  let added=0;
  for(const road of State.structures.slice().filter(isPrimaryRoad))added+=autoPrimaryRoadBridges(road);
  if(added)invalidateSceneCache(['landscape','ground']);
  return added;
}
function perpendicularRiverRoadPath(a,b){
  // Real road geometry bends onto the shortest bank-to-bank normal.
  // This keeps the visual timber bridge aligned with the actual road route.
  const water=State.environment.filter(f=>f.type==='river'||f.type==='stream');
  let best=null;
  for(const river of water)for(let i=1;i<river.points.length;i++){
    const u=river.points[i-1],v=river.points[i],cross=segmentIntersectionPoint(a,b,u,v);
    if(!cross)continue;
    const t=dist(a,cross)/Math.max(.001,dist(a,b));
    if(t>.98||t<.02)continue;
    if(!best||t<best.t)best={river,u,v,cross,t};
  }
  if(!best)return[a,b];
  const dx=best.v.x-best.u.x,dy=best.v.y-best.u.y,l=Math.hypot(dx,dy)||1;
  let nx=-dy/l,ny=dx/l;
  if(nx*(b.x-a.x)+ny*(b.y-a.y)<0){nx=-nx;ny=-ny}
  const half=(best.river.width||1.25)/2+.48;
  const near={x:best.cross.x-nx*half,y:best.cross.y-ny*half};
  const far={x:best.cross.x+nx*half,y:best.cross.y+ny*half};
  if(![near,far].every(p=>p.x>=0&&p.x<=WORLD&&p.y>=0&&p.y<=WORLD&&!terrainSlopeKind(p)))return[a,b];
  if(dist(a,near)<.10||dist(far,b)<.10)return[a,b];
  // A perpendicular bridge is only valid when BOTH new approach bends also
  // avoid forest, hills and steep relief. Do not introduce forbidden slope
  // shortcuts into an otherwise valid pathfinding result.
  const clear=(u,v)=>{
    const steps=Math.max(2,Math.ceil(dist(u,v)/.09));
    for(let i=0;i<=steps;i++){
      const t=i/steps,p={x:u.x+(v.x-u.x)*t,y:u.y+(v.y-u.y)*t};
      if(environmentBlocksPoint(p,'road'))return false;
    }
    return true;
  };
  if(!clear(a,near)||!clear(near,far)||!clear(far,b))return[a,b];
  return[a,near,far,b];
}
function alignedRiverRoadPolyline(points){
  if(!points||points.length<2)return points||[];
  const route=[{...points[0]}];
  for(let i=1;i<points.length;i++){
    const segment=perpendicularRiverRoadPath(route.at(-1),points[i]);
    for(let j=1;j<segment.length;j++)
      if(dist(route.at(-1),segment[j])>.001)route.push({...segment[j]});
  }
  return route;
}
function addManualMainRoad(a,b){
  if(!a||!b)return false;
  const L=dist(a,b);if(L<TYPES.road.min-.001)return false;
  const id=uid(),road={
    id,type:'road',auto:false,manualMain:true,roadClass:'arterial-manual',
    routeId:'manual-main:'+id,routeSeq:0,
    a:{...a},b:{...b},length:L,width:TYPES.road.width,appeal:1
  };
  const verdict=window.ConquerPlacement?.check(road);
  if(verdict&&!verdict.ok){status('Road blocked: '+verdict.reason);return false}
  const points=perpendicularRiverRoadPath(road.a,road.b);
  let previous=null;
  for(let i=0;i<points.length-1;i++){
    const section=i===0?road:{...road,id:uid()};
    section.a={...points[i]};section.b={...points[i+1]};
    section.routeSeq=i;section.parentRoadId=previous?.id||null;
    section.length=dist(section.a,section.b);
    State.structures.push(section);autoPrimaryRoadBridges(section);
    previous=section;
  }
  invalidateSceneCache('landscape');
  invalidateNavigation(false);
  markDirty(false,['ground'],true);
  selectStructure(road);
  return true;
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
    if(mainRoadRouteDeleted(route.id))continue;
    if(routeRoads(route.id).length&&!arterialRouteContinuous(route.id))rebuildArterialRoute(route.id,[]);
  }
  const open=plan.filter(p=>!p.connected&&!mainRoadRouteDeleted(p.id));if(!open.length)return false;
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
  const points=perpendicularRiverRoadPath(road.a,road.b);
  let parent=road.parentRoadId,last=road;
  for(let i=0;i<points.length-1;i++){
    const segment=i===0?road:{...road,id:uid()};
    segment.a={...points[i]};segment.b={...points[i+1]};
    segment.routeSeq=existing.length+i;
    segment.parentRoadId=parent;
    segment.length=dist(segment.a,segment.b);
    State.structures.push(segment);
    autoPrimaryRoadBridges(segment);
    parent=segment.id;last=segment;
  }
  invalidateSceneCache('landscape');
  if(dist(last.b,target)<.35)route.connected=true;
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
  const plan=ensureRoadPlan(),incomplete=plan.some(p=>!p.connected&&!mainRoadRouteDeleted(p.id));
  if(incomplete)return spawnArterial(step);
  return spawnLocalRoad(step);
}
function spawnHouse(step){
  const well=State.structures.find(s=>s.id===State.village.wellId),roads=primaryRoadList(true);
  if(!well||!roads.length)return false;
  const rnd=growthRng(step,211),radius=currentGrowthRadius(),manual=State.structures.filter(s=>!s.auto),placed=autoList().filter(s=>s.type!=='road');
  // Fully generated main roads extend to the 200U world border. Sampling
  // every segment uniformly can exhaust all candidates outside the growth zone.
  const nearby=roads.filter(r=>pointSegmentDistance(well,r.a,r.b)<=radius+3.5);
  if(!nearby.length){
    window.__conquerAnalytics?.event('HOUSE_SPAWN_FAILURE',{step,reason:'no_nearby_main_road',roads:roads.length,radius},'warn');
    return false;
  }
  const lotContext=urbanHouseSpawnContext(),candidates=[];
  let outOfZone=0,blocked=0,invalidLot=0;
  for(let i=0;i<150;i++){
    const road=nearby[Math.floor(rnd()*nearby.length)],t=.10+rnd()*.80;
    const q={x:road.a.x+(road.b.x-road.a.x)*t,y:road.a.y+(road.b.y-road.a.y)*t};
    const ang=roadAngle(road),side=rnd()<.5?-1:1,offset=1.75+rnd()*1.55;
    const p={x:q.x-Math.sin(ang)*offset*side,y:q.y+Math.cos(ang)*offset*side};
    const d=dist(p,well);
    if(d>radius||d<1.7||!inBuild(p)||!window.ConquerCombat?.areaState(p).yellow){outOfZone++;continue}
    const core=Math.exp(-Math.pow(d-Math.min(6.5,radius*.62),2)/(2*3.0*3.0));
    const score=core*1.2+(1-offset/3)*.65+rnd()*.20;
    candidates.push({p,ang,score,roadId:road.id,doorSide:-side});
  }
  candidates.sort((a,b)=>b.score-a.score);
  for(const c of candidates.slice(0,48)){
    const houseAngle=snapStructureAngle(c.ang),h=beginConstruction({id:uid(),type:'house',auto:true,masonryMaterial:State.village.privateMasonryMaterial==='brick'?'brick':'stone',x:snapGrid(c.p.x),y:snapGrid(c.p.y),w:rnd()>.78?2:1.5,h:1,angle:houseAngle,rotationStep:structureRotationStep(houseAngle),appeal:c.score,roadId:c.roadId,doorSide:c.doorSide});
    if(autoBlocked(h,placed,manual,.38)||roadList().some(r=>manualRoadConflict(r,h))){blocked++;continue}
    if(!urbanHouseFitsLots(h,lotContext)){invalidLot++;continue}
    // Housing may reclaim an existing field (and its local access spur).
    urbanReclaimFieldsForHouse(h);
    State.structures.push(h);invalidateUrbanGeometry();ensureSettlementRoadAccess(h);
    window.__conquerAnalytics?.event('HOUSE_SPAWN_RESULT',{
      step,nearbyRoads:nearby.length,totalRoads:roads.length,candidates:candidates.length,
      outOfZone,blocked,invalidLot,houseId:h.id
    });
    return true;
  }
  window.__conquerAnalytics?.event('HOUSE_SPAWN_FAILURE',{
    step,reason:candidates.length?'parcel_or_occupancy':'no_zoned_candidates',
    nearbyRoads:nearby.length,totalRoads:roads.length,candidates:candidates.length,
    outOfZone,blocked,invalidLot,radius
  },'warn');
  return false;
}
function spawnField(step,workerHouse=null){
  const well=State.structures.find(s=>s.id===State.village.wellId),roads=primaryRoadList(true);
  const houses=State.structures.filter(s=>s.type==='house'&&!underConstruction(s));
  const reason=!well?'no_well':!roads.length?'no_main_roads':
    !workerHouse&&autoList('house').length<5?'under_five_houses':null;
  const source=workerHouse?'idle_L2':'village_growth';
  const fail=(reason,detail={})=>{
    window.__conquerAnalytics?.event('FIELD_SPAWN_FAILURE',{step,source,reason,...detail},'warn');
    return false;
  };
  if(reason)return fail(reason,{houses:houses.length,roads:roads.length});
  const rnd=growthRng(step,307+(workerHouse?peasantHash(workerHouse.id)%100000:0));
  const radius=currentGrowthRadius()+4,validationContext={occupants:null};
  const inner=Math.max(7,currentGrowthRadius()+1),outer=Math.min(42,Math.max(inner+9,radius+15)),candidates=[];
  const addCandidate=(p,score)=>{
    if(!inBuild(p)||window.ConquerCombat?.areaState(p).yellow||terrainPlateauElevation(p)!==0)return;
    const road=nearestRoadInfo(p,roads);
    if(!road||(workerHouse&&road.d>4.5))return;
    candidates.push({p,road,score:score+.18*Math.exp(-road.d/4)+rnd()*.20});
  };
  // Explore H0 in the white rural belt outside the yellow/green housing zone.
  for(let i=0;i<110;i++){
    const d=inner+rnd()*(outer-inner),th=rnd()*Math.PI*2;
    const p={x:well.x+Math.cos(th)*d,y:well.y+Math.sin(th)*d};
    const ring=Math.exp(-Math.pow(d-(inner+outer)*.5,2)/(2*4.2*4.2));
    addCandidate(p,ring);
  }
  // Main roads extend far beyond the village, so prioritise local segments.
  const localRoads=roads.filter(r=>pointSegmentDistance(well,r.a,r.b)<=radius+6);
  const sampleRoads=localRoads.length?localRoads:roads;
  for(let i=0;i<100;i++){
    const road=sampleRoads[Math.floor(rnd()*sampleRoads.length)];
    const t=.12+rnd()*.76,a=roadAngle(road),side=rnd()<.5?-1:1;
    const offset=3+rnd()*4.5;
    const p={
      x:road.a.x+(road.b.x-road.a.x)*t-Math.sin(a)*offset*side,
      y:road.a.y+(road.b.y-road.a.y)*t+Math.cos(a)*offset*side
    };
    if(dist(p,well)>Math.max(22,radius+19))continue;
    addCandidate(p,.8);
  }
  for(let i=0;i<70;i++){
    const h=houses[Math.floor(rnd()*houses.length)];
    if(!h)break;
    const a=rnd()*Math.PI*2,d=3+rnd()*4;
    addCandidate({x:h.x+Math.cos(a)*d,y:h.y+Math.sin(a)*d},.75);
  }
  // Idle L2 artisans first look for a nearby piece of land they can walk to.
  if(workerHouse)for(let i=0;i<110;i++){
    const a=rnd()*Math.PI*2,d=2.8+rnd()*6.5;
    const p={x:workerHouse.x+Math.cos(a)*d,y:workerHouse.y+Math.sin(a)*d};
    if(dist(p,well)>Math.max(22,radius+19))continue;
    addCandidate(p,1.12);
  }
  candidates.sort((a,b)=>b.score-a.score);
  let invalidQuad=0,blocked=0;
  for(const c of candidates.slice(0,workerHouse?60:36)){
    const f=beginConstruction({id:uid(),type:'field',auto:true,x:snapGrid(c.p.x),y:snapGrid(c.p.y),w:4.1+rnd()*1.4,h:3.6+rnd()*1.4,angle:c.road.angle+(rnd()-.5)*.18,appeal:c.score});
    // All rural fields may be larger; worker slots still scale as area/4.
    const workerLimit=workerHouse?rectWorldPoints(f.x,f.y,5.5,5.5,f.angle):null;
    f.points=fieldVoronoiQuad(f,rnd,workerLimit);
    if(!f.points){invalidQuad++;continue}
    f.fieldVersion=1;
    f.w=2*Math.max(...f.points.map(p=>Math.abs(p.x-f.x)));
    f.h=2*Math.max(...f.points.map(p=>Math.abs(p.y-f.y)));
    if(!fieldAllowed(f,validationContext)){blocked++;continue}
    if(workerHouse){
      // Opening farmland IS the ploughing job, not a separate building project.
      // The free L2 worker may start aratura on the very next simulation tick.
      delete f.construction;
      f.openedByL2=workerHouse.id;
    }
    State.structures.push(f);
    // L2-cleared fields are immediately active: their access track must be too.
    ensureSettlementRoadAccess(f,!!workerHouse);
    invalidateUrbanGeometry();
    window.__conquerAnalytics?.event('FIELD_SPAWN_RESULT',{
      step,source,fieldId:f.id,workerHouseId:workerHouse?.id||null,
      candidates:candidates.length,invalidQuad,blocked,area:+Math.abs(urbanArea(f.points)).toFixed(2)
    });
    return true;
  }
  return fail(candidates.length?'no_valid_parcel':'no_zoned_candidates',{
    candidates:candidates.length,invalidQuad,blocked,nearbyRoads:sampleRoads.length,houses:houses.length
  });
}
function processVillageGrowth(){
  if(!State.village.founded)return 0;
  // Housing must not wait for all four border arterials: a distant path can
  // take many frames (or be unreachable) while finished streets are usable.
  const planningBorderRoads=foundingRoadJob?.village===State.village;
  const well=State.structures.find(s=>s.id===State.village.wellId);if(!well||underConstruction(well))return 0;
  const analyticsT0=performance.now();
  ensureRoadPlan();
  // Preserve queued housing growth until the road builder has at least one
  // completed main street; avoid competing road repairs while it runs.
  if(planningBorderRoads&&!primaryRoadList(true).length)return 0;
  if(State.village.nextGrowthDay==null)State.village.nextGrowthDay=State.clock.day+.75;
  let guard=0,changed=0,processed=0;
  while(State.clock.day>=State.village.nextGrowthDay&&guard++<8){
    processed++;
    const step=State.village.growthStep||0,houses=autoList('house').length,roads=roadList().length,fields=autoList('field').length;
    let kind;
    if(planningBorderRoads)kind='house'; // The road builder owns main arteries.
    else if(roads===0)kind='road';
    else if(houses<2)kind='house';
    else{
      const rnd=growthRng(step,509)();
      if(houses>=5&&fields<Math.ceil(houses*.50))kind='field';
      else if(rnd<.38)kind='road';
      else kind='house';
    }
    const attempt=spawnKind=>{
      const t0=performance.now();
      const ok=spawnKind==='road'?spawnRoad(step):spawnKind==='field'?spawnField(step):spawnHouse(step);
      window.__conquerAnalytics?.measure('SPAWN_'+spawnKind.toUpperCase(),performance.now()-t0,{
        step,ok,houses,roads,fields,structures:State.structures.length
      });
      return ok;
    };
    let ok=attempt(kind);
    if(!ok&&kind!=='house')ok=attempt('house');
    // While four arterial routes are being built in the background, do not
    // launch competing route repairs from the growth pulse.
    if(!ok&&kind!=='road'&&!planningBorderRoads)ok=attempt('road');
    State.village.growthStep=step+1;
    State.village.nextGrowthDay+=GROWTH_INTERVAL_DAYS;
    if(ok){
      changed++;
      // New growth starts under construction and is rendered dynamically.
      // Do not rebuild static scene / route caches or synchronously persist here.
      markDirty(false,false,false);
    }
  }
  if(processed)window.__conquerAnalytics?.measure('GROWTH',performance.now()-analyticsT0,{
    processed,changed,structures:State.structures.length
  });
  return changed;
}
function resetLegacyVillageGrowth(){
  if(!State.village.founded||State.village.growthVersion===3)return;
  State.structures=State.structures.filter(s=>!s.auto);
  State.village.growthVersion=3;State.village.accessRoadVersion=0;State.village.growthStep=0;State.village.nextGrowthDay=State.clock.day+.75;State.village.roadPlan=null;State.village.roadPlanVersion=0;State.village.baseRoadAngle=null;
}
function openVillageModal(well){
  State.pendingWellId=well.id;const modal=document.getElementById('foundVillageModal'),input=document.getElementById('villageNameInput');
  modal.classList.add('open');input.value=State.village.name||'';setTimeout(()=>input.focus(),0);
}
function closeVillageModal(){document.getElementById('foundVillageModal').classList.remove('open');State.pendingWellId=null}

