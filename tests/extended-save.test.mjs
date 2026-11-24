import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './helpers/persistence-fixture.mjs';
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject}}

test('an edit made while cloud save is pending remains unsaved',async()=>{
  const pending=deferred(),f=fixture({writeCloud:()=>pending.promise});
  await f.run('loadCloud()');
  const saving=f.run('saveCloud()');
  await Promise.resolve();
  f.State.resources.gold=20;f.State.dirty=true;
  pending.resolve({});await saving;
  assert.equal(f.writes[0].resources.gold,10,'the sent snapshot is independent of live state');
  assert.equal(f.State.dirty,true,'an old acknowledgement cannot clear later edits');
  assert.equal(f.element('saveState').textContent,'unsaved');
});

test('cloud uploads are ordered and the latest requested snapshot wins',async()=>{
  const first=deferred(),second=deferred();
  const f=fixture({writeCloud:()=>f.writes.length===1?first.promise:second.promise});
  await f.run('loadCloud()');
  const a=f.run('saveCloud()');await Promise.resolve();
  f.State.resources.gold=20;
  const b=f.run('saveCloud()');await Promise.resolve();
  assert.equal(f.writes.length,1,'second upsert cannot race the first');
  first.resolve({});await a;await Promise.resolve();
  assert.equal(f.writes.length,2);assert.equal(f.writes[1].resources.gold,20);
  second.resolve({});await b;
  assert.equal(f.State.dirty,false);assert.equal(f.element('saveState').textContent,'saved cloud');
});

test('cloud writes wait for a successful initial read, including an empty slot',async()=>{
  const read=deferred(),f=fixture({readCloud:()=>read.promise});
  assert.equal(await f.run('saveCloud()'),false);
  assert.equal(f.writes.length,0);
  const loading=f.run('loadCloud()');
  assert.equal(await f.run('saveCloud()'),false);assert.equal(f.writes.length,0);
  read.resolve({data:null});await loading;
  assert.equal(await f.run('saveCloud()'),true);assert.equal(f.writes.length,1);
});

for(const camp of [false,true])test('local quota failure is not reported as saved, camp='+camp,async()=>{
  const f=fixture({quota:true});f.State.user=null;f.ctx.window.__CONQUER_CAMP_MODE__=camp;
  assert.equal(await f.run('saveCloud()'),false);
  assert.equal(f.State.dirty,true);assert.equal(f.element('saveState').textContent,'local save failed');
});

for(const thrown of [false,true])test('failed cloud read blocks uploads until a successful retry, thrown='+thrown,async()=>{
  let fail=true;
  const f=fixture({readCloud:async()=>{if(fail){if(thrown)throw Error('offline');return{error:{message:'denied'}}}return{data:null}}});
  assert.equal(await f.run('loadCloud()'),false);assert.equal(await f.run('saveCloud()'),false);assert.equal(f.writes.length,0);
  fail=false;assert.equal(await f.run('loadCloud()'),true);assert.equal(await f.run('saveCloud()'),true);
});

for(const thrown of [false,true])test('a failed upload does not poison the queue, thrown='+thrown,async()=>{
  let fail=true;
  const f=fixture({writeCloud:async()=>{if(fail){if(thrown)throw Error('offline');return{error:{message:'denied'}}}return{}}});
  await f.run('loadCloud()');assert.equal(await f.run('saveCloud()'),false);
  assert.equal(f.State.dirty,true);assert.equal(f.element('saveState').textContent,'cloud error');
  fail=false;assert.equal(await f.run('saveCloud()'),true);assert.equal(f.State.dirty,false);
});

for(const change of ['world','account'])test('old acknowledgements and queued writes cannot touch a different '+change,async()=>{
  const pending=deferred(),f=fixture({writeCloud:()=>pending.promise});await f.run('loadCloud()');
  const a=f.run('saveCloud()');await Promise.resolve();
  const b=f.run('saveCloud()');
  if(change==='world'){f.State.seed=8;f.State.village={...f.State.village}}
  else f.State.user={id:'someone-else'};
  f.State.dirty=true;f.element('saveState').textContent='unsaved';
  pending.resolve({});assert.equal(await a,false);assert.equal(await b,false);
  assert.equal(f.writes.length,1);assert.equal(f.State.dirty,true);assert.equal(f.element('saveState').textContent,'unsaved');
});

for(const mode of ['__CONQUER_ASSET_LAB__','__CONQUER_REGIONAL_DEMO__'])test(mode+' cannot upload even with an authenticated session',async()=>{
  const f=fixture();await f.run('loadCloud()');f.ctx.window[mode]=true;await f.run('saveCloud()');assert.equal(f.writes.length,0);
});

