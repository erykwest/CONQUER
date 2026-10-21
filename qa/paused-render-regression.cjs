'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(__dirname+'/../src/settlement-app-simulation.js','utf8');
const start=source.indexOf('    const animatedCutaway='),end=source.indexOf('  const shadowState=',start);
assert.ok(start>0&&end>start,'exercise the actual paused simulation render branch');
let combat=false,fire=false,siege=false,transition=false,draws=0;
const context=vm.createContext({State:{structures:[]},window:{
  ConquerCombatAnim:{active:()=>combat},ConquerFire:{needsAnimation:()=>fire},
  ConquerSiege:{needsAnimation:()=>siege},ConquerAmbientLight:{isTransitioning:()=>transition}
},structureCutaway:()=>true,draw:()=>draws++});
vm.runInContext(source.slice(0,source.indexOf('const COMPLETION_ROAD_BUDGET_MS'))+
  'let simDrawAt=0;function pausedFrame(now){'+source.slice(start,end).replace(/\s*}\s*$/,'')+'}',context);
const frame=t=>vm.runInContext(`pausedFrame(${t})`,context);
combat=true;frame(34);assert.equal(draws,1,'paused combat animates without its own RAF');
frame(40);assert.equal(draws,1,'combat alone respects the shared 30 Hz cadence');
fire=true;frame(68);assert.equal(draws,2,'simultaneous combat/fire is painted once');
vm.runInContext('requestSceneDraw();requestSceneDraw()',context);frame(69);
assert.equal(draws,3,'multiple state changes coalesce into one draw');
combat=false;fire=false;frame(200);assert.equal(draws,3,'idle pause stops scene redraws');
siege=true;frame(201);assert.equal(draws,4,'collapse animation still wakes the renderer');
siege=false;transition=true;frame(244);assert.equal(draws,5,'daylight transition still animates');
console.log('PASS paused combat, fire, collapses and requests share one render scheduler');
