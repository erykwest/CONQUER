import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
// Event, joust and justice figures in World3D (D-CAPSULE-261113): the people of the stage, the
// arena, the joust and the pillory / gallows / scaffold enter the depth-tested figure queue as
// cards in their capsules (vertical for people, along the body for the joust horses) instead of
// being painted in 2D over the scene; the 2D occluder repaint is skipped. Screenshots for review.
const base=process.env.CONQUER_QA_URL||'http://127.0.0.1:4173';
const out='output/playwright/event-figure-cards';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.QA_CHROME||undefined,args:['--use-angle=swiftshader','--enable-webgl']});
try{
  const page=await browser.newPage({viewport:{width:1400,height:950}}),errors=[];
  page.on('pageerror',e=>errors.push(String(e.stack||e)));
  page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('404'))errors.push(m.text())});
  await page.goto(base+'/index.html?assetlab=1&world3d=1',{waitUntil:'load'});
  await page.waitForFunction(()=>!!window.ConquerWorld3D?.figure&&!!window.ConquerCourtPeople&&!!window.ConquerEventPeople&&!!window.ConquerJoust);
  const setup=await page.evaluate(()=>{
    // No daylight override: it pins the visual clock at 12:00, after the gallows' hours (10-12).
    State.clock.speed=0;State.daylightOverride=null;State.weatherOverride='sun';State.seasonOverride='summer';
    State.environment=[];State.relief={hills:[],seed:12345};clearReliefBandCache();
    window.ConquerSiege?.restore?.(null);State.view.rotation=0;
    // A Friday morning in session for the gallows and the scaffold (and the pillory).
    let day=null;for(let d=0;d<28&&day==null;d++){State.clock.day=d+.45;if(ConquerCourtPeople.justiceInSession('gallows')&&ConquerCourtPeople.justiceInSession('pillory'))day=State.clock.day}
    State.structures=[
      {id:'qa-gallows',type:'eventVenue',venue:'gallows',x:95,y:100,angle:0},
      {id:'qa-pillory',type:'eventVenue',venue:'pillory',x:100,y:100,angle:0},
      {id:'qa-scaffold',type:'eventVenue',venue:'scaffold',x:105,y:100,angle:0},
      {id:'qa-stage',type:'eventVenue',venue:'stage',x:100,y:106,angle:0},
      {id:'qa-joust',type:'eventVenue',venue:'festivalGround',x:100,y:88,angle:0,event:{setup:'joust',phase:'active'}}
    ];
    document.querySelectorAll('#rightPanel,.side-panel,aside,.minimap,#minimap').forEach(e=>e.style.display='none');
    window.__center=(x,y,scale)=>{State.view.scale=scale;draw();const r=wrap.getBoundingClientRect(),c=w2s({x,y});State.view.x+=r.width/2-c.x;State.view.y+=r.height/2-c.y;invalidateSceneCache();draw();draw()};
    return{day};
  });
  assert.ok(setup.day!=null,'a day with the justice works in session');
  const shot=async(name,x,y,scale)=>{
    await page.evaluate(([x,y,s])=>__center(x,y,s),[x,y,scale]);
    await page.waitForTimeout(200);await page.evaluate(()=>{draw();draw()});
    await page.screenshot({path:`${out}/${name}.png`});
    return page.evaluate(()=>ConquerWorld3D.frameFigures());
  };
  const justice=await shot('1-giustizia',100,100.5,4.2);
  const court=justice.filter(f=>f.key.startsWith('civ|court|'));
  assert.ok(court.length>=10,'pillory, gallows and scaffold people are cards: '+court.length);
  assert.ok(court.some(f=>/\|qa-pillory\|condemned\|prisoner\|bound\|/.test(f.key)),'the condemned in the pillory is a card');
  assert.ok(court.some(f=>/\|executioner\|executioner\|/.test(f.key)),'the executioner on the gallows is a card');
  assert.ok(court.every(f=>!f.capsule),'people stand in the vertical person capsule');
  // Close-ups for review: the crowd behind the decks, the condemned in the pillory.
  await shot('1b-forca-zoom',95,100,11);await shot('1c-gogna-zoom',100,100,11);await shot('1d-patibolo-zoom',105,100,11);
  const stage=await shot('2-palco',100,106,4.2);await shot('2b-palco-zoom',100,106,10);
  assert.ok(stage.some(f=>f.key.startsWith('civ|ev|')),'stage actors and audience are cards');
  const joust=await shot('3-giostra',100,88,2.6);
  const horses=joust.filter(f=>f.key.startsWith('civ|a|horse|'));
  assert.ok(horses.length>=2&&horses.every(f=>f.capsule&&Math.hypot(f.capsule.axis.x,f.capsule.axis.y)>.1),'joust horses are cards in their body capsules');
  assert.ok(joust.some(f=>f.key.startsWith('civ|jo|sp|')),'joust spectators are cards');
  assert.ok(joust.some(f=>f.key.startsWith('civ|jo|rider|')),'riders are cards');
  const status=await page.evaluate(()=>ConquerWorld3D.status().failed);
  assert.equal(status,null);
  // Canvas fallback: without World3D the same scenes paint in 2D without errors.
  await page.evaluate(()=>{ConquerWorld3D._setActiveForTest(false);draw()});
  await page.screenshot({path:out+'/4-giostra-2d.png'});
  assert.deepEqual(errors,[]);
  fs.writeFileSync(out+'/report.json',JSON.stringify({setup,court:court.length,horses,errors},null,2));
  console.log('PASS event figures as capsule cards: justice works, stage, joust (horses, riders, spectators) and 2D fallback');
}finally{await browser.close()}
