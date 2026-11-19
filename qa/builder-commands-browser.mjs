import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
const out='output/playwright/architecture';fs.mkdirSync(out,{recursive:true});
const base=process.env.BUILDER_QA_URL||'http://127.0.0.1:4173';
const browser=await chromium.launch({headless:true,executablePath:process.env.QA_CHROME||chromium.executablePath(),args:['--use-angle=swiftshader','--enable-webgl']});
try{
  for(const mode of ['legacy','ui2','camp']){
    const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
    page.on('pageerror',e=>errors.push(String(e)));
    await page.goto(`${base}/${mode==='camp'?'camp/':'index.html'}?assetlab=1&ui=${mode==='ui2'?2:1}`,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.ConquerBuilderCommands&&window.ConquerBuilderControls&&typeof setTool==='function');
    if(mode!=='camp')await page.waitForFunction(()=>window.ConquerGame?.commands?.builder);
    // UI v2 and CAMP act through the shared commands. The classic game also
    // exercises actual controls detached by the compact palette.
    const result=await page.evaluate(mode=>{
      const B=window.ConquerBuilderCommands;
      const legacy=(key,value,extra={})=>{
        const selector='[data-'+key.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())+(value!==''?'="'+value+'"':'')+']';
        return window.ConquerGame.commands.press(selector+Object.entries(extra).map(([k,v])=>'[data-'+k.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())+'="'+v+'"]').join(''));
      };
      const run=(key,value,extra={})=>mode==='camp'?B.execute({[key]:value,...extra}):mode==='ui2'?window.ConquerGame.commands.builder({[key]:value,...extra}):legacy(key,value,extra);
      if(mode!=='camp'&&(!run('terraformShape','square')||!run('terraformRadius','6')||!run('terraform','terrain')))throw Error('Terraform choice failed');
      const terra={shape:State.tool.shape,radius:State.tool.radius};
      run('tool','select');if(mode!=='camp')run('terraform','flat');
      const persisted=mode==='camp'||State.tool.shape==='square'&&State.tool.radius===6;
      run('crossingWidth','3');run('crossing','water');const width=State.tool.width;
      run('gateLevel','3');run('gate','',{gateSize:'1'});const small=State.tool.level;
      run('woodGate','');run('gateLevel','3');const wood=State.tool.level;
      run('industry','quarry',{extractionMode:'clay'});const clay=State.tool.placementSpec.extractionMode;
      const snapshot=window.ConquerGame?.snapshot?.();
      // Once the DOM adapter is mounted, commands remain usable with no matching
      // legacy query available: this was impossible when UI v2 pressed buttons.
      const query=document.querySelector;
      let independent=false;
      if(mode==='ui2'){
        document.querySelector=()=>null;
        try{independent=window.ConquerGame.commands.builder({tower:'round',size:.75})&&State.tool.shape==='round'}
        finally{document.querySelector=query}
      }
      return{terra,persisted,width,small,wood,clay,independent,snapshot:!!snapshot,options:B.options()};
    },mode);
    if(mode!=='camp')assert.deepEqual(result.terra,{shape:'square',radius:6});assert.equal(result.persisted,true);
    assert.equal(result.width,3);assert.equal(result.small,2);assert.equal(result.wood,1);assert.equal(result.clay,'clay');
    if(mode==='ui2')assert.equal(result.independent,true);
    // Exercise the Preact rail itself after the catalog stopped carrying selectors.
    if(mode==='ui2'){
      await page.locator('#ui2 .u2-rail button').first().click();
      assert.equal(await page.evaluate(()=>State.tool.kind),'select');
      await page.locator('#ui2 .u2-rail button').nth(1).click();
      assert.equal(await page.evaluate(()=>State.tool.kind),'tower');
    }
    await page.screenshot({path:`${out}/builder-${mode}.png`});
    assert.deepEqual(errors,[]);console.log('PASS Builder '+mode+': shared commands, presets, gate caps, clay quarry and no page errors');
    await page.close();
  }
}finally{await browser.close()}
