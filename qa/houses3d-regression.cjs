'use strict';
// House geometry audit: lean-to sheds must not crash the WebGL2 builder, L4 turrets must
// rise above the main roof, and facade window rows must stay inside their floors.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const root=__dirname+'/../src/';
const core=fs.readFileSync(root+'settlement-core.js','utf8');
const urban=fs.readFileSync(root+'settlement-urban.js','utf8');
const world=fs.readFileSync(root+'settlement-world3d.js','utf8');
const buildings=fs.readFileSync(root+'settlement-buildings.js','utf8');

function fnSource(src,name){
  const start=src.indexOf('function '+name+'(');
  assert.ok(start>=0,'missing function '+name);
  let i=src.indexOf('{',start),depth=0;
  for(;i<src.length;i++){
    if(src[i]==='{')depth++;
    else if(src[i]==='}'&&--depth===0)return src.slice(start,i+1);
  }
  throw new Error('unbalanced function '+name);
}
function hash(s){
  let h=2166136261;
  for(const c of String(s))h=Math.imul(h^c.charCodeAt(0),16777619);
  return h>>>0;
}
const rectWorldPoints=(x,y,w,h,a=0)=>{
  const ca=Math.cos(a),sa=Math.sin(a);
  return[[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]].map(([u,v])=>({x:x+u*ca-v*sa,y:y+u*sa+v*ca}));
};
const circleWorldPoints=(x,y,r,n)=>Array.from({length:n},(_,i)=>({x:x+Math.cos(i/n*Math.PI*2)*r,y:y+Math.sin(i/n*Math.PI*2)*r}));
// Two crossing streets around (100,100): every detached house there stands on a corner.
const cornerRoads=[{type:'road',a:{x:90,y:98.6},b:{x:110,y:98.6}},{type:'road',a:{x:101.8,y:90},b:{x:101.8,y:110}}];
const sandbox={Math,Number,peasantHash:hash,rectWorldPoints,circleWorldPoints,terrainElevation:()=>0,
  clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),dist:(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),chimneySpecs:()=>[],
  roadList:()=>cornerRoads};
vm.createContext(sandbox);
const constant=(src,name)=>src.match(new RegExp('const '+name+'=[^;]+;'))[0];
vm.runInContext([constant(core,'HOUSE_ROOF_PITCH'),constant(core,'HOUSE_FLOOR_BREAK'),constant(urban,'HOUSE_WINDOW_HALF_W'),
  constant(urban,'TURRET_WINDOW_HALF_W'),constant(urban,'HOUSE_DOOR_TOP'),
  ...['houseLevel','houseDimensionScale','houseFootprintDimensions','housePlanType','houseTurretType','houseLocalToWorld',
    'houseFloorBreak','houseJetty','houseTurretInfo','houseStreetSide','houseCornerSide','houseFootprintParts',
    'houseBodyHeight','houseRoofSpan','housePartRidge'].map(n=>fnSource(core,n)),
  ...['urbanHouseFaces','houseFacadePlan','houseFacadeDoorCut','houseFacadeTurretCut','houseTurretFacade',
    'urbanHouseDormers','urbanDormerSlots','urbanDormer'].map(n=>fnSource(urban,n)),
  fnSource(world,'addOutbuilding')].join('\n'),sandbox);

// 1. Lean-to sheds leave the courtyard side open: the WebGL2 builder must take the roof
// from the last face instead of faces[n] (which crashed the renderer into Canvas fallback).
const mesh=()=>({faces:[],prisms:0,face(poly,col){assert.ok(Array.isArray(poly)&&poly.length>=3);this.faces.push({poly,col})},prism(){this.prisms++}});
for(const angle of [0,.7,Math.PI/2,2.4]){
  const center={x:100,y:100},points=rectWorldPoints(center.x,center.y,1.6,.9,angle);
  const shed={kind:'outbuilding',type:'shed',center,points,w:1.6,h:.9,roofTurn:0,roofAngle:angle,bodyH:.62,roofH:1.02};
  const faces=sandbox.urbanHouseFaces({id:'h'},shed);
  assert.equal(faces.length,points.length,'shed: open side omitted, roof appended');
  const m=mesh();
  assert.doesNotThrow(()=>sandbox.addOutbuilding(m,{id:'h'},shed,false),'shed at angle '+angle);
  const roof=m.faces.at(-1);
  assert.equal(roof.col,'#6b4938','shed roof is the last face');
  assert.deepEqual(roof.poly.map(p=>+p.z.toFixed(3)).sort(),[.62,.62,1.02,1.02],'shed roof spans bodyH..roofH');
  assert.equal(m.faces.filter(f=>f.col==='#5d4431').length,1,'one back plank wall');
  assert.equal(m.prisms,3,'three posts on a 1.6 U lean-to');
  const store={...shed,type:'store',roofH:1.27,bodyH:.82};
  assert.doesNotThrow(()=>sandbox.addOutbuilding(mesh(),{id:'h'},store,false),'store at angle '+angle);
}

