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

// 1. The kit: six L3 pieces and three L1 cottage pieces, indexed triangles, palette colours.
assert.deepEqual(Object.keys(K.models).sort(),['chimney','door','doorCottage','joist','roof','roofThatch','windowCottage','windowGround','windowUpper']);
for(const [name,model] of Object.entries(K.models))for(const [pn,p] of Object.entries(model.parts)){
  assert.equal(p.i.length,p.c.length*3,name+'.'+pn+': three indices per triangle');
  assert.ok(p.i.every(i=>i>=0&&i*3<p.p.length),name+'.'+pn+': indices in range');
  assert.ok(p.c.every(i=>i>=0&&i<K.palette.length),name+'.'+pn+': palette colours');
}
assert.equal(K.palette[K.paletteKeys.indexOf('stone')],'#625e59','kit stone = procedural stone (brick swatches apply)');
console.log('PASS kit: '+Object.keys(K.models).length+' pieces');

// 2. L1, L2 and L3 houses, built and finished.
for(const level of [1,2,3])assert.equal(H.handles({type:'house',houseLevel:level}),true,'L'+level+' uses the kit');
for(const s of [{type:'house',houseLevel:4},{type:'house',houseLevel:3,building:true},{type:'house',houseLevel:1,building:true},{type:'tower'}])
  assert.equal(H.handles(s),false,JSON.stringify(s)+' keeps the procedural drawing');
console.log('PASS scope: L1, L2 and L3');

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
  // Construction assembly tags: one per triangle; frame, gables and roofs apart from the walls.
  assert.equal(m.tag.length,m.col.length,label+': a construction tag per triangle');
  assert.deepEqual([...new Set(m.tag)].sort(),['beam','body','gable','roof'],label+': walls, frame, gables, roofs');
  const roofCol=new Set(['roofSlate','roofSlateDark','roofCourse','roofRidge','chimney','chimneyCap'].map(k=>K.palette[K.paletteKeys.indexOf(k)]));
  assert.ok(m.col.every((c,t)=>!roofCol.has(c)||m.tag[t]==='roof'),label+': roofs and chimneys are laid last');
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

// 3a. L2 houses: one body, the L3 townhouse pieces (stone ground floor, jettied timbered floor).
let l2=0;
for(const w of [1.5,2])for(const doorSide of [-1,1])for(const angle of [0,.6,Math.PI/2,2.5]){
  const s={id:'l2-'+w+doorSide+angle,type:'house',houseLevel:2,auto:true,x:50,y:40,w,h:1,doorSide,angle};
  State.structures=[s];H.clear();
  const m=H.geometry(s),entry=sandbox.urbanHouseGeometry()[0],bodies=entry.parts.filter(p=>p.kind==='body'),label='L2 '+w+'U door '+doorSide+' angle '+angle.toFixed(1);
  assert.equal(bodies.length,1,label+': one body');
  let windows=0,members=0;bodies[0].points.forEach((a,i)=>{const p=sandbox.houseFacadePlan(s,bodies[0],{a,b:bodies[0].points[(i+1)%4]});windows+=p.windows.length;members+=p.beams.length});
  assert.equal((m.stats.windowUpper||0)+(m.stats.windowGround||0),windows,label+': a window piece for every planned window, on every wall');
  assert.equal(m.stats.members,members,label+': a timber member for every planned beam');
  assert.ok(m.stats.windowUpper>=2&&m.stats.windowGround>=2,label+': upper and ground-floor windows');
  assert.equal(m.stats.roof,1,label+': one slate roof');
  assert.equal(m.stats.door,1,label+': the stone-framed door');
  assert.ok(m.stats.joist>=4,label+': joists under the jetty');
  for(const k of ['roofThatch','doorCottage','windowCottage'])assert.ok(!m.stats[k],label+': no cottage '+k);
  l2++;
}
console.log('PASS '+l2+' L2 houses: one body with the townhouse pieces on every wall');

