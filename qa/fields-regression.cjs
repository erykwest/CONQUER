'use strict';
// Reuse the VM/DOM harness; execute the real geometry, simulation and drawing functions.
const fs=require('node:fs');
const harness=fs.readFileSync(__dirname+'/urban-regression.cjs','utf8').split('let passed=0;')[0];
// Run as a CommonJS function so the harness's relative module paths stay correct.
const check=new Function('require','__dirname',harness+`
let passed=0;
function test(name,body){body();passed++;console.log('PASS '+name)}
function fixture(){run("State.clock.day=0;State.environment=[];State.relief=null;State.structures=[{id:'well',type:'well',x:100,y:100}];State.village={founded:true,wellId:'well'};State.combat.strokes=[];invalidateNavigation();fieldWorkAssignmentCache.key=null;")}
function farm(){fixture();run("var qaField={id:'f',type:'field',auto:true,x:105,y:104,points:[{x:103,y:103},{x:107,y:103},{x:107,y:105},{x:103,y:105}]};State.structures.push(qaField);fieldCrop(qaField);")}
test('seeded Voronoi cells have four corners, bounded sides and irregular geometry',()=>{
 fixture();
 run("let qaValid=0,qaIrregular=0;for(let i=0;i<300;i++){const f={id:'q'+i,x:106,y:106,angle:i*.03};const p=fieldVoronoiQuad(f,seedRand(i+1));if(p){if(!fieldQuadValid(p)||!urbanContains(p,f))throw Error('invalid cell');qaValid++;const lengths=p.map((a,j)=>dist(a,p[(j+1)%4]));if(Math.max(...lengths)-Math.min(...lengths)>.1)qaIrregular++}};");
 assert.ok(run('qaValid')>290);assert.ok(run('qaIrregular')>290);
});
test('slots use floor(area / 4), and serpentine rows follow the longest side every .5 U',()=>{
 farm();assert.equal(run('fieldGrid(qaField).cells.length'),2);
 assert.equal(run('fieldLayout(qaField).rows.length'),4);
 assert.equal(run('fieldLayout(qaField)===fieldLayout(qaField)'),true);
 run("const qaLayout=fieldLayout(qaField);for(let i=0;i<qaLayout.rows.length;i++){const r=qaLayout.rows[i];if(Math.abs(r.b.y-r.a.y)>1e-8)throw Error('alignment');if(r.forward!==(i%2===0))throw Error('direction');if(i&&Math.abs(r.v-qaLayout.rows[i-1].v-.5)>1e-8)throw Error('spacing')}for(let d=0;d<=qaLayout.total;d+=.03)if(!urbanContains(qaField.points,qaLayout.at(d)))throw Error('route outside field');");
});
test('serpentine rows remain at least 0.28 U inside field-edge fences',()=>{
 farm();
 run("globalThis.qaInnerMargins=fieldLayout(qaField).rows.map(row=>({left:Math.min(row.a.x,row.b.x)-103,right:107-Math.max(row.a.x,row.b.x)}))");
 assert.equal(run("qaInnerMargins.every(p=>Math.abs(p.left-.28)<1e-6&&Math.abs(p.right-.28)<1e-6)"),true);
 // The worker's actual traversed path is built from these inset segments.
 assert.equal(run("fieldLayout(qaField).segments.every(s=>s.row<0||s.a.x>=103.28-1e-6&&s.b.x<=106.72+1e-6||s.row<0||s.b.x>=103.28-1e-6&&s.a.x<=106.72+1e-6)"),true);
});
test('migration stays inside the previous footprint and preserves saved crop state',()=>{
 fixture();run("const legacy={id:'legacy',type:'field',x:105,y:105,w:3.8,h:2.4,angle:.4};const oldPoly=rectWorldPoints(105,105,3.8,2.4,.4);const points=fieldPoints(legacy);if(!points.every(p=>urbanContains(oldPoly,p)))throw Error('migration expanded');fieldCrop(legacy).phase='sow';fieldCrop(legacy).work[0]=.7;const restored=JSON.parse(JSON.stringify(legacy));");
 assert.equal(run('fieldQuadValid(fieldPoints(legacy))'),true);
 assert.equal(run('fieldCrop(restored).phase'),'sow');assert.equal(run('fieldCrop(restored).work[0]'),.7);
});
test('whole field respects yellow zone, forests, buildings, roads, other fields and units',()=>{
 farm();assert.equal(run('fieldAllowed(qaField)'),true);
 run("State.combat.strokes=[{x:105,y:104,r:.1,mode:'eraseYellow'}];invalidateUrbanGeometry()");assert.equal(run('fieldAllowed(qaField)'),false);
 run("State.combat.strokes=[];State.environment=[{type:'forest',points:[{x:104,y:104},{x:105,y:104},{x:105,y:104.1},{x:104,y:104.1}]}];invalidateUrbanGeometry()");assert.equal(run('fieldAllowed(qaField)'),false);
 run("State.environment=[];State.structures.push({id:'t',type:'tower',shape:'square',size:1,x:105,y:104})");assert.equal(run('fieldAllowed(qaField)'),false);
 run("State.structures.pop();State.structures.push({id:'r',type:'road',a:{x:102,y:104},b:{x:108,y:104},width:.5})");assert.equal(run('fieldAllowed(qaField)'),false);
 run("State.structures.pop();State.structures.push({...qaField,id:'f2'})");assert.equal(run('fieldAllowed(qaField)'),false);
 run("State.structures.pop();window.ConquerCombat.spawnOccupants=()=>[{x:105,y:104,r:.2}]");assert.equal(run('fieldAllowed(qaField)'),false);
 run("delete window.ConquerCombat.spawnOccupants");
});

run("function qaMonthStart(month,year){for(let d=0;d<950;d++){const date=calendarDateFromDay(d);if(date.month===month&&date.year===year&&date.day===1)return d}throw Error('Calendar month missing')}");
test('work progresses only during scheduled months and only on working weekdays',()=>{
 farm();run("globalThis.qaAutumn=qaMonthStart(9,1);globalThis.qaSpring=qaMonthStart(2,2);globalThis.qaJune=qaMonthStart(5,2);globalThis.qaJuly=qaMonthStart(6,2);globalThis.qaNextAutumn=qaMonthStart(9,2);State.structures.push({id:'h1',type:'house',auto:true,x:101,y:110,w:1.5,h:1,level:1},{id:'h2',type:'house',auto:true,x:108,y:100,w:1.5,h:1,level:1});State.clock.day=1;tickFields(1)");
 assert.equal(run("fieldCrop(qaField).work.reduce((a,b)=>a+b,0)"),0,'June has no ploughing');
 assert.equal(run("fieldWorkAssignments(completedSettlement('house'),[qaField]).size"),0,'no idle-season worker allocations');
 run("globalThis.c=fieldCrop(qaField);c.lastDay=qaAutumn-1;State.clock.day=qaAutumn;tickFields(qaAutumn)");
 assert.equal(run('c.phase'),'plough');
 assert.equal(run('c.work[0]'),1);assert.equal(run('c.work[1]'),1);
 run("globalThis.qaSunday=qaAutumn+(6-qaAutumn%7+7)%7;c.lastDay=qaSunday-1;const snap=JSON.stringify(c.work);State.clock.day=qaSunday;tickFields(qaSunday);globalThis.qaNoSundayWork=snap===JSON.stringify(c.work)");
 assert.equal(run('qaNoSundayWork'),true,'Sunday must not plough');
});
test('unreachable farmers do not advance crops even in the correct season',()=>{
 run("globalThis.qaSavedPath=peasantPath;peasantPath=house=>[houseDoorInfo(house).outside];const before=JSON.stringify(c.work);c.lastDay=qaAutumn;State.clock.day=qaAutumn+1;tickFields(qaAutumn+1);globalThis.qaUnreachableUnchanged=before===JSON.stringify(c.work)");
 assert.equal(run('qaUnreachableUnchanged'),true);
 assert.equal(run("peasantPosition(State.structures.find(s=>s.id==='h1'),{field:qaField,cell:fieldLayout(qaField).cells[0]},qaAutumn+1)"),null);
 run('peasantPath=qaSavedPath');
});
test('October plough, March sow, autonomous spring growth, July harvest, next October reset',()=>{
 run("c.phase='plough';c.ploughed=false;c.harvested=false;c.work=fieldLayout(qaField).cells.map(s=>s.end-s.start-.1);c.lastDay=qaAutumn;State.clock.day=qaAutumn+1;tickFields(qaAutumn+1)");
 assert.equal(run('c.ploughed'),true,'ploughing should finish in October');
 assert.equal(run('c.phase'),'plough','field stays ploughed until the sowing window');
 assert.equal(run("fieldWorkAssignments(completedSettlement('house'),[qaField]).size"),0,'completed field must release farmers');
 run("c.lastDay=qaSpring-1;State.clock.day=qaSpring;tickFields(qaSpring)");
 assert.equal(run('c.phase'),'sow');
 // March 1 is Monday: no work is completed at midnight.
 run("c.lastDay=qaSpring;State.clock.day=qaSpring+1;tickFields(qaSpring+1)");
 assert.equal(run('c.work[0]'),3,'March sowing rate 3U per farmer per completed working day');
 run("c.work=fieldLayout(qaField).cells.map(s=>s.end-s.start-.1);c.lastDay=qaSpring+1;State.clock.day=qaSpring+2;tickFields(qaSpring+2)");
 assert.equal(run('c.phase'),'grow');
 assert.equal(run("fieldWorkAssignments(completedSettlement('house'),[qaField]).size"),0,'growing fields must not claim farmers');
 run("c.lastDay=qaJune-1;State.clock.day=qaJune;tickFields(qaJune)");
 assert.ok(run('c.growth')>.4&&run('c.growth')<1,'spring growth must be gradual');
 run("c.lastDay=qaJuly-1;State.clock.day=qaJuly;tickFields(qaJuly)");
 assert.equal(run('c.phase'),'harvest');assert.equal(run('c.growth'),1);
 run("c.work=fieldLayout(qaField).cells.map(s=>s.end-s.start-.1);globalThis.qaHarvestSunday=qaJuly+(6-qaJuly%7+7)%7;c.lastDay=qaHarvestSunday-1;State.clock.day=qaHarvestSunday;tickFields(qaHarvestSunday)");
 assert.equal(run('c.harvested'),false,'Sunday market/rest must not finish harvest');
 // Tuesday includes Monday's shift; on Monday at midnight no work has passed.
 run("c.lastDay=qaHarvestSunday;State.clock.day=qaHarvestSunday+2;tickFields(qaHarvestSunday+2)");
 assert.equal(run('c.harvested'),true);assert.equal(run('c.cycles'),1);
 assert.equal(run('c.phase'),'harvest','harvested field must wait until October');
 run("c.lastDay=qaNextAutumn-1;State.clock.day=qaNextAutumn;tickFields(qaNextAutumn)");
 assert.equal(run('c.phase'),'plough');assert.equal(run('c.harvested'),false);
});
test('finished seasonal fields release workers and preserve industrial reservations',()=>{
 farm();
 run("State.structures.push({id:'other-field',type:'field',auto:true,x:114,y:104,points:[{x:112,y:103},{x:116,y:103},{x:116,y:105},{x:112,y:105}]},{id:'h1',type:'house',auto:true,x:101,y:110,w:1.5,h:1,level:1},{id:'h2',type:'house',auto:true,x:108,y:100,w:1.5,h:1,level:1});State.clock.day=qaAutumn;fieldCrop(qaField).ploughed=true;fieldCrop(State.structures[2]).phase='plough';fieldWorkAssignmentCache.key=null;globalThis.qaAssigned=[...fieldWorkAssignments(completedSettlement('house'),completedSettlement('field')).values()].map(a=>a.field.id)");
 assert.deepEqual(JSON.parse(JSON.stringify(run('qaAssigned'))),['other-field','other-field']);
 run("fieldCrop(qaField).ploughed=false;fieldCrop(State.structures[2]).ploughed=true;globalThis.qaReassigned=[...fieldWorkAssignments(completedSettlement('house'),completedSettlement('field')).values()].map(a=>a.field.id)");
 assert.deepEqual(JSON.parse(JSON.stringify(run('qaReassigned'))),['f','f'],'season/completion changes must invalidate assignment key');
 run("globalThis.qaOldEconomy=window.ConquerEconomy;window.ConquerEconomy={KIND:{loggingCamp:{classId:1}},staffing:()=>({'logging':1})};State.structures.push({id:'logging',type:'loggingCamp',x:130,y:130});globalThis.qaIndustryAssignments=fieldWorkAssignments(completedSettlement('house'),completedSettlement('field')).size");
 assert.equal(run('qaIndustryAssignments'),1,'one worker remains reserved for logging');
 run("window.ConquerEconomy=qaOldEconomy");
});
test('alarms prevent work but cannot stop autonomous crop growth or restart a paused day',()=>{
 run("State.clock.day=qaNextAutumn;c=fieldCrop(qaField);c.phase='plough';c.ploughed=false;c.work.fill(0);c.lastDay=qaNextAutumn-1;window.ConquerCombat.alarmMode=()=>'mobilize';tickFields(qaNextAutumn)");
 assert.equal(run('c.work[0]'),0);
 run("c.phase='grow';c.sownDay=qaSpring;c.growth=0;c.lastDay=qaJune-1;State.clock.day=qaJune;tickFields(qaJune)");
 const growth=run('c.growth');assert.ok(growth>.4);
 run('tickFields(qaJune)');assert.equal(run('c.growth'),growth);
 run("window.ConquerCombat.alarmMode=()=>'off'");
});
test('worker paths still follow their exact assigned serpentine section',()=>{
 run("State.clock.day=qaAutumn;const c0=fieldCrop(qaField);c0.phase='plough';c0.ploughed=false;c0.work[0]=2;const cell=fieldLayout(qaField).cells[0];const p=fieldWorkerPosition(qaField,cell);globalThis.qaExpected=fieldLayout(qaField).at(cell.start+2);globalThis.qaMeasured=dist(p,qaExpected)");
 assert.equal(run('qaMeasured'),0);
 assert.equal(run("fieldWorkerRoute(qaField,fieldLayout(qaField).cells[0]).at(-1).x"),run('qaExpected.x'));
});
test('harvest strips cover entire irregular polygon before work and remove the grown fill',()=>{
 run("const irregular={id:'irr',type:'field',x:105,y:105,points:[{x:103,y:103},{x:107,y:104},{x:108,y:107},{x:104,y:108}]};const l=fieldLayout(irregular);const stripArea=l.rows.reduce((a,r)=>a+Math.abs(urbanArea(fieldStrip(l,r,0,1))),0)");
 assert.ok(Math.abs(run('stripArea-l.area'))<1e-7);
 run("const crop=fieldCrop(irregular);crop.phase='harvest';crop.growth=1;let cropDraws=0;const drawCropOriginal=drawFieldCropPolygon;drawFieldCropPolygon=(...args)=>{cropDraws++;drawCropOriginal(...args)};drawFieldWork(irregular)");assert.ok(run('cropDraws')>0);
 run("cropDraws=0;crop.work=l.cells.map(s=>s.end-s.start);drawFieldWork(irregular)");assert.equal(run('cropDraws'),0);
 run('drawFieldCropPolygon=drawCropOriginal');assert.equal(run('FIELD_RULES.cropHeight'),.1);
});

test('real village growth spawns valid four-corner fields within the build zone',()=>{
 fixture();run("State.clock.day=1;State.structures.push({id:'main',type:'road',auto:true,roadClass:'arterial',routeId:'main',a:{x:100,y:100},b:{x:100,y:125},width:.5});for(let i=0;i<5;i++)State.structures.push({id:'farmhouse'+i,type:'house',auto:true,x:96+i*2,y:97,w:1.5,h:1,angle:0});State.village.nextGrowthDay=2;invalidateNavigation();let spawned=0;for(let step=0;step<12;step++)if(spawnField(step))spawned++;");
 assert.ok(run('spawned')>0,'real spawn must find space');
 assert.equal(run("State.structures.filter(s=>s.type==='field').every(f=>fieldQuadValid(f.points)&&urbanYellowContains(f.points))"),true);
});
test('idle L2 workers open a field in the ploughing window without five houses',()=>{
  fixture();
  run("State.structures.push({id:'main',type:'road',auto:true,roadClass:'arterial',routeId:'main',a:{x:100,y:100},b:{x:100,y:125},width:.5},{id:'artisan',type:'house',auto:true,x:101,y:108,w:1.5,h:1,houseLevel:2});invalidateNavigation();globalThis.qaFirstAutumnMonday=qaAutumn+((7-qaAutumn%7)%7);State.clock.day=qaFirstAutumnMonday+.40;tickFields(State.clock.day);globalThis.qaL2Field=State.structures.find(s=>s.openedByL2==='artisan')");
  assert.equal(run('Boolean(qaL2Field)'),true,'an idle L2 should create farmland independently of five-house threshold');
  assert.equal(run('underConstruction(qaL2Field)'),false,'opening farmland should not require a construction delay');
  assert.equal(run('fieldLayout(qaL2Field).cells.length'),1,'a new L2 field must fit one worker slot');
  assert.equal(run('fieldQuadValid(qaL2Field.points)&&urbanYellowContains(qaL2Field.points)'),true);
  assert.equal(run('fieldWorkAssignments(completedSettlement("house"),completedSettlement("field")).get("artisan")?.field.id'),run('qaL2Field.id'),'L2 must be assigned to its newly opened field');
  run("globalThis.qaL2Crop=fieldCrop(qaL2Field);qaL2Crop.lastDay=qaFirstAutumnMonday+.40;State.clock.day=qaFirstAutumnMonday+1.40;tickFields(State.clock.day)");
  assert.ok(run('qaL2Crop.work.reduce((a,b)=>a+b,0)')>0,'L2 must actually plough after opening the new field');
  assert.equal(run("State.structures.filter(s=>s.openedByL2).length"),1,'a busy L2 must not continually create new parcels');
});
test('idle L2 expansion observes workdays, season and priority of mining and quarry work',()=>{
  fixture();
  run("State.structures.push({id:'main',type:'road',auto:true,roadClass:'arterial',routeId:'main',a:{x:100,y:100},b:{x:100,y:125},width:.5},{id:'artisan',type:'house',auto:true,x:101,y:108,w:1.5,h:1,houseLevel:2});State.clock.day=qaJune+.40;tickFields(State.clock.day)");
  assert.equal(run("State.structures.filter(s=>s.type==='field').length"),0,'L2 cannot expand outside autumn ploughing');
  run("State.structures.push({id:'quarry',type:'quarry',x:125,y:125});globalThis.qaOldEconomy=window.ConquerEconomy;window.ConquerEconomy={KIND:{quarry:{classId:2}},staffing:()=>({quarry:1})};State.clock.day=qaAutumn+((7-qaAutumn%7)%7)+.40;tickFields(State.clock.day)");
  assert.equal(run("State.structures.filter(s=>s.type==='field').length"),0,'L2 occupied in a quarry cannot open a field');
  run("window.ConquerEconomy=qaOldEconomy");
});
console.log(passed+' field regression checks passed.');
`);
check(require,__dirname);
