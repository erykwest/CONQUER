'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'src/settlement-camp.js'),'utf8');
const combat=fs.readFileSync(path.join(root,'src/settlement-combat.js'),'utf8');
const persistence=fs.readFileSync(path.join(root,'src/settlement-app-persistence.js'),'utf8');
const garrisons=fs.readFileSync(path.join(root,'src/settlement-population-garrisons.js'),'utf8');
const page=fs.readFileSync(path.join(root,'camp/index.html'),'utf8');
assert.match(page,/__CONQUER_CAMP_MODE__=true/);
assert.match(page,/settlement-camp.js/);
assert.match(combat,/campState==='camped'/);
assert.match(combat,/camp-guard/);
assert.match(garrisons,/u.campState==='barracks'/);
assert.match(persistence,/conquer.camp.schema/);
assert.match(persistence,/if\(window.__CONQUER_CAMP_MODE__\).*return/);
let cycle=.25,id=0,fixtures=0,flames=0,saveCalls=0;
const fakePanel={hidden:true,replaceChildren(){},append(){}};
const fakeBar={setAttribute(){},querySelector(){return fakePanel},querySelectorAll(){return[]},addEventListener(){},insertBefore(){}};
const document={
  head:{appendChild(){}},body:{appendChild(){}},
  createElement(tag){
    if(tag==='nav')return fakeBar;
    return {dataset:{},classList:{toggle(){}},append(){},appendChild(){},remove(){}};
  }
};
const state={
  village:{founded:true},structures:[{id:'barracks-1',type:'built',functions:['barracks'],
    a:{x:5,y:4},b:{x:5,y:6}}],view:{scale:1},clock:{day:0},dirty:false
};
const roster=[];
let recallCalls=0,allowRecall=true;
const tactical={
  units:()=>roster,
  areaState:p=>({yellow:p.x<10}),
  recallCampUnit:(unit,p)=>{
    recallCalls++;
    if(!allowRecall)return false;
    unit.target=p;unit.path=[{x:unit.x,y:unit.y},p];return true;
  },
  changedCamp(){saveCalls++},clearCampSelection(){}
};
const win={__CONQUER_CAMP_MODE__:true,ConquerCombat:tactical};
const noop=()=>{};
const context={
  window:win,document,State:state,visualCycleFrac:()=>cycle,VISUAL_DAYLIGHT_RATIO:2/3,
  underConstruction:()=>false,functionSlotUnits:()=>1,pointBlockedForPeasant:()=>false,
  WORLD:200,uid:()=>String(++id),status:noop,draw:noop,scheduleLocalSave:()=>saveCalls++,
  terrainElevation:()=>0,w2sRaw:(p,z)=>({x:p.x,y:p.y-z}),
  withRenderContext:(_g,callback)=>callback(),
  drawBrazierFixture:()=>fixtures++,drawScreenFlame:()=>flames++,
  clamp:(n,min,max)=>Math.max(min,Math.min(max,n))
};
vm.runInNewContext(source,vm.createContext(context),{filename:'settlement-camp.js'});
const camp=win.ConquerCamp;
assert.ok(camp,'camp module is active only in /camp');
assert.equal(camp.barracks().length,1,'one button/roster per real barracks room');
for(let n=0;n<4;n++)camp.addSquad('barracks-1:0');
assert.equal(roster.length,3,'16 soldiers cap supports three squads of five');
const troop=roster[0];
troop.x=8;troop.y=8;cycle=.8;camp.synchronize();
assert.equal(troop.campState,'returning','yellow zone returns via combat navigation');
assert.ok(troop.target,'return uses a real navigable destination');
const home=troop.target;troop.x=home.x;troop.y=home.y;troop.target=null;
camp.synchronize();
assert.equal(troop.campState,'barracks','arrived squad sleeps inside');
cycle=.3;camp.synchronize();
assert.equal(troop.campState,null,'squad becomes active at daybreak');
troop.x=26;troop.y=30;cycle=.8;camp.synchronize();
assert.equal(troop.campState,'camped','outside yellow builds camp in place');
assert.equal(troop.target,null,'camp cancels outdoor movement');
const screen={
  beginPath:noop,moveTo:noop,lineTo:noop,closePath:noop,fill:noop,stroke:noop,
  arc:noop,save:noop,restore:noop,createRadialGradient:()=>({addColorStop:noop})
};
camp.drawEncampments(screen);
assert.equal(fixtures,1,'each camped troop gets a tower-style brazier');
assert.equal(flames,1,'each camped troop gets one brazier flame');
cycle=.3;camp.synchronize();
assert.equal(troop.campState,null,'campers return to normal visibility at dawn');
troop.x=8;troop.y=8;allowRecall=false;cycle=.8;camp.synchronize();
assert.equal(troop.campState,'stationed','blocked indoor path does not teleport');
const calls=recallCalls;camp.synchronize();
assert.equal(recallCalls,calls,'blocked path is not recalculated every frame');
cycle=.3;camp.synchronize();
camp.removeSquad('barracks-1:0');
assert.equal(roster.length,2,'troop decrement updates roster');
console.log('CAMP regression passed (barracks, night return, tents/brazier, blocked route, dawn, roster)');
