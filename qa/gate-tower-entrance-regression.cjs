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
  pick(/function closestFootprintEdge\(s,p\)\{[\s\S]*?\n\}/,'closestFootprintEdge'),
  pick(/function towerWallLinks\(tower\)\{[\s\S]*?\n\}/,'towerWallLinks'),
  pick(/const CORNER_TOWER_MAX_ANGLE=[^\n]*/,'corner constants'),
  pick(/function squareTowerGroundDoorBlocked\(tower\)\{[\s\S]*?\n\}/,'squareTowerGroundDoorBlocked'),
  pick(/function towerDoorSpecs\(tower\)\{[\s\S]*?\n\}/,'towerDoorSpecs'),
  pick(/function towerWindowGivesWayToDoor\(s,edgeOrDir,floor\)\{[\s\S]*?\n\}/,'towerWindowGivesWayToDoor')
].join('\n');
const State={structures:[]};
const rect=(s)=>{const w=s.size,h=s.size,a=s.angle||0,c=Math.cos(a),n=Math.sin(a);
  return[[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]].map(([x,y])=>({x:s.x+x*c-y*n,y:s.y+x*n+y*c}))};
const ctx=vm.createContext({State,Math,window:{},
  clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),dist:(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),
  closestPointOnSegment:(p,a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return{x:a.x+dx*t,y:a.y+dy*t}},
  underConstruction:()=>false,wallExteriorSide:()=>1,towerRoofDoorSpecs:()=>[],
  isOrientedTower:s=>s.shape==='dee'||s.shape==='half',
  towerFacadePoints:rect,footprintPoints:rect,
  // ray from the centre to the square's edge
  boundaryPoint:(s,p)=>{const dx=p.x-s.x,dy=p.y-s.y,k=(s.size/2)/Math.max(Math.abs(dx),Math.abs(dy));return{x:s.x+dx*k,y:s.y+dy*k}},
  towerDoorContactSpec:(tower,contact,wall,kind)=>({kind,contact,outward:{x:contact.x-tower.x,y:contact.y-tower.y},baseZ:0})});
ctx.towerOpeningZ=(s,floor)=>.835+(floor-1)*1.5;
vm.runInContext(src+'\nthis.api={structureInteriorVector,towerDoorSpecs,towerWindowGivesWayToDoor};',ctx);
const {structureInteriorVector,towerDoorSpecs,towerWindowGivesWayToDoor}=ctx.api;
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

{
  // Corner square tower: two walls meeting at the tower. Aligned with the walls there is no
  // room for the ground-floor door; turned 45° with its front into the corner, the door stays.
  const front=t=>towerDoorSpecs(t).filter(d=>d.kind==='front');
  const wall=(id,tower,far,end='a')=>({id,type:'wall',[end]:{x:tower.x,y:tower.y},[end==='a'?'b':'a']:far,[end+'Snap']:tower.id});
  // Walls leave towards +x and +y: the courtyard lies on the +x+y diagonal.
  const corner=(angle)=>{const t={id:'c',type:'tower',shape:'square',size:2,x:0,y:0,angle};
    State.structures=[t,wall('w1',t,{x:10,y:0}),wall('w2',t,{x:0,y:10},'b')];return t};
  for(const angle of [0,Math.PI/2,Math.PI,-Math.PI/2])
    assert.equal(front(corner(angle)).length,0,'aligned corner tower (angle '+angle.toFixed(2)+'): no ground door');
  assert.equal(front(corner(Math.PI/4)).length,1,'turned 45° facing the courtyard: the door stays');
  {
    // Turned 45° with the walls snapped to the two corners of the front face (on the curtain lines).
    const t={id:'c',type:'tower',shape:'square',size:2,x:0,y:0,angle:Math.PI/4},v=Math.SQRT2;
    State.structures=[t,{id:'w1',type:'wall',a:{x:v,y:0},b:{x:10,y:0},aSnap:'c'},{id:'w2',type:'wall',a:{x:0,y:10},b:{x:0,y:v},bSnap:'c'}];
    assert.equal(front(t).length,1,'turned 45°, walls on the corners of the front face: the door stays');
  }
  assert.equal(front(corner(Math.PI/4+Math.PI)).length,0,'turned 45° facing the field: no door');
  // Walls in line (a tower along a curtain): the door is not touched.
  const t={id:'m',type:'tower',shape:'square',size:2,x:0,y:0,angle:Math.PI/2};
  State.structures=[t,wall('w1',t,{x:10,y:0}),wall('w2',t,{x:-10,y:0})];
  assert.equal(front(t).length,1,'tower along a straight curtain keeps its door');
  // One wall plugged into the door face buries the door.
  const f={id:'f',type:'tower',shape:'square',size:2,x:0,y:0,angle:0};
  State.structures=[f,{id:'w',type:'wall',a:{x:1,y:0},b:{x:10,y:0},aSnap:'f'}];
  assert.equal(front(f).length,0,'a wall on the door face: no ground door');
  State.structures=[f,{id:'w',type:'wall',a:{x:0,y:1},b:{x:0,y:10},aSnap:'f'}];
  assert.equal(front(f).length,1,'a wall on a side face: the door stays');
  // Round towers are not affected by this rule.
  const r={id:'r',type:'tower',shape:'round',r:1,x:0,y:0,angle:0};
  State.structures=[r,wall('w1',r,{x:10,y:0}),wall('w2',r,{x:0,y:10},'b')];
  assert.equal(front(r).length,1,'round corner towers keep their door (for now)');
  assert.match(fs.readFileSync(__dirname+'/../src/settlement-world.js','utf8'),/squareTowerGroundDoorBlocked\(tower\)\)return null/,'no service road to a door-less corner tower');
  console.log('PASS corner square towers: no ground door unless turned 45° into the corner');
}
{
  // Two walls on a tower: the window of a face steps aside for the wall-walk door opening there.
  const t={id:'d',type:'tower',shape:'square',size:2,x:0,y:0,angle:0};
  ctx.towerDoorContactSpec=(tower,contact,wall,kind)=>{const o={x:contact.x-tower.x,y:contact.y-tower.y},L=Math.hypot(o.x,o.y)||1;
    return{kind,contact,outward:{x:o.x/L,y:o.y/L},baseZ:wall?2.08:.035,apexZ:wall?3:.98}};
  State.structures=[t,{id:'w1',type:'wall',a:{x:1,y:0},b:{x:10,y:0},aSnap:'d'},{id:'w2',type:'wall',a:{x:0,y:10},b:{x:0,y:1},bSnap:'d'}];
  const face=(nx,ny)=>({nx,ny});
  assert.equal(towerWindowGivesWayToDoor(t,face(1,0),2),true,'east face, storey 2: the wall door takes the window place');
  assert.equal(towerWindowGivesWayToDoor(t,face(0,1),2),true,'south face, storey 2: the wall door takes the window place');
  assert.equal(towerWindowGivesWayToDoor(t,face(-1,0),2),false,'a face without a door keeps its window');
  assert.equal(towerWindowGivesWayToDoor(t,face(1,0),3),false,'other storeys keep their window');
  assert.match(fs.readFileSync(__dirname+'/../src/settlement-render.js','utf8'),/STRUCTURE_VISUAL_FIELDS=[^;]*'isMastio'/,'both renderers rebuild doors and windows when the mastio changes');
  console.log('PASS wall-walk doors take the place of the window on their face');
}
