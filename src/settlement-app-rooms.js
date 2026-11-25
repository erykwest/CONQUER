'use strict';
// Tower/building function panels and room controls. Extracted verbatim from settlement-app.js.
// Labels carry save/player text (quarter and well names): escape them before innerHTML. The shared
// escaper is ConquerPanels.escapeHtml; camp/ does not load settlement-panels.js, hence the fallback.
function roomEsc(v){return window.ConquerPanels?.escapeHtml?.(v)??String(v).replace(/[&<>"']/g,c=>'&#'+c.charCodeAt(0)+';')}
// Inspector layout: the panel title names the selection (no "Selected" row), explanatory legends
// stay hidden until the ⓘ header button shows them, and only `.legend.live` (current state) is
// always visible. Prototype test controls (siege damage) need a DEV build switch on.
function inspectorDev(){return typeof State!=='undefined'&&Object.values(State.devBuild||{}).some(Boolean)}
function inspectorTitle(html){
  const panel=document.getElementById('functionPanel'),head=panel?.querySelector?.('.panel-head');
  if(!head)return;
  const h=head.querySelector('h2');if(h)h.innerHTML=html;
  if(!head.querySelector('[data-inspector-help]')){
    const help=document.createElement('button');
    help.className='icon-btn';help.dataset.inspectorHelp='true';help.textContent='i';
    help.title='Mostra / nascondi spiegazioni';help.setAttribute('aria-pressed','false');
    help.onclick=()=>help.setAttribute('aria-pressed',String(panel.classList.toggle('show-help')));
    head.insertBefore(help,head.querySelector('#closeFunctions'));
    inspectorTips(panel);
  }
}
// Hover overlay for row labels and buttons (labels and button text will become icons): shows the
// element's title, else its text. The native title moves to data-tip so it does not show twice.
function inspectorTips(panel){
  const tip=document.createElement('div');tip.className='insp-tip';tip.hidden=true;document.body.appendChild(tip);
  const target=e=>e.target?.closest?.('#functionPanel .slot-label,#functionPanel button,#functionPanel .kv,#functionPanel .res-ic');
  panel.addEventListener('mouseover',e=>{
    const el=target(e);if(!el){tip.hidden=true;return}
    if(el.title){el.dataset.tip=el.title;el.removeAttribute('title')}
    const text=(el.dataset.tip||el.textContent||'').trim();if(!text){tip.hidden=true;return}
    tip.textContent=text;tip.hidden=false;
    const r=el.getBoundingClientRect(),w=tip.offsetWidth;
    tip.style.left=Math.max(4,Math.min(innerWidth-w-4,r.left+r.width/2-w/2))+'px';
    tip.style.top=Math.max(4,r.top-tip.offsetHeight-6)+'px';
  });
  panel.addEventListener('mouseleave',()=>{tip.hidden=true});
  panel.addEventListener('click',()=>{tip.hidden=true});
}
// A greyed-out option explains itself in its tooltip instead of a legend under the row.
const inspectorRes=k=>typeof resIcon==='function'?resIcon(k):roomEsc(k);
const inspectorWhy=(ok,text)=>ok?'':' disabled title="'+roomEsc(text)+'"';
function siteLaborText(s){
  if(s?.auto&&s.spawnCost)
    return 'Spontaneous spawn: '+Number(s.spawnCost.laborGold||0).toFixed(2)+' gold in labor value (not charged to lord)';
  if(s?.construction?.version!==2)return '';
  if(devBuildMode('freeBuild'))return 'Free build DEV: nessun salario addebitato';
  const c=s.construction,rate=window.ConquerEconomy?.constructionWagePerWorkday?.()||0;
  return 'Lord construction wages: '+Number(c.wagesPaid||0).toFixed(2)+
    ' gold paid · '+((Math.max(0,c.workRequired-c.workDone))*rate).toFixed(2)+' gold remaining at current wage';
}
function siteLaborLine(s){
  const txt=siteLaborText(s);
  return txt?'<div class="legend live" data-site-wages="true">'+txt+'</div>':'';
}

// Hoarding of a stone tower or gate: mounted or taken down, the roof stays as built.
function hoardingSlot(s){
  const ok=hoardingAllowed(s),on=hoardingMounted(s);
  return`<div class="slot"><div class="slot-label">Ballatoio</div><div class="grid"><button data-hoarding="off" class="${on?'':'active'}">Smontato</button><button data-hoarding="on"${inspectorWhy(ok,s.type==='gate'?'Non sopra il piano a graticcio':'Non con le caditoie in pietra né con le garitte')} class="${on?'active':''}">Montato</button></div><div class="legend">Galleria di legno montata in tempo di guerra attorno alla cima (sotto la gronda se c'è il tetto a falde), con caditoie nel pavimento; il tetto resta quello costruito. Può bruciare.</div></div>`;
}
function renderFunctionPanel(){
  const panel=document.getElementById('functionPanel'),info=document.getElementById('functionInfo'),slots=document.getElementById('functionSlots'),s=selectedStructure();
  // Every incomplete structure has a dedicated, provisional inspector.
  // Do not expose functions, upgrades or operational controls during assembly.
  if(s&&underConstruction(s)){
    const c=s.construction,mat=constructionMaterialInfo(s);
    const progress=Math.round(constructionProgress(s)*100);
    const supplied=Math.round(mat.progress*100);
    const fmt=n=>Number(n).toLocaleString('it-IT',{maximumFractionDigits:2});
    panel.classList.add('open');
    inspectorTitle('Cantiere · '+roomEsc(structureLabel(s)));
    info.innerHTML='<div class="construction-inspector">'+
      '<div class="site-label">Avanzamento lavori · '+progress+'%</div>'+
      '<div class="progress"><i style="width:'+progress+'%"></i></div>'+
      '<div class="kv"><span>Lavoro residuo</span><b>'+fmt(remainingDays(s))+' giornate</b></div>'+
      '<div class="site-label">Materiali consegnati · '+supplied+'%</div>'+
      '<div class="progress site-material-progress"><i style="width:'+supplied+'%"></i></div>'+
      '<div class="site-material-grid">'+mat.rows.map(r=>
        '<div class="kv"><span>'+inspectorRes(r.key)+'</span><b>'+fmt(r.delivered)+' / '+fmt(r.total)+'</b></div>'
      ).join('')+'</div>'+
      '<div class="legend live">'+constructionWorkStatus(s)+'</div>'+siteLaborLine(s)+'</div>';
    const editable=c?.version===2&&(!s.auto||c.upgrade);
    slots.innerHTML=editable?
      '<div class="slot construction-priority"><label class="slot-label" for="constructionPrioritySelect">Priorità approvvigionamento</label>'+
      '<select id="constructionPrioritySelect" aria-label="Priorità cantiere">'+
      CONSTRUCTION_PRIORITIES.map((label,value)=>
        '<option value="'+value+'"'+(constructionPriority(s)===value?' selected':'')+'>'+label+'</option>').join('')+
      '</select><div class="legend">Le scorte disponibili vengono assegnate prima ai cantieri con priorità più alta. Nessun materiale è richiesto per confermare il progetto.</div></div>':
      '<div class="legend live">Cantiere spontaneo · non prioritizzabile.</div>';
    const select=slots.querySelector('#constructionPrioritySelect');
    if(select)select.onchange=()=>StructureCommands.setConstructionPriority(s.id,Number(select.value));
    if(editable||c?.upgrade){const cancel=document.createElement('button');cancel.textContent='Annulla cantiere';cancel.dataset.cancelConstruction='true';cancel.onclick=()=>deleteStructure(s.id);slots.appendChild(cancel);}
    return;
  }
  if(window.ConquerStorageYard?.is(s)){
    const Y=window.ConquerStorageYard,n=Y.size(s),next=n+2,stock=Y.stocks();
    const goods=Object.entries(stock).filter(([,qty])=>qty>0);
    const haul=window.ConquerHaulage?.snapshot?.();
    const fmt=val=>Number(val).toLocaleString('it-IT',{maximumFractionDigits:1});
    panel.classList.add('open');
    inspectorTitle('Piazzale · '+n+'×'+n+'U');
    info.innerHTML=''+
      '<div class="kv"><span>Scorte nel magazzino</span><b>'+fmt(Y.used())+' / '+fmt(Y.capacity())+'</b></div>'+
      goods.map(([name,qty])=>'<div class="kv"><span>'+inspectorRes(name)+'</span><b>'+fmt(qty)+'</b></div>').join('')+
      (haul?'<div class="kv"><span>Carrettieri L1</span><b>'+haul.assigned+' assegnati · '+haul.active+' viaggi · '+haul.pending+' carichi in attesa</b></div>'+
        '<div class="kv"><span>Rotte</span><b>'+haul.toYard+' ai piazzali · '+haul.toMarket+' al mercato</b></div>':'')+
      '<div class="legend">Ogni carrettiere è un L1 reale del JobManager. Parte dal piazzale, ritira al produttore e consegna al deposito o al mercato. Richiede strade completate; le scorte sono contabilizzate una sola volta dal sistema economico.</div>';
    const cost=Y.expansionCost(n,next);
    slots.innerHTML=cost?
      '<div class="slot"><div class="slot-label">Ampliamento</div><button data-stockyard-grow title="'+roomEsc(costText(cost))+'">Espandi a '+next+'×'+next+'U</button>'+
      '<div class="legend">Area libera e pianeggiante richiesta; aumento capacità disponibile al termine del cantiere.</div></div>':
      '<div class="legend">Capienza massima raggiunta · 6×6U.</div>';
    const button=slots.querySelector('[data-stockyard-grow]');
    if(button)button.onclick=()=>StructureCommands.setYardSize(s.id,next);
    return;
  }
  if(window.ConquerIndustries?.is(s)){
    const spec=window.ConquerIndustries.definition(s),econ=window.ConquerEconomy;
    const staff=econ?.staffing?.()[s.id]||0;
    const details=econ?.state()?.activities?.[s.id],owner=details?.owner||(s.economicOwner==='lord'?'lord':'private');
    panel.classList.add('open');
    inspectorTitle(roomEsc(structureLabel(s)));
    info.innerHTML=`<div class="kv"><span>Lavoratori · L${spec.tier}</span><b>${staff} / ${spec.workers}</b></div><div class="kv"><span>Produzione</span><b>${staff} ${spec.good} / giorno</b></div><div class="kv"><span>Proprietario</span><b>${owner==='lord'?'Signore':'Privato L4'}</b></div>${underConstruction(s)?`<div class="legend">Under construction · ${s.construction?.version===2?constructionWorkStatus(s)+' · '+remainingDays(s).toFixed(1)+' worker-days left':remainingDays(s).toFixed(1)+' calendar days'}</div>`:''}`;
    if(s.type==='loggingCamp'){
      const snap=econ?.snapshot?.(),active=staff>0&&!underConstruction(s);
      info.innerHTML+='<div class="kv"><span>'+inspectorRes('wood')+' castello</span><b>'+Number(snap?.castle?.wood||0).toFixed(1)+'</b></div>'+
        '<div class="kv"><span>'+inspectorRes('wood')+' mercato</span><b>'+Number(snap?.market?.wood||0).toFixed(1)+'</b></div>'+
        '<div class="legend'+(active?'':' live')+'">'+(active?'Produzione nei giorni lavorativi: la quota trattenuta va nel piazzale fino alla sua capacità; il resto va al mercato.':
        'Produzione sospesa: verifica completamento, lavoratori L1 disponibili e priorità dei cantieri.')+'</div>';
    }
    info.innerHTML+=siteLaborLine(s);
    slots.innerHTML='<div class="slot"><div class="slot-label">Rotazione</div><div class="grid3"><button data-point-rotate="-1" title="Ruota −15°">↺</button><button data-point-rotate="12" title="Ruota 180°">⇄</button><button data-point-rotate="1" title="Ruota +15°">↻</button></div></div><div class="legend">Posa: '+(s.type==='loggingCamp'?'2×2U, forest within 10U':s.type==='quarry'?(s.extractionMode==='clay'?'4×4U, dry level swamp ground or centre at H0 within 6U of an inland bank':'3×3U, any part overlaps steep rock'):'1×1U, centre directly on steep rock')+'. No tree depletion yet.</div>';
    slots.querySelectorAll('[data-point-rotate]').forEach(btn=>btn.onclick=()=>rotatePointStructure(selectedStructure(),Number(btn.dataset.pointRotate)||1));
    return;
  }
  if(window.ConquerEvents3D?.is(s)){
    // Event venue (settlement-events3d.js): dressing, event setup and start / stop.
    const E=window.ConquerEvents3D;
    panel.classList.add('open');
    inspectorTitle(roomEsc(E.label(s)));
    info.innerHTML=(underConstruction(s)?'<div class="legend live">In costruzione · '+remainingDays(s).toFixed(1)+'d</div>':'');
    slots.innerHTML=E.panelHtml(s);
    E.bindPanel(slots,s);
    return;
  }
  if(window.ConquerPier?.is(s)){
    const P=window.ConquerPier;
    panel.classList.add('open');
    inspectorTitle(roomEsc(P.label(s)));
    info.innerHTML=(underConstruction(s)?'<div class="legend live">In costruzione · '+remainingDays(s).toFixed(1)+'d</div>':'');
    slots.innerHTML=P.panelHtml(s);
    P.bindPanel(slots,s);
    return;
  }
  if(window.ConquerQuay?.is(s)){
    const Q=window.ConquerQuay;
    panel.classList.add('open');
    inspectorTitle(roomEsc(Q.label(s)));
    info.innerHTML=(underConstruction(s)?'<div class="legend live">In costruzione · '+remainingDays(s).toFixed(1)+'d</div>':'');
    slots.innerHTML='<div class="legend">Banchina in pietra larga 2U. I moli in legno (L4, L12) si agganciano al suo bordo verso il mare.</div>';
    return;
  }
  if(isCivicAnnex(s)){
    const parent=State.structures.find(p=>p.id===s.parentId),spec=civicAnnexDefinition(s,parent);
    panel.classList.add('open');
    inspectorTitle(roomEsc(spec?.label||'Annesso'));
    info.innerHTML='<div class="legend live">'+(parent?roomEsc(structureLabel(parent)):'Senza edificio')+' · '+(spec?spec.w+'×'+spec.h+'U':'')+'</div>';
    slots.innerHTML='<div class="slot"><div class="grid"><button data-annex-parent>← Edificio</button><button data-annex-delete>Rimuovi</button></div></div>';
    slots.querySelector('[data-annex-parent]').onclick=()=>selectStructure(parent||null);
    slots.querySelector('[data-annex-delete]').onclick=()=>deleteStructure(s.id);
    return;
  }
  if(s?.type==='well'){
    // Village well: centre designation (like the Mastio) and the quarter name of a non-centre well.
    const d=StructureCommands.describeStructure(s.id),w=d.well;
    panel.classList.add('open');
    inspectorTitle('Pozzo · '+roomEsc(w.center?(w.villageName||'Centro villaggio'):(w.name||'Quartiere senza nome')));
    info.innerHTML='<div class="kv"><span>Ruolo</span><b>'+(w.center?'Centro villaggio':'Quartiere')+'</b></div>'+
      '<div class="kv"><span>Strada</span><b>'+(w.founding?'Strade maestre':w.mainRoad?'Principale verso il primo pozzo':'Da collegare')+'</b></div>';
    slots.innerHTML=(w.founded?'<div class="slot"><button data-well-center'+(w.canCenter?'':' disabled')+(w.center?' class="active"':'')+'>'+(w.center?'Centro villaggio ✓':'Rendi centro')+'</button></div>':'')+
      (w.center?'<div class="legend">Il centro porta il nome del villaggio.</div>':
        '<div class="slot"><label class="slot-label" for="wellNameInput">Nome quartiere</label><input id="wellNameInput" type="text" maxlength="32" placeholder="Quartiere o borgata" value="'+roomEsc(w.name)+'"></div>');
    // Well upgrades (town hall, guild hall, bargello) start here, not from the Builder palette.
    const WELL_UPGRADE_NAMES={townhall:'Municipio',guild:'Gilda',bargello:'Bargello'};
    const WELL_UPGRADE_WHY={notFounded:'Serve un villaggio fondato',taken:'Già presente',guildOne:'Una sola gilda per villaggio'};
    if(d.upgrades?.length)slots.innerHTML+='<div class="slot"><div class="slot-label">Ampliamenti del pozzo</div>'+
      d.upgrades.map(u=>'<button data-well-upgrade="'+u.key+'"'+(u.reason?' disabled title="'+WELL_UPGRADE_WHY[u.reason]+'"':' title="Costruisci"')+'>+ '+WELL_UPGRADE_NAMES[u.key]+
        '</button>'+
        u.children.map(id=>'<button data-well-upgrade-child="'+id+'" title="Seleziona">↳ '+WELL_UPGRADE_NAMES[u.key]+'</button>').join('')).join('')+
      '<div class="legend">Uno per tipo, entro '+WELL_CIVIC_RANGE+'U da questo pozzo.</div></div>';
    slots.querySelectorAll('[data-well-upgrade]').forEach(btn=>btn.onclick=()=>StructureCommands.startUpgrade(s.id,btn.dataset.wellUpgrade));
    slots.querySelectorAll('[data-well-upgrade-child]').forEach(btn=>btn.onclick=()=>selectStructure(State.structures.find(x=>x.id===btn.dataset.wellUpgradeChild)));
    const center=slots.querySelector('[data-well-center]');if(center)center.onclick=()=>StructureCommands.toggleVillageCenter(s.id);
    const name=slots.querySelector('#wellNameInput');if(name)name.onchange=()=>StructureCommands.setWellName(s.id,name.value);
    return;
  }
  if(!s||!['tower','gate','built','wall','palisade','house','market','tavern','church','training','plaza','townhall','guild','bargello','balivo','moat','bridge'].includes(s.type)){panel.classList.remove('open');return}
  if(['moat','bridge'].includes(s.type)){
    panel.classList.add('open');
    inspectorTitle(s.type==='moat'?'Fossato':'Ponte');
    info.innerHTML='<div class="legend live">'+roomEsc(s.variant)+' · '+(s.length||0).toFixed(1)+'U</div>';
    slots.innerHTML=window.ConquerCrossings?.panel(s)||'';
    window.ConquerCrossings?.bindPanel(slots);return;
  }
  const simpleCivic=isCivic(s);
  if(s.type!=='house'&&!simpleCivic)normalizeFunctions(s);const cap=(s.type==='house'||simpleCivic)?0:functionCapacity(s),capUnits=(s.type==='house'||simpleCivic)?0:functionCapacityUnits(s);panel.classList.add('open');
  const building=underConstruction(s),pr=Math.round(constructionProgress(s)*100),woodTower=isWoodTower(s),woodGate=isWoodGate(s),canHeight=['tower','gate','wall','built'].includes(s.type)&&!woodTower&&!woodGate&&!isLonghouse(s),maxLevel=maxStructureLevel(s),canTier=['tower','wall','palisade'].includes(s.type)&&!woodTower;
  inspectorTitle(roomEsc(structureLabel(s)));
  info.innerHTML=`${masonryMaterial(s)?`<div class="kv"><span>Muratura</span><b>${masonryMaterial(s)==='brick'?'Mattoni / Argilla':'Pietra'}</b></div>`:''}${s.type==='house'?(()=>{const pop=housePopulationCapacity(s);return `<div class="kv" title="uomini · donne · bambini"><span>Residenti</span><b>${pop.total} · ${pop.male}/${pop.female}/${pop.children}</b></div>`})():''}${building?`<div class="slot"><div class="site-label" data-construction-status="true">In costruzione · ${s.construction?.version===2?constructionWorkStatus(s)+' · '+remainingDays(s).toFixed(1)+' worker-days left':remainingDays(s).toFixed(1)+' calendar days'}</div><div class="progress"><i style="width:${pr}%"></i></div></div>`:''}${isWideBuilt(s)?`<div class="legend" style="margin-top:7px">Wide hall: one LARGE ground-floor room with free double height (≥2U) — common hall, chapel, throne hall.</div>`:s.type==='built'?`<div class="legend" style="margin-top:7px">One room per level: &lt;2U = none · 2–&lt;3U = NORMAL · ≥3U = LARGE (2× capacity).</div>`:s.type==='tower'&&!woodTower?`<div class="legend" style="margin-top:7px">One room per level: T1 = none · T2 = NORMAL · T3 = LARGE (2× capacity).</div>`:''}`;
  info.innerHTML+=siteLaborLine(s);
  // Artisan (L2) commerce: the autonomous workshop at home (ConquerCommerce keeps shops on L2 houses);
  // a merchant L3 house runs an advanced workshop with two hired L2 hands (D-SHOP-L3-261119).
  const commerce=window.ConquerCommerce;
  const houseTier=s.type==='house'?(window.ConquerSocialClasses?.tierOfHouse?.(s)??houseLevel(s)):0;
  const shopState=shop=>commerce.WORKSHOP_STATES?.includes(shop.state)?shop.state:'closed';
  if(houseTier===2){
    const c=commerce?.state?.(),shop=c?.shops?.[s.id];
    const kind=shop&&commerce.WORKSHOP_KINDS[shop.kind];
    info.innerHTML+='<div class="legend live" data-workshop="'+roomEsc(shop?.kind||'')+'">Bottega L2 · '+(kind?roomEsc(kind.label)+' · '+shopState(shop)+
      ' · '+shop.produced+' beni · '+shop.revenue+' oro':'nessuna bottega (apre in un giorno feriale)')+'</div>';
    // The household's second artisan hired by a merchant's workshop.
    const hand=window.ConquerSocialClasses?.householdHeadIds?.(s)?.[1],hire=hand&&commerce?.hireOf?.(hand);
    if(hire)info.innerHTML+='<div class="legend live" data-hired-at="'+roomEsc(hire.structure.id)+'">Lavorante · bottega avanzata '+
      roomEsc(commerce.WORKSHOP_KINDS[hire.shop.kind]?.label||hire.shop.kind)+' (casa L3)</div>';
  }else if(houseTier===3){
    const shop=commerce?.state?.()?.shops?.[s.id];
    const kind=shop?.grade==='advanced'&&commerce.WORKSHOP_KINDS[shop.kind];
    if(kind)info.innerHTML+='<div class="legend live" data-workshop="'+roomEsc(shop.kind)+'" data-grade="advanced">Bottega avanzata L3 · '+
      roomEsc(kind.label)+' · '+shopState(shop)+' · artigiani '+shop.workers.length+'/'+commerce.ADVANCED.workers+
      ' · ×'+commerce.outputFactor(shop)+' · '+shop.produced+' beni · '+shop.revenue+' oro · salari '+
      shop.wagesPaid+' · margine '+shop.margin+'</div>';
  }
  if(s.type==='tavern'){
    const inn=commerce?.occupancy?.(s.id);
    const operator=commerce?.state?.()?.services?.[s.id]?.operatorHouseId;
    info.innerHTML+='<div class="legend live">Locanda L3 · '+(operator?'gestore assegnato':'senza gestore')+
      ' · letti '+(inn?inn.occupied+' / '+inn.beds:'—')+'</div>';
  }
  if(s.type==='church'){
    const operator=commerce?.sync?.()?.services?.[s.id]?.operatorHouseId;
    info.innerHTML+='<div class="legend live">Culto L3 · '+(operator?'officiante assegnato':'senza officiante')+'</div>';
  }
  let html='';
  if(s.type==='tower'){
    const active=!!s.isMastio;
    html+='<div class="slot"><div class="slot-label">Mastio</div>'+
      '<button data-siege-mastio="'+s.id+'" '+(building?'disabled':'')+' class="'+(active?'active':'')+'" title="'+(active?'Rimuovi il mastio':'Designa come mastio')+'">'+(active?'Mastio ✓':'Designa')+'</button>'+
      '<div class="legend">La prima torre completata è promossa automaticamente; il mastio conserva una sala comune, anche al livello T1.</div></div>';
    html+=window.ConquerKeepEntrance?.panel(s)||'';
  }
  if(s.type==='tower'){
    const archerSlots=window.ConquerSiege?.archerSlots(s)||[];
    const archers=window.ConquerSiege?.stationedArchers(s)||0;
    const roofSlots=archerSlots.filter(slot=>slot.kind==='roof').length;
    const bartizanSlots=archerSlots.filter(slot=>slot.kind==='bartizan').length;
    const slitSlots=archerSlots.length-roofSlots-bartizanSlots;
    html+='<div class="slot"><div class="slot-label">Arcieri · '+archers+' / '+archerSlots.length+'</div>'+
      '<div class="grid"><button type="button" data-siege-archer="-1" title="Togli un arciere" '+(building||archers===0?'disabled':'')+'>−</button>'+
      '<button type="button" data-siege-archer="1" title="Aggiungi un arciere" '+(building||archers>=archerSlots.length?'disabled':'')+'>+</button></div>'+
      '<div class="legend">Priority: roof '+roofSlots+(bartizanSlots?' → bartizans '+bartizanSlots+' (also 0-1U at the tower foot)':'')+' → arrow slits '+slitSlots+' (upper floors first). Connected walls can block slits.</div></div>';
    // Lookout, outpost and signal fire (settlement-soldiers.js).
    html+=window.ConquerSoldiers?.towerPanelHtml?.(s)||'';
  }
  // Patrols of the whole ring of walls this wall belongs to (settlement-wall-patrols.js).
  if(['wall','palisade'].includes(s.type)&&!building)html+=window.ConquerWallPatrols?.panelHtml?.(s)||'';
  if(['house','market','tavern','church','training','plaza','townhall','guild','bargello','balivo'].includes(s.type)){
    const deg=Math.round((Number(s.angle)||0)*180/Math.PI+360)%360;
    html+=`<div class="slot"><div class="slot-label">Rotazione · ${deg}°</div><div class="grid3"><button data-point-rotate="-1" title="Ruota −15°">↺</button><button data-point-rotate="12" title="Ruota 180°">⇄</button><button data-point-rotate="1" title="Ruota +15°">↻</button></div></div>`;
  }
  if(CIVIC_LEVEL_TYPES.includes(s.type)){
    html+=`<div class="slot"><div class="slot-label">Livello civico · L${civicLevel(s)}</div><div class="grid3">${civicLevels(s.type).map(level=>`<button data-civic-level="${level}" class="${civicLevel(s)===level?'active':''}">L${level}</button>`).join('')}</div><div class="legend">Three planned stages; no economy or service effects yet.</div></div>`;
  }
  if(s.type==='church')html+=window.ConquerChurch?.panelHtml?.(s)||'';
  if(s.type==='guild')html+=window.ConquerGuild?.panelHtml?.(s)||'';
  if(CIVIC_ANNEX_CATALOG[s.type]){
    const catalog=CIVIC_ANNEX_CATALOG[s.type],children=civicAnnexChildren(s.id);
    html+='<div class="slot"><div class="slot-label">Annessi · '+children.length+'</div>'+
      Object.entries(catalog).map(([key,spec])=>{
        const owned=children.filter(child=>child.annexType===key),locked=civicLevel(s)<spec.level,full=owned.length>=spec.max;
        if(spec.intrinsic){
          const area=civicCemeteryArea(s);
          return '<div class="slot-label">'+spec.label+' · L'+spec.level+'</div>'+
            '<div class="legend">'+(area?'Included in church plot · '+area.w+'×'+area.h+'U':'Included from L1 · awaiting free space within the church lot')+'</div>';
        }
        return '<div class="slot-label">'+spec.label+' · '+owned.length+'/'+spec.max+' · L'+spec.level+'</div>'+
          '<button data-civic-annex="'+key+'" title="'+(locked?'Richiede L'+spec.level:full?'Limite raggiunto':building?'Edificio in costruzione':'Posa '+spec.w+'×'+spec.h+'U')+'" '+(locked||full||building?'disabled':'')+'>'+
          '+ '+spec.label+'</button>'+
          owned.map(child=>'<button data-civic-annex-child="'+child.id+'" title="Seleziona">↳ '+spec.label+'</button>').join('');
      }).join('')+(s.type==='townhall'
        ?'<div class="legend">Open ground within '+TOWNHALL_ANNEX_RANGE+'U of the town hall. Each garden yields '+
          (window.ConquerEconomy?.KITCHEN_GARDEN_FOOD_PER_DAY||2)+' food per working day to the lord, also under alarm and siege.</div></div>'
        :'<div class="legend">Owned plots for church and tavern · public expansion for market. No services or economic effects.</div></div>');
  }
  if(isPlazaLike(s)){
    html+=`<div class="slot"><div class="slot-label">Piazza</div><div class="grid3">${PLAZA_VARIANTS.map(variant=>`<button data-plaza-variant="${variant}" class="${plazaVariant(s)===variant?'active':''}">${variant==='paved'?'Lastricata':variant==='fountain'?'Fontana':'Giardino'}</button>`).join('')}</div></div>`;
  }
  if(s.type==='house'){
    const level=houseLevel(s);
    html+=`<div class="slot"><div class="slot-label">Livello sociale · L${level}</div><div class="grid"><button data-house-down title="Scendi di livello" ${level<=1?'disabled':''}>−</button><button data-house-up title="Sali di livello" ${level>=4?'disabled':''}>+</button></div><div class="legend">L1: 3 residents · L2: 6 · L3: 9 · L4: 12. L3: extended ${housePlanType(s)} plan · L4: elite house with dormers; a corner plot adds a ${houseTurretType(s)} turret.</div></div>`;
  }
  if(canTier){
    const current=['wall','palisade'].includes(s.type)?wallTier(s):towerTier(s);
    const labels=['wall','palisade'].includes(s.type)?['T1 · .2U','T2 · .5U','T3 · 1U']:(s.shape==='round'?['T1 · R.5','T2 · R.75','T3 · R1']:['T1 · 1U','T2 · 1.5U','T3 · 2U',...(woodTower||s.parentTowerId?[]:['W4 · 3U'])]);
    const options=isOrientedTower(s)?orientedTowerTierOptions(s.shape):labels.map((label,i)=>({value:i+1,label}));
    html+=`<div class="slot"><div class="slot-label">Taglia</div><div class="gridn">${options.map(o=>`<button data-structure-tier="${o.value}" ${o.value===KEEP_W4_TIER&&!keepW4Available(s)?'disabled':''} class="${current===o.value?'active':''}" title="${o.label}">${String(o.label).split(' · ')[0]}</button>`).join('')}</div></div>`;
    if(isKeepW4(s))html+=Array.from({length:structureLevel(s)},(_,f)=>{const cur=keepFloorPlan(s,f);return `<div class="slot"><div class="slot-label">Pianta · ${f===0?'piano terra':'piano '+f}</div><div class="grid">${Object.keys(KEEP_FLOOR_PLANS).map(k=>`<button data-keep-plan="${f}:${k}" class="${cur===k?'active':''}">${{hall:'Sala',halves:'2 metà',three:'1+2',quad:'4 quarti'}[k]}</button>`).join('')}</div></div>`}).join('');
  }
  if(canHeight)html+=`<div class="slot"><div class="slot-label">Altezza</div><div class="gridn">${Array.from({length:maxLevel},(_,i)=>`<button data-height-level="${i+1}" class="${structureLevel(s)===i+1?'active':''}">${i+1}</button>`).join('')}</div></div>`;
  if(s.type==='tower'){
    const deg=Math.round(normalizeTowerAngle(s.angle)*180/Math.PI)%360;
    html+=`<div class="slot"><div class="slot-label">Orientamento · ${deg}°</div><div class="grid3"><button data-tower-rotate="-1" title="Ruota −15°">↺</button><button data-tower-flip title="Ruota 180°">⇄</button><button data-tower-rotate="1" title="Ruota +15°">↻</button></div><div class="legend">Structural rotation is quantized to 24 positions. Attached subtorri and wall sockets follow the same angle model.</div></div>`;
    if(isWoodTower(s)){
      html+=`<div class="slot"><div class="legend">Torre di legno · H${structureLevel(s)} fissa. Uses normal tower/wall snap but no masonry battlements or doors.</div></div>`;
      if(woodTowerStyle(s)==='palisadeTower'){
        const roof=woodTowerRoof(s);
        html+=`<div class="slot"><div class="slot-label">Tetto</div><div class="grid"><button data-wood-roof="open" class="${roof==='open'?'active':''}">Piattaforma</button><button data-wood-roof="pitched" class="${roof==='pitched'?'active':''}">Falde · 4 pali</button></div></div>`;
      }
    }else{
      const roof=towerRoofStyle(s),base=towerBaseStyle(s);
      if(s.parentTowerId){
        const parent=State.structures.find(x=>x.id===s.parentTowerId);
        html+=`<div class="slot"><div class="legend">Subtower attached to ${parent?roomEsc(structureLabel(parent)):'parent structure'}.</div></div>`;
      }
      html+=`<div class="slot"><div class="slot-label">Coronamento</div><div class="grid3"><button data-tower-roof="battlement" class="${roof==='battlement'?'active':''}">Merlato</button><button data-tower-roof="machicolation" class="${roof==='machicolation'&&!towerItalianMachicolation(s)?'active':''}">Caditoie</button><button data-tower-roof="machicolationItalian"${inspectorWhy(s.shape!=='half','Non sulle mezze torri')} class="${towerItalianMachicolation(s)?'active':''}">All'italiana</button></div><div class="legend">Machicolation: merlatura in aggetto con mensole. All'italiana: mensole alte quattro corsi raccordate da archetti (solo estetica, stesse regole). Predispone il futuro attacco verticale a raggio 1U.</div></div>`;
      if(s.shape!=='half')html+=hoardingSlot(s);
      {
        const half=s.shape==='half',pitched=roof==='pitched',ir=!half&&!pitched&&towerInnerRoofMounted(s),irOk=!half&&(pitched||towerInnerRoofAllowed(s));
        html+=`<div class="slot"><div class="slot-label">Tetto</div><div class="${half?'grid':'grid3'}"><button data-tower-inner-roof="off" class="${ir||pitched?'':'active'}">Nessuno</button>${half?'':`<button data-tower-inner-roof="on"${inspectorWhy(irOk,'Solo torri in pietra T2+ con merli o caditoie e senza arma né fuoco in cima')} class="${ir?'active':''}" title="Tetto dentro i merli">Interno</button>`}<button data-tower-roof="pitched" class="${pitched?'active':''}">Falde</button></div><div class="legend">Tetto arretrato dentro i merli su un cordolo: il cammino di ronda resta libero. Solo estetica, nessuna stanza sotto.</div></div>`;
      }
      if(s.shape!=='half'&&[2,3].includes(towerTier(s))){
        const up=towerUpInnerTower(s)||'off',upOk=towerUpInnerTowerAllowed(s),ub=(k,l)=>`<button data-tower-up-inner="${k}" ${upOk||k==='off'?'':'disabled'} class="${up===k?'active':''}">${l}</button>`;
        html+=`<div class="slot"><div class="slot-label">Torretta centrale</div><div class="grid3">${ub('off','Nessuna')}${ub('round','Rotonda')}${ub('square','Quadrata')}</div><div class="legend">${upOk||up!=='off'?'Torretta di un piano al centro della piazza, larga quanto una torre di un taglio più piccola, con tetto a punta. Rotonda o quadrata a scelta.':'Solo torri in pietra W2/W3 con merli o caditoie, senza tetto interno, arma o fuoco di segnalazione.'}</div></div>`;
      }
      html+=`<div class="slot"><div class="slot-label">Base</div><div class="grid3"><button data-tower-base="standard" class="${base==='standard'?'active':''}">Standard</button><button data-tower-base="buttress" class="${base==='buttress'?'active':''}">Contrafforti</button><button data-tower-base="splayed" class="${base==='splayed'?'active':''}">Svasata</button></div><div class="legend">Svasato: H0.5. Contrafforti: da quota 0 a H1. Le fondamenta sotto quota 0 seguono automaticamente la sua impronta a terra.</div></div>`;
      const weapon=structureVariant(s,'topWeapon'),armed=towerTopWeaponAllowed(s),wb=(k,l)=>`<button data-tower-weapon="${k}"${inspectorWhy(armed||k==='none','Solo torri medie (T2) senza tetto a falde')} class="${weapon===k?'active':''}">${l}</button>`;
      if((s.shape||'square')==='square'&&variantSchema(s)?.roofShape){
        const rs=structureVariant(s,'roofShape'),on=roof==='pitched',rb=(k,l)=>`<button data-tower-roof-shape="${k}"${inspectorWhy(on,'Scegli prima il tetto a falde')} class="${rs===k?'active':''}">${l}</button>`;
        html+=`<div class="slot"><div class="slot-label">Forma delle falde</div><div class="grid3">${rb('pyramid','Piramide')}${rb('gable','2 falde')}${rb('hip','4 falde')}</div><div class="legend">Solo estetica, stesso costo. Colmo lungo metà della larghezza; con il colmo, due bandiere.</div></div>`;
      }
      if(variantSchema(s)?.bartizan){
        const bz=structureVariant(s,'bartizan'),ok=towerBartizanAllowed(s),bb=(k,l)=>`<button data-tower-bartizan="${k}"${inspectorWhy(ok||k==='none','Solo torri grandi (T3) quadrate o rotonde')} class="${bz===k?'active':''}">${l}</button>`;
        html+=`<div class="slot"><div class="slot-label">Garitte</div><div class="grid3">${bb('none','Nessuna')}${bb('battlement','Merlate')}${bb('pitched','Guglia')}</div><div class="legend">Quattro garitte d'angolo su mensole: 3 tiratori ciascuna, colpiscono anche il piede della torre (0-1U).</div></div>`;
        const n=structureVariant(s,'bartizanCount'),has=towerBartizan(s)!=='none',nb=k=>`<button data-tower-bartizan-count="${k}"${inspectorWhy(has,'Scegli prima lo stile delle garitte')} class="${n===k?'active':''}">${k}</button>`;
        html+=`<div class="slot"><div class="slot-label">N. garitte</div><div class="gridn">${nb('1')}${nb('2')}${nb('3')}${nb('4')}</div><div class="legend">2 = angoli opposti; 3 lascia libero un angolo.</div></div>`;
      }
      html+=`<div class="slot"><div class="slot-label">Arma in cima</div><div class="grid3">${wb('none','Nessuna')}${wb('mangonel','Mangano')}${wb('ballista','Balista')}</div><div class="legend">Mangano o balista sulla piazza della torre, rivolti verso l'esterno (vista 3D).</div></div>`;
    }
  }
  if(s.type==='gate'){
    const deg=Math.round(normalizeTowerAngle(s.angle)*180/Math.PI)%360;
    html+=`<div class="slot"><div class="slot-label">Fronte · ${deg}°</div><div class="grid3"><button data-gate-rotate="-1" title="Ruota −15°">↺</button><button data-gate-flip title="Ruota 180°">⇄</button><button data-gate-rotate="1" title="Ruota +15°">↻</button></div><div class="legend">Gate rotation uses the same 15° structural grid; guards, door and attached subtorri follow the facade.</div></div>`;
    if(woodGate){
      html+=`<div class="slot"><div class="legend">Porta di legno · H1 fissa · 1,5×1U · ballatoio piano con merli di legno.</div></div>`;
    }else{
      const roof=gateRoofStyle(s),timber=gateTimberUpper(s);
      if(isSmallGate(s)&&structureLevel(s)===2)html+=`<div class="slot"><div class="slot-label">Piano alto</div><div class="grid"><button data-gate-upper="stone" class="${timber?'':'active'}">Pietra</button><button data-gate-upper="timber" class="${timber?'active':''}">Graticcio</button></div><div class="legend">Graticcio: legno e intonaco come le case, a sbalzo su fronte e retro, sempre con il tetto. Costa la porta L1 più ${costText(GATE_TIMBER_COST)}.</div></div>`;
      html+=`<div class="slot"><div class="slot-label">Coronamento</div><div class="grid"><button data-gate-roof="battlement" class="${roof==='battlement'?'active':''}"${inspectorWhy(!timber,'Il graticcio porta sempre il tetto')}>Merlato</button><button data-gate-roof="pitched" class="${roof==='pitched'?'active':''}">Falde</button></div></div>`;
      html+=hoardingSlot(s);
    }
  }
  if(s.type==='gate'&&!building&&window.ConquerSiege?.doorStage){
    const st=window.ConquerSiege.doorStage(s),closed=!!s.closed&&st!=='broken';
    const label={intact:'integro',damaged:'danneggiato',broken:'sfondato'}[st];
    html+=`<div class="slot"><div class="slot-label">Portone · ${label}</div><div class="grid"><button data-gate-closed="0" class="${closed?'':'active'}">Aperto</button><button data-gate-closed="1" class="${closed?'active':''}" ${st==='broken'?'disabled':''}>Chiuso</button></div><div class="legend">Chiuso e integro blocca il passaggio a tutti; l'ariete lo sfonda e da sfondato resta aperto. Chiuso, le guardie rientrano.</div><div class="slot-label">Chiusura notturna</div><div class="grid"><button data-gate-night="1" class="${s.nightClose!==false?'active':''}">Sì</button><button data-gate-night="0" class="${s.nightClose===false?'active':''}">No</button></div><div class="legend">Si chiude da solo al tramonto e si riapre all'alba; aperto o chiuso a mano, resta così fino al mattino.</div></div>`;
  }
  if(s.type==='built'&&!isLonghouse(s)){
    const skin=builtSkin(s);
    html+=`<div class="slot"><div class="slot-label">Facciata</div><div class="grid"><button data-built-skin="standard" class="${skin==='standard'?'active':''}">Standard</button><button data-built-skin="arcade" class="${skin==='arcade'?'active':''}">Porticato</button></div><div class="legend">${isWideBuilt(s)?'Porticato affects only the interior ground floor.':'Porticato: the ground floor opens under the arches and the upper floor is raised over it. Under the portico: '+PORTICO_FUNCTIONS.map(k=>FUNCTION_LABELS[k]).join(', ')+'.'}</div></div>`;
  }
  if(s.type==='wall'){
    const skin=wallSkin(s),narrow=wallTier(s)===1;
    html+=`<div class="slot"><div class="slot-label">Coronamento</div><div class="grid3"><button data-wall-skin="standard" class="${skin==='standard'?'active':''}">Standard</button><button data-wall-skin="machicolation"${inspectorWhy(!narrow,'Non sui muri T1 stretti')} class="${skin==='machicolation'?'active':''}">Caditoie</button><button data-wall-skin="hoarding" class="${skin==='hoarding'?'active':''}">Ballatoio</button></div><div class="legend">Caditoie: merlatura in aggetto con mensole. Ballatoio sostituisce invece il coronamento esterno con una galleria lignea.</div></div>`;
  }
  if(cutawayEligible(s)){
    const cutaway=structureCutaway(s);
    html+=`<div class="slot"><div class="slot-label">Spaccato</div><button data-cutaway-toggle class="${cutaway?'active':''}" ${building?'disabled':''}>${cutaway?'Aperto':'Chiuso'}</button><div class="legend">Opens the camera-facing shell and exposes the functional rooms.</div></div>`;
  }
  if(!building&&(structureCutaway(s)||civicFloorCutaway(s))&&cutawayFloorCount(s)>1){
    const f=cutawayVisibleFloor(s),n=cutawayFloorCount(s);
    html+=`<div class="slot"><div class="slot-label">Piano in vista · ${f+1} / ${n}</div><div class="grid"><button data-cutaway-floor="-1" title="Piano sotto" ${f===0?'disabled':''}>▼</button><button data-cutaway-floor="1" title="Piano sopra" ${f>=n-1?'disabled':''}>▲</button></div><div class="legend">The floors above the one in view are taken off.</div></div>`;
  }
  if(['wall','palisade','built'].includes(s.type)){
    const flipLabel=s.type==='built'?'Lato esterno / finestre':'Lato esterno';
    const flipLegend=s.type==='wall'?'Defines the exterior side for battlements or hoarding.':s.type==='palisade'?'Defines which side is exterior; walkway and earthwork are generated inward.':isWideBuilt(s)?'Exterior: arrow slits. Interior: tall hall windows (clerestory with portico).':'Exterior windows: upper level only. Interior windows/portico follow the opposite side.';
    html+=`<div class="slot"><div class="slot-label">${flipLabel}</div><button data-linear-flip title="Inverti il lato esterno">⇄ Inverti</button><div class="legend">${flipLegend}</div></div>`;
    // Moat on the exterior face (StructureCommands.digMoat, settlement-crossings.js digAlongWall).
    const moatCtl=!building&&StructureCommands.describeStructure(s.id)?.controls.find(c=>c.key==='moat');
    if(moatCtl){
      const label={dry:'Secco',water:'Ad acqua'};
      html+=`<div class="slot"><div class="slot-label">Fossato esterno</div><div class="grid">${moatCtl.options.map(o=>`<button data-wall-moat="${o.value}" class="${o.active?'active':''}"${o.disabled?' disabled'+(o.reason?' title="'+roomEsc(o.reason)+'"':''):''}>${label[o.value]}</button>`).join('')}</div><div class="legend">1.5U moat against the exterior face; joins the moat of the next wall at the corner, leaves gates open. Water only at level 0.</div></div>`;
    }
  }
  if(s.type==='townhall'&&!building){
    normalizeFunctions(s);
    // One room per floor, the highest listed first.
    html+=s.functions.map((value,i)=>({value,i})).reverse().map(({value,i})=>`<div class="slot"><div class="slot-label">${i?'Piano '+i:'Piano terra'}</div><select data-function-slot="${i}"><option value="">— Empty —</option>${TOWNHALL_FUNCTION_CATALOG.map(k=>`<option value="${k}" ${value===k?'selected':''} ${window.ConquerSiege?.allowed(s,i,k)?'':'disabled'}>${FUNCTION_LABELS[k]}</option>`).join('')}</select></div>`).join('')
      +'<div class="legend">One room per floor, as many as the civic level; the tribunal needs L2.</div>';
  }
  if(s.type!=='house'&&!simpleCivic){
    if(!building&&cap>0)html+=Array.from({length:cap},(_,n)=>['tower','built'].includes(s.type)?cap-1-n:n).map(i=>{const value=s.functions[i],size=functionSlotSize(s,i),units=functionSlotUnits(s,i);return `<div class="slot room-slot"><div class="slot-label" title="${size} · ${units}× capacità">${i===0&&isBuiltPortico(s)?'Portico':'Piano '+(functionSlotFloor(s,i)+1)}${size==='large'?' · grande':''}</div><select data-function-slot="${i}"><option value="">— Empty —</option>${FUNCTION_CATALOG.map(k=>`<option value="${k}" ${value===k?'selected':''} ${window.ConquerSiege?.allowed(s,i,k)?'':'disabled'}>${FUNCTION_LABELS[k]}</option>`).join('')}</select>${value==='infirmary'?window.ConquerInfirmary?.slotLegend(s,i)||'':''}</div>`}).join('');
  }
  if(['wall','palisade'].includes(s.type)&&!building){
    // Walls take damage bay by bay; a fallen bay opens a breach there.
    const siege=window.ConquerSiege,list=siege?.bays(s);
    if(list){
      const ladder=siege.assaultCheck(s,'ladder'),tower=siege.assaultCheck(s,'tower',2);
      const towerText=tower.ok?'torre liv. '+structureLevel(s)+'+':'torre no ('+tower.reason+')';
      html+='<div class="slot"><div class="slot-label">Integrità · '+list.length+' campate</div>'+
        list.map((b,i)=>'<div class="grid"><div class="legend live">Campata '+(i+1)+' · '+Math.ceil(b.hp)+' / '+Math.round(b.max)+'</div>'+'</div>').join('')+
        '<div class="legend live">Assalto: '+(ladder.ok?'scale sì':'scale no ('+ladder.reason+')')+' · '+towerText+'</div></div>';
    }
  }
  const breakable=['tower','gate','built','house'].includes(s.type)||isCivic(s);
  if(breakable&&!building){
    const hp=window.ConquerSiege?.integrity(s);
    if(hp)html+='<div class="slot"><div class="slot-label">Integrità</div>'+
      '<div class="legend live">Muratura '+Math.ceil(hp.core.hp)+' / '+hp.core.max+
      (hp.portcullis?' · Grata '+Math.ceil(hp.portcullis.hp)+' / '+hp.portcullis.max:'')+
      (hp.door?' · Porta '+Math.ceil(hp.door.hp)+' / '+hp.door.max:'')+'</div>'+
      '<div class="legend">Solo gli strumenti efficaci danneggiano ogni materiale. Torri e porte perdono il piano alto a 2/3 e 1/3 della vita.</div></div>';
  }
  if(['tower','gate','built'].includes(s.type)){
    html+=window.ConquerSiege?.roomExteriorHtml?.(s)||'';
  }
  html+=window.ConquerCrossings?.panel(s)||'';
  html+=window.ConquerGates?.panel(s)||'';
  slots.innerHTML=html;
  window.ConquerSiege?.bindPanel(slots);
  window.ConquerCrossings?.bindPanel(slots);
  window.ConquerKeepEntrance?.bindPanel(slots);
  window.ConquerSoldiers?.bindTowerPanel?.(slots,s);
  window.ConquerWallPatrols?.bindPanel?.(slots,s);
  window.ConquerChurch?.bindPanel?.(slots);
  // Every control acts through StructureCommands (src/settlement-structure-commands.js), shared with UI v2.
  const on=(selector,fn,event='onclick')=>slots.querySelectorAll(selector).forEach(el=>el[event]=e=>{const target=selectedStructure();if(target)fn(target.id,el,e)});
  on('[data-house-up]',id=>StructureCommands.changeHouseLevel(id,1));
  on('[data-house-down]',id=>StructureCommands.changeHouseLevel(id,-1));
  on('[data-structure-tier]',(id,el)=>StructureCommands.setTier(id,Number(el.dataset.structureTier)));
  on('[data-height-level]',(id,el)=>StructureCommands.setHeight(id,Number(el.dataset.heightLevel)));
  on('[data-point-rotate]',(id,el)=>{const n=Number(el.dataset.pointRotate)||1;StructureCommands.rotate(id,n===12?'flip':n)});
  on('[data-tower-flip]',id=>StructureCommands.rotate(id,'flip'));
  on('[data-tower-rotate]',(id,el)=>StructureCommands.rotate(id,Number(el.dataset.towerRotate)||1));
  on('[data-gate-flip]',id=>StructureCommands.rotate(id,'flip'));
  on('[data-gate-rotate]',(id,el)=>StructureCommands.rotate(id,Number(el.dataset.gateRotate)||1));
  on('[data-tower-base]',(id,el)=>StructureCommands.setTowerBase(id,el.dataset.towerBase));
  on('[data-tower-roof]',(id,el)=>StructureCommands.setTowerRoof(id,el.dataset.towerRoof));
  on('[data-hoarding]',(id,el)=>StructureCommands.setHoarding(id,el.dataset.hoarding));
  on('[data-wood-roof]',(id,el)=>StructureCommands.setWoodRoof(id,el.dataset.woodRoof));
  on('[data-gate-roof]',(id,el)=>StructureCommands.setGateRoof(id,el.dataset.gateRoof));
  on('[data-gate-upper]',(id,el)=>StructureCommands.setGateUpper(id,el.dataset.gateUpper));
  on('[data-built-skin]',(id,el)=>StructureCommands.setSkin(id,el.dataset.builtSkin));
  on('[data-wall-skin]',(id,el)=>StructureCommands.setSkin(id,el.dataset.wallSkin));
  on('[data-cutaway-toggle]',id=>StructureCommands.toggleCutaway(id));
  on('[data-cutaway-floor]',(id,el)=>StructureCommands.stepCutawayFloor(id,Number(el.dataset.cutawayFloor)));
  on('[data-linear-flip]',id=>StructureCommands.flipSide(id));
  on('[data-wall-moat]',(id,el)=>StructureCommands.digMoat(id,el.dataset.wallMoat));
  on('[data-keep-plan]',(id,el)=>{const [f,k]=el.dataset.keepPlan.split(':');StructureCommands.setKeepFloorPlan(id,Number(f),k)});
  on('[data-function-slot]',(id,el)=>StructureCommands.setRoom(id,Number(el.dataset.functionSlot),el.value),'onchange');
  window.ConquerGates?.bindPanel(slots);
  on('[data-civic-level]',(id,el)=>StructureCommands.setCivicLevel(id,Number(el.dataset.civicLevel)));
  on('[data-civic-annex]',(id,el)=>startCivicAnnexPlacement(selectedStructure(),el.dataset.civicAnnex));
  slots.querySelectorAll('[data-civic-annex-child]').forEach(btn=>btn.onclick=()=>selectStructure(State.structures.find(x=>x.id===btn.dataset.civicAnnexChild)));
  on('[data-plaza-variant]',(id,el)=>StructureCommands.setPlazaVariant(id,el.dataset.plazaVariant));
  on('[data-tower-weapon]',(id,el)=>StructureCommands.setTowerWeapon(id,el.dataset.towerWeapon));
  on('[data-tower-roof-shape]',(id,el)=>StructureCommands.setTowerRoofShape(id,el.dataset.towerRoofShape));
  on('[data-tower-up-inner]',(id,el)=>StructureCommands.setTowerUpInnerTower(id,el.dataset.towerUpInner));
  on('[data-tower-inner-roof]',(id,el)=>{const t=State.structures.find(x=>x.id===id);if(t&&towerRoofStyle(t)==='pitched')StructureCommands.setTowerRoof(id,'battlement');StructureCommands.setTowerInnerRoof(id,el.dataset.towerInnerRoof)});
  on('[data-tower-bartizan]',(id,el)=>StructureCommands.setTowerBartizan(id,el.dataset.towerBartizan));
  on('[data-tower-bartizan-count]',(id,el)=>StructureCommands.setTowerBartizanCount(id,el.dataset.towerBartizanCount));
}
let pan=null;
