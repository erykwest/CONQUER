"use strict";
const fs=require('node:fs');
const harness=fs.readFileSync(__dirname+'/urban-regression.cjs','utf8').split('let passed=0;')[0];
new Function('require','__dirname',harness+`
run(fs.readFileSync(__dirname+'/../src/regional-biome-rules.js','utf8'));run(moduleFile('regional-landscape'));run(moduleFile('hydrology'));


for(const seed of [1,4,10]){
 run('State.seed='+seed+';State.biome="hills";window.__CONQUER_REGIONAL_DEMO__={};State.environment=[];State.structures=[];State.relief=null;generateRelief();generateEnvironment()');
 const m=run('(()=>{const hills=State.relief.hills,angles=hills.map(h=>{const p=reliefHillFootprint(h),cx=p.reduce((s,q)=>s+q.x,0)/p.length,cy=p.reduce((s,q)=>s+q.y,0)/p.length;let xx=0,yy=0,xy=0;for(const q of p){xx+=(q.x-cx)**2;yy+=(q.y-cy)**2;xy+=(q.x-cx)*(q.y-cy)}return .5*Math.atan2(2*xy,xx-yy)});return{count:hills.length,rows:new Set(hills.map(h=>Math.round(h.center.y))).size,alignment:Math.hypot(angles.reduce((s,a)=>s+Math.cos(2*a),0),angles.reduce((s,a)=>s+Math.sin(2*a),0))/hills.length,coverage:estimateReliefCoverage(80)}})()');
 assert.ok(m.rows>=Math.min(4,m.count),'hill centres must not occupy two regular rows: '+JSON.stringify(m));
 assert.ok(m.alignment<.90,'hill axes must have varied orientations: '+JSON.stringify(m));
 assert.ok(m.count>=4&&m.count<=8&&m.coverage>=.30,'quantities retained');
}
run('State.biome="hills";State.seed=1;window.__CONQUER_REGIONAL_DEMO__={mountainSides:["north"]}');
const ys=run('biomeMountains().map(p=>p.y)');assert.ok(Math.max(...ys)-Math.min(...ys)>22,'mountain band must disperse transversely');
console.log('PASS organic relief: irregular centres, varied orientations, retained coverage and dispersed mountain band');
`)(require,__dirname);
