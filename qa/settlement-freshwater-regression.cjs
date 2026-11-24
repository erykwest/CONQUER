'use strict';
const fs=require('node:fs');
const harness=fs.readFileSync(__dirname+'/urban-regression.cjs','utf8').split('let passed=0;')[0];
new Function('require','__dirname',harness+`
run(fs.readFileSync(__dirname+'/../src/regional-biome-rules.js','utf8'));
for(const name of ['regional-landscape','hydrology','industries','coast','placement'])run(moduleFile(name));
run('globalThis.qaBank=()=>{for(let y=53;y<148;y++)for(let x=53;x<148;x++){const pit=window.ConquerIndustries.make("quarry",{x,y},"clay");const water=window.ConquerIndustries.nearestClayWater(pit);if(water.water&&water.water.waterBodyKind!=="marsh"&&water.distance<=6&&window.ConquerPlacement.check(pit).ok)return pit}return null}');
for(const [biome,seed] of [['plains',229],['sea',12345],['forest',3],['swamp',7],['hills',4242]]){
 run('window.__CONQUER_REGIONAL_DEMO__={};State.biome='+JSON.stringify(biome)+';State.seed='+seed+';State.structures=[];State.environment=[];State.relief=null;generateRelief();generateEnvironment()');
 assert.ok(run('qaBank()'),'a real 4x4 clay pit fits an inland bank: '+biome+' '+seed);
 const first=run('JSON.stringify(State.environment)');
 run('State.environment=[];State.relief=null;generateRelief();generateEnvironment()');
 assert.equal(run('JSON.stringify(State.environment)'),first,'repeatable '+biome);
 run('ensureSettlementFreshwater(State.environment)');
 assert.equal(run('JSON.stringify(State.environment)'),first,'idempotent '+biome);
 console.log('PASS freshwater and clay access '+biome+' '+seed);
}
// A watercourse outside the whitezone does not supply the settlement.
run('State.biome="plains";State.relief={hills:[]};clearReliefBandCache();State.environment=[{id:"distant",type:"stream",width:1,points:[{x:10,y:0},{x:10,y:200}]}];ensureSettlementFreshwater(State.environment)');
assert.ok(run('qaBank()'),'distant stream needs an accessible pond');
assert.equal(run('State.environment.filter(f=>f.type==="pond").length'),1);
// Dense woodland can require a local clearing for the pond and dry bank.
run('State.environment=[{id:"woods",type:"forest",points:[{x:0,y:0},{x:200,y:0},{x:200,y:200},{x:0,y:200}]}];ensureSettlementFreshwater(State.environment)');
assert.ok(run('qaBank()'),'cleared woodland bank is usable through shared placement');
assert.equal(run('State.environment[0].holes.length'),1);
console.log('PASS distant water, dense woodland, real placement and repeatability');
`)(require,__dirname);
