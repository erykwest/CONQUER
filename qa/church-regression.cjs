'use strict';
// CHIESA-01 fase 1: Church treasury, Sunday offerings, yearly bequests, lord's gift.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
const economyCode=read('src/settlement-economy.js'),churchCode=read('src/settlement-church.js');
const html=read('index.html');
// 30-day months, 12 months a year: month/year boundaries are deterministic.
const calendarDateFromDay=day=>({day:day%30+1,month:Math.floor(day/30)%12,year:Math.floor(day/360)+1});
function harness({saved=null,churches=[{id:'church1',civicLevel:1}],houses={1:2,3:2,4:1}}={}){
  const structures=[{id:'well',type:'well',x:0,y:0}];
  let n=0;
  for(const [lvl,count] of Object.entries(houses))for(let i=0;i<count;i++)structures.push({id:'h'+(n++),type:'house',houseLevel:+lvl});
  for(const c of churches)structures.push({type:'church',...c});
  const State={clock:{day:0},village:{founded:true,wellId:'well',foundingWorkers:0},economy:saved,
    structures,resources:{},policies:{},dirty:false};
  const window={};
  const ctx=vm.createContext({State,window,console,Math,Number,Array,Object,JSON,
    document:{getElementById:()=>null},calendarDateFromDay,
    underConstruction:s=>!!s.construction&&State.clock.day<s.construction.completeDay,
    civicLevel:s=>Math.max(1,Math.min(3,Math.round(Number(s?.civicLevel)||1))),
    fieldLayout:()=>({cells:[{index:0}],area:4})});
  vm.runInContext(economyCode,ctx,{filename:'settlement-economy.js'});
  vm.runInContext(churchCode,ctx,{filename:'settlement-church.js'});
  return{State,window,e:window.ConquerEconomy,ch:window.ConquerChurch};
}
function test(name,fn){fn();console.log('✓ '+name)}
const near=(a,b,msg)=>assert.ok(Math.abs(a-b)<1e-6,msg+' ('+a+' vs '+b+')');

