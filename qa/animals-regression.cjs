'use strict';
// Sheep animation: split rigid parts, diagonal walking gait, planted browsing
// that lowers the same head (never a different, deformed head shape).
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const window={};
const source=fs.readFileSync(path.join(__dirname,'..','src','settlement-animals.js'),'utf8');
vm.runInContext(source,vm.createContext({window,Math,Object,Number,Map}));
const {SHEEP,HEAD,sheepPose,blendedPose}=window.ConquerAnimals;
for(const part of ['body','face','legs','tail'])assert.ok(SHEEP[part].startsWith('M'),'sheep has its own '+part);
assert.equal(SHEEP.legList.length,4,'four independently posed legs');
assert.ok(SHEEP.legList.every(l=>Number.isFinite(l.x)&&Number.isFinite(l.y)),'every leg has a hip pivot');
assert.equal((source.match(/face:'/g)||[]).length,1,'one head shape shared by every pose');
console.log('PASS sheep art is one rigid set: body, face, four legs and tail');

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

const walk=blendedPose(.3,0,0),graze=blendedPose(.3,0,1),mid=blendedPose(.3,0,.5);
assert.equal(walk.headX,HEAD.walk.x,'walk keeps the approved head placement');
assert.equal(walk.neck,0,'no neck while walking');
assert.ok(graze.headY-walk.headY>90,'browse lowers the head to the grass');
assert.ok(mid.headY>walk.headY&&mid.headY<graze.headY,'the head travels continuously between poses');
console.log('PASS walk → browse head travel');
