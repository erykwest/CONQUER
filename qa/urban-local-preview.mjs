import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1600,height:950},deviceScaleFactor:1});
const exceptions=[],missing=[];
page.on('pageerror',err=>exceptions.push(String(err.stack||err)));
page.on('requestfailed',r=>{if(r.url().startsWith('http://127.0.0.1:4173/'))missing.push(r.url());});
try{
  const r=await page.goto('http://127.0.0.1:4173/?renderer=canvas2d',{waitUntil:'domcontentloaded',timeout:60000});
  assert.equal(r?.status(),200);
  await page.waitForFunction(()=>!!window.ConquerLivestock&&!!window.ConquerAnimals&&!!window.ConquerCombat&&typeof draw==='function',{timeout:30000});
  const result=await page.evaluate(()=>{
    draw();
    return{title:document.title,canvas:document.getElementById('c').width>0,
      modules:[...document.scripts].filter(x=>x.src.includes('/src/')).length,
      animals:!!window.ConquerAnimals,livestock:window.ConquerLivestock.summary()};
  });
  assert.ok(result.canvas&&result.modules>35,'Scene not initialized: '+JSON.stringify(result));
  assert.equal(missing.length,0,'Missing local resources: '+missing.join('; '));
  assert.equal(exceptions.length,0,'Browser JS errors: '+exceptions.join('; '));
  fs.mkdirSync('artifacts',{recursive:true});
  await page.screenshot({path:'artifacts/urban-browser.png',fullPage:true});
  fs.writeFileSync('artifacts/browser-report.json',JSON.stringify({...result,commit:process.env.GITHUB_SHA},null,2));
  console.log('PASS local Chromium preview: '+JSON.stringify(result));
}finally{await browser.close()}
