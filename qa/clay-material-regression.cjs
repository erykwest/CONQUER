'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const core=read('src/settlement-core.js');
const start=core.indexOf('function baseConstructionCost(s){'),end=core.indexOf('function costText(',start);
assert.ok(start>0&&end>start,'single cost resolver');
const state=vm.createContext({
  COSTS:{tower:[{gold:45,stone:55,wood:12},{gold:75,stone:95,wood:20},{gold:120,stone:155,wood:32}],woodTower:[{wood:42}],well:{gold:50,stone:35,wood:10},wallPerU:{gold:6,stone:18,wood:2},palisadePerU:{wood:12},builtPerU:{gold:12,stone:16,wood:18}},
  window:{ConquerIndustries:{is:()=>false}},State:{resources:{stone:100,clay:100}},
  isWoodTower:s=>s.material==='wood',towerTier:()=>1,levelCostFactor:()=>1,scaleCost:(x,f=1)=>Object.fromEntries(Object.entries(x).map(([k,v])=>[k,v*f])),
  isWoodGate:s=>s.material==='wood',roundCost:c=>c,isCivicAnnex:()=>false,isCivic:()=>false,
  builtWidth:s=>s.span==='wide'?2:1
});
const shapeCost=core.match(/const TOWER_SHAPE_COST=[^\n]*/)?.[0];
assert.ok(shapeCost,'tower shape cost factors');
vm.runInContext(shapeCost+'\n'+core.slice(start,end),state);
const cost=s=>vm.runInContext('constructionCost('+JSON.stringify(s)+')',state);
// Same tier: round 1.5x, D 1.25x, semitower half of the square tower.
for(const [shape,k] of [['round',1.5],['dee',1.25],['half',.5]])
  assert.equal(cost({type:'tower',shape}).stone,cost({type:'tower',shape:'square'}).stone*k,shape+' tower cost');
for(const s of [{type:'tower',level:1},{type:'wall',length:2},{type:'built',length:3},{type:'well'}]){
  const stone=cost({...s,masonryMaterial:'stone'}),brick=cost({...s,masonryMaterial:'brick'});
  assert.ok(stone.stone>0,'stone baseline '+s.type);assert.equal(brick.clay,stone.stone);
  assert.equal(brick.stone,undefined);assert.equal(brick.gold,stone.gold);
  assert.equal(brick.wood,stone.wood);
}
// A wide hall (2U) costs twice the standard built section of the same length.
assert.equal(cost({type:'built',length:3,span:'wide'}).stone,2*cost({type:'built',length:3}).stone);
assert.deepEqual(JSON.parse(JSON.stringify(cost({type:'tower',material:'wood'}))),{wood:42},'wood tower remains wood');
assert.ok(/masonryMaterial:State.village.privateMasonryMaterial==='brick'\?'brick':'stone'/.test(read('src/settlement-world.js')));
assert.ok(/State.village.privateMasonryMaterial=next/.test(read('src/settlement-app-calendar-ui.js')));
assert.ok(/buildMasonryMaterial:State.buildMasonryMaterial/.test(read('src/settlement-app-persistence.js')));
assert.ok(/s.masonryMaterial=s.masonryMaterial==='brick'\?'brick':'stone'/.test(read('src/settlement-app-persistence.js')));
assert.ok(/s.masonryMaterial==='brick'\?\.80:1/.test(read('src/settlement-siege.js')));
assert.ok(/withStructureVisualMaterial\(s/.test(read('src/settlement-castle3d.js')));
const a=core.indexOf('// DEV VISUAL PALETTE BEGIN'),b=core.indexOf('// DEV VISUAL PALETTE END');
const st={visualPalette:'stone'},paintContext=vm.createContext({State:st,localStorage:{getItem:()=>null}});
vm.runInContext(core.slice(a,b+'// DEV VISUAL PALETTE END'.length),paintContext);
const swatch=obj=>{paintContext.target=obj;return vm.runInContext("withStructureVisualMaterial(target,()=>visualPaletteColor('#635951'))",paintContext)};
assert.equal(swatch({type:'wall',masonryMaterial:'stone'}),'#635951');
assert.equal(swatch({type:'wall',masonryMaterial:'brick'}),'#98523e');
assert.equal(swatch({type:'tower',material:'wood',masonryMaterial:'brick'}),'#635951');
assert.equal(vm.runInContext("visualPaletteColor('#635951')",paintContext),'#635951','structure scope restored');

console.log('PASS clay masonry: per-structure stone/clay costs, auto-spawn rule, persistence, 80% structural HP');
