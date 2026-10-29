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
const indicator={textContent:''};
const ctx={window:{},performance,console:{warn(){}},document:{getElementById:()=>indicator},
  localStorage:{setItem(){throw new Error('QuotaExceededError')}},localStorageKey:()=>'k',LOCAL_STORAGE_SCHEMA:1,
  LANDSCAPE_GENERATION_VERSION:1,State:new Proxy({},{get:(t,k)=>k==='clock'?{day:0}:k==='view'?{}:undefined})};
assert.equal(vm.runInNewContext(saveSrc+';saveLocal()',ctx),false);
assert.equal(indicator.textContent,'local save failed');

console.log('save-safety regression PASS');
