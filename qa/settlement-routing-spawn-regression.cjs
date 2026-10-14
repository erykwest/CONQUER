'use strict';
// Regression: the 200U border routes and zoned housing must agree with their diagnostics.
const fs=require('node:fs');
const harness=fs.readFileSync(__dirname+'/urban-regression.cjs','utf8').split('let passed=0;')[0];
const check=new Function('require','__dirname',harness+`
let passed=0;
function test(name,body){body();passed++;console.log('PASS '+name)}
function setup(){
 run("State.seed=12345;State.environment=[];State.relief=null;State.structures=[{id:'well',type:'well',x:100,y:100}];State.village={founded:true,wellId:'well',growthStep:0};State.combat.units=[];State.combat.enemy=[];State.combat.strokes=[];invalidateNavigation();invalidateUrbanGeometry();ensureRoadPlan()");
}
test('a partial main-road segment cannot be reported connected',()=>{
 setup();
 run("State.village.roadPlan[0].connected=false;State.structures.push({id:'partial',type:'road',routeId:'arterial-0',routeSeq:0,a:{x:100,y:100},b:{x:100,y:105},width:.62})");
 assert.equal(run("arterialRouteContinuous('arterial-0')"),false);
});
test('a connected route ends at the actual selected world-border target',()=>{
 setup();
 run("State.village.roadPlan[0].connected=true;State.structures.push({id:'partial',type:'road',routeId:'arterial-0',routeSeq:0,a:{x:100,y:100},b:{x:100,y:105},width:.62})");
 assert.equal(run("arterialRouteContinuous('arterial-0')"),false);
});
test('house sampling focuses on in-radius road sections, not distant segments',()=>{
 setup();
 run("for(let i=0;i<300;i++)State.structures.push({id:'far'+i,type:'road',routeId:'far'+i,a:{x:150,y:20+i*.48},b:{x:150,y:21+i*.48},width:.62});State.structures.push({id:'near',type:'road',routeId:'near',a:{x:100,y:100},b:{x:100,y:112},width:.62});invalidateNavigation();");
 assert.equal(run('spawnHouse(0)'),true);
 assert.equal(run("State.structures.filter(s=>s.type==='house').length"),1);
 assert.ok(run("dist(State.structures.find(s=>s.type==='house'),{x:100,y:100})<=currentGrowthRadius()"));
});
test('smaller viable quadrilateral is used when the maximum-area lot is blocked',()=>{
 setup();
 run("globalThis.qaCell=Array.from({length:6},(_,i)=>({x:100+6*Math.cos(Math.PI+i*Math.PI/3),y:100+6*Math.sin(Math.PI+i*Math.PI/3)}));globalThis.qaHome={id:'candidate',type:'house',x:100,y:100,w:1.5,h:1,angle:0};globalThis.qaQuad=urbanQuad(qaCell,qaHome,q=>q.some(p=>p.x>105.5))");
 assert.ok(run('qaQuad!==null'));
 assert.ok(run('Math.abs(urbanArea(qaQuad))>5'));
 assert.ok(run('qaQuad.some(p=>p.x>105.5)'));
});
test('both local and cloud loads defer main-road planning',()=>{
 const app=['app','app-rooms','app-input','app-persistence','app-calendar-ui','app-simulation','app-bootstrap'].map(part=>fs.readFileSync(__dirname+'/../src/settlement-'+part+'.js','utf8')).join('\n');
 const local=app.slice(app.indexOf('function loadLocal(){'),app.indexOf('async function initSupabase()'));
 const cloud=app.slice(app.indexOf('async function loadCloud()'),app.indexOf('async function saveCloud()'));
 assert.ok(local.includes('connectBorderMainRoadsInFrames('));
 assert.ok(cloud.includes('connectBorderMainRoadsInFrames('));
 assert.ok(!local.includes('connectSelectedBorderMainRoads()'));
 assert.ok(!cloud.includes('connectSelectedBorderMainRoads()'));
});
console.log(passed+' main road/house spawn regression checks passed.');
`);
check(require,__dirname);
