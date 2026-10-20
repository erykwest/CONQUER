'use strict';
// CONQUER combat adapter: core dice, melee and ranged rules mirrored from
// COFFEE_BATTLES, with different presentation and single-figure/5-figure scale.
(function(){
  const D12=[1,2,2,3,3,3,4,4,4,5,5,6];
  const MAX_E=150,MAX_B=150;
  const PROFILES=Object.freeze({
    spearman:Object.freeze({hp:100,combat:2,armor:2,aim:null,front:3}),
    patrol:Object.freeze({hp:40,combat:2,armor:2,aim:null,front:2}),
    wolf:Object.freeze({hp:12,combat:3,armor:0,aim:null,front:1}),
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
  const shots=[],meleeFlashes=[],stones=[];
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
  const profileKind=u=>u.kind==='squad'?'spearman':u.kind==='patrol'?'patrol':u.kind==='knight'?'knight':u.combatKind||'infantry';
  function boundaryPoints(isAllowed,worldSize=200,step=1.25){
    const edge=step*.576,points=[];
    for(let y=step/2;y<worldSize;y+=step)for(let x=step/2;x<worldSize;x+=step){
      const p={x,y};if(!isAllowed(p))continue;
      if([[edge,0],[-edge,0],[0,edge],[0,-edge]].some(([dx,dy])=>!isAllowed({x:x+dx,y:y+dy})))points.push(p);
    }
    return points;
  }
  function nextBoundaryIndex(points,current,previous,direction,center,maxGap=3.05){
    const origin=points[current];if(!origin)return-1;
    const prior=Number.isInteger(previous)?points[previous]:null;
    const baseAngle=Math.atan2(origin.y-center.y,origin.x-center.x);
    let best=-1,bestScore=-Infinity;
    for(let i=0;i<points.length;i++){
      if(i===current||i===previous)continue;
      const candidate=points[i],dx=candidate.x-origin.x,dy=candidate.y-origin.y,d=Math.hypot(dx,dy);
      if(d<=.01||d>maxGap)continue;
      let score=-d*.2;
      if(prior){
        const ax=origin.x-prior.x,ay=origin.y-prior.y;
        score+=(ax*dx+ay*dy)/Math.max(.01,Math.hypot(ax,ay)*d)*4;
      }else{
        let delta=Math.atan2(candidate.y-center.y,candidate.x-center.x)-baseAngle;
        while(delta>Math.PI)delta-=Math.PI*2;while(delta<-Math.PI)delta+=Math.PI*2;
        score+=delta*direction*5;
      }
      if(score>bestScore){bestScore=score;best=i}
    }
    return best;
  }
  function traceBoundaryIndices(points,center,direction=1){
    if(!points.length)return[];
    const trace=[0],visited=new Set(trace);let previous=null,current=0;
    for(let i=1;i<points.length;i++){
      const next=nextBoundaryIndex(points,current,previous,direction,center);
      if(next<0||visited.has(next))break;
      trace.push(next);visited.add(next);previous=current;current=next;
    }
    return trace;
  }
  // Ordered outer perimeter of the *connected* White Zone. The old greedy
  // neighbor trace could terminate on a local branch after just a dozen points,
  // making a patrol ping-pong over that tiny arc instead of circulating.
  // Trace directed cell-boundary edges so that every step follows a real
  // contour; discard hole rings and prefer the ring enclosing the settlement.
  function orderedBoundaryPoints(isAllowed,worldSize=200,step=1.25,focus=null){
    const size=Math.ceil(worldSize/step),filled=new Uint8Array(size*size);
    const inside=(x,y)=>x>=0&&y>=0&&x<size&&y<size&&filled[y*size+x]===1;
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      filled[y*size+x]=isAllowed({x:(x+.5)*step,y:(y+.5)*step})?1:0;
    }
    const edges=[],outgoing=new Map();
    function add(x1,y1,x2,y2,cx,cy){
      const index=edges.length;edges.push({x1,y1,x2,y2,cx,cy});
      const key=x1+','+y1,list=outgoing.get(key)||[];list.push(index);outgoing.set(key,list);
    }
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      if(!inside(x,y))continue;
      // Clockwise edges: every edge has a traversable cell on its right.
      if(!inside(x,y-1))add(x,y,x+1,y,x,y);
      if(!inside(x+1,y))add(x+1,y,x+1,y+1,x,y);
      if(!inside(x,y+1))add(x+1,y+1,x,y+1,x,y);
      if(!inside(x-1,y))add(x,y+1,x,y,x,y);
    }
    const direction=e=>e.x2>e.x1?0:e.y2>e.y1?1:e.x2<e.x1?2:3;
    const visited=new Uint8Array(edges.length);
    function containsFocus(vertices){
      if(!focus)return false;
      const fx=focus.x/step,fy=focus.y/step;
      let insideRing=false;
      for(let i=0,j=vertices.length-1;i<vertices.length;j=i++){
        const a=vertices[i],b=vertices[j];
        if((a.y>fy)!==(b.y>fy) &&
          fx<(b.x-a.x)*(fy-a.y)/(b.y-a.y)+a.x)insideRing=!insideRing;
      }
      return insideRing;
    }
    let best=[],bestScore=-Infinity;
    for(let first=0;first<edges.length;first++){
      if(visited[first])continue;
      const start=edges[first],cells=[],vertices=[];
      let current=first,closed=false;
      for(let i=0;i<edges.length;i++){
        if(visited[current])break;
        const e=edges[current];visited[current]=1;
        if(!cells.length||cells.at(-1).x!==e.cx||cells.at(-1).y!==e.cy)
          cells.push({x:e.cx,y:e.cy});
        vertices.push({x:e.x1,y:e.y1});
        if(e.x2===start.x1&&e.y2===start.y1){closed=true;break}
        const candidates=outgoing.get(e.x2+','+e.y2)||[];
        const prior=direction(e);let next=-1,rank=5;
        for(const j of candidates){
          if(visited[j])continue;
          // On diagonal contacts, turn right to stay on the same boundary,
          // rather than switching to an unrelated touching component.
          const turn=(direction(edges[j])-prior+4)%4;
          const priority=turn===1?0:turn===0?1:turn===3?2:3;
          if(priority<rank){rank=priority;next=j}
        }
        if(next<0)break;
        current=next;
      }
      if(!closed||cells.length<4)continue;
      if(cells.at(-1).x===cells[0].x&&cells.at(-1).y===cells[0].y)cells.pop();
      const signedArea=vertices.reduce((area,p,i)=>{
        const q=vertices[(i+1)%vertices.length];
        return area+p.x*q.y-q.x*p.y;
      },0)/2;
      if(signedArea<=0)continue; // Skip counterclockwise internal holes.
      const score=signedArea+(containsFocus(vertices)?size*size:0);
      if(score>bestScore){
        bestScore=score;
        best=cells.map(c=>({x:(c.x+.5)*step,y:(c.y+.5)*step}));
      }
    }
    return best;
  }
  const shouldRebuildBoundary=(painting,hasCache,signatureChanged)=>signatureChanged&&(!painting||!hasCache);
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
    const v=ensure(u,profileKind(u));
    if(v.energy<=0||v.brain<=0)return 0;
    return Math.max(0,v.combat-(v.brain/MAX_B<=.5?1:0));
  }
  function applyDamage(u,hits,source){
    const s=ensure(u,profileKind(u));
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
    ensure(a,profileKind(a));
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
    const shot={
      from:{x:shooter.x,y:shooter.y,z:shooter.visualZ},
      to:{x:target.x,y:target.y,z:target.visualZ??0},
      start:elapsed,duration:.35+.018*Math.hypot(shooter.x-target.x,shooter.y-target.y),
      hit:damage
    };
    shots.push(shot);
    return shot;
  }
  // Stones dropped from hoardings/machicolations on men at the wall foot: heavy, short,
  // almost sure to land (armour still counts); each hit takes 3 hp.
  const STONE_DAMAGE=3;
  function dropStone(source,target,from,count=1){
    const v=ensure(target,profileKind(target));let hits=0;
    for(let i=0;i<count;i++){const die=roll();if(die===6||die>v.armor)hits++}
    const fall=.45;
    if(stones.length>80)stones.splice(0,stones.length-80);
    stones.push({from:{...from},to:{x:target.x,y:target.y,z:target.visualZ??((target.h??0)+.5)},start:elapsed,duration:fall,hit:hits>0});
    if(hits){
      applyDamage(target,hits*STONE_DAMAGE,source);
      window.ConquerCombatAnim?.hurt(target,fall);
      if(target.defeated)window.ConquerCombatAnim?.fall(target,fall,source);
    }
    return hits;
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
        const s=ensure(u,profileKind(u));
        s.energy=Math.min(MAX_E,s.energy+dt*10);
        if(!u.routing)s.brain=Math.min(MAX_B,s.brain+dt);
      }
      u.engaged=false;
    }
    for(const a of friendly){
      if(!living(a)||a.routing)continue;
      let nearest=null,gap=1;
      for(const b of enemy){
        if(!living(b)||b.routing||b.neutral||!canContact(a,b))continue;
        const distance=Math.hypot(a.x-b.x,a.y-b.y);
        if(distance<gap){nearest=b;gap=distance}
      }
      if(!nearest)continue;
      a.engaged=nearest.engaged=true;
      a.target=null;
      if(combatClock>=1){
        const frontage=Math.min(PROFILES[profileKind(a)].front,PROFILES[nearest.combatKind||'infantry'].front);
        const {hitA,hitB}=meleePair(a,nearest,Math.max(1,frontage));
        const anim=window.ConquerCombatAnim;
        if(anim){
          // Damage lands on the thrust, not on the wind-up.
          const impact=anim.TIMING.IMPACT;
          anim.strike(a,nearest);anim.strike(nearest,a);
          if(hitA)anim.hurt(a,impact);
          if(hitB)anim.hurt(nearest,impact);
          if(a.defeated)anim.fall(a,impact,nearest);
          if(nearest.defeated)anim.fall(nearest,impact,a);
        }
        if(meleeFlashes.length>50)meleeFlashes.shift();
        meleeFlashes.push({x:(a.x+nearest.x)/2,y:(a.y+nearest.y)/2,at:elapsed});
      }
    }
    if(combatClock>=1)combatClock%=1;
    for(const shooter of shooters){
      let target=null,best=Infinity;
      for(const e of enemy){
        if(!living(e)||e.routing||e.neutral||!visibleFn(e,shooter))continue;
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
      const shot=arrow(shooter,target,hit);
      if(hit){
        applyDamage(target,1,shooter);
        window.ConquerCombatAnim?.hurt(target,shot.duration);
        if(target.defeated)window.ConquerCombatAnim?.fall(target,shot.duration,shooter);
      }
    }
    for(let i=shots.length-1;i>=0;i--)if(elapsed>shots[i].start+shots[i].duration)shots.splice(i,1);
    for(let i=meleeFlashes.length-1;i>=0;i--)if(elapsed>meleeFlashes[i].at+.65)meleeFlashes.splice(i,1);
    for(let i=stones.length-1;i>=0;i--)if(elapsed>stones[i].start+stones[i].duration+.25)stones.splice(i,1);
  }
  function drawEffects(g,project){
    g.save();
    for(const p of shots){
      const t=Math.min(1,(elapsed-p.start)/p.duration);
      const rise=Math.sin(Math.PI*t)*Math.min(3,Math.hypot(p.to.x-p.from.x,p.to.y-p.from.y)*.20);
      const x=p.from.x+(p.to.x-p.from.x)*t,y=p.from.y+(p.to.y-p.from.y)*t;
      const z=p.from.z+(p.to.z-p.from.z)*t+rise;
      const pos=project({x,y},z);
      const end=project({x:p.from.x+(p.to.x-p.from.x)*Math.min(1,t+.045),y:p.from.y+(p.to.y-p.from.y)*Math.min(1,t+.045)},
        p.from.z+(p.to.z-p.from.z)*Math.min(1,t+.045)+Math.sin(Math.PI*Math.min(1,t+.045))*Math.min(3,Math.hypot(p.to.x-p.from.x,p.to.y-p.from.y)*.20));
      g.strokeStyle='#d7c6a1';g.lineWidth=2;g.beginPath();g.moveTo(pos.x,pos.y);g.lineTo(end.x,end.y);g.stroke();
    }
    for(const s of stones){
      // Falls with gravity from the gallery; a puff where it lands.
      const t=Math.min(1,(elapsed-s.start)/s.duration),k=t*t;
      const at=project({x:s.from.x+(s.to.x-s.from.x)*t,y:s.from.y+(s.to.y-s.from.y)*t},s.from.z+(s.to.z-s.from.z)*k);
      if(t<1){g.globalAlpha=1;g.fillStyle='#8e877c';g.strokeStyle='#4a453f';g.lineWidth=1;g.beginPath();g.arc(at.x,at.y,3.2,0,Math.PI*2);g.fill();g.stroke()}
      else{const age=(elapsed-s.start-s.duration)/.25;g.globalAlpha=Math.max(0,.6-age*.6);g.fillStyle='#c9bda7';g.beginPath();g.arc(at.x,at.y,4+age*6,0,Math.PI*2);g.fill();g.globalAlpha=1}
    }
    for(const f of meleeFlashes){
      const age=(elapsed-f.at)/.65,at=project(f,.16);
      g.globalAlpha=Math.max(0,1-age);g.strokeStyle='#f3dcc0';g.lineWidth=1.8;
      g.beginPath();g.moveTo(at.x-5,at.y-11-age*5);g.lineTo(at.x+6,at.y-3-age*5);g.stroke();
    }
    g.restore();
  }
  window.ConquerCombatRules={PROFILES,FACTIONS,configureFactions,liveryOf,boundaryPoints,nextBoundaryIndex,traceBoundaryIndices,orderedBoundaryPoints,shouldRebuildBoundary,ensure,living,meleePair,shooterRange,update,drawEffects,dropStone,STONE_DAMAGE,
    get time(){return elapsed},reset(){shots.length=0;meleeFlashes.length=0;stones.length=0;elapsed=0;combatClock=0;window.ConquerCombatAnim?.reset()}};
})();