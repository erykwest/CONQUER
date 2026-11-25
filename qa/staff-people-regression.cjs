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
  assert.ok(cf.includes("T=len(r.A)>=1.3*len(r.B)?r.B:r.A")&&cf.includes("r.wall(T,0,'throne');throneRunner(r,T);"),'the throne stands at the far end: short wall in a long hall');
  assert.ok(cf.includes('function throneRunner(r,T)'),'the runner crosses the hall from the throne');
  // The audience: a queue on the runner, one walks up, kneels, the lord answers, then he leaves.
  // Each hall starts the audience at its own phase: find the moments by the scene's own clock (u).
  const T=SP.AUDIENCE_TURN,samples=Array.from({length:400},(_,i)=>SP.audienceScene(i*T/100,3,'normal','aud'));
  const at=w=>samples.find(x=>Math.abs(x.u-w)<.02);
  const q0=at(.05),k=at(.45),l=at(.9);
  assert.equal(q0.people.length,4,'one in front and three in the queue');
  assert.ok(q0.people[0].pose==='walk'&&k.people[0].pose==='kneel','the front one walks up, then kneels');
  assert.ok(k.gesture>0&&q0.gesture===0,'the lord answers the kneeling petitioner');
  assert.ok(l.people[0].look==='away'&&l.people[0].side<0&&l.people[0].fwd>.56,'then he leaves down the side lane');
  assert.ok(k.people.slice(1).every(p=>p.side===0&&p.pose==='wait'),'the queue waits on the runner');
  assert.ok(k.people.slice(1).every((p,i,a)=>!i||p.fwd>a[i-1].fwd),'one behind the other');
  assert.ok(samples.every(x=>Math.max(...x.people.map(p=>p.fwd))<=3-.05+1e-9),'nobody beyond the far end');
  { const c=src('settlement-cutaway-furniture.js'),th=c.slice(c.indexOf('throneHall(r){'),c.indexOf('treasury(r){'));
    assert.ok(th.length>0&&!th.includes('tableLong')&&!th.includes("'bench'"),'no tables in the throne hall'); }
  assert.equal(SP.audienceScene(0,3,'large','x').people.length,5,'a large hall queues four');
  assert.ok(new Set(samples.filter(x=>Math.abs(x.u-.45)<.02).map(x=>x.people[0].id)).size>1,'a new petitioner each turn');
  const spsrc=src('settlement-staff-people.js');
  assert.ok(spsrc.includes("const list=aud?court.filter(a=>a.role!=='petitioner'):court;"),'by day the audience replaces the static petitioner');
  console.log('PASS throne hall: the lord on his throne, guards, herald and the audience by day, guards at night');
}

