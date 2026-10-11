'use strict';
const fs=require('node:fs');
const harness=fs.readFileSync(__dirname+'/urban-regression.cjs','utf8').split('let passed=0;')[0];
eval(harness+`
run(moduleFile('snow-tracks'));
run("State.season='winter';State.view={scale:1,x:600,y:-1000,rotation:0};globalThis.tracks=window.ConquerSnowTracks;globalThis.rect={width:1200,height:800};globalThis.p={x:100,y:100};State.structures=[];State.environment=[];State.relief=null");
let passed=0;
function test(name,fn){run('tracks.clear()');fn();passed++;console.log('PASS '+name)}
test('movement creates alternating tracks; standing and repeated draws do not',()=>{
 run("tracks.beginFrame(rect,0);tracks.sample('person',p);tracks.sample('person',p)");
 assert.equal(run('tracks.stats().count'),0);
 run("tracks.beginFrame(rect,100);tracks.sample('person',{x:100.4,y:100});tracks.sample('person',{x:100.4,y:100})");
 assert.equal(run('tracks.stats().count'),1);
});
test('real-time fade expires after 2.5s even while the clock is paused',()=>{
 run("tracks.beginFrame(rect,0);tracks.sample('person',p);tracks.beginFrame(rect,100);tracks.sample('person',{x:100.4,y:100});State.clock.speed=0;tracks.beginFrame(rect,1350);tracks.draw(ctx);globalThis.alpha=ctx.globalAlpha");
 assert.ok(run('alpha>0&&alpha<.38'));
 assert.equal(run('tracks.active()'),true);
 run('tracks.beginFrame(rect,2600)');
 assert.equal(run('tracks.active()'),false);
});
test('summer and a changed world clear both particles and emitter history',()=>{
 run("tracks.beginFrame(rect,0);tracks.sample('person',p);tracks.beginFrame(rect,100);tracks.sample('person',{x:100.4,y:100});State.season='summer';tracks.beginFrame(rect,150)");
 assert.equal(run('tracks.stats().count+tracks.stats().actors'),0);
 run("State.season='winter';tracks.beginFrame(rect,200);tracks.sample('person',p);State.seed++;tracks.beginFrame(rect,250)");
 assert.equal(run('tracks.stats().actors'),0);
});
test('teleports, hidden actors and elevated guards create no false trails',()=>{
 run("tracks.beginFrame(rect,0);tracks.sample('person',p);tracks.beginFrame(rect,100);tracks.sample('person',{x:108,y:100});tracks.sample('roof',p,2);tracks.sample('hidden',{x:190,y:190});tracks.beginFrame(rect,800);tracks.sample('person',{x:108.4,y:100})");
 assert.equal(run('tracks.stats().count'),0);
});
test('water and exposed roads do not receive snow tracks',()=>{
 run("State.structures=[{type:'road',a:{x:99,y:100},b:{x:102,y:100},width:.62}];tracks.beginFrame(rect,0);tracks.sample('person',p);tracks.beginFrame(rect,100);tracks.sample('person',{x:100.4,y:100})");
 assert.equal(run('tracks.stats().count'),0);
 run("State.structures=[];State.environment=[{type:'pond',points:[{x:99,y:99},{x:102,y:99},{x:102,y:102},{x:99,y:102}]}];tracks.beginFrame(rect,200);tracks.sample('person',{x:100.8,y:100})");
 assert.equal(run('tracks.stats().count'),0);
 run('State.environment=[]');
});
test('villager and military rendering hooks feed the same bounded pool',()=>{
 run("tracks.beginFrame(rect,0);drawVillagerFigure({id:'villager',p,kind:'peasant',age:'child',sex:'male',hair:'#654',colors:['#765','#456']});drawSoldierFigure(p,.08,'knight','unit');tracks.beginFrame(rect,100);drawVillagerFigure({id:'villager',p:{x:100.4,y:100},kind:'peasant',age:'child',sex:'male',hair:'#654',colors:['#765','#456']});drawSoldierFigure({x:100.4,y:100},.08,'knight','unit')");
 assert.equal(run('tracks.stats().count'),2);
});
test('overload stays bounded and draw reprojects on camera rotation',()=>{
 run("tracks.beginFrame(rect,0);for(let i=0;i<700;i++)tracks.sample('actor'+i,p);for(let frame=1;frame<=20;frame++){tracks.beginFrame(rect,frame*100);for(let i=0;i<512;i++)tracks.sample('actor'+i,{x:100+frame*.4,y:100});}tracks.draw(ctx)");
 assert.equal(run('tracks.stats().actors'),512);
 assert.equal(run('tracks.stats().count'),768);
 for(let rotation=0;rotation<4;rotation++){
  run('State.view.rotation='+rotation+';State.view.x=600;State.view.y=-1000;tracks.draw(ctx)');
  assert.equal(run('tracks.stats().count'),768);
 }
 run('State.view.rotation=0');
 const start=performance.now();
 run('for(let frame=0;frame<200;frame++)tracks.draw(ctx)');
 console.log('  full-pool draw mean (stub canvas): '+((performance.now()-start)/200).toFixed(3)+' ms');
});
console.log(passed+' snow-track regression checks passed.');
`);
