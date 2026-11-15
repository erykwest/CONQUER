"use strict";
const assert=require('node:assert/strict'),rules=require('../src/regional-biome-rules.js');
const a={x:0,y:0},b={x:10,y:0},c={x:20,y:0},branch={x:10,y:10};
const edges=[{start:b,end:a},{start:b,end:c},{start:branch,end:b}];
assert.deepEqual(rules.riverFlow([edges[0]],edges,[c],[]),{x:1,y:0,source:'regional-water-outlet'});
assert.equal(rules.riverFlow([edges[2]],edges,[c],[]).y,-1);
assert.deepEqual(rules.riverFlow([edges[0]],edges,[],[a]),{x:1,y:0,source:'regional-source'});
assert.equal(rules.riverFlow([edges[0]],edges,[],[]),null);
assert.equal(rules.riverFlow([edges[0]],edges,[{x:100,y:100}],[]),null);
console.log('PASS regional flow: outlet priority, source fallback, unordered edges, tributary direction and explicit absence');

const fs=require('node:fs');
const harness=fs.readFileSync(__dirname+'/urban-regression.cjs','utf8').split('let passed=0;')[0];
new Function('require','__dirname',harness+`
run(moduleFile('hydrology'));
assert.equal(run('(()=>{const f=window.ConquerHydrology.orientPrimary({id:"flow-test",points:[{x:10,y:100},{x:190,y:100}]},{riverFlow:{x:-1,y:0,source:"regional-water-outlet"}});return f.points[0].x})()'),190,'regional westward flow reverses the primary');
assert.equal(run('(()=>{const f=window.ConquerHydrology.orientPrimary({id:"flow-test",points:[{x:10,y:100},{x:190,y:100}],mouth:{kind:"sea",point:{x:190,y:100}}},{riverFlow:{x:-1,y:0}});return f.flow.source+":"+f.points.at(-1).x})()'),'local-mouth:190','real mouth takes precedence over approximate regional direction');
assert.ok(run('(()=>{const make=()=>window.ConquerHydrology.orientPrimary({id:"flow-test",points:[{x:10,y:100},{x:190,y:100}]},{});return JSON.stringify(make())===JSON.stringify(make())&&make().flow.source==="seeded-fallback"})()'),'fallback direction is stable');
console.log('PASS local flow orientation: regional vector, receiving mouth priority and deterministic fallback');
`)(require,__dirname);
