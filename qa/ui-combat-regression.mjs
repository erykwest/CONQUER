// CONQUER: end-to-end regression for the 2026-10-13 Builder/Combat merge.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser=await chromium.launch({headless:true,args:['--enable-unsafe-webgpu','--use-angle=swiftshader']});
const page=await browser.newPage({viewport:{width:1280,height:900}});
const errors=[];
page.on('pageerror',e=>errors.push(String(e.stack||e)));
try{
  await page.goto((process.env.CONQUER_QA_URL||'http://127.0.0.1:4173')+'/?renderer=canvas2d',{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>!!window.ConquerCombat&&!!document.querySelector('#builder.ux-builder'),{timeout:15000});
  const dom=await page.evaluate(()=>({
    combat:!!document.getElementById('combatControls'),
    selection:!!document.getElementById('combatSelection'),
    stats:!!document.getElementById('combatStats'),
    alarm:!!document.getElementById('combatAlarm'),
    industries:['loggingCamp','quarry','mine'].map(id=>!!document.querySelector('[data-industry="'+id+'"]')),
    categories:[...document.querySelectorAll('.ux-rail button[aria-label]')].map(b=>b.getAttribute('aria-label'))
  }));
  assert.ok(dom.combat&&dom.selection&&dom.stats&&dom.alarm,'Combat HUD must survive the toolbar conversion');
  assert.ok(dom.industries.every(Boolean),'All three extraction tools must be preserved');
  assert.ok(dom.categories.includes('Combattimento e allarmi'),'Combat category must remain navigable');
  assert.ok(dom.categories.includes('Produzione'),'Production category must remain navigable');
  const devAndSnow=await page.evaluate(()=>{
    const defaults={
      light:State.daylightOverride,
      season:State.seasonOverride,
      weather:State.weatherOverride,
      fog:window.ConquerCombat.serialize().fog,
      tracksReady:!!window.ConquerSnowTracks
    };
    const old={season:State.season,override:State.seasonOverride,environment:State.environment,relief:State.relief};
    try{
      State.season='winter';State.seasonOverride='winter';
      State.environment=[];State.relief=null;
      window.ConquerSnowTracks.reset();
      window.ConquerSnowTracks.observe('qa-walking',{x:100,y:100},0);
      window.ConquerSnowTracks.observe('qa-walking',{x:104,y:100},.04);
      const footprints=window.ConquerSnowTracks.count();
      draw();
      return{...defaults,footprints};
    }finally{
      window.ConquerSnowTracks.reset();
      State.season=old.season;State.seasonOverride=old.override;
      State.environment=old.environment;State.relief=old.relief;
      draw();
    }
  });
  assert.equal(devAndSnow.light,null,'Default daylight follows the procedural clock');
  assert.equal(devAndSnow.season,null,'Default season follows the calendar');
  assert.equal(devAndSnow.weather,null,'Default weather remains procedural');
  assert.equal(devAndSnow.fog,false,'Combat fog must start disabled');
  assert.equal(devAndSnow.tracksReady,true,'Snow footprint module must be loaded');
  assert.ok(devAndSnow.footprints>=6,'Four world units of movement must leave a winter trail');

  // Procedural defaults must not prevent explicit DEV overrides or toggling
  // back to automatic behaviour. Exercise the actual controls.
  await page.locator('#devToggle').click();
  for(const [selector,key,forced] of [
    ['[data-light-override="day"]','daylightOverride','day'],
    ['[data-season="summer"]','seasonOverride','summer'],
    ['[data-weather-override="sun"]','weatherOverride','sun']
  ]){
    await page.locator(selector).click();
    assert.equal(await page.evaluate(k=>State[k],key),forced);
    await page.locator(selector).click();
    assert.equal(await page.evaluate(k=>State[k],key),null);
  }
  await page.locator('#devToggle').click();


  // Exercise actual Canvas house drawing with multiple streetfront modules.
  // A standalone geometry VM test cannot detect missing canvas integration.
  const denseBrowser=await page.evaluate(()=>{
    const oldStructures=State.structures,oldCache=urbanLotCache,oldSelected=State.selectedId;
    const house={id:'qa-browser-density',type:'house',auto:true,houseLevel:3,
      x:103,y:101.4,w:1.5,h:1,angle:0};
    const road={id:'qa-browser-density-road',type:'road',routeId:'qa-main',
      a:{x:100,y:99.55},b:{x:106,y:99.55},width:.62};
    const lot={houseId:house.id,points:[{x:100,y:100},{x:106,y:100},
      {x:106,y:104},{x:100,y:104}]};
    try{
      State.structures=[...oldStructures,house,road];
      urbanLotCache=[lot];State.selectedId=house.id;
      const l3=urbanDenseParts(house),n3=urbanDenseBuildingCount(house);
      drawHouse(house); // real roof, chimney, turret/facade canvas routines
      house.houseLevel=4;
      const l4=urbanDenseParts(house),n4=urbanDenseBuildingCount(house);
      drawHouse(house);
      return{n3,n4,l3Bodies:l3.filter(x=>x.kind==='body').length,
        l4Turrets:l4.filter(x=>x.kind==='turret').length,
        physicalParts:l4.every(part=>!!part.points?.length)};
    }finally{
      State.structures=oldStructures;State.selectedId=oldSelected;
      urbanLotCache=oldCache;invalidateSceneCache();draw();
    }
  });
  assert.equal(denseBrowser.n3,3,'Real browser must render three L3 frontage houses');
  assert.equal(denseBrowser.n4,4,'Real browser must render four L4 frontage houses');
  assert.ok(denseBrowser.l3Bodies>=6,'L3 frontage modules must preserve L/T wings');
  assert.equal(denseBrowser.l4Turrets,4,'Each L4 module needs its own turret');
  assert.equal(denseBrowser.physicalParts,true);

  await page.getByRole('button',{name:'Combattimento e allarmi'}).click();
  assert.equal(await page.locator('#combatControls').isVisible(),true,'Combat controls should open');
  assert.equal(await page.locator('#combatPatrolAdd').isVisible(),true,'Patrol + must be visible inside the Combat category');
  assert.equal(await page.locator('#combatPatrolRemove').isVisible(),true,'Patrol - must be visible inside the Combat category');
  await page.getByRole('button',{name:'Produzione'}).click();
  assert.equal(await page.locator('[data-industry="mine"]').isVisible(),true,'Mine tool should open');
  assert.equal(await page.locator('#combatSelection').count(),1,'Combat HUD must remain mounted while another category is shown');

  const checked=await page.evaluate(()=>{
    const oldStructures=State.structures,oldFounded=State.village.founded,oldWellId=State.village.wellId;
    const oldCombat=window.ConquerCombat.serialize();
    try{
      const id='qa-regression-well';
      State.structures=[...oldStructures,{id,type:'well',x:100,y:100,size:1.5,groundZ:0}];
      State.village.founded=true;
      State.village.wellId=id;
      draw(); // Previously threw on combatSelection.textContent.
      document.getElementById('combatPatrolAdd').click();
      const active=window.ConquerCombat.serialize().units.filter(u=>u.kind==='patrol');
      window.ConquerCombat.tick(.20);
      const state=window.ConquerCombat.serialize();
      const statusText=document.getElementById('combatPatrolCount').textContent;
      document.getElementById('combatPatrolRemove').click();
      return {ok:true,selectionExists:!!document.getElementById('combatSelection'),
        patrolAdded:active.length===1,patrolVisible:statusText.includes('1 (2 pikemen)'),
        patrolRemoved:!window.ConquerCombat.serialize().units.some(u=>u.kind==='patrol'),
        routeChecked:!!state.units.find(u=>u.kind==='patrol')};
    }finally{
      State.structures=oldStructures;
      State.village.founded=oldFounded;
      State.village.wellId=oldWellId;
      window.ConquerCombat.restore(oldCombat);
      draw();
    }
  });
  assert.equal(checked.ok,true);
  assert.equal(checked.selectionExists,true);
  assert.equal(checked.patrolAdded,true,'Patrol + must create one two-pikeman patrol');
  assert.equal(checked.patrolVisible,true,'Patrol counter must be updated');
  assert.equal(checked.patrolRemoved,true,'Patrol - must remove a patrol without disrupting the permanent squad');
  assert.equal(checked.routeChecked,true,'Patrol must survive a simulation tick and be serializable');
  assert.deepEqual(errors,[],'Unexpected browser exceptions');
  console.log(JSON.stringify({result:'PASS',dom,devAndSnow,denseBrowser,checked,errors},null,2));
}finally{
  await browser.close();
}
