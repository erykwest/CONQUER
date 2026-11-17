'use strict';
// Run: node qa/regional-map3d-regression.cjs
// New regional pipeline: global micro-Voronoi => warped macro aggregates.
// Keep the authoritative 2D topology and territory RGB untouched.
const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');
const { area, subdivide, globalMicrocells, sourceColor, buildScene, pickTerritory, deriveRiverBorders } =
  require('../src/regional-map3d-geometry.js');

// River regression: automatic rivers must follow ONLY the corresponding segment
// of the newly warped macro border. Manual rivers mark the whole shared border.
const pt=(x,y)=>({x,y});
const visualRiverBorders=[
  {start:pt(0,0),end:pt(4,1),macroIds:[0,1]},
  {start:pt(4,1),end:pt(8,-1),macroIds:[0,1]},
  {start:pt(8,-1),end:pt(12,1),macroIds:[0,1]},
  {start:pt(12,1),end:pt(16,0),macroIds:[0,1]},
  {start:pt(4,1),end:pt(4,5),macroIds:[1,2]}
];
const canonicalRiver={start:pt(0,0),end:pt(8,0),macroIds:[0,1]};
const canonicalRiverKey='0.000,0.000|8.000,0.000';
const generated=deriveRiverBorders({
  rivers:[],edges:[canonicalRiver],generatedRiverEdges:[canonicalRiverKey]
},visualRiverBorders);
assert.equal(generated.riverStats.mappedAutomatic,1);
assert.equal(generated.riverStats.unmatchedAutomatic,0);
assert.equal(generated.riverEdges.length,2,'generated river follows two matching warped border edges');
assert.ok(generated.riverEdges.every(edge=>visualRiverBorders.includes(edge)),
          'all rendered rivers are existing visual territory borders');
assert.ok(generated.riverEdges.every(edge=>edge.macroIds.join('-')==='0-1'),
          'automatic rivers cannot cross unrelated territories');
const manual=deriveRiverBorders({rivers:['0-1'],edges:[],generatedRiverEdges:[]},
                                visualRiverBorders);
assert.equal(manual.riverEdges.length,4,'manual river paints complete organic shared border');
assert.equal(deriveRiverBorders({rivers:[],edges:[],generatedRiverEdges:[]},
                               visualRiverBorders).riverEdges.length,0,
             'no ghost rivers without game river data');

// Integrated warped microcell test: river coordinates must come directly from
// aggregateEdges, rather than obsolete straight original 2D line geometry.
const cellsOnRiver=[
  {id:0,macroId:0,polygon:[pt(0,0),pt(120,0),pt(120,120),pt(0,120)]},
  {id:1,macroId:1,polygon:[pt(120,0),pt(240,0),pt(240,120),pt(120,120)]}
];
const origRiver={start:pt(120,0),end:pt(120,120),macroIds:[0,1]};
const origRiverKey='120.000,0.000|120.000,120.000';
const sceneRiver=buildScene({
  seed:471,width:240,height:120,cells:cellsOnRiver,
  terrain:{0:'plain',1:'plain'},fills:{0:'#77985b',1:'#77985b'},
  edges:[origRiver],generatedRiverEdges:[origRiverKey]
},20,.65);
assert.equal(sceneRiver.riverStats.mappedAutomatic,1,'original automatic river remapped');
assert.ok(sceneRiver.riverEdges.length>0,'3D scene includes derived river edges');
assert.ok(sceneRiver.riverEdges.every(edge=>sceneRiver.borders.includes(edge)),
          'scene river edges are exact organic border object references');
assert.ok(sceneRiver.riverEdges.every(edge=>edge.macroIds.includes(0)&&edge.macroIds.includes(1)),
          'rendered river segments stay on both banks of the same pair');

const polygons = [
  [{x:0,y:0},{x:100,y:0},{x:100,y:80},{x:0,y:80}],
  [{x:4,y:11},{x:72,y:3},{x:98,y:54},{x:58,y:109},{x:5,y:74}],
  [{x:0,y:0},{x:95,y:5},{x:105,y:60},{x:73,y:103},{x:8,y:75}]
];
// Preserve the legacy subdivision helper for comparison at detail 1.
for(const polygon of polygons)for(const detail of [1,8,20,40]){
  const parts=subdivide(polygon,detail,1943);
  assert.equal(parts.length,detail);
  assert.ok(Math.abs(parts.reduce((n,p)=>n+area(p),0)-area(polygon))<area(polygon)*1e-8);
}
assert.deepEqual(sourceColor('#294f35'),[41,79,53]);
assert.deepEqual(sourceColor('#88a9b2'),[136,169,178]);
assert.deepEqual(sourceColor('hsl(210 50% 40%)'),[51,102,153]);

