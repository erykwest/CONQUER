'use strict';
// CONQUER combat adapter: core dice, melee and ranged rules mirrored from
// COFFEE_BATTLES, with different presentation and single-figure/5-figure scale.
(function(){
  const D12=[1,2,2,3,3,3,4,4,4,5,5,6];
  const MAX_E=150,MAX_B=150;
  const PROFILES=Object.freeze({
    spearman:Object.freeze({hp:100,combat:2,armor:2,aim:null,front:3}),
    infantry:Object.freeze({hp:100,combat:2,armor:1,aim:null,front:1}),
    knight:Object.freeze({hp:30,combat:3,armor:3,aim:null,front:1}),
    archer:Object.freeze({hp:100,combat:1,armor:0,aim:2,front:1,range:15})
  });
  // Faction IDs are data, not a render-side "enemy = black" conditional.
  // A PVP team can supply its own palette / emblems later.
  const FACTIONS={
    realm:{livery:null},
    dev_hostile:{livery:{main:'#171716',alt:'#e3bd31',mainDark:'#090909',altDark:'#95781a'}}
  };
  const shots=[],meleeFlashes=[];
  let elapsed=0,combatClock=0;
  const roll=()=>D12[Math.floor(Math.random()*D12.length)];
  function configureFactions(data){
    for(const [id,entry] of Object.entries(data||{})){
      if(!/^[a-zA-Z0-9_-]{1,48}$/.test(id)||!entry||typeof entry!=='object')continue;
      const l=entry.livery;
      if(l&&['main','alt'].every(k=>typeof l[k]==='string'&&/^#[0-9a-f]{6}$/i.test(l[k]))){
        FACTIONS[id]={livery:{main:l.main,alt:l.alt,mainDark:l.mainDark||l.main,altDark:l.altDark||l.alt}};
      }
    }
  }
  const liveryOf=id=>FACTIONS[id]?.livery||null;
  function ensure(entity,kind){
    if(!entity.stats){
      const p=PROFILES[kind]||PROFILES.infantry;
      entity.stats={hp:p.hp,maxHp:p.hp,energy:MAX_E,brain:MAX_B,combat:p.combat,armor:p.armor,aim:p.aim,shock:0};
    }
    if(!Number.isFinite(entity.meleeClock))entity.meleeClock=0;
    return entity.stats;
  }
  function living(u){return !!u&&(!u.stats||u.stats.hp>0)}
  function effectiveCombat(u){
    const v=ensure(u,u.kind==='squad'?'spearman':u.kind==='knight'?'knight':u.combatKind||'infantry');
    if(v.energy<=0||v.brain<=0)return 0;
    return Math.max(0,v.combat-(v.brain/MAX_B<=.5?1:0));
  }
  function applyDamage(u,hits,source){
    const s=ensure(u,u.kind==='squad'?'spearman':u.kind==='knight'?'knight':u.combatKind||'infantry');
    const before=s.hp;
    s.hp=Math.max(0,s.hp-hits);
    s.brain=Math.max(0,s.brain-hits);
    const ratio=before>0?hits/before:0;
    const shock=hits<=0?0:ratio<.02?0:ratio<=.05?1:3;
    s.shock+=shock;
    while(s.shock>=5){s.brain=Math.max(0,s.brain-1);s.shock-=5}
    if(s.hp<=0)u.defeated=true;
    if(s.brain<=0&&s.hp>0)u.routing=true;
    if(source&&hits>0){source.damageDealt=(source.damageDealt||0)+hits}
  }
  function meleePair(a,b,count){
    ensure(a,a.kind==='squad'?'spearman':a.kind==='knight'?'knight':a.combatKind||'infantry');
    ensure(b,b.combatKind||'infantry');
    let hitA=0,hitB=0;
    const ca=effectiveCombat(a),cb=effectiveCombat(b);
    for(let i=0;i<count;i++){
      const sa=roll()+ca,sb=roll()+cb;
      if(sa>sb&&ca>0&&sa-sb>b.stats.armor)hitB++;
      else if(sb>sa&&cb>0&&sb-sa>a.stats.armor)hitA++;
    }
    applyDamage(a,hitA,b);applyDamage(b,hitB,a);
    a.stats.energy=Math.max(0,a.stats.energy-count);
    b.stats.energy=Math.max(0,b.stats.energy-count);
    return {hitA,hitB};
  }
  function shotHit(shooter,target){
    const v=ensure(target,target.combatKind||'infantry');
    const die=roll(),aim=PROFILES.archer.aim,armor=v.armor;
    return die===6||(die!==1&&die+aim>=6+armor);
  }
  function arrow(shooter,target,damage){
    if(shots.length>150)shots.splice(0,shots.length-150);
    shots.push({
      from:{x:shooter.x,y:shooter.y,z:shooter.visualZ},
      to:{x:target.x,y:target.y,z:target.visualZ??0},
      start:elapsed,duration:.35+.018*Math.hypot(shooter.x-target.x,shooter.y-target.y),
      hit:damage
    });
  }
  function shooterRange(shooter,target){
    const targetH=Number.isFinite(target.h)?target.h:target.height??0;
    // +1/-1 range for every relative altitude level. Positive downhill,
    // negative uphill, exactly symmetrical when shooter and target swap.
    return Math.max(1,PROFILES.archer.range+shooter.h-targetH);
  }
  function update(dt,friendly,enemy,shooters,visibleFn,canContact=()=>true){
    if(!Number.isFinite(dt)||dt<=0)return;
    dt=Math.min(dt,.25);elapsed+=dt;combatClock+=dt;
    for(const u of friendly.concat(enemy)){
      if(!living(u))continue;
      if(!u.engaged) {
        const s=ensure(u,u.kind==='squad'?'spearman':u.kind==='knight'?'knight':u.combatKind||'infantry');
        s.energy=Math.min(MAX_E,s.energy+dt*10);
        if(!u.routing)s.brain=Math.min(MAX_B,s.brain+dt);
      }
      u.engaged=false;
    }
    for(const a of friendly){
      if(!living(a)||a.routing)continue;
      let nearest=null,gap=1;
      for(const b of enemy){
        if(!living(b)||b.routing||!canContact(a,b))continue;
        const distance=Math.hypot(a.x-b.x,a.y-b.y);
        if(distance<gap){nearest=b;gap=distance}
      }
      if(!nearest)continue;
      a.engaged=nearest.engaged=true;
      a.target=null;
      if(combatClock>=1){
        const frontage=Math.min(PROFILES[a.kind==='squad'?'spearman':'knight'].front,PROFILES[nearest.combatKind||'infantry'].front);
        meleePair(a,nearest,Math.max(1,frontage));
        if(meleeFlashes.length>50)meleeFlashes.shift();
        meleeFlashes.push({x:(a.x+nearest.x)/2,y:(a.y+nearest.y)/2,at:elapsed});
      }
    }
    if(combatClock>=1)combatClock%=1;
    for(const shooter of shooters){
      let target=null,best=Infinity;
      for(const e of enemy){
        if(!living(e)||e.routing||!visibleFn(e,shooter))continue;
        const d=Math.hypot(shooter.x-e.x,shooter.y-e.y);
        if(d>shooterRange(shooter,{...e,h:e.h??shooter.terrainAt(e)})||d>=best)continue;
        target=e;best=d;
      }
      const id=shooter.id;
      if(!shooter.clock)shooter.clock=0;
      if(!target){shooter.clock=0;continue}
      shooter.clock+=dt;
      if(shooter.clock<2)continue;
      shooter.clock%=2;
      const hit=shotHit(shooter,target);
      arrow(shooter,target,hit);
      if(hit)applyDamage(target,1,shooter);
    }
    for(let i=shots.length-1;i>=0;i--)if(elapsed>shots[i].start+shots[i].duration)shots.splice(i,1);
    for(let i=meleeFlashes.length-1;i>=0;i--)if(elapsed>meleeFlashes[i].at+.65)meleeFlashes.splice(i,1);
  }
  window.ConquerCombatRules={PROFILES,FACTIONS,configureFactions,liveryOf,ensure,living,meleePair,shooterRange,update,visualEffects:()=>({shots,meleeFlashes,elapsed}),
    get time(){return elapsed},reset(){shots.length=0;meleeFlashes.length=0;elapsed=0;combatClock=0}};
})();