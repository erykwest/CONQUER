'use strict';
// Regression: town hall and guild hall belong to a well's square. One of each per well,
// within WELL_CIVIC_RANGE of a completed well, only once the village is founded; three
// Blender levels each (the town hall's civic tower carries bell and sundial).
const fs=require('node:fs');
const harness=fs.readFileSync(__dirname+'/urban-regression.cjs','utf8').split('let passed=0;')[0];
const check=new Function('require','__dirname',harness+`
run(moduleFile('placement'));
run(moduleFile('structure-commands'));
run('function renderUI(){}');
run(appSource.slice(appSource.indexOf('function migrateStructures('),appSource.indexOf('const LOCAL_STORAGE_SCHEMA=')));
let passed=0;
function test(name,body){body();passed++;console.log('PASS '+name)}
function found(){
 run("State.seed=12345;State.environment=[];State.relief=null;State.clock.day=0;State.structures=[{id:'well',type:'well',x:100,y:100}];State.village={name:'Rocca',founded:true,wellId:'well',growthStep:0,growthVersion:3};State.combat.units=[];State.combat.enemy=[];State.combat.strokes=[];State.resources={gold:1e6,stone:1e6,wood:1e6,metal:1e6,clay:1e6,food:1e6,equipment:1e6};invalidateNavigation();invalidateUrbanGeometry();window.ConquerCombat.invalidateRoutes();connectSelectedBorderMainRoads()");
}
const civic=(id,type,x,y,extra='')=>"{id:'"+id+"',type:'"+type+"',shape:'civic',masonryMaterial:'stone',x:"+x+",y:"+y+extra+"}";
const place=(id,type,x,y,extra)=>run("addStructure("+civic(id,type,x,y,extra)+")");
const verdict=(type,x,y)=>run("window.ConquerPlacement.check("+civic('probe',type,x,y)+")");
// First placeable spot on rings around a well.
const free=(type,cx,cy)=>{for(let r=3;r<=8;r+=.5)for(let a=0;a<16;a++){const x=+(cx+Math.cos(a/16*6.283)*r).toFixed(1),y=+(cy+Math.sin(a/16*6.283)*r).toFixed(1);if(verdict(type,x,y).ok)return[x,y]}return null};

test('town hall and guild are levelled civic types with their footprints',()=>{
 assert.equal(run("isCivic({type:'townhall'})&&isCivic({type:'guild'})"),true);
 assert.equal(run("CIVIC_LEVEL_TYPES.includes('townhall')&&CIVIC_LEVEL_TYPES.includes('guild')"),true);
 assert.equal(run("civicLocalParts({type:'townhall'}).map(p=>p.role).join()"),'hall,tower');
 assert.equal(run("civicLocalParts({type:'guild'}).map(p=>p.w+'x'+p.h).join()"),'3x2.5');
 assert.equal(run("isPlacementFoundationBuilding({type:'townhall'})&&isPlacementFoundationBuilding({type:'guild'})"),true);
});
test('they need a founded village and a completed well within reach',()=>{
 run("State.structures=[{id:'well',type:'well',x:100,y:100}];State.village={founded:false,wellId:null}");
 assert.match(verdict('townhall',100,106).reason,/founded village/);
 found();
 assert.match(verdict('townhall',100,100+run('WELL_CIVIC_RANGE')+3).reason,/within 9U of a completed well/);
 // The four border roads cross at the founding well: there is still room between them.
 assert.ok(free('townhall',100,100),'a free spot for the town hall next to the founding well');
});
test('one town hall and one guild per well, bound to the nearest free well',()=>{
 found();
 const th=free('townhall',100,100);assert.ok(th,'town hall spot near the founding well');
 assert.equal(place('th1','townhall',th[0],th[1]),true);
 assert.equal(run("State.structures.find(s=>s.id==='th1').wellId"),'well');
 assert.equal(run("structureLabel(State.structures.find(s=>s.id==='th1'))"),'Town hall · L1 · village centre');
 assert.equal(free('townhall',100,100),null,'a second town hall at the same well is refused');
 assert.match(verdict('townhall',th[0],th[1]+.5).reason,/already has a town hall|overlaps/);
 const gd=free('guild',100,100);assert.ok(gd,'the guild fits beside the same well');
 assert.equal(place('g1','guild',gd[0],gd[1]),true);
 assert.equal(run("State.structures.find(s=>s.id==='g1').wellId"),'well');
 // A quarter well takes its own pair.
 assert.equal(run("addStructure({id:'w2',type:'well',masonryMaterial:'stone',x:140,y:118})"),true);
 run("StructureCommands.setWellName('w2','Borgo San Rocco')");
 const th2=free('townhall',140,118);assert.ok(th2,'a town hall fits at the quarter well');
 assert.equal(place('th2','townhall',th2[0],th2[1]),true);
 assert.equal(run("State.structures.find(s=>s.id==='th2').wellId"),'w2');
 assert.equal(run("structureLabel(State.structures.find(s=>s.id==='th2'))"),'Town hall · L1 · Borgo San Rocco');
 const facts=JSON.parse(run("JSON.stringify(StructureCommands.describeStructure('th2').facts)"));
 assert.deepEqual(facts.find(f=>f.key==='square'),{key:'square',value:'Borgo San Rocco',center:false});
 // Designating the quarter as centre relabels its town hall.
 run("StructureCommands.toggleVillageCenter('w2')");
 assert.equal(run("structureLabel(State.structures.find(s=>s.id==='th2'))"),'Town hall · L1 · village centre');
 assert.equal(run("structureLabel(State.structures.find(s=>s.id==='th1'))"),'Town hall · L1 · unnamed quarter');
 // Levels, and a save round trip keeps the binding.
 run("StructureCommands.setCivicLevel('th2',3)");
 assert.equal(run("civicLevel(State.structures.find(s=>s.id==='th2'))"),3);
 run("globalThis.qaSaved=JSON.stringify({structures:State.structures,village:State.village})");
 run("(()=>{const x=JSON.parse(qaSaved);State.structures=migrateStructures(x.structures);State.village={...State.village,...x.village}})()");
 assert.equal(run("State.structures.find(s=>s.id==='th2').wellId"),'w2');
 assert.equal(run("State.structures.find(s=>s.id==='g1').type"),'guild');
});
test('Blender models: three levels each, the town hall with hall, tower and belfry',()=>{
 const ctx={window:{}};require('node:vm').runInNewContext(fs.readFileSync(__dirname+'/../src/assets/civic-models.js','utf8'),ctx);
 const models=ctx.window.ConquerCivicModels.models;
 for(const L of [1,2,3]){
  assert.deepEqual(Object.keys(models['townhall'+L].parts),['hall','tower','belfry']);
  assert.ok(models['guild'+L].parts.hall,'guild'+L+' hall');
 }
 const keys=ctx.window.ConquerCivicModels.paletteKeys,bronze=keys.indexOf('bronze'),clock=keys.indexOf('clock');
 for(const L of [1,2,3])assert.ok(models['townhall'+L].parts.belfry.c.includes(bronze),'townhall'+L+' rings a bronze bell');
 assert.ok(models.townhall3.parts.tower.c.includes(clock),'the L3 civic tower has a clock face');
 const civic3d=fs.readFileSync(__dirname+'/../src/settlement-civic3d.js','utf8');
 assert.match(civic3d,/\\['church','tavern','market','townhall','guild'\\]\\.includes\\(s\\.type\\)\\)return s\\.type\\+level/);
 assert.match(fs.readFileSync(__dirname+'/../index.html','utf8'),/data-civic="townhall"[\\s\\S]*data-civic="guild"/);
});
test('destroyed: the town hall falls hall first, then its tower from its own height',()=>{
 found();
 run("State.structures.push({id:'thx',type:'townhall',x:106,y:104,angle:0,civicLevel:3,groundZ:0});State.structures.push({id:'gx',type:'guild',x:94,y:104,angle:0,civicLevel:1,groundZ:0})");
 run("window.ConquerSiege.restore({...(State.siege||{}),ruins:[]});window.ConquerSiege.attackStructure('thx','trebuchet',1e6)");
 const ruins=JSON.parse(run("JSON.stringify(State.siege.ruins.filter(r=>r.spec&&r.id.startsWith('thx:')).map(r=>({cause:r.cause,z1:r.spec.z1,material:r.spec.material})))"));
 assert.equal(ruins.length,2,'one collapse for the hall, one for the tower');
 const tower=ruins.find(r=>r.cause==='collapse-tower'),hall=ruins.find(r=>r.cause!=='collapse-tower');
 assert.ok(tower&&hall&&tower.z1>hall.z1+3,'the L3 tower falls from well above the hall: '+JSON.stringify(ruins));
 assert.equal(hall.material,'stone');
 run("window.ConquerSiege.attackStructure('gx','trebuchet',1e6)");
 assert.equal(run("State.siege.ruins.find(r=>r.id.startsWith('gx:')).spec.material"),'timber','the L1 guild hall is timber-framed');
 assert.equal(run("State.structures.some(s=>s.id==='thx'||s.id==='gx')"),false);
});
test('brick masonry and the clay palette reach the Blender civic models; cutaway covers both',()=>{
 const civic3d=fs.readFileSync(__dirname+'/../src/settlement-civic3d.js','utf8');
 assert.match(civic3d,/masonryMaterial\\(s\\)==='brick'/);
 assert.match(civic3d,/withClay\\(s,\\(\\)=>triangles\\(modelKey\\(s\\),placeOf\\(s\\),ground\\)\\)/);
 assert.match(civic3d,/\\['church','tavern','townhall','guild'\\]\\.includes\\(s\\.type\\)&&s\\.id===State\\.selectedId/);
 for(const k of ['townhall1','townhall2','townhall3','guild1','guild2','guild3'])assert.match(civic3d,new RegExp(k+':\\\\{floors:'));
});
console.log(passed+' well civic regression checks passed.');
`);
check(require,__dirname);
