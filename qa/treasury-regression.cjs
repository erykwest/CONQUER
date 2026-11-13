'use strict';
// FISCO-01 phase B: the Erario. Rates are always settable; the centre town hall sets the
// collection efficiency (collected = due × efficiency); Bargello per quarter, Palazzo del
// Balivo in the countryside; decrees from the council chamber, the levy among them.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(root,'src/settlement-treasury.js'),'utf8');

function world(opts={}){
  const econ={castleGold:1000,castle:{food:0,wood:0},wallet:{L1:100,L2:100,L3:100,L4:500},
    happiness:{L1:50,L2:50,L3:50,L4:50}};
  const pop={L1:20,L2:12,L3:6,L4:4,...(opts.pop||{})};
  const structures=[{id:'w0',type:'well',x:0,y:0},{id:'w1',type:'well',x:40,y:0},...(opts.structures||[])];
  const ctx={
    State:{clock:{day:opts.day??10},structures,policies:{tax:10},village:{wellId:'w0'}},
    console,Math,Number,Object,Array,JSON,String,
    villageWells:()=>structures.filter(s=>s.type==='well'),
    villageCenterWell:()=>structures.find(s=>s.id==='w0'),
    wellDisplayName:w=>w.id==='w1'?'Borgo':'Rocca',
    underConstruction:s=>!!s.building,
    civicLevel:s=>Math.max(1,Math.round(Number(s?.civicLevel)||1)),
    markDirty(){}
  };
  ctx.window={
    ConquerEconomy:{state:()=>econ,population:()=>pop,weekday:d=>d%7},
    ConquerCombat:{alarmMode:()=>opts.alarm||'off',enemy:()=>opts.enemy||[],
      areaState:p=>Math.abs(p.x)>100?{allowed:true,yellow:false,green:false}:{allowed:true,yellow:true,green:false}},
    ...(opts.window||{})
  };
  vm.createContext(ctx);
  vm.runInContext(source,ctx);
  return{T:ctx.window.ConquerTreasury,econ,pop,ctx};
}
const townhall=(level,extra={})=>({id:'th',type:'townhall',wellId:'w0',civicLevel:level,x:3,y:0,...extra});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,a+' ≈ '+b);
let passed=0;
function test(name,body){body();passed++;console.log('PASS '+name)}

