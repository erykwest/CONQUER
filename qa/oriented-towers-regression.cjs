'use strict';
// Semitowers ('half', open gorge) and D towers ('dee'): tiers and sizes, true outline, wall seats
// on the curtain line, wall contact that keeps the wall straight, gate flanks with the rear aligned.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const root=__dirname+'/../src/';
const read=f=>fs.readFileSync(root+f,'utf8').replace(/\r\n/g,'\n');
const core=read('settlement-core.js'),castle=read('settlement-castle.js'),placement=read('settlement-castle-placement.js');
const pick=(src,re,name)=>{const m=src.match(re)?.[0];assert.ok(m,'use the actual '+name);return m};
const code=[
  pick(core,/const ORIENTED_TOWER_SPECS=[\s\S]*?\nfunction towerFacadePoints\(s\)\{[\s\S]*?\n\}/,'oriented tower specs'),
  pick(core,/function towerTier\(s\)\{[^\n]*\}/,'towerTier'),
  pick(castle,/function rectWorldPoints\([\s\S]*?\n\}/,'rectWorldPoints'),
  pick(placement,/function rectDims\(s\)\{[^\n]*\}/,'rectDims'),
  pick(placement,/function gateSubtowerAttachment\([\s\S]*?\n\}/,'gateSubtowerAttachment'),
  pick(placement,/function rotateVec\([^\n]*\}/,'rotateVec'),
  read('settlement-tower-shapes.js')
].join('\n');
const ctx=vm.createContext({Math,Number,Object,String,Array,
  clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),dist:(a,b)=>Math.hypot(b.x-a.x,b.y-a.y),
  snapStructureAngle:a=>a,wallExteriorSide:w=>w.flip?-1:1,
  footprintPoints:s=>s.shape==='dee'?ctx.orientedTowerOutline(s):ctx.rectWorldPoints(s.x,s.y,ctx.rectDims(s).w,ctx.rectDims(s).h,s.angle||0)});
vm.runInContext(code+'\nObject.assign(this,{orientedTowerOutline,rectWorldPoints,rectDims});',ctx);
const near=(a,b,eps=1e-6)=>Math.abs(a-b)<=eps;
const area=pts=>pts.reduce((s,p,i)=>{const q=pts[(i+1)%pts.length];return s+p.x*q.y-q.x*p.y},0)/2;

