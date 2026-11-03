import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
const source=read('api/telemetry.js');
const {default:handler}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
function response(){return{headers:{},code:null,body:null,setHeader(k,v){this.headers[k]=v},status(n){this.code=n;return this},json(v){this.body=v;return this}}}
for(const method of ['GET','POST','OPTIONS'])test('disabled telemetry rejects '+method+' without reading request payload',async()=>{
  const req={method,get body(){throw Error('must not read public payload')}};
  const res=response();await handler(req,res);
  assert.equal(res.code,404);assert.equal(res.body.error,'telemetry_disabled');
  assert.equal('samples' in res.body,false);assert.match(res.headers['cache-control'],/no-store/);
});
for(const assetLab of [false,true])test('local diagnostics without network writes, asset lab='+assetLab,()=>{
  const core=read('src/settlement-core.js'),pos=core.indexOf('function sendRemote');
  const start=core.lastIndexOf('(function(){',pos),end=core.indexOf('})();',pos)+5;
  assert.ok(start>=0&&end>pos);
  let now=0,requests=0;const window={__CONQUER_ASSET_LAB__:assetLab};
  const sandbox={window,State:{clock:{day:4,speed:1},structures:[]},
    crypto:{randomUUID:()=> 'local-diagnostics'},performance:{now:()=>now},
    navigator:{userAgent:'QA'},innerWidth:800,innerHeight:600,devicePixelRatio:1,
    document:{getElementById:()=>null},fetch(){requests++;throw Error('unexpected request')}};
  runInNewContext(core.slice(start,end),sandbox);
  const api=window.__conquerAnalytics;
  for(now=11000;now<=33000;now+=11000){api.frame(now,60);api.sample(now)}
  api.event('LOCAL_QA',{ok:true});const snapshot=api.snapshot();
  assert.ok(snapshot.samples.length>=3);assert.ok(snapshot.events.some(e=>e.type==='LOCAL_QA'));
  assert.ok(snapshot.events.some(e=>e.type==='FRAME_SPIKE'));assert.equal(requests,0);
  assert.equal(typeof api.exportJson,'function');
});
