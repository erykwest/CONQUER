'use strict';
// Room exterior elements (D-ROOM-EXT-01) and the latrine: the garderobe is placed on the exterior
// face of a W1 built section at its upper floor, refuses a face already taken outside, takes the
// arrow slit it is centred on, stretches its chute to the ground and falls as its own collapse part.
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

// ---- the mechanism, with the real geometry helpers it relies on
const ctx=vm.createContext({window:{},Math,Number,Object,Array,JSON,Infinity,
  State:{structures:[]},
  underConstruction:s=>!!s.building,
  structureLevel:s=>s.level||1,
  structureHeight:s=>s.type==='built'?[1.75,2.80][(s.level||1)-1]:s.type==='tower'?3.55:s.type==='road'?0:2,
  cutawayFloorLevels:s=>{const l=s.span==='wide'?1:(s.level||1),h=s.type==='built'?[1.75,2.80][l-1]:3,f=[{z:.055}];for(let i=1;i<l;i++)f.push({z:h*i/l});return f},
  functionFloorOffset:s=>s.type==='gate'?1:0,
  wallExteriorSide:s=>s?.flip?-1:1,
  footprintPoints:s=>s.pts||[],
  hasPointHoarding:()=>false,
  winterSnowColor:c=>c,WINTER_SNOW_A:'#fff',WINTER_SNOW_B:'#eee',
});
vm.runInContext([pick(src('settlement-world.js'),'pointInPolygon'),pick(arch,'builtWindowSegment'),pick(arch,'linearFacadeEdge'),pick(arch,'builtWindowCount')].join('\n'),ctx);
vm.runInContext(src('assets/garderobe-models.js'),ctx);
vm.runInContext(src('settlement-room-exterior.js'),ctx);
const RE=vm.runInContext('window.ConquerRoomExterior',ctx),run=code=>vm.runInContext(code,ctx);

const built=(o={})=>({id:'b1',type:'built',a:{x:0,y:0},b:{x:3,y:0},length:3,width:1,level:2,functions:[null,'latrine'],...o});
const s=built();ctx.State.structures=[s];
const e=RE.placement(s,1,'latrine');
assert.ok(e,'fits on a free W1 L2 section');
assert.deepEqual([e.normal.x,+e.normal.y.toFixed(6)],[-0,1].map(Number),'outward = wallExteriorSide (+1 -> +y here)');
assert.ok(Math.abs(e.anchor.y-(.5+.004))<1e-9&&Math.abs(e.anchor.x-1.5)<.8,'anchored on the exterior face, near the middle');
assert.ok(Math.abs(e.z-1.4)<1e-9,'at the floor of room 2');
assert.ok(e.tangent.x*e.normal.y-e.tangent.y*e.normal.x>0,'right-handed frame (no mirrored triangles)');
const f=RE.placement(built({flip:true}),1,'latrine');
assert.ok(f.normal.y<0&&f.anchor.y<0,'the flip moves it to the other face');
console.log('PASS the garderobe sits on the exterior face at the floor of its room');

// Something already outside the face: another building, a tower in front of it.
ctx.State.structures=[s,{id:'t',type:'tower',pts:[{x:-1,y:.4},{x:4,y:.4},{x:4,y:1.6},{x:-1,y:1.6}]}];
assert.equal(RE.placement(s,1,'latrine'),null,'refused where a tower stands in front');
ctx.State.structures=[s,{id:'r',type:'road',pts:[{x:-1,y:.4},{x:4,y:.4},{x:4,y:1.6},{x:-1,y:1.6}]}];
assert.ok(RE.placement(s,1,'latrine'),'a road (ground level) does not block it');
ctx.State.structures=[s];
assert.equal(RE.placement(built({a:{x:0,y:0},b:{x:.9,y:0},length:.9}),1,'latrine'),null,'too short a face: refused');
console.log('PASS refused where the face is taken or too short');

// Triangles: the Blender model, outside the wall, the chute down to the ground.
const tris=RE.triangles(s);
assert.equal(tris.length,ctx.window.ConquerGarderobeModels.models.garderobe.parts.box.c.length
  +['corbels','roof','chute'].reduce((t,k)=>t+ctx.window.ConquerGarderobeModels.models.garderobe.parts[k].c.length,0));
