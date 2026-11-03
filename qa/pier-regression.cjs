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
// A mole: a quay run out square to the shore has water on both sides; piers branch off
// either side (not off its dry end on the shore), and two piers facing each other across
// the mole keep clear of each other: on a quay the landing is only a lip.
State.structures.length=0;
const mole={id:'m1',...Q.make({x:60,y:148},{x:60,y:164})};
State.structures.push(mole);
assert.equal(Q.wetSides(mole).length,2,'a mole has water on both sides');
const westPier={...P.make(4),id:'pw',x:58.8,y:154};P.snapToCoast(westPier);
const eastPier={...P.make(4),id:'pe',x:61.2,y:154};P.snapToCoast(eastPier);
assert.ok(westPier.onQuay==='m1'&&eastPier.onQuay==='m1','piers branch off both sides of the mole');
assert.ok(Math.cos(westPier.angle)<-.99&&Math.cos(eastPier.angle)>.99,'each square to its side, out to the water');
const xsW=P.footprint(westPier).map(p=>p.x),xsE=P.footprint(eastPier).map(p=>p.x);
assert.ok(Math.max(...xsW)<Math.min(...xsE),'facing piers do not overlap across the mole');
const dry={...P.make(4),id:'pd',x:58.8,y:148.6};P.snapToCoast(dry);
assert.notEqual(dry.onQuay,'m1','no pier off the dry end of the mole on the shore');
// Rules off a quay: at least 4U from the shore, at least 5U from the next pier on the same side.
// (The stub's water starts at the whitezone edge: widen the zone for these placements.)
ctx.BUILD_MAX=170;
const nearShore={...P.make(4),id:'pn',x:58.8,y:152};P.snapToCoast(nearShore);
assert.equal(nearShore.onQuay,'m1','a pier near the shore still snaps to the mole');
assert.match(P.validate(nearShore).reason||'',/4U from the shore/,'refused closer than 4U to the shore');
assert.ok(P.validate(westPier).ok,'4U from the shore is fine');
State.structures.push(westPier,eastPier);
const tooClose={...P.make(4),id:'pt',x:58.8,y:158};P.snapToCoast(tooClose);
assert.match(P.validate(tooClose).reason||'',/5U apart/,'refused 4U from the previous pier on the same side');
const spaced={...P.make(4),id:'ps',x:58.8,y:159};P.snapToCoast(spaced);
assert.ok(P.validate(spaced).ok,'5U from the previous pier is fine');
assert.ok(P.validate(eastPier).ok,'facing piers on the two sides of the mole are fine: each side is spaced on its own');
// Berths along the quay: a slot every 5U on each wet face, off within 4U of a pier, off where a
// wall stands against that face.
{
  const slots=Q.berths(mole),ys=k=>slots.filter(b=>b.side===k).map(b=>b.edge.y).sort((a,b)=>a-b);
  assert.deepEqual([...ys(1)],[160.5],'west face: only the slot 6.5U from the pier is open (150.5 and 155.5 are within 4U)');
  assert.deepEqual([...ys(-1)],[160.5],'east face too');
  assert.ok(slots.every(b=>Math.abs(Math.abs(b.angle)-Math.PI/2)<1e-9),'ships lie along the quay');
  const wallWest={id:'ww',type:'wall',a:{x:58.75,y:158},b:{x:58.75,y:163},aSnap:'quay:m1',bSnap:'quay:m1'};
  State.structures.push(wallWest);
  assert.equal(Q.berths(mole).map(b=>b.side).join(),'-1','a wall on the west face closes its slot');
  State.structures.pop();
}
ctx.BUILD_MAX=150;
// Wall magnet on a quay: either long side (the wall against the outer face, set out by half
// its width), the ends too; a wall with both ends on the same quay follows the face straight
// at any angle and rises from the waterline; a wall that leaves the quay keeps the terrain rules.
{
  const near=Q.snapWallAnchor({x:58.6,y:156},.5),far=Q.snapWallAnchor({x:58.6,y:160},.5);
  assert.equal(near.structureId,'quay:m1','a wall end snaps to the quay side');
  assert.ok(Math.abs(near.point.x-(60-1-.25))<1e-9,'on the axis of a wall outside the quay face');
  assert.equal(Q.snapWallAnchor({x:61.4,y:156},.5).point.x,60+1+.25,'the other side of the quay too');
  assert.equal(Q.snapWallAnchor({x:56,y:156},.5),null,'no magnet away from the quay');
  const route=Q.wallRoute(near.point,far.point,near.structureId,far.structureId,{max:8});
  assert.ok(route&&route.segments.length===1&&Math.abs(route.length-4)<1e-9,'one straight wall along the edge');
  const tilted=Q.wallRoute({x:0,y:0},{x:3,y:1},'quay:m1','quay:m1',{max:8});
  assert.ok(Math.abs(tilted.segments[0].angle-Math.atan2(1,3))<1e-9,'at the quay angle, off the 15° lattice');
  assert.equal(Q.wallRoute(near.point,far.point,near.structureId,null,{max:8}),null,'only with both ends on the quay');
  assert.ok(Math.abs(Q.wallRoute({x:0,y:0},{x:12,y:0},'quay:m1','quay:m1',{max:8}).length-8)<1e-9,'clamped to the wall maximum');
  const wall={type:'wall',aSnap:'quay:m1',bSnap:'quay:m1'};
  assert.equal(Q.wallGroundZ(wall),Q.TOP,'its 0 is the quay top, on a plinth from the sea bed');
  assert.equal(Q.wallGroundZ({...wall,bSnap:null}),null,'a wall leaving the quay keeps the terrain rules');
  assert.ok(Q.isWallOn(wall,mole)&&!Q.isWallOn({type:'wall'},mole),'walls on the quay do not collide with it');
  // Towers: against a face or on a corner, inner side (front, +angle) to the quay, at its top.
  const face=Q.snapTower({x:58.2,y:156},{shape:'square',size:1.5});
  assert.ok(face&&face.quayId==='m1'&&Math.abs(face.point.x-(60-1-.75))<1e-9,'a tower stands against the face');
  assert.ok(Math.abs(Math.cos(face.angle)-1)<1e-9,'its inner side faces the quay');
  const corner=Q.snapTower({x:58.2,y:164.8},{shape:'square',size:1.5});
  assert.ok(corner&&Math.abs(corner.point.y-(164+.75))<1e-9&&Math.abs(corner.point.x-(60-1-.75))<1e-9,'or on a corner, set out diagonally');
  assert.ok(Math.abs(Math.sin(corner.angle)+1)<1e-9,'facing along the quay towards its middle');
  const cap=Q.snapTower({x:60,y:164.9},{shape:'square',size:1.5});
  assert.ok(cap&&Math.abs(cap.point.x-60)<1e-9&&Math.abs(cap.point.y-164.75)<1e-9&&Math.abs(Math.sin(cap.angle)+1)<1e-9,
    'or capping the end of the quay, door along the quay');
  const tower={type:'tower',id:'t1',quaySnap:'m1',x:58.25,y:156,size:1.5};State.structures.push(tower);
  ctx.footprintPoints=s=>{const h=(s.size||1)/2;return[{x:s.x-h,y:s.y-h},{x:s.x+h,y:s.y-h},{x:s.x+h,y:s.y+h},{x:s.x-h,y:s.y+h}]};
  assert.equal(Q.wallGroundZ(tower),Q.TOP,'a quay tower stands at the quay top');
  assert.equal(Q.wallGroundZ({type:'wall',aSnap:'t1',bSnap:'quay:m1'}),Q.TOP,'a wall from a quay tower to the quay stays on it');
  assert.ok(Q.wallRoute({x:0,y:0},{x:3,y:1},'t1','quay:m1',{max:8}),'and follows the quay face straight');
  const meshes=Q.meshes(mole);
  assert.ok(meshes[0].col.length>Q.meshes({...mole,id:'m1-alone'})[0].col.length,'the quay builds a plinth under its tower');
  State.structures.pop();
}
// Quays joined to quays: the end of one (carry it on) or a face (a T), without colliding.
{
  const end=Q.snapQuay({x:60.3,y:164.4});
  assert.ok(end&&end.quayId==='m1'&&end.end==='b'&&end.point.y===164,'a new quay snaps to another quay end');
  const tee=Q.snapQuay({x:61.4,y:156});
  assert.ok(tee&&tee.quayId==='m1'&&Math.abs(tee.point.x-61)<1e-9&&tee.point.y===156,'or to a point on its face');
  assert.equal(Q.snapQuay({x:70,y:156}),null,'no magnet away from quays');
  const spur={id:'m2',...Q.make({x:61,y:156},{x:66,y:156}),aSnap:'m1'};
  assert.ok(Q.joined(spur,mole)&&!Q.joined(spur,{...mole,id:'other'}),'joined quays are exempt from colliding');
  // End to end at a right angle: both quays are carried on by half the width, closing the
  // outer corner; the outer walls of the corner meet at its point.
  const elbow={id:'m3',...Q.make({x:60,y:164},{x:66,y:164}),aSnap:'m1'};
  State.structures.push(elbow);
  const ys=Q.footprint(mole).map(p=>p.y),xs=Q.footprint(elbow).map(p=>p.x);
  assert.ok(Math.abs(Math.max(...ys)-165)<1e-9,'the mole runs on to the far side of the corner');
  assert.ok(Math.abs(Math.min(...xs)-59)<1e-9,'and the elbow starts at its far side: the corner is closed');
  const faceJoin={id:'m4',...Q.make({x:61,y:156},{x:66,y:156}),aSnap:'m1'};
  assert.ok(Math.abs(Math.min(...Q.footprint(faceJoin).map(p=>p.x))-61)<1e-9,'a T off a face is not carried on');
  const wa=Q.snapWallAnchor({x:58.75,y:165.6},.5),wb=Q.snapWallAnchor({x:58.4,y:165.25},.5);
  assert.ok(wa&&Math.abs(wa.point.x-58.75)<1e-9&&Math.abs(wa.point.y-165.5)<1e-9,'the outer wall of the mole runs on to the elbow wall outer face');
  assert.ok(wb&&Math.abs(wb.point.x-58.5)<1e-9&&Math.abs(wb.point.y-165.25)<1e-9,'and the elbow wall to the mole wall outer face: the corner is solid');
  // Rule: walls against a quay show their exterior to the water, whichever way they were drawn.
  for(const [a,b,label] of [[wa.point,{x:58.75,y:160}],[{x:58.75,y:160},wa.point]].map((p,i)=>[...p,i?'drawn towards the sea':'drawn towards the shore'])){
    const w={type:'wall',a,b,aSnap:'quay:m1',bSnap:'quay:m1',flip:false};
    assert.ok(Q.faceWallOut(w),'a quay wall gets its side set ('+label+')');
    const dx=w.b.x-w.a.x,dy=w.b.y-w.a.y,side=w.flip?-1:1,nx=-dy*side;
    assert.ok(nx<0,'its exterior faces away from the mole, to the water ('+label+')');
  }
  const corner={type:'wall',a:{x:60,y:165.25},b:{x:64,y:165.25},aSnap:'quay:m1',bSnap:'quay:m3'};
  Q.faceWallOut(corner);
  assert.ok((corner.flip?-1:1)*(corner.b.x-corner.a.x)>0,'a wall turning the corner faces out too');
  assert.ok(Q.isQuayWall(corner)&&!Q.isQuayWall({type:'wall',a:{x:0,y:0},b:{x:1,y:0}}),'quay walls refuse the manual flip');
  State.structures.pop();
  // Out of the whitezone: a quay must start inside it or from a quay, then may run on.
  const outward={id:'m5',...Q.make({x:120,y:149},{x:120,y:160})};
  assert.ok(Q.validate(outward).ok,'a quay from the whitezone out over the water is fine');
  assert.equal(Q.validate({...outward,...Q.make({x:120,y:152},{x:120,y:160})}).ok,false,'one starting outside it is not');
  assert.ok(Q.validate({...Q.make({x:60,y:164},{x:60,y:170}),id:'m6',aSnap:'m1'}).ok,'unless it starts from another quay');
}
// Harbour dressing on the quay: the construction kit's crane and hoists, scatter goods.
vm.runInContext(read('src/assets/construction-models.js'),ctx);
const dressed=Q.meshes({...mole,id:'m1-dressed'});
assert.equal(dressed.length,2,'the quay carries a dressing mesh');
const quayTop=Q.TOP,dz=[];for(let i=2;i<dressed[1].pos.length;i+=3)dz.push(dressed[1].pos[i]);
assert.ok(Math.min(...dz)>=quayTop-.05&&Math.max(...dz)>quayTop+1,'crane, hoists and goods stand on the coping, the crane rises above it');
console.log('PASS quay: shore or water, whitezone, sea face, piers branch off it, moles take piers on both sides, 4U from the shore, 5U apart');

