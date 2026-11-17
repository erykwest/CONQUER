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
// Balance on the D-060 scale (fante 8, squad 12, patrol 10, knight 20), 17/11/2026:
// wolves less than a man, the bear the worst beast, outlaws just below soldiers.
{
  const ring=(n,mk)=>Array.from({length:n},(_,i)=>({...mk(i),x:.6*Math.cos(i*2*Math.PI/n),y:.6*Math.sin(i*2*Math.PI/n)}));
  const run=(kind,n,mk,seed)=>{const R=rules(seed),f={id:'f',kind,x:0,y:0},e=ring(n,mk);
    for(let t=0;t<300&&!f.defeated&&!e.every(x=>x.defeated);t+=.1)R.update(.1,[f],e,[],()=>true);
    return{won:!f.defeated&&e.every(x=>x.defeated),killed:e.filter(x=>x.defeated).length}};
  const wolf=i=>({id:'w'+i,kind:'wolf',combatKind:'wolf',neutral:false});
  const bear=i=>({id:'b'+i,kind:'bear',combatKind:'bear',neutral:false});
  const axe=i=>({id:'o'+i,kind:'outlaw',combatKind:'outlaw',weapon:'axe'});
  const rate=(kind,n,mk)=>{let w=0,k=0;for(let s=1;s<=40;s++){const r=run(kind,n,mk,s*31+n);if(r.won)w++;k+=r.killed}return{rate:w/40,killed:k}};
  const show=o=>JSON.stringify(o);
  const pack6=rate('squad',6,wolf),pack4=rate('squad',4,wolf),pair=rate('infantry',2,wolf);
  assert.ok(pack6.killed>=120,'wolves die in a fight with soldiers ('+show(pack6)+')');
  assert.ok(pack6.rate>=.35&&pack6.rate<=.85,'a squad against a pack of six is a hard fight ('+show(pack6)+')');
  assert.ok(pack4.rate>=.75,'a squad usually beats four wolves ('+show(pack4)+')');
  assert.ok(pair.rate>=.6,'a footman usually beats two wolves ('+show(pair)+')');
  const bk=rate('knight',1,bear),bs=rate('squad',1,bear),bf=rate('infantry',1,bear);
  assert.ok(bk.rate>=.9,'a knight kills a bear ('+show(bk)+')');
  assert.ok(bs.rate>=.1&&bs.rate<=.5,'a squad alone seldom does ('+show(bs)+')');
  assert.ok(bf.rate<=.15,'a lone footman never does ('+show(bf)+')');
  const band6=rate('squad',6,axe),duel=rate('infantry',1,axe),p2=rate('patrol',2,axe);
  assert.ok(band6.rate>=.2&&band6.rate<=.75,'six brigands against one squad is an even fight ('+show(band6)+')');
  assert.ok(duel.rate>=.75,'a footman beats a brigand ('+show(duel)+')');
  assert.ok(p2.rate>=.8,'a patrol beats two brigands ('+show(p2)+')');
}// No stalemate: two exhausted fighters still hit each other until one falls.
{
  const R=rules(7),a={id:'a',kind:'infantry',x:0,y:0},b={id:'b',kind:'infantry',combatKind:'infantry',x:.5,y:0};
  R.update(.1,[a],[b],[],()=>true);
  a.stats.energy=b.stats.energy=0;
  // Keep them exhausted: no rest while in contact.
  for(let t=0;t<300&&!a.defeated&&!b.defeated;t+=.1){R.update(.1,[a],[b],[],()=>true);a.stats.energy=b.stats.energy=0}
  assert.ok(a.defeated||b.defeated,'exhausted fighters keep wounding each other until one falls');
}
console.log('PASS melee outnumbered: the whole pack strikes, energy once per round, no exhausted stalemate; wolves, bear and outlaws balanced on the D-060 scale');
