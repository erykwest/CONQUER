import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInContext,createContext} from 'node:vm';

const read=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
const persistence=read('src/settlement-app-persistence.js');
const cloud=persistence.slice(persistence.indexOf('// Cloud writes require'),persistence.indexOf("document.getElementById('saveBtn')"));
function fixture({read=async()=>({data:null}),write=async()=>({}),localSaved=true,user=true}={}){
  const indicator={textContent:''},calls={local:0,writes:0},messages=[];
  const query={select(){return this},eq(){return this},maybeSingle:read,
    upsert:async()=>{calls.writes++;return write()}};
  const ctx=createContext({window:{},console:{warn(){},error(){}},
    document:{getElementById:()=>indicator},status:m=>messages.push(m),
    saveBlocked:()=>false,saveLocal:()=>{calls.local++;return localSaved},
    LANDSCAPE_GENERATION_VERSION:1,
    State:{user:user?{id:'owner'}:null,supabase:{from:()=>query},seed:7,dirty:true,
      resources:{gold:5},clock:{day:0}},
  });
  runInContext(cloud,ctx);
  return {ctx,calls,indicator,messages,load:()=>runInContext('loadCloud()',ctx),save:()=>runInContext('saveCloud()',ctx)};
}

test('cloud writes are blocked before and during the initial read',async()=>{
  let finish;
  const f=fixture({read:()=>new Promise(resolve=>{finish=resolve})});
  assert.equal(await f.save(),false);
  const pending=f.load();
  assert.equal(await f.save(),false);
  assert.equal(f.calls.writes,0);
  finish({data:null});await pending;
  assert.equal(await f.save(),true);
  assert.equal(f.calls.writes,1);
});
for(const thrown of [false,true])test('failed cloud read blocks writes and a successful retry recovers, thrown='+thrown,async()=>{
  let fail=true;
  const f=fixture({read:async()=>{
    if(fail){if(thrown)throw Error('network');return {error:{message:'unavailable'}}}
    return {data:null};
  }});
  assert.equal(await f.load(),false);
  assert.equal(await f.save(),false);
  assert.equal(f.calls.writes,0);
  assert.ok(f.messages.some(m=>m.includes('Cloud non caricato')));
  fail=false;assert.equal(await f.load(),true);
  assert.equal(await f.save(),true);assert.equal(f.calls.writes,1);
});
for(const camp of [false,true])test('a failed local write stays failed and dirty, camp='+camp,async()=>{
  const f=fixture({localSaved:false,user:false});
  f.ctx.window.__CONQUER_CAMP_MODE__=camp;
  f.indicator.textContent='local save failed';
  assert.equal(await f.save(),false);
  assert.equal(f.indicator.textContent,'local save failed');
  assert.equal(f.ctx.State.dirty,true);
});
test('successful local save clears dirty',async()=>{
  const f=fixture({user:false});assert.equal(await f.save(),true);
  assert.equal(f.ctx.State.dirty,false);assert.equal(f.indicator.textContent,'saved local');
});
for(const thrown of [false,true])test('failed cloud write stays dirty without an unhandled rejection, thrown='+thrown,async()=>{
  const f=fixture({write:async()=>{if(thrown)throw Error('offline');return {error:{message:'denied'}}}});
  await f.load();assert.equal(await f.save(),false);
  assert.equal(f.ctx.State.dirty,true);assert.equal(f.indicator.textContent,'cloud error');
});
test('asset lab cannot save to cloud even with a session',async()=>{
  const f=fixture();await f.load();f.ctx.window.__CONQUER_ASSET_LAB__=true;
  await f.save();assert.equal(f.calls.writes,0);assert.equal(f.calls.local,0);
});
test('a cloud migration failure keeps the unreadable row blocked',async()=>{
  const data={terrain_seed:7,biome:'plains',resources:{gold:5},structures:[]};
  const f=fixture({read:async()=>({data})});
  f.ctx.BIOMES={plains:{}};
  f.ctx.migrateStructures=()=>{throw Error('broken structure')};
  let backup;
  f.ctx.markLoadFailed=raw=>{backup=raw;f.ctx.State.loadFailed={seed:7}};
  assert.equal(await f.load(),false);
  assert.equal(backup,JSON.stringify(data));
  assert.equal(await f.save(),false);assert.equal(f.calls.writes,0);
});

test('resource names and values are inserted as text, including HTML payloads',()=>{
  const src=read('src/settlement-app-calendar-ui.js');
  const fn=src.slice(src.indexOf('function renderResourceBar('),src.indexOf('function renderUI('));
  function element(){return {children:[],textContent:'',attrs:{},setAttribute(k,v){this.attrs[k]=String(v)},append(child){this.children.push(child)},
    replaceChildren(fragment){this.children=fragment.children},
    set innerHTML(_){throw Error('untrusted HTML insertion')}}}
  const host=element(),document={getElementById:()=>host,createElement:element,createDocumentFragment:element};
  const payload='<img src=x onerror=alert(1)>';
  runInContext(fn+';renderResourceBar(resources,icons)',createContext({document,
    resources:{gold:12,[payload]:payload,constructor:3},icons:{gold:'coin'}}));
  assert.equal(host.children.length,3);
  // Icon only (key when no icon); the name goes to the tooltip, as text.
  assert.equal(host.children[0].textContent,'coin ');
  assert.equal(host.children[0].title,'gold');
  assert.equal(host.children[0].children[0].textContent,'12');
  assert.equal(host.children[1].textContent,`${payload} `);
  assert.equal(host.children[1].title,payload);
  assert.equal(host.children[1].children[0].textContent,payload);
  assert.equal(host.children[2].textContent,'constructor ');
  assert.match(src,/renderResourceBar\(State\.resources,icons\)/);
});
