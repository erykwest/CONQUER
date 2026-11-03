'use strict';
// Tribunal in session (docs/crime.md): the people of the town hall's tribunal floor come from the
// same layout as its furniture, only when that floor is in view, on working days by day with no
// alarm; judges, clerk and prisoner wear costumes of office that the seasonal wardrobe never deals out.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const src=f=>read('src/'+f);
const core=src('settlement-core.js');

const window={},State={season:'summer',structures:[],clock:{day:10.5}};
const ctx=vm.createContext({window,State,Math,Object,Number,Array,Map,Set,String,Float32Array,
  isPlanView:()=>false,rotateViewPoint:p=>({x:p.x,y:p.y}),performance:{now:()=>0}});
vm.runInContext(core.slice(core.indexOf('const CIVIC_TYPES='),core.indexOf('function civicParts(')),ctx);
for(const f of ['assets/civic-models.js','settlement-mesh3d.js','settlement-civic3d.js','settlement-wardrobe.js','settlement-court-people.js'])vm.runInContext(src(f),ctx);
const C3=window.ConquerCivic3D,CP=window.ConquerCourtPeople,W=window.ConquerWardrobe;
const hall=(floor,functions=['council','tribunal','prison'])=>({id:'th',type:'townhall',x:0,y:0,angle:0,civicLevel:3,functions,townhallRooms:1,cutawayFloor:floor});

// ---------- places
{
  State.structures=[hall(1)];State.selectedId='th';
  const s=State.structures[0],slots=C3.roomSlots(s);
  const by=r=>slots.filter(x=>x.role===r);
  assert.equal(by('judge').length,3);assert.equal(by('clerk').length,1);assert.equal(by('prisoner').length,1);assert.equal(by('guard').length,2);
  assert.ok(by('public').length>=4,'some public on the benches');
  assert.equal(by('judge').filter(j=>j.action==='preside').length,1,'one presiding judge');
  // In the room of the floor in view (L3 floor 1 at z 1.171, rect x ±1.9, y -0.82..1.52).
  assert.ok(slots.every(a=>Math.abs(a.x)<1.9&&a.y>-.82&&a.y<1.52),'everyone inside the room');
  assert.ok(slots.every(a=>a.z>1.171-.12&&a.z<1.171+.4),'everyone on the tribunal floor');
  assert.equal(new Set(slots.map(a=>a.id)).size,slots.length,'stable unique ids');
  assert.deepEqual(JSON.stringify(C3.roomSlots({...s})),JSON.stringify(slots),'a fixed draw per building');
  // The prisoner stands between the bar and the bench, the guards beside him; the judges behind the bench.
  const pr=by('prisoner')[0],jy=by('judge')[1].y;
  assert.ok(by('guard').every(g=>Math.abs(g.y-pr.y)<.05&&Math.abs(g.x-pr.x)>.25),'a guard on each side');
  assert.ok(jy>pr.y&&by('public').every(p=>p.y<pr.y),'bench behind the prisoner, public in front');
  // Nobody when the tribunal floor is not in view or there is no tribunal.
  assert.equal(C3.roomSlots(hall(0)).length,0,'ground floor in view: the council hall');
  assert.equal(C3.roomSlots(hall(1,['council','guard'])).length,0,'no tribunal, no court');
  assert.equal(C3.roomSlots({...hall(0,['tribunal'])}).length>0,true,'a ground-floor tribunal sits too');
  console.log('PASS court places: judges, clerk, prisoner between two guards, public; only on the tribunal floor in view');
}

