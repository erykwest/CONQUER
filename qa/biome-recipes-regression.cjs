'use strict';
// Biomes follow the COFFEE BATTLES MapEngine recipes (counts per biome, sizes scaled from its
// 90U battlefield to the 200U world): terraced hills, mountain chains, water, woods and ponds.
// Foresta is one woodland over the map with ~20% clearings; the sea covers at most 20%;
// watercourses meander; mountain chains have steep main peaks plus ~2x secondary summits.
// Real runtime harness shared with the urban regression suite.
const fs=require('node:fs');
const harness=fs.readFileSync(__dirname+'/urban-regression.cjs','utf8').split('let passed=0;')[0];
const check=new Function('require','__dirname',harness+`
let passed=0;
const SEEDS=[12345,4242,229,777,90210,31337];
const EXPECT={
  plains:{hills:[0,0],forests:[0,1],mountains:[0,0],water:['stream',null]},
  hills:{hills:[2,4],forests:[0,1],mountains:[0,0],water:[null]},
  valley:{hills:[0,0],forests:[0,0],mountains:[3,5],water:['stream']},
  river:{hills:[0,1],forests:[0,2],mountains:[0,0],water:['river']},
  forest:{hills:[0,0],forests:[1,1],mountains:[0,0],water:['stream'],ponds:1,continuous:true},
  mountains:{hills:[1,60],forests:[0,0],mountains:[4,7],water:['stream'],hillCoverage:.30},
  sea:{hills:[0,0],forests:[0,1],mountains:[0,0],water:[null],sea:true}
};
for(const [biome,e] of Object.entries(EXPECT))for(const seed of SEEDS){
  run("State.seed="+seed+";State.biome='"+biome+"';State.structures=[];State.environment=[];State.relief=null;clearReliefBandCache();generateRelief();generateEnvironment()");
  const r=run("(()=>{const env=State.environment,forests=env.filter(f=>f.type==='forest'),water=env.find(f=>f.type==='stream'||f.type==='river');"+
    "const hills=State.relief.hills,inForest=p=>forests.some(f=>environmentContains(f,p));"+
    "const onWater=!!water&&water.points.some((p,i)=>i&&[0,.25,.5,.75].some(t=>inForest({x:water.points[i-1].x+(p.x-water.points[i-1].x)*t,y:water.points[i-1].y+(p.y-water.points[i-1].y)*t})));"+
    "const onHill=forests.some(f=>!f.continuous&&hills.some(h=>polygonsOverlapSimple(f.points,h.levels[0].top)));"+
    "const town={x:WORLD/2,y:WORLD/2},townCovered=hills.some(h=>pointInPolygon(town,h.levels[0].top))||inForest(town);"+
    "const sea=env.find(f=>f.type==='sea'),area=pts=>Math.abs(pts.reduce((s,p,i)=>s+p.x*pts[(i+1)%pts.length].y-pts[(i+1)%pts.length].x*p.y,0))/2;"+
    "const len=water?water.points.slice(1).reduce((s,p,i)=>s+Math.hypot(p.x-water.points[i].x,p.y-water.points[i].y),0):0;"+
    "const span=water?Math.hypot(water.points.at(-1).x-water.points[0].x,water.points.at(-1).y-water.points[0].y):1;"+
    "const peaks=env.filter(f=>f.type==='mountain'&&!f.subPeak),subs=env.filter(f=>f.type==='mountain'&&f.subPeak);"+
    "let open=0;const N=50;for(let iy=0;iy<N;iy++)for(let ix=0;ix<N;ix++)if(!inForest({x:(ix+.5)*WORLD/N,y:(iy+.5)*WORLD/N}))open++;"+
    "return{hills:hills.length,maxHeight:Math.max(0,...hills.map(h=>h.maxHeight)),forests:forests.length,continuous:forests.some(f=>f.continuous),"+
    "open:open/(N*N),peaks:peaks.length,subs:subs.length,"+
    "slopes:[...peaks,...subs].map(m=>m.slopeDeg),slopeOk:[...peaks,...subs].every(m=>Math.abs(Math.atan(m.height/Math.sqrt(m.rx*m.ry))*180/Math.PI-m.slopeDeg)<1e-6),"+
    "tallestSlope:[...peaks,...subs].sort((a,b)=>b.height-a.height)[0]?.slopeDeg,reliefCoverage:estimateReliefCoverage(48),"+
    "insideMap:env.filter(f=>f.type==='mountain').every(m=>m.points.every(p=>p.x>=-1e-6&&p.x<=WORLD+1e-6&&p.y>=-1e-6&&p.y<=WORLD+1e-6)),"+
    "ponds:env.filter(f=>f.type==='pond').length,water:water?.type||null,sea:!!sea,seaShare:sea?area(sea.points)/(WORLD*WORLD):0,sinuosity:len/span,"+
    "forestRadius:forests.filter(f=>!f.continuous).map(f=>Math.sqrt(f.rx*f.ry)),onWater,onHill,townCovered,ovals:env.some(f=>f.type==='hill'||f.type==='rough')}})()");
  const tag=biome+' seed '+seed+': ';
  assert.ok(r.hills>=e.hills[0]&&r.hills<=e.hills[1],tag+'hills '+r.hills);
  assert.ok(r.forests>=e.forests[0]&&r.forests<=e.forests[1],tag+'forests '+r.forests);
  assert.ok(r.peaks>=e.mountains[0]&&r.peaks<=e.mountains[1],tag+'main peaks '+r.peaks);
  if(r.peaks){
    assert.ok(r.subs>=r.peaks*2-1&&r.subs<=r.peaks*2+1,tag+'secondary summits '+r.subs+' for '+r.peaks+' peaks');
    assert.ok(r.slopes.every(d=>d>=40-1e-9&&d<=60+1e-9)&&r.slopeOk,tag+'mountain slopes within 40-60deg');
    assert.ok(Math.abs(r.tallestSlope-60)<1e-6,tag+'tallest summit at 60deg');
    assert.ok(r.insideMap,tag+'mountains clipped to the map');
  }else assert.equal(r.subs,0,tag+'no secondary summits without a chain');
  assert.ok(e.water.includes(r.water),tag+'water '+r.water);
  if(r.water)assert.ok(r.sinuosity>=1.12,tag+'watercourse too straight: '+r.sinuosity.toFixed(3));
  assert.ok(r.ponds<=(e.ponds||0),tag+'ponds '+r.ponds);
  assert.equal(r.sea,!!e.sea,tag+'sea');
  assert.ok(r.seaShare<=.20+1e-9,tag+'sea covers '+(100*r.seaShare).toFixed(1)+'%');
  assert.equal(r.continuous,!!e.continuous,tag+'continuous woodland');
  if(e.continuous)assert.ok(r.open>=.18&&r.open<=.40,tag+'open ground '+(100*r.open).toFixed(1)+'%');
  assert.ok(r.maxHeight<=4,tag+'hill height '+r.maxHeight);
  if(e.hillCoverage)assert.ok(r.reliefCoverage>=e.hillCoverage-.02,tag+'hill coverage '+(100*r.reliefCoverage).toFixed(1)+'%');
  // Scaled COFFEE BATTLES sizes: small woods 11-15.4 x 6.6-8.8U, large 17.6-22 x 8.8-12.1U.
  for(const rad of r.forestRadius)assert.ok(rad>=8.5&&rad<=16.4,tag+'forest radius '+rad.toFixed(1));
  assert.equal(r.onWater,false,tag+'woods must leave the watercourse open');
  assert.equal(r.onHill,false,tag+'woods must not overlap hills');
  assert.equal(r.townCovered,false,tag+'settlement hub must stay clear');
  assert.equal(r.ovals,false,tag+'no obsolete hill/rough ellipses');
  passed++;
}
for(const [biome,e] of Object.entries(EXPECT)){
  const hills=SEEDS.reduce((n,seed)=>{run("State.seed="+seed+";State.biome='"+biome+"';State.relief=null;generateRelief()");return n+run('State.relief.hills.length')},0);
  if(biome==='hills')assert.ok(hills>=SEEDS.length*3,'hills biome should usually place 3-4 hills, got '+hills);
}
// Main roads cut a groove through the continuous woodland instead of failing.
run("State.seed=4242;State.biome='forest';State.structures=[];State.environment=[];State.relief=null;clearReliefBandCache();generateRelief();generateEnvironment()");
assert.equal(run("environmentBlocksPoint({x:100,y:3},'road')"),true,'woodland blocks ordinary roads');
assert.equal(run("primaryRoadTerrainBlocked({x:100,y:3})"),false,'main roads may enter the woodland');
run("globalThis.qaGroove={id:'qa-main',type:'road',auto:true,routeId:'arterial-0',a:{x:100,y:80},b:{x:100,y:20},width:.62};carveForestGroove(qaGroove)");
assert.equal(run("environmentBlocksPoint({x:100,y:50},'road')"),false,'groove opens the woodland along the main road');
assert.equal(run("environmentBlocksPoint({x:100+FOREST_GROOVE_HALF+1.5,y:50},'road')"),true,'trees remain beside the groove');
console.log('PASS '+passed+' biome maps follow the COFFEE BATTLES recipes; main roads cut woodland grooves');
`);
check(require,__dirname);
