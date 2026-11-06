'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const withYard=(x=110,y=100,id='yard')=>({id,type:'storageYard',x,y,w:2,h:2,yardSize:2});
const withRoad=(x=95,y=100,to=120,id='street')=>({id,type:'road',a:{x,y},b:{x:to,y}});
function world({market=false,logging=false,quarry=false,workers=4}={}){
  const yard=withYard(),road=withRoad(),well={id:'well',type:'well',x:100,y:100};
  const producer={id:'camp',type:'loggingCamp',x:101,y:100,economicOwner:'lord'};
  const marketPlace={id:'market-1',type:'market',x:112,y:100};
  const q={id:'quarry',type:'quarry',x:103,y:100,economicOwner:'private'};
  const h={id:'house-L2',type:'house',houseLevel:2,x:105,y:101};
  const structures=[well,yard,road,...(logging?[producer]:[]),
    ...(quarry?[q,h]:[]),...(market?[marketPlace]:[])];
  const State={clock:{day:.25,speed:1},view:{scale:1},structures,
    village:{founded:true,wellId:'well',foundingWorkers:workers},
    policies:{rations:'market'}};
  const drawn=[],drivers=[];
  const window={
    ConquerMarketEconomy:{COMMODITIES:{tools:{},jewelry:{}}},
    ConquerWagons:{drawWagon:(_ctx,_x,_y,_size,props)=>drawn.push(props)}
  };
  const env=vm.createContext({State,window,console,Math,Number,Object,Array,Map,Set,String,Date,
    ctx:{},underConstruction:s=>!!s.construction&&s.construction.workDone<s.construction.workRequired,
    terrainElevation:()=>0,w2s:p=>p,w2sRaw:p=>p,
    rotateViewPoint:p=>p,worldPointVisible:()=>true,
    drawVillagerFigureUnmasked:dot=>drivers.push(dot.id),
    calendarDateFromDay:d=>({month:0,year:1,day:d+1}),
    document:{getElementById:()=>null},rectWorldPoints:()=>[]
  });
  for(const file of ['src/settlement-economy.js','src/settlement-storage-yard.js',
    'src/settlement-vehicles.js','src/settlement-haulage.js'])
    vm.runInContext(read(file),env,{filename:file});
  return{State,window,drawn,drivers,road,yard,producer,marketPlace,q,
    E:window.ConquerEconomy,H:window.ConquerHaulage,V:window.ConquerVehicles};
}
function cycle(w,seconds=25){
  for(let i=0;i<seconds*4;i++)w.H.tick(.25);
}
let checks=0;
function check(label,fn){fn();checks++;console.log('PASS '+label)}
check('economy allocates a distinct, named L1 carter after essential productive jobs',()=>{
  const w=world({logging:true});w.E.foundingCharter('well');
  w.E.tick(-1,0);
  const a=w.E.laborAllocation(.25);
  assert.equal(a.assignedL1.camp.length,1,'logger is the essential L1 job');
  assert.equal(a.carters.length,1,'actual yard is a single logistics workplace');
  assert.equal(a.carters[0].id,'founder:well:1','driver comes from real founder labor');
  assert.equal(a.idle.some(x=>x.id===a.carters[0].id),false);
  assert.equal(a.spareL1.some(x=>x.id===a.carters[0].id),false);
  assert.equal(w.E.availableBuilderIds(.25).some(x=>x.id===a.carters[0].id),false);
  assert.equal(w.E.jobSummary(.25).carter,1);
  assert.equal(w.H.snapshot().workers[0],a.carters[0].id);
  assert.equal(w.H.snapshot().pending,1);
});
check('no cargo means no L1 carter job even with a built yard and employees',()=>{
  const w=world({logging:true});w.E.foundingCharter('well');
  assert.equal(w.E.laborAllocation(.25).carters.length,0);
  assert.equal(w.E.jobSummary(.25).carter,0);
});
check('a logger is never sacrificed for a decorative cart when only one L1 exists',()=>{
  const w=world({logging:true,workers:1});w.E.foundingCharter('well');w.E.tick(-1,0);
  const a=w.E.laborAllocation(.25);
  assert.equal(a.allocated.camp,1);
  assert.equal(a.carters.length,0);
  cycle(w,4);
  assert.equal(w.H.snapshot().active,0);
  assert.equal(w.H.snapshot().pending,1);
});
check('with zero available L1 workers no visual transport starts and goods remain booked',()=>{
  const w=world({workers:0});w.E.foundingCharter('well');
  assert.ok(w.H.record({siteId:'market-1',origin:{x:101,y:100},good:'wood',qty:10}));
  assert.equal(w.E.laborAllocation(.25).carters.length,0);
  cycle(w,3);
  assert.equal(w.H.snapshot().active,0);
  assert.equal(w.H.snapshot().pending,1);
});
check('real private quarry production sends only its actually booked market output to market',()=>{
  const w=world({market:true,quarry:true});w.E.foundingCharter('well');
  const before=w.E.state().lots.stone.reduce((n,x)=>n+x.qty,0);
  w.E.tick(-1,0);
  const after=w.E.state().lots.stone.reduce((n,x)=>n+x.qty,0);
  assert.ok(after>before);
  assert.equal(w.H.snapshot().pending,1,'private output is queued once, not for the castle');
  assert.equal(w.E.laborAllocation(.25).carters.length,1);
  cycle(w,2);
  const t=w.H.snapshot().trips[0];
  assert.equal(t.destination,'market');
  assert.equal(t.destinationId,'market-1');
  assert.equal(t.baseId,'yard');
  assert.equal(t.workerId,'founder:well:0');
  assert.equal(w.E.state().lots.stone.reduce((n,x)=>n+x.qty,0),after,'route never changes market stocks');
  w.H.draw();
  assert.ok(w.drivers.includes(t.workerId),'wagon driver has the real L1 worker identity');
});
check('stockyard runs a four-stage round trip: empty out, load, market, unload, home',()=>{
  const w=world({market:true});
  w.H.record({siteId:'market-1',origin:{x:101,y:100},good:'wood',qty:6,destination:'market'});
  const before=JSON.stringify(w.E.state().castle);
  const phases=new Set(),states=[];
  for(let i=0;i<160;i++){
    w.H.tick(.25);
    const trip=w.H.snapshot().trips[0];
    if(trip){
      phases.add(trip.phase);
      if(!states.some(s=>s.phase===trip.phase)){
        w.H.draw();
        states.push({phase:trip.phase,empty:trip.emptyReturn,
          cargo:w.drawn.at(-1)?.cargo||[]});
      }
    }
  }
  for(const phase of ['departing','loading','outbound','unloading','returning'])
    assert.ok(phases.has(phase),'missing phase '+phase);
  for(const phase of ['departing','returning'])
    assert.equal(states.find(s=>s.phase===phase)?.empty,true);
  assert.equal(states.find(s=>s.phase==='outbound')?.empty,false);
  assert.equal(w.H.snapshot().completed,1);
  assert.equal(w.H.snapshot().active,0);
  assert.equal(JSON.stringify(w.E.state().castle),before);
});
check('market shipments never use the stockyard as the final goods destination',()=>{
  const w=world({market:true,quarry:true});w.H.record({siteId:'quarry',good:'stone',qty:3,destination:'market'});
  const p=w.H.plan({siteId:'quarry',good:'stone',destination:'market'});
  assert.equal(p.destinationId,'market-1');
  assert.equal(p.baseId,'yard');
  assert.equal(p.legs.length,3);
});
check('market goods require a real completed market and cannot spawn a fake sale',()=>{
  const w=world({quarry:true});
  w.H.record({siteId:'quarry',good:'stone',qty:1,destination:'market'});
  assert.equal(w.H.workerDemand(.25),0);
  cycle(w,2);assert.equal(w.H.snapshot().active,0);
  w.State.structures.push(w.marketPlace);
  assert.equal(w.H.workerDemand(.25),1);
  cycle(w,2);assert.equal(w.H.snapshot().active,1);
});
check('market and yard share one available L1 carter per yard, not one per product',()=>{
  const w=world({market:true,logging:true,quarry:true});
  w.H.record({siteId:'camp',good:'wood',qty:2,destination:'yard'});
  w.H.record({siteId:'quarry',good:'stone',qty:2,destination:'market'});
  w.H.record({siteId:'house-L2',good:'tools',qty:1,destination:'market'});
  assert.equal(w.H.workerDemand(.25),1);
  assert.equal(w.E.laborAllocation(.25).carters.length,1);
  cycle(w,2);
  assert.equal(w.H.snapshot().active,1);
  assert.equal(w.H.snapshot().pending,2);
});
check('a second connected stockyard can employ a second distinct L1 worker',()=>{
  const w=world({market:true});
  const yard2=withYard(116,100,'yard-2');
  const producer2={id:'camp2',type:'loggingCamp',x:119,y:100,economicOwner:'lord'};
  w.State.structures.push(yard2,producer2);
  w.H.record({siteId:'camp2',good:'wood',qty:1,destination:'yard'});
  w.H.record({siteId:'market-1',origin:{x:99,y:100},good:'wood',qty:1,destination:'market'});
  assert.equal(w.H.workerDemand(.25),2);
  const ids=w.E.laborAllocation(.25).carters.map(x=>x.id);
  assert.equal(new Set(ids).size,2);
  cycle(w,2);
  assert.equal(w.H.snapshot().active,2);
  assert.equal(new Set(w.H.snapshot().trips.map(x=>x.workerId)).size,2);
});
check('day/night, Saturday, Sunday and alarm gate new L1 cart departures',()=>{
  const w=world({logging:true});w.H.record({siteId:'camp',good:'wood',qty:1});
  for(const day of [.05,.8,5.25,6.25]){
    w.State.clock.day=day;
    assert.equal(w.H.onShift(day),false);
    assert.equal(w.E.laborAllocation(day).carters.length,0);
    w.H.tick(.7);assert.equal(w.H.snapshot().active,0);
  }
  w.State.clock.day=7.25;
  assert.equal(w.H.onShift(7.25),true);
  assert.equal(w.E.laborAllocation(7.25).carters.length,1);
  w.H.tick(.7);assert.equal(w.H.snapshot().active,1);
});
check('roads under construction or removed prevent carts from departing; reconnect restores them',()=>{
  const w=world({market:true,logging:true});w.road.construction={workRequired:5,workDone:0};
  w.H.record({siteId:'camp',good:'wood',qty:3,destination:'market'});
  assert.equal(w.H.workerDemand(.25),0);
  cycle(w,2);assert.equal(w.H.snapshot().active,0);
  w.road.construction.workDone=5;
  assert.equal(w.H.workerDemand(.25),1);
  cycle(w,2);assert.equal(w.H.snapshot().active,1);
});
check('idle at the warehouse, no duplicate resident while driving',()=>{
  const w=world({logging:true});
  w.H.record({siteId:'camp',good:'wood',qty:3});
  const roster=w.E.laborAllocation(.25).carters;
  assert.ok(w.H.workerStation(roster[0],roster));
  cycle(w,2);
  const t=w.H.snapshot().trips[0];
  assert.ok(t);
  assert.equal(w.H.workerStation({id:t.workerId},roster),null);
  const s=read('src/settlement-population-figures.js');
  assert.match(s,/carterWorkers/);
  assert.match(s,/if\(carter&&!p\)continue/);
  assert.match(s,/carter\?window\.ConquerHaulage\?\.workerStation/);
});
check('shop receipts use real L3 goods output and do not touch the castle ledger',()=>{
  const w=world({market:true,quarry:true});
  const castle=JSON.stringify(w.E.state().castle);
  assert.equal(w.H.record({siteId:'house-L2',good:'tools',qty:1,destination:'market'}),true);
  assert.equal(w.H.snapshot().pending,1);
  assert.equal(JSON.stringify(w.E.state().castle),castle);
  assert.match(read('src/settlement-commerce.js'),/ConquerHaulage\?\.record\?\.\(\{siteId:shop\.houseId,good,qty:SHOP_OUTPUT_PER_DAY/);
});
check('source deletion cancels route; reset and load do not persist duplicate trips',()=>{
  const w=world({logging:true});w.H.record({siteId:'camp',good:'wood',qty:2});
  cycle(w,2);assert.equal(w.H.snapshot().active,1);
  w.State.structures=w.State.structures.filter(x=>x.id!=='camp');
  w.H.tick(.25);assert.equal(w.H.snapshot().active,0);
  w.H.reset();w.H.reset();
  assert.equal(w.H.snapshot().pending,0);
  assert.match(read('src/settlement-app-persistence.js'),/ConquerHaulage\?\.reset/);
});
check('weekly job graphs and panels expose the new profession without a second payroll',()=>{
  assert.match(read('src/settlement-panels.js'),/\['carter','Carrettieri'\]/);
  assert.match(read('src/settlement-economy.js'),/carter:worker\.carter/);
  assert.match(read('src/settlement-app-rooms.js'),/Carrettieri L1/);
  assert.match(read('src/settlement-economy.js'),/carters=l1Available\.splice/);
  assert.doesNotMatch(read('src/settlement-haulage.js'),/castle\[|\.lots\[/);
});
console.log(checks+' L1 carter and market routes regression checks passed.');
