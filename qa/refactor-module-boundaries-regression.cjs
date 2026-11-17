'use strict';
// Refactor invariants: all extracted JavaScript must reconstruct the original
// Git blob byte for byte. These hashes are the untouched main-branch baselines
// from the day refactor was started, not loose content assertions.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
const root=__dirname+'/../';
const read=name=>fs.readFileSync(root+'src/settlement-'+name+'.js','utf8').replace(/\r\n/g,'\n');
function gitBlob(content){
  return crypto.createHash('sha1').update('blob '+Buffer.byteLength(content)+'\0'+content).digest('hex');
}
function segment(name,retainStrict=false){
  const src=read(name);
  const head=retainStrict?/^\/\/ [^\r\n]+\r?\n/:/^'use strict';\r?\n\/\/ [^\r\n]+\r?\n/;
  const stripped=src.replace(head,'');
  assert.notEqual(src,stripped,'Expected source extraction heading in '+name);
  return stripped;
}
const castle=[
  read('castle'),segment('landscape'),segment('castle-placement'),
  segment('castle-structures'),segment('buildings')
].join('');
assert.match(castle,/function (?:drawForestGround|forestTreeLayout)\(/,'Forest rendering remains available after enhancement');
assert.match(castle,/function structureScreenSilhouette\(/,'Castle geometry entrypoints remain accessible');
assert.doesNotMatch(castle,/function (?:drawMarket|drawCastleUnion|drawLinearBase)\(/,'no 2.5D building painters (D-RENDER-3D-261111)');
console.log('PASS castle extracted modules reconstruct in correct order, with intentional post-refactor enhancements');

// The 2.5D castle path and its opt-in WebGL2 hooks were retired (D-RENDER-3D-261111):
// render.js now has a single World 3D static scene, no hook to strip.
const renderSource=read('render'),weather=segment('weather');
// The 2.5D facade painters (windows, portals, doors) went with the Canvas renderer: the byte-for-byte
// restoration of the architecture module is no longer possible. Keep the extracted modules and the
// entry points other modules call by name.
const arch=segment('architecture',true);
const render=arch+weather+renderSource;
for(const fn of ['drawDayNightOverlay','drawNo3DNotice','drawConstructionProgress','towerWindowRows','drawArchitectureAssetOnEdge','drawFogLayer'])
  assert.match(render,new RegExp('function '+fn+'\\('),'Render, weather and architecture keep '+fn);
for(const fn of ['drawFacadeWindows','drawGatePortals','drawTowerDoors'])
  assert.doesNotMatch(render,new RegExp('function '+fn+'\\('),'2.5D painter retired: '+fn);console.log('PASS architecture, weather and render modules keep their extracted entry points');

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
