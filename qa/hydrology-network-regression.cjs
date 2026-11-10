'use strict';
const fs=require('node:fs'),rules=require('../src/regional-biome-rules.js'),assert=require('node:assert/strict');
const e=(a,b)=>({start:{x:a[0],y:a[1]},end:{x:b[0],y:b[1]}});
const bend=[e([0,0],[10,10]),e([10,10],[20,0])],fork=[...bend,e([10,10],[10,20])];
assert.equal(rules.riverJunctionCount(bend,bend),0,'a bend is not a confluence');
assert.equal(rules.riverJunctionCount(bend,fork),1,'regional degree-three vertex is a confluence');
assert.equal(rules.isSelectableTerrain('sea'),false);assert.equal(rules.isSelectableTerrain('lake'),false);assert.equal(rules.isSelectableTerrain('swamp'),true);
const harness=fs.readFileSync(__dirname+'/urban-regression.cjs','utf8').split('let passed=0;')[0];
new Function('require','__dirname',harness+`
run(moduleFile('hydrology'));
run('window.__CONQUER_REGIONAL_DEMO__={};State.biome="plains";State.relief=null;State.environment=[]');
for(const receiverType of ['sea','pond']){
 const result=run('(()=>{const receiver={id:"receiver",type:'+JSON.stringify(receiverType)+',points:[{x:0,y:150},{x:200,y:150},{x:200,y:200},{x:0,y:200}]};const line={id:"main",type:"river",width:4.4,points:[{x:75,y:0},{x:75,y:200}]};const f=window.ConquerHydrology.mouth(line,[receiver]);return {mouth:f.mouth,inside:environmentContains(receiver,f.points.at(-1)),last:f.points.at(-1),length:f.points.length}})()');
 assert.equal(result.mouth.kind,receiverType==='sea'?'sea':'lake');assert.equal(result.inside,true,'mouth ends inside receiving water');
 assert.ok(result.last.y<155,'river trimmed at shore instead of crossing water');
}
assert.equal(run('window.ConquerHydrology.compose([{id:"main",type:"river",width:4.4,points:[{x:80,y:0},{x:80,y:200}]},{id:"small-pool",type:"pond",points:[{x:60,y:90},{x:100,y:90},{x:100,y:110},{x:60,y:110}]}]).find(f=>f.id==="main").mouth'),undefined,'ordinary small pond must not become an automatic river outlet');
for(const [mainType,branchType] of [['river','river'],['river','stream'],['stream','stream']]){
 const result=run('(()=>{const line=(type,id,a,b)=>({type,id,width:type==="river"?4.4:1.8,points:Array.from({length:61},(_,i)=>({x:a.x+(b.x-a.x)*i/60,y:a.y+(b.y-a.y)*i/60}))});const main=line('+JSON.stringify(mainType)+',"main",{x:100,y:0},{x:100,y:200}),branch=line('+JSON.stringify(branchType)+',"branch",{x:0,y:80},{x:200,y:120});const f=window.ConquerHydrology.join(branch,[main],[],[]);return {kind:f.type,link:f.confluence,connected:environmentContains(main,f.points.at(-1))}})()');
 assert.equal(result.kind,branchType);assert.equal(result.link.downstreamId,'main');assert.equal(result.connected,true);
}
run(fs.readFileSync(__dirname+'/../src/regional-biome-rules.js','utf8'));run(moduleFile('regional-landscape'));
run('window.__CONQUER_REGIONAL_DEMO__={hasRiver:true,riverSides:["north","east"],tributaryTypes:["river","stream"],surroundingBiomes:{north:"plains",northEast:"plains",east:"plains",southEast:"sea",south:"sea",southWest:"sea",west:"plains",northWest:"plains"}};State.seed=4242;State.biome="plains";State.relief=null;State.environment=[];State.structures=[];generateRelief();generateEnvironment()');
assert.ok(run('State.environment.some(f=>f.mouth)'), 'real generator has mouth');
assert.ok(run('State.environment.filter(f=>f.delta).length>=2'),'mouth has distributaries');
assert.ok(run('State.environment.filter(f=>f.delta).every(f=>{const parent=State.environment.find(p=>p.id===f.delta.parentId),body=State.environment.find(b=>b.id===f.mouth.receiverId);return parent&&f.delta.startFraction>=.8&&f.delta.startFraction<1&&f.width<parent.width&&environmentContains(parent,f.points[0])&&body&&environmentContains(body,f.points.at(-1))})'),'delta branches start in final 20 percent, connect parent and reach receiver');
const deltaWidths=run('State.environment.filter(f=>f.delta).map(f=>f.width).join()');run('widenWatercourses()');assert.equal(run('State.environment.filter(f=>f.delta).map(f=>f.width).join()'),deltaWidths,'reload keeps narrower delta branches');

assert.ok(run('State.environment.some(f=>f.type==="river"&&f.confluence)'), 'real generator has river confluence');
assert.ok(run('State.environment.some(f=>f.type==="stream"&&f.confluence)'), 'real generator has stream confluence');
assert.ok(run('State.environment.filter(f=>f.confluence).every(f=>{const downstream=State.environment.find(g=>g.id===f.confluence.downstreamId);return downstream&&environmentContains(downstream,f.points.at(-1))})'),'all tributaries touch downstream water');
const first=run('JSON.stringify(State.environment)');run('State.relief=null;State.environment=[];generateRelief();generateEnvironment()');assert.equal(run('JSON.stringify(State.environment)'),first,'network deterministic');
console.log('PASS hydrology: real mouths to sea/lake, river/river, stream/river and stream/stream junctions, regional topology and deterministic generation');
`)(require,__dirname);
