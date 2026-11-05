'use strict';
// Room exterior elements (D-ROOM-EXT-01) and the latrine: the garderobe is placed on a free outer face
// of a small (W1) stone tower at its first upper floor, the face looking away from the castle first,
// never on a face a wall runs into; it takes the arrow slits of its face, stretches its chute to the
// ground and falls as its own collapse part. Built sections never take a latrine (user, 04/11/2026).
// The garrison hygiene it serves is a secondary need: a small garrison never falls sick.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const src=name=>fs.readFileSync(__dirname+'/../src/'+name,'utf8');
const pick=(text,name)=>{
  const at=text.search(new RegExp('\\n[ ]*function '+name+'\\('));assert.ok(at>=0,name);
  const indent=text.slice(at+1).match(/^[ ]*/)[0],end=text.indexOf('\n'+indent+'function ',at+1);
  return text.slice(at+1,end<0?undefined:end);
};
const arch=src('settlement-architecture.js'),siege=src('settlement-siege.js'),castle=src('settlement-castle-placement.js');

// ---- the mechanism, with the real tower geometry helpers it relies on.
// Square towers stand at angle 0 with the castle interior towards -x (face 3 is the interior face).
const ctx=vm.createContext({window:{},Math,Number,Object,Array,JSON,Infinity,
  State:{structures:[]},
  underConstruction:s=>!!s.building,
  structureLevel:s=>s.level||1,
  structureHeight:s=>s.type==='tower'?3.55:s.type==='road'?0:2,
  functionFloorOffset:s=>s.type==='gate'?1:0,
  footprintPoints:s=>s.pts||[],
  hasPointHoarding:()=>false,
  wallSkin:()=>'standard',
  structureInteriorVector:()=>({x:-1,y:0}),
  towerFacadePoints:s=>{const h=s.size/2;return[{x:s.x-h,y:s.y-h},{x:s.x+h,y:s.y-h},{x:s.x+h,y:s.y+h},{x:s.x-h,y:s.y+h}]},
  interiorFacadeEdgeIndex:()=>3,
  rectDims:s=>({w:s.size,h:s.size}),
  deeSideSlit:()=>null,
  winterSnowColor:c=>c,WINTER_SNOW_A:'#fff',WINTER_SNOW_B:'#eee',
});
vm.runInContext([pick(src('settlement-world.js'),'pointInPolygon'),'const TOWER_OPENING_EYE_Z=.44;',
  ...['towerFloorZ','towerOpeningZ','towerFaceDirections','towerFaceBlocked','towerFaceOnDivider','towerSlitFace'].map(n=>pick(arch,n))].join('\n'),ctx);
vm.runInContext(src('assets/garderobe-models.js'),ctx);
vm.runInContext(src('settlement-room-exterior.js'),ctx);
const RE=vm.runInContext('window.ConquerRoomExterior',ctx),run=code=>vm.runInContext(code,ctx);

const tower=(o={})=>({id:'t1',type:'tower',shape:'square',material:'stone',x:0,y:0,size:1,tier:1,level:2,functions:[null,'latrine'],...o});
const s=tower();ctx.State.structures=[s];
const e=RE.placement(s,1,'latrine');
assert.ok(e,'fits on a free W1 L2 tower');
assert.deepEqual([e.normal.x,e.normal.y].map(v=>+v.toFixed(6)),[1,0],'the face looking away from the castle (+x here)');
assert.ok(Math.abs(e.anchor.x-.504)<1e-9&&Math.abs(e.anchor.y)<1e-9,'anchored on the middle of that face');
assert.ok(Math.abs(e.z-3.55/2)<1e-9,'at the floor of room 2');
assert.ok(e.tangent.x*e.normal.y-e.tangent.y*e.normal.x>0,'right-handed frame (no mirrored triangles)');
assert.equal(RE.placement(s,0,'latrine').z,.055,'the element follows the floor of its slot');
// A wall snapped on that face: the garderobe moves to a side face, never onto the interior one.
const wall={id:'w',type:'wall',aSnap:'t1',a:{x:.5,y:0},b:{x:4,y:0},level:2};
ctx.State.structures=[s,wall];
const side=RE.placement(s,1,'latrine');
assert.ok(side&&Math.abs(side.normal.x)<1e-9&&side.face!==3,'moved to a side face');
ctx.State.structures=[s,wall,{...wall,id:'w2',a:{x:0,y:-.5},b:{x:0,y:-4}},{...wall,id:'w3',a:{x:0,y:.5},b:{x:0,y:4}}];
assert.equal(RE.placement(s,1,'latrine'),null,'every outer face taken by a wall: refused');
ctx.State.structures=[s];
const r=tower({id:'t2',shape:'round',r:.5,size:undefined});ctx.State.structures=[r];
const er=RE.placement(r,1,'latrine');
assert.ok(er&&er.normal.x>.999&&er.anchor.x<.5&&er.anchor.x>.42,'round tower: outward, sunk by the sagitta into the curved wall');
ctx.State.structures=[s];
console.log('PASS the garderobe sits on a free outer tower face at the floor of its room');

