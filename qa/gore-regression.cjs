'use strict';
// GORE-01: battlefield aftermath (settlement-gore.js) — events, option, fade x2 snow, wiring.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const root=__dirname+'/../';
const src=fs.readFileSync(root+'src/settlement-gore.js','utf8');
const store={},clock={ms:1e6};
const calls=[];
const brush=new Proxy({},{get:(t,k)=>k in t?t[k]:(...a)=>{calls.push(k)},set:(t,k,v)=>{t[k]=v;return true}});
const State={season:'summer',clock:{day:5},environment:[],view:{scale:1}};
const context=vm.createContext({State,WORLD:200,Math,performance:{now:()=>clock.ms},
  localStorage:{getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=String(v)}},
  window:{},ctx:brush,wrap:{getBoundingClientRect:()=>({width:800,height:600})},
  terrainElevation:()=>0,terrainSlopeKind:()=>null,environmentContains:()=>false,
  w2sRaw:p=>({x:p.x*3,y:p.y*3}),w2s:p=>({x:p.x*3,y:p.y*3}),withProjectionGroundZ:(g,fn)=>fn(),
  militaryScale:()=>.5,drawSoldierFigureUnmasked:()=>calls.push('body'),viewDepthPoint:p=>p.x+p.y});
vm.runInContext(src,context);
const G=context.window.ConquerGore;
assert.ok(G,'ConquerGore API must load');
assert.equal(G.enabled(),true,'gore is on by default');
assert.equal(G.settings.keepDays,2,'gore fades over twice the snow footprints (1 day)');

// Arrow hit: a blood splat; arrow miss: an arrow stuck in the ground.
const archer={id:'a',x:90,y:100},man={id:'m',x:100,y:100,kind:'squad'};
G.hit(man,'arrow',archer,.4);
G.miss({from:{x:90,y:100},to:{x:100,y:100},duration:.4},man);
let snap=G.snapshot();
assert.equal(snap.stains.length,1,'every hit leaves blood');
assert.equal(snap.arrows.length,1,'a missed arrow stays in the ground');
assert.ok(snap.arrows[0].x>100,'missed arrows land beyond the target, along the flight');
assert.ok(snap.stains[0].day===5,'marks use simulation time');

// Death: a squad leaves its five men; arrow wounds stay in the corpse.
G.died(man,0,archer,{FADE_FROM:.9,GONE:1.8});
snap=G.snapshot();
assert.equal(snap.corpses.length,5,'a fallen squad leaves five bodies, like its five figures');
assert.ok(snap.corpses[0].arrows.length>=1,'the killing arrow stays in the body');
assert.ok(snap.corpses.every(c=>c.showAt>=1e3+.9),'corpses fade in as the falling figure fades out');

// Melee by an axe: mutilations appear (deterministic per unit id).
const muts=new Set();
for(let i=0;i<40;i++){const u={id:'foe'+i,x:50+i,y:50,faction:'dev_hostile'};G.hit(u,'melee',{x:49+i,y:50,weapon:'axe'});G.died(u,0,{x:49+i,y:50,weapon:'axe'})}
for(const c of G.snapshot().corpses)muts.add(c.mut);
for(const m of ['decap','cleave','arm','none'])assert.ok(muts.has(m),'axe melee produces '+m);
const stone={id:'s',x:30,y:30,faction:'dev_hostile'};G.hit(stone,'stone',null);G.died(stone,0,null);
assert.ok(['crushed','none'].includes(G.snapshot().corpses.at(-1).mut));
G.died({id:'w',x:20,y:20,kind:'wolf',faction:'wildlife'},0,null);
assert.equal(G.snapshot().corpses.filter(c=>c.id.startsWith('w:')).length,0,'wildlife leaves blood, not soldier corpses');

// Fade: same linear law as the snow tracks, over 2 days, then gone.
assert.equal(G.fadeAt(0),1);
assert.ok(Math.abs(G.fadeAt(1)-.5)<1e-9,'half strength after one day');
assert.ok(G.fadeAt(1.99)<.1);
clock.ms+=3000;calls.length=0;G.draw();
assert.ok(calls.includes('body'),'corpses are drawn with the game figure');
const count=G.count();
State.clock.day=7.01;G.draw();
assert.equal(G.count(),0,'everything disappears after two simulation days ('+count+' marks)');

// Option: off clears and stops recording; persisted.
G.hit(man,'melee',archer);
assert.equal(G.setEnabled(false),false);
assert.equal(store['conquer.gore.v1'],'0','preference saved in the browser');
assert.equal(G.count(),0,'switching off clears the field');
G.hit(man,'melee',archer);G.miss({from:{x:0,y:0},to:{x:5,y:5}});G.died({id:'x',x:5,y:5},0,null);
assert.equal(G.count(),0,'nothing is recorded while off');
G.setEnabled(true);
G.addStain({x:-5,y:10});
assert.equal(G.count(),0,'no marks off the map');

// Wiring in the game.
const rules=fs.readFileSync(root+'src/settlement-combat-rules.js','utf8');
const anim=fs.readFileSync(root+'src/settlement-combat-anim.js','utf8');
const render=fs.readFileSync(root+'src/settlement-render.js','utf8');
const html=fs.readFileSync(root+'index.html','utf8');
assert.match(rules,/ConquerGore\?\.hit\(target,'arrow'/,'arrow hits feed gore');
assert.match(rules,/ConquerGore\?\.miss\(shot,target\)/,'arrow misses feed gore');
assert.match(rules,/gore\?\.hit\(a,'melee'/,'melee hits feed gore');
assert.match(rules,/ConquerGore\?\.hit\(target,'stone'/,'dropped stones feed gore');
assert.match(rules,/ConquerGore\?\.died\(u,delay,foe,anim\?\.TIMING\)/,'deaths leave corpses');
assert.match(anim,/ConquerGore\?\.enabled\?\.\(\)!==false\)drawBlood/,'the fall blood follows the option');
// World 3D only (D-RENDER-3D-261111): gore is painted right after the 3D back pass, before sites and figures.
{const g=render.indexOf('window.ConquerGore?.draw();');
assert.ok(g>render.indexOf('window.ConquerWorld3D.drawBack(r)')&&g<render.indexOf('drawBuildArea();'),'gore renders under buildings');}
assert.match(html,/id="goreToggle"/,'DEV panel switch');
assert.ok(html.indexOf('settlement-gore.js')<html.indexOf('settlement-render.js'));
assert.ok(html.indexOf('settlement-gore.js')>html.indexOf('settlement-population-figures.js'));
console.log('PASS gore events, mutilations, corpses, option, 2-day fade and wiring');
