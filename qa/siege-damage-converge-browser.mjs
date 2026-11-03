// Run against a local server on :4173. Uses the game's isolated Asset Lab slot.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';

const out='output/playwright/converge';
const baseUrl=process.env.CONQUER_QA_URL||'http://127.0.0.1:4173';
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-webgl']});
const results=[];
try{
  for(const mode of ['canvas','webgl']){
    const context=await browser.newContext({viewport:{width:1440,height:900}});
    const page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(String(e.stack||e)));
    await page.goto(baseUrl+'/index.html?assetlab=1&'+
      (mode==='canvas'?'renderer=canvas2d':'world3d=1'),{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>!!window.ConquerGates&&!!window.ConquerSiege&&typeof selectStructure==='function');
    const initial=await page.evaluate(()=>{
      State.clock.speed=0;State.clock.day=20;State.environment=[];
      State.daylightOverride='day';State.seasonOverride='summer';State.weatherOverride='sun';
      State.relief={hills:[],seed:12345};clearReliefBandCache();
      State.resources={gold:1000,wood:1000,stone:1000,metal:1000};
      State.structures=[];ConquerSiege.restore(null);
      const gate={id:'qa-gate',type:'gate',material:'stone',shape:'square',tier:2,
        size:1.5,level:1,x:100,y:100,angle:0,functions:[]};
      const timber={id:'qa-timber',type:'tower',material:'wood',shape:'square',tier:2,
        woodStyle:'palisadeTower',woodRoof:'open',size:1.5,level:1,x:104,y:100,functions:[]};
      State.structures.push(gate,timber);
      const hp=ConquerSiege.integrity(timber).core.hp;
      const forbidden=['sword','spear','axe','arrow','bow','crossbow','ram','torch']
        .map(w=>ConquerSiege.attackStructure(timber.id,w,10,'core').damage);
      const timberHp=ConquerSiege.integrity(timber).core.hp;
      ConquerGates.installPortcullis(gate);ConquerGates.togglePortcullis(gate);
      State.view.scale=2;const r=wrap.getBoundingClientRect(),p=w2s(gate,0);
      State.view.x+=r.width*.55-p.x;State.view.y+=r.height*.6-p.y;
      invalidateSceneCache();selectStructure(gate);
      return{hp,timberHp,forbidden,gate:JSON.parse(JSON.stringify(ConquerSiege.integrity(gate))),
        worldActive:!!ConquerWorld3D.active()};
    });
    assert.equal(initial.worldActive,mode==='webgl','the requested renderer must be exercised');
    assert.equal(initial.timberHp,initial.hp);
    assert.ok(initial.forbidden.every(x=>x===0),'ordinary weapons cannot damage timber towers');
    const ram=page.locator('[data-siege-test="ram"]');
    // Actual panel events: three 40-HP hits wreck only the 120-HP grate.
    for(let i=0;i<3;i++)await ram.click();
    const grate=await page.evaluate(()=>{
      const g=State.structures.find(s=>s.id==='qa-gate');
      return{hp:JSON.parse(JSON.stringify(ConquerSiege.integrity(g))),wrecked:g.portcullis.wrecked,
        blocked:ConquerGates.portcullisBlocks(g),breached:ConquerSiege.gateBreached(g)};
    });
    assert.equal(grate.hp.portcullis.hp,0);
    assert.equal(grate.hp.door.hp,initial.gate.door.hp);
    assert.equal(grate.hp.core.hp,initial.gate.core.hp);
    assert.equal(grate.wrecked,true);assert.equal(grate.blocked,false);assert.equal(grate.breached,false);
    await ram.click();await ram.click();
    const breach=await page.evaluate(()=>{
      const g=State.structures.find(s=>s.id==='qa-gate'),saved=JSON.parse(JSON.stringify(g));
      return{hp:JSON.parse(JSON.stringify(ConquerSiege.integrity(g))),breached:ConquerSiege.gateBreached(g),
        loadedDoor:ConquerSiege.integrity(saved).door.hp,loadedGrate:ConquerSiege.integrity(saved).portcullis.hp};
    });
    assert.equal(breach.hp.door.hp,0);assert.equal(breach.loadedDoor,0);assert.equal(breach.loadedGrate,0);
    assert.equal(breach.hp.core.hp,initial.gate.core.hp);assert.equal(breach.breached,true);
    const fire=await page.evaluate(()=>{
      const old=State.structures.find(s=>s.id==='qa-gate');
      const g={...old,id:'qa-fire',siegeIntegrity:undefined,portcullis:undefined,closed:false};
      State.structures.push(g);ConquerGates.installPortcullis(g);ConquerGates.togglePortcullis(g);
      const hit=ConquerSiege.attackStructure(g.id,'torch',2,'door');
      return{part:hit.part,damage:hit.damage,hp:JSON.parse(JSON.stringify(ConquerSiege.integrity(g)))};
    });
    assert.equal(fire.part,'door');assert.equal(fire.damage,5);
    assert.equal(fire.hp.portcullis.hp,120);assert.equal(fire.hp.core.hp,initial.gate.core.hp);
    assert.equal(await page.evaluate(()=>localStorage.getItem('conquer.assetlab.sandbox')),null,'sandbox must not save');
    await page.screenshot({path:out+'/'+mode+'.png'});
    // Main can already fall back during empty-map gate redraws (WebGL buffer
    // error). Preserve that safe fallback and report it, separately from damage.
    const renderer=await page.evaluate(()=>{
      const s=ConquerWorld3D.status();return{active:!!ConquerWorld3D.active(),failed:s.failed};
    });
    assert.deepEqual(errors,[],'no browser exceptions');
    results.push({mode,result:'PASS gameplay',renderer,initial,grate,breach,fire,errors});
    await context.close();
  }
}finally{
  fs.writeFileSync(out+'/report.json',JSON.stringify(results,null,2));
  await browser.close();
}
console.log(JSON.stringify(results,null,2));
