'use strict';
// Gates and their crossing: the drawbridge leaf is never longer than a small moat
// (1.5 U); a moat further out or wider is reached by a fixed wooden half-bridge from
// the far bank to the leaf's tip. Wooden bridges can be pulled down into the moat (a
// collapse), by hand or by the defenders at the red alarm. Gates shut at night and
// open at dawn unless someone handled them; closed gates keep their guards inside.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const root=__dirname+'/../src/';
const src=['settlement-collapse.js','settlement-siege.js','settlement-crossings.js'].map(f=>fs.readFileSync(root+f,'utf8')).join('\n');

function fixture({moatX=-3.5,moatWidth=1.5,alarm='off'}={}){
  const State={clock:{day:3},structures:[],siege:null,view:{scale:1},selectedId:null,resources:{}};
  let night=0;
  const ctx=vm.createContext({
    State,window:{ConquerCombat:{alarmMode:()=>alarm}},console,Math,Object,Array,Map,Set,String,Number,JSON,performance:{now:()=>0},
    structureLevel:s=>s.level||1,structureHeight:s=>s.type==='gate'?2.8:s.type==='bridge'?.12:1.15,
    footprintPoints:s=>s.a?[{x:s.a.x,y:s.a.y-.5},{x:s.b.x,y:s.b.y-.5},{x:s.b.x,y:s.b.y+.5},{x:s.a.x,y:s.a.y+.5}]:[],
    rectDims:s=>({w:s.size||1.5,h:s.size||1.5}),placementGroundZ:()=>0,terrainElevation:()=>0,
    wallTier:()=>2,wallSkin:()=>'standard',towerTier:()=>2,isCivic:()=>false,isWoodTower:()=>false,isWoodGate:()=>false,
    nightFactor:()=>night,underConstruction:s=>!!s.construction,normalizeFunctions:s=>s,functionCapacity:()=>0,scheduleLocalSave:()=>{},
    invalidateStructureScene:()=>{},invalidateSceneCache:()=>{},invalidateNavigation:()=>{},
    markDirty:()=>{},renderFunctionPanel:()=>{},draw:()=>{},status:()=>{},selectStructure:()=>{},
    uid:(()=>{let n=0;return()=>'id'+(++n)})()
  });
  vm.runInContext(src,ctx);
  // A gate facing -x at the origin; a water moat running along y.
  const gate={id:'g',type:'gate',x:0,y:0,size:1.5,angle:Math.PI,functions:[],drawbridge:{installed:true,raised:false,progress:0}};
  const moat={id:'m',type:'moat',variant:'water',a:{x:moatX,y:-10},b:{x:moatX,y:10},width:moatWidth,length:20,groundZ:0,fills:[]};
  State.structures.push(gate,moat);
  return{State,C:ctx.window.ConquerCrossings,S:ctx.window.ConquerSiege,gate,setNight:v=>{night=v}};
}

