"use strict";
const fs=require('node:fs');
const harness=fs.readFileSync(__dirname+'/urban-regression.cjs','utf8').split('let passed=0;')[0];
new Function('require','__dirname',harness+`
run(fs.readFileSync(__dirname+'/../src/regional-biome-rules.js','utf8'));run(moduleFile('regional-landscape'));run(moduleFile('hydrology'));
const dirs=['north','northEast','east','southEast','south','southWest','west','northWest'];
const signatures=new Set();
for(const seed of [4242,229,90210])for(const land of [null,'north','east','south','west']){
 const water=seed===90210?'lake':'sea';
 const neighbors=Object.fromEntries(dirs.map(d=>[d,'plains']));
 for(const d of ['north','east','south','west'])if(d!==land)neighbors[d]=water;
 for(const [d,a,b] of [['northEast','north','east'],['southEast','south','east'],['southWest','south','west'],['northWest','north','west']])if(neighbors[a]===water&&neighbors[b]===water)neighbors[d]=water;
 run('window.__CONQUER_REGIONAL_DEMO__={surroundingBiomes:'+JSON.stringify(neighbors)+'};State.seed='+seed+';State.biome="plains";State.environment=[];State.structures=[];State.relief=null;generateRelief();generateEnvironment()');
 const m=run('(()=>{const seas=State.environment.filter(f=>(f.type==="sea"||f.waterBodyKind==="lake")),wet=p=>seas.some(f=>environmentContains(f,p));const dry=[];for(let y=1;y<200;y+=2)for(let x=1;x<200;x+=2)if(!wet({x,y}))dry.push({x,y});const xs=dry.map(p=>p.x),ys=dry.map(p=>p.y),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);return {centerWet:wet({x:100,y:100}),bounds:[minX,maxX,minY,maxY],fill:dry.length*4/((maxX-minX+2)*(maxY-minY+2)),shape:JSON.stringify(seas.map(f=>[f.points,f.holes])),edges:{north:wet({x:100,y:1}),east:wet({x:199,y:100}),south:wet({x:100,y:199}),west:wet({x:1,y:100})}}})()');
 assert.equal(m.centerWet,false,'settlement centre remains land');
 assert.ok(run('State.relief.hills.length')>=3,'islands and peninsulas retain the high coastal hill budget');
 assert.ok(run('State.relief.hills.every(h=>!reliefHillFootprint(h).some(p=>State.environment.some(f=>(f.type==="sea"||f.waterBodyKind==="lake")&&environmentContains(f,p))))'),'coastal hills stay on dry land');
 if(land)assert.equal(m.edges[land],false,'peninsula attached on '+land);
 else{assert.ok(Object.values(m.edges).every(Boolean),'island surrounded by sea');assert.ok(m.fill<.86,'island must not fill its rectangular bounds: '+m.fill);assert.ok(m.bounds.every(v=>v>0&&v<200),'island stays inside world');signatures.add(m.shape)}
 const before=run('JSON.stringify(State.environment)');run('State.relief=null;generateRelief();generateEnvironment()');assert.equal(run('JSON.stringify(State.environment)'),before,'deterministic coastline');
}
assert.equal(signatures.size,3,'different seeds produce different island silhouettes');
console.log('PASS organic island/peninsula coasts: 15 fixtures, irregular bounds, enclosed islands, four land attachments, dry centre and determinism');
`)(require,__dirname);
