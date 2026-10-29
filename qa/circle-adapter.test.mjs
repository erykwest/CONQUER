import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import * as topology from '../src/circle/defensive-topology.mjs';
import * as control from '../src/circle/defensive-control.mjs';
import * as logistics from '../src/circle/defensive-logistics.mjs';
const script=readFileSync(new URL('../src/settlement-circle.js',import.meta.url),'utf8')
  .replace("Promise.all([\n    import('./circle/defensive-topology.mjs?v=circle-2'),\n    import('./circle/defensive-control.mjs?v=circle-2'),\n    import('./circle/defensive-logistics.mjs?v=circle-2')\n  ]).then",
    'Promise.resolve([circleModule,controlModule,logisticsModule]).then');
const rect=(a,b,c,d)=>[{x:a,y:b},{x:c,y:b},{x:c,y:d},{x:a,y:d}];
const piece=(id,type,a,b,c,d,extra={})=>({
  id,type,polygon:rect(a,b,c,d),...extra
});
const walls=()=>[
  piece('north','wall',4,4,16,4.5),piece('south','wall',4,15.5,16,16),
  piece('west','wall',4,4,4.5,16),piece('east','wall',15.5,4,16,16)
];
async function boot(structures,environment=[],relief={hills:[]},battle=null,wallwalk=null,siege=null) {
  const State={structures,environment,relief,clock:{day:0,speed:1}};
  const events=[];
  const window={dispatchEvent(e){events.push(e)},ConquerTerraforming:{edits:()=>[]},
    ConquerCombat:battle||{
      units:()=>[],enemy:()=>[],uiState:()=>({alarm:'off',alert:'clear'})
    },ConquerWallWalk:wallwalk,ConquerSiege:siege};
  const context={State,window,BUILD_MIN:0,BUILD_MAX:20,
    underConstruction:s=>!!s.incomplete,
    footprintPoints:s=>s.polygon,reliefEdgeBands:()=>[],
    towerDoorSpecs:()=>[],gatePassageInfo:()=>null,
    setTimeout:fn=>{fn();return 1},clearTimeout:()=>{},
    CustomEvent:class{constructor(name,opts){this.type=name;this.detail=opts.detail}},
    circleModule:topology,controlModule:control,logisticsModule:logistics,console};
  runInNewContext(script,context,{filename:'settlement-circle.js'});
  await Promise.resolve();
  return{State,api:window.ConquerCircle,events};
}
test('runtime recognizes a completed castle circuit and re-evaluates a breach',async()=>{
  const structures=walls();
  const {State,api}=await boot(structures);
  assert.equal(api.getStatus().ready,true);
  assert.equal(api.getSnapshot().compartments.length,1);
  State.structures=structures.slice(1);
  api.invalidate('wall breached');
  assert.equal(api.getSnapshot().compartments.length,0);
});
test('civil taverns and houses never close defensive perimeters',async()=>{
  const structures=[...walls().slice(1),piece('inn','tavern',4,4,16,4.5)];
  const {api}=await boot(structures);
  assert.equal(api.getSnapshot().compartments.length,0);
});
test('incomplete fortifications cannot close a defensive perimeter',async()=>{
  const structures=walls();structures[0].incomplete=true;
  const {api}=await boot(structures);
  assert.equal(api.getSnapshot().compartments.length,0);
});
test('stone tower ruins remain solid if their footprint still blocks movement',async()=>{
  const structures=[...walls().slice(1),
    piece('stump','ruin',4,4,16,4.5,{ruinOf:'tower'})];
  const {api}=await boot(structures);
  assert.equal(api.getSnapshot().compartments.length,1);
});
test('sea closes a three-sided fortress without a fourth artificial wall',async()=>{
  const structures=[
    piece('north','wall',4.25,4,16,4.5),
    piece('south','wall',4.25,15.5,16,16),
    piece('east','wall',15.5,4,16,16)
  ];
  const environment=[{id:'coast',type:'sea',points:rect(0,-2,4.5,22)}];
  const {api}=await boot(structures,environment);
  assert.equal(api.getSnapshot().compartments.length,1);
});

