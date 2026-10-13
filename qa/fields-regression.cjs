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
test('one U per worker per calendar day; three U during sowing; no progress without workers',()=>{
 farm();run("State.structures.push({id:'h1',type:'house',auto:true,x:101,y:110,w:1.5,h:1,level:1},{id:'h2',type:'house',auto:true,x:108,y:100,w:1.5,h:1,level:1});State.clock.day=1;tickFields(1)");
 assert.equal(run('fieldCrop(qaField).work[0]'),1);assert.equal(run('fieldCrop(qaField).work[1]'),1);
 run("fieldCrop(qaField).phase='sow';fieldCrop(qaField).work.fill(0);State.clock.day=2;tickFields(2)");
 assert.equal(run('fieldCrop(qaField).work[0]'),3);assert.equal(run('fieldCrop(qaField).work[1]'),3);
 run("State.structures=State.structures.filter(s=>s.type!=='house');State.clock.day=3;tickFields(3)");assert.equal(run('fieldCrop(qaField).work[0]'),3);
});
test('an unreachable worker neither advances work nor crosses buildings to enter the field',()=>{
 run("const pathOriginal=peasantPath;peasantPath=(house)=>[houseDoorInfo(house).outside];State.structures.push({id:'h1',type:'house',auto:true,x:101,y:110,w:1.5,h:1,level:1});const oldWork=fieldCrop(qaField).work.slice();State.clock.day=3.3;tickFields(3.3)");
 assert.equal(run('JSON.stringify(fieldCrop(qaField).work)'),run('JSON.stringify(oldWork)'));
 assert.equal(run("peasantPosition(State.structures.find(s=>s.id==='h1'),{field:qaField,cell:fieldLayout(qaField).cells[0]},3.3)"),null);
 run('peasantPath=pathOriginal;State.structures.pop()');
});
test('full cycle plough → sow → autonomous growth → harvest → plough',()=>{
 run("State.structures.push({id:'h1',type:'house',auto:true,x:101,y:110,w:1.5,h:1,level:1},{id:'h2',type:'house',auto:true,x:108,y:100,w:1.5,h:1,level:1});const c=fieldCrop(qaField);c.phase='plough';c.work=fieldLayout(qaField).cells.map(s=>s.end-s.start-.1);State.clock.day=4;tickFields(4)");
 assert.equal(run('c.phase'),'sow');run("c.work=fieldLayout(qaField).cells.map(s=>s.end-s.start-.1);State.clock.day=5;tickFields(5)");assert.equal(run('c.phase'),'grow');
 assert.equal(run("fieldWorkAssignments(completedSettlement('house'),[qaField]).size"),0);
 run("State.structures=State.structures.filter(s=>s.type!=='house');State.clock.day=8.5;tickFields(8.5)");assert.equal(run('c.growth'),.5);
 run("State.clock.day=12;tickFields(12)");assert.equal(run('c.phase'),'harvest');
 run("State.structures.push({id:'h1',type:'house',auto:true,x:101,y:110,w:1.5,h:1,level:1},{id:'h2',type:'house',auto:true,x:108,y:100,w:1.5,h:1,level:1});c.work=fieldLayout(qaField).cells.map(s=>s.end-s.start-.1);State.clock.day=13;tickFields(13)");assert.equal(run('c.phase'),'harvest','Sunday is not a farming workday');
 run("State.clock.day=15;tickFields(15)");assert.equal(run('c.phase'),'plough');assert.equal(run('c.cycles'),1);
});
test('alarms suspend labor but allow autonomous growth; pause does not advance crops',()=>{
 run("c.work.fill(0);window.ConquerCombat.alarmMode=()=>'mobilize';State.clock.day=16;tickFields(16)");assert.equal(run('c.work[0]'),0);
 run("c.phase='grow';c.growth=0;State.clock.day=17;tickFields(17)");assert.ok(Math.abs(run('c.growth')-1/7)<1e-9);
 run('tickFields(17)');assert.ok(Math.abs(run('c.growth')-1/7)<1e-9);run("window.ConquerCombat.alarmMode=()=>'off'");
});
test('workers traverse their exact serpentine portion and commute to current work',()=>{
 run("c.phase='plough';c.work[0]=2;const cell=fieldLayout(qaField).cells[0];const p=fieldWorkerPosition(qaField,cell);const expected=fieldLayout(qaField).at(cell.start+2)");
 assert.equal(run('dist(p,expected)'),0);
 assert.equal(run("dist(peasantPosition(State.structures.find(s=>s.id==='h1'),{field:qaField,cell},17.3),expected)"),0);
 assert.equal(run('fieldWorkerRoute(qaField,cell).at(-1).x'),run('expected.x'));
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
console.log(passed+' field regression checks passed.');
`);
check(require,__dirname);
