'use strict';
// Walls on slopes: T1 (thin, no wall-walk) on gentle and steep slopes, T2 on gentle slopes only, T3
// on flat ground only; a wall on a slope is stepped, each section standing on the terrain under it.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const castle=fs.readFileSync(__dirname+'/../src/settlement-castle.js','utf8').replace(/\r\n/g,'\n');
const block=castle.match(/const WALL_SLOPE_LIMIT=[\s\S]*?\nfunction wallGroundAt\(s,t\)\{[\s\S]*?\n\}/)?.[0];
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
vm.runInContext(block+'\nObject.assign(this,{wallTerrainVerdict,wallSlopeSections,wallGroundAt});',ctx);
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
  assert.ok(secs&&secs.length>=12,'about one section per 0.5U');
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
