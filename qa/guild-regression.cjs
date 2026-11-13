'use strict';
// GILDA-01 fase 1: one active guild per village raises every L3 workshop's output
// by +25/+50/+100% (L1/L2/L3), scaled by the officials' coverage (SCOL-01 role
// 'guild.official'; transitional yield 1 until ConquerEducated exposes coverage).
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
const html=read('index.html');
function harness(houses,guilds=[],saved=null){
  const State={seed:7,clock:{day:0},village:{founded:true,wellId:'well',foundingWorkers:0},economy:saved,
    structures:[{id:'well',type:'well'},...houses.map((lvl,i)=>({id:'h'+i,type:'house',houseLevel:lvl})),
      ...guilds.map(g=>({type:'guild',...g}))],
    policies:{tax:0,rations:'market'}};
  const window={};
  const ctx=vm.createContext({State,window,console,Math,Number,Array,Object,Set,String,document:{getElementById:()=>null},
    calendarDateFromDay:day=>({month:0,year:1,day:day+1}),
    underConstruction:s=>!!s.construction&&State.clock.day<s.construction.completeDay,
    houseLevel:s=>s.houseLevel,
    civicLevel:s=>Math.max(1,Math.min(3,Math.round(Number(s?.civicLevel)||1)))});
  for(const f of ['settlement-economy.js','settlement-urban-economy.js','settlement-market-economy.js','settlement-commerce.js','settlement-guild.js'])
    vm.runInContext(read('src/'+f),ctx,{filename:f});
  return{State,window,e:window.ConquerEconomy,c:window.ConquerCommerce,g:window.ConquerGuild};
}
const produced=h=>Object.values(h.c.state().goods).reduce((a,b)=>a+b,0);
const near=(a,b,msg)=>assert.ok(Math.abs(a-b)<1e-6,msg+' ('+a+' vs '+b+')');
const check=(label,fn)=>{fn();console.log('PASS '+label)};

check('no guild: workshops keep producing 1 unit per workday',()=>{
  const h=harness([3,3]);
  assert.equal(h.g.active(),null);assert.equal(h.g.bonus(),0);
  h.e.tick(-1,4);
  near(produced(h),10,'two shops × five workdays');
});
check('bonus by level: +25/+50/+100% on every L3 workshop of the village',()=>{
  for(const [lvl,bonus] of [[1,.25],[2,.5],[3,1]]){
    const h=harness([3,3],[{id:'g',civicLevel:lvl}]);
    assert.equal(h.g.bonus(),bonus);assert.equal(h.g.seats(),lvl);
    h.e.tick(-1,4);
    near(produced(h),10*(1+bonus),'L'+lvl+' guild');
    for(const s of Object.values(h.c.state().shops))near(s.produced,5*(1+bonus),'per shop at L'+lvl);
  }
});
check('a guild still under construction gives no bonus',()=>{
  const h=harness([3],[{id:'g',civicLevel:3,construction:{completeDay:99}}]);
  assert.equal(h.g.active(),null);
  h.e.tick(-1,4);near(produced(h),5,'unfinished guild');
});
check('only one guild works: highest level, then the oldest id',()=>{
  const h=harness([3],[{id:'g2',civicLevel:2},{id:'g10',civicLevel:2},{id:'g1',civicLevel:1}]);
  assert.equal(h.g.active().id,'g2');assert.equal(h.g.bonus(),.5,'bonuses never stack');
  assert.match(h.g.panelHtml(h.State.structures.find(s=>s.id==='g10')),/Gilda · inattiva/);
  assert.match(h.g.panelHtml(h.State.structures.find(s=>s.id==='g2')),/Gilda · L2 · Archivio dei marchi/);
});
check('officials coverage scales the bonus once ConquerEducated exposes it',()=>{
  const h=harness([3],[{id:'g',civicLevel:3}]);
  h.window.ConquerEducated={coverage:id=>id==='guild.official'?{seats:3,assigned:2,yield:2/3}:null};
  near(h.g.bonus(),.667,'2 of 3 officials');
  h.window.ConquerEducated={coverage:()=>({seats:3,assigned:0,yield:0})};
  assert.equal(h.g.bonus(),0,'no officials, no bonus');
  h.e.tick(-1,4);near(produced(h),5,'output back to the base');
  h.window.ConquerEducated={}; // module loaded without the role registry yet
  assert.equal(h.g.officialYield(),1,'transitional yield');
});
check('Saturday sales and the economy save are unchanged in shape',()=>{
  const h=harness([3,3,4,4],[{id:'g',civicLevel:2}]);
  h.e.tick(-1,5);
  assert.ok(Object.values(h.c.state().week.sold).some(v=>v>0),'goods sold on Saturday');
  assert.equal(h.State.economy.guild,undefined,'phase 1 adds no saved block');
});
check('snapshot, inspector and wiring',()=>{
  const h=harness([3],[{id:'g',civicLevel:1}]);
  h.e.tick(-1,0);
  const d=JSON.parse(JSON.stringify(h.g.snapshot()));
  assert.deepEqual(d,{guilds:1,activeId:'g',level:1,maxBonus:.25,bonus:.25,seats:1,officialYield:1,shops:1});
  const markup=h.g.panelHtml(h.State.structures.find(s=>s.type==='guild'));
  assert.match(markup,/Bonus delle botteghe L3/);assert.match(markup,/\+25%/);
  assert.equal(h.g.panelHtml({type:'church'}),'');
  assert.ok(html.indexOf('settlement-commerce.js')<html.indexOf('settlement-guild.js'),'guild after commerce');
  assert.ok(html.indexOf('settlement-guild.js')<html.indexOf('settlement-app-rooms.js'),'guild before the inspector');
  assert.match(read('camp/index.html'),/settlement-guild\.js/);
  assert.match(read('src/settlement-app-rooms.js'),/ConquerGuild\?\.panelHtml\?\.\(s\)/);
  assert.match(read('src/ui/shell.js'),/GuildPanel/);
  assert.match(read('src/settlement-panels.js'),/kpi\('Gilda'/);
  assert.match(read('src/settlement-commerce.js'),/ConquerGuild\?\.bonus\?\.\(\)/);
  assert.match(read('src/settlement-civic-annexes.js'),/Only one guild hall per village/);
});
console.log('guild-regression: all passed');
