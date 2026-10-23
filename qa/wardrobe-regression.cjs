'use strict';
// Seasonal wardrobe: rain gear in wet weather, class cloaks and hoods in winter,
// straw hats in summer, staggered shoulder months, deterministic per resident,
// and every piece draws over the villager figure without errors.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const calls={fill:0,stroke:0};
const ctx2d=new Proxy({},{get:(o,k)=>k in calls?()=>{calls[k]++}:k in o?o[k]:()=>{},set:(o,k,v)=>{o[k]=v;return true}});
const State={season:'summer',seasonOverride:null,clock:{day:10}};
const window={};
let weather={kind:'clear'},month=6;
const sandbox={window,State,Math,Number,String,Object,Array,ctx:ctx2d,
  currentWeather:()=>weather,calendarDateFromDay:()=>({month})};
const context=vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname,'..','src','settlement-wardrobe.js'),'utf8'),context);
const W=window.ConquerWardrobe;

const KINDS=['peasant','artisan','merchant'];
const crowd=Array.from({length:300},(_,i)=>({id:'r'+i,kind:KINDS[i%3],colors:['#8c6b3f','#5d4a32']}));
const dress=c=>crowd.map(d=>W.outfitFor(d,c));
const share=(list,fn)=>list.filter(fn).length/list.length;

// Every catalogue piece has a slot, a label, a trigger and colours.
for(const [k,p] of Object.entries(W.PIECES)){
  assert.ok(['head','body','neck'].includes(p.slot),k+' slot');
  assert.ok(p.label&&p.when&&p.palette.length,k+' catalogue entry');
}
console.log('PASS '+Object.keys(W.PIECES).length+' catalogue pieces');

// Rain dresses everyone, in any season, and replaces cold/sun pieces.
for(const season of ['spring','summer','autumn'])for(const kind of ['rain','storm']){
  const o=dress(W.fromKind(season,kind));
  assert.ok(o.every(x=>x&&x.body==='rainCape'&&x.head==='rainHood'),season+' '+kind+' -> rain gear');
}
console.log('PASS rain and storm put on cape and hood');

// Winter: every resident wears the cloak of their class and covers the head.
const winter=dress(W.fromKind('winter','clear'));
crowd.forEach((d,i)=>{
  const o=winter[i];
  assert.equal(o.body,{peasant:'sheepskin',artisan:'woolCloak',merchant:'furCloak'}[d.kind],'class cloak');
  assert.ok(['woolHood','furCap'].includes(o.head),'winter headgear');
  assert.equal(o.sleeve,o.colors.body,'sleeve follows the cloak');
});
const caps=share(winter,o=>o.head==='furCap');
assert.ok(caps>.3&&caps<.7,'winter mixes caps and hoods: '+caps);
assert.ok(dress(W.fromKind('winter','snow')).every(o=>o.head==='woolHood'),'snow: hoods up');
console.log('PASS winter cloaks by class, caps and hoods; hoods in snow');

// Summer sun: straw hats, more among peasants than merchants; none in fog.
const summer=dress(W.fromKind('summer','clear'));
const hat=k=>share(summer.filter((_,i)=>crowd[i].kind===k),o=>o?.head==='strawHat');
assert.ok(hat('peasant')>hat('artisan')&&hat('artisan')>hat('merchant')&&hat('merchant')>0,'hat shares by class');
assert.ok(summer.every(o=>!o||!o.body),'no cloaks in summer');
assert.ok(dress(W.fromKind('summer','fog')).every(o=>!o||o.head!=='strawHat'),'no straw hats in fog');
console.log('PASS summer straw hats by class');

// Windy shoulder seasons: some shawls, never in summer.
const shawls=share(dress(W.fromKind('autumn','wind')),o=>o?.neck==='shawl');
assert.ok(shawls>.25&&shawls<.65,'autumn wind shawls: '+shawls);
assert.equal(share(dress(W.fromKind('summer','wind')),o=>o?.neck==='shawl'),0,'no shawls in summer');
console.log('PASS shawls in windy mid-seasons');

// Shoulder months: November dresses part of the town; December all of it.
const nov=share(dress(W.fromKind('autumn','clear',10)),o=>o?.body);
assert.ok(nov>.25&&nov<.65,'November partial: '+nov);
assert.equal(share(dress(W.fromKind('winter','clear',11)),o=>o?.body),1,'December: everyone');
// Monotonic: whoever wears winter clothes in November still does in December.
const n=dress(W.fromKind('autumn','clear',10)),d=dress(W.fromKind('winter','clear',11));
assert.ok(n.every((o,i)=>!o?.body||d[i]?.body),'no one takes the cloak off going into winter');
console.log('PASS staggered shoulder months');

