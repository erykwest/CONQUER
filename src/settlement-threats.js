'use strict';
// CONQUER — threat generator. Once a game day it rolls, for every kind of
// threat, a probability shaped by the state of the settlement, and makes the
// winner appear through its own module:
//   lupi      ConquerWolves.spawnPack      woods; winter brings more packs
//   orso      ConquerWolves.spawnBear      woods; never in winter (hibernating)
//   briganti  ConquerOutlaws.spawn         built roads to the border; wealth draws them
//   banditi   ConquerOutlaws.spawn         a wood for the lair; a bigger village draws them
//   predoni   ConquerOutlaws.spawn         outlying buildings; full stores, harvest time
// Difficulty (Tranquilla / Normale / Dura) scales frequency, band size, the
// grace period after founding and how many wolf packs may roam at once.
// The player is warned by a banner with «Vai» (centres the view) and a log.
// Rolls are deterministic per seed and day: the same game gives the same events.
(function(){
  const TYPES=Object.freeze({
    wolves:{label:'Lupi',icon:'🐺'},
    bear:{label:'Orso',icon:'🐻'},
    brigands:{label:'Briganti',icon:'🪓'},
    bandits:{label:'Banditi',icon:'⛺'},
    raiders:{label:'Predoni',icon:'🔥'}
  });
  // Provisional values (to be balanced): base chance per day, days of grace
  // after founding, days of quiet after the previous band of the kind ends.
  const BASE={wolves:.04,bear:.02,brigands:.03,bandits:.025,raiders:.025};
  const GRACE={wolves:2,bear:4,brigands:14,bandits:8,raiders:20};
  const COOLDOWN={wolves:6,bear:20,brigands:12,bandits:30,raiders:16};
  const DIFFICULTY=Object.freeze({
    easy:{label:'Tranquilla',freq:.5,size:-1,grace:1.5,packs:1},
    normal:{label:'Normale',freq:1,size:0,grace:1,packs:2},
    hard:{label:'Dura',freq:1.7,size:2,grace:.6,packs:3}
  });
  const ORDER=['wolves','bear','brigands','bandits','raiders'];
  const MAX_CATCHUP=30,LOG_MAX=20,BANNER_MS=15000;
  const C=()=>window.ConquerCombat,W=()=>window.ConquerWolves,O=()=>window.ConquerOutlaws;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const finite=v=>Number.isFinite(Number(v))?Number(v):0;
  const hash=s=>{
    let h=2166136261;
    for(const ch of 'threat:'+s){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}
    h^=h>>>15;h=Math.imul(h,2246822507);h^=h>>>13;h=Math.imul(h,3266489909);h^=h>>>16;
    return(h>>>0)/4294967296;
  };
  const founded=()=>!!(State.village?.founded&&State.structures.some(s=>s.id===State.village.wellId&&s.type==='well'));
  const well=()=>State.structures.find(s=>s.id===State.village?.wellId&&s.type==='well');
  const today=()=>finite(State.clock?.day);
  function state(){return C()?.threatState?.()||null}
  const level=()=>DIFFICULTY[state()?.difficulty]||DIFFICULTY.normal;

  // ---- the settlement as the generator sees it --------------------------
  function season(day){
    if(typeof calendarDateFromDay!=='function'||typeof seasonForMonth!=='function')return'summer';
    return seasonForMonth(calendarDateFromDay(day).month);
  }
  function context(day){
    const e=window.ConquerEconomy?.state?.()||{},w=well();
    const goods=['food','wood','stone','metal','clay'].reduce((n,g)=>n+finite(e.castle?.[g]),0);
    const pop=Object.values(window.ConquerEconomy?.population?.()||{}).reduce((a,b)=>a+finite(b),0);
    const shops=Object.keys(window.ConquerCommerce?.snapshot?.()?.shops||{}).length;
    const outlying=w?State.structures.filter(s=>Number.isFinite(s.x)&&!s.a&&s.type!=='well'&&
      s.type!=='road'&&Math.hypot(s.x-w.x,s.y-w.y)>14&&(typeof underConstruction!=='function'||!underConstruction(s))).length:0;
    return{day,season:season(day),gold:finite(e.castleGold),goods,pop,shops,outlying,
      forest:(State.environment||[]).some(f=>f.type==='forest'),census:W()?.census?.()||{packs:0,bears:0}};
  }
  // Why a kind cannot appear today (null: it can), and its chance if it can.
  function blocker(type,ctx,st){
    const lv=level(),since=ctx.day-finite(st.foundedDay);
    if(since<GRACE[type]*lv.grace)return'periodo di grazia';
    const last=type==='wolves'||type==='bear'?st.last[type]:O()?.lastEnded?.(type)??st.last[type];
    if(Number.isFinite(last)&&ctx.day-last<COOLDOWN[type])return'appena avvenuto';
    if(type==='wolves'){
      if(!W()?.spawnPack)return'modulo assente';
      if(ctx.census.packs>=lv.packs)return'branchi al completo';
      return null;
    }
    if(type==='bear'){
      if(!W()?.spawnBear)return'modulo assente';
      if(ctx.census.bears>0)return'orso già presente';
      if(ctx.season==='winter')return'in letargo';
      if(!ctx.forest)return'nessun bosco';
      return null;
    }
    if(!O()?.feasible)return'modulo assente';
    if(O().active(type))return'banda già attiva';
    if(!O().feasible(type))return type==='brigands'?'nessuna strada al confine':type==='bandits'?'nessun bosco':'nessun edificio isolato';
    return null;
  }
  function chance(type,ctx){
    let p=BASE[type];
    if(type==='wolves'){
      p*=ctx.season==='winter'?2.5:ctx.season==='autumn'?1.4:1;
      if(ctx.census.packs===0)p*=1.5;
    }else if(type==='brigands'){
      // Gold and trade draw robbers to the roads.
      p*=clamp(ctx.gold/250,.5,2.5)*(1+Math.min(1,ctx.shops/10));
    }else if(type==='bandits'){
      p*=clamp(1+ctx.pop/40,1,2.5);
    }else if(type==='raiders'){
      p*=clamp(ctx.outlying/3,.5,2)*clamp(ctx.goods/300,.5,2)*(ctx.season==='autumn'?1.4:1);
    }
    return clamp(p*level().freq,0,.5);
  }
  function odds(day=Math.floor(today())){
    const st=state();if(!st||!founded())return{};
    const ctx=context(day),out={};
    for(const type of ORDER){const why=blocker(type,ctx,st);out[type]=why?{p:0,why}:{p:chance(type,ctx),why:null}}
    return out;
  }

  // ---- making it happen ----------------------------------------------------
  const EDGE={north:'nord',south:'sud',east:'est',west:'ovest'};
  function sizeFor(type,day){
    const lv=level(),range=type==='wolves'?[3,6]:O()?.TYPES?.[type]?.size;
    if(!range||type==='bear')return null;
    const base=range[0]+Math.floor(hash(State.seed+':size:'+type+':'+day)*(range[1]-range[0]+1));
    return Math.max(3,base+lv.size);
  }
  function make(type,day,{forced=false}={}){
    const size=sizeFor(type,day),key=State.seed+':'+type+':'+day+(forced?':f'+(state().log.length):'');
    if(type==='wolves'){
      const r=W()?.spawnPack?.({size,key});if(!r)return null;
      return{at:r.center,text:'Un branco di '+r.size+' lupi si è stabilito nei boschi: di notte cacciano i soldati isolati'};
    }
    if(type==='bear'){
      const r=W()?.spawnBear?.({key});if(!r)return null;
      return{at:r.center,text:'Un orso ha preso una tana nel bosco: attacca chi si avvicina'};
    }
    const band=O()?.spawn?.(type,{quiet:true,size});if(!band)return null;
    const men=C().enemy().filter(e=>e.outlawBand===band.id).length;
    if(type==='brigands')return{at:band.post,text:men+' briganti tengono la strada '+(EDGE[band.edge]||band.edge)+': derubano i mercanti, gli scambi calano'};
    if(type==='bandits')return{at:band.center,text:'Un covo di '+men+' banditi nel bosco: taglieggiano il villaggio ogni settimana'};
    return{at:band.entry,text:men+' predoni dal confine '+(EDGE[band.edge]||band.edge)+': puntano agli edifici isolati'};
  }
  function record(type,ev,day,kind='spawn'){
    const st=state();
    const entry={day:Math.floor(day),type,kind,text:ev.text,x:ev.at?.x??null,y:ev.at?.y??null};
    st.log.unshift(entry);if(st.log.length>LOG_MAX)st.log.length=LOG_MAX;
    if(kind==='spawn')st.last[type]=day;
    if(typeof status==='function')status(ev.text);
    banner(entry);renderPanel(true);
    return entry;
  }
  // One day: each kind rolls; at most one new threat a day (the luckiest roll).
  function rollDay(day){
    const st=state(),ctx=context(day);
    let best=null;
    for(const type of ORDER){
      if(blocker(type,ctx,st))continue;
      const p=chance(type,ctx),r=hash(State.seed+':roll:'+type+':'+day);
      if(r<p&&(!best||r/p<best.score))best={type,score:r/p};
    }
    if(!best)return null;
    const ev=make(best.type,day);
    return ev?record(best.type,ev,day):null;
  }
  function tick(){
    const st=state();if(!st||!founded())return;
    const day=Math.floor(today());
    if(!Number.isFinite(st.foundedDay))st.foundedDay=day;
    if(!Number.isFinite(st.lastDay)){st.lastDay=day;return}
    if(day<=st.lastDay)return;
    // Fast speeds can cross several days in a frame: roll each of them.
    const from=Math.max(st.lastDay+1,day-MAX_CATCHUP+1);
    st.lastDay=day;
    try{for(let d=from;d<=day;d++)rollDay(d)}catch(err){console.error('CONQUER_THREATS_ERROR',err)}
    renderPanel();
  }
  // Developer / test: make one appear now, through the same path and warnings.
  function force(type){
    if(!TYPES[type]||!state()||!founded())return null;
    const day=Math.floor(today()),ev=make(type,day,{forced:true});
    return ev?record(type,ev,day):null;
  }
  // Outlaw bands report their end: logged, and the cooldown counts from it.
  function ended(type,outcome,band){
    if(!state())return;
    const texts={
      brigands:{destroyed:'Strada liberata dai briganti: i commerci riprendono'},
      bandits:{destroyed:'Covo dei banditi distrutto'+(band?.stash?': recuperati '+Math.round(band.stash)+' oro':'')},
      raiders:{destroyed:'Predoni sterminati'+(band?.lootTotal?': il bottino torna al castello':''),escaped:'I predoni sono fuggiti oltre il confine'+(band?.lootTotal?' col bottino':'')}
    };
    const text=texts[type]?.[outcome];if(!text)return;
    const at=band?.center||band?.post||band?.entry||null;
    record(type,{text,at},today(),'end');
  }

  // ---- UI: banner, log, difficulty ------------------------------------------
  function focus(entry){
    if(!Number.isFinite(entry?.x)||typeof w2s!=='function')return;
    const canvas=document.getElementById('c'),r=canvas?.getBoundingClientRect();if(!r)return;
    const s=w2s({x:entry.x,y:entry.y},0);
    State.view.x+=r.width/2-s.x;State.view.y+=r.height/2-s.y;
    if(typeof draw==='function')draw();
  }
  let bannerTimer=null;
  function banner(entry){
    if(typeof document==='undefined')return;
    let el=document.getElementById('threatBanner');
    if(!el){
      el=document.createElement('div');el.id='threatBanner';el.setAttribute('role','alert');
      el.innerHTML='<span class="tb-icon"></span><span class="tb-text"></span><button type="button" class="tb-go">Vai</button><button type="button" class="tb-close" aria-label="Chiudi">×</button>';
      document.body.appendChild(el);
      el.querySelector('.tb-close').onclick=()=>{el.dataset.open='0'};
    }
    el.querySelector('.tb-icon').textContent=TYPES[entry.type]?.icon||'⚠';
    el.querySelector('.tb-text').textContent=entry.text;
    el.dataset.kind=entry.kind;
    const go=el.querySelector('.tb-go');go.hidden=!Number.isFinite(entry.x);
    go.onclick=()=>{focus(entry);el.dataset.open='0'};
    el.dataset.open='1';
    clearTimeout(bannerTimer);bannerTimer=setTimeout(()=>{el.dataset.open='0'},BANNER_MS);
  }
  let lastPanel='';
  function renderPanel(force=false){
    if(typeof document==='undefined')return;
    const box=document.getElementById('combatThreats');if(!box)return;
    const st=state();if(!st)return;
    const o=founded()?odds():{};
    const oddsText=ORDER.map(t=>TYPES[t].label+' '+(o[t]?(o[t].why?'—':(o[t].p*100).toFixed(1)+'%'):'—')).join(' · ');
    const sig=st.difficulty+'|'+oddsText+'|'+st.log.length+'|'+(st.log[0]?.text||'');
    if(!force&&sig===lastPanel)return;lastPanel=sig;
    box.querySelector('[data-threat-difficulty]').value=st.difficulty;
    box.querySelector('.threat-odds').textContent='Probabilità oggi: '+oddsText;
    const list=box.querySelector('.threat-log');list.textContent='';
    for(const entry of st.log.slice(0,6)){
      const row=document.createElement('div');row.className='threat-row';
      row.textContent='g.'+entry.day+' '+(TYPES[entry.type]?.icon||'')+' '+entry.text;
      if(Number.isFinite(entry.x)){const b=document.createElement('button');b.type='button';b.textContent='Vai';b.onclick=()=>focus(entry);row.appendChild(b)}
      list.appendChild(row);
    }
    if(!st.log.length)list.textContent='Nessun evento ancora';
  }
  function mountUi(){
    if(typeof document==='undefined')return;
    const style=document.createElement('style');
    style.textContent='#threatBanner{position:fixed;top:132px;left:50%;transform:translate(-50%,-140%);z-index:90;display:flex;align-items:center;gap:10px;max-width:min(640px,calc(100vw - 32px));'+
      'padding:10px 12px;border-radius:10px;background:#2a1b14;color:#f6e7d0;border:1px solid #c0563e;box-shadow:0 8px 24px rgba(0,0,0,.45);font-size:13px;transition:transform .25s}'+
      '#threatBanner[data-open="1"]{transform:translate(-50%,0)}#threatBanner[data-kind="end"]{border-color:#5c9a5a}'+
      '#threatBanner .tb-icon{font-size:20px}#threatBanner .tb-text{flex:1}#threatBanner button{padding:5px 10px;border-radius:6px;border:0;cursor:pointer}'+
      '#threatBanner .tb-go{background:#f2c772;color:#20180c;font-weight:700}#threatBanner .tb-close{background:transparent;color:#f6e7d0;font-size:16px}'+
      '#combatThreats{border-top:1px solid #4a3c2c;margin-top:6px;padding-top:6px}#combatThreats .threat-odds{font-size:10.5px;opacity:.8;margin:4px 0}'+
      '#combatThreats .threat-row{font-size:11px;display:flex;gap:6px;align-items:center;margin:2px 0}#combatThreats .threat-row button{flex:0 0 auto;padding:2px 6px;font-size:10px}';
    document.head.appendChild(style);
    const alarm=document.getElementById('combatAlarm');
    if(!alarm||document.getElementById('combatThreats'))return;
    const box=document.createElement('div');box.id='combatThreats';
    box.innerHTML='<label>Minacce <select data-threat-difficulty>'+
      Object.entries(DIFFICULTY).map(([k,v])=>'<option value="'+k+'">'+v.label+'</option>').join('')+'</select></label>'+
      '<div class="combat-row">'+ORDER.map(t=>'<button type="button" data-threat-force="'+t+'" title="Fa comparire subito: '+TYPES[t].label+'">'+TYPES[t].icon+' '+TYPES[t].label+'</button>').join('')+'</div>'+
      '<div class="threat-odds"></div><div class="threat-log"></div>';
    alarm.insertAdjacentElement('beforebegin',box);
    box.querySelector('[data-threat-difficulty]').onchange=e=>setDifficulty(e.target.value);
    box.addEventListener('click',ev=>{
      const type=ev.target?.dataset?.threatForce;if(!type)return;
      if(!force(type)){
        const why=founded()?blocker(type,context(Math.floor(today())),{...state(),foundedDay:-1e9,last:{}}):'villaggio non fondato';
        if(typeof status==='function')status(TYPES[type].label+': impossibile ora'+(why?' ('+why+')':''));
      }
    });
    renderPanel(true);
  }
  function setDifficulty(d){
    const st=state();if(!st||!DIFFICULTY[d])return false;
    st.difficulty=d;State.dirty=true;if(typeof scheduleLocalSave==='function')scheduleLocalSave();
    renderPanel(true);return true;
  }
  mountUi();

  window.ConquerThreats=Object.freeze({TYPES,DIFFICULTY,BASE,GRACE,COOLDOWN,tick,force,ended,odds,focus,
    difficulty:()=>state()?.difficulty||'normal',setDifficulty,log:()=>state()?.log||[],
    // Read-only, for tests and balancing: why a kind is blocked and its chance today.
    explain:(type,day=Math.floor(today()))=>{const st=state(),ctx=context(day);const why=blocker(type,ctx,st);return{why,p:why?0:chance(type,ctx),ctx}}});
})();
