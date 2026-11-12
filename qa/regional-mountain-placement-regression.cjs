'use strict';
const fs=require('node:fs');
const harness=fs.readFileSync(__dirname+'/urban-regression.cjs','utf8').split('let passed=0;')[0];
new Function('require','__dirname',harness+`
run(fs.readFileSync(__dirname+'/../src/regional-biome-rules.js','utf8'));
run(moduleFile('regional-landscape'));
run('State.seed=1555837107;State.biome="mountains";window.__CONQUER_REGIONAL_DEMO__={surroundingBiomes:Object.fromEntries(Object.keys(window.ConquerRegionalBiomeRules.directions).map(k=>[k,"mountains"]))};State.environment=[];State.relief=null;State.structures=[];generateRelief();generateEnvironment()');
assert.equal(run('window.ConquerRegionalLandscape.active()'),true,'T297: uniform mountain neighbours must not fall back to legacy chain placement');
const zones=run('Object.entries(window.ConquerRegionalBiomeRules.directions).map(([name,[dx,dy]])=>({name,count:State.environment.filter(f=>f.type==="mountain"&&f.x>=0&&f.x<=200&&f.y>=0&&f.y<=200&&(dx<0?f.x<50:dx>0?f.x>150:f.x>=50&&f.x<=150)&&(dy<0?f.y<50:dy>0?f.y>150:f.y>=50&&f.y<=150)).length}))');
for(const zone of zones)assert.ok(zone.count>0,'T297 missing mountain chain in '+zone.name);
assert.ok(run('State.environment.some(f=>f.type==="mountain"&&f.x>=50&&f.x<=150&&f.y>=50&&f.y<=150)'),'central mountain recipe remains in central square');
const first=run('JSON.stringify(State.environment)');run('State.environment=[];State.relief=null;generateRelief();generateEnvironment()');assert.equal(run('JSON.stringify(State.environment)'),first,'T297 repeatable');
console.log('PASS regional mountain placement: T297 seed 1555837107, all eight mountain sectors, central recipe and repeatability');
`)(require,__dirname);
