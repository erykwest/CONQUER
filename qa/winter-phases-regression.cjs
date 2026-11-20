'use strict';
// Winter look: four quarters (bare / snow / snow / thaw) and the blizzard on any snowy winter day.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const src=fs.readFileSync(__dirname+'/../src/settlement-core.js','utf8');
const start=src.indexOf('// ---------- Winter look ----------');
assert.ok(start>0,'winter look helpers must live in settlement-core.js');
const end=src.indexOf('// Blizzard sprites:',start);
const State={season:'winter',winterPhaseOverride:null};
let weather='sun',date={month:11,day:1};
const ctx=vm.createContext({State,Math,
  currentWeather:()=>({kind:weather}),
  calendarDateFromDay:()=>date});
vm.runInContext(src.slice(start,end),ctx);
const at=(month,day)=>{date={month,day};return ctx.winterPhase()};

assert.equal(at(11,1),'bare','1 December: bare woods, brown undergrowth');
assert.equal(at(11,22),'bare','22 December: still the first quarter');
assert.equal(at(11,24),'snow','24 December: second quarter, snow on the ground');
assert.equal(at(0,20),'snow','20 January: third quarter');
assert.equal(at(1,10),'thaw','10 February: fourth quarter, no snow');
assert.equal(at(1,28),'thaw','28 February: last day of winter');
assert.equal(ctx.undergrowthLook(),'green','thaw undergrowth is green');
date={month:11,day:3};
assert.equal(ctx.undergrowthLook(),'brown','early-winter undergrowth is brown');
assert.equal(ctx.isSnowGround(),false,'no snow on the ground in the first quarter');
assert.equal(ctx.foliageLook(),'bare','leafless without snow');

weather='snow';
for(const [m,d] of [[11,1],[0,10],[1,25]]){
  assert.equal(at(m,d),'blizzard','snow weather on any winter day is a blizzard');
  assert.equal(ctx.isSnowGround(),true,'a blizzard puts snow on the ground');
  assert.equal(ctx.foliageLook(),'blizzard','blizzard foliage set');
}
weather='sun';

date={month:6,day:1};
assert.equal(ctx.winterPhase(),'snow','DEV-forced winter outside Dec-Feb keeps the classic snowy look');
State.season='summer';
assert.equal(ctx.winterPhase(),null,'no winter phase outside winter');
assert.equal(ctx.isSnowGround(),false);
assert.equal(ctx.foliageLook(),'summer');
State.season='autumn';assert.equal(ctx.foliageLook(),'autumn');
State.season='winter';State.winterPhaseOverride='thaw';
assert.equal(ctx.winterPhase(),'thaw','the override wins over calendar and weather');
console.log('winter-phases-regression: PASS');
