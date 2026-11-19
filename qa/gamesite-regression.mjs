import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {validEmail, normalizedEmail, unsubscribeCode, verifyUnsubscribe,tokenDigest} from '../api/_gamesite-follow-core.js';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFileSync(resolve(root,p),'utf8');

test('all public English pages have metadata, navigation and a unique title',()=>{
  const pages=['index.html','game.html','media.html','devlog/index.html','devlog/introducing-conquer.html',
    'follow.html','account.html','about.html','privacy.html','contact.html','play.html','404.html'];
  const titles=new Set();
  for(const file of pages){
    const html=read('gamesite/'+file);
    assert.match(html,/<html lang="en">/);
    assert.match(html,/<meta name="description"/);
    assert.match(html,/<main id="main">/);
    assert.match(html,/<footer class="site-footer">/);
    assert.match(html,/href="\/gamesite\/play.html"/);
    const title=html.match(/<title>([^<]+)<\/title>/)?.[1];
    assert.ok(title,'missing title for '+file);
    assert.ok(!titles.has(title),'repeated title '+title);
    titles.add(title);
    assert.doesNotMatch(html,/<script[^>]*src="https?:\/\/(?!.*supabase)/i,'remote script in static HTML');
  }
});
test('navigation resolves and public runtime is linked with a launch gate',()=>{
  const html=read('gamesite/play.html');
  assert.match(html,/href="\.\.\/index\.html\?launch=1"/);
  const navPaths=['index.html','game.html','media.html','follow.html','account.html','play.html','about.html','contact.html','privacy.html','devlog/index.html'];
  navPaths.forEach(p=>assert.ok(existsSync(resolve(root,'gamesite',p)),p));
  assert.match(read('gamesite/media.html'),/loadPreview/);
  assert.match(read('gamesite/media.html'),/not an in-game screenshot/);
});
test('guest launch uses isolated local storage and skips Supabase',()=>{
  const bootstrap=read('src/settlement-app-bootstrap.js');
  const persistence=read('src/settlement-app-persistence.js');
  assert.match(bootstrap,/ConquerGameEntry\?\.requested/);
  assert.match(bootstrap,/window\.__CONQUER_GUEST_SLOT__/);
  assert.match(bootstrap,/if\(!guest\)initSupabase/);
  assert.match(persistence,/conquer\.guest\./);
  assert.match(persistence,/if\(window\.__CONQUER_GUEST_SLOT__\)return/);
  const script=read('src/settlement-game-entry.js');
  const context={window:{},location:{search:''},URLSearchParams,crypto:webcrypto};
  vm.runInNewContext(script,context,{filename:'settlement-game-entry.js'});
  const api=context.window.ConquerGameEntry;
  assert.equal(api.requested,false);
  assert.equal(api.validSeed('1'),true);
  assert.equal(api.validSeed('2147483647'),true);
  for(const bad of ['0','-1','2147483648','1.5','abc'])assert.equal(api.validSeed(bad),false);
  assert.match(api.saveKey('12345678-1234-1234'),/^conquer\.guest\./);
});
test('newsletter double opt-in uses signed unlink and never touches player auth rows',()=>{
  assert.equal(validEmail('member@example.net'),true);
  assert.equal(validEmail('bad@example'),false);
  assert.equal(normalizedEmail('  USER@Example.NET '),'user@example.net');
  process.env.FOLLOW_SIGNING_SECRET='gamesite-qa-strong-test-secret-not-production';
  const code=unsubscribeCode('USER@example.net');
  assert.equal(code.length,64);
  assert.equal(verifyUnsubscribe('user@example.net',code),true);
  assert.equal(verifyUnsubscribe('other@example.net',code),false);
  assert.equal(tokenDigest('abc').length,64);
  const sql=read('supabase/gamesite-follow-schema.sql');
  assert.match(sql,/enable row level security/i);
  assert.match(sql,/revoke all on table public\.gamesite_followers from anon, authenticated/);
  assert.doesNotMatch(read('api/gamesite-follow.js'),/auth\.users|service_role\s*=\s*['"]/);
  assert.match(read('gamesite/follow.html'),/followConsent/);
});
test('P0 release documentation and integration artifacts exist',()=>{
  ['gamesite/site.css','gamesite/site.js','gamesite/mark.svg','api/gamesite-follow.js',
   'api/gamesite-confirm.js','api/gamesite-unsubscribe.js','api/gamesite-metric.js',
   'api/gamesite-sitemap.js','src/settlement-game-entry.css'].forEach(path=>assert.ok(existsSync(resolve(root,path))));
});
