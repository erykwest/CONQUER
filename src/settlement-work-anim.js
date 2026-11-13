'use strict';
// CONQUER work animations: civilians at work with their tool, drawn over the shared
// villager figure (drawVillagerFigureUnmasked), like the combat animations draw
// weapons over the soldier body. Tools: shovel (clay diggers), axe (woodcutters),
// pickaxe (quarry and mine), hammer (builders), hoe (ploughing), seed sack (sowing),
// sickle (harvest); at the shop benches: clay on the wheel (potter), shuttle (weaver),
// needle and thread (tailor). Each tool has its own rhythm, body lean and a small effect at
// the stroke (clods, chips, dust, seeds, cut stalks). Poses are pure functions of
// time; workers are visual only. Classic script.
(function(){
  // th: tool angle from straight up, positive = forward (towards the facing side).
  // lean: body tilt forward (rad); bob: body drop (fraction of body height).
  // hit: phase of the stroke that throws the effect.
  const TOOLS={
    axe:{period:1.15,len:8.5,hit:.66,fx:'chips'},
    pickaxe:{period:1.35,len:8,hit:.64,fx:'dust'},
    hammer:{period:.62,len:4.6,hit:.5,fx:'spark'},
    shovel:{period:1.7,len:9,hit:.62,fx:'clod'},
    hoe:{period:1.25,len:9.5,hit:.6,fx:'soil'},
    seeds:{period:1.5,len:4.2,hit:.42,fx:'seeds'},
    sickle:{period:.95,len:3.6,hit:.5,fx:'stalks'},
    // Bench trades of the open shops (settlement-shop-cutaway.js).
    clay:{period:2.2,len:1.2,hit:.5,fx:'slip'},       // potter: hands raise the wall of a pot on the wheel
    shuttle:{period:.9,len:2.6,hit:.32,fx:'lint'},    // weaver: throw the shuttle, beat the weft
    needle:{period:1.6,len:1.8,hit:.55,fx:null}       // tailor: stitch, pull the thread up and out
  };
  const ease=t=>t*t*(3-2*t),lerp=(a,b,t)=>a+(b-a)*t;
  // Piecewise keyframes [[u,th,lean,bob],...] -> pose at phase u.
  function keys(list,u){
    for(let i=0;i<list.length-1;i++){
      const a=list[i],b=list[i+1];
      if(u>=a[0]&&u<=b[0]){const t=ease((u-a[0])/((b[0]-a[0])||1));return{th:lerp(a[1],b[1],t),lean:lerp(a[2],b[2],t),bob:lerp(a[3],b[3],t)}}
    }
    const z=list.at(-1);return{th:z[1],lean:z[2],bob:z[3]};
  }
  const KEYS={
    // Raise behind the head, a fast chop, a short rest.
    axe:[[0,1.0,0,0],[.5,-.75,-.08,-.02],[.66,1.45,.14,.05],[.8,1.35,.1,.04],[1,1.0,0,0]],
    pickaxe:[[0,1.6,.08,.02],[.48,-.45,-.08,-.02],[.64,2.15,.22,.08],[.82,2.05,.18,.07],[1,1.6,.08,.02]],
    hammer:[[0,.2,.08,.02],[.38,-1.1,.04,0],[.5,1.0,.14,.04],[.62,.85,.12,.04],[1,.2,.08,.02]],
    // Thrust the blade down, lift the load, flick it aside.
    shovel:[[0,2.25,.12,.02],[.22,2.55,.22,.09],[.48,2.05,.08,.02],[.62,1.15,-.06,0],[.72,1.25,-.04,0],[1,2.25,.12,.02]],
    hoe:[[0,1.9,.15,.03],[.42,-1.0,-.04,0],[.6,2.25,.22,.08],[.78,2.05,.2,.07],[1,1.9,.15,.03]],
    // Hand from the sack on the hip, a wide cast forward.
    seeds:[[0,2.8,.05,0],[.25,2.6,.06,0],[.42,.55,-.02,0],[.6,.9,0,0],[1,2.8,.05,0]],
    // Crouched, a low sweep through the stalks.
    sickle:[[0,1.25,.32,.12],[.35,1.0,.3,.11],[.5,2.55,.38,.14],[.7,2.45,.36,.13],[1,1.25,.32,.12]],
    // Bent over the wheel: wet hands down to the clay, a slow pull up the wall, back down.
    clay:[[0,2.4,.2,.06],[.15,2.4,.2,.06],[.5,1.3,.14,.04],[.62,1.3,.14,.04],[.9,2.4,.2,.06],[1,2.4,.2,.06]],
    // Shuttle thrown forward through the shed, the beater pulled back hard against the cloth.
    shuttle:[[0,1.2,.08,.02],[.22,2.1,.16,.04],[.32,2.15,.17,.04],[.5,1.2,.06,.02],[1,1.2,.08,.02]],
    // Needle into the cloth, then the long pull of the thread up past the shoulder.
    needle:[[0,2.4,.14,.02],[.2,2.45,.15,.03],[.55,.45,.02,0],[.7,.55,.02,0],[1,2.4,.14,.02]]
  };
  function hash(str){let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
  function rnd(seed){let a=seed|0;return()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
  // Phase of a worker: each one keeps its own offset so a crew is never in step.
  function phaseOf(tool,id,t){
    const T=TOOLS[tool],k=(hash(String(id))%1000)/1000*T.period*.9,c=(t+k)/T.period;
    return{u:c-Math.floor(c),cycle:Math.floor(c)};
  }
  function pose(tool,id,t){
    const {u,cycle}=phaseOf(tool,id,t);
    return{...keys(KEYS[tool],u),u,cycle};
  }
  // Tool tip offset from the grip for angle th and facing f (screen space, px).
  const dirOf=(th,f)=>({x:f*Math.sin(th),y:-Math.cos(th)});
  const HANDLE='#7a5937',IRON='#9da3a8',IRON_DARK='#5c6266';
  // Bench work pieces, drawn between the body and the arm (B: the worker's body frame).
  const CLAY='#a5653f',CLAY_DARK='#7f4a2c',CLAY_WET='#c48a62';
  function drawBench(tool,g,f,s,B){
    const lw=Math.max(.5,.35*s);ctx.lineCap='round';ctx.lineJoin='round';
    if(tool==='clay'){
      // Wheel head and the pot rising under the hands; a wet streak turns round it.
      const cx=g.x+f*B.bodyW*.24,foot=B.bodyY+B.bodyH*.24,rw=B.bodyW*.42;
      ctx.fillStyle='#5e4630';ctx.strokeStyle='#3d2c1d';ctx.lineWidth=lw;
      ctx.beginPath();ctx.ellipse(cx,foot,rw,rw*.32,0,0,Math.PI*2);ctx.fill();ctx.stroke();
      const top=Math.min(foot-B.bodyH*.17,g.y+.4*s),hw=B.bodyW*.2,mw=B.bodyW*.27;
      ctx.fillStyle=CLAY;ctx.strokeStyle=CLAY_DARK;
      ctx.beginPath();ctx.moveTo(cx-hw*.9,foot);ctx.quadraticCurveTo(cx-mw*1.25,(foot+top)/2,cx-hw*.7,top);
      ctx.lineTo(cx+hw*.7,top);ctx.quadraticCurveTo(cx+mw*1.25,(foot+top)/2,cx+hw*.9,foot);ctx.closePath();ctx.fill();ctx.stroke();
      ctx.fillStyle=CLAY_DARK;ctx.beginPath();ctx.ellipse(cx,top,hw*.7,Math.max(.3,hw*.22),0,0,Math.PI*2);ctx.fill();
      const k=Math.sin(B.u*Math.PI*2*5);   // the streak runs round the pot five times a stroke
      ctx.strokeStyle=CLAY_WET;ctx.lineWidth=Math.max(.5,.45*s);
      ctx.beginPath();ctx.moveTo(cx+k*mw*.75,top+1*s);ctx.lineTo(cx+k*mw*.85,foot-.8*s);ctx.stroke();
    }else if(tool==='shuttle'){
      // Boat-shaped shuttle in the hand, a pale weft thread trailing back to the loom.
      const l=TOOLS.shuttle.len*s*.85,w=.6*s,back={x:B.base.x+f*B.bodyW*1.2,y:B.bodyY+B.bodyH*.04};
      ctx.strokeStyle='#e8e0c8';ctx.lineWidth=Math.max(.4,.25*s);
      ctx.beginPath();ctx.moveTo(back.x,back.y);ctx.lineTo(g.x,g.y);ctx.stroke();
      ctx.fillStyle='#b48a52';ctx.strokeStyle='#6b4a2a';ctx.lineWidth=lw;
      ctx.beginPath();ctx.moveTo(g.x-l,g.y);ctx.quadraticCurveTo(g.x,g.y-w*2,g.x+l,g.y);ctx.quadraticCurveTo(g.x,g.y+w*2,g.x-l,g.y);ctx.fill();ctx.stroke();
      ctx.fillStyle='#d8cfae';ctx.fillRect(g.x-l*.3,g.y-w*.5,l*.6,w);
    }else if(tool==='needle'){
      // Cloth held on the bench in front; the thread runs from it to the needle hand.
      const cloth={x:B.base.x+f*B.bodyW*.78,y:B.bodyY+B.bodyH*.1};
      ctx.fillStyle='#4f6d8a';ctx.strokeStyle='#3f5970';ctx.lineWidth=lw;
      ctx.beginPath();ctx.moveTo(cloth.x-B.bodyW*.3,cloth.y+B.bodyH*.06);ctx.lineTo(cloth.x+B.bodyW*.3,cloth.y+B.bodyH*.02);
      ctx.lineTo(cloth.x+B.bodyW*.26,cloth.y-B.bodyH*.06);ctx.lineTo(cloth.x-B.bodyW*.28,cloth.y-B.bodyH*.03);ctx.closePath();ctx.fill();ctx.stroke();
      ctx.strokeStyle='#e8e0c8';ctx.lineWidth=Math.max(.35,.2*s);
      ctx.beginPath();ctx.moveTo(cloth.x,cloth.y-B.bodyH*.04);ctx.quadraticCurveTo((cloth.x+g.x)/2+f*B.bodyW*.2,(cloth.y+g.y)/2,g.x,g.y);ctx.stroke();
      ctx.strokeStyle=IRON;ctx.lineWidth=Math.max(.4,.3*s);
      const L=TOOLS.needle.len*s*.5;
      ctx.beginPath();ctx.moveTo(g.x-f*L*.2,g.y+L*.4);ctx.lineTo(g.x+f*L*.25,g.y-L*.6);ctx.stroke();
    }
  }
  const BENCH=new Set(['clay','shuttle','needle']);
  function drawTool(tool,g,f,th,s){
    const d=dirOf(th,f),L=TOOLS[tool].len*s,lw=Math.max(.9,.95*s);
    const a={x:g.x-d.x*L*.22,y:g.y-d.y*L*.22},b={x:g.x+d.x*L*.78,y:g.y+d.y*L*.78};
    const n={x:-d.y,y:d.x};   // perpendicular, rotated a quarter turn
    ctx.lineCap='round';
    if(tool==='seeds'||BENCH.has(tool))return;
    ctx.strokeStyle=HANDLE;ctx.lineWidth=lw;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
    ctx.fillStyle=IRON;ctx.strokeStyle=IRON_DARK;ctx.lineWidth=Math.max(.5,.35*s);
    ctx.beginPath();
    if(tool==='axe'){
      // Wedge head on the forward side of the haft.
      const h=b,w=2.1*s,fwd={x:n.x*f,y:n.y*f};
      ctx.moveTo(h.x-d.x*1.1*s,h.y-d.y*1.1*s);ctx.lineTo(h.x+fwd.x*w-d.x*1.6*s,h.y+fwd.y*w-d.y*1.6*s);
      ctx.lineTo(h.x+fwd.x*w+d.x*.9*s,h.y+fwd.y*w+d.y*.9*s);ctx.lineTo(h.x+d.x*.4*s,h.y+d.y*.4*s);
    }else if(tool==='pickaxe'){
      // Curved double point across the haft.
      const w=3.1*s;
      ctx.moveTo(b.x-n.x*w-d.x*.9*s,b.y-n.y*w-d.y*.9*s);ctx.quadraticCurveTo(b.x+d.x*.9*s,b.y+d.y*.9*s,b.x+n.x*w-d.x*.9*s,b.y+n.y*w-d.y*.9*s);
      ctx.quadraticCurveTo(b.x+d.x*.2*s,b.y+d.y*.2*s,b.x-n.x*w-d.x*.9*s,b.y-n.y*w-d.y*.9*s);
    }else if(tool==='hammer'){
      const w=1.4*s,h=.9*s;
      ctx.moveTo(b.x-n.x*w-d.x*h,b.y-n.y*w-d.y*h);ctx.lineTo(b.x+n.x*w-d.x*h,b.y+n.y*w-d.y*h);
      ctx.lineTo(b.x+n.x*w+d.x*h,b.y+n.y*w+d.y*h);ctx.lineTo(b.x-n.x*w+d.x*h,b.y-n.y*w+d.y*h);
    }else if(tool==='shovel'){
      // Blade in line with the handle.
      const w=1.25*s,l=2.6*s;
      ctx.moveTo(b.x-n.x*w*.8,b.y-n.y*w*.8);ctx.lineTo(b.x+n.x*w*.8,b.y+n.y*w*.8);
      ctx.lineTo(b.x+n.x*w+d.x*l*.75,b.y+n.y*w+d.y*l*.75);ctx.quadraticCurveTo(b.x+d.x*l*1.1,b.y+d.y*l*1.1,b.x-n.x*w+d.x*l*.75,b.y-n.y*w+d.y*l*.75);
    }else if(tool==='hoe'){
      // Blade bent back towards the worker.
      const w=1.9*s,back={x:-n.x*f,y:-n.y*f};
      ctx.moveTo(b.x,b.y);ctx.lineTo(b.x+back.x*w*.4+d.x*.6*s,b.y+back.y*w*.4+d.y*.6*s);
      ctx.lineTo(b.x+back.x*w+d.x*.3*s,b.y+back.y*w+d.y*.3*s);ctx.lineTo(b.x+back.x*w-d.x*.5*s,b.y+back.y*w-d.y*.5*s);
    }else if(tool==='sickle'){
      // Crescent blade sweeping forward from the end of the short handle.
      const r=1.7*s,fwd={x:n.x*f,y:n.y*f},c={x:b.x+fwd.x*r*.9+d.x*r*.3,y:b.y+fwd.y*r*.9+d.y*r*.3};
      const a0=Math.atan2(b.y-c.y,b.x-c.x);
      ctx.strokeStyle=IRON;ctx.lineWidth=Math.max(.9,.8*s);
      ctx.beginPath();ctx.arc(c.x,c.y,r,a0,a0+f*Math.PI*.85,f<0);ctx.stroke();
      return;
    }
    ctx.closePath();ctx.fill();ctx.stroke();
  }
  // Short-lived particles thrown at the stroke: deterministic per cycle.
  const FX={
    chips:{n:4,col:['#d9b77c','#b48a52'],v:[.5,1.4],up:1.8,life:.45,size:.55},
    dust:{n:6,col:['#b9b2a3','#8f897d','#e6d9a8'],v:[.6,1.6],up:1.6,life:.5,size:.6},
    spark:{n:3,col:['#f2c14e','#fff1b8'],v:[.4,1.0],up:1.2,life:.22,size:.4},
    clod:{n:3,col:['#7d5a36','#9b7448'],v:[1.2,2.0],up:2.6,life:.6,size:.95},
    soil:{n:4,col:['#6e5236','#8a6a46'],v:[.4,1.0],up:1.4,life:.4,size:.6},
    seeds:{n:9,col:['#e7d49a','#c9b26c'],v:[.9,2.2],up:.9,life:.7,size:.35},
    stalks:{n:4,col:['#d8b95a','#b89a3c'],v:[.3,1.0],up:1.1,life:.55,size:.7},
    slip:{n:3,col:['#9b5a36','#c48a62'],v:[.3,.8],up:.7,life:.4,size:.45},
    lint:{n:4,col:['#e8e0c8','#d8cfae'],v:[.2,.6],up:.5,life:.6,size:.35}
  };
  function drawFx(tool,id,cycle,u,at,f,s){
    const T=TOOLS[tool],F=FX[T.fx],age=(u-T.hit)*T.period;
    if(!F||age<0||age>F.life)return;
    const r=rnd(hash(String(id))^Math.imul(cycle,2654435761)),grav=9*s;
    ctx.save();ctx.globalAlpha*=1-age/F.life*.7;
    for(let k=0;k<F.n;k++){
      const sp=lerp(F.v[0],F.v[1],r())*s*4,ang=tool==='seeds'?lerp(-.2,.7,r()):lerp(.2,1.2,r());
      const vx=f*Math.cos(ang)*sp*(tool==='shovel'?1.3:1),vy=-(F.up*s*4)*lerp(.6,1.1,r())*(tool==='seeds'?.4:1)+Math.sin(ang)*sp*.3;
      const x=at.x+vx*age,y=at.y+vy*age+.5*grav*4*age*age,sz=Math.max(.6,F.size*s*lerp(.7,1.2,r()));
      ctx.fillStyle=F.col[k%F.col.length];
      if(tool==='stalks'){ctx.strokeStyle=ctx.fillStyle;ctx.lineWidth=Math.max(.5,.35*s);ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+f*sz*1.6,y-sz*.8);ctx.stroke()}
      else ctx.fillRect(x-sz/2,y-sz/2,sz,sz);
    }
    ctx.restore();
  }
  const darken=(hex,k)=>{const h=hex.replace('#','');return'#'+[0,2,4].map(i=>Math.round(parseInt(h.slice(i,i+2),16)*k).toString(16).padStart(2,'0')).join('')};
  // A villager dot ({p,id,kind,sex,age,hair,colors}) at work. facing: 1 right, -1 left.
  function drawWorkerUnmasked(dot,tool,t,facing=1){
    const T=TOOLS[tool];if(!T)return drawVillagerFigureUnmasked(dot);
    const P=pose(tool,dot.id,t),base=w2s(dot.p,.10),scale=State.view.scale*.5;
    const bodyW=6*scale,bodyH=8*scale,bodyY=base.y-bodyH*.16,top=bodyY-bodyH/2,f=facing<0?-1:1;
    // Too small to read a tool: the plain figure.
    if(scale<.16)return drawVillagerFigureUnmasked(dot);
    ctx.save();
    // Lean and bob pivot on the feet.
    ctx.translate(base.x,base.y+P.bob*bodyH);ctx.rotate(f*P.lean);ctx.translate(-base.x,-base.y);
    const sack=tool==='seeds';
    if(sack){   // seed bag on the far hip, behind the body
      ctx.fillStyle='#cdb88c';ctx.strokeStyle='#6d5a3b';ctx.lineWidth=Math.max(.5,.4*scale);
      ctx.beginPath();ctx.ellipse(base.x-f*bodyW*.42,bodyY+bodyH*.12,bodyW*.3,bodyH*.26,0,0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.beginPath();ctx.moveTo(base.x-f*bodyW*.4,top+bodyH*.05);ctx.lineTo(base.x+f*bodyW*.25,bodyY-bodyH*.1);ctx.stroke();
    }
    drawVillagerFigureUnmasked(dot);
    // Hands rise with the tool: high when it points up, at the waist when down.
    const shoulder={x:base.x+f*bodyW*.18,y:top+bodyH*.2};
    // The sower's hand swings on the arm; tool hands rise with the tool.
    // The weaver's hand travels forward and back through the shed at the height of the warp.
    const reach=tool==='shuttle'?Math.max(0,Math.min(1,(P.th-1.2)/.95)):0;
    const g=sack?{x:shoulder.x+dirOf(P.th,f).x*bodyW*.95,y:shoulder.y+dirOf(P.th,f).y*bodyW*.95}
      :tool==='shuttle'?{x:base.x+f*bodyW*(.3+.75*reach),y:bodyY+bodyH*(.02-.04*reach)}
      :{x:base.x+f*bodyW*.48,y:bodyY-bodyH*(.08+.28*Math.cos(P.th))};
    if(BENCH.has(tool))drawBench(tool,g,f,scale,{base,bodyW,bodyH,bodyY,u:P.u});
    else if(!sack)drawTool(tool,g,f,P.th,scale);
    // Arm: shoulder to hand, in the darker tunic tone (or the cloak's, when wearing one).
    ctx.strokeStyle=darken(window.ConquerWardrobe?.outfitFor(dot)?.sleeve||dot.colors?.[0]||'#8c6b3f',.78);ctx.lineWidth=Math.max(.8,1.1*scale);ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(shoulder.x,shoulder.y);ctx.lineTo(g.x,g.y);ctx.stroke();
    ctx.fillStyle=VILLAGER_SKIN;ctx.beginPath();ctx.arc(g.x,g.y,Math.max(.5,.55*scale),0,Math.PI*2);ctx.fill();
    // Effect origin: where the tool tip strikes (or the casting hand).
    const hitTh=keys(KEYS[tool],T.hit).th,d=dirOf(hitTh,f),L=T.len*scale*.78;
    const gHit={x:base.x+f*bodyW*.48,y:bodyY-bodyH*(.08+.28*Math.cos(hitTh))};
    const at=sack?{x:base.x+f*bodyW*.9,y:bodyY-bodyH*.1}:BENCH.has(tool)?{x:g.x+f*bodyW*.2,y:g.y}
      :{x:gHit.x+d.x*L,y:Math.min(base.y,gHit.y+d.y*L)};
    ctx.restore();
    drawFx(tool,dot.id,P.cycle,P.u,{x:at.x,y:at.y+P.bob*bodyH},f,scale);
  }
  // WebGL figures: the stroke is cut into PHASES poses; the time is moved to the middle of the
  // worker's current phase, so every worker of the same look shares the same few tiles.
  const PHASES=8;
  function phaseTime(tool,id,t){
    const T=TOOLS[tool],k=(hash(String(id))%1000)/1000*T.period*.9,c=(t+k)/T.period,b=Math.floor((c-Math.floor(c))*PHASES);
    return{b,t:(b+.5)/PHASES*T.period-k};
  }
  const look=dot=>typeof villagerLookKey==='function'?villagerLookKey(dot):(dot.colors||[]).join(',');
  function drawWorker(dot,tool,t,facing){
    if(TOOLS[tool]&&window.ConquerWorld3D?.figure){
      const q=phaseTime(tool,dot.id,t),f=facing<0?-1:1;
      // Painted facing right; a worker facing left is the same card flipped.
      if(window.ConquerWorld3D.figure(dot.p,.10,'w|'+tool+'|'+q.b+'|'+look(dot),()=>drawWorkerUnmasked({...dot,p:{x:0,y:0}},tool,q.t,1),dot.id,f<0))return true;
    }
    return withUrbanFigureOcclusion(dot.p,.10,()=>drawWorkerUnmasked(dot,tool,t,facing));
  }
  // A walking worker carries the tool on the shoulder.
  function drawCarrierUnmasked(dot,tool,facing=1){
    const base=w2s(dot.p,.10),scale=State.view.scale*.5,bodyW=6*scale,bodyH=8*scale,bodyY=base.y-bodyH*.16,f=facing<0?-1:1;
    drawVillagerFigureUnmasked(dot);
    if(scale<.16||tool==='seeds')return;
    const g={x:base.x+f*bodyW*.3,y:bodyY-bodyH*.28};
    ctx.save();drawTool(tool,g,f,tool==='hammer'||tool==='sickle'?.9:-.75,scale);ctx.restore();
  }
  function drawCarrier(dot,tool,facing){
    const f=facing<0?-1:1;
    if(window.ConquerWorld3D?.figure?.(dot.p,.10,'c|'+tool+'|'+look(dot),()=>drawCarrierUnmasked({...dot,p:{x:0,y:0}},tool,1),dot.id,f<0))return true;
    return withUrbanFigureOcclusion(dot.p,.10,()=>drawCarrierUnmasked(dot,tool,facing))}
  // Screen-space facing of a world direction (dx,dy).
  function facingOf(p,dx,dy){const a=w2s(p,0),b=w2s({x:p.x+dx,y:p.y+dy},0);return b.x>=a.x?1:-1}
  const now=()=>(typeof performance!=='undefined'?performance.now():Date.now())/1000;
  // Anonymous labourers are L1: grey and beige cloth.
  const WORKER_COLORS=[['#9c9078','#7d7a72'],['#b4a58a','#8f8b82'],['#a39e93','#7d7a72'],['#c8bda6','#9c9078'],['#8f8b82','#b9b2a3']];
  function anonymous(id,p){
    const h=hash(String(id));
    return{p,id:String(id),kind:'peasant',sex:'male',age:'adult',colors:WORKER_COLORS[h%WORKER_COLORS.length],
      hair:typeof villagerHair==='function'?villagerHair(String(id)):'brown'};
  }
  // ---------- builders at construction sites (visual only)
  function siteSpots(s){
    if(s.a&&s.b){
      const dx=s.b.x-s.a.x,dy=s.b.y-s.a.y,L=Math.hypot(dx,dy)||1,nx=-dy/L,ny=dx/L,w=(Number(s.width)||.5)/2+.45;
      return[[.3,1],[.7,-1],[.5,1]].map(([t,side])=>({x:s.a.x+dx*t+nx*w*side,y:s.a.y+dy*t+ny*w*side,to:{x:s.a.x+dx*t,y:s.a.y+dy*t}}));
    }
    let polys=[];try{polys=urbanBuildingPolygons(s)}catch{}
    const c=typeof structureCenter==='function'?structureCenter(s):{x:s.x,y:s.y};
    const pts=polys.flat().filter(Boolean);
    if(!pts.length){const r=typeof pointRadius==='function'?pointRadius(s):1;return[0,2.1,4.2].map(a=>({x:c.x+Math.cos(a)*(r+.4),y:c.y+Math.sin(a)*(r+.4),to:c}))}
    return pts.map(p=>{const dx=p.x-c.x,dy=p.y-c.y,L=Math.hypot(dx,dy)||1;return{x:p.x+dx/L*.45,y:p.y+dy/L*.45,to:p}});
  }
  function drawBuilders(){
    if((window.ConquerCombat?.alarmMode?.()||'off')!=='off')return;
    const frac=State.clock.day-Math.floor(State.clock.day);
    if(frac<.24||frac>.74)return;
    if(State.view.scale<.3)return;
    const t=now();
    for(const s of State.structures||[]){
      if(s.auto||s.type==='road'||s.type==='field'||!underConstruction(s))continue;
      // Builders stand on the camera side of the site: figures are drawn over the
      // structure, so one behind it would appear on top of the walls.
      const c=typeof structureCenter==='function'?structureCenter(s):{x:s.x??(s.a.x+s.b.x)/2,y:s.y??(s.a.y+s.b.y)/2};
      const spots=siteSpots(s).filter(sp=>viewDepthPoint(sp)>=viewDepthPoint(c)-.05);if(!spots.length)continue;
      const n=Math.min(spots.length,s.a&&s.b?2:3),start=hash(String(s.id))%spots.length;
      for(let i=0;i<n;i++){
        const sp=spots[(start+i*Math.max(1,Math.floor(spots.length/n)))%spots.length];
        if(!worldPointVisible(sp,0,40))continue;
        drawWorker(anonymous(s.id+':builder'+i,sp),'hammer',t,facingOf(sp,sp.to.x-sp.x,sp.to.y-sp.y));
      }
    }
  }
  const FIELD_TOOL={plough:'hoe',sow:'seeds',harvest:'sickle'};
  window.ConquerWorkAnim={TOOLS,FIELD_TOOL,PHASES,phaseTime,pose,drawWorker,drawWorkerUnmasked,drawCarrier,drawCarrierUnmasked,
    drawBuilders,anonymous,facingOf,now};
})();
