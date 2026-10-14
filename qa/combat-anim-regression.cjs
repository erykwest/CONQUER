'use strict';
// Combat animation timing: strikes wind up then thrust, hits flash on impact,
// defeated figures fall and fade, and combat rules emit those events.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const window={};
const context=vm.createContext({window,Math,Number,Object,WeakMap,performance:{now:()=>0}});
vm.runInContext(fs.readFileSync(path.join(root,'src','settlement-combat-anim.js'),'utf8'),context);
vm.runInContext(fs.readFileSync(path.join(root,'src','settlement-combat-rules.js'),'utf8'),context);
const anim=window.ConquerCombatAnim,rules=window.ConquerCombatRules;
assert.ok(anim&&rules,'animation and rules modules register on window');
const {STRIKE,HURT,GONE,LAST,IMPACT}=anim.TIMING;
const at=t=>anim.setClock(t);

at(10);
const a={id:'a',x:0,y:0},b={id:'b',x:.5,y:0};
assert.equal(anim.pose(a).attack,0,'untouched figure stands at guard');
anim.strike(a,b);
assert.equal(anim.foeOf(a),b);
at(10+STRIKE*.2);assert.ok(anim.pose(a).attack<0,'wind-up draws the weapon back');
at(10+STRIKE*.55);assert.ok(Math.abs(anim.pose(a).attack-1)<1e-9,'thrust peaks at the impact moment');
assert.ok(Math.abs(IMPACT-STRIKE*.55)<1e-9,'damage timing matches the thrust peak');
at(10+STRIKE*.3);anim.strike(a,b);
at(10+STRIKE*.55);assert.ok(Math.abs(anim.pose(a).attack-1)<1e-9,'a new exchange never restarts a swing mid-way');
at(10+STRIKE+.01);assert.equal(anim.pose(a).attack,0,'guard restored after the swing');
at(10+STRIKE*.55);assert.notEqual(anim.pose(a,4).attack,anim.pose(a,0).attack,'squad figures are staggered');
console.log('PASS strike wind-up, thrust, no mid-swing restart and squad stagger');

at(20);anim.hurt(b,.1);
assert.equal(anim.pose(b).flash,0,'hit flash waits for the blow to land');
at(20.1);assert.equal(anim.pose(b).flash,1);
at(20.1+HURT*.5);assert.ok(Math.abs(anim.pose(b).flash-.5)<1e-6,'hit flash decays');
at(20.1+HURT+.01);assert.equal(anim.pose(b).flash,0,'hit flash ends');
const right=anim.pose(b,0,{x:0,y:0},{x:-10,y:0});
assert.equal(right.dirX,-1,'figure faces its foe in screen space');
console.log('PASS delayed hit flash and foe-facing direction');

at(30);anim.fall(b,0,a);
assert.ok(anim.dying(b)&&anim.active());
at(30+.2);const falling=anim.pose(b);
assert.ok(falling.fall>0&&falling.fall<1&&falling.alpha===1,'body topples before fading');
at(30+GONE*.95);assert.ok(anim.pose(b).alpha<.2,'body fades out');
at(30+LAST+.01);assert.ok(!anim.dying(b)&&!anim.active(),'fallen figure is removed after the fade');
console.log('PASS fall, fade and removal');

const friendly=[{id:'squad',kind:'squad',x:10,y:10}],enemy=[{id:'e',x:10.4,y:10,combatKind:'infantry'}];
at(40);
rules.update(.25,friendly,enemy,[],()=>false);
rules.update(.25,friendly,enemy,[],()=>false);
rules.update(.25,friendly,enemy,[],()=>false);
rules.update(.25,friendly,enemy,[],()=>false);
assert.equal(anim.foeOf(friendly[0]),enemy[0],'melee exchange records the friendly strike');
assert.equal(anim.foeOf(enemy[0]),friendly[0],'melee exchange records the hostile strike');
at(40+STRIKE*.55);assert.ok(anim.pose(enemy[0]).attack>0,'both sides swing on an exchange');
enemy[0].stats.hp=1;enemy[0].stats.armor=-99;friendly[0].stats.combat=99;
for(let i=0;i<8&&!enemy[0].defeated;i++)rules.update(.25,friendly,enemy,[],()=>false);
assert.ok(enemy[0].defeated,'test setup defeats the hostile');
assert.ok(anim.dying(enemy[0]),'defeat starts the fall animation');
rules.reset();assert.ok(!anim.active(),'rules reset clears pending animation');
console.log('PASS combat rules emit strike, hurt and fall events');
