"use strict";
const fs=require('node:fs');
const harness=fs.readFileSync(__dirname+'/urban-regression.cjs','utf8').split('let passed=0;')[0];
new Function('require','__dirname',harness+`
run(fs.readFileSync(__dirname+'/../src/regional-biome-rules.js','utf8'));run(moduleFile('regional-landscape'));run(moduleFile('hydrology'));

for(const seed of [1,4,10,229,4242]){
 const variants=[];
 for(const biome of ['hills','valley']){
  run('State.seed='+seed+';State.biome='+JSON.stringify(biome)+';window.__CONQUER_REGIONAL_DEMO__={};State.environment=[];State.structures=[];State.relief=null;generateRelief();generateEnvironment()');
  variants.push(run('JSON.stringify([State.relief.hills,State.environment])'));
  const m=run('(()=>{let woods=0;for(let y=1;y<200;y+=2)for(let x=1;x<200;x+=2)if(State.environment.some(f=>f.type==="forest"&&environmentContains(f,{x,y})))woods++;return{coverage:estimateReliefCoverage(80),woods:woods/10000,streams:State.environment.filter(f=>f.type==="stream").length}})()');
  console.log(seed,biome,JSON.stringify(m));assert.ok(m.coverage>=.30,'hill area minimum');assert.ok(m.woods>=.20&&m.woods<=.30,'woodland coverage');assert.ok(m.streams>=1&&m.streams<=3,'one to three streams');
  assert.ok(run('State.relief.hills.length')>=4&&run('State.relief.hills.length')<=8,'four to eight hills');
 }
 assert.equal(variants[0],variants[1],'Valley aliases hills for seed '+seed);
}
for(const side of ['north','east','south','west']){
 run('window.__CONQUER_REGIONAL_DEMO__={mountainSides:['+JSON.stringify(side)+']};State.seed=1;State.biome="hills";State.relief=null;State.environment=[];generateRelief();generateEnvironment()');
 assert.ok(run('State.relief.hills.length')>=4,'border hills remain');assert.ok(run('estimateReliefCoverage(80)')>=.30,'border hill coverage '+side);
 assert.equal(run('State.biome'),'hills');assert.ok(run('State.environment.some(f=>f.regionalBorder&&f.type==="mountain")'),'mountain range is a border property');
}
console.log('PASS valley and hills share geometry, cover and drainage across five seeds, with 4-8 hills');
`)(require,__dirname);
