'use strict';
// Floor-by-floor cutaway: one floor in view, the floors above it taken off.
// - castle (towers, gates, built sections): every floor by default, a cut at the next floor up;
// - civic buildings (town hall storeys): ground floor by default, an upper storey opens on its floor;
// - one command (StructureCommands.stepCutawayFloor) for the inspector and the arrows on the building.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const src=f=>read('src/'+f);
const fnSrc=(text,name)=>{const m=text.match(new RegExp('function '+name+'\\([^)]*\\)\\{[\\s\\S]*?\\n\\}'));assert.ok(m,name+' found');return m[0]};

// ---------- castle: floor count, floor in view, cut height, floors shown
{
  const castle=src('settlement-castle.js'),State={structures:[]},window={};
  const levels=s=>s.levels;
  const ctx=vm.createContext({State,window,Math,Number,
    clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),cutawayEligible:s=>!!s&&s.type!=='wall',isWoodTower:s=>s.material==='wood',cutawayFloorLevels:levels});
  vm.runInContext(['civicFloorCutaway','cutawayFloorCount','cutawayVisibleFloor','cutawayCeilingZ','cutawayFloorShown'].map(n=>fnSrc(castle,n)).join('\n'),ctx);
  const run=n=>vm.runInContext(n,ctx);
  const tower={id:'t',type:'tower',levels:[{z:.055},{z:1.6},{z:3.2}]};
  const sub={id:'s',type:'tower',parentTowerId:'t',levels:[{z:.055},{z:1.6}]};
  State.structures=[tower,sub];
  assert.equal(run('cutawayFloorCount')(tower),3);
  assert.equal(run('cutawayVisibleFloor')(tower),2,'castle: every floor in view by default');
  assert.equal(run('cutawayCeilingZ')(tower),Infinity,'no cut on the top floor');
  tower.cutawayFloor=0;
  assert.equal(run('cutawayCeilingZ')(tower),1.6,'ground floor in view: cut at the first floor');
  assert.deepEqual([0,1,2].map(i=>run('cutawayFloorShown')(tower,i)),[true,false,false],'the floors above are taken off');
  tower.cutawayFloor=1;
  assert.equal(run('cutawayCeilingZ')(tower),3.2);
  assert.equal(run('cutawayCeilingZ')(sub),3.2,'a subtower follows its parent');
  assert.equal(run('cutawayFloorCount')(sub),1,'the arrows belong to the parent');
  tower.cutawayFloor=9;assert.equal(run('cutawayVisibleFloor')(tower),2,'clamped to the top floor');
  window.ConquerCivic3D={cutawayActive:s=>s.type==='townhall',floorCount:()=>3,visibleFloor:()=>1};
  assert.equal(run('cutawayFloorCount')({type:'townhall'}),3,'civic buildings count their storeys');
  assert.equal(run('cutawayVisibleFloor')({type:'townhall'}),1);
  console.log('PASS castle: floor in view, cut at the next floor, subtowers follow the parent');
}

