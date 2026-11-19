'use strict';
// Event venues in the Builder: the four buttons exist and sit in their own palette
// group, the tool places them with the shared two-click oriented placement, the
// shared footprint / label / cost / duration hooks know them, the inspector offers
// stage dressing and festival-ground setup / start / stop, and the event lifecycle
// runs on the game clock (preparing -> active, clearing -> idle).
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const html=read('index.html'),ux=read('src/settlement-builder-ux.js'),input=read('src/settlement-app-input.js');
const VENUES=['streetSpot','stage','festivalGround','arenaLot'];
for(const v of VENUES){
  assert.match(html,new RegExp('<button data-event-venue="'+v+'">'),'Builder button for '+v);
  assert.ok(ux.includes('[data-event-venue="'+v+'"]'),v+' listed in the palette');
}
const group=ux.slice(ux.indexOf("{id:'events'"),ux.indexOf("{id:'combat'"));
assert.ok(VENUES.every(v=>group.includes(v)),'the four venues share the "Eventi e svago" group');
assert.match(input,/document\.querySelectorAll\('\[data-event-venue\]'\)/,'the buttons pick the event tool');
assert.match(input,/State\.tool\.kind==='industry'\|\|State\.tool\.kind==='event'/,'two-click oriented placement for venues');
assert.match(read('src/settlement-castle.js'),/ConquerEvents3D\?\.is\(s\)\)return window\.ConquerEvents3D\.footprint\(s\)/,'footprint hook');
assert.match(read('src/settlement-castle-placement.js'),/ConquerEvents3D\?\.is\(s\)\)return window\.ConquerEvents3D\.label\(s\)/,'label hook');
const core=read('src/settlement-core.js');
assert.match(core,/ConquerEvents3D\?\.is\(s\)\)return window\.ConquerEvents3D\.cost\(s\)/,'cost hook');
assert.match(core,/ConquerEvents3D\?\.is\(s\)\)return window\.ConquerEvents3D\.buildDays\(s\)/,'duration hook');
assert.match(read('src/settlement-app-rooms.js'),/ConquerEvents3D\?\.is\(s\)\)\{[\s\S]{0,900}panelHtml\(s\)/,'inspector hook');
console.log('PASS Builder: four event-venue buttons in their group, placement, footprint / label / cost / duration / inspector hooks');

// Runtime: make, footprint, label, cost, panel and lifecycle.
const window={},State={seed:3,structures:[],clock:{day:10,speed:1}};
const ctx=vm.createContext({window,State,Math,Object,Number,Array,Map,Set,String,JSON,Float32Array,performance:{now:()=>0}});
for(const f of ['settlement-util.js','assets/scatter-model.js','assets/civic-models.js','assets/event-models.js','settlement-mesh3d.js','settlement-events3d.js'])vm.runInContext(read('src/'+f),ctx);
const E=window.ConquerEvents3D;
for(const v of VENUES){
  const s={...E.make(v),id:'b-'+v,x:50,y:60,angle:Math.PI/2};
  const fp=E.footprint(s),{w,h}=E.sizeOf(s);
  assert.equal(fp.length,4,v+': rectangular footprint');
  const xs=fp.map(p=>p.x),ys=fp.map(p=>p.y);
  assert.ok(Math.abs(Math.max(...xs)-Math.min(...xs)-h)<1e-6&&Math.abs(Math.max(...ys)-Math.min(...ys)-w)<1e-6,v+': footprint turns with the venue');
  assert.ok(E.label(s).length>4,v+': label');
}
assert.equal(JSON.stringify(E.cost(E.make('festivalGround'))),'{}','the festival ground is free (a reservation)');
assert.equal(E.buildDays(E.make('festivalGround')),0,'and has no building site');
assert.ok(E.cost(E.make('arenaLot')).wood>0&&E.buildDays(E.make('arenaLot'))>0,'the arena is a timber work with a building site');
assert.equal(E.make('stage').dressing,'players','the stage starts dressed for players');
{
  const s={...E.make('festivalGround'),id:'g',x:50,y:60,angle:0};State.structures=[s];
  const panel=E.panelHtml(s);
  for(const k of ['joust','tourney','circus','feast'])assert.ok(panel.includes('data-event-setup="'+k+'"'),'panel offers '+k);
  assert.ok(panel.includes('data-event-start')&&panel.includes('data-event-stop'),'panel starts and stops the event');
  assert.ok(E.panelHtml({...E.make('stage'),id:'st',x:0,y:0}).includes('data-event-dressing="herald"'),'stage panel switches dressing');
  E.setEvent(s,{setup:'circus',phase:'preparing',progress:0,since:10});
  const counts=[];
  for(let d=10;d<=10.4;d+=.05){State.clock.day=d;E.tickEvents();counts.push(E.setupItems(s).length)}
  assert.equal(s.event.phase,'active','preparing becomes active after the set-up time');
  assert.ok(counts.every((c,i)=>i===0||c>=counts[i-1])&&counts[0]<counts.at(-1),'props arrive one after another');
  E.setEvent(s,{phase:'clearing',progress:0,since:State.clock.day});
  for(let k=0;k<6;k++){State.clock.day+=.05;E.tickEvents()}
  assert.equal(s.event.phase,'idle','clearing ends idle');
  assert.equal(E.setupItems(s).length,0,'nothing left on an idle ground');
}
console.log('PASS runtime: venues made, footprints turn, free festival ground, panel, lifecycle on the game clock');

