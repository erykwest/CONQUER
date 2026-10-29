'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
const core=fs.readFileSync(path.join(root,'src/settlement-core.js'),'utf8');
const economy=fs.readFileSync(path.join(root,'src/settlement-economy.js'),'utf8');
const work=core.slice(core.indexOf('const CONSTRUCTION_MAX_WORKERS'),core.indexOf('function pointRadius(s)'));
assert.ok(work.startsWith('const CONSTRUCTION_MAX_WORKERS'));
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
function harness({workers=2,day=0}={}){
  const State={clock:{day},village:{founded:true,wellId:'well',foundingWorkers:workers},
    resources:{},structures:[],policies:{tax:10},dirty:false};
  const window={};
  const cal=d=>{
    const date=new Date(Date.UTC(2026,5,1+d));
    return{year:date.getUTCFullYear(),month:date.getUTCMonth(),day:date.getUTCDate()};
  };
  const context=vm.createContext({State,window,clamp,Math,Number,Array,Object,console,
    document:{getElementById:()=>null},calendarDateFromDay:cal,
    underConstruction:s=>s.construction?.version===2?
      s.construction.workDone<s.construction.workRequired-1e-9:
      s.construction?State.clock.day<s.construction.completeDay:false,
    buildDuration:s=>s.workDays??3
  });
  vm.runInContext(economy,context,{filename:'settlement-economy.js'});
  vm.runInContext(work,context,{filename:'construction-v2.js'});
  const script=c=>vm.runInContext(c,context);
  const add=(id,days=4,auto=false)=>{
    State.structures.push({id,type:auto?'house':'tower',auto,workDays:days});
    const index=State.structures.length-1;
    script('beginConstruction(State.structures['+index+'])');
    return State.structures[index];
  };
  const tick=(from,to)=>{State.clock.day=to;return script('tickConstructionWork('+from+','+to+')')};
  return{State,window,ctx:context,e:window.ConquerEconomy,add,tick,script};
}
function near(actual,expected,msg){
  assert.ok(Math.abs(actual-expected)<1e-6,
    msg+': expected '+expected+', got '+actual);
}
function check(name,test){test();console.log('✓ '+name)}

