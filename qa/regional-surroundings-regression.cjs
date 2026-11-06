'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const rules=require('../src/regional-biome-rules.js');
const cells=[];for(let y=0;y<3;y++)for(let x=0;x<3;x++)cells.push({id:y*3+x,code:String(y*3+x),terrain:['plain','forest','hills','sea','swamp','lake'][((y*3+x)%6)],centroid:{x:x+.5,y:y+.5},polygon:[{x,y},{x:x+1,y},{x:x+1,y:y+1},{x,y:y+1}]});
const sampled=rules.sampleSurroundings(cells[4],cells,3,3);
assert.deepEqual(Object.fromEntries(Object.entries(sampled).map(([k,v])=>[k,v.id])),{north:1,northEast:2,east:5,southEast:8,south:7,southWest:6,west:3,northWest:0});
assert.equal(rules.sampleSurroundings(cells[0],cells,3,3).north.source,'world-edge');
const neighbors={north:'mountains',northEast:'forest',east:'forest',southEast:'plains',south:'sea',southWest:'sea',west:'forest',northWest:'plains'};
assert.deepEqual(rules.weights({x:190,y:190},'plains',neighbors),{plains:1});
assert.deepEqual(rules.weights({x:190,y:100},'plains',neighbors),{forest:1});
assert.deepEqual(rules.weights({x:100,y:190},'plains',neighbors),{sea:1});
assert.deepEqual(rules.weights({x:37.5,y:100},'plains',neighbors),{plains:.5,forest:.5});
for(let x=0;x<=200;x+=2)for(let y=0;y<=200;y+=2){const w=rules.weights({x,y},'plains',neighbors);assert.ok(Math.abs(Object.values(w).reduce((a,b)=>a+b,0)-1)<1e-10);if(x>=50&&x<=150&&y>=50&&y<=150)assert.deepEqual(w,{plains:1})}

