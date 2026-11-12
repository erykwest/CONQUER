'use strict';
const fs=require('node:fs');
const harness=fs.readFileSync(__dirname+'/urban-regression.cjs','utf8').split('let passed=0;')[0];
new Function('require','__dirname',harness+`
run(fs.readFileSync(__dirname+'/../src/regional-biome-rules.js','utf8'));run(moduleFile('regional-landscape'));run(moduleFile('hydrology'));
const mixed={north:'forest',northEast:'plains',east:'mountains',southEast:'plains',south:'sea',southWest:'sea',west:'plains',northWest:'swamp'};
for(const seed of [12345,4242,229,777,90210,31337])for(const surrounding of [null,mixed]){
  run('window.__CONQUER_REGIONAL_DEMO__='+JSON.stringify(surrounding?{surroundingBiomes:surrounding}:null)+';State.seed='+seed+';State.biome="plains";State.structures=[];State.environment=[];State.relief=null;generateRelief();generateEnvironment()');
  const metrics=run('(()=>{const forests=State.environment.filter(f=>f.type==="forest"),groups=[{total:0,woods:0},{total:0,woods:0}];for(let y=.5;y<200;y++)for(let x=.5;x<200;x++){const p={x,y};if(window.__CONQUER_REGIONAL_DEMO__&&(window.ConquerRegionalLandscape.weights(p).plains||0)<.999)continue;const g=groups[x>=50&&x<150&&y>=50&&y<150?0:1];g.total++;if(forests.some(f=>environmentContains(f,p)))g.woods++}return groups})()');
  const shares=surrounding?metrics.map(g=>g.woods/g.total):[metrics.reduce((s,g)=>s+g.woods,0)/metrics.reduce((s,g)=>s+g.total,0)];
  for(const share of shares)assert.ok(Math.abs(share-.20)<.015,'seed '+seed+' '+(surrounding?'regional':'standalone')+' woodland share '+share);
  assert.equal(run('State.environment.some(f=>f.type==="forest"&&environmentContains(f,{x:100,y:100}))'),false,'settlement hub stays clear');
  const before=run('JSON.stringify(State.environment)');run('State.relief=null;generateRelief();generateEnvironment()');assert.equal(run('JSON.stringify(State.environment)'),before,'same seed gives the same woods');
}
console.log('PASS boschi in Pianura: 20% coverage across six seeds, standalone and mixed regional centre/inherited plains, clear hub and determinism');
`)(require,__dirname);
