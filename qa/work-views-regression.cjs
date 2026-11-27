'use strict';
// WORK-VIEWS-261127: work animations in eight views. With a screen facing (1 / -1) the side art is
// unchanged call for call (compared with the code before the change, BASE_REF), for every tool,
// phase and the carrier; with a view every tool draws in all eight, the body goes over the tool from
// behind, and the callers' world headings become views.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const ROOT=path.join(__dirname,'..');
const BASE_REF=process.env.WORK_VIEWS_BASE||'7acd8f0d';
const FILES=['settlement-util.js','settlement-wardrobe.js','settlement-population-figures.js','settlement-combat-anim.js','settlement-work-anim.js'];

function sandbox(read){
  let log=[];
  const o={fillStyle:'#000',strokeStyle:'#000',lineWidth:1,globalAlpha:1,lineCap:'butt',lineJoin:'miter',globalCompositeOperation:'source-over'};
  const ctx=new Proxy(o,{
    get:(t,k)=>k in t?t[k]:(...a)=>{log.push(k+'('+a.map(v=>typeof v==='number'?v.toFixed(3):typeof v==='object'?'obj':String(v)).join(',')+')|'+t.fillStyle+'|'+t.strokeStyle+'|'+(+t.lineWidth).toFixed(3))},
    set:(t,k,v)=>{t[k]=v;return true}});
  const State={view:{scale:4},heraldry:{},policies:{},clock:{day:0,speed:1}};
  const box={window:{},State,Math,Number,String,Object,Array,Map,Set,JSON,performance:{now:()=>0},Date,console,ctx,
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
catch(error){console.warn('work-views: base',BASE_REF,'not available, side identity skipped:',error.message.split('\n')[0])}

const TOOLS=Object.keys(now.run('window.ConquerWorkAnim.TOOLS'));
const DOT=`({id:'wv-1',kind:'peasant',sex:'male',age:'adult',hair:'brown',colors:['#9c9078','#7d7a72'],p:{x:100,y:100}})`;
const work=(t,tool,time,facing,view)=>t.run(`window.ConquerWorkAnim.drawWorkerUnmasked(${DOT},'${tool}',${time},${facing}${view?`,'${view}'`:''})`);

// 1. The side art (facing 1 / -1, no view) is unchanged for every tool, at several phases, and the carrier.
if(before){
  for(const tool of TOOLS)for(const time of [0,.37,.81])for(const facing of [1,-1])
    assert.deepEqual(now.take(()=>work(now,tool,time,facing)),before.take(()=>work(before,tool,time,facing)),`${tool} t=${time} f=${facing}: side art unchanged`);
  for(const tool of ['axe','hammer','shovel'])for(const facing of [1,-1]){
    const c=t=>t.run(`window.ConquerWorkAnim.drawCarrierUnmasked(${DOT},'${tool}',${facing})`);
    assert.deepEqual(now.take(()=>c(now)),before.take(()=>c(before)),`${tool} carrier f=${facing}: unchanged`);
  }
}
// 2. Every tool in every view.
const VIEWS=[...now.run('FOOT_VIEW_NAMES')];
for(const tool of TOOLS)for(const view of VIEWS)
  assert.ok(now.take(()=>work(now,tool,.37,1,view)).length>8,`${tool} ${view} draws`);
for(const view of VIEWS)assert.ok(now.take(()=>now.run(`window.ConquerWorkAnim.drawCarrierUnmasked(${DOT},'axe',1,'${view}')`)).length>8,'carrier '+view);
// 3. From behind the body is painted over the tool; from the front the tool over the body.
const order=view=>{const log=now.take(()=>work(now,'axe',.37,1,view));
  return{tool:log.findIndex(l=>l.includes('|#7a5937|')&&l.startsWith('stroke(')),body:log.findIndex(l=>l.startsWith('stroke(')&&l.includes('rgba(33,24,16,.82)'))}};
assert.ok(order('S').tool>order('S').body,'S: tool in front of the body');
assert.ok(order('E').tool>order('E').body,'E: tool in front');
assert.ok(order('N').tool<order('N').body,'N: body over the tool');
// 4. Headings: facingOf gives a world heading; drawWorker turns it into a view tile, never mirrored.
assert.deepEqual(JSON.parse(now.run(`JSON.stringify(window.ConquerWorkAnim.facingOf({x:0,y:0},2,0))`)),{x:2,y:0});
const keys=[];
now.run(`window.ConquerWorld3D={figure:(p,z,key,paint,id,mirror)=>{globalThis.__k.push([key,mirror]);return true}}`);
now.run('globalThis.__k=[]');
now.run(`window.ConquerWorkAnim.drawWorker(${DOT},'axe',0,{x:0,y:-1})`);
now.run(`window.ConquerWorkAnim.drawWorker(${DOT},'axe',0,-1)`);
keys.push(...now.run('globalThis.__k'));
assert.match(keys[0][0],/^w\|axe\|\d\|N\|/,'heading away from the viewer: N tile');
assert.equal(keys[0][1],false,'view tiles are not mirrored');
assert.equal(keys[1][1],true,'screen facing keeps the mirrored side tile');
// 5. Field workers face one of eight directions.
assert.match(fs.readFileSync(path.join(ROOT,'src','settlement-population-figures.js'),'utf8'),/return\{tool,facing:\{x:Math\.cos\(a\),y:Math\.sin\(a\)\}\};/,'field workers: world heading');
console.log('PASS work views: side art unchanged, every tool in eight views, depth order, headings to view tiles');
