'use strict';
// CONQUER /combat — tactical prototype. Classic script, no build dependencies.
(function(){
  const STEP=2, N=WORLD/STEP, FOREST_SIGHT_U=6, VISION_BASE=16, VISION_PER_HEIGHT=4, COLORS={allow:'#ddd8bf',yellow:'#e6b845',green:'#65bc83'};
  const canvasLayer=document.createElement('canvas');
  canvasLayer.id='combatCanvas';
  canvasLayer.setAttribute('aria-hidden','true');
  wrap.appendChild(canvasLayer);
  const g=canvasLayer.getContext('2d');
  const fog=document.createElement('canvas');fog.width=N;fog.height=N;
  const fogCtx=fog.getContext('2d');
  const memory=new Uint8Array(N*N), visible=new Uint8Array(N*N);
  const forestCell=new Int16Array(N*N),heightCell=new Float32Array(N*N);
  let terrainRef=null,forestRef=null,lastVision=0,maskDirty=true,visibilityDirty=true;
  let circleCache=[],circleCacheBucket=-1;
  const strokeBuckets=new Map();let indexedStrokes=-1;
  // Masks are raster unions of auto-generated regions and manual brush marks.
  // They are projected as a single surface per color: no overlapping circle
  // outlines, no doubling alpha, and subtractive strokes cut real holes.
  // Four pixels per world unit prevent the feathered/blurry brush boundaries.
  const ZONE_PIXELS=4, ZONE_SIZE=WORLD*ZONE_PIXELS;
  const zoneImages={};
  for(const mode of ['allow','yellow','green']){
    const surface=document.createElement('canvas'),outline=document.createElement('canvas');
    surface.width=outline.width=ZONE_SIZE;surface.height=outline.height=ZONE_SIZE;
    zoneImages[mode]={surface,outline,ctx:surface.getContext('2d'),outlineCtx:outline.getContext('2d')};
  }
  let zoneSignature='',zoneRevision=0,fogRevision=0;
  // Render static FoW + merged brush masks once into a shared atlas rather
  // than drawing seven large bitmaps into the isometric screen every frame.
  const backdrop=document.createElement('canvas');
  backdrop.width=backdrop.height=ZONE_SIZE;
  const backdropCtx=backdrop.getContext('2d');
  let backdropSignature='';
  let lastObserverSig='',lastAreaSig='',selected=null,selectionDrag=null,painting=false,lastPaint=null;
  const selectedIds=new Set();
  let transitionFrame=0,recallStartedAt=0,alertState='clear';
  const residentMotion=new Map(),residentLastPosition=new Map();
  let transitLastFrame=0;
  let combat=null;
  const archerCache=new Map();
  let archerRoster=[],nextArcherRosterAt=0,archerRosterSize=-1;
  let tacticalRuleAccum=0,combatAnimFrame=0;
  const PATROL_PATH_STEP=.75,PATROL_LOOP_STRIDE=2,PATROL_ROUTE_CACHE_MAX=512;
  let whiteBoundaryCache=[],whiteBoundaryLoopCache=[],whiteBoundarySignature='',whiteBoundaryRevision=0;
  let whiteBoundaryPending=false,patrolNavRevision=0;
  const patrolRouteCache=new Map();


  function defaults(){return{version:2,fog:false,zones:true,brushRadius:5,strokes:[],units:[],enemy:[],storms:[],recall:false,recallMode:'off',seen:''};}
  function restore(raw){
    combat=Object.assign(defaults(),raw&&[1,2].includes(raw.version)?raw:{});
    // This builder starts with the terrain explored (known) but not currently
    // visible. The fog still hides unseen contacts and darkens unobserved areas.
    if(combat.version!==2){combat.seen='';combat.version=2}
    // DEV view defaults to fog OFF even for old snapshots saved with fog ON.
    // The player can still enable it with the Fog button at any time.
    combat.fog=false;
    combat.recallMode=['off','green','hall'].includes(raw?.recallMode)?raw.recallMode:(combat.recall?'green':'off');
    combat.recall=combat.recallMode!=='off';
    combat.strokes=Array.isArray(combat.strokes)?combat.strokes.filter(s=>Number.isFinite(s.x)&&Number.isFinite(s.y)&&Number.isFinite(s.r)&&['allow','deny','yellow','green','eraseYellow','eraseGreen'].includes(s.mode)).slice(-2500):[];
    combat.units=Array.isArray(combat.units)?combat.units
      .filter(u=>Number.isFinite(u.x)&&Number.isFinite(u.y)&&['squad','knight','patrol'].includes(u.kind))
      .map(u=>{
        // Navigation routes are volatile and can contain references to their
        // source unit in old saves. Rebuild them from the destination instead.
        const {path,pathIndex,engaged,nextPatrolAt,patrolLoopPosition,patrolBoundaryIndex,patrolPreviousIndex,patrolAnchorIndex,legs,climbing,stoneClock,...stored}=u;
        return {...stored,target:u.target&&Number.isFinite(u.target.x)&&Number.isFinite(u.target.y)
          ?{x:u.target.x,y:u.target.y}:null};
      }): [];
    combat.enemy=Array.isArray(combat.enemy)?combat.enemy.filter(s=>Number.isFinite(s.x)&&Number.isFinite(s.y))
      .map(({legs,climbing,nextThink,engaged,...e})=>e):[];
    // Ladders and assault towers set against the walls (dev assault).
    combat.storms=Array.isArray(combat.storms)?combat.storms.filter(s=>s&&s.wallId&&s.foot&&s.origin&&['ladder','tower'].includes(s.kind)):[];
    for(const e of combat.enemy){e.faction??='dev_hostile';e.combatKind??='infantry';}
    memory.fill(1);
    try{const saved=atob(combat.seen||'');for(let i=0;i<Math.min(saved.length,memory.length);i++)memory[i]=saved.charCodeAt(i)?1:0}catch(e){}
    visible.fill(0);paintFogBitmap();
    selected=null;selectedIds.clear();selectionDrag=null;lastObserverSig='';lastAreaSig='';maskDirty=true;visibilityDirty=true;circleCacheBucket=-1;indexedStrokes=-1;
    clearCivilianMotions();
    archerCache.clear();archerRoster=[];archerRosterSize=-1;nextArcherRosterAt=0;tacticalRuleAccum=0;
    whiteBoundaryCache=[];whiteBoundaryLoopCache=[];whiteBoundarySignature='';whiteBoundaryRevision=0;
    whiteBoundaryPending=false;patrolNavRevision=0;patrolRouteCache.clear();
    window.ConquerCombatRules?.reset();
    zoneSignature='';backdropSignature='';
    State.combat=combat;syncButtons();refreshFog(true);
  }
  function serialize(){
    if(!combat)return null;
    let chars='';for(let i=0;i<memory.length;i++)chars+=String.fromCharCode(memory[i]);
    combat.seen=btoa(chars);
    // Persist game data, never transient navigation graphs. A direct route
    // previously stored [unit, destination], creating unit -> path -> unit
    // and aborting the entire simulation when saveLocal JSON.stringify ran.
    return {...combat,enemy:combat.enemy.map(({legs,climbing,nextThink,engaged,...e})=>e),units:combat.units.map(u=>{
      const {path,pathIndex,engaged,nextPatrolAt,patrolLoopPosition,patrolBoundaryIndex,patrolPreviousIndex,patrolAnchorIndex,legs,climbing,stoneClock,...stored}=u;
      return {...stored,target:u.target&&Number.isFinite(u.target.x)&&Number.isFinite(u.target.y)
        ?{x:u.target.x,y:u.target.y}:null};
    })};
  }
  function changed(brushInProgress=false){
    // During a brush drag, check alert/LOS at the end rather than for every
    // pointer sample; stamps can arrive substantially faster than 60 Hz.
    if(!brushInProgress&&activeWell())updateAlert(observers());
    State.dirty=true;
    const el=document.getElementById('saveState');if(el)el.textContent='unsaved';
    if(typeof scheduleLocalSave==='function')scheduleLocalSave();
    if(!brushInProgress)syncButtons();
  }
  const point=(x,y)=>({x:Math.max(0,Math.min(WORLD,x)),y:Math.max(0,Math.min(WORLD,y))});
  const activeWell=()=>State.village.founded?State.structures.find(s=>s.id===State.village.wellId&&s.type==='well'):null;
  function startUnits(){
    const well=activeWell();if(!well||combat.units.length)return;
    combat.units=[
      {id:'combat-squad-'+well.id,kind:'squad',x:well.x+2,y:well.y+2,target:null,experience:0},
      {id:'combat-knight-'+well.id,kind:'knight',x:well.x+4,y:well.y+2,target:null}
    ];changed();
  }
  function circles(){
    const well=activeWell();if(!well)return [];
    const bucket=Math.floor(performance.now()/400);
    if(circleCacheBucket===bucket)return circleCache;
    circleCacheBucket=bucket;
    const out=[
      {x:well.x,y:well.y,r:20,mode:'allow',id:'well-access'},
      {x:well.x,y:well.y,r:14,mode:'yellow',id:'well-alert'},
      {x:well.x,y:well.y,r:7,mode:'green',id:'well-safe'}
    ];
    for(const tower of State.structures){
      if(tower.type==='tower'&&!underConstruction(tower))
        out.push({x:tower.x,y:tower.y,r:8+2*structureLevel(tower),mode:'yellow',id:tower.id});
    }
    circleCache=out;return out;
  }
  function nearCircle(p,c){const dx=p.x-c.x,dy=p.y-c.y;return dx*dx+dy*dy<=c.r*c.r}
  function indexStroke(stroke,i){
    const size=8,x0=Math.floor((stroke.x-stroke.r)/size),x1=Math.floor((stroke.x+stroke.r)/size);
    const y0=Math.floor((stroke.y-stroke.r)/size),y1=Math.floor((stroke.y+stroke.r)/size);
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
      const key=x+','+y,list=strokeBuckets.get(key)||[];list.push(i);strokeBuckets.set(key,list);
    }
  }
  function strokeCandidates(p){
    if(indexedStrokes!==combat.strokes.length){
      strokeBuckets.clear();combat.strokes.forEach(indexStroke);indexedStrokes=combat.strokes.length;
    }
    return strokeBuckets.get(Math.floor(p.x/8)+','+Math.floor(p.y/8))||[];
  }
  function appendStroke(stroke){
    const i=combat.strokes.length;combat.strokes.push(stroke);
    if(indexedStrokes===i){indexStroke(stroke,i);indexedStrokes++}
  }
  function areaState(p){
    const well=activeWell();
    if(!well)return{allowed:false,yellow:false,green:false};
    let allowed=false,yellow=false,green=false;
    for(const c of circles()){
      if(!nearCircle(p,c))continue;
      if(c.mode==='allow')allowed=true;
      if(c.mode==='yellow')yellow=true;
      if(c.mode==='green')green=true;
    }
    for(const i of strokeCandidates(p)){
      const stroke=combat.strokes[i];if(!nearCircle(p,stroke))continue;
      if(stroke.mode==='allow')allowed=true;
      else if(stroke.mode==='deny')allowed=false;
      else if(stroke.mode==='yellow')yellow=true;
      else if(stroke.mode==='green')green=true;
      else if(stroke.mode==='eraseYellow')yellow=false;
      else if(stroke.mode==='eraseGreen')green=false;
    }
    return{allowed,yellow,green};
  }
  function closestSafe(p){
    const zones=circles().filter(s=>s.mode==='green')
      .concat(combat.strokes.filter(s=>s.mode==='green'));
    return zones.sort((a,b)=>dist(a,p)-dist(b,p));
  }
  const civilianRouteCache=new Map();
  function pathLength(path){
    let n=0;
    for(let i=1;i<path.length;i++)n+=dist(path[i-1],path[i]);
    return n;
  }
  function routeAllowed(path){
    if(!path?.length)return false;
    for(let i=0;i<path.length;i++){
      if(!areaState(path[i]).allowed)return false;
      if(!i)continue;
      const start=path[i-1],end=path[i],steps=Math.max(1,Math.ceil(dist(start,end)/.5));
      for(let j=1;j<steps;j++){
        const t=j/steps;
        if(!areaState({x:start.x+(end.x-start.x)*t,y:start.y+(end.y-start.y)*t}).allowed)return false;
      }
    }
    return true;
  }
  function findCivilianRoute(start,target,house){
    if(dist(start,target)<.07)return[start,target];
    if(peasantSegmentClear(start,target,house.id)&&routeAllowed([start,target]))return[start,target];
    const key=[house.id,Math.round(start.x*2),Math.round(start.y*2),Math.round(target.x*2),Math.round(target.y*2)].join(':');
    const cached=civilianRouteCache.get(key);
    if(cached){
      const route=[start,...cached.slice(1,-1),target];
      if(routeAllowed(route)&&peasantSegmentClear(start,route[1],house.id)&&
         peasantSegmentClear(route.at(-2),target,house.id))return route;
    }
    // Both the existing road graph and the fallback grid A* must honor White:
    // a mathematically short route outside authorized territory is invalid.
    const road=roadNetworkPath(start,target,house.id);
    const route=road&&routeAllowed(road)?road:findPeasantPath(start,target,house.id,12,p=>areaState(p).allowed);
    if(route?.length>1&&routeAllowed(route)){
      if(civilianRouteCache.size>600)civilianRouteCache.clear();
      civilianRouteCache.set(key,route);
      return route;
    }
    return[start]; // Unreachable: do not teleport or cross forbidden ground.
  }
  function recallDestination(house,resident,origin){
    const zones=closestSafe(origin);
    const seed=peasantHash(resident.id+'-recall');
    for(const zone of zones){
      for(let i=0;i<12;i++){
        const a=((seed%360)/180)*Math.PI+i*Math.PI*2/12;
        const r=Math.min(Math.max(1.5,zone.r*.33),2.9);
        const candidate=point(zone.x+Math.cos(a)*r,zone.y+Math.sin(a)*r);
        const state=areaState(candidate);
        if(state.allowed&&state.green&&!pointBlockedForPeasant(candidate,house.id))return candidate;
      }
    }
    return null;
  }
  // Castle function rooms have an exterior approach; civilians may never
  // path directly through solid walls or magically appear inside a tower.
  function castleAccessCandidates(building,origin,resident){
    const out=[];
    if(building.type==='tower'&&typeof towerDoorSpecs==='function'){
      for(const spec of towerDoorSpecs(building)){
        if(spec.baseZ>.20)continue; // Wall-walk openings are not ground-floor access.
        const p={x:spec.contact.x+spec.outward.x*.48,y:spec.contact.y+spec.outward.y*.48};
        out.push(p);
      }
    }
    if(building.type==='built'){
      const a=structureAccessPoint(building,origin,resident.id);
      const center={x:(building.a.x+building.b.x)/2,y:(building.a.y+building.b.y)/2};
      const opposite={x:2*center.x-origin.x,y:2*center.y-origin.y};
      out.push(a,structureAccessPoint(building,opposite,resident.id));
    }else{
      out.push(structureAccessPoint(building,origin,resident.id));
    }
    return out.filter(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y));
  }
  function buildingDestination(house,resident,origin,buildings){
    let best=null;
    for(const building of buildings.slice().sort((a,b)=>{
      const centerA=structureCenter(a),centerB=structureCenter(b);
      return dist(origin,centerA)-dist(origin,centerB);
    })){
      const entries=castleAccessCandidates(building,origin,resident);
      for(const target of entries){
        if(pointBlockedForPeasant(target,house.id)||!areaState(target).allowed)continue;
        const path=findCivilianRoute(origin,target,house);
        if(!path||path.length<2||dist(path.at(-1),target)>.08)continue;
        const length=pathLength(path);
        if(!best||length<best.length)
          best={target,path,length,structureId:building.id};
      }
    }
    return best;
  }
  function recallMastio(house,resident,origin){
    const keep=window.ConquerSiege?.mastio?.();
    return keep?buildingDestination(house,resident,origin,[keep]):null;
  }
  function recruitArmory(house,resident,origin){
    const armories=window.ConquerSiege?.armories?.()||[];
    return armories.length?buildingDestination(house,resident,origin,armories):null;
  }
  function alarmMode(){return combat?.recallMode||'off'}
  function setAlarmMode(mode){
    if(!combat||!['off','green','hall'].includes(mode))return false;
    if(mode==='hall'&&!window.ConquerSiege?.mastio?.()){
      status('A completed Mastio with a Common Hall is required for the red bell.');
      return false;
    }
    combat.recallMode=mode;
    combat.recall=mode!=='off';
    // Preserve ongoing recruited-men paths when escalating from green to red.
    if(mode==='off')residentMotion.forEach(m=>{if(m.mode==='recruit')m.equipped=false});
    changed();draw();requestCivilianAnimation();
    status(mode==='green'?'🔔 Green alarm: women and children → safe zones; adult men → closest armory':
      mode==='hall'?'🔔 Red alarm: women and children → Mastio Common Hall; adult men → closest armory':
      '🔕 Release: civilians and recalled recruits return to normal routines');
    return true;
  }
  function recruitedResident(id){
    const motion=residentMotion.get(id),now=performance.now();
    return !!(motion?.mode==='recruit'&&motion.structureId&&now>=motion.startedAt+motion.duration
      &&(window.ConquerSiege?.armories?.()||[]).some(a=>a.id===motion.structureId));
  }
  function motionPosition(motion,now){
    if(!motion.path||motion.path.length<2)return motion.start;
    const progress=clamp((now-motion.startedAt)/Math.max(1,motion.duration),0,1);
    return pointAlongPath(motion.path,progress)||motion.start;
  }
  function runningCivilianMotions(){
    const now=performance.now();
    for(const motion of residentMotion.values()){
      if(now<motion.startedAt+motion.duration)return true;
    }
    return false;
  }
  // The settlement already owns a 30/24/15 FPS redraw loop while time runs.
  // A second civilian RAF used to draw the entire 2.5D world AGAIN at 20 FPS,
  // doubling rendering work whenever Recall/Release was enabled.
  // This fallback runs only if the simulation is paused.
  function animateCivilianPaths(now){
    if(!combat||State.clock.speed>0||!runningCivilianMotions()){
      transitionFrame=0;
      return;
    }
    if(now-transitLastFrame>=50){
      transitLastFrame=now;
      draw();
    }
    transitionFrame=requestAnimationFrame(animateCivilianPaths);
  }
  function requestCivilianAnimation(){
    if(State.clock.speed>0){
      if(transitionFrame){cancelAnimationFrame(transitionFrame);transitionFrame=0}
      return;
    }
    if(!transitionFrame&&runningCivilianMotions())
      transitionFrame=requestAnimationFrame(animateCivilianPaths);
  }
  function clearCivilianMotions(){
    residentMotion.clear();residentLastPosition.clear();civilianRouteCache.clear();
    if(transitionFrame)cancelAnimationFrame(transitionFrame);
    transitionFrame=0;
  }
  function civilianLegalPosition(p,house){
    if(!p||areaState(p).allowed)return p;
    // Permission zones constrain civilian autonomy, independently of recalls.
    // Find the last permitted position along this proposed routine journey.
    const anchor=areaState(house).allowed?house:activeWell();
    if(!anchor)return p;
    let low=0,high=1;
    for(let i=0;i<10;i++){
      const t=(low+high)/2,q={x:anchor.x+(p.x-anchor.x)*t,y:anchor.y+(p.y-anchor.y)*t};
      if(areaState(q).allowed)low=t;else high=t;
    }
    return{x:anchor.x+(p.x-anchor.x)*low,y:anchor.y+(p.y-anchor.y)*low};
  }
  function civilPosition(p,house,resident){
    if(!activeWell())return p;
    const desired=civilianLegalPosition(p,house);
    const id=resident.id,now=performance.now(),alarm=alarmMode();
    // Age takes precedence over sex: boys are children, never conscripted.
    const mode=alarm==='off'?'release':
      (resident.age==='adult'&&resident.sex==='male'?'recruit':alarm);
    const prior=residentMotion.get(id);
    if(mode==='release'&&!prior){
      if(desired)residentLastPosition.set(id,desired);
      return desired;
    }
    let motion=prior;
    if(motion?.mode==='recruit'&&!window.ConquerSiege?.armories?.().some(a=>a.id===motion.structureId))
      motion=null; // If an armory is demolished, look for another one.
    if(!motion||motion.mode!==mode){
      const home=typeof houseDoorInfo==='function'?houseDoorInfo(house)?.outside:null;
      const origin=prior?motionPosition(prior,now):residentLastPosition.get(id)||desired||home;
      if(!origin)return desired;
      let result=null;
      if(mode==='green'){
        const target=recallDestination(house,resident,origin);
        if(target)result={target,path:findCivilianRoute(origin,target,house)};
      }else if(mode==='hall')result=recallMastio(house,resident,origin);
      else if(mode==='recruit')result=recruitArmory(house,resident,origin);
      else{
        const target=desired||home||origin;
        result={target,path:findCivilianRoute(origin,target,house)};
      }
      if(!result?.target||!result.path?.length){
        residentMotion.delete(id);
        // No available/accessible hall or armory: do not teleport.
        return desired;
      }
      const length=pathLength(result.path);
      motion={
        mode,homeId:house.id,start:origin,target:result.target,path:result.path,
        structureId:result.structureId||null,startedAt:now,
        duration:result.path.length<2?0:Math.max(450,length*550*(window.ConquerCrossings?.routeMultiplier(result.path)||1))
      };
      residentMotion.set(id,motion);
    }
    const position=motionPosition(motion,now),arrived=now>=motion.startedAt+motion.duration;
    if(mode==='release'&&arrived){
      residentMotion.delete(id);
      if(desired)residentLastPosition.set(id,desired);
      else residentLastPosition.delete(id);
      return desired;
    }
    residentLastPosition.set(id,position);
    if(residentLastPosition.size>5000)residentLastPosition.clear();
    requestCivilianAnimation();
    // Civilians disappear into the Common Hall after reaching its entrance.
    if(mode==='hall'&&arrived&&motion.path.length>1)return null;
    return position;
  }
  function terrainCache(){
    if(State.relief!==terrainRef||State.environment!==forestRef){
      terrainRef=State.relief;forestRef=State.environment;
      forestCell.fill(-2);heightCell.fill(NaN);
      visibilityDirty=true;maskDirty=true;
    }
  }
  function idx(x,y){return y*N+x}
  function forestAt(p){
    for(let i=0;i<State.environment.length;i++){
      const f=State.environment[i];
      if(f.type==='forest'&&environmentContains(f,p))return i;
    }
    return -1;
  }
  function tileForest(x,y){
    const i=idx(x,y);
    if(forestCell[i]===-2)forestCell[i]=forestAt({x:(x+.5)*STEP,y:(y+.5)*STEP});
    return forestCell[i];
  }
  function tileHeight(x,y){
    const i=idx(x,y);
    if(Number.isNaN(heightCell[i]))heightCell[i]=terrainElevation({x:(x+.5)*STEP,y:(y+.5)*STEP});
    return heightCell[i];
  }
  function tileOf(p){return{x:clamp(Math.floor(p.x/STEP),0,N-1),y:clamp(Math.floor(p.y/STEP),0,N-1)}}
  function inForestDeep(p,forestId){
    if(forestId<0)return false;
    const f=State.environment[forestId];if(!f||!f.points)return false;
    let min=Infinity;
    for(let i=0;i<f.points.length;i++)min=Math.min(min,pointSegmentDistance(p,f.points[i],f.points[(i+1)%f.points.length]));
    return min>FOREST_SIGHT_U;
  }
  function observers(){
    const out=[];
    for(const tower of State.structures){
      if(tower.type!=='tower'||underConstruction(tower))continue;
      const h=clamp(Math.round(terrainElevation(tower)+structureLevel(tower)),0,8);
      out.push({x:tower.x,y:tower.y,h,r:VISION_BASE+VISION_PER_HEIGHT*h,id:tower.id});
    }
    for(const unit of combat.units){
      const h=clamp(Math.round(terrainElevation(unit)),0,8);
      out.push({x:unit.x,y:unit.y,h,r:VISION_BASE+VISION_PER_HEIGHT*h,id:unit.id});
    }
    return out;
  }
  function lineVisible(source,target,sourceForest,targetForest){
    if(!urbanHouseLineVisible(source,target))return false;
    const length=dist(source,target),steps=Math.floor(length/STEP);
    for(let k=1;k<steps;k++){
      const t=k/steps,p={x:source.x+(target.x-source.x)*t,y:source.y+(target.y-source.y)*t};
      const q=tileOf(p),terrain=tileHeight(q.x,q.y),forestId=tileForest(q.x,q.y);
      if(terrain>source.h+.05)return false;
      if(forestId>=0&&terrain+1>=source.h-.05){
        // Edge silhouettes may be visible, but deep tree cover hides the cell.
        if(!(forestId===targetForest&&length-dist(source,p)<FOREST_SIGHT_U)&&
           !(forestId===sourceForest&&dist(source,p)<FOREST_SIGHT_U))return false;
      }
    }
    return true;
  }
  function sourceSees(source,target){
    if(dist(source,target)>source.r)return false;
    const sourceForest=forestAt(source),targetForest=forestAt(target);
    if(targetForest>=0){
      if(sourceForest===targetForest){
        if(dist(source,target)>FOREST_SIGHT_U)return false;
      }else if(inForestDeep(target,targetForest))return false;
    }
    if(sourceForest>=0&&sourceForest!==targetForest&&dist(source,target)>FOREST_SIGHT_U)return false;
    return lineVisible(source,target,sourceForest,targetForest);
  }
  function paintFogBitmap(){
    const image=fogCtx.createImageData(N,N);
    for(let i=0;i<visible.length;i++){
      const k=i*4,a=visible[i]?0:memory[i]?158:232;
      image.data[k]=8;image.data[k+1]=12;image.data[k+2]=16;image.data[k+3]=a;
    }
    fogCtx.putImageData(image,0,0);
    fogRevision++;
  }
  function renderFogProjection(pixelRatio){
    const a=w2sRaw({x:0,y:0},0),b=w2sRaw({x:STEP,y:0},0),c=w2sRaw({x:0,y:STEP},0);
    g.save();g.setTransform(pixelRatio*(b.x-a.x),pixelRatio*(b.y-a.y),pixelRatio*(c.x-a.x),pixelRatio*(c.y-a.y),pixelRatio*a.x,pixelRatio*a.y);
    g.imageSmoothingEnabled=false;g.drawImage(fog,0,0);g.restore();
  }
  function refreshFog(force=false){
    if(!combat||!activeWell())return;
    const now=performance.now();
    // Limit full LOS/fog refreshes while units travel or the player paints.
    if(!force&&now-lastVision<500)return;
    startUnits();terrainCache();
    const sources=observers();
    const sig=sources.map(s=>s.id+':'+s.x.toFixed(1)+':'+s.y.toFixed(1)+':'+s.h).join('|')+
      ':structures'+State.structures.length+':env'+State.environment.length;
    // Static watchtowers do not require a full 10k-cell raycast every 2.5s.
    // Retain occasional refresh for in-place terrain / forest edits.
    if(!force&&!visibilityDirty&&sig===lastObserverSig&&now-lastVision<12000)return;
    lastObserverSig=sig;lastVision=now;visibilityDirty=false;
    const fogStart=performance.now();
    visible.fill(0);
    for(const source of sources){
      const x0=Math.max(0,Math.floor((source.x-source.r)/STEP)),x1=Math.min(N-1,Math.ceil((source.x+source.r)/STEP));
      const y0=Math.max(0,Math.floor((source.y-source.r)/STEP)),y1=Math.min(N-1,Math.ceil((source.y+source.r)/STEP));
      const srcForest=forestAt(source);
      for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
        const i=idx(x,y);if(visible[i])continue;
        const p={x:(x+.5)*STEP,y:(y+.5)*STEP};
        if(dist(source,p)>source.r)continue;
        const f=tileForest(x,y);
        if(f>=0){
          if(srcForest===f){if(dist(source,p)>FOREST_SIGHT_U)continue}
          else if(inForestDeep(p,f))continue;
        }
        if(srcForest>=0&&srcForest!==f&&dist(source,p)>FOREST_SIGHT_U)continue;
        if(lineVisible(source,p,srcForest,f)){visible[i]=1;memory[i]=1}
      }
    }
    paintFogBitmap();maskDirty=false;
    const fogMs=performance.now()-fogStart;
    if(window.__conquerPerf)window.__conquerPerf.combatFogMs=fogMs;
    if(fogMs>35)window.__conquerAnalytics?.event('COMBAT_FOG_SLOW',{ms:+fogMs.toFixed(1),observers:sources.length},'warn',3000);
    updateAlert(sources);
  }
  function spotted(p,sources){
    const q=tileOf(p);return !!visible[idx(q.x,q.y)]||sources.some(s=>sourceSees(s,p));
  }
  function updateAlert(sources){
    let next='clear';
    for(const intruder of combat.enemy){
      if(intruder.defeated||intruder.stats?.hp<=0||!spotted(intruder,sources))continue;
      const a=areaState(intruder);
      if(a.green){next='general';break}
      if(a.yellow)next='local';
    }
    if(next!==alertState){
      alertState=next;
      if(next==='general')status('GENERAL ALARM — hostile unit spotted in safe zone');
      else if(next==='local')status('LOCAL ALERT — hostile unit spotted inside yellow zone');
      else status('No hostile contacts in protected zones');
    }
    const el=document.getElementById('combatAlarm');
    if(el){el.textContent=next==='general'?'GENERAL ALARM':next==='local'?'LOCAL ALERT':'No alert';el.dataset.level=next}
  }
  function drawMapCircle(c,strokeOnly=false){
    const steps=48;
    g.beginPath();
    for(let i=0;i<=steps;i++){
      const a=i*Math.PI*2/steps,p=w2sRaw({x:c.x+Math.cos(a)*c.r,y:c.y+Math.sin(a)*c.r},Number.isFinite(c.groundZ)?c.groundZ:0);
      if(i===0)g.moveTo(p.x,p.y);else g.lineTo(p.x,p.y);
    }
    g.closePath();
    if(!strokeOnly)g.fill();g.stroke();
  }

  function updateZoneUnion(){
    const automatic=circles(),brushes=combat.strokes;
    const signature=automatic.map(c=>[c.x,c.y,c.r,c.mode,c.id].join(':')).join('|')+
      '|brush:'+brushes.length+':'+(brushes.at(-1)?Object.values(brushes.at(-1)).join(':'):'');
    if(signature===zoneSignature)return;
    zoneSignature=signature;zoneRevision++;
    for(const region of Object.values(zoneImages)){
      region.ctx.clearRect(0,0,ZONE_SIZE,ZONE_SIZE);
      region.ctx.globalCompositeOperation='source-over';
    }
    for(const stroke of automatic.concat(brushes)){
      const type=stroke.mode;
      const erase=type==='deny'||type==='eraseYellow'||type==='eraseGreen';
      const layer=erase?(type==='deny'?'allow':type==='eraseYellow'?'yellow':'green'):type;
      const region=zoneImages[layer];if(!region)continue;
      const z=region.ctx;z.globalCompositeOperation=erase?'destination-out':'source-over';
      z.fillStyle=erase?'#000':COLORS[layer];
      z.beginPath();z.arc(stroke.x*ZONE_PIXELS,stroke.y*ZONE_PIXELS,stroke.r*ZONE_PIXELS,0,Math.PI*2);z.fill();
    }
    for(const {surface,ctx,outlineCtx} of Object.values(zoneImages)){
      ctx.globalCompositeOperation='source-over';
      outlineCtx.clearRect(0,0,ZONE_SIZE,ZONE_SIZE);
      for(const [x,y] of [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]]){
        outlineCtx.drawImage(surface,x,y);
      }
      outlineCtx.globalCompositeOperation='destination-out';
      outlineCtx.drawImage(surface,0,0);
      outlineCtx.globalCompositeOperation='source-over';
    }
  }
  function renderTacticalBackdrop(pixelRatio){
    if(combat.zones&&activeWell())updateZoneUnion();
    const signature=(combat.fog?fogRevision:'off')+'|'+(combat.zones?zoneRevision:'off')+
      '|'+!!activeWell();
    if(signature!==backdropSignature){
      backdropSignature=signature;
      const c=backdropCtx,t0=performance.now();
      c.setTransform(1,0,0,1,0,0);
      c.clearRect(0,0,ZONE_SIZE,ZONE_SIZE);
      if(combat.fog){
        c.imageSmoothingEnabled=false;
        c.globalAlpha=1;
        c.drawImage(fog,0,0,ZONE_SIZE,ZONE_SIZE);
      }
      if(combat.zones&&activeWell()){
        c.imageSmoothingEnabled=false;
        for(const mode of ['allow','yellow','green']){
          const mask=zoneImages[mode];
          c.globalAlpha=mode==='allow'?.055:mode==='yellow'?.07:.10;
          c.drawImage(mask.surface,0,0);
          c.globalAlpha=.85;
          c.drawImage(mask.outline,0,0);
        }
      }
      c.globalAlpha=1;
      const ms=performance.now()-t0;
      if(window.__conquerPerf)window.__conquerPerf.combatBackdropMs=ms;
      if(ms>30)window.__conquerAnalytics?.event('COMBAT_BACKDROP_SLOW',{ms:+ms.toFixed(1)},'warn',3000);
    }
    if(!combat.fog&&!combat.zones)return;
    const a=w2sRaw({x:0,y:0},0),bx=w2sRaw({x:1/ZONE_PIXELS,y:0},0),by=w2sRaw({x:0,y:1/ZONE_PIXELS},0);
    g.save();
    g.setTransform(pixelRatio*(bx.x-a.x),pixelRatio*(bx.y-a.y),pixelRatio*(by.x-a.x),pixelRatio*(by.y-a.y),pixelRatio*a.x,pixelRatio*a.y);
    g.imageSmoothingEnabled=false;
    g.drawImage(backdrop,0,0);
    g.restore();
  }
  function drawPosedFigure(p,type,id,livery,unit,index=0,z=.08){
    const anim=window.ConquerCombatAnim;
    if(!anim)return drawSoldierFigure(p,z,type,id,State.clock.day,livery);
    // Facing only needs the flat projection; terrain-aware w2s is costly per figure.
    const foe=anim.foeOf(unit);
    const pose=anim.pose(unit,index||0,w2sRaw(p,0),foe?w2sRaw(foe,0):null);
    anim.drawFigure(p,z,type,id,State.clock.day,livery,pose);
  }
  function renderOverlay(){
    if(!combat)return;
    const overlayStart=performance.now();
    const rect=wrap.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);
    if(canvasLayer.width!==Math.round(rect.width*d)||canvasLayer.height!==Math.round(rect.height*d)){
      canvasLayer.width=Math.round(rect.width*d);canvasLayer.height=Math.round(rect.height*d);
    }
    g.setTransform(d,0,0,d,0,0);g.clearRect(0,0,rect.width,rect.height);
    if(activeWell())refreshFog();
    renderTacticalBackdrop(d);
    if(!activeWell())return;
    const king=combat.units.find(u=>u.kind==='knight');
    for(const u of combat.units){
      if(!selectedIds.has(u.id)||u.defeated)continue;
      g.strokeStyle=u.kind==='knight'?'rgba(255,211,116,.86)':'#e3fcac';
      g.lineWidth=1.5;g.setLineDash([5,4]);
      drawMapCircle({...u,r:u.kind==='knight'?16:6,groundZ:terrainElevation(u)+(u.z||0)},true);
      g.setLineDash([]);
    }
    const anim=window.ConquerCombatAnim;
    const characters=[];
    for(const u of combat.units){
      // Defeated units stay on screen while their fall animation plays.
      if(u.defeated&&!anim?.dying(u))continue;
      const z=.08+(u.z||0);
      if(u.kind==='knight')characters.push({p:u,type:'knight',id:u.id,unit:u,z});
      else{
        const count=u.kind==='patrol'?2:5;
        // On a wall walk the men stand in file along the wall.
        const f=!u.climbing&&u.wall?WW()?.frame(u.wall):null;
        for(let i=0;i<count;i++){
          let p;
          if(f){const o=(i-(count-1)/2)*.42;p={x:u.x+f.ux*o,y:u.y+f.uy*o}}
          else{
            const row=Math.floor(i/3),col=i%3,spacing=.55;
            const offset=count===2?(i?spacing/2:-spacing/2):(col-1)*spacing;
            p={x:u.x+offset,y:u.y+(row-.4)*spacing};
          }
          characters.push({p,type:'spearman',id:u.id+':'+i,flag:u.kind==='squad'&&i===0,unit:u,index:i,z});
        }
      }
    }
    characters.sort((a,b)=>viewDepthPoint(a.p)-viewDepthPoint(b.p));
    const sightSources=combat.enemy.length?observers():null;
    withRenderContext(g,()=>{
      for(const soldier of characters){
        drawPosedFigure(soldier.p,soldier.type,soldier.id,null,soldier.unit,soldier.index,soldier.z);
        if(soldier.flag&&!soldier.unit.defeated)withUrbanFigureOcclusion(soldier.p,soldier.z,()=>{
          const base=w2s(soldier.p,soldier.z);
          g.strokeStyle='#5d4535';g.lineWidth=1.8;g.beginPath();
          g.moveTo(base.x+5,base.y-2);g.lineTo(base.x+5,base.y-27);g.stroke();
          g.fillStyle='#d6bd68';g.beginPath();g.moveTo(base.x+5,base.y-27);
          g.lineTo(base.x+19,base.y-24);g.lineTo(base.x+5,base.y-19);g.fill();
        });
      }
      for(const e of combat.enemy){
        const down=e.defeated||e.stats?.hp<=0;
        if((down&&!anim?.dying(e))||!spotted(e,sightSources))continue;
        const livery=window.ConquerCombatRules?.liveryOf(e.faction||'dev_hostile');
        drawPosedFigure(e,'spearman',e.id,livery,e,0,.08+(e.z||0));
        if(down)continue;
        const p=w2s(e,.08+(e.z||0));g.strokeStyle='#e45151';g.lineWidth=2;
        g.beginPath();g.arc(p.x,p.y-8,11,0,Math.PI*2);g.stroke();
      }
    });
    // Combat only advances while the calendar runs; a swing or fall already
    // started still finishes smoothly when the player pauses.
    if(anim?.active()&&State.clock.speed===0&&!combatAnimFrame)
      combatAnimFrame=requestAnimationFrame(()=>{combatAnimFrame=0;draw()});
    // 2.5D view: assault ladders and towers as simple timber outlines (3D draws the models).
    if(combat.storms?.length&&!window.ConquerWorld3D?.active?.())withRenderContext(g,()=>{
      for(const s of combat.storms){
        const ww=WW(),top=ww?.at({wallId:s.wallId,t:s.t});if(!top)continue;
        const a=w2s(s.foot,0),b=w2s(top,top.z+.15);
        g.strokeStyle='#7a5530';g.lineWidth=s.kind==='ladder'?3:9;g.beginPath();g.moveTo(a.x,a.y);g.lineTo(b.x,b.y);g.stroke();
      }
    });
    window.ConquerCombatRules?.drawEffects(g,(p,z)=>w2sRaw(p,z));
    const focused=combat.units.find(u=>u.id===selected);
    // The Builder layout may be replaced by another UI shell. Missing optional
    // HUD controls must never interrupt render/simulation or the combat canvas.
    const selectionLabel=document.getElementById('combatSelection');
    if(selectionLabel)selectionLabel.textContent=selectedIds.size>1
      ?selectedIds.size+' units selected · click destination / Shift to add'
      :selected?((focused?.kind==='squad'?'Pikemen ×5':focused?.kind==='patrol'?'Patrol':'Knight')+' selected · click destination')
      :'Select units · drag a box, Shift+click to add';
    const panel=document.getElementById('combatStats');
    if(panel){
      const hp=x=>x?.stats?Math.max(0,Math.round(x.stats.hp))+'/'+x.stats.maxHp:'—';
      const brain=x=>x?.stats?Math.round(x.stats.brain):'—';
      const allies=combat.units.filter(u=>!u.defeated),hostiles=combat.enemy.filter(e=>!e.defeated);
      panel.textContent='Units '+allies.length+' / Hostiles '+hostiles.length+
        (focused?' · HP '+hp(focused)+' · B '+brain(focused):'')+
        (combat.enemy.length?' · Enemy HP '+hp(combat.enemy[0]):'');
    }
    if(selectionDrag){
      const {start,end}=selectionDrag;
      g.save();g.fillStyle='rgba(198,232,155,.13)';g.strokeStyle='#dcf6ab';g.lineWidth=1.2;
      g.setLineDash([5,3]);g.fillRect(start.x,start.y,end.x-start.x,end.y-start.y);
      g.strokeRect(start.x,start.y,end.x-start.x,end.y-start.y);g.restore();
    }
    const overlayMs=performance.now()-overlayStart;
    if(window.__conquerPerf)window.__conquerPerf.combatOverlayMs=overlayMs;
    if(overlayMs>25)window.__conquerAnalytics?.event('COMBAT_OVERLAY_SLOW',{ms:+overlayMs.toFixed(1),units:combat.units.length,enemies:combat.enemy.length},'warn',3000);
  }
  const SQUAD_FOOTPRINT=[[-.55,-.22],[0,-.22],[.55,-.22],[-.55,.33],[0,.33]];
  function militaryOffsets(kind){return kind==='squad'?SQUAD_FOOTPRINT:[[0,0]]}
  function cliffClearForFootprint(p,kind){
    return militaryOffsets(kind).every(([ox,oy])=>{
      const q={x:p.x+ox,y:p.y+oy};
      return !pointBlockedForPeasant(q)&&!terrainSegmentCrossesCliff(q,q);
    });
  }
  function safeMilitarySegment(a,b,id,kind){
    return peasantSegmentClear(a,b,id)&&militaryOffsets(kind).every(([ox,oy])=>
      peasantSegmentClear({x:a.x+ox,y:a.y+oy},{x:b.x+ox,y:b.y+oy},id));
  }
  function infantryRoute(start,goal,id,kind='knight'){
    if(safeMilitarySegment(start,goal,id,kind))return [start,goal];
    const roads=roadNetworkPath(start,goal,id);
    if(roads?.length>1&&roads.slice(1).every((p,i)=>safeMilitarySegment(roads[i],p,id,kind)))return roads;
    const path=findPeasantPath(start,goal,id,14,p=>cliffClearForFootprint(p,kind));
    return path?.length>1&&path.slice(1).every((p,i)=>safeMilitarySegment(path[i],p,id,kind))?path:null;
  }
  class PatrolMinHeap{
    constructor(){this.a=[]}
    push(n){const a=this.a;a.push(n);let i=a.length-1;while(i>0){const p=(i-1)>>1;if(a[p].f<=n.f)break;a[i]=a[p];i=p}a[i]=n}
    pop(){const a=this.a;if(!a.length)return null;const root=a[0],last=a.pop();if(a.length){let i=0;while(true){let l=i*2+1,r=l+1;if(l>=a.length)break;let m=r<a.length&&a[r].f<a[l].f?r:l;if(a[m].f>=last.f)break;a[i]=a[m];i=m}a[i]=last}return root}
    get length(){return this.a.length}
  }
  function patrolRouteCacheKey(start,goal){
    const q=p=>Math.round(p.x*4)+','+Math.round(p.y*4);
    return whiteBoundaryRevision+'|'+patrolNavRevision+'|'+q(start)+'>'+q(goal);
  }
  function rememberPatrolRoute(key,route){
    if(patrolRouteCache.size>=PATROL_ROUTE_CACHE_MAX){
      const oldest=patrolRouteCache.keys().next().value;
      if(oldest!=null)patrolRouteCache.delete(oldest);
    }
    patrolRouteCache.set(key,route?route.map(p=>({x:p.x,y:p.y})):null);
  }
  function compactPatrolPath(points,id){
    if(!points?.length)return null;
    const out=[points[0]];
    for(let i=1;i<points.length-1;i++){
      const next=points[i+1];
      if(safeMilitarySegment(out.at(-1),next,id,'patrol')&&routeAllowed([out.at(-1),next]))continue;
      out.push(points[i]);
    }
    out.push(points.at(-1));
    return out;
  }
  function findPatrolPath(start,goal,id,pad){
    const step=PATROL_PATH_STEP;
    const minX=Math.floor((Math.min(start.x,goal.x)-pad)/step),maxX=Math.ceil((Math.max(start.x,goal.x)+pad)/step);
    const minY=Math.floor((Math.min(start.y,goal.y)-pad)/step),maxY=Math.ceil((Math.max(start.y,goal.y)+pad)/step);
    const key=(x,y)=>x+','+y,pos=(x,y)=>({x:x*step,y:y*step}),blocked=new Map();
    const unavailable=(x,y)=>{
      const k=key(x,y);if(blocked.has(k))return blocked.get(k);
      const q=pos(x,y),value=x<minX||x>maxX||y<minY||y>maxY||!areaState(q).allowed||pointBlockedForPeasant(q,id);
      blocked.set(k,value);return value;
    };
    function nearestFree(p){
      const cx=Math.round(p.x/step),cy=Math.round(p.y/step);let best=null,bestD=Infinity;
      for(let r=0;r<=4;r++)for(let dx=-r;dx<=r;dx++)for(let dy=-r;dy<=r;dy++){
        if(Math.max(Math.abs(dx),Math.abs(dy))!==r)continue;
        const x=cx+dx,y=cy+dy;if(unavailable(x,y))continue;
        const q=pos(x,y);if(!safeMilitarySegment(p,q,id,'patrol')||!routeAllowed([p,q]))continue;
        const d=dist(p,q);if(d<bestD){best={x,y,q};bestD=d}
      }
      return best;
    }
    const s=nearestFree(start),g=nearestFree(goal);if(!s||!g)return null;
    const open=new PatrolMinHeap(),gScore=new Map([[key(s.x,s.y),0]]),came=new Map(),closed=new Set();
    open.push({x:s.x,y:s.y,f:dist(s.q,g.q)});
    const dirs=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
    let found=false,guard=0;
    while(open.length&&guard++<8000){
      const cur=open.pop(),ck=key(cur.x,cur.y);if(closed.has(ck))continue;closed.add(ck);
      if(cur.x===g.x&&cur.y===g.y){found=true;break}
      for(const [dx,dy] of dirs){
        const nx=cur.x+dx,ny=cur.y+dy,nk=key(nx,ny);if(closed.has(nk)||unavailable(nx,ny))continue;
        if(dx&&dy&&(unavailable(cur.x+dx,cur.y)||unavailable(cur.x,cur.y+dy)))continue;
        const from=pos(cur.x,cur.y),q=pos(nx,ny);
        if(terrainSegmentCrossesCliff(from,q))continue;
        const tentative=(gScore.get(ck)??Infinity)+Math.hypot(dx,dy)*step;
        if(tentative<(gScore.get(nk)??Infinity)){
          gScore.set(nk,tentative);came.set(nk,ck);
          open.push({x:nx,y:ny,f:tentative+dist(q,g.q)});
        }
      }
    }
    if(!found)return null;
    const rev=[],startKey=key(s.x,s.y);let k=key(g.x,g.y);
    while(true){const [x,y]=k.split(',').map(Number);rev.push(pos(x,y));if(k===startKey)break;k=came.get(k);if(!k)return null}
    rev.reverse();
    const path=[start,...rev,goal].filter((p,i,a)=>!i||dist(p,a[i-1])>.02);
    return compactPatrolPath(path,id);
  }
  function patrolRoute(start,goal,id){
    const t0=performance.now(),distance=dist(start,goal),cacheKey=patrolRouteCacheKey(start,goal);
    const perf=window.__conquerPerf||(window.__conquerPerf={});
    perf.patrolRouteCalls=(perf.patrolRouteCalls||0)+1;
    if(patrolRouteCache.has(cacheKey)){
      perf.patrolRouteCacheHits=(perf.patrolRouteCacheHits||0)+1;
      const cached=patrolRouteCache.get(cacheKey);
      const route=cached?.map((p,i,a)=>i===0?{x:start.x,y:start.y}:i===a.length-1?{x:goal.x,y:goal.y}:{...p})||null;
      perf.patrolRouteLastMs=performance.now()-t0;
      return route;
    }
    let route=null,mode='direct';
    if(safeMilitarySegment(start,goal,id,'patrol')&&routeAllowed([start,goal]))route=[start,goal];
    else{
      mode='local-grid';
      perf.patrolLocalSearches=(perf.patrolLocalSearches||0)+1;
      const pad=distance<=4?2.5:Math.min(5,3+distance*.08);
      route=findPatrolPath(start,goal,id,pad);
    }
    if(route?.length>1&&routeAllowed(route)&&route.slice(1).every((p,i)=>safeMilitarySegment(route[i],p,id,'patrol'))){
      rememberPatrolRoute(cacheKey,route);
    }else{
      route=null;rememberPatrolRoute(cacheKey,null);perf.patrolRouteMisses=(perf.patrolRouteMisses||0)+1;
    }
    const ms=performance.now()-t0;perf.patrolRouteLastMs=ms;
    window.__conquerAnalytics?.measure('PATROL_ROUTE',ms,{mode,distance:+distance.toFixed(2),points:route?.length||0});
    return route;
  }
  function selectCombatUnits(units,additive=false,toggle=false){
    if(!additive)selectedIds.clear();
    for(const unit of units){
      if(unit.defeated||unit.routing)continue;
      if(toggle&&selectedIds.has(unit.id))selectedIds.delete(unit.id);
      else selectedIds.add(unit.id);
    }
    selected=[...selectedIds].at(-1)||null;
    syncButtons();
  }
  function clearCombatSelection(){
    selectedIds.clear();selected=null;selectionDrag=null;syncButtons();
  }
  function commanderCoversOrder(unit,target){
    const commander=combat.units.find(u=>u.kind==='knight'&&!u.defeated&&!u.routing);
    return !!commander&&dist(unit,commander)<=16&&dist(target,commander)<=16;
  }
  function issueMove(unit,p,quiet=false){
    if(unit.defeated||unit.routing){
      if(!quiet)status('Unit cannot receive orders');
      return false;
    }
    // The knight's 16U command beacon takes precedence over the subordinate
    // sergeant's 6U personal order radius when both endpoints are covered.
    if(unit.kind==='squad'&&!commanderCoversOrder(unit,p)){
      if(!quiet)status('Out of knight command beacon (16U)');
      return false;
    }
    // A unit on the walls comes down by the nearest stair first.
    if(unit.wall||unit.climbing){
      const legs=planLegs(unit,{ground:point(p.x,p.y)});
      if(!legs){if(!quiet)status('No stair leads down from this wall');return false}
      unit.legs=legs;unit.target=null;unit.path=null;
      if(!quiet){changed();status('Coming down from the wall')}
      return true;
    }
    const target=point(p.x,p.y),path=infantryRoute(unit,target,unit.id,unit.kind);
    if(!path){
      if(!quiet)status('No traversable route — cliff, terrain or obstruction blocks the order');
      return false;
    }
    unit.target=target;unit.path=path.map(p=>({x:p.x,y:p.y}));unit.pathIndex=1;
    if(!quiet){changed();status((unit.kind==='squad'?'Pikemen':unit.kind==='patrol'?'Patrol':'Knight')+' marching via valid terrain')}
    return true;
  }
  function issueGroupMove(target){
    const units=combat.units.filter(u=>selectedIds.has(u.id)&&!u.defeated&&!u.routing);
    if(!units.length)return;
    const centroid={x:units.reduce((sum,u)=>sum+u.x,0)/units.length,y:units.reduce((sum,u)=>sum+u.y,0)/units.length};
    let moved=0;
    for(const unit of units){
      // Preserve group spacing and issue each route independently to avoid
      // stacking entire squads at one destination point.
      if(issueMove(unit,point(target.x+unit.x-centroid.x,target.y+unit.y-centroid.y),true))moved++;
    }
    if(moved)changed();
    status(moved===units.length?moved+' unit(s) marching':moved+'/'+units.length+' orders accepted (command radius / obstacles)');
  }
  function whiteBoundaryPoints(){
    const automatic=circles().filter(c=>c.mode==='allow');
    const last=combat.strokes.at(-1);
    const signature=automatic.map(c=>[c.x,c.y,c.r].join(':')).join('|')+'|'+combat.strokes.length+'|'+
      (last?[last.x,last.y,last.r,last.mode].join(':'):'');
    const signatureChanged=signature!==whiteBoundarySignature;
    if(!window.ConquerCombatRules.shouldRebuildBoundary(painting,whiteBoundaryCache.length>0,signatureChanged))return whiteBoundaryCache;
    whiteBoundarySignature=signature;whiteBoundaryRevision++;
    const points=window.ConquerCombatRules.boundaryPoints(p=>areaState(p).allowed,WORLD,1.25);
    whiteBoundaryCache=points;
    const center=activeWell()||{x:WORLD/2,y:WORLD/2};
    whiteBoundaryLoopCache=window.ConquerCombatRules.traceBoundaryIndices(points,center,1);
    patrolRouteCache.clear();
    for(const unit of combat.units)if(unit.kind==='patrol'){
      unit.patrolLoopPosition=null;unit.patrolBoundaryIndex=null;unit.patrolPreviousIndex=null;
    }
    spacePatrols(points,whiteBoundaryLoopCache);
    return points;
  }
  function spacePatrols(boundary=whiteBoundaryPoints(),loop=whiteBoundaryLoopCache){
    const patrols=combat.units.filter(u=>u.kind==='patrol'&&!u.defeated);
    if(!patrols.length||!boundary.length||!loop.length)return;
    patrols.forEach((unit,i)=>{
      const loopPosition=Math.floor(i*loop.length/patrols.length)%loop.length;
      unit.patrolLoopPosition=loopPosition;
      unit.patrolAnchorIndex=loop[loopPosition];
      unit.patrolBoundaryIndex=null;unit.patrolPreviousIndex=null;unit.patrolDirection=1;
      unit.target=null;unit.path=null;unit.pathIndex=1;unit.nextPatrolAt=0;
    });
  }
  function patrolDestination(unit){
    const boundary=whiteBoundaryPoints(),loop=whiteBoundaryLoopCache;if(!boundary.length||!loop.length)return null;
    let position=Number.isInteger(unit.patrolLoopPosition)?unit.patrolLoopPosition:-1;
    let current=position>=0?loop[position]:-1;
    if(current<0||!boundary[current]||dist(unit,boundary[current])>3.25){
      if(Number.isInteger(unit.patrolAnchorIndex)){
        const anchored=loop.indexOf(unit.patrolAnchorIndex);
        if(anchored>=0)position=anchored;
      }
      if(position<0){
        position=0;let bestD=dist(unit,boundary[loop[0]]);
        for(let i=1;i<loop.length;i++){const d=dist(unit,boundary[loop[i]]);if(d<bestD){bestD=d;position=i}}
      }
      unit.patrolLoopPosition=position;unit.patrolBoundaryIndex=loop[position];unit.patrolAnchorIndex=null;
      return boundary[loop[position]];
    }
    const direction=unit.patrolDirection<0?-1:1;
    position=(position+direction*PATROL_LOOP_STRIDE)%loop.length;if(position<0)position+=loop.length;
    unit.patrolLoopPosition=position;unit.patrolBoundaryIndex=loop[position];unit.patrolPreviousIndex=null;
    return boundary[loop[position]];
  }
  function updatePatrols(now){
    for(const unit of combat.units){
      if(unit.kind!=='patrol'||unit.defeated||unit.routing||unit.target||now<(unit.nextPatrolAt||0))continue;
      const target=patrolDestination(unit);
      unit.nextPatrolAt=target?now:now+300;
      if(target){unit.target=target;unit.path=null;unit.pathIndex=1}
    }
  }
  function addPatrol(){
    const well=activeWell();
    if(!well){status('Found the settlement before adding a White Zone patrol');return}
    startUnits();
    const index=combat.units.filter(u=>u.kind==='patrol').length;
    const angle=index*Math.PI*.77,radius=2.4+(index%3)*.45;
    let spawn=point(well.x+Math.cos(angle)*radius,well.y+Math.sin(angle)*radius);
    if(!areaState(spawn).allowed||pointBlockedForPeasant(spawn,'combat-patrol'))spawn={x:well.x,y:well.y};
    combat.units.push({id:'combat-patrol-'+uid(),kind:'patrol',x:spawn.x,y:spawn.y,target:null,patrolDirection:1});
    spacePatrols();
    visibilityDirty=true;changed();status('White Zone patrol added · 2 pikemen');draw();
  }
  function removePatrol(){
    let index=-1;for(let i=combat.units.length-1;i>=0;i--)if(combat.units[i].kind==='patrol'){index=i;break}
    if(index<0){status('No White Zone patrol to remove');return}
    const [removed]=combat.units.splice(index,1);
    if(selected===removed.id)selected=null;
    selectedIds.delete(removed.id);
    spacePatrols();
    visibilityDirty=true;changed();status('White Zone patrol removed');draw();
  }
  function spawnOccupants(){
    const out=[];
    for(const unit of combat.units.concat(combat.enemy)){
      if(unit.defeated||unit.stats?.hp<=0)continue;
      for(const [ox,oy] of militaryOffsets(unit.kind))out.push({x:unit.x+ox,y:unit.y+oy,r:unit.kind==='knight'?.30:.22});
    }
    return out;
  }
  function civilSpawnPosition(p,house,resident){
    const motion=residentMotion.get(resident.id);
    return motion?motionPosition(motion,performance.now()):civilianLegalPosition(p,house);
  }
  function archers(){
    const now=performance.now();
    if(now<nextArcherRosterAt&&State.structures.length===archerRosterSize)return archerRoster;
    nextArcherRosterAt=now+1000;
    archerRosterSize=State.structures.length;
    const active=new Set(),out=[];
    function put(id,p,visualZ,h,face=null){
      active.add(id);
      let shooter=archerCache.get(id);
      if(!shooter){shooter={id,clock:0};archerCache.set(id,shooter)}
      shooter.x=p.x;shooter.y=p.y;shooter.h=h;shooter.visualZ=visualZ;
      shooter.nx=face?.nx??null;shooter.ny=face?.ny??null;
      shooter.terrainAt=terrainElevation;out.push(shooter);
    }
    for(const s of State.structures){
      if(!['tower','built','gate'].includes(s.type)||underConstruction(s))continue;
      const ground=terrainElevation({x:s.x??s.a?.x,y:s.y??s.a?.y});
      if(s.type==='tower'){
        // Combat shooters are exactly the staffed slots shown by the Builder.
        // No unassigned tower fires and slits have outward firing arcs.
        for(const slot of window.ConquerSiege?.occupiedArcherSlots(s)||[]){
          put(slot.id,slot.p,slot.visualZ,slot.h,slot.kind==='slit'?slot:null);
        }
      }else if(s.type==='gate'){
        if(gateRoofStyle(s)==='battlement')put(s.id+':gate-roof',{x:s.x,y:s.y},ground+structureHeight(s)+.08,ground+structureLevel(s));
      }else if(s.type==='built'){
        const center={x:(s.a.x+s.b.x)/2,y:(s.a.y+s.b.y)/2};
        const level=structureLevel(s);
        const base=terrainElevation(center);
        put(s.id+':arrow-slit',center,base+Math.min(structureHeight(s)-.22,level>=2?2.36:1.3),base+level);
      }
    }
    for(const key of archerCache.keys())if(!active.has(key))archerCache.delete(key);
    archerRoster=out;
    return archerRoster;
  }
  // ---------- walls: troops on the wall walks (settlement-wallwalk.js) ----------
  // A unit is on the ground, climbing (a tower stair or an assault ladder/tower) or on
  // a wall walk: u.wall={wallId,t}, u.z = height above the terrain. Orders become legs:
  // ground route -> climb -> walk along the walls -> climb down -> ground route.
  // Defenders use the stairs in towers and gates; attackers come up at their storm
  // points (ladders, assault towers) and come down inside through the stairs.
  const WW=()=>window.ConquerWallWalk;
  const CLIMB_S=1.6,THINK_S=1;
  const livingUnit=u=>!!u&&!u.defeated&&!(u.stats&&u.stats.hp<=0);
  function unitWall(u){
    if(!u.wall)return null;
    const ww=WW(),e=ww?.edgeOf(u.wall.wallId);
    if(e)return u.wall;
    // The wall under him fell or was split: stay on what is left, or come down.
    const loc=ww?.locate(u,.6);
    if(loc){u.wall={wallId:loc.wallId,t:loc.t};u.z=loc.z;return u.wall}
    u.wall=null;u.z=0;return null;
  }
  const levelOf=u=>u.climbing?'climb':unitWall(u)?'wall:'+WW().component(u.wall):'ground';
  function groundLeg(from,to,u){
    const path=infantryRoute(from,to,u.id,u.kind||'knight');
    // Attackers may need the last stretch against the wall face (inside the wall's clearance).
    const points=(path||[from,to]).map(p=>({x:p.x,y:p.y,z:0}));
    return{kind:'ground',points};
  }
  const climbLeg=(access,up)=>{
    const top=WW().at(access.entry),bottom={x:access.ground.x,y:access.ground.y,z:0};
    return{kind:'climb',from:up?bottom:top,to:up?top:bottom,duration:CLIMB_S,elapsed:0,
      toWall:up?{wallId:access.entry.wallId,t:access.entry.t}:null,stagger:access.stagger||0};
  };
  function accesses(kind){
    const ww=WW();if(!ww)return[];
    const stairs=ww.stairs().map(s=>({id:s.id,ground:s.ground,entry:s.entry,comp:ww.component(s.entry)}));
    if(kind!=='storm')return stairs;
    return(combat.storms||[]).filter(s=>ww.edgeOf(s.wallId)).map(s=>({id:s.id,ground:s.foot,entry:{wallId:s.wallId,t:s.t},comp:ww.component({wallId:s.wallId})}));
  }
  const best=(list,score)=>{let b=null,bs=Infinity;for(const a of list){const s=score(a);if(s<bs){bs=s;b=a}}return b};
  // Legs from where the unit is to target {wall:{wallId,t}} or {ground:{x,y}}.
  // up/down: which accesses may be used to climb and to come down.
  function planLegs(u,target,{up='stairs',down='stairs'}={}){
    const ww=WW();if(!ww)return null;
    const legs=[],here=unitWall(u);let pos={x:u.x,y:u.y};
    if(here&&target.wall&&ww.component(here)===ww.component(target.wall)){
      const r=ww.route(here,target.wall);return r?[{kind:'wall',points:r.points,end:target.wall}]:null;
    }
    if(here){
      const hc=ww.component(here),goal=target.wall?ww.at(target.wall):target.ground;
      const a=best(accesses(down).filter(a=>a.comp===hc),a=>(ww.route(here,a.entry)?.length??Infinity)+Math.hypot(a.ground.x-goal.x,a.ground.y-goal.y));
      if(!a)return null;
      legs.push({kind:'wall',points:ww.route(here,a.entry).points,end:a.entry},climbLeg(a,false));
      pos=a.ground;
    }
    if(target.ground){legs.push(groundLeg(pos,target.ground,u));return legs}
    const tc=ww.component(target.wall);
    const a=best(accesses(up).filter(a=>a.comp===tc),a=>Math.hypot(a.ground.x-pos.x,a.ground.y-pos.y)+(ww.route(a.entry,target.wall)?.length??Infinity));
    if(!a)return null;
    legs.push(groundLeg(pos,a.ground,u),climbLeg(a,true));
    const r=ww.route(a.entry,target.wall);if(r)legs.push({kind:'wall',points:r.points,end:target.wall});
    return legs;
  }
  // Advance a unit along its legs; men stop to fight while engaged.
  function stepLegs(u,dt,speed){
    if(u.engaged||!u.legs?.length)return false;
    let budget=dt*speed,moved=false;
    while(budget>1e-6&&u.legs?.length){
      const leg=u.legs[0];
      if(leg.kind==='climb'){
        if(leg.stagger>0){const w=Math.min(leg.stagger,budget/speed);leg.stagger-=w;budget-=w*speed;continue}
        const use=Math.min(leg.duration-leg.elapsed,budget/speed);leg.elapsed+=use;budget-=use*speed;
        const k=Math.min(1,leg.elapsed/leg.duration);
        u.x=leg.from.x+(leg.to.x-leg.from.x)*k;u.y=leg.from.y+(leg.to.y-leg.from.y)*k;u.z=leg.from.z+(leg.to.z-leg.from.z)*k;
        u.climbing=k<1;u.wall=null;moved=true;
        if(k>=1){u.legs.shift();u.climbing=false;if(leg.toWall)u.wall={...leg.toWall};else u.z=0}
        continue;
      }
      if(!leg.i)leg.i=1;
      const next=leg.points[leg.i];
      if(!next){u.legs.shift();if(leg.kind==='wall'&&leg.end)u.wall={...leg.end};continue}
      const d=Math.hypot(next.x-u.x,next.y-u.y);
      if(d<.02){u.x=next.x;u.y=next.y;leg.i++;continue}
      const step=Math.min(d,budget);
      u.x+=(next.x-u.x)*step/d;u.y+=(next.y-u.y)*step/d;budget-=step;moved=true;
      if(leg.kind==='wall'){
        u.z=next.z;const loc=WW().locate(u,.8);if(loc)u.wall={wallId:loc.wallId,t:loc.t};
      }else{u.z=0;u.wall=null}
    }
    if(!u.legs?.length)u.legs=null;
    return moved;
  }
  // Send units onto a wall top (spread along it) or down to a ground point.
  function issueWallOrder(units,loc){
    const ww=WW(),e=ww.edgeOf(loc.wallId);let ok=0;
    units.forEach((u,i)=>{
      const off=(i-(units.length-1)/2)*.7/Math.max(.5,e.len),t=Math.max(0,Math.min(1,loc.t+off));
      const p=ww.at({wallId:loc.wallId,t});
      if(u.kind==='squad'&&!commanderCoversOrder(u,p))return;
      const legs=planLegs(u,{wall:{wallId:loc.wallId,t}});
      if(!legs)return;
      u.legs=legs;u.target=null;u.path=null;ok++;
    });
    if(ok)changed();
    status(ok?ok+' unit(s) sent onto the wall':'No stair (tower or gate) leads onto this wall');
    return ok;
  }
  // Storm points: an assault ladder or tower set against a wall (ConquerSiege.assaultCheck).
  function addStorm(kind,loc){
    const ww=WW(),f=ww.frame(loc),s=f.wall,level=structureLevel(s);
    const check=window.ConquerSiege?.assaultCheck(s,kind,kind==='tower'?level:1);
    if(!check?.ok){status('Assault refused: '+(check?.reason||'no assault rules'));return null}
    const p=ww.at(loc),face={x:p.x+f.ex*f.half,y:p.y+f.ey*f.half},heading=Math.atan2(-f.ey,-f.ex);
    const SE=window.ConquerSiegeEngines3D,walk=structureHeight(s);
    let foot,origin;
    if(kind==='ladder'){
      const d=walk*Math.tan(SE?.LADDER_LEAN??.3)+.02;
      foot={x:face.x+f.ex*d,y:face.y+f.ey*d};
      const back=SE?.LADDER_FOOT??.17;origin={x:foot.x+f.ex*back,y:foot.y+f.ey*back};
    }else{
      const name=level>1?'tower2':'tower',e=window.ConquerSiegeModel?.engines?.[name];
      const pb=e?.pivots.bridge||[.5,0,1.3],L=e?.rig.bridgeLen||.74,drop=pb[2]-walk,reach=Math.sqrt(Math.max(0,L*L-drop*drop));
      const back=pb[0]+reach-Math.min(f.half,.2);   // origin behind the face so the bridge lands on the wall top
      origin={x:face.x+f.ex*back,y:face.y+f.ey*back};
      const rear=(e?.crew?.[0]?.[0]??-1)-.2;foot={x:origin.x-f.ex*rear,y:origin.y-f.ey*rear};
    }
    const storm={id:'storm-'+uid(),kind,wallId:s.id,t:loc.t,foot,origin,heading,level};
    (combat.storms||(combat.storms=[])).push(storm);
    // Every hostile outside joins the assault.
    let n=0;
    for(const e of combat.enemy)if(livingUnit(e)&&!e.wall){e.assault=storm.id;e.legs=null;e.nextThink=0;n++}
    changed();status((kind==='ladder'?'Ladder':'Assault tower')+' set against the wall · '+n+' attacker(s)');
    return storm;
  }
  // Attackers: climb at their storm point, then hunt defenders along the walls; with no
  // one left on the walls they come down inside through a stair and go for the garrison.
  function assaultThink(e,now){
    if(e.engaged||e.climbing||now<(e.nextThink||0))return;
    e.nextThink=now+THINK_S*1000;
    const ww=WW();if(!ww)return;
    const here=unitWall(e);
    if(!here){
      if(e.legs?.length)return;
      const storm=(combat.storms||[]).find(s=>s.id===e.assault&&ww.edgeOf(s.wallId));
      const inside=!storm||e.cameDown;
      if(!inside){
        const i=combat.enemy.filter(x=>x.assault===storm.id).indexOf(e);
        const legs=planLegs(e,{wall:{wallId:storm.wallId,t:storm.t}},{up:'storm'});
        if(legs){for(const l of legs)if(l.kind==='climb')l.stagger=Math.max(0,i)*.9;e.legs=legs}
        return;
      }
      const foe=best(combat.units.filter(u=>livingUnit(u)&&!u.routing&&!unitWall(u)&&!u.climbing),u=>Math.hypot(u.x-e.x,u.y-e.y));
      if(foe&&Math.hypot(foe.x-e.x,foe.y-e.y)>.8)e.legs=[groundLeg(e,foe,e)];
      return;
    }
    const comp=ww.component(here);
    const onWalls=combat.units.filter(u=>livingUnit(u)&&!u.routing&&unitWall(u)&&ww.component(u.wall)===comp);
    const foe=best(onWalls,u=>Math.hypot(u.x-e.x,u.y-e.y));
    if(foe){
      if(Math.hypot(foe.x-e.x,foe.y-e.y)>.8){const r=ww.route(here,foe.wall);if(r)e.legs=[{kind:'wall',points:r.points,end:foe.wall}]}
      return;
    }
    if(e.legs?.length)return;
    const below=best(combat.units.filter(u=>livingUnit(u)&&!u.routing&&!unitWall(u)),u=>Math.hypot(u.x-e.x,u.y-e.y));
    if(below){const legs=planLegs(e,{ground:{x:below.x,y:below.y}},{down:'stairs'});if(legs){e.legs=legs;e.cameDown=true}}
  }
  // Stones from hoardings and machicolations: men on such a wall hit attackers at its
  // foot, 0-1 U out from the outer face (also men on ladders), every 2.5 s.
  function stoneDrops(step){
    const ww=WW(),rules=window.ConquerCombatRules;if(!ww||!rules?.dropStone)return;
    for(const u of combat.units){
      if(!livingUnit(u)||u.routing||u.engaged||u.climbing||!unitWall(u))continue;
      const f=ww.frame(u.wall);if(!f||f.wall.type!=='wall')continue;
      const skin=wallSkin(f.wall),reach=skin==='hoarding'||(skin==='machicolation'&&hasMachicolation(f.wall))?1:0;
      if(!reach)continue;
      u.stoneClock=(u.stoneClock||0)+step;if(u.stoneClock<2.5)continue;
      const along0=(u.x-f.wall.a.x)*f.ux+(u.y-f.wall.a.y)*f.uy;
      let target=null,bd=Infinity;
      for(const e of combat.enemy){
        if(!livingUnit(e)||unitWall(e))continue;
        const rx=e.x-f.wall.a.x,ry=e.y-f.wall.a.y,along=rx*f.ux+ry*f.uy,out=rx*f.ex+ry*f.ey-f.half;
        if(out<-.05||out>reach||Math.abs(along-along0)>1.6)continue;
        const d=Math.abs(along-along0)+out;if(d<bd){bd=d;target=e}
      }
      if(!target)continue;
      u.stoneClock=0;
      const z=terrainElevation(u)+(u.z||0)+.15;
      rules.dropStone(u,target,{x:u.x+f.ex*(f.half+.12),y:u.y+f.ey*(f.half+.12),z},u.kind==='squad'?2:1);
    }
  }
  // Ladders and assault towers against the walls, for the 3D renderer.
  function dynamicMeshes(){
    const SE=window.ConquerSiegeEngines3D;if(!SE||!combat?.storms?.length)return[];
    return combat.storms.filter(s=>WW()?.edgeOf(s.wallId)).map(s=>{
      const g=terrainElevation(s.origin);
      return s.kind==='ladder'
        ?SE.triangles('ladder',{x:s.origin.x,y:s.origin.y,z:g,heading:s.heading},{up:1})
        :SE.triangles(s.level>1?'tower2':'tower',{x:s.origin.x,y:s.origin.y,z:g,heading:s.heading},{bridge:1});
    });
  }
  function tick(dt){
    if(!combat||!activeWell()||!Number.isFinite(dt)||dt<=0)return;
    dt=Math.min(dt,.25);
    updatePatrols(performance.now());
    let moved=false;
    for(const u of combat.units){
      // Orders onto/along/off the walls run as legs (ground, climb, wall walk).
      if(u.legs?.length&&!u.defeated&&!u.routing){
        if(stepLegs(u,dt,u.kind==='knight'?1.5:u.kind==='patrol'?1.15:.8))moved=true;
        continue;
      }
      if(!u.target||u.defeated||u.routing)continue;
      if(!u.path?.length){
        const route=u.kind==='patrol'?patrolRoute(u,u.target,u.id):infantryRoute(u,u.target,u.id,u.kind);
        u.path=route?.map(p=>({x:p.x,y:p.y}))||null;u.pathIndex=1;
        if(!u.path){u.target=null;if(u.kind==='patrol')u.nextPatrolAt=performance.now()+350;continue}
      }
      let budget=dt*(u.kind==='knight'?1.5:u.kind==='patrol'?1.15:.8)*(window.ConquerCrossings?.movementMultiplier(u)||1);
      while(budget>0&&u.target){
        const next=u.path[u.pathIndex];
        if(!next){u.target=null;u.path=null;break}
        const length=dist(u,next);
        if(length<.025){u.x=next.x;u.y=next.y;u.pathIndex++;continue}
        const step=Math.min(length,budget);
        const nextPos={x:u.x+(next.x-u.x)*step/length,y:u.y+(next.y-u.y)*step/length};
        if(!safeMilitarySegment(u,nextPos,u.id,u.kind)){
          u.target=null;u.path=null;status('Cliff or obstruction blocks unit footprint: stopped');break;
        }
        u.x=nextPos.x;u.y=nextPos.y;budget-=step;moved=true;
        if(step>=length-.025){u.x=next.x;u.y=next.y;u.pathIndex++}
      }
      // Record real military movement on snowy ground (knight = horse track).
      window.ConquerSnowTracks?.observe(u.id,u,State.clock.day,u.kind==='knight'?'horse':'person');
    }
    // Attackers: assault AI at their storm points, then along the walls.
    const nowMs=performance.now();
    for(const e of combat.enemy){
      if(!livingUnit(e)||e.routing)continue;
      if(e.assault)assaultThink(e,nowMs);
      if(e.legs?.length&&stepLegs(e,dt,.8))moved=true;
    }
    if(moved){visibilityDirty=true;maskDirty=true}
    // Combat AI, target acquisition and LOS are capped at 10 Hz.
    // World unit movement remains driven by the regular simulation delta.
    const rules=window.ConquerCombatRules;
    tacticalRuleAccum=Math.min(.25,tacticalRuleAccum+dt);
    if(rules&&tacticalRuleAccum>=.1){
      const step=tacticalRuleAccum;tacticalRuleAccum=0;
      const ruleStart=performance.now();
      const hostiles=combat.enemy.filter(e=>!e.defeated&&(!e.stats||e.stats.hp>0));
      for(const e of hostiles){
        e.h=terrainElevation(e)+(e.z||0);e.visualZ=e.h+.6;e.faction??='dev_hostile';
      }
      rules.update(step,combat.units,combat.enemy,hostiles.length?archers():[],
        (e,shooter)=>{
          // An arrow slit can fire only through its own outward opening;
          // rooftop posts retain a full-circle field of fire.
          if(Number.isFinite(shooter.nx)){
            const d=Math.hypot(e.x-shooter.x,e.y-shooter.y)||1;
            const facing=((e.x-shooter.x)*shooter.nx+(e.y-shooter.y)*shooter.ny)/d;
            if(facing<.45)return false;
          }
          return sourceSees({x:shooter.x,y:shooter.y,h:shooter.h,visualZ:shooter.visualZ,r:rules.shooterRange(shooter,e)},e);
        },
        // Melee only between men on the same level: on the ground, or on the same joined walls.
        (a,b)=>{
          const la=levelOf(a);if(la!==levelOf(b)||la==='climb')return false;
          if(la!=='ground')return true;
          return safeMilitarySegment(a,b,a.id,a.kind||'knight')&&Math.abs(terrainElevation(a)-terrainElevation(b))<=1;
        });
      stoneDrops(step);
      const ruleMs=performance.now()-ruleStart;
      if(window.__conquerPerf)window.__conquerPerf.combatRulesMs=ruleMs;
      if(ruleMs>25)window.__conquerAnalytics?.event('COMBAT_RULES_SLOW',{ms:+ruleMs.toFixed(1),archers:hostiles.length?archerRoster.length:0,hostiles:hostiles.length},'warn',3000);
    }
  }
  function paint(p,mode){
    const q=point(p.x,p.y),r=clamp(Number(combat.brushRadius)||5,1,16);
    if(lastPaint&&dist(lastPaint,q)>r*.55){
      const count=Math.ceil(dist(lastPaint,q)/(r*.45));
      for(let i=1;i<count;i++){
        const t=i/count;appendStroke({x:lastPaint.x+(q.x-lastPaint.x)*t,y:lastPaint.y+(q.y-lastPaint.y)*t,r,mode});
      }
    }
    appendStroke({x:q.x,y:q.y,r,mode});
    if(combat.strokes.length>2500){combat.strokes.splice(0,combat.strokes.length-2500);indexedStrokes=-1;}
    lastPaint=q;civilianRouteCache.clear();invalidateUrbanGeometry();invalidateSceneCache('ground');changed(true);
  }
  let queuedToolDraw=false;
  function requestToolDraw(){
    // Active simulation already repaints the full world at an adaptive FPS.
    // Avoid synchronous redraws for every mousemove on brush strokes.
    if(State.clock.speed>0||queuedToolDraw)return;
    queuedToolDraw=true;
    requestAnimationFrame(()=>{queuedToolDraw=false;draw()});
  }
  function handleDown(e){
    if(e.button!==0)return;
    const p=pointerWorld(e),kind=State.tool.kind;
    if(kind==='combat-brush'){
      e.preventDefault();e.stopImmediatePropagation();painting=true;lastPaint=null;
      canvas.setPointerCapture(e.pointerId);paint(p,State.tool.combatBrush);requestToolDraw();return;
    }
    if(kind==='combat-storm'){
      e.preventDefault();e.stopImmediatePropagation();
      const hit=WW()?.pickScreen(pointerScreen(e))||WW()?.locate(p,1.2);
      if(!hit){status('Click the top of a wall (T2+, finished)');return}
      if(addStorm(State.tool.stormKind,{wallId:hit.wallId,t:hit.t}))setTool({kind:'select',label:'Select'});
      syncButtons();draw();return;
    }
    if(kind==='combat-intruder'){
      e.preventDefault();e.stopImmediatePropagation();
      combat.enemy.push({id:uid(),x:p.x,y:p.y,faction:'dev_hostile',combatKind:'infantry'});changed();setTool({kind:'select',label:'Select'});
      status('Test intruder placed — visible only within line of sight');draw();return;
    }
    if(kind==='combat-orders'||kind==='select'){
      const hit=combat.units.filter(u=>!u.defeated&&!u.routing&&dist(u,p)<1.1)
        .sort((a,b)=>dist(a,p)-dist(b,p))[0];
      if(hit){
        e.preventDefault();e.stopImmediatePropagation();
        selectCombatUnits([hit],e.shiftKey,e.shiftKey);
        setTool({kind:'combat-orders',label:'Orders: select, Shift+click or drag a box'});
        syncButtons();draw();return;
      }
      // Delay blank-ground action until pointerup to distinguish a move order
      // from box selection. Capture-phase prevents building clicks on drags.
      e.preventDefault();e.stopImmediatePropagation();
      const start=pointerScreen(e);
      selectionDrag={pointerId:e.pointerId,start,end:{...start},shift:e.shiftKey,kind};
      canvas.setPointerCapture(e.pointerId);requestToolDraw();return;
    }
  }
  canvas.addEventListener('pointerdown',handleDown,true);
  canvas.addEventListener('pointermove',e=>{
    if(selectionDrag&&selectionDrag.pointerId===e.pointerId){
      e.preventDefault();e.stopImmediatePropagation();
      selectionDrag.end=pointerScreen(e);
      requestToolDraw();return;
    }
    if(!painting)return;
    e.stopImmediatePropagation();e.preventDefault();paint(pointerWorld(e),State.tool.combatBrush);requestToolDraw();
  },true);
  for(const type of ['pointerup','pointercancel'])canvas.addEventListener(type,e=>{
    if(selectionDrag&&selectionDrag.pointerId===e.pointerId){
      e.preventDefault();e.stopImmediatePropagation();
      const drag=selectionDrag;selectionDrag=null;
      if(canvas.hasPointerCapture?.(e.pointerId))canvas.releasePointerCapture(e.pointerId);
      if(type==='pointercancel'){draw();return}
      drag.end=pointerScreen(e);
      const dx=drag.end.x-drag.start.x,dy=drag.end.y-drag.start.y;
      if(Math.hypot(dx,dy)>=6){
        const x0=Math.min(drag.start.x,drag.end.x),x1=Math.max(drag.start.x,drag.end.x);
        const y0=Math.min(drag.start.y,drag.end.y),y1=Math.max(drag.start.y,drag.end.y);
        const hits=combat.units.filter(u=>{
          if(u.defeated||u.routing)return false;
          const q=w2s(u,.08+(u.z||0));return q.x>=x0&&q.x<=x1&&q.y>=y0&&q.y<=y1;
        });
        selectCombatUnits(hits,drag.shift);
        if(hits.length)setTool({kind:'combat-orders',label:'Orders: click destination'});
      }else if(drag.kind==='combat-orders'&&selectedIds.size&&!drag.shift){
        // Clicking a wall top sends the selection up onto the wall walk.
        const wallHit=WW()?.pickScreen(pointerScreen(e));
        if(wallHit)issueWallOrder(combat.units.filter(u=>selectedIds.has(u.id)&&!u.defeated&&!u.routing),wallHit);
        else issueGroupMove(pointerWorld(e));
      }else if(!drag.shift){
        clearCombatSelection();
        if(drag.kind==='select'){
          const sp=pointerScreen(e);
          selectStructure(structureAtScreen(sp)||structureAt(pointerWorld(e)));
        }
      }
      draw();return;
    }
    if(!painting)return;
    painting=false;lastPaint=null;e.stopImmediatePropagation();
    // Apply White Zone edits once on pointer release; never re-route each drag sample.
    whiteBoundaryPending=false;whiteBoundarySignature='';patrolNavRevision++;patrolRouteCache.clear();
    for(const u of combat.units)if(u.kind==='patrol'){u.target=null;u.path=null;u.nextPatrolAt=0}
    if(activeWell())updateAlert(observers());
    scheduleLocalSave();requestToolDraw();
  },true);
  window.addEventListener?.('keydown',e=>{
    if(e.key!=='Escape'||!selectedIds.size||/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName||''))return;
    clearCombatSelection();setTool({kind:'select',label:'Select'});draw();
  },true);
  const styles=document.createElement('style');
  styles.textContent='#combatCanvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:4} #combatControls{border:1px solid #78634c;border-radius:10px;padding:9px;margin:8px 0;background:#211b15} #combatControls h3{margin:3px 0 8px} #combatControls .combat-row{display:flex;gap:4px;margin-bottom:5px} #combatControls button{font-size:11px;flex:1;padding:7px 4px} #combatControls .combat-row button.active{background:#f2c772;color:#20180c} #combatRecall[data-mode=green]{background:#35874e;color:#fff} #combatRecall[data-mode=hall]{background:#ad3438;color:#fff} #combatMute:disabled{opacity:.55} #combatControls label{font-size:11px;display:flex;gap:8px;align-items:center} #combatControls input{flex:1;min-width:0} #combatAlarm[data-level=general]{color:#fc6868} #combatAlarm[data-level=local]{color:#efc06c}';
  document.head.appendChild(styles);
  const ui=document.createElement('div');
  ui.id='combatControls';
  ui.innerHTML='<h3>COMBAT · Fog / Command</h3>'+
    '<div class="combat-row"><button id="combatFog">Fog ON</button><button id="combatZones">Zones ON</button><button id="combatRecall" title="Bell: green safe zones, then red Mastio Common Hall" aria-label="Raise alarm">🔔</button><button id="combatMute" title="Release all recalled civilians and recruits" aria-label="Release">🔕</button></div>'+
    '<div class="combat-row"><button data-combat-brush="allow">White +</button><button data-combat-brush="deny">White −</button><button data-combat-brush="yellow">Yellow</button><button data-combat-brush="green">Green</button></div>'+
    '<div class="combat-row"><button data-combat-brush="eraseYellow">− Yellow</button><button data-combat-brush="eraseGreen">− Green</button><button id="combatOrders">Orders</button><button id="combatDeselect" title="Clear selection (Esc)">Deselect</button></div>'+
    '<div class="combat-row"><button id="combatPatrolAdd" title="Add two pikemen to patrol the White Zone border">Patrol + · 2 pikemen</button><button id="combatPatrolRemove">Patrol −</button></div>'+ 
    '<div class="legend" id="combatPatrolCount">White Zone patrols · 0</div>'+ 
    '<label>Brush radius <input id="combatBrushSize" type="range" min="1" max="16" value="5"><b id="combatBrushReadout">5U</b></label>'+
    '<div class="combat-row"><button id="combatIntruder">Test intruder</button><button id="combatClearEnemies">Clear intruders</button></div>'+
    '<div class="combat-row"><button data-combat-storm="ladder" title="Set an assault ladder against a wall: intruders storm it">Assault · ladder</button><button data-combat-storm="tower" title="Set an assault tower against a wall: intruders storm it">Assault · tower</button></div>'+
    '<div class="legend" id="combatSelection">Select a unit to move</div>'+ 
    '<div class="legend" id="combatStats">Combat stats · Coffee Battles</div>'+
    '<div class="legend" id="combatAlarm" data-level="clear">No alert</div>';
  document.querySelector('#builder h2').insertAdjacentElement('afterend',ui);
  const $=id=>document.getElementById(id);
  function syncButtons(){
    if(!combat||!$('combatFog'))return;
    $('combatFog').textContent='Fog '+(combat.fog?'ON':'OFF');
    $('combatZones').textContent='Zones '+(combat.zones?'ON':'OFF');
    $('combatRecall').textContent='🔔';
    $('combatRecall').dataset.mode=combat.recallMode;
    $('combatRecall').title=combat.recallMode==='green'?'Green alarm · click to retreat into the Mastio':combat.recallMode==='hall'?'Red alarm · women and children in Common Hall':'Raise green alarm';
    $('combatMute').disabled=combat.recallMode==='off';
    $('combatBrushSize').value=combat.brushRadius;
    $('combatBrushReadout').textContent=combat.brushRadius+'U';
    const patrols=combat.units.filter(u=>u.kind==='patrol').length;
    $('combatPatrolCount').textContent='White Zone patrols · '+patrols+' ('+(patrols*2)+' pikemen)';
    $('combatPatrolRemove').disabled=patrols===0;
    // Keep Add clickable before founding: the action explains the prerequisite.
    document.querySelectorAll('[data-combat-brush]').forEach(b=>b.classList.toggle('active',State.tool.kind==='combat-brush'&&State.tool.combatBrush===b.dataset.combatBrush));
    document.querySelectorAll('[data-combat-storm]').forEach(b=>b.classList.toggle('active',State.tool.kind==='combat-storm'&&State.tool.stormKind===b.dataset.combatStorm));
    $('combatOrders').classList.toggle('active',State.tool.kind==='combat-orders');
    $('combatDeselect').disabled=selectedIds.size===0;
  }
  $('combatFog').onclick=()=>{combat.fog=!combat.fog;changed();draw()};
  $('combatZones').onclick=()=>{combat.zones=!combat.zones;changed();draw()};
  $('combatRecall').onclick=()=>setAlarmMode(alarmMode()==='green'?'hall':'green');
  $('combatMute').onclick=()=>setAlarmMode('off');
  document.querySelectorAll('[data-combat-brush]').forEach(b=>b.onclick=()=>{
    setTool({kind:'combat-brush',combatBrush:b.dataset.combatBrush,label:'Brush: '+b.textContent});
    syncButtons();
  });
  $('combatBrushSize').oninput=e=>{combat.brushRadius=Number(e.target.value);changed();draw()};
  $('combatOrders').onclick=()=>{setTool({kind:'combat-orders',label:'Click or box-select friendly units, Shift to add'});syncButtons()};
  $('combatDeselect').onclick=()=>{clearCombatSelection();setTool({kind:'select',label:'Select'});draw()};
  $('combatPatrolAdd').onclick=addPatrol;
  $('combatPatrolRemove').onclick=removePatrol;
  $('combatIntruder').onclick=()=>{setTool({kind:'combat-intruder',label:'Click terrain to position a test enemy'});syncButtons()};
  $('combatClearEnemies').onclick=()=>{combat.enemy=[];combat.storms=[];window.ConquerCombatRules?.reset();changed();alertState='clear';draw()};
  document.querySelectorAll('[data-combat-storm]').forEach(b=>b.onclick=()=>{
    setTool({kind:'combat-storm',stormKind:b.dataset.combatStorm,label:'Click the top of a wall to storm it'});syncButtons();
  });
  const priorDraw=draw;
  draw=function(){priorDraw();renderOverlay()};
  const initial=State.combat;restore(initial);
  window.ConquerCombat={tick,serialize,restore,civilPosition,areaState,sourceSees,observers,spawnOccupants,civilSpawnPosition,
    dynamicMeshes,addStorm,issueWallOrder,planLegs,
    alarmMode,setAlarmMode,recruitedResident,
    selectedUnitIds:()=>[...selectedIds],commandAuthorityAt:(unitId,p)=>{
      const unit=combat?.units.find(u=>u.id===unitId);return !!unit&&commanderCoversOrder(unit,p);
    },
    yellowGeometry:()=>circles().filter(c=>c.mode==='yellow').concat(combat.strokes.filter(c=>['yellow','eraseYellow'].includes(c.mode))),
    invalidateRoutes:()=>{civilianRouteCache.clear();circleCacheBucket=-1;visibilityDirty=true;
      whiteBoundarySignature='';patrolNavRevision++;patrolRouteCache.clear();
      for(const u of combat?.units||[]){u.path=null;if(u.kind==='patrol'){u.target=null;u.nextPatrolAt=0}}},
    invalidateArchers:()=>{nextArcherRosterAt=0;archerRosterSize=-1},
    visibilityAt:p=>spotted(p,observers()),refresh:()=>{visibilityDirty=true;refreshFog(true);draw()}};
  draw();
})();
