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
  const DEPART=.24,RETURN=.62;
  const GROUND_OUT=24;
  const hash=s=>{let h=2166136261;for(const c of String(s)){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0};
  const harbour=()=>(State.structures||[]).filter(s=>(s.type==='pier'||s.type==='quay')&&!underConstruction(s));
  const workCentre=s=>s.type==='quay'?{x:(s.a.x+s.b.x)/2,y:(s.a.y+s.b.y)/2}:{x:s.x,y:s.y};
  function berthCount(works){
    let n=0;
    for(const w of works)n+=w.type==='pier'?(w.yard||w.use==='military'?0:2):(window.ConquerQuay?.berths(w)||[]).length;
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
  // One boat per fisherman, moored at a free berth (never at anchor): half the households row a
  // barchetta, the others sail a barca; boats of houses that no longer fish are taken away.
  const boatKey=id=>hash('boat|'+id)%2?'barchetta':'barca';
  function syncBoats(){
    const F=window.ConquerFleet;if(!F)return;
    const ids=fisherIds();
    for(const s of F.ships.slice())if(s.fisher&&!ids.has(s.fisher))F.remove(s.id);
    for(const id of ids)if(!F.ships.some(s=>s.fisher===id)){
      const boat=F.spawn({key:boatKey(id),allegiance:'merchant',realm:'player',noAnchor:true,fisher:id});
      if(!boat)break;
    }
  }
  const working=()=>{
    const day=Math.floor(State.clock?.day||0);
    return((day%7)+7)%7<5&&(window.ConquerCombat?.alarmMode?.()||'off')==='off';
  };
  // Fishing ground for a boat: off the coast from its berth, in open water its hull fits.
  function ground(boat,home){
    const hit=window.ConquerPier?.coastHit(home);if(!hit)return null;
    const n=hit.normal,t={x:-n.y,y:n.x},r=(hash(boat.fisher)%1000)/1000,N=window.ConquerSeaNav;
    const B=window.ConquerShips?.model(boat.key)?.B||1;
    // Each boat keeps 10U from the grounds the other boats are fishing or heading to.
    const taken=(window.ConquerFleet?.ships||[]).filter(o=>o!==boat&&o.fish?.ground&&o.fish.phase!=='moored').map(o=>o.fish.ground.p);
    for(let k=GROUND_OUT;k>=8;k-=4)for(const lat of [0,1,-1,2,-2,3,-3]){
      const p={x:home.x+n.x*k+t.x*((r-.5)*8+lat*9),y:home.y+n.y*k+t.y*((r-.5)*8+lat*9)};
      if(taken.some(q=>Math.hypot(q.x-p.x,q.y-p.y)<10))continue;
      if(N?N.clearAt(p)>=N.need(B)+1.5:true)return{p,n};
    }
    return null;
  }
  // The net: paid out abeam (cast), left to fish (soak), hauled back aboard (haul), a pause.
  const NET=Object.freeze({cast:6,soak:20,haul:6,rest:4});
  function netScale(t){
    const T=NET.cast+NET.soak+NET.haul+NET.rest,u=((t%T)+T)%T;
    if(u<NET.cast)return .15+.85*(u/NET.cast);
    if(u<NET.cast+NET.soak)return 1;
    if(u<NET.cast+NET.soak+NET.haul)return 1-.85*((u-NET.cast-NET.soak)/NET.haul);
    return 0;
  }
  // The day of a fishing boat: moored -> out (along a sea route) -> fishing (nets) -> home.
  let lastNow=null;
  function step(now){
    syncBoats();
    const F=window.ConquerFleet,N=window.ConquerSeaNav,S=window.ConquerShips;if(!F)return;
    const dt=lastNow==null?0:Math.max(0,Math.min(.25,now-lastNow));lastNow=now;
    const frac=typeof visualCycleFrac==='function'?visualCycleFrac():.5,want=working()&&frac>=DEPART&&frac<RETURN;
    for(const s of F.ships){
      if(!s.fisher)continue;
      const f=s.fish||(s.fish={phase:'moored'});
      if(f.phase==='moored'){
        f.home={...s.pose};s.row=null;
        if(want&&s.berth&&N){const g=ground(s,f.home);if(g){f.ground=g;f.phase='out';f.pose={...s.pose}}}
      }else s.pose=f.pose;           // the berth sync put it back alongside: it is out at sea
      let moving=false;
      if(f.phase==='out'){
        const r=N.drive(s,f.ground.p,dt,F.ships);moving=r==='moving';
        if(r==='arrived'){f.phase='fishing';f.t0=now;s.nav=null}
        if(r==='stuck'){f.phase='moored';s.nav=null}
      }else if(f.phase==='fishing'){
        // Drifting slowly, bow turning to the wind, while the net is out.
        s.pose.heading+=dt*.04;
        if(!want&&netScale(now-f.t0)===0){f.phase='home'}
      }
      if(f.phase==='home'){
        const r=N.drive(s,f.home,dt,F.ships);moving=r==='moving';
        if(r==='arrived'||r==='stuck'){f.phase='moored';s.nav=null;s.pose={...f.home}}
      }
      if(f.phase!=='moored')f.pose=s.pose;
      s.away=f.phase!=='moored';
      // Sails set on the way, furled in port and while fishing; the barchetta rows.
      if(moving)S.lower(s.crew.sail);else S.raise(s.crew.sail);
      s.row=moving&&s.key==='barchetta'?((s.row||0)+dt*3.6)%(Math.PI*2):null;
    }
  }
  // Nets of the boats on their fishing grounds (fishing-models castNet), scaled as they are
  // cast and hauled, lying abeam on the water.
  function netMeshes(now){
    const K=window.ConquerFishingModels?.models?.castNet,P=window.ConquerFishingModels?.palette;if(!K)return[];
    const out=[];
    for(const s of window.ConquerFleet?.ships||[]){
      if(s.fish?.phase!=='fishing')continue;
      const k=netScale(now-s.fish.t0);if(k<=0)continue;
      const m=window.ConquerShips.model(s.key),h=s.pose.heading,R=.95*k,side=(m?.B||1)/2+R+.25;
      const o={x:s.pose.x-Math.sin(h)*side,y:s.pose.y+Math.cos(h)*side},pos=[],col=[],sc=1.1*k;
      for(const part of Object.values(K.parts))for(let t=0;t<part.c.length;t++){
        for(let q=0;q<3;q++){const j=part.i[t*3+q]*3;pos.push(o.x+part.p[j]*sc,o.y+part.p[j+1]*sc,part.p[j+2])}
        col.push(P[part.c[t]]);
      }
      out.push({pos,col});
    }
    return out;
  }  // The fisherman's lot (tools/blender/build_fishing.py): a net hung out to dry and a fish
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
  window.ConquerFishers=Object.freeze({REACH,FOOD_PER_DAY,isFisher,fishers,fisherIds,syncBoats,step,working,ground,netScale,netMeshes,lotMeshes,boatKey});
})();
