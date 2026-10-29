'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const moduleText=fs.readFileSync(path.join(root,'src/settlement-messages.js'),'utf8');
function fixture(){
  const State={clock:{day:0},view:{scale:1},seed:17,village:{founded:true,name:'Roccaluce'},
    structures:[{type:'tower',x:100,y:100,functions:['pigeonLoft'],destroyed:false}],
    resources:{gold:120,food:42,wood:11,stone:22,metal:2,population:15},
    economy:{castleGold:90,castle:{food:37,wood:10,stone:20,metal:1}},messages:null};
  let saves=0;
  const window={__CONQUER_ASSET_LAB__:true,ConquerSiege:{mastio:()=>State.structures[0]}};
  const context={window,State,document:{getElementById:()=>null},console,
    currentWeather:()=>({kind:'clear'}),calendarDateFromDay:d=>({name:'Giu',day:Math.floor(d)+1,year:1}),
    underConstruction:()=>false,markDirty(){},scheduleLocalSave(){saves++},
    WORLD:200,ensureBorderEntrySelection:()=>[{edge:'north',x:100,y:0}],
    w2s:p=>p,w2sRaw:p=>p,worldPointVisible:()=>true,soldierLivery:()=>null};
  vm.runInNewContext(moduleText,context);
  return{State,window,api:window.ConquerMessages,saves:()=>saves};
}
{
  const {State,api}=fixture();
  assert.equal(api.hasLoft('court'),true);
  assert.match(api.transport('court','north','pigeon').error,/piccionaie/);
  api.setProvinceLoft('north',true);
  assert.equal(api.transport('court','north','pigeon').type,'pigeon');
  const l=api.send({from:'court',to:'north',kind:'order',title:'Mobilita',body:'Riunisci la guarnigione',carrier:'pigeon'});
  assert.equal(l.status,'transit');
  assert.ok(l.arrivalDay>l.sentDay);
  const t=l.arrivalDay;
  State.clock.day=t-.01;api.tick(0,t-.01);assert.equal(l.status,'transit');
  State.clock.day=t+.01;api.tick(t-.01,t+.01);assert.equal(l.status,'delivered');
  const m=api.send({from:'north',to:'court',title:'Attacco',body:'Minaccia in arrivo',kind:'alert',carrier:'messenger'});
  assert.equal(api.read(m.id),false,'in-transit mail must not be readable');
  State.clock.day=m.arrivalDay+.1;api.tick(t,m.arrivalDay+.1);
  assert.equal(m.status,'delivered');assert.equal(api.read(m.id).read,true);
}
{
  const {State,api}=fixture();
  const l=api.send({from:'court',to:'south',title:'Rapporto',body:'Dato al momento di invio'});
  assert.equal(l.carrier,'messenger');
  State.resources.gold=0;
  assert.equal(l.body,'Dato al momento di invio','letters cannot mutate in transit');
  assert.match(api.report('court',['economy','construction']),/oro 90/);
  assert.match(api.report('north',['economy']),/non disponibili/,'abstract neighbors must not invent stocks');
  assert.equal(api.send({from:'north',to:'south',title:'X',body:'Y'}).error.includes('World Map'),true);
  State.village.founded=false;
  assert.match(api.send({from:'court',to:'north',title:'X',body:'Y'}).error,/Fondare/);
}
{
  const {State,api,saves}=fixture();
  const r=api.addRoutine({from:'court',to:'north',carrier:'messenger',everyDays:7,categories:['economy','security']});
  assert.equal(r.nextDay,7);
  State.clock.day=6;api.tick(0,6);assert.equal(api.state().letters.length,0);
  State.clock.day=8;api.tick(6,8);
  assert.equal(api.state().letters.length,1);
  assert.equal(api.state().letters[0].sentDay,8,'report stamps actual simulation day');
  assert.equal(api.state().letters[0].routineId,r.id);
  assert.equal(r.nextDay,14);
  State.clock.day=92;api.tick(8,92);
  assert.equal(api.state().letters.length,2,'skipped time does not invent historical reports');
  assert.ok(r.nextDay>92);
  assert.ok(saves()>0);
  assert.equal(api.setRoutineEnabled(r.id,false),true);
  State.clock.day=150;api.tick(92,150);assert.equal(api.state().letters.length,2);
  api.reset();assert.equal(api.state().letters.length,0);assert.equal(api.state().routines.length,0);
}
{
  const {api}=fixture();
  assert.match(api.addRoutine({from:'court',to:'north',everyDays:3,carrier:'messenger',categories:['economy']}).error,/frequenza/);
  assert.match(api.send({from:'court',to:'bad',title:'X',body:'Y'}).error,/non valida/);
  assert.equal(api.hasLoft('east'),false);
}
{
  const {State,window,api}=fixture();
  const calls=[];
  window.ConquerMounted2D={draw:(g,x,y,size,opts)=>calls.push({x,y,opts})};
  window.ConquerAnimals={};window.ConquerLOD={militaryTier:()=>'full'};
  const m=api.send({from:'north',to:'court',title:'Corriere',body:'Sul cammino',carrier:'messenger'});
  State.clock.day=(m.sentDay+m.arrivalDay)/2;
  api.draw({});
  assert.equal(calls.length,1,'messenger must appear on the local road leg');
  assert.equal(calls[0].opts.kind,'messenger');
  assert.ok(Number.isFinite(calls[0].x)&&Number.isFinite(calls[0].y));
}
const core=fs.readFileSync(path.join(root,'src/settlement-core.js'),'utf8');
const siege=fs.readFileSync(path.join(root,'src/settlement-siege.js'),'utf8');
const runtime=fs.readFileSync(path.join(root,'src/settlement-app-simulation.js'),'utf8');
const persist=fs.readFileSync(path.join(root,'src/settlement-app-persistence.js'),'utf8');
const page=fs.readFileSync(path.join(root,'index.html'),'utf8');
assert.match(core,/pigeonLoft:'Piccionaia'/);
assert.match(siege,/if\(fn==='pigeonLoft'\)/);
assert.match(runtime,/ConquerMessages\?\.tick\(simLogicDay,State\.clock\.day\)/);
assert.match(persist,/messages:State\.messages\|\|null/);
assert.match(persist,/State\.messages=x\.messages\|\|null/);
assert.match(persist,/State\.messages=cloudPolicies\.messages\|\|null/);
assert.match(page,/settlement-messages\.js/);
assert.match(fs.readFileSync(path.join(root,'src/settlement-combat.js'),'utf8'),/ConquerMessages\?\.draw\(g\)/);
assert.match(page,/id="messagesOpen"/);
assert.match(fs.readFileSync(path.join(root,'src/settlement-app-calendar-ui.js'),'utf8'),/ConquerMessages\?\.reset/);
console.log('Feudal postal network regression: PASS');
