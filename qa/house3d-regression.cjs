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
const window={};
const State={season:'summer',structures:[],visualPalette:'stone'};
const sandbox={Math,Number,Object,Array,Map,Float32Array,JSON,String,window,State,peasantHash:hash,rectWorldPoints,
  circleWorldPoints:()=>[],terrainElevation:()=>0,clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),dist:(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),
  roadList:()=>[],pointInPolygon,pointSegmentDistance,urbanDenseHouseDoorInfo:()=>null,underConstruction:s=>!!s.building,
  urbanDenseParts:()=>[],
};
vm.createContext(sandbox);
const constant=(text,name)=>text.match(new RegExp('const '+name+'=[^;]+;'))[0];
// The game's own clay recolouring: brick masonry and the clay palette (settlement-core.js).
vm.runInContext(core.slice(core.indexOf('const CLAY_VISUAL_SWATCHES='),core.indexOf('});',core.indexOf('const CLAY_VISUAL_SWATCHES='))+3)+
  '\nlet structureVisualMaterial=null;\n'+['masonryMaterial','withStructureVisualMaterial','visualPaletteColor'].map(n=>fnSource(core,n)).join('\n'),sandbox);
const castle=src('src/settlement-castle-structures.js');
vm.runInContext([constant(core,'HOUSE_ROOF_PITCH'),constant(core,'HOUSE_FLOOR_BREAK'),constant(urban,'HOUSE_WINDOW_HALF_W'),
  constant(core,'CHIMNEY_SPACING'),constant(core,'L1_CHIMNEY_DEPTH'),fnSource(core,'houseSideChimney'),fnSource(core,'houseRidgeHeight'),
  fnSource(castle,'chimneySpecs'),fnSource(urban,'houseFacadeChimneyCut'),'function isLonghouse(){return false}',
  constant(urban,'TURRET_WINDOW_HALF_W'),constant(urban,'HOUSE_DOOR_TOP'),
  ...['houseLevel','houseDimensionScale','houseFootprintDimensions','housePlanType','houseTurretType','houseLocalToWorld',
    'houseFloorBreak','houseJetty','houseTurretInfo','houseStreetSide','houseCornerSide','houseFootprintParts',
    'houseBodyHeight','houseRoofSpan','housePartRidge','housePartRidges'].map(n=>fnSource(core,n)),
  ...['urbanHouseFaces','houseFacadePlan','houseFacadeDoorCut','houseFacadeTurretCut','houseTurretFacade',
    'urbanHouseDormers','urbanDormerSlots','urbanDormer'].map(n=>fnSource(urban,n)),
  ...['houseDoorInfo','inferHouseDoorSide','closestPointOnSegment'].map(n=>fnSource(buildings,n)),
  // urbanHouseGeometry for detached houses: the footprint parts with their wall and ridge heights.
  `function urbanHouseGeometry(){return State.structures.filter(s=>s.type==='house').map(house=>{
     const parts=houseFootprintParts(house),ridges=housePartRidges(house,parts);
     const full=parts.map((p,i)=>({...p,bodyH:p.kind==='turret'?p.bodyH:houseBodyHeight(house),roofH:ridges[i]}));
     return{house,parts:full,dormers:urbanHouseDormers(house,full)}})}`
].join('\n'),sandbox);
for(const f of ['src/assets/house-models.js','src/settlement-mesh3d.js','src/settlement-house3d.js'])vm.runInContext(src(f),sandbox,{filename:f});
const K=window.ConquerHouseModels,H=window.ConquerHouse3D;

// 1. The kit: six L3 pieces, three L1 cottage pieces, two L4 turret roofs; indexed triangles, palette colours.
assert.deepEqual(Object.keys(K.models).sort(),['chimney','chimneySide','door','doorCottage','joist','roof','roofThatch','turretRoofRound','turretRoofSquare',
  'windowCottage','windowGround','windowUpper']);
