import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import * as topology from '../src/circle/defensive-topology.mjs';
import * as control from '../src/circle/defensive-control.mjs';
import * as logistics from '../src/circle/defensive-logistics.mjs';
const siegeSource=readFileSync(new URL('../src/settlement-siege.js',import.meta.url),'utf8');
const circleSource=readFileSync(new URL('../src/settlement-circle.js',import.meta.url),'utf8')
  .replace("Promise.all([\n    import('./circle/defensive-topology.mjs?v=circle-1'),\n    import('./circle/defensive-control.mjs?v=circle-1'),\n    import('./circle/defensive-logistics.mjs?v=circle-1')\n  ]).then",
    'Promise.resolve([circleModule,controlModule,logisticsModule]).then');
const rect=(a,b,c,d)=>[{x:a,y:b},{x:c,y:b},{x:c,y:d},{x:a,y:d}];
const wall=(id,a,b,c,d,type='wall')=>({
  id,type,polygon:rect(a,b,c,d),a:{x:a,y:(b+d)/2},
  b:{x:c,y:(b+d)/2},width:d-b,level:1,functions:type==='built'?['granary']:[]
});
const setup=()=>[
  // The built section faces INSIDE: northern wall's outward is -Y.
  {...wall('outer-store',4,4,16,4.5,'built'),flip:true},
  wall('outer-s',4,15.5,16,16),
  {id:'outer-w',type:'wall',polygon:rect(4,4,4.5,16)},
  {id:'outer-e',type:'wall',polygon:rect(15.5,4,16,16)},
  {...wall('inner-store',7,7,13,7.5,'built'),flip:true},
  wall('inner-s',7,12.5,13,13),
  {id:'inner-w',type:'wall',polygon:rect(7,7,7.5,13)},
  {id:'inner-e',type:'wall',polygon:rect(12.5,7,13,13)}
];
async function boot(saved=null){
  const State={structures:setup(),environment:[],relief:{hills:[]},
    clock:{day:0,speed:1},resources:{food:1000,wood:0,stone:0,metal:0,equipment:0,horses:0,gold:0}};
  const enemies=[{id:'enemy',x:6,y:10}],defenders=[],events=[];
  const window={dispatchEvent:e=>events.push(e),
    ConquerCombat:{enemy:()=>enemies,units:()=>defenders,
      uiState:()=>({alarm:'off',alert:'clear'})},
    ConquerTerraforming:{edits:()=>[]}};
  const ctx={State,window,BUILD_MIN:0,BUILD_MAX:20,
    underConstruction:()=>false,
    footprintPoints:s=>s.polygon,
    functionCapacity:s=>s.functions?.length||0,
    functionSlotUnits:()=>1,normalizeFunctions:()=>{},
    structureLevel:()=>1,reliefEdgeBands:()=>[],
    towerDoorSpecs:()=>[],gatePassageInfo:()=>null,
    wallExteriorSide:s=>s.flip?-1:1,
    markDirty:()=>{},renderUI:()=>{},renderFunctionPanel:()=>{},
    setTimeout:fn=>{fn();return 1},clearTimeout:()=>{},
    CustomEvent:class{constructor(type,{detail}={}){this.type=type;this.detail=detail}},
    circleModule:topology,controlModule:control,logisticsModule:logistics,
    console};
  runInNewContext(siegeSource,ctx,{filename:'settlement-siege.js'});
  if(saved)window.ConquerSiege.restore(saved);
  runInNewContext(circleSource,ctx,{filename:'settlement-circle.js'});
  await Promise.resolve();await Promise.resolve();
  return{State,window,enemies,defenders,events,siege:window.ConquerSiege,circle:window.ConquerCircle};
}
test('real siege + circle: inner grain remains when the exterior sector is conquered',async()=>{
  const {State,siege,circle,events}=await boot();
  assert.equal(circle.getStatus().ready,true);
  assert.equal(siege.capacity().food,480);
  const supplied=siege.transfer('food',400);
  assert.equal(supplied.accepted,400);
  const inner=circle.sectorAt({x:10,y:10}),outer=circle.sectorAt({x:6,y:10});
  assert.ok(inner&&outer&&inner!==outer);
  assert.equal(siege.circleDepots().find(d=>d.id==='inner-store:0').sectorId,inner);
  assert.equal(siege.circleDepots().find(d=>d.id==='outer-store:0').sectorId,outer);
  const inventory=siege.circleStoreInventory().depots;
  assert.equal(inventory.find(d=>d.id==='inner-store:0').inventory.food,240);
  assert.equal(inventory.find(d=>d.id==='outer-store:0').inventory.food,160);
  assert.equal(circle.controlState(outer).state,'invaded');
  assert.equal(circle.controlState(inner).state,'secure');
  circle.tickOccupation(0);
  State.clock.day=.5;circle.tickOccupation(.5);
  assert.equal(siege.state().stock.food,240);
  assert.equal(siege.circleCaptureRecords()[0].lost.food,160);
  assert.equal(circle.controlState(outer).state,'captured');
  assert.equal(circle.controlState(inner).state,'secure');
  assert.equal(siege.capacity().food,240);
  assert.ok(events.some(e=>e.type==='conquer-circle-captured'));
});
test('real siege + circle: captured rooms persist reload without a second loot',async()=>{
  const game=await boot();
  game.siege.transfer('food',400);
  game.circle.tickOccupation(0);game.State.clock.day=.5;game.circle.tickOccupation(.5);
  const saved=JSON.parse(JSON.stringify(game.State.siege));
  const loaded=await boot(saved);
  assert.equal(loaded.siege.state().stock.food,240);
  assert.equal(loaded.siege.capacity().food,240);
  assert.equal(loaded.siege.circleCaptureRecords().length,1);
  assert.equal(loaded.circle.controlState(loaded.circle.sectorAt({x:6,y:10})).state,'captured');
  loaded.circle.tickOccupation(1);
  loaded.State.clock.day=2;loaded.circle.tickOccupation(2);
  assert.equal(loaded.siege.state().stock.food,240);
  assert.equal(loaded.siege.circleCaptureRecords().length,1);
});
test('real siege + circle: defender recapture reopens room, never restores food',async()=>{
  const game=await boot();
  game.siege.transfer('food',400);
  game.circle.tickOccupation(0);game.State.clock.day=.5;game.circle.tickOccupation(.5);
  const outer=game.circle.sectorAt({x:6,y:10});
  game.enemies.splice(0);
  game.defenders.push({x:6,y:10});
  game.circle.invalidateControl();
  game.State.clock.day=1;game.circle.tickOccupation(1);
  game.State.clock.day=1.5;game.circle.tickOccupation(1.5);
  assert.equal(game.circle.controlState(outer).state,'secure');
  assert.equal(game.siege.capacity().food,480);
  assert.equal(game.siege.state().stock.food,240);
  assert.equal(game.siege.circleCaptureRecords().length,0);
});
