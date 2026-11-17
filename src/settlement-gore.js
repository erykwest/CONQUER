'use strict';
// GORE-01: battlefield aftermath left by real combat events — blood stains on hits,
// arrows stuck in the ground (misses) and in bodies, corpses, decapitations and
// mutilations. Transient visual state like the snow footprints: no save/schema
// changes and no invented marks; everything comes from combat-rules events.
// Same linear fade as ConquerSnowTracks, over twice its duration (2 simulation days).
// Player option (DEV panel · VIOLENZA): localStorage 'conquer.gore.v1' = '0' turns it off.
(function(){
  const KEEP_DAYS=2,MAX_STAINS=1400,MAX_ARROWS=700,MAX_CORPSES=260,MIN_FADE=.09;
  const STORE_KEY='conquer.gore.v1';
  const stains=[],arrows=[],corpses=[];
  const wounds=new WeakMap();   // unit -> {arrows,cause,source}
  let lastDay=0,serial=0;
  let enabled=(()=>{try{return localStorage.getItem(STORE_KEY)!=='0'}catch{return true}})();

  const realNow=()=>performance.now()/1000;
  // State is a classic-script global (not on window): read it through typeof.
  const S=()=>typeof State!=='undefined'?State:null;
  const today=()=>Number.isFinite(S()?.clock?.day)?S().clock.day:0;
  // Deterministic per-event randomness (QA-repeatable, no Math.random drift).
  function hash(s){let h=2166136261;for(const ch of String(s)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
  function rng(seed){let x=hash(seed)||1;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return((x>>>0)%100000)/100000}}

  function onLand(p){
    if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y))return false;
    if(typeof WORLD==='number'&&(p.x<0||p.y<0||p.x>WORLD||p.y>WORLD))return false;
    const env=S()?.environment||[];
    if(typeof environmentContains==='function'&&env.some(f=>
      ['sea','pond','river','stream'].includes(f.type)&&environmentContains(f,p,.05)))return false;
    return true;
  }
  function trim(day){
    // Lists are not strictly day-ordered (time travel in DEV, staged marks): filter all of them.
    for(const list of [stains,arrows,corpses]){
      if(!list.some(m=>m.day<day-KEEP_DAYS))continue;
      let w=0;for(const m of list)if(m.day>=day-KEEP_DAYS)list[w++]=m;list.length=w;
    }
    if(stains.length>MAX_STAINS)stains.splice(0,stains.length-MAX_STAINS);
    if(arrows.length>MAX_ARROWS)arrows.splice(0,arrows.length-MAX_ARROWS);
    if(corpses.length>MAX_CORPSES)corpses.splice(0,corpses.length-MAX_CORPSES);
    if(window.__conquerPerf)window.__conquerPerf.goreMarks=stains.length+arrows.length+corpses.length;
  }
  function reset(){stains.length=0;arrows.length=0;corpses.length=0;serial=0}
  function setEnabled(on){
    enabled=!!on;
    try{localStorage.setItem(STORE_KEY,enabled?'1':'0')}catch{}
    if(!enabled)reset();
    syncToggle();
    if(typeof requestSceneDraw==='function')requestSceneDraw();
    return enabled;
  }
  const wound=u=>{let w=wounds.get(u);if(!w){w={arrows:0,cause:null,source:null};wounds.set(u,w)}return w};

  // --- event intake (called by settlement-combat-rules.js) -------------------------
  function addStain(p,o={}){
    if(!enabled||!onLand(p))return null;
    const s={kind:o.kind||'splat',x:p.x,y:p.y,z:o.z||0,day:o.day??today(),showAt:o.showAt??realNow(),
      size:o.size||1,dx:o.dx||0,dy:o.dy||0,seed:o.seed||('st'+(++serial))};
    stains.push(s);trim(s.day);return s;
  }
  function addArrow(p,o={}){
    if(!enabled||!onLand(p))return null;
    const a={x:p.x,y:p.y,z:o.z||0,ux:o.ux??1,uy:o.uy??0,day:o.day??today(),showAt:o.showAt??realNow(),
      tilt:o.tilt??.62,seed:o.seed||('ar'+(++serial))};
    arrows.push(a);trim(a.day);return a;
  }
  function addCorpse(p,o={}){
    if(!enabled||!onLand(p))return null;
    const c={x:p.x,y:p.y,z:o.z||0,day:o.day??today(),showAt:o.showAt??realNow(),fadeIn:o.fadeIn??0,
      figure:o.figure||'spearman',id:o.id||('corpse'+(++serial)),livery:o.livery||null,enemy:!!o.enemy,
      fx:o.fx??1,fy:o.fy??0,mut:o.mut||'none',arrows:o.arrows||[],seed:o.seed||('cp'+serial),
      pool:o.pool??1,poolAt:o.poolAt??(o.showAt??realNow())};
    corpses.push(c);trim(c.day);return c;
  }
  function hit(target,cause,source,delay=0){
    if(!enabled||!target||!Number.isFinite(target.x))return;
    const w=wound(target);w.cause=cause;w.source=source||null;
    if(cause==='arrow')w.arrows++;
    const r=rng('hit'+(target.id||'')+':'+(++serial));
    // Blood sprays away from the blow.
    let dx=r()-.5,dy=r()-.5;
    if(source&&Number.isFinite(source.x)){
      const d=Math.hypot(target.x-source.x,target.y-source.y)||1;dx=(target.x-source.x)/d;dy=(target.y-source.y)/d;
    }
    const off=.12+r()*.25;
    addStain({x:target.x+dx*off+(r()-.5)*.2,y:target.y+dy*off+(r()-.5)*.2},
      {kind:'splat',z:target.z||0,showAt:realNow()+delay,size:cause==='stone'?1.5:cause==='melee'?1.15:.85,dx,dy});
  }
  function miss(shot,target){
    if(!enabled||!shot?.from||!shot?.to)return;
    const dx=shot.to.x-shot.from.x,dy=shot.to.y-shot.from.y,d=Math.hypot(dx,dy)||1,ux=dx/d,uy=dy/d;
    const r=rng('miss'+(++serial)+':'+Math.round(shot.to.x*10)+':'+Math.round(shot.to.y*10));
    const over=.25+r()*1.1,side=(r()-.5)*.9;
    addArrow({x:shot.to.x+ux*over-uy*side,y:shot.to.y+uy*over+ux*side},
      {z:target?.z||0,ux,uy,tilt:.45+r()*.4,showAt:realNow()+(shot.duration||0)});
  }
  // How each soldier type is drawn: same mapping as settlement-combat-render.js.
  function figureOf(u){
    if(u.faction){
      return u.kind==='knight'||u.combatKind==='knight'?'knight':u.kind==='archer'||u.combatKind==='archer'?'archer'
        :u.weapon==='axe'?'axeman':'spearman';
    }
    return u.kind==='knight'||u.kind==='captain'?'knight':u.kind==='archer'?'archer':'spearman';
  }
  function formation(u){
    if(u.faction||['knight','captain','archer','infantry'].includes(u.kind))return[{x:u.x,y:u.y}];
    const count=u.kind==='patrol'?2:5,out=[];
    for(let i=0;i<count;i++){
      const row=Math.floor(i/3),col=i%3,spacing=.55;
      const offset=count===2?(i?spacing/2:-spacing/2):(col-1)*spacing;
      out.push({x:u.x+offset,y:u.y+(row-.4)*spacing});
    }
    return out;
  }
  function chooseMutilation(cause,source,r){
    const roll=r();
    if(cause==='stone')return roll<.7?'crushed':'none';
    if(cause==='arrow')return'none';
    const axe=source?.weapon==='axe',mounted=source&&(source.kind==='knight'||source.combatKind==='knight'||source.kind==='captain');
    const [decap,cleave,arm]=axe?[.4,.25,.15]:mounted?[.3,.1,.2]:[.16,.1,.14];
    if(roll<decap)return'decap';
    if(roll<decap+cleave)return'cleave';
    if(roll<decap+cleave+arm)return'arm';
    return'none';
  }
  function died(u,delay=0,foe=null,timing=null){
    if(!enabled||!u||!Number.isFinite(u.x))return;
    const w=wounds.get(u)||{arrows:0,cause:'melee',source:foe};
    const cause=w.cause||'melee',source=w.source||foe;
    // Corpses fade in while the falling figure fades out (combat-anim FADE_FROM -> GONE).
    const fadeFrom=timing?.FADE_FROM??.9,gone=timing?.GONE??1.8;
    const showAt=realNow()+delay+fadeFrom,fadeIn=Math.max(.01,gone-fadeFrom);
    let fx=1,fy=0;
    if(foe&&Number.isFinite(foe.x)){const d=Math.hypot(foe.x-u.x,foe.y-u.y);if(d>.01){fx=(foe.x-u.x)/d;fy=(foe.y-u.y)/d}}
    if(u.kind==='wolf'||u.faction==='wildlife'){
      addStain(u,{kind:'pool',z:u.z||0,showAt:realNow()+delay,size:.8});return;
    }
    const livery=u.faction?window.ConquerCombatRules?.liveryOf?.(u.faction)||null:null;
    const figure=figureOf(u),spots=formation(u);
    spots.forEach((p,i)=>{
      const r=rng('dead'+(u.id||serial)+':'+i);
      // The killing blow lands on one man of a squad; the rest fall to the same melee.
      const own=i===0?cause:(cause==='arrow'?(r()<.5?'arrow':'melee'):cause);
      const mut=chooseMutilation(own,source,r);
      const n=own==='arrow'?Math.max(1,Math.min(5,i===0?w.arrows:1+Math.floor(r()*2))):(w.arrows>0&&i===0?Math.min(3,w.arrows):0);
      const stuck=[];
      for(let k=0;k<n;k++)stuck.push({u:(r()-.5)*.8,v:.15+r()*.75,phi:Math.PI*(.28+r()*.44)});
      const jitter={x:p.x+(r()-.5)*.12,y:p.y+(r()-.5)*.12};
      const c=addCorpse(jitter,{z:u.z||0,showAt:showAt+i*.04,fadeIn,figure,id:(u.id||'u')+':'+i,livery,
        enemy:!!u.faction,fx,fy,mut,arrows:stuck});
      // The pool spreads from the moment of the blow, under the torso (drawn with the corpse).
      if(c){c.poolAt=realNow()+delay+.15;c.pool=mut==='decap'||mut==='cleave'?1.45:mut==='crushed'?1.3:1}
    });
    wounds.delete(u);
  }

  // --- drawing -------------------------------------------------------------------
  // Fresh blood is bright; it browns and dries over the two days, while fading.
  function bloodColor(age,alpha){
    const t=Math.min(1,Math.max(0,age/KEEP_DAYS));
    const r=Math.round(128-58*t),g=Math.round(14+10*t),b=Math.round(12+6*t);
    return'rgba('+r+','+g+','+b+','+alpha.toFixed(3)+')';
  }
  const fadeOf=age=>Math.max(MIN_FADE,1-age/KEEP_DAYS);
  function viewScale(){return Math.max(.2,S()?.view?.scale||1)}
  function drawSplat(s,day,now,bounds){
    if(now<s.showAt)return;
    const age=Math.max(0,day-s.day),k=fadeOf(age);
    const ground=(typeof terrainElevation==='function'?terrainElevation(s):0)+s.z+.02;
    const at=w2sRaw(s,ground);
    if(bounds&&(at.x<-40||at.y<-40||at.x>bounds.w||at.y>bounds.h))return;
    const sc=viewScale(),r=rng(s.seed);
    const grow=s.kind==='pool'?Math.sqrt(Math.min(1,(now-s.showAt)/2.5)):1;
    ctx.save();
    if(s.kind==='pool'){
      const rx=3.2*sc*s.size*grow;
      ctx.fillStyle=bloodColor(age,.78*k);
      ctx.beginPath();ctx.ellipse(at.x,at.y,rx,rx*.44,0,0,Math.PI*2);ctx.fill();
      for(let i=0;i<4;i++){
        const a=r()*Math.PI*2,d=rx*(.55+r()*.45),rr=rx*(.22+r()*.25);
        ctx.beginPath();ctx.ellipse(at.x+Math.cos(a)*d,at.y+Math.sin(a)*d*.44,rr,rr*.44,0,0,Math.PI*2);ctx.fill();
      }
    }else{
      // Splatter: one blot and droplets thrown along the blow, flattened on the ground.
      const sx=w2sRaw({x:s.x+s.dx,y:s.y+s.dy},ground),vx=sx.x-at.x,vy=sx.y-at.y,vl=Math.hypot(vx,vy)||1;
      const ux=vx/vl,uy=vy/vl,base=1.5*sc*s.size;
      ctx.fillStyle=bloodColor(age,.8*k);
      ctx.beginPath();ctx.ellipse(at.x,at.y,base,base*.5,0,0,Math.PI*2);ctx.fill();
      for(let i=0;i<7;i++){
        const d=base*(.8+r()*3.2),spread=(r()-.5)*base*1.6,rr=Math.max(.45,base*(.12+r()*.28));
        ctx.beginPath();ctx.ellipse(at.x+ux*d-uy*spread*.5,at.y+(uy*d+ux*spread)*.5,rr,rr*.55,0,0,Math.PI*2);ctx.fill();
      }
    }
    ctx.restore();
  }
  function drawArrowShaft(x,y,dx,dy,len,sc,alpha){
    // Shaft from the buried tip (x,y) out along (dx,dy) on screen; grey-goose fletching at the end.
    const ex=x+dx*len,ey=y+dy*len;
    ctx.strokeStyle='rgba(102,78,50,'+alpha.toFixed(3)+')';ctx.lineWidth=Math.max(.7,.75*sc);
    ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(ex,ey);ctx.stroke();
    const nx=-dy,ny=dx,f=Math.max(1,.85*sc);
    ctx.strokeStyle='rgba(226,220,204,'+alpha.toFixed(3)+')';ctx.lineWidth=Math.max(.8,1*sc);
    ctx.beginPath();
    ctx.moveTo(ex-dx*f*.2,ey-dy*f*.2);ctx.lineTo(ex-dx*f*1.4+nx*f*.75,ey-dy*f*1.4+ny*f*.75);
    ctx.moveTo(ex-dx*f*.2,ey-dy*f*.2);ctx.lineTo(ex-dx*f*1.4-nx*f*.75,ey-dy*f*1.4-ny*f*.75);
    ctx.stroke();
  }
  function drawGroundArrow(a,day,now,bounds){
    if(now<a.showAt)return;
    const age=Math.max(0,day-a.day),k=fadeOf(age);
    const ground=(typeof terrainElevation==='function'?terrainElevation(a):0)+a.z;
    const tip=w2sRaw(a,ground);
    if(bounds&&(tip.x<-40||tip.y<-40||tip.x>bounds.w||tip.y>bounds.h))return;
    // The shaft points back toward the shooter and up out of the ground.
    const tail=w2sRaw({x:a.x-a.ux*.22,y:a.y-a.uy*.22},ground+.22*a.tilt+.08);
    const dx=tail.x-tip.x,dy=tail.y-tip.y,len=Math.hypot(dx,dy)||1;
    const sc=viewScale()*.5,L=Math.max(3,5.2*sc);
    ctx.save();
    ctx.fillStyle='rgba(60,44,30,'+(.35*k).toFixed(3)+')';
    ctx.beginPath();ctx.ellipse(tip.x,tip.y,1.2*sc,.5*sc,0,0,Math.PI*2);ctx.fill();
    drawArrowShaft(tip.x,tip.y,dx/len,dy/len,L,sc,.95*k);
    ctx.restore();
  }
  function helmetFor(c){return c.enemy||c.livery?'cap':(typeof soldierHelmetStyle==='function'?soldierHelmetStyle():'cap')}
  function rotateAbout(px,py,ox,oy,a){const s=Math.sin(a),co=Math.cos(a),x=px-ox,y=py-oy;return{x:ox+x*co-y*s,y:oy+x*s+y*co}}
  function drawDroppedWeapon(c,base,scale,side,r){
    const y=base.y+2.4*scale,x0=base.x-side*1.5*scale;
    ctx.save();ctx.lineCap='round';
    if(c.figure==='spearman'){
      const x1=base.x+side*14*scale,y1=y-1.5*scale;
      ctx.strokeStyle='#7a5937';ctx.lineWidth=Math.max(1,1.05*scale);
      ctx.beginPath();ctx.moveTo(x0,y+.6*scale);ctx.lineTo(x1,y1);ctx.stroke();
      ctx.fillStyle='#b8bcc0';ctx.beginPath();
      ctx.moveTo(x1+side*3*scale,y1-.5*scale);ctx.lineTo(x1,y1-1.4*scale);ctx.lineTo(x1,y1+1.1*scale);ctx.closePath();ctx.fill();
    }else if(c.figure==='archer'){
      const bx=base.x-side*3*scale,by=y+1.6*scale,rr=5*scale;
      ctx.strokeStyle='#9b7243';ctx.lineWidth=Math.max(.8,.85*scale);
      ctx.beginPath();ctx.ellipse(bx,by,rr,rr*.35,0,Math.PI*1.05,Math.PI*1.95);ctx.stroke();
    }else if(c.figure==='axeman'){
      const x1=base.x-side*7*scale,y1=y+2*scale;
      ctx.strokeStyle='#6e4f30';ctx.lineWidth=Math.max(1,1.2*scale);
      ctx.beginPath();ctx.moveTo(x0,y);ctx.lineTo(x1,y1);ctx.stroke();
      ctx.fillStyle='#a9adb0';ctx.beginPath();ctx.ellipse(x1,y1,1.8*scale,1.2*scale,0,0,Math.PI*2);ctx.fill();
    }else{
      // Sword (knight, captain): blade, crossguard and grip, dropped beside the body.
      const x1=base.x+side*(6+r*3)*scale,y1=y+1.4*scale;
      ctx.strokeStyle='#c4c7c8';ctx.lineWidth=Math.max(1,1.1*scale);
      ctx.beginPath();ctx.moveTo(x0,y);ctx.lineTo(x1,y1);ctx.stroke();
      ctx.strokeStyle='#76563b';ctx.lineWidth=Math.max(1,1.2*scale);
      ctx.beginPath();ctx.moveTo(x0,y-1.3*scale);ctx.lineTo(x0,y+1.3*scale);ctx.stroke();
    }
    ctx.restore();
  }
  function drawHead(c,hx,hy,headR,scale,rot){
    ctx.save();ctx.translate(hx,hy);ctx.rotate(rot);ctx.translate(-hx,-hy);
    ctx.fillStyle=typeof VILLAGER_SKIN==='string'?VILLAGER_SKIN:'#d99a83';
    ctx.beginPath();ctx.arc(hx,hy,headR,0,Math.PI*2);ctx.fill();
    if(typeof drawSoldierHelmet==='function')drawSoldierHelmet(hx,hy,headR,helmetFor(c),scale);
    ctx.fillStyle='#8a1410';ctx.beginPath();ctx.ellipse(hx,hy+headR*.92,headR*.62,headR*.28,0,0,Math.PI*2);ctx.fill();
    ctx.restore();
  }
  function drawSeveredArm(c,x,y,scale,rot){
    const L=4.8*scale,W=1.45*scale,liv=c.livery||(typeof soldierLivery==='function'?soldierLivery(c.id):{main:'#b53636'});
    ctx.save();ctx.translate(x,y);ctx.rotate(rot);
    ctx.fillStyle=liv.main||'#b53636';ctx.strokeStyle='rgba(25,24,22,.85)';ctx.lineWidth=Math.max(.5,.6*scale);
    ctx.beginPath();ctx.rect(-L/2,-W/2,L,W);ctx.fill();ctx.stroke();
    ctx.fillStyle=typeof VILLAGER_SKIN==='string'?VILLAGER_SKIN:'#d99a83';
    ctx.beginPath();ctx.arc(L/2+W*.45,0,W*.55,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#8a1410';ctx.beginPath();ctx.ellipse(-L/2,0,W*.3,W*.55,0,0,Math.PI*2);ctx.fill();
    ctx.restore();
  }
  // Corpse at screen point `base` (feet), lying away from its killer. `side` is -1/+1
  // as the combat animation's fall; drawn by the game's own soldier figure code.
  function drawCorpseAt(c,p,z,base,side,alpha){
    const scale=militaryScale(),bodyW=5.4*scale,bodyH=8*scale,headR=2.2*scale;
    const bodyY=base.y-bodyH*.16,top=bodyY-bodyH/2;
    const r=rng(c.seed),theta=side*1.45;
    ctx.save();ctx.globalAlpha*=alpha;
    if(window.ConquerLOD?.militaryTier?.()==='dot'){
      ctx.fillStyle=window.ConquerLOD.militaryColor?.(c.figure,c.livery)||'#6b3a32';
      ctx.beginPath();ctx.ellipse(base.x+side*2,base.y,2.6,1.2,0,0,Math.PI*2);ctx.fill();
      ctx.restore();return;
    }
    const neck=rotateAbout(base.x,top,base.x,base.y,theta);
    // Blood trail from the neck to the rolled head; the dropped weapon lies under the body.
    if(c.mut==='decap'){
      const hx=neck.x+side*(headR*4.2+r()*headR*2.6),hy=neck.y+(r()-.3)*2.2*scale+bodyH*.12;
      ctx.fillStyle='rgba(118,16,13,.75)';
      for(let i=1;i<=5;i++){const t=i/6;ctx.beginPath();ctx.ellipse(neck.x+(hx-neck.x)*t,neck.y+(hy-neck.y)*t+1.2*scale,
        (1.6-t*.7)*scale,(.7-t*.25)*scale,0,0,Math.PI*2);ctx.fill()}
      c._head={x:hx,y:hy};
    }
    r();r();
    drawDroppedWeapon(c,base,scale,side,r());
    ctx.save();
    ctx.translate(base.x,base.y);ctx.rotate(theta);ctx.translate(-base.x,-base.y);
    const body=()=>drawSoldierFigureUnmasked(p,z,'unarmed',c.id,0,c.livery);   // weapon lies on the ground
    if(c.mut==='decap'){
      ctx.save();ctx.beginPath();ctx.rect(base.x-bodyW*2,top+.35*scale,bodyW*4,bodyH*2);ctx.clip();body();ctx.restore();
      ctx.fillStyle='#8a1410';ctx.beginPath();ctx.ellipse(base.x,top+.5*scale,bodyW*.34,bodyW*.16,0,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#e7d9c4';ctx.beginPath();ctx.arc(base.x,top+.5*scale,Math.max(.4,.45*scale),0,Math.PI*2);ctx.fill();
    }else if(c.mut==='cleave'){
      const cutY=bodyY+bodyH*.02,gap=2.4*scale;
      ctx.save();ctx.beginPath();ctx.rect(base.x-bodyW*2,cutY,bodyW*4,bodyH*2);ctx.clip();body();ctx.restore();
      ctx.fillStyle='#8a1410';ctx.fillRect(base.x-bodyW*.47,cutY-.2*scale,bodyW*.94,1.1*scale);
      // Upper half slides along the body axis and twists slightly about the cut, not the canvas origin.
      ctx.save();ctx.translate(base.x,cutY-gap);ctx.rotate(side*.05);ctx.translate(-base.x,-cutY);
      ctx.beginPath();ctx.rect(base.x-bodyW*2,cutY-bodyH*3,bodyW*4,bodyH*3);ctx.clip();body();ctx.restore();
      ctx.fillStyle='#8a1410';ctx.fillRect(base.x-bodyW*.45,cutY-gap-.9*scale,bodyW*.9,1.1*scale);
      // Entrails between the halves.
      ctx.fillStyle='rgba(150,38,40,.95)';
      for(let i=0;i<3;i++){ctx.beginPath();ctx.ellipse(base.x+(i-1)*bodyW*.25,cutY-gap*.5,.9*scale,.75*scale,0,0,Math.PI*2);ctx.fill()}
    }else{
      body();
      if(c.mut==='crushed'){
        ctx.fillStyle='rgba(118,16,13,.55)';ctx.beginPath();ctx.arc(base.x,top-headR*.6,headR*1.1,0,Math.PI*2);ctx.fill();
      }
    }
    ctx.restore();
    if(c.mut==='decap'&&c._head)drawHead(c,c._head.x,c._head.y,headR,scale,side*(1.2+r()*1.5));
    if(c.mut==='arm'){
      const shoulder=rotateAbout(base.x+bodyW*.5,top+bodyH*.15,base.x,base.y,theta);
      ctx.fillStyle='rgba(118,16,13,.7)';ctx.beginPath();ctx.ellipse(shoulder.x,shoulder.y+1.5*scale,1.8*scale,.8*scale,0,0,Math.PI*2);ctx.fill();
      drawSeveredArm(c,base.x+side*bodyH*.3,base.y+3.6*scale+r()*1.2*scale,scale,(r()-.5)*.9);
    }
    if(c.mut==='crushed'){
      // The stone that fell from the hoarding stays beside the body.
      const s=rotateAbout(base.x,top+bodyH*.1,base.x,base.y,theta);
      ctx.fillStyle='#8e877c';ctx.strokeStyle='#4a453f';ctx.lineWidth=Math.max(.6,.7*scale);
      ctx.beginPath();ctx.ellipse(s.x,s.y-1.2*scale,3*scale,2.3*scale,.3,0,Math.PI*2);ctx.fill();ctx.stroke();
    }
    // Arrows stuck in the body point up out of the torso.
    for(const a of c.arrows){
      const lx=base.x+a.u*bodyW*.8,ly=top+a.v*bodyH;
      const q=rotateAbout(lx,ly,base.x,base.y,theta);
      drawArrowShaft(q.x,q.y,Math.cos(a.phi)*(side<0?1:-1),-Math.sin(a.phi),Math.max(3,4.6*scale),scale,1);
      ctx.fillStyle='rgba(118,16,13,.85)';ctx.beginPath();ctx.ellipse(q.x,q.y,.9*scale,.55*scale,0,0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
  }
  // Pool under the torso (and, beheaded/cleaved, the larger spill at the wound).
  function drawCorpsePool(c,base,side,age,now){
    if(now<c.poolAt)return;
    const scale=militaryScale(),bodyH=8*scale,r=rng(c.seed+'pool');
    const grow=Math.sqrt(Math.min(1,(now-c.poolAt)/2.5)),rx=5.8*scale*c.pool*grow;
    const cx=base.x+side*bodyH*.42,cy=base.y+1.4*scale;
    ctx.save();
    ctx.fillStyle=bloodColor(age,.8*fadeOf(age));
    ctx.beginPath();ctx.ellipse(cx,cy,rx,rx*.42,0,0,Math.PI*2);ctx.fill();
    for(let i=0;i<4;i++){
      const a=r()*Math.PI*2,d=rx*(.5+r()*.45),rr=rx*(.22+r()*.22);
      ctx.beginPath();ctx.ellipse(cx+Math.cos(a)*d,cy+Math.sin(a)*d*.42,rr,rr*.42,0,0,Math.PI*2);ctx.fill();
    }
    if(c.mut==='decap'||c.mut==='cleave'){
      const wx=base.x+side*bodyH*(c.mut==='decap'?.7:.3),wr=rx*.62;
      ctx.beginPath();ctx.ellipse(wx,cy-.4*scale,wr,wr*.45,0,0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
  }
  function drawCorpse(c,day,now,bounds,pass='body'){
    if(typeof drawSoldierFigureUnmasked!=='function')return;
    const age=Math.max(0,day-c.day);
    if(pass==='body'&&now<c.showAt)return;
    const appear=c.fadeIn>0?Math.min(1,Math.max(0,(now-c.showAt)/c.fadeIn)):1;
    const alpha=fadeOf(age)*appear;
    const p={x:c.x,y:c.y},z=.08+c.z,ground=terrainElevation(p);
    withProjectionGroundZ(ground,()=>{
      const base=w2s(p,z);
      if(bounds&&(base.x<-80||base.y<-80||base.x>bounds.w+50||base.y>bounds.h+50))return;
      const a=w2sRaw(p,0),f=w2sRaw({x:p.x+c.fx,y:p.y+c.fy},0),side=f.x-a.x>0?-1:1;
      if(pass==='pool')drawCorpsePool(c,base,side,age,now);
      else if(alpha>0)drawCorpseAt(c,p,z,base,side,alpha);
    });
  }
  function draw(){
    if(!enabled||(!stains.length&&!arrows.length&&!corpses.length))return;
    const day=today();
    if(day<lastDay)reset();
    lastDay=day;trim(day);
    const now=realNow(),rect=typeof wrap!=='undefined'?wrap.getBoundingClientRect():{width:1e5,height:1e5};
    const bounds={w:rect.width+40,h:rect.height+40};
    ctx.save();
    for(const s of stains)drawSplat(s,day,now,bounds);
    for(const a of arrows)drawGroundArrow(a,day,now,bounds);
    const order=typeof viewDepthPoint==='function'?corpses.slice().sort((a,b)=>viewDepthPoint(a)-viewDepthPoint(b)):corpses;
    for(const c of order)drawCorpse(c,day,now,bounds,'pool');
    for(const c of order)drawCorpse(c,day,now,bounds,'body');
    ctx.restore();
  }
  // Asset Lab sample (figures-lab / asset-catalog): screen-space world, no terrain.
  const LAB_VARIANTS={
    corpse:{mut:'none'},arrows:{mut:'none',arrows:3},decap:{mut:'decap'},cleave:{mut:'cleave'},arm:{mut:'arm'},crushed:{mut:'crushed'},
    enemy:{mut:'decap',enemy:true,figure:'axeman'},field:null
  };
  function drawLabSample(g,w,h,variant='corpse'){
    const previous=ctx,oldScale=State.view.scale;
    try{
      ctx=g;State.view.scale=Math.min(w*.07,h*.12);
      const hostile={main:'#171716',alt:'#e3bd31',mainDark:'#090909',altDark:'#95781a'};
      const one=(x,y,v,id,side=1)=>{
        const o=LAB_VARIANTS[v]||LAB_VARIANTS.corpse,r=rng('lab'+id);
        const c={id:'lab-'+id,seed:'lab-'+id,figure:o.figure||'spearman',enemy:!!o.enemy,livery:o.enemy?hostile:null,mut:o.mut,arrows:[]};
        for(let i=0;i<(o.arrows||0);i++)c.arrows.push({u:(r()-.5)*.8,v:.15+r()*.7,phi:Math.PI*(.3+r()*.4)});
        c.pool=o.mut==='decap'||o.mut==='cleave'?1.45:o.mut==='crushed'?1.3:1;c.poolAt=-1e9;
        drawCorpsePool(c,{x,y},side,0,0);
        drawCorpseAt(c,{x,y},0,{x,y},side,1);
      };
      if(variant==='field'){
        State.view.scale=Math.min(w*.032,h*.055);
        drawSplat({kind:'splat',x:w*.2,y:h*.85,z:0,day:0,showAt:-1e9,size:1.2,dx:1,dy:.2,seed:'labsplat'},0,0,null);
        for(let i=0;i<5;i++)drawGroundArrow({x:w*(.12+i*.17),y:h*(.9-(i%2)*.08),z:0,ux:-1,uy:.2,tilt:.6,day:0,showAt:-1e9},0,0,null);
        [['corpse',.18,.55,1],['decap',.42,.45,-1],['arrows',.66,.6,1],['cleave',.84,.42,-1]].forEach(([v,fx,fy,sd],i)=>one(w*fx,h*fy,v,'f'+i,sd));
      }else one(w*.3,h*.62,variant,variant,1);
    }finally{ctx=previous;State.view.scale=oldScale}
  }
  // DEV panel switch (#goreToggle): label and aria-pressed follow the stored preference.
  function syncToggle(){
    const b=typeof document!=='undefined'&&document.getElementById?.('goreToggle');
    if(!b)return;
    b.textContent=enabled?'🩸 Gore ON':'Gore OFF';b.setAttribute('aria-pressed',String(enabled));
  }
  function bindToggle(){
    const b=typeof document!=='undefined'&&document.getElementById?.('goreToggle');
    if(!b||b.dataset.goreBound)return;
    b.dataset.goreBound='1';b.addEventListener('click',()=>{setEnabled(!enabled);syncToggle()});syncToggle();
  }
  if(typeof document!=='undefined'&&document.addEventListener){
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bindToggle);else bindToggle();
  }
  window.ConquerGore={hit,miss,died,draw,reset,addStain,addArrow,addCorpse,drawLabSample,
    enabled:()=>enabled,setEnabled,
    count:()=>stains.length+arrows.length+corpses.length,
    snapshot:()=>({stains:stains.slice(),arrows:arrows.slice(),corpses:corpses.slice()}),
    fadeAt:age=>fadeOf(age),
    LAB_VARIANTS:Object.keys(LAB_VARIANTS),
    settings:{keepDays:KEEP_DAYS,maxStains:MAX_STAINS,maxArrows:MAX_ARROWS,maxCorpses:MAX_CORPSES,storageKey:STORE_KEY}};
})();
