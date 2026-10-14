'use strict';
// CONQUER combat animation: procedural, livery-preserving soldier poses.
// Combat rules report events (strike / hurt / fall); the tactical overlay asks
// for a pose per figure and draws it. Timing is real time so swings stay legible
// at every calendar speed. No state is persisted: a WeakMap dies with entities.
(function(){
  const STRIKE=.45,HURT=.2,FALL=.38,FADE_FROM=.9,GONE=1.8,STAGGER=.065;
  const LAST=GONE+STAGGER*5;
  const state=new WeakMap();
  let clockOverride=null,lastEventEnd=-1e9;
  const now=()=>clockOverride??performance.now()/1000;
  function entry(u){
    let s=state.get(u);
    if(!s){s={strikeAt:-1e9,hurtAt:-1e9,diedAt:null,foe:null};state.set(u,s)}
    return s;
  }
  const mark=end=>{if(end>lastEventEnd)lastEventEnd=end};
  function strike(u,foe){
    const s=entry(u),t=now();
    if(foe)s.foe=foe;
    // At ×16 exchanges arrive faster than a swing: never restart mid-swing.
    if(t-s.strikeAt<STRIKE)return;
    s.strikeAt=t;mark(t+STRIKE+STAGGER*5);
  }
  function hurt(u,delay=0){const s=entry(u),t=now()+delay;s.hurtAt=t;mark(t+HURT)}
  function fall(u,delay=0,foe=null){
    const s=entry(u);
    if(s.diedAt!==null)return;
    s.diedAt=now()+delay;if(foe)s.foe=foe;mark(s.diedAt+LAST);
  }
  function dying(u){const s=state.get(u);return !!s&&s.diedAt!==null&&now()<s.diedAt+LAST}
  const active=()=>now()<lastEventEnd;
  const foeOf=u=>state.get(u)?.foe||null;
  // -.5 = weapon drawn back, 1 = full thrust, 0 = guard.
  function attackCurve(t){
    if(!(t>=0&&t<1))return 0;
    if(t<.3)return -.5*Math.sin(t/.3*Math.PI/2);
    if(t<.55)return -.5+1.5*Math.sin((t-.3)/.25*Math.PI/2);
    return Math.cos((t-.55)/.45*Math.PI/2);
  }
  function pose(u,index=0,from=null,to=null){
    const t=now(),s=state.get(u);
    let dirX=1,dirY=0;
    if(from&&to){
      const dx=to.x-from.x,dy=to.y-from.y,d=Math.hypot(dx,dy);
      if(d>.5){dirX=dx/d;dirY=dy/d}
    }
    const out={dirX,dirY,attack:0,flash:0,ready:u.engaged?1:0,bob:0,fall:0,alpha:1};
    if(u.engaged)out.bob=Math.sin(t*7+index*1.7);
    if(!s)return out;
    out.attack=attackCurve((t-s.strikeAt-index*STAGGER)/STRIKE);
    const h=(t-s.hurtAt)/HURT;
    if(h>=0&&h<1)out.flash=1-h;
    if(s.diedAt!==null){
      const d=t-s.diedAt-index*STAGGER*.6;
      if(d>0){
        const f=Math.min(1,d/FALL);
        out.fall=1-Math.pow(1-f,3);
        out.alpha=d<FADE_FROM?1:Math.max(0,1-(d-FADE_FROM)/(GONE-FADE_FROM));
        out.attack=out.ready=out.bob=0;
      }
    }
    return out;
  }
  const wrapAngle=a=>Math.atan2(Math.sin(a),Math.cos(a));

  // Same silhouette as drawSoldierFigure; the body comes from the shared
  // 'unarmed' drawing so realm heraldry stays authoritative, weapons are posed here.
  function drawFigure(p,z,type,id,phase,livery,pose){
    if(!pose)return drawSoldierFigure(p,z,type,id,phase,livery);
    if(pose.alpha<=0)return;
    // Sample terrain once: every w2s below (and in the shared body) reuses it.
    const ground=terrainElevation(p);
    return withUrbanFigureOcclusion(p,z,()=>withProjectionGroundZ(ground,()=>{
      const base=w2s(p,z),scale=militaryScale();
      const bodyW=5.4*scale,bodyH=8.0*scale,headR=2.2*scale;
      const bodyY=base.y-bodyH*.16,top=bodyY-bodyH/2,headY=top-headR*.72;
      const armed=type!=='archer'&&type!=='unarmed';
      const reach=(Math.max(0,pose.attack)*3.4-Math.max(0,-pose.attack)*1.2+pose.ready*.8-pose.flash*1.6)*scale;
      ctx.save();
      ctx.globalAlpha*=pose.alpha;
      ctx.translate(pose.dirX*reach,pose.dirY*reach*.6-Math.abs(pose.bob)*.5*scale);
      if(pose.fall>0){
        // Fall away from the foe, pivoting on the feet.
        ctx.translate(base.x,base.y);ctx.rotate((pose.dirX>0?-1:1)*pose.fall*1.45);ctx.translate(-base.x,-base.y);
      }
      drawSoldierFigureUnmasked(p,z,armed?'unarmed':type,id,phase,livery);
      if(type==='spearman')drawSpear(base,scale,bodyW,bodyH,bodyY,headY,pose);
      else if(armed)drawSword(base,scale,bodyW,bodyH,bodyY,top,id,phase,livery,pose);
      if(pose.flash>0){
        ctx.fillStyle='rgba(255,246,228,'+(.8*pose.flash).toFixed(3)+')';
        soldierBodyPath(base,bodyW,bodyH,top,bodyY);ctx.fill();
        ctx.beginPath();ctx.arc(base.x,headY,headR,0,Math.PI*2);ctx.fill();
      }
      ctx.restore();
    }));
  }
  function drawSpear(base,scale,bodyW,bodyH,bodyY,headY,pose){
    const x=base.x+bodyW*.55,gy=bodyY+bodyH*.43;
    // Pikes lower toward the foe while engaged and drive home on the thrust.
    const lowered=Math.min(1,pose.ready*.8+Math.max(0,pose.attack)*.2);
    const theta=wrapAngle(Math.atan2(pose.dirY,pose.dirX)+Math.PI/2)*lowered;
    const ext=(pose.attack>0?pose.attack*3.5:pose.attack*2)*scale;
    ctx.save();
    ctx.translate(x,gy);ctx.rotate(theta);ctx.translate(0,-ext);ctx.translate(-x,-gy);
    ctx.strokeStyle='#7a5937';ctx.lineWidth=Math.max(1,1.05*scale);
    ctx.beginPath();ctx.moveTo(x,gy);ctx.lineTo(x-1.0*scale,headY-13*scale);ctx.stroke();
    ctx.fillStyle='#b8bcc0';ctx.beginPath();
    ctx.moveTo(x-1.0*scale,headY-16*scale);ctx.lineTo(x-3.0*scale,headY-11.5*scale);ctx.lineTo(x+1.0*scale,headY-12.2*scale);ctx.closePath();ctx.fill();
    ctx.restore();
  }
  function drawSword(base,scale,bodyW,bodyH,bodyY,top,id,phase,livery,pose){
    const side=pose.dirX>=0?1:-1,swing=Math.sin(phase*Math.PI*2)*3.2*scale*(1-pose.ready);
    const guard=pose.ready*1.2*scale;
    drawQuarteredShield(base.x-bodyW*.62+pose.dirX*guard,bodyY+bodyH*.10,2.7*scale,3.6*scale,livery||soldierLivery(id),'#b7aa8f',scale,!livery);
    const hx=base.x+bodyW*.42,hy=bodyY+bodyH*.16;
    // Wind-up raises the blade back, the cut sweeps it down toward the foe.
    const theta=side*(pose.attack<0?pose.attack*.9:pose.attack*1.6)+side*pose.ready*.15;
    ctx.save();
    ctx.translate(hx,hy);ctx.rotate(theta);ctx.translate(-hx,-hy);
    ctx.strokeStyle='#c4c7c8';ctx.lineWidth=Math.max(1,1.15*scale);
    ctx.beginPath();ctx.moveTo(hx,hy);ctx.lineTo(base.x+bodyW*.80+swing,top-7.5*scale);ctx.stroke();
    ctx.strokeStyle='#76563b';ctx.lineWidth=Math.max(1,1.2*scale);
    ctx.beginPath();ctx.moveTo(base.x+bodyW*.23,bodyY+bodyH*.05);ctx.lineTo(base.x+bodyW*.52,bodyY+bodyH*.27);ctx.stroke();
    ctx.restore();
  }
  function reset(){lastEventEnd=-1e9}
  window.ConquerCombatAnim={strike,hurt,fall,dying,active,pose,foeOf,attackCurve,drawFigure,reset,
    setClock(t){clockOverride=Number.isFinite(t)?t:null},
    TIMING:Object.freeze({STRIKE,HURT,FALL,GONE,LAST,IMPACT:STRIKE*.55})};
})();
