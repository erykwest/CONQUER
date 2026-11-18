'use strict';
// New role figures: the castle household in its rooms (cook, groom, armourer, chaplain, treasurer,
// surgeon and orderlies, falconer, dove-keeper, councillors), the priest, the innkeeper, the watch and
// the collectors of the Bargello, the Balivo's judges, the woodcutters at the forest clearings.
// Every one has the clothes of the trade and a work gesture, is in by day and gone during an alarm.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const src=f=>read('src/'+f);
const core=src('settlement-core.js');

const window={},State={season:'summer',structures:[],clock:{day:10.5},view:{scale:2}};
const ctx=vm.createContext({window,State,Math,Object,Number,Array,Map,Set,String,Float32Array,
  isPlanView:()=>false,rotateViewPoint:p=>({x:p.x,y:p.y}),performance:{now:()=>0}});
vm.runInContext(core.slice(core.indexOf('const CIVIC_TYPES='),core.indexOf('function civicParts(')),ctx);
for(const f of ['settlement-util.js','assets/civic-models.js','settlement-mesh3d.js','settlement-civic3d.js','settlement-wardrobe.js','settlement-work-anim.js',
  'settlement-court-people.js','settlement-staff-people.js'])vm.runInContext(src(f),ctx);
const C3=window.ConquerCivic3D,CP=window.ConquerCourtPeople,W=window.ConquerWardrobe,WA=window.ConquerWorkAnim,SP=window.ConquerStaffPeople;

