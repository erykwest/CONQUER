/**
 * /circle — deterministic distribution of the existing ConquerSiege stock.
 * Does NOT create a second inventory: the aggregated siege.stock is authoritative.
 * Depot-level inventories are derived on demand, deepest compatible rooms first.
 * Consumption automatically empties the shallowest rooms first because each
 * reallocation starts with the (now smaller) authoritative stock.
 */
export const CIRCLE_STORE_GROUP = Object.freeze({
  food:'food',wood:'materials',stone:'materials',metal:'materials',
  equipment:'equipment',horses:'horses',gold:'gold'
});
export const CIRCLE_ROOM_GROUP = Object.freeze({
  granary:'food',storage:'materials',armory:'equipment',
  stables:'horses',treasury:'gold'
});
export const CIRCLE_STORE_KEYS = Object.freeze(Object.keys(CIRCLE_STORE_GROUP));
const safe=(n)=>Number.isFinite(Number(n))?Math.max(0,Number(n)):0;
const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
const sum=o=>Object.values(o).reduce((acc,n)=>acc+safe(n),0);
const validId=s=>typeof s==='string'&&s.length>0;
export function distributeCircleStores(stock={},depots=[],unavailableIds=[]) {
  if(!Array.isArray(depots))throw new TypeError('Circle depots must be an array');
  const unavailable=new Set(unavailableIds||[]),remaining={};
  for(const resource of CIRCLE_STORE_KEYS)remaining[resource]=safe(stock[resource]);
  const records=depots.map(d=>{
    if(!validId(d.id)||!own(CIRCLE_ROOM_GROUP,d.kind)||!Number.isFinite(d.capacity)||d.capacity<0)
      throw new TypeError('Invalid castle depot');
    return {...d,inventory:{},captured:unavailable.has(d.id)};
  });
  records.sort((a,b)=>(safe(b.depth)-safe(a.depth))||a.id.localeCompare(b.id));
  for(const depot of records) {
    if(depot.captured)continue;
    let capacity=depot.capacity;
    for(const resource of CIRCLE_STORE_KEYS){
      if(CIRCLE_STORE_GROUP[resource]!==CIRCLE_ROOM_GROUP[depot.kind])continue;
      const used=Math.min(capacity,remaining[resource]);
      if(used>0){depot.inventory[resource]=used;capacity-=used;remaining[resource]-=used}
    }
  }
  return{depots:records,unassigned:remaining,
    totals:Object.fromEntries(CIRCLE_STORE_KEYS.map(k=>[
      k,records.reduce((n,d)=>n+(d.inventory[k]||0),0)
    ]))};
}
/**
 * Capture exactly the room stocks physically located in the captured sector.
 * Never modifies the caller's stock or depots. Unknown sector attribution stays
 * unassigned (conservative: no invented loot). Repeated capture cannot loot twice.
 */
export function captureCircleStores({sectorId,stock={},depots=[],capturedRoomIds=[]}) {
  if(!validId(sectorId))throw new TypeError('Unknown captured sector');
  const captured=new Set(capturedRoomIds);
  const distribution=distributeCircleStores(stock,depots,[...captured]);
  const lost=Object.fromEntries(CIRCLE_STORE_KEYS.map(k=>[k,0]));
  const rooms=[];
  for(const depot of distribution.depots){
    if(depot.sectorId!==sectorId||depot.captured)continue;
    captured.add(depot.id);rooms.push(depot.id);
    for(const [resource,quantity] of Object.entries(depot.inventory))
      lost[resource]+=quantity;
  }
  const nextStock={...stock};
  for(const resource of CIRCLE_STORE_KEYS)
    nextStock[resource]=Math.max(0,safe(stock[resource])-lost[resource]);
  return{stock:nextStock,lost,rooms,
    capturedRoomIds:[...captured].sort(),unassigned:distribution.unassigned};
}
/** Confirmation requires continuous uncontested ground occupation in game days. */
export function advanceCircleOccupation(holds={},compartments=[],day=0,thresholdDays=.5) {
  if(!Number.isFinite(day)||!Number.isFinite(thresholdDays)||thresholdDays<=0)
    throw new TypeError('Invalid game time');
  const next={},confirmed=[];
  for(const sector of compartments) {
    if(!validId(sector.id)||sector.captured||sector.state!=='invaded'||
       !(sector.control?.groundEnemies>0)||sector.control?.groundDefenders>0||
       sector.control?.wallDefenders>0)continue;
    const since=Number.isFinite(holds[sector.id])&&holds[sector.id]<=day
      ?holds[sector.id]:day;
    if(day-since+1e-9>=thresholdDays)confirmed.push(sector.id);
    else next[sector.id]=since;
  }
  return{holds:next,confirmed};
}
/**
 * Reclaim only after continuous uncontested defenders' presence.
 * Captured goods are NEVER restored by reclaiming a depot.
 */
export function advanceCircleRecapture(holds={},compartments=[],day=0,thresholdDays=.5) {
  if(!Number.isFinite(day)||!Number.isFinite(thresholdDays)||thresholdDays<=0)
    throw new TypeError('Invalid game time');
  const next={},reclaimed=[];
  for(const sector of compartments){
    if(!validId(sector.id)||!sector.captured)continue;
    const occupancy=sector.control||{};
    if(!(occupancy.groundDefenders>0)||occupancy.groundEnemies>0||
       occupancy.wallEnemies>0||occupancy.climbingEnemies>0)continue;
    const since=Number.isFinite(holds[sector.id])&&holds[sector.id]<=day
      ?holds[sector.id]:day;
    if(day-since+1e-9>=thresholdDays)reclaimed.push(sector.id);
    else next[sector.id]=since;
  }
  return{holds:next,reclaimed};
}
