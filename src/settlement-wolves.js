'use strict';
// Wolves copied from branch animation art; this module owns only their world
// simulation. Day: wildlife is neutral and wanders. Night: it hunts nearby
// friendly military units and may enter ordinary melee/archer combat.
(function(){
  const PACK_SIZE=4,DETECT=12,LOST=17,MELEE=.85;
  let nightCache=null;
  const combat=()=>window.ConquerCombat;
  const isNight=()=>visualCycleFrac()>=VISUAL_DAYLIGHT_RATIO;
  const pack=()=>combat()?.enemy().filter(e=>e.kind==='wolf')||[];
  const hash=s=>(peasantHash('camp-wolf:'+s)>>>0)/4294967296;
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const live=u=>u&&!u.defeated&&u.stats?.hp!==0&&!u.routing&&u.campState!=='barracks';
  const free=p=>p.x>1&&p.y>1&&p.x<WORLD-1&&p.y<WORLD-1&&
    !pointBlockedForPeasant(p,'camp-wolf')&&!terrainSegmentCrossesCliff(p,p);
  function createPack(well){
    const wolves=[];
    for(let i=0;i<PACK_SIZE;i++){
      const seed=hash(State.seed+':'+well.id+':'+i);
      let place=null;
      for(let k=0;k<40;k++){
        const a=(i+seed)*2*Math.PI/PACK_SIZE+k*.53;
        const r=17+(i%3)*1.5+k*.15;
        const p={x:well.x+Math.cos(a)*r,y:well.y+Math.sin(a)*r};
        if(!free(p)||combat().areaState(p).yellow)continue;
        place=p;break;
      }
      if(!place)continue;
      wolves.push({
        id:'camp-wolf-'+well.id+'-'+i,kind:'wolf',combatKind:'wolf',
        faction:'wildlife',neutral:true,defeated:false,
        x:place.x,y:place.y,home:{...place},wolfSeed:seed,
        wolfState:'roaming',wolfMode:'walk',wolfFace:i%2?1:-1,
        wolfWanderIndex:0,wolfDecisionIn:0,wolfTargetId:null,
        wolfPath:null,wolfPathIndex:1
      });
    }
    return wolves;
  }
  function ensure(){
    const tactical=combat();
    const well=State.village?.founded&&State.structures.find(s=>s.id===State.village.wellId&&s.type==='well');
    if(!tactical||!well)return;
    const token=String(State.seed)+':'+well.id;
    if(tactical.wolfSpawnedFor()!==token){
      tactical.registerWolves(token,createPack(well));
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
  function closestTarget(wolf,priorId){
    const active=combat()?.units().filter(live)||[];
    let best=null,bestD=Infinity;
    for(const u of active){
      const d=distance(wolf,u),limit=u.id===priorId?LOST:DETECT;
      if(d<limit&&d<bestD){best=u;bestD=d}
    }
    return best;
  }
  function wanderTarget(wolf){
    const i=wolf.wolfWanderIndex=(wolf.wolfWanderIndex||0)+1;
    const angle=i*2.39996+wolf.wolfSeed*Math.PI*2;
    const radius=1.7+hash(wolf.id+':wander:'+i)*3;
    const p={x:wolf.home.x+Math.cos(angle)*radius,y:wolf.home.y+Math.sin(angle)*radius};
    return free(p)?p:wolf.home;
  }
  function routeTo(wolf,goal){
    if(!goal)return false;
    let path=null;
    if(peasantSegmentClear(wolf,goal,wolf.id))path=[{x:wolf.x,y:wolf.y},goal];
    else{
      const candidate=findPeasantPath(wolf,goal,wolf.id,9);
      if(candidate?.length>1&&candidate.slice(1).every((p,i)=>
        peasantSegmentClear(candidate[i],p,wolf.id)))path=candidate;
    }
    if(!path){wolf.wolfPath=null;wolf.wolfPathIndex=1;return false}
    wolf.wolfPath=path.map(p=>({x:p.x,y:p.y}));
    wolf.wolfPathIndex=1;return true;
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
    ensure();
    const night=isNight();
    for(const wolf of pack()){
      if(wolf.defeated||wolf.stats?.hp===0)continue;
      wolf.neutral=!night;
      wolf.wolfDecisionIn=(wolf.wolfDecisionIn||0)-dt;
      const target=night?closestTarget(wolf,wolf.wolfTargetId):null;
      if(target){
        wolf.wolfTargetId=target.id;
        wolf.wolfState='hunting';
        if(distance(wolf,target)<=MELEE){
          wolf.wolfPath=null;wolf.wolfMode='idle';
          wolf.wolfDecisionIn=Math.min(.2,wolf.wolfDecisionIn);continue;
        }
        wolf.wolfMode='run';
        if(wolf.wolfDecisionIn<=0||!wolf.wolfPath?.length){
          routeTo(wolf,{x:target.x,y:target.y});
          wolf.wolfDecisionIn=.65;
        }
        advance(wolf,dt,1.35);
      }else{
        wolf.wolfTargetId=null;wolf.wolfState=night?'alert':'roaming';
        if(wolf.wolfDecisionIn<=0||!wolf.wolfPath?.length){
          routeTo(wolf,wanderTarget(wolf));
          wolf.wolfDecisionIn=1.8+wolf.wolfSeed;
        }
        wolf.wolfMode=wolf.wolfPath?.length?'walk':night?'howl':'idle';
        advance(wolf,dt,night?.54:.38);
      }
    }
  }
  function draw(g,wolf){
    if(!window.ConquerAnimals?.SPECIES?.wolf||wolf.defeated||wolf.stats?.hp===0)return;
    const p=w2s(wolf,.08);
    const size=clamp(State.view.scale*16,8,40);
    withUrbanFigureOcclusion(wolf,.08,()=>
      window.ConquerAnimals.drawAnimal('wolf',g,p.x,p.y,size,{
        mode:wolf.wolfMode||(isNight()?'howl':'walk'),
        facing:wolf.wolfFace||1,seed:wolf.wolfSeed||0,t:performance.now()/1000
      }));
  }
  window.ConquerWolves={ensure,tick,draw,isNight,pack};
  ensure();
})();