// ---------- common hall: the garrison and the household at table (ROOM-ANIM-COMMON)
{
  const seated=l=>l.filter(a=>a.bench!=null),small=SP.commonHallScene(2,1,true,false,'h1'),large=SP.commonHallScene(4,2,true,false,'h2');
  const kinds=l=>l.reduce((m,a)=>(m[a.kind]=(m[a.kind]||0)+1,m),{});
  assert.equal(seated(small).length,2,'one diner on each of the two benches');
  assert.notEqual(small[0].side,small[1].side,'the two benches of a table staggered');
  assert.equal(kinds(small).servant,1,'a servant at the table');
  assert.equal(seated(large).length,4,'a large hall: two tables, four diners');
  assert.equal(kinds(large).servant,2,'a servant per table');
  assert.equal(SP.commonHallScene(4,2,false,false).length,0,'empty at night');
  assert.equal(SP.commonHallScene(4,2,true,true).length,0,'an alarm empties the hall');
  const many=Array.from({length:12},(_,i)=>SP.commonHallScene(4,2,true,false,'hall'+i)).flat();
  assert.ok(many.some(a=>a.kind==='soldier')&&many.some(a=>a.kind==='diner'),'soldiers and household at the tables');
  assert.equal(JSON.stringify(SP.commonHallScene(2,1,true,false,'h1')),JSON.stringify(small),'a fixed draw per hall');
  for(const a of large)assert.ok(WA.TOOLS[a.tool],a.kind+': '+a.tool+' is a work gesture');
  // Banquet: the diners eat and toast, the servants bring the roast.
  const diners=seated(many);
  for(const k of ['lady','jester','minstrel'])assert.ok(many.some(a=>a.kind===k),k+' in the hall');
  for(const g of ['eat','toast'])assert.ok(diners.some(a=>a.tool===g),'banquet gesture '+g+' at the tables');
  assert.ok(many.filter(a=>a.kind==='servant').every(a=>a.tool==='platter'),'servants bring the roast on a platter');
  assert.ok(diners.every(a=>SP.FEAST.includes(a.tool)),'diners use banquet gestures');
  assert.ok(src('settlement-staff-people.js').includes("a.tool,facing,true)"),'diners sit at the table');
  assert.ok(src('settlement-work-anim.js').includes('const seat=dot.seated?'),'a seated worker pose');
  assert.ok(src('settlement-cutaway-furniture.js').includes("r.place(it.name==='tableFeast'?'feastSpreadLong':'feastSpread',it.u,it.v,it.turn,{deco:true})"),'the feast laid on every table, long or short');
  // Long banquet tables (4.4 m, benches 3.2 m) in W2 halls only; two diners per long bench.
  const cfs=src('settlement-cutaway-furniture.js');
  assert.ok(cfs.includes("r.longTables=typeof isWideBuilt==='function'&&isWideBuilt(s);"),'long tables only in W2 halls');
  assert.ok(cfs.includes("const TN=r.longTables?'tableFeast':'tableLong',BN=r.longTables?'benchLong':'bench';"),'the long table and bench are used there');
  const fm=src('assets/furniture-model.js');
  for(const k of ['tableFeast','benchLong','feastSpreadLong'])assert.ok(fm.includes('"'+k+'"'),k+' exported from Blender');
  assert.ok(src('settlement-staff-people.js').includes('long.flatMap(b=>[{b,off:-LONG_SEAT},{b,off:LONG_SEAT}])'),'two diners on a long bench');
  assert.ok(src('settlement-siege.js').includes("2*(CF.roomPieces(s,x,'benchLong')||[]).length"),'a long bench counts two banquet seats');
  assert.ok(src('assets/furniture-model.js').includes('"feastSpread"'),'feast spread model exported from Blender');
  assert.ok(W.ROLES.soldier,'off-duty soldiers have their clothes');
  assert.ok(W.ROLES.servant,'the servant has his clothes');
  assert.ok(SP.BENCH_SEATS.every(x=>Math.abs(x)<1.6/3.5/2),'places within the 1.6 m bench');
  assert.ok(SP.TABLE_END>2.2/3.5/2,'the servant stands beyond the end of the 2.2 m table');
  assert.ok(src('settlement-staff-people.js').includes("return people?drawShelter(s,slot,people):drawCommonHall(s,slot)"),'the common hall: shelter in the red alarm, else its diners');
  // ---------- red alarm: women and children shelter in the Mastio's Common Hall (ROOM-ANIM-SHELTER)
  const ppl=[{id:'w1',sex:'female',age:'adult',level:1},{id:'w2',sex:'female',age:'adult',level:4},{id:'w3',sex:'female',age:'adult',level:2},
    {id:'c1',sex:'male',age:'child',level:1},{id:'c2',sex:'female',age:'child',level:2},{id:'m1',sex:'male',age:'adult',level:3}];
  const sh=SP.shelterScene(ppl,2,10);
  assert.equal(sh.length,6,'everyone who arrived is in the hall');
  assert.equal(sh.filter(x=>x.seated).map(x=>x.who.id).join(),'w1,w2','the women take the benches first');
  assert.ok(sh.filter(x=>x.who.age!=='adult').every(x=>x.child&&!x.seated&&x.spot!=null),'children stand on the floor');
  assert.ok(sh.filter(x=>x.who.age==='adult').every(x=>x.tool==='comfort'),'adults comfort');
  assert.equal(SP.shelterScene(ppl,0,3).length,3,'no more people than the free floor holds');
  assert.equal(SP.shelterScene([],4,10).length,0,'empty until the first arrive');
  assert.ok(WA.TOOLS.comfort,'the comfort gesture');
  const cb=src('settlement-combat.js');
  assert.ok(cb.includes('function sheltered(structureId)')&&cb.includes("m.mode==='hall'&&m.who&&m.structureId===structureId"),'combat exposes who sheltered in the hall');
  assert.ok(cb.includes('who:{id,sex:resident.sex,age:resident.age,'),'a recall remembers who walks');
  // Not rigid: every child roams, part of the standing adults walk about, the seated stay.
  const many2=Array.from({length:40},(_,i)=>({id:'p'+i,sex:i%2?'female':'male',age:i%3?'adult':'child',level:1+i%4}));
  const sh2=SP.shelterScene(many2,4,60);
  assert.ok(sh2.filter(x=>x.child).every(x=>x.roam),'children run about the hall');
  const adultsUp=sh2.filter(x=>!x.child&&!x.seated);
  assert.ok(adultsUp.some(x=>x.roam)&&adultsUp.some(x=>!x.roam),'some adults walk, others wait');
  assert.ok(sh2.filter(x=>x.seated).every(x=>!x.roam),'the seated stay on the benches');
  // A walker moves between two different spots and pauses at the end of each leg.
  const legs=Array.from({length:200},(_,i)=>SP.roamAt('kid',12,i*.1,true));
  assert.ok(legs.every(r=>r.a!==r.b&&r.a>=0&&r.a<12&&r.b<12&&r.e>=0&&r.e<=1),'legs between distinct spots');
  assert.ok(legs.some(r=>r.moving)&&legs.some(r=>!r.moving),'walks, then pauses');
  assert.ok(new Set(legs.map(r=>r.a)).size>3,'wanders over many spots');
  // Every finished Common Hall shelters (Mastio first), each up to its capacity.
  const sg=src('settlement-siege.js');
  assert.ok(sg.includes('function shelters()')&&sg.includes("fn==='commonHall'&&allowed(s,i,fn)")&&sg.includes('return keep?[keep,...list.filter(s=>s!==keep)]:list'),'shelters: every Common Hall, the Mastio first');
  assert.ok(sg.includes('function shelterCapacity(s){return SHELTER_PER_SEAT*banquetSeats(s)}')&&sg.includes('SHELTER_PER_SEAT=3'),'a hall shelters 3x its banquet');
  assert.ok(sg.includes('function shelterStatus()')&&sg.includes('missing:Math.max(0,need-capacity)'),'the shelter is a castle parameter: places, need, missing');
  assert.ok(sg.includes("if(r.age!=='adult'||r.sex!=='male'||level>=3)n++"),'need: women, children and L3/L4 men');
  assert.ok(src('ui/game-api.js').includes('shelter: siege.shelterStatus ? siege.shelterStatus() : null'),'logistics read carries the shelter');
  assert.ok(src('ui/shell.js').includes('M.shelterShort(l.shelter.missing, l.shelter.halls)'),'the castle panel warns when the shelter is short');
  assert.ok(src('ui/alert-watchers.js').includes("key: 'castle-shelter'"),'an alert asks for a new Common Hall');
  assert.ok(cb.includes('const room=halls.filter(h=>(load.get(h.id)||0)<(S?.shelterCapacity?.(h)??Infinity))'),'the recall picks the nearest hall with room');
  assert.ok(cb.includes("!(window.ConquerSiege?.shelters?.()||[]).length"),'the red bell needs any Common Hall, not only a Mastio');
  assert.ok(src('settlement-staff-people.js').includes('if(!halls.some(h=>h.id===s.id))return null;'),'any sheltering hall is drawn full');
  { const sp=src('settlement-staff-people.js'),body=sp.slice(sp.indexOf('function drawShelter('),sp.indexOf('function drawRoom('));
    assert.ok(body.includes('for(const {a,p,look,moving} of items)'),'the shelter loop knows who is walking'); }
  console.log('PASS red alarm: women and children shelter in every Common Hall, children run about');
  assert.ok(src('settlement-cutaway-furniture.js').includes('banquetTables(r);'),'tables with benches in every common hall, by its size');
  console.log('PASS common hall: soldiers and household at the benches, a servant per table, by day');
}

