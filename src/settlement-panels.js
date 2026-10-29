'use strict';
(() => {
  // Read-only views over ConquerGame, ConquerEconomy, ConquerSiege and ConquerCombat.
  const $ = id => document.getElementById(id);
  const num = n => Number.isFinite(Number(n)) ? Number(n) : 0;
  const fmt = n => n == null ? '—' : num(n).toLocaleString('it-IT',{maximumFractionDigits:1});
  const esc = s => String(s ?? '—').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const labels = {food:'Cibo',wood:'Legno',stone:'Pietra',clay:'Argilla',metal:'Metallo',equipment:'Equipaggiamento',luxury:'Lusso',materials:'Materiali',horses:'Cavalli',gold:'Oro'};
  const tabs = [['general','Generale'],['people','Popolazione'],['economy','Economia'],['estate','Proprietà'],['stores','Scorte'],['military','Militare'],['building','Cantieri'],['diplomacy','Diplomazia'],['alerts','Avvisi']];
  let current = 'general';
  let priceGood = 'food', productionSite = 'all';
  function card(title,body,foot='') { return '<section class="cp-card"><h3>'+esc(title)+'</h3>'+body+(foot?'<p class="cp-foot">'+esc(foot)+'</p>':'')+'</section>'; }
  function kpi(name,value,foot='') { return '<div class="cp-kpi"><span>'+esc(name)+'</span><strong>'+esc(value)+'</strong><small>'+esc(foot)+'</small></div>'; }
  function line(label,value) { return '<div class="cp-line"><span>'+esc(label)+'</span><b>'+esc(value)+'</b></div>'; }
  function empty(text) { return '<p class="cp-empty">'+esc(text)+'</p>'; }
  function bars(items,max) {
    return '<div class="cp-bars" role="img" aria-label="'+esc(items.map(x=>x[0]+' '+fmt(x[1])).join(', '))+'">'+items.map(x=>
      '<div class="cp-bar"><span>'+esc(x[0])+'</span><i><em style="width:'+Math.max(0,Math.min(100,100*num(x[1])/Math.max(1,num(max)))).toFixed(1)+'%"></em></i><b>'+fmt(x[1])+'</b></div>'
    ).join('')+'</div>';
  }
  function get() {
    const game=window.ConquerGame?.read;
    const econ=window.ConquerEconomy;
    return {
      founded:!!State.village?.founded,
      economy:game?.economy?.(),
      snapshot:econ?.snapshot?.(),
      books:econ?.state?.(),
      policy:game?.policies?.() || State.policies,
      logistics:game?.logistics?.(),
      defense:game?.defense?.(),
      knights:game?.knights?.(),
      diplomacy:window.ConquerDiplomacy?.state?.(),
      sites:(State.structures||[]).filter(s=>s.construction && typeof underConstruction==='function' && underConstruction(s))
    };
  }
  function foodChart(d) {
    const recent=(d.books?.balanceHistory||[]).filter(w=>w?.goods?.food).slice(-8);
    if(recent.length<2)return empty('Dati storici disponibili dopo almeno due mercati settimanali.');
    const max=Math.max(1,...recent.flatMap(w=>[num(w.goods.food.produced),num(w.goods.food.demand)]));
    const points=key=>recent.map((w,i)=>(27+310*i/(recent.length-1)).toFixed(1)+','+(103-90*num(w.goods.food[key])/max).toFixed(1)).join(' ');
    return '<figure class="cp-graph"><svg viewBox="0 0 360 120" role="img" aria-label="Ultime '+recent.length+' settimane: produzione e domanda alimentare"><path d="M25 5V108H340" stroke="#816d55" fill="none"/>'+
      '<polyline points="'+points('produced')+'" fill="none" stroke="#bcd18b" stroke-width="3"/>'+
      '<polyline points="'+points('demand')+'" fill="none" stroke="#e7ac77" stroke-width="3"/>'+
      '<text x="1" y="12" fill="#c8bba9" font-size="10">'+fmt(max)+'</text></svg>'+
      '<figcaption>🟢 Produzione · 🟠 Domanda · storico reale degli ultimi '+recent.length+' mercati</figcaption></figure>';
  }

  // The only time series in these views comes from the Saturday ledger snapshots.
  // Do not interpolate simulated events or reconstruct missing weeks.
  function historical(d,series,caption) {
    const weeks=(d.books?.panelHistory||[]).filter(w=>w&&Number.isFinite(Number(w.day))).slice(-26);
    if(weeks.length<2)return empty('Storico disponibile dopo due mercati successivi all’aggiornamento.');
    const lines=series.map(spec=>({
      ...spec,
      values:weeks.map(w=>{
        const raw=spec.read(w);
        return raw===null||raw===undefined||!Number.isFinite(Number(raw))?null:Number(raw);
      })
    })).filter(spec=>spec.values.some(v=>v!==null));
    if(!lines.length)return empty('Nessun dato rilevato per questa serie.');
    const values=lines.flatMap(x=>x.values.filter(v=>v!==null));
    const min=Math.min(0,...values),max=Math.max(1,...values),span=Math.max(1,max-min);
    const x=i=>30+310*i/Math.max(1,weeks.length-1);
    const y=v=>104-90*(v-min)/span;
    const paths=lines.map((spec,seriesIndex)=>{
      let parts=[],chunk=[];
      function end(){if(chunk.length){parts.push('<polyline points="'+chunk.join(' ')+'" fill="none" stroke="'+spec.color+'" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>');chunk=[];}}
      spec.values.forEach((value,i)=>value===null?end():chunk.push(x(i).toFixed(2)+','+y(value).toFixed(2)));
      end();
      return parts.join('');
    }).join('');
    const legend=lines.map(spec=>'<span><i style="background:'+spec.color+'"></i>'+esc(spec.label)+'</span>').join('');
    return '<figure class="cp-graph cp-history"><svg viewBox="0 0 360 128" role="img" aria-label="'+esc(caption)+': '+weeks.length+' rilevazioni settimanali">'+
      '<path d="M28 8V108H342" fill="none" stroke="#816d55"/>'+
      '<path d="M28 60H342" fill="none" stroke="#665343" stroke-dasharray="3 4" stroke-width=".6"/>'+
      paths+'<text x="2" y="13" fill="#c8bba9" font-size="10">'+fmt(max)+'</text>'+
      '<text x="2" y="107" fill="#c8bba9" font-size="10">'+fmt(min)+'</text>'+
      '<text x="29" y="123" fill="#c8bba9" font-size="10">G'+fmt(weeks[0].day)+'</text>'+
      '<text x="295" y="123" fill="#c8bba9" font-size="10">G'+fmt(weeks[weeks.length-1].day)+'</text></svg>'+
      '<figcaption class="cp-graph-legend">'+legend+'</figcaption></figure>';
  }
  function welfareTrend(d) {
    return historical(d,[{label:'Felicità media',color:'#bcd18b',read:w=>w.welfare}], 'Felicità della popolazione');
  }
  function classTrend(d) {
    return historical(d,[
      {label:'L1',color:'#bcd18b',read:w=>w.population?.L1>0?w.happiness?.L1:null},
      {label:'L2',color:'#e7ac77',read:w=>w.population?.L2>0?w.happiness?.L2:null},
      {label:'L3',color:'#97bfd9',read:w=>w.population?.L3>0?w.happiness?.L3:null},
      {label:'L4',color:'#d9a4cf',read:w=>w.population?.L4>0?w.happiness?.L4:null}
    ],'Felicità per classe');
  }
  function jobsTrend(d) {
    return historical(d,[
      {label:'Costruttori',color:'#e7ac77',read:w=>w.jobs?.building},
      {label:'Pascolo',color:'#bcd18b',read:w=>w.jobs?.herding},
      {label:'Boscaioli',color:'#97bfd9',read:w=>w.jobs?.logging},
      {label:'Industrie',color:'#d9a4cf',read:w=>w.jobs?.industry},
      {label:'Inattivi',color:'#d9c0a4',read:w=>w.jobs?.idle}
    ],'Occupazione L1 per mansione');
  }
  function priceTrend(d) {
    return historical(d,[{label:labels[priceGood]||priceGood,color:'#e7ac77',read:w=>w.prices?.[priceGood]}],'Prezzo settimanale');
  }
  function estateTrend(d) {
    const current=d.economy?.activities||[];
    const owned=new Set(current.filter(a=>a.owner==='lord').map(a=>a.id));
    if(productionSite!=='all'&&!current.some(a=>a.id===productionSite))productionSite='all';
    return historical(d,[{
      label:productionSite==='all'?'Produzione dei siti attualmente del signore':'Produzione del sito selezionato',
      color:'#bcd18b',
      read:w=>{
        // Historical ownership is kept on every sample; transfers are never retroactively relabelled.
        const outputs=(w.production||[]).filter(a=>a.owner==='lord'&&
          (productionSite==='all'||a.id===productionSite));
        return outputs.reduce((sum,site)=>sum+Object.values(site.goods||{}).reduce((n,q)=>n+num(q),0),0);
      }
    }], 'Produzione settimanale dei siti del signore');
  }

  function warnings(d) {
    const all=[];
    if(d.economy?.jobs?.foodRisk)all.push('Possibile carenza alimentare rispetto al fabbisogno stimato.');
    if(num(d.snapshot?.balance?.goods?.food?.unmetSupply)>0)all.push('Domanda di cibo non soddisfatta al mercato.');
    if(num(d.logistics?.shortfall)>0)all.push('Razioni militari insufficienti.');
    if(d.sites.length && d.economy?.jobs && num(d.economy.jobs.building)===0)all.push('Cantieri senza costruttori L1 assegnati.');
    return all;
  }
  function general(d) {
    const p=d.economy?.population||{};
    const total=Object.values(p).reduce((n,x)=>n+num(x),0);
    return '<div class="cp-kpis">'+kpi('Popolazione',fmt(total),'L1–L4')+
      kpi('Felicità',d.economy?.welfare==null?'—':fmt(d.economy.welfare)+'/100')+
      kpi('Tesoreria',fmt(d.economy?.castleGold),'Oro economico')+
      kpi('Cantieri',fmt(d.sites.length))+
      kpi('Cavalieri',fmt(d.knights?.current))+
      kpi('Avvisi',fmt(warnings(d).length))+'</div>'+
      '<div class="cp-grid">'+card('Classi sociali',bars(['L1','L2','L3','L4'].map(k=>[k,p[k]]),Math.max(1,...Object.values(p).map(num))))+
      card('Cibo: produzione e domanda',foodChart(d))+'</div>'+
      card('Evoluzione della felicità',welfareTrend(d))+
      card('Segnalazioni',warnings(d).length?warnings(d).map(x=>'<p class="cp-warn">⚠ '+esc(x)+'</p>').join(''):empty('Nessun allarme rilevato.'));
  }

  function people(d) {
    const p=d.economy?.population||{};
    const h=d.books?.happiness||{};
    const active=['L1','L2','L3','L4'].filter(k=>num(p[k])>0);
    const tax=num(d.policy.tax),ration=d.economy?.rationMode||'market';
    const policy='<label class="cp-input">Aliquota <b>'+fmt(tax)+'%</b><input type="range" data-cp-policy="tax" min="0" max="100" value="'+tax+'"></label>'+
      '<label class="cp-input">Razioni <select data-cp-policy="rations">'+
      [['market','Solo mercato'],['half','Mezze razioni'],['full','Razioni complete']].map(x=>'<option value="'+x[0]+'"'+(ration===x[0]?' selected':'')+'>'+x[1]+'</option>').join('')+'</select></label>';
    return '<div class="cp-kpis">'+kpi('Residenti',fmt(Object.values(p).reduce((n,x)=>n+num(x),0)))+
      kpi('Felicità media',fmt(d.economy?.welfare)+'/100')+kpi('Aliquota',fmt(tax)+'%')+'</div>'+
      '<div class="cp-grid">'+card('Classi sociali',bars(['L1','L2','L3','L4'].map(k=>[k,p[k]]),Math.max(1,...Object.values(p).map(num))))+
      card('Felicità L1–L4',active.length?bars(active.map(k=>[k,h[k]]),100):empty('Nessun residente'),'Valori correnti, non storici.')+'</div>'+
      card('Tendenza felicità L1–L4',classTrend(d))+
      card('Tassazione e razioni',policy)+
      card('Festività',line('Sabato','Mercato')+line('Domenica','Riposo')+empty('Festività straordinarie e loro effetti sulla felicità: TBD.'));
  }

  function economy(d) {
    const e=d.economy||{},j=e.jobs||{},goods=e.goods||[];
    const jobs=[['Pastori',j.herding],['Boscaioli',j.logging],['Industrie L1',j.industry],['Costruttori',j.building],['L1 inattivi',j.idle]];
    const table=goods.length?'<div class="cp-scroll"><table class="cp-table"><thead><tr><th>Bene</th><th>Prezzo</th><th>Mercato</th><th>Castello</th><th>Vendita</th></tr></thead><tbody>'+
      goods.map(g=>'<tr><th>'+esc(labels[g.id]||g.id)+'</th><td>'+fmt(g.price)+'</td><td>'+fmt(g.market)+'</td><td>'+fmt(g.castle)+'</td><td><select data-cp-share="'+esc(g.id)+'" aria-label="Quota vendita '+esc(labels[g.id]||g.id)+'">'+
      [0,25,50,75,100].map(n=>'<option value="'+n+'"'+(num(g.share)===n?' selected':'')+'>'+n+'%</option>').join('')+
      '</select></td></tr>').join('')+'</tbody></table></div>':empty('Mercato non inizializzato.');
    return '<div class="cp-kpis">'+kpi('Capitale L4',fmt(e.capital),'Oro privato')+
      kpi('Tesoreria',fmt(e.castleGold),'Oro signore')+kpi('Mercati',fmt(d.snapshot?.weeks),'Cicli settimanali')+'</div>'+
      '<div class="cp-grid">'+card('Occupazione L1',bars(jobs,Math.max(1,...jobs.map(x=>num(x[1])))))+
      card('Bilancio alimentare',foodChart(d))+'</div>'+
      card('Evoluzione dell’occupazione L1',jobsTrend(d))+
      card('Storico prezzi · singolo bene','<label class="cp-input">Bene <select data-cp-price>'+Object.keys(labels).filter(k=>!['materials','horses','gold'].includes(k)).map(k=>'<option value="'+k+'"'+(priceGood===k?' selected':'')+'>'+esc(labels[k])+'</option>').join('')+'</select></label>'+priceTrend(d))+
      card('Mercato, prezzi e vendite',table,'La domanda esterna non viene generata automaticamente.');
  }

  function estate(d) {
    const items=d.economy?.activities||[],lord=items.filter(a=>a.owner==='lord');
    const total=lord.reduce((n,a)=>n+num(a.value),0);
    const table=items.length?'<div class="cp-scroll"><table class="cp-table"><thead><tr><th>Attività</th><th>Proprietà</th><th>Lav.</th><th>Valore</th><th>Utile annuo</th><th>Azione</th></tr></thead><tbody>'+
      items.map(a=>'<tr><th>'+esc(a.type)+'</th><td>'+esc(a.owner==='lord'?'Signore':'Privati L4')+'</td><td>'+fmt(a.workers)+'</td><td>'+fmt(a.value)+'</td><td>'+fmt(a.profit)+'</td><td><button type="button" data-cp-transfer="'+esc(a.id)+'" data-cp-owner="'+(a.owner==='lord'?'private':'lord')+'">'+(a.owner==='lord'?'Vendi':'Acquista')+'</button></td></tr>').join('')+
      '</tbody></table></div>':empty('Nessuna attività registrata.');
    return '<div class="cp-kpis">'+kpi('Proprietà signore',fmt(lord.length))+
      kpi('Imprese private',fmt(items.length-lord.length))+
      kpi('Valore proprietà',fmt(total),'Oro stimato')+'</div>'+
      card('Titolarità delle attività',bars([['Signore',lord.length],['Settore L4',items.length-lord.length]],Math.max(1,items.length)))+
      card('Produzione complessiva · ultima settimana',d.snapshot?.balance?.goods?bars(Object.entries(d.snapshot.balance.goods).map(([g,x])=>[labels[g]||g,x.produced]),Math.max(1,...Object.values(d.snapshot.balance.goods).map(x=>num(x.produced)))):empty('La prima settimana contabile non è ancora conclusa.'),'Bilancio complessivo del territorio; il grafico seguente distingue i siti del signore.')+
      card('Produzione settimanale delle proprietà','<label class="cp-input">Attività <select data-cp-estate><option value="all">Tutte le proprietà del signore</option>'+items.map(a=>'<option value="'+esc(a.id)+'"'+(productionSite===a.id?' selected':'')+'>'+esc(a.type)+' · '+esc(a.id)+'</option>').join('')+'</select></label>'+estateTrend(d),'Registra le quantità effettive per sito al momento della produzione; passaggi di proprietà non retroattivi.')+
      card('Produzione e proprietà',table,'Utili annui solo dopo la chiusura del primo esercizio. Compravendite gestite dal ledger economico.');
  }

  function stores(d) {
    const economic=d.economy?.goods||[],siege=d.logistics?.stores||[];
    const econBars=bars(economic.map(g=>[labels[g.id]||g.id,g.castle]),Math.max(1,...economic.map(g=>num(g.reserve))));
    const siegeBars=bars(siege.map(g=>[labels[g.id]||g.id,g.stock]),Math.max(1,...siege.map(g=>num(g.cap))));
    return '<div class="cp-kpis">'+kpi('Tesoreria',fmt(d.economy?.castleGold),'Oro economico')+
      kpi('Autonomia di assedio',d.logistics?.autonomy==null?'—':fmt(d.logistics.autonomy)+' giorni')+
      kpi('Fabbisogno giornaliero',fmt(d.logistics?.daily),'Razioni in difesa')+'</div>'+
      '<div class="cp-grid">'+card('Riserve del signore',econBars,'Scorte del ledger economico rispetto ai target impostati.')+
      card('Scorte per la difesa',siegeBars,'Depositi fisici del castello: non sommare queste scorte a quelle economiche.')+'</div>'+
      card('Capienza dei magazzini',siege.map(g=>line(labels[g.id]||g.id,fmt(g.stock)+' / '+fmt(g.cap))).join('')||empty('Nessun deposito assegnato.'));
  }
  function military(d) {
    const c=d.defense||{},k=d.knights||{},l=d.logistics||{};
    return '<div class="cp-kpis">'+kpi('Unità alleate',c.active?fmt(c.units):'—','Presenti nel combat')+
      kpi('Pattuglie',c.active?fmt(c.patrols):'—')+
      kpi('Cavalieri',k.current==null?'—':fmt(k.current)+' / '+fmt(k.limit))+
      kpi('Capienza caserme',fmt(l.soldiers),'Posti, non soldati')+
      kpi('Nemici rilevati',c.active?fmt(c.hostiles):'—')+
      kpi('Allarme',c.alarm||'—')+'</div>'+
      card('Cavalleria disponibile',bars([['Cavalieri reclutati',k.current],['Posti disponibili',k.limit]],Math.max(1,num(k.limit))))+
      card('Leva del feudo',line('Aliquota impostata',fmt(d.policy.levy)+'%')+
        empty('Leva e mobilitazione non sono ancora collegate. La capienza non costituisce un organico effettivo.'));
  }
  function building(d) {
    const j=d.economy?.jobs||{};
    const tasks=d.sites.map(s=>{
      const value=typeof constructionProgress==='function'?num(constructionProgress(s)):0;
      const pct=Math.max(0,Math.min(100,100*value));
      return '<div class="cp-site"><div>'+esc(s.type)+' · '+fmt(pct)+'%</div><i><em style="width:'+pct.toFixed(1)+'%"></em></i></div>';
    }).join('');
    const work=[['Cantieri',j.building],['Pastori',j.herding],['Legname',j.logging],['Industrie',j.industry],['Inattivi',j.idle]];
    return '<div class="cp-kpis">'+kpi('Cantieri',fmt(d.sites.length))+
      kpi('Costruttori L1',fmt(j.building),'Oggi')+
      kpi('L1 inattivi',fmt(j.idle))+
      kpi('Salari cantieri',fmt(d.snapshot?.constructionPayroll),'Oro già pagato')+'</div>'+
      card('Lavoratori allocati',bars(work,Math.max(1,...work.map(x=>num(x[1])))))+
      card('Progresso lavori',tasks||empty('Nessun cantiere in corso.'),'Tempi e lavoro derivano dalla simulazione L1 già attiva.');
  }

  function diplomacy(d) {
    const s=d.diplomacy||{},active=(s.caravans||[]).filter(c=>c.status!=='completed');
    return '<div class="cp-kpis">'+kpi('Carovane attive',fmt(active.length))+
      kpi('Messaggio in attesa',s.incoming?'Sì':'No')+
      kpi('Eventi registrati',fmt(s.history?.length||0))+'</div>'+
      card('Messaggeri e carovane',line('Convogli in corso',fmt(active.length))+
        '<button type="button" data-cp-action="caravans">Apri gestione carovane</button>')+
      card('Relazioni tra feudi',empty('TBD: alleanze, trattati, reputazione e vassallaggio non hanno ancora un modello completo. Non mostriamo valori fittizi.'));
  }
  function alerts(d) {
    const list=warnings(d);
    return card('Monitoraggio insediamento',list.length?list.map(x=>'<p class="cp-warn">⚠ '+esc(x)+'</p>').join(''):empty('Nessun allarme nei controlli disponibili.'))+
      card('Copertura del sistema',empty('Monitorati: domanda alimentare, razioni difensive e cantieri L1. Epidemie, tumulti e altri avvisi richiedono nuovi contratti dati.'));
  }
  function render() {
    const root=$('profileControl'); if(!root || root.hidden)return;
    const d=get();
    $('controlNav').innerHTML=tabs.map(x=>'<button type="button" role="tab" aria-selected="'+(current===x[0])+'" data-cp-tab="'+x[0]+'" class="'+(current===x[0]?'active':'')+'">'+x[1]+'</button>').join('');
    const view=views[current];
    $('controlBody').innerHTML=!d.founded?
      card('Insediamento non fondato',empty('Fonda il villaggio: le risorse di test del Builder non sono statistiche economiche.')):
      (typeof view==='function'?view(d):empty('Pannello in preparazione.'));
  }
  function open(){current='general';render();}
  const views={general,people,economy,estate,stores,military,building,diplomacy,alerts};
  const root=$('profileControl');
  if(root){
    root.addEventListener('click',ev=>{
      const tab=ev.target.closest('[data-cp-tab]');
      if(tab){current=tab.dataset.cpTab;render();return;}
      const trade=ev.target.closest('[data-cp-transfer]');
      if(trade){window.ConquerGame?.commands?.transferActivity?.(trade.dataset.cpTransfer,trade.dataset.cpOwner);render();return;}
      if(ev.target.closest('[data-cp-action="caravans"]')){$('profileOverlay').hidden=true;window.ConquerGame?.commands?.openCaravans?.();}
    });
    root.addEventListener('input',ev=>{if(ev.target.dataset.cpPolicy==='tax'){const badge=ev.target.closest('.cp-input')?.querySelector('b');if(badge)badge.textContent=ev.target.value+'%';}});
    root.addEventListener('change',ev=>{
      const el=ev.target,cmd=window.ConquerGame?.commands;
      if(el.dataset.cpPolicy)cmd?.setPolicy?.(el.dataset.cpPolicy,el.value);
      if(el.dataset.cpShare)cmd?.setSaleShare?.(el.dataset.cpShare,num(el.value));
      if(el.matches?.('[data-cp-price]'))priceGood=el.value;
      if(el.matches?.('[data-cp-estate]'))productionSite=el.value;
      render();
    });
    setInterval(()=>{if(!$('profileOverlay')?.hidden&&!root.hidden&&!root.contains(document.activeElement))render();},1800);
  }
  window.ConquerPanels=Object.freeze({open,render,tabs:tabs.map(x=>x[0])});
})();