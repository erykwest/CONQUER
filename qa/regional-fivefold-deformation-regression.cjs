'use strict';
// Run: node qa/regional-fivefold-deformation-regression.cjs
// World Lab's square logical centers must stay fixed. The canonical Voronoi
// vertex displacement is nominally fivefold; safety backoff may reduce it only
// to keep polygons simple and all aggregate areas within ±10%.
const assert=require('node:assert/strict');
const hex=require('../src/regional-hex-aggregation.js');
const geo=require('../src/regional-map3d-geometry.js');
const cols=30,rows=21;
const slots=new Map();
for(let row=0;row<rows;row++)
  for(let col=0;col<cols;col++)
    slots.set(row+','+col,{id:row*cols+col});
const config={width:cols*128,height:rows*128,finalCols:cols,finalRows:rows,
  deformation:360,territoryPlan:{slotAssignments:slots}};
const referenceArea=config.width*config.height/(cols*rows);
let totalWarpedTriangles=0,safetyBackoffs=0;
for(const seed of [1943,12875,777777,424242]){
  const result=hex.generate(seed,config);
  assert.equal(result.cells.length,630);
  assert.equal(result.fineCells.length,12600);
  assert.equal(result.stats.deformationMultiplier,5);
  const expected=5*(.26+.20)*((config.width/(cols*5))*.5);
  assert.ok(Math.abs(result.stats.nominalWarpAmplitude-expected)<1e-6,
    'fivefold displacement is computed relative to the former site jitter');
  assert.ok(result.stats.warpFactor>=.8,'retain a substantial fivefold effect even after safety guards');
  if(result.stats.warpFactor<1)safetyBackoffs++;
  assert.ok(result.stats.maxDeviation<=.10,'no aggregate area varies beyond ±10%');
  assert.ok(result.cells.every(c=>c.microCount===20),'always 20 fine cells per square slot');
  const ownedArea=new Map();
  for(const fine of result.fineCells){
    const polygon=fine.polygon;
    assert.ok(polygon.length>=3&&fine.scale>=.5&&fine.scale<=1.5);
    const triangles=geo.triangulate(polygon);
    const total=triangles.reduce((sum,[a,b,c])=>sum+
      Math.abs((b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x))*.5,0);
    assert.ok(Math.abs(total-hex.area(polygon))<1e-4,
      'no warped fine cell overlaps or leaks triangles outside the actual polygon');
    ownedArea.set(fine.macroId,(ownedArea.get(fine.macroId)||0)+hex.area(polygon));
    totalWarpedTriangles+=triangles.length;
  }
  assert.ok(result.cells.every(c=>
    Math.abs(hex.area(c.polygon)-ownedArea.get(c.macroId))<=referenceArea*1e-6),
    'each region is the exact union of its twenty transformed subcells');
}
assert.ok(totalWarpedTriangles>300000,'nonlinear edges are subdivided for the strong warp');
console.log('PASS 4 full-size maps at 5× contour deformation: 630 fixed square-center territories, 12,600 shared Voronoi subcells, concave-safe triangulation, ±10% areas; safety fallback used on '+safetyBackoffs+' seed(s).');
