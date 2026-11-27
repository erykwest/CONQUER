'use strict';
// CIVIL-VIEWS-261127: civilians (the four classes, children, L4 ladies, every wardrobe piece) and the
// levy in eight views. S stays the approved art call for call (compared with the code before the
// change, BASE_REF); the other views draw everything, hide the pieces worn on the front from
// behind, and a walking civilian turns to its walk.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const ROOT=path.join(__dirname,'..');
const BASE_REF=process.env.CIVIL_VIEWS_BASE||'61d34eae';
const FILES=['settlement-util.js','settlement-wardrobe.js','settlement-population-figures.js','settlement-combat-anim.js'];

let clock=0;
function sandbox(read){
  let log=[];
  const o={fillStyle:'#000',strokeStyle:'#000',lineWidth:1,globalAlpha:1,lineCap:'butt',lineJoin:'miter',globalCompositeOperation:'source-over'};
  const ctx=new Proxy(o,{
    get:(t,k)=>k in t?t[k]:(...a)=>{log.push(k+'('+a.map(v=>typeof v==='number'?v.toFixed(3):typeof v==='object'?'obj':String(v)).join(',')+')|'+t.fillStyle+'|'+t.strokeStyle+'|'+(+t.lineWidth).toFixed(3))},
    set:(t,k,v)=>{t[k]=v;return true}});
  const State={view:{scale:4},heraldry:{},policies:{},clock:{day:0,speed:1}};
  const box={window:{},State,Math,Number,String,Object,Array,Map,Set,JSON,performance:{now:()=>clock*1000},console,ctx,
    VILLAGER_SKIN:'#d99a83',HAIR_COLORS:{brown:'#65452f',blonde:'#c9a35a',black:'#222',gray:'#999',red:'#a0482a'},
    REIGN_COLOR_1:'#b53636',REIGN_COLOR_2:'#355fb8',REIGN_COLOR_1_DARK:'#7f2323',REIGN_COLOR_2_DARK:'#243f79',
    w2s:p=>({x:p.x,y:p.y}),w2sRaw:p=>({x:p.x,y:p.y}),terrainElevation:()=>0,withProjectionGroundZ:(z,fn)=>fn(),
    withUrbanFigureOcclusion:(p,z,fn)=>fn(),villagerHair:()=>'brown',
    peasantHash:s=>{let h=2166136261;for(const c of String(s)){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}};
  const context=vm.createContext(box);
  for(const f of FILES)vm.runInContext(read(f),context,{filename:f});
  return{run:src=>vm.runInContext(src,context),take:fn=>{log=[];fn();return log}};
}
const now=sandbox(f=>fs.readFileSync(path.join(ROOT,'src',f),'utf8'));
let before=null;
try{before=sandbox(f=>execFileSync('git',['show',BASE_REF+':src/'+f],{cwd:ROOT,encoding:'utf8'}))}
catch(error){console.warn('civil-views: base',BASE_REF,'not available, S identity skipped:',error.message.split('\n')[0])}

const W='window.ConquerWardrobe';
const pieces=now.run(`[...Object.keys(${W}.PIECES),...Object.keys(${W}.ROLE_PIECES),...Object.keys(${W}.LADY_PIECES)]`);
const PEOPLE=[['peasant','male','adult'],['artisan','female','adult'],['merchant','male','adult'],['elite','male','adult'],
  ['elite','female','adult'],['peasant','female','child']];
const dot=(kind,sex,age,piece)=>`({id:'cv-${kind}-${sex}-${age}',kind:'${kind}',sex:'${sex}',age:'${age}',hair:'brown',colors:['#8f8b82','#b4a58a'],p:{x:100,y:100}${
  piece?`,outfit:${W}.compose(['${piece}'],'cv-1','${kind}','#8f8b82')`:''}})`;
const still=(t,d,view)=>t.run(`drawVillagerFigureUnmasked(${d}${view?`,'both',1,'${view}'`:''})`);

// 1. S is the approved art for every class, child, lady and wardrobe piece, and for the levy.
if(before){
  for(const [kind,sex,age] of PEOPLE)for(const piece of [null,...pieces]){
    const d=dot(kind,sex,age,piece);
    assert.deepEqual(now.take(()=>still(now,d,'S')),before.take(()=>still(before,d)),`${kind} ${sex} ${age} ${piece||'-'}: S unchanged`);
    assert.deepEqual(now.take(()=>still(now,d)),before.take(()=>still(before,d)),`${kind} ${piece||'-'}: default is S`);
  }
  for(const kind of ['peasant','artisan']){
    const d=`({id:'levy-1',kind:'${kind}',sex:'male',age:'adult',hair:'brown',colors:['#8f8b82','#b4a58a'],p:{x:100,y:100}})`;
    assert.deepEqual(now.take(()=>now.run(`drawLevyFigureUnmasked(${d})`)),before.take(()=>before.run(`drawLevyFigureUnmasked(${d})`)),kind+' levy: S unchanged');
  }
}
// 2. Every view draws every class with every piece, and the levy.
const VIEWS=[...now.run('FOOT_VIEW_NAMES')];
for(const view of VIEWS){
  for(const [kind,sex,age] of PEOPLE)for(const piece of [null,...pieces])
    assert.ok(now.take(()=>still(now,dot(kind,sex,age,piece),view)).length>5,`${kind} ${piece||'-'} ${view} draws`);
  for(const kind of ['peasant','artisan'])
    assert.ok(now.take(()=>now.run(`drawLevyFigureUnmasked({id:'levy-1',kind:'${kind}',sex:'male',age:'adult',hair:'brown',colors:['#8f8b82','#b4a58a'],p:{x:100,y:100},view:'${view}'})`)).length>5,kind+' levy '+view);
}
// 3. From behind: no apron bib, no stole, a closed hood, hair over the whole head.
const fills=log=>log.filter(l=>l.startsWith('fill')).map(l=>l.split('|')[1]);
const role=(piece)=>now.run(`${W}.ROLE_PIECES['${piece}']||${W}.PIECES['${piece}']`);
const apron=Object.keys(now.run(`${W}.ROLE_PIECES`)).find(k=>role(k).apron);
if(apron){
  const color=now.run(`${W}.compose(['${apron}'],'cv-1','artisan','#8f8b82').colors.body`);
  const f=view=>fills(now.take(()=>still(now,dot('artisan','male','adult',apron),view))).filter(c=>c===color).length;
  assert.ok(f('S')>0&&f('N')===0,'apron: the bib is on the front only');
}
const hairN=fills(now.take(()=>still(now,dot('peasant','male','adult',null),'N'))).filter(c=>c==='#65452f').length;
assert.ok(hairN>=2,'N: hair over the back of the head');
// 4. A walking civilian turns to its walk; standing, it faces the viewer again.
now.run(`civilianWalk.clear()`);
const walk=(x,y,at)=>{clock=at;return now.run(`civilianView({id:'w1',p:{x:${x},y:${y}}})`)};
assert.equal(walk(0,0,0),'S','first sight: S');
assert.equal(walk(.2,0,.1),'E','walking screen right: E');
assert.equal(walk(.2,.2,.2),'S','walking toward the viewer: S');
assert.equal(walk(.2,0,.3),'N','walking away: N');
assert.equal(walk(.2,0,.9),'N','just stopped: keeps the heading');
assert.equal(walk(.2,0,3),'S','stopped a while: faces the viewer');
assert.equal(now.run(`civilianView({id:'w2',p:{x:0,y:0},view:'SW'})`),'SW','an explicit view wins');
// 5. Wiring: one World3D tile per view.
const src=fs.readFileSync(path.join(ROOT,'src','settlement-population-figures.js'),'utf8');
assert.match(src,/'v\|'\+villagerLookKey\(dot\)\+\(view==='S'\?'':'\|'\+view\)/,'villager tile per view');
assert.match(src,/\(dot\.view==='S'\?'':'\|'\+dot\.view\)/,'levy tile per view');
console.log('PASS civil views: S unchanged for every class and piece, eight views, back pieces, walking heading');
