'use strict';
const fs=require('node:fs');
// Reuse the real game modules and DOM/canvas stubs, without the flat-world tests.
const harness=fs.readFileSync(__dirname+'/urban-regression.cjs','utf8').split('let passed=0;')[0];
eval(harness+`
const queue=[];
sandbox.setTimeout=fn=>{queue.push(fn);return queue.length};
run("function markDirty(){};function renderUI(){};function draw(){}");
const app=moduleFile('app');
run(app.slice(app.indexOf("document.getElementById('confirmVillageBtn').onclick"),app.indexOf("document.getElementById('cancelVillageBtn').onclick")));
let passed=0;
function check(name,body){body();passed++;console.log('PASS '+name)}
function prepare(seed,biome,landscape=true){
 queue.length=0;
 run("foundingRoadJob=null;State.seed="+seed+";State.biome='"+biome+"';State.structures=[];State.village={};State.environment=[];State.relief=null;clearReliefBandCache()");
 if(landscape)run('ensureStaticLandscape()');
 run("State.structures=[{id:'well',type:'well',x:100,y:100}];State.pendingWellId='well';State.clock.day=0;invalidateNavigation()");
 doc.getElementById('villageNameInput').value='New town';
}
function confirm(){
 const start=performance.now();
 vm.runInContext("document.getElementById('confirmVillageBtn').onclick()",context,{timeout:250});
 assert.ok(performance.now()-start<100,'name confirmation must return promptly');
 assert.equal(run('State.village.founded'),true);
 assert.equal(run('roadList().length'),0,'planning must not run inside the name handler');
 assert.ok(queue.length>0);
}
function tick(){
 sandbox.__qaTick=queue.shift();
 const start=performance.now();
 vm.runInContext('__qaTick()',context,{timeout:250});
 return performance.now()-start;
}
function drain(){
 let count=0,max=0;
 while(queue.length){assert.ok(count++<20000,'planning must finish');max=Math.max(max,tick())}
 assert.ok(max<100,'a road planning slice must not stall the UI: '+max+'ms');
 return {count,max:Math.round(max)};
}
for(const [seed,biome] of [[12345,'plains'],[4242,'forest']])check('actual name confirmation stays responsive on '+biome+' terrain',()=>{
 prepare(seed,biome);confirm();
 assert.equal(run('processVillageGrowth()'),0);
 const timing=drain();
 assert.equal(run('foundingRoadJob'),null);
 assert.equal(run('ensureRoadPlan().filter(r=>arterialRouteContinuous(r.id)).length'),4);
 assert.equal(run('roadList().every(r=>roadRepairSegmentClear(r.a,r.b,r.width,[State.village.wellId]))'),true);
 console.log('  planning slices',timing);
});
check('a new building invalidates an in-progress route and is avoided',()=>{
 prepare(12345,'plains');confirm();tick();
 run("State.structures.push({id:'new-building',type:'barracks',x:100,y:90,w:4,h:4,angle:0});invalidateNavigation()");
 drain();
 assert.equal(run('ensureRoadPlan().filter(r=>arterialRouteContinuous(r.id)).length'),4);
 assert.equal(run('roadList().every(r=>roadRepairSegmentClear(r.a,r.b,r.width,[State.village.wellId]))'),true);
});
check('clearing the city cancels pending roads without recreating structures',()=>{
 prepare(12345,'plains');confirm();tick();
 run('State.structures=[];State.village={founded:false}');drain();
 assert.equal(run('foundingRoadJob'),null);
 assert.equal(run('State.structures.length'),0);
});
check('spatial slope queries preserve brute-force results and cache invalidation',()=>{
 prepare(77,'plains');
 assert.equal(run("(()=>{const all=reliefLevels().flatMap(l=>reliefEdgeBands(l));for(let x=0;x<=WORLD;x+=1.3)for(let y=0;y<=WORLD;y+=1.7){const p={x,y},bands=all.filter(b=>pointInPolygon(p,b.poly));const kind=bands.some(b=>b.kind==='steep')?'steep':bands.length?'gentle':null;if(terrainSlopeKind(p)!==kind)return false;}return true})()"),true);
 run("State.relief={hills:[]};clearReliefBandCache()");
 assert.equal(run('terrainSlopeKind({x:100,y:100})'),null);
});
console.log(passed+' founding regression checks passed.');
`);
