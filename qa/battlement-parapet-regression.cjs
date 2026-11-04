'use strict';
// Stone crowns: a low continuous parapet joins the merlons on towers, gates and walls (one block per
// crenel, never across a merlon), and round towers get a merlon count from their circumference.
const fs=require('node:fs');
const harness=fs.readFileSync(__dirname+'/urban-regression.cjs','utf8').split('let passed=0;')[0];
eval(harness+`
run(fs.readFileSync(__dirname+'/../src/settlement-architecture.js','utf8'));
let passed=0;
function check(name,body){body();passed++;console.log('PASS '+name)}
const setup=list=>{run('State.structures').splice(0,Infinity,...list);return list};
const tower=(id,extra={})=>({id,type:'tower',shape:'square',material:'stone',size:1.5,tier:2,level:1,roofStyle:'battlement',x:100,y:100,angle:0,functions:[],...extra});
// An L corner merlon is two arm pieces: count each corner once.
const split=pieces=>{
  const merlons=pieces.filter(p=>!p.kind);
  return{merlons,parapets:pieces.filter(p=>p.kind==='parapet'),positions:merlons.length-merlons.filter(p=>p.cornerArm).length/2};
};
const centroid=p=>({x:p.pts.reduce((a,q)=>a+q.x,0)/p.pts.length,y:p.pts.reduce((a,q)=>a+q.y,0)/p.pts.length});

check('square, round and gate crowns have one parapet block per crenel',()=>{
  const [sq,rd,gt]=setup([tower('s'),tower('r',{shape:'round',r:.75,x:110}),{id:'g',type:'gate',material:'stone',level:1,roofStyle:'battlement',x:120,y:100,angle:0,size:1.6}]);
  const s=split(run('towerBattlementPieces')(sq));
  assert.equal(s.parapets.length,s.positions,'closed square ring: as many gaps as merlons');
  assert.equal(s.merlons.filter(p=>p.cornerArm).length,8,'four L corners, two arms each');
  const r=split(run('towerBattlementPieces')(rd));
  assert.equal(r.parapets.length,r.merlons.length,'closed round ring');
  const g=split(run('gateBattlementPieces')(gt));
  if(g.merlons.length)assert.equal(g.parapets.length,g.positions,'closed gate ring');
  for(const p of [...s.parapets,...r.parapets]){
    const h=p.z1-p.z0;assert.ok(h>.05&&h<.2,'parapet is lower than a merlon: '+h);
    assert.ok(Math.abs(p.z0-run('structureHeight')(p.ownerId==='s'?sq:rd))<1e-9,'parapet sits on the crown');
  }
});
check('parapet blocks stay in the crenels, between merlons',()=>{
  const [sq]=setup([tower('s',{tier:3,size:2})]);
  const {merlons,parapets}=split(run('towerBattlementPieces')(sq)),inside=run('pointInPolygon');
  for(const p of parapets)for(const m of merlons)assert.ok(!inside(centroid(p),m.pts),'no parapet centre inside a merlon');
});
check('walls get an open run of parapet between their merlons',()=>{
  const [w]=setup([{id:'w',type:'wall',material:'stone',level:1,width:.5,a:{x:100,y:100},b:{x:105,y:100}}]);
  const {merlons,parapets}=split(run('wallBattlementPieces')(w));
  assert.equal(parapets.length,merlons.length-1);
  assert.ok(parapets.every(p=>p.wallCrest),'wall parapets clip at the crest like the merlons');
});
check('round towers: more merlons, growing with the tier',()=>{
  const counts=[1,2,3].map(t=>{const [rd]=setup([tower('r',{shape:'round',tier:t,r:[0,.5,.75,1][t]})]);return split(run('towerBattlementPieces')(rd)).merlons.length});
  assert.ok(counts[0]>=8&&counts[1]>counts[0]&&counts[2]>counts[1],'merlons per tier: '+counts);
  assert.ok(counts.every(n=>n%2===0),'even count keeps the ring symmetric');
});
check('crenel styles: crown parts per style, restyle priced per merlon',()=>{
  const [sq]=setup([tower('s'),tower('b',{x:110,masonryMaterial:'brick'})]);
  run('State').policies.crenelStyle='flat';
  assert.ok(split(run('towerBattlementPieces')(sq)).merlons.every(p=>!p.styleParts),'flat: plain blocks');
  for(const style of ['gabled','swallowtail']){
    run('State').policies.crenelStyle=style;
    assert.ok(split(run('towerBattlementPieces')(sq)).merlons.every(p=>p.styleParts?.length),style+': every merlon has a crown');
  }
  const q=run('crenelRestyleQuote')('swallowtail'),n=q.merlons/2;
  assert.ok(n>0&&q.cost.stone===3*n&&q.cost.clay===3*n&&q.cost.gold===4*n,'stone vs brick pricing: '+JSON.stringify(q));
  run('State').policies.crenelStyle='flat';
});
console.log('battlement parapet regression: '+passed+' checks');
`);
