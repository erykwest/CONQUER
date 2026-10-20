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

test('a walled terrace exposes a visible sloped masonry revetment',()=>{
  context.State.relief.terraforming=[];
  const ghost=api.preview({x:100,y:100},{mode:'walled',delta:1,radius:4,magnet:false});
  assert.equal(ghost.profile,'sloped');
  assert.equal(ghost.material,'stone');
  assert.ok(ghost.edgeWidth>=Math.abs(ghost.targetZ-ghost.baseZ));
  assert.ok(ghost.outer[0].x-ghost.top[0].x>.9);
});

test('saved vertical terraces migrate to the sloped masonry profile',()=>{
  context.State.relief.terraforming=[{
    id:'terraform-legacy',mode:'walled',center:{x:100,y:100},radius:4,
    baseZ:0,targetZ:1,edgeWidth:.12,rotation:0,
    top:[{x:104,y:100}],outer:[{x:104.12,y:100}]
  }];
  const migrated=api.edits()[0];
  assert.equal(migrated.profile,'sloped');
  assert.equal(migrated.material,'stone');
  assert.ok(migrated.edgeWidth>=1.25);
  assert.ok(migrated.outer[0].x-migrated.top[0].x>.9);
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

test('clear removes player terraforming from the persisted relief model',()=>{
  context.State.relief.terraforming=[];
  api.commit(api.preview({x:100,y:100},{mode:'terrain',delta:1,radius:2}));
  assert.equal(api.clear(),1);
  assert.equal(context.State.relief.terraforming.length,0);
});

console.log(passed+' terraforming checks passed.');
