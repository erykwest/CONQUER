import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {
  distributeCircleStores,captureCircleStores
} from '../src/circle/defensive-logistics.mjs';
const source=readFileSync(new URL('../src/settlement-siege.js',import.meta.url),'utf8');
const room=(id,compartmentId)=>({id,type:'tower',x:0,y:0,
  level:1,functions:['granary'],roomSector:compartmentId});
function harness() {
  const inner=room('mastio','inner'),outer=room('outer','outer');
  const State={clock:{day:0,speed:1},structures:[outer,inner],
    resources:{food:1000,wood:0,stone:0,metal:0,equipment:0,horses:0,gold:0},siege:null};
  const event=[];
  const window={
    ConquerCircle:{
      getSnapshot:()=>({compartments:[
        {id:'inner',depth:3},{id:'outer',depth:1}
      ]}),
      sectorForStructure:s=>s.roomSector,
      distributeStores:distributeCircleStores,captureStores:captureCircleStores,
      invalidateControl:()=>event.push('invalidate')
    }
  };
  const ctx={State,window,
    underConstruction:()=>false,
    functionCapacity:s=>s.functions.length,
    functionSlotUnits:()=>1,
    normalizeFunctions:()=>{},
    structureLevel:s=>s.level,
    markDirty:()=>event.push('save'),
    renderUI:()=>{},renderFunctionPanel:()=>{},
    console};
  runInNewContext(source,ctx,{filename:'settlement-siege.js'});
  return{State,window,siege:window.ConquerSiege,event};
}
const occupation=id=>({id,state:'invaded',captured:false,depth:1,
  polygon:[[0,0],[1,0],[1,1]],anchors:[{x:.5,y:.5}],
  control:{groundEnemies:1,groundDefenders:0,wallDefenders:0}});
test('real siege room capacities and stock stay authoritative',()=>{
  const {State,siege}=harness();
  assert.equal(siege.capacity().food,480);
  assert.equal(siege.transfer('food',400).accepted,400);
  assert.equal(State.siege.stock.food,400);
  assert.equal(State.resources.food,600);
  const depots=siege.circleStoreInventory().depots;
  assert.equal(depots.find(d=>d.structureId==='mastio').inventory.food,240);
  assert.equal(depots.find(d=>d.structureId==='outer').inventory.food,160);
});
test('captured room transfers only its physical food to loot, not resources ledger',()=>{
  const {State,siege}=harness();
  siege.transfer('food',350); // 240 in mastio, 110 in exposed granary
  State.clock.day=2;
  const result=siege.captureCircleSector(occupation('outer'));
  assert.equal(result.ok,true);
  assert.equal(result.lost.food,110);
  assert.equal(State.siege.stock.food,240);
  assert.equal(State.resources.food,650);
  assert.equal(siege.capacity().food,240);
  assert.deepEqual(Array.from(State.siege.circle.capturedRoomIds),['outer:0']);
  assert.equal(siege.circleCaptureRecords().length,1);
  assert.equal(siege.circleStoreInventory().totals.food,240);
});
test('duplicate capture is rejected and cannot subtract a second time',()=>{
  const {State,siege}=harness();
  siege.transfer('food',350);
  const sector=occupation('outer');
  assert.equal(siege.captureCircleSector(sector).ok,true);
  const before=State.siege.stock.food;
  assert.equal(siege.captureCircleSector(sector).ok,false);
  assert.equal(State.siege.stock.food,before);
  assert.equal(siege.circleCaptureRecords().length,1);
});
test('siege.restore preserves loot ledger, conquered rooms and available food',()=>{
  const {State,siege}=harness();
  siege.transfer('food',350);
  siege.captureCircleSector(occupation('outer'));
  const saved=JSON.parse(JSON.stringify(State.siege));
  const next=harness();
  next.siege.restore(saved);
  assert.equal(next.siege.capacity().food,240);
  assert.equal(next.State.siege.stock.food,240);
  assert.deepEqual(Array.from(next.State.siege.circle.capturedRoomIds),['outer:0']);
  assert.equal(next.siege.circleCaptureRecords()[0].lost.food,110);
});
test('recapturing rooms reopens capacity but never returns the seized goods',()=>{
  const {State,siege}=harness();
  siege.transfer('food',350);
  const record=siege.captureCircleSector(occupation('outer')).record;
  const reclaimed=siege.releaseCircleSector(record.id);
  assert.equal(reclaimed.ok,true);
  assert.equal(siege.capacity().food,480);
  assert.equal(State.siege.stock.food,240);
  assert.deepEqual(Array.from(State.siege.circle.capturedRoomIds),[]);
  assert.equal(siege.circleCaptureRecords().length,0);
});
test('a defender or hostile on a wall alone cannot claim a completed sector',()=>{
  const {siege}=harness();
  assert.equal(siege.captureCircleSector({...occupation('outer'),
    state:'contested'}).ok,false);
  assert.equal(siege.captureCircleSector({...occupation('outer'),
    control:{groundEnemies:1,groundDefenders:0,wallDefenders:1}}).ok,false);
  assert.equal(siege.circleCaptureRecords().length,0);
});
