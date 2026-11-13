'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Civic = require('../src/settlement-civic-event-effects.js');
const Heat = require('../src/settlement-urban-heatmaps.js');
const venue = (setup, phase = 'active', civicKind) => ({
  id:'ground-1', type:'eventVenue', venue:'festivalGround', x:10, y:10,
  event:{setup,phase,...(civicKind ? {civicKind} : {})}
});
assert.equal(Civic.VERSION,1);
assert.equal(Object.keys(Civic.CATALOG).length,8);
assert.deepEqual(Object.keys(Civic.CATALOG.joust.happiness), ['1','2','3']);
assert.equal(Civic.activeEvents([venue('joust')])[0].kind,'joust');
assert.equal(Civic.activeEvents([venue('feast')]).length,0,
  'an unclassified feast cannot be assumed to be a fair or religious festival');
assert.equal(Civic.activeEvents([venue('feast','active','religious')])[0].kind,'religious');
assert.equal(Civic.activeEvents([venue('feast','active','harvest')])[0].kind,'harvest');
assert.equal(Civic.activeEvents([venue('feast','active','banquet')])[0].kind,'banquet');
assert.equal(Civic.activeEvents([venue('tourney')])[0].kind,'tourney');
assert.equal(Civic.activeEvents([venue('circus')])[0].kind,'circus');
assert.equal(Civic.activeEvents([venue('theatre')])[0].kind,'theatre');
assert.equal(Civic.activeEvents([venue('joust','preparing')]).length,0);
assert.equal(Civic.activeEvents([venue('joust','clearing')]).length,0);
assert.equal(Civic.activeEvents([venue('joust','idle')]).length,0);
assert.equal(Civic.activeEvents([venue('joust','active','religious')]).length,0);
assert.equal(Civic.activeEvents([venue('joust'),venue('joust')]).length,1,
  'duplicate venue must never contribute twice');
assert.equal(Civic.activeEvents([venue('joust'), {...venue('tourney'),id:'ground-2'}]).length,2);
assert.equal(Civic.activeEvents([{...venue('joust'),x:Infinity}]).length,0);
assert.equal(Civic.activeEvents([{...venue('joust'),w:12}]).length,0);
assert.equal(Civic.activeEvents([null,{},venue('joust','preparing')]).length,0);
assert.equal(Civic.activeEvents('not an array').length,0);
const preview = Civic.preview('joust', venue('joust','idle'));
assert.equal(preview.eligible,true);
assert.equal(preview.affordable,null,'unknown budget should not be reported as affordable');
assert.equal(preview.action,'preview-only');
assert.equal(Civic.preview('missing',venue('joust')).eligible,false);
assert.ok(Civic.preview('joust',venue('joust'),{resources:{gold:0,food:0}})
  .reasons.includes('insufficient-resources'));
assert.equal(Civic.preview('joust',venue('joust'),{resources:{gold:999,food:999}}).affordable,true);
assert.ok(Civic.preview('religious',venue('joust')).reasons.includes('venue-occupied'));
assert.ok(Civic.preview('joust',{...venue('joust'),w:10}).reasons.includes('venue-too-small'));
assert.ok(Civic.preview('joust',{...venue('joust'),venue:'stage'}).reasons.includes('incompatible-venue'));
const crowd = Civic.settlementEffects([venue('joust')]);
assert.ok(crowd.happiness[1]>0 && crowd.happiness[2]>0 && crowd.happiness[3]>0);
assert.ok(crowd.loyaltyL4>crowd.happiness[2]);
assert.equal(crowd.action,'preview-only');
assert.equal(Civic.settlementEffects([venue('joust','preparing')]).activeEvents,0);
assert.ok(Civic.settlementEffects([venue('joust')],{repeatsByKind:{joust:3}})
  .loyaltyL4 < crowd.loyaltyL4,'repeated events have diminishing returns');
assert.ok(Civic.localPrestige([venue('joust')],10,10)>0);
assert.equal(Civic.localPrestige([venue('joust')],100,100),0);
assert.equal(Civic.localPrestige([venue('joust','clearing')],10,10),0);
assert.throws(()=>Civic.localPrestige([],NaN,0),TypeError);
const unchanged = venue('joust');
const snapshot = JSON.stringify(unchanged);
const baseline = Heat.at(10,10);
const projected = Civic.heatmapAt(Heat,10,10,{venues:[unchanged]});
assert.ok(projected.prestige>baseline.prestige);
assert.ok(projected.demandL4>=baseline.demandL4);
assert.equal(projected.security,baseline.security);
assert.equal(projected.crime,baseline.crime);
assert.equal(Civic.heatmapAt(Heat,10,10).prestige,baseline.prestige);
assert.equal(Heat.BASE.prestige,.3);
assert.equal(JSON.stringify(unchanged),snapshot,'pure APIs must not mutate event venues');
const src=fs.readFileSync(require.resolve('../src/settlement-civic-event-effects.js'),'utf8');
const sandbox={window:{}};
vm.runInNewContext(src,sandbox);
assert.equal(sandbox.window.ConquerCivicEventEffects.VERSION,Civic.VERSION);
console.log('PASS civic event effects skeleton: venue contracts, 4 social effects, repetition, local prestige, heatmap bridge and UMD');
