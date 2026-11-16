'use strict';
// Threat generator: daily rolls shaped by the settlement, difficulty, grace
// period, cooldowns, caps, winter rules, determinism, catch-up, warnings.
// Runs the real settlement-threats.js against doubles of fauna and outlaws.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const src=read('src/settlement-threats.js');

const html=read('index.html');
assert.ok(html.indexOf('settlement-outlaws.js')<html.indexOf('settlement-threats.js'),'threats load after the modules they drive');
assert.match(read('src/settlement-combat.js'),/ConquerThreats\?\.tick\(dt\)/,'combat ticks the generator');
assert.match(read('src/settlement-outlaws.js'),/ConquerThreats\?\.ended\?\./,'outlaw bands report their end');
assert.doesNotMatch(read('src/settlement-outlaws.js'),/function schedule\(/,'outlaws no longer keep their own calendar');

function world({seed=4242,difficulty='normal',winter=false,gold=300,founded=true}={}){
  let threats=null;const spawned=[],messages=[];
  const active={brigands:false,bandits:false,raiders:false},lastEnded={};
  let packs=0,bears=0;
  const State={seed,clock:{day:0},view:{x:0,y:0,scale:1},dirty:false,
    village:{founded,wellId:'w'},structures:[{id:'w',type:'well',x:100,y:100}],environment:[{type:'forest'}]};
  const win={
    ConquerCombat:{threatState:()=>threats||(threats={version:1,difficulty,lastDay:null,foundedDay:null,last:{},log:[]}),enemy:()=>[]},
    ConquerEconomy:{state:()=>({castleGold:gold,castle:{food:200,wood:200}}),population:()=>({L1:20,L2:6})},
    ConquerWolves:{census:()=>({packs,bears}),
      spawnPack:({size})=>{packs++;spawned.push({type:'wolves',size,day:State.clock.day});return{center:{x:60,y:60},size}},
      spawnBear:()=>{bears++;spawned.push({type:'bear',day:State.clock.day});return{center:{x:150,y:60}}}},
    ConquerOutlaws:{TYPES:{brigands:{size:[4,6]},bandits:{size:[4,6]},raiders:{size:[5,8]}},
      feasible:t=>!active[t],active:t=>active[t],lastEnded:t=>lastEnded[t]??null,
      spawn:(t,{size})=>{active[t]=true;spawned.push({type:t,size,day:State.clock.day});
        return{id:t+spawned.length,edge:'north',post:{x:100,y:40},center:{x:140,y:50},entry:{x:100,y:3}}}}
  };
  const ctx=vm.createContext({window:win,Math,Object,Number,String,Array,JSON,console,State,
    calendarDateFromDay:d=>({month:winter?0:Math.floor(((d+151)%365)/30.5)}),
    seasonForMonth:m=>m===11||m<=1?'winter':m<=4?'spring':m<=7?'summer':'autumn',
    underConstruction:()=>false,status:t=>messages.push(t),setTimeout:()=>0,clearTimeout:()=>{}});
  vm.runInContext(src,ctx,{filename:'settlement-threats.js'});
  const api=win.ConquerThreats;
  const advance=days=>{for(let i=0;i<days;i++){State.clock.day+=1;api.tick(.1)}};
  return{api,State,spawned,messages,active,lastEnded,advance,state:()=>threats,
    kill:t=>{if(t==='wolves')packs=Math.max(0,packs-1);else if(t==='bear')bears=0;else active[t]=false}};
}

// Nothing before founding; the first tick only anchors the calendar.
{
  const w=world({founded:false});w.advance(50);
  assert.equal(w.spawned.length,0,'no threats before the village is founded');
}
{
  const w=world();w.api.tick(.1);
  assert.equal(w.state().foundedDay,0);assert.equal(w.state().lastDay,0);
}
// Grace period: no outlaws in the first days after founding.
{
  const w=world({difficulty:'hard'});w.api.tick(.1);w.advance(4);
  assert.ok(w.spawned.every(s=>s.type==='wolves'||s.type==='bear'),'only wildlife in the first days');
  const why=w.api.explain('raiders').why;assert.equal(why,'periodo di grazia');
}
// At most one new threat per day; deterministic per seed.
{
  const a=world(),b=world();a.api.tick(.1);b.api.tick(.1);
  // Free the bands as they appear, so every day can roll everything.
  for(let d=0;d<300;d++){a.advance(1);b.advance(1);for(const k of ['brigands','bandits','raiders']){a.kill(k);b.kill(k)}}
  const perDay=new Map();for(const s of a.spawned)perDay.set(s.day,(perDay.get(s.day)||0)+1);
  assert.ok([...perDay.values()].every(n=>n===1),'never two threats on the same day');
  assert.deepEqual(a.spawned,b.spawned,'same seed, same events');
  const kinds=new Set(a.spawned.map(s=>s.type));
  for(const t of ['wolves','bear','brigands','bandits','raiders'])assert.ok(kinds.has(t),'over a long game every kind appears: '+t);
  const c=world({seed:99});c.api.tick(.1);c.advance(300);
  assert.notDeepEqual(c.spawned.map(s=>s.day+s.type),a.spawned.map(s=>s.day+s.type),'another seed, another story');
}
// Difficulty: frequency, band size and wolf-pack cap.
{
  const count=d=>{const w=world({difficulty:d});w.api.tick(.1);
    for(let i=0;i<365;i++){w.advance(1);for(const k of ['brigands','bandits','raiders'])w.kill(k);w.kill('wolves');w.kill('bear')}
    return w.spawned};
  const easy=count('easy'),hard=count('hard');
  assert.ok(hard.length>easy.length*1.6,'hard brings many more threats than easy ('+easy.length+' vs '+hard.length+')');
  const avg=list=>{const s=list.filter(x=>x.type==='raiders');return s.reduce((n,x)=>n+x.size,0)/Math.max(1,s.length)};
  assert.ok(avg(hard)>=avg(easy)+2.5,'hard raids are bigger');
  const w=world({difficulty:'easy'});w.api.tick(.1);w.advance(200);
  assert.ok(w.spawned.filter(s=>s.type==='wolves').length<=1,'easy: one wolf pack at a time');
  assert.equal(w.api.setDifficulty('hard'),true);assert.equal(w.api.difficulty(),'hard');
  assert.equal(w.api.setDifficulty('nightmare'),false,'unknown difficulty refused');
}
// Seasons: the bear hibernates; wolves are bolder in winter.
{
  const w=world({winter:true});w.api.tick(.1);w.advance(10);
  assert.equal(w.api.explain('bear').why,'in letargo','no new bear in winter');
  const summer=world();summer.api.tick(.1);summer.advance(10);
  for(const x of [w,summer])for(let i=0;i<4;i++)x.kill('wolves');
  w.State.clock.day=summer.State.clock.day+=20;w.state().last={};summer.state().last={};
  assert.ok(w.api.explain('wolves').p>summer.api.explain('wolves').p*2,'winter makes wolf packs much more likely');
}
// Conditions: gold draws brigands; one band of a kind at a time; cooldown after its end.
{
  const poor=world({gold:50}),rich=world({gold:900});
  for(const w of [poor,rich]){w.api.tick(.1);w.advance(30)}
  poor.kill('brigands');rich.kill('brigands');
  assert.ok(rich.api.explain('brigands').p>poor.api.explain('brigands').p*3,'a rich village draws brigands');
  const w=world();w.api.tick(.1);w.advance(30);
  w.active.bandits=true;assert.equal(w.api.explain('bandits').why,'banda già attiva');
  w.active.bandits=false;w.lastEnded.bandits=w.State.clock.day-2;
  assert.equal(w.api.explain('bandits').why,'appena avvenuto','quiet after a band ends');
  w.lastEnded.bandits=w.State.clock.day-40;assert.equal(w.api.explain('bandits').why,null);
}
// Catch-up at high speed: every crossed day is rolled once.
{
  const a=world(),b=world();a.api.tick(.1);b.api.tick(.1);
  a.advance(25);
  b.State.clock.day=25;b.api.tick(.1);
  assert.deepEqual(b.spawned.map(s=>s.type),a.spawned.map(s=>s.type),'jumping 25 days rolls the same 25 days');
  assert.equal(b.state().lastDay,25);
}
// Forcing (test buttons), warnings, log and end reports.
{
  const w=world();w.api.tick(.1);
  const e=w.api.force('raiders');
  assert.ok(e&&e.type==='raiders'&&Number.isFinite(e.x),'forced event logged with its place');
  assert.match(w.messages.at(-1),/predoni/i,'the player is told');
  assert.equal(w.api.log()[0],e,'newest first');
  w.api.ended('raiders','escaped',{entry:{x:100,y:3},lootTotal:30});
  assert.equal(w.api.log()[0].kind,'end');assert.match(w.api.log()[0].text,/fuggiti/);
  for(let i=0;i<40;i++)w.api.force('wolves');
  assert.ok(w.api.log().length<=20,'the log keeps the last 20 events');
}
console.log('PASS threats: founding and grace, one event a day, deterministic per seed, difficulty (frequency, size, packs), winter bear and wolves, wealth and brigands, cooldowns, catch-up, forcing, warnings and log');