for(const [name,model] of Object.entries(K.models))for(const [pn,p] of Object.entries(model.parts)){
  assert.equal(p.i.length,p.c.length*3,name+'.'+pn+': three indices per triangle');
  assert.ok(p.i.every(i=>i>=0&&i*3<p.p.length),name+'.'+pn+': indices in range');
  assert.ok(p.c.every(i=>i>=0&&i<K.palette.length),name+'.'+pn+': palette colours');
}
assert.equal(K.palette[K.paletteKeys.indexOf('stone')],'#625e59','kit stone = procedural stone (brick swatches apply)');
// Roofs: slate (L2/L3) and thatch (L1) on top, their dark underside below (a wrongly wound slope
// extruded the underside upwards and the roofs showed brown).
for(const [key,tops,under] of [['roof',['roofSlate','roofSlateDark'],'eaves'],['roofThatch',['roofThatch','roofThatchDark'],'thatchUnder']]){
  const part=Object.values(K.models[key].parts)[0],idx=k=>K.paletteKeys.indexOf(k);
  const meanZ=keys=>{const ids=keys.map(idx);let s=0,n=0;for(let t=0;t<part.c.length;t++)if(ids.includes(part.c[t]))for(let k=0;k<3;k++){s+=part.p[part.i[t*3+k]*3+2];n++}return s/n};
  assert.ok(meanZ(tops)>meanZ([under]),key+': '+tops.join('/')+' on top of the '+under+' underside');
}
assert.deepEqual([K.palette[K.paletteKeys.indexOf('roofSlate')],K.palette[K.paletteKeys.indexOf('roofSlateDark')]],['#303237','#3a3d42'],'slate = the procedural houses\' slate');
assert.deepEqual([K.palette[K.paletteKeys.indexOf('roofThatch')],K.palette[K.paletteKeys.indexOf('roofThatchDark')]],['#b39250','#c4a25d'],'thatch = HOUSE_THATCH');
console.log('PASS kit: '+Object.keys(K.models).length+' pieces');

// 2. L1 to L4 houses, built and finished.
for(const level of [1,2,3,4])assert.equal(H.handles({type:'house',houseLevel:level}),true,'L'+level+' uses the kit');
for(const s of [{type:'house',houseLevel:4,building:true},{type:'house',houseLevel:3,building:true},{type:'house',houseLevel:1,building:true},{type:'tower'}])
  assert.equal(H.handles(s),false,JSON.stringify(s)+' keeps the procedural drawing');
