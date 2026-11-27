'use strict';
// Wolves copied from branch animation art; this module owns only their world
// simulation. Day: wildlife is neutral and wanders. Night: it hunts nearby
// friendly military units and may enter ordinary melee/archer combat.
(function(){
  // Two small cohesive packs limit total wolf AI work while making the
  // encounter feel like real wildlife rather than four scattered individuals.
  // packs-v3 adds the solitary bear: older saves gain it exactly once.
  const PACK_COUNT=2,MIN_PACK=3,MAX_PACK=6,PACK_SCHEMA='packs-v3';
  const DETECT=12,LOST=17,MELEE=.85;
  // Bear: territorial, not a hunter. It ignores soldiers passing at a
  // distance and charges only those who come near its den or itself.
  const BEAR_DEN_ALERT=6,BEAR_SELF_ALERT=4,BEAR_LEASH=11;
  let nightCache=null;
  const combat=()=>window.ConquerCombat;
  const isNight=()=>solarIsNight();
  const pack=()=>combat()?.enemy().filter(e=>e.kind==='wolf')||[];
  const bears=()=>combat()?.enemy().filter(e=>e.kind==='bear')||[];
  const wildlife=()=>combat()?.enemy().filter(e=>e.faction==='wildlife')||[];
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
  // Forest points by deterministic sampling; the bear prefers a wood well
  // outside the village. Without forests it still gets a quiet spot.
  function inForest(p){
    return(State.environment||[]).some(f=>f.type==='forest'&&
      typeof environmentContains==='function'&&environmentContains(f,p));
  }
  // Attempt keys differ only in their last digits: avalanche the hash so the
  // attempts really scatter round the village instead of a narrow wedge.
  const mixed=s=>{
    let h=peasantHash('camp-bear:'+s)>>>0;
    h^=h>>>15;h=Math.imul(h,2246822507);h^=h>>>13;h=Math.imul(h,3266489909);h^=h>>>16;
    return(h>>>0)/4294967296;
  };
  function createBear(well){
    let fallback=null;
    for(let attempt=0;attempt<160;attempt++){
      const seed=mixed(State.seed+':'+well.id+':'+attempt);
      const angle=seed*Math.PI*2,radius=28+mixed(well.id+':r:'+attempt)*22;
      const p={x:well.x+Math.cos(angle)*radius,y:well.y+Math.sin(angle)*radius};
      if(!free(p)||combat().areaState(p).yellow)continue;
      if(!inForest(p)){fallback??=p;continue}
      return bearAt(well,p,seed);
    }
    return fallback?bearAt(well,fallback,.5):null;
  }
  function bearAt(well,p,seed){
    return{id:'wild-bear-'+well.id,kind:'bear',combatKind:'bear',faction:'wildlife',
      neutral:true,defeated:false,x:p.x,y:p.y,home:{x:p.x,y:p.y},wolfSeed:seed,
      wolfState:'roaming',wolfMode:'walk',wolfFace:1,wolfWanderIndex:0,
      wolfDecisionIn:0,wolfTargetId:null,wolfPath:null,wolfPathIndex:1};
  }
  // ---- spawning on demand (threat generator, settlement-threats.js) ----
  const wellNow=()=>State.village?.founded&&State.structures.find(s=>s.id===State.village.wellId&&s.type==='well');
  const living=list=>list.filter(a=>!a.defeated&&!(a.stats&&a.stats.hp<=0));
  // A wild spot: a wood 30–55U out, outside the yellow zone (any free spot if no wood).
  function wildSpot(well,key){
    let fallback=null;
    for(let attempt=0;attempt<160;attempt++){
      const a=mixed(key+':a:'+attempt)*Math.PI*2,r=30+mixed(key+':r:'+attempt)*25;
      const p={x:well.x+Math.cos(a)*r,y:well.y+Math.sin(a)*r};
      if(!free(p)||combat().areaState(p).yellow)continue;
      if(inForest(p))return p;
      fallback??=p;
    }
    return fallback;
  }
  // Clear the dead of the fauna before adding new animals (their fall is long over).
  const clearDead=()=>combat().removeEnemies?.(e=>e.faction==='wildlife'&&(e.defeated||e.stats?.hp<=0));
  // A new wolf pack moves into the woods. size: 3–6 (default seeded).
  function spawnPack({size=null,key=null}={}){
    const well=wellNow(),tactical=combat();if(!well||!tactical?.addEnemies)return null;
    const k=key||(State.seed+':pack:'+Math.floor(State.clock?.day||0));
    const center=wildSpot(well,k);if(!center)return null;
    const n=Number.isInteger(size)?Math.max(MIN_PACK,Math.min(8,size)):MIN_PACK+Math.floor(mixed(k+':n')*(MAX_PACK-MIN_PACK+1));
    const packId='wild-pack-'+k.replace(/[^\w-]/g,'-'),night=isNight(),members=[];
    for(let i=0;i<n;i++){
      for(let t=0;t<22;t++){
        const a=i*Math.PI*2/n+t*.45,r=.9+(t%6)*.35,p={x:center.x+Math.cos(a)*r,y:center.y+Math.sin(a)*r};
        if(!free(p)||members.some(m=>distance(m,p)<.65))continue;
        members.push({id:packId+'-'+i,kind:'wolf',combatKind:'wolf',faction:'wildlife',
          wolfPackId:packId,wolfPackIndex:i,neutral:!night,defeated:false,x:p.x,y:p.y,home:{...center},
          wolfSeed:mixed(k+':s:'+i),wolfState:night?'alert':'roaming',wolfMode:night?'howl':'walk',wolfFace:i%2?1:-1,
          wolfWanderIndex:0,wolfDecisionIn:0,wolfTargetId:null,wolfPath:null,wolfPathIndex:1});
        break;
      }
    }
    if(members.length<MIN_PACK)return null;
    clearDead();tactical.addEnemies(members);spriteFrames.clear();
    return{packId,center,size:members.length};
  }
  // A bear takes a den in the woods (only if none is alive).
  function spawnBear({key=null}={}){
    const well=wellNow(),tactical=combat();if(!well||!tactical?.addEnemies)return null;
    if(living(bears()).length)return null;
    const k=key||(State.seed+':bear:'+Math.floor(State.clock?.day||0));
    const p=wildSpot(well,k);if(!p)return null;
    const bear={...bearAt(well,p,mixed(k+':s')),id:'wild-bear-'+k.replace(/[^\w-]/g,'-')};
    clearDead();tactical.addEnemies([bear]);
    return{id:bear.id,center:p};
  }
  // Living packs (by pack id) and bears, for the generator's caps.
  function census(){
    const packs=new Set(living(pack()).map(w=>w.wolfPackId||w.id));
    return{packs:packs.size,wolves:living(pack()).length,bears:living(bears()).length};
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
      const bear=createBear(well);
      if(tactical.registerWolves(token,createPack(well).concat(bear?[bear]:[]))){
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
      // World heading of the walk (ANIMAL-VIEWS: the card picks one of the eight views from it).
      wolf.wolfHeading={x:next.x-wolf.x,y:next.y-wolf.y};
      wolf.x=next.x;wolf.y=next.y;
      budget-=step;
      if(step>=len-.025)wolf.wolfPathIndex++;
    }
  }
  // One bear step; returns true when it used this tick's route budget.
  function bearStep(bear,dt,night,mayPlan){
    const home=bear.home||bear;
    const soldiers=combat()?.units().filter(live)||[];
    const prior=soldiers.find(u=>u.id===bear.wolfTargetId);
    let target=null;
    if(prior&&distance(prior,home)<BEAR_LEASH)target=prior;
    else{
      let best=Infinity;
      for(const u of soldiers){
        const d=distance(u,bear);
        if((distance(u,home)<BEAR_DEN_ALERT||d<BEAR_SELF_ALERT)&&d<best){best=d;target=u}
      }
    }
    bear.wolfDecisionIn=(bear.wolfDecisionIn||0)-dt;
    if(target){
      // Disturbed: hostile until the intruder leaves its territory.
      bear.neutral=false;bear.wolfTargetId=target.id;bear.wolfState='hunting';
      if(distance(bear,target)<=MELEE){bear.wolfPath=null;bear.wolfMode='stand';return false}
      bear.wolfMode='walk';
      let used=false;
      if(bear.wolfDecisionIn<=0&&mayPlan){
        used=true;routeTo(bear,{x:target.x,y:target.y});bear.wolfDecisionIn=bear.wolfPath?1:2.4;
      }
      advance(bear,dt,1.1);
      return used;
    }
    bear.neutral=true;bear.wolfTargetId=null;
    const away=distance(bear,home);
    if(night){
      // Sleeps at the den; walks back first if a chase took it away.
      bear.wolfState='sleeping';
      if(away<.6){bear.wolfPath=null;bear.wolfMode='sleep';return false}
    }else bear.wolfState='roaming';
    let used=false;
    if(bear.wolfDecisionIn<=0&&mayPlan){
      used=true;
      routeTo(bear,night||away>4?home:wanderTarget(bear));
      bear.wolfDecisionIn=bear.wolfPath?4+bear.wolfSeed*3:6;
    }
    bear.wolfMode=bear.wolfPath?.length?'walk':night?'sleep':'walk';
    advance(bear,dt,.3);
    return used;
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
    // The (single) bear has its own route slot: sharing the wolves' slot let
    // two packs starve it of every plan at night.
    for(const bear of bears()){
      if(bear.defeated||bear.stats?.hp===0)continue;
      if(bearStep(bear,dt,night,true)){planned++;if(!bear.wolfPath)failed++}
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
  // The bear's art carries its own 1.7 intrinsic scale; .8 keeps it about
  // 1.35× a wolf, i.e. a heavy animal still shorter than a standing man.
  const SPECIES_SIZE={wolf:1,bear:.8};
  const SPRITES={wolf:{w:32,h:32,x:16,y:25},bear:{w:56,h:52,x:28,y:42}};
  const spriteFrames=new Map();
  function draw(g,wolf){
    const species=wolf.kind==='bear'?'bear':'wolf';
    if(!window.ConquerAnimals?.SPECIES?.[species]||wolf.defeated||wolf.stats?.hp===0)return;
    const p=w2s(wolf,.08);
    const size=wolfDrawSize()*SPECIES_SIZE[species];
    const mode=wolf.wolfMode||(species==='bear'?'walk':isNight()?'howl':'walk');
    const facing=wolf.wolfFace||1,seed=wolf.wolfSeed||0;
    const time=performance.now();
    const opts={mode,facing,seed,t:time/1000,heading:wolf.wolfHeading||null};
    const box=SPRITES[species];
    // World3D: depth-tested card with the animal's horizontal body capsule (same size as below).
    if(window.ConquerAnimals.card?.(species,wolf,.08,{...opts,id:species+':'+wolf.id,sizeFactor:size/Math.max(1e-6,State.view.scale)}))return;
    withUrbanFigureOcclusion(wolf,.08,()=>{
      if(typeof document==='undefined'||typeof g.drawImage!=='function'){
        window.ConquerAnimals.drawAnimal(species,g,p.x,p.y,size,opts);
        return;
      }
      const frame=Math.floor((time+seed*115)/125);
      let sprite=spriteFrames.get(wolf.id);
      if(!sprite||sprite.size!==size||sprite.mode!==mode||
         sprite.facing!==facing||sprite.frame!==frame){
        const canvas=sprite?.canvas||document.createElement('canvas');
        if(canvas.width!==box.w)canvas.width=box.w;
        if(canvas.height!==box.h)canvas.height=box.h;
        const c=canvas.getContext('2d');
        if(!c){
          window.ConquerAnimals.drawAnimal(species,g,p.x,p.y,size,opts);
          return;
        }
        c.clearRect(0,0,box.w,box.h);
        window.ConquerAnimals.drawAnimal(species,c,box.x,box.y,size,opts);
        sprite={canvas,size,mode,facing,frame};
        spriteFrames.set(wolf.id,sprite);
      }
      g.drawImage(sprite.canvas,p.x-box.x,p.y-box.y);
    });
  }
  window.ConquerWolves={ensure,tick,draw,isNight,pack,bears,wildlife,wolfDrawSize,spawnPack,spawnBear,census};
  ensure();
})();
