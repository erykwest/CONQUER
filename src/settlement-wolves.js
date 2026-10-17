'use strict';
// Wolves copied from branch animation art; this module owns only their world
// simulation. Day: wildlife is neutral and wanders. Night: it hunts nearby
// friendly military units and may enter ordinary melee/archer combat.
(function(){
  // Two small cohesive packs limit total wolf AI work while making the
  // encounter feel like real wildlife rather than four scattered individuals.
  const PACK_COUNT=2,MIN_PACK=3,MAX_PACK=6,PACK_SCHEMA='packs-v2';
  const DETECT=12,LOST=17,MELEE=.85;
  let nightCache=null;
  const combat=()=>window.ConquerCombat;
  const isNight=()=>solarIsNight();
  const pack=()=>combat()?.enemy().filter(e=>e.kind==='wolf')||[];
  const hash=s=>(peasantHash('camp-wolf:'+s)>>>0)/4294967296;
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const live=u=>u&&!u.defeated&&u.stats?.hp!==0&&!u.routing&&u.campState!=='barracks';
  const free=p=>p.x>1&&p.y>1&&p.x<WORLD-1&&p.y<WORLD-1&&
    !pointBlockedForPeasant(p,'camp-wolf')&&!terrainSegmentCrossesCliff(p,p);
  function createPack(well){
    const wolves=[];
    for(let group=0;group<PACK_COUNT;group++){
      const packId='camp-wolf-pack-'+well.id+'-'+group;
      const groupSeed=hash(State.seed+':'+well.id+':pack:'+group);
      const size=MIN_PACK+Math.floor(groupSeed*(MAX_PACK-MIN_PACK+1));
      // Choose one shared den, then place every member around it. Previously
      // each wolf had its own den 17–20U from the well: not a pack.
      let placed=null;
      for(let attempt=0;attempt<48&&!placed;attempt++){
        const angle=(group+groupSeed*.23)*Math.PI*2/PACK_COUNT+attempt*.33;
        const radius=19+(attempt%8)*1.1;
        const center={x:well.x+Math.cos(angle)*radius,y:well.y+Math.sin(angle)*radius};
        if(!free(center)||combat().areaState(center).yellow)continue;
        const members=[];
        for(let i=0;i<size;i++){
          const seed=hash(State.seed+':'+well.id+':'+group+':'+i);
          let place=null;
          for(let k=0;k<22;k++){
            const a=i*Math.PI*2/size+k*.45+seed*.6;
            const r=.9+(k%6)*.35;
            const p={x:center.x+Math.cos(a)*r,y:center.y+Math.sin(a)*r};
            if(!free(p)||combat().areaState(p).yellow||
               members.some(member=>distance(member,p)<.65))continue;
            place=p;break;
          }
          if(!place)continue;
          members.push({
            id:'camp-wolf-'+well.id+'-'+group+'-'+i,
            kind:'wolf',combatKind:'wolf',faction:'wildlife',
            wolfPackId:packId,wolfPackIndex:i,
            neutral:true,defeated:false,
            x:place.x,y:place.y,home:{...center},wolfSeed:seed,
            wolfState:'roaming',wolfMode:'walk',wolfFace:i%2?1:-1,
            wolfWanderIndex:0,wolfDecisionIn:0,wolfTargetId:null,
            wolfPath:null,wolfPathIndex:1
          });
        }
        // A very congested area must not leave orphaned singles or pairs.
        if(members.length>=MIN_PACK)placed=members;
      }
      if(placed)wolves.push(...placed);
    }
    return wolves;
  }
  function choosePackTargets(wolves){
    const soldiers=combat()?.units().filter(live)||[];
    const groups=new Map(),targets=new Map();
    for(const wolf of wolves){
      if(wolf.defeated||wolf.stats?.hp===0)continue;
      const id=wolf.wolfPackId||wolf.id;
      if(!groups.has(id))groups.set(id,[]);
      groups.get(id).push(wolf);
    }
    for(const [id,members] of groups){
      const prior=members.find(w=>w.wolfTargetId)?.wolfTargetId;
      let chosen=null,best=Infinity;
      for(const unit of soldiers){
        const d=Math.min(...members.map(w=>distance(w,unit)));
        if(d<(unit.id===prior?LOST:DETECT)&&d<best){
          best=d;chosen=unit;
        }
      }
      targets.set(id,chosen);
    }
    return targets;
  }
  function ensure(){
    const tactical=combat();
    const well=State.village?.founded&&State.structures.find(s=>s.id===State.village.wellId&&s.type==='well');
    if(!tactical||!well)return;
    // Incrementing the generation schema upgrades preexisting saves with the
    // four separate wolves exactly once, without resetting on each redraw.
    const token=String(State.seed)+':'+well.id+':'+PACK_SCHEMA;
    if(tactical.wolfSpawnedFor()!==token){
      if(tactical.registerWolves(token,createPack(well))){
        nightCache=null;
        spriteFrames.clear();
      }
    }
    const night=isNight();
    if(nightCache!==night){
      nightCache=night;
      for(const wolf of pack()){
        wolf.neutral=!night;
        wolf.wolfTargetId=null;wolf.wolfPath=null;wolf.wolfPathIndex=1;
        wolf.wolfDecisionIn=0;
        wolf.wolfState=night?'alert':'roaming';
        wolf.wolfMode=night?'howl':'walk';
      }
    }
  }
  function wanderTarget(wolf){
    const i=wolf.wolfWanderIndex=(wolf.wolfWanderIndex||0)+1;
    const angle=i*2.39996+wolf.wolfSeed*Math.PI*2;
    const radius=1.7+hash(wolf.id+':wander:'+i)*3;
    const p={x:wolf.home.x+Math.cos(angle)*radius,y:wolf.home.y+Math.sin(angle)*radius};
    return free(p)?p:wolf.home;
  }
  // A wolf needs a short chase path, not the civilian road-weighted A*.
  // The latter rechecks every street on every grid step and could freeze
  // nighttime frames for hundreds of milliseconds when the target is blocked.
  function routeTo(wolf,goal){
    if(!goal||!free(goal))return false;
    const can=(a,b)=>peasantSegmentClear(a,b,wolf.id);
    let path=null;
    if(can(wolf,goal))path=[{x:wolf.x,y:wolf.y},goal];
    else{
      const dx=goal.x-wolf.x,dy=goal.y-wolf.y,L=Math.hypot(dx,dy)||1;
      const nx=-dy/L,ny=dx/L;
      // Two short bends slip around ordinary buildings or hedges.
      // Fixed upper bounds keep a failed hunt from degenerating into a
      // full-world graph search or a long synchronous fallback.
      for(const offset of [2.5,5,8,11,14]){
        if(path)break;
        for(const sign of [1,-1]){
          const side=offset*sign;
          const a={x:wolf.x+dx*.04+nx*side,y:wolf.y+dy*.04+ny*side};
          const b={x:goal.x-dx*.04+nx*side,y:goal.y-dy*.04+ny*side};
          if(!free(a)||!free(b)||!can(wolf,a)||!can(a,b)||!can(b,goal))continue;
          path=[{x:wolf.x,y:wolf.y},a,b,goal];break;
        }
      }
    }
    wolf.wolfPath=path?.map(p=>({x:p.x,y:p.y}))||null;
    wolf.wolfPathIndex=1;
    return !!path;
  }
  function advance(wolf,dt,speed){
    if(!wolf.wolfPath?.length)return;
    let budget=Math.max(0,dt*speed);
    while(budget>.0001){
      const p=wolf.wolfPath[wolf.wolfPathIndex];
      if(!p){wolf.wolfPath=null;wolf.wolfPathIndex=1;break}
      const len=distance(wolf,p);
      if(len<.025){wolf.wolfPathIndex++;continue}
      const step=Math.min(budget,len);
      const next={x:wolf.x+(p.x-wolf.x)*step/len,y:wolf.y+(p.y-wolf.y)*step/len};
      if(!peasantSegmentClear(wolf,next,wolf.id)){
        wolf.wolfPath=null;wolf.wolfPathIndex=1;wolf.wolfDecisionIn=.7;break;
      }
      wolf.wolfFace=next.x>=wolf.x?1:-1;
      wolf.x=next.x;wolf.y=next.y;
      budget-=step;
      if(step>=len-.025)wolf.wolfPathIndex++;
    }
  }
  function tick(dt){
    if(!Number.isFinite(dt)||dt<=0)return;
    const t0=performance.now();
    ensure();
    const night=isNight();
    // Distribute expensive route decisions over successive simulation ticks.
    // Rendering and movement still update for every wolf.
    let plannedThisTick=false,planned=0,failed=0;
    const wolves=pack(),targets=night?choosePackTargets(wolves):null;
    for(const wolf of wolves){
      if(wolf.defeated||wolf.stats?.hp===0)continue;
      wolf.neutral=!night;
      wolf.wolfDecisionIn=(wolf.wolfDecisionIn||0)-dt;
      // Wolves in the same pack coordinate their hunt on one target.
      const target=targets?.get(wolf.wolfPackId||wolf.id)||null;
      if(target){
        wolf.wolfTargetId=target.id;
        wolf.wolfState='hunting';
        if(distance(wolf,target)<=MELEE){
          wolf.wolfPath=null;wolf.wolfMode='idle';
          wolf.wolfDecisionIn=Math.min(.2,wolf.wolfDecisionIn);continue;
        }
        wolf.wolfMode='run';
        if(wolf.wolfDecisionIn<=0){
          if(!plannedThisTick){
            plannedThisTick=true;planned++;
            if(!routeTo(wolf,{x:target.x,y:target.y}))failed++;
            // A missing path gets a real cooldown: never recalculate on
            // every frame just because the current path is null.
            wolf.wolfDecisionIn=wolf.wolfPath?1:2.4;
          }
        }
        advance(wolf,dt,1.35);
      }else{
        wolf.wolfTargetId=null;wolf.wolfState=night?'alert':'roaming';
        if(wolf.wolfDecisionIn<=0){
          if(!plannedThisTick){
            plannedThisTick=true;planned++;
            if(!routeTo(wolf,wanderTarget(wolf)))failed++;
            wolf.wolfDecisionIn=wolf.wolfPath?2.4+wolf.wolfSeed:3.4+wolf.wolfSeed;
          }
        }
        wolf.wolfMode=wolf.wolfPath?.length?'walk':night?'howl':'idle';
        advance(wolf,dt,night?.54:.38);
      }
    }
    const ms=performance.now()-t0,perf=window.__conquerPerf||(window.__conquerPerf={});
    perf.wolfAiMs=ms;
    perf.wolfAiMaxMs=Math.max(perf.wolfAiMaxMs||0,ms);
    perf.wolfRouteAttempts=(perf.wolfRouteAttempts||0)+planned;
    perf.wolfRouteFailures=(perf.wolfRouteFailures||0)+failed;
    if(ms>20)window.__conquerAnalytics?.event('WOLF_AI_SLOW',{ms:+ms.toFixed(1),planned,failed,night},'warn',3000);
  }
  // Animation frame atlas per wolf: painting every original SVG Path2D into
  // the tactical canvas on every world redraw is unnecessarily expensive,
  // especially alongside the night-light pass. Each wolf animates at ~8 FPS
  // while its ground position is still updated every rendered frame.
  // Animal SVG is drawn at its native authored proportions (wolf scale=1).
  // Soldier head-top -> foot = 9.064 * militaryScale() pixels. Wolf art from
  // ears (y=64) to paws (y=244) spans ~180/256 of its intrinsic canvas.
  // Therefore its screen height tracks 70% of the human silhouette at any zoom.
  const HUMAN_BODY_HEIGHT=9.064,WOLF_ART_HEIGHT=180;
  function wolfDrawSize(){return HUMAN_BODY_HEIGHT*militaryScale()*.7*256/WOLF_ART_HEIGHT}
  // Small cached canvas instead of 96x96; 6–12 wolves now cost less to composite.
  const spriteFrames=new Map(),SPRITE_W=32,SPRITE_H=32,SPRITE_X=16,SPRITE_Y=25;
  function draw(g,wolf){
    if(!window.ConquerAnimals?.SPECIES?.wolf||wolf.defeated||wolf.stats?.hp===0)return;
    const p=w2s(wolf,.08);
    const size=wolfDrawSize();
    const mode=wolf.wolfMode||(isNight()?'howl':'walk');
    const facing=wolf.wolfFace||1,seed=wolf.wolfSeed||0;
    const time=performance.now();
    const opts={mode,facing,seed,t:time/1000};
    withUrbanFigureOcclusion(wolf,.08,()=>{
      if(typeof document==='undefined'||typeof g.drawImage!=='function'){
        window.ConquerAnimals.drawAnimal('wolf',g,p.x,p.y,size,opts);
        return;
      }
      const frame=Math.floor((time+seed*115)/125);
      let sprite=spriteFrames.get(wolf.id);
      if(!sprite||sprite.size!==size||sprite.mode!==mode||
         sprite.facing!==facing||sprite.frame!==frame){
        const canvas=sprite?.canvas||document.createElement('canvas');
        if(canvas.width!==SPRITE_W)canvas.width=SPRITE_W;
        if(canvas.height!==SPRITE_H)canvas.height=SPRITE_H;
        const c=canvas.getContext('2d');
        if(!c){
          window.ConquerAnimals.drawAnimal('wolf',g,p.x,p.y,size,opts);
          return;
        }
        c.clearRect(0,0,SPRITE_W,SPRITE_H);
        window.ConquerAnimals.drawAnimal('wolf',c,SPRITE_X,SPRITE_Y,size,opts);
        sprite={canvas,size,mode,facing,frame};
        spriteFrames.set(wolf.id,sprite);
      }
      g.drawImage(sprite.canvas,p.x-SPRITE_X,p.y-SPRITE_Y);
    });
  }
  window.ConquerWolves={ensure,tick,draw,isNight,pack,wolfDrawSize};
  ensure();
})();
