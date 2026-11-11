'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/../src/regional-demo.js','utf8');
const rules=require('../src/regional-biome-rules.js');
function launch(search,payload){
  const context={window:{addEventListener(){},ConquerRegionalBiomeRules:rules},URLSearchParams,location:{search},sessionStorage:{getItem:()=>JSON.stringify(payload)}};
  vm.runInNewContext(source,context);return context.window.__CONQUER_REGIONAL_DEMO__;
}
assert.equal(launch(''),undefined);
assert.equal(launch('?demo=river&seed=4242').biome,'river');
assert.equal(launch('?demo=river&seed=4242').seed,4242);
assert.ok(launch('?regionalDemo=missing').error,'missing context shows an error, never fake plains');
assert.ok(launch('?demo=unknown').error,'malformed demo never opens player save');
assert.equal(launch('?demo=river&seed=bad').seed,4242);
assert.ok(launch('?regionalDemo=abc',{version:1,biome:'plains',seed:123,name:'A1'}).error,'old payload without authoritative terrain cannot masquerade as plains');
for(const [terrain,biome] of Object.entries({plain:'plains',forest:'forest',hills:'mountains',swamp:'swamp'})){
  const payload={version:1,biome:'plains',terrain,seed:123,name:'Foresta è',riverFlow:{x:0,y:1,source:'regional-water-outlet'}};
  const demo=launch('?regionalDemo=abc&regionalData='+encodeURIComponent(JSON.stringify(payload)));
  assert.equal(demo.biome,biome,'central terrain survives missing tab storage: '+terrain);
  assert.equal(demo.name,payload.name);
  assert.deepEqual(JSON.parse(JSON.stringify(demo.riverFlow)),payload.riverFlow,'regional flow survives the URL launch boundary');
}
for(const terrain of ['sea','lake'])assert.ok(launch('?regionalDemo=water',{version:1,terrain,seed:123}).error,'water cells cannot launch a local map');
assert.equal(rules.biomeForTerrain('unknown'),null);
assert.equal(launch('?regionalDemo=abc',{version:1,terrain:'forest',biome:'river',seed:123,hasRiver:true}).biome,'forest','river boundary does not replace central forest');

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
run('window.__CONQUER_REGIONAL_DEMO__={hasRiver:true,riverSides:["east"]};State.seed=4242;State.biome="forest";State.relief=null;State.environment=[];generateRelief();generateEnvironment()');
assert.equal(run('State.biome'),'forest');
assert.ok(run('State.environment.some(f=>f.type==="forest"&&f.continuous)'));
assert.equal(run('State.environment.find(f=>f.type==="river").boundarySide'),'east');
run('window.__CONQUER_REGIONAL_DEMO__={};State.biome="swamp";State.relief=null;State.environment=[];generateRelief();generateEnvironment()');
assert.ok(run('State.environment.some(f=>f.type==="pond")'),'swamp has ponds');
run('State.biome="lake";State.relief=null;State.environment=[];generateRelief();generateEnvironment()');
assert.ok(run('State.environment.some(f=>f.type==="pond"&&environmentContains(f,{x:100,y:100}))'),'lake territory has central water');
run('State.biome="mountains";State.relief=null;State.environment=[];generateRelief();generateEnvironment()');
assert.ok(run('State.environment.some(f=>f.type==="mountain")'),'mountain terrain uses its real recipe');
`);
check(require,__dirname);
console.log('PASS regional demos: validated launch, deterministic seed, isolated local/cloud persistence');
