'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const noop=()=>{};
const drawing=new Proxy({},{get:()=>noop});
const element={getContext:()=>drawing,style:{},classList:{add:noop,remove:noop,toggle:noop},addEventListener:noop};
const sandbox={window:{__CONQUER_ASSET_LAB__:true,addEventListener:noop},
  document:{getElementById:()=>element,createElement:()=>element,addEventListener:noop},
  console,crypto:{randomUUID:()=> 'qa'},performance:{now:()=>0},navigator:{userAgent:'qa'},
  innerWidth:800,innerHeight:600,devicePixelRatio:1,localStorage:{getItem:()=>null,setItem:noop},
  setTimeout:noop,requestAnimationFrame:noop,location:{search:''}};
const ctx=vm.createContext(sandbox),load=file=>vm.runInContext(read('src/'+file),ctx,{filename:file});
for(const file of ['settlement-core.js','settlement-terraforming.js','settlement-civic-annexes.js','settlement-castle-placement.js',
  'assets/industry-models.js','settlement-industries.js','settlement-events3d.js','settlement-pier.js','settlement-quay.js',
  'settlement-shipyard.js','assets/ship-models.js','settlement-ships.js',
  'settlement-crossings.js','settlement-gate-fittings.js','settlement-keep-entrance.js',
  'settlement-economy.js','settlement-siege.js','settlement-combat-rules.js',
  'assets/siege-engines-model.js','settlement-siege-engines3d.js','codex-catalog.js','settlement-codex.js'])load(file);
const api=sandbox.window.ConquerGameCodex;
const plain=v=>JSON.parse(JSON.stringify(v));
const before=vm.runInContext('JSON.stringify(State)',ctx);
const items=api.list();
assert.equal(new Set(items.map(r=>r.id)).size,items.length);
assert.equal(api.categories.length,7);
for(const c of api.categories)assert.ok(items.some(r=>r.category===c),c+' populated');
assert.equal(api.list({category:'room'}).length,20);
assert.equal(api.list({category:'sub-building'}).length,16);
assert.equal(api.list({category:'ship'}).length,5);
for(const row of items){
  assert.ok(fs.existsSync(path.join(__dirname,'..',row.source.file)),row.source.file);
  assert.equal(row.requirements.knowledge.status,'unmapped');
  for(const r of row.relations)assert.ok(api.get(r.id),r.id);
  for(const a of row.assets)assert.ok(sandbox.window[a.registry]?.[a.collection]?.[a.key],row.id+' asset '+a.key);
}
assert.equal(api.get('not-an-id'),null);
assert.equal(api.quote('missing').cost.status,'not-found');
assert.equal(api.quote('building:tower').cost.status,'context-required');
assert.equal(api.quote('sub-building:church.cemetery').cost.status,'unmapped');
assert.equal(api.quote('unit:infantry').cost.status,'unmapped');
assert.equal(api.quote('building:house',{structure:{type:'house',auto:true}}).cost.status,'unmapped');
assert.equal(api.quote('building:wall',{structure:{type:'wall',length:-1}}).cost.status,'context-required');
assert.equal(api.quote('building:tower',{structure:{type:'gate'}}).cost.status,'incompatible');
// Price and time must match the real Builder for parametrized descriptors.
const cases=[['tower',{type:'tower',shape:'square',size:1.5,level:2}],
 ['tower',{type:'tower',shape:'round',r:.75,level:2,masonryMaterial:'brick'}],
 ['wall',{type:'wall',length:5,level:2}],['built',{type:'built',length:3,level:2}],
 ['clay-quarry',{type:'quarry',extractionMode:'clay'}],['mine',{type:'mine'}],
 ['pier',{type:'pier',reach:4}],['shipyard.2',{type:'pier',yard:2}]];
