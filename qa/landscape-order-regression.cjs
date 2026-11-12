"use strict";
const fs=require('node:fs');
const harness=fs.readFileSync(__dirname+'/urban-regression.cjs','utf8').split('let passed=0;')[0];
new Function('require','__dirname',harness+`
run(fs.readFileSync(__dirname+'/../src/regional-biome-rules.js','utf8'));run(moduleFile('regional-landscape'));run(moduleFile('hydrology'));
run('globalThis.qaCompose=window.ConquerHydrology.compose;window.ConquerHydrology.compose=env=>{if(env.some(f=>f.type==="forest"||f.waterBodyKind==="marsh"))throw Error("cover generated before drainage");return qaCompose(env)}');
run('globalThis.qaObstacle={type:"mountain",points:[{x:80,y:65},{x:120,y:65},{x:120,y:135},{x:80,y:135}]};globalThis.qaLine={id:"main",type:"river",width:4.4,points:[{x:100,y:0},{x:100,y:200}]};globalThis.qaRouted=window.ConquerHydrology.routeRelief(qaLine,[qaObstacle])');
assert.ok(run('qaRouted?.reliefRouted'),'river detours instead of deleting a hill');
assert.equal(run('qaRouted.points.some(window.ConquerHydrology.terrainGuard([qaObstacle],qaLine.width/2+1))'),false,'whole river bank clears relief');
for(const [biome,seed] of [['plains',1],['plains',4],['forest',1],['forest',3],['swamp',7],['swamp',8]]){
 run('State.seed='+seed+';State.biome='+JSON.stringify(biome)+';window.__CONQUER_REGIONAL_DEMO__={};State.environment=[];State.structures=[];State.relief=null;generateRelief()');
 const hills=run('JSON.stringify(State.relief.hills)');run('generateEnvironment()');
 assert.equal(run('JSON.stringify(State.relief.hills)'),hills,'final drainage preserves hills: '+biome+' '+seed);
 assert.ok(run('(()=>{const lines=State.environment.filter(f=>f.type==="river"||f.type==="stream"),obstacles=State.relief.hills.map(h=>({type:"mountain",points:reliefHillFootprint(h)}));return lines.every(l=>!l.points.some(window.ConquerHydrology.terrainGuard(obstacles,l.width/2+1)))})()'),'water banks avoid hills');
 assert.ok(run('(()=>{for(let y=1;y<200;y+=2)for(let x=1;x<200;x+=2){const p={x,y},cover=State.environment.some(f=>(f.type==="forest"||f.waterBodyKind==="marsh")&&environmentContains(f,p));if(cover&&((terrainElevation(p)>.05&&State.environment.some(f=>f.waterBodyKind==="marsh"&&environmentContains(f,p)))||State.environment.some(f=>(f.type==="river"||f.type==="stream")&&environmentContains(f,p))))return false}return true})()'),'marsh avoids relief; all cover avoids final streams: '+biome+' '+seed);
}
console.log('PASS landscape order: preserved hills, routed primary, clear banks, dry marsh relief and no cover/water overlap in six fixtures');
`)(require,__dirname);
