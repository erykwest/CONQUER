'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const clips=[];
const drawing=new Proxy({beginPath(){this.poly=[]},rect(){},moveTo(x,y){this.poly=[{x,y}]},lineTo(x,y){this.poly.push({x,y})},clip(){clips.push(this.poly||[])},
createImageData(w,h){return{data:new Uint8ClampedArray(w*h*4)}},measureText(){return{width:8}}},
{get(t,k){return k in t?t[k]:(()=>{})}});
const element=()=>({style:{},dataset:{},classList:{add(){},remove(){},toggle(){}},appendChild(){},setAttribute(){},
getContext:()=>drawing,getBoundingClientRect:()=>({width:1200,height:800,left:0,top:0}),addEventListener(){},insertAdjacentElement(){},querySelectorAll:()=>[],textContent:''});
const elements=new Map();
const doc={head:element(),getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id)},
createElement:element,querySelector:element,querySelectorAll:()=>[],addEventListener(){}};
const storage=new Map();
const sandbox={document:doc,window:{},console,crypto,performance,devicePixelRatio:1,Image:class{addEventListener(){}},
localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
setTimeout:()=>0,clearTimeout(){},requestAnimationFrame:()=>0,cancelAnimationFrame(){},
navigator:{},fetch:()=>new Promise(()=>{}),atob:s=>Buffer.from(s,'base64').toString('binary'),btoa:s=>Buffer.from(s,'binary').toString('base64')};
const context=vm.createContext(sandbox);
function run(s){return vm.runInContext(s,context)}
function moduleFile(n){const groups={castle:['castle','landscape','castle-placement','castle-structures','buildings'],population:['population','population-fields','population-navigation','population-routines','population-residents','population-figures','population-garrisons'],app:['app','app-rooms','app-input','app-persistence','app-calendar-ui','app-simulation','app-bootstrap']};const files=groups[n]||[n];return files.map(part=>fs.readFileSync(__dirname+'/../src/settlement-'+part+'.js','utf8')).join('\n')}
for(const n of ['core','civic-annexes','world','castle','urban','fields','boundaries','siege','population'])run(moduleFile(n));
run('function draw(){}; function setTool(){}; function scheduleLocalSave(){}; function renderFunctionPanel(){}');
const appSource=moduleFile('app');
run(appSource.split('function pointerScreen')[0]);
// Load the ACTUAL shared calendar implementation into the VM. The full app
// bootstrap cannot be evaluated in headless regression mode, but crop
// simulation must not rely on a hardcoded calendar shim.
const calendarStart=appSource.indexOf('const CALENDAR_MONTHS=');
const calendarEnd=appSource.indexOf('function syncSeasonToCalendar()',calendarStart);
if(calendarStart<0||calendarEnd<calendarStart)throw Error('Game calendar implementation not found');
run(appSource.slice(calendarStart,calendarEnd));
run(moduleFile('combat-rules'));
run(moduleFile('combat').replace('window.ConquerCombat={','window.ConquerCombat={__qa:{safeMilitarySegment,infantryRoute,lineVisible},'));
run('State.seed=12345; State.environment=[];State.relief=null;');
let passed=0;
function test(name,body){body();passed++;console.log('PASS '+name)}
test('four entries migrate from build boundary to outer world boundary',()=>{
 run("State.village.borderEntries=BORDER_ENTRY_SIDES.map((edge,i)=>({id:'old-'+i,edge,t:.5,x:100,y:50}));ensureBorderEntrySelection()");
 assert.equal(run('validBorderEntrySelection(State.village.borderEntries)'),true);
 assert.equal(run('State.village.borderEntries.every(e=>e.x===0||e.x===WORLD||e.y===0||e.y===WORLD)'),true);
});
test('road repairs can reach outer world and reject points beyond it',()=>{
 assert.equal(run('roadRepairPointClear({x:25,y:100})'),true);
 assert.equal(run('roadRepairPointClear({x:0,y:100})'),true);
 assert.equal(run('roadRepairPointClear({x:-.1,y:100})'),false);
});
test('four complete main routes terminate at outer entries',()=>{
 run("State.structures=[{id:'well',type:'well',x:100,y:100}];State.village.wellId='well';State.village.founded=true;connectSelectedBorderMainRoads()");
 assert.equal(run('ensureRoadPlan().every(r=>arterialRouteContinuous(r.id))'),true);
});
test('deleting a generated main road is persistent across road reconciliation/reload',()=>{
 run("globalThis.removedRoad=routeRoads('arterial-0')[2];deleteStructure(removedRoad.id);connectSelectedBorderMainRoads();reconcileArterialRoutes()");
 assert.equal(run('State.structures.some(s=>s.id===removedRoad.id)'),false);
 assert.equal(run("mainRoadRouteDeleted('arterial-0')"),true);
 assert.equal(run("State.village.deletedMainRoutes.includes('arterial-0')"),true);
 assert.equal(run("routeRoads('arterial-0').some(r=>dist(r.a,removedRoad.a)<.01&&dist(r.b,removedRoad.b)<.01)"),false);
});
function fixture(){
 run("State.structures=[{id:'well',type:'well',x:100,y:100},{id:'trunk',type:'road',routeId:'manual-main:trunk',a:{x:100,y:100},b:{x:125,y:100},width:.62},{id:'home',type:'house',auto:true,x:106,y:102,w:1.5,h:1,angle:0,doorSide:-1}];State.village.roadPlan=[];invalidateNavigation()");
}
test('refresh restores secondary roads instantly; newly created access roads retain construction',()=>{
 fixture();run('rebuildSecondaryRoadsOnLoad();reconcileReactiveRoadNetwork()');
 assert.ok(run("State.structures.some(s=>s.type==='road'&&s.accessFor==='home')"));
 assert.equal(run("State.structures.filter(s=>s.type==='road'&&!s.routeId).some(underConstruction)"),false);
 run("State.structures=State.structures.filter(s=>!s.accessFor);ensureSettlementRoadAccess(State.structures.find(s=>s.id==='home'))");
 assert.equal(run("State.structures.filter(s=>s.accessFor==='home').every(underConstruction)"),true);
});
test('actual rendered house bodies, L/T extensions and turrets block paths at all levels and rotations',()=>{
 for(let level=1;level<=4;level++)for(let turn=0;turn<4;turn++){
  fixture();run('State.structures[2].houseLevel='+level+';State.structures[2].angle='+turn*Math.PI/2+';invalidateNavigation()');
  // Dense L3/L4 houses replace the detached footprint with streetfront
  // volumes. The collision mask must agree with what the player actually sees.
  assert.equal(run("urbanHouseDisplayParts(State.structures[2]).every(part=>pointBlockedForPeasant(part.center,'unit'))"),true);
  assert.equal(run("urbanHouseDisplayParts(State.structures[2]).every(part=>!peasantSegmentClear({x:part.center.x-.5,y:part.center.y},{x:part.center.x+.5,y:part.center.y},'unit'))"),true);
  if(level<=2){
    assert.equal(run("peasantSegmentClear({x:104,y:102},{x:108,y:102},'unit')"),false);
    assert.equal(run("peasantSegmentClear({x:106,y:102},{x:106.01,y:102},'unit')"),false);
  }
 }
});
test('full squad footprint detects a house that the squad center misses',()=>{
 fixture();run("State.structures=[{id:'h',type:'house',x:100,y:100,w:1.5,h:1,angle:0}];invalidateNavigation()");
 assert.equal(run("peasantSegmentClear({x:98,y:100.9},{x:102,y:100.9},'squad')"),true);
 assert.equal(run("window.ConquerCombat.__qa.safeMilitarySegment({x:98,y:100.9},{x:102,y:100.9},'squad','squad')"),false);
});
test('LOS blocks short rays through houses and permits raised observers above roofs',()=>{
 run("State.structures=[{id:'h',type:'house',x:100,y:100,w:1.5,h:1,angle:0}];invalidateNavigation()");
 assert.equal(run('urbanHouseLineVisible({x:99,y:100,h:0},{x:101,y:100})'),false);
 assert.equal(run('urbanHouseLineVisible({x:99,y:102,h:0},{x:101,y:102})'),true);
 assert.equal(run('urbanHouseLineVisible({x:99,y:100,h:5},{x:101,y:100,visualZ:5})'),true);
 assert.equal(run('window.ConquerCombat.__qa.lineVisible({x:99,y:100,h:0},{x:101,y:100},-1,-1)'),false);
});
run(`globalThis.qaConvexLot=l=>{const p=l.points,n=p.length;if(n<3)return false;const s=Math.sign(urbanArea(p));
 return p.every((a,i)=>{const b=p[(i+1)%n],c=p[(i+2)%n];return s*((b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x))>-1e-9})}`);
