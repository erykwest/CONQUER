'use strict';
// Structure commands and the inspector descriptor, shared by the legacy function panel and UI v2.
// Each command acts on a structure id, applies the same rules the panel buttons always applied,
// then refreshes (dirty flags, panel, redraw). describeStructure() is language-neutral data.
const StructureCommands=(()=>{
  const find=id=>State.structures.find(s=>s.id===id)||null;
  const refresh=(target,hardNavigation=true)=>{markStructureDirty(target,hardNavigation);renderFunctionPanel();draw()};

  function setConstructionPriority(id,level){
    const target=find(id),c=target?.construction;
    const requested=Number(level);
    if(!target||target.auto&&!c?.upgrade||!underConstruction(target)||c?.version!==2||
      !Number.isInteger(requested)||requested<0||requested>=CONSTRUCTION_PRIORITIES.length)return false;
    if(constructionPriority(target)===requested)return true;
    c.priority=requested;
    markDirty(false,false);
    renderFunctionPanel();draw();
    status('Priorità cantiere: '+CONSTRUCTION_PRIORITIES[requested]);
    return true;
  }
  function setTier(id,requested){
    const target=find(id);if(!target)return false;
    if(target.type==='tower'){
      const parent=target.parentTowerId&&State.structures.find(s=>s.id===target.parentTowerId&&s.type==='tower');
      if(parent&&requested>=towerTier(parent)){status('Subtower must remain smaller than its parent tower');return false}
      if(subtowerChildren(target.id).some(child=>towerTier(child)>=requested)){status('Parent tower must remain larger than all attached subtorri');return false}
      if(requested===KEEP_W4_TIER&&(isWoodTower(target)||(target.shape||'square')!=='square'||target.parentTowerId)){status('W4 is a square stone keep');return false}
      if(requested===KEEP_W4_TIER&&!keepW4Available(target)){status('Only one W4 keep per settlement');return false}
    }
    const byFloor=target.type==='tower'?functionsByFloor(target):null;
    applyStructureTier(target,requested);
    if(byFloor)restoreFunctionsByFloor(target,byFloor);
    target.tier=['wall','palisade'].includes(target.type)?wallTier(target):towerTier(target);
    target.buildCost=constructionCost(target);
    if(target.type==='tower'){repositionSubtower(target);syncSubtowerTree(target.id)}
    refresh(target);return true;
  }
  function setHeight(id,level){
    const target=find(id);if(!target)return false;
    if(isKeepW4(target)){
      // Rooms stay on their floor; the Common Hall comes down to the ground floor if its floor goes.
      const byFloor=functionsByFloor(target),lost=byFloor.slice(level).flat();
      target.level=clamp(level,1,maxStructureLevel(target));
      if(target.isMastio&&lost.includes('commonHall')&&!byFloor.slice(0,level).flat().includes('commonHall'))byFloor[0][0]='commonHall';
      restoreFunctionsByFloor(target,byFloor);target.buildCost=constructionCost(target);
      refresh(target,false);return true;
    }
    if(target.isMastio&&!target.functions?.slice(0,level).includes('commonHall')){
      const prior=target.functions.indexOf('commonHall');if(prior>=0)target.functions[prior]=null;target.functions[0]='commonHall';
    }
    target.level=clamp(level,1,maxStructureLevel(target));normalizeFunctions(target);target.buildCost=constructionCost(target);
    refresh(target,false);return true;
  }
  // W4 keep: the room layout of one floor (KEEP_FLOOR_PLANS); the roles of that floor are kept
  // in order as far as the new rooms allow, and the Mastio keeps its Common Hall.
  function setKeepFloorPlan(id,floor,plan){
    const target=find(id);if(!isKeepW4(target)||!KEEP_FLOOR_PLANS[plan]||floor<0||floor>=structureLevel(target))return false;
    const byFloor=functionsByFloor(target),had=(byFloor[floor]||[]).includes('commonHall');
    target.keepPlans[floor]=plan;
    const n=KEEP_FLOOR_PLANS[plan].length,list=(byFloor[floor]||[]).filter(Boolean);
    if(had&&!list.slice(0,n).includes('commonHall'))list.splice(n-1,0,'commonHall');
    byFloor[floor]=list.slice(0,n);
    restoreFunctionsByFloor(target,byFloor);
    window.ConquerSiege?.sanitizeRooms?.(target);
    refresh(target,false);status('Piano '+(floor===0?'terra':floor)+': '+n+(n===1?' sala':' stanze'));return true;
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
  // The hoarding of a tower or stone gate is mounted or taken down; the roof stays as built.
  function setHoarding(id,value){
    const target=find(id);if(!target||!['tower','gate'].includes(target.type))return false;
    if(value==='on'&&!hoardingAllowed(target)){status('Hoarding needs a crenellated or pitched stone '+target.type);return false}
    if(!setStructureVariant(target,'hoarding',value==='on'?'on':'off'))return false;
    refresh(target);status((target.type==='gate'?'Gate':'Tower')+' hoarding: '+(target.hoarding==='on'?'mounted':'taken down'));return true;
  }
  const hoardingChoice=s=>choice('hoarding','setHoarding',[{value:'off',word:'hoardingOff'},{value:'on',word:'hoardingOn',disabled:!hoardingAllowed(s)}],hoardingMounted(s)?'on':'off');
  function setWoodRoof(id,style){
    const target=find(id);if(!isWoodTower(target)||woodTowerStyle(target)!=='palisadeTower')return false;
    target.woodRoof=style==='pitched'?'pitched':'open';
    refresh(target);status('Wood tower roof: '+target.woodRoof);return true;
  }
  // Longhouse roof cover: shingles, thatch or turf (BC-251105-09); a recover, not a rebuild.
  function setLonghouseCover(id,cover){
    const target=find(id);if(!isLonghouse(target)||!LONGHOUSE_COVERS.includes(cover))return false;
    if(cover==='shingle')delete target.roofCover;else target.roofCover=cover;
    refresh(target);status('Longhouse roof: '+cover);return true;
  }
  function setGateRoof(id,style){
    const target=find(id);if(!target||target.type!=='gate')return false;
    if(!setStructureVariant(target,'roofStyle',style))return false;
    refresh(target);status('Gate roof: '+(target.roofStyle==='pitched'?'pitched':'battlement'));return true;
  }
  function setGateUpper(id,upper){
    const target=find(id);if(!isSmallGate(target)||structureLevel(target)!==2)return false;
    if(!setStructureVariant(target,'upper',upper))return false;
    target.buildCost=constructionCost(target);
    refresh(target);status('Gate upper storey: '+(target.upper==='timber'?'timber frame':'masonry'));return true;
  }
  function setSkin(id,skin){
    const target=find(id);if(!target||!['wall','built'].includes(target.type))return false;
    if(target.type==='wall'&&skin==='machicolation'&&wallTier(target)===1){status('Machicolation requires a T2 or T3 wall');return false}
    if(!setStructureVariant(target,'skin',skin))return false;
    refresh(target);
    status(target.type==='built'?'Built wall skin: '+(target.skin==='arcade'?'porticato':'standard'):'Wall skin: '+target.skin);
    return true;
  }
  // Wall-walk stair (BC-251105-01/02, settlement-wall-stairs.js): none / timber / masonry, and where.
  function setWallStair(id,kind){const target=find(id),S=window.ConquerWallStairs;return !!target&&!!S&&S.setKind(target,kind)}
  function setWallStairPos(id,pos){const target=find(id),S=window.ConquerWallStairs;return !!target&&!!S&&S.setPos(target,pos)}
  function toggleCutaway(id){
    const target=find(id);if(!cutawayEligible(target))return false;
    target.cutaway=!structureCutaway(target);
    refresh(target,false);
    status((target.type==='tower'?'Tower':target.type==='gate'?'Gatehouse':'Built section')+' cutaway '+(target.cutaway?'enabled':'disabled'));
    return true;
  }
  // Floor-by-floor cutaway: one floor up (+1) or down (-1); the floors above the one in view go.
  function stepCutawayFloor(id,delta){
    const target=find(id);if(!target)return false;
    const n=cutawayFloorCount(target),now=cutawayVisibleFloor(target),next=clamp(now+Math.sign(Number(delta)||0),0,n-1);
    if(n<2||next===now)return false;
    target.cutawayFloor=next;
    refresh(target,false);
    status('Cutaway: floor '+(next+1)+' / '+n);
    return true;
  }
  function flipSide(id){
    const target=find(id);if(!target||!['wall','palisade','built'].includes(target.type))return false;
    if(window.ConquerQuay?.isQuayWall(target)){status('A wall on a quay always faces out to the water');return false}
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
  function setTowerWeapon(id,weapon){
    const target=find(id);if(!target||target.type!=='tower')return false;
    if(!setStructureVariant(target,'topWeapon',weapon))return false;
    refresh(target);
    status('Tower weapon: '+({none:'none',mangonel:'mangonel',ballista:'ballista'}[target.topWeapon])+(towerTopWeaponAllowed(target)?'':' (needs a T2 tower without a pitched roof)'));
    return true;
  }
  // Cosmetic only: the roof shape changes neither cost nor rooms.
  function setTowerRoofShape(id,shape){
    const target=find(id);if(!target||target.type!=='tower'||(target.shape||'square')!=='square')return false;
    if(!setStructureVariant(target,'roofShape',shape))return false;
    refresh(target,false);
    status('Tower roof shape: '+({pyramid:'pyramid',gable:'two slopes',hip:'four slopes with ridge'}[target.roofShape])+(towerRoofStyle(target)==='pitched'?'':' (shown with a pitched roof)'));
    return true;
  }
  function setTowerBartizan(id,style){
    const target=find(id);if(!target||target.type!=='tower')return false;
    if(!setStructureVariant(target,'bartizan',style))return false;
    window.ConquerCombat?.invalidateArchers?.();
    refresh(target);
    status('Bartizans: '+({none:'none',battlement:'crenellated',pitched:'spire'}[target.bartizan])+(towerBartizanAllowed(target)?'':' (needs a large T3 square or round stone tower)'));
    return true;
  }
  // Inner roof inside the merlons (BC-251105-05): cosmetic cover of the deck, no room under it.
  function setTowerInnerRoof(id,value){
    const target=find(id);if(!target||target.type!=='tower')return false;
    if(value==='on'&&!towerInnerRoofAllowed(target)){status('Inner roof: needs a T2+ stone tower with a crenellated or machicolated top and no weapon or signal pyre on the deck');return false}
    if(!setStructureVariant(target,'innerRoof',value==='on'?'on':'off'))return false;
    refresh(target,false);
    status(target.innerRoof==='on'?'Inner roof built inside the merlons':'Inner roof removed');
    return true;
  }
  // Alarm bell on the roof apex of a T1-T2 tower with a pitched roof (settlement-alarm-bells.js).
  function setTowerBell(id,value){
    const target=find(id),bells=window.ConquerAlarmBells;if(!target||target.type!=='tower'||!bells)return false;
    if(value==='bell'&&!bells.towerBellAllowed(target)){status('Alarm bell: needs a T1-T2 tower with a pitched roof and no dovecote or mews under it');return false}
    if(!setStructureVariant(target,'bell',value))return false;
    refresh(target,false);
    status(value==='bell'?'Alarm bell: heard '+bells.hearingRadius(target)+'U around the tower':'Alarm bell removed');
    return true;
  }
  // Lookout, outpost and signal fire (settlement-soldiers.js, MIL-RES-01).
  function setTowerLookout(id,value){
    const target=find(id),M=window.ConquerSoldiers;if(target?.type!=='tower'||!M)return false;
    const ok=M.setLookout(id,value==='on');if(ok)refresh(target,false);return ok;
  }
  function setTowerOutpost(id,value){
    const target=find(id),M=window.ConquerSoldiers;if(target?.type!=='tower'||!M)return false;
    if(value==='none'&&target.outpost&&typeof confirm==='function'&&!confirm('Smobilitare l\'avamposto? Il costo non viene restituito.'))return false;
    const ok=M.setOutpost(id,value==='outpost');if(ok)refresh(target,false);return ok;
  }
  function setTowerSignalFire(id,value){
    const target=find(id),M=window.ConquerSoldiers;if(target?.type!=='tower'||!M)return false;
    const ok=M.setSignalFire(id,value);if(ok)refresh(target,false);return ok;
  }
  function setCivicLevel(id,level){
    const target=find(id);if(!target||!CIVIC_LEVEL_TYPES.includes(target.type))return false;
    if(civicAnnexChildren(target.id).some(child=>civicAnnexDefinition(child,target)?.level>level)){
      status('Remove annexes requiring a higher level before downgrading');return false;
    }
    target.civicLevel=level;normalizeCivicDevelopment(target);
    if(target.type==='townhall')normalizeFunctions(target);
    refresh(target);status(structureLabel(target)+' · skeleton stage only');return true;
  }
  function setPlazaVariant(id,variant){
    const target=find(id);if(!isPlazaLike(target))return false;
    target.plazaVariant=variant;normalizeCivicDevelopment(target);
    refresh(target);return true;
  }
  function setGateClosed(id,closed){
    const target=find(id);if(target?.type!=='gate'||!window.ConquerSiege?.setGateClosed)return false;
    window.ConquerSiege.setGateClosed(id,!!closed);renderFunctionPanel();return true;
  }
  function setGateNightClose(id,on){
    const target=find(id);if(target?.type!=='gate')return false;
    target.nightClose=!!on;markDirty(false,false,true);renderFunctionPanel();return true;
  }
  function toggleMastio(id){window.ConquerSiege?.assignMastio(id);return true}
  // Raised Mastio entrance (src/settlement-keep-entrance.js): wood → stone stair, drawbridge on either.
  function setKeepStair(id,stair){
    const target=find(id),K=window.ConquerKeepEntrance;if(target?.type!=='tower'||!K)return false;
    if(stair==='none')return K.removeEntrance(target);
    const current=target.keepEntrance?.stair;
    if(!current||current==='burnt')return stair==='wood'?K.buildStair(target):false;
    return current==='wood'&&stair==='stone'?K.upgradeStone(target):false;
  }
  function keepDrawbridge(id,action){
    const target=find(id),K=window.ConquerKeepEntrance;if(target?.type!=='tower'||!K)return false;
    if(action==='install')return K.installDrawbridge(target);
    if(action==='remove')return K.removeDrawbridge(target);
    if(action==='auto-on'||action==='auto-off')return K.setAuto(target,action==='auto-on');
    if(action==='ladder-down'||action==='ladder-up')return K.setLadder(target,action==='ladder-down');
    return K.toggleDrawbridge(target);
  }
  // Village centre: one well at a time. Picking the current centre again returns the role
  // to the founding well (the default), like removing a Mastio designation.
  function toggleVillageCenter(id){
    const target=find(id);if(target?.type!=='well'||!State.village.founded||underConstruction(target))return false;
    const founding=State.village.wellId;
    if(isVillageCenterWell(target)){
      if(target.id===founding){status('The founding well is already the village centre');return false}
      delete State.village.centerWellId;status('Village centre returned to the founding well');
    }else{
      if(target.id===founding)delete State.village.centerWellId;else State.village.centerWellId=target.id;
      status('Village centre designated'+(target.wellName?' · '+target.wellName:''));
    }
    markDirty(false,['ground'],true);renderFunctionPanel();draw();return true;
  }
  function setWellName(id,name){
    const target=find(id);if(target?.type!=='well')return false;
    const clean=sanitizeWellName(name);
    if(clean)target.wellName=clean;else delete target.wellName;
    markDirty(false,['ground'],true);renderFunctionPanel();draw();return true;
  }
  function changeArchers(id,delta){
    const target=find(id);if(target?.type!=='tower')return false;
    window.ConquerSiege?.changeArchers(target.id,delta);return true;
  }

  function setYardSize(id,targetSize){
    const target=find(id),Y=window.ConquerStorageYard;
    if(!Y?.is(target))return false;
    const result=Y.grow(target,Number(targetSize));
    if(!result.ok){status('Piazzale: '+result.reason);return false}
    renderFunctionPanel();draw();
    status('Piazzale ampliato a '+result.size+'×'+result.size+'U · '+costText(result.cost));
    return true;
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
      mastio:null,keepEntrance:null,archers:null,integrity:null,legacy:null,industry:null};
    if(underConstruction(s)){
      const material=constructionMaterialInfo(s);
      d.building={progress:constructionProgress(s),days:remainingDays(s),
        priority:constructionPriority(s),priorities:CONSTRUCTION_PRIORITIES,
        materialsProgress:material.progress,materials:material.rows,
        status:constructionWorkStatus(s),editable:s.construction?.version===2&&(!s.auto||!!s.construction.upgrade)};
    }
    const cost=s.buildCost||constructionCost(s);
    d.cost=d.building?constructionMaterialInfo(s).required:cost;
    // Construction uses a temporary inspector. No completed-building commands
    // or room assignment are exposed before the project is finished.
    if(d.building)return d;
    if(window.ConquerStorageYard?.is(s)){
      const Y=window.ConquerStorageYard,stock=Y.stocks(),n=Y.size(s);
      d.facts.push({key:'size',value:n+'×'+n+'U'},
        {key:'storageCapacity',value:Y.capacity()+' unità'},
        {key:'storedGoods',value:Y.used()+' unità'},
        ...Object.entries(stock).filter(([,v])=>v>0).map(([key,value])=>({key,value})));
      if(n<6)d.controls.push(choice('yardSize','setYardSize',[2,4,6].filter(v=>v>=n).map(v=>({
        value:v,label:v+'×'+v+'U'})),n));
      return d;
    }
    if(industry){
      const spec=window.ConquerIndustries.definition?.(s)||window.ConquerIndustries.TYPES[s.type],econ=window.ConquerEconomy;
      const details=econ?.state()?.activities?.[s.id];
      d.industry={workers:econ?.staffing?.()[s.id]||0,max:spec.workers,tier:spec.tier,good:spec.good,
        owner:(details?.owner||(s.economicOwner==='lord'?'lord':'private'))};
      d.controls.push({key:'rotation',cmd:'rotate',rotate:true,angle:Math.round((Number(s.angle)||0)*180/Math.PI+360)%360});
      return d;
    }
    if(typeof isCivicAnnex==='function'&&isCivicAnnex(s)){
      const parent=State.structures.find(p=>p.id===s.parentId),spec=civicAnnexDefinition(s,parent);
      d.annex={label:spec?.label||null,parentId:parent?.id||null,size:spec?spec.w+'×'+spec.h+'U':null};
      return d;
    }
    if(s.type==='well'){
      const founding=s.id===State.village.wellId,center=isVillageCenterWell(s);
      d.well={founding,center,founded:!!State.village.founded,name:s.wellName||'',villageName:State.village.name||'',
        canCenter:!!State.village.founded&&!(center&&founding),mainRoad:founding||wellMainRoads(s).length>0};
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
    const masonry=typeof masonryMaterial==='function'?masonryMaterial(s):null;
    if(masonry)d.facts.push({key:'masonry',value:masonry});
    if(typeof isWellCivic==='function'&&isWellCivic(s)){
      const well=wellCivicWell(s);
      d.facts.push({key:'square',value:well?wellDisplayName(well)||'—':'—',center:!!well&&isVillageCenterWell(well)});
    }
    if(['house','market','tavern','church','training','plaza','townhall','guild','bargello','balivo'].includes(s.type))
      d.controls.push({key:'rotation',cmd:'rotate',rotate:true,angle:Math.round((Number(s.angle)||0)*180/Math.PI+360)%360});
    if(s.type==='tower'){
      d.mastio={active:!!s.isMastio,disabled:building};
      const slots=window.ConquerSiege?.archerSlots(s)||[],count=window.ConquerSiege?.stationedArchers(s)||0;
      const roof=slots.filter(x=>x.kind==='roof').length,bartizan=slots.filter(x=>x.kind==='bartizan').length;
      d.archers={count,max:slots.length,roof,bartizan,slits:slots.length-roof-bartizan,disabled:building};
      const keep=window.ConquerKeepEntrance?.describe?.(s);
      if(keep&&(keep.stair||keep.mastio))d.keepEntrance=keep;
    }
    if(['tower','wall','palisade'].includes(s.type)&&!woodTower){
      const linear=['wall','palisade'].includes(s.type),current=linear?wallTier(s):towerTier(s);
      const labels=linear?['T1 · 0,2U','T2 · 0,5U','T3 · 1U']:(s.shape==='round'?['T1 · R0,5','T2 · R0,75','T3 · R1']:['T1 · 1U','T2 · 1,5U','T3 · 2U','W4 · 3U']);
      const opts=isOrientedTower(s)?orientedTowerTierOptions(s.shape):labels.map((label,i)=>({value:i+1,label,disabled:i+1===KEEP_W4_TIER&&(!keepW4Available(s)||!!s.parentTowerId)}));
      d.controls.push(choice('tier','setTier',opts,current));
    }
    // W4 keep: room layout of each floor, ground floor first.
    if(isKeepW4(s))d.keepPlans={floors:Array.from({length:structureLevel(s)},(_,f)=>({floor:f,plan:keepFloorPlan(s,f),rooms:keepFloorRooms(s,f).length})),
      plans:Object.keys(KEEP_FLOOR_PLANS).map(k=>({value:k,rooms:KEEP_FLOOR_PLANS[k].length}))};
    if(['tower','gate','wall','built'].includes(s.type)&&!woodTower&&!woodGate){
      const max=maxStructureLevel(s);
      d.controls.push(choice('height','setHeight',Array.from({length:max},(_,i)=>({value:i+1,label:String(i+1)})),structureLevel(s)));
    }
    if(s.type==='tower'||s.type==='gate')
      d.controls.push({key:'rotation',cmd:'rotate',rotate:true,angle:Math.round(normalizeTowerAngle(s.angle)*180/Math.PI)%360});
    if(s.type==='tower'){
      const bells=window.ConquerAlarmBells;
      if(bells&&s.shape!=='half'&&towerTier(s)<=2){
        const off=!bells.towerBellAllowed(s);
        d.controls.push(choice('bell','setTowerBell',[{value:'none',word:'none'},{value:'bell',word:'bell',disabled:off}],structureVariant(s,'bell')));
        if(bells.towerBell(s))d.facts.push({key:'bellRange',value:bells.hearingRadius(s)+'U'});
      }
      const M=window.ConquerSoldiers;
      if(M){
        if(!s.outpost)d.controls.push(choice('lookout','setTowerLookout',[{value:'none',word:'lookoutOff'},{value:'on',word:'lookoutOn',disabled:building}],s.lookout?'on':'none'));
        const why=M.outpostBlocker(s);
        d.controls.push(choice('outpost','setTowerOutpost',[{value:'none',word:'none'},{value:'outpost',word:'outpost',disabled:!s.outpost&&!!why}],s.outpost?'outpost':'none'));
        if(!woodTower&&(M.signalFireAllowed(s)||M.signalFire(s)))
          d.controls.push(choice('signalFire','setTowerSignalFire',[{value:'none',word:'none'},{value:'pyre',word:M.signalFire(s)&&s.signalFireSpent?'pyreRebuild':'pyre'}],
            M.signalFire(s)&&!s.signalFireSpent?'pyre':'none'));
        d.facts.push(...M.towerFacts(s));
      }
      if(woodTower){
        if(woodTowerStyle(s)==='palisadeTower')d.controls.push(choice('woodRoof','setWoodRoof',[{value:'open',word:'open'},{value:'pitched',word:'pitched4'}],woodTowerRoof(s)));
      }else{
        d.controls.push(choice('roof','setTowerRoof',[{value:'battlement',word:'battlement'},{value:'machicolation',word:'machicolation'},{value:'pitched',word:'pitched'}],towerRoofStyle(s)));
        if(s.shape!=='half')d.controls.push(hoardingChoice(s));
        if(s.shape!=='half')d.controls.push(choice('innerRoof','setTowerInnerRoof',[{value:'off',word:'innerRoofOff'},{value:'on',word:'innerRoofOn',disabled:!towerInnerRoofAllowed(s)}],towerInnerRoofMounted(s)?'on':'off'));
        d.controls.push(choice('weapon','setTowerWeapon',[{value:'none',word:'none'},{value:'mangonel',word:'mangonel',disabled:!towerTopWeaponAllowed(s)},{value:'ballista',word:'ballista',disabled:!towerTopWeaponAllowed(s)}],structureVariant(s,'topWeapon')));
        if((s.shape||'square')==='square'&&variantSchema(s)?.roofShape){
          const flat=towerRoofStyle(s)!=='pitched';
          d.controls.push(choice('roofShape','setTowerRoofShape',[{value:'pyramid',word:'pyramid',disabled:flat},{value:'gable',word:'gable',disabled:flat},{value:'hip',word:'hip',disabled:flat}],structureVariant(s,'roofShape')));
        }
        if(variantSchema(s)?.bartizan){
          const off=!towerBartizanAllowed(s);
          d.controls.push(choice('bartizan','setTowerBartizan',[{value:'none',word:'none'},{value:'battlement',word:'battlement',disabled:off},{value:'pitched',word:'spire',disabled:off}],structureVariant(s,'bartizan')));
        }
        d.controls.push(choice('base','setTowerBase',[{value:'standard',word:'standard'},{value:'buttress',word:'buttress'},{value:'splayed',word:'splayed'}],towerBaseStyle(s)));
        if(s.parentTowerId)d.facts.push({key:'subtower',value:structureLabel(State.structures.find(x=>x.id===s.parentTowerId)||s)});
      }
    }
    if(s.type==='gate'&&!woodGate){
      // Small L2 gate: masonry or timber-framed upper storey (the frame always carries the roof).
      const timber=gateTimberUpper(s);
      if(isSmallGate(s)&&structureLevel(s)===2)d.controls.push(choice('upper','setGateUpper',[{value:'stone',word:'masonry'},{value:'timber',word:'timber'}],timber?'timber':'stone'));
      d.controls.push(choice('roof','setGateRoof',[{value:'battlement',word:'battlement',disabled:timber},{value:'pitched',word:'pitched'}],gateRoofStyle(s)));
      d.controls.push(hoardingChoice(s));
    }
    if(typeof CIVIC_LEVEL_TYPES!=='undefined'&&CIVIC_LEVEL_TYPES.includes(s.type))
      d.controls.push(choice('civicLevel','setCivicLevel',civicLevels(s.type).map(n=>({value:n,label:'L'+n})),civicLevel(s)));
    if((s.type==='church'||s.type==='townhall')&&window.ConquerAlarmBells)
      d.facts.push({key:'bellRange',value:window.ConquerAlarmBells.hearingRadius(s)+'U'});
    if(typeof isPlazaLike==='function'&&isPlazaLike(s))
      d.controls.push(choice('plaza','setPlazaVariant',PLAZA_VARIANTS.map(v=>({value:v,word:v})),plazaVariant(s)));
    if(s.type==='gate'&&!building&&window.ConquerSiege?.doorStage){
      const stage=window.ConquerSiege.doorStage(s),closed=!!s.closed&&stage!=='broken';
      d.gate={stage,closed,broken:stage==='broken',nightClose:s.nightClose!==false};
    }
    if(isLonghouse(s))d.controls.push(choice('roofCover','setLonghouseCover',LONGHOUSE_COVERS.map(v=>({value:v,word:'cover_'+v})),longhouseCover(s)));
    if(s.type==='built'&&!isLonghouse(s))d.controls.push(choice('skin','setSkin',[{value:'standard',word:'standard'},{value:'arcade',word:'arcade'}],builtSkin(s)));
    if(s.type==='wall'){
      const narrow=wallTier(s)===1;
      d.controls.push(choice('skin','setSkin',[{value:'standard',word:'standard'},{value:'machicolation',word:'machicolation',disabled:narrow},{value:'hoarding',word:'hoarding'}],wallSkin(s)));
      const WS=window.ConquerWallStairs;
      if(WS&&!building){
        const ok=WS.eligible(s),cur=WS.stair(s)?.kind||'none';
        d.controls.push(choice('wallStair','setWallStair',[{value:'none',word:'none'},{value:'wood',word:'stairWood',disabled:!ok||cur==='stone'},{value:'stone',word:'stairStone',disabled:!ok}],cur));
        if(cur!=='none')d.controls.push(choice('wallStairPos','setWallStairPos',Object.keys(WS.POSITIONS).map(v=>({value:v,word:'stairPos_'+v})),s.wallStair.pos||'middle'));
      }
    }
    if(['wall','palisade','built'].includes(s.type))d.controls.push({key:'side',cmd:'flipSide',toggle:true});
    if(cutawayEligible(s))d.controls.push({key:'cutaway',cmd:'toggleCutaway',toggle:true,active:structureCutaway(s),disabled:building});
    // Floor in view of an open cutaway (castle toggle or selected civic building), stepped with ▲ ▼.
    if(!building&&(structureCutaway(s)||civicFloorCutaway(s))&&cutawayFloorCount(s)>1)
      d.cutawayFloor={index:cutawayVisibleFloor(s),count:cutawayFloorCount(s)};
    if(!house&&(!simpleCivic||s.type==='townhall')){
      if(simpleCivic)normalizeFunctions(s);
      const cap=functionCapacity(s);
      d.facts.push({key:'rooms',value:cap+' · '+functionCapacityUnits(s)});
      // One room per floor, the highest listed first (the town hall too: room i is floor i).
      d.rooms={pending:building,slots:building?[]:Array.from({length:cap},(_,n)=>['tower','built','townhall'].includes(s.type)?cap-1-n:n).map(i=>({
        index:i,floor:functionSlotFloor(s,i),room:isKeepW4(s)?functionSlotLayout(s)[i].room:0,size:functionSlotSize(s,i),units:functionSlotUnits(s,i),value:s.functions[i]||'',
        options:functionCatalog(s).map(k=>({value:k,allowed:!!window.ConquerSiege?.allowed(s,i,k)}))}))};
    }
    if(['tower','gate','built'].includes(s.type)){
      const hp=window.ConquerSiege?.integrity(s);
      if(hp)d.integrity={core:Math.ceil(hp.core.hp),coreMax:hp.core.max,door:hp.door?Math.ceil(hp.door.hp):null,doorMax:hp.door?.max??null,
        portcullis:hp.portcullis?Math.ceil(hp.portcullis.hp):null,portcullisMax:hp.portcullis?.max??null};
    }
    if(['wall','palisade'].includes(s.type)&&!building){
      const bays=window.ConquerSiege?.bays?.(s);
      if(bays)d.bays=bays.map(b=>({hp:Math.ceil(b.hp),max:Math.round(b.max)}));
    }
    return d;
  }

  const commands={setConstructionPriority,setTier,setHeight,setKeepFloorPlan,rotate,setTowerBase,setTowerRoof,setHoarding,setWoodRoof,setLonghouseCover,setGateRoof,setGateUpper,setSkin,setWallStair,setWallStairPos,toggleCutaway,stepCutawayFloor,flipSide,
    setRoom,changeHouseLevel,toggleMastio,toggleVillageCenter,setWellName,setKeepStair,keepDrawbridge,changeArchers,setTowerWeapon,setTowerBartizan,setTowerBell,setTowerInnerRoof,setTowerLookout,setTowerOutpost,setTowerSignalFire,setTowerRoofShape,setCivicLevel,setPlazaVariant,setGateClosed,setGateNightClose,setYardSize,
    describeStructure};
  for(const name of ['setTier','setHeight','setKeepFloorPlan','setTowerBase','setTowerRoof','setHoarding','setWoodRoof','setGateRoof','setGateUpper','setSkin','setTowerWeapon','setTowerRoofShape','setTowerBartizan','setTowerBell','setTowerInnerRoof','setCivicLevel','setPlazaVariant']){
    const execute=commands[name];
    commands[name]=(id,...args)=>{
      const target=find(id);if(!target||underConstruction(target))return false;
      const before=structureUpgradeSnapshot(target);
      const result=execute(id,...args);
      if(result&&beginStructureUpgrade(target,before)){refresh(target);status(underConstruction(target)?'Cantiere di modifica avviato':'Modifica completata')}
      return result;
    };
  }
  return commands;
})();
