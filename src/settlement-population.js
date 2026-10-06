'use strict';
// CONQUER settlement population module — classic-script shared runtime.
function peasantHash(id){return biomeHash(String(id||'peasant'))}
function completedSettlement(type){return State.structures.filter(s=>s.type===type&&!underConstruction(s))}
function peasantVisualDay(){return State.clock.day*PEASANT_VISUAL_SPEED}
function visualCycleDay(){return peasantVisualDay()}
function visualCycleFrac(){
  if(State.daylightOverride==='day')return VISUAL_DAYLIGHT_RATIO*.5;
  if(State.daylightOverride==='night')return VISUAL_DAYLIGHT_RATIO+(1-VISUAL_DAYLIGHT_RATIO)*.5;
  const d=visualCycleDay();return d-Math.floor(d)
}
function nightFactor(){
  const t=visualCycleFrac(),nightStart=VISUAL_DAYLIGHT_RATIO;
  const duskEnd=nightStart+VISUAL_TWILIGHT,dawnStart=1-VISUAL_TWILIGHT;
  if(t<nightStart)return 0;
  if(t<duskEnd)return clamp((t-nightStart)/VISUAL_TWILIGHT,0,1);
  if(t<dawnStart)return 1;
  return 1-clamp((t-dawnStart)/VISUAL_TWILIGHT,0,1);
}
function sunShadowState(){
  const t=visualCycleFrac();
  if(t<0||t>=VISUAL_DAYLIGHT_RATIO)return null;
  const phase=clamp(t/VISUAL_DAYLIGHT_RATIO,0,1);
  const arc=Math.max(0,Math.sin(Math.PI*phase));
  const edgeFade=clamp(arc*4,0,1);
  if(edgeFade<=.001)return null;

  // Visual sun path only: low sun = long/darker shadows, noon = short/lighter.
  const altitude=(12+58*arc)*Math.PI/180;
  const lengthPerHeight=clamp(1/Math.tan(altitude),.32,4.6);
  const angle=Math.PI/4+phase*Math.PI;
  const alpha=(.10+.15*(1-arc))*edgeFade;
  const softness=clamp(.8+1.8*(1-arc),.8,2.6);
  return{
    phase,arc,alpha,softness,lengthPerHeight,
    dx:Math.cos(angle),dy:Math.sin(angle)
  };
}
function towerRoofRise(s){
  if(!s||s.type!=='tower'||towerRoofStyle(s)!=='pitched')return 0;
  const span=s.shape==='round'?Number(s.r||.5)*2:Number(s.size||1);
  return s.shape==='round'
    ?clamp(span*.53,.54,1.04)
    :clamp(span*.45,.48,.92);
}
function towerVisualTopHeight(s){
  if(!s||s.type!=='tower')return structureHeight(s);
  return structureHeight(s)+towerRoofRise(s);
}
function towerRoofFootprintPoints(s){
  if(!s||s.type!=='tower')return[];
  const overhang=.07;
  if(s.shape==='round')return circleWorldPoints(s.x,s.y,Number(s.r||.5)+overhang,24);
  const d=rectDims(s);
  return rectWorldPoints(s.x,s.y,d.w+overhang*2,d.h+overhang*2,s.angle||0);
}
function gateRoofRise(s){
  if(!s||s.type!=='gate'||gateRoofStyle(s)!=='pitched')return 0;
  return .66;
}
function gateRoofGeometry(s){
  if(!s||s.type!=='gate'||gateRoofStyle(s)!=='pitched')return null;
  const d=rectDims(s),overhang=.08,h=structureHeight(s),rise=gateRoofRise(s);
  const hx=d.w/2+overhang,hy=d.h/2+overhang,ca=Math.cos(s.angle||0),sa=Math.sin(s.angle||0);
  const local=(x,y)=>({x:s.x+x*ca-y*sa,y:s.y+x*sa+y*ca});
  const c0=local(-hx,-hy),c1=local(hx,-hy),c2=local(hx,hy),c3=local(-hx,hy);
  const ridgeA=local(-hx,0),ridgeB=local(hx,0);
  return{h,ridgeH:h+rise,c0,c1,c2,c3,ridgeA,ridgeB,footprint:[c0,c1,c2,c3]};
}
function gateVisualTopHeight(s){
  if(!s||s.type!=='gate')return structureHeight(s);
  return structureHeight(s)+gateRoofRise(s);
}
function structureVisualTopHeight(s){
  if(s?.type==='tower')return towerVisualTopHeight(s);
  if(s?.type==='gate')return gateVisualTopHeight(s);
  return structureHeight(s);
}
function shadowStructureHeight(s){
  if(s?.type==='house')return houseStructureHeight(s);
  if(s?.type==='built'){const g=builtRoofGeometry(s);return g?.ridgeH||structureHeight(s)}
  if(s?.type==='tower'&&towerRoofStyle(s)==='pitched')return towerVisualTopHeight(s);
  if(s?.type==='gate'&&gateRoofStyle(s)==='pitched')return gateVisualTopHeight(s);
  return structureHeight(s);
}
function convexHull(points){
  if(points.length<=3)return points.slice();
  const pts=points.slice().sort((a,b)=>a.x===b.x?a.y-b.y:a.x-b.x);
  const cross=(o,a,b)=>(a.x-o.x)*(b.y-o.y)-(a.y-o.y)*(b.x-o.x);
  const lower=[];
  for(const p of pts){while(lower.length>=2&&cross(lower.at(-2),lower.at(-1),p)<=0)lower.pop();lower.push(p)}
  const upper=[];
  for(let i=pts.length-1;i>=0;i--){const p=pts[i];while(upper.length>=2&&cross(upper.at(-2),upper.at(-1),p)<=0)upper.pop();upper.push(p)}
  lower.pop();upper.pop();return lower.concat(upper);
}
function drawStructureShadow(s,sun){
  if(!s||underConstruction(s)||!['house','tower','gate','wall','built','market','tavern','church'].includes(s.type))return;
  const fp=isCastlePart(s)?unionFootprintPoints(s):footprintPoints(s);
  const h=shadowStructureHeight(s);
  if(!fp?.length||h<=0)return;
  const len=h*sun.lengthPerHeight;
  const ox=sun.dx*len,oy=sun.dy*len;
  const cloud=[];
  for(const p of fp){
    cloud.push(w2s(p,0));
    cloud.push(w2s({x:p.x+ox,y:p.y+oy},0));
  }
  const hull=convexHull(cloud);if(hull.length<3)return;
  ctx.save();
  ctx.filter='blur('+sun.softness.toFixed(2)+'px)';
  pathPolygon(hull,'rgba(4,5,7,'+sun.alpha.toFixed(3)+')',null);
  ctx.restore();
}
function drawDynamicShadows(){
  const sun=sunShadowState();if(!sun)return;
  const casters=State.structures.filter(s=>!underConstruction(s)&&['house','tower','gate','wall','built','market','tavern','church'].includes(s.type));
  for(const s of casters)drawStructureShadow(s,sun);
}
let fieldWorkAssignmentCache={key:null,map:new Map()};
function fieldWorkAssignments(houses,fields){
  const key=houses.map(h=>h.id).sort().join(',')+'|'+fields.map(f=>[f.id,f.x,f.y,f.w,f.h,f.angle].join(':')).sort().join(',');
  if(fieldWorkAssignmentCache.key===key)return fieldWorkAssignmentCache.map;

  const slots=[];
  for(const field of fields)for(const cell of fieldGrid(field).cells)slots.push({field,cell,used:false});
  const assignments=new Map(),ordered=houses.slice().sort((a,b)=>peasantHash(a.id)-peasantHash(b.id));
  for(const house of ordered){
    const door=houseDoorInfo(house).outside;let best=null,bestScore=Infinity;
    for(const slot of slots){
      if(slot.used)continue;
      const score=dist(door,slot.cell.world);
      if(score<bestScore){bestScore=score;best=slot}
    }
    if(best){best.used=true;assignments.set(house.id,{field:best.field,cell:best.cell})}
  }
  fieldWorkAssignmentCache={key,map:assignments};
  return assignments;
}

