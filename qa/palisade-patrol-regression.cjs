'use strict';
// W2 palisades carry a walkway (camminamento) behind the stakes: like T2+ stone walls they are part of
// the wall-walk network, so a ring of them is a patrol ring (MIL-WALL-01) and its men walk at the
// walkway's height. The walk lane is off the centre line, so where two palisades meet end to end
// (a corner with no tower) the lanes are mitred to meet: the ring must not break at its corners.
// Uses the real palisade geometry (palisadeLayout / palisadePatrolSurface).
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const root=__dirname+'/../';
const src=name=>fs.readFileSync(root+'src/'+name,'utf8');
let passed=0;
function check(name,body){body();passed++;console.log('PASS '+name)}

// A top-level function of a classic script, by name (one-liner or block closed by "\n}").
function fn(text,name){
  const one=text.match(new RegExp('^function '+name+'\\(.*\\}$','m'));if(one)return one[0];
  const m=text.match(new RegExp('^function '+name+'\\([^)]*\\)\\{[\\s\\S]*?\\n\\}','m'));
  assert.ok(m,name+' found');return m[0];
}
function world({enlisted=10}={}){
  const ctx={Math,Number,Object,Array,Set,Map,String,JSON,console,isFinite,now:0};
  ctx.performance={now:()=>ctx.now};
  ctx.window=ctx;
  ctx.State={village:{founded:true},clock:{day:10},structures:[]};
  vm.createContext(ctx);
  vm.runInContext(src('settlement-util.js'),ctx);
  const core=src('settlement-core.js'),cs=src('settlement-castle-structures.js');
  vm.runInContext([
    'const WALL_TIERS='+core.match(/const WALL_TIERS=([^;]+);/)[1]+';',
    core.match(/const WOOD_TOWER_STYLES=[^;]+;/)[0],
    'function clamp(v,a,b){return Math.max(a,Math.min(b,v))}',
    ...['wallTier','wallWidthForTier','isWoodTower','woodTowerStyle'].map(n=>fn(core,n)),
    ...['palisadeSnapTarget','palisadePassThroughTarget','palisadeLayout','palisadePatrolSurface','wallExteriorSide'].map(n=>fn(cs,n)),
    'function structureHeight(s){return s.type==="palisade"?1.15:[1.15,2.10][(s.level||1)-1]}',
    'function underConstruction(s){return !!s.building}',
    'function terrainElevation(){return 0}',
    'function pointRadius(s){return .75}',
    'function structureInteriorVector(){return {x:1,y:0}}',
  ].join('\n'),ctx);
  ctx.peasantHash=s=>ctx.ConquerUtil.hash(String(s));
  ctx.status=t=>{ctx.lastStatus=t};
  const siege={stock:{horses:0},soldiers:{enlisted,paid:true,expedition:0}};
  ctx.ConquerSiege={state:()=>siege,capacity:()=>({soldiers:40}),archerSlots:()=>[]};
  ctx.ConquerCombat={units:()=>[],enemy:()=>[],areaState:()=>({allowed:true}),alarmMode:()=>'off',setAlarmMode:()=>true,withdrawPatrols:()=>0};
  for(const f of ['settlement-wallwalk.js','settlement-soldiers.js','settlement-wall-patrols.js'])vm.runInContext(src(f),ctx);
  return{ctx,W:ctx.ConquerWallPatrols,WW:ctx.ConquerWallWalk};
}
const C=[[0,0],[20,0],[20,20],[0,20]];
const palisade=(ctx,id,a,b,tier=2,o={})=>({id,type:'palisade',a,b,tier,width:vm.runInContext('wallWidthForTier('+tier+')',ctx),...o});
const woodTower=(id,x,y,woodStyle='palisadeTower')=>({id,type:'tower',material:'wood',woodStyle,x,y,size:woodStyle==='watchtower'?1:1.5});

