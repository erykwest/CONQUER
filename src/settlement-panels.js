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
  const COLORS = ['#bcd18b','#e7ac77','#97bfd9','#d9a4cf','#d9c0a4','#a3d3c8'];
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
  const ui = {tab:'general',mode:'control',priceGood:'food',site:'all',jobTier:'L1',militaryTab:'overview',circleCollapsed:new Set()};

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
  const JOBS = [['building','Costruttori'],['herding','Pastori'],['logging','Boscaioli'],['industry','Industrie L1'],['carter','Carrettieri'],['idle','L1 inattivi']];
  const jobsTrend = d => historical(d,JOBS.map(([k,label],i)=>({label,color:COLORS[i],read:w=>w.jobs?.[k]})),'Occupazione L1 per mansione (carrettieri: picco settimanale)');
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
      militaryAssignments:game?.militaryAssignments?.(),
      diplomacy:window.ConquerDiplomacy?.state?.(),
      church:window.ConquerChurch?.snapshot?.(),
      guild:window.ConquerGuild?.snapshot?.(),
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
  // SCOL-01: educated residents are a sub-row of L3/L4, never a fifth class.
  const educated = d => d.economy?.educated || null;
  function educatedLine(d) {
    const s = educated(d);
    if(!s)return '';
    return line('di cui scolarizzati (L3 · L4)',fmt(s.total)+' ('+fmt(s.byClass.L3)+' · '+fmt(s.byClass.L4)+')')+
      line('laici · chierici',fmt(s.lay)+' · '+fmt(s.clergy))+
      line('con ruolo · liberi · in formazione',fmt(s.assigned)+' · '+fmt(s.unassigned)+' · '+fmt(s.training))+
      (s.homeless?line('senza alloggio',fmt(s.homeless)):'');
  }
  const classCard = d => classBars(population(d))+educatedLine(d);
  const warningList = (d,none) => d.warnings.length ? d.warnings.map(warn).join('') : empty(none);

  // ---- Views ------------------------------------------------------------------
  function general(d) {
    const p = population(d), welfare = d.economy?.welfare;
    return kpis([
      kpi('Popolazione',fmt(sum(Object.values(p))),'L1–L4'),
      kpi('Felicità',welfare==null?'—':fmt(welfare)+'/100','',welfare!=null&&welfare<40?'bad':''),
      kpi('Tesoreria',fmt(d.economy?.castleGold),'Oro economico'),
      kpi('Cantieri',fmt(d.sites.length)),
      ...(d.church?.churches?[kpi('Chiesa',fmt(d.church.gold)+' oro','Favore '+fmt(d.church.favor)+'/100',d.church.favor<=30?'bad':'')]:[]),
      ...(d.guild?.activeId?[kpi('Gilda','+'+Math.round(d.guild.bonus*100)+'%','Funzionari L'+d.guild.level+' · resa '+Math.round(d.guild.officialYield*100)+'%',d.guild.bonus<=0?'bad':'')]:[]),
      kpi('Cavalieri',fmt(d.knights?.current)),
      kpi('Avvisi',fmt(d.warnings.length),'',d.warnings.length?'bad':'good')
    ])+grid([
      card('Classi sociali',classCard(d)),
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
      card('Classi sociali',classCard(d)),
      card('Felicità L1–L4',active.length?bars(active.map(k=>[k,h[k]]),100):empty('Nessun residente'),'Valori correnti, non storici.'),
      card('Tendenza felicità L1–L4',classTrend(d),'',true),
      card('Tassazione e razioni',policy),
      card('Festività',line('Sabato','Mercato')+line('Domenica','Riposo')+empty('Festività straordinarie e loro effetti sulla felicità: TBD.'))
    ]);
  }
  // One live market table used by Economy and the Trade palette.
  function marketTable(goods) {
    return goods.length ? table(['Bene','Prezzo','Mercato','Castello','Vendita'],goods.map(g=>[
      '<th>'+esc(good(g.id))+'</th>','<td>'+fmt(g.price)+'</td>','<td>'+fmt(g.market)+'</td>','<td>'+fmt(g.castle)+'</td>',
      '<td><select data-cp-share="'+esc(g.id)+'" aria-label="Quota vendita '+esc(good(g.id))+'">'+
        [0,25,50,75,100].map(n=>'<option value="'+n+'"'+(num(g.share)===n?' selected':'')+'>'+n+'%</option>').join('')+'</select></td>'
    ])) : empty('Mercato non inizializzato.');
  }
  function economy(d) {
    const e = d.economy || {}, j = e.jobs || {};
    const jobs = JOBS.map(([k,label])=>[label,j[k]]);
    const market = marketTable(e.goods || []);
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

  // Two independent job subpalettes, sharing a single editable queue renderer.
  function jobTierNav(){
    return '<nav class="cp-subnav" role="tablist" aria-label="Classi lavoratori">'+
      [['L1','L1'],['L2','L2'],['L3','L3 · Istruiti']].map(([t,label])=>'<button type="button" role="tab" data-cp-jobs-tier="'+t+'" aria-selected="'+(ui.jobTier===t)+'" class="'+(ui.jobTier===t?'active':'')+'">'+esc(label)+'</button>').join('')+'</nav>';
  }
  function jobs(d){
    if(ui.jobTier==='L2')return jobTierNav()+l2Jobs(d);
    if(ui.jobTier==='L3')return jobTierNav()+educatedJobs(d);
    const e=d.economy||{},j=e.jobs||{},p=population(d),work=JOBS.map(([k,label])=>[label,j[k]]);
    const activity=(e.activities||[]).filter(a=>a.tier===1);
    const sites=activity.length?table(['Attività','Occupati','Proprietà'],activity.map(a=>[
      '<th>'+esc(a.type)+' · '+esc(a.id)+'</th>','<td>'+fmt(a.workers)+'</td>',
      '<td>'+esc(a.owner==='lord'?'Signore':'Privati')+'</td>'
    ])):empty('Nessuna attività produttiva L1 registrata.');
    return jobTierNav()+kpis([
      kpi('L1 residenti',fmt(p.L1)),
      kpi('L1 al lavoro',fmt(sum(work.filter(([label])=>label!=='L1 inattivi').map(x=>x[1]))),'Mansioni correnti'),
      kpi('L1 inattivi',fmt(j.idle),'Disponibili'),
      kpi('Cantieri',fmt(j.building),'Costruttori assegnati')
    ])+grid([
      card('Priorità produzioni e mansioni L1',jobQueue(e,'L1'),'Le priorità si salvano nella partita.',true),
      card('Distribuzione delle mansioni L1',bars(work,max1(work.map(x=>x[1]))),'Manodopera assegnata dal motore economico.'),
      card('Popolazione per classe',classCard(d),'L2–L4 mantengono capacità produttive proprie.'),
      card('Storico occupazione',jobsTrend(d),'Le assegnazioni variano con cantieri, stagione e risorse.',true),
      card('Posti nelle attività',sites,'Occupati rilevati dal Job Manager economico.',true),
      ...(j.foodRisk?[card('Segnalazioni',warn('Possibile carenza alimentare rispetto al fabbisogno stimato.'),'',true)]:[])
    ]);
  }
  function l2Jobs(d){
    const e=d.economy||{},p=population(d),manager=e.jobManagerL2||{},tasks=manager.tasks||[];
    const assigned=num(manager.assigned),available=num(manager.available);
    const activity=(e.activities||[]).filter(a=>a.tier===2);
    const sites=activity.length?table(['Attività L2','Occupati','Proprietà'],activity.map(a=>[
      '<th>'+esc(a.type)+' · '+esc(a.id)+'</th>','<td>'+fmt(a.workers)+'</td>',
      '<td>'+esc(a.owner==='lord'?'Signore':'Privati')+'</td>'
    ])):empty('Nessun sito produttivo L2 operativo.');
    return kpis([
      kpi('L2 residenti',fmt(p.L2)),
      kpi('L2 disponibili',fmt(available),'Adulto produttivo per nucleo'),
      kpi('L2 assegnati',fmt(assigned),'Oggi'),
      kpi('L2 inattivi',fmt(Math.max(0,available-assigned)),'Posti non impiegati')
    ])+grid([
      card('Priorità produzioni e mansioni L2',jobQueue(e,'L2'),
        'Campi, cave e miniere utilizzano la sola manodopera L2.',true),
      card('Distribuzione L2 per produzione',tasks.length?bars(tasks.map(t=>[t.label,t.workers]),max1(tasks.map(t=>t.workers))):empty('Nessuna produzione L2 presente.')),
      card('Attività L2',sites,'I campi fuori stagione e le imprese disattivate non richiedono lavoratori.',true)
    ]);
  }
  // SCOL-01 phase 1: counters, cap and the lord's hire. Roles, wages and courses come later.
  const HIRE_BLOCK = {gold:'Oro del castello insufficiente.',seats:'Nessun posto libero nelle case L3/L4.',economy:'Economia non inizializzata.'};
  function educatedJobs(d){
    const s=educated(d);
    if(!s)return empty('Scolarizzati non disponibili.');
    const can=s.canHire||{ok:false};
    const hire='<button type="button" class="cp-action" data-cp-educated-hire'+(can.ok?'':' disabled')+'>Ingaggia scolarizzato · '+fmt(s.hireCost)+' oro</button>'+
      (can.ok?'':warn(HIRE_BLOCK[can.reason]||'Ingaggio non disponibile.'))+
      line('In viaggio',fmt(s.hiresInTransit)+(s.nextArrival!=null?' · primo arrivo giorno '+fmt(s.nextArrival):''));
    return kpis([
      kpi('Scolarizzati',fmt(s.total),'Laici '+fmt(s.lay)+' · chierici '+fmt(s.clergy)),
      kpi('Posti L3/L4',fmt(s.capacity.total),'Liberi '+fmt(s.free)),
      kpi('Senza alloggio',fmt(s.homeless),'Emigrano dopo 4 settimane',s.homeless?'bad':''),
      kpi('In viaggio',fmt(s.hiresInTransit),'Arrivano in '+fmt(s.hireDays)+' giorni')
    ])+grid([
      card('Ingaggio del signore',hire,'Il laico arriva dopo due settimane; senza un posto libero all’arrivo l’oro torna al castello.'),
      card('Scolarizzati per classe',bars([['L3',s.byClass.L3],['L4',s.byClass.L4]],max1([s.capacity.L3,s.capacity.L4]))+educatedLine(d),'Un terzo dei residenti: 3 posti per casa L3, 4 per casa L4.'),
      card('Ruoli istruiti',empty('Esattori, giudici, funzionari, chierici e artisti arriveranno con i loro edifici.'),'',true)
    ]);
  }
  function jobQueue(e,tier){
    const jm=(tier==='L2'?e.jobManagerL2:e.jobManager)||{},tasks=jm.tasks||[];
    if(!tasks.length)return empty('Nessuna mansione '+tier+' disponibile.');
    const info='<p class="cp-job-intro">Trascina le righe per modificare la priorità. I minimi sono riservati prima dei posti AUTO; se le richieste superano gli '+tier+' disponibili, prevale la priorità più alta.</p>';
    const columns='<div class="cp-job-columns"><span>PRIORITÀ · MANSIONE</span><span>MINIMUM WORKER</span><span>GESTIONE</span></div>';
    const rows=tasks.map((t,i)=>{
      const unmet=jm.managed&&t.minimum>t.workers&&t.demand>0;
      return '<div class="cp-job-row'+(unmet?' cp-job-short':'')+'" data-cp-job-row="'+esc(t.key)+'" data-cp-job-tier="'+tier+'" draggable="true" role="listitem" aria-label="Priorità '+(i+1)+': '+esc(t.label)+'">'+
        '<span class="cp-job-drag" title="Trascina per cambiare priorità" aria-hidden="true">⠿</span>'+
        '<span class="cp-job-rank">'+(i+1)+'.</span>'+
        '<div class="cp-job-name"><strong>'+esc(t.label)+'</strong><small>'+fmt(t.workers)+' / '+fmt(t.demand)+' lavoratori'+(unmet?' · minimo non raggiunto':t.demand===0?' · nessuna richiesta attiva':'')+'</small></div>'+
        '<label class="cp-job-min">Minimum worker<input type="number" inputmode="numeric" min="0" max="'+t.capacity+'" step="1" value="'+t.minimum+'" data-cp-job-min="'+esc(t.key)+'" data-cp-job-tier="'+tier+'" aria-label="Minimum worker · '+esc(t.label)+'"></label>'+
        '<div class="cp-job-mode"><button type="button" class="cp-job-auto'+(t.auto?' is-auto':'')+'" aria-pressed="'+(t.auto?'true':'false')+'" data-cp-job-auto="'+esc(t.key)+'" data-cp-job-tier="'+tier+'" title="'+(t.auto?'Automatico: assegna i posti residui secondo priorità':'Manuale: assegna soltanto il minimo richiesto')+'">AUTO</button><small>'+(t.auto?'automatico':'manuale')+'</small></div>'+
        '<div class="cp-job-move"><button type="button" data-cp-job-move="up" data-cp-job-key="'+esc(t.key)+'" data-cp-job-tier="'+tier+'" aria-label="Sposta '+esc(t.label)+' in alto"'+(i===0?' disabled':'')+'>↑</button>'+
        '<button type="button" data-cp-job-move="down" data-cp-job-key="'+esc(t.key)+'" data-cp-job-tier="'+tier+'" aria-label="Sposta '+esc(t.label)+' in basso"'+(i===tasks.length-1?' disabled':'')+'>↓</button></div></div>';
    }).join('');
    const note=tier==='L1'?'Pastori protetti e pescatori non sono riassegnabili.':
      'L2 è indipendente da L1; i campi fuori stagione non assorbono lavoratori.';
    return info+(!jm.managed?'<p class="cp-job-legacy">Assegnazione '+tier+' precedente ancora attiva; i nuovi controlli entrano in vigore alla prima modifica.</p>':'')+
      '<div class="cp-job-queue" role="list" aria-label="Priorità delle mansioni '+tier+'">'+columns+rows+'</div>'+
      '<p class="cp-foot">AUTO attivo: dopo i minimi completa i posti disponibili in ordine di priorità. AUTO spento: assegna esattamente il minimo quando disponibile. '+note+'</p>';
  }

  // Trade is a view over the existing market ledger, prices and sale-share command.
  function trade(d) {
    const e=d.economy||{}, goods=e.goods||[];
    return kpis([
      kpi('Oro del signore',fmt(e.castleGold),'Tesoreria'),
      kpi('Capitale mercanti L4',fmt(e.capital),'Oro privato'),
      kpi('Merci al mercato',fmt(sum(goods.map(g=>g.market))),'Scorte nel ledger'),
      kpi('Cicli di mercato',fmt(d.snapshot?.weeks),'Settimane contabilizzate')
    ])+grid([
      card('Scambi e quote di vendita',marketTable(goods),'Le quote regolano la vendita tramite il motore economico esistente.',true),
      card('Prezzi nel tempo',select('data-cp-price','Bene',PRICE_GOODS.map(k=>[k,good(k)]),ui.priceGood)+priceTrend(d),'Storico solo se sono disponibili mercati settimanali.',true),
      card('Carovane',line('Convogli attivi',fmt((d.diplomacy?.caravans||[]).filter(c=>c.status!=='completed').length))+
        '<button type="button" class="cp-action" data-cp-action="caravans">Apri gestione carovane</button>',
        'I convogli strategici sono gestiti dalla funzione esistente.')
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

  // Centro di controllo → Militare shares the real Combat and Siege rosters.
  function militaryNav(){
    const entries=[['overview','Riepilogo'],['garrisons','Pattuglie e guarnigioni']];
    return '<nav class="cp-subnav" role="tablist" aria-label="Gestione militare">'+entries.map(([k,label])=>
      '<button type="button" role="tab" data-cp-military-sub="'+k+'" aria-selected="'+(ui.militaryTab===k)+'" class="'+(ui.militaryTab===k?'active':'')+'">'+label+'</button>'
    ).join('')+'</nav>';
  }

  // Operational CIRCLE hierarchy: closed defensive sectors → macro towers.
  // parentTowerId children are summed into one row, never shown as extra towers.
  const CIRCLE_STATES={secure:'Sicuro',alert:'Allerta',threatened:'Minacciato',
    infiltrated:'Infiltrato',contested:'Conteso',invaded:'Invaso',
    compromised:'Compromesso',captured:'Occupato',unassessed:'Da valutare',outside:'Esterno'};
  function circleMacroRow(m){
    const child=m.subtowers===1?'1 sottotorre aggregata':m.subtowers>1?
      m.subtowers+' sottotorri aggregate':'Torre indipendente';
    const details=fmt(m.assigned)+' / '+fmt(m.capacity)+' arcieri · '+fmt(m.active)+' operativi';
    const archers='<div class="cp-circle-staff"><span>Arcieri</span><div class="cp-job-garrison-buttons">'+
      '<button type="button" data-cp-macro-id="'+esc(m.id)+'" data-cp-macro-delta="-1"'+
      (!m.assigned?' disabled':'')+' aria-label="Rimuovi arciere da '+esc(m.label)+'">−</button>'+
      '<button type="button" data-cp-macro-id="'+esc(m.id)+'" data-cp-macro-delta="1"'+
      (m.assigned>=m.capacity?' disabled':'')+' aria-label="Assegna arciere a '+esc(m.label)+'">+</button></div></div>';
    const squads=m.squadCapacity?'<div class="cp-circle-staff"><span>Armigeri '+fmt(m.squads)+'/'+fmt(m.squadCapacity)+'</span>'+
      '<div class="cp-job-garrison-buttons">'+
      '<button type="button" data-cp-macro-squad="'+esc(m.id)+'" data-cp-macro-squad-delta="-1"'+
      (!m.squads?' disabled':'')+' aria-label="Rimuovi squadra da '+esc(m.label)+'">−</button>'+
      '<button type="button" data-cp-macro-squad="'+esc(m.id)+'" data-cp-macro-squad-delta="1"'+
      (m.squads>=m.squadCapacity?' disabled':'')+' aria-label="Assegna squadra a '+esc(m.label)+'">+</button></div></div>':'';
    return '<div class="cp-job-garrison cp-circle-macro" data-cp-macro="'+esc(m.id)+'">'+
      '<div class="cp-circle-macro-name"><b>'+esc(m.label)+'</b><small>'+esc(child)+'</small>'+
      '<small>'+details+'</small></div><div class="cp-circle-staffers">'+archers+squads+'</div></div>';
  }
  function circleBarracksRow(b){
    return '<div class="cp-job-garrison"><div><b>'+esc(b.label)+'</b>'+
      '<small>'+fmt(b.assigned)+' / '+fmt(b.capacity)+' squadre da 5 armigeri</small></div>'+
      '<div class="cp-job-garrison-buttons">'+
      '<button type="button" data-cp-barracks-id="'+esc(b.id)+'" data-cp-barracks-delta="-1"'+(!b.assigned?' disabled':'')+' aria-label="Rimuovi squadra">−</button>'+
      '<button type="button" data-cp-barracks-id="'+esc(b.id)+'" data-cp-barracks-delta="1"'+
      (b.assigned>=b.capacity?' disabled':'')+' aria-label="Assegna squadra">+</button></div></div>';
  }
  function circleZoneRow(zone,unassigned,hasCircle=true){
    const collapsed=ui.circleCollapsed.has(zone.id);
    const isOutside=zone.id==='outside';
    const summary=fmt(zone.assigned)+'/'+fmt(zone.capacity)+' arcieri · '+fmt(zone.patrols)+' pattuglie';
    const archerTools='<div class="cp-circle-staff"><span>Arcieri</span><div class="cp-job-garrison-buttons">'+
      '<button type="button" data-cp-circle-archer="'+esc(zone.id)+'" data-cp-circle-delta="-1"'+
      (!zone.assigned?' disabled':'')+' aria-label="Rimuovi un arciere dal '+esc(zone.label)+'">−</button>'+
      '<button type="button" data-cp-circle-archer="'+esc(zone.id)+'" data-cp-circle-delta="1"'+
      (zone.assigned>=zone.capacity?' disabled':'')+' aria-label="Assegna un arciere al '+esc(zone.label)+'">+</button></div></div>';
    const patrolTools=isOutside?'':'<div class="cp-circle-staff"><span>Pattuglie</span><div class="cp-job-garrison-buttons">'+
      '<button type="button" data-cp-circle-patrol="'+esc(zone.id)+'" data-cp-circle-delta="-1"'+
      (!zone.patrols?' disabled':'')+' aria-label="Richiama una pattuglia dal '+esc(zone.label)+'">−</button>'+
      '<button type="button" data-cp-circle-patrol="'+esc(zone.id)+'" data-cp-circle-delta="1"'+
      (!unassigned?' disabled':'')+' aria-label="Assegna una pattuglia al '+esc(zone.label)+'">+</button></div></div>';
    const macros=zone.towers||[],rooms=zone.otherBarracks||[];
    const detail=macros.map(circleMacroRow).join('')+rooms.map(circleBarracksRow).join('')||
      empty('Nessuna torre o caserma operativa associata a questo compartimento.');
    return '<section class="cp-circle-zone" data-cp-zone="'+esc(zone.id)+'">'+
      '<div class="cp-circle-zone-head">'+
      '<button type="button" class="cp-circle-expand" data-cp-circle-toggle="'+esc(zone.id)+'" aria-expanded="'+(!collapsed)+'">'+
      '<span aria-hidden="true">'+(collapsed?'▸':'▾')+'</span><span><b>'+esc(zone.label)+
      (zone.mastio?' · Mastio':'')+'</b><small>'+esc(isOutside?'Nessun compartimento difensivo chiuso':
        'CIRCLE · livello '+zone.depth+' · '+(CIRCLE_STATES[zone.state]||zone.state))+'</small>'+
      '<small>'+summary+'</small></span></button>'+
      '<div class="cp-circle-staffers">'+archerTools+patrolTools+'</div></div>'+
      (collapsed?'':'<div class="cp-circle-zone-body">'+detail+'</div>')+'</section>';
  }
  function militaryAssignments(d){
    const a=d.militaryAssignments||{},patrols=a.patrols||[],zones=a.zones||[],outside=a.outside||{towers:[],otherBarracks:[],patrols:0,assigned:0,capacity:0};
    const reserved=num(outside.patrols),total=patrols.length;
    const global='<div class="cp-job-garrison"><div><b>Riserva White Zone</b>'+
      '<small>'+fmt(reserved)+' pattuglie disponibili per assegnazioni CIRCLE · '+fmt(total)+' complessive</small></div>'+
      '<div class="cp-job-garrison-buttons"><button type="button" data-cp-patrol="remove"'+
      (!reserved?' disabled':'')+' aria-label="Rimuovi una pattuglia dalla riserva">−</button>'+
      '<button type="button" data-cp-patrol="add" aria-label="Aggiungi una pattuglia alla riserva">+</button></div></div>';
    const totalTowers=(a.macros||[]);
    const sectorRows=zones.map(z=>circleZoneRow(z,reserved)).join('');
    const outsideVisible=outside.towers?.length||outside.otherBarracks?.length;
    const outRow=outsideVisible?circleZoneRow(outside,reserved,false):'';
    const note=!a.circleReady?warn('CIRCLE non è ancora disponibile: le torri sono elencate fuori dai compartimenti.'):
      !zones.length?empty('CIRCLE non rileva ancora zone difensive chiuse: completa il perimetro per assegnare presidi per settore.'):'';
    return kpis([
      kpi('Settori CIRCLE',fmt(zones.length),'Compartimenti chiusi reali'),
      kpi('Pattuglie assegnate',fmt(total-reserved),'Nei settori CIRCLE'),
      kpi('Arcieri assegnati',fmt(a.totalAssigned),'Nelle torri e sottotorri'),
      kpi('Macrostrutture',fmt(totalTowers.length),'Torri madri con sottotorri aggregate')
    ])+grid([
      card('Riserva pattuglie',global,
        'Le pattuglie nella riserva seguono la White Zone. Assegnare a un settore trasferisce una pattuglia esistente, senza reclutarne una nuova.',true),
      card('CIRCLE · Settori e presidi',note+sectorRows+outRow,
        'Gerarchia reale: compartimento CIRCLE → torre madre. Il comando a livello settore distribuisce arcieri nei posti disponibili delle torri sottostanti.',true),
      ...(!a.hasCampManagement?[card('Caserme',empty('L’assegnazione di squadre nelle caserme è disponibile nella modalità /camp.'),'',true)]:[])
    ]);
  }
  function military(d) {
    const c=d.defense||{}, k=d.knights||{}, l=d.logistics||{};
    if(ui.militaryTab==='garrisons')return militaryNav()+militaryAssignments(d);
    const live = v => c.active ? fmt(v) : '—';
    return militaryNav()+kpis([
      kpi('Unità alleate',live(c.units),'Presenti nel combat'),
      kpi('Pattuglie',live(c.patrols)),
      kpi('Cavalieri',k.current==null?'—':fmt(k.current)+' / '+fmt(k.limit)),
      kpi('Capienza caserme',fmt(l.soldiers),'Posti, non soldati'),
      kpi('Nemici rilevati',live(c.hostiles),'',c.active&&num(c.hostiles)>0?'bad':''),
      kpi('Allarme',c.alarm||'—')
    ])+grid([
      card('Cavalleria disponibile',bars([['Cavalieri reclutati',k.current],['Posti disponibili',k.limit]],num(k.limit))),
      card('Leva straordinaria',(()=>{
        const T=window.ConquerTreasury, on=T?.active?.('levy'), a=on&&T.snapshot().decrees.levy.entry;
        return on ? line('In vigore fino al giorno',fmt(a.end))+line('Uomini L1/L2 in armi',fmt(a.share)+'%') :
          empty('Nessuna leva in vigore. La leva straordinaria è un decreto del consiglio: Profilo › Erario.');
      })())
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
      crenelCard(),
      roofPitchCard()
    ]);
  }
  const PITCHES = [[30,'30°','Tetti bassi, il più economico.'],[45,'45°','Pendenza di base.'],[60,'60°','Tetti ripidi a guglia: più legname.'],[75,'75°','Guglie slanciate: il più costoso, serve anche pietra.']];
  function roofPitchCard() {
    const cmd = window.ConquerGame?.commands;
    if(!cmd?.roofPitchQuote)return '';
    const current = typeof roofPitch==='function' ? roofPitch() : 45;
    const rows = PITCHES.map(([id,label,tip])=>{
      const q = cmd.roofPitchQuote(id), on = id===current;
      return '<div class="cp-line"><span>'+esc(label)+' <small>'+esc(tip)+'</small></span>'+
        (on ? '<b>In uso</b>' : '<button type="button" class="cp-action" data-cp-pitch="'+id+'">Adotta · '+esc(costLine(q.cost))+'</button>')+'</div>';
    }).join('');
    const n = cmd.roofPitchQuote(current).roofs;
    return card('Pendenza dei tetti',rows+(ui.pitchMsg?warn(ui.pitchMsg):''),
      'Rifà i '+fmt(n)+' tetti a falde di torri e porte; il costo cresce con il numero di tetti. Le nuove costruzioni usano la pendenza scelta.',true);
  }
  const CRENELS = [['flat','Piatta','Blocco squadrato, lo stile di base.'],['gabled','Doppia falda','Sommità a due spioventi.'],['swallowtail','Coda di rondine','Corna a V e feritoia: la più costosa.'],['double','Merlo doppio','Merli lunghi il doppio sulle mura: due pieni, un vuoto.'],['tworow','Doppia fila','Seconda fila di merli sul lato interno del cammino delle mura.']];
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
  // ---- Erario (FISCO-01): rates always settable; the town hall sets collection efficiency ----
  const PCT = v => fmt(Math.round(num(v)*100))+'%';
  const TAX_PAYERS = {sales:'paga L4 (venditori)',poll:'pagano L1 e L2',dues:'paga L3 (botteghe)',toll:'pagano i mercanti forestieri',tithe:'paga L4 (raccolti privati)'};
  function erario() {
    const T = window.ConquerTreasury;
    if(!T)return card('Erario',empty('Modulo Erario non caricato.'));
    const s = T.snapshot(), ef = s.efficiency, last = s.last;
    const sliders = Object.entries(T.TAXES).map(([k,spec])=>{
      const v = s.rates[k], p = T.preview(k,v)||{};
      const value = spec.unit.startsWith('%') ? fmt(v)+'%' : num(v).toLocaleString('it-IT',{minimumFractionDigits:spec.step<1?2:0,maximumFractionDigits:2})+' oro';
      const est = p.due==null ? 'gettito: si misura dopo una settimana con aliquota' :
        'dovuto ≈ '+fmt(p.due)+' · incassato ≈ '+fmt(p.collected)+' oro/sett.';
      const mood = p.unrest>0 ? ' · felicità −'+fmt(p.unrest)+'/sett.' : '';
      // The sales tax is withheld at the market, in full: the town hall's efficiency does not apply.
      const info = k==='sales' ? 'trattenuta al mercato, per intero' : 'efficienza '+PCT(p.efficiency)+' · '+est;
      return '<label class="cp-input">'+esc(spec.label)+' <b>'+esc(value)+'</b>'+
        '<input type="range" data-cp-tax="'+k+'" min="'+spec.min+'" max="'+spec.max+'" step="'+spec.step+'" value="'+v+'">'+
        '<small>'+esc(spec.unit+' · '+TAX_PAYERS[k]+' · '+info+mood)+'</small></label>';
    }).join('');
    const quarters = ef.quarters.length ? ef.quarters.map(q=>line(q.name+(q.bargello?' · Bargello L'+q.bargello:' · senza Bargello'),PCT(q.efficiency))).join('') : empty('Nessun quartiere oltre il centro.');
    const balivi = ef.balivi.length ? ef.balivi.map((b,i)=>line('Palazzo del Balivo '+(i+1)+' · L'+b.level,PCT(b.efficiency))).join('') : line('Contado senza Balivo',PCT(ef.countryside));
    const decrees = Object.entries(T.DECREES).map(([id,spec])=>{
      const st = s.decrees[id], on = st.active;
      const extra = id==='levy'&&!on ?
        select('data-cp-levy="days"','Durata',spec.options.days.map(n=>[String(n),n+' giorni']),String(ui.levyDays||spec.options.days[0]))+
        select('data-cp-levy="share"','Uomini L1/L2',spec.options.share.map(n=>[String(n),n+'%']),String(ui.levyShare||spec.options.share[0])) : '';
      const action = on ? '<b>In vigore fino al giorno '+fmt(st.entry.end)+'</b> <button type="button" class="cp-action" data-cp-revoke="'+id+'">Revoca</button>' :
        st.status.ok ? '<button type="button" class="cp-action" data-cp-decree="'+id+'">Emana'+(spec.cost?' · '+fmt(spec.cost)+' oro':'')+'</button>' :
        '<small>'+esc(st.status.reason)+'</small>';
      return '<div class="cp-line"><span>'+esc(spec.label)+' <small>L'+spec.level+' · '+esc(spec.help)+'</small></span>'+action+'</div>'+extra;
    }).join('');
    const hist = last ? ['poll','dues','toll','tithe'].map(k=>line(T.TAXES[k].label,fmt(last.collected[k])+' / '+fmt(last.due[k])+(k==='tithe'?' (in natura)':' oro'))).join('') :
      empty('Nessuna riscossione ancora: si incassa il sabato, dopo il mercato.');
    return kpis([
      kpi('Municipio del centro',ef.townhall?'L'+ef.townhall:'Assente',ef.townhall?'':'Riscossione al 30%',ef.townhall?'':'warn'),
      kpi('Efficienza centro',PCT(ef.centre),ef.crisis?'Sospesa: allarme o assedio':'',ef.crisis?'bad':''),
      kpi('Esattori',fmt(ef.collectors.seats)+' posti',ef.collectors.yield<1?'Coperti al '+PCT(ef.collectors.yield):'Personale istruito (Scolarizzati)'),
      kpi('Sala delle guardie',ef.guardRoom?'Sì · +5%':'No')
    ])+grid([
      card('Imposte',sliders,'Le aliquote si fissano sempre, anche senza Municipio. Incassato = dovuto × efficienza; il resto è evasione.',true),
      card('Efficienza di riscossione',line('Centro',PCT(ef.centre))+quarters+balivi,'Tetto del Municipio L1 60% · L2 75% · L3 85%, massimo 95%. Felicità bassa di chi paga: fino a −20%.'),
      card('Ultima settimana · incassato / dovuto',hist),
      card('Decreti del consiglio',(ui.decreeMsg?warn(ui.decreeMsg):'')+decrees,'Si emanano dalla sala del consiglio del Municipio del centro, a durata.',true)
    ]);
  }
  const views = {general,people,economy,estate,stores,military,building,diplomacy,alerts};
  const PALETTES = {jobs:['Job Manager','Priorità e assegnazioni L1 / L2, scolarizzati L3'],trade:['Trade','Mercato, prezzi e quote di vendita'],erario:['Erario','Imposte, riscossione e decreti']};

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
    const palette=PALETTES[ui.mode];
    $('controlNav').hidden=!!palette;
    $('controlNav').innerHTML=palette?'':nav(d);
    const [,title,subtitle] = palette ? [ui.mode,...palette] : (TABS.find(t=>t[0]===ui.tab) || TABS[0]);
    body.innerHTML = !d.founded
      ? card('Insediamento non fondato',empty('Fonda il villaggio: le risorse di test del Builder non sono statistiche economiche.'))
      : '<div class="cp-head"><h2>'+esc(title)+'</h2><p>'+esc(subtitle)+'</p></div>'+(palette ? (ui.mode==='jobs'?jobs(d):ui.mode==='erario'?erario(d):trade(d)) : (views[ui.tab]||general)(d));
    [...(body.querySelectorAll?.('.cp-scroll')||[])].forEach((el,i)=>{ if(scrolls[i])el.scrollLeft = scrolls[i]; });
  }
  function open(mode='control') { ui.mode=Object.hasOwn(PALETTES,mode)?mode:'control'; render(); }

  function reorderJob(key,target,tier='L1'){
    const economy=window.ConquerGame?.read?.economy?.();
    const order=((tier==='L2'?economy?.jobManagerL2:economy?.jobManager)?.tasks||[]).map(t=>t.key);
    const from=order.indexOf(key),to=order.indexOf(target);
    if(from<0||to<0||from===to)return false;
    order.splice(from,1);order.splice(to,0,key);
    return !!window.ConquerGame?.commands?.[tier==='L2'?'setL2Order':'setL1Order']?.(order);
  }

  const root = $('profileControl');
  if(root){
    root.addEventListener('click',ev=>{
      const tier = ev.target.closest('[data-cp-jobs-tier]');
      if(tier){ui.jobTier=['L2','L3'].includes(tier.dataset.cpJobsTier)?tier.dataset.cpJobsTier:'L1';render();return;}
      if(ev.target.closest('[data-cp-educated-hire]')){window.ConquerGame?.commands?.hireEducated?.();render();return;}
      const msub = ev.target.closest('[data-cp-military-sub]');
      if(msub){ui.militaryTab=msub.dataset.cpMilitarySub==='garrisons'?'garrisons':'overview';render();return;}
      const collapse = ev.target.closest('[data-cp-circle-toggle]');
      if(collapse){
        const id=collapse.dataset.cpCircleToggle;
        if(ui.circleCollapsed.has(id))ui.circleCollapsed.delete(id);
        else ui.circleCollapsed.add(id);
        render();return;
      }
      const zonePatrol = ev.target.closest('[data-cp-circle-patrol]');
      if(zonePatrol){
        window.ConquerGame?.commands?.assignCirclePatrol?.(zonePatrol.dataset.cpCirclePatrol,Number(zonePatrol.dataset.cpCircleDelta));
        render();return;
      }
      const zoneArcher = ev.target.closest('[data-cp-circle-archer]');
      if(zoneArcher){
        window.ConquerGame?.commands?.adjustZoneArchers?.(zoneArcher.dataset.cpCircleArcher,Number(zoneArcher.dataset.cpCircleDelta));
        render();return;
      }
      const macroArcher = ev.target.closest('[data-cp-macro-id]');
      if(macroArcher){
        window.ConquerGame?.commands?.adjustMacroArchers?.(macroArcher.dataset.cpMacroId,Number(macroArcher.dataset.cpMacroDelta));
        render();return;
      }
      const macroSquad = ev.target.closest('[data-cp-macro-squad]');
      if(macroSquad){
        window.ConquerGame?.commands?.adjustMacroSquads?.(macroSquad.dataset.cpMacroSquad,Number(macroSquad.dataset.cpMacroSquadDelta));
        render();return;
      }
      const patrol = ev.target.closest('[data-cp-patrol]');
      if(patrol){window.ConquerGame?.commands?.adjustPatrols?.(patrol.dataset.cpPatrol==='add'?1:-1);render();return;}
      const tower = ev.target.closest('[data-cp-tower-id]');
      if(tower){window.ConquerGame?.commands?.adjustTowerArchers?.(tower.dataset.cpTowerId,Number(tower.dataset.cpTowerDelta));render();return;}
      const barracks = ev.target.closest('[data-cp-barracks-id]');
      if(barracks){window.ConquerGame?.commands?.adjustBarracksSquads?.(barracks.dataset.cpBarracksId,Number(barracks.dataset.cpBarracksDelta));render();return;}
      const tab = ev.target.closest('[data-cp-tab]');
      if(tab){ui.tab = tab.dataset.cpTab; ui.mode='control'; render(); return;}
      const auto = ev.target.closest('[data-cp-job-auto]');
      if(auto){
        const key=auto.dataset.cpJobAuto;
        const tier=auto.dataset.cpJobTier==='L2'?'L2':'L1',economy=window.ConquerGame?.read?.economy?.();
        const task=(tier==='L2'?economy?.jobManagerL2:economy?.jobManager)?.tasks?.find(t=>t.key===key);
        if(task)window.ConquerGame?.commands?.[tier==='L2'?'setL2Auto':'setL1Auto']?.(key,!task.auto);
        render();return;
      }
      const move = ev.target.closest('[data-cp-job-move]');
      if(move){
        const economy=window.ConquerGame?.read?.economy?.();
        const tasks=(move.dataset.cpJobTier==='L2'?economy?.jobManagerL2:economy?.jobManager)?.tasks||[];
        const index=tasks.findIndex(t=>t.key===move.dataset.cpJobKey);
        const next=index+(move.dataset.cpJobMove==='up'?-1:1);
        if(index>=0&&next>=0&&next<tasks.length)reorderJob(tasks[index].key,tasks[next].key,move.dataset.cpJobTier==='L2'?'L2':'L1');
        render();return;
      }
      const trade = ev.target.closest('[data-cp-transfer]');
      if(trade){window.ConquerGame?.commands?.transferActivity?.(trade.dataset.cpTransfer,trade.dataset.cpOwner); render(); return;}
      const pitch = ev.target.closest('[data-cp-pitch]');
      if(pitch){
        const out = window.ConquerGame?.commands?.setRoofPitch?.(pitch.dataset.cpPitch);
        ui.pitchMsg = out?.ok ? '' : out?.reason==='funds' ? 'Risorse insufficienti per rifare i tetti.' : '';
        render(); return;
      }
      const crenel = ev.target.closest('[data-cp-crenel]');
      if(crenel){
        const out = window.ConquerGame?.commands?.setCrenelStyle?.(crenel.dataset.cpCrenel);
        ui.crenelMsg = out?.ok ? '' : out?.reason==='funds' ? 'Risorse insufficienti per rifare le merlature.' : '';
        render(); return;
      }
      const decree = ev.target.closest('[data-cp-decree]');
      if(decree){
        const id=decree.dataset.cpDecree;
        const out=window.ConquerTreasury?.issue?.(id,id==='levy'?{days:ui.levyDays,share:ui.levyShare}:{});
        ui.decreeMsg = out?.ok ? '' : out?.reason||'';
        render(); return;
      }
      const revoke = ev.target.closest('[data-cp-revoke]');
      if(revoke){window.ConquerTreasury?.revoke?.(revoke.dataset.cpRevoke);ui.decreeMsg='';render();return;}
      if(ev.target.closest('[data-cp-action="caravans"]')){$('profileOverlay').hidden = true; window.ConquerGame?.commands?.openCaravans?.();}
    });
    root.addEventListener('input',ev=>{
      if(ev.target.dataset.cpPolicy!=='tax')return;
      const badge = ev.target.closest?.('.cp-input')?.querySelector('b');
      if(badge)badge.textContent = ev.target.value+'%';
    });
    root.addEventListener('change',ev=>{
      const el = ev.target, cmd = window.ConquerGame?.commands;
      if(el.dataset.cpJobMin)cmd?.[el.dataset.cpJobTier==='L2'?'setL2Minimum':'setL1Minimum']?.(el.dataset.cpJobMin,Number(el.value));
      if(el.dataset.cpPolicy)cmd?.setPolicy?.(el.dataset.cpPolicy,el.value);
      if(el.dataset.cpTax)window.ConquerTreasury?.setRate?.(el.dataset.cpTax,Number(el.value));
      if(el.dataset.cpLevy==='days')ui.levyDays=Number(el.value);
      if(el.dataset.cpLevy==='share')ui.levyShare=Number(el.value);
      if(el.dataset.cpShare)cmd?.setSaleShare?.(el.dataset.cpShare,num(el.value));
      if(el.matches?.('[data-cp-price]'))ui.priceGood = el.value;
      if(el.matches?.('[data-cp-estate]'))ui.site = el.value;
      render();
    });
    // HTML drag and drop, plus keyboard/touch move buttons on every row.
    root.addEventListener('dragstart',ev=>{
      const row=ev.target.closest?.('[data-cp-job-row]');
      if(!row||ev.target.closest?.('button,input'))return;
      ui.dragJob={key:row.dataset.cpJobRow,tier:row.dataset.cpJobTier==='L2'?'L2':'L1'};
      if(ev.dataTransfer){ev.dataTransfer.effectAllowed='move';ev.dataTransfer.setData('text/plain',ui.dragJob.key);}
      row.classList?.add('cp-job-dragging');
    });
    root.addEventListener('dragover',ev=>{
      const row=ev.target.closest?.('[data-cp-job-row]');
      if(!ui.dragJob||!row)return;
      ev.preventDefault();
      if(ev.dataTransfer)ev.dataTransfer.dropEffect='move';
      root.querySelectorAll?.('.cp-job-over').forEach(el=>el.classList.remove('cp-job-over'));
      if(row.dataset.cpJobRow!==ui.dragJob.key)row.classList?.add('cp-job-over');
    });
    root.addEventListener('drop',ev=>{
      const row=ev.target.closest?.('[data-cp-job-row]'),drag=ui.dragJob;
      if(!row||!drag||drag.tier!==(row.dataset.cpJobTier==='L2'?'L2':'L1'))return;
      ev.preventDefault();
      ui.dragJob=null;
      reorderJob(drag.key,row.dataset.cpJobRow,drag.tier);
      render();
    });
    root.addEventListener('dragend',()=>{
      ui.dragJob=null;
      root.querySelectorAll?.('.cp-job-dragging,.cp-job-over').forEach(el=>el.classList.remove('cp-job-dragging','cp-job-over'));
    });
    // Live refresh while visible; never while the player is using a control inside.
    const refresh = () => { if(!ui.dragJob&&!$('profileOverlay')?.hidden && !root.hidden && !root.contains(document.activeElement))render(); };
    let pending = false;
    const throttled = () => { if(pending)return; pending = true; setTimeout(()=>{pending = false; refresh();},500); };
    if(typeof window.ConquerGame?.subscribe==='function')window.ConquerGame.subscribe(throttled);
    // Simulation ticks do not all emit; a slow heartbeat keeps the numbers current.
    setInterval(refresh,4000);
  }
  window.ConquerPanels = Object.freeze({open,render,tabs:TABS.map(x=>x[0])});
})();
