"use strict";
const fs=require('node:fs');
const harness=fs.readFileSync(__dirname+'/urban-regression.cjs','utf8').split('let passed=0;')[0];
new Function('require','__dirname',harness+`
run(fs.readFileSync(__dirname+'/../src/regional-biome-rules.js','utf8'));run(moduleFile('regional-landscape'));run(moduleFile('hydrology'));
for(const [biome,seed] of [['forest',1],['forest',3],['swamp',7],['plains',1]]){
 run('State.seed='+seed+';State.biome='+JSON.stringify(biome)+';State.environment=[];State.relief=null;State.structures=[];generateRelief();generateEnvironment();clearForestLayoutCache()');
 assert.equal(run('(()=>{const ready=forestTreeSpritesReady;forestTreeSpritesReady=false;const drawn=drawForestShrub({});forestTreeSpritesReady=ready;return drawn})()'),false,'3D ground bake never paints bushes flat');
 const before=run('JSON.stringify(State.environment)');
 const shrubs=run('State.environment.filter(f=>f.type==="forest").flatMap(forestShrubLayout)');assert.ok(shrubs.length>0,'visible shrub layer exists in '+biome);assert.ok(shrubs.some(b=>b.flip)&&shrubs.some(b=>!b.flip),'both horizontal orientations');
 assert.ok(run('State.environment.filter(f=>f.type==="forest").every(f=>forestShrubLayout(f).every(b=>environmentContains(f,b.p)&&Math.abs(b.z-terrainElevation(b.p))<1e-8&&terrainSlopeKind(b.p)!=="steep"))'),'shrub roots follow legal terrain');
 run('State.environment.filter(f=>f.type==="forest").forEach(forestTreeLayout);clearForestLayoutCache()');
 assert.equal(run('JSON.stringify(State.environment.filter(f=>f.type==="forest").flatMap(forestShrubLayout))'),JSON.stringify(shrubs),'tree rendering does not change shrub placement');
 assert.equal(run('JSON.stringify(State.environment)'),before,'shrub render does not alter woodland coverage');
}
console.log('PASS real forest shrubs: separate deterministic layer, real terrain height, exposed cliffs, unchanged cover across four fixtures');
`)(require,__dirname);