const harness=fs.readFileSync(__dirname+'/urban-regression.cjs','utf8').split('let passed=0;')[0];
new Function('require','__dirname','neighbors',harness+`
run(fs.readFileSync(__dirname+'/../src/regional-biome-rules.js','utf8'));
run(moduleFile('regional-landscape'));
function generate(biomes){run('window.__CONQUER_REGIONAL_DEMO__={surroundingBiomes:'+JSON.stringify(biomes)+'};State.seed=4242;State.biome="plains";State.environment=[];State.relief=null;State.structures=[];generateRelief();generateEnvironment()')}
generate(neighbors);
assert.equal(run('window.ConquerRegionalLandscape.active()'),true);
assert.equal(run('State.environment.filter(f=>f.id.startsWith("regional-peak-")&&f.id.endsWith("-pair")).length*2'),run('State.environment.filter(f=>f.id.startsWith("regional-peak-")).length'),'regional peaks doubled exactly');
assert.ok(run('State.environment.filter(f=>f.id.startsWith("regional-peak-")).flatMap(f=>mountainFacetPolygons(f)).some(f=>f.cuts.length)'),'regional mountains are cut at the world edge');
assert.ok(run('State.environment.filter(f=>f.id.endsWith("-pair")).every(f=>{const main=State.environment.find(m=>m.id===f.id.slice(0,-5));return main&&polygonsOverlapSimple(f.points,main.points)})'),'regional peak pairs intersect');
assert.equal(run('State.environment.some(f=>f.type==="sea"&&environmentContains(f,{x:100,y:190}))'),true,'south is real water');
assert.equal(run('State.environment.some(f=>f.type==="sea"&&environmentContains(f,{x:190,y:190}))'),false,'land diagonal overrides two adjacent sea sides');
assert.ok(run('State.environment.some(f=>f.type==="mountain"&&f.regional!==false)'),'neighbour mountains have real meshes');
assert.ok(run('State.environment.some(f=>f.type==="forest")'),'neighbour forest has real tree polygons');
assert.equal(run('State.environment.some(f=>["forest","sea","pond"].includes(f.type)&&environmentContains(f,{x:100,y:100}))'),false,'central plains hub preserved');
const first=run('JSON.stringify(State.environment)');generate(neighbors);assert.equal(run('JSON.stringify(State.environment)'),first,'composition is deterministic');
assert.ok(run('seaBorderEntries().length>0&&seaBorderEntries().every(e=>Number.isFinite(e.x)&&Number.isFinite(e.y))'),'regional sea exits have valid positions');
generate({...neighbors,east:'sea'});
assert.equal(run('State.environment.some(f=>f.type==="sea"&&environmentContains(f,{x:190,y:190}))'),false,'dry diagonal between two sea sides');

generate(Object.fromEntries(Object.keys(neighbors).map(k=>[k,'sea'])));
assert.ok(run('State.environment.some(f=>f.type==="sea"&&f.holes.length>0)'),'surrounding sea preserves a land hole');
assert.equal(run('State.environment.some(f=>f.type==="sea"&&environmentContains(f,{x:100,y:100}))'),false);
assert.equal(run('State.environment.some(f=>f.type==="sea"&&environmentContains(f,{x:10,y:10}))'),true);
generate({...Object.fromEntries(Object.keys(neighbors).map(k=>[k,'plains'])),southEast:'sea'});
assert.equal(run('State.environment.some(f=>f.type==="sea"&&environmentContains(f,{x:190,y:190}))'),true,'diagonal can independently be sea');
assert.equal(run('State.environment.some(f=>f.type==="sea"&&environmentContains(f,{x:190,y:100}))'),false);
generate(Object.fromEntries(Object.keys(neighbors).map(k=>[k,'plains'])));
assert.equal(run('window.ConquerRegionalLandscape.active()'),false,'uniform surroundings reuse the normal recipe');
for(const biome of ['forest','mountains','sea','swamp','lake']){
  run('State.biome='+JSON.stringify(biome)+';State.relief=null;State.environment=[];generateRelief();generateEnvironment()');
  assert.ok(run('State.environment.every(f=>f.points?.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)))'));
}
const dry=Object.fromEntries(Object.keys(neighbors).map(k=>[k,'plains']));
for(const [sides,kind] of [[['north'],'gulf'],[['north','east'],'headland'],[['north','east','south'],'peninsula'],[['north','east','south','west'],'island']]){
  const biomes={...dry};for(const side of sides)biomes[side]='sea';
  for(const [d,a,b] of [['northEast','north','east'],['southEast','south','east'],['southWest','south','west'],['northWest','north','west']])if(sides.includes(a)&&sides.includes(b))biomes[d]='sea';
  generate(biomes);
  assert.equal(run('window.ConquerRegionalLandscape.coastShape().kind'),kind);
  assert.equal(run('State.environment.some(f=>f.type==="sea"&&environmentContains(f,{x:100,y:100}))'),false,'central land remains dry');
  const shoreline=run('Array.from({length:21},(_,i)=>{const x=50+i*5;for(let y=0;y<=55;y+=.5)if(!State.environment.some(f=>f.type==="sea"&&environmentContains(f,{x,y})))return y;return 55})');
  assert.ok(Math.max(...shoreline)-Math.min(...shoreline)>7,kind+' coast has broad bays');
  if(kind==='headland')assert.ok(run('State.environment.some(f=>f.coastalRock)'), 'headland has real rock outcrops');
  if(kind==='peninsula')assert.equal(run('Array.from({length:41},(_,i)=>({x:i*2.5,y:100})).some(p=>State.environment.some(f=>f.type==="sea"&&environmentContains(f,p)))'),false,'peninsula remains joined to land on west');
  if(kind==='island')assert.ok(run('State.environment.some(f=>f.type==="sea"&&f.holes.length>0)'), 'island is enclosed by sea');
}
console.log('PASS regional surroundings: eight real ray samples, weights, meshes, water collision, diagonal land/sea and deterministic composition');
`)(require,__dirname,neighbors);
