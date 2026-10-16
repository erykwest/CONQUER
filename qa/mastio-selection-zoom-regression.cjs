'use strict';
// Mastio eligibility, 2D selection outline and world-scaled figure regressions.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const root=__dirname+'/../src/';
const castle=['castle','landscape','castle-placement','castle-structures','buildings'].map(part=>fs.readFileSync(root+'settlement-'+part+'.js','utf8')).join('\n');
const siege=fs.readFileSync(root+'settlement-siege.js','utf8');
const render=['architecture','weather','render'].map(part=>fs.readFileSync(root+'settlement-'+part+'.js','utf8')).join('\n');
const population=['population','population-fields','population-navigation','population-routines','population-residents','population-figures','population-garrisons'].map(part=>fs.readFileSync(root+'settlement-'+part+'.js','utf8')).join('\n');
const app=['app','app-rooms','app-input','app-persistence','app-calendar-ui','app-simulation','app-bootstrap'].map(part=>fs.readFileSync(root+'settlement-'+part+'.js','utf8')).join('\n');

const capacitySrc=castle.match(/function functionCapacity\(s\)\{[\s\S]*?\n\}/)?.[0];
const normaliseSrc=castle.match(/function normalizeFunctions\(s\)\{[^\n]*\}/)?.[0];
assert.ok(capacitySrc&&normaliseSrc,'Use actual castle room allocation');
function fixture(){
  const State={clock:{day:10},structures:[],siege:null,heraldry:{}},events=[];
  const window={__conquerAnalytics:{event:(type,data)=>events.push({type,data})}};
  const ctx=vm.createContext({
    State,window,console,Math,Number,Object,Array,Map,Set,
    towerTier:s=>s.size>=1.5?2:1,structureLevel:s=>s.level||1,
    isWoodTower:s=>s.type==='tower'&&s.material==='wood',
    woodTowerStyle:s=>s.woodStyle||'palisadeTower',
    underConstruction:s=>Number(s.construction?.completeDay)>State.clock.day,
    markDirty:()=>{},renderFunctionPanel:()=>{},draw:()=>{},status:()=>{}
  });
  vm.runInContext(capacitySrc+'\n'+normaliseSrc+'\n'+siege,ctx);
  return{State,window,events,context:ctx};
}
const wood=(id,day,style='palisadeTower')=>({
  id,type:'tower',material:'wood',woodStyle:style,shape:'square',
  level:1,size:1.5,functions:[],construction:{completeDay:day}
});
const stone=(id,day,shape='square')=>({
  id,type:'tower',material:'stone',shape,size:shape==='square'?1:undefined,
  r:shape==='round'?.5:undefined,level:1,functions:[],
  construction:{completeDay:day}
});

{
  const h=fixture();
  h.State.structures=[{id:'gate',type:'gate',construction:{completeDay:1}},wood('watch',1,'watchtower'),stone('later',9,'round'),wood('first',5)];
  assert.equal(h.window.ConquerSiege.syncAutoMastio(),true);
  assert.equal(h.State.structures.find(s=>s.isMastio).id,'first','earliest eligible completed tower becomes mastio');
  assert.equal(h.window.ConquerSiege.mastio().id,'first','first T1 wooden keep supports the actual Common Hall');
  assert.deepEqual(Array.from(h.State.structures.find(s=>s.id==='first').functions),['commonHall']);
  assert.equal(h.window.ConquerSiege.syncAutoMastio(),false,'do not re-promote an already selected keep');
  assert.equal(h.events.filter(e=>e.type==='MASTIO_AUTO_DESIGNATED').length,1);
  console.log('PASS first eligible wooden tower automatically becomes keep, excluding gate and watchtower');
}
{
  const h=fixture();h.State.structures=[stone('square',3),stone('round',2,'round')];
  h.window.ConquerSiege.syncAutoMastio();
  assert.equal(h.window.ConquerSiege.mastio().id,'round');
  assert.equal(h.window.ConquerSiege.mastio().functions[0],'commonHall');
  console.log('PASS independent stone round or square towers can be designated at T1');
}
{
  const h=fixture();h.State.structures=[wood('unfinished',12),stone('ready',9)];
  h.window.ConquerSiege.syncAutoMastio();
  assert.equal(h.window.ConquerSiege.mastio().id,'ready');
  console.log('PASS only completed towers qualify');
}
{
  const h=fixture();const first=stone('first',2),manual=stone('manual',8);manual.isMastio=true;manual.functions=['commonHall'];
  h.State.structures=[first,manual];h.window.ConquerSiege.normalizeMastio();
  assert.equal(h.window.ConquerSiege.syncAutoMastio(),false);
  assert.equal(h.window.ConquerSiege.mastio().id,'manual','existing keep is preserved');
  console.log('PASS saved/manual mastio remains selected');
}

