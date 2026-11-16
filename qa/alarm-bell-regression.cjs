'use strict';
// Alarm bells: the village alarm spreads as sound from the command post. Each bell rings for its
// hearing radius (towers by height, church and Municipio by civic level) and passes the alarm to
// bells in that radius; beyond every radius the alarm runs by voice, capped. Bells never add up.
// The upgrade fits T1-T2 towers under a pitched roof (wood too), not T3, not with a dovecote/mews;
// a broken, burnt or destroyed tower has no bell. The combat module delays each household.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const root=__dirname+'/../src/';
const near=(a,b,msg)=>assert.ok(Math.abs(a-b)<1e-9,msg+' ('+a+' vs '+b+')');

function fixture(structures,{mastio=null}={}){
  const State={structures};
  const ctx=vm.createContext({
    State,console,Math,Object,Array,Map,Set,Number,Infinity,
    window:{ConquerSiege:{mastio:()=>mastio&&structures.find(s=>s.id===mastio)||null}},
    underConstruction:s=>!!s.construction,
    isWoodTower:s=>s.type==='tower'&&s.material==='wood',
    woodTowerRoof:s=>s.woodStyle==='watchtower'?'pitched':s.woodRoof==='pitched'?'pitched':'open',
    towerRoofStyle:s=>s.brokenTop&&s.material!=='wood'?'broken':s.roofStyle||'battlement',
    towerTier:s=>s.tier||1,
    structureLevel:s=>s.level||1,
    civicLevel:s=>s.civicLevel||1,
    structureVariant:(s,k)=>k==='bell'&&s.shape!=='half'?(s.bell==='bell'?'bell':'none'):undefined
  });
  vm.runInContext(fs.readFileSync(root+'settlement-alarm-bells.js','utf8'),ctx);
  return{State,B:ctx.window.ConquerAlarmBells};
}
const tower=(id,x,y,o={})=>({id,type:'tower',x,y,tier:1,level:1,roofStyle:'pitched',bell:'bell',functions:[],...o});

