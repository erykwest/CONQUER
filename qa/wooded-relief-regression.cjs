"use strict";
const fs=require('node:fs');
const harness=fs.readFileSync(__dirname+'/urban-regression.cjs','utf8').split('let passed=0;')[0];
new Function('require','__dirname',harness+`
for(const seed of [1,3,4242]){
 run('State.seed='+seed+';State.biome="hills";State.environment=[];State.structures=[];State.relief=null;generateRelief();State.environment=[{id:"qa-wood",type:"forest",continuous:true,points:[{x:0,y:0},{x:200,y:0},{x:200,y:200},{x:0,y:200}],holes:[],x:100,y:100,rx:100,ry:100}];clearForestLayoutCache()');
 const m=run('(()=>{const f=State.environment[0],trees=forestTreeLayout(f);let steep=0;for(let y=1;y<200;y+=2)for(let x=1;x<200;x+=2){const p={x,y};if(terrainSlopeKind(p)==="steep"){steep++;if(environmentContains(f,p))throw Error("cliff still blocked by forest")}}return {steep,elevated:trees.filter(t=>t.z>.1).length,sloping:trees.filter(t=>t.slope==="gentle").length,valid:trees.every(t=>Math.abs(t.z-terrainElevation(t.p))<1e-8&&terrainSlopeKind(t.p)!=="steep"),repeat:JSON.stringify(trees)===JSON.stringify(continuousForestTrees(f))}})()');
 assert.ok(m.elevated>10,'wood on summits');assert.ok(m.sloping>3,'wood on gentle slopes');assert.ok(m.steep>0,'exposed rocky faces');assert.ok(m.valid,'trees rooted at real elevation');assert.ok(m.repeat,'deterministic tree positions');
 const before=run('State.environment.length');run('repairForestsAgainstSteepSlopes()');assert.equal(run('State.environment.length'),before,'repair does not delete wooded hills');
}
console.log('PASS wooded relief: summit and slope trees at actual elevation, exposed cliffs, deterministic layout and retained woodland across three seeds');
`)(require,__dirname);
