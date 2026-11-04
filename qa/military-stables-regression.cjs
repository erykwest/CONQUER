'use strict';
// Military stables (extends `stables`): in a built section the stalls run the room's length, 5 horses
// per U (twice as many in a wide hall); a tower stable keeps one stall block of 5. The circle depots
// hold the same number, so a captured stable loses the horses it holds. When the food runs out, the
// horses no knight rides are slaughtered, just enough to cover the shortfall.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const root=__dirname+'/../src/';
const src=['settlement-collapse.js','settlement-siege.js'].map(f=>fs.readFileSync(root+f,'utf8')).join('\n');

function fixture({knights=0}={}){
  const State={clock:{day:5},structures:[],siege:null,view:{scale:1},resources:{}};
  const window={ConquerCombat:{enemy:()=>[],units:()=>Array.from({length:knights},(_,i)=>({id:'k'+i,kind:'knight'}))}};
  const ctx=vm.createContext({
    State,window,console,Object,Array,Map,Set,String,Number,Math,performance:{now:()=>0},
    structureLevel:s=>s.level||1,structureHeight:()=>2,houseLevel:()=>2,
    towerTier:s=>(s.size||1)>=1.99?3:(s.size||1)>=1.49?2:1,isWoodTower:()=>false,
    towerRoofStyle:()=>'battlement',isCivic:()=>false,rectDims:()=>({w:1.5,h:1.5}),
    isWideBuilt:s=>s.span==='wide',
    functionCapacity:s=>s.type==='built'?(Number(s.length)>=2?s.level||1:0):s.type==='tower'?(s.level||1):0,
    functionSlotUnits:s=>s.type==='built'?(s.span==='wide'||Number(s.length)>=3?2:1):(s.size||1)>=1.99?2:1,
    normalizeFunctions:s=>{if(!Array.isArray(s.functions))s.functions=[]},
    housePopulationCapacity:s=>({total:s.people||0}),
    invalidateUrbanGeometry:()=>{},scheduleLocalSave:()=>{},underConstruction:()=>false,
    invalidateStructureScene:()=>{},invalidateSceneCache:()=>{},invalidateNavigation:()=>{},
    markDirty:()=>{},renderFunctionPanel:()=>{},renderUI:()=>{},draw:()=>{},status:()=>{},terrainElevation:()=>0
  });
  vm.runInContext(src,ctx);
  return{State,S:ctx.window.ConquerSiege};
}
const built=(id,o={})=>({id,type:'built',length:2,level:1,x:0,y:0,functions:['stables'],...o});
const tower=(id,o={})=>({id,type:'tower',shape:'square',size:1.5,level:2,x:0,y:0,functions:['stables'],...o});

