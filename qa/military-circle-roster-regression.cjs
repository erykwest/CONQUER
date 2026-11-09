'use strict';
// CIRCLE defensive zones, macro tower grouping and real patrol transfers.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const apiSource=fs.readFileSync(path.join(__dirname,'../src/ui/game-api.js'),'utf8');
const combatSource=fs.readFileSync(path.join(__dirname,'../src/settlement-combat.js'),'utf8');
const from=apiSource.indexOf('  function militaryCircleRoster(){');
const to=apiSource.indexOf('  // ---- read models for the panels',from);
assert.ok(from>0&&to>from,'extract CIRCLE roster contracts from public game API');
const helpers=apiSource.slice(from,to);

function setup(ready=true){
  const structures=[
    {id:'parent',type:'tower',isMastio:true},
    {id:'sub-a',type:'tower',parentTowerId:'parent'},
    {id:'sub-b',type:'tower',parentTowerId:'sub-a'},
    {id:'standalone',type:'tower'},
    {id:'broken',type:'tower',destroyed:true},
    {id:'hall',type:'built'}
  ];
  const figures=[
    {id:'patrol-reserve',kind:'patrol',target:null},
    {id:'patrol-sector',kind:'patrol',circleSectorId:'circle-1',target:null},
    {id:'squad-1',kind:'squad',barracksId:'room-a',defeated:false}
  ];
  const capacity={parent:2,'sub-a':3,'sub-b':1,standalone:2};
  const assigned={parent:1,'sub-a':2,'sub-b':0,standalone:1};
  const sectors=[
    {id:'circle-1',depth:2,state:'secure',mastio:true,area:15},
    {id:'circle-2',depth:1,state:'alert',mastio:false,area:20}
  ];
  const getCircle=()=>{
    const circle={
      getStatus:()=>({ready,revision:1}),
      getSnapshot:()=>({compartments:sectors}),
      sectorForStructure:s=>s?.id==='parent'||s?.id==='hall'?'circle-1':
        s?.id==='standalone'||s?.id==='sub-a'||s?.id==='sub-b'?'circle-2':null
    };
    return circle;
  };
  const siege={
    archerSlots:s=>Array.from({length:capacity[s.id]||0},(_,i)=>({id:i})),
    stationedArchers:s=>assigned[s.id]||0,
    occupiedArcherSlots:s=>Array.from({length:assigned[s.id]||0},(_,i)=>({id:i})),
    changeArchers(id,delta){
      if(!Object.hasOwn(capacity,id))return false;
      const next=assigned[id]+Math.sign(delta);
      if(next<0||next>capacity[id])return false;
      assigned[id]=next;return true;
    }
  };
  const camp={
    barracks:()=>[{id:'room-a',capacity:2,structure:structures[1]}],
    addSquad:id=>figures.push({id:'new-'+figures.length,kind:'squad',barracksId:id,defeated:false}),
    removeSquad:id=>{const i=figures.findLastIndex(u=>u.kind==='squad'&&u.barracksId===id);if(i>=0)figures.splice(i,1)}
  };
  const window={ConquerCombat:{units:()=>figures},ConquerSiege:siege,ConquerCamp:camp,
    ConquerCircle:getCircle()};
  const State={structures};
  const api=Function('State','window','underConstruction','structureLabel',
    helpers+'; return {militaryCircleRoster,adjustMacroArchers,adjustZoneArchers,adjustMacroSquads};')
    (State,window,()=>false,s=>s.id);
  return {api,State,window,figures,capacity,assigned,sectors};
}

