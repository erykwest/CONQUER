'use strict';
// CONQUER animals: procedural canvas animation from the split SVG parts in
// animali_svg_v2 (body / face / legs / tail). Sheep first: walk + browse.
// Classic script, no dependencies; poses are pure functions of time.
(function(){
  const SHEEP={
    // Head up, used for walking. Source: pecora_estesa.svg (256×256, faces left).
    walk:{
      body:'M74 96 C74 78,92 68,116 68 C128 56,154 58,166 72 C190 72,208 86,208 108 C220 116,224 128,220 142 C222 158,214 170,198 176 C188 190,166 196,146 192 C128 198,102 196,88 184 C66 182,52 166,52 144 C42 132,40 118,46 104 C44 92,54 84,66 82 C68 88,70 92,74 96 Z',
      face:'M58 78 C72 62,94 58,106 70 C112 76,112 88,106 96 C96 110,76 116,62 104 C50 94,50 86,58 78 Z M56 76 L46 66 L42 56 L52 56 L62 64 Z M96 74 L108 66 L118 64 L118 72 L104 82 Z',
      legs:'M80 174 C86 174,92 178,92 184 L90 226 C90 232,86 238,80 238 C74 238,70 232,70 226 L72 184 C72 178,74 174,80 174 Z M112 178 C118 178,124 182,124 188 L124 230 C124 236,120 242,114 242 C108 242,104 236,104 230 L104 188 C104 182,106 178,112 178 Z M154 178 C160 178,166 182,166 188 L162 228 C162 236,158 242,152 242 C146 242,142 236,142 230 L144 188 C144 182,148 178,154 178 Z M186 170 C192 170,198 174,198 180 L194 224 C194 232,190 238,184 238 C178 238,174 232,174 226 L176 182 C176 176,180 170,186 170 Z',
      tail:'M206 112 C220 114,224 122,222 130 C218 126,212 124,206 120 Z',
      // headOffset pulls the head clear of the fleece, as in the reference silhouette.
      neck:{x:100,y:92},headOffset:{x:-18,y:-8},eye:{x:72,y:82},tailPivot:{x:206,y:116},center:{x:134,y:240}
    },
    // Head down to the grass. Source: pecora_bruca.svg.
    browse:{
      body:'M92 92 C92 76,108 66,128 66 C140 54,164 56,176 70 C198 70,216 84,216 104 C228 112,232 126,228 140 C230 156,224 168,210 176 C198 188,178 194,158 190 C142 196,120 194,106 184 C88 184,72 172,70 154 C58 150,50 138,50 124 C50 108,60 96,74 92 C78 94,84 94,92 92 Z',
      face:'M76 102 C66 112,56 126,48 140 C40 154,34 164,24 172 C18 176,16 184,20 190 C28 198,44 194,54 184 C62 176,68 166,72 156 C78 142,84 130,92 122 C98 114,98 104,92 98 C86 92,82 96,76 102 Z M84 98 L72 92 L62 84 L68 76 L82 84 Z M90 100 L100 92 L112 88 L112 96 L98 106 Z',
      legs:'M108 176 C114 176,118 180,118 186 L116 228 C116 234,112 240,106 240 C100 240,96 234,96 228 L98 186 C98 180,102 176,108 176 Z M140 180 C146 180,150 184,150 190 L150 232 C150 238,146 244,140 244 C134 244,130 238,130 232 L130 190 C130 184,134 180,140 180 Z M172 178 C178 178,182 182,182 188 L180 230 C180 236,176 242,170 242 C164 242,160 236,160 230 L162 188 C162 182,166 178,172 178 Z M198 168 C204 168,208 172,208 178 L206 222 C206 228,202 234,196 234 C190 234,186 228,186 222 L188 178 C188 172,192 168,198 168 Z',
      tail:'M214 112 C226 116,230 124,228 132 C222 128,218 124,212 120 Z',
      neck:{x:90,y:110},headOffset:{x:-4,y:0},eye:{x:54,y:156},tailPivot:{x:214,y:116},center:{x:152,y:242}
    }
  };
  const COLORS={wool:'#f6f3ec',woolShade:'#e4ddd0',woolLine:'#5e554b',skin:'#e7b1ab',skinFar:'#c98f8a',skinLine:'#87534f',eye:'#2b2321'};
  // Each leg is its own subpath; its hip is the top of the subpath.
  const hips=d=>d.split(/(?=M)/).map(s=>{const [x,y]=s.slice(1).trim().split(/[ ,]+/).map(Number);return{d:s,x,y:y+6}});
  for(const pose of Object.values(SHEEP))pose.legList=hips(pose.legs);

  // Pure pose maths. phase is the stride/nibble phase in radians.
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
      out.head=nibble*.07;
      out.chew=nibble;
      const shift=Math.sin(t*.9+seed*3);
      if(shift>.96){const s=Math.sin((shift-.96)/.04*Math.PI);out.legs[0]=-s*.22;out.lift[0]=s*4}
      out.bob=Math.sin(t*1.3+seed)*.8;
      out.tail=Math.sin(t*5+seed)*(Math.sin(t*.7+seed)>.6?.25:.04);
    }
    return out;
  }

  const pathCache=new Map();
  const path=d=>{let p=pathCache.get(d);if(!p){p=new Path2D(d);pathCache.set(d,p)}return p};
  function fillStroke(ctx,d,fill,line,lw){
    const p=path(d);ctx.fillStyle=fill;ctx.fill(p);
    if(line){ctx.strokeStyle=line;ctx.lineWidth=lw;ctx.lineJoin='round';ctx.stroke(p)}
  }
  // Draws one sheep. (x,y) = ground point under its feet, size = on-screen
  // height of the 256-unit art box, facing 1 = right / -1 = left.
  // opts.blend (0..1) eases walk → browse: the art swaps at the midpoint,
  // hidden inside a short crouch, so no translucent double sheep appears.
  function drawSheep(ctx,x,y,size,opts={}){
    const t=opts.t||0,seed=opts.seed||0,facing=opts.facing>=0?1:-1;
    const blend=Math.max(0,Math.min(1,opts.blend??(opts.mode==='browse'?1:0)));
    const s=size/256,lw=Math.max(.55,size/90)/s;
    ctx.save();
    ctx.translate(x,y);ctx.scale(-facing*s,s);
    const crouch=Math.sin(blend*Math.PI);
    for(const mode of [blend<.5?'walk':'browse']){
      const art=SHEEP[mode],pose=sheepPose(mode,t,seed);
      if(crouch>0){pose.bob+=crouch*7;pose.legs=pose.legs.map(a=>a*(1-crouch))}
      ctx.save();
      ctx.translate(-art.center.x,-art.center.y);
      // Soft ground shadow.
      ctx.fillStyle='rgba(30,40,20,.22)';ctx.beginPath();
      ctx.ellipse(art.center.x,art.center.y-2,78,12,0,0,Math.PI*2);ctx.fill();
      // Far legs (1, 3) a shade darker, all legs under the fleece.
      art.legList.forEach((leg,i)=>{
        ctx.save();ctx.translate(leg.x,leg.y-pose.lift[i]);ctx.rotate(pose.legs[i]);ctx.translate(-leg.x,-leg.y);
        fillStroke(ctx,leg.d,i%2?COLORS.skinFar:COLORS.skin,COLORS.skinLine,lw);
        ctx.restore();
      });
      ctx.translate(0,pose.bob);
      ctx.save();ctx.translate(art.tailPivot.x,art.tailPivot.y);ctx.rotate(pose.tail);ctx.translate(-art.tailPivot.x,-art.tailPivot.y);
      fillStroke(ctx,art.tail,COLORS.wool,COLORS.woolLine,lw);ctx.restore();
      fillStroke(ctx,art.body,COLORS.wool,COLORS.woolLine,lw);
      // A low belly shade keeps white fleece readable on light ground.
      ctx.save();ctx.clip(path(art.body));ctx.fillStyle=COLORS.woolShade;
      ctx.beginPath();ctx.ellipse(art.center.x,art.center.y-50,110,24,0,0,Math.PI*2);ctx.fill();ctx.restore();
      ctx.save();ctx.translate(art.headOffset.x,art.headOffset.y);
      ctx.translate(art.neck.x,art.neck.y);ctx.rotate(pose.head);ctx.translate(-art.neck.x,-art.neck.y);
      ctx.translate(0,pose.chew*2);
      fillStroke(ctx,art.face,COLORS.skin,COLORS.skinLine,lw);
      if(size>=24){ctx.fillStyle=COLORS.eye;ctx.beginPath();ctx.arc(art.eye.x,art.eye.y,4.5,0,Math.PI*2);ctx.fill()}
      ctx.restore();
      ctx.restore();
    }
    ctx.restore();
  }
  window.ConquerAnimals={SHEEP,COLORS,sheepPose,drawSheep};
})();
