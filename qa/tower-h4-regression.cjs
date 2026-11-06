'use strict';
// BC-251105-07: H4 (four storeys) only for the free-standing square stone W2 tower.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const src=f=>fs.readFileSync(path.join(__dirname,'..','src',f),'utf8');
const fnSrc=(text,name)=>{const m=text.match(new RegExp('function '+name+'\\([^)]*\\)\\{[\\s\\S]*?\\n\\}'));assert.ok(m,name+' found');return m[0]};
const lineFn=(text,name)=>{const m=text.match(new RegExp('^function '+name+'\\(.*$','m'));assert.ok(m,name+' found');return m[0]};
const block=(text,from,to)=>text.slice(text.indexOf(from),text.indexOf(to));

const core=src('settlement-core.js'),castle=src('settlement-castle.js');
const ctx=vm.createContext({Math,Number,Object,Array,clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),
  isOrientedTower:s=>s.shape==='dee',isWoodTower:s=>s.material==='wood',isLonghouse:()=>false,isWoodGate:s=>s.type==='gate'&&s.material==='wood',structureVariant:()=>''});
vm.runInContext([
  block(core,'const SQUARE_TOWER_TIERS','const COSTS='),
  lineFn(core,'towerTier'),
  block(core,'const GATE_SIZES','function houseLevel'),
  fnSrc(core,'levelCostFactor'),fnSrc(castle,'structureHeight'),
  'function woodTowerStyle(){return""}function woodTowerRoof(){return""}function isWideBuilt(){return false}',
  'this.api={towerH4Allowed,maxStructureLevel,structureLevel,levelCostFactor,structureHeight};'
].join('\n'),ctx);
const A=ctx.api;

const w2={type:'tower',shape:'square',material:'stone',size:1.5,level:4};
assert.ok(A.towerH4Allowed(w2),'square stone W2: H4');
assert.equal(A.maxStructureLevel(w2),4);
assert.equal(A.structureLevel(w2),4);
for(const [label,s] of [
  ['W1',{...w2,size:1}],['W3',{...w2,size:2}],['W4 keep',{...w2,size:3}],
  ['round',{type:'tower',shape:'round',material:'stone',r:.75,level:4}],
  ['dee',{...w2,shape:'dee'}],['timber',{...w2,material:'wood'}],['subtower',{...w2,parentTowerId:'g'}],
  ['gate',{type:'gate',material:'stone',size:1.5,level:4}]
]){
  assert.ok(!A.towerH4Allowed(s),label+': no H4');
  assert.ok(A.structureLevel(s)<=3,label+': clamped to H3 at most');
}
const h3=A.structureHeight({...w2,level:3}),h4=A.structureHeight(w2);
assert.ok(Math.abs(h4-h3-1.2)<1e-9,'one more 1.2U storey');
assert.ok(h4/1.5>3.5&&h4/1.5<4.5,'slender but plausible: '+(h4/1.5).toFixed(2)+':1');
assert.ok(A.levelCostFactor(w2)>A.levelCostFactor({...w2,level:3})*1.4,'H4 costs ~45% more than H3');
console.log('PASS H4 only on the square stone W2 tower');
