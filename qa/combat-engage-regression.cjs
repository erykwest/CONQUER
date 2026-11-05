'use strict';
// Defenders and attackers seek each other: an idle defender goes for a hostile within its reach
// and the two fight (damage on both sides); a free attacker goes for the nearest defender; a
// player order is never overridden; nobody seeks a foe behind a closed circuit of walls (no
// route search across it, so the tick stays cheap), and a broken gate opens the way.
const fs=require('node:fs');
const harness=fs.readFileSync(__dirname+'/urban-regression.cjs','utf8').split('let passed=0;')[0];
new Function('require','__dirname',harness+`
run(fs.readFileSync(__dirname+'/../src/settlement-architecture.js','utf8'));   // tower slits and floors
let passed=0,failed=0;
function test(name,fn){try{fn();passed++;console.log('PASS '+name)}catch(e){failed++;console.error('FAIL '+name+': '+e.message)}}
// A simulated clock: +100 ms per tick, and a hair on every read so time-budget loops end.
let T=1e6;sandbox.performance={now:()=>(T+=.0005)};
const tick=n=>{for(let i=0;i<n;i++){T+=100;run('window.ConquerCombat.tick(.1)')}};
const reset=(structures,units,enemy)=>{sandbox.qaS=structures;sandbox.qaU=units;sandbox.qaE=enemy;
  run("State.environment=[];State.relief=null;State.clock={day:20.45,speed:1};State.daylightOverride='day';State.village={founded:true,wellId:'well'};State.structures=[{id:'well',type:'well',x:150,y:150},...qaS];window.ConquerSiege.restore(null);window.ConquerCombatRules.reset();window.ConquerCombat.restore({version:2,fog:false,zones:false,units:qaU,enemy:qaE,storms:[],strokes:[]});invalidateNavigation()")};
const D=(id,kind,x,y,extra={})=>({id,kind,combatKind:kind==='squad'?'spearman':kind,faction:'realm',x,y,...extra});
const A=(id,kind,x,y,extra={})=>({id,kind,combatKind:kind,faction:'dev_hostile',x,y,...extra});
const U=id=>run("State.combat.units.find(u=>u.id==='"+id+"')"),E=id=>run("State.combat.enemy.find(u=>u.id==='"+id+"')");

test('an idle defender closes on a hostile within reach and they fight',()=>{
  reset([],[D('sq','squad',90,100)],[A('a1','infantry',100,100,{digging:'qa'})]);
  tick(150);
  const sq=U('sq'),a1=E('a1');
  assert.ok(Math.hypot(sq.x-a1.x,sq.y-a1.y)<1.2,'in contact: '+Math.hypot(sq.x-a1.x,sq.y-a1.y).toFixed(2));
  tick(200);   // dice: a few rounds of melee (one a second) before the first blow lands
  assert.ok((sq.damageDealt||0)+(a1.damageDealt||0)>0,'blows were exchanged');
});
test('a free attacker goes for the nearest defender',()=>{
  reset([],[D('cap','captain',90,100,{target:{x:90,y:100},path:[{x:90,y:100}],pathIndex:1})],[A('k1','knight',104,100)]);
  run("State.combat.units[0].target=null;State.combat.units[0].path=null");
  tick(120);
  const cap=U('cap'),k1=E('k1');
  assert.ok(Math.hypot(cap.x-k1.x,cap.y-k1.y)<1.2,'the knight reached the captain');
});
test('an attacking archer stops at bow range instead of closing to melee',()=>{
  reset([],[D('cap','captain',90,100)],[A('b1','archer',115,100)]);
  run("State.combat.units[0].nextAutoAt=1e15");   // the captain stays put
  tick(200);
  const d=Math.hypot(U('cap').x-E('b1').x,U('cap').y-E('b1').y);
  assert.ok(d>8&&d<11.5,'standing off at about 10U: '+d.toFixed(2));
});
test('a player order is never overridden by the seeking',()=>{
  reset([],[D('sq','squad',90,100)],[A('a1','infantry',100,100,{digging:'qa'})]);
  run("const u=State.combat.units[0];u.target={x:80,y:100};u.path=[{x:90,y:100},{x:80,y:100}];u.pathIndex=1");
  tick(20);
  assert.ok(U('sq').x<89,'still marching west on the order: '+U('sq').x.toFixed(2));
  assert.equal(U('sq').autoFoe??null,null);
});
// A closed square of walls (towers at the corners, a gate in the north wall).
const ring=()=>{
  const t=(id,x,y)=>({id,type:'tower',shape:'square',size:2,x,y,level:2,material:'stone',angle:0,functions:[]});
  const w=(id,a,b,as,bs)=>({id,type:'wall',a,b,width:.6,level:2,tier:2,material:'stone',aSnap:as,bSnap:bs,length:Math.hypot(b.x-a.x,b.y-a.y)});
  return[t('t0',90,90),t('t1',110,90),t('t2',110,110),t('t3',90,110),
    {id:'g',type:'gate',x:100,y:90,w:2,h:1.4,level:2,material:'stone',angle:-Math.PI/2,functions:[]},
    w('n1',{x:91,y:90},{x:99,y:90},'t0','g'),w('n2',{x:101,y:90},{x:109,y:90},'g','t1'),
    w('e',{x:110,y:91},{x:110,y:109},'t1','t2'),w('s',{x:109,y:110},{x:91,y:110},'t2','t3'),w('w',{x:90,y:109},{x:90,y:91},'t3','t0')];
};
test('nobody seeks a foe behind a closed circuit, and the tick stays cheap',()=>{
  reset(ring(),[D('sq','squad',100,82)],[A('a1','infantry',100,100)]);
  run("window.ConquerSiege.setGateClosed('g',true)");
  const t0=Date.now();tick(30);const ms=Date.now()-t0;
  assert.equal(U('sq').autoFoe??null,null,'the squad does not go for the man inside');
  assert.ok(Math.hypot(U('sq').x-100,U('sq').y-82)<.1,'it stays where it is');
  assert.ok(ms<20000,'no route search across the walls: '+ms+' ms for 30 ticks');
});
test('with the gate broken in, the way is open',()=>{
  reset(ring(),[D('sq','squad',100,82)],[A('a1','infantry',100,100,{digging:'qa'})]);
  run("window.ConquerSiege.setGateClosed('g',false)");
  assert.equal(run("window.ConquerCombat.areaOf({x:100,y:82})===window.ConquerCombat.areaOf({x:100,y:100})"),true,'one area through the open gate');
  tick(30);
  assert.equal(U('sq').autoFoe,'a1','the squad goes in after him');
  tick(250);
  assert.ok(U('sq').y>91,'through the gate passage, inside the walls: y='+U('sq').y.toFixed(2));
});
console.log(passed+' combat engage checks passed; '+failed+' failed.');if(failed)process.exitCode=1;
`)(require,__dirname);
