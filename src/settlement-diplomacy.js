'use strict';
// Diplomatic courier and caravan domain. The outside province is abstract until the world-map layer exists.
(function(){
  const DAYS_PER_COURIER_UNIT=1/22;
  // Caravans are lord convoys of ConquerConvoys: gold in the chest, each good in its own wagon.
  const GOODS=['gold','food','wood','stone','clay','metal','equipment'];
  const LABELS={gold:'Monete',food:'Cibo',wood:'Legno',stone:'Pietra',clay:'Argilla',metal:'Metallo',equipment:'Equipaggiamento'};
  const EDGES={north:'Nord',south:'Sud',east:'Est',west:'Ovest'};
  const DEFAULT_REQUEST=100;
  const byId=id=>document.getElementById(id);
  const num=(v,def=0)=>Number.isFinite(+v)?+v:def;
  function hash(s){let h=2166136261;for(const ch of String(s)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
  const choice=(seed,max)=>hash(seed)%max;
  const day=()=>Math.max(0,num(State.clock.day));
  function makeState(){return {version:1,nextEventDay:null,sequence:0,incoming:null,caravans:[],history:[]}}
  function state(){
    if(!State.diplomacy||State.diplomacy.version!==1)State.diplomacy=makeState();
    const x=State.diplomacy;
    x.caravans=Array.isArray(x.caravans)?x.caravans:[];
    x.history=Array.isArray(x.history)?x.history.slice(-40):[];
    x.sequence=Math.max(0,Math.floor(num(x.sequence)));
    return x;
  }
  function changed(){if(typeof markDirty==='function')markDirty(false,false,true)}
  function reset(){State.diplomacy=makeState();hidePanels();refreshUI()}
  function mastio(){return window.ConquerSiege?.mastio?.()||null}
  function point(s){return {x:num(s?.x,WORLD/2),y:num(s?.y,WORLD/2)}}
  function destination(){return mastio()||State.structures.find(s=>s.type==='well'&&!underConstruction(s))}
  function routeFrom(entry,goal,id){
    // Use the real road graph when its external link has been built; only fall back to a waypoint proxy.
    let route=null;
    try{route=typeof roadNetworkPath==='function'?roadNetworkPath(entry,goal,'courier-'+id):null}catch(err){console.warn('Courier road navigation fallback',err)}
    if(!Array.isArray(route)||route.length<2){
      const well=State.structures.find(s=>s.type==='well'&&!underConstruction(s));
      route=[point(entry),...(well?[point(well)]:[]),point(goal)];
    }
    return route.filter((p,i,a)=>i===0||dist(p,a[i-1])>.05).map(point);
  }
  function routeLength(path){let total=0;for(let i=1;i<path.length;i++)total+=dist(path[i-1],path[i]);return total}
  function position(path,fraction){
    const total=routeLength(path),target=Math.min(1,Math.max(0,fraction))*total;
    let used=0;
    for(let i=1;i<path.length;i++){
      const span=dist(path[i-1],path[i]);
      if(used+span>=target)return{x:path[i-1].x+(path[i].x-path[i-1].x)*(target-used)/Math.max(.0001,span),y:path[i-1].y+(path[i].y-path[i-1].y)*(target-used)/Math.max(.0001,span),heading:Math.atan2(path[i].y-path[i-1].y,path[i].x-path[i-1].x)};
      used+=span;
    }
    const a=path.at(-2)||path[0],b=path.at(-1)||a;
    return {...b,heading:Math.atan2(b.y-a.y,b.x-a.x)};
  }
  function courierPose(x,at=day()){
    if(!x)return null;
    const progress=x.phase==='arriving'?(at-x.spawnDay)/Math.max(.001,x.arrivalDay-x.spawnDay):
      x.phase==='returning'?1-(at-x.departDay)/Math.max(.001,x.returnDay-x.departDay):1;
    return position(x.route||[point(x.entry),point(x.goal)],progress);
  }
  function scheduleNext(x,start){
    x.nextEventDay=Math.floor(start)+25+choice(State.seed+'|diplomacy|next|'+x.sequence,12);
  }
  function spawn(at){
    const x=state(),goal=destination();
    if(!State.village.founded||!mastio()||!goal)return false;
    const entries=(typeof ensureBorderEntrySelection==='function'?ensureBorderEntrySelection():State.village.borderEntries)||[];
    if(!entries.length)return false;
    const entry=entries[choice(State.seed+'|courier|edge|'+x.sequence,entries.length)];
    const route=routeFrom(entry,goal,x.sequence),duration=Math.max(.5,routeLength(route)*DAYS_PER_COURIER_UNIT);
    x.incoming={id:'courier-'+x.sequence,edge:entry.edge,entry:point(entry),goal:point(goal),
      route,spawnDay:at,arrivalDay:at+duration,phase:'arriving',request:DEFAULT_REQUEST};
    x.sequence++;
    scheduleNext(x,at);
    changed();refreshUI();
    return true;
  }
  function finishResponse(accepted){
    const x=state(),m=x.incoming;if(!m||m.phase!=='waiting')return;
    x.history.push({day:day(),edge:m.edge,accepted,request:m.request});
    m.phase='returning';m.departDay=day();m.returnDay=day()+Math.max(.5,routeLength(m.route)*DAYS_PER_COURIER_UNIT);
    byId('courierLetter').hidden=true;byId('courierDialog').hidden=true;
    if(accepted){
      const id='caravan-'+m.id;
      window.ConquerConvoys?.planLordConvoy({id,kind:'tribute',destinationId:'province-'+m.edge,
        coinGold:DEFAULT_REQUEST,minGold:DEFAULT_REQUEST,edge:m.edge,routeDistance:routeLength(m.route),
        departDay:Math.ceil(day())+1,source:'diplomacy'});
      openCaravans(id);
    }
    changed();refreshUI();
  }
  const convoys=()=>window.ConquerConvoys;
  function caravans(){return Object.values(convoys()?.state?.()?.lordConvoys||{})}
  const travel=c=>convoys()?.travel?.(c);
  function shortage(c,metrics=travel(c)){
    const missing=convoys()?.missingStock?.(c,metrics?.food||0);
    return missing?LABELS[missing]||(missing==='provisions'?'Cibo e provviste':missing):null;
  }
  function tick(from,to){
    if(to<=from)return;
    const x=state();
    if(x.nextEventDay==null)scheduleNext(x,Math.max(0,from));
    if(x.incoming){
      const m=x.incoming;
      if(m.phase==='arriving'&&to>=m.arrivalDay){m.phase='waiting';changed();refreshUI()}
      if(m.phase==='returning'&&to>=m.returnDay){x.incoming=null;changed();refreshUI()}
    }else if(to>=x.nextEventDay){
      // Never spawn without a completed mastio; retry on the next day.
      if(!spawn(to))x.nextEventDay=Math.floor(to)+1;
    }
    // Caravan departures and returns are ticked by ConquerConvoys.
    positionLetter();
  }  function dateLabel(value){
    const cal=typeof calendarDateFromDay==='function'?calendarDateFromDay(value):null;
    return cal?cal.day+' '+cal.name+' A'+cal.year+' (g. '+(+value).toFixed(0)+')':'Giorno '+(+value).toFixed(0);
  }
  function htmlEscape(v){return String(v).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}
  function openLetter(){
    const m=state().incoming;if(!m||m.phase!=='waiting')return;
    byId('courierFrom').textContent='Dalla provincia a '+(EDGES[m.edge]||m.edge);
    byId('courierMessage').textContent='Richiesta di aiuto: inviate 100 monete alla nostra provincia.';
    byId('courierDialog').hidden=false;byId('courierLetter').hidden=true;
  }
  function closeLetter(){byId('courierDialog').hidden=true;positionLetter()}
  function hidePanels(){if(byId('courierDialog'))byId('courierDialog').hidden=true;if(byId('caravanDialog'))byId('caravanDialog').hidden=true}
  function openCaravans(focusedId){
    const list=caravans(),panel=byId('caravanDialog');if(!panel)return;
    const selected=list.find(c=>c.id===focusedId)||list.find(c=>['draft','planned','blocked'].includes(c.status))||list.at(-1);
    panel.dataset.selected=selected?.id||'';
    panel.hidden=false;renderCaravans();
  }
  function renderCaravans(){
    const panel=byId('caravanDialog');if(!panel||panel.hidden)return;
    const all=caravans(),list=byId('caravanList');
    list.innerHTML=all.length?all.slice().reverse().map(c=>'<button type="button" data-caravan-open="'+htmlEscape(c.id)+'">'+htmlEscape(c.id)+' · '+htmlEscape(c.status)+'</button>').join(''):'Nessuna carovana.';
    const c=all.find(v=>v.id===panel.dataset.selected);
    const editor=byId('caravanEditor');
    if(!c){editor.innerHTML='<p>Accetta una richiesta per creare una carovana.</p>';return}
    const editable=['draft','planned','blocked'].includes(c.status),t=travel(c),blocked=editable?shortage(c,t):null;
    const qty=g=>g==='gold'?Math.floor(num(c.chest?.gold)):Math.floor(num(c.cargo.find(l=>l.good===g)?.qty));
    const guardCap=convoys()?.availableGuardSlots?.(c.id)??0;
    editor.innerHTML='<h3>Destinazione: provincia '+htmlEscape(EDGES[c.edge]||c.edge)+'</h3>'+
      '<p class="courier-note">Distanza stimata: '+Math.ceil(num(c.routeDistance)+40)+'U a tratta, incluso collegamento extra-mappa convenzionale di 40U. Oro e merci escono dal castello; ogni merce viaggia su un carro proprio ('+(c.transport?.wagons||0)+' carri).</p>'+
      '<div class="caravan-grid">'+GOODS.map(g=>'<label>'+LABELS[g]+'<input type="number" min="'+(g==='gold'?num(c.minGold):0)+'" max="999999" step="1" data-caravan-good="'+g+'" value="'+qty(g)+'" '+(editable?'':'disabled')+'></label>').join('')+
      '<label>Scorta (posti di caserma: '+guardCap+')<input type="number" min="0" max="'+guardCap+'" step="1" data-caravan-escort value="'+Math.floor(num(c.escorts?.requested))+'" '+(editable?'':'disabled')+'></label>'+
      '<label>Partenza (giorno simulato)<input type="number" min="'+Math.ceil(day())+'" step="1" data-caravan-depart value="'+Math.ceil(c.departDay)+'" '+(editable?'':'disabled')+'></label></div>'+
      '<div class="caravan-preview"><strong>Anteprima logistica</strong>'+
      '<p>Carico: '+GOODS.map(g=>LABELS[g]+' '+qty(g)).join(' · ')+'</p>'+
      '<p>Provviste di viaggio aggiuntive: <b>'+t.food+' cibo</b> (2 conducenti + '+num(c.escorts?.requested)+' scorta, andata e ritorno).</p>'+
      '<p>Arrivo: <b>'+dateLabel(c.arrivalDay??t.arrival)+'</b> · Ritorno: <b>'+dateLabel(c.returnDay??t.returnDay)+'</b> · '+t.outward+' giorni per tratta.</p>'+
      '<p class="'+(blocked?'caravan-warning':'')+'">'+(blocked?'Risorse insufficienti: '+blocked:'Risorse disponibili per la partenza')+'</p></div>'+
      (editable?'<button type="button" id="caravanConfirm" '+(blocked?'disabled':'')+'>✅ '+(c.status==='draft'?'Programma partenza':'Aggiorna carovana')+'</button>':'<p>Stato: '+htmlEscape(c.status)+(c.status==='completed'?' · Equipaggio rientrato':'')+'</p>');
  }
  function updateDraft(target){
    const id=byId('caravanDialog')?.dataset.selected,c=caravans().find(v=>v.id===id);
    if(!c||!['draft','planned','blocked'].includes(c.status))return;
    const value=Math.min(999999,Math.max(0,Math.floor(num(target.value))));
    let ok=true;
    if(target.dataset.caravanGood){
      const key=target.dataset.caravanGood;
      if(key==='gold')ok=convoys().updateLordConvoy(id,{coinGold:Math.max(num(c.minGold),value)});
      else ok=convoys().updateLordConvoy(id,{cargo:[...c.cargo.filter(l=>l.good!==key),...(value>0?[{good:key,qty:value}]:[])]});
    }else if(target.hasAttribute('data-caravan-escort'))ok=convoys().updateLordConvoy(id,{guards:value});
    else if(target.hasAttribute('data-caravan-depart'))ok=convoys().updateLordConvoy(id,{departDay:Math.max(Math.ceil(day()),value)});
    if(!ok)status('Valore non valido: controlla scorte e posti di caserma');
    changed();renderCaravans();
  }
  function confirmPlan(){
    const panel=byId('caravanDialog'),c=caravans().find(v=>v.id===panel?.dataset.selected);
    if(!c||shortage(c)||!convoys().scheduleLordConvoy(c.id))return;
    changed();renderCaravans();
    status('Carovana programmata per '+dateLabel(c.departDay));
  }
  function positionLetter(){
    const letter=byId('courierLetter'),m=state().incoming;
    if(!letter)return;
    const show=m?.phase==='waiting'&&byId('courierDialog')?.hidden;
    letter.hidden=!show;if(!show)return;
    const p=courierPose(m),sc=w2s(p,terrainElevation(p)+1.35);
    letter.style.left=Math.round(sc.x)+'px';letter.style.top=Math.round(sc.y-15)+'px';
  }
  function draw(g){
    const m=state().incoming,p=courierPose(m);if(!m||!p||!worldPointVisible(p,.15,70))return;
    // The messenger rides the approved flat 2D horse (settlement-mounted2d.js), facing
    // left or right by the screen direction of its route.
    const M2=window.ConquerMounted2D;
    if(M2&&window.ConquerAnimals&&window.ConquerLOD?.militaryTier()!=='dot'){
      const moving=m.phase!=='waiting',s=w2s(p,.1);
      const a=w2sRaw(p,0),b=w2sRaw({x:p.x+Math.cos(p.heading),y:p.y+Math.sin(p.heading)},0);
      M2.draw(g,s.x,s.y,Math.max(1.5,State.view.scale*5.75),{kind:'messenger',facing:b.x>=a.x?1:-1,
        mode:moving?'walk':'idle',from:moving?'walk':'idle',blend:1,t:day()*7,seed:hash(m.id)%7,
        coat:['brown','black','grey','white'][hash(m.id)%4],livery:soldierLivery(m.id)});
    }else{
      withRenderContext(g,()=>drawSoldierFigure(p,.10,'unarmed',m.id,day()));
    }
  }
  function refreshUI(){
    const b=byId('caravanOpen');if(b)b.textContent='📦 Carovane ('+caravans().filter(c=>c.status!=='completed').length+')';
    positionLetter();if(byId('caravanDialog')&&!byId('caravanDialog').hidden)renderCaravans();
  }
  function initUI(){
    const host=document.createElement('div');host.id='diplomacyHost';
    host.innerHTML='<button id="courierLetter" type="button" hidden title="Leggi il messaggio">✉️</button>'+
      '<div id="courierDialog" class="diplomacy-backdrop" hidden><section class="diplomacy-panel" role="dialog" aria-modal="true" aria-labelledby="courierTitle">'+
      '<h2 id="courierTitle">✉️ Messaggero</h2><p id="courierFrom"></p><p id="courierMessage"></p>'+
      '<div class="diplomacy-actions"><button id="courierRefuse" type="button">❌ Rifiuta</button><button id="courierAccept" type="button">✅ Accetta</button><button id="courierClose" type="button">Chiudi</button></div></section></div>'+
      '<div id="caravanDialog" class="diplomacy-backdrop" hidden><section class="diplomacy-panel diplomacy-wide" role="dialog" aria-modal="true" aria-labelledby="caravanTitle">'+
      '<h2 id="caravanTitle">📦 Gestione carovane</h2><div id="caravanList" class="caravan-list"></div><div id="caravanEditor"></div>'+
      '<div class="diplomacy-actions"><button id="caravanClose" type="button">Chiudi</button></div></section></div>';
    wrap.appendChild(host);
    byId('courierLetter').onclick=openLetter;
    byId('courierClose').onclick=closeLetter;
    byId('courierRefuse').onclick=()=>finishResponse(false);
    byId('courierAccept').onclick=()=>finishResponse(true);
    byId('caravanClose').onclick=()=>{byId('caravanDialog').hidden=true};
    byId('caravanOpen')?.addEventListener('click',()=>openCaravans());
    byId('caravanDialog').addEventListener('change',e=>{
      if(e.target.matches('[data-caravan-good],[data-caravan-escort],[data-caravan-depart]'))updateDraft(e.target);
    });
    byId('caravanDialog').addEventListener('click',e=>{
      const b=e.target.closest('[data-caravan-open]');if(b){byId('caravanDialog').dataset.selected=b.dataset.caravanOpen;renderCaravans()}
      if(e.target.closest('#caravanConfirm'))confirmPlan();
    });
    refreshUI();
  }
  window.ConquerDiplomacy={tick,reset,state,caravans,draw,positionLetter,refreshUI,travel,spawn,openLetter,openCaravans};
  initUI();
  // Combat has already wrapped the scene draw; retain its layering and only move the DOM letter.
  const drawSettlement=window.draw;
  if(typeof drawSettlement==='function')window.draw=function(){drawSettlement();positionLetter()};
})();