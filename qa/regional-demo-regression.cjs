'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/../src/regional-demo.js','utf8');
function launch(search,payload){
  const context={window:{addEventListener(){}},URLSearchParams,location:{search},sessionStorage:{getItem:()=>JSON.stringify(payload)}};
  vm.runInNewContext(source,context);return context.window.__CONQUER_REGIONAL_DEMO__;
}
assert.equal(launch(''),undefined);
assert.equal(launch('?demo=river&seed=4242').biome,'river');
assert.equal(launch('?demo=river&seed=4242').seed,4242);
assert.equal(launch('?regionalDemo=missing').biome,'plains','missing session stays in a sandbox');
assert.equal(launch('?demo=unknown').biome,'plains','malformed demo never opens player save');
assert.equal(launch('?demo=river&seed=bad').seed,4242);
assert.equal(launch('?regionalDemo=abc',{version:1,biome:'forest',seed:123,name:'A1'}).seed,123);

// Exercise the real shared runtime with a demo flag before core/bootstrap loads.
const harness=fs.readFileSync(__dirname+'/urban-regression.cjs','utf8').split('let passed=0;')[0]
  .replace('const context=vm.createContext(sandbox);','sandbox.window.__CONQUER_REGIONAL_DEMO__={seed:4242,biome:"river"};const context=vm.createContext(sandbox);');
const check=new Function('require','__dirname',harness+`
assert.equal(run('initialSeed'),4242);
assert.equal(run('State.biome'),'river');
run(fs.readFileSync(__dirname+'/../src/settlement-app-persistence.js','utf8'));
const before=JSON.stringify([...storage]);
run('saveLocal();loadLocal();initSupabase();loadCloud();saveCloud()');
assert.equal(JSON.stringify([...storage]),before,'demo does not mutate any local player storage');
assert.equal(run('State.supabase'),null,'cloud stays disconnected');
assert.equal(run('localStorageKey()'),'conquer.regional-demo.sandbox');
`);
check(require,__dirname);
console.log('PASS regional demos: validated launch, deterministic seed, isolated local/cloud persistence');
