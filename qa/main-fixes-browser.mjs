import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
const base=process.env.CONQUER_QA_URL||'http://127.0.0.1:4173';
const out='output/playwright/main-fixes';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-webgl']});
const errors=[],warnings=[];
try{
 const context=await browser.newContext({viewport:{width:1440,height:900}});
 await context.addInitScript(()=>{
   localStorage.setItem('conquer.seed.0.0','12345');
   const original=HTMLCanvasElement.prototype.getContext;
   HTMLCanvasElement.prototype.getContext=function(kind,...args){
     const result=original.call(this,kind,...args);
     if(kind==='webgl2'&&result)window.__qaWorldGl=result;
     return result;
   };
 });
 const page=await context.newPage();
 page.on('pageerror',e=>errors.push(String(e.stack||e)));
 page.on('console',m=>{if(m.type()==='warning'||m.type()==='error')warnings.push(m.text())});
 await page.goto(base+'/index.html?assetlab=1&world3d=1',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>!!window.ConquerGates&&!!window.ConquerWorld3D);
 await page.evaluate(()=>{
   State.clock.speed=0;State.clock.day=20;State.daylightOverride='day';State.weatherOverride='sun';State.seasonOverride='summer';
   State.environment=[];State.relief={hills:[],seed:12345};clearReliefBandCache();
   State.resources={gold:1000,metal:1000,wood:1000};State.structures=[];ConquerSiege.restore(null);
   const gate={id:'qa-gate',type:'gate',material:'stone',shape:'square',tier:2,size:1.5,level:1,x:100,y:100,angle:0,functions:[]};
   State.structures.push(gate);ConquerGates.installPortcullis(gate);ConquerGates.togglePortcullis(gate);
   invalidateSceneCache();selectStructure(gate);
 });
 for(let i=0;i<5;i++)await page.locator('[data-siege-test="ram"]').click();
 await page.evaluate(async()=>{
   for(let i=0;i<6;i++){
     State.view.rotation=i%4;State.daylightOverride=i%2?'night':'day';
     const g=State.structures.find(s=>s.id==='qa-gate');g.angle=i*Math.PI/2;
     invalidateSceneCache();draw();
     await new Promise(requestAnimationFrame);
   }
   const until=performance.now()+1800;
   while(performance.now()<until){draw();await new Promise(requestAnimationFrame)}
 });
 const rendered=await page.evaluate(()=>({active:ConquerWorld3D.active(),status:ConquerWorld3D.status(),
   hp:ConquerSiege.integrity(State.structures.find(s=>s.id==='qa-gate'))}));
 assert.equal(rendered.active,true,'rebuilding castle/scatter buffers must keep WebGL active');
 assert.equal(rendered.status.failed,null);
 assert.equal(rendered.hp.door.hp,0);assert.equal(rendered.hp.portcullis.hp,0);assert.equal(rendered.hp.core.hp,250);
 assert.deepEqual(warnings.filter(s=>/INVALID_OPERATION|no buffer is bound|World 3D disabled/.test(s)),[]);
 await page.screenshot({path:out+'/webgl.png'});
 // Genuine context loss must still fall back safely; the fix must not mute it.
 await page.evaluate(()=>window.__qaWorldGl.getExtension('WEBGL_lose_context').loseContext());
 await page.waitForFunction(()=>!ConquerWorld3D.active());
 await page.evaluate(()=>draw());
 const fallback=await page.evaluate(()=>({active:ConquerWorld3D.active(),failed:ConquerWorld3D.status().failed,
   door:ConquerSiege.integrity(State.structures.find(s=>s.id==='qa-gate')).door.hp}));
 assert.equal(fallback.active,false);assert.match(fallback.failed,/context-lost/);assert.equal(fallback.door,0);
 assert.deepEqual(errors,[]);
 fs.writeFileSync(out+'/report.json',JSON.stringify({result:'PASS',rendered,fallback,errors,warnings},null,2));
 console.log(JSON.stringify({result:'PASS',webglActive:rendered.active,fallback,errors},null,2));
 await context.close();
}finally{await browser.close()}
