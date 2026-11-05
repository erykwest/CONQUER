'use strict';
// BC-251105-05 — inner roof: a pyramid / cone set back inside the merlons of a crenellated or
// machicolated T2+ stone tower, on a low kerb, the wall-walk left free between roof and merlons.
const fs=require('node:fs');
const harness=fs.readFileSync(__dirname+'/urban-regression.cjs','utf8').split('let passed=0;')[0];
eval(harness+`
run(fs.readFileSync(__dirname+'/../src/settlement-architecture.js','utf8'));
let passed=0;
function check(name,body){body();passed++;console.log('PASS '+name)}
const setup=list=>{run('State.structures').splice(0,Infinity,...list);return list};
const tower=(id,extra={})=>run('normalizeStructureVariants')({id,type:'tower',shape:'square',material:'stone',size:1.5,tier:2,level:2,roofStyle:'battlement',x:100,y:100,angle:0,functions:[],...extra});
const mounted=s=>run('towerInnerRoofMounted')(s),geo=s=>run('towerInnerRoofGeometry')(s);

check('towers start without an inner roof; it takes T2+ stone towers with merlons or machicolations',()=>{
  assert.equal(tower('a').innerRoof,'off');
  assert.ok(mounted(tower('b',{innerRoof:'on'})));
  assert.ok(mounted(tower('c',{roofStyle:'machicolation',innerRoof:'on'})));
  assert.ok(mounted(tower('d',{shape:'round',r:.75,innerRoof:'on'})),'round T2');
  assert.ok(!mounted(tower('e',{roofStyle:'pitched',innerRoof:'on'})),'not under a pitched roof');
  assert.ok(!mounted(tower('f',{size:1,tier:1,innerRoof:'on'})),'not on T1: no room for roof and wall-walk');
  assert.ok(!mounted(tower('g',{material:'wood',innerRoof:'on'})),'not on wood');
  assert.ok(!mounted(tower('h',{brokenTop:true,innerRoof:'on'})),'not on a broken crown');
  assert.ok(!mounted(tower('i',{shape:'half',innerRoof:'on'})),'not on a semitower');
  assert.ok(!run('setStructureVariant')(tower('j'),'innerRoof','dome'),'only off / on');
});
check('the deck weapon and the inner roof exclude each other',()=>{
  assert.ok(!mounted(tower('a',{topWeapon:'mangonel',innerRoof:'on'})),'weapon first');
  assert.ok(!run('towerTopWeaponAllowed')(tower('b',{innerRoof:'on'})),'roof first');
  assert.ok(run('towerTopWeaponAllowed')(tower('c')),'T2 crenellated tower still takes a weapon');
});
check('the roof stands inside the merlons, on a kerb, and rises above them',()=>{
  for(const t of [tower('s',{innerRoof:'on'}),tower('r',{shape:'round',r:1,tier:3,level:3,innerRoof:'on'}),tower('m',{size:2,tier:3,roofStyle:'machicolation',innerRoof:'on'})]){
    setup([t]);const g=geo(t),h=run('structureHeight')(t);
    assert.ok(g,'geometry');
    assert.equal(g.h,h);assert.ok(g.eaveZ>h&&g.apexZ>h+.4,'kerb, then a roof above the merlons');
    const merlons=run('towerBattlementPieces')(t).filter(p=>p.merlon);
    // Distance from the centre: radial on round towers, along the axes (Chebyshev) on square ones.
    const d=q=>t.shape==='round'?Math.hypot(q.x-t.x,q.y-t.y):Math.max(Math.abs(q.x-t.x),Math.abs(q.y-t.y));
    const inner=Math.min(...merlons.flatMap(p=>p.pts.map(d))),reach=Math.max(...g.ring.map(d));
    assert.ok(reach<inner-.15,'a wall-walk at least 0.15 U wide between roof and merlons');
    assert.ok(Math.abs(run('towerVisualTopHeight')(t)-g.apexZ)<1e-9,'visual top = apex');
  }
});
check('2.5D: one inner-roof piece among the merlons, only when mounted and built',()=>{
  const on=tower('a',{innerRoof:'on'}),off=tower('b'),site=tower('c',{innerRoof:'on',construction:{progress:.5}});
  setup([on,off,site]);
  assert.equal(run('towerInnerRoofPiece')(on)?.kind,'innerRoof');
  assert.equal(run('towerInnerRoofPiece')(off),null);
  assert.equal(run('towerBattlementPieces')(on).length,run('towerBattlementPieces')(off).length,'merlons unchanged');
});
check('rooms under the roof keep asking for a pitched roof (Colombaia, Falconiera, Campana)',()=>{
  const t=tower('a',{level:2,innerRoof:'on'});setup([t]);
  assert.ok(!run('towerDovecoteAllowed')(t),'no dovecote under an inner roof');
  // ROOM_EXTERIOR roof mounts (the belfry) ask roomExteriorRoofBase, which wants towerRoofStyle 'pitched'.
  assert.equal(run('towerRoofStyle')(t),'battlement','the tower top stays crenellated');
  const src=fs.readFileSync(__dirname+'/../src/settlement-room-exterior.js','utf8');
  assert.ok(/towerRoofStyle\\(s\\)!=='pitched'\\)return null/.test(src),'roof elements stay on pitched roofs');
});
console.log('tower inner roof regression: '+passed+' checks');
`);
