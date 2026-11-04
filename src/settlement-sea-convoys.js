'use strict';
// Merchant ships of the lord's convoys (settlement-convoys.js with vehicle shipSmall /
// shipLarge, settlement-commerce.js VEHICLES): a small ship carries three wagons of cargo, a
// large one nine. On departure the ships cast off from the harbour and sail to the convoy's sea
// exit (the sea edge or one of the sea stubs of the adjacent edges), then they are away in the
// neighbouring province; on the way back they come in from the same exit and tie up again.
// Shown as fleet ships tagged with the convoy (ConquerFleet, not saved: they follow the convoy).
(() => {
  const OUT_SHARE=.3,IN_SHARE=.3,MAX_SHOWN=3;
  const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t)};
  const V=()=>window.ConquerCommerce?.VEHICLES||{};
  const convoys=()=>Object.values(window.ConquerCommerce?.state?.()?.lordConvoys||{});
  const isSea=j=>!!V()[j?.transport?.mode]?.ship;
  function exitPoint(j){
    const e=window.ConquerConvoys?.availableExits?.().find(x=>x.mode==='sea'&&x.edge===j.edge);
    if(!e)return null;
    const W=typeof WORLD==='number'?WORLD:200;
    return{x:Math.min(W-1,Math.max(1,e.point.x)),y:Math.min(W-1,Math.max(1,e.point.y))};
  }
  // 0..1 share of the visible leg: leaving port (out) or coming in (in), else null (away / home).
  function leg(j,day){
    if(j.status==='outbound'){const span=Math.max(.01,j.arrivalDay-j.actualDepartDay),p=(day-j.actualDepartDay)/span;return p<OUT_SHARE?{dir:'out',t:p/OUT_SHARE}:null}
    if(j.status==='returning'){const span=Math.max(.01,j.returnDay-j.arrivalDay),p=(day-j.arrivalDay)/span;return p>1-IN_SHARE?{dir:'in',t:(p-(1-IN_SHARE))/IN_SHARE}:null}
    return null;
  }
  function pose(home,exit,t,k){
    const hit=window.ConquerPier?.coastHit(home),n=hit?.normal||{x:0,y:1};
    const clear={x:home.x+n.x*6,y:home.y+n.y*6},side={x:-n.y*k*4.5,y:n.x*k*4.5};
    const a=t<.25?home:clear,b=t<.25?clear:{x:exit.x+side.x,y:exit.y+side.y},u=smooth(t<.25?t/.25:(t-.25)/.75);
    return{x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u,heading:Math.atan2(b.y-a.y,b.x-a.x),z:0};
  }
  // Called by ConquerFleet each frame, after the berths are synced.
  function step(){
    const F=window.ConquerFleet;if(!F)return;
    const day=+State.clock?.day||0,want=new Map();
    for(const j of convoys()){
      if(!isSea(j))continue;
      const l=leg(j,day),exit=l&&exitPoint(j);if(!l||!exit)continue;
      want.set(j.id,{j,l,exit,n:Math.min(MAX_SHOWN,j.transport.wagons||1),key:V()[j.transport.mode].model});
    }
    for(const s of F.ships.slice())if(s.convoy&&!want.has(s.convoy.id))F.remove(s.id);
    for(const [id,w] of want){
      let mine=F.ships.filter(s=>s.convoy?.id===id);
      for(let k=mine.length;k<w.n;k++){
        const s=F.spawn({key:w.key,allegiance:'player',realm:'player',convoy:{id,k}});
        if(!s)break;
      }
      mine=F.ships.filter(s=>s.convoy?.id===id);
      for(const s of mine){
        s.convoy.home||={...s.pose};
        // In line abreast, each ship a little behind the one ahead.
        const lag=s.convoy.k*.05,t=Math.max(0,Math.min(1,(w.l.dir==='out'?w.l.t:1-w.l.t)-lag)),p=pose(s.convoy.home,w.exit,t,s.convoy.k-(w.n-1)/2);
        if(w.l.dir==='in')p.heading+=Math.PI;
        s.pose=p;window.ConquerShips.lower(s.crew.sail);
      }
    }
  }
  window.ConquerSeaConvoys=Object.freeze({OUT_SHARE,IN_SHARE,isSea,leg,exitPoint,pose,step});
})();
