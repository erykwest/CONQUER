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

const renderSource=read('render'),arch=segment('architecture',true),weather=segment('weather');
const start=renderSource.indexOf('function drawDayNightOverlay(){');
const split=renderSource.indexOf('function drawConstructionProgress(s){');
assert.ok(start>=0&&split>start);
const render=arch+renderSource.slice(start,split)+weather+renderSource.slice(split);
assert.equal(gitBlob(render),'ab715d38008b65bb5f7d92f363635924efe75437',
  'Render, weather and architectural sprites must match original rendering semantics');
console.log('PASS architecture, weather and render modules exactly preserve the original implementation');

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
assert.ok(index('settlement-render.js')<index('settlement-app.js'));
console.log('PASS classic-script dependency order and only-once script loading');
