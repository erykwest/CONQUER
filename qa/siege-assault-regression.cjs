'use strict';
// Siege assault choreography against the game's low (H1) wall, stone gatehouse and
// water moat: the ram is pushed over the filled moat and swung against the gate,
// archers shoot from behind the mantlet short of the moat, ladders are raised and
// climbed onto the wall top, the tower bridge lands on the wall and the party
// crosses, fascines fill the moat through the game's fill patch. H2 walls are out
// of reach. Also: the 3D ground re-bakes when a moat fill patch changes.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const window={};
const ctx=vm.createContext({window,Math,Object,Number,Array,Map,Float32Array,String});
for(const f of ['assets/siege-engines-model.js','settlement-siege-engines3d.js','settlement-siege-assault.js'])
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..','src',f),'utf8'),ctx);
const SA=window.ConquerSiegeAssault,SE=window.ConquerSiegeEngines3D,G=SA.DEFAULT;
const H1=1.15,H2=2.10,near=(a,b,eps,msg)=>assert.ok(Math.abs(a-b)<eps,msg+' ('+a.toFixed(3)+' vs '+b.toFixed(3)+')');
const partRange=(e,part)=>{let s=0;for(const [n,p] of Object.entries(window.ConquerSiegeModel.engines[e].parts)){if(n===part)return[s,s+p.c.length*9];if(n!=='wheel'&&n!=='hides')s+=p.c.length*9}};
const along=(m,r,k)=>{let best=-1e9,at=null;for(let i=r[0];i<r[1];i+=3)if(m.pos[i+k]>best){best=m.pos[i+k];at=[m.pos[i],m.pos[i+1],m.pos[i+2]]}return at};

assert.equal(G.walk,H1,'scenes use the game H1 wall height (structureHeight)');
assert.equal(SE.WALL_WALK,H1,'engines are sized on the same wall walk');
for(const kind of SA.KINDS)for(let t=0;t<SA.CYCLE[kind];t+=.25){
  const sc=SA.scene(kind,t);
  for(const s of sc.soldiers)assert.ok([s.x,s.y,s.z].every(Number.isFinite),kind+' soldier finite at '+t);
  for(const me of SA.meshes(sc)){
    assert.ok(Array.from(me.pos).every(Number.isFinite),kind+' mesh finite at '+t);
    assert.equal(me.pos.length,me.col.length*9);
  }
  // Nobody walks inside the wall: in front of the face, or up on the wall top.
  for(const s of sc.soldiers)if(s.x>G.face+.02)assert.ok(s.z>G.walk-.02,kind+' man past the face is up on the wall at '+t);
  // Nobody wades the moat outside a filled crossing.
  for(const s of sc.soldiers)if(s.z<.01&&s.x>G.moat[0]&&s.x<G.moat[1])
    assert.ok(sc.fill&&sc.fill.progress>=1&&Math.abs(s.y-(sc.fillY||0))<=sc.fill.span/2+.05,kind+' man in the moat at '+t);
}
console.log('PASS every scene finite; no one inside the wall or wading the moat');

// Ram: the head meets the gatehouse door on the blow, clear of it drawn back.
const head=t=>{const sc=SA.scene('ram',t);return along(SE.triangles('ram',sc.engine.place,sc.engine.state),partRange('ram','ram'),0)[0]};
near(head(7+1.8*.72),G.door,.04,'the ram head meets the door');
assert.ok(head(7+1.8*.3)<G.door-.08,'drawn back it is clear of the door');
assert.ok(SA.scene('ram',9).fill.span>=SA.HEAVY.ram,'it crossed on a crossing as wide as a ram');
console.log('PASS ram battered the gate');

// Mantlet: stops short of the moat; archers step out and arrows reach the wall.
const mt=SA.scene('mantlet',3),mt2=SA.scene('mantlet',7.3);
assert.ok(mt.soldiers.every(s=>s.x<mt.engine.place.x),'the men are behind the shield');
assert.ok(SA.scene('mantlet',13).engine.place.x<G.moat[0],'it stops short of the moat');
assert.ok(mt2.soldiers.some(s=>s.aim>0)&&mt2.arrows.length>0,'an archer steps out and looses');
console.log('PASS mantlet covers the archers');

