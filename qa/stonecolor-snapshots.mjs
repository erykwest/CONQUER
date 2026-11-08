// Stonecolor validation snapshots from the *actual* Asset Lab and game engine (not mock SVGs).
// Run with local HTTP server on :4173 and pinned Playwright: node qa/stonecolor-snapshots.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright';

const out=path.resolve('artifacts/stonecolor');
fs.mkdirSync(out,{recursive:true});
const paletteIds=['gray','sandstone','tuff','limestone','granite'];
const browser=await chromium.launch({headless:true,executablePath:process.env.QA_CHROME||undefined,
  args:(process.env.AUDIT_ARGS||'--no-sandbox --use-angle=swiftshader --enable-webgl').split(' ').filter(Boolean)});
const errors=[];
const page=await browser.newPage({viewport:{width:1460,height:900},deviceScaleFactor:1});
page.on('pageerror',e=>errors.push(String(e.stack||e)));
const decode=data=>Buffer.from(data.split(',')[1],'base64');
const hash=mesh=>{
  if(!mesh?.col)return null;
  let n=2166136261;
  for(const hex of mesh.col)for(const c of String(hex)){n^=c.charCodeAt(0);n=Math.imul(n,16777619)}
  return(mesh.col.length+'-'+(n>>>0).toString(16));
};
try{
  const res=await page.goto(process.env.ASSET_LAB_URL||'http://127.0.0.1:4173/figures-lab.html',
    {waitUntil:'domcontentloaded',timeout:60000});
  assert.equal(res.status(),200);
  await page.waitForFunction(()=>window.ConquerAssetAudit&&window.ConquerAssetCatalog?.engineReady,{timeout:120000});
  assert.equal(await page.locator('#assetStoneColor option').count(),5,'all five approved palette options in Lab');
  const ids=await page.evaluate(()=>{
    const all=window.ConquerAssetCatalog.items,has=id=>all.some(x=>x.id===id);
    const selected=[
      'castle:pietra-quadrata-l3',
      'model:ConquerCivicModels:church1',
      'model:ConquerIndustryModels:quarry',
      'model:ConquerScatterModel:stonePile',
      'model:ConquerScatterModel:riverBoulder',
      'model:ConquerWatersideModels:rocksA',
      'model:ConquerWatersideModels:reef',
      'model:ConquerIndustryModels:clayPit'
    ].filter(has);
    const ramp=all.find(x=>x.id.startsWith('model:ConquerSlopewayModels:'));
    if(ramp)selected.push(ramp.id);
    const house=all.find(x=>x.id.startsWith('model:ConquerHouseModels:')&&/wall|stone|base/i.test(x.key||''));
    if(house)selected.push(house.id);
    return selected;
  });
  for(const required of ['castle:pietra-quadrata-l3','model:ConquerIndustryModels:quarry',
    'model:ConquerIndustryModels:clayPit','model:ConquerScatterModel:stonePile',
    'model:ConquerWatersideModels:rocksA']){
    assert.ok(ids.includes(required),'missing representative asset '+required);
  }
  const files=[],colorHashes={},sheetImages=[];
  for(const id of paletteIds){
    await page.evaluate(id=>{
      const ok=window.ConquerAssetCatalog.setStonePalette(id);
      if(!ok||window.ConquerAssetCatalog.stonePaletteId!==id)throw Error('Cannot select '+id);
      const engine=document.querySelector('iframe[title^="Motore CONQUER"]')?.contentWindow;
      if(engine?.ConquerStoneColor?.current()!==id)throw Error('Engine palette not synchronized: '+id);
    },id);
    const swatches=await page.evaluate(ids=>{
      const api=window.ConquerAssetCatalog;
      return Object.fromEntries(ids.map(id=>{
        const item=api.items.find(x=>x.id===id),mesh=api.lab.modelMesh(item);
        let n=2166136261;
        for(const hex of mesh?.col||[])for(const c of String(hex)){n^=c.charCodeAt(0);n=Math.imul(n,16777619)}
        return[id,(mesh?.col?.length||0)+'-'+(n>>>0).toString(16)];
      }));
    },ids);
    colorHashes[id]=swatches;
    // Contact sheets are composed from the real game meshes and stage captures.
    const sheet=await page.evaluate(ids=>window.ConquerAssetAudit.sheet({ids,states:'default',columns:4,cell:220}),ids);
    const filename=id+'-asset-lab.png';
    fs.writeFileSync(path.join(out,filename),decode(sheet));files.push(filename);sheetImages.push(sheet);
    await page.evaluate(()=>window.ConquerAssetCatalog.select('castle:pietra-quadrata-l3'));
    await page.screenshot({path:path.join(out,id+'-inspector.png')});
    console.log('Captured '+filename+' ('+ids.length+' assets)');
  }
  // One side-by-side comparison, five columns (one sheet per palette) rendered entirely in-browser.
  const comparison=await page.evaluate(async ({sheets,names})=>{
    const images=await Promise.all(sheets.map(src=>new Promise((resolve,reject)=>{
      const image=new Image();image.onload=()=>resolve(image);image.onerror=reject;image.src=src;
    })));
    const w=images[0].naturalWidth,h=images[0].naturalHeight,head=40;
    const canvas=document.createElement('canvas');canvas.width=w*images.length;canvas.height=h+head;
    const g=canvas.getContext('2d');g.fillStyle='#1d1a16';g.fillRect(0,0,canvas.width,canvas.height);
    g.font='700 22px system-ui';g.fillStyle='#eee6d9';
    images.forEach((im,i)=>{g.fillText(names[i],i*w+14,29);g.drawImage(im,i*w,head)});
    return canvas.toDataURL('image/png');
  },{sheets:sheetImages,names:['Grigio','Arenaria','Tufo','Calcare','Granito']});
  fs.writeFileSync(path.join(out,'comparison.png'),decode(comparison));
  // Clay and terracotta must remain untouched; mineral assets should visibly respond.
  const unchanged='model:ConquerIndustryModels:clayPit';
  const changed=['castle:pietra-quadrata-l3','model:ConquerIndustryModels:quarry',
    'model:ConquerScatterModel:stonePile','model:ConquerWatersideModels:rocksA'];
  for(const id of paletteIds.slice(1)){
    assert.equal(colorHashes[id][unchanged],colorHashes.gray[unchanged],'clay altered by '+id);
    for(const mineral of changed){
      assert.notEqual(colorHashes[id][mineral],colorHashes.gray[mineral],mineral+' not tinted for '+id);
    }
  }
  assert.deepEqual(errors,[],'browser errors');
  // The hidden engine must not save a player's settlement while previewing colors.
  assert.deepEqual(await page.evaluate(()=>Object.keys(localStorage).filter(k=>/settlement|assetlab/.test(k))),[]);
  const report={generatedAt:new Date().toISOString(),source:'figures-lab.html / ConquerAssetStage / ConquerAssetAudit',
    palettes:paletteIds,assets:ids,hashes:colorHashes,files:['comparison.png',...files],checks:{mineralFamilies:changed,
      unchangedClay:unchanged,engineSynced:true,localSaveUntouched:true,errors}};
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
  fs.writeFileSync(path.join(out,'README.md'),[
    '# Stonecolor — snapshot Asset Lab', '',
    '## Confronto diretto (5 colonne)', '![Le cinque palette sullo stesso set di asset](comparison.png)', '',
    'I cinque fogli sono estratti dal rendering reale di CONQUER; stessa selezione di asset e stesso punto di vista.',
    'Il **Clay Pit** è il controllo negativo: non deve cambiare colore. Nessun asset è stato duplicato.',
    '', ...files.map((f,i)=>'## '+paletteIds[i]+'\n![Snapshot '+paletteIds[i]+']('+f+')\n'),
    '## Verifiche','Tinte minerali diverse dal grigio; cava di argilla invariata; scelta sincronizzata nel motore sandbox.',
    'Le immagini sono prove di palette, non una nuova baseline grafica approvata.',''
  ].join('\n'));
  console.log('STONECOLOR SNAPSHOTS PASS — '+files.join(', '));
}finally{await browser.close()}
