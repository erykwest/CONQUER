'use strict';
// Bartizans: four corbelled corner turrets on large (T3) square or round stone towers, crenellated
// or under a spire; each holds three shooters that also strike the tower foot, 0-1 U out.
const fs=require('node:fs');
const harness=fs.readFileSync(__dirname+'/urban-regression.cjs','utf8').split('let passed=0;')[0];
eval(harness+`
run(fs.readFileSync(__dirname+'/../src/settlement-architecture.js','utf8'));
let passed=0;
function check(name,body){body();passed++;console.log('PASS '+name)}
const setup=list=>{run('State.structures').splice(0,Infinity,...list);return list};
const tower=(id,extra={})=>run('normalizeStructureVariants')({id,type:'tower',shape:'square',material:'stone',size:2,tier:3,level:2,roofStyle:'battlement',x:100,y:100,angle:0,functions:[],...extra});
const centroid=p=>({x:p.pts.reduce((a,q)=>a+q.x,0)/p.pts.length,y:p.pts.reduce((a,q)=>a+q.y,0)/p.pts.length});

check('towers start without bartizans; only T3 square or round stone towers take them',()=>{
  const allowed=run('towerBartizanAllowed'),get=run('towerBartizan');
  assert.equal(tower('a').bartizan,'none');
  assert.equal(get(tower('b',{bartizan:'pitched'})),'pitched');
  assert.equal(get(tower('c',{shape:'round',r:1,bartizan:'battlement'})),'battlement');
  assert.equal(get(tower('d',{size:1.5,bartizan:'battlement'})),'none','not on T2');
  assert.equal(get(tower('e',{material:'wood',bartizan:'battlement'})),'none','not on wood');
  assert.equal(get(tower('f',{brokenTop:true,bartizan:'battlement'})),'none','not on a broken crown');
  assert.ok(!allowed(tower('g',{shape:'dee',bartizan:'battlement'})),'not on D towers');
  assert.ok(!run('setStructureVariant')(tower('h'),'bartizan','dome'),'only none / battlement / pitched');
});
check('one turret per corner, standing out of the tower',()=>{
  for(const t of [tower('s',{bartizan:'battlement'}),tower('r',{shape:'round',r:1,bartizan:'pitched'})]){
    setup([t]);const b=run('towerBartizans')(t);
    assert.equal(b.length,4);
    for(const q of b){
      const d=Math.hypot(q.center.x-t.x,q.center.y-t.y);
      assert.ok(d+q.r>1.15,'turret overhangs the tower face (half-width or radius 1)');
      assert.ok(q.corbelZ<q.z0&&q.z0<q.deckZ,'corbel under the drum');
      if(q.style==='pitched')assert.ok(q.apexZ>q.drumZ&&q.drumZ>q.deckZ,'spire above a taller drum');
    }
  }
});
check('tower merlons under a turret go; crenellated turrets bring their own ring',()=>{
  const plain=tower('p'),withB=tower('q',{bartizan:'battlement'}),spire=tower('t',{bartizan:'pitched'});
  setup([plain,withB,spire]);
  const turrets=run('towerBartizans')(withB),pieces=run('towerCrownPieces')(withB);
  for(const p of pieces.filter(p=>p.kind!=='parapet'&&p.kind!=='bartizanMerlon'))
    assert.ok(!turrets.some(b=>Math.hypot(centroid(p).x-b.center.x,centroid(p).y-b.center.y)<b.r),'no tower merlon inside a turret');
  assert.equal(pieces.filter(p=>p.kind==='bartizanMerlon').length,4*8,'eight merlons per turret');
  assert.equal(run('towerCrownPieces')(spire).filter(p=>p.kind==='bartizanMerlon').length,0,'spires have no merlons');
  assert.equal(run('towerCrownPieces')(plain).length,run('towerBattlementPieces')(plain).length,'no bartizans, crown unchanged');
});
check('three shooters per turret, with the 0-1 U foot strike, in both kinds',()=>{
  for(const kind of ['battlement','pitched']){
    const t=tower('a',{bartizan:kind});setup([t]);
    const slots=run('window.ConquerSiege').archerSlots(t).filter(s=>s.kind==='bartizan');
    assert.equal(slots.length,4*3,kind);
    assert.ok(slots.every(s=>s.foot&&s.foot.reach===1&&Number.isFinite(s.nx)),'foot reach and outward face');
  }
  const t=tower('b');setup([t]);
  assert.equal(run('window.ConquerSiege').archerSlots(t).filter(s=>s.kind==='bartizan').length,0);
});
console.log('bartizan regression: '+passed+' checks');
`);
