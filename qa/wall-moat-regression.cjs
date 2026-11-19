'use strict';
// Moat dug from a selected wall, palisade or built section (ConquerCrossings.digAlongWall):
// a small moat whose inner bank touches the wall's exterior face, joined at the mitre to the
// moat of a neighbouring wall, never across a gate; water only at level 0.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const root=__dirname+'/../src/';
const src=fs.readFileSync(root+'settlement-crossings.js','utf8');

function fixture({level=0}={}){
  const State={clock:{day:3},structures:[],view:{scale:1},selectedId:null,resources:{},buildMasonryMaterial:'stone'};
  const messages=[];
  const ctx=vm.createContext({
    State,window:{},console,Math,Object,Array,Map,Set,String,Number,JSON,performance:{now:()=>0},
    TYPES:{built:{width:1}},wallExteriorSide:s=>s?.flip?-1:1,
    inBuild:()=>true,terrainSlopeKind:()=>null,terrainPlateauElevation:()=>level,terrainElevation:()=>level,
    constructionCost:()=>({gold:1}),beginConstruction:()=>{},underConstruction:s=>!!s.construction,
    markDirty:()=>{},renderFunctionPanel:()=>{},draw:()=>{},status:m=>messages.push(m),selectStructure:()=>{},
    structureUpgradeSnapshot:()=>({}),beginStructureUpgrade:()=>{},
    uid:(()=>{let n=0;return()=>'id'+(++n)})()
  });
  vm.runInContext(src,ctx);
  return{State,C:ctx.window.ConquerCrossings,messages};
}
const near=(p,x,y,msg)=>assert.ok(Math.hypot(p.x-x,p.y-y)<1e-9,msg+' (got '+p.x+','+p.y+')');