console.log('PASS scope: L1 to L4');

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
  assert.equal(m.stats.chimney,sandbox.chimneySpecs(s).length,label+': the chimneys of chimneySpecs');
  assert.ok(m.stats.joist>=4,label+': joists under the jetty');
  // Inside the plan (roof overhang, shutters, step and sill aside) and never below the ground.
  const all=bodies.flatMap(p=>p.points),minX=Math.min(...all.map(p=>p.x))-.2,maxX=Math.max(...all.map(p=>p.x))+.2,minY=Math.min(...all.map(p=>p.y))-.2,maxY=Math.max(...all.map(p=>p.y))+.2;
  const top=Math.max(...entry.parts.map(p=>p.roofH),...sandbox.chimneySpecs(s).map(c=>c.z1))+.05;
  for(let i=0;i<m.pos.length;i+=3){
    const x=m.pos[i],y=m.pos[i+1],z=m.pos[i+2];
    assert.ok(x>=minX&&x<=maxX&&y>=minY&&y<=maxY,label+': geometry stays on the plan');
    assert.ok(z>=-.25&&z<=top+1e-6,label+': between the eaves overhang and the chimney top (z '+z.toFixed(2)+')');
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
  assert.ok(windows>=2,label+': windows on several walls');
  // One stack, whatever the width (a 2 U cottage used to get two on the ridge), against a gable
  // end that keeps no window behind it.
  const specs=sandbox.chimneySpecs(s),c=specs[0];
  assert.equal(specs.length,1,label+': one chimney');
  assert.ok(c.side&&c.z0===0&&c.z1>1.45,label+': a gable-end stack from the ground past the ridge');
  assert.equal(m.stats.chimneySide,1,label+': the kit gable-end stack');
  assert.ok(!m.stats.chimney,label+': no ridge stack');
  const gable=bodies[0].points.map((a,i)=>({a,b:bodies[0].points[(i+1)%4]})).find(e=>Math.hypot(c.wall.x-(e.a.x+e.b.x)/2,c.wall.y-(e.a.y+e.b.y)/2)<.01);
  assert.ok(gable,label+': the stack stands on a wall midpoint');
  assert.equal(sandbox.houseFacadePlan(s,bodies[0],gable).windows.length,0,label+': no window behind the stack');
  assert.ok(Math.abs(c.normal.x*Math.sin(angle)-c.normal.y*Math.cos(angle))<1e-9,label+': on a gable end (along the ridge)');
  assert.equal(m.stats.members,4*4+2*windows,label+': corner posts, sill and wall plates on 4 walls, posts beside each window');
  assert.equal(m.stats.roofThatch,1,label+': one thatched roof');
  assert.equal(m.stats.doorCottage,1,label+': the plank door');
  for(const k of ['roof','door','windowUpper','windowGround','joist'])assert.ok(!m.stats[k],label+': no L3 '+k);
  const thatch=K.palette[K.paletteKeys.indexOf('roofThatch')];
  let ridge=0;for(let t=0;t<m.col.length;t++){if(m.tag[t]!=='roof')continue;for(let k=0;k<3;k++)ridge=Math.max(ridge,m.pos[t*9+k*3+2])}
  assert.ok(m.col.includes(thatch),label+': thatch colours');
  assert.ok(ridge<1.45+.05&&ridge>1.4,label+': thatch up to the ridge ('+ridge.toFixed(2)+')');
  const minZ=Math.min(...Array.from({length:m.pos.length/3},(_,i)=>m.pos[i*3+2]));
  assert.ok(minZ>=-.1,label+': nothing below the ground');
  assert.deepEqual([...new Set(m.tag)].sort(),['beam','body','gable','roof'],label+': construction tags');
  cottages++;
}
{const s={id:'cot-w',type:'house',houseLevel:1,auto:true,x:0,y:0,w:1.5,h:1,doorSide:1,angle:0};State.structures=[s];
 State.season='winter';H.clear();const winter=new Set(H.geometry(s).col);State.season='summer';H.clear();
 assert.ok(!winter.has(K.palette[K.paletteKeys.indexOf('roofThatch')])&&winter.has('#e7ece8'),'winter thatch is white');}
console.log('PASS '+cottages+' L1 cottages: framed daub walls, cottage windows on every wall, plank door, thatch');

