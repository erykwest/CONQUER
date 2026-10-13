'use strict';
// Exercise the actual clock-advance statement, not a duplicate formula.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const core=fs.readFileSync(__dirname+'/../src/settlement-core.js','utf8');
const app=fs.readFileSync(__dirname+'/../src/settlement-app.js','utf8');
const html=fs.readFileSync(__dirname+'/../index.html','utf8');

const literal=core.match(/const BASE_DAYS_PER_SECOND=([^;]+);/);
assert.ok(literal,'shared calendar speed constant must exist');
const rate=Function('return ('+literal[1]+')')();
assert.ok(Math.abs(rate-1/48)<1e-15,'one day must equal 48 real seconds at 1x');

const statement=app.match(/State\.clock\.day\s*\+=\s*dt\s*\*\s*BASE_DAYS_PER_SECOND\s*\*\s*State\.clock\.speed\s*;/);
assert.ok(statement,'the runtime must advance the calendar from shared rate and speed');
const advance=Function('State','dt','BASE_DAYS_PER_SECOND',statement[0]);
assert.match(app,/const dt=Math\.min\(\.25,rawDtMs\/1000\)/,'frame delta remains bounded');

for(const [speed,seconds] of [[1,48],[3,16],[10,4.8]]){
  const State={clock:{day:24.5,speed}};
  const intervals=Math.round(seconds/.1);
  for(let i=0;i<intervals;i++)advance(State,.1,rate);
  assert.ok(Math.abs(State.clock.day-25.5)<1e-10,
    speed+'x must advance exactly one game day in '+seconds+' seconds');
  console.log('PASS '+speed+'x: '+seconds+' real seconds per simulated day');
}
const paused={clock:{day:9.75,speed:0}};
advance(paused,.25,rate);
assert.equal(paused.clock.day,9.75,'pause must not advance calendar time');

assert.match(app,/window\.ConquerSiege\?\.tick\(previousDay,State\.clock\.day\)/);
assert.match(app,/tickFields\(State\.clock\.day\)/);
assert.match(app,/window\.ConquerEconomy\?\.tick\(previousDay,State\.clock\.day\)/);
assert.match(app,/syncSeasonToCalendar\(\)/);
for(const [speed,seconds] of [[1,48],[3,16],[10,4.8]]){
  assert.ok(html.includes('data-speed="'+speed+'" title="'+speed+'× · '+seconds+' seconds per day"'),
    'visible control must document '+speed+'x actual day duration');
}
console.log('PASS pause, common settlement calendar, economic and seasonal consumers');
const population=fs.readFileSync(__dirname+'/../src/settlement-population.js','utf8');
const visualRateLiteral=core.match(/const PEASANT_VISUAL_SPEED=([^;]+);/);
assert.ok(visualRateLiteral,'visual day scaling must remain declared');
const visualRate=Function('return ('+visualRateLiteral[1]+')')();
assert.equal(visualRate,1,'visual day and simulated calendar day must be synchronized');

const visualStart=population.indexOf('function peasantVisualDay()');
const visualEnd=population.indexOf('function nightFactor()',visualStart);
assert.ok(visualStart>=0&&visualEnd>visualStart);
const visualFns=population.slice(visualStart,visualEnd);
const visualFraction=Function('State','PEASANT_VISUAL_SPEED','VISUAL_DAYLIGHT_RATIO',
  visualFns+';return visualCycleFrac();');
for(const fraction of [.125,.5,.6666,.875]){
  assert.ok(Math.abs(visualFraction({clock:{day:5+fraction},daylightOverride:null},
    visualRate,16/24)-fraction)<1e-12,'daylight phase must track calendar fraction '+fraction);
}
assert.ok(Math.abs(visualFraction({clock:{day:5.875},daylightOverride:'day'},
  visualRate,16/24)-1/3)<1e-12,'DEV forced day must override procedural sun');
assert.ok(Math.abs(visualFraction({clock:{day:5.125},daylightOverride:'night'},
  visualRate,16/24)-5/6)<1e-12,'DEV forced night must remain functional');
console.log('PASS villager routine day and procedural day/night phases are calendar-synchronized');

