import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
const base=process.env.CONQUER_QA_URL||'http://127.0.0.1:4173';
const out='output/playwright/figure-billboards';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.QA_CHROME||undefined,args:['--use-angle=swiftshader','--enable-webgl']});
try{
  const page=await browser.newPage({viewport:{width:1200,height:850}}),errors=[];
  page.on('pageerror',e=>errors.push(String(e.stack||e)));
  page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('404'))errors.push(m.text())});
  await page.goto(base+'/index.html?assetlab=1&world3d=1',{waitUntil:'load'});
  await page.waitForFunction(()=>!!window.ConquerWorld3D?.figure);
  await page.evaluate(()=>{
    State.clock.speed=0;State.clock.day=20;State.daylightOverride='day';State.weatherOverride='sun';State.seasonOverride='summer';
    State.environment=[];State.relief={hills:[],seed:12345};clearReliefBandCache();State.structures=[];
    ConquerSiege.restore(null);State.view.rotation=0;State.view.scale=5;
    const centre=w2s({x:100,y:100});const rect=wrap.getBoundingClientRect();
    State.view.x+=rect.width/2-centre.x;State.view.y+=rect.height/2-centre.y;
    const front=ConquerWorld3D.drawFront;
    ConquerWorld3D.drawFront=function(r){
      drawVillagerFigure({id:'qa-civilian',p:{x:104,y:100},kind:'peasant',age:'adult',sex:'male',colors:['#a98654','#65503a'],hair:'#483022'});
      ConquerWorld3D.figure({x:100,y:100},.1,'qa-occlusion',(g,x,y)=>{g.fillStyle='#ff00ff';g.fillRect(x+26,y+30,12,20)},'qa-occlusion');
      return front(r);
    };
    window.__qaPink=()=>{const d=ctx.getImageData(0,0,ctx.canvas.width,ctx.canvas.height).data;let n=0;for(let i=0;i<d.length;i+=4)if(d[i]>180&&d[i+1]<70&&d[i+2]>180)n++;return n};
    invalidateSceneCache();draw();
  });
  await page.waitForFunction(()=>{draw();return __qaPink()>20});
  const visible=await page.evaluate(()=>({pink:__qaPink(),figures:ConquerWorld3D.frameFigures(),stats:ConquerWorld3D.atlasStats(),colliders:ConquerWorld3D.colliders(),status:ConquerWorld3D.status()}));
  assert.ok(visible.pink>20,'a civilian atlas card must render on open ground');
  assert.ok(visible.figures.some(f=>f.key.startsWith('civ|v|')),'real villager painter enters the 3D figure queue');
  assert.ok(!visible.colliders.some(c=>c.id==='qa-civilian'),'civilians must not become selectable military capsules');
  assert.equal(visible.stats.capacity,1024);
  const reused=await page.evaluate(()=>{for(let i=0;i<8;i++)draw();return ConquerWorld3D.atlasStats()});
  assert.equal(reused.painted,visible.stats.painted,'unchanged civilian poses reuse atlas tiles');
  await page.screenshot({path:out+'/open-ground.png'});
  await page.evaluate(()=>{
    State.structures=[{id:'qa-occluder',type:'tower',shape:'square',material:'stone',size:3,tier:4,level:3,x:100,y:100,functions:[]}];
    invalidateSceneCache();draw();
  });
  const hidden=await page.evaluate(()=>({pink:__qaPink(),status:ConquerWorld3D.status()}));
  assert.ok(hidden.pink<visible.pink*.1,'solid tower depth hides the civilian card behind its masonry');
  assert.equal(hidden.status.failed,null);
  await page.screenshot({path:out+'/behind-tower.png'});
  await page.evaluate(()=>{ConquerWorld3D._setActiveForTest(false);draw()});
  assert.equal(await page.evaluate(()=>ConquerWorld3D.active()),false,'Canvas fallback remains available');
  assert.deepEqual(errors,[]);
  fs.writeFileSync(out+'/report.json',JSON.stringify({visible,reused,hidden,errors},null,2));
  console.log('PASS civilian billboards: real painter, depth occlusion, atlas reuse, military picking and Canvas fallback');
}finally{await browser.close()}
