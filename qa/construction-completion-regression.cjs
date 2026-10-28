'use strict';
const fs=require('node:fs');
const harness=fs.readFileSync(__dirname+'/urban-regression.cjs','utf8').split('let passed=0;')[0];
new Function('require','__dirname',harness+`
run(fs.readFileSync(__dirname+'/../src/settlement-app-simulation.js','utf8'));
run('globalThis.qaTimers=[];setTimeout=fn=>{qaTimers.push(fn);return qaTimers.length}');
function flush(){let n=0;while(run('qaTimers.length')){if(n++>10000)throw Error('road queue did not settle');run('qaTimers.shift()()')}}
function setup(){
 flush();
 run("State.clock={day:11,speed:1};State.village={founded:true,wellId:'well'};State.structures=[{id:'well',type:'well',x:100,y:100},{id:'trunk',type:'road',routeId:'manual-main:trunk',a:{x:80,y:100},b:{x:120,y:100},width:.62}];invalidateNavigation();");
}
let passed=0;
function test(name,fn){fn();passed++;console.log('PASS '+name)}
test('castle-only completion retains urban geometry and schedules road searches',()=>{
 setup();run("State.structures.push({id:'tower',type:'tower',x:106,y:108,size:2,shape:'square',material:'stone',level:1});globalThis.qaUrban=urbanRevision;globalThis.qaRoads=State.structures.length;runSettlementMaintenance('completion',[State.structures.at(-1)])");
 assert.equal(run('urbanRevision'),run('qaUrban'),'castle completion without changed footprint must not rebake terrain');
 assert.equal(run('State.structures.length'),run('qaRoads'),'road work must not execute in the completion frame');
 assert.ok(run('qaTimers.length>0'));
 flush();assert.ok(run("State.structures.some(s=>s.accessFor==='tower')"),'the scheduled road still has to be built');
});
test('scheduled tower and gate routes match the synchronous geometry',()=>{
 for(const type of ['tower','gate']){
  setup();run("State.structures.push({id:'target',type:'"+type+"',x:108,y:108,size:2,w:1.5,h:1.5,shape:'square',material:'stone',level:1});globalThis.qaFixture=JSON.stringify(State.structures)");
  run(type==='tower'?"ensureTowerSecondaryBranch(State.structures.at(-1))":"buildGateMainConnection(State.structures.at(-1))");
  const geometry=()=>JSON.parse(run("JSON.stringify(State.structures.filter(s=>s.type==='road').map(s=>({a:s.a,b:s.b,width:s.width,roadClass:s.roadClass,accessFor:s.accessFor,gateFor:s.gateFor})))"));
  const expected=geometry();
  run("State.structures=JSON.parse(qaFixture);invalidateNavigation();runSettlementMaintenance('completion',[State.structures.at(-1)])");flush();
  assert.deepEqual(geometry(),expected);
 }
});
test('completion promotes church parcels and all completed structure render layers',()=>{
 setup();run("State.structures.push({id:'church',type:'church',x:107,y:107,w:3,h:2});globalThis.qaUrban=urbanRevision;for(const e of Object.values(sceneCache))e.dirty=false;runSettlementMaintenance('completion',[State.structures.at(-1)])");
 assert.ok(run('urbanRevision>qaUrban'));
 assert.ok(run('sceneCache.base.dirty&&sceneCache.shadow.dirty'));
 flush();
});
test('deleted targets and replaced villages cancel pending road work',()=>{
 setup();run("State.structures.push({id:'gone',type:'tower',x:106,y:108,size:2,shape:'square'});runSettlementMaintenance('completion',[State.structures.at(-1)]);State.structures=State.structures.filter(s=>s.id!=='gone');invalidateNavigation()");flush();
 assert.equal(run("State.structures.some(s=>s.accessFor==='gone')"),false);
 setup();run("State.structures.push({id:'old',type:'tower',x:106,y:108,size:2,shape:'square'});runSettlementMaintenance('completion',[State.structures.at(-1)]);State.village={founded:false};State.structures=[]");flush();
 assert.equal(run('State.structures.length'),0);
});
test('primary-road completion updates streetfronts; a new tower does not retry unrelated towers',()=>{
 setup();run("globalThis.qaUrban=urbanRevision;runSettlementMaintenance('completion',[State.structures[1]])");
 assert.ok(run('urbanRevision>qaUrban'));flush();
 run("State.structures.push({id:'old-tower',type:'tower',x:106,y:108,shape:'square',size:2},{id:'new-tower',type:'tower',x:110,y:108,shape:'square',size:2});globalThis.qaSeen=[];globalThis.qaTowerWork=ensureTowerSecondaryBranchWork;ensureTowerSecondaryBranchWork=function*(s){qaSeen.push(s.id);return 0};runSettlementMaintenance('completion',[State.structures.at(-1)])");
 try{flush();assert.deepEqual(JSON.parse(run('JSON.stringify(qaSeen)')),['new-tower'])}
 finally{run('ensureTowerSecondaryBranchWork=qaTowerWork')}
});
test('path searches yield and discard stale results after topology changes',()=>{
 setup();run("State.structures.push({id:'target',type:'tower',x:106,y:108,size:2,shape:'square'});globalThis.qaOriginalSegment=roadRepairSegmentWork;globalThis.qaOriginalPath=findRoadRepairWork;roadRepairSegmentWork=function*(){return false};globalThis.qaSearches=0;findRoadRepairWork=function*(){qaSearches++;for(let i=0;i<20;i++)yield;return [{x:106,y:108},{x:100,y:100}]};globalThis.qaNow=0;globalThis.qaRealPerformance=performance;performance={now:()=>++qaNow};runSettlementMaintenance('completion',[State.structures.at(-1)])");
 try{
  run('qaTimers.shift()()');assert.equal(run('qaSearches'),1);
  run('invalidateNavigation()');flush();
  assert.ok(run('qaSearches>=2'),'a path captured before the edit must be recomputed');
 }finally{run('roadRepairSegmentWork=qaOriginalSegment;findRoadRepairWork=qaOriginalPath;performance=qaRealPerformance')}
});
console.log(passed+' construction completion regression checks passed.');
`)(require,__dirname);
