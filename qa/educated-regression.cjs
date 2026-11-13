'use strict';
// SCOL-01 fase 1: Scolarizzati counters, L3/L4 cap, overflow without housing,
// lord's hire with a two-week journey, lazy save migration (D-SCOL-261112).
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'../src',f),'utf8');
const economySource=read('settlement-economy.js'),educatedSource=read('settlement-educated.js');
const house=(id,level)=>({id,type:'house',houseLevel:level});
function harness(structures,{economy}={}){
  const State={clock:{day:0},village:{founded:true,wellId:'well',foundingWorkers:0},
    structures,policies:{tax:0,rations:'market'}};
  if(economy)State.economy=economy;
  const window={ConquerCombat:{alarmMode:()=>'off'}};
  const context=vm.createContext({State,window,document:{getElementById:()=>null},
    underConstruction:()=>false,calendarDateFromDay:day=>({month:Math.floor(day/30),year:1,day:day%30+1}),
    console,Math,Number,Object,Array,Set,JSON});
  vm.runInContext(economySource,context);
  vm.runInContext(educatedSource,context);
  const E=window.ConquerEconomy,S=window.ConquerEducated;
  E.state().castleGold=1000;
  return{State,E,S};
}
const check=(label,fn)=>{fn();console.log('PASS '+label)};

check('cap is a third of L3/L4 residents: 3 seats per L3 house, 4 per L4, none for L1/L2',()=>{
  const {S}=harness([house('a',1),house('b',2),house('c',3),house('d',3),house('e',4)]);
  assert.deepEqual({...S.capacity()},{L3:6,L4:4});
  const s=S.summary();
  assert.equal(s.total,0);assert.equal(s.capacity.total,10);assert.equal(s.free,10);
});
check('old saves migrate lazily to an empty block without resetting the economy',()=>{
  const {E,S}=harness([house('c',3)]);
  const e=E.state();e.wallet.L3=77;delete e.educated;
  const d=S.state();
  assert.equal(e.version,1);assert.equal(e.wallet.L3,77);
  assert.deepEqual(JSON.parse(JSON.stringify(d.lay)),{L3:0,L4:0});
  assert.deepEqual(JSON.parse(JSON.stringify(d.clergy)),{L3:0,L4:0});
  assert.equal(d.wageMul,1);assert.deepEqual([...d.hires],[]);
});
check('a hire costs 40 castle gold and arrives as lay after 14 days',()=>{
  const {E,S}=harness([house('c',3)]);
  const out=S.hire(0);
  assert.equal(out.ok,true);assert.equal(out.arrivalDay,14);
  assert.equal(E.state().castleGold,960);
  E.tick(-1,13);assert.equal(S.summary().lay,0);assert.equal(S.summary().hiresInTransit,1);
  E.tick(13,14);assert.equal(S.summary().lay,1);assert.equal(S.summary().byClass.L3,1);
  assert.equal(S.summary().hiresInTransit,0);
});
check('hiring needs gold and a seat not already promised to a hire in transit',()=>{
  const {E,S}=harness([house('c',3)]);
  for(let i=0;i<3;i++)assert.equal(S.hire(0).ok,true);
  assert.deepEqual({...S.hire(0)},{ok:false,reason:'seats'});
  const poor=harness([house('c',3)]);poor.E.state().castleGold=39;
  assert.deepEqual({...poor.S.hire(0)},{ok:false,reason:'gold'});
  const none=harness([house('a',2)]);
  assert.deepEqual({...none.S.hire(0)},{ok:false,reason:'seats'});
  assert.equal(E.state().castleGold,880);
});
check('a hire arriving with no free seat refunds the gold',()=>{
  const {State,E,S}=harness([house('c',3)]);
  S.hire(0);
  State.structures.length=0; // the only L3 house is gone before arrival
  E.tick(-1,14);
  assert.equal(S.summary().total,0);assert.equal(E.state().castleGold,1000);
});
check('new arrivals fill L3 seats before L4',()=>{
  const {E,S}=harness([house('c',3),house('l',4)]);
  const d=S.state();d.hires=Array.from({length:5},()=>({arrivalDay:0,paid:40}));
  E.tick(-1,0);
  assert.deepEqual({...S.summary().byClass},{L3:3,L4:2});
});
check('losing a house: overflow moves to free L4 seats, then waits homeless, rehoused when seats return',()=>{
  const {State,E,S}=harness([house('c',3),house('d',3),house('l',4)]);
  const d=S.state();d.lay.L3=5;d.clergy.L3=1;d.lay.L4=3;
  State.structures.splice(1,1); // house d burns: L3 cap 6 -> 3
  E.tick(-1,0);
  // L3 over by 3: lay leave first; one fits the last L4 seat, two wait homeless.
  assert.deepEqual({...S.summary().byClass},{L3:3,L4:4});
  assert.equal(S.summary().homeless,2);assert.equal(d.clergy.L3,1,'clergy keep their seat while lay can leave');
  State.structures.push(house('d2',3));
  E.tick(0,1);
  assert.equal(S.summary().homeless,0);assert.equal(S.summary().byClass.L3,5);
});
check('homeless scolarizzati emigrate after four weeks',()=>{
  const {State,E,S}=harness([house('c',3)]);
  const d=S.state();d.lay.L3=3;
  State.structures.length=0;
  E.tick(-1,0);assert.equal(S.summary().homeless,3);
  E.tick(0,27);assert.equal(S.summary().homeless,3);
  E.tick(27,28);assert.equal(S.summary().homeless,0);assert.equal(S.summary().total,0);
});
check('the educated block round-trips through a JSON save',()=>{
  const first=harness([house('c',3)]);
  first.S.hire(0);first.S.state().clergy.L3=1;
  const saved=JSON.parse(JSON.stringify(first.State.economy));
  const second=harness([house('c',3)],{economy:saved});
  second.E.state().castleGold=saved.castleGold;
  assert.equal(second.S.summary().clergy,1);assert.equal(second.S.summary().hiresInTransit,1);
  second.E.tick(saved.lastDay,14);
  assert.equal(second.S.summary().lay,1);
});
check('scolarizzati never change class population or the L3/L4 labour limits in phase 1',()=>{
  const {E,S}=harness([house('c',3),house('l',4)]);
  const before=JSON.stringify(E.laborAllocation(0).limits||E.population());
  S.state().lay.L3=3;S.state().lay.L4=2;
  assert.equal(JSON.stringify(E.laborAllocation(0).limits||E.population()),before);
  assert.deepEqual({...E.population()},{L1:0,L2:0,L3:9,L4:12});
});
