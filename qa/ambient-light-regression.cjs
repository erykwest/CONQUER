'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'..','src','settlement-ambient-light.js'),'utf8');
const sandbox={window:{},performance:{now:()=>0}};
vm.runInNewContext(source,sandbox,{filename:'settlement-ambient-light.js'});
const light=sandbox.window.ConquerAmbientLight;
assert.ok(light&&typeof light.profileAt==='function');

const clear=light.profileAt({season:'summer',fraction:.32,night:0,weather:{kind:'clear',clouds:.1}});
const rain=light.profileAt({season:'summer',fraction:.32,night:0,weather:{kind:'rain',clouds:.82}});
const storm=light.profileAt({season:'summer',fraction:.32,night:0,weather:{kind:'storm',clouds:1}});
assert.ok(storm.weatherA>rain.weatherA&&rain.weatherA>clear.weatherA,'Rain/storm must reduce visibility more than sun');
const spring=light.profileAt({season:'spring',fraction:.32,night:0,weather:'clear'});
const autumn=light.profileAt({season:'autumn',fraction:.32,night:0,weather:'clear'});
const winter=light.profileAt({season:'winter',fraction:.32,night:0,weather:'snow'});
assert.ok(autumn.seasonR>spring.seasonR,'Autumn tint should be warmer than spring');
assert.ok(winter.seasonB>autumn.seasonB,'Winter tint should be cooler than autumn');

const dawn=light.profileAt({fraction:.04,night:0,season:'summer',weather:{kind:'clear',clouds:.1}});
const noon=light.profileAt({fraction:.33,night:0,season:'summer',weather:'clear'});
const dusk=light.profileAt({fraction:.63,night:0,season:'summer',weather:'clear'});
const night=light.profileAt({fraction:.82,night:1,season:'summer',weather:'clear'});
assert.ok(dawn.dawnA>noon.dawnA,'Warm directional light near sunrise');
assert.ok(dusk.duskA>noon.duskA,'Warm directional light near sunset');
assert.ok(night.nightA>.5&&noon.nightA===0,'Night should dim without affecting noon');

let fills=0,gradients=0;
const fakeContext={
  save(){},restore(){},fillRect(){fills++;},set fillStyle(v){this.currentFill=v;},
  createLinearGradient(){gradients++;return{addColorStop(){}}}
};
const viewport={width:1200,height:800};
light.draw(fakeContext,viewport,{fraction:.33,night:0,season:'summer',weather:'clear'},0);
assert.equal(fills,2,'Noon needs only the season and weather passes');
light.draw(fakeContext,viewport,{fraction:.82,night:1,season:'winter',weather:'snow'},16);
assert.ok(light.isTransitioning(),'Day to night must not snap');
for(let i=1;i<27;i++)light.draw(fakeContext,viewport,{fraction:.82,night:1,season:'winter',weather:'snow'},16+i*150);
assert.ok(!light.isTransitioning(),'Light should settle after the easing transition');
assert.ok(gradients>0,'Night pass should use a gradient');
console.log('ambient-light-regression: OK');
