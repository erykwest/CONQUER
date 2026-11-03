'use strict';
const fs=require('node:fs');
const harness=fs.readFileSync(__dirname+'/urban-regression.cjs','utf8').split('let passed=0;')[0];
new Function('require','__dirname',harness+`
run(moduleFile('collapse'));run(moduleFile('fire'));run(moduleFile('wallwalk'));
run('function requestSceneDraw(){}');
let passed=0;function test(name,fn){fn();passed++;console.log('PASS '+name)}
function setup(){run("State.structures=[];State.fire=null;State.siege=null;State.relief={hills:[],seed:12345};State.clock={day:20,speed:0};State.village={founded:false};invalidateNavigation()")}
test('cooperative and synchronous A* return the same collision-checked route',()=>{
 setup();run("State.structures=[{id:'well',type:'well',x:100,y:100},{id:'house',type:'house',auto:true,houseLevel:2,x:102,y:100,w:1.5,h:1}];invalidateNavigation();globalThis.qaFrom={x:98,y:100};globalThis.qaTo={x:106,y:100};globalThis.qaSync=findPeasantPath(qaFrom,qaTo,null);globalThis.qaWork=findPeasantPathWork(qaFrom,qaTo,null);globalThis.qaYields=0;globalThis.qaNext=qaWork.next();while(!qaNext.done){qaYields++;qaNext=qaWork.next()}");
 assert.ok(run('qaYields>1&&qaSync.length>2'));
 assert.equal(run('JSON.stringify(qaSync)'),run('JSON.stringify(qaNext.value)'));
 assert.equal(run('qaSync.slice(1).every((p,i)=>peasantSegmentClear(qaSync[i],p,null))'),true);
});
test('well tangents cannot pass smoothing and then block the smaller movement step',()=>{
 setup();run("State.structures=[{id:'well',type:'well',x:99,y:107}];globalThis.qaFrom={x:99.9,y:107};globalThis.qaTo={x:99.5,y:106}");
 assert.equal(run('peasantSegmentClear(qaFrom,qaTo,null)'),false);
 run('globalThis.qaPath=findPeasantPath(qaFrom,qaTo,null)');
 assert.ok(run('qaPath&&qaPath.length>2'));
 assert.equal(run('qaPath.slice(1).every((p,i)=>{const a=qaPath[i],L=dist(a,p),n=Math.ceil(L/.1);return Array.from({length:n+1},(_,j)=>({x:a.x+(p.x-a.x)*j/n,y:a.y+(p.y-a.y)*j/n})).every(q=>!pointBlockedForPeasant(q))})'),true);
});
test('all six brigade route jobs receive time and restart after a topology edit',()=>{
 setup();run("State.structures=[{id:'well',type:'well',x:100,y:100},{id:'house',type:'house',auto:true,houseLevel:2,x:90,y:90,w:1.5,h:1}];window.ConquerFire.ignite('house',{heat:.1});window.ConquerFire.tick(.25);globalThis.qaPerformance=performance;globalThis.qaClock=0;performance={now:()=>qaClock};globalThis.qaOriginalPathWork=findPeasantPathWork;globalThis.qaStarts=[];globalThis.qaCompleted=0;findPeasantPathWork=function*(a,b){qaStarts.push(a.id);for(let i=0;i<100;i++){qaClock+=.5;yield}qaCompleted++;return [a,b]}");
 run("qaStarts=[];qaCompleted=0;for(const c of window.ConquerFire.brigade.carriers()){c.t=100;c.x=100.9;c.y=100;c.state='fill';c.path=null;c.retry=0}invalidateNavigation();for(let i=0;i<8;i++)window.ConquerFire.tick(.25)");
 try{
  assert.equal(run('new Set(qaStarts).size'),6,'no route job may starve behind the first woman');
  assert.equal(run('qaCompleted'),0);
  run('globalThis.qaBefore=qaStarts.length;invalidateNavigation();window.ConquerFire.tick(.25)');
  assert.ok(run('qaStarts.length>qaBefore'),'pending route must be rebuilt after navigation changes');
 }finally{run('performance=qaPerformance;findPeasantPathWork=qaOriginalPathWork')}
});
test('an unreachable fire never becomes a straight line through a wall',()=>{
 setup();run("State.structures=[{id:'well',type:'well',x:100,y:100},{id:'house',type:'house',auto:true,houseLevel:2,x:90,y:90,w:1.5,h:1},{id:'wall',type:'wall',a:{x:95,y:80},b:{x:95,y:110},width:.5}];window.ConquerFire.ignite('house',{heat:.1});globalThis.qaOriginalPathWork=findPeasantPathWork;findPeasantPathWork=function*(){return null};for(let i=0;i<24;i++)window.ConquerFire.tick(.25)");
 try{
  assert.equal(run('window.ConquerFire.brigade.carriers().length'),6);
  assert.equal(run("window.ConquerFire.brigade.carriers().every(c=>c.state==='fill'&&c.x>99)"),true);
  assert.equal(run('State.fire.splashes.length'),0);
 }finally{run('findPeasantPathWork=qaOriginalPathWork')}
});
console.log(passed+' movement/path performance checks passed.');
`)(require,__dirname);