{
  const T=(shape,size)=>ctx.towerTier({type:'tower',shape,size});
  assert.deepEqual([T('half',1),T('half',1.5),T('half',2)],[1,2,2],'semitower: small and medium only');
  assert.deepEqual([T('dee',1),T('dee',1.5),T('dee',2)],[2,2,3],'D tower: medium and large only');
  const large=ctx.rectDims({type:'tower',shape:'dee',size:2}),round=.75*2;
  assert.ok(near(large.h,round),'the large D is as wide as a medium round tower');
  assert.ok(large.w>large.h,'the large D grows in depth');
  console.log('PASS tiers and sizes of semitowers and D towers');
}
{
  const s={type:'tower',shape:'dee',size:2,x:3,y:4,angle:Math.PI/2};
  const fp=ctx.orientedTowerOutline(s),d=ctx.rectDims(s);
  assert.ok(area(fp)>0,'outline is counter-clockwise like rectWorldPoints');
  const expected=d.w*d.h-(1-Math.PI/4)*d.h*d.h/2;   // bounding box minus the two front corners
  assert.ok(Math.abs(area(fp)-expected)<.02,'D area: rectangle plus half round');
  const front=Math.max(...fp.map(p=>p.y)),rear=Math.min(...fp.map(p=>p.y));
  assert.ok(near(front,4+d.w/2,1e-9)&&near(rear,4-d.w/2,1e-9),'the half round faces s.angle');
  console.log('PASS D outline faces the field');
}
{
  // Wall along +x, exterior towards +y: the tower rear sits on the wall, the front faces out.
  const wall={type:'wall',a:{x:0,y:0},b:{x:4,y:0},width:.5};
  const snap=ctx.orientedTowerWallSnap('dee',2,wall,'b',{x:4,y:.05});
  const t={type:'tower',shape:'dee',size:2,x:snap.point.x,y:snap.point.y,angle:snap.angle,wallSeat:snap.wallSeat};
  assert.ok(near(snap.angle,Math.PI/2),'front faces the exterior side');
  const fp=ctx.orientedTowerOutline(t);
  assert.ok(near(Math.min(...fp.map(p=>p.y)),-.25),'rear flush with the inner face of the wall');
  const contact=ctx.orientedTowerWallContact(t,wall.a,wall.b);
  assert.ok(near(contact.y,0)&&near(contact.x,4-.75),'the wall stops on the flank, on its own line');
  for(const seat of ctx.orientedTowerSeats(t))assert.ok(near(seat.y,0),'seats lie on the curtain line');
  const other=ctx.orientedTowerWallSnap('half',1,wall,'b',{x:4,y:-.6});
  assert.ok(near(other.angle,-Math.PI/2),'pointer on the other side flips the front');
  console.log('PASS wall snap: rear on the wall, wall kept straight');
}
{
  const gate={type:'gate',shape:'square',size:1.5,x:10,y:10,angle:0};
  const child={type:'tower',shape:'dee',size:2};
  const left=ctx.gateSubtowerAttachment(gate,child,'gate-side:0'),right=ctx.gateSubtowerAttachment(gate,child,'gate-side:2');
  for(const a of [left,right]){
    const t={...child,x:a.point.x,y:a.point.y,angle:a.angle},fp=ctx.orientedTowerOutline(t);
    assert.ok(near(Math.min(...fp.map(p=>p.x)),10-.75),'rear aligned with the back of the gate');
    assert.ok(Math.max(...fp.map(p=>p.x))>10.75+.5,'the half round sticks out in front of the gate');
  }
  assert.ok(near(left.point.y,10-1.5)&&near(right.point.y,10+1.5),'one flank each side, touching the gate');
  assert.equal(ctx.gateSubtowerAttachment(gate,child,'gate-front:1'),null,'no corner sockets for oriented towers');
  console.log('PASS large D towers flank a gate, rear aligned');
}
{
  const s={type:'tower',shape:'half',size:1.5,x:0,y:0,angle:0,level:2};
  const pieces=ctx.halfTowerBodyPieces(s);
  assert.equal(pieces.length,3,'three walls, open gorge');
  for(const p of pieces)assert.ok(area(p)>0,'each slab is a convex quad');
  const total=pieces.reduce((a,p)=>a+area(p),0),d=ctx.rectDims(s);
  assert.ok(total<d.w*d.h*.6,'the gorge is open, not a solid block');
  console.log('PASS semitower body is open at the rear');
}
{
  // One ladder per storey through a hatch: no floor board covers a rung.
  Object.assign(ctx,{structureLevel:s=>s.level,structureHeight:s=>s.level*1.1});
  const inside=(p,poly)=>poly.every((a,i)=>{const b=poly[(i+1)%poly.length];return(b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x)>1e-9});
  for(const size of [1,1.5]){
    const s={type:'tower',shape:'half',size,x:0,y:0,angle:.4,level:3};
    const ladders=ctx.halfTowerLadders(s),decks=ctx.halfTowerFloorDecks(s);
    assert.equal(ladders.filter(l=>l.part==='rail').length,2*s.level,'two rails per storey');
    assert.equal(decks.length,2*s.level,'each floor is two boards around its hatch');
    for(const d of decks)assert.ok(area(d.pts)>0,'boards are convex quads');
    for(const l of ladders.filter(l=>l.part==='rung')){
      const c={x:l.pts.reduce((a,p)=>a+p.x,0)/4,y:l.pts.reduce((a,p)=>a+p.y,0)/4};
      for(const d of decks)if(d.z0<l.z1+.1&&d.z1>l.z0)assert.ok(!inside(c,d.pts),'ladder passes through the hatch');
    }
  }
  console.log('PASS semitower ladders climb through floor hatches');
}
