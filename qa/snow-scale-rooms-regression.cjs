'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const src=name=>fs.readFileSync(__dirname+'/../src/'+name,'utf8');
const core=src('settlement-core.js'),castle=['castle','landscape','castle-placement','castle-structures','buildings'].map(part=>src('settlement-'+part+'.js')).join('\n'),app=['app','app-rooms','app-input','app-persistence','app-calendar-ui','app-simulation','app-bootstrap'].map(part=>src('settlement-'+part+'.js')).join('\n');
const siege=src('settlement-siege.js'),render=['architecture','weather','render'].map(part=>src('settlement-'+part+'.js')).join('\n'),population=['population','population-fields','population-navigation','population-routines','population-residents','population-figures','population-garrisons'].map(part=>src('settlement-'+part+'.js')).join('\n');

const catalog=core.match(/const FUNCTION_CATALOG=(\[[^\n]+\]);/);
assert.ok(catalog);
const functions=vm.runInNewContext(catalog[1]);
assert.ok(functions.includes('barracks'),'barracks is the canonical garrison function');
assert.ok(!functions.includes('quarters'),'duplicate quarters option must be hidden');
const roomsSource=castle.match(/function functionCapacity\(s\)\{[\s\S]*?\n\}/)?.[0];
const normalizeSource=castle.match(/function normalizeFunctions\(s\)\{[\s\S]*?\n\}/)?.[0];
assert.ok(roomsSource&&normalizeSource,'test genuine castle room normalization');
const ctx=vm.createContext({
  towerTier:s=>Number(s.size)>=1.5?2:1,
  structureLevel:s=>s.level||1,
  window:{},
});
vm.runInContext(roomsSource+'\n'+normalizeSource,ctx);
const tower={type:'tower',size:1.5,level:3,functions:['quarters','storage','guard']};
vm.runInContext('normalizeFunctions',ctx)(tower);
assert.equal(tower.functions[0],'barracks','saved quarters migrate into canonical barracks');
assert.deepEqual(tower.functions,['barracks','storage','guard'],'actual room/floor mapping stays unchanged');
const capacityExpr=siege.match(/const CAPACITY=Object.freeze\((\{[\s\S]*?\})\);/)?.[1];
assert.ok(capacityExpr);
const capacities=vm.runInNewContext('('+capacityExpr+')');
assert.equal(capacities.barracks.soldiers,capacities.quarters.soldiers,'legacy quarters and barracks support equal garrison size');
assert.match(castle,/slot\.role==='barracks'\|\|slot\.role==='quarters'/);
assert.match(population,/slot\.role==='barracks'\|\|slot\.role==='quarters'/);
console.log('PASS quarters migrate into Barracks with the same function, garrison and cutaway appearance');

const roomOrderExpr=app.match(/Array\.from\(\{length:cap\},\(_,n\)=>\['tower','built'\]\.includes\(s\.type\)\?cap-1-n:n\)/)?.[0];
assert.ok(roomOrderExpr,'room display order must derive from real floor indices');
function displayed(type,cap){
  return vm.runInNewContext(roomOrderExpr,{s:{type},cap});
}
assert.deepEqual(Array.from(displayed('tower',3)),[2,1,0],'tower room 3 visually above room 1');
assert.deepEqual(Array.from(displayed('built',2)),[1,0],'built-section room 2 visually above room 1');
assert.deepEqual(Array.from(displayed('gate',3)),[0,1,2],'gate room order intentionally unchanged');
assert.match(app,/data-function-slot="\$\{i\}"/,'selector still targets the original saved floor');
console.log('PASS towers and built sections list highest floor first with original data indices');

assert.match(render,/const tier=towerTier\(tower\),width=clamp\(\.38\+tier\*\.045,\.42,\.54\)\*1\.5/);
assert.match(render,/height=fullHeight\/3\*1\.5/);
assert.match(render,/const ww=2\.1\*State\.view\.scale,wh=3\.25\*State\.view\.scale;/);
assert.match(castle,/for\(const w of plan\.windows\)if\(facing\(w\.p,w\.normal\)\)drawHouseFacadePane\(w\);/);
assert.match(population,/const base=w2s\(dot\.p,\.10\),scale=State\.view\.scale\*\.5/);
assert.match(population,/function militaryScale\(\)\{[\s\S]*?return State\.view\.scale\*\.5;/);
console.log('PASS house windows and all unit classes 50%, stone-tower doors 150%');
