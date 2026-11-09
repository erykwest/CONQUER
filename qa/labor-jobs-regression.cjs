'use strict';
// One L1 allocator: industries, protected herders, paid construction, logging fill.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../src/settlement-economy.js'),'utf8');
const house=(id,kind='garden')=>({id,type:'house',houseLevel:1,kind});
const site=id=>({id,type:'tower',construction:{version:2,startedDay:0,workRequired:20,workDone:0}});
function harness(structures,{food=0,wood=0,alarm='off',gardens=[]}={}){
  const State={clock:{day:0},village:{founded:true,wellId:'well',foundingWorkers:0},
    structures,policies:{tax:0,rations:'market'}};
  const window={
    ConquerLivestock:{lotKindForHouse:h=>h.kind},
    ConquerCombat:{alarmMode:()=>alarm}
  };
  vm.runInNewContext(source,{State,window,document:{getElementById:()=>null},
    underConstruction:s=>!!s.construction&&s.construction.workDone<s.construction.workRequired,
    calendarDateFromDay:day=>({month:0,year:1,day:day+1}),kitchenGardens:()=>gardens,console,Math,Number,Object,Array,Set});
  const e=window.ConquerEconomy;
  e.state().castleGold=1000;e.state().castle.food=food;e.state().castle.wood=wood;
  return{State,e};
}
const check=(label,fn)=>{fn();console.log('PASS '+label)};
check('a flock keeps at least one protected herder away from every site',()=>{
  const {e}=harness([house('a','goat'),house('b','shepherd'),house('c'),house('d'),site('s1'),site('s2')]);
  const labor=e.laborAllocation(0);
  assert.ok(labor.herdReserve>=1);
  const herderIds=labor.herders.map(w=>w.houseId);
  for(const w of labor.spareL1)assert.ok(!herderIds.includes(w.houseId),'herder offered to construction');
  assert.ok(labor.spareL1.length<=4-labor.herdReserve);
});
check('herders produce private food on workdays only',()=>{
  const {e}=harness([house('a','goat'),house('b')]);
  e.tick(-1,0);
  const lot=e.state().lots.food.find(l=>l.id==='a:herd');
  assert.ok(lot&&Math.abs(lot.qty-e.HERD_FOOD_PER_DAY)<1e-9);
  e.tick(0,6); // Tue–Fri herd; Saturday market sells food; Sunday rests
  assert.ok(e.state().weeks===1);
});
check('low wood staffs the camp before construction',()=>{
  const camp={id:'camp',type:'loggingCamp'};
  const {e}=harness([house('a'),house('b'),house('c'),camp,site('s1')],{wood:0});
  const labor=e.laborAllocation(0);
  assert.equal(labor.allocated.camp,2);
  assert.equal(labor.spareL1.length,1);
});
check('with enough wood, construction comes first and the camp takes leftovers',()=>{
  const camp={id:'camp',type:'loggingCamp'};
  const {e}=harness([house('a'),house('b'),house('c'),house('d'),camp,site('s1')],{wood:500});
  const labor=e.laborAllocation(0);
  assert.equal(labor.spareL1.length-labor.idle.length,3,'three builders on one site');
  assert.equal(labor.allocated.camp,1);
  assert.equal(labor.idle.length,0);
});
check('no sites and plenty of wood: free L1 log, spare herders return to flocks',()=>{
  const camp={id:'camp',type:'loggingCamp'};
  const {e}=harness([house('a','goat'),house('b','goat'),house('c'),camp],{wood:500,food:1000});
  // Castle food is not civilian cover under the default market-only order.
  assert.equal(e.laborAllocation(0).herdReserve,2);
  e.state().lots.food=[{id:'stock',owner:'private',qty:1000}];
  const labor=e.laborAllocation(0);
  assert.equal(labor.herdReserve,1);
  assert.equal(labor.allocated.camp,2);
  assert.equal(labor.herders.length,1);
  const jobs=e.jobSummary(0);
  assert.equal(jobs.logging,2);assert.equal(jobs.herding,1);assert.equal(jobs.building,0);
});
check('alarm: no construction demand, no grazing output',()=>{
  const {e}=harness([house('a','goat'),site('s1')],{alarm:'mobilize'});
  assert.equal(e.laborAllocation(0).spareL1.length-e.laborAllocation(0).idle.length,0);
  e.tick(-1,0);
  assert.equal(e.state().lots.food.length,0);
});
check('fields consume only L2 capacity and leave L1 available for construction',()=>{
  const field={id:'field',type:'field'};
  const l1=[house('a'),house('b')];
  const {e}=harness([...l1,field,site('site')]);
  assert.equal(e.KIND.field.classId,2);
  assert.equal(e.laborAllocation(0).allocated.field,0);
  assert.equal(e.laborAllocation(0).spareL1.length,2);
  const mixed=harness([...l1,{...house('l2'),houseLevel:2},field,site('site')]).e;
  assert.equal(mixed.laborAllocation(0).allocated.field,1);
  assert.equal(mixed.laborAllocation(0).spareL1.length,2);
});
check('orto di corte: each kitchen garden yields lord food per workday, also under alarm',()=>{
  const gardens=[{id:'g1'},{id:'g2'}];
  const {e}=harness([house('a')],{alarm:'mobilize',gardens});
  e.tick(-1,0);
  assert.equal(e.KITCHEN_GARDEN_FOOD_PER_DAY,2);
  assert.ok(Math.abs(e.state().weekProduced.food-2*e.KITCHEN_GARDEN_FOOD_PER_DAY)<1e-9,'two gardens, one workday');
  const idle=harness([house('a')],{alarm:'mobilize'}).e;
  idle.tick(-1,0);
  assert.ok(!(idle.state().weekProduced?.food>0),'no gardens, no food under alarm');
});

