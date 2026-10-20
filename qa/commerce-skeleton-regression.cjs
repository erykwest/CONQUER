'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const commerceCode=fs.readFileSync(path.join(ROOT,'src/settlement-commerce.js'),'utf8');
const economyCode=fs.readFileSync(path.join(ROOT,'src/settlement-economy.js'),'utf8');
const residentsCode=fs.readFileSync(path.join(ROOT,'src/settlement-population-residents.js'),'utf8');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const local=fs.readFileSync(path.join(ROOT,'src/settlement-app-persistence.js'),'utf8');
const core=fs.readFileSync(path.join(ROOT,'src/settlement-core.js'),'utf8');
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function harness(saved=null){
  const State={clock:{day:0},village:{founded:true,wellId:'well',foundingWorkers:0},
    economy:saved,structures:[
      {id:'well',type:'well',x:0,y:0},
      {id:'home3',type:'house',houseLevel:3},
      {id:'home3b',type:'house',houseLevel:3},
      {id:'home4',type:'house',houseLevel:4},
      {id:'home2',type:'house',houseLevel:2},
      {id:'inn',type:'tavern'},
      {id:'church',type:'church'},
      {id:'mine',type:'mine',economicOwner:'private'},
      {id:'field',type:'field',economicOwner:'lord'}
    ],resources:{},policies:{tax:10},dirty:false};
  const window={};
  const calendarDateFromDay=day=>({month:0,year:1,day:day+1});
  const ctx=vm.createContext({State,window,console,Math,Number,Array,Object,document:{getElementById:()=>null},
    calendarDateFromDay,clamp,
    underConstruction:s=>!!s.construction&&State.clock.day<s.construction.completeDay,
    houseLevel:s=>s.houseLevel,
    fieldLayout:()=>({cells:[{index:0}],area:4})
  });
  vm.runInContext(economyCode,ctx,{filename:'settlement-economy.js'});
  vm.runInContext(commerceCode,ctx,{filename:'settlement-commerce.js'});
  return{State,window,e:window.ConquerEconomy,c:window.ConquerCommerce,ctx};
}
function test(name,fn){fn();console.log('✓ '+name)}
function asObject(o){return JSON.parse(JSON.stringify(o))}
test('commerce boots empty without L4+ resident inflation or phantom transactions',()=>{
  const h=harness(),before=h.e.snapshot();
  const c=h.c.snapshot(),after=h.e.snapshot();
  assert.deepEqual(asObject(c),{l3Shops:0,l3Services:2,l3OperatedServices:0,
    l4PrimarySites:1,l4PlusPlanned:0,l4PlusPresent:0,
    l4PlusDeclaredGold:0,l4PlusHeldGold:0,l4PlusWagons:0,
    innBeds:0,innOccupied:0});
  assert.equal(h.c.state().version,2);
  assert.deepEqual(asObject(before.population),asObject(after.population));
  assert.equal(after.castleGold,before.castleGold);
  assert.equal(h.e.GOODS.length,6,'no extra market goods before approval of actual recipes');
  assert.equal(h.c.state().services.inn.operatorHouseId,null,'no invented owner');
});
test('L3 workshops are blueprints, not factories producing free output',()=>{
  const h=harness(),before=h.e.snapshot();
  assert.equal(h.c.registerShop('home3','weaver'),true);
  assert.equal(h.c.registerShop('home2','smith'),false,'L2 cannot own L3 shop');
  assert.equal(h.c.registerShop('home4','smith'),false,'L4 cannot claim L3 shop');
  assert.equal(h.c.registerShop('home3b','invalid'),false);
  assert.equal(h.c.state().shops.home3.status,'blueprint');
  assert.equal(h.c.state().shops.home3.channel,'local');
  assert.equal(h.c.worksiteForHouse('home3').kind,'shop');
  assert.equal(h.c.worksiteForHouse('home3').structure.id,'home3');
  assert.equal(h.c.WORKSHOP_KINDS.weaver.outputs[0],'textiles');
  assert.equal(h.e.snapshot().castleGold,before.castleGold);
  assert.equal(h.c.snapshot().l3Shops,1);
  assert.equal(h.e.snapshot().market.equipment,before.market.equipment);
});
test('L3 can operate inn/church, one local enterprise per household',()=>{
  const h=harness();
  assert.equal(h.c.assignService('inn','home3'),true);
  assert.equal(h.c.assignService('church','home3'),false,'operator cannot staff two businesses');
  assert.equal(h.c.registerShop('home3','tanner'),false,'operator cannot duplicate a shop');
  assert.equal(h.c.assignService('church','home3b'),true);
  assert.equal(h.c.snapshot().l3OperatedServices,2);
  assert.equal(h.c.worksiteForHouse('home3').kind,'service');
  assert.equal(h.c.worksiteForHouse('home3').structure.id,'inn');
  assert.equal(h.c.assignService('inn','home4'),false);
  assert.equal(h.c.assignService('mine','home3'),false);
});
test('primary-site portfolio uses existing economic ownership, without fabricating owners',()=>{
  const h=harness();
  h.e.sync();
  const portfolio=h.c.primaryPortfolio();
  assert.deepEqual(asObject(portfolio).map(p=>({id:p.structureId,owner:p.owner})),
    [{id:'mine',owner:'L4'},{id:'field',owner:'lord'}]);
  assert.equal(h.c.snapshot().l4PrimarySites,1);
  assert.equal(h.c.PRIMARY_KINDS.includes('loggingCamp'),true);
  assert.equal(h.c.PRIMARY_KINDS.includes('clayPit'),false,'new clay quarry not implemented yet');
});
test('resident L4+ trip and foreign L4+ manifest do not create cash or goods',()=>{
  const h=harness(),before=h.e.snapshot();
  const resident={id:'out',source:'resident',houseId:'home4',originId:'well',destinationId:'other',
    cargo:[{good:'stone',qty:2}],coinGold:12};
  const foreign={id:'incoming',source:'external',originId:'other',destinationId:'well',
    cargo:[{good:'wood',qty:4}],coinGold:50};
  assert.equal(h.c.planJourney(resident),true);
  assert.equal(h.c.planJourney(foreign),true);
  assert.equal(h.c.state().journeys.incoming.tier,4);
  assert.equal(h.c.state().journeys.incoming.role,'L4+');
  assert.equal(h.c.snapshot().l4PlusPlanned,2);
  assert.equal(h.c.snapshot().l4PlusDeclaredGold,62);
  assert.equal(h.c.snapshot().l4PlusHeldGold,0,'planning does not take coins from wallet');
  assert.equal(h.c.snapshot().l4PlusWagons,2,'each shipment has its own wagon');
  assert.equal(h.c.state().journeys.out.purse.gold,12);
  assert.equal(h.c.snapshot().l4PlusPresent,0);
  assert.deepEqual(asObject(h.e.population()),asObject(before.population));
  assert.equal(h.e.snapshot().castleGold,before.castleGold);
  assert.deepEqual(asObject(h.e.snapshot().market),asObject(before.market));
  assert.equal(h.c.state().journeys.incoming.cargo[0].qty,4,'manifest does not materialize stock');
});
test('one commodity per journey; coins are a physical purse not a second market good',()=>{
  const h=harness(),before=h.e.snapshot(),wallet=h.e.state().wallet.L4;
  assert.equal(h.c.planJourney({id:'mixed',originId:'x',destinationId:'well',
    cargo:[{good:'stone',qty:1},{good:'luxury',qty:1}],coinGold:20}),false);
  assert.equal(h.c.planJourney({id:'gold-false-good',originId:'x',destinationId:'well',
    cargo:[{good:'gold',qty:10}]}),false);
  assert.equal(h.c.planJourney({id:'negative-gold',originId:'x',destinationId:'well',
    coinGold:-1}),false);
  assert.equal(h.c.planJourney({id:'bad-decimals',originId:'x',destinationId:'well',
    coinGold:.0001}),false);
  assert.equal(h.c.planJourney({id:'only-gold',originId:'x',destinationId:'well',
    coinGold:120}),true);
  assert.deepEqual(asObject(h.c.state().journeys['only-gold'].cargo),[]);
  assert.deepEqual(asObject(h.c.state().journeys['only-gold'].purse),
    {gold:120,reservedGold:0});
  assert.equal(h.c.state().journeys['only-gold'].transport.wagons,1,
    'a buying trip brings an empty cart');
  assert.equal(h.c.state().journeys['only-gold'].transport.loadPoints,0);
  assert.equal(h.e.state().wallet.L4,wallet);
  assert.equal(h.e.snapshot().castleGold,before.castleGold);
  assert.deepEqual(asObject(h.e.snapshot().market),asObject(before.market));
});
test('capacity is based on single cargo type, not on coin amount',()=>{
  const h=harness();
  assert.equal(h.c.WAGON_CAPACITY,100);
  assert.equal(h.c.caravanQuote([{good:'stone',qty:10}],0).wagons,1);
  assert.equal(h.c.caravanQuote([{good:'stone',qty:11}],0).wagons,2);
  const clothAnalog=h.c.caravanQuote([{good:'luxury',qty:100}],900);
  assert.equal(clothAnalog.wagons,1);
  assert.equal(clothAnalog.loadPoints,100);
  assert.equal(clothAnalog.freePoints,0);
  assert.equal(clothAnalog.goldPerDay,.2);
  assert.equal(h.c.caravanQuote([{good:'stone',qty:5}],500).freePoints,50);
  assert.equal(h.c.caravanQuote([{good:'stone',qty:5}],0).freePoints,50,
    'even 500 gold cannot fill empty stone capacity');
  assert.equal(h.c.caravanQuote([],0).wagons,0);
  assert.equal(h.c.caravanQuote([],500).wagons,1);
  assert.equal(h.c.caravanQuote([{good:'stone',qty:2},{good:'food',qty:2}],1),null);
});
test('resident L4 purse is escrowed from existing wallet, and cancelling refunds once',()=>{
  const h=harness(),before=h.e.state().wallet.L4,stock=asObject(h.e.snapshot().market);
  const trip={id:'merchant',source:'resident',houseId:'home4',originId:'well',
    destinationId:'foreign',cargo:[{good:'metal',qty:2}],coinGold:120};
  assert.equal(h.c.planJourney(trip),true);
  assert.equal(h.e.state().wallet.L4,before,'planning alone cannot duplicate spendable gold');
  assert.equal(h.c.reserveJourneyCoins('merchant'),true);
  assert.equal(h.e.state().wallet.L4,before-120);
  assert.equal(h.c.state().journeys.merchant.purse.reservedGold,120);
  assert.equal(h.c.snapshot().l4PlusHeldGold,120);
  assert.equal(h.c.reserveJourneyCoins('merchant'),false,'no second wallet debit');
  assert.equal(h.c.cancelPlannedJourney('merchant'),true);
  assert.equal(h.e.state().wallet.L4,before,'cancellation returns exact reserved gold');
  assert.equal(h.c.cancelPlannedJourney('merchant'),false,'no second refund');
  assert.deepEqual(asObject(h.e.snapshot().market),stock,
    'the coin purse must not modify goods stock');
});
test('no phantom purse: budget check, external funds and save/reload',()=>{
  const h=harness(),wallet=h.e.state().wallet.L4;
  assert.equal(h.c.planJourney({id:'unfunded',source:'resident',houseId:'home4',
    originId:'well',destinationId:'city',coinGold:wallet+1}),true);
  assert.equal(h.c.reserveJourneyCoins('unfunded'),false);
  assert.equal(h.e.state().wallet.L4,wallet);
  assert.equal(h.c.planJourney({id:'external',originId:'elsewhere',
    destinationId:'well',coinGold:9000}),true);
  assert.equal(h.c.reserveJourneyCoins('external'),false);
  assert.equal(h.e.state().wallet.L4,wallet,'foreign purse never debits or credits local cash');
  assert.equal(h.c.cancelPlannedJourney('unfunded'),true);
  const saved=asObject(h.State.economy),resumed=harness(saved);
  assert.equal(resumed.c.snapshot().l4PlusDeclaredGold,9000);
  assert.equal(resumed.e.state().wallet.L4,wallet);
  assert.equal(resumed.c.state().journeys.external.purse.reservedGold,0);
});
test('escrow survives save/reload without duplicate transfer or loss',()=>{
  const h=harness(),wallet=h.e.state().wallet.L4;
  h.c.planJourney({id:'funded',source:'resident',houseId:'home4',
    originId:'well',destinationId:'x',coinGold:50});
  h.c.reserveJourneyCoins('funded');
  const resumed=harness(asObject(h.State.economy));
  assert.equal(resumed.e.state().wallet.L4,wallet-50);
  assert.equal(resumed.c.snapshot().l4PlusHeldGold,50);
  assert.equal(resumed.c.reserveJourneyCoins('funded'),false);
  assert.equal(resumed.c.cancelPlannedJourney('funded'),true);
  assert.equal(resumed.e.state().wallet.L4,wallet);
});
test('legacy V1 cargo with multiple goods remains stored but new trips are monotype',()=>{
  const h=harness();
  h.c.planJourney({id:'historic',originId:'other',destinationId:'well',
    cargo:[{good:'wood',qty:1}]});
  const saved=asObject(h.State.economy);
  saved.commerce.version=1;
  saved.commerce.journeys.historic.cargo.push({good:'food',qty:1});
  delete saved.commerce.journeys.historic.purse;
  delete saved.commerce.journeys.historic.transport;
  const resumed=harness(saved);
  assert.equal(resumed.c.state().version,2);
  assert.deepEqual(asObject(resumed.c.state().journeys.historic.purse),
    {gold:0,reservedGold:0});
  assert.equal(resumed.c.state().journeys.historic.cargo.length,2,
    'migration does not erase preexisting multis');
  assert.equal(resumed.c.state().journeys.historic.transport.wagons,1);
  assert.equal(resumed.c.planJourney({id:'new',originId:'other',destinationId:'well',
    cargo:[{good:'wood',qty:1},{good:'food',qty:1}]}),false);
});
test('invalid manifests reject same-city, illegal class, unknown cargo and duplicate IDs',()=>{
  const h=harness();
  const trip={id:'x',source:'external',originId:'elsewhere',destinationId:'well',cargo:[]};
  assert.equal(h.c.planJourney({...trip,originId:'well'}),false);
  assert.equal(h.c.planJourney({...trip,source:'resident',houseId:'home3'}),false);
  assert.equal(h.c.planJourney({...trip,cargo:[{good:'wine',qty:2}]}),false);
  assert.equal(h.c.planJourney({...trip,cargo:[{good:'wood',qty:-1}]}),false);
  assert.equal(h.c.planJourney(trip),true);
  assert.equal(h.c.planJourney(trip),false);
  assert.equal(h.c.confirmArrival('x'),true);
  assert.equal(h.c.confirmArrival('x'),false);
});
test('inn lodging is capacity limited and depends on an explicitly confirmed arrival',()=>{
  const h=harness();
  const trip=i=>({id:'v'+i,source:'external',originId:'city',destinationId:'well'});
  for(let i=1;i<=3;i++)assert.equal(h.c.planJourney(trip(i)),true);
  assert.equal(h.c.checkIn('v1','inn'),false,'no bed and no physical arrival');
  assert.equal(h.c.configureInnCapacity('inn',2),true);
  assert.equal(h.c.checkIn('v1','inn'),false,'plan alone never counts as arrival');
  assert.equal(h.c.confirmArrival('v1'),true);
  assert.equal(h.c.confirmArrival('v2'),true);
  assert.equal(h.c.confirmArrival('v3'),true);
  assert.equal(h.c.checkIn('v1','inn'),true);
  assert.equal(h.c.checkIn('v2','inn'),true);
  assert.equal(h.c.checkIn('v3','inn'),false,'two beds cannot host three');
  assert.equal(h.c.configureInnCapacity('inn',1),false,'occupied beds cannot disappear');
  assert.deepEqual(asObject(h.c.occupancy('inn')),{beds:2,occupied:2,available:0});
  assert.equal(h.c.depart('v1'),true);
  assert.equal(h.c.checkIn('v3','inn'),true);
  assert.deepEqual(asObject(h.c.occupancy('inn')),{beds:2,occupied:2,available:0});
  assert.equal(h.e.snapshot().castleGold,300,'no invented lodging payment');
  assert.equal(h.e.state().wallet.L3,60,'no invented service income');
});
test('journey out of local settlement cannot fake arrival at home inn',()=>{
  const h=harness();
  assert.equal(h.c.planJourney({id:'out',source:'resident',houseId:'home4',
    originId:'well',destinationId:'city'}),true);
  assert.equal(h.c.confirmArrival('out'),false);
  assert.equal(h.c.configureInnCapacity('inn',1),true);
  assert.equal(h.c.checkIn('out','inn'),false);
});
test('sync prunes removed services and resets stranded lodging safely',()=>{
  const h=harness();
  h.c.configureInnCapacity('inn',1);
  h.c.planJourney({id:'v',originId:'city',destinationId:'well'});
  h.c.confirmArrival('v');h.c.checkIn('v','inn');
  h.State.structures=h.State.structures.filter(s=>s.id!=='inn');
  h.c.sync();
  assert.equal(h.c.state().services.inn,undefined);
  assert.equal(h.c.state().journeys.v.status,'arrived');
  assert.equal(h.c.state().journeys.v.lodgingId,null);
});
test('old saves gain commerce state without resetting existing balances',()=>{
  const h=harness();
  h.c.registerShop('home3','weaver');
  h.c.assignService('church','home3b');
  h.c.configureInnCapacity('inn',4);
  h.c.planJourney({id:'v',originId:'city',destinationId:'well'});
  const saved=asObject(h.State.economy);
  const resumed=harness(saved);
  assert.equal(resumed.c.snapshot().l3Shops,1);
  assert.equal(resumed.c.state().services.church.operatorHouseId,'home3b');
  assert.equal(resumed.c.occupancy('inn').beds,4);
  assert.equal(resumed.c.snapshot().l4PlusPlanned,1);
  resumed.e.reset();
  assert.equal(resumed.c.snapshot().l3Shops,0,'new game clears commerce');
  assert.equal(resumed.c.snapshot().l4PlusPlanned,0,'new game clears manifests');
});
test('script order, persistence and L3 art direction stay compatible',()=>{
  assert.ok(html.indexOf('settlement-economy.js')<html.indexOf('settlement-commerce.js'));
  assert.ok(html.indexOf('settlement-commerce.js')<html.indexOf('settlement-app.js'));
  assert.ok(local.includes('economy:State.economy||null'),'local saves carry nested commerce');
  assert.ok(local.includes('economy:State.economy||null'),'cloud saves carry nested commerce');
  assert.ok(core.includes("const CIVIC_TYPES=Object.freeze(['market','tavern','church','training'])"));
  assert.ok(residentsCode.includes("if(level===3)return artisanPosition(house,shiftedDay)"));
  assert.ok(residentsCode.includes("if(level===3)return'artisan'"));
  const routines=fs.readFileSync(path.join(ROOT,'src/settlement-population-routines.js'),'utf8');
  assert.ok(routines.includes("window.ConquerCommerce?.worksiteForHouse?.(house.id)"));
});
console.log('Commerce L3/L4/L4+ skeleton regression: all checks passed.');
