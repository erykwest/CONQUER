import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';

const origin='http://127.0.0.1:4173';
const dir='output/playwright/gamesite';
mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-webgl','--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:1366,height:850},deviceScaleFactor:1,ignoreHTTPSErrors:true});
const page=await context.newPage();
const errors=[],missing=[];
page.on('pageerror',e=>errors.push(String(e.stack||e)));
page.on('requestfailed',req=>{
  if(req.url().startsWith(origin))missing.push(req.url()+' '+(req.failure()?.errorText||'unknown'));
});
const gameReady=async()=>{
  await page.waitForFunction(()=>typeof State==='object'&&!!document.getElementById('guestSeed'),{timeout:60000});
};
try{
  let response=await page.goto(origin+'/gamesite/',{waitUntil:'domcontentloaded',timeout:60000});
  assert.equal(response.status(),200);
  assert.equal(await page.title(),'Shape the realm · CONQUER');
  assert.equal(await page.locator('.hero .btn.primary').textContent(),'Play in browser');
  await page.screenshot({path:dir+'/01-home-desktop.png',fullPage:true});

  // The marketing site is responsive without rendering the game on page load.
  await page.setViewportSize({width:390,height:844});
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('[data-nav-toggle]').click();
  assert.equal(await page.locator('[data-nav-toggle]').getAttribute('aria-expanded'),'true');
  assert.equal(await page.getByRole('navigation',{name:'Primary navigation'}).isVisible(),true);
  await page.screenshot({path:dir+'/02-home-mobile.png',fullPage:true});
  await page.setViewportSize({width:1366,height:850});

  // Site and live Builder share one origin, but launch requires an explicit user choice.
  response=await page.goto(origin+'/index.html?launch=1',{waitUntil:'domcontentloaded',timeout:60000});
  assert.equal(response.status(),200);
  await gameReady();
  assert.equal(await page.locator('#conquerGameEntry').isVisible(),true);
  assert.equal(await page.locator('#guestContinueArea button').count(),0);
  assert.equal(await page.locator('[data-entry-tab="guest"]').getAttribute('aria-pressed'),'true');
  await page.screenshot({path:dir+'/03-guest-splash.png',fullPage:true});

  const checks=await page.evaluate(()=>{
    const c=document.createElement('canvas'); return {webgl2:!!c.getContext('webgl2',{failIfMajorPerformanceCaveat:true})};
  });
  assert.ok(checks.webgl2,'Test browser has no WebGL2, cannot verify production compatibility gate');

  // No accidental launch from an invalid seed.
  await page.locator('#guestSeed').fill('2147483648');
  await page.locator('#guestStart').click();
  assert.match(await page.locator('#entryMessage').textContent(),/seed between/);
  assert.equal(await page.locator('#conquerGameEntry').isVisible(),true);

  await page.locator('#guestSeed').fill('424242');
  await page.locator('#guestBiome').selectOption('plains');
  await page.locator('#guestStart').click();
  await page.waitForFunction(()=>window.__CONQUER_GUEST_SLOT__&&State?.seed===424242&&!!State?.relief,{timeout:120000});
  assert.equal(await page.locator('#conquerGameEntry').count(),0);
  await page.waitForFunction(()=>{
    const key='conquer.guest.'+window.__CONQUER_GUEST_SLOT__+'.schema2.settlement.0.0';
    return !!localStorage.getItem(key);
  },{timeout:45000});
  const first=await page.evaluate(()=>{
    const slot=window.__CONQUER_GUEST_SLOT__;
    const key='conquer.guest.'+slot+'.schema2.settlement.0.0';
    const saved=JSON.parse(localStorage.getItem(key));
    return {slot,seed:State.seed,biome:State.biome,savedSeed:saved.seed,savedBiome:saved.biome,
      count:JSON.parse(localStorage.getItem('conquer.guest.slots.v1')).length,user:State.user};
  });
  assert.equal(first.seed,424242);
  assert.equal(first.savedSeed,424242);
  assert.equal(first.biome,'plains');
  assert.equal(first.savedBiome,'plains');
  assert.equal(first.count,1);
  assert.equal(first.user,null);
  await page.screenshot({path:dir+'/04-guest-world.png',fullPage:false,timeout:30000});
  assert.ok(!missing.length,'Local resources failed: '+missing.slice(0,8).join(' | '));

  // Reload must remain on the launch screen until an explicit Continue action.
  await page.reload({waitUntil:'domcontentloaded',timeout:60000});
  await gameReady();
  assert.equal(await page.locator('#conquerGameEntry').isVisible(),true);
  const resumeBtn=page.locator('#guestContinueArea button').first();
  await resumeBtn.waitFor({state:'visible',timeout:15000});
  assert.match(await resumeBtn.textContent(),/424242/);
  await resumeBtn.click();
  await page.waitForFunction(()=>State?.seed===424242&&!!window.__CONQUER_GUEST_SLOT__&&!!State?.relief,{timeout:90000});
  assert.equal(await page.evaluate(()=>window.__CONQUER_GUEST_SLOT__),first.slot);
  assert.equal(await page.evaluate(()=>State.biome),'plains');
  assert.equal(await page.evaluate(()=>State.user),null);

  // A new slot must not destroy or replace the previously saved world.
  await page.reload({waitUntil:'domcontentloaded',timeout:60000});
  await gameReady();
  await page.locator('#guestSeed').fill('777777');
  await page.locator('#guestBiome').selectOption('forest');
  await page.locator('#guestStart').click();
  await page.waitForFunction(()=>State?.seed===777777&&!!window.__CONQUER_GUEST_SLOT__&&!!State?.relief,{timeout:90000});
  const second=await page.evaluate(()=>{
    const slot=window.__CONQUER_GUEST_SLOT__;
    const slots=JSON.parse(localStorage.getItem('conquer.guest.slots.v1'));
    const save1=JSON.parse(localStorage.getItem('conquer.guest.'+slots.find(s=>s.seed===424242).id+'.schema2.settlement.0.0'));
    const save2=JSON.parse(localStorage.getItem('conquer.guest.'+slot+'.schema2.settlement.0.0'));
    return {slot,slots:slots.length,firstSeed:save1.seed,secondSeed:save2.seed,biome:save2.biome};
  });
  assert.notEqual(second.slot,first.slot);
  assert.equal(second.slots,2);
  assert.equal(second.firstSeed,424242);
  assert.equal(second.secondSeed,777777);
  assert.equal(second.biome,'forest');

  // Account remains optional; guest play never authenticates or exposes multiplayer state.
  assert.equal(await page.evaluate(()=>State.user),null);
  assert.equal(await page.evaluate(()=>State.supabase),null);
  const fatal=errors.filter(x=>!(/Failed to fetch|network|supabase|CORS/i.test(x)));
  assert.deepEqual(fatal,[],'Unexpected runtime page errors: '+fatal.slice(0,6).join(' | '));
  console.log(JSON.stringify({ok:true,firstSlot:first.slot,secondSlot:second.slot,seed1:first.seed,seed2:second.secondSeed,webgl2:checks.webgl2,screenshots:4}));
}finally{
  await browser.close();
}
