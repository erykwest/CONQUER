'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const root=__dirname+'/../';
const source=fs.readFileSync(root+'src/settlement-livestock.js','utf8');
const html=fs.readFileSync(root+'index.html','utf8');
const fields=fs.readFileSync(root+'src/settlement-population-fields.js','utf8');
const residents=fs.readFileSync(root+'src/settlement-population-residents.js','utf8');
const renderer=fs.readFileSync(root+'src/settlement-render.js','utf8');
const where=name=>html.indexOf('settlement-'+name+'.js');
assert.ok(where('animals')>0&&where('livestock')>where('animals')&&where('render')>where('livestock'));
assert.match(fields,/ConquerLivestock\?\.lotKindForHouse\(h\)/);
assert.match(residents,/ConquerLivestock\.shepherdPosition\(house\)/);
assert.match(renderer,/ConquerLivestock\?\.draw\(\)/);
assert.match(source,/Math\.max\(1\.5,State\.view\.scale\*5\.75\)/);
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
  withUrbanFigureOcclusion:(p,z,draw)=>draw(),ctx:{}
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
assert.deepEqual({...animals.summary()},{garden:1,goat:1,shepherd:1,goats:8,sheep:16});
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
console.log('Urban livestock integration regression PASS');
