'use strict';
// DOM adapter for the Builder. Capture the actual controls before the compact
// palette detaches closed groups. The commands themselves never query buttons.
(function(){
  const tools=['tool','tower','woodTower','mainRoad','terraform','crossing','linear','gate','woodGate','civic','storageYard','industry','eventVenue','pier','slopeway','quay','well'];
  const settings=['terraformShape','terraformDelta','terraformRadius','crossingWidth','towerLevel','wallTier','wallLevel','gateLevel','buildMasonry'];
  const attr=key=>'data-'+key.replace(/[A-Z]/g,c=>'-'+c.toLowerCase());
  function bind(root){
    const commands=window.ConquerBuilderCommands,controls=[];
    for(const key of [...tools,...settings])for(const button of root.querySelectorAll('['+attr(key)+']')){
      controls.push({key,button});
      button.onclick=()=>commands.execute({...button.dataset,...(key==='tool'?{label:button.textContent.trim()}:{})});
    }
    return commands.subscribe(request=>{
      const selected=tools.find(key=>Object.hasOwn(request,key));
      const p=commands.options(),tool=State.tool,levels=State.buildLevels;
      const values={...p,towerLevel:levels.tower,wallTier:levels.wallTier,
        wallLevel:tool.kind==='linear'&&tool.span==='wide'?levels.builtWide:levels.wall,
        gateLevel:tool.kind==='gate'&&tool.material==='wood'?1:levels.gate,buildMasonry:State.buildMasonryMaterial};
      for(const {key,button} of controls){
        if(tools.includes(key)){
          if(!selected)continue;
          const variant=key!==selected?false:key==='gate'?Number(button.dataset.gateSize)===tool.size:
            key==='industry'&&tool.industry==='quarry'?(button.dataset.extractionMode||'stone')===(tool.placementSpec.extractionMode||'stone'):
            key==='pier'?String(button.dataset.yard||'')===String(tool.placementSpec.yard||''):true;
          const matches=key===selected&&variant&&Object.entries(request).every(([k,v])=>k==='label'||String(button.dataset[k])===String(v));
          button.classList.toggle('active',matches);
        }else{
          const active=String(button.dataset[key])===String(values[key]);
          button.classList.toggle('active',active);
          if(key==='buildMasonry')button.setAttribute('aria-pressed',String(active));
        }
      }
    });
  }
  window.ConquerBuilderControls=Object.freeze({bind});
})();
