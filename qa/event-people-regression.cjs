'use strict';
// People at the event venues, aligned with CANS: ActivitySlots with stable ids and a
// guest / worker role; an occupancy register with one occupant per slot and one slot
// per occupant, provisional until the CANS adapters exist and replaceable; the feast
// and circus scenes draw registered occupants only and keep them on the ground.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const src=f=>fs.readFileSync(path.join(__dirname,'..','src',f),'utf8');
const window={},State={seed:9,structures:[],clock:{speed:0}};
const ctx=vm.createContext({window,State,Math,Object,Number,Array,Map,Set,String,JSON,Float32Array,performance:{now:()=>0}});
for(const f of ['assets/scatter-model.js','assets/civic-models.js','assets/event-models.js','settlement-mesh3d.js','settlement-events3d.js','settlement-events-people.js'])vm.runInContext(src(f),ctx);
const P=window.ConquerEventPeople,E=window.ConquerEvents3D;
const venue=(setup,extra={})=>({id:'v-'+setup,type:'eventVenue',venue:'festivalGround',x:0,y:0,angle:0,event:{setup,phase:'active'},...extra});

// Slots: stable unique ids, guest / worker roles, the expected actions per setup.
for(const setup of ['joust','feast','circus','tourney','camp','theatre']){
  const s=venue(setup),a=P.slots(s),b=P.slots({...s});
  assert.equal(new Set(a.map(x=>x.id)).size,a.length,setup+': slot ids are unique');
  assert.deepEqual(a.map(x=>x.id),b.map(x=>x.id),setup+': slot ids are stable');
  assert.ok(a.every(x=>x.domain===s.id&&(x.role==='guest'||x.role==='worker')),setup+': slots belong to the venue domain with a role');
  const {w,h}=E.sizeOf(s);assert.ok(a.every(x=>Math.abs(x.x)<=w/2&&Math.abs(x.y)<=h/2),setup+': slots on the ground');
}
const acts=s=>{const m={};for(const x of P.slots(s))m[x.role+':'+x.action]=(m[x.role+':'+x.action]||0)+1;return m};
{const f=acts(venue('feast'));
 assert.equal(f['guest:sit'],16*6+3*3,'feast: six places at each of 16 tables, three stools at each barrel table');
 assert.equal(f['worker:sell'],4,'feast: a seller at each stall');assert.equal(f['guest:browse'],12,'feast: three customers per stall');
 assert.ok(f['worker:perform']>=4+2*2,'feast: players on the stage and on both podiums');assert.ok(f['guest:watch']>=7,'feast: an audience before the stage')}
{const c=acts(venue('circus'));
 assert.equal(c['worker:sell'],2,'circus: a ticket seller in each booth');assert.equal(c['guest:queue'],8,'circus: a queue at each booth');
 assert.ok(c['worker:perform']>=4,'circus: barker and juggler on the podiums')}
{const j=acts(venue('joust'));assert.ok(j['guest:sit']>=272,'joust: the stands seats')}
console.log('PASS slots: stable ids, guest / worker roles, feast / circus / joust actions');

// Occupancy register: invariants, provisional source, a replaceable source.
for(const setup of ['joust','feast','circus']){
  const s=venue(setup),occ=P.occupants(s),slots=new Set(P.slots(s).map(x=>x.id));
  assert.equal(new Set(occ.map(o=>o.slot)).size,occ.length,setup+': one occupant per slot');
  assert.equal(new Set(occ.map(o=>o.occupant)).size,occ.length,setup+': one slot per occupant');
  assert.ok(occ.every(o=>slots.has(o.slot)&&o.provisional===true),setup+': provisional occupants on real slots');
  assert.ok(P.slots(s).filter(x=>x.role==='worker').every(x=>occ.some(o=>o.slot===x.id)),setup+': every worker slot manned');
  assert.deepEqual(JSON.stringify(P.occupants({...s})),JSON.stringify(occ),setup+': the same occupants every time');
}
{
  const s=venue('feast'),slots=P.slots(s),[a,b]=slots;
  P.setOccupancySource(()=>[{slot:a.id,occupant:'res-1',state:'occupied'},{slot:a.id,occupant:'res-2',state:'occupied'},
    {slot:b.id,occupant:'res-1',state:'occupied'},{slot:'nope',occupant:'res-3',state:'occupied'}]);
  const occ=P.occupants(s);
  assert.equal(JSON.stringify(occ.map(o=>o.occupant)),'["res-1"]','a CANS source is honoured and its double bookings refused');
  assert.ok(P.feastScene(s,3).actors.length===1&&P.feastScene(s,3).actors[0].id==='res-1','scenes draw registered occupants only');
  P.setOccupancySource(null);
  assert.ok(P.occupants(s).length>60,'back to the provisional source');
}
console.log('PASS occupancy register: one occupant per slot and per person, provisional and replaceable');

// Feast: diners seated at the tables, players on the stage, strollers keep their identity.
{
  const s=venue('feast'),{w,h}=E.sizeOf(s),ids=new Set(P.occupants(s).map(o=>o.occupant));
  let strolled=false;
  for(let t=0;t<30;t+=.5){
    const a=P.feastScene(s,t).actors;
    assert.ok(a.every(x=>ids.has(x.id)),'feast: every actor is a registered occupant');
    assert.ok(a.every(x=>Math.abs(x.x)<=w/2&&Math.abs(x.y)<=h/2),'feast: everyone on the ground');
    if(a.some(x=>x.sequence==='stroll'&&x.action==='walk'))strolled=true;
  }
  const a=P.feastScene(s,2).actors;
  assert.ok(a.filter(x=>x.action==='sit').every(x=>x.z>.1),'diners sit on the benches');
  assert.ok(a.filter(x=>x.action==='perform').some(x=>x.z>.3),'players up on the stage');
  assert.ok(strolled,'guests stroll from stall to stall');
}
console.log('PASS feast: diners, sellers, players, audience and strollers');

// Circus: barker and juggler perform, queues at the booths, ticket holders reach the door.
{
  const s=venue('circus'),{w,h}=E.sizeOf(s),sc0=P.circusScene(s,0);
  assert.ok(sc0.door,'the big top has a door');
  let entered=false;
  for(let t=0;t<24;t+=.25){
    const sc=P.circusScene(s,t);
    assert.ok(sc.actors.every(x=>Math.abs(x.x)<=w/2&&Math.abs(x.y)<=h/2),'circus: everyone on the ground');
    for(const x of sc.actors)if(x.sequence==='enter'&&Math.hypot(x.x-sc.door.x,x.y-sc.door.y)<.15&&x.fade<1)entered=true;
  }
  const a=P.circusScene(s,1).actors;
  assert.ok(a.some(x=>x.juggle)&&a.some(x=>x.action==='perform'&&!x.juggle&&x.arms>.5),'a juggler and a calling barker');
  assert.ok(entered,'ticket holders walk into the big top');
}
console.log('PASS circus: barker, juggler, booths, queues and ticket holders entering the big top');