const cells=[],terrain={},fills={};
let id=0;
for(let row=0;row<21;row++)for(let col=0;col<30;col++){
  const x=col*128,y=row*110,key=id++;
  cells.push({id:key,macroId:key,polygon:[
    {x,y},{x:x+128,y},{x:x+128,y:y+110},{x,y:y+110}
  ]});
  terrain[key]=key%9===0?'sea':key%7===0?'hills':key%17===0?'swamp':key%3===0?'forest':'plain';
  fills[key]=({sea:'#88a9b2',hills:'#8a603e',swamp:'#747b58',forest:'#294f35',plain:'#77985b'})[terrain[key]];
}
// Supply an actual authored ridge edge: mountains must be counted separately
// from hills, and their snow band must begin at 2/3 of hMax.
const ridge={start:{x:128,y:110},end:{x:128,y:220},macroIds:[30,31]};
const snapshot={seed:1943,width:3840,height:2310,cells,terrain,fills,
  edges:[ridge],mountainRanges:['30-31']};
const expectedArea=snapshot.width*snapshot.height;
for(const detail of [8,20,40]){
  const micro=globalMicrocells(snapshot,detail,.65);
  const resultArea=micro.parts.reduce((sum,part)=>sum+area(part.polygon),0);
  assert.ok(Math.abs(resultArea-expectedArea)<expectedArea*1e-7,'global Voronoi covers world exactly');
  assert.ok(Math.abs(micro.parts.length-630*detail)<630*detail*.07,'approximate density target');
  assert.ok(micro.ownerParts.size>590,'most original territories receive microcells');
  assert.ok(micro.parts.every(p=>p.polygon.length>=3&&terrain[p.macroId]),'valid grouped microcells');
  // Weighted Voronoi must actually vary the AREA of microcells rather than
  // just skewing polygons with nearly identical footprints. Verify the
  // intended ~200% upper end without changing total world area.
  const referenceArea=expectedArea/(cells.length*detail);
  const relativeAreas=micro.parts.map(part=>area(part.polygon)/referenceArea).sort((a,b)=>a-b);
  const percentile=f=>relativeAreas[Math.floor(f*(relativeAreas.length-1))];
  assert.ok(percentile(.05)<.7,'smaller sites compensate larger weighted-Voronoi cells');
  assert.ok(percentile(.95)>1.38,'clear large-cell tail beyond old uniform Voronoi');
  assert.ok(relativeAreas.at(-1)>=1.75 && relativeAreas.at(-1)<=2.15,
    'largest visual microcell approaches 200% of the prior reference area');
  const doubled=globalMicrocells({...snapshot,seed:snapshot.seed+113},detail,.65);
  assert.notDeepEqual(doubled.parts.slice(0,40).map(p=>p.polygon),
    micro.parts.slice(0,40).map(p=>p.polygon),'microcell weights vary with the map seed');

}
const results=[];
for(const detail of [1,8,20,40]){
  const start=performance.now(),scene=buildScene(snapshot,detail,.65),ms=performance.now()-start;
  assert.equal(scene.stats.territories,630);
  assert.ok(Math.abs(scene.stats.subcells-630*detail)<630*detail*.07);
  assert.ok(scene.stats.hills>0 && scene.stats.mountains>0 && scene.stats.trees>0 && scene.stats.reeds>0);
  assert.equal(scene.peaks.length,scene.stats.hills,'hills are separate frustum landmarks');
  for(const hill of scene.peaks) {
    assert.equal(hill.type,'hill');
    assert.ok(hill.sides>=7 && hill.sides<=9,'polygonal truncated-pyramid base');
    assert.ok(hill.radius>=6.25 && hill.radius<=20,'hill XY half the preceding frustum');
    assert.ok(hill.height>=8 && hill.height<=23,'hill Z 20% of preceding frustum');
    assert.ok(hill.topRadius<hill.radius*.55 && hill.topRadius>hill.radius*.40,
              'hill has a flat, smaller polygonal top, not a cone apex');
  }
  // Every hill territory gets between 2 and 5 separate frustums.
  const hillsByMacro=new Map();
  for(const hill of scene.peaks) hillsByMacro.set(hill.macroId,(hillsByMacro.get(hill.macroId)||0)+1);
  const hillTerritories=cells.filter(cell=>terrain[cell.macroId]==='hills');
  assert.equal(hillsByMacro.size,hillTerritories.length,'all hill territories contain relief');
  for(const cell of hillTerritories)
    assert.ok(hillsByMacro.get(cell.macroId)>=2 && hillsByMacro.get(cell.macroId)<=5,
              '2 to 5 mesas per hill territory');
  const priorPerEdge=Math.max(1,Math.min(4,Math.round(110/120)));
  assert.equal(scene.stats.mountains,priorPerEdge*3,'mountain ridge tripled relative to old count');
  assert.equal(scene.mountainSummits.length,scene.stats.mountains,'snowcap summit metadata');
  for(const mountain of scene.mountainSummits) {
    assert.ok(mountain.radius>=29 && mountain.radius<=61,'mountain base XY 200% of prior footprint');
    assert.ok(mountain.height>=28 && mountain.height<=64,'mountain Z is 50% of the prior version');
    assert.ok(Math.abs(mountain.snowyHeight/mountain.height-1/3)<1e-9,
              'snow covers upper third of hMax');
    assert.ok(Math.abs(mountain.snowStart-mountain.baseZ-mountain.height*2/3)<1e-9,
              'snowline at 2/3 total peak height');
  }
  assert.equal(scene.vertices.length,scene.stats.triangles*18);
  assert.ok(scene.vertices.every(Number.isFinite),'finite GPU vertices');
  assert.ok(scene.borders.length>0 && scene.coastlines.length>0,'aggregated visual borders + coasts');
  assert.ok(scene.trees.every(t=>terrain[t.macroId]==='forest'),'trees only in forests');
  assert.ok(scene.reeds.every(t=>terrain[t.macroId]==='swamp'),'reeds only in marshes');
  assert.ok(scene.trees.every(t=>t.size>=14.5&&t.size<=25.25),'forest scale is 2.5× original, half the last 5× sprite');
  assert.ok(scene.reeds.every(t=>t.size>=29&&t.size<=50.5),'reed scale is 5× original');
  assert.ok(scene.trees.length>=cells.filter(c=>terrain[c.macroId]==='forest').length*30,
            'forest scatter >=10x original 3 trees per territory');
  assert.ok(scene.reeds.length>=cells.filter(c=>terrain[c.macroId]==='swamp').length*10,
            'marsh scatter >=10x original 1 reed per territory');
  // The exact 2D palette is preserved for plain/forest/swamp, whereas sea/lake
  // and hills regain subtle microcell colour modulation. All modulation is
  // deterministic and relative to the authoritative World Lab base colour.
  const colorsByTerrain = {};
  for(const range of scene.pickRanges) {
    const biome = terrain[range.macroId];
    const i = range.firstVertex * 6;
    const colors = colorsByTerrain[biome] ||= new Set();
    colors.add([scene.vertices[i+3],scene.vertices[i+4],scene.vertices[i+5]].map(v=>v.toFixed(6)).join(','));
    if(['plain','forest','swamp'].includes(biome)) {
      const expected = sourceColor(fills[range.macroId]);
      for(let c=0;c<3;c++)assert.ok(Math.abs(scene.vertices[i+3+c]-expected[c]/255)<1e-6,
                                  'unmodified World Lab color for '+biome);
    }
  }
  for(const biome of ['sea','hills'])
    assert.ok(colorsByTerrain[biome]?.size>3,biome+' has visible chromatic variation');
  for(const biome of ['plain','forest','swamp'])
    assert.ok(colorsByTerrain[biome]?.size===1,biome+' retains exact original 2D palette');
  results.push({detail,ms:Math.round(ms),subcells:scene.stats.subcells,
    triangles:scene.stats.triangles,trees:scene.stats.trees,reeds:scene.stats.reeds,
    borders:scene.borders.length,MiB:+(scene.vertices.byteLength/(1024*1024)).toFixed(2)});
  if(detail===20){
    assert.equal(scene.pickRanges.length,scene.stats.subcells,'every microcell carries canonical owner metadata');
    assert.ok(scene.pickIndex.buckets.size>0,'spatial index built for picking');
    // Test the actual projected triangle, including yaw, zoom and pan.
    // Ground-plane inverse alone would pick the wrong territory on raised hills.
    const sample = scene.pickRanges.find(range=>range.macroId===33);
    assert.ok(sample && terrain[sample.macroId]==='forest');
    for(const angle of [0,Math.PI/2,-.6,1.7])for(const scale of [.7,1.4,3.2]){
      const camera={width:800,height:600,cx:snapshot.width/2,cy:snapshot.height/2,
        cos:Math.cos(angle),sin:Math.sin(angle),scale,panX:113,panY:-70};
      const points=[0,1,2].map(j=>{
        const i=(sample.firstVertex+j)*6;
        const x=scene.vertices[i]-camera.cx,y=scene.vertices[i+1]-camera.cy,z=scene.vertices[i+2];
        const qx=x*camera.cos-y*camera.sin,qy=x*camera.sin+y*camera.cos;
        return{x:camera.width/2+(qx-qy)*.8660254*scale+camera.panX,
               y:camera.height/2+((qx+qy)*.5-z*.9)*scale+camera.panY};
      });
      const sx=points.reduce((n,p)=>n+p.x,0)/3,sy=points.reduce((n,p)=>n+p.y,0)/3;
      assert.equal(pickTerritory(scene,camera,sx,sy),33,
        'pick must resolve rendered warped microcell with any camera transform');
      assert.equal(pickTerritory(scene,camera,-1e5,-1e5),null,'outside world cannot pick');
    }
    const repeat=buildScene(snapshot,detail,.65);
    assert.deepEqual(repeat.vertices,scene.vertices,'deterministic mesh');
    assert.deepEqual(repeat.borders,scene.borders,'deterministic grouped borders');
    assert.deepEqual(repeat.trees,scene.trees,'deterministic tree placement');
    assert.deepEqual(repeat.reeds,scene.reeds,'deterministic reeds');
    assert.notDeepEqual(
      buildScene(snapshot,detail,0).borders,
      scene.borders,
      'warp changes territory aggregate boundaries'
    );
  }
}
console.log('PASS region3d: weighted variable-area microcells up to ~200%, exact area conservation, mountain Z, river seams, vegetation, selection.');
console.table(results);
console.log('Synthetic CPU-only baseline. Browser/WebGL visuals and FPS remain separate checks.');
