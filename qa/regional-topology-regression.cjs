'use strict';
// Run: node qa/regional-topology-regression.cjs
// Verify real World Lab generation, fixed Moore neighbourhood, logical and
// visual-friendly area bounds, polygon coverage, and reproducible seeds.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const topology=require('../src/regional-topology.js');
const hex=require('../src/regional-hex-aggregation.js');
const geometry3d=require('../src/regional-map3d-geometry.js');
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
)({ConquerRegionalTopology:topology,ConquerRegionalHexAggregation:hex});

const distribution={shares:{sea:.20,forest:.25,hills:.10,plain:.45},
  seaBlobs:2,forestBlobs:6,mountainChains:2};
const opposite=[7,6,5,4,3,2,1,0];
let checked3D=false,sourceDeforms=false;
let checked=0;
for(const [cols,rows] of [[30,21],[12,8],[2,2]])for(const seed of [1943,71241]){
  const plan=runtime.buildTerritoryPlan(rows,cols,seed,distribution);
  assert.equal(plan.territories.length,cols*rows);
  let previousOutline=null;
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
    assert.equal(sites.length,cols*rows,'exactly one logical square center per macro');
    assert.ok(sites.every(site=>site.x===(site.macroCol+.5)*128 &&
      site.y===(site.macroRow+.5)*128),'centers must stay on a true SQUARE grid');
    const fine=configuration.fineCells;
    assert.equal(fine.length,cols*rows*20,'EXACTLY 20 Voronoi microsites per square center');
    const fineCounts=new Map(),fineAreas=new Map();
    for(const part of fine){
      assert.ok(part.scale>=.5&&part.scale<=1.5,
        'random microcell scale factor must stay within ±50%');
      fineCounts.set(part.macroId,(fineCounts.get(part.macroId)||0)+1);
      fineAreas.set(part.macroId,(fineAreas.get(part.macroId)||0)+hex.area(part.polygon));
    }
    assert.ok(cells.every(cell=>fineCounts.get(cell.macroId)===20));
    const hexLike=fine.filter(cell=>
      cell.baseSides>=5&&cell.baseSides<=7).length;
    assert.ok(hexLike>fine.length*.7,'microsites are mostly hex-like 5–7 sided Voronoi, not squares');
    assert.ok(cells.every(cell=>cell.polygon.length>=16),
      'aggregated macro polygons have many irregular sides, not square or macro-hex shapes');
    assert.ok(cells.every(cell=>Math.abs(hex.area(cell.polygon)-
      fineAreas.get(cell.macroId))<mean*1e-6),'macro outline equals exact microcell union');
    const initial=JSON.stringify(cells[0].polygon);
    if(previousOutline!==null&&initial!==previousOutline)sourceDeforms=true;
    previousOutline=initial;
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
    if(!checked3D&&cols===30&&rows===21&&deformation===150){
      const terrain=Object.fromEntries(macros.map(m=>[m.id,m.terrain]));
      const rebuilt=runtime.splitCoastalForests(macros,edges,terrain);
      const palette={sea:'#88a9b2',plain:'#77985b',forest:'#294f35',
        hills:'#8a603e',swamp:'#747b58'};
      const fills=Object.fromEntries(rebuilt.macros.map(m=>[m.id,palette[rebuilt.terrain[m.id]]||palette.plain]));
      const snap={seed,width:configuration.width,height:configuration.height,
        cells,fineCells:fine,terrain:rebuilt.terrain,fills,
        edges:edges.map(e=>({start:e.start,end:e.end,
          macroIds:[...new Set(e.cells.map(c=>c.macroId))]})),
        rivers:[],generatedRiverEdges:[],mountainRanges:[],automaticMountainEdges:[]};
      const mesh=geometry3d.buildScene(snap,20,.65);
      assert.equal(mesh.stats.subcells,630*20,
        '3D must render the same 20 original Voronoi cells per macro');
      assert.equal(mesh.stats.visualFragments,630*20);
      assert.ok(mesh.stats.maxVisualAreaDeviation<=.10);
      checked3D=true;
    }
    assert.ok(configuration.areaBalance.maxDeviation<=.10);
    assert.equal(configuration.areaBalance.deformationMultiplier,5,
      'visible Voronoi edge distortion must be five times baseline');
    assert.ok(configuration.areaBalance.warpAmplitude>0,
      'strong organic warp must actually deform the final polygons');
    checked++;
  }
}
assert.ok(html.includes("topology: 'square-moore-8-hex20-v2'"),'20-hex save format is versioned');
assert.ok(html.includes('const mapSavedCode=code=>'),'Legacy cell IDs remapped by row/column');
assert.ok(html.includes('window.ConquerRegion8Neighbors = macroId =>'),'Public constant-time neighbor access');
assert.ok(checked3D,'real 2D Voronoi cells are used by the 3D renderer');
assert.ok(sourceDeforms,'World Lab deformation setting changes the real polygon geometry');
console.log('PASS '+checked+' maps: SQUARE centers, exactly 20 random hex-like Voronoi cells, scale ±50%, aggregation ±10%, 8 directional slots, edges and 3D.');