test('one occupied convex Voronoi lot per house, no overlap and house footprints inside',()=>{
 run("State.structures=[{id:'well',type:'well',x:80,y:80}];State.village={founded:true,wellId:'well'};State.combat.strokes=[{x:100,y:100,r:50,mode:'yellow'}];for(let y=0;y<3;y++)for(let x=0;x<3;x++)State.structures.push({id:'h'+x+'-'+y,type:'house',auto:true,x:95+x*4,y:95+y*4,w:1.5,h:1,angle:0});invalidateNavigation()");
 assert.equal(run('urbanLots().length'),9);
 assert.equal(run('urbanLots().every(qaConvexLot)'),true);
 assert.equal(run('urbanLots().every((a,i)=>urbanLots().every((b,j)=>i===j||urbanPolygonIntersectionArea(a.points,b.points)<1e-6))'),true);
 assert.equal(run("urbanLots().every(l=>houseFootprintParts(State.structures.find(h=>h.id===l.houseId)).every(part=>part.points.every(p=>urbanContains(l.points,p,.159))))"),true);
 assert.equal(run("urbanLots().every(l=>State.structures.filter(h=>urbanContains(l.points,h)).length===1)"),true);
 assert.equal(run("urbanHouseFitsLots({id:'duplicate',type:'house',x:95,y:95,w:1.5,h:1})"),false);
});
test('manual L2 to L3 upgrade ignores occupants but never bypasses lot geometry',()=>{
 run("State.environment=[];State.structures=[{id:'well',type:'well',x:80,y:80},{id:'upgradable',type:'house',auto:true,x:100,y:100,w:1.5,h:1,angle:0,houseLevel:2}];State.combat.strokes=[{x:100,y:100,r:40,mode:'yellow'}];invalidateNavigation();invalidateUrbanGeometry()");
 assert.equal(run("urbanHouseFitsLots({...State.structures[1],houseLevel:3},{ignoreDynamicUnits:true})"),true);
 // A resident physically inside the plot is valid for an existing household,
 // but remains disqualifying for a new construction site.
 run("globalThis.originalLotCollision=urbanLotUnitConflict;urbanLotUnitConflict=()=>true");
 try{
   assert.equal(run("urbanHouseFitsLots({...State.structures[1],houseLevel:3})"),false);
   assert.equal(run("urbanHouseFitsLots({...State.structures[1],houseLevel:3},{ignoreDynamicUnits:true})"),true);
 }finally{run("urbanLotUnitConflict=originalLotCollision")}
 assert.equal(run("urbanHouseFitsLots({...State.structures[1],houseLevel:3,x:150},{ignoreDynamicUnits:true})"),false);
});
test('shared parcel fences are merged once, including partial collinear overlaps',()=>{
 run("State.structures=[{id:'a',type:'house',x:98,y:100,w:1.5,h:1},{id:'b',type:'house',x:102,y:100,w:1.5,h:1}];invalidateNavigation();globalThis.fenceFixture=[{houseId:'a',points:[{x:96,y:98},{x:100,y:98},{x:100,y:102},{x:96,y:102}]},{houseId:'b',points:[{x:100,y:98},{x:104,y:98},{x:104,y:102},{x:100,y:102}]}]");
 assert.equal(run('urbanFenceSegments(fenceFixture).filter(e=>Math.abs(e.a.x-100)<.0001&&Math.abs(e.b.x-100)<.0001).length'),1);
});
test('Voronoi fence lines obstruct pedestrians and soldiers but leave their gate traversable',()=>{
 run("State.structures=[{id:'home',type:'house',x:100,y:100,w:1.5,h:1,angle:0}];State.village={founded:true,wellId:null};State.combat.strokes=[];invalidateNavigation();globalThis.savedUrbanLots=urbanLots;urbanLots=()=>[{houseId:'home',points:[{x:98,y:98},{x:102,y:98},{x:102,y:102},{x:98,y:102}]}]");
 try{
   const segments=run('urbanFenceSegments()');
   assert.ok(segments.length>=4,'parcel must have enclosure segments');
   assert.equal(run('urbanFencePointBlocked({x:102,y:101},PEASANT_CLEARANCE)'),true);
   assert.equal(run("peasantSegmentClear({x:101.5,y:101},{x:103,y:101},'civilian')"),false);
   assert.equal(run("window.ConquerCombat.__qa.safeMilitarySegment({x:101.5,y:101},{x:103,y:101},'squad','squad')"),false);
   const opening=run('(()=>{let pts=[];for(let y=97.6;y<=102.4;y+=.04)if(!urbanFencePointBlocked({x:100,y},PEASANT_CLEARANCE))pts.push(y);return pts})()');
   assert.ok(opening.length>0,'entrance remains walkable');
   const route=run("findPeasantPath({x:101.5,y:101},{x:103,y:101},'civilian',8)");
   assert.ok(route?.length>2,'path must detour through the entrance');
   assert.equal(run("peasantSegmentClear({x:100,y:97},{x:100,y:99},'civilian')"),true,'entrance crosses fence without colliding');
 }finally{run('urbanLots=savedUrbanLots;invalidateNavigation()')}
});
test('neighbouring Voronoi lots share their common border instead of leaving a gap',()=>{
 run("State.structures=[{id:'well',type:'well',x:80,y:80}];State.village={founded:true,wellId:'well'};State.combat.strokes=[{x:100,y:100,r:50,mode:'yellow'}];State.structures.push({id:'a',type:'house',auto:true,x:98,y:100,w:1.5,h:1,angle:0},{id:'b',type:'house',auto:true,x:102.4,y:100.7,w:1.5,h:1,angle:.3});invalidateNavigation();invalidateUrbanGeometry()");
 // Every point on the bisector between the two homes, inside both reach boxes, belongs to both lots' boundary.
 assert.equal(run("(()=>{const A=urbanLots().find(l=>l.houseId==='a').points,B=urbanLots().find(l=>l.houseId==='b').points;const onEdge=(P,p)=>P.some((q,i)=>pointSegmentDistance(p,q,P[(i+1)%P.length])<1e-6);const shared=[...A.filter(p=>onEdge(B,p)),...B.filter(p=>onEdge(A,p))];return shared.length>=2&&Math.max(...shared.map(p=>dist(p,shared[0])))>3})()"),true);
});
test('the well plaza is a no-build zone for lots and houses',()=>{
 run("State.structures=[{id:'well',type:'well',x:100,y:100},{id:'near',type:'house',auto:true,x:103,y:100,w:1.5,h:1,angle:0}];State.village={founded:true,wellId:'well'};State.combat.strokes=[{x:100,y:100,r:50,mode:'yellow'}];invalidateNavigation();invalidateUrbanGeometry()");
 assert.equal(run("urbanLots().length"),1);
 assert.ok(run("urbanPolygonIntersectionArea(urbanLots()[0].points,wellPlazaPoints(State.structures[0]))")<1e-6);
 assert.equal(run("urbanHouseFitsLots({id:'in-plaza',type:'house',auto:true,x:100.4,y:101,w:1.5,h:1,angle:0},{ignoreDynamicUnits:true})"),false);
});
test('corner trees: one roll per shared corner, never two trees on one site',()=>{
 run("State.structures=[{id:'well',type:'well',x:80,y:80}];State.village={founded:true,wellId:'well'};State.combat.strokes=[{x:100,y:100,r:50,mode:'yellow'}];for(let y=0;y<3;y++)for(let x=0;x<3;x++)State.structures.push({id:'t'+x+'-'+y,type:'house',auto:true,x:95+x*4,y:95+y*4,w:1.5,h:1,angle:0});invalidateNavigation();invalidateUrbanGeometry()");
 run("globalThis.qaChance=URBAN_CORNER_TREE_CHANCE;URBAN_CORNER_TREE_CHANCE=1;invalidateUrbanGeometry()");
 try{
  const all=run("urbanLotCornerTrees().map(t=>t.p)");
  // Interior corners are shared by up to four lots: still a single tree each.
  assert.ok(all.length>=4);
  assert.ok(all.every(p=>all.filter(q=>Math.hypot(p.x-q.x,p.y-q.y)<.8).length===1));
  run("URBAN_CORNER_TREE_CHANCE=qaChance;invalidateUrbanGeometry()");
  const some=run("urbanLotCornerTrees().map(t=>t.p.x.toFixed(3)+','+t.p.y.toFixed(3))");
  assert.ok(some.length<all.length,'30% chance keeps only part of the corners');
  run("invalidateUrbanGeometry()");
  assert.deepEqual(run("urbanLotCornerTrees().map(t=>t.p.x.toFixed(3)+','+t.p.y.toFixed(3))"),some,'deterministic');
 }finally{run("URBAN_CORNER_TREE_CHANCE=qaChance")}
});
test('facades: two windows per floor on long sides of L2+, timber frame on upper floors and gables',()=>{
 const plans=level=>run("(()=>{State.structures=[{id:'fp',type:'house',x:100,y:100,w:1.8,h:1.1,angle:0,houseLevel:"+level+"}];invalidateUrbanGeometry();const e=urbanHouseGeometry()[0],p=e.parts[0];return p.points.map((a,i)=>{const edge={a,b:p.points[(i+1)%p.points.length]},pl=houseFacadePlan(e.house,{...p,turret:null},edge);return{L:dist(edge.a,edge.b),wall:p.bodyH,ridge:p.roofH,...pl}})})()");
 for(const w of plans(1)){assert.equal(w.windows.length,1);assert.equal(w.beams.length,0)}
 for(const level of [2,3,4]){
  const walls=plans(level),long=walls.filter(w=>w.L>1.5),short=walls.filter(w=>w.L<1.5);
  assert.ok(long.length>=1&&short.length>=1);
  // The door wall loses the ground-floor window next to the door (houseFacadeDoorCut).
  for(const w of long)assert.ok(w.windows.length===4||w.windows.length===3&&w.windows.filter(x=>x.z>w.wall*.42).length===2,'L'+level+' long side: 2 windows x 2 floors');
  assert.ok(long.some(w=>w.windows.length===4),'L'+level+' wall without door keeps all four');
  for(const w of short)assert.equal(w.windows.length,2,'L'+level+' short side: 1 window x 2 floors');
  for(const w of walls){
   assert.ok(w.beams.length>=6,'L'+level+' timber frame');
   // Frame stays on the upper floor (or the gable above it) and within the wall width.
   assert.ok(w.beams.every(b=>b.every(p=>p.z>=w.wall*.42-1e-6&&p.z<=w.ridge+1e-6&&Math.abs(p.off)<=w.L/2+1e-6)));
  }
  assert.ok(short.some(w=>w.beams.some(b=>b.some(p=>p.z>w.wall+.1))),'gable end carries king post / collar');
  assert.ok(long.every(w=>w.beams.every(b=>b.every(p=>p.z<=w.wall+1e-6))),'eave sides have no gable timber');
 }
});
test('nearly coincident parcel edges become one fence, not two parallel ones',()=>{
 run("State.structures=[{id:'a',type:'house',x:98,y:100,w:1.5,h:1},{id:'b',type:'house',x:102,y:100,w:1.5,h:1}];invalidateNavigation();globalThis.fenceFixture=[{houseId:'a',points:[{x:96,y:98},{x:100,y:98},{x:100,y:102},{x:96,y:102}]},{houseId:'b',points:[{x:100.1,y:98.05},{x:104,y:98},{x:104,y:102},{x:100.12,y:101.95}]}]");
 assert.equal(run('urbanFenceSegments(fenceFixture).filter(e=>Math.abs((e.a.x+e.b.x)/2-100.05)<.15&&Math.abs(e.a.x-e.b.x)<.2).length'),1);
});
test('road network trips detour around physical well and never cross another house',()=>{
 fixture();run('delete State.structures[2].construction;reconcileSettlementAccessRoads(Infinity,true);invalidateNavigation()');
 assert.equal(run("wellApproachPath(State.structures[2],State.structures[0]).length>1"),true);
 assert.equal(run("wellApproachPath(State.structures[2],State.structures[0]).slice(1).every((p,i)=>peasantSegmentClear(wellApproachPath(State.structures[2],State.structures[0])[i],p,'home'))"),true);
});
test('occlusion masks follow all four camera rotations and do not mask a foreground figure',()=>{
 run("State.structures=[{id:'h',type:'house',x:100,y:100,w:1.5,h:1,angle:0}];State.view={x:600,y:-1000,scale:2,rotation:0};invalidateNavigation()");
 for(let rotation=0;rotation<4;rotation++){
  run('State.view.rotation='+rotation);
  clips.length=0;run("withUrbanFigureOcclusion(unrotateViewPoint({x:99,y:99}),.08,()=>{})");
  assert.ok(clips.length>0);
  clips.length=0;run("withUrbanFigureOcclusion(unrotateViewPoint({x:102,y:102}),.08,()=>{})");
  assert.equal(clips.length,0);
 }
});
test('growth across five seeds keeps one valid convex lot for every house',()=>{
 for(let seed=1;seed<=5;seed++){
  run("State.seed="+seed+";State.structures=[{id:'well',type:'well',x:100,y:100}];State.village={founded:true,wellId:'well',growthStep:0};invalidateNavigation();connectSelectedBorderMainRoads()");
  for(let step=0;step<55;step++)run('State.village.growthStep='+step+';spawnHouse('+step+');invalidateUrbanGeometry()');
  const houses=run("State.structures.filter(s=>s.type==='house').length");
  assert.ok(houses>=6,'Growth seed '+seed+' generated '+houses+' houses');
  assert.equal(run('urbanLots().length'),houses);
  assert.equal(run('urbanLots().every(qaConvexLot)'),true);
 }
});
test('a household cannot path through its own home; extended entrances stay outside',()=>{
 for(let level=1;level<=4;level++)for(const side of [-1,1]){
  run("State.structures=[{id:'home',type:'house',x:100,y:100,w:1.5,h:1,angle:.5,houseLevel:"+level+",doorSide:"+side+"}];invalidateNavigation()");
  assert.equal(run("peasantSegmentClear({x:98,y:100},{x:102,y:100},'home')"),false,'Own house L'+level+' side '+side);
  assert.equal(run("pointBlockedForPeasant(houseDoorInfo(State.structures[0]).outside,'home')"),false,'Entrance L'+level+' side '+side+' '+JSON.stringify(run('houseDoorInfo(State.structures[0])')));
 }
});
function zoningFixture(){
 run("State.environment=[];State.structures=[{id:'well',type:'well',x:100,y:100}];State.village={founded:true,wellId:'well'};State.combat.strokes=[];invalidateNavigation()");
}
test('whole parcels stay inside yellow, even when the house center is inside but corners are outside',()=>{
 zoningFixture();
 assert.equal(run("urbanYellowContains([{x:111,y:101},{x:116,y:101},{x:116,y:103},{x:111,y:103}])"),false);
 assert.equal(run("urbanYellowContains([{x:104,y:102},{x:108,y:102},{x:108,y:105},{x:104,y:105}])"),true);
 assert.equal(run("urbanHouseFitsLots({id:'outside',type:'house',x:116,y:102,w:1.5,h:1,angle:0})"),false);
});
test('an erased yellow island and a narrow erased edge invalidate the parcel',()=>{
 zoningFixture();
 run("State.combat.strokes=[{x:106,y:104,r:1,mode:'eraseYellow'}];invalidateUrbanGeometry()");
 assert.equal(run("urbanYellowContains([{x:104,y:102},{x:108,y:102},{x:108,y:106},{x:104,y:106}])"),false);
 run("State.combat.strokes=[{x:106,y:101.01,r:1,mode:'eraseYellow'}];invalidateUrbanGeometry()");
 assert.equal(run("urbanYellowContains([{x:104,y:102},{x:108,y:102},{x:108,y:106},{x:104,y:106}])"),false);
});
test('disconnected yellow disks cannot allow a parcel across an uncovered gap',()=>{
 zoningFixture();
 run("State.combat.strokes=[{x:124,y:100,r:1.5,mode:'yellow'},{x:130,y:100,r:1.5,mode:'yellow'}];invalidateUrbanGeometry()");
 assert.equal(run("urbanYellowContains([{x:123.5,y:99.5},{x:130.5,y:99.5},{x:130.5,y:100.5},{x:123.5,y:100.5}])"),false);
});
test('forests inside a lot and forest edges crossing a lot are rejected',()=>{
 zoningFixture();
 run("State.environment=[{type:'forest',points:[{x:105.1,y:103.1},{x:105.4,y:103.1},{x:105.4,y:103.4},{x:105.1,y:103.4}]}]");
 assert.equal(run("urbanParcelAllowed([{x:104,y:102},{x:108,y:102},{x:108,y:106},{x:104,y:106}],'candidate')"),false);
 run("State.environment=[{type:'forest',points:[{x:102,y:103.2},{x:110,y:103.2},{x:110,y:103.4},{x:102,y:103.4}]}]");
 assert.equal(run("urbanParcelAllowed([{x:104,y:102},{x:108,y:102},{x:108,y:106},{x:104,y:106}],'candidate')"),false);
});
test('completed and unfinished building footprints prevent parcel creation',()=>{
 zoningFixture();
 run("State.structures.push({id:'tower',type:'tower',shape:'square',size:1,x:106,y:104,angle:.7,construction:{start:0,end:10}})");
 assert.equal(run("urbanParcelAllowed([{x:104,y:102},{x:108,y:102},{x:108,y:106},{x:104,y:106}],'candidate')"),false);
 run("delete State.structures[1].construction");
 assert.equal(run("urbanParcelAllowed([{x:104,y:102},{x:108,y:102},{x:108,y:106},{x:104,y:106}],'candidate')"),false);
});
test('building over the yard removes the whole lot, house and private spur without rebuilding it',()=>{
 zoningFixture();
 run("State.structures.push({id:'home',type:'house',auto:true,x:106,y:104,w:1.5,h:1,angle:0,doorSide:-1},{id:'spur',type:'road',auto:true,accessFor:'home',a:{x:106,y:103.2},b:{x:106,y:101},width:.3});invalidateNavigation();globalThis.oldLot=urbanLots().find(l=>l.houseId==='home');globalThis.corner=oldLot.points.reduce((a,p)=>dist(p,State.structures[1])>dist(a,State.structures[1])?p:a);globalThis.newBuilding={id:'new-tower',type:'tower',shape:'square',size:1,x:corner.x,y:corner.y,angle:0};globalThis.displaced=removeOverlappingAuto(newBuilding);State.structures.push(newBuilding);invalidateNavigation()");
 assert.ok(run("oldLot&&dist(corner,{x:106,y:104})>2.5"));
 assert.equal(run("State.structures.some(s=>s.id==='home'||s.id==='spur')"),false);
 assert.equal(run("urbanLots().some(l=>l.houseId==='home')"),false);
 assert.equal(run("displaced.roads.some(r=>r.id==='spur')"),false);
 assert.equal(run("State.structures.some(s=>s.id==='new-tower')"),true);
 assert.equal(run("urbanFenceSegments().length"),0);
});
test('a failed paid building placement does not clear a lot',()=>{
 zoningFixture();
 run("State.structures.push({id:'home',type:'house',auto:true,x:106,y:104,w:1.5,h:1,angle:0});invalidateNavigation();State.resources={gold:0,stone:0,wood:0,metal:0};globalThis.result=addStructure({id:'expensive',type:'tower',shape:'square',size:1,x:108,y:106,angle:0})");
 assert.equal(run('result'),false);
 assert.equal(run("State.structures.some(s=>s.id==='home')"),true);
 assert.equal(run("urbanLots().length"),1);
});
test('minimum parcel holds a real 2x2 square, including rotated lots, and rejects thin large-area slivers',()=>{
 assert.equal(run('urbanLotHasMinimumSize([{x:0,y:0},{x:2,y:0},{x:2,y:2},{x:0,y:2}])'),true);
 assert.equal(run('urbanLotHasMinimumSize([{x:0,y:0},{x:10,y:0},{x:10,y:1.9},{x:0,y:1.9}])'),false);
 assert.equal(run('urbanLotHasMinimumSize(rectWorldPoints(100,100,2,2,.73))'),true);
});
test('friendly and hostile units block a new parcel, even in its yard; existing parcels remain visible',()=>{
 zoningFixture();
 run("globalThis.candidate={id:'new-home',type:'house',auto:true,x:106,y:104,w:1.5,h:1,angle:0};globalThis.lot=urbanLotFor(candidate,[candidate]);State.combat.units=[{id:'knight',kind:'knight',x:lot.points[0].x,y:lot.points[0].y}];State.combat.enemy=[]");
 assert.equal(run('urbanHouseFitsLots(candidate)'),false);
 run("State.combat.units=[];State.combat.enemy=[{id:'enemy',x:106,y:104}]");
 assert.equal(run('urbanHouseFitsLots(candidate)'),false);
 run("State.structures.push(candidate);invalidateNavigation()");
 assert.equal(run('urbanLots().length'),1);
 run("State.structures=State.structures.filter(s=>s.id!=='new-home');State.combat.enemy=[];State.combat.units=[];invalidateNavigation()");
 assert.equal(run('urbanHouseFitsLots(candidate)'),true);
});
test('squad members and clearance radii are included in occupied parcel checks',()=>{
 zoningFixture();
 run("State.combat.units=[{id:'squad',kind:'squad',x:103.6,y:104}];State.combat.enemy=[];globalThis.lot={points:[{x:104,y:102},{x:108,y:102},{x:108,y:106},{x:104,y:106}]}");
 assert.equal(run('urbanLotUnitConflict(lot)'),true);
 assert.equal(run("urbanLotUnitConflict(lot,[{x:103.9,y:104,r:.22}])"),true);
 assert.equal(run("urbanLotUnitConflict(lot,[{x:102,y:104,r:.22}])"),false);
});
test('active civilians block spawning without changing their routines or movement state',()=>{
 zoningFixture();
 run("State.combat.units=[];State.combat.enemy=[];State.structures.push({id:'resident-home',type:'house',auto:true,x:104,y:104,w:1.5,h:1,angle:0});State.clock.day=10.35;invalidateNavigation();globalThis.positions=urbanSpawnOccupants()");
 assert.ok(run('positions.length>0'));
 assert.equal(run("urbanLotUnitConflict({points:[{x:90,y:90},{x:113,y:90},{x:113,y:113},{x:90,y:113}]})"),true);
});
test('church and tavern have Voronoi curtilage; market and public piazza do not',()=>{
  zoningFixture();
  run("State.structures.push({id:'civic-church',type:'church',x:116,y:117,angle:0},{id:'civic-tavern',type:'tavern',x:132,y:117,angle:0},{id:'civic-market',type:'market',x:140,y:132,angle:0},{id:'civic-plaza',type:'plaza',x:145,y:132,angle:0});invalidateNavigation()");
  const lots=run('urbanLots().filter(l=>l.civicId)');
  assert.deepEqual(Array.from(lots,l=>l.civicId).sort(),['civic-church','civic-tavern']);
  assert.equal(run('urbanLots().every(qaConvexLot)'),true);
  assert.equal(run("urbanLots().filter(l=>l.civicId).every(l=>urbanSiteFootprint(State.structures.find(s=>s.id===l.civicId)).every(p=>urbanContains(l.points,p,.15)))"),true);
  assert.equal(run("urbanLots().some(l=>['civic-market','civic-plaza'].includes(l.civicId))"),false);
  assert.ok(run('urbanFenceSegments().length')>=8,'civic parcels have physical boundaries');
});
test('church L1 includes cemetery plots inside its real Voronoi lot',()=>{
  zoningFixture();
  run("State.structures.push({id:'chapel',type:'church',x:117,y:117,angle:0,civicLevel:1});invalidateNavigation()");
  const result=run("civicCemeteryArea(State.structures.find(s=>s.id==='chapel'))");
  assert.ok(result,'A church with a free lot must have a burial area');
  assert.equal(run("civicCemeteryGraves(State.structures[1]).length"),6);
  assert.equal(run("civicCemeteryArea(State.structures[1]).points.every(p=>urbanContains(urbanLots().find(l=>l.civicId==='chapel').points,p,.09))"),true);
  assert.equal(run("civicCemeteryArea(State.structures[1]).points.every(p=>!civicParts(State.structures[1]).some(part=>urbanContains(part.points,p)))"),true);
});
test('civil development defaults, level clamping and three piazza variants normalize',()=>{
  const result=run("[{id:'c',type:'church',x:110,y:110,civicLevel:12},{id:'t',type:'tavern',x:120,y:110},{id:'p',type:'plaza',x:130,y:110,civicLevel:2,plazaVariant:'garden'},{id:'bad',type:'plaza',x:140,y:110,plazaVariant:'invalid'}].map(normalizeCivicDevelopment)");
  assert.deepEqual(Array.from(result,s=>s.civicLevel),[3,1,2,1]);
  assert.equal(result[2].plazaVariant,'garden');
  assert.equal(result[3].plazaVariant,'paved');
  assert.equal(run('PLAZA_VARIANTS.length'),3);
  assert.equal(run("civicParts({type:'plaza',x:130,y:120}).length"),1);
  assert.equal(run("CIVIC_TYPES.includes('market')&&CIVIC_TYPES.includes('plaza')"),true);
});
console.log(passed+' urban regression checks passed.');

