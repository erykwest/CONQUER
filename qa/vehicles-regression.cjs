'use strict';
// Automated vehicles: carts, wagons and coaches route themselves over the real road
// network, ease in, slow for bends, stop at the end, keep convoy spacing and draw
// only in 2D: main's modular wagon with the approved 2D horse team.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
function harness(structures){
  const State={structures,clock:{day:3},view:{scale:2,rotation:0,x:0,y:0}};
  const window={},calls={meshes:0,sprites:0,wagon2d:0};
  const c=vm.createContext({window,State,Math,Number,Array,Object,Map,WeakMap,Set,Float32Array,String,
    terrainElevation:()=>0,underConstruction:()=>false,U:12,
    w2s:(p,z=0)=>({x:p.x*5,y:p.y*5-z*5}),w2sRaw:(p,z=0)=>({x:p.x*5,y:p.y*5-z*5}),
    rotateViewPoint:p=>p,ISO_Z:.9,isPlanView:()=>false,
    drawSoldierFigure:()=>{calls.sprites++},drawVillagerFigureUnmasked:()=>{calls.sprites++},
    withProjectionGroundZ:(z,f)=>f(),
    ctx:{save(){},restore(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){},stroke(){}}});
  vm.runInContext(read('src/settlement-vehicles.js'),c,{filename:'settlement-vehicles.js'});
  window.ConquerWagons={drawWagon:(g,x,y,size,o)=>{calls.wagon2d++;calls.last={size,...o}}};
  return{V:window.ConquerVehicles,State,calls,window};
}
const road=(id,a,b)=>({id,type:'road',a,b,width:.62});
// A T junction: west-east street, a branch north at x=10, and a dead end south.
const NET=[road('r1',{x:0,y:0},{x:10,y:0}),road('r2',{x:10,y:0},{x:30,y:0}),
  road('r3',{x:10,y:0},{x:10,y:-20}),road('r4',{x:20,y:0},{x:20,y:12})];
const len=pts=>pts.slice(1).reduce((s,p,i)=>s+Math.hypot(p.x-pts[i].x,p.y-pts[i].y),0);
const test=(name,fn)=>{fn();console.log('PASS '+name)};

