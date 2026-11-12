'use strict';
// Renderer scene orchestrator and cached layer composition. Shared classic-script globals.
function drawDayNightOverlay(){
  const r=wrap.getBoundingClientRect(),nf=nightFactor();
  if(window.ConquerAmbientLight){
    window.ConquerAmbientLight.draw(ctx,r,{
      fraction:visualCycleFrac(),night:nf,season:State.season,weather:currentWeather(),
      ...solarHours()
    });
    return;
  }
  // Defensive fallback if the optional color-grading module failed to load.
  if(nf<=0)return;
  ctx.save();ctx.fillStyle='rgba(6,10,18,'+(NIGHT_OVERLAY_MAX*nf).toFixed(3)+')';ctx.fillRect(0,0,r.width,r.height);ctx.restore();
}
// Buildings render only in WebGL2 (D-RENDER-3D-261111): say so instead of drawing a 2.5D castle.
function drawNo3DNotice(r){
  ctx.save();ctx.fillStyle='rgba(12,10,8,.78)';ctx.fillRect(r.width/2-190,18,380,46);
  ctx.fillStyle='#f2e6d3';ctx.font='600 13px system-ui';ctx.textAlign='center';
  ctx.fillText('Edifici non disponibili: serve WebGL2',r.width/2,38);
  ctx.font='11px system-ui';ctx.fillStyle='rgba(242,230,211,.78)';
  ctx.fillText(window.ConquerWorld3D?.status?.().failed||'Il renderer 3D non è attivo su questo browser.',r.width/2,55);
  ctx.restore();
}
function drawConstructionProgress(s){
  const p=w2s(structureCenter(s),structureHeight(s)+.65),pr=constructionProgress(s),w=34,h=5;ctx.save();ctx.fillStyle='rgba(0,0,0,.72)';ctx.fillRect(p.x-w/2,p.y-18,w,h);ctx.fillStyle='#e08a3c';ctx.fillRect(p.x-w/2,p.y-18,w*pr,h);ctx.strokeStyle='rgba(255,255,255,.3)';ctx.strokeRect(p.x-w/2,p.y-18,w,h);if(s.construction?.version===2){ctx.font='9px sans-serif';ctx.textAlign='center';ctx.fillStyle='rgba(255,255,255,.95)';ctx.fillText((s.construction.workers||0)+' L1',p.x,p.y-23)}ctx.restore();
}
function drawStructure(s,preview=false){
  if(s?.type==='road'){drawAutoStructure(s,preview);return}
  if(s?.type==='ruin')return;          // ruined stumps are drawn with their rubble (ConquerSiege)
  // A site with an assembly is drawn piece by piece (opaque) instead of as a translucent ghost.
  const assembled=!preview&&underConstruction(s)&&window.ConquerAssembly?.has(s);
  // Fortifications have no 2.5D body any more (D-RENDER-3D-261111): finished ones are World 3D
  // meshes, sites are assembled from the same meshes, ghosts are their footprint volume.
  if(isFortificationStructure(s)){
    if(!preview&&!underConstruction(s))return;
    if(!(assembled&&window.ConquerAssembly.draw(s)))drawPlacementVolume(s,'rgba(244,214,160,.22)','rgba(244,214,160,.92)');
    if(!preview)drawConstructionProgress(s);
    return;
  }
  const render=()=>{
    if(assembled&&window.ConquerAssembly.draw(s))return;
    ctx.save();if(preview)ctx.globalAlpha=.58;else if(underConstruction(s))ctx.globalAlpha=.42;
    if(isPlacementFoundationBuilding(s))drawPlacementFoundation(s,preview);
    if(window.ConquerStorageYard?.is(s))window.ConquerStorageYard.draw(s,preview);
    else if(window.ConquerIndustries?.is(s))window.ConquerIndustries.render(s,preview);
    else if(window.ConquerEvents3D?.is(s))window.ConquerEvents3D.draw(s,preview);   // event venues (settlement-events3d.js)
    else if(window.ConquerPier?.is(s))window.ConquerPier.draw(s,preview);           // timber pier (settlement-pier.js)
    else if(window.ConquerQuay?.is(s))window.ConquerQuay.draw(s,preview);           // stone quay (settlement-quay.js)
    else if(window.ConquerSlopeways?.is(s))window.ConquerSlopeways.draw(s,preview); // ramp / stairway (settlement-slopeways.js)
    else if(isCivic(s))drawCivicStructure(s,preview);
    else if(isCivicAnnex(s))drawCivicAnnex(s,preview);
    else if(['tower','gate','well'].includes(s.type))drawPointStructure(s,preview);
    else if(s.type==='palisade')drawPalisade(s,preview);
    // Timber longhouse: Blender model; open in cutaway, its room right after it, in depth order (it
    // is not a castle part, so the castle body / cutaway composites neither bound nor refresh it).
    else if(isLonghouse(s)&&window.ConquerWood3D?.draw(s,preview)){if(!preview&&structureCutaway(s))window.ConquerCutawayFurniture?.draw(s,cutawayWallGeometry(s))}
    else{drawLinearBase(s,preview);if(!underConstruction(s))drawBuiltDetails(s,preview)}
    ctx.restore();
  };
  withStructureVisualMaterial(s,()=>{if(isPlacementFoundationBuilding(s))withStructureGroundPlane(s,render);else render()});
  if(!preview&&underConstruction(s)){
    if(isPlacementFoundationBuilding(s))withStructureGroundPlane(s,()=>drawConstructionProgress(s));
    else if(window.ConquerIndustries?.is(s))withProjectionGroundZ(s.groundZ,()=>drawConstructionProgress(s));
    else drawConstructionProgress(s);
  }
}
// Preserve the normal translucent preview; tint its actual footprint red
// only when the same nonmutating preflight used by the commit would reject it.
function builderGhostVerdict(ghost){
  if(!ghost||!window.ConquerPlacement)return{ok:true};
  if(ghost._ghostCheck)return ghost._ghostCheck;
  const draft=State.draft;
  const probe=draft?.parentTowerId&&ghost.type==='tower'
    ?{...ghost,parentTowerId:draft.parentTowerId,wallSnapId:draft.wallSnapId}
    :draft?.wallSnapId&&ghost.type==='tower'
      ?{...ghost,wallSnapId:draft.wallSnapId}:ghost;
  const result=window.ConquerPlacement.check(probe);
  // Ghost instances are replaced whenever the pointer changes position,
  // so validations never run again on unchanged frames.
  ghost._ghostCheck=result;
  return result;
}
function isFortificationStructure(s){
  return !!s&&['tower','gate','wall','palisade','built'].includes(s.type);
}
function drawInvalidPlacementGhost(ghost){
  drawPlacementVolume(ghost,'rgba(232,40,47,.38)','rgba(255,76,83,.98)');
}
// Footprint prism (placement contact rings, base and top) of a structure: the placement ghost.
function drawPlacementVolume(ghost,fill,stroke){
  if(!ghost)return;
  ctx.save();
  ctx.globalAlpha=1;
  ctx.setLineDash([5,3]);
  ctx.lineWidth=2.5;
  if(ghost.a&&ghost.b&&ghost.type==='road'){
    const a=w2s(ghost.a),b=w2s(ghost.b);
    ctx.strokeStyle=stroke;ctx.lineWidth=Math.max(5,(ghost.width||.6)*U*State.view.scale);
    ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
  }else{
    const rings=window.ConquerPlacement?.contact(ghost)||[];
    const ground=Number.isFinite(ghost.groundZ)?ghost.groundZ:
      window.ConquerIndustries?.is(ghost)?window.ConquerIndustries.groundLevel(ghost):
      isPlacementFoundationBuilding(ghost)?placementGroundZ(ghost):
      terrainElevation(structureCenter(ghost));
    withProjectionGroundZ(ground,()=>{
      for(const poly of rings){
        if(poly?.length<3)continue;
        pathPolygon(projectPath(poly,.03),fill,stroke,2.5);
        // A red upper face remains aligned to the slope-based industry platform.
        const height=Math.max(0,structureHeight(ghost));
        if(height>.05)pathPolygon(projectPath(poly,height+.04),fill,stroke,2);
      }
    });
  }
  ctx.restore();
}
function drawLandscapeStaticScene(){
  const analyticsT0=performance.now();
  const entry=prepareSceneCache('landscape');
  withRenderContext(entry.ctx,()=>{
    drawTerrain();
    drawGrid();
    drawEnvironment();
  });
  entry.dirty=false;
  const perf=window.__conquerPerf||(window.__conquerPerf={});
  perf.cacheLandscapeRebuilds=(perf.cacheLandscapeRebuilds||0)+1;
  window.__conquerAnalytics?.measure('CACHE_LANDSCAPE',performance.now()-analyticsT0);
}
function drawGroundStaticScene(){
  const analyticsT0=performance.now();
  const entry=prepareSceneCache('ground');
  withRenderContext(entry.ctx,()=>{
    // Ground network changes frequently during growth/completion but must never
    // force terrain/environment rasterization.
    State.structures
      .filter(s=>(s.type==='road'||(s.auto&&s.type==='field'))&&!underConstruction(s))
      .forEach(drawAutoStructure);

    // Weather-ground detail is isolated here. Wet/dry transitions invalidate
    // only this cheap layer instead of terrain + every building.
    drawPuddleLayer();
    drawUrbanLots();
    window.ConquerCrossings?.drawGround();
  });
  entry.dirty=false;
  const perf=window.__conquerPerf||(window.__conquerPerf={});
  perf.cacheGroundRebuilds=(perf.cacheGroundRebuilds||0)+1;
  window.__conquerAnalytics?.measure('CACHE_GROUND',performance.now()-analyticsT0);
}
function drawShadowStaticScene(){
  const analyticsT0=performance.now();
  const entry=prepareSceneCache('shadow');
  withRenderContext(entry.ctx,()=>drawDynamicShadows());
  entry.dirty=false;
  const perf=window.__conquerPerf||(window.__conquerPerf={});
  perf.cacheShadowRebuilds=(perf.cacheShadowRebuilds||0)+1;
  window.__conquerAnalytics?.measure('CACHE_SHADOW',performance.now()-analyticsT0);
}
let shopFrontSig=null;
function ensureStaticSceneCaches(){
  // L3 shop fronts open at dawn and shut at dusk (settlement-shop-cutaway.js): repaint the houses.
  const shopSig=window.ConquerShopCutaway?.frontSig?.()??null;
  if(shopSig!==shopFrontSig){if(shopFrontSig!==null)invalidateSceneCache(['base']);shopFrontSig=shopSig}
  // Buildings, towers, walls and gates render only in 3D (settlement-world3d.js, decision
  // D-RENDER-3D-261111). Without WebGL2 the Canvas keeps the terrain and ground network only.
  const builders=[
    ['landscape',drawLandscapeStaticScene],
    ['ground',drawGroundStaticScene]
  ];

  // A projection mismatch cannot safely reuse the old raster. Content-only
  // invalidations can: keep showing the previous bitmap for one or two frames
  // while expensive layers rebuild individually.
  let projectionMismatch=false,coldStart=false;
  for(const [name] of builders){
    const entry=sceneCache[name];
    if(!entry.view)coldStart=true;
    if(!sceneCacheZoomPreview&&!sceneCachePanPreview&&entry.view&&!sceneCacheProjectionCompatible(entry)){
      entry.dirty=true;
      projectionMismatch=true;
    }
  }

  const stagePriority=new Map([
    ['ground',0],['landscape',1]
  ]);
  const dirty=builders
    .filter(([name])=>sceneCache[name].dirty)
    .sort((a,b)=>(stagePriority.get(a[0])??99)-(stagePriority.get(b[0])??99));
  if(!dirty.length)return;

  // Initial load, pause/edit mode and camera projection changes favor immediate
  // correctness. During running simulation, topology-only rebuilds are staged
  // one cache per visual frame to prevent 100–200ms combined long tasks.
  if(coldStart||projectionMismatch||State.clock.speed<=0){
    for(const [,build] of dirty)build();
    return;
  }

  const [name,build]=dirty[0];
  const t0=performance.now();
  build();
  const ms=performance.now()-t0;
  window.__conquerAnalytics?.measure('CACHE_STAGE',ms,{layer:name,remaining:dirty.length-1});
}
let lastCivicCutawayId=null;
function draw(){
  // A selected church / inn is drawn in cutaway inside the base layer; Escape and the
  // panel's close button deselect without invalidating it.
  const civicCut=window.ConquerCivic3D?.cutawaySig?.()||null;   // id@floor
  if(civicCut!==lastCivicCutawayId){lastCivicCutawayId=civicCut;invalidateSceneCache('base')}
  const r=wrap.getBoundingClientRect();
  const phaseStart=performance.now(),phaseStats={};
  let phaseAt=phaseStart;
  function markPhase(name){
    const now=performance.now(),ms=now-phaseAt;
    phaseStats[name]=ms;phaseAt=now;
    if(ms>20)window.__conquerAnalytics?.event('RENDER_PHASE_SLOW',{
      phase:name,ms:+ms.toFixed(1),structures:State.structures.length
    },'warn',5000);
  }
  beginPopulationFrame(r);
  ctx=screenCtx;
  screenCtx.clearRect(0,0,r.width,r.height);
  // The static scene is the 3D world (settlement-world3d.js). Buildings have no Canvas path:
  // without WebGL2 only terrain and ground are drawn, with a notice (drawNo3DNotice).
  const world3d=window.ConquerWorld3D?.active?.()&&window.ConquerWorld3D.drawBack(r);
  if(world3d){
    window.ConquerSnowTracks?.draw();
  }else{
  ensureStaticSceneCaches();
  const gpuStatic=window.ConquerWebGPU?.renderStaticLayers?.(r,true)===true;
  if(!gpuStatic){
    blitSceneCache('landscape');
    blitSceneCache('ground');
  }
  window.ConquerSnowTracks?.draw();
  }

  // Dynamic placement overlay: switching tools must not invalidate or rebuild
  // the static landscape cache, and the WebGPU path must show the same outline.
  drawBuildArea();
  window.ConquerForestry?.drawJobs();
  for(const field of completedSettlement('field'))drawFieldWork(field);

  // Construction sites remain dynamic at ground/building depth.
  State.structures
    .filter(s=>(s.type==='road'||(s.auto&&s.type==='field'))&&underConstruction(s))
    .forEach(drawAutoStructure);
  const dynamicSites=State.structures
    .filter(s=>!['moat','bridge'].includes(s.type)&&!(s.type==='road'||(s.auto&&s.type==='field'))&&underConstruction(s))
    .slice().sort((a,b)=>worldDepth(a)-worldDepth(b));
  // Each site is followed by its scaffold, lifting gear and materials for the current phase.
  for(const s of dynamicSites){if(s.auto)drawAutoStructure(s);else{drawStructure(s);window.ConquerConstructionProps?.drawSite(s)}}

  markPhase('scene-caches');
  // Population remains between settlement massing and completed castle massing,
  // preserving the existing occlusion behaviour.
  window.ConquerLivestock?.draw();
  drawPeasants();
  window.ConquerHaulage?.draw?.(); // Loaded carts to stockyards, empty return on completed roads
  window.ConquerJoust?.draw();   // spectators, knights and squires on an active joust ground
  window.ConquerEventPeople?.draw();   // feast and circus: diners, sellers, players, queues
  window.ConquerCourtPeople?.draw();   // the tribunal in session in the town hall cutaway
  window.ConquerIndustries?.drawWorkers();
  window.ConquerWorkAnim?.drawBuilders();
  window.ConquerShipyard?.drawShipwrights();   // shipwrights along the hull on the slipways
  if(!window.ConquerWorld3D?.active?.())window.ConquerCoast?.draw();   // 2.5D: shore boulders (WebGL has them in the static scene)
  window.ConquerCoast?.drawWaves(performance.now()/1000);   // waves on the beaches, spray on the rocks, glints at sea
  window.ConquerFleet?.draw();   // ships at the piers or at anchor, with their crews (settlement-fleet.js)
  markPhase('population');
  drawTrainingSoldiers();
  drawCutawayOccupants();

  drawTowerFlags();
  drawCastleSoldiers();
  markPhase('castle-units');
  if(world3d)window.ConquerWorld3D.drawFront(r);
  window.ConquerFleet?.drawFigures();   // 3D: crews, fires and arrows over the ships of the front pass
  window.ConquerGulls?.draw(performance.now()/1000);   // seagulls over the coast, above the ships
  window.ConquerSiege?.drawOverlay();
  if(typeof drawRaisedVillagers==='function')drawRaisedVillagers();   // on the Mastio's outer stair
  drawCastleFireFixtures();

  // The drawbridge is an exterior shield when raised. Paint portals and
  // windows FIRST, then the moving drawbridge so it physically covers them
  // on the outward Gate facade (stone and timber alike).
  if(world3d)window.ConquerWorld3D.drawMastioDrapes();
  window.ConquerCrossings?.drawDynamic();
  window.ConquerKeepEntrance?.animate();
  window.ConquerGates?.tick();
  drawChimneysAndSmoke();

  if(State.draft?.mode==='terraform'){
    if(State.tool?.mode==='forest')window.ConquerForestry?.drawGhost(State.draft.preview);
    else window.ConquerTerraforming?.drawGhost(State.draft.preview);
  }else if(['moat','bridge'].includes(State.draft?.preview?.type))window.ConquerCrossings?.drawPreview(State.draft.preview);
  if(State.draft?.mode!=='terraform'&&State.draft?.previewSegments?.length){
    const segments=State.draft.previewSegments;
    for(const segment of segments){
      drawStructure(segment,true);
      const verdict=builderGhostVerdict(segment);
      if(!verdict.ok)drawInvalidPlacementGhost(segment);
    }
  }else if(State.draft?.mode!=='terraform'&&State.draft?.preview){
    const ghost=State.draft.preview;
    if(['moat','bridge'].includes(ghost.type)){
      window.ConquerCrossings?.drawPreview(ghost);
    }else{
      drawStructure(ghost,true);
      const verdict=builderGhostVerdict(ghost);
      if(!verdict.ok)drawInvalidPlacementGhost(ghost);
    }
  }else if(State.draft?.mode!=='terraform'&&State.draft?.invalidPreview){
    drawInvalidPlacementGhost(State.draft.invalidPreview);
  }
  window.ConquerCrossings?.drawMoatMagnets();
  if(typeof drawLinearMagnets==='function')drawLinearMagnets();
  window.ConquerTerraforming?.drawMagnets();
  if(State.draft?.mode==='orient'&&State.draft.center&&Number.isFinite(State.draft.angle)){
    const end={x:State.draft.center.x+Math.cos(State.draft.angle)*4,y:State.draft.center.y+Math.sin(State.draft.angle)*4};
    const a=w2s(State.draft.center),b=w2s(end);ctx.save();ctx.strokeStyle='rgba(244,183,111,.72)';ctx.lineWidth=1.2;ctx.setLineDash([5,4]);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.restore();
  }
  drawDayNightOverlay();
  // WebGL2 lights share the real scene depth and are composited after colour grading.
  // Canvas keeps its original complete night path as the fallback.
  if(world3d)window.ConquerWorld3D.drawNightLights3D(r);
  if(world3d&&!window.ConquerWorld3D.finishFrame()){
    // A failed checkpoint leaves terrain and the WebGL2 notice (no Canvas buildings).
    draw();return;
  }
  if(!world3d)drawNo3DNotice(r);
  // High-contrast dynamic outline stays visible above roofs, windows and light.
  drawCastleSelection();
  // Road signposts and convoys on the arterial roads, above scene caches;
  // they never change pathfinding or collision geometry.
  window.ConquerRoadSignTests?.draw?.();
  endPopulationFrame();
  markPhase('castle-facades-effects');
  if(window.__conquerPerf)window.__conquerPerf.renderPhases=phaseStats;
  window.ConquerMinimap?.requestDraw();
}


// Explicit redraw hook for the opt-in convoy animation (without invalidating caches).
window.__drawConquerScene=draw;
