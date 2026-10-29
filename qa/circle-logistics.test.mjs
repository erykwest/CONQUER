import assert from 'node:assert/strict';
import {test} from 'node:test';
import {
  distributeCircleStores,captureCircleStores,
  advanceCircleOccupation,advanceCircleRecapture
} from '../src/circle/defensive-logistics.mjs';

const granary=(id,sectorId,depth,capacity=1000)=>
  ({id,structureId:id,sectorId,depth,kind:'granary',capacity});
const foodDepots=()=>[
  granary('outer','outer',1),granary('mastio','inner',3),
  granary('middle','middle',2)
];
const supplies=(food=1900)=>({food,wood:0,stone:0,metal:0,equipment:0,horses:0,gold:0});
test('1900 units fill the mastio first, middle second and external reserve last',()=>{
  const distribution=distributeCircleStores(supplies(),foodDepots());
  assert.equal(distribution.depots.find(d=>d.id==='mastio').inventory.food,1000);
  assert.equal(distribution.depots.find(d=>d.id==='middle').inventory.food,900);
  assert.deepEqual(distribution.depots.find(d=>d.id==='outer').inventory,{});
  assert.equal(distribution.unassigned.food,0);
});
test('capture removes only stores physically located inside lost sector',()=>{
  const initial=supplies();
  const out=captureCircleStores({sectorId:'middle',stock:initial,depots:foodDepots()});
  assert.equal(out.lost.food,900);
  assert.equal(out.stock.food,1000);
  assert.deepEqual(out.rooms,['middle']);
  assert.deepEqual(initial,supplies()); // no mutation
  const second=captureCircleStores({sectorId:'middle',stock:out.stock,
    depots:foodDepots(),capturedRoomIds:out.capturedRoomIds});
  assert.equal(second.lost.food,0);
  assert.equal(second.stock.food,1000);
});
test('spending food reduces outer reserve before inner storage',()=>{
  const x=distributeCircleStores(supplies(1200),foodDepots());
  assert.equal(x.depots.find(d=>d.id==='mastio').inventory.food,1000);
  assert.equal(x.depots.find(d=>d.id==='middle').inventory.food,200);
  const after=distributeCircleStores(supplies(950),foodDepots());
  assert.equal(after.depots.find(d=>d.id==='mastio').inventory.food,950);
  assert.equal(after.depots.find(d=>d.id==='middle').inventory.food||0,0);
});
test('mixed materials share one capacity and are never multiplied',()=>{
  const depots=[
    {id:'m1',kind:'storage',sectorId:'core',depth:2,capacity:100},
    {id:'m2',kind:'storage',sectorId:'outer',depth:1,capacity:100}
  ];
  const stock={wood:80,stone:90,metal:10};
  const first=distributeCircleStores(stock,depots);
  assert.deepEqual(first.depots[0].inventory,{wood:80,stone:20});
  assert.deepEqual(first.depots[1].inventory,{stone:70,metal:10});
  const cap=captureCircleStores({sectorId:'outer',stock,depots});
  assert.deepEqual({wood:cap.lost.wood,stone:cap.lost.stone,metal:cap.lost.metal},
    {wood:0,stone:70,metal:10});
  assert.equal(cap.stock.wood,80);
  assert.equal(cap.stock.stone,20);
  assert.equal(cap.stock.metal,0);
});
test('an ambiguous or incompatible store is never looted by geometry guesswork',()=>{
  const stock=supplies(500);
  const depots=[granary('unattributed',null,0,1000)];
  const loss=captureCircleStores({sectorId:'outer',stock,depots});
  assert.equal(loss.lost.food,0);
  assert.equal(loss.stock.food,500);
});
test('legacy over-capacity stock remains unassigned, never disappears',()=>{
  const x=distributeCircleStores(supplies(3000),foodDepots().slice(0,2));
  assert.equal(x.unassigned.food,1000);
  const cap=captureCircleStores({sectorId:'outer',stock:supplies(3000),
    depots:foodDepots().slice(0,2)});
  assert.equal(cap.lost.food,1000);
  assert.equal(cap.stock.food,2000);
});
test('captured rooms are excluded until reclaimed; stolen supplies never reappear',()=>{
  const depots=[granary('a','outer',1),granary('b','core',3)];
  const first=captureCircleStores({sectorId:'outer',stock:supplies(2000),depots});
  assert.equal(first.stock.food,1000);
  const held=distributeCircleStores(first.stock,depots,first.capturedRoomIds);
  assert.equal(held.depots.find(d=>d.id==='a').captured,true);
  const reclaimed=distributeCircleStores(first.stock,depots,[]);
  assert.equal(reclaimed.depots.find(d=>d.id==='a').captured,false);
  assert.equal(reclaimed.totals.food,1000);
});
const occupied=(state,groundEnemies=1,groundDefenders=0,wallDefenders=0)=>
  ({id:'outer',state,control:{groundEnemies,groundDefenders,wallDefenders}});
test('capture requires half a game day of uninterrupted uncontested occupation',()=>{
  const t0=advanceCircleOccupation({},[occupied('invaded')],3);
  assert.deepEqual(t0.confirmed,[]);
  const t1=advanceCircleOccupation(t0.holds,[occupied('invaded')],3.49);
  assert.deepEqual(t1.confirmed,[]);
  const t2=advanceCircleOccupation(t1.holds,[occupied('invaded')],3.5);
  assert.deepEqual(t2.confirmed,['outer']);
});
test('defender arrival, enemy departure, or pause resets capture hold',()=>{
  const t0=advanceCircleOccupation({},[occupied('invaded')],3);
  const contested=advanceCircleOccupation(t0.holds,[occupied('contested',1,1)],3.2);
  assert.deepEqual(contested.holds,{});
  const empty=advanceCircleOccupation(t0.holds,[occupied('secure',0)],3.2);
  assert.deepEqual(empty.holds,{});
  const paused=advanceCircleOccupation(t0.holds,[],3.6);
  assert.deepEqual(paused.confirmed,[]);
});
test('captured sector can be reclaimed after continuous defender presence, no loot restored',()=>{
  const captured={id:'outer',captured:true,state:'captured',
    control:{groundEnemies:0,groundDefenders:1,wallEnemies:0,climbingEnemies:0}};
  const t0=advanceCircleRecapture({},[captured],5);
  assert.deepEqual(t0.reclaimed,[]);
  const t1=advanceCircleRecapture(t0.holds,[captured],5.5);
  assert.deepEqual(t1.reclaimed,['outer']);
  const blocked=advanceCircleRecapture(t0.holds,
    [{...captured,control:{...captured.control,wallEnemies:1}}],5.5);
  assert.deepEqual(blocked.reclaimed,[]);
});
