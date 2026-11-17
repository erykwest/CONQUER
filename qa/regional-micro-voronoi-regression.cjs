'use strict';
// Run: node qa/regional-micro-voronoi-regression.cjs
// The TRUE hexagonal gameplay map owns 20 CLIPPED variable-area Voronoi
// subcells per macro. They are detail, not extra gameplay territories.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const hex=require('../src/regional-hex-capacity.js');
const micro=require('../src/regional-micro-voronoi.js');
const topology=require('../src/regional-topology.js');
const geometry=require('../src/regional-map3d-geometry.js');
const html=fs.readFileSync(path.join(__dirname,'../CONQUER_WORLD_LAB.html'),'utf8');
function extract(name,next){
  const a=html.indexOf('function '+name+'('),b=html.indexOf('function '+next+'(',a+10);
  assert.ok(a>=0&&b>a,'World Lab function '+name+' is available');
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
const nearly=(a,b,tolerance=1e-6)=>Math.abs(a-b)<=tolerance;
let checked=0,scenes=0;
for(const [rows,cols,seed,deformation] of [[21,30,1943,150],[8,12,71241,360]]){
  const config={finalRows:rows,finalCols:cols,
    width:(cols+.5)*128,height:rows*128*Math.sqrt(3)/2,
    baseCells:rows*cols,cellsPerTerritory:1};
  config.territoryPlan=world.buildTerritoryPlan(rows,cols,seed,dist);
  const centers=world.buildSites(seed,deformation,config);
  const macros=world.buildVoronoi(centers,config);
  const macroBefore=macros.map(m=>JSON.stringify(m.polygon));
  const result=micro.generate(macros,seed);
  const microCells=result.fineCells;
  assert.equal(macroBefore.length,macros.length);
  assert.deepEqual(macros.map(m=>JSON.stringify(m.polygon)),macroBefore,
    'Subcell generation MUST NOT modify parent macro polygons');
  assert.equal(microCells.length,rows*cols*20,
    'Exactly 20 interior Voronoi cells per canonical hex territory');
  assert.equal(result.stats.perTerritory,20);
  assert.ok(result.stats.minScale>=.50&&result.stats.maxScale<=1.50,
    'Cell area is in the requested 50–150% range');
  assert.ok(config.areaBalance.maxDeviation<=.10,
    'Macro territories retain their ±10% area cap');
  const parents=new Map(macros.map(m=>[m.macroId,m]));
  const totals=new Map(),counts=new Map();
  for(const cell of microCells){
    const parent=parents.get(cell.macroId);
    assert.ok(parent,'Subcell references an existing macroterritory');
    const actual=micro.area(cell.polygon),average=micro.area(parent.polygon)/20;
    assert.ok(actual>0&&cell.polygon.length>=3);
    assert.ok(cell.scale>=.50&&cell.scale<=1.50,
      'Every actual subcell area, not only a random target, is ±50%');
    assert.ok(nearly(actual/average,cell.scale,1e-5));
    // Convex parent hex Voronoi clipping: every subcell vertex must lie
    // inside/on its canonical macro border, not in a neighboring territory.
    const polygon=parent.polygon;
    let orientation=0;
    for(let i=0;i<polygon.length;i++){
      const a=polygon[i],b=polygon[(i+1)%polygon.length];
      orientation+=a.x*b.y-b.x*a.y;
    }
    const sign=orientation>=0?1:-1;
    for(const pt of cell.polygon)
      for(let i=0;i<polygon.length;i++){
        const a=polygon[i],b=polygon[(i+1)%polygon.length];
        const value=sign*((b.x-a.x)*(pt.y-a.y)-(b.y-a.y)*(pt.x-a.x));
        assert.ok(value>=-1e-5,'No fine vertex extends beyond its canonical macro');
      }
    totals.set(cell.macroId,(totals.get(cell.macroId)||0)+actual);
    counts.set(cell.macroId,(counts.get(cell.macroId)||0)+1);
  }
  for(const macro of macros){
    assert.equal(counts.get(macro.macroId),20);
    assert.ok(nearly(totals.get(macro.macroId)/micro.area(macro.polygon),1,1e-6),
      'Twenty subcells exactly cover the full macro polygon');
  }
  assert.equal(Object.keys(config.neighbors8).length,macros.length,
    'Eight indexed logical references remain untouched');

  if(rows===21){
    const edges=world.buildEdges(macros);
    const macroObjects=world.buildMacros(macros,config);
    const terrain=Object.fromEntries(macroObjects.map(m=>[m.id,m.terrain]));
    const split=world.splitCoastalForests(macroObjects,edges,terrain);
    const colors={sea:'#88a9b2',forest:'#294f35',hills:'#8a603e',
      swamp:'#747b58',plain:'#77985b'};
    const pairEdge=edges.find(e=>e.cells.length===2);
    assert.ok(pairEdge);
    const riverPair=pairEdge.cells.map(c=>c.macroId).sort((a,b)=>a-b).join('-');
    const snapshot={seed,width:config.width,height:config.height,cells:macros,
      fineCells:microCells,terrain:split.terrain,
      fills:Object.fromEntries(split.macros.map(m=>[
        m.id,colors[split.terrain[m.id]]||colors.plain])),
      edges:edges.map(e=>({start:e.start,end:e.end,
        macroIds:[...new Set(e.cells.map(c=>c.macroId))]})),
      rivers:[riverPair],generatedRiverEdges:[],mountainRanges:[],
      automaticMountainEdges:[]};
    const scene=geometry.buildScene(snapshot,20,.65);
    assert.equal(scene.stats.subcells,rows*cols*20,
      '3D renders the 12,600 ORIGINAL subcells, no second tessellation');
    assert.equal(scene.pickRanges.length,rows*cols*20,
      'Every fine polygon remains selectable as its macroterritory');
    assert.ok(scene.stats.maxVisualAreaDeviation<=.10);
    assert.equal(scene.borders.length,snapshot.edges.length,
      '3D uses canonical physical macro borders, avoiding fine-cell T-junctions');
    const same=e=>e.macroIds?.length===2&&
      e.macroIds.slice().sort((a,b)=>a-b).join('-')===riverPair;
    assert.equal(scene.riverEdges.filter(same).length,scene.borders.filter(same).length,
      'Manual river follows all and only the REAL shared boundary segments');
    scenes++;
  }
  checked++;
}
assert.ok(html.includes('ConquerRegionalMicroVoronoi.generate(cells,seed)'),
  'World Lab must actually generate the canonical micro-Voronoi data');
assert.ok(html.includes('fineCells: state.configuration.fineCells'),
  'World Lab must expose those cells to the independent 3D scene');
assert.ok(html.includes('showMicro" type="checkbox" checked'),
  '20-subcell outline display should be on by default');
console.log('PASS '+checked+' hex maps; 20 clipped Voronoi cells per territory, real cell areas 50–150%, exact coverage, and '+scenes+' shared-data 3D scenes.');
