'use strict';
(() => {
  // Settlement control center: read-only views over ConquerGame, ConquerEconomy,
  // ConquerSiege and ConquerCombat. Every action goes through ConquerGame.commands.
  const $ = id => document.getElementById(id);
  const num = n => Number.isFinite(Number(n)) ? Number(n) : 0;
  const fmt = n => n == null ? '—' : num(n).toLocaleString('it-IT',{maximumFractionDigits:1});
  const esc = s => String(s ?? '—').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const max1 = values => Math.max(1,...values.map(num));
  const sum = values => values.reduce((n,x)=>n+num(x),0);

  const LABELS = {food:'Cibo',wood:'Legno',stone:'Pietra',clay:'Argilla',metal:'Metallo',equipment:'Equipaggiamento',luxury:'Lusso',materials:'Materiali',horses:'Cavalli',gold:'Oro'};
  const good = id => LABELS[id] || id;
  const PRICE_GOODS = Object.keys(LABELS).filter(k=>!['materials','horses','gold'].includes(k));
  const CLASSES = ['L1','L2','L3','L4'];
  const COLORS = ['#bcd18b','#e7ac77','#97bfd9','#d9a4cf','#d9c0a4'];
  const TABS = [
    ['general','Generale','Quadro d’insieme del feudo'],
    ['people','Popolazione','Classi, felicità e politiche fiscali'],
    ['economy','Economia','Lavoro, mercato e prezzi'],
    ['estate','Proprietà','Attività del signore e dei privati'],
    ['stores','Scorte','Riserve economiche e depositi d’assedio'],
    ['military','Militare','Forze, cavalleria e leva'],
    ['building','Cantieri','Lavori in corso e manodopera'],
    ['diplomacy','Diplomazia','Carovane, messaggi e relazioni'],
    ['alerts','Avvisi','Controlli attivi sull’insediamento']
  ];
  const HISTORY_WEEKS = 26;

  // UI selection survives re-renders and reopening the tab.
  const ui = {tab:'general',priceGood:'food',site:'all'};

  // ---- Building blocks -------------------------------------------------------
  const card = (title,body,foot='',wide=false) =>
    '<section class="cp-card'+(wide?' cp-wide':'')+'"><h3>'+esc(title)+'</h3>'+body+(foot?'<p class="cp-foot">'+esc(foot)+'</p>':'')+'</section>';
  const kpi = (name,value,foot='',tone='') =>
    '<div class="cp-kpi'+(tone?' cp-'+tone:'')+'"><span>'+esc(name)+'</span><strong>'+esc(value)+'</strong><small>'+esc(foot)+'</small></div>';
  const kpis = items => '<div class="cp-kpis">'+items.join('')+'</div>';
  const grid = items => '<div class="cp-grid">'+items.join('')+'</div>';
  const line = (label,value) => '<div class="cp-line"><span>'+esc(label)+'</span><b>'+esc(value)+'</b></div>';
  const empty = text => '<p class="cp-empty">'+esc(text)+'</p>';
  const warn = text => '<p class="cp-warn">'+esc(text)+'</p>';
  const pct = (value,max) => Math.max(0,Math.min(100,100*num(value)/Math.max(1,num(max)))).toFixed(1);
  function bars(items,max) {
    return '<div class="cp-bars" role="img" aria-label="'+esc(items.map(x=>x[0]+' '+fmt(x[1])).join(', '))+'">'+items.map(x=>
      '<div class="cp-bar"><span>'+esc(x[0])+'</span><i><em style="width:'+pct(x[1],max)+'%"></em></i><b>'+fmt(x[1])+'</b></div>'
    ).join('')+'</div>';
  }
  const select = (attr,label,options,value) =>
    '<label class="cp-input">'+esc(label)+' <select '+attr+'>'+options.map(([v,t])=>
      '<option value="'+esc(v)+'"'+(String(value)===String(v)?' selected':'')+'>'+esc(t)+'</option>').join('')+'</select></label>';
  function table(head,rows) {
    return '<div class="cp-scroll"><table class="cp-table"><thead><tr>'+head.map(h=>'<th>'+esc(h)+'</th>').join('')+
      '</tr></thead><tbody>'+rows.map(r=>'<tr>'+r.join('')+'</tr>').join('')+'</tbody></table></div>';
  }

  // ---- Charts -----------------------------------------------------------------
  // One SVG line chart for every series: y grid, day labels, point tooltips.
  // Null values break the line; nothing is interpolated or reconstructed.
  // Wide charts (full-width cards) get a wider canvas instead of being scaled up.
  const H = 132, L = 34, T = 10, B = 106;
  function chart(points,series,caption,extraClass='',W=360) {
    const R = W-14;
    const values = series.flatMap(s=>s.values.filter(v=>v!==null));
    const min = Math.min(0,...values), max = Math.max(1,...values), span = Math.max(1,max-min);
    const x = i => L+(R-L)*i/Math.max(1,points.length-1);
    const y = v => B-(B-T)*(v-min)/span;
    const grid = [0,.5,1].map(f=>{
      const v = min+span*f, py = y(v).toFixed(1);
      return '<path d="M'+L+' '+py+'H'+R+'" class="cp-gridline"/><text x="'+(L-5)+'" y="'+(+py+3)+'" text-anchor="end">'+fmt(v)+'</text>';
    }).join('');
    const lines = series.map(s=>{
      let out = '', chunk = [];
      const flush = () => { if(chunk.length>1)out += '<polyline points="'+chunk.join(' ')+'" stroke="'+s.color+'"/>'; chunk = []; };
      s.values.forEach((v,i)=>{
        if(v===null){flush();return;}
        chunk.push(x(i).toFixed(1)+','+y(v).toFixed(1));
        out += '<circle cx="'+x(i).toFixed(1)+'" cy="'+y(v).toFixed(1)+'" r="2.4" fill="'+s.color+'"><title>'+esc(s.label+' · '+points[i].label+': '+fmt(v))+'</title></circle>';
      });
      flush();
      return out;
    }).join('');
    const legend = series.map(s=>{
      const last = [...s.values].reverse().find(v=>v!==null);
      return '<span><i style="background:'+s.color+'"></i>'+esc(s.label)+' <b>'+fmt(last)+'</b></span>';
    }).join('');
    return '<figure class="cp-graph'+(extraClass?' '+extraClass:'')+'"><svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+esc(caption)+'">'+
      grid+'<path d="M'+L+' '+T+'V'+B+'H'+R+'" class="cp-axis"/>'+lines+
      '<text x="'+L+'" y="'+(H-6)+'">'+esc(points[0].label)+'</text>'+
      '<text x="'+R+'" y="'+(H-6)+'" text-anchor="end">'+esc(points[points.length-1].label)+'</text></svg>'+
      '<figcaption class="cp-graph-legend">'+legend+'</figcaption></figure>';
  }
  const dayLabel = day => 'G'+Math.round(num(day));

  function foodChart(d) {
    const recent = (d.books?.balanceHistory||[]).filter(w=>w?.goods?.food).slice(-8);
    if(recent.length<2)return empty('Dati storici disponibili dopo almeno due mercati settimanali.');
    const read = key => recent.map(w=>num(w.goods.food[key]));
    return chart(recent.map((w,i)=>({label:w.day==null?'S'+(i+1):dayLabel(w.day)})),[
      {label:'Produzione',color:COLORS[0],values:read('produced')},
      {label:'Domanda',color:COLORS[1],values:read('demand')}
    ],'Ultime '+recent.length+' settimane: produzione e domanda alimentare');
  }
  // The only time series come from the Saturday ledger snapshots (panelHistory).
  function historical(d,series,caption) {
    const weeks = (d.books?.panelHistory||[]).filter(w=>w&&Number.isFinite(Number(w.day))).slice(-HISTORY_WEEKS);
    if(weeks.length<2)return empty('Storico disponibile dopo due mercati successivi all’aggiornamento.');
    const lines = series.map(s=>({...s,values:weeks.map(w=>{
      const raw = s.read(w);
      return raw==null||!Number.isFinite(Number(raw))?null:Number(raw);
    })})).filter(s=>s.values.some(v=>v!==null));
    if(!lines.length)return empty('Nessun dato rilevato per questa serie.');
    return chart(weeks.map(w=>({label:dayLabel(w.day)})),lines,caption+': '+weeks.length+' rilevazioni settimanali','cp-history',760);
  }
  const welfareTrend = d => historical(d,[{label:'Felicità media',color:COLORS[0],read:w=>w.welfare}],'Felicità della popolazione');
  const classTrend = d => historical(d,CLASSES.map((k,i)=>({label:k,color:COLORS[i],read:w=>w.population?.[k]>0?w.happiness?.[k]:null})),'Felicità per classe');
  const JOBS = [['building','Costruttori'],['herding','Pastori'],['logging','Boscaioli'],['industry','Industrie L1'],['idle','L1 inattivi']];
  const jobsTrend = d => historical(d,JOBS.map(([k,label],i)=>({label,color:COLORS[i],read:w=>w.jobs?.[k]})),'Occupazione L1 per mansione');
  const priceTrend = d => historical(d,[{label:good(ui.priceGood),color:COLORS[1],read:w=>w.prices?.[ui.priceGood]}],'Prezzo settimanale');
  function estateTrend(d,lordSites) {
    if(ui.site!=='all'&&!lordSites.some(a=>a.id===ui.site))ui.site='all';
    // Ownership is stored on every sample; transfers are never relabelled retroactively.
    return historical(d,[{
      label:ui.site==='all'?'Siti del signore':'Sito selezionato',color:COLORS[0],
      read:w=>sum((w.production||[]).filter(a=>a.owner==='lord'&&(ui.site==='all'||a.id===ui.site))
        .flatMap(a=>Object.values(a.goods||{})))
    }],'Produzione settimanale dei siti del signore');
  }

  // ---- Data -------------------------------------------------------------------
  function get() {
    const game = window.ConquerGame?.read, econ = window.ConquerEconomy;
    const d = {
      founded:!!State.village?.founded,
      economy:game?.economy?.(),
      snapshot:econ?.snapshot?.(),
      books:econ?.state?.(),
      policy:game?.policies?.() || State.policies || {},
      logistics:game?.logistics?.(),
      defense:game?.defense?.(),
      knights:game?.knights?.(),
      diplomacy:window.ConquerDiplomacy?.state?.(),
      sites:(State.structures||[]).filter(s=>s.construction && typeof underConstruction==='function' && underConstruction(s))
    };
    d.warnings = warnings(d);
    return d;
  }
  function warnings(d) {
    const all = [];
    if(d.economy?.jobs?.foodRisk)all.push('Possibile carenza alimentare rispetto al fabbisogno stimato.');
    if(num(d.snapshot?.balance?.goods?.food?.unmetSupply)>0)all.push('Domanda di cibo non soddisfatta al mercato.');
    if(num(d.logistics?.shortfall)>0)all.push('Razioni militari insufficienti.');
    if(d.sites.length && d.economy?.jobs && num(d.economy.jobs.building)===0)all.push('Cantieri senza costruttori L1 assegnati.');
    return all;
  }
  const population = d => d.economy?.population || {};
  const classBars = p => bars(CLASSES.map(k=>[k,p[k]]),max1(Object.values(p)));
  const warningList = (d,none) => d.warnings.length ? d.warnings.map(warn).join('') : empty(none);

  // ---- Views ------------------------------------------------------------------
  function general(d) {
    const p = population(d), welfare = d.economy?.welfare;
    return kpis([
      kpi('Popolazione',fmt(sum(Object.values(p))),'L1–L4'),
      kpi('Felicità',welfare==null?'—':fmt(welfare)+'/100','',welfare!=null&&welfare<40?'bad':''),
      kpi('Tesoreria',fmt(d.economy?.castleGold),'Oro economico'),
      kpi('Cantieri',fmt(d.sites.length)),
      kpi('Cavalieri',fmt(d.knights?.current)),
      kpi('Avvisi',fmt(d.warnings.length),'',d.warnings.length?'bad':'good')
    ])+grid([
      card('Classi sociali',classBars(p)),
      card('Cibo: produzione e domanda',foodChart(d)),
      card('Evoluzione della felicità',welfareTrend(d),'',true),
      card('Segnalazioni',warningList(d,'Nessun allarme rilevato.'),'',true)
    ]);
  }
  function people(d) {
    const p = population(d), h = d.books?.happiness || {};
    const active = CLASSES.filter(k=>num(p[k])>0);
    const tax = num(d.policy.tax), ration = d.economy?.rationMode || 'market';
    const policy = '<label class="cp-input">Aliquota <b>'+fmt(tax)+'%</b><input type="range" data-cp-policy="tax" min="0" max="100" value="'+tax+'"></label>'+
      select('data-cp-policy="rations"','Razioni',[['market','Solo mercato'],['half','Mezze razioni'],['full','Razioni complete']],ration);
    return kpis([
      kpi('Residenti',fmt(sum(Object.values(p)))),
      kpi('Felicità media',fmt(d.economy?.welfare)+'/100'),
      kpi('Aliquota',fmt(tax)+'%')
    ])+grid([
      card('Classi sociali',classBars(p)),
      card('Felicità L1–L4',active.length?bars(active.map(k=>[k,h[k]]),100):empty('Nessun residente'),'Valori correnti, non storici.'),
      card('Tendenza felicità L1–L4',classTrend(d),'',true),
      card('Tassazione e razioni',policy),
      card('Festività',line('Sabato','Mercato')+line('Domenica','Riposo')+empty('Festività straordinarie e loro effetti sulla felicità: TBD.'))
    ]);
  }
  function economy(d) {
    const e = d.economy || {}, j = e.jobs || {}, goods = e.goods || [];
    const jobs = JOBS.map(([k,label])=>[label,j[k]]);
    const market = goods.length ? table(['Bene','Prezzo','Mercato','Castello','Vendita'],goods.map(g=>[
      '<th>'+esc(good(g.id))+'</th>','<td>'+fmt(g.price)+'</td>','<td>'+fmt(g.market)+'</td>','<td>'+fmt(g.castle)+'</td>',
      '<td><select data-cp-share="'+esc(g.id)+'" aria-label="Quota vendita '+esc(good(g.id))+'">'+
        [0,25,50,75,100].map(n=>'<option value="'+n+'"'+(num(g.share)===n?' selected':'')+'>'+n+'%</option>').join('')+'</select></td>'
    ])) : empty('Mercato non inizializzato.');
    return kpis([
      kpi('Capitale L4',fmt(e.capital),'Oro privato'),
      kpi('Tesoreria',fmt(e.castleGold),'Oro signore'),
      kpi('Mercati',fmt(d.snapshot?.weeks),'Cicli settimanali')
    ])+grid([
      card('Occupazione L1',bars(jobs,max1(jobs.map(x=>x[1])))),
      card('Bilancio alimentare',foodChart(d)),
      card('Evoluzione dell’occupazione L1',jobsTrend(d),'',true),
      card('Storico prezzi · singolo bene',select('data-cp-price','Bene',PRICE_GOODS.map(k=>[k,good(k)]),ui.priceGood)+priceTrend(d),'',true),
      card('Mercato, prezzi e vendite',market,'La domanda esterna non viene generata automaticamente.',true)
    ]);
  }
  function estate(d) {
    const items = d.economy?.activities || [], lord = items.filter(a=>a.owner==='lord');
    const weekGoods = d.snapshot?.balance?.goods;
    const produced = weekGoods ? bars(Object.entries(weekGoods).map(([g,x])=>[good(g),x.produced]),max1(Object.values(weekGoods).map(x=>x.produced)))
      : empty('La prima settimana contabile non è ancora conclusa.');
    const sitePicker = select('data-cp-estate','Attività',[['all','Tutte le proprietà del signore'],...lord.map(a=>[a.id,a.type+' · '+a.id])],ui.site);
    const owned = items.length ? table(['Attività','Proprietà','Lav.','Valore','Utile annuo','Azione'],items.map(a=>[
      '<th>'+esc(a.type)+'</th>','<td>'+esc(a.owner==='lord'?'Signore':'Privati L4')+'</td>','<td>'+fmt(a.workers)+'</td>',
      '<td>'+fmt(a.value)+'</td>','<td>'+fmt(a.profit)+'</td>',
      '<td><button type="button" data-cp-transfer="'+esc(a.id)+'" data-cp-owner="'+(a.owner==='lord'?'private':'lord')+'">'+(a.owner==='lord'?'Vendi':'Acquista')+'</button></td>'
    ])) : empty('Nessuna attività registrata.');
    return kpis([
      kpi('Proprietà signore',fmt(lord.length)),
      kpi('Imprese private',fmt(items.length-lord.length)),
      kpi('Valore proprietà',fmt(sum(lord.map(a=>a.value))),'Oro stimato')
    ])+grid([
      card('Titolarità delle attività',bars([['Signore',lord.length],['Settore L4',items.length-lord.length]],Math.max(1,items.length))),
      card('Produzione complessiva · ultima settimana',produced,'Bilancio di tutto il territorio.'),
      card('Produzione settimanale delle proprietà',sitePicker+estateTrend(d,lord),'Quantità effettive per sito al momento della produzione; passaggi di proprietà non retroattivi.',true),
      card('Produzione e proprietà',owned,'Utili annui solo dopo la chiusura del primo esercizio. Compravendite gestite dal ledger economico.',true)
    ]);
  }
  function stores(d) {
    const economic = d.economy?.goods || [], siege = d.logistics?.stores || [];
    // Scale against the larger of stock and target, so stock above target never clips silently.
    const econMax = max1(economic.flatMap(g=>[g.reserve,g.castle]));
    return kpis([
      kpi('Tesoreria',fmt(d.economy?.castleGold),'Oro economico'),
      kpi('Autonomia di assedio',d.logistics?.autonomy==null?'—':fmt(d.logistics.autonomy)+' giorni','',d.logistics?.autonomy!=null&&num(d.logistics.autonomy)<3?'bad':''),
      kpi('Fabbisogno giornaliero',fmt(d.logistics?.daily),'Razioni in difesa')
    ])+grid([
      card('Riserve del signore',bars(economic.map(g=>[good(g.id),g.castle]),econMax),'Scorte del ledger economico rispetto ai target impostati.'),
      card('Scorte per la difesa',bars(siege.map(g=>[good(g.id),g.stock]),max1(siege.map(g=>g.cap))),'Depositi fisici del castello: non sommare queste scorte a quelle economiche.'),
      card('Capienza dei magazzini',siege.map(g=>line(good(g.id),fmt(g.stock)+' / '+fmt(g.cap))).join('')||empty('Nessun deposito assegnato.'),'',true)
    ]);
  }
  function military(d) {
    const c = d.defense || {}, k = d.knights || {}, l = d.logistics || {};
    const live = v => c.active ? fmt(v) : '—';
    return kpis([
      kpi('Unità alleate',live(c.units),'Presenti nel combat'),
      kpi('Pattuglie',live(c.patrols)),
      kpi('Cavalieri',k.current==null?'—':fmt(k.current)+' / '+fmt(k.limit)),
      kpi('Capienza caserme',fmt(l.soldiers),'Posti, non soldati'),
      kpi('Nemici rilevati',live(c.hostiles),'',c.active&&num(c.hostiles)>0?'bad':''),
      kpi('Allarme',c.alarm||'—')
    ])+grid([
      card('Cavalleria disponibile',bars([['Cavalieri reclutati',k.current],['Posti disponibili',k.limit]],num(k.limit))),
      card('Leva del feudo',line('Aliquota impostata',fmt(d.policy.levy)+'%')+
        empty('Leva e mobilitazione non sono ancora collegate. La capienza non costituisce un organico effettivo.'))
    ]);
  }
  function building(d) {
    const j = d.economy?.jobs || {};
    const tasks = d.sites.map(s=>{
      const p = typeof constructionProgress==='function' ? 100*num(constructionProgress(s)) : 0;
      return '<div class="cp-site"><div><span>'+esc(s.type)+'</span><b>'+fmt(Math.max(0,Math.min(100,p)))+'%</b></div><i><em style="width:'+pct(p,100)+'%"></em></i></div>';
    }).join('');
    const work = JOBS.map(([k,label])=>[label,j[k]]);
    return kpis([
      kpi('Cantieri',fmt(d.sites.length)),
      kpi('Costruttori L1',fmt(j.building),'Oggi',d.sites.length&&!num(j.building)?'bad':''),
      kpi('L1 inattivi',fmt(j.idle)),
      kpi('Salari cantieri',fmt(d.snapshot?.constructionPayroll),'Oro già pagato')
    ])+grid([
      card('Lavoratori allocati',bars(work,max1(work.map(x=>x[1])))),
      card('Progresso lavori',tasks||empty('Nessun cantiere in corso.'),'Tempi e lavoro derivano dalla simulazione L1 già attiva.'),
      crenelCard()
    ]);
  }
  const CRENELS = [['flat','Piatta','Blocco squadrato, lo stile di base.'],['gabled','Doppia falda','Sommità a due spioventi.'],['swallowtail','Coda di rondine','Corna a V e feritoia: la più costosa.']];
  const costLine = cost => Object.entries(cost||{}).filter(([,v])=>v>0).map(([k,v])=>fmt(v)+' '+good(k)).join(' · ') || 'gratis';
  function crenelCard() {
    const cmd = window.ConquerGame?.commands;
    if(!cmd?.crenelQuote)return '';
    const current = typeof crenelStyle==='function' ? crenelStyle() : 'flat';
    const rows = CRENELS.map(([id,label,tip])=>{
      const q = cmd.crenelQuote(id), on = id===current;
      return '<div class="cp-line"><span>'+esc(label)+' <small>'+esc(tip)+'</small></span>'+
        (on ? '<b>In uso</b>' : '<button type="button" class="cp-action" data-cp-crenel="'+id+'">Adotta · '+esc(costLine(q.cost))+'</button>')+'</div>';
    }).join('');
    const n = cmd.crenelQuote(current).merlons;
    return card('Stile delle merlature',rows+(ui.crenelMsg?warn(ui.crenelMsg):''),
      'Cambia tutti i '+fmt(n)+' merli in pietra del feudo; il costo cresce con il numero di merli. Le nuove costruzioni usano lo stile scelto.',true);
  }
  function diplomacy(d) {
    const s = d.diplomacy || {}, active = (s.caravans||[]).filter(c=>c.status!=='completed');
    return kpis([
      kpi('Carovane attive',fmt(active.length)),
      kpi('Messaggio in attesa',s.incoming?'Sì':'No','',s.incoming?'warn':''),
      kpi('Eventi registrati',fmt(s.history?.length||0))
    ])+grid([
      card('Messaggeri e carovane',line('Convogli in corso',fmt(active.length))+'<button type="button" class="cp-action" data-cp-action="caravans">Apri gestione carovane</button>'),
      card('Relazioni tra feudi',empty('TBD: alleanze, trattati, reputazione e vassallaggio non hanno ancora un modello completo. Non mostriamo valori fittizi.'))
    ]);
  }
  function alerts(d) {
    return grid([
      card('Monitoraggio insediamento',warningList(d,'Nessun allarme nei controlli disponibili.'),'',true),
      card('Copertura del sistema',empty('Monitorati: domanda alimentare, razioni difensive e cantieri L1. Epidemie, tumulti e altri avvisi richiedono nuovi contratti dati.'),'',true)
    ]);
  }
  const views = {general,people,economy,estate,stores,military,building,diplomacy,alerts};

  // ---- Rendering --------------------------------------------------------------
  function nav(d) {
    return TABS.map(([id,label])=>{
      const on = ui.tab===id;
      const badge = id==='alerts'&&d.founded&&d.warnings.length ? '<span class="cp-badge">'+d.warnings.length+'</span>' : '';
      return '<button type="button" role="tab" aria-selected="'+on+'" data-cp-tab="'+id+'" class="'+(on?'active':'')+'">'+label+badge+'</button>';
    }).join('');
  }
  function render() {
    const root = $('profileControl'), body = $('controlBody');
    if(!root || root.hidden || !body)return;
    const d = get();
    // Keep horizontal table scroll across live refreshes.
    const scrolls = [...(body.querySelectorAll?.('.cp-scroll')||[])].map(el=>el.scrollLeft);
    $('controlNav').innerHTML = nav(d);
    const [,title,subtitle] = TABS.find(t=>t[0]===ui.tab) || TABS[0];
    body.innerHTML = !d.founded
      ? card('Insediamento non fondato',empty('Fonda il villaggio: le risorse di test del Builder non sono statistiche economiche.'))
      : '<div class="cp-head"><h2>'+esc(title)+'</h2><p>'+esc(subtitle)+'</p></div>'+(views[ui.tab]||general)(d);
    [...(body.querySelectorAll?.('.cp-scroll')||[])].forEach((el,i)=>{ if(scrolls[i])el.scrollLeft = scrolls[i]; });
  }
  function open() { render(); }

  const root = $('profileControl');
  if(root){
    root.addEventListener('click',ev=>{
      const tab = ev.target.closest('[data-cp-tab]');
      if(tab){ui.tab = tab.dataset.cpTab; render(); return;}
      const trade = ev.target.closest('[data-cp-transfer]');
      if(trade){window.ConquerGame?.commands?.transferActivity?.(trade.dataset.cpTransfer,trade.dataset.cpOwner); render(); return;}
      const crenel = ev.target.closest('[data-cp-crenel]');
      if(crenel){
        const out = window.ConquerGame?.commands?.setCrenelStyle?.(crenel.dataset.cpCrenel);
        ui.crenelMsg = out?.ok ? '' : out?.reason==='funds' ? 'Risorse insufficienti per rifare le merlature.' : '';
        render(); return;
      }
      if(ev.target.closest('[data-cp-action="caravans"]')){$('profileOverlay').hidden = true; window.ConquerGame?.commands?.openCaravans?.();}
    });
    root.addEventListener('input',ev=>{
      if(ev.target.dataset.cpPolicy!=='tax')return;
      const badge = ev.target.closest?.('.cp-input')?.querySelector('b');
      if(badge)badge.textContent = ev.target.value+'%';
    });
    root.addEventListener('change',ev=>{
      const el = ev.target, cmd = window.ConquerGame?.commands;
      if(el.dataset.cpPolicy)cmd?.setPolicy?.(el.dataset.cpPolicy,el.value);
      if(el.dataset.cpShare)cmd?.setSaleShare?.(el.dataset.cpShare,num(el.value));
      if(el.matches?.('[data-cp-price]'))ui.priceGood = el.value;
      if(el.matches?.('[data-cp-estate]'))ui.site = el.value;
      render();
    });
    // Live refresh while visible; never while the player is using a control inside.
    const refresh = () => { if(!$('profileOverlay')?.hidden && !root.hidden && !root.contains(document.activeElement))render(); };
    let pending = false;
    const throttled = () => { if(pending)return; pending = true; setTimeout(()=>{pending = false; refresh();},500); };
    if(typeof window.ConquerGame?.subscribe==='function')window.ConquerGame.subscribe(throttled);
    // Simulation ticks do not all emit; a slow heartbeat keeps the numbers current.
    setInterval(refresh,4000);
  }
  window.ConquerPanels = Object.freeze({open,render,tabs:TABS.map(x=>x[0])});
})();
