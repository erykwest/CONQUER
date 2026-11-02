'use strict';
// Ships in the game world (test fleet, DEV panel). A ship moors at the first free berth of a
// pier (settlement-pier.js), lying alongside with its bow to the sea, or, with no free berth,
// rides at anchor off the coast. Each ship has its arms (ConquerShips.arms) and a crew
// (settlement-ship-crew.js) that works the sails on orders. Ships are drawn every frame on
// the dynamic layer (both renderers) with their sailors as depth-sorted figures; the crews
// run on real time, so the sails can be tested with the game paused. Not saved yet.
(() => {
  const S=()=>window.ConquerShips,C=()=>window.ConquerShipCrew,M=()=>window.ConquerShipModels;
  const ships=[];let last=0,seq=0;
  const occupied=(pierId,side)=>ships.some(s=>s.berth?.pierId===pierId&&s.berth.side===side);
  // Pose alongside a berth: the hull touches the deck edge, amidships at the berth.
  function berthPose(pier,side,key){
    const b=window.ConquerPier.moorings(pier).find(m=>m.side===side),m=M().ships[key];
    const off=m.B/2+.12;
    return{x:b.edge.x+b.out.x*off,y:b.edge.y+b.out.y*off,heading:pier.angle||0,z:0};
  }
  // Off the coast at anchor: in deep water, spread out so ships don't overlap.
  function anchorPose(key,n){
    const sea=(State.environment||[]).find(f=>f.type==='sea'&&f.coastline?.length>1);if(!sea)return null;
    const mid={x:100,y:100},hit=window.ConquerPier.coastHit(mid);if(!hit)return null;
    const t={x:-hit.normal.y,y:hit.normal.x},d=7+M().ships[key].B,along=(n%5-2)*9;
    return{x:hit.point.x+hit.normal.x*d+t.x*along,y:hit.point.y+hit.normal.y*d+t.y*along,heading:Math.atan2(t.y,t.x),z:0};
  }
  // pier: moor at that pier only; anchor: true rides at anchor even with berths free.
  function spawn({key='cocca',allegiance='merchant',realm='player',pier=null,anchor=false}={}){
    if(!M()?.ships?.[key])return null;
    let berth=null,pose=null;
    if(!anchor)for(const p of (State.structures||[]).filter(s=>s.type==='pier'&&(!pier||s.id===pier)))
      for(const side of ['left','right'])if(!berth&&!occupied(p.id,side)){berth={pierId:p.id,side};pose=berthPose(p,side,key)}
    pose||=anchorPose(key,ships.length);
    if(!pose)return null;
    // In port the sails are furled up to the yards; at anchor off the coast they stay set.
    const id='ship-'+(++seq),ship={id,key,allegiance,realm,berth,pose,crew:C().crewState(key,id,S().sailState(!!berth)),cache:null};
    ships.push(ship);requestDraw();
    return ship;
  }
  function order(what,id=null){for(const s of ships)if(!id||s.id===id)C().order(s.crew,what);requestDraw()}
  function clear(){ships.length=0;requestDraw()}
  const requestDraw=()=>{if(typeof requestSceneDraw==='function')requestSceneDraw();else if(typeof draw==='function')draw()};
  // Keep the moored ships alongside if a pier moved or vanished.
  function sync(){
    for(let i=ships.length-1;i>=0;i--){
      const s=ships[i];if(!s.berth)continue;
      const pier=State.structures.find(p=>p.id===s.berth.pierId);
      if(!pier){ships.splice(i,1);continue}
      s.pose=berthPose(pier,s.berth.side,s.key);
    }
  }
  function drawAll(){
    if(!ships.length||!window.ConquerMesh3D)return;
    const now=(typeof performance!=='undefined'?performance.now():Date.now())/1000,dt=last?Math.min(.1,now-last):0;last=now;
    sync();
    const M3=window.ConquerMesh3D,view=M3.gameView(),meshes=[],sprites=[];
    for(const s of ships)C().step(s.crew,dt);
    // With every sail at rest the ships (and their piers) are painted once into a cached
    // bitmap and only the flags and sailors are drawn live; during a manoeuvre all is live.
    const still=!ships.some(s=>s.crew.sail.t!==s.crew.sail.target);
    // Ships are painted over the scene: the piers they lie at are painted again in the same
    // depth sort, so a pier in front of a hull still covers it.
    for(const id of new Set(ships.filter(s=>s.berth).map(s=>s.berth.pierId))){
      const pier=State.structures.find(p=>p.id===id);if(pier)meshes.push(...window.ConquerPier.meshes(pier));
    }
    for(const s of ships){
      const arms=S().arms(s),key=[s.pose.x,s.pose.y,s.pose.heading,s.crew.sail.furl.toFixed(3),JSON.stringify(arms)].join('|');
      if(s.cache?.key!==key)s.cache={key,mesh:S().mesh(s.key,s.pose,s.crew.sail.furl,{sail:arms.sail,flag:null})};
      meshes.push(s.cache.mesh);
      s.flags=S().flagMesh(s.key,s.pose,arms.flag,now);
      if(State.view.scale<.3)continue;
      for(const sl of C().sailors(s.crew)){
        const w=C().toWorld(s.pose,sl.local),a=C().toWorld(s.pose,sl.local.map((v,i)=>v+(sl.dir[i]||0)));
        sprites.push({...w,draw:()=>{
          const p=w2sRaw(w,w.z),q=w2sRaw(a,a.z);
          withProjectionGroundZ(w.z-.1,()=>C().drawSailor(C().dot(sl.id,{x:w.x,y:w.y}),sl.mode,now,q.x>=p.x?1:-1));
        }});
      }
    }
    const flags=ships.map(s=>s.flags).filter(Boolean);
    if(still){
      M3.drawCached(ctx,'fleet',ships.map(s=>s.cache.key).join(';'),()=>meshes,ships[0].pose);
      M3.drawMeshes(ctx,flags,view,sprites);
    }else M3.drawMeshes(ctx,[...meshes,...flags],view,sprites);
    // Sailors are always about (and flags wave): with ships afloat, keep frames coming even
    // when the game is paused.
    requestDraw();
  }
  // DEV panel (index.html #devShips).
  function bindDev(){
    const $=id=>document.getElementById(id);if(!$('devShipSpawn'))return;
    const readout=msg=>{$('devShipReadout').textContent=msg||(ships.length?ships.length+' navi · '+ships.map(s=>M().ships[s.key].label+(s.berth?' (ormeggiata)':' (alla fonda)')).join(', '):'Nessuna nave')};
    $('devShipSpawn').onclick=()=>{
      const [allegiance,realm]=$('devShipFlag').value.split('|'),s=spawn({key:$('devShipKind').value,allegiance,realm});
      readout(s?null:'Nessun mare su questa mappa: scegli il bioma Mare');
    };
    $('devShipClear').onclick=()=>{clear();readout()};
    $('devShipRaise').onclick=()=>{order('raise');readout()};
    $('devShipLower').onclick=()=>{order('lower');readout()};
  }
  if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bindDev);else bindDev()}
  window.ConquerFleet=Object.freeze({ships,spawn,order,clear,draw:drawAll,berthPose,anchorPose});
})();
