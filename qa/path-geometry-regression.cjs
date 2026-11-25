'use strict';
// Characterization of the existing three path consumers before sharing geometry.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const close=(a,b,message='coordinate')=>assert.ok(Math.abs(a-b)<1e-12,`${message}: ${a} != ${b}`);
const point=(actual,x,y)=>{close(actual.x,x);close(actual.y,y)};
function world(){
  const nodes=new Map(),element=()=>({hidden:true,textContent:'',innerHTML:'',dataset:{},style:{},addEventListener(){},appendChild(){}});
  const el=id=>{if(!nodes.has(id))nodes.set(id,element());return nodes.get(id)};
  const State={clock:{day:0},view:{scale:1},seed:1,tool:{kind:'select'},
    village:{founded:true,wellId:'well',roadPlan:[{id:'east',edge:'east',target:{x:3,y:4},connected:true}]},
    structures:[{id:'well',type:'well',x:0,y:0},
      {id:'r0',type:'road',routeId:'east',routeSeq:0,a:{x:0,y:0},b:{x:3,y:0}},
      {id:'r1',type:'road',routeId:'east',routeSeq:1,a:{x:3,y:0},b:{x:3,y:4}}]};
  const window={ConquerConvoys:{state:()=>({lordConvoys:{}})}};
  const ctx=vm.createContext({window,State,document:{getElementById:el,createElement:element},wrap:element(),
    dist:(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),underConstruction:()=>false,
    terrainElevation:()=>0,pointBlockedForPeasant:()=>false,
    w2s:p=>p,w2sRaw:p=>p,WORLD:200,console});
  if(fs.existsSync(path.join(root,'src/settlement-path.js')))vm.runInContext(read('src/settlement-path.js'),ctx);
  for(const file of ['settlement-vehicles.js','settlement-diplomacy.js','settlement-road-sign-tests.js'])
    vm.runInContext(read('src/'+file),ctx,{filename:file});
  return{window,State,V:window.ConquerVehicles,D:window.ConquerDiplomacy,R:window.ConquerRoadSignTests};
}
const {V,D,R}=world();
const road=[{x:0,y:0},{x:3,y:0},{x:3,y:4},{x:0,y:4},{x:0,y:4}];
const measured=V.makePath(road);
assert.equal(measured.total,10);assert.deepEqual([...measured.cum],[0,3,7,10,10]);
for(const [distance,x,y] of [[-1,0,0],[0,0,0],[3,3,0],[5,3,2],[7,3,4],[10,0,4],[11,0,4]])point(V.at(measured,distance),x,y);
close(V.headingAt(measured,3),Math.PI/4,'wagon averages the right-angle corner');
close(V.headingAt(measured,7),3*Math.PI/4,'wagon averages the second corner');
const repeated=V.makePath([{x:2,y:3},{x:2,y:3},{x:5,y:3},{x:5,y:3}]);
point(V.at(repeated,0),2,3);point(V.at(repeated,3),5,3);close(V.headingAt(repeated,0),0);
const cusp=V.makePath([{x:0,y:0},{x:3,y:0},{x:0,y:0}]);
point(V.at(cusp,3),3,0);close(V.headingAt(cusp,3),0,'symmetric wagon cusp has zero look-around vector');
point(V.at(V.makePath([{x:6,y:7}]),100),6,7);
console.log('PASS vehicle characterization: cumulative length, clamps, coincident points, corners and cusp smoothing');

const courier={route:road,phase:'arriving',spawnDay:0,arrivalDay:10};
for(const [at,x,y,heading] of [[-1,0,0,0],[0,0,0,0],[3,3,0,0],[5,3,2,Math.PI/2],[7,3,4,Math.PI/2],[10,0,4,Math.PI],[11,0,4,Math.PI]]){
  const p=D.courierPose(courier,at);point(p,x,y);close(p.heading,heading,'courier keeps the incoming segment at a vertex');
}
const returning={...courier,phase:'returning',departDay:10,returnDay:20};
for(const [at,x,y,h] of [[10,0,4,2*Math.PI],[15,3,2,3*Math.PI/2],[20,0,0,Math.PI]]){
  const p=D.courierPose(returning,at);point(p,x,y);close(p.heading,h,'returning courier reverses heading');
}
point(D.courierPose({...courier,route:[{x:1,y:2}]},3),1,2);
const tiny=D.courierPose({...courier,route:[{x:0,y:0},{x:.00001,y:0}]},10);
point(tiny,.000001,0); // Historical minimum interpolation span of the courier is 0.0001 U.
console.log('PASS courier characterization: incoming heading, return leg, one point and tiny-span policy');

const sign=R.signs()[0];point(sign.roadPoint,3,1.4);
const route=R.routeFor('east');point(route.points[0],3,.5);point(route.points.at(-1),3,4);close(route.distance,3.5);
const convoy={edge:'east',status:'outbound',drivePath:road,actualDepartDay:0,arrivalDay:10,returnDay:20};
const out=R.liveConvoyLeg(convoy,1);close(out.distance,5);point(V.at(V.makePath(out.path),out.distance),3,2);
const back=R.liveConvoyLeg({...convoy,status:'returning'},19);
point(V.at(V.makePath(back.path),back.distance),3,2);
close(V.layout({vehicle:'wagon',distance:back.distance},back.path).vehicles[0].heading,-Math.PI/2);
assert.equal(R.liveConvoyLeg(convoy,3),null,'convoy beyond the map is not drawn');
point(V.at(V.makePath(R.liveConvoyLeg({...convoy,status:'returning'},18).path),0),0,4);
assert.equal(road[0].x,0);assert.equal(road.at(-1).y,4,'reversing a convoy must not mutate its saved route');
console.log('PASS road-sign characterization: positions, route slicing, return orientation and off-map legs');
