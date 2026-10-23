'use strict';
const assert=require('node:assert/strict');
const {createEngine,normalizeDomain,SCHEMA_VERSION}=require('../src/settlement-cans.js');
let count=0;
const check=(name,fn)=>{fn();count++;console.log('PASS CANS '+name)};
const domain=(id='chapel')=>({
  id,type:'church',parentId:'church-1',
  access:[{id:'west',nodeId:'w'},{id:'east',nodeId:'e'}],
  slots:[
    {id:'bench1',role:'guest',nodeId:'a',position:{x:1,y:0},actions:['pray']},
    {id:'bench2',role:'guest',nodeId:'b',position:{x:2,y:0}},
    {id:'altar',role:'worker',nodeId:'b'}
  ],
  graph:{nodes:[{id:'w',x:0,y:0},{id:'a',x:1,y:0},
    {id:'b',x:2,y:0},{id:'e',x:3,y:0}],
    edges:[{from:'w',to:'a'},{from:'a',to:'b'},{from:'b',to:'e'}]}
});
const progress=(engine,id,token)=>{
  for(const phase of ['approaching','entering','traversing','active'])engine.advance(id,token,phase);
};
check('validates IDs, slot roles and graph topology',()=>{
  assert.equal(SCHEMA_VERSION,1);
  const x=domain();x.slots[0].id='bench2';
  assert.throws(()=>normalizeDomain(x),/duplicate slot/);
  const y=domain();y.slots[0].role='horse';
  assert.throws(()=>normalizeDomain(y),/unsupported slot role/);
  const z=domain();z.graph.edges[0].to='missing';
  assert.throws(()=>normalizeDomain(z),/graph references/);
});
check('finds shortest accessible entrance and never crosses disconnected edges',()=>{
  const e=createEngine({clock:()=>100});
  e.addDomain(domain());
  assert.equal(e.route('chapel','bench1').accessId,'west');
  assert.equal(e.route('chapel','bench2').accessId,'east');
  assert.equal(e.route('chapel','bench1',a=>a.id==='west'?Infinity:0).accessId,'east');
  const cut=domain('cut');cut.graph.edges=[];e.addDomain(cut);
  assert.equal(e.route('cut','bench1'),null);
  assert.equal(e.choose('cut',{role:'guest'}),null);
  assert.throws(()=>e.reserve('p','cut','bench1'),/unavailable/);
});
check('reservation is exclusive and an entity cannot have two assignments',()=>{
  let tick=100;const e=createEngine({clock:()=>tick});e.addDomain(domain());
  const r=e.reserve('resident-1','chapel','bench1');
  assert.equal(e.occupancy('chapel','bench1').state,'reserved');
  assert.throws(()=>e.reserve('resident-2','chapel','bench1'),/unavailable/);
  assert.throws(()=>e.reserve('resident-1','chapel','bench2'),/already assigned/);
  assert.throws(()=>e.advance('resident-1',r.token,'active'),/transition/);
  progress(e,'resident-1',r.token);
  assert.equal(e.occupancy('chapel','bench1').state,'occupied');
  tick=100000;assert.equal(e.expire(),0); // an active citizen is not evicted by reservation TTL
  assert.equal(e.occupancy('chapel','bench1').entityId,'resident-1');
  assert.equal(e.cancel('resident-1'),true);
  assert.equal(e.occupancy('chapel','bench1').state,'available');
});
check('unreached reservations expire but not other occupants',()=>{
  let tick=100;const e=createEngine({clock:()=>tick});e.addDomain(domain());
  const a=e.reserve('a','chapel','bench1',{ttl:5});
  e.reserve('b','chapel','bench2',{ttl:6});
  tick=106;assert.equal(e.expire(),2);
  assert.equal(e.getAssignment('a'),null);
  assert.equal(e.getAssignment('b'),null);
  assert.throws(()=>e.advance('a',a.token,'approaching'),/token/);
});
check('transfer reserves destination before releasing current slot',()=>{
  const e=createEngine({clock:()=>100});e.addDomain(domain());
  const a=e.reserve('alice','chapel','bench1');progress(e,'alice',a.token);
  const b=e.startTransfer('alice','chapel','bench2');
  assert.equal(e.occupancy('chapel','bench1').state,'occupied');
  assert.equal(e.occupancy('chapel','bench2').state,'reserved');
  assert.throws(()=>e.reserve('bob','chapel','bench2'),/unavailable/);
  assert.throws(()=>e.completeTransfer('alice',b.token),/not traversed/);
  for(const phase of ['approaching','entering','traversing'])
    e.advanceTransfer('alice',b.token,phase);
  e.completeTransfer('alice',b.token);
  assert.equal(e.occupancy('chapel','bench1').state,'available');
  assert.equal(e.occupancy('chapel','bench2').state,'occupied');
  assert.equal(e.getAssignment('alice').pending,null);
});
check('layout update preserves stable occupants, cancels removed or blocked slots',()=>{
  const e=createEngine({clock:()=>100});e.addDomain(domain());
  const r=e.reserve('a','chapel','bench1');progress(e,'a',r.token);
  const r2=e.reserve('b','chapel','bench2');progress(e,'b',r2.token);
  const next=domain();next.slots=next.slots.filter(s=>s.id!=='bench2');
  const change=e.updateDomain(next);
  assert.equal(change.released,1);
  assert.ok(change.domain.layoutRevision>0);
  assert.equal(e.getAssignment('b'),null);
  assert.equal(e.occupancy('chapel','bench1').entityId,'a');
  const last=domain();last.slots[0].blocked=true;
  e.updateDomain(last);
  assert.equal(e.occupancy('chapel','bench1').state,'suspended');
  assert.equal(e.getAssignment('a'),null);
});
check('save and restore keep identity, reject invalid entities and expired reservations',()=>{
  let tick=100;
  const e=createEngine({clock:()=>tick});e.addDomain(domain());
  const r=e.reserve('alice','chapel','bench1');progress(e,'alice',r.token);
  e.reserve('ghost','chapel','bench2',{ttl:10});
  const saved=JSON.parse(JSON.stringify(e.serialize()));
  const restored=createEngine({clock:()=>115});
  const stat=restored.restore(saved,{entityExists:id=>id!=='ghost',parentExists:id=>id==='church-1'});
  assert.equal(stat.assignments,1);
  assert.equal(stat.discarded,1);
  assert.equal(restored.getAssignment('alice').phase,'active');
  assert.equal(restored.occupancy('chapel','bench2').state,'available');
  assert.deepEqual(restored.serialize().domains,saved.domains);
  assert.throws(()=>restored.restore({schemaVersion:999}),/unsupported/);
  assert.equal(restored.getAssignment('alice').phase,'active'); // failed restore atomic
  assert.deepEqual(restored.restore(null),{domains:0,assignments:0,discarded:0});
  assert.equal(restored.getAssignment('alice').phase,'active'); // old saves do not reset system
});
check('mobile domain transform does not modify local slots or route graph',()=>{
  const e=createEngine();const d=domain('vessel');
  d.carrierId='ship-1';d.transform={x:10,y:20,rotation:Math.PI/2};
  e.addDomain(d);
  const pt=e.worldPoint('vessel',{x:2,y:0});
  assert.ok(Math.abs(pt.x-10)<1e-10);
  assert.ok(Math.abs(pt.y-22)<1e-10);
  assert.equal(e.getDomain('vessel').slots[0].position.x,1);
  assert.equal(e.route('vessel','bench1').path.join(','),'w,a');
});
check('first compatible, reachable slot retains existing seat assignments',()=>{
  const e=createEngine({clock:()=>100});e.addDomain(domain());
  const a=e.choose('chapel',{role:'guest'});
  assert.equal(a.slotId,'bench1');
  e.reserve('alice','chapel',a.slotId);
  const b=e.choose('chapel',{role:'guest'});
  assert.equal(b.slotId,'bench2');
  e.reserve('bob','chapel',b.slotId);
  e.cancel('alice');
  assert.equal(e.getAssignment('bob').slotId,'bench2');
  assert.equal(e.choose('chapel',{role:'guest'}).slotId,'bench1');
});
console.log('CANS tests passed:',count);
