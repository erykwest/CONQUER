"use strict";
const fs=require('node:fs');
const harness=fs.readFileSync(__dirname+'/urban-regression.cjs','utf8').split('let passed=0;')[0];
new Function('require','__dirname',harness+`
run(moduleFile('hydrology'));
for(const biome of ['plains','forest','mountains','swamp']){
 const seen=new Set();
 for(let seed=1;seed<=64;seed++){
  run('State.seed='+seed+';State.biome='+JSON.stringify(biome));
  const count=run('typeof biomeStreamCount==="function"?biomeStreamCount():biomeWater([])?.type==="stream"?1:0');
  assert.ok(count>=0&&count<=3);seen.add(count);
 }
 assert.deepEqual([...seen].sort(),[0,1,2,3],biome+' must support zero, one, two and three streams');
}
for(const regional of [false,true])for(const seed of [1,2,3,4,5,4242]){
 run('window.__CONQUER_REGIONAL_DEMO__='+JSON.stringify(regional?{hasRiver:true,riverSides:['north','east'],tributaryTypes:['stream','stream','stream','stream']}:null)+';State.seed='+seed+';State.biome="plains";State.structures=[];State.environment=[];State.relief=null;generateRelief();generateEnvironment()');
 assert.ok(run('State.environment.filter(f=>f.type==="stream").length<=3'),'three-stream cap includes regional tributaries');
 assert.ok(run('new Set(State.environment.map(f=>f.id)).size===State.environment.length'),'unique feature ids');
 assert.ok(run('State.environment.filter(f=>f.confluence).every(f=>{const parent=State.environment.find(p=>p.id===f.confluence.downstreamId);return parent&&environmentContains(parent,f.points.at(-1))})'),'connected confluences');
 assert.ok(run('State.environment.filter(f=>f.confluence).every(f=>{const parent=State.environment.find(p=>p.id===f.confluence.downstreamId),end=f.points.at(-1);return f.points.slice(1).every((p,i)=>parent.points.slice(1).every((q,j)=>{const hit=window.ConquerHydrology.intersection(f.points[i],p,parent.points[j],q);return !hit||Math.hypot(hit.x-end.x,hit.y-end.y)<1e-6}))})'),'tributaries meet their parent only at the outlet, never loop across it');
 const first=run('JSON.stringify(State.environment)');run('State.relief=null;generateRelief();generateEnvironment()');assert.equal(run('JSON.stringify(State.environment)'),first,'same seed repeats');
}
console.log('PASS streams: 0-3 for all four biomes, regional cap, unique ids, confluences and determinism');
`)(require,__dirname);
