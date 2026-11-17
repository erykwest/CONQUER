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
  // Castle rooms in cutaway (called by drawCutawayOccupants for each room slot).
  function drawRoom(s,slot){
    if(slot.role==='throneHall')return drawThroneHall(s,slot);
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
  window.ConquerStaffPeople=Object.freeze({ROOM_STAFF,KIND,DAY_START,DAY_END,THRONE_COURT,SEAT_FWD,SEAT_Z,onDuty,roomStaff,throneCourt,lordGesture,dot,drawAt,drawRoom,drawThroneHall});
})();
