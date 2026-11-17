'use strict';
// Run: node qa/regional-topology-regression.cjs
// Genuine staggered/hexagonal Voronoi macro territories, with bounded area
// and separate cached logical/physical adjacency.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const hex=require('../src/regional-hex-capacity.js');
const topology=require('../src/regional-topology.js');
const geometry=require('../src/regional-map3d-geometry.js');
const html=fs.readFileSync(path.join(__dirname,'../CONQUER_WORLD_LAB.html'),'utf8');
function extract(name,next){
  const a=html.indexOf('function '+name+'('),b=html.indexOf('function '+next+'(',a+10);
  assert.ok(a>=0&&b>a,'Extract World Lab function '+name);
  return html.slice(a,b);
}
const world=new Function('window',
  'const TERRAIN_WEIGHTS={sea:1,forest:1,hills:1,plain:1};'+
  'const TERRITORY_STEP_X=128,TERRITORY_STEP_Y=128*Math.sqrt(3)/2;'+
  extract('mulberry32','svgElement')+
  extract('polygonCentroid','columnCode')+
  extract('buildTerritoryPlan','readConfiguration')+
  extract('buildClusterOffsets','buildSites')+
  extract('buildSites','buildVoronoi')+
  extract('buildVoronoi','pointKey')+
  extract('pointKey','edgeGeometryKey')+
  extract('buildEdges','defaultTerrain')+
  extract('buildMacros','splitCoastalForests')+
  extract('splitCoastalForests','splitLakeCoastalForests')+
  'return {buildTerritoryPlan,buildSites,buildVoronoi,buildEdges,buildMacros,splitCoastalForests};'
)({ConquerRegionalHexCapacity:hex,ConquerRegionalTopology:topology});
const dist={shares:{sea:.20,forest:.25,hills:.10,plain:.45},
  seaBlobs:2,forestBlobs:6,mountainChains:2};
const opposite=[7,6,5,4,3,2,1,0];
let checked=0,threeD=0;
for(const [cols,rows] of [[30,21],[12,8],[2,2]])
  for(const seed of [1943,71241]){
    const plan=world.buildTerritoryPlan(rows,cols,seed,dist);
    for(const deformation of [0,150,360]){
      const cfg={finalRows:rows,finalCols:cols,width:(cols+.5)*128,
        height:rows*128*Math.sqrt(3)/2,cellsPerTerritory:1,
        baseCells:rows*cols,territoryPlan:plan};
      const sites=world.buildSites(seed,deformation,cfg);
      const cells=world.buildVoronoi(sites,cfg);
      const macros=world.buildMacros(cells,cfg);
      const edges=world.buildEdges(cells);
      const mean=cfg.width*cfg.height/(cols*rows);
      assert.equal(cells.length,cols*rows);
      assert.equal(macros.length,cols*rows);
      assert.ok(cells.every(c=>Math.abs(hex.area(c.polygon)/mean-1)<=.10),
        'All territories satisfy strict ±10% area limit');
      assert.ok(Math.abs(cells.reduce((v,c)=>v+hex.area(c.polygon),0)
        -cfg.width*cfg.height)<cfg.width*cfg.height*1e-7,
        'Voronoi polygons cover world exactly');
      assert.ok(html.includes('(macroRow % 2) * TERRITORY_STEP_X / 2'),
        'Base-site generator retains staggered triangular/hexagonal row offsets');
      for(const site of sites){
        const neighbors=cfg.neighbors8[site.macroId];
        assert.equal(neighbors.length,8,'8 fixed logical slots');
        for(let i=0;i<8;i++)if(neighbors[i]!==null)
          assert.equal(cfg.neighbors8[neighbors[i]][opposite[i]],site.macroId,
            'Reciprocal eight-slot lookup');
        if(site.macroRow>0&&site.macroRow<rows-1&&
           site.macroCol>0&&site.macroCol<cols-1)
          assert.ok(neighbors.every(id=>id!==null),
            'Interior macro has eight logical references');
      }
      assert.ok(edges.every(edge=>edge.cells.length<=2),
        'Every physical edge has at most two macro owners');
      const physical=new Map(cells.map(c=>[c.macroId,new Set()]));
      for(const edge of edges)if(edge.cells.length===2){
        const [a,b]=edge.cells.map(c=>c.macroId);
        physical.get(a).add(b);physical.get(b).add(a);
      }
      for(const [a,neighbors] of physical)
        for(const b of neighbors)assert.ok(physical.get(b).has(a),
          'All shared-edge neighbors are reciprocated');
      if(cols*rows>100){
        assert.ok(cells.filter(c=>c.polygon.length===6).length>cells.length*.65,
          'Predominantly six-sided, real macro Voronoi polygons');
        assert.ok(cells.filter(c=>c.polygon.length===4).length<cells.length*.1,
          'Not mostly square polygons');
      }
      if(cols===30&&rows===21&&seed===1943&&deformation===150){
        const terrain=Object.fromEntries(macros.map(m=>[m.id,m.terrain]));
        const split=world.splitCoastalForests(macros,edges,terrain);
        const palette={sea:'#88a9b2',hills:'#8a603e',forest:'#294f35',
          swamp:'#747b58',plain:'#77985b'};
        const scene=geometry.buildScene({
          seed,width:cfg.width,height:cfg.height,cells,
          terrain:split.terrain,
          fills:Object.fromEntries(split.macros.map(m=>
            [m.id,palette[split.terrain[m.id]]||palette.plain])),
          edges:edges.map(e=>({...e,macroIds:[...new Set(e.cells.map(c=>c.macroId))]})),
          rivers:[],generatedRiverEdges:[],mountainRanges:[],
          automaticMountainEdges:[]
        },20,.65);
        assert.ok(scene.stats.maxVisualAreaDeviation<=.10,'Visual 3D area cap');
        assert.ok(scene.stats.subcells>cols*rows*18,'Fine display microcells survive');
        threeD++;
      }
      checked++;
    }
  }
assert.ok(html.includes('window.ConquerRegion8Neighbors = macroId =>'),
  'Eight fixed logical proximity slots remain exposed');
assert.ok(html.includes('window.ConquerRegionPhysicalNeighbors = macroId =>'),
  'Physical shared-edge neighbors are separately exposed');
assert.ok(!html.includes('ConquerRegionalHexAggregation.generate'),
  'No square-center 20-cell aggregation');
console.log('PASS '+checked+' TRUE HEX Voronoi maps, ±10% canonical/visual areas, eight logical slots, physical adjacency; '+threeD+' 3D scene.');