// Test fleet: ships moor at the free berths of a pier with their sails furled, one each side,
// alongside the deck; with no berth left they ride at anchor off the coast, sails set.
for(const f of ['heraldry-shapes.js','assets/ship-models.js','settlement-ships.js','settlement-ship-crew.js','settlement-fleet.js'])vm.runInContext(read('src/'+f),ctx);
const F=window.ConquerFleet,M2=window.ConquerShipModels;
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
// Quay berths: after the piers, ships lie along a quay face, never within 4U of a pier, and a
// slot whose hull would touch another quay, pier or ship is skipped.
State.structures.length=0;
const harbourMole={id:'hm',...Q.make({x:150,y:151},{x:150,y:171})};State.structures.push(harbourMole);
const alongside=F.spawn({key:'cargo',allegiance:'merchant'});
assert.ok(alongside.berth?.quayId==='hm','with no pier, a ship moors along the quay');
assert.ok(Math.abs(Math.abs(alongside.pose.heading)-Math.PI/2)<1e-9,'lying along it');
assert.ok(Math.abs(Math.abs(alongside.pose.x-150)-(1+M2.ships.cargo.B/2+.12))<1e-9,'alongside its face');
F.clear();
State.structures.push({id:'hp',type:'pier',reach:4,x:149,y:156.5,angle:Math.PI,onQuay:'hm'});
assert.ok(Q.berths(harbourMole).every(b=>Math.hypot(b.edge.x-149,b.edge.y-156.5)>=4),'no quay slot within 4U of the pier');
F.clear();State.structures.length=0;
console.log('PASS fleet: moored at berths with sails furled, anchored off the coast, orders, clear');
