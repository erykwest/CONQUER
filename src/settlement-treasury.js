// FISCO-01 phase B — Erario: taxes, collection efficiency and the council's decrees.
// The town hall does not make or manage taxes: the lord sets the rates here (always, even
// with no town hall), the town hall of the village centre sets how much of what is due is
// actually collected. Collected = due × efficiency; the rest is evasion, lost.
// One ledger only: money moves between the class wallets of ConquerEconomy and the castle,
// happiness is the class happiness of ConquerEconomy (no second ledger, as C-01 asks).
(function(){
  'use strict';
  const round=v=>Math.round((Number(v)||0)*1000)/1000;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const finite=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;

  // The sales tax already exists (State.policies.tax, global): the Erario only shows it.
  // New taxes: each one takes happiness only from the class that pays it.
  const TAXES=Object.freeze({
    sales:{label:'Tassa sulle vendite',unit:'%',min:0,max:100,step:1,payers:['L4'],policy:'tax'},
    poll:{label:'Testatico',unit:'oro a testa / settimana',min:0,max:.3,step:.05,payers:['L1','L2']},
    dues:{label:'Dazio delle botteghe',unit:'% degli incassi',min:0,max:25,step:1,payers:['L2']},
    toll:{label:'Pedaggio',unit:'oro a carovana',min:0,max:20,step:1,payers:[]},
    tithe:{label:'Decima',unit:'% del raccolto',min:0,max:15,step:1,payers:['L4']}
  });
  const NEW_TAXES=['poll','dues','toll','tithe'];
  // Weekly happiness cost at the highest rate; proportional below it.
  const MAX_UNREST=1;
  // Efficiency (D-FISCO-261110). Centre town hall caps by level; floor without collectors.
  const TOWNHALL_CAP=Object.freeze({1:.6,2:.75,3:.85});
  const BARGELLO_CAP=Object.freeze({1:.65,2:.8});
  const BALIVO_CAP=Object.freeze({1:.6,2:.75});
  const FLOOR=.3,MAX_EFFICIENCY=.95,GUARD_BONUS=.05,UNHAPPY_PENALTY=.2;
  const FAR_QUARTER=.6,FAR_COUNTRYSIDE=.5;
  const COLLECTOR_RESIDENTS=40;
  const COLLECTOR_ROLE='fisco.collector',JUDGE_ROLE='fisco.judge';

  // Decrees from the council chamber of the centre town hall: timed, to be renewed.
  // level = centre town hall level needed (the levy needs L2, or L1 during an alarm or siege).
  const DECREES=Object.freeze({
    feast:{label:'Festa patronale',level:1,days:7,cost:60,help:'Una settimana di festa: tutte le classi più contente.'},
    curfew:{label:'Coprifuoco',level:1,days:14,cost:0,help:'Strade vuote la notte: meno crimine, popolani scontenti.'},
    alms:{label:'Elemosina',level:1,days:14,cost:0,help:'Il castello distribuisce oro ai poveri (L1) ogni settimana.'},
    breadCap:{label:'Calmiere del pane',level:2,days:28,cost:0,help:'Il prezzo del cibo non supera il prezzo base: scontenta i proprietari (L4).'},
    amnesty:{label:'Amnistia',level:2,days:0,cost:0,cooldown:56,help:'Libera i prigionieri: il popolo apprezza.'},
    fair:{label:'Bando di fiera',level:3,days:7,cost:100,help:'Una settimana di fiera: pedaggio sospeso, commercianti e proprietari contenti.'},
    levy:{label:'Leva straordinaria',level:2,crisisLevel:1,days:14,cost:0,options:{days:[14,21,28],share:[10,20,30]},
      help:'Tiene mobilitata la milizia anche senza allarme: una parte degli uomini L1/L2 resta in armi.'}
  });
  const LEVY_REPEAT_DAYS=56;

  function economy(){return window.ConquerEconomy}
  function today(){return Math.floor(finite(State.clock?.day))}
  // Kept inside State.economy, so every save path (local, cloud) carries it with the economy.
  function holder(){return economy()?.state?.()||State}
  function state(){
    const h=holder();
    const t=h.treasury&&typeof h.treasury==='object'?h.treasury:(h.treasury={});
    if(!t.rates||typeof t.rates!=='object')t.rates={};
    for(const k of NEW_TAXES)t.rates[k]=clamp(finite(t.rates[k]),TAXES[k].min,TAXES[k].max);
    if(!t.accrued||typeof t.accrued!=='object')t.accrued={};
    for(const k of NEW_TAXES)t.accrued[k]=Math.max(0,finite(t.accrued[k]));
    if(!t.week||typeof t.week!=='object')t.week=emptyWeek();
    if(!Array.isArray(t.history))t.history=[];
    if(!t.decrees||typeof t.decrees!=='object')t.decrees={};
    if(!t.decrees.active||typeof t.decrees.active!=='object')t.decrees.active={};
    if(!t.decrees.last||typeof t.decrees.last!=='object')t.decrees.last={};
    t.lastDay=finite(t.lastDay,-1);
    return t;
  }
  function emptyWeek(){
    return{due:Object.fromEntries(NEW_TAXES.map(k=>[k,0])),collected:Object.fromEntries(NEW_TAXES.map(k=>[k,0])),inKind:{}};
  }

  // ---- buildings ----
  const done=s=>!!s&&!s.destroyed&&!s.abandoned&&!(typeof underConstruction==='function'&&underConstruction(s));
  const level=s=>typeof civicLevel==='function'?civicLevel(s):Math.max(1,Math.round(finite(s?.civicLevel,1)));
  function centreWell(){return typeof villageCenterWell==='function'?villageCenterWell():null}
  function wellCivic(type,well){
    if(!well)return null;
    return (State.structures||[]).find(s=>s.type===type&&s.wellId===well.id&&done(s))||null;
  }
  function centreTownhall(){return wellCivic('townhall',centreWell())}
  function townhallRooms(s){
    if(!s)return[];
    if(!Array.isArray(s.functions)||!s.townhallRooms)return['council'];
    return s.functions.slice(0,level(s)).filter(Boolean);
  }
  function hasGuardRoom(s){return townhallRooms(s).includes('guard')}
  function hasCouncil(s){return townhallRooms(s).includes('council')}

  // ---- educated staff: the «Scolarizzati» contract (D-SCOL-261112) ----
  // FISCO-01 does not define the class, training or wages of collectors and judges: it
  // registers the roles and reads their yield. Until the educated engine exists every seat
  // counts as filled (yield 1), so the Erario is playable now.
  function collectorSeats(){
    const th=centreTownhall();
    let seats=0;
    if(th){
      const pop=economy()?.population?.()||{};
      const residents=['L1','L2','L3','L4'].reduce((n,g)=>n+finite(pop[g]),0);
      seats+=Math.max(1,Math.ceil(residents/COLLECTOR_RESIDENTS));
    }
    for(const b of (State.structures||[]))if(b.type==='bargello'&&done(b))seats+=level(b)===2?4:2;
    for(const b of (State.structures||[]))if(b.type==='balivo'&&done(b))seats+=level(b)===2?3:2;
    return seats;
  }
  function judgeSeats(){
    let seats=0;
    for(const b of (State.structures||[]))if(b.type==='balivo'&&done(b))seats+=1;
    return seats;
  }
  let rolesRegistered=false;
  function registerRoles(){
    const api=window.ConquerEducated;
    if(rolesRegistered||typeof api?.registerRole!=='function')return;
    api.registerRole({id:COLLECTOR_ROLE,branch:'lay',label:'Esattori',owner:'FISCO-01',seats:collectorSeats,minYield:0,payer:'castle'});
    api.registerRole({id:JUDGE_ROLE,branch:'lay',label:'Giudici del Balivo',owner:'FISCO-01',seats:judgeSeats,minYield:.5,payer:'castle'});
    rolesRegistered=true;
  }
  function roleYield(id){
    registerRoles();
    const y=window.ConquerEducated?.coverage?.(id)?.yield;
    return Number.isFinite(y)?clamp(y,0,1):1;
  }

  // ---- efficiency ----
  function crisis(){
    const alarm=window.ConquerCombat?.alarmMode?.()||'off';
    // A siege: hostile troops (not wolves) still in the field.
    const enemy=window.ConquerCombat?.enemy?.();
    const siege=Array.isArray(enemy)&&enemy.some(x=>x&&x.kind!=='wolf'&&!x.defeated);
    return alarm!=='off'||siege;
  }
  function unhappyPenalty(payers){
    const h=economy()?.state?.()?.happiness||{};
    if(!payers?.length)return 0;
    const avg=payers.reduce((n,g)=>n+finite(h[g],50),0)/payers.length;
    return clamp((50-avg)/50,0,1)*UNHAPPY_PENALTY;
  }
  // Base efficiency of the centre, before the payers' mood.
  function centreBase(){
    const th=centreTownhall();
    if(!th)return FLOOR;
    const cap=TOWNHALL_CAP[level(th)]||TOWNHALL_CAP[1];
    return FLOOR+(cap-FLOOR)*roleYield(COLLECTOR_ROLE)+(hasGuardRoom(th)?GUARD_BONUS:0);
  }
  // Quarter of a point: the nearest completed well, if the point lies in the housing zones.
  function zoneOf(p){
    const wells=typeof villageWells==='function'?villageWells():[];
    if(!wells.length||!p)return{kind:'countryside',well:null};
    const zone=window.ConquerCombat?.areaState?.(p);
    const nearest=wells.slice().sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0];
    if(zone&&!zone.yellow&&!zone.green)return{kind:'countryside',well:null};
    return{kind:nearest===centreWell()?'centre':'quarter',well:nearest};
  }
  function quarterBase(well){
    const th=centreTownhall(),b=wellCivic('bargello',well);
    // Without the centre town hall the Bargello does not collect.
    if(!th||!b)return centreBase()*FAR_QUARTER;
    const cap=BARGELLO_CAP[level(b)]||BARGELLO_CAP[1];
    return FLOOR+(cap-FLOOR)*roleYield(COLLECTOR_ROLE)+(hasGuardRoom(th)?GUARD_BONUS:0);
  }
  const BALIVO_REACH=30;
  function balivoFor(p){
    return (State.structures||[]).filter(s=>s.type==='balivo'&&done(s)&&p&&Math.hypot(s.x-p.x,s.y-p.y)<=BALIVO_REACH)
      .sort((a,b)=>level(b)-level(a))[0]||null;
  }
  function countrysideBase(p){
    const b=balivoFor(p);
    if(!b)return centreBase()*FAR_COUNTRYSIDE;
    const cap=BALIVO_CAP[level(b)]||BALIVO_CAP[1];
    return FLOOR+(cap-FLOOR)*roleYield(COLLECTOR_ROLE);
  }
  // Efficiency for a tax paid at point p (or at the centre when p is missing).
  function efficiency(tax,p=null){
    if(crisis())return 0;
    const z=p?zoneOf(p):{kind:'centre'};
    const base=z.kind==='quarter'?quarterBase(z.well):z.kind==='countryside'?countrysideBase(p):centreBase();
    return round(clamp(base-unhappyPenalty(TAXES[tax]?.payers),0,MAX_EFFICIENCY));
  }
  function efficiencyReport(){
    const wells=typeof villageWells==='function'?villageWells():[];
    const quarters=wells.filter(w=>w!==centreWell()).map(w=>{
      const b=wellCivic('bargello',w);
      return{id:w.id,name:(typeof wellDisplayName==='function'&&wellDisplayName(w))||'Quartiere',
        bargello:b?level(b):0,efficiency:crisis()?0:round(clamp(quarterBase(w),0,MAX_EFFICIENCY))};
    });
    const th=centreTownhall();
    return{crisis:crisis(),townhall:th?level(th):0,guardRoom:hasGuardRoom(th),council:!!th&&hasCouncil(th),
      collectors:{seats:collectorSeats(),yield:roleYield(COLLECTOR_ROLE)},
      centre:crisis()?0:round(clamp(centreBase(),0,MAX_EFFICIENCY)),quarters,
      balivi:(State.structures||[]).filter(s=>s.type==='balivo'&&done(s)).map(s=>({id:s.id,level:level(s),
        efficiency:crisis()?0:round(clamp(countrysideBase(s),0,MAX_EFFICIENCY))})),
      countryside:crisis()?0:round(clamp(centreBase()*FAR_COUNTRYSIDE,0,MAX_EFFICIENCY))};
  }

  // ---- rates ----
  function rate(tax){
    if(tax==='sales')return clamp(finite(State.policies?.tax),0,100);
    return state().rates[tax]||0;
  }
  function setRate(tax,value){
    const spec=TAXES[tax];if(!spec)return false;
    const v=clamp(Math.round(finite(value)/spec.step)*spec.step,spec.min,spec.max);
    if(tax==='sales'){State.policies=State.policies||{};State.policies.tax=v}
    else state().rates[tax]=round(v);
    if(typeof markDirty==='function')markDirty(false,false,true);
    return true;
  }

  // ---- accruals (called by the economy, commerce and trade) ----
  // Workshop dues: share of an L2 workshop's takings, accrued where the shop stands.
  function accrueDues(amount,s){
    const r=rate('dues');if(!(r>0)||!(amount>0))return 0;
    const due=round(amount*r/100),t=state(),got=round(due*efficiency('dues',s));
    t.week.due.dues=round(t.week.due.dues+due);
    t.accrued.dues=round(t.accrued.dues+got);
    return got;
  }
  // Tithe in kind on a private (L4) harvest: returns what stays with the owner.
  function tithe(e,good,qty,s){
    const r=rate('tithe');if(!(r>0)||!(qty>0))return qty;
    const due=round(qty*r/100),t=state(),got=round(due*efficiency('tithe',s));
    t.week.due.tithe=round(t.week.due.tithe+due);
    t.week.collected.tithe=round(t.week.collected.tithe+got);
    t.week.inKind[good]=round((t.week.inKind[good]||0)+got);
    if(e?.castle)e.castle[good]=round(finite(e.castle[good])+got); // in kind, into the castle stores
    return round(qty-got);
  }
  // Toll on a caravan or convoy coming in at the gates. Foreign merchants pay; the fair waives it.
  function toll(source=''){
    const r=rate('toll');if(!(r>0)||active('fair'))return 0;
    const t=state(),got=round(r*efficiency('toll'));
    t.week.due.toll=round(t.week.due.toll+r);
    t.week.collected.toll=round(t.week.collected.toll+got);
    const e=economy()?.state?.();
    if(e)e.castleGold=round(finite(e.castleGold)+got);
    return got;
  }
  // Calmiere del pane: food never sells above its base price while the decree lasts.
  function priceCap(good,price,base){return good==='food'&&active('breadCap')?Math.min(price,base):price}

  // ---- weekly collection (Saturday, after the market) ----
  function weekly(day){
    const t=state(),e=economy()?.state?.();if(!e)return;
    const pop=economy().population();
    const happiness=e.happiness;
    // Testatico: per head of L1 and L2, from their class wallets, collected quarter by quarter.
    const poll=rate('poll');
    if(poll>0){
      for(const g of ['L1','L2']){
        const due=round(finite(pop[g])*poll);
        if(!(due>0))continue;
        const wanted=round(due*pollEfficiency());
        const got=round(Math.min(wanted,Math.max(0,finite(e.wallet[g]))));
        e.wallet[g]=round(finite(e.wallet[g])-got);e.castleGold=round(finite(e.castleGold)+got);
        t.week.due.poll=round(t.week.due.poll+due);t.week.collected.poll=round(t.week.collected.poll+got);
      }
    }
    // Workshop dues collected during the week, paid out of the L2 takings.
    if(t.accrued.dues>0){
      const got=round(Math.min(t.accrued.dues,Math.max(0,finite(e.wallet.L2))));
      e.wallet.L2=round(finite(e.wallet.L2)-got);e.castleGold=round(finite(e.castleGold)+got);
      t.week.collected.dues=round(t.week.collected.dues+got);t.accrued.dues=0;
    }
    // Unrest: only the class that pays, in proportion to the rate.
    const unrest={L1:0,L2:0,L3:0,L4:0};
    for(const k of ['poll','dues','tithe']){
      const share=rate(k)/TAXES[k].max;
      for(const g of TAXES[k].payers)unrest[g]+=MAX_UNREST*share;
    }
    applyDecreesWeekly(day,e,pop,unrest);
    for(const g of Object.keys(unrest))if(unrest[g]&&finite(pop[g])>0)
      happiness[g]=clamp(round(finite(happiness[g],50)-unrest[g]),0,100);
    t.history.push({day,due:{...t.week.due},collected:{...t.week.collected},inKind:{...t.week.inKind},
      efficiency:efficiencyReport().centre});
    if(t.history.length>12)t.history.splice(0,t.history.length-12);
    t.last=t.history[t.history.length-1];
    t.week=emptyWeek();
  }
  // Average testatico efficiency over the houses, weighted by quarter.
  function pollEfficiency(){
    const houses=(State.structures||[]).filter(s=>s.type==='house'&&done(s));
    if(!houses.length)return efficiency('poll');
    return houses.reduce((n,h)=>n+efficiency('poll',h),0)/houses.length;
  }

  // ---- decrees ----
  function active(id,day=today()){
    const a=holder().treasury?.decrees?.active?.[id];
    return !!a&&day>=a.start&&day<=a.end;
  }
  function decreeStatus(id){
    const spec=DECREES[id];if(!spec)return{ok:false,reason:'Decreto sconosciuto'};
    const th=centreTownhall(),t=state(),day=today();
    if(!th)return{ok:false,reason:'Serve il Municipio del centro'};
    if(!hasCouncil(th))return{ok:false,reason:'Serve la sala del consiglio'};
    const need=spec.crisisLevel&&crisis()?spec.crisisLevel:spec.level;
    if(level(th)<need)return{ok:false,reason:'Serve il Municipio L'+need};
    if(active(id))return{ok:false,reason:'Già in vigore fino al giorno '+t.decrees.active[id].end,active:true};
    const last=t.decrees.last[id];
    if(spec.cooldown&&Number.isFinite(last)&&day-last<spec.cooldown)return{ok:false,reason:'Di nuovo dal giorno '+(last+spec.cooldown)};
    const gold=finite(economy()?.state?.()?.castleGold);
    if(spec.cost>gold)return{ok:false,reason:'Servono '+spec.cost+' oro'};
    return{ok:true};
  }
  function issue(id,params={}){
    const spec=DECREES[id],check=decreeStatus(id);
    if(!check.ok)return check;
    const t=state(),day=today(),e=economy()?.state?.();
    if(spec.cost&&e)e.castleGold=round(finite(e.castleGold)-spec.cost);
    let days=spec.days;
    const entry={start:day,end:day+Math.max(0,days-1)};
    if(id==='levy'){
      days=spec.options.days.includes(+params.days)?+params.days:spec.days;
      entry.end=day+days-1;
      entry.share=spec.options.share.includes(+params.share)?+params.share:spec.options.share[0];
      const prev=t.decrees.last.levyEnd;
      entry.repeat=Number.isFinite(prev)&&day-prev<=LEVY_REPEAT_DAYS;
      t.decrees.last.levyEnd=entry.end;
    }
    if(id==='amnesty'){
      window.ConquerCrime?.amnesty?.();
      const pop=economy()?.population?.()||{};
      if(e)for(const g of ['L1','L2'])if(finite(pop[g])>0)e.happiness[g]=clamp(round(finite(e.happiness[g],50)+1.5),0,100);
    }
    t.decrees.last[id]=day;
    if(days>0)t.decrees.active[id]=entry;
    if(id==='levy')window.ConquerCombat?.refreshLevy?.();
    if(typeof markDirty==='function')markDirty(false,false,true);
    return{ok:true,entry};
  }
  function revoke(id){
    const t=state();if(!t.decrees.active[id])return false;
    if(id==='levy')t.decrees.last.levyEnd=today();
    delete t.decrees.active[id];
    if(id==='levy')window.ConquerCombat?.refreshLevy?.();
    if(typeof markDirty==='function')markDirty(false,false,true);
    return true;
  }
  // Share of L1/L2 men kept under arms by the levy (0 when none).
  function levyShare(){return active('levy')?finite(holder().treasury.decrees.active.levy.share)/100:0}
  function applyDecreesWeekly(day,e,pop,unrest){
    const t=state();
    for(const [id,a] of Object.entries(t.decrees.active)){
      if(day<a.start)continue;
      if(id==='feast')for(const g of Object.keys(unrest))unrest[g]-=1.5;
      if(id==='curfew'){unrest.L1+=.4;unrest.L2+=.4}
      if(id==='alms'){
        const gift=round(Math.min(finite(pop.L1)*.2,Math.max(0,finite(e.castleGold))));
        e.castleGold=round(finite(e.castleGold)-gift);e.wallet.L1=round(finite(e.wallet.L1)+gift);
        unrest.L1-=.8;
      }
      if(id==='breadCap')unrest.L4+=.6;
      if(id==='fair'){unrest.L3-=1;unrest.L4-=1}
      if(id==='levy'){const w=(a.share/10)*.3*(a.repeat?2:1);unrest.L1+=w;unrest.L2+=w}
    }
    for(const [id,a] of Object.entries(t.decrees.active))if(day>a.end){
      delete t.decrees.active[id];
      if(id==='levy')window.ConquerCombat?.refreshLevy?.();
    }
  }

  function daily(day){
    const t=state();
    if(day<=t.lastDay)return;
    t.lastDay=day;
    // Decrees that expire mid-week stop at once (the levy releases the militia).
    for(const [id,a] of Object.entries(t.decrees.active))if(day>a.end){
      delete t.decrees.active[id];
      if(id==='levy')window.ConquerCombat?.refreshLevy?.();
    }
    if(economy()?.weekday?.(day)===5)weekly(day);
  }
  // Rough weekly preview for a rate, for the Erario sliders.
  function preview(tax,value=rate(tax)){
    const pop=economy()?.population?.()||{};
    const spec=TAXES[tax];if(!spec)return null;
    let due=0;
    if(tax==='poll')due=(finite(pop.L1)+finite(pop.L2))*value;
    else if(tax==='dues'){const h=state().history.slice(-1)[0];const r=rate('dues');due=r>0&&h?h.due.dues/r*value:null}
    else if(tax==='toll'){const h=state().history.slice(-1)[0];const r=rate('toll');due=r>0&&h?h.due.toll/r*value:null}
    else if(tax==='tithe'){const h=state().history.slice(-1)[0];const r=rate('tithe');due=r>0&&h?Object.values(h.inKind).reduce((a,b)=>a+b,0)/Math.max(.01,h.efficiency)/r*value:null}
    const eff=efficiency(tax);
    return{due:due==null?null:round(due),collected:due==null?null:round(due*eff),efficiency:eff,
      unrest:round(tax==='sales'||tax==='toll'?0:MAX_UNREST*value/spec.max),payers:spec.payers.slice()};
  }
  function snapshot(){
    const t=state();
    return{rates:Object.fromEntries(Object.keys(TAXES).map(k=>[k,rate(k)])),
      week:JSON.parse(JSON.stringify(t.week)),last:t.last?JSON.parse(JSON.stringify(t.last)):null,
      efficiency:efficiencyReport(),
      decrees:Object.fromEntries(Object.keys(DECREES).map(id=>[id,{active:active(id),
        entry:t.decrees.active[id]?{...t.decrees.active[id]}:null,status:decreeStatus(id)}]))};
  }
  function reset(){delete holder().treasury;state()}

  window.ConquerTreasury=Object.freeze({TAXES,DECREES,TOWNHALL_CAP,BARGELLO_CAP,BALIVO_CAP,FLOOR,MAX_EFFICIENCY,
    COLLECTOR_ROLE,JUDGE_ROLE,state,reset,rate,setRate,efficiency,efficiencyReport,zoneOf,collectorSeats,judgeSeats,
    accrueDues,tithe,toll,priceCap,daily,weekly,active,decreeStatus,issue,revoke,levyShare,preview,snapshot});
})();
