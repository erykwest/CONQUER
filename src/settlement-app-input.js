'use strict';
// Pointer/canvas interactions and build tool controls. Extracted verbatim from settlement-app.js.
canvas.addEventListener('pointerdown',e=>{
  if(e.button===1||e.button===2){
    pan={x:e.clientX,y:e.clientY,vx:State.view.x,vy:State.view.y};
    sceneCachePanPreview=true;
    canvas.setPointerCapture(e.pointerId);
    return
  }
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
  if(State.tool.kind==='civicAnnex'){
    const parent=State.structures.find(x=>x.id===State.tool.parentId);
    if(!parent){status('Parent building no longer exists');setTool({kind:'select',label:'Select'});return}
    const q={x:snapGrid(p.x),y:snapGrid(p.y)};
    const annex=makeCivicAnnex(parent,State.tool.annexType,q.x,q.y);
    if(annex&&addStructure(annex))setTool({kind:'select',label:'Annex placed · select'});
    return;
  }
  if(State.tool.kind==='tower'){
    const snap=towerPlacementSnap(p),q=snap.point;
    if(State.tool.shape==='round'){
      State.draft=null;
      addTowerWithPlacement(
        {id:uid(),type:'tower',shape:'round',material:State.tool.material||'stone',masonryMaterial:State.buildMasonryMaterial,x:q.x,y:q.y,r:State.tool.size,level:State.tool.level||State.buildLevels.tower,functions:[]},
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
  if(State.tool.kind==='civic'||State.tool.kind==='industry'){
    // Two-click oriented placement shared by all point buildings:
    // first click fixes the centre, pointer movement rotates the ghost,
    // second click commits the final angle.
    const q={x:snapGrid(p.x),y:snapGrid(p.y)};
    State.draft={mode:'orient',center:q,angle:0,preview:makePlacementPreview(q,0)};
    status(structureLabel(State.draft.preview)+' position fixed — move cursor to rotate, click to confirm');draw();return
  }
  if(State.tool.kind==='well'){
    if(State.village.founded||State.structures.some(s=>s.type==='well')){status('This settlement already has a village well');return}
    const q={x:snapGrid(p.x),y:snapGrid(p.y)},well={id:uid(),type:'well',masonryMaterial:State.buildMasonryMaterial,x:q.x,y:q.y};
    if(addStructure(well))openVillageModal(well);return
  }
  if(State.tool.kind==='crossing'){
    const moat=['dry','water'].includes(State.tool.crossing);
    const magnet=moat?window.ConquerCrossings?.snapMoatEndpoint(p,sp):null;
    const q=magnet?.point||{x:snapGrid(p.x),y:snapGrid(p.y)};
    if(!State.draft){
      State.draft={a:{...q},aSnap:magnet?.structureId||null,
        aGroundZ:magnet?.groundZ??terrainElevation(q),preview:null};
      status(magnet?'⛓ Moat magnet A — choose next endpoint':'Crossing: bank A fixed — click bank B');
      draw();
    }else{
      const a=State.draft.a,b={...q};
      if(moat&&dist(a,b)<.20){
        State.draft=null;
        State.tool.moatHover=null;
        status('Moat chain stopped — click anywhere to start another');
        draw();return;
      }
      const crossing={id:uid(),type:moat?'moat':'bridge',masonryMaterial:State.buildMasonryMaterial,
        variant:State.tool.crossing,a:{...a},b,width:State.tool.width};
      if(moat){
        crossing.aSnap=State.draft.aSnap||null;
        crossing.bSnap=magnet?.structureId||null;
      }
      if(window.ConquerCrossings?.add(crossing)){
        if(moat){
          // The next segment begins exactly where the previous one ended.
          // Escape / clicking the current origin stops the chain.
          State.draft={a:{...crossing.b},aSnap:crossing.id,
            aGroundZ:crossing.groundZ,preview:null};
          State.tool.moatHover=null;
          status(magnet?'⛓ Moats connected — choose next endpoint (Esc to finish)':
            '⛓ Moat continued — choose next endpoint (Esc to finish)');
        }else{
          State.draft=null;
          status('Bridge placed — choose next bank A');
        }
        draw();
      }
    }
    return;
  }
  if(State.tool.kind==='linear'){
    const mainRoad=State.tool.linear==='road',snapFn=mainRoad?mainRoadSnapAnchor:snapAnchor;
    if(!State.draft){
      const s=snapFn(p);
      State.draft={a:s.point,aSnap:s.structureId||null,preview:null,previewSegments:null};
      status(mainRoad?'Main road: point A set — choose point B':'Point A set — choose point B');
      draw();
    }else{
      const e2=snapFn(p),spec=currentLinearSpec();
      if(mainRoad){
        const n=normalizeLinear(State.draft.a,e2.point,spec,false);
        if(n&&n.length>=spec.min-.001){
          if(addManualMainRoad(n.a,n.b)){
            State.draft=null;
            status('Main road added — choose next segment');
          }
        }else status('Segment too short');
      }else{
        const route=normalizeStructuralLinearRoute(State.draft.a,e2.point,spec,!!e2.structureId);
        if(route&&route.segments.length&&route.segments.every(seg=>seg.length>=.24)){
          const legs=route.segments.length;
          if(commitStructuralLinearRoute(route,e2.structureId||null,spec)){
            State.draft=null;
            status(legs===2?State.tool.label+' added · automatic 15° joint':State.tool.label+' ready for next segment');
          }
        }else status(e2.structureId?'No valid two-segment 15° route to this magnet':'Segment too short');
      }
    }
  }
});
let panFrame=0,panPending=null;
function flushCanvasPan(){
  panFrame=0;
  if(!pan||!panPending)return;
  const {clientX,clientY}=panPending;
  panPending=null;
  State.view.x=pan.vx+clientX-pan.x;
  State.view.y=pan.vy+clientY-pan.y;
  draw();
}
canvas.addEventListener('pointermove',e=>{
  if(pan){
    panPending={clientX:e.clientX,clientY:e.clientY};
    if(!panFrame)panFrame=requestAnimationFrame(flushCanvasPan);
    return
  }
  const p=pointerWorld(e);
  if(State.tool.kind==='crossing'){
    const moat=['dry','water'].includes(State.tool.crossing);
    const snap=moat?window.ConquerCrossings?.snapMoatEndpoint(p,pointerScreen(e)):null;
    State.tool.moatHover=snap||null;
    if(!State.draft){
      // Show magnets before the first click as well.
      if(moat)draw();
      return;
    }
    const a=State.draft.a,b=snap?.point||{x:snapGrid(p.x),y:snapGrid(p.y)};
    const type=moat?'moat':'bridge';
    const preview={type,variant:State.tool.crossing,masonryMaterial:State.buildMasonryMaterial,a,b,width:State.tool.width,length:dist(a,b)};
    State.draft.preview=preview.length>=.02?preview:null;
    const error=window.ConquerCrossings?.validate({...preview});
    status(moat&&snap&&dist(a,b)<.20?'Click start point to end this moat chain':
      error||((snap?'⛓ Magnet · ':'')+type+' '+preview.length.toFixed(1)+'U · flat level banks'));
    draw();return;
  }
  if(State.tool.kind==='linear'&&State.draft){
    const mainRoad=State.tool.linear==='road',snap=(mainRoad?mainRoadSnapAnchor:snapAnchor)(p),spec=currentLinearSpec();
    if(mainRoad){
      const n=normalizeLinear(State.draft.a,snap.point,spec,false);
      if(n){
        State.draft.preview={type:State.tool.linear,width:spec.width,a:n.a,b:n.b,length:n.length,manualMain:true};
        State.draft.previewSegments=null;State.draft.invalidPreview=null;
        const verdict=window.ConquerPlacement?.check(State.draft.preview);
        status(verdict&&!verdict.ok?'Road blocked: '+verdict.reason:`Main road: ${n.length.toFixed(2)}U — click to confirm`);
        draw();
      }else{
        State.draft.preview=null;State.draft.invalidPreview={type:'road',a:State.draft.a,b:snap.point,width:spec.width};draw();
      }
      return;
    }

    const route=normalizeStructuralLinearRoute(State.draft.a,snap.point,spec,!!snap.structureId);
    if(route){
      const base={type:State.tool.linear,width:spec.width,masonryMaterial:State.buildMasonryMaterial,level:State.tool.level||State.buildLevels.wall,tier:['wall','palisade'].includes(State.tool.linear)?(State.tool.tier||State.buildLevels.wallTier):undefined};
      State.draft.invalidPreview=null;
      State.draft.preview=null;
      State.draft.previewSegments=route.segments.map(seg=>({...base,a:seg.a,b:seg.b,length:seg.length,rotationStep:seg.rotationStep}));
      const previewCost=aggregateConstructionCost(State.draft.previewSegments);
      const legs=route.segments.length,total=route.length;
      status(`${State.tool.label}: ${total.toFixed(2)}U · ${legs===2?'2×15° legs · auto joint':'15°'} · ${costText(previewCost)} — click to confirm`);
    }else{
      State.draft.preview=null;State.draft.previewSegments=null;
      State.draft.invalidPreview={type:State.tool.linear,a:State.draft.a,b:snap.point,width:spec.width,length:dist(State.draft.a,snap.point)};
      status(snap.structureId?'No valid two-segment 15° route to this magnet':'Segment too short');
    }
    draw();
    return
  }
  if(State.tool.kind==='civicAnnex'){
    const parent=State.structures.find(x=>x.id===State.tool.parentId);
    if(!parent){State.draft=null;draw();return}
    const q={x:snapGrid(p.x),y:snapGrid(p.y)},ghost=makeCivicAnnex(parent,State.tool.annexType,q.x,q.y);
    State.draft={mode:'hover',preview:ghost};
    const verdict=window.ConquerPlacement?.check(ghost);
    if(verdict&&!verdict.ok)status('Annex blocked: '+verdict.reason);
    draw();return;
  }
  const oriented=orientedToolSpec();
  if(oriented){
    if(State.draft?.mode==='orient'){
      const angle=Number.isFinite(State.draft.lockedAngle)?State.draft.lockedAngle:placementAngle(State.draft.center,p);
      State.draft.angle=angle;State.draft.preview=makePlacementPreview(State.draft.center,angle);
      const ghost=window.ConquerPlacement?.check({...State.draft.preview,parentTowerId:State.draft.parentTowerId||null,wallSnapId:State.draft.wallSnapId||null});
      let deg=Math.round(angle*180/Math.PI);if(deg<0)deg+=360;
      status(ghost&&!ghost.ok?'Placement blocked: '+ghost.reason:State.draft.wallSnapId?`Wall snap · aligned ${deg}° — click to confirm`:`Rotate: ${deg}° — click to confirm`);
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
      const ghost=window.ConquerPlacement?.check(State.draft.preview);
      if(ghost&&!ghost.ok)status('Placement blocked: '+ghost.reason);
    }
    draw();return
  }
  if(State.tool.kind==='well'){
    const q={x:snapGrid(p.x),y:snapGrid(p.y)};
    State.draft={mode:'hover',preview:{type:'well',masonryMaterial:State.buildMasonryMaterial,x:q.x,y:q.y}};
    draw();return;
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
  if(panPending){
    State.view.x=pan.vx+panPending.clientX-pan.x;
    State.view.y=pan.vy+panPending.clientY-pan.y;
    panPending=null;
  }
  if(panFrame){cancelAnimationFrame(panFrame);panFrame=0}
  pan=null;
  sceneCachePanPreview=false;
  // During drag the static bitmap is translated cheaply. Rasterize once at
  // the final camera so subsequent frames have full coverage and zero offset.
  invalidateSceneCache();
  scheduleLocalSave(500);
  draw();
}
canvas.addEventListener('pointerup',finishCanvasPan);
canvas.addEventListener('pointercancel',finishCanvasPan);
canvas.addEventListener('contextmenu',e=>e.preventDefault());
let zoomFrame=0,zoomSettleTimer=0,zoomWheelDelta=0,zoomAnchor=null;
function flushWheelZoom(){
  zoomFrame=0;
  if(!zoomAnchor||!zoomWheelDelta)return;
  const {sx,sy,before}=zoomAnchor;
  const steps=clamp(zoomWheelDelta/100,-3,3);
  const factor=Math.pow(1.12,-steps);
  zoomWheelDelta=0;
  State.view.scale=clamp(State.view.scale*factor,.2,10);
  const after=w2s(before);
  State.view.x+=sx-after.x;State.view.y+=sy-after.y;
  sceneCacheZoomPreview=true;
  draw();
  if(State.view.scale>=WEATHER_ZOOM_THRESHOLD)clearWeatherCloudLayer();
  clearTimeout(zoomSettleTimer);
  zoomSettleTimer=setTimeout(()=>{
    sceneCacheZoomPreview=false;
    zoomAnchor=null;
    invalidateSceneCache();
    draw();
    drawWeatherOverlay();
    scheduleLocalSave(500);
  },120);
}
canvas.addEventListener('wheel',e=>{
  e.preventDefault();
  const r=canvas.getBoundingClientRect(),sx=e.clientX-r.left,sy=e.clientY-r.top;
  if(!sceneCacheZoomPreview||!zoomAnchor)zoomAnchor={sx,sy,before:s2w(sx,sy)};
  else{
    // Keep the world point under the latest cursor position stable even when
    // a trackpad changes direction during one continuous gesture.
    zoomAnchor={sx,sy,before:s2w(sx,sy)};
  }
  zoomWheelDelta+=e.deltaY;
  if(!zoomFrame)zoomFrame=requestAnimationFrame(flushWheelZoom);
},{passive:false});
function setBuildMasonryMaterial(next){
  if(!['stone','brick'].includes(next)||next===State.buildMasonryMaterial)return;
  State.buildMasonryMaterial=next;
  if(State.draft?.preview){State.draft.preview.masonryMaterial=next;delete State.draft.preview._ghostCheck}
  if(State.draft?.previewSegments)for(const s of State.draft.previewSegments){s.masonryMaterial=next;delete s._ghostCheck}
  document.querySelectorAll('[data-build-masonry]').forEach(b=>{
    const active=b.dataset.buildMasonry===next;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));
  });
  scheduleLocalSave();draw();
  const preview=State.draft?.preview||State.draft?.previewSegments?.[0];
  status('Muratura nuovi cantieri: '+(next==='brick'?'MATTONI (argilla)':'PIETRA')+(preview?' · '+costText(State.draft?.previewSegments?aggregateConstructionCost(State.draft.previewSegments):constructionCost(preview)):''));
}
for(const b of document.querySelectorAll('[data-build-masonry]'))b.onclick=()=>setBuildMasonryMaterial(b.dataset.buildMasonry);
for(const b of document.querySelectorAll('[data-tool]'))b.onclick=()=>setTool({kind:b.dataset.tool,label:b.textContent.trim(),el:b});
for(const b of document.querySelectorAll('[data-tower]'))b.onclick=()=>{const level=State.buildLevels.tower,dummy={type:'tower',material:'stone',masonryMaterial:State.buildMasonryMaterial,shape:b.dataset.tower,level,...(b.dataset.tower==='round'?{r:Number(b.dataset.size)}:{size:Number(b.dataset.size)})};setTool({kind:'tower',material:'stone',shape:b.dataset.tower,size:Number(b.dataset.size),level,label:`${b.dataset.tower} tower ${b.dataset.size}U · L${level} · ${buildDuration(dummy).toFixed(0)}d · ${costText(constructionCost(dummy))}`,el:b})};
for(const b of document.querySelectorAll('[data-wood-tower]'))b.onclick=()=>{const style=b.dataset.woodTower,size=style==='watchtower'?1:1.5,woodRoof=style==='watchtower'?'pitched':'open',dummy={type:'tower',material:'wood',woodStyle:style,woodRoof,shape:'square',size,level:1};setTool({kind:'tower',material:'wood',woodStyle:style,woodRoof,shape:'square',size,level:1,label:`${style==='watchtower'?'Wood watchtower':'Wood tower'} · H1 · ${buildDuration(dummy).toFixed(1)}d · ${costText(constructionCost(dummy))}`,el:b})};
document.querySelector('[data-main-road]').onclick=e=>setTool({kind:'linear',linear:'road',label:'Main road — choose point A',el:e.currentTarget});
for(const b of document.querySelectorAll('[data-crossing]'))b.onclick=()=>{
  const variant=b.dataset.crossing;
  const width=Number(document.querySelector('[data-crossing-width].active')?.dataset.crossingWidth)||2;
  setTool({kind:'crossing',crossing:variant,width,label:(['dry','water'].includes(variant)?'Moat':'Bridge')+
    ' '+variant+' · 2 clicks · '+(variant==='water'?'H0 only':'level banks'),el:b});
};
for(const b of document.querySelectorAll('[data-crossing-width]'))b.onclick=()=>{
  const width=Number(b.dataset.crossingWidth);
  document.querySelectorAll('[data-crossing-width]').forEach(x=>x.classList.toggle('active',x===b));
  if(State.tool.kind==='crossing'){
    State.tool.width=width;State.draft=null;
    status('Crossing width: '+width+'U');draw();
  }
};
for(const b of document.querySelectorAll('[data-linear]'))b.onclick=()=>{const tier=State.buildLevels.wallTier,isPalisade=b.dataset.linear==='palisade',level=isPalisade?1:State.buildLevels.wall;setTool({kind:'linear',linear:b.dataset.linear,level,tier,label:(b.dataset.linear==='wall'?`Wall T${tier}`:isPalisade?`Palisade T${tier}`:'Built section')+(isPalisade?'':` L${level}`)+` — choose point A`,el:b})};
document.querySelectorAll('[data-tower-level]').forEach(b=>b.onclick=()=>{State.buildLevels.tower=Number(b.dataset.towerLevel);document.querySelectorAll('[data-tower-level]').forEach(x=>x.classList.toggle('active',x===b));if(State.tool.kind==='tower'&&State.tool.material!=='wood'){State.tool.level=State.buildLevels.tower;State.draft=null;status('Tower height: '+State.buildLevels.tower+' level'+(State.buildLevels.tower>1?'s':''));draw()}});
document.querySelectorAll('[data-wall-tier]').forEach(b=>b.onclick=()=>{State.buildLevels.wallTier=Number(b.dataset.wallTier);document.querySelectorAll('[data-wall-tier]').forEach(x=>x.classList.toggle('active',x===b));if(State.tool.kind==='linear'&&['wall','palisade'].includes(State.tool.linear)){State.tool.tier=State.buildLevels.wallTier;State.draft=null;status((State.tool.linear==='palisade'?'Palisade':'Wall')+' tier: T'+State.buildLevels.wallTier+' · '+wallWidthForTier(State.buildLevels.wallTier)+'U');draw()}});
document.querySelectorAll('[data-wall-level]').forEach(b=>b.onclick=()=>{State.buildLevels.wall=Number(b.dataset.wallLevel);document.querySelectorAll('[data-wall-level]').forEach(x=>x.classList.toggle('active',x===b));if(State.tool.kind==='linear'&&['wall','built'].includes(State.tool.linear)){State.tool.level=State.buildLevels.wall;State.draft=null;status('Wall height: '+State.buildLevels.wall+' level'+(State.buildLevels.wall>1?'s':''));draw()}});
document.querySelectorAll('[data-gate-level]').forEach(b=>b.onclick=()=>{
  if(State.tool.kind==='gate'&&State.tool.material==='wood'){
    document.querySelectorAll('[data-gate-level]').forEach(x=>x.classList.toggle('active',x.dataset.gateLevel==='1'));
    status('Wood gate height is fixed at H1');
    draw();return;
  }
  State.buildLevels.gate=Number(b.dataset.gateLevel);
  document.querySelectorAll('[data-gate-level]').forEach(x=>x.classList.toggle('active',x===b));
  if(State.tool.kind==='gate'){
    State.tool.level=State.buildLevels.gate;State.draft=null;
    const dummy={type:'gate',material:'stone',masonryMaterial:State.buildMasonryMaterial,level:State.buildLevels.gate};
    status('Gate height: L'+State.buildLevels.gate+' · '+buildDuration(dummy).toFixed(1)+'d');
    draw();
  }
});
document.querySelector('[data-gate]').onclick=e=>{
  const level=State.buildLevels.gate,dummy={type:'gate',material:'stone',masonryMaterial:State.buildMasonryMaterial,level};
  document.querySelectorAll('[data-gate-level]').forEach(x=>x.classList.toggle('active',Number(x.dataset.gateLevel)===level));
  setTool({kind:'gate',material:'stone',level,label:'Gate 1.5×1.5U · L'+level+' · '+buildDuration(dummy).toFixed(1)+'d · '+costText(constructionCost(dummy)),el:e.currentTarget});
};
document.querySelector('[data-wood-gate]').onclick=e=>{
  const dummy={type:'gate',material:'wood',w:1,h:1.5,level:1};
  document.querySelectorAll('[data-gate-level]').forEach(x=>x.classList.toggle('active',x.dataset.gateLevel==='1'));
  setTool({kind:'gate',material:'wood',level:1,label:'Wood gate 1.5×1U · H1 · door + battlements · '+buildDuration(dummy).toFixed(1)+'d · '+costText(constructionCost(dummy)),el:e.currentTarget});
};
for(const b of document.querySelectorAll('[data-civic]'))b.onclick=()=>{
  const type=b.dataset.civic,spec={type,shape:'civic'};
  setTool({kind:'civic',placementSpec:spec,label:structureLabel(spec)+' · '+BUILD_DAYS[type]+'d · '+costText(constructionCost({...spec,masonryMaterial:State.buildMasonryMaterial})),el:b});
};
for(const b of document.querySelectorAll('[data-industry]'))b.onclick=()=>{
   const type=b.dataset.industry,extractionMode=b.dataset.extractionMode==='clay'?'clay':'stone';
   const candidate=window.ConquerIndustries.make(type,{x:0,y:0},extractionMode);
   const spec=window.ConquerIndustries.definition(candidate);
   setTool({kind:'industry',industry:type,
     placementSpec:candidate,
     label:spec.name+' · '+spec.w+'×'+spec.h+'U · L'+spec.tier+' ×2 · 1 '+spec.good+'/worker/day · '+costText(constructionCost({...candidate,masonryMaterial:State.buildMasonryMaterial})),el:b});
 };
 document.querySelector('[data-well]').onclick=e=>setTool({kind:'well',label:'Village well · instant · '+costText(constructionCost({type:'well',masonryMaterial:State.buildMasonryMaterial})),el:e.currentTarget});
document.getElementById('confirmVillageBtn').onclick=()=>{
  const well=State.structures.find(s=>s.id===State.pendingWellId&&s.type==='well'),name=document.getElementById('villageNameInput').value.trim();
  if(!well)return closeVillageModal();if(!name){status('Enter a village name');document.getElementById('villageNameInput').focus();return}
  const borderEntries=ensureBorderEntrySelection();
  State.village={...State.village,name,wellId:well.id,founded:true,growthVersion:3,accessRoadVersion:0,growthStep:0,nextGrowthDay:null,roadPlan:null,roadPlanVersion:0,borderEntries,baseRoadAngle:null};
  closeVillageModal();
  connectBorderMainRoadsInFrames(mainSegments=>{
    markDirty(true,['ground','base']);
    renderUI();
    const connected=ensureRoadPlan().filter(r=>arterialRouteContinuous(r.id)).length;
    status(`${name} founded — ${connected}/4 border main roads connected${mainSegments?` · ${mainSegments} segments`:''}`);
    processVillageGrowth();draw();
  });
  markDirty(true,['ground','base']);
  renderUI();
  status(`${name} founded — connecting border main roads…`);
  draw();
};
document.getElementById('cancelVillageBtn').onclick=()=>{const id=State.pendingWellId;closeVillageModal();if(id)deleteStructure(id)};
document.getElementById('villageNameInput').addEventListener('keydown',e=>{if(e.key==='Enter')document.getElementById('confirmVillageBtn').click()});
document.getElementById('closeFunctions').onclick=()=>{State.selectedId=null;renderFunctionPanel();draw()};
document.getElementById('undoBtn').onclick=()=>{const s=[...State.structures].reverse().find(x=>!x.auto);if(s)deleteStructure(s.id)};
document.getElementById('clearBtn').onclick=()=>{if(confirm('Clear the settlement and refund player-built structures?')){for(const s of State.structures)if(!s.auto&&s.buildCost)refundCost(s.buildCost);const borderEntries=ensureBorderEntrySelection();State.structures=[];window.ConquerEconomy?.reset();State.village={name:null,wellId:null,founded:false,growthVersion:3,accessRoadVersion:0,growthStep:0,nextGrowthDay:null,roadPlan:null,roadPlanVersion:0,borderEntries,baseRoadAngle:null};State.selectedId=null;renderFunctionPanel();markDirty(true,['ground','base','castleBody','castleFront']);renderUI();draw()}};
['tax','rations','levy'].forEach(k=>document.getElementById(k).oninput=e=>{State.policies[k]=Number(e.target.value);markDirty(false,false,true)});
