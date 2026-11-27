'use strict';
// Preview-only markers for CONQUER's regional 3D map. No gameplay entities or save
// data are created here; the demo symbols are explicitly labeled.
// Each marker is drawn as its regional token when the assets are loaded:
//   village/castle/port/ship -> low-poly Blender meshes (src/assets/region-token-models.js,
//     village level 1-4 -> village1-village4), shaded at runtime from their rotated normals;
//   troops -> the game's own soldier sprites (src/assets/region-troop-sprites.js) in a
//     formation, recoloured from the default heraldry to the marker's colors.
// Without those assets (Node tests, missing files) the primitive cubes/cylinders remain.
(function(root){
  const COLOR=Object.freeze({village:'#ed922d',castle:'#959b9e',port:'#8c633b',ship:'#805333'});
  const HERALDRY_DEFAULT=Object.freeze(['#b32628','#eac15b']); // heraldry-shapes.js
  const SEA_Z=-1.8;   // regional-map3d-geometry.js elevation() of sea and lake: the waterline
  // Repository root of this script, for the troop sprite files (currentScript is only set while loading).
  const ASSET_BASE=(()=>{
    try{const src=typeof document==='object'&&document.currentScript?.src;return src?new URL('../',src).href:''}
    catch(e){return ''}
  })();
  const hex=c=>typeof c==='string'&&/^#[\da-f]{6}$/i.test(c);
  const finite=n=>typeof n==='number'&&Number.isFinite(n);
  function color(c,factor=1){
    if(!hex(c))c='#888888';
    return '#'+[1,3,5].map(i=>Math.max(0,Math.min(255,Math.round(parseInt(c.slice(i,i+2),16)*factor)))
      .toString(16).padStart(2,'0')).join('');
  }
  const point=o=>{
    if(!o)return null;
    const p=o.point||o.position||o;
    const x=Number(p.x),y=Number(p.y);
    return Number.isFinite(x)&&Number.isFinite(y)?{x,y}:null;
  };
  const centroid=poly=>{
    if(!poly?.length)return null;
    const sum=poly.reduce((a,p)=>({x:a.x+p.x,y:a.y+p.y}),{x:0,y:0});
    return {x:sum.x/poly.length,y:sum.y/poly.length};
  };
  function normalized(raw){
    if(!raw||typeof raw!=='object')return null;
    const kind=String(raw.kind||raw.type||'').toLowerCase();
    if(!['village','castle','port','ship','troops'].includes(kind))return null;
    // A palisade is not a stone castle, even if the source calls it a fortification.
    if(kind==='castle' && (raw.palisade===true||raw.isPalisade===true||
      /palisad/i.test(String(raw.material||raw.wallType||raw.fortificationType||''))))return null;
    const p=point(raw);
    if(!p)return null;
    const arms=raw.heraldry||{};
    const pair=Array.isArray(raw.colors)?raw.colors:[arms.c1,arms.c2];
    const heraldic=hex(pair[0])&&hex(pair[1]);
    if(kind==='troops' && !heraldic)return null;
    const route=(Array.isArray(raw.route)?raw.route:[]).map(point).filter(Boolean);
    // Village level only from the source (no source field today: real villages are L1).
    const level=Math.round(Number(raw.level??raw.tier));
    return {
      kind,x:p.x,y:p.y,
      // zAuto: no source height, the map may place it on its terrain (paint option groundZ).
      z:finite(raw.z)?raw.z:kind==='ship'||kind==='port'?SEA_Z:2,zAuto:!finite(raw.z),
      id:String(raw.id??''),ownerId:raw.ownerId||null,
      // Owner colours only when supplied (troops require them; castle flag and sail use them).
      colors:heraldic?[pair[0],pair[1]]:null,
      level:kind==='village'?(level>=1&&level<=4?level:1):null,
      heading:finite(raw.heading)?raw.heading:0,
      route,progress:finite(raw.progress)?Math.max(0,Math.min(1,raw.progress)):null,
      periodMs:finite(raw.periodMs)&&raw.periodMs>500?raw.periodMs:14000,
      demo:!!raw.demo
    };
  }
  function normalize(raw){
    const list=Array.isArray(raw)?raw:Array.isArray(raw?.markers)?raw.markers:[];
    return list.map(normalized).filter(Boolean);
  }
  function demo(snapshot,scene){
    const cells=snapshot?.cells||[],terrain=snapshot?.terrain||{};
    const land=cells.filter(c=>!['sea','lake'].includes(terrain[c.macroId]));
    const sea=cells.filter(c=>terrain[c.macroId]==='sea'||terrain[c.macroId]==='lake');
    const rank=items=>items.slice().sort((a,b)=>{
      const x=centroid(a.polygon),y=centroid(b.polygon);
      const dx=x.x-snapshot.width*.5,dy=x.y-snapshot.height*.5;
      const ex=y.x-snapshot.width*.5,ey=y.y-snapshot.height*.5;
      return dx*dx+dy*dy-ex*ex-ey*ey;
    });
    const near=rank(land),wet=rank(sea);
    const markers=[];
    const at=i=>near.length?centroid(near[Math.min(i,near.length-1)].polygon):null;
    // One example village per level L1-L4 (examples only: real villages carry no level yet).
    const villageSlots=[0,2,6,12];
    villageSlots.forEach((slot,k)=>{
      const p=at(slot);
      if(p&&!markers.some(m=>m.x===p.x&&m.y===p.y))
        markers.push({kind:'village',id:'example-village-'+(k+1),...p,level:k+1,demo:true});
    });
    const l1=at(4),l2=at(9);
    if(l1)markers.push({kind:'castle',id:'example-castle',...l1,colors:[...HERALDRY_DEFAULT],demo:true,ownerId:'PLAYER_001'});
    if(l2)markers.push({kind:'troops',id:'example-troops',...l2,colors:[...HERALDRY_DEFAULT],demo:true,ownerId:'PLAYER_001'});
    const shoreline=(scene?.coastlines||[]).find(e=>e.macroIds?.length===2&&e.macroIds.some(id=>!['sea','lake'].includes(terrain[id])));
    if(shoreline){
      const mid={x:(shoreline.start.x+shoreline.end.x)/2,y:(shoreline.start.y+shoreline.end.y)/2};
      // The jetty runs from the shore out to sea: perpendicular to the coast, toward the water side.
      const along=Math.atan2(shoreline.end.y-shoreline.start.y,shoreline.end.x-shoreline.start.x);
      const seaId=shoreline.macroIds.find(id=>['sea','lake'].includes(terrain[id]));
      const water=centroid(cells.find(c=>c.macroId===seaId)?.polygon);
      let heading=along+Math.PI/2;
      if(water&&Math.cos(heading)*(water.x-mid.x)+Math.sin(heading)*(water.y-mid.y)<0)heading+=Math.PI;
      markers.push({kind:'port',id:'example-port',...mid,heading,demo:true});
    } else if(wet[0]){
      const p=centroid(wet[0].polygon);
      if(p)markers.push({kind:'port',id:'example-port',...p,demo:true});
    }
    if(wet.length){
      // The example route must stay on water: every sample of the segment inside a sea/lake cell.
      const inside=(p,poly)=>{let s=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){
        const u=poly[i],v=poly[j];if((u.y>p.y)!==(v.y>p.y)&&p.x<(v.x-u.x)*(p.y-u.y)/(v.y-u.y)+u.x)s=!s}return s};
      const wetAt=p=>sea.some(c=>inside(p,c.polygon||[]));
      const afloat=(a,b)=>{for(let k=0;k<=16;k++){const t=k/16;if(!wetAt({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t}))return false}return true};
      const a=centroid(wet[0].polygon);
      const b=wet.slice(1).map(c=>centroid(c.polygon))
        .filter(p=>p&&Math.hypot(a.x-p.x,a.y-p.y)>1&&afloat(a,p))
        .sort((p,q)=>Math.hypot(q.x-a.x,q.y-a.y)-Math.hypot(p.x-a.x,p.y-a.y))
        .find(p=>Math.hypot(p.x-a.x,p.y-a.y)<snapshot.width*.15)
        ||{x:a.x+Math.min(35,snapshot.width*.03),y:a.y};
      markers.push({kind:'ship',id:'example-ship',...a,route:[a,b],periodMs:14000,colors:[...HERALDRY_DEFAULT],demo:true,ownerId:'PLAYER_001'});
    }
    return normalize(markers);
  }
  function positionAt(marker,ms){
    let p=marker.progress;
    if(marker.kind!=='ship'||!marker.route.length)
      return {x:marker.x,y:marker.y,heading:marker.heading};
    if(marker.demo){
      const elapsed=((ms%marker.periodMs)+marker.periodMs)%marker.periodMs;
      const phase=elapsed/marker.periodMs*2;
      p=phase<=1?phase:2-phase;
    }
    if(p===null)return {x:marker.x,y:marker.y,heading:marker.heading};
    const route=marker.route,segments=[],lengths=[];let total=0;
    for(let i=1;i<route.length;i++){
      const length=Math.hypot(route[i].x-route[i-1].x,route[i].y-route[i-1].y);
      segments.push([route[i-1],route[i]]);lengths.push(length);total+=length;
    }
    if(total<=0)return {x:marker.x,y:marker.y,heading:marker.heading};
    let remaining=p*total;
    for(let i=0;i<segments.length;i++){
      const [a,b]=segments[i],length=lengths[i];
      if(remaining<=length||i===segments.length-1){
        const f=length>0?Math.max(0,Math.min(1,remaining/length)):0;
        const heading=Math.atan2(b.y-a.y,b.x-a.x)+(marker.demo&&(ms%marker.periodMs)/marker.periodMs>.5?Math.PI:0);
        return {x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f,heading};
      }
      remaining-=length;
    }
    return {x:marker.x,y:marker.y,heading:marker.heading};
  }
  const polygon=(ctx,ps,fill,stroke)=>{
    if(!ps.length)return;
    ctx.beginPath();ctx.moveTo(ps[0].x,ps[0].y);
    for(let i=1;i<ps.length;i++)ctx.lineTo(ps[i].x,ps[i].y);
    ctx.closePath();ctx.fillStyle=fill;ctx.fill();
    if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=.8;ctx.stroke();}
  };
  function box(ctx,project,m,halfX,halfY,height,paint,angle=0){
    const local=[[-halfX,-halfY],[halfX,-halfY],[halfX,halfY],[-halfX,halfY]];
    const cos=Math.cos(angle),sin=Math.sin(angle);
    const vertex=(v,z)=>project({x:m.x+v[0]*cos-v[1]*sin,
      y:m.y+v[0]*sin+v[1]*cos,z});
    const z=m.z??2;
    const points=local.map(v=>vertex(v,z)).concat(local.map(v=>vertex(v,z+height)));
    const faces=[
      {ids:[0,1,5,4],factor:.77},{ids:[1,2,6,5],factor:.90},
      {ids:[2,3,7,6],factor:.69},{ids:[3,0,4,7],factor:.85},
      {ids:[4,5,6,7],factor:1.15}
    ].map(f=>({...f,depth:f.ids.reduce((a,i)=>a+points[i].depth,0)/f.ids.length}));
    faces.sort((a,b)=>a.depth-b.depth);
    for(const f of faces)polygon(ctx,f.ids.map(i=>points[i]),color(paint,f.factor),'rgba(24,22,17,.35)');
  }
  function cylinder(ctx,project,m,r,height,paint){
    const n=12,base=[],top=[];
    for(let i=0;i<n;i++){
      const theta=i*Math.PI*2/n;
      const x=m.x+Math.cos(theta)*r,y=m.y+Math.sin(theta)*r;
      base.push(project({x,y,z:m.z}));
      top.push(project({x,y,z:m.z+height}));
    }
    const faces=[];
    for(let i=0;i<n;i++){
      const j=(i+1)%n,ids=[base[i],base[j],top[j],top[i]];
      faces.push({ps:ids,depth:ids.reduce((a,p)=>a+p.depth,0)/4,
        fill:color(paint,.75+.22*Math.cos(i*Math.PI*2/n))});
    }
    faces.sort((a,b)=>a.depth-b.depth);
    for(const f of faces)polygon(ctx,f.ps,f.fill,null);
    polygon(ctx,top,color(paint,1.12),'rgba(15,15,15,.35)');
  }
  // ---- regional tokens (Blender meshes) ----
  const ISO_Z=.9;   // lab/3dregionmap.js: depth = qx + qy + z * ISO_Z (larger = nearer the viewer)
  const tokenFor=(models,m)=>{
    const map=models?.markers,key=m.kind==='village'?map?.village?.[(m.level||1)-1]:map?.[m.kind];
    const model=key&&models.models?.[key];
    return model?.p&&model?.i&&model?.c?model:null;
  };
  // Stable per-marker yaw for buildings (they have no heading): same village, same layout.
  const yawOf=m=>{
    if(m.kind==='port'||m.kind==='ship')return m.heading||0;
    let h=2166136261;for(const ch of String(m.id||m.x+','+m.y)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}
    return ((h>>>0)%360)*Math.PI/180;
  };
  // Without the owner's heraldry the flag and sail stay unbleached canvas (build_ships.py 'sail'):
  // never the default heraldry red, which is the player's own colour.
  const NEUTRAL_TEAM='#ece2c8';
  function tokenPaint(models,key,colors){
    const base=key.replace(/Dark$/,'');
    if(base==='team')return colors?colors[0]:NEUTRAL_TEAM;
    const i=models.paletteKeys.indexOf(base);
    return models.palette[i>=0?i:models.paletteKeys.indexOf(key)];
  }
  // Light from the viewer's upper left, fixed on screen: shading follows the user's yaw and the
  // marker heading instead of the baked *Dark faces (which assume one orientation).
  const LIGHT=(()=>{const v=[-.45,.95,1.35],l=Math.hypot(...v);return v.map(x=>x/l)})();
  function drawToken(ctx,project,camera,m,model,models,radius){
    const yaw=yawOf(m),cy=Math.cos(yaw),sy=Math.sin(yaw);
    const cos=camera.cos??1,sin=camera.sin??0;
    const p=model.p,idx=model.i,world=new Array(p.length/3);
    for(let k=0;k<world.length;k++){
      const x=p[k*3]*radius,y=p[k*3+1]*radius,z=p[k*3+2]*radius;
      world[k]={x:m.x+x*cy-y*sy,y:m.y+x*sy+y*cy,z:m.z+z};
    }
    const screen=world.map(v=>project(v));
    const tris=[];
    for(let t=0;t<model.c.length;t++){
      const a=world[idx[t*3]],b=world[idx[t*3+1]],c=world[idx[t*3+2]];
      const ux=b.x-a.x,uy=b.y-a.y,uz=b.z-a.z,vx=c.x-a.x,vy=c.y-a.y,vz=c.z-a.z;
      let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
      const nl=Math.hypot(nx,ny,nz)||1;nx/=nl;ny/=nl;nz/=nl;
      // camera frame (same rotation as project()); face the normal toward the viewer
      let qx=nx*cos-ny*sin,qy=nx*sin+ny*cos,qz=nz;
      if(qx+qy+qz*ISO_Z<0){qx=-qx;qy=-qy;qz=-qz}
      const lambert=Math.max(0,qx*LIGHT[0]+qy*LIGHT[1]+qz*LIGHT[2]);
      const ids=[idx[t*3],idx[t*3+1],idx[t*3+2]];
      tris.push({ps:ids.map(i=>screen[i]),depth:(screen[ids[0]].depth+screen[ids[1]].depth+screen[ids[2]].depth)/3,
        fill:color(tokenPaint(models,models.paletteKeys[model.c[t]],m.colors),.66+.4*lambert)});
    }
    tris.sort((a,b)=>a.depth-b.depth);
    for(const t of tris)polygon(ctx,t.ps,t.fill,null);
  }
  // ---- troops: the game's soldier sprites ----
  const sprites={images:{},ready:false,loading:false,tinted:new Map()};
  function troopSprites(set,onLoad){
    if(!set?.sprites||typeof Image!=='function')return null;
    if(!sprites.loading){
      sprites.loading=true;
      const kinds=Object.keys(set.sprites);let left=kinds.length;
      for(const kind of kinds){
        const img=new Image();
        img.onload=()=>{if(--left===0){sprites.ready=true;onLoad?.()}};
        img.onerror=()=>console.warn('Regional troop sprite missing:',set.sprites[kind].file);
        img.src=ASSET_BASE+set.sprites[kind].file;
        sprites.images[kind]=img;
      }
    }
    return sprites.ready?sprites.images:null;
  }
  const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
  // Sprite in the marker's colours: pixels on the black->c1 / black->c2 lines (flat fills, dark
  // outline blends) or on the c1<->c2 seam move to the new pair; everything else is untouched.
  function tinted(kind,img,from,to){
    const key=kind+'|'+to.join('|');
    if(sprites.tinted.has(key))return sprites.tinted.get(key);
    let out=img;
    if(to.join()!==from.join()&&typeof document==='object'){
      const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;
      const g=c.getContext('2d');g.drawImage(img,0,0);
      const data=g.getImageData(0,0,c.width,c.height),d=data.data;
      const A=rgb(from[0]),B=rgb(from[1]),A2=rgb(to[0]),B2=rgb(to[1]);
      const fit=(px,o,dir)=>{ // projection of px-o on dir: [t, residual]
        const dl=dir[0]*dir[0]+dir[1]*dir[1]+dir[2]*dir[2]||1;
        const t=((px[0]-o[0])*dir[0]+(px[1]-o[1])*dir[1]+(px[2]-o[2])*dir[2])/dl;
        return [t,Math.hypot(px[0]-o[0]-t*dir[0],px[1]-o[1]-t*dir[1],px[2]-o[2]-t*dir[2])];
      };
      const AB=[B[0]-A[0],B[1]-A[1],B[2]-A[2]];
      for(let i=0;i<d.length;i+=4){
        if(d[i+3]<8)continue;
        const px=[d[i],d[i+1],d[i+2]];
        const [ta,ra]=fit(px,[0,0,0],A),[tb,rb]=fit(px,[0,0,0],B),[ts,rs]=fit(px,A,AB);
        let n=null;
        // t >= .75: flat livery fills and their light outline blends only; darker browns on the
        // same line (spear shafts, bows: about half the gold) keep their own colour.
        if(ra<24&&ta>.75&&ta<1.15&&ra<=rb)n=A2.map(v=>v*ta);
        else if(rb<24&&tb>.75&&tb<1.15)n=B2.map(v=>v*tb);
        else if(rs<14&&ts>0&&ts<1)n=A2.map((v,j)=>v+(B2[j]-v)*ts);
        if(n){d[i]=Math.min(255,n[0]);d[i+1]=Math.min(255,n[1]);d[i+2]=Math.min(255,n[2])}
      }
      g.putImageData(data,0,0);out=c;
    }
    sprites.tinted.set(key,out);
    return out;
  }
  function drawTroops(ctx,project,camera,m,set,images,radius){
    const scale=Math.max(.001,camera.scale);
    const figures=set.formation.map(f=>{
      const s=set.sprites[f.kind],img=images[f.kind];
      const feet=project({x:m.x+f.x*radius,y:m.y+f.y*radius,z:m.z});
      return {s,img,kind:f.kind,feet};
    }).filter(f=>f.s&&f.img).sort((a,b)=>a.feet.depth-b.feet.depth);
    for(const f of figures){
      const px=radius*ISO_Z*scale/set.pxPerToken;   // screen px per sprite px
      const w=f.s.w*px,h=f.s.h*px;
      ctx.drawImage(tinted(f.kind,f.img,set.heraldry||HERALDRY_DEFAULT,m.colors),
        f.feet.x-f.s.feetX*px,f.feet.y-f.s.feetY*px,w,h);
    }
  }
  // opts: tokens (ConquerRegionTokenModels), troops (ConquerRegionTroopSprites) — default to the
  // page globals; tokenRadius (world units, ~a third of a territory); minPx (smallest on-screen
  // token radius); groundZ(x,y) for markers without a source height; onAssetsReady (sprites loaded).
  function paint(ctx,markers,project,camera,ms,opts={}){
    if(!ctx||!camera||!markers?.length)return;
    const scale=Math.max(.001,camera.scale);
    const models=opts.tokens!==undefined?opts.tokens:root.ConquerRegionTokenModels;
    const troopSet=opts.troops!==undefined?opts.troops:root.ConquerRegionTroopSprites;
    const images=troopSet&&typeof ctx.drawImage==='function'?troopSprites(troopSet,opts.onAssetsReady):null;
    const radius=Math.max(opts.tokenRadius||12,(opts.minPx||9)/scale);
    const drawn=[];
    for(const original of markers){
      const moved=positionAt(original,ms);
      const marker={...original,...moved};
      if(marker.zAuto&&typeof opts.groundZ==='function'&&marker.kind!=='ship'&&marker.kind!=='port'){
        const z=opts.groundZ(marker.x,marker.y);if(finite(z))marker.z=z;
      }
      const projected=project({x:marker.x,y:marker.y,z:marker.z+6/scale});
      const margin=45+radius*scale*2;
      if(projected.x<-margin||projected.y<-margin||
         projected.x>camera.width+margin||projected.y>camera.height+margin)continue;
      drawn.push({marker,depth:projected.depth});
    }
    drawn.sort((a,b)=>a.depth-b.depth);
    for(const {marker:m}of drawn){
      const model=m.kind!=='troops'&&tokenFor(models,m);
      if(model){drawToken(ctx,project,camera,m,model,models,radius);continue}
      if(m.kind==='troops'&&images&&troopSet.formation?.length){drawTroops(ctx,project,camera,m,troopSet,images,radius);continue}
      const r=5/scale;
      if(m.kind==='village')box(ctx,project,m,r,r,r*1.8,COLOR.village);
      else if(m.kind==='castle')box(ctx,project,m,r*1.1,r*1.1,r*2,COLOR.castle);
      else if(m.kind==='port')box(ctx,project,m,r*2.3,r*.42,r*.32,COLOR.port,m.heading);
      else if(m.kind==='ship')box(ctx,project,m,r*2.1,r*.7,r*.42,COLOR.ship,m.heading);
      else if(m.kind==='troops'){
        cylinder(ctx,project,{...m,z:m.z},r*.92,r*1.6,m.colors[0]);
        cylinder(ctx,project,{...m,z:m.z+r*1.6},r*.92,r*1.6,m.colors[1]);
      }
    }
  }
  const counts=markers=>Object.fromEntries(['village','castle','port','ship','troops']
    .map(kind=>[kind,(markers||[]).filter(m=>m.kind===kind).length]));
  const api=Object.freeze({normalize,demo,positionAt,paint,counts,HERALDRY_DEFAULT});
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.ConquerRegionalPlaceholders=api;
})(typeof window==='object'?window:{});
