'use strict';
// Infirmary: a room of built sections only (W1 floors 1-2, W2 hall), never towers or gates.
// Daily care while its staff is paid: fallen squads inside Yellow are admitted (deterministic
// 60% survival), return after 3 days at half health; living wounded heal 25%/day in free beds;
// staffed spare beds give L1/L2 a weekly happiness point. No pay, no care.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const src=name=>fs.readFileSync(__dirname+'/../src/'+name,'utf8');
const siege=src('settlement-siege.js'),castle=src('settlement-castle-placement.js');
const pick=(text,name)=>{
  const at=text.search(new RegExp('\\n[ ]*function '+name+'\\('));assert.ok(at>=0,name);
  const indent=text.slice(at+1).match(/^[ ]*/)[0],end=text.indexOf('\n'+indent+'function ',at+1);
  return text.slice(at+1,end<0?undefined:end);
};
let passed=0;
function check(name,body){body();passed++;console.log('PASS '+name)}

// ---------- placement: the genuine allowed() of settlement-siege.js
const rules=vm.createContext({
  underConstruction:s=>!!s.building,structureLevel:s=>s.level||1,
  towerTier:s=>Number(s.size)>=2?3:Number(s.size)>=1.5?2:1,
  builtInteriorFloors:s=>s.span==='wide'?1:(s.level||1),
});
vm.runInContext([pick(castle,'functionCapacity'),pick(siege,'eligibleRoom'),pick(siege,'floor'),pick(siege,'allowed')].join('\n'),rules);
const allowed=vm.runInContext('allowed',rules);
check('infirmary on floors 1-2 of W1 sections and in the W2 hall only',()=>{
  const w1={type:'built',length:3,level:3},w2={type:'built',span:'wide',length:3,level:2};
  assert.ok(allowed(w1,0,'infirmary')&&allowed(w1,1,'infirmary'),'W1 ground and first floor');
  assert.ok(!allowed(w1,2,'infirmary'),'not on the W1 third floor');
  assert.ok(allowed(w2,0,'infirmary'),'W2 wide hall');
  assert.ok(!allowed({...w1,building:true},0,'infirmary'),'not while under construction');
  for(let i=0;i<3;i++)assert.ok(!allowed({type:'tower',size:2,level:3},i,'infirmary'),'no tower infirmary');
  for(let i=0;i<2;i++)assert.ok(!allowed({type:'gate',level:3},i,'infirmary'),'no gate infirmary');
  assert.ok(allowed({type:'built',length:3,level:1},0,'kitchen'),'kitchen rule untouched');
});

// ---------- simulation: the real module with a small world
function world({gold=100,founded=true}={}){
  const ctx={Math,Number,Object,Array,Set,Map,String,JSON,console};
  ctx.window=ctx;
  ctx.State={village:{founded},dirty:false,structures:[
    {id:'w1',type:'built',length:2.5,level:2,a:{x:0,y:0},b:{x:2.5,y:0},functions:['infirmary',null]},
  ]};
  ctx.underConstruction=s=>!!s.building;
  ctx.functionSlotUnits=s=>s.span==='wide'||s.length>=3?2:1;
  ctx.pointBlockedForPeasant=()=>false;
  ctx.ConquerSiege={allowed,state:()=>({circle:{capturedRoomIds:[]}}),civilians:()=>0};
  const roster=[];
  ctx.ConquerCombat={units:()=>roster,areaState:p=>({yellow:p.x<50})};
  ctx.ConquerCombatRules={MAX_E:150,MAX_B:150};
  const econ={castleGold:gold,wage:{L1:1,L2:2,L3:3},wallet:{L1:0,L3:0}};
  ctx.ConquerEconomy={state:()=>econ,population:()=>({L1:30,L2:10,L3:0,L4:0}),syncBuilderResources(){}};
  vm.createContext(ctx);vm.runInContext(src('settlement-infirmary.js'),ctx);
  return{I:ctx.ConquerInfirmary,roster,econ,State:ctx.State};
}
const soldier=(id,extra={})=>({id,kind:'squad',x:5,y:5,stats:{hp:100,maxHp:100,brain:150,energy:150,shock:0},...extra});
const fallen=(id,x=5)=>soldier(id,{x,defeated:true,stats:{hp:0,maxHp:100,brain:0,energy:20,shock:3}});
// Unit ids whose deterministic roll survives / dies.
const {I:probe}=world(),ids=Array.from({length:40},(_,i)=>'squad-'+i);
const survivor=ids.find(id=>probe.roll(id)<probe.SURVIVAL),doomed=ids.find(id=>probe.roll(id)>=probe.SURVIVAL);

check('beds and staff wages scale with the room size',()=>{
  const {I,State}=world();
  assert.equal(I.rooms()[0].beds,6,'a normal room has 6 beds');
  assert.equal(I.wagePerDay(),.25,'1 surgeon L3 + 2 attendants L1 = 5 gold/month = .25/day');
  State.structures[0].length=3;
  assert.equal(I.rooms()[0].beds,12,'a large room has 12 beds');
  assert.equal(I.wagePerDay(),.5);
});