{
  const {api,assigned}=setup();
  const roster=api.militaryCircleRoster();
  assert.equal(roster.circleReady,true);
  assert.equal(roster.macros.length,2,'parent + two subtowers must form one macro');
  assert.equal(roster.zones.length,2,'CIRCLE creates real closed zones, not arbitrary labels');
  const root=roster.macros.find(m=>m.id==='parent');
  assert.ok(root,'macro row is keyed by the parent tower');
  assert.equal(root.subtowers,2);
  assert.deepEqual(root.members.map(m=>m.id),['parent','sub-a','sub-b']);
  assert.equal(root.capacity,6);
  assert.equal(root.assigned,3);
  assert.equal(root.active,3);
  assert.equal(root.squadCapacity,2);
  assert.equal(root.squads,1,'barracks in subtower count under the parent macro');
  assert.equal(roster.zones.find(z=>z.id==='circle-1').towers.length,1);
  assert.equal(roster.zones.find(z=>z.id==='circle-2').towers.length,1);
  assert.equal(roster.totalAssigned,4,'no double count of subtower slots');
  assert.equal(roster.outside.towers.length,0);
  assert.equal(api.adjustMacroArchers('parent',1),true);
  assert.equal(assigned.parent,2,'fill parent tower before its subtowers');
  assert.equal(api.adjustMacroArchers('parent',1),true);
  assert.equal(assigned['sub-a'],3,'then fill subtower slots from same macro control');
  assert.equal(api.adjustZoneArchers('circle-1',-1),true);
  assert.equal(assigned['sub-a'],2,'zone removal acts through the actual subtower Siege slot');
  assert.equal(api.adjustZoneArchers('circle-2',1),true);
  assert.equal(assigned.standalone,2,'zone two affects only its own independent tower');
  assert.equal(api.adjustMacroSquads('parent',1),true);
  assert.equal(api.militaryCircleRoster().macros.find(m=>m.id==='parent').squads,2);
  assert.equal(api.adjustMacroSquads('parent',1),false,'caserma capacity respected');
  assert.equal(api.adjustMacroSquads('parent',-1),true);
  assert.equal(api.adjustMacroArchers('missing',1),false,'reject unknown macro id');
  assert.equal(api.adjustZoneArchers('invalid',1),false,'reject unknown CIRCLE zone');
}
{
  const {api}=setup(false);
  const roster=api.militaryCircleRoster();
  assert.equal(roster.circleReady,false);
  assert.equal(roster.zones.length,0);
  assert.equal(roster.outside.towers.length,2,'no fake CIRCLE compartments while unavailable');
  assert.equal(roster.outside.towers[0].members.length+roster.outside.towers[1].members.length,4);
}

const transferStart=combatSource.indexOf('  function assignCirclePatrol(');
const transferEnd=combatSource.indexOf('  function spawnOccupants(){',transferStart);
assert.ok(transferStart>0&&transferEnd>transferStart,'combat patrol transfer function exists');
const transferCode=combatSource.slice(transferStart,transferEnd);
{
  const combat={units:[
    {id:'reserve',kind:'patrol',x:5,y:5,target:{x:6,y:6},path:[{x:5,y:5}]},
    {id:'already',kind:'patrol',circleSectorId:'circle-1',x:5,y:5,target:null}
  ]};
  let changes=0;
  const window={ConquerCircle:{getStatus:()=>({ready:true}),getSnapshot:()=>({
    compartments:[{id:'circle-1'}]})}};
  const transfer=Function('combat','window','spacePatrols','changed','draw',
    transferCode+';return assignCirclePatrol;')
    (combat,window,()=>changes++,()=>changes++,()=>changes++);
  assert.equal(transfer('circle-1',1),true,'allocate an existing reserve patrol');
  assert.equal(combat.units.length,2,'no phantom recruitment');
  assert.equal(combat.units[0].circleSectorId,'circle-1');
  assert.equal(combat.units[0].target,null,'old White Zone route is cleared');
  assert.equal(transfer('circle-1',1),false,'cannot allocate more than available reserve');
  assert.equal(transfer('circle-1',-1),true,'withdraw a patrol from the sector');
  assert.equal(combat.units.filter(u=>!u.circleSectorId).length,1,'one existing patrol returned to the White Zone');
  assert.equal(transfer('circle-99',1),false,'reject unknown sector');
  assert.equal(changes,6,'persist and refresh on successful transfer only');
}
// Serialized unit spread retains circleSectorId and strips volatile paths.
assert.match(combatSource,/const \{path,pathIndex,engaged,nextPatrolAt,[\s\S]*?\.\.\.stored\}=u/);
assert.match(combatSource,/function circlePatrolPoints\(sectorId\)/);
assert.match(combatSource,/circlePatrolPoints\(unit\.circleSectorId\)/);
assert.match(combatSource,/zone patrol/i);
console.log('Military CIRCLE roster regression: PASS (sector grouping, subtowers, manning, transfers, saves)');
