'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const harness=fs.readFileSync(__dirname+'/urban-regression.cjs','utf8').split('let passed=0;')[0];
eval(harness+`
run(moduleFile('economy'));run(moduleFile('structure-commands'));run(moduleFile('app-persistence').split('const LOCAL_STORAGE_SCHEMA')[0]);run('function renderUI(){}');
run("function constructionWorkerPath(){return true}");
const test=(name,fn)=>{fn();console.log('PASS '+name)};
const reset=()=>run("State.devBuild={};State.village={founded:true,wellId:'well',foundingWorkers:3};State.clock.day=0;State.structures=[{id:'well',type:'well',x:100,y:100},{id:'t',type:'tower',material:'stone',shape:'square',size:1,tier:1,level:1,x:105,y:100,functions:[]}];State.economy=null;window.ConquerEconomy.reset();State.structures[1].buildCost=constructionCost(State.structures[1]);window.ConquerEconomy.state().castleGold=0;for(const k of Object.keys(window.ConquerEconomy.state().castle))window.ConquerEconomy.state().castle[k]=0");
test('height upgrade creates timed delta quote and refuses a second overlapping upgrade',()=>{
 reset();run("StructureCommands.setHeight('t',2)");
 assert.equal(run("underConstruction(State.structures[1])"),true);
 assert.equal(run("constructionProgress(State.structures[1])"),0);
 assert.equal(run("State.structures[1].construction.upgrade.before.level"),1);
 assert.equal(run("StructureCommands.setHeight('t',3)"),false);
 assert(run("constructionMaterialInfo(State.structures[1]).required.stone < State.structures[1].buildCost.stone"));
});
test('cancel renovation restores prior building and refunds only delivered unconsumed quote',()=>{
 reset();run("StructureCommands.setHeight('t',2);window.ConquerEconomy.state().castle.stone=3;allocateConstructionMaterials([State.structures[1]],1)");
 assert.equal(run("window.ConquerEconomy.state().castle.stone"),0);
 run("deleteStructure('t')");assert.equal(run("State.structures[1].level"),1);assert.equal(run("underConstruction(State.structures[1])"),false);
 assert.equal(run("window.ConquerEconomy.state().castle.stone"),3);
});
test('free build grants materials without treasury or wage consumption, and grants cannot be refunded',()=>{
 reset();run("State.devBuild.freeBuild=true;StructureCommands.setHeight('t',2);State.clock.day=.52;tickConstructionWork(0,.52)");
 assert(run("State.structures[1].construction.workDone>0"));assert.equal(run("window.ConquerEconomy.state().castleGold"),0);
 assert.equal(run("Object.keys(refundableConstructionCost(State.structures[1])).length"),0);
 assert.equal(run("State.structures[1].construction.wagesPaid||0"),0);
});
test('fast build respects material payment but removes worker and time requirements',()=>{
 reset();run("State.devBuild.fastBuild=true;StructureCommands.setHeight('t',2)");assert.equal(run("underConstruction(State.structures[1])"),true);
 run("for(const [k,v] of Object.entries(constructionMaterialInfo(State.structures[1]).required)){if(k==='gold')window.ConquerEconomy.state().castleGold=v;else window.ConquerEconomy.state().castle[k]=v};State.clock.day=.01;tickConstructionWork(0,.01)");
 assert.equal(run("underConstruction(State.structures[1])"),false);assert.equal(run("window.ConquerEconomy.state().castleGold"),0);
});
test('combined DEV modes finish new construction instantly without minting refundable materials',()=>{
 reset();run("State.devBuild={freeBuild:true,fastBuild:true};const s=State.structures[1];beginConstruction(s)");
 assert.equal(run("constructionProgress(State.structures[1])"),1);assert.equal(run("Object.keys(refundableConstructionCost(State.structures[1])).length"),0);
});
test('automatic-house inspector level changes invoke a timed site through the real entry point',()=>{
 reset();run("State.structures=[{id:'well',type:'well',x:80,y:80},{id:'house',type:'house',auto:true,x:100,y:100,w:1.5,h:1,angle:0,houseLevel:2}];State.combat.strokes=[{x:100,y:100,r:40,mode:'yellow'}];invalidateNavigation();invalidateUrbanGeometry();changeHouseDensity(State.structures[1],3)");
 assert.equal(run("State.structures[1].houseLevel"),3);
 assert.equal(run("underConstruction(State.structures[1])"),true);assert.equal(run("State.structures[1].construction.completeDay"),2.2);
 assert.equal(run("State.structures[1].construction.upgrade.before.houseLevel"),2);assert.equal(run("window.ConquerEconomy.state().castleGold"),0);
 run("State.devBuild.fastBuild=true;applyConstructionDev(State.structures[1])");assert.equal(run("underConstruction(State.structures[1])"),false,'fast procedural upgrades complete at the same timestamp');
});
test('upgrading an automatic public bridge still requires its materials and staffed work',()=>{
 reset();run("State.bridge={id:'bridge',type:'bridge',auto:true,variant:'wood',a:{x:100,y:100},b:{x:103,y:100},length:3,width:1.2};State.previous=structureUpgradeSnapshot(State.bridge);State.bridge.variant='stone';State.structures.push(State.bridge);beginStructureUpgrade(State.bridge,State.previous,{stone:10},1)");
 assert.equal(run("State.bridge.construction.version"),2);assert.equal(run("constructionMaterialInfo(State.bridge).progress"),0);
 run("State.clock.day=.52;tickConstructionWork(0,.52)");assert.equal(run("State.bridge.construction.workDone"),0);
});
test('renovation save state retains exact quote and rollback through JSON migration',()=>{
 reset();run("StructureCommands.setHeight('t',2);State.saved=JSON.stringify(State.structures[1]);State.structures[1]=migrateStructures([JSON.parse(State.saved)])[0]");
 assert.equal(run("underConstruction(State.structures[1])"),true);assert.equal(run("State.structures[1].construction.upgrade.before.level"),1);
});
`);