// Army camp: Builder button in the combat group, lot sized by the army, works bought
// one level at a time, each placed copy owning its camp.
assert.match(html,/<button data-event-venue="armyCamp">/,'Builder button for the army camp');
assert.ok(ux.slice(ux.indexOf("{id:'combat'")).includes('[data-event-venue="armyCamp"]'),'army camp in the combat group');
{
  const s={...E.make('armyCamp',{seed:5}),id:'ac',x:80,y:80,angle:0};
  const small={w:s.w,h:s.h};
  assert.ok(E.setupItems(s).some(it=>it.m==='tentOctagon')&&E.setupItems(s).some(it=>it.m==='tentCompany'),'camp pitches pavilion and company tents');
  assert.ok(!E.setupItems(s).some(it=>/campPalisade|propFence/.test(it.m)),'a new camp is open ground');
  const {w,h}=E.sizeOf(s);
  for(const it of E.setupItems(s))assert.ok(Math.abs(it.x)<=w/2&&Math.abs(it.y)<=h/2,it.m+' on the lot');
  s.camp.squads=15;s.camp.leaders=3;E.fitCamp(s);
  assert.ok(s.w*s.h>small.w*small.h,'a bigger army takes a bigger lot');
  assert.ok(E.panelHtml(s).includes('data-camp-works="1"'),'panel offers the fence first');
  s.camp.works=2;E.fitCamp(s);
  const items=E.setupItems(s);
  assert.ok(items.some(it=>it.m==='campPalisade')&&items.filter(it=>it.m==='campGate').length===1,'palisade with one gate');
  assert.ok(E.cost(s).wood>E.cost(E.make('armyCamp')).wood,'works add to the cost');
  assert.ok(E.buildDays(s)>E.buildDays(E.make('armyCamp')),'and to the building time');
  assert.ok(E.label(s).includes('palizzata'),'label names the works');
  assert.ok(!items.some(it=>/campStakes|campCheval/.test(it.m)),'no outer works before level 3');
  assert.ok(E.panelHtml(s).includes('data-camp-works="3"'),'panel offers the anti-charge stakes next');
  const lot2={w:s.w,h:s.h};
  s.camp.works=3;E.fitCamp(s);
  const spiked=E.setupItems(s),stakes=spiked.filter(it=>it.m==='campStakes'),chev=spiked.filter(it=>it.m==='campCheval');
  assert.ok(stakes.length>=8&&chev.length===2,'level 3: a ring of stakes and two chevaux de frise');
  assert.ok(spiked.some(it=>it.m==='campPalisade')&&spiked.filter(it=>it.m==='campGate').length===1,'level 3 keeps the palisade and gate');
  assert.ok(s.w>=lot2.w&&s.h>=lot2.h,'the lot holds the outer works');
  {const {w,h}=E.sizeOf(s);for(const it of stakes.concat(chev))assert.ok(Math.abs(it.x)<=w/2&&Math.abs(it.y)<=h/2,it.m+' on the lot')}
  // Every stake segment stands outside the boundary and its points (model -y) face away from the camp.
  {const camp=E.campLayout(s).camp,P=camp.perimeter,cx=P.reduce((a,p)=>a+p.x,0)/P.length,cy=P.reduce((a,p)=>a+p.y,0)/P.length;
    for(const it of E.encampmentSpikes(camp).filter(it=>it.m==='campStakes')){
      const ox=Math.sin(it.a),oy=-Math.cos(it.a);
      assert.ok((it.x-cx)*ox+(it.y-cy)*oy>0,'stakes point outwards');
    }
    const g=camp.gate;
    assert.ok(!E.encampmentSpikes(camp).some(it=>it.m==='campStakes'&&Math.hypot(it.x-g.x,it.y-g.y)<1.2),'the way in stays open');}
  assert.ok(E.cost(s).wood>E.cost({...s,camp:{...s.camp,works:2}}).wood,'stakes add to the cost');
  s.camp.works=2;E.fitCamp(s);
  const spec=E.make('armyCamp',{seed:9}),a={...spec,id:'a'},b={...spec,id:'b'};
  E.label(a);E.label(b);a.camp.squads=12;
  assert.notEqual(b.camp.squads,12,'placed copies do not share their camp');
  assert.ok(E.meshes(s,0).length>items.length/2,'camp meshes built');
}
console.log('PASS army camp: builder, army-sized lot, works levels, cost, own camp per structure');

