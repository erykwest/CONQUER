'use strict';
// Save safety (ported from audit-hardening #16): local saves survive storage failures and loads
// never inflate resources outside DEV.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const src=fs.readFileSync(__dirname+'/../src/settlement-app-persistence.js','utf8');

assert.match(src,/function saveLocal\(\)\{[\s\S]*?try\{localStorage\.setItem/,'saveLocal must trap setItem failures');
assert.match(src,/CONQUER local save failed/);
assert.doesNotMatch(src,/Math\.max\(10000,/,'no unconditional 10000 resource floor on load');
assert.equal((src.match(/Math\.max\(loadResourceFloor\(\),Number\(State\.resources\[k\]\)\|\|0\)/g)||[]).length,2,'local and cloud loads use the DEV-only floor');

// loadResourceFloor: 10000 only with ?dev=1 or the remembered conquer.dev flag.
const fnSrc=src.match(/function loadResourceFloor\(\)\{[\s\S]*?\n\}/)[0];
function floor(search,stored,throws){
  const ctx={URLSearchParams,location:{search},localStorage:{getItem:k=>{if(throws)throw new Error('blocked');return k==='conquer.dev'?stored:null}}};
  return vm.runInNewContext(fnSrc+';loadResourceFloor()',ctx);
}
assert.equal(floor('',null),0);
assert.equal(floor('?dev=1',null),10000);
assert.equal(floor('?dev=0','1'),0);
assert.equal(floor('','1'),10000);
assert.equal(floor('',null,true),0);

// saveLocal returns false (and does not throw) when storage is full.
const saveSrc=src.match(/function saveLocal\(\)\{[\s\S]*?\n\}/)[0];
const guardSrc=src.slice(src.indexOf('function markLoadFailed('),src.indexOf('let localSaveTimer='));
const indicator={textContent:''};
const ctx={window:{},performance,console:{warn(){}},document:{getElementById:()=>indicator},
  localStorage:{setItem(){throw new Error('QuotaExceededError')}},localStorageKey:()=>'k',LOCAL_STORAGE_SCHEMA:1,
  LANDSCAPE_GENERATION_VERSION:1,State:new Proxy({},{get:(t,k)=>k==='clock'?{day:0}:k==='view'?{}:undefined})};
assert.equal(vm.runInNewContext(guardSrc+saveSrc+';saveLocal()',ctx),false);
assert.equal(indicator.textContent,'local save failed');

// A load that throws half-way keeps the stored save: it is backed up once, autosave refuses to write
// over it, the player is told in Italian; a new map (new seed) or a good load lets saving resume.
const store=new Map(),msgs=[];
const ls={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k),
  key:i=>[...store.keys()][i]??null,get length(){return store.size}};
const good=JSON.stringify({seed:7,structures:[{id:'t',type:'tower'}],village:{founded:true}});
store.set('k',good);
const lctx=vm.createContext({window:{},performance,console:{warn(){}},document:{getElementById:()=>indicator},localStorage:ls,
  localStorageKey:()=>'k',LOCAL_STORAGE_SCHEMA:2,LANDSCAPE_GENERATION_VERSION:1,BIOMES:{},status:m=>msgs.push(m),
  migrateStructures:()=>{throw new Error('broken record')},
  State:{seed:1,clock:{day:0},view:{},resources:{},policies:{},village:{},structures:[]}});
const loadSrc=src.slice(src.indexOf('function loadLocal(){'),src.indexOf('async function initSupabase('));
vm.runInContext(guardSrc+saveSrc+'\n'+loadSrc,lctx);
const backups=()=>[...store.keys()].filter(k=>k.startsWith('k.corrupt.'));
vm.runInContext('loadLocal()',lctx);
assert.ok(lctx.State.loadFailed,'the failed load is flagged');
assert.equal(vm.runInContext('saveLocal()',lctx),false,'autosave refuses to write');
assert.equal(store.get('k'),good,'the stored save is not overwritten');
assert.equal(backups().length,1);assert.equal(store.get(backups()[0]),good,'a copy is set aside');
assert.match(msgs.join('\n'),/Salvataggio non caricato/,'the player is told');
vm.runInContext('loadLocal()',lctx);assert.equal(backups().length,1,'the same broken save is not copied twice');
store.set('k.corrupt.1','old1');store.set('k.corrupt.2','old2');vm.runInContext('loadLocal()',lctx);
assert.equal(backups().length,2,'at most the latest 2 copies');assert.ok(backups().every(k=>k!=='k.corrupt.1'));
assert.match(src,/catch\(err\)\{markLoadFailed\(JSON\.stringify\(data\),err\);return\}State\.loadFailed=false;/,'cloud load: same guard, a good load clears it');
// The regional demo (#162) returns before any save; otherwise the guard is the first check.
assert.match(src,/async function saveCloud\(\)\{(?:if\(window\.__CONQUER_REGIONAL_DEMO__\)\{[^}]*\})?if\(saveBlocked\(\)\)/,'cloud save refuses too');
lctx.State.seed=99;   // generateNewMap draws a fresh seed
assert.equal(vm.runInContext('saveLocal()',lctx),true,'a new map saves again');
assert.equal(lctx.State.loadFailed,false);assert.notEqual(store.get('k'),good);

console.log('save-safety regression PASS');
