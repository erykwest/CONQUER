import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
const out='output/playwright/construction';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.QA_CHROME||chromium.executablePath(),args:['--use-angle=swiftshader','--enable-webgl']});
try{
 for(const ui of [1,2]){
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(`http://127.0.0.1:4173/index.html?assetlab=1&renderer=canvas2d&ui=${ui}&dev=0`);
  await page.waitForFunction(()=>!!window.ConquerGame?.read&&!!window.ConquerEconomy?.state);
  const placed=await page.evaluate(()=>{
   State.clock.speed=0;State.clock.day=0;State.environment=[];State.relief={hills:[],seed:12345};clearReliefBandCache();
   State.structures=[{id:'well',type:'well',x:100,y:100}];
   State.village={...State.village,founded:true,wellId:'well',name:'QA',foundingWorkers:3};
   ConquerEconomy.reset();const e=ConquerEconomy.state();e.castleGold=0;for(const k of Object.keys(e.castle))e.castle[k]=0;
   const s={id:'qa-site',type:'tower',material:'stone',shape:'square',size:1,level:1,x:105,y:100,angle:0,functions:[]};
   const ok=addStructure(s);return {ok,quote:s.buildCost,work:s.construction?.workDone};
  });
  assert.equal(placed.ok,true);assert.equal(placed.work,0);
  const selector=ui===1?page.locator('#constructionPrioritySelect'):page.locator('#ui2 select[aria-label="Priorità cantiere"]');
  await selector.waitFor();assert.equal(await selector.locator('option').count(),6);assert.equal(await selector.inputValue(),'2');await selector.selectOption('5');
  assert.equal(await page.evaluate(()=>constructionPriority(selectedStructure())),5);
  const result=await page.evaluate(()=>{
   const s=selectedStructure(),e=ConquerEconomy.state();e.castleGold=100;for(const [k,v] of Object.entries(s.buildCost)){if(k==='gold')e.castleGold=100+v;else e.castle[k]=v}
   allocateConstructionMaterials([s],1);const delivered=constructionMaterialInfo(s).progress,work=s.construction.workDone;
   window.__CONQUER_ASSET_LAB__=false;if(!saveLocal())throw new Error('Local save failed');const payload=JSON.parse(localStorage.getItem(localStorageKey()));window.__CONQUER_ASSET_LAB__=true;
   const saved=JSON.stringify(payload.structures.find(x=>x.id===s.id));const migrated=migrateStructures([JSON.parse(saved)])[0];State.structures[State.structures.findIndex(x=>x.id===s.id)]=migrated;selectStructure(migrated);
   return {delivered,work,priority:constructionPriority(migrated),same:JSON.stringify(migrated.construction)===JSON.stringify(s.construction)};
  });
  assert.equal(result.delivered,1);assert.equal(result.work,0);assert.equal(result.priority,5);assert.equal(result.same,true);
  await page.screenshot({path:`${out}/ui${ui}-site.png`});
  const completed=await page.evaluate(()=>{
    const s=selectedStructure();for(let day=0;day<30&&underConstruction(s);day++){State.clock.day=day+1;tickConstructionWork(day,day+1)}
    renderFunctionPanel();return {progress:constructionProgress(s),refund:refundableConstructionCost(s)};
  });
  assert.equal(completed.progress,1);assert.deepEqual(completed.refund,{});
  if(ui===1)assert.equal(await page.locator('#constructionPrioritySelect').count(),0);else await selector.waitFor({state:'detached'});
  await page.screenshot({path:`${out}/ui${ui}-complete.png`});
  assert.deepEqual(errors,[]);console.log(`UI${ui}: unfunded placement, six priorities, delivery/work separation, migration, completion PASS`);const cancelled=await page.evaluate(()=>{
    const e=ConquerEconomy.state(),site={id:'qa-cancel',type:'tower',material:'stone',shape:'square',size:1,level:1,x:110,y:100,angle:0,functions:[]};
    if(!addStructure(site))throw new Error('Cancel fixture placement failed');
    e.castle.stone=10;allocateConstructionMaterials([site],1);selectStructure(site);return e.castle.stone;
  });assert.equal(cancelled,0);
  page.on('dialog',d=>d.accept());
  if(ui===1)await page.locator('[data-cancel-construction]').click();
  else await page.locator('#ui2 .u2-danger').click();
  await page.waitForFunction(()=>!State.structures.some(s=>s.id==='qa-cancel'));
  assert.equal(await page.evaluate(()=>ConquerEconomy.state().castle.stone),10);
  assert.deepEqual(errors,[]);console.log(`UI${ui}: real local save and cancellation refund PASS`);await page.close();
 }
}finally{await browser.close()}
