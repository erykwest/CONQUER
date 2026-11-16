'use strict';
// Autumn foliage must evolve with the civil calendar, stay reproducible across
// saves and preserve the static WebGL tree atlas while daily UV selections change.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const root=__dirname+'/..';
const landscape=fs.readFileSync(root+'/src/settlement-landscape.js','utf8');
const calendar=fs.readFileSync(root+'/src/settlement-app-calendar-ui.js','utf8');
const world3d=fs.readFileSync(root+'/src/settlement-world3d.js','utf8');
const index=fs.readFileSync(root+'/index.html','utf8');
for(const source of [landscape,calendar,world3d])new vm.Script(source);
const between=(s,a,b)=>{const i=s.indexOf(a),j=s.indexOf(b,i);assert.ok(i>=0&&j>i,'expected source block '+a);return s.slice(i,j)};
const invalidated=[];
const State={seed:12345,season:'autumn',seasonOverride:null,clock:{day:92}};
const ctx=vm.createContext({
  State,Math,
  document:{querySelectorAll:()=>[]},
  invalidateSceneCache:layer=>invalidated.push(layer)
});
vm.runInContext(between(calendar,'const CALENDAR_MONTHS=','function syncDevButtons('),ctx);
vm.runInContext(between(landscape,'const FOREST_CANOPY_PALETTES=','function buildForestSvg('),ctx);
const evalJs=code=>vm.runInContext(code,ctx);
const trees=Array.from({length:64},(_,i)=>({p:{x:i*3.11+12.3,y:i*9.23+25.5},colorIndex:i%5,shapeIndex:i%7}));
const sample=day=>{State.clock.day=day;return trees.map(t=>evalJs('autumnFoliageStage('+JSON.stringify(t)+')'))};
const mean=v=>v.reduce((a,b)=>a+b,0)/v.length;
assert.equal(evalJs('autumnFoliageStep()'),0,'Sep 1 begins green');
const green=sample(92),september=sample(110),october=sample(138),red=sample(170),brown=sample(182);
assert.equal(evalJs('autumnFoliageStep()'),90,'Nov 30 is the last autumn day');
assert.ok(mean(green)<.5,'early autumn remains mostly summer green');
assert.ok(mean(green)<mean(september)&&mean(september)<mean(october)&&mean(october)<mean(red)&&mean(red)<mean(brown),
  'autumn canopy warms progressively over September through November');
assert.ok(new Set(october).size>=3,'individual tree timing varies inside one forest');
for(let i=0;i<trees.length;i++)assert.ok(green[i]<=september[i]&&september[i]<=october[i]&&october[i]<=red[i]&&red[i]<=brown[i],
  'a single tree never reverses its foliage colour');
assert.ok(brown.some(x=>x===6),'brown is reached by the end of November');
assert.ok(red.some(x=>x===5),'red is visible before the brown finale');
State.clock.day=92;
evalJs('syncSeasonToCalendar()');
assert.equal(invalidated.length,1,'first foliage signature dirties raster cache');
assert.equal(JSON.stringify(invalidated[0]),'["landscape","base"]','forest and urban trees both refresh');
evalJs('syncSeasonToCalendar()');
assert.equal(invalidated.length,1,'no unnecessary re-render within a day');
State.clock.day=93;evalJs('syncSeasonToCalendar()');
assert.equal(invalidated.length,2,'the next autumn day refreshes the tree colours');
State.clock.day=0;State.seasonOverride='autumn';State.season='autumn';
assert.equal(evalJs('autumnFoliageStep()'),45,'DEV forced autumn outside Sep-Nov previews mid-autumn');
State.seasonOverride=null;evalJs('syncSeasonToCalendar()');
assert.equal(State.season,'summer','DEV override returns to the civil season');
assert.equal(evalJs('autumnFoliageStep()'),-1,'non-autumn foliage progression is inactive');
assert.match(landscape,/forestTreeSprites\[season==='autumn'\?'summer':season\]/,
  'autumn stage zero reuses exact summer greens');
assert.match(landscape,/makeSprite\('winter',shape,0,buildForestSvg\(sources\[shape\],null,false\)\)/,
  'winter remains leafless');
assert.match(world3d,/const atlasSig=\[season,forestTreeSpritesReady/,
  'atlas signature does not depend on each autumn day');
assert.match(world3d,/const treeSig=\[atlasSig,season==='autumn'\?autumnFoliageStep\(\):-1/,
  'daily foliage step refreshes only 3D tree UV geometry');
assert.match(index,/settlement-landscape\.js\?v=[^"]+-autumn1/,'landscape cache is versioned');
assert.match(index,/settlement-world3d\.js\?v=[^"]+-autumn1/,'3D renderer cache is versioned');
assert.match(index,/settlement-app-calendar-ui\.js\?v=[^"]+-autumn1/,'calendar cache is versioned');
console.log('PASS: 91-day autumn foliage, staggered deterministic trees, DEV override, Canvas/WebGL2 caches and winter');
