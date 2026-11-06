'use strict';
// Disposable local-map previews. Loaded before core so no player save is read or written.
(()=>{
  const params=new URLSearchParams(location.search),allowed=['plains','hills','valley','river','forest','mountains','sea','swamp','lake'];
  const coastalDemos={gulf:'Golfi · 1 lato',headland:'Promontorio · 2 lati',peninsula:'Penisola · 3 lati',island:'Isola · 4 lati'};
  let demo=null;
  if(params.has('regionalDemo')){
    try{demo=JSON.parse(params.get('regionalData')||sessionStorage.getItem('conquer.regional-demo.'+params.get('regionalDemo'))||'null')}catch{}
    const biome=window.ConquerRegionalBiomeRules?.biomeForTerrain(demo?.terrain);
    if(biome)demo.biome=biome;else demo=null;
  }else if(Object.hasOwn(coastalDemos,params.get('demo'))){
    const preset=params.get('demo'),count=['gulf','headland','peninsula','island'].indexOf(preset)+1;
    const sides=['north','east','south','west'].slice(0,count),terrain=Object.fromEntries(Object.keys(window.ConquerRegionalBiomeRules.directions).map(k=>[k,'plain']));
    for(const side of sides)terrain[side]='sea';
    for(const [d,a,b] of [['northEast','north','east'],['southEast','south','east'],['southWest','south','west'],['northWest','north','west']])if(sides.includes(a)&&sides.includes(b))terrain[d]='sea';
    demo={version:1,biome:'plains',preset,seed:Number(params.get('seed')||4242),name:coastalDemos[preset],neighbors:[],surroundings:Object.fromEntries(Object.entries(terrain).map(([k,v])=>[k,{terrain:v,source:'demo'}]))};
  }else if(params.get('demo')==='mixed'){
    const terrain={north:'hills',northEast:'forest',east:'forest',southEast:'plain',south:'sea',southWest:'sea',west:'forest',northWest:'plain'};
    demo={version:1,biome:'plains',seed:Number(params.get('seed')||4242),name:'Fronte misto · campioni demo',neighbors:[],hasRiver:true,riverSides:['west'],surroundings:Object.fromEntries(Object.entries(terrain).map(([k,v])=>[k,{terrain:v,source:'demo'}]))};
  }else if(allowed.includes(params.get('demo'))){
    demo={version:1,biome:params.get('demo'),seed:Number(params.get('seed')||4242),name:'Demo '+params.get('demo'),neighbors:[]};
  }
  if(demo?.surroundings){
    const biomes={};for(const name of Object.keys(window.ConquerRegionalBiomeRules.directions)){
      const biome=window.ConquerRegionalBiomeRules.biomeForTerrain(demo.surroundings[name]?.terrain);
      if(biome)biomes[name]=biome;
    }
    if(Object.keys(biomes).length===8)demo.surroundingBiomes=biomes;
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
    for(const biome of allowed)select.add(new Option(BIOMES[biome].label,biome));
    for(const [key,label] of Object.entries(coastalDemos))select.add(new Option(label,key));select.value=info.preset||State.biome;
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
      if(info.surroundingBiomes){
        const labels={north:'N',northEast:'NE',east:'E',southEast:'SE',south:'S',southWest:'SO',west:'O',northWest:'NO'};
        const directions=document.createElement('p');directions.textContent='Biomi limitrofi applicati: '+Object.entries(labels).map(([k,label])=>label+' '+BIOMES[info.surroundingBiomes[k]].label).join(' · ')+'. Fasce 25 / 25 / 100 / 25 / 25 U.';output.append(directions);
      }else if(info.neighbors?.length){const note=document.createElement('p');note.textContent='Questo collegamento contiene solo il bioma centrale. Riapri il territorio dalla mappa regionale aggiornata per applicare gli otto limitrofi.';output.append(note)}
    };
    const refresh=document.createElement('button');refresh.textContent='Aggiorna misure';refresh.onclick=measure;panel.append(refresh);
    const back=document.createElement('a');back.href='CONQUER_WORLD_LAB.html?returnDemo=1';back.textContent=' ← Mappa regionale';back.style.color='#edbd75';panel.append(back);document.body.append(panel);measure();
    const regionalLink=document.querySelector('header a[href="./CONQUER_WORLD_LAB.html"]');if(regionalLink)regionalLink.href=back.href;
  });
})();
