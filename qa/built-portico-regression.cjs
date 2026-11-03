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
  linearFacadeEdge:(s,side)=>({a:{x:0,y:side},b:{x:s.length,y:side},length:s.length}),
});
vm.runInContext([core.match(/const PORTICO_FUNCTIONS=[^\n]+/)[0],pick(core,'isWideBuilt'),pick(core,'builtInteriorFloors'),pick(core,'isBuiltPortico'),
  pick(castle,'functionCapacity'),pick(siege,'eligibleRoom'),pick(siege,'floor'),pick(siege,'allowed'),pick(arch,'builtArcadeLayout'),
  'this.out={allowed,builtArcadeLayout,PORTICO_FUNCTIONS};'].join('\n'),ctx);
const {allowed,builtArcadeLayout,PORTICO_FUNCTIONS}=ctx.out;

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

const L2=builtArcadeLayout({...portico,length:7.5});
assert.ok(L2.centerZ+L2.h/2<1.4,'arches stop below the raised floor slab');
assert.equal(L2.count,3);assert.equal(L2.key,'arcade3');assert.equal(L2.bays.length,3);
const L1=builtArcadeLayout({...porticoL1,length:7.5});
assert.ok(L1.centerZ+L1.h/2<=1.75-.1,'L1 arches stay under the eaves');
assert.equal(builtArcadeLayout({...plain,length:7.5}),null,'no arcade without the skin');
assert.equal(builtArcadeLayout({...portico,length:7.5,building:true}),null,'no arcade while building');
console.log('PASS arcade layout below the raised floor');

// Every renderer (2.5D, facade polish, World 3D, 3D cutaway) reads the shared layout.
assert.match(arch,/function drawBuiltArcade\(s\)\{\n  const a=builtArcadeLayout\(s\)/);
assert.match(src('settlement-facade-polish.js'),/drawBuiltArcade=function\(s\)\{\n  const a=builtArcadeLayout\(s\)/);
assert.equal((src('settlement-world3d.js').match(/builtArcadeLayout\(s\)/g)||[]).length,2,'World 3D facade and cutaway');
assert.doesNotMatch(src('settlement-world3d.js'),/Math\.min\(1\.46,structureHeight/);
console.log('PASS one arcade layout for every renderer');
