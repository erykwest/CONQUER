'use strict';
// Civil annex contracts: executes the actual catalog and shared Builder preflight.
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const square=(cx,cy,w,h,a=0)=>[[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]]
  .map(([x,y])=>({x:cx+x*Math.cos(a)-y*Math.sin(a),y:cy+x*Math.sin(a)+y*Math.cos(a)}));
const inPoly=(poly,p,pad=0)=>poly.every((a,i)=>{
  const b=poly[(i+1)%poly.length];
  return (b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x)>=pad*Math.hypot(b.x-a.x,b.y-a.y)-1e-7;
});
const inside=(p,poly)=>inPoly(poly,p);
const dseg=(p,a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t)};
const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
const intersects=(a,b,c,d)=>cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0;
const State={structures:[],lots:[],environment:[],village:{founded:false}};
let seq=0,selectedTool=null,notice='';
const sandbox={
  State,window:{},BUILD_MIN:50,BUILD_MAX:150,
  uid:()=>String(++seq),snapStructureAngle:a=>a,rectWorldPoints:square,
  civicLevel:s=>s.civicLevel||1,underConstruction:()=>false,
  urbanLots:()=>State.lots,urbanContains:inPoly,
  urbanPolygonsOverlap:(a,b)=>a.some(p=>inPoly(b,p))||b.some(p=>inPoly(a,p)),
  dist:(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),
  status:x=>{notice=x},setTool:x=>{selectedTool=x},
  isCivic:s=>['market','church','tavern','training','plaza'].includes(s.type),
  civicParts:s=>[{points:square(s.x,s.y,s.type==='market'?4:5,s.type==='market'?4:6,s.angle||0)}],
  houseFootprintParts:s=>[{points:square(s.x,s.y,2,2)}],
  wellPlazaPoints:s=>square(s.x,s.y,3,3),
  structureGroundContactPolygons:s=>s.a?[square((s.a.x+s.b.x)/2,(s.a.y+s.b.y)/2,Math.hypot(s.a.x-s.b.x,s.a.y-s.b.y),s.width||.5,Math.atan2(s.b.y-s.a.y,s.b.x-s.a.x))]:[square(s.x,s.y,s.w||2,s.h||2,s.angle||0)],
  pointSegmentDistance:dseg,pointInPolygon:inside,segmentsIntersect:intersects,
  terrainSlopeKind:()=>null,environmentContains:()=>false,
  isPlacementFoundationBuilding:()=>false,buildableTerrainElevationForStructure:()=>0,
  environmentBlocksPoint:()=>false,manualRoadConflict:()=>false,
  isPrimaryRoad:()=>false,roadTouchesPolygon:(r,poly)=>poly.some(p=>dseg(p,r.a,r.b)<.1)||[r.a,r.b].some(p=>inside(p,poly))||poly.some((p,i)=>intersects(r.a,r.b,p,poly[(i+1)%poly.length])),
  TYPES:{road:{min:1}},constructionCost:()=>({}),canAfford:()=>true,costText:()=>''
};
const c=vm.createContext(sandbox),run=(x)=>vm.runInContext(x,c);
for(const f of ['settlement-civic-annexes.js','settlement-placement.js'])
  run(fs.readFileSync(path.join(root,'src',f),'utf8'));
