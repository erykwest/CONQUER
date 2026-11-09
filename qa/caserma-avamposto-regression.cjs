'use strict';
// MIL-RES-01 (D-MIL-RES-261109): the Barracks hold one reserve of enlisted L1 soldiers, paid an L2 wage,
// spent by outposts (4 men + 1 horse), lookouts (1 man: a tower watches only with one) and patrols
// (2 men). Lookouts and patrols raise the alarm themselves; an outpost warns the castle through bells and
// signal fires (3x a bell's reach, burnt once) and always sends a mounted relay. The castle guard post
// merged into the Barracks and stays only in the town hall.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const root=__dirname+'/../';
const src=name=>fs.readFileSync(root+'src/'+name,'utf8');
let passed=0;
function check(name,body){body();passed++;console.log('PASS '+name)}

function world({gold=500,posts=16,horses=3,enlistable=20,wells=[{x:100,y:100}],white=p=>Math.hypot(p.x-100,p.y-100)<=20}={}){
  const ctx={Math,Number,Object,Array,Set,Map,String,JSON,console,isFinite,performance:{now:()=>ctx.now},now:0};
  ctx.window=ctx;
  ctx.State={village:{founded:true},clock:{day:10},view:{scale:10},resources:{gold,wood:100,stone:100},structures:[]};
  const variants=new Map();
  ctx.structureVariant=(s,k)=>s[k]??({topWeapon:'none',signalFire:'none',roofStyle:'battlement'}[k]);
  ctx.setStructureVariant=(s,k,v)=>{if(s[k]===v)return false;s[k]=v;return true};
  ctx.underConstruction=s=>!!s.building;
  ctx.isWoodTower=s=>s.material==='wood';
  ctx.towerRoofStyle=s=>s.roofStyle||'battlement';
  ctx.structureLevel=s=>s.level||1;
  ctx.structureHeight=s=>s.level||1;
  ctx.canAfford=cost=>Object.entries(cost).every(([k,v])=>(ctx.State.resources[k]||0)>=v);
  ctx.spendCost=cost=>{for(const [k,v] of Object.entries(cost))ctx.State.resources[k]-=v};
  ctx.status=t=>{ctx.lastStatus=t};
  const siege={stock:{horses},soldiers:{enlisted:0,paid:true,expedition:0}};
  ctx.ConquerSiege={state:()=>siege,capacity:()=>({soldiers:posts}),archerSlots:()=>[]};
  const econ={castleGold:gold,wage:{L1:1,L2:2,L3:3},wallet:{L1:0,L2:0}};
  ctx.ConquerEconomy={state:()=>econ,laborAllocation:()=>({enlistable}),syncBuilderResources(){}};
  const units=[],enemy=[];let alarm='off';
  ctx.ConquerCombat={units:()=>units,enemy:()=>enemy,areaState:p=>({allowed:white(p)}),alarmMode:()=>alarm,
    setAlarmMode:m=>{alarm=m;return true},withdrawPatrols:n=>{let k=0;while(k<n&&units.some(u=>u.kind==='patrol')){units.splice(units.findLastIndex(u=>u.kind==='patrol'),1);k++}return k}};
  ctx.ConquerAlarmBells={TOWER_RADIUS:[10,13,16],HOP:.6,bells:()=>ctx.State.structures.filter(s=>s.bell==='bell').map(s=>({id:s.id,x:s.x,y:s.y,r:13})),
    origin:()=>({id:'keep',x:wells[0].x,y:wells[0].y})};
  vm.createContext(ctx);vm.runInContext(src('settlement-soldiers.js'),ctx);
  return{M:ctx.ConquerSoldiers,ctx,siege,econ,units,enemy,alarm:()=>alarm,setAlarm:m=>{alarm=m}};
}
const tower=(id,x,y,extra={})=>({id,type:'tower',shape:'square',size:1.5,level:2,x,y,material:'stone',...extra});
const patrol=id=>({id,kind:'patrol',x:100,y:100});

