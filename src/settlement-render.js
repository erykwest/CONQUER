'use strict';
// Renderer frame orchestrator: World 3D scene plus the dynamic Canvas overlays. Shared classic-script globals.
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
function drawNo3DNotice(r){
  // The world renders only in WebGL2 (D-RENDER-3D-261111): say so, there is no Canvas fallback.
  ctx.save();ctx.fillStyle='rgba(12,10,8,.78)';ctx.fillRect(r.width/2-190,18,380,46);
  ctx.fillStyle='#f2e6d3';ctx.font='600 13px system-ui';ctx.textAlign='center';
  ctx.fillText('Il gioco richiede WebGL2',r.width/2,38);
  ctx.font='11px system-ui';ctx.fillStyle='rgba(242,230,211,.78)';
  ctx.fillText(window.ConquerWorld3D?.status?.().failed||'Il renderer 3D non è attivo su questo browser.',r.width/2,55);
  ctx.restore();
}
// Developer panel: the renderer in use (World 3D, or none with the reason).
let rendererReadoutState=null;
function updateRendererReadout(ok){
  if(ok===rendererReadoutState)return;rendererReadoutState=ok;
  const el=document.getElementById('rendererReadout');if(!el)return;
  el.textContent=ok?'Renderer: World 3D (WebGL2)':'Renderer: nessuno · '+(window.ConquerWorld3D?.status?.().failed||'WebGL2 non disponibile');
}
function drawConstructionProgress(s){
  const p=w2s(structureCenter(s),structureHeight(s)+.65),pr=constructionProgress(s),w=34,h=5;ctx.save();ctx.fillStyle='rgba(0,0,0,.72)';ctx.fillRect(p.x-w/2,p.y-18,w,h);ctx.fillStyle='#e08a3c';ctx.fillRect(p.x-w/2,p.y-18,w*pr,h);ctx.strokeStyle='rgba(255,255,255,.3)';ctx.strokeRect(p.x-w/2,p.y-18,w,h);if(s.construction?.version===2){ctx.font='9px sans-serif';ctx.textAlign='center';ctx.fillStyle='rgba(255,255,255,.95)';ctx.fillText((s.construction.workers||0)+' L1',p.x,p.y-23)}ctx.restore();
}
function drawStructure(s,preview=false){
  if(s?.type==='road'){drawAutoStructure(s,preview);return}
  if(s?.type==='ruin')return;          // ruined stumps are drawn with their rubble (ConquerSiege)
  // No building has a 2.5D Canvas body (D-RENDER-3D-261111): finished ones are World 3D meshes.
  // Here only the overlays: a site is assembled from the same meshes (ConquerAssembly) or shown as
  // the translucent ghost of its finished World 3D building (footprint volume when it has no mesh),
  // with its progress bar; a placement ghost is its footprint volume.
  if(!preview&&!underConstruction(s))return;
  const assembled=!preview&&window.ConquerAssembly?.has(s)&&window.ConquerAssembly.draw(s);
  if(!assembled&&(preview||!drawSiteGhost(s)))drawPlacementVolume(s,'rgba(244,214,160,.22)','rgba(244,214,160,.92)');
  if(preview)return;
  if(isPlacementFoundationBuilding(s))withStructureGroundPlane(s,()=>drawConstructionProgress(s));
  else if(window.ConquerIndustries?.is(s))withProjectionGroundZ(s.groundZ,()=>drawConstructionProgress(s));
  else drawConstructionProgress(s);
}
// Ghost of a site without an assembly (industries, storage yards, wells, piers, quays, ramps,
// civic annexes, event venues...): its finished World 3D building at SITE_GHOST_ALPHA, cached as a
// bitmap like the assembled sites. false: no finished mesh (the caller draws the footprint volume).
const SITE_GHOST_ALPHA=.42,siteGhostCache=new Map();
function siteGhostMesh(s){
  const W=window.ConquerWorld3D;if(!W?.finishedMesh)return null;
  const key=structureVisualKey(s)+'#'+[State.season,State.visualPalette,State.stonePaletteId].join('|');
  let e=siteGhostCache.get(s.id);
  if(!e||e.key!==key){
    if(siteGhostCache.size>64){const live=new Set((State.structures||[]).map(o=>o.id));for(const id of siteGhostCache.keys())if(!live.has(id))siteGhostCache.delete(id)}
    let mesh=null;try{mesh=W.finishedMesh(s)}catch(err){console.warn('site ghost',s.id,err)}
    e={key,mesh,uid:(e?.uid||0)+1};siteGhostCache.set(s.id,e);
  }
  return e;
}
function drawSiteGhost(s){
  if(!window.ConquerMesh3D)return false;
  const e=siteGhostMesh(s);if(!e?.mesh)return false;
  const c=structureCenter(s)||{x:s.x,y:s.y};
  if(typeof worldPointVisible==='function'&&!worldPointVisible(c,0,320))return true;
  const z=Number.isFinite(s.groundZ)?s.groundZ:terrainElevation(c);
  ctx.save();ctx.globalAlpha=SITE_GHOST_ALPHA;
  window.ConquerMesh3D.drawCached(ctx,'ghost:'+s.id,String(e.uid),()=>[e.mesh],{x:c.x,y:c.y,z});
  ctx.restore();
  return true;
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
// The visual inputs of one structure, shared by the World 3D structure signature (settlement-world3d.js)
// and the derived-geometry memos (room exteriors) so the lists cannot drift apart: geometry, material, the fields of every declared variant (STRUCTURE_VARIANTS: roof,
// hoarding, a small gate's timber upper storey, skins, bells...), rooms and their exterior damage.
// A field missing here leaves a stale mesh or bitmap after the change (qa/render-cache-keys-regression.cjs).
const STRUCTURE_VISUAL_FIELDS=Object.freeze(['id','type','shape','material','masonryMaterial','woodStyle','woodRoof','roofCover',
  'roofStyle','machicolationStyle','bartizan','bartizanCount','bell','innerRoof','signalFire','roofShape','baseStyle','skin','hoarding','upper','topWeapon',
  'r','size','w','h','width','length','angle','rotationStep','level','tier','cutawayFloor','aSnap','bSnap','parentTowerId',
  'orientationOffset','groundZ','foundationMinZ','isMastio']);
function structureVisualKey(s){
  if(!s)return'';
  const num=v=>v==null||v===''?'':Number.isFinite(Number(v))?String(+Number(v).toFixed(4)):String(v);
  let k='';
  for(const f of STRUCTURE_VISUAL_FIELDS)k+=num(s[f])+'|';
  k+=(s.x!=null?num(s.x)+','+num(s.y):'')+'|'+(s.a?num(s.a.x)+','+num(s.a.y):'')+'|'+(s.b?num(s.b.x)+','+num(s.b.y):'')+'|';
  k+=(s.flip?1:0)+''+(s.cutaway?1:0)+(s.signalFireSpent?'F':'')+(s.doorBurnt?'D':'')+(s.burnt?'X':'')+(s.brokenTop?'B':'')+'|';
  // Every declared variant, whatever its name (a new upgrade is covered without editing this list).
  const schema=typeof variantSchema==='function'?variantSchema(s):null;
  if(schema)for(const key of Object.keys(schema).sort())k+=key+'='+(s[key]??'')+';';
  if(s.functions?.length)k+='|'+JSON.stringify(s.functions);
  if(s.roomExteriorHp)k+='|'+JSON.stringify(s.roomExteriorHp);
  return k;
}
// Epoch for short-lived memos of derived geometry (archer slots, room exterior placement): it changes
// whenever the game signals a scene, navigation or structure-list change, and at least once a second
// as a backstop for in-place edits that signal nothing. 0 outside the browser runtime (node QA, Lab
// stubs without the perf counters): callers then recompute every time.
let structureMemoList=null,structureMemoListId=0;
function structureMemoEpoch(){
  const perf=typeof window!=='undefined'&&window.__conquerPerf;
  if(!perf||typeof performance==='undefined'||!Array.isArray(State?.structures))return 0;
  if(State.structures!==structureMemoList){structureMemoList=State.structures;structureMemoListId++}
  const nav=typeof navPerf!=='undefined'?(navPerf.navInvalidations||0):0;
  return structureMemoListId+':'+State.structures.length+':'+(perf.cacheInvalidations||0)+':'+nav+':'+Math.floor(performance.now()/1000);
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
  // The world is World 3D only (settlement-world3d.js, D-RENDER-3D-261111): no Canvas fallback.
  // Without WebGL2, or after a renderer failure, the frame is the "WebGL2 required" notice.
  const world3d=!!(window.ConquerWorld3D?.active?.()&&window.ConquerWorld3D.drawBack(r));
  updateRendererReadout(world3d);
  if(!world3d){drawNo3DNotice(r);endPopulationFrame();return}
  window.ConquerSnowTracks?.draw();
  window.ConquerGore?.draw();   // battlefield blood, arrows and corpses, under the buildings

  // Dynamic placement overlay: switching tools must not invalidate or rebuild the 3D scene.
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
  window.ConquerRoadSignTests?.drawVehicles?.(); // lord/merchant convoys and coach trips on the roads
  window.ConquerJoust?.draw();   // spectators, knights and squires on an active joust ground
  window.ConquerEventPeople?.draw();   // feast and circus: diners, sellers, players, queues
  window.ConquerCourtPeople?.draw();   // the tribunal in session in the town hall cutaway
  window.ConquerIndustries?.drawWorkers();
  window.ConquerWorkAnim?.drawBuilders();
  window.ConquerForestry?.drawCrews?.();   // L1 woodcutters at the forest clearings
  window.ConquerShipyard?.drawShipwrights();   // shipwrights along the hull on the slipways
  window.ConquerCoast?.drawWaves(performance.now()/1000);   // waves on the beaches, spray on the rocks, glints at sea
  window.ConquerFleet?.draw();   // ships at the piers or at anchor, with their crews (settlement-fleet.js)
  markPhase('population');
  drawTrainingSoldiers();
  drawCutawayOccupants();

  drawTowerFlags();
  drawCastleSoldiers();
  window.ConquerTrebuchets?.draw();   // enemy trebuchets: the crews at their posts
  markPhase('castle-units');
  window.ConquerWorld3D.drawFront(r);
  window.ConquerFleet?.drawFigures();   // 3D: crews, fires and arrows over the ships of the front pass
  window.ConquerGulls?.draw(performance.now()/1000);   // seagulls over the coast, above the ships
  window.ConquerSiege?.drawOverlay();
  if(typeof drawRaisedVillagers==='function')drawRaisedVillagers();   // on the Mastio's outer stair
  drawCastleFireFixtures();

  // Moving drawbridges, the Mastio entrance and gate leaves.
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
  window.ConquerWorld3D.drawNightLights3D(r);
  if(!window.ConquerWorld3D.finishFrame()){
    // A failed checkpoint disables World 3D: the next frame is the WebGL2 notice.
    draw();return;
  }
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
