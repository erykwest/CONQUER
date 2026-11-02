'use strict';
// Rule: a tower hooked to a gate always has its entrance and its interior side on the gate's
// rear (settlement-architecture.js towerGateParent / structureInteriorVector / towerDoorSpecs),
// whatever its own angle; subtowers of a tower keep no ground-floor door.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const arch=fs.readFileSync(__dirname+'/../src/settlement-architecture.js','utf8').replace(/\r\n/g,'\n');
const pick=(re,name)=>{const m=arch.match(re)?.[0];assert.ok(m,'use the actual '+name);return m};
const src=[
  pick(/function towerGateParent\(s\)\{[\s\S]*?\n\}/,'towerGateParent'),
  pick(/function gateRearVector\(g\)\{[^\n]*\}/,'gateRearVector'),
  pick(/function structureInteriorVector\(s\)\{[\s\S]*?\n\}/,'structureInteriorVector'),
  pick(/function towerDoorSpecs\(tower\)\{[\s\S]*?\n\}/,'towerDoorSpecs')
].join('\n');
const State={structures:[]};
const rect=(s)=>{const w=s.size,h=s.size,a=s.angle||0,c=Math.cos(a),n=Math.sin(a);
  return[[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]].map(([x,y])=>({x:s.x+x*c-y*n,y:s.y+x*n+y*c}))};
const ctx=vm.createContext({State,Math,
  underConstruction:()=>false,wallExteriorSide:()=>1,towerRoofDoorSpecs:()=>[],
  isOrientedTower:s=>s.shape==='dee'||s.shape==='half',
  towerFacadePoints:rect,footprintPoints:rect,
  // ray from the centre to the square's edge
  boundaryPoint:(s,p)=>{const dx=p.x-s.x,dy=p.y-s.y,k=(s.size/2)/Math.max(Math.abs(dx),Math.abs(dy));return{x:s.x+dx*k,y:s.y+dy*k}},
  towerDoorContactSpec:(tower,contact,wall,kind)=>({kind,contact,outward:{x:contact.x-tower.x,y:contact.y-tower.y},baseZ:0})});
vm.runInContext(src+'\nthis.api={structureInteriorVector,towerDoorSpecs};',ctx);
const {structureInteriorVector,towerDoorSpecs}=ctx.api;
const near=(a,b,msg)=>assert.ok(Math.abs(a-b)<1e-6,msg+' ('+a+' vs '+b+')');

for(const angle of [0,Math.PI/2,Math.PI]){
  const gate={id:'g',type:'gate',x:10,y:10,angle};
  const rear={x:-Math.cos(angle),y:-Math.sin(angle)};
  for(const tower of [
    {id:'sq',type:'tower',shape:'square',size:1.5,x:10-Math.sin(angle)*1.5,y:10+Math.cos(angle)*1.5,angle:0,parentTowerId:'g'},
    {id:'rd',type:'tower',shape:'round',r:.75,x:10+Math.sin(angle)*1.5,y:10-Math.cos(angle)*1.5,angle:Math.PI/3,parentTowerId:'g'},
    {id:'dee',type:'tower',shape:'dee',size:1.5,x:10,y:12,angle,parentTowerId:'g'}
  ]){
    State.structures=[gate,tower];
    const iv=structureInteriorVector(tower);
    near(iv.x,rear.x,tower.shape+' interior x follows the gate rear');near(iv.y,rear.y,tower.shape+' interior y follows the gate rear');
    const doors=towerDoorSpecs(tower).filter(d=>d.kind==='front');
    assert.equal(doors.length,1,tower.shape+' hooked to a gate has one ground-floor entrance');
    const o=doors[0].outward,L=Math.hypot(o.x,o.y);
    assert.ok((o.x*rear.x+o.y*rear.y)/L>.99,tower.shape+' entrance faces the gate rear (angle '+angle.toFixed(2)+')');
  }
}
{
  // A subtower of a tower keeps no ground-floor door; an independent tower opens along its angle.
  const parent={id:'p',type:'tower',shape:'square',size:2,x:0,y:0,angle:0};
  const sub={id:'s',type:'tower',shape:'square',size:1,x:1.5,y:0,angle:0,parentTowerId:'p'};
  State.structures=[parent,sub];
  assert.equal(towerDoorSpecs(sub).length,0,'tower subtowers have no ground-floor door');
  const own=towerDoorSpecs(parent);
  assert.equal(own.length,1);assert.ok(own[0].outward.x>0,'independent tower door along its angle');
}
console.log('PASS towers hooked to a gate enter from the gate rear, interior side included');
