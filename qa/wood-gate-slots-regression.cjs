'use strict';
// Wood gate room slots: the palisade gate is fixed at H1 but its fighting deck over the passage
// holds one room (stone gates: one per storey above the passage). Genuine functionCapacity,
// normalizeFunctions and allowed() of settlement-castle-placement.js / settlement-siege.js.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const src=name=>fs.readFileSync(__dirname+'/../src/'+name,'utf8').replace(/\r\n/g,'\n');
const siege=src('settlement-siege.js'),castle=src('settlement-castle-placement.js'),core=src('settlement-core.js');
const pick=(text,name)=>{
  const at=text.search(new RegExp('\\n[ ]*function '+name+'\\('));assert.ok(at>=0,name);
  const indent=text.slice(at+1).match(/^[ ]*/)[0],end=text.indexOf('\n'+indent+'function ',at+1);
  return text.slice(at+1,end<0?undefined:end);
};
const line=(text,re,name)=>{const m=text.match(re)?.[0];assert.ok(m,name);return m};
let passed=0;
function check(name,body){body();passed++;console.log('PASS '+name)}

const ctx=vm.createContext({Math,Number,Array,
  underConstruction:s=>!!s.building,isKeepW4:()=>false,isWoodTower:()=>false,
  isWoodGate:s=>!!s&&s.type==='gate'&&s.material==='wood',
  structureLevel:s=>s.type==='gate'&&s.material==='wood'?1:(s.level||1),
  towerTier:()=>1,towerDovecoteAllowed:()=>false,towerMewsAllowed:()=>false});
vm.runInContext([
  line(castle,/function functionFloorOffset\(s\)[^\n]*/,'functionFloorOffset'),
  pick(castle,'functionSlotFloor').split('\n')[0],
  pick(castle,'functionCapacity'),pick(castle,'normalizeFunctions'),
  line(core,/const W1_TOWER_FUNCTIONS=[^\n]+/,'W1_TOWER_FUNCTIONS'),
  pick(siege,'eligibleRoom'),pick(siege,'floor'),pick(siege,'allowed'),
  'this.api={functionCapacity,functionSlotFloor,normalizeFunctions,allowed};'
].join('\n'),ctx);
const {functionCapacity,functionSlotFloor,normalizeFunctions,allowed}=ctx.api;
const wood=()=>({type:'gate',material:'wood',size:1.5,level:1});
const stone=level=>({type:'gate',material:'stone',size:1.5,level});

check('the wood gate has room slots (one, on the deck over the passage)',()=>{
  const g=wood();
  assert.ok(functionCapacity(g)>0,'wood gate must have slots');
  assert.equal(functionCapacity(g),1);
  assert.equal(functionSlotFloor(g,0),1,'above the passage, like the stone gate rooms');
  assert.ok(functionCapacity(g)<functionCapacity(stone(3)),'fewer than the tall stone gatehouse');
  assert.deepEqual([1,2,3].map(l=>functionCapacity(stone(l))),[0,1,2],'stone gates unchanged');
});

check('normalizeFunctions gives the wood gate an assignable slot, saves without rooms migrate',()=>{
  const g=normalizeFunctions(wood());
  assert.deepEqual([...g.functions],[null],'one empty slot');
  const old={...wood(),functions:[]};normalizeFunctions(old);
  assert.deepEqual([...old.functions],[null],'a save from before the fix gains the slot');
});

check('garrison rooms assignable on the wood gate, passage-only rooms refused',()=>{
  const g=normalizeFunctions(wood());
  for(const fn of ['barracks','armory'])assert.ok(allowed(g,0,fn),fn+' on the wood gate');
  for(const fn of ['prison','stables','workshop','kitchen','infirmary'])assert.ok(!allowed(g,0,fn),'no '+fn+' on a gate');
  assert.ok(!allowed(g,1,'barracks'),'only one slot');
  assert.ok(!allowed({...g,building:true},0,'barracks'),'not while under construction');
});

check('the panel lists the wood gate rooms (no wood-gate exclusion around them)',()=>{
  const cmds=src('settlement-structure-commands.js'),rooms=src('settlement-app-rooms.js');
  assert.match(cmds,/if\(!house&&\(!simpleCivic\|\|s\.type==='townhall'\)\)\{\n\s*if\(simpleCivic\)normalizeFunctions\(s\);\n\s*const cap=functionCapacity\(s\);/,'describeStructure rooms use functionCapacity');
  assert.match(rooms,/const cap=\(s\.type==='house'\|\|simpleCivic\)\?0:functionCapacity\(s\)/,'room panel uses functionCapacity');
});
console.log('wood gate slots regression: '+passed+' checks');
