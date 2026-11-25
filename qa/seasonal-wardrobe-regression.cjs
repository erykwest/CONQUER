'use strict';
// Seasonal wardrobe x calendar: the commoners' clothes follow the in-game calendar at runtime.
// The real calendar (settlement-app-calendar-ui.js: calendarDateFromDay, seasonForMonth,
// syncSeasonToCalendar) advances a full year day by day; the same resident objects, never
// respawned, are dressed every day through the live conditions (no explicit month), and:
// - State.season walks summer -> autumn -> winter -> spring as the months turn;
// - the share in cloaks follows the month (all in Dec-Feb, none Apr-Oct, part of the town in
//   the shoulder months March and November), straw hats only around summer;
// - every resident's outfit changes between January and July (the change is live, not at spawn);
// - every trade whose work clothes leave a slot free fills it for the season, the others keep
//   their work clothes (trade first); the L4 ladies swap headdress for furs;
// - the DEV season override and the weather still win over the calendar;
// - the festival / joust crowds dress through the same wardrobe, and every 3D card key that
//   caches a commoner carries the outfit, so a change of month repaints it.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const src=f=>fs.readFileSync(path.join(__dirname,'..','src',f),'utf8');

let weather={kind:'clear'},invalidations=0;
const State={seed:9,structures:[],season:'summer',seasonOverride:null,clock:{day:0,speed:0},view:{scale:2}};
const window={};
const draws={body:0,head:0};
const sandbox={window,State,Math,Number,String,Object,Array,Map,Set,JSON,Float32Array,performance:{now:()=>0},console,
  ctx:new Proxy({},{get:(o,k)=>k in o?o[k]:()=>{},set:(o,k,v)=>{o[k]=v;return true}}),
  document:{querySelectorAll:()=>[]},invalidateSceneCache:()=>{invalidations++},autumnFoliageStep:()=>-1,
  currentWeather:()=>weather,
  // Figure painters used by the event crowd (settlement-population-figures.js in the game).
  w2s:p=>({x:p.x,y:p.y}),drawSplitVillagerBody:()=>{},drawVillagerHead:()=>{},villagerHair:()=>'brown'};
const context=vm.createContext(sandbox);
const run=(code,name)=>vm.runInContext(code,context,{filename:name});
for(const f of ['settlement-util.js','settlement-wardrobe.js','assets/scatter-model.js','assets/civic-models.js','assets/event-models.js',
  'settlement-mesh3d.js','settlement-events3d.js','settlement-events-people.js'])run(src(f),f);
// The calendar block of the calendar UI (the rest of the file wires the DOM).
const calendarSrc=src('settlement-app-calendar-ui.js');
const calendarEnd=calendarSrc.indexOf('function syncDevButtons');
assert.ok(calendarEnd>0,'calendar block found');
run(calendarSrc.slice(0,calendarEnd),'settlement-app-calendar-ui.js');
const W=window.ConquerWardrobe;
assert.ok(W&&typeof context.syncSeasonToCalendar==='function','wardrobe and calendar loaded');

// The town: the same objects all year, as the population pass rebuilds them from the residents.
const KINDS=['peasant','artisan','merchant','elite'];
const crowd=Array.from({length:400},(_,i)=>({id:'r'+i,kind:KINDS[i%4],sex:i%8<4?'male':'female',age:i%5?'adult':'child',colors:['#8c6b3f','#5d4a32']}));
const commoners=crowd.filter(d=>!W.isLady(d));
const workers=Object.keys(W.ROLES).map(role=>({id:'w-'+role,kind:'artisan',role,colors:['#8c6b3f','#5d4a32']}));
const ladies=crowd.filter(d=>W.isLady(d));