check('fallen squads in Yellow are carried in; 60% return after 3 days at half health',()=>{
  const {I,roster,econ}=world();
  roster.push(fallen(survivor),fallen('far-away',80));
  let r=I.tick(10,11);
  assert.ok(r.staffed,'staff paid');
  assert.equal(econ.castleGold,99.75,'one day of wages taken from the castle gold');
  assert.ok(econ.wallet.L3>0&&econ.wallet.L1>0,'wages reach the L3 and L1 wallets');
  assert.ok(roster[0].ward&&roster[0].defeated,'admitted, still out of the line');
  assert.ok(roster[1].lost&&!roster[1].ward,'fallen outside Yellow is lost');
  assert.equal(r.ward,5,'a squad takes 5 beds');
  I.tick(11,12);I.tick(12,13);assert.ok(roster[0].defeated,'still in the ward on day 13');
  r=I.tick(13,14);
  assert.equal(r.discharged,1);
  const u=roster[0];
  assert.ok(!u.defeated&&!u.ward&&!u.routing,'back on duty');
  assert.equal(u.stats.hp,50,'half health');assert.equal(u.stats.brain,150,'morale restored');
  assert.ok(Math.abs(u.x-1.25)<1e-9&&Math.abs(Math.abs(u.y)-1.7)<1e-9,'discharged at the infirmary door');
});

check('the survival roll is deterministic and a full ward turns the next squad away',()=>{
  const {I,roster}=world();
  roster.push(fallen(doomed));I.tick(1,2);
  assert.ok(roster[0].lost&&!roster[0].ward,'the doomed roll dies of the wounds');
  const second=ids.filter(id=>probe.roll(id)<probe.SURVIVAL)[1];
  roster.push(fallen(survivor),fallen(second));I.tick(2,3);
  assert.ok(roster[1].ward&&!roster[2].ward&&!roster[2].lost,'6 beds: one squad in, the other waits');
  I.tick(3,4.5);
  assert.ok(roster[2].lost,'untreated beyond the triage day: lost');
});

check('no pay, no care: nobody admitted, healed or discharged; ward days are frozen',()=>{
  const {I,roster,econ}=world({gold:0});
  const hurt=soldier('hurt');hurt.stats.hp=40;roster.push(fallen(survivor),hurt);
  const r=I.tick(1,1.5);
  assert.ok(!r.staffed&&!roster[0].ward&&hurt.stats.hp===40,'nothing happens');
  econ.castleGold=10;I.tick(1.5,2);const until=roster[0].ward.until;
  econ.castleGold=0;I.tick(2,3);
  assert.equal(roster[0].ward.until,until+1,'unpaid day does not count');
  const {I:I2,roster:r2}=world({founded:false});r2.push(fallen(survivor));
  assert.ok(!I2.tick(1,2).staffed&&!r2[0].ward,'no settlement treasury, no staff');
});

check('living wounded heal 25% a day in free beds, worst first; engaged troops do not',()=>{
  const {I,roster}=world();
  const a=soldier('a'),b=soldier('b'),c=soldier('c',{engaged:true});
  a.stats.hp=30;b.stats.hp=60;c.stats.hp=10;roster.push(a,b,c);
  const r=I.tick(1,2);
  assert.equal(a.stats.hp,55,'the worst wounded heal first');
  assert.equal(b.stats.hp,60,'6 beds: only one squad of 5 fits');
  assert.equal(c.stats.hp,10,'in combat: no bed');
  assert.equal(r.healing,5);assert.equal(r.free,1);
  I.tick(2,4);assert.equal(a.stats.hp,100,'never above full health');
});

check('a closed infirmary loses its patients',()=>{
  const {I,roster,State}=world();
  roster.push(fallen(survivor));I.tick(1,2);assert.ok(roster[0].ward);
  State.structures[0].functions=[null,null];I.tick(2,3);
  assert.ok(roster[0].lost&&!roster[0].ward&&roster[0].defeated);
});

check('spare staffed beds care for L1/L2: one bed per 40 residents',()=>{
  const {I}=world();
  I.tick(1,2);
  assert.equal(I.status().free,6);
  assert.equal(I.care('L1',50,200),1,'6 beds cover 240 residents');
  assert.equal(I.care('L2',50,200),1);
  assert.equal(I.care('L3',50,200),0,'L3 and L4 are not affected');
  assert.equal(I.care('L1',50,300),0,'too many residents per bed');
  assert.equal(I.care('L1',80,200),0,'no bonus above the cap');
  const {I:poor}=world({gold:0});poor.tick(1,2);
  assert.equal(poor.care('L1',50,10),0,'unpaid staff, no care');
});

check('wired into the game: catalog, siege tick, economy, panel, pages, Italian label',()=>{
  const core=src('settlement-core.js');
  assert.ok(JSON.parse(core.match(/const FUNCTION_CATALOG=(\[[^\n]+\]);/)[1].replace(/'/g,'"')).includes('infirmary'));
  assert.match(core,/infirmary:'Infirmary'/);
  assert.match(pick(siege,'tick'),/window\.ConquerInfirmary\?\.tick\(/);
  assert.match(src('settlement-economy.js'),/ConquerInfirmary\?\.care\(g,e\.happiness\[g\],residents\)/);
  assert.match(src('settlement-app-rooms.js'),/ConquerInfirmary\?\.slotLegend\(s,i\)/);
  assert.match(src('ui/i18n-it.js'),/infirmary: 'Infermeria'/);
  assert.match(src('settlement-cutaway-furniture.js'),/infirmary\(r\)\{/);
  for(const page of ['index.html','camp/index.html']){
    const html=fs.readFileSync(__dirname+'/../'+page,'utf8');
    const a=html.indexOf('settlement-siege.js'),b=html.indexOf('settlement-infirmary.js');
    assert.ok(a>0&&b>a,page+' loads the infirmary after the siege module');
  }
  const m={};new Function('window',fs.readFileSync(__dirname+'/../src/assets/furniture-model.js','utf8'))(m);
  for(const n of ['infirmaryBed','herbShelf','washBasin'])assert.ok(m.ConquerFurnitureModel.pieces[n],n+' modelled');
});
console.log('infirmary regression: '+passed+' checks');
