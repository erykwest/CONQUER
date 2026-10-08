'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.resolve(__dirname,'..');
const rulesSource=fs.readFileSync(path.join(root,'src','settlement-combat-rules.js'),'utf8');
const runtimeSource=fs.readFileSync(path.join(root,'src','settlement-combat.js'),'utf8');
const renderSource=fs.readFileSync(path.join(root,'src','settlement-combat-render.js'),'utf8');
const coreSource=fs.readFileSync(path.join(root,'src','settlement-core.js'),'utf8');
const sandbox={window:{},Math:Object.create(Math)};
sandbox.Math.random=()=>.99;
vm.runInNewContext(rulesSource,sandbox,{filename:'settlement-combat-rules.js'});
const rules=sandbox.window.ConquerCombatRules;

assert.ok(rules,'combat rules are exported');
assert.equal(rules.shooterRange({h:4},{h:1}),18,'downhill fire gains one unit per height level');
assert.equal(rules.shooterRange({h:1},{h:4}),12,'uphill fire loses one unit per height level');
assert.equal(rules.ensure({kind:'patrol'},'patrol').maxHp,40,'a two-pikeman patrol uses the scaled patrol profile');
const circleAllowed=p=>(p.x-100)**2+(p.y-100)**2<=20**2;
const circleBoundary=rules.boundaryPoints(circleAllowed,200,1.25);
let boundaryIndex=0,previousIndex=null,visited=new Set([0]);
for(let i=0;i<60;i++){
  const next=rules.nextBoundaryIndex(circleBoundary,boundaryIndex,previousIndex,1,{x:100,y:100});
  assert.notEqual(next,-1,'perimeter traversal must not dead-end');
  previousIndex=boundaryIndex;boundaryIndex=next;visited.add(next);
}
assert.ok(visited.size>40,'a patrol must make visible progress around the perimeter');
const tracedLoop=rules.traceBoundaryIndices(circleBoundary,{x:100,y:100});
assert.ok(tracedLoop.length>40,'the perimeter exposes a stable ordered loop for patrol spacing');
const quarterAnchors=Array.from({length:4},(_,i)=>Math.floor(i*tracedLoop.length/4));
const quarterGaps=quarterAnchors.map((anchor,i)=>(i===quarterAnchors.length-1?tracedLoop.length:quarterAnchors[i+1])-anchor);
assert.ok(Math.max(...quarterGaps)-Math.min(...quarterGaps)<=1,'four patrol anchors are equidistant along the perimeter arc');
let rebuilds=0;
for(let i=0;i<100;i++)if(rules.shouldRebuildBoundary(true,true,true))rebuilds++;
if(rules.shouldRebuildBoundary(false,true,true))rebuilds++;
assert.equal(rebuilds,1,'a 100-sample White brush rebuilds the perimeter only once, after release');

const raider={id:'raider',x:10,y:10,combatKind:'infantry'};
const knight={id:'knight',x:15,y:10,kind:'knight'};
let intent=rules.enemyIntent(raider,[knight],{x:100,y:100},()=>true,200);
assert.equal(intent.mode,'pursue');
assert.equal(intent.targetId,'knight');

intent=rules.enemyIntent(raider,[knight],{x:100,y:100},()=>false,200);
assert.equal(intent.mode,'raid');
assert.deepEqual({...intent.target},{x:100,y:100});

raider.routing=true;
intent=rules.enemyIntent(raider,[knight],{x:100,y:100},()=>true,200);
assert.equal(intent.mode,'retreat');
assert.deepEqual({...intent.target},{x:0,y:10});

const shooter={id:'slit',x:0,y:0,h:3,visualZ:3,terrainAt:()=>0};
const target={id:'target',x:10,y:0,h:0,combatKind:'infantry'};
for(let i=0;i<9;i++)rules.update(.25,[],[target],[shooter],()=>true);
assert.equal(target.stats.hp,99,'automatic defensive shooter damages a visible in-range target');

assert.match(runtimeSource,/wallPatrolPoint\(s,State\.clock\.day/,'wall patrols participate in local vision');
assert.match(runtimeSource,/gateGuardPositions\(s\)/,'gate guards participate in local vision');
assert.match(runtimeSource,/function addPatrol\(\)/,'White Zone patrols can be added from the combat controls');
assert.match(runtimeSource,/function removePatrol\(\)/,'White Zone patrols can be removed from the combat controls');
assert.match(runtimeSource,/unit\.kind==='patrol'\?patrolRoute/,'patrol movement uses the White Zone constrained route');
const patrolRouteSource=runtimeSource.slice(runtimeSource.indexOf('function patrolRoute('),runtimeSource.indexOf('function issueMove('));
assert.match(runtimeSource,/PATROL_PATH_STEP=\.75,PATROL_LOOP_STRIDE=2/,'patrol pathfinding uses a coarse dedicated grid and skips every other perimeter sample');
assert.match(runtimeSource,/function findPatrolPath\(/,'patrols use a dedicated bounded pathfinder');
assert.match(runtimeSource,/patrolRouteCache/,'patrol routes are cached across repeated perimeter legs');
assert.doesNotMatch(patrolRouteSource,/roadNetworkPath|findPeasantPath/,'patrol routing no longer invokes civilian or road-network pathfinding');
assert.match(runtimeSource,/whiteBoundaryLoopCache/,'the ordered White perimeter loop is cached instead of retraced per patrol leg');
assert.match(coreSource,/PATROL_ROUTE:8/,'diagnostics attribute patrol route stalls explicitly');
assert.match(runtimeSource,/function whiteBoundaryPoints\(\)/,'patrol waypoints are generated from the White Zone perimeter');
assert.match(runtimeSource,/patrolBoundaryIndex/,'patrols retain continuity along the perimeter contour');
assert.match(rulesSource,/!isAllowed\(\{x:x\+dx,y:y\+dy\}\)/,'perimeter cells border forbidden territory');
assert.match(runtimeSource,/unit\.nextPatrolAt=target\?now:now\+300/,'successful perimeter legs chain without an idle pause');
assert.match(runtimeSource,/u\.kind==='patrol'\?1\.15/,'perimeter patrols use a visibly readable walking speed');
assert.match(runtimeSource,/Math\.floor\(i\*loop\.length\/patrols\.length\)/,'multiple patrols are spaced by equal perimeter arc');
assert.match(runtimeSource,/whiteBoundarySignature=''/,'White Zone edits invalidate patrol spacing immediately');
assert.match(runtimeSource,/shouldRebuildBoundary\(painting,whiteBoundaryCache\.length>0,signatureChanged\)/,'perimeter rebuilds are frozen while the White brush is dragging');
assert.match(runtimeSource,/rules\.enemyIntent/,'runtime delegates hostile decisions to combat rules');
assert.match(runtimeSource,/safeMilitarySegment\(unit,nextPos/,'hostile and friendly movement share terrain collision checks');
assert.doesNotMatch(rulesSource,/getContext\(|drawImage\(|fillRect\(/,'rules stay independent of canvas rendering');
assert.match(renderSource,/ConquerCombatRules\?\.visualEffects/,'renderer only consumes combat visual effects');
assert.match(renderSource,/u\.kind==='patrol'\?2:5/,'a patrol renders exactly two pikemen');

console.log('combat regression: perimeter traversal and combat assertions passed');