// 3c. L4 houses: the townhouse bodies plus the corner turret (stone and timbered plaster walls,
// its frame and windows from houseTurretFacade, a kit conical or pyramidal roof) and the dormers
// (faces of urbanHouseDormers with a kit casement each).
// A corner plot: the house front on one street, a side street across it (houseCornerSide).
const corner=(s,angle,doorSide)=>{
  const t={x:Math.cos(angle),y:Math.sin(angle)},n={x:-t.y*doorSide,y:t.x*doorSide},at=(u,v)=>({x:s.x+t.x*u+n.x*v,y:s.y+t.y*u+n.y*v});
  sandbox.roadList=()=>[{a:at(-8,1.6),b:at(8,1.6)},{a:at(2.4,-8),b:at(2.4,8)}];
};
let l4=0,dormerTotal=0;const turretTypes=new Set();
for(const w of [1.5,2])for(const doorSide of [-1,1])for(const angle of [0,.6,Math.PI/2,2.5])for(const v of [0,1]){
  const s={id:'l4-'+w+doorSide+angle+'-'+v,type:'house',houseLevel:4,auto:true,x:50,y:40,w,h:1,doorSide,angle};
  corner(s,angle,doorSide);
  State.structures=[s];H.clear();
  const m=H.geometry(s),entry=sandbox.urbanHouseGeometry()[0],label='L4 '+s.id;
  const bodies=entry.parts.filter(p=>p.kind==='body'),turrets=entry.parts.filter(p=>p.kind==='turret');
  let windows=0,members=0;
  for(const part of bodies)part.points.forEach((a,i)=>{const p=sandbox.houseFacadePlan(s,part,{a,b:part.points[(i+1)%part.points.length]});windows+=p.windows.length;members+=p.beams.length});
  for(const t of turrets){const p=sandbox.houseTurretFacade(t);windows+=p.windows.length;members+=p.beams.length;turretTypes.add(t.type)}
  windows+=entry.dormers.length;
  assert.equal((m.stats.windowUpper||0)+(m.stats.windowGround||0),windows,label+': a window piece for every body, turret and dormer window');
  assert.equal(m.stats.members,members,label+': a timber member for every body and turret beam');
  assert.equal((m.stats.turretRoofRound||0)+(m.stats.turretRoofSquare||0),turrets.length,label+': one kit roof per turret');
  assert.equal(m.stats.roof,bodies.length,label+': one slate roof per body');
  assert.equal(m.stats.dormer||0,entry.dormers.length,label+': every dormer');
  // The ridge stacks (chimneySpecs) and the turret can take every slot of a short roof.
  dormerTotal+=entry.dormers.length;
  assert.equal(turrets.length,1,label+': a turret on the corner plot');
  // Turret roofs reach the turret ridge, never above it (finial aside).
  for(const t of turrets){
    let top=0;for(let i=0;i<m.pos.length;i+=3)if(Math.hypot(m.pos[i]-t.center.x,m.pos[i+1]-t.center.y)<.05)top=Math.max(top,m.pos[i+2]);
    assert.ok(top>=t.roofH-.02&&top<=t.roofH+.4,label+': turret roof up to its apex ('+top.toFixed(2)+' / '+t.roofH.toFixed(2)+')');
  }
  assert.deepEqual([...new Set(m.tag)].sort(),['beam','body','gable','roof'],label+': construction tags');
  l4++;
}
assert.ok(turretTypes.size===2,'round and square turrets both covered');
assert.ok(dormerTotal>=l4,'dormers on the L4 roofs ('+dormerTotal+' on '+l4+' houses)');
{const P=k=>K.palette[K.paletteKeys.indexOf(k)];
 const s={id:'l4-clay',type:'house',houseLevel:4,auto:true,x:0,y:0,w:1.5,h:1,doorSide:1,angle:0};corner(s,0,1);
 State.structures=[s];H.clear();const stone=new Set(H.geometry(s).col);
 s.masonryMaterial='brick';H.clear();const clay=new Set(H.geometry(s).col);delete s.masonryMaterial;
 assert.ok(stone.has(P('roofTurret'))&&!clay.has(P('roofTurret'))&&!clay.has(P('roofTurretDark')),'clay: turret slate turns to tile');
 State.season='winter';H.clear();const winter=new Set(H.geometry(s).col);State.season='summer';H.clear();
 assert.ok(!winter.has(P('roofTurret'))&&!winter.has(P('roofSlate')),'winter: turret and dormer roofs are white');
 sandbox.roadList=()=>[];}
console.log('PASS '+l4+' L4 houses: turrets (round and square) framed and roofed, dormers with casements; clay and winter');

