"use strict";
const fs=require('node:fs');
const harness=fs.readFileSync(__dirname+'/urban-regression.cjs','utf8').split('let passed=0;')[0];
new Function('require','__dirname',harness+`
run(fs.readFileSync(__dirname+'/../src/regional-biome-rules.js','utf8'));run(moduleFile('regional-landscape'));run(moduleFile('hydrology'));
const dirs=['north','northEast','east','southEast','south','southWest','west','northWest'];
for(const seed of [1,4242,229,777,90210,31337])for(const mode of ['standalone','central','inherited']){
 const biome=mode==='inherited'?'plains':'swamp',other=mode==='inherited'?'swamp':'plains';
 const info=mode==='standalone'?{}:{surroundingBiomes:Object.fromEntries(dirs.map(d=>[d,other]))};
 run('window.__CONQUER_REGIONAL_DEMO__='+JSON.stringify(info)+';State.seed='+seed+';State.biome='+JSON.stringify(biome)+';State.structures=[];State.environment=[];State.relief=null;generateRelief();generateEnvironment()');
 const m=run('(()=>{let total=0,woods=0,marsh=0,overlap=0;for(let y=1;y<200;y+=2)for(let x=1;x<200;x+=2){const p={x,y};if(window.ConquerRegionalLandscape.active()&&(window.ConquerRegionalLandscape.weights(p).swamp||0)<.999)continue;total++;const wood=State.environment.some(f=>f.type==="forest"&&environmentContains(f,p)),wet=State.environment.some(f=>f.waterBodyKind==="marsh"&&environmentContains(f,p));if(wood)woods++;if(wet)marsh++;if(wood&&wet)overlap++}return{share:woods/total,water:marsh/total,overlap,ponds:State.environment.filter(f=>f.waterBodyKind==="marsh").length}})()');
 assert.ok(m.share>=.20&&m.share<=.30,'25% woods: '+mode+' seed '+seed+' actual '+m.share);
 assert.ok(m.water>=.20&&m.water<=.30,'20-30% marsh water: '+mode+' seed '+seed+' actual '+m.water);
 assert.equal(m.overlap,0,'woods cannot cover marsh water');
 const before=run('JSON.stringify(State.environment)');run('State.relief=null;generateRelief();generateEnvironment()');assert.equal(run('JSON.stringify(State.environment)'),before);
}
console.log('PASS swamp balance: 20-30% marsh water, 25% woods standalone/central/inherited, water exclusion and determinism across six seeds');
`)(require,__dirname);