check('enlisting: 15 gold each, up to the Barracks posts and the L1 men free to join',()=>{
  const {M,ctx,siege}=world({posts:2,enlistable:1});
  assert.equal(M.posts(),2);
  assert.ok(M.recruit(),'first soldier enlisted');
  assert.equal(siege.soldiers.enlisted,1);assert.equal(ctx.State.resources.gold,485,'15 gold spent');
  assert.ok(!M.recruit(),'no L1 man left to enlist');
  const rich=world({posts:1});rich.M.recruit();
  assert.ok(!rich.M.recruit(),'Barracks full');
  const poor=world({gold:10});assert.ok(!poor.M.recruit(),'not enough gold');
  assert.ok(M.dismiss()&&siege.soldiers.enlisted===0,'a free soldier goes back to L1 work');
});

check('the reserve covers outposts (4 men + 1 horse), then lookouts (1), then patrols (2)',()=>{
  const {M,ctx,siege,units}=world();
  siege.soldiers.enlisted=7;
  const out=tower('o',150,150,{outpost:{readyDay:5}}),look=tower('l',105,100,{lookout:true}),plain=tower('p',95,100);
  ctx.State.structures.push(out,look,plain);
  units.push(patrol('a'),patrol('b'));
  const r=M.roster();
  assert.ok(r.outposts.get('o').active,'outpost manned first');
  assert.ok(r.lookouts.has('l'),'then the lookout');
  assert.equal(r.patrolsCovered,1,'two men left: one patrol of two');
  assert.equal(r.free,0);
  assert.ok(M.towerWatches(out)&&M.towerWatches(look)&&!M.towerWatches(plain),'a tower without a lookout does not watch');
  assert.equal(M.horsesHeld(),1,'the outpost holds its relay horse');
  M.frame(.1);
  assert.equal(units.length,1,'the uncovered patrol goes back to the Barracks');
});

check('an outpost needs an isolated tower outside the White Zone, and is ready after 4 days',()=>{
  const {M,ctx}=world();
  const inside=tower('in',105,100),far=tower('far',150,150),wall={id:'w',type:'wall',a:{x:150.5,y:150},b:{x:160,y:150}};
  ctx.State.structures.push(inside,far);
  assert.match(M.outpostBlocker(inside),/White Zone/);
  assert.equal(M.outpostBlocker(far),'');
  ctx.State.structures.push(wall);assert.match(M.outpostBlocker(far),/isolated/,'a wall touching it');
  ctx.State.structures.pop();
  const gold=ctx.State.resources.gold;
  assert.ok(M.setOutpost('far',true));
  assert.equal(ctx.State.resources.gold,gold-60,'60 gold, 40 stone, 20 wood');
  assert.equal(far.outpost.readyDay,14);
  assert.ok(!M.outpostReady(far));ctx.State.clock.day=14;assert.ok(M.outpostReady(far));
});

check('wages: an L2 wage per soldier from the castle gold; unpaid soldiers do no duty',()=>{
  const {M,ctx,siege,econ}=world({gold:100});
  siege.soldiers.enlisted=5;ctx.State.structures.push(tower('l',105,100,{lookout:true}));
  M.tick(1,2);
  assert.equal(econ.castleGold,100-5*2/20,'5 soldiers x L2 2/20 a day');
  assert.ok(M.paid()&&M.onDuty()===5);
  econ.castleGold=0;M.tick(2,3);
  assert.ok(!M.paid()&&M.onDuty()===0,'unpaid');
  assert.ok(!M.towerWatches(ctx.State.structures[0]),'the lookout stands down');
  siege.soldiers.enlisted=40;M.tick(3,4);
  assert.equal(siege.soldiers.enlisted,16,'posts lost: the extra soldiers are discharged');
});