test('secure sector becomes invaded when a living hostile enters on the ground, then safe again',async()=>{
  const enemies=[],allies=[],battle={
    units:()=>allies,enemy:()=>enemies,
    uiState:()=>({alarm:'off',alert:'clear'})
  };
  const {api,events}=await boot(walls(),[],{hills:[]},battle);
  const id=api.getSnapshot().compartments[0].id;
  assert.equal(api.controlState(id).state,'secure');
  enemies.push({id:'intruder',x:10,y:10,faction:'dev_hostile'});
  api.invalidateControl();api.updateControl(true);
  assert.equal(api.controlState(id).state,'invaded');
  assert.equal(api.getSnapshot().controlSummary.invaded,1);
  assert.equal(api.controlState(id).safe,false);
  enemies[0].defeated=true;
  api.invalidateControl();api.updateControl(true);
  assert.equal(api.controlState(id).state,'secure');
  assert.ok(events.some(e=>e.type==='conquer-circle-control-updated'));
});
test('a live defender in the same sector makes enemy presence contested, not conquered',async()=>{
  const enemy=[{x:10,y:10}],allies=[{x:11,y:10}];
  const battle={units:()=>allies,enemy:()=>enemy,
    uiState:()=>({alarm:'off',alert:'clear'})};
  const {api}=await boot(walls(),[],{hills:[]},battle);
  const sector=api.getSnapshot().compartments[0];
  assert.equal(sector.state,'contested');
  assert.equal(sector.control.groundEnemies,1);
  assert.equal(sector.control.groundDefenders,1);
  assert.equal(api.getSnapshot().controlSummary.contested,1);
});
test('a hostile on a wall counts as infiltration but not ground invasion',async()=>{
  const enemy=[{id:'ladders',x:4.2,y:10,wall:{wallId:'west',t:.5}}];
  const battle={units:()=>[],enemy:()=>enemy,
    uiState:()=>({alarm:'off',alert:'clear'})};
  const wallwalk={
    at:()=>({x:4.25,y:10}),
    frame:()=>({ex:1,ey:0,half:.25})
  };
  const {api}=await boot(walls(),[],{hills:[]},battle,wallwalk);
  const sector=api.getSnapshot().compartments[0];
  assert.equal(sector.state,'infiltrated');
  assert.equal(sector.control.groundEnemies,0);
  assert.equal(sector.control.wallEnemies,1);
});
test('visible yellow/green alerts never substitute military presence',async()=>{
  const battle={units:()=>[],enemy:()=>[],
    uiState:()=>({alarm:'green',alert:'local'})};
  const {api}=await boot(walls(),[],{hills:[]},battle);
  const sector=api.getSnapshot().compartments[0];
  assert.equal(sector.state,'alert');
  assert.equal(sector.safe,true);
});

test('a defender fighting the attacker on a wall keeps the sector contested',async()=>{
  const enemy=[{x:4.2,y:10,wall:{wallId:'west',t:.5}}];
  const allies=[{x:4.2,y:10,wall:{wallId:'west',t:.6}}];
  const battle={units:()=>allies,enemy:()=>enemy,
    uiState:()=>({alarm:'off',alert:'clear'})};
  const wallwalk={at:()=>({x:4.25,y:10}),frame:()=>({ex:1,ey:0,half:.25})};
  const {api}=await boot(walls(),[],{hills:[]},battle,wallwalk);
  assert.equal(api.getSnapshot().compartments[0].state,'contested');
});

test('a siege breach preserves its former sector as compromised until rebuilt',async()=>{
  const structures=walls(),enemy=[];
  const battle={units:()=>[],enemy:()=>enemy,uiState:()=>({alarm:'off',alert:'clear'})};
  const {State,api}=await boot(structures,[],{hills:[]},battle);
  assert.equal(api.getSnapshot().compartments[0].state,'secure');
  api.markBreach(structures[0],{x:9,y:4.25},{x:11,y:4.25});
  State.structures=structures.slice(1);
  api.invalidate('siege breach');
  const breached=api.getSnapshot().compartments;
  assert.equal(breached.length,1);
  assert.equal(breached[0].breached,true);
  assert.equal(breached[0].state,'compromised');
  assert.equal(api.sectorAt({x:10,y:10}),breached[0].id);
  enemy.push({id:'intruder',x:10,y:10});
  api.invalidateControl();api.updateControl(true);
  assert.equal(api.controlState(breached[0].id).state,'invaded');
  enemy.splice(0);
  api.invalidateControl();api.updateControl(true);
  assert.equal(api.controlState(breached[0].id).state,'compromised');
  State.structures=walls();
  api.invalidate('repaired walls');
  const rebuilt=api.getSnapshot();
  assert.equal(rebuilt.compartments.length,1);
  assert.equal(rebuilt.compartments[0].breached,undefined);
  assert.equal(rebuilt.compartments[0].state,'secure');
});
test('breached outer ring does not compromise independently closed inner refuge',async()=>{
  const outer=walls(),inner=[
    piece('inner-n','wall',7,7,13,7.5),piece('inner-s','wall',7,12.5,13,13),
    piece('inner-w','wall',7,7,7.5,13),piece('inner-e','wall',12.5,7,13,13)
  ];
  const enemy=[{x:6,y:10}];
  const battle={units:()=>[],enemy:()=>enemy,uiState:()=>({alarm:'off',alert:'clear'})};
  const {State,api}=await boot([...outer,...inner],[],{hills:[]},battle);
  assert.equal(api.getSnapshot().compartments.length,2);
  api.markBreach(outer[0],{x:9,y:4.25},{x:11,y:4.25});
  State.structures=[...outer.slice(1),...inner];
  api.invalidate('outer wall down');
  const out=api.getSnapshot();
  const keepId=api.sectorAt({x:10,y:10}),outerId=api.sectorAt({x:6,y:10});
  assert.ok(outerId&&keepId&&outerId!==keepId);
  assert.equal(api.controlState(outerId).state,'invaded');
  assert.equal(api.controlState(keepId).state,'secure');
});

