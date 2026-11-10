'use strict';
const fs=require('node:fs');
const harness=fs.readFileSync(__dirname+'/urban-regression.cjs','utf8').split('let passed=0;')[0];
new Function('require','__dirname',harness+`
run(fs.readFileSync(__dirname+'/../src/regional-biome-rules.js','utf8'));run(moduleFile('regional-landscape'));run(moduleFile('coast'));
run('State.seed=4242;State.biome="plains";window.__CONQUER_REGIONAL_DEMO__={surroundingBiomes:{north:"plains",northEast:"plains",east:"plains",southEast:"sea",south:"sea",southWest:"sea",west:"plains",northWest:"plains"}};State.relief=null;State.environment=[];State.structures=[];generateRelief();generateEnvironment()');
const ends=run('(()=>{const sea=State.environment.find(f=>f.type==="sea");return [sea.coastline[0],sea.coastline.at(-1)]})()');
assert.ok(ends.every(p=>p.x===0||p.x===200||p.y===0||p.y===200),'both inherited shore ends must reach world edge');
const coverage=run('(()=>{const sea=State.environment.find(f=>f.type==="sea"),c=sea.coastline;return [[c[0],c[1]],[c.at(-2),c.at(-1)]].map(([a,b])=>{const p={x:(a.x+b.x)/2,y:(a.y+b.y)/2};let nx=-(b.y-a.y),ny=b.x-a.x,L=Math.hypot(nx,ny)||1;nx/=L;ny/=L;if(environmentContains(sea,{x:p.x+nx,y:p.y+ny})){nx=-nx;ny=-ny}return window.ConquerCoast.kindAt({x:p.x+nx,y:p.y+ny})})})()');
assert.ok(coverage.every(Boolean),'beach or rock band covers both inherited end segments');
assert.equal(run('window.ConquerCoast.kindAt({x:100,y:199})'),null,'world perimeter under sea is not a coast');
run('State.environment=[{id:"south",type:"sea",side:"south",coastlines:[[{x:0,y:150},{x:200,y:150}]],coastline:[{x:0,y:150},{x:200,y:150}],points:[{x:0,y:150},{x:200,y:150},{x:200,y:200},{x:0,y:200}]},{id:"north",type:"sea",side:"north",coastlines:[[{x:0,y:30},{x:200,y:30}]],coastline:[{x:0,y:30},{x:200,y:30}],points:[{x:0,y:0},{x:200,y:0},{x:200,y:30},{x:0,y:30}]}]');
assert.equal(run('window.ConquerCoast.kindAt({x:20,y:31})'),'beach','north component gets its coast');
assert.equal(run('window.ConquerCoast.kindAt({x:20,y:151})'),null,'south water side stays water');
assert.equal(run('window.ConquerCoast.kindAt({x:20,y:149})'),'beach','south component also gets its coast');
console.log('PASS inherited coast: endpoint coverage, separate sea components and no coast along artificial sea borders');
`)(require,__dirname);
