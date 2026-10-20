const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

const source=fs.readFileSync(path.join(__dirname,'..','src','settlement-terraforming.js'),'utf8');
const context={
  console,
  window:{},
  State:{relief:{hills:[],terraforming:[]},structures:[],environment:[]},
  BUILD_MIN:50,BUILD_MAX:150,WORLD:200,
  clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),
  dist:(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),
  terrainBaseElevation:()=>0,
  pointInPolygon:(p,poly)=>{
    let inside=false;
    for(let i=0,j=poly.length-1;i<poly.length;j=i++){
      const a=poly[i],b=poly[j];
      if(((a.y>p.y)!==(b.y>p.y))&&(p.x<(b.x-a.x)*(p.y-a.y)/((b.y-a.y)||1e-9)+a.x))inside=!inside;
    }
    return inside;
  }
};
vm.createContext(context);
vm.runInContext(source,context,{filename:'settlement-terraforming.js'});
const api=context.window.ConquerTerraforming;

let passed=0;
function test(name,fn){fn();passed++;console.log('PASS '+name)}

test('ghost previews the final terrain without mutating relief',()=>{
  const before=JSON.stringify(context.State.relief);
  const ghost=api.preview({x:100,y:100},{mode:'terrain',delta:1,radius:4});
  assert.equal(ghost.ok,true);
  assert.equal(ghost.mode,'terrain');
  assert.equal(ghost.baseZ,0);
  assert.equal(ghost.targetZ,1);
  assert.equal(ghost.top.length,24);
  assert.equal(JSON.stringify(context.State.relief),before);
});

test('a walled terrace cannot overlap another walled terrace',()=>{
  const first=api.preview({x:90,y:90},{mode:'walled',delta:1,radius:4});
  assert.equal(api.commit(first),true);
  const overlap=api.preview({x:96,y:90},{mode:'walled',delta:1,radius:4});
  assert.equal(overlap.ok,false);
  assert.match(overlap.reason,/another walled terrace/i);
  const separate=api.preview({x:110,y:90},{mode:'walled',delta:1,radius:4});
  assert.equal(separate.ok,true);
});

test('a walled terrace has exactly vertical masonry faces and a flat top',()=>{
  context.State.relief.terraforming=[];
  const ghost=api.preview({x:100,y:100},{mode:'walled',delta:1,radius:4,magnet:false});
  assert.equal(ghost.profile,'vertical');
  assert.equal(ghost.material,'stone');
  assert.equal(ghost.edgeWidth,0);
  assert.deepEqual(ghost.outer,ghost.top);
  api.commit(ghost);
  assert.equal(api.elevationAt({x:103.9,y:100},0),1);
  assert.equal(api.elevationAt({x:104.01,y:100},0),0);
  assert.equal(api.slopeAt({x:103.97,y:100}),'steep');
});

test('saved sloped terraces migrate to the vertical masonry profile',()=>{
  context.State.relief.terraforming=[{
    id:'terraform-legacy',mode:'walled',center:{x:100,y:100},radius:4,
    baseZ:0,targetZ:1,edgeWidth:1.25,rotation:0,profile:'sloped',material:'stone',
    top:[{x:104,y:100}],outer:[{x:104.12,y:100}]
  }];
  const migrated=api.edits()[0];
  assert.equal(migrated.profile,'vertical');
  assert.equal(migrated.material,'stone');
  assert.equal(migrated.edgeWidth,0);
  assert.deepEqual(migrated.outer,migrated.top);
});

test('walled terrace magnet aligns its edge to the near wall face',()=>{
  context.State.relief.terraforming=[];
  context.State.structures=[{id:'wall-1',type:'wall',a:{x:80,y:100},b:{x:120,y:100},width:.5}];
  const ghost=api.preview({x:100,y:95},{mode:'walled',delta:1,radius:4});
  assert.equal(ghost.ok,true);
  assert.equal(ghost.wallSnap.structureId,'wall-1');
  assert.ok(Math.abs(ghost.wallSnap.facePoint.y-99.75)<1e-6);
  const edge=ghost.top.slice().sort((a,b)=>b.y-a.y).slice(0,2);
  assert.ok(edge.every(p=>Math.abs(p.y-99.75)<1e-6));
});

test('committed terrain edits expose plateau, slope and excavation elevation',()=>{
  context.State.structures=[];
  context.State.relief.terraforming=[];
  assert.equal(api.commit(api.preview({x:100,y:100},{mode:'terrain',delta:1,radius:4})),true);
  assert.equal(api.elevationAt({x:100,y:100},0),1);
  assert.ok(Math.abs(api.elevationAt({x:105,y:100},0)-.5)<1e-6);
  assert.equal(api.elevationAt({x:107,y:100},0),0);
  assert.equal(api.slopeAt({x:105,y:100}),'gentle');
  context.State.relief.terraforming=[];
  assert.equal(api.commit(api.preview({x:100,y:100},{mode:'terrain',delta:-1,radius:4})),true);
  assert.equal(api.elevationAt({x:100,y:100},0),-1);
});

