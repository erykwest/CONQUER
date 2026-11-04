'use strict';
// W1 portico: the ground floor under the arches takes only stables, armourers' workshop, stores and
// a guard post; the arches stop below the raised upper floor and every renderer shares one layout.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const src=name=>fs.readFileSync(__dirname+'/../src/'+name,'utf8');
const siege=src('settlement-siege.js'),castle=src('settlement-castle-placement.js'),core=src('settlement-core.js'),arch=src('settlement-architecture.js');

// The genuine source of one function: from its header to the next function at the same indent.
const pick=(text,name)=>{
  const at=text.search(new RegExp('\\n[ ]*function '+name+'\\('));assert.ok(at>=0,name);
  const indent=text.slice(at+1).match(/^[ ]*/)[0],end=text.indexOf('\n'+indent+'function ',at+1);
  return text.slice(at+1,end<0?undefined:end);
};
const ctx=vm.createContext({
  underConstruction:s=>!!s.building,
  structureLevel:s=>s.level||1,
  structureHeight:s=>s.span==='wide'?2.8:(s.level||1)>=2?2.8:1.75,
  towerTier:()=>1,
  builtSkin:s=>s.type==='built'?(s.skin||'standard'):undefined,
  cutawayFloorLevels:s=>(s.level||1)>=2&&s.span!=='wide'?[{z:.055},{z:1.4}]:[{z:.055}],
  wallExteriorSide:()=>1,
  // A section along +x from a to b, 1U wide; the interior (portico) side is -y.
  linearFacadeEdge:(s,side)=>({a:{x:s.a.x+.04,y:.504*side},b:{x:s.b.x-.04,y:.504*side},length:s.length-.08}),
  unionFootprintPoints:s=>[{x:s.a.x,y:.5},{x:s.b.x,y:.5},{x:s.b.x,y:-.5},{x:s.a.x,y:-.5}],
  clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),WeakMap,
});
vm.runInContext([core.match(/const PORTICO_FUNCTIONS=[^\n]+/)[0],pick(core,'isWideBuilt'),pick(core,'builtInteriorFloors'),pick(core,'isBuiltPortico'),
  pick(castle,'functionCapacity'),pick(siege,'eligibleRoom'),pick(siege,'floor'),pick(siege,'allowed'),pick(arch,'builtArcadeLayout'),pick(arch,'builtLoggia'),
  pick(arch,'builtLoggiaCached'),pick(arch,'builtLoggiaWalkable'),pick(arch,'builtLoggiaStandPoint'),
  'this.out={allowed,builtArcadeLayout,builtLoggia,builtLoggiaWalkable,builtLoggiaStandPoint,PORTICO_FUNCTIONS};'].join('\n'),ctx);
const {allowed,builtArcadeLayout,builtLoggia,builtLoggiaWalkable,builtLoggiaStandPoint,PORTICO_FUNCTIONS}=ctx.out;
const section=(extra)=>({type:'built',a:{x:0,y:0},b:{x:7.5,y:0},length:7.5,level:2,skin:'arcade',...extra});

const portico={type:'built',length:3,level:2,skin:'arcade'},porticoL1={...portico,level:1},plain={type:'built',length:3,level:2};
assert.deepEqual([...PORTICO_FUNCTIONS],['stables','workshop','storage','guard']);
for(const fn of PORTICO_FUNCTIONS)assert.ok(allowed(portico,0,fn),fn+' under the portico');
for(const fn of ['kitchen','granary','barracks','nobleRoom','chapel','commonHall','throneHall','treasury','prison','armory'])
  assert.ok(!allowed(portico,0,fn),'no '+fn+' under the portico');
assert.ok(allowed(porticoL1,0,'stables')&&!allowed(porticoL1,0,'kitchen'),'L1 portico: the only room is the portico');
console.log('PASS only stables, armourers, stores and guard under a W1 portico');

assert.ok(allowed(portico,1,'nobleRoom')&&allowed(portico,1,'barracks'),'the raised floor keeps its rooms');
assert.ok(!allowed(portico,1,'stables'),'stables stay on the ground floor');
assert.ok(allowed(plain,0,'kitchen'),'standard W1 ground floor unchanged');
assert.ok(allowed({type:'built',span:'wide',length:3,level:2,skin:'arcade'},0,'throneHall'),'W2 hall with portico keeps its hall');
console.log('PASS raised floor, standard sections and W2 halls unchanged');

const L2=builtArcadeLayout(section());
assert.ok(L2.centerZ+L2.h/2<1.4,'arches stop below the raised floor slab');
assert.equal(L2.count,3);assert.equal(L2.key,'arcade3');assert.equal(L2.bays.length,3);
const L1=builtArcadeLayout(section({level:1}));
assert.ok(L1.centerZ+L1.h/2<=1.75-.1,'L1 arches stay under the eaves');
assert.equal(builtArcadeLayout(section({skin:'standard'})),null,'no arcade without the skin');
assert.equal(builtArcadeLayout(section({building:true})),null,'no arcade while building');
console.log('PASS arcade layout below the raised floor');

