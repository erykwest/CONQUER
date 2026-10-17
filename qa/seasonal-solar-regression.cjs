'use strict';
// Seasonal solar clock: real midnight-based sunrise/sunset times and shared
// gameplay/lighting transitions. The day length stays 48 real seconds at 1x.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const core=read('src/settlement-core.js');
const pop=read('src/settlement-population.js');
const ambience=read('src/settlement-ambient-light.js');
const calendar=read('src/settlement-app-calendar-ui.js');
const render=read('src/settlement-render.js');
const camp=read('src/settlement-camp.js');
const wolves=read('src/settlement-wolves.js');
const combat=read('src/settlement-combat.js');
const coreStart=core.indexOf('const SEASONAL_SUN_HOURS=');
const coreEnd=core.indexOf('const BATTLEMENT_SPACING',coreStart);
const popStart=pop.indexOf('function peasantVisualDay()');
const popEnd=pop.indexOf('function towerRoofRise(',popStart);
assert.ok(coreStart>0&&coreEnd>coreStart,'shared seasonal timetable must exist');
assert.ok(popStart>0&&popEnd>popStart,'shared solar functions must exist');
const state={season:'summer',seasonOverride:null,daylightOverride:null,clock:{day:3,speed:1}};
const ctx=vm.createContext({
  State:state,Math,PEASANT_VISUAL_SPEED:1,
  clamp:(n,lo,hi)=>Math.max(lo,Math.min(hi,n))
});
vm.runInContext(core.slice(coreStart,coreEnd)+pop.slice(popStart,popEnd),ctx,{filename:'solar-functions.js'});
const call=name=>vm.runInContext(name,ctx);
const checkHour=(h,night,label)=>{
  state.clock.day=3+h/24;
  assert.equal(call('solarIsNight()'),night,label+' must have correct solar state');
};
for(const [season,sunrise,sunset,darkHours] of [
  ['summer',5,21,8],
  ['winter',8,16,16],
  ['spring',6,18,12],
  ['autumn',6,18,12]
]){
  state.season=season;state.daylightOverride=null;
  const times=call('solarHours()');
  assert.equal(times.sunrise,sunrise,season+' sunrise');
  assert.equal(times.sunset,sunset,season+' sunset');
  assert.equal(24-(sunset-sunrise),darkHours,season+' hours of darkness');
  checkHour(0,true,season+' midnight');
  checkHour(sunrise-1/60,true,season+' 1 min before sunrise');
  checkHour(sunrise,false,season+' precise sunrise');
  checkHour(sunrise+1/60,false,season+' 1 min after sunrise');
  checkHour((sunrise+sunset)/2,false,season+' solar noon');
  assert.ok(call('sunShadowState()')?.arc>.9,season+' shadows follow sun at solar noon');
  checkHour(sunset-1/60,false,season+' 1 min before sunset');
  checkHour(sunset,true,season+' precise sunset');
  assert.equal(call('sunShadowState()'),null,season+' sun is gone at sunset');
  checkHour(sunset+1/60,true,season+' 1 min after sunset');
  checkHour(23.99,true,season+' late night');
  state.clock.day=3+(sunset+.5)/24;
  assert.ok(Math.abs(call('nightFactor()')-.5)<1e-9,season+' dusk fades inside first dark hour');
  state.clock.day=3+(sunrise-.5)/24;
  assert.ok(Math.abs(call('nightFactor()')-.5)<1e-9,season+' dawn brightens before sunrise');
  state.clock.day=3+.5;
  assert.equal(call('nightFactor()'),0,season+' noon is bright');
  state.clock.day=4;
  assert.equal(call('nightFactor()'),1,season+' midnight is fully dark');
}
state.season='winter';state.clock.day=3.5;
state.daylightOverride='night';
assert.equal(call('visualCycleFrac()'),0,'DEV force night moves visual time to midnight');
assert.equal(call('solarIsNight()'),true,'DEV night is fully dark in any season');
state.daylightOverride='day';
assert.equal(call('visualCycleFrac()'),.5,'DEV force day uses noon');
assert.equal(call('solarIsNight()'),false,'DEV day has full sunlight');
state.daylightOverride=null;
state.season='summer';
assert.match(combat,/function combatVisionFactor\(\)\{\s*return solarIsNight\(\)\?1\/3:1;/,
 'unit and tower vision observe the new shared solar night');
assert.match(camp,/const night=\(\)=>solarIsNight\(\)/,'encampments obey seasonal sunset');
assert.match(wolves,/const isNight=\(\)=>solarIsNight\(\)/,'wolf hostility obeys seasonal sunset');
assert.match(render,/\.\.\.solarHours\(\)/,'ambient renderer consumes shared seasonal timetable');
assert.doesNotMatch(core,/VISUAL_DAYLIGHT_RATIO=16\/24/,'no obsolete 16-hour fixed daylight constant');

const uiStart=calendar.indexOf('function solarClockLabel('),uiEnd=calendar.indexOf('function renderUI()',uiStart);
assert.ok(uiStart>=0&&uiEnd>uiStart,'clock displays HH:MM to players');
vm.runInContext(calendar.slice(uiStart,uiEnd),ctx);
for(const [hour,expected] of [[0,'00:00'],[5,'05:00'],[8,'08:00'],[12,'12:00'],[16,'16:00'],[18,'18:00'],[21,'21:00']]){
  state.clock.day=7+hour/24;
  assert.equal(call('solarClockLabel()'),expected,'display time at '+expected);
}
assert.match(calendar,/solarClockLabel\(\)/,'game calendar HUD displays solar clock');

const lighting={window:{},performance:{now:()=>0}};
vm.runInNewContext(ambience,lighting,{filename:'settlement-ambient-light.js'});
const light=lighting.window.ConquerAmbientLight;
for(const [season,sunrise,sunset] of [
  ['summer',5,21],['winter',8,16],['spring',6,18],['autumn',6,18]
]){
  const p={season,sunrise,sunset,night:0,weather:'clear'};
  const noon=light.profileAt({...p,fraction:(sunrise+sunset)/48});
  const first=light.profileAt({...p,fraction:(sunrise+.5)/24});
  const last=light.profileAt({...p,fraction:(sunset-.5)/24});
  assert.ok(first.dawnA>noon.dawnA,season+' atmospheric dawn follows sunrise');
  assert.ok(last.duskA>noon.duskA,season+' atmospheric dusk follows sunset');
  assert.equal(light.profileAt({...p,fraction:(sunrise-1)/24}).dawnA,0,
    season+' no daylight atmospheric glow before sunrise');
  assert.equal(light.profileAt({...p,fraction:(sunset+.5)/24}).duskA,0,
    season+' no daylight atmospheric glow after sunset');
}
console.log('PASS seasonal solar clock: 05–21 / 08–16 / 06–18, darkness, twilight, shadows, vision, wolves, camps and HUD');
