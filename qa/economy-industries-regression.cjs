'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const base=path.resolve(__dirname,'..');
const industrySource=fs.readFileSync(path.join(base,'src/settlement-industries.js'),'utf8');
const economySource=fs.readFileSync(path.join(base,'src/settlement-economy.js'),'utf8');

function polygon(x1,y1,x2,y2){
  return[{x:x1,y:y1},{x:x2,y:y1},{x:x2,y:y2},{x:x1,y:y2}];
}
function contains(p,pts){
  let inside=false;
  for(let i=0,j=pts.length-1;i<pts.length;j=i++){
    const a=pts[i],b=pts[j];
    if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
  }
  return inside;
}
function distance(p,a,b){
  const dx=b.x-a.x,dy=b.y-a.y,denom=dx*dx+dy*dy;
  const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(denom||1)));
  return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);
}
function edgeIntersection(a,b,c,d){
  const cross=(p,q,r)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);
  const x=cross(a,b,c),y=cross(a,b,d),z=cross(c,d,a),w=cross(c,d,b);
  return x*y<0&&z*w<0;
}
function harness(){
  const State={clock:{day:0},structures:[],environment:[],policies:{tax:10},biome:'hills'};
  let plateau=0;
  const bands=[
    {kind:'gentle',poly:polygon(126,120,127,131)},
    {kind:'steep',poly:polygon(130,120,131,131)}
  ];
  const window={};
  const context=vm.createContext({
    State,window,document:{getElementById:()=>null},BUILD_MIN:50,BUILD_MAX:150,
    rectWorldPoints:(x,y,w,h)=>polygon(x-w/2,y-h/2,x+w/2,y+h/2),
    pointInPolygon:contains,pointSegmentDistance:distance,
    segmentsIntersect:edgeIntersection,
    reliefLevels:()=>[{bands}],reliefEdgeBands:level=>level.bands,
    buildableTerrainElevationForStructure:()=>plateau,
    environmentBlocksPoint:p=>State.environment.some(f=>contains(p,f.points)),
    roadTouchesPolygon:()=>false,
    footprintPoints:s=>polygon(s.x-1,s.y-1,s.x+1,s.y+1),
    underConstruction:()=>false,
    fieldLayout:()=>({area:10,cells:[{index:0}]}),
    calendarDateFromDay:day=>{const d=new Date(Date.UTC(2026,5,1+day));return{year:d.getUTCFullYear(),month:d.getUTCMonth(),day:d.getUTCDate()};},
    console,Math,Number,Object,Array
  });
  vm.runInContext(industrySource,context,{filename:'settlement-industries.js'});
  vm.runInContext(economySource,context,{filename:'settlement-economy.js'});
  return{State,industry:window.ConquerIndustries,economy:window.ConquerEconomy,setPlateau:n=>{plateau=n}};
}
function test(name,fn){fn();console.log('✓ '+name)}
test('all production footprints are 2x2 and remain inside the whitezone',()=>{
  const h=harness();
  for(const type of ['loggingCamp','quarry','mine']){
    const s=h.industry.make(type,{x:70,y:70});
    assert.equal(s.w,2);assert.equal(s.h,2);
    assert.match(h.industry.validate({...s,x:50.5}).reason,/whitezone/);
    assert.match(h.industry.validate({...s,x:149.5}).reason,/whitezone/);
  }
});
test('logging camp requires a nearby forest no farther than 10U',()=>{
  const h=harness();
  h.State.environment=[{id:'forest',type:'forest',points:polygon(112,98,116,102)}];
  assert.equal(h.industry.validate(h.industry.make('loggingCamp',{x:103,y:100})).ok,true);
  assert.match(h.industry.validate(h.industry.make('loggingCamp',{x:90,y:100})).reason,/within 10U/);
  assert.equal(h.industry.validate(h.industry.make('loggingCamp',{x:113,y:100})).ok,false);
});
test('quarry needs upper flat hill terrace beside slope',()=>{
  const h=harness(),s=h.industry.make('quarry',{x:123,y:125});
  assert.equal(h.industry.validate(s).ok,false);
  h.setPlateau(1);
  assert.equal(h.industry.validate(s).ok,true);
  assert.equal(h.industry.validate({...s,x:110}).ok,false);
});
test('mine is positioned next to steep cliff, never inside rock',()=>{
  const h=harness(),s=h.industry.make('mine',{x:127,y:125});
  assert.equal(h.industry.validate(s).ok,true);
  assert.equal(h.industry.validate({...s,x:113}).ok,false);
});
test('industry cannot occupy footprint of an existing manual structure',()=>{
  const h=harness();
  h.State.environment=[{id:'forest',type:'forest',points:polygon(112,98,116,102)}];
  h.State.structures=[{type:'tower',id:'t',x:103,y:100}];
  const s=h.industry.make('loggingCamp',{x:103,y:100});
  assert.match(h.industry.validate(s).reason,/overlaps another building/);
});
test('two L1/L2 workers generate 2 units daily per industry',()=>{
  const h=harness();
  h.State.structures=[
    ...Array.from({length:2},(_,i)=>({id:'l1-'+i,type:'house',houseLevel:1})),
    ...Array.from({length:4},(_,i)=>({id:'l2-'+i,type:'house',houseLevel:2})),
    ...['loggingCamp','quarry','mine'].map(type=>({id:type,type,economicOwner:'lord'}))
  ];
  h.economy.setShare('wood',100);h.economy.setShare('stone',100);
  h.economy.tick(-1,0);
  assert.equal(h.economy.snapshot().market.wood,2);
  assert.equal(h.economy.snapshot().market.stone,4);
  h.economy.tick(0,4);
  assert.equal(h.economy.snapshot().market.wood,10);
  assert.equal(h.economy.snapshot().market.stone,20);
  h.economy.tick(4,6); // Saturday market / Sunday rest
  assert.equal(h.economy.snapshot().market.wood,10);
  assert.equal(h.economy.snapshot().market.stone,20);
});
test('no L2 workforce means no quarry or mine production',()=>{
  const h=harness();h.State.structures=[{id:'q',type:'quarry',economicOwner:'lord'}];
  h.economy.setShare('stone',100);h.economy.tick(-1,4);
  assert.equal(h.economy.snapshot().market.stone,0);
});
console.log('Industry regression: all checks passed.');
