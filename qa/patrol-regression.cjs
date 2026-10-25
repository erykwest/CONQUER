'use strict';
// Regression for Patrol lost when merging the experimental Combat branch into main.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const rulesSource=fs.readFileSync(path.join(root,'src','settlement-combat-rules.js'),'utf8');
const runtimeSource=fs.readFileSync(path.join(root,'src','settlement-combat.js'),'utf8');
const context=vm.createContext({window:{},Math});
vm.runInContext(rulesSource,context,{filename:'settlement-combat-rules.js'});
const rules=context.window.ConquerCombatRules;
assert.ok(rules,'combat rules must load');
assert.equal(rules.ensure({kind:'patrol'},'patrol').maxHp,40,'patrol is a two-pikeman unit, not a 5-pikeman squad');

const allowed=p=>(p.x-100)**2+(p.y-100)**2<=400;
function verifyOrderedRing(label,region,focus={x:100,y:100}){
 const ring=rules.orderedBoundaryPoints(region,200,1.25,focus);
 assert.ok(ring.length>60,label+': most perimeter points should form the ring');
 const unique=new Set(ring.map(p=>p.x+','+p.y));
 assert.equal(unique.size,ring.length,label+': no repeated first/last vertex');
 const angles=ring.map(p=>Math.atan2(p.y-focus.y,p.x-focus.x));
 const quadrants=new Set(ring.map(p=>Math.floor(((Math.atan2(p.y-focus.y,p.x-focus.x)+Math.PI)/(Math.PI/2)))%4));
 assert.equal(quadrants.size,4,label+': patrol visits all sides, not one short arc');
 assert.ok(ring.every((p,i)=>Math.hypot(p.x-ring[(i+1)%ring.length].x,p.y-ring[(i+1)%ring.length].y)<=1.8),
   label+': ring neighbors are local, including wraparound');
 return ring;
}
verifyOrderedRing('circular White Zone',allowed);
const ellipse=p=>((p.x-100)/35)**2+((p.y-100)/15)**2<=1;
const ellipseSamples=rules.boundaryPoints(ellipse,200,1.25);
const greedy=rules.traceBoundaryIndices(ellipseSamples,{x:100,y:100});
assert.ok(greedy.length<ellipseSamples.length*.5,'reproduction: old greedy trace stops early on ellipse');
const ellipticRing=verifyOrderedRing('elliptic White Zone',ellipse);
assert.ok(ellipticRing.length>ellipseSamples.length*.85,'new contour covers entire ellipse perimeter');
// A full patrol must progress through ordered boundary indices over many
// successive destinations. Earlier tests checked single A* legs, missing the
// short-arc oscillation seen in the live game.
const driveStart=runtimeSource.indexOf('  function patrolDestination(');
const driveEnd=runtimeSource.indexOf('  function patrolSafeWaypoint(',driveStart);
assert.ok(driveStart>0&&driveEnd>driveStart,'patrol destination is extractable');
const circuitPatrol={id:'perimeter-qa',kind:'patrol',x:100,y:100,patrolLoopPosition:null,patrolDirection:1};
const circuitCtx=vm.createContext({
  whiteBoundaryPoints:()=>ellipticRing,
  whiteBoundaryLoopCache:ellipticRing.map((_,i)=>i),
  activeWell:()=>({x:100,y:100}),
  dist:(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),
  Math
});
vm.runInContext('const PATROL_LOOP_STRIDE=2;',circuitCtx);
vm.runInContext(runtimeSource.slice(driveStart,driveEnd),circuitCtx);
const visitedIndices=[],quadrantsVisited=new Set();
for(let i=0;i<70;i++){
  const waypoint=vm.runInContext('patrolDestination(unit)',Object.assign(circuitCtx,{unit:circuitPatrol}));
  assert.ok(waypoint,'each perimeter destination remains valid');
  circuitPatrol.x=waypoint.x;circuitPatrol.y=waypoint.y;
  visitedIndices.push(circuitPatrol.patrolLoopPosition);
  quadrantsVisited.add(Math.floor((Math.atan2(waypoint.y-100,waypoint.x-100)+Math.PI)/(Math.PI/2))%4);
}
assert.ok(new Set(visitedIndices).size>=45,'70 patrol updates must traverse the full perimeter, not a small arc');
assert.equal(quadrantsVisited.size,4,'moving patrol visits all four quadrants');
assert.ok(visitedIndices.slice(1).every((idx,i)=>idx===(visitedIndices[i]+2)%ellipticRing.length),
 'successive patrol destinations always advance forward by stride (no oscillation)');

