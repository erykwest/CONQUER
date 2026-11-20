'use strict';
// PATROL-ROUTE-261118: a White Zone patrol keeps its round while a hostile it cannot reach stands
// within its reach. Since the defenders' seeking (#258) a failed route to the foe cleared the
// patrol's own loop target at every think, so updatePatrols skipped to the next waypoint again
// and again: the patrol left its route and cut across the loop. A foe it can reach is still
// pursued.
const fs=require('node:fs');
const harness=fs.readFileSync(__dirname+'/urban-regression.cjs','utf8').split('let passed=0;')[0];
new Function('require','__dirname',harness+`
if(typeof ConquerUtil==='undefined'&&!sandbox.window?.ConquerUtil)run(fs.readFileSync(__dirname+'/../src/settlement-util.js','utf8'));
let passed=0,failed=0;
function test(name,fn){try{fn();passed++;console.log('PASS '+name)}catch(e){failed++;console.error('FAIL '+name+': '+e.message)}}
let T=1e6;sandbox.performance={now:()=>(T+=.0005)};
const house=(id,x,y)=>({id,type:'house',x,y,w:3,h:3,angle:0,level:1});
const wall=(id,a,b)=>({id,type:'wall',a,b,width:.6,level:2,tier:2,material:'stone',length:Math.hypot(b.x-a.x,b.y-a.y)});
const foe=(x,y)=>({id:'f1',kind:'infantry',combatKind:'infantry',faction:'dev_hostile',x,y,digging:'qa'});
function walk(enemy,ticks){
  sandbox.qaS=[{id:'well',type:'well',x:150,y:150},house('h1',165,150),house('h2',150,166),house('h3',136,140),wall('w1',{x:160,y:132},{x:170,y:140})];
  sandbox.qaU=[{id:'pt',kind:'patrol',combatKind:'patrol',faction:'realm',x:150,y:153,patrolDirection:1}];
  sandbox.qaE=enemy;
  run("State.environment=[];State.relief=null;State.clock={day:20.45,speed:1};State.daylightOverride='day';State.village={founded:true,wellId:'well'};State.structures=qaS;window.ConquerSiege?.restore?.(null);window.ConquerCombatRules.reset();window.__conquerPerf={};window.ConquerCombat.restore({version:2,fog:false,zones:false,units:qaU,enemy:qaE,storms:[],strokes:[]});invalidateNavigation()");
  let last=null,abandoned=0,reached=0,chased=0;const trail=[];
  for(let i=0;i<ticks;i++){
    T+=100;run('window.ConquerCombat.tick(.1)');
    const u=run("State.combat.units.find(u=>u.id==='pt')");
    if(u.autoFoe)chased++;
    if(last&&!last.foe&&(!u.target||Math.hypot(u.target.x-last.x,u.target.y-last.y)>.01)){
      if(Math.hypot(u.x-last.x,u.y-last.y)>.3)abandoned++;else reached++;
    }
    last=u.target?{x:u.target.x,y:u.target.y,foe:!!u.autoFoe}:null;
    trail.push({x:u.x,y:u.y});
  }
  return{abandoned,reached,chased,trail};
}
const TICKS=500;
const plain=walk([],TICKS);
test('without hostiles the patrol reaches each waypoint of its round',()=>{
  assert.ok(plain.reached>=10,'waypoints reached: '+plain.reached);
  assert.equal(plain.abandoned,0,'no waypoint is dropped');
});
test('a hostile it cannot reach (against a house) does not make the patrol leave its round',()=>{
  // The raider stands inside the house footprint: no route reaches him, yet he is in reach (12U).
  const r=walk([foe(165,150)],TICKS);
  assert.equal(r.abandoned,0,'waypoints dropped while the foe stood in reach: '+r.abandoned);
  assert.equal(r.chased,0,'no pursuit of an unreachable foe');
  const off=Math.max(...r.trail.map((p,i)=>Math.hypot(p.x-plain.trail[i].x,p.y-plain.trail[i].y)));
  assert.ok(off<.05,'the patrol walks the same round as with no hostile (max deviation '+off.toFixed(2)+'U)');
});
test('a hostile it can reach inside the White Zone is still pursued',()=>{
  const r=walk([foe(158,158)],120);
  assert.ok(r.chased>0,'the patrol goes for a reachable foe within reach');
});
console.log(passed+' patrol route checks passed; '+failed+' failed.');if(failed)process.exitCode=1;
`)(require,__dirname);
