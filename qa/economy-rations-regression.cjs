'use strict';
// Lord's food order (State.policies.rations) and the four class happiness tracks.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../src/settlement-economy.js'),'utf8');
function harness(houses=[1]){
  const State={clock:{day:0},structures:houses.map((n,i)=>({id:'h'+i,type:'house',houseLevel:n})),policies:{tax:0,rations:50,levy:10}};
  const window={};
  vm.runInNewContext(source,{State,window,document:{getElementById:()=>null},underConstruction:()=>false,
    calendarDateFromDay:day=>({month:0,year:1,day:day+1}),console,Math,Number,Object,Array});
  return {State,e:window.ConquerEconomy};
}
const check=(label,fn)=>{fn();console.log('PASS '+label)};
check('default: legacy numeric rations mean market only, castle food untouched',()=>{
  const {State,e}=harness();e.state().castle.food=20;e.tick(-1,5);
  assert.equal(State.policies.rations,'market');
  assert.equal(e.snapshot().castle.food,20);
  assert.equal(e.snapshot().rationMode,'market');
  assert.equal(e.state().lastTrade.marketFoodByClass.L1,0);
  assert.ok(e.snapshot().happiness.L1<50);
});
check('normal market consumption does not debit the lord’s store',()=>{
  const {e}=harness();e.state().castle.food=20;
  e.state().lots.food=[{id:'lot',owner:'private',qty:20}];e.tick(-1,5);
  assert.equal(e.snapshot().castle.food,20);
  assert.equal(e.state().lastTrade.castleRations.L1,0);
  assert.ok(e.state().lastTrade.marketFoodByClass.L1>0);
  assert.ok(e.snapshot().happiness.L1>50);
});
check('full castle rations feed all four cohorts and really reduce stocks',()=>{
  const {State,e}=harness([1,2,3,4]);e.state().castle.food=100;
  assert.equal(e.setRations('full'),true);
  assert.equal(State.policies.rations,'full');
  e.tick(-1,5);
  assert.equal(e.snapshot().castle.food,83.5);
  assert.equal(e.snapshot().castleFoodIssued,16.5);
  assert.equal(e.state().lastBalance.goods.food.fulfilled>=16.5,true);
  for(const g of ['L1','L2','L3','L4'])assert.ok(e.snapshot().happiness[g]>50,g);
});
check('half rations lower L1/L2 happiness even when market can fill the gap',()=>{
  const {e}=harness([1,2]);e.state().castle.food=100;
  e.state().lots.food=[{id:'lot',owner:'private',qty:100}];
  assert.equal(e.setRations('half'),true);e.tick(-1,5);
  assert.equal(e.snapshot().castle.food,97.525);
  assert.ok(e.state().lastTrade.marketFoodByClass.L1>0);
  assert.ok(e.snapshot().happiness.L1<50);
  assert.ok(e.snapshot().happiness.L2<50);
  assert.equal(e.snapshot().happiness.L3,50);
});
check('small castle stock is rationed proportionally and cannot become negative',()=>{
  const {e}=harness([1,2,3,4]);e.state().castle.food=1;
  e.setRations('full');e.tick(-1,5);
  assert.ok(e.snapshot().castle.food>=0);
  assert.ok(e.snapshot().castleFoodIssued<=1);
  assert.ok(e.state().lastTrade.castleRations.L1>0);
  assert.ok(e.state().lastTrade.castleRations.L4>0);
});
check('legacy saves migrate welfare into four independent tracks',()=>{
  const {e}=harness();const old=e.state();old.welfare=73;
  delete old.happiness;
  assert.equal(e.state().happiness.L1,73);
  assert.equal(e.state().happiness.L4,73);
  assert.equal(e.setRations('invalid'),false);
});
console.log('Rations regression: PASS');
