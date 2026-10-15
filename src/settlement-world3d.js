'use strict';
// CONQUER world 3D prototype — the whole static scene on WebGL2 with the camera as shader uniforms.
//
// Static geometry is uploaded once and only rebuilt when its content changes; pan, zoom, rotation and
// plan view are pure uniform changes (no scene-cache rebuilds). Everything reuses the game's own data:
//   - terrain mesh from State.relief (level tops + reliefEdgeBands, same model as terrainElevation);
//   - ground look (biome, relief colours, rivers, forest floor, roads, fields, lots, crossings) is the
//     existing Canvas 2D drawing, baked once in plan view into textures draped over the terrain;
//   - houses from urbanHouseFaces(), civic/industry/well from their footprints, castle from
//     ConquerCastle3D.worldMeshes(); sun shadows from shadowCasterGeometry()/sunShadowState();
//   - trees as depth-tested billboards using the forest SVG sprites.
// Dynamic figures, decals and overlays keep drawing in 2D on #c (step 2 moves soldiers into 3D).
// Opt-in: ?world3d=1 (persisted, page reloads on toggle) or ConquerWorld3D.setEnabled(true).
(()=>{
  const STORE_KEY='conquer.world3d.v1';
  const fromUrl=(()=>{try{const v=new URLSearchParams(location.search).get('world3d');return v===null?null:v!=='0'}catch{return null}})();
  let enabled=fromUrl??(()=>{try{return localStorage.getItem(STORE_KEY)==='1'}catch{return false}})();
  if(fromUrl!==null){try{localStorage.setItem(STORE_KEY,fromUrl?'1':'0')}catch{}}

  const TEX_SIZE=4096;                                   // world texture 200U, detail texture = build area
  const DETAIL={x0:BUILD_MIN,y0:BUILD_MIN,size:BUILD_MAX-BUILD_MIN};
  const S={gl:null,canvas:null,failed:null,prog:{},buf:{},tex:{},sig:{},stats:{}};
  const perf=()=>window.__conquerPerf||(window.__conquerPerf={});

  // ---------- shaders ----------
  const CAMERA=`
    uniform int uRot;uniform float uS;uniform vec2 uV;uniform float uPlan;uniform vec2 uVp;uniform vec2 uDepth;
    vec2 rotq(vec2 p){vec2 d=p-vec2(100.0);
      if(uRot==1)return vec2(100.0-d.y,100.0+d.x);
      if(uRot==2)return vec2(100.0-d.x,100.0-d.y);
      if(uRot==3)return vec2(100.0+d.y,100.0-d.x);
      return p;}
    // Same affine map as w2sRaw (isometric or plan) plus a monotonic view depth (larger = nearer).
    vec4 cam(vec3 w,vec2 px){
      vec2 q=rotq(w.xy);vec2 s;float d;
      if(uPlan>0.5){s=uV+q*uS;d=w.z;}
      else{s=vec2(uV.x+(q.x-q.y)*uS*0.8660254,uV.y+(q.x+q.y)*uS*0.5-w.z*uS*0.9);d=q.x+q.y+0.9*w.z;}
      s+=px;
      return vec4(s.x/uVp.x*2.0-1.0,1.0-s.y/uVp.y*2.0,1.0-2.0*(d-uDepth.x)/(uDepth.y-uDepth.x),1.0);}`;
  const SRC={
    mesh:[`#version 300 es
      ${CAMERA}
      in vec3 aPos;in vec3 aCol;out vec3 vCol;
      void main(){gl_Position=cam(aPos,vec2(0.0));vCol=aCol;}`,
      `#version 300 es
      precision mediump float;in vec3 vCol;out vec4 o;void main(){o=vec4(vCol,1.0);}`],
    flat:[`#version 300 es
      ${CAMERA}
      in vec3 aPos;void main(){gl_Position=cam(aPos,vec2(0.0));}`,
      `#version 300 es
      precision mediump float;uniform vec4 uColor;out vec4 o;void main(){o=vec4(uColor.rgb*uColor.a,uColor.a);}`],
    terrain:[`#version 300 es
      ${CAMERA}
      in vec3 aPos;out vec2 vW;
      void main(){gl_Position=cam(aPos,vec2(0.0));vW=aPos.xy;}`,
      `#version 300 es
      precision highp float;in vec2 vW;uniform sampler2D uWorld;uniform sampler2D uDetail;uniform vec3 uDetailRect;out vec4 o;
      void main(){
        vec2 dUV=(vW-uDetailRect.xy)/uDetailRect.z;
        bool inDetail=all(greaterThanEqual(dUV,vec2(0.002)))&&all(lessThanEqual(dUV,vec2(0.998)));
        vec4 c=inDetail?texture(uDetail,dUV):texture(uWorld,clamp(vW/200.0,0.0,1.0));
        o=vec4(c.rgb,1.0);}`],
    decal:[`#version 300 es
      ${CAMERA}
      in vec3 aPos;in vec2 aUV;in vec4 aCol;out vec2 vUV;out vec4 vCol;
      void main(){gl_Position=cam(aPos,vec2(0.0));vUV=aUV;vCol=aCol;}`,
      `#version 300 es
      precision mediump float;in vec2 vUV;in vec4 vCol;uniform sampler2D uAtlas;out vec4 o;
      void main(){vec4 c=texture(uAtlas,vUV)*vCol;if(c.a<0.02)discard;o=c;}`],
    sprite:[`#version 300 es
      ${CAMERA}
      in vec3 aAnchor;in vec2 aCorner;in float aSize;in vec2 aUV;out vec2 vUV;
      void main(){gl_Position=cam(aAnchor,aCorner*aSize*uS);vUV=aUV;}`,
      `#version 300 es
      precision mediump float;in vec2 vUV;uniform sampler2D uAtlas;out vec4 o;
      void main(){vec4 c=texture(uAtlas,vUV);if(c.a<0.45)discard;o=vec4(c.rgb/max(c.a,1e-3),1.0);}`]
  };

  function ensureGL(){
    if(S.gl)return S.gl;
    if(S.failed)return null;
    try{
      const c=document.createElement('canvas');
      const gl=c.getContext('webgl2',{antialias:true,alpha:true,premultipliedAlpha:true,preserveDrawingBuffer:true,depth:true});
      if(!gl)throw new Error('webgl2-unavailable');
      const compile=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s};
      for(const [name,[vs,fs]] of Object.entries(SRC)){
        const p=gl.createProgram();gl.attachShader(p,compile(gl.VERTEX_SHADER,vs));gl.attachShader(p,compile(gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);
        if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(name+': '+gl.getProgramInfoLog(p));
        const loc={};const n=gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS);
        for(let i=0;i<n;i++){const u=gl.getActiveUniform(p,i);loc[u.name]=gl.getUniformLocation(p,u.name)}
        const an=gl.getProgramParameter(p,gl.ACTIVE_ATTRIBUTES);
        for(let i=0;i<an;i++){const a=gl.getActiveAttrib(p,i);loc[a.name]=gl.getAttribLocation(p,a.name)}
        S.prog[name]={p,loc};
      }
      S.aniso=gl.getExtension('EXT_texture_filter_anisotropic');
      c.addEventListener('webglcontextlost',e=>{e.preventDefault();S.gl=null;S.failed='context-lost'});
      S.canvas=c;S.gl=gl;
      return gl;
    }catch(err){S.failed=String(err?.message||err);console.warn('World 3D unavailable:',S.failed);return null}
  }

  // ---------- small geometry helpers (world space, absolute z) ----------
  const rgbCache=new Map();
  function rgb(hex){
    let v=rgbCache.get(hex);if(v)return v;
    const h=String(hex).replace('#','');v=[0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255);rgbCache.set(hex,v);return v;
  }
  function meshBuilder(){
    const tris=[];
    const api={
      tris,
      face(vs,hex){                       // vs: [{x,y,z}] convex
        const c=rgb(hex);
        for(let i=1;i<vs.length-1;i++)for(const v of [vs[0],vs[i],vs[i+1]])tris.push(v.x,v.y,v.z,c[0],c[1],c[2]);
      },
      // Prism over a footprint with absolute base z; sides alternate like extrudePolygon (i%2 ? A : B).
      prism(pts,z0,z1,top,sideA,sideB){
        if(!pts?.length||!(z1>z0))return;
        api.face(pts.map(p=>({x:p.x,y:p.y,z:z1})),top);
        for(let i=0;i<pts.length;i++){
          const a=pts[i],b=pts[(i+1)%pts.length];
          api.face([{x:a.x,y:a.y,z:z0},{x:b.x,y:b.y,z:z0},{x:b.x,y:b.y,z:z1},{x:a.x,y:a.y,z:z1}],i%2?sideA:sideB);
        }
      },
      // Gabled block (drawCivicGabledPart / urbanHouseFaces): ridge along local x of (angle), walls by parity.
      gabled(center,w,h,turn,angle,base,wallH,ridgeH,wallA,wallB,roofA,roofB,gable){
        const rw=Math.abs(turn)>1e-6?h:w,rh=Math.abs(turn)>1e-6?w:h,ca=Math.cos(angle),sa=Math.sin(angle);
        const L=(x,y,z)=>({x:center.x+x*ca-y*sa,y:center.y+x*sa+y*ca,z});
        const c=[L(-rw/2,-rh/2,0),L(rw/2,-rh/2,0),L(rw/2,rh/2,0),L(-rw/2,rh/2,0)];
        for(let i=0;i<4;i++){
          const a=c[i],b=c[(i+1)%4];
          api.face([{...a,z:base},{...b,z:base},{...b,z:base+wallH},{...a,z:base+wallH}],i%2?wallA:wallB);
        }
        const W=p=>({...p,z:base+wallH}),r0=L(-rw/2,0,base+ridgeH),r1=L(rw/2,0,base+ridgeH);
        api.face([W(c[0]),W(c[1]),r1,r0],roofA);api.face([W(c[3]),W(c[2]),r1,r0],roofB);
        api.face([W(c[0]),W(c[3]),r0],gable);api.face([W(c[1]),W(c[2]),r1],gable);
      }
    };
    return api;
  }

  // ---------- terrain ----------
  function earcut(pts){
    // Ear clipping for simple polygons (relief level tops). Returns index triples.
    const n=pts.length;if(n<3)return[];
    let area=0;for(let i=0;i<n;i++){const a=pts[i],b=pts[(i+1)%n];area+=a.x*b.y-b.x*a.y}
    const idx=[...Array(n).keys()];if(area<0)idx.reverse();
    const out=[],cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
    const inside=(p,a,b,c)=>cross(a,b,p)>=0&&cross(b,c,p)>=0&&cross(c,a,p)>=0;
    let guard=0;
    while(idx.length>3&&guard++<n*n){
      let clipped=false;
      for(let i=0;i<idx.length;i++){
        const ia=idx[(i+idx.length-1)%idx.length],ib=idx[i],ic=idx[(i+1)%idx.length],a=pts[ia],b=pts[ib],c=pts[ic];
        if(cross(a,b,c)<=1e-12)continue;
        let ok=true;
        for(const j of idx){if(j===ia||j===ib||j===ic)continue;if(inside(pts[j],a,b,c)){ok=false;break}}
        if(!ok)continue;
        out.push(ia,ib,ic);idx.splice(i,1);clipped=true;break;
      }
      if(!clipped)break;
    }
    if(idx.length===3)out.push(idx[0],idx[1],idx[2]);
    return out;
  }
  function buildTerrain(){
    const v=[],push=(x,y,z)=>v.push(x,y,z);
    // Base plain (z=0) slightly larger than the world so edges never show the clear colour.
    const W=WORLD;
    for(const [x,y] of [[0,0],[W,0],[W,W],[0,0],[W,W],[0,W]])push(x,y,0);
    for(const level of reliefLevels()){
      const top=level.top||[];if(top.length<3)continue;
      const tri=earcut(top);
      for(const i of tri)push(top[i].x,top[i].y,level.z1);
      for(const band of reliefEdgeBands(level)){
        const [oa,ob,b,a]=band.poly;
        push(oa.x,oa.y,band.z0);push(ob.x,ob.y,band.z0);push(b.x,b.y,band.z1);
        push(oa.x,oa.y,band.z0);push(b.x,b.y,band.z1);push(a.x,a.y,band.z1);
      }
    }
    return new Float32Array(v);
  }
  // Bake the existing 2D ground drawing in plan view (rotation 0) into a canvas covering [x0,x0+size]².
  function bakeGround(x0,y0,size){
    const N=TEX_SIZE,c=document.createElement('canvas');c.width=c.height=N;const g=c.getContext('2d');
    const keepView=State.view,keepRect=wrap.getBoundingClientRect,keepTrees=forestTreeSpritesReady,keepFences=urbanFenceSegments;
    const px=N/size;
    State.view={...keepView,plan:true,rotation:0,scale:px/U,x:-x0*px,y:-y0*px};
    wrap.getBoundingClientRect=()=>({x:0,y:0,left:0,top:0,right:N,bottom:N,width:N,height:N});
    forestTreeSpritesReady=false;           // trees become 3D billboards, not ground paint
    urbanFenceSegments=()=>[];              // fences, walls and hedges become 3D geometry / billboards
    try{
      withRenderContext(g,()=>{
        g.fillStyle='#202419';g.fillRect(0,0,N,N);
        drawTerrain();drawEnvironment();
        State.structures.filter(s=>(s.type==='road'||(s.auto&&s.type==='field'))&&!underConstruction(s)).forEach(drawAutoStructure);
        drawPuddleLayer();drawUrbanLots();window.ConquerCrossings?.drawGround();
      });
    }finally{State.view=keepView;wrap.getBoundingClientRect=keepRect;forestTreeSpritesReady=keepTrees;urbanFenceSegments=keepFences}
    return c;
  }
  function uploadTexture(gl,name,source){
    let t=S.tex[name];if(!t){t=gl.createTexture();S.tex[name]=t}
    gl.bindTexture(gl.TEXTURE_2D,t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    if(S.aniso)gl.texParameterf(gl.TEXTURE_2D,S.aniso.TEXTURE_MAX_ANISOTROPY_EXT,8);
  }

  // ---------- buildings (non-castle) ----------
  const WINTER_ROOF=['#e7ece8','#dce3de'];
  function buildBuildings(){
    const m=meshBuilder(),winter=State.season==='winter';
    // Houses: urbanHouseFaces gives walls, then either 2 slopes + 2 gables or a turret cone.
    for(const entry of urbanHouseGeometry()){
      const house=entry.house;if(underConstruction(house))continue;
      const lvl=houseLevel(house);
      for(const part of entry.parts){
        const faces=urbanHouseFaces(house,part),n=part.points.length,base=terrainElevation(part.center);
        const split=part.kind==='turret'?base+1.02:base+part.bodyH*.5;
        for(let i=0;i<n;i++){
          const [a,b,c,d]=faces[i].map(({p,z})=>({x:p.x,y:p.y,z}));
          if(lvl===1&&part.kind!=='turret'){m.face([a,b,c,d],i%2?'#4e392d':'#654936');continue}
          const sa={...a,z:split},sb={...b,z:split};
          m.face([a,b,sb,sa],i%2?'#4f4b47':'#625e59');m.face([sa,sb,c,d],i%2?'#c8ae70':'#e0ca91');
        }
        const roof=f=>f.map(({p,z})=>({x:p.x,y:p.y,z}));
        if(part.kind==='turret'){
          for(let i=n;i<faces.length;i++)m.face(roof(faces[i]),winter?WINTER_ROOF[i%2]:(i%2?'#303943':'#394550'));
        }else{
          const rA=winter?WINTER_ROOF[0]:lvl===1?'#5b3d30':'#303237',rB=winter?WINTER_ROOF[1]:lvl===1?'#6b4938':'#3a3d42';
          const gable=lvl===1?'#654936':'#d9c184';
          m.face(roof(faces[n]),rA);m.face(roof(faces[n+1]),rB);m.face(roof(faces[n+2]),gable);m.face(roof(faces[n+3]),gable);
        }
      }
      for(const c of chimneySpecs(house)){
        const g=terrainElevation(c.center);
        m.prism(rectWorldPoints(c.center.x,c.center.y,.22,.20,c.angle||0),g+c.z0,g+c.z1,'#3b302c','#332824','#493732');
      }
    }
    // Urban boundaries (urbanFenceSegments): fences and low walls as solids, hedges are billboards.
    for(const e of urbanFenceSegments()){
      const dx=e.b.x-e.a.x,dy=e.b.y-e.a.y,L=Math.hypot(dx,dy);if(L<1e-4)continue;
      const ang=Math.atan2(dy,dx),mid={x:(e.a.x+e.b.x)/2,y:(e.a.y+e.b.y)/2},g=terrainElevation(mid);
      if(e.material==='wall'){                                                  // drawUrbanWall
        m.prism(rectWorldPoints(mid.x,mid.y,L,.13,ang),g,g+.36,winter?'#e5e9df':'#a3937a','#766a59','#8b7c67');
      }else if(e.material!=='hedge'){                                           // drawUrbanFence
        for(const z of [.13,.30])m.prism(rectWorldPoints(mid.x,mid.y,L,.035,ang),g+z-.018,g+z+.018,'#806442','#6b5338','#806442');
        const count=Math.max(1,Math.ceil(L/.65));
        for(let i=0;i<=count;i++){const t=i/count,p={x:e.a.x+dx*t,y:e.a.y+dy*t};m.prism(rectWorldPoints(p.x,p.y,.05,.05,ang),g+.02,g+.38,'#806442','#6b5338','#806442')}
      }
    }
    for(const s of State.structures){
      if(underConstruction(s))continue;
      if(isCivic(s))addCivic(m,s,winter);
      else if(window.ConquerIndustries?.is(s)){
        const def=ConquerIndustries.TYPES[s.type],g=Number.isFinite(s.groundZ)?s.groundZ:ConquerIndustries.groundLevel(s);
        m.prism(ConquerIndustries.footprint(s),g,g+.35,def.color,def.edge,def.edge);
      }else if(s.type==='well'){
        const g=terrainElevation(s);
        m.prism(rectWorldPoints(s.x,s.y,WELL_PLAZA_SIZE,WELL_PLAZA_SIZE,0),g,g+.055,'#8d816e','#655b4f','#74695a');
        m.prism(circleWorldPoints(s.x,s.y,.62,20),g+.055,g+.42,'#84796d','#4e4740','#5d554d');
        m.face(circleWorldPoints(s.x,s.y,.36,16).map(p=>({x:p.x,y:p.y,z:g+.425})),'#172023');
      }
    }
    return new Float32Array(m.tris);
  }
  function addCivic(m,s,winter){
    const g=Number.isFinite(placementGroundZ(s))?placementGroundZ(s):terrainElevation(s),angle=s.angle||0;
    const L=(x,y)=>houseLocalToWorld(s,x,y);
    for(const part of civicParts(s)){
      const turn=part.roofTurn||0;
      if(s.type==='market'){
        m.prism(part.points,g,g+.12,'#9a876b','#665847','#756451');
        const canopy=['#8c4f37','#b18a3f','#536d76','#6f6941'];let k=0;
        for(const sx of [-1,1])for(const sy of [-1,1]){
          const c=L(sx*1.05,sy*1.0);
          m.prism(rectWorldPoints(c.x,c.y,1.15,.72,angle),g+.12,g+.46,'#654b34','#4b3826','#5a4430');
          m.prism(rectWorldPoints(c.x,c.y,1.38,.92,angle),g+.58,g+.66,canopy[k%4],canopy[k%4],canopy[k%4]);k++;
        }
      }else if(s.type==='training'){
        m.prism(part.points,g,g+.10,'#70502e','#5a3f24','#664729');
        for(const sx of [-1,1])for(const sy of [-1,1]){const c=L(sx*2.18,sy*1.68);m.prism(rectWorldPoints(c.x,c.y,.14,.14,angle),g+.10,g+.58,'#654b34','#4b3826','#5a4430')}
      }else if(s.type==='tavern'){
        const rA=winter?WINTER_ROOF[0]:'#3b302b',rB=winter?WINTER_ROOF[1]:'#493930';
        m.gabled(part.center,part.w,part.h,turn,angle+turn,g,1.48,2.08,'#684f3d','#7b5e48',rA,rB,'#80624a');
      }else if(s.type==='church'){
        if(part.role==='tower'){
          m.prism(part.points,g,g+2.72,'#676a6c','#5a5d5f','#676a6c');
          m.gabled(part.center,part.w,part.h,turn,angle+turn,g+2.72,0.001,.63,'#676a6c','#676a6c',winter?WINTER_ROOF[0]:'#3d4145',winter?WINTER_ROOF[1]:'#484c50','#676a6c');
        }else{
          m.gabled(part.center,part.w,part.h,turn,angle+turn,g,1.88,2.52,'#6b6863','#7d7973',winter?WINTER_ROOF[0]:'#41454a',winter?WINTER_ROOF[1]:'#4c5054','#85817a');
        }
      }
    }
  }

  // ---------- trees (billboards) ----------
  const ATLAS_TILE=128,ATLAS_COLS=8;
  function buildTreeAtlas(){
    if(!forestTreeSpritesReady)return null;
    const season=State.season==='autumn'?'autumn':State.season==='winter'?'winter':'summer';
    const sets=forestTreeSprites[season]||[],tiles=[];
    sets.forEach((byColor,shape)=>(byColor||[]).forEach((img,color)=>img&&tiles.push({key:shape+':'+color,img,aspect:1})));
    // Hedge bushes (drawUrbanHedge): 920x580 sprites.
    (window.boundaryBushSprites?.[season]||(typeof boundaryBushSprites!=='undefined'?boundaryBushSprites[season]:[])||[])
      .forEach((img,shape)=>img&&tiles.push({key:'bush:'+shape,img,aspect:580/920}));
    const rows=Math.ceil(tiles.length/ATLAS_COLS)||1,c=document.createElement('canvas');
    c.width=ATLAS_COLS*ATLAS_TILE;c.height=rows*ATLAS_TILE;const g=c.getContext('2d'),map=new Map();
    tiles.forEach((t,i)=>{const x=(i%ATLAS_COLS)*ATLAS_TILE,y=Math.floor(i/ATLAS_COLS)*ATLAS_TILE,h=Math.round(ATLAS_TILE*t.aspect);
      g.drawImage(t.img,x,y,ATLAS_TILE,h);
      map.set(t.key,[x/c.width,y/c.height,(x+ATLAS_TILE)/c.width,(y+h)/c.height])});
    return{canvas:c,map,season};
  }
  function buildTrees(atlas){
    const v=[];if(!atlas)return new Float32Array(0);
    for(const f of State.environment||[]){
      if(f.type!=='forest')continue;
      for(const t of forestTreeLayout(f)){
        const uv=atlas.map.get(t.shapeIndex+':'+(atlas.season==='winter'?0:t.colorIndex));if(!uv)continue;
        let [u0,v0,u1,v1]=uv;if(t.flip)[u0,u1]=[u1,u0];
        const size=2.25*t.scale,z=t.z||0;
        const C=[[-.5,-.94,u0,v0],[.5,-.94,u1,v0],[.5,.06,u1,v1],[-.5,.06,u0,v1]];
        for(const k of [0,1,2,0,2,3]){const [cx,cy,u,w]=C[k];v.push(t.p.x,t.p.y,z,cx,cy,size,u,w)}
      }
    }
    for(const e of urbanFenceSegments()){
      if(e.material!=='hedge')continue;
      for(const b of urbanHedgeBushes(e)){
        const uv=atlas.map.get('bush:'+b.shape);if(!uv)continue;
        const [u0,v0,u1,v1]=uv,hr=580/920*(b.scale||1),z=terrainElevation(b.p)+.01;
        const C=[[-.5,-.97*hr,u0,v0],[.5,-.97*hr,u1,v0],[.5,.03*hr,u1,v1],[-.5,.03*hr,u0,v1]];
        for(const k of [0,1,2,0,2,3]){const [cx,cy,u,w]=C[k];v.push(b.p.x,b.p.y,z,cx,cy,b.width,u,w)}
      }
    }
    return new Float32Array(v);
  }

  // ---------- facade decals (architecture PNGs + house windows/doors) ----------
  // Same placement rules as drawFacadeWindows / drawGatePortals / drawTowerDoors / drawHouseFacadeWindows,
  // but on every facade: the depth buffer decides what is visible, so the set is camera-independent.
  const DECAL_KEYS=['gatePortal','towerDoor','arrowSlit','gothicL1','gothicL2','gothicL3'];
  function buildDecalAtlas(){
    const T=256,cols=4,c=document.createElement('canvas');c.width=cols*T;c.height=2*T;
    const g=c.getContext('2d'),map=new Map();
    const tiles=[...DECAL_KEYS,'__white'];
    tiles.forEach((k,i)=>{
      const x=(i%cols)*T,y=Math.floor(i/cols)*T;
      if(k==='__white'){g.fillStyle='#fff';g.fillRect(x,y,16,16);map.set(k,[(x+4)/c.width,(y+4)/c.height,(x+12)/c.width,(y+12)/c.height]);return}
      const img=architectureSprite(k);if(!img)return;
      g.drawImage(img,x,y);map.set(k,[x/c.width,y/c.height,(x+img.width)/c.width,(y+img.height)/c.height]);
    });
    return{canvas:c,map};
  }
  function buildDecals(atlas){
    const v=[],WHITE=[1,1,1,1];
    const quad=(a,b,z0,z1,key,out,col=WHITE,push=.012)=>{
      const uv=atlas.map.get(key);if(!uv)return;
      const [u0,v0,u1,v1]=uv,A={x:a.x+out.x*push,y:a.y+out.y*push},B={x:b.x+out.x*push,y:b.y+out.y*push};
      const P=[[A,z1,u0,v0],[B,z1,u1,v0],[B,z0,u1,v1],[A,z0,u0,v1]];
      for(const k of [0,1,2,0,2,3]){const [p,z,u,w]=P[k];v.push(p.x,p.y,z,u,w,col[0],col[1],col[2],col[3])}
    };
    const outward=(edge,c)=>{
      const dx=edge.b.x-edge.a.x,dy=edge.b.y-edge.a.y,L=Math.hypot(dx,dy)||1;let nx=-dy/L,ny=dx/L;
      const mx=(edge.a.x+edge.b.x)/2-c.x,my=(edge.a.y+edge.b.y)/2-c.y;if(nx*mx+ny*my<0){nx=-nx;ny=-ny}
      return{x:nx,y:ny};
    };
    const onEdge=(edge,centerZ,width,height,key,offset,ground,out)=>{
      const span=facadeAssetWorldSpan(edge,width,offset);
      quad(span.a,span.b,ground+centerZ-height/2,ground+centerZ+height/2,key,out);
    };
    const edgesOf=fp=>fp.map((a,i)=>({a,b:fp[(i+1)%fp.length],index:i}));
    for(const s of State.structures){
      if(underConstruction(s))continue;
      const center=structureCenter(s);
      if(s.type==='tower'&&!isWoodTower(s)){
        const ground=Number.isFinite(placementGroundZ(s))?placementGroundZ(s):terrainElevation(s);
        for(const spec of towerDoorSpecs(s)){                                   // drawTowerDoorSpec
          const tier=towerTier(s),width=clamp(.38+tier*.045,.42,.54)*1.5,height=Math.max(.18,spec.apexZ-spec.baseZ)/3*1.5;
          const c=spec.contact,t=spec.tangent,half=width/2;
          quad({x:c.x-t.x*half,y:c.y-t.y*half},{x:c.x+t.x*half,y:c.y+t.y*half},ground+spec.baseZ,ground+spec.baseZ+height,'towerDoor',spec.outward);
        }
        const rows=towerWindowRows(s);
        if(s.shape==='round'){                                                   // roundTowerFacadeEdges, all four
          const iv=structureInteriorVector(s),base=Math.atan2(iv.y,iv.x),r=Math.max(.2,Number(s.r)||.5)+.006,span=Math.min(.54,r*.95);
          for(const row of rows){
            const key=towerGothicAssetForRow(s,row),sz=towerGothicAssetSizeForRow(s,row);if(!key)continue;
            for(let i=0;i<4;i++){
              const a=base+i*Math.PI/2,o={x:Math.cos(a),y:Math.sin(a)},cc={x:s.x+o.x*r,y:s.y+o.y*r},tx=-o.y,ty=o.x;
              const edge={a:{x:cc.x-tx*span/2,y:cc.y-ty*span/2},b:{x:cc.x+tx*span/2,y:cc.y+ty*span/2}};
              if(i===0)onEdge(edge,row.z,sz.w*.86,sz.h,key,0,ground,o);
              else if(row.floor>=2)onEdge(edge,row.z,.22,.60,'arrowSlit',0,ground,o);
            }
          }
        }else{
          const interior=interiorFacadeEdgeIndex(s);
          for(const row of rows){
            const key=towerGothicAssetForRow(s,row),sz=towerGothicAssetSizeForRow(s,row);if(!key)continue;
            for(const edge of edgesOf(footprintPoints(s))){
              const o=outward(edge,center);
              if(edge.index===interior)onEdge(edge,row.z,sz.w,sz.h,key,0,ground,o);
              else if(row.floor>=2)onEdge(edge,row.z,.22,.60,'arrowSlit',0,ground,o);
            }
          }
        }
      }else if(s.type==='gate'&&!isWoodGate(s)){
        const ground=Number.isFinite(placementGroundZ(s))?placementGroundZ(s):terrainElevation(s);
        const interior=interiorFacadeEdgeIndex(s),key=gothicAssetForLevel(s),sz=gothicAssetSizeForLevel(s);
        for(const edge of edgesOf(footprintPoints(s))){
          const o=outward(edge,center);
          if(edge.index===1||edge.index===3)onEdge(edge,.705,.90,1.35,'gatePortal',0,ground,o);   // front / rear
          for(const z of gateWindowRows(s)){
            if(edge.index===interior)onEdge(edge,z,sz.w,sz.h,key,0,ground,o);
            else onEdge(edge,z,.24,.62,'arrowSlit',0,ground,o);
          }
        }
      }else if(s.type==='built'){
        const l=structureLevel(s),outside=wallExteriorSide(s),inside=-outside;
        const rows=[[outside,.86,.72,'arrowSlit',.23,.58]];
        if(l>=2)rows.push([inside,2.22,.42,'gothicL3',.92,.78],[outside,2.22,.72,'arrowSlit',.23,.58]);
        for(const [side,z,density,key,aw,ah] of rows){
          const edge=linearFacadeEdge(s,side),count=Math.max(1,Math.round(edge.length*density)),cell=edge.length/count;
          const ground=terrainElevation({x:(edge.a.x+edge.b.x)/2,y:(edge.a.y+edge.b.y)/2}),o=outward(edge,center);
          for(let i=0;i<count;i++)onEdge(edge,z,Math.min(aw,cell*.82),ah,key,(i+.5)*cell-edge.length/2,ground,o);
        }
      }else if(s.type==='house'){
        const rows=houseLevel(s)>=2?[.52,1.34]:[.48],WIN=[35/255*.82,29/255*.82,24/255*.82,.82];
        for(const part of urbanHouseDisplayParts(s)){
          if(part.kind==='turret')continue;
          const ground=terrainElevation(part.center);
          for(const edge of edgesOf(part.points)){
            const o=outward(edge,part.center),m={x:(edge.a.x+edge.b.x)/2,y:(edge.a.y+edge.b.y)/2};
            const dx=edge.b.x-edge.a.x,dy=edge.b.y-edge.a.y,L=Math.hypot(dx,dy)||1,ux=dx/L,uy=dy/L,hw=.0875;
            // drawWindowOnEdge: 2.1 x 3.25 px per view-scale unit -> .175U x ~.30U
            for(const z of rows)quad({x:m.x-ux*hw,y:m.y-uy*hw},{x:m.x+ux*hw,y:m.y+uy*hw},ground+z-.15,ground+z+.15,'__white',o,WIN);
          }
        }
        const d=houseDoorInfo(s),hw=Math.min(.08,(Number(s.w)||1.5)*.0533),g=terrainElevation(d.surface),DOOR=[57/255,39/255,30/255,1];
        quad({x:d.surface.x-d.tangent.x*hw,y:d.surface.y-d.tangent.y*hw},{x:d.surface.x+d.tangent.x*hw,y:d.surface.y+d.tangent.y*hw},g+.04,g+.552,'__white',d.normal,DOOR);
      }
    }
    return new Float32Array(v);
  }

  // ---------- shadows ----------
  function buildShadows(){
    const sun=sunShadowState();if(!sun)return{data:new Float32Array(0),alpha:0};
    const v=[];
    for(const s of State.structures){
      if(underConstruction(s)||!['house','tower','gate','wall','palisade','built','market','tavern','church'].includes(s.type))continue;
      const {fp,h}=shadowCasterGeometry(s);if(!fp?.length||h<=0)continue;
      const len=h*sun.lengthPerHeight,ox=sun.dx*len,oy=sun.dy*len,cloud=[];
      for(const p of fp){cloud.push({x:p.x,y:p.y});cloud.push({x:p.x+ox,y:p.y+oy})}
      const hull=convexHull(cloud);if(hull.length<3)continue;
      const zs=hull.map(p=>terrainElevation(p)+.03);
      for(let i=1;i<hull.length-1;i++)for(const k of [0,i,i+1])v.push(hull[k].x,hull[k].y,zs[k]);
    }
    return{data:new Float32Array(v),alpha:sun.alpha*.82};
  }

  // ---------- content signatures (cheap, per frame) ----------
  function structuresSig(filter){
    let h=0;
    for(const s of State.structures){
      if(!filter(s))continue;
      const str=s.id+(underConstruction(s)?'u':'c')+(s.level||'')+(s.houseLevel||'')+(s.x??s.a?.x??'')+(s.y??s.a?.y??'')+(s.b?.x??'')+(s.angle||0)+(s.roofStyle||'')+(s.baseStyle||'')+(s.skin||'')+(s.cutaway?1:0)+(s.width||'');
      for(let i=0;i<str.length;i++)h=(Math.imul(h,31)+str.charCodeAt(i))|0;
    }
    return h;
  }
  const isGroundStruct=s=>s.type==='road'||s.type==='field'||s.type==='house'||s.type==='moat'||s.type==='bridge'||s.type==='palisade';
  const isBuilding=s=>s.type==='house'||s.type==='field'||isCivic(s)||s.type==='well'||!!window.ConquerIndustries?.is(s);
  // Urban lots/fences are regenerated by the game (urbanRevision) without any structure field changing.
  function urbanRev(){try{return typeof urbanRevision!=='undefined'?urbanRevision:0}catch{return 0}}
  function wet(){try{return typeof weatherGroundWet==='function'?weatherGroundWet():!!State.weather?.wet}catch{return false}}

  function upload(gl,name,data){
    let b=S.buf[name];if(!b){b=gl.createBuffer();S.buf[name]=b}
    gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);
    S.buf[name+'#n']=data.length;
  }
  // Content signatures are only recomputed after the game signals a change (invalidateSceneCache is
  // called for every structure/season/weather/sun/camera change), not on every frame.
  S.contentDirty=true;
  if(typeof invalidateSceneCache==='function'){
    const orig=invalidateSceneCache;
    invalidateSceneCache=function(...args){S.contentDirty=true;return orig.apply(this,args)};
  }
  function ensureContent(gl){
    if(!S.contentDirty&&S.sig.terrain&&S.lastUrbanRev===urbanRev()){S.stats.ensureMs=0;return}
    S.contentDirty=false;S.lastUrbanRev=urbanRev();
    const t0=performance.now(),st=S.stats;
    const season=State.season||'summer',rot=State.view.rotation||0,plan=isPlanView();
    const tSig=[season,State.biome,State.relief?.seed,(State.environment||[]).length,wet(),urbanRev(),structuresSig(isGroundStruct)].join('|');
    if(S.sig.terrain!==tSig){
      const a=performance.now();
      upload(gl,'terrain',buildTerrain());
      uploadTexture(gl,'world',bakeGround(0,0,WORLD));
      uploadTexture(gl,'detail',bakeGround(DETAIL.x0,DETAIL.y0,DETAIL.size));
      S.sig.terrain=tSig;st.groundBakeMs=performance.now()-a;
    }
    const bSig=[season,urbanRev(),structuresSig(isBuilding)].join('|');
    if(S.sig.buildings!==bSig){const a=performance.now();upload(gl,'buildings',buildBuildings());S.sig.buildings=bSig;st.buildingsMs=performance.now()-a}
    const cSig=[season,rot,plan,structuresSig(s=>window.ConquerCastle3D?.castleVolume?.(s))].join('|');
    if(S.sig.castle!==cSig&&window.ConquerCastle3D?.worldMeshes){
      const a=performance.now(),cm=ConquerCastle3D.worldMeshes();
      upload(gl,'castleBody',new Float32Array(cm.body));upload(gl,'castleLines',new Float32Array(cm.body.lines||[]));
      upload(gl,'castleFront',new Float32Array(cm.front));upload(gl,'castleFrontLines',new Float32Array(cm.front.lines||[]));
      S.sig.castle=cSig;st.castleMs=performance.now()-a;
    }
    const treeSig=[season,forestTreeSpritesReady,(State.environment||[]).length,State.seed,urbanRev(),structuresSig(s=>s.type==='house'||s.type==='field'),
      Object.keys((typeof boundaryBushSprites!=='undefined'&&boundaryBushSprites[season])||{}).length].join('|');
    if(S.sig.trees!==treeSig){
      const a=performance.now(),atlas=buildTreeAtlas();
      if(atlas)uploadTexture(gl,'atlas',atlas.canvas);
      upload(gl,'trees',buildTrees(atlas));S.sig.trees=treeSig;st.treesMs=performance.now()-a;
    }
    const dSig=[structuresSig(()=>true),Object.keys(architectureSprites).length].join('|');
    if(S.sig.decals!==dSig){
      const a=performance.now(),atlas=buildDecalAtlas();uploadTexture(gl,'decalAtlas',atlas.canvas);
      upload(gl,'decals',buildDecals(atlas));S.sig.decals=dSig;st.decalsMs=performance.now()-a;
    }
    const sun=sunShadowState(),sSig=[sun?Math.round(sun.phase*64):'night',S.sig.buildings,S.sig.castle].join('|');
    if(S.sig.shadow!==sSig){const a=performance.now(),sh=buildShadows();upload(gl,'shadow',sh.data);S.shadowAlpha=sh.alpha;S.sig.shadow=sSig;st.shadowMs=performance.now()-a}
    st.ensureMs=performance.now()-t0;
  }

  // ---------- drawing ----------
  function setCamera(gl,prog,r){
    const L=prog.loc,plan=isPlanView();
    gl.uniform1i(L.uRot,((State.view.rotation||0)%4+4)%4);gl.uniform1f(L.uS,U*State.view.scale);
    gl.uniform2f(L.uV,State.view.x,State.view.y);gl.uniform1f(L.uPlan,plan?1:0);gl.uniform2f(L.uVp,r.width,r.height);
    gl.uniform2f(L.uDepth,plan?-5:-80,plan?30:480);
  }
  function bindAttrib(gl,prog,name,buf,size,stride,offset){
    const loc=prog.loc[name];if(loc==null||loc<0)return;
    gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,stride,offset);
  }
  function drawMesh(gl,r,name,mode=gl.TRIANGLES){
    const n=S.buf[name+'#n'];if(!n)return;
    const pr=S.prog.mesh;gl.useProgram(pr.p);setCamera(gl,pr,r);
    bindAttrib(gl,pr,'aPos',S.buf[name],3,24,0);bindAttrib(gl,pr,'aCol',S.buf[name],3,24,12);
    gl.drawArrays(mode,0,n/6);
  }
  function resizeTo(r){
    const dpr=Math.min(devicePixelRatio||1,2),W=Math.max(1,Math.round(r.width*dpr)),H=Math.max(1,Math.round(r.height*dpr));
    if(S.canvas.width!==W||S.canvas.height!==H){S.canvas.width=W;S.canvas.height=H}
    S.gl.viewport(0,0,W,H);
  }
  function renderBack(r){
    const gl=S.gl;resizeTo(r);
    gl.clearColor(32/255,36/255,25/255,1);gl.clearDepth(1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);gl.depthMask(true);gl.disable(gl.BLEND);
    // terrain
    const tp=S.prog.terrain;gl.useProgram(tp.p);setCamera(gl,tp,r);
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,S.tex.world);gl.uniform1i(tp.loc.uWorld,0);
    gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,S.tex.detail);gl.uniform1i(tp.loc.uDetail,1);
    gl.uniform3f(tp.loc.uDetailRect,DETAIL.x0,DETAIL.y0,DETAIL.size);
    gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(2,2);
    bindAttrib(gl,tp,'aPos',S.buf.terrain,3,12,0);gl.drawArrays(gl.TRIANGLES,0,S.buf['terrain#n']/3);
    gl.disable(gl.POLYGON_OFFSET_FILL);
    // sun shadows on the ground (blended, no depth write)
    if(S.buf['shadow#n']&&S.shadowAlpha>0){
      const fp=S.prog.flat;gl.useProgram(fp.p);setCamera(gl,fp,r);gl.uniform4f(fp.loc.uColor,4/255,5/255,7/255,S.shadowAlpha);
      gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
      bindAttrib(gl,fp,'aPos',S.buf.shadow,3,12,0);gl.drawArrays(gl.TRIANGLES,0,S.buf['shadow#n']/3);
      gl.depthMask(true);gl.disable(gl.BLEND);
    }
    // solids, then top-face outlines without polygon offset
    gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(1,1);
    drawMesh(gl,r,'buildings');drawMesh(gl,r,'castleBody');
    gl.disable(gl.POLYGON_OFFSET_FILL);
    drawMesh(gl,r,'castleLines',gl.LINES);
    // facade decals: blended over their walls, depth-tested, no depth write
    if(S.buf['decals#n']&&S.tex.decalAtlas){
      const dp=S.prog.decal;gl.useProgram(dp.p);setCamera(gl,dp,r);
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,S.tex.decalAtlas);gl.uniform1i(dp.loc.uAtlas,0);
      gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
      const b=S.buf.decals;bindAttrib(gl,dp,'aPos',b,3,36,0);bindAttrib(gl,dp,'aUV',b,2,36,12);bindAttrib(gl,dp,'aCol',b,4,36,20);
      gl.drawArrays(gl.TRIANGLES,0,S.buf['decals#n']/9);
      gl.depthMask(true);gl.disable(gl.BLEND);
    }
    // trees
    if(S.buf['trees#n']&&S.tex.atlas){
      const sp=S.prog.sprite;gl.useProgram(sp.p);setCamera(gl,sp,r);
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,S.tex.atlas);gl.uniform1i(sp.loc.uAtlas,0);
      const b=S.buf.trees;bindAttrib(gl,sp,'aAnchor',b,3,32,0);bindAttrib(gl,sp,'aCorner',b,2,32,12);bindAttrib(gl,sp,'aSize',b,1,32,20);bindAttrib(gl,sp,'aUV',b,2,32,24);
      gl.drawArrays(gl.TRIANGLES,0,S.buf['trees#n']/8);
    }
  }
  function renderFront(r){
    // Near-half battlements over the patrols, depth-tested against the back pass (depth kept).
    const gl=S.gl;gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(1,1);
    drawMesh(gl,r,'castleFront');gl.disable(gl.POLYGON_OFFSET_FILL);drawMesh(gl,r,'castleFrontLines',gl.LINES);
  }

  // ---------- frame hooks used by draw() ----------
  function supported(){return !!ensureGL()}
  function active(){return enabled&&supported()}
  function residual2D(){
    // Not ported yet: palisades, wood towers and wood gates keep their 2.5D drawing (per frame).
    const items=State.structures.filter(s=>!underConstruction(s)&&(s.type==='palisade'||isWoodTower(s)||isWoodGate(s)))
      .sort((a,b)=>worldDepth(a)-worldDepth(b));
    for(const s of items)drawStructure(s);
  }
  function drawBack(r){
    const t0=performance.now(),gl=ensureGL();if(!gl)return false;
    const gpu=document.getElementById('gpuCanvas');if(gpu&&gpu.style.visibility!=='hidden')gpu.style.visibility='hidden';
    ensureContent(gl);
    const t1=performance.now();renderBack(r);
    ctx.drawImage(S.canvas,0,0,r.width,r.height);
    if(isPlanView())drawGrid();             // 5U lines + 0.5U snap lattice (plan view editor aid)
    residual2D();
    // Village name over the well (screen-space text in drawPointStructure).
    if(State.village.founded&&State.village.name)for(const s of State.structures){
      if(s.type!=='well'||underConstruction(s))continue;
      const p=w2s({x:s.x,y:s.y},.46);ctx.fillStyle='#f2e6d3';ctx.font='700 12px system-ui';ctx.textAlign='center';ctx.fillText(State.village.name,p.x,p.y-12);
    }
    const p=perf();p.world3dBackMs=performance.now()-t1;p.world3dEnsureMs=t1-t0;
    return true;
  }
  function drawCastleOverlays(){
    for(const s of State.structures){
      if(!isCastlePart(s)||underConstruction(s))continue;
      if(s.type==='built')drawBuiltArcade(s);
    }
    drawCutawayStructures();
  }
  // Mastio heraldic drape stays 2D for now: run the facade pass on the mastio towers only.
  function drawMastioDrapes(){
    const all=State.structures,mastio=all.filter(s=>s.isMastio&&!underConstruction(s));
    if(!mastio.length)return;
    try{State.structures=mastio;drawFacadeWindows(false,1,false)}finally{State.structures=all}
  }
  function drawFront(r){
    const t0=performance.now();renderFront(r);ctx.drawImage(S.canvas,0,0,r.width,r.height);
    const all=State.structures;
    try{State.structures=all.filter(s=>!window.ConquerCastle3D?.castleVolume?.(s));drawCastleBattlements()}finally{State.structures=all}
    perf().world3dFrontMs=performance.now()-t0;
  }
  function setEnabled(on){enabled=!!on;try{localStorage.setItem(STORE_KEY,enabled?'1':'0')}catch{}location.reload()}
  // Benchmark hook: switch modes in place (no reload). Restores the WebGPU canvas when leaving 3D.
  function _setActiveForTest(on){
    enabled=!!on;
    if(!enabled){const gpu=document.getElementById('gpuCanvas');if(gpu)gpu.style.visibility='';window.ConquerWebGPU?.invalidate?.()}
    invalidateSceneCache();
  }
  window.ConquerWorld3D={active,supported,setEnabled,drawBack,drawCastleOverlays,drawFront,drawMastioDrapes,_setActiveForTest,
    invalidate:()=>{S.sig={};S.contentDirty=true},
    _debugBake:bakeGround,
    status:()=>({enabled,supported:supported(),failed:S.failed,stats:{...S.stats},buffers:Object.fromEntries(Object.entries(S.buf).filter(([k])=>k.endsWith('#n')))})};
})();
