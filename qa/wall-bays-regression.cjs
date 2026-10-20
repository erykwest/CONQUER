'use strict';
// Walls take damage bay by bay (~2.5 U) and a fallen bay opens a breach: the wall is
// split there into standing stretches that keep their bays, costs and tower links,
// and the gap gets rubble. Ladders and assault towers cannot storm thin (T1) walls
// or walls with hoardings; ladders only reach H1; towers need the wall's level.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const root=__dirname+'/../src/';
const siege=fs.readFileSync(root+'settlement-collapse.js','utf8')+'\n'+fs.readFileSync(root+'settlement-siege.js','utf8');
const placement=fs.readFileSync(root+'settlement-castle-placement.js','utf8');
const core=fs.readFileSync(root+'settlement-core.js','utf8');
const pick=(src,re,name)=>{const m=src.match(re)?.[0];assert.ok(m,'use the actual '+name);return m};
const fragmentSrc=pick(placement,/function proportionalBuildCost\([\s\S]*?\n\}\nfunction wallFragmentFrom\([\s\S]*?\n\}/,'wall fragment code');
const breakMin=pick(core,/const WALL_BREAK_MIN=[^;]+;/,'WALL_BREAK_MIN');

function fixture(){
  const State={clock:{day:20},structures:[],siege:null,selectedId:null,view:{scale:1}};
  const calls={nav:0,colliders:0};let id=0;
  const ctx=vm.createContext({
    State,window:{},console,Math,Number,Object,Array,Map,Set,String,
    uid:()=>'w'+(++id),dist:(a,b)=>Math.hypot(b.x-a.x,b.y-a.y),normalizeStructureVariants:()=>{},
    structureLevel:s=>s.level||1,structureHeight:s=>[1.15,2.10][(s.level||1)-1],
    wallTier:s=>s.tier||2,wallSkin:s=>s.skin||'standard',towerTier:()=>2,
    underConstruction:()=>false,invalidateStructureScene:()=>{},invalidateSceneCache:()=>{},
    invalidateNavigation:()=>{calls.nav++},invalidateCastleColliderGeometry:()=>{calls.colliders++},
    markDirty:()=>{},renderFunctionPanel:()=>{},draw:()=>{},status:()=>{},terrainElevation:()=>0,
    performance:{now:()=>0},isWoodTower:()=>false
  });
  vm.runInContext(breakMin+'\n'+fragmentSrc+'\n'+siege,ctx);
  return{State,S:ctx.window.ConquerSiege,calls};
}
const wall=(o={})=>({id:'wall',type:'wall',a:{x:0,y:0},b:{x:8,y:0},length:8,width:.5,tier:2,level:1,
  aSnap:'towerA',bSnap:'towerB',buildCost:{stone:80},functions:[],...o});

{
  const {State,S}=fixture(),w=wall();State.structures.push(w);
  const bays=S.bays(w);
  assert.equal(bays.length,3,'an 8 U wall has three bays (~2.5 U)');
  assert.ok(bays.every(b=>b.to-b.from>=2&&b.to-b.from<=3),'bays of 2-3 U');
  assert.equal(Math.round(bays.reduce((t,b)=>t+b.max,0)),S.healthMaximum(w),'bays share the wall health');
  const out=S.attackStructure('wall','trebuchet',10,{x:7,y:.1});
  assert.equal(out.bay,2,'the blow lands on the bay at the point of impact');
  assert.ok(bays[0].hp===bays[0].max&&bays[1].hp===bays[1].max&&bays[2].hp<bays[2].max,'only that bay is damaged');
  assert.equal(S.attackStructure('wall','axe',10,1).ok,false,'an axe cannot hurt stone');
  console.log('PASS walls are damaged bay by bay where they are hit');
}

