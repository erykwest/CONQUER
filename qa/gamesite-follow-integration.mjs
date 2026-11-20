import test from 'node:test';
import assert from 'node:assert/strict';
import follow from '../api/gamesite-follow.js';
import confirm from '../api/gamesite-confirm.js';
import unsubscribe from '../api/gamesite-unsubscribe.js';

function response(){
  return {statusCode:200,headers:{},body:null,
    setHeader(name,value){this.headers[name.toLowerCase()]=String(value);return this;},
    status(value){this.statusCode=value;return this;},
    json(value){this.body=value;return this;},
    send(value){this.body=value;return this;}
  };
}
const request=(method,body={},query={})=>({method,body,query,headers:{origin:'https://conquer-staging.example','x-vercel-forwarded-for':'192.0.2.40','content-length':'100'},socket:{remoteAddress:'127.0.0.1'}});
const originalEnv={...process.env};
const oldFetch=globalThis.fetch;
const settings={
  PUBLIC_SITE_URL:'https://conquer-staging.example',
  SUPABASE_URL:'https://supabase.staging.example',
  SUPABASE_SERVICE_ROLE_KEY:'qa-service-key',
  RESEND_API_KEY:'qa-resend-key',
  FOLLOW_FROM:'CONQUER <noreply@conquer-staging.example>',
  FOLLOW_SIGNING_SECRET:'qa-hmac-secret-is-not-a-real-credential'
};
const ok=(json='',code=200)=>({ok:code>=200&&code<300,status:code,json:async()=>json,text:async()=>json===''?'':JSON.stringify(json)});
function fakeServer({rateAllowed=true,mailFails=false}={}){
  let saved=null;
  let sent=[];
  let requests=[];
  globalThis.fetch=async (url,opts={})=>{
    url=String(url);requests.push({url,opts});
    if(url.includes('/rpc/gamesite_consume_follow_budget'))return ok(rateAllowed);
    if(url.includes('/rest/v1/gamesite_followers')){
      const method=opts.method||'GET';
      if(method==='GET'){
        if(url.includes('token_hash=eq.')){
          if(!saved?.token_hash||saved.status!=='pending'||!url.includes(saved.token_hash))return ok([]);
          return ok([{email:saved.email,token_expires_at:saved.token_expires_at}]);
        }
        return ok(saved?[{status:saved.status,last_sent_at:saved.last_sent_at}]:[]);
      }
      if(method==='POST'){saved=JSON.parse(opts.body);return ok('');}
      if(method==='PATCH'){
        const update=JSON.parse(opts.body);
        if(saved)saved={...saved,...update};
        return ok('');
      }
    }
    if(url==='https://api.resend.com/emails'){
      if(mailFails)return ok({error:'blocked'},503);
      sent.push(JSON.parse(opts.body));return ok({id:'mock-mail-id'});
    }
    throw Error('Unexpected request '+url);
  };
  return {get saved(){return saved},get sent(){return sent},get requests(){return requests}};
}
test('Follow P0: fail closed before writing when mail provider is unconfigured',async()=>{
  Object.assign(process.env,settings);
  delete process.env.RESEND_API_KEY;
  const server=fakeServer();
  const res=response();
  await follow(request('POST',{email:'hello@example.com',consent:true}),res);
  assert.equal(res.statusCode,503);
  assert.equal(server.requests.length,0,'No DB writes or mail sends before config is complete');
  process.env.RESEND_API_KEY=settings.RESEND_API_KEY;
});
test('Follow P0: atomic rate gate rejects excess requests before database mutation',async()=>{
  Object.assign(process.env,settings);
  const server=fakeServer({rateAllowed:false});
  const res=response();
  await follow(request('POST',{email:'hello@example.com',consent:true}),res);
  assert.equal(res.statusCode,429);
  assert.equal(res.headers['retry-after'],'900');
  assert.equal(server.requests.length,1,'Only rate-limit RPC should be called');
});
test('Follow P0: double opt-in, explicit confirmation, signed unsubscribe and no automatic account',async()=>{
  Object.assign(process.env,settings);
  const server=fakeServer();
  const subscribed=response();
  await follow(request('POST',{email:'HELLO@example.com',consent:true}),subscribed);
  assert.equal(subscribed.statusCode,202);
  assert.equal(server.saved?.status,'pending');
  assert.equal(server.saved?.email,'hello@example.com');
  assert.equal(server.sent.length,1);
  const match=server.sent[0].html.match(/gamesite-confirm\?token=([0-9a-f]{64})/);
  assert.ok(match,'Must send an actual confirmation token');
  assert.ok(!server.requests.some(r=>r.url.includes('/auth/users')),'Follow must not create player identities');
  const token=match[1];
  const preview=response();
  await confirm(request('GET',{}, {token}),preview);
  assert.equal(preview.statusCode,200);
  assert.match(preview.body,/Confirm email/);
  assert.equal(server.saved?.status,'pending','GET must not subscribe anyone');
  const approved=response();
  await confirm(request('POST',{token}),approved);
  assert.equal(approved.statusCode,200);
  assert.equal(server.saved?.status,'confirmed');
  assert.equal(server.saved?.token_hash,null);
  assert.equal(server.sent.length,2);
  const link=server.sent[1].html.match(/gamesite-unsubscribe\?email=([^&]+)&amp;code=([0-9a-f]+)/)
    || server.sent[1].html.match(/gamesite-unsubscribe\?email=([^&]+)&code=([0-9a-f]+)/);
  assert.ok(link,'Welcome email must include a valid unsubscribe URL');
  const unsubQuery={email:decodeURIComponent(link[1]),code:link[2]};
  const unsubPreview=response();
  await unsubscribe(request('GET',{},unsubQuery),unsubPreview);
  assert.equal(unsubPreview.statusCode,200);
  assert.equal(server.saved?.status,'confirmed','GET must not unsubscribe anyone');
  const finished=response();
  await unsubscribe(request('POST',unsubQuery),finished);
  assert.equal(finished.statusCode,200);
  assert.equal(server.saved?.status,'unsubscribed');
  const invalid=response();
  await unsubscribe(request('POST',{email:'other@example.com',code:unsubQuery.code}),invalid);
  assert.equal(invalid.statusCode,400);
});
test('Follow P0: delivery failure rolls back pending cooldown and signals error',async()=>{
  Object.assign(process.env,settings);
  const server=fakeServer({mailFails:true});
  const res=response();
  await follow(request('POST',{email:'retry@example.com',consent:true}),res);
  assert.equal(res.statusCode,503);
  assert.equal(server.saved?.last_sent_at,null);
  assert.equal(server.saved?.token_hash,null);
  assert.equal(server.sent.length,0);
});
test('Follow P0: cross-origin POST and honeypot never send emails',async()=>{
  Object.assign(process.env,settings);
  const server=fakeServer();
  const cross=response();
  const req=request('POST',{email:'hello@example.com',consent:true});
  req.headers.origin='https://evil.example';
  await follow(req,cross);
  assert.equal(cross.statusCode,403);
  const honeypot=response();
  await follow(request('POST',{email:'hello@example.com',consent:true,website:'spam.example'}),honeypot);
  assert.equal(honeypot.statusCode,202);
  assert.equal(server.sent.length,0);
});
process.on('exit',()=>{globalThis.fetch=oldFetch;for(const key of Object.keys(settings)){if(originalEnv[key]===undefined)delete process.env[key];else process.env[key]=originalEnv[key];}});
