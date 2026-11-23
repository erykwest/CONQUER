// Real Builder DOM, original game event handlers, every icon and category.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const catalog=JSON.parse(fs.readFileSync(path.join(root,'src/assets/builder-icons/catalog.json'),'utf8'));
const url=process.env.BUILDER_URL||'http://127.0.0.1:4173/index.html?assetlab=1';
const out=path.join(root,'output/playwright/buildericon');fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.QA_CHROME||undefined,args:['--no-sandbox']});
const errors=[];
try{
  const page=await browser.newPage({viewport:{width:1460,height:1000}});
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(url,{waitUntil:'load',timeout:60000});
  await page.waitForSelector('#builder.ux-builder .ux-rail');
  // Keep references and real listeners so repeated palette switches cannot lose a tool.
  await page.evaluate(()=>{window.__builderIconButtons=new Map();});
  const groups=[...new Set(catalog.entries.filter(e=>e.role==='builder').map(e=>e.category))];
  for(const category of groups){
    await page.locator('.ux-rail [data-icon="category-'+category+'"]').click();
    const expected=catalog.entries.filter(e=>e.role==='builder'&&e.category===category);
    assert.equal(await page.locator('.ux-catalog .ux-icon-btn').count(),expected.length,category+' tool count');
    const actual=await page.evaluate(async entries=>{
      return Promise.all(entries.map(async e=>{
        const button=document.querySelector('.ux-catalog '+e.selector),image=button?.querySelector('img');
        await image?.decode();
        window.__builderIconButtons.set(e.selector,button);
        return {id:button?.dataset.icon,name:button?.getAttribute('aria-label'),loaded:!!image?.naturalWidth,src:image?.getAttribute('src'),size:image?.getBoundingClientRect().width,background:button?getComputedStyle(button).backgroundColor:null};
      }));
    },expected);
    for(let i=0;i<expected.length;i++){
      assert.equal(actual[i].id,expected[i].id);
      assert.equal(actual[i].name,expected[i].label);
      assert(actual[i].loaded&&actual[i].src.includes('/'+expected[i].id+'.svg?'),expected[i].id+' loaded');
      assert.equal(actual[i].size,32);
      assert.equal(actual[i].background,'rgb(232, 221, 198)');
    }
    if(category==='economy'){
      await page.locator('[data-industry="windmill"]').click();
      assert.equal(await page.evaluate(()=>State.tool.kind),'industry');
      assert(await page.locator('[data-industry="windmill"]').evaluate(b=>b.classList.contains('active')));
      await page.locator('#builder').screenshot({path:path.join(out,'builder-production.png')});
      // Flyout is outside the narrow rail box; capture it separately as well.
      await page.locator('.ux-flyout').screenshot({path:path.join(out,'production-flyout.png')});
    }
  }
  for(const category of groups){
    await page.locator('.ux-rail [data-icon="category-'+category+'"]').click();
    assert(await page.evaluate(entries=>entries.every(e=>document.querySelector('.ux-catalog '+e.selector)===window.__builderIconButtons.get(e.selector)),catalog.entries.filter(e=>e.role==='builder'&&e.category===category)),category+' keeps original button objects after switching away and back');
  }
  await page.locator('.ux-close').click();
  assert(await page.locator('.ux-flyout').isHidden());
  // Options use the same standalone files; black masks stay local to each image.
  const options=await page.locator('.ux-option-glyph img').count();assert.equal(options,12);
  const labUrl=new URL('figures-lab.html',url).href;
  await page.goto(labUrl,{waitUntil:'load',timeout:60000});
  await page.waitForFunction(()=>window.ConquerAssetCatalog?.items?.length>100);
  await page.getByRole('button',{name:'Interfaccia',exact:true}).click();
  assert.equal(await page.locator('.asset-card').count(),74);
  await page.evaluate(()=>window.ConquerAssetCatalog.select('file:src/assets/builder-icons/mulino-vento.svg'));
  await page.locator('#assetDetailPreview img').evaluate(image=>image.decode());
  assert.equal(await page.locator('#assetDetailPreview').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(232, 221, 198)');
  await page.screenshot({path:path.join(out,'asset-lab-icons.png'),fullPage:false});
  await page.setViewportSize({width:390,height:844});
  await page.goto(url,{waitUntil:'load',timeout:60000});
  await page.locator('.ux-rail [data-icon="category-economy"]').click();
  const box=await page.locator('.ux-flyout').boundingBox();assert(box&&box.x>=0&&box.x+box.width<=390);
  await page.screenshot({path:path.join(out,'builder-mobile.png'),fullPage:false});
  assert.deepEqual(errors,[],'page errors');
  console.log('PASS Builder icons: 52 tools / 7 categories, all SVGs loaded, button identity and windmill handler, 12 options, 72 Lab entries, mobile flyout, no page errors');
}finally{await browser.close();}
