'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../src/settlement-economy.js'),'utf8');
function harness() {
  const State={clock:{day:0},village:{founded:false},
    structures:[{id:'home',type:'house',houseLevel:1},
      {id:'forest',type:'loggingCamp',economicOwner:'lord'}],
    policies:{tax:10,rations:'market'}};
  const window={};
  const calendarDateFromDay=day=>{
    const date=new Date(Date.UTC(2026,5,1+day));
    return {year:date.getUTCFullYear(),month:date.getUTCMonth(),day:date.getUTCDate()};
  };
  vm.runInNewContext(source,{State,window,document:{getElementById:()=>null},
    calendarDateFromDay,underConstruction:()=>false,console,Math,Number,Object,Array});
  return {State,economy:window.ConquerEconomy};
}
const {State,economy}=harness();
economy.tick(-1,5);
let history=economy.snapshot().panelHistory;
assert.equal(history.length,1);
assert.equal(history[0].day,5);
assert.ok(Number.isFinite(history[0].welfare));
assert.ok(Number.isFinite(history[0].happiness.L1));
assert.ok(Number.isFinite(history[0].prices.wood));
assert.ok(Number.isFinite(history[0].jobs.logging));
assert.equal(history[0].production.find(x=>x.id==='forest').owner,'lord');
assert.ok(history[0].production.find(x=>x.id==='forest').goods.wood>0);
const first=JSON.stringify(history[0]);
economy.tick(5,5);
assert.equal(JSON.stringify(economy.snapshot().panelHistory[0]),first,'tick replay must not append duplicates');
// Owner recorded at the time of production; never retroactively change history on transfer.
economy.transfer('forest','private');
economy.tick(5,12);
history=economy.snapshot().panelHistory;
assert.equal(history[0].production.find(x=>x.id==='forest').owner,'lord');
assert.equal(history[1].production.find(x=>x.id==='forest').owner,'private');
assert.ok(history[1].population.L1>0);
economy.tick(12,220);
history=economy.snapshot().panelHistory;
assert.equal(history.length,26,'history retention is bounded to 26 markets');
assert.equal(history[history.length-1].day,215);
assert.equal(economy.state().panelHistory.length,26,'history persists in economy state');
delete economy.state().panelHistory;
delete economy.state().weekProducedSites;
assert.ok(Array.isArray(economy.state().panelHistory),'older saves migrate without reset');
assert.equal(typeof economy.state().weekProducedSites,'object');
console.log('economy-panel-history-regression PASS (snapshots, labor, source output, transfers, cap, migration)');
