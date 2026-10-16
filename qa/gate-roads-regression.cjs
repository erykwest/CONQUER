'use strict';
// Castle gates and roads: a road magnet sits just outside the front and the rear opening of the
// passage, a road ending there or running through the passage is not a conflict, a road
// cutting across the gate still is.
const fs=require('node:fs');
const harness=fs.readFileSync(__dirname+'/urban-regression.cjs','utf8').split('let passed=0;')[0];
eval(harness+`
let passed=0;
function check(name,body){body();passed++;console.log('PASS '+name)}
run("State.environment=[];State.relief=null;clearReliefBandCache();State.village={};State.structures=[{id:'g',type:'gate',x:100,y:100,w:2,h:1.4,level:2,angle:0,functions:[]}];");
const gate=run("State.structures[0]"),info=run('gatePassageInfo')(gate),snap=run('mainRoadSnapAnchor'),uses=run('roadUsesGatePassage'),conflict=run('manualRoadConflict');
check('road magnets on the front and rear of the passage',()=>{
  for(const end of [info.sideA,info.sideB]){
    const s=snap({x:end.x+.3,y:end.y+.2});
    assert.ok(s.magnet&&Math.hypot(s.point.x-end.x,s.point.y-end.y)<1e-9,'snaps to the opening');
  }
  assert.ok(Math.abs(info.sideA.x-info.sideB.x)>2,'front and rear are on opposite sides of the gate');
});
check('roads ending at an opening or running through the passage are allowed',()=>{
  const road=(a,b)=>({type:'road',a,b,width:.62});
  assert.ok(!conflict(road(info.sideA,{x:info.sideA.x-6,y:info.sideA.y}),gate),'ends at the front opening');
  assert.ok(!conflict(road(info.sideB,{x:info.sideB.x+6,y:info.sideB.y}),gate),'ends at the rear opening');
  assert.ok(!conflict(road({x:94,y:100},{x:106,y:100}),gate),'runs through the passage');
  assert.ok(uses(road(info.sideA,{x:info.sideA.x-6,y:info.sideA.y}),gate));
});
check('a road across the gate is still a conflict',()=>{
  assert.ok(conflict({type:'road',a:{x:100,y:94},b:{x:100,y:106},width:.62},gate),'perpendicular through the towers');
  assert.ok(conflict({type:'road',a:{x:94,y:100.9},b:{x:106,y:100.9},width:.62},gate),'parallel but off the passage');
});
console.log('gate roads regression: '+passed+' checks');
`);
