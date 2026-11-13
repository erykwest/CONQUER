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
  const KIND={treasurer:'merchant',councillor:'elite',surgeon:'merchant',priest:'artisan',bailiff:'elite',exactor:'artisan'};
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
    withProjectionGroundZ(g+floorZ,()=>{
      const d=dot(id,role,p);
      if(W&&tool)W.drawWorkerUnmasked(d,tool,t,facing);else drawVillagerFigureUnmasked(d);
    });
  }
  // Castle rooms in cutaway (called by drawCutawayOccupants for each room slot).
  function drawRoom(s,slot){
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
  window.ConquerStaffPeople=Object.freeze({ROOM_STAFF,KIND,DAY_START,DAY_END,onDuty,roomStaff,dot,drawAt,drawRoom});
})();
