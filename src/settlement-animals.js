'use strict';
// CONQUER animals: procedural canvas animation from the split SVG parts in
// animali_svg_v2 (body / face / legs / tail). Sheep first: walk + browse.
// One rigid set of parts: browsing lowers the same head, it never reshapes it.
// Classic script, no dependencies; poses are pure functions of time.
(function(){
  // Source: pecora_estesa.svg (256×256, faces left).
  const SHEEP={
    body:'M74 96 C74 78,92 68,116 68 C128 56,154 58,166 72 C190 72,208 86,208 108 C220 116,224 128,220 142 C222 158,214 170,198 176 C188 190,166 196,146 192 C128 198,102 196,88 184 C66 182,52 166,52 144 C42 132,40 118,46 104 C44 92,54 84,66 82 C68 88,70 92,74 96 Z',
    face:'M58 78 C72 62,94 58,106 70 C112 76,112 88,106 96 C96 110,76 116,62 104 C50 94,50 86,58 78 Z M56 76 L46 66 L42 56 L52 56 L62 64 Z M96 74 L108 66 L118 64 L118 72 L104 82 Z',
    legs:'M80 174 C86 174,92 178,92 184 L90 226 C90 232,86 238,80 238 C74 238,70 232,70 226 L72 184 C72 178,74 174,80 174 Z M112 178 C118 178,124 182,124 188 L124 230 C124 236,120 242,114 242 C108 242,104 236,104 230 L104 188 C104 182,106 178,112 178 Z M154 178 C160 178,166 182,166 188 L162 228 C162 236,158 242,152 242 C146 242,142 236,142 230 L144 188 C144 182,148 178,154 178 Z M186 170 C192 170,198 174,198 180 L194 224 C194 232,190 238,184 238 C178 238,174 232,174 226 L176 182 C176 176,180 170,186 170 Z',
    tail:'M206 112 C220 114,224 122,222 130 C218 126,212 124,206 120 Z',
    neck:{x:100,y:92},eye:{x:72,y:82},tailPivot:{x:206,y:116},center:{x:134,y:240},
    // Woolly neck root, hidden inside the fleece; it shows only when the head drops.
    neckRoot:{x:80,y:122}
  };
  // Head placement relative to the art: walk pulls it clear of the fleece
  // (as in the reference silhouette), browse lowers it, muzzle to the grass.
  const HEAD={walk:{x:-18,y:-8,rot:0},browse:{x:-66,y:98,rot:-.85}};
  const COLORS={wool:'#f6f3ec',woolShade:'#e4ddd0',woolLine:'#5e554b',skin:'#e7b1ab',skinFar:'#c98f8a',skinLine:'#87534f',eye:'#2b2321'};
  // Each leg is its own subpath; its hip is the top of the subpath.
  SHEEP.legList=SHEEP.legs.split(/(?=M)/).map(s=>{const [x,y]=s.slice(1).trim().split(/[ ,]+/).map(Number);return{d:s,x,y:y+6}});

  const lerp=(a,b,k)=>a+(b-a)*k;
  const ease=k=>k*k*(3-2*k);
  // Pure pose maths for one mode.
  function sheepPose(mode,t,seed=0){
    const out={legs:[0,0,0,0],lift:[0,0,0,0],bob:0,head:0,tail:0,chew:0};
    if(mode==='walk'){
      const p=t*Math.PI*2*1.6+seed;
      // Diagonal gait: front-left with back-right.
      const swing=[Math.sin(p),-Math.sin(p),-Math.sin(p),Math.sin(p)];
      out.legs=swing.map(s=>s*.38);
      out.lift=swing.map(s=>Math.max(0,s)*5);
      out.bob=-Math.abs(Math.cos(p))*4+2;
      out.head=Math.sin(p*2)*.05;
      out.tail=Math.sin(p*2)*.18;
    }else{
      // Browse: legs planted, short nibbles, a step every few seconds.
      const p=t*Math.PI*2+seed,nibble=Math.max(0,Math.sin(p*2.2));
      out.head=nibble*.08;
      out.chew=nibble;
      const shift=Math.sin(t*.9+seed*3);
      if(shift>.96){const s=Math.sin((shift-.96)/.04*Math.PI);out.legs[0]=-s*.22;out.lift[0]=s*4}
      out.bob=Math.sin(t*1.3+seed)*.8;
      out.tail=Math.sin(t*5+seed)*(Math.sin(t*.7+seed)>.6?.25:.04);
    }
    return out;
  }
  // Blended pose: blend 0 = walk, 1 = browse. The head travels continuously.
  function blendedPose(t,seed,blend){
    const k=ease(blend),w=sheepPose('walk',t,seed),b=sheepPose('browse',t,seed);
    return{
      legs:w.legs.map((a,i)=>lerp(a,b.legs[i],k)),
      lift:w.lift.map((a,i)=>lerp(a,b.lift[i],k)),
      bob:lerp(w.bob,b.bob,k),tail:lerp(w.tail,b.tail,k),
      headX:lerp(HEAD.walk.x,HEAD.browse.x,k),
      headY:lerp(HEAD.walk.y,HEAD.browse.y,k)+b.chew*2*k,
      headRot:lerp(HEAD.walk.rot+w.head,HEAD.browse.rot+b.head,k),
      neck:k,tilt:-.05*k
    };
  }

  const pathCache=new Map();
  const path=d=>{let p=pathCache.get(d);if(!p){p=new Path2D(d);pathCache.set(d,p)}return p};
  function fillStroke(ctx,d,fill,line,lw){
    const p=path(d);ctx.fillStyle=fill;ctx.fill(p);
    if(line){ctx.strokeStyle=line;ctx.lineWidth=lw;ctx.lineJoin='round';ctx.stroke(p)}
  }
  const rotateAbout=(ctx,p,a)=>{ctx.translate(p.x,p.y);ctx.rotate(a);ctx.translate(-p.x,-p.y)};
  // Draws one sheep. (x,y) = ground point under its feet, size = on-screen
  // height of the 256-unit art box, facing 1 = right / -1 = left.
  // opts.blend (0..1) eases walk → browse; defaults from opts.mode.
  function drawSheep(ctx,x,y,size,opts={}){
    const t=opts.t||0,seed=opts.seed||0,facing=opts.facing>=0?1:-1;
    const blend=Math.max(0,Math.min(1,opts.blend??(opts.mode==='browse'?1:0)));
    const s=size/256,lw=Math.max(.55,size/90)/s,art=SHEEP,pose=blendedPose(t,seed,blend);
    ctx.save();
    ctx.translate(x,y);ctx.scale(-facing*s,s);ctx.translate(-art.center.x,-art.center.y);
    // Soft ground shadow.
    ctx.fillStyle='rgba(30,40,20,.22)';ctx.beginPath();
    ctx.ellipse(art.center.x,art.center.y-2,78,12,0,0,Math.PI*2);ctx.fill();
    // Far legs (1, 3) a shade darker, all legs under the fleece.
    art.legList.forEach((leg,i)=>{
      ctx.save();ctx.translate(0,-pose.lift[i]);rotateAbout(ctx,leg,pose.legs[i]);
      fillStroke(ctx,leg.d,i%2?COLORS.skinFar:COLORS.skin,COLORS.skinLine,lw);
      ctx.restore();
    });
    ctx.translate(0,pose.bob);
    rotateAbout(ctx,{x:art.center.x,y:150},pose.tilt);
    // Head anchor: the neck pivot carried by the head placement.
    const anchor={x:art.neck.x+pose.headX,y:art.neck.y+pose.headY};
    if(pose.neck>.02){
      // Fleece-covered neck from inside the body down to the lowered head.
      ctx.lineCap='round';
      ctx.strokeStyle=COLORS.woolLine;ctx.lineWidth=34*pose.neck+lw*2;
      ctx.beginPath();ctx.moveTo(art.neckRoot.x,art.neckRoot.y);ctx.lineTo(anchor.x,anchor.y);ctx.stroke();
      ctx.strokeStyle=COLORS.wool;ctx.lineWidth=34*pose.neck;ctx.stroke();
    }
    ctx.save();rotateAbout(ctx,art.tailPivot,pose.tail);
    fillStroke(ctx,art.tail,COLORS.wool,COLORS.woolLine,lw);ctx.restore();
    fillStroke(ctx,art.body,COLORS.wool,COLORS.woolLine,lw);
    // A low belly shade keeps white fleece readable on light ground.
    ctx.save();ctx.clip(path(art.body));ctx.fillStyle=COLORS.woolShade;
    ctx.beginPath();ctx.ellipse(art.center.x,art.center.y-50,110,24,0,0,Math.PI*2);ctx.fill();ctx.restore();
    // The head is rigid: only moved and rotated, never reshaped.
    ctx.save();ctx.translate(pose.headX,pose.headY);rotateAbout(ctx,art.neck,pose.headRot);
    fillStroke(ctx,art.face,COLORS.skin,COLORS.skinLine,lw);
    if(size>=24){ctx.fillStyle=COLORS.eye;ctx.beginPath();ctx.arc(art.eye.x,art.eye.y,4.5,0,Math.PI*2);ctx.fill()}
    ctx.restore();
    ctx.restore();
  }
  window.ConquerAnimals={SHEEP,HEAD,COLORS,sheepPose,blendedPose,drawSheep};
})();