test('without a centre town hall taxes are collected at 30%; rates are still settable',()=>{
  const {T}=world();
  near(T.efficiency('poll'),.3);
  assert.equal(T.setRate('poll',.2),true);
  near(T.rate('poll'),.2);
  assert.equal(T.setRate('tithe',99),true);
  near(T.rate('tithe'),15); // clamped to the slider range
});
test('the centre town hall caps efficiency by level: 60% · 75% · 85%',()=>{
  for(const [l,cap] of [[1,.6],[2,.75],[3,.85]])near(world({structures:[townhall(l)]}).T.efficiency('poll'),cap);
});
test('a town hall still under construction does not collect',()=>{
  near(world({structures:[townhall(3,{building:true})]}).T.efficiency('poll'),.3);
});
test('the guard room adds 5%, never above 95%',()=>{
  const th=townhall(3,{townhallRooms:true,functions:['council','tribunal','guard']});
  near(world({structures:[th]}).T.efficiency('poll'),.9);
  // Rooms above the town hall level do not count.
  const low=townhall(1,{townhallRooms:true,functions:['council','guard']});
  near(world({structures:[low]}).T.efficiency('poll'),.6);
});
test('collectors come from the Scolarizzati contract: yield scales between floor and cap',()=>{
  const roles=[];
  const {T}=world({structures:[townhall(3)],window:{ConquerEducated:{registerRole:d=>roles.push(d),coverage:()=>({yield:.5})}}});
  near(T.efficiency('poll'),.3+(.85-.3)*.5);
  assert.deepEqual(roles.map(r=>r.id).sort(),['fisco.collector','fisco.judge']);
  assert.ok(roles.every(r=>r.branch==='lay'&&r.payer==='castle'&&typeof r.seats==='function'));
});
test('unhappy payers evade: up to −20%',()=>{
  const {T,econ}=world({structures:[townhall(3)]});
  econ.happiness.L1=0;econ.happiness.L2=0;
  near(T.efficiency('poll'),.65);
  near(T.efficiency('tithe'),.85); // L4 is content: only the payers' mood counts
});
test('an alarm or a siege suspends collection',()=>{
  near(world({structures:[townhall(3)],alarm:'green'}).T.efficiency('poll'),0);
  near(world({structures:[townhall(3)],enemy:[{kind:'raider'}]}).T.efficiency('poll'),0);
  near(world({structures:[townhall(3)],enemy:[{kind:'wolf'}]}).T.efficiency('poll'),.85);
});
test('quarters: a Bargello collects only with the centre town hall; without one they yield less',()=>{
  const house={id:'h',type:'house',x:41,y:1};
  near(world({structures:[townhall(3),house]}).T.efficiency('poll',house),.85*.6);
  const b1={id:'b',type:'bargello',wellId:'w1',civicLevel:1,x:44,y:0};
  near(world({structures:[townhall(3),house,b1]}).T.efficiency('poll',house),.65);
  near(world({structures:[townhall(3),house,{...b1,civicLevel:2}]}).T.efficiency('poll',house),.8);
  near(world({structures:[house,b1]}).T.efficiency('poll',house),.3*.6);
  const r=world({structures:[townhall(3),house,b1]}).T.efficiencyReport();
  assert.equal(r.quarters[0].name,'Borgo');assert.equal(r.quarters[0].bargello,1);
});
test('countryside: the Palazzo del Balivo collects the tithe; elsewhere half the centre',()=>{
  const field={id:'f',type:'field',x:150,y:0};
  near(world({structures:[townhall(3),field]}).T.efficiency('tithe',field),.85*.5);
  near(world({structures:[townhall(3),field,{id:'bv',type:'balivo',civicLevel:2,x:160,y:0}]}).T.efficiency('tithe',field),.75);
  near(world({structures:[field,{id:'bv',type:'balivo',civicLevel:1,x:160,y:0}]}).T.efficiency('tithe',field),.6);
});
test('tithe in kind: the castle stores get due × efficiency, the owner keeps the rest',()=>{
  const {T,econ}=world({structures:[townhall(2)]});
  T.setRate('tithe',10);
  const kept=T.tithe(econ,'food',100,{x:1,y:1});
  near(kept,100-10*.75);near(econ.castle.food,7.5);
  near(T.state().week.due.tithe,10);
});
test('Saturday: testatico from L1/L2 wallets, workshop dues from L3, unrest only on the payers',()=>{
  const {T,econ,pop}=world({structures:[townhall(2)]});
  T.setRate('poll',.3);T.setRate('dues',20);
  near(T.accrueDues(50,null),50*.2*.75);
  const gold=econ.castleGold;
  T.weekly(12);
  const poll=(pop.L1+pop.L2)*.3*.75;
  near(econ.castleGold,gold+poll+7.5);
  near(econ.wallet.L1,100-pop.L1*.3*.75);near(econ.wallet.L3,100-7.5);
  near(econ.happiness.L1,49);near(econ.happiness.L2,49);near(econ.happiness.L3,50-.8);
  near(econ.happiness.L4,50);
  const last=T.snapshot().last;
  near(last.due.poll,(pop.L1+pop.L2)*.3);near(last.collected.dues,7.5);
});
test('the testatico never takes more than a class wallet holds',()=>{
  const {T,econ}=world({structures:[townhall(3)]});
  econ.wallet.L1=1;T.setRate('poll',.3);T.weekly(12);
  near(econ.wallet.L1,0);
});
test('toll at the gates: paid by foreign merchants, waived during the fair',()=>{
  const {T,econ}=world({structures:[townhall(3)]});
  T.setRate('toll',10);const gold=econ.castleGold;
  near(T.toll('j1'),8.5);near(econ.castleGold,gold+8.5);
  T.issue('fair');near(T.toll('j2'),0);
});
test('decrees need the centre town hall and its level; the levy needs L2, or L1 in a crisis',()=>{
  assert.match(world().T.decreeStatus('feast').reason,/Municipio del centro/);
  const one=world({structures:[townhall(1)]}).T;
  assert.equal(one.decreeStatus('feast').ok,true);
  assert.match(one.decreeStatus('breadCap').reason,/L2/);
  assert.match(one.decreeStatus('levy').reason,/L2/);
  assert.equal(world({structures:[townhall(1)],alarm:'green'}).T.decreeStatus('levy').ok,true);
  assert.match(world({structures:[townhall(2)]}).T.decreeStatus('fair').reason,/L3/);
  const noCouncil=townhall(2,{townhallRooms:true,functions:['tribunal','guard']});
  assert.match(world({structures:[noCouncil]}).T.decreeStatus('feast').reason,/consiglio/);
});
test('a decree costs gold, lasts its days, then lapses',()=>{
  const {T,econ,ctx}=world({structures:[townhall(1)],day:7});
  const gold=econ.castleGold;
  assert.equal(T.issue('feast').ok,true);
  near(econ.castleGold,gold-60);
  assert.equal(T.active('feast'),true);
  assert.equal(T.issue('feast').ok,false);
  ctx.State.clock.day=14;T.daily(14);
  assert.equal(T.active('feast'),false);
});
test('the Leva straordinaria keeps a share of the men under arms; repeated within 8 weeks it weighs double',()=>{
  const {T,econ,ctx}=world({structures:[townhall(2)],day:0});
  let refreshed=0;ctx.window.ConquerCombat.refreshLevy=()=>refreshed++;
  assert.equal(T.issue('levy',{days:14,share:20}).ok,true);
  near(T.levyShare(),.2);assert.equal(refreshed,1);
  T.weekly(5);near(econ.happiness.L1,50-.6);
  ctx.State.clock.day=14;T.daily(14);
  near(T.levyShare(),0);assert.equal(refreshed,2);
  ctx.State.clock.day=30;
  const again=T.issue('levy',{days:21,share:30});
  assert.equal(again.ok,true);assert.equal(again.entry.repeat,true);
  const h=econ.happiness.L1;T.weekly(33);near(econ.happiness.L1,h-.9*2);
});
test('amnesty: once, then a cooldown; bread cap holds food at its base price',()=>{
  const {T,ctx}=world({structures:[townhall(2)]});
  assert.equal(T.issue('amnesty').ok,true);
  assert.match(T.decreeStatus('amnesty').reason,/Di nuovo/);
  assert.equal(T.priceCap('food',3,2),3);
  T.issue('breadCap');
  assert.equal(T.priceCap('food',3,2),2);assert.equal(T.priceCap('wood',3,2),3);
  ctx.State.clock.day=100;assert.equal(T.decreeStatus('amnesty').ok,true);
});
test('wiring: economy, commerce, combat, panels and index load the Erario',()=>{
  const read=f=>fs.readFileSync(path.join(root,f),'utf8');
  assert.match(read('src/settlement-economy.js'),/ConquerTreasury\?\.daily\?\.\(day\)/);
  assert.match(read('src/settlement-economy.js'),/ConquerTreasury\.tithe\(e,spec\.good,quantity,s\)/);
  assert.match(read('src/settlement-economy.js'),/ConquerTreasury\.priceCap\(/);
  assert.match(read('src/settlement-commerce.js'),/ConquerTreasury\?\.accrueDues\?\./);
  assert.match(read('src/settlement-commerce.js'),/ConquerTreasury\?\.toll\?\./);
  assert.match(read('src/settlement-combat.js'),/leviedResident\(house,resident\)\?'recruit':'release'/);
  const html=read('index.html');
  assert.match(html,/data-profile-tab="erario"/);
  assert.ok(html.indexOf('settlement-treasury.js')>html.indexOf('settlement-commerce.js'));
  assert.doesNotMatch(html,/id="levy"/);
});
console.log(passed+' treasury checks passed');