for(const [key,structure] of cases){
  sandbox.quoteInput=structure;
  const expected=plain(vm.runInContext('({cost:constructionCost(quoteInput),time:buildDuration(quoteInput)})',ctx));
  const q=api.quote('building:'+key,{structure});
  assert.equal(q.cost.status,'known',key);assert.equal(q.time.status,'known',key);
  assert.deepEqual(plain(q.cost.value),expected.cost,key+' cost');assert.equal(q.time.value,expected.time,key+' time');
}
const yard={type:'pier',yard:1};
assert.equal(api.compatible('ship:cocca',{structure:yard}).value,false);
assert.equal(api.compatible('ship:cocca',{structure:{type:'pier',yard:2}}).value,true);
assert.equal(api.compatible('ship:barca',{structure:yard}).value,true);
assert.equal(api.compatible('room:kitchen',{structure:{type:'tower',shape:'square',size:2,level:2},slot:0}).value,false);
const roomInput={type:'built',length:3,level:2,functions:[]};
const roomCopy=JSON.stringify(roomInput);
assert.equal(api.compatible('room:kitchen',{structure:roomInput,slot:0}).value,true);
assert.equal(JSON.stringify(roomInput),roomCopy,'compatibility never modifies supplied structure');
// Detached immutable records, stable IDs independent of mutable labels/prices.
assert.ok(Object.isFrozen(items)&&Object.isFrozen(items[0].properties));
const ids=items.map(r=>r.id);
const shipSpec=sandbox.window.ConquerShipyard.SHIPS.barca;
const original=shipSpec.days;shipSpec.days=original+3;
assert.equal(api.quote('ship:barca').time.value,original+3,'live gameplay data, no cached price table');
shipSpec.days=original;
const industry=sandbox.window.ConquerIndustries.TYPES.mine,oldGold=industry.cost.gold;
industry.cost.gold=oldGold+17;
assert.equal(api.quote('building:mine',{structure:{type:'mine'}}).cost.value.gold,oldGold+17);
industry.cost.gold=oldGold;
assert.deepEqual(api.list().map(r=>r.id),ids);
assert.equal(api.compatible('upgrade:tower.hoarding.on',{structure:{type:'tower',shape:'half'}}).value,false);
assert.equal(api.compatible('upgrade:tower.hoarding.on',{structure:{type:'tower',shape:'square'}}).status,'unmapped');
assert.throws(()=>{api.get('building:mine').properties.cost.gold=0},TypeError);
const snapshot=plain(api.snapshot());
assert.equal(snapshot.schemaVersion,1);assert.equal(snapshot.items.length,items.length);
assert.equal(vm.runInContext('JSON.stringify(State)',ctx),before,'all Codex reads leave game state unchanged');
assert.deepEqual(plain(api.quote('ship:barca').cost.value),plain(shipSpec.cost));
// Portable core works without any gameplay globals; rejects broken adapters.
const standalone=vm.createContext({});vm.runInContext(read('src/codex-catalog.js'),standalone);
const factory=standalone.ConquerCodex;
assert.throws(()=>factory.create(()=>[{id:'bad',category:'building'}]).list(),/Invalid/);
assert.throws(()=>factory.create(()=>[{id:'building:a',category:'building',status:'present',relations:[{id:'building:b'}]}]).list(),/Dangling/);
assert.throws(()=>factory.create(()=>[{id:'building:a',category:'building',status:'present',cost:()=>({status:'known',value:{wood:NaN}})}]).quote('building:a'),/Invalid Codex quote/);
assert.deepEqual(plain(factory.fromSnapshot(snapshot).quote('ship:barca')),plain(api.quote('ship:barca')));
assert.equal(factory.fromSnapshot(snapshot).quote('building:wall').cost.status,'context-required');
assert.throws(()=>factory.fromSnapshot({schemaVersion:2,items:[]}),/Unsupported/);
assert.equal(JSON.stringify(factory.fromSnapshot(snapshot).snapshot()),JSON.stringify(snapshot),'public consumer can read same serialized catalog');
console.log('PASS Codex: '+items.length+' records; seven families, real Builder quotes, live sources, compatibility, serialization and no State writes');
