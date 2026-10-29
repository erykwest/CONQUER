'use strict';
// Deterministic tests for adult male weekday evening and weekend social routes.
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const code=fs.readFileSync(path.join(root,'src/settlement-population-male.js'),'utf8');
const residents=fs.readFileSync(path.join(root,'src/settlement-population-residents.js'),'utf8');
const T={id:'inn',type:'tavern',x:20,y:0};
const M={id:'market',type:'market',x:10,y:0};
const C={id:'church',type:'church',x:30,y:0};
const W={id:'well',type:'well',x:40,y:0};
function fixture(places=[T,M,C,W],blocked=[]){
  const house={id:'h',type:'house',houseLevel:1,x:0,y:0};
  const State={clock:{day:0},structures:[house,...places]};
  const window={ConquerEconomy:{weekday:d=>((Math.floor(d)%7)+7)%7}};
  const visits={paths:0};
  const context=vm.createContext({State,window,Math,Array,Object,Number,Map,urbanRevision:1,
    houseLevel:h=>h.houseLevel,houseDoorInfo:h=>({outside:{x:h.x+.2,y:h.y}}),
    underConstruction:s=>!!s.constructing,
    peasantHash:s=>[...String(s)].reduce((v,c)=>(v*33+c.charCodeAt(0))>>>0,0),
    structureAccessPoint:s=>({x:s.x,y:s.y}),
    wellApproachPath:(h,s)=>[{x:h.x+.2,y:h.y},{x:s.x-.9,y:s.y}],
    villagerPathBetween:(_h,a,b)=>{visits.paths++;return blocked.some(x=>Math.abs(b.x-x.x)<.001)
      ?[a]:[a,b]},
    dist:(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),
    routineTravel:(_h,a,b,f,t0,t1)=>{
      const u=Math.max(0,Math.min(1,(f-t0)/(t1-t0)));
      return{x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u};
    },
    residentIdlePoint:p=>p
  });
  vm.runInContext(code,context,{filename:'settlement-population-male.js'});
  return {male:window.ConquerMaleRoutines,State,house,window,context,visits};
}
const man={id:'h:m:0',sex:'male',age:'adult',index:0};
const check=(label,fn)=>{fn();console.log('PASS '+label)};
check('every L1-L4 man works normally Mon-Fri until exactly 18:00',()=>{
  const {male}=fixture();
  for(let tier=1;tier<=4;tier++)for(let day=0;day<5;day++){
    assert.equal(male.activity(tier,day,.4),'regular');
    assert.equal(male.activity(tier,day,.749999),'regular');
    assert.equal(male.activity(tier,day,.75),'leisure male');
    assert.equal(male.activity(tier,day,.85),'leisure male');
    assert.equal(male.activity(tier,day,.96),'home');
  }
  assert.equal(male.handles(.749),false);
  assert.equal(male.handles(.75),true);
});
check('Saturday morning market, Sunday morning church, both afternoons leisure male',()=>{
  const {male}=fixture();
  for(let tier=1;tier<=4;tier++){
    assert.equal(male.activity(tier,5,.25),'market');
    assert.equal(male.activity(tier,6,.25),'church');
    assert.equal(male.activity(tier,5,.55),'leisure male');
    assert.equal(male.activity(tier,6,.55),'leisure male');
    assert.equal(male.activity(tier,5,.83),'home');
  }
  assert.equal(male.handles(5.01),true);
  assert.equal(male.handles(6.01),true);
});
check('evening leisure heads to completed tavern and then back home',()=>{
  const h=fixture();
  assert.equal(h.male.position(h.house,man,.81).x,20);
  assert.equal(h.male.position(h.house,man,.87).x,20);
  assert.ok(h.male.position(h.house,man,.94).x<20);
  assert.equal(h.male.position(h.house,man,.97),null);
});
check('Saturday market, Sunday church, afternoon inn; no work on Sunday',()=>{
  const h=fixture();
  assert.equal(h.male.position(h.house,man,5.25).x,10);
  assert.equal(h.male.position(h.house,man,6.25).x,30);
  assert.equal(h.male.position(h.house,man,5.61).x,20);
  assert.equal(h.male.position(h.house,man,6.61).x,20);
});
check('without tavern the male leisure registry falls back to public plaza then well',()=>{
  const a=fixture([M,C,W]);
  assert.equal(a.male.position(a.house,man,.85).x,10);
  const b=fixture([C,W]);
  assert.equal(b.male.position(b.house,man,.85).x,39.1);
  assert.deepEqual([...b.male.LEISURE_VENUES],['tavern','market','well']);
});
check('unreachable completed tavern is skipped without teleport; unfinished tavern is skipped',()=>{
  const a=fixture([T,M,W],[T]);
  assert.equal(a.male.position(a.house,man,.85).x,10);
  const b=fixture([{...T,constructing:true},M,W]);
  assert.equal(b.male.position(b.house,man,.85).x,10);
});
check('without weekend market or church the morning is empty, not replaced with a tavern',()=>{
  const h=fixture([T,W]);
  assert.equal(h.male.position(h.house,man,5.25),null);
  assert.equal(h.male.position(h.house,man,6.25),null);
  assert.equal(h.male.position(h.house,man,6.61).x,20);
  const z=fixture([]);
  assert.equal(z.male.position(z.house,man,.85),null);
});
check('destination cache avoids repeated path searches and is invalidated on topology change',()=>{
  const h=fixture();
  h.male.position(h.house,man,.82);
  const count=h.visits.paths;
  h.male.position(h.house,man,.87);
  assert.equal(h.visits.paths,count);
  h.context.urbanRevision++;
  h.male.position(h.house,man,.87);
  assert.ok(h.visits.paths>count);
});
check('resident dispatch keeps day jobs before 18:00, overrides them on weekends and evenings',()=>{
  const State={clock:{day:.32},structures:[]};
  const window={
    ConquerEconomy:{weekday:d=>((Math.floor(d)%7)+7)%7},
    ConquerMaleRoutines:{handles:d=>((Math.floor(d)%7)+7)%7>=5||d%1>=.75,
      position:()=>({x:99,y:0})},
    ConquerFemaleRoutines:{position:()=>({x:81,y:0})}
  };
  const ctx=vm.createContext({State,window,Map,Math,Number,Object,Array,
    houseLevel:h=>h.houseLevel,peasantHash:()=>12345,
    artisanPosition:()=>({x:21,y:0}),merchantPosition:()=>({x:31,y:0}),
    elitePosition:()=>({x:41,y:0})});
  vm.runInContext(residents,ctx,{filename:'settlement-population-residents.js'});
  const run=(tier,person)=>vm.runInContext('residentClassPosition('+JSON.stringify({id:'h',houseLevel:tier})+
    ','+JSON.stringify(person)+',State.clock.day,null)',ctx);
  // L1 builders and loggers are drawn by the construction commute in drawPeasants.
  assert.equal(run(1,man),null,'an L1 without field work stays out of the leisure cycle on weekday mornings');
  assert.equal(run(2,man).x,21,'original L2 cycle must survive on weekday mornings');
  assert.equal(run(3,man).x,31,'original L3 cycle must survive on weekday mornings');
  assert.equal(run(4,man).x,41,'original L4 cycle must survive on weekday mornings');
  for(const time of [.76,5.25,6.25]){
    State.clock.day=time;
    for(let tier=1;tier<=4;tier++)assert.equal(run(tier,man).x,99);
  }
  const woman={...man,sex:'female'};
  assert.equal(run(1,woman).x,81,'female routine must be unaffected');
  const child={...man,age:'child'};
  assert.equal(run(1,child),null,'children retain Sunday rest');
});
console.log('Male routines regression: PASS');
