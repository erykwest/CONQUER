'use strict';
// Naval battle between two ships of the test fleet (settlement-fleet.js). Warships carry a
// garrison: archers on the fore and aft castles (on deck where there are none) and
// men-at-arms (spears and swords) in the waist. A battle runs in phases on real time:
//   approach  the attacker sails up alongside the defender; archers on both sides shoot,
//             some of the attacker's arrows are fire arrows
//   grapple   alongside, the attacker furls its sails and lowers a boarding plank
//   board     the men-at-arms cross the plank and fight on the enemy deck
//   burn      whoever holds the deck, the defender is set alight (or the fire arrows do it):
//             flames spread over deck, castles and sails, the hull chars, the plank is cast off
//   sink      the burnt ship heels over and goes down; what is under water is not drawn
// Visual and deterministic per seed; nothing is saved. Figures are the realm's soldiers
// (settlement-combat-anim.js) with the ship's livery.
(() => {
  const S=()=>window.ConquerShips,M=()=>window.ConquerShipModels,F=()=>window.ConquerFleet;
  const CA=()=>window.ConquerCombatAnim;
  const MEN={barca:2,cargo:3,caravella:5,cocca:8,nave:10};
  const ARROW_SPEED=14,APPROACH=14,GRAPPLE=2,BURN=22,SINK=16;
  function hash(str){let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
  function rng(seed){let a=seed|0;return()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
  const smooth=t=>t*t*(3-2*t);
  const model=s=>M().ships[s.key];
  // Soldiers' livery: the realm's own heraldry for the player (null), a foreign realm's colours.
  function liveryOf(ship){
    if(ship.allegiance!=='foreign')return null;
    const h=S().FOREIGN[ship.realm]?.heraldry;if(!h)return null;
    return{main:h.c1,alt:h.c2,mainDark:h.c1,altDark:h.c2};
  }
  // ---------- garrison
  function garrison(ship){
    const m=model(ship),c=m.crew,r=rng(hash(ship.id)),out=[];
    // Men-at-arms have shields and mail: three wounds put one down, an archer falls at the first.
    const add=(type,local,post)=>out.push({id:ship.id+':'+type+':'+out.length,ship,type,local,home:local.slice(),post,
      dead:false,hp:type==='archer'?1:3,next:r()*2,engaged:false,world:null,target:null,path:null});
    // Archers along the castle parapets, else on the after deck.
    for(const k of c.castles){
      const n=Math.max(1,Math.min(3,Math.floor((k.x1-k.x0)/.45)));
      for(let i=0;i<n;i++){const x=k.x0+(k.x1-k.x0)*(i+.5)/n;for(const side of [1,-1])add('archer',[x,side*k.b,k.z],'castle')}
    }
    if(!c.castles.length)for(const side of [1,-1])add('archer',[c.deck[1][0],side*c.half*.6,c.deck[1][2]],'deck');
    // Men-at-arms in the waist, spears and swords.
    const n=MEN[ship.key]||4;
    for(let i=0;i<n;i++){
      const u=(i+.5)/n,p=c.deck[Math.min(c.deck.length-1,Math.round(u*(c.deck.length-1)))];
      add(i%2?'infantry':'spearman',[p[0],(i%3-1)*c.half*.55,p[2]],'waist');
    }
    return out;
  }
  // ---------- battle state
  let battle=null;
  function start(attacker,defender){
    const A=attacker,D=defender,mA=model(A),mD=model(D);
    A.soldiers=garrison(A);D.soldiers=garrison(D);
    // Alongside: the attacker ends parallel to the defender, on its port side, hulls 0.5U apart.
    const n={x:-Math.sin(D.pose.heading),y:Math.cos(D.pose.heading)},gap=mA.B/2+mD.B/2+.5;
    const end={x:D.pose.x+n.x*gap,y:D.pose.y+n.y*gap,heading:D.pose.heading,z:0};
    battle={A,D,phase:'approach',t:0,from:{...A.pose},end,arrows:[],plank:null,fire:new Map([[A.id,0],[D.id,0]]),
      sink:null,rnd:rng(hash(A.id+D.id)),log:[]};
    S().lower(A.crew.sail);A.crew.sail.t=A.crew.sail.furl=0;
    return battle;
  }
  const alive=list=>list.filter(s=>!s.dead);
  const worldOf=s=>s.world||S().toWorld(s.ship.pose,s.local);
  // Arrows: from an archer to a target figure, a ballistic arc; hits wound, sometimes kill;
  // fire arrows set the ship alight a little more each time.
  function shoot(b,archer,foes,fireArrows){
    const t=alive(foes);if(!t.length)return;
    const target=t[Math.floor(b.rnd()*t.length)],from=worldOf(archer),to=worldOf(target);
    const d=Math.hypot(to.x-from.x,to.y-from.y);if(d>18)return;
    CA()?.strike(archer,null);
    b.arrows.push({from:{...from,z:from.z+.35},to:{...to,z:to.z+.25},t:0,dur:Math.max(.25,d/ARROW_SPEED),target,
      fire:fireArrows&&b.rnd()<.35,ship:target.ship});
  }
  function land(b,a){
    const s=a.target;
    if(a.fire)b.fire.set(a.ship.id,Math.min(1,(b.fire.get(a.ship.id)||0)+.05));
    if(s.dead||b.rnd()>.3)return;                       // most arrows miss, glance or stick in the bulwarks
    s.hp-=1;CA()?.hurt(s);
    if(s.hp<=0){s.dead=true;CA()?.fall(s,0)}
  }
  function step(dt){
    const b=battle;if(!b)return null;
    b.t+=dt;const {A,D}=b,mA=model(A);
    // Archers shoot through approach, grapple and boarding.
    if(b.phase!=='sink'){
      for(const [own,foe,fireArrows] of [[A,D,true],[D,A,false]]){
        // Once its men-at-arms are down, a ship's archers lay down their bows.
        if(b.phase!=='approach'&&!alive(own.soldiers).some(s=>s.type!=='archer'))continue;
        for(const s of alive(own.soldiers)){
        if(s.type!=='archer'||(b.fire.get(own.id)||0)>.85)continue;
        if((s.next-=dt)<=0){s.next=2.2+b.rnd()*1.4;shoot(b,s,foe.soldiers,fireArrows)}
      }}
    }
    for(const a of b.arrows)a.t+=dt/a.dur;
    for(const a of b.arrows.filter(a=>a.t>=1))land(b,a);
    b.arrows=b.arrows.filter(a=>a.t<1);
    if(b.phase==='approach'){
      // Sail in on a curve: a straight run with the heading turning onto the defender's.
      const u=smooth(Math.min(1,b.t/APPROACH)),f=b.from,e=b.end;
      const turn=Math.atan2(Math.sin(e.heading-f.heading),Math.cos(e.heading-f.heading));
      A.pose={x:f.x+(e.x-f.x)*u,y:f.y+(e.y-f.y)*u,heading:f.heading+turn*smooth(Math.min(1,u*1.4)),z:0,roll:Math.sin(b.t*1.3)*.03};
      if(b.t>=APPROACH){b.phase='grapple';b.t=0;S().raise(A.crew.sail);A.pose.roll=0}
    }else if(b.phase==='grapple'){
      // The plank goes down amidships between the facing deck edges.
      const k=Math.min(1,b.t/GRAPPLE);
      const pa=S().toWorld(A.pose,[0,-mA.B/2*.85,mA.deck+.1]),pd=S().toWorld(D.pose,[0,model(D).B/2*.85,model(D).deck+.1]);
      b.plank={a:pa,b:{x:pa.x+(pd.x-pa.x)*k,y:pa.y+(pd.y-pa.y)*k,z:pa.z+(pd.z-pa.z)*k},full:pd};
      if(b.t>=GRAPPLE){b.phase='board';b.t=0;board(b)}
    }else if(b.phase==='board'){
      fight(b,dt);
      const boarders=alive(A.soldiers).filter(s=>s.type!=='archer'),defenders=alive(D.soldiers).filter(s=>s.type!=='archer');
      // Whoever holds the deck, the defender burns: winners set it alight, losers' fire arrows.
      if(!defenders.length&&boarders.every(s=>s.state==='aboard'||s.state==='fight')){b.fire.set(D.id,Math.max(b.fire.get(D.id),.55));retreat(b)}
      if(!boarders.length||b.t>40){b.fire.set(D.id,Math.max(b.fire.get(D.id),.45));retreat(b)}
    }else if(b.phase==='withdraw'){
      fight(b,dt);
      if(alive(A.soldiers).every(s=>s.type==='archer'||s.state==='home')){b.plank=null;b.phase='burn';b.t=0}
    }else if(b.phase==='burn'){
      b.fire.set(D.id,Math.min(1,b.fire.get(D.id)+dt/BURN));
      for(const s of alive(D.soldiers))if(b.rnd()<dt*.12*b.fire.get(D.id)){s.dead=true;CA()?.fall(s,0)}
      if(b.fire.get(D.id)>=1){b.phase='sink';b.t=0;S().lower(A.crew.sail)}
    }else if(b.phase==='sink'){
      const u=Math.min(1,b.t/SINK),md=model(D),depth=md.deck+3.5;
      D.pose={...D.pose,z:-Math.pow(u,1.4)*depth,roll:u*.55,pitch:-u*.18};
      for(const s of alive(D.soldiers)){s.dead=true;CA()?.fall(s,b.rnd()*.8)}
      if(u>=1){F().remove(D.id);b.phase='done'}
    }
    return b;
  }
  // ---------- boarding: across the plank, pair off with a defender, exchange blows
  function board(b){
    const D=b.D,dz=model(D).deck;
    for(const s of alive(b.A.soldiers))if(s.type!=='archer'){
      s.world={...worldOf(s)};s.state='toPlank';
    }
    for(const s of alive(D.soldiers))if(s.type!=='archer'){s.world={...worldOf(s)};s.state='hold'}
    b.deckZ={A:model(b.A).deck,D:dz};
  }
  function moveTo(s,p,speed,dt){
    const dx=p.x-s.world.x,dy=p.y-s.world.y,dz=(p.z??s.world.z)-s.world.z,d=Math.hypot(dx,dy);
    if(d<=speed*dt){s.world={x:p.x,y:p.y,z:p.z??s.world.z};return true}
    const k=speed*dt/d;s.world={x:s.world.x+dx*k,y:s.world.y+dy*k,z:s.world.z+dz*k};s.dir={x:dx,y:dy};return false;
  }
  function fight(b,dt){
    const {A,D,plank}=b,full=plank?.full||plank?.b;
    const defenders=alive(D.soldiers).filter(s=>s.type!=='archer');
    alive(A.soldiers).filter(s=>s.type!=='archer').forEach((s,i)=>{
      if(s.state==='toPlank'){if(moveTo(s,{...plank.a,z:plank.a.z-.1},.6,dt))s.state='cross'}
      else if(s.state==='cross'){if(moveTo(s,{...full,z:full.z-.1},.45,dt))s.state='aboard'}
      else if(s.state==='aboard'||s.state==='fight'){
        // Close with the nearest defender standing; trade blows in reach.
        let foe=null,best=Infinity;for(const d of defenders){const q=Math.hypot(d.world.x-s.world.x,d.world.y-s.world.y);if(q<best){best=q;foe=d}}
        if(!foe){s.state='aboard';return}
        s.foe=foe;foe.foe=s;
        if(best>.38){moveTo(s,{x:foe.world.x,y:foe.world.y,z:foe.world.z},.5,dt);s.state='aboard';s.engaged=false;return}
        s.state='fight';s.engaged=foe.engaged=true;
        if((s.next-=dt)<=0){
          s.next=.9+b.rnd()*.5;CA()?.strike(s,foe);CA()?.strike(foe,s);
          // Boarders press the attack: a little more likely to win each exchange.
          const loser=b.rnd()<.64?foe:s;loser.hp-=1;CA()?.hurt(loser,.25);
          if(loser.hp<=0){loser.dead=true;loser.engaged=false;CA()?.fall(loser,.3,loser===foe?s:foe)}
        }
      }else if(s.state==='back'){
        if(moveTo(s,{...full,z:full.z-.1},.6,dt))s.state='recross';
      }else if(s.state==='recross'){
        if(moveTo(s,{...plank.a,z:plank.a.z-.1},.5,dt))s.state='homeward';
      }else if(s.state==='homeward'){
        const h=S().toWorld(A.pose,s.home);if(moveTo(s,h,.6,dt)){s.state='home';s.world=null}
      }
    });
    // Defenders hold the waist, then step towards the boarders who reach them.
    for(const d of defenders)if(d.foe&&!d.foe.dead&&d.foe.state!=='cross'&&d.foe.state!=='toPlank'){
      const q=Math.hypot(d.foe.world.x-d.world.x,d.foe.world.y-d.world.y);
      if(q>.4)moveTo(d,{x:d.foe.world.x,y:d.foe.world.y,z:d.world.z},.35,dt);
    }
  }
  function retreat(b){
    for(const s of alive(b.A.soldiers))if(s.type!=='archer'&&s.world)s.state=s.state==='toPlank'||s.state==='homeward'||s.state==='home'?'homeward':'back';
    b.phase='withdraw';
  }
  // ---------- drawing (called by the fleet for each frame)
  const fireOf=ship=>battle?.fire.get(ship.id)||0;
  const CHAR=[38,30,26];
  const tint=(hex,k)=>{const h=hex.replace('#','');return'#'+[0,2,4].map(i=>Math.round(parseInt(h.slice(i,i+2),16)*(1-k)+CHAR[i/2]*k).toString(16).padStart(2,'0')).join('')};
  // Charred and sinking: tint the hull, burn the sails away, drop what is under water.
  function dress(ship,mesh){
    const f=fireOf(ship),sinking=battle&&battle.D===ship&&battle.phase==='sink';
    if(f<.3&&!sinking)return mesh;
    const m=model(ship),hull=m.c.length,pos=[],col=[],char=Math.max(0,(f-.3)/.7)*.85;
    for(let t=0;t<mesh.col.length;t++){
      const o=t*9;
      if(t>=hull&&t<hull+m.sails.c.length&&(hash(ship.id+t)%1000)/1000<(f-.45)*1.6)continue;   // sails burnt through
      if(sinking&&mesh.pos[o+2]<-.03&&mesh.pos[o+5]<-.03&&mesh.pos[o+8]<-.03)continue;           // under water
      for(let k=0;k<9;k++)pos.push(mesh.pos[o+k]);col.push(char?tint(mesh.col[t],char):mesh.col[t]);
    }
    return{pos,col};
  }
  // Fire points of a burning ship (model space): along the deck, on the castles, up the masts.
  function firePoints(ship){
    const m=model(ship),c=m.crew,pts=[];
    c.deck.forEach((p,i)=>pts.push([p[0],(i%3-1)*c.half*.6,p[2]]));
    for(const k of c.castles)pts.push([(k.x0+k.x1)/2,0,k.z],[k.x0,k.b*.6,k.z]);
    for(const mm of c.masts)pts.push(mm.climb.at(-1),mm.aloft[0]);
    return pts;
  }
  function sprites(ship,now){
    const out=[],liv=liveryOf(ship),f=fireOf(ship);
    for(const s of ship.soldiers||[]){
      const w=worldOf(s),foe=s.foe&&!s.foe.dead?worldOf(s.foe):null,dir=foe?{x:foe.x-w.x,y:foe.y-w.y}:s.dir||{x:Math.cos(ship.pose.heading),y:Math.sin(ship.pose.heading)};
      if(w.z<-.05)continue;
      out.push({...w,draw:()=>{
        const z=w.z-(typeof terrainElevation==='function'?terrainElevation(w):0);
        const pose=CA()?CA().pose(s,0,w,{x:w.x+dir.x,y:w.y+dir.y}):null;
        CA()?CA().drawFigure({x:w.x,y:w.y},z,s.type==='infantry'?'infantry':s.type,s.id,now%1,liv,pose):drawSoldierFigureUnmasked({x:w.x,y:w.y},z,s.type,s.id,0,liv);
      }});
    }
    // Flames and smoke on a burning ship, more of them as the fire grows; out under water.
    if(f>.05&&window.ConquerFire?.flame){
      const pts=firePoints(ship),n=Math.ceil(pts.length*Math.min(1,f*1.3));
      for(let i=0;i<n;i++){
        const w=S().toWorld(ship.pose,pts[(i*7)%pts.length]);if(w.z<0)continue;
        out.push({...w,z:w.z+.2,draw:()=>{
          const p=w2sRaw(w,w.z),size=Math.max(2,State.view.scale*5*(.6+f));
          window.ConquerFire.smoke(ctx,p,size,now,i,.35*f);window.ConquerFire.flame(ctx,p,size,now,i);
        }});
      }
    }
    return out;
  }
  // Arrows, the boarding plank and the foam of a sinking hull, over the ships.
  function plankMesh(){
    const p=battle?.plank;if(!p)return null;
    const dx=p.b.x-p.a.x,dy=p.b.y-p.a.y,L=Math.hypot(dx,dy)||1,nx=-dy/L*.22,ny=dx/L*.22,pos=[],col=[];
    const q=[[p.a.x+nx,p.a.y+ny,p.a.z],[p.b.x+nx,p.b.y+ny,p.b.z],[p.b.x-nx,p.b.y-ny,p.b.z],[p.a.x-nx,p.a.y-ny,p.a.z]];
    for(const tri of [[0,1,2],[0,2,3]]){for(const i of tri)pos.push(...q[i]);col.push('#9b7044')}
    for(const z of [-.06])for(const tri of [[0,1,2],[0,2,3]]){for(const i of tri)pos.push(q[i][0],q[i][1],q[i][2]+z);col.push('#5b3b22')}
    return{pos,col};
  }
  function drawOverlay(now){
    const b=battle;if(!b)return;
    ctx.save();ctx.lineCap='round';
    for(const a of b.arrows){
      const u=a.t,h=Math.min(2.5,Math.hypot(a.to.x-a.from.x,a.to.y-a.from.y)*.12);
      const at=k=>({x:a.from.x+(a.to.x-a.from.x)*k,y:a.from.y+(a.to.y-a.from.y)*k,z:a.from.z+(a.to.z-a.from.z)*k+Math.sin(Math.PI*k)*h});
      const p=at(u),q=at(Math.max(0,u-.06)),P=w2sRaw(p,p.z),Q=w2sRaw(q,q.z);
      ctx.strokeStyle='#3b2a1a';ctx.lineWidth=Math.max(1,State.view.scale*.6);
      ctx.beginPath();ctx.moveTo(Q.x,Q.y);ctx.lineTo(P.x,P.y);ctx.stroke();
      if(a.fire&&window.ConquerFire?.flame)window.ConquerFire.flame(ctx,P,Math.max(1.5,State.view.scale*1.6),now,u*10);
    }
    if(b.phase==='sink'){
      const m=model(b.D),u=Math.min(1,b.t/SINK),c=w2sRaw(b.D.pose,0),s=U*State.view.scale;
      ctx.strokeStyle='rgba(235,240,236,'+(.55*(1-u*.6)).toFixed(3)+')';ctx.lineWidth=Math.max(1,s*.08);
      ctx.beginPath();ctx.ellipse(c.x,c.y,m.L*s*.55*(1+u*.4),m.L*s*.28*(1+u*.4),0,0,Math.PI*2);ctx.stroke();
    }
    ctx.restore();
  }
  const active=()=>!!battle&&battle.phase!=='done';
  window.ConquerNavalBattle=Object.freeze({start,step,active,garrison,dress,sprites,plankMesh,drawOverlay,liveryOf,
    get state(){return battle},end(){battle=null}});
})();
