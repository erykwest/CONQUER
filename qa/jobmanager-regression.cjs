'use strict';
// Deterministic VM regression for L1 job allocation and work-driven construction.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../src/settlement-jobmanager.js'),'utf8');
const house=(id,tier=1,x=0,kind='garden')=>({id,type:'house',houseLevel:tier,x,y:0,kind});
const build=(id,duration=2,x=3)=>({id,type:'tower',x,y:0,size:1,
  construction:{startedDay:0,workRequired:duration,workDone:0,priority:1}});
function harness(structures,food=0,wood=0){
  const state={clock:{day:0},structures};
  const ledger={castle:{food,wood},lots:{food:[],wood:[]},target:{food:100,wood:70}};
  const window={
    ConquerEconomy:{state:()=>ledger},
    ConquerLivestock:{lotKindForHouse:h=>h.kind},
    ConquerCombat:{alarmMode:()=>'off'}
  };
  const ctx=vm.createContext({State:state,window,console,Math,Number,Object,
    houseLevel:h=>h.houseLevel||1,
    constructionProgress:s=>!s.construction?1:s.construction.workRequired!=null
      ?s.construction.workDone/s.construction.workRequired
      :Math.max(0,Math.min(1,(state.clock.day-s.construction.startedDay)/
        (s.construction.completeDay-s.construction.startedDay))),
    buildDuration:()=>2,
    houseDoorInfo:h=>({outside:{x:h.x,y:0}}),
    structureAccessPoint:s=>({x:s.x+1,y:0}),
    structureCenter:s=>({x:s.x,y:s.y}),
    villagerPathBetween:(h,a,b)=>[a,b],
    pointAlongPath:(points,t)=>({x:points[0].x+(points.at(-1).x-points[0].x)*t,y:0}),
    residentIdlePoint:p=>p,
    fieldLayout:()=>({cells:[{},{}]})
  });
  vm.runInContext(source,ctx,{filename:'settlement-jobmanager.js'});
  return{j:window.ConquerJobManager,state,ledger,window};
}
function check(label,fn){fn();console.log('PASS '+label)}
check('no L1 means no construction progress, even after days',()=>{
  const site=build('site');
  const h=harness([site,house('artisan',2)]);
  h.j.tick(0,2.6);
  assert.equal(site.construction.workDone,0);
  assert.equal(h.j.summary().building,0);
});
check('a single L1 progresses the construction only during a weekday work shift',()=>{
  const site=build('site');
  const h=harness([house('worker'),site],1000,1000);
  h.j.tick(0,.14);assert.equal(site.construction.workDone,0);
  h.j.tick(.14,.52);assert.ok(Math.abs(site.construction.workDone-1)<1e-9);
  h.j.tick(4.9,6.9);assert.ok(Math.abs(site.construction.workDone-1)<1e-9);
  h.j.tick(7.14,7.52);assert.equal(site.construction.workDone,2);
});
check('food reserve protects herders from every construction site',()=>{
  const people=[house('a',1,0,'goat'),house('b',1,1,'shepherd'),house('c',1,2,'goat'),
    house('d',1,3,'garden'),house('e',1,4,'garden')];
  const site=build('site',20);
  const h=harness([...people,site]);
  const p=h.j.plan();
  assert.ok(p.herdReserve>=1);
  for(const person of people.slice(0,p.herdReserve))
    assert.equal(p.assigned.get(person.id).kind,'herding');
  assert.ok(p.builders<=people.length-p.herdReserve);
});
check('food reserves relax with stock, and unused L1 can log',()=>{
  const camp={id:'camp',type:'loggingCamp',x:2,y:0};
  const h=harness([house('a',1,0,'goat'),house('b',1,1,'garden'),house('c',1,3,'garden'),camp],
    1000,0);
  const p=h.j.plan();
  assert.equal(p.herdReserve,1);
  assert.equal(p.staffing.camp,2);
  assert.equal(p.builders,0);
});
check('mining and fields are exclusively L2; L1 never claims field slots',()=>{
  const f={id:'field',type:'field',x:2,y:0};
  const q={id:'mine',type:'mine',x:3,y:0};
  const h=harness([house('l1'),house('l2a',2),house('l2b',2),f,q],1000,1000);
  const p=h.j.plan();
  assert.equal(p.staffing.mine,2);
  assert.equal(p.staffing.field,0);
  assert.equal(p.assigned.get('l1').kind,'idle');
});
check('cancel/reprioritize and a second site redistribute remaining workforce',()=>{
  const a=build('a',20,4),b=build('b',20,7);
  const h=harness([house('worker'),a,b],1000,1000);
  assert.equal(h.j.plan().assigned.get('worker').siteId,'a');
  h.j.setPriority('b',2);
  assert.equal(h.j.plan().assigned.get('worker').siteId,'b');
  h.state.structures=h.state.structures.filter(s=>s!==b);h.j.invalidate();
  assert.equal(h.j.plan().assigned.get('worker').siteId,'a');
});
check('old saved completion dates migrate to fractional work, not free progress',()=>{
  const s={id:'legacy',type:'tower',x:2,y:0,construction:{startedDay:0,completeDay:10}};
  const h=harness([house('worker'),s],1000,1000);
  h.j.adopt(s,4);
  assert.equal(s.construction.workRequired,10);
  assert.equal(s.construction.workDone,4);
  assert.equal(s.construction.completeDay,undefined);
});
check('alarm suspends workers and stops construction',()=>{
  const s=build('site');
  const h=harness([house('worker'),s],1000,1000);
  h.window.ConquerCombat.alarmMode=()=>'mobilize';
  h.j.tick(0,.52);assert.equal(s.construction.workDone,0);
});
console.log('Job Manager regression checks passed.');