// Live conditions: calendar month, DEV season override, weather; deterministic.
State.season='autumn';month=10;weather={kind:'clear'};State.clock.day=40;
assert.equal(W.conditions().month,10);
State.seasonOverride='winter';State.season='winter';State.clock.day=41;
assert.equal(W.conditions().month,null,'forced season ignores the calendar');
assert.equal(share(crowd.map(x=>W.outfitFor(x)),o=>o?.body),1,'forced winter dresses everyone');
State.seasonOverride=null;State.season='spring';month=3;weather={kind:'rain'};State.clock.day=42;
assert.ok(crowd.every(x=>W.outfitFor(x).body==='rainCape'),'live rain');
assert.deepEqual(W.outfitFor(crowd[5]),W.outfitFor(crowd[5]),'deterministic');
W.preview={season:'winter',weather:'snow'};
assert.equal(W.outfitFor(crowd[0]).head,'woolHood','lab preview overrides the live weather');
W.preview=null;
assert.equal(W.outfitFor({...crowd[0],outfit:null}),null,'explicit outfit wins');
console.log('PASS live conditions, overrides and determinism');

// Class palettes (settlement-core.js) dye the cloth pieces; the lab keeps an exact copy.
const core=fs.readFileSync(path.join(__dirname,'..','src','settlement-core.js'),'utf8');
const lab=fs.readFileSync(path.join(__dirname,'..','figures-lab.html'),'utf8');
const palettes={};
for(const name of ['PEASANT','ARTISAN','MERCHANT','ELITE']){
  const re=new RegExp('const '+name+'_PALETTE=(?:Object\\.freeze\\()?(\\[[^\\]]*\\])');
  const fromCore=JSON.parse(re.exec(core)[1].replace(/'/g,'"')),fromLab=JSON.parse(re.exec(lab)[1].replace(/'/g,'"'));
  assert.deepEqual(fromLab,fromCore,name+' palette: lab copy matches core');
  palettes[name]=fromCore;
}
const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
const sat=h=>{const c=rgb(h),mx=Math.max(...c),mn=Math.min(...c);return mx?(mx-mn)/mx:0};
const avgSat=list=>list.reduce((s,h)=>s+sat(h),0)/list.length;
assert.ok(avgSat(palettes.PEASANT)<.2,'L1 grey/beige: low saturation');
assert.ok(avgSat(palettes.ELITE)>avgSat(palettes.MERCHANT)+.25,'L4 brighter than L3');
assert.ok(avgSat(palettes.MERCHANT)>avgSat(palettes.PEASANT),'L3 more coloured than L1');
// Dye: with the palettes loaded, cloth comes from the wearer's class, natural materials do not.
Object.assign(context,{PEASANT_PALETTE:palettes.PEASANT,ARTISAN_PALETTE:palettes.ARTISAN,MERCHANT_PALETTE:palettes.MERCHANT,ELITE_PALETTE:palettes.ELITE});
const darkenHex=(h,k)=>'#'+rgb(h).map(v=>Math.round(v*k).toString(16).padStart(2,'0')).join('');
for(const [kind,list] of [['peasant',palettes.PEASANT],['artisan',palettes.ARTISAN],['merchant',palettes.MERCHANT],['elite',palettes.ELITE]]){
  for(let i=0;i<20;i++){
    const id=kind+i,tunic=list[0];
    const hood=W.compose(['woolHood'],id,kind,tunic).colors.head;
    assert.ok(list.includes(hood),kind+' wool hood dyed from class palette');
    assert.notEqual(hood,tunic,kind+' hood differs from the tunic');
    assert.ok(list.map(c=>darkenHex(c,.72)).includes(W.compose(['rainCape'],id,kind,tunic).colors.body),kind+' rain cape: darkened class colour');
    assert.ok(W.PIECES.strawHat.palette.includes(W.compose(['strawHat'],id,kind,tunic).colors.head),'straw stays straw');
  }
}
assert.equal(W.outfitFor({id:'e1',kind:'elite',colors:['#d83a2e','#2f6fd6']},W.fromKind('winter','clear')).body,'furCloak','L4 fur cloak');
console.log('PASS class palettes L1 grey/beige, L2 green/brown, L3 muted, L4 bright; cloth dyed by class');

// Every piece draws, on adults and tiny figures.
for(const k of Object.keys(W.PIECES))for(const s of [.5,3]){
  calls.fill=0;
  const o=W.compose([k],'x');
  W.drawBody(o,crowd[0],0,0,6*s,8*s);W.drawHead(o,0,-6*s,2.35*s);
  assert.ok(calls.fill>0,k+' draws at scale '+s);
}
console.log('PASS every piece draws');