test('sustained uncontested occupation confirms capture, defeat alone does not',async()=>{
  const enemies=[{id:'intruder',x:10,y:10}],friends=[];
  const captures=[],siege={
    circleCaptureRecords:()=>captures.filter(r=>!r.reclaimed),
    captureCircleSector(sector){
      const record={id:'capture-record',originId:sector.id,polygon:sector.polygon,
        boundaries:sector.boundaries,anchors:sector.anchors,depth:sector.depth};
      captures.push(record);return{ok:true,record,lost:{food:0}};
    },
    releaseCircleSector(id){
      const r=captures.find(r=>r.id===id);if(!r)return{ok:false};
      r.reclaimed=true;return{ok:true,record:r};
    }
  };
  const battle={enemy:()=>enemies,units:()=>friends,
    uiState:()=>({alarm:'off',alert:'clear'})};
  const {api,events}=await boot(walls(),[],{hills:[]},battle,null,siege);
  const id=api.getSnapshot().compartments[0].id;
  assert.equal(api.tickOccupation(2).length,0);
  assert.equal(api.tickOccupation(2.49).length,0);
  assert.equal(api.controlState(id).state,'invaded');
  assert.equal(api.tickOccupation(2.5).length,1);
  assert.equal(api.controlState(id).state,'captured');
  assert.equal(captures.length,1);
  assert.ok(events.some(e=>e.type==='conquer-circle-captured'));
  enemies.splice(0);api.invalidateControl();api.updateControl(true);
  assert.equal(api.controlState(id).state,'captured');
  friends.push({x:10,y:10});api.invalidateControl();
  assert.equal(api.tickOccupation(3).length,0);
  assert.equal(api.tickOccupation(3.5).length,1);
  assert.equal(api.controlState(id).state,'secure');
  assert.ok(events.some(e=>e.type==='conquer-circle-reclaimed'));
});
test('after reload a captured breached sector remains blocked and identifiable',async()=>{
  const captures=[],siege={
    circleCaptureRecords:()=>captures,
    captureCircleSector(sector){
      const record={id:'persistent-sector',originId:sector.id,polygon:sector.polygon,
        boundaries:sector.boundaries,anchors:sector.anchors,depth:sector.depth};
      captures.push(record);return{ok:true,record,lost:{food:900}};
    },
    releaseCircleSector:()=>({ok:false})
  };
  const battle={enemy:()=>[{x:10,y:10}],units:()=>[],
    uiState:()=>({alarm:'off',alert:'clear'})};
  const original=walls();
  const {api,State}=await boot(original,[],{hills:[]},battle,null,siege);
  api.markBreach(original[0],{x:9,y:4.25},{x:11,y:4.25});
  State.structures=original.slice(1);api.invalidate('siege breach');
  assert.equal(api.getSnapshot().compartments[0].state,'invaded');
  api.tickOccupation(1);api.tickOccupation(1.5);
  assert.equal(api.getSnapshot().compartments[0].state,'captured');
  const loaded=await boot(original.slice(1),[],{hills:[]},battle,null,siege);
  assert.equal(loaded.api.getSnapshot().compartments.length,1);
  assert.equal(loaded.api.getSnapshot().compartments[0].state,'captured');
  assert.equal(loaded.api.sectorAt({x:10,y:10}),loaded.api.getSnapshot().compartments[0].id);
});


test('captured original sector split into two successors does not capture both',async()=>{
  const records=[],siege={circleCaptureRecords:()=>records};
  const first=walls();
  const {State,api}=await boot(first,[],{hills:[]},null,null,siege);
  const original=api.getSnapshot().compartments[0];
  records.push({id:'split-capture',originId:original.id,
    anchors:original.anchors,polygon:original.polygon,
    boundaries:original.boundaries,depth:original.depth});
  api.invalidateControl();api.updateControl(true);
  assert.equal(api.getSnapshot().controlSummary.captured,1);
  State.structures=[...first,piece('divider','wall',9.75,4,10.25,16)];
  api.invalidate('compartment divided by new wall');
  const next=api.getSnapshot();
  assert.equal(next.compartments.length,2);
  assert.equal(next.controlSummary.captured,1);
  assert.equal(next.controlSummary.safe,1);
  assert.equal(next.compartments.filter(c=>c.captured).length,1);
});