check('lord pays one gold per 20 completed worker-days at current baseline',()=>{
  const h=harness(),s=h.add('keep',6);
  const initial=h.e.snapshot().castleGold,workerCash=h.e.state().wallet.L1;
  h.tick(0,.52); // 2 workers x 1 full shift
  near(s.construction.workDone,2,'construction progress');
  near(initial-h.e.snapshot().castleGold,.1,'lord wage expenditure');
  near(h.e.state().wallet.L1-workerCash,.1,'L1 household paycheck');
  near(s.construction.wagesPaid,.1,'persistent site wage');
  near(h.e.snapshot().constructionPayroll,.1,'cumulative payroll');
});
check('lack of payroll cash pauses work and payroll never overdraws treasury',()=>{
  const h=harness({workers:1}),s=h.add('cash-starved',4);
  h.e.state().castleGold=.025;
  h.tick(0,.52);
  near(s.construction.workDone,.5,'only half a worker-day funded');
  near(h.e.snapshot().castleGold,0,'funds depleted');
  near(h.e.state().wallet.L1,24.025,'half shift paid');
  assert.equal(h.e.availableBuilderIds(1.2).length,0,'unpaid builders not assigned');
  const frozen=s.construction.workDone;
  h.tick(.52,1.52);
  near(s.construction.workDone,frozen,'no wages means no extra labor');
  h.e.state().castleGold=.2;
  h.tick(1.52,2.52);
  near(s.construction.workDone,frozen+1,'work restarts when funds arrive');
  near(h.e.snapshot().castleGold,.15,'exactly one additional workday paid');
});
check('no double charge on repeated or split simulation ticks',()=>{
  const a=harness({workers:1}),b=harness({workers:1});
  const A=a.add('a',9),B=b.add('b',9);
  a.tick(0,2.52);
  b.tick(0,.24);b.tick(.24,.36);b.tick(.36,1.52);b.tick(1.52,2.52);
  near(A.construction.workDone,B.construction.workDone,'equal work in split ticks');
  near(a.e.snapshot().constructionPayroll,b.e.snapshot().constructionPayroll,'equal payroll');
  const spent=b.e.snapshot().constructionPayroll;
  b.tick(2.52,2.52);
  near(b.e.snapshot().constructionPayroll,spent,'no duplicate payout');
});
check('weekends and combat alarm do not pay salaries',()=>{
  const h=harness({workers:2}),s=h.add('rest',9);
  h.tick(0,.52);
  const paid=h.e.snapshot().constructionPayroll;
  h.tick(4.52,6.52);
  near(h.e.snapshot().constructionPayroll,paid,'weekend zero wage');
  h.window.ConquerCombat={alarmMode:()=> 'on'};
  h.tick(7,7.52);
  near(h.e.snapshot().constructionPayroll,paid,'alarm zero wage');
  assert.ok(s.construction.workDone>0);
});
check('the old fixed material charge is independent, and refund never refunds salary',()=>{
  const h=harness({workers:1}),s=h.add('refundable',4);
  h.e.state().castle.wood=30;
  assert.equal(h.e.spendBuild({wood:10,gold:18}),true);
  h.tick(0,.52);
  const paid=h.e.snapshot().constructionPayroll;
  const before=h.e.snapshot().castleGold;
  h.e.refundBuild({wood:10,gold:18});
  near(h.e.snapshot().castleGold,before+18,'only fixed construction gold refunded');
  near(h.e.snapshot().constructionPayroll,paid,'wages not refunded');
  near(h.e.snapshot().castle.wood,30,'materials refunded as legacy rule');
  assert.equal(s.construction.wagesPaid>0,true);
});
check('auto-generated structure labor is in spawn quote; no lord payroll or cash debit',()=>{
  const h=harness({workers:0}),initial=h.e.snapshot().castleGold;
  const house=h.add('house-one',4,true);
  near(house.spawnCost.laborDays,4,'auto effort');
  near(house.spawnCost.laborGold,.2,'embedded labor cost');
  assert.equal(house.spawnCost.payer,'spontaneous');
  near(h.e.snapshot().spontaneousSpawnLabor,.2,'spontaneous cost counted once');
  h.tick(0,5);
  near(h.e.snapshot().castleGold,initial,'lord never pays spontaneous workers');
  near(h.e.snapshot().constructionPayroll,0,'no duplicate payroll');
});
check('rejected spawn candidates are not booked in aggregate accounting',()=>{
  const h=harness({workers:0});
  h.add('accepted',3,true);
  h.script("beginConstruction({id:'rejected',auto:true,type:'house',workDays:10})");
  near(h.e.snapshot().spontaneousSpawnLabor,.15,'only accepted world structures');
  assert.equal(h.e.snapshot().spontaneousSpawnCount,1);
});
check('yearly wage repricing changes both manual shifts and future spawn quotes',()=>{
  const h=harness({workers:1}),s=h.add('raising-wages',5);
  h.e.state().wage.L1=2;
  h.tick(0,.52);
  near(s.construction.wagesPaid,.1,'new 2/month payroll');
  const fresh=h.add('auto-growth',4,true);
  near(fresh.spawnCost.laborGold,.4,'new wage embedded in spawn');
});
check('persistent site progress and ledger prevent payment a second time after reload',()=>{
  const h=harness({workers:1}),s=h.add('save',5);
  h.tick(0,.52);
  const econ=JSON.parse(JSON.stringify(h.State.economy));
  const structure=JSON.parse(JSON.stringify(s));
  const other=harness({workers:1,day:.52});
  other.State.economy=econ;
  other.State.structures.push(structure);
  near(other.e.snapshot().constructionPayroll,.05,'reloaded cumulative payroll');
  other.tick(.52,.52);
  near(other.e.snapshot().constructionPayroll,.05,'repeat boundary no repayment');
  other.tick(.52,1.52);
  near(other.e.snapshot().constructionPayroll,.1,'new workday only');
  near(other.State.structures[0].construction.wagesPaid,.1,'site log preserved');
});
check('legacy manual work only pays future shifts, not past timer progress',()=>{
  const h=harness({workers:1,day:2});
  const s={id:'old',type:'tower',construction:{startedDay:0,completeDay:6}};
  h.State.structures.push(s);
  h.script('migrateConstructionSites()');
  near(h.e.snapshot().constructionPayroll,0,'migration no retro payroll');
  h.tick(2,2.52);
  near(h.e.snapshot().constructionPayroll,.05,'new work paid');
});
console.log('Construction payroll regression: all checks passed.');
