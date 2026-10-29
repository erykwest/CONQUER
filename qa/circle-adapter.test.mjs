import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import * as topology from '../src/circle/defensive-topology.mjs';
import * as control from '../src/circle/defensive-control.mjs';
const script=readFileSync(new URL('../src/settlement-circle.js',import.meta.url),'utf8')
  .replace("Promise.all([\n    import('./circle/defensive-topology.mjs?v=circle-1'),\n    import('./circle/defensive-control.mjs?v=circle-1')\n  ]).then",
    'Promise.resolve([circleModule,controlModule]).then');
const rect=(a,b,c,d)=>[{x:a,y:b},{x:c,y:b},{x:c,y:d},{x:a,y:d}];
const piece=(id,type,a,b,c,d,extra={})=>({
  id,type,polygon:rect(a,b,c,d),...extra
});
const walls=()=>[
  piece('north','wall',4,4,16,4.5),piece('south','wall',4,15.5,16,16),
  piece('west','wall',4,4,4.5,16),piece('east','wall',15.5,4,16,16)
];
async function boot(structures,environment=[],relief={hills:[]},battle=null,wallwalk=null) {
  const State={structures,environment,relief};
  const events=[];
  const window={dispatchEvent(e){events.push(e)},ConquerTerraforming:{edits:()=>[]},
    ConquerCombat:battle||{
      units:()=>[],enemy:()=>[],uiState:()=>({alarm:'off',alert:'clear'})
    },ConquerWallWalk:wallwalk};
  const context={State,window,BUILD_MIN:0,BUILD_MAX:20,
    underConstruction:s=>!!s.incomplete,
    footprintPoints:s=>s.polygon,reliefEdgeBands:()=>[],
    towerDoorSpecs:()=>[],gatePassageInfo:()=>null,
    setTimeout:fn=>{fn();return 1},clearTimeout:()=>{},
    CustomEvent:class{constructor(name,opts){this.type=name;this.detail=opts.detail}},
    circleModule:topology,controlModule:control,console};
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