// 2. L4 turrets follow the wall height, so they clear the main ridge of tall auto/streetfront houses.
let turrets=0;
for(let i=0;i<64;i++){
  for(const house of [
    {id:'auto-'+i,type:'house',auto:true,x:100,y:100,w:1.5,h:1,angle:i*.1,houseLevel:4},
    {id:'compact-'+i,type:'house',urbanCompact:true,turretCorner:1,x:100,y:100,w:1.6,h:1.13,angle:i*.1,houseLevel:4},
    {id:'manual-'+i,type:'house',x:100,y:100,w:1.5,h:1,angle:i*.1,houseLevel:4}
  ]){
    const parts=sandbox.houseFootprintParts(house),turret=parts.find(p=>p.kind==='turret'),body=parts[0];
    const wallH=sandbox.houseBodyHeight(house),ridge=sandbox.housePartRidge(house,body,wallH);
    assert.ok(turret,'L4 has a turret');turrets++;
    assert.ok(turret.bodyH>wallH+.5,house.id+': turret body rises a floor above the eaves');
    assert.ok(turret.roofH>ridge+.4,house.id+': turret cone clears the main ridge ('+turret.roofH+' vs '+ridge.toFixed(2)+')');
    assert.equal(turret.floorZ,sandbox.houseFloorBreak(wallH),house.id+': turret floor band matches the house');
  }
}
const manual=sandbox.houseTurretInfo({id:'m',type:'house',x:100,y:100,w:1.5,h:1,houseLevel:4});
assert.equal(+manual.bodyH.toFixed(2),2.62,'manual L4 keeps its original turret body');
assert.equal(+manual.roofH.toFixed(2),3.42,'manual L4 keeps its original turret roof');
assert.match(buildings,/breakZ=turret\.floorZ/,'Canvas turret uses the shared floor band');
assert.match(world,/part\.kind==='turret'\?part\.floorZ/,'WebGL2 turret uses the shared floor band');

// 3. Window rows sit inside their floor on every wall height (L2/L3 1.72 U, auto L4 2.38 U).
for(const [level,bodyH] of [[2,1.72],[3,1.72],[4,1.72],[4,2.38]]){
  const points=rectWorldPoints(100,100,1.5,1,0),part={kind:'body',points,bodyH,roofH:bodyH+.87,roofTurn:0,w:1.5,h:1};
  const plan=sandbox.houseFacadePlan({id:'w',houseLevel:level},part,{a:points[0],b:points[1]});
  const rows=[...new Set(plan.windows.map(w=>+w.z.toFixed(3)))].sort((a,b)=>a-b),fb=sandbox.houseFloorBreak(bodyH),hh=.15;
  assert.equal(rows.length,2,'two window rows');
  assert.ok(rows[0]-hh>0&&rows[0]+hh<fb,'L'+level+' '+bodyH+': ground-floor row inside the ground floor');
  assert.ok(rows[1]-hh>fb+.05&&rows[1]+hh<bodyH,'L'+level+' '+bodyH+': upper row inside the upper floor');
  if(bodyH===1.72)assert.deepEqual(rows,[.52,1.34],'1.72 U walls keep their original rows');
}
// 4. Gable-front townhouses: the main ridge runs away from the street, wings cross it.
for(const level of [3,4])for(let i=0;i<16;i++){
  const house={id:'gable-'+level+'-'+i,type:'house',urbanCompact:true,gableFront:true,x:100,y:100,w:1,h:1.5,angle:i*.2,houseLevel:level};
  const bodies=sandbox.houseFootprintParts(house).filter(p=>p.kind==='body');
  assert.equal(bodies[0].roofTurn,Math.PI/2,house.id+': main ridge perpendicular to the street');
  assert.ok(bodies.slice(1).every(p=>p.roofTurn===0),house.id+': back wing crosses the main ridge');
  assert.ok(bodies.every(p=>Math.abs(p.cx)+p.w/2<=house.w/2+1e-9),house.id+': wings stay within the street width');
}

