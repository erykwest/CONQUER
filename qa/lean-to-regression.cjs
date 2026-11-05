'use strict';
// BC-251105-03/10: the lean-to is a W1 built section against the inner face of an H2 wall,
// one storey with the W1 section's rooms (so the same simulated capacities), and a single-pitch
// roof whose top edge leans on the wall under the wall walk.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const root=__dirname+'/../src/';
const read=f=>fs.readFileSync(root+f,'utf8');
const pick=(src,re,name)=>{const m=src.match(re)?.[0];assert.ok(m,'use the actual '+name);return m};
const core=read('settlement-core.js'),structures=read('settlement-castle-structures.js'),placement=read('settlement-castle-placement.js');
const src=[
  pick(core,/function isWideBuilt\([^\n]*\n/,'isWideBuilt'),
  pick(core,/function builtInteriorFloors\([^\n]*\n/,'builtInteriorFloors'),
  pick(core,/function isLonghouse\([^\n]*\n/,'isLonghouse'),
  pick(core,/function isLeanTo\([^\n]*\n/,'isLeanTo'),
  pick(core,/function maxStructureLevel\([^\n]*\n/,'maxStructureLevel'),
  pick(core,/function structureLevel\([\s\S]*?\n\}/,'structureLevel'),
  pick(structures,/function builtRoofFootprintPoints\([\s\S]*?\n\}/,'builtRoofFootprintPoints'),
  pick(structures,/function builtRoofGeometry\([\s\S]*?\n\}/,'builtRoofGeometry'),
  pick(structures,/function wallExteriorSide\([^\n]*\n/,'wallExteriorSide'),
  pick(placement,/function functionCapacity\([\s\S]*?\n\}/,'functionCapacity'),
  read('settlement-lean-to.js')
].join('\n');
const height=s=>s.type==='wall'?[1.15,2.10][(s.level||1)-1]:s.leanTo?1.40:[1.75,2.80][(s.level||1)-1];
function fixture(structures){
  const State={structures,buildMasonryMaterial:'stone'};let id=0;
  const ctx=vm.createContext({State,window:{},console,Math,Number,Object,Array,
    TYPES:{built:{width:1},builtWide:{width:2}},clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),
    uid:()=>'lt'+(++id),underConstruction:s=>!!s.building,isWoodGate:()=>false,isSmallGate:()=>false,
    isKeepW4:()=>false,civicLevel:()=>1,towerTier:()=>2,masonryMaterial:()=>'stone',hasCastleSnap:v=>!!v,
    structureHeight:height,
    pointSegmentDistance:(p,a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy)));return Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t)}});
  vm.runInContext(src+'\nthis.api={isLeanTo,structureLevel,builtRoofGeometry,functionCapacity};',ctx);
  return{L:ctx.window.ConquerLeanTo,...ctx.api,State};
}
const wall=(o={})=>({id:'wall',type:'wall',a:{x:0,y:0},b:{x:8,y:0},length:8,width:.5,tier:2,level:2,aSnap:'tA',bSnap:'tB',...o});

{
  const f=fixture([wall()]);
  const r=f.L.atPoint({x:4,y:-.6});
  assert.ok(r.ok,r.reason);
  const s=r.structure;
  assert.ok(f.isLeanTo(s)&&s.type==='built'&&s.leanWallId==='wall','a built section tied to its wall');
  // Not flipped: exterior on +n (y>0), so the lean-to stands at y<0, touching the inner face.
  assert.ok(Math.abs(s.a.y+(.25+.5))<1e-9&&Math.abs(s.b.y-s.a.y)<1e-9,'along the inner face, flush with it');
  assert.ok(Math.abs(s.a.x-.55)<1e-9&&Math.abs(s.b.x-7.45)<1e-9&&Math.abs(s.length-6.9)<1e-9,'clear of the tower sockets');
  assert.equal(f.structureLevel({...s,level:2}),1,'one storey only');
  assert.equal(f.functionCapacity(s),1,'one room, like a W1 section on the ground floor');
  console.log('PASS a lean-to is placed against the inner face of an H2 wall');

  const g=f.builtRoofGeometry(s);
  assert.ok(g.leanTo,'single-pitch roof');
  assert.ok(Math.abs(g.ridgeH-(2.10-.12))<1e-9&&g.ridgeH<2.10,'top edge under the wall walk');
  assert.ok(g.ridgeA.y>s.a.y&&g.ridgeB.y>s.b.y,'top edge on the wall side');
  assert.ok(Math.abs(g.h-1.40)<1e-9&&g.rise>.5,'eaves on the open side, a real slope');
  console.log('PASS the lean-to roof leans on the wall under the walk');
}
{
  const f=fixture([wall({flip:true})]);
  const s=f.L.atPoint({x:4,y:.6}).structure;
  assert.ok(s.a.y>0,'flipped wall: the lean-to goes to the other side');
  const g=f.builtRoofGeometry(s);
  assert.ok(g.ridgeA.y<s.a.y,'and its roof still rises to the wall');
  console.log('PASS both wall orientations');
}
{
  assert.match(fixture([wall({level:1})]).L.atPoint({x:4,y:0}).reason,/H2/,'H1 walls are too low');
  assert.match(fixture([wall({b:{x:2.5,y:0},length:2.5})]).L.atPoint({x:1,y:0}).reason,/too short/,'needs 2U for its room');
  assert.match(fixture([wall(),{id:'old',type:'built',leanTo:true,leanWallId:'wall'}]).L.atPoint({x:4,y:0}).reason,/already/,'one per wall');
  assert.ok(!fixture([wall()]).L.atPoint({x:4,y:5}).ok,'far from any wall');
  console.log('PASS lean-to placement rules');
}
// Simulated effect: the siege/economy capacities count the rooms of every built section, the
// lean-to included (no lean-to exclusion in eligibleRoom/allowed).
{
  const siege=read('settlement-siege.js');
  assert.ok(!/leanTo|isLeanTo/.test(siege),'the lean-to rooms count like any W1 section room');
  console.log('PASS lean-to rooms feed the same capacities');
}