// Actual selection routine works on houses and wooden towers, not only
// expensive castle-union structures, without a permanent cache redraw.
const selector=castle.slice(castle.indexOf('function drawCastleSelection(){'),castle.indexOf('\nfunction worldDepth(s){'));
assert.ok(selector.startsWith('function drawCastleSelection'));
let strokes=0;
const context=vm.createContext({
  State:{selectedId:'h',structures:[{id:'h',type:'house'}]},
  ctx:{save(){},restore(){},setLineDash(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},stroke(){strokes++}},
  withStructureGroundPlane:(s,fn)=>fn(),
  isCivic:()=>false,
  urbanHouseDisplayParts:()=>[{points:[{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}],bodyH:2}],
  houseBodyHeight:()=>2,projectPath:(pts,z)=>pts,underConstruction:()=>false,
  structureHeight:()=>2,footprintPoints:()=>[{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}],
  fieldPoints:()=>[],constructionProgress:()=>1,
});
vm.runInContext(selector,context);
vm.runInContext('drawCastleSelection()',context);
assert.ok(strokes>=2,'a house receives a complete keyline and gold outline');
const houseStrokes=strokes;
context.State.selectedId='w';context.State.structures=[{id:'w',type:'tower',material:'wood'}];
vm.runInContext('drawCastleSelection()',context);
assert.ok(strokes>houseStrokes,'timber towers also receive the selection outline');
context.State.structures=[{id:'w',type:'road'}];
const before=strokes;vm.runInContext('drawCastleSelection()',context);assert.equal(strokes,before);
console.log('PASS visual outline on houses and wood towers, not a permanent road highlight');

assert.match(population,/const base=w2s\(dot\.p,\.10\),scale=State\.view\.scale\*\.5/);
assert.match(population,/function militaryScale\(\)\{[\s\S]*?return State\.view\.scale\*\.5;/);
assert.match(render,/const ww=2\.1\*State\.view\.scale,wh=3\.25\*State\.view\.scale;/);
assert.match(castle,/const ww=1\.75\*State\.view\.scale,wh=2\.8\*State\.view\.scale;/);
console.log('PASS civilians, troops and windows zoom with full world projection');

assert.match(render,/function drawMastioWindowDrape\(/);
// The drape needs a mastio and a facade edge; an opened (cutaway) keep shows none.
assert.match(render,/if\(!s\.isMastio\|\|!edge(\|\|structureCutaway\(s\))?\)return/);
assert.match(render,/s\.isMastio\)rows\.push\(\{floor:1,z:1\.53\}\)/);
assert.match(render,/if\(!lit\)drawMastioWindowDrape\(s,edge/);
assert.match(render,/if\(!lit\)drawMastioWindowDrape\(s,edge,row\.z/);
assert.ok(!/strokeText\('★'/.test(siege),'old star marker is removed');
assert.match(app,/syncAutoMastio\?\.\(\)/);
console.log('PASS internal heraldic window drapes, T1 keep window, no star');