// ---------- castle rooms: every staffed room is a real room function, with a dressed trade and a known gesture
{
  const functions=Object.keys(Object.fromEntries([...src('ui/i18n-it.js').match(/functions:\s*\{([\s\S]*?)\}/)[1].matchAll(/(\w+):\s*'/g)].map(m=>[m[1],1])));
  for(const [room,R] of Object.entries(SP.ROOM_STAFF)){
    assert.ok(functions.includes(room),room+' is a castle room function');
    for(const [role,tool] of R.staff.concat(R.more||[])){
      assert.ok(W.ROLES[role],room+': '+role+' has work clothes');
      assert.ok(WA.TOOLS[tool],room+': '+tool+' is a work gesture');
    }
  }
  for(const room of ['kitchen','stables','armory','workshop','chapel','treasury','infirmary','mews','dovecote','council'])
    assert.ok(SP.roomStaff(room,'small').length>=1,room+' is staffed');
  assert.ok(SP.roomStaff('kitchen','large').length>SP.roomStaff('kitchen','small').length,'a large kitchen has two cooks');
  assert.equal(SP.roomStaff('barracks','small').length,0,'barracks keep their soldiers (garrisons)');
  assert.equal(SP.roomStaff('infirmary','small')[0][0],'surgeon','the surgeon in the infirmary');
  assert.match(src('settlement-population-garrisons.js'),/if\(!count\)\{window\.ConquerStaffPeople\?\.drawRoom\(s,slot\);continue\}/,'rooms without soldiers, nobles or prisoners get their staff');
  console.log('PASS castle household: '+Object.keys(SP.ROOM_STAFF).length+' room functions staffed with dressed trades and gestures');
}

// ---------- throne hall: the lord's court around the throne (ROOM-ANIM-THRONE)
{
  const roles=list=>list.map(a=>a.role).sort().join(',');
  assert.equal(roles(SP.throneCourt('normal',true,false)),'guard,guard,herald,lord,petitioner','by day: lord, two guards, herald, petitioner');
  assert.equal(roles(SP.throneCourt('large',true,false)),'councillor,guard,guard,herald,lord,petitioner','a large hall adds a courtier');
  assert.equal(roles(SP.throneCourt('large',false,false)),'guard,guard','at night the guards keep the empty throne');
  assert.equal(SP.throneCourt('large',true,true).length,0,'an alarm empties the hall');
  const lord=SP.THRONE_COURT.find(a=>a.role==='lord');
  assert.ok(lord.seated&&lord.fwd<0&&lord.side===0,'the lord sits on the seat, behind the dais centre');
  assert.ok(Math.abs(SP.SEAT_Z-.72/3.5)<1e-9,'seat height of the Blender throne (0.72 m)');
  for(const a of SP.THRONE_COURT.filter(a=>a.tool)){
    assert.ok(WA.TOOLS[a.tool],a.role+': '+a.tool+' is a work gesture');
    assert.ok(a.fwd>0,a.role+' stands in front of the throne');
  }
  assert.ok(W.ROLES.herald,'the herald has his clothes');
  assert.ok(SP.THRONE_COURT.filter(a=>a.role==='guard').every(a=>Math.abs(a.side)>.69/2),'the guards stand beside the dais (2.4 m wide)');
  assert.ok(SP.THRONE_COURT.find(a=>a.role==='petitioner').toThrone,'the petitioner faces the throne');
  const g=[0,1,2,3,4,5,6].map(t=>SP.lordGesture(t,0));
  assert.ok(g.some(x=>x>0)&&g.some(x=>x===0)&&g.every(x=>x>=0&&x<=1),'the lord raises his hand now and then');
  assert.match(src('settlement-staff-people.js'),/if\(slot\.role==='throneHall'\)return drawThroneHall\(s,slot\)/,'the throne hall is drawn by its court');
  const cf=src('settlement-cutaway-furniture.js');
  assert.match(cf,/rooms\.set\(room\.slot\.index,room\)/,'the furniture keeps each room layout');
  assert.match(cf,/standSpots,roomPieces,roomContains,/,'throne anchor exported');
  assert.match(cf,/throneHall\(r\)\{r\.wall\(r\.A,0,'throne'\)/,'the throne stands on the main wall');
  console.log('PASS throne hall: the lord on his throne, guards, herald and petitioner by day, guards at night');
}

// ---------- common hall: the garrison and the household at table (ROOM-ANIM-COMMON)
{
  const small=SP.commonHallScene(2,1,true,false,'h1'),large=SP.commonHallScene(4,2,true,false,'h2');
  const kinds=l=>l.reduce((m,a)=>(m[a.kind]=(m[a.kind]||0)+1,m),{});
  assert.equal(small.filter(a=>a.kind!=='servant').length,2,'one diner on each of the two benches');
  assert.notEqual(small[0].side,small[1].side,'the two benches of a table staggered');
  assert.equal(kinds(small).servant,1,'a servant at the table');
  assert.equal(large.filter(a=>a.kind!=='servant').length,4,'a large hall: two tables, four diners');
  assert.equal(kinds(large).servant,2,'a servant per table');
  assert.equal(SP.commonHallScene(4,2,false,false).length,0,'empty at night');
  assert.equal(SP.commonHallScene(4,2,true,true).length,0,'an alarm empties the hall');
  const many=Array.from({length:12},(_,i)=>SP.commonHallScene(4,2,true,false,'hall'+i)).flat();
  assert.ok(many.some(a=>a.kind==='soldier')&&many.some(a=>a.kind==='diner'),'soldiers and household at the tables');
  assert.equal(JSON.stringify(SP.commonHallScene(2,1,true,false,'h1')),JSON.stringify(small),'a fixed draw per hall');
  for(const a of large)assert.ok(WA.TOOLS[a.tool],a.kind+': '+a.tool+' is a work gesture');
  assert.ok(W.ROLES.servant,'the servant has his clothes');
  assert.ok(SP.BENCH_SEATS.every(x=>Math.abs(x)<1.6/3.5/2),'places within the 1.6 m bench');
  assert.ok(SP.TABLE_END>2.2/3.5/2,'the servant stands beyond the end of the 2.2 m table');
  assert.match(src('settlement-staff-people.js'),/if\(slot\.role==='commonHall'\)return drawCommonHall\(s,slot\)/,'the common hall is drawn by its diners');
  assert.match(src('settlement-cutaway-furniture.js'),/commonHall\(r\)\{tableWithBenches\(r,0,0\)/,'a table with benches in every common hall');
  console.log('PASS common hall: soldiers and household at the benches, a servant per table, by day');
}

// ---------- hours
{
  let alarm='off';window.ConquerCombat={alarmMode:()=>alarm};
  const at=day=>{State.clock.day=day;return SP.onDuty()};
  assert.equal(at(10.5),true,'noon');assert.equal(at(10.2),false,'before 6');assert.equal(at(10.9),false,'after 20');
  alarm='green';assert.equal(at(10.5),false,'the alarm sends the staff away');alarm='off';
  console.log('PASS staff in by day, away during an alarm');
}

// ---------- civic interiors
{
  State.clock.day=10.5;
  const b=(type,civicLevel,floor=0)=>({id:type+civicLevel+'@'+floor,type,x:0,y:0,angle:0,civicLevel,cutawayFloor:floor});
  for(const L of [1,2,3]){
    const ch=C3.roomSlots(b('church',L));
    assert.equal(ch.length,1,'church L'+L+': the priest');assert.equal(ch[0].role,'priest');assert.equal(ch[0].tool,'book');
    const tv=C3.roomSlots(b('tavern',L));
    assert.equal(tv.length,1,'tavern L'+L+': the innkeeper');assert.equal(tv[0].tool,'mug');
  }
  // The innkeeper stands behind the counter, not on it.
  const spec=C3.roomSlots(b('tavern',1))[0];assert.ok(spec.y>.47,'tavern 1: behind the counter (towards the barrels)');
  for(const L of [1,2]){
    const g=C3.roomSlots(b('bargello',L,0)),e=C3.roomSlots(b('bargello',L,1));
    assert.equal(g.filter(a=>a.role==='guard').length,2,'Bargello guard room: the watch');
    assert.equal(e.filter(a=>a.role==='exactor'&&a.tool==='quill').length,2,'Bargello office: two collectors writing');
    assert.ok(e.some(a=>a.role==='public'),'someone pays');
    assert.ok(e.every(a=>a.z>.8),'the office is upstairs');
    const v=C3.roomSlots(b('balivo',L,1));
    assert.equal(v.filter(a=>a.role==='bailiff').length,3,'Balivo: three judges on the bench');
    assert.equal(v.filter(a=>a.action==='preside').length,1,'one presides');
    assert.equal(C3.roomSlots(b('balivo',L,0)).length,0,'the tithe store has no staff');
  }
  // Their people are dressed by trade and dressed for the season in the free slots.
  const priest=CP.dotOf(b('church',1),{id:'priest',role:'priest'},{x:0,y:0});
  assert.equal(priest.role,'priest');assert.equal(W.outfitFor(priest,W.fromKind('summer','clear')).body,'cassock');
  assert.equal(W.outfitFor(CP.dotOf(b('balivo',1,1),{id:'b0',role:'bailiff'},{x:0,y:0}),W.fromKind('summer','clear')).body,'bailiffRobe');
  assert.equal(CP.dotOf(b('church',1),{id:'judge0',role:'judge'},{x:0,y:0}).outfit.body,'judgeRobe','costumes of office unchanged');
  // The selected building in cutaway is staffed through the court people's pass.
  State.structures=[b('church',2)];State.selectedId=State.structures[0].id;
  assert.equal(CP.courtBuilding(),State.structures[0],'a selected church in cutaway');
  assert.match(src('settlement-court-people.js'),/if\(a\.tool&&window\.ConquerWorkAnim\)\{window\.ConquerWorkAnim\.drawWorkerUnmasked\(dot,a\.tool/,'staff work with their gesture');
  console.log('PASS civic interiors: priest, innkeeper, the watch and collectors of the Bargello, the Balivo judges');
}

// ---------- Sunday Mass: the faithful on the pews
{
  const b=(L,floor=0)=>({id:'church'+L+'@'+floor,type:'church',x:0,y:0,angle:0,civicLevel:L,cutawayFloor:floor});
  for(const L of [1,2,3]){
    const m=C3.massSlots(b(L));
    assert.ok(m.length>=6,'church L'+L+': the faithful fill the pews ('+m.length+')');
    assert.ok(m.every(a=>a.role==='public'&&a.action==='sit'),'seated public');
    assert.equal(JSON.stringify(C3.massSlots(b(L))),JSON.stringify(m),'a fixed draw per church');
  }
  assert.ok(C3.massSlots(b(3)).length>C3.massSlots(b(1)).length,'a larger church, more faithful');
  const church=b(2);
  State.clock.day=13.4;   // Sunday (day 6 of the week), 9:36
  assert.equal(CP.massInSession(),true,'Sunday morning: Mass');
  assert.equal(CP.slots(church).length,1+C3.massSlots(church).length,'the priest and the faithful');
  State.clock.day=13.6;assert.equal(CP.massInSession(),false,'Sunday afternoon: no Mass');
  State.clock.day=12.4;assert.equal(CP.massInSession(),false,'Saturday: no Mass');
  assert.equal(CP.slots(church).length,1,'only the priest on other days');
  State.clock.day=10.5;
  console.log('PASS Sunday Mass: the faithful sit on the pews of the church cutaway');
}

// ---------- forest clearings
{
  const fo=src('settlement-forestry.js');
  assert.match(fo,/W\.anonymous\(job\.id\+':feller'\+i,p,'woodcutter'\),i===2\?'shovel':'axe'/,'woodcutters with axes, the third grubs stumps');
  assert.match(fo,/Math\.min\(MAX_WORKERS,Math\.max\(0,Math\.floor\(num\(c\.workers\)\)\)\)/,'as many as the paid workers');
  assert.match(src('settlement-render.js'),/window\.ConquerForestry\?\.drawCrews\?\.\(\)/,'drawn with the workers');
  console.log('PASS forest clearings show their crew');
}

// ---------- wiring and Lab
{
  assert.match(read('index.html'),/settlement-staff-people\.js/,'loaded');
  const cat=src('asset-catalog.js');
  for(const tool of ['ladle','brush','book','quill','mortar','falcon','mug','speak','bowl'])assert.match(cat,new RegExp("'"+tool+"'"),tool+' gesture in the Lab');
  console.log('PASS wiring: index, Lab gestures');
}
