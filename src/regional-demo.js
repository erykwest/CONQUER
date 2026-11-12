'use strict';
// Disposable local-map previews. Loaded before core so no player save is read or written.
(()=>{
  const params=new URLSearchParams(location.search),allowed=['plains','hills','valley','river','forest','mountains','sea','swamp','lake'];
  const coastalDemos={gulf:'Golfi · 1 lato',headland:'Promontorio · 2 lati',peninsula:'Penisola · 3 lati',island:'Isola · 4 lati'};
  let demo=null;
  if(params.has('regionalDemo')){
    try{demo=JSON.parse(params.get('regionalData')||sessionStorage.getItem('conquer.regional-demo.'+params.get('regionalDemo'))||'null')}catch{}
    const biome=window.ConquerRegionalBiomeRules?.biomeForTerrain(demo?.terrain);
    if(biome&&window.ConquerRegionalBiomeRules.isSelectableTerrain(demo?.terrain))demo.biome=biome;else demo=null;
  }else if(['mouth-sea','mouth-lake','river-confluence','stream-confluence','mixed-confluence'].includes(params.get('demo'))){
    const preset=params.get('demo'),stream=preset==='stream-confluence',forest=stream||preset==='mixed-confluence';
    const terrain=Object.fromEntries(Object.keys(window.ConquerRegionalBiomeRules.directions).map(k=>[k,forest?'forest':'plain']));
    if(preset.startsWith('mouth-'))for(const d of ['south','southEast','southWest'])terrain[d]=preset==='mouth-sea'?'sea':'lake';
    demo={version:1,biome:forest?'forest':'plains',preset,seed:Number(params.get('seed')||4242),name:preset,hasRiver:!stream,riverSides:['north','east'],tributaryTypes:preset==='river-confluence'?['river']:preset.endsWith('confluence')?['stream']:[],surroundings:Object.fromEntries(Object.entries(terrain).map(([k,v])=>[k,{terrain:v,source:'demo'}]))};
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
    const select=document.getElementById('biomeSelect');
    if(params.has('regionalDemo')&&select){select.disabled=true;select.title='Bioma ereditato dal territorio regionale';}
    State.daylightOverride='day';State.clock.speed=0;invalidateSceneCache();draw();
    const regionalLink=document.querySelector('header a[href="./CONQUER_WORLD_LAB.html"]');
    if(regionalLink)regionalLink.href='CONQUER_WORLD_LAB.html?returnDemo=1';
  });
})();
