import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';

fs.mkdirSync('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-webgl']});
const errors=[],missing=[];
const page=await browser.newPage({viewport:{width:1460,height:900},deviceScaleFactor:1});
page.on('pageerror',err=>errors.push(String(err.stack||err)));
page.on('requestfailed',req=>{if(req.url().startsWith('http://127.0.0.1:4173/'))missing.push(req.url())});
try{
  const response=await page.goto('http://127.0.0.1:4173/figures-lab.html',{waitUntil:'domcontentloaded',timeout:60000});
  assert.equal(response.status(),200);
  await page.waitForFunction(()=>window.ConquerAssetCatalog?.items?.length>150,{timeout:30000});
  const inventory=await page.evaluate(()=>{
    const list=window.ConquerAssetCatalog.items;
    return{total:list.length,files:list.filter(x=>x.kind==='file').length,
      models:list.filter(x=>x.kind==='model').length,
      categories:new Set(list.map(x=>x.category)).size,nav:document.querySelectorAll('#assetCategoryFilters button').length};
  });
  assert.ok(inventory.total>=150&&inventory.files>=36&&inventory.models>=100,JSON.stringify(inventory));
  assert.ok(inventory.categories>=11&&inventory.nav>=11,JSON.stringify(inventory));
  await page.getByRole('button',{name:'Scatter',exact:true}).first().click();
  const scatter=await page.evaluate(()=>[...document.querySelectorAll('.asset-card')]
    .every(b=>window.ConquerAssetCatalog.items.find(x=>x.id===b.dataset.id)?.category==='Scatter'));
  assert.ok(scatter,'Scatter category must isolate only scatter assets');
  await page.locator('#assetSearch').fill('barrel');
  assert.ok(await page.locator('.asset-card').count()>0,'Search must find matching scatter');
  await page.locator('#assetReset').click();

  async function selected(id,expected){
    await page.evaluate(id=>window.ConquerAssetCatalog.select(id),id);
    const mode=await page.evaluate(()=>({mode:document.body.className,name:document.getElementById('assetDetailName').textContent,
      canvas:!!document.querySelector('#assetDetailPreview canvas'),animation:!document.getElementById('assetAnimationPanel').hidden}));
    assert.ok(mode.name&&mode.mode.includes(expected),JSON.stringify({id,mode}));
    return mode;
  }
  await selected('model:ConquerCivicModels:church1','asset-catalog-static');
  const filled=await page.evaluate(()=>{
    const canvas=document.querySelector('#assetDetailPreview canvas'),g=canvas.getContext('2d');
    const image=g.getImageData(0,0,canvas.width,canvas.height).data;
    let pixels=0;for(let p=3;p<image.length;p+=4)if(image[p]>0)pixels++;
    return pixels;
  });
  assert.ok(filled>100,'Actual civic geometry should draw more than 100 visible pixels: '+filled);
  await selected('file:src/assets/forest/tree_01_tonda.svg','asset-catalog-static');
  await page.waitForFunction(()=>{const i=document.querySelector('#assetDetailPreview img');return i&&i.complete&&i.naturalWidth>0});
  await selected('procedural:wall','asset-catalog-static');
  assert.ok(await page.locator('#assetBuilderLink:visible').count(),'Parametric asset should link to Builder');

  await selected('animal:horse','asset-figure');
  assert.ok(await page.locator('#assetAnimationPanel canvas#c').count(),'Live animation canvas should remain mounted');
  await selected('figure:knight','asset-figure');
  await page.evaluate(()=>window.ConquerLab.step(1/60));
  assert.ok(await page.locator('#assetAnimationPanel canvas#c').count(),'Legacy figure preview must survive selection');
  await page.screenshot({path:'artifacts/asset-lab-browser.png',fullPage:true});
  assert.deepEqual(missing,[],'Missing local asset sources');
  assert.deepEqual(errors,[],'Browser exceptions');
  console.log('Asset Lab browser smoke PASS',JSON.stringify({inventory,filled}));
}finally{await browser.close()}
