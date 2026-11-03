'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
const core=fs.readFileSync(path.join(root,'src/settlement-core.js'),'utf8');
const source=core.slice(core.indexOf('const CONSTRUCTION_MAX_WORKERS'),core.indexOf('function pointRadius(s)'));
assert.ok(source.startsWith('const CONSTRUCTION_MAX_WORKERS'),'Construction V2 source missing');
const economySource=fs.readFileSync(path.join(root,'src/settlement-economy.js'),'utf8');
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function harness(options={}){
  const State={
    clock:{day:options.day??0},village:{founded:true,wellId:'well',foundingWorkers:options.workers??4},
    structures:[],resources:{},policies:{tax:10},dirty:false
  },window={};
  const date=day=>{
    const t=new Date(Date.UTC(2026,5,1+day));
    return{year:t.getUTCFullYear(),month:t.getUTCMonth(),day:t.getUTCDate()};
  };
  const context=vm.createContext({State,window,clamp,console,Number,Math,
    underConstruction:s=>s.construction?.version===2?s.construction.workDone<s.construction.workRequired:
      s.construction?State.clock.day<s.construction.completeDay:false,
    buildDuration:s=>s.workDays??4,
    calendarDateFromDay:date,
    document:{getElementById:()=>null}
  });
  vm.runInContext(economySource,context,{filename:'settlement-economy.js'});
  vm.runInContext(source,context,{filename:'construction-worker-functions.js'});
  const call=(fn,args=[])=>vm.runInContext(fn+'(...'+JSON.stringify(args)+')',context);
  const site=(id,workDays=4,auto=false)=>{
    const s={id,type:auto?'house':'tower',auto,workDays};
    State.structures.push(s);
    call('beginConstruction',[s]); // VM function gets the same structure through State
    return s;
  };
  // Accept structurally shared objects through the State array, no sandbox copying.
  const add=(id,workDays=4,auto=false)=>{
    State.structures.push({id,type:auto?'house':'tower',auto,workDays});
    const index=State.structures.length-1;
    vm.runInContext('beginConstruction(State.structures['+index+'])',context);
    return State.structures[index];
  };
  const tick=(from,to)=>{
    State.clock.day=to;
    return vm.runInContext('tickConstructionWork('+from+','+to+')',context);
  };
  const report=s=>vm.runInContext('constructionProgress(State.structures.find(s=>s.id==='+JSON.stringify(s.id)+'))',context);
  return {State,window,e:window.ConquerEconomy,add,tick,report,vm:context};
}
function close(v,e,label){assert.ok(Math.abs(v-e)<1e-6,label+': expected '+e+' got '+v)}
function test(name,fn){fn();console.log('✓ '+name)}

test('zero L1 never progresses manual construction',()=>{
  const h=harness({workers:0}),s=h.add('wall',2);
  h.tick(0,4.52);
  close(s.construction.workDone,0,'no worker progress');
  assert.equal(s.construction.workers,0);
  assert.equal(h.report(s),0);
});
test('a single L1 produces one workday per weekday and pauses at weekends',()=>{
  const h=harness({workers:1}),s=h.add('wall',3);
  h.tick(0,4.52);close(s.construction.workDone,3,'complete after three weekdays');
  const second=h.add('other',3);
  h.tick(4.52,7.14);close(second.construction.workDone,0,'weekend gives no labor');
  h.tick(7.14,7.52);close(second.construction.workDone,1,'Monday worker returns');
});
test('idle L1 are distributed fairly; at most three assigned per site',()=>{
  const h=harness({workers:4}),a=h.add('a',8),b=h.add('b',8);
  h.tick(0,.52);
  close(a.construction.workDone,2,'two builders on first site');
  close(b.construction.workDone,2,'two builders on second site');
  assert.equal(a.construction.workers,2);
  assert.equal(b.construction.workers,2);
  const single=harness({workers:4}),c=single.add('one',8);
  single.tick(0,.52);close(c.construction.workDone,3,'single site cap three');
});
test('industrial workers cannot be counted again as builders',()=>{
  const h=harness({workers:4});
  h.State.structures.push({id:'camp',type:'loggingCamp',economicOwner:'lord'});
  const s=h.add('tower',4);
  h.tick(0,.52);
  assert.equal(h.e.staffing().camp,2);
  assert.equal(h.e.availableBuilders(),2);
  close(s.construction.workDone,2,'two genuinely idle L1');
});
test('construction pauses when L1 staffing is exhausted; resumes after industry disabled',()=>{
  const h=harness({workers:4});
  // Vineyards are ordinary L1 industry; logging camps follow the wood-reserve rule.
  h.State.structures.push({id:'camp1',type:'vineyard',economicOwner:'lord',economyDisabled:false});
  h.State.structures.push({id:'camp2',type:'vineyard',economicOwner:'lord',economyDisabled:false});
  const s=h.add('gate',5);
  h.tick(0,.52);close(s.construction.workDone,0,'both industries reserve all workers');
  h.State.structures.find(s=>s.id==='camp2').economyDisabled=true;
  h.tick(.52,1.52);close(s.construction.workDone,2,'two idle laborers resume');
});
test('completion fires once, preserves full progress and does not advance afterwards',()=>{
  const h=harness({workers:2}),s=h.add('short',1);
  const first=h.tick(0,.52);
  assert.equal(first.length,1);
  assert.equal(first[0].id,'short');
  close(h.report(s),1,'fully built');
  assert.ok(Number.isFinite(s.construction.completedDay));
  assert.equal(h.tick(.52,4.52).length,0);
});
test('split ticks equal a single tick when staffing is unchanged',()=>{
  const a=harness({workers:1}),b=harness({workers:1});
  const siteA=a.add('site',9),siteB=b.add('site',9);
  a.tick(0,3.52);
  b.tick(0,.30);b.tick(.30,1.2);b.tick(1.2,2.71);b.tick(2.71,3.52);
  close(siteA.construction.workDone,siteB.construction.workDone,'same worker-days');
  b.tick(3.52,3.52);
  close(siteA.construction.workDone,siteB.construction.workDone,'repeat tick adds no work');
});
test('old manual saves retain their percent when converted from deadlines',()=>{
  const h=harness({workers:1,day:2});
  const old={id:'legacy',type:'tower',construction:{startedDay:0,completeDay:6}};
  h.State.structures.push(old);
  vm.runInContext('migrateConstructionSites()',h.vm);
  assert.equal(old.construction.version,2);
  close(old.construction.workDone/old.construction.workRequired,1/3,'legacy progress kept');
  h.tick(2,2.52);
  assert.ok(old.construction.workDone>2,'legacy work resumes');
});
test('automatic houses and roads retain independent timed growth',()=>{
  const h=harness({workers:0}),house=h.add('auto',2,true);
  assert.equal(h.report(house),0);
  h.tick(0,2.01);
  close(h.report(house),1,'automatic timed completion');
  assert.equal(house.construction.version,undefined,'bootstrap never migrated to V2');
});
test('construction work stops during a combat alarm',()=>{
  const h=harness({workers:3}),site=h.add('danger',4);
  h.window.ConquerCombat={alarmMode:()=> 'on'};
  h.tick(0,.52);close(site.construction.workDone,0,'alarm stops builders');
  h.window.ConquerCombat={alarmMode:()=> 'off'};
  h.tick(.52,1.52);assert.ok(site.construction.workDone>0);
});
console.log('Staffed construction regression: all checks passed.');
