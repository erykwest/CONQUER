'use strict';
// Disposable local-map previews. Loaded before core so no player save is read or written.
(()=>{
  const params=new URLSearchParams(location.search),allowed=['plains','hills','valley','river','forest','mountains','sea','swamp','lake'];
  let demo=null;
  if(params.has('regionalDemo')){
    try{demo=JSON.parse(params.get('regionalData')||sessionStorage.getItem('conquer.regional-demo.'+params.get('regionalDemo'))||'null')}catch{}
    const biome=window.ConquerRegionalBiomeRules?.biomeForTerrain(demo?.terrain);
    if(biome)demo.biome=biome;else demo=null;
  }else if(allowed.includes(params.get('demo'))){
    demo={version:1,biome:params.get('demo'),seed:Number(params.get('seed')||4242),name:'Demo '+params.get('demo'),neighbors:[]};
  }
  if((params.has('regionalDemo')||params.has('demo'))&&!(demo?.version===1&&allowed.includes(demo.biome)&&Number.isInteger(demo.seed)&&demo.seed>=0&&demo.seed<=2147483647)){
    demo={version:1,seed:4242,biome:'test',error:'Dati del territorio mancanti o non validi. Riapri la cella dalla mappa regionale.',neighbors:[]};
  }
  if(demo?.error||demo?.version===1&&allowed.includes(demo.biome)&&Number.isInteger(demo.seed)&&demo.seed>=0&&demo.seed<=2147483647){
    window.__CONQUER_REGIONAL_DEMO__=demo;
  }
  window.addEventListener('load',()=>{
    if(!window.__CONQUER_REGIONAL_DEMO__)return;
    const info=window.__CONQUER_REGIONAL_DEMO__;
    if(info.error){
      document.getElementById('wrap').hidden=true;
      document.getElementById('wrap').style.display='none';
      const alert=document.createElement('p');alert.id='demoLaunchError';alert.setAttribute('role','alert');alert.style.cssText='padding:40px;color:#efd1a6;font:18px system-ui';alert.textContent=info.error;
      const back=document.createElement('a');back.href='CONQUER_WORLD_LAB.html';back.textContent=' Torna alla mappa regionale';alert.append(back);document.body.append(alert);return;
    }
    State.daylightOverride='day';State.clock.speed=0;invalidateSceneCache();draw();
    const panel=document.createElement('details');panel.open=true;panel.id='naturalDemoPanel';
    panel.style.cssText='position:fixed;top:140px;left:76px;z-index:70;width:270px;max-height:60vh;overflow:auto;background:#201b15ee;color:#eadcc5;border:1px solid #8c7049;border-radius:8px;padding:12px;font:13px system-ui';
    const summary=document.createElement('summary');summary.textContent='DEMO · '+info.name;panel.append(summary);
    const intro=document.createElement('p');intro.textContent='Seed '+State.seed+' · Bioma centrale: '+BIOMES[State.biome].label+(info.hasRiver?' · Fiume di confine aggiuntivo.':'.')+' Prova temporanea: nessun salvataggio della partita.';panel.append(intro);
    const controls=document.createElement('div');
    const select=document.createElement('select');select.setAttribute('aria-label','Scenario demo');
    for(const biome of allowed)select.add(new Option(BIOMES[biome].label,biome));select.value=State.biome;
    select.onchange=()=>{location.href='index.html?demo='+select.value+'&seed='+info.seed};controls.append(select);panel.append(controls);
    const output=document.createElement('div');output.id='naturalDemoMetrics';panel.append(output);
    const measure=()=>{
      const env=State.environment,forests=env.filter(f=>f.type==='forest'),mountains=env.filter(f=>f.type==='mountain'),water=env.filter(f=>['river','stream','sea','pond'].includes(f.type)),hills=State.relief?.hills||[];
      const rows=[['Boschi',forests],['Acqua',water],['Montagne',mountains],['Terrazze',hills.map(h=>({type:'mountain',points:reliefHillFootprint(h)}))]];
      const percent=(features,min,span)=>{let covered=0;const n=40;for(let y=0;y<n;y++)for(let x=0;x<n;x++){const p={x:min+(x+.5)*span/n,y:min+(y+.5)*span/n};if(features.some(f=>environmentContains(f,p)))covered++}return(covered/(n*n)*100).toFixed(1)+'%'};
      output.replaceChildren();const table=document.createElement('table');table.style.cssText='width:100%;margin-top:12px;text-align:right';
      const header=table.insertRow();for(const text of ['Componente','Mappa','Buildable']){const th=document.createElement('th');th.textContent=text;header.append(th)}
      for(const [name,features] of rows){const tr=table.insertRow();for(const text of [name,percent(features,0,200),percent(features,50,100)])tr.insertCell().textContent=text}
      output.append(table);
      const counts=document.createElement('p');counts.textContent=forests.length+' boschi · '+hills.length+' rilievi terrazzati · '+mountains.filter(m=>!m.subPeak).length+' cime principali · '+water.filter(f=>f.type==='river').length+' fiumi · '+water.filter(f=>f.type==='stream').length+' ruscelli. Coperture stimate su griglia 40×40, non sommare le percentuali.';output.append(counts);
      if(info.neighbors?.length){const neighbors=document.createElement('p');neighbors.textContent='Confinanti regionali: '+info.neighbors.map(n=>n.code+' ('+n.terrain+')').join(', ')+'. Dati di contesto: le otto influenze non sono ancora composte nel terreno del Builder.';output.append(neighbors)}
    };
    const refresh=document.createElement('button');refresh.textContent='Aggiorna misure';refresh.onclick=measure;panel.append(refresh);
    const back=document.createElement('a');back.href='CONQUER_WORLD_LAB.html?returnDemo=1';back.textContent=' ← Mappa regionale';back.style.color='#edbd75';panel.append(back);document.body.append(panel);measure();
    const regionalLink=document.querySelector('header a[href="./CONQUER_WORLD_LAB.html"]');if(regionalLink)regionalLink.href=back.href;
  });
})();
