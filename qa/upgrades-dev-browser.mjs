import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
const base=process.env.CONQUER_QA_URL||'http://127.0.0.1:4173';
const out='output/playwright/upgrades-dev';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.QA_CHROME||chromium.executablePath(),args:['--use-angle=swiftshader','--enable-webgl']});
try{
 for(const ui of [1,2]){
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('dialog',d=>d.accept());
  await page.goto(`${base}/index.html?assetlab=1&renderer=canvas2d&ui=${ui}&dev=1`);await page.waitForFunction(()=>!!window.ConquerGame?.read&&!!window.ConquerEconomy?.state);
  await page.evaluate(()=>{
   State.devBuild={};State.clock.speed=0;State.clock.day=0;State.environment=[];State.relief={hills:[],seed:12345};clearReliefBandCache();
   const t={id:'tower',type:'tower',material:'stone',shape:'square',size:1,tier:1,level:1,x:105,y:100,angle:0,functions:[]};
   t.buildCost=constructionCost(t);State.structures=[{id:'well',type:'well',x:100,y:100},t];State.village={...State.village,founded:true,wellId:'well',name:'QA',foundingWorkers:3};
   ConquerEconomy.reset();const e=ConquerEconomy.state();e.castleGold=0;for(const k of Object.keys(e.castle))e.castle[k]=0;selectStructure(t);
   StructureCommands.setHeight(t.id,2);
  });
  const selector=ui===1?page.locator('#constructionPrioritySelect'):page.locator('#ui2 select[aria-label="Priorità cantiere"]');await selector.waitFor();
  assert.equal(await page.evaluate(()=>underConstruction(selectedStructure())),true);
  await page.screenshot({path:`${out}/ui${ui}-upgrade.png`});
  if(ui===1)await page.locator('[data-cancel-construction]').click();else await page.locator('#ui2 .u2-danger').click();
  assert.equal(await page.evaluate(()=>selectedStructure().level),1);assert.equal(await page.evaluate(()=>underConstruction(selectedStructure())),false);
  if(ui===1)await page.locator('#devToggle').click();else await page.locator('#ui2 button[aria-label="Strumenti di sviluppo"]').click();
  const free=page.locator('[data-dev-build="freeBuild"]'),fast=page.locator('[data-dev-build="fastBuild"]');
  assert.equal(await free.getAttribute('aria-pressed'),'false');assert.equal(await fast.getAttribute('aria-pressed'),'false');
  await free.click();assert.equal(await free.getAttribute('aria-pressed'),'true');assert.equal(await fast.getAttribute('aria-pressed'),'false');
  await page.evaluate(()=>StructureCommands.setHeight('tower',2));await selector.waitFor();
  assert.equal(await page.evaluate(()=>constructionMaterialInfo(selectedStructure()).progress),1);assert.equal(await page.evaluate(()=>constructionProgress(selectedStructure())),0);
  await fast.click();assert.equal(await page.evaluate(()=>underConstruction(selectedStructure())),false);assert.equal(await page.evaluate(()=>ConquerEconomy.state().castleGold),0);
  const instant=await page.evaluate(()=>{const s={id:'instant',type:'tower',material:'stone',shape:'square',size:1,level:1,x:110,y:100,angle:0,functions:[]};return {ok:addStructure(s),progress:constructionProgress(s),refund:refundableConstructionCost(s)}});
  assert.equal(instant.ok,true);assert.equal(instant.progress,1);assert.deepEqual(instant.refund,{});
  await page.screenshot({path:`${out}/ui${ui}-dev.png`});
  const saved=await page.evaluate(()=>{window.__CONQUER_ASSET_LAB__=false;saveLocal();const p=JSON.parse(localStorage.getItem(localStorageKey()));window.__CONQUER_ASSET_LAB__=true;return {cheats:p.devBuild??null,free:p.structures.find(s=>s.id==='instant').construction.materialsFree}});
  assert.equal(saved.cheats,null);assert(saved.free.stone>0);
  await fast.click();await free.click();
  const house=await page.evaluate(()=>{
    State.structures=[{id:'well',type:'well',x:80,y:80},{id:'house',type:'house',auto:true,x:100,y:100,w:1.5,h:1,angle:0,houseLevel:2}];
    State.combat.strokes=[{x:100,y:100,r:40,mode:'yellow'}];invalidateNavigation();invalidateUrbanGeometry();selectStructure(State.structures[1]);changeHouseDensity(State.structures[1],3);
    return {level:State.structures[1].houseLevel,building:underConstruction(State.structures[1]),prior:State.structures[1].construction?.upgrade.before.houseLevel};
  });assert.deepEqual(house,{level:3,building:true,prior:2});
  await page.screenshot({path:`${out}/ui${ui}-house.png`});
  await fast.click();assert.equal(await page.evaluate(()=>underConstruction(State.structures[1])),false);
  assert.deepEqual(errors,[]);console.log(`UI${ui}: upgrade, rollback, DEV buttons, free/fast independence, save and automatic-house construction PASS`);await page.close();
 }
}finally{await browser.close()}
