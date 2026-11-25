'use strict';
// Towers on a hillside (user, 24/11/2026): the ground door faces the summit and opens on it, and the
// floor is the highest ground under the tower body (buttresses and talus do not lift it).
// Terrain: hilltop (z=1) for y<=100, a gentle slope down to z=0 at y=102.5, flat below.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const castle=fs.readFileSync(__dirname+'/../src/settlement-castle.js','utf8').replace(/\r\n/g,'\n');
const block=castle.match(/const TOWER_SUMMIT_MIN_RISE=[\s\S]*?\nfunction towerEntranceSummitVerdict\([\s\S]*?\n\}/)?.[0];
assert.ok(block,'use the actual summit rule code');
const profile=castle.match(/function placementFoundationProfile\(s\)\{[\s\S]*?\n\}/)?.[0];
assert.ok(profile,'use the actual foundation profile');
const STEP=Math.PI/12,norm=a=>((a%(2*Math.PI))+2*Math.PI)%(2*Math.PI);
const ground=p=>p.y<=100?1:p.y>=102.5?0:1-(p.y-100)/2.5;
const rect=(s,w,h)=>{const c=Math.cos(s.angle||0),n=Math.sin(s.angle||0);return[[w/2,-h/2],[w/2,h/2],[-w/2,h/2],[-w/2,-h/2]].map(([x,y])=>({x:s.x+x*c-y*n,y:s.y+x*n+y*c}))};
const fp=s=>s.shape==='round'?Array.from({length:24},(_,i)=>({x:s.x+Math.cos(i*Math.PI/12)*s.r,y:s.y+Math.sin(i*Math.PI/12)*s.r})):rect(s,s.size,s.size);
const ctx=vm.createContext({Math,Number,Object,Array,Infinity,
  terrainElevation:ground,terrainPlateauElevation:p=>p.y<=100?1:p.y>=102.5?0:null,
  towerFacadePoints:fp,footprintPoints:fp,isOrientedTower:s=>s.shape==='dee',
  isPlacementFoundationBuilding:()=>true,isStoneTowerStructure:()=>true,towerBaseStyle:s=>s.baseStyle||'standard',
  normalizeStructureAngle:norm,applyStructureRotation:(s,a)=>{s.rotationStep=Math.round(norm(a)/STEP)%24;s.angle=s.rotationStep*STEP;return s.angle},
  structureCenter:s=>({x:s.x,y:s.y}),
  // Body samples, or body plus a 0.3 U skirt all round (buttresses / talus).
  structureTerrainSamples:(s,polys)=>{const pts=polys?polys[0]:fp({...s,size:s.size+.6,r:s.r+.3});return pts.concat([{x:s.x,y:s.y}])},
  // Front door: on the boundary along `angle` (a D tower: on its rear, -angle).
  towerDoorSpecs:s=>{const a=(s.angle||0)+(s.shape==='dee'?Math.PI:0),o={x:Math.cos(a),y:Math.sin(a)},R=s.shape==='round'?s.r:s.size/2;
    return[{kind:'front',outward:o,contact:{x:s.x+o.x*R,y:s.y+o.y*R}}]}});
ctx.placementGroundZ=s=>ctx.placementFoundationProfile(s).baseZ;
ctx.placementFoundationDepth=s=>{const p=ctx.placementFoundationProfile(s);return p.baseZ-p.minZ};
vm.runInContext(profile+'\n'+block+'\nObject.assign(this,{placementFoundationProfile,orientTowerToSummit,towerEntranceSummitVerdict,towerUphillVector});',ctx);

const towers=[['square',1],['square',1.5],['square',2],['square',3],['round',.5],['round',.75],['round',1]];
{
  for(const base of ['standard','buttress','splayed'])for(const [shape,size] of towers){
    const s={type:'tower',shape,baseStyle:base,x:100,y:100.2,angle:STEP*5,...(shape==='round'?{r:size}:{size})};
    ctx.orientTowerToSummit(s);
    const door=ctx.towerDoorSpecs(s)[0];
    assert.ok(door.outward.y<-Math.SQRT1_2,`${shape} ${size} ${base}: door turned to the summit`);
    if(shape==='square')assert.equal((s.rotationStep-5+24)%6,0,'a square tower turns by quarter turns only');
    assert.ok(ctx.towerEntranceSummitVerdict(s).ok,`${shape} ${size} ${base}: door opens on the hilltop`);
    assert.equal(ctx.placementGroundZ(s),1,'floor at the hilltop');
  }
  console.log('PASS doors face and open on the summit, every shape and base');
}
{
  // The skirt reaches further uphill: on the slope it would lift the floor above the body.
  const s={type:'tower',shape:'square',size:1,x:100,y:101.6,angle:-Math.PI/2};
  const std=ctx.placementGroundZ({...s,baseStyle:'standard'}),but=ctx.placementGroundZ({...s,baseStyle:'buttress'});
  assert.ok(but<std,'buttresses do not raise the floor (body only)');
  console.log('PASS the floor is read under the tower body');
}
{
  // Door turned away from the summit, or a tower wholly on the slope: refused.
  const away={type:'tower',shape:'square',size:1.5,x:100,y:100.2,angle:Math.PI/2};
  assert.match(ctx.towerEntranceSummitVerdict(away).reason,/rivolta verso la cima/);
  const low={type:'tower',shape:'square',size:1,x:100,y:101.4,angle:0};
  ctx.orientTowerToSummit(low);
  assert.match(ctx.towerEntranceSummitVerdict(low).reason||'',/sulla cima/,'threshold on the slope is refused');
  // A free-standing D tower turns its round front downhill, its rear door uphill.
  const dee={type:'tower',shape:'dee',size:1.5,x:100,y:100.2,angle:0};
  ctx.orientTowerToSummit(dee);
  assert.ok(ctx.towerDoorSpecs(dee)[0].outward.y<-.9,'D tower: rear door uphill');
  // Subtowers, quay towers and D towers on a wall are left alone; flat ground has no rule.
  for(const t of [{parentTowerId:'p'},{quaySnap:'q'},{shape:'dee',wallSeat:.5}]){
    const s={type:'tower',shape:'square',size:1,x:100,y:100.2,angle:Math.PI/2,...t};
    assert.equal(ctx.orientTowerToSummit(s),false,'not turned: '+JSON.stringify(t));
  }
  const flat={type:'tower',shape:'square',size:1,x:100,y:90,angle:Math.PI/2};
  assert.equal(ctx.orientTowerToSummit(flat),false);assert.ok(ctx.towerEntranceSummitVerdict(flat).ok);
  console.log('PASS refusals and exceptions');
}
