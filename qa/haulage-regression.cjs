'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
function world(){
  const yard={id:'yard',type:'storageYard',x:110,y:100,w:2,h:2,yardSize:2};
  const camp={id:'camp',type:'loggingCamp',x:100,y:100,economicOwner:'lord'};
  const first={id:'road-a',type:'road',a:{x:99,y:100},b:{x:105,y:100}};
  const second={id:'road-b',type:'road',a:{x:105,y:100},b:{x:115,y:100}};
  const State={clock:{day:0,speed:1},structures:[{id:'well',type:'well',x:100,y:100},yard,camp,first,second],
    village:{founded:true,wellId:'well',foundingWorkers:4},policies:{rations:'market'}};
  const artwork=[],window={ConquerWagons:{drawWagon:(ctx,x,y,scale,opts)=>artwork.push({...opts})}};
  const ctx=vm.createContext({State,window,console,Math,Number,Object,Array,Map,Set,String,Date,
    terrainElevation:()=>0,
    underConstruction:s=>!!s.construction&&s.construction.workDone<s.construction.workRequired,
    calendarDateFromDay:day=>({month:0,year:1,day:day+1}),
    document:{getElementById:()=>null},
    ctx:{},w2s:p=>p,w2sRaw:p=>p,worldPointVisible:()=>true,
    rectWorldPoints:(x,y,w,h)=>[{x:x-w/2,y:y-h/2},{x:x+w/2,y:y-h/2},{x:x+w/2,y:y+h/2},{x:x-w/2,y:y+h/2}],
    syncPrimaryRoadBridges:()=>{},invalidateSceneCache:()=>{}
  });
  vm.runInContext(read('src/settlement-economy.js'),ctx);
  vm.runInContext(read('src/settlement-storage-yard.js'),ctx);
  vm.runInContext(read('src/settlement-vehicles.js'),ctx);
  vm.runInContext(read('src/settlement-haulage.js'),ctx);
  return{State,window,ctx,artwork,yard,camp,first,second,
    E:window.ConquerEconomy,Y:window.ConquerStorageYard,V:window.ConquerVehicles,H:window.ConquerHaulage};
}
let passed=0;
const test=(label,body)=>{body();passed++;console.log('PASS '+label)};
test('runtime ordering, accounting events, simulation, renderer, and workshop UI are integrated',()=>{
  const index=read('index.html');
  assert.ok(index.indexOf('settlement-haulage.js')>index.indexOf('settlement-vehicles.js'));
  assert.ok(index.indexOf('settlement-haulage.js')<index.indexOf('settlement-app-simulation.js'));
  const economy=read('src/settlement-economy.js'),frame=read('src/settlement-app-simulation.js'),render=read('src/settlement-render.js');
  assert.match(economy,/if\(received>0\)window\.ConquerHaulage\?\.record/);
  assert.match(economy,/if\(origin\)window\.ConquerHaulage\?\.record/);
  assert.match(frame,/ConquerHaulage\?\.tick/);
  assert.match(render,/ConquerHaulage\?\.draw/);
  assert.match(read('src/settlement-app-rooms.js'),/Carretti locali/);
  assert.match(read('src/settlement-app-persistence.js'),/ConquerHaulage\?\.reset/);
  assert.match(read('src/settlement-vehicles.js'),/c\.emptyReturn\|\|c\.vehicle/);
});
test('a real logging production receipt queues one cart but does not duplicate the ledger',()=>{
  const h=world();
  assert.equal(h.E.foundingCharter('well'),true);
  const prev=h.E.state().castle.wood;
  h.E.tick(-1,0);
  assert.equal(h.E.state().castle.wood,prev+1,'retained production increases by ONE wood unit');
  assert.equal(h.H.snapshot().pending,1,'actual retained production queues a physical haul');
  const frozen=JSON.stringify(h.E.state().castle);
  for(let i=0;i<12;i++)h.H.tick(.25);
  assert.equal(h.H.snapshot().active,1,'cart drives a route');
  assert.equal(JSON.stringify(h.E.state().castle),frozen,'travel never books extra stock');
  assert.equal(h.H.snapshot().trips[0].yardId,'yard');
  assert.equal(h.H.snapshot().trips[0].good,'wood');
});
test('cart carries logs out, unloads, and returns visibly empty without changing resources',()=>{
  const h=world();h.E.foundingCharter('well');h.E.tick(-1,0);
  const book=JSON.stringify(h.E.state().castle);
  let outbound=false,returning=false,emptyCargo=false;
  for(let i=0;i<130;i++){
    h.H.tick(.25);
    const trip=h.H.snapshot().trips[0];
    if(trip?.phase==='outbound'){
      outbound=true;h.H.draw();assert.ok(h.artwork.some(v=>v.cargo.includes('logs')),'outgoing wagon has timber');
    }
    if(trip?.phase==='returning'){
      returning=true;h.H.draw();if(h.artwork.some(v=>v.cargo.length===0))emptyCargo=true;
    }
  }
  assert.equal(outbound,true);assert.equal(returning,true);assert.equal(emptyCargo,true);
  assert.equal(h.H.snapshot().active,0);assert.equal(h.H.snapshot().completed,1);
  assert.equal(JSON.stringify(h.E.state().castle),book);
});
test('no road link means no teleporting; pending job starts when a real road appears',()=>{
  const h=world();h.State.structures=h.State.structures.filter(s=>s.type!=='road');
  assert.equal(h.H.record({siteId:'camp',good:'wood',qty:2,day:0}),true);
  for(let i=0;i<8;i++)h.H.tick(.25);
  assert.equal(h.H.snapshot().active,0);
  assert.equal(h.H.snapshot().pending,1);
  h.State.structures.push(h.first,h.second);
  for(let i=0;i<6;i++)h.H.tick(.25);
  assert.equal(h.H.snapshot().active,1);
  assert.equal(h.H.snapshot().pending,0);
});
test('an incomplete road does not create a reachable hauling route',()=>{
  const h=world();
  h.second.construction={workRequired:10,workDone:0};
  assert.equal(h.H.record({siteId:'camp',good:'wood',qty:2,day:0}),true);
  for(let i=0;i<6;i++)h.H.tick(.25);
  assert.equal(h.H.snapshot().active,0,'unbuilt road must not count');
  h.second.construction.workDone=10;
  for(let i=0;i<6;i++)h.H.tick(.25);
  assert.equal(h.H.snapshot().active,1);
});
test('with several yards the truck chooses the nearest road-connected stockyard',()=>{
  const h=world();
  const farther={id:'yard2',type:'storageYard',x:114,y:100,yardSize:2};
  h.State.structures.push(farther);
  h.H.record({siteId:'camp',good:'wood',qty:1});
  h.H.tick(.6);
  assert.equal(h.H.snapshot().trips[0].yardId,'yard');
});
test('paused time does not move a trip and road signs keep their own vehicles',()=>{
  const h=world();h.H.record({siteId:'camp',good:'wood',qty:1});
  h.H.tick(.8);const t=h.H.snapshot().trips[0];assert.ok(t);
  const before=JSON.stringify(t);
  h.State.clock.speed=0;for(let i=0;i<12;i++)h.H.tick(.25);
  assert.equal(JSON.stringify(h.H.snapshot().trips[0]),before);
  assert.equal(h.V.trips().length,0,'local cart does not share the transient road-sign queue');
});
test('expired unconnected loads and deleted producers do not create phantom traffic',()=>{
  const h=world();
  h.State.structures=h.State.structures.filter(s=>s.type!=='road');
  h.H.record({siteId:'camp',good:'wood',qty:4,day:0});
  h.State.clock.day=12;h.H.tick(.7);
  assert.equal(h.H.snapshot().pending,0);
  h.H.record({siteId:'camp',good:'wood',qty:2,day:12});
  h.State.structures=h.State.structures.filter(s=>s.id!=='camp');
  h.H.tick(.7);
  assert.equal(h.H.snapshot().pending,0);
});
test('forest-clearance output can be animated from a job centre after its one-time credit',()=>{
  const h=world();
  assert.equal(h.H.record({siteId:'forest-clear-1',origin:{x:101,y:100},good:'wood',qty:100}),true);
  h.H.tick(.8);
  assert.equal(h.H.snapshot().active,1);
  for(let i=0;i<10;i++)h.H.tick(.25);
  assert.equal(h.H.snapshot().active,1,'area-based haul is not cancelled for lacking a structure id');
});
test('jobs aggregate per site, with strict active/pending bounds; reset is idempotent',()=>{
  const h=world();
  h.H.record({siteId:'camp',good:'wood',qty:2});
  h.H.record({siteId:'camp',good:'wood',qty:3});
  assert.equal(h.H.snapshot().pending,1);
  h.H.tick(.75);
  assert.equal(h.H.snapshot().trips[0].qty,5);
  h.H.reset();h.H.reset();
  assert.equal(h.H.snapshot().active,0);assert.equal(h.H.snapshot().pending,0);
});
console.log(passed+' local haulage regression checks passed.');
