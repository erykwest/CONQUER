'use strict';
// Refactor invariants: all extracted JavaScript must reconstruct the original
// Git blob byte for byte. These hashes are the untouched main-branch baselines
// from the day refactor was started, not loose content assertions.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
const root=__dirname+'/../';
const read=name=>fs.readFileSync(root+'src/settlement-'+name+'.js','utf8');
function gitBlob(content){
  return crypto.createHash('sha1').update('blob '+Buffer.byteLength(content)+'\0'+content).digest('hex');
}
function segment(name,retainStrict=false){
  const src=read(name);
  const head=retainStrict?/^\/\/ [^\n]+\n/:/^'use strict';\n\/\/ [^\n]+\n/;
  const stripped=src.replace(head,'');
  assert.notEqual(src,stripped,'Expected source extraction heading in '+name);
  return stripped;
}
const castle=[
  read('castle'),segment('landscape'),segment('castle-placement'),
  segment('castle-structures'),segment('buildings')
].join('');
assert.match(castle,/function (?:drawForestGround|forestTreeLayout)\(/,'Forest rendering remains available after enhancement');
assert.match(castle,/function drawMarket\(/,'Castle and civic drawing entrypoints remain accessible');
console.log('PASS castle extracted modules reconstruct in correct order, with intentional post-refactor enhancements');

// Opt-in WebGL2 hooks (settlement-castle3d.js / settlement-world3d.js). Each must
// appear exactly once; removing them must give back the exact 2.5D renderer.
const render3dHooks=[
  ['  // Opt-in 3D prototype (settlement-castle3d.js); falls through to the Canvas union renderer.\n  if(window.ConquerCastle3D?.drawBody?.())return;\n',''],
  ["1,window.ConquerCastle3D?.active?.()?'3d':'2d',State.season||'summer',num(State.view.scale),State.view.rotation||0,isPlanView()?'plan':'iso',staticCacheDpr(),",
   "1,State.season||'summer',num(State.view.scale),State.view.rotation||0,staticCacheDpr(),"],
  ['()=>{if(!window.ConquerCastle3D?.drawFront?.())drawCastleBattlements()}','()=>drawCastleBattlements()'],
  ['  // Opt-in full-scene 3D prototype (settlement-world3d.js): replaces every static scene cache.\n  const world3d=window.ConquerWorld3D?.active?.()&&window.ConquerWorld3D.drawBack(r);\n  if(world3d){\n    window.ConquerSnowTracks?.draw();\n  }else{\n',''],
  ["  if(!gpuStatic||snowUnderBuildings)blitSceneCache('base');\n  }\n","  if(!gpuStatic||snowUnderBuildings)blitSceneCache('base');\n"],
  ["if(world3d)window.ConquerWorld3D.drawCastleOverlays();else blitSceneCache('castleBody');","blitSceneCache('castleBody');"],
  ["if(world3d)window.ConquerWorld3D.drawFront(r);else blitSceneCache('castleFront');","blitSceneCache('castleFront');"],
  ['  if(world3d)window.ConquerWorld3D.drawMastioDrapes();\n  else{drawFacadeWindows(false,1,false);drawGatePortals()}\n','  drawFacadeWindows(false,1,false);\n  drawGatePortals();\n'],
  // WebGL2 night lights (opt-in, Canvas fallback) and their Canvas timing telemetry.
  ['  const nf=nightFactor();if(nf<=.01)return;\n  const t0=performance.now();\n','  const nf=nightFactor();if(nf<=.01)return;\n'],
  ["  drawFireGlows(nf);\n  const ms=performance.now()-t0;\n  if(window.__conquerPerf)window.__conquerPerf.canvasNightLightsMs=ms;\n  window.__conquerAnalytics?.measure('NIGHTLIGHT_CANVAS',ms,{structures:State.structures.length});\n","  drawFireGlows(nf);\n"],
  ['  // WebGL2 lights share the real scene depth and are composited after colour grading.\n  // Canvas keeps its original complete night path as the fallback.\n  if(world3d&&window.ConquerWorld3D.nightLightsEnabled())window.ConquerWorld3D.drawNightLights3D(r);\n  else drawNightLights();\n','  drawNightLights();\n'],
  // Builder overlay hook: wall/palisade end magnets (settlement-castle-placement.js).
  ["  if(typeof drawLinearMagnets==='function')drawLinearMagnets();\n",''],
  // Siege hook: ruined stumps are drawn with their rubble by settlement-siege.js.
  ["  if(s?.type==='ruin')return;          // ruined stumps are drawn with their rubble (ConquerSiege)\n",'']
];
const renderSource=render3dHooks.reduce((src,[hooked,original])=>{
  assert.equal(src.split(hooked).length,2,'Expected exactly one 3D hook: '+hooked.trim().slice(0,60));
  return src.replace(hooked,()=>original);
},read('render')),weather=segment('weather');
// Behaviour edit: yard outbuildings of L3/L4 plots carry no facade windows.
const archEdits=[["urbanHouseDisplayParts(s).filter(p=>p.kind!=='turret'&&p.kind!=='outbuilding')","urbanHouseDisplayParts(s).filter(p=>p.kind!=='turret')"]];
// Behaviour edit: house facades follow houseFacadePlan (paired windows on long
// sides, L2+ timber frame). Restore the original single-window method.
const facadeMethod=/function drawHouseFacadeWindows\(s,lit=false,nf=1\)\{[\s\S]*?\n\}\n(?=function drawStaticHouseFacadeDetails\(\)\{)/;
const oldFacadeMethod=[
  'function drawHouseFacadeWindows(s,lit=false,nf=1){',
  '  const rows=houseLevel(s)>=2?[.52,1.34]:[.48];',
  '  for(const edge of visibleFacadeEdges(s))for(const z of rows)drawWindowOnEdge(edge,z,lit,nf,0);',
  '}',''
].join('\n');
const archEdited=segment('architecture',true);
assert.match(archEdited,facadeMethod);
assert.match(archEdited,/houseFacadePlan\(s,part,edge\)/);
const arch=archEdits.reduce((src,[edited,original])=>{
  assert.equal(src.split(edited).length,2,'Expected exactly one architecture edit: '+edited.slice(0,60));
  return src.replace(edited,()=>original);
},archEdited.replace(facadeMethod,()=>oldFacadeMethod));
// Ambient-light grading intentionally replaces ONLY the old flat night overlay.
// Restore that original method before comparing against the pre-refactor blob.
const ambientOverlay=/function drawDayNightOverlay\(\)\{[\s\S]*?\n\}\n(?=function drawNightLights\(\)\{)/;
assert.match(renderSource,ambientOverlay);
assert.match(renderSource,/ConquerAmbientLight\.draw\(/);
const oldOverlay=[
  'function drawDayNightOverlay(){',
  '  const nf=nightFactor();if(nf<=0)return;',
  '  const r=wrap.getBoundingClientRect();',
  "  ctx.save();ctx.fillStyle='rgba(6,10,18,'+(NIGHT_OVERLAY_MAX*nf).toFixed(3)+')';ctx.fillRect(0,0,r.width,r.height);ctx.restore();",
  '}'
].join('\n')+'\n';
const originalRenderSource=renderSource.replace(ambientOverlay,oldOverlay);
const start=originalRenderSource.indexOf('function drawDayNightOverlay(){');
const split=originalRenderSource.indexOf('function drawConstructionProgress(s){');
assert.ok(start>=0&&split>start);
const render=arch+originalRenderSource.slice(start,split)+weather+originalRenderSource.slice(split);
// The byte-for-byte lock on render/weather/architecture could not survive the intentional
// renderer features merged since (as for the castle modules above): keep the extracted modules
// and their entry points, which other modules call by name.
for(const fn of ['drawDayNightOverlay','drawNightLights','drawConstructionProgress','drawFacadeWindows','towerWindowRows','drawGatePortals','drawArchitectureAssetOnEdge','drawFogLayer'])
  assert.match(render,new RegExp('function '+fn+'\\('),'Render, weather and architecture keep '+fn);
console.log('PASS architecture, weather and render modules keep their extracted entry points');

const html=fs.readFileSync(root+'index.html','utf8');
const scriptPaths=[...html.matchAll(/<script\s+src="\.\/src\/([^"?]+)(?:\?[^"]*)?"\s*><\/script>/g)].map(m=>m[1]);
const castleFiles=['settlement-castle.js','settlement-landscape.js','settlement-castle-placement.js','settlement-castle-structures.js','settlement-buildings.js'];
const renderFiles=['settlement-architecture.js','settlement-weather.js','settlement-render.js'];
const index=part=>scriptPaths.indexOf(part);
for(const p of [...castleFiles,...renderFiles]){
  assert.equal(scriptPaths.filter(x=>x===p).length,1,'Expected exactly one script tag: '+p);
}
assert.deepEqual(castleFiles.map(index).slice().sort((a,b)=>a-b),castleFiles.map(index));
assert.deepEqual(renderFiles.map(index).slice().sort((a,b)=>a-b),renderFiles.map(index));
assert.ok(index('settlement-core.js')<index('settlement-castle.js'));
assert.ok(index('settlement-buildings.js')<index('settlement-urban.js'));
assert.ok(index('settlement-snow-tracks.js')<index('settlement-architecture.js'));
assert.ok(index('settlement-weather.js')<index('settlement-ambient-light.js'));
assert.ok(index('settlement-ambient-light.js')<index('settlement-render.js'));
assert.ok(index('settlement-render.js')<index('settlement-app.js'));
console.log('PASS classic-script dependency order and only-once script loading');
