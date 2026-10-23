/** Autonomous multi-commodity market skeleton. No player-facing micro-management. */
export const COMMODITIES = Object.freeze({
  leatherGoods:{group:'L3',basePrice:12,inputs:['wood'],tradeWeight:1},
  metalGoods:{group:'L3',basePrice:18,inputs:['metal'],tradeWeight:1},
  pottery:{group:'L3',basePrice:8,inputs:[],tradeWeight:1},
  textiles:{group:'L3',basePrice:11,inputs:[],tradeWeight:1},
  jewelry:{group:'L3',basePrice:45,inputs:['metal'],tradeWeight:0.5},
});
export const WORKSHOP_OUTPUT = Object.freeze({
  leatherworker:'leatherGoods',blacksmith:'metalGoods',potter:'pottery',
  weaver:'textiles',tailor:'textiles',carpenter:'metalGoods',goldsmith:'jewelry'
});
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function priceFromMarket({basePrice,previousPrice=basePrice,demand=0,supply=0,importCost=0,elasticity=0.3}){
  const imbalance=(Math.max(0,demand)-Math.max(0,supply))/Math.max(1,demand,supply);
  const target=basePrice*(1+clamp(imbalance,-1,1)*elasticity)+Math.max(0,importCost);
  return Math.round(Math.max(basePrice*0.25,previousPrice*0.7+target*0.3)*100)/100;
}
export function aggregateGoods(stock={},catalog=COMMODITIES){
  return Object.entries(catalog).reduce((acc,[id,item])=>{
    if(item.group!=='L3')return acc;
    const quantity=Math.max(0,stock[id]??0);
    acc.quantity+=quantity;
    acc.referenceValue+=quantity*item.basePrice;
    return acc;
  },{quantity:0,referenceValue:0});
}
/** Stable staggering: one commodity per settlement per simulation tick.
 * Each commodity is repriced at most once per simulation week. */
export function createMarketState(settlementId,prices={}){
  return {settlementId,prices:{...prices},lastUpdatedWeek:{},cursor:0,weeklyObservations:{}};
}
/** Record a completed week's observations. They are never applied to prices
 * in the same week: week N prices use observations from week N-1. */
export function recordMarketWeek(state,{week,demand={},supply={},importCost={}}){
  const weeklyObservations={...state.weeklyObservations,[week]:{demand:{...demand},supply:{...supply},importCost:{...importCost}}};
  for(const key of Object.keys(weeklyObservations))if(Number(key)<week-3)delete weeklyObservations[key];
  return {...state,weeklyObservations};
}
export function stepMarket(state,{week,catalog=COMMODITIES}){
  const ids=Object.keys(catalog);
  if(!ids.length)return state;
  const cursor=state.cursor%ids.length,id=ids[cursor],item=catalog[id];
  const prices={...state.prices},lastUpdatedWeek={...state.lastUpdatedWeek};
  const observation=state.weeklyObservations?.[week-1];
  if(observation && lastUpdatedWeek[id]!==week){
    prices[id]=priceFromMarket({basePrice:item.basePrice,previousPrice:prices[id]??item.basePrice,demand:observation.demand[id]??0,supply:observation.supply[id]??0,importCost:observation.importCost[id]??0});
    lastUpdatedWeek[id]=week;
  }
  return {...state,prices,lastUpdatedWeek,cursor:(cursor+1)%ids.length};
}
/** Caller distributes settlement calls over the week, and must schedule
 * enough ticks to cover every commodity at least once per week. */
export function territoryAffinity({localInput=0,importAvailability=0,localDemand=0}={}){
  return clamp(0.55*localInput+0.2*importAvailability+0.25*localDemand,0,1);
}
