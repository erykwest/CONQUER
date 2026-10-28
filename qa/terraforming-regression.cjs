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

test('square/round shape switch exists in both the Builder HTML and compact palette',()=>{
  const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
  const input=fs.readFileSync(path.join(__dirname,'..','src','settlement-app-input.js'),'utf8');
  const palette=fs.readFileSync(path.join(__dirname,'..','src','settlement-builder-ux.js'),'utf8');
  assert.match(html,/data-terraform-shape="square"/);
  assert.match(html,/data-terraform-shape="round"/);
  assert.match(input,/querySelectorAll\('\[data-terraform-shape\]'\)/);
  assert.match(input,/State\.tool\.shape=shape/);
  assert.match(palette,/selectors:\['\[data-terraform-shape\]'\]/);
});
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

test('walled terraces union overlapping footprints without a mode switch',()=>{
  const a=api.preview({x:90,y:90},{mode:'walled',delta:1,radius:4});
  assert.equal(api.commit(a),true);
  const b=api.preview({x:96,y:90},{mode:'walled',delta:1,radius:4});
  assert.equal(b.ok,true,b.reason);
  assert.equal(b.targetZ,1);
  assert.equal(api.commit(b),true);
  assert.equal(api.unionContours().length,1);
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

test('sloped terrain has a plateau and gentle side; digging can only reach H0',()=>{
  context.State.structures=[];context.State.relief.terraforming=[];
  assert.equal(api.commit(api.preview({x:100,y:100},{mode:'terrain',delta:1,radius:4})),true);
  assert.equal(api.elevationAt({x:100,y:100},0),1);
  assert.ok(Math.abs(api.elevationAt({x:105,y:100},0)-.5)<1e-6);
  assert.equal(api.slopeAt({x:105,y:100}),'gentle');
  const lower=api.preview({x:100,y:100},{mode:'terrain',delta:-1,radius:4});
  assert.equal(lower.ok,true);
  assert.equal(api.commit(lower),true);
  assert.equal(api.elevationAt({x:100,y:100},0),0);
  context.State.relief.terraforming=[];
  assert.equal(api.preview({x:100,y:100},{mode:'terrain',delta:-1,radius:4}).ok,false);
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
test('square terraces share a flat seam without any Separate option',()=>{
  context.State.relief.terraforming=[];context.State.structures=[];
  const a=api.preview({x:96,y:100},{mode:'walled',shape:'square',radius:4,delta:1,magnet:false});
  assert.equal(api.commit(a),true);
  const b=api.preview({x:104,y:100},{mode:'walled',shape:'square',radius:4,delta:1,magnet:false});
  assert.equal(b.ok,true,b.reason);
  assert.equal(b.targetZ,1);
  assert.equal(api.commit(b),true);
  const [one,two]=api.edits();
  assert.equal(api.exposedWallSegments(one,1).length,0);
  assert.equal(api.exposedWallSegments(two,3).length,0);
  assert.equal(api.elevationAt({x:100,y:100},0),1);
});
test('round terraces automatically union through partially overlapping facets',()=>{
  context.State.relief.terraforming=[];
  const first=api.preview({x:100,y:100},{mode:'walled',shape:'round',radius:4,delta:1,magnet:false});
  assert.equal(api.commit(first),true);
  const second=api.preview({x:107,y:100},{mode:'walled',shape:'round',radius:4,delta:1,magnet:false});
  assert.equal(second.ok,true,second.reason);
  assert.equal(second.targetZ,1);
  assert.equal(api.commit(second),true);
  assert.equal(api.unionContours().length,1);
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
  assert.equal(negative.baseZ,0);
  assert.equal(negative.targetZ,1);
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

test('boolean union merges partly overlapping square terraces into a concave perimeter',()=>{
  context.State.relief.terraforming=[];
  context.State.structures=[];
  context.terrainBaseElevation=()=>0;
  const a=api.preview({x:95,y:100},{mode:'walled',shape:'square',radius:4,delta:1,magnet:false});
  assert.equal(api.commit(a),true);
  // The centre is on H1, but automatic union must retain H1.
  const union=api.preview({x:98,y:102},{mode:'walled',shape:'square',radius:4,delta:1,magnet:false});
  assert.equal(union.ok,true,union.reason);
  assert.equal(union.baseZ,0);
  assert.equal(union.targetZ,1);
  assert.equal(api.commit(union),true);
  assert.equal(api.edits().length,2,'source rectangles survive for editable saves');
  assert.equal(api.elevationAt({x:94.5,y:99},0),1);
  assert.equal(api.elevationAt({x:101.5,y:105},0),1);
  assert.equal(api.slopeAt({x:96,y:104}),null,'internal seam is not a cliff');
  const contours=api.unionContours();
  assert.equal(contours.length,1,'actual union becomes one external contour');
  const outer=contours[0].points;
  const area=Math.abs(outer.reduce((sum,p,i)=>{const q=outer[(i+1)%outer.length];return sum+p.x*q.y-q.x*p.y},0))/2;
  assert.ok(Math.abs(area-98)<1e-5,'boolean outline area is 64+64 minus 30 overlap: '+area);
  assert.ok(outer.length>=6,'the merged boundary is concave');
  const [one,two]=api.edits();
  const segments=[one,two].flatMap(edit=>edit.top.flatMap((_,i)=>api.exposedWallSegments(edit,i)));
  assert.equal(segments.length,8,'concave union exposes exactly eight outer perimeter segments');
  const faces=[];
  context.meshBuilder=()=>({tris:[],face:(pts,color)=>faces.push({pts,color})});
  context.terrainElevation=p=>api.elevationAt(p,0);
  context.clipTerrainPolygon=poly=>poly;
  const tris=vm.runInContext('buildTerrain()',context);
  let groundArea=0,unionArea=0;
  for(let i=0;i<tris.length;i+=9){
    const [ax,ay,az,bx,by,bz,cx,cy,cz]=tris.slice(i,i+9);
    const a2=Math.abs((bx-ax)*(cy-ay)-(by-ay)*(cx-ax))/2;
    groundArea+=a2;
    if(az===1&&bz===1&&cz===1)unionArea+=a2;
  }
  assert.ok(Math.abs(groundArea-200*200)<.05,'no area duplication in WebGL mesh');
  assert.ok(Math.abs(unionArea-98)<.05,'WebGL triangulates one merged H1 top with no z-fighting');
  vm.runInContext('buildTerrainEdges()',context);
  const walls=faces.filter(f=>['#49443f','#686057'].includes(f.color));
  assert.equal(walls.length,segments.length,'WebGL walls follow exactly the boolean outer segments');
});
test('boolean union handles rotated/round overlaps and contained shapes',()=>{
  context.State.relief.terraforming=[];
  context.State.structures=[];
  const a=api.preview({x:100,y:100},{mode:'walled',shape:'square',radius:6,delta:1,magnet:false});
  assert.equal(api.commit(a),true);
  const rotated=api.preview({x:105,y:103},{mode:'walled',shape:'square',radius:4,delta:1,
    rotation:Math.PI/4,magnet:false});
  assert.equal(rotated.ok,true,rotated.reason);
  assert.equal(api.commit(rotated),true);
  assert.equal(api.unionContours().length,1);
  const round=api.preview({x:108,y:98},{mode:'walled',shape:'round',radius:3,delta:1,
    magnet:false});
  assert.equal(round.ok,true,round.reason);
  assert.equal(api.commit(round),true);
  assert.equal(api.unionContours().length,1,'square, rotated square and circle form one outline');
  const contained=api.preview({x:100,y:100},{mode:'walled',shape:'square',radius:2,delta:1,
    magnet:false});
  assert.equal(contained.ok,true);
  assert.equal(api.commit(contained),true);
  assert.equal(api.unionContours().length,1,'contained shapes add no internal wall');
});
test('boolean union refuses opposite elevations without destroying existing terraces',()=>{
  context.State.relief.terraforming=[];
  context.State.structures=[];
  const a=api.preview({x:100,y:100},{mode:'walled',shape:'square',radius:4,delta:1,magnet:false});
  api.commit(a);
  const low=api.preview({x:102,y:101},{mode:'walled',shape:'square',radius:4,delta:-1,magnet:false});
  assert.equal(low.ok,false);
  assert.match(low.reason,/matching base and top elevation/i);
  assert.equal(api.edits().length,1);
});
test('Flat is available in Builder and Separate/Boolean toggles no longer exist',()=>{
  const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
  const input=fs.readFileSync(path.join(__dirname,'..','src','settlement-app-input.js'),'utf8');
  const palette=fs.readFileSync(path.join(__dirname,'..','src','settlement-builder-ux.js'),'utf8');
  assert.match(html,/data-terraform="flat"/);
  assert.doesNotMatch(html,/data-terraform-boolean|Separate/);
  assert.doesNotMatch(input,/data-terraform-boolean|State\.tool\.boolean/);
  assert.match(palette,/data-terraform="flat"/);
});
test('overlapping sloped hills union without stacking from an elevated pick',()=>{
  context.State.relief.terraforming=[];context.State.structures=[];
  context.terrainBaseElevation=()=>0;
  assert.equal(api.commit(api.preview({x:92,y:100},{mode:'terrain',shape:'square',radius:4,delta:1})),true);
  const b=api.preview({x:97,y:101},{mode:'terrain',shape:'round',radius:4,delta:1});
  assert.equal(b.ok,true,b.reason);assert.equal(b.baseZ,0);assert.equal(b.targetZ,1);
  assert.equal(api.commit(b),true);
  for(let x=88;x<=101;x+=.5){
    const h=api.elevationAt({x,y:100},0);
    assert.ok(h>=0&&h<=1,'sloped union bounded between H0 and H1');
  }
  assert.equal(api.elevationAt({x:96,y:100},0),1);
});
test('Flat subtracts a square hole from a terrace without missing 3D ground',()=>{
  context.State.relief.terraforming=[];context.State.structures=[];
  context.terrainBaseElevation=()=>0;
  assert.equal(api.commit(api.preview({x:100,y:100},{mode:'walled',shape:'square',radius:4,delta:1,magnet:false})),true);
  const flat=api.preview({x:100,y:100},{mode:'flat',shape:'square',radius:2});
  assert.equal(flat.ok,true);assert.equal(flat.targetZ,0);
  assert.equal(api.commit(flat),true);
  assert.equal(api.elevationAt({x:100,y:100},0),0);
  assert.equal(api.elevationAt({x:97,y:100},0),1);
  assert.equal(api.visibleTerracePieces(api.edits()[0]).length,4);
  assert.equal(api.flatWallSegments(api.edits()[1]).length,4);
  const tris=vm.runInContext('buildTerrain()',context);
  let area=0,raised=0;
  for(let i=0;i<tris.length;i+=9){
    const [ax,ay,az,bx,by,bz,cx,cy,cz]=tris.slice(i,i+9);
    const a=Math.abs((bx-ax)*(cy-ay)-(by-ay)*(cx-ax))/2;
    area+=a;if(az===1&&bz===1&&cz===1)raised+=a;
  }
  assert.ok(Math.abs(area-40000)<.05,'no overlapping/missing mesh triangles');
  assert.ok(Math.abs(raised-48)<.05,'8×8 raised plateau less a 4×4 Flat cut');
});
test('Flat closes the side of a graded slope with continuously varying heights',()=>{
  context.State.relief.terraforming=[];context.State.structures=[];
  context.terrainBaseElevation=()=>0;
  const hill=api.preview({x:100,y:100},{mode:'terrain',shape:'square',radius:4,delta:1,magnet:false});
  assert.equal(api.commit(hill),true);
  const cut=api.preview({x:104.5,y:100},{mode:'flat',shape:'square',radius:2});
  assert.equal(cut.ok,true,cut.reason);
  assert.equal(api.commit(cut),true);
  assert.equal(api.elevationAt({x:104,y:100},0),0,'inside Flat is H0');
  assert.ok(api.elevationAt({x:104,y:102.01},0)>.01,'uphill side survives immediately outside the cut');
  const faces=api.flatWallSegments(api.edits()[1]);
  assert.ok(faces.length>4,'the variable-height slope is sampled more finely than four static quads');
  assert.ok(faces.some(f=>Math.abs(f.targetZ-f.targetZB)>.01),
    'cut top follows the changing height of the graded slope');
  assert.ok(faces.every(f=>f.baseZ>=0&&f.baseZB>=0&&f.targetZ>=0&&f.targetZB>=0));
  assert.ok(faces.some(f=>f.targetZ>.2)&&faces.some(f=>f.targetZ<.99),
    'cut wall has intermediate top heights, not one extruded constant H');
  const mesh=[];
  context.meshBuilder=()=>({tris:[],face:(points,color)=>mesh.push({points,color})});
  context.terrainElevation=p=>api.elevationAt(p,0);
  const triangles=vm.runInContext('buildTerrain()',context);
  let area=0;
  for(let i=0;i<triangles.length;i+=9){
    const [ax,ay,,bx,by,,cx,cy]=triangles.slice(i,i+9);
    area+=Math.abs((bx-ax)*(cy-ay)-(by-ay)*(cx-ax))/2;
  }
  assert.ok(Math.abs(area-40000)<.05,'slope and Flat meet without missing or duplicated ground area');
  vm.runInContext('buildTerrainEdges()',context);
  const walls=mesh.filter(f=>f.color==='#686057');
  assert.ok(walls.length>=faces.length,'WebGL creates an actual vertical face for each sampled cut segment');
  assert.ok(walls.some(({points})=>Math.abs(points[2].z-points[3].z)>.01),
    'WebGL wall top is allowed to slope between the two endpoints');
  assert.ok(walls.every(({points})=>points.every(p=>Number.isFinite(p.z))));
});
test('Flat cuts a natural slope and does not create walls on untouched H0',()=>{
  context.State.relief.terraforming=[];context.State.structures=[];
  context.terrainBaseElevation=p=>Math.max(0,(p.x-95)/7);
  const empty=api.preview({x:85,y:100},{mode:'flat',shape:'square',radius:2});
  assert.equal(api.commit(empty),true);
  assert.equal(api.flatWallSegments(api.edits()[0]).length,0,'no unnecessary wall on H0 ground');
  const cut=api.preview({x:100,y:100},{mode:'flat',shape:'round',radius:3});
  assert.equal(api.commit(cut),true);
  const walls=api.flatWallSegments(api.edits()[1]);
  assert.ok(walls.length>0,'even natural relief needs a cut retaining face');
  assert.ok(walls.some(f=>Math.abs(f.targetZ-f.targetZB)>.002),'natural slope varies along cut ring');
  assert.equal(api.elevationAt({x:100,y:100},context.terrainBaseElevation({x:100,y:100})),0);
  assert.ok(api.elevationAt({x:104,y:100},context.terrainBaseElevation({x:104,y:100}))>0);
  context.terrainBaseElevation=()=>0;
});
test('Flat sets natural terrain to H0 and later works can rebuild',()=>{
  context.State.relief.terraforming=[];context.State.structures=[];
  context.terrainBaseElevation=()=>2.35;
  assert.equal(api.commit(api.preview({x:100,y:100},{mode:'flat',radius:4})),true);
  assert.equal(api.elevationAt({x:100,y:100},2.35),0);
  assert.ok(api.elevationAt({x:106,y:100},2.35)>0);
  const fresh=api.preview({x:100,y:100},{mode:'terrain',shape:'square',radius:2,delta:1});
  assert.equal(fresh.baseZ,0);assert.equal(fresh.targetZ,1);
  assert.equal(api.commit(fresh),true);
  assert.equal(api.elevationAt({x:100,y:100},2.35),1);
  context.terrainBaseElevation=()=>0;
});
test('nonnegative H floor and migration of legacy below-ground terrain',()=>{
  context.State.relief.terraforming=[];context.State.structures=[];
  assert.equal(api.LIMITS.minZ,0);
  const down=api.preview({x:100,y:100},{mode:'walled',delta:-1,radius:3,magnet:false});
  assert.equal(down.ok,false);assert.equal(api.commit(down),false);
  context.State.relief.terraforming=[{
    id:'old-neg',mode:'terrain',shape:'square',center:{x:102,y:102},radius:2,rotation:0,
    top:[{x:100,y:100},{x:104,y:100},{x:104,y:104},{x:100,y:104}],
    outer:[{x:98,y:98},{x:106,y:98},{x:106,y:106},{x:98,y:106}],
    baseZ:0,targetZ:-1,edgeWidth:2
  }];
  assert.equal(api.edits()[0].mode,'flat');
  assert.equal(api.elevationAt({x:102,y:102},0),0);
});
test('Flat H0 masks natural steep or gentle relief for placement and navigation',()=>{
  context.State.relief.terraforming=[];context.State.structures=[];
  context.terrainBaseElevation=()=>1.5;
  const natural=fs.readFileSync(path.join(__dirname,'..','src','settlement-castle.js'),'utf8');
  const source=natural.match(/function terrainSlopeKind\(p\)\{[\s\S]*?\n\}/)?.[0];
  assert.ok(source,'terrainSlopeKind uses a separate relief fallback');
  const sandbox=vm.createContext({window:context.window,reliefBandAt:()=>({kind:'steep'})});
  vm.runInContext(source,sandbox);
  assert.equal(sandbox.terrainSlopeKind({x:100,y:100}),'steep');
  assert.equal(api.commit(api.preview({x:100,y:100},{mode:'flat',shape:'square',radius:2})),true);
  assert.equal(sandbox.terrainSlopeKind({x:100,y:100}),null,'a flattened hill is no longer naturally steep');
  assert.equal(sandbox.terrainSlopeKind({x:110,y:110}),'steep','non-flattened relief remains untouched');
  context.terrainBaseElevation=()=>0;
});
test('boolean contour and mesh fragments are memoized until terrain edits change',()=>{
  context.State.relief.terraforming=[];context.State.structures=[];context.terrainBaseElevation=()=>0;
  assert.equal(api.commit(api.preview({x:95,y:100},{mode:'walled',shape:'square',radius:4,delta:1,magnet:false})),true);
  assert.equal(api.commit(api.preview({x:99,y:102},{mode:'walled',shape:'square',radius:4,delta:1,magnet:false})),true);
  const [first,second]=api.edits();
  const exposed=api.exposedWallSegments(first,0);
  const pieces=api.visibleTerracePieces(second);
  assert.strictEqual(api.exposedWallSegments(first,0),exposed,'an unchanged boundary is not re-clipped');
  assert.strictEqual(api.visibleTerracePieces(second),pieces,'an unchanged top is not re-subtracted');
  assert.equal(api.commit(api.preview({x:105,y:103},{mode:'walled',shape:'square',radius:4,delta:1,magnet:false})),true);
  assert.notStrictEqual(api.exposedWallSegments(first,0),exposed,'a new edit invalidates derived perimeters');
  assert.notStrictEqual(api.visibleTerracePieces(second),pieces,'a new edit invalidates mesh fragments');
});
test('spatial broadphase skips every distant polygon during height sampling',()=>{
  context.State.relief.terraforming=[];context.State.structures=[];context.terrainBaseElevation=()=>0;
  for(let i=0;i<10;i++){
    assert.equal(api.commit(api.preview({x:65+i*8,y:100},{mode:'terrain',shape:'round',radius:3,delta:1,magnet:false})),true);
  }
  const original=context.pointInPolygon;
  let checks=0;
  context.pointInPolygon=(p,poly)=>{checks++;return original(p,poly)};
  try{
    for(let i=0;i<400;i++)assert.equal(api.elevationAt({x:15+i%10,y:15+Math.floor(i/10)},0),0);
    assert.equal(checks,0,'no polygon winding test for faraway points');
    assert.ok(api.elevationAt({x:65,y:100},0)>0,'nearby points still use real polygon test');
    assert.ok(checks>0,'spatial rejection does not bypass valid geometry');
  }finally{context.pointInPolygon=original;}
});
test('WebGL terrain samples each grid vertex once instead of four times per cell',()=>{
  context.State.relief.terraforming=[];context.State.structures=[];
  let samples=0;
  context.terrainBaseElevation=()=>{samples++;return 0};
  assert.equal(api.commit(api.preview({x:90,y:100},{mode:'walled',shape:'square',radius:4,delta:1,magnet:false})),true);
  samples=0;
  const started=process.hrtime.bigint();
  const result=vm.runInContext('buildTerrain()',context);
  const elapsedMs=Number(process.hrtime.bigint()-started)/1e6;
  assert.ok(result.length>0);
  assert.ok(samples<80000,'height sampled once per vertex, not once per triangle corner: '+samples);
  assert.ok(elapsedMs<10000,'small edited map should not spend many seconds recalculating booleans: '+elapsedMs.toFixed(0)+'ms');
  console.log('  terrain mesh performance: '+samples+' height samples; '+elapsedMs.toFixed(0)+'ms');
  context.terrainBaseElevation=()=>0;
});
test('rebuilding many walled/Flat booleans remains bounded and preserves world area',()=>{
  context.State.relief.terraforming=[];context.State.structures=[];context.terrainBaseElevation=()=>0;
  for(let i=0;i<12;i++){
    const x=65+i%4*17,y=68+Math.floor(i/4)*18;
    const shape=i%2?'round':'square';
    assert.equal(api.commit(api.preview({x,y},{mode:'walled',shape,radius:4,delta:1,magnet:false})),true);
  }
  for(let i=0;i<4;i++){
    assert.equal(api.commit(api.preview({x:65+i*17,y:68},{mode:'flat',shape:'square',radius:2})),true);
  }
  const start=process.hrtime.bigint();
  const triangles=vm.runInContext('buildTerrain()',context);
  const elapsed=Number(process.hrtime.bigint()-start)/1e6;
  assert.ok(elapsed<10000,'16 independent CSG edits should rebuild without extreme delays: '+elapsed.toFixed(0)+'ms');
  let total=0;
  for(let i=0;i<triangles.length;i+=9){
    const [ax,ay,,bx,by,,cx,cy]=triangles.slice(i,i+9);
    total+=Math.abs((bx-ax)*(cy-ay)-(by-ay)*(cx-ax))/2;
  }
  assert.ok(Math.abs(total-40000)<.1,'CSG still tessellates exactly the complete world');
  console.log('  16 boolean edits: terrain mesh '+elapsed.toFixed(0)+'ms');
});
test('terraform footprint refuses buildings and road corridors, not just occupied centres',()=>{
  context.State.relief.terraforming=[];context.State.environment=[];
  context.terrainBaseElevation=()=>0;
  context.State.structures=[{id:'tower',type:'tower',x:103.8,y:100,r:1}];
  for(const mode of ['terrain','walled','flat']){
    const g=api.preview({x:100,y:100},{mode,shape:'round',radius:3,delta:1,magnet:false});
    assert.equal(g.ok,false,mode+' cannot clip a tower near the outside edge');
    assert.match(g.reason,/structure/);
  }
  context.State.structures=[{id:'road',type:'road',a:{x:93,y:104},b:{x:110,y:104},width:1}];
  for(const mode of ['terrain','walled','flat']){
    const g=api.preview({x:100,y:100},{mode,shape:'square',radius:4,delta:1,magnet:false});
    assert.equal(g.ok,false,mode+' cannot run a new footprint across a road');
    assert.match(g.reason,/structure/);
  }
  // No false positive when a road is merely near the new worksite.
  context.State.structures=[{id:'road',type:'road',a:{x:120,y:120},b:{x:130,y:120},width:1}];
  assert.equal(api.preview({x:100,y:100},{mode:'flat',radius:4}).ok,true);
  context.State.structures=[];
});
test('the real building footprint is used, including concave/rectangular parts',()=>{
  context.State.relief.terraforming=[];context.State.environment=[];
  context.State.structures=[{id:'large',type:'church',x:111,y:100}];
  context.footprintPoints=s=>s.type==='church'?
    [{x:98,y:97},{x:102,y:97},{x:102,y:99},{x:98,y:99}]:[];
  try{
    for(const mode of ['flat','terrain','walled']){
      const g=api.preview({x:100,y:100},{mode,shape:'square',radius:3,magnet:false});
      assert.equal(g.ok,false,mode+' must test real footprint, not the position of the structure');
    }
  }finally{delete context.footprintPoints;context.State.structures=[];}
});
test('lakes, streams, rivers and shoreline water block every terraforming type',()=>{
  context.State.structures=[];context.State.relief.terraforming=[];
  const cases=[
    {type:'stream',points:[{x:96,y:100},{x:104,y:100}],width:1},
    {type:'river',points:[{x:90,y:102},{x:110,y:102}],width:3.2},
    {type:'pond',points:[{x:102,y:99},{x:107,y:99},{x:107,y:104},{x:102,y:104}]},
    {type:'lake',points:[{x:97,y:97},{x:102,y:97},{x:102,y:102},{x:97,y:102}]},
    {type:'sea',points:[{x:94,y:94},{x:100,y:94},{x:100,y:100},{x:94,y:100}]}
  ];
  for(const water of cases){
    context.State.environment=[water];
    for(const mode of ['terrain','walled','flat']){
      const g=api.preview({x:100,y:100},{mode,shape:'square',radius:3,magnet:false});
      assert.equal(g.ok,false,water.type+' must block '+mode);
      assert.match(g.reason,/watercourse|lake/);
    }
  }
  context.State.environment=[];
});
test('Flat is allowed across buildable border if and only if its centre stays inside',()=>{
  context.State.relief.terraforming=[];context.State.structures=[];context.State.environment=[];
  const inside=api.preview({x:51,y:100},{mode:'flat',shape:'square',radius:6});
  assert.equal(inside.ok,true,inside.reason);
  assert.ok(inside.top.some(p=>p.x<50));
  assert.equal(api.commit(inside),true);
  assert.equal(api.elevationAt({x:47,y:100},2),0,'Flat reaches beyond buildable edge');
  const out=api.preview({x:49.9,y:100},{mode:'flat',shape:'square',radius:3});
  assert.equal(out.ok,false);
  assert.match(out.reason,/centre.*buildable/i);
  assert.equal(api.preview({x:51,y:100},{mode:'terrain',shape:'square',radius:4}).ok,false,
    'graded terraforming still requires the full outside apron within the border');
  assert.equal(api.preview({x:51,y:100},{mode:'walled',shape:'square',radius:4,magnet:false}).ok,false);
});
test('Flat subtracts all older intersecting graded tops, aprons and masonry boundaries',()=>{
  context.State.relief.terraforming=[];context.State.structures=[];context.State.environment=[];
  context.terrainBaseElevation=()=>0;
  assert.equal(api.commit(api.preview({x:100,y:100},{mode:'terrain',shape:'square',radius:4,delta:1})),true);
  const hill=api.edits()[0];
  const cut=api.preview({x:102,y:100},{mode:'flat',shape:'square',radius:4});
  assert.equal(api.commit(cut),true);
  for(let x=98;x<=106;x+=.25)for(let y=96;y<=104;y+=2)
    assert.equal(api.elevationAt({x,y},0),0,'inside Flat no original raised terrain may survive');
  assert.ok(api.elevationAt({x:96,y:100},0)>0,'outside Flat the old shape still exists');
  const source=fs.readFileSync(path.join(__dirname,'..','src','settlement-terraforming.js'),'utf8');
  assert.match(source,/visible=visible\.flatMap\(poly=>subtractPolygon\(poly,newer\.top\)\)/,
    'the old sloped faces are actually cut in Canvas rather than merely overpainted');
  // A masonry wall that is only half covered must retain the uncovered half.
  context.State.relief.terraforming=[];context.State.structures=[];
  assert.equal(api.commit(api.preview({x:100,y:100},{mode:'walled',shape:'square',radius:4,delta:1,magnet:false})),true);
  assert.equal(api.commit(api.preview({x:104,y:102},{mode:'flat',shape:'square',radius:2})),true);
  const old=api.edits()[0];
  const edge=api.exposedWallSegments(old,1);
  assert.ok(edge.length>0,'the uncovered remainder of a cut wall still exists');
  const visibleLen=edge.reduce((sum,{a,b})=>sum+Math.hypot(b.x-a.x,b.y-a.y),0);
  assert.ok(visibleLen>0&&visibleLen<8,'a partial cut splits a wall, it does not remove or retain all of it');
  assert.equal(api.elevationAt({x:103.5,y:102},0),0,'flat removes H even adjacent to the cut wall');
});
test('clear removes player terraforming from the persisted relief model',()=>{
  context.State.relief.terraforming=[];
  api.commit(api.preview({x:100,y:100},{mode:'terrain',delta:1,radius:2}));
  assert.equal(api.clear(),1);
  assert.equal(context.State.relief.terraforming.length,0);
});

console.log(passed+' terraforming checks passed.');
