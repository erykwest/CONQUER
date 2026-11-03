'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const src=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
const plain=x=>JSON.parse(JSON.stringify(x));
const eq=src('src/settlement-economy.js'),trade=src('src/settlement-commerce.js'),code=src('src/settlement-convoys.js');
function harness(economy=null){
  const State={
    economy,clock:{day:0},village:{founded:true,wellId:'well',borderEntries:[],roadPlan:[]},
    policies:{tax:0},dirty:false,resources:{},
    structures:[
      {id:'well',type:'well'},
      {id:'keep',type:'tower',isMastio:true,functions:['commonHall']},
      {id:'home4',type:'house',houseLevel:4},
      {id:'home3',type:'house',houseLevel:3}
    ]
  };
  let slots=3;
  const window={ConquerSiege:{
    mastio:()=>State.structures.find(s=>s.id==='keep'&&s.isMastio&&!s.destroyed),
    capacity:()=>({soldiers:slots})
  }};
  const ctx=vm.createContext({State,window,console,Math,Number,Array,Object,Set,
    document:{getElementById:()=>null},
    calendarDateFromDay:day=>({month:0,year:1,day:day+1}),
    houseLevel:s=>s.houseLevel,underConstruction:s=>!!s.construction,
    clamp:(x,a,b)=>Math.max(a,Math.min(b,x))
  });
  vm.runInContext(eq,ctx);
  vm.runInContext(src('src/settlement-urban-economy.js'),ctx);
  vm.runInContext(src('src/settlement-market-economy.js'),ctx);
  vm.runInContext(trade,ctx);
  vm.runInContext(code,ctx);
  return{State,window,commerce:window.ConquerCommerce,convoys:window.ConquerConvoys,
    economy:window.ConquerEconomy,setSlots:n=>slots=n};
}
function test(title,fn){fn();console.log('✓ '+title)}
test('vehicle definitions and chassis roles are separate from economic inventory',()=>{
  const h=harness(),v=h.commerce.VEHICLES;
  assert.equal(v.cart.capacity,40);
  assert.equal(v.wagon.capacity,100);
  assert.equal(v.coach.capacity,0);
  assert.equal(v.coach.passengers,2);
  assert.equal(h.convoys.quoteCargo([{good:'stone',qty:4}],0,'cart').wagons,1);
  assert.equal(h.convoys.quoteCargo([{good:'stone',qty:5}],0,'cart').wagons,2);
  assert.equal(h.convoys.quoteCargo([{good:'stone',qty:5}],0,'wagon').wagons,1);
  assert.equal(h.convoys.quoteCargo([{good:'stone',qty:5}],0,'coach'),null);
  assert.equal(h.convoys.quoteCargo([],50,'cart').wagons,1);
  assert.equal(h.convoys.quoteCargo([],0,'cart').wagons,0);
});
test('lord gift starts at real mastio and is just a draft before treasury hold',()=>{
  const h=harness(),e=h.economy.state();
  e.castleGold=80;e.castle.stone=18;
  const before={gold:e.castleGold,stone:e.castle.stone};
  assert.equal(h.convoys.planLordConvoy({id:'gift',kind:'gift',destinationId:'foreign',
    cargo:[{good:'stone',qty:10}],coinGold:20,guards:2}),true);
  const j=h.convoys.state().lordConvoys.gift;
  assert.equal(j.originStructureId,'keep');
  assert.equal(j.originRole,'mastio');
  assert.equal(j.status,'draft');
  assert.equal(j.escorts.kind,'garrison');
  assert.equal(j.escorts.requested,2);
  assert.equal(j.escorts.assigned,0,'capacity is not an actual soldier roster');
  assert.equal(j.chest.gold,20);
  assert.equal(j.chest.reservedGold,0);
  assert.equal(j.transport.wagons,1);
  assert.equal(e.castleGold,before.gold);
  assert.equal(e.castle.stone,before.stone);
});
test('no mastio, no gift: goods and/or coins required, each good once (own wagons)',()=>{
  const h=harness();
  const p={id:'t',kind:'tribute',destinationId:'foreign',cargo:[{good:'food',qty:3}]};
  assert.equal(h.convoys.planLordConvoy({...p,destinationId:'well'}),false);
  assert.equal(h.convoys.planLordConvoy({...p,cargo:[],coinGold:0}),false);
  assert.equal(h.convoys.planLordConvoy({...p,cargo:[
    {good:'food',qty:3},{good:'food',qty:2}]}),false);
  assert.equal(h.convoys.planLordConvoy({...p,id:'two',cargo:[
    {good:'food',qty:3},{good:'stone',qty:2}]}),true);
  assert.equal(h.convoys.state().lordConvoys.two.transport.wagons,2,'one wagon per good');
  h.convoys.cancelLordConvoy('two');
  assert.equal(h.convoys.planLordConvoy({...p,cargo:[{good:'gold',qty:1}]}),false);
  h.State.structures.find(s=>s.id==='keep').isMastio=false;
  assert.equal(h.convoys.planLordConvoy(p),false);
});
test('castle funding is all-or-nothing and cannot debit unrelated market lots',()=>{
  const h=harness(),e=h.economy.state();
  e.castle.stone=5;e.castleGold=10;
  h.convoys.planLordConvoy({id:'t',kind:'tribute',destinationId:'a',
    cargo:[{good:'stone',qty:6}],coinGold:6});
  const before=plain(h.economy.snapshot().market);
  assert.equal(h.convoys.reserveLordConvoy('t'),false);
  assert.equal(e.castle.stone,5);assert.equal(e.castleGold,10);
  e.castle.stone=9;e.castleGold=5;
  assert.equal(h.convoys.reserveLordConvoy('t'),false);
  assert.equal(e.castle.stone,9);assert.equal(e.castleGold,5);
  e.castleGold=10;
  assert.equal(h.convoys.reserveLordConvoy('t'),true);
  assert.equal(e.castle.stone,3);assert.equal(e.castleGold,4);
  assert.equal(h.convoys.state().lordConvoys.t.status,'ready');
  assert.equal(h.convoys.state().lordConvoys.t.chest.reservedGold,6);
  assert.equal(h.convoys.reserveLordConvoy('t'),false);
  assert.deepEqual(plain(h.economy.snapshot().market),before);
  assert.equal(h.convoys.cancelLordConvoy('t'),true);
  assert.equal(e.castle.stone,9);assert.equal(e.castleGold,10);
  assert.equal(h.convoys.cancelLordConvoy('t'),false);
});
test('gift with coins only reserves actual gold and brings a chest in a wagon',()=>{
  const h=harness(),e=h.economy.state();
  e.castleGold=25;
  assert.equal(h.convoys.planLordConvoy({id:'coin-gift',kind:'gift',
    destinationId:'other',cargo:[],coinGold:20,vehicle:'wagon'}),true);
  const j=h.convoys.state().lordConvoys['coin-gift'];
  assert.equal(j.transport.wagons,1);
  assert.equal(j.transport.loadPoints,0);
  assert.equal(h.convoys.reserveLordConvoy('coin-gift'),true);
  assert.equal(e.castleGold,5);
  assert.deepEqual(plain(j.reservedCargo),[]);
  assert.equal(h.convoys.cancelLordConvoy('coin-gift'),true);
  assert.equal(e.castleGold,25);
});
test('lord guard requests reserve only free barracks slots and release them',()=>{
  const h=harness();
  assert.equal(h.convoys.guardSlots(),3);
  assert.equal(h.convoys.planLordConvoy({id:'a',destinationId:'x',coinGold:1,guards:2}),true);
  assert.equal(h.convoys.availableGuardSlots(),1);
  assert.equal(h.convoys.planLordConvoy({id:'b',destinationId:'y',coinGold:1,guards:2}),false);
  assert.equal(h.convoys.planLordConvoy({id:'b',destinationId:'y',coinGold:1,guards:1}),true);
  assert.equal(h.convoys.assignLordGuards('a',3),false);
  assert.equal(h.convoys.assignLordGuards('a',1),true);
  assert.equal(h.convoys.availableGuardSlots(),1);
  assert.equal(h.convoys.cancelLordConvoy('b'),true);
  assert.equal(h.convoys.availableGuardSlots(),2);
  h.setSlots(1);
  assert.equal(h.convoys.reserveLordConvoy('a'),true,'can still book within reduced capacity');
  h.setSlots(0);
  assert.equal(h.convoys.availableGuardSlots(),0);
  assert.equal(h.convoys.assignLordGuards('a',0),false,'ready convoy immutable');
});
test('a saved prepared convoy does not fund itself twice on reload',()=>{
  const h=harness(),e=h.economy.state();e.castle.wood=12;e.castleGold=50;
  assert.equal(h.convoys.planLordConvoy({id:'pledge',destinationId:'other',
    kind:'tribute',cargo:[{good:'wood',qty:5}],coinGold:10}),true);
  assert.equal(h.convoys.reserveLordConvoy('pledge'),true);
  const restored=harness(plain(h.State.economy)),r=restored.economy.state();
  assert.equal(r.castle.wood,7);assert.equal(r.castleGold,40);
  assert.equal(restored.convoys.state().lordConvoys.pledge.status,'ready');
  assert.equal(restored.convoys.reserveLordConvoy('pledge'),false);
  assert.equal(restored.convoys.cancelLordConvoy('pledge'),true);
  assert.equal(r.castle.wood,12);assert.equal(r.castleGold,50);
});
test('mercenaries are merchant-funded brown leather escorts with double L2 daily wage',()=>{
  const h=harness(),e=h.economy.state();
  const wallet=e.wallet.L4;
  assert.equal(h.commerce.planJourney({id:'merchant',source:'resident',houseId:'home4',
    originId:'well',destinationId:'else',coinGold:10,cargo:[{good:'stone',qty:11}],
    mercenaryCount:2}),true);
  const j=h.convoys.state().journeys.merchant;
  assert.equal(j.escort.type,'mercenary');
  assert.equal(j.escort.armor,'leather');
  assert.equal(j.escort.heraldry,'neutral-brown');
  assert.equal(j.escort.wageMultiplier,2);
  assert.equal(h.convoys.mercenaryDailyWage(),e.wage.L2/20*2);
  const quote=h.convoys.quoteJourneyCost('merchant',5);
  assert.deepEqual(plain(quote),{days:5,wagons:2,guards:2,vehiclePerDay:.4,
    escortPerDay:.4,transport:2,escort:2,total:4});
  assert.equal(e.wallet.L4,wallet,'costs are estimates until travel is implemented');
  assert.equal(h.convoys.assignMerchantEscorts('merchant',1),true);
  assert.equal(h.convoys.quoteJourneyCost('merchant',5).escort,1);
  assert.equal(h.convoys.quoteJourneyCost('merchant',NaN),null);
});
test('noble coach favors ladies but allows men and has no goods',()=>{
  const h=harness();
  assert.equal(h.convoys.planNobleCoach({id:'lady',originId:'well',
    destinationId:'other',houseId:'home4',women:2,men:0}),true);
  const coach=h.convoys.state().nobleJourneys.lady;
  assert.equal(coach.transport.mode,'coach');
  assert.equal(coach.passengers.total,2);
  assert.equal(coach.preferredPassengers,'noblewomen');
  assert.equal(h.convoys.planNobleCoach({id:'men',originId:'well',
    destinationId:'other',houseId:'home4',women:0,men:1}),true);
  assert.equal(h.convoys.planNobleCoach({id:'too-many',originId:'well',
    destinationId:'other',houseId:'home4',women:3}),false);
  assert.equal(h.convoys.planNobleCoach({id:'artisan',originId:'well',
    destinationId:'other',houseId:'home3',women:1}),false);
  assert.equal(h.convoys.cancelNobleCoach('lady'),true);
  assert.equal(h.convoys.cancelNobleCoach('lady'),false);
});
test('exit points come from existing four persisted main-road entries, never generated',()=>{
  const h=harness();h.State.village.borderEntries=[
    {id:'n',edge:'north',x:10,y:0},{id:'e',edge:'east',x:100,y:10},
    {id:'s',edge:'south',x:10,y:100},{id:'w',edge:'west',x:0,y:10}];
  h.State.village.roadPlan=[{id:'arterial-0',edge:'north',connected:true}];
  assert.deepEqual(plain(h.convoys.availableExits()).map(x=>x.edge),
    ['north','east','south','west']);
  const exits=h.convoys.availableExits();
  assert.equal(exits[0].reportedConnected,true);
  assert.equal(exits[1].reportedConnected,false);
  assert.equal(exits[0].entryId,'n');
  assert.deepEqual(plain(exits[0].point),{x:10,y:0});
});
test('mastio control panel is visible only for the real keep',()=>{
  const h=harness();
  assert.equal(h.convoys.panelHtml({id:'not-the-keep',type:'tower'}),'');
  const panel=h.convoys.panelHtml(h.State.structures.find(s=>s.id==='keep'));
  assert.ok(panel.includes('Tributi / doni'));
  assert.ok(panel.includes('data-convoy-guard-count'));
  assert.ok(panel.includes('data-convoy-add'));
  assert.ok(panel.includes('data-convoy-destination'));
});
test('scheduled convoy departs with provisions, delivers, returns; travelling cannot be cancelled',()=>{
  const h=harness(),e=h.economy.state();
  e.castleGold=100;e.castle.wood=20;e.castle.food=50;
  assert.equal(h.convoys.planLordConvoy({id:'go',kind:'gift',destinationId:'province-north',
    cargo:[{good:'wood',qty:10}],coinGold:30,guards:1,routeDistance:4,departDay:2}),true);
  assert.equal(h.convoys.reserveLordConvoy('go'),true);
  assert.equal(e.castleGold,70);assert.equal(e.castle.wood,10);
  h.convoys.tick(0,3);
  assert.equal(h.convoys.state().lordConvoys.go.status,'ready','reserved but not scheduled: stays home');
  assert.equal(h.convoys.scheduleLordConvoy('go'),true);
  h.convoys.tick(3,3.5);
  const j=h.convoys.state().lordConvoys.go,t=h.convoys.travel(j);
  assert.equal(j.status,'outbound');assert.equal(t.outward,2,'(4U road + 40U beyond) / 22U per day');
  assert.equal(e.castle.food,50-t.food,'escort + drivers provisions');
  assert.equal(e.castleGold,70,'gold reserved once');
  assert.equal(h.convoys.cancelLordConvoy('go'),false);
  h.convoys.tick(3.5,j.returnDay+.1);
  assert.equal(j.status,'completed');assert.equal(e.castleGold,70);assert.equal(e.castle.wood,10);
  assert.equal(h.convoys.snapshot().lordActive,0);
});
test('lifecycle snapshot and script order',()=>{
  const h=harness();
  assert.equal(h.convoys.snapshot().lordReady,0);
  assert.equal(h.convoys.snapshot().nobleCoachDrafts,0);
  const html=src('index.html'),rooms=src('src/settlement-app-rooms.js');
  assert.ok(html.indexOf('settlement-commerce.js')<html.indexOf('settlement-convoys.js'));
  assert.ok(html.indexOf('settlement-convoys.js')<html.indexOf('settlement-app.js'));
  assert.ok(rooms.includes('window.ConquerConvoys?.panelHtml?.(s)'));
  assert.ok(rooms.includes('window.ConquerConvoys?.bindPanel?.(slots)'));
});
console.log('Convoys contracts regression: all checks passed.');
