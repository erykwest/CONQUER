'use strict';
// Tower/building function panels and room controls. Extracted verbatim from settlement-app.js.
function siteLaborText(s){
  if(s?.auto&&s.spawnCost)
    return 'Spontaneous spawn: '+Number(s.spawnCost.laborGold||0).toFixed(2)+' gold in labor value (not charged to lord)';
  if(s?.construction?.version!==2)return '';
  const c=s.construction,rate=window.ConquerEconomy?.constructionWagePerWorkday?.()||0;
  return 'Lord construction wages: '+Number(c.wagesPaid||0).toFixed(2)+
    ' gold paid · '+((Math.max(0,c.workRequired-c.workDone))*rate).toFixed(2)+' gold remaining at current wage';
}
function siteLaborLine(s){
  const txt=siteLaborText(s);
  return txt?'<div class="legend" data-site-wages="true">'+txt+'</div>':'';
}

function renderFunctionPanel(){
  const panel=document.getElementById('functionPanel'),info=document.getElementById('functionInfo'),slots=document.getElementById('functionSlots'),s=selectedStructure();
  if(window.ConquerIndustries?.is(s)){
    const spec=window.ConquerIndustries.definition(s),econ=window.ConquerEconomy;
    const staff=econ?.staffing?.()[s.id]||0;
    const details=econ?.state()?.activities?.[s.id],owner=details?.owner||(s.economicOwner==='lord'?'lord':'private');
    panel.classList.add('open');
    info.innerHTML=`<div class="kv"><span>Industry</span><b>${structureLabel(s)}</b></div><div class="kv"><span>Workers · L${spec.tier}</span><b>${staff} / ${spec.workers}</b></div><div class="kv"><span>Production</span><b>${staff} ${spec.good} / workday</b></div><div class="kv"><span>Owner</span><b>${owner==='lord'?'Lord':'Private L4'}</b></div><div class="cost-line">${costText(s.buildCost||constructionCost(s))}</div>${underConstruction(s)?`<div class="legend">Under construction · ${s.construction?.version===2?constructionWorkStatus(s)+' · '+remainingDays(s).toFixed(1)+' worker-days left':remainingDays(s).toFixed(1)+' calendar days'}</div>`:''}`;
    info.innerHTML+=siteLaborLine(s);
    slots.innerHTML='<div class="slot"><div class="slot-label">Rotate after construction</div><div class="grid3"><button data-point-rotate="-1">↺ 15°</button><button data-point-rotate="12">⇄ 180°</button><button data-point-rotate="1">↻ 15°</button></div></div><div class="legend">Placement: '+(s.type==='loggingCamp'?'2×2U, forest within 10U':s.type==='quarry'?(s.extractionMode==='clay'?'4×4U, centre H0 and at most 6U from river/stream/lake bank':'3×3U, any part overlaps steep rock'):'1×1U, centre directly on steep rock')+'. No tree depletion yet.</div>';
    slots.querySelectorAll('[data-point-rotate]').forEach(btn=>btn.onclick=()=>rotatePointStructure(selectedStructure(),Number(btn.dataset.pointRotate)||1));
    return;
  }
  if(window.ConquerEvents3D?.is(s)){
    // Event venue (settlement-events3d.js): dressing, event setup and start / stop.
    const E=window.ConquerEvents3D;
    panel.classList.add('open');
    info.innerHTML='<div class="kv"><span>Spazio eventi</span><b>'+E.label(s)+'</b></div><div class="cost-line">'+costText(s.buildCost||E.cost(s))+'</div>'+
      (underConstruction(s)?'<div class="legend">In costruzione · '+remainingDays(s).toFixed(1)+'d</div>':'');
    slots.innerHTML=E.panelHtml(s);
    E.bindPanel(slots,s);
    return;
  }
  if(isCivicAnnex(s)){
    const parent=State.structures.find(p=>p.id===s.parentId),spec=civicAnnexDefinition(s,parent);
    panel.classList.add('open');
    info.innerHTML='<div class="kv"><span>Annex</span><b>'+(spec?.label||'Unknown')+'</b></div><div class="legend">Skeleton · '+(parent?structureLabel(parent):'orphan')+' · '+(spec?spec.w+'×'+spec.h+'U':'')+'</div>';
    slots.innerHTML='<div class="slot"><button data-annex-parent>← Parent building</button><button data-annex-delete>Remove annex</button><div class="legend">No workers, beds, goods or economy yet.</div></div>';
    slots.querySelector('[data-annex-parent]').onclick=()=>selectStructure(parent||null);
    slots.querySelector('[data-annex-delete]').onclick=()=>deleteStructure(s.id);
    return;
  }
  if(!s||!['tower','gate','built','wall','palisade','house','market','tavern','church','training','plaza','moat','bridge'].includes(s.type)){panel.classList.remove('open');return}
  if(['moat','bridge'].includes(s.type)){
    panel.classList.add('open');
    const cost=s.buildCost||constructionCost(s);
    info.innerHTML='<div class="kv"><span>Selected</span><b>'+s.type.toUpperCase()+'</b></div>'+
      '<div class="legend">'+s.variant+' · '+(s.length||0).toFixed(1)+'U · '+costText(cost)+'</div>';
    slots.innerHTML=window.ConquerCrossings?.panel(s)||'';
    window.ConquerCrossings?.bindPanel(slots);return;
  }
  const simpleCivic=isCivic(s);
  if(s.type!=='house'&&!simpleCivic)normalizeFunctions(s);const cap=(s.type==='house'||simpleCivic)?0:functionCapacity(s),capUnits=(s.type==='house'||simpleCivic)?0:functionCapacityUnits(s);panel.classList.add('open');
  const building=underConstruction(s),pr=Math.round(constructionProgress(s)*100),woodTower=isWoodTower(s),woodGate=isWoodGate(s),canHeight=['tower','gate','wall','built'].includes(s.type)&&!woodTower&&!woodGate,maxLevel=['tower','gate'].includes(s.type)?3:2,canTier=['tower','wall','palisade'].includes(s.type)&&!woodTower;
  info.innerHTML=`<div class="kv"><span>Selected</span><b>${structureLabel(s)}</b></div>${masonryMaterial(s)?`<div class="kv"><span>Muratura</span><b>${masonryMaterial(s)==='brick'?'Mattoni / Argilla':'Pietra'}</b></div>`:''}${s.type==='house'?(()=>{const pop=housePopulationCapacity(s);return `<div class="kv"><span>Household capacity</span><b>${pop.total}</b></div><div class="cost-line">${pop.male} male · ${pop.female} female · ${pop.children} children</div>`})():simpleCivic?`<div class="cost-line">Construction: ${costText(s.buildCost||constructionCost(s))}</div><div class="legend">Prototype civic building · functions/routines pending.</div>`:`<div class="kv"><span>Rooms</span><b>${cap} · ${capUnits} capacity</b></div><div class="cost-line">Construction: ${costText(s.buildCost||constructionCost(s))}</div>`}${building?`<div class="slot"><div class="site-label" data-construction-status="true">Under construction · ${s.construction?.version===2?constructionWorkStatus(s)+' · '+remainingDays(s).toFixed(1)+' worker-days left':remainingDays(s).toFixed(1)+' calendar days'}</div><div class="progress"><i style="width:${pr}%"></i></div></div>`:''}${isWideBuilt(s)?`<div class="legend" style="margin-top:7px">Wide hall: one LARGE ground-floor room with free double height (≥2U) — common hall, chapel, throne hall.</div>`:s.type==='built'?`<div class="legend" style="margin-top:7px">One room per level: &lt;2U = none · 2–&lt;3U = NORMAL · ≥3U = LARGE (2× capacity).</div>`:s.type==='tower'&&!woodTower?`<div class="legend" style="margin-top:7px">One room per level: T1 = none · T2 = NORMAL · T3 = LARGE (2× capacity).</div>`:''}`;
  info.innerHTML+=siteLaborLine(s);
  // L3 commerce: autonomous workshop at home, or the service it operates.
  const commerce=window.ConquerCommerce;
  if(s.type==='house'&&houseLevel(s)===3){
    const shop=commerce?.state?.()?.shops?.[s.id];
    const kind=shop&&commerce.WORKSHOP_KINDS[shop.kind];
    info.innerHTML+='<div class="legend">L3 · '+(kind?kind.label+' · '+(commerce.WORKSHOP_STATES?.includes(shop.state)?shop.state:'closed')+
      ' · '+shop.produced+' goods made · '+shop.revenue+' gold taken':'no workshop yet (opens on a workday)')+'</div>';
  }
  if(s.type==='tavern'){
    const inn=commerce?.occupancy?.(s.id);
    const operator=commerce?.state?.()?.services?.[s.id]?.operatorHouseId;
    info.innerHTML+='<div class="legend">L3 inn service · '+(operator?'operator assigned':'operator not assigned')+
      ' · beds '+(inn?inn.occupied+' / '+inn.beds:'not available')+' · no lodging payments simulated</div>';
  }
  if(s.type==='church'){
    const operator=commerce?.sync?.()?.services?.[s.id]?.operatorHouseId;
    info.innerHTML+='<div class="legend">L3 worship service · '+(operator?'operator assigned':'operator not assigned')+
      ' · no donations or tithes simulated</div>';
  }
  let html='';
  if(s.type==='tower'){
    const active=!!s.isMastio;
    html+='<div class="slot"><div class="slot-label">Difesa finale · Mastio</div>'+
      '<button data-siege-mastio="'+s.id+'" '+(building?'disabled':'')+' class="'+(active?'active':'')+'">'+(active?'Mastio attivo · rimuovi':'Designa come Mastio')+'</button>'+
      '<div class="legend">La prima torre completata è promossa automaticamente; il mastio conserva una sala comune, anche al livello T1.</div></div>';
  }
  if(s.type==='tower'){
    const archerSlots=window.ConquerSiege?.archerSlots(s)||[];
    const archers=window.ConquerSiege?.stationedArchers(s)||0;
    const roofSlots=archerSlots.filter(slot=>slot.kind==='roof').length;
    const slitSlots=archerSlots.length-roofSlots;
    html+='<div class="slot"><div class="slot-label">Tower archers · '+archers+' / '+archerSlots.length+'</div>'+
      '<div class="grid"><button type="button" data-siege-archer="-1" '+(building||archers===0?'disabled':'')+'>− Archer</button>'+
      '<button type="button" data-siege-archer="1" '+(building||archers>=archerSlots.length?'disabled':'')+'>+ Archer</button></div>'+
      '<div class="legend">Priority: roof '+roofSlots+' → arrow slits '+slitSlots+' (upper floors first). Connected walls can block slits.</div></div>';
  }
  if(['house','market','tavern','church','training','plaza'].includes(s.type)){
    const deg=Math.round((Number(s.angle)||0)*180/Math.PI+360)%360;
    html+=`<div class="slot"><div class="slot-label">Building rotation · ${deg}°</div><div class="grid3"><button data-point-rotate="-1">↺ 15°</button><button data-point-rotate="12">⇄ 180°</button><button data-point-rotate="1">↻ 15°</button></div></div>`;
  }
  if(CIVIC_LEVEL_TYPES.includes(s.type)){
    html+=`<div class="slot"><div class="slot-label">Civic development · L${civicLevel(s)} (skeleton)</div><div class="grid3">${[1,2,3].map(level=>`<button data-civic-level="${level}" class="${civicLevel(s)===level?'active':''}">L${level}</button>`).join('')}</div><div class="legend">Three planned stages; no economy or service effects yet.</div></div>`;
  }
  if(CIVIC_ANNEX_CATALOG[s.type]){
    const catalog=CIVIC_ANNEX_CATALOG[s.type],children=civicAnnexChildren(s.id);
    html+='<div class="slot"><div class="slot-label">Annexes · '+children.length+' built (skeleton)</div>'+
      Object.entries(catalog).map(([key,spec])=>{
        const owned=children.filter(child=>child.annexType===key),locked=civicLevel(s)<spec.level,full=owned.length>=spec.max;
        if(spec.intrinsic){
          const area=civicCemeteryArea(s);
          return '<div class="slot-label">'+spec.label+' · L'+spec.level+'</div>'+
            '<div class="legend">'+(area?'Included in church plot · '+area.w+'×'+area.h+'U':'Included from L1 · awaiting free space within the church lot')+'</div>';
        }
        return '<div class="slot-label">'+spec.label+' · '+owned.length+'/'+spec.max+' · L'+spec.level+'</div>'+
          '<button data-civic-annex="'+key+'" '+(locked||full||building?'disabled':'')+'>'+
          (locked?'Requires L'+spec.level:full?'Limit reached':building?'Parent under construction':'Place '+spec.label)+' · '+spec.w+'×'+spec.h+'U</button>'+
          owned.map(child=>'<button data-civic-annex-child="'+child.id+'">↳ Select '+spec.label+'</button>').join('');
      }).join('')+'<div class="legend">Owned plots for church and tavern · public expansion for market. No services or economic effects.</div></div>';
  }
  if(isPlazaLike(s)){
    html+=`<div class="slot"><div class="slot-label">Piazza variant</div><div class="grid3">${PLAZA_VARIANTS.map(variant=>`<button data-plaza-variant="${variant}" class="${plazaVariant(s)===variant?'active':''}">${variant==='paved'?'Paved':variant==='fountain'?'Fountain':'Garden'}</button>`).join('')}</div></div>`;
  }
  if(s.type==='house'){
    const level=houseLevel(s);
    html+=`<div class="slot"><div class="slot-label">House social level</div><div class="grid"><button data-house-down ${level<=1?'disabled':''}>− Downgrade</button><button data-house-up ${level>=4?'disabled':''}>+ Upgrade</button></div><div class="legend">L1: 3 residents · L2: 6 · L3: 9 · L4: 12. L3: extended ${housePlanType(s)} plan · L4: elite house with dormers; a corner plot adds a ${houseTurretType(s)} turret.</div></div>`;
  }
  if(canTier){
    const current=['wall','palisade'].includes(s.type)?wallTier(s):towerTier(s);
    const labels=['wall','palisade'].includes(s.type)?['T1 · .2U','T2 · .5U','T3 · 1U']:(s.shape==='round'?['T1 · R.5','T2 · R.75','T3 · R1']:['T1 · 1U','T2 · 1.5U','T3 · 2U']);
    html+=`<div class="slot"><div class="slot-label">Tier / footprint</div><div class="grid3">${labels.map((label,i)=>`<button data-structure-tier="${i+1}" class="${current===i+1?'active':''}">${label}</button>`).join('')}</div></div>`;
  }
  if(canHeight)html+=`<div class="slot"><div class="slot-label">Height levels</div><div class="${maxLevel===3?'grid3':'grid'}">${Array.from({length:maxLevel},(_,i)=>`<button data-height-level="${i+1}" class="${structureLevel(s)===i+1?'active':''}">${i+1}</button>`).join('')}</div></div>`;
  if(s.type==='tower'){
    const deg=Math.round(normalizeTowerAngle(s.angle)*180/Math.PI)%360;
    html+=`<div class="slot"><div class="slot-label">Tower orientation · ${deg}° · step ${structureRotationStep(s.angle)}/23</div><div class="grid3"><button data-tower-rotate="-1">↺ 15°</button><button data-tower-flip>⇄ 180°</button><button data-tower-rotate="1">↻ 15°</button></div><div class="legend">Structural rotation is quantized to 24 positions. Attached subtorri and wall sockets follow the same angle model.</div></div>`;
    if(isWoodTower(s)){
      html+=`<div class="slot"><div class="legend">Wooden tower · fixed H1. Uses normal tower/wall snap but no masonry battlements or doors.</div></div>`;
      if(woodTowerStyle(s)==='palisadeTower'){
        const roof=woodTowerRoof(s);
        html+=`<div class="slot"><div class="slot-label">Wood roof</div><div class="grid"><button data-wood-roof="open" class="${roof==='open'?'active':''}">Open platform</button><button data-wood-roof="pitched" class="${roof==='pitched'?'active':''}">Pitched · 4 posts</button></div></div>`;
      }
    }else{
      const roof=towerRoofStyle(s),base=towerBaseStyle(s);
      if(s.parentTowerId){
        const parent=State.structures.find(x=>x.id===s.parentTowerId);
        html+=`<div class="slot"><div class="legend">Subtower attached to ${parent?structureLabel(parent):'parent structure'}.</div></div>`;
      }
      html+=`<div class="slot"><div class="slot-label">Tower roof</div><div class="grid3"><button data-tower-roof="battlement" class="${roof==='battlement'?'active':''}">Merlato</button><button data-tower-roof="machicolation" class="${roof==='machicolation'?'active':''}">Machicolation</button><button data-tower-roof="pitched" class="${roof==='pitched'?'active':''}">Falde</button></div><div class="legend">Machicolation: merlatura in aggetto con mensole. Predispone il futuro attacco verticale a raggio 1U.</div></div>`;
      html+=`<div class="slot"><div class="slot-label">Stone base</div><div class="grid3"><button data-tower-base="standard" class="${base==='standard'?'active':''}">Standard</button><button data-tower-base="buttress" class="${base==='buttress'?'active':''}">Contrafforti H1</button><button data-tower-base="splayed" class="${base==='splayed'?'active':''}">Svasato 10°</button></div><div class="legend">Svasato: H0.5. Contrafforti: da quota 0 a H1. Le fondamenta sotto quota 0 seguono automaticamente la sua impronta a terra.</div></div>`;
      const weapon=structureVariant(s,'topWeapon'),armed=towerTopWeaponAllowed(s),wb=(k,l)=>`<button data-tower-weapon="${k}" ${armed||k==='none'?'':'disabled'} class="${weapon===k?'active':''}">${l}</button>`;
      html+=`<div class="slot"><div class="slot-label">Arma in cima</div><div class="grid3">${wb('none','Nessuna')}${wb('mangonel','Mangano')}${wb('ballista','Balista')}</div><div class="legend">${armed?'Upgrade: mangano o balista sulla piazza della torre, rivolti verso l\'esterno (vista 3D).':'Solo torri medie (T2) senza tetto a falde, di qualsiasi altezza.'}</div></div>`;
    }
  }
  if(s.type==='gate'){
    const deg=Math.round(normalizeTowerAngle(s.angle)*180/Math.PI)%360;
    html+=`<div class="slot"><div class="slot-label">Gate front · ${deg}° · step ${structureRotationStep(s.angle)}/23</div><div class="grid3"><button data-gate-rotate="-1">↺ 15°</button><button data-gate-flip class="active">⇄ 180°</button><button data-gate-rotate="1">↻ 15°</button></div><div class="legend">Gate rotation uses the same 15° structural grid; guards, door and attached subtorri follow the facade.</div></div>`;
    if(woodGate){
      html+=`<div class="slot"><div class="legend">Wood gate · fixed H1 · 1.5×1U · front timber door · flat fighting deck with timber battlements.</div></div>`;
    }else{
      const roof=gateRoofStyle(s);
      html+=`<div class="slot"><div class="slot-label">Gate roof</div><div class="grid"><button data-gate-roof="battlement" class="${roof==='battlement'?'active':''}">Merlato</button><button data-gate-roof="pitched" class="${roof==='pitched'?'active':''}">Falde</button></div></div>`;
    }
  }
  if(s.type==='gate'&&!building&&window.ConquerSiege?.doorStage){
    const st=window.ConquerSiege.doorStage(s),closed=!!s.closed&&st!=='broken';
    const label={intact:'integro',damaged:'danneggiato',broken:'sfondato'}[st];
    html+=`<div class="slot"><div class="slot-label">Portone · ${label}</div><div class="grid"><button data-gate-closed="0" class="${closed?'':'active'}">Aperto</button><button data-gate-closed="1" class="${closed?'active':''}" ${st==='broken'?'disabled':''}>Chiuso</button></div><div class="legend">Chiuso e integro blocca il passaggio a tutti; l'ariete lo sfonda e da sfondato resta aperto. Chiuso, le guardie rientrano.</div><div class="grid"><button data-gate-night="1" class="${s.nightClose!==false?'active':''}">Chiusura notturna ON</button><button data-gate-night="0" class="${s.nightClose===false?'active':''}">OFF</button></div><div class="legend">Si chiude da solo al tramonto e si riapre all'alba; aperto o chiuso a mano, resta così fino al mattino.</div></div>`;
  }
  if(s.type==='built'){
    const skin=builtSkin(s);
    html+=`<div class="slot"><div class="slot-label">Built wall skin</div><div class="grid"><button data-built-skin="standard" class="${skin==='standard'?'active':''}">Standard</button><button data-built-skin="arcade" class="${skin==='arcade'?'active':''}">Porticato</button></div><div class="legend">Porticato affects only the interior ground floor.</div></div>`;
  }
  if(s.type==='wall'){
    const skin=wallSkin(s),narrow=wallTier(s)===1;
    html+=`<div class="slot"><div class="slot-label">Wall skin</div><div class="grid3"><button data-wall-skin="standard" class="${skin==='standard'?'active':''}">Standard</button><button data-wall-skin="machicolation" ${narrow?'disabled':''} class="${skin==='machicolation'?'active':''}">Machicolation</button><button data-wall-skin="hoarding" class="${skin==='hoarding'?'active':''}">Hoarding</button></div><div class="legend">${narrow?'Machicolation non disponibile sui muri T1 stretti. ':'Machicolation: merlatura in aggetto con mensole. '}Hoarding sostituisce invece il coronamento esterno con una galleria lignea.</div></div>`;
  }
  if(cutawayEligible(s)){
    const cutaway=structureCutaway(s);
    html+=`<div class="slot"><div class="slot-label">Cutaway facade</div><button data-cutaway-toggle class="${cutaway?'active':''}" ${building?'disabled':''}>${cutaway?'Cutaway ON':'Cutaway OFF'}</button><div class="legend">Opens the camera-facing shell and exposes the functional rooms.</div></div>`;
  }
  if(['wall','palisade','built'].includes(s.type)){
    const flipLabel=s.type==='built'?'Exterior side / windows':'Exterior side';
    const flipLegend=s.type==='wall'?'Defines the exterior side for battlements or hoarding.':s.type==='palisade'?'Defines which side is exterior; walkway and earthwork are generated inward.':isWideBuilt(s)?'Exterior: arrow slits. Interior: tall hall windows (clerestory with portico).':'Exterior windows: upper level only. Interior windows/portico follow the opposite side.';
    html+=`<div class="slot"><div class="slot-label">${flipLabel}</div><button data-linear-flip class="active">⇄ Flip</button><div class="legend">${flipLegend}</div></div>`;
  }
  if(s.type!=='house'&&!simpleCivic){
    if(building)html+='<div class="slot"><div class="legend">Functions can be assigned when construction is complete.</div></div>';
    else if(cap===0)html+='<div class="slot"><div class="legend">No function capacity at the current footprint/height.</div></div>';
    else html+=Array.from({length:cap},(_,n)=>['tower','built'].includes(s.type)?cap-1-n:n).map(i=>{const value=s.functions[i],size=functionSlotSize(s,i),units=functionSlotUnits(s,i);return `<div class="slot"><div class="slot-label">Room ${i+1} · Floor ${i+1+functionFloorOffset(s)} ·${size.toUpperCase()} · ${units}× capacity</div><select data-function-slot="${i}"><option value="">— Empty —</option>${FUNCTION_CATALOG.map(k=>`<option value="${k}" ${value===k?'selected':''} ${window.ConquerSiege?.allowed(s,i,k)?'':'disabled'}>${FUNCTION_LABELS[k]}</option>`).join('')}</select></div>`}).join('');
  }
  if(['wall','palisade'].includes(s.type)&&!building){
    // Walls take damage bay by bay; a fallen bay opens a breach there.
    const siege=window.ConquerSiege,list=siege?.bays(s);
    if(list){
      const ladder=siege.assaultCheck(s,'ladder'),tower=siege.assaultCheck(s,'tower',2);
      const towerText=tower.ok?'torre liv. '+structureLevel(s)+'+':'torre no ('+tower.reason+')';
      html+='<div class="slot"><div class="slot-label">Integrità · '+list.length+' campate</div>'+
        list.map((b,i)=>'<div class="grid"><div class="legend">Campata '+(i+1)+' · '+Math.ceil(b.hp)+' / '+Math.round(b.max)+'</div>'+
          '<button data-siege-bay="'+i+'" type="button">Test trebuchet</button></div>').join('')+
        '<div class="legend">Assalto: '+(ladder.ok?'scale sì':'scale no ('+ladder.reason+')')+' · '+towerText+'</div></div>';
    }
  }
  const breakable=['tower','gate','built','house'].includes(s.type)||isCivic(s);
  if(breakable&&!building){
    const hp=window.ConquerSiege?.integrity(s);
    if(hp)html+='<div class="slot"><div class="slot-label">Defensive integrity</div>'+
      '<div class="legend">Masonry '+Math.ceil(hp.core.hp)+' / '+hp.core.max+
      (hp.portcullis?' · Grata '+Math.ceil(hp.portcullis.hp)+' / '+hp.portcullis.max:'')+
      (hp.door?' · Door '+Math.ceil(hp.door.hp)+' / '+hp.door.max:'')+'</div>'+
      '<div class="grid3"><button data-siege-test="axe" type="button">Test axe</button><button data-siege-test="ram" type="button">Test ram</button><button data-siege-test="trebuchet" type="button">Test trebuchet</button></div>'+
      '<div class="legend">Prototype damage controls; only effective tools can harm each material. Towers and gates lose their top storey at 2/3 and 1/3 of their health.</div></div>';
  }
  if(['tower','gate','built'].includes(s.type)){
    html+=window.ConquerSiege?.summaryHtml()||'';
  }
  html+=window.ConquerConvoys?.panelHtml?.(s)||'';
  html+=window.ConquerCrossings?.panel(s)||'';
  html+=window.ConquerGates?.panel(s)||'';
  slots.innerHTML=html;
  window.ConquerConvoys?.bindPanel?.(slots);
  window.ConquerSiege?.bindPanel(slots);
  window.ConquerCrossings?.bindPanel(slots);
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
  on('[data-wood-roof]',(id,el)=>StructureCommands.setWoodRoof(id,el.dataset.woodRoof));
  on('[data-gate-roof]',(id,el)=>StructureCommands.setGateRoof(id,el.dataset.gateRoof));
  on('[data-built-skin]',(id,el)=>StructureCommands.setSkin(id,el.dataset.builtSkin));
  on('[data-wall-skin]',(id,el)=>StructureCommands.setSkin(id,el.dataset.wallSkin));
  on('[data-cutaway-toggle]',id=>StructureCommands.toggleCutaway(id));
  on('[data-linear-flip]',id=>StructureCommands.flipSide(id));
  on('[data-function-slot]',(id,el)=>StructureCommands.setRoom(id,Number(el.dataset.functionSlot),el.value),'onchange');
  window.ConquerGates?.bindPanel(slots);
  on('[data-civic-level]',(id,el)=>StructureCommands.setCivicLevel(id,Number(el.dataset.civicLevel)));
  on('[data-civic-annex]',(id,el)=>startCivicAnnexPlacement(selectedStructure(),el.dataset.civicAnnex));
  slots.querySelectorAll('[data-civic-annex-child]').forEach(btn=>btn.onclick=()=>selectStructure(State.structures.find(x=>x.id===btn.dataset.civicAnnexChild)));
  on('[data-plaza-variant]',(id,el)=>StructureCommands.setPlazaVariant(id,el.dataset.plazaVariant));
  on('[data-tower-weapon]',(id,el)=>StructureCommands.setTowerWeapon(id,el.dataset.towerWeapon));
}
let pan=null;
