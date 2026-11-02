'use strict';
// Ship crews: every ship has crew marks from Blender (deck walk, mast climbs, spots aloft)
// and a crew of its size. Off duty the sailors stay on the deck; on an order the topmen go
// to their mast and climb, the sails wait until they are all aloft, the deck hands haul,
// and once the sails are set or furled the topmen come down again.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const lab=read('figures-lab.html');
assert.ok(lab.indexOf('src="./src/settlement-ships.js')<lab.indexOf('src="./src/settlement-ship-crew.js'),'Asset Lab loads the crew after the ships');
assert.match(lab,/ConquerShipCrew/,'the ship preview shows the crew');

const window={};
const ctx=vm.createContext({window,Math,Object,Number,Array,String,JSON});
for(const f of ['heraldry-shapes.js','assets/ship-models.js','settlement-ships.js','settlement-ship-crew.js'])vm.runInContext(read('src/'+f),ctx);
const M=window.ConquerShipModels,C=window.ConquerShipCrew;
const SIZE={barca:2,cargo:3,caravella:5,cocca:8,nave:10};
for(const [key,m] of Object.entries(M.ships)){
  const c=m.crew;
  assert.equal(c.n,SIZE[key],key+': crew size');
  assert.ok(c.deck.length>=2&&c.masts.length>=1,key+': deck walk and mast climbs');
  for(const mast of c.masts){
    assert.ok(mast.climb.at(-1)[2]>mast.climb[0][2]+1,key+': the climb goes up the mast');
    assert.ok(mast.aloft.every(p=>p[2]>mast.climb[0][2]+1),key+': working spots are aloft');
  }
  const cs=C.crewState(key,'qa');
  assert.equal(cs.sailors.length,c.n,key+': one sailor per hand');
  const tops=cs.sailors.filter(s=>s.role==='top');
  assert.ok(tops.length>=1&&tops.length<c.n,key+': topmen and at least one deck hand');
  const deckTop=Math.max(...c.deck.map(p=>p[2]))+.05;
  for(let i=0;i<100;i++)C.step(cs,.1);
  assert.ok(cs.sailors.every(s=>s.p[2]<=deckTop),key+': off duty, everybody is on deck');
  assert.equal(cs.sail.furl,0,key+': sails set while nobody gives orders');
  C.order(cs,'raise');
  let movedBeforeAloft=false,sawClimb=false,sawHaul=false,aloftAt=null;
  for(let i=0;i<1200;i++){
    C.step(cs,.05);
    const allAloft=tops.every(s=>s.mode==='aloft');
    if(cs.sail.t>0&&!allAloft&&aloftAt===null)movedBeforeAloft=true;
    if(allAloft&&aloftAt===null)aloftAt=i;
    sawClimb||=tops.some(s=>s.mode==='climb');
    sawHaul||=cs.sailors.some(s=>s.mode==='haul');
  }
  assert.ok(sawClimb,key+': topmen climb');
  assert.ok(aloftAt!==null,key+': topmen reach their spots aloft');
  assert.ok(!movedBeforeAloft,key+': the sails wait for the topmen');
  assert.ok(sawHaul,key+': deck hands haul on the halyards');
  assert.equal(cs.sail.furl,1,key+': sails raised to the yards');
  assert.ok(cs.sailors.every(s=>s.p[2]<=deckTop),key+': topmen back on deck afterwards');
  C.order(cs,'lower');for(let i=0;i<1200;i++)C.step(cs,.05);
  assert.equal(cs.sail.furl,0,key+': sails lowered again');
  const poses=C.sailors(cs);
  assert.ok(poses.every(p=>p.local.length===3&&p.local.every(Number.isFinite)),key+': renderer poses');
}
console.log('PASS ship crews: sizes, deck walk, climbs, sails wait for the topmen, hauling, back on deck');
