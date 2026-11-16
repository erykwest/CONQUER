import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
// Animal capsules (World3D): an animal card takes its per-pixel depth from a horizontal capsule
// along its body (people: vertical). Checks: the real livestock painter enters the figure queue
// with a horizontal capsule and collider; a magenta capsule card shows on open ground, is hidden
// behind a tower and stays whole when it stands just in front of the tower face (a flat
// feet-depth card had its body cut by the masonry behind it).
const base=process.env.CONQUER_QA_URL||'http://127.0.0.1:4173';
const out='output/playwright/animal-capsule';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.QA_CHROME||undefined,args:['--use-angle=swiftshader','--enable-webgl']});
try{
  const page=await browser.newPage({viewport:{width:1200,height:850}}),errors=[];
  page.on('pageerror',e=>errors.push(String(e.stack||e)));
  page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('404'))errors.push(m.text())});
  await page.goto(base+'/index.html?assetlab=1&world3d=1',{waitUntil:'load'});
  await page.waitForFunction(()=>!!window.ConquerWorld3D?.figure&&!!window.ConquerAnimals?.card);
  await page.evaluate(()=>{
    State.clock.speed=0;State.clock.day=20;State.daylightOverride='day';State.weatherOverride='sun';State.seasonOverride='summer';
    State.environment=[];State.relief={hills:[],seed:12345};clearReliefBandCache();State.structures=[];
    ConquerSiege.restore(null);State.view.rotation=0;State.view.scale=5;
    const centre=w2s({x:100,y:100});const rect=wrap.getBoundingClientRect();
    State.view.x+=rect.width/2-centre.x;State.view.y+=rect.height/2-centre.y;
    window.__qaAt={x:100,y:100};
    const front=ConquerWorld3D.drawFront;
    ConquerWorld3D.drawFront=function(r){
      // A real horse through the livestock path, off to the side.
      ConquerAnimals.card('horse',{x:96,y:104},.07,{id:'qa-horse',mode:'walk',t:.2,seed:3,facing:1});
      // A magenta "animal" in the horse's capsule: body-sized block above the feet row.
      const cap=ConquerAnimals.capsule('horse',5.75,ConquerWorld3D.screenAxis(1));
      ConquerWorld3D.figure(__qaAt,.07,'qa-animal-block',(g,x,y)=>{g.fillStyle='#ff00ff';g.fillRect(x+16,y+26,32,16)},'qa-animal',false,{capsule:cap});
      return front(r);
    };
    window.__qaPink=()=>{const d=ctx.getImageData(0,0,ctx.canvas.width,ctx.canvas.height).data;let n=0;for(let i=0;i<d.length;i+=4)if(d[i]>180&&d[i+1]<70&&d[i+2]>180)n++;return n};
    invalidateSceneCache();draw();
  });
  await page.waitForFunction(()=>{draw();return __qaPink()>20});
  const open=await page.evaluate(()=>({pink:__qaPink(),figures:ConquerWorld3D.frameFigures(),colliders:ConquerWorld3D.colliders()}));
  assert.ok(open.pink>100,'the capsule card renders on open ground');
  const horse=open.figures.find(f=>f.id==='qa-horse');
  assert.ok(horse&&horse.key.startsWith('civ|a|horse|walk|'),'the real horse painter enters the 3D figure queue');
  assert.ok(horse.capsule&&Math.hypot(horse.capsule.axis.x,horse.capsule.axis.y)>.15,'the horse lies in a horizontal capsule along its body');
  const hc=open.colliders.find(c=>c.id==='qa-horse');
  assert.ok(hc&&(hc.ax||hc.ay)&&hc.z0===hc.z1&&hc.type==='animal:horse','the horse capsule is also its horizontal collider');
  await page.screenshot({path:out+'/open-ground.png'});
  // Tower over the origin: hidden behind it, whole just in front of its near face.
  const scan=await page.evaluate(()=>{
    State.structures=[{id:'qa-occluder',type:'tower',shape:'square',material:'stone',size:3,tier:4,level:3,x:100,y:100,functions:[]}];
    invalidateSceneCache();
    const res=[];
    for(let k=-3;k<=3.01;k+=.25){__qaAt={x:100+k,y:100+k};draw();res.push({k:+k.toFixed(2),pink:__qaPink()})}
    return res;
  });
  const behind=scan.filter(s=>s.k<=-.5&&s.k>=-1.25),firstOut=scan.find(s=>s.k>0&&s.pink>open.pink*.5);
  assert.ok(behind.every(s=>s.pink<open.pink*.1),'an animal behind the tower is hidden by its masonry');
  assert.ok(firstOut,'an animal in front of the tower shows');
  // Just in front of the face (the first visible step) the body is not cut by the wall behind it.
  assert.ok(firstOut.pink>open.pink*.85,'just in front of the tower face the body stays whole: '+JSON.stringify(firstOut));
  await page.evaluate(k=>{__qaAt={x:100+k,y:100+k};draw()},firstOut.k);
  await page.screenshot({path:out+'/in-front-of-tower.png'});
  assert.deepEqual(errors,[]);
  fs.writeFileSync(out+'/report.json',JSON.stringify({open:{pink:open.pink,horse,hc},scan,errors},null,2));
  console.log('PASS animal capsules: horizontal capsule and collider, depth behind and in front of masonry');
}finally{await browser.close()}
