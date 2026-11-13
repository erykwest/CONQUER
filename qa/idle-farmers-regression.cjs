'use strict';
// D-FIELD-LEND: an L1 farmer without work at a field helps another in-season
// field or stays in the L1 pool as generic labour; nobody stands at a field
// without work, nobody is counted twice, and the figures drawn at the strips
// are exactly the L1 the economy staffs there. Runs the real field,
// population, social-class and economy scripts.
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
function village(day,extra='',founders=0){
  run("{State.clock.day="+day+";State.environment=[];State.relief=null;State.combat.strokes=[];"+
    "State.structures=[{id:'well',type:'well',x:100,y:100},"+
    "{id:'f',type:'field',auto:true,x:105,y:104,points:[{x:103,y:103},{x:107,y:103},{x:107,y:105},{x:103,y:105}]},"+
    "{id:'a',type:'house',auto:true,x:101,y:110,w:1.5,h:1,houseLevel:1},"+
    "{id:'b',type:'house',auto:true,x:108,y:100,w:1.5,h:1,houseLevel:1},"+
    "{id:'c',type:'house',auto:true,x:96,y:104,w:1.5,h:1,houseLevel:1},"+
    "{id:'p',type:'house',auto:true,x:94,y:96,w:1.5,h:1,houseLevel:1}];"+
    "State.village={founded:true,wellId:'well',foundingWorkers:"+founders+"};invalidateNavigation();"+
    "fieldWorkAssignmentCache={key:null,map:new Map()};"+
    "const e=window.ConquerEconomy;e.reset?.();e.sync?.();e.state().castleGold=1000;"+
    "globalThis.qaField=State.structures[1];globalThis.qaCrop=fieldCrop(qaField);"+extra+
    // The test edits crops after sync(): let today's field demand be decided now.
    "for(const s of State.structures)if(s.crop)delete s.crop.morningDemand;}");
}
const site="State.structures.push({id:'site',type:'tower',shape:'square',size:1,x:90,y:90,construction:{version:2,startedDay:0,workRequired:50,workDone:0}});";
const labor=()=>run('window.ConquerEconomy.laborAllocation(State.clock.day)');
const plain=v=>JSON.parse(JSON.stringify(v));
const assigned=()=>plain(run("[...fieldWorkAssignments(completedSettlement('house'),completedSettlement('field')).keys()].sort()"));
const ids=list=>plain((list||[]).map(w=>w.id)).sort();
const all=l=>[...Object.values(l.assignedL1).flat(),...l.carters,...l.builders,...l.idle,...l.herders,...l.fishers,...l.soldiers].map(w=>w.id);

