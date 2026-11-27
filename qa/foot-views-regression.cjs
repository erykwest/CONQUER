'use strict';
// FOOT-VIEWS-261127: foot soldiers in eight views. The S view must stay the approved art, call for
// call (compared with the drawing code before the change, BASE_REF); the other seven views draw
// every type, still and posed, with the shield's back and no face details from behind, and the
// gear on the far side of the body painted before it.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const ROOT=path.join(__dirname,'..');
const BASE_REF=process.env.FOOT_VIEWS_BASE||'084f1d9d';
const FILES=['settlement-util.js','settlement-wardrobe.js','settlement-population-figures.js','settlement-combat-anim.js'];

function sandbox(read){
  let log=[];
  const o={fillStyle:'#000',strokeStyle:'#000',lineWidth:1,globalAlpha:1,lineCap:'butt',lineJoin:'miter',globalCompositeOperation:'source-over'};
  const ctx=new Proxy(o,{
    get:(t,k)=>k in t?t[k]:(...a)=>{log.push(k+'('+a.map(v=>typeof v==='number'?v.toFixed(3):typeof v==='object'?'obj':String(v)).join(',')+')|'+t.fillStyle+'|'+t.strokeStyle+'|'+(+t.lineWidth).toFixed(3))},
    set:(t,k,v)=>{t[k]=v;return true}});
  const State={view:{scale:4},heraldry:{},policies:{},clock:{day:0,speed:1}};
  const box={window:{},State,Math,Number,String,Object,Array,Map,Set,JSON,performance:{now:()=>0},console,ctx,
    VILLAGER_SKIN:'#d99a83',HAIR_COLORS:{brown:'#65452f'},REIGN_COLOR_1:'#b53636',REIGN_COLOR_2:'#355fb8',
    REIGN_COLOR_1_DARK:'#7f2323',REIGN_COLOR_2_DARK:'#243f79',
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
catch(error){console.warn('foot-views: base',BASE_REF,'not available, S identity skipped:',error.message.split('\n')[0])}

const TYPES=['spearman','pikeman','herald','manAtArms','archer','knight','unarmed','axeman'];
const still=(t,type,view)=>t.run(`drawSoldierFigureUnmasked({x:100,y:100},0,${JSON.stringify(type)},'fv-1',.3,null,false${view?`,${JSON.stringify(view)}`:''})`);
const posed=(t,type,view,engaged)=>t.run(`window.ConquerCombatAnim.drawFigure({x:100,y:100},0,${JSON.stringify(type)},'fv-1',.3,null,
  window.ConquerCombatAnim.pose({id:'fv-1',engaged:${engaged}},0,{x:100,y:100},{x:130,y:110})${view?`,${JSON.stringify(view)}`:''})`);

// 1. S is the approved art: same calls, same order, same styles as before the change.
if(before){
  for(const type of TYPES){
    assert.deepEqual(now.take(()=>still(now,type,'S')),before.take(()=>still(before,type)),type+' still: S unchanged');
    assert.deepEqual(now.take(()=>still(now,type,null)),before.take(()=>still(before,type)),type+' still: default is S');
    for(const engaged of [false,true])
      assert.deepEqual(now.take(()=>posed(now,type,'S',engaged)),before.take(()=>posed(before,type,null,engaged)),type+' posed: S unchanged');
  }
  for(const helmet of ['cap','kettle','nasal','barbuta','greathelm']){
    now.run(`State.policies.unitHelmet=${JSON.stringify(helmet)}`);before.run(`State.policies.unitHelmet=${JSON.stringify(helmet)}`);
    assert.deepEqual(now.take(()=>still(now,'pikeman','S')),before.take(()=>still(before,'pikeman')),helmet+': S unchanged');
  }
  now.run('State.policies.unitHelmet=undefined');
}

// 2. Every view draws every type, still and posed.
const VIEWS=now.run('FOOT_VIEW_NAMES');
assert.deepEqual([...VIEWS],['E','SE','S','SW','W','NW','N','NE'],'eight views');
for(const type of TYPES)for(const view of VIEWS){
  const a=now.take(()=>still(now,type,view)),b=now.take(()=>posed(now,type,view,true));
  assert.ok(a.length>8&&b.length>8,type+' '+view+' draws');
}
// 3. From behind: the shield's bare back, no visor slit; from the front the arms and the slit.
const fills=log=>log.filter(l=>l.startsWith('fill')).map(l=>l.split('|')[1]);
now.run("State.policies.unitHelmet='greathelm'");
for(const view of ['N','NE','NW']){
  const f=fills(now.take(()=>still(now,'pikeman',view)));
  assert.ok(f.includes('#7a5937'),view+': shield seen from the back');
  assert.ok(!f.includes('#1d2022'),view+': no eye slit from behind');
}
for(const view of ['S','SE','SW']){
  const f=fills(now.take(()=>still(now,'pikeman',view)));
  assert.ok(!f.includes('#7a5937'),view+': shield front');
  assert.ok(f.includes('#1d2022'),view+': eye slit on the face');
}
// 4. Depth: from behind the shield (left arm) is painted before the body's outline; in S after it.
const order=(view)=>{const log=now.take(()=>still(now,'pikeman',view));
  return{shield:log.findIndex(l=>l.startsWith('stroke(')&&l.includes('|#b7aa8f|')),body:log.findIndex(l=>l.startsWith('stroke(')&&l.endsWith('|rgba(25,24,22,.88)|1.600'))}};
assert.ok(order('S').shield>order('S').body,'S: shield in front of the body');
assert.ok(order('N').shield<order('N').body,'N: shield behind the body');
assert.ok(order('E').shield<order('E').body,'E (facing right, left arm away): shield behind');
assert.ok(order('W').shield>order('W').body,'W (facing left, left arm toward the viewer): shield in front');
// 5. Heading -> view: walking screen right is E, toward the viewer S, away N; no heading S.
assert.equal(now.run('footViewOf({x:0,y:0},{x:1,y:0})'),'E');
assert.equal(now.run('footViewOf({x:0,y:0},{x:0,y:1})'),'S');
assert.equal(now.run('footViewOf({x:0,y:0},{x:-1,y:-1})'),'NW');
assert.equal(now.run('footViewOf({x:0,y:0},null)'),'S');
assert.equal(now.run("footViewOf({x:0,y:0},'NE')"),'NE');
// 6. Wiring: combat units, the standard, wall patrols and the World3D tiles carry the view.
const src=f=>fs.readFileSync(path.join(ROOT,'src',f),'utf8');
assert.match(src('settlement-combat-render.js'),/anim\.drawFigure\(p,z,type,id,State\.clock\.day,livery,pose,view\)/,'combat units turn');
assert.match(src('settlement-combat-render.js'),/drawSquadStandard\(soldier\.p,soldier\.unit\.id,soldier\.z,view\|\|'S'\)/,'standard turns with the herald');
assert.match(src('settlement-wall-patrols.js'),/drawSoldierFigure\(\{x:p\.x,y:p\.y\},p\.z,'spearman',p\.id,p\.phase,null,p\.heading\)/,'wall patrols face their walk');
assert.match(src('settlement-world3d.js'),/\|'\+view\);/,'one World3D tile per view');
console.log('PASS foot views: S unchanged, eight views for every foot soldier, back of shield and helmet, depth order, wiring');
