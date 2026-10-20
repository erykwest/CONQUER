'use strict';
// CONQUER Commerce skeleton V1: L3 direct local workshops/services,
// L4 productive-site capital and L4+ intercity traveler manifests.
// NO autonomous trade, cargo movement, private minting or new resource production.
(() => {
  const WORKSHOP_KINDS=Object.freeze({
    weaver:Object.freeze({inputs:['wool'],outputs:['textiles'],channel:'local'}),
    tanner:Object.freeze({inputs:['hides'],outputs:['leather'],channel:'local'}),
    smith:Object.freeze({inputs:['metal','wood'],outputs:['tools','weapons','armor'],channel:'local'}),
    herbalist:Object.freeze({inputs:['herbs'],outputs:['medicine'],channel:'local'}),
    jeweler:Object.freeze({inputs:['precious-metal'],outputs:['jewelry'],channel:'local'})
  });
  const SERVICE_KINDS=Object.freeze({
    tavern:Object.freeze({operatorTier:3,kind:'lodging',income:'not-simulated'}),
    church:Object.freeze({operatorTier:3,kind:'worship',income:'not-simulated'})
  });
  const PRIMARY_KINDS=Object.freeze(['field','loggingCamp','quarry','mine','vineyard']);
  // The gold purse is PHYSICAL, but is not a saleable market commodity.
  // It travels separately from goods and has negligible wagon occupancy.
  // One shipment = one type of merchandise; coins are the only permitted
  // companion. The current 100-point weight table is a balancing proposal.
  const WAGON_CAPACITY=100, WAGON_DAY_COST=0.2;
  const CARGO_WEIGHTS=Object.freeze({
    food:2,wood:5,stone:10,metal:8,equipment:3,luxury:1
  });
  const roundGold=n=>Math.round((n+Number.EPSILON)*1000)/1000;
  const validCoins=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&
    n<=1e9&&Math.abs(n-roundGold(n))<1e-8;
  function caravanQuote(cargo=[],coinGold=0,{legacyMixed=false}={}){
    if(!Array.isArray(cargo)||(!legacyMixed&&cargo.length>1)||
      !validCoins(coinGold)||cargo.some(line=>
        !line||!Object.prototype.hasOwnProperty.call(CARGO_WEIGHTS,line.good)||
        !window.ConquerEconomy?.GOODS?.includes(line.good)||
        !Number.isFinite(line.qty)||line.qty<=0))return null;
    const points=cargo.reduce((n,line)=>n+line.qty*CARGO_WEIGHTS[line.good],0);
    if(!Number.isFinite(points)||points>1e9)return null;
    // A coin-funded buying expedition brings an EMPTY wagon for purchases.
    // Coin weight is intentionally independent from the cart's 100-point bed.
    const wagons=points>0?Math.ceil(points/WAGON_CAPACITY):coinGold>0?1:0;
    return{mode:'wagon',capacity:WAGON_CAPACITY,loadPoints:Math.round(points*1000)/1000,
      wagons,freePoints:Math.round((wagons*WAGON_CAPACITY-points)*1000)/1000,
      goldPerDay:roundGold(wagons*WAGON_DAY_COST)};
  }
  const validId=id=>typeof id==='string'&&id.length>0&&id.length<=128;
  const finite=n=>Number.isFinite(+n)?+n:0;
  const completed=s=>!!s&&!s.destroyed&&!s.abandoned&&
    !(typeof underConstruction==='function'&&underConstruction(s));
  const localId=()=>State.village?.founded?String(State.village.wellId||''):'';
  const structure=id=>(State.structures||[]).find(s=>String(s.id)===String(id));
  const l3House=id=>{
    const h=structure(id);
    return h?.type==='house'&&completed(h)&&
      (typeof houseLevel==='function'?houseLevel(h):Number(h.houseLevel||1))===3?h:null;
  };
  const l4House=id=>{
    const h=structure(id);
    return h?.type==='house'&&completed(h)&&
      (typeof houseLevel==='function'?houseLevel(h):Number(h.houseLevel||1))===4?h:null;
  };
  function state(){
    const econ=window.ConquerEconomy?.state?.();
    if(!econ)return null;
    const c=econ.commerce||(econ.commerce={
      version:2,shops:{},services:{},journeys:{}
    });
    // Add fields to older economic saves, without rewriting legacy inventory.
    if(!c.shops||typeof c.shops!=='object')c.shops={};
    if(!c.services||typeof c.services!=='object')c.services={};
    if(!c.journeys||typeof c.journeys!=='object')c.journeys={};
    // Migration must be visible even to callers that read state() without
    // invoking sync(). Old manifests did not have a money payload.
    for(const j of Object.values(c.journeys)){
      if(!j.purse)j.purse={gold:0,reservedGold:0};
      if(!j.transport)j.transport=caravanQuote(j.cargo||[],j.purse.gold,{legacyMixed:true});
    }
    c.version=2;
    return c;
  }
  function sync(){
    const c=state();
    if(!c)return null;
    for(const [id,shop] of Object.entries(c.shops)){
      if(!l3House(id)||!WORKSHOP_KINDS[shop.kind])delete c.shops[id];
    }
    for(const [id,entry] of Object.entries(c.services)){
      const s=structure(id);
      if(!s||!completed(s)||!SERVICE_KINDS[s.type]){
        delete c.services[id];continue;
      }
      entry.type=s.type;
      if(entry.operatorHouseId&&!l3House(entry.operatorHouseId))
        entry.operatorHouseId=null;
      entry.guestCapacity=s.type==='tavern'?
        Math.max(0,Math.floor(finite(entry.guestCapacity))):0;
    }
    for(const s of State.structures||[]){
      if(!completed(s)||!SERVICE_KINDS[s.type])continue;
      if(!c.services[s.id])c.services[s.id]={
        structureId:String(s.id),type:s.type,operatorHouseId:null,
        guestCapacity:s.type==='tavern'?
          Math.max(0,Math.floor(finite(s.guestCapacity))):0
      };
    }
    for(const j of Object.values(c.journeys)){
      if(j.lodgingId&&!c.services[j.lodgingId]){
        j.lodgingId=null;
        if(j.status==='lodged')j.status='arrived';
      }
    }
    return c;
  }
  // Blueprint only: never consumes raw materials or credits finished stock.
  function registerShop(houseId,kind){
    const c=sync(),id=String(houseId);
    if(!c||!validId(id)||!l3House(id)||!WORKSHOP_KINDS[kind])return false;
    if(Object.values(c.services).some(s=>s.operatorHouseId===id))return false;
    c.shops[id]={houseId:id,kind,ownerTier:3,channel:'local',status:'blueprint'};
    State.dirty=true;return true;
  }
  function assignService(structureId,houseId){
    const c=sync(),s=structure(structureId),id=String(houseId);
    if(!c||!s||!completed(s)||!SERVICE_KINDS[s.type]||
      !l3House(id)||c.shops[id]||
      Object.values(c.services).some(v=>v.structureId!==String(s.id)&&v.operatorHouseId===id))
      return false;
    c.services[s.id].operatorHouseId=id;
    State.dirty=true;return true;
  }
  function configureInnCapacity(structureId,beds){
    const c=sync(),s=structure(structureId);
    if(!c||s?.type!=='tavern'||!completed(s)||!Number.isSafeInteger(beds)||
      beds<0||beds>200)return false;
    const occupied=Object.values(c.journeys).filter(j=>j.lodgingId===String(s.id)&&j.status==='lodged').length;
    if(beds<occupied)return false;
    c.services[s.id].guestCapacity=beds;
    State.dirty=true;return true;
  }
  function occupancy(innId){
    const c=sync(),s=structure(innId);
    if(!c||s?.type!=='tavern'||!completed(s))return null;
    const beds=c.services[s.id]?.guestCapacity||0;
    const occupied=Object.values(c.journeys).filter(j=>j.lodgingId===String(s.id)&&j.status==='lodged').length;
    return{beds,occupied,available:Math.max(0,beds-occupied)};
  }
  // Journeys are manifests waiting for future route/caravan code. Neither
  // cash nor goods are moved by planning an entry in this registry.
  function planJourney({id,originId,destinationId,source='external',houseId=null,
    cargo=[],coinGold=0}={}){
    const c=sync(),local=localId();
    if(!c||!local||!validId(id)||c.journeys[id]||
      !validId(originId)||!validId(destinationId)||originId===destinationId||
      !['resident','external'].includes(source))return false;
    const quote=caravanQuote(cargo,coinGold);
    if(!quote)return false;
    if(source==='resident'&&
      (originId!==local||!l4House(houseId)))return false;
    if(source==='external'&&
      (destinationId!==local||houseId!==null))return false;
    const manifest=cargo.map(line=>({good:line.good,qty:line.qty}));
    c.journeys[id]={id,originId,destinationId,source,
      sourceHouseId:source==='resident'?String(houseId):null,
      tier:4,role:'L4+',cargo:manifest,
      purse:{gold:roundGold(coinGold),reservedGold:0},
      transport:quote,status:'planned',lodgingId:null};
    State.dirty=true;return true;
  }
  // Funds are held in the L4+ purse only on an explicit local funding step;
  // merely planning a journey must not clone a wallet balance into cargo.
  // External travelers have NO access to the local L4 wallet.
  function reserveJourneyCoins(journeyId){
    const c=sync(),j=c?.journeys[journeyId],e=window.ConquerEconomy?.state?.();
    if(!e||!j||j.status!=='planned'||j.source!=='resident'||
      j.originId!==localId()||!j.purse||
      j.purse.reservedGold>0||j.purse.gold<=0)return false;
    const due=j.purse.gold,balance=Number(e.wallet?.L4);
    if(!Number.isFinite(balance)||balance<due)return false;
    // This is an internal wallet-to-cargo hold, not a trade or expense.
    e.wallet.L4=roundGold(balance-due);
    j.purse.reservedGold=due;
    State.dirty=true;return true;
  }
  // Before departure, cancellation is a true reversal of a local cash hold.
  // No new currency is issued, and a second cancellation cannot refund twice.
  function cancelPlannedJourney(journeyId){
    const c=sync(),j=c?.journeys[journeyId];
    if(!j||j.status!=='planned')return false;
    if(j.source==='resident'&&j.purse?.reservedGold>0){
      const e=window.ConquerEconomy.state();
      e.wallet.L4=roundGold(Number(e.wallet.L4||0)+j.purse.reservedGold);
    }
    delete c.journeys[journeyId];
    State.dirty=true;return true;
  }
  // External transport system must explicitly confirm an inbound arrival.
  // Nothing calls this automatically, so there are no phantom travelers.
  function confirmArrival(journeyId){
    const c=sync(),j=c?.journeys[journeyId];
    if(!j||j.status!=='planned'||j.destinationId!==localId())return false;
    j.status='arrived';State.dirty=true;return true;
  }
  function checkIn(journeyId,innId){
    const c=sync(),j=c?.journeys[journeyId],beds=occupancy(innId);
    if(!j||j.status!=='arrived'||j.destinationId!==localId()||
      !beds||beds.available<1)return false;
    j.status='lodged';j.lodgingId=String(innId);
    State.dirty=true;return true;
  }
  function depart(journeyId){
    const c=sync(),j=c?.journeys[journeyId];
    if(!j||!['arrived','lodged'].includes(j.status))return false;
    j.lodgingId=null;j.status='departed';
    State.dirty=true;return true;
  }
  function worksiteForHouse(houseId){
    const c=state(),id=String(houseId);
    if(!c)return null;
    if(c.shops[id]&&l3House(id))
      return{kind:'shop',structure:structure(id),shop:c.shops[id]};
    const service=Object.values(c.services).find(entry=>entry.operatorHouseId===id);
    const building=service&&structure(service.structureId);
    if(service&&l3House(id)&&completed(building))
      return{kind:'service',structure:building,service};
    return null;
  }
  // Read-only primary ownership view. Existing L4 economic ownership remains
  // in ConquerEconomy.activities; this does not fabricate new private sites.
  function primaryPortfolio(){
    const activities=window.ConquerEconomy?.state?.()?.activities||{};
    return Object.entries(activities).filter(([id,a])=>
      PRIMARY_KINDS.includes(a.type)&&completed(structure(id))).
      map(([id,a])=>({structureId:id,type:a.type,
        owner:a.owner==='lord'?'lord':'L4',ownerTier:a.owner==='lord'?null:4}));
  }
  function snapshot(){
    const c=sync();
    if(!c)return null;
    const journeys=Object.values(c.journeys);
    const lodging=Object.values(c.services).filter(s=>s.type==='tavern');
    return{
      l3Shops:Object.keys(c.shops).length,
      l3Services:Object.keys(c.services).length,
      l3OperatedServices:Object.values(c.services).filter(s=>s.operatorHouseId).length,
      l4PrimarySites:primaryPortfolio().filter(s=>s.ownerTier===4).length,
      l4PlusPlanned:journeys.filter(j=>j.status==='planned').length,
      l4PlusPresent:journeys.filter(j=>j.status==='arrived'||j.status==='lodged').length,
      l4PlusDeclaredGold:roundGold(journeys.reduce((n,j)=>n+(j.purse?.gold||0),0)),
      l4PlusHeldGold:roundGold(journeys.reduce((n,j)=>n+(j.purse?.reservedGold||0),0)),
      l4PlusWagons:journeys.reduce((n,j)=>n+(j.transport?.wagons||0),0),
      innBeds:lodging.reduce((n,s)=>n+s.guestCapacity,0),
      innOccupied:journeys.filter(j=>j.status==='lodged').length
    };
  }
  window.ConquerCommerce=Object.freeze({
    WORKSHOP_KINDS,SERVICE_KINDS,PRIMARY_KINDS,
    WAGON_CAPACITY,WAGON_DAY_COST,CARGO_WEIGHTS,caravanQuote,
    state,sync,registerShop,assignService,configureInnCapacity,occupancy,worksiteForHouse,
    planJourney,reserveJourneyCoins,cancelPlannedJourney,
    confirmArrival,checkIn,depart,primaryPortfolio,snapshot
  });
})();
