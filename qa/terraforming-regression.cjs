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

test('clear removes player terraforming from the persisted relief model',()=>{
  context.State.relief.terraforming=[];
  api.commit(api.preview({x:100,y:100},{mode:'terrain',delta:1,radius:2}));
  assert.equal(api.clear(),1);
  assert.equal(context.State.relief.terraforming.length,0);
});

console.log(passed+' terraforming checks passed.');
