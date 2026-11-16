'use strict';
// Walls on slopes: T1 (thin, no wall-walk) on gentle and steep slopes, T2 on gentle slopes only, T3
// on flat ground only; a wall on a slope is stepped, each section standing on the terrain under it.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const castle=fs.readFileSync(__dirname+'/../src/settlement-castle.js','utf8').replace(/\r\n/g,'\n');
const block=castle.match(/const WALL_SLOPE_LIMIT=[\s\S]*?\nfunction wallWalkGroundAt\(s,t\)\{[\s\S]*?\n\}/)?.[0];
assert.ok(block,'use the actual wall slope code');
// Terrain along x: flat H0 up to x=4, a slope band to x=6 (gentle or steep), flat H1 after.
const terrain={kind:'gentle'};
const ctx=vm.createContext({Math,Number,Object,State:{relief:{seed:1,hills:[1]}},window:{},
  dist:(a,b)=>Math.hypot(b.x-a.x,b.y-a.y),hasCastleSnap:()=>false,
  wallTier:s=>s.tier,
  terrainSlopeKind:p=>p.x>4&&p.x<6?terrain.kind:null,
  terrainElevation:p=>p.x<=4?0:p.x>=6?1:(p.x-4)/2,
  structureTerrainSamples:s=>Array.from({length:21},(_,i)=>({x:s.a.x+(s.b.x-s.a.x)*i/20,y:s.a.y})),
  buildableTerrainElevationForStructure:s=>s.a.x>=6||s.b.x<=4?(s.a.x>=6?1:0):null,
  unionFootprintPoints:s=>{const h=s.width/2;return[{x:s.a.x,y:s.a.y+h},{x:s.b.x,y:s.b.y+h},{x:s.b.x,y:s.b.y-h},{x:s.a.x,y:s.a.y-h}]}});
vm.runInContext(block+'\nObject.assign(this,{wallTerrainVerdict,wallSlopeSections,wallGroundAt,wallWalkGroundAt});',ctx);
const wall=(tier,a=2,b=8)=>({type:'wall',tier,width:[0,.2,.5,1][tier],a:{x:a,y:0},b:{x:b,y:0}});
{
  for(const kind of ['gentle','steep']){
    terrain.kind=kind;
    const ok=[1,2,3].map(t=>ctx.wallTerrainVerdict(wall(t)).ok);
    assert.deepEqual(ok,kind==='gentle'?[true,true,false]:[true,false,false],'tiers on a '+kind+' slope');
  }
  assert.ok(ctx.wallTerrainVerdict(wall(3,0,3)).ok&&!ctx.wallTerrainVerdict(wall(3,0,3)).slope,'any tier on flat ground');
  console.log('PASS wall tiers allowed on slopes');
}
{
  terrain.kind='gentle';
  const s=wall(2),secs=ctx.wallSlopeSections(s);
  // Flat 2..4 and 6..8, slope 4..6: two level runs, a stair of ~0.12U treads in between.
  assert.ok(secs&&secs.length>=16&&secs.length<=20,'one tread per ~0.12U on the slope, level runs merged');
  assert.ok((secs[0].t1-secs[0].t0)*6>1.9,'the flat foot is one block');
  const stair=secs.slice(1,-1);
  for(let i=1;i<stair.length;i++)assert.ok(stair[i].ground-stair[i-1].ground<.08,'gentle stair: rises under 0.08U');
  for(const q of secs){
    assert.ok(q.low<=0,'the base reaches the lowest ground under the section');
    assert.ok(q.t1>q.t0,'sections ordered along a->b');
  }
  assert.ok(secs[0].ground<1e-9&&Math.abs(secs[secs.length-1].ground-1)<1e-9,'from the lower terrace to the upper one');
  assert.ok(secs.every((q,i)=>!i||q.ground>=secs[i-1].ground-1e-9),'steps climb with the slope');
  assert.equal(ctx.wallGroundAt(s,.5),secs.find(q=>.5>=q.t0&&.5<=q.t1).ground,'ground at t is its section\'s');
  assert.equal(ctx.wallSlopeSections(wall(2,0,3)),null,'a flat wall is not stepped');
  console.log('PASS stepped wall sections');
}
{
  // The wall top is the stair: the walk at t is the tread there.
  terrain.kind='gentle';
  const s=wall(2),secs=ctx.wallSlopeSections(s);
  for(const q of secs){const tm=(q.t0+q.t1)/2;assert.equal(ctx.wallWalkGroundAt(s,tm),q.ground,'walk on the tread')}
  terrain.kind='steep';
  const t1=ctx.wallSlopeSections(wall(1)).slice(1,-1);
  assert.ok(t1.every((q,i)=>!i||q.ground-t1[i-1].ground<.27),'steep T1: steep treads, still one per ~0.12U');
  console.log('PASS the wall top is the stair');
}
{
  // A terrace edge: the ground jumps 1U at x=5. No riser exceeds 2/3 of its tread, with the treads
  // below raised to meet the upper level; it never sinks under the terrain.
  const ground=ctx.terrainElevation;
  ctx.terrainElevation=p=>p.x<5?0:1;terrain.kind='steep';
  const s=wall(1),secs=ctx.wallSlopeSections(s),run=6/Math.ceil(6/.12);
  for(let i=1;i<secs.length;i++)
    assert.ok(Math.abs(secs[i].ground-secs[i-1].ground)<=run*2/3+1e-9,'no riser taller than 2/3 of its tread');
  assert.ok(Math.abs(secs[secs.length-1].ground-1)<1e-9&&Math.abs(secs[0].ground)<1e-9,'the stair joins both levels');
  assert.ok(secs.length>=6,'the 1U jump becomes a flight of several treads');
  ctx.terrainElevation=ground;
  console.log('PASS risers at most 2/3 of the tread');
}
