'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..');
const fieldsSource=fs.readFileSync(path.join(ROOT,'src/settlement-fields.js'),'utf8');
const engineSource=fs.readFileSync(path.join(ROOT,'src/settlement-economy.js'),'utf8');
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));

function makeHarness(structures=[],policy={tax:10}){
  const State={clock:{day:0,speed:1},structures,policies:policy};
  const window={};
  const calendarDateFromDay=day=>{
    const date=new Date(Date.UTC(2026,5,1+day));
    return{year:date.getUTCFullYear(),month:date.getUTCMonth(),day:date.getUTCDate()};
  };
  const context=vm.createContext({State,window,document:{getElementById:()=>null},
    calendarDateFromDay,underConstruction:()=>false,
    fieldLayout:s=>({area:10,cells:[{index:0}]}),console,Math,Number,Object,Array});
  vm.runInContext(engineSource,context,{filename:'settlement-economy.js'});
  return {State,economy:window.ConquerEconomy};
}
function test(name,fn){
  fn();console.log('✓ '+name);
}
test('field work accrues on weekdays and stops on Saturday/Sunday',()=>{
  const context=vm.createContext({clamp,State:{},window:{}});
  vm.runInContext(fieldsSource,context);
  const work=vm.runInContext('fieldWorkClock',context);
  assert.equal(work(5),5);
  assert.equal(work(6),5);
  assert.equal(work(7),5);
  assert.ok(work(8)>5);
});
test('weekdays are deterministic (day 0 Monday)',()=>{
  const {economy}=makeHarness();
  assert.deepEqual(Array.from({length:7},(_,i)=>economy.weekday(i)),[0,1,2,3,4,5,6]);
});
test('L1-L4 population remains aggregated by house tier',()=>{
  const {economy}=makeHarness([
    {type:'house',houseLevel:1},{type:'house',houseLevel:2},
    {type:'house',houseLevel:3},{type:'house',houseLevel:4}
  ]);
  assert.deepEqual({...economy.population()},{L1:3,L2:6,L3:9,L4:12});
});
test('sale 0%, castle cap, and weekend pause preserve resources',()=>{
  const {economy}=makeHarness([
    {id:'h',type:'house',houseLevel:1},
    {id:'logging',type:'loggingCamp',economicOwner:'lord'}
  ]);
  assert.equal(economy.setShare('wood',0),true);
  economy.setTarget('wood',3);
  economy.tick(-1,4);
  assert.equal(economy.snapshot().castle.wood,3);
  assert.ok(economy.snapshot().market.wood>0);
  const before=economy.snapshot().market.wood;
  economy.tick(4,6);
  assert.equal(economy.snapshot().market.wood,before);
  assert.equal(economy.snapshot().weeks,1);
});
test('sale 100% routes all lord production to market',()=>{
  const {economy}=makeHarness([
    {id:'h',type:'house',houseLevel:1},
    {id:'logging',type:'loggingCamp',economicOwner:'lord'}
  ]);
  economy.setShare('wood',100);
  economy.tick(-1,4);
  assert.equal(economy.snapshot().castle.wood,0);
  assert.equal(economy.snapshot().market.wood,5);
});
test('exports require a configured foreign order and cannot exceed it',()=>{
  const {economy}=makeHarness([
    {id:'h',type:'house',houseLevel:1},
    {id:'logging',type:'loggingCamp',economicOwner:'private'}
  ]);
  economy.tick(-1,5);
  assert.equal(economy.state().lastTrade.exports.wood,0);
  economy.setExternalDemand('wood',2);
  economy.tick(5,12);
  assert.equal(economy.state().lastTrade.exports.wood,2);
  assert.ok(economy.snapshot().market.wood>0);
});
test('enterprise sale transfers ownership to L4 without individual persons',()=>{
  const s={id:'logging',type:'loggingCamp',economicOwner:'lord'};
  const {economy}=makeHarness([{id:'h',type:'house',houseLevel:1},s]);
  economy.sync();
  assert.equal(economy.transfer('logging','private'),true);
  assert.equal(s.economicOwner,'private');
  assert.equal(economy.snapshot().castleGold,345);
  assert.equal(economy.snapshot().capital,255);
  assert.equal(Object.hasOwn(economy.state(),'persons'),false);
});
test('unfunded enterprises cannot be acquired',()=>{
  const s={id:'logging',type:'loggingCamp',economicOwner:'private'};
  const {economy}=makeHarness([s]);
  economy.sync();
  economy.state().castleGold=0;
  assert.equal(economy.transfer('logging','lord'),false);
  assert.equal(s.economicOwner,'private');
});
test('calendar boundary pays wages monthly, not daily',()=>{
  const {economy}=makeHarness([
    {id:'h',type:'house',houseLevel:1},
    {id:'logging',type:'loggingCamp',economicOwner:'private'}
  ]);
  economy.tick(-1,20);
  assert.equal(economy.snapshot().months,0);
  economy.tick(20,29); // 30 June, closes month
  assert.equal(economy.snapshot().months,1);
});
test('a lordly mill processes private crop into Food; mill stays optional',()=>{
  const field={id:'farm',type:'field',economicOwner:'private',crop:{cycles:0}};
  const base=[{id:'home',type:'house',houseLevel:1},field];
  const {economy,State}=makeHarness([...base,{id:'mill',type:'windmillA',economicOwner:'lord'}]);
  economy.sync();
  field.crop.cycles=1;
  const harvest=Array.from({length:150},(_,day)=>day).find(day=>{
    const date=new Date(Date.UTC(2026,5,1+day));
    return date.getUTCMonth()===8&&economy.weekday(day)===0;
  });
  economy.tick(-1,harvest+3);
  const fromMill=economy.state().lots.food.filter(l=>l.id==='mill');
  assert.ok(fromMill.some(l=>l.owner==='private'&&l.qty>0),'processed grain retains farm ownership');
  assert.equal(economy.state().cropStock.private,0,'unprocessed crop buffer drains');
  const noMillField={id:'other-farm',type:'field',economicOwner:'private',crop:{cycles:0}};
  const noMill=makeHarness([{id:'home',type:'house',houseLevel:1},noMillField]);
  noMill.economy.sync();noMillField.crop.cycles=1;
  noMill.economy.tick(-1,harvest);
  assert.ok(noMill.economy.snapshot().market.food>0,'existing Food production works without mills');
});
console.log('Economy regression: all checks passed.');
