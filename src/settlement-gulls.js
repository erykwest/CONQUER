'use strict';
// Seagulls along the coast (2D sprites, graphics only, real time): small flocks wheeling over
// the shore, the harbour and the water near it, flapping and gliding with a faint shadow on
// the ground; a few stand on the rocks, the beaches and the pier heads. None fly at night and
// fewer in a storm. Derived from the coast (settlement-coast.js) and the harbour works.
(() => {
  const FLOCKS=7,PER_FLOCK=4,PERCHED=10;
  const h01=n=>{n=Math.imul(n^n>>>16,0x45d9f3b);n=Math.imul(n^n>>>16,0x45d9f3b);return((n^n>>>16)>>>0)/4294967296};
  let cache={key:null,flocks:[],perched:[]};
  function layout(){
    const C=window.ConquerCoast,d=C?.shore?.();if(!d)return null;
    const piers=(State.structures||[]).filter(s=>s.type==='pier'&&!s.yard);
    const key=C.stretches().length+'|'+d.side+'|'+(State.seed||0)+'|'+piers.map(p=>p.id).join();
    if(cache.key===key)return cache;
    const pts=C.stretches().flatMap(s=>s.points.map(p=>({...p,kind:s.kind})));if(!pts.length)return null;
    const seed=(Number(State.seed)||1)*131;
    // Flocks circle over points of the coast (and the pier heads), half over the water.
    const centres=[...piers.map(p=>({x:p.x+Math.cos(p.angle||0)*4,y:p.y+Math.sin(p.angle||0)*4})),
      ...Array.from({length:FLOCKS},(_,i)=>{const p=pts[Math.floor(h01(seed+i*17)*pts.length)];return{x:p.x+d.D.x*(1+h01(seed+i*5)*6),y:p.y+d.D.y*(1+h01(seed+i*5)*6)}})];
    const flocks=centres.slice(0,FLOCKS+2).map((c,i)=>({c,r:3+h01(seed+i*3)*4,z:2.6+h01(seed+i*7)*2.6,w:(.25+h01(seed+i*11)*.25)*(h01(seed+i*13)<.5?1:-1),ph:h01(seed+i*19)*6.28,n:2+Math.floor(h01(seed+i*23)*(PER_FLOCK-1))}));
    // Perched: on the rocks and the beaches near the water, and on the pier heads.
    const perched=[];
    for(let i=0;i<PERCHED;i++){
      const p=pts[Math.floor(h01(seed+900+i*7)*pts.length)],off=p.kind==='rocks'?.4:-.2;
      perched.push({x:p.x+d.D.x*off+(h01(seed+i)-.5),y:p.y+d.D.y*off+(h01(seed+i*3)-.5),z:p.kind==='rocks'?.35:0,ph:h01(seed+i*29)*6.28,dir:h01(seed+i*31)<.5?1:-1});
    }
    for(const p of piers)perched.push({x:p.x+Math.cos(p.angle||0)*((p.reach||8)-.2),y:p.y+Math.sin(p.angle||0)*((p.reach||8)-.2),z:.95,ph:h01(p.x*7)*6.28,dir:1});
    cache={key,flocks,perched};return cache;
  }
  // Pixels per U at the current zoom (gull sizes follow the scene).
  const pxPerU=()=>{const a=w2sRaw({x:100,y:100},0),b=w2sRaw({x:101,y:100},0);return Math.hypot(b.x-a.x,b.y-a.y)||8};
  function drawFlying(x,y,s,flap,dir){
    // Wings: two arcs from the body, raised or lowered by the flap; dark tips.
    const span=s*1.1,lift=flap*s*.55;
    ctx.strokeStyle='rgba(120,124,126,.95)';ctx.lineWidth=Math.max(1,s*.16);
    ctx.beginPath();ctx.moveTo(x-span,y-lift);ctx.quadraticCurveTo(x-span*.45,y-s*.35-lift*.4,x,y);ctx.quadraticCurveTo(x+span*.45,y-s*.35-lift*.4,x+span,y-lift);ctx.stroke();
    ctx.strokeStyle='rgba(40,42,44,.9)';ctx.lineWidth=Math.max(1,s*.14);
    ctx.beginPath();ctx.moveTo(x-span,y-lift);ctx.lineTo(x-span*.78,y-lift*.9-s*.08);ctx.moveTo(x+span,y-lift);ctx.lineTo(x+span*.78,y-lift*.9-s*.08);ctx.stroke();
    ctx.fillStyle='#f4f4f0';ctx.beginPath();ctx.ellipse(x+dir*s*.08,y+s*.05,s*.34,s*.15,0,0,Math.PI*2);ctx.fill();
  }
  function drawPerched(x,y,s,dir,bob){
    ctx.fillStyle='#8f9496';ctx.beginPath();ctx.ellipse(x-dir*s*.05,y-s*.36,s*.42,s*.17,0,0,Math.PI*2);ctx.fill();           // grey back
    ctx.fillStyle='#f4f4f0';ctx.beginPath();ctx.ellipse(x,y-s*.28,s*.36,s*.2,0,0,Math.PI*2);ctx.fill();                       // white body
    ctx.beginPath();ctx.arc(x+dir*s*.32,y-s*(.52+bob),s*.14,0,Math.PI*2);ctx.fill();                                            // head
    ctx.fillStyle='#e0b23a';ctx.fillRect(x+dir*s*.44,y-s*(.53+bob),dir*s*.14,s*.05);                                            // beak
    ctx.fillStyle='#2b2c2e';ctx.fillRect(x-dir*s*.5,y-s*.4,-dir*s*.12,s*.08);                                                   // dark tail
    ctx.strokeStyle='#d9a441';ctx.lineWidth=Math.max(.7,s*.06);ctx.beginPath();ctx.moveTo(x-s*.05,y-s*.1);ctx.lineTo(x-s*.05,y);ctx.moveTo(x+s*.08,y-s*.1);ctx.lineTo(x+s*.08,y);ctx.stroke();
  }
  function draw(now){
    if(typeof ctx==='undefined'||typeof w2sRaw!=='function')return false;
    const L=layout();if(!L)return false;
    const night=typeof nightFactor==='function'?nightFactor():0,kind=typeof currentWeather==='function'?currentWeather().kind:'clear';
    const k=pxPerU(),s=Math.max(2.2,k*.32);
    const W=ctx.canvas?ctx.canvas.width/(window.devicePixelRatio||1):1e9,H=ctx.canvas?ctx.canvas.height/(window.devicePixelRatio||1):1e9;
    const on=q=>q.x>-40&&q.y>-40&&q.x<W+40&&q.y<H+40;
    let drawn=false;
    ctx.save();ctx.lineCap='round';
    for(const g of L.perched){
      const q=w2sRaw(g,g.z);if(!on(q))continue;
      drawPerched(q.x,q.y,s*.9,g.dir,Math.max(0,Math.sin(now*1.3+g.ph))**8*.12);drawn=true;
    }
    if(night<.6){
      const flocks=kind==='storm'?L.flocks.filter((_,i)=>i%2===0):L.flocks;
      for(const f of flocks)for(let i=0;i<f.n;i++){
        // Each gull wheels on its own loop of the flock's circle, rising and dipping.
        const a=now*f.w+f.ph+i*1.9,r=f.r*(1+.25*Math.sin(now*.3+i)),z=f.z+Math.sin(now*.5+i*2.3)*.6;
        const p={x:f.c.x+Math.cos(a)*r,y:f.c.y+Math.sin(a)*r*.8},q=w2sRaw(p,z);if(!on(q))continue;
        // Shadow on the ground (or water) under the bird.
        const sh=w2sRaw(p,0);ctx.fillStyle='rgba(20,25,28,.14)';ctx.beginPath();ctx.ellipse(sh.x,sh.y,s*.55,s*.18,0,0,Math.PI*2);ctx.fill();
        // A few wingbeats, then a glide with the wings held level.
        const beat=(now*.7+i*.37+f.ph)%3,flap=beat<1.2?Math.sin(beat*Math.PI*4.5):.15;
        const dir=Math.sign(Math.cos(a+Math.PI/2)*f.w)||1;
        drawFlying(q.x,q.y,s,flap,dir);drawn=true;
      }
    }
    ctx.restore();
    if(drawn&&typeof requestSceneDraw==='function')requestSceneDraw();
    return drawn;
  }
  window.ConquerGulls=Object.freeze({layout,draw});
})();
