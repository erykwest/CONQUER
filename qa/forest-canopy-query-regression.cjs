"use strict";
const fs=require('node:fs');
const harness=fs.readFileSync(__dirname+'/urban-regression.cjs','utf8').split('let passed=0;')[0];
new Function('require','__dirname',harness+`
run('State.seed=4242;State.relief={hills:[]};clearReliefBandCache();State.environment=[{id:"grove-a",type:"forest",points:[{x:40,y:40},{x:100,y:40},{x:100,y:100},{x:40,y:100}]},{id:"grove-b",type:"forest",points:[{x:110,y:100},{x:160,y:100},{x:160,y:160},{x:110,y:160}]}];clearForestLayoutCache()');
const expected=run('JSON.stringify(State.environment.map(f=>forestTreeLayout(f)))');
assert.ok(run('JSON.stringify(State.environment.map(forestTreeLayout))')===expected,'the real World3D Array.map call must keep every grove when caches are warm');
run('clearForestLayoutCache()');
assert.ok(run('JSON.stringify(State.environment.map(forestTreeLayout))')===expected,'cold caches retain the same trees');
run('clearForestLayoutCache()');
const nearby=run('JSON.stringify(forestTreeLayout(State.environment[0],{minX:70,maxX:80,minY:70,maxY:80}))');
assert.equal(nearby,run('JSON.stringify(forestTreeLayout(State.environment[0]).filter(t=>t.p.x>=70&&t.p.x<=80&&t.p.y>=70&&t.p.y<=80))'),'bounded placement queries preserve positions and attributes');
assert.ok(run('JSON.stringify(State.environment.map(forestTreeLayout))')===expected,'a bounded query never poisons the full render cache');
console.log('PASS forest canopy queries: Array.map, cold/warm caches and bounded preflight preserve every grove');
`)(require,__dirname);