const joined=p=>allowed(p)||((p.x-118)**2+(p.y-100)**2<=169);
const joinedSamples=rules.boundaryPoints(joined,200,1.25);
assert.ok(rules.traceBoundaryIndices(joinedSamples,{x:100,y:100}).length<joinedSamples.length*.5,
 'reproduction: old trace gets trapped at joined circles');
verifyOrderedRing('overlapping White Zone circles',joined);
verifyOrderedRing('White Zone with inner forbidden hole',
  p=>allowed(p)&&((p.x-106)**2+(p.y-100)**2>=9));
const distant=p=>allowed(p)||((p.x-165)**2+(p.y-100)**2<=28**2);
const focused=rules.orderedBoundaryPoints(distant,200,1.25,{x:100,y:100});
assert.ok(focused.every(p=>p.x<125),'contour should surround the settlement, not a remote disconnected zone');
const boundary=rules.boundaryPoints(allowed,200,1.25);
const loop=rules.traceBoundaryIndices(boundary,{x:100,y:100});
assert.ok(loop.length>40,'White Zone yields a usable ordered boundary loop');
const anchors=Array.from({length:4},(_,i)=>Math.floor(i*loop.length/4));
const gaps=anchors.map((a,i)=>(i===3?loop.length:anchors[i+1])-a);
assert.ok(Math.max(...gaps)-Math.min(...gaps)<=1,'patrols can be spaced evenly along the boundary');
assert.equal(rules.shouldRebuildBoundary(true,true,true),false,'do not rebuild on each brush sample');
assert.equal(rules.shouldRebuildBoundary(false,true,true),true,'rebuild after brush release');

const a=runtimeSource.indexOf('class PatrolMinHeap{'),b=runtimeSource.indexOf('function issueMove(',a);
assert.ok(a>0&&b>a,'optimized patrol route code exists');
const routeSource=runtimeSource.slice(a,b);
assert.doesNotMatch(routeSource,/findPeasantPath|roadNetworkPath/,'patrol routing must never invoke slow civilian or road-network pathfinders');
assert.match(routeSource,/PATROL_PATH_STEP/);
assert.match(routeSource,/patrolRouteCache/);
const routeContext=vm.createContext({
  Map,Set,Math,performance:{now:()=>10},window:{__conquerPerf:{}},
  dist:(p,q)=>Math.hypot(p.x-q.x,p.y-q.y),
  pointBlockedForPeasant:()=>false,terrainSegmentCrossesCliff:()=>false,
  areaState:p=>({allowed:allowed(p)}),
  safeMilitarySegment:()=>true,
  routeAllowed:points=>points.every(allowed)
});
vm.runInContext(`const PATROL_PATH_STEP=.75,PATROL_ROUTE_CACHE_MAX=512;
let whiteBoundaryRevision=1,patrolNavRevision=1;
const patrolRouteCache=new Map();`,routeContext);
vm.runInContext(routeSource,routeContext,{filename:'patrol-routing'});
const route=vm.runInContext("patrolRoute({x:100,y:85},{x:105,y:86},'p')",routeContext);
assert.ok(route?.length>=2,'patrol route exists in accessible White Zone');
const cached=vm.runInContext("patrolRoute({x:100,y:85},{x:105,y:86},'p')",routeContext);
assert.equal(cached.length,route.length,'route can be reused');
assert.equal(routeContext.window.__conquerPerf.patrolRouteCacheHits,1,'repeat patrol leg uses route cache');

