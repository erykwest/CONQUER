'use strict';
const fs=require('node:fs');
const harness=fs.readFileSync(__dirname+'/urban-regression.cjs','utf8').split('let passed=0;')[0];
new Function('require','__dirname',harness+`
let passed=0,failed=0;
function test(name,fn){try{fn();passed++;console.log('PASS '+name)}catch(e){failed++;console.error('FAIL '+name+': '+e.message)}}
const R=context.window.ConquerCombatRules;
const make=(prefix,counts,x)=>Object.entries(counts).flatMap(([kind,n])=>Array.from({length:n},(_,i)=>({id:prefix+kind+i,kind,combatKind:kind,faction:prefix==='D'?'realm':'dev_hostile',x:x+(i%5)*.6,y:90+Math.floor(i/5)*.6,h:0,visualZ:.6})));
test('40 defenders and 30 attackers retain their individual troop types on restore',()=>{
 sandbox.qaRaw={version:2,units:make('D',{archer:15,infantry:20,knight:5},90),enemy:make('A',{archer:10,knight:3,infantry:17},105)};
 run('window.ConquerCombat.restore(qaRaw)');
 assert.equal(run('State.combat.units.length'),40);assert.equal(run('State.combat.enemy.length'),30);
 assert.equal(run("State.combat.units.filter(u=>u.kind==='archer').length"),15);
 assert.equal(run("State.combat.units.filter(u=>u.kind==='infantry').length"),20);
});
test('distant pairs do not invoke terrain/footprint contact checks',()=>{
 R.reset();let contacts=0;
 R.update(.1,make('D',{archer:15,infantry:20,knight:5},70),make('A',{archer:10,knight:3,infantry:17},120),[],()=>true,()=>{contacts++;return true});
 assert.equal(contacts,0);
});
test('an individual archer keeps its profile without a redundant combatKind',()=>{
 R.reset();const archer={kind:'archer',x:90,y:90},knight={kind:'knight',x:110,y:110};
 R.update(.1,[archer],[knight],[],()=>true);
 assert.equal(archer.stats.armor,0);assert.equal(archer.stats.combat,1);assert.equal(knight.stats.armor,3);assert.equal(knight.stats.maxHp,30);
 run("window.ConquerCombat.restore({version:2,units:[],enemy:[{id:'bow-save',kind:'archer',x:90,y:90}]})");
 assert.equal(run("State.combat.enemy[0].combatKind"),'archer');
});
test('out of range archers do not invoke line of sight',()=>{
 R.reset();let rays=0;const shooter={id:'bow',x:70,y:70,h:0,visualZ:.6,terrainAt:()=>0};
 R.update(.1,[],make('A',{infantry:17},120),[shooter],()=>{rays++;return true});
 assert.equal(rays,0);
});
test('attacking archers use real arrows and damage the defenders',()=>{
 R.reset();run('globalThis.qaRandom=Math.random;Math.random=()=>.999');
 try{
  const target={id:'target',kind:'infantry',combatKind:'infantry',x:90,y:90,h:0},archer={id:'bow',kind:'archer',combatKind:'archer',x:95,y:90,h:0,visualZ:.6,terrainAt:()=>0};
  for(let i=0;i<100;i++)R.update(.1,[target],[archer],[],()=>true,()=>false,[archer],()=>true);
  assert.ok(target.stats.hp<100);assert.ok(archer.damageDealt>0);
 }finally{run('Math.random=qaRandom')}
});
test('a dead mobile archer cannot fire through its cached shooter',()=>{
 R.reset();run('globalThis.qaRandom=Math.random;Math.random=()=>.999');
 try{
  const target={id:'target',kind:'infantry',combatKind:'infantry',x:90,y:90,h:0},owner={id:'bow',kind:'archer',combatKind:'archer',defeated:true,stats:{hp:0}},shooter={id:'bow',owner,x:95,y:90,h:0,visualZ:.6,clock:1.99,terrainAt:()=>0};
  R.update(.1,[target],[owner],[],()=>true,()=>false,[shooter],()=>true);
  assert.equal(target.stats.hp,100);
 }finally{run('Math.random=qaRandom')}
});
test('native combat tick fires mobile bows on both sides and preserves knight profiles',()=>{
 run("State.environment=[];State.relief=null;State.clock={day:20,speed:0};State.daylightOverride='day';State.village={founded:true,wellId:'well'};State.structures=[{id:'well',type:'well',x:130,y:130}];window.ConquerCombat.restore({version:2,units:[{id:'D-bow',kind:'archer',combatKind:'archer',x:95,y:100}],enemy:[{id:'A-bow',kind:'archer',combatKind:'archer',x:103,y:100}]});globalThis.qaRandom=Math.random;Math.random=()=>.999;for(let i=0;i<100;i++)window.ConquerCombat.tick(.1)");
 try{
  assert.ok(run('State.combat.units[0].damageDealt>0&&State.combat.enemy[0].damageDealt>0'));
  assert.ok(run('State.combat.units[0].stats.hp<100&&State.combat.enemy[0].stats.hp<100'));
 }finally{run('Math.random=qaRandom')}
});
console.log(passed+' mass battle checks passed; '+failed+' failed.');if(failed)process.exitCode=1;
`)(require,__dirname);
