'use strict';
// One L1 allocator: industries, protected herders, paid construction, logging fill.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../src/settlement-economy.js'),'utf8');
const house=(id,kind='garden')=>({id,type:'house',houseLevel:1,kind});
const site=id=>({id,type:'tower',construction:{version:2,startedDay:0,workRequired:20,workDone:0}});
function harness(structures,{food=0,wood=0,alarm='off'}={}){
  const State={clock:{day:0},village:{founded:true,wellId:'well',foundingWorkers:0},
    structures,policies:{tax:0,rations:'market'}};
  const window={
    ConquerLivestock:{lotKindForHouse:h=>h.kind},
    ConquerCombat:{alarmMode:()=>alarm}
  };
  vm.runInNewContext(source,{State,window,document:{getElementById:()=>null},
    underConstruction:s=>!!s.construction&&s.construction.workDone<s.construction.workRequired,
    calendarDateFromDay:day=>({month:0,year:1,day:day+1}),console,Math,Number,Object,Array,Set});
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
console.log('Labor jobs regression: PASS');
