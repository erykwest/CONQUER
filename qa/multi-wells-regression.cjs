'use strict';
// Regression: several village wells. The founding well keeps the four border main roads;
// later wells are expansion centres linked by one main road, can take the village-centre
// role and carry a quarter name. One-well saves load with the founding well as centre.
const fs=require('node:fs');
const harness=fs.readFileSync(__dirname+'/urban-regression.cjs','utf8').split('let passed=0;')[0];
const check=new Function('require','__dirname',harness+`
run(moduleFile('placement'));
run(moduleFile('structure-commands'));
run('function renderUI(){}');
// The real save migration (settlement-app-persistence.js).
run(appSource.slice(appSource.indexOf('function migrateStructures('),appSource.indexOf('const LOCAL_STORAGE_SCHEMA=')));
let passed=0;
function test(name,body){body();passed++;console.log('PASS '+name)}
function found(){
 run("State.seed=12345;State.environment=[];State.relief=null;State.clock.day=0;State.structures=[{id:'well',type:'well',x:100,y:100}];State.village={name:'Rocca',founded:true,wellId:'well',growthStep:0,growthVersion:3};State.combat.units=[];State.combat.enemy=[];State.combat.strokes=[];State.resources={gold:1e6,stone:1e6,wood:1e6,metal:1e6,clay:1e6,food:1e6,equipment:1e6};invalidateNavigation();invalidateUrbanGeometry();window.ConquerCombat.invalidateRoutes();connectSelectedBorderMainRoads()");
}
function addWell(id,x,y){return run("addStructure({id:'"+id+"',type:'well',masonryMaterial:'stone',x:"+x+",y:"+y+"})")}

test('a one-well save keeps the founding well as village centre and label',()=>{
 found();
 run("globalThis.qaSaved=JSON.stringify({structures:State.structures,village:State.village})");
 run("(()=>{const x=JSON.parse(qaSaved);State.structures=migrateStructures(x.structures);State.village={...State.village,...x.village}})()");
 assert.equal(run("State.village.centerWellId"),undefined);
 assert.equal(run("villageCenterWell().id"),'well');
 assert.equal(run("wellDisplayName(foundingWell())"),'Rocca');
 assert.equal(run("StructureCommands.describeStructure('well').well.center"),true);
 assert.equal(run("StructureCommands.describeStructure('well').well.canCenter"),false,'the founding centre cannot be un-designated');
});
test('before founding a second well is still refused; after founding it is allowed',()=>{
 run("State.structures=[{id:'well',type:'well',x:100,y:100}];State.village={founded:false,wellId:null}");
 assert.equal(run("window.ConquerPlacement.check({id:'w2',type:'well',x:130,y:100}).ok"),false);
 found();
 assert.equal(run("window.ConquerPlacement.check({id:'w2',type:'well',x:130,y:100}).ok"),true);
 assert.ok(!/A village well already exists/.test(fs.readFileSync(__dirname+'/../src/settlement-placement.js','utf8')));
});
test('a later well gets one main road to the founding network, no border roads',()=>{
 found();
 const arterials=run("State.structures.filter(s=>s.type==='road'&&String(s.routeId).startsWith('arterial-')).length");
 assert.equal(addWell('w2',128,112),true);
 const roads=run("wellMainRoads(State.structures.find(s=>s.id==='w2')).length");
 assert.ok(roads>0,'the new well is linked by a main road');
 assert.equal(run("wellMainRoads(State.structures.find(s=>s.id==='w2')).every(r=>isPrimaryRoad(r)&&r.roadClass==='arterial-well'&&r.width===.62&&!underConstruction(r))"),true);
 assert.equal(run("wellMainRouteContinuous(State.structures.find(s=>s.id==='w2'))"),true);
 assert.equal(run("dist(wellMainRoads(State.structures.find(s=>s.id==='w2'))[0].a,{x:128,y:112})<.5"),true,'the road starts at the new well');
 assert.equal(run("ensureRoadPlan().length"),4,'still four border routes, all from the founding well');
 assert.equal(run("State.structures.filter(s=>s.type==='road'&&String(s.routeId).startsWith('arterial-')).length"),arterials);
 assert.equal(run("State.village.wellId"),'well');
 // Reload keeps the route (it carries a routeId) and does not rebuild it.
 run("rebuildSecondaryRoadsOnLoad();reconcileReactiveRoadNetwork()");
 assert.equal(run("wellMainRoads(State.structures.find(s=>s.id==='w2')).length"),roads);
});
test('the later-well road stops at the first main road it meets (T-junction)',()=>{
 found();
 run("State.structures.push({id:'trunk',type:'road',manualMain:true,roadClass:'arterial-manual',routeId:'manual-main:trunk',a:{x:120,y:96},b:{x:120,y:126},width:.62});invalidateNavigation()");
 assert.equal(addWell('w2',140,118),true);
 const end=run("JSON.stringify(wellMainRoads(State.structures.find(s=>s.id==='w2')).at(-1).b)");
 assert.ok(Math.abs(JSON.parse(end).x-120)<.05,'ends on the crossed main road, not in the founding plaza: '+end);
 assert.equal(run("wellMainRouteContinuous(State.structures.find(s=>s.id==='w2'))"),true);
});
test('every well is an expansion centre: zones and housing around a later well',()=>{
 found();assert.equal(addWell('w2',140,118),true,'place the later well');
 run("window.ConquerCombat.invalidateRoutes()");
 assert.equal(run("window.ConquerCombat.areaState({x:142,y:121}).yellow"),true,'yellow housing zone around the later well');
 assert.equal(run("window.ConquerCombat.areaState({x:141,y:119}).green"),true,'green safe zone around the later well');
 assert.equal(run("window.ConquerCombat.areaState({x:125,y:125}).yellow"),false);
 assert.equal(run("villageGrowthCentres().map(s=>s.id).join()"),'well,w2');
 // Keep only the later well's main road: houses grow around BOTH wells along it, and
 // every house stays inside the growth radius of its nearest well.
 run("State.structures=State.structures.filter(s=>s.type!=='road'||s.wellFor==='w2');invalidateNavigation();invalidateUrbanGeometry()");
 for(let step=0;step<10;step++)run('spawnHouse('+step+')');
 assert.ok(run("State.structures.some(h=>h.type==='house'&&dist(h,{x:140,y:118})<=currentGrowthRadius())"),'houses spawn around the later well');
 assert.ok(run("State.structures.filter(s=>s.type==='house').every(h=>Math.min(dist(h,{x:140,y:118}),dist(h,{x:100,y:100}))<=currentGrowthRadius())"));
 // The same sampler with one well never leaves the founding radius (old behaviour).
 run("State.structures=State.structures.filter(s=>s.type!=='house'&&s.id!=='w2');invalidateNavigation();invalidateUrbanGeometry()");
 assert.equal(run("villageGrowthCentres().map(s=>s.id).join()"),'well');
});
test('centre designation moves between wells and falls back to the founding well',()=>{
 found();addWell('w2',128,112);
 assert.equal(run("StructureCommands.describeStructure('w2').well.center"),false);
 run("StructureCommands.setWellName('w2','  Borgo   San Rocco  ')");
 assert.equal(run("State.structures.find(s=>s.id==='w2').wellName"),'Borgo San Rocco');
 assert.equal(run("wellDisplayName(State.structures.find(s=>s.id==='w2'))"),'Borgo San Rocco');
 assert.equal(run("StructureCommands.toggleVillageCenter('w2')"),true);
 assert.equal(run("State.village.centerWellId"),'w2');
 assert.equal(run("villageCenterWell().id"),'w2');
 assert.equal(run("wellDisplayName(State.structures.find(s=>s.id==='w2'))"),'Rocca','the centre shows the village name');
 assert.equal(run("wellDisplayName(foundingWell())"),'','the founding well, no longer centre, has no quarter name yet');
 assert.equal(run("StructureCommands.describeStructure('well').well.center"),false);
 assert.equal(run("State.village.wellId"),'well','border roads and economy stay on the founding well');
 // Same save round trip.
 run("globalThis.qaSaved=JSON.stringify({structures:State.structures,village:State.village})");
 run("(()=>{const x=JSON.parse(qaSaved);State.structures=migrateStructures(x.structures);State.village={...State.village,...x.village}})()");
 assert.equal(run("villageCenterWell().id"),'w2');
 assert.equal(run("State.structures.find(s=>s.id==='w2').wellName"),'Borgo San Rocco');
 run("StructureCommands.toggleVillageCenter('w2')");
 assert.equal(run("villageCenterWell().id"),'well','re-designating the centre returns it to the founding well');
 run("StructureCommands.toggleVillageCenter('w2');StructureCommands.toggleVillageCenter('well')");
 assert.equal(run("State.village.centerWellId"),undefined);
 run("StructureCommands.setWellName('w2','')");
 assert.equal(run("'wellName' in State.structures.find(s=>s.id==='w2')"),false);
 run("StructureCommands.setWellName('w2','x'.repeat(80))");
 assert.equal(run("State.structures.find(s=>s.id==='w2').wellName.length"),32);
});
test('demolishing a later well keeps the village; demolishing the founding well resets it',()=>{
 found();addWell('w2',128,112);
 run("StructureCommands.toggleVillageCenter('w2');deleteStructure('w2')");
 assert.equal(run("State.village.founded"),true);
 assert.equal(run("State.structures.some(s=>s.wellFor==='w2')"),false,'its main road goes with it');
 assert.equal(run("villageCenterWell().id"),'well');
 assert.equal(run("State.village.centerWellId"),undefined);
 addWell('w3',72,92);
 run("deleteStructure('well')");
 assert.equal(run("State.village.founded"),false);
 assert.equal(run("State.structures.some(s=>s.type==='well')"),false,'later wells go with the founding well');
});
test('fire brigades, labels, diplomacy and inspector cover every well',()=>{
 const src=n=>fs.readFileSync(__dirname+'/../src/'+n,'utf8');
 assert.match(src('settlement-fire.js'),/function wells\\(\\)\\{return State\\.structures\\.filter\\(s=>s\\.type==='well'/);
 assert.match(src('settlement-buildings.js'),/wellDisplayName\\(s\\)/);
 assert.match(src('settlement-world3d.js'),/wellDisplayName\\(s\\)/);
 assert.match(src('settlement-diplomacy.js'),/villageCenterWell\\(\\)/);
 assert.match(src('ui/shell.js'),/function WellPanel\\(/);
 assert.match(src('ui/shell.js'),/run\\('toggleVillageCenter'\\)/);
 assert.match(src('ui/shell.js'),/run\\('setWellName'/);
 assert.match(src('settlement-app-simulation.js'),/reconcileWellMainConnections\\(false\\)/);
});
console.log(passed+' multi-well regression checks passed.');
`);
check(require,__dirname);
