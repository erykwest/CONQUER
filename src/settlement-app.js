'use strict';
// CONQUER settlement app module — classic-script shared runtime.
function inBuild(p){return p.x>=BUILD_MIN&&p.x<=BUILD_MAX&&p.y>=BUILD_MIN&&p.y<=BUILD_MAX}
function pointHit(s,p){if(s.type==='well')return dist(p,s)<=.75;if(s.shape==='round')return dist(p,s)<=s.r;const q=toLocalPoint(s,p),d=rectDims(s);return Math.abs(q.x)<=d.w/2&&Math.abs(q.y)<=d.h/2}
function linearHit(s,p){const ax=s.a.x,ay=s.a.y,bx=s.b.x,by=s.b.y,dx=bx-ax,dy=by-ay,L2=dx*dx+dy*dy,t=clamp(((p.x-ax)*dx+(p.y-ay)*dy)/(L2||1),0,1),q={x:ax+t*dx,y:ay+t*dy};return dist(p,q)<=Math.max(.45,s.width*.55)}
function structureAt(p){
  const points=State.structures.filter(s=>!s.auto&&['tower','gate','well','market','tavern','church','training'].includes(s.type));
  for(let i=points.length-1;i>=0;i--)if(pointHit(points[i],p))return points[i];
  const linear=State.structures.filter(s=>!s.auto&&['wall','palisade','built'].includes(s.type));
  for(let i=linear.length-1;i>=0;i--)if(linearHit(linear[i],p))return linear[i];
  return null;
}
function structureAtScreen(p){
  const manual=State.structures.filter(s=>!s.auto||s.type==='house').slice().sort((a,b)=>worldDepth(b)-worldDepth(a));
  for(const s of manual)if(screenHitStructure(s,p))return s;
  return null;
}
function setTool(tool){State.tool=tool;State.draft=null;document.querySelectorAll('[data-tool],[data-tower],[data-wood-tower],[data-linear],[data-gate],[data-well],[data-civic]').forEach(b=>b.classList.remove('active'));if(tool.el)tool.el.classList.add('active');status(tool.label||tool.kind);draw()}
function markDirty(hardNavigation=true,staticChanged=true,scheduleSave=true){
  State.dirty=true;
  invalidateNavigation(hardNavigation);
  fieldWorkAssignmentCache={key:null,map:new Map()};
  if(staticChanged)invalidateSceneCache();
  document.getElementById('saveState').textContent='unsaved';
  if(scheduleSave)scheduleLocalSave();
}
function selectedStructure(){return State.structures.find(s=>s.id===State.selectedId)||null}
function selectStructure(s){State.selectedId=s?.id||null;invalidateSceneCache('base');renderFunctionPanel();draw()}
function addStructure(s){
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
  selectStructure(s);markDirty(true);draw();return true
}
function deleteStructure(id){
  const target=State.structures.find(s=>s.id===id);if(!target)return;
  if(target.type==='tower')restoreTowerWallConnections(target);
  if(['tower','gate'].includes(target.type))detachSubtowerChildren(target.id);
  if(!target.auto&&target.buildCost)refundCost(target.buildCost);
  if(target.type==='well'){
    State.structures=State.structures.filter(s=>!s.auto&&s.id!==id);
    State.village={name:null,wellId:null,founded:false,growthVersion:3,accessRoadVersion:0,growthStep:0,nextGrowthDay:null,roadPlan:null,baseRoadAngle:null};
  }else State.structures=State.structures.filter(s=>s.id!==id&&s.accessFor!==id&&s.repairFor!==id&&s.gateFor!==id&&s.branchTargetId!==id);
  reconcileTowerSecondaryBranches(Infinity,true);
  if(State.selectedId===id)State.selectedId=null;renderFunctionPanel();markDirty();draw()
}
function pointerScreen(e){const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top}}
function pointerWorld(e){const p=pointerScreen(e);return s2w(p.x,p.y)}
function normalizeTowerAngle(a){
  const tau=Math.PI*2;
  return((Number(a)||0)%tau+tau)%tau;
}
function turnTower(target,delta,label){
  if(!target||target.type!=='tower')return false;

  target.angle=normalizeTowerAngle((Number(target.angle)||0)+delta);
  if(target.parentTowerId&&target.shape==='square'){
    target.orientationOffset=normalizeTowerAngle((Number(target.orientationOffset)||0)+delta);
  }

  // A parent rotation carries its attached subtorri; wall sockets are rebuilt
  // against the new tower footprint/facing using the existing collider protocol.
  syncSubtowerTree(target.id);
  target.wallColliderSyncSignature=null;
  syncCompletedTowerWallColliders(true);

  // Service roads are derived from the actual tower entrance/facing.
  rebuildTowerSecondaryBranch(target,true);

  invalidateCastleColliderGeometry(target);
  markDirty();
  renderFunctionPanel();
  draw();
  status(label);
  return true;
}
function renderFunctionPanel(){
  const panel=document.getElementById('functionPanel'),info=document.getElementById('functionInfo'),slots=document.getElementById('functionSlots'),s=selectedStructure();
  if(!s||!['tower','gate','built','wall','palisade','house','market','tavern','church','training'].includes(s.type)){panel.classList.remove('open');return}
  const simpleCivic=isCivic(s);
  if(s.type!=='house'&&!simpleCivic)normalizeFunctions(s);const cap=(s.type==='house'||simpleCivic)?0:functionCapacity(s);panel.classList.add('open');
  const building=underConstruction(s),pr=Math.round(constructionProgress(s)*100),woodTower=isWoodTower(s),canHeight=['tower','gate','wall','built'].includes(s.type)&&!woodTower,maxLevel=['tower','gate'].includes(s.type)?3:2,canTier=['tower','wall','palisade'].includes(s.type)&&!woodTower;
  info.innerHTML=`<div class="kv"><span>Selected</span><b>${structureLabel(s)}</b></div>${s.type==='house'?(()=>{const pop=housePopulationCapacity(s);return `<div class="kv"><span>Household capacity</span><b>${pop.total}</b></div><div class="cost-line">${pop.male} male · ${pop.female} female · ${pop.children} children</div>`})():simpleCivic?`<div class="cost-line">Construction: ${costText(s.buildCost||constructionCost(s))}</div><div class="legend">Prototype civic building · functions/routines pending.</div>`:`<div class="kv"><span>Capacity</span><b>${cap} ${cap===1?'function':'functions'}</b></div><div class="cost-line">Construction: ${costText(s.buildCost||constructionCost(s))}</div>`}${building?`<div class="slot"><div class="site-label">Under construction · ${remainingDays(s).toFixed(1)} days</div><div class="progress"><i style="width:${pr}%"></i></div></div>`:''}${s.type==='built'?`<div class="legend" style="margin-top:7px">Capacity per level: &lt;2U = 0 · 2–&lt;3U = 1 · ≥3U = 2.</div>`:''}`;
  let html='';
  if(s.type==='house'){
    const level=houseLevel(s);
    html+=`<div class="slot"><div class="slot-label">House social level</div><div class="grid"><button data-house-down ${level<=1?'disabled':''}>− Downgrade</button><button data-house-up ${level>=4?'disabled':''}>+ Upgrade</button></div><div class="legend">L1: 3 residents · L2: 6 · L3: 9 · L4: 12. L3: extended ${housePlanType(s)} plan · L4: elite house with ${houseTurretType(s)} turret.</div></div>`;
  }
  if(canTier){
    const current=['wall','palisade'].includes(s.type)?wallTier(s):towerTier(s);
    const labels=['wall','palisade'].includes(s.type)?['T1 · .2U','T2 · .5U','T3 · 1U']:(s.shape==='round'?['T1 · R.5','T2 · R.75','T3 · R1']:['T1 · 1U','T2 · 1.5U','T3 · 2U']);
    html+=`<div class="slot"><div class="slot-label">Tier / footprint</div><div class="grid3">${labels.map((label,i)=>`<button data-structure-tier="${i+1}" class="${current===i+1?'active':''}">${label}</button>`).join('')}</div></div>`;
  }
  if(canHeight)html+=`<div class="slot"><div class="slot-label">Height levels</div><div class="${maxLevel===3?'grid3':'grid'}">${Array.from({length:maxLevel},(_,i)=>`<button data-height-level="${i+1}" class="${structureLevel(s)===i+1?'active':''}">${i+1}</button>`).join('')}</div></div>`;
  if(s.type==='tower'){
    const deg=Math.round(normalizeTowerAngle(s.angle)*180/Math.PI)%360;
    html+=`<div class="slot"><div class="slot-label">Tower orientation · ${deg}°</div><div class="grid"><button data-tower-flip>⇄ Flip</button><button data-tower-rotate90>↻ Rotate 90°</button></div><div class="legend">Flip reverses the tower front by 180°. Secondary service branches follow the new entrance.</div></div>`;
    if(isWoodTower(s)){
      html+=`<div class="slot"><div class="legend">Wooden tower · fixed H1. Uses normal tower/wall snap but no masonry battlements or doors.</div></div>`;
      if(woodTowerStyle(s)==='palisadeTower'){
        const roof=woodTowerRoof(s);
        html+=`<div class="slot"><div class="slot-label">Wood roof</div><div class="grid"><button data-wood-roof="open" class="${roof==='open'?'active':''}">Open platform</button><button data-wood-roof="pitched" class="${roof==='pitched'?'active':''}">Pitched · 4 posts</button></div></div>`;
      }
    }else{
      const roof=towerRoofStyle(s);
      if(s.parentTowerId){
        const parent=State.structures.find(x=>x.id===s.parentTowerId);
        html+=`<div class="slot"><div class="legend">Subtower attached to ${parent?structureLabel(parent):'parent structure'}.</div></div>`;
      }
      html+=`<div class="slot"><div class="slot-label">Tower roof</div><div class="grid"><button data-tower-roof="battlement" class="${roof==='battlement'?'active':''}">Merlato</button><button data-tower-roof="pitched" class="${roof==='pitched'?'active':''}">Falde</button></div></div>`;
    }
  }
  if(s.type==='gate'){
    const roof=gateRoofStyle(s);
    html+=`<div class="slot"><div class="slot-label">Gate roof</div><div class="grid"><button data-gate-roof="battlement" class="${roof==='battlement'?'active':''}">Merlato</button><button data-gate-roof="pitched" class="${roof==='pitched'?'active':''}">Falde</button></div></div>`;
  }
  if(s.type==='built'){
    const skin=builtSkin(s);
    html+=`<div class="slot"><div class="slot-label">Built wall skin</div><div class="grid"><button data-built-skin="standard" class="${skin==='standard'?'active':''}">Standard</button><button data-built-skin="arcade" class="${skin==='arcade'?'active':''}">Porticato</button></div><div class="legend">Porticato affects only the interior ground floor.</div></div>`;
  }
  if(s.type==='wall'){
    const skin=wallSkin(s);
    html+=`<div class="slot"><div class="slot-label">Wall skin</div><div class="grid"><button data-wall-skin="standard" class="${skin==='standard'?'active':''}">Standard</button><button data-wall-skin="hoarding" class="${skin==='hoarding'?'active':''}">Hoarding</button></div><div class="legend">Hoarding replaces the exterior battlement treatment with a timber fighting gallery.</div></div>`;
  }
  if(['wall','palisade','built'].includes(s.type)){
    const flipLabel=s.type==='built'?'Exterior side / windows':'Exterior side';
    const flipLegend=s.type==='wall'?'Defines the exterior side for battlements or hoarding.':s.type==='palisade'?'Defines which side is exterior; walkway and earthwork are generated inward.':'Exterior windows: upper level only. Interior windows/portico follow the opposite side.';
    html+=`<div class="slot"><div class="slot-label">${flipLabel}</div><button data-linear-flip class="active">⇄ Flip</button><div class="legend">${flipLegend}</div></div>`;
  }
  if(s.type!=='house'&&!simpleCivic){
    if(building)html+='<div class="slot"><div class="legend">Functions can be assigned when construction is complete.</div></div>';
    else if(cap===0)html+='<div class="slot"><div class="legend">No function capacity at the current footprint/height.</div></div>';
    else html+=s.functions.map((value,i)=>`<div class="slot"><div class="slot-label">Function slot ${i+1}</div><select data-function-slot="${i}"><option value="">— Empty —</option>${FUNCTION_CATALOG.map(k=>`<option value="${k}" ${value===k?'selected':''}>${FUNCTION_LABELS[k]}</option>`).join('')}</select></div>`).join('');
  }
  slots.innerHTML=html;
  slots.querySelectorAll('[data-house-up]').forEach(btn=>btn.onclick=()=>{const target=selectedStructure();if(!target||target.type!=='house')return;target.houseLevel=clamp(houseLevel(target)+1,1,4);markDirty();renderFunctionPanel();draw();status('House upgraded to L'+target.houseLevel)});
  slots.querySelectorAll('[data-house-down]').forEach(btn=>btn.onclick=()=>{const target=selectedStructure();if(!target||target.type!=='house')return;target.houseLevel=clamp(houseLevel(target)-1,1,4);markDirty();renderFunctionPanel();draw();status('House downgraded to L'+target.houseLevel)});
  slots.querySelectorAll('[data-structure-tier]').forEach(btn=>btn.onclick=()=>{
    const target=selectedStructure();if(!target)return;
    const requested=Number(btn.dataset.structureTier);

    if(target.type==='tower'){
      const parent=target.parentTowerId&&State.structures.find(s=>s.id===target.parentTowerId&&s.type==='tower');
      if(parent&&requested>=towerTier(parent)){
        status('Subtower must remain smaller than its parent tower');return;
      }
      const children=subtowerChildren(target.id);
      if(children.some(child=>towerTier(child)>=requested)){
        status('Parent tower must remain larger than all attached subtorri');return;
      }
    }

    applyStructureTier(target,requested);
    target.tier=['wall','palisade'].includes(target.type)?wallTier(target):towerTier(target);
    target.buildCost=constructionCost(target);

    if(target.type==='tower'){
      repositionSubtower(target);
      syncSubtowerTree(target.id);
    }

    markDirty();renderFunctionPanel();draw();
  });
  slots.querySelectorAll('[data-height-level]').forEach(btn=>btn.onclick=()=>{const target=selectedStructure();if(!target)return;target.level=Number(btn.dataset.heightLevel);normalizeFunctions(target);target.buildCost=constructionCost(target);markDirty();renderFunctionPanel();draw()});
  slots.querySelectorAll('[data-tower-flip]').forEach(btn=>btn.onclick=()=>{const target=selectedStructure();turnTower(target,Math.PI,'Tower front flipped')});
  slots.querySelectorAll('[data-tower-rotate90]').forEach(btn=>btn.onclick=()=>{const target=selectedStructure();turnTower(target,Math.PI/2,'Tower rotated 90°')});
  slots.querySelectorAll('[data-tower-roof]').forEach(btn=>btn.onclick=()=>{const target=selectedStructure();if(!target||target.type!=='tower')return;if(!setStructureVariant(target,'roofStyle',btn.dataset.towerRoof))return;markDirty();renderFunctionPanel();draw();status('Tower roof: '+(target.roofStyle==='pitched'?'pitched':'battlement'))});
  slots.querySelectorAll('[data-wood-roof]').forEach(btn=>btn.onclick=()=>{const target=selectedStructure();if(!isWoodTower(target)||woodTowerStyle(target)!=='palisadeTower')return;target.woodRoof=btn.dataset.woodRoof==='pitched'?'pitched':'open';markDirty();renderFunctionPanel();draw();status('Wood tower roof: '+target.woodRoof)});
  slots.querySelectorAll('[data-gate-roof]').forEach(btn=>btn.onclick=()=>{const target=selectedStructure();if(!target||target.type!=='gate')return;if(!setStructureVariant(target,'roofStyle',btn.dataset.gateRoof))return;markDirty();renderFunctionPanel();draw();status('Gate roof: '+(target.roofStyle==='pitched'?'pitched':'battlement'))});
  slots.querySelectorAll('[data-built-skin]').forEach(btn=>btn.onclick=()=>{const target=selectedStructure();if(!target||target.type!=='built')return;if(!setStructureVariant(target,'skin',btn.dataset.builtSkin))return;markDirty();renderFunctionPanel();draw();status('Built wall skin: '+(target.skin==='arcade'?'porticato':'standard'))});
  slots.querySelectorAll('[data-wall-skin]').forEach(btn=>btn.onclick=()=>{const target=selectedStructure();if(!target||target.type!=='wall')return;if(!setStructureVariant(target,'skin',btn.dataset.wallSkin))return;markDirty();renderFunctionPanel();draw();status('Wall skin: '+target.skin)});
  slots.querySelectorAll('[data-linear-flip]').forEach(btn=>btn.onclick=()=>{const target=selectedStructure();if(!target||!['wall','palisade','built'].includes(target.type))return;target.flip=!target.flip;markDirty();renderFunctionPanel();draw();status((target.type==='wall'?'Wall':target.type==='palisade'?'Palisade':'Built section')+' exterior flipped')});
  slots.querySelectorAll('[data-function-slot]').forEach(sel=>sel.onchange=e=>{const target=selectedStructure();if(!target)return;normalizeFunctions(target);target.functions[Number(e.target.dataset.functionSlot)]=e.target.value||null;markDirty();draw()});
}
let pan=null;
canvas.addEventListener('pointerdown',e=>{
  if(e.button===1||e.button===2){pan={x:e.clientX,y:e.clientY,vx:State.view.x,vy:State.view.y};canvas.setPointerCapture(e.pointerId);return}
  const sp=pointerScreen(e),p=s2w(sp.x,sp.y);
  if(State.tool.kind==='select'){selectStructure(structureAtScreen(sp)||structureAt(p));return}
  if(State.tool.kind==='delete'){const hit=structureAtScreen(sp)||structureAt(p);if(hit)deleteStructure(hit.id);return}

  // Once the centre is fixed, the second click only defines orientation.
  // It may be anywhere on screen; only the building centre must lie in the build area.
  if(State.draft?.mode==='orient'&&orientedToolSpec()){
    const angle=Number.isFinite(State.draft.lockedAngle)?State.draft.lockedAngle:placementAngle(State.draft.center,p);
    commitOrientedPlacement(State.draft.center,angle);return
  }

  if(!inBuild(p)){status('Build only inside the central 100×100U area');return}
  if(State.tool.kind==='tower'){
    const snap=towerPlacementSnap(p),q=snap.point;
    if(State.tool.shape==='round'){
      State.draft=null;
      addTowerWithPlacement(
        {id:uid(),type:'tower',shape:'round',x:q.x,y:q.y,r:State.tool.size,level:State.tool.level||State.buildLevels.tower,functions:[]},
        snap
      );
      return
    }
    const lockedAngle=(snap.parentTowerId||snap.wallId)?snap.angle:null;
    const angle=Number.isFinite(lockedAngle)?lockedAngle:0;
    State.draft={
      mode:'orient',center:q,angle,lockedAngle,
      wallSnapId:snap.wallId||null,
      wallSnapEnd:snap.wallEnd||null,
      parentTowerId:snap.parentTowerId||null,
      subtowerSocket:snap.subtowerSocket||null,
      subtowerAngle:Number.isFinite(snap.subtowerAngle)?snap.subtowerAngle:null,
      preview:makePlacementPreview(q,angle)
    };
    status(snap.parentTowerId?'Subtower magnetized — click to confirm':snap.wallId?'Tower magnetized to wall endpoint — click to confirm':'Position fixed — move cursor to rotate, click to confirm');
    draw();return
  }
  if(State.tool.kind==='gate'){
    const q={x:snapGrid(p.x),y:snapGrid(p.y)};
    State.draft={mode:'orient',center:q,angle:0,preview:makePlacementPreview(q,0)};
    status('Gate position fixed — move cursor to rotate, click to confirm');draw();return
  }
  if(State.tool.kind==='civic'){
    const q={x:snapGrid(p.x),y:snapGrid(p.y)};
    State.draft={mode:'orient',center:q,angle:0,preview:makePlacementPreview(q,0)};
    status(structureLabel(State.draft.preview)+' position fixed — move cursor to rotate, click to confirm');draw();return
  }
  if(State.tool.kind==='well'){
    if(State.village.founded||State.structures.some(s=>s.type==='well')){status('This settlement already has a village well');return}
    const q={x:snapGrid(p.x),y:snapGrid(p.y)},well={id:uid(),type:'well',x:q.x,y:q.y};
    if(addStructure(well))openVillageModal(well);return
  }
  if(State.tool.kind==='linear'){
    if(!State.draft){const s=snapAnchor(p);State.draft={a:s.point,aSnap:s.structureId,preview:null};status('Point A set — choose point B');draw()}
    else{const e2=snapAnchor(p),spec=currentLinearSpec(),n=normalizeLinear(State.draft.a,e2.point,spec);if(n&&n.length>=spec.min-.001){addStructure({id:uid(),type:State.tool.linear,width:spec.width,a:n.a,b:n.b,aSnap:State.draft.aSnap,bSnap:e2.structureId,length:n.length,level:State.tool.level||State.buildLevels.wall,tier:['wall','palisade'].includes(State.tool.linear)?(State.tool.tier||State.buildLevels.wallTier):undefined,flip:false,functions:[]});State.draft=null;status(State.tool.label+' ready for next segment')}else status('Segment too short')}
  }
});
canvas.addEventListener('pointermove',e=>{
  if(pan){State.view.x=pan.vx+e.clientX-pan.x;State.view.y=pan.vy+e.clientY-pan.y;draw();return}
  const p=pointerWorld(e);
  if(State.tool.kind==='linear'&&State.draft){
    const snap=snapAnchor(p),spec=currentLinearSpec(),n=normalizeLinear(State.draft.a,snap.point,spec);
    if(n){State.draft.preview={type:State.tool.linear,width:spec.width,a:n.a,b:n.b,length:n.length,level:State.tool.level||State.buildLevels.wall,tier:['wall','palisade'].includes(State.tool.linear)?(State.tool.tier||State.buildLevels.wallTier):undefined};status(`${State.tool.label}: ${n.length.toFixed(2)}U · L${State.tool.level||State.buildLevels.wall} · ${buildDuration({type:State.tool.linear,length:n.length,level:State.tool.level||State.buildLevels.wall}).toFixed(1)}d · ${costText(constructionCost({type:State.tool.linear,length:n.length,level:State.tool.level||State.buildLevels.wall}))}`);draw()}
    return
  }
  const oriented=orientedToolSpec();
  if(oriented){
    if(State.draft?.mode==='orient'){
      const angle=Number.isFinite(State.draft.lockedAngle)?State.draft.lockedAngle:placementAngle(State.draft.center,p);
      State.draft.angle=angle;State.draft.preview=makePlacementPreview(State.draft.center,angle);
      let deg=Math.round(angle*180/Math.PI);if(deg<0)deg+=360;
      status(State.draft.wallSnapId?`Wall snap · aligned ${deg}° — click to confirm`:`Rotate: ${deg}° — click to confirm`);
      draw();return
    }
    if(State.tool.kind==='tower'){
      const snap=towerPlacementSnap(p),angle=(snap.parentTowerId||snap.wallId)?snap.angle:0;
      State.draft={
        mode:'hover',
        wallSnapId:snap.wallId||null,
        wallSnapEnd:snap.wallEnd||null,
        parentTowerId:snap.parentTowerId||null,
        subtowerSocket:snap.subtowerSocket||null,
        subtowerAngle:Number.isFinite(snap.subtowerAngle)?snap.subtowerAngle:null,
        preview:makePlacementPreview(snap.point,angle)
      };
      if(snap.parentTowerId)status('Subtower socket');
    }else{
      const q={x:snapGrid(p.x),y:snapGrid(p.y)};
      State.draft={mode:'hover',preview:makePlacementPreview(q,0)};
    }
    draw();return
  }
  if(State.tool.kind==='tower'&&State.tool.shape==='round'){
    const snap=towerPlacementSnap(p);
    State.draft={
      mode:'hover',
      wallSnapId:snap.wallId||null,
      parentTowerId:snap.parentTowerId||null,
      subtowerSocket:snap.subtowerSocket||null,
      subtowerAngle:Number.isFinite(snap.subtowerAngle)?snap.subtowerAngle:null,
      preview:makePlacementPreview(snap.point,0)
    };
    if(snap.parentTowerId)status('Subtower socket');
    draw();return
  }
});
function finishCanvasPan(){
  if(!pan)return;
  pan=null;
  // During drag the static bitmap is translated cheaply. Rasterize once at
  // the final camera so subsequent frames have full coverage and zero offset.
  invalidateSceneCache();
  scheduleLocalSave(500);
  draw();
}
canvas.addEventListener('pointerup',finishCanvasPan);
canvas.addEventListener('pointercancel',finishCanvasPan);
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('wheel',e=>{e.preventDefault();const r=canvas.getBoundingClientRect(),sx=e.clientX-r.left,sy=e.clientY-r.top,before=s2w(sx,sy),factor=e.deltaY<0?1.12:.89;State.view.scale=clamp(State.view.scale*factor,.2,10);const after=w2s(before);State.view.x+=sx-after.x;State.view.y+=sy-after.y;invalidateSceneCache();draw();if(State.view.scale>=WEATHER_ZOOM_THRESHOLD)clearWeatherCloudLayer();drawWeatherOverlay()},{passive:false});
for(const b of document.querySelectorAll('[data-tool]'))b.onclick=()=>setTool({kind:b.dataset.tool,label:b.textContent.trim(),el:b});
for(const b of document.querySelectorAll('[data-tower]'))b.onclick=()=>{const level=State.buildLevels.tower,dummy={type:'tower',material:'stone',shape:b.dataset.tower,level,...(b.dataset.tower==='round'?{r:Number(b.dataset.size)}:{size:Number(b.dataset.size)})};setTool({kind:'tower',material:'stone',shape:b.dataset.tower,size:Number(b.dataset.size),level,label:`${b.dataset.tower} tower ${b.dataset.size}U · L${level} · ${buildDuration(dummy).toFixed(0)}d · ${costText(constructionCost(dummy))}`,el:b})};
for(const b of document.querySelectorAll('[data-wood-tower]'))b.onclick=()=>{const style=b.dataset.woodTower,size=style==='watchtower'?1:1.5,woodRoof=style==='watchtower'?'pitched':'open',dummy={type:'tower',material:'wood',woodStyle:style,woodRoof,shape:'square',size,level:1};setTool({kind:'tower',material:'wood',woodStyle:style,woodRoof,shape:'square',size,level:1,label:`${style==='watchtower'?'Wood watchtower':'Wood tower'} · H1 · ${buildDuration(dummy).toFixed(1)}d · ${costText(constructionCost(dummy))}`,el:b})};
for(const b of document.querySelectorAll('[data-linear]'))b.onclick=()=>{const tier=State.buildLevels.wallTier,isPalisade=b.dataset.linear==='palisade',level=isPalisade?1:State.buildLevels.wall;setTool({kind:'linear',linear:b.dataset.linear,level,tier,label:(b.dataset.linear==='wall'?`Wall T${tier}`:isPalisade?`Palisade T${tier}`:'Built section')+(isPalisade?'':` L${level}`)+` — choose point A`,el:b})};
document.querySelectorAll('[data-tower-level]').forEach(b=>b.onclick=()=>{State.buildLevels.tower=Number(b.dataset.towerLevel);document.querySelectorAll('[data-tower-level]').forEach(x=>x.classList.toggle('active',x===b));if(State.tool.kind==='tower'&&State.tool.material!=='wood'){State.tool.level=State.buildLevels.tower;State.draft=null;status('Tower height: '+State.buildLevels.tower+' level'+(State.buildLevels.tower>1?'s':''));draw()}});
document.querySelectorAll('[data-wall-tier]').forEach(b=>b.onclick=()=>{State.buildLevels.wallTier=Number(b.dataset.wallTier);document.querySelectorAll('[data-wall-tier]').forEach(x=>x.classList.toggle('active',x===b));if(State.tool.kind==='linear'&&['wall','palisade'].includes(State.tool.linear)){State.tool.tier=State.buildLevels.wallTier;State.draft=null;status((State.tool.linear==='palisade'?'Palisade':'Wall')+' tier: T'+State.buildLevels.wallTier+' · '+wallWidthForTier(State.buildLevels.wallTier)+'U');draw()}});
document.querySelectorAll('[data-wall-level]').forEach(b=>b.onclick=()=>{State.buildLevels.wall=Number(b.dataset.wallLevel);document.querySelectorAll('[data-wall-level]').forEach(x=>x.classList.toggle('active',x===b));if(State.tool.kind==='linear'&&State.tool.linear!=='palisade'){State.tool.level=State.buildLevels.wall;State.draft=null;status('Wall height: '+State.buildLevels.wall+' level'+(State.buildLevels.wall>1?'s':''));draw()}});
document.querySelectorAll('[data-gate-level]').forEach(b=>b.onclick=()=>{
  State.buildLevels.gate=Number(b.dataset.gateLevel);
  document.querySelectorAll('[data-gate-level]').forEach(x=>x.classList.toggle('active',x===b));
  if(State.tool.kind==='gate'){
    State.tool.level=State.buildLevels.gate;State.draft=null;
    const dummy={type:'gate',level:State.buildLevels.gate};
    status('Gate height: L'+State.buildLevels.gate+' · '+buildDuration(dummy).toFixed(1)+'d');
    draw();
  }
});
document.querySelector('[data-gate]').onclick=e=>{
  const level=State.buildLevels.gate,dummy={type:'gate',level};
  setTool({kind:'gate',level,label:'Gate 1.5×1.5U · L'+level+' · '+buildDuration(dummy).toFixed(1)+'d · '+costText(constructionCost(dummy)),el:e.currentTarget});
};
for(const b of document.querySelectorAll('[data-civic]'))b.onclick=()=>{
  const type=b.dataset.civic,spec={type,shape:'civic'};
  setTool({kind:'civic',placementSpec:spec,label:structureLabel(spec)+' · '+BUILD_DAYS[type]+'d · '+costText(COSTS[type]),el:b});
};
document.querySelector('[data-well]').onclick=e=>setTool({kind:'well',label:'Village well · instant · '+costText(COSTS.well),el:e.currentTarget});
document.getElementById('confirmVillageBtn').onclick=()=>{
  const well=State.structures.find(s=>s.id===State.pendingWellId&&s.type==='well'),name=document.getElementById('villageNameInput').value.trim();
  if(!well)return closeVillageModal();if(!name){status('Enter a village name');document.getElementById('villageNameInput').focus();return}
  State.village={name,wellId:well.id,founded:true,growthVersion:3,growthStep:0,nextGrowthDay:null,roadPlan:null,baseRoadAngle:null};closeVillageModal();markDirty();renderUI();status(`${name} founded — village growth has begun`);processVillageGrowth();draw();
};
document.getElementById('cancelVillageBtn').onclick=()=>{const id=State.pendingWellId;closeVillageModal();if(id)deleteStructure(id)};
document.getElementById('villageNameInput').addEventListener('keydown',e=>{if(e.key==='Enter')document.getElementById('confirmVillageBtn').click()});
document.getElementById('closeFunctions').onclick=()=>{State.selectedId=null;renderFunctionPanel();draw()};
document.getElementById('undoBtn').onclick=()=>{const s=[...State.structures].reverse().find(x=>!x.auto);if(s)deleteStructure(s.id)};
document.getElementById('clearBtn').onclick=()=>{if(confirm('Clear the settlement and refund player-built structures?')){for(const s of State.structures)if(!s.auto&&s.buildCost)refundCost(s.buildCost);State.structures=[];State.village={name:null,wellId:null,founded:false,growthVersion:3,growthStep:0,nextGrowthDay:null,roadPlan:null,baseRoadAngle:null};State.selectedId=null;renderFunctionPanel();markDirty();renderUI();draw()}};
['tax','rations','levy'].forEach(k=>document.getElementById(k).oninput=e=>{State.policies[k]=Number(e.target.value);markDirty()});
function migrateStructures(list){
  const migrated=(list||[]).map(s=>{
    if(s.type==='house')s.houseLevel=houseLevel(s);
    if(s.type==='built'){
      s.width=1;
      if(!Number.isFinite(s.length))s.length=dist(s.a,s.b);
      s.level=clamp(Math.round(Number(s.level)||1),1,2);
    }
    if(s.type==='wall'){
      s.width=Number.isFinite(Number(s.width))?Number(s.width):.5;
      s.tier=wallTier(s);
      s.width=wallWidthForTier(s.tier);
      s.level=clamp(Math.round(Number(s.level)||1),1,2);
    }
    if(s.type==='palisade'){
      s.width=Number.isFinite(Number(s.width))?Number(s.width):.5;
      s.tier=wallTier(s);
      s.width=wallWidthForTier(s.tier);
      s.level=1;
      s.flip=!!s.flip;
    }
    if(s.type==='tower'){
      s.material=s.material==='wood'?'wood':'stone';
      if(!Number.isFinite(Number(s.orientationOffset)))s.orientationOffset=0;
      if(s.material==='wood'){
        s.woodStyle=s.woodStyle==='watchtower'?'watchtower':'palisadeTower';
        s.shape='square';s.level=1;
        s.size=s.woodStyle==='watchtower'?1:1.5;
        s.woodRoof=s.woodStyle==='watchtower'?'pitched':(s.woodRoof==='pitched'?'pitched':'open');
      }else{
        s.level=clamp(Math.round(Number(s.level)||1),1,3);
      }
      s.tier=towerTier(s);
      applyStructureTier(s,s.tier);
      s.wallColliderSyncSignature=null;
    }
    if(s.type==='gate'){
      s.level=clamp(Math.round(Number(s.level)||1),1,3);
    }
    if(s.type==='well')delete s.construction;
    if(['tower','gate'].includes(s.type)&&!Number.isFinite(s.angle))s.angle=0;

    // V1 visual-variant migration. Legacy structures keep today's appearance.
    normalizeStructureVariants(s);

    if(['tower','gate','built'].includes(s.type))normalizeFunctions(s);
    return s;
  });

  const byId=new Map(migrated.map(s=>[s.id,s]));
  for(const s of migrated){
    if(s.type!=='tower'||!s.parentTowerId)continue;
    const parent=byId.get(s.parentTowerId);
    if(!parent||!['tower','gate'].includes(parent.type)||(parent.type==='tower'&&towerTier(s)>=towerTier(parent))){
      delete s.parentTowerId;delete s.subtowerSocket;delete s.subtowerAngle;delete s.parentType;
      continue;
    }
    s.parentType=parent.type;
    // Recompute persisted attachment coordinates so legacy subtowers move
    // immediately onto the new center-based node model after load.
    const attachment=subtowerAttachmentAtSocket(parent,s,s.subtowerSocket,s.subtowerAngle);
    if(attachment){
      s.x=attachment.point.x;s.y=attachment.point.y;
      if(s.shape==='square')s.angle=attachment.angle;
      s.subtowerSocket=attachment.subtowerSocket;
      s.subtowerAngle=attachment.subtowerAngle;
    }
  }
  return migrated;
}
const LOCAL_STORAGE_SCHEMA=2;
function localStorageBranch(){
  if(!location.hostname.endsWith('github.io'))return null;
  const parts=location.pathname.split('/').filter(Boolean);
  const buildIndex=parts.indexOf('_builds');
  if(buildIndex>=0&&parts[buildIndex+1])return parts[buildIndex+1];
  const repoIndex=parts.indexOf('CONQUER');
  return repoIndex>=0&&parts[repoIndex+1]?parts[repoIndex+1]:'main';
}
function localStorageKey(){
  const pagesBranch=localStorageBranch();
  return pagesBranch
    ?`conquer.pages.${pagesBranch}.schema${LOCAL_STORAGE_SCHEMA}.settlement.0.0`
    :'conquer.settlement.0.0';
}
let localSaveTimer=null;
function saveLocal(){
  const t0=performance.now();
  localStorage.setItem(localStorageKey(),JSON.stringify({schema:LOCAL_STORAGE_SCHEMA,seed:State.seed,biome:State.biome,season:State.season,seasonOverride:State.seasonOverride||null,neighborBiomes:State.neighborBiomes,landscape:{version:LANDSCAPE_GENERATION_VERSION,relief:State.relief,environment:State.environment},structures:State.structures,resources:State.resources,policies:State.policies,village:State.village,clock:{day:State.clock.day,speed:0},view:State.view}));
  if(window.__conquerPerf)window.__conquerPerf.lastSaveMs=performance.now()-t0;
}
function scheduleLocalSave(delay=700){
  if(localSaveTimer)return;
  localSaveTimer=setTimeout(()=>{localSaveTimer=null;saveLocal()},delay);
}
function loadLocal(){try{const key=localStorageKey();const x=JSON.parse(localStorage.getItem(key)||'null');if(x){State.seed=x.seed??State.seed;State.biome=BIOMES[x.biome]?x.biome:State.biome;State.season=['summer','autumn','winter','spring'].includes(x.season)?x.season:'summer';State.seasonOverride=['summer','autumn','winter','spring'].includes(x.seasonOverride)?x.seasonOverride:null;State.neighborBiomes=x.neighborBiomes||{};State.structures=migrateStructures(x.structures);State.resources={...State.resources,...x.resources};for(const k of Object.keys(State.resources))State.resources[k]=Math.max(10000,Number(State.resources[k])||0);if(x.view&&Number.isFinite(x.view.rotation))State.view.rotation=((x.view.rotation%4)+4)%4;State.policies={...State.policies,...x.policies};const legacyGrowth=x.village?.growthVersion!==3;State.village={...State.village,...x.village};if(legacyGrowth)State.village.growthVersion=1;State.clock.day=Math.max(0,Number(x.clock?.day)||0);State.clock.speed=0;State.clock.lastSpeed=1;State.daylightOverride=null;resetLegacyVillageGrowth();const savedLandscape=x.landscape;if(savedLandscape?.version===LANDSCAPE_GENERATION_VERSION&&Array.isArray(savedLandscape.relief?.hills)&&Array.isArray(savedLandscape.environment)){State.relief=savedLandscape.relief;State.environment=savedLandscape.environment;clearReliefBandCache()}else{State.relief=null;State.environment=[];ensureStaticLandscape();saveLocal()}rebuildSecondaryRoadsOnLoad();reconcileReactiveRoadNetwork();syncCompletedTowerWallColliders(true);reconcileGateMainConnections(true);reconcileSettlementAccessRoads(Infinity,true);invalidateSceneCache();['tax','rations','levy'].forEach(k=>document.getElementById(k).value=State.policies[k])}}catch(err){console.warn('Local state ignored',err);}}
async function initSupabase(){for(let i=0;i<30&&!window.__createSupabaseClient;i++)await new Promise(r=>setTimeout(r,50));if(!window.__createSupabaseClient)return;State.supabase=window.__createSupabaseClient(SUPABASE_URL,SUPABASE_KEY);const {data}=await State.supabase.auth.getSession();State.user=data?.session?.user||null;if(State.user){document.getElementById('dbNote').textContent='Supabase authenticated — cloud save enabled.';document.getElementById('saveState').textContent='cloud ready';await loadCloud()}else document.getElementById('dbNote').textContent='Local autosave active. Sign-in can be added next; RLS already protects cloud rows.'}
async function loadCloud(){if(!State.user)return;const {data,error}=await State.supabase.from('settlements').select('*').eq('world_cell_x',0).eq('world_cell_y',0).maybeSingle();if(error){console.warn(error);return}if(data){State.seed=data.terrain_seed;State.biome=BIOMES[data.biome]?data.biome:State.biome;State.neighborBiomes=data.neighbor_biomes||{};State.structures=migrateStructures(data.structures);State.resources={...State.resources,...data.resources};for(const k of Object.keys(State.resources))State.resources[k]=Math.max(10000,Number(State.resources[k])||0);if(data.camera&&Number.isFinite(data.camera.rotation))State.view.rotation=((data.camera.rotation%4)+4)%4;const cloudPolicies=data.policies||{};State.policies={...State.policies,tax:cloudPolicies.tax??State.policies.tax,rations:cloudPolicies.rations??State.policies.rations,levy:cloudPolicies.levy??State.policies.levy};State.season=['summer','autumn','winter','spring'].includes(cloudPolicies.season)?cloudPolicies.season:'summer';State.seasonOverride=['summer','autumn','winter','spring'].includes(cloudPolicies.seasonOverride)?cloudPolicies.seasonOverride:null;const legacyGrowth=cloudPolicies.village?.growthVersion!==3;State.village={...State.village,...(cloudPolicies.village||{})};if(legacyGrowth)State.village.growthVersion=1;State.clock.day=Math.max(0,Number(cloudPolicies.clock?.day)||State.clock.day);resetLegacyVillageGrowth();const cloudLandscape=cloudPolicies.landscape;let repairedLandscape=false;if(cloudLandscape?.version===LANDSCAPE_GENERATION_VERSION&&Array.isArray(cloudLandscape.relief?.hills)&&Array.isArray(cloudLandscape.environment)){State.relief=cloudLandscape.relief;State.environment=cloudLandscape.environment;clearReliefBandCache();repairedLandscape=repairForestsAgainstSteepSlopes()}else{State.relief=null;State.environment=[];ensureStaticLandscape();repairedLandscape=true}rebuildSecondaryRoadsOnLoad();reconcileReactiveRoadNetwork();syncCompletedTowerWallColliders(true);reconcileGateMainConnections(true);reconcileSettlementAccessRoads(Infinity,true);invalidateSceneCache();if(repairedLandscape)await saveCloud();else saveLocal();renderUI();renderFunctionPanel();draw()}}
async function saveCloud(){saveLocal();if(!State.user){document.getElementById('saveState').textContent='saved local';State.dirty=false;return}const payload={user_id:State.user.id,world_cell_x:0,world_cell_y:0,terrain_seed:State.seed,biome:State.biome,neighbor_biomes:State.neighborBiomes,resources:State.resources,policies:{...State.policies,season:State.season,seasonOverride:State.seasonOverride||null,village:State.village,clock:{day:State.clock.day},landscape:{version:LANDSCAPE_GENERATION_VERSION,relief:State.relief,environment:State.environment}},structures:State.structures,camera:State.view,updated_at:new Date().toISOString()};const {error}=await State.supabase.from('settlements').upsert(payload,{onConflict:'user_id,world_cell_x,world_cell_y'});if(error){document.getElementById('saveState').textContent='cloud error';console.error(error)}else{State.dirty=false;document.getElementById('saveState').textContent='saved cloud'}}
document.getElementById('saveBtn').onclick=saveCloud;
const CALENDAR_MONTHS=[
  {name:'Gen',days:31},{name:'Feb',days:28},{name:'Mar',days:31},{name:'Apr',days:30},
  {name:'Mag',days:31},{name:'Giu',days:30},{name:'Lug',days:31},{name:'Ago',days:31},
  {name:'Set',days:30},{name:'Ott',days:31},{name:'Nov',days:30},{name:'Dic',days:31}
];
const CALENDAR_EPOCH_DAY_OF_YEAR=151; // Day 0 = 1 June, Year 1.
function calendarDateFromDay(day=State.clock.day){
  const absolute=Math.max(0,Math.floor(Number(day)||0))+CALENDAR_EPOCH_DAY_OF_YEAR;
  const year=Math.floor(absolute/365)+1;
  let dayOfYear=absolute%365,month=0;
  while(month<CALENDAR_MONTHS.length-1&&dayOfYear>=CALENDAR_MONTHS[month].days){
    dayOfYear-=CALENDAR_MONTHS[month].days;
    month++;
  }
  return{year,month,day:dayOfYear+1,name:CALENDAR_MONTHS[month].name};
}
function seasonForMonth(month){
  if(month===11||month<=1)return'winter';
  if(month<=4)return'spring';
  if(month<=7)return'summer';
  return'autumn';
}
function syncSeasonToCalendar(){
  const next=State.seasonOverride||seasonForMonth(calendarDateFromDay().month);
  if(State.season===next)return false;
  State.season=next;
  document.querySelectorAll('[data-season]').forEach(b=>b.classList.toggle('active',b.dataset.season===State.seasonOverride));
  invalidateSceneCache('base');
  return true;
}
function renderUI(){syncSeasonToCalendar();const cal=calendarDateFromDay();document.getElementById('seedLabel').textContent=State.seed;document.getElementById('villageLabel').textContent=State.village.name||'—';document.getElementById('biomeLabel').textContent=BIOMES[State.biome]?.label||State.biome;document.getElementById('biomeSelect').value=State.biome;document.getElementById('dayLabel').textContent=`${cal.day} ${cal.name} · Y${cal.year} · Day ${State.clock.day.toFixed(1)}`;document.querySelectorAll('[data-season]').forEach(b=>b.classList.toggle('active',b.dataset.season===State.seasonOverride));const icons={gold:'🪙',population:'👥',food:'🌾',wood:'🪵',stone:'🪨',metal:'⛓',equipment:'⚔'};document.getElementById('resources').innerHTML=Object.entries(State.resources).map(([k,v])=>`<span class="res">${icons[k]||''} ${k} <b>${v}</b></span>`).join('')}
function visibleCanvasCenter(){
  const r=canvas.getBoundingClientRect();
  return{x:r.width/2,y:r.height/2};
}
function rotateCamera(delta){
  const pivot=visibleCanvasCenter(),anchor=s2w(pivot.x,pivot.y);
  State.view.rotation=((State.view.rotation||0)+delta+4)%4;
  const after=w2s(anchor);
  State.view.x+=pivot.x-after.x;State.view.y+=pivot.y-after.y;
  State.draft=null;invalidateSceneCache();saveLocal();draw();status('View rotation: '+(State.view.rotation*90)+'°');
}
function panCamera(dx,dy){
  State.view.x+=dx;State.view.y+=dy;invalidateSceneCache();saveLocal();draw();
}
function setTimeSpeed(speed){
  speed=Number(speed)||0;
  if(speed>0)State.clock.lastSpeed=speed;
  else if(State.clock.speed>0)State.clock.lastSpeed=State.clock.speed;
  State.clock.speed=speed;
  document.querySelectorAll('[data-speed]').forEach(x=>x.classList.toggle('active',Number(x.dataset.speed)===speed));
  status(speed===0?'Time paused':`Time ×${speed}`);
}
function togglePause(){
  if(State.clock.speed>0)setTimeSpeed(0);
  else setTimeSpeed(State.clock.lastSpeed||1);
}
function syncDevButtons(){
  document.querySelectorAll('[data-season]').forEach(b=>b.classList.toggle('active',b.dataset.season===State.seasonOverride));
  document.querySelectorAll('[data-light-override]').forEach(b=>b.classList.toggle('active',b.dataset.lightOverride===State.daylightOverride));
  document.querySelectorAll('[data-weather-override]').forEach(b=>b.classList.toggle('active',b.dataset.weatherOverride===State.weatherOverride));
}
function renderUI(){syncSeasonToCalendar();const cal=calendarDateFromDay();document.getElementById('seedLabel').textContent=State.seed;document.getElementById('villageLabel').textContent=State.village.name||'—';document.getElementById('biomeLabel').textContent=BIOMES[State.biome]?.label||State.biome;document.getElementById('biomeSelect').value=State.biome;document.getElementById('dayLabel').textContent=`${cal.day} ${cal.name} · Y${cal.year} · Day ${State.clock.day.toFixed(1)}`;syncDevButtons();const icons={gold:'🪙',population:'👥',food:'🌾',wood:'🪵',stone:'🪨',metal:'⛓',equipment:'⚔'};document.getElementById('resources').innerHTML=Object.entries(State.resources).map(([k,v])=>`<span class="res">${icons[k]||''} ${k} <b>${v}</b></span>`).join('')}
function visibleCanvasCenter(){
  const r=canvas.getBoundingClientRect();
  return{x:r.width/2,y:r.height/2};
}
function rotateCamera(delta){
  const pivot=visibleCanvasCenter(),anchor=s2w(pivot.x,pivot.y);
  State.view.rotation=((State.view.rotation||0)+delta+4)%4;
  const after=w2s(anchor);
  State.view.x+=pivot.x-after.x;State.view.y+=pivot.y-after.y;
  State.draft=null;invalidateSceneCache();saveLocal();draw();status('View rotation: '+(State.view.rotation*90)+'°');
}
function panCamera(dx,dy){
  State.view.x+=dx;State.view.y+=dy;invalidateSceneCache();saveLocal();draw();
}
function setTimeSpeed(speed){
  speed=Number(speed)||0;
  if(speed>0)State.clock.lastSpeed=speed;
  else if(State.clock.speed>0)State.clock.lastSpeed=State.clock.speed;
  State.clock.speed=speed;
  document.querySelectorAll('[data-speed]').forEach(x=>x.classList.toggle('active',Number(x.dataset.speed)===speed));
  status(speed===0?'Time paused':`Time ×${speed}`);
}
function togglePause(){
  if(State.clock.speed>0)setTimeSpeed(0);
  else setTimeSpeed(State.clock.lastSpeed||1);
}
function setLightOverride(mode){
  State.daylightOverride=State.daylightOverride===mode?null:mode;
  syncDevButtons();
  status(State.daylightOverride?('FORCE LIGHT: '+State.daylightOverride):'Luce: procedurale');
  draw();
}
function setWeatherOverride(kind){
  if(!['rain','snow','storm','wind'].includes(kind))return;
  State.weatherOverride=State.weatherOverride===kind?null:kind;
  weatherCacheKey='';weatherCacheValue=null;cloudLayerKey='';
  syncDevButtons();
  status(State.weatherOverride?('FORCE METEO: '+State.weatherOverride):'Meteo: procedurale');
  drawWeatherOverlay();
}
function setSeason(season){
  if(!['summer','autumn','winter','spring'].includes(season))return;
  const labels={summer:'Estate',autumn:'Autunno',winter:'Inverno',spring:'Primavera'};
  State.seasonOverride=State.seasonOverride===season?null:season;
  State.season=State.seasonOverride||seasonForMonth(calendarDateFromDay().month);
  syncDevButtons();
  weatherCacheKey='';weatherCacheValue=null;cloudLayerKey='';
  invalidateSceneCache('base');saveLocal();draw();
  drawWeatherOverlay();
  status(State.seasonOverride?'FORCE SEASON: '+labels[State.seasonOverride]+' — clicca di nuovo per tornare al calendario':'Stagione: calendario automatico');
}
function ensureDevControls(){
  document.querySelectorAll('[data-season]').forEach(b=>b.onclick=()=>setSeason(b.dataset.season));
  document.querySelectorAll('[data-light-override]').forEach(b=>b.onclick=()=>setLightOverride(b.dataset.lightOverride));
  document.querySelectorAll('[data-weather-override]').forEach(b=>b.onclick=()=>setWeatherOverride(b.dataset.weatherOverride));
  const toggle=document.getElementById('devToggle'),panel=document.getElementById('devPanel');
  if(toggle&&panel)toggle.onclick=()=>{
    const open=panel.hidden;
    panel.hidden=!open;
    toggle.setAttribute('aria-expanded',String(open));
    toggle.textContent=open?'DEV ▴':'DEV ▾';
  };
  syncDevButtons();
}
function freshLandscapeSeed(){
  if(window.crypto?.getRandomValues){
    const n=new Uint32Array(1);crypto.getRandomValues(n);
    return Math.max(1,n[0]&0x7fffffff);
  }
  return Math.max(1,Math.floor(Math.random()*2147483647));
}
function generateNewMap(){
  State.clock.speed=0;
  State.draft=null;State.selectedId=null;
  State.seed=freshLandscapeSeed();
  localStorage.setItem('conquer.seed.0.0',String(State.seed));

  // True new-map reset: nothing from the previous settlement survives.
  State.relief=null;
  State.environment=[];
  State.structures=[];
  State.pendingWellId=null;
  State.selectedId=null;
  State.draft=null;
  State.village={
    name:null,wellId:null,founded:false,growthVersion:3,accessRoadVersion:0,
    growthStep:0,nextGrowthDay:null,roadPlan:null,baseRoadAngle:null
  };
  peasantPathCache.clear();
  peasantPathSignature='';
  fieldWorkAssignmentCache={key:null,map:new Map()};

  clearReliefBandCache();
  generateRelief();
  generateEnvironment();
  invalidateNavigation(false);
  invalidateSceneCache();
  saveLocal();
  markDirty();
  renderUI();
  renderFunctionPanel();
  draw();

  const stats=State.relief?.stats||reliefStats();
  const pct=n=>Math.round((Number(n)||0)*100);
  const steepLevels=[1,2,3,4,5]
    .filter(h=>stats.steepByLevel?.[h])
    .map(h=>`H${h} ${pct(stats.steepByLevel[h].ratio)}%`)
    .join(' · ');
  const l1Gap=stats.minL1Gap==null?'—':Number(stats.minL1Gap).toFixed(1)+'U';
  status(`Nuova mappa · seed ${State.seed} · colline ${pct(stats.coverage)}% · ${steepLevels} · multi ${pct(stats.multiRatio)}% · edge max ${Number(stats.maxEdge||0).toFixed(1)}U · L1 gap ${l1Gap}`);
}
document.getElementById('newMapBtn').onclick=generateNewMap;
document.getElementById('rotateLeft').onclick=()=>rotateCamera(-1);
document.getElementById('rotateRight').onclick=()=>rotateCamera(1);
document.getElementById('biomeSelect').onchange=e=>{
  State.biome=BIOMES[e.target.value]?e.target.value:'plains';State.environment=[];generateEnvironment();
  State.structures=State.structures.filter(s=>!s.auto);
  if(State.village.founded){State.village.growthStep=0;State.village.nextGrowthDay=State.clock.day+.75;State.village.roadPlan=null;State.village.baseRoadAngle=null}
  markDirty();renderUI();status('Biome: '+BIOMES[State.biome].label+' — automatic settlement growth reset');draw();
};
document.querySelectorAll('[data-speed]').forEach(b=>b.onclick=()=>setTimeSpeed(Number(b.dataset.speed)));
ensureDevControls();
let simLast=performance.now(),simPersistAt=performance.now(),simDrawAt=0,simMaintenanceAt=0,simUiAt=0,weatherDrawAt=0,weatherLayerActive=false;
const VISUAL_FRAME_MS=1000/30;
const WEATHER_FRAME_MS=1000/24;
const MAINTENANCE_WATCHDOG_MS=2500;
const LOCAL_AUTOSAVE_MS=5000;
function constructionCompletionCrossed(beforeDay,afterDay){
  for(const s of State.structures){
    const d=Number(s?.construction?.completeDay);
    if(Number.isFinite(d)&&d>beforeDay&&d<=afterDay)return true;
  }
  return false;
}
function runSettlementMaintenance(reason='watchdog'){
  const t0=performance.now();
  let changed=0;
  changed+=syncCompletedTowerWallColliders(false);
  changed+=reconcileGateMainConnections(false);
  changed+=reconcileTowerSecondaryBranches();
  changed+=reconcileSettlementAccessRoads();

  if(reason==='completion'){
    // A completed road/building has entered the static world and/or navigation graph.
    invalidateNavigation(false);
    fieldWorkAssignmentCache={key:null,map:new Map()};
    invalidateSceneCache();
  }else if(changed){
    // Watchdog repairs only invalidate when they actually mutate topology.
    invalidateSceneCache();
  }

  if(window.__conquerPerf){
    window.__conquerPerf.lastMaintenanceMs=performance.now()-t0;
    window.__conquerPerf.maintenanceRuns=(window.__conquerPerf.maintenanceRuns||0)+1;
  }
  return changed;
}
function simulationFrame(now){
  const dt=Math.min(.25,(now-simLast)/1000);simLast=now;
  if(State.clock.speed>0){
    const before=State.clock.day;
    State.clock.day+=dt*BASE_DAYS_PER_SECOND*State.clock.speed;
    if(syncSeasonToCalendar())scheduleLocalSave(100);

    processVillageGrowth();

    // Maintenance follows actual topology events, NOT simulated quarter-days.
    const completed=constructionCompletionCrossed(before,State.clock.day);
    if(completed){
      runSettlementMaintenance('completion');
      simMaintenanceAt=now;
    }else if(now-simMaintenanceAt>=MAINTENANCE_WATCHDOG_MS){
      runSettlementMaintenance('watchdog');
      simMaintenanceAt=now;
    }

    if(now-simUiAt>=250){
      renderUI();
      simUiAt=now;
    }

    if(now-simDrawAt>=VISUAL_FRAME_MS){
      const t0=performance.now();
      draw();
      const drawMs=performance.now()-t0;
      if(window.__conquerPerf){
        window.__conquerPerf.lastDrawMs=drawMs;
        window.__conquerPerf.maxDrawMs=Math.max(window.__conquerPerf.maxDrawMs||0,drawMs);
        if(drawMs>50)window.__conquerPerf.longDraws=(window.__conquerPerf.longDraws||0)+1;
      }
      simDrawAt=now;
    }

    // JSON.stringify + localStorage are synchronous. Keep them far away from
    // the 10× growth cadence instead of blocking every second.
    if(now-simPersistAt>=LOCAL_AUTOSAVE_MS){
      saveLocal();
      simPersistAt=now;
    }
  }
  const weather=currentWeather();
  const weatherActive=State.view.scale<WEATHER_ZOOM_THRESHOLD||weather.wind>.15||weather.rain>0||weather.snow>0||weather.lightning>0;
  if(weatherActive&&now-weatherDrawAt>=WEATHER_FRAME_MS){
    drawWeatherOverlay(now);
    weatherDrawAt=now;
    weatherLayerActive=true;
  }else if(!weatherActive&&weatherLayerActive){
    clearWeatherOverlay();
    weatherLayerActive=false;
  }
  requestAnimationFrame(simulationFrame);
}
requestAnimationFrame(simulationFrame);
window.addEventListener('keydown',e=>{
  const tag=e.target?.tagName?.toLowerCase(),typing=tag==='input'||tag==='select'||tag==='textarea'||e.target?.isContentEditable;
  if(typing)return;
  const k=e.key.toLowerCase();
  if(e.code==='Space'){e.preventDefault();togglePause();return}
  if(k==='q'){e.preventDefault();rotateCamera(-1);return}
  if(k==='e'){e.preventDefault();rotateCamera(1);return}
  const panStep=e.shiftKey?72:36;
  if(k==='w'){e.preventDefault();panCamera(0,panStep);return}
  if(k==='s'&&!e.ctrlKey&&!e.metaKey){e.preventDefault();panCamera(0,-panStep);return}
  if(k==='a'){e.preventDefault();panCamera(panStep,0);return}
  if(k==='d'){e.preventDefault();panCamera(-panStep,0);return}
  if(e.key==='Escape'){if(document.getElementById('foundVillageModal').classList.contains('open')){document.getElementById('cancelVillageBtn').click();return}State.draft=null;State.selectedId=null;renderFunctionPanel();setTool({kind:'select',label:'Select'});draw();return}
  if(e.key==='Delete'&&State.selectedId){deleteStructure(State.selectedId);return}
  if((e.ctrlKey||e.metaKey)&&k==='s'){e.preventDefault();saveCloud()}
});
window.addEventListener('polygon-clipping-ready',()=>draw());
window.addEventListener('resize',resize);loadLocal();if(ensureStaticLandscape())saveLocal();renderUI();resize();fit();initSupabase();
