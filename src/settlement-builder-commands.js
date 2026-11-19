'use strict';
// Builder choices and presets. Both interfaces call execute with plain data;
// placement, construction costs and simulation keep their existing owners.
(function(){
  const listeners=new Set();
  const presets={terraformShape:'round',terraformDelta:1,terraformRadius:4,crossingWidth:2};
  const changed=message=>{State.draft=null;status(message);draw()};
  const choose=tool=>setTool(tool);
  const industryRatePerWorker=type=>{
    const k=window.ConquerEconomy?.KIND?.[type];
    return k&&k.rate&&k.workers?Math.round(k.rate/k.workers*100)/100:1;
  };
  const handlers={
    tool:(kind,p)=>choose({kind,label:p.label||({select:'Select',delete:'Delete'}[kind]||kind)}),
    tower:(shape,p)=>{
      const size=Number(p.size),level=State.buildLevels.tower;
      const dummy={type:'tower',material:'stone',masonryMaterial:State.buildMasonryMaterial,shape,level,...(shape==='round'?{r:size}:{size})};
      choose({kind:'tower',material:'stone',shape,size,level,label:`${isOrientedTowerShape(shape)?orientedTowerLabel(dummy):shape+' tower '+size+'U'} · L${level} · ${buildDuration(dummy).toFixed(0)}d · ${costText(constructionCost(dummy))}`});
    },
    woodTower:style=>{
      const size=woodTowerSize(style),level=woodTowerLevel(style),woodRoof=style==='palisadeTower'?'open':'pitched';
      const dummy={type:'tower',material:'wood',woodStyle:style,woodRoof,shape:'square',size,level};
      choose({kind:'tower',material:'wood',woodStyle:style,woodRoof,shape:'square',size,level,label:`${style==='watchtower'?'Wood watchtower':style==='frameTower'?'Timber frame tower':'Wood tower'} · H${level} · ${buildDuration(dummy).toFixed(1)}d · ${costText(constructionCost(dummy))}`});
    },
    mainRoad:()=>choose({kind:'linear',linear:'road',label:'Main road — choose point A'}),
    terraform:value=>{
      const mode=['forest','walled','flat'].includes(value)?value:'terrain';
      const {terraformShape:shape,terraformRadius:radius,terraformDelta:delta}=presets;
      choose({kind:'terraform',mode,shape,radius,delta,label:mode==='forest'?'Rimuovi foresta · job L1 · R'+radius:(mode==='flat'?'Flat H0':mode==='walled'?'Walled terrace':'Sloped')+' · '+shape+(mode==='flat'?' · SUBTRACT':(delta<0?' · lower':' · raise')+' 1U')+' · R'+radius});
    },
    terraformShape:value=>{
      const shape=value==='square'?'square':'round';presets.terraformShape=shape;
      if(State.tool.kind==='terraform'){State.tool.shape=shape;changed('Terraforming shape: '+shape)}
    },
    terraformDelta:value=>{
      const delta=Number(value)<0?-1:1;presets.terraformDelta=delta;
      if(State.tool.kind==='terraform'){State.tool.delta=delta;changed((delta<0?'Dig':'Raise')+' 1U')}
    },
    terraformRadius:value=>{
      const radius=Number(value)||4;presets.terraformRadius=radius;
      if(State.tool.kind==='terraform'){State.tool.radius=radius;changed('Terraforming radius: '+radius+'U')}
    },
    crossing:variant=>choose({kind:'crossing',crossing:variant,width:presets.crossingWidth,label:(['dry','water'].includes(variant)?'Moat':'Bridge')+' '+variant+' · 2 clicks · '+(variant==='water'?'H0 only':'level banks')}),
    crossingWidth:value=>{
      const width=Number(value);presets.crossingWidth=width;
      if(State.tool.kind==='crossing'){State.tool.width=width;changed('Crossing width: '+width+'U')}
    },
    linear:kind=>{
      if(kind==='leanTo'){choose({kind:'leanTo',linear:'built',leanTo:true,leanMaterial:State.tool?.leanMaterial||'wood',level:1,label:'Lean-to W1 — click the inner side of an H2 wall'});return}
      const tier=State.buildLevels.wallTier,wood=kind==='longhouse'||kind==='longhouseWide',wide=kind==='builtWide'||kind==='longhouseWide';
      const linear=wide||wood?'built':kind,isPalisade=linear==='palisade',level=isPalisade||wood?1:wide?State.buildLevels.builtWide:State.buildLevels.wall;
      choose({kind:'linear',linear,...(wide?{span:'wide'}:{}),...(wood?{material:'wood'}:{}),level,tier,label:(linear==='wall'?`Wall T${tier}`:isPalisade?`Palisade T${tier}`:wood?(wide?'Wide longhouse 2U':'Longhouse 1U'):wide?'Wide hall 2U':'Built section')+(isPalisade?'':` L${level}`)+' — choose point A'});
    },
    towerLevel:value=>{
      State.buildLevels.tower=Number(value);
      if(State.tool.kind==='tower'&&State.tool.material!=='wood'){State.tool.level=State.buildLevels.tower;changed('Tower height: '+State.buildLevels.tower+' level'+(State.buildLevels.tower>1?'s':''))}
    },
    wallTier:value=>{
      State.buildLevels.wallTier=Number(value);
      if(State.tool.kind==='linear'&&['wall','palisade'].includes(State.tool.linear)){State.tool.tier=State.buildLevels.wallTier;changed((State.tool.linear==='palisade'?'Palisade':'Wall')+' tier: T'+State.buildLevels.wallTier+' · '+wallWidthForTier(State.buildLevels.wallTier)+'U')}
    },
    wallLevel:value=>{
      const wide=State.tool.kind==='linear'&&State.tool.span==='wide';
      State.buildLevels[wide?'builtWide':'wall']=Number(value);
      if(State.tool.kind==='linear'&&['wall','built'].includes(State.tool.linear)){State.tool.level=Number(value);changed((wide?'Wide hall':'Wall')+' height: '+State.tool.level+' level'+(State.tool.level>1?'s':''))}
    },
    gateLevel:value=>{
      if(State.tool.kind==='gate'&&State.tool.material==='wood'){status('Wood gate height is fixed at H1');draw();return}
      const small=State.tool.kind==='gate'&&State.tool.size<1.25;
      State.buildLevels.gate=Math.min(Number(value),small?SMALL_GATE_MAX_LEVEL:3);
      if(State.tool.kind==='gate'){
        State.tool.level=State.buildLevels.gate;
        const dummy={type:'gate',material:'stone',masonryMaterial:State.buildMasonryMaterial,size:State.tool.size,level:State.buildLevels.gate};
        changed('Gate height: L'+State.buildLevels.gate+' · '+buildDuration(dummy).toFixed(1)+'d');
      }
    },
    gate:(_,p)=>{
      const size=Number(p.gateSize)||GATE_SIZES.large,small=size<1.25;
      const level=Math.min(State.buildLevels.gate,small?SMALL_GATE_MAX_LEVEL:3),dummy={type:'gate',material:'stone',masonryMaterial:State.buildMasonryMaterial,size,level};
      State.buildLevels.gate=level;
      choose({kind:'gate',material:'stone',size,level,label:(small?'Small gate 1×1U · L':'Gate 1.5×1.5U · L')+level+' · '+buildDuration(dummy).toFixed(1)+'d · '+costText(constructionCost(dummy))});
    },
    woodGate:()=>{
      const dummy={type:'gate',material:'wood',w:1,h:1.5,level:1};
      choose({kind:'gate',material:'wood',level:1,label:'Wood gate 1.5×1U · H1 · door + battlements · '+buildDuration(dummy).toFixed(1)+'d · '+costText(constructionCost(dummy))});
    },
    civic:type=>{
      const spec={type,shape:'civic'};
      choose({kind:'civic',placementSpec:spec,label:structureLabel(spec)+' · '+BUILD_DAYS[type]+'d · '+costText(constructionCost({...spec,masonryMaterial:State.buildMasonryMaterial}))});
    },
    storageYard:()=>{
      if(!State.village.founded){status('Fonda prima un villaggio con un pozzo');return false}
      const candidate=window.ConquerStorageYard.make();
      choose({kind:'civic',placementSpec:candidate,label:'Piazzale magazzino · 2×2U · '+costText(constructionCost(candidate))});
    },
    industry:(type,p)=>{
      const extractionMode=p.extractionMode==='clay'?'clay':'stone';
      const candidate=window.ConquerIndustries.make(type,{x:0,y:0},extractionMode),spec=window.ConquerIndustries.definition(candidate);
      choose({kind:'industry',industry:type,placementSpec:candidate,label:spec.name+' · '+spec.w+'×'+spec.h+'U'+(spec.workers?' · L'+spec.tier+' ×'+spec.workers:'')+(window.ConquerIndustries.isMill({type})?' · Crop → Food':' · '+industryRatePerWorker(type)+' '+spec.good+'/worker/day')+' · '+costText(constructionCost({...candidate,masonryMaterial:State.buildMasonryMaterial}))});
    },
    eventVenue:venue=>{
      const E=window.ConquerEvents3D;if(!E)return false;
      const candidate=E.make(venue);
      choose({kind:'event',venue:candidate.venue,placementSpec:candidate,label:E.label(candidate)+' · '+(E.buildDays(candidate)?E.buildDays(candidate)+'d · ':'')+costText(E.cost(candidate))});
    },
    pier:(reach,p)=>{
      const P=window.ConquerPier;if(!P)return false;
      const spec=p.yard&&window.ConquerShipyard?window.ConquerShipyard.make(Number(p.yard)||1):P.make(Number(reach)||12);
      choose({kind:'pier',placementSpec:spec,label:P.label(spec)+' · '+P.buildDays(spec)+'d · '+costText(P.cost(spec))});
    },
    slopeway:value=>{
      const W=window.ConquerSlopeways;if(!W)return false;
      const type=value==='stairway'?'stairway':'ramp';
      choose({kind:'slopeway',slopeway:type,label:W.label(type)+' · 2 clic: pianoro basso e pianoro alto · '+costText(W.SPEC[type].costPerU)+'/U'});
    },
    quay:()=>{
      const Q=window.ConquerQuay;if(!Q)return false;
      choose({kind:'quay',label:Q.label()+' · 2 clic · lungo la riva o in acqua · '+costText(Q.SPEC.costPerU)+'/U'});
    },
    well:()=>choose({kind:'well',label:'Village well · instant · '+costText(constructionCost({type:'well',masonryMaterial:State.buildMasonryMaterial}))}),
    buildMasonry:next=>{
      if(!['stone','brick'].includes(next))return false;
      if(next===State.buildMasonryMaterial)return;
      State.buildMasonryMaterial=next;
      if(State.draft?.preview){State.draft.preview.masonryMaterial=next;delete State.draft.preview._ghostCheck}
      if(State.draft?.previewSegments)for(const s of State.draft.previewSegments){s.masonryMaterial=next;delete s._ghostCheck}
      scheduleLocalSave();draw();
      const preview=State.draft?.preview||State.draft?.previewSegments?.[0];
      status('Muratura nuovi cantieri: '+(next==='brick'?'MATTONI (argilla)':'PIETRA')+(preview?' · '+costText(State.draft?.previewSegments?aggregateConstructionCost(State.draft.previewSegments):constructionCost(preview)):''));
    },
    privateMasonry:next=>{
      if(!['stone','brick'].includes(next))return false;
      setPrivateMasonryMaterial(next);
    }
  };
  function execute(request){
    if(!request||typeof request!=='object')return false;
    const keys=Object.keys(handlers).filter(key=>Object.hasOwn(request,key));
    if(keys.length!==1)return false;
    const key=keys[0];
    if(handlers[key](request[key],request)===false)return false;
    for(const listener of listeners)listener(request);
    return true;
  }
  function options(){return{...presets,privateMasonry:State.village.privateMasonryMaterial||'stone'}}
  function subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener)}
  window.ConquerBuilderCommands=Object.freeze({execute,options,subscribe});
})();
