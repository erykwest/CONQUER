'use strict';
// Merchant ships as caravans: a small ship holds three wagons (300 points), a large one nine
// (900); a lord convoy by sea needs a harbour and a sea exit, travels faster than by road, and
// its ships are shown leaving port at the start of the outward leg and coming in at the end
// of the way back, sailing between their berth and the convoy's sea exit.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const commerce=read('src/settlement-commerce.js'),convoys=read('src/settlement-convoys.js');
assert.match(commerce,/shipSmall:Object\.freeze\(\{capacity:300,/,'small ship: 300 points = 3 wagons');
assert.match(commerce,/shipLarge:Object\.freeze\(\{capacity:900,/,'large ship: 900 points = 9 wagons');
assert.match(convoys,/if\(shipVehicle\(vehicle\)&&\(!harbour\(\)\|\|!seaExits\(\)\.length\)\)return false;/,'by sea only with a harbour and a sea exit');
assert.match(convoys,/const speed=shipVehicle\(j\.transport\?\.mode\)\?SEA_UNITS_PER_DAY:UNITS_PER_DAY;/,'faster by sea');
assert.match(convoys,/data-convoy-vehicle/,'the mastio panel offers carts or ships');
console.log('PASS sea convoys: ship vehicles, harbour and sea exit, sea speed, panel');

// A sea to the west (x < 60) and the convoy's exit at the middle of the west edge.
const sea={type:'sea',side:'west',points:[{x:0,y:0},{x:60,y:0},{x:60,y:200},{x:0,y:200}],coastline:[{x:60,y:0},{x:60,y:200}]};
const window={},State={clock:{day:10},structures:[],environment:[sea]};
const lord={};
window.ConquerCommerce={VEHICLES:{wagon:{capacity:100},shipSmall:{capacity:300,ship:true,model:'caravella'},shipLarge:{capacity:900,ship:true,model:'cocca'}},state:()=>({lordConvoys:lord})};
window.ConquerConvoys={availableExits:()=>[{mode:'sea',edge:'west',point:{x:0,y:100}}]};
window.ConquerShips={model:()=>({L:6,B:2}),lower:s=>{s.target=0},raise:s=>{s.target=1}};
const ships=[];let n=0;
const hull=(key,p,pad=0)=>{const c=Math.cos(p.heading||0),s=Math.sin(p.heading||0),hl=3+pad,hb=1+pad;return[[hl,hb],[-hl,hb],[-hl,-hb],[hl,-hb]].map(([x,y])=>({x:p.x+x*c-y*s,y:p.y+x*s+y*c}))};
const overlap=(A,B)=>{for(const poly of [A,B])for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],nx=-(b.y-a.y),ny=b.x-a.x,pa=A.map(p=>p.x*nx+p.y*ny),pb=B.map(p=>p.x*nx+p.y*ny);if(Math.max(...pa)<=Math.min(...pb)||Math.max(...pb)<=Math.min(...pa))return false}return true};
window.ConquerFleet={ships,hull,overlap,spawn:o=>{const s={id:'s'+(++n),...o,pose:{x:56,y:100,heading:Math.PI},crew:{sail:{target:1}}};ships.push(s);return s},remove:id=>{const i=ships.findIndex(s=>s.id===id);ships.splice(i,1)}};
let clock=0;
const ctx=vm.createContext({window,State,Math,Object,Number,Array,Map,Set,String,JSON,WORLD:200,Uint8Array,Float32Array,Int32Array,performance:{now:()=>clock*1000}});
vm.runInContext(read('src/settlement-sea-nav.js'),ctx);
vm.runInContext(read('src/settlement-sea-convoys.js'),ctx);
const SC=window.ConquerSeaConvoys;
const run=(secs)=>{for(let k=0;k<secs*10;k++){clock+=.1;SC.step()}};
lord.a={id:'a',status:'outbound',edge:'west',transport:{mode:'shipLarge',wagons:1},actualDepartDay:9.8,arrivalDay:11.8,returnDay:13.8};
lord.b={id:'b',status:'outbound',edge:'west',transport:{mode:'wagon',wagons:3},actualDepartDay:9.8,arrivalDay:11.8,returnDay:13.8};
SC.step();
assert.equal(ships.length,1,'a sea convoy shows its ships, a land convoy none');
assert.ok(ships[0].key==='cocca','a large ship');
const x0=ships[0].pose.x;run(2);
assert.ok(ships[0].pose.x<x0&&ships[0].crew.sail.target===0,'sailing out towards the west exit, sails set');
run(60);
assert.equal(ships.length,0,'gone off the map at the exit: away in the province');
State.clock.day=10.3;run(1);
assert.equal(ships.length,0,'not shown again on the outward leg');
lord.a.status='returning';State.clock.day=13.5;run(1);
assert.equal(ships.length,1,'coming in from the exit at the end of the way back');
assert.ok(ships[0].pose.x<20,'it appears at the exit');
run(60);
assert.ok(ships.length===1&&!ships[0].away&&Math.hypot(ships[0].pose.x-56,ships[0].pose.y-100)<.5,'back at its berth');
lord.a.status='completed';run(1);
assert.equal(ships.length,0,'gone with the completed convoy');
console.log('PASS sea convoy ships: route out to the exit, away, back to the berth, gone');