test('wall endpoints magnetize to a walled terrace edge',()=>{
  context.State.relief.terraforming=[];
  const terrace=api.preview({x:100,y:100},{mode:'walled',delta:1,radius:4,magnet:false});
  assert.equal(api.commit(terrace),true);
  const edit=context.State.relief.terraforming[0],vertex=edit.top[0];
  const snap=api.snapWallAnchor({x:vertex.x+.2,y:vertex.y+.1},.5);
  assert.equal(snap.structureId,'terraform:'+edit.id);
  assert.ok(Math.hypot(snap.edgePoint.x-vertex.x,snap.edgePoint.y-vertex.y)<1e-6);
  assert.ok(Math.abs(Math.hypot(snap.point.x-vertex.x,snap.point.y-vertex.y)-.25)<1e-6);
  assert.equal(api.wallGroundZ({type:'wall',aSnap:snap.structureId,bSnap:snap.structureId}),1);
});

test('free terrace edges share the walls 15 degree angle lattice',()=>{
  context.State.relief.terraforming=[];
  const ghost=api.preview({x:100,y:100},{mode:'walled',delta:1,radius:4,magnet:false});
  for(let i=0;i<ghost.top.length;i++){
    const a=ghost.top[i],b=ghost.top[(i+1)%ghost.top.length];
    const degrees=Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI;
    assert.ok(Math.abs(degrees/15-Math.round(degrees/15))<1e-9,'edge '+i+' is '+degrees+' degrees');
  }
});

test('WebGL terrain cuts a sharp step and closes it with vertical wall-colour faces',()=>{
  context.State.relief.terraforming=[];
  api.commit(api.preview({x:100,y:100},{mode:'walled',radius:4,delta:1,magnet:false}));
  const world=fs.readFileSync(path.join(__dirname,'..','src','settlement-world3d.js'),'utf8');
  const faces=[];
  context.meshBuilder=()=>({tris:[],face:(points,color)=>faces.push({points,color})});
  context.terrainElevation=p=>api.elevationAt(p,0);
  context.clipTerrainPolygon=poly=>poly;
  vm.runInContext(world.slice(world.indexOf('  function buildTerrain(){'),world.indexOf('  // Mountains as raised fans')),context);
  vm.runInContext(world.slice(world.indexOf('  const EDGE_STEP='),world.indexOf('  // Bake the existing 2D ground')),context);
  const triangles=vm.runInContext('buildTerrain()',context);
  let area=0;
  for(let i=0;i<triangles.length;i+=9){
    const [ax,ay,az,bx,by,bz,cx,cy,cz]=triangles.slice(i,i+9);
    assert.equal(az,bz);assert.equal(bz,cz,'terrain triangle must not bridge the vertical step');
    area+=Math.abs((bx-ax)*(cy-ay)-(by-ay)*(cx-ax))/2;
  }
  assert.ok(Math.abs(area-context.WORLD**2)<.05,'ground and terrace top cover the world without holes or overlap');
  vm.runInContext('buildTerrainEdges()',context);
  const walls=faces.filter(f=>['#49443f','#686057'].includes(f.color));
  assert.equal(walls.length,24);
  for(const {points:[a,b,c,d]} of walls){
    assert.equal(a.x,d.x);assert.equal(a.y,d.y);
    assert.equal(b.x,c.x);assert.equal(b.y,c.y);
    assert.equal(a.z,0);assert.equal(d.z,1);
  }
});

