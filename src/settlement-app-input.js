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
    commitOrientedPlacement(State.draft.center,orientedDraftAngle(p));return
  }

  if(!inBuild(p)){status('Build only inside the central 100×100U area');return}
  if(State.tool.kind==='terraform'){
    const ghost=window.ConquerTerraforming?.preview(p,State.tool);
    if(!ghost?.ok){status('Terraforming blocked: '+(ghost?.reason||'invalid terrain'));State.draft={mode:'terraform',preview:ghost};draw();return}
    if(window.ConquerTerraforming.commit(ghost)){
      clearReliefBandCache();
      if(typeof clearForestLayoutCache==='function')clearForestLayoutCache();
      if(typeof terrainMarkLayoutCache!=='undefined')terrainMarkLayoutCache=null;
      if(typeof springFlowerLayoutCache!=='undefined')springFlowerLayoutCache=null;
      markDirty(true,'all');
      State.draft=null;
      status((ghost.mode==='flat'?'Flat':ghost.mode==='walled'?'Walled terrace':'Sloped')+' applied · H '+ghost.targetZ.toFixed(0));
      draw();
    }
    return;
  }
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
    // A round footprint is independent of orientation; its door still needs
    // a user-selected facing even when the centre snaps to a wall/subtower.
    const lockedAngle=State.tool.shape==='round'?null:(snap.parentTowerId||snap.wallId)?snap.angle:null;
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
    const road=gateRoadSnap(p),q=road?road.point:{x:snapGrid(p.x),y:snapGrid(p.y)},angle=road?road.axis:0;
    State.draft={mode:'orient',center:q,angle,roadAxis:road?road.axis:null,preview:makePlacementPreview(q,angle)};
    status(road?'Gate magnetized to the road — move cursor to choose the outer front, click to confirm':'Gate position fixed — move cursor to rotate, click to confirm');draw();return
  }
  if(State.tool.kind==='civic'||State.tool.kind==='industry'||State.tool.kind==='event'){
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
      State.draft={a:s.point,aSnap:s.structureId||null,aGatePort:s.gatePort||null,preview:null,previewSegments:null};
      status(s.gatePort?'Main road: starts at the gate — choose point B':s.bridgeEnd?'Main road: starts at the bridge — choose point B':mainRoad?'Main road: point A set — choose point B':'Point A set — choose point B');
      draw();
    }else{
      const e2=snapFn(p),spec=currentLinearSpec();
      if(mainRoad&&(State.draft.aGatePort||e2.gatePort)){
        // A gate mouth is reached exactly: a free leg, then a straight approach into the passage.
        const legs=manualRoadLegs(State.draft.a,e2.point,State.draft.aGatePort,e2.gatePort);
        const bad=legs.find(l=>dist(l.a,l.b)<spec.min-.001||dist(l.a,l.b)>spec.max+.001);
        const blocked=legs.map(l=>window.ConquerPlacement?.check({type:'road',manualMain:true,width:spec.width,...l})).find(v=>v&&!v.ok);
        if(bad)status('Road to the gate: each leg must be '+spec.min+'–'+spec.max+'U');
        else if(blocked)status('Road blocked: '+blocked.reason);
        else if(legs.every(l=>addManualMainRoad(l.a,l.b))){State.draft=null;status('Main road joined to the gate — choose next segment')}
      }else if(mainRoad){
        const n=normalizeLinear(State.draft.a,e2.point,spec,false);
        if(n&&n.length>=spec.min-.001){
          if(addManualMainRoad(n.a,n.b)){
            State.draft=null;
            status(e2.bridgeEnd?'Main road joined to the bridge — choose next segment':'Main road added — choose next segment');
          }
        }else status('Segment too short');
      }else{
        // A magnet (tower, gate or a free wall end) is reached exactly.
        const route=normalizeStructuralLinearRoute(State.draft.a,e2.point,spec,!!(e2.structureId||e2.endpoint));
        if(route&&route.segments.length&&route.segments.every(seg=>seg.length>=.24)){
          const legs=route.segments.length;
          if(commitStructuralLinearRoute(route,e2.structureId||null,spec)){
            State.draft=null;
            status(legs===2?State.tool.label+' added · automatic 15° joint':State.tool.label+' ready for next segment');
          }
        }else status(e2.structureId||e2.endpoint?'No valid two-segment 15° route to this magnet':'Segment too short');
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
  if(State.tool.kind==='terraform'){
    const ghost=window.ConquerTerraforming?.preview(p,State.tool);
    State.draft={mode:'terraform',preview:ghost};
    status(!ghost?.ok?'Terraforming blocked: '+(ghost?.reason||'invalid terrain'):
      (ghost.wallSnap?'Magnet to wall face · ':'')+(ghost.mode==='flat'?'Flat subtraction':ghost.mode==='walled'?'Walled terrace':'Sloped')+' · H '+ghost.targetZ.toFixed(0)+' — click to apply');
    draw();return;
  }
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
  if(State.tool.kind==='linear'&&!State.draft&&['wall','palisade','road'].includes(State.tool.linear)){
    // Light the wall-end (or bridge-end, for roads) magnet under the pointer before the first click too.
    const road=State.tool.linear==='road',hover=(road?mainRoadSnapAnchor:snapAnchor)(p),lit=s=>s?.endpoint||s?.bridgeEnd?s.point:null;
    const was=lit(State.tool.linearHover),now=lit(hover);
    State.tool.linearHover=hover;
    if(!!was!==!!now||(was&&now&&dist(was,now)>1e-6))draw();
    return;
  }
  if(State.tool.kind==='linear'&&State.draft){
    const mainRoad=State.tool.linear==='road',snap=(mainRoad?mainRoadSnapAnchor:snapAnchor)(p),spec=currentLinearSpec();
    State.tool.linearHover=snap;
    if(mainRoad&&(State.draft.aGatePort||snap.gatePort)){
      const legs=manualRoadLegs(State.draft.a,snap.point,State.draft.aGatePort,snap.gatePort);
      State.draft.preview=null;State.draft.invalidPreview=null;
      State.draft.previewSegments=legs.map(l=>({type:'road',manualMain:true,width:spec.width,...l,length:dist(l.a,l.b)}));
      const blocked=State.draft.previewSegments.map(s=>window.ConquerPlacement?.check(s)).find(v=>v&&!v.ok);
      status(blocked?'Road blocked: '+blocked.reason:'Road magnet on the gate — click to confirm');
      draw();return;
    }
    if(mainRoad){
      const n=normalizeLinear(State.draft.a,snap.point,spec,false);
      if(n){
        State.draft.preview={type:State.tool.linear,width:spec.width,a:n.a,b:n.b,length:n.length,manualMain:true};
        State.draft.previewSegments=null;State.draft.invalidPreview=null;
        const verdict=window.ConquerPlacement?.check(State.draft.preview);
        status(verdict&&!verdict.ok?'Road blocked: '+verdict.reason:`${snap.bridgeEnd?'⛓ Bridge magnet · ':''}Main road: ${n.length.toFixed(2)}U — click to confirm`);
        draw();
      }else{
        State.draft.preview=null;State.draft.invalidPreview={type:'road',a:State.draft.a,b:snap.point,width:spec.width};draw();
      }
      return;
    }

    const route=normalizeStructuralLinearRoute(State.draft.a,snap.point,spec,!!(snap.structureId||snap.endpoint));
    if(route){
      const base={type:State.tool.linear,width:spec.width,masonryMaterial:State.buildMasonryMaterial,level:State.tool.level||State.buildLevels.wall,tier:['wall','palisade'].includes(State.tool.linear)?(State.tool.tier||State.buildLevels.wallTier):undefined,...(State.tool.span==='wide'?{span:'wide'}:{})};
      State.draft.invalidPreview=null;
      State.draft.preview=null;
      State.draft.previewSegments=route.segments.map((seg,index)=>({
        ...base,a:seg.a,b:seg.b,length:seg.length,rotationStep:seg.rotationStep,
        ...(index===0&&State.draft.aSnap?{aSnap:State.draft.aSnap}:{}),
        ...(index===route.segments.length-1&&snap.structureId?{bSnap:snap.structureId}:{})
      }));
      const previewCost=aggregateConstructionCost(State.draft.previewSegments);
      const legs=route.segments.length,total=route.length;
      status(`${State.tool.label}: ${total.toFixed(2)}U · ${legs===2?'2×15° legs · auto joint':'15°'} · ${costText(previewCost)} — click to confirm`);
    }else{
      State.draft.preview=null;State.draft.previewSegments=null;
      State.draft.invalidPreview={type:State.tool.linear,a:State.draft.a,b:snap.point,width:spec.width,length:dist(State.draft.a,snap.point)};
      status(snap.structureId||snap.endpoint?'No valid two-segment 15° route to this magnet':'Segment too short');
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
      const angle=orientedDraftAngle(p);
      State.draft.angle=angle;State.draft.preview=makePlacementPreview(State.draft.center,angle);
      const ghost=window.ConquerPlacement?.check({...State.draft.preview,parentTowerId:State.draft.parentTowerId||null,wallSnapId:State.draft.wallSnapId||null});
      let deg=Math.round(angle*180/Math.PI);if(deg<0)deg+=360;
      status(ghost&&!ghost.ok?'Placement blocked: '+ghost.reason:State.draft.wallSnapId?`Wall snap · ${Number.isFinite(State.draft.lockedAngle)?'aligned':'rotate'} ${deg}° — click to confirm`:Number.isFinite(State.draft.roadAxis)?`Road magnet · front ${deg}° — click to confirm`:`Rotate: ${deg}° — click to confirm`);
      draw();return
    }
    if(State.tool.kind==='tower'){
      const snap=towerPlacementSnap(p),angle=State.tool.shape==='round'?0:(snap.parentTowerId||snap.wallId)?snap.angle:0;
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
      const road=State.tool.kind==='gate'?gateRoadSnap(p):null;
      const q=road?road.point:{x:snapGrid(p.x),y:snapGrid(p.y)};
      State.draft={mode:'hover',preview:makePlacementPreview(q,road?road.axis:0)};
      const ghost=window.ConquerPlacement?.check(State.draft.preview);
      if(ghost&&!ghost.ok)status('Placement blocked: '+ghost.reason);
      else if(road)status('Road magnet — click to place the gate over the road');
    }
    draw();return
  }
  if(State.tool.kind==='well'){
    const q={x:snapGrid(p.x),y:snapGrid(p.y)};
    State.draft={mode:'hover',preview:{type:'well',masonryMaterial:State.buildMasonryMaterial,x:q.x,y:q.y}};
    draw();return;
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
for(const b of document.querySelectorAll('[data-terraform]'))b.onclick=()=>{
  const radius=Number(document.querySelector('[data-terraform-radius].active')?.dataset.terraformRadius)||4;
  const delta=Number(document.querySelector('[data-terraform-delta].active')?.dataset.terraformDelta)||1;
  const mode=b.dataset.terraform==='walled'?'walled':b.dataset.terraform==='flat'?'flat':'terrain';
  const shape=document.querySelector('[data-terraform-shape].active')?.dataset.terraformShape==='square'?'square':'round';
  setTool({kind:'terraform',mode,shape,radius,delta,label:(mode==='flat'?'Flat H0':mode==='walled'?'Walled terrace':'Sloped')+' · '+shape+(mode==='flat'?' · SUBTRACT':(delta<0?' · lower':' · raise')+' 1U')+' · R'+radius,el:b});
};
for(const b of document.querySelectorAll('[data-terraform-shape]'))b.onclick=()=>{
  const shape=b.dataset.terraformShape==='square'?'square':'round';
  document.querySelectorAll('[data-terraform-shape]').forEach(x=>x.classList.toggle('active',x===b));
  if(State.tool.kind==='terraform'){
    State.tool.shape=shape;State.draft=null;
    status('Terraforming shape: '+shape);draw();
  }
};
for(const b of document.querySelectorAll('[data-terraform-delta]'))b.onclick=()=>{
  const delta=Number(b.dataset.terraformDelta)<0?-1:1;
  document.querySelectorAll('[data-terraform-delta]').forEach(x=>x.classList.toggle('active',x===b));
  if(State.tool.kind==='terraform'){
    State.tool.delta=delta;State.draft=null;
    status((delta<0?'Dig':'Raise')+' 1U');draw();
  }
};
for(const b of document.querySelectorAll('[data-terraform-radius]'))b.onclick=()=>{
  const radius=Number(b.dataset.terraformRadius)||4;
  document.querySelectorAll('[data-terraform-radius]').forEach(x=>x.classList.toggle('active',x===b));
  if(State.tool.kind==='terraform'){
    State.tool.radius=radius;State.draft=null;
    status('Terraforming radius: '+radius+'U');draw();
  }
};
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
for(const b of document.querySelectorAll('[data-linear]'))b.onclick=()=>{const tier=State.buildLevels.wallTier,wide=b.dataset.linear==='builtWide',linear=wide?'built':b.dataset.linear,isPalisade=linear==='palisade',level=isPalisade?1:wide?State.buildLevels.builtWide:State.buildLevels.wall;setTool({kind:'linear',linear,...(wide?{span:'wide'}:{}),level,tier,label:(linear==='wall'?`Wall T${tier}`:isPalisade?`Palisade T${tier}`:wide?'Wide hall 2U':'Built section')+(isPalisade?'':` L${level}`)+` — choose point A`,el:b})};
document.querySelectorAll('[data-tower-level]').forEach(b=>b.onclick=()=>{State.buildLevels.tower=Number(b.dataset.towerLevel);document.querySelectorAll('[data-tower-level]').forEach(x=>x.classList.toggle('active',x===b));if(State.tool.kind==='tower'&&State.tool.material!=='wood'){State.tool.level=State.buildLevels.tower;State.draft=null;status('Tower height: '+State.buildLevels.tower+' level'+(State.buildLevels.tower>1?'s':''));draw()}});
document.querySelectorAll('[data-wall-tier]').forEach(b=>b.onclick=()=>{State.buildLevels.wallTier=Number(b.dataset.wallTier);document.querySelectorAll('[data-wall-tier]').forEach(x=>x.classList.toggle('active',x===b));if(State.tool.kind==='linear'&&['wall','palisade'].includes(State.tool.linear)){State.tool.tier=State.buildLevels.wallTier;State.draft=null;status((State.tool.linear==='palisade'?'Palisade':'Wall')+' tier: T'+State.buildLevels.wallTier+' · '+wallWidthForTier(State.buildLevels.wallTier)+'U');draw()}});
document.querySelectorAll('[data-wall-level]').forEach(b=>b.onclick=()=>{const wide=State.tool.kind==='linear'&&State.tool.span==='wide';State.buildLevels[wide?'builtWide':'wall']=Number(b.dataset.wallLevel);document.querySelectorAll('[data-wall-level]').forEach(x=>x.classList.toggle('active',x===b));if(State.tool.kind==='linear'&&['wall','built'].includes(State.tool.linear)){State.tool.level=Number(b.dataset.wallLevel);State.draft=null;status((wide?'Wide hall':'Wall')+' height: '+State.tool.level+' level'+(State.tool.level>1?'s':''));draw()}});
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
     label:spec.name+' · '+spec.w+'×'+spec.h+'U'+(spec.workers?' · L'+spec.tier+' ×'+spec.workers:'')+(window.ConquerIndustries.isMill({type})?' · Crop → Food':' · 1 '+spec.good+'/worker/day')+' · '+costText(constructionCost({...candidate,masonryMaterial:State.buildMasonryMaterial})),el:b});
 };
 // Event venues (settlement-events3d.js): podium, stage, festival ground, arena lot.
 for(const b of document.querySelectorAll('[data-event-venue]'))b.onclick=()=>{
   const E=window.ConquerEvents3D;if(!E)return;
   const candidate=E.make(b.dataset.eventVenue);
   setTool({kind:'event',venue:candidate.venue,placementSpec:candidate,
     label:E.label(candidate)+' · '+(E.buildDays(candidate)?E.buildDays(candidate)+'d · ':'')+costText(E.cost(candidate)),el:b});
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
document.getElementById('clearBtn').onclick=()=>{if(confirm('Clear the settlement, including player terraforming, and refund player-built structures?')){for(const s of State.structures)if(!s.auto&&s.buildCost)refundCost(s.buildCost);const borderEntries=ensureBorderEntrySelection();State.structures=[];window.ConquerTerraforming?.clear();window.ConquerEconomy?.reset();State.village={name:null,wellId:null,founded:false,growthVersion:3,accessRoadVersion:0,growthStep:0,nextGrowthDay:null,roadPlan:null,roadPlanVersion:0,borderEntries,baseRoadAngle:null};State.selectedId=null;renderFunctionPanel();markDirty(true,'all');renderUI();draw()}};
['tax','rations','levy'].forEach(k=>document.getElementById(k).oninput=e=>{State.policies[k]=Number(e.target.value);markDirty(false,false,true)});
