'use strict';
// Fishermen. An L1 house near a pier or a quay (REACH) is a fisherman's household instead of a
// garden, goat or sheep lot, as long as there is a free berth for its boat: the nearest houses
// first, one per berth. Each fisherman has a fishing boat (ConquerFleet, key 'barca') moored
// at a pier or quay berth. On working days it sails out at dawn to a fishing ground off the
// coast, works its nets there and comes back in the afternoon; the catch is private food
// (settlement-economy.js, FOOD_PER_DAY per fisherman). Derived from the houses and the harbour
// works on every frame: nothing extra is saved.
(() => {
  const REACH=14,FOOD_PER_DAY=1.2;
  // Visual day (0..1): leave, reach the ground, haul in, back at the berth.
  const DEPART=.24,GROUND_AT=.32,RETURN=.60,HOME_AT=.68;
  const GROUND_OUT=24,CLEAR=5;
  const hash=s=>{let h=2166136261;for(const c of String(s)){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0};
  const harbour=()=>(State.structures||[]).filter(s=>(s.type==='pier'||s.type==='quay')&&!underConstruction(s));
  const workCentre=s=>s.type==='quay'?{x:(s.a.x+s.b.x)/2,y:(s.a.y+s.b.y)/2}:{x:s.x,y:s.y};
  function berthCount(works){
    let n=0;
    for(const w of works)n+=w.type==='pier'?(w.yard?0:2):(window.ConquerQuay?.berths(w)||[]).length;
    // Ships already moored that are not fishing boats hold their berths.
    return Math.max(0,n-(window.ConquerFleet?.ships||[]).filter(s=>s.berth&&!s.fisher).length);
  }
  let cache={key:null,ids:new Set()};
  function fisherIds(){
    const works=harbour(),list=State.structures||[];
    const key=(State.seed||0)+'|'+list.length+'|'+works.map(w=>w.id).join()+'|'+(window.ConquerFleet?.ships||[]).filter(s=>s.berth&&!s.fisher).length;
    if(cache.key===key)return cache.ids;
    const ids=new Set();
    if(works.length&&State.village?.founded){
      const near=list.filter(h=>h.type==='house'&&houseLevel(h)===1&&!underConstruction(h)&&!h.destroyed&&!h.abandoned)
        .map(h=>({h,d:Math.min(...works.map(w=>dist(h,workCentre(w))))})).filter(o=>o.d<=REACH)
        .sort((a,b)=>a.d-b.d||String(a.h.id).localeCompare(String(b.h.id)));
      for(const o of near.slice(0,berthCount(works)))ids.add(o.h.id);
    }
    cache={key,ids};return ids;
  }
  const isFisher=h=>!!h&&fisherIds().has(h.id);
  const fishers=()=>(State.structures||[]).filter(isFisher);
  // One boat per fisherman: moored at a free berth, never at anchor; boats of houses that no
  // longer fish are taken away.
  function syncBoats(){
    const F=window.ConquerFleet;if(!F)return;
    const ids=fisherIds();
    for(const s of F.ships.slice())if(s.fisher&&!ids.has(s.fisher))F.remove(s.id);
    for(const id of ids)if(!F.ships.some(s=>s.fisher===id)){
      const boat=F.spawn({key:'barca',allegiance:'merchant',realm:'player',noAnchor:true,fisher:id});
      if(!boat)break;
    }
  }
  const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t)};
  const working=()=>{
    const day=Math.floor(State.clock?.day||0);
    return((day%7)+7)%7<5&&(window.ConquerCombat?.alarmMode?.()||'off')==='off';
  };
  // Offshore point for a boat: along the coast normal at the berth, inside the sea.
  function ground(boat,home){
    const hit=window.ConquerPier?.coastHit(home);if(!hit)return null;
    const n=hit.normal,t={x:-n.y,y:n.x},r=(hash(boat.fisher)%1000)/1000;
    const sea=(State.environment||[]).find(f=>f.type==='sea');
    for(let k=GROUND_OUT;k>=8;k-=4){
      const p={x:home.x+n.x*k+t.x*(r-.5)*16,y:home.y+n.y*k+t.y*(r-.5)*16};
      if(!sea||environmentContains(sea,p,-2))return{p,n};
    }
    return null;
  }
  // The boat's pose and whether it is away from its berth at this moment of the day.
  function pose(boat,home,now){
    const frac=typeof visualCycleFrac==='function'?visualCycleFrac():.5;
    if(!working()||frac<DEPART||frac>HOME_AT)return null;
    const g=ground(boat,home);if(!g)return null;
    const clear={x:home.x+g.n.x*CLEAR,y:home.y+g.n.y*CLEAR};
    // Off the berth, then out to the ground (or the way back, reversed).
    const leg=(u,out)=>{
      const a=u<.3?home:clear,b=u<.3?clear:g.p,k=u<.3?u/.3:(u-.3)/.7,s=smooth(k);
      const p={x:a.x+(b.x-a.x)*s,y:a.y+(b.y-a.y)*s},dx=(b.x-a.x)*(out?1:-1),dy=(b.y-a.y)*(out?1:-1);
      return{x:p.x,y:p.y,heading:Math.atan2(dy,dx),z:0};
    };
    if(frac<GROUND_AT)return leg((frac-DEPART)/(GROUND_AT-DEPART),true);
    if(frac>RETURN){const p=leg(1-(frac-RETURN)/(HOME_AT-RETURN),false);return p}
    // On the ground: a slow circle with the nets out (real time, so it moves with the day held).
    const w=now*.06+(hash(boat.fisher)%628)/100,R=3.5;
    return{x:g.p.x+Math.cos(w)*R,y:g.p.y+Math.sin(w)*R,heading:w+Math.PI/2,z:0};
  }
  // Called by ConquerFleet each frame after the berths are synced.
  function step(now){
    syncBoats();
    for(const s of window.ConquerFleet?.ships||[]){
      if(!s.fisher)continue;
      const home=s.pose,p=s.berth?pose(s,s.home||home,now):null;
      s.home=home;
      const S=window.ConquerShips;
      if(p){s.pose=p;s.away=true;S.lower(s.crew.sail)}
      else{s.away=false;S.raise(s.crew.sail)}
    }
  }
  // The fisherman's lot (tools/blender/build_fishing.py): a net hung out to dry and a fish
  // rack on the seaward side of the house, the baskets with the catch by the door.
  let lotCache={key:null,meshes:[]};
  function lotMeshes(){
    const K=window.ConquerFishingModels;if(!K?.models)return[];
    const list=fishers(),key=list.map(h=>h.id+':'+h.x+','+h.y).join(';');
    if(lotCache.key===key)return lotCache.meshes;
    const meshes=[];
    for(const h of list){
      const n=window.ConquerPier?.coastHit(h)?.normal;if(!n)continue;
      const t={x:-n.y,y:n.x},pos=[],col=[],yawT=Math.atan2(t.y,t.x);
      const model=(name,dx,dt,yaw)=>{
        const m=K.models[name],o={x:h.x+n.x*dx+t.x*dt,y:h.y+n.y*dx+t.y*dt},z0=typeof terrainElevation==='function'?terrainElevation(o):0;
        const c=Math.cos(yaw),s=Math.sin(yaw);
        for(const part of Object.values(m.parts))for(let k=0;k<part.c.length;k++){
          for(let q=0;q<3;q++){const j=part.i[k*3+q]*3,x=part.p[j],y=part.p[j+1];pos.push(o.x+x*c-y*s,o.y+x*s+y*c,z0+part.p[j+2])}
          col.push(K.palette[part.c[k]]);
        }
      };
      model('netRack',2.3,-1.1,yawT);
      model('fishRack',2.2,1.5,yawT);
      model('fishBaskets',1.3,.2,Math.atan2(n.y,n.x));
      meshes.push({pos,col});
    }
    lotCache={key,meshes};return meshes;
  }
  window.ConquerFishers=Object.freeze({REACH,FOOD_PER_DAY,isFisher,fishers,fisherIds,syncBoats,step,pose,working,lotMeshes});
})();