// ---- A year, day by day, through the real calendar.
const byMonth=Array.from({length:12},()=>({days:0,seasons:new Set(),cloak:0,hat:0,n:0}));
const january=new Map(),july=new Map(),seasonsSeen=[];
const share=(list,fn)=>list.filter(fn).length/list.length;
for(let day=0;day<365;day++){
  State.clock.day=day+.5;
  context.syncSeasonToCalendar();
  const {month}=context.calendarDateFromDay();
  assert.equal(State.season,context.seasonForMonth(month),'day '+day+': the season follows the calendar');
  if(seasonsSeen[seasonsSeen.length-1]!==State.season)seasonsSeen.push(State.season);
  const c=W.conditions();
  assert.equal(c.month,month,'day '+day+': the wardrobe reads the calendar month');
  assert.equal(c.season,State.season,'day '+day+': the wardrobe reads the live season');
  const outfits=commoners.map(d=>W.outfitFor(d));
  const m=byMonth[month];m.days++;m.seasons.add(State.season);
  m.cloak+=share(outfits,o=>!!o?.body);m.hat+=share(outfits,o=>o?.head==='strawHat');
  if(month===0&&!january.size)for(const d of [...crowd,...workers])january.set(d.id,JSON.stringify(W.outfitFor(d)));
  if(month===6&&!july.size)for(const d of [...crowd,...workers])july.set(d.id,JSON.stringify(W.outfitFor(d)));
}
// Day 0 is 1 June: the year walks summer, autumn, winter, spring.
assert.deepEqual(seasonsSeen,['summer','autumn','winter','spring'],'all four seasons in calendar order');
assert.ok(invalidations>=3,'each change of season invalidates the scene');
console.log('PASS the calendar walks summer -> autumn -> winter -> spring and the wardrobe reads its month');

const avg=(m,k)=>byMonth[m][k]/byMonth[m].days;
for(const m of [11,0,1])assert.equal(avg(m,'cloak'),1,'month '+m+': everyone in winter clothes');
for(const m of [3,4,5,6,7,8,9])assert.equal(avg(m,'cloak'),0,'month '+m+': no cloaks');
for(const m of [2,10])assert.ok(avg(m,'cloak')>.25&&avg(m,'cloak')<.65,'shoulder month '+m+' dresses part of the town: '+avg(m,'cloak'));
for(const m of [5,6,7])assert.ok(avg(m,'hat')>.3,'month '+m+': straw hats in summer '+avg(m,'hat'));
for(const m of [4,8])assert.ok(avg(m,'hat')>0&&avg(m,'hat')<avg(6,'hat'),'month '+m+': fewer straw hats at the edges of summer');
for(const m of [0,1,2,3,9,10,11])assert.equal(avg(m,'hat'),0,'month '+m+': no straw hats');
console.log('PASS cloaks Dec-Feb, part of the town in March and November, straw hats May-September');

// Live, not at spawn: the very same objects change clothes between January and July.
for(const d of commoners)assert.notEqual(january.get(d.id),july.get(d.id),d.id+' ('+d.kind+') changes clothes with the season');
for(const d of ladies){
  const jan=JSON.parse(january.get(d.id)),jul=JSON.parse(july.get(d.id)||'null');
  assert.equal(jan.body,'ladyFur',d.id+': a lady in furs in January');
  assert.ok(!jul||jul.body!=='ladyFur',d.id+': no furs in July');
}
console.log('PASS '+commoners.length+' commoners and '+ladies.length+' ladies change clothes at runtime');

// Trades: the work clothes come first; a free body or head slot dresses for the season.
let filled=0;
for(const w of workers){
  const R=W.ROLES[w.role],slots=new Set(R.pieces.map(p=>(W.ROLE_PIECES[p]||W.PIECES[p]).slot));
  const jan=JSON.parse(january.get(w.id)),jul=JSON.parse(july.get(w.id));
  for(const p of R.pieces){const s=(W.ROLE_PIECES[p]||W.PIECES[p]).slot;assert.equal(jan[s],p,w.role+': '+p+' kept in January');assert.equal(jul[s],p,w.role+': '+p+' kept in July')}
  if(!slots.has('body')){assert.ok(W.PIECES[jan.body],w.role+': the free body slot takes a winter cloak');filled++}
  else if(!slots.has('head')){assert.ok(['woolHood','furCap'].includes(jan.head),w.role+': the free head slot takes winter headgear');filled++}
}
assert.ok(filled>=5,'several trades fill a free slot for the season: '+filled);
console.log('PASS '+workers.length+' trades keep their work clothes; '+filled+' fill a free slot for winter');

