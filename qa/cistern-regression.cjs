'use strict';
// Cistern: a room on the ground floor of W2/W3 stone towers, always full. With enemies in
// the field, wells outside the walls or in a sector that is no longer safe are cut off: the
// garrison drinks from the cisterns (60 people a room, 120 in a large one), the rest go
// thirsty. The bucket brigade draws from a cistern at its tower's ground door.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const root=__dirname+'/../src/';
const src=['settlement-collapse.js','settlement-siege.js','settlement-fire.js'].map(f=>fs.readFileSync(root+f,'utf8')).join('\n');
const square=(x,y,h)=>[{x:x-h,y:y-h},{x:x+h,y:y-h},{x:x+h,y:y+h},{x:x-h,y:y+h}];
const span=s=>s.shape==='round'?s.r*2:s.size;

function fixture({enemies=[],walled=null}={}){
  let seed=7;const random=()=>(seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296;
  const State={clock:{day:5},structures:[],siege:null,view:{scale:1}};
  const window={};
  if(enemies)window.ConquerCombat={enemy:()=>enemies};
  // walled: a safe enclosure x in [-5,5]; a well beyond it is outside the walls.
  if(walled)window.ConquerCircle={getSnapshot:()=>({compartments:[{id:'in'}]}),
    sectorAt:p=>Math.abs(p.x)<=5&&Math.abs(p.y)<=5?'in':null,controlState:()=>({safe:walled.safe!==false})};
  const ctx=vm.createContext({
    State,window,console,Object,Array,Map,Set,String,Number,performance:{now:()=>0},
    Math:Object.assign(Object.create(Math),{random}),
    structureLevel:s=>s.level||1,
    structureHeight:s=>s.type==='tower'?[2.35,3.55,4.75][(s.level||1)-1]:s.type==='house'?2.26:1.15,
    footprintPoints:s=>square(s.x,s.y,s.type==='tower'?span(s)/2:1),houseLevel:()=>2,
    towerTier:s=>span(s)>=1.99?3:span(s)>=1.49?2:1,isWoodTower:s=>s.type==='tower'&&s.material==='wood',
    towerRoofStyle:s=>s.roofStyle||'battlement',isCivic:()=>false,rectDims:()=>({w:1.5,h:1.5}),
    functionCapacity:s=>s.type==='tower'&&span(s)>=1.49?(s.level||1):0,
    functionSlotUnits:s=>span(s)>=1.99?2:1,
    normalizeFunctions:s=>{if(!Array.isArray(s.functions))s.functions=[]},
    housePopulationCapacity:s=>({total:s.people||0}),
    // The ground door of a tower faces +x.
    towerDoorSpecs:s=>[{kind:'front',contact:{x:s.x+span(s)/2,y:s.y},outward:{x:1,y:0},baseZ:.035}],
    weatherGroundWet:()=>false,invalidateUrbanGeometry:()=>{},scheduleLocalSave:()=>{},
    underConstruction:()=>false,invalidateStructureScene:()=>{},invalidateSceneCache:()=>{},invalidateNavigation:()=>{},
    markDirty:()=>{},renderFunctionPanel:()=>{},draw:()=>{},status:()=>{},terrainElevation:()=>0
  });
  vm.runInContext(src,ctx);
  return{State,F:ctx.window.ConquerFire,S:ctx.window.ConquerSiege};
}
const tower=(id,o={})=>({id,type:'tower',shape:'square',size:1.5,x:0,y:0,level:2,material:'stone',functions:[],...o});
const house=(id,x,y,people=0)=>({id,type:'house',x,y,people,functions:[]});
const enemy={id:'e',x:20,y:0,faction:'dev_hostile'};

{
  const {S}=fixture();
  assert.ok(S.allowed(tower('a'),0,'cistern'),'W2 stone tower, ground floor');
  assert.ok(S.allowed(tower('b',{size:2,level:3}),0,'cistern'),'W3 stone tower, ground floor');
  assert.ok(S.allowed(tower('c',{shape:'round',r:1,size:undefined}),0,'cistern'),'round W3 tower');
  assert.ok(!S.allowed(tower('d'),1,'cistern'),'not upstairs');
  assert.ok(!S.allowed(tower('e',{size:1}),0,'cistern'),'not in a W1 tower');
  assert.ok(!S.allowed(tower('f',{material:'wood'}),0,'cistern'),'not in a wooden tower');
  assert.ok(!S.allowed({type:'built',length:3,level:1},0,'cistern'),'not in a built section');
  assert.ok(!S.allowed({type:'gate',level:3},0,'cistern'),'not in a gate');
  const core=fs.readFileSync(root+'settlement-core.js','utf8');
  assert.ok(JSON.parse(core.match(/const FUNCTION_CATALOG=(\[[^\n]+\]);/)[1].replace(/'/g,'"')).includes('cistern'),'in the room catalogue');
  console.log('PASS cisterns only on the ground floor of W2/W3 stone towers');
}
{
  const {State,S}=fixture();
  State.structures.push(tower('a',{functions:['cistern']}),tower('b',{x:10,size:2,functions:['cistern']}));
  assert.equal(S.capacity().water,60+120,'60 people a room, 120 in a large one');
  State.structures[0].functions=[null,'cistern'];
  assert.equal(S.capacity().water,120,'an upstairs cistern does not count');
  console.log('PASS cistern capacity');
}
{
  // Peace: the wells serve everyone, cistern or not.
  const peace=fixture({enemies:[]});
  peace.State.structures.push({id:'w',type:'well',x:20,y:0},house('h',0,0,90));
  assert.equal(peace.S.water().source,'wells');assert.equal(peace.S.water().short,0);
  // Siege, well outside the walls, no cistern: everyone goes thirsty, day after day.
  const dry=fixture({enemies:[enemy],walled:{}});
  dry.State.structures.push({id:'w',type:'well',x:20,y:0},house('h',0,0,90));
  assert.deepEqual({...dry.S.water()},{people:90,source:'none',served:0,short:1});
  dry.S.state().lastDay=5;dry.S.tick(5,8);
  assert.ok(Math.abs(dry.S.state().thirstDays-3)<1e-9,'three days without water: '+dry.S.state().thirstDays);
  // Same siege with a W2 cistern: 60 of 90 drink, a third goes thirsty.
  const one=fixture({enemies:[enemy],walled:{}});
  one.State.structures.push({id:'w',type:'well',x:20,y:0},house('h',0,0,90),tower('t',{functions:['cistern']}));
  const w=one.S.water();assert.equal(w.source,'cistern');assert.equal(w.served,60);assert.ok(Math.abs(w.short-1/3)<1e-9);
  one.S.state().lastDay=5;one.S.tick(5,8);
  assert.ok(Math.abs(one.S.state().thirstDays-1)<1e-9,'a third of the thirst');
  // A W3 cistern covers them all: the garrison holds out, the shortfall recovers.
  one.State.structures.find(s=>s.id==='t').size=2;
  assert.equal(one.S.water().short,0);one.S.tick(8,10);
  assert.equal(one.S.state().thirstDays,0,'no thirst with enough cistern water');
  // A well inside the safe walls stays reachable; in an unsafe sector it is cut off.
  const inside=fixture({enemies:[enemy],walled:{}});
  inside.State.structures.push({id:'w',type:'well',x:1,y:1},house('h',0,0,90));
  assert.equal(inside.S.water().source,'wells');
  const invaded=fixture({enemies:[enemy],walled:{safe:false}});
  invaded.State.structures.push({id:'w',type:'well',x:1,y:1},house('h',0,0,90));
  assert.equal(invaded.S.water().source,'none','a well in an invaded sector is cut off');
  // Wolves are not a siege.
  const wolves=fixture({enemies:[{id:'wolf',kind:'wolf'}],walled:{}});
  wolves.State.structures.push({id:'w',type:'well',x:20,y:0},house('h',0,0,90));
  assert.equal(wolves.S.water().source,'wells');
  console.log('PASS siege water: wells while reachable, then cisterns, else thirst');
}
{
  // The brigade draws at the tower's ground door, with no well at all.
  const {State,F,S}=fixture();
  State.structures.push(tower('t',{x:4,functions:['cistern']}),house('h',0,0));
  const tap=S.cisternTaps()[0];
  assert.ok(tap&&Math.abs(tap.x-(4+.75+.35))<1e-9&&tap.y===0,'tap just outside the ground door: '+JSON.stringify(tap));
  F.ignite('h',{heat:.2,x:-1,y:0});F.tick(.25);
  assert.ok(F.brigade.carriers().length>0,'the cistern raises a brigade without a well');
  for(let k=0;k<200&&F.burning('h');k++)F.tick(.25);
  assert.equal(F.burning('h'),false,'and the fire is put out');
  // Siege: the far well is cut off, the women go to the cistern door instead.
  const siege=fixture({enemies:[enemy],walled:{}});
  siege.State.structures.push({id:'w',type:'well',x:-7,y:0},tower('t',{x:4,functions:['cistern']}),house('h',0,0));
  siege.F.ignite('h',{heat:.2,x:1,y:0});siege.F.tick(.25);
  const c=siege.F.brigade.carriers();
  assert.ok(c.length>0&&c.every(q=>q.x>0),'they fill at the cistern, not at the well beyond the walls');
  // No cistern and the only well cut off: no brigade.
  const none=fixture({enemies:[enemy],walled:{}});
  none.State.structures.push({id:'w',type:'well',x:-7,y:0},house('h',0,0));
  none.F.ignite('h',{heat:.2});none.F.tick(.5);
  assert.equal(none.F.brigade.carriers().length,0,'cut off from water, no brigade');
  console.log('PASS the bucket brigade draws from the cistern at the tower door');
}
