'use strict';
// S-05 / S-16 / S-25: deterministic regression for the live Siege domain.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/../src/settlement-siege.js','utf8');

function fixture(){
  const State={clock:{day:12},structures:[],siege:null,resources:{},view:{scale:1}};
  const calls={navigation:0,scene:0,dirty:0,saves:0,draws:0,render:0};
  const window={};
  const ctx=vm.createContext({
    State,window,console,
    towerTier:s=>s.tier||2,wallTier:s=>s.tier||2,
    structureLevel:s=>s.level||1,
    underConstruction:s=>!!s.underConstruction,
    invalidateStructureScene:()=>calls.scene++,
    invalidateSceneCache:()=>calls.scene++,
    invalidateNavigation:()=>calls.navigation++,
    markDirty:()=>calls.dirty++,
    scheduleLocalSave:()=>calls.saves++,
    renderFunctionPanel:()=>calls.render++,
    draw:()=>calls.draws++
  });
  vm.runInContext(source,ctx,{filename:'settlement-siege.js'});
  return{State,calls,siege:window.ConquerSiege};
}
const fortress=()=>[
  {id:'wall',type:'wall',material:'stone',level:1,tier:2,length:3,a:{x:0,y:0},b:{x:3,y:0}},
  {id:'wood-wall',type:'wall',material:'wood',level:1,tier:1,length:3,a:{x:4,y:0},b:{x:7,y:0}},
  {id:'stone-tower',type:'tower',material:'stone',level:2,tier:2,x:0,y:3},
  {id:'wood-tower',type:'tower',material:'wood',level:1,tier:1,x:4,y:3},
  {id:'gate',type:'gate',material:'stone',level:2,x:8,y:3},
  {id:'wood-gate',type:'gate',material:'wood',level:1,x:11,y:3},
  {id:'palisade',type:'palisade',material:'wood',level:1,tier:2,length:2,a:{x:0,y:7},b:{x:2,y:7}}
];

{
  const {siege,State,calls}=fixture();State.structures=fortress();
  const masonry=['wall','wood-wall','stone-tower','wood-tower','gate','wood-gate'];
  for(const target of masonry){
    const s=State.structures.find(x=>x.id===target),initial=siege.integrity(s).core.hp;
    for(const weapon of ['sword','spear','axe','arrow','bow','crossbow']){
      const result=siege.attackStructure(target,weapon,9,'core');
      assert.equal(result.ok,false,target+' should ignore '+weapon);
      assert.equal(result.damage,0);
      assert.equal(siege.integrity(s).core.hp,initial,'HP changed for '+weapon+' against '+target);
    }
    for(const weapon of ['ram','torch']){
      assert.equal(siege.attackStructure(target,weapon,9,'core').damage,0,target+' ignored '+weapon);
      assert.equal(siege.integrity(s).core.hp,initial);
    }
  }
  assert.equal(calls.dirty,0,'ineffective attacks cannot mark state dirty');
  assert.equal(calls.saves,0,'ineffective attacks cannot schedule writes');
  console.log('PASS ordinary attacks and arrows cannot damage stone or timber walls/towers/gatehouse cores');
}
{
  const {siege,State,calls}=fixture();State.structures=fortress();
  const gate=State.structures.find(s=>s.id==='gate'),initial=siege.integrity(gate);
  const oldCore=initial.core.hp,oldDoor=initial.door.hp;
  assert.notEqual(initial.core,initial.door,'two durability objects must be distinct');
  const hit=siege.attackStructure('gate','ram',2,'door');
  assert.equal(hit.ok,true);assert.equal(hit.part,'door');
  assert.equal(siege.integrity(gate).core.hp,oldCore);
  assert.ok(siege.integrity(gate).door.hp<oldDoor);
  assert.equal(siege.gateBreached(gate),false);
  assert.equal(calls.saves,1);
  const hit2=siege.attackStructure('gate','trebuchet',1,'core');
  assert.equal(hit2.ok,true);assert.equal(hit2.part,'core');
  assert.ok(siege.integrity(gate).core.hp<oldCore);
  assert.equal(siege.integrity(gate).door.hp,oldDoor-hit.damage);
  assert.equal(siege.attackStructure('gate','arrow',10,'door').damage,0);
  console.log('PASS two independent durability pools, targeted damage and durable state');
}
{
  const {siege,State,calls}=fixture();State.structures=fortress();
  const gate=State.structures.find(s=>s.id==='gate');
  const beforeCore=siege.integrity(gate).core.hp;
  const breached=siege.attackStructure('gate','ram',100,'door');
  assert.equal(breached.destroyed,true);
  assert.equal(breached.part,'door');
  assert.equal(breached.remaining,0);
  assert.equal(siege.gateBreached(gate),true);
  assert.equal(siege.integrity(gate).core.hp,beforeCore);
  assert.equal(State.structures.includes(gate),true,'breached portone cannot delete the gatehouse');
  assert.equal(calls.navigation,1,'first breach must invalidate cached navigation');
  assert.equal(siege.attackStructure('gate','ram',1,'door').damage,0);
  assert.equal(calls.navigation,1,'repeat hit cannot re-trigger breach');
  // Structures are saved by the existing local/cloud persistence pipelines.
  const restored=JSON.parse(JSON.stringify(gate)),fresh=fixture();
  fresh.State.structures=[restored];
  assert.equal(fresh.siege.integrity(restored).core.hp,beforeCore);
  assert.equal(fresh.siege.integrity(restored).door.hp,0);
  assert.equal(fresh.siege.gateBreached(restored),true);
  console.log('PASS portone breach preserves tower, invalidates topology, survives JSON reload');
}
{
  const {siege,State}=fixture();State.structures=fortress();
  const gate=State.structures.find(s=>s.id==='wood-gate');
  const start=siege.integrity(gate).core.hp;
  const wrong=siege.attackStructure(gate.id,'trebuchet',1,'invalid-part');
  assert.equal(wrong.ok,false);
  assert.equal(siege.integrity(gate).core.hp,start,'invalid component may not fall back to core');
  const other=siege.attackStructure('wood-tower','ram',1,'door');
  assert.equal(other.ok,false,'non-gates do not possess door components');
  assert.equal(siege.attackStructure(gate.id,'ram',1,'core').damage,0);
  assert.ok(siege.attackStructure(gate.id,'axe',1,'door').damage>0);
  console.log('PASS invalid target parts rejected; wooden portone uses its own target rules');
}
{
  const {siege,State}=fixture();State.structures=fortress();
  const wall=State.structures.find(s=>s.id==='wall');
  const initial=siege.integrity(wall).core.hp;
  const impact=siege.attackStructure(wall.id,'catapult',1,'core');
  assert.equal(impact.ok,true);assert.ok(impact.damage>0);
  assert.equal(siege.integrity(wall).core.hp,initial-impact.damage);
  assert.equal(siege.attackStructure(wall.id,'catapult',NaN,'core').damage,0);
  console.log('PASS explicit siege artillery damages masonry; malformed forces cannot damage');
}
{
  const {siege,State}=fixture();State.structures=fortress();
  const tower=State.structures.find(s=>s.id==='stone-tower');
  const before=siege.integrity(tower).core.max;
  siege.attackStructure(tower.id,'catapult',5,'core');
  const damage=before-siege.integrity(tower).core.hp;
  tower.level=3;
  const updated=siege.integrity(tower);
  assert.ok(updated.core.max>before);
  assert.equal(updated.core.max-updated.core.hp,damage,'upgrade retains accumulated damage');
  console.log('PASS structural upgrade preserves previous absolute damage');
}
console.log('PASS siege damage skeleton regression suite');
