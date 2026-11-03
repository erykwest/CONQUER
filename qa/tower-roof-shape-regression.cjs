'use strict';
// Square stone towers: the pitched roof is a pyramid, two slopes with gables, or four slopes on a
// ridge half as long as the roof (hip). Cosmetic only: same cost, same height.
const fs=require('node:fs');
const harness=fs.readFileSync(__dirname+'/urban-regression.cjs','utf8').split('let passed=0;')[0];
eval(harness+`
run(fs.readFileSync(__dirname+'/../src/settlement-architecture.js','utf8'));
let passed=0;
function check(name,body){body();passed++;console.log('PASS '+name)}
const tower=(extra={})=>run('normalizeStructureVariants')({id:'t',type:'tower',shape:'square',material:'stone',size:2,tier:3,level:2,roofStyle:'pitched',x:100,y:100,angle:0,functions:[],...extra});
const len=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

check('pyramid by default; the shape only applies to square pitched towers',()=>{
  const shape=run('towerRoofShape');
  assert.equal(tower().roofShape,'pyramid');
  assert.equal(shape(tower({roofShape:'hip'})),'hip');
  assert.equal(shape(tower({roofShape:'hip',roofStyle:'battlement'})),'pyramid','no roof, no shape');
  assert.equal(shape(tower({shape:'round',r:1,roofShape:'gable'})),'pyramid','round towers keep the cone');
  assert.ok(!run('setStructureVariant')(tower(),'roofShape','dome'));
});
check('gable: full-length ridge and two stone gables; hip: ridge half the roof',()=>{
  const geo=run('squareTowerRoofGeometry');
  const g=geo(tower({roofShape:'gable'})),h=geo(tower({roofShape:'hip'}));
  const L=len(g.footprint[0],g.footprint[1]);
  assert.ok(Math.abs(len(g.ridgeA,g.ridgeB)-L)<1e-9,'gable ridge runs the whole roof');
  assert.ok(Math.abs(len(h.ridgeA,h.ridgeB)-L/2)<1e-9,'hip ridge is L/2');
  assert.equal(g.faces.filter(f=>f.kind==='gable').length,2);
  assert.equal(h.faces.filter(f=>f.kind==='gable').length,0);
  assert.equal(h.ridgeH,run('towerVisualTopHeight')(tower()),'same height as the pyramid apex');
});
check('cosmetic: the roof shape does not change the cost',()=>{
  const cost=run('constructionCost');
  assert.deepEqual(cost(tower({roofShape:'gable'})),cost(tower({roofShape:'pyramid'})));
  assert.deepEqual(cost(tower({roofShape:'hip'})),cost(tower({roofShape:'pyramid'})));
});
console.log('tower roof shape regression: '+passed+' checks');
`);