{
  // A T2 wall (0.5U) along x, exterior towards -y: the 1.5U moat runs at y = -(0.25+0.75).
  const {State,C}=fixture();
  const w={id:'w1',type:'wall',width:.5,flip:true,a:{x:0,y:0},b:{x:6,y:0}};
  State.structures.push(w);
  assert.equal(C.digAlongWall(w,'dry'),true);
  const m=C.wallMoatOf(w);
  assert.ok(m&&m.type==='moat'&&m.variant==='dry'&&m.width===1.5);
  near(m.a,0,-1,'moat a outside wall a');near(m.b,6,-1,'moat b outside wall b');
  assert.equal(C.digAlongWall(w,'dry'),false,'one moat per wall');
  // Flipping the exterior puts the moat of another wall on the other face.
  const w2={id:'w2',type:'palisade',width:.2,a:{x:0,y:10},b:{x:6,y:10}};
  State.structures.push(w2);
  assert.equal(C.digAlongWall(w2,'dry'),true);
  near(C.wallMoatOf(w2).a,0,10+.1+.75,'palisade exterior is +normal when not flipped');
  console.log('PASS the moat touches the exterior face of the wall');
}
{
  // Two walls meeting at a corner: the second moat joins the first at the mitre.
  const {State,C}=fixture();
  const w1={id:'w1',type:'wall',width:.5,flip:true,a:{x:0,y:0},b:{x:6,y:0}};
  const w2={id:'w2',type:'wall',width:.5,flip:true,a:{x:6,y:0},b:{x:6,y:6}};
  State.structures.push(w1,w2);
  C.digAlongWall(w1,'dry');C.digAlongWall(w2,'dry');
  const m1=C.wallMoatOf(w1),m2=C.wallMoatOf(w2);
  near(m1.b,7,-1,'first moat extended to the mitre');near(m2.a,7,-1,'second moat starts at the mitre');
  assert.equal(m1.bSnap,m2.id);assert.equal(m2.aSnap,m1.id);
  near(m2.b,7,6,'free end stays at the wall end');
  const chains=C.moatChains([m1,m2]);
  assert.equal(chains.length,1,'one continuous moat chain around the corner');
  console.log('PASS neighbouring wall moats join at the corner');
}
{
  // Walls on both sides of a gate: the passage stays open.
  const {State,C}=fixture();
  const gate={id:'g',type:'gate',x:6,y:0,size:1.5,angle:-Math.PI/2};
  const w1={id:'w1',type:'wall',width:.5,flip:true,a:{x:0,y:0},b:{x:5.25,y:0},bSnap:'g'};
  const w2={id:'w2',type:'wall',width:.5,flip:true,a:{x:6.75,y:0},b:{x:12,y:0},aSnap:'g'};
  State.structures.push(gate,w1,w2);
  C.digAlongWall(w1,'dry');C.digAlongWall(w2,'dry');
  near(C.wallMoatOf(w1).b,5.25,-1,'stops at the gate');near(C.wallMoatOf(w2).a,6.75,-1,'resumes after the gate');
  console.log('PASS no moat is dug across a gate');
}
{
  // Built section uses its own width; lean-tos and walls under construction are refused.
  const {State,C}=fixture();
  const b={id:'b',type:'built',width:1,flip:false,a:{x:0,y:0},b:{x:4,y:0}};
  const lean={id:'l',type:'built',leanTo:true,width:1,a:{x:0,y:3},b:{x:4,y:3}};
  const site={id:'s',type:'wall',width:.5,a:{x:0,y:6},b:{x:4,y:6},construction:{progress:.2}};
  State.structures.push(b,lean,site);
  assert.equal(C.digAlongWall(b,'dry'),true);
  near(C.wallMoatOf(b).a,0,.5+.75,'built section: half its width plus half the moat');
  assert.equal(C.planWallMoat(lean).ok,false,'no moat from a lean-to');
  assert.equal(C.planWallMoat(site).ok,false,'no moat from a wall still under construction');
  console.log('PASS built sections, lean-tos and building sites');
}
{
  // Water moats only at level 0; a terrace takes a dry one.
  const high=fixture({level:1});
  const w={id:'w',type:'wall',width:.5,a:{x:0,y:0},b:{x:6,y:0}};
  high.State.structures.push(w);
  assert.equal(high.C.planWallMoat(w,'water').ok,false,'water needs level 0');
  assert.equal(high.C.planWallMoat(w,'dry').ok,true,'dry moat on a flat terrace');
  const low=fixture();
  const v={id:'v',type:'wall',width:.5,a:{x:0,y:0},b:{x:6,y:0}};
  low.State.structures.push(v);
  assert.equal(low.C.digAlongWall(v,'water'),true);
  assert.equal(low.C.wallMoatOf(v).variant,'water');
  console.log('PASS water moats only at level 0');
}
{
  // MOAT-WIDEN: against a wall the bank on the wall's face stays put and the moat grows outward;
  // the joined neighbour still meets it where the centrelines cross; a free moat grows both ways.
  const {State,C}=fixture();
  const w1={id:'w1',type:'wall',width:1,a:{x:-8,y:0},b:{x:0,y:0}},w2={id:'w2',type:'wall',width:1,a:{x:0,y:0},b:{x:0,y:8}};
  State.structures.push(w1,w2);
  C.digAlongWall(w1,'dry');C.digAlongWall(w2,'dry');
  const m1=C.wallMoatOf(w1),m2=C.wallMoatOf(w2);
  assert.ok(C.moatWallSide(m1)!==0,'m1 knows its wall side');
  assert.equal(C.widenMoat(m1,3),true);
  assert.equal(m1.width,3);
  for(const p of [m1.a,m1.b])assert.ok(Math.abs(Math.abs(p.y)-(.5+1.5))<1e-9,'inner bank on the wall face, centre 0.5+1.5 out (got '+p.y+')');
  assert.ok([m1.a,m1.b].some(p=>[m2.a,m2.b].some(q=>Math.hypot(p.x-q.x,p.y-q.y)<1e-9)),'still joined to the neighbour');
  assert.ok(Math.abs(Math.abs(m2.a.x)-1.25)<1e-9&&Math.abs(Math.abs(m2.b.x)-1.25)<1e-9,'neighbour keeps its own line');
  assert.equal(C.planWidenMoat(m1,2).ok,false,'never narrower');
  const free={id:'f',type:'moat',variant:'dry',a:{x:0,y:20},b:{x:6,y:20},width:1.5,fills:[]};
  State.structures.push(free);
  assert.equal(C.moatWallSide(free),0);
  assert.equal(C.widenMoat(free,2),true);
  near(free.a,0,20,'a free moat widens on both sides');
  const site={id:'s',type:'moat',variant:'dry',a:{x:0,y:30},b:{x:6,y:30},width:1.5,fills:[],construction:{progress:.1}};
  State.structures.push(site);
  assert.equal(C.planWidenMoat(site,2).ok,false,'not while being dug');
  console.log('PASS widening keeps the bank on the wall');
}
console.log('wall-moat-regression: all passed');