test('snapshot adapters preserve the local format and detach every nested cloud value',()=>{
  const f=fixture(),api=f.ctx.window.ConquerSaveSnapshot;
  f.State.structures=[{id:'house',type:'house',residents:[{name:'A'}]}];
  f.State.village={founded:true,growthVersion:3};
  const snapshot=api.capture(f.State,{schema:2,landscapeVersion:1});
  const row=api.cloud(snapshot,{userId:'owner',updatedAt:'fixed'}),back=api.fromCloud(row);
  assert.equal(row.updated_at,'fixed');assert.equal(row.user_id,'owner');assert.equal(row.world_cell_x,0);
  assert.equal(row.policies.clock.day,0);assert.equal('schema' in row.policies,false);
  assert.equal(back.seed,7);assert.equal(back.resources.gold,10);assert.equal(back.structures[0].residents[0].name,'A');
  f.State.resources.gold=30;f.State.structures[0].residents[0].name='B';
  assert.equal(JSON.parse(snapshot).structures[0].residents[0].name,'A');assert.equal(row.resources.gold,10);
  assert.deepEqual(JSON.parse(JSON.stringify(back.view)),{rotation:0});
});

for(const transport of ['local','cloud'])test(transport+' restore retains saved resources and migration order',async()=>{
  const events=[],saved={seed:11,biome:'plains',structures:[],resources:{gold:0,wood:7},policies:{tax:33,rations:50},
    village:{founded:true,growthVersion:3,socialSchemaVersion:2,privateMasonryMaterial:'brick'},clock:{day:12},
    season:'spring',seasonOverride:null,landscape:{version:1,relief:{hills:[]},environment:[]},view:{rotation:3}};
  const f=fixture();const api=f.ctx.window.ConquerSaveSnapshot;
  f.ctx.window.ConquerSocialClasses={migrateSave:s=>{events.push('migrate');return{structures:s}}};
  f.ctx.window.ConquerSiege={restore:()=>events.push('siege')};
  if(transport==='local'){
    f.storage.set('conquer.settlement.0.0',JSON.stringify(saved));f.run('loadLocal()');
    assert.deepEqual(events,['migrate','siege']);
  }else{
    const row=api.cloud(JSON.stringify(saved),{userId:'owner'});
    f.State.supabase={from:()=>({select(){return this},eq(){return this},maybeSingle:async()=>({data:row})})};
    assert.equal(await f.run('loadCloud()'),true);assert.deepEqual(events,['siege','migrate']);
  }
  assert.equal(f.State.resources.gold,0);assert.equal(f.State.resources.wood,7);
  assert.equal(f.State.view.rotation,3);assert.equal(f.State.clock.day,12);
  assert.equal(f.State.village.privateMasonryMaterial,'brick');assert.equal(f.State.season,'spring');
});

test('a cloud record that fails migration is backed up and cannot be overwritten',async()=>{
  const row={terrain_seed:7,biome:'plains',structures:[null],resources:{gold:10},policies:{}};
  const f=fixture({readCloud:async()=>({data:row})});
  assert.equal(await f.run('loadCloud()'),false);await f.run('saveCloud()');assert.equal(f.writes.length,0);
  assert.equal(!!f.State.loadFailed,true);assert.ok([...f.storage.keys()].some(k=>k.includes('.corrupt.')));
});

for(const populated of [false,true])for(const quota of [false,true])test('initial cloud read finishes its indicator, populated='+populated+', quota='+quota,async()=>{
  const f=fixture({quota});
  const snapshot=f.ctx.window.ConquerSaveSnapshot.capture(f.State,{schema:2,landscapeVersion:1});
  const row=f.ctx.window.ConquerSaveSnapshot.cloud(snapshot,{userId:'owner'});
  const client={auth:{getSession:async()=>({data:{session:{user:{id:'owner'}}}})},
    from:()=>({select(){return this},eq(){return this},maybeSingle:async()=>({data:populated?row:null})})};
  f.ctx.window.__createSupabaseClient=()=>client;f.ctx.SUPABASE_URL='test';f.ctx.SUPABASE_KEY='test';
  await f.run('initSupabase()');
  assert.equal(f.run('cloudRead.status'),'ready');
  assert.equal(f.element('saveState').textContent,populated?(quota?'local save failed':'saved local'):'unsaved');
});

for(const change of ['world','account','read'])test('a stale cloud read cannot replace a newer '+change,async()=>{
  const pending=deferred(),f=fixture({readCloud:()=>pending.promise});
  const loading=f.run('loadCloud()');
  if(change==='world')f.State.seed=8;
  else if(change==='account')f.State.user={id:'someone-else'};
  else{f.State.supabase={from:()=>({select(){return this},eq(){return this},maybeSingle:async()=>({data:null})})};await f.run('loadCloud()')}
  pending.resolve({data:{terrain_seed:999,resources:{gold:999},policies:{}}});
  assert.equal(await loading,false);assert.notEqual(f.State.seed,999);assert.equal(f.State.resources.gold,10);
});
