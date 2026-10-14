'use strict';
// Sheep animation: split parts, diagonal walking gait and planted browsing.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const window={};
vm.runInContext(fs.readFileSync(path.join(__dirname,'..','src','settlement-animals.js'),'utf8'),vm.createContext({window,Math,Object,Number,Map}));
const {SHEEP,sheepPose}=window.ConquerAnimals;
for(const mode of ['walk','browse']){
  const art=SHEEP[mode];
  for(const part of ['body','face','legs','tail'])assert.ok(art[part].startsWith('M'),mode+' has its own '+part);
  assert.equal(art.legList.length,4,mode+' splits four independently posed legs');
  assert.ok(art.legList.every(l=>Number.isFinite(l.x)&&Number.isFinite(l.y)),'every leg has a hip pivot');
}
console.log('PASS sheep art is split into body, face, four legs and tail');

let maxSwing=0;
for(let t=0;t<1;t+=.01){
  const p=sheepPose('walk',t);
  assert.ok(Math.abs(p.legs[0]-p.legs[3])<1e-9&&Math.abs(p.legs[1]-p.legs[2])<1e-9,'diagonal pairs move together');
  assert.ok(Math.abs(p.legs[0]+p.legs[1])<1e-9,'pairs swing in opposition');
  maxSwing=Math.max(maxSwing,Math.abs(p.legs[0]));
}
assert.ok(maxSwing>.3&&maxSwing<.5,'walking stride is visible but not cartoonish');
console.log('PASS walking gait');

let moving=0,chewing=0;
for(let t=0;t<20;t+=.05){
  const p=sheepPose('browse',t);
  if(p.legs.some(a=>a!==0))moving++;
  if(p.chew>0)chewing++;
  assert.ok(p.legs.slice(1).every(a=>a===0),'browsing keeps three legs planted');
}
assert.ok(moving>0&&moving<40,'browsing sheep take an occasional small step');
assert.ok(chewing>100,'browsing sheep nibble most of the time');
console.log('PASS browsing pose');
