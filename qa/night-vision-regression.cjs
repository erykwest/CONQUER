'use strict';
// Night visibility must affect actual combat LOS, towers and unit observers,
// forest concealment, enemy spotting and archer acquisition, not just the UI.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const combat=fs.readFileSync(path.join(root,'src/settlement-combat.js'),'utf8');
const population=fs.readFileSync(path.join(root,'src/settlement-population.js'),'utf8');
const start=combat.indexOf('  function combatVisionFactor(){');
const end=combat.indexOf('  function paintFogBitmap(){',start);
assert.ok(start>0&&end>start,'day/night vision and observer functions must be available');
const populationStart=population.indexOf('function visualCycleFrac(){');
const populationEnd=population.indexOf('function nightFactor(){',populationStart);
assert.ok(populationStart>0&&populationEnd>populationStart);
const context=vm.createContext({
  Math,Map,Set,window:{},solarHours:()=>({sunrise:5,sunset:21}),FOREST_SIGHT_U:6,
  VISION_BASE:16,VISION_PER_HEIGHT:4,STEP:2,
  State:{
    clock:{day:.25},daylightOverride:null,
    structures:[{id:'tower',type:'tower',x:100,y:100}],
    environment:[{id:'forest',type:'forest',points:[
      {x:75,y:75},{x:125,y:75},{x:125,y:125},{x:75,y:125}]}]
  },
  combat:{units:[
    {id:'squad',kind:'squad',x:110,y:100},
    {id:'sleeping',kind:'squad',x:105,y:105,campState:'barracks'},
    {id:'defeated',kind:'squad',x:106,y:106,defeated:true}
  ]},
  PEASANT_VISUAL_SPEED:1,
  underConstruction:()=>false,terrainElevation:()=>0,structureLevel:()=>1,
  clamp:(v,lo,hi)=>Math.min(hi,Math.max(lo,v)),
  dist:(p,q)=>Math.hypot(p.x-q.x,p.y-q.y),
  forestAt:()=>-1,environmentContains:()=>false,
  forestNearestEdge:()=>({distance:0}),
  pointSegmentDistance:()=>0,
  urbanHouseLineVisible:()=>true,
  tileOf:()=>({x:0,y:0}),tileHeight:()=>0,tileForest:()=>-1
});
const populationPrelude="function peasantVisualDay(){return State.clock.day*PEASANT_VISUAL_SPEED}\n"+
  "function visualCycleDay(){return peasantVisualDay()}\n";
vm.runInContext(populationPrelude+population.slice(populationStart,populationEnd)+
  combat.slice(start,end),context);
const observer=(id)=>vm.runInContext("observers()",context).find(s=>s.id===id);
const compare=(id,dayRange)=>{
  context.State.clock.day=.25;context.State.daylightOverride=null;
  const day=observer(id),dayR=day.r;
  context.State.clock.day=.95;
  const night=observer(id),nightR=night.r;
  assert.ok(Math.abs(nightR*3-dayR)<1e-9,id+' night range must be 1/3 of day');
  assert.equal(vm.runInContext('sourceSees(source,target)',Object.assign(context,{
    source:night,target:{x:night.x+nightR+.1,y:night.y}
  })),false,id+' cannot see beyond night radius');
  assert.equal(vm.runInContext('sourceSees(source,target)',Object.assign(context,{
    source:night,target:{x:night.x+nightR-.5,y:night.y}
  })),true,id+' sees just inside night radius');
  return{dayR,nightR};
};
const tower=compare('tower');
assert.equal(tower.dayR,20);
const unit=compare('squad');
assert.equal(unit.dayR,16);
context.State.clock.day=.25;context.State.daylightOverride='night';
assert.equal(observer('tower').r,tower.nightR,'forced night applies reduction');
context.State.clock.day=.95;context.State.daylightOverride='day';
assert.equal(observer('tower').r,tower.dayR,'forced day restores full sight');
context.State.daylightOverride=null;
assert.equal(vm.runInContext("observers()",context).length,2,
 'defeated units and barracks occupants cannot observe');
// Apply an independent 1/3 penalty to restricted forest LOS as well.
context.forestAt=()=>0;
context.State.clock.day=.25;
context.source={x:100,y:100,r:20,h:0};
context.target={x:104,y:100};
assert.equal(vm.runInContext('sourceSees(source,target)',context),true,'daytime 6U woodland sight');
context.State.clock.day=.95;
assert.equal(vm.runInContext('sourceSees(source,target)',context),false,'nighttime 2U woodland sight');
context.target={x:101.5,y:100};
assert.equal(vm.runInContext('sourceSees(source,target)',context),true,'night forest sight works under 2U');
// Detection cannot use a fog bit left over from daylight.
assert.match(combat,/function spotted\(p,sources\)\{[\s\S]*?return !!sources\?\.some\(s=>sourceSees\(s,p\)\)/);
assert.match(combat,/s\.r\.toFixed\(2\)/,'fog refresh signature depends on current sight radius');
assert.match(combat,/Math\.min\(rules\.shooterRange\(shooter,e\),combatVisionRadius\(height\)\)/,
 'tower archers acquire targets only inside night-adjusted observation radius');
console.log('PASS day/night tower and unit radii, forced light, woodland LOS, spotting and archers');
