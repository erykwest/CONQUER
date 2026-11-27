'use strict';
// The coast: beaches in the bays, rocks on the headlands. A coastline vertex that juts out to
// sea more than its neighbours (HEADLAND U over the mean of the three each side) is a
// headland; the coast from the middle of the segment before it to the middle of the one after
// it is rocky, the rest is beach. A beach is a sand strip on the shore and stays buildable;
// rocks are a band of boulders that units cannot cross, and roads and buildings cannot be
// placed on them, except a quay (settlement-placement.js, settlement-population-navigation.js).
// Derived from the sea's coastline, so nothing is saved. Rocks, reefs, beached boats and driftwood:
// the waterside kit (tools/blender/build_waterside.py -> src/assets/waterside-models.js).
(() => {
  const HEADLAND=1.2,ROCK_LAND=2.6,ROCK_SEA=1.2,BEACH_LAND=3,STEP=1.5;
  const SEA_DIR={north:{x:0,y:-1},south:{x:0,y:1},west:{x:-1,y:0},east:{x:1,y:0}};
  // rockAt is asked for every point the road planner samples: filtering a long environment list for
  // the seas each time cost more than the test itself. Kept while the list, its length and
  // environmentRevision stay the same and every remembered entry is still a sea with a coastline.
  const hasCoast=f=>f?.type==='sea'&&(f.coastlines?.some(c=>c.length>1)||f.coastline?.length>1);
  let seasMemo={list:null,length:-1,rev:null,seas:[]};
  const seasOf=()=>{
    const list=typeof State!=='undefined'&&State.environment||[],rev=typeof environmentRevision!=='undefined'?environmentRevision:0;
    const m=seasMemo;
    if(m.list===list&&m.length===list.length&&m.rev===rev&&m.seas.every(hasCoast))return m.seas;
    seasMemo={list,length:list.length,rev,seas:list.filter(hasCoast)};
    return seasMemo.seas;
  };
  let cache={key:null,data:null};
  const lerp=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
  // Fine points along the coast from parameter u0 to u1 (u = vertex index + fraction).
  function along(c,u0,u1,normals){
    const out=[],at=u=>{const i=Math.min(c.length-2,Math.floor(u));const p=lerp(c[i],c[i+1],u-i);if(normals){const n=lerp(normals[i],normals[i+1],u-i),l=Math.hypot(n.x,n.y)||1;p.nx=n.x/l;p.ny=n.y/l}return p};
    let len=0;for(let i=Math.floor(u0);i<Math.ceil(u1);i++)len+=Math.hypot(c[i+1].x-c[i].x,c[i+1].y-c[i].y);
    const n=Math.max(2,Math.ceil(len/STEP));
    for(let k=0;k<=n;k++)out.push(at(u0+(u1-u0)*k/n));
    return out;
  }
  const band=(pts,D,toSea,toLand)=>[...pts.map(p=>({x:p.x+(p.nx??D.x)*toSea,y:p.y+(p.ny??D.y)*toSea})),...pts.slice().reverse().map(p=>({x:p.x-(p.nx??D.x)*toLand,y:p.y-(p.ny??D.y)*toLand}))];
  const bounds=poly=>{let a=Infinity,b=Infinity,c=-Infinity,d=-Infinity;for(const p of poly){a=Math.min(a,p.x);b=Math.min(b,p.y);c=Math.max(c,p.x);d=Math.max(d,p.y)}return{minX:a,minY:b,maxX:c,maxY:d}};
  function shore(){
    const seas=seasOf();if(!seas.length)return null;
    const key=JSON.stringify(seas.map(sea=>[sea.side,sea.coastlines||[sea.coastline]]));
    if(cache.key===key)return cache.data;
    const all=[];
    for(const sea of seas)for(const c of sea.coastlines||[sea.coastline]){
    if(c.length<2)continue;
    const normals=sea.coastlines&&typeof environmentContains==='function'?c.map((p,i)=>{
      const a=c[Math.max(0,i-1)],b=c[Math.min(c.length-1,i+1)],l=Math.hypot(b.x-a.x,b.y-a.y)||1;
      let x=-(b.y-a.y)/l,y=(b.x-a.x)/l;
      if(!environmentContains(sea,{x:p.x+x*.8,y:p.y+y*.8})){x=-x;y=-y}
      return{x,y};
    }):null;
    const D=SEA_DIR[sea.side]||{x:0,y:1},out=c.map(p=>p.x*D.x+p.y*D.y);
    const head=c.map((_,i)=>{
      const near=[];for(let j=Math.max(0,i-3);j<=Math.min(c.length-1,i+3);j++)if(j!==i)near.push(out[j]);
      return out[i]-near.reduce((s,v)=>s+v,0)/near.length>HEADLAND;
    });
    // Rocky runs over parameter u, merged where headlands are next to each other.
    const runs=[];
    head.forEach((h,i)=>{if(!h)return;const u0=Math.max(0,i-.5),u1=Math.min(c.length-1,i+.5);const last=runs.at(-1);if(last&&u0<=last[1]+1e-9)last[1]=u1;else runs.push([u0,u1])});
    const stretches=[];let u=0;
    for(const [a,b] of runs){if(a>u)stretches.push({kind:'beach',u0:u,u1:a});stretches.push({kind:'rocks',u0:a,u1:b});u=b}
    if(u<c.length-1)stretches.push({kind:'beach',u0:u,u1:c.length-1});
    for(const s of stretches){
      s.points=along(c,s.u0,s.u1,normals);s.coast=c;s.normals=normals;
      s.poly=s.kind==='rocks'?band(s.points,D,ROCK_SEA,ROCK_LAND):band(s.points,D,.25,BEACH_LAND);
      s.bounds=bounds(s.poly);
    }
    all.push(...stretches);
    }
    cache={key,data:{side:seas[0].side,D:SEA_DIR[seas[0].side]||{x:0,y:1},stretches:all}};
    return cache.data;
  }
  const pip=(p,poly)=>{let k=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)k=!k}return k};
  const inside=(s,p)=>p.x>=s.bounds.minX&&p.x<=s.bounds.maxX&&p.y>=s.bounds.minY&&p.y<=s.bounds.maxY&&pip(p,s.poly);
  function kindAt(p){const d=shore();if(!d)return null;for(const s of d.stretches)if(inside(s,p))return s.kind;return null}
  const rockAt=p=>kindAt(p)==='rocks';
  const stretches=()=>shore()?.stretches||[];

  // Ground paint (2D scene and the baked WebGL ground): sand and wet sand on the beaches,
  // grey stone with a dark wet edge on the rocks.
  // The painted edges are ragged (visual only: kindAt/rockAt keep the straight bands): the
  // sand ends in an irregular line with tongues into the grass, the wet sand winds, and the
  // rocky stretches spill past their ends onto the beach in tapering, broken tongues.
  // Grass tufts, stones and (3D) bushes dot the landward edge.
  const RAGGED_STEP=.35,ROCK_SPILL=2.8;
  // Smooth world-anchored noise in about [-1,1]: continuous across stretches.
  const wnoise=(p,k=0)=>.5*Math.sin(.37*p.x+.23*p.y+1.3+k)+.3*Math.sin(.91*p.y-.57*p.x+4.1+k*2)+.2*Math.sin(2.1*p.x+1.7*p.y+.7+k*3);
  const jit=(p,k)=>h01((Math.round(p.x*97)*73856093)^(Math.round(p.y*97)*19349663)^k)*2-1;
  function fineAlong(s,u0,u1){
    const c=s.coast,N=s.normals;if(!c)return s.points;
    const a=Math.max(0,u0),b=Math.min(c.length-1,u1);
    const out=[],at=u=>{const i=Math.min(c.length-2,Math.floor(u));const p=lerp(c[i],c[i+1],u-i);if(N){const n=lerp(N[i],N[i+1],u-i),l=Math.hypot(n.x,n.y)||1;p.nx=n.x/l;p.ny=n.y/l}return p};
    let len=0;for(let i=Math.floor(a);i<Math.ceil(b);i++)len+=Math.hypot(c[i+1].x-c[i].x,c[i+1].y-c[i].y);
    const n=Math.max(2,Math.ceil(len*Math.max(.05,b-a)/Math.max(1e-6,Math.ceil(b)-Math.floor(a))/RAGGED_STEP));
    for(let k=0;k<=n;k++){const u=a+(b-a)*k/n,p=at(u);p.u=u;out.push(p)}
    return out;
  }
  // Coast parameter shift that walks about `dist` world units along the coast from u.
  function uShift(c,u,dist){
    const i=Math.max(0,Math.min(c.length-2,Math.floor(u))),L=Math.hypot(c[i+1].x-c[i].x,c[i+1].y-c[i].y)||1;
    return dist/L;
  }
  const raggedBand=(pts,D,toSea,toLand)=>[
    ...pts.map((p,i)=>({x:p.x+(p.nx??D.x)*toSea(p,i),y:p.y+(p.ny??D.y)*toSea(p,i)})),
    ...pts.map((p,i)=>({p,i})).reverse().map(({p,i})=>({x:p.x-(p.nx??D.x)*toLand(p,i),y:p.y-(p.ny??D.y)*toLand(p,i)}))];
  const inland=(p,D,d)=>({x:p.x-(p.nx??D.x)*d,y:p.y-(p.ny??D.y)*d});
  function landRagged(p,base,amp,k){
    let w=base*(1+amp*wnoise(p,k))+jit(p,k)*base*.05;
    // Tongues reaching inland and notches of grass: smooth bumps of a slower noise, a few
    // units wide (never single-point spikes).
    const slow=.6*Math.sin(.19*p.x-.27*p.y+k*1.7)+.4*Math.sin(.43*p.y+.31*p.x+k*.9);
    w+=base*.45*Math.max(0,slow-.45)/.55-base*.3*Math.max(0,-slow-.6)/.4;
    return Math.max(base*.35,w);
  }
  function drawGround(project,fill){
    const d=shore();if(!d)return;const D=d.D,list=stretches();
    const winter=typeof isSnowGround==='function'&&isSnowGround();
    const tufts=[],stones=[];
    for(const s of list){
      if(s.kind!=='beach')continue;
      const pts=fineAlong(s,s.u0,s.u1);
      const land=(p)=>landRagged(p,BEACH_LAND,.22,11);
      fill(project(raggedBand(pts,D,()=>.25,land)),'#d6c494');
      fill(project(raggedBand(pts,D,()=>.25,p=>.62+.22*wnoise(p,5)+.06*jit(p,6))),'#b9a978');
      pts.forEach((p,i)=>{if(i%3)return;const r=h01(i*131+Math.round(p.x*7));if(r<.55)tufts.push({p:inland(p,D,land(p)+.05+r*.5),s:.6+r*.8})});
    }
    for(const s of list){
      if(s.kind!=='rocks')continue;
      const c=s.coast,a=c?s.u0-uShift(c,s.u0,ROCK_SPILL):s.u0,b=c?s.u1+uShift(c,s.u1,ROCK_SPILL):s.u1;
      const pts=fineAlong(s,a,b);
      // 0 in the spill beyond the stretch ends, 1 inside: tongues taper and break up.
      const core=p=>{if(p.u==null)return 1;if(p.u>=s.u0&&p.u<=s.u1)return 1;const out=p.u<s.u0?(s.u0-p.u)/Math.max(1e-6,s.u0-a):(p.u-s.u1)/Math.max(1e-6,b-s.u1);return Math.max(0,1-out)};
      // Rock/beach junction is faceted, not a smooth taper: in the spill zone every sample gets
      // its own jagged cut (sharp teeth of rock into the sand), on both the land and sea side.
      const teeth=(p,k)=>{const t=core(p);if(t>=1)return 1;const j=jit(p,k);return Math.max(0,Math.sqrt(t)*(.8+.45*wnoise(p,29))-.12+(j>.2?.38*j:j<-.45?-.4:.05*j))};
      const land=p=>{const w=landRagged(p,ROCK_LAND,.3,23);return w*teeth(p,41)};
      const sea=p=>ROCK_SEA*Math.max(.12,teeth(p,43));
      fill(project(raggedBand(pts,D,sea,land)),window.ConquerStoneColor?.shade('#7d786e')||'#7d786e');
      // Broken-off rock slabs lying on the sand just past each end: small angular polygons.
      for(const [u,dir] of [[s.u0,-1],[s.u1,1]]){
        if(!c)break;
        const rnd=seedRand(((Number(State.seed)||1)^Math.round(u*1000)^0x51ab)>>>0),count=4+Math.floor(rnd()*4);
        for(let k=0;k<count;k++){
          const along=(ROCK_SPILL*(.4+rnd()*.9))*dir,uu=Math.max(0,Math.min(c.length-1,u+uShift(c,u,Math.abs(along))*Math.sign(along)));
          const base=fineAlong(s,uu,uu+1e-4)[0];if(!base)continue;
          const ctr=inland(base,D,-.2+rnd()*(ROCK_LAND*.9)),rad=.18+rnd()*.38,sides=4+Math.floor(rnd()*3),rot=rnd()*6.28;
          const slab=[];for(let q=0;q<sides;q++){const ang=rot+q/sides*6.28+(rnd()-.5)*.6,rr=rad*(.6+rnd()*.6);slab.push({x:ctr.x+Math.cos(ang)*rr,y:ctr.y+Math.sin(ang)*rr})}
          fill(project(slab),window.ConquerStoneColor?.shade(rnd()<.5?'#7d786e':'#6c675e')||'#7d786e');
          if(rnd()<.5)stones.push({p:ctr,s:rnd()*.6});
        }
      }
      fill(project(raggedBand(pts,D,sea,p=>Math.min(land(p),.4+.15*wnoise(p,31)))),window.ConquerStoneColor?.shade('#4d4f49')||'#4d4f49');
      pts.forEach((p,i)=>{
        const r=h01(i*197+Math.round(p.y*7)),w=land(p);if(w<.15)return;
        if(i%4===0&&r<.45)stones.push({p:inland(p,D,w*(.7+r*.5)),s:r});
        else if(i%3===0&&r>.6)tufts.push({p:inland(p,D,w+.1+r*.4),s:.6+r*.6});
      });
    }
    // Stones and tufts only where painting projects to screen (2D scene / plan bake).
    if(typeof drawLowPolyRock==='function')for(const st of stones){
      const z=typeof terrainElevation==='function'?terrainElevation(st.p):0;
      drawLowPolyRock(st.p,z,.1+st.s*.16,.06+st.s*.1,Math.floor(st.s*0xffffffff),winter);
    }
    if(typeof cliffTufts==='function')cliffTufts(tufts.map(t=>({p:t.p,z:typeof terrainElevation==='function'?terrainElevation(t.p):0,s:t.s})),winter);
  }
  // Upright bushes on the grass just behind the beaches and the rocky stretches
  // (3D billboards, settlement-world3d.js). Deterministic; skips water, cliffs and structures.
  let bushCache={key:null,list:[]};
  function edgeBushes(){
    const d=shore();if(!d)return[];
    const key=cache.key+'|'+(State.seed||0)+'|'+(State.structures||[]).length;
    if(bushCache.key===key)return bushCache.list;
    const list=[],D=d.D,water=(State.environment||[]).filter(f=>['sea','pond','river','stream','marsh'].includes(f.type));
    const blocked=p=>p.x<1||p.y<1||p.x>199||p.y>199||(typeof terrainSlopeKind==='function'&&terrainSlopeKind(p)==='steep')||kindAt(p)||
      water.some(f=>{try{return environmentContains(f,p,.4)}catch{return false}})||
      (State.structures||[]).some(s=>Number.isFinite(s.x)?Math.hypot(s.x-p.x,s.y-p.y)<2.2:(s.a&&s.b&&pointSegmentDistance(p,s.a,s.b)<1.4));
    for(const s of d.stretches){
      const pts=fineAlong(s,s.u0,s.u1),base=s.kind==='beach'?BEACH_LAND:ROCK_LAND;
      let gap=0;
      pts.forEach((p,i)=>{
        gap+=RAGGED_STEP;const r=h01(i*389+Math.round(p.x*11)+(s.kind==='beach'?0:7777));
        if(gap<(s.kind==='beach'?3.6:2.6)+r*2)return;gap=0;
        const w=landRagged(p,base,s.kind==='beach'?.22:.3,s.kind==='beach'?11:23),q=inland(p,D,w+.5+r*1.1);
        if(blocked(q))return;
        list.push({p:q,z:typeof terrainElevation==='function'?terrainElevation(q):0,width:.8+r*.7,scale:.75+h01(i*17+3)*.35,shape:Math.floor(h01(i*29+5)*7),flip:h01(i*41)<.5});
      });
    }
    bushCache={key,list};return list;
  }
  // Rocks along the rocky stretches and a few things on the beaches, seeded by the map.
  let rockCache={key:null,meshes:[]};
  function meshes(){
    const K=window.ConquerWatersideModels,d=shore();if(!K?.models||!d)return[];
    // No boulders under the harbour works (quays, piers, shipyards).
    const harbour=(State.structures||[]).filter(q=>q.type==='quay'||q.type==='pier');
    const works=harbour.map(q=>q.type==='quay'?window.ConquerQuay?.footprint(q):window.ConquerPier?.footprint(q)).filter(Boolean);
    const quays=harbour.map(q=>q.id+':'+(q.a?q.a.x+','+q.a.y+','+q.b.x+','+q.b.y:q.x+','+q.y+','+(q.angle||0))).join(';');
    // Snow on the ground whitens the upward faces of the rocks (not the reef awash).
    const snow=typeof isSnowGround==='function'&&isSnowGround();
    const key=cache.key+'|'+(State.seed||0)+'|'+State.stonePaletteId+'|'+quays+'|'+snow;if(rockCache.key===key)return rockCache.meshes;
    const rnd=typeof seedRand==='function'?seedRand(((Number(State.seed)||1)^0x5c0a57)>>>0):Math.random;
    const pos=[],col=[],seaYaw=Math.atan2(d.D.y,d.D.x);
    const put=(name,o,yaw,sc)=>{
      const m=K.models[name];if(!m||works.some(poly=>pip(o,poly)))return;
      const z0=Math.max(-.3,typeof terrainElevation==='function'?terrainElevation(o):0),cs=Math.cos(yaw)*sc,sn=Math.sin(yaw)*sc;
      for(const part of Object.values(m.parts))for(let t=0;t<part.c.length;t++){
        const v0=pos.length;
        for(let q=0;q<3;q++){const j=part.i[t*3+q]*3,x=part.p[j],y=part.p[j+1];pos.push(o.x+x*cs-y*sn,o.y+x*sn+y*cs,z0+part.p[j+2]*sc)}
        const hex=K.palette[part.c[t]];
        const role=K.paletteKeys[part.c[t]];
        if(snow&&name!=='reef'&&role?.startsWith('rock')){
          const P=pos,ux=P[v0+3]-P[v0],uy=P[v0+4]-P[v0+1],uz=P[v0+5]-P[v0+2],vx=P[v0+6]-P[v0],vy=P[v0+7]-P[v0+1],vz=P[v0+8]-P[v0+2];
          const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
          if(Math.abs(nz)/(Math.hypot(nx,ny,nz)||1)>.45){col.push('#eef2f4');continue}
        }
        col.push(['rocksA','rocksB','rocksC','reef'].includes(name)&&role?.startsWith('rock')?(window.ConquerStoneColor?.shade(hex)||hex):hex);
      }
    };
    const at=(p,off,jit)=>({x:p.x+(p.nx??d.D.x)*off+(rnd()-.5)*jit,y:p.y+(p.ny??d.D.y)*off+(rnd()-.5)*jit});
    const ROCKS=['rocksA','rocksB','rocksC','rocksA'];
    for(const s of d.stretches){
      if(s.kind==='rocks'){
        // Rock clusters along the band every other step, a reef awash off them.
        for(let i=0;i<s.points.length;i+=2){
          const p=s.points[i];
          put(ROCKS[Math.floor(rnd()*ROCKS.length)],at(p,-ROCK_LAND*.55+rnd()*ROCK_LAND*.7,.6),rnd()*Math.PI*2,.8+rnd()*.4);
          if(i%4===0)put('reef',at(p,ROCK_SEA*.6,.5),seaYaw+(rnd()-.5)*.8,.9+rnd()*.3);
        }
      }else{
        // On the beaches, now and then a boat drawn up on the sand or driftwood.
        for(let i=3;i<s.points.length-3;i+=8){
          if(rnd()<.45)continue;
          put(rnd()<.5?'beachBoat':'driftwood',at(s.points[i],-1.2-rnd()*1.2,.5),seaYaw+(rnd()-.5)*.9,1);
        }
      }
    }    rockCache={key,meshes:col.length?[{pos,col}]:[]};
    return rockCache.meshes;
  }
  function addToBuilder(m){
    if(!window.ConquerMesh3D)return;
    for(const mesh of meshes()){
      const p=mesh.pos;
      for(let t=0;t<mesh.col.length;t++){const o=t*9;m.face([{x:p[o],y:p[o+1],z:p[o+2]},{x:p[o+3],y:p[o+4],z:p[o+5]},{x:p[o+6],y:p[o+7],z:p[o+8]}],window.ConquerMesh3D.shadedHex(mesh,t))}
    }
  }
  // Waves (graphics only, real time, both renderers, painted before the ships): foam lines
  // running up the beaches and drawing back, spray bursting on the rocks and glints out at sea.
  // The weather sets the swell (calm .6, wind 1, storm 1.6); at night only faint glints remain.
  const SWELL={clear:.6,fog:.5,rain:.8,snow:.6,wind:1,storm:1.6};
  const WAVE_PERIOD=4.2,WAVES=3;
  const h01=n=>{n=Math.imul(n^n>>>16,0x45d9f3b);n=Math.imul(n^n>>>16,0x45d9f3b);return((n^n>>>16)>>>0)/4294967296};
  let glintCache={key:null,pts:[]};
  function glints(d){
    const seas=seasOf(),key=cache.key;if(glintCache.key===key)return glintCache.pts;
    const pts=[];
    for(let i=0;i<160&&seas.length;i++){
      const p={x:h01(i*7+1)*200,y:h01(i*7+2)*200};
      if(typeof environmentContains==='function'&&seas.some(sea=>environmentContains(sea,p,-3)))pts.push({...p,ph:h01(i*7+3)});
    }
    glintCache={key,pts};return pts;
  }
  function drawWaves(now){
    const d=shore();if(!d||typeof ctx==='undefined'||typeof w2sRaw!=='function')return false;
    const W=typeof currentWeather==='function'?currentWeather().kind:'clear',swell=SWELL[W]??.6;
    const mouths=(State.environment||[]).filter(f=>f.mouth);
    const night=typeof nightFactor==='function'?nightFactor():0,day=1-night*.85;
    const zoom=Math.max(.35,Math.min(2.4,State.view?.scale||1)),D=d.D;
    const view=ctx.canvas?{w:ctx.canvas.width/(window.devicePixelRatio||1),h:ctx.canvas.height/(window.devicePixelRatio||1)}:null;
    const onScreen=q=>!view||q.x>-80&&q.y>-80&&q.x<view.w+80&&q.y<view.h+80;
    let drawn=false;
    ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
    for(const s of d.stretches){
      if(s.kind==='beach'){
        // Each wave runs from 1.4U out at sea up onto the sand and back, thinning as it goes.
        for(let w=0;w<WAVES;w++){
          const ph=((now/WAVE_PERIOD*(.8+swell*.3))+w/WAVES)%1,reach=-.9*swell;
          const off=1.4+(reach-1.4)*Math.sin(ph*Math.PI*.5+ph*Math.PI*.5)**1.2,a=Math.sin(ph*Math.PI)*.75*day;
          if(a<.04)continue;
          ctx.strokeStyle='rgba(244,246,240,'+a.toFixed(3)+')';ctx.lineWidth=Math.max(.8,(1.8-ph)*zoom*1.6);
          ctx.beginPath();let started=false,any=false;
          for(let i=0;i<s.points.length;i++){
            const p=s.points[i],wob=Math.sin(p.x*.37+p.y*.29+now*.9+w)*.25*swell;
            const q=w2sRaw({x:p.x+(p.nx??D.x)*(off+wob),y:p.y+(p.ny??D.y)*(off+wob)},0);
            if(onScreen(q))any=true;
            // Broken crests: the foam comes in patches that drift along the shore.
            const gap=Math.sin(p.x*.23+p.y*.17+w*2.1+now*.15)+Math.sin(p.x*.61-p.y*.43+w)*.5<-.35;
            if(gap||mouths.some(f=>Math.hypot(p.x-f.mouth.point.x,p.y-f.mouth.point.y)<f.width*1.6)){started=false;continue}
            if(!started){ctx.moveTo(q.x,q.y);started=true}else ctx.lineTo(q.x,q.y);
          }
          if(any){ctx.stroke();drawn=true}
        }
      }else{
        // Spray: short bursts at random points along the rocks, rising and falling.
        for(let i=0;i<s.points.length;i++){
          const p=s.points[i],seed=Math.floor(p.x*13+p.y*7),rate=.35+swell*.35;
          const t=(now*rate+h01(seed))%1;if(t>.3)continue;
          const k=t/.3,base={x:p.x+(p.nx??D.x)*ROCK_SEA*.7,y:p.y+(p.ny??D.y)*ROCK_SEA*.7},q0=w2sRaw(base,0);
          if(!onScreen(q0))continue;
          for(let j=0;j<4;j++){
            const ang=h01(seed+j*31)*Math.PI*2,r=(.15+.35*k)*(1+h01(seed+j)),z=Math.sin(k*Math.PI)*(.25+.35*swell)*(1+h01(seed+j*5)*.6);
            const q=w2sRaw({x:base.x+Math.cos(ang)*r,y:base.y+Math.sin(ang)*r},z);
            ctx.fillStyle='rgba(248,250,246,'+((1-k)*.8*day).toFixed(3)+')';
            ctx.beginPath();ctx.arc(q.x,q.y,Math.max(.8,(1.2+k*1.6)*zoom),0,Math.PI*2);ctx.fill();
          }
          drawn=true;
        }
      }
    }
    // Glints: tiny light dashes on the open sea, fading in and out (dimmer at night).
    for(const g of glints(d)){
      const a=Math.max(0,Math.sin((now*.6+g.ph*7)%(Math.PI*2)))**6*(.55*day+.15*night)*(.6+swell*.4);
      if(a<.05)continue;
      const q=w2sRaw(g,0);if(!onScreen(q))continue;
      ctx.strokeStyle='rgba(255,252,236,'+a.toFixed(3)+')';ctx.lineWidth=Math.max(.7,zoom);
      ctx.beginPath();ctx.moveTo(q.x-2.5*zoom,q.y);ctx.lineTo(q.x+2.5*zoom,q.y);ctx.stroke();
      drawn=true;
    }
    ctx.restore();
    // The sea keeps moving: keep frames coming while waves are on screen.
    if(drawn&&typeof requestSceneDraw==='function')requestSceneDraw();
    return drawn;
  }
  window.ConquerCoast=Object.freeze({HEADLAND,ROCK_LAND,ROCK_SEA,shore,stretches,kindAt,rockAt,drawGround,edgeBushes,meshes,addToBuilder,drawWaves});
})();