let passed=0;
function test(name,fn){fn();passed++;console.log('PASS '+name)}
function parent(type,level=3){State.structures=[{id:'main',type,x:100,y:100,civicLevel:level,angle:0}];State.lots=[{civicId:'main',points:square(100,100,16,16)}]}
test('catalog offers owned annexes for three civic parent types, with levels and dimensions',()=>{
  assert.equal(run("Object.keys(CIVIC_ANNEX_CATALOG.church).length"),4);
  assert.equal(run("Object.keys(CIVIC_ANNEX_CATALOG.tavern).length"),4);
  assert.equal(run("Object.keys(CIVIC_ANNEX_CATALOG.market).length"),4);
  assert.equal(run("CIVIC_ANNEX_CATALOG.tavern.inn.level"),3);
});
test('church annex lies entirely inside parent lot and cannot exceed it',()=>{
  parent('church');
  const a=run("makeCivicAnnex(State.structures[0],'herbGarden',104,104)");
  assert.equal(sandbox.window.ConquerPlacement.check(a).ok,true);
  a.x=108;
  assert.match(sandbox.window.ConquerPlacement.check(a).reason,/lot/);
});
test('tavern L1 can add storage, L2 unlocks stables, L3 lodging',()=>{
  parent('tavern',1);
  let a=run("makeCivicAnnex(State.structures[0],'stables',104,104)");
  assert.match(sandbox.window.ConquerPlacement.check(a).reason,/L2/);
  State.structures[0].civicLevel=2;
  assert.equal(sandbox.window.ConquerPlacement.check(a).ok,true);
  a=run("makeCivicAnnex(State.structures[0],'inn',104,104)");
  assert.match(sandbox.window.ConquerPlacement.check(a).reason,/L3/);
});
test('market annexes do not claim a private lot but are limited to nearby public space',()=>{
  parent('market');
  State.lots=[];
  const a=run("makeCivicAnnex(State.structures[0],'stall',105,100)");
  assert.equal(sandbox.window.ConquerPlacement.check(a).ok,true);
  State.lots=[{houseId:'private',points:square(105,100,2,2)}];
  assert.match(sandbox.window.ConquerPlacement.check(a).reason,/owned Voronoi lot/);
  State.lots=[];
  a.x=116;
  assert.match(sandbox.window.ConquerPlacement.check(a).reason,/within 9U/);
});
test('annexes collide with each other, cannot overlap parent or an existing road',()=>{
  parent('market');
  const a=run("makeCivicAnnex(State.structures[0],'stall',105,100)");
  assert.equal(sandbox.window.ConquerPlacement.check(a).ok,true);
  State.structures.push(a);
  const b=run("makeCivicAnnex(State.structures[0],'stall',105,100)");
  assert.match(sandbox.window.ConquerPlacement.check(b).reason,/overlaps/);
  const c=run("makeCivicAnnex(State.structures[0],'stall',101,100)");
  assert.match(sandbox.window.ConquerPlacement.check(c).reason,/overlaps/);
  State.structures.push({id:'road',type:'road',a:{x:104,y:103},b:{x:108,y:103},width:.62});
  const d=run("makeCivicAnnex(State.structures[0],'stall',106,103)");
  assert.match(sandbox.window.ConquerPlacement.check(d).reason,/overlaps/);
});
test('annex cap, parent ownership, catalog migration shape and panel action',()=>{
  parent('tavern',3);
  const a=run("makeCivicAnnex(State.structures[0],'inn',104,104)");
  const b=run("makeCivicAnnex(State.structures[0],'inn',104,107)");
  State.structures.push(a,b);
  const c2=run("makeCivicAnnex(State.structures[0],'inn',106,100)");
  assert.match(sandbox.window.ConquerPlacement.check(c2).reason,/Maximum/);
  assert.equal(run("civicAnnexChildren('main').length"),2);
  assert.equal(run("startCivicAnnexPlacement(State.structures[0],'inn')"),false);
  State.structures.pop();
  assert.equal(run("startCivicAnnexPlacement(State.structures[0],'inn')"),true);
  assert.equal(selectedTool.parentId,'main');
  a.w=400;a.h=400;
  assert.equal(run("normalizeCivicAnnex(State.structures[1],State.structures[0])"),true);
  assert.equal(a.w,3);assert.equal(a.h,2.5);
  State.structures=[a];
  assert.match(run("civicAnnexPlacementCheck(State.structures[0]).reason"),/Missing/);
});
console.log(passed+' civic annex regression checks passed.');