{
  const {State,S}=fixture();
  State.structures.push(tower('t'));
  assert.equal(S.capacity().horses,5,'a tower stable: one stall block');
  State.structures.push(built('b2'));
  assert.equal(S.capacity().horses,5+10,'a 2U built section: 10 horses');
  State.structures.push(built('b4',{length:4}));
  assert.equal(S.capacity().horses,5+10+20,'a 4U section: 20 (length, not the large-slot doubling)');
  State.structures.push(built('w',{length:2,span:'wide'}));
  assert.equal(S.capacity().horses,5+10+20+20,'a 2U wide hall: two rows of stalls, 20');
  assert.ok(!S.allowed(built('up',{level:2}),1,'stables'),'still ground floor only');
  console.log('PASS stable capacity grows with the built-section room');
}
{
  const {State,S}=fixture();
  State.structures.push(built('b',{length:3}),tower('t'));
  const depots=S.circleDepots().filter(d=>d.kind==='stables');
  assert.equal(JSON.stringify(depots.map(d=>d.capacity)),'[15,5]','circle depots hold what the stalls hold');
  assert.equal(depots.reduce((a,d)=>a+d.capacity,0),S.capacity().horses,'depots and capacity agree');
  console.log('PASS circle stable depots follow the capacity (a captured stable loses its horses)');
}
{
  // 2 knights ride 2 of 8 horses; 100 people eat 12 a day, the granary is empty.
  const {State,S}=fixture({knights:2});
  State.structures.push(built('b',{length:2}),{id:'h',type:'house',people:100,functions:[]});
  const x=S.state();x.stock.horses=8;x.stock.food=0;x.lastDay=5;
  assert.equal(S.spareHorses(),6,'spare horses: those no knight rides');
  S.tick(5,6);
  // 12 rations short: one horse (20 rations) covers the day, 8 left over.
  assert.equal(x.stock.horses,7,'one horse slaughtered');
  assert.ok(Math.abs(x.stock.food-8)<1e-9,'its meat left 8 rations: '+x.stock.food);
  assert.equal(x.starvationDays,0,'no shortfall while horses last');
  S.tick(6,30);
  assert.equal(x.stock.horses,2,'the knights keep their mounts');
  assert.equal(x.horsesSlaughtered,6);
  assert.ok(x.starvationDays>0,'then hunger comes');
  console.log('PASS horses slaughtered for food, spare ones only');
}
{
  // Mounted courier: with a spare horse the answer rides back 1.5x faster; without one, at the
  // messenger's pace (the same minimal DOM as qa/dovecote-regression.cjs, no dovecote).
  const element=()=>({hidden:true,textContent:'',innerHTML:'',dataset:{},style:{},onclick:null,addEventListener(){},appendChild(){},querySelector(){return null}});
  function diplomacy(spare){
    const els={},keep={id:'keep',type:'tower',isMastio:true,x:60,y:80,functions:['commonHall']};
    const State={clock:{day:10},seed:7,structures:[keep],diplomacy:null,village:{founded:true,borderEntries:[{edge:'west',x:0,y:50}]},view:{scale:1}};
    const window={ConquerSiege:{mastio:()=>keep,spareHorses:()=>spare},ConquerConvoys:{planLordConvoy(){},state:()=>({lordConvoys:{}})}};
    const sandbox={window,State,console,Math,Number,Object,Array,JSON,String,
      document:{getElementById:id=>els[id]||(els[id]=element()),createElement:()=>element()},
      wrap:element(),WORLD:100,dist:(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),
      markDirty(){},status(){},roadNetworkPath:(a,b)=>[{x:a.x,y:a.y},{x:a.x,y:b.y},{x:b.x,y:b.y}],
      ensureBorderEntrySelection:()=>State.village.borderEntries,terrainElevation:()=>0,placementGroundZ:()=>0,
      towerVisualTopHeight:()=>3,w2s:()=>({x:0,y:0}),towerDovecote:()=>false};
    sandbox.window.window=sandbox.window;
    vm.runInNewContext(fs.readFileSync(root+'settlement-diplomacy.js','utf8'),sandbox);
    const D=window.ConquerDiplomacy;assert.ok(D.spawn(10));
    const m=State.diplomacy.incoming;D.tick(10,m.arrivalDay);D.finishResponse(false);
    return{m,ride:m.returnDay-m.departDay,by:State.diplomacy.history.at(-1).by};
  }
  const foot=diplomacy(0),horse=diplomacy(3);
  assert.equal(foot.by,'courier');assert.equal(horse.by,'horse');
  assert.ok(Math.abs(foot.ride/horse.ride-1.5)<1e-9,'1.5x faster on a fresh horse: '+foot.ride+' / '+horse.ride);
  assert.equal(horse.m.phase,'returning','the messenger still rides back');
  console.log('PASS the answer rides back on a fresh horse when the stables have one');
}
{
  // With food in stock nothing is slaughtered.
  const {State,S}=fixture();
  State.structures.push(built('b'),{id:'h',type:'house',people:100,functions:[]});
  const x=S.state();x.stock.horses=5;x.stock.food=100;x.lastDay=5;
  S.tick(5,6);
  assert.equal(x.stock.horses,5);
  console.log('PASS no slaughter while food lasts');
}
