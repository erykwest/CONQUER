'use strict';
// CHIESA-01 fase 1 (D-CHIESA-261112): the Church is one institution per village
// with a single treasury, State.economy.church.gold. It is one more purse beside
// wallet.L1–L4 and castleGold, not a second ledger: no goods, prices or happiness
// of its own. Phase 1 = treasury, Sunday offerings, yearly bequests and the lord's
// gift. Clergy wages, Mass, Favour effects and spending arrive in phases 2–3.
(() => {
  const OFFERING_PER_HEAD=Object.freeze({L1:.02,L2:.05,L3:.1,L4:.3});
  // Faithful a staffed church can serve, by civic level (shared with the phase-3 Mass).
  const CAPACITY=Object.freeze({1:60,2:150,3:300});
  const BEQUEST_SHARE=.02,BEQUEST_MIN_HAPPINESS=50;
  const GIFTS=Object.freeze([10,50,100]);
  const FAVOR_PER_GIFT_GOLD=.1; // +1 Favour every 10 gold
  const GROUPS=Object.freeze(['L1','L2','L3','L4']);
  const INCOME=Object.freeze(['offerings','bequests','gifts']);
  const SUNDAY=6; // day 0 is Monday (ConquerEconomy.weekday)
  const LOG_MAX=8;
  const finite=(v,d=0)=>Number.isFinite(+v)?+v:d;
  const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
  const round=n=>Math.round(n*1000)/1000;
  const econ=()=>window.ConquerEconomy;
  const completed=s=>!(typeof underConstruction==='function'&&underConstruction(s));
  const level=s=>typeof civicLevel==='function'?civicLevel(s):clamp(Math.round(finite(s?.civicLevel,1)),1,3);
  const emptyIncome=()=>Object.fromEntries(INCOME.map(k=>[k,0]));

  // Lazy migration: the block is born on first read; economy.version is unchanged.
  function state(){
    const e=econ()?.state?.();if(!e)return null;
    if(!e.church||typeof e.church!=='object')e.church={};
    const c=e.church;
    c.gold=round(Math.max(0,finite(c.gold)));
    c.favor=round(clamp(finite(c.favor,50),0,100));
    if(!c.month||typeof c.month!=='object')c.month={};
    if(!c.month.in||typeof c.month.in!=='object')c.month.in={};
    for(const k of INCOME)c.month.in[k]=round(Math.max(0,finite(c.month.in[k])));
    if(c.lastMonth!==null&&(typeof c.lastMonth!=='object'||!c.lastMonth))c.lastMonth=null;
    if(!Array.isArray(c.favorLog))c.favorLog=[];
    return c;
  }
  function churches(){
    return (State.structures||[]).filter(s=>s.type==='church'&&completed(s));
  }
  // Seat of the local Church: highest level, then the oldest (lowest id).
  function seat(){
    return churches().slice().sort((a,b)=>level(b)-level(a)||String(a.id).localeCompare(String(b.id),'en',{numeric:true}))[0]||null;
  }
  function capacity(){
    return churches().reduce((n,s)=>n+CAPACITY[level(s)],0);
  }
  // Worship yield: the clergy coverage of SCOL-01 once ConquerEducated exists.
  // Until then a completed church celebrates at full yield (transitional).
  function worshipYield(){
    if(!churches().length)return 0;
    const cov=window.ConquerEducated?.coverage?.('church.priest');
    return cov?clamp(finite(cov.yield),0,1):1;
  }
  function servedShare(){
    const pop=econ()?.population?.()||{};
    const residents=GROUPS.reduce((n,g)=>n+finite(pop[g]),0);
    if(residents<=0)return 0;
    return clamp(capacity()/residents,0,1);
  }
  function addFavor(c,delta,cause,day){
    const before=c.favor;
    c.favor=round(clamp(before+delta,0,100));
    const applied=round(c.favor-before);
    if(applied){
      c.favorLog.push({day:Math.floor(finite(day,State.clock?.day)),cause,delta:applied});
      if(c.favorLog.length>LOG_MAX)c.favorLog.splice(0,c.favorLog.length-LOG_MAX);
    }
    return applied;
  }
  // Sunday offerings: per class, served residents × quota × worship yield ×
  // (0.5 + happiness/100), taken from that class's purse and never beyond it.
  function offerings(day){
    const c=state(),e=econ()?.state?.();if(!c||!e)return 0;
    const y=worshipYield(),share=servedShare();
    if(y<=0||share<=0)return 0;
    const pop=econ().population();let total=0;
    for(const g of GROUPS){
      const due=finite(pop[g])*share*OFFERING_PER_HEAD[g]*y*(.5+clamp(finite(e.happiness?.[g],50),0,100)/100);
      const paid=round(Math.min(Math.max(0,due),Math.max(0,finite(e.wallet?.[g]))));
      if(paid<=0)continue;
      e.wallet[g]=round(finite(e.wallet[g])-paid);
      total=round(total+paid);
    }
    c.gold=round(c.gold+total);
    c.month.in.offerings=round(c.month.in.offerings+total);
    return total;
  }
  function daily(day){
    if(!State.village?.founded)return;
    if(econ()?.weekday?.(day)===SUNDAY)offerings(day);
  }
  // Month end: keep last month's income for the panel, then start a fresh one.
  function monthly(day){
    const c=state();if(!c)return;
    c.lastMonth={day:Math.floor(finite(day)),in:{...c.month.in}};
    c.month={in:emptyIncome()};
  }
  // Year end: 2% of the L3 and L4 purses, each only if that class is content.
  function annual(day){
    const c=state(),e=econ()?.state?.();if(!c||!e||!churches().length)return 0;
    let total=0;
    for(const g of ['L3','L4']){
      if(clamp(finite(e.happiness?.[g],50),0,100)<BEQUEST_MIN_HAPPINESS)continue;
      const paid=round(Math.max(0,finite(e.wallet?.[g]))*BEQUEST_SHARE);
      if(paid<=0)continue;
      e.wallet[g]=round(finite(e.wallet[g])-paid);
      total=round(total+paid);
    }
    c.gold=round(c.gold+total);
    c.month.in.bequests=round(c.month.in.bequests+total);
    return total;
  }
  // The lord's gift: castle gold into the treasury, +1 Favour every 10 gold.
  function donate(amount){
    const gold=Math.floor(finite(amount));
    const c=state(),e=econ()?.state?.();
    if(!c||!e||!GIFTS.includes(gold)||!churches().length)return false;
    if(finite(e.castleGold)<gold)return false;
    e.castleGold=round(finite(e.castleGold)-gold);
    c.gold=round(c.gold+gold);
    c.month.in.gifts=round(c.month.in.gifts+gold);
    addFavor(c,gold*FAVOR_PER_GIFT_GOLD,'gift',State.clock?.day);
    econ().syncBuilderResources?.();
    return true;
  }
  function snapshot(){
    const c=state();if(!c)return null;
    const s=seat();
    return {gold:c.gold,favor:c.favor,churches:churches().length,
      seatId:s?String(s.id):null,seatLevel:s?level(s):0,
      capacity:capacity(),served:round(servedShare()),worshipYield:round(worshipYield()),
      month:{...c.month.in},lastMonth:c.lastMonth?{...c.lastMonth.in}:null,
      favorLog:c.favorLog.map(x=>({...x}))};
  }

  // ---- Inspector tab (same for every church: the institution is one) ----------
  const fmt=n=>Number(finite(n)).toLocaleString('it-IT',{maximumFractionDigits:1});
  const CAUSES={gift:'Dono del signore'};
  const TITLES={1:'Parrocchia',2:'Pieve',3:'Collegiata'};
  function panelHtml(s){
    if(!s||s.type!=='church'||!completed(s))return '';
    const d=snapshot();if(!d)return '';
    const castle=finite(econ()?.state?.()?.castleGold);
    const kv=(k,v)=>'<div class="kv"><span>'+k+'</span><b>'+v+'</b></div>';
    const income=m=>m?fmt(m.offerings)+' · '+fmt(m.bequests)+' · '+fmt(m.gifts):'—';
    const isSeat=d.seatId===String(s.id);
    return '<div class="slot church-panel"><div class="slot-label">Chiesa · '+TITLES[level(s)]+(isSeat?' · sede':'')+'</div>'+
      kv('Cassa della Chiesa',fmt(d.gold)+' oro')+
      kv('Favore verso il signore',fmt(d.favor)+' / 100')+
      kv('Entrate del mese · offerte · lasciti · doni',income(d.month))+
      kv('Mese scorso · offerte · lasciti · doni',income(d.lastMonth))+
      kv('Fedeli serviti',fmt(Math.round(d.served*100))+'% · capienza '+fmt(d.capacity))+
      (d.favorLog.length?'<div class="legend">'+d.favorLog.slice(-3).reverse().map(x=>
        (CAUSES[x.cause]||x.cause)+' '+(x.delta>0?'+':'')+fmt(x.delta)).join(' · ')+'</div>':'')+
      '<div class="grid3">'+GIFTS.map(g=>'<button type="button" data-church-gift="'+g+'" '+
        (castle<g?'disabled':'')+'>Dona '+g+'</button>').join('')+'</div>'+
      '<div class="legend">Una sola Chiesa per villaggio: la Cassa è sua, il signore può solo donare. '+
      'Offerte la domenica, lasciti a fine anno. Salari dei chierici e messa: fasi successive.</div></div>';
  }
  function bindPanel(root){
    if(!root)return;
    root.querySelectorAll('[data-church-gift]').forEach(b=>b.onclick=()=>{
      if(!donate(Number(b.dataset.churchGift))){if(typeof status==='function')status('Oro del castello insufficiente');return}
      if(typeof scheduleLocalSave==='function')scheduleLocalSave(200);
      if(typeof renderFunctionPanel==='function')renderFunctionPanel();
      if(typeof renderUI==='function')renderUI();
    });
  }
  window.ConquerChurch=Object.freeze({OFFERING_PER_HEAD,CAPACITY,BEQUEST_SHARE,BEQUEST_MIN_HAPPINESS,GIFTS,
    state,churches,seat,capacity,worshipYield,servedShare,offerings,daily,monthly,annual,donate,snapshot,
    panelHtml,bindPanel});
})();
