import assert from 'node:assert/strict';
import {chromium} from 'playwright';

// Browser contract tests: no real mail or cloud account is created.
// A minimal mocked Supabase module tests the same-origin identity contract,
// while the actual provider redirect and credentials remain a release gate.
const origin='http://127.0.0.1:4173';
const fakeSdk=String.raw`
export function createClient(){
  const email = () => localStorage.getItem('qa-auth-email');
  const user = () => email() ? {id:'qa-account-0001',email:email()} : null;
  const chain={eq(){return chain},async maybeSingle(){return {data:null,error:null}}};
  return {
    auth:{
      async getUser(){return {data:{user:user()},error:null}},
      async getSession(){return {data:{session:user()?{user:user()}:null},error:null}},
      async signInWithOtp({email,options}){localStorage.setItem('qa-requested-link',JSON.stringify({email,redirect:options.emailRedirectTo}));return {error:null}},
      async signOut(){localStorage.removeItem('qa-auth-email');return {error:null}}
    },
    from(){return {select(){return chain}}}
  };
}`;
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-webgl','--enable-unsafe-swiftshader']});
try{
  const context=await browser.newContext({viewport:{width:1280,height:820}});
  await context.route('https://esm.sh/@supabase/supabase-js@2.117.1',route=>route.fulfill({
    status:200,contentType:'text/javascript',headers:{'Access-Control-Allow-Origin':'*'},body:fakeSdk
  }));
  const page=await context.newPage();
  await page.goto(origin+'/gamesite/account.html',{waitUntil:'domcontentloaded'});
  await page.locator('#accountEmail').fill('tester@example.org');
  await page.locator('#accountForm button[type="submit"]').click();
  await page.waitForFunction(()=>!!localStorage.getItem('qa-requested-link'),{timeout:10000});
  const pending=await page.evaluate(()=>JSON.parse(localStorage.getItem('qa-requested-link')));
  assert.equal(pending.email,'tester@example.org');
  assert.equal(pending.redirect,origin+'/gamesite/account.html');
  // Simulated confirmation after the external provider's email roundtrip.
  await page.evaluate(()=>localStorage.setItem('qa-auth-email','tester@example.org'));
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('#accountSignedIn').waitFor({state:'visible',timeout:15000});
  assert.match(await page.locator('#accountStatus').textContent(),/tester@example.org/);
  await page.goto(origin+'/index.html?launch=1',{waitUntil:'domcontentloaded',timeout:60000});
  await page.getByRole('button',{name:/CONQUER Account/}).click();
  await page.locator('#entryAccountContinue').click();
  await page.waitForFunction(()=>State.user?.id==='qa-account-0001',{timeout:45000});
  assert.equal(await page.evaluate(()=>window.__CONQUER_GUEST_SLOT__||null),null);
  assert.equal(await page.evaluate(()=>State.user?.email),'tester@example.org');
  await page.goto(origin+'/gamesite/account.html',{waitUntil:'domcontentloaded'});
  await page.locator('#accountSignedIn').waitFor({state:'visible',timeout:15000});
  await page.locator('#accountSignOut').click();
  await page.locator('#accountSignedOut').waitFor({state:'visible',timeout:15000});
  assert.equal(await page.evaluate(()=>localStorage.getItem('qa-auth-email')),null);
  await context.close();

  // Compatibility error: the site must not send users into a black-screen renderer.
  const unavailable=await browser.newContext();
  await unavailable.addInitScript(()=>{
    const original=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(kind,...args){if(kind==='webgl2')return null;return original.call(this,kind,...args)};
  });
  const noGl=await unavailable.newPage();
  await noGl.goto(origin+'/gamesite/play.html',{waitUntil:'domcontentloaded'});
  await noGl.waitForFunction(()=>document.getElementById('gameStartLink')?.getAttribute('aria-disabled')==='true');
  assert.match(await noGl.locator('#compatibility').textContent(),/WebGL2 was not detected/);
  await noGl.locator('#gameStartLink').click();
  assert.match(noGl.url(),/\/gamesite\/play\.html$/);
  await noGl.goto(origin+'/index.html?launch=1',{waitUntil:'domcontentloaded',timeout:60000});
  await noGl.waitForSelector('#guestStart');
  await noGl.locator('#guestStart').click();
  assert.match(await noGl.locator('#entryMessage').textContent(),/WebGL2 is required/);
  assert.equal(await noGl.locator('#conquerGameEntry').isVisible(),true);
  await unavailable.close();

  // Quota or denied storage must prevent game entry, without deleting existing slot data.
  const blocked=await browser.newContext();
  const quotaPage=await blocked.newPage();
  await quotaPage.goto(origin+'/index.html?launch=1',{waitUntil:'domcontentloaded',timeout:60000});
  await quotaPage.waitForSelector('#guestStart');
  await quotaPage.evaluate(()=>{
    const original=Storage.prototype.setItem;
    Storage.prototype.setItem=function(k,value){
      if(k.startsWith('conquer.guest.'))throw new DOMException('QuotaExceededError','QuotaExceededError');
      return original.call(this,k,value);
    };
  });
  await quotaPage.locator('#guestSeed').fill('321321');
  await quotaPage.locator('#guestStart').click();
  assert.match(await quotaPage.locator('#entryMessage').textContent(),/storage|save slot/i);
  assert.equal(await quotaPage.locator('#conquerGameEntry').isVisible(),true);
  await blocked.close();

  console.log('GameSite auth mock, WebGL2 negative and storage failure browser E2E PASS');
}finally{
  await browser.close();
}
