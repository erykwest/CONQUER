'use strict';
// Simulation loop, settlement maintenance and frame scheduling. Extracted verbatim from settlement-app.js.
const SIM_LOGIC_FRAME_MS=100; // topology/growth/completion checks: 10 Hz is plenty
const VISUAL_FRAME_FAST_MS=1000/30;
const VISUAL_FRAME_MEDIUM_MS=1000/24;
const VISUAL_FRAME_HEAVY_MS=1000/15;
let adaptiveVisualFrameMs=VISUAL_FRAME_FAST_MS,simDrawEmaMs=0;
const WEATHER_FRAME_MS=1000/24;
const MAINTENANCE_WATCHDOG_MS=2500;
const LOCAL_AUTOSAVE_MS=5000;
function constructionCompletionsCrossed(beforeDay,afterDay){
  const out=[];
  for(const s of State.structures){
    if(s?.construction?.version===2)continue; // notified by labor tick exactly once
    const d=Number(s?.construction?.completeDay);
    if(Number.isFinite(d)&&d>beforeDay&&d<=afterDay)out.push(s);
  }
  return out;
}
function runSettlementMaintenance(reason='watchdog',completedStructures=[]){
  const t0=performance.now();
  let changed=0;
  const steps={};

  const measureStep=(name,fn)=>{
    const s0=performance.now();
    const n=fn()||0;
    steps[name]=+(performance.now()-s0).toFixed(2);
    changed+=n;
    return n;
  };

  // The periodic watchdog must remain O(cheap). Heavy road reconciliation is
  // scoped to the exact topology class that just completed instead of rescanning
  // every access target on every completion.
  measureStep('towerCollider',()=>syncCompletedTowerWallColliders(false));

  if(reason==='completion'){
    const completedTypes=new Set(completedStructures.map(s=>s?.type).filter(Boolean));

    if(completedTypes.has('gate')){
      measureStep('gateMain',()=>reconcileGateMainConnections(false));
    }

    if(completedTypes.has('tower')||completedTypes.has('gate')||completedTypes.has('well')){
      measureStep('towerSecondary',()=>reconcileTowerSecondaryBranches());
    }

    const accessTargets=completedStructures.filter(s=>
      s&&!underConstruction(s)&&(s.type==='house'||s.type==='field'||isCivic(s))
    );
    if(accessTargets.length){
      measureStep('settlementAccess',()=>{
        let n=0;
        for(const target of accessTargets)n+=ensureSettlementRoadAccess(target);
        return n;
      });
    }
  }else if(reason!=='watchdog'){
    measureStep('gateMain',()=>reconcileGateMainConnections(false));
    measureStep('towerSecondary',()=>reconcileTowerSecondaryBranches());
    measureStep('settlementAccess',()=>reconcileSettlementAccessRoads());
  }

  if(reason==='completion'){
    // Promote only the layers that actually gained completed geometry. Reactive
    // road reconciliation adds ground geometry; it must not dirty landscape.
    invalidateNavigation(false);
    fieldWorkAssignmentCache={key:null,map:new Map()};
    const layers=new Set();
    for(const item of completedStructures)for(const layer of structureSceneLayers(item))layers.add(layer);
    if(changed)layers.add('ground');
    if(layers.size)invalidateSceneCache([...layers]);
  }else if(changed){
    // Watchdog changes are tower/wall collider corrections: castle/base only.
    invalidateSceneCache(['base','castleBody','castleFront']);
  }

  const maintenanceMs=performance.now()-t0;
  window.__conquerAnalytics?.measure('MAINTENANCE',maintenanceMs,{reason,changed,steps});
  if(window.__conquerPerf){
    window.__conquerPerf.lastMaintenanceMs=maintenanceMs;
    window.__conquerPerf.lastMaintenanceSteps=steps;
    window.__conquerPerf.maintenanceRuns=(window.__conquerPerf.maintenanceRuns||0)+1;
  }
  return changed;
}
function simulationFrame(now){
  try{
  const rawDtMs=now-simLast;
  window.__conquerAnalytics?.frame(now,rawDtMs);
  const dt=Math.min(.25,rawDtMs/1000);simLast=now;
  if(State.clock.speed>0){
    const previousDay=State.clock.day;
    State.clock.day+=dt*BASE_DAYS_PER_SECOND*State.clock.speed;
    window.ConquerSiege?.tick(previousDay,State.clock.day);
    // Combat faults must not affect village/economy/render simulation.
    if(window.ConquerCombat&&!window.__conquerCombatSuspended){
      try{window.ConquerCombat.tick(dt*State.clock.speed)}
      catch(err){
        const faults=(window.__conquerCombatFaults||0)+1;
        window.__conquerCombatFaults=faults;
        console.error('CONQUER_COMBAT_TICK_ERROR',err);
        window.__conquerAnalytics?.event('COMBAT_TICK_ERROR',{
          message:String(err?.message||err),stack:String(err?.stack||'').slice(0,800),
          faults
        },'error',1000);
        if(faults>=3){
          window.__conquerCombatSuspended=true;
          status('Combat isolated after repeated errors — settlement simulation remains active');
        }
      }
    }
    if(syncSeasonToCalendar())scheduleLocalSave(100);

    // Time itself remains frame-continuous, but expensive simulation decisions
    // do not need 60 Hz. Growth and completion detection run at 10 Hz.
    let completed=[];
    if(now-simLogicAt>=SIM_LOGIC_FRAME_MS){
      processVillageGrowth();
      tickFields(State.clock.day);
      window.ConquerEconomy?.tick(previousDay,State.clock.day);
      // Player-build projects progress only when available L1 staff actually
      // complete shift work; procedural road/house generation retains V1 clocks.
      const laborCompletions=tickConstructionWork(simLogicDay,State.clock.day);
      completed=[...constructionCompletionsCrossed(simLogicDay,State.clock.day),...laborCompletions];
      simLogicDay=State.clock.day;
      simLogicAt=now;
    }

    // Maintenance follows actual topology events, NOT render frames.
    if(completed.length){
      runSettlementMaintenance('completion',completed);
      if(completed.some(s=>s.type==='tower'))window.ConquerSiege?.syncAutoMastio?.();
      simMaintenanceAt=now;
    }else if(now-simMaintenanceAt>=MAINTENANCE_WATCHDOG_MS){
      runSettlementMaintenance('watchdog');
      simMaintenanceAt=now;
    }

    if(now-simUiAt>=250){
      renderUI();
      simUiAt=now;
    }

    if(now-simDrawAt>=adaptiveVisualFrameMs){
      const t0=performance.now();
      draw();
      const drawMs=performance.now()-t0;

      // Target a visibly fluid 30 FPS while preserving headroom. Scenes that
      // exceed the steady-state budget automatically fall back to 24 or 15 FPS
      // instead of saturating the main thread and producing irregular stalls.
      simDrawEmaMs=simDrawEmaMs?simDrawEmaMs*.82+drawMs*.18:drawMs;
      adaptiveVisualFrameMs=simDrawEmaMs>34?VISUAL_FRAME_HEAVY_MS:
        simDrawEmaMs>20?VISUAL_FRAME_MEDIUM_MS:VISUAL_FRAME_FAST_MS;

      window.__conquerAnalytics?.measure('DRAW',drawMs,{
        visible:window.__conquerPerf?.visibleVillagers||0,
        targetFrameMs:+adaptiveVisualFrameMs.toFixed(1),
        emaMs:+simDrawEmaMs.toFixed(1)
      });
      if(window.__conquerPerf){
        window.__conquerPerf.lastDrawMs=drawMs;
        window.__conquerPerf.drawEmaMs=simDrawEmaMs;
        window.__conquerPerf.visualFrameMs=adaptiveVisualFrameMs;
        window.__conquerPerf.maxDrawMs=Math.max(window.__conquerPerf.maxDrawMs||0,drawMs);
        if(drawMs>50)window.__conquerPerf.longDraws=(window.__conquerPerf.longDraws||0)+1;
      }
      simDrawAt=now;
    }

    // JSON.stringify + localStorage are synchronous and remain off the hot path.
    if(now-simPersistAt>=LOCAL_AUTOSAVE_MS){
      saveLocal();
      simPersistAt=now;
    }
  }else{
    const animatedCutaway=State.structures.some(s=>structureCutaway(s)&&Array.isArray(s.functions)&&s.functions.some(role=>role==='barracks'||role==='quarters'||role==='nobleRoom'));
    // DEV weather/daylight overrides ease even with the simulation paused.
    const ambientTransition=window.ConquerAmbientLight?.isTransitioning?.()||false;
    if((animatedCutaway||ambientTransition)&&now-simDrawAt>=(ambientTransition?WEATHER_FRAME_MS:84)){
      draw();
      simDrawAt=now;
    }
  }
  const shadowState=sunShadowState();
  // 32 shadow poses per daylight arc are visually smooth at settlement scale
  // and avoid rebuilding the full shadow cache several times per second at ×4.
  const shadowPhaseKey=shadowState?Math.round(shadowState.phase*32):-1;
  if(shadowPhaseKey!==lastShadowPhaseKey){
    lastShadowPhaseKey=shadowPhaseKey;
    invalidateSceneCache('shadow');
  }

  const weather=currentWeather();
  const worldWeatherKey=Math.floor(State.clock.day)+'|'+weather.kind;
  if(worldWeatherKey!==lastWorldWeatherKey){
    const previousWasWet=/\|(rain|storm)$/.test(lastWorldWeatherKey),nowWet=weather.rain>0;
    lastWorldWeatherKey=worldWeatherKey;
    puddleCacheKey='';
    if(previousWasWet||nowWet)invalidateSceneCache('ground');
  }
  const weatherActive=State.view.scale<WEATHER_ZOOM_THRESHOLD||weather.wind>.15||weather.rain>0||weather.snow>0||weather.lightning>0||weather.fog>0||State.season==='autumn'||((weather.kind==='clear'||weather.kind==='wind')&&State.season!=='winter');
  if(weatherActive&&now-weatherDrawAt>=WEATHER_FRAME_MS){
    drawWeatherOverlay(now);
    weatherDrawAt=now;
    weatherLayerActive=true;
  }else if(!weatherActive&&weatherLayerActive){
    clearWeatherOverlay();
    weatherLayerActive=false;
  }
  }catch(err){
    // The next animation frame must NOT depend on every optional subsystem
    // completing successfully. Report failures but keep the clock/UI alive.
    console.error('CONQUER_SIMULATION_FRAME_ERROR',err);
    try{window.__conquerAnalytics?.event('SIMULATION_FRAME_ERROR',{
      message:String(err?.message||err),stack:String(err?.stack||'').slice(0,800)
    },'error',1000)}catch(_){}
  }finally{
    requestAnimationFrame(simulationFrame);
  }
}
requestAnimationFrame(simulationFrame);
