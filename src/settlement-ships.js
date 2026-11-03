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
  // Heraldry. A ship belongs to the player's realm, to a foreign realm, or is a merchant:
  // warships fly their realm's flags and wear its arms on the sails; merchants fly the flag
  // of the realm they sail under but keep plain sails. Foreign realms are placeholders until
  // the world map gives them arms of their own.
  const FOREIGN=Object.freeze({
    azure:{label:'Regno d’Azzurro',heraldry:{pattern:'perPale',c1:'#1f4f9c',c2:'#f1e6c9',symbol:'eagle',c3:'#1b1b1b',c4:'#f1e6c9'}},
    vert:{label:'Regno di Verde',heraldry:{pattern:'chevron',c1:'#2f6b34',c2:'#e9d9a8',symbol:'deer',c3:'#7a1e1e',c4:'#e9d9a8'}},
    sable:{label:'Regno di Nero',heraldry:{pattern:'cross',c1:'#d9b54a',c2:'#1b1a18',symbol:'lion',c3:'#b32628',c4:'#d9b54a'}}
  });
  const playerArms=()=>(typeof State!=='undefined'&&State.heraldry)||window.ConquerHeraldryShapes?.DEFAULT||null;
  // {allegiance:'player'|'foreign'|'merchant', realm:'player'|<FOREIGN key>} -> {flag, sail}.
  function arms(o={}){
    const realm=o.allegiance==='foreign'?(o.realm||'azure'):o.realm||'player';
    const h=realm==='player'?playerArms():FOREIGN[realm]?.heraldry||playerArms();
    return{flag:h,sail:o.allegiance==='merchant'?null:h};
  }
  const FLAG_COLS=10,FLAG_ROWS=6,EMBLEM_OFF=.012;
  // Model -> world for a pose {x,y,heading,z,roll,pitch}: roll heels the ship to port
  // (about +x), pitch dips the bow (about +y), then heading and the pose position.
  function placer(pose){
    const h=pose.heading||0,cs=Math.cos(h),sn=Math.sin(h),z0=pose.z||0;
    const r=pose.roll||0,p=pose.pitch||0,cr=Math.cos(r),sr=Math.sin(r),cp=Math.cos(p),sp=Math.sin(p),tilt=r||p;
    return(x,y,z,out)=>{
      if(tilt){const y1=y*cr-z*sr,z1=y*sr+z*cr;const x2=x*cp-z1*sp;z=x*sp+z1*cp;x=x2;y=y1}
      out.push(pose.x+x*cs-y*sn,pose.y+x*sn+y*cs,z0+z);
    };
  }
  function toWorld(pose,l){const o=[];placer(pose)(l[0],l[1],l[2],o);return{x:o[0],y:o[1],z:o[2]}}
  const sample=(h,c,r)=>window.ConquerHeraldryShapes?.sample(h,c,r)||null;
  // Liveries: each ship gets a random hull paint (the wale and castle panels, 'red' in the
  // model) and planking tone (the oak and tar shades), so two ships of a kind look apart.
  const PAINTS=[['#b0332a','#86241f'],['#2f5f9e','#223f6b'],['#2f6b3c','#1f4a29'],['#d2a63a','#9c7a26'],['#2a2624','#161413'],['#e7dcc4','#b9ad94'],['#6b3a7a','#4a2755']];
  const WOODS=[null,['#7a5230','#8f6439','#4e321b'],['#b08458','#c39a6c','#7c5a38'],['#6f6a62','#86817a','#4a4641'],['#4b2a20','#5e3326','#2a1913']];
  const PAINT_KEYS=['red','redDark'],WOOD_KEYS=[['oak','oakLight','oakDark'],['tar','tarLight','tarDark']];
  const livery=(rnd=Math.random)=>({paint:Math.floor(rnd()*PAINTS.length),wood:Math.floor(rnd()*WOODS.length)});
  const liveryCache=new Map();
  function palette(l){
    if(!l||!M.paletteKeys)return M.palette;
    const id=l.paint+'/'+l.wood;if(liveryCache.has(id))return liveryCache.get(id);
    const out=M.palette.slice(),set=(k,c)=>{const i=M.paletteKeys.indexOf(k);if(i>=0&&c)out[i]=c};
    PAINT_KEYS.forEach((k,i)=>set(k,PAINTS[l.paint]?.[i]));
    const w=WOODS[l.wood];if(w)for(const ks of WOOD_KEYS)ks.forEach((k,i)=>set(k,w[i]));
    liveryCache.set(id,out);return out;
  }
  // World-space mesh {pos,col} for a ship at {x,y,heading,z}; furl 0 = set, 1 = furled.
  // With heraldry {flag, sail, t} it adds the flags (waving at time t) and the arms on the sails.
  function mesh(key,pose,furl=0,heraldry=null,liv=null){
    const m=M.ships[key];if(!m)return null;
    const P=palette(liv);
    const pos=[],col=[],place=placer(pose),put=(x,y,zz)=>place(x,y,zz,pos);
    const quad=(a,b,c,d,colour)=>{for(const q of [a,b,c,a,c,d])put(q[0],q[1],q[2]);col.push(colour,colour)};
    for(let t=0;t<m.c.length;t++){
      for(let k=0;k<3;k++){const j=m.i[t*3+k]*3;put(m.p[j],m.p[j+1],m.p[j+2])}
      col.push(P[m.c[t]]);
    }
    const s=m.sails,f=Math.max(0,Math.min(1,furl));
    for(let t=0;t<s.c.length;t++){
      for(let k=0;k<3;k++){const j=t*9+k*3;put(s.v[j]+(s.f[j]-s.v[j])*f,s.v[j+1]+(s.f[j+1]-s.v[j+1])*f,s.v[j+2]+(s.f[j+2]-s.v[j+2])*f)}
      col.push(P[s.c[t]]);
    }
    if(!heraldry)return{pos,col};
    // Arms on the sails: each patch follows its cloth (set / furled) just off both faces.
    const sailGrid=heraldry.sail&&m.emblems.length?m.emblems.map(e=>sample(heraldry.sail,e.cols,e.rows)):null;
    if(sailGrid)m.emblems.forEach((e,n)=>{
      const g=sailGrid[n];if(!g)return;
      const W=e.cols+1,ax=e.axis==='x'?0:1;
      const P=(c,r,off)=>{const j=(r*W+c)*3,p=[0,1,2].map(i=>e.v[j+i]+(e.f[j+i]-e.v[j+i])*f);p[ax]+=off;return p};
      for(const off of [EMBLEM_OFF,-EMBLEM_OFF])for(let r=0;r<e.rows;r++)for(let c=0;c<e.cols;c++)
        quad(P(c,r,off),P(c+1,r,off),P(c+1,r+1,off),P(c,r+1,off),g[r][c]);
    });
    if(heraldry.flag)addFlags(m,heraldry.flag,heraldry.t||0,quad);
    return{pos,col};
  }
  // Flags fly aft from the top of their staff, waving with the time.
  function addFlags(m,h,t,quad){
    const fg=sample(h,FLAG_COLS,FLAG_ROWS);if(!fg)return;
    for(const fl of m.flags){
      const [ax,ay,az]=fl.at;
      const P=(c,r)=>{const u=c/FLAG_COLS,v=r/FLAG_ROWS,wave=Math.sin(u*5-t*4+v*.6)*fl.h*.16*u;
        return[ax-u*fl.w,ay+wave,az-v*fl.h-u*u*fl.h*.08]};
      for(let r=0;r<FLAG_ROWS;r++)for(let c=0;c<FLAG_COLS;c++)quad(P(c,r),P(c+1,r),P(c+1,r+1),P(c,r+1),fg[r][c]);
    }
  }
  // The flags alone, as a world mesh: cheap enough to wave every frame over a cached ship.
  function flagMesh(key,pose,h,t=0){
    const m=M.ships[key];if(!m||!h)return null;
    const pos=[],col=[],place=placer(pose),put=(x,y,zz)=>place(x,y,zz,pos);
    addFlags(m,h,t,(a,b,c,d,colour)=>{for(const q of [a,b,c,a,c,d])put(q[0],q[1],q[2]);col.push(colour,colour)});
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
  window.ConquerShips=Object.freeze({keys,mesh,livery,PAINTS,WOODS,flagMesh,toWorld,sailState,step,raise,lower,cycle,SAIL_TIME,FOREIGN,arms,
    small:keys.filter(k=>M.ships[k].size==='small'),large:keys.filter(k=>M.ships[k].size==='large')});
})();