check('manual minima reserve distinct L1 and leave additional population idle',()=>{
  const {e}=harness([house('a'),house('b'),house('c'),house('d'),
    {id:'wood',type:'loggingCamp'},{id:'wine',type:'vineyard'},site('tower')],{wood:500});
  assert.equal(e.setL1Minimum('site:wine',1),true);
  assert.equal(e.setL1Minimum('builders',2),true);
  assert.equal(e.setL1Auto('site:wood',false),true);
  assert.equal(e.setL1Auto('site:wine',false),true);
  assert.equal(e.setL1Auto('builders',false),true);
  assert.equal(e.setL1Order(['builders','site:wine','site:wood','carter']),true);
  const labor=e.laborAllocation(0);
  assert.equal(labor.builders.length,2);
  assert.equal(labor.allocated.wine,1);
  assert.equal(labor.allocated.wood,0);
  assert.equal(labor.idle.length,1);
  assert.equal(e.availableBuilders(0),2);
  assert.equal(e.availableBuilderIds(0).length,2);
  const workers=[...labor.assignedL1.wine,...labor.builders,...labor.carters];
  assert.equal(new Set(workers.map(w=>w.id)).size,workers.length,'a worker has only one L1 job');
});
check('AUTO fills remaining slots after minimum guarantees, even under labor pressure',()=>{
  const {e}=harness([house('a'),house('b'),house('c'),house('d'),
    {id:'wood',type:'loggingCamp'},{id:'wine',type:'vineyard'},site('tower')],{wood:500});
  assert.equal(e.setL1Minimum('site:wood',1),true);
  assert.equal(e.setL1Minimum('site:wine',1),true);
  assert.equal(e.setL1Minimum('builders',1),true);
  assert.equal(e.setL1Order(['site:wood','site:wine','builders','carter']),true);
  const labor=e.laborAllocation(0);
  assert.equal(labor.allocated.wood,2);
  assert.equal(labor.allocated.wine,1);
  assert.equal(labor.builders.length,1);
  assert.equal(labor.idle.length,0);
});
check('drag priority determines shortage winner, rejects bad order and survives serialization',()=>{
  const buildings=[house('a'),{id:'wood',type:'loggingCamp'},{id:'wine',type:'vineyard'},site('tower')];
  const h=harness(buildings,{wood:500});
  const {e}=h;
  assert.equal(e.setL1Order(['site:wine','builders','site:wood','carter']),true);
  assert.equal(e.setL1Order(['site:wine','site:wine']),false);
  assert.equal(e.setL1Minimum('site:wine',1),true);
  assert.equal(e.setL1Minimum('builders',1),true);
  const labor=e.laborAllocation(0);
  assert.equal(labor.allocated.wine,1);
  assert.equal(labor.builders.length,0);
  assert.equal(labor.allocated.wood,0);
  const j=e.jobManager(0);
  assert.equal(j.tasks[0].key,'site:wine');
  assert.equal(j.tasks.find(t=>t.key==='builders').minimum,1);
  assert.equal(j.tasks.find(t=>t.key==='builders').workers,0);
  const saved=JSON.parse(JSON.stringify(h.State.economy));
  const loaded=harness(buildings,{wood:500});
  loaded.State.economy=saved;
  assert.equal(loaded.e.jobManager(0).managed,true);
  assert.equal(loaded.e.jobManager(0).tasks[0].key,'site:wine');
  assert.equal(loaded.e.laborAllocation(0).allocated.wine,1);
});
check('manual zero stops a productive site without affecting L2 staff or protected herders',()=>{
  const {e}=harness([house('a','goat'),house('b'),house('c'),
    {id:'wine',type:'vineyard'},{id:'field',type:'field'},
    {...house('tier2'),houseLevel:2}],{wood:500});
  assert.equal(e.setL1Auto('site:wine',false),true);
  assert.equal(e.laborAllocation(0).allocated.wine,0);
  assert.equal(e.laborAllocation(0).allocated.field,1);
  assert.ok(e.laborAllocation(0).herders.length>=1);
  assert.equal(e.setL1Minimum('site:wine',-1),false);
  assert.equal(e.setL1Minimum('site:wine',999),true);
  assert.equal(e.jobManager(0).tasks.find(t=>t.key==='site:wine').minimum,2);
});


