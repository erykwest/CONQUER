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
let fraction=.32;
const rendered=[],houses=[],lots=[];
function hash(s){
  let h=2166136261;
  for(const c of String(s))h=Math.imul(h^c.charCodeAt(0),16777619);
  return h>>>0;
}
const rectangle=(x,y)=>[{x:x-2,y:y-2},{x:x+2,y:y-2},{x:x+2,y:y+2},{x:x-2,y:y+2}];
const State={seed:'qa-livestock-2026',view:{scale:1},structures:houses,
  village:{wellId:'well'},combat:{strokes:[]}};
const window={
  ConquerCombat:{areaState:p=>({allowed:true,yellow:p.x<40,green:false})},
  ConquerAnimals:{drawAnimal:(species,ctx,x,y,size,opts)=>rendered.push({species,size,mode:opts.mode})},
  __conquerPerf:{}
};
const sandbox={window,State,urbanRevision:1,WORLD:200,peasantHash:hash,
  houseLevel:h=>h.level||1,urbanLots:()=>lots,
  urbanArea:p=>Math.abs(p.reduce((n,a,i)=>n+a.x*p[(i+1)%p.length].y-a.y*p[(i+1)%p.length].x,0))/2,
  urbanContains:(p,q)=>q.x>=Math.min(...p.map(v=>v.x))&&q.x<=Math.max(...p.map(v=>v.x))&&
    q.y>=Math.min(...p.map(v=>v.y))&&q.y<=Math.max(...p.map(v=>v.y)),
  houseFootprintParts:h=>[{points:rectangle(h.x,h.y).map(p=>({x:h.x+(p.x-h.x)*.2,y:h.y+(p.y-h.y)*.2}))}],
  underConstruction:()=>false,houseDoorInfo:h=>({outside:{x:h.x+1.5,y:h.y}}),
  pointBlockedForPeasant:()=>false,
  dist:(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),
  clamp:(x,a,b)=>Math.max(a,Math.min(b,x)),
  villagerPathBetween:(h,a,b)=>[a,b],findPeasantPath:(a,b)=>[a,b],
  pointAlongPath:(p,t)=>({x:p[0].x+(p.at(-1).x-p[0].x)*t,y:p[0].y+(p.at(-1).y-p[0].y)*t}),
  residentIdlePoint:p=>p,visualCycleFrac:()=>fraction,visualCycleDay:()=>90+fraction,
  viewDepthPoint:p=>p.y,worldPointVisible:()=>true,w2s:p=>({x:p.x-p.y,y:p.x+p.y}),
  withUrbanFigureOcclusion:(p,z,draw)=>draw(),ctx:{},
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
const dayHerd=animals.animals();
const cowHerd=dayHerd.filter(a=>a.species==='cow');
const stableHerd=dayHerd.filter(a=>a.species==='horse');
assert.equal(cowHerd.length,Math.floor(16/3),'1 cow per 3 U²');
assert.ok(cowHerd.every(a=>a.p.x>=40),'cattle graze in the white area by day');
assert.ok(animals.shepherdPosition(houses.find(h=>h.id===l2.cow)),
  'an L2 cowherd accompanies cattle to pasture');
assert.equal(dayHerd.filter(a=>a.species==='horse').length,stableHerd.length);
assert.ok(stableHerd.length>=4&&stableHerd.length<=12,'1-3 horses per shed in L3/L4');
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
console.log('Urban livestock integration regression PASS');
