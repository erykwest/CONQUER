'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const ROOT=path.join(__dirname,'..');
const economy=fs.readFileSync(path.join(ROOT,'src/settlement-economy.js'),'utf8');
const core=fs.readFileSync(path.join(ROOT,'src/settlement-core.js'),'utf8');
const routines=fs.readFileSync(path.join(ROOT,'src/settlement-population-routines.js'),'utf8');
const figures=fs.readFileSync(path.join(ROOT,'src/settlement-population-figures.js'),'utf8');
const workCode=core.slice(core.indexOf('const CONSTRUCTION_MAX_WORKERS'),core.indexOf('function pointRadius(s)'));
const commuteCode=routines.slice(routines.indexOf('function constructionWorkerHome(worker)'),routines.indexOf('function residentIdlePoint(anchor'));
const drawingCode=figures.slice(figures.indexOf('function drawPeasants()'),figures.indexOf('function militaryScale()'));
assert.ok(workCode.startsWith('const CONSTRUCTION_MAX_WORKERS'));
assert.ok(commuteCode.startsWith('function constructionWorkerHome'));
assert.ok(drawingCode.startsWith('function drawPeasants'));

const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const hash=id=>{let n=23;for(const ch of String(id))n=(Math.imul(31,n)+ch.charCodeAt(0))>>>0;return n};
function harness({founders=4,houses=0,reachable=true,industry=0}={}){
  const State={clock:{day:0},village:{founded:true,wellId:'well',foundingWorkers:founders},
    structures:[{id:'well',type:'well',x:100,y:100}],resources:{},view:{scale:1},
    policies:{tax:10},dirty:false};
  for(let i=0;i<houses;i++)State.structures.push({id:'h'+i,type:'house',houseLevel:1,x:103+i*2,y:98});
  for(let i=0;i<industry;i++)State.structures.push({id:'industry'+i,type:'loggingCamp',economicOwner:'lord'});
  const window={},drawn=[],paths=[],peasantPathCache=new Map();
  const calendarDateFromDay=day=>{
    const d=new Date(Date.UTC(2026,5,1+day));
    return{year:d.getUTCFullYear(),month:d.getUTCMonth(),day:d.getUTCDate()};
  };
  const context=vm.createContext({
    State,window,clamp,dist,peasantHash:hash,Math,Number,Object,Array,console,
    document:{getElementById:()=>null},calendarDateFromDay,renderUI:()=>{},
    buildDuration:s=>s.workDays??3,
    houseDoorInfo:h=>({outside:{x:h.x+1,y:h.y}}),
    structureAccessPoint:s=>({x:s.x+1.4,y:s.y+.2}),
    roadNetworkPath:(a,b,sourceId)=>{paths.push({a,b,sourceId});return reachable?[a,b]:null},
    peasantSegmentClear:()=>reachable,
    findPeasantPath:()=>null,
    syncPeasantPathCache:()=>{},peasantPathCache,
    routineSmooth:t=>clamp(t,0,1)**2*(3-2*clamp(t,0,1)),
    pointAlongPath:(points,t)=>{
      if(!points?.length)return null;
      const a=points[0],b=points.at(-1),u=clamp(t,0,1);
      return{x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u};
    },
    residentIdlePoint:(p)=>p,
    peasantVisualDay:()=>State.clock.day,
    completedSettlement:type=>State.structures.filter(s=>s.type===type&&!s.construction),
    fieldWorkAssignments:()=>new Map(),housePopulationCapacity:()=>({total:3}),
    houseLevel:h=>h.houseLevel||1,
    villagerClass:()=> 'peasant',
    houseResidents:h=>[{id:h.id+':m:0',sex:'male',age:'adult',index:0,scatterX:0,scatterY:0,lodHash:0}],
    residentClassPosition:()=>null,
    worldPointVisible:()=>true,rotateViewPoint:p=>p,
    villagerHair:()=> 'black',villagerBodyColors:()=>['gray','brown'],
    drawVillagerFigure:dot=>drawn.push(dot),
    drawSoldierFigure:()=>{},
  });
  vm.runInContext(workCode,context,{filename:'construction-work.js'});
  vm.runInContext(economy,context,{filename:'economy.js'});
  vm.runInContext(commuteCode,context,{filename:'construction-commute.js'});
  vm.runInContext(drawingCode,context,{filename:'construction-figures.js'});
  const evalCode=code=>vm.runInContext(code,context);
  function add(id,x=110,y=101){
    State.structures.push({id,type:'tower',x,y,workDays:10});
    evalCode('beginConstruction(State.structures['+(State.structures.length-1)+'])');
    return State.structures.at(-1);
  }
  return{State,window,drawn,paths,evalCode,add,draw:day=>{
    drawn.length=0;State.clock.day=day;evalCode('drawPeasants()');return drawn.slice();
  },tick:(a,b)=>{State.clock.day=b;return evalCode('tickConstructionWork('+a+','+b+')')},
    crew:day=>{State.clock.day=day;return evalCode('constructionCrewAssignments('+day+')')}};
}
function check(name,fn){fn();console.log('✓ '+name)}
function near(a,b,label){assert.ok(Math.abs(a-b)<.01,label+': '+a+' != '+b)}

