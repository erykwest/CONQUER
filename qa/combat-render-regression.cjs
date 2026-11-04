'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=f=>fs.readFileSync(__dirname+'/../src/settlement-'+f+'.js','utf8');
const source=read('combat-render'),runtime=read('combat'),rulesSource=read('combat-rules');
assert.doesNotMatch(rulesSource,/getContext\(|drawImage\(|fillRect\(|strokeStyle|function drawEffects/,'combat rules do not draw or depend on a renderer');
assert.doesNotMatch(runtime,/getContext\(|drawImage\(|fillRect\(|strokeStyle/,'tactical runtime delegates canvas work');
for(const f of ['index.html','camp/index.html']){
 const html=fs.readFileSync(__dirname+'/../'+f,'utf8');
 assert.ok(html.indexOf('settlement-combat-render.js')>=0&&html.indexOf('settlement-combat-render.js')<html.indexOf('settlement-combat.js'),'renderer loads before combat in '+f);
}
function fixture(rendererSource=source){
 const trace=[],figures=[],mounted=[],wolves=[],hud=new Map();
 const gradient={addColorStop(...a){trace.push(['addColorStop',...a])}};
 const g=new Proxy({createImageData(w,h){return{data:new Uint8ClampedArray(w*h*4)}},createRadialGradient(...a){trace.push(['createRadialGradient',...a]);return gradient}},
  {get(t,k){return k in t?t[k]:(...a)=>trace.push([k,...a.map(x=>typeof x==='object'?'object':x)])},set(t,k,v){trace.push(['set',k,typeof v==='object'?'object':v]);t[k]=v;return true}});
 const document={createElement:()=>({setAttribute(){},getContext:()=>g}),getElementById:id=>hud.get(id)||null};
 const State={view:{scale:1},clock:{day:.2,speed:0},structures:[],heraldry:{}};
 const combat={units:[],enemy:[],storms:[],strokes:[],fog:false,zones:false};
 const state={combat,selected:null,selectedIds:new Set(),selectionDrag:null};
 const window={__conquerHeraldryCanvas:{paint:()=>true},ConquerMounted2D:{draw:(...a)=>mounted.push(a[4])},ConquerAnimals:{},
  ConquerCombatAnim:{dying:u=>!!u.fading,foeOf:()=>null,pose:()=>({}),drawFigure:(p,z,type,id)=>figures.push({p,z,type,id})},
  ConquerCamp:{isNight:()=>true,drawEncampments:()=>{}},ConquerWolves:{ensure(){throw Error('renderer may not spawn wolves')},draw:(g,u)=>wolves.push(u.id)},
  ConquerCombatRules:{visualEffects:()=>({shots:[],stones:[],meleeFlashes:[],elapsed:0}),liveryOf:()=>null}};
 const sandbox={window,document,State,wrap:{appendChild(){},getBoundingClientRect:()=>({width:800,height:600})},performance:{now:()=>1000},devicePixelRatio:1,
  w2sRaw:(p,z=0)=>({x:p.x,y:p.y-z*10}),w2s:(p,z=0)=>({x:p.x,y:p.y-z*10}),viewDepthPoint:p=>p.y,terrainElevation:()=>0,
  withRenderContext:(_g,fn)=>fn(),withUrbanFigureOcclusion:(_p,_z,fn)=>fn(),ctx:g,clamp:(v,a,b)=>Math.min(b,Math.max(a,v)),
  visualCycleDay:()=>.2,peasantHash:()=>7,militaryScale:()=>1,drawScreenFlame:()=>{},soldierLivery:()=>null,drawSoldierFigure:()=>{},
  dist:(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),REIGN_COLOR_1:'#fff',REIGN_COLOR_2:'#000'};
 vm.createContext(sandbox);vm.runInContext(rendererSource,sandbox);
 const renderer=window.ConquerCombatRenderer.create({worldSize:20,visionSize:10,readState:()=>state,activeWell:()=>true,refreshFog:()=>{},circles:()=>[],observers:()=>[],spotted:u=>!u.hidden,wallWalk:()=>null});
 return{renderer,sandbox,trace,figures,mounted,wolves,hud,State,combat,state,g};
}
{
 const q=fixture();
 q.combat.units=['captain','knight','archer','infantry','squad','patrol'].map((kind,i)=>({id:kind,kind,x:i+5,y:i+5}));
 q.combat.enemy=[{id:'hidden',kind:'infantry',x:2,y:2,hidden:true},{id:'bow',kind:'archer',x:2,y:2},{id:'wolf',kind:'wolf',x:3,y:3}];
 const before=JSON.stringify(q.combat);q.renderer.renderOverlay();
 assert.equal(q.mounted.length,1,'mounted knight keeps the 2D renderer');
 assert.equal(q.figures.filter(f=>f.id.startsWith('patrol:')).length,2);
 assert.equal(q.figures.filter(f=>f.id.startsWith('squad:')).length,5);
 assert.ok(q.figures.some(f=>f.id==='captain'&&f.type==='knight'),'captain remains on foot');
 assert.ok(q.figures.some(f=>f.id==='archer'&&f.type==='archer'));
 assert.ok(q.figures.some(f=>f.id==='infantry'&&f.type==='spearman'));
 assert.ok(q.figures.some(f=>f.id==='bow'&&f.type==='archer'));
 assert.ok(!q.figures.some(f=>f.id==='hidden'),'hidden enemy is not revealed');
 assert.deepEqual(q.wolves,['wolf']);
 assert.equal(JSON.stringify(q.combat),before,'rendering does not alter units, orders or persistent state');
 console.log('PASS render mixed troops, captain, 2D knight, patrol and fog contacts without state mutations');
}
{
 const q=fixture();q.combat.units=[{id:'sleep',kind:'squad',campState:'barracks',x:5,y:5},
  {id:'camp',kind:'squad',campState:'camped',x:6,y:6},{id:'fading',kind:'infantry',defeated:true,fading:true,x:7,y:7}];
 q.renderer.renderOverlay();assert.equal(q.figures.filter(f=>f.id==='camp:camp-guard').length,1);
 assert.equal(q.figures.filter(f=>f.id==='sleep').length,0);
 assert.ok(q.figures.some(f=>f.id==='fading'),'falling units remain visible');
 q.hud.set('combatSelection',{textContent:''});q.state.selectedIds=new Set(['camp','fading']);
 q.state.selectionDrag={start:{x:1,y:1},end:{x:20,y:20}};q.renderer.renderOverlay();
 assert.match(q.hud.get('combatSelection').textContent,/2 units selected/);
 const memory=new Uint8Array(100),visible=new Uint8Array(100);visible[0]=1;
 q.renderer.paintFogBitmap(memory,visible);q.renderer.reset();q.renderer.renderOverlay();
 assert.equal(visible[0],1);assert.equal(memory[0],0);
 console.log('PASS camp sentry, barracks, fall animation, absent HUD and selection box');
}
{
 const window={};const math=Object.create(Math);math.random=()=>.99;
 vm.runInNewContext(rulesSource,{window,Math:math});const r=window.ConquerCombatRules;
 const unit={id:'target',kind:'infantry',x:2,y:0},shooter={id:'bow',x:0,y:0,h:3,visualZ:3,terrainAt:()=>0};
 for(let i=0;i<9;i++)r.update(.25,[],[unit],[shooter],()=>true);
 r.dropStone({id:'gallery'},unit,{x:0,y:0,z:3});
 const q=fixture(),effects=r.visualEffects();assert.ok(effects.shots.length&&effects.stones.length);
 const before=JSON.stringify({effects,unit});
 q.sandbox.window.ConquerCombatRenderer.drawEffects(q.g,(p,z)=>({x:p.x,y:p.y-z}),effects);
 assert.equal(JSON.stringify({effects:r.visualEffects(),unit}),before,'drawing cannot advance queues, time or damage');
 assert.ok(q.trace.some(t=>t[0]==='arc'),'dropped stones retain their drawing');
 assert.ok(q.trace.some(t=>t[0]==='lineTo'),'arrows retain their drawing');
 console.log('PASS rules run without canvas; arrows and stones render without changing combat time or damage');
}
module.exports={fixture};