// ---------- session and scene
{
  State.daylightOverride=null;
  window.ConquerEconomy={weekday:d=>((Math.floor(d)%7)+7)%7};
  let alarm='off';window.ConquerCombat={alarmMode:()=>alarm};
  const at=day=>{State.clock.day=day;return CP.inSession()};
  assert.equal(at(10.5),true,'Thursday noon');
  assert.equal(at(12.5),false,'Saturday');assert.equal(at(13.5),false,'Sunday');
  assert.equal(at(10.3),false,'before 9');assert.equal(at(10.75),false,'after 17');
  alarm='green';assert.equal(at(10.5),false,'the alarm empties the court');alarm='off';
  State.clock.day=10.5;State.structures=[hall(1)];State.selectedId='th';
  const s=State.structures[0];
  assert.equal(CP.courtBuilding(),s,'the selected town hall in cutaway');
  State.selectedId=null;assert.equal(CP.courtBuilding(),null,'nothing when not selected');State.selectedId='th';
  const a=CP.scene(s,3),b=CP.scene(s,3);
  assert.equal(JSON.stringify(a),JSON.stringify(b),'the scene is a pure function of time');
  let raised=false;for(let t=0;t<14;t+=.25)if(CP.scene(s,t).some(x=>x.action==='preside'&&x.gesture>.5))raised=true;
  assert.ok(raised,'the presiding judge raises a hand now and then');
  assert.ok(CP.scene(s,1).every(x=>x.action!=='bound'||Math.abs(x.sway)<.02),'the prisoner barely moves');
  // A future crime runtime can supply its own people.
  CP.setOccupancySource((st,list)=>list.filter(x=>x.role!=='public'));
  assert.ok(CP.scene(s,0).every(x=>x.role!=='public'),'occupancy source');
  CP.setOccupancySource(null);
  console.log('PASS court session: working days 9-17 with no alarm; pure, animated scene; pluggable occupancy');
}

// ---------- prison: the town hall's cells, and the castle's prison rooms
{
  State.structures=[hall(0,['prison','tribunal','council'])];State.selectedId='th';
  const s=State.structures[0],sl=C3.roomSlots(s),bars=C3.prisonBars(s);
  const prisoners=sl.filter(a=>a.role==='prisoner'),jailer=sl.filter(a=>a.role==='jailer');
  assert.ok(prisoners.length>=2&&jailer.length===1,'prisoners in the cells, the jailer at his table');
  assert.ok(bars&&prisoners.every(p=>p.y>bars.y&&p.y<bars.back&&p.x>bars.x0&&p.x<bars.x1),'every prisoner behind the bars');
  assert.ok(jailer[0].y<bars.y,'the jailer outside the cells');
  assert.equal(prisoners.filter(p=>p.action==='bars').length,1,'one at the bars, the others sitting');
  assert.ok(sl.every(a=>a.z>-.1&&a.z<.3),'on the ground floor (prisons are on P0 only)');
  // One to five per cell.
  const cells=new Map();for(const p of prisoners){const k=p.id.split('-')[0];cells.set(k,(cells.get(k)||0)+1)}
  assert.equal(cells.size,C3.prisonCellCount(s),'every cell has someone');
  assert.ok([...cells.values()].every(n=>n>=1&&n<=C3.PRISON_CELL_MAX)&&C3.PRISON_CELL_MAX===5,'one to five prisoners per cell');
  assert.equal(new Set(prisoners.map(p=>p.x.toFixed(2)+','+p.y.toFixed(2))).size,prisoners.length,'nobody on the same spot');
  // The prison is never empty: no session hours.
  State.clock.day=13.95;assert.equal(CP.inSession(),false);
  assert.ok(CP.scene(s,1).length===sl.length,'prisoners at night too');
  assert.match(src('settlement-court-people.js'),/role!=='prison'&&!\(role==='tribunal'&&inSession\(\)\)/,'only the tribunal keeps hours');
  assert.equal(C3.prisonBars(hall(1,['prison','tribunal','council'])),null,'no bars on the tribunal floor');
  // Castle prison rooms: prisoners instead of an empty room, drawn by this module.
  const garrisons=src('settlement-population-garrisons.js');
  assert.match(garrisons,/cells=slot\.size==='large'\?2:1;[\s\S]*?count\+=1\+peasantHash\(s\.id\+'-cell-'\+slot\.index\+'-'\+c\)%max;/,'one to five per cell, two cells in a large room');
  assert.match(garrisons,/ConquerCourtPeople\.drawCellPrisoner\(item\.p,slot\.z,id,item\.phase,item\.i>0\)/,'drawn as prisoners');
  assert.equal(typeof CP.drawCellPrisoner,'function');
  console.log('PASS prison: ground floor, one to five prisoners per cell behind the bars, the jailer outside, castle cells too, day and night');
}