test('lazy migration: treasury born at 0 gold, Favour 50, economy version unchanged',()=>{
  const h=harness();
  const c=h.ch.state();
  assert.equal(c.gold,0);assert.equal(c.favor,50);
  assert.deepEqual(JSON.parse(JSON.stringify(c.month.in)),{offerings:0,bequests:0,gifts:0});
  assert.equal(h.e.state().version,1);
  // An old save without the block keeps its wallets and gains the block.
  const old=JSON.parse(JSON.stringify(h.e.state()));delete old.church;old.wallet.L4=777;
  const h2=harness({saved:old});
  assert.equal(h2.e.state().wallet.L4,777);
  assert.equal(h2.ch.state().favor,50);
});
test('seat is the highest-level church, then the oldest; capacity sums 60/150/300',()=>{
  const h=harness({churches:[{id:'c2',civicLevel:2},{id:'c1',civicLevel:2},{id:'c0',civicLevel:1},
    {id:'c9',civicLevel:3,construction:{completeDay:99}}]});
  assert.equal(h.ch.seat().id,'c1','unfinished L3 church is not the seat');
  assert.equal(h.ch.capacity(),150+150+60);
});
test('Sunday offerings: per-head quota × served share × (0.5+happiness/100), from each class purse',()=>{
  const h=harness(),e=h.e.state();
  // Population: L1 2×3=6, L3 2×9=18, L4 1×12=12 → 36 residents, capacity 60 → all served.
  assert.equal(h.ch.servedShare(),1);
  const before={...e.wallet};
  e.happiness={L1:50,L2:50,L3:70,L4:30};
  const total=h.ch.offerings(6);
  const expect={L1:6*.02*1,L3:18*.1*1.2,L4:12*.3*.8};
  near(before.L1-e.wallet.L1,expect.L1,'L1 pays');
  near(before.L3-e.wallet.L3,expect.L3,'L3 pays');
  near(before.L4-e.wallet.L4,expect.L4,'L4 pays');
  assert.equal(e.wallet.L2,before.L2,'no L2 residents, no L2 offering');
  near(total,expect.L1+expect.L3+expect.L4,'total');
  near(h.ch.state().gold,total,'into the treasury');
  near(h.ch.state().month.in.offerings,total,'booked as offerings');
  assert.equal(e.castleGold,300,'the lord never touches the offerings');
});
test('offerings never exceed the purse and need a completed church',()=>{
  const h=harness(),e=h.e.state();e.wallet.L4=1;
  h.ch.offerings(6);
  assert.equal(e.wallet.L4,0);
  const none=harness({churches:[{id:'c',construction:{completeDay:50}}]});
  assert.equal(none.ch.offerings(6),0);
  assert.equal(none.ch.state().gold,0);
});
test('served share caps offerings when the population exceeds church capacity',()=>{
  // 10 L4 houses = 120 residents vs capacity 60 → half served.
  const h=harness({houses:{4:10}}),e=h.e.state();
  assert.equal(h.ch.servedShare(),.5);
  const before=e.wallet.L4;h.ch.offerings(6);
  near(before-e.wallet.L4,120*.5*.3*1,'half the L4 residents give');
});
test('the clergy coverage of SCOL-01 scales offerings once ConquerEducated exists',()=>{
  const h=harness();
  h.window.ConquerEducated={coverage:id=>id==='church.priest'?{yield:0}:null};
  assert.equal(h.ch.worshipYield(),0);
  assert.equal(h.ch.offerings(6),0,'a church without clergy does not celebrate');
});
test('economy tick: offerings only on Sundays, month rollover keeps last month',()=>{
  const h=harness();
  h.e.tick(0,5); // Monday–Saturday
  assert.equal(h.ch.state().gold,0,'no offering before Sunday');
  h.e.tick(5,6);
  const sunday=h.ch.state().gold;
  assert.ok(sunday>0,'Sunday offering collected');
  h.e.tick(6,29); // month 0 ends on day 29
  const c=h.ch.state();
  assert.ok(c.lastMonth&&c.lastMonth.in.offerings>=sunday,'closing month kept for the panel');
  assert.equal(c.month.in.offerings,0,'new month starts empty');
});
test('yearly bequests: 2% of L3 and L4 purses, only for classes with happiness ≥ 50',()=>{
  const h=harness(),e=h.e.state();
  e.wallet.L3=100;e.wallet.L4=500;e.happiness.L3=60;e.happiness.L4=40;
  const paid=h.ch.annual(359);
  near(paid,2,'only L3 bequeaths');
  near(e.wallet.L3,98,'L3 purse');assert.equal(e.wallet.L4,500,'unhappy L4 keeps its gold');
  near(h.ch.state().month.in.bequests,2,'booked as bequests');
  const empty=harness({churches:[]});
  assert.equal(empty.ch.annual(359),0,'no church, no bequests');
});
test('bequests are booked in the closing month by the economy tick',()=>{
  const h=harness(),e=h.e.state();
  h.e.tick(0,358);
  // The test village has no food: reset morale just before the year closes.
  e.happiness.L3=80;e.happiness.L4=80;e.wallet.L4=500;
  h.e.tick(358,359);
  assert.ok(h.ch.state().lastMonth.in.bequests>0,'year-end bequest belongs to the last month of the year');
});
test("the lord's gift: castle gold to the treasury, +1 Favour every 10 gold",()=>{
  const h=harness(),e=h.e.state();
  assert.equal(h.ch.donate(50),true);
  assert.equal(e.castleGold,250);assert.equal(h.ch.state().gold,50);
  assert.equal(h.ch.state().favor,55);
  assert.equal(h.ch.state().month.in.gifts,50);
  assert.equal(h.ch.state().favorLog.at(-1).cause,'gift');
  assert.equal(h.State.resources.gold,250,'builder resources follow');
  assert.equal(h.ch.donate(30),false,'only 10/50/100');
  e.castleGold=5;assert.equal(h.ch.donate(10),false,'not beyond castle gold');
  e.castleGold=10000;for(let i=0;i<20;i++)h.ch.donate(100);
  assert.equal(h.ch.state().favor,100,'Favour capped at 100');
  assert.equal(harness({churches:[]}).ch.donate(10),false,'no church, no gift');
});
test('inspector tab and wiring',()=>{
  const h=harness();h.ch.donate(10);
  const markup=h.ch.panelHtml(h.State.structures.find(s=>s.type==='church'));
  assert.match(markup,/Cassa della Chiesa/);assert.match(markup,/data-church-gift="100"/);
  assert.match(markup,/Parrocchia · sede/);
  assert.equal(h.ch.panelHtml({type:'tavern'}),'');
  assert.ok(html.indexOf('settlement-economy.js')<html.indexOf('settlement-church.js'),'church after economy');
  assert.ok(html.indexOf('settlement-church.js')<html.indexOf('settlement-app-rooms.js'),'church before the inspector');
  assert.match(read('src/settlement-app-rooms.js'),/ConquerChurch\?\.panelHtml\?\.\(s\)/);
  assert.match(read('src/ui/shell.js'),/ChurchPanel/);
  assert.match(read('src/settlement-panels.js'),/kpi\('Chiesa'/);
});
console.log('church-regression: all passed');
