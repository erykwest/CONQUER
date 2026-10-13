'use strict';
// Shared Builder placement regression: node qa/builder-placement-regression.cjs
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'src/settlement-placement.js'),'utf8');
const app=fs.readFileSync(path.join(root,'src/settlement-app.js'),'utf8');
const render=fs.readFileSync(path.join(root,'src/settlement-render.js'),'utf8');
const castle=fs.readFileSync(path.join(root,'src/settlement-castle.js'),'utf8');
const square=(cx,cy,w,h,angle=0)=>[[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]].map(([x,y])=>
  ({x:cx+x*Math.cos(angle)-y*Math.sin(angle),y:cy+x*Math.sin(angle)+y*Math.cos(angle)}));
const inside=(p,poly)=>{
  let hit=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const a=poly[i],b=poly[j];
    if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)hit=!hit;
  }
  return hit;
};
const dseg=(p,a,b)=>{
  const dx=b.x-a.x,dy=b.y-a.y;
  const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));
  return Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t);
};
const orient=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
const intersects=(a,b,c,d)=>orient(a,b,c)*orient(a,b,d)<0&&orient(c,d,a)*orient(c,d,b)<0;
function harness(){
  const State={structures:[],environment:[],village:{founded:false}};
  let cash=100,blocked=false;
  const window={ConquerIndustries:{is:s=>['loggingCamp','quarry','mine'].includes(s.type),validate:()=>({ok:true})}};
  const context={
    State,window,BUILD_MIN:50,BUILD_MAX:150,
    houseFootprintParts:s=>[{points:square(s.x,s.y,s.w||2,s.h||2,s.angle||0)}],
    isCivic:s=>['market','tavern','church','training'].includes(s.type),
    civicParts:s=>[{points:square(s.x,s.y,s.w||2,s.h||2,s.angle||0)}],
    structureGroundContactPolygons:s=>s.a?[square((s.a.x+s.b.x)/2,(s.a.y+s.b.y)/2,
      Math.hypot(s.a.x-s.b.x,s.a.y-s.b.y),s.width||.5,Math.atan2(s.b.y-s.a.y,s.b.x-s.a.x))]:
      [square(s.x,s.y,s.w||s.size||2,s.h||s.size||2,s.angle||0)],
    pointSegmentDistance:dseg,pointInPolygon:inside,segmentsIntersect:intersects,
    dist:(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),
    terrainSlopeKind:()=>blocked?'steep':null,
    environmentContains:(f,p)=>inside(p,f.points||[]),
    isPlacementFoundationBuilding:s=>['tower','gate','church','tavern'].includes(s.type),
    buildableTerrainElevationForStructure:()=>blocked?null:0,
    environmentBlocksPoint:()=>blocked,
    TYPES:{road:{min:1}},
    manualRoadConflict:(road,other)=>other.type==='house',
    roadTouchesPolygon:(road,polygon)=>polygon.some(p=>dseg(p,road.a,road.b)<.25),
    constructionCost:()=>({gold:10}),canAfford:()=>cash>=10,costText:()=>'10 gold',
    Math,Number,Object,Array
  };
  vm.runInNewContext(source,context,{filename:'settlement-placement.js'});
  return{State,check:window.ConquerPlacement.check,
    setCash:v=>{cash=v},setBlocked:v=>{blocked=v}};
}
function test(name,fn){fn();console.log('✓ '+name)}
test('central valid point placement',()=>{
  const h=harness();assert.equal(h.check({type:'market',x:100,y:100,w:2,h:2}).ok,true);
});
test('whole footprint, not just centre, must remain in whitezone',()=>{
  const h=harness();assert.equal(h.check({type:'market',x:149.4,y:100,w:2,h:2}).ok,false);
});
test('unaffordable placement is invalid',()=>{
  const h=harness();h.setCash(0);
  assert.match(h.check({type:'market',x:100,y:100,w:2,h:2}).reason,/Insufficient/);
});
test('terrain obstruction makes ghost invalid',()=>{
  const h=harness();h.setBlocked(true);
  assert.equal(h.check({type:'market',x:100,y:100,w:2,h:2}).ok,false);
});
test('occupied manual building blocks placement',()=>{
  const h=harness();h.State.structures=[{id:'old',type:'market',x:100,y:100,w:2,h:2}];
  assert.equal(h.check({type:'market',x:100,y:100,w:2,h:2}).ok,false);
});
test('self footprint may be ignored when rotating an existing building',()=>{
  const h=harness();h.State.structures=[{id:'old',type:'market',x:100,y:100,w:2,h:2}];
  assert.equal(h.check({id:'old',type:'market',x:100,y:100,w:2,h:2,angle:Math.PI/4},
    {ignoreId:'old',checkCost:false}).ok,true);
});
test('attached subtorri remain valid when their parent rotates',()=>{
  const h=harness();
  h.State.structures=[{id:'parent',type:'tower',x:100,y:100,size:2},
    {id:'child',type:'tower',x:100.7,y:100.7,size:1,parentTowerId:'parent'}];
  assert.equal(h.check({...h.State.structures[0],angle:Math.PI/4},
    {ignoreId:'parent',checkCost:false}).ok,true);
});
test('existing village cannot found a second well',()=>{
  const h=harness();h.State.village.founded=true;
  assert.equal(h.check({type:'well',x:100,y:100}).ok,false);
});
test('road crossing whitezone boundary is invalid',()=>{
  const h=harness();
  assert.equal(h.check({type:'road',a:{x:90,y:90},b:{x:160,y:90},width:.6}).ok,false);
});
test('general preview and rotation are wired into the application',()=>{
  assert.match(app,/function rotatePointStructure/);
  assert.match(app,/data-point-rotate/);
  assert.match(app,/ConquerPlacement\?\.check\(s\)/);
  assert.match(app,/State\.draft=\{mode:'hover',preview:\{type:'well'/);
  assert.match(render,/function drawInvalidPlacementGhost/);
  assert.match(render,/rgba\(232,40,47/);
  assert.match(castle,/if\(ok\)\{\s*State\.draft=null/);
});
console.log('Builder placement regression: all checks passed.');
