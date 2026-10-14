'use strict';
// Landscape + road crossing invariants on real game world functions.
const fs=require('node:fs');
const harness=fs.readFileSync(__dirname+'/urban-regression.cjs','utf8').split('let passed=0;')[0];
eval(harness+`
let checks=0;
function check(name,fn){fn();checks++;console.log('PASS '+name)}
function reset(){run("State.environment=[];State.relief=null;State.structures=[];State.village={founded:false};clearReliefBandCache()")}
check('forests are solid obstacles for every road class, auto routes detour',()=>{
 reset();
 run("State.environment=[{type:'forest',id:'qa-wood',points:[{x:97,y:95},{x:103,y:95},{x:103,y:105},{x:97,y:105}]}]");
 assert.equal(run("primaryRoadTerrainBlocked({x:100,y:100})"),true);
 assert.equal(run("environmentBlocksPoint({x:100,y:100},'road')"),true);
 assert.equal(run("roadRepairSegmentClear({x:88,y:100},{x:112,y:100},.62,[],null,true)"),false);
 run("globalThis.qaDetour=findRoadRepairPath({x:88,y:100},{x:112,y:100},.62,16,[],65000,true)");
 assert.ok(run('qaDetour?.length')>2);
 assert.equal(run("qaDetour.slice(1).every((p,i)=>roadRepairSegmentClear(qaDetour[i],p,.62,[],null,true))"),true);
});
check('perpendicular bridge path minimizes span length over a diagonal crossing',()=>{
 reset();
 run("State.environment=[{type:'river',id:'qa-river',width:4,points:[{x:70,y:100},{x:130,y:100}]}]");
 run("globalThis.qaBridgePath=primaryRoadOrthogonalPolyline([{x:90,y:90},{x:110,y:110}])");
 assert.equal(run('qaBridgePath.length'),4);
 assert.ok(Math.abs(run('qaBridgePath[1].x-qaBridgePath[2].x'))<.01,'bridge aligned to river normal');
 assert.ok(run('dist(qaBridgePath[1],qaBridgePath[2])')<5.6,'span only covers the channel');
 assert.ok(run('dist(qaBridgePath[1],qaBridgePath[2])')<4.7,'shorter than a diagonal 4U channel crossing');
 run("qaBridgePath.slice(1).forEach((b,i)=>{const a=qaBridgePath[i];State.structures.push({id:'qa-road-'+i,type:'road',manualMain:true,a,b,width:.62,routeId:'manual-main:qa',routeSeq:i})});State.structures.slice().forEach(autoPrimaryRoadBridges)");
 assert.ok(run("State.structures.some(s=>s.type==='bridge'&&s.variant==='wood')"));
 assert.equal(run("State.structures.filter(s=>s.type==='bridge').every(s=>Math.abs(s.a.x-s.b.x)<.2)"),true);
});
check('C, L and S silhouettes use nonintersecting real polygons',()=>{
 reset();
 for(const [seed,name] of [[.60,'C'],[.78,'L'],[.94,'S']]){
   const pick=seed;
   run("globalThis.qaShape=makeOrganicForestBlob(()=>"+pick+",100,100,18,15,false)");
   assert.equal(run('qaShape.shapeProfile'),name);
   assert.ok(run('qaShape.points.length')>65);
   assert.ok(run('qaShape.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))'));
   assert.ok(run("!qaShape.points.some((p,i)=>qaShape.points.some((q,j)=>i!==j&&j!==(i+1)%qaShape.points.length&&(j+1)%qaShape.points.length!==i&&segmentsIntersect(p,qaShape.points[(i+1)%qaShape.points.length],q,qaShape.points[(j+1)%qaShape.points.length])))"),name+' must not self-intersect');
 }
});
check('river first and new forest polygons stay outside banks',()=>{
 for(const biome of ['river','forest']){
   reset();
   run("State.seed=3949;State.biome='"+biome+"';State.relief={hills:[],version:LANDSCAPE_GENERATION_VERSION};clearReliefBandCache();generateEnvironment()");
   const counts=run("({water:State.environment.filter(f=>['river','stream'].includes(f.type)).length,forests:State.environment.filter(f=>f.type==='forest').length})");
   assert.ok(counts.water>0&&counts.forests>0,'expected water and forest in '+biome);
   assert.equal(run("State.environment.findIndex(f=>f.type==='forest')>State.environment.findIndex(f=>['river','stream'].includes(f.type))"),true);
   assert.equal(run("State.environment.filter(f=>f.type==='forest').every(f=>forestClearsWater(f,State.environment))"),true);
 }
});
console.log(checks+' river/forest routing checks passed.');
`);
