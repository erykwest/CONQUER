import test from 'node:test';
import assert from 'node:assert/strict';
import { eligibleForWorkshop, proposeWorkshops, updateWorkshop, chooseWorkshopType } from './urbanEconomy.js';
test('only accessible L3 street houses qualify', () => {
  assert.equal(eligibleForWorkshop({id:1, level:3}), true);
  assert.equal(eligibleForWorkshop({id:1, level:2}), false);
  assert.equal(eligibleForWorkshop({id:1, level:3, streetFacing:false}), false);
});
test('one artisan and workshop per eligible house', () => {
  const result = proposeWorkshops({houses:[{id:1,level:3},{id:2,level:3}],artisans:[{id:7,tier:3}],random:()=>0});
  assert.equal(result.length,1);
  assert.equal(result[0].houseId,1);
});
test('closed at night and sells when visited', () => {
  const w={revenue:0,state:'closed'};
  assert.equal(updateWorkshop(w,{hour:23}).state,'closed');
  assert.equal(updateWorkshop(w,{hour:12,visitors:2}).state,'selling');
});
test('no demand produces no workshop', () => {
  assert.equal(chooseWorkshopType({demand:{clothing:0,tools:0,household:0,luxury:0}}),null);
});
