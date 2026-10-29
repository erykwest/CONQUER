'use strict';
// CONQUER Commerce: autonomous L3 street workshops producing "Beni L3" priced
// weekly with a one-week lag, L3 services, L4 productive-site capital and L4+
// intercity traveler manifests. Workshop rules come from ConquerUrbanEconomy,
// goods and prices from ConquerMarketEconomy. Sales move real household coins.
(() => {
  const Urban=window.ConquerUrbanEconomy,Market=window.ConquerMarketEconomy;
  // One workshop catalog: the autonomous urban trades and their L3 goods.
  const WORKSHOP_KINDS=Object.freeze(Object.fromEntries(Object.entries(Urban.WORKSHOP_TYPES).map(([type,spec])=>
    [type,Object.freeze({label:spec.label,demand:spec.demand,outputs:[Market.WORKSHOP_OUTPUT[type]],channel:'local'})])));
  // Earlier #55 blueprint trades map onto the urban catalog.
  const LEGACY_KINDS=Object.freeze({tanner:'leatherworker',smith:'blacksmith',jeweler:'goldsmith',herbalist:'potter'});
  // Weekly L3 goods wanted per resident, by class (before tradeWeight).
  const L3_GOODS_NEED=Object.freeze({L1:0,L2:.04,L3:.08,L4:.2});
  const SHOP_OUTPUT_PER_DAY=1;
  const SERVICE_KINDS=Object.freeze({
    tavern:Object.freeze({operatorTier:3,kind:'lodging',income:'not-simulated'}),
    church:Object.freeze({operatorTier:3,kind:'worship',income:'not-simulated'})
  });
  const PRIMARY_KINDS=Object.freeze(['field','loggingCamp','quarry','mine','vineyard']);
  // A physical gold CHEST travels with the convoy, not as a market commodity.
  // Coins occupy negligible trading-bed capacity, but remain real money.
  // One shipment = one type of merchandise; coins are the only permitted
  // companion. The current 100-point weight table is a balancing proposal.
  const WAGON_CAPACITY=100, WAGON_DAY_COST=0.2;
  const VEHICLES=Object.freeze({
    cart:Object.freeze({capacity:40,goldPerDay:.10,horses:1,passengers:0,use:'local-small-cargo'}),
    wagon:Object.freeze({capacity:100,goldPerDay:.20,horses:2,passengers:0,use:'freight'}),
    coach:Object.freeze({capacity:0,goldPerDay:.30,horses:2,passengers:2,use:'noble-passengers'})
  });
  const CARGO_WEIGHTS=Object.freeze({
    food:2,wood:5,stone:10,clay:10,metal:8,equipment:3,luxury:1
  });
  const roundGold=n=>Math.round((n+Number.EPSILON)*1000)/1000;
  const validCoins=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&
    n<=1e9&&Math.abs(n-roundGold(n))<1e-8;
  function caravanQuote(cargo=[],coinGold=0,{legacyMixed=false,vehicle='wagon'}={}){
    if(!VEHICLES[vehicle]||vehicle==='coach'||
      !Array.isArray(cargo)||(!legacyMixed&&cargo.length>1)||
      !validCoins(coinGold)||cargo.some(line=>
        !line||!Object.prototype.hasOwnProperty.call(CARGO_WEIGHTS,line.good)||
        !window.ConquerEconomy?.GOODS?.includes(line.good)||
        !Number.isFinite(line.qty)||line.qty<=0))return null;
    const points=cargo.reduce((n,line)=>n+line.qty*CARGO_WEIGHTS[line.good],0);
    if(!Number.isFinite(points)||points>1e9)return null;
    // A coin-funded buying expedition brings an EMPTY wagon for purchases.
    // Coin weight is intentionally independent from the cart's 100-point bed.
    const cap=VEHICLES[vehicle].capacity;
    const wagons=points>0?Math.ceil(points/cap):coinGold>0?1:0;
    return{mode:vehicle,capacity:cap,loadPoints:Math.round(points*1000)/1000,
      wagons,freePoints:Math.round((wagons*cap-points)*1000)/1000,
      goldPerDay:roundGold(wagons*VEHICLES[vehicle].goldPerDay)};
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
      version:4,shops:{},services:{},journeys:{}
    });
    // Add fields to older economic saves, without rewriting legacy inventory.
    if(!c.shops||typeof c.shops!=='object')c.shops={};
    for(const shop of Object.values(c.shops)){
      if(LEGACY_KINDS[shop.kind])shop.kind=LEGACY_KINDS[shop.kind];
      if(shop.status==='blueprint')shop.status='active';
      shop.state??='closed';shop.revenue=finite(shop.revenue);shop.produced=finite(shop.produced);
    }
    if(!c.goods||typeof c.goods!=='object')c.goods={};
    for(const id of Object.keys(Market.COMMODITIES))c.goods[id]=Math.max(0,finite(c.goods[id]));
    if(!c.market||typeof c.market!=='object')
      c.market=Market.createMarketState(localId()||'local',
        Object.fromEntries(Object.entries(Market.COMMODITIES).map(([id,item])=>[id,item.basePrice])));
    if(!c.week||typeof c.week!=='object')c.week={index:null,supply:{},demand:{},sold:{}};
    if(!c.services||typeof c.services!=='object')c.services={};
    if(!c.journeys||typeof c.journeys!=='object')c.journeys={};
    // Migration must be visible even to callers that read state() without
    // invoking sync(). Old manifests did not have a money payload.
    for(const j of Object.values(c.journeys)){
      if(!j.chest){
        // V2 saves held real L4 coins as 'purse.reservedGold'. Preserve the
        // ledger hold in place and rename exactly once, without refund/mint.
        j.chest=j.purse?{gold:j.purse.gold||0,reservedGold:j.purse.reservedGold||0}:
          {gold:0,reservedGold:0};
      }
      delete j.purse;
      if(!j.transport)j.transport=caravanQuote(j.cargo||[],j.chest.gold,{legacyMixed:true});
    }
    c.version=4;
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
  function openShop(c,id,kind,source,day){
    c.shops[id]={houseId:id,kind,ownerTier:3,channel:'local',status:'active',source,
      artisanId:id+':m:0',state:'closed',createdDay:Math.floor(finite(day)),revenue:0,produced:0};
  }
  // Explicit registration (tests, future UI); the simulation spawns autonomously.
  function registerShop(houseId,kind){
    const c=sync(),id=String(houseId);
    if(!c||!validId(id)||!l3House(id)||!WORKSHOP_KINDS[kind])return false;
    if(Object.values(c.services).some(s=>s.operatorHouseId===id))return false;
    openShop(c,id,kind,'registered',State.clock?.day);
    State.dirty=true;return true;
  }
  // Deterministic per seed, house and day: reloading never reshuffles trades.
  function seededRandom(key){
    let h=2166136261;
    for(const ch of String(State.seed)+'|'+key){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)>>>0}
    return(h%100000)/100000;
  }
  function residents(){return window.ConquerEconomy?.population?.()||{L1:0,L2:0,L3:0,L4:0}}
  function sectorDemand(pop){
    const total=Math.max(1,pop.L1+pop.L2+pop.L3+pop.L4),urban=(pop.L2+pop.L3+pop.L4)/total;
    return{clothing:urban,household:urban,tools:Math.min(1,(pop.L1+pop.L2)/total+.2),luxury:pop.L4/total};
  }
  // Input availability per trade from real castle + market stocks (0..1).
  function tradeResources(){
    const e=window.ConquerEconomy?.state?.();
    const stock=g=>finite(e?.castle?.[g])+(e?.lots?.[g]||[]).reduce((n,l)=>n+finite(l.qty),0);
    const level=g=>Math.min(1,stock(g)/40);
    return{blacksmith:level('metal'),goldsmith:level('metal'),carpenter:level('wood'),
      leatherworker:level('wood'),potter:level('clay')||.5,weaver:.5,tailor:.5};
  }
  // Each completed L3 house without a shop or service gets an autonomous
  // workshop on a workday: one per house, trade drawn with soft weights.
  function spawnWorkshops(c,day){
    const busy=new Set([...Object.keys(c.shops),...Object.values(c.services).map(s=>s.operatorHouseId).filter(Boolean)]);
    const houses=(State.structures||[]).filter(h=>h.type==='house'&&l3House(h.id)&&!busy.has(String(h.id)))
      .sort((a,b)=>String(a.id).localeCompare(String(b.id)));
    if(!houses.length)return 0;
    const pop=residents(),welfare=finite(window.ConquerEconomy?.state?.()?.welfare)/100;
    const existing=Object.values(c.shops).map(s=>({houseId:s.houseId,artisanId:s.artisanId,type:s.kind}));
    let opened=0;
    for(const h of houses){
      const proposal=Urban.proposeWorkshops({
        houses:[{id:String(h.id),level:3}],artisans:[{id:String(h.id)+':m:0',tier:3}],existing,
        demand:sectorDemand(pop),resources:tradeResources(),prosperity:welfare,
        random:()=>seededRandom(h.id+'|'+Math.floor(day)),day:Math.floor(day)})[0];
      if(!proposal)continue;
      openShop(c,String(h.id),proposal.type,'autonomous',day);
      existing.push({houseId:proposal.houseId,artisanId:proposal.artisanId,type:proposal.type});
      opened++;
    }
    if(opened)State.dirty=true;
    return opened;
  }
  // Saturday: households buy L3 goods with their own coins, richest first;
  // artisans (wallet L3) receive the takings. No coin is created.
  function sellGoods(c,e){
    const pop=residents(),prices=c.market.prices,sold={},demand={};
    for(const [id,item] of Object.entries(Market.COMMODITIES)){
      demand[id]=0;sold[id]=0;
      for(const group of ['L4','L3','L2','L1']){
        const want=pop[group]*L3_GOODS_NEED[group]*item.tradeWeight;
        demand[id]+=want;
        const price=Math.max(.01,finite(prices[id]||item.basePrice));
        const qty=Math.min(want,c.goods[id],Math.max(0,finite(e.wallet[group]))/price);
        if(!(qty>1e-6))continue;
        const paid=roundGold(qty*price);
        e.wallet[group]=roundGold(Math.max(0,finite(e.wallet[group])-paid));
        e.wallet.L3=roundGold(finite(e.wallet.L3)+paid);
        c.goods[id]=roundGold(c.goods[id]-qty);sold[id]+=qty;
        const makers=Object.values(c.shops).filter(s=>Market.WORKSHOP_OUTPUT[s.kind]===id);
        for(const s of makers)s.revenue=roundGold(s.revenue+paid/makers.length);
      }
      demand[id]=roundGold(demand[id]);sold[id]=roundGold(sold[id]);
    }
    return{demand,sold};
  }
  // Daily step from ConquerEconomy.tick: open/close shops, produce on
  // workdays, reprice one commodity per day, close the week on Saturday.
  function daily(day){
    const c=sync(),e=window.ConquerEconomy?.state?.();
    if(!c||!e||!State.village?.founded)return;
    const dow=((Math.floor(day)%7)+7)%7,week=Math.floor(day/7);
    if(c.week.index!==week)c.week={index:week,supply:{},demand:{},sold:{}};
    const alarm=(window.ConquerCombat?.alarmMode?.()||'off')!=='off';
    if(dow<5&&!alarm)spawnWorkshops(c,day);
    const demand=sectorDemand(residents());
    for(const shop of Object.values(c.shops)){
      const good=Market.WORKSHOP_OUTPUT[shop.kind],kind=WORKSHOP_KINDS[shop.kind];
      if(!good||!kind)continue;
      const working=dow<5&&!alarm;
      // Sunday rest: shops stay shut; Saturday they sell at the market.
      Object.assign(shop,Urban.updateWorkshop(shop,{hour:dow===6?0:12,demand:demand[kind.demand]??.5,
        visitors:dow===5?1:0,artisanAvailable:!alarm}));
      if(!working)continue;
      c.goods[good]=roundGold(c.goods[good]+SHOP_OUTPUT_PER_DAY);
      c.week.supply[good]=roundGold(finite(c.week.supply[good])+SHOP_OUTPUT_PER_DAY);
      shop.produced=roundGold(shop.produced+SHOP_OUTPUT_PER_DAY);
    }
    // Week N prices only see week N-1: one commodity per day, at most once a week.
    c.market=Market.stepMarket(c.market,{week});
    if(dow===5){
      const result=sellGoods(c,e);
      c.week.demand=result.demand;c.week.sold=result.sold;
      c.market=Market.recordMarketWeek(c.market,{week,demand:result.demand,supply:c.week.supply});
    }
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
    cargo=[],coinGold=0,vehicle='wagon',mercenaryCount=0}={}){
    const c=sync(),local=localId();
    if(!c||!local||!validId(id)||c.journeys[id]||
      !validId(originId)||!validId(destinationId)||originId===destinationId||
      !['resident','external'].includes(source))return false;
    const quote=caravanQuote(cargo,coinGold,{vehicle});
    if(!Number.isSafeInteger(mercenaryCount)||mercenaryCount<0||mercenaryCount>40)return false;
    if(!quote)return false;
    if(source==='resident'&&
      (originId!==local||!l4House(houseId)))return false;
    if(source==='external'&&
      (destinationId!==local||houseId!==null))return false;
    const manifest=cargo.map(line=>({good:line.good,qty:line.qty}));
    c.journeys[id]={id,originId,destinationId,source,
      sourceHouseId:source==='resident'?String(houseId):null,
      tier:4,role:'L4+',cargo:manifest,
      chest:{gold:roundGold(coinGold),reservedGold:0},
      escort:{type:'mercenary',count:mercenaryCount,armor:'leather',
        heraldry:'neutral-brown',employer:'merchant',wageMultiplier:2},
      transport:quote,status:'planned',lodgingId:null};
    State.dirty=true;return true;
  }
  // Funds are held in the L4+ chest only on an explicit local funding step;
  // merely planning a journey must not clone a wallet balance into cargo.
  // External travelers have NO access to the local L4 wallet.
  function reserveJourneyCoins(journeyId){
    const c=sync(),j=c?.journeys[journeyId],e=window.ConquerEconomy?.state?.();
    if(!e||!j||j.status!=='planned'||j.source!=='resident'||
      j.originId!==localId()||!j.chest||
      j.chest.reservedGold>0||j.chest.gold<=0)return false;
    const due=j.chest.gold,balance=Number(e.wallet?.L4);
    if(!Number.isFinite(balance)||balance<due)return false;
    // This is an internal wallet-to-cargo hold, not a trade or expense.
    e.wallet.L4=roundGold(balance-due);
    j.chest.reservedGold=due;
    State.dirty=true;return true;
  }
  // Before departure, cancellation is a true reversal of a local cash hold.
  // No new currency is issued, and a second cancellation cannot refund twice.
  function cancelPlannedJourney(journeyId){
    const c=sync(),j=c?.journeys[journeyId];
    if(!j||j.status!=='planned')return false;
    if(j.source==='resident'&&j.chest?.reservedGold>0){
      const e=window.ConquerEconomy.state();
      e.wallet.L4=roundGold(Number(e.wallet.L4||0)+j.chest.reservedGold);
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
      l3Goods:roundGold(Market.aggregateGoods(c.goods).quantity),
      l3GoodsValue:roundGold(Market.aggregateGoods(c.goods).referenceValue),
      l3Revenue:roundGold(Object.values(c.shops).reduce((n,s)=>n+finite(s.revenue),0)),
      l3Services:Object.keys(c.services).length,
      l3OperatedServices:Object.values(c.services).filter(s=>s.operatorHouseId).length,
      l4PrimarySites:primaryPortfolio().filter(s=>s.ownerTier===4).length,
      l4PlusPlanned:journeys.filter(j=>j.status==='planned').length,
      l4PlusPresent:journeys.filter(j=>j.status==='arrived'||j.status==='lodged').length,
      l4PlusDeclaredGold:roundGold(journeys.reduce((n,j)=>n+(j.chest?.gold||0),0)),
      l4PlusHeldGold:roundGold(journeys.reduce((n,j)=>n+(j.chest?.reservedGold||0),0)),
      l4PlusWagons:journeys.reduce((n,j)=>n+(j.transport?.wagons||0),0),
      innBeds:lodging.reduce((n,s)=>n+s.guestCapacity,0),
      innOccupied:journeys.filter(j=>j.status==='lodged').length
    };
  }
  window.ConquerCommerce=Object.freeze({
    WORKSHOP_KINDS,WORKSHOP_STATES:Urban.WORKSHOP_STATES,LEGACY_KINDS,L3_GOODS_NEED,SERVICE_KINDS,PRIMARY_KINDS,daily,
    WAGON_CAPACITY,WAGON_DAY_COST,VEHICLES,CARGO_WEIGHTS,caravanQuote,
    state,sync,registerShop,assignService,configureInnCapacity,occupancy,worksiteForHouse,
    planJourney,reserveJourneyCoins,cancelPlannedJourney,
    confirmArrival,checkIn,depart,primaryPortfolio,snapshot
  });
})();