// 5. Only corner L4 houses get a turret, on the street-front corner towards the side street.
// Townhouses: flush with the party wall, past the facade by `front` (the layout steps the building
// back by that much), never past the side.
let corners=0;
for(let i=0;i<64;i++)for(const gableFront of [false,true]){
  const turretCorner=i%2?1:-1;
  const house={id:'corner-'+i,type:'house',urbanCompact:true,gableFront,turretCorner,x:100,y:100,w:gableFront?1:1.5,h:gableFront?1.5:1.13,angle:0,houseLevel:4};
  const t=sandbox.houseTurretInfo(house);
  assert.ok(t.cy<0&&t.sy===-1&&t.sx===turretCorner,house.id+': turret on the street corner');
  assert.ok(Math.abs(Math.abs(t.cx)+t.rad-house.w/2)<1e-9,house.id+': flush with the party wall');
  assert.ok(Math.abs(t.cy-t.rad+house.h/2+t.front)<1e-9&&t.front>0,house.id+': reaches the street line');
  assert.equal(sandbox.houseTurretInfo({...house,turretCorner:0}),null,house.id+': mid-row townhouse has no turret');
  corners++;
}
for(let i=0;i<32;i++)for(const doorSide of [-1,1]){
  const house={id:'detached-'+i,type:'house',auto:true,x:100,y:100,w:1.5,h:1,angle:0,houseLevel:4,doorSide};
  const parts=sandbox.houseFootprintParts(house),t=parts.find(p=>p.kind==='turret');
  const bodies=parts.filter(p=>p.kind==='body');
  assert.equal(t.sy,doorSide,house.id+': turret on the door (street) side');
  assert.equal(t.sx,1,house.id+': turret towards the side street (x=101.8)');
  assert.ok(bodies.some(p=>Math.abs(doorSide*t.cy+t.rad*.55-(doorSide*p.cy+p.h/2))<1e-9),house.id+': turret on a street-side body corner');
}
sandbox.roadList=()=>[cornerRoads[0]];
assert.equal(sandbox.houseTurretInfo({id:'single-street',type:'house',auto:true,x:100,y:100,w:1.5,h:1,houseLevel:4,doorSide:1}),null,'one street: no turret');
sandbox.roadList=()=>cornerRoads;
assert.match(buildings,/lateralSign=turret&&turret\.sx===hashSign\?-hashSign:hashSign/,'door takes the half away from the turret');

// 6. Turret facades: timber frame and at least three outward windows on each L4 turret.
for(const type of ['round','square'])for(let i=0;i<24;i++){
  const id=['t',type,i].join('-'),house={id,type:'house',urbanCompact:true,turretCorner:1,x:100,y:100,w:1.5,h:1.13,angle:i*.3,houseLevel:4};
  let t=sandbox.houseTurretInfo(house);
  if(t.type!==type)continue;
  const plan=sandbox.houseTurretFacade(t),street={x:-Math.sin(t.angle)*t.sy,y:Math.cos(t.angle)*t.sy};
  const outward=plan.windows.filter(w=>w.normal.x*street.x+w.normal.y*street.y>-1e-9);
  assert.ok(outward.length>=3,id+': at least three windows look to the street side ('+outward.length+')');
  assert.ok(plan.windows.every(w=>w.z-w.hh>t.floorZ&&w.z+w.hh<t.bodyH),id+': windows inside the cream storeys');
  assert.ok(plan.beams.length>=12,id+': timber frame');
  assert.ok(plan.beams.every(b=>[b.a,b.b].every(v=>v.z>=t.floorZ&&v.z<=t.bodyH)),id+': beams on the timbered storeys');
}

// 7. The facade stretch covered by the turret keeps no window or beam.
{
  const house={id:'cut',type:'house',urbanCompact:true,turretCorner:1,x:100,y:100,w:1.5,h:1.13,angle:0,houseLevel:4};
  const parts=sandbox.houseFootprintParts(house),body={...parts[0],bodyH:2.38,roofH:3.36},t=body.turret,pts=body.points;
  const edge={a:pts[0],b:pts[1]},plan=sandbox.houseFacadePlan(house,body,edge);
  const mx=(edge.a.x+edge.b.x)/2,c=t.center.x-mx;
  assert.ok(plan.windows.every(w=>Math.abs(w.off-c)>=t.rad+HALF()),'no street window behind the turret');
  assert.ok(plan.beams.every(([a,b])=>Math.min(a.off,b.off)>=c+t.rad+.02||Math.max(a.off,b.off)<=c-t.rad-.02),'no beam behind the turret');
  function HALF(){return .0875}
}

