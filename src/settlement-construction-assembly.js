'use strict';
// CONQUER construction assembly: a building under construction is drawn piece by piece
// instead of as a translucent ghost. The finished building's own triangles (castle
// volumes from ConquerCastle3D, civic models from ConquerCivic3D, urban houses from
// urbanHouseGeometry) are cut by a single "site level" h that climbs with
// constructionProgress:
//   masonry   everything below the last whole course; the course being laid is split
//             into blocks that appear one by one, so the top edge is ragged
//   frame     timber posts and plates run a little ahead of the infill (L2+ houses)
//   roof      lags behind the walls: battens first, then tiles course by course from
//             the eaves to the ridge
// At progress 1 the site is simply the finished building again. Visual only: the level
// is a pure function of progress. Drawn on the dynamic Canvas layer like the sites
// themselves (both renderers). Classic script.
(function(){
  const SPAN=[.12,.9];            // the work: after site preparation, before the finishing (props)
  const COURSE=.12,CELL=.24;      // masonry course height and block size (U)
  const BEAM_LEAD=.3;             // timber frame ahead of the infill
  const RAFTER_LAG=0,BATTEN_LAG=.2,TILE_LAG=.5,BATTEN_STEP=.1,BATTEN_W=.03,RAFTER_STEP=.32,RAFTER_W=.045;
  const BATTEN='#8a6a45',BEAM='#4a3424';
  const STEPS=48;                 // levels per site: the mesh is rebuilt only between them
  // Tags that make the wall height (gables and roofs sit above it).
  const WALL=new Set(['body','crown','beam']);
  const fn=name=>typeof globalThis[name]==='function'?globalThis[name]:null;
  const call=(name,...a)=>{const f=fn(name);try{return f?f(...a):undefined}catch{return undefined}};
  const clamp01=v=>Math.max(0,Math.min(1,v));
  const toHex=(r,g,b)=>'#'+[r,g,b].map(c=>Math.max(0,Math.min(255,Math.round(c*255))).toString(16).padStart(2,'0')).join('');
  function hash(a,b,c,d){let h=2166136261;for(const v of [a,b,c,d]){h^=v|0;h=Math.imul(h,16777619);h^=h>>>13}return(h>>>0)/4294967296}

  // ---------- sources: the finished building as tagged world triangles
  // {pos (9 per tri), col (hex per tri), tag (per tri), flat, ground}
  function groundOf(s){
    const g=call('placementGroundZ',s);if(Number.isFinite(g))return g;
    if(Number.isFinite(s.groundZ))return Number(s.groundZ);
    const t=call('terrainElevation',call('structureCenter',s)||s);return Number.isFinite(t)?t:0;
  }
  function castleSource(s){
    const C=window.ConquerCastle3D;
    if(!C?.structureWorld||!['tower','gate','wall','built'].includes(s.type)||call('isWoodTower',s)||call('isWoodGate',s))return null;
    const {tris,tags}=C.structureWorld(s),pos=[],col=[];
    for(let t=0;t<tags.length;t++){
      const o=t*18;
      for(let k=0;k<3;k++)pos.push(tris[o+k*6],tris[o+k*6+1],tris[o+k*6+2]);
      col.push(toHex(tris[o+3],tris[o+4],tris[o+5]));
    }
    return{pos,col,tag:tags.slice(),flat:true,ground:groundOf(s)};
  }
  function civicSource(s){
    const C=window.ConquerCivic3D,D=window.ConquerCivicModels;
    if(!C?.has?.(s)||s.type==='civicAnnex')return null;
    const key=C.modelKey(s),ground=groundOf(s),mesh=C.triangles(key,s,ground),names=C.parts(key).map(p=>p.name);
    // Palette key of each colour: roofs are tagged by material, ground parts by name.
    const keyOf=new Map(D.palette.map((hex,i)=>[hex,D.paletteKeys[i]]));
    const tag=mesh.col.map((hex,t)=>names[mesh.gi[t]].startsWith('ground')?'ground'
      :/^roof/.test(keyOf.get(hex)||'roof')?'roof':'body');
    return{pos:mesh.pos,col:mesh.col,tag,flat:false,ground};
  }
  // Urban house, as settlement-world3d.js builds it: stone ground floor, timber-framed
  // plastered upper floor (L2+), thatch (L1) or slate roof, gables, chimneys.
  function houseSource(s){
    if(s.type!=='house'||!fn('urbanHouseGeometry')||!fn('urbanHouseFaces'))return null;
    const entry=urbanHouseGeometry().find(e=>e.house===s||e.house.id===s.id);if(!entry)return null;
    const pos=[],col=[],tag=[],lvl=call('houseLevel',s)||1;
    const face=(pts,c,t)=>{for(let i=1;i<pts.length-1;i++){for(const p of [pts[0],pts[i],pts[i+1]])pos.push(p.x,p.y,p.z);col.push(c);tag.push(t)}};
    const beam=(a,b,t)=>{   // thin box between two points, standing proud of the facade
      const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z,L=Math.hypot(dx,dy,dz)||1,w=.025;
      let ux=-dy,uy=dx;const ul=Math.hypot(ux,uy);if(ul<1e-6){ux=1;uy=0}else{ux/=ul;uy/=ul}
      const vz=Math.abs(dz)/L>.9?{x:-uy,y:ux,z:0}:{x:0,y:0,z:1};
      const c=(p,su,sv)=>({x:p.x+ux*su*w+vz.x*sv*w,y:p.y+uy*su*w+vz.y*sv*w,z:p.z+vz.z*sv*w});
      const r=[[-1,-1],[1,-1],[1,1],[-1,1]],A=r.map(([u,v])=>c(a,u,v)),B=r.map(([u,v])=>c(b,u,v));
      for(let i=0;i<4;i++)face([A[i],A[(i+1)%4],B[(i+1)%4],B[i]],BEAM,t);
    };
    const winter=typeof State!=='undefined'&&State.season==='winter';
    for(const part of entry.parts){
      if(part.kind==='outbuilding')continue;
      const faces=urbanHouseFaces(s,part),n=part.points.length,base=call('terrainElevation',part.center)||0;
      const split=part.kind==='turret'?base+1.02:base+part.bodyH*.5;
      for(let i=0;i<n;i++){
        const [a,b,c,d]=faces[i].map(({p,z})=>({x:p.x,y:p.y,z}));
        if(lvl===1&&part.kind!=='turret'){face([a,b,c,d],i%2?'#4e392d':'#654936','body');continue}
        const sa={...a,z:split},sb={...b,z:split};
        face([a,b,sb,sa],i%2?'#4f4b47':'#625e59','body');
        face([sa,sb,c,d],i%2?'#c8ae70':'#e0ca91','body');
        // Timber frame of the upper floor: corner posts, a middle post, sill and wall plate.
        const mid=(p,q)=>({x:(p.x+q.x)/2,y:(p.y+q.y)/2,z:(p.z+q.z)/2});
        beam(sa,d,'beam');beam(sb,c,'beam');beam(mid(sa,sb),mid(d,c),'beam');beam(sa,sb,'beam');beam(d,c,'beam');
      }
      const roof=f=>f.map(({p,z})=>({x:p.x,y:p.y,z}));
      if(part.kind==='turret'){
        for(let i=n;i<faces.length;i++)face(roof(faces[i]),winter?'#e7ece8':(i%2?'#303943':'#394550'),'roof');
      }else{
        const rA=winter?'#e7ece8':lvl===1?'#a88a52':'#303237',rB=winter?'#dce3de':lvl===1?'#94784a':'#3a3d42',gable=lvl===1?'#654936':'#d9c184';
        face(roof(faces[n]),rA,'roof');face(roof(faces[n+1]),rB,'roof');face(roof(faces[n+2]),gable,'gable');face(roof(faces[n+3]),gable,'gable');
      }
    }
    for(const c of call('chimneySpecs',s)||[]){
      const g=call('terrainElevation',c.center)||0,pts=call('rectWorldPoints',c.center.x,c.center.y,.22,.20,c.angle||0);if(!pts)continue;
      for(let i=0;i<4;i++){const a=pts[i],b=pts[(i+1)%4];face([{...a,z:g+c.z0},{...b,z:g+c.z0},{...b,z:g+c.z1},{...a,z:g+c.z1}],'#3b302c','roof')}
    }
    return{pos,col,tag,flat:true,ground:call('terrainElevation',call('structureCenter',s))||0};
  }
  // The geometry of the finished building: some builders leave out details (battlements)
  // while a structure is under construction, so its site record is set aside meanwhile.
  function source(s){
    if(!s||s.type==='ruin')return null;
    const site=s.construction;
    if(site)delete s.construction;
    try{return castleSource(s)||civicSource(s)||houseSource(s)}
    finally{if(site)s.construction=site}
  }
  // Stone castle parts, civic buildings with a model, and urban houses (village-grown, auto).
  function has(s){
    if(!s)return false;
    if(s.type==='house')return true;
    if(s.auto)return false;
    if(['tower','gate','wall','built'].includes(s.type))return !call('isWoodTower',s)&&!call('isWoodGate',s);
    return !!window.ConquerCivic3D?.has?.(s)&&s.type!=='civicAnnex';
  }
  const seedOf=s=>{let h=0;for(const ch of String(s.id))h=Math.imul(h^ch.charCodeAt(0),16777619);return h|0};

  // ---------- clipping
  // Sutherland–Hodgman against an axis plane: keep coord(axis) <= v (below) or >= v.
  function clip(poly,axis,v,below){
    const out=[],inside=p=>below?p[axis]<=v+1e-9:p[axis]>=v-1e-9;
    for(let i=0;i<poly.length;i++){
      const a=poly[i],b=poly[(i+1)%poly.length],ia=inside(a),ib=inside(b);
      if(ia)out.push(a);
      if(ia!==ib){const t=(v-a[axis])/(b[axis]-a[axis]);out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t])}
    }
    return out;
  }
  const band=(poly,z0,z1)=>clip(clip(poly,2,z0,false),2,z1,true);
  // Same against any linear function f(p) = fx*x + fy*y (rafters run down the slope).
  function clipF(poly,fx,fy,v,below){
    const out=[],f=p=>p[0]*fx+p[1]*fy,inside=p=>below?f(p)<=v+1e-9:f(p)>=v-1e-9;
    for(let i=0;i<poly.length;i++){
      const a=poly[i],b=poly[(i+1)%poly.length],ia=inside(a),ib=inside(b);
      if(ia)out.push(a);
      if(ia!==ib){const t=(v-f(a))/(f(b)-f(a));out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t])}
    }
    return out;
  }
  // Rafters: strips of the roof plane along its slope, every RAFTER_STEP across it.
  function rafters(out,poly,zBottom,zTop){
    const [a,b,c]=poly,ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];
    const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,L=Math.hypot(nx,ny);if(L<1e-6)return;   // flat: no slope
    const tx=-ny/L,ty=nx/L,cut=band(poly,zBottom,zTop);if(cut.length<3)return;
    const us=cut.map(p=>p[0]*tx+p[1]*ty);
    for(let u=Math.ceil(Math.min(...us)/RAFTER_STEP)*RAFTER_STEP;u<Math.max(...us);u+=RAFTER_STEP)
      emit(out,clipF(clipF(cut,tx,ty,u,false),tx,ty,u+RAFTER_W,true),BEAM);
  }
  function emit(out,poly,c){
    if(poly.length<3)return;
    for(let i=1;i<poly.length-1;i++){for(const p of [poly[0],poly[i],poly[i+1]])out.pos.push(p[0],p[1],p[2]);out.col.push(c)}
  }
  // Masonry-like reveal: whole courses below the course being laid, then the blocks of
  // that course (a CELL grid in plan) whose turn has come.
  function reveal(out,poly,c,level,seed){
    const zs=poly.map(p=>p[2]),zmin=Math.min(...zs),zmax=Math.max(...zs);
    const k=Math.floor(level/COURSE),base=k*COURSE,frac=level/COURSE-k;
    if(zmax<=base+1e-9){emit(out,poly,c);return}
    if(zmin<base)emit(out,clip(poly,2,base,true),c);
    if(frac<=0||zmin>=base+COURSE)return;
    const course=band(poly,base,base+COURSE);if(course.length<3)return;
    const xs=course.map(p=>p[0]),ys=course.map(p=>p[1]);
    // Alternate courses are offset by half a block, like bonded masonry.
    const off=(k%2)*CELL/2;
    for(let ix=Math.floor((Math.min(...xs)-off)/CELL);ix*CELL+off<Math.max(...xs);ix++){
      const sx=clip(clip(course,0,ix*CELL+off,false),0,(ix+1)*CELL+off,true);if(sx.length<3)continue;
      const sy=sx.map(p=>p[1]);
      for(let iy=Math.floor((Math.min(...sy)-off)/CELL);iy*CELL+off<Math.max(...sy);iy++){
        if(hash(ix,iy,k,seed)>=frac)continue;
        emit(out,clip(clip(sx,1,iy*CELL+off,false),1,(iy+1)*CELL+off,true),c);
      }
    }
  }

  // ---------- the site at a level
  function bounds(src){
    let top=-Infinity,wall=-Infinity;
    for(let t=0;t<src.tag.length;t++)for(let k=0;k<3;k++){
      const z=src.pos[t*9+k*3+2];top=Math.max(top,z);if(WALL.has(src.tag[t]))wall=Math.max(wall,z);
    }
    return{top:top-src.ground,wall:wall-src.ground};
  }
  // Site level above the ground at progress p: 0 before the work, past the roof at the end.
  function levelAt(src,p){
    const b=bounds(src);
    return clamp01((p-SPAN[0])/(SPAN[1]-SPAN[0]))*(b.top+TILE_LAG);
  }
  function assemble(src,level,seed){
    const out={pos:[],col:[],flat:src.flat},g=src.ground;
    for(let t=0;t<src.tag.length;t++){
      const tag=src.tag[t],c=src.col[t];
      const poly=[0,1,2].map(k=>[src.pos[t*9+k*3],src.pos[t*9+k*3+1],src.pos[t*9+k*3+2]-g]);
      const lift=p=>p.map(q=>[q[0],q[1],q[2]+g]);
      const sub={pos:[],col:[]};
      if(tag==='ground')emit(sub,poly,c);
      else if(tag==='beam')emit(sub,clip(poly,2,level+BEAM_LEAD,true),c);
      else if(tag==='roof'){
        // Rafters down the slope, battens across it, then the tiles course by course.
        const lr=level-RAFTER_LAG,lb=level-BATTEN_LAG,lt=level-TILE_LAG;
        // Timber only where the tiles are not laid yet (it would share their plane).
        const bare=Math.max(0,lt);
        if(lr>bare)rafters(sub,poly,bare,lr);
        if(lb>bare){
          const zs=poly.map(q=>q[2]),z0=Math.max(bare,Math.min(...zs));
          for(let z=Math.ceil(z0/BATTEN_STEP)*BATTEN_STEP;z<Math.min(lb,Math.max(...zs));z+=BATTEN_STEP)
            emit(sub,band(poly,z,z+BATTEN_W),BATTEN);
        }
        if(lt>0)reveal(sub,poly,c,lt,seed+1);
      }else reveal(sub,poly,c,level,seed);
      for(let i=0;i<sub.col.length;i++){
        for(let k=0;k<3;k++)out.pos.push(sub.pos[i*9+k*3],sub.pos[i*9+k*3+1],sub.pos[i*9+k*3+2]+g);
        out.col.push(sub.col[i]);
      }
    }
    return out;
  }

  // ---------- cache and drawing
  const cache=new Map();
  function geomKey(s){
    return[s.type,s.x,s.y,s.angle,s.a?.x,s.a?.y,s.b?.x,s.b?.y,s.size,s.r,s.w,s.h,s.level,s.civicLevel,s.houseLevel,s.roofStyle,s.baseStyle,
      s.masonryMaterial,s.groundZ,State.season,State.view?.rotation||0].join('|');
  }
  function entry(s){
    const key=geomKey(s);let e=cache.get(s.id);
    if(!e||e.key!==key){const src=source(s);e={key,src,meshes:new Map()};cache.set(s.id,e)}
    return e;
  }
  // Wall top (U above the ground) of the finished building along a plan segment a-b: a
  // church nave is lower than its bell tower, so each scaffold run stops at its own wall.
  function heightNear(s,a,b,d=.35){
    const src=entry(s).src;if(!src)return null;
    const dx=b.x-a.x,dy=b.y-a.y,L2=dx*dx+dy*dy||1;let h=-Infinity;
    for(let t=0;t<src.tag.length;t++){
      if(!WALL.has(src.tag[t]))continue;
      for(let k=0;k<3;k++){
        const o=t*9+k*3,x=src.pos[o],y=src.pos[o+1],u=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/L2));
        if(Math.hypot(x-a.x-dx*u,y-a.y-dy*u)<d)h=Math.max(h,src.pos[o+2]-src.ground);
      }
    }
    return Number.isFinite(h)?h:null;
  }
  // Plan centre of the highest walls (the bell tower of a church): the crane works there.
  function crownCenter(s){
    const src=entry(s).src;if(!src)return null;
    const top=bounds(src).wall;let x=0,y=0,n=0;
    for(let t=0;t<src.tag.length;t++){
      if(!WALL.has(src.tag[t]))continue;
      for(let k=0;k<3;k++){const o=t*9+k*3;if(src.pos[o+2]-src.ground>=top-.15){x+=src.pos[o];y+=src.pos[o+1];n++}}
    }
    return n?{x:x/n,y:y/n}:null;
  }
  // Built height above the ground (U) of the walls at progress p: scaffold and crane follow it.
  function builtHeight(s,p=call('constructionProgress',s)??1){
    const e=entry(s);if(!e.src)return null;
    return Math.min(bounds(e.src).wall,levelAt(e.src,p));
  }
  function meshAt(s,p=call('constructionProgress',s)??1){
    const e=entry(s);if(!e.src)return null;
    const b=bounds(e.src),span=b.top+TILE_LAG,step=Math.round(levelAt(e.src,p)/span*STEPS);
    let m=e.meshes.get(step);
    if(!m){
      m=assemble(e.src,step/STEPS*span,seedOf(s));
      if(e.meshes.size>8)e.meshes.clear();
      e.meshes.set(step,m);
    }
    return m;
  }
  // Paint the building at its stage; false when this structure has no assembly.
  function draw(s){
    if(!has(s)||!window.ConquerMesh3D)return false;
    const m=meshAt(s);if(!m)return false;
    if(m.col.length)window.ConquerMesh3D.drawMeshes(ctx,[m],window.ConquerMesh3D.gameView());
    if(cache.size>64){const live=new Set((State.structures||[]).map(o=>o.id));for(const id of cache.keys())if(!live.has(id))cache.delete(id)}
    return true;
  }
  window.ConquerAssembly={SPAN,COURSE,CELL,TILE_LAG,has,source,levelAt,assemble,builtHeight,heightNear,crownCenter,meshAt,draw,clip,
    clear:()=>cache.clear()};
})();
