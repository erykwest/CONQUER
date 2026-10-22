'use strict';
// Gate fittings (settlement-gate-fittings.js) and the road magnet for gates: a gate set over a
// road keeps the road; the carved 3D passage matches the portal outline; the door leaves follow
// gate.closed in real time; the portcullis is a stone-gate upgrade that shuts the passage;
// banners and torches sit on the outer front, torches only drawn when that front faces the camera.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const root=__dirname+'/../src/';
const read=f=>fs.readFileSync(root+f,'utf8');

// ---------- roads through the passage (settlement-world.js) ----------
{
  const world=read('settlement-world.js'),placement=read('settlement-castle-placement.js');
  const fn=(src,name)=>{const i=src.indexOf('function '+name+'(');assert.ok(i>=0,name);let d=0,j=src.indexOf('{',i);for(;j<src.length;j++){if(src[j]==='{')d++;else if(src[j]==='}'&&--d===0)break}return src.slice(i,j+1)};
  const ctx=vm.createContext({Math,Number,
    dist:(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),
    rectDims:s=>({w:s.size||1.5,h:s.size||1.5})});
  vm.runInContext(['rotateVec','toLocalPoint'].map(n=>fn(placement,n)).join('\n')+
    ['gatePassageInfo','roadUsesGatePassage'].map(n=>fn(world,n)).join('\n'),ctx);
  const gate={type:'gate',x:0,y:0,size:1.5,angle:0};
  const road=(ax,ay,bx,by)=>({a:{x:ax,y:ay},b:{x:bx,y:by},width:.62});
  assert.equal(ctx.roadUsesGatePassage(road(-8,0,8,0),gate),true,'a road straight through the passage');
  assert.equal(ctx.roadUsesGatePassage(road(0,0,8,0),gate),true,'a road ending inside the passage');
  assert.equal(ctx.roadUsesGatePassage(road(-8,.6,8,.6),gate),false,'a road through the side wall');
  assert.equal(ctx.roadUsesGatePassage(road(0,-8,0,8),gate),false,'a road across the gate');
  assert.equal(ctx.roadUsesGatePassage(road(-8,5,8,5),gate),false,'a road that does not touch the gate');
  assert.match(read('settlement-placement.js'),/s\.type==='gate'&&roadUsesGatePassage\(other,s\)\)return false/,'placement lets a gate stand over its road');
  assert.match(placement,/function gateRoadSnap\(p\)/,'gates have a road magnet');
  const input=read('settlement-app-input.js');
  assert.match(input,/gateRoadSnap\(p\)/,'the gate tool uses the road magnet');
  assert.match(input,/orientedDraftAngle\(p\)/,'a road-snapped gate keeps its passage on the road while rotating');
  console.log('PASS gates snap onto roads and keep the way open');

  // Roads drawn to a gate snap to its two mouths: a free leg to a straight approach, then
  // through the mouth to the gate centre, where roads from both sides meet.
  vm.runInContext('var State={structures:[gate],village:{}};var ROAD_RULES={snapNodeDistance:1.15};'+
    ['gateRoadPort','manualRoadLegs','mainRoadSnapAnchor'].map(n=>fn(world,n)).join('\n'),Object.assign(ctx,{gate,snapGrid:v=>Math.round(v*2)/2,ensureBorderEntrySelection:()=>[],roadList:()=>[],closestPointOnSegment:p=>p}));
  const west=ctx.mainRoadSnapAnchor({x:-.9,y:.3}),east=ctx.mainRoadSnapAnchor({x:.5,y:-.2});
  assert.ok(west.gatePort&&east.gatePort,'both mouths are magnets, also from inside the gatehouse');
  assert.ok(west.point.x===0&&west.point.y===0,'the road ends at the gate centre');
  assert.ok(west.gatePort.approach.x<-.75&&east.gatePort.approach.x>.75,'each mouth has its own straight approach');
  assert.equal(ctx.mainRoadSnapAnchor({x:0,y:3}).gatePort,undefined,'no magnet away from the mouths');
  const legs=ctx.manualRoadLegs({x:-6,y:-3},west.point,null,west.gatePort);
  assert.equal(legs.length,2,'free leg + approach');
  assert.equal(ctx.roadUsesGatePassage({...legs[1],width:.62},gate),true,'the approach runs inside the passage');
  assert.equal(ctx.roadUsesGatePassage({...legs[0],width:.62},gate),false,'the free leg stays clear of the gatehouse');
  const out=ctx.manualRoadLegs(east.point,{x:6,y:2},east.gatePort,null);
  assert.ok(out[0].a.x===legs[1].b.x&&out[0].a.y===legs[1].b.y,'roads from the two mouths share the centre node');
  assert.match(read('settlement-app-input.js'),/manualRoadLegs\(State\.draft\.a,e2\.point,State\.draft\.aGatePort,e2\.gatePort\)/,'the road tool commits the legs');
  console.log('PASS roads snap to both gate mouths and meet inside');
}