// Something already outside the face: another building, a road (ground level) does not count.
ctx.State.structures=[s,{id:'h',type:'house',pts:[{x:.4,y:-2},{x:2,y:-2},{x:2,y:2},{x:.4,y:2}]}];
assert.equal(RE.placement(s,1,'latrine').face===1,false,'not where a building stands in front');
ctx.State.structures=[s,{id:'r',type:'road',pts:[{x:.4,y:-2},{x:2,y:-2},{x:2,y:2},{x:.4,y:2}]}];
assert.equal(RE.placement(s,1,'latrine').face,1,'a road does not block it');
ctx.State.structures=[s];
assert.equal(RE.placement(tower({size:.5}),1,'latrine'),null,'too narrow a face: refused');
console.log('PASS refused where the face is taken or too narrow');

// Triangles: the Blender model, outside the wall, the chute down to the ground; slits give way.
const tris=RE.triangles(s),parts=ctx.window.ConquerGarderobeModels.models.garderobe.parts;
assert.equal(tris.length,Object.values(parts).reduce((t,p)=>t+p.c.length,0));
assert.ok(tris.every(t=>t.pts.every(q=>q.p.x>=.5-.05)),'all outside the masonry face');
const chuteZ=tris.filter(t=>t.part==='chute').flatMap(t=>t.pts.map(q=>q.z));
assert.ok(Math.abs(Math.min(...chuteZ))<1e-9,'the stain reaches the ground');
assert.ok(RE.takesTowerFace(s,1,2)&&!RE.takesTowerFace(s,0,2)&&!RE.takesTowerFace(s,1,3),'its face, its floor and below');
assert.ok(!run('towerSlitFace')(s,1,2)&&run('towerSlitFace')(s,0,2),'the slit of its face gives way, the others stay');
console.log('PASS triangles, chute and the slit it replaces');

// Breakable: an impact near the box finds it; broken it is no longer drawn; restored it is.
assert.equal(RE.at(s,{x:e.anchor.x+.2,y:0}).index,1);
assert.equal(RE.at(s,{x:-2,y:0}),null);
const c=RE.collapseParts(e);
assert.ok(c.parts[0].length===4&&c.z0<e.z&&c.z1>e.z&&c.material==='stone');
s.roomExteriorHp={1:0};
assert.equal(RE.elements(s).length,0);assert.equal(RE.elements(s,{broken:true})[0].broken,true);
assert.equal(RE.triangles(s).length,0);
RE.repair(s,1);assert.equal(s.roomExteriorHp,undefined);assert.equal(RE.elements(s).length,1);
console.log('PASS the garderobe breaks, falls and is rebuilt');

// ---- room rule: first upper floor of a W1 stone tower only, and only where the element fits.
const rc=vm.createContext({window:{ConquerRoomExterior:RE},underConstruction:s=>!!s.building,structureLevel:s=>s.level||1,
  towerTier:s=>s.tier||1,isWoodTower:s=>s.material==='wood',isWideBuilt:s=>s.span==='wide',builtInteriorFloors:s=>s.span==='wide'?1:(s.level||1)});
