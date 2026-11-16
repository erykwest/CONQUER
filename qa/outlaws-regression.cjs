'use strict';
// Outlaws: brigands holding a road (trade cut), a bandit lair with standing
// guards (weekly extortion, stash recovered), raiders plundering outlying
// buildings and fleeing. Runs the real module against a small combat double.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const src=read('src/settlement-outlaws.js');

// ---- wiring --------------------------------------------------------------
const html=read('index.html');
assert.ok(html.indexOf('settlement-combat.js')<html.indexOf('settlement-outlaws.js'),'outlaws load after combat');
assert.match(read('src/settlement-combat.js'),/ConquerOutlaws\?\.tick\(dt\)/,'combat ticks the outlaws');
assert.match(read('src/settlement-combat-render.js'),/ConquerOutlaws\?\.draw\(g/,'combat render draws lair and roadblock');
assert.match(read('src/settlement-commerce.js'),/want\*trade/,'weekly market sales follow the trade factor');
assert.match(read('src/settlement-treasury.js'),/efficiency\('toll'\)\*trade/,'gate toll follows the trade factor');
const rulesCtx=vm.createContext({window:{},Math});
vm.runInContext(read('src/settlement-combat-rules.js'),rulesCtx);
const rules=rulesCtx.window.ConquerCombatRules;
assert.ok(rules.PROFILES.outlaw&&rules.PROFILES.outlawGuard,'outlaw combat profiles');
assert.ok(rules.liveryOf('outlaw'),'outlaws have their own livery');

// ---- world double ----------------------------------------------------------
function world(){
  let enemy=[],outlaws=null,messages=[];
  const units=[];
  const W={x:100,y:100};
  const State={seed:777,clock:{day:0},view:{scale:1},
    village:{founded:true,wellId:'w',
      roadPlan:[{id:'r-n',edge:'north',connected:true}],
      borderEntries:[{id:'e-n',edge:'north',x:100,y:2},{id:'e-e',edge:'east',x:198,y:100},
        {id:'e-s',edge:'south',x:100,y:198},{id:'e-w',edge:'west',x:2,y:100}]},
    environment:[{type:'forest',side:null}],
    structures:[{id:'w',type:'well',x:100,y:100},
      {id:'road-n',type:'road',routeId:'r-n',a:{x:100,y:96},b:{x:100,y:4}},
      {id:'keep',type:'keep',x:104,y:104},
      {id:'farm-far',type:'house',x:100,y:150,name:'Fattoria'},
      {id:'mill',type:'mill',x:140,y:100},
      {id:'home',type:'house',x:106,y:98}]};
  const economy={castleGold:200,castle:{food:60,wood:60,stone:30,metal:10,clay:0}};
  const combat={
    enemy:()=>enemy,units:()=>units,
    areaState:p=>({yellow:Math.hypot(p.x-W.x,p.y-W.y)<14}),
    outlawState:()=>outlaws||(outlaws={version:1,bands:[],nextBandId:1,lastDay:null,schedule:{}}),
    addEnemies:list=>{enemy.push(...list);return true},
    removeEnemies:pred=>{const n=enemy.length;enemy=enemy.filter(e=>!pred(e));return n-enemy.length},
    groundLegs:(u,goal)=>[{kind:'ground',points:[{x:u.x,y:u.y},{x:goal.x,y:goal.y}]}]
  };
  const win={ConquerCombat:combat,ConquerEconomy:{state:()=>economy,syncBuilderResources:()=>{}}};
  const ctx=vm.createContext({window:win,Math,Map,Set,Array,Number,Object,String,JSON,console,State,WORLD:200,
    peasantHash:id=>[...String(id)].reduce((h,c)=>(Math.imul(h,33)+c.charCodeAt(0))>>>0,5381),
    pointBlockedForPeasant:()=>false,terrainSegmentCrossesCliff:()=>false,
    // The wood: everything north-east of the village.
    environmentContains:(f,p)=>f.type==='forest'&&p.x>110&&p.y<90,
    underConstruction:()=>false,status:t=>messages.push(t),performance:{now:()=>0}});
  vm.runInContext(src,ctx,{filename:'settlement-outlaws.js'});
  // Walk every enemy along its legs (the combat module does this in the game).
  function step(dt,speed=.8){
    for(const e of enemy){
      if(!e.legs?.length||e.defeated)continue;
      const goal=e.legs[0].points.at(-1),d=Math.hypot(goal.x-e.x,goal.y-e.y),s=Math.min(d,dt*speed);
      if(d<.02){e.legs=null;continue}
      e.x+=(goal.x-e.x)/d*s;e.y+=(goal.y-e.y)/d*s;
    }
  }
  function run(seconds,dt=.25){for(let t=0;t<seconds;t+=dt){win.ConquerOutlaws.tick(dt);step(dt)}}
  return{api:win.ConquerOutlaws,State,economy,units,messages,run,enemy:()=>enemy,state:()=>outlaws};
}

// ---- brigands --------------------------------------------------------------
{
  const w=world(),api=w.api;
  api.setEnabled(false);
  assert.equal(api.tradeFactor(),1,'no brigands, full trade');
  const band=api.spawn('brigands');
  assert.ok(band,'brigands spawn');
  assert.equal(band.edge,'north','they hold the road that has a route to the border');
  assert.equal(band.post.x,100,'their post lies on that road');
  assert.ok(Math.hypot(band.post.x-100,band.post.y-100)>=25,'well away from the village');
  const men=w.enemy().filter(e=>e.outlawBand===band.id);
  assert.ok(men.length>=4&&men.length<=6,'a band of 4-6');
  assert.ok(men.every(e=>e.faction==='outlaw'&&e.kind==='outlaw'&&!e.neutral));
  assert.equal(api.spawn('brigands'),null,'one band of a kind at a time');
  assert.ok(Math.abs(api.tradeFactor()-.6)<1e-9,'a held road cuts trade by 40%');
  // A soldier far off is ignored; one who comes near is attacked.
  w.units.push({id:'sq',kind:'squad',x:band.post.x+20,y:band.post.y});
  w.run(2);
  assert.ok(men.every(e=>!e.legs),'brigands stay at their post');
  w.units[0].x=band.post.x+4;
  w.run(.5);
  assert.ok(men.some(e=>e.legs?.length),'brigands go for a soldier who approaches');
  for(const e of men)e.defeated=true;
  w.run(.5);
  assert.equal(api.tradeFactor(),1,'killing the brigands frees the road');
  assert.ok(w.messages.some(m=>/liberata/.test(m)));
  assert.ok(w.state().schedule.brigands>w.State.clock.day,'next band scheduled later');
}

// ---- bandit lair -------------------------------------------------------------
{
  const w=world(),api=w.api;
  api.setEnabled(false);
  const band=api.spawn('bandits');
  assert.ok(band,'a lair is pitched');
  assert.ok(band.center.x>110&&band.center.y<90,'in the wood '+JSON.stringify(band.center));
  assert.ok(band.tents.length>=3,'with several tents');
  const guards=w.enemy().filter(e=>e.outlawBand===band.id);
  assert.ok(guards.length>=4&&guards.every(g=>g.outlawRole==='guard'&&g.combatKind==='outlawGuard'&&g.post),
    'standing guards, each at a post');
  // A week passes: the lair extorts a toll from the castle.
  const gold0=w.economy.castleGold;
  w.State.clock.day+=7;w.run(.25);
  assert.ok(band.stash>0&&w.economy.castleGold===gold0-band.stash,'weekly extortion moves gold into the stash');
  w.State.clock.day+=.5;w.run(.25);
  const stash=band.stash;assert.equal(w.economy.castleGold,gold0-stash,'only once a week');
  // Guards hold their ground; they chase only near the lair.
  w.units.push({id:'kn',kind:'knight',x:band.center.x+30,y:band.center.y});
  w.run(1);
  assert.ok(guards.every(g=>Math.hypot(g.x-g.post.x,g.y-g.post.y)<.5),'guards stay at the tents');
  w.units[0].x=band.center.x+6;
  w.run(.5);
  assert.ok(guards.some(g=>g.legs?.length),'guards attack whoever comes near the lair');
  for(const g of guards)g.defeated=true;
  w.run(.25);
  assert.equal(w.economy.castleGold,gold0,'destroying the lair recovers the stash');
  assert.ok(band.over&&band.outcome==='destroyed');
  w.State.clock.day+=1;w.run(.25);
  assert.equal(w.state().bands.length,0,'the dead are cleared after a while');
  assert.equal(w.enemy().length,0);
}

// ---- raiders -------------------------------------------------------------------
function raid(kill){
  const w=world(),api=w.api;
  api.setEnabled(false);
  const band=api.spawn('raiders',{edge:'south'});
  assert.ok(band,'raiders arrive');
  assert.ok(band.entry.y>190,'from the chosen border');
  const food0=w.economy.castle.food,wood0=w.economy.castle.wood;
  const visited=[];
  for(let i=0;i<4000&&band.phase!=='retreat';i++){
    w.run(.25);
    if(band.targetId&&!visited.includes(band.targetId))visited.push(band.targetId);
  }
  assert.equal(band.phase,'retreat','after plundering they turn back');
  assert.ok(!visited.includes('keep'),'never the castle');
  assert.ok(!visited.includes('home'),'not the buildings in the heart of the village');
  assert.ok(visited.includes('farm-far'),'the outlying farm is plundered');
  assert.equal(band.visited.length,2,'two targets per raid');
  assert.ok(band.lootTotal>0&&w.economy.castle.food+w.economy.castle.wood<food0+wood0,'goods are carried off');
  if(kill){
    for(const e of w.enemy())e.defeated=true;
    w.run(.25);
    assert.equal(w.economy.castle.food,food0,'killing them all recovers the loot');
    assert.ok(band.over&&band.outcome==='destroyed');
  }else{
    for(let i=0;i<4000&&!band.over;i++)w.run(.25);
    assert.ok(band.over&&band.outcome==='escaped','they flee over the border');
    assert.ok(w.economy.castle.food<food0,'escaped raiders keep the loot');
    assert.equal(w.enemy().filter(e=>!e.defeated).length,0,'and leave the map');
  }
}
raid(false);raid(true);

// ---- rout ------------------------------------------------------------------------
{
  const w=world(),api=w.api;
  api.setEnabled(false);
  const band=api.spawn('raiders',{edge:'south'});
  const men=w.enemy();
  for(let i=0;i<Math.ceil(men.length*.6);i++)men[i].defeated=true;
  w.run(.25);
  assert.equal(band.phase,'retreat','heavy losses make raiders flee');
}

// ---- schedule ----------------------------------------------------------------------
{
  const w=world(),api=w.api;
  w.run(.25);
  assert.equal(w.state().bands.length,0,'nothing on the first day');
  const sched=w.state().schedule;
  assert.ok(sched.bandits>=8&&sched.brigands>=14&&sched.raiders>=20,'grace period after founding');
  w.State.clock.day=40;w.run(.25);
  assert.deepEqual(w.state().bands.map(b=>b.type).sort(),['bandits','brigands','raiders'],'all three kinds appear in time');
  api.clear();
  assert.equal(w.enemy().length,0);
}
console.log('PASS outlaws: brigands hold a road and cut trade; bandit lair with guards, weekly toll, stash recovered; raiders plunder outlying buildings, flee or drop the loot; schedule');
