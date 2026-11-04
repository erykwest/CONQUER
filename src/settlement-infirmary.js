'use strict';
// CONQUER infirmary: a room of built sections (W1 section or W2 hall, ground or first floor).
// Daily, while its staff (1 surgeon L3 + 2 attendants L1 per room unit) is paid from the
// castle gold: fallen squads inside Yellow are carried in and 60% of them return after three
// days at half health, wounded living troops heal 25% a day in a bed, and the beds left free
// tend the townsfolk (L1/L2 happiness at the weekly market). Ward state lives on the units.
(function(){
  const BEDS_PER_UNIT=6,SURVIVAL=.6,WARD_DAYS=3,RETURN_HP=.5,HEAL_PER_DAY=.25,TRIAGE_DAYS=1;
  const RESIDENTS_PER_BED=40,CARE_GROUPS=['L1','L2'],CARE_CAP=75,MONTH_SHIFTS=20;
  const ALLIED=new Set(['squad','patrol','knight','captain']);
  const units=()=>window.ConquerCombat?.units()||[];
  // Beds a unit takes: a squad is five men, a patrol two pikemen, a knight or captain one.
  const bedsFor=u=>u.kind==='squad'?5:u.kind==='patrol'?2:1;
  // Deterministic survival roll per unit (same save, same outcome).
  function roll(id){let h=2166136261;for(const c of String(id)){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return (h>>>0)/4294967296}
  let last={day:null,staffed:false,beds:0,ward:0,healing:0,free:0,admitted:0,lost:0,discharged:0};

  function rooms(){
    const captured=new Set(window.ConquerSiege?.state?.().circle?.capturedRoomIds||[]),out=[];
    for(const s of State.structures){
      if(s.type!=='built'||s.destroyed||underConstruction(s)||!Array.isArray(s.functions))continue;
      s.functions.forEach((fn,i)=>{
        if(fn!=='infirmary'||captured.has(s.id+':'+i))return;
        if(window.ConquerSiege&&!window.ConquerSiege.allowed(s,i,fn))return;
        const size=functionSlotUnits(s,i);
        out.push({id:s.id+':'+i,structure:s,slot:i,units:size,beds:BEDS_PER_UNIT*size});
      });
    }
    return out;
  }
  // Monthly wages of one surgeon (L3) and two attendants (L1) per room unit, per day.
  function wagePerDay(list=rooms()){
    const w=window.ConquerEconomy?.state?.().wage||{L1:1,L3:3};
    return list.reduce((sum,r)=>sum+r.units*((Number(w.L3)||3)+2*(Number(w.L1)||1))/MONTH_SHIFTS,0);
  }
  function pay(list,days){
    const E=window.ConquerEconomy;
    if(!E||!State.village?.founded)return false;
    const e=E.state(),w=e.wage||{L1:1,L3:3},cost=wagePerDay(list)*days;
    if(!(Number(e.castleGold)>=cost))return false;
    const share=list.reduce((n,r)=>n+r.units,0)*days/MONTH_SHIFTS;
    e.castleGold=Math.round((e.castleGold-cost)*1e8)/1e8;
    e.wallet.L3=(Number(e.wallet.L3)||0)+share*(Number(w.L3)||3);
    e.wallet.L1=(Number(e.wallet.L1)||0)+share*2*(Number(w.L1)||1);
    E.syncBuilderResources?.();
    return true;
  }
  // Discharge point: just outside the long side of the built section, on free ground.
  function entry(room){
    const s=room.structure,c={x:(s.a.x+s.b.x)/2,y:(s.a.y+s.b.y)/2};
    const a=Math.atan2(s.b.y-s.a.y,s.b.x-s.a.x),dx=-Math.sin(a),dy=Math.cos(a);
    for(const pad of [1.7,2.4,3.4])for(const side of [1,-1]){
      const p={x:c.x+dx*pad*side,y:c.y+dy*pad*side};
      if(typeof pointBlockedForPeasant!=='function'||!pointBlockedForPeasant(p))return p;
    }
    return c;
  }
  const yellow=u=>!!window.ConquerCombat?.areaState?.({x:u.x,y:u.y})?.yellow;
  function discharge(u,room){
    const s=u.stats,R=window.ConquerCombatRules,p=entry(room);
    u.defeated=false;u.routing=false;delete u.ward;delete u.fallenDay;
    if(s){s.hp=Math.max(1,Math.round(s.maxHp*RETURN_HP));s.brain=R?.MAX_B??150;s.energy=R?.MAX_E??150;s.shock=0}
    u.x=p.x;u.y=p.y;u.target=null;u.path=null;u.pathIndex=1;u.campState=null;
  }
  function tick(before,after){
    const days=Math.max(0,Number(after)-Number(before));
    if(!days)return last;
    const list=rooms(),byId=new Map(list.map(r=>[r.id,r])),roster=units();
    const out={day:after,staffed:false,beds:list.reduce((n,r)=>n+r.beds,0),ward:0,healing:0,free:0,admitted:0,lost:0,discharged:0};
    // Fallen allies are noted on the day they fall; untreated past the triage window they are lost.
    for(const u of roster){
      if(!ALLIED.has(u.kind)||!u.defeated||u.ward||u.lost)continue;
      if(!Number.isFinite(u.fallenDay))u.fallenDay=after;
      if(!yellow(u)||after-u.fallenDay>TRIAGE_DAYS){u.lost=true;out.lost++}
    }
    // A patient whose infirmary was closed, destroyed or captured dies of the wounds.
    for(const u of roster)if(u.ward&&!byId.has(u.ward.room)){delete u.ward;u.lost=true;out.lost++}
    out.staffed=list.length>0&&pay(list,days);
    const used=new Map(list.map(r=>[r.id,0]));
    for(const u of roster)if(u.ward)used.set(u.ward.room,used.get(u.ward.room)+bedsFor(u));
    if(!out.staffed){
      // Unpaid staff: nobody is admitted, healed or discharged; ward days do not count.
      for(const u of roster)if(u.ward)u.ward.until+=days;
    }else{
      for(const u of roster){
        if(!u.ward||u.ward.until>after)continue;
        used.set(u.ward.room,used.get(u.ward.room)-bedsFor(u));
        discharge(u,byId.get(u.ward.room));out.discharged++;
      }
      const bedFor=need=>list.find(r=>r.beds-used.get(r.id)>=need);
      for(const u of roster){
        if(!ALLIED.has(u.kind)||!u.defeated||u.ward||u.lost)continue;
        const room=bedFor(bedsFor(u));if(!room)continue;
        if(roll(u.id)>=SURVIVAL){u.lost=true;out.lost++;continue}
        u.ward={room:room.id,since:after,until:after+WARD_DAYS};
        used.set(room.id,used.get(room.id)+bedsFor(u));out.admitted++;
      }
      // Wounded living troops off the line, worst first, heal in the beds still free.
      const wounded=roster.filter(u=>ALLIED.has(u.kind)&&!u.defeated&&!u.engaged&&u.stats&&u.stats.hp>0&&u.stats.hp<u.stats.maxHp)
        .sort((a,b)=>a.stats.hp/a.stats.maxHp-b.stats.hp/b.stats.maxHp);
      for(const u of wounded){
        const room=bedFor(bedsFor(u));if(!room)continue;
        used.set(room.id,used.get(room.id)+bedsFor(u));out.healing+=bedsFor(u);
        u.stats.hp=Math.min(u.stats.maxHp,u.stats.hp+u.stats.maxHp*HEAL_PER_DAY*days);
      }
    }
    for(const u of roster)if(u.ward)out.ward+=bedsFor(u);
    out.free=Math.max(0,out.beds-out.ward-out.healing);
    if(out.admitted||out.discharged||out.lost){State.dirty=true;if(typeof scheduleLocalSave==='function')scheduleLocalSave(500)}
    last=out;return out;
  }
  function residents(){
    const pop=window.ConquerEconomy?.population?.();
    return pop?Object.values(pop).reduce((a,b)=>a+(Number(b)||0),0):(window.ConquerSiege?.civilians?.()||0);
  }
  // Weekly happiness bonus: +1 for L1/L2 while staffed free beds cover one resident in 40.
  function care(group,happiness,people=residents()){
    if(!CARE_GROUPS.includes(group)||!last.staffed||!(people>0)||happiness>=CARE_CAP)return 0;
    return last.free*RESIDENTS_PER_BED>=people?1:0;
  }
  function roomStatus(s,i){
    const room=rooms().find(r=>r.structure===s&&r.slot===i);
    if(!room)return null;
    let ward=0;for(const u of units())if(u.ward?.room===room.id)ward+=bedsFor(u);
    return{beds:room.beds,units:room.units,ward,staffed:last.staffed,started:last.day!=null,wage:wagePerDay([room])};
  }
  function slotLegend(s,i){
    const r=roomStatus(s,i);if(!r)return'';
    return '<div class="legend" data-infirmary-room>Beds '+r.ward+' / '+r.beds+' · staff '+r.units+' surgeon + '+2*r.units+' attendants · '+
      r.wage.toFixed(2)+' gold/day · '+(!r.started?'first shift tomorrow':r.staffed?'paid':'unpaid: no care')+'</div>';
  }
  window.ConquerInfirmary=Object.freeze({BEDS_PER_UNIT,SURVIVAL,WARD_DAYS,RETURN_HP,HEAL_PER_DAY,RESIDENTS_PER_BED,
    rooms,wagePerDay,bedsFor,roll,tick,care,roomStatus,slotLegend,status:()=>({...last})});
})();
