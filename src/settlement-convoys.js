'use strict';
// CONQUER convoys: the one system for lord gifts/tributes (mastio drafts and the
// diplomatic courier's requests), L4+ merchant caravans and noble coaches.
// Lord convoys reserve real castle gold and goods, take escort provisions on
// departure and travel to the abstract neighbouring province and back.
// One good per wagon; coins travel in a chest; noble coaches carry people.
(() => {
  const GOODS=()=>window.ConquerEconomy?.GOODS||[];
  const commerce=()=>window.ConquerCommerce;
  const money=n=>Math.round((n+Number.EPSILON)*1000)/1000;
  const idOk=id=>typeof id==='string'&&id.length>0&&id.length<=128;
  const validGold=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=1e9&&
    Math.abs(n-money(n))<1e-8;
  // Several goods are allowed, each in its own wagon(s), never mixed.
  const goodCargo=cargo=>Array.isArray(cargo)&&
    new Set(cargo.map(line=>line?.good)).size===cargo.length&&cargo.every(line=>
    line&&GOODS().includes(line.good)&&Number.isSafeInteger(line.qty)&&line.qty>0);
  const UNITS_PER_DAY=22,PROVINCE_DISTANCE=40,PROVISIONS_PER_PERSON_DAY=.35;
  const ACTIVE=Object.freeze(['draft','planned','blocked','ready','outbound','returning']);
  const localId=()=>State.village?.founded?String(State.village.wellId||''):'';
  const keep=()=>window.ConquerSiege?.mastio?.()||null;
  function state(){
    const c=commerce()?.state?.();
    if(!c)return null;
    if(!c.lordConvoys||typeof c.lordConvoys!=='object')c.lordConvoys={};
    if(!c.nobleJourneys||typeof c.nobleJourneys!=='object')c.nobleJourneys={};
    migrateDiplomacyCaravans(c);
    return c;
  }
  // Before the unification ConquerDiplomacy kept its own caravans and spent
  // State.resources (a projection the economy overwrites). Move them here once.
  function migrateDiplomacyCaravans(c){
    const old=State.diplomacy?.caravans;
    if(!Array.isArray(old)||!old.length)return;
    for(const v of old){
      if(!idOk(v?.id)||c.lordConvoys[v.id])continue;
      const cargo=Object.entries(v.cargo||{}).filter(([g,q])=>g!=='gold'&&GOODS().includes(g)&&Math.floor(+q)>0)
        .map(([good,qty])=>({good,qty:Math.floor(+qty)}));
      const gold=money(Math.max(0,Math.floor(+v.cargo?.gold||0)));
      const departed=['outbound','returning','completed'].includes(v.status);
      c.lordConvoys[v.id]={id:v.id,kind:'tribute',originId:localId(),destinationId:'province-'+(v.edge||'north'),
        source:'diplomacy',edge:v.edge||'north',routeDistance:Math.max(0,+v.routeDistance||0),
        minGold:money(+v.requested||0),originStructureId:String(keep()?.id||''),originRole:'mastio',
        cargo,chest:{gold,reservedGold:departed?gold:0},reservedCargo:departed?cargo.map(l=>({...l})):[],
        transport:quoteLord(cargo,gold),escorts:{kind:'garrison',requested:Math.max(0,Math.floor(+v.escort||0)),assigned:0,
          heraldry:'lord',wageModel:'existing-garrison'},
        departDay:+v.departDay||Math.ceil(+State.clock?.day||0),status:['draft','planned','blocked'].includes(v.status)||departed?v.status:'draft',
        blockedBy:v.blockedBy||null,actualDepartDay:v.actualDepartDay??null,arrivalDay:v.arrivalDay??null,
        returnDay:v.returnDay??null,provisionsSpent:+v.provisionsSpent||0};
    }
    State.diplomacy.caravans=[];
  }
  function quoteLord(cargo=[],coinGold=0,vehicle='wagon'){
    const parts=cargo.map(line=>quoteCargo([line],0,vehicle));
    if(parts.some(q=>!q))return null;
    const coinOnly=!cargo.length&&coinGold>0?quoteCargo([],coinGold,vehicle):null;
    const all=coinOnly?[coinOnly]:parts;
    if(!all.length)return null;
    return{mode:vehicle,capacity:all[0].capacity,wagons:all.reduce((n,q)=>n+q.wagons,0),
      loadPoints:money(all.reduce((n,q)=>n+q.loadPoints,0)),
      goldPerDay:money(all.reduce((n,q)=>n+q.goldPerDay,0))};
  }
  function travel(j){
    const outward=Math.max(1,Math.ceil((Math.max(0,+j.routeDistance||0)+PROVINCE_DISTANCE)/UNITS_PER_DAY));
    // Escort plus two drivers, there and back.
    const food=Math.ceil(((j.escorts?.requested||0)+2)*outward*2*PROVISIONS_PER_PERSON_DAY);
    return{outward,food,arrival:(+j.departDay||0)+outward,returnDay:(+j.departDay||0)+2*outward};
  }
  function guardSlots(){
    // Siege capacity is a maximum *barracks capacity*, NOT an actual roster.
    // Reservations cannot become assigned soldiers until troop accounting exists.
    const cap=window.ConquerSiege?.capacity?.()?.soldiers;
    return Math.max(0,Math.floor(Number.isFinite(cap)?cap:0));
  }
  function reservedGuardSlots(excluding=null){
    const c=state();
    // Completed convoys give their barracks posts back.
    return Object.values(c?.lordConvoys||{}).reduce((n,j)=>
      n+(j.id===excluding||j.status==='completed'?0:j.escorts?.requested||0),0);
  }
  function availableGuardSlots(excluding=null){
    return Math.max(0,guardSlots()-reservedGuardSlots(excluding));
  }
  function quoteCargo(cargo=[],coinGold=0,vehicle='wagon'){
    return commerce()?.caravanQuote?.(cargo,coinGold,{vehicle})||null;
  }
  function planLordConvoy({id,kind='gift',destinationId,cargo=[],coinGold=0,
    vehicle='wagon',guards=0,edge=null,routeDistance=0,departDay=null,minGold=0,source='mastio'}={}){
    const c=state(),castle=keep(),local=localId();
    if(!c||!castle||!local||!idOk(id)||!idOk(destinationId)||
      destinationId===local||c.lordConvoys[id]||c.journeys?.[id]||
      !['gift','tribute'].includes(kind)||!validGold(coinGold)||
      !goodCargo(cargo)||(!cargo.length&&coinGold<=0)||
      !Number.isSafeInteger(guards)||guards<0||guards>availableGuardSlots())return false;
    if(!validGold(minGold)||coinGold<minGold)return false;
    const transport=quoteLord(cargo,coinGold,vehicle);
    if(!transport||!transport.wagons)return false;
    c.lordConvoys[id]={
      id,kind,originId:local,destinationId,source:'lord',
      originStructureId:String(castle.id),originRole:'mastio',
      cargo:cargo.map(line=>({good:line.good,qty:line.qty})),
      chest:{gold:money(coinGold),reservedGold:0},
      reservedCargo:[],transport,source,edge,routeDistance:Math.max(0,+routeDistance||0),minGold:money(minGold),
      departDay:Number.isFinite(+departDay)&&departDay!==null?Math.ceil(+departDay):Math.ceil(+State.clock?.day||0)+1,
      blockedBy:null,actualDepartDay:null,arrivalDay:null,returnDay:null,provisionsSpent:0,
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
  // First missing castle resource for gold + goods (+ provisions), or null.
  function missingStock(j,provisions=0){
    const e=window.ConquerEconomy?.state?.();
    if(!e)return'economy';
    const reserved=j.status==='ready';
    if(!reserved&&!(Number(e.castleGold)+1e-9>=j.chest.gold))return'gold';
    for(const line of reserved?[]:j.cargo){
      const need=line.qty+(line.good==='food'?provisions:0);
      if(!(Number(e.castle?.[line.good])+1e-9>=need))return line.good;
    }
    const foodLine=reserved?0:(j.cargo.find(l=>l.good==='food')?.qty||0);
    if(provisions>0&&!(Number(e.castle?.food)+1e-9>=provisions+(reserved?0:foodLine)))return'provisions';
    return null;
  }
  function reserveLordConvoy(convoyId){
    const c=state(),j=c?.lordConvoys[convoyId],e=window.ConquerEconomy?.state?.();
    if(!c||!j||!e||!['draft','planned','blocked'].includes(j.status)||keep()?.id!==j.originStructureId||
      j.escorts.requested>availableGuardSlots(j.id)||missingStock(j))return false;
    // Single atomic reservation from castle-owned stock: no market purchase.
    e.castleGold=money(Number(e.castleGold)-j.chest.gold);
    for(const line of j.cargo)e.castle[line.good]=money(Math.max(0,e.castle[line.good]-line.qty));
    j.chest.reservedGold=j.chest.gold;
    j.reservedCargo=j.cargo.map(line=>({good:line.good,qty:line.qty}));
    j.status='ready';j.blockedBy=null;
    window.ConquerEconomy?.syncBuilderResources?.();
    State.dirty=true;return true;
  }
  // Editable until departure; reserved convoys must be cancelled first.
  function updateLordConvoy(convoyId,{cargo,coinGold,guards,departDay}={}){
    const j=state()?.lordConvoys[convoyId];
    if(!j||!['draft','planned','blocked'].includes(j.status))return false;
    const nextCargo=cargo??j.cargo,nextGold=coinGold??j.chest.gold,nextGuards=guards??j.escorts.requested;
    if(!goodCargo(nextCargo)||!validGold(nextGold)||nextGold<(j.minGold||0)||
      (!nextCargo.length&&nextGold<=0)||!Number.isSafeInteger(nextGuards)||nextGuards<0||
      nextGuards>availableGuardSlots(j.id))return false;
    const transport=quoteLord(nextCargo,nextGold,j.transport?.mode||'wagon');
    if(!transport)return false;
    j.cargo=nextCargo.map(line=>({good:line.good,qty:line.qty}));j.chest.gold=money(nextGold);
    j.escorts.requested=nextGuards;j.transport=transport;
    if(departDay!=null&&Number.isFinite(+departDay))j.departDay=Math.max(Math.ceil(+State.clock?.day||0),Math.ceil(+departDay));
    State.dirty=true;return true;
  }
  function scheduleLordConvoy(convoyId){
    const j=state()?.lordConvoys[convoyId];
    if(!j||!['draft','ready','blocked'].includes(j.status))return false;
    if(j.status!=='ready')j.status='planned';
    j.scheduled=true;j.blockedBy=null;State.dirty=true;return true;
  }
  // Departure takes the escort provisions (and, unless already reserved, the
  // gold and goods) from the castle in one step, or the convoy waits blocked.
  function dispatch(j,at){
    const e=window.ConquerEconomy?.state?.(),metrics=travel(j);
    const missing=missingStock(j,metrics.food);
    if(!e||missing){j.status='blocked';j.blockedBy=missing||'economy';State.dirty=true;return false}
    if(j.status!=='ready'){
      e.castleGold=money(Number(e.castleGold)-j.chest.gold);j.chest.reservedGold=j.chest.gold;
      for(const line of j.cargo)e.castle[line.good]=money(e.castle[line.good]-line.qty);
      j.reservedCargo=j.cargo.map(line=>({good:line.good,qty:line.qty}));
    }
    e.castle.food=money(Math.max(0,Number(e.castle.food)-metrics.food));
    j.status='outbound';j.actualDepartDay=at;j.arrivalDay=at+metrics.outward;j.returnDay=at+2*metrics.outward;
    j.provisionsSpent=metrics.food;j.blockedBy=null;
    window.ConquerEconomy?.syncBuilderResources?.();
    State.dirty=true;return true;
  }
  function tick(from,to){
    const c=state();
    if(!c||!(to>from))return;
    for(const j of Object.values(c.lordConvoys)){
      const due=(j.status==='planned'||j.status==='blocked'||j.status==='ready'&&j.scheduled)&&to>=j.departDay;
      if(due)dispatch(j,to);
      // Delivered goods and coins leave the economy for the receiving province.
      if(j.status==='outbound'&&to>=j.arrivalDay){j.status='returning';State.dirty=true}
      if(j.status==='returning'&&to>=j.returnDay){j.status='completed';State.dirty=true}
    }
  }
  function cancelLordConvoy(convoyId){
    const c=state(),j=c?.lordConvoys[convoyId];
    if(!j||!['draft','planned','blocked','ready'].includes(j.status))return false;
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
  // Small lord-owned draft controls; never offers a fictitious launch button.
  function panelHtml(tower){
    if(!tower||keep()?.id!==tower.id)return'';
    const c=state(),goods=GOODS();
    const rows=Object.values(c?.lordConvoys||{}).filter(j=>
      ACTIVE.includes(j.status)&&j.originStructureId===String(tower.id));
    const htmlEscape=s=>String(s).replace(/[&<>"']/g,ch=>
      ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
    const items=rows.slice(-8).map(j=>{
      const ref=encodeURIComponent(j.id),label=j.kind==='tribute'?'Tributo':'Dono';
      const goodsText=j.cargo.length?j.cargo[0].qty+' '+j.cargo[0].good:'solo monete';
      const guardEdit=j.status==='draft'?
        '<label>Guardie richieste <input data-convoy-guard-input="'+ref+
        '" type="number" min="0" max="'+availableGuardSlots(j.id)+
        '" value="'+j.escorts.requested+'" step="1"></label>'+
        '<button type="button" data-convoy-guards="'+ref+'">Aggiorna scorta</button>':'';
      return'<div class="legend">'+label+' · '+htmlEscape(goodsText)+
        ' · forziere '+j.chest.gold+' oro · guardie richieste '+j.escorts.requested+
        ' · '+({draft:'bozza',planned:'in partenza',blocked:'bloccato: manca '+htmlEscape(j.blockedBy||''),ready:j.scheduled?'accantonato, in partenza':'risorse accantonate',outbound:'in viaggio',returning:'di ritorno'}[j.status]||j.status)+'</div>'+
        guardEdit+(j.status==='draft'?'<button type="button" data-convoy-reserve="'+ref+
        '">Accantona oro e merci</button>':'')+
        (['draft','ready'].includes(j.status)&&!j.scheduled?'<button type="button" data-convoy-schedule="'+ref+'">Programma partenza</button>':'')+
        (['outbound','returning'].includes(j.status)?'':'<button type="button" data-convoy-cancel="'+ref+'">Annulla convoglio</button>');
    }).join('');
    return'<div class="slot"><div class="slot-label">Tributi / doni · dal Mastio</div>'+
      '<div class="legend">Prepara un convoglio per una provincia vicina: oro e merci escono dal castello, la scorta consuma provviste per andata e ritorno. Le guardie sono posti di caserma richiesti, non ancora un roster reale.</div>'+
      '<label>Feudo destinatario <input type="text" data-convoy-destination maxlength="128" placeholder="ID feudo" /></label>'+
      '<label>Tipo <select data-convoy-kind><option value="gift">Dono</option><option value="tribute">Tributo</option></select></label>'+
      '<label>Merce <select data-convoy-good><option value="">Solo monete</option>'+
      goods.map(g=>'<option value="'+htmlEscape(g)+'">'+htmlEscape(g)+'</option>').join('')+
      '</select></label>'+
      '<label>Quantità <input data-convoy-qty type="number" min="0" step="1" value="0"></label>'+
      '<label>Monete nel forziere <input data-convoy-gold type="number" min="0" step="0.001" value="0"></label>'+
      '<label>Scorta caserme (posti prenotabili '+availableGuardSlots()+')'+
      '<input data-convoy-guard-count type="number" min="0" max="'+availableGuardSlots()+
      '" step="1" value="0"></label>'+
      '<button type="button" data-convoy-add>Prepara bozza</button>'+items+'</div>';
  }
  function bindPanel(root){
    if(!root||!root.querySelectorAll)return;
    const q=selector=>root.querySelector(selector);
    const refresh=()=>{if(typeof scheduleLocalSave==='function')scheduleLocalSave(200);
      if(typeof renderFunctionPanel==='function')renderFunctionPanel()};
    const notice=message=>{if(typeof status==='function')status(message)};
    const add=q('[data-convoy-add]');
    if(add)add.onclick=()=>{
      const c=state(),destinationId=q('[data-convoy-destination]')?.value.trim();
      const kind=q('[data-convoy-kind]')?.value;
      const good=q('[data-convoy-good]')?.value;
      const qty=Number(q('[data-convoy-qty]')?.value);
      const gold=Number(q('[data-convoy-gold]')?.value);
      const guards=Number(q('[data-convoy-guard-count]')?.value);
      if(!Number.isSafeInteger(qty)||qty<0||good&&qty<=0||!good&&qty!==0){
        notice('Quantità della merce non valida');return;
      }
      let serial=1,id='lord-convoy-'+serial;
      while(c.lordConvoys[id])id='lord-convoy-'+(++serial);
      if(!planLordConvoy({id,kind,destinationId,
        cargo:good?[{good,qty}]:[],coinGold:gold,guards})){
        notice('Bozza non valida: Mastio, feudo, risorse o posti di scorta da verificare');
        return;
      }
      notice('Convoglio creato come bozza: non è ancora partito');
      refresh();
    };
    const decode=btn=>decodeURIComponent(btn.dataset.convoyReserve||
      btn.dataset.convoyCancel||btn.dataset.convoyGuards);
    root.querySelectorAll('[data-convoy-reserve]').forEach(btn=>btn.onclick=()=>{
      if(!reserveLordConvoy(decode(btn))){notice('Scorte insufficienti o Mastio non disponibile');return}
      notice('Merci e monete accantonate: percorso non ancora attivo');refresh();
    });
    root.querySelectorAll('[data-convoy-schedule]').forEach(btn=>btn.onclick=()=>{
      if(!scheduleLordConvoy(decodeURIComponent(btn.dataset.convoySchedule)))return;
      notice('Partenza programmata: il convoglio parte da domani');refresh();
    });
    root.querySelectorAll('[data-convoy-cancel]').forEach(btn=>btn.onclick=()=>{
      if(!cancelLordConvoy(decode(btn)))return;
      notice('Bozza annullata: scorte restituite, se già accantonate');refresh();
    });
    root.querySelectorAll('[data-convoy-guards]').forEach(btn=>btn.onclick=()=>{
      const id=decode(btn),input=Array.from(root.querySelectorAll('[data-convoy-guard-input]'))
        .find(i=>i.dataset.convoyGuardInput===encodeURIComponent(id));
      if(!input||!assignLordGuards(id,Number(input.value))){
        notice('Posti di scorta delle caserme insufficienti');return;
      }
      notice('Posti scorta richiesti aggiornati');refresh();
    });
  }
  function snapshot(){
    const c=state(),lord=Object.values(c?.lordConvoys||{}),
      coach=Object.values(c?.nobleJourneys||{}),
      merchants=Object.values(c?.journeys||{});
    return{lordActive:lord.filter(x=>ACTIVE.includes(x.status)).length,
      lordTravelling:lord.filter(x=>x.status==='outbound'||x.status==='returning').length,
      lordDrafts:lord.filter(x=>x.status==='draft').length,
      lordReady:lord.filter(x=>x.status==='ready').length,
      lordGoldReserved:money(lord.reduce((n,x)=>n+(x.chest?.reservedGold||0),0)),
      guardSlots:guardSlots(),guardSlotsAvailable:availableGuardSlots(),
      guardsRequested:reservedGuardSlots(),
      merchantMercenaries:merchants.reduce((n,j)=>n+(j.escort?.count||0),0),
      nobleCoachDrafts:coach.length};
  }
  window.ConquerConvoys=Object.freeze({
    ACTIVE,state,quoteCargo,quoteLord,travel,missingStock,planLordConvoy,updateLordConvoy,scheduleLordConvoy,tick,
    assignLordGuards,reserveLordConvoy,
    cancelLordConvoy,planNobleCoach,cancelNobleCoach,availableExits,
    guardSlots,availableGuardSlots,mercenaryDailyWage,quoteJourneyCost,
    assignMerchantEscorts,panelHtml,bindPanel,snapshot
  });
})();
