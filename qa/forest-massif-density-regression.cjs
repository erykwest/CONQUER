'use strict';
// Verify that the new generator produces fewer, larger woodland masses while
// leaving the river corridor open. No DOM, rendering or saved-game mocks needed.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const world=fs.readFileSync(__dirname+'/../src/settlement-world.js','utf8');
const landscape=fs.readFileSync(__dirname+'/../src/settlement-landscape.js','utf8');
const section=(start,end)=>{
  const a=world.indexOf(start),b=world.indexOf(end,a+1);
  assert.ok(a>=0&&b>a,'source segment '+start);return world.slice(a,b);
};
const setup=`
const WORLD=200, State={seed:0,biome:'',environment:[],relief:{hills:[]}};
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function pointSegmentDistance(p,a,b){
 const x=b.x-a.x,y=b.y-a.y,d=x*x+y*y,t=clamp(d?((p.x-a.x)*x+(p.y-a.y)*y)/d:0,0,1);
 return Math.hypot(p.x-a.x-t*x,p.y-a.y-t*y);
}
const forestIntersectsSteepRelief=()=>false,environmentConflictsTestRelief=()=>false;
`;
const seedRand=landscape.slice(landscape.indexOf('function seedRand('),landscape.indexOf('function mixWorld('));
const evaluate=new Function(setup+seedRand+
  section('function biomeHash(','const LANDSCAPE_GENERATION_VERSION')+
  section('function randomEnvPoint(','const FOREST_TERRAIN_RULE_VERSION')+
  section('const ENV_POLYGON_BOUNDS=','function environmentContains(')+`
 return (seed,biome)=>{
  State.seed=seed;State.biome=biome;generateEnvironment();
  const woods=State.environment.filter(f=>f.type==='forest');
  const water=State.environment.filter(f=>f.type==='stream'||f.type==='river');
  let coversWater=false;
  for(const f of woods)for(const river of water){
    for(let j=1;j<river.points.length;j++){
      const a=river.points[j-1],b=river.points[j],steps=Math.max(1,Math.ceil(dist(a,b)));
      for(let k=0;k<=steps;k++){
        const p={x:a.x+(b.x-a.x)*k/steps,y:a.y+(b.y-a.y)*k/steps};
        if(pointInPolygon(p,f.points))coversWater=true;
      }
    }
  }
  return {count:woods.length,coverage:estimateForestCoverage(State.environment),
    meanRadius:woods.reduce((sum,f)=>sum+Math.sqrt(f.rx*f.ry),0)/woods.length,coversWater};
 };
`)();
for(const [seed,biome,maxCount,minMean] of [
  [12345,'plains',13,16],[4242,'forest',20,16],[229,'river',13,16],[777,'hills',13,16]
]){
  const result=evaluate(seed,biome);
  assert.ok(result.count>0&&result.count<=maxCount,biome+' woodland count '+result.count);
  assert.ok(result.meanRadius>=minMean,biome+' average nominal woodland radius '+result.meanRadius);
  assert.equal(result.coversWater,false,biome+' riverbed must remain tree-free');
  console.log('PASS '+biome+' : '+result.count+' woods; mean radius '+
    result.meanRadius.toFixed(1)+'U; coverage '+(100*result.coverage).toFixed(1)+'%');
}
