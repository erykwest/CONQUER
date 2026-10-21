'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const base=path.join(__dirname,'..','src');
const combat=fs.readFileSync(path.join(base,'settlement-combat.js'),'utf8');
const siege=fs.readFileSync(path.join(base,'settlement-siege.js'),'utf8');
const rules=fs.readFileSync(path.join(base,'settlement-combat-rules.js'),'utf8');
assert.match(combat,/kind:'captain'/,'initial commander must be called captain');
assert.match(combat,/combat-recruited-knight-/,'recruited knights need a separate identity');
assert.match(combat,/function recruitKnight\(/);
assert.match(combat,/u\.kind==='captain'&&!u\.defeated/,'captain owns command beacon');
assert.match(rules,/captain:Object\.freeze/);
assert.match(siege,/stables:\{horses:5\}/);
assert.match(siege,/nobleRoom:\{knights:1\}/);
assert.match(siege,/fn==='stables'\|\|fn==='nobleRoom'/,'castle slot size must not multiply these capacities');

function fixture(){
  const nodes=new Map();
  const el=id=>{
    if(!nodes.has(id))nodes.set(id,{
      id,hidden:true,style:{},dataset:{},innerHTML:'',textContent:'',
      addEventListener(type,fn){this.handlers??={};this.handlers[type]=fn},
      matches(){return false},closest(){return null}
    });
    return nodes.get(id);
  };
  const document={getElementById:el,createElement:()=>({id:'',innerHTML:''})};
  const tower={id:'mastio',type:'tower',x:98,y:102};
  const entry={edge:'north',x:100,y:0};
  const State={clock:{day:0,speed:1},diplomacy:null,seed:12,
    village:{founded:true,borderEntries:[entry]},
    structures:[tower,{type:'well',x:100,y:100}],
    resources:{gold:1000,food:1000,stone:100,wood:100,metal:100,equipment:100}
  };
  const window={draw(){},ConquerSiege:{mastio:()=>tower},
    ConquerKnightModels:null,ConquerLOD:{militaryTier:()=>'dot'}};
  const ctx={window,document,State,wrap:{appendChild(){}},WORLD:200,
    dist:(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),
    markDirty(){},calendarDateFromDay:d=>({day:Math.floor(d)%30+1,name:'Mese',year:1}),
    ensureBorderEntrySelection:()=>[entry],roadNetworkPath:(a,b)=>[a,b],
    w2s:p=>p,terrainElevation:()=>0,worldPointVisible:()=>true,
    soldierLivery:()=>null,status(){},underConstruction:()=>false,structureCenter:s=>s,
    console,Math
  };
  vm.runInNewContext(fs.readFileSync(path.join(base,'settlement-diplomacy.js'),'utf8'),ctx);
  return {State,window,api:window.ConquerDiplomacy,el};
}
{
  const {State,api,el}=fixture();
  assert.equal(api.spawn(0),true);
  assert.equal(api.state().incoming.phase,'arriving');
  State.clock.day=10;api.tick(0,10);
  assert.equal(api.state().incoming.phase,'waiting');
  api.openLetter();
  assert.equal(el('courierDialog').hidden,false);
  el('courierAccept').onclick();
  assert.equal(api.state().caravans.length,1);
  assert.equal(el('caravanDialog').hidden,false);
  let caravan=api.state().caravans[0];
  assert.equal(caravan.cargo.gold,100);
  assert.equal(caravan.status,'draft');
  el('caravanDialog').handlers.click({target:{closest:x=>x==='#caravanConfirm'?{}:null}});
  assert.equal(caravan.status,'planned');
  State.clock.day=caravan.departDay;api.tick(10,State.clock.day);
  assert.equal(caravan.status,'outbound');
  assert.equal(State.resources.gold,900);
  assert.ok(State.resources.food<1000,'provisions consumed at departure');
  const food=State.resources.food,gold=State.resources.gold;
  State.clock.day=caravan.returnDay+1;api.tick(caravan.actualDepartDay,State.clock.day);
  assert.equal(caravan.status,'completed');
  assert.equal(State.resources.food,food,'return must not double-consume provisions');
  assert.equal(State.resources.gold,gold,'return must not double-charge cargo');
}
{
  const {State,api,el}=fixture();
  api.spawn(0);State.clock.day=10;api.tick(0,10);
  el('courierRefuse').onclick();
  assert.equal(api.state().caravans.length,0,'refusal must not create a caravan');
  assert.equal(api.state().incoming.phase,'returning');
}
{
  const {State,window,api}=fixture();
  window.ConquerSiege.mastio=()=>null;
  assert.equal(api.spawn(0),false,'no diplomatic messenger before completing a mastio');
}
console.log('Diplomacy/captain/knight regression: PASS');
