'use strict';
// Modular wagon: chassis (cart, wagon, carriage), team, driver seat and cargo slots compose
// independently, and the wheels roll with the distance travelled.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const window={};
vm.runInContext(fs.readFileSync(path.join(__dirname,'..','src','settlement-wagons.js'),'utf8'),vm.createContext({window,Math,Object,Number,Array}));
const {CHASSIS,CARGO,WAGON_SCALE,wagonLayout,wheelAngle}=window.ConquerWagons;

assert.equal(CHASSIS.cart.wheels.length,1,'a cart shows one wheel per side');
assert.equal(CHASSIS.wagon.wheels.length,2,'a wagon shows two wheels per side');
assert.ok(CHASSIS.wagon.wheels[1].r<CHASSIS.wagon.wheels[0].r,'front wheels are smaller than rear wheels');
assert.ok(!CHASSIS.cart.seat&&CHASSIS.wagon.seat,'only the wagon has a driver seat');
console.log('PASS chassis modules');

const mixed=wagonLayout({chassis:'wagon',cargo:['sack','crate','barrel','hay','sack','crate']});
assert.equal(mixed.cargo.length,6);
assert.equal(mixed.cargo.map(c=>c.row).join(','),'0,0,0,1,1,1','back row fills first, then the front row');
for(const item of mixed.cargo)assert.ok(item.x>mixed.bed[0]&&item.x<mixed.bed[1]+20,'cargo stays on the bed');
assert.equal(wagonLayout({cargo:Array(9).fill('sack')}).cargo.length,6,'a bed holds at most six loads');
assert.equal(wagonLayout({cargo:['sack','dragon']}).cargo.length,1,'unknown cargo kinds are ignored');
assert.ok(Object.keys(CARGO).length>=6,'sacks, crates, barrels, hay, logs and stone are available');
console.log('PASS cargo slots');

assert.equal(wagonLayout({team:[]}).horses.length,0,'a wagon may stand without a team');
const one=wagonLayout({team:[{}]}),two=wagonLayout({team:[{},{}]});
assert.equal(one.horses.length,1);
assert.equal(two.horses.length,2);
assert.ok(two.horses[0].far&&!two.horses[1].far,'the far horse is drawn first, behind the near one');
assert.ok(one.horses[0].x>CHASSIS.wagon.bed[1]*WAGON_SCALE,'the team stands ahead of the bed');
const coach=wagonLayout({chassis:'carriage',cargo:['sack','crate'],team:[{},{}]});
assert.ok(coach.chassis.cabin&&coach.seat,'the carriage has a cabin and a coachman seat');
assert.equal(coach.cargo.length,0,'a closed carriage takes no cargo');
assert.ok(coach.chassis.wheels[1].r<coach.chassis.wheels[0].r,'carriage front wheels are smaller');
console.log('PASS team and carriage');

const r=CHASSIS.wagon.wheels[0].r;
assert.ok(Math.abs(wheelAngle(2*Math.PI*r,r)-2*Math.PI)<1e-9,'a wheel turns once per circumference travelled');
assert.equal(wheelAngle(0,r),0,'a standing wagon does not turn its wheels');
console.log('PASS rolling wheels');
