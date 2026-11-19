'use strict';
// WALL-ROAD-GATE: a wall or palisade drawn across a main road gets a gate of the matching type on
// the crossing (palisade -> wood gate, stone/brick W1 -> small gate, W2-W3 -> large gate), the
// wall is cut on the gate flanks and the road keeps running through the passage.
const fs=require('node:fs');
const harness=fs.readFileSync(__dirname+'/urban-regression.cjs','utf8').split('let passed=0;')[0];
eval(harness+`
run(fs.readFileSync(__dirname+'/../src/settlement-placement.js','utf8'));
run(fs.readFileSync(__dirname+'/../src/settlement-crossings.js','utf8'));
let passed=0;
function check(name,body){body();passed++;console.log('PASS '+name)}
const reset=(roads)=>run('State').structures=roads;
const mainRoad=(id,a,b,extra={})=>({id,type:'road',manualMain:true,roadClass:'arterial-manual',width:.62,a,b,...extra});
const commit=(type,tier,a,b,masonry='stone')=>{
  const S=run('State');
  S.tool={kind:'linear',linear:type,tier,label:type};S.buildLevels={...(S.buildLevels||{}),wall:1,wallTier:tier,gate:2};
  S.buildMasonryMaterial=masonry;S.draft={a};
  const seg=run('freeLinearSegment')(a,b);
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
check('a free-angle wall (off the 15° lattice) across the road still gets its gate',()=>{
  reset([mainRoad('r',{x:100,y:94},{x:100,y:106})]);
  const a={x:95,y:98.2},b={x:105,y:101.8};   // ~19.8°, WALL-FREE-ANGLE
  assert.equal(commit('wall',2,a,b)?.gates,1,'one gate reported');
  const [g]=gates(),road=run('State').structures.find(s=>s.id==='r');
  assert.ok(g&&run('roadUsesGatePassage')(road,g),'road runs through the passage');
  const w=walls('wall');
  assert.equal(w.length,2,'two wall pieces');
  assert.ok(w.some(s=>s.bSnap===g.id)&&w.some(s=>s.aSnap===g.id),'both pieces seated on the gate');
  for(const s of w)assert.ok(run('window.ConquerPlacement').check(s).ok,'pieces clear the road');
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
// ROAD-WALL-GATE: the reverse. A main road drawn across an existing finished wall opens a gate
// of the matching type in it, cuts the wall on the gate flanks and runs through the passage.
const built=(id,type,tier,a,b,extra={})=>({id,type,tier,width:run('wallWidthForTier')(tier),level:1,functions:[],a,b,length:Math.hypot(b.x-a.x,b.y-a.y),...extra});
const road=(a,b)=>run('addMainRoadThroughWalls')([{a,b}]);
const same=(actual,expected,msg)=>assert.equal(JSON.stringify(actual),JSON.stringify(expected),msg);   // VM-realm objects
check('main road across a finished wall, palisade: gate of the matching type, wall cut on its flanks',()=>{
  for(const [type,tier,material,size,masonry] of [['wall',1,'stone',1,'brick'],['wall',3,'stone',1.5,'stone'],['palisade',2,'wood',1.5,null]]){
    reset([built('w',type,tier,{x:95,y:100},{x:105,y:100},masonry?{masonryMaterial:masonry}:{})]);
    same(road({x:100,y:94},{x:100,y:106}),{gates:1,drawbridges:0},type+' T'+tier+': one gate opened');
    const [g]=gates(),r=run('State').structures.find(s=>s.type==='road');
    assert.ok(g&&g.material===material&&g.size===size,type+' T'+tier+' gate type');
    if(masonry)assert.equal(g.masonryMaterial,masonry,'gate in the wall masonry');
    assert.ok(Math.hypot(g.x-100,g.y-100)<1e-6,'centred on the crossing');
    assert.ok(r&&run('roadUsesGatePassage')(r,g),'road built through the passage');
    const p=walls(type);
    assert.equal(p.length,2,'two pieces');
    assert.ok(p.some(w=>w.id==='w'&&w.bSnap===g.id)&&p.some(w=>w.aSnap===g.id),'the wall keeps its id, both pieces seated on the gate');
    for(const w of p)assert.ok(!w.construction,'the cut wall stays finished');
  }
});
check('a road across a wall still under construction is refused; a road through an existing gate adds none',()=>{
  reset([built('w','wall',2,{x:95,y:100},{x:105,y:100},{construction:{version:2,progress:.2}})]);
  assert.equal(road({x:100,y:94},{x:100,y:106}),false,'refused');
  assert.equal(gates().length,0);assert.equal(run('State').structures.filter(s=>s.type==='road').length,0,'no road');
  reset([{id:'g0',type:'gate',shape:'square',material:'stone',size:1.5,level:1,x:100,y:100,angle:Math.PI/2,functions:[]},
    built('w1','wall',2,{x:95,y:100},{x:99.25,y:100},{bSnap:'g0'}),built('w2','wall',2,{x:100.75,y:100},{x:105,y:100},{aSnap:'g0'})]);
  same(road({x:100,y:94},{x:100,y:106}),{gates:0,drawbridges:0},'no new gate');
  assert.equal(gates().length,1);
});
// ROAD-MOAT-DRAWBRIDGE: across the wall and the moat in front of it, the new gate comes with its
// drawbridge already installed (cost in the gate site); an existing gate gets the missing one.
const moat=(id,y,extra={})=>({id,type:'moat',variant:'dry',a:{x:95,y},b:{x:105,y},width:1.5,length:10,groundZ:0,fills:[],...extra});
const DB=()=>run('window.ConquerCrossings.DRAWBRIDGE_COST');
check('main road across a wall and its moat: gate with the drawbridge installed, road over the leaf',()=>{
  for(const [type,tier,w] of [['wall',3,1],['wall',1,.2],['palisade',2,.5]]){
    for(const site of [false,true]){
      reset([built('w',type,tier,{x:95,y:100},{x:105,y:100}),moat('m',100+w/2+.75,site?{construction:{version:2,progress:.1}}:{})]);
      same(road({x:100,y:94},{x:100,y:106}),{gates:1,drawbridges:1},type+' T'+tier+(site?' (moat being dug)':'')+': gate + drawbridge');
      const [g]=gates(),r=run('State').structures.find(s=>s.type==='road');
      assert.ok(g.drawbridge?.installed&&g.drawbridge.withGate&&!g.drawbridge.raised,'drawbridge installed, lowered');
      assert.ok(Math.sin(g.angle)>.99,'gate front (and leaf) towards the moat');
      const bare=run('constructionCost')({...g,drawbridge:undefined}),cost=run('constructionCost')(g);
      for(const [k,v] of Object.entries(DB()))assert.equal(cost[k]||0,(bare[k]||0)+v,'drawbridge '+k+' in the gate site');
      assert.equal(run('window.ConquerCrossings').deck(g,true).ahead?.moat.id,'m','leaf spans the moat');
      assert.ok(r&&!run('manualRoadConflict')(r,run('State').structures.find(s=>s.id==='m')),'road crosses the moat on the leaf');
    }
  }
});
check('a road through an existing gate across its moat installs the missing drawbridge',()=>{
  reset([{id:'g0',type:'gate',shape:'square',material:'stone',size:1.5,level:1,x:100,y:100,angle:Math.PI/2,functions:[]},
    built('w1','wall',2,{x:95,y:100},{x:99.25,y:100},{bSnap:'g0'}),built('w2','wall',2,{x:100.75,y:100},{x:105,y:100},{aSnap:'g0'}),moat('m',101)]);
  same(road({x:100,y:94},{x:100,y:106}),{gates:0,drawbridges:1});
  const g=gates()[0];
  assert.ok(g.drawbridge?.installed&&!g.drawbridge.withGate,'installed as an upgrade of the gate');
  assert.equal(run('State').structures.filter(s=>s.type==='road').length,1,'road built');
});
check('a road across a moat with no gate is still blocked',()=>{
  reset([moat('m',101)]);
  assert.equal(road({x:100,y:94},{x:100,y:106}),false);
});
// ROAD-MAGNET-ROAD: road ends and sides of every road (also secondary, automatic) attract the main road.
check('road magnet: a road end wins over the side, the side snaps square from further away',()=>{
  reset([{id:'s',type:'road',roadClass:'reactive',auto:true,width:.3,a:{x:100,y:100},b:{x:110,y:100}}]);
  const snap=p=>run('mainRoadSnapAnchor')(p);
  let s=snap({x:109.3,y:100.5});
  same([s.point,s.roadSnap],[{x:110,y:100},{roadId:'s',end:'b'}],'end');
  s=snap({x:105,y:101.4});
  same([s.point,s.roadSnap],[{x:105,y:100},{roadId:'s',end:null}],'side, 1.4 U away');
  assert.ok(!snap({x:105,y:103}).roadSnap,'out of reach');
});
console.log('wall road gate regression: '+passed+' checks');
`);
