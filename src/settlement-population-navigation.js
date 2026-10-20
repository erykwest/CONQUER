'use strict';
// Navigation graph, road paths and collision-aware routing. Extracted verbatim from settlement-population.js.
const PEASANT_PATH_STEP=.5,PEASANT_CLEARANCE=.22;
const PEASANT_ROAD_COST=.38,PEASANT_ROADSIDE_COST=.68,PEASANT_ROADSIDE_RANGE=.85;
let peasantPathCache=new Map(),peasantPathSignature='';
let roadNavGraphCache={dirty:true,nodes:new Map(),roads:[],version:0};
let roadDestinationTreeCache=new Map();
const ROAD_DESTINATION_TREE_CACHE_MAX=96;
const navPerf={
  graphBuilds:0,graphRoutes:0,gridFallbacks:0,gridMisses:0,
  destinationTreesBuilt:0,destinationTreeHits:0,destinationTreeRoutes:0
};
Object.assign(navPerf,window.__conquerPerf||{});
window.__conquerPerf=navPerf;
function invalidateNavigation(hard=true,{urban=true}={}){
  // Destination trees depend on the exact road graph, so any topology change
  // drops them. Individual resident routes survive soft extensions.
  navPerf.navInvalidations=(navPerf.navInvalidations||0)+1;
  if(window.__conquerPerf)window.__conquerPerf.navInvalidations=navPerf.navInvalidations;
  roadNavGraphCache.dirty=true;
  if(urban)invalidateUrbanGeometry();
  roadDestinationTreeCache.clear();
  window.ConquerCombat?.invalidateRoutes?.();
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
  const analyticsT0=performance.now();
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
  roadDestinationTreeCache.clear();
  navPerf.graphBuilds++;
  if(window.__conquerPerf)window.__conquerPerf.graphBuilds=navPerf.graphBuilds;
  window.__conquerAnalytics?.measure('NAV_GRAPH',performance.now()-analyticsT0,{roads:roads.length,nodes:nodes.size});
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
function roadNodeTreeKey(nodeKey,graph){
  return graph.version+'|node|'+nodeKey;
}
function cacheRoadDestinationTree(key,tree){
  if(roadDestinationTreeCache.size>=ROAD_DESTINATION_TREE_CACHE_MAX){
    const oldest=roadDestinationTreeCache.keys().next().value;
    if(oldest!=null)roadDestinationTreeCache.delete(oldest);
  }
  roadDestinationTreeCache.set(key,tree);
}
function buildRoadNodeTree(goalNodeKey,graph=roadNavGraph()){
  if(!goalNodeKey||!graph.nodes.size||!graph.nodes.has(goalNodeKey))return null;
  const key=roadNodeTreeKey(goalNodeKey,graph);
  const cached=roadDestinationTreeCache.get(key);
  if(cached){
    navPerf.destinationTreeHits++;
    return cached;
  }

  const analyticsT0=performance.now();
  const heap=new RoadNavHeap(),distance=new Map(),next=new Map();
  distance.set(goalNodeKey,0);
  next.set(goalNodeKey,null);
  heap.push({key:goalNodeKey,d:0});

  let guard=0;
  while(heap.length&&guard++<50000){
    const cur=heap.pop();
    if(cur.d!==(distance.get(cur.key)??Infinity))continue;
    const node=graph.nodes.get(cur.key);if(!node)continue;
    for(const [neighborKey,w] of node.edges){
      const nd=cur.d+w;
      if(nd<(distance.get(neighborKey)??Infinity)){
        distance.set(neighborKey,nd);
        // From neighbor, the next hop toward this cached goal node is cur.
        next.set(neighborKey,cur.key);
        heap.push({key:neighborKey,d:nd});
      }
    }
  }

  const tree={key,graphVersion:graph.version,goalNodeKey,distance,next};
  cacheRoadDestinationTree(key,tree);
  navPerf.destinationTreesBuilt++;
  window.__conquerAnalytics?.measure('NAV_TREE',performance.now()-analyticsT0,{nodes:graph.nodes.size});
  return tree;
}
function uniqueAnchorNodes(anchor){
  const out=[],seen=new Set();
  for(const q of [anchor?.left,anchor?.right]){
    if(!q?.node||seen.has(q.node.key))continue;
    seen.add(q.node.key);out.push(q);
  }
  return out;
}
function roadTreePathFromAnchor(startAnchor,goalAnchor){
  const graph=roadNavGraph();
  if(!startAnchor||!goalAnchor||!graph.nodes.size)return null;

  // Same-road travel never needs the network graph.
  if(startAnchor.item===goalAnchor.item)return[startAnchor.point,goalAnchor.point];

  const starts=uniqueAnchorNodes(startAnchor),goals=uniqueAnchorNodes(goalAnchor);
  if(!starts.length||!goals.length)return null;

  let best=null,bestCost=Infinity;
  for(const goal of goals){
    const tree=buildRoadNodeTree(goal.node.key,graph);
    if(!tree)continue;
    const goalLeg=dist(goalAnchor.point,goal.node.p);

    for(const start of starts){
      const networkCost=tree.distance.get(start.node.key);
      if(networkCost==null)continue;
      const cost=dist(startAnchor.point,start.node.p)+networkCost+goalLeg;
      if(cost<bestCost){
        bestCost=cost;
        best={startKey:start.node.key,tree};
      }
    }
  }
  if(!best)return null;

  const out=[{...startAnchor.point}],seen=new Set();
  let key=best.startKey,guard=0;
  while(key&&guard++<graph.nodes.size+4){
    if(seen.has(key))return null;
    seen.add(key);
    const node=graph.nodes.get(key);if(!node)return null;
    if(dist(out.at(-1),node.p)>.02)out.push({...node.p});
    key=best.tree.next.get(key)??null;
  }
  if(dist(out.at(-1),goalAnchor.point)>.02)out.push({...goalAnchor.point});
  navPerf.destinationTreeRoutes++;
  return out;
}
function localRoadConnectorPath(point,anchor,sourceHouseId){
  if(!point||!anchor)return null;
  if(dist(point,anchor)<=.03)return[{...point}];
  if(peasantSegmentClear(point,anchor,sourceHouseId))return[{...point},{...anchor}];

  // Grid A* is now strictly local: only bridge a building/plaza access point
  // to its nearest road. It never searches the full origin→destination trip.
  navPerf.localConnectorSearches=(navPerf.localConnectorSearches||0)+1;
  let path=findPeasantPath(point,anchor,sourceHouseId,2.5);
  if(!path&&dist(point,anchor)<=3.8)path=findPeasantPath(point,anchor,sourceHouseId,4);
  if(!path){
    navPerf.localConnectorMisses=(navPerf.localConnectorMisses||0)+1;
    return null;
  }
  return path;
}
function appendRoutePoints(out,points){
  for(const p of points||[]){
    if(p&&(!out.length||dist(p,out.at(-1))>.02))out.push({...p});
  }
  return out;
}
function roadNetworkPath(start,goal,sourceHouseId){
  const graph=roadNavGraph();if(!graph.nodes.size)return null;
  const a=nearestRoadNavAnchor(start),b=nearestRoadNavAnchor(goal);
  if(!a||!b||a.d>4.5||b.d>4.5)return null;

  const startConnector=localRoadConnectorPath(start,a.point,sourceHouseId);
  const goalConnector=localRoadConnectorPath(goal,b.point,sourceHouseId);
  if(!startConnector||!goalConnector)return null;

  // One reverse Dijkstra tree per destination anchor. Every origin heading to
  // the same well/market/church/tavern then performs only a few Map lookups and
  // follows parent pointers toward the target.
  const network=roadTreePathFromAnchor(a,b);
  if(!network)return null;

  let out=[];
  appendRoutePoints(out,startConnector);
  appendRoutePoints(out,network);
  appendRoutePoints(out,goalConnector.slice().reverse());
  const well=State.structures.find(s=>s.type==='well'&&dist(s,goal)<.03);
  if(well)out=trimPathBeforeCircle(out,well,.62+PEASANT_CLEARANCE+.16);
  const clear=[];
  for(const p of out){
    if(!clear.length){clear.push(p);continue}
    const a=clear.at(-1);
    if(peasantSegmentClear(a,p,sourceHouseId))appendRoutePoints(clear,[p]);
    else{
      const detour=findPeasantPath(a,p,sourceHouseId,2.5);
      if(!detour)return null;
      appendRoutePoints(clear,detour);
    }
  }
  navPerf.graphRoutes++;
  return clear;
}
function peasantObstacleSignature(){
  return State.structures.filter(s=>['house','tower','gate','wall','palisade','built','well','road','market','tavern','church','training','plaza','civicAnnex'].includes(s.type)).map(s=>{
    if(['wall','palisade','built','road'].includes(s.type))return [s.id,s.type,s.a.x,s.a.y,s.b.x,s.b.y,s.width,JSON.stringify(s.functions||[]),underConstruction(s)?1:0].join(',');
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
function peasantObstacleSnapshot(){
  // A search reads one topology. House annexes/footprints are expensive to derive
  // and do not change between its thousands of collision samples.
  const parts=new Map();
  for(const s of State.structures)if(s.type==='house'||isCivic(s))parts.set(s,s.type==='house'?urbanHouseDisplayParts(s):civicParts(s));
  parts.circles=State.structures.filter(s=>s.type==='well'||(['tower','ruin'].includes(s.type)&&s.shape==='round'));
  return parts;
}
function pointBlockedForPeasant(p,sourceHouseId,obstacleParts=null){
  if(urbanFencePointBlocked(p,PEASANT_CLEARANCE))return true;
  if(terrainSlopeKind(p)==='steep'&&!window.ConquerCrossings?.onBridge(p))return true;
  if(window.ConquerSiege?.rubbleBlocks?.(p))return true;      // the high core of a collapse heap
  for(const s of State.structures){
    if(s.id===sourceHouseId&&s.type!=='house')continue;
    if(!['house','tower','gate','wall','palisade','built','well','market','tavern','church','training','plaza','civicAnnex','ruin'].includes(s.type))continue;
    if(isCivicAnnex(s)&&['garden','yard'].includes(civicAnnexDefinition(s)?.kind))continue;

    // Market and public piazza floors remain walkable; they are not solid buildings.
    if(s.type==='market'||s.type==='plaza')continue;
    if(s.type==='gate'){
      if(window.ConquerCrossings?.drawbridgeBlocks(p,s))return true;
      // A closed gate with its door still whole shuts the passage (settlement-siege.js).
      if(gatePointInPassage(s,p,.08)){if(window.ConquerSiege?.gateClosed?.(s))return true;continue}
      const q=toLocalPoint(s,p),d=rectDims(s);
      if(Math.abs(q.x)<=d.w/2+PEASANT_CLEARANCE&&Math.abs(q.y)<=d.h/2+PEASANT_CLEARANCE)return true;
      continue;
    }

    if(['wall','palisade','built'].includes(s.type)){
      if(pointSegmentDistance(p,s.a,s.b)<=Number(s.width)/2+PEASANT_CLEARANCE)return true;
      continue;
    }
    if(s.type==='well'){if(dist(p,s)<=.62+PEASANT_CLEARANCE)return true;continue}
    if((s.type==='tower'||s.type==='ruin')&&s.shape==='round'){if(dist(p,s)<=s.r+PEASANT_CLEARANCE)return true;continue}
    if(s.type==='house'||isCivic(s)){
      const parts=obstacleParts?.get(s)||(s.type==='house'?urbanHouseDisplayParts(s):civicParts(s));
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
  const edge=Math.max(.10,road.width/2);
  const base=!Number.isFinite(road.d)?1:road.d<=edge+.18?PEASANT_ROAD_COST:
    road.d<=edge+PEASANT_ROADSIDE_RANGE?PEASANT_ROADSIDE_COST:1;
  return base/Math.max(.1,window.ConquerCrossings?.movementMultiplier(p)||1);
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
function peasantSegmentClear(a,b,sourceHouseId,obstacleParts=null){
  if(terrainSegmentCrossesCliff(a,b)&&!window.ConquerCrossings?.segmentCanCrossCliff(a,b))return false;
  // Sampling alone can miss a tangent to the well between two samples. Such a
  // shortcut passed A* smoothing, then failed on the woman's smaller walk step.
  const circles=obstacleParts?.circles||State.structures.filter(s=>s.type==='well'||(['tower','ruin'].includes(s.type)&&s.shape==='round'));
  for(const s of circles)if(s.id!==sourceHouseId&&pointSegmentDistance(s,a,b)<=(s.type==='well'?.62:s.r)+PEASANT_CLEARANCE)return false;
  const L=dist(a,b),steps=Math.max(2,Math.ceil(L/.22));
  for(let i=0;i<=steps;i++){const t=i/steps,p={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};if(pointBlockedForPeasant(p,sourceHouseId,obstacleParts))return false}
  return true;
}
function smoothPeasantPath(points,sourceHouseId,allowedAt=null,obstacleParts=null){
  const work=smoothPeasantPathWork(points,sourceHouseId,allowedAt,obstacleParts);let result;
  do{result=work.next()}while(!result.done);return result.value;
}
function* smoothPeasantPathWork(points,sourceHouseId,allowedAt=null,obstacleParts=null){
  if(points.length<=2)return points;
  const prefix=[0];
  for(let i=0;i<points.length-1;i++){prefix.push(prefix.at(-1)+peasantSegmentTravelCost(points[i],points[i+1]));if(i%32===0)yield}
  const out=[points[0]];let i=0;
  while(i<points.length-1){
    let chosen=i+1;
    for(let j=points.length-1;j>i+1;j--){
      if(j%8===0)yield;
      if(!peasantSegmentClear(points[i],points[j],sourceHouseId,obstacleParts))continue;
      if(allowedAt){const length=dist(points[i],points[j]);let valid=true;for(let k=0;k<=Math.ceil(length/.5);k++){const t=k/Math.max(1,Math.ceil(length/.5));if(!allowedAt({x:points[i].x+(points[j].x-points[i].x)*t,y:points[i].y+(points[j].y-points[i].y)*t})){valid=false;break}}if(!valid)continue;}
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
function findPeasantPath(start,goal,sourceHouseId,pad=8,allowedAt=null){
  const work=findPeasantPathWork(start,goal,sourceHouseId,pad,allowedAt);let result;
  do{result=work.next()}while(!result.done);return result.value;
}
function* findPeasantPathWork(start,goal,sourceHouseId,pad=8,allowedAt=null){
  const step=PEASANT_PATH_STEP;
  const obstacleParts=peasantObstacleSnapshot(),blockedNodes=new Map(),costs=new Map();
  const blocked=(x,y)=>{const k=key(x,y);if(!blockedNodes.has(k)){const p=pos(x,y);blockedNodes.set(k,pointBlockedForPeasant(p,sourceHouseId,obstacleParts)||!!(allowedAt&&!allowedAt(p)))}return blockedNodes.get(k)};
  const cost=(x,y)=>{const k=key(x,y);if(!costs.has(k))costs.set(k,peasantTerrainCost(pos(x,y)));return costs.get(k)};
  const minX=Math.floor((Math.min(start.x,goal.x)-pad)/step),maxX=Math.ceil((Math.max(start.x,goal.x)+pad)/step);
  const minY=Math.floor((Math.min(start.y,goal.y)-pad)/step),maxY=Math.ceil((Math.max(start.y,goal.y)+pad)/step);
  const key=(x,y)=>x+','+y,pos=(x,y)=>({x:x*step,y:y*step});
  function* nearestFree(p){
    const cx=Math.round(p.x/step),cy=Math.round(p.y/step);let best=null,bestD=Infinity;
    for(let r=0;r<=4;r++){
      for(let dx=-r;dx<=r;dx++)for(let dy=-r;dy<=r;dy++){
      if(Math.max(Math.abs(dx),Math.abs(dy))!==r)continue;
      const x=cx+dx,y=cy+dy,q=pos(x,y);if(x<minX||x>maxX||y<minY||y>maxY||blocked(x,y))continue;
      if(!peasantSegmentClear(p,q,sourceHouseId,obstacleParts))continue;
      const d=dist(p,q);if(d<bestD){best={x,y,q};bestD=d}
      }
      // No point in a later ring can be closer than this lower bound.
      if(bestD<=(r+.5)*step)break;
      yield;
    }
    return best;
  }
  const s=yield* nearestFree(start),g=yield* nearestFree(goal);if(!s||!g)return null;
  const open=new PeasantMinHeap(),gScore=new Map([[key(s.x,s.y),0]]),came=new Map(),closed=new Set();
  open.push({x:s.x,y:s.y,f:dist(s.q,g.q)*PEASANT_ROAD_COST});
  const dirs=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
  let found=null,guard=0;
  while(open.length&&guard++<30000){
    if(guard%16===0)yield;
    const cur=open.pop(),ck=key(cur.x,cur.y);if(closed.has(ck))continue;closed.add(ck);
    if(cur.x===g.x&&cur.y===g.y){found=cur;break}
    for(const [dx,dy] of dirs){
      const nx=cur.x+dx,ny=cur.y+dy;if(nx<minX||nx>maxX||ny<minY||ny>maxY)continue;
      const nk=key(nx,ny),q=pos(nx,ny);if(closed.has(nk)||blocked(nx,ny)||!peasantSegmentClear(pos(cur.x,cur.y),q,sourceHouseId,obstacleParts))continue;
      if(dx&&dy){
        if(blocked(cur.x+dx,cur.y)||blocked(cur.x,cur.y+dy))continue;
      }
      const baseStep=Math.hypot(dx,dy)*step;
      const moveCost=baseStep*(cost(cur.x,cur.y)+cost(nx,ny))*.5;
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
  rev.reverse();return yield* smoothPeasantPathWork([start,...rev,goal],sourceHouseId,allowedAt,obstacleParts);
}