// Field works anywhere in the settlement: a row of anti-charge stakes (length in segments,
// points to the front) and a single cheval de frise.
for(const v of ['stakeRow','chevalFrise']){
  assert.match(html,new RegExp('<button data-event-venue="'+v+'">'),'Builder button for '+v);
  assert.ok(ux.slice(ux.indexOf("{id:'combat'")).includes('[data-event-venue="'+v+'"]'),v+' in the combat group');
}
{
  const s={...E.make('stakeRow'),id:'sr',x:40,y:40,angle:0};
  assert.equal(s.segments,3,'a new row has three segments');
  assert.ok(Math.abs(E.sizeOf(s).w-4.2)<1e-9,'1.4 U per segment');
  let items=E.setupItems(s);
  assert.ok(items.length===3&&items.every(it=>it.m==='campStakes'&&it.a===0),'one stake segment each, points at -y');
  for(const it of items)assert.ok(Math.abs(it.x)+.7<=E.sizeOf(s).w/2+1e-9,'segments on the lot');
  const c3=E.cost(s).wood,d3=E.buildDays(s);
  s.segments=8;s.w=E.sizeOf(s).w;
  assert.equal(E.setupItems(s).length,8,'longer row, more segments');
  assert.ok(E.cost(s).wood>c3&&E.buildDays(s)>d3,'cost and time per segment');
  s.segments=99;assert.ok(Math.abs(E.sizeOf(s).w-8*1.4)<1e-9,'length clamped');
  s.segments=3;
  assert.ok(E.panelHtml(s).includes('data-stake-segments="1"'),'panel lengthens the row');
  assert.ok(E.label(s).includes('Pali anti-carica')&&E.label(s).includes('3 tratti'),'label');
  assert.ok(E.meshes(s,0).length>=3,'row meshes built');
  const f={...E.make('chevalFrise'),id:'cf',x:50,y:40,angle:0};
  assert.equal(E.venueModel(f),'campCheval','cheval de frise model');
  assert.ok(E.meshes(f,0).length>=1&&E.cost(f).wood>0,'cheval meshes and cost');
}
console.log('PASS field works: anti-charge stake rows and chevaux de frise in the Builder');
