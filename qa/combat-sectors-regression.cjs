'use strict';
// Siege by concentric sectors: the attackers cross the sectors one by one towards the keep
// (through open gates; a ram for a closed one), the defenders fall back inwards when their
// sector falls, opening the inner gate to pass and closing it behind the last one.
// ConquerCircle is replaced by a fixed two-ring snapshot (its own logic has qa/circle-*.test.mjs).
const fs=require('node:fs');
const harness=fs.readFileSync(__dirname+'/urban-regression.cjs','utf8').split('let passed=0;')[0];
new Function('require','__dirname',harness+`
run(fs.readFileSync(__dirname+'/../src/settlement-architecture.js','utf8'));
run(fs.readFileSync(__dirname+'/../src/settlement-wallwalk.js','utf8'));
// The siege-engine models give the ram crews their real posts (4 light, 8 covered).
run(fs.readFileSync(__dirname+'/../src/assets/siege-engines-model.js','utf8'));
run(fs.readFileSync(__dirname+'/../src/settlement-siege-engines3d.js','utf8'));
let passed=0,failed=0;
function test(name,fn){try{fn();passed++;console.log('PASS '+name)}catch(e){failed++;console.error('FAIL '+name+': '+e.message)}}
let T=1e6;sandbox.performance={now:()=>(T+=.0005)};
const tick=n=>{for(let i=0;i<n;i++){T+=100;run('window.ConquerCombat.tick(.1)')}};
// Outer ring 80..120 (gate 'go' in the north wall), inner ring 92..108 (gate 'gi' in its north wall).
const tower=(id,x,y)=>({id,type:'tower',shape:'square',size:2,x,y,level:2,material:'stone',angle:0,functions:[]});
const wall=(id,a,b)=>({id,type:'wall',a,b,width:.6,level:2,tier:2,material:'stone',length:Math.hypot(b.x-a.x,b.y-a.y)});
const gate=(id,x,y)=>({id,type:'gate',x,y,w:2,h:1.4,level:2,material:'stone',roofStyle:'flat',angle:-Math.PI/2,functions:[]});
const ring=(p,lo,hi,g)=>[tower(p+'0',lo,lo),tower(p+'1',hi,lo),tower(p+'2',hi,hi),tower(p+'3',lo,hi),gate(g,(lo+hi)/2,lo),
  wall(p+'n1',{x:lo+1,y:lo},{x:(lo+hi)/2-1,y:lo}),wall(p+'n2',{x:(lo+hi)/2+1,y:lo},{x:hi-1,y:lo}),
  wall(p+'e',{x:hi,y:lo+1},{x:hi,y:hi-1}),wall(p+'s',{x:hi-1,y:hi},{x:lo+1,y:hi}),wall(p+'w',{x:lo,y:hi-1},{x:lo,y:lo+1})];
const inR=(p,lo,hi)=>p.x>lo&&p.x<hi&&p.y>lo&&p.y<hi;
// The stub sector map: states can be changed by the test.
sandbox.qaStates={outer:'secure',inner:'secure'};sandbox.qaBreach=false;
run(\`window.ConquerCircle={invalidate(){},getSnapshot(){
  const inR=(p,lo,hi)=>p.x>lo&&p.x<hi&&p.y>lo&&p.y<hi,open=id=>{const g=State.structures.find(s=>s.id===id);return!window.ConquerSiege.gateClosed(g)};
  return{sectorAt:p=>inR(p,92,108)?'inner':inR(p,80,120)?'outer':null,
    compartments:[{id:'outer',depth:1,mastio:false,breached:qaBreach,state:qaStates.outer,adjacentIds:['inner'],anchors:[0,0,{x:86,y:100}],centroid:{x:86,y:100}},
      {id:'inner',depth:2,mastio:true,state:qaStates.inner,adjacentIds:['outer'],anchors:[0,0,{x:100,y:100}],centroid:{x:100,y:100}}],
    portals:[...(!qaBreach?[{id:'go',from:null,to:'outer',open:open('go')}]:[]),{id:'gi',from:qaBreach?null:'outer',to:'inner',open:open('gi')}]}}}\`);
const reset=(units,enemy,closed=[])=>{sandbox.qaBreach=false;sandbox.qaU=units;sandbox.qaE=enemy;sandbox.qaS=[...ring('o',80,120,'go'),...ring('i',92,108,'gi')];sandbox.qaClosed=closed;
  run("State.environment=[];State.relief=null;State.clock={day:20.45,speed:1};State.daylightOverride='day';State.village={founded:true,wellId:'well'};State.structures=[{id:'well',type:'well',x:150,y:150},...qaS];window.ConquerSiege.restore(null);window.ConquerCombatRules.reset();window.ConquerCombat.restore({version:2,fog:false,zones:false,units:qaU,enemy:qaE,storms:[],strokes:[]});for(const id of ['go','gi'])window.ConquerSiege.setGateClosed(id,qaClosed.includes(id));invalidateNavigation()")};
const E=id=>run("State.combat.enemy.find(u=>u.id==='"+id+"')"),U=id=>run("State.combat.units.find(u=>u.id==='"+id+"')");
const A=(id,kind,x,y)=>({id,kind,combatKind:kind,faction:'dev_hostile',x,y});

test('with the gates open the attackers cross both rings to the keep',()=>{
  sandbox.qaStates.outer='secure';sandbox.qaStates.inner='secure';
  reset([],[A('a1','infantry',100,70)]);
  tick(150);
  const a=E('a1');
  assert.ok(inR(a,80,120),'through the outer gate: '+a.x.toFixed(1)+','+a.y.toFixed(1));
  tick(250);
  assert.ok(inR(E('a1'),92,108),'and through the inner gate into the keep sector: '+E('a1').x.toFixed(1)+','+E('a1').y.toFixed(1));
});
test('after breaching the outer gate the ram crew continues to the keep',()=>{
  reset([],[A('rammer','infantry',100,84)]);
  run("State.combat.storms=[{id:'finished-ram',kind:'ram',gateId:'go',done:true}];State.combat.enemy[0].assault='finished-ram';State.combat.enemy[0].cameDown=true");
  tick(350);
  assert.ok(inR(E('rammer'),92,108),'ram crew resumes the sector campaign');
});
for(const kind of ['ladder','tower'])test('after a '+kind+' assault the attacker descends and continues through the inner ring',()=>{
  reset([],[{...A('climber','infantry',98,80),wall:{wallId:'on1',t:17/18},z:2,assault:'wall-assault'}]);
  sandbox.qaKind=kind;
  run("State.combat.storms=[{id:'wall-assault',kind:qaKind,wallId:'on1',t:17/18}];State.structures.find(s=>s.id==='on1').bSnap='go';window.ConquerWallWalk.invalidate()");
  tick(450);
  assert.ok(!E('climber').wall&&inR(E('climber'),92,108),'descended and continued to the keep');
});
test('a breach joins the lost outer sector to the approach of the inner gate',()=>{
  reset([],[A('breacher','infantry',100,85)]);
  sandbox.qaBreach=true;
  run("State.structures=State.structures.filter(s=>!['go','on1','on2'].includes(s.id));invalidateNavigation()");
  tick(300);
  assert.ok(inR(E('breacher'),92,108),'through the breach, then the inner gate');
});
test('a closed gate on the way gets a ram, the archers wait out of reach',()=>{
  reset([],[A('m1','infantry',100,72),A('m2','infantry',101,72),A('b1','archer',99,66)],['go']);
  tick(30);
  assert.equal(run("(State.combat.storms||[]).filter(s=>s.kind==='ram'&&s.gateId==='go').length"),1,'one ram at the outer gate');
  assert.ok(run("State.combat.enemy.filter(e=>e.combatKind==='infantry'&&e.assault).length")>=1,'men-at-arms man it');
  assert.equal(E('b1').assault??null,null,'the archer does not');
});
test('defenders fall back inwards when their sector falls, and shut the inner gate',()=>{
  sandbox.qaStates.outer='secure';
  reset([{id:'sq',kind:'squad',combatKind:'spearman',faction:'realm',x:100,y:86}],[A('a1','infantry',100,60)],['gi']);
  run("State.combat.enemy[0].digging='qa'");          // a hostile on the map, but standing still
  tick(10);
  assert.ok(inR(U('sq'),80,120)&&!inR(U('sq'),92,108),'holds the outer ring while it is safe');
  sandbox.qaStates.outer='invaded';
  tick(400);
  assert.ok(inR(U('sq'),92,108),'fell back into the inner ring: '+U('sq').x.toFixed(1)+','+U('sq').y.toFixed(1));
  assert.equal(run("window.ConquerSiege.gateClosed(State.structures.find(s=>s.id==='gi'))"),true,'and shut the inner gate behind');
});
test('a defender already in melee can break contact to fall back',()=>{
  sandbox.qaStates.outer='invaded';
  reset([{id:'retreating',kind:'squad',combatKind:'spearman',faction:'realm',x:100,y:86}],[A('far','infantry',100,60)],['gi']);
  run("State.combat.enemy[0].digging='qa'");
  tick(2);
  run("State.combat.units[0].engaged=true");
  const before=U('retreating').y;
  tick(1);
  assert.ok(U('retreating').y>before,'retreat movement is not locked by engaged');
});
test('a wall defender descends by the stairs and reaches the inner refuge',()=>{
  sandbox.qaStates.outer='invaded';
  reset([{id:'wall-guard',kind:'squad',combatKind:'spearman',faction:'realm',x:98,y:80,wall:{wallId:'on1',t:17/18},z:2}],[A('far','infantry',100,60)],['gi']);
  run("State.combat.enemy[0].digging='qa'");
  run("State.structures.find(s=>s.id==='on1').bSnap='go';window.ConquerWallWalk.invalidate()");
  tick(450);
  assert.ok(!U('wall-guard').wall&&inR(U('wall-guard'),92,108),'descended to the inner sector: '+U('wall-guard').x+','+U('wall-guard').y);
});
// Gate jams seen in the 5-minute siege (docs/qa/combat-ai-circle-300s-2026-11-06.md): men left
// standing in a passage belong to no sector, and from beside the walls the grid route to a
// gate mouth fails for a military footprint.
test('an attacker left in the outer passage goes on inwards, not back out',()=>{
  sandbox.qaStates.outer='secure';sandbox.qaStates.inner='secure';
  reset([],[A('p1','infantry',100,80.2)]);
  tick(120);
  assert.ok(inR(E('p1'),80,120)&&E('p1').y>81.5,'out of the passage, inside the outer ring: '+E('p1').x.toFixed(1)+','+E('p1').y.toFixed(1));
});
test('an attacker left in the inner passage goes on into the keep ring',()=>{
  reset([],[A('p2','infantry',100,92.2)]);
  tick(120);
  assert.ok(inR(E('p2'),92,108),'into the inner ring: '+E('p2').x.toFixed(1)+','+E('p2').y.toFixed(1));
});
test('a patrol beside the outer wall completes its fall back',()=>{
  sandbox.qaStates.outer='secure';
  reset([{id:'pt',kind:'patrol',combatKind:'patrol',faction:'realm',x:82,y:110}],[A('a1','infantry',100,60)]);
  run("State.combat.enemy[0].digging='qa'");
  sandbox.qaStates.outer='invaded';
  tick(500);
  assert.ok(inR(U('pt'),92,108),'reached the inner ring: '+U('pt').x.toFixed(1)+','+U('pt').y.toFixed(1));
});
// Fire on the siege engines: roof archers loose fire arrows; a fire that grows past the
// crew's buckets burns the engine out and ends that assault.
test('fire arrows from a tower roof set the ram alight',()=>{
  reset([],[...Array(8)].map((_,i)=>A('m'+i,'infantry',96+i,72)),['go']);
  // A roofed-deck tower just inside the gate, within bow range of the ram (the corners are 20 U off).
  run("State.structures.push({id:'qt',type:'tower',shape:'square',size:2,x:106,y:84,level:2,material:'stone',angle:0,archerCount:1,functions:[]});invalidateNavigation()");
  assert.equal(run("window.ConquerSiege.occupiedArcherSlots(State.structures.find(s=>s.id==='qt'))[0]?.kind"),'roof','the archer is on the roof');
  let lit=false;for(let i=0;i<120&&!lit;i++){tick(5);lit=run("(State.combat.storms||[]).some(s=>s.kind==='ram'&&(s.fire||s.burnt))")}
  assert.ok(lit,'the ram caught fire');
});
test('a ram fire past the crew burns it out and frees the crew',()=>{
  reset([],[...Array(8)].map((_,i)=>A('m'+i,'infantry',96+i,72)),['go']);
  tick(30);
  run("const s=State.combat.storms.find(s=>s.kind==='ram');s.fire={heat:.95}");
  tick(30);
  const s=run("State.combat.storms.find(s=>s.kind==='ram')");
  assert.ok(s.burnt&&s.done,'burnt out');
  assert.ok(!run("State.combat.enemy.some(e=>e.assault==='"+s.id+"')"),'crew released');
  assert.ok(!run("State.combat.storms.some(x=>x.kind==='ram'&&!x.done)"),'no new ram at once');
});
test('an archer with no target moves to a tower that can engage',()=>{
  reset([],[A('m1','infantry',100,74)],['go']);
  run("State.combat.enemy[0].digging='qa'");
  run("State.structures.push({id:'qt',type:'tower',shape:'square',size:2,x:106,y:84,level:2,material:'stone',angle:0,archerCount:0,functions:[]});State.structures.find(s=>s.id==='o2').archerCount=1;invalidateNavigation()");
  tick(80);
  assert.equal(run("State.structures.find(s=>s.id==='o2').archerCount"),0,'left the idle back tower');
  tick(450);
  assert.equal(run("State.structures.find(s=>s.id==='qt').archerCount"),1,'took a post in the tower facing the enemy');
});
test('few men carry the light ram, eight bring up the covered one',()=>{
  reset([],[A('m1','infantry',100,72),A('m2','infantry',101,72)],['go']);
  tick(30);
  assert.equal(run("State.combat.storms.find(s=>s.kind==='ram').variant"),'light','two men: the light ram');
  reset([],[...Array(8)].map((_,i)=>A('m'+i,'infantry',96+i,72)),['go']);
  tick(30);
  assert.equal(run("State.combat.storms.find(s=>s.kind==='ram').variant"),'covered','eight men: the covered ram');
});
test('the covered ram shelters its crew at their posts',()=>{
  reset([],[...Array(8)].map((_,i)=>A('m'+i,'infantry',96+i,72)),['go']);
  tick(300);
  assert.equal(run("State.combat.enemy.filter(e=>e.underRoof).length"),8,'all eight at their posts under the roof: '+
    run("JSON.stringify({storm:State.combat.storms.map(s=>({v:s.variant,m:s.manned,o:s.origin})),crew:State.combat.enemy.map(e=>[e.id,+e.x.toFixed(2),+e.y.toFixed(2),e.assault?1:0,e.legs?.length||0,e.engaged?1:0])})"));
  assert.ok(run("State.combat.storms.find(s=>s.kind==='ram').blows")>0,'and the ram swings');
  assert.equal(run("State.combat.enemy.filter(e=>e.atRam).length"),8,'drawn with both hands on the ram (no spear or shield)');
});
// Walls drawn clockwise (TEST's castle) had their exterior inside and the gate's passage along
// the wall: on load the enclosure decides (faceFortificationsOut in migrateStructures).
test('a ring of walls faces out and its gate passes across the wall, outwards',()=>{
  for(const order of ['cw','ccw']){
    const P=[{x:90,y:101},{x:110,y:101},{x:110,y:121},{x:90,y:121}];
    const seq=order==='cw'?P:P.slice().reverse();
    const walls=seq.map((a,i)=>({id:'w'+i,type:'wall',a:{...a},b:{...seq[(i+1)%4]},width:.5,level:2,tier:2}));
    // The north wall gets a gate in its middle: split it around (100,101).
    const n=walls.find(w=>w.a.y===101&&w.b.y===101),mid={x:100,y:101};
    const n2={...n,id:'wn2',a:{...mid},b:{...n.b},aSnap:'g'};n.b={...mid};n.bSnap='g';
    sandbox.qaList=[...walls,n2,{id:'g',type:'gate',x:100,y:101,angle:0,level:2,material:'stone'}];
    run('faceFortificationsOut(qaList)');
    for(const w of sandbox.qaList.filter(s=>s.type==='wall')){
      const dx=w.b.x-w.a.x,dy=w.b.y-w.a.y,L=Math.hypot(dx,dy),side=w.flip?-1:1,ex=-dy/L*side,ey=dx/L*side;
      const mx=(w.a.x+w.b.x)/2-100,my=(w.a.y+w.b.y)/2-111;
      assert.ok(ex*mx+ey*my>0,order+' '+w.id+': exterior points out of the ring');
    }
    const g=sandbox.qaList.find(s=>s.id==='g');
    assert.ok(Math.abs(Math.cos(g.angle))<1e-6&&Math.sin(g.angle)<0,order+': gate passage across the north wall, outward to -y (angle '+g.angle+')');
  }
});
console.log(passed+' combat sector checks passed; '+failed+' failed.');if(failed)process.exitCode=1;
`)(require,__dirname);
