'use strict';
// GILDA-01 fase 1 (D-GILDA-261113): the Guild absorbs the Casa delle Corporazioni and
// only raises the productivity of the L2 workshops, village-wide. One guild is active
// per village (highest level, then the oldest id); its bonus is +25/+50/+100% at
// L1/L2/L3, scaled by the coverage of its educated officials (SCOL-01 role
// 'guild.official', 1/2/3 seats, minYield 0). Until ConquerEducated exposes coverage
// the officials count as present (transitional yield 1). The Guild treasury, the
// levy on workshop sales and the officials' wages arrive in phase 2.
(() => {
  const BONUS=Object.freeze({1:.25,2:.5,3:1});
  const SEATS=Object.freeze({1:1,2:2,3:3});
  const ROLE_ID='guild.official';
  const ROOMS=Object.freeze({1:'Banco dei funzionari',2:'Archivio dei marchi',3:'Sala dei maestri'});
  const finite=(v,d=0)=>Number.isFinite(+v)?+v:d;
  const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
  const round=n=>Math.round(n*1000)/1000;
  const completed=s=>!!s&&!s.destroyed&&!s.abandoned&&
    !(typeof underConstruction==='function'&&underConstruction(s));
  const level=s=>typeof civicLevel==='function'?civicLevel(s):clamp(Math.round(finite(s?.civicLevel,1)),1,3);

  function guilds(){
    return (State.structures||[]).filter(s=>s.type==='guild'&&completed(s));
  }
  // Older saves may hold one guild per well: only the best one works.
  function active(){
    return guilds().slice().sort((a,b)=>level(b)-level(a)||
      String(a.id).localeCompare(String(b.id),'en',{numeric:true}))[0]||null;
  }
  function seats(){
    const g=active();
    return g?SEATS[level(g)]:0;
  }
  // Officials' yield: SCOL-01 coverage once it exists, otherwise 1 with an active guild.
  function officialYield(){
    if(!active())return 0;
    const cov=window.ConquerEducated?.coverage?.(ROLE_ID);
    return cov?clamp(finite(cov.yield),0,1):1;
  }
  function maxBonus(){
    const g=active();
    return g?BONUS[level(g)]:0;
  }
  // Workshop output multiplier is 1 + bonus. ECO-FIL-01 phase 2 will scale input
  // consumption by the same factor; until then only output grows.
  function bonus(){
    return round(maxBonus()*officialYield());
  }
  function snapshot(){
    const g=active();
    const shops=Object.keys(window.ConquerCommerce?.state?.()?.shops||{}).length;
    return {guilds:guilds().length,activeId:g?String(g.id):null,level:g?level(g):0,
      maxBonus:maxBonus(),bonus:bonus(),seats:seats(),officialYield:round(officialYield()),shops};
  }

  // ---- Inspector tab -------------------------------------------------------------
  const pct=n=>'+'+Math.round(finite(n)*100)+'%';
  function panelHtml(s){
    if(!s||s.type!=='guild'||!completed(s))return '';
    const d=snapshot();
    const kv=(k,v)=>'<div class="kv"><span>'+k+'</span><b>'+v+'</b></div>';
    if(d.activeId!==String(s.id))
      return '<div class="slot guild-panel"><div class="slot-label">Gilda · inattiva</div>'+
        '<div class="legend">Una sola Gilda per villaggio: lavora quella di livello più alto. '+
        'Questa sala resta senza effetto.</div></div>';
    const coverage=window.ConquerEducated?.coverage?.(ROLE_ID);
    const officials=coverage?Math.round(finite(coverage.assigned))+' / '+d.seats:
      d.seats+' / '+d.seats+' (provvisorio)';
    return '<div class="slot guild-panel"><div class="slot-label">Gilda · L'+d.level+' · '+ROOMS[d.level]+'</div>'+
      kv('Bonus delle botteghe L2',pct(d.bonus)+' (massimo '+pct(d.maxBonus)+')')+
      kv('Funzionari',officials)+
      kv('Botteghe nel villaggio',String(d.shops))+
      '<div class="legend">Vale per tutte le botteghe L2 del villaggio. Senza funzionari nessun bonus. '+
      'Cassa della Gilda e quota sulle vendite: fase successiva.</div></div>';
  }
  window.ConquerGuild=Object.freeze({BONUS,SEATS,ROLE_ID,ROOMS,
    guilds,active,seats,officialYield,maxBonus,bonus,snapshot,panelHtml});
})();
