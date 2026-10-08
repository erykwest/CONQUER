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

  function defaults(){return{version:2,fog:true,zones:true,brushRadius:5,strokes:[],units:[],enemy:[],recall:false,recallMode:'off',seen:''};}
  function restore(raw){
    combat=Object.assign(defaults(),raw&&[1,2].includes(raw.version)?raw:{});
    // This builder starts with the terrain explored (known) but not currently
    // visible. The fog still hides unseen contacts and darkens unobserved areas.
    if(combat.version!==2){combat.seen='';combat.version=2}
    combat.fog=true;
    combat.recallMode=['off','green','hall'].includes(raw?.recallMode)?raw.recallMode:(combat.recall?'green':'off');
    combat.recall=combat.recallMode!=='off';
    combat.strokes=Array.isArray(combat.strokes)?combat.strokes.filter(s=>Number.isFinite(s.x)&&Number.isFinite(s.y)&&Number.isFinite(s.r)&&['allow','deny','yellow','green','eraseYellow','eraseGreen'].includes(s.mode)).slice(-2500):[];
    combat.units=Array.isArray(combat.units)?combat.units
      .filter(u=>Number.isFinite(u.x)&&Number.isFinite(u.y)&&['squad','knight'].includes(u.kind))
      .map(u=>{
        // Navigation routes are volatile and can contain references to their
        // source unit in old saves. Rebuild them from the destination instead.
        const {path,pathIndex,engaged,...stored}=u;
        return {...stored,target:u.target&&Number.isFinite(u.target.x)&&Number.isFinite(u.target.y)
          ?{x:u.target.x,y:u.target.y}:null};
      }): [];
    combat.enemy=Array.isArray(combat.enemy)?combat.enemy.filter(s=>Number.isFinite(s.x)&&Number.isFinite(s.y)):[];
    for(const e of combat.enemy){e.faction??='dev_hostile';e.combatKind??='infantry';}
    memory.fill(1);
    try{const saved=atob(combat.seen||'');for(let i=0;i<Math.min(saved.length,memory.length);i++)memory[i]=saved.charCodeAt(i)?1:0}catch(e){}
    visible.fill(0);paintFogBitmap();
    selected=null;lastObserverSig='';lastAreaSig='';maskDirty=true;visibilityDirty=true;circleCacheBucket=-1;indexedStrokes=-1;
    clearCivilianMotions();
    archerCache.clear();archerRoster=[];archerRosterSize=-1;nextArcherRosterAt=0;tacticalRuleAccum=0;
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
    return {...combat,units:combat.units.map(u=>{
      const {path,pathIndex,engaged,...stored}=u;
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
        duration:result.path.length<2?0:Math.max(450,length*550)
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
    if(king){
      g.strokeStyle='rgba(255,211,116,.78)';g.lineWidth=1.5;
      g.setLineDash([6,5]);drawMapCircle({...king,r:16,groundZ:terrainElevation(king)},true);g.setLineDash([]);
    }
    if(selected){
      const u=combat.units.find(u=>u.id===selected);
      if(u){g.strokeStyle='#e3fcac';g.lineWidth=1.3;g.setLineDash([4,4]);drawMapCircle({...u,r:u.kind==='squad'?6:16,groundZ:terrainElevation(u)},true);g.setLineDash([]);}
    }
    const characters=[];
    for(const u of combat.units){
      if(u.kind==='knight'&&!u.defeated)characters.push({p:u,type:'knight',id:u.id,unit:u});
      else{
        if(u.defeated)continue;
        for(let i=0;i<5;i++){
          const row=Math.floor(i/3),col=i%3,spacing=.55;
          characters.push({p:{x:u.x+(col-1)*spacing,y:u.y+(row-.4)*spacing},type:'spearman',id:u.id+':'+i,flag:i===0,unit:u,index:i});
        }
      }
    }
    characters.sort((a,b)=>viewDepthPoint(a.p)-viewDepthPoint(b.p));
    const sightSources=combat.enemy.length?observers():null;
    withRenderContext(g,()=>{
      for(const soldier of characters){
        drawSoldierFigure(soldier.p,.08,soldier.type,soldier.id,State.clock.day);
        if(soldier.type==='spearman'&&soldier.unit.engaged){
          const target=combat.enemy.filter(e=>!e.defeated&&e.stats?.hp>0)
            .sort((a,b)=>dist(a,soldier.unit)-dist(b,soldier.unit))[0];
          if(target&&dist(target,soldier.unit)<1){
            const base=w2s(soldier.p,.24),end=w2s(target,.45);
            const pulse=(Math.sin((window.ConquerCombatRules?.time||0)*Math.PI*3+soldier.index*1.2)+1)/2;
            g.strokeStyle='#c9c6b4';g.lineWidth=Math.max(.75,1.25*State.view.scale);
            g.beginPath();g.moveTo(base.x,base.y-8);
            g.lineTo(base.x+(end.x-base.x)*(.25+.7*pulse),base.y-8+(end.y-base.y-8)*(.25+.7*pulse));g.stroke();
          }
        }
        if(soldier.flag)withUrbanFigureOcclusion(soldier.p,.08,()=>{
          const base=w2s(soldier.p,.08);
          g.strokeStyle='#5d4535';g.lineWidth=1.8;g.beginPath();
          g.moveTo(base.x+5,base.y-2);g.lineTo(base.x+5,base.y-27);g.stroke();
          g.fillStyle='#d6bd68';g.beginPath();g.moveTo(base.x+5,base.y-27);
          g.lineTo(base.x+19,base.y-24);g.lineTo(base.x+5,base.y-19);g.fill();
        });
      }
      for(const e of combat.enemy){
        if(e.defeated||e.stats?.hp<=0||!spotted(e,sightSources))continue;
        const livery=window.ConquerCombatRules?.liveryOf(e.faction||'dev_hostile');
        drawSoldierFigure(e,.08,'spearman',e.id,State.clock.day,livery);
        const p=w2s(e,.08);g.strokeStyle='#e45151';g.lineWidth=2;
        g.beginPath();g.arc(p.x,p.y-8,11,0,Math.PI*2);g.stroke();
      }
    });
    window.ConquerCombatRules?.drawEffects(g,(p,z)=>w2sRaw(p,z));
    const focused=combat.units.find(u=>u.id===selected);
    document.getElementById('combatSelection').textContent=selected?
      ((focused?.kind==='squad'?'Pikemen ×5':'Knight')+' selected · click destination'):'Select a unit to move';
    const panel=document.getElementById('combatStats');
    if(panel){
      const hp=x=>x?.stats?Math.max(0,Math.round(x.stats.hp))+'/'+x.stats.maxHp:'—';
      const brain=x=>x?.stats?Math.round(x.stats.brain):'—';
      const allies=combat.units.filter(u=>!u.defeated),hostiles=combat.enemy.filter(e=>!e.defeated);
      panel.textContent='Units '+allies.length+' / Hostiles '+hostiles.length+
        (focused?' · HP '+hp(focused)+' · B '+brain(focused):'')+
        (combat.enemy.length?' · Enemy HP '+hp(combat.enemy[0]):'');
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
  function tick(dt){
    if(!combat||!activeWell()||!Number.isFinite(dt)||dt<=0)return;
    dt=Math.min(dt,.25);
    let moved=false;
    for(const u of combat.units){
      if(!u.target||u.defeated||u.routing)continue;
      if(!u.path?.length){
        const route=infantryRoute(u,u.target,u.id,u.kind);
        u.path=route?.map(p=>({x:p.x,y:p.y}))||null;u.pathIndex=1;
        if(!u.path){u.target=null;continue}
      }
      let budget=dt*(u.kind==='knight'?1.5:.8);
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
        e.h=terrainElevation(e);e.visualZ=e.h+.6;e.faction??='dev_hostile';
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
        (a,b)=>safeMilitarySegment(a,b,a.id,a.kind||'knight')&&Math.abs(terrainElevation(a)-terrainElevation(b))<=1);
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
    if(kind==='combat-intruder'){
      e.preventDefault();e.stopImmediatePropagation();
      combat.enemy.push({id:uid(),x:p.x,y:p.y,faction:'dev_hostile',combatKind:'infantry'});changed();setTool({kind:'select',label:'Select'});
      status('Test intruder placed — visible only within line of sight');draw();return;
    }
    if(kind==='combat-orders'||kind==='select'){
      const hit=combat.units.find(u=>dist(u,p)<1.1);
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
    if(activeWell())updateAlert(observers());
    scheduleLocalSave();requestToolDraw();
  },true);
  const styles=document.createElement('style');
  styles.textContent='#combatCanvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:4} #combatControls{border:1px solid #78634c;border-radius:10px;padding:9px;margin:8px 0;background:#211b15} #combatControls h3{margin:3px 0 8px} #combatControls .combat-row{display:flex;gap:4px;margin-bottom:5px} #combatControls button{font-size:11px;flex:1;padding:7px 4px} #combatControls .combat-row button.active{background:#f2c772;color:#20180c} #combatRecall[data-mode=green]{background:#35874e;color:#fff} #combatRecall[data-mode=hall]{background:#ad3438;color:#fff} #combatMute:disabled{opacity:.55} #combatControls label{font-size:11px;display:flex;gap:8px;align-items:center} #combatControls input{flex:1;min-width:0} #combatAlarm[data-level=general]{color:#fc6868} #combatAlarm[data-level=local]{color:#efc06c}';
  document.head.appendChild(styles);
  const ui=document.createElement('div');
  ui.id='combatControls';
  ui.innerHTML='<h3>COMBAT · Fog / Command</h3>'+
    '<div class="combat-row"><button id="combatFog">Fog ON</button><button id="combatZones">Zones ON</button><button id="combatRecall" title="Bell: green safe zones, then red Mastio Common Hall" aria-label="Raise alarm">🔔</button><button id="combatMute" title="Release all recalled civilians and recruits" aria-label="Release">🔕</button></div>'+
    '<div class="combat-row"><button data-combat-brush="allow">White +</button><button data-combat-brush="deny">White −</button><button data-combat-brush="yellow">Yellow</button><button data-combat-brush="green">Green</button></div>'+
    '<div class="combat-row"><button data-combat-brush="eraseYellow">− Yellow</button><button data-combat-brush="eraseGreen">− Green</button><button id="combatOrders">Orders</button></div>'+
    '<label>Brush radius <input id="combatBrushSize" type="range" min="1" max="16" value="5"><b id="combatBrushReadout">5U</b></label>'+
    '<div class="combat-row"><button id="combatIntruder">Test intruder</button><button id="combatClearEnemies">Clear intruders</button></div>'+
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
    document.querySelectorAll('[data-combat-brush]').forEach(b=>b.classList.toggle('active',State.tool.kind==='combat-brush'&&State.tool.combatBrush===b.dataset.combatBrush));
    $('combatOrders').classList.toggle('active',State.tool.kind==='combat-orders');
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
  $('combatOrders').onclick=()=>{setTool({kind:'combat-orders',label:'Click knight or pikemen squad, then click target'});syncButtons()};
  $('combatIntruder').onclick=()=>{setTool({kind:'combat-intruder',label:'Click terrain to position a test enemy'});syncButtons()};
  $('combatClearEnemies').onclick=()=>{combat.enemy=[];window.ConquerCombatRules?.reset();changed();alertState='clear';draw()};
  const priorDraw=draw;
  draw=function(){priorDraw();renderOverlay()};
  const initial=State.combat;restore(initial);
  window.ConquerCombat={tick,serialize,restore,civilPosition,areaState,sourceSees,observers,spawnOccupants,civilSpawnPosition,
    alarmMode,setAlarmMode,recruitedResident,
    yellowGeometry:()=>circles().filter(c=>c.mode==='yellow').concat(combat.strokes.filter(c=>['yellow','eraseYellow'].includes(c.mode))),
    invalidateRoutes:()=>{civilianRouteCache.clear();circleCacheBucket=-1;visibilityDirty=true;for(const u of combat?.units||[])u.path=null},
    invalidateArchers:()=>{nextArcherRosterAt=0;archerRosterSize=-1},
    visibilityAt:p=>spotted(p,observers()),refresh:()=>{visibilityDirty=true;refreshFog(true);draw()}};
  draw();
})();
