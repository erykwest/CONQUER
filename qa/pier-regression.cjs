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
for(const r of [4,12]){
  assert.match(read('index.html'),new RegExp('<button data-pier="'+r+'">'),'Builder button L'+r);
  assert.ok(read('src/settlement-builder-ux.js').includes("['[data-pier=\""+r+"\"]'"),'L'+r+' listed in the palette');
}
assert.match(read('index.html'),/<button data-quay>/,'quay button');
assert.ok(read('src/settlement-builder-ux.js').includes("['[data-quay]'"),'quay listed in the palette');
assert.match(read('index.html'),/settlement-quay\.js[\s\S]*settlement-pier\.js/,'scripts loaded, quay first');
assert.match(read('src/settlement-app-input.js'),/State\.tool\.kind==='quay'/,'two-click quay tool');
assert.match(read('src/settlement-placement.js'),/ConquerQuay\.validate\(s\)/,'quay placement preflight');
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
  pointSegmentDistance:(p,a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t)},
  terrainElevation:()=>0,terrainSlopeKind:()=>'steep',structureRotationStep:a=>Math.round(a/(Math.PI/12)),
  seedRand:s=>{let t=s>>>0;return()=>{t=(t*1664525+1013904223)>>>0;return t/4294967296}}});
for(const f of ['assets/scatter-model.js','settlement-quay.js','settlement-pier.js'])vm.runInContext(read('src/'+f),ctx);
const P=window.ConquerPier,Q=window.ConquerQuay;
const s={...P.make(12),id:'p1',x:100.4,y:148.6};
P.snapToCoast(s);
assert.ok(Math.abs(s.y-150)<1e-9&&Math.abs(s.x-100.4)<1e-9,'the pier root lands on the coastline');
assert.ok(Math.abs(s.angle-Math.PI/2)<1e-9,'and points straight out to sea');
// No buildable-terrain rules: the stub reports steep ground everywhere and the pier is still fine.
assert.equal(P.validate(s).ok,true,'a coast pier is valid, whatever the shore');
assert.equal(P.validate(s).ground,0,'deck level from the shore');
const reachY=p=>Math.max(...P.footprint(p).map(q=>q.y))-150;
assert.ok(Math.abs(reachY(s)-12)<1e-9,'L12 reaches 12U over the sea');
const small={...P.make(4),id:'p4',x:120,y:149};P.snapToCoast(small);
assert.ok(Math.abs(reachY(small)-4)<1e-9&&P.validate(small).ok,'L4 reaches 4U and is valid');
assert.ok(P.cost(small).wood<P.cost(s).wood&&P.buildDays(small)<P.buildDays(s),'the small pier is cheaper and quicker');
assert.equal(P.reachOf({type:'pier',x:0,y:0}),8,'piers saved before the sizes keep 8U');
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
console.log('PASS runtime: coast snap, L4/L12 reach, no terrain rules, landing in the whitezone, two berths, piles and deck goods');

// Stone quay: two clicks along the shore or out in the water, piers branch off its sea edge.
const quay={id:'q1',...Q.make({x:80,y:149},{x:96,y:149})};
assert.equal(Q.validate(quay).ok,true,'a quay along the shore is valid');
assert.equal(Q.validate(quay).side,1,'its sea face is the side towards the water');
assert.equal(Q.validate({...quay,...Q.make({x:80,y:120},{x:96,y:120})}).ok,false,'refused inland');
assert.equal(Q.validate({...quay,...Q.make({x:30,y:149},{x:46,y:149})}).ok,false,'refused outside the whitezone');
assert.ok(Q.cost(quay).stone>0&&Q.buildDays(quay)>0,'a stone work with a building site');
State.structures.push({...quay,seaSide:1});
const branch={...P.make(4),id:'pb',x:88,y:150.1};P.snapToCoast(branch);
assert.equal(branch.onQuay,'q1','a pier near a quay branches off it');
assert.ok(Math.abs(branch.y-150)<1e-9&&Math.abs(branch.angle-Math.PI/2)<1e-9,'from the quay sea edge, square to it');
const site=P.validate(branch);
assert.ok(site.ok&&site.onQuay==='q1'&&site.ground===0,'valid on the quay, deck flush with its top');
// A quay built just off the shore: its sea edge is farther from the cursor than the coastline,
// yet a pier placed on it must still branch off the quay.
State.structures.push({id:'q2',...Q.make({x:120,y:150.3},{x:136,y:150.3}),seaSide:1});
const offshore={...P.make(4),id:'pc',x:128,y:150.3};P.snapToCoast(offshore);
assert.equal(offshore.onQuay,'q2','a pier on a quay just off the shore still branches off the quay');
assert.ok(Math.abs(offshore.y-151.3)<1e-9,'from its sea edge');
console.log('PASS quay: shore or water, whitezone, sea face, piers branch off it');

// Test fleet: ships moor at the free berths of a pier with their sails furled, one each side,
// alongside the deck; with no berth left they ride at anchor off the coast, sails set.
for(const f of ['heraldry-shapes.js','assets/ship-models.js','settlement-ships.js','settlement-ship-crew.js','settlement-fleet.js'])vm.runInContext(read('src/'+f),ctx);
const F=window.ConquerFleet;
State.structures.length=0;State.structures.push(s);
const one=F.spawn({key:'cocca',allegiance:'merchant'}),two=F.spawn({key:'barca',allegiance:'player'}),three=F.spawn({key:'nave',allegiance:'foreign',realm:'azure'});
assert.equal(one.berth.side,'left','first ship at the left berth');
assert.equal(two.berth.side,'right','second at the right berth');
assert.equal(three.berth,null,'third at anchor: no berth left');
assert.ok(one.crew.sail.furl===1&&two.crew.sail.furl===1,'in port the sails are furled');
assert.equal(three.crew.sail.furl,0,'at anchor the sails stay set');
assert.ok(Math.abs(one.pose.heading-s.angle)<1e-9,'moored bow to the sea');
const B=window.ConquerShipModels.ships.cocca.B,edge=Math.abs(one.pose.x-s.x);
assert.ok(edge>.75+B/2-.01&&edge<.75+B/2+.3,'alongside the deck edge, not on it');
assert.ok(pointInPolygon(three.pose,sea.points),'the anchored ship floats on the sea');
F.order('lower');assert.ok(one.crew.pending==='lower','orders reach the crews');
F.clear();assert.equal(F.ships.length,0,'cleared');
console.log('PASS fleet: moored at berths with sails furled, anchored off the coast, orders, clear');
