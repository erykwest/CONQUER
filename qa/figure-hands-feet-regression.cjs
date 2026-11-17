'use strict';
// FIG-HANDS-261117: civilians, workers, soldiers (still and posed), nobles and mounted riders
// get pink outlined hands; foot figures get brown oval feet. Counts the fills painted in the
// hand and foot colours with a recording 2D context.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const HAND='#e8a58f',FOOT='#5a3c25';
let fills=[];
function recorder(){
  const o={fillStyle:'#000',strokeStyle:'#000',lineWidth:1,globalAlpha:1,lineCap:'butt',lineJoin:'miter',globalCompositeOperation:'source-over'};
  return new Proxy(o,{get:(t,k)=>k==='fill'?()=>fills.push(t.fillStyle):k==='fillRect'?()=>fills.push('rect:'+t.fillStyle):k in t?t[k]:()=>{},set:(t,k,v)=>{t[k]=v;return true}});
}
const State={view:{scale:4},heraldry:{},policies:{}};
const window={};
const sandbox={window,State,Math,Number,String,Object,Array,Map,Set,JSON,performance:{now:()=>0},console,
  ctx:recorder(),VILLAGER_SKIN:'#d99a83',HAIR_COLORS:{brown:'#65452f'},REIGN_COLOR_1:'#b53636',REIGN_COLOR_2:'#355fb8',
  REIGN_COLOR_1_DARK:'#7f2323',REIGN_COLOR_2_DARK:'#243f79',
  w2s:p=>({x:p.x,y:p.y}),w2sRaw:p=>({x:p.x,y:p.y}),terrainElevation:()=>0,withProjectionGroundZ:(z,fn)=>fn(),
  withUrbanFigureOcclusion:(p,z,fn)=>fn(),villagerHair:()=>'brown',
  peasantHash:s=>{let h=2166136261;for(const c of String(s)){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}};
const context=vm.createContext(sandbox);
for(const f of ['settlement-util.js','settlement-wardrobe.js','settlement-population-figures.js','settlement-combat-anim.js','settlement-work-anim.js'])
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..','src',f),'utf8'),context,{filename:f});
const run=src=>vm.runInContext(src,context);
const count=fn=>{fills=[];fn();return{hands:fills.filter(c=>c===HAND).length,feet:fills.filter(c=>c===FOOT).length}};
const dot='({id:"v1",kind:"peasant",sex:"male",age:"adult",hair:"brown",colors:["#8f8b82","#b4a58a"],p:{x:50,y:50}})';

// Civilians: two hands at the sides, two feet, for every class shape and for children.
for(const kind of ['peasant','artisan','merchant','elite'])
  assert.deepEqual(count(()=>run('drawVillagerFigureUnmasked({...'+dot+',kind:"'+kind+'"})')),{hands:2,feet:2},kind+' has two hands and two feet');
assert.deepEqual(count(()=>run('drawVillagerFigureUnmasked({...'+dot+',age:"child"})')),{hands:2,feet:2},'children too');
// L4 ladies: disc and bell skirt are one shape down to the ground; shoe tips under the hem, hands on the disc rim.
assert.equal(run('villagerShape({kind:"elite",sex:"female"})'),'lady');
assert.equal(run('villagerShape({kind:"elite",sex:"male"})'),'elite');
assert.ok(run('villagerBodyBottom("lady",0,6,8)')>run('villagerBodyBottom("elite",0,6,8)')+1,'the gown reaches below the disc');
assert.deepEqual(count(()=>run('drawVillagerFigureUnmasked({...'+dot+',kind:"elite",sex:"female"})')),{hands:2,feet:2},'L4 lady');
const rim=run('villagerSideHand("lady",0,0,6,8,1,1)');
assert.ok(Math.abs(Math.hypot(rim.x,rim.y)-3.2)<.2,'lady hand sits on the disc rim');
assert.deepEqual(count(()=>run('drawVillagerFigureUnmasked('+dot+',"far",1)')),{hands:1,feet:2},'far hand only');
assert.deepEqual(count(()=>run('drawVillagerFigureUnmasked('+dot+',"none")')),{hands:0,feet:2},'no hand (seed bag side)');
console.log('PASS civilians: two hands, two feet; workers keep only the far hand');

// Workers: the near hand at the tool plus the far one; the sower has only the hand that casts.
const WA=run('window.ConquerWorkAnim');
for(const tool of Object.keys(WA.TOOLS))for(const f of [1,-1]){
  const c=count(()=>run('window.ConquerWorkAnim.drawWorkerUnmasked('+dot+',"'+tool+'",.4,'+f+')'));
  assert.deepEqual(c,{hands:tool==='seeds'?1:2,feet:2},tool+' worker facing '+f+': hands at the tool and at the side');
}
assert.deepEqual(count(()=>run('window.ConquerWorkAnim.drawCarrierUnmasked('+dot+',"axe",1)')),{hands:2,feet:2},'carrier steadies the tool');
console.log('PASS '+Object.keys(WA.TOOLS).length+' work tools: hand on the tool, free hand at the side, feet');

// Soldiers standing: spear (shaft + free hand), bow (grip + string), sword (grip, shield hides the other),
// axe (haft), unarmed (both at the sides).
const still={spearman:2,archer:2,knight:1,axeman:1,unarmed:2};
for(const [type,hands] of Object.entries(still))
  assert.deepEqual(count(()=>run('drawSoldierFigureUnmasked({x:50,y:50},0,"'+type+'","s1",0,null)')),{hands,feet:2},type+' standing');
assert.deepEqual(count(()=>run('drawNobleFigure({x:50,y:50},0,"n1",0)')),{hands:2,feet:2},'noble in the keep');
console.log('PASS standing soldiers and nobles');

// Combat poses: the same hands follow the weapon through guard, blow and fall, never doubled.
const pose='({dirX:1,dirY:0,attack:A,flash:0,ready:R,bob:0,fall:F,alpha:1,blood:0,spray:0})';
for(const [type,hands] of Object.entries({spearman:2,archer:2,knight:1,axeman:1}))
  for(const [A,R,F] of [[0,0,0],[0,1,0],[-1,1,0],[1,1,0],[0,0,.5],[0,0,1]])
    assert.deepEqual(count(()=>run('window.ConquerCombatAnim.drawFigure({x:50,y:50},0,"'+type+'","c1",0,null,'+pose.replace('A',A).replace('R',R).replace('F',F)+')')),
      {hands,feet:2},type+' pose a='+A+' r='+R+' f='+F);
console.log('PASS combat poses keep one hand per weapon grip and two feet');

// Far zoom: hands and feet are below a pixel and are skipped.
State.view.scale=.2;
assert.deepEqual(count(()=>run('drawVillagerFigureUnmasked('+dot+')')),{hands:0,feet:0},'skipped when tiny');
assert.deepEqual(count(()=>run('drawSoldierFigureUnmasked({x:50,y:50},0,"spearman","s1",0,null)')),{hands:0,feet:0},'skipped when tiny (soldier)');
State.view.scale=4;
console.log('PASS far zoom skips sub-pixel hands and feet');

// L4 ladies: medieval headdresses, never the town's hats and hoods; furs in winter; one-colour gown.
const Wd=run('window.ConquerWardrobe'),LADY=Object.keys(Wd.LADY_PIECES);
const ladyDot=i=>({id:'lady'+i,kind:'elite',sex:'female',age:'adult',colors:['#d83a2e','#2f6fd6']});
const seen=new Set();
for(const [weather,season,expectBody] of [['clear','summer',null],['wind','spring',null],['rain','summer','ladyMantle'],['snow','winter','ladyFur'],['clear','winter','ladyFur']])
  for(let i=0;i<40;i++){
    const o=Wd.outfitFor(ladyDot(i),Wd.fromKind(season,weather));
    for(const slot of ['head','body','neck'])if(o&&o[slot]){assert.ok(LADY.includes(o[slot]),'lady wears '+o[slot]+' ('+weather+')');seen.add(o[slot])}
    if(expectBody)assert.equal(o.body,expectBody,'lady body in '+weather+'/'+season);
  }
for(const k of ['hennin','horned','crespine','balzo','coronet','veil','furToque','ladyFur','ladyMantle'])assert.ok(seen.has(k),k+' is dealt out');
assert.equal(Wd.outfitFor({id:'m1',kind:'elite',sex:'male',age:'adult',colors:['#d83a2e','#2f6fd6']},Wd.fromKind('winter','snow')).body,'furCloak','L4 men keep the fur cloak');
// One-colour gown: the body fill uses the first colour only.
fills=[];run('drawVillagerFigureUnmasked({id:"g1",kind:"elite",sex:"female",age:"adult",hair:"brown",colors:["#111111","#222222"],outfit:null,p:{x:50,y:50}})');
assert.ok(fills.includes('rect:#111111')&&!fills.includes('rect:#222222'),'lady gown is one colour');
fills=[];run('drawVillagerFigureUnmasked({id:"g2",kind:"elite",sex:"male",age:"adult",hair:"brown",colors:["#111111","#222222"],outfit:null,p:{x:50,y:50}})');
assert.ok(fills.includes('rect:#222222'),'L4 men keep the two-tone tunic');
console.log('PASS L4 ladies: headdresses and furs of their own, one-colour gown');

// Mounted riders keep their legs and boots; their hands are the same pink.
const mounted=fs.readFileSync(path.join(__dirname,'..','src','settlement-mounted2d.js'),'utf8');
assert.match(mounted,/HAND='#e8a58f'/,'mounted riders use the hand colour');
assert.match(mounted,/hand\(ctx,L\.grip\[0\]-4,L\.grip\[1\]\+2,lw\)/,'knight hand on the lance');
assert.match(mounted,/hand\(ctx,150,64,o\.lw\)/,'messenger hand on the reins');
assert.match(mounted,/function legs\(ctx,o\)\{\s*const c=o\.kind==='knight'\?MAIL:CLOTH;\s*limb\(/,'riders keep their legs');
console.log('PASS mounted riders: pink hands, legs kept');
