'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const C = require('../crime/engine.js');

const root = path.resolve(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'crime/index.html'), 'utf8');
const ui = fs.readFileSync(path.join(root, 'crime/ui.js'), 'utf8');
assert.match(page, /Skeleton V0/);
assert.match(page, /TEST LOCALE/);
assert.match(page, /engine\.js/);
assert.match(page, /ui\.js/);
assert.match(ui, /C\.advance\(state, 7\)/);
assert.match(ui, /C\.setFacility/);
assert.ok(!/src\/settlement-app\.js/.test(page), 'lab must not load the production game');

const initial = C.initial();
assert.ok(C.valid(initial));
assert.equal(initial.day, 1);
assert.equal(initial.phase, 'calm');
assert.equal(initial.history.length, 1);
assert.deepEqual(C.PHASES, ['calm','discontent','protest','riot','revolt']);
assert.equal(C.advance(initial, 0), false);
assert.equal(C.advance(initial, 31), false);
assert.equal(C.advance(initial, 1.5), false);
assert.equal(C.setPolicy(initial, 'tax', 101), false);
assert.equal(C.setPolicy(initial, 'severity', 3), false);
assert.equal(C.setPolicy(initial, '__proto__', 1), false);
assert.equal(C.setFacility(initial, 'not_a_building', true), false);

const crisis = C.initial();
const copy = C.initial();
C.scenario(crisis, 'crisis');
C.scenario(copy, 'crisis');
assert.equal(C.advance(crisis, 25), true);
assert.equal(C.advance(copy, 25), true);
assert.deepEqual(crisis, copy, 'simulation must be deterministic');
assert.equal(crisis.phase, 'revolt', 'severe deprivation must allow revolt');
assert.equal(crisis.day, 26);
assert.ok(crisis.log.some(x => /Malcontento/.test(x)));
assert.ok(crisis.log.some(x => /protesta/.test(x)));
assert.ok(crisis.log.some(x => /Sommossa/.test(x)));
assert.ok(crisis.log.some(x => /Rivolta/.test(x)));
const crisisTension = crisis.metrics.tension;
const crisisOrder = crisis.metrics.order;
C.scenario(crisis, 'stabilize');
C.advance(crisis, 30);
assert.ok(crisis.metrics.tension < crisisTension, 'aid must de-escalate social tension');
assert.ok(crisis.metrics.order > crisisOrder, 'sustained patrols and relief must restore order');
assert.notEqual(crisis.phase, 'revolt', 'revolt is not permanently sticky');
assert.ok(C.valid(crisis));

const control = C.initial(), relief = C.initial();
assert.equal(C.setFacility(relief, 'almshouse', true), true);
C.advance(control, 25);
C.advance(relief, 25);
assert.ok(relief.metrics.tension < control.metrics.tension, 'almshouse reduces social distress');

const mild = C.initial(), harsh = C.initial();
C.setFacility(harsh, 'pillory', true);
C.setFacility(harsh, 'gallows', true);
C.advance(mild, 15); C.advance(harsh, 15);
assert.ok(harsh.metrics.crime < mild.metrics.crime, 'punitive structures deter some crime');
assert.ok(harsh.metrics.tension > mild.metrics.tension, 'repression creates social backlash');
// The scaffold is its own structure, harsher than the gallows on both counts.
const gal = C.initial(), sca = C.initial();
assert.equal(C.setFacility(gal, 'gallows', true), true);
assert.equal(C.setFacility(sca, 'scaffold', true), true);
C.advance(gal, 10); C.advance(sca, 10);
assert.ok(sca.metrics.crime < gal.metrics.crime && sca.metrics.tension > gal.metrics.tension, 'scaffold: more deterrence, more backlash');
{
  // A save from before the split loads with the scaffold off.
  const old = C.initial(); delete old.facilities.scaffold;
  const st = new Map([[C.KEY, JSON.stringify(old)]]);
  const back = C.load({getItem: k => st.get(k)});
  assert.equal(back.facilities.scaffold, false); assert.equal(back.day, old.day);
}

const prison = C.initial();
C.advance(prison, 10);
assert.ok(prison.detained > 0);
assert.equal(C.setFacility(prison, 'prison', false), false, 'cannot remove an occupied prison');
assert.equal(C.setFacility(C.initial(), 'prison', false), true);

const store = new Map();
const storage = {getItem: key => store.get(key), setItem: (key, value) => store.set(key, value)};
assert.equal(C.save(crisis, storage), true);
assert.equal(store.has(C.KEY), true);
const loaded = C.load(storage);
assert.deepEqual(loaded, crisis);
store.set(C.KEY, '{"version":99}');
assert.equal(C.load(storage).day, 1, 'unsupported schemas do not corrupt saves');
assert.equal(C.save({...crisis, metrics: {crime: NaN, order: 10, tension: 10}}, storage), false);
const rolling = C.initial();
C.advance(rolling, 30); C.advance(rolling, 30); C.advance(rolling, 30);
assert.equal(rolling.history.length, 60);
assert.ok(rolling.log.length <= 48);
assert.ok(C.valid(rolling));
console.log('CRIME skeleton: fixture isolation, policies, staged revolts, relief, deterrence, detention, persistence PASS');
