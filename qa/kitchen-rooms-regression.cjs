'use strict';
// Kitchens live only on the ground floor of built sections (W1 section, W2 wide hall):
// never in towers or gates, never upstairs; loaded saves drop kitchens placed elsewhere.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const src=name=>fs.readFileSync(__dirname+'/../src/'+name,'utf8');
const siege=src('settlement-siege.js'),castle=src('settlement-castle-placement.js'),core=src('settlement-core.js');

// The genuine source of one function: from its header to the next function at the same indent.
const pick=(text,name)=>{
  const at=text.search(new RegExp('\\n[ ]*function '+name+'\\('));assert.ok(at>=0,name);
  const indent=text.slice(at+1).match(/^[ ]*/)[0],end=text.indexOf('\n'+indent+'function ',at+1);
  return text.slice(at+1,end<0?undefined:end);
};
const ctx=vm.createContext({
  underConstruction:s=>!!s.building,
  structureLevel:s=>s.level||1,
  towerTier:s=>Number(s.size)>=2?3:Number(s.size)>=1.5?2:1,
  builtInteriorFloors:s=>s.span==='wide'?1:(s.level||1),
});
vm.runInContext([pick(castle,'functionCapacity'),pick(siege,'eligibleRoom'),pick(siege,'floor'),pick(siege,'allowed')].join('\n'),ctx);
const allowed=vm.runInContext('allowed',ctx);

const w1L1={type:'built',length:3,level:1},w1L2={type:'built',length:3,level:2},w2={type:'built',span:'wide',length:3,level:2};
assert.ok(allowed(w1L1,0,'kitchen'),'W1 L1 ground floor');
assert.ok(allowed(w1L2,0,'kitchen'),'W1 L2 ground floor');
assert.ok(allowed(w2,0,'kitchen'),'W2 wide hall ground floor');
assert.ok(!allowed(w1L2,1,'kitchen'),'not on the W1 upper floor');
assert.ok(!allowed({type:'built',length:1.5,level:1},0,'kitchen'),'a section under 2U has no room');
assert.ok(!allowed({...w1L1,building:true},0,'kitchen'),'not while under construction');
console.log('PASS kitchens on the ground floor of W1 sections and W2 halls');

for(const tower of [{type:'tower',size:1.5,level:3},{type:'tower',size:2,level:3,isMastio:true}])
  for(let i=0;i<3;i++)assert.ok(!allowed(tower,i,'kitchen'),'no tower kitchen, floor '+(i+1));
for(let i=0;i<2;i++)assert.ok(!allowed({type:'gate',level:3},i,'kitchen'),'no gate kitchen, room '+(i+1));
console.log('PASS no kitchens in towers or gates');

// The other ground-floor stores keep their old rule (ground floor, or floor 2 on L3+).
assert.ok(allowed({type:'tower',size:1.5,level:3},1,'granary'),'granary on tower floor 2 still allowed');
assert.ok(allowed({type:'tower',size:1.5,level:3},0,'commonHall'),'tower common hall still allowed');
console.log('PASS granary, storage and common hall rules unchanged');

// Migration: sanitizeRooms clears functions not allowed, and the save loader runs it.
assert.match(pick(siege,'sanitizeRooms'),/if\(fn&&!allowed\(s,i,fn\)\)\{s\.functions\[i\]=null/);
assert.match(src('settlement-app-persistence.js'),/window\.ConquerSiege\?\.sanitizeRooms\(s\)/);
assert.ok(JSON.parse(core.match(/const FUNCTION_CATALOG=(\[[^\n]+\]);/)[1].replace(/'/g,'"')).includes('kitchen'));
console.log('PASS saved tower and gate kitchens are cleared on load');
