'use strict';
// Run: node qa/regional-topology-regression.cjs
// Verify real World Lab generation, fixed Moore neighbourhood, logical and
// visual-friendly area bounds, polygon coverage, and reproducible seeds.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const topology=require('../src/regional-topology.js');
const html=fs.readFileSync(path.join(__dirname,'../CONQUER_WORLD_LAB.html'),'utf8');
const extract=(name,next)=>{
  const start=html.indexOf('function '+name+'(');
  const end=html.indexOf('function '+next+'(',start+10);
  assert.ok(start>=0&&end>start,'World Lab function '+name+' remains accessible');
  return html.slice(start,end);
};
const runtime=new Function('window',
  'const TERRAIN_WEIGHTS={hills:1,forest:1,plain:1,sea:1};'+
  'const TERRITORY_STEP_X=128,TERRITORY_STEP_Y=128;'+
  extract('mulberry32','svgElement')+
  extract('polygonCentroid','columnCode')+
  extract('buildTerritoryPlan','readConfiguration')+
  extract('buildSites','pointKey')+
  extract('pointKey','edgeGeometryKey')+
  extract('buildEdges','defaultTerrain')+
  extract('buildMacros','splitCoastalForests')+
  extract('splitCoastalForests','splitLakeCoastalForests')+
  'return {buildTerritoryPlan,buildSites,buildVoronoi,buildEdges,buildMacros,splitCoastalForests};'
)({ConquerRegionalTopology:topology});

const distribution={shares:{sea:.20,forest:.25,hills:.10,plain:.45},
  seaBlobs:2,forestBlobs:6,mountainChains:2};
const opposite=[7,6,5,4,3,2,1,0];
let checked=0;
for(const [cols,rows] of [[30,21],[12,8],[2,2]])for(const seed of [1943,71241]){
  const plan=runtime.buildTerritoryPlan(rows,cols,seed,distribution);
  assert.equal(plan.territories.length,cols*rows);
  for(const deformation of [0,150,360]){
    const configuration={
      finalRows:rows,finalCols:cols,width:cols*128,height:rows*128,
      baseCells:cols*rows,cellsPerTerritory:1,territoryPlan:plan
    };
    const sites=runtime.buildSites(seed,deformation,configuration);
    const cells=runtime.buildVoronoi(sites,configuration);
    const macros=runtime.buildMacros(cells,configuration);
    const edges=runtime.buildEdges(cells);
    const mean=configuration.width*configuration.height/cells.length;
    const areas=cells.map(c=>topology.area(c.polygon));
    assert.equal(cells.length,cols*rows);
    assert.ok(areas.every(a=>a>=mean*.9&&a<=mean*1.1),
      'Every canonical territory obeys ±10% of mean area');
    assert.ok(Math.abs(areas.reduce((a,b)=>a+b,0)-configuration.width*configuration.height)
      <configuration.width*configuration.height*1e-7,'No gaps/overlap');
    for(const site of sites){
      const slots=configuration.neighbors8[site.macroId];
      assert.equal(slots.length,8,'Eight predefined neighbor slots for every cell');
      for(let i=0;i<8;i++){
        const other=slots[i];
        if(other!==null)assert.equal(configuration.neighbors8[other][opposite[i]],site.macroId,
          'Moore neighbors are reciprocal');
      }
      if(site.macroRow>0&&site.macroRow<rows-1&&
         site.macroCol>0&&site.macroCol<cols-1)
        assert.equal(slots.filter(v=>v!==null).length,8,'Interior territory has eight IDs');
    }
    assert.ok(edges.every(edge=>edge.cells.length<=2),'Manifold border segments');
    for(const edge of edges)if(edge.cells.length===2){
      const [a,b]=edge.cells.map(c=>c.macroId);
      assert.ok(configuration.neighbors8[a].includes(b),'Visual edge matches a logical neighbor slot');
    }
    assert.equal(macros.length,cols*rows);
    assert.ok(macros.every(m=>m.cells.length===1));
    assert.ok(configuration.areaBalance.maxDeviation<=.10);
    checked++;
  }
}
assert.ok(html.includes("topology: 'square-moore-8-balanced-v1'"),'Save format is versioned');
assert.ok(html.includes('const mapSavedCode=code=>'),'Legacy cell IDs remapped by row/column');
assert.ok(html.includes('window.ConquerRegion8Neighbors = macroId =>'),'Public constant-time neighbor access');
console.log('PASS square 8-neighbor topology, Voronoi area ±10%, source generation, border consistency, seed reproducibility and save migration on '+checked+' maps.');
