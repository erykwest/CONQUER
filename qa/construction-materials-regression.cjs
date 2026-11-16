'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const core=fs.readFileSync('src/settlement-core.js','utf8');
const work=core.slice(core.indexOf('const CONSTRUCTION_MAX_WORKERS'),core.indexOf('function pointRadius(s)'));
function harness(workers=2){
  const State={clock:{day:0},village:{founded:true,wellId:'well',foundingWorkers:workers},structures:[],resources:{},policies:{tax:10}};
  const window={},ctx=vm.createContext({State,window,console,clamp:(n,a,b)=>Math.max(a,Math.min(b,n)),buildDuration:s=>s.days??4,renderUI:()=>{},calendarDateFromDay:()=>({year:2026,month:5,day:1}),document:{getElementById:()=>null}});
  vm.runInContext(fs.readFileSync('src/settlement-economy.js','utf8'),ctx);
  vm.runInContext(core.slice(core.indexOf('function canAfford('),core.indexOf('function buildDuration('))+work,ctx);
  const run=s=>vm.runInContext(s,ctx),e=window.ConquerEconomy.state();
  e.castleGold=100;Object.keys(e.castle).forEach(k=>e.castle[k]=0);
  const add=(id,cost={stone:10},priority=2)=>{const s={id,type:'tower',buildCost:cost};State.structures.push(s);run('beginConstruction(State.structures.at(-1))');s.construction.priority=priority;return s};
  const allocate=()=>run('allocateConstructionMaterials(State.structures.filter(s=>underConstruction(s)),1)');
  const tick=(a,b)=>{State.clock.day=b;return run(`tickConstructionWork(${a},${b})`)};
  return{State,e,add,allocate,tick,run,ctx};
}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
function test(name,fn){fn();console.log('✓ '+name)}
test('empty stock creates persistent default-medium quote without a debit',()=>{
  const h=harness(),s=h.add('a');assert.equal(s.construction.priority,2);near(h.e.castle.stone,0);near(s.construction.workDone,0);h.tick(0,.52);near(s.construction.workDone,0);
  assert.equal(s.buildCost.stone,10);
});
test('all six priorities drain higher tiers first',()=>{
  const h=harness(),sites=Array.from({length:6},(_,i)=>h.add('p'+i,{stone:10},i));h.e.castle.stone=25;h.allocate();
  sites.forEach((s,i)=>near(s.construction.materialsDelivered.stone||0,i===5||i===4?10:i===3?5:0));near(h.e.castle.stone,0);
});
test('equal priority waterfills independently per good and redistributes small needs',()=>{
  const h=harness(),a=h.add('a',{stone:2,wood:10}),b=h.add('b',{stone:10,wood:10});h.e.castle.stone=10;h.e.castle.wood=6;h.allocate();
  near(a.construction.materialsDelivered.stone,2);near(b.construction.materialsDelivered.stone,8);near(a.construction.materialsDelivered.wood,3);near(b.construction.materialsDelivered.wood,3);
});
test('repeated tiny supplies do not starve peers; changing priority affects future supply',()=>{
  const h=harness(),a=h.add('a'),b=h.add('b');for(let i=0;i<20;i++){h.e.castle.stone=.001;h.allocate()}
  near(a.construction.materialsDelivered.stone,.01);near(b.construction.materialsDelivered.stone,.01);
  b.construction.priority=5;h.e.castle.stone=2;h.allocate();near(b.construction.materialsDelivered.stone,2.01);
});
test('delivery does not produce work; work consumes only its proportional materials',()=>{
  const h=harness(1),s=h.add('a');h.e.castle.stone=5;h.allocate();near(s.construction.workDone,0);h.tick(0,.52);near(s.construction.workDone,1);near(s.construction.materialsConsumed.stone,2.5);
  h.tick(.52,4.52);near(s.construction.workDone,2);near(h.run('refundableConstructionCost(State.structures[0]).stone')||0,0);
  h.e.castle.stone=5;h.tick(4.52,10.52);near(h.run('constructionProgress(State.structures[0])'),1);near(s.construction.materialsConsumed.stone,10);
});
test('cancel returns delivered unconsumed stock, never quote or wages',()=>{
  const h=harness(1),s=h.add('a');h.e.castle.stone=10;h.tick(0,.52);near(h.run('refundableConstructionCost(State.structures[0]).stone'),7.5);
  const gold=h.e.castleGold;h.run('refundCost(refundableConstructionCost(State.structures[0]))');h.State.structures=[];near(h.e.castle.stone,7.5);near(h.e.castleGold,gold);
});
test('JSON save reload preserves allocations, priority, consumption and settled work',()=>{
  const h=harness(1),s=h.add('a',{stone:10},4);h.e.castle.stone=10;h.tick(0,.52);
  const serialized=JSON.stringify(h.State.structures);h.State.structures=JSON.parse(serialized);h.allocate();h.tick(0,.52);assert.equal(JSON.stringify(h.State.structures),serialized);near(h.e.castle.stone,0);
});
test('legacy prepaid sites are never charged materials again',()=>{
  const h=harness(1);h.State.structures.push({id:'old',type:'tower',buildCost:{stone:10},construction:{version:2,workRequired:4,workDone:1,startedDay:0,lastWorkDay:0}});h.tick(0,.52);near(h.State.structures[0].construction.workDone,2);near(h.e.castle.stone,0);
});
test('wall fragments own independent proportional reservations and consumed goods',()=>{
  const h=harness(),source=fs.readFileSync('src/settlement-castle-placement.js','utf8');
  h.ctx.uid=()=> 'fragment';h.ctx.dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);h.ctx.normalizeStructureVariants=()=>{};
  vm.runInContext(source.slice(source.indexOf('function proportionalBuildCost'),source.indexOf('function towerWallConnectionRecords')),h.ctx);
  const wall=h.add('wall',{stone:40});wall.construction.materialsDelivered={stone:20};wall.construction.workDone=1;wall.construction.materialsConsumed={stone:10};
  h.run('State.fragment=wallFragmentFrom(State.structures[0],{x:0,y:0},{x:1,y:0},null,null,.25)');
  const fragment=h.State.fragment;near(fragment.buildCost.stone,10);near(fragment.construction.materialsDelivered.stone,5);near(fragment.construction.materialsConsumed.stone,2.5);
  fragment.construction.materialsDelivered.stone=9;near(wall.construction.materialsDelivered.stone,20);
});
console.log('Construction material regression: all checks passed.');

