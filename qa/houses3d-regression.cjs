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
const sandbox={Math,Number,peasantHash:hash,rectWorldPoints,circleWorldPoints,terrainElevation:()=>0,
  clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),dist:(a,b)=>Math.hypot(a.x-b.x,a.y-b.y)};
vm.createContext(sandbox);
const pitch=core.match(/const HOUSE_ROOF_PITCH=[^;]+;/)[0],facade=urban.match(/const HOUSE_WINDOW_HALF_W=[^;]+;/)[0];
vm.runInContext([pitch,facade,
  ...['houseLevel','houseDimensionScale','houseFootprintDimensions','housePlanType','houseTurretType',
    'houseLocalToWorld','houseTurretInfo','houseFootprintParts','houseBodyHeight','houseRoofSpan','housePartRidge']
    .map(n=>fnSource(core,n)),
  fnSource(urban,'urbanHouseFaces'),fnSource(urban,'houseFacadePlan'),
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
    {id:'compact-'+i,type:'house',urbanCompact:true,x:100,y:100,w:1.6,h:1.13,angle:i*.1,houseLevel:4},
    {id:'manual-'+i,type:'house',x:100,y:100,w:1.5,h:1,angle:i*.1,houseLevel:4}
  ]){
    const parts=sandbox.houseFootprintParts(house),turret=parts.find(p=>p.kind==='turret'),body=parts[0];
    const wallH=sandbox.houseBodyHeight(house),ridge=sandbox.housePartRidge(house,body,wallH);
    assert.ok(turret,'L4 has a turret');turrets++;
    assert.ok(turret.bodyH>wallH+.5,house.id+': turret body rises a floor above the eaves');
    assert.ok(turret.roofH>ridge+.4,house.id+': turret cone clears the main ridge ('+turret.roofH+' vs '+ridge.toFixed(2)+')');
    assert.equal(turret.floorZ,wallH*.5,house.id+': turret floor band matches the house');
  }
}
const manual=sandbox.houseTurretInfo({id:'m',type:'house',x:0,y:0,w:1.5,h:1,houseLevel:4});
assert.equal(+manual.bodyH.toFixed(2),2.62,'manual L4 keeps its original turret body');
assert.equal(+manual.roofH.toFixed(2),3.42,'manual L4 keeps its original turret roof');
assert.match(buildings,/breakZ=turret\.floorZ/,'Canvas turret uses the shared floor band');
assert.match(world,/part\.kind==='turret'\?part\.floorZ/,'WebGL2 turret uses the shared floor band');

// 3. Window rows sit inside their floor on every wall height (L2/L3 1.72 U, auto L4 2.38 U).
for(const [level,bodyH] of [[2,1.72],[3,1.72],[4,1.72],[4,2.38]]){
  const points=rectWorldPoints(100,100,1.5,1,0),part={kind:'body',points,bodyH,roofH:bodyH+.87,roofTurn:0,w:1.5,h:1};
  const plan=sandbox.houseFacadePlan({id:'w',houseLevel:level},part,{a:points[0],b:points[1]});
  const rows=[...new Set(plan.windows.map(w=>+w.z.toFixed(3)))].sort((a,b)=>a-b),fb=bodyH*.5,hh=.15;
  assert.equal(rows.length,2,'two window rows');
  assert.ok(rows[0]-hh>0&&rows[0]+hh<fb,'L'+level+' '+bodyH+': ground-floor row inside the ground floor');
  assert.ok(rows[1]-hh>fb+.05&&rows[1]+hh<bodyH,'L'+level+' '+bodyH+': upper row inside the upper floor');
  if(bodyH===1.72)assert.deepEqual(rows,[.52,1.34],'1.72 U walls keep their original rows');
}
console.log('PASS houses3d-regression: sheds, '+turrets+' L4 turrets, facade rows');
