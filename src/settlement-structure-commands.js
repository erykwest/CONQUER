'use strict';
// Structure commands and the inspector descriptor, shared by the legacy function panel and UI v2.
// Each command acts on a structure id, applies the same rules the panel buttons always applied,
// then refreshes (dirty flags, panel, redraw). describeStructure() is language-neutral data.
const StructureCommands=(()=>{
  const find=id=>State.structures.find(s=>s.id===id)||null;
  const refresh=(target,hardNavigation=true)=>{markStructureDirty(target,hardNavigation);renderFunctionPanel();draw()};

  function setTier(id,requested){
    const target=find(id);if(!target)return false;
    if(target.type==='tower'){
      const parent=target.parentTowerId&&State.structures.find(s=>s.id===target.parentTowerId&&s.type==='tower');
      if(parent&&requested>=towerTier(parent)){status('Subtower must remain smaller than its parent tower');return false}
      if(subtowerChildren(target.id).some(child=>towerTier(child)>=requested)){status('Parent tower must remain larger than all attached subtorri');return false}
    }
    applyStructureTier(target,requested);
    target.tier=['wall','palisade'].includes(target.type)?wallTier(target):towerTier(target);
    target.buildCost=constructionCost(target);
    if(target.type==='tower'){repositionSubtower(target);syncSubtowerTree(target.id)}
    refresh(target);return true;
  }
  function setHeight(id,level){
    const target=find(id);if(!target)return false;
    if(target.isMastio&&!target.functions?.slice(0,level).includes('commonHall')){
      const prior=target.functions.indexOf('commonHall');if(prior>=0)target.functions[prior]=null;target.functions[0]='commonHall';
    }
    target.level=level;normalizeFunctions(target);target.buildCost=constructionCost(target);
    refresh(target,false);return true;
  }
  // steps: ±1 = 15°, 'flip' = 180°.
  function rotate(id,steps){
    const target=find(id);if(!target)return false;
    if(target.type==='tower')return steps==='flip'?turnTower(target,Math.PI,'Tower front flipped'):turnTower(target,STRUCTURE_ANGLE_STEP*steps,`Tower rotated ${steps<0?'−':'+'}15°`);
    if(target.type==='gate')return steps==='flip'?flipGate(target):turnGate(target,STRUCTURE_ANGLE_STEP*steps,`Gate rotated ${steps<0?'−':'+'}15°`);
    return rotatePointStructure(target,steps==='flip'?12:steps);
  }
  function setTowerBase(id,style){
    const target=find(id);
    if(!target||target.type!=='tower'||isWoodTower(target))return false;
    if(!setStructureVariant(target,'baseStyle',style))return false;
    // Base style can enlarge the ground-contact footprint: recompute the placement plane.
    const profile=placementFoundationProfile(target);
    if(profile){target.groundZ=profile.baseZ;target.foundationMinZ=profile.minZ;target.foundationVersion=1}
    target.wallColliderSyncSignature=null;
    invalidateCastleColliderGeometry(target);
    refresh(target);
    status('Tower base: '+(target.baseStyle==='buttress'?'buttressed':target.baseStyle==='splayed'?'splayed 10°':'standard'));
    return true;
  }
  function setTowerRoof(id,style){
    const target=find(id);if(!target||target.type!=='tower')return false;
    if(!setStructureVariant(target,'roofStyle',style))return false;
    refresh(target);status('Tower roof: '+(target.roofStyle==='pitched'?'pitched':target.roofStyle==='machicolation'?'machicolation':'battlement'));return true;
  }
  function setWoodRoof(id,style){
    const target=find(id);if(!isWoodTower(target)||woodTowerStyle(target)!=='palisadeTower')return false;
    target.woodRoof=style==='pitched'?'pitched':'open';
    refresh(target);status('Wood tower roof: '+target.woodRoof);return true;
  }
  function setGateRoof(id,style){
    const target=find(id);if(!target||target.type!=='gate')return false;
    if(!setStructureVariant(target,'roofStyle',style))return false;
    refresh(target);status('Gate roof: '+(target.roofStyle==='pitched'?'pitched':'battlement'));return true;
  }
  function setSkin(id,skin){
    const target=find(id);if(!target||!['wall','built'].includes(target.type))return false;
    if(target.type==='wall'&&skin==='machicolation'&&wallTier(target)===1){status('Machicolation requires a T2 or T3 wall');return false}
    if(!setStructureVariant(target,'skin',skin))return false;
    refresh(target);
    status(target.type==='built'?'Built wall skin: '+(target.skin==='arcade'?'porticato':'standard'):'Wall skin: '+target.skin);
    return true;
  }
  function toggleCutaway(id){
    const target=find(id);if(!cutawayEligible(target))return false;
    target.cutaway=!structureCutaway(target);
    refresh(target,false);
    status((target.type==='tower'?'Tower':'Built section')+' cutaway '+(target.cutaway?'enabled':'disabled'));
    return true;
  }
  function flipSide(id){
    const target=find(id);if(!target||!['wall','palisade','built'].includes(target.type))return false;
    target.flip=!target.flip;
    refresh(target);
    status((target.type==='wall'?'Wall':target.type==='palisade'?'Palisade':'Built section')+' exterior flipped');
    return true;
  }
  function setRoom(id,index,fn){
    const target=find(id);if(!target)return false;
    normalizeFunctions(target);fn=fn||null;
    if(target.isMastio&&target.functions[index]==='commonHall'&&fn!=='commonHall'&&!target.functions.some((f,j)=>j!==index&&f==='commonHall')){
      status('Mastio requires its Common Hall — reassign the Mastio first.');renderFunctionPanel();return false;
    }
    if(fn&&!window.ConquerSiege.allowed(target,index,fn)){status('Function not permitted at this floor/access');renderFunctionPanel();return false}
    target.functions[index]=fn;refresh(target);return true;
  }
  function changeHouseLevel(id,delta){
    const target=find(id);if(target?.type!=='house')return false;
    changeHouseDensity(target,clamp(houseLevel(target)+delta,1,4));return true;
  }
  function toggleMastio(id){window.ConquerSiege?.assignMastio(id);return true}
  function changeArchers(id,delta){
    const target=find(id);if(target?.type!=='tower')return false;
    window.ConquerSiege?.changeArchers(target.id,delta);return true;
  }

  // ---------- inspector descriptor ----------
  const choice=(key,cmd,options,current,extra={})=>({key,cmd,options:options.map(o=>({...o,active:o.value===current})),...extra});
  function describeStructure(id){
    const s=find(id);if(!s)return null;
    const industry=window.ConquerIndustries?.is(s);
    const d={id:s.id,type:s.type,label:structureLabel(s),shape:s.shape||null,
      woodStyle:s.type==='tower'&&isWoodTower(s)?woodTowerStyle(s):null,wood:isWoodTower(s)||isWoodGate(s),
      houseLevel:s.type==='house'?houseLevel(s):null,mastioActive:!!s.isMastio,
      building:null,facts:[],controls:[],rooms:null,
      mastio:null,archers:null,integrity:null,legacy:null,industry:null};
    if(underConstruction(s))d.building={progress:constructionProgress(s),days:remainingDays(s)};
    const cost=s.buildCost||constructionCost(s);
    d.cost=cost;
    if(industry){
      const spec=window.ConquerIndustries.TYPES[s.type],econ=window.ConquerEconomy;
      const details=econ?.state()?.activities?.[s.id];
      d.industry={workers:econ?.staffing?.()[s.id]||0,max:spec.workers,tier:spec.tier,good:spec.good,
        owner:(details?.owner||(s.economicOwner==='lord'?'lord':'private'))};
      d.controls.push({key:'rotation',cmd:'rotate',rotate:true,angle:Math.round((Number(s.angle)||0)*180/Math.PI+360)%360});
      return d;
    }
    if(['moat','bridge'].includes(s.type)){
      d.facts.push({key:'variant',value:s.variant},{key:'length',value:(s.length||0).toFixed(1)+'U'});
      d.legacy='crossing';return d;
    }
    const simpleCivic=isCivic(s),house=s.type==='house';
    if(!house&&!simpleCivic)normalizeFunctions(s);
    const building=!!d.building,woodTower=isWoodTower(s),woodGate=isWoodGate(s);
    if(house){
      const pop=housePopulationCapacity(s),level=houseLevel(s);
      d.facts.push({key:'household',value:pop.total},{key:'residents',value:pop.male+' · '+pop.female+' · '+pop.children});
      d.house={level,canDown:level>1,canUp:level<4};
    }
    if(['house','market','tavern','church','training'].includes(s.type))
      d.controls.push({key:'rotation',cmd:'rotate',rotate:true,angle:Math.round((Number(s.angle)||0)*180/Math.PI+360)%360});
    if(s.type==='tower'){
      d.mastio={active:!!s.isMastio,disabled:building};
      const slots=window.ConquerSiege?.archerSlots(s)||[],count=window.ConquerSiege?.stationedArchers(s)||0;
      const roof=slots.filter(x=>x.kind==='roof').length;
      d.archers={count,max:slots.length,roof,slits:slots.length-roof,disabled:building};
    }
    if(['tower','wall','palisade'].includes(s.type)&&!woodTower){
      const linear=['wall','palisade'].includes(s.type),current=linear?wallTier(s):towerTier(s);
      const labels=linear?['T1 · 0,2U','T2 · 0,5U','T3 · 1U']:(s.shape==='round'?['T1 · R0,5','T2 · R0,75','T3 · R1']:['T1 · 1U','T2 · 1,5U','T3 · 2U']);
      d.controls.push(choice('tier','setTier',labels.map((label,i)=>({value:i+1,label})),current));
    }
    if(['tower','gate','wall','built'].includes(s.type)&&!woodTower&&!woodGate){
      const max=['tower','gate'].includes(s.type)?3:2;
      d.controls.push(choice('height','setHeight',Array.from({length:max},(_,i)=>({value:i+1,label:String(i+1)})),structureLevel(s)));
    }
    if(s.type==='tower'||s.type==='gate')
      d.controls.push({key:'rotation',cmd:'rotate',rotate:true,angle:Math.round(normalizeTowerAngle(s.angle)*180/Math.PI)%360});
    if(s.type==='tower'){
      if(woodTower){
        if(woodTowerStyle(s)==='palisadeTower')d.controls.push(choice('woodRoof','setWoodRoof',[{value:'open',word:'open'},{value:'pitched',word:'pitched4'}],woodTowerRoof(s)));
      }else{
        d.controls.push(choice('roof','setTowerRoof',[{value:'battlement',word:'battlement'},{value:'machicolation',word:'machicolation'},{value:'pitched',word:'pitched'}],towerRoofStyle(s)));
        d.controls.push(choice('base','setTowerBase',[{value:'standard',word:'standard'},{value:'buttress',word:'buttress'},{value:'splayed',word:'splayed'}],towerBaseStyle(s)));
        if(s.parentTowerId)d.facts.push({key:'subtower',value:structureLabel(State.structures.find(x=>x.id===s.parentTowerId)||s)});
      }
    }
    if(s.type==='gate'&&!woodGate)d.controls.push(choice('roof','setGateRoof',[{value:'battlement',word:'battlement'},{value:'pitched',word:'pitched'}],gateRoofStyle(s)));
    if(s.type==='built')d.controls.push(choice('skin','setSkin',[{value:'standard',word:'standard'},{value:'arcade',word:'arcade'}],builtSkin(s)));
    if(s.type==='wall'){
      const narrow=wallTier(s)===1;
      d.controls.push(choice('skin','setSkin',[{value:'standard',word:'standard'},{value:'machicolation',word:'machicolation',disabled:narrow},{value:'hoarding',word:'hoarding'}],wallSkin(s)));
    }
    if(['wall','palisade','built'].includes(s.type))d.controls.push({key:'side',cmd:'flipSide',toggle:true});
    if(cutawayEligible(s))d.controls.push({key:'cutaway',cmd:'toggleCutaway',toggle:true,active:structureCutaway(s),disabled:building});
    if(!house&&!simpleCivic){
      const cap=functionCapacity(s);
      d.facts.push({key:'rooms',value:cap+' · '+functionCapacityUnits(s)});
      d.rooms={pending:building,slots:building?[]:Array.from({length:cap},(_,n)=>['tower','built'].includes(s.type)?cap-1-n:n).map(i=>({
        index:i,size:functionSlotSize(s,i),units:functionSlotUnits(s,i),value:s.functions[i]||'',
        options:FUNCTION_CATALOG.map(k=>({value:k,allowed:!!window.ConquerSiege?.allowed(s,i,k)}))}))};
    }
    if(['tower','gate','built'].includes(s.type)){
      const hp=window.ConquerSiege?.integrity(s);
      if(hp)d.integrity={core:Math.ceil(hp.core.hp),coreMax:hp.core.max,door:hp.door?Math.ceil(hp.door.hp):null,doorMax:hp.door?.max??null};
    }
    return d;
  }

  return{setTier,setHeight,rotate,setTowerBase,setTowerRoof,setWoodRoof,setGateRoof,setSkin,toggleCutaway,flipSide,
    setRoom,changeHouseLevel,toggleMastio,changeArchers,describeStructure};
})();