// 4. Brick masonry recolours the kit stone like the procedural walls; winter whitens the roofs.
{const s={id:'kit-brick',type:'house',houseLevel:3,auto:true,x:0,y:0,w:1.5,h:1,doorSide:1,angle:0};State.structures=[s];
 H.clear();const stone=new Set(H.geometry(s).col);
 const P=k=>K.palette[K.paletteKeys.indexOf(k)];
 // Clay: brick masonry on the house, or the clay palette for everything.
 for(const [label,set,unset] of [['brick masonry',()=>{s.masonryMaterial='brick'},()=>{delete s.masonryMaterial}],
   ['clay palette',()=>{State.visualPalette='clay'},()=>{State.visualPalette='stone'}]]){
   set();H.clear();const clay=new Set(H.geometry(s).col);unset();
   assert.ok(stone.has('#625e59')&&!clay.has('#625e59')&&clay.has('#ae664d'),label+': the stone ground floor turns to brick');
   assert.ok(stone.has(P('roofSlate'))&&!clay.has(P('roofSlate'))&&clay.has('#a94e36'),label+': slate turns to tile');
   for(const k of ['stoneTrim','step','roofCourse','roofRidge'])
     assert.ok(stone.has(P(k))&&!clay.has(P(k)),label+': no grey '+k+' left on a clay house');
 }
 // Cottages keep their thatch in clay.
 const c={id:'kit-clay-cottage',type:'house',houseLevel:1,auto:true,x:0,y:0,w:1.5,h:1,doorSide:1,angle:0,masonryMaterial:'brick'};
 State.structures=[c];H.clear();assert.ok(H.geometry(c).col.includes(P('roofThatch')),'clay: the L1 thatch stays thatch');
 State.structures=[s];
 State.season='winter';H.clear();const winter=new Set(H.geometry(s).col);State.season='summer';H.clear();
 assert.ok(!winter.has(K.palette[K.paletteKeys.indexOf('roofSlate')])&&winter.has('#e7ece8'),'winter roofs are white');}
console.log('PASS clay (brick masonry and clay palette): brick, tiles, no grey stone or slate details; winter roofs');

// 5. Wiring: World 3D only; the 2.5D fallback keeps the procedural house.
const world=src('src/settlement-world3d.js'),html=src('index.html'),lab=src('figures-lab.html'),catalog=src('src/asset-catalog.js');
assert.match(world,/if\(!m\.tag&&!shopOpen&&window\.ConquerHouse3D\?\.addToBuilder\(m,house\)\)\{/,'addHouse hands kit houses to the kit, except a workshop open in section');
// The kit house keeps the workshop's street front (shop window and bracket sign, settlement-shop-cutaway.js).
const kitBranch=world.slice(world.indexOf('ConquerHouse3D?.addToBuilder(m,house)'),world.indexOf('return;',world.indexOf('ConquerHouse3D?.addToBuilder(m,house)')));
assert.match(kitBranch,/window\.ConquerShopCutaway\?\.addFront\(m,house\)/,'kit houses keep the workshop street front');
assert.match(world,/const kit=!!window\.ConquerHouse3D\?\.handles\(s\);/,'decals: kit houses keep only the night lights');
assert.match(world,/if\(!kit\)for\(const \[p0,p1\] of plan\.beams\)strip/,'no timber decals on kit houses');
assert.match(world,/if\(!kit\)for\(const b of plan\.beams\)beam\(/,'no turret timber decals on kit houses');
assert.match(world,/if\(!kit\)quad\(a,b,ground\+w\.z-w\.hh/,'no turret or dormer glass decals on kit houses');
assert.doesNotMatch(buildings,/ConquerHouse3D/,'2.5D fallback unchanged');
const assembly=src('src/settlement-construction-assembly.js');
assert.match(assembly,/castleSource\(s\)\|\|civicSource\(s\)\|\|kitHouseSource\(s\)\|\|houseSource\(s\)/,'construction sites build the kit house in World 3D');
assert.match(assembly,/W3\.addOutbuilding\(m,s,part,winter\)/,'kit sites keep the yard outbuildings, without a second set of chimneys');
assert.match(world,/addMesh,addHouse,addOutbuilding,/,'world3d exports addOutbuilding for the sites');
assert.ok(html.indexOf('assets/house-models.js')>0&&html.indexOf('assets/house-models.js')<html.indexOf('settlement-house3d.js'),'kit registry loaded before the assembler');
assert.ok(lab.includes('assets/house-models.js')&&catalog.includes("global:'ConquerHouseModels'"),'kit listed in the Asset Lab');
assert.ok(fs.existsSync(root+'tools/blender/build_houses.py'),'Blender builder in the repository');
console.log('PASS World 3D wiring, Asset Lab listing, 2.5D fallback untouched');
