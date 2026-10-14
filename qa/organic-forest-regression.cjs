'use strict';
// Regression for large organically-lobed forest zones, with all original
// lower radius bounds preserved and the old maxima tripled.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const world=fs.readFileSync(__dirname+'/../src/settlement-world.js','utf8');
const landscape=fs.readFileSync(__dirname+'/../src/settlement-landscape.js','utf8');
const begin=world.indexOf('function makeOrganicForestBlob(');
const end=world.indexOf('function addForestBlob(',begin);
assert.ok(begin>=0&&end>begin,'organic forest source must exist');
const context=vm.createContext({
  Math,
  randomEnvPoint:()=>({x:100,y:100})
});
vm.runInContext(world.slice(begin,end),context);
const candidate=vm.runInContext('makeForestCandidate',context);
const low=()=>0,high=()=>1-Number.EPSILON;
for(const [small,minX,minY,oldX,oldY] of [[true,4,3,7,5],[false,8,6,15,12]]){
  const minimum=candidate(low,small),maximum=candidate(high,small);
  assert.equal(minimum.rx,minX,'minimum x radius retained');
  assert.equal(minimum.ry,minY,'minimum y radius retained');
  assert.ok(maximum.rx>oldX*2.999&&maximum.rx<=oldX*3,'maximum x radius now 300%');
  assert.ok(maximum.ry>oldY*2.999&&maximum.ry<=oldY*3,'maximum y radius now 300%');
  assert.ok(maximum.points.length>=40);
}
console.log('PASS existing forest minimum radii and triple maximum bounds');

let rng=12345;
const rnd=()=>{rng=(Math.imul(1664525,rng)+1013904223)>>>0;return rng/0x100000000};
const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
const intersects=(a,b,c,d)=>{
  const v=[cross(a,b,c),cross(a,b,d),cross(c,d,a),cross(c,d,b)];
  return v[0]*v[1]<0&&v[2]*v[3]<0;
};
let nonEllipse=0;
for(let sample=0;sample<80;sample++){
  const forest=candidate(rnd,sample%2===0);
  const points=forest.points;
  assert.ok(points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
  const angles=points.map(p=>Math.atan2(p.y-forest.y,p.x-forest.x));
  const distances=points.map(p=>Math.hypot(p.y-forest.y,p.x-forest.x));
  if(!forest.outlineType)assert.ok(Math.max(...distances)/Math.min(...distances)<Math.max(4.7,3*Math.max(forest.rx/forest.ry,forest.ry/forest.rx)),'rounded lobed islands');
  const maxNeighborJump=Math.max(...distances.map((d,i)=>Math.abs(d-distances[(i+1)%distances.length])));
  assert.ok(maxNeighborJump<Math.max(forest.rx,forest.ry)*.45,'continuous forest boundary including rounded ribbon end caps');
  for(let i=0;i<points.length;i++)for(let j=i+2;j<points.length;j++){
    if(i===0&&j===points.length-1)continue;
    assert.ok(!intersects(points[i],points[(i+1)%points.length],points[j],points[(j+1)%points.length]),'organic polygon cannot self-intersect');
  }
  const shifted=points.filter((p,i)=>Math.abs(distances[i]-distances[(i+Math.floor(points.length/3))%points.length])>2).length;
  if(shifted)nonEllipse++;
}
assert.ok(nonEllipse>65,'forest borders must vary with asymmetric rounded lobes');
assert.match(landscape,/for\(const p of f\.points\|\|\[\]\)/,'tree positions sample true organic extents');
assert.match(landscape,/forestMax:120/,'large forests can draw proportional additional trees');
assert.match(world,/if\(forestIntersectsSteepRelief\(candidate\)\)return false/,'old cliff exclusion still applies');
assert.match(world,/polygonGap\(candidate\.points,f\.points\)>=minGap/,'old forest spacing stays geometric');
console.log('PASS smooth varied polygons, no self-intersections, complete tree coverage, cliff and separation checks');
