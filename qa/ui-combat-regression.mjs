// CONQUER: end-to-end regression for the 2026-10-13 Builder/Combat merge.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser=await chromium.launch({headless:true,args:['--enable-unsafe-webgpu','--use-angle=swiftshader']});
const page=await browser.newPage({viewport:{width:1280,height:900}});
const errors=[];
page.on('pageerror',e=>errors.push(String(e.stack||e)));
try{
  await page.goto('http://127.0.0.1:4173/?renderer=canvas2d',{waitUntil:'domcontentloaded',timeout:60000});
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

  await page.getByRole('button',{name:'Combattimento e allarmi'}).click();
  assert.equal(await page.locator('#combatControls').isVisible(),true,'Combat controls should open');
  await page.getByRole('button',{name:'Produzione'}).click();
  assert.equal(await page.locator('[data-industry="mine"]').isVisible(),true,'Mine tool should open');
  assert.equal(await page.locator('#combatSelection').count(),1,'Combat HUD must remain mounted while another category is shown');

  const checked=await page.evaluate(()=>{
    const oldStructures=State.structures,oldFounded=State.village.founded,oldWellId=State.village.wellId;
    try{
      const id='qa-regression-well';
      State.structures=[...oldStructures,{id,type:'well',x:100,y:100,size:1.5,groundZ:0}];
      State.village.founded=true;
      State.village.wellId=id;
      draw(); // Previously threw on combatSelection.textContent.
      return {ok:true,selectionExists:!!document.getElementById('combatSelection')};
    }finally{
      State.structures=oldStructures;
      State.village.founded=oldFounded;
      State.village.wellId=oldWellId;
      draw();
    }
  });
  assert.equal(checked.ok,true);
  assert.equal(checked.selectionExists,true);
  assert.deepEqual(errors,[],'Unexpected browser exceptions');
  console.log(JSON.stringify({result:'PASS',dom,checked,errors},null,2));
}finally{
  await browser.close();
}
