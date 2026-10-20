'use strict';
// Convoy contracts V1: no physical movement, automatic trade, or travel days.
// Tribute/gifts have a real lord treasury hold once explicitly prepared.
// Caravans use a single trade good and a chest; noble coaches carry people.
(() => {
  const GOODS=()=>window.ConquerEconomy?.GOODS||[];
  const commerce=()=>window.ConquerCommerce;
  const money=n=>Math.round((n+Number.EPSILON)*1000)/1000;
  const idOk=id=>typeof id==='string'&&id.length>0&&id.length<=128;
  const validGold=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=1e9&&
    Math.abs(n-money(n))<1e-8;
  const goodCargo=cargo=>Array.isArray(cargo)&&cargo.length<=1&&cargo.every(line=>
    line&&GOODS().includes(line.good)&&Number.isFinite(line.qty)&&line.qty>0);
  const localId=()=>State.village?.founded?String(State.village.wellId||''):'';
  const keep=()=>window.ConquerSiege?.mastio?.()||null;
  function state(){
    const c=commerce()?.state?.();
    if(!c)return null;
    if(!c.lordConvoys||typeof c.lordConvoys!=='object')c.lordConvoys={};
    if(!c.nobleJourneys||typeof c.nobleJourneys!=='object')c.nobleJourneys={};
    return c;
  }
  function guardSlots(){
    // Siege capacity is a maximum *barracks capacity*, NOT an actual roster.
    // Reservations cannot become assigned soldiers until troop accounting exists.
    const cap=window.ConquerSiege?.capacity?.()?.soldiers;
    return Math.max(0,Math.floor(Number.isFinite(cap)?cap:0));
  }
  function reservedGuardSlots(excluding=null){
    const c=state();
    return Object.values(c?.lordConvoys||{}).reduce((n,j)=>
      n+(j.id===excluding?0:j.escorts?.requested||0),0);
  }
  function availableGuardSlots(excluding=null){
    return Math.max(0,guardSlots()-reservedGuardSlots(excluding));
  }
  function quoteCargo(cargo=[],coinGold=0,vehicle='wagon'){
    return commerce()?.caravanQuote?.(cargo,coinGold,{vehicle})||null;
  }
  function planLordConvoy({id,kind='gift',destinationId,cargo=[],coinGold=0,
    vehicle='wagon',guards=0}={}){
    const c=state(),castle=keep(),local=localId();
    if(!c||!castle||!local||!idOk(id)||!idOk(destinationId)||
      destinationId===local||c.lordConvoys[id]||c.journeys?.[id]||
      !['gift','tribute'].includes(kind)||!validGold(coinGold)||
      !goodCargo(cargo)||(!cargo.length&&coinGold<=0)||
      !Number.isSafeInteger(guards)||guards<0||guards>availableGuardSlots())return false;
    const transport=quoteCargo(cargo,coinGold,vehicle);
    if(!transport||!transport.wagons)return false;
    c.lordConvoys[id]={
      id,kind,originId:local,destinationId,source:'lord',
      originStructureId:String(castle.id),originRole:'mastio',
      cargo:cargo.map(line=>({good:line.good,qty:line.qty})),
      chest:{gold:money(coinGold),reservedGold:0},
      reservedCargo:[],transport,
      escorts:{kind:'garrison',requested:guards,assigned:0,
        heraldry:'lord',wageModel:'existing-garrison'},status:'draft'
    };
    State.dirty=true;return true;
  }
  function assignLordGuards(convoyId,n){
    const c=state(),j=c?.lordConvoys[convoyId];
    if(!j||j.status!=='draft'||!Number.isSafeInteger(n)||n<0||
      n>availableGuardSlots(j.id))return false;
    j.escorts.requested=n;
    // Deliberately never mark personnel assigned before a real roster exists.
    State.dirty=true;return true;
  }
  function reserveLordConvoy(convoyId){
    const c=state(),j=c?.lordConvoys[convoyId],e=window.ConquerEconomy?.state?.();
    if(!c||!j||!e||j.status!=='draft'||keep()?.id!==j.originStructureId||
      j.escorts.requested>availableGuardSlots(j.id))return false;
    const gold=j.chest.gold,stock=j.cargo[0];
    const availableGold=Number(e.castleGold);
    if(!Number.isFinite(availableGold)||availableGold<gold||
      (stock&&(!Number.isFinite(e.castle?.[stock.good])||
        e.castle[stock.good]+1e-9<stock.qty)))return false;
    // Single atomic reservation from castle-owned stock: no market purchase.
    e.castleGold=money(availableGold-gold);
    if(stock)e.castle[stock.good]=money(Math.max(0,e.castle[stock.good]-stock.qty));
    j.chest.reservedGold=gold;
    j.reservedCargo=stock?[{good:stock.good,qty:stock.qty}]:[];
    j.status='ready'; // no departure: route and troop accounting not implemented.
    window.ConquerEconomy?.syncBuilderResources?.();
    State.dirty=true;return true;
  }
  function cancelLordConvoy(convoyId){
    const c=state(),j=c?.lordConvoys[convoyId];
    if(!j||!['draft','ready'].includes(j.status))return false;
    if(j.status==='ready'){
      const e=window.ConquerEconomy?.state?.();
      if(!e)return false;
      e.castleGold=money(Number(e.castleGold||0)+j.chest.reservedGold);
      for(const line of j.reservedCargo)
        e.castle[line.good]=money(Number(e.castle[line.good]||0)+line.qty);
      window.ConquerEconomy?.syncBuilderResources?.();
    }
    delete c.lordConvoys[convoyId];
    State.dirty=true;return true;
  }
  function planNobleCoach({id,originId,destinationId,houseId=null,
    women=1,men=0}={}){
    const c=state(),local=localId(),home=State.structures?.find(s=>
      String(s.id)===String(houseId)&&s.type==='house');
    if(!c||!local||!idOk(id)||!idOk(originId)||!idOk(destinationId)||
      originId!==local||originId===destinationId||c.nobleJourneys[id]||
      !home||home.destroyed||(typeof underConstruction==='function'&&underConstruction(home))||
      (typeof houseLevel==='function'?houseLevel(home):home.houseLevel)!==4||
      !Number.isSafeInteger(women)||!Number.isSafeInteger(men)||
      women<0||men<0||women+men<1||women+men>commerce()?.VEHICLES?.coach?.passengers)
      return false;
    c.nobleJourneys[id]={
      id,originId,destinationId,houseId:String(houseId),
      vehicle:'coach',passengers:{women,men,total:women+men},
      preferredPassengers:'noblewomen',status:'draft',
      transport:{mode:'coach',vehicles:1,passengerCapacity:2,
        goldPerDay:commerce().VEHICLES.coach.goldPerDay}
    };
    // This is a travel request, not a duplicate simulation of noble occupants.
    State.dirty=true;return true;
  }
  function cancelNobleCoach(id){
    const c=state();
    if(!c?.nobleJourneys[id]||c.nobleJourneys[id].status!=='draft')return false;
    delete c.nobleJourneys[id];State.dirty=true;return true;
  }
  function mercenaryDailyWage(multiplier=2){
    const monthly=Number(window.ConquerEconomy?.state?.()?.wage?.L2);
    return Number.isFinite(monthly)&&monthly>=0?money(monthly/20*multiplier):null;
  }
  function quoteJourneyCost(journeyId,days){
    const j=state()?.journeys?.[journeyId];
    if(!j||!Number.isFinite(days)||days<0||days>36500)return null;
    const n=j.escort?.count||0,perGuard=mercenaryDailyWage(j.escort?.wageMultiplier||2);
    if(perGuard===null)return null;
    const vehiclePerDay=Number(j.transport?.goldPerDay)||0;
    const escortPerDay=money(n*perGuard);
    return{days,wagons:j.transport?.wagons||0,guards:n,
      vehiclePerDay,escortPerDay,
      transport:money(vehiclePerDay*days),escort:money(escortPerDay*days),
      total:money((vehiclePerDay+escortPerDay)*days)};
  }
  function assignMerchantEscorts(journeyId,n){
    const j=state()?.journeys?.[journeyId];
    if(!j||j.status!=='planned'||!Number.isSafeInteger(n)||n<0||n>40)return false;
    j.escort={type:'mercenary',count:n,armor:'leather',
      heraldry:'neutral-brown',employer:'merchant',wageMultiplier:2};
    State.dirty=true;return true;
  }
  function availableExits(){
    const plan=Array.isArray(State.village?.roadPlan)?State.village.roadPlan:[];
    const entries=Array.isArray(State.village?.borderEntries)?State.village.borderEntries:[];
    return ['north','east','south','west'].map(edge=>{
      const route=plan.find(r=>r.edge===edge);
      const entry=entries.find(e=>e.edge===edge);
      return{edge,routeId:route?.id||null,entryId:entry?.id||null,
        point:entry?{x:entry.x,y:entry.y}:null,
        // A route flag is NOT proof of a drivable path. Future caravan
        // navigation must verify full continuity before moving or charging.
        reportedConnected:!!route?.connected};
    });
  }
  function snapshot(){
    const c=state(),lord=Object.values(c?.lordConvoys||{}),
      coach=Object.values(c?.nobleJourneys||{}),
      merchants=Object.values(c?.journeys||{});
    return{lordDrafts:lord.filter(x=>x.status==='draft').length,
      lordReady:lord.filter(x=>x.status==='ready').length,
      lordGoldReserved:money(lord.reduce((n,x)=>n+(x.chest?.reservedGold||0),0)),
      guardSlots:guardSlots(),guardSlotsAvailable:availableGuardSlots(),
      guardsRequested:reservedGuardSlots(),
      merchantMercenaries:merchants.reduce((n,j)=>n+(j.escort?.count||0),0),
      nobleCoachDrafts:coach.length};
  }
  window.ConquerConvoys=Object.freeze({
    state,quoteCargo,planLordConvoy,assignLordGuards,reserveLordConvoy,
    cancelLordConvoy,planNobleCoach,cancelNobleCoach,availableExits,
    guardSlots,availableGuardSlots,mercenaryDailyWage,quoteJourneyCost,
    assignMerchantEscorts,snapshot
  });
})();