check('builder crew has stable names and no duplicated founders',()=>{
  const h=harness();h.add('tower-a');
  const list=h.crew(.30).get('tower-a');
  assert.equal(list.length,3);
  assert.equal(new Set(list.map(w=>w.id)).size,3);
  assert.deepEqual(Array.from(list,w=>w.id),['founder:well:0','founder:well:1','founder:well:2']);
  const figures=h.draw(.30);
  assert.equal(figures.length,4,'three at work, one idle at the well');
  for(const worker of list){
    const dot=figures.find(d=>d.id===worker.id);
    assert.ok(dot,'construction worker should be rendered');
    assert.ok(dot.p.x>105,'worker should walk to the actual site');
  }
});
check('morning walk, working at site, and evening return are distinct',()=>{
  const h=harness({founders:1}),site=h.add('tower-b',110,101);
  const id=h.crew(.30).get(site.id)[0].id;
  const morning=h.draw(.10).find(d=>d.id===id).p;
  const working=h.draw(.30).find(d=>d.id===id).p;
  const evening=h.draw(.59).find(d=>d.id===id).p;
  assert.ok(morning.x<working.x,'worker travels outward');
  assert.ok(evening.x<working.x,'worker travels home after shift');
  assert.ok(h.paths.length>=1);
});
check('idle house worker is physically represented on route to work',()=>{
  const h=harness({founders:1,houses:1}),site=h.add('tower-b',111,100);
  const names=h.crew(.3).get(site.id).map(w=>w.id);
  assert.ok(names.includes('h0:m:0'));
  const dot=h.draw(.3).find(d=>d.id==='h0:m:0');
  assert.ok(dot?.p.x>105,'resident worker has reached site from house');
});
check('industrial jobs reserve founders and they do not remain idle at the well',()=>{
  const h=harness({founders:4,industry:1}),site=h.add('tower-c');
  const crew=h.crew(.3).get(site.id);
  assert.deepEqual(Array.from(crew,w=>w.id),['founder:well:2','founder:well:3']);
  // Low wood: the camp keeps its two loggers, who walk to it like builders.
  assert.equal(h.draw(.3).length,4,'two at construction, two commuting to the logging camp');
});
check('unreachable construction stops instead of teleporting builders',()=>{
  const h=harness({founders:2,reachable:false}),site=h.add('tower-d');
  assert.equal(h.crew(.3).get(site.id).length,0);
  const rendered=h.draw(.3);
  assert.equal(rendered.length,2,'unassigned founders remain at well');
  h.tick(0,.52);
  assert.equal(site.construction.workDone,0,'no progress without reachable path');
});
check('shepherd L1s remain on livestock duty rather than appearing at construction',()=>{
  const h=harness({founders:0,houses:1});
  h.window.ConquerLivestock={lotKindForHouse:()=> 'shepherd'};
  const site=h.add('tower-shepherd');
  assert.equal(h.window.ConquerEconomy.availableBuilders(),0);
  assert.equal(h.crew(.3).get(site.id)?.length||0,0);
  h.tick(0,.52);
  assert.equal(site.construction.workDone,0);
});
check('route cache is reused and assignments do not leak into Saturday',()=>{
  const h=harness({founders:1}),site=h.add('tower-e');
  h.draw(.3);const calls=h.paths.length;
  h.draw(.35);
  assert.equal(h.paths.length,calls,'cached pedestrian route reused');
  assert.equal(h.crew(5.3).get(site.id)?.length||0,0);
});
console.log('Construction commute regression: all checks passed.');
