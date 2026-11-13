import fs from 'node:fs';
import {chromium} from 'playwright';
// In-game horse previews: every place the game draws a horse (qa/horse-gallery.js), captured on the
// real game canvas with World3D on. Writes output/horse-preview/<tag>-*.png.
// CONQUER_QA_URL (default http://127.0.0.1:4173), HORSE_TAG (default "now").
const base=process.env.CONQUER_QA_URL||'http://127.0.0.1:4173',tag=process.env.HORSE_TAG||'now';
const out='output/horse-preview';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.QA_CHROME||undefined,args:['--use-angle=swiftshader','--enable-webgl']});
try{
  const page=await browser.newPage({viewport:{width:1400,height:900},deviceScaleFactor:1});
  await page.goto(base+'/index.html?world3d=1',{waitUntil:'load'});
  await page.waitForFunction(()=>!!window.ConquerWorld3D?.figure&&!!window.ConquerVehicles&&!!window.ConquerMounted2D);
  await page.addScriptTag({url:base+'/qa/horse-gallery.js?'+Date.now()});
  await page.evaluate(()=>{State.structures=[];State.environment=[];State.relief={hills:[],seed:12345};clearReliefBandCache();document.querySelectorAll('#rightPanel,.side-panel,aside').forEach(e=>e.style.display='none');document.querySelectorAll('.minimap,#minimap').forEach(e=>e.style.display='none')});
  const shots=[
    ['1-bestiame-z8',{scale:8,center:[5.2,0],time:.3}],
    ['2-cavalieri-z8',{scale:8,center:[6,3.4],time:.3}],
    ['3-messaggero-z8',{scale:8,center:[3,7],time:.3}],
    ['4-veicoli-z8',{scale:8,center:[5.5,11.8],time:.3}],
    ['5-tutto-z3',{scale:3,center:[6,7],time:.3}],
    ['6-tutto-z1.5',{scale:1.5,center:[6,7],time:.3}]
  ];
  for(const [name,opts] of shots){
    await page.evaluate(o=>ConquerHorseGallery.show(o),opts);
    await page.evaluate(()=>{draw();draw()});
    await page.screenshot({path:`${out}/${tag}-${name}.png`,clip:{x:60,y:110,width:940,height:740}});
  }
  // Walk cycle strip of one horse at zoom 8 (8 phases), to judge the gait.
  await page.evaluate(()=>ConquerHorseGallery.show({scale:8,center:[2.6,0],time:0}));
  for(let i=0;i<4;i++){
    await page.evaluate(t=>ConquerHorseGallery.show({scale:8,center:[1.3,0],time:t}),i/(4*1.6*34*.12/1));
    await page.screenshot({path:`${out}/${tag}-7-passo-${i}.png`,clip:{x:400,y:300,width:600,height:300}});
  }
  console.log('Horse previews written to '+out);
}finally{await browser.close()}
