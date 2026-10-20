import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';

fs.mkdirSync('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-webgl','--enable-unsafe-swiftshader']});
const results=[];
try{
  for(const mode of ['webgl','canvas']){
    const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1});
    const page=await context.newPage(),exceptions=[];
    page.on('pageerror',e=>exceptions.push(String(e.stack||e)));
    await page.goto('http://127.0.0.1:4173/index.html?'+(mode==='webgl'?'world3d=1':'renderer=canvas2d'),{waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForFunction(()=>typeof draw==='function'&&!!window.ConquerWorld3D&&!!window.ConquerCastle3D,{timeout:30000});
    await page.evaluate(()=>{
      window.__clayQaRestore={structures:State.structures,lotCache:urbanLotCache,speed:State.clock.speed,view:{...State.view}};
      const lot={houseId:'clay-qa-house',points:[{x:101,y:99},{x:107,y:99},{x:107,y:105},{x:101,y:105}]};
      urbanLotCache=[lot];
      State.structures=[
        ...State.structures,
        {id:'clay-qa-house',type:'house',auto:true,masonryMaterial:'brick',houseLevel:3,x:104,y:101,w:1.5,h:1,angle:0},
        {id:'clay-qa-tower',type:'tower',masonryMaterial:'stone',x:110,y:102,shape:'square',material:'stone',level:2,angle:0,r:1.2,health:100}
      ];
      State.view.scale=1;
      State.view.x=650;
      State.view.y=-930; // frame the QA house and masonry tower inside the visible scene
      State.clock.speed=1;
      State.village.privateMasonryMaterial='brick';
      invalidateUrbanGeometry();
      urbanLotCache=[lot];
      invalidateSceneCache();
      draw();
    });
    for(const palette of ['stone','clay','stone','clay']){
      const snapshot=await page.evaluate(palette=>{
        setDevVisualPalette(palette);
        for(let i=0;i<5;i++)draw();
        const st=window.ConquerWorld3D.status();
        return{palette:State.visualPalette,mode3d:window.ConquerWorld3D.active(),world3d:st,structures:State.structures.length};
      },palette);
      results.push({mode,...snapshot});
      console.log('QA snapshot',JSON.stringify({mode,palette: snapshot.palette,world3d:snapshot.world3d,structures:snapshot.structures}));
      await page.screenshot({path:'artifacts/clay-'+mode+'-'+palette+'-'+results.length+'.png'});
      assert.equal(snapshot.palette,palette,'palette transition mismatch');
      assert.ok(snapshot.structures>=2,'sample structures must exist');
      const materials=await page.evaluate(()=>({
        house:State.structures.find(x=>x.id==='clay-qa-house').masonryMaterial,
        tower:State.structures.find(x=>x.id==='clay-qa-tower').masonryMaterial,
        uiBuilder:!!document.querySelector('[data-build-masonry="brick"]'),
        uiPrivate:!!document.querySelector('[data-private-masonry="brick"]'),
        stone:constructionCost({type:'tower',material:'stone',masonryMaterial:'stone',shape:'square',size:1.5,level:1}),
        brick:constructionCost({type:'tower',material:'stone',masonryMaterial:'brick',shape:'square',size:1.5,level:1})
      }));
      assert.equal(materials.house,'brick');assert.equal(materials.tower,'stone');
      assert.ok(materials.uiBuilder&&materials.uiPrivate,'material selectors present');
      assert.equal(materials.brick.clay,materials.stone.stone);
      assert.equal(materials.brick.stone,undefined);
      if(mode==='webgl'){
        assert.equal(snapshot.mode3d,true,'WebGL2 should be active in Chromium');
        assert.ok(snapshot.world3d.buffers['buildings#n']>0,'house geometry disappeared');
        assert.ok(snapshot.world3d.buffers['castleBody#n']>0,'tower geometry disappeared');
        assert.equal(snapshot.world3d.failed,null,'WebGL failure');
      }
    }
    assert.equal(exceptions.length,0,mode+': '+exceptions.join('; '));
    await context.close();
  }
  fs.writeFileSync('artifacts/clay-browser-report.json',JSON.stringify({sha:process.env.GITHUB_SHA,results},null,2));
  console.log('PASS clay browser smoke',JSON.stringify(results.map(({mode,palette,world3d})=>({mode,palette,buffers:world3d.buffers,failed:world3d.failed})),null,2));
}finally{await browser.close()}
