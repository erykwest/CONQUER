'use strict';
// L3 houses dressed with the Blender kit (src/settlement-house3d.js, src/assets/house-models.js):
// the kit is well formed, every wall of every body gets the windows and timber members of its
// facade plan (not only the walls facing the camera), each body gets one roof, the door and the
// chimneys are placed, nothing hangs below the ground or far outside the plan, the brick masonry
// swatches still recolour the stone, and World 3D is the only renderer that uses the kit.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const root=__dirname+'/../';
const src=f=>fs.readFileSync(root+f,'utf8');
const core=src('src/settlement-core.js'),urban=src('src/settlement-urban.js'),buildings=src('src/settlement-buildings.js');
function fnSource(text,name){
  const start=text.indexOf('function '+name+'(');
  assert.ok(start>=0,'missing function '+name);
  let i=text.indexOf('{',start),depth=0;
  for(;i<text.length;i++){if(text[i]==='{')depth++;else if(text[i]==='}'&&--depth===0)return text.slice(start,i+1)}
  throw new Error('unbalanced function '+name);
}
const hash=s=>{let h=2166136261;for(const c of String(s))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0};
const rectWorldPoints=(x,y,w,h,a=0)=>{const ca=Math.cos(a),sa=Math.sin(a);return[[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]].map(([u,v])=>({x:x+u*ca-v*sa,y:y+u*sa+v*ca}))};
const pointInPolygon=(p,pts)=>{let c=false;for(let i=0,j=pts.length-1;i<pts.length;j=i++){const a=pts[i],b=pts[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)c=!c}return c};
const pointSegmentDistance=(p,a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,L=dx*dx+dy*dy||1,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/L));return Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t)};
const window={};let brick=false;
const State={season:'summer',structures:[],visualPalette:'stone'};
const sandbox={Math,Number,Object,Array,Map,Float32Array,JSON,String,window,State,peasantHash:hash,rectWorldPoints,
  circleWorldPoints:()=>[],terrainElevation:()=>0,clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),dist:(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),
  roadList:()=>[],pointInPolygon,pointSegmentDistance,urbanDenseHouseDoorInfo:()=>null,underConstruction:s=>!!s.building,
  // One chimney on the main ridge, as chimneySpecs does for a detached house.
  chimneySpecs:s=>[{center:{x:s.x,y:s.y},angle:s.angle||0,z0:2.0,z1:2.48,index:0}],
  withStructureVisualMaterial:(s,f)=>f(),masonryMaterial:()=>brick?'brick':'stone',
  visualPaletteColor:hex=>brick&&hex.toLowerCase()==='#625e59'?'#8b5a43':hex};
vm.createContext(sandbox);
const constant=(text,name)=>text.match(new RegExp('const '+name+'=[^;]+;'))[0];
vm.runInContext([constant(core,'HOUSE_ROOF_PITCH'),constant(core,'HOUSE_FLOOR_BREAK'),constant(urban,'HOUSE_WINDOW_HALF_W'),
  constant(urban,'TURRET_WINDOW_HALF_W'),constant(urban,'HOUSE_DOOR_TOP'),
  ...['houseLevel','houseDimensionScale','houseFootprintDimensions','housePlanType','houseTurretType','houseLocalToWorld',
    'houseFloorBreak','houseJetty','houseTurretInfo','houseStreetSide','houseCornerSide','houseFootprintParts',
    'houseBodyHeight','houseRoofSpan','housePartRidge','housePartRidges'].map(n=>fnSource(core,n)),
  ...['urbanHouseFaces','houseFacadePlan','houseFacadeDoorCut','houseFacadeTurretCut'].map(n=>fnSource(urban,n)),
  ...['houseDoorInfo','inferHouseDoorSide','closestPointOnSegment'].map(n=>fnSource(buildings,n)),
  // urbanHouseGeometry for detached houses: the footprint parts with their wall and ridge heights.
  `function urbanHouseGeometry(){return State.structures.filter(s=>s.type==='house').map(house=>{
     const parts=houseFootprintParts(house),ridges=housePartRidges(house,parts);
     return{house,parts:parts.map((p,i)=>({...p,bodyH:p.kind==='turret'?p.bodyH:houseBodyHeight(house),roofH:ridges[i]})),dormers:[]}})}`
].join('\n'),sandbox);
for(const f of ['src/assets/house-models.js','src/settlement-mesh3d.js','src/settlement-house3d.js'])vm.runInContext(src(f),sandbox,{filename:f});
const K=window.ConquerHouseModels,H=window.ConquerHouse3D;

// 1. The kit: six pieces, indexed triangles, palette colours.
assert.deepEqual(Object.keys(K.models).sort(),['chimney','door','joist','roof','windowGround','windowUpper']);
for(const [name,model] of Object.entries(K.models))for(const [pn,p] of Object.entries(model.parts)){
  assert.equal(p.i.length,p.c.length*3,name+'.'+pn+': three indices per triangle');
  assert.ok(p.i.every(i=>i>=0&&i*3<p.p.length),name+'.'+pn+': indices in range');
  assert.ok(p.c.every(i=>i>=0&&i<K.palette.length),name+'.'+pn+': palette colours');
}
assert.equal(K.palette[K.paletteKeys.indexOf('stone')],'#625e59','kit stone = procedural stone (brick swatches apply)');
console.log('PASS kit: '+Object.keys(K.models).length+' pieces');

// 2. Only L3 houses, built and finished.
assert.equal(H.handles({type:'house',houseLevel:3}),true);
for(const s of [{type:'house',houseLevel:2},{type:'house',houseLevel:4},{type:'house',houseLevel:3,building:true},{type:'tower'}])
  assert.equal(H.handles(s),false,JSON.stringify(s)+' keeps the procedural drawing');
