'use strict';
// Road magnets on bridges: the main-road tool snaps a road end exactly onto either end of any
// bridge (also from the deck), the road may then touch the bridge it leads onto, gate mouths
// still win, and the bridge ends are drawn as magnets while the road tool is active.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const root=__dirname+'/../src/';
const read=f=>fs.readFileSync(root+f,'utf8');
const fn=(src,name)=>{const i=src.indexOf('function '+name+'(');assert.ok(i>=0,name);let d=0,j=src.indexOf('{',i);for(;j<src.length;j++){if(src[j]==='{')d++;else if(src[j]==='}'&&--d===0)break}return src.slice(i,j+1)};
const world=read('settlement-world.js'),placement=read('settlement-castle-placement.js');

const bridge={id:'br',type:'bridge',variant:'wood',a:{x:0,y:0},b:{x:4,y:0},width:1.2};
const gate={id:'g',type:'gate',x:20,y:0,size:1.5,angle:0};
const State={structures:[bridge,gate],village:{}};
const ctx=vm.createContext({Math,Number,State,ROAD_RULES:{snapNodeDistance:1.15},
  dist:(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),
  rectDims:s=>({w:s.size||1.5,h:s.size||1.5}),snapGrid:v=>Math.round(v*2)/2,
  ensureBorderEntrySelection:()=>[],roadList:()=>State.structures.filter(s=>s.type==='road'),
  closestPointOnSegment:(p,a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,L2=dx*dx+dy*dy||1,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/L2));return{x:a.x+dx*t,y:a.y+dy*t}}});
vm.runInContext(['rotateVec','toLocalPoint'].map(n=>fn(placement,n)).join('\n')+'\n'+
  ['gatePassageInfo','roadMeetsBridgeEnd','gateRoadPort','bridgeRoadEnd','mainRoadSnapAnchor'].map(n=>fn(world,n)).join('\n'),ctx);

{
  const east=ctx.mainRoadSnapAnchor({x:4.6,y:.4}),west=ctx.mainRoadSnapAnchor({x:-.7,y:-.5});
  assert.ok(east.magnet&&east.bridgeEnd&&east.point.x===4&&east.point.y===0,'snaps exactly onto end b');
  assert.ok(west.bridgeEnd&&west.point.x===0&&west.point.y===0,'and onto end a');
  assert.equal(east.bridgeEnd.bridgeId,'br');
  assert.equal(ctx.mainRoadSnapAnchor({x:7,y:0}).magnet,false,'no magnet away from the bridge');
  console.log('PASS road ends snap onto both bridge ends');
}
{
  const nearA=ctx.mainRoadSnapAnchor({x:1.5,y:.3}),nearB=ctx.mainRoadSnapAnchor({x:2.6,y:-.3});
  assert.ok(nearA.bridgeEnd?.end==='a'&&nearB.bridgeEnd?.end==='b','a pointer on the deck takes the nearer end');
  assert.equal(ctx.mainRoadSnapAnchor({x:2,y:1.6}).magnet,false,'beside the deck middle there is no magnet');
  console.log('PASS a pointer on the deck snaps to the nearer end');
}
{
  // Half-bridges, main-road decks and bridges under construction are magnets as well.
  State.structures.push({id:'half',type:'bridge',variant:'wood',a:{x:0,y:10},b:{x:0,y:12},width:1.2,halfBridgeFor:'g',construction:{}},
    {id:'deck',type:'bridge',variant:'stone',auto:true,primaryBridgeFor:'r',a:{x:10,y:10},b:{x:12,y:10},width:1.2});
  assert.equal(ctx.mainRoadSnapAnchor({x:.3,y:9.4}).bridgeEnd?.bridgeId,'half');
  assert.equal(ctx.mainRoadSnapAnchor({x:12.5,y:10.2}).bridgeEnd?.bridgeId,'deck');
  State.structures.splice(2);
  console.log('PASS every bridge variant has end magnets');
}
{
  const port=ctx.mainRoadSnapAnchor({x:19.1,y:.2});
  assert.ok(port.gatePort&&!port.bridgeEnd,'gate mouths keep their magnet');
  State.structures.push({id:'r1',type:'road',a:{x:4.5,y:3},b:{x:4.5,y:8}});
  assert.equal(ctx.mainRoadSnapAnchor({x:4.5,y:2.9}).bridgeEnd,undefined,'a nearer road node wins');
  assert.ok(ctx.mainRoadSnapAnchor({x:4.2,y:.2}).bridgeEnd,'a nearer bridge end wins');
  State.structures.splice(2);
  console.log('PASS gate and road magnets keep working');
}
{
  const road=(ax,ay,bx,by)=>({type:'road',a:{x:ax,y:ay},b:{x:bx,y:by},width:.62});
  assert.equal(ctx.roadMeetsBridgeEnd(road(4,0,9,2),bridge),true,'a road leaving end b');
  assert.equal(ctx.roadMeetsBridgeEnd(road(-5,-3,0,0),bridge),true,'a road arriving at end a');
  assert.equal(ctx.roadMeetsBridgeEnd(road(4,0,1,.3),bridge),false,'a road doubling back over the deck');
  assert.equal(ctx.roadMeetsBridgeEnd(road(4.6,0,9,2),bridge),false,'a road that only passes near the end');
  assert.match(world,/manual\.type==='bridge'&&roadMeetsBridgeEnd\(road,manual\)\)return false/,'roads may touch the bridge they lead onto');
  assert.match(read('settlement-placement.js'),/s\.type==='bridge'&&roadMeetsBridgeEnd\(other,s\)\)return false/,'and bridges the road they lead from');
  console.log('PASS a road joined to a bridge end is not an overlap');
}
{
  const input=read('settlement-app-input.js');
  assert.match(input,/\['wall','palisade','road'\]\.includes\(State\.tool\.linear\)/,'the road tool lights magnets before the first click');
  assert.match(placement,/s\.type!==\(road\?'bridge':type\)/,'bridge ends are drawn as road magnets');
  const html=fs.readFileSync(__dirname+'/../index.html','utf8');
  assert.match(html,/settlement-world\.js\?v=bridge-magnet-1/,'index.html loads the new world script');
  console.log('PASS the road tool shows the bridge magnets');
}
