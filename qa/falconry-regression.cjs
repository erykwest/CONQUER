'use strict';
// Falconry (Falconiera, room `mews`): the top room of a W2-W3 stone tower under a pitched roof, its
// mews cage on the roof through ROOM_EXTERIOR (mount 'roof', tied to the room). The falcons hunt:
// game into the food store every day, up to the granaries. Castle prestige (user, 05/11/2026):
// points per working court room, the falconry first; shown in the logistics panel.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const src=name=>fs.readFileSync(__dirname+'/../src/'+name,'utf8');
const pick=(text,name)=>{
  const at=text.search(new RegExp('\\n[ ]*function '+name+'\\('));assert.ok(at>=0,name);
  const indent=text.slice(at+1).match(/^[ ]*/)[0],end=text.indexOf('\n'+indent+'function ',at+1);
  return text.slice(at+1,end<0?undefined:end);
};
const core=src('settlement-core.js'),siege=src('settlement-siege.js'),castle=src('settlement-castle-placement.js');

// ---- room rule
const ctx=vm.createContext({window:{},Math,Number,Object,Array,JSON,
  underConstruction:s=>!!s.building,structureLevel:s=>s.level||1,isWoodTower:s=>s.material==='wood',
  towerTier:s=>s.size>=1.99?3:s.size>=1.49?2:1,towerRoofStyle:s=>s.roofStyle||'battlement',
  isWideBuilt:()=>false,builtInteriorFloors:s=>s.level||1,functionSlotUnits:()=>1,
});
vm.runInContext([pick(castle,'functionCapacity'),pick(core,'towerDovecoteAllowed'),pick(core,'towerMewsAllowed'),pick(core,'towerMews'),
  pick(siege,'eligibleRoom'),pick(siege,'floor'),pick(siege,'allowed')].join('\n'),ctx);
const {allowed,towerMews}=vm.runInContext('({allowed,towerMews})',ctx);
const tower=o=>({type:'tower',shape:'square',material:'stone',size:1.5,level:2,roofStyle:'pitched',...o});
assert.ok(allowed(tower(),1,'mews'),'W2 L2 top floor under a pitched roof');
assert.ok(allowed(tower({size:2,level:3}),2,'mews'),'W3 L3 top floor');
assert.ok(!allowed(tower(),0,'mews'),'not below the top floor');
assert.ok(!allowed(tower({level:1}),0,'mews'),'not on an L1 tower');
assert.ok(!allowed(tower({roofStyle:'battlement'}),1,'mews'),'only under a pitched roof');
assert.ok(!allowed(tower({material:'wood'}),1,'mews'),'not on timber towers');
assert.ok(!allowed({type:'built',length:3,level:2},1,'mews'),'not in built sections');
assert.ok(towerMews(tower({functions:[null,'mews']}))&&!towerMews(tower({functions:['mews',null]}))&&!towerMews(tower({functions:[null,'mews'],destroyed:true})));
assert.ok(JSON.parse(core.match(/const FUNCTION_CATALOG=(\[[^\n]+\]);/)[1].replace(/'/g,'"')).includes('mews'));
assert.match(src('settlement-alarm-bells.js'),/APEX_ROOMS=\['dovecote','mews'\]/,'one roof, one apex element: the falconry takes the place of a bell');
console.log('PASS falconry only on the top floor of W2-W3 stone towers L2+ with a pitched roof');

// ---- hunting and prestige
const consts=['MEWS_FOOD','PRESTIGE'].map(n=>siege.match(new RegExp('const '+n+'=[^\\n]+'))[0]).join('\n');
const hc=vm.createContext({Object,Math,Number,Array,window:{},State:{structures:[]},cap:{food:240},
  eligibleRoom:s=>!!s&&['tower','built','gate'].includes(s.type),allowed:(s,i,fn)=>!(s.bad||[]).includes(i),capturedRoomIds:()=>new Set(hc.captured||[])});
vm.runInContext(consts+'\n'+pick(siege,'mewsCount')+'\n'+pick(siege,'prestige'),hc);
const {mewsCount,prestige}=vm.runInContext('({mewsCount,prestige})',hc);
hc.State.structures=[{id:'a',type:'tower',functions:[null,'mews']},{id:'b',type:'tower',functions:['throneHall','nobleRoom','mews']},{id:'c',type:'built',functions:['chapel','treasury']}];
assert.equal(mewsCount(),2);
const P=vm.runInContext('PRESTIGE',hc);
assert.deepEqual(prestige().total,2*P.mews+P.throneHall+P.nobleRoom+P.chapel+P.treasury);
assert.ok(P.mews>=P.nobleRoom&&P.mews>0,'the falconry is a main source of prestige');
hc.captured=['a:1'];assert.equal(mewsCount(),1,'a captured falconry does not hunt');assert.equal(prestige().by.mews,P.mews);hc.captured=[];
hc.State.structures[1].bad=[2];assert.equal(mewsCount(),1,'a room no longer allowed (roof lost) does not count');
assert.match(pick(siege,'tick'),/const hunt=mewsCount\(\)\*MEWS_FOOD\*elapsed;\n\s*if\(hunt>0\)x\.stock\.food=Math\.max\(x\.stock\.food,Math\.min\(capacity\(\)\.food,x\.stock\.food\+hunt\)\)/,'game into the store, up to the granaries');
assert.match(pick(siege,'summaryHtml'),/Prestige '\+fmt\(p\.total\)/,'prestige in the logistics panel');
console.log('PASS falcons hunt into the store; prestige counts the court rooms');

// ---- roof element, model, Lab
assert.match(src('settlement-room-exterior.js'),/mews:Object\.freeze\(\{model:'mews',source:'ConquerMewsModels',mount:'roof'/);
assert.match(pick(src('settlement-room-exterior.js'),'roomExteriorPlacement'),/if\(spec\.mount==='roof'\)\{/);
assert.match(src('settlement-castle-structures.js'),/towerMews\(s\)\?window\.ConquerMewsModels\?\.height/,'the flag stands above the mews');
assert.match(src('settlement-cutaway-furniture.js'),/mews\(r\)\{r\.row\(r\.A,'perch'/);
const ctxM={window:{}};vm.createContext(ctxM);vm.runInContext(src('assets/mews-models.js'),ctxM);
const M=ctxM.window.ConquerMewsModels;assert.ok(M.models.mews.parts.slats&&M.models.mews.parts.perch&&M.height>.5&&M.sink>0);
for(const page of ['index.html','camp/index.html','figures-lab.html'])assert.match(fs.readFileSync(__dirname+'/../'+page,'utf8'),/mews-models\.js/);
assert.match(src('asset-catalog.js'),/global:'ConquerMewsModels'/);
assert.match(src('settlement-siege-preview.js'),/'Pietra quadrata L2 tetto \+ falconiera'/);
console.log('PASS mews on the roof, its Blender model, cutaway perches and Asset Lab entries are wired');