test('routes over the road graph through the junction, snapped to the roads',()=>{
  const {V}=harness(NET);
  const r=V.route({x:1,y:.6},{x:10.4,y:-19});
  assert.ok(r,'connected points have a route');
  assert.ok(Math.abs(r[0].y)<1e-9&&Math.abs(r[0].x-1)<1e-9,'starts snapped on the street');
  assert.ok(r.some(p=>Math.hypot(p.x-10,p.y)<1e-6),'turns at the junction');
  assert.ok(Math.abs(len(r)-(9+19))<1e-6,'shortest path along the roads');
  const far=V.route({x:1,y:0},{x:20,y:11});
  assert.ok(Math.abs(len(far)-(19+11))<1e-6,'takes the second branch');
  const {V:empty}=harness([]);assert.equal(empty.route({x:0,y:0},{x:1,y:1}),null,'no roads, no route');
});
test('bends are rounded and the smoothed path keeps its ends',()=>{
  const {V}=harness(NET);
  const r=V.route({x:1,y:0},{x:10,y:-19}),s=V.smooth(r);
  assert.deepEqual([s[0],s[s.length-1]],[r[0],r[r.length-1]]);
  assert.ok(s.length>r.length,'corner points added');
  assert.ok(!s.some(p=>Math.hypot(p.x-10,p.y)<1e-6),'the sharp corner is cut');
  assert.ok(len(s)<len(r),'the curve is shorter than the corner');
});
test('motion eases in, slows for bends and stops exactly at the end',()=>{
  const {V}=harness(NET);
  const pts=V.smooth(V.route({x:1,y:0},{x:10,y:-19})),total=V.makePath(pts).total;
  const rec={vehicle:'wagon',distance:0,speed:0},speeds=[];
  let arrived=false;
  for(let i=0;i<400&&!arrived;i++){arrived=V.advance(rec,pts,1/30);speeds.push({s:rec.distance,v:rec.speed})}
  assert.ok(arrived&&Math.abs(rec.distance-total)<1e-6,'reaches the end');
  assert.ok(speeds[0].v<speeds[10].v,'accelerates from standstill');
  const cruise=Math.max(...speeds.map(x=>x.v));
  assert.ok(cruise<=V.KINDS.wagon.speed+1e-9,'never above cruise speed');
  const nearBend=speeds.filter(x=>x.s>7.4&&x.s<9.4).map(x=>x.v);
  assert.ok(Math.min(...nearBend)<cruise*.85,'slows for the right-angle bend');
  assert.ok(speeds[speeds.length-1].v<1.2,'brakes to the stop');
});
test('convoy spacing, waiting vehicles and escorts on the verges',()=>{
  const {V}=harness(NET);
  const pts=V.route({x:0,y:0},{x:30,y:0}),c={id:'c',vehicle:'wagon',vehicles:3,guards:2,distance:9,speed:3};
  let L=V.layout(c,pts);
  assert.equal(L.vehicles.length,3);
  assert.ok(Math.abs(L.vehicles[0].x-L.vehicles[1].x-V.KINDS.wagon.gap)<1e-6,'one gap apart');
  assert.ok(L.escorts.length===2&&Math.abs(L.escorts[0].y+L.escorts[1].y)<1e-6&&Math.abs(L.escorts[0].y)>.4,'escorts on both verges');
  L=V.layout({...c,distance:1},pts);
  assert.equal(L.vehicles.length,1,'later vehicles wait at the start');
});
test('vehicle kinds: cart one horse, wagon two, coach a carriage without cargo',()=>{
  const {V,window}=harness(NET);
  const cart=V.specFor({vehicle:'cart',good:'stone',qty:40},0),wagon=V.specFor({vehicle:'wagon',good:'food',qty:50},0);
  const coach=V.specFor({vehicle:'coach',good:'stone',qty:10},0);
  assert.equal(cart.chassis,'cart');assert.equal(cart.team.length,1);
  assert.equal(wagon.chassis,'wagon');assert.equal(wagon.team.length,2);
  assert.equal(coach.chassis,'carriage');assert.deepEqual([...coach.cargo],[]);
  assert.deepEqual([...wagon.cargo],['sack','sack','sack'],'half a load of food: three sacks');
  assert.equal(V.cargoFor('wood',100,100).length,4,'logs fill four slots');
});
test('2D draw: main wagons with the 2D horse team, drivers and escorts, horse-sized',()=>{
  const h=harness(NET),pts=h.V.route({x:0,y:0},{x:30,y:0});
  const n=h.V.draw({id:'c',vehicle:'wagon',vehicles:2,guards:2,distance:8,speed:3,good:'wood',qty:60},pts);
  assert.equal(n,2);
  assert.equal(h.calls.wagon2d,2,'two 2D wagons');
  assert.equal(h.calls.sprites,2+2,'two drivers and two escorts');
  assert.equal(h.calls.last.team.length,2,'two horses drawn by the 2D wagon');
  assert.equal(h.calls.last.size,h.State.view.scale*5.75,'same size as livestock and knights horses');
  h.V.draw({id:'k',vehicle:'coach',vehicles:1,guards:0,distance:4,speed:3},pts);
  assert.equal(h.calls.last.chassis,'carriage');assert.deepEqual([...h.calls.last.cargo],[]);
});
test('no 3D figures: no Blender meshes for horses or wagons are loaded or referenced',()=>{
  const code=read('src/settlement-vehicles.js'),html=read('index.html');
  assert.doesNotMatch(code,/ConquerWagons3D|ConquerAnimals3D|ConquerWagonModel|ConquerAnimalModels|worldTriangles/);
  assert.match(html,/settlement-vehicles\.js/);
  assert.ok(html.indexOf('settlement-wagons.js')<html.indexOf('settlement-vehicles.js'));
  assert.ok(html.indexOf('settlement-vehicles.js')<html.indexOf('settlement-road-sign-tests.js'));
  // The game page never loads 3D horse meshes for vehicles (D-046).
  assert.doesNotMatch(html,/settlement-animals3d\.js|assets\/animal-models\.js/);
});
test('transient coach trips arrive and clear',()=>{
  const h=harness(NET);
  const trip=h.V.spawn({vehicle:'coach',from:{x:0,y:0},to:{x:30,y:0}});
  assert.ok(trip);
  for(let i=0;i<200;i++)h.V.tick(.05);
  assert.equal(h.V.trips().length,0,'arrived trips are removed');
  assert.equal(h.V.spawn({vehicle:'coach',from:{x:0,y:0},to:{x:0,y:0},points:[{x:0,y:0}]}),null);
});
console.log('Vehicles regression: all checks passed.');