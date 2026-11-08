'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.resolve(__dirname,'..');
const core=fs.readFileSync(path.join(root,'src/settlement-core.js'),'utf8');
const start=core.indexOf('const CONSTRUCTION_MAX_WORKERS=3;');
const end=core.indexOf('function pointRadius(s)',start);
assert(start>=0&&end>start,'construction runtime should be extractable');
const runtime=core.slice(start,end);

function makeScenario(wood=0,gold=0,workers=1){
  const state={village:{founded:true},clock:{day:0},structures:[],resources:{wood,gold},dirty:false};
  const econ={castleGold:gold,castle:{wood},wallet:{L1:0}};
  let charged=0;
  const api={
    state:()=>econ,
    spendBuild(cost){
      if(Object.entries(cost).some(([key,qty])=>(key==='gold'?econ.castleGold:econ.castle[key]||0)+1e-7<qty))return false;
      for(const [key,qty] of Object.entries(cost)){
        if(key==='gold')econ.castleGold=Math.round((econ.castleGold-qty)*1000)/1000;
        else econ.castle[key]=Math.round(((econ.castle[key]||0)-qty)*1000)/1000;
        charged+=qty;
      }
      return true;
    },
    availableBuilderIds:()=>Array.from({length:workers},(_,i)=>({id:'L1-'+i})),
    constructionWagePerWorkday:()=>0,
    payConstructionWork:(_site,work)=>({work,paid:0})
  };
  const context={State:state,window:{ConquerEconomy:api},
    buildDuration:s=>s.duration,
    clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),
    constructionWorkerPath:()=>true,console};
  vm.runInNewContext(runtime+';\nglobalThis.TEST={beginConstruction,constructionPriority,constructionMaterialInfo,constructionProgress,constructionCrewAssignments,tickConstructionWork,refundableConstructionCost};',context);
  const t=context.TEST;
  function add(id,priority=2,cost={wood:10},duration=4){
    const site={id,type:'tower',duration,buildCost:cost};
    state.structures.push(site);
    t.beginConstruction(site);
    site.construction.priority=priority;
    return site;
  }
  return {state,econ,add,t,get charged(){return charged}};
}

// Ghost confirmation is never conditioned on money or stone/wood inventory.
{
  const q=makeScenario(0,0),site=q.add('unfunded');
  assert.equal(q.charged,0,'new sites must not debit their full quotes');
  q.t.tickConstructionWork(0,1);
  assert.equal(q.t.constructionProgress(site),0,'no materials => no work progress');
  assert.equal(q.t.constructionMaterialInfo(site).progress,0);
  assert.equal(q.econ.castle.wood,0,'never create negative stock');
  assert.equal(Object.keys(q.t.refundableConstructionCost(site)).length,0,'unfunded removal refunds nothing');
  q.econ.castle.wood=12;
  q.t.tickConstructionWork(1,2);
  assert(q.t.constructionProgress(site)>0,'incoming stock unblocks existing site');
  assert(q.t.constructionMaterialInfo(site).progress>0,'delivery is tracked per site');
}
{
  const q=makeScenario(10,0);
  const site=q.add('partial',2,{wood:10,gold:5});
  q.t.tickConstructionWork(0,1);
  assert(q.t.constructionMaterialInfo(site).delivered.wood>0,'wood must arrive despite missing gold');
  assert.equal(q.t.constructionMaterialInfo(site).delivered.gold,0,'unavailable gold stays pending');
  assert.equal(site.construction.workDone,0,'physical progress waits for the limiting material');
  const wood=q.t.constructionMaterialInfo(site).delivered.wood;
  q.econ.castleGold=5;
  q.t.tickConstructionWork(1,2);
  assert(site.construction.workDone>0,'new gold delivery unblocks work with stored wood');
  assert(q.t.constructionMaterialInfo(site).delivered.wood>=wood,'no previously delivered wood is lost');
  assert(q.econ.castleGold>=0,'gold cannot overdraw');
}
{
  const q=makeScenario(4,0),low=q.add('low',0),high=q.add('high',5);
  q.t.tickConstructionWork(0,1);
  assert(q.t.constructionMaterialInfo(high).progress>0,'critical project receives first allocation');
  assert.equal(q.t.constructionMaterialInfo(low).progress,0,'low priority queues when stock exhausted');
  assert(q.t.constructionProgress(high)>0,'critical site also receives the scarce builder');
  assert.equal(q.t.constructionProgress(low),0);
  assert(q.econ.castle.wood>=0,'no negative ledger balance');
  const supplied=q.t.constructionMaterialInfo(high).delivered.wood;
  assert(Math.abs(q.charged-supplied)<1e-7,'each delivered good is debited exactly once');
  assert.equal(q.t.refundableConstructionCost(high).wood,supplied,'refund only delivered goods');
  low.construction.priority=5;high.construction.priority=0;
  q.econ.castle.wood=4;
  q.t.tickConstructionWork(1,2);
  assert(q.t.constructionProgress(low)>0,'changing priority affects an existing saved site');
}
{
  const q=makeScenario();
  const legacy={id:'old',type:'tower',buildCost:{wood:9},
    construction:{version:2,startedDay:0,workRequired:4,workDone:1,lastWorkDay:0,workers:0}};
  q.state.structures.push(legacy);
  assert.equal(q.t.constructionMaterialInfo(legacy).progress,1,'legacy prepaid V2 site stays funded');
  assert.equal(q.t.refundableConstructionCost(legacy).wood,9,'legacy deletion conserves its previous refund');
}
const placement=fs.readFileSync(path.join(root,'src/settlement-placement.js'),'utf8');
const app=fs.readFileSync(path.join(root,'src/settlement-app.js'),'utf8');
const crossings=fs.readFileSync(path.join(root,'src/settlement-crossings.js'),'utf8');
assert(!placement.includes("if(options.checkCost!==false&&!s.auto)"),'ghost preflight must ignore affordability');
assert(!app.includes("if(!canAfford(totalCost))"),'multi-segment routes must not demand prepayment');
assert(!crossings.includes("if(!canAfford(cost)){status('Insufficient resources:"),'crossings must also support unfunded sites');
console.log('Construction priority regression: PASS');
