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
    if(!s||!STAFFED.has(s.type)||!C3()?.cutawayActive?.(s))return null;
    return s;
  }
  // Town hall (tribunal, prison) and the other staffed civic interiors (ConquerCivic3D.roomSlots).
  const STAFFED=new Set(['townhall','church','tavern','bargello','balivo']);
  function slots(s){
    const list=C3()?.roomSlots?.(s)||[];
    return occupancySource?occupancySource(s,list)||[]:list;
  }
  // Actors at time t (seconds): pure, so the scene can be tested without a canvas.
  function scene(s,t){
    return slots(s).map(sl=>{
      const ph=hash(s.id+':'+sl.id)%1000/1000,a={...sl,phase:frac(t*.35+ph),gesture:0,bob:0,sway:0,t};
      if(sl.action==='preside'){const c=frac(t/7+ph);a.gesture=c<.22?Math.sin(c/.22*Math.PI):0}
      else if(sl.action==='write')a.gesture=.5+.5*Math.sin(t*5+ph*9);
      else if(sl.action==='bound')a.sway=Math.sin(t*.9+ph*6)*.012;
      else if(sl.action==='bars'){a.gesture=.5+.5*Math.sin(t*.6+ph*7);a.sway=Math.sin(t*.5+ph*4)*.015}
      else if(sl.action==='doze')a.bob=-Math.max(0,Math.sin(t*.3+ph*5))*.01;
      else if(sl.role==='public')a.bob=Math.max(0,Math.sin(t*1.3+ph*20))*(hash(sl.id)%3===0?.008:0);
      return a;
    });
  }
  // ---------- figures
  const ROLE_DRESS={judge:['judgeRobe','judgeCap'],clerk:['clerkGown','clerkCap'],prisoner:['prisonerShirt'],executioner:['executionerHood'],
    jailer:['jerkin','leatherCap','keys']};
  const PUBLIC_KINDS=['peasant','peasant','artisan','artisan','merchant'];
  function dotOf(s,a,p){
    const id=s.id+':court:'+a.id,kind=a.role==='public'?PUBLIC_KINDS[hash(id)%PUBLIC_KINDS.length]:['prisoner','executioner','jailer'].includes(a.role)?'peasant':'elite';
    const sex=a.role==='public'&&hash(id+':sex')%2?'female':'male';
    const colors=typeof villagerBodyColors==='function'?villagerBodyColors(id,kind):['#8c6b3f','#5d4a33'];
    const hair=a.role==='prisoner'?'brown':typeof villagerHair==='function'?villagerHair(id):'brown';
    const dress=ROLE_DRESS[a.role],trade=!dress&&W()?.ROLES?.[a.role];
    const own={prisoner:['#8a7f6a','#6d6352'],executioner:['#2e2624','#221c1b'],jailer:['#5a4030','#3e2c21']}[a.role];
    // A trade (settlement-wardrobe.js ROLES) dresses for the season in its free slots; a costume of office does not.
    if(trade)return{p,id,kind:window.ConquerStaffPeople?.KIND?.[a.role]||kind,role:a.role,sex,age:'adult',hair,colors:own||colors};
    return{p,id,kind,sex,age:'adult',hair,colors:own||colors,
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
      // Staff at work: the gesture of the trade (settlement-work-anim.js).
      if(a.tool&&window.ConquerWorkAnim){window.ConquerWorkAnim.drawWorkerUnmasked(dot,a.tool,a.t??0,a.facing||1);return}
      drawVillagerFigureUnmasked(dot);
      const F=frame(p);if(F.scale<.16)return;
      const sleeve=darken(dot.outfit?.sleeve||dot.colors[0],.78);
      if((a.role==='judge'||a.role==='bailiff')&&a.gesture>0){
        // The presiding judge raises his right hand to speak.
        const sh={x:F.base.x+F.bodyW*.2,y:F.top+F.bodyH*.2};
        arm(sh,{x:sh.x+F.bodyW*.25,y:sh.y-F.bodyH*(.15+.35*a.gesture)},sleeve,F.scale);
      }else if(a.action==='read'){
        // The magistrate holds the sentence open in both hands.
        const y=F.top+F.bodyH*(.28+.04*a.gesture);
        for(const k of [-1,1])arm({x:F.base.x+k*F.bodyW*.22,y:F.top+F.bodyH*.2},{x:F.base.x+k*F.bodyW*.2,y},sleeve,F.scale);
        ctx.fillStyle='#ece3cc';ctx.strokeStyle='rgba(33,24,16,.7)';ctx.lineWidth=Math.max(.4,.3*F.scale);
        ctx.beginPath();ctx.rect(F.base.x-F.bodyW*.24,y-F.bodyH*.2,F.bodyW*.48,F.bodyH*.24);ctx.fill();ctx.stroke();
      }else if(a.action==='jeer'&&a.gesture>0){
        // An onlooker shakes a raised fist.
        const sh={x:F.base.x+F.bodyW*.2,y:F.top+F.bodyH*.2};
        arm(sh,{x:sh.x+F.bodyW*.18,y:sh.y-F.bodyH*(.1+.35*a.gesture)},sleeve,F.scale);
      }else if(a.role==='executioner'){
        // Arms folded, waiting.
        const y=F.bodyY-F.bodyH*.02;
        for(const k of [-1,1])arm({x:F.base.x+k*F.bodyW*.22,y:F.top+F.bodyH*.2},{x:F.base.x-k*F.bodyW*.14,y},sleeve,F.scale);
      }else if(a.role==='clerk'){
        // Pen on the register: the hand moves along the line, a dark quill above it.
        const sh={x:F.base.x+F.bodyW*.2,y:F.top+F.bodyH*.2},h={x:F.base.x+F.bodyW*(.38+.14*a.gesture),y:F.bodyY+F.bodyH*.05};
        arm(sh,h,sleeve,F.scale);
        ctx.strokeStyle='#2a2320';ctx.lineWidth=Math.max(.5,.35*F.scale);ctx.beginPath();ctx.moveTo(h.x,h.y);ctx.lineTo(h.x+F.bodyW*.12,h.y-F.bodyH*.22);ctx.stroke();
      }else if(a.action==='bars'){
        // Hands on the bars in front, pulling now and then.
        for(const k of [-1,1])arm({x:F.base.x+k*F.bodyW*.22,y:F.top+F.bodyH*.2},{x:F.base.x+k*F.bodyW*.3,y:F.top-F.bodyH*(.02+.06*a.gesture)},sleeve,F.scale);
      }else if(a.action==='bound'){
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
    const t=window.ConquerWorkAnim?.now?.()??performance.now()/1000;
    drawJustice(t);
    const s=courtBuilding();if(!s)return;
    const ground0=typeof placementGroundZ==='function'&&Number.isFinite(placementGroundZ(s))?placementGroundZ(s):terrainElevation(s);
    // Church, tavern, Bargello, Balivo: their people are in by day (settlement-staff-people.js).
    if(s.type!=='townhall'){if(window.ConquerStaffPeople?.onDuty?.())paintActors(s,scene(s,t),ground0);return}
    // The tribunal sits by day; the prison is never empty.
    const role=C3().townhallRole?.(s,C3().visibleFloor(s));
    if(role!=='prison'&&!(role==='tribunal'&&inSession()))return;
    const ground=typeof placementGroundZ==='function'&&Number.isFinite(placementGroundZ(s))?placementGroundZ(s):terrainElevation(s);
    paintActors(s,scene(s,t),ground,null,C3().prisonBars?.(s));
  }
  // The cell bars again, over the prisoners, when the camera looks at the cells through them.
  function paintBars(s,bars,toWorld,ground){
    const a=toWorld((bars.x0+bars.x1)/2,bars.y),b=toWorld((bars.x0+bars.x1)/2,bars.back);
    if(viewDepthPoint(a)<=viewDepthPoint(b))return;
    withProjectionGroundZ(ground,()=>{
      ctx.save();ctx.strokeStyle='#4f5357';ctx.lineCap='butt';ctx.lineWidth=Math.max(.8,State.view.scale*.11);
      ctx.beginPath();
      for(let x=bars.x0;x<=bars.x1+1e-6;x+=bars.step){const p=toWorld(x,bars.y),lo=w2s(p,bars.z),hi=w2s(p,bars.z+bars.h);ctx.moveTo(lo.x,lo.y);ctx.lineTo(hi.x,hi.y)}
      const l=w2s(toWorld(bars.x0,bars.y),bars.z+bars.h-.02),r=w2s(toWorld(bars.x1,bars.y),bars.z+bars.h-.02);
      ctx.moveTo(l.x,l.y);ctx.lineTo(r.x,r.y);ctx.stroke();ctx.restore();
    });
  }
  // ---------- public justice: pillory, gallows and scaffold (eventVenue pillory / gallows / scaffold)
  // Sober and never graphic: the pillory holds a condemned man with bound hands while onlookers jeer;
  // on justice day the hooded executioner waits on the gallows or the scaffold (a magistrate reads
  // on the scaffold's bench), guards keep the stair and a crowd watches. No victim, no execution:
  // the scene stops at the waiting.
  const PILLORY_HOURS=[8/24,17/24],JUSTICE_DAY=4,JUSTICE_HOURS=[10/24,12/24];   // Friday 10-12
  const JUSTICE_VENUES=new Set(['pillory','gallows','scaffold']);
  // Local layouts (U) from tools/blender/build_events.py (metres / 3.5); the front is at -y.
  const STAGE={pillory:.171,gallows:.343,scaffold:.429};
  // Height (U) of the solid part of each work (base, deck, drape, parapet): the posts and the beam
  // above are open, the people behind them stay in view.
  const TOP={pillory:.2,gallows:.52,scaffold:.69};
  function dayClock(){
    const day=Number(State.clock?.day)||0;
    return{weekday:window.ConquerEconomy?.weekday?.(day)??(((Math.floor(day)%7)+7)%7),
      f:typeof visualCycleFrac==='function'?visualCycleFrac():frac(day),
      calm:(window.ConquerCombat?.alarmMode?.()||'off')==='off'&&!(typeof solarIsNight==='function'&&solarIsNight())};
  }
  function justiceInSession(venue){
    if(typeof State==='undefined'||!JUSTICE_VENUES.has(venue))return false;
    const {weekday,f,calm}=dayClock();if(!calm)return false;
    if(venue==='pillory')return weekday<6&&f>=PILLORY_HOURS[0]&&f<PILLORY_HOURS[1];
    return weekday===JUSTICE_DAY&&f>=JUSTICE_HOURS[0]&&f<JUSTICE_HOURS[1];
  }
  // Onlookers on an arc in front of the work, a fixed draw per structure.
  function crowd(s,n,r0,r1,spread){
    let h=hash(String(s.id)+':crowd');const rnd=()=>((h=Math.imul(h^(h>>>13),1597334677)>>>0)%1000)/1000,out=[];
    for(let i=0;i<n;i++){
      const a=-Math.PI/2+(i/(n-1||1)-.5)*spread+(rnd()-.5)*.2,r=r0+(r1-r0)*rnd();
      out.push({id:'crowd'+i,role:'public',action:rnd()<.35?'jeer':'watch',x:Math.cos(a)*r,y:Math.sin(a)*r,z:0});
    }
    return out;
  }
  function justiceSlots(s){
    if(s?.type!=='eventVenue'||!JUSTICE_VENUES.has(s.venue))return[];
    const v=s.venue,z=STAGE[v],out=[];
    if(v==='pillory'){
      out.push({id:'condemned',role:'prisoner',action:'bound',x:0,y:.06,z});
      out.push(...crowd(s,5,.62,.95,1.9));
    }else if(v==='gallows'){
      out.push({id:'executioner',role:'executioner',action:'wait',x:.14,y:.12,z});
      out.push({id:'guard0',role:'guard',action:'stand',x:.78,y:-.4,z:0},{id:'guard1',role:'guard',action:'stand',x:.98,y:-.4,z:0});
      out.push(...crowd(s,9,1.3,1.65,1.7));
    }else{
      out.push({id:'executioner',role:'executioner',action:'wait',x:.22,y:-.04,z});
      out.push({id:'magistrate',role:'clerk',action:'read',x:0,y:.47,z:z+.063-.12});
      out.push({id:'guard0',role:'guard',action:'stand',x:.95,y:-.48,z:0},{id:'guard1',role:'guard',action:'stand',x:.95,y:-.22,z:0});
      out.push(...crowd(s,11,1.5,1.9,1.8));
    }
    return out;
  }
  function justiceScene(s,t){
    return justiceSlots(s).map(sl=>{
      const ph=hash(s.id+':'+sl.id)%1000/1000,a={...sl,phase:frac(t*.35+ph),gesture:0,bob:0,sway:0};
      if(sl.action==='jeer'){const c=frac(t/4+ph);a.gesture=c<.3?Math.sin(c/.3*Math.PI):0}
      else if(sl.action==='bound')a.sway=Math.sin(t*.7+ph*6)*.008;
      else if(sl.action==='read')a.gesture=.5+.5*Math.sin(t*.8+ph*5);
      else if(sl.action==='wait')a.sway=Math.sin(t*.4+ph*3)*.01;
      else if(sl.action==='watch')a.bob=Math.max(0,Math.sin(t*1.1+ph*20))*(hash(sl.id)%3===0?.006:0);
      return a;
    });
  }
  function venueGround(s){
    if(Number.isFinite(s.groundZ))return s.groundZ;
    return typeof placementGroundZ==='function'&&Number.isFinite(placementGroundZ(s))?placementGroundZ(s):terrainElevation(s);
  }
  function drawJustice(t){
    for(const s of State.structures||[]){
      if(s.type!=='eventVenue'||!JUSTICE_VENUES.has(s.venue)||(typeof underConstruction==='function'&&underConstruction(s)))continue;
      if(!justiceInSession(s.venue)||(typeof worldPointVisible==='function'&&!worldPointVisible(s,.3,120)))continue;
      const ground=venueGround(s);
      paintActors(s,justiceScene(s,t),ground,silhouette(s,ground));
    }
  }
  // Screen outline of the work (footprint box up to its model height): the people standing behind
  // it are clipped out of it, as the event stands cover their audience.
  function silhouette(s,ground){
    const pts=window.ConquerEvents3D?.footprint?.(s);if(!pts||typeof withProjectionGroundZ!=='function')return null;
    const scr=withProjectionGroundZ(ground,()=>pts.flatMap(p=>[w2s(p,0),w2s(p,TOP[s.venue]||1)]));
    // Convex hull (monotone chain).
    const P=scr.slice().sort((a,b)=>a.x-b.x||a.y-b.y),cross=(o,a,b)=>(a.x-o.x)*(b.y-o.y)-(a.y-o.y)*(b.x-o.x),lo=[],hi=[];
    for(const p of P){while(lo.length>1&&cross(lo[lo.length-2],lo[lo.length-1],p)<=0)lo.pop();lo.push(p)}
    for(const p of P.slice().reverse()){while(hi.length>1&&cross(hi[hi.length-2],hi[hi.length-1],p)<=0)hi.pop();hi.push(p)}
    return{hull:lo.slice(0,-1).concat(hi.slice(0,-1)),depth:viewDepthPoint(s)};
  }
  function paintActors(s,actors,ground,occluder=null,bars=null){
    if(!actors.length)return;
    const a0=s.angle||0,c=Math.cos(a0),sn=Math.sin(a0);
    const toWorld=(x,y)=>({x:s.x+x*c-y*sn,y:s.y+x*sn+y*c});
    let order=actors.map(a=>({a,d:viewDepthPoint(toWorld(a.x,a.y))})).sort((p,q)=>p.d-q.d);
    if(bars){
      // Prisoners (behind the bars) first, then the bars, then whoever stands outside the cells.
      const inside=order.filter(o=>o.a.role==='prisoner');
      for(const {a} of inside)drawActor(s,a,toWorld,ground);
      paintBars(s,bars,toWorld,ground);
      order=order.filter(o=>o.a.role!=='prisoner');
    }
    for(const {a,d} of order){
      // On the ground behind the work: hidden where the work stands in front.
      if(occluder&&a.z<.05&&d<occluder.depth){
        ctx.save();ctx.beginPath();ctx.rect(-1e4,-1e4,3e4,3e4);
        occluder.hull.forEach((q,i)=>i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y));ctx.closePath();ctx.clip('evenodd');
        drawActor(s,a,toWorld,ground);ctx.restore();
      }else drawActor(s,a,toWorld,ground);
    }
  }
  // A prisoner in a castle cell (settlement-population-garrisons.js), at the room's floor level:
  // sitting on the straw, or standing with his hands on the bars.
  function drawCellPrisoner(p,floorZ,id,phase,sitting){
    const g=typeof structureProjectionGroundZ!=='undefined'&&Number.isFinite(structureProjectionGroundZ)?structureProjectionGroundZ:terrainElevation(p);
    const a={id:'cell',role:'prisoner',action:sitting?'sit':'bars',x:0,y:0,z:floorZ-(sitting?.1:0),
      phase,gesture:.5+.5*Math.sin(phase*Math.PI*2),bob:0,sway:0};
    drawActor({id},a,()=>p,g);
  }
  function setOccupancySource(fn){occupancySource=typeof fn==='function'?fn:null}
  window.ConquerCourtPeople={SESSION_START,SESSION_END,PILLORY_HOURS,JUSTICE_DAY,JUSTICE_HOURS,inSession,courtBuilding,slots,scene,
    justiceInSession,justiceSlots,justiceScene,draw,dotOf,drawCellPrisoner,setOccupancySource};
})();
