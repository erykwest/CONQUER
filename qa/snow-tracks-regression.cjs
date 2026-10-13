'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const src=fs.readFileSync(__dirname+'/../src/settlement-snow-tracks.js','utf8');
const marks=[];
const brush={
 save(){},restore(){},translate(x,y){this.x=x;this.y=y},
 rotate(){},beginPath(){},ellipse(){},fill(){marks.push({x:this.x,y:this.y})}
};
const State={season:'summer',clock:{day:0},environment:[],view:{scale:1}};
const ctx=vm.createContext({State,WORLD:200,window:{},Math,
 wrap:{getBoundingClientRect:()=>({width:800,height:600})},
 ctx:brush,
 terrainSlopeKind:()=>null,
 environmentContains:()=>false,
 terrainElevation:()=>0,
 w2sRaw:(p)=>({x:p.x*3,y:p.y*3})
});
vm.runInContext(src,ctx);
const snow=ctx.window.ConquerSnowTracks;
assert.ok(snow,'snow track API must load');
snow.observe('villager',{x:100,y:100},0);
snow.observe('villager',{x:104,y:100},.02);
assert.equal(snow.count(),0,'no footprint without snow on the ground');

State.season='winter';
snow.observe('villager',{x:100,y:100},0);
snow.observe('villager',{x:104,y:100},.02);
assert.ok(snow.count()>=6,'walking 4U should leave regularly spaced footprints');
const items=snow.snapshot();
assert.ok(items.every(p=>Math.abs(p.y-100)<.01),'tracks follow actual movement');
assert.equal(new Set(items.map(x=>x.side)).size,2,'left and right feet alternate');
assert.ok(items.every(p=>p.day===.02),'tracks use simulation time');

marks.length=0;snow.draw();
assert.equal(marks.length,snow.count(),'snow footprint render draws stored positions');
snow.observe('villager',{x:106,y:100},.04,'person');
assert.ok(snow.count()>items.length,'movement extends the trail');

snow.observe('knight',{x:110,y:100},.05,'horse');
snow.observe('knight',{x:112,y:100},.06,'horse');
assert.ok(snow.snapshot().some(x=>x.wide),'mounted units make wider hoof prints');

const count=snow.count();
snow.observe('villager',{x:150,y:150},.07);
assert.equal(snow.count(),count,'teleport must not draw a fake diagonal path');

State.clock.day=3;snow.draw();
assert.equal(snow.count(),0,'two-day-old marks disappear');

State.clock.day=4;snow.observe('villager',{x:120,y:120},4);
snow.observe('villager',{x:123,y:120},4.01);
assert.ok(snow.count()>0);
State.season='summer';snow.draw();
assert.equal(snow.count(),0,'leaving winter clears footprints');
State.season='winter';snow.draw();
assert.equal(snow.count(),0,'old tracks must not reappear in a later winter');

const pop=fs.readFileSync(__dirname+'/../src/settlement-population.js','utf8');
const combat=fs.readFileSync(__dirname+'/../src/settlement-combat.js','utf8');
const render=fs.readFileSync(__dirname+'/../src/settlement-render.js','utf8');
const html=fs.readFileSync(__dirname+'/../index.html','utf8');
assert.match(pop,/ConquerSnowTracks\?\.observe\(resident\.id,p,State\.clock\.day,'person'\)/,'civilian movement must feed tracks');
assert.match(combat,/ConquerSnowTracks\?\.observe\(u\.id,u,State\.clock\.day/,'military movement must feed tracks');
assert.match(render,/ConquerSnowTracks\?\.draw\(\)/,'tracks are included in the render pipeline');
assert.ok(html.indexOf('settlement-snow-tracks.js')>html.indexOf('settlement-population.js'));
assert.ok(html.indexOf('settlement-snow-tracks.js')<html.indexOf('settlement-render.js'));
console.log('PASS dynamic winter snow footprints, alternation, cavalry, expiry, seasons and load order');
