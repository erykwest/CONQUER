'use strict';
// Collapses: the lost volume breaks into blocks that fall and settle in a heap, the
// same every time (rebuilt from a save). Towers and gatehouses lose their top storey at
// 2/3 and 1/3 of their health and fall whole at zero; houses come down whole; walls
// that leant on a fallen tower stay as open ends.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const root=__dirname+'/../src/';
const collapse=fs.readFileSync(root+'settlement-collapse.js','utf8');
const siege=fs.readFileSync(root+'settlement-siege.js','utf8');
const square=(x,y,h)=>[{x:x-h,y:y-h},{x:x+h,y:y-h},{x:x+h,y:y+h},{x:x-h,y:y+h}];

// ---- the collapse module alone
{
  const window={};vm.runInContext(collapse,vm.createContext({window,Math,Number,Object,Array,Map,String}));
  const C=window.ConquerCollapse;
  const spec={id:'t1',parts:[square(10,10,.75)],z0:0,z1:4.8,ground:0,seed:'t1',palette:{side:['#635951'],top:['#9a8e82']},lean:{x:1,y:0}};
  const a=C.blocks(spec);C.forget('t1');const b=C.blocks(spec);
  assert.deepEqual(a.map(k=>[k.x,k.y,k.z,k.restZ]),b.map(k=>[k.x,k.y,k.z,k.restZ]),'the same collapse every time');
  assert.ok(a.length>20&&a.length<=220,'a bounded cloud of blocks ('+a.length+')');
  const start=C.mesh(spec,0);
  assert.ok(start.pos.every(Number.isFinite)&&start.pos.length===start.col.length*9);
  for(let i=2;i<start.pos.length;i+=3)assert.ok(start.pos[i]>=-.05&&start.pos[i]<=4.8+.5,'at t=0 the blocks fill the lost volume');
  const D=C.duration(spec);
  assert.ok(D>.5&&D<6,'it plays in a few seconds ('+D.toFixed(2)+' s)');
  const end=C.mesh(spec,Infinity);
  for(let i=2;i<end.pos.length;i+=3)assert.ok(end.pos[i]>=-.35,'nothing ends below the ground');
  const rest=a.map(k=>C.pose(k,1e9));
  assert.ok(rest.every(p=>p.z<2),'everything has come down');
  const meanX=rest.reduce((s,p)=>s+p.x,0)/rest.length;
  assert.ok(meanX>10,'the heap leans the way the tower fell');
  assert.ok(rest.every(p=>Math.hypot(p.x-10,p.y-10)<.75+4.8),'the heap stays near its footprint');
  assert.ok(C.dust(spec,.8).length>0,'dust where the blocks land');
  assert.equal(C.dust(spec,D+5).length,0);assert.ok(C.finished(spec,D+5));
  // A storey falling off a tower: what lands on the stump rests on its top.
  const storey={...spec,id:'t2',seed:'t2',z0:3.6,z1:4.8,stump:true,lean:{x:.1,y:0}};
  const on=C.blocks(storey).filter(k=>Math.abs(k.restZ-3.6)<.5);
  assert.ok(on.length>0,'some rubble stays on the stump');
  console.log('PASS collapse: deterministic blocks fall, lean and settle; dust; stumps');
  // Wood breaks into long beams and planks, not cubes; on the ground they lie down.
  const wood={...spec,id:'w1',seed:'w1',z1:2.4,material:'wood',palette:{side:['#7a5534'],top:['#6b4a2e']}};
  const pieces=C.blocks(wood);
  assert.ok(pieces.length>8&&pieces.every(k=>k.kind==='beam'||k.kind==='plank'),'only beams and planks');
  assert.ok(pieces.every(k=>k.s[0]>=2*Math.max(k.s[1],k.s[2])),'long pieces');
  assert.ok(pieces.filter(k=>k.kind==='plank').every(k=>k.s[2]<k.s[1]/3),'planks are thin boards');
  const flat=a=>Math.abs(Math.sin(a))<1e-6;
  assert.ok(pieces.every(k=>{const q=C.pose(k,1e9);return flat(q.ry)&&(k.kind!=='plank'||flat(q.rx))}),'at rest they lie flat, planks on their face');
  assert.ok(pieces.some(k=>k.r0[1]!==0),'some start upright, like posts, and topple');
  // Timber framing: plaster blocks and beams, a roof of boards.
  const timber=C.blocks({...spec,id:'h1',seed:'h1',z1:2.2,material:'timber',hollow:true,palette:{side:['#c9b896'],top:['#7a4a38'],beam:['#4e392d']}});
  assert.ok(['block','beam','plank'].every(kind=>timber.some(k=>k.kind===kind)),'plaster, beams and roof boards');
  assert.ok(timber.filter(k=>k.kind==='beam').every(k=>k.col==='#4e392d'),'beams in the timber colour');
}

