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

// Arena lot, stage and podium: always lived in, from the same register.
{
  const lot={id:'v-arena',type:'eventVenue',venue:'arenaLot',x:0,y:0,angle:0},{w,h}=E.sizeOf(lot);
  const sl=P.slots(lot),act=k=>sl.filter(x=>x.action===k);
  assert.equal(act('fight').length,2,'arena: two combatants in the sand');
  assert.equal(act('prepare').length,8,'arena: a squire before each of the eight tents');
  assert.ok(act('sit').length>=486,'arena: the tiers seats');
  let cheerPeak=0,minGap=Infinity,lance=false;
  for(let t=0;t<P.DUEL*2;t+=.1){
    const sc=P.venueScene(lot,t),f=sc.actors.filter(a=>a.fighter);
    assert.equal(f.length,2,'two combatants fighting');
    minGap=Math.min(minGap,Math.hypot(f[0].x-f[1].x,f[0].y-f[1].y));
    cheerPeak=Math.max(cheerPeak,sc.cheer);
    assert.ok(sc.actors.every(a=>Math.abs(a.x)<=w/2&&Math.abs(a.y)<=h/2),'arena: everyone on the lot');
    if(sc.actors.some(a=>a.carry==='lance'))lance=true;
  }
  assert.ok(minGap>.4&&minGap<.9,'the duellists keep fighting distance');
  assert.ok(cheerPeak>.9,'the tiers roar at the hit');
  assert.ok(lance,'squires carry lances between the tents');
  const field=window.ConquerEventModels.models.arenaU.meta.field;
  const f=P.venueScene(lot,1).actors.filter(a=>a.fighter);
  assert.ok(f.every(a=>a.y<field.arcCentre[1]+.1&&a.y>field.openEnd[1]),'the duel is on the sand');
}
for(const [dressing,act] of [['players','perform'],['herald','announce']]){
  const st={id:'v-stage-'+dressing,type:'eventVenue',venue:'stage',x:0,y:0,angle:0,dressing},sc=P.venueScene(st,1.3);
  assert.ok(sc.actors.some(a=>a.action===act&&a.z>.2),'stage ('+dressing+'): '+act+' up on the platform');
  assert.ok(sc.actors.some(a=>a.action==='watch'&&a.z===0),'stage ('+dressing+'): an audience below');
}
{
  const pod={id:'v-pod',type:'eventVenue',venue:'streetSpot',x:0,y:0,angle:0},sc=P.venueScene(pod,2);
  assert.equal(sc.actors.filter(a=>a.action==='perform').length,2,'podium: a musician and a storyteller');
  assert.ok(sc.actors.filter(a=>a.action==='watch').length>=2,'podium: listeners around');
}
console.log('PASS arena, stage (players / herald) and podium: combatants, squires, crowds and performers');
// Tourney, knights' camp and theatre on the festival ground.
{
  const T=venue('tourney'),C=venue('camp'),Th=venue('theatre');
  const act=(s,k)=>P.slots(s).filter(x=>x.action===k);
  assert.equal(act(T,'fight').length,6,'tourney: three pairs of combatants in the field');
  assert.equal(act(T,'prepare').length,4,'tourney: a squire before each of the four tents');
  assert.ok(act(T,'sit').length>=272,'tourney: the stands seats');
  assert.equal(act(C,'fight').length,6,'camp: three pairs of knights sparring');
  assert.equal(act(C,'chat').length,18,'camp: a knot of three people before each of the six tents');
  assert.ok(act(C,'tend').length>=16,'camp: two hands at every rack and armour stand');
  assert.ok(P.venueScene(C,1).actors.length>=40,'camp: a crowded camp ('+P.venueScene(C,1).actors.length+' people)');
  assert.equal(act(C,'prepare').length,6,'camp: a squire before each of the six tents');
  assert.ok(act(Th,'perform').length>=3&&act(Th,'wait').length>=2,'theatre: actors on the stage and extras in the wings');
  assert.ok(act(Th,'sit').length>0,'theatre: an audience on the stands');
  for(const s of [T,C,Th]){
    const {w,h}=E.sizeOf(s);
    for(let t=0;t<12;t+=.5){
      const a=P.venueScene(s,t).actors;
      assert.ok(a.every(x=>Math.abs(x.x)<=w/2&&Math.abs(x.y)<=h/2),s.event.setup+': everyone on the ground');
    }
  }
  // The tourney's pairs fight inside the fence (x within +-4.2, y within -2.4..1.8).
  for(let t=0;t<12;t+=.25){
    const f=P.venueScene(T,t).actors.filter(a=>a.fighter);
    assert.equal(f.length,6,'six combatants');
    assert.ok(f.every(a=>Math.abs(a.x)<4.1&&a.y>-2.35&&a.y<1.75),'the melee stays inside the fence');
  }
  assert.ok(P.venueScene(Th,1).actors.some(a=>a.action==='perform'&&a.z>.3),'theatre: actors up on the stage');
}
console.log('PASS tourney (melee, squires, stands), knights camp (sparring, squires) and theatre (actors, wings, audience)');// The stands' balustrade and backrest are repainted over the crowd: each piece sorts at
// its band edge pushed outward, so it covers the row behind it and never the row in front.
{
  const J=venue('joust'),o=P.occluders(J);
  assert.ok(o.length>100,'joust: the stands give occluder triangles ('+o.length+')');
  assert.ok(o.every(q=>q.tri.length===9&&Number.isFinite(q.p.x)&&Number.isFinite(q.p.y)&&q.col),'occluders: well-formed');
  assert.equal(P.occluders(J),o,'occluders: cached while the venue is unchanged');
  assert.equal(P.occluders(venue('circus')).length,0,'circus: no stands, no occluders');
}
console.log('PASS occluders: stands balustrade and backrest repainted over the crowd');
