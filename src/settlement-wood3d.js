'use strict';
// CONQUER timber fortifications in 3D: watchtower, palisade tower (open parapet or roofed
// gallery) and timber gate are Blender-built models (src/assets/wood-fort-models.js,
// tools/blender/build_wood_fort.py); palisades repeat the Blender stake along the game's
// own layout (palisadeLayout / palisadePostOffsetAt, as drawPalisadePostLine), and the
// tier 2 walkway / tier 3 earthwork follow drawPalisadeWalkway / drawPalisadeEarthwork.
// One set of world triangles feeds the world3d mesh builder; the 2.5D Canvas path keeps
// its own drawing as the fallback.
(function(){
  const DATA=()=>window.ConquerWoodFortModels;
  const WINTER=['#e7ece8','#dce3de'];
  const FOUNDATION='#7c7268';
  function modelKey(s){
    if(!s)return null;
    if(isWoodGate(s))return'woodGate';
    if(!isWoodTower(s))return null;
    if(woodTowerStyle(s)==='watchtower')return'watchtower';
    return woodTowerRoof(s)==='open'?'palisadeTower_open':'palisadeTower_roofed';
  }
  // Structures this module draws in the world renderer (sites keep their ghost / assembly).
  function handles(s){
    if(!s||!DATA()||!window.ConquerMesh3D||underConstruction(s))return false;
    return s.type==='palisade'||!!modelKey(s);
  }
  // Indexed parts expanded once into flat triangle lists.
  const expanded=new Map();
  function parts(key){
    let out=expanded.get(key);if(out)return out;
    out=[];
    for(const [name,part] of Object.entries(DATA().models[key].parts)){
      const v=new Float32Array(part.i.length*3);
      for(let k=0;k<part.i.length;k++){const j=part.i[k]*3;v[k*3]=part.p[j];v[k*3+1]=part.p[j+1];v[k*3+2]=part.p[j+2]}
      out.push({name,v,c:part.c});
    }
    expanded.set(key,out);return out;
  }
  // Palette with roofs, exposed decks and merlon tops whitened in winter.
  let palCache=null;
  function palette(){
    const data=DATA(),winter=State.season==='winter';
    if(palCache&&palCache.data===data&&palCache.winter===winter)return palCache.pal;
    const pal=data.palette.map((hex,i)=>{const k=data.paletteKeys[i];
      return winter&&k.startsWith('roof')?WINTER[/Dark$|Ridge$/.test(k)?1:0]:hex});
    palCache={data,winter,pal};return pal;
  }
  // Model parts into a {pos,col} mesh. place: {x,y,angle,sx,sy,sz}; only = part names to keep.
  function addModel(mesh,key,place,z0,only=null){
    const pal=palette(),a=Number(place.angle)||0,c=Math.cos(a),sn=Math.sin(a);
    const sx=place.sx??1,sy=place.sy??1,sz=place.sz??1;
    for(const part of parts(key)){
      if(only&&!only.includes(part.name))continue;
      const v=part.v;
      for(let i=0;i<v.length;i+=3){
        const x=v[i]*sx,y=v[i+1]*sy;
        mesh.pos.push(place.x+x*c-y*sn,place.y+x*sn+y*c,z0+v[i+2]*sz);
      }
      for(const ci of part.c)mesh.col.push(pal[ci]);
    }
  }
  function groundOf(s){
    const g=placementGroundZ(s);
    return Number.isFinite(g)?g:terrainElevation(s);
  }
  function hash(str){let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
  // One stake: unit body scaled to r x (bodyZ - z0), then a tip to tipZ (or a flat cap).
  function addStake(mesh,center,r,z0,bodyZ,tipZ,angle,seed){
    const ground=terrainElevation(center),base=ground+z0-(z0<=0?.06:0);
    addModel(mesh,'stake',{x:center.x,y:center.y,angle,sx:r,sy:r,sz:ground+bodyZ-base},base,['body']);
    if(tipZ>bodyZ)addModel(mesh,'stake',{x:center.x,y:center.y,angle:angle+(seed&3)*Math.PI/2,sx:r,sy:r,sz:tipZ-bodyZ},ground+bodyZ,[seed&4?'tipB':'tipA']);
    else addModel(mesh,'stake',{x:center.x,y:center.y,angle,sx:r,sy:r,sz:ground+bodyZ-base},base,['cap']);
  }
  // Pre-shaded faces (palisade earthwork / walkway), world xyz.
  function face(list,pts,hex){list.push({pts,hex})}
  const at=(p,z)=>({x:p.x,y:p.y,z:terrainElevation(p)+z});
  function palisade(s){
    const g=palisadeLayout(s),mesh={pos:[],col:[]},faces=[];
    const angle=Math.atan2(g.dy,g.dx),winter=State.season==='winter';
    if(g.tier===2){
      // drawPalisadeWalkway: plank deck at .66-.74 on the inner side, posts under its inner edge.
      const outer=g.postOffset-.05,inner=-g.width/2+.035,z0=.66,z1=.74,bays=Math.max(1,Math.floor(g.L/.72));
      for(let i=0;i<bays;i++){
        const p=t=>({x:g.a.x+g.dx*t,y:g.a.y+g.dy*t}),pa=p(i/bays),pb=p((i+1)/bays);
        const o0=g.point(pa,outer),o1=g.point(pb,outer),n0=g.point(pa,inner),n1=g.point(pb,inner);
        // Planks lighter than the stakes so the walk reads against them; a dark seam per bay.
        face(faces,[at(o0,z1),at(o1,z1),at(n1,z1),at(n0,z1)],winter?WINTER_SNOW_TOP:i%2?'#a98256':'#9f794e');
        const s0=g.point(pa,outer),s1=g.point(pa,inner),e={x:g.dx/g.L*.012,y:g.dy/g.L*.012};
        face(faces,[at({x:s0.x-e.x,y:s0.y-e.y},z1+.003),at({x:s0.x+e.x,y:s0.y+e.y},z1+.003),at({x:s1.x+e.x,y:s1.y+e.y},z1+.003),at({x:s1.x-e.x,y:s1.y-e.y},z1+.003)],'#5a4029');
        face(faces,[at(n0,z0),at(n1,z0),at(n1,z1),at(n0,z1)],'#4f3927');
        face(faces,[at(o0,z0),at(n0,z0),at(n0,z1),at(o0,z1)],'#65492f');
        face(faces,[at(o1,z0),at(n1,z0),at(n1,z1),at(o1,z1)],'#65492f');
        const q=g.point(pa,inner+.05);
        addStake(mesh,q,.045,0,z0,0,angle,0);
        // a brace from the post foot towards the stakes
        const b0=at(q,.06),b1=at(g.point(pa,outer-.02),z0-.02),w=.018*(g.dx/g.L),h=.018*(g.dy/g.L);
        face(faces,[{x:b0.x-w,y:b0.y-h,z:b0.z},{x:b0.x+w,y:b0.y+h,z:b0.z},{x:b1.x+w,y:b1.y+h,z:b1.z},{x:b1.x-w,y:b1.y-h,z:b1.z}],'#5a3e28');
      }
      addStake(mesh,g.point(g.b,inner+.05),.045,0,z0,0,angle,0);
    }else if(g.tier===3){
      // drawPalisadeEarthwork: rampart of earth behind the stakes.
      const crestOuter=g.postOffset-.055,crestInner=crestOuter-.18;
      const earthH=Math.max(.28,Math.min(.70,crestInner+g.width/2)),toe=crestInner-earthH;
      const ao=g.point(g.a,crestOuter),bo=g.point(g.b,crestOuter),ac=g.point(g.a,crestInner),bc=g.point(g.b,crestInner);
      const at0=g.point(g.a,toe),bt0=g.point(g.b,toe);
      face(faces,[at(ao,-.04),at(bo,-.04),at(bo,earthH),at(ao,earthH)],'#5a4128');
      face(faces,[at(ao,earthH),at(bo,earthH),at(bc,earthH),at(ac,earthH)],winter?WINTER_SNOW_TOP:'#76603a');
      face(faces,[at(ac,earthH),at(bc,earthH),at(bt0,0),at(at0,0)],winter?WINTER_SNOW_A:'#655033');
      face(faces,[at(ao,-.04),at(ao,earthH),at(ac,earthH),at(at0,0)],'#544128');
      face(faces,[at(bo,-.04),at(bo,earthH),at(bc,earthH),at(bt0,0)],'#5d492d');
    }
    // drawWatchtowerPalisadeJunction: the walkway / rampart crosses the open watchtower.
    for(const tower of new Set([g.aTarget,g.bTarget])){
      if(!palisadePassThroughTarget(tower))continue;
      if(g.tier===2){
        const pts=rectWorldPoints(tower.x,tower.y,.78,.78,tower.angle||0);
        face(faces,pts.map(p=>at(p,.74)),'#8b6845');
        for(let i=0;i<4;i++){const a=pts[i],b=pts[(i+1)%4];face(faces,[at(a,.66),at(b,.66),at(b,.74),at(a,.74)],i%2?'#4f3927':'#65492f')}
      }else if(g.tier===3){
        const crestOuter=g.postOffset-.055,crestInner=crestOuter-.18,earthH=Math.max(.28,Math.min(.70,crestInner+g.width/2));
        face(faces,rectWorldPoints(tower.x,tower.y,.82,.82,tower.angle||0).map(p=>at(p,earthH)),winter?WINTER_SNOW_TOP:'#76603a');
      }
    }
    // drawPalisadePostLine: the stakes, a little irregular in height and point.
    const count=Math.max(1,Math.ceil(g.L/.205)),key=String(s.id);
    for(let i=0;i<=count;i++){
      const t=i/count,along=g.L*t,p={x:g.a.x+g.dx*t,y:g.a.y+g.dy*t};
      const center=g.point(p,palisadePostOffsetAt(g,along)),h=hash(key+':'+i);
      const dz=((h>>>8)%100)/100*.06-.03;
      addStake(mesh,center,g.postR,0,.93+dz,1.15+dz+((h>>>16)%100)/100*.04,angle,h);
    }
    return{mesh,faces};
  }
  function foundation(s){
    // drawPlacementFoundation: ground-contact ring walls up to the placement plane.
    const mesh={pos:[],col:[]},baseZ=placementGroundZ(s);
    if(!Number.isFinite(baseZ)||placementFoundationDepth(s)<=.015)return mesh;
    for(const fp of unionGroundContactRings(structureGroundContactPolygons(s))){
      for(let i=0;i<fp.length;i++){
        const a=fp[i],b=fp[(i+1)%fp.length],steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/.24));
        for(let j=0;j<steps;j++){
          const p0={x:a.x+(b.x-a.x)*j/steps,y:a.y+(b.y-a.y)*j/steps},p1={x:a.x+(b.x-a.x)*(j+1)/steps,y:a.y+(b.y-a.y)*(j+1)/steps};
          const z0=Math.min(baseZ,terrainElevation(p0)),z1=Math.min(baseZ,terrainElevation(p1));
          if(baseZ-Math.min(z0,z1)<=.01)continue;
          mesh.pos.push(p0.x,p0.y,z0,p1.x,p1.y,z1,p1.x,p1.y,baseZ, p0.x,p0.y,z0,p1.x,p1.y,baseZ,p0.x,p0.y,baseZ);
          mesh.col.push(FOUNDATION,FOUNDATION);
        }
      }
    }
    return mesh;
  }
  // Palisade tower sides (outward normal in model space). In cutaway the two sides facing the
  // camera quarter-turn are left out and the room inside (floor, ladder) shows; otherwise the
  // interior parts stay out (the 2.5D painter has no depth buffer to hide them).
  const SIDES={side_xp:[1,0],side_xn:[-1,0],side_yp:[0,1],side_yn:[0,-1]};
  const INTERIOR=['floor','interior'];
  function openSides(s){
    if(typeof isPlanView==='function'&&isPlanView())return new Set();
    const a=s.angle||0,c=Math.cos(a),sn=Math.sin(a),d0=viewDepthPoint({x:s.x,y:s.y}),out=new Set();
    for(const [name,[x,y]] of Object.entries(SIDES))if(viewDepthPoint({x:s.x+x*c-y*sn,y:s.y+x*sn+y*c})>d0+1e-6)out.add(name);
    return out;
  }
  const cutaway=s=>typeof structureCutaway==='function'&&structureCutaway(s);
  function pointModel(s){
    const key=modelKey(s),ground=groundOf(s),mesh={pos:[],col:[]};
    if(key==='woodGate'){
      // Model is 1 U along the passage (x) by 1.5 U across: older saves may carry other w/h.
      const d=rectDims(s);
      addModel(mesh,key,{x:s.x,y:s.y,angle:s.angle||0,sx:d.w/1,sy:d.h/1.5},ground);
    }else{
      const names=parts(key).map(p=>p.name),open=cutaway(s)?openSides(s):null;
      const only=names.filter(n=>open?!open.has(n):!INTERIOR.includes(n));
      addModel(mesh,key,{x:s.x,y:s.y,angle:s.angle||0},ground,only);
    }
    return mesh;
  }
  // World geometry of one structure: model meshes (shaded by face normal) + pre-shaded faces.
  const cache=new Map();
  function geometry(s){
    const sig=[s.type,s.x,s.y,s.a?.x,s.a?.y,s.b?.x,s.b?.y,s.angle||0,s.width,s.tier,s.woodStyle,s.woodRoof,s.roofStyle,s.w,s.h,s.size,
      s.aSnap,s.bSnap,s.flip?1:0,s.groundZ,State.season,State.relief?.seed,JSON.stringify(State.relief?.terraforming||[]).length,
      cutaway(s)?'cut'+[...openSides(s)].join(','):''].join('|');
    const hit=s.id&&cache.get(s.id);if(hit&&hit.sig===sig)return hit.geo;
    let geo;
    if(s.type==='palisade')geo=palisade(s);
    else geo={mesh:pointModel(s),faces:[],foundation:foundation(s)};
    // Pre-shaded faces as one flat mesh for the 2.5D painter.
    const flat={pos:[],col:[],flat:true};
    for(const f of geo.faces)for(let i=1;i<f.pts.length-1;i++){
      for(const v of [f.pts[0],f.pts[i],f.pts[i+1]])flat.pos.push(v.x,v.y,v.z);
      flat.col.push(f.hex);
    }
    geo.flat=flat;
    if(s.id)cache.set(s.id,{sig,geo});
    if(cache.size>512)cache.clear();
    return geo;
  }
  // WebGL: add to a world3d meshBuilder with fixed-light shaded colours. An opened (cutaway)
  // tower belongs to the cutaway pass instead, rebuilt per camera quarter-turn.
  function addToBuilder(m,s){
    if(!handles(s))return false;
    if(cutaway(s))return true;
    return emit(m,s);
  }
  function addCutawayToBuilder(m,s){
    if(!handles(s)||!cutaway(s))return false;
    return emit(m,s);
  }
  function emit(m,s){
    const geo=geometry(s);
    for(const mesh of [geo.foundation,geo.mesh]){
      if(!mesh)continue;
      const p=mesh.pos;
      for(let t=0;t<mesh.col.length;t++){
        const o=t*9;
        m.face([{x:p[o],y:p[o+1],z:p[o+2]},{x:p[o+3],y:p[o+4],z:p[o+5]},{x:p[o+6],y:p[o+7],z:p[o+8]}],window.ConquerMesh3D.shadedHex(mesh,t));
      }
    }
    for(const f of geo.faces)m.face(f.pts,f.hex);
    return true;
  }
  // 2.5D Canvas: the same triangles through the depth-sorted painter (shaded per camera turn).
  function draw(s,preview=false){
    if(!handles(s))return false;
    const geo=geometry(s),list=[geo.foundation,geo.mesh,geo.flat].filter(m=>m&&m.col.length);
    // The gate's door leaves (ConquerGates, shared with the stone gates); world3d adds them per frame.
    const leaves=isWoodGate(s)&&!preview?window.ConquerGates?.gateMesh?.(s):null;
    if(leaves&&leaves.col.length)list.push(leaves);
    window.ConquerMesh3D.drawMeshes(ctx,list,window.ConquerMesh3D.gameView());
    return true;
  }
  // Interleaved x,y,z,r,g,b triangles (the world3d buffer layout) of some structures: the Asset Lab
  // shows and audits these through ConquerSiegePreview.assetMesh. Model triangles keep their base
  // colours here, because the Lab's painter shades faces itself (shading twice darkens the timber).
  function worldTriangles(list){
    const out=[],rgb=hex=>{const h=hex.replace('#','');return[0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255)};
    const push=(p,o,hex)=>{const c=rgb(hex);for(let k=0;k<3;k++)out.push(p[o+k*3],p[o+k*3+1],p[o+k*3+2],c[0],c[1],c[2])};
    for(const s of list){
      if(!handles(s))continue;
      const geo=geometry(s);
      for(const m of [geo.foundation,geo.mesh,geo.flat])if(m)for(let t=0;t<m.col.length;t++)push(m.pos,t*9,m.col[t]);
    }
    return new Float32Array(out);
  }
  window.ConquerWood3D={modelKey,handles,parts,geometry,addToBuilder,addCutawayToBuilder,openSides,draw,worldTriangles};
})();
