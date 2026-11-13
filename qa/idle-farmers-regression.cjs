'use strict';
// D-FIELD-LEND: L2 farmers without work at their field help another field or
// are lent to the L1 pool; nobody stands at a field without work, nobody is
// counted twice. Runs the real field, population and economy scripts.
const fs=require('node:fs');
const harness=fs.readFileSync(__dirname+'/urban-regression.cjs','utf8').split('let passed=0;')[0];
const check=new Function('require','__dirname',harness+`
let passed=0;
function test(name,body){body();passed++;console.log('PASS '+name)}
run(moduleFile('economy'));
run(moduleFile('work-anim'));
if(run('typeof window.ConquerWorkAnim?.FIELD_TOOL')!=='object')throw Error('work-anim not loaded');
run("function qaMonthStart(month,year){for(let d=0;d<950;d++){const date=calendarDateFromDay(d);if(date.month===month&&date.year===year&&date.day===1)return d}throw Error('month')}");
// A Tuesday of the given month, at the given time of day.
run("function qaWorkday(month,year,frac){let d=qaMonthStart(month,year)+7;while(((d%7)+7)%7!==1)d++;return d+frac}");
run("globalThis.qaRealPath=peasantPath;peasantPath=(h,a)=>[houseDoorInfo(h).outside,a.cell.world]");
function village(day,extra=''){
  run("{State.clock.day="+day+";State.environment=[];State.relief=null;State.combat.strokes=[];"+
    "State.structures=[{id:'well',type:'well',x:100,y:100},"+
    "{id:'f',type:'field',auto:true,x:105,y:104,points:[{x:103,y:103},{x:107,y:103},{x:107,y:105},{x:103,y:105}]},"+
    "{id:'a',type:'house',auto:true,x:101,y:110,w:1.5,h:1,houseLevel:2},"+
    "{id:'b',type:'house',auto:true,x:108,y:100,w:1.5,h:1,houseLevel:2},"+
    "{id:'c',type:'house',auto:true,x:96,y:104,w:1.5,h:1,houseLevel:2},"+
    "{id:'p',type:'house',auto:true,x:94,y:96,w:1.5,h:1,houseLevel:1}];"+
    "State.village={founded:true,wellId:'well',foundingWorkers:0};invalidateNavigation();"+
    "fieldWorkAssignmentCache={key:null,map:new Map()};"+
    "const e=window.ConquerEconomy;e.reset?.();e.sync?.();e.state().castleGold=1000;"+
    "globalThis.qaField=State.structures[1];globalThis.qaCrop=fieldCrop(qaField);"+extra+"}");
}
const site="State.structures.push({id:'site',type:'tower',shape:'square',size:1,x:90,y:90,construction:{version:2,startedDay:0,workRequired:50,workDone:0}});";
const labor=()=>run('window.ConquerEconomy.laborAllocation(State.clock.day)');
const assigned=()=>run("[...fieldWorkAssignments(completedSettlement('house'),completedSettlement('field')).keys()].sort()");
const ids=list=>JSON.parse(JSON.stringify(list.map(w=>w.id)));

test('spring growth: no farmer at the field, all three lent to the L1 pool after the L1 adult',()=>{
  village("qaWorkday(4,2,.30)","qaCrop.phase='grow';qaCrop.sownDay=State.clock.day-40;"+site);
  assert.deepEqual(JSON.parse(JSON.stringify(assigned())),[]);
  const l=labor();
  assert.equal(l.lentL2.length,3,'three idle L2 farmers become farmhands');
  assert.equal(l.allocated.f||0,0,'a growing field employs nobody');
  // L1 adult first, then the farmhands, up to the site's three places.
  assert.deepEqual(ids(l.builders),['p:m:0',...ids(l.lentL2).slice(0,2)]);
  assert.equal(l.idle.some(w=>w.lentL2),false,'farmhands are not counted as idle L1');
  const crews=run("[...constructionCrewAssignments(State.clock.day).values()].flat().map(w=>w.id)");
  assert.ok(JSON.parse(JSON.stringify(crews)).some(id=>id.endsWith(':m:0')&&id!=='p:m:0'),'a farmhand works on the building site');
});
test('ploughing: two strips, three farmers -> two at the field, one farmhand, counted once',()=>{
  village("qaWorkday(9,1,.30)","qaCrop.phase='plough';qaCrop.ploughed=false;qaCrop.work=[0,0];");
  const farmers=assigned();assert.equal(farmers.length,2);
  const l=labor();
  assert.equal(l.allocated.f,2,'the field pays exactly its two open strips');
  assert.equal(l.lentL2.length,1);
  assert.equal(farmers.includes(l.lentL2[0].houseId),false,'the farmhand is not also a farmer');
  assert.ok((l.allocated.f||0)+l.lentL2.length<=l.limits.L2,'L2 quota never exceeded');
  // The farmers stand at their strip with the hoe.
  run("globalThis.qaA=fieldWorkAssignments(completedSettlement('house'),completedSettlement('field'))");
  for(const id of farmers){
    const p=run("(()=>{const a=qaA.get('"+id+"');return peasantPosition(a.house,a,State.clock.day)})()");
    const tool=run("(()=>{const a=qaA.get('"+id+"'),h=a.house,r=houseResidents(h)[0];return fieldWork(peasantPosition(h,a,State.clock.day),a,h,r)?.tool})()");
    assert.ok(p,'farmer on the field');assert.equal(tool,'hoe');
  }
});
test('a strip finished mid-shift sends its farmer home on foot; the roster changes only next morning',()=>{
  village("qaWorkday(9,1,.20)","qaCrop.phase='plough';qaCrop.ploughed=false;");
  run("globalThis.qaA=fieldWorkAssignments(completedSettlement('house'),completedSettlement('field'));"+
    "globalThis.qaFirst=[...qaA.values()].find(a=>a.cell.index===0);const len=qaFirst.cell.end-qaFirst.cell.start;"+
    "qaCrop.work=[len-.05,0];qaCrop.lastDay=State.clock.day;");
  const lentBefore=ids(labor().lentL2);
  run("State.clock.day+=.10;tickFields(State.clock.day)");
  assert.ok(run('fieldSlotDone(qaField,qaFirst.cell)'),'strip finished');
  const rel=run('fieldSlotRelease(qaField,qaFirst.cell)');
  assert.ok(rel&&!rel.home&&rel.day<=run('State.clock.day'),'release time recorded inside the shift');
  run("globalThis.qaSpot=fieldWorkerPosition(qaField,qaFirst.cell)");
  run("globalThis.qaWalk=peasantPosition(qaFirst.house,qaFirst,Math.floor(State.clock.day)+(fieldSlotRelease(qaField,qaFirst.cell).day%1)+.03)");
  assert.ok(run('qaWalk')&&run('dist(qaWalk,qaSpot)')>.05,'walking home, not standing at the strip');
  assert.equal(run('peasantPosition(qaFirst.house,qaFirst,Math.floor(State.clock.day)+.51)'),null,'home before evening');
  assert.equal(run("fieldWork(qaSpot,qaFirst,qaFirst.house,houseResidents(qaFirst.house)[0])"),null,'no tool on a finished strip');
  assert.equal(run("fieldWorkAssignments(completedSettlement('house'),completedSettlement('field')).has(qaFirst.house.id)"),true,'not moved mid-shift');
  assert.deepEqual(ids(labor().lentL2),lentBefore,'no farmhand appears mid-shift');
  // Next morning: the released farmer is lent (the only open strip is taken).
  run("State.clock.day=Math.floor(State.clock.day)+1.05");
  assert.equal(run("fieldWorkAssignments(completedSettlement('house'),completedSettlement('field')).size"),1);
  assert.equal(labor().lentL2.length,2);
});
test('a farmer without work takes an open strip of another in-season field before being lent',()=>{
  village("qaWorkday(9,1,.30)","qaCrop.phase='plough';qaCrop.ploughed=false;qaCrop.work=[0,0];"+
    "State.structures.push({id:'g',type:'field',auto:true,x:114,y:104,points:[{x:112,y:103},{x:116,y:103},{x:116,y:105},{x:112,y:105}]});"+
    "const g=fieldCrop(State.structures.at(-1));g.phase='plough';g.ploughed=false;g.work=[0,0];"+
    // Both fields exist before this morning's decision.
    "fieldWorkAssignmentCache={key:null,map:new Map()};");
  assert.equal(assigned().length,3,'third farmer goes to the second field');
  assert.equal(labor().lentL2.length,0,'nobody lent while a field has open strips');
});
test('September and December-February: the countryside rests, nobody is lent',()=>{
  for(const month of [8,11,0,1]){
    village("qaWorkday("+month+","+(month>=8?1:2)+",.30)","qaCrop.phase='plough';qaCrop.ploughed=true;"+site);
    assert.equal(labor().lentL2.length,0,'month '+month);
  }
});
test('managed L1 Job Manager: farmhands follow the task order and its minima',()=>{
  village("qaWorkday(4,2,.30)","qaCrop.phase='grow';qaCrop.sownDay=State.clock.day-40;"+site+
    "window.ConquerEconomy.setL1Minimum('builders',2);");
  const l=labor();
  assert.equal(l.managedL1,true);
  assert.equal(l.builders.length,3,'AUTO fills the site with L1 first, then farmhands');
  assert.equal(l.builders[0].id,'p:m:0');
  assert.equal(l.lentIdle.length,1);
  assert.equal(l.spareL1.some(w=>w.lentL2&&!l.builders.includes(w)),false,'managed construction keeps its own roster');
});
run("peasantPath=qaRealPath");
console.log(passed+' idle farmer regression checks passed.');
`);
check(require,__dirname);