const PEASANT_PATH_STEP=.5,PEASANT_CLEARANCE=.22;
const PEASANT_ROAD_COST=.38,PEASANT_ROADSIDE_COST=.68,PEASANT_ROADSIDE_RANGE=.85;
let peasantPathCache=new Map(),peasantPathSignature='';
let roadNavGraphCache={dirty:true,nodes:new Map(),roads:[],version:0};
const navPerf={graphBuilds:0,graphRoutes:0,gridFallbacks:0,gridMisses:0};
window.__conquerPerf=navPerf;
function invalidateNavigation(hard=true){
  // New roads/houses only extend the topology: existing road-following paths
  // remain valid. Hard invalidation is reserved for moved/removed blockers or
  // rebuilt routes.
  roadNavGraphCache.dirty=true;
  if(!hard)return;
  peasantPathSignature='';
  peasantPathCache.clear();
}
function roadNavNodeKey(p){
  return (Math.round(p.x*100)/100).toFixed(2)+','+(Math.round(p.y*100)/100).toFixed(2);
}
function roadNavAddNode(nodes,p){
  const key=roadNavNodeKey(p);
  if(!nodes.has(key))nodes.set(key,{key,p:{x:Number(p.x),y:Number(p.y)},edges:new Map()});
  return nodes.get(key);
}
function roadNavConnect(a,b,cost){
  if(!a||!b||a.key===b.key)return;
  const prevA=a.edges.get(b.key),prevB=b.edges.get(a.key);
  if(prevA==null||cost<prevA)a.edges.set(b.key,cost);
  if(prevB==null||cost<prevB)b.edges.set(a.key,cost);
}
function rebuildRoadNavGraph(){
  const roads=roadList(true).filter(r=>r.a&&r.b&&dist(r.a,r.b)>.05);
  const nodes=new Map(),split=roads.map(r=>({road:r,pts:[{t:0,p:{...r.a}},{t:1,p:{...r.b}}]}));

  // Access spurs commonly terminate in the middle of a primary segment.
  // Insert every nearby road endpoint as a split node on that segment.
  for(let i=0;i<roads.length;i++){
    const r=roads[i],dx=r.b.x-r.a.x,dy=r.b.y-r.a.y,L2=dx*dx+dy*dy||1;
    for(let j=0;j<roads.length;j++){
      if(i===j)continue;
      for(const p of [roads[j].a,roads[j].b]){
        if(pointSegmentDistance(p,r.a,r.b)>.08)continue;
        const t=clamp(((p.x-r.a.x)*dx+(p.y-r.a.y)*dy)/L2,0,1);
        if(t>.0001&&t<.9999)split[i].pts.push({t,p:{x:r.a.x+dx*t,y:r.a.y+dy*t}});
      }
    }
  }

  // True road crossings are graph junctions too.
  for(let i=0;i<roads.length;i++)for(let j=i+1;j<roads.length;j++){
    const p=segmentIntersectionPoint(roads[i].a,roads[i].b,roads[j].a,roads[j].b);
    if(!p)continue;
    for(const k of [i,j]){
      const r=roads[k],dx=r.b.x-r.a.x,dy=r.b.y-r.a.y,L2=dx*dx+dy*dy||1;
      const t=clamp(((p.x-r.a.x)*dx+(p.y-r.a.y)*dy)/L2,0,1);
      split[k].pts.push({t,p:{...p}});
    }
  }

  for(const item of split){
    item.pts.sort((a,b)=>a.t-b.t);
    const clean=[];
    for(const q of item.pts){
      if(!clean.length||Math.abs(q.t-clean.at(-1).t)>.002)clean.push(q);
    }
    item.nodes=clean.map(q=>({t:q.t,node:roadNavAddNode(nodes,q.p)}));
    for(let i=0;i<item.nodes.length-1;i++){
      const a=item.nodes[i].node,b=item.nodes[i+1].node;
      roadNavConnect(a,b,dist(a.p,b.p));
    }
  }

  roadNavGraphCache={dirty:false,nodes,roads:split,version:roadNavGraphCache.version+1};
  navPerf.graphBuilds++;
  return roadNavGraphCache;
}
function roadNavGraph(){
  return roadNavGraphCache.dirty?rebuildRoadNavGraph():roadNavGraphCache;
}
function nearestRoadNavAnchor(p){
  const graph=roadNavGraph();let best=null,bestD=Infinity;
  for(const item of graph.roads){
    const r=item.road,q=closestPointOnSegment(p,r.a,r.b),d=dist(p,q);
    if(d>=bestD)continue;
    const dx=r.b.x-r.a.x,dy=r.b.y-r.a.y,L2=dx*dx+dy*dy||1;
    const t=clamp(((q.x-r.a.x)*dx+(q.y-r.a.y)*dy)/L2,0,1);
    let left=item.nodes[0],right=item.nodes.at(-1);
    for(let i=0;i<item.nodes.length-1;i++){
      if(t>=item.nodes[i].t-.0001&&t<=item.nodes[i+1].t+.0001){
        left=item.nodes[i];right=item.nodes[i+1];break;
      }
    }
    best={item,point:q,t,d,left,right};
    bestD=d;
  }
  return best;
}
class RoadNavHeap{
  constructor(){this.a=[]}
  push(n){const a=this.a;a.push(n);let i=a.length-1;while(i>0){const p=(i-1)>>1;if(a[p].d<=n.d)break;a[i]=a[p];i=p}a[i]=n}
  pop(){const a=this.a;if(!a.length)return null;const root=a[0],last=a.pop();if(a.length){let i=0;while(true){let l=i*2+1,r=l+1;if(l>=a.length)break;let m=r<a.length&&a[r].d<a[l].d?r:l;if(a[m].d>=last.d)break;a[i]=a[m];i=m}a[i]=last}return root}
  get length(){return this.a.length}
}
function roadNetworkPath(start,goal,sourceHouseId){
  const graph=roadNavGraph();if(!graph.nodes.size)return null;
  const a=nearestRoadNavAnchor(start),b=nearestRoadNavAnchor(goal);
  if(!a||!b||a.d>4.5||b.d>4.5)return null;

  // Short connectors from doors/plazas/field cells to the road are validated
  // against the physical obstacle map.
  if(dist(start,a.point)>.03&&!peasantSegmentClear(start,a.point,sourceHouseId))return null;
  if(dist(b.point,goal)>.03&&!peasantSegmentClear(b.point,goal,sourceHouseId))return null;

  const seeds=[],goals=new Map();
  for(const q of [a.left,a.right]){
    if(!q?.node)continue;
    seeds.push({key:q.node.key,d:dist(a.point,q.node.p)});
  }
  for(const q of [b.left,b.right]){
    if(!q?.node)continue;
    goals.set(q.node.key,dist(b.point,q.node.p));
  }

  // Same-road direct travel avoids unnecessary graph work.
  if(a.item===b.item){
    const direct=[start,a.point,b.point,goal].filter((p,i,arr)=>i===0||dist(p,arr[i-1])>.02);
    navPerf.graphRoutes++;
    return direct;
  }

  const heap=new RoadNavHeap(),dScore=new Map(),came=new Map();
  for(const s of seeds){
    const prev=dScore.get(s.key);
    if(prev==null||s.d<prev){dScore.set(s.key,s.d);heap.push({key:s.key,d:s.d})}
  }
  let endKey=null,endCost=Infinity,guard=0;
  while(heap.length&&guard++<12000){
    const cur=heap.pop();
    if(cur.d!==(dScore.get(cur.key)??Infinity))continue;
    const goalTail=goals.get(cur.key);
    if(goalTail!=null&&cur.d+goalTail<endCost){endCost=cur.d+goalTail;endKey=cur.key}
    if(cur.d>=endCost)break;
    const node=graph.nodes.get(cur.key);if(!node)continue;
    for(const [nextKey,w] of node.edges){
      const nd=cur.d+w;
      if(nd<(dScore.get(nextKey)??Infinity)){
        dScore.set(nextKey,nd);came.set(nextKey,cur.key);heap.push({key:nextKey,d:nd});
      }
    }
  }
  if(!endKey)return null;

  const rev=[];let k=endKey;
  while(k){const node=graph.nodes.get(k);if(node)rev.push(node.p);k=came.get(k)}
  rev.reverse();
  const out=[start,a.point,...rev,b.point,goal],clean=[];
  for(const p of out)if(p&&(!clean.length||dist(p,clean.at(-1))>.02))clean.push(p);
  navPerf.graphRoutes++;
  return clean;
}
function peasantObstacleSignature(){
  return State.structures.filter(s=>['house','tower','gate','wall','built','well','road','market','tavern','church','training'].includes(s.type)).map(s=>{
    if(['wall','built','road'].includes(s.type))return [s.id,s.type,s.a.x,s.a.y,s.b.x,s.b.y,s.width,JSON.stringify(s.functions||[]),underConstruction(s)?1:0].join(',');
    return [s.id,s.type,s.x,s.y,s.w,s.h,s.r,s.size,s.angle,s.houseLevel,JSON.stringify(s.functions||[]),underConstruction(s)?1:0].join(',');
  }).join('|');
}
function syncPeasantPathCache(){
  // Topology mutations explicitly reset peasantPathSignature to ''. Avoid
  // serializing every obstacle again for every resident/path lookup.
  if(peasantPathSignature)return;
  peasantPathSignature=peasantObstacleSignature()||'empty';
  peasantPathCache.clear();
}
function pointBlockedForPeasant(p,sourceHouseId){
  if(terrainSlopeKind(p)==='steep')return true;
  for(const s of State.structures){
    if(s.id===sourceHouseId)continue;
    if(!['house','tower','gate','wall','built','well','market','tavern','church','training'].includes(s.type))continue;

    // Market ground and the actual castle gate passage are traversable.
    if(s.type==='market')continue;
    if(s.type==='gate'){
      if(gatePointInPassage(s,p,.08))continue;
      const q=toLocalPoint(s,p),d=rectDims(s);
      if(Math.abs(q.x)<=d.w/2+PEASANT_CLEARANCE&&Math.abs(q.y)<=d.h/2+PEASANT_CLEARANCE)return true;
      continue;
    }

    if(['wall','built'].includes(s.type)){
      if(pointSegmentDistance(p,s.a,s.b)<=Number(s.width)/2+PEASANT_CLEARANCE)return true;
      continue;
    }
    if(s.type==='well'){if(dist(p,s)<=.62+PEASANT_CLEARANCE)return true;continue}
    if(s.type==='tower'&&s.shape==='round'){if(dist(p,s)<=s.r+PEASANT_CLEARANCE)return true;continue}
    if(s.type==='house'||isCivic(s)){
      const parts=s.type==='house'?houseFootprintParts(s):civicParts(s);
      for(const part of parts){
        if(pointInPolygon(p,part.points))return true;
        for(let i=0;i<part.points.length;i++){const j=(i+1)%part.points.length;if(pointSegmentDistance(p,part.points[i],part.points[j])<=PEASANT_CLEARANCE)return true}
      }
      continue;
    }
    const q=toLocalPoint(s,p),d=rectDims(s);
    if(Math.abs(q.x)<=d.w/2+PEASANT_CLEARANCE&&Math.abs(q.y)<=d.h/2+PEASANT_CLEARANCE)return true;
  }
  return false;
}
function peasantRoadDistance(p){
  let best=Infinity,width=0;
  for(const road of roadList(true)){
    const d=pointSegmentDistance(p,road.a,road.b);
    if(d<best){best=d;width=Number(road.width)||.3}
  }
  return{d:best,width};
}
function peasantTerrainCost(p){
  const road=peasantRoadDistance(p);
  if(!Number.isFinite(road.d))return 1;
  const edge=Math.max(.10,road.width/2);
  if(road.d<=edge+.18)return PEASANT_ROAD_COST;
  if(road.d<=edge+PEASANT_ROADSIDE_RANGE)return PEASANT_ROADSIDE_COST;
  return 1;
}
function peasantSegmentTravelCost(a,b){
  const L=dist(a,b);if(L<=1e-6)return 0;
  const steps=Math.max(2,Math.ceil(L/.25));let sum=0;
  for(let i=0;i<steps;i++){
    const t=(i+.5)/steps,p={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};
    sum+=peasantTerrainCost(p);
  }
  return L*sum/steps;
}
function peasantSegmentClear(a,b,sourceHouseId){
  const L=dist(a,b),steps=Math.max(2,Math.ceil(L/.22));
  for(let i=1;i<steps;i++){const t=i/steps,p={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};if(pointBlockedForPeasant(p,sourceHouseId))return false}
  return true;
}
function smoothPeasantPath(points,sourceHouseId){
  if(points.length<=2)return points;
  const prefix=[0];
  for(let i=0;i<points.length-1;i++)prefix.push(prefix.at(-1)+peasantSegmentTravelCost(points[i],points[i+1]));
  const out=[points[0]];let i=0;
  while(i<points.length-1){
    let chosen=i+1;
    for(let j=points.length-1;j>i+1;j--){
      if(!peasantSegmentClear(points[i],points[j],sourceHouseId))continue;
      const originalCost=prefix[j]-prefix[i],shortcutCost=peasantSegmentTravelCost(points[i],points[j]);
      // Only simplify if the shortcut preserves the road preference found by A*.
      if(shortcutCost<=originalCost*1.06){chosen=j;break}
    }
    out.push(points[chosen]);i=chosen;
  }
  return out;
}
class PeasantMinHeap{
  constructor(){this.a=[]}
  push(n){const a=this.a;a.push(n);let i=a.length-1;while(i>0){const p=(i-1)>>1;if(a[p].f<=n.f)break;a[i]=a[p];i=p}a[i]=n}
  pop(){const a=this.a;if(!a.length)return null;const root=a[0],last=a.pop();if(a.length){let i=0;while(true){let l=i*2+1,r=l+1;if(l>=a.length)break;let m=r<a.length&&a[r].f<a[l].f?r:l;if(a[m].f>=last.f)break;a[i]=a[m];i=m}a[i]=last}return root}
  get length(){return this.a.length}
}
function findPeasantPath(start,goal,sourceHouseId,pad=8){
  const step=PEASANT_PATH_STEP;
  const minX=Math.floor((Math.min(start.x,goal.x)-pad)/step),maxX=Math.ceil((Math.max(start.x,goal.x)+pad)/step);
  const minY=Math.floor((Math.min(start.y,goal.y)-pad)/step),maxY=Math.ceil((Math.max(start.y,goal.y)+pad)/step);
  const key=(x,y)=>x+','+y,pos=(x,y)=>({x:x*step,y:y*step});
  function nearestFree(p){
    const cx=Math.round(p.x/step),cy=Math.round(p.y/step);let best=null,bestD=Infinity;
    for(let r=0;r<=4;r++)for(let dx=-r;dx<=r;dx++)for(let dy=-r;dy<=r;dy++){
      if(Math.max(Math.abs(dx),Math.abs(dy))!==r)continue;
      const x=cx+dx,y=cy+dy,q=pos(x,y);if(x<minX||x>maxX||y<minY||y>maxY||pointBlockedForPeasant(q,sourceHouseId))continue;
      if(!peasantSegmentClear(p,q,sourceHouseId))continue;
      const d=dist(p,q);if(d<bestD){best={x,y,q};bestD=d}
    }
    return best;
  }
  const s=nearestFree(start),g=nearestFree(goal);if(!s||!g)return null;
  const open=new PeasantMinHeap(),gScore=new Map([[key(s.x,s.y),0]]),came=new Map(),closed=new Set();
  open.push({x:s.x,y:s.y,f:dist(s.q,g.q)*PEASANT_ROAD_COST});
  const dirs=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
  let found=null,guard=0;
  while(open.length&&guard++<30000){
    const cur=open.pop(),ck=key(cur.x,cur.y);if(closed.has(ck))continue;closed.add(ck);
    if(cur.x===g.x&&cur.y===g.y){found=cur;break}
    for(const [dx,dy] of dirs){
      const nx=cur.x+dx,ny=cur.y+dy;if(nx<minX||nx>maxX||ny<minY||ny>maxY)continue;
      const nk=key(nx,ny),q=pos(nx,ny);if(closed.has(nk)||pointBlockedForPeasant(q,sourceHouseId))continue;
      if(dx&&dy){
        const q1=pos(cur.x+dx,cur.y),q2=pos(cur.x,cur.y+dy);
        if(pointBlockedForPeasant(q1,sourceHouseId)||pointBlockedForPeasant(q2,sourceHouseId))continue;
      }
      const baseStep=Math.hypot(dx,dy)*step;
      const from=pos(cur.x,cur.y),moveCost=baseStep*(peasantTerrainCost(from)+peasantTerrainCost(q))*.5;
      const tentative=(gScore.get(ck)??Infinity)+moveCost;
      if(tentative<(gScore.get(nk)??Infinity)){
        gScore.set(nk,tentative);came.set(nk,ck);
        // Minimum terrain multiplier keeps the heuristic admissible while roads remain attractive.
        open.push({x:nx,y:ny,f:tentative+dist(q,g.q)*PEASANT_ROAD_COST});
      }
    }
  }
  if(!found)return null;
  const rev=[],startKey=key(s.x,s.y);let k=key(g.x,g.y);
  while(true){const [x,y]=k.split(',').map(Number);rev.push(pos(x,y));if(k===startKey)break;k=came.get(k);if(!k)return null}
  rev.reverse();return smoothPeasantPath([start,...rev,goal],sourceHouseId);
}
function peasantPath(house,assignment){
  syncPeasantPathCache();
  const field=assignment.field,cell=assignment.cell,key=house.id+'>'+field.id+':'+cell.index;
  if(peasantPathCache.has(key))return peasantPathCache.get(key);
  const start=houseDoorInfo(house).outside,goal={...cell.world};
  let path=roadNetworkPath(start,goal,house.id);
  if(!path){
    navPerf.gridFallbacks++;
    path=findPeasantPath(start,goal,house.id,8);
    if(!path)path=findPeasantPath(start,goal,house.id,14);
  }
  if(!path){navPerf.gridMisses++;path=[start]}
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
    // Rare fallback: target a deterministic point on the safe perimeter.
    const angle=Math.atan2(start.y-center.y,start.x-center.x);
    const goal={
      x:center.x+Math.cos(angle)*(.62+PEASANT_CLEARANCE+.18),
      y:center.y+Math.sin(angle)*(.62+PEASANT_CLEARANCE+.18)
    };
    navPerf.wellGridFallbacks=(navPerf.wellGridFallbacks||0)+1;
    path=findPeasantPath(start,goal,house.id,8);
    if(!path)path=findPeasantPath(start,goal,house.id,14);
    if(!path)path=[start,goal];
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
  const key='routine:'+house.id+':'+tag+':'+start.x.toFixed(2)+','+start.y.toFixed(2)+'>'+goal.x.toFixed(2)+','+goal.y.toFixed(2);
  if(peasantPathCache.has(key))return peasantPathCache.get(key);
  let path=roadNetworkPath(start,goal,house.id);
  if(!path&&peasantSegmentClear(start,goal,house.id))path=[start,goal];
  if(!path){
    navPerf.gridFallbacks++;
    path=findPeasantPath(start,goal,house.id,8);
    if(!path)path=findPeasantPath(start,goal,house.id,14);
  }
  if(!path){navPerf.gridMisses++;path=[start]}
  peasantPathCache.set(key,path);
  return path;
}
function routineSmooth(t){t=clamp(t,0,1);return t*t*(3-2*t)}
function routineTravel(house,start,goal,frac,t0,t1,tag){
  const path=villagerPathBetween(house,start,goal,tag);
  return pointAlongPath(path,routineSmooth((frac-t0)/Math.max(.001,t1-t0)));
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
  if(frac<leaveWork)return primary.point;
  if(secondary){
    if(frac<arriveSecond)return routineTravel(house,primary.point,secondary.point,frac,leaveWork,arriveSecond,'artisan-work-market');
    if(frac<leaveSecond)return secondary.point;
    return routineTravel(house,secondary.point,home,frac,leaveSecond,homeAt,'artisan-market-home');
  }
  if(frac<leaveSecond)return primary.point;
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
  if(frac<leaveFirst)return first.point;
  if(second){
    if(frac<arriveSecond)return routineTravel(house,first.point,second.point,frac,leaveFirst,arriveSecond,'merchant-market-tavern');
    if(frac<leaveSecond)return second.point;
    return routineTravel(house,second.point,home,frac,leaveSecond,homeAt,'merchant-tavern-home');
  }
  if(frac<leaveSecond)return first.point;
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
  if(frac<t2)return a;
  if(frac<t3)return routineTravel(house,a,b,frac,t2,t3,'elite-a-b');
  if(frac<t4)return b;
  if(frac<t5)return routineTravel(house,b,d,frac,t4,t5,'elite-b-c');
  if(frac<t6)return d;
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
  const h=peasantHash(house.id),frac=day-Math.floor(day),stagger=(((h>>>8)%1000)/1000-.5)*.025;
  const leave0=.06+stagger,leave1=.14+stagger,return0=.52+stagger,return1=.62+stagger;
  if(frac<leave0||frac>return1)return null;
  const path=peasantPath(house,assignment),work=assignment.cell.world;
  const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t)};
  if(frac<leave1)return pointAlongPath(path,smooth((frac-leave0)/(leave1-leave0)));
  if(frac<return0)return{x:work.x,y:work.y};
  return pointAlongPath(path,1-smooth((frac-return0)/(return1-return0)));
}
function peasantAnimationActive(){
  const day=peasantVisualDay(),frac=day-Math.floor(day);
  return frac>=.035&&frac<=.67&&completedSettlement('house').length>0;
}
function housePopulationCapacity(house){
  const level=houseLevel(house);
  return{male:level,female:level,children:level*2,total:level*4};
}
function houseResidents(house){
  const cap=housePopulationCapacity(house),out=[];
  for(let i=0;i<cap.male;i++)out.push({id:house.id+':m:'+i,sex:'male',age:'adult',index:i});
  for(let i=0;i<cap.female;i++)out.push({id:house.id+':f:'+i,sex:'female',age:'adult',index:i});
  for(let i=0;i<cap.children;i++){
    const id=house.id+':c:'+i;
    out.push({id,sex:(peasantHash(id)&1)?'female':'male',age:'child',index:i});
  }
  return out;
}
const VISIBLE_RESIDENTS_BY_LEVEL=Object.freeze({1:2,2:3,3:4,4:5});
function houseVisibleResidents(house){
  const all=houseResidents(house),level=houseLevel(house),limit=VISIBLE_RESIDENTS_BY_LEVEL[level]||2;
  if(all.length<=limit)return all;

  const males=all.filter(r=>r.age==='adult'&&r.sex==='male');
  const females=all.filter(r=>r.age==='adult'&&r.sex==='female');
  const children=all.filter(r=>r.age==='child');
  const out=[],used=new Set(),flip=(peasantHash(house.id+'-visible-sex')&1)!==0;

  const take=r=>{if(r&&!used.has(r.id)&&out.length<limit){used.add(r.id);out.push(r)}};

  // Small houses show one adult + one child; across houses the adult sex alternates.
  // Larger houses add the other adult first, then fill deterministically.
  take(flip?females[0]:males[0]);
  take(children[0]);
  if(limit>=3)take(flip?males[0]:females[0]);
  if(limit>=4)take(children[1]||males[1]||females[1]);
  if(limit>=5)take(males[1]||females[1]||children[2]);

  if(out.length<limit){
    const rest=all
      .filter(r=>!used.has(r.id))
      .sort((a,b)=>peasantHash(a.id+'-visible')-peasantHash(b.id+'-visible'));
    for(const r of rest){take(r);if(out.length>=limit)break}
  }
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
    if(frac<leave)return dest;
    return wellRoutineTravel(house,target,frac,leave,homeAt,true);
  }

  const dest=structureAccessPoint(target,home,house.id+'-family');
  if(frac<arrive)return routineTravel(house,home,dest,frac,leave0,arrive,'family-out');
  if(frac<leave)return dest;
  return routineTravel(house,dest,home,frac,leave,homeAt,'family-home');
}
function residentClassPosition(house,resident,day,assignment){
  const level=houseLevel(house),shiftedDay=day+residentTimeOffset(resident.id);
  if(resident.age==='child')return familyPosition(house,shiftedDay);
  if(resident.sex==='female'&&level===1)return familyPosition(house,shiftedDay);
  if(level===1)return assignment?peasantPosition(house,assignment,shiftedDay):null;
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
function bodyPath(kind,x,y,w,h){
  ctx.beginPath();
  if(kind==='peasant'){
    ctx.moveTo(x,y-h/2);ctx.lineTo(x+w/2,y+h/2);ctx.lineTo(x-w/2,y+h/2);ctx.closePath();
  }else if(kind==='artisan'){
    ctx.rect(x-w/2,y-h/2,w,h);
  }else if(kind==='merchant'){
    ctx.ellipse(x,y,w/2,h/2,0,0,Math.PI*2);
  }else{
    const r=Math.min(w,h)/2;ctx.arc(x,y,r,0,Math.PI*2);
  }
}
function drawSplitVillagerBody(kind,x,y,w,h,topColor,bottomColor){
  ctx.save();
  bodyPath(kind,x,y,w,h);ctx.clip();
  ctx.fillStyle=topColor;ctx.fillRect(x-w,y-h,x+w*2,h);
  ctx.fillStyle=bottomColor;ctx.fillRect(x-w,y,x+w*2,h);
  ctx.restore();

  bodyPath(kind,x,y,w,h);
  ctx.strokeStyle='rgba(33,24,16,.82)';ctx.lineWidth=Math.max(.7,w*.11);ctx.stroke();

  ctx.save();bodyPath(kind,x,y,w,h);ctx.clip();
  ctx.strokeStyle='rgba(33,24,16,.42)';ctx.lineWidth=Math.max(.55,w*.075);
  ctx.beginPath();ctx.moveTo(x-w/2,y);ctx.lineTo(x+w/2,y);ctx.stroke();
  ctx.restore();
}
function drawVillagerHead(id,x,y,r,sex='male'){
  const hair=villagerHair(id);
  ctx.save();
  ctx.fillStyle=VILLAGER_SKIN;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();

  if(hair!=='bald'){
    const hc=HAIR_COLORS[hair];
    ctx.beginPath();ctx.arc(x,y,r,Math.PI,Math.PI*2);ctx.lineTo(x-r,y);ctx.closePath();
    ctx.fillStyle=hc;ctx.fill();

    // Female adults/girls keep the same deterministic hair colour but get visible side locks.
    if(sex==='female'){
      ctx.fillStyle=hc;
      ctx.beginPath();ctx.ellipse(x-r*.72,y+r*.48,r*.34,r*.80,0,0,Math.PI*2);ctx.fill();
      ctx.beginPath();ctx.ellipse(x+r*.72,y+r*.48,r*.34,r*.80,0,0,Math.PI*2);ctx.fill();
    }
  }

  ctx.strokeStyle='rgba(67,42,30,.80)';ctx.lineWidth=Math.max(.65,r*.20);
  ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.stroke();
  ctx.restore();
}
function drawVillagerFigure(dot){
  const base=w2s(dot.p,.10),scale=clamp(State.view.scale,.55,1.45);
  const kind=dot.kind,sizeFactor=dot.age==='child'?.5:1;
  const bodyW=clamp(6.0*scale,4.2,8.2)*sizeFactor,bodyH=clamp(8.0*scale,5.5,10.6)*sizeFactor;
  const headR=clamp(2.35*scale,1.8,3.15)*sizeFactor,bodyY=base.y-bodyH*.16;
  drawSplitVillagerBody(kind,base.x,bodyY,bodyW,bodyH,dot.colors[0],dot.colors[1]);
  drawVillagerHead(dot.id,base.x,bodyY-bodyH/2-headR*.68,headR,dot.sex);
}
function worldPointVisible(p,z=0,pad=48){
  if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y))return false;
  const s=w2s(p,z),r=wrap.getBoundingClientRect();
  return s.x>=-pad&&s.y>=-pad&&s.x<=r.width+pad&&s.y<=r.height+pad;
}
function drawPeasants(){
  const houses=completedSettlement('house'),fields=completedSettlement('field');
  if(!houses.length)return;
  const day=peasantVisualDay(),dots=[];
  let representedPopulation=0,activeAgents=0;
  const peasantHouses=houses.filter(h=>houseLevel(h)===1);
  const assignments=fieldWorkAssignments(peasantHouses,fields);

  for(const house of houses){
    representedPopulation+=housePopulationCapacity(house).total;
    const kind=villagerClass(house),assignment=assignments.get(house.id);
    for(const resident of houseVisibleResidents(house)){
      let p=residentClassPosition(house,resident,day,assignment);
      if(!p)continue;
      p=residentScatter(p,resident.id,resident.age==='child');
      if(!worldPointVisible(p,0,40))continue;
      dots.push({
        p,id:resident.id,kind,sex:resident.sex,age:resident.age,
        colors:villagerBodyColors(resident.id,kind)
      });
      activeAgents++;
    }
  }
  dots.sort((a,b)=>{const aa=rotateViewPoint(a.p),bb=rotateViewPoint(b.p);return aa.x+aa.y-(bb.x+bb.y)});
  if(window.__conquerPerf){
    window.__conquerPerf.representedPopulation=representedPopulation;
    window.__conquerPerf.visibleVillagers=activeAgents;
  }
  for(const dot of dots)drawVillagerFigure(dot);
}
function militaryScale(){
  return clamp(State.view.scale,.55,1.45);
}
function soldierLivery(id){
  const flip=(peasantHash(String(id)+'-livery')&1)!==0;
  return flip
    ?{main:REIGN_COLOR_2,alt:REIGN_COLOR_1,mainDark:REIGN_COLOR_2_DARK,altDark:REIGN_COLOR_1_DARK}
    :{main:REIGN_COLOR_1,alt:REIGN_COLOR_2,mainDark:REIGN_COLOR_1_DARK,altDark:REIGN_COLOR_2_DARK};
}
function soldierBodyPath(base,bodyW,bodyH,top,bodyY){
  ctx.beginPath();
  ctx.moveTo(base.x-bodyW*.42,top);ctx.lineTo(base.x+bodyW*.42,top);
  ctx.lineTo(base.x+bodyW*.50,bodyY+bodyH*.50);ctx.lineTo(base.x-bodyW*.50,bodyY+bodyH*.50);ctx.closePath();
}
function drawQuarteredShield(cx,cy,rx,ry,livery,stroke,scale){
  ctx.save();
  ctx.beginPath();ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2);ctx.clip();
  ctx.fillStyle=livery.main;ctx.fillRect(cx-rx,cy-ry,rx,ry);
  ctx.fillStyle=livery.alt;ctx.fillRect(cx,cy-ry,rx,ry);
  ctx.fillStyle=livery.alt;ctx.fillRect(cx-rx,cy,rx,ry);
  ctx.fillStyle=livery.main;ctx.fillRect(cx,cy,rx,ry);
  ctx.restore();
  ctx.save();ctx.strokeStyle=stroke;ctx.lineWidth=Math.max(.8,.9*scale);
  ctx.beginPath();ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2);ctx.stroke();ctx.restore();
}
function drawSoldierFigure(p,z,type,id,phase=0){
  const base=w2s(p,z),scale=militaryScale(),bodyW=5.4*scale,bodyH=8.0*scale,headR=2.2*scale;
  const bodyY=base.y-bodyH*.16,top=bodyY-bodyH/2,headY=top-headR*.72,livery=soldierLivery(id);

  ctx.save();

  // Realm livery: every soldier carries both current reign colours.
  soldierBodyPath(base,bodyW,bodyH,top,bodyY);ctx.save();ctx.clip();
  ctx.fillStyle=livery.main;ctx.fillRect(base.x-bodyW,top,bodyW*2,bodyH*.52);
  ctx.fillStyle=livery.alt;ctx.fillRect(base.x-bodyW,top+bodyH*.52,bodyW*2,bodyH);
  ctx.restore();
  soldierBodyPath(base,bodyW,bodyH,top,bodyY);
  ctx.strokeStyle='rgba(25,24,22,.88)';ctx.lineWidth=Math.max(.7,.8*scale);ctx.stroke();

  // Head + steel cap.
  ctx.fillStyle=VILLAGER_SKIN;ctx.beginPath();ctx.arc(base.x,headY,headR,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#70777c';ctx.beginPath();ctx.arc(base.x,headY,headR,Math.PI,Math.PI*2);ctx.lineTo(base.x-headR,headY);ctx.closePath();ctx.fill();
  ctx.strokeStyle='rgba(30,30,30,.75)';ctx.beginPath();ctx.arc(base.x,headY,headR,0,Math.PI*2);ctx.stroke();

  if(type==='spearman'){
    const x=base.x+bodyW*.55;
    ctx.strokeStyle='#7a5937';ctx.lineWidth=Math.max(1,1.05*scale);
    ctx.beginPath();ctx.moveTo(x,bodyY+bodyH*.43);ctx.lineTo(x-1.0*scale,headY-13*scale);ctx.stroke();
    ctx.fillStyle='#b8bcc0';ctx.beginPath();
    ctx.moveTo(x-1.0*scale,headY-16*scale);ctx.lineTo(x-3.0*scale,headY-11.5*scale);ctx.lineTo(x+1.0*scale,headY-12.2*scale);ctx.closePath();ctx.fill();
  }else if(type==='archer'){
    const bx=base.x+bodyW*.62,by=bodyY-bodyH*.04,r=5.3*scale;
    ctx.strokeStyle='#9b7243';ctx.lineWidth=Math.max(.8,.85*scale);
    ctx.beginPath();ctx.arc(bx,by,r,-Math.PI*.55,Math.PI*.55);ctx.stroke();
    ctx.beginPath();ctx.moveTo(bx+Math.cos(-Math.PI*.55)*r,by+Math.sin(-Math.PI*.55)*r);
    ctx.lineTo(bx-r*.18,by);
    ctx.lineTo(bx+Math.cos(Math.PI*.55)*r,by+Math.sin(Math.PI*.55)*r);ctx.stroke();
  }else{
    const swing=Math.sin(phase*Math.PI*2)*3.2*scale;
    drawQuarteredShield(base.x-bodyW*.62,bodyY+bodyH*.10,2.7*scale,3.6*scale,livery,'#b7aa8f',scale);
    // Sword.
    ctx.strokeStyle='#c4c7c8';ctx.lineWidth=Math.max(1,1.15*scale);
    ctx.beginPath();ctx.moveTo(base.x+bodyW*.42,bodyY+bodyH*.16);ctx.lineTo(base.x+bodyW*.80+swing,top-7.5*scale);ctx.stroke();
    ctx.strokeStyle='#76563b';ctx.lineWidth=Math.max(1,1.2*scale);
    ctx.beginPath();ctx.moveTo(base.x+bodyW*.23,bodyY+bodyH*.05);ctx.lineTo(base.x+bodyW*.52,bodyY+bodyH*.27);ctx.stroke();
  }

  ctx.restore();
}
function wallPatrolPoint(wall,day){
  const L=Math.max(.001,dist(wall.a,wall.b)),seed=(peasantHash(wall.id+'-patrol')%1000)/1000;
  let t=(day*.72+seed)%2;t=t<=1?t:2-t;
  const margin=Math.min(.65,L*.18),u=margin/L+t*Math.max(0,1-2*margin/L);
  return{x:wall.a.x+(wall.b.x-wall.a.x)*u,y:wall.a.y+(wall.b.y-wall.a.y)*u};
}
function drawCastleSoldiers(){
  const day=peasantVisualDay();

  // Spearmen walk the wall-walk.
  for(const wall of State.structures){
    if(wall.type!=='wall'||underConstruction(wall))continue;
    const p=wallPatrolPoint(wall,day),z=structureHeight(wall)+.10;
    if(worldPointVisible(p,z,48))drawSoldierFigure(p,z,'spearman',wall.id,day);
  }

  // One archer lookout on every completed crenellated tower.
  for(const tower of State.structures){
    if(tower.type!=='tower'||underConstruction(tower)||towerRoofStyle(tower)!=='battlement')continue;
    const hash=peasantHash(tower.id+'-archer'),a=(hash%360)*Math.PI/180;
    const radius=tower.shape==='round'?tower.r*.26:(tower.size||1)*.18;
    const p={x:tower.x+Math.cos(a)*radius,y:tower.y+Math.sin(a)*radius},z=structureHeight(tower)+.08;
    if(worldPointVisible(p,z,48))drawSoldierFigure(p,z,'archer',tower.id,day);
  }
}
function drawTrainingSoldiers(){
  const day=peasantVisualDay(),dots=[];
  for(const yard of State.structures){
    if(yard.type!=='training'||underConstruction(yard))continue;
    const seed=(peasantHash(yard.id+'-training')%1000)/1000;
    const pulse=day*.80+seed;
    const spots=[
      {x:-1.15,y:-.62,pair:0},{x:1.15,y:-.62,pair:0},
      {x:-1.15,y:.72,pair:1},{x:1.15,y:.72,pair:1}
    ];
    for(let i=0;i<spots.length;i++){
      const s=spots[i],side=i%2===0?1:-1;
      const advance=Math.sin((pulse+s.pair*.37)*Math.PI*2)*.20*side;
      const local={x:s.x+advance,y:s.y};
      const p=houseLocalToWorld(yard,local.x,local.y);
      if(!worldPointVisible(p,.13,48))continue;
      dots.push({p,z:.13,id:yard.id+':knight:'+i,phase:pulse+i*.17});
    }
  }
  dots.sort((a,b)=>viewDepthPoint(a.p)-viewDepthPoint(b.p));
  for(const d of dots)drawSoldierFigure(d.p,d.z,'knight',d.id,d.phase);
}
