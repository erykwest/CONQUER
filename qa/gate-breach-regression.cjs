'use strict';
// Gates: a closed gate with its door whole shuts the passage; the ram wears the door
// down (intact > damaged > broken) and a broken door leaves the passage open for good
// (a raised drawbridge goes with it). The ram may only be set against a gate. The
// combat side mans the ram, swings it and sends the attackers in through the passage.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const root=__dirname+'/../src/';
const siege=fs.readFileSync(root+'settlement-siege.js','utf8');
function fixture(){
  const State={clock:{day:3},structures:[],siege:null,selectedId:null,view:{scale:1}};
  const calls={nav:0};
  const ctx=vm.createContext({State,window:{},console,Math,Number,Object,Array,Map,Set,String,
    structureLevel:s=>s.level||1,structureHeight:s=>[2.8,4,5.2][(s.level||1)-1],wallTier:()=>2,wallSkin:()=>'standard',towerTier:()=>2,
    underConstruction:()=>false,invalidateStructureScene:()=>{},invalidateSceneCache:()=>{},
    invalidateNavigation:()=>{calls.nav++},markDirty:()=>{},renderFunctionPanel:()=>{},draw:()=>{},status:()=>{},terrainElevation:()=>0});
  vm.runInContext(siege,ctx);
  return{State,S:ctx.window.ConquerSiege,calls};
}
{
  const {State,S,calls}=fixture(),gate={id:'g',type:'gate',x:0,y:0,level:1,drawbridge:{installed:true,raised:true,progress:1}};
  State.structures.push(gate);
  assert.equal(S.doorStage(gate),'intact');assert.equal(S.gateClosed(gate),false,'gates stand open by default');
  assert.ok(S.setGateClosed('g',true)&&S.gateClosed(gate),'closed from its panel');
  assert.ok(calls.nav>0,'closing re-routes everyone');
  S.attackStructure('g','ram',2,'door');S.attackStructure('g','ram',2,'door');S.attackStructure('g','ram',2,'door');
  assert.equal(S.doorStage(gate),'damaged','the ram cracks the door');
  for(let i=0;i<10;i++)S.attackStructure('g','ram',2,'door');
  assert.equal(S.doorStage(gate),'broken','and breaks it in');
  assert.equal(S.gateClosed(gate),false,'a broken gate no longer shuts the passage');
  assert.equal(gate.drawbridge,undefined,'the raised drawbridge went with the door');
  assert.equal(S.setGateClosed('g',true),false,'and it cannot be closed again');
  assert.equal(S.doorAsset(gate),'gatePortalBroken','the portal shows the broken door');
  console.log('PASS gates close, crack and break in');
}
{
  const {S}=fixture();
  assert.equal(S.assaultCheck({id:'g',type:'gate',level:1},'ram').ok,true,'the ram goes against a gate');
  assert.equal(S.assaultCheck({id:'w',type:'wall',a:{x:0,y:0},b:{x:4,y:0},tier:2},'ram').ok,false,'not against a stone wall');
  console.log('PASS the ram is for gates');
}
{
  const nav=fs.readFileSync(root+'settlement-population-navigation.js','utf8');
  assert.match(nav,/if\(gatePointInPassage\(s,p,\.08\)\)\{if\(window\.ConquerSiege\?\.gateClosed\?\.\(s\)(\|\|[^)]*\))?\)return true;continue\}/,'a closed gate blocks its passage');
  const combat=fs.readFileSync(root+'settlement-combat.js','utf8');
  assert.match(combat,/attackStructure\(gate\.id,'ram',manned\.length\*\.5,'door'\)/,'every blow of a manned ram hits the door');
  assert.match(combat,/e\.gateway=storm\.gateId/,'after the breach they go in through the passage');
  assert.match(combat,/if\(d<1\.5\)path=\[from,to\];/,'no walking through masonry when a route fails');
  const w3=fs.readFileSync(root+'settlement-world3d.js','utf8');
  assert.match(w3,/'gatePortalDamaged','gatePortalBroken'/,'3D decals for the damaged and broken door');
  assert.ok(fs.existsSync(root+'assets/architecture/gate_portal_broken.png')&&fs.existsSync(root+'assets/architecture/gate_portal_damaged.png'));
  console.log('PASS ram storms, passage and portals are wired');
}

{
  // A storey brought down from the top leaves a broken crown: no roof, merlons or deck.
  const core=fs.readFileSync(root+'settlement-core.js','utf8');
  assert.match(core,/if\(s\?\.type==='tower'&&s\.brokenTop&&!isWoodTower\(s\)\)return'broken';/,'a tower with a broken top has no roof style');
  assert.match(core,/if\(s\?\.type==='gate'&&s\.brokenTop\)return'broken';/,'nor does a gatehouse');
  assert.match(siege,/s\.level=L-1;s\.brokenTop=true;/,'a storey collapse breaks the crown');
  assert.match(siege,/if\(s\.brokenTop&&\['tower','gate'\]\.includes\(s\.type\)&&!underConstruction\(s\)\)out\.push\(crownMesh\(s\)\)/,'the broken crown is drawn');
  console.log('PASS partial collapses leave a broken crown');
}