check('lookouts and patrols raise the alarm themselves, once per incursion',()=>{
  const {M,ctx,siege,units,enemy,alarm,setAlarm}=world();
  siege.soldiers.enlisted=3;const look=tower('l',105,100,{lookout:true});ctx.State.structures.push(look);
  const foe={id:'e1',x:110,y:100};enemy.push(foe);
  M.sighted(foe,[{id:'l'}]);
  assert.equal(alarm(),'green','the lookout raises the green alarm');
  setAlarm('off');M.sighted(foe,[{id:'l'}]);
  assert.equal(alarm(),'off','a released alarm is not raised again for the same intruder');
  M.sighted({id:'wolf',kind:'wolf'},[{id:'l'}]);assert.equal(alarm(),'off','wolves do not ring the bells');
  units.push(patrol('p1'));const foe2={id:'e2',x:120,y:100};enemy.push(foe2);
  M.sighted(foe2,[{id:'p1'}]);assert.equal(alarm(),'green','a patrol raises it too');
  setAlarm('off');M.sighted(foe2,[{id:'plain'}]);assert.equal(alarm(),'off');
  enemy.length=0;M.frame(.1);enemy.push(foe);M.sighted(foe,[{id:'l'}]);
  assert.equal(alarm(),'green','a new incursion raises it again');
});

check('signal fire: flat stone deck without a war engine; 30 wood; reach 3x a bell',()=>{
  const {M,ctx}=world();
  const deck=tower('d',150,150),pitched=tower('p',150,160,{roofStyle:'pitched'}),engine=tower('e',150,170,{topWeapon:'mangonel'});
  ctx.State.structures.push(deck,pitched,engine);
  assert.ok(M.signalFireAllowed(deck)&&!M.signalFireAllowed(pitched)&&!M.signalFireAllowed(engine));
  assert.ok(!M.setSignalFire('p','pyre'));
  assert.ok(M.setSignalFire('d','pyre'));
  assert.equal(ctx.State.resources.wood,70);
  assert.ok(M.pyreReady(deck));assert.equal(M.fireReach(deck),39,'3 x 13U at level 2');
});

check('outpost: the signal runs along fires and bells; a relay rider always rides to the castle',()=>{
  const {M,ctx,siege,alarm}=world();
  siege.soldiers.enlisted=4;
  const out=tower('o',100,160,{outpost:{readyDay:0},signalFire:'pyre'});      // 60U from the keep
  const mid=tower('m',100,125,{signalFire:'pyre'});                           // 35U from the outpost, 25U from the keep
  ctx.State.structures.push(out,mid);
  const plan=M.signalPlan(out);
  assert.ok(plan,'chain reaches the command post');
  assert.equal(plan.path.map(n=>n.id).join(','),'o,m','outpost fire, then the middle fire');
  assert.equal(plan.t,4,'two fires, 2 s each');
  const foe={id:'e',x:100,y:175};ctx.ConquerCombat.enemy().push(foe);
  M.sighted(foe,[{id:'o'}]);
  assert.ok(out.signalFireSpent&&mid.signalFireSpent,'the fires on the way burn');
  assert.equal(M.pending().length,1);assert.equal(M.riders().length,1,'relay rider sent');
  assert.equal(alarm(),'off','not yet');
  ctx.now=4001;M.frame(.01);
  assert.equal(alarm(),'green','the signal reaches the castle');
  assert.ok(!M.pyreReady(out),'a burnt pyre must be rebuilt');
  assert.ok(M.setSignalFire('o','pyre')&&M.pyreReady(out),'rebuilt');
});

check('outpost without signals: only the relay rider, alarm on arrival',()=>{
  const {M,ctx,siege,alarm}=world();
  siege.soldiers.enlisted=4;
  const out=tower('o',100,160,{outpost:{readyDay:0}});ctx.State.structures.push(out);
  assert.equal(M.signalPlan(out),null,'no bell or fire on the outpost');
  const foe={id:'e',x:100,y:175};ctx.ConquerCombat.enemy().push(foe);
  M.sighted(foe,[{id:'o'}]);
  assert.equal(M.riders().length,1);
  M.sighted(foe,[{id:'o'}]);assert.equal(M.riders().length,1,'one rider per incursion');
  for(let i=0;i<100&&alarm()==='off';i++)M.frame(.25);
  assert.equal(alarm(),'green','the rider reached the castle');
  assert.equal(M.riders().length,0);
});

