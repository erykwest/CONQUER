'use strict';
// CONQUER Economy V1: aggregate cohorts, deterministic periodic accounting.
// Builder test resources deliberately remain separate from economic inventories.
(() => {
  const GOODS = Object.freeze(['food','wood','stone','metal','equipment','luxury']);
  const BASE = Object.freeze({food:2,wood:3,stone:4,metal:7,equipment:17,luxury:20});
  const TARGET = Object.freeze({food:100,wood:70,stone:70,metal:35,equipment:30,luxury:10});
  const KIND = Object.freeze({
    field:{good:'food',classId:2,workers:1,build:20},
    loggingCamp:{good:'wood',classId:1,workers:2,rate:2,build:45},
    quarry:{good:'stone',classId:2,workers:2,rate:2,build:65},
    mine:{good:'stone',classId:2,workers:2,rate:2,build:95},
    workshop:{good:'equipment',classId:3,workers:1,rate:.5,inputs:{metal:.6,wood:.3},build:130},
    vineyard:{good:'luxury',classId:2,workers:2,build:90}
  });
  const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
  const finite=(v,d=0)=>Number.isFinite(+v)?+v:d;
  const round=n=>Math.round(n*1000)/1000;
  const empty=()=>Object.fromEntries(GOODS.map(k=>[k,0]));
  const weekday=day=>((Math.floor(day)%7)+7)%7; // day 0 is Monday
  const classKey=n=>'L'+n;
  const dateAt=day=>typeof calendarDateFromDay==='function'?calendarDateFromDay(day):{month:0,year:1,day:1};
  const complete=s=>!(typeof underConstruction==='function'&&underConstruction(s));
  const population=()=>{
    const counts={L1:0,L2:0,L3:0,L4:0};
    for(const h of State.structures||[])if(h.type==='house'&&complete(h)){
      const lvl=clamp(Math.floor(finite(h.houseLevel,1)),1,4);
      counts[classKey(lvl)]+=lvl*3; // existing housePopulationCapacity contract
    }
    return counts;
  };
  function makeState(){
    return {
      version:1,lastDay:Math.floor(finite(State.clock?.day))-1,castleGold:300,
      castle:empty(),target:{...TARGET},saleShare:Object.fromEntries(GOODS.map(g=>[g,50])),
      lots:Object.fromEntries(GOODS.map(g=>[g,[]])),
      prices:{...BASE},externalDemand:empty(),externalOffers:empty(),
      wallet:{L1:24,L2:40,L3:60,L4:300},welfare:50,
      wage:{L1:1,L2:2,L3:3},activities:{},
      books:{},annual:{},negativeYears:{},lastTrade:{},events:[],
      weeks:0,months:0,years:0
    };
  }
  function state(){
    if(!State.economy||State.economy.version!==1)State.economy=makeState();
    return State.economy;
  }
  function reset(){State.economy=makeState();render(true)}
  function note(e,label){
    e.events.unshift({day:e.lastDay,label});if(e.events.length>25)e.events.length=25;
  }
  function activeStructures(){
    return(State.structures||[]).filter(s=>KIND[s.type]&&complete(s));
  }
  function sync(){
    const e=state();
    const present=new Set((State.structures||[]).filter(s=>KIND[s.type]).map(s=>s.id));
    for(const id of Object.keys(e.activities))if(!present.has(id))delete e.activities[id];
    for(const s of activeStructures()){
      if(!e.activities[s.id]){
        e.activities[s.id]={type:s.type,owner:s.economicOwner==='lord'?'lord':'private',inputs:empty(),cyclesSeen:finite(s.crop?.cycles),lastHarvestYear:0};
      }
      const a=e.activities[s.id];
      if(a.type!==s.type)a.type=s.type;
    }
    return e;
  }
  function put(e,good,quantity,owner,id){
    if(!GOODS.includes(good)||quantity<=0)return;
    if(owner==='lord'){
      const keep=quantity*(100-(e.saleShare[good]||0))/100;
      const received=Math.min(keep,Math.max(0,(e.target[good]||0)-(e.castle[good]||0)));
      e.castle[good]=round(e.castle[good]+received);
      quantity-=received;
    }
    if(quantity>0){
      const existing=e.lots[good].find(l=>l.id===id&&l.owner===owner);
      if(existing)existing.qty=round(existing.qty+quantity);
      else e.lots[good].push({id,owner,qty:round(quantity)});
    }
  }
  function book(e,id,field,value){
    const b=e.books[id]||(e.books[id]={revenue:0,cost:0,tax:0,wages:0});
    b[field]=round((b[field]||0)+value);
  }
  function workerDemand(s){
    const spec=KIND[s.type];
    if(s.type==='field'){
      let slots=1;
      if(typeof fieldLayout==='function')slots=Math.max(1,fieldLayout(s).cells.length);
      return {tier:2,count:slots};
    }
    return {tier:spec.classId,count:spec.workers};
  }
  function activeCapacity(){
    if(window.ConquerJobManager)return window.ConquerJobManager.plan().staffing;
    const pop=population(),limits={L1:Math.floor(pop.L1/3),L2:Math.floor(pop.L2/3),L3:Math.floor(pop.L3/3),L4:pop.L4};
    const remaining={...limits},allocated={};
    // Player-established industries claim workers before automatically generated fields.
    for(const s of activeStructures().sort((a,b)=>(a.type==='field'?1:0)-(b.type==='field'?1:0)||String(a.id).localeCompare(String(b.id)))){
      const req=workerDemand(s),group=classKey(req.tier);
      let count=Math.min(req.count,remaining[group]);
      remaining[group]-=count;
      allocated[s.id]=count;
    }
    return allocated;
  }
  function daily(day){
    const e=sync();if(weekday(day)>=5)return;
    const staffing=activeCapacity(),date=dateAt(day);
    // Husbandry is an L1 occupation, not agriculture. Only staffed
    // goat/sheep households generate food; no hunting or forest gathering.
    const jobs=window.ConquerJobManager?.plan(day);
    if(jobs)for(const [houseId,job] of jobs.assigned)
      if(job.kind==='herding')put(e,'food',.9,'private',houseId+':herd');
    for(const s of activeStructures()){
      const a=e.activities[s.id],spec=KIND[s.type],staff=staffing[s.id]||0;
      if(!staff||s.economyDisabled||s.destroyed||s.abandoned||a.abandoned)continue;
      if(s.type!=='field'&&(window.ConquerCombat?.alarmMode?.()||'off')!=='off')continue;
      if(s.type==='field'||s.type==='vineyard'){
        // Field visual cycles are tracked independently. Economic harvest occurs
        // at most once per autumn, provided a completed cultivation cycle exists.
        if(date.month<8||date.month>9||a.lastHarvestYear===date.year)continue;
        if(s.type==='field'&&finite(s.crop?.cycles)<=a.cyclesSeen)continue;
        const area=s.type==='field'&&typeof fieldLayout==='function'
          ?fieldLayout(s).area:Math.max(4,finite(s.w,3)*finite(s.h,2));
        const quantity=round(area*(s.type==='field'?2.5:1.1)*Math.min(1,staff/workerDemand(s).count));
        if(quantity<=0)continue;
        put(e,spec.good,quantity,a.owner,s.id);
        a.cyclesSeen=finite(s.crop?.cycles,a.cyclesSeen);
        a.lastHarvestYear=date.year;
        continue;
      }
      let produced=round(spec.rate*staff/Math.max(1,spec.workers));
      if(spec.inputs){
        for(const [good,need] of Object.entries(spec.inputs)){
          produced=Math.min(produced,(a.inputs[good]||0)/need*spec.rate);
        }
        produced=Math.max(0,produced);
        for(const [good,need] of Object.entries(spec.inputs)){
          a.inputs[good]=round(Math.max(0,(a.inputs[good]||0)-produced/spec.rate*need));
        }
      }
      if(produced>0)put(e,spec.good,produced,a.owner,s.id);
    }
  }
  function fulfill(e,good,amount,consumer){
    let remaining=amount,spent=0;
    const price=e.prices[good];
    for(const lot of e.lots[good]){
      if(remaining<=.000001)break;
      const affordable=consumer?Math.max(0,e.wallet[consumer]||0)/Math.max(.01,price):Infinity;
      const sold=Math.min(remaining,lot.qty,affordable);
      if(sold<=0)continue;
      lot.qty=round(Math.max(0,lot.qty-sold));
      const gross=round(sold*price);
      const tax=round(gross*clamp(finite(State.policies?.tax,0),0,100)/100);
      if(consumer)e.wallet[consumer]=round(Math.max(0,e.wallet[consumer]-gross));
      if(lot.owner==='lord')e.castleGold=round(finite(e.castleGold)+gross);
      else e.wallet.L4=round(e.wallet.L4+gross-tax);
      e.castleGold=round(finite(e.castleGold)+tax*(lot.owner==='private'?1:0));
      book(e,lot.id,'revenue',gross);
      if(lot.owner==='private')book(e,lot.id,'tax',tax);
      spent+=gross;remaining-=sold;
    }
    e.lots[good]=e.lots[good].filter(l=>l.qty>.000001);
    return{sold:amount-remaining,spent};
  }
  function market(day){
    const e=sync(),pop=population();
    const demand={food:0,wood:0,stone:0,metal:0,equipment:0,luxury:0};
    for(let tier=1;tier<=4;tier++){
      const count=pop[classKey(tier)];
      demand.food+=count*.55;
      if(tier===3)demand.luxury+=count*.08;
      if(tier===4)demand.luxury+=count*.25;
    }
    // Input demand from workshops based on next week's production.
    const staffing=activeCapacity();
    for(const s of activeStructures())if(KIND[s.type].inputs){
      const a=e.activities[s.id],spec=KIND[s.type];
      for(const [good,need] of Object.entries(spec.inputs))demand[good]+=need*5*(staffing[s.id]||0)/Math.max(1,spec.workers);
    }
    for(const good of GOODS){
      const supply=e.lots[good].reduce((sum,l)=>sum+l.qty,0);
      const pressure=(demand[good]+Math.max(0,finite(e.externalDemand[good]))+1)/(supply+1);
      e.prices[good]=round(BASE[good]*clamp(Math.sqrt(pressure),.4,2.5));
    }
    const last={day,domestic:{},exports:{},unmet:{}};
    // Household consumption is a weekly market purchase by an aggregate cohort.
    for(let tier=1;tier<=4;tier++){
      const group=classKey(tier),count=pop[group],want=count*.55;
      const bought=fulfill(e,'food',want,group);
      last.domestic.food=(last.domestic.food||0)+bought.sold;
      last.unmet[group]=round(Math.max(0,want-bought.sold));
      if(tier>=3){
        const luxury=fulfill(e,'luxury',count*(tier===3?.08:.25),group);
        last.domestic.luxury=(last.domestic.luxury||0)+luxury.sold;
      }
    }
    for(const s of activeStructures())if(KIND[s.type].inputs){
      const a=e.activities[s.id],spec=KIND[s.type];
      for(const [good,need] of Object.entries(spec.inputs)){
        const qty=Math.max(0,need*5-(a.inputs[good]||0));
        // Material purchases are paid by the owning sector, not households.
        const buyer=a.owner==='lord'?'castle': 'L4';
        const available=buyer==='castle'?finite(e.castleGold):finite(e.wallet.L4);
        const budget=available;
        const purchased=fulfill(e,good,Math.min(qty,budget/Math.max(.01,e.prices[good])),null);
        if(purchased.spent>0){
          if(buyer==='castle')e.castleGold=round(finite(e.castleGold)-purchased.spent);
          else e.wallet.L4=round(Math.max(0,e.wallet.L4-purchased.spent));
          book(e,s.id,'cost',purchased.spent);
        }
        a.inputs[good]=round((a.inputs[good]||0)+purchased.sold);
        last.domestic[good]=(last.domestic[good]||0)+purchased.sold;
      }
    }
    // Export is demand-constrained. Missing external buyers never absorb surplus.
    for(const good of GOODS){
      const exports=fulfill(e,good,Math.max(0,finite(e.externalDemand[good])),null);
      last.exports[good]=round(exports.sold);
    }
    e.lastTrade=last;e.weeks++;
    const wanted=demand.food||0,unmet=Object.values(last.unmet).reduce((s,n)=>s+n,0);
    e.welfare=clamp(round(e.welfare+(wanted>0?(1-2*unmet/wanted)*.6:0)),0,100);
  }
  function monthly(day){
    const e=sync(),staff=activeCapacity(),grouped={L1:0,L2:0},pop=population();
    for(const s of activeStructures()){
      const spec=KIND[s.type],a=e.activities[s.id];
      if(!a||spec.classId>2)continue;
      const group=classKey(spec.classId),due=round((staff[s.id]||0)*e.wage[group]);
      if(!due)continue;
      const available=a.owner==='lord'?finite(e.castleGold):finite(e.wallet.L4);
      const paid=Math.min(due,Math.max(0,available));
      if(a.owner==='lord')e.castleGold=round(finite(e.castleGold)-paid);
      else e.wallet.L4=round(Math.max(0,e.wallet.L4-paid));
      grouped[group]+=paid;book(e,s.id,'wages',paid);
    }
    for(const [group,paid] of Object.entries(grouped))e.wallet[group]=round(e.wallet[group]+paid);
    e.months++;
    // L4 reviews opportunities monthly but no off-map businesses are fabricated.
    // New enterprise building placement is a separate world/urban feature.
    e.investmentCapacity=round(Math.max(0,e.wallet.L4-50));
    e.populationSnapshot=pop;
  }
  function annual(day){
    const e=sync(),summary={};
    for(const [id,a] of Object.entries(e.activities)){
      const b=e.books[id]||{revenue:0,cost:0,tax:0,wages:0};
      const profit=round(b.revenue-b.cost-b.tax-b.wages);
      const margin=b.revenue>0?profit/b.revenue:-1;
      const negative=profit<0||(a.type==='workshop'&&profit<e.wage.L3);
      a.negativeYears=negative?(a.negativeYears||0)+1:0;
      a.margin=round(margin);a.profit=profit;
      const limit=a.type==='field'?3:2;
      if(a.owner==='private'&&a.negativeYears>=limit){a.abandoned=true;note(e,a.type+' '+id+' abandoned after '+limit+' years')}
      summary[id]={profit,margin:a.margin,negativeYears:a.negativeYears};
    }
    e.annual=summary;e.books={};e.years++;
    const factor=.5+e.welfare/100;
    e.wage={L1:round(factor),L2:round(2*factor),L3:round(3*factor)};
  }
  function tick(from,to){
    const e=sync(),end=Math.floor(finite(to));
    let start=Math.max(e.lastDay+1,0);
    if(end-start>3650){start=end-3650;note(e,'Economy backlog truncated to ten years')}
    for(let day=start;day<=end;day++){
      e.lastDay=day;
      daily(day);
      if(weekday(day)===5)market(day); // Saturday market; no civilian production
      const today=dateAt(day),tomorrow=dateAt(day+1);
      if(today.month!==tomorrow.month||today.year!==tomorrow.year)monthly(day);
      if(today.year!==tomorrow.year)annual(day);
    }
  }
  function setShare(good,pct){
    if(!GOODS.includes(good)||![0,25,50,75,100].includes(+pct))return false;
    const e=state();e.saleShare[good]=+pct;render(true);return true;
  }
  function setTarget(good,value){
    if(!GOODS.includes(good))return false;
    state().target[good]=clamp(Math.round(finite(value)),0,100000);render(true);return true;
  }
  function setExternalDemand(good,qty){
    if(!GOODS.includes(good))return false;
    state().externalDemand[good]=Math.max(0,finite(qty));return true;
  }
  function assetValue(activity){const a=activity;return Math.max(1,Math.round(KIND[a.type].build*(1+clamp(finite(a.margin),-.5,1))))}
  function transfer(id,owner){
    const e=sync(),a=e.activities[id],s=State.structures.find(x=>x.id===id);
    if(!a||!s||!['private','lord'].includes(owner)||a.owner===owner)return false;
    const price=assetValue(a);
    const buyer=owner==='lord'?'castleGold':'L4',seller=a.owner==='lord'?'castleGold':'L4';
    const funds=buyer==='castleGold'?finite(e.castleGold):finite(e.wallet.L4);
    if(funds<price)return false;
    if(buyer==='castleGold')e.castleGold=round(funds-price);
    else e.wallet.L4=round(funds-price);
    if(seller==='castleGold')e.castleGold=round(finite(e.castleGold)+price);
    else e.wallet.L4=round(e.wallet.L4+price);
    a.owner=owner;s.economicOwner=owner;
    note(e,'Transferred '+a.type+' for '+price+' gold');render(true);return true;
  }
  function snapshot(){
    const e=sync();
    const stocks=Object.fromEntries(GOODS.map(g=>[g,round(e.lots[g].reduce((sum,l)=>sum+l.qty,0))]));
    return{day:e.lastDay,weekday:weekday(Math.max(0,e.lastDay)),population:population(),
      prices:{...e.prices},castle:{...e.castle},market:stocks,wage:{...e.wage},
      capital:round(e.wallet.L4),castleGold:round(finite(e.castleGold)),
      welfare:e.welfare,activities:Object.keys(e.activities).length,
      weeks:e.weeks,months:e.months,years:e.years};
  }
  function render(force=false){
    const target=typeof document!=='undefined'?document.getElementById('economyOverview'):null;
    if(!target)return;
    const e=sync(),s=snapshot();
    const stamp=s.day+'|'+Object.keys(e.activities).length+'|'+s.welfare+'|'+(target.dataset.force||'');
    if(!force&&target.dataset.stamp===stamp)return;
    target.dataset.stamp=stamp;
    const fmt=n=>Number(n).toLocaleString('it-IT',{maximumFractionDigits:1});
    target.innerHTML='<div class="kv"><span>Welfare / L4 capital</span><b>'+fmt(s.welfare)+' / '+fmt(s.capital)+' gold</b></div>'+
      '<div class="kv"><span>Castle economic gold</span><b>'+fmt(s.castleGold)+'</b></div>'+
      '<div class="kv"><span>Population L1–L4</span><b>'+Object.values(s.population).join(' · ')+'</b></div>'+
      '<div class="legend">Mon–Fri work · Saturday market · Sunday rest. Wages monthly, rates/returns yearly.</div>'+
      '<div class="economy-goods">'+GOODS.map(g=>
        '<div class="economy-good"><b>'+g+'</b><small>Price '+fmt(s.prices[g])+' · market '+fmt(s.market[g])+
        ' · castle '+fmt(s.castle[g])+'</small><label>Sell <select data-econ-sale="'+g+'">'+
        [0,25,50,75,100].map(n=>'<option value="'+n+'"'+(e.saleShare[g]===n?' selected':'')+'>'+n+'%</option>').join('')+
        '</select></label><label>Reserve <input data-econ-target="'+g+'" type="number" min="0" step="10" value="'+e.target[g]+'"></label></div>'
      ).join('')+'</div><div class="legend">Private property is held by the aggregate L4 sector. Trading transfers whole activities, never named citizens.</div>'+
      '<div class="economy-assets">'+Object.entries(e.activities).filter(([id])=>State.structures.some(s=>s.id===id)).slice(0,12).map(([id,a])=>
        '<div class="economy-asset">'+a.type+' · '+(a.owner==='lord'?'Lord':'L4')+' · '+assetValue(a)+' gold '+
        '<button type="button" data-econ-transfer="'+id+'" data-econ-owner="'+(a.owner==='lord'?'private':'lord')+'">'+(a.owner==='lord'?'Sell to L4':'Buy for lord')+'</button></div>'
      ).join('')+'</div>';
  }
  function bind(){
    const target=document.getElementById('economyOverview');
    if(!target)return;
    target.addEventListener('change',event=>{
      const node=event.target;
      const good=node.dataset.econSale||node.dataset.econTarget;
      if(node.dataset.econSale)setShare(good,node.value);
      else if(node.dataset.econTarget)setTarget(good,node.value);
      if(typeof scheduleLocalSave==='function')scheduleLocalSave(200);
    });
    target.addEventListener('click',event=>{const button=event.target.closest('[data-econ-transfer]');if(!button)return;
      if(!transfer(button.dataset.econTransfer,button.dataset.econOwner)){if(typeof status==='function')status('Insufficient economic capital for enterprise transfer');return}
      if(typeof scheduleLocalSave==='function')scheduleLocalSave(200);
    });
    render(true);
  }
  window.ConquerEconomy=Object.freeze({GOODS,KIND,weekday,state,reset,sync,tick,render,bind,staffing:activeCapacity,
    setShare,setTarget,setExternalDemand,transfer,snapshot,population});
})();
