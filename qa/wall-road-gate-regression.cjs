'use strict';
// WALL-ROAD-GATE: a wall or palisade drawn across a main road gets a gate of the matching type on
// the crossing (palisade -> wood gate, stone/brick W1 -> small gate, W2-W3 -> large gate), the
// wall is cut on the gate flanks and the road keeps running through the passage.
const fs=require('node:fs');
const harness=fs.readFileSync(__dirname+'/urban-regression.cjs','utf8').split('let passed=0;')[0];
eval(harness+`
run(fs.readFileSync(__dirname+'/../src/settlement-placement.js','utf8'));
let passed=0;
function check(name,body){body();passed++;console.log('PASS '+name)}
const reset=(roads)=>run('State').structures=roads;
const mainRoad=(id,a,b,extra={})=>({id,type:'road',manualMain:true,roadClass:'arterial-manual',width:.62,a,b,...extra});
const commit=(type,tier,a,b,masonry='stone')=>{
  const S=run('State');
  S.tool={kind:'linear',linear:type,tier,label:type};S.buildLevels={...(S.buildLevels||{}),wall:1,wallTier:tier,gate:2};
  S.buildMasonryMaterial=masonry;S.draft={a};
  const seg=run('discreteLinearSegment')(a,b);
  return run('commitStructuralLinearRoute')({segments:[seg],joint:null,length:seg.length},null,run('currentLinearSpec')());
};
const gates=()=>run('State').structures.filter(s=>s.type==='gate');
const walls=t=>run('State').structures.filter(s=>s.type===t);
run("State.environment=[];State.relief=null;clearReliefBandCache();State.village={};State.resources={gold:1e6,wood:1e6,stone:1e6,metal:1e6};");

check('palisade across a main road: wood gate on the crossing, palisade cut on its flanks',()=>{
  reset([mainRoad('r',{x:100,y:94},{x:100,y:106})]);
  const done=commit('palisade',2,{x:96,y:100},{x:104,y:100});
  assert.equal(done?.gates,1,'one gate reported');
  const [g]=gates();
  assert.ok(g&&g.material==='wood','wood gate');
  assert.ok(Math.hypot(g.x-100,g.y-100)<1e-6,'centred on the crossing');
  assert.ok(Math.abs(Math.cos(g.angle))<1e-6,'passage across the palisade, along the road');
  assert.ok(run('roadUsesGatePassage')(run('State').structures[0],g),'the road runs through the passage');
  const p=walls('palisade');
  assert.equal(p.length,2,'two palisade pieces');
  assert.ok(p.some(w=>w.bSnap===g.id)&&p.some(w=>w.aSnap===g.id),'both pieces seated on the gate');
  for(const w of p)assert.ok(run('window.ConquerPlacement').check(w).ok,'pieces clear the road');
});
check('stone wall W1 -> small gate, W2-W3 -> large gate, brick carried over',()=>{
  for(const [tier,size] of [[1,1],[2,1.5],[3,1.5]]){
    reset([mainRoad('r',{x:100,y:94},{x:100,y:106})]);
    assert.ok(commit('wall',tier,{x:95,y:100},{x:105,y:100},'brick'),'W'+tier+' placed');
    const [g]=gates();
    assert.equal(g.material,'stone');assert.equal(g.size,size,'W'+tier+' gate size');
    assert.equal(g.masonryMaterial,'brick','gate in the wall masonry');
    assert.ok(run('structureLevel')(g)<=(size<1.25?2:3),'level within the gate type cap');
    assert.equal(walls('wall').length,2);
  }
});
check('an oblique road turns the gate along the road',()=>{
  reset([mainRoad('r',{x:95,y:95},{x:105,y:105})]);
  assert.ok(commit('wall',2,{x:95,y:100},{x:105,y:100}));
  const [g]=gates(),road=run('State').structures.find(s=>s.id==='r');
  assert.ok(g&&run('roadUsesGatePassage')(road,g),'passage follows the 45° road');
  for(const w of walls('wall'))assert.ok(run('window.ConquerPlacement').check(w).ok,'pieces clear the road');
});
check('secondary roads and walls that miss the road get no gate',()=>{
  reset([{id:'s',type:'road',roadClass:'reactive',width:.3,a:{x:100,y:94},b:{x:100,y:106}}]);
  commit('wall',2,{x:95,y:100},{x:105,y:100});
  assert.equal(gates().length,0,'not a main road');
  reset([mainRoad('r',{x:100,y:94},{x:100,y:106})]);
  assert.ok(commit('wall',2,{x:95,y:100},{x:99,y:100}));
  assert.equal(gates().length,0,'wall stops short of the road');
});
check('an auto main road through the new gate is not cut by the wall pieces',()=>{
  reset([mainRoad('r',{x:100,y:94},{x:100,y:106},{manualMain:false,auto:true,roadClass:'arterial',routeId:'arterial-n'})]);
  assert.ok(commit('wall',3,{x:95,y:100},{x:105,y:100}));
  assert.ok(run('State').structures.some(s=>s.id==='r'),'arterial segment kept, not rerouted');
});
check('a wall reaching an existing gate on the road adds no second gate',()=>{
  reset([mainRoad('r',{x:100,y:94},{x:100,y:106}),{id:'g0',type:'gate',shape:'square',material:'stone',size:1.5,level:1,x:100,y:100,angle:Math.PI/2,functions:[]}]);
  commit('wall',2,{x:95,y:100},{x:100,y:100});
  assert.equal(gates().length,1,'existing gate reused');
});
console.log('wall road gate regression: '+passed+' checks');
`);
