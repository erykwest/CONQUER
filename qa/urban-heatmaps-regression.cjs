'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Heat = require('../src/settlement-urban-heatmaps.js');
const epsilon = 1e-6;
const approx = (a, b) => assert.ok(Math.abs(a - b) < epsilon, `${a} != ${b}`);
assert.deepEqual(Heat.CHANNELS, ['demandL1', 'demandL2', 'demandL3', 'demandL4',
  'prestige', 'security', 'crime']);
assert.deepEqual(Heat.TIERS, [1, 2, 3, 4]);
const baseline = Heat.at(10, 10);
const plaza = Heat.at(10, 10, [{kind: 'plaza', x: 10, y: 10, radius: 8}]);
assert.ok(plaza.prestige > baseline.prestige);
assert.ok(plaza.demandL3 > baseline.demandL3);
const industry = Heat.at(10, 10, [{kind: 'industry', x: 10, y: 10, radius: 8}]);
assert.ok(industry.prestige < baseline.prestige);
assert.ok(industry.demandL1 > baseline.demandL1);
const crime = Heat.at(10, 10, [{kind: 'crimeEvent', x: 10, y: 10, radius: 8}]);
assert.ok(crime.crime > baseline.crime);
assert.ok(crime.demandL3 < baseline.demandL3);
const guard = Heat.at(10, 10, [{kind: 'guard', x: 10, y: 10, radius: 8}]);
assert.ok(guard.security > baseline.security);
assert.ok(guard.demandL1 > baseline.demandL1);
const protectedZone = {kind: 'protected', polygon: [
  {x: 0, y: 0}, {x: 20, y: 0}, {x: 20, y: 20}, {x: 0, y: 20}]};
assert.ok(Heat.at(10, 10, [protectedZone]).security >
  Heat.at(21, 10, [protectedZone]).security);
const stamp = {kind: 'market', x: 10, y: 10, radius: 8};
approx(Heat.at(10, 10, [stamp]).prestige, Heat.at(10, 10, [stamp]).prestige);
approx(Heat.at(100, 100, [stamp]).prestige, baseline.prestige);
const grid = Heat.createGrid({originX: 0, originY: 0, width: 8, height: 8,
  cellSize: 4, sources: [{kind: 'market', x: 10, y: 10, radius: 12}]});
assert.equal(Object.keys(grid.values).length, 7);
assert.equal(grid.values.prestige.length, 64);
const near = Heat.sample(grid, 10, 10);
const far = Heat.sample(grid, 30, 30);
assert.ok(near.demandL3 > far.demandL3);
const lot = {id: 'lot:home', points: [
  {x: 8, y: 8}, {x: 12, y: 8}, {x: 12, y: 12}, {x: 8, y: 12}]};
const score = Heat.sampleLot(grid, lot);
assert.ok(score.demandL3 > far.demandL3);
const noPopulation = Heat.evaluateLot(grid, lot);
assert.equal(noPopulation.desiredTier, null);
assert.equal(noPopulation.targetDensity, 1);
const desired = Heat.evaluateLot(grid, lot, {waiting: {3: 100}, available: {3: 0}});
assert.equal(desired.desiredTier, 3);
assert.equal(desired.action, 'preview-only');
assert.ok(desired.effectiveDemand[3] > 0);
assert.equal(Heat.sampleLot(grid, {points: []}), null);
assert.throws(() => Heat.createGrid({width: 0}), RangeError);
assert.throws(() => Heat.createGrid({cellSize: 0}), RangeError);
assert.throws(() => Heat.createGrid({width: 512, height: 512}), RangeError);
const source = fs.readFileSync(require.resolve('../src/settlement-urban-heatmaps.js'), 'utf8');
const sandbox = {window: {}};
vm.runInNewContext(source, sandbox);
assert.ok(sandbox.window.ConquerUrbanHeatmaps);
assert.equal(sandbox.window.ConquerUrbanHeatmaps.VERSION, Heat.VERSION);
console.log('PASS urban heatmap skeleton: 7 channels, landmarks, territory, grid, lots and UMD');
