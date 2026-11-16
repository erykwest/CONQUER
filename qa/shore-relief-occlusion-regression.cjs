'use strict';
const fs=require('node:fs');
const harness=fs.readFileSync(__dirname+'/urban-regression.cjs','utf8').split('let passed=0;')[0];
new Function('require','__dirname',harness+`
run(moduleFile('coast'));
run('State.biome="plains";State.season="summer";State.view={...State.view,plan:true,rotation:0,scale:.2,x:20,y:20};State.structures=[];State.relief={seed:1,hills:[{id:"shore-hill",levels:[{id:"shore-level",z0:0,z1:8,steepBase:2,top:[{x:60,y:140},{x:100,y:140},{x:100,y:147},{x:60,y:147}],edgeKinds:["steep","steep","steep","steep"]}]}]};clearReliefBandCache();terrainMarkLayout=()=>[];drawSteepSlopeRocks=()=>{}');
for(const type of ['sea','pond']){
 run('State.environment=[{id:"water",type:'+JSON.stringify(type)+',waterBodyKind:"lake",side:"south",coastline:[{x:0,y:150},{x:200,y:150}],points:[{x:0,y:150},{x:200,y:150},{x:200,y:200},{x:0,y:200}],fill:"#608c92",edge:"#abc"}]');
 for(const plan of [true,false])for(const rotation of [0,1,2,3]){
  const result=run('(()=>{State.view.plan='+plan+';State.view.rotation='+rotation+';const band=reliefEdgeBands(reliefLevels()[0])[2],p=slopePoint(band,.5,'+(plan?'.5':'.02')+'),z='+(plan?'0':'.16')+',targets={cliff:w2sRaw(p,z),beach:w2sRaw({x:25,y:148},0)},paints={cliff:[],beach:[]};pathPolygon=(poly,fill)=>{if(fill)for(const key of Object.keys(targets))if(pointInPolygon(targets[key],poly))paints[key].push(fill)};drawTerrain();drawEnvironment();return {slope:terrainSlopeKind(p),cliff:paints.cliff.at(-1),beach:paints.beach.at(-1)}})()');
  assert.equal(result.slope,'steep','fixture samples a real relief band');
  assert.ok(result.cliff,'the cliff is actually painted');
  assert.ok(!['#d6c494','#b9a978','#b9ac82'].includes(result.cliff),'shore paint must not cover a cliff: '+JSON.stringify({type,plan,rotation,...result}));
  assert.equal(result.beach,type==='sea'?'#d6c494':'#b9ac82','flat beaches keep their sand');
 }
}
console.log('PASS shore occlusion: real terrain/environment pipeline, sea/lake, four rotations and plan bake retain cliffs and flat beaches');
`)(require,__dirname);
