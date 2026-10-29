import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import * as topology from '../src/circle/defensive-topology.mjs';
const script=readFileSync(new URL('../src/settlement-circle.js',import.meta.url),'utf8')
  .replace("import('./circle/defensive-topology.mjs?v=circle-1').then",
    'Promise.resolve(circleModule).then');
const rect=(a,b,c,d)=>[{x:a,y:b},{x:c,y:b},{x:c,y:d},{x:a,y:d}];
const piece=(id,type,a,b,c,d,extra={})=>({
  id,type,polygon:rect(a,b,c,d),...extra
});
const walls=()=>[
  piece('north','wall',4,4,16,4.5),piece('south','wall',4,15.5,16,16),
  piece('west','wall',4,4,4.5,16),piece('east','wall',15.5,4,16,16)
];
async function boot(structures,environment=[],relief={hills:[]}) {
  const State={structures,environment,relief};
  const window={dispatchEvent(){},ConquerTerraforming:{edits:()=>[]}};
  const context={State,window,BUILD_MIN:0,BUILD_MAX:20,
    underConstruction:s=>!!s.incomplete,
    footprintPoints:s=>s.polygon,reliefEdgeBands:()=>[],
    towerDoorSpecs:()=>[],gatePassageInfo:()=>null,
    setTimeout:fn=>{fn();return 1},clearTimeout:()=>{},
    CustomEvent:class{constructor(name,opts){this.type=name;this.detail=opts.detail}},
    circleModule:topology,console};
  runInNewContext(script,context,{filename:'settlement-circle.js'});
  await Promise.resolve();
  return{State,api:window.ConquerCircle};
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
