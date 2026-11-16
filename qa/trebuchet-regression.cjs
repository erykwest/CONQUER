'use strict';
// Trebuchets (src/settlement-trebuchets.js): placed in range of a fortification they aim at the
// nearest one, set up, then shoot once per cycle (a real attackStructure hit plus a burning
// stone); a fallen target is replaced by the next one in range; with no crew left they stop.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');

const hits=[],stones=[];
const State={structures:[
  {id:'near',type:'tower',x:110,y:100},
  {id:'far',type:'tower',x:110,y:120},
  {id:'away',type:'tower',x:20,y:20},
  {id:'house',type:'house',x:118,y:100}
]};
const window={
  ConquerSiegeEngines3D:{RANGE:{trebuchet:28},CYCLE:{trebuchet:6},triangles:()=>({pos:[],col:[]}),crew:()=>[]},
  ConquerSiege:{attackStructure:(id,weapon,force)=>{hits.push({id,weapon,force});return{ok:true,damage:7*force}},state:()=>({ruins:[]})},
  ConquerFire:{volley:(s,kind,origin)=>{stones.push({id:s.id,kind,origin});return 1}}
};
const ctx=vm.createContext({window,State,Math,Number,Date,JSON,Array,Object,console});
vm.runInContext(read('src/settlement-trebuchets.js'),ctx);
const T=window.ConquerTrebuchets;

assert.equal(T.add({x:60,y:60}).ok,false,'nothing within range: refused');
const r=T.add({x:126,y:100});
assert.ok(r.ok&&r.target==='near','aims at the nearest fortification, never a house');
const t=r.trebuchet;
assert.ok(Math.abs(t.heading-Math.PI)<1e-9,'faces its target');
for(let i=0;i<55;i++)T.tick(.1);
assert.equal(hits.length,0,'no shot while it is being set up');
for(let i=0;i<120;i++)T.tick(.1);   // 17.5 s: set up at 6 s, then two cycles of 6 s
assert.equal(hits.length,2,'one shot per cycle once set up');
assert.ok(hits.every(h=>h.id==='near'&&h.weapon==='trebuchet'&&h.force===T.FORCE),'real trebuchet hits on the target');
assert.equal(stones.length,2,'each shot is also a burning stone');
const s=stones[0];assert.ok(Math.abs(s.origin.x-94)<1e-9&&s.origin.y===100,'the stone comes from the engine side');
console.log('PASS trebuchet: range, target, set-up, one hit per cycle');

State.structures[0].destroyed=true;
for(let i=0;i<60;i++)T.tick(.1);
assert.equal(hits.at(-1).id,'far','a fallen target is replaced by the next one in range');
t.crew=0;const n=hits.length;
for(let i=0;i<120;i++)T.tick(.1);
assert.equal(hits.length,n,'with no crew left it stops shooting');
T.clear();assert.equal(T.list().length,0,'cleared');
console.log('PASS trebuchet: retarget after a fall, stops without crew, clear');
