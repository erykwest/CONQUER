'use strict';
// CONQUER settlement app module — classic-script shared runtime.
function inBuild(p){return p.x>=BUILD_MIN&&p.x<=BUILD_MAX&&p.y>=BUILD_MIN&&p.y<=BUILD_MAX}
function pointHit(s,p){if(s.type==='well')return dist(p,s)<=.75;if(s.shape==='round')return dist(p,s)<=s.r;const q=toLocalPoint(s,p),d=rectDims(s);return Math.abs(q.x)<=d.w/2&&Math.abs(q.y)<=d.h/2}
function linearHit(s,p){const ax=s.a.x,ay=s.a.y,bx=s.b.x,by=s.b.y,dx=bx-ax,dy=by-ay,L2=dx*dx+dy*dy,t=clamp(((p.x-ax)*dx+(p.y-ay)*dy)/(L2||1),0,1),q={x:ax+t*dx,y:ay+t*dy};return dist(p,q)<=Math.max(.45,s.width*.55)}
function structureAt(p){
  const points=State.structures.filter(s=>!s.auto&&['tower','gate','well','market','tavern','church','training','plaza','loggingCamp','quarry','mine'].includes(s.type));
  for(let i=points.length-1;i>=0;i--)if(pointHit(points[i],p))return points[i];
  const linear=State.structures.filter(s=>(!s.auto||s.type==='road'&&s.routeId||s.type==='bridge'&&s.primaryBridgeFor)&&['wall','palisade','built','road','moat','bridge'].includes(s.type));
  for(let i=linear.length-1;i>=0;i--)if(linearHit(linear[i],p))return linear[i];
  return null;
}
function structureAtScreen(p){
  // Crossings occupy the ground plane and are not represented by house/castle hit polygons.
  const world=s2w(p.x,p.y);
  for(const s of State.structures.slice().reverse())if(['moat','bridge'].includes(s.type)&&linearHit(s,world))return s;
  const manual=State.structures.filter(s=>!['moat','bridge'].includes(s.type)&&(!s.auto||s.type==='house'||s.type==='road'&&s.routeId)).slice().sort((a,b)=>worldDepth(b)-worldDepth(a));
  for(const s of manual)if(screenHitStructure(s,p))return s;
  return null;
}
function setTool(tool){State.tool=tool;State.draft=null;document.querySelectorAll('[data-tool],[data-tower],[data-wood-tower],[data-crossing],[data-linear],[data-main-road],[data-gate],[data-wood-gate],[data-well],[data-civic],[data-industry],[data-combat-brush],#combatOrders').forEach(b=>b.classList.remove('active'));if(tool.el)tool.el.classList.add('active');status(tool.label||tool.kind);draw()}
function markDirty(hardNavigation=true,staticChanged=true,scheduleSave=true){
  State.dirty=true;
  if(hardNavigation){
    invalidateNavigation(true);
    fieldWorkAssignmentCache={key:null,map:new Map()};
  }else if(hardNavigation===false){
    // Callers that only alter roads may request a soft graph invalidation
    // explicitly before markDirty; pure data/UI changes should do neither.
  }

  if(staticChanged===true)invalidateSettlementScene(true);
  else if(staticChanged)invalidateSceneCache(staticChanged);

  document.getElementById('saveState').textContent='unsaved';
  if(scheduleSave)scheduleLocalSave();
}
function markStructureDirty(s,hardNavigation=true,scheduleSave=true){
  window.ConquerSiege?.sanitizeRooms(s);
  markDirty(hardNavigation,structureSceneLayers(s),scheduleSave);
}
function changeHouseDensity(target,level){
  if(level===houseLevel(target))return;
  const candidate={...target,houseLevel:level,
    urbanRedeveloped:!target.auto&&level>=3};
  const houses=State.structures.filter(s=>s.type==='house').map(s=>s.id===target.id?candidate:s);
  // An upgrade does not create a new parcel: use the existing ownership
  // and validate its revised footprint without imposing a minimum of two
  // frontage buildings. A narrow main road may support only one.
  if(!urbanLotFor(candidate,houses,primaryRoadList())){
    status('Level change would exceed the lot or violate terrain zoning');return;
  }
  target.houseLevel=level;
  if(!target.auto)target.urbanRedeveloped=level>=3;
  invalidateUrbanGeometry();
  const count=urbanDenseBuildingCount(target);
  // Only clear obsolete access spurs when there is a real street-facing
  // building. A house without usable frontage keeps its existing entrance.
  if(level>=3&&count){
    State.structures=State.structures.filter(s=>s.type!=='road'||s.accessFor!==target.id);
  }else if(level<3&&target.auto)ensureSettlementRoadAccess(target,true);
  markStructureDirty(target);
  renderFunctionPanel();draw();
  status('House L'+level+(count?' · '+count+' streetfront '+(count===1?'building':'buildings'):' · waiting for primary road frontage'));
}function selectedStructure(){return State.structures.find(s=>s.id===State.selectedId)||null}
function selectStructure(s){State.selectedId=s?.id||null;invalidateSceneCache('base');renderFunctionPanel();draw()}
function addStructure(s){
  const preflight=window.ConquerPlacement?.check(s);
  if(preflight&&!preflight.ok){status(preflight.reason);return false}
  if(window.ConquerIndustries?.is(s)){
    const site=window.ConquerIndustries.validate(s);
    if(!site.ok){status(site.reason);return false}
    s.groundZ=site.ground;s.resourceTarget=site.resourceTarget;
  }
  normalizeStructureRotation(s);
  normalizeCivicDevelopment(s);
  normalizeStructureVariants(s);
  if(['tower','gate','built'].includes(s.type))normalizeFunctions(s);
  let displaced={removed:0,roads:[]};
  if(!s.auto){
    if(isPlacementFoundationBuilding(s)){
      const profile=placementFoundationProfile(s);
      if(!profile){status('Unable to resolve terrain under this building');return false}
      s.groundZ=placementGroundZ(s);
      s.foundationMinZ=profile.minZ;
      s.foundationVersion=1;
    }else if(window.ConquerIndustries?.is(s)){
      // Industries were already surveyed by their own resource-specific preflight.
      // Quarry and mine intentionally occupy rocky slopes, not flat terraces.
      s.groundZ=window.ConquerIndustries.validate(s).ground;
    }else{
      const groundZ=buildableTerrainElevationForStructure(s);
      if(groundZ==null){status('Build only on a single flat terrace — slopes and mixed elevations are not buildable for this structure');return false}
      s.groundZ=groundZ;
    }
    const cost=constructionCost(s);
    if(!canAfford(cost)){status('Insufficient resources — '+costText(cost));return false}
    s.buildCost=cost;spendCost(cost);beginConstruction(s);
    displaced=removeOverlappingAuto(s);
  }
  State.structures.push(s);
  let reactive=0;
  if(!s.auto){
    reactive+=repairDisplacedRoads(displaced.roads,s);
    if(isCivic(s))reactive+=ensureSettlementRoadAccess(s);
    if(s.type==='well')reactive+=reconcileTowerSecondaryBranches(Infinity,true);
    if(displaced.removed||reactive){
      const bits=[];
      if(displaced.removed)bits.push(`${displaced.removed} auto element${displaced.removed===1?'':'s'} cleared`);
      if(reactive)bits.push(`${reactive} road segment${reactive===1?'':'s'} adapted`);
      status(bits.join(' · '));
    }
  }
  selectStructure(s);
  const changedLayers=new Set(structureSceneLayers(s));
  if(displaced.removed||reactive){changedLayers.add('ground');changedLayers.add('base')}
  markDirty(true,[...changedLayers]);
  draw();return true
}
function aggregateConstructionCost(structures){
  const total={};
  for(const s of structures)for(const [k,v] of Object.entries(constructionCost(s)||{}))total[k]=(total[k]||0)+v;
  return roundCost(total);
}
function linearRouteStructures(route,endSnapId,spec){
  if(!route?.segments?.length)return[];
  const groupId=route.segments.length>1?uid():null,jointId=route.joint?uid():null;
  return route.segments.map((seg,i)=>{
    const s={
      id:uid(),type:State.tool.linear,width:spec.width,
      a:{...seg.a},b:{...seg.b},length:seg.length,rotationStep:seg.rotationStep,
      level:State.tool.level||State.buildLevels.wall,
      tier:['wall','palisade'].includes(State.tool.linear)?(State.tool.tier||State.buildLevels.wallTier):undefined,
      flip:false,functions:[]
    };
    if(i===0&&State.draft?.aSnap)s.aSnap=State.draft.aSnap;
    if(i===route.segments.length-1&&endSnapId)s.bSnap=endSnapId;
    if(groupId)s.routeGroupId=groupId;
    if(jointId&&i===0)s.bJoint=jointId;
    if(jointId&&i===route.segments.length-1)s.aJoint=jointId;
    return s;
  });
}
function commitStructuralLinearRoute(route,endSnapId,spec){
  const structures=linearRouteStructures(route,endSnapId,spec);
  if(!structures.length)return false;

  // Preflight the whole dogleg before mutating state, so a two-leg wall is atomic
  // from the player's point of view.
  for(const s of structures){
    const verdict=window.ConquerPlacement?.check(s);
    if(verdict&&!verdict.ok){status('Route blocked: '+verdict.reason);return false}
    if(buildableTerrainElevationForStructure(s)==null){
      status('Route crosses incompatible terrain — choose another joint or endpoint');
      return false;
    }
  }
  const totalCost=aggregateConstructionCost(structures);
  if(!canAfford(totalCost)){
    status('Insufficient resources — '+costText(totalCost));
    return false;
  }
  for(const s of structures)if(!addStructure(s))return false;
  return true;
}
function deleteStructure(id){
  const target=State.structures.find(s=>s.id===id);if(!target)return;

  if(target.type==='road'&&target.routeId){
    const deleted=new Set(State.village.deletedMainRoutes||[]);deleted.add(target.routeId);
    State.village.deletedMainRoutes=[...deleted];
  }
  if(target.type==='tower')restoreTowerWallConnections(target);
  if(['tower','gate'].includes(target.type))detachSubtowerChildren(target.id);
  if(!target.auto&&target.buildCost&&!(target.type==='bridge'&&target.variant==='wood'))refundCost(target.buildCost);
  if(target.type==='well'){
    State.combat=null;window.ConquerCombat?.restore(null);
    const borderEntries=ensureBorderEntrySelection();
    State.structures=State.structures.filter(s=>!s.auto&&s.id!==id);
    State.village={name:null,wellId:null,founded:false,growthVersion:3,accessRoadVersion:0,growthStep:0,nextGrowthDay:null,roadPlan:null,roadPlanVersion:0,borderEntries,baseRoadAngle:null};
  }else State.structures=State.structures.filter(s=>s.id!==id&&s.accessFor!==id&&s.repairFor!==id&&s.gateFor!==id&&s.branchTargetId!==id);
  if(target.type==='tower')window.ConquerSiege?.syncAutoMastio?.();
  reconcileTowerSecondaryBranches(Infinity,true);
  if(State.selectedId===id)State.selectedId=null;
  renderFunctionPanel();
  const deletedLayers=new Set([...structureSceneLayers(target),'ground','base']);
  markDirty(true,[...deletedLayers]);
  draw()
}
function pointerScreen(e){const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top}}
function pointerWorld(e){const p=pointerScreen(e);return s2w(p.x,p.y)}
function normalizeTowerAngle(a){return normalizeStructureAngle(a)}
function turnTower(target,delta,label){
  if(!target||target.type!=='tower')return false;
  const angle=snapStructureAngle((Number(target.angle)||0)+delta);
  const verdict=window.ConquerPlacement?.check({...target,angle},{ignoreId:target.id,checkCost:false});
  if(verdict&&!verdict.ok){status('Rotation blocked: '+verdict.reason);return false}

  applyStructureRotation(target,angle);
  if(target.parentTowerId&&target.shape==='square'){
    target.orientationOffset=snapStructureAngle((Number(target.orientationOffset)||0)+delta);
  }

  // A parent rotation carries its attached subtorri; wall sockets are rebuilt
  // against the new tower footprint/facing using the existing collider protocol.
  syncSubtowerTree(target.id);
  target.wallColliderSyncSignature=null;
  syncCompletedTowerWallColliders(true);

  // Service roads are derived from the actual tower entrance/facing.
  rebuildTowerSecondaryBranch(target,true);

  invalidateCastleColliderGeometry(target);
  markStructureDirty(target);
  renderFunctionPanel();
  draw();
  status(label);
  return true;
}
function turnGate(target,delta,label='Gate rotated'){
  if(!target||target.type!=='gate')return false;
  const angle=snapStructureAngle((Number(target.angle)||0)+delta);
  const verdict=window.ConquerPlacement?.check({...target,angle},{ignoreId:target.id,checkCost:false});
  if(verdict&&!verdict.ok){status('Rotation blocked: '+verdict.reason);return false}
  applyStructureRotation(target,angle);

  // Gate front is semantic: rotation carries its attached front subtorri.
  syncSubtowerTree(target.id);

  invalidateCastleColliderGeometry(target);
  markStructureDirty(target);
  renderFunctionPanel();
  draw();
  status(label);
  return true;
}
function flipGate(target){return turnGate(target,Math.PI,'Gate front flipped')}
function rotatePointStructure(target,steps=1){
  if(!target||!['house','market','tavern','church','training','plaza','loggingCamp','quarry','mine'].includes(target.type))return false;
  const oldAngle=Number(target.angle)||0,next=snapStructureAngle(oldAngle+STRUCTURE_ANGLE_STEP*steps);
  const candidate={...target,angle:next,rotationStep:structureRotationStep(next)};
  // Rotation is a structural edit. Ignore the current footprint and the former
  // resource cost, but never ignore nearby occupied geometry or terrain.
  const verdict=window.ConquerPlacement?.check(candidate,{ignoreId:target.id,checkCost:false,includeAuto:target.auto});
  if(verdict&&!verdict.ok){status('Rotation blocked: '+verdict.reason);return false}
  applyStructureRotation(target,next);
  if(isPlacementFoundationBuilding(target)){
    const foundation=placementFoundationProfile(target);
    if(foundation){target.groundZ=foundation.baseZ;target.foundationMinZ=foundation.minZ;target.foundationVersion=1}
  }else if(window.ConquerIndustries?.is(target)){
    target.groundZ=window.ConquerIndustries.validate(target).ground;
  }else{
    target.groundZ=buildableTerrainElevationForStructure(target);
  }
  if(target.type==='house')invalidateUrbanGeometry();
  markStructureDirty(target,true,true);
  renderFunctionPanel();draw();
  status(structureLabel(target)+' · rotated '+Math.round(target.angle*180/Math.PI)%360+'°');
  return true;
}

