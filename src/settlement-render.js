'use strict';
// Renderer scene orchestrator and cached layer composition. Shared classic-script globals.
function drawDayNightOverlay(){
  const r=wrap.getBoundingClientRect(),nf=nightFactor();
  if(window.ConquerAmbientLight){
    window.ConquerAmbientLight.draw(ctx,r,{
      fraction:visualCycleFrac(),night:nf,season:State.season,weather:currentWeather()
    });
    return;
  }
  // Defensive fallback if the optional color-grading module failed to load.
  if(nf<=0)return;
  ctx.save();ctx.fillStyle='rgba(6,10,18,'+(NIGHT_OVERLAY_MAX*nf).toFixed(3)+')';ctx.fillRect(0,0,r.width,r.height);ctx.restore();
}
function drawNightLights(){
  const nf=nightFactor();if(nf<=.01)return;
  const t0=performance.now();
  drawFacadeWindows(true,nf);
  drawFireGlows(nf);
  const ms=performance.now()-t0;
  if(window.__conquerPerf)window.__conquerPerf.canvasNightLightsMs=ms;
  window.__conquerAnalytics?.measure('NIGHTLIGHT_CANVAS',ms,{structures:State.structures.length});
}
function drawConstructionProgress(s){
  const p=w2s(structureCenter(s),structureHeight(s)+.65),pr=constructionProgress(s),w=34,h=5;ctx.save();ctx.fillStyle='rgba(0,0,0,.72)';ctx.fillRect(p.x-w/2,p.y-18,w,h);ctx.fillStyle='#e08a3c';ctx.fillRect(p.x-w/2,p.y-18,w*pr,h);ctx.strokeStyle='rgba(255,255,255,.3)';ctx.strokeRect(p.x-w/2,p.y-18,w,h);ctx.restore();
}
function drawStructure(s,preview=false){
  if(s?.type==='road'){drawAutoStructure(s,preview);return}
  const render=()=>{
    ctx.save();if(preview)ctx.globalAlpha=.58;else if(underConstruction(s))ctx.globalAlpha=.42;
    if(isPlacementFoundationBuilding(s))drawPlacementFoundation(s,preview);
    if(window.ConquerIndustries?.is(s))window.ConquerIndustries.render(s,preview);
    else if(isCivic(s))drawCivicStructure(s,preview);
    else if(['tower','gate','well'].includes(s.type))drawPointStructure(s,preview);
    else if(s.type==='palisade')drawPalisade(s,preview);
    else{drawLinearBase(s,preview);if(!underConstruction(s))drawBuiltDetails(s,preview)}
    ctx.restore();
  };
  if(isPlacementFoundationBuilding(s))withStructureGroundPlane(s,render);else render();
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
function drawInvalidPlacementGhost(ghost){
  if(!ghost)return;
  ctx.save();
  ctx.globalAlpha=1;
  const fill='rgba(232,40,47,.38)',stroke='rgba(255,76,83,.98)';
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
        if(height>.05)pathPolygon(projectPath(poly,height+.04),'rgba(229,36,45,.28)',stroke,2);
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
function drawBaseStaticScene(){
  const analyticsT0=performance.now();
  const entry=prepareSceneCache('base');
  withRenderContext(entry.ctx,()=>{
    const completedOthers=State.structures
      .filter(s=>!['moat','bridge'].includes(s.type)&&!(s.type==='road'||(s.auto&&s.type==='field'))&&!isCastlePart(s)&&!isRaisedPlacementCastlePoint(s)&&!underConstruction(s))
      .slice().sort((a,b)=>worldDepth(a)-worldDepth(b));
    for(const s of completedOthers){if(s.auto)drawAutoStructure(s);else drawStructure(s)}
    drawStaticHouseFacadeDetails();
  });
  entry.dirty=false;
  const perf=window.__conquerPerf||(window.__conquerPerf={});
  perf.cacheBaseRebuilds=(perf.cacheBaseRebuilds||0)+1;
  window.__conquerAnalytics?.measure('CACHE_BASE',performance.now()-analyticsT0,{structures:State.structures.length});
}
let castleBodyBitmapEnabled=localStorage.getItem('conquer.castleBodyBitmap.v1')!=='0';
function renderCastleBodyContent(){
  // Opt-in 3D prototype (settlement-castle3d.js); falls through to the Canvas union renderer.
  if(window.ConquerCastle3D?.drawBody?.())return;
  const unionOk=drawCastleUnion();
  if(!unionOk){
    const fallback=State.structures.filter(s=>isCastlePart(s)&&!underConstruction(s)&&!structureCutaway(s)).slice().sort((a,b)=>worldDepth(a)-worldDepth(b));
    for(const s of fallback)drawStructure(s);
  }else{
    drawCastleUnionDetails();
  }

  // Point fortifications on slopes are intentionally kept out of the wall
  // boolean union: draw them as rigid volumes on their own level-0 plane.
  const raised=State.structures
    .filter(s=>isRaisedPlacementCastlePoint(s)&&!underConstruction(s)&&!structureCutaway(s))
    .slice().sort((a,b)=>worldDepth(a)-worldDepth(b));
  for(const s of raised)drawStructure(s);

  // Machicolation floors are part of the castle body, below tower units.
  drawMachicolationFloors();
  drawCutawayStructures();
  drawTowerDoors();
  drawTowerRoofs();
  drawGateRoofs();
}
function castleBodyRenderableStructures(){
  return State.structures.filter(s=>(isCastlePart(s)||isRaisedPlacementCastlePoint(s))&&!underConstruction(s));
}
function castleBodyCompositeBounds(){
  const parts=castleBodyRenderableStructures();if(!parts.length)return null;
  const cloud=[];
  for(const s of parts){
    const hull=structureScreenSilhouette(s);
    if(hull?.length)cloud.push(...hull);
  }
  if(!cloud.length)return null;
  const pad=Math.max(56,72*State.view.scale);
  return{
    minX:Math.min(...cloud.map(p=>p.x))-pad,
    minY:Math.min(...cloud.map(p=>p.y))-pad,
    maxX:Math.max(...cloud.map(p=>p.x))+pad,
    maxY:Math.max(...cloud.map(p=>p.y))+pad
  };
}
function castleBodyVisualSignature(){
  const num=v=>Number.isFinite(Number(v))?+Number(v).toFixed(4):null;
  const point=p=>p?[num(p.x),num(p.y)]:null;
  const items=castleBodyRenderableStructures().map(s=>[
    s.id||'',s.type||'',s.shape||'',s.material||'',s.woodStyle||'',s.woodRoof||'',
    s.roofStyle||'',s.baseStyle||'',s.skin||'',num(s.x),num(s.y),num(s.r),num(s.size),
    point(s.a),point(s.b),num(s.width),num(s.length),num(s.angle),s.rotationStep??null,
    s.level??null,s.tier??null,!!s.flip,!!s.cutaway,JSON.stringify(s.functions||[]),s.aSnap||null,s.bSnap||null,s.parentTowerId||null,
    num(s.orientationOffset),num(s.groundZ),num(s.foundationMinZ)
  ]).sort((a,b)=>String(a[0]).localeCompare(String(b[0])));
  return JSON.stringify([
    1,window.ConquerCastle3D?.active?.()?'3d':'2d',State.season||'summer',num(State.view.scale),State.view.rotation||0,isPlanView()?'plan':'iso',staticCacheDpr(),
    !!window.__polygonClipping,items
  ]);
}
function drawCastleBodyBitmap(){
  const api=window.__conquerAssetCompiler,bounds=castleBodyCompositeBounds();
  if(!castleBodyBitmapEnabled||!api?.renderComposite||!bounds){renderCastleBodyContent();return{mode:'direct',hit:false}}
  const key='castleBody|'+castleBodyVisualSignature();
  const result=api.renderComposite('castleBody',key,bounds,renderCastleBodyContent);
  if(!result?.ok){renderCastleBodyContent();return{mode:'fallback',hit:false,reason:result?.reason||'cache-failed'}}
  return{mode:result.hit?'hit':'miss',hit:!!result.hit,ms:result.ms||0,bytes:result.bytes||0};
}
function updateCastleCacheControls(){
  const btn=document.getElementById('castleCacheToggle');
  if(btn){btn.textContent='Castle cache '+(castleBodyBitmapEnabled?'ON':'OFF');btn.classList.toggle('active',castleBodyBitmapEnabled)}
  window.__conquerAssetCompiler?.stats?.();
}
function setCastleBodyBitmapEnabled(enabled){
  castleBodyBitmapEnabled=!!enabled;
  localStorage.setItem('conquer.castleBodyBitmap.v1',castleBodyBitmapEnabled?'1':'0');
  window.__conquerAssetCompiler?.clearComposite?.();
  invalidateSceneCache('castleBody');updateCastleCacheControls();draw();
}
function makeCastleBenchmarkCanvas(){
  const r=wrap.getBoundingClientRect(),d=staticCacheDpr(),canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(r.width*d));canvas.height=Math.max(1,Math.round(r.height*d));
  const g=canvas.getContext('2d');g.setTransform(d,0,0,d,0,0);
  return{canvas,g,d,r};
}
function castleBenchmarkPixelDiff(a,b){
  try{
    const da=a.getContext('2d').getImageData(0,0,a.width,a.height).data;
    const db=b.getContext('2d').getImageData(0,0,b.width,b.height).data;
    let checked=0,different=0,sum=0,max=0;
    for(let i=0;i<da.length;i+=16){
      const d=Math.max(Math.abs(da[i]-db[i]),Math.abs(da[i+1]-db[i+1]),Math.abs(da[i+2]-db[i+2]),Math.abs(da[i+3]-db[i+3]));
      checked++;sum+=d;if(d>8)different++;if(d>max)max=d;
    }
    return{ratio:checked?different/checked:0,mean:checked?sum/checked:0,max};
  }catch{return null}
}
function benchmarkCastleBodyCache(iterations=3){
  const api=window.__conquerAssetCompiler;if(!api?.renderComposite)return null;
  const loops=Math.max(1,Math.min(6,Math.round(iterations)||3)),directTimes=[],hitTimes=[];
  const direct=makeCastleBenchmarkCanvas();
  for(let i=0;i<loops;i++){
    direct.g.clearRect(0,0,direct.r.width,direct.r.height);
    const t0=performance.now();withRenderContext(direct.g,renderCastleBodyContent);directTimes.push(performance.now()-t0);
  }
  api.clearComposite();
  const cached=makeCastleBenchmarkCanvas(),bounds=castleBodyCompositeBounds(),key='castleBody|'+castleBodyVisualSignature();
  const coldT0=performance.now();
  let cold;
  withRenderContext(cached.g,()=>{cold=api.renderComposite('castleBody',key,bounds,renderCastleBodyContent)});
  const coldMs=performance.now()-coldT0;
  for(let i=0;i<loops;i++){
    cached.g.clearRect(0,0,cached.r.width,cached.r.height);
    const t0=performance.now();withRenderContext(cached.g,()=>api.renderComposite('castleBody',key,bounds,renderCastleBodyContent));hitTimes.push(performance.now()-t0);
  }
  const avg=a=>a.reduce((x,y)=>x+y,0)/Math.max(1,a.length),diff=castleBenchmarkPixelDiff(direct.canvas,cached.canvas);
  const result={
    iterations:loops,directMs:+avg(directTimes).toFixed(2),coldMs:+coldMs.toFixed(2),hitMs:+avg(hitTimes).toFixed(2),
    speedup:+(avg(directTimes)/Math.max(.01,avg(hitTimes))).toFixed(2),
    pixelDiffRatio:diff?+diff.ratio.toFixed(6):null,pixelDiffMean:diff?+diff.mean.toFixed(3):null,pixelDiffMax:diff?.max??null
  };
  window.__conquerAnalytics?.event('CASTLE_BODY_AB',result,diff&&diff.ratio>.002?'warn':'info');
  const el=document.getElementById('castleCacheReadout');
  if(el)el.textContent='A/B direct '+result.directMs+' ms · hit '+result.hitMs+' ms · ×'+result.speedup+' · diff '+(result.pixelDiffRatio==null?'—':(result.pixelDiffRatio*100).toFixed(2)+'%');
  return result;
}
function drawCastleBodyStaticScene(){
  const analyticsT0=performance.now();
  const entry=prepareSceneCache('castleBody');
  let cacheResult={mode:'direct',hit:false};
  withRenderContext(entry.ctx,()=>{cacheResult=drawCastleBodyBitmap()});
  entry.dirty=false;
  const perf=window.__conquerPerf||(window.__conquerPerf={});
  perf.cacheCastleBodyRebuilds=(perf.cacheCastleBodyRebuilds||0)+1;
  perf.lastCastleBodyCacheMode=cacheResult.mode;
  perf.lastCastleBodyRebuildMs=performance.now()-analyticsT0;
  window.__conquerAnalytics?.measure('CACHE_CASTLE_BODY',perf.lastCastleBodyRebuildMs,{bitmap:cacheResult.mode});
}
function drawCastleFrontStaticScene(){
  const analyticsT0=performance.now();
  const entry=prepareSceneCache('castleFront');
  withRenderContext(entry.ctx,()=>{if(!window.ConquerCastle3D?.drawFront?.())drawCastleBattlements()});
  entry.dirty=false;
  const perf=window.__conquerPerf||(window.__conquerPerf={});perf.cacheCastleFrontRebuilds=(perf.cacheCastleFrontRebuilds||0)+1;
  window.__conquerAnalytics?.measure('CACHE_CASTLE_FRONT',performance.now()-analyticsT0);
}
window.__conquerCastleBodyCache={
  enabled:()=>castleBodyBitmapEnabled,
  setEnabled:setCastleBodyBitmapEnabled,
  benchmark:benchmarkCastleBodyCache,
  signature:castleBodyVisualSignature
};
document.getElementById('castleCacheToggle')?.addEventListener('click',()=>setCastleBodyBitmapEnabled(!castleBodyBitmapEnabled));
document.getElementById('castleCacheBenchmark')?.addEventListener('click',()=>benchmarkCastleBodyCache(3));
updateCastleCacheControls();

function ensureStaticSceneCaches(){
  const builders=[
    ['landscape',drawLandscapeStaticScene],
    ['ground',drawGroundStaticScene],
    ['shadow',drawShadowStaticScene],
    ['base',drawBaseStaticScene],
    ['castleBody',drawCastleBodyStaticScene],
    ['castleFront',drawCastleFrontStaticScene]
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
    ['ground',0],['base',1],['castleBody',2],['castleFront',3],['shadow',4],['landscape',5]
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
function draw(){
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
  // Opt-in full-scene 3D prototype (settlement-world3d.js): replaces every static scene cache.
  const world3d=window.ConquerWorld3D?.active?.()&&window.ConquerWorld3D.drawBack(r);
  if(world3d){
    window.ConquerSnowTracks?.draw();
  }else{
  ensureStaticSceneCaches();
  // Keep moving footprints above the terrain but BELOW completed buildings.
  // With WebGPU active, exclude the base layer from its compositing pass and
  // blit that cached bitmap on the front canvas after the snow. Otherwise
  // WebGPU's opaque static canvas would always bury the footprints entirely.
  const snowUnderBuildings=State.season==='winter'&&(window.ConquerSnowTracks?.count?.()||0)>0;
  const gpuStatic=window.ConquerWebGPU?.renderStaticLayers?.(r,snowUnderBuildings)===true;
  if(!gpuStatic){
    blitSceneCache('landscape');
    blitSceneCache('ground');
    blitSceneCache('shadow');
  }
  window.ConquerSnowTracks?.draw();
  if(!gpuStatic||snowUnderBuildings)blitSceneCache('base');
  }

  // Dynamic placement overlay: switching tools must not invalidate or rebuild
  // the static landscape cache, and the WebGPU path must show the same outline.
  drawBuildArea();
  for(const field of completedSettlement('field'))drawFieldWork(field);

  // Construction sites remain dynamic at ground/building depth.
  State.structures
    .filter(s=>(s.type==='road'||(s.auto&&s.type==='field'))&&underConstruction(s))
    .forEach(drawAutoStructure);
  const dynamicSites=State.structures
    .filter(s=>!['moat','bridge'].includes(s.type)&&!(s.type==='road'||(s.auto&&s.type==='field'))&&underConstruction(s))
    .slice().sort((a,b)=>worldDepth(a)-worldDepth(b));
  for(const s of dynamicSites){if(s.auto)drawAutoStructure(s);else drawStructure(s)}

  markPhase('scene-caches');
  // Population remains between settlement massing and completed castle massing,
  // preserving the existing occlusion behaviour.
  drawPeasants();
  window.ConquerIndustries?.drawWorkers();
  markPhase('population');
  drawTrainingSoldiers();
  if(world3d)window.ConquerWorld3D.drawCastleOverlays();else blitSceneCache('castleBody');
  drawCutawayOccupants();

  drawTowerFlags();
  drawCastleSoldiers();
  markPhase('castle-units');
  if(world3d)window.ConquerWorld3D.drawFront(r);else blitSceneCache('castleFront');
  window.ConquerSiege?.drawOverlay();
  drawCastleFireFixtures();

  // The drawbridge is an exterior shield when raised. Paint portals and
  // windows FIRST, then the moving drawbridge so it physically covers them
  // on the outward Gate facade (stone and timber alike).
  if(world3d)window.ConquerWorld3D.drawMastioDrapes();
  else{drawFacadeWindows(false,1,false);drawGatePortals()}
  window.ConquerCrossings?.drawDynamic();
  drawChimneysAndSmoke();

  if(['moat','bridge'].includes(State.draft?.preview?.type))window.ConquerCrossings?.drawPreview(State.draft.preview);
  if(State.draft?.previewSegments?.length){
    const segments=State.draft.previewSegments;
    const totalCost=aggregateConstructionCost(segments);
    const routeUnderfunded=!canAfford(totalCost);
    for(const segment of segments){
      drawStructure(segment,true);
      const verdict=builderGhostVerdict(segment);
      if(!verdict.ok||routeUnderfunded)drawInvalidPlacementGhost(segment);
    }
  }else if(State.draft?.preview){
    const ghost=State.draft.preview;
    if(['moat','bridge'].includes(ghost.type)){
      window.ConquerCrossings?.drawPreview(ghost);
    }else{
      drawStructure(ghost,true);
      const verdict=builderGhostVerdict(ghost);
      if(!verdict.ok)drawInvalidPlacementGhost(ghost);
    }
  }else if(State.draft?.invalidPreview){
    drawInvalidPlacementGhost(State.draft.invalidPreview);
  }
  window.ConquerCrossings?.drawMoatMagnets();
  if(State.draft?.mode==='orient'&&State.draft.center&&Number.isFinite(State.draft.angle)){
    const end={x:State.draft.center.x+Math.cos(State.draft.angle)*4,y:State.draft.center.y+Math.sin(State.draft.angle)*4};
    const a=w2s(State.draft.center),b=w2s(end);ctx.save();ctx.strokeStyle='rgba(244,183,111,.72)';ctx.lineWidth=1.2;ctx.setLineDash([5,4]);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.restore();
  }
  drawDayNightOverlay();
  // WebGL2 lights share the real scene depth and are composited after colour grading.
  // Canvas keeps its original complete night path as the fallback.
  if(world3d&&window.ConquerWorld3D.nightLightsEnabled())window.ConquerWorld3D.drawNightLights3D(r);
  else drawNightLights();
  // High-contrast dynamic outline stays visible above roofs, windows and light.
  drawCastleSelection();
  endPopulationFrame();
  markPhase('castle-facades-effects');
  if(window.__conquerPerf)window.__conquerPerf.renderPhases=phaseStats;
}