check('L2 priority and minima allocate real field, quarry and mine staffing',()=>{
  const structures=[{...house('l2'),houseLevel:2},
    {id:'field',type:'field'},{id:'quarry',type:'quarry'},{id:'mine',type:'mine'}];
  const {e,State}=harness(structures);
  assert.equal(e.jobManagerL2(0).managed,false,'legacy L2 remains automatic before first edit');
  assert.equal(e.setL2Minimum('site:quarry',2),true);
  assert.equal(e.setL2Minimum('site:field',1),true);
  assert.equal(e.setL2Order(['site:quarry','site:field','site:mine']),true);
  assert.equal(e.setL2Order(['site:quarry','site:quarry','site:mine']),false);
  for(const key of ['site:quarry','site:field','site:mine'])
    assert.equal(e.setL2Auto(key,false),true);
  const labor=e.laborAllocation(0);
  assert.equal(labor.limits.L2,2);
  assert.equal(labor.allocated.quarry,2);
  assert.equal(labor.allocated.field,0,'lowest-priority minimum loses when only two L2 available');
  assert.equal(labor.allocated.mine,0,'manual zero does not fill spare capacity');
  assert.equal(e.jobManagerL2(0).tasks[0].key,'site:quarry');
  assert.equal(e.jobManagerL2(0).tasks.find(t=>t.key==='site:field').minimum,1);
  const saved=JSON.parse(JSON.stringify(State.economy));
  const restored=harness(structures);
  restored.State.economy=saved;
  assert.equal(restored.e.jobManagerL2(0).tasks[0].key,'site:quarry');
  assert.equal(restored.e.laborAllocation(0).allocated.quarry,2);
});
check('L2 AUTO fills spare work after minima without taking L1 builders',()=>{
  const {e}=harness([house('a'),{...house('b'),houseLevel:2},
    {id:'field',type:'field'},{id:'quarry',type:'quarry'},{id:'wine',type:'vineyard'},site('tower')],{wood:500});
  assert.equal(e.setL2Minimum('site:quarry',1),true);
  assert.equal(e.setL2Order(['site:quarry','site:field']),true);
  assert.equal(e.setL2Auto('site:quarry',false),true);
  const labor=e.laborAllocation(0);
  assert.equal(labor.allocated.quarry,1);
  assert.equal(labor.allocated.field,1);
  assert.equal(labor.allocated.wine,1,'L1 uses its own pool');
  assert.equal(labor.spareL1.length,0,'L1 remains on vineyard');
  assert.equal(e.setL2Minimum('site:quarry',999),true);
  assert.equal(e.jobManagerL2(0).tasks[0].minimum,2);
  assert.equal(e.setL2Minimum('site:field',-1),false);
  assert.equal(e.setL2Auto('site:field','false'),false);
});

console.log('Labor jobs regression: PASS (L1/L2 priority, minimum, AUTO and legacy)');
