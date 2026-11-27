'use strict';
// Regression: the messenger (courier and outpost relay riders) is a World 3D card with the horse
// capsule as its collider, its walk is animated in real time, and it is one of 8 traced views
// (tools/blender/messenger_views.py). Before this, the 2D overlay drew him with a game-clock gait
// (day*7, about 0.15 per second) and no depth or collider.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const src=path.join(__dirname,'..','src');
const read=f=>fs.readFileSync(path.join(src,f),'utf8');

// Source contracts: the render passes call the card functions; the overlay stays for 2D only.
const render=read('settlement-render.js'),diplomacy=read('settlement-diplomacy.js'),soldiers=read('settlement-soldiers.js');
const mounted=read('settlement-mounted2d.js'),viewsSrc=read('assets/mounted-views.js');
assert.match(render,/ConquerDiplomacy\?\.drawCard\?\.\(\)/,'the courier card is drawn in the population pass, before drawFront');
assert.match(render,/ConquerSoldiers\?\.drawCards\?\.\(\)/,'the relay rider cards are drawn in the population pass');
assert.match(diplomacy,/window\.ConquerWorld3D\?\.active\?\.\(\)&&window\.ConquerMounted2D\?\.card&&/,'the courier overlay yields to the World 3D card');
assert.match(soldiers,/window\.ConquerWorld3D\?\.active\?\.\(\)&&window\.ConquerMounted2D\?\.card\)return;/,'the relay overlay yields to the World 3D card');
assert.doesNotMatch(diplomacy,/t:day\(\)\*7/,'the courier gait is no longer tied to the game clock');
assert.match(mounted,/window\.ConquerMounted2D=\{draw,drawView,card,lanceGeometry,VIEW_NAMES,viewOf,viewAt,phaseOf\}/);

// The off-profile views (tools/blender/mounted_views.py): the approved 2D art built part by part in
// Blender, one frame per pose (idle + 8 stride phases), regions coloured by coat/livery tokens.
const viewsBox={window:{}};vm.createContext(viewsBox);vm.runInContext(viewsSrc,viewsBox);
const MV=viewsBox.window.ConquerMountedViews?.messenger;
assert.ok(MV&&Array.isArray(MV.parts)&&MV.parts.length>20,'the messenger is built from the parts of its 2D art');
for(const v of ['SE','S','SW','NW','N','NE']){
  assert.equal(MV.views[v]?.frames?.length,9,'view '+v+': idle + 8 stride phases');
  assert.ok(MV.views[v].frames.every(f=>f.length>10),'view '+v+': every frame has the parts of the figure');
}
const fills=new Set(MV.parts.map(p=>p.fill));
for(const t of ['coat:body','coat:legFar','coat:hoof','livery:main','livery:alt'])assert.ok(fills.has(t),'part colour token '+t);
// Knights: the same build, with the charge (lance couched: r0..r7) and the equipment as layers.
const KV=viewsBox.window.ConquerMountedViews?.knight;
assert.ok(KV,'knight views are built');
assert.equal(JSON.stringify(KV.poses),JSON.stringify(['idle','p0','p1','p2','p3','p4','p5','p6','p7','r0','r1','r2','r3','r4','r5','r6','r7']));
for(const L of ['helmet:greathelm','helmet:cap','helmet:kettle','helmet:nasal','helmet:barbuta','shield:default','shield:oval',
  'shield:round','shield:heater','shield:kite','shield:pavise','crest:wings','crest:antlers','crest:horns','crest:eagle','crest:crown'])
  assert.equal(KV.layers?.[L]?.SE?.length,17,'layer '+L+': a frame for every pose');
assert.ok(KV.parts.some(p=>p.arms),'the realm arms regions are marked for the heraldry painter');
const combatRender=read('settlement-combat-render.js');
assert.match(combatRender,/M2\.drawView\(ctx,s\.x,s\.y,size,\{\.\.\.opts,view,phase:/,'knights in battle pick one of the 8 views');

// Runtime: load settlement-mounted2d.js in a VM with stubs and check card() behaviour.
const calls=[];
let now=1000;
const win={
  ConquerWorld3D:{figure:(p,z,key,paint,id,mirror,card)=>{calls.push({p,z,key,paint,id,mirror,card});return true}},
  ConquerAnimals:{drawAnimal:()=>{},capsule:(species,sf,dir)=>({kind:'animal:'+species,axis:dir,sf})},
};
const sandbox={window:win,State:{view:{scale:10}},performance:{now:()=>now},Math,console,Path2D:class{}};
sandbox.w2s=(p,z)=>({x:p.x*10,y:-p.y*10-z});
sandbox.w2sRaw=(p,z)=>({x:p.x*10,y:-p.y*10-z});
vm.createContext(sandbox);
vm.runInContext(mounted,sandbox,{filename:'settlement-mounted2d.js'});
const M2=win.ConquerMounted2D;
assert.equal(typeof M2.card,'function','ConquerMounted2D.card exists');

const walk={kind:'messenger',heading:{x:1,y:0},mode:'walk',seed:3,coat:'brown'};
const p={x:5,y:5};
assert.equal(M2.card(p,.1,'courier:a',walk),true,'the card is accepted by World 3D');
const first=calls.at(-1);
assert.equal(first.card.capsule?.kind,'animal:horse','the horse capsule is the collider');
assert.equal(first.card.capsule?.box,true,'the collider is an oriented box');
assert.equal(first.mirror,false,'each view is traced in its own direction: never mirrored');
assert.equal(first.id,'courier:a');
assert.match(first.key,/\|E\|/,'heading east: view E');

// The atlas key follows the stride: a different phase every ~90 ms.
const keys=new Set();
for(let k=0;k<12;k++){now=1000+k*90;M2.card(p,.1,'courier:a',walk);keys.add(calls.at(-1).key)}
assert.ok(keys.size>=4,'the walk key changes through the stride phases, not frozen: '+keys.size);

// Heading west: the view W.
now=1000;M2.card(p,.1,'courier:a',{...walk,heading:{x:-1,y:0}});
assert.match(calls.at(-1).key,/\|W\|/,'heading west: view W');

// The 8 headings at 45 degrees give the 8 views.
const seen=new Set();
for(let k=0;k<8;k++){const a=k*Math.PI/4;M2.card(p,.1,'courier:x',{...walk,heading:{x:Math.cos(a),y:Math.sin(a)}});seen.add(calls.at(-1).key.split('|')[4])}
assert.equal(seen.size,8,'8 distinct views from 8 headings: '+[...seen].join(','));

// An idle courier keeps one key (standing pose).
M2.card(p,.1,'courier:b',{...walk,mode:'idle'});
const idleKey=calls.at(-1).key;
now=1500;M2.card(p,.1,'courier:b',{...walk,mode:'idle'});
assert.equal(calls.at(-1).key,idleKey,'idle courier does not change its tile');

// Without World 3D collecting figures, card() declines and the caller keeps the 2D overlay.
win.ConquerWorld3D.figure=()=>false;
assert.equal(M2.card(p,.1,'courier:a',walk),false);

// The paint closure runs without throwing (no traced views in the VM: it draws nothing).
win.ConquerWorld3D.figure=(p2,z,key,paint)=>{calls.push({key,paint});return true};
M2.card(p,.1,'courier:a',walk);
const fakeCtx=new Proxy({},{get:()=>()=>{},set:()=>true});
assert.doesNotThrow(()=>calls.at(-1).paint(fakeCtx));

console.log('messenger-card-regression: ok');