// ---- towers, houses and walls in the siege domain
function fixture(){
  const State={clock:{day:30},structures:[],siege:null,selectedId:null,view:{scale:1}};
  const calls={urban:0,functions:0};
  const ctx=vm.createContext({
    State,window:{},console,Math,Number,Object,Array,Map,Set,String,performance:{now:()=>0},
    structureLevel:s=>s.level||1,wallTier:s=>s.tier||2,
    structureHeight:s=>s.type==='ruin'?s.ruinHeight:s.type==='tower'?[2.35,3.55,4.75][(s.level||1)-1]:s.type==='house'?2.26:[1.15,2.1][(s.level||1)-1],
    footprintPoints:s=>square(s.x,s.y,.75),houseFootprintParts:s=>[{points:square(s.x,s.y,1)}],houseLevel:()=>2,
    wallTier:()=>2,wallSkin:()=>'standard',towerTier:()=>2,isWoodTower:s=>s.material==='wood',isCivic:()=>false,
    normalizeFunctions:()=>{calls.functions++},invalidateUrbanGeometry:()=>{calls.urban++},
    underConstruction:()=>false,invalidateStructureScene:()=>{},invalidateSceneCache:()=>{},invalidateNavigation:()=>{},
    markDirty:()=>{},renderFunctionPanel:()=>{},draw:()=>{},status:()=>{},terrainElevation:()=>0
  });
  vm.runInContext(collapse+'\n'+siege,ctx);
  return{State,S:ctx.window.ConquerSiege,calls};
}
{
  const {State,S,calls}=fixture();
  const tower={id:'T',type:'tower',shape:'square',size:1.5,level:3,x:5,y:5,functions:[]};
  const wall={id:'W',type:'wall',a:{x:5.75,y:5},b:{x:12,y:5},aSnap:'T',bSnap:null,width:.5,level:1};
  State.structures.push(tower,wall);
  const max=S.integrity(tower).core.max;
  S.attackStructure('T','trebuchet',(max*.30)/7);
  assert.equal(tower.level,3,'above 2/3 of its health the tower stands whole');
  S.attackStructure('T','trebuchet',(max*.06)/7,{x:2,y:5});
  assert.equal(tower.level,2,'below 2/3 the top storey falls');
  let r=State.siege.ruins.at(-1);
  assert.equal(r.cause,'storey');assert.ok(Math.abs(r.spec.z0-3.55)<1e-9&&r.spec.z1>4.75,'the lost slab is the top storey');
  assert.ok(r.spec.stump&&r.spec.lean.x>0,'it rests partly on the stump, thrown away from the blow');
  assert.ok(calls.functions>0,'rooms up there are dropped');
  const hp=tower.siegeIntegrity.core;
  assert.ok(hp.hp>0&&hp.hp<=hp.max&&hp.max<max,'a sound lower tower with the health it still had');
  for(let k=0;k<200&&tower.type==='tower';k++)S.attackStructure('T','trebuchet',5);
  assert.equal(tower.type,'ruin','a stone tower never falls whole: a ruined stump stays');
  assert.equal(State.structures.filter(s=>s.id==='T').length,1,'same structure, same id');
  assert.ok(tower.ruinHeight>=2.35*.34-1e-9&&tower.ruinHeight<=2.35*.5+1e-9,'a third to a half of it stays standing');
  assert.ok(!tower.functions&&!tower.archerCount&&!tower.siegeIntegrity,'no rooms, no posts, no health left to take');
  assert.equal(wall.aSnap,'T','the wall still leans on the stump: no way through');
  assert.equal(State.siege.ruins.filter(x=>x.cause==='storey').length,2,'two storeys fell on the way down');
  assert.ok(State.siege.ruins.filter(x=>x.cause==='storey').every(x=>!x.spec.stump),'rubble on the stump came down with it');
  const last=State.siege.ruins.at(-1);
  assert.equal(last.cause,'ruin');assert.ok(last.spec.stump&&Math.abs(last.spec.z0-tower.ruinHeight)<1e-3,'the top comes down onto the stump');
  assert.ok(S.dynamicMeshes().every(m=>m.pos.length===m.col.length*9&&m.pos.every(Number.isFinite)),'heaps and stump for the 3D renderer');
  // Rubble: a high core nobody crosses, a slowing fringe, no heavy engine at all.
  let core=0,fringe=0;
  for(let x=1;x<=9;x+=.25)for(let y=1;y<=9;y+=.25){const p={x,y};if(!S.rubbleAt(p))continue;if(S.rubbleBlocks(p))core++;else fringe++;
    assert.equal(S.rubbleFactor(p,'ram'),0,'heavy engines cannot cross rubble');if(!S.rubbleBlocks(p))assert.equal(S.rubbleFactor(p),.5,'infantry is slowed')}
  assert.ok(core>0&&fringe>0,'a blocking core and a slowing fringe ('+core+'/'+fringe+')');
  assert.equal(S.rubbleFactor({x:40,y:40}),1,'clear ground elsewhere');
  console.log('PASS stone towers lose storeys, then stand as ruined stumps in their rubble');
}
{
  const {State,S}=fixture();
  const wood={id:'WT',type:'tower',shape:'square',size:1.5,level:1,x:5,y:5,material:'wood',functions:[]};
  const wall={id:'W',type:'wall',a:{x:5.75,y:5},b:{x:12,y:5},aSnap:'WT',bSnap:null,width:.5,level:1};
  State.structures.push(wood,wall);
  // Towers (including timber ones) require structural artillery, not axe strikes.
  assert.equal(S.attackStructure('WT','axe',10).damage,0);
  for(let k=0;k<200&&State.structures.includes(wood);k++)S.attackStructure('WT','trebuchet',10);
  assert.ok(!State.structures.includes(wood),'a wooden tower comes down whole');
  assert.equal(wall.aSnap,null,'and leaves the wall an open end');
  assert.equal(State.siege.ruins.at(-1).spec.material,'wood');
  console.log('PASS wooden towers fall whole');
}
{
  // A breach heap is a way in: it slows, it never walls the gap up.
  const {State,S}=fixture();
  const wall={id:'B',type:'wall',a:{x:0,y:0},b:{x:2.5,y:0},width:.5,level:1,tier:2};
  State.structures.push(wall);
  for(let k=0;k<50&&State.structures.includes(wall);k++)S.attackStructure('B','trebuchet',10,0);
  let cells=0;
  for(let x=-2;x<=4.5;x+=.25)for(let y=-2;y<=2;y+=.25){const p={x,y};if(S.rubbleAt(p)){cells++;assert.equal(S.rubbleBlocks(p),false,'a breach heap never blocks')}}
  assert.ok(cells>0,'there is rubble in the breach');
  console.log('PASS breach rubble slows but never blocks');
}
{
  const {State,S,calls}=fixture();
  const house={id:'H',type:'house',x:0,y:0,functions:[]};State.structures.push(house);
  assert.equal(S.attackStructure('H','axe',1).ok,true,'timber-framed houses take axe blows');
  for(let k=0;k<200&&State.structures.includes(house);k++)S.attackStructure('H','ram',10);
  assert.ok(!State.structures.includes(house),'a house comes down whole');
  const r=State.siege.ruins.at(-1);
  assert.ok(r.spec.hollow&&r.spec.z1===2.26,'a hollow shell up to the ridge');
  assert.ok(calls.urban>0,'the urban geometry forgets it');
  console.log('PASS houses collapse');
}
