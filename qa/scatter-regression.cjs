'use strict';
// Environmental scatter: the Blender-built props load, and the context rules place
// them deterministically, by context, never on roads, buildings, fields or each other.
const fs=require('node:fs');
const harness=fs.readFileSync(__dirname+'/urban-regression.cjs','utf8').split('let passed=0;')[0];
eval(harness+`
for(const f of ['settlement-industries.js','settlement-wagons3d.js','assets/scatter-model.js','settlement-scatter.js'])
  run(fs.readFileSync(__dirname+'/../src/'+f,'utf8'));
let passed=0;
function check(name,body){body();passed++;console.log('PASS '+name)}

check('the scatter model has the seven families and no covered wagon',()=>{
  const m=run('window.ConquerScatterModel');
  assert.deepEqual([...m.families],['carts','goods','signs','wheels','materials','farm','work']);
  const names=Object.keys(m.assets);
  assert.ok(names.length>=25,'about 25 props: '+names.length);
  for(const fam of m.families)assert.ok(names.some(n=>m.assets[n].family===fam),'family '+fam+' has props');
  assert.ok(!names.some(n=>/covered/i.test(n))&&names.includes('carriageParked'),'the noble carriage replaces the covered wagon');
  for(const [n,a] of Object.entries(m.assets)){
    assert.equal(a.i.length,a.c.length*3,n+': three indices per triangle');
    assert.ok(a.i.every(i=>i>=0&&i*3<a.v.length),n+': indices in range');
    assert.ok(a.c.every(c=>c>=0&&c<m.palette.length),n+': colours from the palette');
    assert.ok(a.r>0&&a.h>0,n+': footprint radius and height');
  }
});

// A small settlement with every context: main roads through the well hub, houses of all
// levels, fields, market, tavern, church, two industries and a castle gate with towers.
run(\`
State.seed=777;State.season='summer';State.environment=[];State.relief=null;clearReliefBandCache();
const R=(id,a,b,routeId)=>({id,type:'road',a,b,width:routeId?.62:.3,auto:true,routeId});
State.structures=[
  {id:'well',type:'well',x:100,y:100},
  R('r1',{x:100,y:100},{x:115,y:100},'east'),R('r2',{x:115,y:100},{x:140,y:100},'east'),
  R('r3',{x:100,y:100},{x:85,y:100},'west'),R('r4',{x:85,y:100},{x:60,y:100},'west'),
  R('r5',{x:100,y:100},{x:100,y:115},'south'),R('r6',{x:100,y:115},{x:100,y:140},'south'),
  R('r7',{x:100,y:100},{x:100,y:85},'north'),R('r8',{x:100,y:85},{x:100,y:60},'north'),
  ...[[106,103,1],[110,103,1],[114,103,2],[106,97,2],[110,97,3],[114,97,4],[94,103,1],[90,103,3],[94,97,2]]
    .map(([x,y,l],i)=>({id:'h'+i,type:'house',x,y,w:1.5,h:1,angle:0,houseLevel:l,auto:true})),
  {id:'f1',type:'field',x:122,y:106,w:5,h:4,angle:0,auto:true},
  {id:'f2',type:'field',x:78,y:94,w:5,h:4,angle:0,auto:true},
  {id:'mk',type:'market',x:92,y:91,angle:0},{id:'tv',type:'tavern',x:108,y:110,angle:0},{id:'ch',type:'church',x:92,y:112,angle:0},
  {...window.ConquerIndustries.make('loggingCamp',{x:128,y:118}),id:'lc'},{...window.ConquerIndustries.make('quarry',{x:72,y:118}),id:'qu'},
  {id:'g1',type:'gate',x:100,y:72,w:2,h:1.4,angle:0,level:1},
  {id:'t1',type:'tower',shape:'square',size:1.6,x:96.5,y:71.5,level:1},{id:'t2',type:'tower',shape:'square',size:1.6,x:103.5,y:71.5,level:1},
  {id:'t3',type:'tower',shape:'square',size:1.6,x:100,y:64,level:1}
];
invalidateUrbanGeometry();invalidateNavigation();
\`);
const props=run('window.ConquerScatter.layout()');
const rules=run('window.ConquerScatter.RULES');

check('placement is deterministic',()=>{
  assert.ok(props.length>=20,'a dressed settlement: '+props.length+' props');
  assert.equal(JSON.stringify(run('window.ConquerScatter.layout()')),JSON.stringify(props));
});

check('props never sit on roads, buildings, fields or each other',()=>{
  const roads=run('roadList()'),polys=run("State.structures.filter(s=>s.type!=='road').flatMap(s=>s.type==='field'?[fieldPoints(s)]:urbanBuildingPolygons(s))");
  for(const p of props){
    for(const r of roads)assert.ok(run('pointSegmentDistance')(p,r.a,r.b)>=(r.width*.36)+p.r-1e-6,p.asset+' clear of road '+r.id);
    for(const pts of polys)assert.ok(!run('pointInPolygon')(p,pts),p.asset+' ('+p.ctx+') not inside a footprint');
    assert.ok(p.x>1&&p.y>1&&p.x<199&&p.y<199,'inside the map');
  }
  for(let i=0;i<props.length;i++)for(let j=i+1;j<props.length;j++)
    assert.ok(Math.hypot(props[i].x-props[j].x,props[i].y-props[j].y)>=props[i].r+props[j].r,'props do not overlap: '+props[i].asset+'/'+props[j].asset);
});

check('assets follow their context',()=>{
  const byCtx={};for(const p of props)(byCtx[p.ctx]||=[]).push(p.asset);
  for(const ctx of ['market','loggingCamp','quarry','gate','field','house1','house2','house3'])assert.ok(byCtx[ctx]?.length,'props at the '+ctx);
  assert.ok(byCtx.gate.includes('carriageParked')||byCtx.church?.includes('carriageParked'),'nobles arrive by carriage');
  for(const [ctx,list] of Object.entries(byCtx)){
    if(!rules[ctx])continue;
    const allowed=rules[ctx].map(r=>r[0]);
    for(const a of list)assert.ok(allowed.includes(a),a+' belongs to '+ctx);
  }
  assert.ok((byCtx.milestone||[]).length>0,'milestones along the main roads');
  assert.ok((byCtx.well||[]).includes('buckets'),'buckets by the well');
});

check('seasonal rules: no hay in winter',()=>{
  run("State.season='winter'");
  const winter=run('window.ConquerScatter.layout()');
  run("State.season='summer'");
  assert.ok(!winter.some(p=>p.ctx==='field'&&['haystack','hayBales'].includes(p.asset)),'fields drop hay in winter');
});

check('world mesh: one interleaved vertex per corner, shading follows the camera turn',()=>{
  const m=run('window.ConquerScatterModel'),tris=props.reduce((n,p)=>n+m.assets[p.asset].c.length,0);
  const a=run('window.ConquerScatter.worldMesh')(props,0),b=run('window.ConquerScatter.worldMesh')(props,1);
  assert.equal(a.length,tris*18);
  for(let i=3;i<a.length;i+=6)assert.ok(a[i]>=0&&a[i]<=1&&a[i+1]>=0&&a[i+1]<=1&&a[i+2]>=0&&a[i+2]<=1);
  assert.ok(a.some((v,i)=>i%6>=3&&Math.abs(v-b[i])>1e-3),'side tones change with the quarter-turn');
});
console.log('scatter regression: '+passed+' checks');
`);