{
  const {State,S,calls}=fixture(),w=wall();
  const towerA={id:'towerA',type:'tower',wallConnections:[{wallId:'wall',end:'a',anchor:{x:-.5,y:0}}]};
  const towerB={id:'towerB',type:'tower',wallConnections:[{wallId:'wall',end:'b',anchor:{x:8.5,y:0}}]};
  State.structures.push(towerA,w,towerB);State.selectedId='wall';
  S.attackStructure('wall','trebuchet',10,0);                   // some damage on the first bay
  let out;for(let k=0;k<20&&!(out&&out.breach);k++)out=S.attackStructure('wall','trebuchet',10,1);
  assert.ok(out.breach,'the middle bay falls');
  const walls=State.structures.filter(s=>s.type==='wall');
  assert.equal(walls.length,2,'the wall is split into two standing stretches');
  const [left,right]=walls.sort((p,q)=>p.a.x-q.a.x);
  assert.equal(left.aSnap,'towerA');assert.equal(right.bSnap,'towerB');
  assert.equal(left.bSnap,null);assert.equal(right.aSnap,null);
  assert.ok(Math.abs(right.a.x-left.b.x-8/3)<1e-6,'the breach is exactly the fallen bay');
  assert.equal(towerA.wallConnections[0].wallId,left.id,'tower links follow the stretches');
  assert.equal(towerB.wallConnections[0].wallId,right.id);
  assert.equal(left.siegeIntegrity.bays.length,1,'each stretch keeps its own bays');
  assert.ok(left.siegeIntegrity.bays[0].hp<left.siegeIntegrity.bays[0].max,'and the damage they had');
  assert.equal(right.siegeIntegrity.bays[0].from,0,'re-based on the stretch');
  assert.equal(left.buildCost.stone+right.buildCost.stone<=80,true,'costs are split, not duplicated');
  assert.equal(State.selectedId,left.id,'the selection follows a stretch');
  const ruin=State.siege.ruins.at(-1);
  assert.equal(ruin.cause,'breach','the bay comes down as a collapse');assert.ok(ruin.width===.5&&ruin.height===1.15,'rubble sized on the wall');
  assert.ok(calls.nav>0&&calls.colliders>0,'navigation and colliders see the gap');
  const rubble=S.dynamicMeshes();
  assert.equal(rubble.length,1);assert.equal(rubble[0].pos.length,rubble[0].col.length*9);
  assert.ok(rubble[0].pos.every(Number.isFinite),'rubble mesh is finite');
  console.log('PASS a fallen bay opens a breach and the stretches stand');
}

{
  const {State,S}=fixture(),w=wall({length:2.6,b:{x:2.6,y:0}});State.structures.push(w);
  for(let k=0;k<20;k++)S.attackStructure('wall','trebuchet',10,0);
  assert.equal(State.structures.filter(s=>s.type==='wall').length,0,'a one-bay wall is gone when its bay falls');
  assert.equal(State.siege.ruins.at(-1).cause,'breach');
  // Legacy save: damage on the whole wall, no bays yet -> spread over the bays.
  const {State:St2,S:S2}=fixture(),old=wall();St2.structures.push(old);
  const max=S2.healthMaximum(old);old.siegeIntegrity={core:{hp:max-90,max},door:null};
  const b2=S2.bays(old);
  assert.ok(b2.every(b=>Math.abs(b.max-b.hp-30)<1e-6),'legacy damage is spread over the bays');
  // An upgrade keeps each bay's absolute damage.
  old.tier=3;const b3=S2.bays(old);
  assert.ok(b3.every(b=>Math.abs(b.max-b.hp-30)<1e-6)&&b3[0].max>b2[0].max-1e-9,'upgrades keep the damage taken');
  console.log('PASS one-bay walls, legacy damage and upgrades');
}

{
  const {S}=fixture(),ok=(w,e,l)=>S.assaultCheck(wall(w),e,l).ok;
  assert.equal(ok({tier:1},'ladder'),false,'no ladder on a thin T1 wall');
  assert.equal(ok({tier:1},'tower',2),false,'no tower bridge on a thin T1 wall');
  assert.equal(ok({skin:'hoarding'},'ladder'),false,'hoardings keep ladders off');
  assert.equal(ok({skin:'hoarding'},'tower',2),false,'and bridges');
  assert.equal(ok({skin:'machicolation'},'ladder'),true,'machicolations do not stop an assault');
  assert.equal(ok({level:2},'ladder'),false,'ladders only reach H1');
  assert.equal(ok({level:2},'tower',1),false,'a level 1 tower cannot reach H2');
  assert.equal(ok({level:2},'tower',2),true,'a level 2 tower can');
  assert.equal(ok({},'ladder'),true);
  console.log('PASS assault rules: T1 and hoardings repel ladders and towers');
}
