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
for(const part of ['body','head','legs','tail'])assert.ok(SHEEP[part].startsWith('M'),'sheep has its own '+part);
assert.equal(SHEEP.legList.length,4,'four independently posed legs');
assert.ok(SHEEP.legList.every(l=>Number.isFinite(l.x)&&Number.isFinite(l.y)),'every leg has a hip pivot');
for(const [name,sp] of Object.entries(window.ConquerAnimals.SPECIES)){
  assert.equal(typeof sp.head,'string',name+' has one head shape');
  assert.ok(Object.values(sp.pose).every(p=>!('head' in p)&&!('face' in p)),name+' poses never swap the head shape');
}
console.log('PASS sheep art is one rigid set: body, head, four legs and tail');

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

const {SPECIES,blendedPoseOf}=window.ConquerAnimals;
const goat=SPECIES.goat;
for(const part of ['body','head','horn','beard','legs','tail'])assert.ok(goat[part].startsWith('M'),'goat has its own '+part);
assert.equal(goat.legList.length,4,'goat has four independently posed legs');
assert.equal(goat.colors.horn,'#4a2f1d','goat horns are dark brown');
assert.equal(goat.colors.body,'#d8c19a','goat coat is beige');
const gw=blendedPoseOf('goat',.3,0,0),gb=blendedPoseOf('goat',.3,0,1);
assert.ok(gb.headRot-gw.headRot>1,'goat browse swings the rigid head and neck down to the grass');
const sw=blendedPoseOf('sheep',.3,0,0);
assert.ok(Math.abs(gw.legs[0]+sw.legs[0])<1e-9,'right-facing goat art mirrors the shared gait');
console.log('PASS goat parts, colours and browse');
const cow=SPECIES.cow;
for(const part of ['body','head','legs','tail'])assert.ok(cow[part].startsWith('M'),'cow has its own '+part);
assert.ok(!cow.horn,'cow is polled like the reference');
assert.equal(cow.colors.body,'#7a5236','cow coat is brown');
const cw=blendedPoseOf('cow',.3,0,0),cb=blendedPoseOf('cow',.3,0,1);
assert.ok(cb.headRot-cw.headRot>1&&cb.headY>cw.headY,'cow browse lowers the rigid head to the grass');
console.log('PASS cow parts, colour and browse');
assert.equal(cow.scale,1.7,'cow is drawn at 170% of the base animal size');
const horse=SPECIES.horse;
assert.deepEqual(Object.keys(horse.coatColors).sort(),['black','brown','grey','white'],'horse coats: black, grey, white, brown');
assert.ok(horse.coatColors.white.body!==horse.coatColors.black.body,'coats change the coat colour');
assert.ok(horse.neck&&horse.joint,'horse neck is its own articulated piece');
const hw=blendedPoseOf('horse',.3,0,0),hb=blendedPoseOf('horse',.3,0,1);
assert.ok(hb.headY-hw.headY>100,'browsing horse lowers the head on its neck to the grass');
assert.ok(Math.abs(hb.headRot-hw.headRot)<1,'the rigid head turns only moderately; the neck does the work');
console.log('PASS horse coats, neck joint and browse; cow scale');
const {modePose,transitionPose}=window.ConquerAnimals;
const expected={deer:['walk','browse','alert','run'],stag:['walk','browse','alert','run'],wolf:['walk','run','howl','idle'],bear:['walk','stand','sleep'],boar:['walk','browse','run']};
for(const [name,modes] of Object.entries(expected)){
  const sp=SPECIES[name];
  assert.equal(sp.modes.map(m=>m[0]).join(','),modes.join(','),name+' offers its reference actions');
  assert.equal(sp.legList.length,4,name+' has four legs');
  for(const m of modes)for(let t=0;t<2;t+=.1){
    const p=modePose(name,m,t,0);
    assert.ok([...p.legs,p.headX,p.headY,p.headRot,p.bob].every(Number.isFinite),name+' '+m+' pose is finite');
  }
}
assert.ok(SPECIES.stag.headStrokes?.length&&!SPECIES.deer.headStrokes,'only the stag carries antlers');
const run=modePose('wolf','run',.1,0);
assert.ok(Math.abs(run.legs[0]-run.legs[2])>.3,'gallop: hind and fore pairs reach in opposition');
assert.ok(modePose('wolf','howl',0,0).headRot<-.5,'howling lifts the muzzle');
const stand=modePose('bear','stand',0,0);
assert.ok(stand.bodyRot<-1&&stand.bodyPivot,'a standing bear rears about its hip');
assert.equal(modePose('bear','sleep',0,0).art,'sleep','a sleeping bear curls up');
const swap=transitionPose('bear','walk','sleep',.5,0,0);
assert.ok(swap.crouch>.9,'changing art (sleep) hides the swap in a crouch');
assert.ok(transitionPose('deer','walk','browse',.5,0,0).headY>modePose('deer','walk',0,0).headY,'transitions move the head continuously');
console.log('PASS wildlife: deer, stag, wolf, bear, boar modes');