// A search around an impossible obstacle must respect a wall-clock deadline
// instead of consuming an unbounded 100–900 ms long task.
const blockedSource=routeSource;
const budgetClock={count:0,now(){return ++this.count*5}};
const budgetCtx=vm.createContext({
  Map,Set,Math,
  performance:{now:()=>budgetClock.now()},
  window:{__conquerPerf:{}},
  dist:(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),
  pointBlockedForPeasant:p=>p.x>95&&p.x<115&&p.y>96&&p.y<104,
  terrainSegmentCrossesCliff:()=>false,
  areaState:()=>({allowed:true}),
  safeMilitarySegment:()=>false,
  routeAllowed:()=>true
});
vm.runInContext('const PATROL_PATH_STEP=.75,PATROL_ROUTE_CACHE_MAX=512;let whiteBoundaryRevision=1,patrolNavRevision=1;const patrolRouteCache=new Map();',budgetCtx);
vm.runInContext(blockedSource,budgetCtx);
const rejected=vm.runInContext("patrolRoute({x:94,y:100},{x:117,y:100},'blocked')",budgetCtx);
assert.equal(rejected,null,'fully obstructed route fails');
assert.ok(budgetClock.count<25,'path budget cuts off long blocked searches');


// A wall across the direct line must be avoided in A*, not rejected only after
// the whole computed route has been assembled.
let wall=true;
const insideWall=p=>wall&&p.x>=102.8&&p.x<=104.8&&p.y>=99.1&&p.y<=100.9;
routeContext.pointBlockedForPeasant=insideWall;
routeContext.safeMilitarySegment=(a,b)=>{
 const count=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/.1));
 for(let i=0;i<=count;i++){
  const t=i/count;
  if(insideWall({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t}))return false;
 }
 return true;
};
const detour=vm.runInContext("patrolRoute({x:100,y:100},{x:108,y:100},'obstacle')",routeContext);
assert.ok(detour?.length>2,'patrol A* finds a detour around a solid obstruction');
assert.ok(detour.slice(1).every((p,i)=>routeContext.safeMilitarySegment(detour[i],p)),
 'patrol path has no wall-crossing diagonals');
// An existing cached route must be checked again when buildings appear.
wall=false;
vm.runInContext("patrolRoute({x:100,y:100},{x:108,y:100},'mutable')",routeContext);
wall=true;
const revised=vm.runInContext("patrolRoute({x:100,y:100},{x:108,y:100},'mutable')",routeContext);
assert.ok(revised?.length>2&&revised.slice(1).every((p,i)=>routeContext.safeMilitarySegment(revised[i],p)),
 'changed obstruction invalidates a previously cached direct path');
// Do not cache failure: the exact same route may become legal when reopened.
routeContext.safeMilitarySegment=()=>false;
const blocked=vm.runInContext("patrolRoute({x:100,y:100},{x:102,y:100},'reopen')",routeContext);
assert.equal(blocked,null,'fully blocked patrol route correctly fails');
routeContext.safeMilitarySegment=()=>true;
wall=false;
assert.ok(vm.runInContext("patrolRoute({x:100,y:100},{x:102,y:100},'reopen')",routeContext),
 'failed patrol route can be retried after the obstruction clears');

