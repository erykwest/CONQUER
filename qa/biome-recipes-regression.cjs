'use strict';
// Biomes follow the COFFEE BATTLES MapEngine recipes (counts per biome, sizes scaled from its
// 90U battlefield to the 200U world): terraced hills, mountain chains, water, woods and ponds.
// Real runtime harness shared with the urban regression suite.
const fs=require('node:fs');
const harness=fs.readFileSync(__dirname+'/urban-regression.cjs','utf8').split('let passed=0;')[0];
const check=new Function('require','__dirname',harness+`
let passed=0;
const SEEDS=[12345,4242,229,777,90210,31337];
// [hills lo..hi, forests lo..hi, mountains lo..hi, water, ponds hi]
const EXPECT={
  plains:{hills:[0,0],forests:[0,1],mountains:[0,0],water:['stream',null]},
  hills:{hills:[2,4],forests:[0,1],mountains:[0,0],water:[null]},
  valley:{hills:[0,0],forests:[0,0],mountains:[3,5],water:['stream']},
  river:{hills:[0,1],forests:[0,2],mountains:[0,0],water:['river']},
  forest:{hills:[0,0],forests:[3,6],mountains:[0,0],water:['stream'],ponds:1},
  mountains:{hills:[0,2],forests:[0,0],mountains:[4,7],water:['stream']},
  sea:{hills:[0,0],forests:[0,1],mountains:[0,0],water:[null],sea:true}
};
for(const [biome,e] of Object.entries(EXPECT))for(const seed of SEEDS){
  run("State.seed="+seed+";State.biome='"+biome+"';State.structures=[];State.environment=[];State.relief=null;clearReliefBandCache();generateRelief();generateEnvironment()");
  const r=run("(()=>{const env=State.environment,forests=env.filter(f=>f.type==='forest'),water=env.find(f=>f.type==='stream'||f.type==='river');"+
    "const hills=State.relief.hills;const onWater=forests.some(f=>water&&water.points.some((p,i)=>i&&[0,.25,.5,.75,1].some(t=>pointInPolygon({x:water.points[i-1].x+(p.x-water.points[i-1].x)*t,y:water.points[i-1].y+(p.y-water.points[i-1].y)*t},f.points))));"+
    "const onHill=forests.some(f=>hills.some(h=>polygonsOverlapSimple(f.points,h.levels[0].top)));"+
    "const town={x:WORLD/2,y:WORLD/2},townCovered=hills.some(h=>pointInPolygon(town,h.levels[0].top))||forests.some(f=>pointInPolygon(town,f.points));"+
    "return{hills:hills.length,maxHeight:Math.max(0,...hills.map(h=>h.maxHeight)),forests:forests.length,mountains:env.filter(f=>f.type==='mountain').length,"+
    "ponds:env.filter(f=>f.type==='pond').length,water:water?.type||null,sea:env.some(f=>f.type==='sea'),"+
    "forestRadius:forests.map(f=>Math.sqrt(f.rx*f.ry)),onWater,onHill,townCovered,ovals:env.some(f=>f.type==='hill'||f.type==='rough')}})()");
  const tag=biome+' seed '+seed+': ';
  assert.ok(r.hills>=e.hills[0]&&r.hills<=e.hills[1],tag+'hills '+r.hills);
  assert.ok(r.forests>=e.forests[0]&&r.forests<=e.forests[1],tag+'forests '+r.forests);
  assert.ok(r.mountains>=e.mountains[0]&&r.mountains<=e.mountains[1],tag+'mountains '+r.mountains);
  assert.ok(e.water.includes(r.water),tag+'water '+r.water);
  assert.ok(r.ponds<=(e.ponds||0),tag+'ponds '+r.ponds);
  assert.equal(r.sea,!!e.sea,tag+'sea');
  assert.ok(r.maxHeight<=4,tag+'hill height '+r.maxHeight);
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
console.log('PASS '+passed+' biome maps follow the COFFEE BATTLES recipes');
`);
check(require,__dirname);
