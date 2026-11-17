'use strict';
// CONQUER mounted figures, flat 2D: the approved 2D horse (settlement-animals.js)
// with gear and a rider drawn in the foot soldiers' flat style (parted livery,
// dark outline, steel caps). Two kinds:
//   knight    - quartered caparison with a gold hem, crinet, steel chanfron and plume,
//               war saddle; rider in mail and surcoat, great helm, kite shield with the
//               realm arms, lance with a pennon;
//   messenger - riding saddle on a livery blanket, saddlebag; rider dressed like a
//               foot soldier (parted tunic, kettle hat), reins in hand.
// Everything is drawn in the horse's art space (256 box, art facing right, y down)
// through drawAnimal's onBody hook, so it follows the gait. The realm arms are
// painted un-mirrored whatever the facing.
(function(){
  const SKIN='#d99a83',STEEL='#9aa3aa',STEEL_DARK='#5d656c',MAIL='#7d858b',LEATHER='#6b4a2e',LEATHER_DARK='#45301f',
    GOLD='#d2ad4b',WOOD='#8a6a40',CLOTH='#5c4a36',HAT='#70777c',OUTLINE='rgba(25,24,22,.88)';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function poly(ctx,pts,fill,stroke,lw){
    ctx.beginPath();pts.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();
    if(fill){ctx.fillStyle=fill;ctx.fill()}
    if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lw;ctx.lineJoin='round';ctx.stroke()}
  }
  function line(ctx,a,b,color,w,cap='round'){ctx.strokeStyle=color;ctx.lineWidth=w;ctx.lineCap=cap;ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke()}
  // A limb drawn as an outlined thick stroke (the soldiers' flat look).
  function limb(ctx,pts,color,w,lw){
    for(const [c,ww] of [[OUTLINE,w+lw*2],[color,w]]){
      ctx.strokeStyle=c;ctx.lineWidth=ww;ctx.lineCap='round';ctx.lineJoin='round';
      ctx.beginPath();pts.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();
    }
  }
  // Paints the realm arms (or the parted livery) inside a clip, never mirrored.
  function arms(ctx,flip,cx,cy,w,h,clip,livery,paint){
    ctx.save();ctx.translate(cx,cy);ctx.scale(flip,1);
    ctx.beginPath();clip.forEach(([x,y],i)=>i?ctx.lineTo(x*w,y*h):ctx.moveTo(x*w,y*h));ctx.closePath();ctx.clip();
    if(!paint||!paint(ctx,-w/2,-h/2,w,h)){
      ctx.fillStyle=livery.main;ctx.fillRect(-w/2,-h/2,w,h);ctx.fillStyle=livery.alt;ctx.fillRect(0,-h/2,w/2,h);
    }
    ctx.restore();
  }
  const KITE=[[-.5,-.5],[.5,-.5],[.5,0],[0,.5],[-.5,0]];
  const BANNER=[[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]];
  // Feudal shield shapes (State.policies.unitShield) as clips in the unit box, with their size
  // in art units. Without a style the knight keeps the original pointed shield (KITE).
  const ring=(n,fx,fy)=>Array.from({length:n},(_,i)=>{const a=i/n*Math.PI*2;return[fx(a),fy(a)]});
  const SHIELD_SHAPES={
    oval:{clip:ring(24,a=>Math.cos(a)*.5,a=>Math.sin(a)*.5),w:32,h:46},
    round:{clip:ring(24,a=>Math.cos(a)*.5,a=>Math.sin(a)*.5),w:38,h:38,boss:true},
    heater:{clip:[[-.5,-.5],[.5,-.5],[.5,0],[.42,.2],[.25,.37],[0,.5],[-.25,.37],[-.42,.2],[-.5,0]],w:32,h:46},
    kite:{clip:[[-.5,-.3],[-.35,-.47],[0,-.5],[.35,-.47],[.5,-.3],[.35,.05],[0,.5],[-.35,.05]],w:30,h:60},
    pavise:{clip:[[-.5,-.38],[0,-.5],[.5,-.38],[.45,.5],[-.45,.5]],w:34,h:62,ridge:true}
  };

  // ---------- horse gear
  // Drape over the barrel with a dagged (scalloped) hem, longer at the chest and rump.
  const CAPARISON=(()=>{
    const top=[[48,128],[52,102],[88,84],[126,84],[150,77],[178,84],[194,100],[206,106],[216,116],[220,128]],hem=[];
    for(let i=0;i<=8;i++){const x=218-i*21,y=192+Math.sin(i/8*Math.PI)*-6;hem.push([x,y],[x-10.5,y+9])}
    return[...top,...hem.slice(0,-1),[50,190]];
  })();
  function caparison(ctx,o){
    const {lw,livery,flip,paint}=o;
    ctx.save();
    ctx.beginPath();CAPARISON.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();
    ctx.save();ctx.clip();
    // Quartered: front-top and back-bottom in the first tincture.
    ctx.fillStyle=livery.main;ctx.fillRect(40,70,190,145);
    ctx.fillStyle=livery.alt;ctx.fillRect(40,70,94,80);ctx.fillRect(134,150,96,65);
    ctx.fillStyle=GOLD;ctx.fillRect(40,186,190,24);
    ctx.restore();
    ctx.strokeStyle=OUTLINE;ctx.lineWidth=lw;ctx.lineJoin='round';ctx.stroke();
    arms(ctx,flip,100,142,52,58,BANNER,livery,paint);
    ctx.strokeStyle=GOLD;ctx.lineWidth=lw*1.4;ctx.strokeRect(74,113,52,58);
    ctx.restore();
  }
  function blanket(ctx,o){
    const {lw,livery}=o;
    poly(ctx,[[96,86],[150,84],[154,124],[94,128]],livery.main,OUTLINE,lw);
    ctx.save();ctx.beginPath();ctx.rect(124,80,40,50);ctx.clip();poly(ctx,[[96,86],[150,84],[154,124],[94,128]],livery.alt,null,lw);ctx.restore();
    line(ctx,[94,126],[154,122],GOLD,lw*2.4,'butt');
  }
  function saddle(ctx,o,war){
    const {lw}=o;
    poly(ctx,[[100,90],[146,88],[144,80],[104,80]],LEATHER,OUTLINE,lw);
    poly(ctx,[[98,82],[106,82],[104,war?58:70],[96,war?60:72]],LEATHER_DARK,OUTLINE,lw);       // cantle
    poly(ctx,[[140,80],[148,80],[150,war?64:70],[143,war?64:70]],LEATHER_DARK,OUTLINE,lw);     // pommel
    if(!war)poly(ctx,[[86,96],[104,96],[104,118],[86,118]],LEATHER,OUTLINE,lw);                // saddlebag
  }
  // Head-space helper: the horse head moves with pose.headX/Y and turns about its joint.
  function headSpace(ctx,o,fn){
    const sp=o.sp,j={x:(sp.joint.a.x+sp.joint.b.x)/2,y:(sp.joint.a.y+sp.joint.b.y)/2};
    ctx.save();ctx.translate(o.pose.headX,o.pose.headY);
    ctx.translate(j.x,j.y);ctx.rotate(o.pose.headRot);ctx.translate(-j.x,-j.y);fn();ctx.restore();
  }
  function crinet(ctx,o){
    const sp=o.sp,j={x:(sp.joint.a.x+sp.joint.b.x)/2+o.pose.headX,y:(sp.joint.a.y+sp.joint.b.y)/2+o.pose.headY};
    const root=[sp.neck.root.x+6,sp.neck.root.y-6];
    limb(ctx,[root,[j.x-4,j.y+4]],o.livery.main,40,o.lw);
    line(ctx,[root[0]+6,root[1]-18],[j.x+2,j.y-14],o.livery.alt,9);
    headSpace(ctx,o,()=>{
      // Chanfron down the face of the nose-down head (settlement-animals.js horse), eye hole, plume at the poll.
      poly(ctx,[[212,33],[221,26],[232,34],[249,66],[246,78],[236,74],[220,50]],STEEL,OUTLINE,o.lw);
      ctx.fillStyle='#16181a';ctx.beginPath();ctx.arc(224,42,4,0,Math.PI*2);ctx.fill();
      poly(ctx,[[215,28],[209,6],[201,-6],[207,-8],[219,8],[221,24]],o.livery.main,OUTLINE,o.lw*.8);
      poly(ctx,[[209,6],[201,-6],[207,-8],[215,4]],o.livery.alt,null,o.lw);
    });
  }
  function bridle(ctx,o){
    headSpace(ctx,o,()=>{
      ctx.strokeStyle=LEATHER_DARK;ctx.lineWidth=o.lw*1.6;ctx.lineCap='round';
      // Cheek strap from behind the ear to the bit, browband, noseband across the muzzle.
      ctx.beginPath();ctx.moveTo(213,31);ctx.lineTo(229,81);ctx.moveTo(213,33);ctx.lineTo(228,30);
      ctx.moveTo(232,80);ctx.lineTo(247,66);ctx.stroke();
    });
  }

  // ---------- riders (seat at ~(122,86) on the horse's back)
  function lanceGeometry(o){
    // Raised at rest (up and forward), couched when engaged or charging, driven on the strike.
    const lower=clamp(Math.max(o.ready*.9,o.charge?1:0)+Math.max(0,o.attack)*.2,0,1);
    const angle=(1-lower)*-1.25+lower*.06,thrust=o.attack>0?o.attack*30:o.attack*14;
    const grip=[140+thrust,62],dir=[Math.cos(angle),Math.sin(angle)];
    return{grip,dir,butt:[grip[0]-dir[0]*60,grip[1]-dir[1]*60],tip:[grip[0]+dir[0]*300,grip[1]+dir[1]*300]};
  }
  function lance(ctx,o){
    const L=lanceGeometry(o),{lw}=o;
    limb(ctx,[L.butt,L.tip],WOOD,6,lw*.8);
    const t=L.tip,d=L.dir,n=[-d[1],d[0]];
    poly(ctx,[[t[0]+d[0]*22,t[1]+d[1]*22],[t[0]+n[0]*5,t[1]+n[1]*5],[t[0]-n[0]*5,t[1]-n[1]*5]],STEEL,OUTLINE,lw*.7);
    // Pennon below the head, in the realm's two tinctures.
    const a=[t[0]-d[0]*44,t[1]-d[1]*44],b=[t[0]-d[0]*6,t[1]-d[1]*6],hang=[n[0]*(n[1]>0?1:-1),Math.abs(n[1])];
    poly(ctx,[a,b,[a[0]+hang[0]*30+d[0]*6,a[1]+hang[1]*30+d[1]*6]],o.livery.main,OUTLINE,lw*.6);
    poly(ctx,[a,[(a[0]+b[0])/2,(a[1]+b[1])/2],[a[0]+hang[0]*30+d[0]*6,a[1]+hang[1]*30+d[1]*6]],o.livery.alt,null,lw);
    limb(ctx,[[126,44],[L.grip[0]-4,L.grip[1]+2]],o.kind==='knight'?MAIL:o.livery.alt,9,lw);              // lance arm (far side)
  }
  function torso(ctx,o){
    const {lw,livery}=o,pts=[[103,90],[143,90],[137,34],[109,34]];
    poly(ctx,pts,livery.main,null,lw);
    ctx.save();ctx.beginPath();ctx.rect(123,30,30,62);ctx.clip();poly(ctx,pts,livery.alt,null,lw);ctx.restore();
    poly(ctx,pts,null,OUTLINE,lw);
    line(ctx,[108,80],[139,80],LEATHER_DARK,lw*2.2,'butt');                                        // belt
  }
  function legs(ctx,o){
    const c=o.kind==='knight'?MAIL:CLOTH;
    limb(ctx,[[120,84],[142,116],[134,152]],c,13,o.lw);
    poly(ctx,[[128,150],[150,150],[150,158],[128,158]],o.kind==='knight'?STEEL_DARK:LEATHER_DARK,OUTLINE,o.lw);
    line(ctx,[138,118],[140,148],LEATHER_DARK,o.lw*1.4);                                           // stirrup leather
    if(o.kind==='knight'){   // surcoat skirt over the thigh
      poly(ctx,[[106,82],[140,84],[150,104],[118,104]],o.livery.main,OUTLINE,o.lw);
      ctx.save();ctx.beginPath();ctx.rect(128,78,30,30);ctx.clip();poly(ctx,[[106,82],[140,84],[150,104],[118,104]],o.livery.alt,null,o.lw);ctx.restore();
    }
  }
  function head(ctx,o){
    const {lw}=o;
    const style=o.kind==='knight'?o.helmet:null;
    if(style&&style!=='greathelm'){
      // Feudal helmet (State.policies.unitHelmet): open helmets show the face under a mail coif.
      const face=()=>{ctx.fillStyle=MAIL;ctx.beginPath();ctx.arc(123,22,13,0,Math.PI*2);ctx.fill();ctx.strokeStyle=OUTLINE;ctx.lineWidth=lw;ctx.stroke();
        ctx.fillStyle=SKIN;ctx.beginPath();ctx.ellipse(126,24,7,8,0,0,Math.PI*2);ctx.fill()};
      if(style==='barbuta'){
        ctx.fillStyle=STEEL;ctx.beginPath();ctx.arc(123,20,14,0,Math.PI*2);ctx.fill();ctx.strokeStyle=OUTLINE;ctx.lineWidth=lw;ctx.stroke();
        poly(ctx,[[118,16],[136,16],[136,21],[130,21],[130,32],[125,32],[125,21],[118,21]],SKIN,null,lw);      // T opening
      }else{
        face();
        if(style==='kettle'){
          poly(ctx,[[112,15],[114,6],[123,2],[132,6],[134,15]],STEEL,OUTLINE,lw);
          line(ctx,[103,16],[143,16],STEEL_DARK,lw*3.2);                                             // wide brim
        }else if(style==='nasal'){
          poly(ctx,[[110,18],[115,6],[123,-4],[131,6],[136,18]],STEEL,OUTLINE,lw);
          poly(ctx,[[127,17],[131,17],[131,29],[127,29]],STEEL,OUTLINE,lw*.7);                      // nasal
        }else{
          poly(ctx,[[110,19],[112,10],[123,5],[134,10],[136,19]],STEEL,OUTLINE,lw);                  // cervelliera
        }
      }
    }else if(o.kind==='knight'){
      poly(ctx,[[112,34],[134,34],[136,10],[130,4],[116,4],[110,10]],STEEL,OUTLINE,lw);           // great helm
      line(ctx,[122,18],[136,18],'#16181a',lw*1.6,'butt');                                         // visor slit
    }else{
      ctx.fillStyle=SKIN;ctx.beginPath();ctx.arc(123,20,12,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle=OUTLINE;ctx.lineWidth=lw;ctx.stroke();
      ctx.fillStyle=HAT;ctx.beginPath();ctx.arc(123,18,12,Math.PI,Math.PI*2);ctx.lineTo(135,18);ctx.closePath();ctx.fill();
      line(ctx,[105,19],[141,19],HAT,lw*2.6);                                                      // kettle-hat brim
    }
    if(o.kind==='knight')crest(ctx,o,HELMET_TOP[style&&style!=='greathelm'?style:'greathelm']);
  }
  // Knight's crest (product owner, 17/11/2026): a fan in the two tinctures on a short stalk, above
  // any helmet; the same emblem the knight wears on foot (settlement-population-figures.js).
  const HELMET_TOP={greathelm:4,barbuta:6,kettle:2,nasal:-4,cap:5};
  function crest(ctx,o,top){
    const x=123,base=top-7,r=16;
    poly(ctx,[[121,top+1],[125,top+1],[125,base],[121,base]],STEEL,OUTLINE,o.lw*.6);
    ctx.beginPath();ctx.moveTo(x-r,base);ctx.ellipse(x,base,r,r*.85,0,Math.PI,Math.PI*2);ctx.closePath();
    ctx.fillStyle=o.livery.main;ctx.fill();
    ctx.save();ctx.clip();ctx.fillStyle=o.livery.alt;ctx.fillRect(x,base-r,r,r);ctx.restore();
    ctx.strokeStyle=OUTLINE;ctx.lineWidth=o.lw*.8;ctx.stroke();
    ctx.fillStyle=GOLD;ctx.beginPath();ctx.arc(x,base-r*.42,r*.2,0,Math.PI*2);ctx.fill();
  }
  // Knight's cloak: from the shoulders, flying back over the horse's rump; lining in the second tincture.
  function cloak(ctx,o){
    // Above the caparison's top line, so it reads against the horse and not only against the drape.
    const pts=[[108,34],[130,34],[116,52],[96,68],[70,78],[50,76],[62,64],[84,50]];
    poly(ctx,pts,o.livery.main,null,o.lw);
    ctx.save();ctx.beginPath();pts.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.clip();
    poly(ctx,[[44,70],[70,64],[80,82],[48,84]],o.livery.alt,null,o.lw);ctx.restore();             // lining at the flying hem
    poly(ctx,pts,null,OUTLINE,o.lw);
    line(ctx,[100,46],[74,68],'rgba(25,24,22,.35)',o.lw*.8);                                     // fold
  }
  function shield(ctx,o){
    // At the rider's near side, low over the thigh so the surcoat still shows.
    const shape=SHIELD_SHAPES[o.shield],clip=shape?.clip||KITE,w=shape?.w||32,h=shape?.h||50;
    const cx=112+o.ready*8,cy=88+(h-50)*.3;
    arms(ctx,o.flip,cx,cy,w,h,clip,o.livery,o.paint);
    ctx.save();ctx.translate(cx,cy);ctx.beginPath();clip.forEach(([x,y],i)=>i?ctx.lineTo(x*w,y*h):ctx.moveTo(x*w,y*h));ctx.closePath();
    ctx.strokeStyle=GOLD;ctx.lineWidth=o.lw*1.6;ctx.stroke();
    if(shape?.boss){ctx.fillStyle=STEEL;ctx.beginPath();ctx.arc(0,0,w*.16,0,Math.PI*2);ctx.fill();ctx.strokeStyle=OUTLINE;ctx.lineWidth=o.lw;ctx.stroke()}
    if(shape?.ridge)line(ctx,[0,-h*.5],[0,h*.5],GOLD,o.lw*1.2,'butt');
    ctx.restore();
  }
  function reins(ctx,o){
    const sp=o.sp,j={x:(sp.joint.a.x+sp.joint.b.x)/2+o.pose.headX,y:(sp.joint.a.y+sp.joint.b.y)/2+o.pose.headY};
    // To the bit at the corner of the mouth (head at rest: about 20,27 past the throat joint).
    line(ctx,[150,64],[j.x+20,j.y+27],LEATHER_DARK,o.lw*1.3);
    limb(ctx,[[122,44],[138,62],[150,64]],o.livery.main,9,o.lw);
    ctx.fillStyle=SKIN;ctx.beginPath();ctx.arc(150,64,4.5,0,Math.PI*2);ctx.fill();
    poly(ctx,[[100,74],[112,74],[112,90],[100,90]],LEATHER,OUTLINE,o.lw);                           // satchel
  }
  // Unhorsed: drawn in ground space (not on the horse's body), the rider tips backwards over the
  // rump and lands on the ground behind the horse; the lance drops flat at its feet.
  const SEAT=[110,88];
  function fallen(ctx,o){
    const f=clamp(o.fall,0,1),ground=o.sp.center.y-6;
    const L=lanceGeometry({...o,attack:0});
    // The lance leaves the hand first: it tips forward and lies on the ground in front of the horse.
    ctx.save();
    const lf=clamp(f*1.6,0,1),lx=L.grip[0]+lf*40,ly=L.grip[1]+(ground-4-L.grip[1])*lf*lf;
    ctx.translate(lx,ly);ctx.rotate(Math.atan2(L.dir[1],L.dir[0])*(1-lf));
    limb(ctx,[[-60,0],[300,0]],WOOD,6,o.lw*.8);
    poly(ctx,[[322,0],[300,5],[300,-5]],STEEL,OUTLINE,o.lw*.7);
    ctx.restore();
    // Arc over the rump: x slides back linearly, y falls with gravity, the body turns to lie flat.
    const dx=-180*f,dy=(ground-SEAT[1]-18)*f*f;
    ctx.save();
    ctx.translate(SEAT[0]+dx,SEAT[1]+dy);ctx.rotate(-f*1.5);ctx.translate(-SEAT[0],-SEAT[1]);
    body(ctx,{...o,ready:0},false);
    ctx.restore();
  }
  function body(ctx,o,withLance=true){
    if(o.kind==='knight')cloak(ctx,o);
    if(withLance&&o.kind==='knight')lance(ctx,o);
    torso(ctx,o);legs(ctx,o);
    if(o.kind==='knight')shield(ctx,o);else reins(ctx,o);
    head(ctx,o);
  }
  function rider(ctx,o){
    ctx.save();
    body(ctx,o);
    if(o.flash>0){ctx.globalAlpha*=.6*o.flash;poly(ctx,[[103,90],[143,90],[137,34],[109,34]],'#fff6e4',null,o.lw)}
    ctx.restore();
  }
  // (x,y) ground point on screen; size as drawAnimal (the horse art box height).
  // opts: kind, facing (1 right / -1 left), mode ('idle'|'walk'|'run'), from, blend,
  // t, seed, coat, pose (ConquerCombatAnim fields), livery {main,alt}, paint.
  function draw(ctx,x,y,size,opts={}){
    const p=opts.pose||{},kind=opts.kind==='messenger'?'messenger':'knight';
    const alpha=p.alpha??1;if(alpha<=0)return;
    const state={kind,livery:opts.livery,paint:opts.paint,ready:p.ready||0,attack:p.attack||0,flash:p.flash||0,
      fall:p.fall||0,charge:opts.mode==='run',helmet:opts.helmet||null,shield:opts.shield||null};
    ctx.save();ctx.globalAlpha*=alpha;
    let unhorsed=null;
    window.ConquerAnimals.drawAnimal('horse',ctx,x,y,size,{t:opts.t||0,seed:opts.seed||0,coat:opts.coat,
      facing:opts.facing,mode:opts.mode==='idle'?'idle':opts.mode||'idle',from:opts.from==='idle'?'idle':opts.from,blend:opts.blend,
      onBody:(c,info)=>{
        const o={...state,...info};
        if(kind==='knight')caparison(c,o);else blanket(c,o);
        saddle(c,o,kind==='knight');
        if(kind==='knight')crinet(c,o);else bridle(c,o);
        if(o.fall>0)unhorsed=o;else rider(c,o);
      }});
    if(unhorsed){
      // Same art space as drawAnimal, without the gait's bob and tilt: the ground stays put.
      const sp=unhorsed.sp,s=size*(sp.scale||1)/256;
      ctx.translate(x,y);ctx.scale(unhorsed.flip*s,s);ctx.translate(-sp.center.x,-sp.center.y);
      fallen(ctx,unhorsed);
    }
    ctx.restore();
  }
  window.ConquerMounted2D={draw,lanceGeometry};
})();
