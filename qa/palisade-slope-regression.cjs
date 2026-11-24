'use strict';
// Palisades on hill flanks: a W1 palisade (plain stake line) is placeable on gentle and steep
// slopes, its site starting at the lowest ground under it; W2 (walkway) and W3 (earthwork) keep
// needing flat ground. The 3D stakes (settlement-wood3d.js) each stand on the terrain under them:
// none floats above the ground and none is buried to its body.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const src=f=>fs.readFileSync(__dirname+'/../src/'+f,'utf8').replace(/\r\n/g,'\n');
const castle=src('settlement-castle.js');
const block=castle.match(/const WALL_SLOPE_LIMIT=[\s\S]*?\nfunction wallWalkGroundAt\(s,t\)\{[\s\S]*?\n\}/)?.[0];
assert.ok(block,'use the actual wall slope code');
const grounded=castle.match(/function linearBuildGroundZ\(s\)\{[\s\S]*?\n\}/)?.[0];
assert.ok(grounded&&block.includes(grounded),'linearBuildGroundZ lives in the slope block');
// Terrain along x: flat H0 up to x=4, a slope band to x=6 (gentle or steep), flat H1 after.
const terrain={kind:'gentle'};
const elevation=p=>p.x<=4?0:p.x>=6?1:(p.x-4)/2;
const ctx=vm.createContext({Math,Number,Object,State:{relief:{seed:1,hills:[1]},structures:[],season:'summer'},
  dist:(a,b)=>Math.hypot(b.x-a.x,b.y-a.y),hasCastleSnap:()=>false,
  wallTier:s=>s.tier,
  terrainSlopeKind:p=>p.x>4&&p.x<6?terrain.kind:null,
  terrainElevation:elevation,
  structureTerrainSamples:s=>Array.from({length:21},(_,i)=>({x:s.a.x+(s.b.x-s.a.x)*i/20,y:s.a.y})),
  buildableTerrainElevationForStructure:s=>s.a.x>=6||s.b.x<=4?(s.a.x>=6?1:0):null,
  unionFootprintPoints:s=>{const h=s.width/2;return[{x:s.a.x,y:s.a.y+h},{x:s.b.x,y:s.b.y+h},{x:s.b.x,y:s.b.y-h},{x:s.a.x,y:s.a.y-h}]}});
ctx.window=ctx;
vm.runInContext(block+'\nObject.assign(this,{wallTerrainVerdict,wallSlopeSections,linearBuildGroundZ});',ctx);
const line=(type,tier,a=2,b=8)=>({type,tier,width:[0,.2,.5,1][tier],a:{x:a,y:0},b:{x:b,y:0}});
{
  for(const kind of ['gentle','steep']){
    terrain.kind=kind;
    const ok=[1,2,3].map(t=>ctx.wallTerrainVerdict(line('palisade',t)).ok);
    assert.deepEqual(ok,[true,false,false],'palisade tiers on a '+kind+' slope');
    assert.equal(ctx.linearBuildGroundZ(line('palisade',1)),0,'W1 site starts at the lowest ground');
    assert.equal(ctx.linearBuildGroundZ(line('palisade',2)),null,'W2 not buildable on a slope');
    assert.match(ctx.wallTerrainVerdict(line('palisade',3)).reason,/flat ground/,'W3 refusal says why');
    assert.equal(ctx.wallSlopeSections(line('palisade',1)),null,'a palisade is never stepped like a wall');
  }
  for(const t of [1,2,3])assert.ok(ctx.wallTerrainVerdict(line('palisade',t,0,3)).ok,'any palisade tier on flat ground');
  // Stone walls keep their own slope rules.
  terrain.kind='steep';
  assert.deepEqual([1,2,3].map(t=>ctx.wallTerrainVerdict(line('wall',t)).ok),[true,false,false],'walls unchanged');
  console.log('PASS W1 palisades placeable on hill flanks, W2-W3 flat only');
}
{
  // Seated stakes: run the real 3D palisade builder over the slope and check each stake's foot.
  const stakeModel={parts:{body:{p:[0,0,0,0,0,1,.1,0,0],i:[0,1,2],c:[0]},
    tipA:{p:[0,0,0,0,0,1,.1,0,0],i:[0,1,2],c:[0]},tipB:{p:[0,0,0,0,0,1,.1,0,0],i:[0,1,2],c:[0]},cap:{p:[0,0,0,0,0,0,.1,0,0],i:[0,1,2],c:[0]}}};
  const s={id:'p1',type:'palisade',tier:1,width:.2,a:{x:2,y:0},b:{x:8,y:0}};
  Object.assign(ctx,{ConquerWoodFortModels:{palette:['#6a4529'],paletteKeys:['wood'],models:{stake:stakeModel}},
    ConquerMesh3D:{},ConquerUtil:{hash:k=>[...String(k)].reduce((h,c)=>(h*31+c.charCodeAt(0))>>>0,7)},
    underConstruction:()=>false,isWoodGate:()=>false,isLonghouse:()=>false,isWoodTower:()=>false,
    palisadePassThroughTarget:()=>false,structureCutaway:()=>false,placementGroundZ:()=>null,
    palisadeLayout:x=>{const dx=x.b.x-x.a.x,dy=x.b.y-x.a.y,L=Math.hypot(dx,dy);
      return{a:x.a,b:x.b,dx,dy,L,tier:1,width:.2,postR:.1,postOffset:0,aTarget:null,bTarget:null,
        point:(p,o)=>({x:p.x-dy/L*o,y:p.y+dx/L*o})}},
    palisadePostOffsetAt:g=>g.postOffset});
  terrain.kind='steep';
  vm.runInContext(src('settlement-mesh3d.js'),ctx);
  vm.runInContext(src('settlement-wood3d.js'),ctx);
  const mesh=ctx.ConquerWood3D.geometry(s).mesh;
  // Body triangles: vertex 0 is the stake foot, vertex 1 the body top (model z 0..1).
  const bodies=[];
  for(let t=0;t<mesh.col.length;t++){
    const o=t*9,foot={x:mesh.pos[o],y:mesh.pos[o+1],z:mesh.pos[o+2]},top=mesh.pos[o+5];
    if(top-foot.z>.8)bodies.push({foot,top});
  }
  assert.ok(bodies.length>=30,'one stake every ~0.2U along 6U');
  for(const b of bodies){
    const g=elevation(b.foot),low=Math.min(g,elevation({x:b.foot.x-.1,y:0}),elevation({x:b.foot.x+.1,y:0}));
    assert.ok(Math.abs(b.foot.z-(low-.06))<1e-6,'stake foot on the lowest ground under it at x='+b.foot.x.toFixed(2));
    assert.ok(Math.abs(b.top-g-.93)<=.031,'stake body height measured from its own ground');
  }
  const slope=bodies.filter(b=>b.foot.x>4.2&&b.foot.x<5.8);
  assert.ok(slope.length>=6&&new Set(slope.map(b=>b.foot.z.toFixed(3))).size===slope.length,'stakes follow the slope one by one');
  console.log('PASS palisade stakes seated on the slope');
}
