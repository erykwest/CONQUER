'use strict';
// Fire: timber burns whole, stone burns only its wooden parts (pitched roof, hoarding,
// gate door), bare masonry does not burn. A fire grows, eats its fuel, damages through
// the siege rules (torch: wood and doors only), spreads to what stands close, and a
// timber structure that falls while burning leaves burning rubble nobody crosses, not
// even in a breach. Rain slows it all. Burning shots: fire arrows and stones.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const root=__dirname+'/../src/';
const src=['settlement-collapse.js','settlement-siege.js','settlement-fire.js'].map(f=>fs.readFileSync(root+f,'utf8')).join('\n');
const square=(x,y,h)=>[{x:x-h,y:y-h},{x:x+h,y:y-h},{x:x+h,y:y+h},{x:x-h,y:y+h}];

function fixture({rain=false,seed=7}={}){
  let s=seed;const random=()=>(s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296;
  const State={clock:{day:5},structures:[],siege:null,view:{scale:1}};
  const ctx=vm.createContext({
    State,window:{},console,Object,Array,Map,Set,String,Number,performance:{now:()=>0},
    Math:Object.assign(Object.create(Math),{random}),
    structureLevel:s=>s.level||1,
    structureHeight:s=>s.type==='ruin'?s.ruinHeight:s.type==='tower'?[2.35,3.55,4.75][(s.level||1)-1]:s.type==='house'?2.26:s.type==='gate'?2.8:1.15,
    footprintPoints:s=>square(s.x,s.y,s.type==='house'?1:.75),houseFootprintParts:s=>[{points:square(s.x,s.y,1)}],houseLevel:()=>2,
    wallTier:s=>s.tier||2,wallSkin:s=>s.skin||'standard',towerTier:()=>2,isCivic:()=>false,rectDims:()=>({w:1.5,h:1.5}),
    isWoodTower:s=>s.type==='tower'&&s.material==='wood',isWoodGate:s=>s.type==='gate'&&s.material==='wood',
    towerRoofStyle:s=>s.type==='tower'?(s.roofStyle||'battlement'):undefined,gateRoofStyle:s=>s.roofStyle||'battlement',
    weatherGroundWet:()=>rain,normalizeFunctions:()=>{},invalidateUrbanGeometry:()=>{},
    underConstruction:()=>false,invalidateStructureScene:()=>{},invalidateSceneCache:()=>{},invalidateNavigation:()=>{},
    markDirty:()=>{},renderFunctionPanel:()=>{},draw:()=>{},status:()=>{},terrainElevation:()=>0
  });
  vm.runInContext(src,ctx);
  return{State,F:ctx.window.ConquerFire,S:ctx.window.ConquerSiege};
}
const run=(F,secs,step=.25)=>{for(let t=0;t<secs;t+=step)F.tick(step)};
const house=(id,x,y)=>({id,type:'house',x,y,functions:[]});

{
  const {F}=fixture();
  const kinds=[
    [house('h',0,0),'whole'],[{id:'wt',type:'tower',material:'wood',x:0,y:0},'whole'],
    [{id:'p',type:'palisade',a:{x:0,y:0},b:{x:4,y:0}},'whole'],
    [{id:'st',type:'tower',material:'stone',roofStyle:'pitched',x:0,y:0},'roof'],
    [{id:'sb',type:'tower',material:'stone',roofStyle:'battlement',x:0,y:0},''],
    [{id:'w',type:'wall',skin:'hoarding',a:{x:0,y:0},b:{x:4,y:0}},'hoarding'],
    [{id:'w2',type:'wall',a:{x:0,y:0},b:{x:4,y:0}},''],
    [{id:'g',type:'gate',material:'stone',x:0,y:0},'door']];
  for(const [s,part] of kinds)assert.equal(F.parts(s).map(p=>p.part).join('+'),part,s.id+' burns: '+(part||'nothing'));
  console.log('PASS what burns: timber whole, stone only its wooden parts, masonry never');
}
{
  // A house burns down, falls, and its rubble burns and blocks the way.
  const {State,F,S}=fixture();
  const h=house('h',0,0);State.structures.push(h);
  F.ignite('h',{heat:.3});
  run(F,10);
  assert.ok(S.integrity(h).core.hp<S.integrity(h).core.max,'burning hurts it');
  for(let k=0;k<800&&State.structures.includes(h);k++)F.tick(.25);
  assert.ok(!State.structures.includes(h),'it burns down and falls');
  const ember=F.state().embers[0];
  assert.ok(ember&&ember.heat>0,'its rubble keeps burning');
  assert.ok(S.rubbleBlocks({x:0,y:0}),'nobody crosses burning rubble');
  run(F,60);
  assert.equal(F.state().embers.length,0,'the embers die');
  console.log('PASS a house burns down into burning rubble that blocks, then dies down');
}
{
  // Stone with wooden parts: the roof burns off, the hoarding burns away, masonry stands.
  const {State,F,S}=fixture();
  const st={id:'st',type:'tower',material:'stone',roofStyle:'pitched',level:2,x:0,y:0,functions:[]};
  const w={id:'w',type:'wall',skin:'hoarding',a:{x:10,y:0},b:{x:14,y:0},width:.5,level:1,tier:2};
  State.structures.push(st,w);
  const hp0=S.integrity(st).core.hp;
  F.ignite('st');F.ignite('w');
  run(F,80);
  assert.equal(st.roofStyle,'battlement','the pitched roof burnt off');
  assert.ok(st.roofBurnt&&st.charred);
  assert.equal(S.integrity(st).core.hp,hp0,'a burning roof does not crack the masonry');
  assert.equal(w.skin,'standard','the hoarding burnt away');
  assert.equal(F.parts(st).length,0,'nothing left to burn');
  console.log('PASS stone keeps standing, its roof and hoardings burn away');
}
{
  // The gate door burns (its own integrity), not the gatehouse.
  const {State,F,S}=fixture();
  const g={id:'g',type:'gate',material:'stone',x:0,y:0,angle:Math.PI,functions:[]};State.structures.push(g);
  const core=S.integrity(g).core.hp;
  F.ignite('g',{z:.3});
  run(F,40);
  assert.ok(S.integrity(g).door.hp<S.integrity(g).door.max,'the door burns');
  assert.equal(S.integrity(g).core.hp,core,'the gatehouse does not');
  console.log('PASS a torch at the gate burns the door');
}
{
  // Spread: a burning house sets its neighbour alight; rain makes that much rarer.
  const spread=rain=>{
    let n=0;
    for(let k=0;k<12;k++){
      const {State,F}=fixture({rain,seed:100+k});
      State.structures.push(house('a',0,0),house('b',2.4,0));
      F.ignite('a',{heat:1});run(F,25);
      if(F.burning('b')||!State.structures.some(s=>s.id==='b'))n++;
    }
    return n;
  };
  const dry=spread(false),wet=spread(true);
  assert.ok(dry>=9,'next door catches fire in dry weather ('+dry+'/12)');
  assert.ok(wet<dry,'rain slows the spread ('+wet+' vs '+dry+')');
  const {State,F}=fixture();State.structures.push(house('a',0,0),house('far',20,0));
  F.ignite('a',{heat:1});run(F,30);
  assert.equal(F.burning('far'),false,'it does not jump across the village');
  console.log('PASS fire spreads to close neighbours, less in the rain');
}
{
  // Burning shots: a fire stone strikes and sets alight; fire arrows may set a roof alight.
  const {State,F,S}=fixture();
  const wt={id:'wt',type:'tower',material:'wood',level:1,x:0,y:0,functions:[]};State.structures.push(wt);
  const hp0=S.integrity(wt).core.hp;
  assert.equal(F.volley(wt,'stone',{x:-5,y:0}),1);
  run(F,3,.1);
  assert.ok(S.integrity(wt).core.hp<hp0,'the stone strikes');
  assert.ok(F.burning('wt'),'and the tower is alight');
  let lit=0;
  for(let k=0;k<6;k++){
    const x=fixture({seed:300+k}),st={id:'st',type:'tower',material:'stone',roofStyle:'pitched',x:0,y:0,functions:[]};
    x.State.structures.push(st);x.F.volley(st,'arrows',{x:-5,y:0});run(x.F,3,.1);
    if(x.F.burning('st'))lit++;
  }
  assert.ok(lit>=4,'a volley of fire arrows usually sets a wooden roof alight ('+lit+'/6)');
  const bare=fixture(),sb={id:'sb',type:'tower',material:'stone',x:0,y:0,functions:[]};
  bare.State.structures.push(sb);bare.F.volley(sb,'arrows');run(bare.F,3,.1);
  assert.equal(bare.F.burning('sb'),false,'fire arrows do nothing to bare masonry');
  console.log('PASS fire stones and fire arrows');
}
{
  // Bucket brigade: the women put out a fire an arrow has just started, from a well
  // close by; a full blaze with a distant well beats them; no well, no brigade.
  const near=fixture();
  near.State.structures.push({id:'well',type:'well',x:4,y:0},house('h',0,0));
  near.F.ignite('h',{heat:.2,x:-1,y:0});
  for(let k=0;k<160&&near.F.burning('h');k++)near.F.tick(.25);
  assert.equal(near.F.burning('h'),false,'a single fire arrow is put out');
  assert.ok(near.S.integrity(near.State.structures.find(s=>s.id==='h')).core.hp>100,'before it does much harm');
  near.F.tick(.25);
  assert.ok(near.F.brigade.carriers().length===0||near.F.brigade.carriers().every(c=>c.state==='home'),'and the women go home');
  const far=fixture();
  far.State.structures.push({id:'well',type:'well',x:14,y:0},house('h',0,0));
  far.F.ignite('h',{heat:1});
  for(let k=0;k<240&&far.State.structures.some(s=>s.id==='h');k++)far.F.tick(.25);
  assert.ok(!far.State.structures.some(s=>s.id==='h'),'a full blaze far from the well wins');
  const none=fixture();
  none.State.structures.push(house('h',0,0));none.F.ignite('h',{heat:.2});none.F.tick(.5);
  assert.equal(none.F.brigade.carriers().length,0,'no well, no brigade');
  const off=fixture();
  off.State.structures.push({id:'well',type:'well',x:4,y:0},house('h',0,0));
  off.F.brigade.set(false);off.F.ignite('h',{heat:.2});off.F.tick(.5);
  assert.equal(off.F.brigade.carriers().length,0,'the brigade can be stood down');
  console.log('PASS bucket brigade: small fires are put out, a blaze from afar wins');
}