// ---------- public justice: pillory, gallows, scaffold
{
  let alarm='off';window.ConquerCombat={alarmMode:()=>alarm};
  const on=(v,day)=>{State.clock.day=day;return CP.justiceInSession(v)};
  assert.equal(on('pillory',10.5),true,'pillory: a weekday noon');assert.equal(on('pillory',12.5),true,'pillory: Saturday');
  assert.equal(on('pillory',13.5),false,'no pillory on Sunday');assert.equal(on('pillory',10.2),false,'pillory: before 8');
  for(const v of ['gallows','scaffold']){
    assert.equal(on(v,4+11/24),true,v+': justice day (Friday) 10-12');
    assert.equal(on(v,3+11/24),false,v+': not on Thursday');assert.equal(on(v,4+13/24),false,v+': not after noon');
  }
  alarm='green';assert.equal(on('scaffold',4+11/24),false,'the alarm clears the square');alarm='off';
  const venue=v=>({id:'j-'+v,type:'eventVenue',venue:v,x:0,y:0,angle:0,w:{pillory:1,gallows:2,scaffold:2.5}[v],h:{pillory:1,gallows:1.5,scaffold:2}[v]});
  for(const v of ['pillory','gallows','scaffold']){
    const s=venue(v),sl=CP.justiceSlots(s),by=r=>sl.filter(x=>x.role===r),crowd=by('public');
    assert.ok(crowd.length>=4,v+': onlookers');
    assert.ok(crowd.every(p=>p.y<0&&p.z===0&&(Math.abs(p.x)>s.w/2||Math.abs(p.y)>s.h/2)),v+': the crowd stands in front, off the work');
    assert.ok(crowd.some(p=>p.action==='jeer'),v+': some jeer');
    assert.equal(JSON.stringify(CP.justiceSlots({...s})),JSON.stringify(sl),v+': a fixed draw per structure');
    assert.equal(JSON.stringify(CP.justiceScene(s,2)),JSON.stringify(CP.justiceScene(s,2)),v+': pure scene');
    if(v==='pillory'){assert.equal(by('prisoner').length,1);assert.ok(by('prisoner')[0].z>.15,'the condemned stands on the base');assert.equal(by('executioner').length,0)}
    else{
      assert.equal(by('executioner').length,1,v+': the executioner waits');assert.ok(by('executioner')[0].z>.3,'on the stage');
      assert.equal(by('guard').length,2,v+': two guards at the stair');
      assert.equal(by('prisoner').length,0,v+': no condemned on the gallows or the scaffold (sober: the scene stops at the waiting)');
    }
  }
  assert.equal(CP.dotOf(venue('scaffold'),{id:'executioner',role:'executioner'},{x:0,y:0}).outfit.head,'executionerHood');
  assert.equal(CP.justiceSlots({type:'eventVenue',venue:'stage'}).length,0,'other venues untouched');
  console.log('PASS public justice: pillory Mon-Sat 8-17, gallows and scaffold on justice day; sober scenes');
}

// ---------- costumes of office
{
  for(const k of ['judgeRobe','judgeCap','clerkGown','clerkCap','prisonerShirt','executionerHood']){
    assert.ok(W.ROLE_PIECES[k]&&!W.PIECES[k],k+' is a role piece, not a seasonal one');
  }
  const judge=CP.dotOf(hall(1),{id:'judge0',role:'judge'},{x:0,y:0});
  assert.equal(judge.outfit.body,'judgeRobe');assert.equal(judge.outfit.head,'judgeCap');
  assert.equal(CP.dotOf(hall(1),{id:'prisoner',role:'prisoner'},{x:0,y:0}).outfit.body,'prisonerShirt');
  assert.equal(CP.dotOf(hall(1),{id:'public0',role:'public'},{x:0,y:0}).outfit,null,'the public wears its own clothes');
  // The seasonal wardrobe never deals them out.
  for(const kind of ['rain','snow','clear','wind'])for(let i=0;i<40;i++){
    const o=W.outfitFor({id:'v'+i,kind:'elite'},W.fromKind('winter',kind,0));
    assert.ok(!o||![o.head,o.body].some(p=>p&&W.ROLE_PIECES[p]),'no costume of office by season');
  }
  console.log('PASS costumes of office: judge, clerk, prisoner, executioner; never seasonal');
}

// ---------- wiring
{
  assert.match(src('settlement-render.js'),/window\.ConquerCourtPeople\?\.draw\(\)/,'drawn with the population');
  assert.match(read('index.html'),/settlement-court-people\.js/,'loaded');
  assert.match(src('asset-catalog.js'),/family:'Costumi di ruolo'/,'costumes in the Lab');
  const c3=src('settlement-civic3d.js'),mesh=c3.slice(c3.indexOf('function cutawayMesh'),c3.indexOf('function bodyMesh'));
  assert.ok(mesh.length>100&&!/roomSlots|Court/.test(mesh),'people are not baked into the cutaway mesh');
  console.log('PASS wiring: render pass, index, Lab; people kept out of the cutaway mesh');
}
