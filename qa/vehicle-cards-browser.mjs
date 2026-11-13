import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
// Carts, wagons and coaches in World3D: one depth-tested 2D card per vehicle (D-046), painted by the
// real ConquerWagons/ConquerAnimals/villager painters, hidden by masonry, reused from the atlas.
const base=process.env.CONQUER_QA_URL||'http://127.0.0.1:4173';
const out='output/playwright/vehicle-cards';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.QA_CHROME||undefined,args:['--use-angle=swiftshader','--enable-webgl']});
try{
  const page=await browser.newPage({viewport:{width:1200,height:850}}),errors=[];
  page.on('pageerror',e=>errors.push(String(e.stack||e)));
  page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('404'))errors.push(m.text())});
  await page.goto(base+'/index.html?assetlab=1&world3d=1',{waitUntil:'load'});
  await page.waitForFunction(()=>!!window.ConquerWorld3D?.figure&&!!window.ConquerVehicles);
  await page.evaluate(()=>{
    State.clock.speed=0;State.clock.day=20;State.daylightOverride='day';State.weatherOverride='sun';State.seasonOverride='summer';
    State.environment=[];State.relief={hills:[],seed:12345};clearReliefBandCache();State.structures=[];
    ConquerSiege.restore(null);State.view.rotation=0;State.view.scale=5;
    const centre=w2s({x:100,y:100});const rect=wrap.getBoundingClientRect();
    State.view.x+=rect.width/2-centre.x;State.view.y+=rect.height/2-centre.y;
    window.__qaVeh=true;
    const front=ConquerWorld3D.drawFront;
    ConquerWorld3D.drawFront=function(r){
      if(window.__qaVeh){
        ConquerVehicles.draw({id:'qa-w',vehicle:'wagon',vehicles:1,guards:2,distance:6,speed:3,good:'wood',qty:80},[{x:94,y:100},{x:110,y:100}]);
        ConquerVehicles.draw({id:'qa-c',vehicle:'coach',vehicles:1,distance:6,speed:3},[{x:110,y:103},{x:94,y:103}]);
        ConquerVehicles.draw({id:'qa-k',vehicle:'cart',vehicles:1,distance:4,speed:0,good:'stone',qty:40},[{x:96,y:97},{x:96,y:110}]);
      }
      return front(r);
    };
    window.__qaGrab=()=>{draw();return Array.from(ctx.getImageData(0,0,ctx.canvas.width,ctx.canvas.height).data)};
    window.__qaDiff=()=>{
      window.__qaVeh=true;const a=__qaGrab();window.__qaVeh=false;const b=__qaGrab();window.__qaVeh=true;draw();
      let n=0;for(let i=0;i<a.length;i+=4)if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])>40)n++;return n;
    };
    invalidateSceneCache();draw();
  });
  const open=await page.evaluate(()=>{
    draw();
    const figs=ConquerWorld3D.frameFigures(),veh=figs.filter(f=>f.key.startsWith('civ|veh|'));
    return{figs:veh,escorts:figs.filter(f=>/^convoy-qa-w-/.test(String(f.id))).length,stats:ConquerWorld3D.atlasStats(),
      pixels:__qaDiff(),status:ConquerWorld3D.status()};
  });
  assert.equal(open.figs.length,3,'wagon, coach and cart each enter the 3D figure queue as one card');
  assert.ok(open.figs.every(f=>f.span>1.2&&f.span<2.5),'vehicle cards are wider than a person card');
  const byKind=k=>open.figs.find(f=>f.key.startsWith('civ|veh|'+k+'|'));
  assert.equal(byKind('wagon').mirror,false,'eastbound wagon faces right');
  assert.ok(byKind('wagon').ox>0,'card shifted towards the team');
  assert.equal(byKind('carriage').mirror,true,'westbound coach is mirrored');
  assert.match(byKind('cart').key,/\|still\|/,'a stopped cart uses the still pose');
  assert.equal(open.escorts,2,'escorts stay soldier billboards');
  assert.ok(open.pixels>2000,'vehicle cards render on open ground: '+open.pixels);
  const reused=await page.evaluate(()=>{const p=ConquerWorld3D.atlasStats().painted;for(let i=0;i<6;i++)draw();return{before:p,after:ConquerWorld3D.atlasStats().painted}});
  assert.equal(reused.after,reused.before,'unchanged vehicle poses reuse their atlas tiles');
  await page.screenshot({path:out+'/open-ground.png'});
  const hidden=await page.evaluate(()=>{
    State.structures=[{id:'qa-occluder',type:'tower',shape:'square',material:'stone',size:3,tier:4,level:3,x:100,y:100,functions:[]}];
    invalidateSceneCache();draw();
    return{pixels:__qaDiff(),status:ConquerWorld3D.status()};
  });
  // The wagon and its escort stand inside the tower; coach and cart stay in the open.
  assert.ok(hidden.pixels<open.pixels*.8,'tower masonry hides the wagon card: '+hidden.pixels+' of '+open.pixels);
  assert.ok(hidden.pixels>open.pixels*.2,'vehicles outside the tower remain visible');
  assert.equal(hidden.status.failed,null);
  await page.screenshot({path:out+'/behind-tower.png'});
  const fallback=await page.evaluate(()=>{ConquerWorld3D._setFiguresForTest(false);State.structures=[];invalidateSceneCache();
    const n=__qaDiff();ConquerWorld3D._setFiguresForTest(true);return{n,cards:ConquerWorld3D.frameFigures().filter(f=>f.key.startsWith('civ|veh|')).length}});
  assert.ok(fallback.n>2000,'2D painter still draws the vehicles when figure cards are off');
  assert.deepEqual(errors,[]);
  fs.writeFileSync(out+'/report.json',JSON.stringify({open,reused,hidden,fallback,errors},null,2));
  console.log('PASS vehicle cards: real wagon painter, depth occlusion, atlas reuse, escorts and 2D fallback');
}finally{await browser.close()}
