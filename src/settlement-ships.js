'use strict';
// Ships in the world. The models are built in Blender (tools/blender/build_ships.py ->
// src/assets/ship-models.js, window.ConquerShipModels): three small craft (barca, cargo,
// caravella) and two large ships (cocca, nave), +x bow, +y port, +z up, z=0 waterline.
// Each ship has a static hull and rig (p/i/c) and its sails twice, set (v) and furled
// under the yards (f), triangle for triangle: furl 0..1 morphs between the two, which
// is how sails are raised and lowered.
(() => {
  const M=window.ConquerShipModels;if(!M?.ships)return;
  const keys=Object.keys(M.ships);
  const SAIL_TIME=3;                       // seconds to raise or lower the sails
  const smooth=t=>t*t*(3-2*t);
  // World-space mesh {pos,col} for a ship at {x,y,heading,z}; furl 0 = set, 1 = furled.
  function mesh(key,pose,furl=0){
    const m=M.ships[key];if(!m)return null;
    const h=pose.heading||0,cs=Math.cos(h),sn=Math.sin(h),z=pose.z||0,pos=[],col=[];
    const put=(x,y,zz)=>pos.push(pose.x+x*cs-y*sn,pose.y+x*sn+y*cs,z+zz);
    for(let t=0;t<m.c.length;t++){
      for(let k=0;k<3;k++){const j=m.i[t*3+k]*3;put(m.p[j],m.p[j+1],m.p[j+2])}
      col.push(M.palette[m.c[t]]);
    }
    const s=m.sails,f=Math.max(0,Math.min(1,furl));
    for(let t=0;t<s.c.length;t++){
      for(let k=0;k<3;k++){const j=t*9+k*3;put(s.v[j]+(s.f[j]-s.v[j])*f,s.v[j+1]+(s.f[j+1]-s.v[j+1])*f,s.v[j+2]+(s.f[j+2]-s.v[j+2])*f)}
      col.push(M.palette[s.c[t]]);
    }
    return{pos,col};
  }
  // Sail state of one ship: {furl, target}. step() moves furl towards target at SAIL_TIME,
  // eased; raise()/lower() set the target ("alzare" = furl up to the yards).
  const sailState=(furled=false)=>({furl:furled?1:0,target:furled?1:0,t:furled?1:0});
  function step(state,dt){
    const d=state.target-state.t;
    if(d)state.t+=Math.sign(d)*Math.min(Math.abs(d),dt/SAIL_TIME);
    state.furl=smooth(state.t);
    return state;
  }
  const raise=state=>(state.target=1,state);
  const lower=state=>(state.target=0,state);
  // Raise / hold / lower / hold loop for previews: furl at time t (seconds).
  function cycle(t,hold=1.5){
    const period=2*(SAIL_TIME+hold),q=((t%period)+period)%period;
    if(q<SAIL_TIME)return smooth(q/SAIL_TIME);
    if(q<SAIL_TIME+hold)return 1;
    if(q<2*SAIL_TIME+hold)return 1-smooth((q-SAIL_TIME-hold)/SAIL_TIME);
    return 0;
  }
  // Asset Lab: every ship with its sails set and furled, as part lists of the registry.
  M.lab={};
  for(const k of keys){
    const m=M.ships[k],hull={p:m.p,i:m.i,c:m.c};
    M.lab[k]={parts:{hull,sails:{v:m.sails.v,c:m.sails.c}}};
    M.lab[k+'Furled']={parts:{hull,sails:{v:m.sails.f,c:m.sails.c}}};
  }
  window.ConquerShips=Object.freeze({keys,mesh,sailState,step,raise,lower,cycle,SAIL_TIME,
    small:keys.filter(k=>M.ships[k].size==='small'),large:keys.filter(k=>M.ships[k].size==='large')});
})();
