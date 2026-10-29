'use strict';
// CONQUER feudal post: dated information travels; external provinces are still abstract.
// Transport and periodic reporting run on simulated game days, never wall-clock time.
(function(){
  const EDGES={north:'Feudo del Nord',east:'Feudo dell’Est',south:'Feudo del Sud',west:'Feudo dell’Ovest'};
  const CATEGORIES={economy:'Economia',population:'Popolazione',construction:'Costruzioni',garrison:'Guarnigione',security:'Sicurezza',tribute:'Tributi'};
  const MAX_HISTORY=200;
  const byId=id=>document.getElementById(id);
  const day=()=>Math.max(0,Number(State.clock?.day)||0);
  const validSite=id=>id==='court'||Object.hasOwn(EDGES,id);
  const escape=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  function empty(){return{version:1,sequence:0,provinces:Object.fromEntries(Object.keys(EDGES).map(k=>[k,{pigeonLoft:false}])),letters:[],routines:[]}}
  function state(){
    if(!State.messages||State.messages.version!==1)State.messages=empty();
    const s=State.messages;
    if(!s.provinces||typeof s.provinces!=='object')s.provinces=empty().provinces;
    for(const key of Object.keys(EDGES))if(!s.provinces[key]||typeof s.provinces[key]!=='object')s.provinces[key]={pigeonLoft:false};
    if(!Array.isArray(s.letters))s.letters=[];
    if(!Array.isArray(s.routines))s.routines=[];
    s.sequence=Math.max(0,Math.floor(Number(s.sequence)||0));
    return s;
  }
  function name(id){return id==='court'?(State.village?.name||'Capitale feudale'):EDGES[id]||id}
  function courtLoft(){
    return (State.structures||[]).some(s=>!s.destroyed&&
      (typeof underConstruction!=='function'||!underConstruction(s))&&
      ['tower','built'].includes(s.type)&&Array.isArray(s.functions)&&s.functions.includes('pigeonLoft'));
  }
  function hasLoft(site){return site==='court'?courtLoft():!!state().provinces[site]?.pigeonLoft}
  function distance(from,to){
    // 40U of notional travel beyond each border, matching diplomacy's abstract world layer.
    const courtDistance=site=>site==='court'?0:60;
    return Math.max(1,courtDistance(from)+courtDistance(to));
  }
  function transport(from,to,requested){
    if(requested!=='pigeon'&&requested!=='messenger')return{error:'Trasporto non valido'};
    if(requested==='pigeon'&&(!hasLoft(from)||!hasLoft(to)))
      return{error:'Servono piccionaie operative a entrambe le estremità'};
    return{type:requested,days:requested==='pigeon'?Math.max(.25,distance(from,to)/160):
      Math.max(1,distance(from,to)/22)};
  }
  function date(n){
    const cal=typeof calendarDateFromDay==='function'?calendarDateFromDay(n):null;
    return cal?cal.day+' '+cal.name+' A'+cal.year:'Giorno '+Math.floor(n);
  }
  function dirty(){
    if(typeof markDirty==='function')markDirty(false,false,true);
    if(typeof scheduleLocalSave==='function')scheduleLocalSave(400);
    refreshUI();
  }
  function send(args){
    const from=args?.from||'court',to=args?.to;
    if(!validSite(from)||!validSite(to)||from===to)return{error:'Origine o destinazione non valida'};
    if(!State.village?.founded)return{error:'Fondare prima un insediamento'};
    if(from!=='court'&&to!=='court')return{error:'Le comunicazioni fra province esterne richiedono la World Map'};
    const kind=['order','report','alert'].includes(args.kind)?args.kind:'order';
    const title=String(args.title||'').trim().slice(0,100);
    const body=String(args.body||'').trim().slice(0,2000);
    if(!title||!body)return{error:'Oggetto e testo obbligatori'};
    const path=transport(from,to,args.carrier||'messenger');
    if(path.error)return path;
    // Weather at departure can delay pigeons; once dispatched the ETA is immutable.
    let days=path.days;
    if(path.type==='pigeon'&&typeof currentWeather==='function'){
      const weather=currentWeather();
      if(weather?.kind==='storm')days*=2;
    }
    const s=state(),sentDay=day();
    const letter={id:'message-'+(++s.sequence),from,to,kind,title,body,carrier:path.type,
      sentDay,arrivalDay:sentDay+days,status:'transit',read:false,routineId:args.routineId||null};
    s.letters.push(letter);
    // Never discard in-flight messages from a busy route.
    if(s.letters.length>MAX_HISTORY)
      s.letters.splice(0,s.letters.length-MAX_HISTORY,...s.letters.slice(0,-MAX_HISTORY).filter(m=>m.status==='transit'));
    dirty();
    return letter;
  }
  function report(origin,categories){
    const cats=categories.filter(k=>Object.hasOwn(CATEGORIES,k));
    if(origin!=='court'){
      // A neighboring province has no simulated economy or military state yet.
      return 'Rapporto di '+name(origin)+'\nDati non disponibili: provincia esterna astratta, non simulata.\nSezioni richieste: '+cats.map(k=>CATEGORIES[k]).join(', ')+'.';
    }
    const lines=['Situazione di '+name('court')+' al '+date(day())+' (istantanea alla partenza).'];
    const econ=State.economy||{};
    for(const c of cats){
      if(c==='economy'){
        const stores=econ.castle||State.resources||{},gold=econ.castleGold??State.resources?.gold;
        lines.push('Economia: oro '+Math.round(Number(gold)||0)+', cibo '+Math.round(Number(stores.food)||0)+
          ', legno '+Math.round(Number(stores.wood)||0)+', pietra '+Math.round(Number(stores.stone)||0)+
          ', metallo '+Math.round(Number(stores.metal)||0)+'.');
      }else if(c==='population')lines.push('Popolazione: '+(State.resources?.population??'non disponibile')+'.');
      else if(c==='construction')lines.push('Cantieri attivi: '+(State.structures||[]).filter(s=>s.construction&&(typeof underConstruction!=='function'||underConstruction(s))).length+'.');
      else if(c==='garrison')lines.push('Guarnigione: conteggio non esposto dal dominio militare.');
      else if(c==='security')lines.push('Sicurezza: '+(window.ConquerSiege?.active?.()?'assedio in corso':'nessun allarme confermato dal sistema dei messaggi')+'.');
      else if(c==='tribute')lines.push('Tributi: verificare le carovane nel registro diplomatico.');
    }
    return lines.join('\n');
  }
  function addRoutine(args){
    const from=args?.from||'court',to=args?.to||'court';
    const every=Math.floor(Number(args?.everyDays));
    const cats=Array.isArray(args?.categories)?args.categories.filter(k=>Object.hasOwn(CATEGORIES,k)):[];
    if(!validSite(from)||!validSite(to)||from===to||(from!=='court'&&to!=='court'))
      return{error:'Collegamento feudale non valido'};
    if(![1,7,30].includes(every)||!cats.length)return{error:'Scegli frequenza e almeno una sezione'};
    if(!['pigeon','messenger'].includes(args.carrier))return{error:'Trasporto non valido'};
    const s=state(),routine={id:'routine-'+(++s.sequence),from,to,everyDays:every,
      carrier:args.carrier,categories:[...new Set(cats)],nextDay:day()+every,enabled:true,
      lastError:null};
    s.routines.push(routine);dirty();return routine;
  }
  function removeRoutine(id){const s=state(),n=s.routines.length;s.routines=s.routines.filter(r=>r.id!==id);if(n!==s.routines.length){dirty();return true}return false}
  function setRoutineEnabled(id,enabled){const r=state().routines.find(r=>r.id===id);if(!r)return false;r.enabled=!!enabled;if(r.enabled)r.nextDay=day()+r.everyDays;r.lastError=null;dirty();return true}
  function setProvinceLoft(site,enabled){if(!Object.hasOwn(EDGES,site))return false;state().provinces[site].pigeonLoft=!!enabled;dirty();return true}
  function read(id){const m=state().letters.find(m=>m.id===id&&m.to==='court'&&m.status==='delivered');if(!m)return false;m.read=true;dirty();return m}
  function tick(from,to){
    if(!(to>from))return;
    const s=state();let changed=false;
    for(const r of s.routines){
      if(!r.enabled||!(r.everyDays>0)||!(r.nextDay<=to))continue;
      // One report at the real simulation date, not fictitious snapshots of skipped days.
      const result=send({from:r.from,to:r.to,carrier:r.carrier,kind:'report',routineId:r.id,
        title:'Rapporto '+r.everyDays+'g · '+name(r.from),
        body:report(r.from,r.categories)});
      r.lastError=result.error||null;
      r.nextDay+=Math.max(1,Math.floor((to-r.nextDay)/r.everyDays)+1)*r.everyDays;
      changed=true;
    }
    for(const m of s.letters)if(m.status==='transit'&&m.arrivalDay<=to){m.status='delivered';changed=true}
    if(changed)dirty();
  }
  function reset(){State.messages=empty();const panel=byId('messagesDialog');if(panel)panel.hidden=true;dirty()}
  function refreshUI(){
    const s=state(),unread=s.letters.filter(m=>m.to==='court'&&m.status==='delivered'&&!m.read).length;
    const btn=byId('messagesOpen');
    if(btn)btn.textContent='✉️ Posta feudale'+(unread?' ('+unread+')':'');
    if(byId('messagesDialog')&&!byId('messagesDialog').hidden)render();
  }
  let tab='inbox';
  function render(){
    const host=byId('messagesBody');if(!host)return;
    const s=state();
    byId('messagesTitle').textContent='✉️ Posta feudale — '+name('court');
    const tabs='<nav class="messages-tabs">'+[['inbox','Ricevuti'],['sent','Inviati'],['routines','Routine'],['network','Rete']].map(([k,label])=>
      '<button type="button" data-messages-tab="'+k+'" '+(tab===k?'class="active"':'')+'>'+label+'</button>').join('')+'</nav>';
    let content='';
    if(tab==='inbox'||tab==='sent'){
      const letters=s.letters.filter(m=>tab==='inbox'?m.to==='court':m.from==='court').slice().reverse();
      content='<div class="messages-list">'+(letters.length?letters.map(m=>{
        const unread=tab==='inbox'&&m.status==='delivered'&&!m.read;
        return '<article class="messages-item '+(unread?'messages-unread':'')+'"><div><strong>'+escape(m.title)+'</strong>'+
          '<small>'+escape(name(tab==='inbox'?m.from:m.to))+' · '+escape(m.carrier==='pigeon'?'Piccione':'Messaggero')+
          ' · '+escape(m.status==='transit'?'In viaggio':m.status==='delivered'?'Consegnato':'Disperso')+'</small>'+
          '<small>Redatto: '+escape(date(m.sentDay))+' · Arrivo previsto: '+escape(date(m.arrivalDay))+'</small></div>'+
          '<p>'+escape(m.body)+'</p>'+(unread?'<button type="button" data-messages-read="'+escape(m.id)+'">Segna letto</button>':'')+'</article>';
      }).join(''):'<p>Nessuna lettera.</p>')+'</div>'+
      (tab==='sent'?'<div class="messages-form"><h3>Invia una comunicazione</h3>'+
        '<label>Destinazione<select id="messagesTo">'+Object.keys(EDGES).map(k=>'<option value="'+k+'">'+escape(name(k))+'</option>').join('')+'</select></label>'+
        '<label>Tipo<select id="messagesKind"><option value="order">Ordine</option><option value="alert">Allarme</option><option value="report">Rapporto</option></select></label>'+
        '<label>Trasporto<select id="messagesCarrier"><option value="messenger">Messaggero</option><option value="pigeon">Piccione</option></select></label>'+
        '<label>Oggetto<input id="messagesSubject" maxlength="100" value=""></label>'+
        '<label>Testo<textarea id="messagesText" rows="3" maxlength="2000"></textarea></label>'+
        '<button type="button" id="messagesSend">Spedisci</button>'+
        '<p class="messages-hint">Gli ordini arrivano con ritardo; l’esecuzione in province esterne sarà disponibile con la World Map.</p></div>':'');
    }else if(tab==='routines'){
      content='<div class="messages-list">'+(s.routines.length?s.routines.map(r=>'<article class="messages-item"><b>'+
        escape(name(r.from))+' → '+escape(name(r.to))+'</b><small>Ogni '+r.everyDays+' giorni · '+
        escape(r.carrier==='pigeon'?'piccione':'messaggero')+' · prossimo '+escape(date(r.nextDay))+'</small>'+
        '<p>'+r.categories.map(k=>escape(CATEGORIES[k])).join(' · ')+'</p>'+
        (r.lastError?'<p class="messages-error">'+escape(r.lastError)+'</p>':'')+
        '<button type="button" data-messages-toggle="'+escape(r.id)+'">'+(r.enabled?'Sospendi':'Riattiva')+'</button> '+
        '<button type="button" data-messages-remove="'+escape(r.id)+'">Elimina</button></article>').join(''):
        '<p>Nessuna routine programmata.</p>')+'</div>'+
        '<div class="messages-form"><h3>Nuova routine</h3>'+
        '<label>Mittente<select id="messagesRoutineFrom"><option value="court">'+escape(name('court'))+'</option>'+
        Object.keys(EDGES).map(k=>'<option value="'+k+'">'+escape(name(k))+'</option>').join('')+'</select></label>'+
        '<label>Destinatario<select id="messagesRoutineTo"><option value="north">'+escape(name('north'))+'</option><option value="court">'+escape(name('court'))+'</option></select></label>'+
        '<label>Frequenza<select id="messagesFrequency"><option value="1">Giornaliera</option><option value="7" selected>Settimanale</option><option value="30">Ogni 30 giorni</option></select></label>'+
        '<label>Trasporto<select id="messagesRoutineCarrier"><option value="messenger">Messaggero</option><option value="pigeon">Piccione</option></select></label>'+
        '<fieldset><legend>Sezioni del rapporto</legend>'+Object.entries(CATEGORIES).map(([k,v])=>
          '<label class="messages-check"><input type="checkbox" data-messages-cat="'+k+'" '+(['economy','construction','security'].includes(k)?'checked':'')+'>'+escape(v)+'</label>').join('')+'</fieldset>'+
        '<button type="button" id="messagesAddRoutine">Programma routine</button>'+
        '<p class="messages-hint">Le province esterne sono ancora astratte: i loro rapporti non inventano statistiche.</p></div>';
    }else{
      content='<p class="messages-hint">La piccionaia del giocatore è una funzione di una torre o Built Section completata. Per gli altri feudi configura la disponibilità della piccionaia, in attesa della simulazione della World Map.</p>'+
        '<p>Piccionaia alla corte: <strong>'+(courtLoft()?'Operativa':'Assente')+'</strong></p>'+
        '<div class="messages-list">'+Object.keys(EDGES).map(k=>'<label class="messages-check"><input type="checkbox" data-messages-loft="'+k+'" '+(s.provinces[k].pigeonLoft?'checked':'')+'>'+escape(name(k))+' · piccionaia collegata</label>').join('')+'</div>'+
        '<p class="messages-hint">I piccioni richiedono una piccionaia ad entrambe le estremità. I messaggeri restano disponibili anche senza.</p>';
    }
    host.innerHTML=tabs+content;
    const from=byId('messagesRoutineFrom'),to=byId('messagesRoutineTo');
    if(from&&to&&from.value!=='court')to.value='court';
  }
  function open(){byId('messagesDialog').hidden=false;render()}
  function close(){byId('messagesDialog').hidden=true}
  function init(){
    const host=document.createElement('div');host.id='messagesHost';
    host.innerHTML='<div id="messagesDialog" class="diplomacy-backdrop" hidden role="presentation"><section class="diplomacy-panel diplomacy-wide messages-panel" role="dialog" aria-modal="true" aria-labelledby="messagesTitle">'+
      '<h2 id="messagesTitle">✉️ Posta feudale</h2><div id="messagesBody"></div><div class="diplomacy-actions"><button type="button" id="messagesClose">Chiudi</button></div></section></div>';
    document.getElementById('wrap').appendChild(host);
    byId('messagesOpen')?.addEventListener('click',open);
    byId('messagesClose').addEventListener('click',close);
    byId('messagesDialog').addEventListener('change',e=>{
      const t=e.target;
      if(t.matches('[data-messages-loft]'))setProvinceLoft(t.dataset.messagesLoft,t.checked);
      if(t.id==='messagesRoutineFrom'){
        const dest=byId('messagesRoutineTo');
        dest.innerHTML=t.value==='court'?Object.keys(EDGES).map(k=>'<option value="'+k+'">'+escape(name(k))+'</option>').join(''):
          '<option value="court">'+escape(name('court'))+'</option>';
      }
    });
    byId('messagesDialog').addEventListener('click',e=>{
      const t=e.target.closest('button');if(!t)return;
      if(t.dataset.messagesTab){tab=t.dataset.messagesTab;render();return}
      if(t.dataset.messagesRead){read(t.dataset.messagesRead);return}
      if(t.dataset.messagesRemove){removeRoutine(t.dataset.messagesRemove);return}
      if(t.dataset.messagesToggle){const r=state().routines.find(r=>r.id===t.dataset.messagesToggle);if(r)setRoutineEnabled(r.id,!r.enabled);return}
      let result=null;
      if(t.id==='messagesSend')result=send({from:'court',to:byId('messagesTo').value,
        carrier:byId('messagesCarrier').value,kind:byId('messagesKind').value,
        title:byId('messagesSubject').value,body:byId('messagesText').value});
      if(t.id==='messagesAddRoutine')result=addRoutine({from:byId('messagesRoutineFrom').value,
        to:byId('messagesRoutineTo').value,everyDays:Number(byId('messagesFrequency').value),
        carrier:byId('messagesRoutineCarrier').value,
        categories:[...byId('messagesDialog').querySelectorAll('[data-messages-cat]:checked')].map(i=>i.dataset.messagesCat)});
      if(result){
        if(result.error){if(typeof status==='function')status(result.error)}
        else{if(typeof status==='function')status('Posta feudale aggiornata');render()}
      }
    });
    refreshUI();
  }
  window.ConquerMessages={state,send,report,transport,addRoutine,removeRoutine,setRoutineEnabled,setProvinceLoft,read,tick,reset,refreshUI,open,hasLoft};
  if(!window.__CONQUER_ASSET_LAB__)init();
})();