assert.ok(tris.every(t=>t.pts.every(q=>q.p.y>=.5-.05)),'all outside the masonry face');
const chuteZ=tris.filter(t=>t.part==='chute').flatMap(t=>t.pts.map(q=>q.z));
assert.ok(Math.abs(Math.min(...chuteZ))<1e-9,'the stain reaches the ground');
assert.ok(Math.max(...tris.map(t=>Math.max(...t.pts.map(q=>q.z))))<2.8,'under the eaves');
assert.ok(RE.takesWindow(s,1,2.22,e.off)&&!RE.takesWindow(s,1,.86,e.off)&&!RE.takesWindow(s,-1,2.22,e.off),'only the upper exterior slit it covers gives way');
console.log('PASS triangles, chute and the slit it replaces');

// Breakable: an impact near the box finds it; broken it is no longer drawn; restored it is.
assert.equal(RE.at(s,{x:e.anchor.x,y:e.anchor.y+.2}).index,1);
assert.equal(RE.at(s,{x:e.anchor.x,y:-2}),null);
const c=RE.collapseParts(e);
assert.ok(c.parts[0].length===4&&c.z0<e.z&&c.z1>e.z&&c.material==='stone');
s.roomExteriorHp={1:0};
assert.equal(RE.elements(s).length,0);assert.equal(RE.elements(s,{broken:true})[0].broken,true);
assert.equal(RE.triangles(s).length,0);
RE.repair(s,1);assert.equal(s.roomExteriorHp,undefined);assert.equal(RE.elements(s).length,1);
console.log('PASS the garderobe breaks, falls and is rebuilt');

// ---- room rule: upper floor of a W1 built section only, and only where the element fits.
const rc=vm.createContext({window:{ConquerRoomExterior:RE},underConstruction:s=>!!s.building,structureLevel:s=>s.level||1,
  towerTier:()=>2,isWideBuilt:s=>s.span==='wide',builtInteriorFloors:s=>s.span==='wide'?1:(s.level||1)});
vm.runInContext([pick(castle,'functionCapacity'),pick(siege,'eligibleRoom'),pick(siege,'floor'),pick(siege,'allowed')].join('\n'),rc);
const allowed=vm.runInContext('allowed',rc);
assert.ok(allowed(s,1,'latrine'),'W1 L2 upper floor');
assert.ok(!allowed(s,0,'latrine'),'not on the ground floor');
assert.ok(!allowed(built({span:'wide'}),0,'latrine'),'not in a W2 hall');
assert.ok(!allowed({type:'tower',size:1.5,level:3},1,'latrine'),'not in towers');
ctx.State.structures=[s,{id:'t',type:'tower',pts:[{x:-1,y:.4},{x:4,y:.4},{x:4,y:1.6},{x:-1,y:1.6}]}];
assert.ok(!allowed(s,1,'latrine'),'not where the garderobe cannot fit');
ctx.State.structures=[s];
assert.ok(JSON.parse(src('settlement-core.js').match(/const FUNCTION_CATALOG=(\[[^\n]+\]);/)[1].replace(/'/g,'"')).includes('latrine'));
console.log('PASS latrine rooms only on the upper floor of W1 sections, where the element fits');

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
assert.match(pick(src('settlement-castle.js'),'drawCutawayStructure'),/ConquerRoomExterior\?\.draw\(s\)/);
assert.match(pick(siege,'destroyStructure'),/ConquerRoomExterior\?\.elements\(s\)/);
assert.match(src('settlement-cutaway-furniture.js'),/latrine\(r\)\{r\.wall\(r\.A,0,'latrineSeat'\)/);
for(const page of ['index.html','camp/index.html'])
  assert.match(fs.readFileSync(__dirname+'/../'+page,'utf8'),/garderobe-models\.js[^\n]*\n<script src="\.\/src\/settlement-room-exterior\.js/);
console.log('PASS 2.5D, castle 3D, World 3D, cutaway and collapse share the element');