// ---------- fittings ----------
function fixture({night=0,rotation=0}={}){
  const State={structures:[],view:{scale:1,rotation},resources:{gold:100,metal:100,wood:100}};
  let raf=null,now=0;
  const ctx=vm.createContext({
    State,console,Math,Object,Array,Map,Set,String,Number,JSON,
    window:{ConquerSiege:{gateClosed:g=>!!g.closed&&!(g.door<=0),doorStage:g=>g.door<=0?'broken':'intact'},ConquerWorld3D:{active:()=>true}},
    performance:{now:()=>now},requestAnimationFrame:f=>{raf=f;return 1},
    isWoodGate:s=>s?.material==='wood',underConstruction:s=>!!s.construction,
    rectDims:s=>({w:s.size||1.5,h:s.size||1.5}),placementGroundZ:()=>2,terrainElevation:()=>2,
    // Camera looking from +x/+y toward the origin at rotation 0 (bigger depth = nearer).
    viewDepthPoint:p=>rotation===0?p.x+p.y:-(p.x+p.y),isPlanView:()=>false,nightFactor:()=>night,
    canAfford:c=>Object.entries(c).every(([k,v])=>State.resources[k]>=v),costText:()=>'',
    spendCost:c=>{for(const [k,v] of Object.entries(c))State.resources[k]-=v},
    markDirty:()=>{},renderFunctionPanel:()=>{},draw:()=>{},status:()=>{},invalidateNavigation:()=>{},
    selectedStructure:()=>State.structures[0]
  });
  vm.runInContext(read('settlement-gate-fittings.js'),ctx);
  const gate={id:'g',type:'gate',material:'stone',x:0,y:0,size:1.5,angle:0,functions:[]};
  State.structures.push(gate);
  return{State,G:ctx.window.ConquerGates,gate,
    step:(ms,frames=1)=>{for(let i=0;i<frames;i++){now+=ms;ctx.window.ConquerGates.tick()}},hasRaf:()=>!!raf};
}
{
  const {G}=fixture(),o=G.opening();
  // The opening is the inner outline of the portal decal: 1.2 × 1.5 U drawn from -.06.
  assert.ok(Math.abs(o.half-64/256*1.2)<1e-9,'jamb half width from the sprite');
  assert.ok(Math.abs(o.apex-(-.06+(256-44)/256*1.5))<1e-9,'apex from the sprite');
  assert.ok(o.spring<o.apex&&o.arc[0].c===o.half&&o.arc.at(-1).c===0,'pointed arch from the springs to the apex');
  for(let i=1;i<o.arc.length;i++)assert.ok(o.arc[i].z>o.arc[i-1].z&&o.arc[i].c<o.arc[i-1].c,'monotone arch');
  // The carved body: three prisms (upper block, two piers) plus spandrels, vault and paving.
  const calls={prism:[],face:0};
  const m={prism:(pts,z0,z1)=>calls.prism.push([z0,z1]),face:()=>calls.face++};
  assert.equal(G.addGateBody(m,{type:'gate',material:'stone',x:0,y:0,size:1.5,angle:0},2.8,[]),true);
  assert.deepEqual(calls.prism.map(p=>p.map(v=>+v.toFixed(3))),[[+o.apex.toFixed(3),2.8],[0,+o.apex.toFixed(3)],[0,+o.apex.toFixed(3)]]);
  assert.equal(calls.face,2*(2*8+8)+1,'spandrels at both mouths, vault and floor on both halves');
  assert.equal(G.addGateBody(m,{type:'gate',material:'wood',x:0,y:0,size:1.5},1.94,[]),false,'wood gates stay solid');
  console.log('PASS the 3D gate is carved around the portal outline');
}
{
  const {G,gate,step,hasRaf}=fixture();
  step(16);
  assert.equal(gate.doorOpen,1,'an open gate starts with its leaves open, no animation');
  gate.closed=true;
  step(16);assert.ok(hasRaf(),'closing schedules animation frames');
  step(80,4);
  assert.ok(gate.doorOpen>0&&gate.doorOpen<1,'the leaves swing over time');
  step(80,30);
  assert.equal(gate.doorOpen,0,'and end shut');
  const shut=G.gateMesh(gate),again=G.gateMesh(gate);
  assert.ok(shut.static&&shut===again,'settled leaves reuse one static mesh');
  gate.closed=false;step(16);step(80,2);
  const moving=G.gateMesh(gate);
  assert.ok(!moving.static&&moving.pos.length===moving.col.length*9,'moving leaves are a dynamic mesh');
  gate.door=0;step(80,30);
  const broken=G.gateMesh(gate);
  assert.ok(broken.col.length<shut.col.length,'a broken-in gate has no leaves');
  console.log('PASS door leaves follow the gate state in real time');
}
{
  const {State,G,gate,step}=fixture();
  assert.equal(G.portcullisBlocks(gate),false,'no portcullis, nothing blocks');
  assert.equal(G.installPortcullis({...gate,material:'wood',id:'w'}),false,'wood gates have no portcullis');
  assert.equal(G.installPortcullis(gate),true);
  assert.equal(State.resources.metal,100-G.PORTCULLIS_COST.metal,'it is paid for');
  assert.equal(G.installPortcullis(gate),false,'only one per gate');
  assert.equal(G.portcullisBlocks(gate),false,'installed raised');
  G.togglePortcullis(gate);
  assert.equal(G.portcullisBlocks(gate),true,'lowering it shuts the passage at once');
  step(16);step(100,30);
  assert.equal(G.stateOfPortcullis(gate),'lowered');
  assert.equal(gate.doorOpen,1,'even with the doors open');
  G.togglePortcullis(gate);
  assert.equal(G.portcullisBlocks(gate),true,'still down while it rises');
  step(100,30);
  assert.equal(G.portcullisBlocks(gate),false,'raised, the way is open');
  G.togglePortcullis(gate);step(100,30);gate.door=0;
  assert.equal(G.portcullisBlocks(gate),false,'the ram smashes it with the door');
  assert.match(G.panel(gate),/data-portcullis-toggle/);
  G.removePortcullis(gate);assert.equal(G.portcullis(gate),null);
  assert.match(read('settlement-population-navigation.js'),/ConquerGates\?\.portcullisBlocks\?\.\(s\)\)return true/,'navigation honours the portcullis');
  console.log('PASS the portcullis upgrade shuts the passage');
}
{
  const front=fixture({rotation:0}),back=fixture({rotation:2});
  assert.equal(front.G.torchSources().length,2,'two torches on the outer front');
  assert.equal(back.G.torchSources().length,0,'a front turned away shows no flames');
  assert.equal(back.G.torchSources(false).length,2,'the 3D glow pass gets them all');
  const t=front.G.torchSources()[0];
  assert.ok(t.kind==='torch'&&t.p.x>.75&&t.groundZ===2,'on the outer face, at the gate ground');
  const decals=front.G.decalSpecs(front.gate);
  assert.equal(decals.filter(d=>d.key==='gatePortalFrame').length,2,'portal frames on both mouths');
  const banners=decals.filter(d=>d.key==='gateBanner');
  assert.equal(banners.length,2,'two banners');
  assert.ok(banners.every(b=>b.edge.normal.x===1)&&banners[0].offset===-banners[1].offset,'on the outer front, either side of the portal');
  assert.match(read('settlement-castle-structures.js'),/ConquerGates\?\.torchSources\(\)/,'flames and glows include the gate torches');
  assert.match(read('settlement-world3d.js'),/ConquerGates\?\.torchSources\(false\)/,'3D glow includes the gate torches');
  console.log('PASS banners and night torches on the outer front');
}
const html=fs.readFileSync(__dirname+'/../index.html','utf8');
assert.match(html,/settlement-gate-fittings\.js/,'the module is loaded');
assert.ok(html.indexOf('settlement-gate-fittings.js')>html.indexOf('settlement-siege.js'),'after siege, so its portal wrapper runs last');
console.log('PASS gate fittings module loaded after the siege module');
