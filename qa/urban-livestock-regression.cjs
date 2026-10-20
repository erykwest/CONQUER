'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const root=__dirname+'/../';
const source=fs.readFileSync(root+'src/settlement-livestock.js','utf8');
const html=fs.readFileSync(root+'index.html','utf8');
const fields=fs.readFileSync(root+'src/settlement-population-fields.js','utf8');
const residents=fs.readFileSync(root+'src/settlement-population-residents.js','utf8');
const urban=fs.readFileSync(root+'src/settlement-urban.js','utf8');
const renderer=fs.readFileSync(root+'src/settlement-render.js','utf8');
const where=name=>html.indexOf('settlement-'+name+'.js');
assert.ok(where('animals')>0&&where('livestock')>where('animals')&&where('render')>where('livestock'));
assert.match(fields,/ConquerLivestock\?\.lotKindForHouse\(h\)/);
assert.match(residents,/ConquerLivestock\.shepherdPosition\(house\)/);
assert.match(renderer,/ConquerLivestock\?\.draw\(\)/);
assert.match(source,/Math\.max\(1\.5,State\.view\.scale\*5\.75\)/);
assert.match(urban,/function urbanL2CattleShelter\(house\)/);
assert.match(urban,/type:'shed'.*roofH:1\.02/s);
assert.match(fields,/tier===1\?'shepherd':'cow'/);
assert.match(residents,/\['shepherd','cow'\]/);
assert.match(source,/PASTURE_SPACING=2\.5/);
assert.match(source,/animalFrameCache=\{key,objects:out\}/);
assert.match(source,/a\.shedKey\);/);
assert.match(urban,/ignoreBuildingKey==null\|\|q\.buildingKey!==ignoreBuildingKey/);
let fraction=.32;
const pastureJobs=[];
const runPastureJobs=(max=3000)=>{
  let executed=0;
  while(pastureJobs.length&&executed++<max)pastureJobs.shift()();
  assert.ok(executed<max,'pasture planning completes without unbounded tasks');
};
const rendered=[],houses=[],lots=[];
function hash(s){
  let h=2166136261;
  for(const c of String(s))h=Math.imul(h^c.charCodeAt(0),16777619);
  return h>>>0;
}
const rectangle=(x,y)=>[{x:x-2,y:y-2},{x:x+2,y:y-2},{x:x+2,y:y+2},{x:x-2,y:y+2}];
const State={seed:'qa-livestock-2026',view:{scale:1},structures:houses,environment:[],
  village:{wellId:'well'},combat:{strokes:[]}};
const window={
  ConquerCombat:{areaState:p=>({allowed:true,yellow:p.x<40,green:false})},
  ConquerAnimals:{drawAnimal:(species,ctx,x,y,size,opts)=>rendered.push({species,size,mode:opts.mode})},
  __conquerPerf:{}
};
const sandbox={window,State,urbanRevision:1,environmentRevision:0,WORLD:200,peasantHash:hash,
  houseLevel:h=>h.level||1,urbanLots:()=>lots,
  urbanArea:p=>Math.abs(p.reduce((n,a,i)=>n+a.x*p[(i+1)%p.length].y-a.y*p[(i+1)%p.length].x,0))/2,
  urbanContains:(p,q)=>q.x>=Math.min(...p.map(v=>v.x))&&q.x<=Math.max(...p.map(v=>v.x))&&
    q.y>=Math.min(...p.map(v=>v.y))&&q.y<=Math.max(...p.map(v=>v.y)),
  houseFootprintParts:h=>[{points:rectangle(h.x,h.y).map(p=>({x:h.x+(p.x-h.x)*.2,y:h.y+(p.y-h.y)*.2}))}],
  underConstruction:()=>false,houseDoorInfo:h=>({outside:{x:h.x+1.5,y:h.y}}),
  pointBlockedForPeasant:()=>false,
  terrainSlopeKind:()=>null,
  pointSegmentDistance:(p,a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy)},
  environmentContains:(f,p)=>{const inside=poly=>poly&&p.x>=Math.min(...poly.map(v=>v.x))&&p.x<=Math.max(...poly.map(v=>v.x))&&p.y>=Math.min(...poly.map(v=>v.y))&&p.y<=Math.max(...poly.map(v=>v.y));return inside(f.points)&&!(f.holes||[]).some(inside)},
  dist:(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),
  clamp:(x,a,b)=>Math.max(a,Math.min(b,x)),
  villagerPathBetween:(h,a,b)=>[a,b],findPeasantPath:(a,b)=>[a,b],
  pointAlongPath:(p,t)=>({x:p[0].x+(p.at(-1).x-p[0].x)*t,y:p[0].y+(p.at(-1).y-p[0].y)*t}),
  residentIdlePoint:p=>p,visualCycleFrac:()=>fraction,visualCycleDay:()=>90+fraction,
  viewDepthPoint:p=>p.y,worldPointVisible:()=>true,w2s:p=>({x:p.x-p.y,y:p.x+p.y}),
  withUrbanFigureOcclusion:(p,z,draw)=>draw(),ctx:{},
  setTimeout:callback=>{pastureJobs.push(callback);return pastureJobs.length},
  clearTimeout:()=>{},
  urbanLotOutbuildings:house=>{
    const level=house.level||1;
    if(level<3&&!(level===2&&window.ConquerLivestock?.lotKindForHouse(house)==='cow'))return[];
    const shed=(index,type)=>({
      type,kind:'outbuilding',buildingKey:house.id+'|shed-'+index,
      center:{x:house.x-1+index,y:house.y+1},
      w:1.6,h:.8,roofAngle:0,
      points:rectangle(house.x-1+index,house.y+1)
    });
    return level===2?[shed(0,'shed')]:[shed(0,'shed'),shed(1,'shed'),shed(2,'store')];
  }
};
vm.runInNewContext(source,sandbox,{filename:'settlement-livestock.js'});
const animals=window.ConquerLivestock;
const ids={};
for(let i=0;i<500&&Object.keys(ids).length<3;i++){
  const h={id:'l1-'+i,level:1};
  const kind=animals.lotKindForHouse(h);
  if(!ids[kind])ids[kind]=h.id;
}
assert.equal(Object.keys(ids).length,3);
for(const [i,kind] of ['garden','goat','shepherd'].entries()){
  const h={id:ids[kind],level:1,x:20+i*6,y:90};
  houses.push(h);lots.push({houseId:h.id,points:rectangle(h.x,h.y)});
}
assert.deepEqual({...animals.summary()},
  {garden:1,goat:1,shepherd:1,goats:8,sheep:16,
    l2Gardens:0,cowLots:0,cows:0,horseLots:0,horseShelters:0,horses:0});
