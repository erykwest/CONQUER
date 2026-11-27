'use strict';
// ANIMAL-VIEWS-261127: the 2D animals in eight views. E/W stay the approved side art; SE S SW NW N
// NE come from the same art built in Blender and traced (src/assets/animal-views.js). Checks the
// module (every species, six views, idle + eight walk phases, colour tokens of the species), that
// every view draws, and that the World3D card picks a view tile (never mirrored) from the heading
// while walking or still, and keeps the side art for E/W, other modes and overlay gear.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ROOT=path.join(__dirname,'..');
class Path2D{constructor(d){this.d=d}}
let calls=[];
const g=new Proxy({},{get:(t,k)=>k in t?t[k]:(...a)=>calls.push(k),set:(t,k,v)=>{t[k]=v;return true}});
const window={};
const box={window,Math,Object,Number,Map,Array,String,JSON,Path2D,console,State:{view:{scale:1}},
  w2s:p=>({x:p.x,y:p.y}),w2sRaw:p=>({x:p.x,y:p.y})};
const context=vm.createContext(box);
for(const f of ['settlement-util.js','assets/animal-views.js','settlement-animals.js'])
  vm.runInContext(fs.readFileSync(path.join(ROOT,'src',f),'utf8'),context,{filename:f});
const A=window.ConquerAnimals,V=window.ConquerAnimalViews;
const SPECIES=['sheep','goat','cow','horse','deer','stag','wolf','boar','bear'];
const OFF=['SE','S','SW','NW','N','NE'];

// 1. The module: every species, six off-profile views, idle + eight walk phases, valid tokens.
for(const sp of SPECIES){
  const set=V[sp];assert.ok(set,sp+': traced views');
  assert.deepEqual([...set.poses],['idle','p0','p1','p2','p3','p4','p5','p6','p7'],sp+': idle and walk phases');
  const colors=A.SPECIES[sp].colors;
  for(const part of set.parts){
    for(const t of [part.fill,part.outline].filter(Boolean))
      if(t.startsWith('coat:'))assert.ok(t.slice(5) in colors,`${sp}: colour ${t} of the species`);
  }
  for(const view of OFF){
    assert.equal(set.views[view]?.frames?.length,9,`${sp} ${view}: nine frames`);
    assert.ok(set.views[view].frames.every(f=>f.length>=4),`${sp} ${view}: every frame has parts`);
  }
}
// 2. Every view draws (fills and outlines), for every species and coat.
for(const sp of SPECIES)for(const view of OFF){
  calls=[];assert.equal(A.drawView(sp,g,0,0,100,{view,phase:null}),true);
  assert.ok(calls.filter(c=>c==='fill').length>4&&calls.includes('stroke'),`${sp} ${view} paints`);
  calls=[];A.drawView(sp,g,0,0,100,{view,phase:3,coat:'black'});
  assert.ok(calls.length>4,`${sp} ${view} walk phase`);
}
// 3. The card: heading -> view tile, not mirrored; E/W and other modes keep the side art.
const cards=[];
window.ConquerWorld3D={figure:(p,z,key,paint,id,mirror)=>{cards.push({key,mirror});return true},screenAxis:f=>({x:f,y:0})};
const card=(o)=>{cards.length=0;A.card('cow',{x:0,y:0},.07,{t:0,seed:0,...o});return cards[0]};
let c=card({mode:'walk',heading:{x:0,y:1}});
assert.match(c.key,/^av\|cow\|S\|\d\|/,'walking toward the viewer: S tile');assert.equal(c.mirror,false,'view tiles are not mirrored');
c=card({mode:'walk',heading:{x:-1,y:-1}});assert.match(c.key,/^av\|cow\|NW\|/,'walking away and left: NW');
c=card({mode:'walk',heading:{x:1,y:0},facing:1});assert.match(c.key,/^a\|cow\|/,'E: the side art');
c=card({mode:'walk',heading:{x:-1,y:0},facing:-1});assert.equal(c.mirror,true,'W: the side art mirrored, as before');
c=card({mode:'browse',heading:{x:0,y:1}});assert.match(c.key,/^a\|cow\|browse/,'browsing keeps the side art');
c=card({mode:'walk',heading:{x:0,y:1},overlay:()=>{}});assert.match(c.key,/^a\|/,'overlay gear keeps the side art');
c=card({mode:'walk',facing:1});assert.match(c.key,/^a\|/,'no heading: the side art');
cards.length=0;A.card('wolf',{x:0,y:0},.08,{mode:'idle',heading:{x:0,y:-1}});assert.match(cards[0].key,/^av\|wolf\|N\|idle/,'standing wolf: idle frame');
// 4. Wiring: the wolves give their walk heading; the module loads before the animals.
assert.match(fs.readFileSync(path.join(ROOT,'src','settlement-wolves.js'),'utf8'),/heading:wolf\.wolfHeading\|\|null/,'wolves pass their heading');
for(const page of ['index.html','figures-lab.html'])
  assert.match(fs.readFileSync(path.join(ROOT,page),'utf8'),/assets\/animal-views\.js[^\n]*\n<script src="\.\/src\/settlement-animals\.js/,page+': views before the animals');
console.log('PASS animal views: nine species traced, every view draws, card view tiles from the heading, side art kept');
