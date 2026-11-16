"use strict";
const fs=require('node:fs');
const harness=fs.readFileSync(__dirname+'/urban-regression.cjs','utf8').split('let passed=0;')[0];
new Function('require','__dirname',harness+`
run('State.seed=12345;State.biome="plains";State.structures=[];State.relief=null;generateRelief();generateEnvironment()');
const tiny=run('(()=>{const f={id:"tiny-wood",type:"forest",x:100,y:100,rx:2,ry:2,points:[{x:98,y:98},{x:102,y:98},{x:102,y:102},{x:98,y:102}]};return forestTreeLayout(f).length})()');
assert.ok(tiny<=4,'16 square units must not receive a fixed minimum of 14 trees; actual '+tiny);
for(const seed of [12345,4242,229,777,90210]){
 run('State.seed='+seed+';State.environment=[];State.relief=null;generateRelief();generateEnvironment();clearForestLayoutCache()');
 assert.ok(run('State.environment.filter(f=>f.type==="forest").every(f=>JSON.stringify(forestTreeLayout(f))===JSON.stringify(continuousForestTrees(f)))'),'isolated and regional woods use the same spacing rule');
 assert.ok(run('State.environment.filter(f=>f.type==="forest").every(f=>{const trees=forestTreeLayout(f);return trees.every((t,i)=>environmentContains(f,t.p)&&trees.slice(i+1).every(q=>Math.hypot(t.p.x-q.p.x,t.p.y-q.p.y)>1))})'),'trees stay inside actual polygons and cannot pile up');
 const before=run('JSON.stringify(State.environment)');run('State.environment.filter(f=>f.type==="forest").forEach(forestTreeLayout)');assert.equal(run('JSON.stringify(State.environment)'),before,'layout cannot change woodland coverage or saved geometry');
}
console.log('PASS woodland density: tiny woods without minimum crowding, shared spacing in isolated/regional woods, containment and unchanged geometry across five seeds');
`)(require,__dirname);
