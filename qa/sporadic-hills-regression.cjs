"use strict";
const fs=require('node:fs');
const harness=fs.readFileSync(__dirname+'/urban-regression.cjs','utf8').split('let passed=0;')[0];
new Function('require','__dirname',harness+`
run(fs.readFileSync(__dirname+'/../src/regional-biome-rules.js','utf8'));run(moduleFile('regional-landscape'));run(moduleFile('hydrology'));
for(const [biome,chance,lo,hi] of [['plains',1/3,1,2],['forest',1/2,2,3],['swamp',1/4,1,1],['sea',.20,1,2],['lake',.20,1,2]]){
 let hits=0;const selected=[];
 for(let seed=1;seed<=3000;seed++){
  run('State.seed='+seed+';State.biome='+JSON.stringify(biome));const plan=run('biomeHillPlan()');
  if(plan.enabled){hits++;assert.ok(plan.count>=lo&&plan.count<=hi);if(selected.length<2)selected.push(seed)}else assert.equal(plan.count,0);
 }
 assert.ok(Math.abs(hits/3000-chance)<.035,biome+' frequency '+hits/3000);
 for(const seed of selected){
  run('State.seed='+seed+';State.biome='+JSON.stringify(biome)+';window.__CONQUER_REGIONAL_DEMO__={};State.structures=[];State.environment=[];State.relief=null;generateRelief();generateEnvironment()');
  const m=run('({count:State.relief.hills.length,steep:reliefLevels().some(l=>l.edgeKinds.includes("steep")),dry:State.relief.hills.every(h=>!reliefHillFootprint(h).some(p=>State.environment.some(f=>(f.type==="sea"||f.type==="pond")&&environmentContains(f,p))))})');
  assert.ok(m.count>=lo&&m.count<=hi,biome+' final count '+m.count);assert.ok(m.steep,biome+' usable rocky slope');assert.ok(m.dry,biome+' hills stay above water');
  const before=run('JSON.stringify([State.relief,State.environment])');run('State.relief=null;generateRelief();generateEnvironment()');assert.equal(run('JSON.stringify([State.relief,State.environment])'),before);
 }
 console.log('PASS '+biome+': '+hits+'/3000 selected ('+(hits/30).toFixed(1)+'%), '+lo+'-'+hi+' hills; demo seeds '+selected.join(','));
}
const dirs=['north','northEast','east','southEast','south','southWest','west','northWest'];
for(const [biome,seed] of [['plains',1],['forest',1],['swamp',7]]){
 const center=biome==='plains'?'forest':'plains',neighbors=Object.fromEntries(dirs.map(d=>[d,biome]));
 run('State.seed='+seed+';State.biome='+JSON.stringify(center)+';window.__CONQUER_REGIONAL_DEMO__={surroundingBiomes:'+JSON.stringify(neighbors)+'};State.structures=[];State.environment=[];State.relief=null;generateRelief();generateEnvironment()');
 assert.ok(run('State.relief.hills.some(h=>h.center.x<50||h.center.x>150||h.center.y<50||h.center.y>150)'),biome+' inherits sparse hills');
}
console.log('PASS inherited sparse hills in all three biomes');
`)(require,__dirname);