// A bad waypoint is skipped only after pathfinding rejects it; the index and
// route are committed together. No route must preserve the previous index.
const destinationStart=runtimeSource.indexOf('  function patrolDestination(');
const destinationEnd=runtimeSource.indexOf('  function addPatrol(',destinationStart);
assert.ok(destinationStart>0&&destinationEnd>destinationStart);
const points=Array.from({length:6},(_,i)=>({x:i*10,y:30}));
const mover={id:'patrol-unit',kind:'patrol',x:0,y:30,patrolLoopPosition:0,patrolDirection:1,target:null};
let allowCandidate=true;
const waypointCtx=vm.createContext({
  combat:{units:[mover]},whiteBoundaryLoopCache:[0,1,2,3,4,5],
  whiteBoundaryPoints:()=>points,
  activeWell:()=>({x:0,y:0}),WORLD:200,Math,performance:{now:()=>1000},
  dist:(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),
  areaState:()=>({allowed:true}),cliffClearForFootprint:()=>true,
  window:{__conquerPerf:{}},
  patrolRoute:(from,to)=>allowCandidate&&to.x!==20?[from,to]:null
});
vm.runInContext('const PATROL_LOOP_STRIDE=2;',waypointCtx);
vm.runInContext(runtimeSource.slice(destinationStart,destinationEnd),waypointCtx);
vm.runInContext('updatePatrols(1000)',waypointCtx);
assert.equal(mover.target,null,'failed first candidate does not teleport or advance the patrol index');
assert.equal(mover.patrolLoopPosition,0,'blocked waypoint remains uncommitted');
vm.runInContext('updatePatrols(2000)',waypointCtx);
assert.equal(mover.target.x,40,'next tick probes alternate reachable waypoint');
assert.equal(mover.patrolLoopPosition,4,'only reachable waypoint is committed');
mover.target=null;allowCandidate=false;const previousIndex=mover.patrolLoopPosition;
vm.runInContext('updatePatrols(3000)',waypointCtx);
assert.equal(mover.target,null,'blocked candidates leave patrol without a target');
assert.equal(mover.patrolLoopPosition,previousIndex,'failed search preserves prior waypoint');

// Reproduce the user's stall: a solid building blocks a 14U-tall corridor,
// while a safe detour through the White Zone exists outside the old 5U limit.
const corridorStart={x:102.6,y:100},corridorGoal={x:119,y:100};
const rectangle=p=>p.x>=105&&p.x<=117&&p.y>=94&&p.y<=108;
const rectangleSegment=(a,b)=>{
 const steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/.15));
 for(let i=0;i<=steps;i++){
  const t=i/steps,p={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};
  if(rectangle(p)||!allowed(p))return false;
 }
 return true;
};
routeContext.pointBlockedForPeasant=rectangle;
routeContext.safeMilitarySegment=rectangleSegment;
const extended=vm.runInContext("patrolRoute({x:102.6,y:100},{x:119,y:100},'corridor-detour')",routeContext);
assert.ok(extended?.length>=3,'patrol detours around an elongated obstacle wider than 5U');
assert.ok(extended.slice(1).every((p,i)=>rectangleSegment(extended[i],p)),
 'long detour never intersects the obstacle');
assert.ok(routeContext.window.__conquerPerf.patrolSearchLastPad>=7,
 'A* actually expands its local search window to find the detour');
// Individual field troops extend the roster; patrols still survive restoration.
// The actual mixed-roster round trip is exercised by mass-battle-regression.cjs.
assert.match(runtimeSource,/\['squad','knight','patrol','infantry','archer'\]\.includes\(u\.kind\)/,'patrol survives save restoration');
assert.match(runtimeSource,/id="combatPatrolAdd"/,'Patrol + action is in the combat panel');
assert.match(runtimeSource,/id="combatPatrolRemove"/,'Patrol - action is in the combat panel');
assert.match(runtimeSource,/u\.kind==='patrol'\?2:5/,'Patrol renders two pikemen, not five');
assert.match(runtimeSource,/updatePatrols\(performance\.now\(\)\)/,'patrols advance during simulation');
assert.match(runtimeSource,/ConquerCombatRules\.orderedBoundaryPoints/,'combat uses ordered contour, not greedy trace');
assert.match(runtimeSource,/whiteBoundaryLoopCache=points\.map/,'indices preserve contour order');
assert.doesNotMatch(runtimeSource.slice(runtimeSource.indexOf('function patrolDestination('),
 runtimeSource.indexOf('function patrolSafeWaypoint(')),/dist\(unit,boundary\[current\]\)>3\.25/,
 'patrol destination cannot reset progress on sparse or inward-adjusted waypoints');
assert.match(runtimeSource,/whiteBoundarySignature=''/,'editing the White Zone invalidates patrol waypoints');
console.log('PASS White Zone Patrol profile, boundary, cached routes, UI and persistence');
