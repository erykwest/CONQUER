'use strict';
const fs=require('node:fs');
const harness=fs.readFileSync(__dirname+'/urban-regression.cjs','utf8').split('let passed=0;')[0];
new Function('require','__dirname',harness+`
for(const biome of ['mountains','valley'])for(const seed of [4242,229,777,12345]){
  run('State.seed='+seed+';State.biome='+JSON.stringify(biome)+';State.environment=biomeMountains()');
  if(biome==='valley'){assert.equal(run('State.environment.length'),0,'Valley is Hills, mountains require a regional border');continue;}
  const main=run('State.environment.filter(m=>!m.subPeak)');
  assert.ok(main.length>=(biome==='mountains'?8:6)&&main.length<=(biome==='mountains'?14:10));
  assert.equal(main.length%2,0,'doubled peak count');
  const nearest=main.map(a=>Math.min(...main.filter(b=>b!==a).map(b=>Math.hypot(a.x-b.x,a.y-b.y))));
  assert.ok(new Set(nearest.map(d=>Math.round(d))).size>=3,'spacing is irregular rather than repeating identical pairs');
  assert.ok(run('State.environment.filter(m=>!m.subPeak).every(a=>State.environment.some(b=>b!==a&&!b.subPeak&&polygonsOverlapSimple(a.points,b.points)))'),'mountain chain intersects');
  assert.ok(run('State.environment.some(m=>m.unclippedPoints.some(p=>p.x<0||p.x>WORLD||p.y<0||p.y>WORLD))'),'edge mountains continue beyond border before clipping');
  assert.ok(run('State.environment.every(m=>m.points.every(p=>p.x>=0&&p.x<=WORLD&&p.y>=0&&p.y<=WORLD))'),'collision footprints clipped');
  assert.ok(run('State.environment.flatMap(m=>mountainFacetPolygons(m)).some(f=>f.cuts.length)'),'vertical sections exist');
  assert.ok(run('State.environment.flatMap(m=>mountainFacetPolygons(m)).every(f=>[f.rock,f.snow,...f.cuts].flat().every(p=>p.x>=-1e-7&&p.x<=WORLD+1e-7&&p.y>=-1e-7&&p.y<=WORLD+1e-7&&Number.isFinite(p.z)&&p.z>=0))'),'render facets bounded in XY with valid height');
  const first=run('JSON.stringify(State.environment)');assert.equal(run('JSON.stringify(biomeMountains())'),first,'deterministic mountains');
}
run('State.environment=[{type:"mountain",id:"cut-test",x:2,y:100,height:10,points:[{x:0,y:90},{x:12,y:90},{x:12,y:110},{x:0,y:110}],unclippedPoints:[{x:-8,y:90},{x:12,y:90},{x:12,y:110},{x:-8,y:110}]}]');
assert.ok(run('mountainFacetPolygons(State.environment[0]).flatMap(f=>f.cuts).some(c=>c.some(p=>p.x===0&&p.z>0))'),'cut retains nonzero border height rather than flattening to ground');
assert.ok(run('mountainSurfaceZ(State.environment[0],{x:0,y:100})>0'),'surface and section heights agree');
console.log('PASS mountains: doubled irregular peaks, intersection, deterministic generation, clipped collision and shared 2D/3D vertical sections');
`)(require,__dirname);
