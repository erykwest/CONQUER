'use strict';
// Autonomous L3 workshops and the L3 goods market, driven by the economy calendar.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(ROOT,'src',f),'utf8');
function harness(houses,saved=null){
  const State={seed:7,clock:{day:0},village:{founded:true,wellId:'well',foundingWorkers:0},economy:saved,
    structures:[{id:'well',type:'well'},...houses.map((lvl,i)=>({id:'h'+i,type:'house',houseLevel:lvl}))],
    policies:{tax:0,rations:'market'}};
  const window={};
  const ctx=vm.createContext({State,window,console,Math,Number,Array,Object,Set,document:{getElementById:()=>null},
    calendarDateFromDay:day=>({month:0,year:1,day:day+1}),underConstruction:()=>false,houseLevel:s=>s.houseLevel});
  for(const f of ['settlement-economy.js','settlement-urban-economy.js','settlement-market-economy.js','settlement-commerce.js'])
    vm.runInContext(read(f),ctx,{filename:f});
  return{State,window,e:window.ConquerEconomy,c:window.ConquerCommerce,U:window.ConquerUrbanEconomy,M:window.ConquerMarketEconomy};
}
const asObject=o=>JSON.parse(JSON.stringify(o));
const check=(label,fn)=>{fn();console.log('PASS '+label)};
check('pure rules: L3 eligibility, one workshop per artisan, opening hours, no-demand',()=>{
  const {U}=harness([]);
  assert.equal(U.eligibleForWorkshop({id:1,level:3}),true);
  assert.equal(U.eligibleForWorkshop({id:1,level:2}),false);
  assert.equal(U.eligibleForWorkshop({id:1,level:3,streetFacing:false}),false);
  const result=U.proposeWorkshops({houses:[{id:1,level:3},{id:2,level:3}],artisans:[{id:7,tier:3}],random:()=>0});
  assert.equal(result.length,1);assert.equal(result[0].houseId,1);
  assert.equal(U.updateWorkshop({revenue:0},{hour:23}).state,'closed');
  assert.equal(U.updateWorkshop({revenue:0},{hour:12,visitors:2}).state,'selling');
  assert.equal(U.chooseWorkshopType({demand:{clothing:0,tools:0,household:0,luxury:0}}),null);
});
check('week N prices use only week N-1 observations, one commodity per step',()=>{
  const {M}=harness([]);
  let m=M.createMarketState('x',{textiles:11});
  m=M.recordMarketWeek(m,{week:4,demand:{textiles:10},supply:{textiles:0}});
  m.cursor=3; // textiles
  const same=M.stepMarket(m,{week:4});assert.equal(same.prices.textiles,11,'same-week observation ignored');
  const next=M.stepMarket(m,{week:5});assert.ok(next.prices.textiles>11);
  assert.equal(M.stepMarket({...next,cursor:3},{week:5}).prices.textiles,next.prices.textiles,'once per week');
});
check('every completed L3 house opens one workshop on a workday; others never do',()=>{
  const h=harness([3,3,2,4]);
  h.e.tick(-1,0);
  const shops=h.c.state().shops;
  assert.deepEqual(Object.keys(shops).sort(),['h0','h1']);
  for(const s of Object.values(shops)){assert.ok(h.c.WORKSHOP_KINDS[s.kind]);assert.equal(s.source,'autonomous')}
});
check('trades are deterministic per seed and survive save/reload',()=>{
  const a=harness([3,3,3]);a.e.tick(-1,0);
  const b=harness([3,3,3]);b.e.tick(-1,0);
  assert.deepEqual(asObject(a.c.state().shops),asObject(b.c.state().shops));
  const resumed=harness([3,3,3],asObject(a.State.economy));
  resumed.e.tick(0,1);
  assert.deepEqual(Object.keys(resumed.c.state().shops).sort(),['h0','h1','h2']);
  for(const id of ['h0','h1','h2'])assert.equal(resumed.c.state().shops[id].kind,a.c.state().shops[id].kind);
});
check('workshops produce on workdays and households pay real coins on Saturday',()=>{
  const h=harness([3,3,4,4]);
  const e=h.e.state(),before=e.wallet.L4+e.wallet.L3+e.wallet.L2+e.wallet.L1;
  h.e.tick(-1,4); // Mon–Fri
  const produced=Object.values(h.c.state().goods).reduce((a,b)=>a+b,0);
  assert.equal(produced,10,'two shops × five workdays');
  const l4=e.wallet.L4;
  h.e.tick(4,5); // Saturday
  assert.ok(e.wallet.L4<l4,'L4 households bought L3 goods');
  assert.ok(h.c.snapshot().l3Revenue>0);
  const after=e.wallet.L4+e.wallet.L3+e.wallet.L2+e.wallet.L1;
  assert.ok(Math.abs(before-after)<1e-6,'household money only changes hands');
  assert.ok(h.c.state().market.weeklyObservations[0],'Saturday closes week 0');
  h.e.tick(5,6); // Sunday: no production
  assert.equal(Object.values(h.c.state().shops)[0].state,'closed');
});
check('no village, no workshops; alarm stops production',()=>{
  const h=harness([3]);h.State.village.founded=false;h.e.tick(-1,3);
  assert.equal(Object.keys(h.c.state().shops).length,0);
  const g=harness([3]);g.window.ConquerCombat={alarmMode:()=>'mobilize'};g.e.tick(-1,3);
  assert.equal(Object.keys(g.c.state().shops).length,0);
});
console.log('Urban workshops regression: PASS');