// ---------- civic: town hall storeys
{
  const core=src('settlement-core.js'),window={},State={season:'summer',structures:[]};
  const ctx=vm.createContext({window,State,Math,Object,Number,Array,Map,String,Float32Array,
    isPlanView:()=>false,rotateViewPoint:p=>({x:p.x,y:p.y})});
  vm.runInContext(core.slice(core.indexOf('const CIVIC_TYPES='),core.indexOf('function civicParts(')),ctx);
  for(const f of ['assets/civic-models.js','settlement-mesh3d.js','settlement-civic3d.js'])vm.runInContext(src(f),ctx);
  const C3=window.ConquerCivic3D;
  const hall=(level,floor)=>({id:'th',type:'townhall',x:0,y:0,angle:0,civicLevel:level,...(floor==null?{}:{cutawayFloor:floor})});
  assert.deepEqual([1,2,3].map(l=>C3.floorCount(hall(l))),[2,2,3],'storeys of the L1-L3 town hall models');
  assert.equal(C3.floorCount({type:'church',civicLevel:2}),1,'a church has one storey: no arrows');
  const faces=(level,floor)=>{
    State.structures=[hall(level,floor)];State.selectedId='th';
    const out=[];C3.addCutawayToBuilder({face:vs=>out.push(vs)},0);return out;
  };
  State.structures=[hall(3)];State.selectedId='th';
  assert.equal(C3.cutawaySig(),'th@0','the ground floor by default');
  const ground=faces(3),groundAgain=faces(3,0);
  assert.equal(groundAgain.length,ground.length,'floor 0 is the cutaway as it was');
  for(const [floor,z,ceiling] of [[1,1.171,2.129],[2,2.129,Infinity]]){
    const fs=faces(3,floor);
    assert.equal(C3.cutawaySig(),'th@'+floor,'the signature carries the storey (re-bakes both renderers)');
    const flat=vs=>vs.every(v=>Math.abs(v.z-vs[0].z)<1e-6);
    assert.ok(fs.some(vs=>flat(vs)&&Math.abs(vs[0].z-(z+.03))<1e-6),'storey '+floor+' has its plank floor');
    if(Number.isFinite(ceiling))assert.ok(fs.every(vs=>vs.every(v=>v.z<=ceiling+1e-6)),'nothing above the ceiling of storey '+floor);
    // The storey's floor is not covered by any slab or string course just above it.
    const lids=fs.filter(vs=>flat(vs)&&vs[0].z>z+.031&&vs[0].z<z+.4&&vs.some(v=>Math.abs(v.x)<1.5&&v.y>.2&&v.y<1.4));
    assert.equal(lids.length,0,'storey '+floor+': no slab over the floor');
  }
  State.selectedId=null;
  console.log('PASS civic: town hall storeys, ground floor by default, upper storeys open on their floor');
}

// ---------- command and UI
{
  const cmds=src('settlement-structure-commands.js');
  const State={structures:[{id:'t',type:'tower',cutawayFloor:undefined}]},calls=[];
  const ctx=vm.createContext({State,window:{},Math,Number,
    clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),markStructureDirty:()=>calls.push('dirty'),renderFunctionPanel:()=>{},draw:()=>calls.push('draw'),status:()=>{},
    cutawayFloorCount:()=>3,cutawayVisibleFloor:s=>Number.isInteger(s.cutawayFloor)?s.cutawayFloor:2});
  vm.runInContext(cmds.replace(/^const StructureCommands=/m,'globalThis.StructureCommands='),ctx);
  const C=ctx.StructureCommands,t=State.structures[0];
  assert.equal(C.stepCutawayFloor('t',1),false,'already on the top floor');
  assert.equal(C.stepCutawayFloor('t',-1),true);assert.equal(t.cutawayFloor,1);
  C.stepCutawayFloor('t',-5);assert.equal(t.cutawayFloor,0,'one floor per step');
  assert.ok(calls.includes('draw'),'the scene redraws');
  assert.match(cmds,/d\.cutawayFloor=\{index:cutawayVisibleFloor\(s\),count:cutawayFloorCount\(s\)\}/,'inspector descriptor');
  assert.match(src('ui/shell.js'),/run\('stepCutawayFloor', o\.v\)/,'new inspector: ▲ ▼ row');
  assert.match(src('settlement-app-rooms.js'),/data-cutaway-floor/,'legacy panel buttons');
  const arrows=src('settlement-cutaway-floors.js');
  assert.match(arrows,/StructureCommands\.stepCutawayFloor\(shownFor/,'arrows on the building run the same command');
  assert.match(read('index.html'),/settlement-cutaway-floors\.js/,'arrows loaded');
  // Every renderer honours the cut.
  assert.match(src('settlement-castle.js'),/height=Math\.min\(full,cutawayCeilingZ\(s\)\)/,'2.5D castle cut');
  assert.match(src('settlement-world3d.js'),/H=Math\.min\(HF,cutawayCeilingZ\(s\)\)/,'WebGL castle cut');
  assert.match(src('settlement-world3d.js'),/cutawayCeilingZ\(s\),s\.x\?\?s\.a\?\.x/,'WebGL cutaway rebuilds on a floor change');
  assert.match(src('settlement-render.js'),/s\.cutawayFloor\?\?null/,'2.5D overlay cache key');
  assert.match(src('settlement-cutaway-furniture.js'),/faces\.filter\(f=>shown\(s,f\)\)/,'furniture of the floors above is not drawn');
  assert.match(src('settlement-population-garrisons.js'),/cutawayFloorShown\(s,slot\.floor\)/,'no occupants in rooms taken off');
  console.log('PASS one command for the inspector and the arrows; every renderer honours the cut');
}
