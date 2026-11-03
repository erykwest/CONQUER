'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

const code=fs.readFileSync(path.join(__dirname,'../src/settlement-economy.js'),'utf8');
function harness(structures=[]){
  const State={clock:{day:0},structures,policies:{tax:10}},window={};
  const calendarDateFromDay=day=>{
    const d=new Date(Date.UTC(2026,5,1+day));
    return {year:d.getUTCFullYear(),month:d.getUTCMonth(),day:d.getUTCDate()};
  };
  vm.runInNewContext(code,{State,window,document:{getElementById:()=>null},
    calendarDateFromDay,underConstruction:()=>false,console,Math,Number,Object,Array});
  return {State,economy:window.ConquerEconomy};
}
function close(actual,expected,description){
  assert.ok(Math.abs(actual-expected)<.002,`${description}: expected ${expected}, got ${actual}`);
}
function test(description,fn){fn();console.log('✓ '+description)}

test('unmet requirements survive as explicit food and fuel deficits',()=>{
  const {economy}=harness([{id:'h',type:'house',houseLevel:1}]);
  economy.tick(-1,5);
  const goods=economy.snapshot().balance.goods;
  close(goods.food.demand,1.65,'L1 food requirement');
  close(goods.wood.demand,.18,'L1 wood requirement');
  close(goods.food.unmetSupply,1.65,'missing physical food');
  close(goods.food.unmetBudget,0,'not an affordability shortage');
  assert.equal(goods.food.signal,'supply-shortage');
  close(goods.food.fulfilled,0,'fulfilled demand');
  close(goods.food.netProduction,-1.65,'production-demand gap');
});
test('wood production becomes actual resident consumption and surplus stock',()=>{
  const {economy}=harness([
    {id:'h',type:'house',houseLevel:1},
    {id:'camp',type:'loggingCamp',economicOwner:'lord'}
  ]);
  economy.setShare('wood',100);
  economy.tick(-1,5);
  const wood=economy.snapshot().balance.goods.wood;
  close(wood.produced,5,'five workday output');
  close(wood.demand,.18,'weekly wood needed');
  close(wood.fulfilled,.18,'wood purchased');
  close(wood.consumed,.18,'wood actually used');
  close(wood.marketStock,4.82,'remaining timber');
  close(wood.netPhysical,4.82,'physical net accumulation');
  assert.equal(wood.signal,'surplus');
});
test('affordability is not mislabeled as a shortage of goods',()=>{
  const {economy}=harness([{id:'h',type:'house',houseLevel:1}]);
  economy.state().lots.food.push({id:'supply',owner:'lord',qty:10});
  economy.state().wallet.L1=0;
  economy.tick(-1,5);
  const food=economy.snapshot().balance.goods.food;
  close(food.unmetBudget,1.65,'unaffordable units');
  close(food.unmetSupply,0,'stock remains available');
  close(food.marketStock,10,'unbought stock retained');
  assert.equal(food.signal,'purchasing-power');
});
test('workshop purchases are inventory transfers; materials become consumption when used',()=>{
  const {economy}=harness([
    {id:'h',type:'house',houseLevel:3},
    {id:'w',type:'workshop',economicOwner:'private'}
  ]);
  const e=economy.state();
  e.lots.wood.push({id:'wood-seller',owner:'lord',qty:10});
  e.lots.metal.push({id:'metal-seller',owner:'lord',qty:10});
  economy.tick(-1,5);
  const first=economy.snapshot().balance.goods;
  close(first.metal.demand,3,'weekly metal requirement');
  close(first.metal.fulfilled,3,'purchased for next workdays');
  close(first.metal.consumed,0,'not consumed on purchase');
  close(first.metal.inputStock,3,'buffer retained');
  economy.tick(5,12);
  const second=economy.snapshot().balance.goods;
  close(second.metal.consumed,3,'metal used for equipment');
  close(second.equipment.produced,2.5,'equipment output');
  assert.ok(second.metal.netPhysical<0,'metal is physically converted');
});
test('no double charge or duplicate weekly settlement when tick called twice',()=>{
  const {economy}=harness([{id:'h',type:'house',houseLevel:1}]);
  economy.tick(-1,5);
  const before=JSON.stringify(economy.snapshot().balance);
  economy.tick(5,5);
  assert.equal(JSON.stringify(economy.snapshot().balance),before);
  assert.equal(economy.snapshot().weeks,1);
});
test('historical v1 economic saves lazily gain the flow accounting',()=>{
  const {economy}=harness([{id:'h',type:'house',houseLevel:1}]);
  const state=economy.state();
  delete state.weekProduced;delete state.weekConsumed;delete state.balanceHistory;
  economy.tick(-1,5);
  assert.equal(economy.snapshot().balance.day,5);
  assert.equal(economy.state().balanceHistory.length,1);
});
test('investment capacity requires resident L4 population at the month boundary',()=>{
  const a=harness([{id:'h',type:'house',houseLevel:1}]);
  a.economy.tick(-1,29);
  assert.equal(a.economy.snapshot().investmentCapacity,0);
  const b=harness([{id:'noble',type:'house',houseLevel:4}]);
  b.economy.tick(-1,29);
  assert.ok(b.economy.snapshot().investmentCapacity>0);
});
test('four-week trends distinguish persistent imbalances from single-week spikes',()=>{
  const {economy}=harness([
    {id:'h',type:'house',houseLevel:1},
    {id:'camp',type:'loggingCamp',economicOwner:'lord'}
  ]);
  economy.setShare('wood',100);
  economy.tick(-1,26);
  const balance=economy.snapshot().balance;
  assert.equal(balance.goods.wood.trend.weeks,4);
  close(balance.goods.wood.trend.production,5,'steady production average');
  assert.equal(balance.goods.wood.signal,'surplus');
  assert.equal(economy.state().balanceHistory.length,4);
});
console.log('Economy balance regression: all checks passed.');