// 8. Dormers: two per long side of each L4 main body, fewer only where the turret stands.
let dormers=0;
for(let i=0;i<32;i++){
  const house={id:'dormer-'+i,type:'house',auto:true,x:100,y:100,w:1.5,h:1,angle:i*.2,houseLevel:4,doorSide:1};
  const parts=sandbox.houseFootprintParts(house).map(p=>({...p,bodyH:p.kind==='turret'?p.bodyH:2.38,roofH:p.kind==='turret'?p.roofH:2.38+1.732*(p.roofTurn?p.w:p.h)/2}));
  const all=sandbox.urbanHouseDormers(house,parts),free=sandbox.urbanHouseDormers(house,parts.map(p=>({...p,turret:null})));
  assert.equal(free.length,4,house.id+': two dormers per slope without a turret');
  assert.ok(all.length>=2,house.id+': at least two dormers beside the turret');
  const body=parts[0];
  for(const d of all){
    const f=d.faces.find(q=>q.kind==='front');
    assert.ok(f.pts.every(v=>v.z>body.bodyH&&v.z<body.roofH),house.id+': dormer sits on the roof');
    assert.ok(d.window.z-d.window.hh>f.pts[0].z&&d.window.z+d.window.hh<f.pts[2].z,house.id+': dormer window inside its front');
  }
  assert.equal(sandbox.urbanHouseDormers({...house,houseLevel:3},parts).length,0,'no dormers below L4');
  dormers+=all.length;
}
// 9. Lower stone ground floor, recessed under a jetty on the door side and the opposite side only.
assert.equal(sandbox.houseFloorBreak(1.72),1.72*.42,'ground floor takes 42% of the wall');
for(const level of [1,2,3,4]){
  const house={id:'jetty-'+level,type:'house',auto:true,x:100,y:100,w:1.5,h:1,angle:.4,houseLevel:level,doorSide:1};
  for(const p of sandbox.houseFootprintParts(house).filter(q=>q.kind==='body')){
    if(level===1){assert.equal(p.basePoints,undefined,'L1 cottages have no jetty');continue}
    const d=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),mid=(pts,i)=>({x:(pts[i].x+pts[(i+1)%4].x)/2,y:(pts[i].y+pts[(i+1)%4].y)/2});
    for(const i of [0,2])assert.ok(Math.abs(d(mid(p.points,i),mid(p.basePoints,i))-.07)<1e-9,'L'+level+': ±Y walls recessed by the jetty');
    for(const i of [1,3])assert.ok(d(mid(p.points,i),mid(p.basePoints,i))<1e-9,'L'+level+': side walls stay flush');
  }
}
assert.match(world,/basePoints/,'WebGL2 builds the recessed ground floor');
assert.match(buildings,/extrudePolygonAt\(part\.basePoints\|\|part\.points,0,floorBreak/,'Canvas builds the recessed ground floor');

// 10. No window on or over the door: a ground-floor window keeps clear of the leaf or is dropped.
{
  const points=rectWorldPoints(100,100,1.5,1,0),part={kind:'body',points,bodyH:1.72,roofH:2.59,roofTurn:0,w:1.5,h:1};
  const edge={a:points[0],b:points[1]},house={id:'door',houseLevel:2,w:1.5};
  for(const off of [-.375,-.3,0,.36]){
    sandbox.houseDoorInfo=()=>({surface:{x:100+off,y:99.5},normal:{x:0,y:-1},tangent:{x:1,y:0}});
    const plan=sandbox.houseFacadePlan(house,part,edge);
    const low=plan.windows.filter(w=>w.z<.8),high=plan.windows.filter(w=>w.z>.8);
    assert.equal(high.length,2,'upper windows stay');
    assert.ok(low.every(w=>Math.abs(w.off-off)>=.0875+.08+.06-1e-9),'ground window clear of the door at '+off);
  }
  sandbox.houseDoorInfo=()=>({surface:{x:100,y:100.5},normal:{x:0,y:1},tangent:{x:1,y:0}});
  assert.equal(sandbox.houseFacadePlan(house,part,edge).windows.length,4,'other walls keep their windows');
  delete sandbox.houseDoorInfo;
}
console.log('PASS houses3d-regression: sheds, '+turrets+' L4 turrets ('+corners+' street corners), facade rows, '+dormers+' dormers');