{
  // A moat right at the gate: the leaf spans it, nothing else needed.
  const {C,gate}=fixture({moatX:-1.5});
  const d=C.deck(gate);
  assert.ok(Math.abs(d.ahead.near)<1e-9&&Math.abs(d.ahead.far-1.5)<1e-9,'the moat lies right in front of the gate');
  assert.ok(Math.abs(d.length-1.65)<1e-9,'the leaf spans it and rests on the far bank');
  assert.equal(C.halfBridgeNeed(gate),null,'no half-bridge needed');
  // A wider moat: the leaf stops at the small-moat length, a half-bridge does the rest.
  const wide=fixture({moatX:-2.25,moatWidth:3});
  const w=wide.C.deck(wide.gate);
  assert.ok(Math.abs(w.length-1.65)<1e-9,'never longer than a small moat (1.5 U)');
  const need=wide.C.halfBridgeNeed(wide.gate);
  assert.ok(need,'a wider moat needs a half-bridge');
  assert.ok(Math.abs(need.a.x-(-3.75-.25))<1e-9,'from just beyond the far bank');
  assert.ok(need.b.x>=-.75-w.length-1e-9&&Math.hypot(need.b.x-need.a.x,need.b.y-need.a.y)>=1,'to the leaf tip, at least 1 U long');
  console.log('PASS the drawbridge spans a small moat; wider ones need a half-bridge');
}
{
  // A moat further out: the half-bridge reaches it; it crosses the water.
  const {State,C,gate}=fixture();
  const need=C.halfBridgeNeed(gate);assert.ok(need);
  const hb=C.normalise({id:'hb',type:'bridge',variant:'wood',a:need.a,b:need.b,width:need.width,groundZ:0,halfBridgeFor:'g',autoDemolish:true});
  State.structures.push(hb);
  assert.equal(C.halfBridgeOf(gate),hb);
  assert.equal(C.onBridge({x:-3.5,y:0}),true,'over the water on the half-bridge');
  assert.equal(C.movementMultiplier({x:-3.5,y:0}),1,'full speed on it');
  assert.equal(C.movementMultiplier({x:-3.5,y:1.5}),.25,'wading beside it');
  // Pulled down: a collapse of planks, the crossing is gone.
  C.demolishBridge(hb);
  assert.ok(!State.structures.includes(hb),'the bridge is gone');
  const r=State.siege.ruins.at(-1);
  assert.ok(r.cause==='demolished'&&r.spec.material==='wood','its planks fall into the moat');
  assert.equal(C.onBridge({x:-3.5,y:0}),false,'no crossing left');
  console.log('PASS half-bridge crosses the moat; pulled down it falls in');
}
{
  // Red alarm: the defenders pull the wooden half-bridges down; stone ones stay.
  const f=fixture({alarm:'hall'});
  const need=f.C.halfBridgeNeed(f.gate);
  const wood=f.C.normalise({id:'w',type:'bridge',variant:'wood',a:need.a,b:need.b,width:1,groundZ:0,halfBridgeFor:'g',autoDemolish:true});
  const stone=f.C.normalise({id:'s',type:'bridge',variant:'stone',a:{x:-6,y:5},b:{x:-1,y:5},width:1,groundZ:0,halfBridgeFor:'g2',autoDemolish:true});
  const kept=f.C.normalise({id:'k',type:'bridge',variant:'wood',a:{x:-6,y:8},b:{x:-1,y:8},width:1,groundZ:0,halfBridgeFor:'g3',autoDemolish:false});
  f.State.structures.push(wood,stone,kept);
  f.S.tick(3,3.01);
  assert.ok(!f.State.structures.includes(wood),'the wooden half-bridge is pulled down');
  assert.ok(f.State.structures.includes(stone),'a stone one stays');
  assert.ok(f.State.structures.includes(kept),'and so does one set not to');
  console.log('PASS red alarm pulls the wooden half-bridges down');
}
{
  // Night watch.
  const {S,gate,setNight}=fixture();
  setNight(0);S.gateNightWatch();
  assert.ok(!gate.closed);
  setNight(1);S.gateNightWatch();
  assert.ok(gate.closed&&S.gateClosed(gate),'it shuts at dusk');
  setNight(0);S.gateNightWatch();
  assert.ok(!gate.closed,'and opens at dawn');
  setNight(1);S.gateNightWatch();S.setGateClosed('g',false);
  assert.ok(!gate.closed,'opened by hand at night');
  setNight(0);S.gateNightWatch();setNight(1);S.gateNightWatch();
  assert.ok(gate.closed,'the next night it shuts again');
  setNight(0);S.gateNightWatch();
  S.setGateClosed('g',true);setNight(1);S.gateNightWatch();setNight(0);S.gateNightWatch();
  assert.ok(gate.closed,'closed by hand in the day it stays closed in the morning');
  const off=fixture();off.gate.nightClose=false;off.setNight(0);off.S.gateNightWatch();off.setNight(1);off.S.gateNightWatch();
  assert.ok(!off.gate.closed,'a gate set not to, stays open');
  console.log('PASS gates shut at night and open at dawn unless handled');
}
// Closed gates keep their guards inside (hook in the garrisons).
const garrisons=fs.readFileSync(root+'settlement-population-garrisons.js','utf8');
assert.match(garrisons,/ConquerSiege\?\.gateClosed\?\.\(gate\)\)continue;/,'closed gates draw no guards');
console.log('PASS closed gates keep their guards inside');