vm.runInContext([pick(castle,'functionCapacity'),pick(siege,'eligibleRoom'),pick(siege,'floor'),pick(siege,'allowed')].join('\n'),rc);
const allowed=vm.runInContext('allowed',rc);
assert.ok(allowed(s,1,'latrine'),'W1 stone tower, first upper floor');
assert.ok(!allowed(s,0,'latrine'),'not on the ground floor');
assert.ok(!allowed(tower({level:3}),2,'latrine'),'not on the floors above the first');
assert.ok(!allowed(tower({tier:2,size:1.5}),1,'latrine'),'not in W2 towers');
assert.ok(!allowed(tower({material:'wood'}),1,'latrine'),'not in timber towers');
assert.ok(!allowed({type:'built',a:{x:0,y:0},b:{x:3,y:0},length:3,width:1,level:2,functions:[null,'latrine']},1,'latrine'),'never in built sections');
ctx.State.structures=[s,wall,{...wall,id:'w2',a:{x:0,y:-.5},b:{x:0,y:-4}},{...wall,id:'w3',a:{x:0,y:.5},b:{x:0,y:4}}];
assert.ok(!allowed(s,1,'latrine'),'not where the garderobe cannot fit');
ctx.State.structures=[s];
assert.ok(JSON.parse(src('settlement-core.js').match(/const FUNCTION_CATALOG=(\[[^\n]+\]);/)[1].replace(/'/g,'"')).includes('latrine'));
console.log('PASS latrine rooms only on the first upper floor of W1 stone towers, where the element fits');

// ---- W1 towers: the spiral stair only while no room is assigned; the latrine furnishes the whole room
const sc=vm.createContext({isWoodTower:s=>s.material==='wood',towerTier:s=>s.tier||1});
vm.runInContext(pick(src('settlement-castle.js'),'cutawaySpiralStair'),sc);
const spiral=vm.runInContext('cutawaySpiralStair',sc);
assert.ok(spiral(tower({functions:[null,null]})),'W1 tower without rooms: spiral stair');
assert.ok(!spiral(tower()),'a room assigned: the stair goes');
assert.ok(!spiral(tower({tier:2,functions:[]})),'never in W2 towers');
assert.ok(RE.ROOM_EXTERIOR.latrine&&ctx.window.ConquerGarderobeModels.models.garderobe.projection<=.22,'a shallow garderobe');
const furn=src('settlement-cutaway-furniture.js');
assert.match(furn,/latrine\(r\)\{const S=r\.exteriorSide\|\|r\.A/,'the seat goes against the wall of the garderobe');
assert.match(furn,/r\.exteriorSide=Math\.abs\(u\)>=Math\.abs\(v\)/);
console.log('PASS W1 stair only in empty towers; shallow garderobe; latrine furnishes its room');

// ---- hygiene: secondary, floored, scaled on the garrison
const consts=siege.match(/const SANITATION_FREE=[^\n]+/)[0]+'\n'+siege.match(/const within=[^\n]+/)[0];
const hc=vm.createContext({clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),Math,g:0,lat:0,h:100});
vm.runInContext(consts+'\nfunction garrison(){return g}\nfunction latrineCapacity(){return lat}\nfunction state(){return{hygiene:h}}\n'+pick(siege,'hygieneTarget')+'\n'+pick(siege,'sickShare'),hc);
const target=(g,lat)=>{hc.g=g;hc.lat=lat;return vm.runInContext('hygieneTarget()',hc)},sick=h=>{hc.h=h;return vm.runInContext('sickShare()',hc)};
assert.equal(target(0,0),100,'no garrison');
assert.equal(target(24,0),100,'a small garrison is served without latrines');
assert.equal(target(200,0),40,'never below the floor');
assert.equal(target(48,16),Math.min(100,100*(24+16)/48));
assert.equal(target(40,16),100,'one latrine covers 16 more');
assert.equal(sick(100),0);assert.equal(sick(50),0);assert.ok(Math.abs(sick(40)-.1)<1e-9,'at most a tenth');
assert.equal(sick(0),.1);
assert.match(pick(siege,'occupiedArcherSlots'),/slice\(0,n-Math\.round\(n\*sickShare\(\)\)\)/,'sick archers leave their posts');
assert.match(pick(siege,'tick'),/x\.hygiene=within\(x\.hygiene\+within\(target-x\.hygiene,-2\*elapsed,5\*elapsed\)/);
console.log('PASS hygiene: free for a small garrison, floored at 40, at most 10% archers sick');

// ---- renderers and collapse all read the same triangles
assert.match(src('settlement-castle3d.js'),/for\(const t of window\.ConquerRoomExterior\?\.triangles\(s\)\|\|\[\]\)m\.face/);
assert.match(src('settlement-world3d.js'),/for\(const t of window\.ConquerRoomExterior\?\.triangles\(s\)\|\|\[\]\)sh\.face/);
assert.match(src('settlement-render.js'),/drawGateRoofs\(\);\n  window\.ConquerRoomExterior\?\.drawAll\(\);/);
assert.match(pick(siege,'destroyStructure'),/ConquerRoomExterior\?\.elements\(s\)/);
for(const page of ['index.html','camp/index.html'])
  assert.match(fs.readFileSync(__dirname+'/../'+page,'utf8'),/garderobe-models\.js[^\n]*\n<script src="\.\/src\/settlement-room-exterior\.js/);
console.log('PASS 2.5D, castle 3D, World 3D and collapse share the element');
