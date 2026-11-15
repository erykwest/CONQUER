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
for(const f of ['assets/civic-models.js','settlement-mesh3d.js','settlement-civic3d.js','settlement-wardrobe.js','settlement-work-anim.js',
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
