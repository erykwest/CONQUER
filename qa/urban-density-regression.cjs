'use strict';
// Road-frontage density QA: executes the real urban geometry in an isolated VM.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const house={id:'h',type:'house',auto:true,houseLevel:3,x:3,y:1.4,w:1.5,h:1,angle:0};
const road={id:'main',type:'road',routeId:'arterial',a:{x:0,y:-.45},b:{x:6,y:-.45},width:.62};
const side={id:'side',type:'road',routeId:'arterial',a:{x:6.45,y:0},b:{x:6.45,y:4},width:.62};
function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
function closestPointOnSegment(p,a,b){
  const dx=b.x-a.x,dy=b.y-a.y;
  const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));
  return{x:a.x+dx*t,y:a.y+dy*t};
}
function rectWorldPoints(cx,cy,w,h,angle=0){
  const ca=Math.cos(angle),sa=Math.sin(angle);
  return [[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]]
    .map(([x,y])=>({x:cx+x*ca-y*sa,y:cy+x*sa+y*ca}));
}
const State={structures:[house,road],environment:[]};
const sandbox={
  State,window:{},dist,rectWorldPoints,
  closestPointOnSegment,
  pointSegmentDistance:(p,a,b)=>dist(p,closestPointOnSegment(p,a,b)),
  houseLevel:s=>s.houseLevel||1,
  primaryRoadList:()=>State.structures.filter(s=>s.type==='road'&&s.routeId),
  houseFootprintParts:s=>[{kind:'body',center:{x:s.x,y:s.y},w:s.w,h:s.h,
    points:rectWorldPoints(s.x,s.y,s.w,s.h,s.angle)}]
};
const context=vm.createContext(sandbox),run=source=>vm.runInContext(source,context);
const script=fs.readFileSync(__dirname+'/../src/settlement-urban.js','utf8');
run(script);
run("urbanLotCache=[{houseId:'h',points:[{x:0,y:0},{x:6,y:0},{x:6,y:4},{x:0,y:4}]}]");
const lot=run('urbanLotCache[0]');
let passed=0;
function test(name,fn){fn();passed++;console.log('PASS '+name)}
test('L1 and L2 remain single-house lots',()=>{
  house.houseLevel=1;assert.equal(run('urbanDenseParts(State.structures[0]).length'),0);
  house.houseLevel=2;assert.equal(run('urbanDenseParts(State.structures[0]).length'),0);
});
test('L3 frontage creates three houses within a 6 U street-facing plot',()=>{
  house.houseLevel=3;
  assert.equal(run('urbanLotRoadFrontages(urbanLotCache[0]).length'),1);
  assert.equal(run('urbanDenseParts(State.structures[0]).length'),3);
  assert.equal(run('urbanFenceSegments([urbanLotCache[0]],[]).length'),0);
  assert.equal(State.structures.filter(s=>s.type==='house').length,1);
});
test('L4 increases frontage density and keeps all buildings within the parcel',()=>{
  house.houseLevel=4;
  assert.equal(run('urbanDenseParts(State.structures[0]).length'),4);
  assert.ok(run('urbanDenseParts(State.structures[0]).every(p=>p.points.every(q=>urbanContains(urbanLotCache[0].points,q,.05)))'));
  assert.ok(run('urbanDenseParts(State.structures[0]).every((p,i,a)=>i===0||dist(p.center,a[i-1].center)<2)'));
  assert.ok(run('urbanDenseHouseDoorInfo(State.structures[0]).outside.y<0'));
});
test('frontage on an additional primary road produces more infill units',()=>{
  State.structures.push(side);run('urbanRevision++');
  assert.equal(run('urbanLotRoadFrontages(urbanLotCache[0]).length'),2);
  assert.ok(run('urbanDenseParts(State.structures[0]).length')>4);
});
test('no primary road frontage means no additional buildings',()=>{
  road.a.y=-4;road.b.y=-4;side.a.x=10;side.b.x=10;run('urbanRevision++');
  assert.equal(run('urbanDenseParts(State.structures[0]).length'),0);
  assert.equal(run('urbanHouseDisplayParts(State.structures[0]).length'),1);
});
console.log('Urban density regression: '+passed+' passed');