test('square terraforming is selectable and produces a true four-corner footprint',()=>{
  context.State.relief.terraforming=[];
  const square=api.preview({x:100,y:100},{mode:'walled',shape:'square',radius:4,delta:1,magnet:false});
  assert.equal(square.ok,true);
  assert.equal(square.shape,'square');
  assert.equal(square.top.length,4);
  assert.deepEqual(JSON.parse(JSON.stringify(square.top)),[
    {x:96,y:96},{x:104,y:96},{x:104,y:104},{x:96,y:104}
  ]);
  assert.equal(api.commit(square),true);
  assert.equal(api.elevationAt({x:103.9,y:103.9},0),1);
  assert.equal(api.elevationAt({x:104.1,y:104.1},0),0);
  assert.equal(api.slopeAt({x:103.95,y:100}),'steep');
  assert.equal(context.State.relief.terraforming[0].shape,'square','saved shape persists');
  const reload=api.edits()[0];
  assert.equal(reload.top.length,4,'reload keeps the square instead of converting to 24-sided shape');
});
test('square hills interpolate their graded sides and merge laterally at the same H',()=>{
  context.State.relief.terraforming=[];
  context.terrainBaseElevation=()=>0;
  const a=api.preview({x:94,y:100},{mode:'terrain',shape:'square',radius:4,delta:1,magnet:false});
  assert.equal(api.commit(a),true);
  const b=api.preview({x:102,y:100},{mode:'terrain',shape:'square',radius:4,delta:1,magnet:false});
  assert.equal(b.ok,true);
  assert.equal(api.commit(b),true);
  assert.equal(api.elevationAt({x:98,y:100},0),1,'the common hill edge does not fall back to H0');
  assert.equal(api.elevationAt({x:97.5,y:100},0),1);
  assert.equal(api.elevationAt({x:98.5,y:100},0),1);
  assert.ok(api.elevationAt({x:107,y:100},0)>0,'the second slope tapers away');
});
test('square masonry terraces magnetize flush to each other without internal walls',()=>{
  context.State.relief.terraforming=[];
  const first=api.preview({x:96,y:100},{mode:'walled',shape:'square',radius:4,delta:1,magnet:false});
  assert.equal(api.commit(first),true);
  const second=api.preview({x:104.3,y:100},{mode:'walled',shape:'square',radius:4,delta:1});
  assert.equal(second.ok,true);
  assert.equal(second.terraceSnap.terraceId,context.State.relief.terraforming[0].id);
  assert.equal(second.center.x,104);
  assert.equal(second.baseZ,0);
  assert.equal(second.targetZ,1);
  assert.equal(api.commit(second),true);
  const [one,two]=api.edits();
  assert.equal(api.exposedWallSegments(one,1).length,0,'shared right wall removed');
  assert.equal(api.exposedWallSegments(two,3).length,0,'shared left wall removed');
  assert.equal(api.elevationAt({x:100,y:100},0),1,'seam is continuous at H1');
  const overlap=api.preview({x:98,y:100},{mode:'walled',shape:'square',radius:4,delta:1,magnet:false});
  assert.equal(overlap.ok,false,'nonzero interior overlap is still forbidden');
  const faces=[];
  context.meshBuilder=()=>({tris:[],face:(points,color)=>faces.push({points,color})});
  context.terrainElevation=p=>api.elevationAt(p,0);
  context.clipTerrainPolygon=poly=>poly;
  // Reuse actual WebGL functions already compiled by the earlier test.
  const tris=vm.runInContext('buildTerrain()',context);
  let total=0;
  for(let i=0;i<tris.length;i+=9){
    const [ax,ay,,bx,by,,cx,cy]=tris.slice(i,i+9);
    total+=Math.abs((bx-ax)*(cy-ay)-(by-ay)*(cx-ax))/2;
  }
  assert.ok(Math.abs(total-context.WORLD**2)<.05,'two adjacent square tops exactly tile the 3D ground');
  vm.runInContext('buildTerrainEdges()',context);
  assert.equal(faces.filter(f=>['#49443f','#686057'].includes(f.color)).length,6,
    'six exterior masonry faces, no two overlapping internal ones');
});
test('round terraces also join along an actual facet rather than just touch at one point',()=>{
  context.State.relief.terraforming=[];
  const parent=api.preview({x:100,y:100},{mode:'walled',shape:'round',radius:4,delta:1,magnet:false});
  assert.equal(api.commit(parent),true);
  const support=4*Math.cos(Math.PI/24);
  const next=api.preview({x:100+2*support+.08,y:100},{mode:'walled',shape:'round',radius:4,delta:1});
  assert.equal(next.ok,true);
  assert.ok(next.terraceSnap);
  assert.ok(Math.abs(next.center.x-(100+2*support))<1e-6);
  assert.equal(next.targetZ,1);
  assert.equal(api.commit(next),true);
  const [a,b]=api.edits();
  assert.equal(api.exposedWallSegments(a,0).length,0);
  assert.equal(api.exposedWallSegments(b,12).length,0);
  assert.equal(api.elevationAt({x:100+support,y:100},0),1);
});
test('picked fractional point heights always round UP to a full integer before edit',()=>{
  context.State.relief.terraforming=[];
  context.terrainBaseElevation=()=>1.01;
  const raised=api.preview({x:110,y:110},{mode:'walled',shape:'square',delta:1,radius:2,magnet:false});
  assert.equal(raised.baseZ,2);
  assert.equal(raised.targetZ,3);
  const lowered=api.preview({x:110,y:110},{mode:'terrain',delta:-1,radius:2,magnet:false});
  assert.equal(lowered.baseZ,2);
  assert.equal(lowered.targetZ,1);
  context.terrainBaseElevation=()=>-1.01;
  const negative=api.preview({x:110,y:110},{mode:'walled',delta:1,radius:2,magnet:false});
  assert.equal(negative.baseZ,-1);
  assert.equal(negative.targetZ,0);
  context.terrainBaseElevation=()=>0;
});
test('legacy round terraces keep 24 sides while saved squares keep four',()=>{
  context.State.relief.terraforming=[
    {id:'legacy-circle',mode:'walled',center:{x:90,y:90},radius:2,baseZ:0,targetZ:1,rotation:0},
    {id:'square-save',mode:'walled',shape:'square',center:{x:100,y:100},radius:2,baseZ:0,targetZ:1,rotation:0}
  ];
  assert.equal(api.edits()[0].top.length,24);
  assert.equal(api.edits()[1].top.length,4);
});

test('clear removes player terraforming from the persisted relief model',()=>{
  context.State.relief.terraforming=[];
  api.commit(api.preview({x:100,y:100},{mode:'terrain',delta:1,radius:2}));
  assert.equal(api.clear(),1);
  assert.equal(context.State.relief.terraforming.length,0);
});

console.log(passed+' terraforming checks passed.');
