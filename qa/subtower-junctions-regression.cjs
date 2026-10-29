'use strict';
// Parent/subtower junctions: merlons of the lower structure that fall inside the taller attached
// one are dropped, and the taller one opens a door onto the lower one's roof at that roof's level.
const fs=require('node:fs');
const harness=fs.readFileSync(__dirname+'/urban-regression.cjs','utf8').split('let passed=0;')[0];
eval(harness+`
run(fs.readFileSync(__dirname+'/../src/settlement-architecture.js','utf8'));
let passed=0;
function check(name,body){body();passed++;console.log('PASS '+name)}
const tower=(id,x,level,extra={})=>({id,type:'tower',shape:'square',material:'stone',size:1.5,tier:2,level,roofStyle:'battlement',x,y:100,angle:0,functions:[],...extra});
const setup=list=>{run('State.structures').splice(0,Infinity,...list);return list};

check('merlons buried in a taller attached tower are dropped',()=>{
  const [parent,child]=setup([tower('p',100,3),tower('c',101.1,1,{size:1,parentTowerId:'p'})]);
  const alone=run('squareTowerBattlementPieces')(child).length,kept=run('towerBattlementPieces')(child);
  assert.ok(kept.length<alone,'some subtower merlons are removed: '+kept.length+' < '+alone);
  const pts=run('footprintPoints')(parent),inside=run('pointInPolygon');
  for(const p of kept){const c={x:p.pts.reduce((a,q)=>a+q.x,0)/p.pts.length,y:p.pts.reduce((a,q)=>a+q.y,0)/p.pts.length};assert.ok(!inside(c,pts),'no kept merlon inside the parent')}
  assert.equal(run('towerBattlementPieces')(parent).length,run('squareTowerBattlementPieces')(parent).length,'the taller parent keeps all its merlons');
});
check('the taller tower opens a door onto the lower roof',()=>{
  const [parent,child]=setup([tower('p',100,3),tower('c',101.1,1,{size:1,parentTowerId:'p'})]);
  const doors=run('towerRoofDoorSpecs')(parent);
  assert.equal(doors.length,1);
  assert.equal(doors[0].kind,'roof');
  assert.ok(doors[0].outward.x>.9,'door on the face looking at the subtower');
  assert.ok(doors[0].baseZ>.08&&doors[0].baseZ<run('structureHeight')(parent),'door at the lower roof level');
  assert.equal(run('towerRoofDoorSpecs')(child).length,0,'the lower one gets no roof door');
  setup([tower('p',100,1),tower('c',101.1,1,{size:1,parentTowerId:'p'})]);
  assert.equal(run('towerRoofDoorSpecs')(run('State.structures')[0]).length,0,'same height: no roof door');
});
console.log('subtower junctions regression: '+passed+' checks');
`);