test('spring growth: the field employs nobody, its farmers are free L1 labour',()=>{
  village("qaWorkday(4,2,.30)","qaCrop.phase='grow';qaCrop.sownDay=State.clock.day-40;"+site);
  assert.deepEqual(assigned(),[],'nobody drawn at a growing field');
  const l=labor();
  assert.equal(l.allocated.f||0,0,'a growing field employs nobody');
  assert.equal(l.builders.length,3,'three L1 go to the building site');
  assert.equal(l.idle.length,1);
});
test('ploughing: two strips, four L1 -> the two staffed at the field farm it, counted once',()=>{
  village("qaWorkday(9,1,.30)","qaCrop.phase='plough';qaCrop.ploughed=false;qaCrop.work=[0,0];"+site);
  const l=labor();
  assert.equal(l.allocated.f,2,'the field pays exactly its two open strips');
  assert.deepEqual(assigned(),ids(l.assignedL1.f),'the figures at the strips are the staffed L1');
  assert.equal(l.builders.some(w=>assigned().includes(w.id)),false,'a builder is never also a farmer');
  const every=all(l);assert.equal(new Set(every).size,every.length,'no adult in two jobs');
  run("globalThis.qaA=fieldWorkAssignments(completedSettlement('house'),completedSettlement('field'))");
  for(const id of assigned()){
    const p=run("(()=>{const a=qaA.get('"+id+"');return peasantPosition(a.house,a,State.clock.day)})()");
    const tool=run("(()=>{const a=qaA.get('"+id+"'),h=a.house,r=houseResidents(h).find(r=>r.id==='"+id+"');return fieldWork(peasantPosition(h,a,State.clock.day),a,h,r)?.tool})()");
    assert.ok(p,'farmer on the field');assert.equal(tool,'hoe');
  }
});
test('a strip finished mid-shift sends its farmer home on foot; the roster changes only next morning',()=>{
  village("qaWorkday(9,1,.20)","qaCrop.phase='plough';qaCrop.ploughed=false;qaCrop.work=[0,0];");
  const before=ids(labor().assignedL1.f);
  run("globalThis.qaA=fieldWorkAssignments(completedSettlement('house'),completedSettlement('field'));"+
    "globalThis.qaFirst=[...qaA.values()].find(a=>a.cell.index===0);const len=qaFirst.cell.end-qaFirst.cell.start;"+
    "qaCrop.work=[len-.05,0];qaCrop.lastDay=State.clock.day;");
  run("State.clock.day+=.10;tickFields(State.clock.day)");
  assert.ok(run('fieldSlotDone(qaField,qaFirst.cell)'),'strip finished');
  const rel=run('fieldSlotRelease(qaField,qaFirst.cell)');
  assert.ok(rel&&!rel.home&&rel.day<=run('State.clock.day'),'release time recorded inside the shift');
  run("globalThis.qaSpot=fieldWorkerPosition(qaField,qaFirst.cell)");
  run("globalThis.qaWalk=peasantPosition(qaFirst.house,qaFirst,Math.floor(State.clock.day)+(fieldSlotRelease(qaField,qaFirst.cell).day%1)+.03)");
  assert.ok(run('qaWalk')&&run('dist(qaWalk,qaSpot)')>.05,'walking home, not standing at the strip');
  assert.equal(run('peasantPosition(qaFirst.house,qaFirst,Math.floor(State.clock.day)+.51)'),null,'home before evening');
  assert.equal(run("fieldWork(qaSpot,qaFirst,qaFirst.house,houseResidents(qaFirst.house)[0])"),null,'no tool on a finished strip');
  assert.equal(run("fieldWorkAssignments(completedSettlement('house'),completedSettlement('field')).has(qaFirst.worker)"),true,'not moved mid-shift');
  assert.deepEqual(ids(labor().assignedL1.f),before,'economy roster frozen for the day');
  // Next morning: one open strip, one farmer; the other is free L1 labour.
  run("State.clock.day=Math.floor(State.clock.day)+1.05");
  assert.equal(labor().allocated.f,1);
  assert.equal(assigned().length,1);
});
test('a farmer without work goes to another in-season field before generic labour',()=>{
  village("qaWorkday(9,1,.30)","qaCrop.phase='plough';qaCrop.ploughed=false;qaCrop.work=[0,0];"+
    "State.structures.push({id:'g',type:'field',auto:true,x:114,y:104,points:[{x:112,y:103},{x:116,y:103},{x:116,y:105},{x:112,y:105}]});"+
    "const g=fieldCrop(State.structures.at(-1));g.phase='plough';g.ploughed=false;g.work=[0,0];"+
    "fieldWorkAssignmentCache={key:null,map:new Map()};"+site);
  const l=labor();
  assert.equal(l.allocated.f+l.allocated.g,4,'all four L1 farm the two fields');
  assert.equal(l.builders.length,0,'construction only gets L1 nobody needs at a field');
  const fieldOf=plain(run("Object.fromEntries([...fieldWorkAssignments(completedSettlement('house'),completedSettlement('field')).entries()].map(([k,a])=>[k,a.field.id]))"));
  for(const [fid,workers] of Object.entries(l.assignedL1).filter(([k])=>k==='f'||k==='g'))
    for(const w of workers)assert.equal(fieldOf[w.id],fid,'drawn at the field that pays him');
});
test('September and December-February: no field work, nobody drawn at a field',()=>{
  for(const month of [8,11,0,1]){
    village("qaWorkday("+month+","+(month>=8?1:2)+",.30)","qaCrop.phase='plough';qaCrop.ploughed=true;"+site);
    assert.equal(labor().allocated.f||0,0,'month '+month);
    assert.deepEqual(assigned(),[],'month '+month);
  }
});
test('managed L1 Job Manager: the field task asks only for open strips and follows the order',()=>{
  village("qaWorkday(9,1,.30)","qaCrop.phase='plough';qaCrop.ploughed=false;qaCrop.work=[fieldLayout(qaField).cells[0].end,0];"+site+
    "window.ConquerEconomy.setL1Minimum('builders',1);");
  const jm=plain(run('window.ConquerEconomy.jobManager(State.clock.day)'));
  assert.equal(jm.tasks.find(t=>t.key==='site:f').capacity,1,'one open strip, one place');
  const l=labor();
  assert.equal(l.managedL1,true);
  assert.equal(l.allocated.f,1);
  assert.deepEqual(assigned(),ids(l.assignedL1.f));
  const every=all(l);assert.equal(new Set(every).size,every.length,'no adult in two jobs');
});
test('the founding crew never farms: strips go to household adults only',()=>{
  village("qaWorkday(9,1,.30)","qaCrop.phase='plough';qaCrop.ploughed=false;qaCrop.work=[0,0];"+
    "State.structures=State.structures.filter(s=>s.id!=='b'&&s.id!=='c'&&s.id!=='p');",2);
  const l=labor();
  assert.equal(l.allocated.f,1,'one household adult, one strip worked');
  assert.equal(l.assignedL1.f.some(w=>w.founderIndex!=null),false);
  assert.deepEqual(assigned(),['a:m:0']);
});
run("peasantPath=qaRealPath");
console.log(passed+' idle farmer regression checks passed.');
`);
check(require,__dirname);
