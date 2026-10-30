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
  const State={clock:{day:0,speed:1},diplomacy:null,seed:12,view:{scale:1},
    village:{founded:true,wellId:'well',foundingWorkers:0,borderEntries:[entry]},policies:{tax:0,rations:'market'},
    structures:[tower,{id:'well',type:'well',x:100,y:100}],
    resources:{gold:1000,food:1000,stone:100,wood:100,metal:100,equipment:100}
  };
  const window={draw(){},ConquerSiege:{mastio:()=>tower,capacity:()=>({soldiers:20})},
    ConquerLOD:{militaryTier:()=>'dot'}};
  const ctx={window,document,State,wrap:{appendChild(){}},WORLD:200,
    dist:(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),
    markDirty(){},calendarDateFromDay:d=>({day:Math.floor(d)%30+1,name:'Mese',year:1}),
    ensureBorderEntrySelection:()=>[entry],roadNetworkPath:(a,b)=>[a,b],
    w2s:p=>p,w2sRaw:p=>p,terrainElevation:()=>0,worldPointVisible:()=>true,
    soldierLivery:()=>null,status(){},underConstruction:()=>false,structureCenter:s=>s,
    console,Math,Number,Object,Array,Set
  };
  vm.createContext(ctx);
  // Caravans are lord convoys: the economy owns castle gold and goods.
  for(const f of ['settlement-economy.js','settlement-urban-economy.js','settlement-market-economy.js',
    'settlement-commerce.js','settlement-convoys.js','settlement-diplomacy.js'])
    vm.runInContext(fs.readFileSync(path.join(base,f),'utf8'),ctx,{filename:f});
  const e=window.ConquerEconomy.state();
  e.castleGold=1000;Object.assign(e.castle,{food:1000,stone:100,wood:100,metal:100,equipment:100});
  return {State,window,api:window.ConquerDiplomacy,el,econ:e,convoys:window.ConquerConvoys};
}
{
  const {State,api,el,econ,convoys}=fixture();
  assert.equal(api.spawn(0),true);
  assert.equal(api.state().incoming.phase,'arriving');
  State.clock.day=10;api.tick(0,10);
  assert.equal(api.state().incoming.phase,'waiting');
  api.openLetter();
  assert.equal(el('courierDialog').hidden,false);
  el('courierAccept').onclick();
  assert.equal(api.caravans().length,1);
  assert.equal(el('caravanDialog').hidden,false);
  let caravan=api.caravans()[0];
  assert.equal(caravan.chest.gold,100);
  assert.equal(caravan.source,'diplomacy');
  assert.equal(caravan.status,'draft');
  assert.equal(convoys.updateLordConvoy(caravan.id,{coinGold:50}),false,'cannot send less than requested');
  assert.equal(convoys.updateLordConvoy(caravan.id,{cargo:[{good:'stone',qty:5}],guards:2}),true);
  el('caravanDialog').handlers.click({target:{closest:x=>x==='#caravanConfirm'?{}:null}});
  assert.equal(caravan.status,'planned');
  State.clock.day=caravan.departDay;api.tick(10,State.clock.day);convoys.tick(10,State.clock.day);
  assert.equal(caravan.status,'outbound');
  assert.equal(econ.castleGold,900,'tribute gold leaves the real castle treasury');
  assert.equal(econ.castle.stone,95);
  assert.ok(econ.castle.food<1000,'provisions consumed at departure');
  const food=econ.castle.food,gold=econ.castleGold;
  State.clock.day=caravan.returnDay+1;convoys.tick(caravan.actualDepartDay,State.clock.day);
  assert.equal(caravan.status,'completed');
  assert.equal(econ.castle.food,food,'return must not double-consume provisions');
  assert.equal(econ.castleGold,gold,'return must not double-charge cargo');
}
{
  // A caravan the castle cannot pay waits blocked, then leaves once stock exists.
  const {State,api,el,econ,convoys}=fixture();
  api.spawn(0);State.clock.day=10;api.tick(0,10);api.openLetter();el('courierAccept').onclick();
  const caravan=api.caravans()[0];econ.castleGold=10;
  convoys.scheduleLordConvoy(caravan.id);
  State.clock.day=caravan.departDay;convoys.tick(10,State.clock.day);
  assert.equal(caravan.status,'blocked');assert.equal(econ.castleGold,10);
  econ.castleGold=500;convoys.tick(State.clock.day,State.clock.day+1);
  assert.equal(caravan.status,'outbound');assert.equal(econ.castleGold,400);
}
{
  // Saves from before the unification: diplomacy caravans move into lord convoys once.
  const {State,api,convoys}=fixture();
  State.diplomacy={version:1,nextEventDay:null,sequence:1,incoming:null,history:[],
    caravans:[{id:'caravan-old',edge:'north',routeDistance:30,cargo:{gold:120,food:0,wood:4},escort:1,departDay:5,status:'planned',requested:100}]};
  const c=convoys.state().lordConvoys['caravan-old'];
  assert.equal(c.status,'planned');assert.equal(c.chest.gold,120);
  assert.deepEqual(JSON.parse(JSON.stringify(c.cargo)),[{good:'wood',qty:4}]);
  assert.equal(State.diplomacy.caravans.length,0);
  assert.equal(api.caravans().length,1);
}
{
  const {State,api,el}=fixture();
  api.spawn(0);State.clock.day=10;api.tick(0,10);
  el('courierRefuse').onclick();
  assert.equal(api.caravans().length,0,'refusal must not create a caravan');
  assert.equal(api.state().incoming.phase,'returning');
}
{
  const {State,window,api}=fixture();
  window.ConquerSiege.mastio=()=>null;
  assert.equal(api.spawn(0),false,'no diplomatic messenger before completing a mastio');
}
{
  // Knights and the messenger ride the 2D horse only: no 3D figure modules in game.
  const diplomacy=fs.readFileSync(path.join(base,'settlement-diplomacy.js'),'utf8');
  const index=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
  for(const [name,src] of [['combat',combat],['diplomacy',diplomacy]]){
    assert.match(src,/ConquerMounted2D/,name+' draws riders with ConquerMounted2D');
    assert.doesNotMatch(src,/ConquerKnights3D|ConquerKnightModels/,name+' must not use 3D knight figures');
  }
  assert.match(index,/settlement-mounted2d\.js/);
  assert.doesNotMatch(index,/settlement-knights3d\.js|knight-models\.js/);
  const {State,window,api}=fixture();
  const calls=[];
  window.ConquerLOD.militaryTier=()=>'full';window.ConquerAnimals={};
  window.ConquerMounted2D={draw:(g,x,y,size,opts)=>calls.push(opts)};
  api.spawn(0);
  api.draw({});
  assert.equal(calls.length,1,'courier drawn once as a 2D rider');
  assert.equal(calls[0].kind,'messenger');
  assert.ok([1,-1].includes(calls[0].facing));
}
console.log('Diplomacy/captain/knight regression: PASS');
