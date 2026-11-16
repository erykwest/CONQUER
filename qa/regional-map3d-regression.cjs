'use strict';
// Run: node qa/regional-map3d-regression.cjs
// New regional pipeline: global micro-Voronoi => warped macro aggregates.
// Keep the authoritative 2D topology and territory RGB untouched.
const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');
const { area, subdivide, globalMicrocells, sourceColor, buildScene, pickTerritory } =
  require('../src/regional-map3d-geometry.js');

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
    assert.ok(hill.radius>=12.5 && hill.radius<=40,'hill horizontal size 5x');
    assert.ok(hill.height>=40 && hill.height<=115,'hill elevation size 5x');
    assert.ok(hill.topRadius<hill.radius*.55 && hill.topRadius>hill.radius*.40,
              'hill has a flat, smaller polygonal top, not a cone apex');
  }
  assert.equal(scene.mountainSummits.length,scene.stats.mountains,'snowcap summit metadata');
  for(const mountain of scene.mountainSummits) {
    assert.ok(mountain.radius>=14.5 && mountain.radius<=30.5,'mountain footprint >=5x');
    assert.ok(mountain.height>=56 && mountain.height<=128,'mountain height >=5x');
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
console.log('PASS region3d: global microcells, 5x hill frustums, 5x/8x snowy mountains, palette, vegetation and selection.');
console.table(results);
console.log('Synthetic CPU-only baseline. Browser/WebGL visuals and FPS remain separate checks.');