// Pasture search is scheduled, not run during the frame that detects a herd.
const firstFrame=animals.animals();
assert.ok(pastureJobs.length>0,'pasture work deferred from rendering');
assert.ok(firstFrame.filter(a=>a.species==='sheep').every(a=>sandbox.urbanContains(lots[2].points,a.p)),
  'sheep remain safely at home until an accessible pasture is found');
runPastureJobs();
const daylight=animals.animals();
assert.equal(daylight.filter(a=>a.species==='goat').length,8);
assert.equal(daylight.filter(a=>a.species==='sheep').length,16);
assert.ok(daylight.filter(a=>a.species==='sheep').every(a=>a.p.x>=40),'daytime sheep graze in white territory');
assert.ok(animals.shepherdPosition(houses[2]),'shepherd must lead flock by day');
animals.draw();
assert.equal(rendered.length,24);
assert.ok(rendered.every(a=>a.size===5.75),'animal scale must halve again');
assert.ok(rendered.some(a=>a.mode==='walk')&&rendered.some(a=>a.mode==='browse'),'livestock must alternate browsing with short walking bursts');
fraction=.8;
assert.ok(animals.animals().filter(a=>a.species==='sheep').every(a=>sandbox.urbanContains(lots[2].points,a.p)),
  'all sheep return to their lot at night');
assert.equal(animals.shepherdPosition(houses[2]),null);
// During movement, sprites follow projected direction; reversing the short
// browse-loop stroll flips their mirrored art in both directions.
let right=0,left=0;
for(let n=0;n<1000;n++){
  fraction=n/1000;
  for(const a of animals.animals()){
    if(a.species!=='goat'||a.mode!=='walk'||!a.heading)continue;
    const projection=a.heading.x-a.heading.y;
    if(Math.abs(projection)<1e-5)continue;
    assert.equal(a.facing,Math.sign(projection),'walking sprite follows movement, not its initial random orientation');
    if(a.facing===1)right++;else left++;
  }
}
assert.ok(right>0&&left>0,'the animals actually flip while walking in opposite directions');
// L2 uses a deterministic 70/30 split, not another L1 allocation.
const l2={};
let cows=0;
for(let i=0;i<1000;i++){
  const house={id:'l2-'+i,level:2};
  const kind=animals.lotKindForHouse(house);
  assert.ok(kind==='garden'||kind==='cow');
  if(!l2[kind])l2[kind]=house.id;
  if(kind==='cow')cows++;
}
assert.ok(cows>=265&&cows<=335,'L2 cow allocation should approach 30%');
for(const [i,kind] of ['garden','cow'].entries()){
  const house={id:l2[kind],level:2,x:52+i*6,y:96};
  houses.push(house);lots.push({houseId:house.id,points:rectangle(house.x,house.y)});
}
for(const level of [3,4]){
  const house={id:'horse-l'+level,level,x:72+(level-3)*8,y:96};
  houses.push(house);lots.push({houseId:house.id,points:rectangle(house.x,house.y)});
}
fraction=.32;
animals.animals();
runPastureJobs();
const dayHerd=animals.animals();
const claims=animals.pastures();
for(let i=0;i<claims.length;i++)for(let j=i+1;j<claims.length;j++){
  const a=claims[i],b=claims[j];
  assert.ok(Math.hypot(a.center.x-b.center.x,a.center.y-b.center.y)>=a.radius+b.radius+2.5-1e-6,
    'livestock grazing patches must be disjoint with 2.5U free space');
}
const cowHerd=dayHerd.filter(a=>a.species==='cow');
const stableHerd=dayHerd.filter(a=>a.species==='horse');
assert.equal(cowHerd.length,Math.floor(16/3),'1 cow per 3 U²');
assert.ok(cowHerd.every(a=>a.p.x>=40),'cattle graze in the white area by day');
assert.ok(animals.shepherdPosition(houses.find(h=>h.id===l2.cow)),
  'an L2 cowherd accompanies cattle to pasture');
