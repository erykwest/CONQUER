'use strict';
const fs=require('node:fs');
const harness=fs.readFileSync(__dirname+'/urban-regression.cjs','utf8').split('let passed=0;')[0];
new Function('require','__dirname',harness+`
let passed=0;
function test(name,body){body();passed++;console.log('PASS '+name)}
run("State.seed=12345;State.clock.day=0;State.environment=[];State.relief=null;State.structures=[{id:'well',type:'well',x:100,y:100},{id:'primary',type:'road',auto:true,routeId:'main',a:{x:100,y:100},b:{x:115,y:100},width:.5}];State.village={founded:true,wellId:'well'};invalidateNavigation()");
test('materials approximate 50% fences, 30% walls and 20% hedges',()=>{
 run("var counts={fence:0,wall:0,hedge:0};for(let i=0;i<20000;i++)counts[urbanBoundaryMaterial({x:i*.31,y:i*.73},{x:i*.31+3,y:i*.73+1})]++");
 for(const [kind,ratio] of [['fence',.5],['wall',.3],['hedge',.2]])assert.ok(Math.abs(run('counts.'+kind)/20000-ratio)<.025,kind);
});
test('materials remain stable with reversed sides, camera, reload and unrelated neighbours',()=>{
 run("var a={x:103,y:103},b={x:107,y:103};var material=urbanBoundaryMaterial(a,b)");
 assert.equal(run('urbanBoundaryMaterial(b,a)'),run('material'));
 run("State.view.rotation=3;State.view.scale=.3;State.structures.push({id:'unrelated',type:'house',x:114,y:110,w:1.5,h:1});invalidateNavigation()");
 assert.equal(run('urbanBoundaryMaterial(a,b)'),run('material'));
 run('var restored=JSON.parse(JSON.stringify({a,b}));');assert.equal(run('urbanBoundaryMaterial(restored.a,restored.b)'),run('material'));
});
test('completed fields get four sided boundaries and an open access',()=>{
 run("var field={id:'farm',type:'field',auto:true,x:105,y:104,points:[{x:103,y:103},{x:107,y:103},{x:107,y:105},{x:103,y:105}]};State.structures.push(field);invalidateNavigation();var fieldEdges=urbanFenceSegments([], [field])");
 assert.ok(run('fieldEdges.length')>=4);assert.equal(run("fieldEdges.every(e=>['fence','wall','hedge'].includes(e.material))"),true);
 assert.ok(Math.abs(run('fieldEdges.reduce((n,e)=>n+dist(e.a,e.b),0)')-11.04)<1e-7);
 run("field.construction={startedDay:0,completeDay:10};");assert.equal(run('urbanFenceSegments([]).length'),0);run('delete field.construction');
});
test('shared and partially shared field edges render once, regardless of input order',()=>{
 run("var second={id:'farm2',type:'field',x:109,y:104,points:[{x:107,y:103},{x:111,y:103},{x:111,y:105},{x:107,y:105}]};var shared=urbanFenceSegments([], [field,second]).filter(e=>Math.abs(e.a.x-107)<1e-6&&Math.abs(e.b.x-107)<1e-6)");
 assert.equal(run('shared.length'),1);assert.equal(run('dist(shared[0].a,shared[0].b)'),2);
 run("var forward=urbanFenceSegments([], [field,second]);var reverse=urbanFenceSegments([], [second,field]);var normalize=es=>es.map(e=>urbanBoundaryKey(e.a,e.b)+':'+e.material).sort().join(';')");assert.equal(run('normalize(forward)'),run('normalize(reverse)'));
 run("second.points=[{x:107,y:104},{x:111,y:104},{x:111,y:106},{x:107,y:106}];var parts=urbanFenceSegments([], [field,second]).filter(e=>Math.abs(e.a.x-107)<1e-6&&Math.abs(e.b.x-107)<1e-6);");
 for(let y=103.01;y<105.99;y+=.05)assert.ok(run('parts.filter(e=>'+y+'>Math.min(e.a.y,e.b.y)&&'+y+'<Math.max(e.a.y,e.b.y)).length')<=1);
});
test('a shared neighbour does not seal a parcel entrance',()=>{
 run("var above={id:'above',type:'field',x:105,y:102,points:[{x:103,y:101},{x:107,y:101},{x:107,y:103},{x:103,y:103}]};var bottom=urbanFenceSegments([], [field]).filter(e=>Math.abs(e.a.y-103)<1e-6&&Math.abs(e.b.y-103)<1e-6);var mergedBottom=urbanFenceSegments([], [field,above]).filter(e=>Math.abs(e.a.y-103)<1e-6&&Math.abs(e.b.y-103)<1e-6)");
 assert.ok(run('mergedBottom.reduce((n,e)=>n+dist(e.a,e.b),0)')<=run('bottom.reduce((n,e)=>n+dist(e.a,e.b),0)')+1e-6);
});
test('lot and field boundaries share one material and no duplicated physical segment',()=>{
 run("State.structures.push({id:'lot-house',type:'house',x:110,y:104,w:1.5,h:1});var lots=[{houseId:'lot-house',points:[{x:107,y:103},{x:111,y:103},{x:111,y:105},{x:107,y:105}]}];var combined=urbanFenceSegments(lots,[field]).filter(e=>Math.abs(e.a.x-107)<1e-6&&Math.abs(e.b.x-107)<1e-6)");
 assert.equal(run('combined.length'),1);
});
test('all seven Drive SVGs are present and seasonal recolouring preserves source paths',()=>{
 for(const name of run('BOUNDARY_BUSH_ASSETS')){
  const svg=fs.readFileSync(__dirname+'/../src/assets/bushes/'+name,'utf8');assert.ok(svg.includes('<svg'));assert.ok(svg.includes('#3B5174'));
  sandbox.qaSvg=svg;
  const summer=run("buildBoundaryBushSvg(qaSvg,'summer')"),winter=run("buildBoundaryBushSvg(qaSvg,'winter')");
  assert.ok(summer.includes('#527641'));assert.ok(winter.includes('#c7d1b9'));assert.ok(summer.includes('viewBox="64 260 920 580"'));
  assert.equal((summer.match(/<path/g)||[]).length,(svg.match(/<path/g)||[]).length);
 }
});
test('all three boundary renderers execute; ready hedges draw the imported sprites',()=>{
 run("var sample={a:{x:103,y:103},b:{x:107,y:103}};drawUrbanFence(sample);drawUrbanWall(sample);drawUrbanHedge(sample);var spriteDraws=0;ctx.drawImage=()=>spriteDraws++;for(let i=0;i<7;i++)boundaryBushSprites.summer[i]={};State.season='summer';drawUrbanHedge(sample)");
 assert.equal(run('spriteDraws'),run('urbanHedgeBushes(sample).length'));
});
console.log(passed+' boundary regression checks passed.');
`)(require,__dirname);
