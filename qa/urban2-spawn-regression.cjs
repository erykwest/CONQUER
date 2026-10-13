'use strict';
// Guards the first lost URBAN 2 fixes: cached spawn, fields-first growth and
// parcel/field non-overlap. Uses the same real runtime harness as other QA.
const fs=require('node:fs');
const harness=fs.readFileSync(__dirname+'/urban-regression.cjs','utf8').split('let passed=0;')[0];
const check=new Function('require','__dirname',harness+`
let passed=0;
function test(name,body){body();passed++;console.log('PASS '+name)}
function fixture(){
 run("State.seed=12345;State.clock.day=0;State.environment=[];State.relief=null;State.structures=[{id:'well',type:'well',x:100,y:100}];State.village={founded:true,wellId:'well',growthStep:0};State.combat.strokes=[];State.combat.units=[];State.combat.enemy=[];invalidateUrbanGeometry();invalidateNavigation()");
}
test('house Voronoi parcels never consume existing field polygons',()=>{
 fixture();
 run("globalThis.qaField={id:'farm',type:'field',auto:true,x:106,y:104,points:[{x:104,y:102},{x:108,y:102},{x:108,y:106},{x:104,y:106}]};State.structures.push(qaField);invalidateUrbanGeometry()");
 assert.equal(run("urbanParcelAllowed([{x:105,y:103},{x:109,y:103},{x:109,y:107},{x:105,y:107}],'new-home')"),false);
 assert.equal(run("urbanParcelAllowed([{x:110,y:108},{x:112,y:108},{x:112,y:110},{x:110,y:110}],'new-home')"),true);
});
test('candidate house evaluation reuses one live-occupant snapshot and original lot cache',()=>{
 fixture();
 run("globalThis.origOccupants=urbanSpawnOccupants;globalThis.qaOccupantCalls=0;urbanSpawnOccupants=()=>{qaOccupantCalls++;return[]};globalThis.spawnContext=urbanHouseSpawnContext();");
 try{
  assert.equal(run("urbanHouseFitsLots({id:'first',type:'house',x:105,y:104,w:1.5,h:1,angle:0},spawnContext)"),true);
  assert.equal(run("urbanHouseFitsLots({id:'second',type:'house',x:111,y:104,w:1.5,h:1,angle:0},spawnContext)"),true);
  assert.equal(run("qaOccupantCalls"),1);
  assert.equal(run("spawnContext.occupants!==null"),true);
 }finally{run("urbanSpawnOccupants=origOccupants")}
});
test('field placement reuses cached resident positions within a growth attempt',()=>{
 fixture();
 run("globalThis.origOccupants=urbanSpawnOccupants;globalThis.qaOccupantCalls=0;urbanSpawnOccupants=()=>{qaOccupantCalls++;return[]};globalThis.qaField={id:'f',type:'field',x:105,y:104,points:[{x:103,y:103},{x:107,y:103},{x:107,y:105},{x:103,y:105}]};globalThis.fieldContext={occupants:null}");
 try{
  assert.equal(run("fieldAllowed(qaField,fieldContext)"),true);
  assert.equal(run("fieldAllowed(qaField,fieldContext)"),true);
  assert.equal(run("qaOccupantCalls"),1);
 }finally{run("urbanSpawnOccupants=origOccupants")}
});
test('growth prioritizes fields for shortage and reports measured outcomes',()=>{
 fixture();
 run("State.structures.push({id:'road',type:'road',auto:true,routeId:'arterial',a:{x:100,y:100},b:{x:120,y:100},width:.6});for(let i=0;i<5;i++)State.structures.push({id:'h'+i,type:'house',auto:true,x:97+i*3,y:96,w:1.5,h:1});State.village.growthStep=10;State.village.nextGrowthDay=2;State.clock.day=2;globalThis.qaAttempts=[];globalThis.origSpawnField=spawnField;globalThis.origSpawnRoad=spawnRoad;globalThis.origSpawnHouse=spawnHouse;globalThis.origPlan=ensureRoadPlan;globalThis.origMarkDirty=markDirty;globalThis.origAnalytics=window.__conquerAnalytics;spawnField=()=>{qaAttempts.push('field');return true};spawnRoad=()=>{qaAttempts.push('road');return true};spawnHouse=()=>{qaAttempts.push('house');return true};ensureRoadPlan=()=>[];markDirty=()=>{};window.__conquerAnalytics={measure:(name,ms,details)=>{qaAttempts.push({name,ms,details})}}");
 try{
  assert.equal(run("processVillageGrowth()"),1);
  assert.equal(run("qaAttempts[0]"),'field');
  assert.equal(run("qaAttempts.filter(a=>a==='house'||a==='road').length"),0);
  assert.equal(run("qaAttempts.some(a=>a.name==='SPAWN_FIELD'&&a.details.ok===true)"),true);
  assert.equal(run("qaAttempts.some(a=>a.name==='GROWTH'&&a.details.changed===1)"),true);
 }finally{run("spawnField=origSpawnField;spawnRoad=origSpawnRoad;spawnHouse=origSpawnHouse;ensureRoadPlan=origPlan;markDirty=origMarkDirty;window.__conquerAnalytics=origAnalytics")}
});
test('real field candidate search can found at least one plot near a settlement',()=>{
 fixture();
 run("State.clock.day=1;State.structures.push({id:'main',type:'road',auto:true,roadClass:'arterial',routeId:'main',a:{x:100,y:100},b:{x:100,y:125},width:.5});for(let i=0;i<5;i++)State.structures.push({id:'farmhouse'+i,type:'house',auto:true,x:96+i*2,y:97,w:1.5,h:1,angle:0});invalidateNavigation();globalThis.qaSpawned=0;for(let step=0;step<12;step++)if(spawnField(step))qaSpawned++");
 assert.ok(run("qaSpawned")>0,'field generation must succeed with a real road and five homes');
 assert.equal(run("State.structures.filter(s=>s.type==='field').every(f=>fieldQuadValid(f.points)&&urbanYellowContains(f.points))"),true);
 assert.equal(run("State.structures.filter(s=>s.type==='field').every(f=>urbanLots().every(l=>!urbanPolygonsOverlap(f.points,l.points)))"),true);
});
console.log(passed+' URBAN 2 spawn regression checks passed.');
`);
check(require,__dirname);