console.log('PASS pilot scope: L3 only');

// 3. Every wall, every body: windows and members as the facade plan, one roof per body.
let houses=0;
for(const plan of ['L','T'])for(const w of [1.5,2])for(const doorSide of [-1,1])for(const angle of [0,.6,Math.PI/2,2.5]){
  let id=null;for(let i=0;i<500&&!id;i++){const c='kit-'+plan+w+doorSide+'-'+i;if(sandbox.housePlanType({id:c})===plan)id=c}
  const s={id,type:'house',houseLevel:3,auto:true,x:50,y:40,w,h:1,doorSide,angle};
  State.structures=[s];H.clear();
  const m=H.geometry(s),entry=sandbox.urbanHouseGeometry()[0],bodies=entry.parts.filter(p=>p.kind==='body');
  let windows=0,members=0,label=plan+' '+w+'U door '+doorSide+' angle '+angle.toFixed(1);
  for(const part of bodies)part.points.forEach((a,i)=>{const plan_=sandbox.houseFacadePlan(s,part,{a,b:part.points[(i+1)%part.points.length]});windows+=plan_.windows.length;members+=plan_.beams.length});
  assert.equal((m.stats.windowUpper||0)+(m.stats.windowGround||0),windows,label+': a window piece for every planned window, on every wall');
  assert.equal(m.stats.members,members,label+': a timber member for every planned beam, on every wall');
  assert.ok(m.stats.windowUpper>=bodies.length*2&&m.stats.windowGround>=2,label+': upper and ground-floor windows');
  assert.equal(m.stats.roof,bodies.length,label+': one kit roof per body');
  assert.equal(m.stats.door,1,label+': one door');
  assert.equal(m.stats.chimney,1,label+': the chimneys of chimneySpecs');
  assert.ok(m.stats.joist>=4,label+': joists under the jetty');
  // Inside the plan (roof overhang, shutters, step and sill aside) and never below the ground.
  const all=bodies.flatMap(p=>p.points),minX=Math.min(...all.map(p=>p.x))-.2,maxX=Math.max(...all.map(p=>p.x))+.2,minY=Math.min(...all.map(p=>p.y))-.2,maxY=Math.max(...all.map(p=>p.y))+.2;
  const top=Math.max(...entry.parts.map(p=>p.roofH))+.05;
  for(let i=0;i<m.pos.length;i+=3){
    const x=m.pos[i],y=m.pos[i+1],z=m.pos[i+2];
    assert.ok(x>=minX&&x<=maxX&&y>=minY&&y<=maxY,label+': geometry stays on the plan');
    assert.ok(z>=-.25&&z<=Math.max(top,2.48)+1e-6,label+': between the eaves overhang and the chimney top (z '+z.toFixed(2)+')');
  }
  // The door stands at houseDoorInfo, in the recessed ground floor.
  const d=sandbox.houseDoorInfo(s),stepColor=K.palette[K.paletteKeys.indexOf('step')];
  let near=false;for(let t=0;t<m.col.length;t++)if(m.col[t]===stepColor){const o=t*9;if(Math.hypot(m.pos[o]-d.surface.x,m.pos[o+1]-d.surface.y)<.3)near=true}
  assert.ok(near,label+': the door step at the door');
  houses++;
}
console.log('PASS '+houses+' L3 houses: windows and timber on every wall, roofs, door, chimney, joists, inside the plan');

// 4. Brick masonry recolours the kit stone like the procedural walls; winter whitens the roofs.
{const s={id:'kit-brick',type:'house',houseLevel:3,auto:true,x:0,y:0,w:1.5,h:1,doorSide:1,angle:0};State.structures=[s];
 H.clear();const stone=new Set(H.geometry(s).col);brick=true;H.clear();const bricks=new Set(H.geometry(s).col);brick=false;
 assert.ok(stone.has('#625e59')&&!bricks.has('#625e59')&&bricks.has('#8b5a43'),'brick swatches recolour the stone ground floor');
 State.season='winter';H.clear();const winter=new Set(H.geometry(s).col);State.season='summer';H.clear();
 assert.ok(!winter.has(K.palette[K.paletteKeys.indexOf('roofSlate')])&&winter.has('#e7ece8'),'winter roofs are white');}
console.log('PASS brick masonry and winter roofs');

// 5. Wiring: World 3D only; the 2.5D fallback keeps the procedural house.
const world=src('src/settlement-world3d.js'),html=src('index.html'),lab=src('figures-lab.html'),catalog=src('src/asset-catalog.js');
assert.match(world,/if\(!m\.tag&&window\.ConquerHouse3D\?\.addToBuilder\(m,house\)\)\{/,'addHouse hands kit houses to the kit');
assert.match(world,/const kit=!!window\.ConquerHouse3D\?\.handles\(s\);/,'decals: kit houses keep only the night lights');
assert.match(world,/if\(!kit\)for\(const \[p0,p1\] of plan\.beams\)strip/,'no timber decals on kit houses');
assert.doesNotMatch(buildings,/ConquerHouse3D/,'2.5D fallback unchanged');
assert.ok(html.indexOf('assets/house-models.js')>0&&html.indexOf('assets/house-models.js')<html.indexOf('settlement-house3d.js'),'kit registry loaded before the assembler');
assert.ok(lab.includes('assets/house-models.js')&&catalog.includes("global:'ConquerHouseModels'"),'kit listed in the Asset Lab');
assert.ok(fs.existsSync(root+'tools/blender/build_houses.py'),'Blender builder in the repository');
console.log('PASS World 3D wiring, Asset Lab listing, 2.5D fallback untouched');
