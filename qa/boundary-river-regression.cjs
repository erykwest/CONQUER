'use strict';
const fs=require('node:fs');
const harness=fs.readFileSync(__dirname+'/urban-regression.cjs','utf8').split('let passed=0;')[0];
new Function('require','__dirname',harness+`
const sides=new Set();
for(let seed=0;seed<64;seed++){
  run('State.seed='+seed+';State.biome="river";State.structures=[];State.relief=null;State.environment=[];generateRelief();generateEnvironment()');
  const first=run('JSON.stringify(State.environment.find(f=>f.type==="river"))');
  const river=JSON.parse(first);sides.add(river.boundarySide);
  assert.equal(river.boundaryPolicy,1);
  assert.ok(river.points.every(p=>p.x>=0&&p.x<=200&&p.y>=0&&p.y<=200));
  const penetration=Math.max(...river.points.map(p=>Math.min(p.x-50,150-p.x,p.y-50,150-p.y)));
  assert.ok(penetration*3>=25,'inward bend reaches at least 25 reference pixels: seed '+seed);
  assert.ok(river.points.every(p=>Math.min(p.x-50,150-p.x,p.y-50,150-p.y)<=12.01));
  for(const p of [river.points[0],river.points.at(-1)])assert.ok(p.x===0||p.x===200||p.y===0||p.y===200);
  assert.equal(run('environmentBlocksPoint({x:100,y:100},"settlement")'),false,'hub stays clear');
  const peak=river.points.find(p=>p.x>50&&p.x<150&&p.y>50&&p.y<150);
  assert.ok(peak);
  assert.equal(run('environmentBlocksPoint('+JSON.stringify(peak)+',"settlement")'),true,'inward water blocks construction');
  run('generateEnvironment()');
  assert.equal(run('JSON.stringify(State.environment.find(f=>f.type==="river"))'),first,'deterministic generated river');
}
assert.equal(sides.size,4,'all sides exercised');
console.log('PASS 64 real river maps: perimeter, inward bends, collision and deterministic generation');
`)(require,__dirname);
