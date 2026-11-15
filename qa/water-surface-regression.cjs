'use strict';
const fs=require('node:fs');
const harness=fs.readFileSync(__dirname+'/urban-regression.cjs','utf8').split('let passed=0;')[0];
new Function('require','__dirname',harness+`
run(moduleFile('hydrology'));
for(const seed of [1,42,229,777,4242,12345])for(const type of ['sea','pond']){
 run('State.seed='+seed+';State.environment=[]');
 const result=run('(()=>{const receiver={id:"body",type:'+JSON.stringify(type)+',waterBodyKind:"lake",points:[{x:0,y:150},{x:200,y:150},{x:200,y:200},{x:0,y:200}]};const river=window.ConquerHydrology.mouth({id:"main",type:"river",width:4.4,points:Array.from({length:81},(_,i)=>({x:100+Math.sin(i/9)*5,y:i*2.5}))},[receiver]);const branches=window.ConquerHydrology.distributaries(river,[receiver]);return {count:branches.length,valid:branches.every(f=>f.delta.startFraction>=.7&&f.delta.startFraction<.8&&f.width<river.width&&environmentContains(river,f.points[0])&&environmentContains(receiver,f.points.at(-1))),shore:lakeShoreBands(receiver),edgeCovered:lakeShoreBands(receiver).some(poly=>pointInPolygon({x:100,y:199},poly))}})()');
 assert.equal(result.count,type==='sea'?2:0,'sea delta / direct lake mouth for '+seed+' '+type);assert.equal(result.valid,true);
 if(type==='pond'){assert.ok(result.shore.length>0,'lake has real shore bands');assert.equal(result.edgeCovered,false,'world edge is not a lake bank');assert.ok(result.shore.flat().every(p=>p.x>=0&&p.x<=200&&p.y>=0&&p.y<=200),'shore clipped to world');}
 else assert.equal(result.shore.length,0,'sea keeps existing coast renderer');
}
console.log('PASS water surface: sea delta in final 30 percent and direct lake mouths, twelve sea/lake fixtures, connected narrower branches and clipped lake banks');
`)(require,__dirname);
