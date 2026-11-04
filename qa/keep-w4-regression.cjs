'use strict';
// W4 keep (Mastio 3U): tier 4 only on a square stone tower, several rooms per floor laid out by
// floor plan, rooms that keep their floor when a plan changes, partition walls with a doorway
// on every stretch between two junctions.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const src=f=>fs.readFileSync(path.join(__dirname,'..','src',f),'utf8');
const fnSrc=(text,name)=>{const m=text.match(new RegExp('function '+name+'\\([^)]*\\)\\{[\\s\\S]*?\\n\\}'));assert.ok(m,name+' found');return m[0]};
const lineFn=(text,name)=>{const m=text.match(new RegExp('^function '+name+'\\(.*$','m'));assert.ok(m,name+' found');return m[0]};

const core=src('settlement-core.js'),place=src('settlement-castle-placement.js'),castle=src('settlement-castle.js');
const State={structures:[]};
const ctx=vm.createContext({State,Math,Number,Object,Array,Set,clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),
  isOrientedTower:()=>false,isWoodTower:s=>s.material==='wood',structureLevel:s=>s.level||1});
const block=(text,from,to)=>text.slice(text.indexOf(from),text.indexOf(to));
vm.runInContext([
  block(core,'const SQUARE_TOWER_TIERS','const COSTS='),
  lineFn(core,'towerTier'),lineFn(core,'isKeepW4'),lineFn(core,'keepW4Available'),fnSrc(core,'keepFloorPlan'),lineFn(core,'keepFloorRooms'),
  fnSrc(place,'functionSlotLayout'),fnSrc(place,'functionsByFloor'),fnSrc(place,'restoreFunctionsByFloor'),lineFn(place,'functionSlotFloor'),
  fnSrc(place,'functionSlotSize'),lineFn(place,'functionFloorOffset'),fnSrc(place,'functionCapacity'),fnSrc(place,'normalizeFunctions'),
  'function isWideBuilt(){return false}function builtInteriorFloors(){return 1}',
  'const KEEP_PARTITION=.10;',fnSrc(castle,'keepPartitionSegments'),
  'this.api={towerTier,isKeepW4,keepW4Available,functionSlotLayout,functionCapacity,functionSlotSize,functionsByFloor,restoreFunctionsByFloor,normalizeFunctions,keepPartitionSegments};'
].join('\n'),ctx);
const A=ctx.api;
// Arrays from the vm context have their own prototype: compare by value.
const eq=(a,b,m)=>assert.equal(JSON.stringify(a),JSON.stringify(b),m);

const keep={id:'k',type:'tower',shape:'square',material:'stone',size:3,level:3,functions:[]};
assert.equal(A.towerTier(keep),4,'3U square: W4');
assert.equal(A.towerTier({type:'tower',shape:'round',r:1.5}),3,'round towers stop at T3');
assert.ok(!A.isKeepW4({...keep,material:'wood'}),'no timber W4');
A.normalizeFunctions(keep);
eq(keep.keepPlans,['three','quad','hall'],'default floors: 1+2, four quarters, hall');
assert.equal(A.functionCapacity(keep),8);
eq(A.functionSlotLayout(keep).map(x=>x.floor+':'+x.room),['0:0','0:1','0:2','1:0','1:1','1:2','1:3','2:0']);
eq([0,1,3,7].map(i=>A.functionSlotSize(keep,i)),['large','normal','normal','large'],'halves and halls are LARGE, quarters NORMAL');
console.log('PASS W4 tier, floor plans and room slots');

keep.functions=['commonHall','kitchen','storage','barracks','armory','nobleRoom','chapel','throneHall'];
const byFloor=A.functionsByFloor(keep);keep.keepPlans[1]='halves';
byFloor[1]=byFloor[1].slice(0,2);A.restoreFunctionsByFloor(keep,byFloor);
eq(keep.functions,['commonHall','kitchen','storage','barracks','armory','throneHall'],'the other floors keep their rooms');
const before=A.functionsByFloor(keep);keep.keepPlans[0]='quad';A.restoreFunctionsByFloor(keep,before);
eq(keep.functions.slice(0,4),['commonHall','kitchen','storage',null],'a floor that grows gets empty rooms');
State.structures=[keep];
assert.ok(!A.keepW4Available(),'one W4 per settlement');assert.ok(A.keepW4Available(keep),'the keep itself may stay W4');
console.log('PASS rooms keep their floor across plan changes; one W4 per settlement');

const basis={w:2.6,h:2.6};
const segs=plan=>{keep.keepPlans[0]=plan;return A.keepPartitionSegments(keep,0,basis)};
assert.equal(segs('hall').length,0,'a hall has no partitions');
eq(segs('halves').map(s=>s.doors),[[.5]]);
const three=segs('three');
assert.equal(three.length,2);
eq(three.find(s=>s.a[0]===s.b[0]).doors,[.25,.75],'the long wall of 1+2 opens on both small rooms, not at the junction');
eq(segs('quad').map(s=>s.doors.length),[1,1,1,1],'four quarters: four walls, one doorway each');
console.log('PASS partition walls and doorways');