// 3b. L1 cottages: one body, daub walls on a timber frame, a cottage window for every planned window
// on every wall, the plank door, a thatched roof up to the fixed 1.45 U ridge, no L3 pieces.
let cottages=0;
for(const w of [1.5,2])for(const doorSide of [-1,1])for(const angle of [0,.6,Math.PI/2,2.5]){
  const s={id:'cot-'+w+doorSide+angle,type:'house',houseLevel:1,auto:true,x:50,y:40,w,h:1,doorSide,angle};
  State.structures=[s];H.clear();
  const m=H.geometry(s),entry=sandbox.urbanHouseGeometry()[0],bodies=entry.parts.filter(p=>p.kind==='body'),label='L1 '+w+'U door '+doorSide+' angle '+angle.toFixed(1);
  assert.equal(bodies.length,1,label+': one body');
  let windows=0;bodies[0].points.forEach((a,i)=>{windows+=sandbox.houseFacadePlan(s,bodies[0],{a,b:bodies[0].points[(i+1)%4]}).windows.length});
  assert.equal(m.stats.windowCottage,windows,label+': a cottage window for every planned window, on every wall');
  assert.ok(windows>=3,label+': windows on several walls');
  assert.equal(m.stats.members,4*4+2*windows,label+': corner posts, sill and wall plates on 4 walls, posts beside each window');
  assert.equal(m.stats.roofThatch,1,label+': one thatched roof');
  assert.equal(m.stats.doorCottage,1,label+': the plank door');
  for(const k of ['roof','door','windowUpper','windowGround','joist'])assert.ok(!m.stats[k],label+': no L3 '+k);
  const thatch=K.palette[K.paletteKeys.indexOf('roofThatch')];
  let ridge=0;for(let t=0;t<m.col.length;t++){if(m.tag[t]!=='roof')continue;for(let k=0;k<3;k++)ridge=Math.max(ridge,m.pos[t*9+k*3+2])}
  assert.ok(m.col.includes(thatch),label+': thatch colours');
  assert.ok(ridge<2.48+1e-6&&ridge>1.4,label+': roof up to the ridge (and the chimney) ('+ridge.toFixed(2)+')');
  const minZ=Math.min(...Array.from({length:m.pos.length/3},(_,i)=>m.pos[i*3+2]));
  assert.ok(minZ>=-.1,label+': nothing below the ground');
  assert.deepEqual([...new Set(m.tag)].sort(),['beam','body','gable','roof'],label+': construction tags');
  cottages++;
}
{const s={id:'cot-w',type:'house',houseLevel:1,auto:true,x:0,y:0,w:1.5,h:1,doorSide:1,angle:0};State.structures=[s];
 State.season='winter';H.clear();const winter=new Set(H.geometry(s).col);State.season='summer';H.clear();
 assert.ok(!winter.has(K.palette[K.paletteKeys.indexOf('roofThatch')])&&winter.has('#e7ece8'),'winter thatch is white');}
console.log('PASS '+cottages+' L1 cottages: framed daub walls, cottage windows on every wall, plank door, thatch');

// 4. Brick masonry recolours the kit stone like the procedural walls; winter whitens the roofs.
{const s={id:'kit-brick',type:'house',houseLevel:3,auto:true,x:0,y:0,w:1.5,h:1,doorSide:1,angle:0};State.structures=[s];
 H.clear();const stone=new Set(H.geometry(s).col);brick=true;H.clear();const bricks=new Set(H.geometry(s).col);brick=false;
 assert.ok(stone.has('#625e59')&&!bricks.has('#625e59')&&bricks.has('#8b5a43'),'brick swatches recolour the stone ground floor');
 State.season='winter';H.clear();const winter=new Set(H.geometry(s).col);State.season='summer';H.clear();
 assert.ok(!winter.has(K.palette[K.paletteKeys.indexOf('roofSlate')])&&winter.has('#e7ece8'),'winter roofs are white');}
console.log('PASS brick masonry and winter roofs');

// 5. Wiring: World 3D only; the 2.5D fallback keeps the procedural house.
const world=src('src/settlement-world3d.js'),html=src('index.html'),lab=src('figures-lab.html'),catalog=src('src/asset-catalog.js');
assert.match(world,/if\(!m\.tag&&!shopOpen&&window\.ConquerHouse3D\?\.addToBuilder\(m,house\)\)\{/,'addHouse hands kit houses to the kit, except a workshop open in section');
// The kit house keeps the workshop's street front (shop window and bracket sign, settlement-shop-cutaway.js).
const kitBranch=world.slice(world.indexOf('ConquerHouse3D?.addToBuilder(m,house)'),world.indexOf('return;',world.indexOf('ConquerHouse3D?.addToBuilder(m,house)')));
assert.match(kitBranch,/window\.ConquerShopCutaway\?\.addFront\(m,house\)/,'kit houses keep the workshop street front');
assert.match(world,/const kit=!!window\.ConquerHouse3D\?\.handles\(s\);/,'decals: kit houses keep only the night lights');
assert.match(world,/if\(!kit\)for\(const \[p0,p1\] of plan\.beams\)strip/,'no timber decals on kit houses');
assert.doesNotMatch(buildings,/ConquerHouse3D/,'2.5D fallback unchanged');
const assembly=src('src/settlement-construction-assembly.js');
assert.match(assembly,/castleSource\(s\)\|\|civicSource\(s\)\|\|kitHouseSource\(s\)\|\|houseSource\(s\)/,'construction sites build the kit house in World 3D');
assert.match(assembly,/W3\.addOutbuilding\(m,s,part,winter\)/,'kit sites keep the yard outbuildings, without a second set of chimneys');
assert.match(world,/addMesh,addHouse,addOutbuilding,/,'world3d exports addOutbuilding for the sites');
assert.ok(html.indexOf('assets/house-models.js')>0&&html.indexOf('assets/house-models.js')<html.indexOf('settlement-house3d.js'),'kit registry loaded before the assembler');
assert.ok(lab.includes('assets/house-models.js')&&catalog.includes("global:'ConquerHouseModels'"),'kit listed in the Asset Lab');
assert.ok(fs.existsSync(root+'tools/blender/build_houses.py'),'Blender builder in the repository');
console.log('PASS World 3D wiring, Asset Lab listing, 2.5D fallback untouched');