{
  const {B}=fixture([]);
  assert.equal(B.towerBellAllowed(tower('a',0,0)),true,'T1 stone tower with a pitched roof');
  assert.equal(B.towerBellAllowed(tower('a',0,0,{tier:2,level:3})),true,'T2 tower');
  assert.equal(B.towerBellAllowed(tower('a',0,0,{tier:3})),false,'not on T3 towers');
  assert.equal(B.towerBellAllowed(tower('a',0,0,{roofStyle:'battlement'})),false,'needs a pitched roof');
  assert.equal(B.towerBellAllowed(tower('a',0,0,{shape:'half'})),false,'not on a semitower');
  assert.equal(B.towerBellAllowed(tower('a',0,0,{material:'wood',woodStyle:'watchtower',roofStyle:undefined})),true,'the wooden watchtower');
  assert.equal(B.towerBellAllowed(tower('a',0,0,{material:'wood',woodStyle:'palisadeTower',woodRoof:'open'})),false,'open palisade tower: no roof');
  assert.equal(B.towerBellAllowed(tower('a',0,0,{tier:2,functions:[null,'dovecote']})),false,'the dovecote takes the same apex');
  assert.equal(B.towerBellAllowed(tower('a',0,0,{brokenTop:true})),false,'a broken crown has no roof');
  assert.equal(B.towerBellAllowed(tower('a',0,0,{roofBurnt:true})),false,'nor a burnt one');
  assert.deepEqual([1,2,3].map(level=>B.hearingRadius(tower('a',0,0,{level}))),[10,13,16],'tower radius grows with height');
  assert.equal(B.hearingRadius(tower('a',0,0,{material:'wood',level:3})),10,'wooden towers ring as H1');
  assert.deepEqual([1,2,3].map(civicLevel=>B.hearingRadius({type:'townhall',civicLevel})),[10,12,14],'Municipio by civic level');
  assert.deepEqual([1,2,3].map(civicLevel=>B.hearingRadius({type:'church',civicLevel})),[12,14,16],'church by civic level');
  console.log('PASS where the bell fits and how far each bell is heard');
}
{
  // The church and the Municipio ring by themselves; towers only with the upgrade; nothing unfinished.
  const {B}=fixture([
    {id:'c',type:'church',x:0,y:0},{id:'h',type:'townhall',x:5,y:0,construction:{progress:.2}},
    tower('t1',10,0),tower('t2',20,0,{bell:'none'}),tower('t3',30,0,{destroyed:true}),{id:'m',type:'market',x:1,y:1}
  ]);
  assert.deepEqual(B.bells().map(b=>b.id),['c','t1'],'church and upgraded tower only');
  console.log('PASS bells: church, Municipio and upgraded towers, standing and finished');
}
{
  // The command post is the Mastio; without one, the Municipio, then the church, then a bell, then the well.
  const keep=tower('k',0,0,{bell:'none',tier:2,isMastio:true});
  assert.equal(fixture([keep,{id:'h',type:'townhall',x:9,y:0}],{mastio:'k'}).B.origin().id,'k');
  assert.equal(fixture([{id:'c',type:'church',x:0,y:0},{id:'h',type:'townhall',x:9,y:0}]).B.origin().id,'h');
  assert.equal(fixture([{id:'w',type:'well',x:3,y:3},tower('t',8,0)]).B.origin().id,'t');
  assert.equal(fixture([{id:'w',type:'well',x:3,y:3}]).B.origin().id,'w');
  console.log('PASS the alarm starts at the Mastio, else Municipio, church, a bell, the well');
}
{
  // A chain: Municipio at 0 (r 10), tower at 9 (r 10), tower at 18 (r 10), an isolated tower at 60.
  const {B}=fixture([{id:'h',type:'townhall',x:0,y:0},tower('a',9,0),tower('b',18,0),tower('far',60,0)]);
  const p=B.plan(),t=id=>p.nodes.find(n=>n.id===id).t;
  near(t('h'),0,'the Municipio is the command post and rings at once');
  near(t('a'),B.HOP,'a bell in range answers after one hop');
  near(t('b'),2*B.HOP,'and passes it on down the chain');
  near(t('far'),2*B.HOP+B.VOICE_BASE+B.VOICE_PER_U*(42-10),'an isolated bell rings when word reaches it');
  // Houses: in range of the last link, out of range, very far.
  near(B.delay(p,{x:25,y:0}),2*B.HOP+B.HEAR,'a house in range of the chain hears it in seconds');
  near(B.delay(p,{x:33,y:0}),2*B.HOP+B.VOICE_BASE+B.VOICE_PER_U*5,'beyond every radius by voice from the nearest edge');
  near(B.delay(p,{x:300,y:0}),B.VOICE_MAX,'never later than the cap');
  assert.equal(B.heardBell(p,{x:25,y:0}).id,'b','the house hears tower b');
  console.log('PASS bells relay the alarm along a chain; beyond it the alarm runs by voice');
}
{
  // Bells never add up: a second bell over the same house changes nothing unless it is earlier.
  const one=fixture([{id:'h',type:'townhall',x:0,y:0}]),two=fixture([{id:'h',type:'townhall',x:0,y:0},tower('a',3,0)]);
  near(one.B.delay(one.B.plan(),{x:4,y:0}),two.B.delay(two.B.plan(),{x:4,y:0}),'two bells over a house: still the first one');
  // Without any bell the alarm runs by voice from the Mastio: no more instant mobilization.
  const keep=tower('k',0,0,{bell:'none',tier:2,isMastio:true}),bare=fixture([keep],{mastio:'k'});
  near(bare.B.delay(bare.B.plan(),{x:20,y:0}),bare.B.VOICE_BASE+bare.B.VOICE_PER_U*20,'no bell: word of mouth from the Mastio');
  // A bell on the Mastio itself: the households around it hear at once.
  const rung=fixture([{...keep,tier:2,roofStyle:'pitched',bell:'bell'}],{mastio:'k'});
  near(rung.B.delay(rung.B.plan(),{x:8,y:0}),rung.B.HEAR,'the Mastio bell is heard at once within 10U');
  console.log('PASS bells never add up; without them the alarm is word of mouth');
}
{
  // A tower bell that falls (broken crown) drops out of the next ring and breaks the chain.
  const s=[{id:'h',type:'townhall',x:0,y:0},tower('a',9,0),tower('b',18,0)];
  const {B}=fixture(s);
  const before=B.delay(B.plan(),{x:26,y:0});
  s[1].brokenTop=true;
  const after=B.delay(B.plan(),{x:26,y:0});
  assert.ok(after>before+1,'the chain is broken: the far house hears it much later ('+before+' → '+after+')');
  console.log('PASS a destroyed or broken tower loses its bell and breaks the chain');
}
{
  // The ring in time: each house switches mode after its own delay; red over green keeps the green
  // still travelling; release is immediate.
  const {B}=fixture([{id:'h',type:'townhall',x:0,y:0}]);
  const nearHouse={id:'n',x:2,y:0},farHouse={id:'f',x:30,y:0};
  const dn=B.delay(B.plan(),nearHouse),df=B.delay(B.plan(),farHouse);
  const green=B.ring('green',null,1000);
  assert.equal(B.heard(green,nearHouse,1000),'off','nobody hears it before the first peal');
  assert.equal(B.heard(green,nearHouse,1000+1000*dn),'green','the near house hears it first');
  assert.equal(B.heard(green,farHouse,1000+1000*dn),'off','the far one not yet');
  assert.equal(B.heard(green,farHouse,1000+1000*df),'green','then the far one');
  assert.ok(B.pending(green,1000+1000*df-1)&&!B.pending(green,1000+1000*(B.VOICE_MAX+1)),'pending until the last house');
  const T=1000+1000*df+100,red=B.ring('hall',green,T);
  assert.equal(B.heard(red,farHouse,T),'green','the red peal has not reached the far house: still green');
  assert.equal(B.heard(red,farHouse,T+1000*df),'hall','then red');
  assert.equal(B.ring('off',red,T+1),null,'release: no ring, heard at once');
  console.log('PASS each household hears the alarm after its own delay; red follows green');
}
{
  // Combat wiring: the civilians' alarm is the one their house has heard, set up when it is raised.
  const src=fs.readFileSync(root+'settlement-combat.js','utf8');
  assert.match(src,/alarm=heardAlarm\(house,now\)/,'civilPosition reads the alarm heard by the household');
  assert.match(src,/alarmRing=bells\?\.ring\(mode,alarmRing,performance\.now\(\)\)/,'setAlarmMode starts a ring');
  assert.match(src,/ConquerAlarmBells\?\.pending\(alarmRing,now\)/,'paused game keeps animating while the alarm travels');
  assert.match(src,/audio\.play\('bells','effects',volume\)/,'the bells are heard');
  const index=fs.readFileSync(__dirname+'/../index.html','utf8');
  assert.ok(index.indexOf('settlement-alarm-bells.js')>0&&index.indexOf('settlement-alarm-bells.js')<index.indexOf('settlement-combat.js'),'loaded before combat');
  const core=fs.readFileSync(root+'settlement-core.js','utf8');
  assert.match(core,/bell:Object\.freeze\(\['none','bell'\]\)/,'tower variant');
  console.log('PASS combat delays each household by its bell; the module is loaded');
}
