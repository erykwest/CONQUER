// Asset Lab visual audit: drives figures-lab.html (the audit engine is the Lab itself, src/asset-audit.js)
// and saves what it found for review.
//   node qa/asset-audit.mjs                     audit everything -> artifacts/asset-audit/
//   node qa/asset-audit.mjs --category=Fortificazioni --ids=castle:porta-pietra-l2
//   node qa/asset-audit.mjs --update-baseline   after reviewing the sheets: write qa/asset-audit-baseline.json
//   node qa/asset-audit.mjs --strict            also fail on new / changed renders (not only on failed checks)
// Env: ASSET_LAB_URL (default http://127.0.0.1:4173/figures-lab.html), QA_CHROME (Chromium executable).
// Output: report.json (every render, checks, signatures), report.md (findings), sheets/*.png (contact
// sheets: fortifications per family in every state, other categories in their default view).
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const arg=name=>{const a=process.argv.find(x=>x.startsWith('--'+name+'='));return a?a.slice(name.length+3):null};
const flag=name=>process.argv.includes('--'+name);
const url=process.env.ASSET_LAB_URL||'http://127.0.0.1:4173/figures-lab.html';
const out=path.resolve(arg('out')||'artifacts/asset-audit');
const opts={category:arg('category')||undefined,family:arg('family')||undefined,ids:arg('ids')?.split(',')};
fs.mkdirSync(path.join(out,'sheets'),{recursive:true});

const browser=await chromium.launch({headless:true,executablePath:process.env.QA_CHROME||undefined,
  args:(process.env.AUDIT_ARGS??'--no-sandbox').split(' ').filter(Boolean)});
const errors=[];
try{
  const page=await browser.newPage({viewport:{width:1460,height:900},deviceScaleFactor:1});
  page.on('pageerror',e=>errors.push(String(e.stack||e)));
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.ConquerAssetAudit&&window.ConquerAssetCatalog?.engineReady,{timeout:120000});
  const t0=Date.now();
  // Images stay in the page (the sheets reuse them); report.json gets everything else.
  const report=await page.evaluate(async o=>{
    const r=await window.ConquerAssetAudit.run({...o,images:true});
    return{...r,results:r.results.map(({image,...rest})=>rest)};
  },opts);
  report.durationMs=Date.now()-t0;report.url=url;report.pageErrors=errors;
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,1));

  // Contact sheets: one per fortification family (all states), one per other category.
  const groups=await page.evaluate(o=>{
    const items=window.ConquerAssetCatalog.items.filter(x=>(!o.ids||o.ids.includes(x.id))&&(!o.category||x.category===o.category)&&(!o.family||x.family===o.family));
    const fam=[...new Set(items.filter(x=>x.kind==='castle').map(x=>x.family))].map(f=>({name:'fortificazioni-'+f,family:f,category:'Fortificazioni',states:'all'}));
    const cats=[...new Set(items.filter(x=>x.kind!=='castle').map(x=>x.category))].map(c=>({name:c,category:c,states:'default'}));
    return[...fam,...cats].map(g=>({...g,ids:items.filter(x=>x.category===g.category&&(!g.family||x.family===g.family)).map(x=>x.id)}));
  },opts);
  const sheets=[];
  for(const g of groups){
    const columns=g.states==='all'?undefined:8;
    const data=await page.evaluate(([ids,states,columns])=>window.ConquerAssetAudit.sheet({ids,states,columns}),[g.ids,g.states,columns]);
    const file=path.join('sheets',g.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-')+'.png');
    fs.writeFileSync(path.join(out,file),Buffer.from(data.split(',')[1],'base64'));sheets.push(file);
  }

  const s=report.summary;
  const md=['# Asset Lab — audit visivo','',`${report.generatedAt} · ${url} · ${(report.durationMs/1000).toFixed(1)} s`,'',
    `**${s.renders} render** di ${s.entries} asset · ok ${s.ok} · **errori ${s.fail}** · avvisi ${s.warn} · noti ${s.known} · nuovi ${s.new} · cambiati ${s.changed} · spariti ${s.missing}`,'',
    '## Problemi','',...(report.findings.some(f=>f.level!=='known')?['| livello | asset | stato | controllo | dettaglio |','|---|---|---|---|---|',
      ...report.findings.filter(f=>f.level!=='known').map(f=>`| ${f.level} | ${f.title} | ${f.state??''} | ${f.name} | ${f.detail.replace(/\|/g,'/')} |`)]:['Nessuno.']),'',
    '## Problemi noti (deroghe in qa/asset-audit-baseline.json)','',
    ...(report.findings.some(f=>f.level==='known')?report.findings.filter(f=>f.level==='known').map(f=>`- ${f.title} · ${f.state??''} · ${f.name}: ${f.waived}`):['Nessuno.']),'',
    '## Da rivedere (nuovi / cambiati rispetto alla baseline)','',
    ...report.results.filter(r=>r.baseline!=='ok').map(r=>`- ${r.baseline}: ${r.title} · ${r.state??''}${r.baselineDistance!=null?' (distanza '+r.baselineDistance+')':''}`),
    ...(report.missing.length?['','## Spariti dalla baseline','',...report.missing.map(k=>'- '+k)]:[]),
    '','## Fogli provini','',...sheets.map(f=>`- ${f}`),''].join('\n');
  fs.writeFileSync(path.join(out,'report.md'),md);

  if(flag('update-baseline')){
    const base=await page.evaluate(()=>window.ConquerAssetAudit.baseline());
    fs.writeFileSync(path.join(root,'qa/asset-audit-baseline.json'),JSON.stringify(base,null,1)+'\n');
    console.log('Baseline written: '+Object.keys(base.entries).length+' renders');
  }
  console.log(`Asset audit: ${s.renders} renders, ${s.fail} failed, ${s.warn} warnings, ${s.new} new, ${s.changed} changed -> ${out}`);
  const strictFail=flag('strict')&&(s.new||s.changed||s.missing);
  if(errors.length)console.error('Page errors:\n'+errors.join('\n'));
  if(s.fail||errors.length||strictFail)process.exitCode=1;
}finally{await browser.close()}
