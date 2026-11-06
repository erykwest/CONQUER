'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
function harness(){
  const State={clock:{day:0},structures:[],environment:[],relief:{hills:[],terraforming:[]},
    resources:{wood:0},village:{founded:true,wellId:'well',foundingWorkers:4},policies:{}};
  const saved={count:0,dirty:0},window={};
  const context=vm.createContext({State,window,console,
    terrainElevation:()=>0,
    underConstruction:s=>!!s.construction&&s.construction.workDone<s.construction.workRequired,
    rectWorldPoints:(x,y,w,h)=>[
      {x:x-w/2,y:y-h/2},{x:x+w/2,y:y-h/2},
      {x:x+w/2,y:y+h/2},{x:x-w/2,y:y+h/2}],
    invalidateSceneCache:()=>{saved.dirty++},
    invalidateNavigation:()=>{saved.dirty++},
    markStructureDirty:()=>{saved.dirty++},
    scheduleLocalSave:()=>{saved.count++},
    canAfford:cost=>window.ConquerEconomy.canBuild(cost),
    spendCost:cost=>window.ConquerEconomy.spendBuild(cost),
    calendarDateFromDay:()=>({month:0,year:1,day:1}),
    Number,Math,Array,Object,Date
  });
  window.ConquerPlacement={check:s=>{
    const well=State.structures.find(x=>x.type==='well');
    if(s.x<51||s.x>149||s.y<51||s.y>149)return{ok:false,reason:'border'};
    if(well&&Math.hypot(s.x-well.x,s.y-well.y)<2.5)return{ok:false,reason:'well'};
    if(State.structures.some(x=>x.type==='blocking'&&Math.hypot(s.x-x.x,s.y-x.y)<4))
      return{ok:false,reason:'occupied'};
    return{ok:true};
  }};
  vm.runInContext(read('src/settlement-economy.js'),context,{filename:'settlement-economy.js'});
  vm.runInContext(read('src/settlement-storage-yard.js'),context,{filename:'settlement-storage-yard.js'});
  const yard=window.ConquerStorageYard,economy=window.ConquerEconomy;
  return{State,window,context,saved,yard,economy};
}
let passed=0;
function test(name,fn){fn();passed++;console.log('PASS '+name)}
test('stockyard is wired into founding, legacy saves, two renderers and both palettes',()=>{
  for(const [file,needle] of [
    ['index.html','settlement-storage-yard.js'],
    ['index.html','data-storage-yard'],
    ['src/settlement-builder-ux.js','[data-storage-yard]'],
    ['src/settlement-app-input.js','ConquerStorageYard?.ensureForWell'],
    ['src/settlement-app-persistence.js','ConquerStorageYard?.ensureForWell'],
    ['src/settlement-world3d.js','ConquerStorageYard.addToBuilder'],
    ['src/settlement-render.js','ConquerStorageYard.draw'],
    ['src/settlement-app-rooms.js','data-stockyard-grow'],
    ['figures-lab.html','settlement-storage-yard.js'],
    ['src/asset-catalog.js','ConquerStorageYard']
  ])assert.ok(read(file).includes(needle),file+' missing '+needle);
});
test('stockyard model registry exposes three truly meshed variants for Asset Lab',()=>{
  const h=harness(),models=h.yard.models;
  for(const key of ['stockyard2','stockyard4','stockyard6']){
    const shape=models[key].parts.stockyard;
    assert.ok(shape.p.length>100,'real mesh vertices, not a sketch');
    assert.equal(shape.p.length/9,shape.c.length,'one colour per triangle');
  }
});
test('foundation spawns exactly one storageYard within 7U and references real founding stock',()=>{
  const h=harness();h.State.structures=[{id:'well',type:'well',x:100,y:100}];
  const e=h.economy;
  assert.equal(e.foundingCharter('well'),true);
  const before=JSON.stringify(e.state().castle);
  const s=h.yard.ensureForWell();
  assert.ok(s);
  assert.equal(s.type,'storageYard');assert.equal(s.w,2);assert.equal(s.h,2);
  assert.equal(s.foundingStockyard,true);
  assert.ok(Math.hypot(s.x-100,s.y-100)<=7);
  assert.equal(h.yard.capacity(),600);
  assert.equal(JSON.stringify(h.yard.stocks()),before);
  assert.equal(JSON.stringify(e.state().castle),before,'no additional inventory allocated');
  assert.equal(h.yard.ensureForWell().id,s.id);
  assert.equal(h.State.structures.filter(x=>x.type==='storageYard').length,1);
  assert.equal(h.yard.canRemove(s),false,'last storage yard with goods cannot be deleted');
});
test('logging camp produces stored wood on workdays even when charter stock exceeds old target',()=>{
  const h=harness();const e=h.economy;
  h.State.structures=[{id:'well',type:'well',x:100,y:100}];
  e.foundingCharter('well');
  const yard=h.yard.ensureForWell();
  h.State.structures.push({id:'logger',type:'loggingCamp',economicOwner:'lord'});
  const before=e.state().castle.wood;
  const marketBefore=e.snapshot().market.wood;
  e.tick(-1,0);
  assert.equal(e.state().castle.wood,before+1,'half output must accumulate in stockyard');
  assert.equal(e.snapshot().market.wood,marketBefore+1,'other half follows sales policy');
  assert.equal(e.state().weekProduced.wood,2);
  assert.equal(h.yard.stocks().wood,e.state().castle.wood);
  assert.equal(h.yard.capacity(),600);
  assert.equal(h.State.structures.filter(s=>s.id===yard.id).length,1);
});
test('one logger remains staffed when all four founding L1 would otherwise build',()=>{
  const h=harness(),e=h.economy;
  h.State.structures=[
    {id:'well',type:'well',x:100,y:100},
    {id:'logger',type:'loggingCamp',economicOwner:'lord'},
    {id:'site-1',type:'tower',construction:{version:2,startedDay:0,workRequired:100,workDone:0}},
    {id:'site-2',type:'tower',construction:{version:2,startedDay:0,workRequired:100,workDone:0}}
  ];
  e.foundingCharter('well');h.yard.ensureForWell();
  const assigned=e.laborAllocation(0);
  assert.ok(assigned.allocated.logger>=1,'stockyard reserves a logger before builder-only demand exhausts L1');
  assert.ok(assigned.spareL1.length<=3,'the logger is not also eligible for construction');
  const wood=e.state().castle.wood;
  e.tick(-1,0);
  assert.ok(e.state().castle.wood>wood,'work is real production into the stockyard');
});
test('warehouse expansion checks space, pays materials and increases capacity, without minting goods',()=>{
  const h=harness();h.State.structures=[{id:'well',type:'well',x:100,y:100}];
  h.economy.foundingCharter('well');
  const y=h.yard.ensureForWell(),before=JSON.stringify(h.yard.stocks());
  assert.equal(h.yard.grow(y,6).ok,false,'cannot skip a size');
  const c=h.yard.grow(y,4);assert.equal(c.ok,true,c.reason);
  assert.equal(y.w,4);assert.equal(y.h,4);assert.equal(h.yard.capacity(),2400);
  assert.equal(h.economy.state().castle.wood,200-10,'expansion spends materials');
  assert.equal(h.economy.state().castleGold,700-20,'expansion pays gold');
  assert.notEqual(JSON.stringify(h.yard.stocks()),before,'stocks decrease solely by paid cost');
  const c2=h.yard.grow(y,6);assert.equal(c2.ok,true,c2.reason);
  assert.equal(h.yard.capacity(),5400);assert.equal(y.yardSize,6);
  assert.equal(h.yard.grow(y,8).ok,false);
});
test('expansion refuses obstructed parcels and retains exact resources',()=>{
  const h=harness();h.State.structures=[{id:'well',type:'well',x:100,y:100}];
  h.economy.foundingCharter('well');
  const y=h.yard.ensureForWell();
  h.State.structures.push({id:'block',type:'blocking',x:y.x,y:y.y});
  const before=JSON.stringify(h.economy.state().castle);
  assert.equal(h.yard.grow(y,4).ok,false);
  assert.equal(y.yardSize,2);
  assert.equal(JSON.stringify(h.economy.state().castle),before);
});
test('stockyard rehydration does not issue second charter or duplicate existing yard',()=>{
  const h=harness();h.State.structures=[{id:'well',type:'well',x:100,y:100}];
  h.economy.foundingCharter('well');
  const snap=JSON.stringify(h.economy.state().castle);
  h.yard.ensureForWell();
  const restored=JSON.parse(JSON.stringify(h.State.structures));
  h.State.structures=restored;
  h.yard.ensureForWell();
  assert.equal(h.State.structures.length,2);
  assert.equal(JSON.stringify(h.economy.state().castle),snap);
  assert.equal(h.economy.foundingCharter('well'),false);
});
console.log(passed+' stockyard regression checks passed.');
