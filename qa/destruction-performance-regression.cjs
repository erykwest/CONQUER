'use strict';
const fs=require('node:fs');
const harness=fs.readFileSync(__dirname+'/urban-regression.cjs','utf8').split('let passed=0;')[0];
new Function('require','__dirname',harness+`
run(moduleFile('collapse'));run(moduleFile('fire'));
run('globalThis.qaDraws=0;globalThis.qaRequests=0;function draw(){qaDraws++};function requestSceneDraw(){qaRequests++}');
function setup(){run("State.clock={day:20,speed:0};State.structures=[];State.fire=null;State.siege=null;State.village={founded:false};qaDraws=0;qaRequests=0;invalidateNavigation();for(const layer of Object.values(sceneCache))layer.dirty=false")}
let passed=0;function test(name,fn){fn();passed++;console.log('PASS '+name)}
test('partial damage persists HP without invalidating geometry or navigation',()=>{
 setup();run("State.structures=[{id:'t',type:'tower',shape:'square',size:2,x:100,y:100,level:3,material:'stone'}];globalThis.qaNav=navPerf.navInvalidations;globalThis.qaHp=window.ConquerSiege.integrity(State.structures[0]).core.hp;window.ConquerSiege.attackStructure('t','trebuchet',1)");
 assert.ok(run('window.ConquerSiege.integrity(State.structures[0]).core.hp<qaHp'));
 assert.equal(run('navPerf.navInvalidations'),run('qaNav'));
 assert.equal(run('Object.values(sceneCache).some(layer=>layer.dirty)'),false);
 assert.equal(run('qaDraws'),0);assert.ok(run('qaRequests>0&&State.dirty'));
});
test('a large fire damages all targets without drawing inside its tick',()=>{
 setup();run("for(let i=0;i<32;i++)State.structures.push({id:'h'+i,type:'house',auto:true,houseLevel:2,x:80+i%8*3,y:80+Math.floor(i/8)*3,w:1.5,h:1});window.ConquerFire.brigade.set(false);for(const s of State.structures)window.ConquerFire.ignite(s.id,{heat:.95});globalThis.qaNav=navPerf.navInvalidations;window.ConquerFire.tick(1.1)");
 assert.ok(run('State.structures.every(s=>s.siegeIntegrity.core.hp<s.siegeIntegrity.core.max)'));
 assert.equal(run('navPerf.navInvalidations'),run('qaNav'));assert.equal(run('qaDraws'),0);
 assert.equal(run('window.ConquerFire.state().burning.length'),32);
 assert.equal(run('window.ConquerFire.needsAnimation()'),true);
});
test('real collapses keep stumps and navigation changes, but request one visual frame',()=>{
 setup();run("State.structures=[{id:'t',type:'tower',shape:'square',size:2,x:100,y:100,level:3,material:'stone'}];globalThis.qaNav=navPerf.navInvalidations;window.ConquerSiege.attackStructure('t','trebuchet',10000)");
 assert.equal(run("State.structures[0].type"),'ruin');assert.ok(run('navPerf.navInvalidations>qaNav'));
 assert.equal(run('qaDraws'),0);assert.equal(run('window.ConquerSiege.needsAnimation()'),true);
 run('globalThis.qaOldPerformance=performance;performance={now:()=>1e8};globalThis.qaHeaps=window.ConquerSiege.dynamicMeshes()');
 try{
  assert.ok(run('qaHeaps.every(m=>m.static===true)'));
  assert.equal(run('window.ConquerSiege.dynamicMeshes().every((m,i)=>m===qaHeaps[i])'),true);
  assert.equal(run('window.ConquerSiege.needsAnimation()'),false);
 }finally{run('performance=qaOldPerformance')}
});
test('restoring a save rebuilds heaps from the loaded spec and stops old animations',()=>{
 setup();run("globalThis.qaRuin=window.ConquerSiege.startCollapse({id:'saved',type:'tower',shape:'square',size:2,x:100,y:100,level:2},0,3);globalThis.qaOldPerformance=performance;performance={now:()=>1e8};globalThis.qaMesh=window.ConquerSiege.dynamicMeshes()[0];globalThis.qaSave=JSON.parse(JSON.stringify(State.siege));qaSave.ruins[0].spec.ground=10;qaSave.ruins[0].spec.z0=10;qaSave.ruins[0].spec.z1=13;window.ConquerSiege.restore(qaSave)");
 try{
  assert.equal(run('window.ConquerSiege.needsAnimation()'),false);
  assert.equal(run('window.ConquerSiege.dynamicMeshes()[0]===qaMesh'),false);
  assert.ok(run('window.ConquerSiege.dynamicMeshes()[0].pos.filter((_,i)=>i%3===2).every(z=>z>9)'));
  run('window.ConquerSiege.restore({ruins:{invalid:true}})');
  assert.equal(run('window.ConquerSiege.state().ruins.length'),0);
 }finally{run('performance=qaOldPerformance')}
});
console.log(passed+' destruction performance checks passed.');
`)(require,__dirname);
