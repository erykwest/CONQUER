'use strict';
// Integrated camp wolves: retain original animation art and verify real
// simulation (spawn, neutrality, pursuit, hostile combat, return to daytime).
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const art=read('src/settlement-animals.js');
const wolvesSrc=read('src/settlement-wolves.js');
const combatSrc=read('src/settlement-combat.js');
const rulesSrc=read('src/settlement-combat-rules.js');
const html=read('camp/index.html');
assert.match(html,/settlement-animals\.js/);
assert.match(html,/settlement-wolves\.js/);
assert.ok(html.indexOf('settlement-animals.js')<html.indexOf('settlement-wolves.js'));
assert.match(combatSrc,/ConquerWolves\?\.tick\(dt\)/);
assert.match(combatSrc,/ConquerWolves\?\.draw\(g,e\)/);
let night=false,token=null,wolves=[],registerCount=0,artCalls=[];
const soldiers=[];
const win={ConquerCombat:{
  enemy:()=>wolves,units:()=>soldiers,
  areaState:p=>({yellow:Math.hypot(p.x-100,p.y-100)<14}),
  wolfSpawnedFor:()=>token,
  registerWolves:(id,pack)=>{
    if(id===token)return false;
    token=id;wolves=pack;registerCount++;return true
  }
}};
const state={
  seed:31415,village:{founded:true,wellId:'well-a'},
  structures:[{id:'well-a',type:'well',x:100,y:100}],
  view:{scale:1}
};
const context=vm.createContext({
  window:win,Math,Map,Set,Array,Number,Object,String,State:state,WORLD:200,
  VISUAL_DAYLIGHT_RATIO:2/3,visualCycleFrac:()=>night?.8:.25,
  peasantHash:id=>[...String(id)].reduce((h,c)=>(Math.imul(h,33)+c.charCodeAt(0))>>>0,5381),
  pointBlockedForPeasant:()=>false,terrainSegmentCrossesCliff:()=>false,
  peasantSegmentClear:()=>true,findPeasantPath:()=>null,
  w2s:p=>({x:p.x,y:p.y}),clamp:(v,a,b)=>Math.min(b,Math.max(a,v)),
  withUrbanFigureOcclusion:(_p,_z,fn)=>fn(),performance:{now:()=>12345}
});
vm.runInContext(art,context,{filename:'settlement-animals.js'});
assert.ok(win.ConquerAnimals.SPECIES.wolf,'wolf SVG was transferred from animation');
assert.equal(win.ConquerAnimals.SPECIES.wolf.modes.map(m=>m[0]).join(','),
  'walk,run,howl,idle','original wolf walk/run/howl animation modes are retained');
vm.runInContext(wolvesSrc,context,{filename:'settlement-wolves.js'});
const api=win.ConquerWolves;
assert.ok(api);
assert.equal(registerCount,1,'wolves spawned once around founded settlement');
assert.equal(wolves.length,4,'pack contains four wolves');
assert.equal(new Set(wolves.map(w=>w.id)).size,4);
assert.ok(wolves.every(w=>w.kind==='wolf'&&w.combatKind==='wolf'&&w.faction==='wildlife'));
assert.ok(wolves.every(w=>w.neutral),'daytime wolves are neutral');
assert.ok(wolves.every(w=>Math.hypot(w.x-100,w.y-100)>=14),'wolves spawn outside yellow territory');
api.ensure();assert.equal(registerCount,1,'subsequent render must not respawn pack');
api.tick(.25);
assert.ok(wolves.every(w=>w.neutral),'daytime roaming does not turn wolves hostile');
night=true;api.ensure();
assert.ok(wolves.every(w=>!w.neutral),'transition to night enables hostility');
const hunter=wolves[0];
soldiers.push({id:'patrol',kind:'patrol',x:hunter.x+3,y:hunter.y,defeated:false});
const before=Math.hypot(hunter.x-soldiers[0].x,hunter.y-soldiers[0].y);
for(let i=0;i<8;i++)api.tick(.25);
const after=Math.hypot(hunter.x-soldiers[0].x,hunter.y-soldiers[0].y);
assert.ok(after<before-.4,'wolf actually advances toward an approaching patrol at night');
assert.equal(hunter.wolfState,'hunting','wolf actively hunts patrols at night');
assert.equal(hunter.wolfTargetId,'patrol');
const savedWolf=hunter;
api.ensure();assert.equal(wolves[0],savedWolf,'day/night updates do not replace persisted wolf entities');
night=false;api.ensure();api.tick(.25);
assert.ok(wolves.every(w=>w.neutral),'sunrise resets combat hostility');
assert.ok(wolves.every(w=>w.wolfTargetId===null),'wolves stop targeting troops in daylight');
win.ConquerAnimals.drawAnimal=(...args)=>artCalls.push(args);
api.draw({},hunter);
assert.equal(artCalls[0][0],'wolf','render uses imported animated wolf, not infantry placeholder');
assert.ok(['walk','idle','howl','run'].includes(artCalls[0][5].mode));
assert.match(combatSrc,/if\(intruder\.neutral\|\|intruder\.defeated/,'neutral wolves never trigger settlement alert');
assert.match(combatSrc,/if\(e\.neutral\|\|e\.defeated/,'neutral wolves do not appear as enemy contacts');
assert.match(rulesSrc,/if\(!living\(b\)\|\|b\.routing\|\|b\.neutral/,'melee ignores neutral creatures');
assert.match(rulesSrc,/if\(!living\(e\)\|\|e\.routing\|\|e\.neutral/,'archers ignore neutral creatures');
// Exercise the real combat rules so a wolf is inert by day, a melee target
// at night. These checks don't depend on random dice damage.
const ctx=vm.createContext({window:{},Math});
vm.runInContext(rulesSrc,ctx,{filename:'settlement-combat-rules.js'});
const rules=ctx.window.ConquerCombatRules;
assert.equal(rules.PROFILES.wolf.hp,12,'wolves have their own combat profile');
const trooper={id:'guard',kind:'patrol',x:0,y:0,target:{x:1,y:1}};
const beast={id:'test-wolf',kind:'wolf',combatKind:'wolf',x:.6,y:0,neutral:true};
rules.update(.25,[trooper],[beast],[],()=>true);
assert.equal(trooper.engaged,false,'wolf causes no melee engagement while neutral');
beast.neutral=false;
rules.update(.25,[trooper],[beast],[],()=>true);
assert.equal(trooper.engaged,true,'hostile wolf enters melee contact at night');
assert.equal(beast.engaged,true,'wolf becomes a real target in melee');
console.log('PASS imported wolf SVG, stable spawning, daytime neutral, nocturnal hunt/melee, dawn release');
