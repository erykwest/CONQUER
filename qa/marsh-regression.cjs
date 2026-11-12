"use strict";
const fs=require('node:fs');
const harness=fs.readFileSync(__dirname+'/urban-regression.cjs','utf8').split('let passed=0;')[0];
new Function('require','__dirname',harness+`
run(fs.readFileSync(__dirname+'/../src/regional-biome-rules.js','utf8'));run(moduleFile('regional-landscape'));run(moduleFile('hydrology'));
const dirs=['north','northEast','east','southEast','south','southWest','west','northWest'];
for(const fixture of [{biome:'swamp',seed:1},{biome:'swamp',seed:4242},{biome:'swamp',seed:229,surrounding:'plains'},{biome:'plains',seed:777,surrounding:'swamp'},{biome:'swamp',seed:90210,surrounding:'lake'}]){
 const info=fixture.surrounding?{surroundingBiomes:Object.fromEntries(dirs.map(d=>[d,fixture.surrounding]))}:{};
 run('window.__CONQUER_REGIONAL_DEMO__='+JSON.stringify(info)+';State.biome='+JSON.stringify(fixture.biome)+';State.seed='+fixture.seed+';State.structures=[];State.relief=null;State.environment=[];generateRelief();generateEnvironment()');
 assert.ok(run('State.environment.some(f=>f.type==="pond"&&f.waterBodyKind==="marsh")'),'swamp creates actual marsh water, seed '+fixture.seed);
 assert.ok(run('State.environment.filter(f=>f.waterBodyKind==="marsh").every(f=>{const c=f.fill.slice(1).match(/../g).map(v=>parseInt(v,16));return c[0]>c[2]&&c[1]>c[2]&&f.type==="pond"&&f.points.length>=3})'),'brown-green water shares pond collision');
 assert.ok(run('State.environment.filter(f=>f.mouth).every(f=>State.environment.find(b=>b.id===f.mouth.receiverId)?.waterBodyKind!=="marsh")'),'marsh is not a forced river mouth');
 const before=run('JSON.stringify(State.environment)');run('State.relief=null;generateRelief();generateEnvironment()');assert.equal(run('JSON.stringify(State.environment)'),before,'deterministic marsh polygons');
}
run('window.__CONQUER_REGIONAL_DEMO__={};State.biome="forest";State.seed=4242;State.relief=null;State.environment=[];generateRelief();generateEnvironment()');
assert.equal(run('State.environment.some(f=>f.waterBodyKind==="marsh")'),false,'ordinary forest ponds retain fresh-water appearance');
console.log('PASS marsh: real brown-green ponds, central/inherited swamp, fresh-water separation, no forced mouths and five deterministic fixtures');
`)(require,__dirname);
