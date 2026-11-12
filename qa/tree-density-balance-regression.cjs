"use strict";
const fs=require('node:fs');
const harness=fs.readFileSync(__dirname+'/urban-regression.cjs','utf8').split('let passed=0;')[0];
new Function('require','__dirname',harness+`
run('State.seed=4242;State.biome="plains";State.structures=[];State.relief={hills:[]};clearReliefBandCache();State.environment=[{id:"flat-density",type:"forest",x:100,y:100,rx:60,ry:60,points:[{x:40,y:40},{x:160,y:40},{x:160,y:160},{x:40,y:160}],holes:[]}];clearForestLayoutCache()');
const count=run('forestTreeLayout(State.environment[0]).length'),oldExpected=120*120/(4.4*4.4);
assert.ok(count/oldExpected>=2.4&&count/oldExpected<=2.6,'tree multiplier '+count/oldExpected);
for(const seed of [1,3,7]){
 run('State.seed='+seed+';State.biome="hills";State.relief=null;State.environment=[];generateRelief();State.environment=[{id:"cliff-density",type:"forest",x:100,y:100,rx:100,ry:100,points:[{x:0,y:0},{x:200,y:0},{x:200,y:200},{x:0,y:200}],holes:[]}];clearForestLayoutCache()');
 assert.ok(run('forestTreeLayout(State.environment[0]).every(t=>[-1.1,0,1.1].every(dx=>[-1.1,0,1.1].every(dy=>terrainSlopeKind({x:t.p.x+dx,y:t.p.y+dy})!=="steep")))'),'cliff buffer stays free');
 const before=run('JSON.stringify(State.environment)');run('forestTreeLayout(State.environment[0])');assert.equal(run('JSON.stringify(State.environment)'),before,'trees do not change cover or undergrowth');
}
console.log('PASS tree density: '+(count/oldExpected).toFixed(2)+'x previous density on fixed woodland, cliff buffers excluded, woodland geometry unchanged');
`)(require,__dirname);
