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

assert.match(runtimeSource,/\['squad','knight','patrol'\]\.includes\(u\.kind\)/,'patrol survives save restoration');
assert.match(runtimeSource,/id="combatPatrolAdd"/,'Patrol + action is in the combat panel');
assert.match(runtimeSource,/id="combatPatrolRemove"/,'Patrol - action is in the combat panel');
assert.match(runtimeSource,/u\.kind==='patrol'\?2:5/,'Patrol renders two pikemen, not five');
assert.match(runtimeSource,/updatePatrols\(performance\.now\(\)\)/,'patrols advance during simulation');
assert.match(runtimeSource,/whiteBoundarySignature=''/,'editing the White Zone invalidates patrol waypoints');
console.log('PASS White Zone Patrol profile, boundary, cached routes, UI and persistence');
