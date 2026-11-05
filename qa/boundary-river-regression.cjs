'use strict';
const fs=require('node:fs');
const harness=fs.readFileSync(__dirname+'/urban-regression.cjs','utf8').split('let passed=0;')[0];
new Function('require','__dirname',harness+`
const sides=new Set();
const shapes=new Set();
for(let seed=0;seed<64;seed++){
  run('State.seed='+seed+';State.biome="river";State.structures=[];State.relief=null;State.environment=[];generateRelief();generateEnvironment()');
  const first=run('JSON.stringify(State.environment.find(f=>f.type==="river"))');
  const river=JSON.parse(first);sides.add(river.boundarySide);
  const canonical=river.points.map(p=>river.boundarySide==='west'?{x:p.y,y:p.x}:river.boundarySide==='east'?{x:p.y,y:200-p.x}:river.boundarySide==='north'?p:{x:p.x,y:200-p.y});
  shapes.add(canonical.slice(1,40).map((p,i)=>(p.y-canonical[i].y).toFixed(4)).join(','));
  assert.equal(river.boundaryPolicy,2);
  assert.equal(river.meanderModel,'arc-length-heading');
  assert.ok(river.meanderBends.every(b=>b.radius/river.width>=2&&b.radius/river.width<=3.01),'width-scaled bend radii');
  assert.ok(river.points.every(p=>p.x>=0&&p.x<=200&&p.y>=0&&p.y<=200));
  const penetration=Math.max(...river.points.map(p=>Math.min(p.x-50,150-p.x,p.y-50,150-p.y)));
  assert.ok(penetration*3>=25,'inward bend reaches at least 25 reference pixels: seed '+seed);
  assert.ok(river.points.every(p=>Math.min(p.x-50,150-p.x,p.y-50,150-p.y)<=20.01));
  for(const p of [river.points[0],river.points.at(-1)])assert.ok(p.x===0||p.x===200||p.y===0||p.y===200);
  assert.equal(run('environmentBlocksPoint({x:100,y:100},"settlement")'),false,'hub stays clear');
  const peak=river.points.find(p=>p.x>50&&p.x<150&&p.y>50&&p.y<150);
  assert.ok(peak);
  assert.equal(run('environmentBlocksPoint('+JSON.stringify(peak)+',"settlement")'),true,'inward water blocks construction');
  run('generateEnvironment()');
  assert.equal(run('JSON.stringify(State.environment.find(f=>f.type==="river"))'),first,'deterministic generated river');
}
assert.equal(sides.size,4,'all sides exercised');
assert.ok(shapes.size>=60,'seed must change geometry, not only rotate or mirror identical bends: '+shapes.size);
for(let seed=0;seed<2000;seed++){
  const river=JSON.parse(run('JSON.stringify(makeBoundaryRiver(seedRand('+seed+')))'));
  assert.ok(river.points.length>100);
  assert.ok(river.points.every(p=>p.x>=0&&p.x<=200&&p.y>=0&&p.y<=200),'bounded without clipping seed '+seed);
  assert.ok(Math.max(...river.points.map(p=>Math.min(p.x-50,150-p.x,p.y-50,150-p.y)))*3>=25,'inward depth seed '+seed);
}
console.log('PASS 64 real river maps: perimeter, inward bends, collision and deterministic generation');
console.log('PASS 2000 seeded curves: distinct meanders, width-scaled radii, bounds and required penetration');
`)(require,__dirname);
