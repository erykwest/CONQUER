'use strict';
// CONQUER court people (docs/crime.md): the tribunal in session inside the town hall cutaway.
// When the selected town hall shows its tribunal floor (floor-by-floor cutaway) on a working day,
// by day and with no alarm, the room fills: three judges in red robes on the bench (the presiding
// one raises a hand now and then), the clerk writing at his desk, the prisoner at the bar with bound
// hands between two guards, and the public on the benches.
// Places come from ConquerCivic3D.roomSlots (the same layout as the furniture). The people are
// decorative and provisional: no residents, no sentences; a real crime runtime can replace them
// with setOccupancySource(fn(s, slots) -> slots).
// Like the other figures (shop artisan, event people) they are painted on the 2D canvas after the
// buildings in both renderers. Classic script.
(function(){
  const SESSION_START=.375,SESSION_END=.71;   // 9:00 - 17:00
  let occupancySource=null;
  const W=()=>window.ConquerWardrobe,C3=()=>window.ConquerCivic3D;
  function hash(str){let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
  const frac=x=>x-Math.floor(x);
  // Monday-Friday, by day, while the bell is silent.
  function inSession(){
    if(typeof State==='undefined')return false;
    const day=Number(State.clock?.day)||0;
    const weekday=window.ConquerEconomy?.weekday?.(day)??(((Math.floor(day)%7)+7)%7);
    if(weekday>=5)return false;
    if((window.ConquerCombat?.alarmMode?.()||'off')!=='off')return false;
    const f=typeof visualCycleFrac==='function'?visualCycleFrac():frac(day);
    return f>=SESSION_START&&f<SESSION_END&&!(typeof solarIsNight==='function'&&solarIsNight());
  }
  // The selected town hall showing its tribunal, if any.
  function courtBuilding(){
    if(typeof State==='undefined'||!State.selectedId)return null;
    const s=(State.structures||[]).find(o=>o.id===State.selectedId);
    if(!s||s.type!=='townhall'||!C3()?.cutawayActive?.(s))return null;
    return s;
  }
  function slots(s){
    const list=C3()?.roomSlots?.(s)||[];
    return occupancySource?occupancySource(s,list)||[]:list;
  }
  // Actors at time t (seconds): pure, so the scene can be tested without a canvas.
  function scene(s,t){
    return slots(s).map(sl=>{
      const ph=hash(s.id+':'+sl.id)%1000/1000,a={...sl,phase:frac(t*.35+ph),gesture:0,bob:0,sway:0};
      if(sl.action==='preside'){const c=frac(t/7+ph);a.gesture=c<.22?Math.sin(c/.22*Math.PI):0}
      else if(sl.action==='write')a.gesture=.5+.5*Math.sin(t*5+ph*9);
      else if(sl.action==='bound')a.sway=Math.sin(t*.9+ph*6)*.012;
      else if(sl.role==='public')a.bob=Math.max(0,Math.sin(t*1.3+ph*20))*(hash(sl.id)%3===0?.008:0);
      return a;
    });
  }
  // ---------- figures
  const ROLE_DRESS={judge:['judgeRobe','judgeCap'],clerk:['clerkGown','clerkCap'],prisoner:['prisonerShirt']};
  const PUBLIC_KINDS=['peasant','peasant','artisan','artisan','merchant'];
  function dotOf(s,a,p){
    const id=s.id+':court:'+a.id,kind=a.role==='public'?PUBLIC_KINDS[hash(id)%PUBLIC_KINDS.length]:a.role==='prisoner'?'peasant':'elite';
    const sex=a.role==='public'&&hash(id+':sex')%2?'female':'male';
    const colors=typeof villagerBodyColors==='function'?villagerBodyColors(id,kind):['#8c6b3f','#5d4a33'];
    const hair=a.role==='prisoner'?'brown':typeof villagerHair==='function'?villagerHair(id):'brown';
    const dress=ROLE_DRESS[a.role];
    return{p,id,kind,sex,age:'adult',hair,colors:a.role==='prisoner'?['#8a7f6a','#6d6352']:colors,
      outfit:dress?W()?.compose(dress,id,kind)??null:null};
  }
  const darken=(hex,k)=>{const h=hex.replace('#','');return'#'+[0,2,4].map(i=>Math.round(parseInt(h.slice(i,i+2),16)*k).toString(16).padStart(2,'0')).join('')};
  // Body frame of a figure drawn by drawVillagerFigureUnmasked at the current projection ground.
  function frame(p){
    const base=w2s(p,.10),scale=State.view.scale*.5,bodyW=6*scale,bodyH=8*scale,bodyY=base.y-bodyH*.16;
    return{base,scale,bodyW,bodyH,bodyY,top:bodyY-bodyH/2};
  }
  function arm(from,to,color,scale){
    ctx.strokeStyle=color;ctx.lineWidth=Math.max(.8,1.1*scale);ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(from.x,from.y);ctx.lineTo(to.x,to.y);ctx.stroke();
    ctx.fillStyle=VILLAGER_SKIN;ctx.beginPath();ctx.arc(to.x,to.y,Math.max(.5,.55*scale),0,Math.PI*2);ctx.fill();
  }
  function drawActor(s,a,toWorld,ground){
    const p=toWorld(a.x+a.sway,a.y);
    withProjectionGroundZ(ground+a.z+a.bob,()=>{
      if(a.role==='guard'){drawSoldierFigureUnmasked(p,.09,'spearman',s.id+':court:'+a.id,a.phase);return}
      const dot=dotOf(s,a,p);
      drawVillagerFigureUnmasked(dot);
      const F=frame(p);if(F.scale<.16)return;
      const sleeve=darken(dot.outfit?.sleeve||dot.colors[0],.78);
      if(a.role==='judge'&&a.gesture>0){
        // The presiding judge raises his right hand to speak.
        const sh={x:F.base.x+F.bodyW*.2,y:F.top+F.bodyH*.2};
        arm(sh,{x:sh.x+F.bodyW*.25,y:sh.y-F.bodyH*(.15+.35*a.gesture)},sleeve,F.scale);
      }else if(a.role==='clerk'){
        // Pen on the register: the hand moves along the line, a dark quill above it.
        const sh={x:F.base.x+F.bodyW*.2,y:F.top+F.bodyH*.2},h={x:F.base.x+F.bodyW*(.38+.14*a.gesture),y:F.bodyY+F.bodyH*.05};
        arm(sh,h,sleeve,F.scale);
        ctx.strokeStyle='#2a2320';ctx.lineWidth=Math.max(.5,.35*F.scale);ctx.beginPath();ctx.moveTo(h.x,h.y);ctx.lineTo(h.x+F.bodyW*.12,h.y-F.bodyH*.22);ctx.stroke();
      }else if(a.role==='prisoner'){
        // Both hands bound in front at the waist, a turn of rope round the wrists.
        const y=F.bodyY+F.bodyH*.08,m={x:F.base.x,y};
        for(const k of [-1,1])arm({x:F.base.x+k*F.bodyW*.22,y:F.top+F.bodyH*.2},{x:m.x+k*F.bodyW*.06,y},sleeve,F.scale);
        ctx.strokeStyle='#c2a46a';ctx.lineWidth=Math.max(.5,.45*F.scale);
        ctx.beginPath();ctx.ellipse(m.x,y,F.bodyW*.14,F.bodyH*.05,0,0,Math.PI*2);ctx.stroke();
      }
    });
  }
  // Painted after the buildings, back to front.
  function draw(){
    const s=courtBuilding();if(!s||!inSession())return;
    const t=window.ConquerWorkAnim?.now?.()??performance.now()/1000;
    const actors=scene(s,t);if(!actors.length)return;
    const a0=s.angle||0,c=Math.cos(a0),sn=Math.sin(a0);
    const toWorld=(x,y)=>({x:s.x+x*c-y*sn,y:s.y+x*sn+y*c});
    const ground=typeof placementGroundZ==='function'&&Number.isFinite(placementGroundZ(s))?placementGroundZ(s):terrainElevation(s);
    const order=actors.map(a=>({a,d:viewDepthPoint(toWorld(a.x,a.y))})).sort((p,q)=>p.d-q.d);
    for(const {a} of order)drawActor(s,a,toWorld,ground);
  }
  function setOccupancySource(fn){occupancySource=typeof fn==='function'?fn:null}
  window.ConquerCourtPeople={SESSION_START,SESSION_END,inSession,courtBuilding,slots,scene,draw,dotOf,setOccupancySource};
})();
