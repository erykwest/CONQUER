'use strict';
// Molo: the Builder button and hooks exist; on a synthetic south coast the pier snaps
// square to the coastline, its landing stays on the shore inside the whitezone while
// the deck reaches 8U out to sea, it is refused inland, and it offers two berths
// (left / right of the head) off the deck edge. Its mesh has piles below the waterline
// and goods from the scatter model on the boards.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
assert.match(read('index.html'),/<button data-pier>/,'Builder button');
assert.match(read('index.html'),/settlement-pier\.js/,'script loaded');
assert.ok(read('src/settlement-builder-ux.js').includes("['[data-pier]'"),'listed in the palette');
assert.match(read('src/settlement-app-input.js'),/State\.tool\.kind==='pier'/,'one-click pier tool');
assert.match(read('src/settlement-placement.js'),/ConquerPier\.validate\(s\)/,'placement preflight hook');
assert.match(read('src/settlement-castle.js'),/ConquerPier\?\.is\(s\)\)return window\.ConquerPier\.footprint\(s\)/,'footprint hook');
const core=read('src/settlement-core.js');
assert.match(core,/ConquerPier\?\.is\(s\)\)return window\.ConquerPier\.cost\(s\)/,'cost hook');
assert.match(core,/ConquerPier\?\.is\(s\)\)return window\.ConquerPier\.buildDays\(s\)/,'duration hook');
assert.match(read('src/settlement-world3d.js'),/ConquerPier\.addToBuilder\(m,s\)/,'WebGL hook');
console.log('PASS Builder: pier button, script, palette, tool and hooks');

// A sea along the south edge, coast at y=150 (whitezone 50..150).
const coast=[{x:0,y:150},{x:200,y:150}];
const sea={type:'sea',side:'south',coastline:coast,points:[{x:0,y:150},{x:200,y:150},{x:200,y:200},{x:0,y:200}]};
const pointInPolygon=(p,poly)=>{let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)c=!c}return c};
const window={},State={seed:7,structures:[],environment:[sea]};
const ctx=vm.createContext({window,State,Math,Object,Number,Array,Map,Set,String,JSON,
  BUILD_MIN:50,BUILD_MAX:150,
  dist:(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),
  closestPointOnSegment:(p,a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,L2=dx*dx+dy*dy,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/L2));return{x:a.x+t*dx,y:a.y+t*dy}},
  environmentContains:(f,p)=>f.type==='sea'&&pointInPolygon(p,f.points),
  terrainElevation:()=>0,terrainSlopeKind:()=>null,structureRotationStep:a=>Math.round(a/(Math.PI/12)),
  seedRand:s=>{let t=s>>>0;return()=>{t=(t*1664525+1013904223)>>>0;return t/4294967296}}});
for(const f of ['assets/scatter-model.js','settlement-pier.js'])vm.runInContext(read('src/'+f),ctx);
const P=window.ConquerPier;
const s={...P.make(),id:'p1',x:100.4,y:148.6};
P.snapToCoast(s);
assert.ok(Math.abs(s.y-150)<1e-9&&Math.abs(s.x-100.4)<1e-9,'the pier root lands on the coastline');
assert.ok(Math.abs(s.angle-Math.PI/2)<1e-9,'and points straight out to sea');
assert.deepEqual({...P.validate(s)},{ok:true,ground:0},'a coast pier is valid');
const ys=P.footprint(s).map(p=>p.y);
assert.ok(Math.abs(Math.max(...ys)-158)<1e-9,'the deck reaches 8U over the sea');
assert.ok(P.landing(s).every(p=>p.y<=150+1e-9&&p.y>=50),'the landing stays on the shore, in the whitezone');
assert.equal(P.validate({...s,y:140}).ok,false,'refused away from the coastline');
assert.equal(P.validate({...s,x:30}).ok,false,'refused with its landing outside the whitezone');
const berths=P.moorings(s);
assert.equal(berths.map(b=>b.side).join(),'left,right','two berths, left and right');
for(const b of berths){
  assert.ok(b.y>150+5,b.side+' berth is out at the head of the pier');
  assert.ok(Math.abs(Math.abs(b.x-s.x)-(.75+.9))<1e-9,b.side+' berth lies off the deck edge');
  assert.ok(sea&&pointInPolygon(b,sea.points),b.side+' berth is on open water');
}
assert.ok(berths[0].x<s.x!==berths[1].x<s.x,'one berth each side');
const [deck,props]=P.meshes(s,0);
const zs=[];for(let i=2;i<deck.pos.length;i+=3)zs.push(deck.pos[i]);
assert.ok(Math.min(...zs)<-.5,'piles are driven below the waterline');
assert.ok(props&&props.col.length>0,'scatter goods stand on the deck');
const pz=[];for(let i=2;i<props.pos.length;i+=3)pz.push(props.pos[i]);
assert.ok(Math.min(...pz)>=.6-.05,'goods sit on the boards, not in the water');
console.log('PASS runtime: coast snap, 8U reach, landing in the whitezone, two berths, piles and deck goods');
