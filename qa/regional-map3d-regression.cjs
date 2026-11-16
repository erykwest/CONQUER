'use strict';
// Run: node qa/regional-map3d-regression.cjs
// Synthetic geometry benchmark and invariants; browser/WebGL render still needs manual visual validation.
const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');
const { area, subdivide, buildScene } = require('../src/regional-map3d-geometry.js');

const polygons = [
  [{x:0,y:0},{x:100,y:0},{x:100,y:80},{x:0,y:80}],
  [{x:4,y:11},{x:72,y:3},{x:98,y:54},{x:58,y:109},{x:5,y:74}],
  [{x:0,y:0},{x:95,y:5},{x:105,y:60},{x:73,y:103},{x:8,y:75}]
];
for (const polygon of polygons) {
  for (const detail of [1,8,20,40]) {
    const subcells = subdivide(polygon, detail, 1943);
    assert.equal(subcells.length, detail, 'exact visual tessellation target');
    const sum = subcells.reduce((total, points) => total + area(points), 0);
    assert.ok(Math.abs(sum - area(polygon)) < area(polygon) * 1e-8, 'subcells preserve parent area');
    for (const points of subcells) {
      assert.ok(points.length >= 3 && area(points) > 0, 'nondegenerate polygons');
      for (const point of points) {
        const cross = (a,b,p) => (b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x);
        const signs = polygon.map((a,i) => cross(a,polygon[(i+1)%polygon.length],point));
        assert.ok(Math.min(...signs) >= -1e-4 || Math.max(...signs) <= 1e-4, 'subcell stays within parent');
      }
    }
  }
}
const cells=[], terrain={};
let id=0;
for(let row=0;row<21;row++) for(let col=0;col<30;col++) {
  const x=col*128, y=row*110, key=id++;
  cells.push({ id:key, macroId:key, polygon:[{x,y},{x:x+128,y},{x:x+128,y:y+110},{x,y:y+110}] });
  terrain[key]=key%9===0?'sea':key%7===0?'hills':key%3===0?'forest':'plain';
}
const snapshot={seed:1943,width:3840,height:2310,cells,terrain};
const results=[];
for(const detail of [1,8,20,40]) {
  const start=performance.now(), mesh=buildScene(snapshot,detail);
  const ms=performance.now()-start;
  assert.equal(mesh.stats.territories,630);
  assert.equal(mesh.stats.subcells,630*detail);
  assert.ok(mesh.stats.mountains>0 && mesh.stats.trees>0);
  assert.equal(mesh.vertices.length,mesh.stats.triangles*18);
  assert.ok(mesh.vertices.every(Number.isFinite),'finite vertex data');
  results.push({detail,ms:Math.round(ms),subcells:mesh.stats.subcells,
    triangles:mesh.stats.triangles,MiB:+(mesh.vertices.byteLength/(1024*1024)).toFixed(2)});
  if(detail===20) {
    const repeat=buildScene(snapshot,detail);
    assert.deepEqual(repeat.vertices,mesh.vertices,'deterministic full geometry');
    assert.deepEqual(repeat.trees,mesh.trees,'deterministic tree placement');
  }
}
console.log('PASS region3d: exact 1/8/20/40 Voronoi subdivisions, area conservation, deterministic geometry, finite mesh.');
console.table(results);
console.log('Synthetic CPU baseline only. GPU frame time and visuals require WebGL2 on representative devices.');
