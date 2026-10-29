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
      card('Mercato, prezzi e vendite',table,'La domanda esterna non viene generata automaticamente.');
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
  const views={general,people,economy};
  const root=$('profileControl');
  if(root){
    root.addEventListener('click',ev=>{
      const tab=ev.target.closest('[data-cp-tab]');
      if(tab){current=tab.dataset.cpTab;render();}
    });
    setInterval(()=>{if(!$('profileOverlay')?.hidden&&!root.hidden&&!root.contains(document.activeElement))render();},1800);
  }
  window.ConquerPanels=Object.freeze({open,render,tabs:tabs.map(x=>x[0])});
})();