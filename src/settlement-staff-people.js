'use strict';
// CONQUER staff people: the household of the castle rooms (cook, groom, armourer, chaplain,
// treasurer, surgeon and orderlies, falconer, dove-keeper, councillors) and the people of the
// civic interiors that had none (priest at the altar, innkeeper at the counter, the watch and the
// collectors of the Bargello, the judges of the Balivo). Each one wears the clothes of the trade
// (settlement-wardrobe.js ROLES) and works with a gesture of settlement-work-anim.js.
// Decorative like the court people: the rooms' economy (wages, beds, treasury) is untouched.
// Staff are in by day (6:00-20:00) and never during an alarm. Classic script.
(function(){
  const DAY_START=.25,DAY_END=.83;
  // Room function (settlement-cutaway-furniture.js ROOMS) -> staff [role, tool] for a small room;
  // a large room adds the `more` entries.
  const ROOM_STAFF={
    kitchen:{staff:[['cook','ladle']],more:[['cook','ladle']]},
    stables:{staff:[['groom','brush']],more:[['groom','brush']]},
    armory:{staff:[['blacksmith','hammer']]},
    workshop:{staff:[['blacksmith','hammer']],more:[['blacksmith','hammer']]},
    chapel:{staff:[['priest','book']]},
    treasury:{staff:[['treasurer','quill']]},
    infirmary:{staff:[['surgeon','mortar'],['orderly','bowl']],more:[['orderly','bowl']]},
    mews:{staff:[['falconer','falcon']]},
    dovecote:{staff:[['dovekeeper','seeds']]},
    council:{staff:[['councillor','speak'],['councillor','speak']],more:[['councillor','speak']]}
  };
  // Officials sit a class above the household.
  const KIND={treasurer:'merchant',councillor:'elite',surgeon:'merchant',priest:'artisan',bailiff:'elite',exactor:'artisan',herald:'merchant'};
  function hash(str){let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
  const frac=x=>x-Math.floor(x);
  function onDuty(){
    if(typeof State==='undefined')return false;
    if((window.ConquerCombat?.alarmMode?.()||'off')!=='off')return false;
    const f=typeof visualCycleFrac==='function'?visualCycleFrac():frac(Number(State.clock?.day)||0);
    return f>=DAY_START&&f<DAY_END;
  }
  function roomStaff(role,size){
    const R=ROOM_STAFF[role];if(!R)return[];
    return size==='large'&&R.more?R.staff.concat(R.more):R.staff.slice();
  }
  // A figure of the staff: the villager body in the trade's clothes.
  function dot(id,role,p){
    const kind=KIND[role]||'peasant';
    const colors=typeof villagerBodyColors==='function'?villagerBodyColors(id,kind):['#8c6b3f','#5d4a32'];
    const hair=typeof villagerHair==='function'?villagerHair(id):'brown';
    return{p,id,kind,role,sex:'male',age:'adult',hair,colors};
  }
  const facingOf=id=>(hash(id+':face')&1)?1:-1;
  // One staff member standing at p on a floor floorZ above the projection ground in use.
  function drawAt(p,floorZ,id,role,tool,facing=facingOf(id)){
    const W=window.ConquerWorkAnim,t=W?.now?.()??0;
    const g=typeof structureProjectionGroundZ!=='undefined'&&Number.isFinite(structureProjectionGroundZ)?structureProjectionGroundZ:terrainElevation(p);
    // drawWorker / drawVillagerFigure: in World3D a depth-tested card in the person capsule at the
    // room's floor (the cut-away walls and floors hide it by depth), else the 2D painter.
    withProjectionGroundZ(g+floorZ,()=>{
      const d=dot(id,role,p);
      if(W&&tool)W.drawWorker(d,tool,t,facing);
      else if(typeof drawVillagerFigure==='function')drawVillagerFigure(d);
      else drawVillagerFigureUnmasked(d);
    });
  }
  // ---------- Throne hall: the lord's court (ROOM-ANIM-THRONE)
  // Around the throne (settlement-cutaway-furniture.js throneHall): the lord sits on it and now and
  // then raises a hand, two spearmen flank the dais, the herald speaks for him in front of it and a
  // petitioner pleads on the runner; a large hall adds a courtier by the table. By day, never during
  // an alarm; at night only the two guards keep the empty throne. Layout in throne-local U:
  // fwd = towards the room (the seat is .4 m behind the dais centre), side = to the throne's left.
  const SEAT_FWD=-.4/3.5,SEAT_Z=.72/3.5;
  const THRONE_COURT=Object.freeze([
    {id:'lord',role:'lord',fwd:SEAT_FWD,side:0,seated:true},
    {id:'guard0',role:'guard',fwd:.22,side:.44,night:true},
    {id:'guard1',role:'guard',fwd:.22,side:-.44,night:true},
    {id:'herald',role:'herald',tool:'speak',fwd:.42,side:.24},
    {id:'petitioner',role:'petitioner',tool:'speak',fwd:.72,side:-.04,toThrone:true},
    {id:'courtier',role:'councillor',tool:'speak',fwd:.5,side:-.36,large:true}
  ]);
  // Who is in the hall now: pure (no canvas), so the scene can be tested.
  function throneCourt(size,day=onDuty(),alarm=(window.ConquerCombat?.alarmMode?.()||'off')!=='off'){
    if(alarm)return[];
    return THRONE_COURT.filter(a=>(day||a.night)&&(!a.large||size==='large'));
  }
  // The lord's raised hand: a short gesture every 6 s, out of step between halls.
  function lordGesture(t,ph){const c=frac(t/6+ph);return c<.25?Math.sin(c/.25*Math.PI):0}
  function drawLord(p,z,id,t){
    drawNobleFigure(p,z,id,0);
    const g=lordGesture(t,hash(id)%1000/1000);if(g<=0)return;
    const scale=typeof militaryScale==='function'?militaryScale():State.view.scale*.5;if(scale<.16)return;
    const base=w2s(p,z),bodyW=5.2*scale,bodyH=9*scale,top=base.y-bodyH*.16-bodyH/2;
    const sh={x:base.x+bodyW*.22,y:top+bodyH*.18},hand={x:sh.x+bodyW*.3,y:sh.y-bodyH*(.1+.3*g)};
    ctx.save();ctx.strokeStyle='#4a2c46';ctx.lineWidth=Math.max(.8,1.1*scale);ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(sh.x,sh.y);ctx.lineTo(hand.x,hand.y);ctx.stroke();
    ctx.fillStyle=typeof VILLAGER_SKIN!=='undefined'?VILLAGER_SKIN:'#d9b48f';ctx.beginPath();ctx.arc(hand.x,hand.y,Math.max(.5,.55*scale),0,Math.PI*2);ctx.fill();
    ctx.restore();
  }
  function drawThroneHall(s,slot){
    const throne=window.ConquerCutawayFurniture?.roomPieces?.(s,slot,'throne')?.[0];if(!throne)return 0;
    const list=throneCourt(slot.size);if(!list.length)return 0;
    const inside=p=>window.ConquerCutawayFurniture.roomContains?.(s,slot,p)??true;
    const t=window.ConquerWorkAnim?.now?.()??performance.now()/1000,seat=throne.at(SEAT_FWD,0);
    const items=list.map(a=>({a,p:throne.at(a.fwd,a.side),id:s.id+'-throne-'+slot.index+'-'+a.id}))
      .filter(it=>it.a.seated||inside(it.p)).map(it=>({...it,depth:viewDepthPoint(it.p)})).sort((x,y)=>x.depth-y.depth);
    for(const {a,p,id} of items){
      if(a.role==='lord')drawLord(p,slot.z+.09+SEAT_Z-.12,id,t);
      else if(a.role==='guard')drawSoldierFigure(p,slot.z+.09,'spearman',id,0);
      else{
        // The petitioner turns to the throne, the others face where the hash says.
        const facing=a.toThrone?(w2s(seat,0).x>=w2s(p,0).x?1:-1):undefined;
        drawAt(p,slot.z,id,a.role,a.tool,facing);
      }
    }
    return items.length;
  }
  // ---------- Common hall: the garrison and the household at table (ROOM-ANIM-COMMON)
  // One diner on every bench of the hall (settlement-cutaway-furniture.js commonHall: a long table
  // with a bench on each side, a second table in a large hall; a figure is as wide as a third of
  // the 1.6 m bench, two per bench hid the table): off-duty soldiers and household sit facing the
  // table, the civilians drinking (gesture `mug`); a servant in an apron carries a bowl at the end
  // of each table. By day, never during an alarm. Places in bench-local U along its side axis;
  // the two benches of a table sit staggered so the diners do not hide each other.
  const BENCH_SEATS=Object.freeze([-.07,.07]),SIT_DROP=.11,TABLE_END=2.2/3.5/2+.09;
  // Who sits where: pure, so the scene can be tested. benches/tables = how many of each the room holds.
  function commonHallScene(benches,tables,day=onDuty(),alarm=(window.ConquerCombat?.alarmMode?.()||'off')!=='off',seed='hall'){
    if(alarm||!day)return[];
    const out=[];
    for(let b=0;b<benches;b++){
      const id=seed+'-b'+b;
      // Soldiers and household mixed at every table, a fixed draw per place.
      out.push({id,kind:(hash(id+':diner')%5)<2?'soldier':'diner',bench:b,side:BENCH_SEATS[b%2],tool:'mug'});
    }
    for(let t=0;t<tables;t++)out.push({id:seed+'-t'+t,kind:'servant',table:t,tool:'bowl',end:hash(seed+'-t'+t+':end')&1?1:-1});
    return out;
  }
  function drawCommonHall(s,slot){
    const CF=window.ConquerCutawayFurniture,benches=CF?.roomPieces?.(s,slot,'bench')||[],tables=CF?.roomPieces?.(s,slot,'tableLong')||[];
    if(!benches.length&&!tables.length)return 0;
    const list=commonHallScene(benches.length,tables.length,undefined,undefined,s.id+'-'+slot.index);if(!list.length)return 0;
    const inside=p=>CF.roomContains?.(s,slot,p)??true;
    // A diner faces the nearest table across the bench.
    const tableNear=p=>tables.slice().sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0]||p;
    // The servant takes the end of his table that is in the room and clear of the other table
    // (in a large hall the two tables may stand end to end), the hashed end first.
    const servantSpot=(tb,end)=>{
      const others=tables.filter(o=>o!==tb),free=p=>inside(p)&&others.every(o=>Math.hypot(o.x-p.x,o.y-p.y)>TABLE_END+.05);
      for(const e of [end,-end]){const p=tb.at(0,e*TABLE_END);if(free(p))return p}
      // Both ends taken: beside the table, on the side away from the benches' diners.
      for(const e of [end,-end]){const p=tb.at(e*.24,e*TABLE_END*.6);if(free(p))return p}
      return null;
    };
    const items=list.map(a=>{
      if(a.kind==='servant'){const tb=tables[a.table],p=servantSpot(tb,a.end);return p?{a,p,look:tb}:null}
      const p=benches[a.bench].at(0,a.side);return{a,p,look:tableNear(p)};
    }).filter(it=>it&&inside(it.p)).map(it=>({...it,depth:viewDepthPoint(it.p)})).sort((x,y)=>x.depth-y.depth);
    for(const {a,p,look} of items){
      const facing=w2s(look,0).x>=w2s(p,0).x?1:-1;
      if(a.kind==='soldier')drawSoldierFigure(p,slot.z+.09-SIT_DROP,'unarmed',s.id+'-hall-'+a.id,0);
      else if(a.kind==='servant')drawAt(p,slot.z,s.id+'-hall-'+a.id,'servant',a.tool,facing);
      else drawAt(p,slot.z-SIT_DROP,s.id+'-hall-'+a.id,'diner',a.tool,facing);
    }
    return items.length;
  }
  // Castle rooms in cutaway (called by drawCutawayOccupants for each room slot).
  function drawRoom(s,slot){
    if(slot.role==='throneHall')return drawThroneHall(s,slot);
    if(slot.role==='commonHall')return drawCommonHall(s,slot);
    if(!onDuty())return 0;
    const list=roomStaff(slot.role,slot.size);if(!list.length)return 0;
    const spots=window.ConquerCutawayFurniture?.standSpots?.(s,slot,list.length)||[];
    const items=list.map(([role,tool],i)=>{
      const p=spots[i]?{x:spots[i].x,y:spots[i].y}:cutawayRoomPoint(slot,(i-(list.length-1)/2)*.45,.1);
      return{p,role,tool,id:s.id+'-staff-'+slot.index+'-'+i,depth:viewDepthPoint(p)};
    }).sort((a,b)=>a.depth-b.depth);
    for(const it of items)drawAt(it.p,slot.z,it.id,it.role,it.tool);
    return items.length;
  }
  window.ConquerStaffPeople=Object.freeze({ROOM_STAFF,KIND,DAY_START,DAY_END,THRONE_COURT,SEAT_FWD,SEAT_Z,BENCH_SEATS,TABLE_END,onDuty,roomStaff,throneCourt,lordGesture,commonHallScene,dot,drawAt,drawRoom,drawThroneHall,drawCommonHall});
})();