check('expeditions reserve soldiers from the same pool and give them back',()=>{
  const {M,siege}=world();siege.soldiers.enlisted=6;
  assert.ok(M.reserveExpedition(4));assert.equal(M.free(),2);
  assert.ok(!M.reserveExpedition(3),'not more than the free soldiers');
  assert.equal(M.releaseExpedition(4,1),4);assert.equal(siege.soldiers.enlisted,5,'one fell');assert.equal(M.free(),5);
});

check('wired into the game: rooms, economy, combat, inspector, pages, Lab, Italian labels',()=>{
  const core=src('settlement-core.js'),siege=src('settlement-siege.js'),combat=src('settlement-combat.js');
  const catalog=JSON.parse(core.match(/const FUNCTION_CATALOG=(\[[^\n]+\]);/)[1].replace(/'/g,'"'));
  assert.ok(!catalog.includes('guard'),'no guard post in the castle catalogue');
  assert.match(core,/TOWNHALL_FUNCTION_CATALOG=Object\.freeze\(\['council','tribunal','guard','prison'\]\)/,'the town hall keeps its guard');
  assert.match(core,/signalFire:Object\.freeze\(\['none','pyre'\]\)/);
  assert.match(siege,/fn==='council'\|\|fn==='tribunal'\|\|fn==='guard'/);
  assert.match(siege,/soldiers:soldierState\(raw\.soldiers\)/,'the reserve is saved with the siege state');
  assert.match(siege,/window\.ConquerSoldiers\?\.tick\(/);
  assert.match(src('settlement-economy.js'),/const soldiers=l1Available\.splice\(0,Math\.min\(enlistable,window\.ConquerSoldiers\?\.enlisted\?\.\(\)\|\|0\)\)/,'enlisted men leave L1 work');
  assert.match(combat,/soldiers&&!soldiers\.towerWatches\(tower\)/,'towers watch only with a lookout');
  assert.match(combat,/soldiers\.sighted\(intruder,seers\)/);
  assert.match(combat,/window\.ConquerSoldiers\?\.frame\(dt\)/);
  assert.match(combat,/id="combatRecruit"/);assert.match(combat,/id="combatRoundAdd"/);
  assert.match(combat,/function townRoundPoints\(/);
  const cmds=src('settlement-structure-commands.js');
  for(const c of ['setTowerLookout','setTowerOutpost','setTowerSignalFire'])assert.match(cmds,new RegExp(c+','),c+' exported');
  assert.match(src('settlement-room-exterior.js'),/signalFire:Object\.freeze\(\{upgrade:Object\.freeze\(\{variant:'signalFire',value:'pyre'\}\),model:'pyre',source:'ConquerPyreModels',mount:'deck'/);
  const it=src('ui/i18n-it.js');
  for(const k of ["lookout: 'Vedetta'","outpost: 'Avamposto'","signalFire: 'Fuoco di segnalazione'","pyre: 'Pira · 30 legno'"])assert.ok(it.includes(k),k);
  const html=fs.readFileSync(root+'index.html','utf8');
  const a=html.indexOf('settlement-siege.js'),b=html.indexOf('settlement-soldiers.js'),c=html.indexOf('settlement-combat.js');
  assert.ok(a>0&&b>a&&c>b,'index.html loads the reserve after the siege and before combat');
  assert.ok(html.includes('assets/pyre-models.js')&&fs.readFileSync(root+'figures-lab.html','utf8').includes('assets/pyre-models.js'),'pyre model in game and Lab');
  assert.match(src('asset-catalog.js'),/global:'ConquerPyreModels'/,'pyre listed in the Asset Lab catalogue');
  const m={};new Function('window',src('assets/pyre-models.js'))(m);
  const pyre=m.ConquerPyreModels.models.pyre;
  assert.equal(Object.keys(pyre.parts).join(','),'hearth,logs,brush');
  assert.ok(m.ConquerPyreModels.height>.4&&m.ConquerPyreModels.height<.7,'a pyre about 1.8 m tall');
});
console.log('caserma-avamposto regression: '+passed+' checks');
