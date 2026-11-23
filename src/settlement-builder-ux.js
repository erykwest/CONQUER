/* CONQUER / UX: visual construction palette. Reuses the established tool buttons and handlers. */
(() => {
  'use strict';
  const root=document.getElementById('builder');
  if(!root)return;
  const ICON_ROOT='./src/assets/builder-icons/';
  const SVG_FILES=new Set(["accampamento-militare","arena","banchina","bargello","campo-addestramento","campo-taglialegna","cantiere-navale-l1","cantiere-navale-l2","catalog.json","category-civic","category-combat","category-defense","category-economy","category-events","category-infrastructure","category-terrain","cava-argilla","cava-pietra","chiesa","forca","fossato-allagato","fossato-asciutto","gilda","gogna","longhouse-w1","longhouse-w2","magazzino","mercato","miniera","molo-grande","molo-piccolo","mulino-acqua","mulino-vento","municipio","mura","palazzo-balivo","palco","palizzata","patibolo","ponte-legno","ponte-pietra","porta-lignea","porta-muraria","porta-piccola","pozzo","pulpito","rampa","rimuovi-foresta","sala-larga","scalinata","semitorre","sezione-costruita","spianamento","spiazzo-eventi","strada","taverna","terrazzamento-murato","terreno","torre-d","torre-guardia-lignea","torre-lignea","torre-quadrata","torre-rotonda","ui-demolish","ui-depth","ui-height","ui-material","ui-radius","ui-rotate","ui-save","ui-select","ui-shape","ui-undo"]);
  const path={
    cursor:'M5 3l14 10-7 1-3 7z',
    civic:'M3 11 12 4l9 7M5 10v11h14V10M10 21v-7h4v7',
    work:'M4 20 17 7m-4-2 6 6M4 5l5 5M3 21l4-4',
    windmill:'M12 4v17M6 21h12M12 7l-6-3m6 3 6-3m-6 3-6 10m6-10 6 10M3 11l18-8',
    watermill:'M3 20h18M4 20V7h9v13M16 9a5 5 0 1 0 0 10a5 5 0 1 0 0-10M16 9v10m-5-5h10',
    castle:'M3 21V8h4V4h3v4h4V4h3v4h4v13M3 13h18M9 21v-6h6v6',
    route:'M4 21c11 0 4-18 16-18M4 16c7 0 5-10 16-10M9 20l-1-2m9-9-1-2',
    moat:'M3 5c3 7 4 7 8 6s5-4 7 7M2 8c4 7 6 8 10 6s5-4 10 6',
    bridge:'M2 18h20M4 18V9l8-5 8 5v9M7 18v-7m10 7v-7M4 9h16',
    terrain:'M2 18c4-1 5-7 10-8s5 5 10 3M2 21h20M8 16l4-6 4 4',
    terrace:'M3 20h18M5 20v-5h5v-4h5V7h4M10 15h9M15 11h4',
    trash:'M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6m4-6v6',
    undo:'M9 14l-5-5 5-5M4 9h10a6 6 0 010 12',
    square:'M5 20V5h14v15M5 12h14M11 5v-3m2 3v-3',
    round:'M12 3a8 8 0 018 8v10H4V11a8 8 0 018-8M4 13h16M9 21v-5h6v5',
    timber:'M4 21V7l8-4 8 4v14M4 7h16M7 21V10m10 11V10M4 21h16',
    wall:'M2 20V7h4V4h3v3h6V4h3v3h4v13zM2 13h20M9 13v7m7-7v7',
    fence:'M4 21V7l3-4 3 4v14M14 21V7l3-4 3 4v14M2 12h20M2 18h20',
    built:'M3 21V5h18v16M3 11h18M9 11v10m6-10v10M7 7h2m6 0h2',
    gate:'M3 21V7h4V4h3v3h4V4h3v3h4v14M8 21v-5a4 4 0 018 0v5M3 12h18',
    well:'M4 11h16M6 11V6l6-3 6 3v5M7 11l2 10h6l2-10M12 8v9',
    market:'M3 11l2-7h14l2 7M3 11h18M5 11v10h14V11M9 21v-6h6v6',
    tavern:'M3 20V9l9-6 9 6v11M8 20v-7h8v7M5 9h14M15 6l3 2',
    church:'M3 21V11l9-5 9 5v10M9 21v-7h6v7M12 2v7m-3-4h6',
    training:'M3 21V5h18v16M7 7l10 12m0-12L7 19M9 2v3m6-3v3',
    townhall:'M3 21V12h10v9M13 21V5h6v16M3 21h18M16 2v3M6 15h4M15 9h2',
    guild:'M5 21V9l7-6 7 6v12M9 21v-5h6v5M12 9a1.5 1.5 0 100 .1',
    bargello:'M3 21V11h11v10M14 21V4h6v17M3 21h18M14 6h6M16 4V2h2v2M8 21v-4h2v4',
    balivo:'M2 21V10l9-6 9 6v11M2 21h20M6 21v-6h4v6M13 13h4M7 10l4-3 4 3',
    level:'M4 20h16M6 16h12M8 12h8M10 8h4M12 4v-2',
    depth:'M3 8l9-5 9 5-9 5zM3 8v8l9 5 9-5V8M12 13v8',
    rotate:'M20 11a8 8 0 10-2 7M20 4v7h-7',
    events:'M4 21l8-17 8 17M8 13h8M12 4v-2l4 1-4 1',
    podium:'M4 21h16M6 21v-5h12v5M9 16V9a3 3 0 016 0v7M12 6V3',
    stage:'M2 21h20M3 21v-7h18v7M5 14V5h14v9M5 5l3 4h8l3-4',
    festival:'M3 20h18M4 20l3-8 3 8M14 20l3-8 3 8M7 12V7l-3 2M17 12V7l3 2',
    arena:'M3 18c0-6 4-11 9-11s9 5 9 11M7 18c0-4 2-7 5-7s5 3 5 7M3 18h18M12 7V3l3 1-3 1',
    save:'M5 3h12l4 4v14H3V3h2M7 3v7h10V3M7 21v-8h10v8'
  };
  function svg(name){
    return '<svg class="ux-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+(path[name]||path.built)+'"/></svg>';
  }
  function iconMarkup(name){
    if(SVG_FILES.has(name))return '<img class="ux-svg" src="'+ICON_ROOT+name+'.svg?v=1" alt="" width="64" height="64" draggable="false" aria-hidden="true">';
    return svg(name);
  }
  const groups=[
    {id:'civic',label:'Edifici civili',icon:'category-civic',items:[
      // Municipio, Gilda e Bargello sono ampliamenti del pozzo: si avviano dal suo inspector.
      ['[data-well]','Pozzo · Fondazione villaggio','pozzo'],
      ['[data-civic="market"]','Mercato','mercato'],
      ['[data-civic="tavern"]','Taverna','taverna'],
      ['[data-civic="church"]','Chiesa','chiesa'],
      ['[data-civic="balivo"]','Palazzo del Balivo · nel contado','palazzo-balivo'],
      ['[data-civic="training"]','Campo di addestramento','campo-addestramento'],
      ['[data-event-venue="pillory"]','Gogna · 1×1U · piazza','gogna'],
      ['[data-event-venue="gallows"]','Forca · 2×1.5U · piazza o margine','forca'],
      ['[data-event-venue="scaffold"]','Patibolo · 2.5×2U · piazza maggiore','patibolo']]},
    {id:'defense',label:'Fortificazioni',icon:'category-defense',items:[
      ['[data-tower="square"][data-size="1.5"]','Torre quadrata T2','torre-quadrata'],
      ['[data-tower="round"][data-size="0.75"]','Torre rotonda T2','torre-rotonda'],
      ['[data-tower="half"][data-size="1"]','Semitorre aperta alla gola','semitorre'],
      ['[data-tower="dee"][data-size="1.5"]','Torre a D · fronte tonda','torre-d'],
      ['[data-wood-tower="watchtower"]','Torre di guardia lignea','torre-guardia-lignea'],
      ['[data-wood-tower="palisadeTower"]','Torre lignea','torre-lignea'],
      ['[data-linear="wall"]','Mura','mura'],
      ['[data-linear="palisade"]','Palizzata','palizzata'],
      ['[data-linear="built"]','Sezione costruita','sezione-costruita'],
      ['[data-linear="builtWide"]','Sala larga 2U · doppia altezza','sala-larga'],
      ['[data-linear="longhouse"]','Long house lignea W1 · solo P0','longhouse-w1'],
      ['[data-linear="longhouseWide"]','Long house lignea W2 · solo P0','longhouse-w2'],
      ['[data-gate][data-gate-size="1.5"]','Porta muraria · 1,5×1,5U','porta-muraria'],
      ['[data-gate][data-gate-size="1"]','Porta piccola · 1×1U · L1–L2','porta-piccola'],
      ['[data-wood-gate]','Porta lignea','porta-lignea']]},
    {id:'economy',label:'Produzione',icon:'category-economy',items:[
      ['[data-storage-yard]','Piazzale / magazzino · 2×2U espandibile','magazzino'],
      ['[data-industry="loggingCamp"]','Campo taglialegna','campo-taglialegna'],
      ['[data-industry="quarry"]:not([data-extraction-mode])','Cava pietra','cava-pietra'],
      ['[data-industry="quarry"][data-extraction-mode="clay"]','Cava argilla · H0 · entro 6U da acqua interna','cava-argilla'],
      ['[data-industry="mine"]','Miniera','miniera'],
      ['[data-industry="windmill"]','Mulino a vento · 2×2U · H+1','mulino-vento'],
      ['[data-industry="watermill"]','Mulino ad acqua · 2×2U · riva del fiume','mulino-acqua']]},
    {id:'events',label:'Eventi e svago',icon:'category-events',items:[
      ['[data-event-venue="streetSpot"]','Pulpito · 1.6×1.6U · artisti di strada','pulpito'],
      ['[data-event-venue="stage"]','Palco · 2.4×1.2U · artisti / annunci','palco'],
      ['[data-event-venue="festivalGround"]','Spiazzo eventi · 14×10U · giostra, torneo, circo, sagra','spiazzo-eventi'],
      ['[data-event-venue="arenaLot"]','Arena · 18×14U · lotto dedicato','arena']]},
    {id:'combat',label:'Combattimento e allarmi',icon:'category-combat',items:[
      ['[data-event-venue="armyCamp"]','Accampamento militare · capi, compagnie, logistica · steccato → palizzata','accampamento-militare'],
      ['[data-event-venue="stakeRow"]','Pali anti-carica · tratti da 1.4U · punte verso il fronte','castle'],
      ['[data-event-venue="chevalFrise"]','Cavallo di Frisia · 1.4U · sbarra un varco','castle']]},
    {id:'terrain',label:'Terraforming',icon:'category-terrain',items:[
      ['[data-terraform="terrain"]','Terreno','terreno'],
      ['[data-terraform="walled"]','Terrazzamento murato','terrazzamento-murato'],
      ['[data-terraform="flat"]','Flat · sottrai e riporta a H0','spianamento'],
      ['[data-terraform="forest"]','Rimuovi foresta · job L1 · legname','rimuovi-foresta']]},
    {id:'infrastructure',label:'Infrastrutture',icon:'category-infrastructure',items:[
      ['[data-main-road]','Strada principale','strada'],
      ['[data-crossing="dry"]','Fossato asciutto','fossato-asciutto'],
      ['[data-crossing="water"]','Fossato allagato · quota 0','fossato-allagato'],
      ['[data-crossing="wood"]','Ponte di legno','ponte-legno'],
      ['[data-crossing="stone"]','Ponte di pietra','ponte-pietra'],
      ['[data-pier="4"]','Molo piccolo L4 · 4U sul mare · 2 attracchi','molo-piccolo'],
      ['[data-pier="12"]','Molo grande L12 · 12U sul mare · 2 attracchi','molo-grande'],
      ['[data-slopeway="ramp"]','Rampa · 2U · collega due quote · pedoni e carri · pendenza max 1:4','rampa'],
      ['[data-slopeway="stairway"]','Scalinata · 1U · gradini sul pendio · solo pedoni','scalinata'],
      ['[data-quay]','Banchina in pietra · 2U · due clic lungo la riva o in acqua','banchina'],
      ['[data-yard="1"]','Cantiere navale L1 · scalo 7U · barche e caravelle','cantiere-navale-l1'],
      ['[data-yard="2"]','Cantiere navale L2 · scalo 10U · piazzale 12U · tutte le navi','cantiere-navale-l2']]}
  ];
  // The combat module inserts live controls into #builder before this UX loads.
  // Replacing children without retaining them detached Combat and crashed every
  // simulation draw once a village well became active.
  const combatPanel=root.querySelector('#combatControls');
  const originalButtons=[...root.querySelectorAll('button')];
  const controls=[
    {name:'Materiale di muratura',icon:'ui-material',category:'all',selectors:['[data-build-masonry]']},
    {name:'Pianta torre quadrata',icon:'torre-quadrata',selectors:['[data-tower="square"]']},
    {name:'Pianta torre rotonda',icon:'torre-rotonda',selectors:['[data-tower="round"]']},
    {name:'Semitorri e torri a D',icon:'semitorre',selectors:['[data-tower="half"]','[data-tower="dee"]']},
    {name:'Altezza torre',icon:'ui-height',selectors:['[data-tower-level]']},
    {name:'Spessore muro / palizzata',icon:'ui-depth',selectors:['[data-wall-tier]']},
    {name:'Altezza muro',icon:'ui-height',selectors:['[data-wall-level]']},
    {name:'Altezza porta',icon:'ui-height',selectors:['[data-gate-level]']},
    {name:'Larghezza fossati e ponti',icon:'ui-depth',category:'infrastructure',selectors:['[data-crossing-width]']},
    {name:'Forma terreni / terrazzamenti',icon:'ui-shape',category:'terrain',selectors:['[data-terraform-shape]']},
    {name:'Scava / innalza',icon:'ui-height',category:'terrain',selectors:['[data-terraform-delta]']},
    {name:'Raggio intervento',icon:'ui-radius',category:'terrain',selectors:['[data-terraform-radius]']}
  ];
  // Move the original DOM nodes: old event bindings continue to operate unchanged.
  root.replaceChildren();
  root.classList.add('ux-builder');
  const rail=document.createElement('nav');rail.className='ux-rail';rail.setAttribute('aria-label','Strumenti di costruzione');
  const flyout=document.createElement('section');flyout.className='ux-flyout';flyout.setAttribute('aria-label','Catalogo edifici');flyout.hidden=true;
  const header=document.createElement('div');header.className='ux-flyout-head';
  const heading=document.createElement('strong');heading.id='uxCategoryTitle';
  const close=document.createElement('button');close.type='button';close.className='ux-close';close.innerHTML=iconMarkup('ui-select');close.setAttribute('aria-label','Chiudi catalogo');close.dataset.tip='Chiudi catalogo';
  header.append(heading,close);
  const catalog=document.createElement('div');catalog.className='ux-catalog';
  const options=document.createElement('div');options.className='ux-options';
  const optionHeading=document.createElement('strong');optionHeading.textContent='Configurazione';
  options.append(optionHeading);
  flyout.append(header,catalog,options);
  // Preserve the existing combat DOM, its IDs and event listeners even while
  // its palette category is closed. Other systems still update these controls.
  const retained=document.createElement('div');
  retained.id='uxRetainedControls';
  retained.hidden=true;
  root.append(rail,flyout,retained);
  if(combatPanel)retained.append(combatPanel);
  // Production tools are also live, event-bound DOM controls: retain them
  // inside the document while a different palette is open.
  const industryButtons=originalButtons.filter(b=>b.hasAttribute('data-industry'));
  for(const b of industryButtons)retained.append(b);
  let currentCategory=null;
  function iconize(btn,label,icon,tag){
    btn.classList.add('ux-icon-btn');btn.setAttribute('aria-label',label);btn.setAttribute('title',label);
    btn.dataset.tip=label;btn.dataset.icon=icon;btn.innerHTML=iconMarkup(icon)+(tag?'<span class="ux-token">'+tag+'</span>':'');
    return btn;
  }
  function command(label,icon,handler){
    const b=document.createElement('button');b.type='button';iconize(b,label,icon);b.addEventListener('click',handler);return b;
  }
  const select=originalButtons.find(b=>b.dataset.tool==='select');
  const remove=originalButtons.find(b=>b.dataset.tool==='delete');
  const undo=originalButtons.find(b=>b.id==='undoBtn');
  const clear=originalButtons.find(b=>b.id==='clearBtn');
  if(select){iconize(select,'Seleziona','ui-select');rail.append(select)}
  const separator=document.createElement('div');separator.className='ux-separator';rail.append(separator);
  const groupButtons=new Map();
  function toggleGroup(id){
    currentCategory=currentCategory===id?null:id;
    flyout.hidden=!currentCategory;
    groupButtons.forEach((btn,key)=>{btn.classList.toggle('active',key===currentCategory);btn.setAttribute('aria-expanded',String(key===currentCategory))});
    if(!currentCategory)return;
    const group=groups.find(g=>g.id===currentCategory);
    heading.textContent=group.label;
    // Move, never destroy, the event-bound combat panel during category changes.
    if(combatPanel)retained.append(combatPanel);
    for(const b of industryButtons)retained.append(b);
    catalog.replaceChildren();
    if(group.id==='combat'&&combatPanel)catalog.append(combatPanel);
    for(const [selector,label,icon] of group.items){
      const b=originalButtons.find(x=>x.matches(selector));
      if(!b)continue;iconize(b,label,icon);catalog.append(b);
    }
    options.hidden=currentCategory==='combat';
    options.querySelectorAll('.ux-option-line').forEach(line=>{
      line.style.display=(line.dataset.category==='all'||(line.dataset.category||'defense')===currentCategory)?'flex':'none';
    });
  }
  for(const group of groups){
    const b=command(group.label,group.icon,()=>toggleGroup(group.id));
    b.setAttribute('aria-expanded','false');groupButtons.set(group.id,b);rail.append(b);
  }
  if(remove){iconize(remove,'Demolisci','ui-demolish');rail.append(remove)}
  const bottom=document.createElement('div');bottom.className='ux-rail-bottom';rail.append(bottom);
  if(undo){iconize(undo,'Annulla ultima costruzione','ui-undo');bottom.append(undo)}
  if(clear){iconize(clear,'Elimina tutto','ui-demolish');bottom.append(clear)}
  for(const control of controls){
    const line=document.createElement('div');line.className='ux-option-line';
    line.dataset.tip=control.name;line.dataset.category=control.category||'defense';line.setAttribute('aria-label',control.name);
    const glyph=document.createElement('span');glyph.className='ux-option-glyph';glyph.innerHTML=iconMarkup(control.icon);
    line.append(glyph);
    const values=document.createElement('div');values.className='ux-option-values';
    for(const selector of control.selectors){
      for(const b of originalButtons.filter(x=>x.matches(selector))){
        const label=b.textContent.trim().replace(/\s+/g,' ');
        const token=(['half','dee'].includes(b.dataset.tower) ? label : b.dataset.size ? b.dataset.size+'U' : b.dataset.towerLevel ? 'H'+b.dataset.towerLevel : b.dataset.wallTier ? 'T'+b.dataset.wallTier : b.dataset.wallLevel ? 'H'+b.dataset.wallLevel : b.dataset.gateLevel ? 'H'+b.dataset.gateLevel : b.dataset.terraformDelta ? (Number(b.dataset.terraformDelta)<0?'−1U':'+1U') : b.dataset.terraformRadius ? 'R'+b.dataset.terraformRadius : label);
        b.classList.add('ux-value-btn');b.title=control.name+' · '+label;b.setAttribute('aria-label',b.title);b.dataset.tip=b.title;b.textContent=token;
        values.append(b);
      }
    }
    line.append(values);options.append(line);
  }
  close.addEventListener('click',()=>{currentCategory=null;flyout.hidden=true;groupButtons.forEach(b=>{b.classList.remove('active');b.setAttribute('aria-expanded','false')})});
  // Clicking an actual build tool chooses it without closing the palette; this
  // keeps level/tier presets accessible while the ghost is being previewed.
  for(const b of originalButtons)b.addEventListener('click',()=>{
    if(b.hasAttribute('data-tool')||b.hasAttribute('data-tower')||b.hasAttribute('data-wood-tower')||b.hasAttribute('data-linear')||b.hasAttribute('data-main-road')||b.hasAttribute('data-terraform')||b.hasAttribute('data-crossing')||b.hasAttribute('data-gate')||b.hasAttribute('data-wood-gate')||b.hasAttribute('data-well')||b.hasAttribute('data-civic')||b.hasAttribute('data-industry')||b.hasAttribute('data-event-venue')||b.hasAttribute('data-pier')||b.hasAttribute('data-quay')||b.hasAttribute('data-slopeway')){
      requestAnimationFrame(()=>{if(b.classList.contains('ux-icon-btn'))document.querySelectorAll('.ux-catalog .ux-icon-btn').forEach(x=>x.classList.toggle('active',x===b))});
    }
  });
  const inspector=document.querySelector('#functionPanel .panel-head h2');
  if(inspector)inspector.textContent='Inspector';
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&currentCategory){
      currentCategory=null;flyout.hidden=true;groupButtons.forEach(b=>{b.classList.remove('active');b.setAttribute('aria-expanded','false')});
    }
  });
  // Tooltip is provided by aria-label/title for pointer, keyboard and touch.
})();
