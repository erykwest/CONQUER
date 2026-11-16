"use strict";
const fs=require('node:fs');
const harness=fs.readFileSync(__dirname+'/urban-regression.cjs','utf8').split('let passed=0;')[0];
new Function('require','__dirname',harness+`
run(fs.readFileSync(__dirname+'/../src/regional-biome-rules.js','utf8'));run(moduleFile('regional-landscape'));run(moduleFile('hydrology'));

for(const seed of [1,4,10]){
 const variants=[];
 for(const biome of ['hills','valley']){
  run('State.seed='+seed+';State.biome='+JSON.stringify(biome)+';window.__CONQUER_REGIONAL_DEMO__={};State.environment=[];State.structures=[];State.relief=null;generateRelief();generateEnvironment()');
  variants.push(run('JSON.stringify([State.relief.hills,State.environment])'));
  assert.ok(run('State.relief.hills.length')>=4&&run('State.relief.hills.length')<=8,'four to eight hills');
 }
 assert.equal(variants[0],variants[1],'Valley aliases hills for seed '+seed);
}
console.log('PASS valley and hills share geometry, cover and drainage across three seeds, with 4-8 hills');
`)(require,__dirname);
