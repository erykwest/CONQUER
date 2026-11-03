'use strict';
// VM regression: L1-L4 women's weekly routines and real settlement destinations.
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const female=fs.readFileSync(path.join(root,'src/settlement-population-female.js'),'utf8');
const residents=fs.readFileSync(path.join(root,'src/settlement-population-residents.js'),'utf8');
const W={id:'well',type:'well',x:50,y:0};
const M={id:'market',type:'market',x:25,y:0};
const C={id:'church',type:'church',x:30,y:0};
function fixture(structures=[M,C,W],kind='garden'){
  const H={id:'house',type:'house',houseLevel:1,x:0,y:0};
  const S={clock:{day:0},structures:[H,...structures]};
  const lots=[{id:'lot:house',houseId:H.id,points:[{x:-3,y:-3},{x:3,y:-3},{x:3,y:3},{x:-3,y:3}]}];
  const calls={paths:0};
  const win={ConquerEconomy:{weekday:d=>((Math.floor(d)%7)+7)%7},
    ConquerLivestock:{lotKindForHouse:()=>kind}};
  const ctx=vm.createContext({State:S,window:win,urbanRevision:0,console,Map,Math,Number,Object,Array,
    houseLevel:h=>h.houseLevel,
    houseDoorInfo:h=>({outside:{x:h.x+.2,y:h.y}}),
    underConstruction:s=>!!s.constructing,
    urbanLots:()=>lots,
    urbanContains:(poly,p)=>p.x>-3&&p.x<3&&p.y>-3&&p.y<3,
    pointBlockedForPeasant:()=>false,
    peasantHash:s=>{let n=0;for(const c of String(s))n=(n*33+c.charCodeAt(0))>>>0;return n},
    nearestCompletedStructure:(type,from)=>S.structures.filter(s=>s.type===type&&!s.constructing)
      .sort((a,b)=>Math.hypot(a.x-from.x,a.y-from.y)-Math.hypot(b.x-from.x,b.y-from.y))[0]||null,
    structureAccessPoint:s=>({x:s.x,y:s.y}),
    wellApproachPath:(house,s)=>[{x:house.x+.2,y:house.y},{x:s.x-.9,y:s.y}],
    villagerPathBetween:(_h,from,to)=>{calls.paths++;return [from,to]},
    dist:(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),
    routineTravel:(_h,a,b,t,t0,t1)=>{
      const f=Math.max(0,Math.min(1,(t-t0)/(t1-t0)));
      return{x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f};
    },
    residentIdlePoint:p=>p
  });
  vm.runInContext(female,ctx,{filename:'settlement-population-female.js'});
  return{female:win.ConquerFemaleRoutines,S,H,ctx,calls};
}
const check=(label,fn)=>{fn();console.log('PASS '+label)};
check('L1/L2 weekdays: own plot work until noon then leisure Female',()=>{
  const {female}=fixture();
  for(const tier of [1,2])for(let dow=0;dow<5;dow++){
    assert.equal(female.activity(tier,dow,.15),'lot');
    assert.equal(female.activity(tier,dow,.499),'lot');
    assert.equal(female.activity(tier,dow,.5),'leisure Female');
  }
});
check('L1/L2: Saturday market morning, Sunday church morning; leisure afternoons',()=>{
  const {female}=fixture();
  for(const tier of [1,2]){
    assert.equal(female.activity(tier,5,.25),'market');
    assert.equal(female.activity(tier,6,.25),'church');
    assert.equal(female.activity(tier,5,.55),'leisure Female');
    assert.equal(female.activity(tier,6,.55),'leisure Female');
  }
});
check('L3: morning market Monday through Saturday; Sunday church; then leisure',()=>{
  const {female}=fixture();
  for(let d=0;d<6;d++)assert.equal(female.activity(3,d,.25),'market');
  assert.equal(female.activity(3,6,.25),'church');
  for(let d=0;d<7;d++)assert.equal(female.activity(3,d,.58),'leisure Female');
});
check('L4: leisure on normal mornings; weekend market / mass before leisure',()=>{
  const {female}=fixture();
  for(let d=0;d<5;d++)assert.equal(female.activity(4,d,.25),'leisure Female');
  assert.equal(female.activity(4,5,.25),'market');
  assert.equal(female.activity(4,6,.25),'church');
  assert.equal(female.activity(4,6,.55),'leisure Female');
  assert.equal(female.activity(4,2,.08),'leisure Female');
});
check('real village plot: L1 female works inside Voronoi lot and socialises at closest garden',()=>{
  const h=fixture();
  const resident={id:'woman',sex:'female',age:'adult',index:0};
  const a=h.female.position(h.H,resident,.25);
  assert.ok(a&&Math.abs(a.x)<3&&Math.abs(a.y)<3,'workplace is in her lot');
  const p=h.female.position(h.H,resident,.59);
  assert.ok(p&&Math.abs(p.x)<3&&Math.abs(p.y)<3,'nearest garden beats distant public plaza');
  const before=h.calls.paths;
  h.female.position(h.H,resident,.60);
  assert.equal(h.calls.paths,before,'cached destinations avoid per-frame path generation');
});
check('weekend market and church destinations are respected, not conflated with leisure',()=>{
  const h=fixture();const resident={id:'woman',sex:'female',age:'adult',index:0};
  h.S.clock.day=5.25;
  const market=h.female.position(h.H,resident,5.25);
  assert.equal(market.x,M.x);
  h.S.clock.day=6.25;
  const church=h.female.position(h.H,resident,6.25);
  assert.equal(church.x,C.x);
});
check('absent market/church never teleports to another target; afternoon leisure still works',()=>{
  const h=fixture([W], 'cow');const resident={id:'woman',sex:'female',age:'adult',index:0};
  assert.equal(h.female.position(h.H,resident,5.25),null);
  assert.equal(h.female.position(h.H,resident,6.25),null);
  assert.ok(h.female.position(h.H,resident,6.59));
});
check('resident dispatcher sends adult females to new cycle even on Sunday, not men',()=>{
  const S={clock:{day:6.25},structures:[]};
  const win={ConquerEconomy:{weekday:()=>6},ConquerFemaleRoutines:{position:()=>({x:123,y:456})}};
  const ctx=vm.createContext({State:S,window:win,Map,Math,Number,Object,Array,
    houseLevel:h=>h.houseLevel,peasantHash:()=>123456});
  vm.runInContext(residents,ctx,{filename:'settlement-population-residents.js'});
  const adult={id:'f',sex:'female',age:'adult',index:0};
  for(const tier of [1,2,3,4]){
    const house={id:'h'+tier,houseLevel:tier};
    assert.deepEqual(JSON.parse(JSON.stringify(vm.runInContext(
      'residentClassPosition('+JSON.stringify(house)+','+JSON.stringify(adult)+',6.25,null)',ctx))),
      {x:123,y:456});
    assert.equal(vm.runInContext('residentClassPosition('+JSON.stringify(house)+','+
      JSON.stringify({...adult,sex:'male'})+',6.25,null)',ctx),null);
  }
});
console.log('Female routines regression: PASS');
