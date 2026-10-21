'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=name=>fs.readFileSync(path.join(root,name),'utf8');
const scripts=['src/settlement-economy.js','src/settlement-commerce.js',
  'src/settlement-convoys.js','src/assets/road-sign-model.js',
  'src/settlement-wagons.js','src/settlement-vehicles.js','src/settlement-road-sign-tests.js'];
function harness(saved=null){
  const center={x:100,y:100},edges=[
    ['north',{x:100,y:50}],['east',{x:150,y:100}],
    ['south',{x:100,y:150}],['west',{x:50,y:100}]
  ];
  const rs=edges.map(([edge,d],i)=>({id:'route-'+edge,edge,target:d,connected:true}));
  const structures=[{id:'well',type:'well',...center},
    {id:'keep',type:'tower',isMastio:true,functions:['commonHall'],x:99,y:98},
    {id:'house4',type:'house',houseLevel:4,x:102,y:102},
    ...rs.map((r,i)=>({id:'segment-'+r.edge,type:'road',routeId:r.id,
      routeSeq:0,width:.62,a:{...center},b:{...r.target}}))];
  const State={clock:{day:12,speed:0},village:{founded:true,wellId:'well',
    roadPlan:rs,borderEntries:rs.map(r=>({id:r.id,edge:r.edge,...r.target}))},
    economy:saved,structures,policies:{tax:0},resources:{},dirty:false,
    tool:{kind:'select'},view:{scale:1}};
  const window={ConquerSiege:{
    mastio:()=>State.structures.find(s=>s.id==='keep'&&s.isMastio),
    capacity:()=>({soldiers:3})},
    __drawConquerScene:()=>{window.calls=(window.calls||0)+1}};
  const ctx=vm.createContext({window,State,Math,Number,Array,Object,console,
    performance:{now:()=>100},w2s:(p,z=0)=>({x:p.x*5,y:p.y*5-z*5}),
    w2sRaw:(p,z=0)=>({x:p.x*5,y:p.y*5-z*5}),
    underConstruction:()=>false,pointBlockedForPeasant:()=>false,
    terrainElevation:()=>0,houseLevel:s=>s.houseLevel,
    calendarDateFromDay:d=>({month:0,year:1,day:d+1}),
    clamp:(x,a,b)=>Math.min(b,Math.max(a,x)),
    status:msg=>{window.status=msg},
    scheduleLocalSave:()=>{},
    ctx:{save(){},restore(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},
      fill(){},stroke(){},ellipse(){},fillText(){},strokeText(){}},
    U:12});
  for(const s of scripts)vm.runInContext(read(s),ctx,{filename:s});
  return{State,window,eco:window.ConquerEconomy,commercial:window.ConquerCommerce,
    cv:window.ConquerConvoys,road:window.ConquerRoadSignTests,save:()=>JSON.parse(JSON.stringify(State.economy))};
}
const plain=x=>JSON.parse(JSON.stringify(x));
const test=(name,fn)=>{fn();console.log('✓ '+name)};
test('four signs use the four persisted arterial branches near the well',()=>{
  const h=harness(),signs=h.road.signs();
  assert.deepEqual(plain(signs.map(s=>s.edge)),['north','east','south','west']);
  assert.ok(signs.every(s=>s.connected),'all roads are continuous');
  assert.ok(signs.every(s=>Math.hypot(s.point.x-100,s.point.y-100)<7),'signs are near the well');
  for(const s of signs)assert.equal(h.road.hit({x:s.point.x*5,y:s.point.y*5-3.5}),s.edge);
  h.State.tool.kind='tower';assert.equal(h.road.hit({x:500,y:475}),null);
});
test('signposts reuse real existing scatter asset data and modular wagons',()=>{
  const h=harness();
  assert.equal(h.window.ConquerRoadSignModel.v.length,216);
  assert.equal(h.window.ConquerRoadSignModel.i.length,324);
  assert.equal(h.window.ConquerWagons.CHASSIS.cart.wheels.length,1);
  assert.equal(h.window.ConquerWagons.CHASSIS.wagon.wheels.length,2);
  const html=read('index.html');
  for(const name of ['assets/road-sign-model.js','settlement-wagons.js','settlement-road-sign-tests.js'])
    assert.ok(html.includes(name));
  assert.ok(read('src/settlement-app-input.js').includes('window.ConquerRoadSignTests?.hit?.(sp)'));
  assert.ok(read('src/settlement-render.js').includes('window.ConquerRoadSignTests?.draw?.()'));
  assert.ok(read('src/settlement-app-simulation.js').includes('window.ConquerRoadSignTests?.tick?.(dt)'));
});
test('blocked, broken or unfinished arterial road cannot launch or subtract resources',()=>{
  const h=harness(),e=h.eco.state();e.castleGold=500;e.castle.stone=30;
  h.State.village.roadPlan[0].connected=false;
  const result=h.road.launch({edge:'north',good:'stone',qty:3,coinGold:5});
  assert.equal(result.ok,false);
  assert.equal(e.castleGold,500);assert.equal(e.castle.stone,30);
  h.State.village.roadPlan[0].connected=true;
  h.State.structures[3].b={x:100,y:70};
  assert.equal(h.road.launch({edge:'north',good:'stone',qty:3,coinGold:5}).ok,false,
    'segment must actually reach mapped exit point');
});
test('a road deliberately deleted by the player stays unusable even if its old segment remains',()=>{
  const h=harness(),e=h.eco.state();
  e.castleGold=40;e.castle.wood=10;
  h.State.village.deletedMainRoutes=['route-east'];
  assert.equal(h.road.routeFor('east'),null);
  assert.equal(h.road.launch({edge:'east',good:'wood',qty:1}).ok,false);
  assert.equal(e.castle.wood,10);
  h.State.village.deletedMainRoutes=[];
  assert.ok(h.road.routeFor('east'));
});
test('lord test transports real castle resources and reclaims every unit once',()=>{
  const h=harness(),e=h.eco.state();e.castleGold=70;e.castle.stone=20;
  const beforeMarket=plain(h.eco.snapshot().market);
  const launched=h.road.launch({edge:'east',kind:'tribute',good:'stone',qty:10,coinGold:17,
    guards:2,vehicle:'wagon'});
  assert.equal(launched.ok,true);
  assert.equal(e.castleGold,53);assert.equal(e.castle.stone,10);
  assert.equal(h.cv.state().roadSignTest.vehicles,1);
  assert.equal(h.cv.state().roadSignTest.guards,2);
  assert.equal(h.cv.state().roadSignTest.status,'moving');
  assert.equal(h.cv.state().lordConvoys[launched.id].status,'test-moving');
  assert.deepEqual(plain(h.eco.snapshot().market),beforeMarket);
  assert.equal(h.cv.availableGuardSlots(),1,'two slots stay reserved');
  for(let i=0;i<50;i++)h.road.tick(.25);
  assert.equal(h.road.active().status,'exited');
  assert.equal(h.cv.state().lordConvoys[launched.id].status,'test-exited');
  assert.equal(e.castleGold,53,'no repeat deduction upon reaching exit');
  assert.equal(h.road.restore(),true);
  assert.equal(e.castleGold,70);assert.equal(e.castle.stone,20);
  assert.equal(h.cv.availableGuardSlots(),3);
  assert.equal(h.road.restore(),false,'cannot refund twice');
});
test('full accounting and rollback survives a persisted in-flight save',()=>{
  const h=harness(),e=h.eco.state();e.castleGold=30;e.castle.wood=12;
  assert.equal(h.road.launch({edge:'west',kind:'gift',good:'wood',qty:7,coinGold:3,
    guards:1,vehicle:'cart'}).ok,true);
  const snapshot=h.save(),restored=harness(snapshot);
  assert.equal(restored.eco.state().castleGold,27);
  assert.equal(restored.eco.state().castle.wood,5);
  assert.equal(restored.road.active().status,'moving');
  assert.equal(restored.road.restore(),true);
  assert.equal(restored.eco.state().castleGold,30);
  assert.equal(restored.eco.state().castle.wood,12);
  assert.equal(restored.road.active(),null);
});
test('merchant test uses only funded L4 coins, mercenary visuals are previews',()=>{
  const h=harness(),e=h.eco.state(),before=e.wallet.L4;
  assert.equal(h.road.launch({edge:'south',kind:'merchant',good:'stone',
    qty:1,coinGold:5,guards:1}).ok,false,'market cargo not duplicated by a mock sale');
  const x=h.road.launch({edge:'south',kind:'merchant',coinGold:15,guards:2,vehicle:'cart'});
  assert.equal(x.ok,true);
  assert.equal(e.wallet.L4,before-15);
  assert.equal(h.road.active().escortDailyGold,.4);
  assert.equal(h.cv.state().journeys[x.id].escort.heraldry,'neutral-brown');
  assert.equal(h.road.restore(),true);
  assert.equal(e.wallet.L4,before);
});
test('scatter model draws four signs and wagon renderer animates the convoy',()=>{
  const h=harness(),e=h.eco.state();e.castleGold=40;e.castle.wood=15;
  let drawn=0;h.window.ConquerWagons.drawWagon=()=>drawn++;
  assert.equal(h.road.launch({edge:'east',kind:'gift',good:'wood',qty:9}).ok,true);
  assert.doesNotThrow(()=>h.road.draw(),'actual signpost geometry must render without exceptions');
  assert.ok(drawn>=1,'an animated wagon uses the imported wagon renderer');
  assert.equal(h.road.restore(),true);
});
console.log('Road sign convoys regression: all checks passed.');
