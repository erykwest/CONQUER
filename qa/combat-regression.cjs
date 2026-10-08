'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.resolve(__dirname,'..');
const rulesSource=fs.readFileSync(path.join(root,'src','settlement-combat-rules.js'),'utf8');
const runtimeSource=fs.readFileSync(path.join(root,'src','settlement-combat.js'),'utf8');
const renderSource=fs.readFileSync(path.join(root,'src','settlement-combat-render.js'),'utf8');
const sandbox={window:{},Math:Object.create(Math)};
sandbox.Math.random=()=>.99;
vm.runInNewContext(rulesSource,sandbox,{filename:'settlement-combat-rules.js'});
const rules=sandbox.window.ConquerCombatRules;

assert.ok(rules,'combat rules are exported');
assert.equal(rules.shooterRange({h:4},{h:1}),18,'downhill fire gains one unit per height level');
assert.equal(rules.shooterRange({h:1},{h:4}),12,'uphill fire loses one unit per height level');
assert.equal(rules.ensure({kind:'patrol'},'patrol').maxHp,40,'a two-pikeman patrol uses the scaled patrol profile');

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
assert.match(runtimeSource,/function whiteBoundaryPoints\(\)/,'patrol waypoints are generated from the White Zone perimeter');
assert.match(runtimeSource,/patrolBoundaryIndex/,'patrols retain continuity along the perimeter contour');
assert.match(runtimeSource,/!areaState\(\{x:x\+dx,y:y\+dy\}\)\.allowed/,'perimeter cells border forbidden territory');
assert.match(runtimeSource,/rules\.enemyIntent/,'runtime delegates hostile decisions to combat rules');
assert.match(runtimeSource,/safeMilitarySegment\(unit,nextPos/,'hostile and friendly movement share terrain collision checks');
assert.doesNotMatch(rulesSource,/getContext\(|drawImage\(|fillRect\(/,'rules stay independent of canvas rendering');
assert.match(renderSource,/ConquerCombatRules\?\.visualEffects/,'renderer only consumes combat visual effects');
assert.match(renderSource,/u\.kind==='patrol'\?2:5/,'a patrol renders exactly two pikemen');

console.log('combat regression: 24 assertions passed');
