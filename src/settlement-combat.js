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
  const ZONE_PIXELS=2, ZONE_SIZE=WORLD*ZONE_PIXELS;
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
  let lastObserverSig='',lastAreaSig='',selected=null,painting=false,lastPaint=null;
  let transitionFrame=0,recallStartedAt=0,alertState='clear';
  const residentMotion=new Map(),residentLastPosition=new Map();
  let transitLastFrame=0;
  let combat=null;
  const archerCache=new Map();
  let archerRoster=[],nextArcherRosterAt=0,archerRosterSize=-1;
  let tacticalRuleAccum=0;
  const PATROL_PATH_STEP=.75,PATROL_LOOP_STRIDE=2,PATROL_ROUTE_CACHE_MAX=512;
  let whiteBoundaryCache=[],whiteBoundaryLoopCache=[],whiteBoundarySignature='',whiteBoundaryRevision=0;
  let whiteBoundaryPending=false,patrolNavRevision=0;
  const patrolRouteCache=new Map();

  function defaults(){return{version:2,fog:true,zones:true,brushRadius:5,strokes:[],units:[],enemy:[],recall:false,seen:''};}
  function restore(raw){
    combat=Object.assign(defaults(),raw&&[1,2].includes(raw.version)?raw:{});
    // This builder starts with the terrain explored (known) but not currently
    // visible. The fog still hides unseen contacts and darkens unobserved areas.
    if(combat.version!==2){combat.seen='';combat.version=2}
    combat.fog=true;
    combat.strokes=Array.isArray(combat.strokes)?combat.strokes.filter(s=>Number.isFinite(s.x)&&Number.isFinite(s.y)&&Number.isFinite(s.r)&&['allow','deny','yellow','green','eraseYellow','eraseGreen'].includes(s.mode)).slice(-2500):[];
    combat.units=Array.isArray(combat.units)?combat.units
      .filter(u=>Number.isFinite(u.x)&&Number.isFinite(u.y)&&['squad','knight','patrol'].includes(u.kind))
      .map(u=>{
        // Navigation routes are volatile and can contain references to their
        // source unit in old saves. Rebuild them from the destination instead.
        const {path,pathIndex,engaged,nextPatrolAt,patrolLoopPosition,patrolBoundaryIndex,patrolPreviousIndex,patrolAnchorIndex,...stored}=u;
        return {...stored,target:u.target&&Number.isFinite(u.target.x)&&Number.isFinite(u.target.y)
          ?{x:u.target.x,y:u.target.y}:null};
      }): [];
    combat.enemy=Array.isArray(combat.enemy)?combat.enemy.filter(s=>Number.isFinite(s.x)&&Number.isFinite(s.y)).map(e=>{
      const {path,pathIndex,engaged,aiNextAt,...stored}=e;
      return{...stored,target:e.target&&Number.isFinite(e.target.x)&&Number.isFinite(e.target.y)?{x:e.target.x,y:e.target.y}:null};
    }):[];
    for(const e of combat.enemy){e.faction??='dev_hostile';e.combatKind??='infantry';e.environmental??=true;}
    memory.fill(1);
    try{const saved=atob(combat.seen||'');for(let i=0;i<Math.min(saved.length,memory.length);i++)memory[i]=saved.charCodeAt(i)?1:0}catch(e){}
    visible.fill(0);paintFogBitmap();
    selected=null;lastObserverSig='';lastAreaSig='';maskDirty=true;visibilityDirty=true;circleCacheBucket=-1;indexedStrokes=-1;
    clearCivilianMotions();
    archerCache.clear();archerRoster=[];archerRosterSize=-1;nextArcherRosterAt=0;tacticalRuleAccum=0;
    whiteBoundaryCache=[];whiteBoundaryLoopCache=[];whiteBoundarySignature='';whiteBoundaryRevision=0;whiteBoundaryPending=false;
    patrolNavRevision=0;patrolRouteCache.clear();
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
    const storedUnit=u=>{
      const {path,pathIndex,engaged,nextPatrolAt,patrolLoopPosition,patrolBoundaryIndex,patrolPreviousIndex,patrolAnchorIndex,...stored}=u;
      return {...stored,target:u.target&&Number.isFinite(u.target.x)&&Number.isFinite(u.target.y)
        ?{x:u.target.x,y:u.target.y}:null};
    };
    return {...combat,units:combat.units.map(storedUnit),enemy:combat.enemy.map(storedUnit)};
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
    const id=resident.id,now=performance.now();
    const prior=residentMotion.get(id),mode=combat.recall?'recall':'release';
    if(!combat.recall&&!prior){
      if(desired)residentLastPosition.set(id,desired);
      return desired;
    }
    // Residents not outside have nothing to flee from until they emerge.
    if(!desired&&!prior&&!combat.recall)return null;
    if(!desired&&!prior&&combat.recall)return null;
    let motion=prior;
    if(!motion||motion.mode!==mode){
      const origin=prior?motionPosition(prior,now):residentLastPosition.get(id)||desired;
      const home=typeof houseDoorInfo==='function'?houseDoorInfo(house)?.outside:null;
      const destination=combat.recall
        ?recallDestination(house,resident,origin)
        :(desired||home||origin);
      if(origin&&destination){
        const path=findCivilianRoute(origin,destination,house);
        const length=pathLength(path);
        motion={
          mode,homeId:house.id,start:origin,target:destination,path,startedAt:now,
          duration:path.length<2?0:Math.max(450,length*550)
        };
        residentMotion.set(id,motion);
      }else{
        residentMotion.delete(id);
        if(desired)residentLastPosition.set(id,desired);
        return desired;
      }
    }
    const position=motionPosition(motion,now);
    if(mode==='release'&&now>=motion.startedAt+motion.duration){
      residentMotion.delete(id);
      if(desired)residentLastPosition.set(id,desired);
      else residentLastPosition.delete(id);
      return desired;
    }
    residentLastPosition.set(id,position);
    if(residentLastPosition.size>5000)residentLastPosition.clear();
    requestCivilianAnimation();
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
      if(unit.defeated)continue;
      const h=clamp(Math.round(terrainElevation(unit)),0,8);
      out.push({x:unit.x,y:unit.y,h,r:VISION_BASE+VISION_PER_HEIGHT*h,id:unit.id});
    }
    // Completed gate guards and wall patrols are local sentries. They reveal a
    // smaller area than the mobile commander/squad and keep their positions in
    // the population simulation rather than duplicating render-only state.
    for(const s of State.structures){
      if(underConstruction(s))continue;
      if(s.type==='gate'){
        for(const [i,p] of gateGuardPositions(s).entries())out.push({...p,h:terrainElevation(p),r:10,id:s.id+':guard:'+i});
      }else if(['wall','palisade'].includes(s.type)){
        const tier=wallTier(s),count=tier===1?0:tier===3?2:1;
        for(let i=0;i<count;i++){
          const p=wallPatrolPoint(s,State.clock.day,i,count);
          const z=s.type==='palisade'?palisadePatrolSurface(s).z:structureHeight(s)+.10;
          out.push({...p,h:terrainElevation(p)+z,r:10+2*structureLevel(s),id:s.id+':patrol:'+i});
        }
      }
    }
    return out;
  }
  function lineVisible(source,target,sourceForest,targetForest){
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
        c.imageSmoothingEnabled=true;
        for(const mode of ['allow','yellow','green']){
          const mask=zoneImages[mode];
          c.globalAlpha=mode==='allow'?.055:mode==='yellow'?.07:.10;
          c.drawImage(mask.surface,0,0);
          c.globalAlpha=.30;
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
    g.imageSmoothingEnabled=true;
    g.drawImage(backdrop,0,0);
    g.restore();
  }
  const SQUAD_FOOTPRINT=[[-.55,-.22],[0,-.22],[.55,-.22],[-.55,.33],[0,.33]];
  function militaryOffsets(kind){return kind==='squad'?SQUAD_FOOTPRINT:[[0,0]]}
  function cliffClearForFootprint(p,kind){
    return militaryOffsets(kind).every(([ox,oy])=>!terrainSegmentCrossesCliff(
      {x:p.x+ox,y:p.y+oy},{x:p.x+ox,y:p.y+oy}));
  }
  function safeMilitarySegment(a,b,id,kind){
    return peasantSegmentClear(a,b,id)&&militaryOffsets(kind).every(([ox,oy])=>
      !terrainSegmentCrossesCliff({x:a.x+ox,y:a.y+oy},{x:b.x+ox,y:b.y+oy}));
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
  function issueMove(unit,p){
    if(unit.defeated||unit.routing){status('Unit cannot receive orders');return}
    if(unit.kind==='squad'){
      const knight=combat.units.find(u=>u.kind==='knight'&&!u.defeated);
      if(!knight||dist(unit,knight)>16||dist(p,knight)>16){
        status('Out of knight command beacon (16U)');return;
      }
      if(dist(unit,p)>6){status('Sergeant order limit: maximum 6U per order');return}
    }
    const target=point(p.x,p.y),path=infantryRoute(unit,target,unit.id,unit.kind);
    if(!path){status('No traversable route — cliff, terrain or obstruction blocks the order');return}
    unit.target=target;unit.path=path.map(p=>({x:p.x,y:p.y}));unit.pathIndex=1;changed();
    status((unit.kind==='squad'?'Pikemen':'Knight')+' marching via valid terrain');
  }
  function advanceUnit(unit,dt,speed){
    if(!unit.target||unit.defeated)return false;
    if(!unit.path?.length){
      const route=unit.kind==='patrol'?patrolRoute(unit,unit.target,unit.id):infantryRoute(unit,unit.target,unit.id,unit.kind||'knight');
      unit.path=route?.map(p=>({x:p.x,y:p.y}))||null;unit.pathIndex=1;
      if(!unit.path){
        if(unit.kind==='patrol')unit.nextPatrolAt=performance.now()+350;
        unit.target=null;return false
      }
    }
    let budget=dt*speed,moved=false;
    while(budget>0&&unit.target){
      const next=unit.path[unit.pathIndex];
      if(!next){unit.target=null;unit.path=null;break}
      const length=dist(unit,next);
      if(length<.025){unit.x=next.x;unit.y=next.y;unit.pathIndex++;continue}
      const step=Math.min(length,budget),nextPos={x:unit.x+(next.x-unit.x)*step/length,y:unit.y+(next.y-unit.y)*step/length};
      if(!safeMilitarySegment(unit,nextPos,unit.id,unit.kind||'knight')){unit.target=null;unit.path=null;break}
      unit.x=nextPos.x;unit.y=nextPos.y;budget-=step;moved=true;
      if(step>=length-.025){unit.x=next.x;unit.y=next.y;unit.pathIndex++}
    }
    return moved;
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
    spacePatrols();
    visibilityDirty=true;changed();status('White Zone patrol removed');draw();
  }
  function updateEnemyAI(now,rules){
    const objective=activeWell();
    for(const enemy of combat.enemy){
      if(enemy.defeated)continue;
      if(now<(enemy.aiNextAt||0))continue;
      enemy.aiNextAt=now+800+(peasantHash(enemy.id)%400);
      const intent=rules.enemyIntent(enemy,combat.units,objective,
        (source,target)=>sourceSees({x:source.x,y:source.y,h:terrainElevation(source),r:12},target),WORLD);
      const changedTarget=!enemy.target||!intent.target||dist(enemy.target,intent.target)>.75;
      enemy.aiMode=intent.mode;
      if(changedTarget){enemy.target=intent.target;enemy.path=null;enemy.pathIndex=1}
    }
  }
  function archers(){
    const now=performance.now();
    if(now<nextArcherRosterAt&&State.structures.length===archerRosterSize)return archerRoster;
    nextArcherRosterAt=now+1000;
    archerRosterSize=State.structures.length;
    const active=new Set(),out=[];
    function put(id,p,visualZ,h){
      active.add(id);
      let shooter=archerCache.get(id);
      if(!shooter){shooter={id,clock:0};archerCache.set(id,shooter)}
      shooter.x=p.x;shooter.y=p.y;shooter.h=h;shooter.visualZ=visualZ;
      shooter.terrainAt=terrainElevation;out.push(shooter);
    }
    for(const s of State.structures){
      if(!['tower','built','gate'].includes(s.type)||underConstruction(s))continue;
      const ground=terrainElevation({x:s.x??s.a?.x,y:s.y??s.a?.y});
      if(s.type==='tower'){
        const wood=isWoodTower(s),roof=wood||towerRoofStyle(s)==='battlement';
        const floor=wood?1:structureLevel(s);
        const relative=roof?(wood?1.46:structureHeight(s)+.08):
          Math.min(structureHeight(s)-.35,1.34+(floor-1)*1.14);
        // Arrow slit garrison is hidden behind the facade; roof garrison
        // reuses the visible archer already drawn by drawCastleSoldiers().
        put(s.id+':'+(roof?'roof':'slit'),{x:s.x,y:s.y},ground+relative,ground+(roof?floor:Math.max(1,floor-1)));
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
  function tick(dt){
    if(!combat||!activeWell()||!Number.isFinite(dt)||dt<=0)return;
    dt=Math.min(dt,.25);
    updatePatrols(performance.now());
    let moved=false;
    for(const u of combat.units){
      if(u.routing)continue;
      const speed=u.kind==='knight'?1.5:u.kind==='patrol'?1.15:.8;
      moved=advanceUnit(u,dt,speed)||moved;
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
      updateEnemyAI(performance.now(),rules);
      for(const e of hostiles){
        e.h=terrainElevation(e);e.visualZ=e.h+.6;e.faction??='dev_hostile';
        moved=advanceUnit(e,step,e.routing?1.05:.65)||moved;
      }
      if(moved){visibilityDirty=true;maskDirty=true}
      rules.update(step,combat.units,combat.enemy,hostiles.length?archers():[],
        (e,shooter)=>sourceSees({x:shooter.x,y:shooter.y,h:shooter.h,r:rules.shooterRange(shooter,e)},e),
        (a,b)=>!terrainSegmentCrossesCliff(a,b)&&Math.abs(terrainElevation(a)-terrainElevation(b))<=1);
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
    if(['allow','deny'].includes(mode))whiteBoundaryPending=true;
    lastPaint=q;civilianRouteCache.clear();changed(true);
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
    if(kind==='combat-intruder'){
      e.preventDefault();e.stopImmediatePropagation();
      combat.enemy.push({id:uid(),x:p.x,y:p.y,faction:'dev_hostile',combatKind:'infantry',environmental:true,aiMode:'raid'});changed();setTool({kind:'select',label:'Select'});
      status('Environmental raider placed — it will scout, pursue and raid using traversable terrain');draw();return;
    }
    if(kind==='combat-orders'||kind==='select'){
      const hit=combat.units.find(u=>u.kind!=='patrol'&&dist(u,p)<1.1);
      if(hit){
        e.preventDefault();e.stopImmediatePropagation();selected=hit.id;
        setTool({kind:'combat-orders',label:'Orders: click destination'});
        syncButtons();draw();return;
      }
      if(kind==='combat-orders'&&selected){
        e.preventDefault();e.stopImmediatePropagation();
        const u=combat.units.find(u=>u.id===selected);if(u)issueMove(u,p);
        draw();return;
      }
    }
  }
  canvas.addEventListener('pointerdown',handleDown,true);
  canvas.addEventListener('pointermove',e=>{
    if(!painting)return;
    e.stopImmediatePropagation();e.preventDefault();paint(pointerWorld(e),State.tool.combatBrush);requestToolDraw();
  },true);
  for(const type of ['pointerup','pointercancel'])canvas.addEventListener(type,e=>{
    if(!painting)return;
    painting=false;lastPaint=null;e.stopImmediatePropagation();
    if(whiteBoundaryPending){
      whiteBoundaryPending=false;whiteBoundarySignature='';patrolNavRevision++;patrolRouteCache.clear();
      for(const unit of combat.units)if(unit.kind==='patrol'){unit.target=null;unit.path=null;unit.nextPatrolAt=0}
    }
    if(activeWell())updateAlert(observers());
    scheduleLocalSave();requestToolDraw();
  },true);
  const styles=document.createElement('style');
  styles.textContent='#combatCanvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:4} #combatControls{border:1px solid #78634c;border-radius:10px;padding:9px;margin:8px 0;background:#211b15} #combatControls h3{margin:3px 0 8px} #combatControls .combat-row{display:flex;gap:4px;margin-bottom:5px} #combatControls button{font-size:11px;flex:1;padding:7px 4px} #combatControls .combat-row button.active{background:#f2c772;color:#20180c} #combatControls label{font-size:11px;display:flex;gap:8px;align-items:center} #combatControls input{flex:1;min-width:0} #combatAlarm[data-level=general]{color:#fc6868} #combatAlarm[data-level=local]{color:#efc06c}';
  document.head.appendChild(styles);
  const ui=document.createElement('div');
  ui.id='combatControls';
  ui.innerHTML='<h3>COMBAT · Fog / Command</h3>'+
    '<div class="combat-row"><button id="combatFog">Fog ON</button><button id="combatZones">Zones ON</button><button id="combatRecall">Recall civilians</button></div>'+
    '<div class="combat-row"><button data-combat-brush="allow">White +</button><button data-combat-brush="deny">White −</button><button data-combat-brush="yellow">Yellow</button><button data-combat-brush="green">Green</button></div>'+
    '<div class="combat-row"><button data-combat-brush="eraseYellow">− Yellow</button><button data-combat-brush="eraseGreen">− Green</button><button id="combatOrders">Orders</button></div>'+
    '<div class="combat-row"><button id="combatPatrolAdd">Patrol + · 2 pikemen</button><button id="combatPatrolRemove">Patrol −</button></div>'+
    '<div class="legend" id="combatPatrolCount">White Zone patrols · 0</div>'+
    '<label>Brush radius <input id="combatBrushSize" type="range" min="1" max="16" value="5"><b id="combatBrushReadout">5U</b></label>'+
    '<div class="combat-row"><button id="combatIntruder">Place raider</button><button id="combatClearEnemies">Clear raiders</button></div>'+
    '<div class="legend" id="combatSelection">Select a unit to move</div>'+ 
    '<div class="legend" id="combatStats">Combat stats · Coffee Battles</div>'+
    '<div class="legend" id="combatAlarm" data-level="clear">No alert</div>';
  document.querySelector('#builder h2').insertAdjacentElement('afterend',ui);
  const $=id=>document.getElementById(id);
  function syncButtons(){
    if(!combat||!$('combatFog'))return;
    $('combatFog').textContent='Fog '+(combat.fog?'ON':'OFF');
    $('combatZones').textContent='Zones '+(combat.zones?'ON':'OFF');
    $('combatRecall').textContent=combat.recall?'Release civilians':'Recall civilians';
    $('combatBrushSize').value=combat.brushRadius;
    $('combatBrushReadout').textContent=combat.brushRadius+'U';
    const patrols=combat.units.filter(u=>u.kind==='patrol').length;
    $('combatPatrolCount').textContent='White Zone patrols · '+patrols+' ('+(patrols*2)+' pikemen)';
    $('combatPatrolRemove').disabled=patrols===0;
    document.querySelectorAll('[data-combat-brush]').forEach(b=>b.classList.toggle('active',State.tool.kind==='combat-brush'&&State.tool.combatBrush===b.dataset.combatBrush));
    $('combatOrders').classList.toggle('active',State.tool.kind==='combat-orders');
  }
  $('combatFog').onclick=()=>{combat.fog=!combat.fog;changed();draw()};
  $('combatZones').onclick=()=>{combat.zones=!combat.zones;changed();draw()};
  $('combatRecall').onclick=()=>{
    combat.recall=!combat.recall;
    changed();draw();
    requestCivilianAnimation();
    status(combat.recall?'Civilian recall — pathfinding toward green zone':'Release — civilians route back to their routines');
  };
  document.querySelectorAll('[data-combat-brush]').forEach(b=>b.onclick=()=>{
    setTool({kind:'combat-brush',combatBrush:b.dataset.combatBrush,label:'Brush: '+b.textContent});
    syncButtons();
  });
  $('combatBrushSize').oninput=e=>{combat.brushRadius=Number(e.target.value);changed();draw()};
  $('combatOrders').onclick=()=>{setTool({kind:'combat-orders',label:'Click knight or pikemen squad, then click target'});syncButtons()};
  $('combatPatrolAdd').onclick=addPatrol;
  $('combatPatrolRemove').onclick=removePatrol;
  $('combatIntruder').onclick=()=>{setTool({kind:'combat-intruder',label:'Click terrain to position a test enemy'});syncButtons()};
  $('combatClearEnemies').onclick=()=>{combat.enemy=[];window.ConquerCombatRules?.reset();changed();alertState='clear';draw()};
  const priorDraw=draw;
  draw=function(){
    priorDraw();
    window.ConquerCombatRenderer.renderOverlay({combat,selected,canvasLayer,g,activeWell,refreshFog,renderTacticalBackdrop,observers,spotted});
  };
  const initial=State.combat;restore(initial);
  window.ConquerCombat={tick,serialize,restore,civilPosition,areaState,sourceSees,observers,
    invalidateRoutes:()=>{
      civilianRouteCache.clear();patrolNavRevision++;patrolRouteCache.clear();
      for(const unit of combat.units||[])if(unit.kind==='patrol'&&unit.target){unit.path=null;unit.pathIndex=1}
    },
    visibilityAt:p=>spotted(p,observers()),refresh:()=>{visibilityDirty=true;refreshFog(true);draw()}};
  draw();
})();
