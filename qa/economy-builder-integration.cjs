'use strict';
// Single authoritative castle inventory + founding-worker regression.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

const engine=fs.readFileSync(path.join(__dirname,'../src/settlement-economy.js'),'utf8');
const core=fs.readFileSync(path.join(__dirname,'../src/settlement-core.js'),'utf8');
const builderFns=core.slice(core.indexOf('function canAfford(cost)'),core.indexOf('function buildDuration(s)'));
assert.ok(builderFns.startsWith('function canAfford(cost)'),'Builder cost contract missing');
function harness(founded=true,structures=[]){
  const State={clock:{day:0},structures,resources:{
    gold:10000,wood:10000,stone:10000,metal:10000,food:10000,equipment:10000,population:10000
  },village:{founded,wellId:'well',foundingWorkers:founded?4:0},policies:{tax:10}};
  const window={},calendarDateFromDay=day=>{
    const d=new Date(Date.UTC(2026,5,1+day));
    return {year:d.getUTCFullYear(),month:d.getUTCMonth(),day:d.getUTCDate()};
  };
  const ctx=vm.createContext({State,window,document:{getElementById:()=>null},
    calendarDateFromDay,underConstruction:()=>false,renderUI:()=>{},
    console,Math,Number,Object,Array});
  vm.runInContext(engine,ctx,{filename:'settlement-economy.js'});
  vm.runInContext(builderFns,ctx,{filename:'settlement-core-builder.js'});
  return {State,e:window.ConquerEconomy,ctx,can:cost=>vm.runInContext('canAfford('+JSON.stringify(cost)+')',ctx),
    spend:cost=>vm.runInContext('spendCost('+JSON.stringify(cost)+')',ctx),
    refund:cost=>vm.runInContext('refundCost('+JSON.stringify(cost)+')',ctx)};
}
function close(actual,expected,label){assert.ok(Math.abs(actual-expected)<.002,label+': got '+actual+', expected '+expected)}
function test(title,fn){fn();console.log('✓ '+title)}

test('one-time charter initializes bounded economic inventory; not test 10000',()=>{
  const h=harness();
  assert.equal(h.e.foundingCharter('well'),true);
  assert.equal(h.e.foundingCharter('well'),false);
  h.e.syncBuilderResources();
  const stock=h.e.snapshot().castle;
  close(stock.wood,200,'castle wood');
  close(stock.stone,180,'castle stone');
  close(h.State.resources.wood,200,'UI mirrors castle wood');
  close(h.State.resources.gold,700,'UI mirrors funded treasury');
  close(h.e.state().lots.food.reduce((sum,l)=>sum+l.qty,0),55,'food made available for local consumption');
  assert.equal(h.State.resources.population,4);
  assert.equal(h.e.population().L1,4);
  assert.equal(h.e.state().foundingCharterId,'well');
});
test('four founders staff two-person logging camps without any houses',()=>{
  const h=harness(true,[{id:'camp',type:'loggingCamp',economicOwner:'lord'}]);
  h.e.foundingCharter('well');
  assert.equal(h.e.staffing().camp,2);
  h.e.setShare('wood',100);
  h.e.tick(-1,4);
  close(h.e.snapshot().market.wood,30,'founder-produced wood plus charter lot');
});
test('real builder costs are deducted once from castle stocks and treasury',()=>{
  const h=harness();
  h.e.foundingCharter('well');
  const before=h.e.snapshot();
  assert.equal(h.can({gold:35,wood:25}),true);
  assert.equal(h.spend({gold:35,wood:25}),true);
  close(h.e.snapshot().castle.wood,before.castle.wood-25,'wood debit');
  close(h.e.snapshot().castleGold,before.castleGold-35,'treasury debit');
  close(h.State.resources.wood,h.e.snapshot().castle.wood,'UI projection');
  assert.equal(h.can({stone:9999}),false,'cannot rely on 10k test resources');
  assert.equal(h.spend({stone:9999}),false,'atomic refusal of unaffordable build');
  close(h.e.snapshot().castle.stone,before.castle.stone,'no negative inventory');
});
test('construction consumption and returned materials are not production',()=>{
  const h=harness();
  h.e.foundingCharter('well');
  h.spend({wood:12,stone:8,gold:4});
  h.refund({stone:8,gold:4});
  h.e.tick(-1,5);
  const goods=h.e.snapshot().balance.goods;
  close(goods.stone.production||goods.stone.produced,0,'no stone production');
  close(goods.stone.construction,8,'spent stone');
  close(goods.stone.recovered,8,'returned stone');
  close(goods.stone.netPhysical,0,'net physical balance accounts for refund');
  close(goods.wood.construction,12,'spent wood');
  assert.ok(goods.wood.consumed>=12);
});
test('founding workers eat food and require local firewood',()=>{
  const h=harness();h.e.foundingCharter('well');
  h.e.tick(-1,5);
  const g=h.e.snapshot().balance.goods;
  close(g.food.demand,2.2,'four founders food');
  close(g.wood.demand,.24,'four founders fuel');
  close(g.food.fulfilled,2.2,'founders buy available food');
});
test('new save/reload preserves charter, stock, workers and shortage data',()=>{
  const h=harness();h.e.foundingCharter('well');h.spend({wood:23,gold:10});
  h.e.tick(-1,5);
  const serialized=JSON.parse(JSON.stringify(h.State.economy));
  const reloaded=harness();
  reloaded.State.economy=serialized;
  assert.equal(reloaded.e.foundingCharter('well'),false,'must not duplicate grant');
  reloaded.e.syncBuilderResources();
  close(reloaded.State.resources.wood,h.e.snapshot().castle.wood,'castle store restored');
  close(reloaded.e.snapshot().balance.goods.wood.construction,23,'past physical use restored');
  close(reloaded.State.resources.population,4,'workers restored');
});
test('pre-founding test inventory never imports 10000 into economy',()=>{
  const h=harness(false);
  assert.equal(h.can({wood:5000}),true,'old bootstrap placement still possible');
  h.State.village.founded=true;
  h.State.village.foundingWorkers=4;
  h.e.foundingCharter('well');
  h.e.syncBuilderResources();
  assert.equal(h.can({wood:5000}),false);
  close(h.State.resources.wood,200,'no phantom inventory migrated');
});
console.log('Economy/Builder integration checks passed.');
