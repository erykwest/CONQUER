'use strict';
// Melee against many foes (16/11/2026, «durante uno scambio con un branco di lupi
// nessuno muore»). Real combat rules, seeded dice:
//  · every enemy in contact strikes, not only the one the defender picked;
//  · energy is spent once per melee round, however many foes press in;
//  · an exhausted fighter fights worse but still hits: no eternal stalemate.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const src=fs.readFileSync(path.join(__dirname,'..','src','settlement-combat-rules.js'),'utf8');
function rules(seed){
  let s=seed>>>0;
  const M=Object.create(Math);
  M.random=()=>{s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296};
  const ctx=vm.createContext({window:{},Math:M});
  vm.runInContext(src,ctx);
  return ctx.window.ConquerCombatRules;
}
const pack=n=>Array.from({length:n},(_,i)=>({id:'w'+i,kind:'wolf',combatKind:'wolf',faction:'wildlife',neutral:false,
  x:.6*Math.cos(i*2*Math.PI/n),y:.6*Math.sin(i*2*Math.PI/n)}));
function fight(R,friendly,enemy,seconds){
  for(let t=0;t<seconds;t+=.1)R.update(.1,friendly,enemy,[],()=>true);
}

// Every wolf in contact bites in the first round.
{
  const R=rules(1),squad={id:'sq',kind:'squad',x:0,y:0},wolves=pack(5);
  R.update(.1,[squad],wolves,[],()=>true);
  assert.ok(wolves.every(w=>w.engaged),'the whole pack is in the fight, not one wolf');
  // Energy: one round's cost, not one per wolf.
  for(let t=0;t<1.05;t+=.1)R.update(.1,[squad],wolves,[],()=>true);
  assert.equal(squad.stats.energy,R.MAX_E-1,'surrounded, the squad tires once per round');
}
// A squad beats a pack of five, wounded; a lone patrol is torn apart.
{
  let squadWins=0,patrolLosses=0,wolvesKilled=0;
  for(let seed=1;seed<=20;seed++){
    let R=rules(seed),squad={id:'sq',kind:'squad',x:0,y:0},wolves=pack(5);
    fight(R,[squad],wolves,240);
    wolvesKilled+=wolves.filter(w=>w.defeated).length;
    if(!squad.defeated&&wolves.every(w=>w.defeated))squadWins++;
    R=rules(seed+100);const patrol={id:'p',kind:'patrol',x:0,y:0},pk=pack(5);
    fight(R,[patrol],pk,240);
    if(patrol.defeated)patrolLosses++;
  }
  assert.ok(wolvesKilled>=80,'wolves die in a fight with soldiers ('+wolvesKilled+'/100)');
  assert.ok(squadWins>=15,'a squad usually beats a pack of five ('+squadWins+'/20)');
  assert.ok(patrolLosses>=15,'two men alone against a pack usually die ('+patrolLosses+'/20)');
}
// Balance (17/11/2026): wolves weaker, outlaws on the soldiers' scale (~20 hp a man).
{
  const ring=(n,mk)=>Array.from({length:n},(_,i)=>({...mk(i),x:.6*Math.cos(i*2*Math.PI/n),y:.6*Math.sin(i*2*Math.PI/n)}));
  const run=(kind,n,mk,seed)=>{const R=rules(seed),f={id:'f',kind,x:0,y:0},e=ring(n,mk);
    for(let t=0;t<300&&!f.defeated&&!e.every(x=>x.defeated);t+=.1)R.update(.1,[f],e,[],()=>true);
    return{won:!f.defeated&&e.every(x=>x.defeated),hp:f.stats.hp}};
  const wolf=i=>({id:'w'+i,kind:'wolf',combatKind:'wolf',neutral:false});
  const axe=i=>({id:'o'+i,kind:'outlaw',combatKind:'outlaw',weapon:'axe'});
  const guard=i=>({id:'g'+i,kind:'outlaw',combatKind:'outlawGuard',weapon:'axe'});
  const stats=(kind,n,mk)=>{let w=0,hp=0;for(let s=1;s<=30;s++){const r=run(kind,n,mk,s*31+n);if(r.won){w++;hp+=r.hp}}return{rate:w/30,hp:w?hp/w:0}};
  const pack6=stats('squad',6,wolf);
  assert.ok(pack6.rate>=.7&&pack6.hp<80,'a squad usually beats a pack of six, wounded ('+JSON.stringify(pack6)+')');
  const band6=stats('squad',6,axe);
  assert.ok(band6.rate>=.9&&band6.hp<=75,'a squad beats six brigands but pays for it ('+JSON.stringify(band6)+')');
  const lair=stats('squad',5,guard);
  assert.ok(lair.rate>=.8&&lair.hp<=60,'five lair guards cost a squad dearly ('+JSON.stringify(lair)+')');
  const patrol4=stats('patrol',4,axe);
  assert.ok(patrol4.rate<=.8,'two men against four brigands is no sure thing ('+JSON.stringify(patrol4)+')');
}
// No stalemate: two exhausted fighters still hit each other until one falls.
{
  const R=rules(7),a={id:'a',kind:'infantry',x:0,y:0},b={id:'b',kind:'infantry',combatKind:'infantry',x:.5,y:0};
  R.update(.1,[a],[b],[],()=>true);
  a.stats.energy=b.stats.energy=0;
  const before=a.stats.hp+b.stats.hp;
  // Keep them exhausted: no rest while in contact.
  for(let t=0;t<120;t+=.1){R.update(.1,[a],[b],[],()=>true);a.stats.energy=b.stats.energy=0}
  assert.ok(a.stats.hp+b.stats.hp<before-10,'exhausted fighters keep wounding each other');
}
console.log('PASS melee outnumbered: the whole pack strikes, energy once per round, no exhausted stalemate; a squad beats five wolves, a lone patrol does not');
