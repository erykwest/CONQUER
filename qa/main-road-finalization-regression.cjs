'use strict';
const fs=require('node:fs');
const harness=fs.readFileSync(__dirname+'/urban-regression.cjs','utf8').split('let passed=0;')[0];
new Function('require','__dirname',harness+String.raw`
function prepare(){
 run("State.structures=[{id:'well',type:'well',x:50,y:100}];State.village={founded:true,wellId:'well'};State.seed=12345;State.relief={hills:[]};clearReliefBandCache();State.environment=[{id:'water',type:'river',width:3.2,points:Array.from({length:201},(_,i)=>({x:100,y:i}))},{id:'forest',type:'forest',continuous:true,points:[{x:0,y:0},{x:200,y:0},{x:200,y:200},{x:0,y:200}]}];invalidateNavigation();globalThis.route=ensureRoadPlan().find(r=>r.edge==='east');route.target={x:200,y:100,edge:'east'};globalThis.valid=true;globalThis.checks=0;");
}
run("globalThis.originalDistance=pointSegmentDistance;pointSegmentDistance=function(...a){checks++;return originalDistance(...a)}");
prepare();
run("globalThis.revision=navPerf.navInvalidations||0;globalThis.work=rebuildArterialWork(route.id,[],()=>revision===(navPerf.navInvalidations||0))");
let max=0,count=0,step;
do{
 run('checks=0');step=run('work.next()');max=Math.max(max,run('checks'));
 assert.ok(count++<50000,'the route finishes');
}while(!step.done);
console.log('route geometry checks per step:',max,'in',count,'steps');
assert.ok(max<=256,'one generator step must not scan the entire river for the whole route: '+max);
assert.ok(step.value>10);
assert.equal(run('arterialRouteContinuous(route.id)'),true);
assert.ok(run("State.structures.some(s=>s.type==='bridge')"));
assert.ok(run("State.environment.find(f=>f.id==='forest').holes.length>0"));
console.log('PASS cooperative road finalization retains bridges, forest grooves and connectivity');

prepare();
run("State.structures.push({id:'old-road',type:'road',auto:true,roadClass:'arterial',routeId:route.id,a:{x:50,y:100},b:{x:80,y:100},width:.62},{id:'old-bridge',type:'bridge',primaryBridgeFor:'old-road',a:{x:70,y:99},b:{x:70,y:101}});invalidateNavigation();globalThis.revision=navPerf.navInvalidations||0;globalThis.work=rebuildArterialWork(route.id,[],()=>revision===(navPerf.navInvalidations||0))");
let paused=false;
for(let i=0;i<50000;i++){
 run('checks=0');step=run('work.next()');
 if(!step.done&&run('checks')>0){paused=true;break}
 if(step.done)break;
}
assert.equal(paused,true,'bridge preparation can pause before publishing the route');
assert.equal(run('roadList().length'),1,'the previous route stays available during preparation');
assert.equal(run("State.structures.some(s=>s.id==='old-road')&&State.structures.some(s=>s.id==='old-bridge')"),true);
assert.equal(run("State.environment.find(f=>f.id==='forest').holes?.length||0"),0,'preparation does not cut the forest');
run("State.structures.push({id:'interruption',type:'barracks',x:80,y:100,w:4,h:4});invalidateNavigation()");
let cancelledSteps=0;
do{step=run('work.next()');cancelledSteps++}while(!step.done);
assert.ok(cancelledSteps<=2,'a navigation change stops at the next bridge checkpoint');
assert.equal(step.value,0,'a changed navigation revision cancels the prepared route');
assert.equal(run('roadList().length'),1);
assert.equal(run("State.structures.filter(s=>s.type==='bridge').map(s=>s.id).join(',')"),'old-bridge');
assert.equal(run("State.structures.some(s=>s.id==='old-road')"),true);
assert.equal(run("State.environment.find(f=>f.id==='forest').holes?.length||0"),0);
assert.equal(run("State.structures.some(s=>s.id==='interruption')"),true);
console.log('PASS interrupted preparation preserves the previous route and bridge without partial replacements or forest cuts');
`)(require,__dirname);
