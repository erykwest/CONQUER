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

const window={},State={clock:{day:10},structures:[]};
const lord={};
window.ConquerCommerce={VEHICLES:{wagon:{capacity:100},shipSmall:{capacity:300,ship:true,model:'caravella'},shipLarge:{capacity:900,ship:true,model:'cocca'}},state:()=>({lordConvoys:lord})};
window.ConquerConvoys={availableExits:()=>[{mode:'sea',edge:'west',point:{x:0,y:100}}]};
window.ConquerPier={coastHit:()=>({normal:{x:-1,y:0}})};
window.ConquerShips={lower:s=>{s.target=0}};
const ships=[];let n=0;
window.ConquerFleet={ships,spawn:o=>{const s={id:'s'+(++n),...o,pose:{x:60,y:100,heading:0},crew:{sail:{target:1}}};ships.push(s);return s},remove:id=>{const i=ships.findIndex(s=>s.id===id);ships.splice(i,1)}};
const ctx=vm.createContext({window,State,Math,Object,Number,Array,Map,Set,String,JSON,WORLD:200});
vm.runInContext(read('src/settlement-sea-convoys.js'),ctx);
const SC=window.ConquerSeaConvoys;
lord.a={id:'a',status:'outbound',edge:'west',transport:{mode:'shipLarge',wagons:1},actualDepartDay:9.8,arrivalDay:11.8,returnDay:13.8};
lord.b={id:'b',status:'outbound',edge:'west',transport:{mode:'wagon',wagons:3},actualDepartDay:9.8,arrivalDay:11.8,returnDay:13.8};
SC.step();
assert.equal(ships.length,1,'a sea convoy shows its ships, a land convoy none');
assert.ok(ships[0].key==='cocca'&&ships[0].crew.sail.target===0,'a large ship under sail');
const x0=ships[0].pose.x;State.clock.day=10.3;SC.step();
assert.ok(ships[0].pose.x<x0,'sailing out towards the west exit');
State.clock.day=11;SC.step();
assert.equal(ships.length,0,'away in the province mid-voyage');
lord.a.status='returning';State.clock.day=13.5;SC.step();
assert.equal(ships.length,1,'coming in at the end of the way back');
lord.a.status='completed';SC.step();
assert.equal(ships.length,0,'tied up and gone with the convoy');
console.log('PASS sea convoy ships: leave port, away, come back, gone');