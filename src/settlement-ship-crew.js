'use strict';
// Ship crews (civil sailors first). Each ship model carries crew marks from Blender
// (tools/blender/build_ships.py): a walk along the waist, and per mast a climb (the port
// shrouds where there are ratlines, else the mast) ending at working spots aloft.
// A crew is a small state machine on the game clock: deck hands walk, stop and coil
// ropes; on an order to raise or lower the sails the topmen go to their mast, climb,
// and only once they are aloft do the sails move (settlement-ships.js morph); the deck
// hands haul on the halyards meanwhile; when the sails are set or furled the topmen come
// down. Poses are local to the ship (U, +x bow); drawSailor paints a figure. Visual only.
(() => {
  const M=window.ConquerShipModels,S=window.ConquerShips;if(!M?.ships||!S)return;
  const WALK=.32,CLIMB=.5,HOLD=.8;          // U/s on deck, U/s up the rigging, s aloft after the sails stop
  function hash(str){let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
  function rng(seed){let a=seed|0;return()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
  // Point at arc-length fraction u along a polyline of [x,y,z].
  function along(path,u){
    const L=[0];for(let i=1;i<path.length;i++)L.push(L[i-1]+Math.hypot(...[0,1,2].map(k=>path[i][k]-path[i-1][k])));
    const d=Math.max(0,Math.min(1,u))*L.at(-1);
    for(let i=1;i<path.length;i++)if(d<=L[i]||i===path.length-1){
      const t=(d-L[i-1])/((L[i]-L[i-1])||1);return[0,1,2].map(k=>path[i-1][k]+(path[i][k]-path[i-1][k])*t);
    }
    return path[0].slice();
  }
  const length=path=>path.slice(1).reduce((a,p,i)=>a+Math.hypot(...[0,1,2].map(k=>p[k]-path[i][k])),0);
  // Deck parameter (0 stern end of the waist .. 1 bow end) nearest to x.
  const deckParam=(c,x)=>{const a=c.deck[0][0],b=c.deck.at(-1)[0];return Math.max(0,Math.min(1,(x-a)/((b-a)||1)))};
  function deckPoint(c,s,y){const p=along(c.deck,s);p[1]=y;return p}

  // A crew for one ship. sail: a ConquerShips.sailState (shared with the mesh).
  function crewState(key,id='ship',sail=S.sailState()){
    const c=(M.models||M.ships)[key].crew,r=rng(hash(id+':'+key)),sailors=[];
    // Topmen fill the working spots aloft mast by mast; at least one hand stays on deck.
    const spots=[];c.masts.forEach((m,mi)=>m.aloft.forEach((_,si)=>spots.push([mi,si])));
    spots.sort((a,b)=>a[1]-b[1]||a[0]-b[0]);
    const top=Math.min(spots.length,Math.max(1,c.n-1));
    for(let i=0;i<c.n;i++){
      const aloft=i<top?spots[i]:null;
      sailors.push({id:id+':'+key+':'+i,role:aloft?'top':'deck',mast:aloft?.[0]??(c.masts.length?i%c.masts.length:0),slot:aloft?.[1]??0,
        mode:'walk',s:r(),y:(r()-.5)*2*c.half,goal:r(),goalY:(r()-.5)*2*c.half,timer:1+r()*3,climb:0,dir:[1,0,0],
        p:null,rng:rng(hash(id+':'+i))});
    }
    const cs={key,c,sail,sailors,pending:null,hold:0,t:0};
    for(const s of sailors)place(cs,s);
    return cs;
  }
  // Climb path of a topman: up the mast's climb, then out to his spot aloft.
  const climbPath=(c,s)=>{const m=c.masts[s.mast];return[...m.climb,m.aloft[s.slot]]};
  function place(cs,s){
    const c=cs.c,before=s.p;
    if(s.mode==='climb'||s.mode==='aloft'||s.mode==='descend')s.p=along(climbPath(c,s),s.climb);
    else s.p=deckPoint(c,s.s,s.y);
    if(before){const d=[0,1,2].map(k=>s.p[k]-before[k]);if(Math.hypot(d[0],d[1])>1e-4)s.dir=d}
  }
  // Orders: 'raise' furls the sails up to the yards, 'lower' sets them.
  function order(cs,what){
    const target=what==='raise'?1:0;
    if(cs.sail.target===target&&!cs.pending)return false;
    cs.pending=what;
    for(const s of cs.sailors)if(s.role==='top')s.mode=s.mode==='descend'?'climb':s.mode==='aloft'||s.mode==='climb'?s.mode:'toMast';
    return true;
  }
  const manoeuvring=cs=>!!cs.pending||cs.sail.t!==cs.sail.target;
  // Walk s towards deck parameter g and lateral y towards gy; true on arrival.
  function walkTo(cs,s,g,gy,dt){
    const span=length(cs.c.deck)||1,ds=g-s.s,dy=gy-s.y,step=WALK*dt;
    const d=Math.hypot(ds*span,dy);if(d<=step){s.s=g;s.y=gy;return true}
    s.s+=ds*span/d*step/span;s.y+=dy/d*step;return false;
  }
  function step(cs,dt){
    cs.t+=dt;const c=cs.c,tops=cs.sailors.filter(s=>s.role==='top');
    for(const s of cs.sailors){
      // Rowing boats have no masts: their hands only work on deck.
      const m=c.masts[s.mast],foot=m?.climb[0],h=m?length(climbPath(c,s))||1:1;
      if(s.mode==='toMast'){
        if(walkTo(cs,s,deckParam(c,foot[0]),foot[1],dt)){s.mode='climb';s.climb=0}
      }else if(s.mode==='climb'){
        s.climb=Math.min(1,s.climb+CLIMB*dt/h);if(s.climb>=1)s.mode='aloft';
      }else if(s.mode==='aloft'){
        if(!cs.pending&&!manoeuvring(cs)&&cs.hold<=0)s.mode='descend';
      }else if(s.mode==='descend'){
        s.climb=Math.max(0,s.climb-CLIMB*1.3*dt/h);
        if(s.climb<=0){s.mode='walk';s.s=deckParam(c,foot[0]);s.y=foot[1];s.goal=s.rng();s.goalY=(s.rng()-.5)*2*c.half}
      }else if(manoeuvring(cs)&&s.role==='deck'&&m){
        // Deck hands man the halyard at the foot of their mast and haul.
        const g=deckParam(c,m.x+.12*(1+s.slot)),gy=-.12-(cs.sailors.indexOf(s)%3)*.1;
        if(walkTo(cs,s,g,gy,dt))s.mode='haul';else s.mode='walk';
      }else{
        // Off duty: walk to a spot, stop a while (now and then coiling a rope), walk on.
        if(s.mode==='haul')s.mode='walk';
        if(s.mode==='walk'){if(walkTo(cs,s,s.goal,s.goalY,dt)){s.mode=s.rng()<.35?'coil':'idle';s.timer=1.5+s.rng()*3}}
        else if((s.timer-=dt)<=0){s.mode='walk';s.goal=s.rng();s.goalY=(s.rng()-.5)*2*c.half}
      }
      place(cs,s);
    }
    // The sails move once every topman is aloft.
    if(cs.pending&&tops.every(s=>s.mode==='aloft')){
      (cs.pending==='raise'?S.raise:S.lower)(cs.sail);cs.pending=null;cs.hold=HOLD;
    }
    S.step(cs.sail,dt);
    if(!cs.pending&&cs.sail.t===cs.sail.target&&cs.hold>0)cs.hold-=dt;
    return cs;
  }
  // Sailors as {id,mode,local:[x,y,z],dir:[dx,dy,dz]} for the renderer.
  const sailors=cs=>cs.sailors.map(s=>({id:s.id,mode:s.mode==='toMast'?'walk':s.mode==='descend'?'climb':s.mode,local:s.p,dir:s.dir}));
  // Local -> world for a ship pose (heading, heel, trim and height as the hull).
  const toWorld=(pose,l)=>S.toWorld(pose,l);

  // ---------- drawing: the villager figure in sailor colours, with climbing and hauling arms
  const COLORS=[['#3e5b7a','#d9d2c3'],['#c9c2b0','#3e5b7a'],['#7a4b32','#d9d2c3'],['#2f4a61','#b9b09a'],['#d9d2c3','#6b4a33']];
  function dot(id,p){
    const h=hash(String(id));
    return{p,id:String(id),kind:'peasant',sex:'male',age:'adult',colors:COLORS[h%COLORS.length],
      hair:typeof villagerHair==='function'?villagerHair(String(id)):'brown'};
  }
  const darken=(hex,k)=>{const h=hex.replace('#','');return'#'+[0,2,4].map(i=>Math.round(parseInt(h.slice(i,i+2),16)*k).toString(16).padStart(2,'0')).join('')};
  // WebGL figures (settlement-world3d.js figure()): each mode's motion is a cycle of rate RATE;
  // it is cut into PHASES poses and the time moved to the middle of the sailor's current one.
  const RATE={walk:7,haul:3.2,climb:5,aloft:2.4,coil:4},PHASES=8;
  function phaseTime(d,mode,t){
    const r=RATE[mode];if(!r)return{b:0,t:0};
    const ph=(hash(d.id)%1000)/1000*6.28,c=((t*r+ph)/(Math.PI*2)),b=Math.floor((c-Math.floor(c))*PHASES);
    return{b,t:((b+.5)/PHASES*Math.PI*2-ph)/r};
  }
  // A sailor at world point w (feet height w.z): a depth-tested card in WebGL, so the hull, the
  // sails and the bulwarks in front hide it; false outside a 3D frame.
  function sailorFigure(d,mode,t,facing,z){
    const W=window.ConquerWorld3D;if(!W?.figure)return false;
    const q=phaseTime(d,mode,t),f=facing<0?-1:1,look=typeof villagerLookKey==='function'?villagerLookKey(d):d.colors.join(',');
    let ok=false;
    // Painted facing right; a sailor facing left is the same card flipped.
    const run=()=>{ok=W.figure(d.p,.10,'s|'+mode+'|'+q.b+'|'+look,()=>drawSailor({...d,p:{x:0,y:0}},mode,q.t,1),d.id,f<0)};
    if(typeof withProjectionGroundZ==='function')withProjectionGroundZ(z-.1,run);else run();
    return ok;
  }
  // Every pose a sailor can show (all modes and phases), as {key,paint} for figure prewarming.
  function sailorPoses(d){
    const out=[],look=typeof villagerLookKey==='function'?villagerLookKey(d):d.colors.join(','),ph=(hash(d.id)%1000)/1000*6.28;
    // Only the poses a crew shows most (standing, walking): preparing every mode filled the atlas.
    for(const mode of ['idle','walk']){
      const r=RATE[mode];
      for(let b=0;b<(r?PHASES:1);b++){const t=r?((b+.5)/PHASES*Math.PI*2-ph)/r:0;out.push({key:'s|'+mode+'|'+b+'|'+look,paint:()=>drawSailor({...d,p:{x:0,y:0}},mode,t,1)})}
    }
    return out;
  }
  // mode: walk | idle | coil | haul | climb | aloft. facing: 1 right, -1 left (screen).
  function drawSailor(d,mode,t,facing=1){
    const base=w2s(d.p,.10),scale=State.view.scale*.5,f=facing<0?-1:1;
    const bodyW=6*scale,bodyH=8*scale,bodyY=base.y-bodyH*.16,top=bodyY-bodyH/2;
    const ph=(hash(d.id)%1000)/1000*6.28;
    ctx.save();
    if(mode==='walk')ctx.translate(0,-Math.abs(Math.sin(t*7+ph))*bodyH*.05);
    if(mode==='haul'){const k=Math.sin(t*3.2+ph);ctx.translate(base.x,base.y);ctx.rotate(-f*(.12+.1*k));ctx.translate(-base.x,-base.y)}
    drawVillagerFigureUnmasked(d);
    if(scale<.16||mode==='walk'||mode==='idle'){ctx.restore();return}
    ctx.strokeStyle=darken(d.colors[0],.78);ctx.lineWidth=Math.max(.8,1.1*scale);ctx.lineCap='round';
    const sh=[{x:base.x-bodyW*.22,y:top+bodyH*.2},{x:base.x+bodyW*.22,y:top+bodyH*.2}];
    let hands;
    if(mode==='climb'){
      // Hand over hand up the shrouds: the hands alternate above the head.
      const k=Math.sin(t*5+ph);
      hands=[{x:sh[0].x-bodyW*.05,y:top-bodyH*(.3+.25*k)},{x:sh[1].x+bodyW*.05,y:top-bodyH*(.3-.25*k)}];
    }else if(mode==='aloft'){
      // Leaning over the yard, working the sail.
      const k=Math.sin(t*2.4+ph);
      hands=[{x:sh[0].x+f*bodyW*.5,y:top-bodyH*(.15+.12*k)},{x:sh[1].x+f*bodyW*.55,y:top-bodyH*(.15-.12*k)}];
    }else if(mode==='haul'){
      // Both hands on the rope, reaching forward and up, pulling back.
      const k=(Math.sin(t*3.2+ph)+1)/2;
      hands=[{x:base.x+f*bodyW*(.35+.35*k),y:top-bodyH*(.25+.2*k)},{x:base.x+f*bodyW*(.25+.3*k),y:top-bodyH*(.05+.15*k)}];
      ctx.strokeStyle='#b8a47a';ctx.lineWidth=Math.max(.5,.5*scale);
      ctx.beginPath();ctx.moveTo(hands[1].x-f*bodyW*.3,hands[1].y+bodyH*.3);ctx.lineTo(hands[0].x+f*bodyW*.4,hands[0].y-bodyH*.6);ctx.stroke();
      ctx.strokeStyle=darken(d.colors[0],.78);ctx.lineWidth=Math.max(.8,1.1*scale);
    }else{
      // Coiling a rope at the waist.
      const k=t*4+ph;
      hands=[{x:base.x+f*bodyW*(.35+.12*Math.cos(k)),y:bodyY+bodyH*.05*Math.sin(k)},{x:base.x+f*bodyW*.3,y:bodyY+bodyH*.12}];
      ctx.strokeStyle='#b8a47a';ctx.lineWidth=Math.max(.6,.6*scale);
      ctx.beginPath();ctx.ellipse(base.x+f*bodyW*.36,bodyY+bodyH*.22,bodyW*.22,bodyH*.08,0,0,Math.PI*2);ctx.stroke();
      ctx.strokeStyle=darken(d.colors[0],.78);ctx.lineWidth=Math.max(.8,1.1*scale);
    }
    for(let i=0;i<2;i++){
      ctx.beginPath();ctx.moveTo(sh[i].x,sh[i].y);ctx.lineTo(hands[i].x,hands[i].y);ctx.stroke();
      ctx.fillStyle=typeof VILLAGER_SKIN!=='undefined'?VILLAGER_SKIN:'#d99a83';
      ctx.beginPath();ctx.arc(hands[i].x,hands[i].y,Math.max(.5,.55*scale),0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
  }
  window.ConquerShipCrew=Object.freeze({crewState,order,step,sailors,toWorld,dot,drawSailor,sailorFigure,sailorPoses,phaseTime,manoeuvring,WALK,CLIMB});
})();
