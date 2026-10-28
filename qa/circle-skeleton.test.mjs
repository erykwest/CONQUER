import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCompartment, createBarrier, isDefensiveBarrier, createDepot, allocateDefensiveStores, captureCompartment, nextCivilianRefuge, createCircleSkeleton } from '../src/circle/defensive-compartments.mjs';
const poly = [[0,0],[1,0],[0,1]];
const inner = createCompartment({ id:'inner',polygon:poly,depth:2,mastio:true,adjacentIds:['outer'] });
const outer = createCompartment({ id:'outer',polygon:poly,depth:1,adjacentIds:['inner'] });
test('civil buildings never close a perimeter; impassable cliffs can',()=>{
 assert.equal(isDefensiveBarrier(createBarrier({id:'inn',kind:'fortification',fortified:false,passable:false})),false);
 assert.equal(isDefensiveBarrier(createBarrier({id:'cliff',kind:'natural',passable:false})),true);
 assert.equal(isDefensiveBarrier(createBarrier({id:'sea',kind:'natural',passable:true})),false);
});
test('inner compatible stores fill first, capture loses only local stores',()=>{
 const depots=[createDepot({id:'outer-store',compartmentId:'outer',kind:'granary',capacity:1000}),createDepot({id:'inner-store',compartmentId:'inner',kind:'granary',capacity:1000})];
 const allocated=allocateDefensiveStores(depots,[outer,inner],'food',1900);
 assert.equal(allocated.depots[1].inventory.food,1000);
 assert.equal(allocated.depots[0].inventory.food,900);
 const captured=captureCompartment('outer',[outer,inner],allocated.depots);
 assert.equal(captured.lost[0].inventory.food,900);
 assert.equal(captured.depots[1].inventory.food,1000);
});
test('civilian fallback goes to reachable adjacent safe compartment',()=>{
 const threatened={...outer,state:'threatened'};
 assert.equal(nextCivilianRefuge('outer',[threatened,inner]).compartmentId,'inner');
 assert.equal(nextCivilianRefuge('outer',[threatened,inner],()=>false),null);
});
test('skeleton delegates geometry and siege control',()=>{
 const engine=createCircleSkeleton({getFortifications:()=>[],getNaturalBarriers:()=>[],detectClosedCompartments:()=>[inner],getSiegeControl:()=> 'contested'});
 assert.equal(engine.recompute()[0].id,'inner');
 assert.equal(engine.getControl('inner'),'contested');
});