// The DEV season override and the weather win over the calendar.
State.clock.day=40.5;context.syncSeasonToCalendar();                           // July
State.seasonOverride='winter';context.syncSeasonToCalendar();
assert.equal(State.season,'winter');assert.equal(W.conditions().month,null,'forced season ignores the calendar month');
assert.equal(share(commoners.map(d=>W.outfitFor(d)),o=>!!o?.body),1,'forced winter in July: everyone in cloaks');
State.seasonOverride=null;context.syncSeasonToCalendar();
assert.equal(State.season,'summer','the calendar takes over again');
weather={kind:'rain'};State.clock.day=41.5;
assert.ok(commoners.every(d=>W.outfitFor(d).body==='rainCape'),'rain in July: rain capes');
weather={kind:'clear'};
console.log('PASS the DEV season override and the weather win over the calendar');

// Festival and joust crowds dress through the same wardrobe.
const H=window.ConquerEventPeople.helpers;
for(const k of ['drawBody','drawHead']){const f=W[k];W[k]=(...a)=>{draws[k==='drawBody'?'body':'head']++;return f(...a)}}
State.clock.day=230.5;context.syncSeasonToCalendar();                           // mid January
assert.equal(State.season,'winter');
const fans=Array.from({length:40},(_,i)=>({id:'fan'+i,kind:H.KINDS[i%H.KINDS.length],colors:H.TUNICS[i%H.TUNICS.length]}));
const winterKeys=fans.map(f=>H.outfitKey(f.id,f.kind,f.colors));
assert.ok(fans.every(f=>H.crowdOutfit(f.id,f.kind,f.colors)?.body),'the crowd wears cloaks in January');
draws.body=draws.head=0;
H.figureAt({x:0,y:0},0,'fan0','peasant',H.TUNICS[0],0);
assert.ok(draws.body>0&&draws.head>0,'the crowd figure paints the outfit');
draws.body=0;H.figureAt({x:0,y:0},0,'fan0','peasant',H.TUNICS[0],0,false);
assert.equal(draws.body,0,'players keep their motley');
State.clock.day=40.5;context.syncSeasonToCalendar();                            // July
assert.ok(fans.every((f,i)=>H.outfitKey(f.id,f.kind,f.colors)!==winterKeys[i]),'the crowd card key changes with the season');
console.log('PASS festival crowds dress for the season, players keep their costume');

// Every 3D card that caches a commoner keys on the outfit (the figure atlas keeps tiles by key).
const has=(f,re,msg)=>assert.match(src(f),re,msg);
has('settlement-population-figures.js',/function villagerLookKey[\s\S]{0,200}outfitFor\(dot\)[\s\S]{0,200}JSON\.stringify\(outfit\)/,'residents: villagerLookKey carries the outfit');
assert.ok(src('settlement-work-anim.js').includes("'w|'+tool+'|'+q.b+(dot.seated?'|s':'')+'|'+look(dot)"),'workers: card key carries villagerLookKey (and the seated pose)');
has('settlement-ship-crew.js',/villagerLookKey\(d\)/,'sailors: card key carries villagerLookKey');
has('settlement-vehicles.js',/villagerLookKey\(dot\)/,'carters: card key carries villagerLookKey');
has('settlement-events-people.js',/'ev\|'[^\n]*outfitKey\(a\.id,kind,c\)/,'festival crowd: card key carries the outfit');
has('settlement-events-joust.js',/'jo\|sp\|'[^\n]*outfitKey\(q\.id,kind,c\)/,'joust spectators: card key carries the outfit');
has('settlement-events-joust.js',/'jo\|sq\|'[^\n]*outfitKey\(q\.id,'peasant',c\)/,'joust squires: card key carries the outfit');
has('settlement-court-people.js',/const key='court\|'[^\n]*\+look;/,'court and church staff: card key carries the outfit');
console.log('PASS every commoner card key carries the outfit, so a change of month repaints it');
