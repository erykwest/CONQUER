"use strict";
const fs=require('node:fs');
const harness=fs.readFileSync(__dirname+'/urban-regression.cjs','utf8').split('let passed=0;')[0];
new Function('require','__dirname',harness+`
run(moduleFile('hydrology'));
for(const fixture of [{biome:'forest',seed:9},{biome:'plains',seed:12345},{biome:'swamp',seed:1},{biome:'plains',seed:12345,river:true},{biome:'plains',seed:12345,river:true,flow:{x:0,y:-1,source:'regional'}},{biome:'plains',seed:12345,river:true,flow:{x:0,y:1,source:'regional'}}]){
 run('window.__CONQUER_REGIONAL_DEMO__='+JSON.stringify(fixture.river?{hasRiver:true,riverSides:['north','east'],riverFlow:fixture.flow}: {})+';State.seed='+fixture.seed+';State.biome='+JSON.stringify(fixture.biome)+';State.structures=[];State.relief=null;State.environment=[];generateRelief();generateEnvironment()');
 const data=run('(()=>{const lines=State.environment.filter(f=>["river","stream"].includes(f.type)&&!f.delta),main=lines.find(f=>f.drainagePrimary);return {main:main?.id,type:main?.type,streams:lines.filter(f=>f.type==="stream").length,branches:lines.filter(f=>main&&f!==main).map(f=>{const end=f.points.at(-1),before=f.points.at(-2);let best=null;for(let i=1;i<main.points.length;i++){const a=main.points[i-1],b=main.points[i],d=pointSegmentDistance(end,a,b);if(!best||d<best.d)best={d,x:b.x-a.x,y:b.y-a.y}}const start=f.points[0],dx=end.x-start.x,dy=end.y-start.y,len=Math.hypot(dx,dy)||1,ax=main.points.at(-1).x-main.points[0].x,ay=main.points.at(-1).y-main.points[0].y;return{heading:{x:dx/len,y:dy/len},parallel:Math.abs((dx*ax+dy*ay)/(len*(Math.hypot(ax,ay)||1))),parent:f.confluence?.downstreamId,point:end,arc:f.confluence?.arcDistance,side:f.confluence?.bankSide,cos:((end.x-before.x)*best.x+(end.y-before.y)*best.y)/(Math.hypot(end.x-before.x,end.y-before.y)*Math.hypot(best.x,best.y))}})}})()');
 assert.ok(data.main,'one explicit primary');
 if(fixture.river)assert.equal(data.type,'river','river always primary');
 assert.ok(data.streams>=2,'fixture keeps multiple streams');
 for(const b of data.branches){assert.equal(b.parent,data.main,'every tributary drains directly to the primary');assert.ok(b.parallel<=.750001,'tributary cannot follow primary in parallel');assert.ok(Math.abs(b.cos-Math.cos(Math.PI/6))<.015,'30 degree junction directed downstream');}
 if(data.branches.length>1)assert.notEqual(data.branches[0].side,data.branches[1].side,'first two tributaries enter opposite banks');
 for(let i=0;i<data.branches.length;i++)for(let j=i+1;j<data.branches.length;j++){assert.ok(data.branches[i].heading.x*data.branches[j].heading.x+data.branches[i].heading.y*data.branches[j].heading.y<=.860001,'tributaries cannot have parallel headings');assert.ok(Math.hypot(data.branches[i].point.x-data.branches[j].point.x,data.branches[i].point.y-data.branches[j].point.y)>=18,'separate mouths');assert.ok(Math.abs(data.branches[i].arc-data.branches[j].arc)>=28,'mouths spaced along primary');}
 assert.ok(run('State.environment.filter(f=>f.type==="forest"&&Number.isInteger(f.naturalHoleCount)).every(f=>f.holes.length===f.naturalHoleCount+State.environment.filter(g=>["stream","river"].includes(g.type)).length)'),'only final banks carve woodland; no ghost stream clearings');
 const before=run('JSON.stringify(State.environment)');run('State.relief=null;generateRelief();generateEnvironment()');assert.equal(run('JSON.stringify(State.environment)'),before);
}
console.log('PASS drainage hierarchy: river priority, one primary, downstream 30 degree tributaries, distinct spaced mouths and determinism');
`)(require,__dirname);
