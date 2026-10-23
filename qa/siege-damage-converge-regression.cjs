'use strict';
// Converges the /assedio weapon restrictions into main without regressing the
// contemporary per-bay wall, gate-closure, breach, collapse and save contracts.
// Run: node qa/siege-damage-converge-regression.cjs
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const siege=fs.readFileSync(__dirname+'/../src/settlement-siege.js','utf8');

function fixture(){
  const State={clock:{day:20},structures:[],siege:null,selectedId:null,view:{scale:1},resources:{}};
  const calls={navigation:0,dirty:0,scene:0,redraw:0,draw:0};
  const ctx=vm.createContext({State,window:{},console,Math,Number,Object,Array,Map,Set,String,
    structureLevel:s=>s.level||1,structureHeight:s=>[2.8,4,5.2][(s.level||1)-1],
    towerTier:s=>s.tier||2,wallTier:s=>s.tier||2,wallSkin:()=>'standard',houseLevel:()=>1,
    underConstruction:()=>false,isWoodTower:s=>s.material==='wood',
    invalidateStructureScene:()=>calls.scene++,invalidateSceneCache:()=>calls.scene++,
    invalidateNavigation:()=>calls.navigation++,markDirty:()=>calls.dirty++,
    renderFunctionPanel:()=>{},requestSceneDraw:()=>calls.redraw++,draw:()=>calls.draw++,status:()=>{},terrainElevation:()=>0
  });
  vm.runInContext(siege,ctx,{filename:'src/settlement-siege.js'});
  return{State,S:ctx.window.ConquerSiege,calls};
}
const wall=(id,material='stone',type='wall')=>({
  id,type,material,a:{x:0,y:0},b:{x:8,y:0},length:8,width:.5,tier:2,level:1,functions:[]
});
const tower=(id,material='stone',type='tower')=>({
  id,type,material,x:12,y:8,level:2,tier:2,functions:[]
});

