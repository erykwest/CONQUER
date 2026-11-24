'use strict';
// Up inner tower (torretta centrale): a one-storey W-1 turret in the middle of the deck of a W2/W3
// stone tower, round or square by choice, under a pointed cap. An upgrade, not a build-menu item.
const fs=require('node:fs');
const harness=fs.readFileSync(__dirname+'/urban-regression.cjs','utf8').split('let passed=0;')[0];
eval(harness+`
run(fs.readFileSync(__dirname+'/../src/settlement-architecture.js','utf8'));
let passed=0;
function check(name,body){body();passed++;console.log('PASS '+name)}
const setup=list=>{run('State.structures').splice(0,Infinity,...list);return list};
const tower=(id,extra={})=>run('normalizeStructureVariants')({id,type:'tower',shape:'square',material:'stone',size:1.5,tier:2,level:2,roofStyle:'battlement',x:100,y:100,angle:0,functions:[],...extra});
const up=s=>run('towerUpInnerTower')(s),geo=s=>run('upInnerTowerGeometry')(s);

check('off by default; W2/W3 stone towers with a flat deck only',()=>{
  assert.equal(tower('a').upInnerTower,'off');
  assert.equal(up(tower('b',{upInnerTower:'round'})),'round');
  assert.equal(up(tower('c',{size:2,tier:3,upInnerTower:'square'})),'square');
  assert.equal(up(tower('d',{size:1,tier:1,upInnerTower:'round'})),null,'not W1');
  assert.equal(up(tower('e',{size:3,tier:4,upInnerTower:'round'})),null,'not W4');
  assert.equal(up(tower('f',{material:'wood',upInnerTower:'round'})),null,'not wood');
  assert.equal(up(tower('g',{shape:'half',upInnerTower:'round'})),null,'not a semitower');
  assert.equal(up(tower('h',{roofStyle:'pitched',upInnerTower:'round'})),null,'not under a pitched roof');
  assert.equal(up(tower('i',{brokenTop:true,upInnerTower:'round'})),null,'gone with a broken crown');
  assert.ok(!run('setStructureVariant')(tower('j'),'upInnerTower','dome'),'only off / round / square');
});
check('it takes the deck: no inner roof, weapon or brazier with it',()=>{
  assert.equal(up(tower('a',{innerRoof:'on',upInnerTower:'round'})),null);
  assert.ok(!run('towerInnerRoofAllowed')(tower('b',{upInnerTower:'round'})));
  assert.ok(!run('towerTopWeaponAllowed')(tower('c',{upInnerTower:'round'})));
  assert.equal(up(tower('d',{topWeapon:'mangonel',upInnerTower:'round'})),null);
  const t=tower('e',{upInnerTower:'square'});setup([t]);
  assert.ok(!run('towerHasBrazier')(t));
});
check('W-1 footprint, one storey, shape free of the tower shape',()=>{
  const cases=[[tower('a',{upInnerTower:'square'}),.5],[tower('b',{size:2,tier:3,level:3,upInnerTower:'square'}),.75],
    [tower('c',{shape:'round',r:.75,upInnerTower:'round'}),.5],[tower('d',{shape:'round',r:1,tier:3,level:3,upInnerTower:'square'}),.75],
    [tower('e',{size:2,tier:3,upInnerTower:'round'}),.75]];
  for(const [t,half] of cases){
    setup([t]);const g=geo(t),h=run('structureHeight')(t);
    assert.ok(g,'geometry '+t.id);
    assert.ok(Math.abs(g.half-half)<1e-9,'half span '+t.id+' '+g.half);
    assert.equal(g.ring.length,g.shape==='round'?24:4);
    assert.ok(Math.abs(g.topZ-h-1.2)<1e-9,'one storey');
    assert.ok(g.apexZ>g.topZ+.5,'pointed cap');
    assert.ok(Math.abs(run('towerVisualTopHeight')(t)-g.apexZ)<1e-9,'visual top = apex');
  }
});
check('cache keys see the variant',()=>{
  for(const f of ['settlement-render.js','settlement-construction-assembly.js','settlement-population.js'])
    assert.ok(fs.readFileSync(__dirname+'/../src/'+f,'utf8').includes('upInnerTower'),f);
});
console.log('tower up inner tower regression: '+passed+' checks');
`);
