'use strict';
// Secondary (access) roads: every building with an entrance is linked to the main road network
// when it is completed, on reload and by the maintenance reconcile. Production sites (logging
// camp, quarry, clay pit, mine, mills) and storage yards used to be skipped by a hard-coded
// house/field/civic whitelist. This audits every placeable type against structureNeedsAccessRoad.
const fs=require('node:fs');
const harness=fs.readFileSync(__dirname+'/urban-regression.cjs','utf8').split('let passed=0;')[0];
eval(harness+`
run(fs.readFileSync(__dirname+'/../src/settlement-util.js','utf8'));
run(fs.readFileSync(__dirname+'/../src/settlement-industries.js','utf8'));
let passed=0;
function check(name,body){body();passed++;console.log('PASS '+name)}

// Types that MUST produce an access road once completed.
const MUST_HAVE_ROAD=['house','field','market','tavern','church','training','plaza','townhall','guild','bargello','balivo',
  'storageYard','loggingCamp','quarry','clayPit','mine','windmill','watermill'];
// Placeable types served by another road rule (with the reason).
const EXEMPT={
  tower:'own service branch (secondary-tower)',
  gate:'own main road through the passage',
  well:'own main road to the founding well',
  civicAnnex:'attached to its civic parent, which owns the access road'
};

check('every placeable point building is either road-linked or explicitly exempt',()=>{
  const app=fs.readFileSync(__dirname+'/../src/settlement-app.js','utf8');
  const m=app.match(/const points=State\\.structures\\.filter\\(s=>!s\\.auto&&\\[([^\\]]+)\\]/);
  assert.ok(m,'placeable point list found in structureAt');
  const placeable=m[1].split(',').map(t=>t.trim().replace(/'/g,''));
  const industries=Object.keys(run('window.ConquerIndustries.TYPES'));
  for(const t of [...new Set([...placeable,...industries,'house','field'])]){
    const needs=run('structureNeedsAccessRoad')({type:t});
    if(EXEMPT[t]){assert.equal(needs,false,t+' is exempt: '+EXEMPT[t]);continue}
    assert.equal(needs,true,t+' must get a secondary road');
    assert.ok(MUST_HAVE_ROAD.includes(t),t+' is listed in MUST_HAVE_ROAD');
  }
});

function make(type){
  const p={x:107,y:106};
  if(type==='house')return{type,auto:true,x:p.x,y:p.y,w:1.5,h:1,angle:0,doorSide:-1};
  if(type==='field')return{type,auto:true,x:p.x,y:p.y,w:3,h:2,angle:0};
  if(type==='storageYard')return{type,x:p.x,y:p.y,w:2,h:2,angle:0};
  if(type==='clayPit')return run('window.ConquerIndustries.make')('quarry',p,'clay');
  if(run('window.ConquerIndustries.TYPES')[type])return run('window.ConquerIndustries.make')(type,p);
  return{type,x:p.x,y:p.y,angle:0,level:1};
}
function fixture(s){
  sandbox.__probe={id:'probe',...s};
  run("State.environment=[];State.relief=null;State.village={founded:true,wellId:'well',roadPlan:[]};"+
    "State.structures=[{id:'well',type:'well',x:100,y:100},"+
    "{id:'trunk',type:'road',routeId:'manual-main:trunk',a:{x:100,y:100},b:{x:125,y:100},width:.62},__probe];"+
    "State.village.roadPlan=[];invalidateNavigation()");
}
const accessRoads=()=>run("State.structures.filter(r=>r.type==='road'&&r.accessFor==='probe')");

check('every road-linked type gets a secondary road when reconciled',()=>{
  for(const type of MUST_HAVE_ROAD){
    fixture(make(type));
    run('reconcileSettlementAccessRoads(Infinity,true)');
    const roads=accessRoads();
    assert.ok(roads.length>0,type+' has a secondary road');
    // The road joins the main network...
    assert.ok(roads.some(r=>Math.abs(r.a.y-100)<.3||Math.abs(r.b.y-100)<.3),type+' road reaches the main road');
    // ...and starts at the building, not somewhere in the open.
    const s=sandbox.__probe,near=Math.min(...roads.flatMap(r=>[r.a,r.b]).map(p=>Math.hypot(p.x-s.x,p.y-s.y)));
    assert.ok(near<=Math.hypot(Number(s.w)||3,Number(s.h)||3),type+' road starts at its footprint ('+near.toFixed(2)+')');
  }
});

check('industry and storage-yard roads start just outside the footprint edge facing the road',()=>{
  for(const type of ['storageYard','loggingCamp','quarry','clayPit','mine','windmill','watermill']){
    const s=make(type);fixture(s);
    const p=run('settlementRoadAccessPoint')(sandbox.__probe,{x:s.x,y:100});
    const spec=run('window.ConquerIndustries.definition')(sandbox.__probe);
    const h=Number(s.h)||spec.h;
    assert.ok(Math.abs(p.x-s.x)<1e-6,type+' entrance on the road side');
    assert.ok(Math.abs((s.y-p.y)-(h/2+.28))<1e-6,type+' entrance just outside the edge');
  }
});

check('completed production sites are scheduled for their access road',()=>{
  const sim=fs.readFileSync(__dirname+'/../src/settlement-app-simulation.js','utf8');
  assert.ok(/for\\(const s of completed\\)if\\(structureNeedsAccessRoad\\(s\\)\\)add\\('access',s\\)/.test(sim),'completion job uses the shared rule');
  assert.ok(!/s\\.type==='house'\\|\\|s\\.type==='field'\\|\\|isCivic\\(s\\)/.test(sim),'no hard-coded house/field/civic whitelist left');
  // Reload and maintenance reconcile walk the same rule.
  fixture(make('mine'));
  assert.equal(run('settlementAccessTargets().map(s=>s.id).join()'),'probe');
});

check('exempt types never get a settlement access road',()=>{
  fixture({type:'tower',x:107,y:106,shape:'square',size:1.5,angle:0});
  run('reconcileSettlementAccessRoads(Infinity,true)');
  assert.equal(accessRoads().filter(r=>r.roadClass==='access-primary').length,0);
});
console.log(passed+' access-road checks passed');
`);