assert.equal(dayHerd.filter(a=>a.species==='horse').length,stableHerd.length);
assert.ok(stableHerd.length>=4&&stableHerd.length<=12,'1-3 horses per shed in L3/L4');
assert.ok(stableHerd.every(a=>a.shedKey),'every horse identifies its lean-to to avoid roof occlusion');
for(const house of houses.filter(h=>h.level>=3)){
  for(const roof of sandbox.urbanLotOutbuildings(house).filter(s=>s.type==='shed')){
    const population=stableHerd.filter(a=>a.id.startsWith(roof.buildingKey+':horse:'));
    assert.ok(population.length>=1&&population.length<=3,'each existing shed has 1-3 horses');
    assert.ok(population.every(a=>sandbox.urbanContains(roof.points,a.p)),
      'stable horses stay under the roof');
  }
}
const report=animals.summary();
assert.equal(report.l2Gardens,1);
assert.equal(report.cowLots,1);
assert.equal(report.cows,5);
assert.equal(report.horseLots,2);
assert.equal(report.horseShelters,4);
assert.equal(report.horses,stableHerd.length);
fraction=.8;
assert.ok(animals.animals().filter(a=>a.species==='cow').every(a=>
  sandbox.urbanContains(lots.find(l=>l.houseId===l2.cow).points,a.p)),
  'cows return to their L2 lot at night');
assert.equal(animals.shepherdPosition(houses.find(h=>h.id===l2.cow)),null);
// Changing house levels invalidates both resolved and pending pasture routes.
const prior=lots.find(l=>l.houseId===l2.cow),candidate=houses.find(h=>h.id===l2.cow);
candidate.level=1; sandbox.urbanRevision++;
animals.animals();
assert.ok(pastureJobs.length>0,'herd route refresh remains deferred after a density upgrade');
runPastureJobs();
assert.ok(animals.animals().every(a=>Number.isFinite(a.p.x)&&Number.isFinite(a.p.y)));
// Full-patch terrain exclusion regression: the centre alone must not decide
// whether a grazing area intersects woodland, water or steep rocky ground.
function refreshSheepPasture(){
  sandbox.environmentRevision++;
  animals.animals();
  runPastureJobs();
  const p=animals.pastures().find(p=>p.id===houses[2].id);
  assert.ok(p,'sheep should locate another available white-zone pasture');
  return p;
}
function rectAround(p,half){
  return [{x:p.x-half,y:p.y-half},{x:p.x+half,y:p.y-half},
    {x:p.x+half,y:p.y+half},{x:p.x-half,y:p.y+half}];
}
let pasture=animals.pastures().find(p=>p.id===houses[2].id);
assert.ok(pasture);
for(const type of ['forest','mountain','pond','sea']){
  const blocked={...pasture.center};
  State.environment=[{type,points:rectAround(blocked,.22)}];
  pasture=refreshSheepPasture();
  assert.ok(Math.hypot(pasture.center.x-blocked.x,pasture.center.y-blocked.y)>pasture.radius+.2,
    type+' must not overlap even the edge of the pasture');
}
const waterCentre={...pasture.center},waterRadius=pasture.radius;
const waterY=waterCentre.y+waterRadius+.12;
for(const type of ['river','stream']){
  const line=[{x:waterCentre.x-4,y:waterY},{x:waterCentre.x+4,y:waterY}];
  State.environment=[{type,width:.25,points:line}];
  pasture=refreshSheepPasture();
  assert.ok(sandbox.pointSegmentDistance(pasture.center,...line)>pasture.radius+.125+.20-1e-6,
    type+' bank clearance must exclude grazing circles (even with a clear centre)');
}
State.environment=[];
const steepPocket={x:pasture.center.x+.42,y:pasture.center.y-.15};
sandbox.terrainSlopeKind=p=>Math.hypot(p.x-steepPocket.x,p.y-steepPocket.y)<.34?'steep':null;
pasture=refreshSheepPasture();
assert.ok(Math.hypot(pasture.center.x-steepPocket.x,pasture.center.y-steepPocket.y)>pasture.radius+.08,
  'rocky slope inside the pasture footprint must reject the whole candidate');
sandbox.terrainSlopeKind=()=>null;
// Woodland holes remain valid only if the full grazing footprint is inside a clearing.
const clearingCentre={...pasture.center};
State.environment=[{type:'forest',points:rectAround(clearingCentre,20),
  holes:[rectAround(clearingCentre,Math.max(3,pasture.radius+1))]}];
pasture=refreshSheepPasture();
assert.ok(pasture,'forest clearings should not suppress all rural pasture candidates');
State.environment=[];
refreshSheepPasture();

console.log('Urban livestock integration regression PASS');