// ---------- hours
{
  let alarm='off';window.ConquerCombat={alarmMode:()=>alarm};
  const at=day=>{State.clock.day=day;return SP.onDuty()};
  assert.equal(at(10.5),true,'noon');assert.equal(at(10.2),false,'before 6');assert.equal(at(10.9),false,'after 20');
  alarm='green';assert.equal(at(10.5),false,'the alarm sends the staff away');alarm='off';
  // Seasonal night: in winter the sun sets before 20:00 and the castle rests then.
  ctx.solarIsNight=()=>true;
  assert.equal(at(10.75),false,'sun down at 18:00: nobody at work');assert.equal(SP.isNight(),true,'night by the sun');
  delete ctx.solarIsNight;
  State.clock.day=10.95;assert.equal(SP.isNight(),true,'night by the clock');
  // The soldiers, nobles and prisoners of the rooms stand still at night.
  const gar=src('settlement-population-garrisons.js');
  assert.ok(gar.includes('const still=!!window.ConquerStaffPeople?.isNight?.()'),'cutaway occupants read the night');
  assert.ok(gar.includes('phase=still?0:'),'no animation phase at night');assert.ok(gar.includes('sway=still?0:'),'no sway at night');
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
  for(const tool of ['ladle','brush','book','quill','mortar','falcon','mug','speak','bowl','eat','toast','platter'])assert.match(cat,new RegExp("'"+tool+"'"),tool+' gesture in the Lab');
  console.log('PASS wiring: index, Lab gestures');
}