check('a ring of W2 palisades meeting end to end at its corners is one closed patrol ring',()=>{
  const {ctx,W,WW}=world();
  ctx.State.structures=C.map((p,i)=>palisade(ctx,'p'+i,{x:p[0],y:p[1]},{x:C[(i+1)%4][0],y:C[(i+1)%4][1]}));
  const rings=W.rings();
  assert.equal(rings.length,1,'the four corners join: one ring, not four stretches');
  assert.ok(rings[0].closed,'closed ring');
  assert.equal(rings[0].walls.length,4);
  const surf=vm.runInContext('palisadePatrolSurface(State.structures[0])',ctx);
  assert.ok(Math.abs(surf.offset)>.05,'the W2 walkway is behind the stakes, off the centre line');
  for(const e of WW.graph().edges){
    assert.equal(e.z,surf.z,'the walk is at the walkway height');
    // Lane parallel to the stakes at the walkway offset.
    const s=e.wall,L=Math.hypot(s.b.x-s.a.x,s.b.y-s.a.y),nx=-(s.b.y-s.a.y)/L,ny=(s.b.x-s.a.x)/L;
    const mid={x:(e.a.x+e.b.x)/2,y:(e.a.y+e.b.y)/2},raw={x:(s.a.x+s.b.x)/2,y:(s.a.y+s.b.y)/2};
    assert.ok(Math.abs((mid.x-raw.x)*nx+(mid.y-raw.y)*ny-surf.offset)<1e-9,'on the walkway, behind the stakes');
  }
  assert.ok(W.set(rings[0].id,1),'a patrol assigned');
  const c=W.circuit(rings[0]);
  const side=WW.graph().edges[0].len;
  assert.ok(Math.abs(side-(20-2*Math.abs(surf.offset)))<1e-9||Math.abs(side-(20+2*Math.abs(surf.offset)))<1e-9,'mitred corner to corner');
  assert.ok(Math.abs(c.total-4*side)<1e-6,'once round the walkway, no gaps at the corners');
  let seen=0;
  for(let day=0;day<8;day+=.07)for(const p of W.positions(day)){
    seen++;
    assert.equal(p.z,surf.z,'the guards stand on the walkway');
    assert.ok(WW.locate(p,.01),'on the wall walk');
  }
  assert.ok(seen>100,'the patrol is on the walls all round');
});

check('W2 palisades through wood towers, watchtowers and a wood gate: one ring at walkway height',()=>{
  const {ctx,W,WW}=world();
  const T=[woodTower('T0',0,0),woodTower('T1',20,0,'watchtower'),woodTower('T2',20,20),
    {id:'G',type:'gate',material:'wood',x:0,y:20,angle:Math.PI,size:1.5}];
  const S=[...T];
  for(let i=0;i<4;i++){
    const A=T[i],B=T[(i+1)%4],dx=Math.sign(B.x-A.x),dy=Math.sign(B.y-A.y);
    const ra=A.woodStyle==='watchtower'?0:.75,rb=B.woodStyle==='watchtower'?0:.75;
    // Each side in two palisades joined in line.
    const a={x:A.x+dx*ra,y:A.y+dy*ra},b={x:B.x-dx*rb,y:B.y-dy*rb},m={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
    S.push(palisade(ctx,'p'+i+'a',a,m,2,{aSnap:A.id}),palisade(ctx,'p'+i+'b',m,b,2,{bSnap:B.id}));
  }
  ctx.State.structures=S;
  const rings=W.rings();
  assert.equal(rings.length,1);assert.ok(rings[0].closed);assert.equal(rings[0].walls.length,8);
  assert.equal(WW.stairs(rings[0].comp).length,4,'every tower and the gate is a way up');
  assert.ok(W.set(rings[0].id,2));
  const z=vm.runInContext('palisadePatrolSurface(State.structures[4]).z',ctx);
  let seen=0;
  for(let day=0;day<8;day+=.09)for(const p of W.positions(day)){
    seen++;assert.equal(p.z,z,'walkway height');
    for(const h of T)assert.ok(Math.hypot(p.x-h.x,p.y-h.y)>=.5,'not drawn inside a tower or the gate');
  }
  assert.ok(seen>100);
});

check('W1 palisades (stakes only) carry no walk; stone wall rings keep their centre-line lanes',()=>{
  const {ctx,W,WW}=world();
  ctx.State.structures=C.map((p,i)=>palisade(ctx,'p'+i,{x:p[0],y:p[1]},{x:C[(i+1)%4][0],y:C[(i+1)%4][1]},1));
  assert.equal(W.rings().length,0,'no walkway on a W1 palisade');
  ctx.State.structures=C.map((p,i)=>({id:'w'+i,type:'wall',tier:2,width:.5,level:1,a:{x:p[0],y:p[1]},b:{x:C[(i+1)%4][0],y:C[(i+1)%4][1]}}));
  WW.invalidate();
  assert.equal(W.rings().length,1);
  for(const e of WW.graph().edges)assert.deepEqual([e.a,e.b],[e.wall.a,e.wall.b],'stone lanes unchanged');
});
console.log('palisade patrol regression: '+passed+' checks');
