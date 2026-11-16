'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const forestSource=read('src/settlement-forestry.js');
function inside(p,poly){
  let yes=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const a=poly[i],b=poly[j];
    if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)yes=!yes;
  }
  return yes;
}
const rect=(x,y,r)=>[{x:x-r,y:y-r},{x:x+r,y:y-r},{x:x+r,y:y+r},{x:x-r,y:y+r}];
function harness({workers=2,reserved=0,wealth=100,devBuild={},founded=true}={}){
  const State={village:{founded,wellId:'well'},clock:{day:0},devBuild,
    structures:[],resources:{wood:0},relief:{hills:[],terraforming:[]},
    environment:[{id:'wood-1',type:'forest',points:rect(100,100,7)}]};
  const side={paid:0,credited:0,credits:[],saved:0,invalidated:0};
  const workerList=Array.from({length:workers},(_,i)=>({id:'L1-'+i}));
  const woodAt=(forest,p)=>inside(p,forest.points)&&!forest.holes?.some(poly=>inside(p,poly));
  const economy={
    availableBuilderIds:()=>workerList,
    payConstructionWork:(job,amount)=>{
      const permitted=Math.min(amount,wealth-side.paid);
      side.paid+=permitted;
      return{work:permitted,paid:permitted*.05};
    },
    creditForestryWood:(wood,id)=>{side.credited+=wood;side.credits.push(id);State.resources.wood+=wood;return true}
  };
  const ctx=vm.createContext({State,window:{ConquerEconomy:economy},
    inBuild:p=>p.x>=50&&p.x<=150&&p.y>=50&&p.y<=150,
    environmentContains:woodAt,
    constructionCrewAssignments:()=>new Map([['other-site',workerList.slice(0,reserved)]]),
    scheduleLocalSave:()=>side.saved++,
    clearForestLayoutCache:()=>side.invalidated++,
    invalidateSceneCache:()=>side.invalidated++,
    markDirty:()=>side.invalidated++,
    devBuildMode:key=>State.devBuild?.[key]===true,
    console,Math,Number,Object,Array});
  vm.runInContext(forestSource,ctx,{filename:'settlement-forestry.js'});
  return{api:ctx.window.ConquerForestry,State,side,woodAt};
}
let count=0;
function test(name,fn){fn();count++;console.log('PASS '+name)}
test('logging camp consumes only 5 wood and continues to require 35 gold',()=>{
  assert.match(read('src/settlement-industries.js'),/loggingCamp:\{[^\n]*cost:\{gold:35,wood:5\}/);
});
test('Builder registers the forest tool in HTML, UX and input, and loads forestry runtime',()=>{
  assert.match(read('index.html'),/data-terraform="forest"/);
  assert.match(read('index.html'),/settlement-forestry\.js/);
  assert.match(read('src/settlement-builder-ux.js'),/\[data-terraform="forest"\]/);
  assert.match(read('src/settlement-app-input.js'),/ConquerForestry\?\.start\(ghost\)/);
  assert.match(read('src/settlement-app-simulation.js'),/ConquerForestry\?\.tick/);
});
test('preview estimates substantial timber but does not clear or credit until L1 completion',()=>{
  const h=harness();
  const before=JSON.stringify(h.State.environment);
  const quote=h.api.preview({x:100,y:100},{radius:2,shape:'round'});
  assert.equal(quote.ok,true,quote.reason);
  assert.ok(quote.wood>=20,'Two-unit clearing should harvest many wood');
  assert.equal(JSON.stringify(h.State.environment),before);
  const start=h.api.start(quote);
  assert.equal(start.ok,true);
  assert.equal(h.api.jobs().length,1);
  assert.equal(h.side.credited,0);
  assert.equal(JSON.stringify(h.State.environment),before,'enqueuing never removes trees');
  assert.ok(h.api.jobs()[0].construction.workRequired>0);
  h.api.tick(0,1);
  assert.ok(h.api.jobs()[0].construction.workDone>0);
  assert.equal(h.side.credited,0);
  assert.equal(JSON.stringify(h.State.environment),before,'forest persists during work');
  h.api.tick(1,5);
  assert.equal(h.api.jobs()[0].construction.workDone,h.api.jobs()[0].construction.workRequired);
  assert.equal(h.side.credited,quote.wood);
  assert.equal(h.woodAt(h.State.environment[0],{x:100,y:100}),false);
  assert.ok(h.side.invalidated>0);
  h.api.tick(5,15);
  assert.equal(h.side.credited,quote.wood,'completion cannot credit a second time');
  assert.equal(h.side.credits.length,1);
  assert.equal(h.api.preview({x:100,y:100},{radius:2}).ok,false,'cleared area stays clear');
});
test('weekends do not advance work, already allocated construction workers are excluded',()=>{
  const h=harness({workers:3,reserved:2});
  const quote=h.api.preview({x:100,y:100},{radius:4});
  h.api.start(quote);
  assert.equal(h.api.crews(0).get(h.api.jobs()[0].id).length,1);
  h.api.tick(0,1);
  assert.equal(h.api.jobs()[0].construction.workDone,1);
  h.api.tick(5,7);
  assert.equal(h.api.jobs()[0].construction.workDone,1);
  assert.equal(h.side.credited,0);
});
test('unpaid crews cannot instantly clear the forest',()=>{
  const h=harness({wealth:0});
  const quote=h.api.preview({x:100,y:100},{radius:2});
  h.api.start(quote);
  h.api.tick(0,5);
  assert.equal(h.api.jobs()[0].construction.workDone,0);
  assert.equal(h.side.credited,0);
  assert.equal(h.woodAt(h.State.environment[0],{x:100,y:100}),true);
});
test('persisted jobs resume from stored progress and overlapping queued areas are rejected',()=>{
  const h=harness();
  const quote=h.api.preview({x:100,y:100},{radius:4,shape:'square'});
  h.api.start(quote);
  h.api.tick(0,1);
  const stored=JSON.parse(JSON.stringify(h.State.relief));
  assert.equal(h.api.preview({x:102,y:100},{radius:2}).ok,false);
  const original=h.api.jobs()[0].construction.workDone;
  h.State.relief=stored;
  h.api.tick(1,2);
  assert.ok(h.api.jobs()[0].construction.workDone>original);
  assert.equal(h.side.credited,0);
});
test('DEV Fast build clears at once, even before the village is founded',()=>{
  const h=harness({devBuild:{fastBuild:true},founded:false,workers:0});
  const quote=h.api.preview({x:100,y:100},{radius:2});
  assert.equal(quote.ok,true,quote.reason);
  const r=h.api.start(quote);
  assert.equal(r.ok,true);
  const c=h.api.jobs()[0].construction;
  assert.equal(c.workDone,c.workRequired,'done on placement');
  assert.equal(h.side.credited,quote.wood,'the wood is credited');
  assert.equal(h.side.paid,0,'no wage-backed work');
  assert.equal(h.woodAt(h.State.environment[0],{x:100,y:100}),false,'the trees are gone');
  h.api.tick(0,5);assert.equal(h.side.credits.length,1,'credited once');
  assert.match(read('src/settlement-app-calendar-ui.js'),/ConquerForestry\?\.applyDev\?\.\(\)/,'switching Fast build on clears queued jobs');
});
test('DEV Fast build switched on later finishes the queued clearings',()=>{
  const h=harness();
  h.api.start(h.api.preview({x:100,y:100},{radius:2}));
  h.State.devBuild={fastBuild:true};
  assert.equal(h.api.applyDev(),1);
  assert.equal(h.side.credits.length,1);
});
test('DEV Free build pays no wages, the crew still works',()=>{
  const h=harness({devBuild:{freeBuild:true},wealth:0});
  const quote=h.api.preview({x:100,y:100},{radius:2});
  h.api.start(quote);
  h.api.tick(0,1);
  assert.ok(h.api.jobs()[0].construction.workDone>0,'unpaid but working');
  assert.equal(h.side.paid,0);
  h.api.tick(1,5);
  assert.equal(h.side.credited,quote.wood);
});
test('managed L1 Job Manager staffs forest clearance through the builder roster',()=>{
  // Real economy + forestry runtime: the managed roster must count open clearings.
  const urban=read('qa/urban-regression.cjs').split('let passed=0;')[0];
  eval(urban+`
  run(moduleFile('economy'));run(moduleFile('forestry'));run('function renderUI(){}');run("function constructionWorkerPath(){return true}");
  for(const managed of [false,true]){
    run("State.devBuild={};State.village={founded:true,wellId:'well',foundingWorkers:3};State.clock.day=0;State.structures=[{id:'well',type:'well',x:100,y:100}];State.economy=null;window.ConquerEconomy.reset();window.ConquerEconomy.state().castleGold=500;");
    run("State.relief=State.relief||{};State.relief.forestryJobs=[{id:'forest-clear-1',center:{x:110,y:110},radius:3,shape:'round',wood:10,coveredArea:4,construction:{version:2,startedDay:0,lastWorkDay:0,workRequired:3,workDone:0,workers:0,wagesPaid:0}}]");
    run("window.ConquerEconomy.state().l1Jobs.enabled="+managed);
    assert.equal(run("window.ConquerForestry.crews(.4).get('forest-clear-1').length"),3,(managed?'managed':'legacy')+' crew');
    run("window.ConquerForestry.tick(0,5)");
    assert.equal(run("State.relief.forestryJobs[0].construction.workDone"),3,(managed?'managed':'legacy')+' clearance completes');
  }
  assert.equal(run("window.ConquerEconomy.jobManager(.4).tasks.find(t=>t.key==='builders').demand"),0,'a finished clearing frees the roster');
  `);
});
console.log(count+' forestry regression checks passed.');
