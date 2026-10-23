'use strict';
// Work animations: every tool has a periodic pose, crews are out of step, field
// phases map to their tools, workers draw without errors, stroke effects appear
// only after the blow and builders stand on the camera side of a site.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const calls={fill:0,stroke:0,fillRect:0};
const ctx2d=new Proxy({},{get:(o,k)=>k in calls?()=>{calls[k]++}:k in o?o[k]:()=>{},set:(o,k,v)=>{o[k]=v;return true}});
const State={view:{scale:2},clock:{day:3.4},structures:[]};
const window={};
const sandbox={window,State,Math,Number,String,Object,Array,Map,Date,performance:{now:()=>0},
  ctx:ctx2d,VILLAGER_SKIN:'#d99a83',
  w2s:(p,z=0)=>({x:(p.x-p.y)*20,y:(p.x+p.y)*10-z*20}),
  viewDepthPoint:p=>p.x+p.y,
  withUrbanFigureOcclusion:(p,z,fn)=>fn(),
  worldPointVisible:()=>true,
  underConstruction:s=>!!s.construction,
  structureCenter:s=>({x:s.x,y:s.y}),
  urbanBuildingPolygons:s=>[[{x:s.x-1,y:s.y-1},{x:s.x+1,y:s.y-1},{x:s.x+1,y:s.y+1},{x:s.x-1,y:s.y+1}]],
  villagerHair:()=>'brown'};
let bodies=0;
sandbox.drawVillagerFigureUnmasked=()=>{bodies++};
const context=vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname,'..','src','settlement-work-anim.js'),'utf8'),context);
const WA=window.ConquerWorkAnim;

const tools=Object.keys(WA.TOOLS);
assert.deepEqual(tools.sort(),['axe','hammer','hoe','pickaxe','seeds','shovel','sickle']);
for(const tool of tools){
  const T=WA.TOOLS[tool];
  for(const t of [0,.3,.77,1.9]){
    const a=WA.pose(tool,'w1',t),b=WA.pose(tool,'w1',t+T.period);
    for(const k of ['th','lean','bob'])assert.ok(Number.isFinite(a[k]),tool+' '+k+' is finite');
    assert.ok(Math.abs(a.th-b.th)<1e-9&&Math.abs(a.lean-b.lean)<1e-9,tool+' pose repeats every period');
  }
  const swing=[...Array(24)].map((_,i)=>WA.pose(tool,'w1',i*T.period/24).th);
  assert.ok(Math.max(...swing)-Math.min(...swing)>.8,tool+' swings the tool');
  assert.notEqual(WA.pose(tool,'w1',.2).u.toFixed(3),WA.pose(tool,'w2',.2).u.toFixed(3),tool+': a crew is not in step');
}
console.log('PASS seven tools with periodic, out-of-step swings');

assert.deepEqual({...WA.FIELD_TOOL},{plough:'hoe',sow:'seeds',harvest:'sickle'});
console.log('PASS field phases use hoe, seed sack and sickle');

const dot={p:{x:5,y:5},id:'farmer',kind:'peasant',sex:'male',age:'adult',colors:['#8c6b3f','#5d4a32'],hair:'brown'};
for(const tool of tools)for(const f of [1,-1])for(const t of [0,.4,.61,.9]){
  bodies=0;WA.drawWorkerUnmasked(dot,tool,t,f);assert.equal(bodies,1,tool+' draws the villager body once');
}
// Effects only in the moment after the blow.
const T=WA.TOOLS.pickaxe,base=WA.pose('pickaxe','farmer',0).u*T.period;
const at=u=>((u*T.period-base)%T.period+T.period)%T.period;
calls.fillRect=0;WA.drawWorkerUnmasked(dot,'pickaxe',at(T.hit-.2),1);const before=calls.fillRect;
calls.fillRect=0;WA.drawWorkerUnmasked(dot,'pickaxe',at(T.hit+.05),1);const after=calls.fillRect;
assert.ok(after>before,'dust flies after the pickaxe strikes');
State.view.scale=.2;bodies=0;WA.drawWorkerUnmasked(dot,'axe',0,1);assert.equal(bodies,1,'tiny figures fall back to the plain villager');
State.view.scale=2;
console.log('PASS workers draw with every tool, facing both ways, effects after the blow');

// Builders: only on construction sites, only on the camera side, only in working hours.
State.structures=[{id:'t1',type:'tower',x:10,y:10,construction:{}},{id:'h1',type:'house',x:20,y:20}];
const draws=[];
context.withUrbanFigureOcclusion=(p,z,fn)=>{draws.push(p);return fn()};
State.clock.day=3.4;WA.drawBuilders();
assert.ok(draws.length>=1&&draws.length<=3,'a crew works at the site');
assert.ok(draws.every(p=>p.x+p.y>=20-.05),'builders stand on the camera side');
assert.ok(draws.every(p=>Math.hypot(p.x-10,p.y-10)<3),'only the construction site has builders');
draws.length=0;State.clock.day=3.9;WA.drawBuilders();
assert.equal(draws.length,0,'no builders at night');
console.log('PASS builders at construction sites');