// Ladder: rests on the wall-top edge, climbed, four men end up on the wall top.
const lad=SA.scene('ladder',10),lm=SE.triangles('ladder',lad.engine.place,lad.engine.state),top=along(lm,partRange('ladder','ladder'),2);
assert.ok(top[2]>H1+.1&&top[2]<H2,'raised, it reaches over the H1 wall but never an H2 one');
assert.ok(Math.abs(top[0]-G.face)<.15,'its head rests on the wall face');
const ld=SA.scene('ladder',17);
assert.equal(ld.soldiers.filter(s=>Math.abs(s.z-G.walk)<1e-6&&s.x>G.face).length,4,'four men on the wall top');
const climbing=SA.scene('ladder',9.6).soldiers.find(s=>s.climb);
assert.ok(climbing&&climbing.z>.05&&climbing.z<G.walk,'a man is half way up');
console.log('PASS ladder raised and climbed onto the wall');

// Tower: bridge tip rests on the wall top; the party crosses; the deck is within reach of H1 only.
const tw=SA.scene('tower',12),tm=SE.triangles('tower',tw.engine.place,tw.engine.state),tip=along(tm,partRange('tower','bridge'),0);
assert.ok(tip[0]>G.face&&tip[0]<G.face+G.thick,'the bridge lands on the wall top');
near(tip[2],G.walk,.06,'and rests on it');
assert.ok(window.ConquerSiegeModel.engines.tower.rig.deck<H2,'the tower deck is far below an H2 wall top');
assert.equal(SA.scene('tower',19).soldiers.filter(s=>s.x>G.face).length,5,'five men cross onto the wall');
console.log('PASS tower bridge lands and the party crosses');

// Moat: the fill patch grows with each fascine thrown, to a crossing as wide as a tower.
assert.equal(SA.scene('moat',.5).fill.progress,0);
assert.ok(SA.scene('moat',8).fill.progress>0&&SA.scene('moat',8).fill.progress<1,'it fills bundle by bundle');
assert.equal(SA.scene('moat',16).fill.progress,1);
assert.ok(SA.scene('moat',16).fill.span>=SA.HEAVY.tower,'wide enough for the tower');
console.log('PASS fascines fill the moat');

// world3d: moat fill patches are part of the ground signature (else the 3D ground never shows a fill).
const w3=fs.readFileSync(path.join(__dirname,'..','src','settlement-world3d.js'),'utf8');
assert.match(w3,/s\.fills\?\.length\?s\.fills\.map/,'ground signature includes moat fills');
assert.match(w3,/function addMesh/,'world3d takes dynamic meshes');
console.log('PASS world3d re-bakes filled moats and draws dynamic meshes');

// Upgrades. Level 2 tower for the high (H2) wall: its bridge lands on the H2 wall top,
// archers stand on its fighting top; the ladder still never reaches H2.
const G2={walk:H2};
const tw2=SA.scene('tower',12,G2);
assert.equal(tw2.engine.name,'tower2','an H2 wall calls for the level 2 tower');
const tip2=along(SE.triangles('tower2',tw2.engine.place,tw2.engine.state),partRange('tower2','bridge'),0);
near(tip2[2],H2,.06,'its bridge rests on the H2 wall top');
const archers=tw2.soldiers.filter(s=>s.type==='archer');
assert.equal(archers.length,4,'four archers on the fighting top');
assert.ok(archers.every(s=>s.z>H2+.5),'standing above the H2 wall top');
assert.ok(SA.scene('tower',6,G2).arrows.length>0,'shooting while it closes in');
assert.equal(SA.scene('tower',19,G2).soldiers.filter(s=>s.x>G.face&&s.type==='spearman').length,5,'the party crosses onto the H2 wall');
// Hides: a separate upgrade part, shown only when bought.
const plain=SE.triangles('tower',{x:0,y:0},{}),hid=SE.triangles('tower',{x:0,y:0},{hides:true});
assert.ok(hid.col.length>plain.col.length,'hides add their patches');
assert.equal(SA.scene('tower',3,{},{hides:true}).engine.state.hides,true,'the scene passes the upgrade on');
console.log('PASS tower upgrades: level 2 for H2 with archers, hides');