// The loggia: a recessed ground floor, piers and arches under the raised floor, on the interior side.
for(const extra of [{},{level:1},{b:{x:2.2,y:0},length:2.2}]){
  const s=section(extra),g=builtLoggia(s),parts=new Set(g.faces.map(f=>f.part)),label=JSON.stringify(extra);
  for(const p of ['upper','ground','backwall','arcade','ceiling','paving'])assert.ok(parts.has(p),p+' '+label);
  const zs=f=>f.pts.map(q=>q.z),ys=f=>f.pts.map(q=>q.p.y);
  assert.equal(g.side,-1);assert.ok(Math.abs(g.front+.5)<1e-9&&Math.abs(g.back-.36)<1e-9,'open ground floor up to the exterior wall '+label);
  for(const f of g.faces.filter(f=>f.part==='arcade'||f.part==='backwall'))assert.ok(Math.max(...zs(f))<=g.cap+1e-9,'arcade under the raised floor '+label);
  for(const f of g.faces.filter(f=>f.part==='ground'))assert.ok(Math.max(...ys(f))<=.5+1e-9&&Math.min(...ys(f))>=g.back-1e-9,'rooms behind the loggia '+label);
  assert.ok(g.faces.filter(f=>f.part==='upper').every(f=>Math.min(...zs(f))>=g.cap-1e-9),'upper block on top of the loggia '+label);
}
const piers=builtLoggia(section()).faces.filter(f=>f.part==='arcade'&&f.pts.length===4&&f.pts.every(q=>Math.abs(q.z-1.36)<1e-9));
assert.ok(piers.length>=8,'pier tops along a 7.5U section');
assert.equal(builtLoggia(section({span:'wide'})),null,'the W2 hall keeps its decal arcade');
assert.equal(builtLoggia(section({skin:'standard'})),null,'no loggia without the skin');
console.log('PASS W1 loggia: recessed ground floor, piers and arches under the raised floor');

// Rooms: one per bay of arches, side by side between partitions, all as deep as the loggia.
{
  const g=builtLoggia(section());
  assert.equal(g.rooms.length,3);
  for(let k=1;k<3;k++)assert.ok(g.rooms[k].center.x-g.rooms[k].w/2>g.rooms[k-1].center.x+g.rooms[k-1].w/2,'partition between rooms '+k);
  assert.ok(g.rooms.every(r=>Math.abs(r.h-g.room.h)<1e-9&&r.w>2),'bay rooms');
  assert.equal(builtLoggia(section({b:{x:2.2,y:0},length:2.2})).rooms.length,1,'a short section is one room');
  assert.ok(Math.abs(g.walk.width-.18)<1e-9&&g.walk.v0<g.walk.v1);
}
console.log('PASS portico rooms: one per bay, partitions, walkway along the piers');

// Walkway: open to walkers from the arches to its inner edge; piers, furniture zone and walls stay solid.
{
  const s=section({id:'w'}),g=builtLoggia(s),gap=(g.piers[3]+g.piers[4])/2;
  assert.ok(builtLoggiaWalkable(s,{x:gap,y:-.28}),'walkway');
  assert.ok(builtLoggiaWalkable(s,{x:gap,y:-.47}),'arch opening');
  assert.ok(!builtLoggiaWalkable(s,{x:g.piers[3],y:-.47}),'pier');
  assert.ok(!builtLoggiaWalkable(s,{x:gap,y:.05}),'furniture zone');
  assert.ok(!builtLoggiaWalkable(s,{x:.02,y:-.28}),'end wall');
  assert.ok(!builtLoggiaWalkable(section({skin:'standard'}),{x:gap,y:-.28}),'no walkway without the portico');
  const p=builtLoggiaStandPoint(s,.5);assert.ok(builtLoggiaWalkable(s,p),'visitors stand on the walkway');
}
assert.match(src('settlement-population-navigation.js'),/if\(s\.type==='built'&&builtLoggiaWalkable\(s,p,\.04\)\)continue;/);
assert.match(src('settlement-population-routines.js'),/builtLoggiaStandPoint\(target,/);
console.log('PASS walkway under the arches for walkers and visitors');

// Furniture: one furnished room per bay, outside the cutaway too in World 3D.
const fu=src('settlement-cutaway-furniture.js');
assert.match(fu,/L\.rooms\.map\(\(room,k\)=>/);assert.match(fu,/function loggiaFaces\(s\)/);
assert.match(w3d0(),/FU\?\.loggiaFaces\?\.\(s\)/);
console.log('PASS loggia furniture per room, visible through the arches');
function w3d0(){return src('settlement-world3d.js')}

// World 3D carves it (like the gate passage); 2.5D keeps the arches cut into the facade.
const c3d=src('settlement-castle3d.js'),w3d=src('settlement-world3d.js');
assert.match(c3d,/&&!\(worldOut&&addBuiltLoggia\(m,s\)\)\)/);
assert.match(w3d,/const arcade=!isBuiltPortico\(s\)&&builtArcadeLayout\(s\)/);
assert.match(w3d,/loggiaEdge\(o0,o1\)/);
console.log('PASS World 3D body and cutaway use the loggia');

// Every renderer (2.5D, facade polish, World 3D, 3D cutaway) reads the shared layout.
assert.match(arch,/function drawBuiltArcade\(s\)\{\n  const a=builtArcadeLayout\(s\)/);
assert.match(src('settlement-facade-polish.js'),/drawBuiltArcade=function\(s\)\{\n  const a=builtArcadeLayout\(s\)/);
assert.equal((src('settlement-world3d.js').match(/builtArcadeLayout\(s\)/g)||[]).length,2,'World 3D facade and cutaway');
assert.doesNotMatch(src('settlement-world3d.js'),/Math\.min\(1\.46,structureHeight/);
console.log('PASS one arcade layout for every renderer');
