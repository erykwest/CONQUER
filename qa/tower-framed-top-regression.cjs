'use strict';
// Framed top (BC-261124): the top storey of a W3 square stone tower (L2+) as a jettied timber
// frame, always under a pitched roof; stone storeys below priced as usual, the frame in wood only.
const fs=require('node:fs');
const harness=fs.readFileSync(__dirname+'/urban-regression.cjs','utf8').split('let passed=0;')[0];
eval(harness+`
run(fs.readFileSync(__dirname+'/../src/settlement-architecture.js','utf8'));
let passed=0;
function check(name,body){body();passed++;console.log('PASS '+name)}
const tower=(extra={})=>run('normalizeStructureVariants')({id:'t',type:'tower',shape:'square',material:'stone',size:2,tier:3,level:3,roofStyle:'battlement',upper:'timber',x:100,y:100,angle:0,functions:[],...extra});

check('only W3 square stone towers at L2+, never on a broken crown',()=>{
  const ok=run('towerTimberUpperAllowed');
  assert.ok(ok(tower()));assert.ok(ok(tower({level:2})));
  assert.ok(!ok(tower({level:1})),'L1');
  assert.ok(!ok(tower({size:1.5})),'W2');
  assert.ok(!ok(tower({size:3})),'W4 keep');
  assert.ok(!ok(tower({shape:'round',r:1})),'round');
  assert.ok(!ok(tower({material:'wood'})),'timber tower');
  assert.ok(!ok(tower({brokenTop:true})),'broken');
});
check('always the pitched roof: no merlons, machicolations, hoarding or bartizans',()=>{
  assert.equal(run('towerRoofStyle')(tower({roofStyle:'machicolation'})),'pitched');
  assert.ok(!run('hasMachicolation')(tower({roofStyle:'machicolation'})));
  assert.ok(!run('towerHoardingAllowed')(tower()));
  assert.ok(!run('towerBartizanAllowed')(tower()));
  assert.equal(run('towerRoofStyle')(tower({upper:'stone'})),'battlement','masonry top keeps its own roof');
});
check('cost: the stone tower one level lower plus wood only for the top storey',()=>{
  const cost=run('constructionCost'),L2=cost(tower({level:2,upper:'stone'})),F=cost(tower());
  assert.equal(F.stone,L2.stone);assert.equal(F.gold,L2.gold);
  assert.equal(F.wood,L2.wood+run('TOWER_TIMBER_COST').wood);
  assert.ok(F.stone<cost(tower({upper:'stone'})).stone);
});
check('jettied storey and wider roof eaves',()=>{
  const pts=run('towerTimberStoreyPoints')(tower()),d=Math.hypot(pts[1].x-pts[0].x,pts[1].y-pts[0].y);
  assert.ok(Math.abs(d-(2+2*run('TOWER_JETTY')))<1e-9);
  assert.ok(run('towerTimberFloorZ')(tower())<run('structureHeight')(tower()));
  assert.ok(run('towerRoofRise')(tower())>run('towerRoofRise')(tower({upper:'stone',roofStyle:'pitched'})));
});
const built=(extra={})=>run('normalizeStructureVariants')({id:'b',type:'built',tier:2,level:2,width:1,length:3,a:{x:0,y:0},b:{x:3,y:0},upper:'timber',functions:[],...extra});
check('built section: timber P1 only on W1 stone sections at L2, wood-only extra cost',()=>{
  const ok=run('builtTimberUpperAllowed'),cost=run('constructionCost');
  assert.ok(ok(built()));assert.ok(!ok(built({level:1})));assert.ok(!ok(built({span:'wide'})));assert.ok(!ok(built({material:'wood'})));
  const L1=cost(built({level:1,upper:'stone'})),T=cost(built());
  assert.equal(T.stone,L1.stone);assert.equal(T.gold,L1.gold);assert.equal(T.wood,L1.wood+Math.ceil(run('BUILT_TIMBER_WOOD_PER_U')*3));
  const pts=run('builtTimberStoreyPoints')(built());
  assert.ok(Math.abs(Math.hypot(pts[3].x-pts[0].x,pts[3].y-pts[0].y)-(1+2*run('BUILT_JETTY')))<1e-9,'jettied on both long faces');
});
console.log('tower framed top regression: '+passed+' checks');
`);