{
  const {State,S,calls}=fixture();
  const structures=[
    wall('stone-wall'),wall('timber-wall','wood'),wall('built-wall','wood','built'),
    tower('stone-tower'),tower('timber-tower','wood'),
    tower('gatehouse','stone','gate'),tower('wood-gatehouse','wood','gate')
  ];
  State.structures.push(...structures);
  const restricted=['sword','spear','axe','arrow','bow','crossbow','ram','torch'];
  for(const s of structures){
    const hp=S.integrity(s).core.hp;
    for(const weapon of restricted){
      const hit=S.attackStructure(s.id,weapon,9);
      assert.equal(hit.ok,false,s.id+' must reject '+weapon);
      assert.equal(hit.damage,0,s.id+' must take zero damage from '+weapon);
      assert.equal(S.integrity(s).core.hp,hp,s.id+' core HP changed from '+weapon);
    }
  }
  assert.equal(calls.dirty,0,'ineffective attacks must not schedule gameplay writes');
  for(const name of ['arrow','bow','crossbow'])assert.equal(S.WEAPONS[name].wood,0);
  console.log('PASS ordinary weapons, ram and torch cannot destroy structural cores');
}
{
  const {State,S,calls}=fixture();
  const w=wall('wall');const t=tower('tower');const g=tower('gate','wood','gate');
  State.structures.push(w,t,g);
  const cases=[
    ['tower','trebuchet',1,'door'],
    ['tower','trebuchet',1,'unknown'],
    ['gate','trebuchet',1,'unknown'],
    ['wall','trebuchet',1,'door'],
    ['wall','trebuchet',1,-1],
    ['wall','trebuchet',1,999],
    ['wall','trebuchet',1,{x:1,y:NaN}],
    ['wall','trebuchet',1,{x:Infinity,y:1}],
    ['gate','ram',1,{x:0,y:NaN}]
  ];
  for(const [id,weapon,power,target] of cases){
    const result=S.attackStructure(id,weapon,power,target);
    assert.equal(result.ok,false,id+' rejects invalid component '+String(target));
    assert.equal(result.damage,0);
  }
  for(const power of [NaN,Infinity,-Infinity,0,-1,'bad']){
    for(const [id,weapon,part] of [['wall','trebuchet',0],['tower','trebuchet','core'],['gate','ram','door']]){
      const result=S.attackStructure(id,weapon,power,part);
      assert.equal(result.ok,false,id+' rejects '+String(power));
      assert.equal(result.damage,0);
    }
  }
  assert.equal(calls.dirty,0,'invalid targets and forces must not mutate structures');
  const directed=S.attackStructure('tower','trebuchet',1,{x:2,y:5});
  assert.equal(directed.ok,true,'finite world-space tower hits still drive directional collapses');
  console.log('PASS invalid targets rejected while valid point-impact vectors remain supported');
}
{
  const {State,S,calls}=fixture();
  const palisade=wall('pal','wood','palisade');
  const house=tower('house','wood','house');
  const gate=tower('gate','wood','gate');
  const intactWall=wall('wall');
  State.structures.push(palisade,house,gate,intactWall);
  assert.ok(S.attackStructure('pal','axe',1,0).damage>0,'axe still damages palisades');
  assert.ok(S.attackStructure('pal','torch',1,0).damage>0,'torch still damages palisades');
  assert.ok(S.attackStructure('house','torch',1,'core').damage>0,'civilian fires remain functional');
  assert.ok(S.attackStructure('gate','axe',1,'door').damage>0,'axe still damages the portone');
  const doorBefore=S.integrity(gate).door.hp,coreBefore=S.integrity(gate).core.hp;
  assert.ok(S.attackStructure('gate','ram',1,'door').damage>0);
  assert.ok(S.integrity(gate).door.hp<doorBefore,'ram affects portone');
  assert.equal(S.integrity(gate).core.hp,coreBefore,'ram never affects gatehouse core');
  const bayList=S.bays(intactWall);
  assert.equal(bayList.length,3,'the modern per-bay wall model remains active');
  const hit=S.attackStructure('wall','trebuchet',1,{x:7,y:0});
  assert.equal(hit.ok,true);assert.equal(hit.bay,2);
  assert.equal(bayList[0].hp,bayList[0].max);
  assert.equal(bayList[1].hp,bayList[1].max);
  assert.ok(bayList[2].hp<bayList[2].max,'only the impacted bay suffers');
  assert.ok(calls.redraw>0,'damage uses the shared scene scheduler');
  assert.equal(calls.draw,0,'damage must not reintroduce synchronous redraws');
  console.log('PASS palisades, civilians, portoni and localized siege artillery still work');
}
{
  const {State,S,calls}=fixture();
  const gate=tower('gate','stone','gate');
  gate.drawbridge={installed:true,raised:true,progress:1};
  State.structures.push(gate);
  const core=S.integrity(gate).core.hp;
  assert.equal(S.setGateClosed('gate',true),true);
  assert.equal(S.gateClosed(gate),true,'closed portone blocks passage');
  const hit=S.attackStructure('gate','ram',100,'door');
  assert.equal(hit.ok,true);assert.equal(hit.part,'door');assert.equal(hit.remaining,0);
  assert.equal(S.doorStage(gate),'broken');
  assert.equal(S.gateClosed(gate),false,'broken portone opens passage');
  assert.equal(gate.drawbridge,undefined,'drawbridge is lost when gate is breached');
  assert.equal(S.integrity(gate).core.hp,core,'gatehouse stands after portone breach');
  assert.ok(calls.navigation>0,'pathfinding is invalidated on close/breach');
  const loaded=JSON.parse(JSON.stringify(gate)),fresh=fixture();
  fresh.State.structures.push(loaded);
  assert.equal(fresh.S.integrity(loaded).door.hp,0,'broken door stays broken after save/load');
  assert.equal(fresh.S.doorStage(loaded),'broken');
  assert.equal(fresh.S.setGateClosed('gate',true),false,'broken portone cannot be closed');
  console.log('PASS independent gatehouse/portone HP, breach, pathfinding and save/load');
}
{
  const {State,S}=fixture(),s=tower('tower','stone','tower');
  State.structures.push(s);
  const original=S.integrity(s).core.max;
  assert.ok(S.attackStructure('tower','catapult',4,'core').damage>0);
  const damage=original-S.integrity(s).core.hp;
  s.level=3;
  const updated=S.integrity(s).core;
  assert.ok(updated.max>original);
  assert.ok(Math.abs(updated.max-updated.hp-damage)<1e-9,'upgrade keeps existing damage');
  console.log('PASS structural upgrades preserve damage');
}
console.log('PASS siege convergence regression');
