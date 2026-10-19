'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const industrySource=fs.readFileSync(path.join(root,'src/settlement-industries.js'),'utf8');
const placementSource=fs.readFileSync(path.join(root,'src/settlement-placement.js'),'utf8');
const economySource=fs.readFileSync(path.join(root,'src/settlement-economy.js'),'utf8');

function rect(cx,cy,w,h,angle=0){
  const ca=Math.cos(angle),sa=Math.sin(angle);
  return[[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]]
    .map(([x,y])=>({x:cx+x*ca-y*sa,y:cy+x*sa+y*ca}));
}
function contains(p,poly){
  let inside=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const a=poly[i],b=poly[j];
    if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
  }
  return inside;
}
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function segmentDist(p,a,b){
  const dx=b.x-a.x,dy=b.y-a.y,len2=dx*dx+dy*dy;
  const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(len2||1)));
  return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);
}
function crossing(a,b,c,d){
  const cross=(p,q,r)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);
  return cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0;
}
const ROCK={kind:'steep',poly:rect(130.1,125,.2,10)};
const GENTLE={kind:'gentle',poly:rect(122,125,.8,10)};
function harness(){
  const State={clock:{day:0},structures:[],environment:[],policies:{tax:10},
    village:{founded:false},biome:'hills'};
  const window={};
  const ctx=vm.createContext({
    State,window,document:{getElementById:()=>null},BUILD_MIN:50,BUILD_MAX:150,
    rectWorldPoints:rect,pointInPolygon:contains,pointSegmentDistance:segmentDist,
    segmentsIntersect:crossing,dist,
    reliefLevels:()=>[{bands:[ROCK,GENTLE]}],reliefEdgeBands:level=>level.bands,
    terrainSlopeKind:p=>contains(p,ROCK.poly)?'steep':contains(p,GENTLE.poly)?'gentle':null,
    terrainElevation:p=>contains(p,ROCK.poly)?1:contains(p,GENTLE.poly)?.5:0,
    environmentContains:(f,p,pad)=>contains(p,f.points),
    environmentBlocksPoint:p=>State.environment.some(f=>contains(p,f.points)),
    buildableTerrainElevationForStructure:s=>contains({x:s.x,y:s.y},ROCK.poly)?null:0,
    roadTouchesPolygon:()=>false,
    footprintPoints:s=>rect(s.x,s.y,s.w||s.size||2,s.h||s.size||2,s.angle||0),
    structureGroundContactPolygons:s=>[rect(s.x,s.y,s.w||2,s.h||2,s.angle||0)],
    houseFootprintParts:s=>[{points:rect(s.x,s.y,s.w||2,s.h||2,s.angle||0)}],
    isCivic:()=>false,civicParts:()=>[],
    // Civil introduced civic annex placement into the shared preflight; this industry
    // harness has no annex fixtures, so provide the real validator's neutral outcome.
    isCivicAnnex:()=>false,civicAnnexFootprint:()=>[],civicAnnexPlacementCheck:()=>({ok:true}),
    constructionCost:()=>({gold:10}),canAfford:()=>true,costText:()=>'10 gold',
    isPlacementFoundationBuilding:()=>false,
    TYPES:{road:{min:1}},manualRoadConflict:()=>false,
    underConstruction:()=>false,fieldLayout:()=>({area:10,cells:[{index:0}]}),
    calendarDateFromDay:day=>{
      const date=new Date(Date.UTC(2026,5,1+day));
      return{year:date.getUTCFullYear(),month:date.getUTCMonth(),day:date.getUTCDate()};
    },console,Math,Number,Object,Array
  });
  vm.runInContext(industrySource,ctx,{filename:'settlement-industries.js'});
  vm.runInContext(placementSource,ctx,{filename:'settlement-placement.js'});
  vm.runInContext(economySource,ctx,{filename:'settlement-economy.js'});
  return{State,industry:window.ConquerIndustries,
    placement:window.ConquerPlacement,economy:window.ConquerEconomy};
}
function test(name,fn){fn();console.log('✓ '+name)}
test('logging camp 2x2, quarry 3x3 and mine 1x1',()=>{
  const h=harness();
  for(const [type,size] of [['loggingCamp',2],['quarry',3],['mine',1]]){
    const s=h.industry.make(type,{x:100,y:100});
    assert.equal(s.w,size);assert.equal(s.h,size);
    assert.match(h.industry.validate({...s,x:50}).reason,/whitezone/);
    assert.match(h.industry.validate({...s,x:150}).reason,/whitezone/);
  }
});
test('quarry 3x3 only needs PART of footprint to overlap steep rock',()=>{
  const h=harness();
  const good=h.industry.make('quarry',{x:128.75,y:125}); // right edge 130.25
  assert.equal(contains({x:good.x,y:good.y},ROCK.poly),false,'Quarry centre is off the cliff');
  assert.equal(h.industry.validate(good).ok,true);
  assert.equal(h.placement.check(good).ok,true,'Generic Builder must not veto rocky quarry');
  assert.equal(h.industry.validate({...good,x:128.3}).ok,false,'No rock overlap');
});
test('quarry rotated footprint overlap counts, not only vertices or centre',()=>{
  const h=harness();
  const s={...h.industry.make('quarry',{x:128.3,y:125}),angle:Math.PI/4};
  assert.equal(h.industry.validate(s).ok,true,'Rotated corner reaches rock');
  assert.equal(h.placement.check(s).ok,true);
});
test('mine centre MUST be on steep rock even if 1x1 footprint intersects it',()=>{
  const h=harness();
  const mine=h.industry.make('mine',{x:130.1,y:125});
  assert.equal(h.industry.validate(mine).ok,true);
  assert.equal(h.placement.check(mine).ok,true,'Cliff centre must bypass flat terrace requirement');
  const merelyOverlapping={...mine,x:129.8};
  assert.equal(h.industry.validate(merelyOverlapping).ok,false);
  assert.equal(h.placement.check(merelyOverlapping).ok,false);
  assert.equal(h.industry.validate({...mine,x:122,y:125}).ok,false,'Gentle slope is not rocky cliff');
});
test('old 2x2 mine and quarry footprints upgrade to new dimensions when loaded',()=>{
  const h=harness();
  const mine={type:'mine',x:130.1,y:125,w:2,h:2};
  const quarry={type:'quarry',x:128.75,y:125,w:2,h:2};
  h.industry.normalizeFootprint(mine);h.industry.normalizeFootprint(quarry);
  assert.equal(mine.w,1);assert.equal(mine.h,1);
  assert.equal(quarry.w,3);assert.equal(quarry.h,3);
  assert.ok(Number.isFinite(mine.groundZ)&&Number.isFinite(quarry.groundZ));
});
test('logging camp retains a flat 2x2 footprint and forest radius 10U',()=>{
  const h=harness();
  h.State.environment=[{id:'forest',type:'forest',points:rect(114,100,4,4)}];
  const camp=h.industry.make('loggingCamp',{x:103,y:100});
  assert.equal(h.industry.validate(camp).ok,true);
  assert.match(h.industry.validate({...camp,x:90}).reason,/10U/);
  assert.match(h.industry.validate({...camp,x:113}).reason,/forest/i);
});
test('manual building collision and water exclusion still apply to extraction',()=>{
  const h=harness();
  const quarry=h.industry.make('quarry',{x:128.75,y:125});
  h.State.structures=[{id:'tower',type:'tower',x:128.75,y:125,w:2,h:2}];
  assert.match(h.industry.validate(quarry).reason,/overlaps another building/);
  h.State.structures=[];
  h.State.environment=[{id:'pond',type:'pond',points:rect(129,125,1,1)}];
  assert.match(h.industry.validate(quarry).reason,/forest, water or obstacle/);
});
test('production remains two units/day with two available workers',()=>{
  const h=harness();
  h.State.structures=[
    ...Array.from({length:2},(_,i)=>({id:'l1-'+i,type:'house',houseLevel:1})),
    ...Array.from({length:4},(_,i)=>({id:'l2-'+i,type:'house',houseLevel:2})),
    ...['loggingCamp','quarry','mine'].map(type=>({id:type,type,economicOwner:'lord'}))
  ];
  h.economy.setShare('wood',100);h.economy.setShare('stone',100);
  h.economy.tick(-1,4);
  assert.equal(h.economy.snapshot().market.wood,10);
  assert.equal(h.economy.snapshot().market.stone,20);
  h.economy.tick(4,6);
  assert.equal(h.economy.snapshot().market.wood,10);
  assert.equal(h.economy.snapshot().market.stone,20);
});
console.log('Industry regression: all checks passed.');
