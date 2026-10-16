'use strict';
// Road-frontage density QA: executes the real urban geometry in an isolated VM.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const house={id:'h',type:'house',auto:true,houseLevel:3,x:3,y:1.4,w:1.5,h:1,angle:0};
const road={id:'main',type:'road',routeId:'arterial',a:{x:0,y:-.45},b:{x:6,y:-.45},width:.62};
const side={id:'side',type:'road',routeId:'arterial',a:{x:6.45,y:0},b:{x:6.45,y:4},width:.62};
function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
function closestPointOnSegment(p,a,b){
  const dx=b.x-a.x,dy=b.y-a.y;
  const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));
  return{x:a.x+dx*t,y:a.y+dy*t};
}
function rectWorldPoints(cx,cy,w,h,angle=0){
  const ca=Math.cos(angle),sa=Math.sin(angle);
  return [[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]]
    .map(([x,y])=>({x:cx+x*ca-y*sa,y:cy+x*sa+y*ca}));
}
const State={structures:[house,road],environment:[]};
function peasantHash(id){
  let h=2166136261>>>0;
  for(const ch of String(id)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}
  return h>>>0;
}
const sandbox={
  State,window:{},dist,rectWorldPoints,peasantHash,biomeHash:peasantHash,
  segmentDistance:(a,b,c,d)=>Math.min(
    dist(a,closestPointOnSegment(a,c,d)),dist(b,closestPointOnSegment(b,c,d)),
    dist(c,closestPointOnSegment(c,a,b)),dist(d,closestPointOnSegment(d,a,b))),
  clamp:(v,lo,hi)=>Math.max(lo,Math.min(hi,v)),
  circleWorldPoints:(x,y,r,n)=>Array.from({length:n},(_,i)=>({
    x:x+Math.cos(i/n*Math.PI*2)*r,y:y+Math.sin(i/n*Math.PI*2)*r
  })),
  closestPointOnSegment,
  pointSegmentDistance:(p,a,b)=>dist(p,closestPointOnSegment(p,a,b)),
  primaryRoadList:()=>State.structures.filter(s=>s.type==='road'&&s.routeId)
};
const context=vm.createContext(sandbox),run=source=>vm.runInContext(source,context);
const core=fs.readFileSync(__dirname+'/../src/settlement-core.js','utf8');
run(core.slice(core.indexOf('function houseLevel('),core.indexOf('const CIVIC_TYPES=')));
const script=fs.readFileSync(__dirname+'/../src/settlement-urban.js','utf8');
run(script);
run("urbanLotCache=[{houseId:'h',points:[{x:0,y:0},{x:6,y:0},{x:6,y:4},{x:0,y:4}]}]");
const lot=run('urbanLotCache[0]');
let passed=0;
function test(name,fn){fn();passed++;console.log('PASS '+name)}
test('all four levels have deterministic independent dimensions within ±20%',()=>{
  const samples=[];
  for(let level=1;level<=4;level++)for(let i=0;i<120;i++){
    const h={id:'size-'+i,type:'house',auto:true,houseLevel:level,
      x:3,y:1.4,w:1.5,h:1,angle:0};
    State.structures[0]=h;
    const scaled=run('houseFootprintDimensions(State.structures[0])');
    const again=run('houseFootprintDimensions(State.structures[0])');
    assert.ok(scaled.w>=1.5*.8&&scaled.w<=1.5*1.2);
    assert.ok(scaled.h>=.8&&scaled.h<=1.2);
    assert.equal(scaled.w,again.w);assert.equal(scaled.h,again.h);
    const body=run('houseFootprintParts(State.structures[0])[0]');
    assert.ok(Math.abs(body.w-scaled.w)<1e-8);
    assert.ok(Math.abs(body.h-scaled.h)<1e-8);
    if(level===1)samples.push(scaled);
  }
  assert.ok(samples.filter(s=>Math.abs(s.w/1.5-s.h)>.05).length>50,
    'X/Y scaling should not be correlated');
  State.structures[0]=house;
});
test('streetfront houses vary independently within ±20% without leaving the lot',()=>{
  for(const level of [3,4]){
    house.houseLevel=level;
    run('urbanRevision++');
    const front=run('urbanLotRoadFrontages(urbanLotCache[0])[0]');
    const count=Math.floor((front.length+.06)/(level===3?1.45:1.17));
    const width=Math.min(front.length/count+.045,level===4?1.65:1.95);
    const depth=level===4?1.13:.98;
    const parts=run('urbanDenseParts(State.structures[0])');
    assert.equal(run('urbanDenseBuildingCount(State.structures[0])'),count);
    const primary=parts.filter(p=>p.kind==='body'&&p.cx===0&&p.cy===0);
    assert.equal(primary.length,count);
    for(const part of primary){
      assert.ok(part.w>=width*.8-1e-7&&part.w<=width*1.2+1e-7);
      assert.ok(part.h>=depth*.8-1e-7&&part.h<=depth*1.2+1e-7);
    }
    for(const part of parts)for(const point of part.points)
      assert.ok(run('urbanContains(urbanLotCache[0].points,'+JSON.stringify(point)+',.035)'));
    const saved=JSON.stringify(parts);
    run('urbanRevision++');
    assert.equal(JSON.stringify(run('urbanDenseParts(State.structures[0])')),saved);
  }
  house.houseLevel=3;
  run('urbanRevision++');
});
test('L1 and L2 remain single-house lots',()=>{
  house.houseLevel=1;assert.equal(run('urbanDenseParts(State.structures[0]).length'),0);
  house.houseLevel=2;assert.equal(run('urbanDenseParts(State.structures[0]).length'),0);
});
test('L3 frontage creates three houses within a 6 U street-facing plot',()=>{
  house.houseLevel=3;
  assert.equal(run('urbanLotRoadFrontages(urbanLotCache[0]).length'),1);
  assert.equal(run('urbanDenseBuildingCount(State.structures[0])'),3);
  // The yard is fenced on its three non-street sides; the street side stays open.
  const fences=run('urbanFenceSegments([urbanLotCache[0]],[])');
  assert.ok(fences.length>=3);
  assert.ok(fences.every(e=>!(Math.abs(e.a.y)<.01&&Math.abs(e.b.y)<.01)),'no fence on the street edge');
  for(const test of [e=>Math.abs(e.a.x)<.01&&Math.abs(e.b.x)<.01,e=>Math.abs(e.a.x-6)<.01&&Math.abs(e.b.x-6)<.01,e=>Math.abs(e.a.y-4)<.01&&Math.abs(e.b.y-4)<.01])
    assert.ok(fences.some(test),'every non-street side is enclosed');
  assert.equal(State.structures.filter(s=>s.type==='house').length,1);
});
test('L3/L4 yards get sheds and storehouses on non-street sides, never counted as dwellings',()=>{
  for(const level of [3,4]){
    house.houseLevel=level;run('urbanRevision++');
    const out=run('urbanLotOutbuildings(State.structures[0])'),dense=run('urbanDenseParts(State.structures[0])');
    assert.ok(out.length>=1,'L'+level+' yard has outbuildings');
    assert.ok(out.every(p=>p.kind==='outbuilding'&&['shed','store'].includes(p.type)));
    assert.ok(out.every(p=>p.points.every(q=>run('urbanContains(urbanLotCache[0].points,'+JSON.stringify(q)+',.035)'))));
    // Not on the street side and clear of the townhouses.
    assert.ok(out.every(p=>p.points.every(q=>q.y>1)));
    assert.ok(out.every(p=>dense.every(d=>run('urbanPolygonIntersectionArea('+JSON.stringify(p.points)+','+JSON.stringify(d.points)+')')<1e-6)));
    assert.equal(run('urbanDenseBuildingCount(State.structures[0])'),level===3?3:4);
    assert.equal(run('urbanHouseDisplayParts(State.structures[0]).length'),dense.length+out.length);
  }
  house.houseLevel=3;run('urbanRevision++');
});
test('L4 increases frontage density and keeps all buildings within the parcel',()=>{
  house.houseLevel=4;
  assert.equal(run('urbanDenseBuildingCount(State.structures[0])'),4);
  assert.ok(run('urbanDenseParts(State.structures[0]).every(p=>p.points.every(q=>urbanContains(urbanLotCache[0].points,q,.035)))'));
  assert.ok(run('urbanDenseParts(State.structures[0]).every(p=>p.buildingKey&&p.points.length>=4)'));
  assert.ok(run('urbanDenseHouseDoorInfo(State.structures[0]).outside.y<0'));
});
test('every L3 building restores its deterministic L or T plan',()=>{
  house.houseLevel=3;run('urbanRevision++');
  const parts=run('urbanDenseParts(State.structures[0])');
  const keys=[...new Set(parts.map(p=>p.buildingKey))];
  assert.equal(keys.length,3);
  for(const key of keys){
    const own=parts.filter(p=>p.buildingKey===key);
    const expected=run('housePlanType({id:'+JSON.stringify(key)+'})');
    assert.equal(own.filter(p=>p.kind==='body').length,expected==='L'?2:3);
    assert.equal(own.filter(p=>p.kind==='turret').length,0);
  }
});
test('every L4 townhouse restores a turret in addition to its L/T extensions',()=>{
  house.houseLevel=4;run('urbanRevision++');
  const parts=run('urbanDenseParts(State.structures[0])');
  const keys=[...new Set(parts.map(p=>p.buildingKey))];
  assert.equal(keys.length,4);
  for(const key of keys){
    const own=parts.filter(p=>p.buildingKey===key);
    const plan=run('housePlanType({id:'+JSON.stringify(key)+'})');
    const towerType=run('houseTurretType({id:'+JSON.stringify(key)+'})');
    assert.equal(own.filter(p=>p.kind==='body').length,plan==='L'?2:3);
    assert.equal(own.filter(p=>p.kind==='turret').length,1);
    assert.equal(own.find(p=>p.kind==='turret').type,towerType);
  }
  const before=JSON.stringify(parts);run('urbanRevision++');
  assert.equal(JSON.stringify(run('urbanDenseParts(State.structures[0])')),before);
});
test('250 seeded plots retain L/T and L4 turret with valid geometry',()=>{
  const previousId=house.id;
  for(const level of [3,4]){
    house.houseLevel=level;
    for(let i=0;i<250;i++){
      house.id='seeded-'+i;run('urbanLotCache[0].houseId=State.structures[0].id;urbanRevision++');
      const parts=run('urbanDenseParts(State.structures[0])');
      const keys=[...new Set(parts.map(p=>p.buildingKey))];
      assert.equal(keys.length,level===3?3:4,'frontage count changed for plot '+i);
      for(const key of keys){
        const group=parts.filter(p=>p.buildingKey===key);
        const expected=run('housePlanType({id:'+JSON.stringify(key)+'})');
        assert.equal(group.filter(p=>p.kind==='body').length,expected==='L'?2:3);
        assert.equal(group.filter(p=>p.kind==='turret').length,level===4?1:0);
        for(const shape of group)for(const vertex of shape.points)
          assert.ok(run('urbanContains(urbanLotCache[0].points,'+JSON.stringify(vertex)+',.035)'),
            'extension or turret exceeds parcel '+i);
      }
    }
  }
  house.id=previousId;run('urbanLotCache[0].houseId=State.structures[0].id;urbanRevision++');
});
test('L3 and L4 original standalone house shapes retain extensions and turret',()=>{
  house.auto=false;house.urbanRedeveloped=false;house.houseLevel=3;
  assert.ok(run('houseFootprintParts(State.structures[0]).filter(p=>p.kind==="body").length')>=2);
  assert.equal(run('houseFootprintParts(State.structures[0]).filter(p=>p.kind==="turret").length'),0);
  house.houseLevel=4;
  assert.equal(run('houseFootprintParts(State.structures[0]).filter(p=>p.kind==="turret").length'),1);
  house.auto=true;house.houseLevel=4;
});
test('frontage on an additional primary road produces more infill units',()=>{
  State.structures.push(side);run('urbanRevision++');
  assert.equal(run('urbanLotRoadFrontages(urbanLotCache[0]).length'),2);
  assert.ok(run('urbanDenseBuildingCount(State.structures[0])')>4);
});
test('multiple short primary-road segments are merged along a long parcel edge',()=>{
  State.structures=[house,road];
  road.a={x:0,y:-.45};road.b={x:1.8,y:-.45};
  const continuation={id:'continuation',type:'road',routeId:'arterial',
    a:{x:1.8,y:-.45},b:{x:6,y:-.45},width:.62};
  State.structures.push(continuation);
  assert.equal(run('urbanLotRoadFrontages(urbanLotCache[0]).length'),1);
  assert.ok(run('urbanLotRoadFrontages(urbanLotCache[0])[0].length')>5);
  State.structures=[house,road];road.b={x:6,y:-.45};
  run('urbanRevision++');
});
test('no primary road frontage means no additional buildings',()=>{
  road.a.y=-4;road.b.y=-4;side.a.x=10;side.b.x=10;run('urbanRevision++');
  assert.equal(run('urbanDenseParts(State.structures[0]).length'),0);
  assert.ok(run('urbanHouseDisplayParts(State.structures[0]).filter(p=>p.kind==="body").length')>=2);
});
// Exercise the actual button handler, not a duplicate test implementation.
const app=['app','app-rooms','app-input','app-persistence','app-calendar-ui','app-simulation','app-bootstrap'].map(part=>fs.readFileSync(__dirname+'/../src/settlement-'+part+'.js','utf8')).join('\n');
const actionStart=app.indexOf('function changeHouseDensity(');
const actionEnd=app.indexOf('function selectedStructure(){',actionStart);
assert.ok(actionStart>=0&&actionEnd>actionStart,'house upgrade handler must be available');
run(app.slice(actionStart,actionEnd));
const messages=[];
sandbox.status=message=>messages.push(message);
sandbox.markStructureDirty=()=>{};
sandbox.renderFunctionPanel=()=>{};
sandbox.draw=()=>{};
sandbox.ensureSettlementRoadAccess=()=>{};
const overrideLot="urbanLotFor=house=>({id:'lot:'+house.id,houseId:house.id,points:[{x:0,y:0},{x:6,y:0},{x:6,y:4},{x:0,y:4}]})";
run(overrideLot);
test('manual Upgrade button from L2 to L3 accepts a single frontage townhouse',()=>{
  house.auto=true;house.houseLevel=2;
  road.a={x:0,y:-.45};road.b={x:1.8,y:-.45};
  State.structures=[house,road];run('urbanRevision++');
  run('changeHouseDensity(State.structures[0],3)');
  assert.equal(house.houseLevel,3);
  assert.equal(run('urbanDenseBuildingCount(State.structures[0])'),1);
  assert.ok(messages.at(-1).includes('1 streetfront building'));
});
test('upgrade remains possible on L2 plot without two viable road-front buildings',()=>{
  house.houseLevel=2;
  road.a={x:0,y:-4};road.b={x:6,y:-4};
  run('urbanRevision++');run('changeHouseDensity(State.structures[0],3)');
  assert.equal(house.houseLevel,3);
  assert.equal(run('urbanDenseParts(State.structures[0]).length'),0);
  // Without street frontage the house retains its *original L/T shape*,
  // rather than silently falling back to a featureless rectangle.
  assert.ok(run('urbanHouseDisplayParts(State.structures[0]).filter(p=>p.kind==="body").length')>=2);
});
test('manually placed L2 house can redevelop into a compact roadside parcel',()=>{
  house.auto=false;house.houseLevel=2;
  road.a={x:0,y:-.45};road.b={x:1.8,y:-.45};
  run('urbanRevision++');run('changeHouseDensity(State.structures[0],3)');
  assert.equal(house.houseLevel,3);
  assert.equal(house.urbanRedeveloped,true);
  assert.equal(run('urbanDenseBuildingCount(State.structures[0])'),1);
  run('changeHouseDensity(State.structures[0],2)');
  assert.equal(house.houseLevel,2);
  assert.equal(house.urbanRedeveloped,false);
  house.auto=true;
});
test('failed geometric validation cannot partially upgrade an existing plot',()=>{
  house.houseLevel=2;
  run('urbanLotFor=()=>null');
  run('changeHouseDensity(State.structures[0],3)');
  assert.equal(house.houseLevel,2);
  assert.ok(messages.at(-1).includes('exceed the lot'));
});
console.log('Urban density regression: '+passed+' passed');
