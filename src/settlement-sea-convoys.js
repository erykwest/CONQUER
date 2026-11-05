'use strict';
// Merchant ships of the lord's convoys (settlement-convoys.js with vehicle shipSmall /
// shipLarge, settlement-commerce.js VEHICLES): a small ship carries three wagons of cargo, a
// large one nine. On departure the ships cast off from the harbour and sail to the convoy's sea
// exit (the sea edge or one of the sea stubs of the adjacent edges), then they are away in the
// neighbouring province; on the way back they come in from the same exit and tie up again.
// Shown as fleet ships tagged with the convoy (ConquerFleet, not saved: they follow the convoy).
(() => {
  const OUT_SHARE=.3,IN_SHARE=.3,MAX_SHOWN=3;
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
  // Ships follow sea routes (settlement-sea-nav.js): out from the berth to the exit, where they
  // leave the map; back in from the exit to a berth, where they tie up until the convoy is done.
  const done=new Map();                 // convoy id -> leg already sailed ('out' / 'in')
  let lastNow=null;
  function step(){
    const F=window.ConquerFleet,N=window.ConquerSeaNav;if(!F||!N)return;
    const now=(typeof performance!=='undefined'?performance.now():Date.now())/1000,dt=lastNow==null?0:Math.max(0,Math.min(.25,now-lastNow));lastNow=now;
    const day=+State.clock?.day||0,want=new Map();
    for(const j of convoys()){
      if(!isSea(j))continue;
      const l=leg(j,day),exit=l&&exitPoint(j);
      if(!l||!exit||done.get(j.id)===l.dir)continue;
      want.set(j.id,{j,l,exit,n:Math.min(MAX_SHOWN,j.transport.wagons||1),key:V()[j.transport.mode].model});
    }
    for(const s of F.ships.slice())if(s.convoy&&!want.has(s.convoy.id)&&!(s.convoy.dir==='in'&&s.convoy.arrived&&convoys().some(j=>j.id===s.convoy.id&&j.status==='returning')))F.remove(s.id);
    for(const [id,w] of want){
      let mine=F.ships.filter(s=>s.convoy?.id===id);
      for(let k=mine.length;k<w.n;k++){
        const s=F.spawn({key:w.key,allegiance:'player',realm:'player',convoy:{id,k,dir:w.l.dir}});
        if(!s)break;
        s.convoy.home={...s.pose};
        // Coming home: the ship appears at the exit, a little apart from the others.
        if(w.l.dir==='in')s.convoy.pose={x:w.exit.x+k*2.5,y:w.exit.y+k*2.5,heading:Math.atan2(s.pose.y-w.exit.y,s.pose.x-w.exit.x),z:0};
        else s.convoy.pose={...s.pose};
      }
      mine=F.ships.filter(s=>s.convoy?.id===id);
      let all=mine.length>0;
      for(const s of mine){
        s.pose=s.convoy.pose;s.away=true;
        const goal=w.l.dir==='out'?w.exit:s.convoy.home;
        const r=s.convoy.arrived?'arrived':N.drive(s,goal,dt,F.ships);
        if(r==='arrived'||r==='stuck')s.convoy.arrived=true;else all=false;
        s.convoy.pose=s.pose;
        if(r==='moving'||r==='waiting')window.ConquerShips.lower(s.crew.sail);else window.ConquerShips.raise(s.crew.sail);
      }
      if(all){done.set(id,w.l.dir);if(w.l.dir==='out')for(const s of mine)F.remove(s.id);else for(const s of mine){s.away=false;s.pose={...s.convoy.home}}}
    }
  }  window.ConquerSeaConvoys=Object.freeze({OUT_SHARE,IN_SHARE,isSea,leg,exitPoint,step});
})();
