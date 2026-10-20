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
// On by default where WebGL2 works; the 2.5D Canvas path is the fallback.
// Opt-out: ?world3d=0 (persisted, page reloads on toggle) or ConquerWorld3D.setEnabled(false).
(()=>{
  const STORE_KEY='conquer.world3d.v2';
  const fromUrl=(()=>{try{const v=new URLSearchParams(location.search).get('world3d');return v===null?null:v!=='0'}catch{return null}})();
  const forcedCanvas=(()=>{try{return new URLSearchParams(location.search).get('renderer')==='canvas2d'}catch{return false}})();
  let enabled=!forcedCanvas&&(fromUrl??(()=>{try{return localStorage.getItem(STORE_KEY)!=='0'}catch{return true}})());
  // Branch-local A/B: ?nightlight=0 keeps the same WebGL2 world, but uses old Canvas lights.
  let useGpuNightLights=(()=>{try{return new URLSearchParams(location.search).get('nightlight')!=='0'}catch{return true}})();
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
    // Window emissive decals are anchored on the actual 3D facades, sharing the masonry depth buffer.
    light:[`#version 300 es
      ${CAMERA}
      in vec3 aPos;in vec2 aUV;in vec4 aCol;out vec2 vUV;out vec4 vCol;
      void main(){gl_Position=cam(aPos,vec2(0.0));vUV=aUV;vCol=aCol;}`,
      `#version 300 es
      precision mediump float;in vec2 vUV;in vec4 vCol;uniform sampler2D uAtlas;uniform float uNight;out vec4 o;
      void main(){vec4 tex=texture(uAtlas,vUV);float a=tex.a*vCol.a*uNight;
        if(a<0.003)discard;o=vec4(tex.rgb*vCol.rgb*vCol.a*uNight,a);}`],
    // A radial light halo is a camera-facing billboard with a world-space anchor and real depth.
    fireLight:[`#version 300 es
      ${CAMERA}
      in vec3 aAnchor;in vec2 aCorner;in float aSize;in vec2 aUV;in float aSeed;
      out vec2 vUV;out float vSeed;
      void main(){gl_Position=cam(aAnchor,aCorner*aSize*uS);vUV=aUV;vSeed=aSeed;}`,
      `#version 300 es
      precision mediump float;in vec2 vUV;in float vSeed;uniform sampler2D uAtlas;
      uniform float uNight;uniform float uTime;out vec4 o;
      void main(){vec4 tex=texture(uAtlas,vUV);
        float flicker=clamp(0.86+0.09*sin(uTime*31.0+vSeed*6.283185)
          +0.04*sin(uTime*53.0+vSeed*9.0),0.6,1.0);
        float a=tex.a*uNight*flicker*0.8;
        if(a<0.003)discard;o=vec4(tex.rgb*vec3(1.0,0.54,0.22)*uNight*flicker*0.8,a);}`],
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
  function rgb(hex,usePalette=false){
    // Preserve terrain and elevation tones when the architectural palette changes.
    const color=usePalette?visualPaletteColor(hex):hex;
    let v=rgbCache.get(color);if(v)return v;
    const h=String(color).replace('#','');v=[0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255);rgbCache.set(color,v);return v;
  }
  function meshBuilder(usePalette=false){
    const tris=[];
    const api={
      tris,
      face(vs,hex){                       // vs: [{x,y,z}] convex
        const c=rgb(hex,usePalette);
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
    // Hills crossing the map edge are cut at the world square, like the 2.5D relief
    // (clipTerrainPolygon), instead of spilling past the map.
    const clipped=tri=>{
      const poly=clipTerrainPolygon(tri);
      for(let i=1;i<poly.length-1;i++)for(const p of [poly[0],poly[i],poly[i+1]])push(p.x,p.y,p.z);
    };
    const W=WORLD;
    const terraformEdits=window.ConquerTerraforming?.edits?.()||State.relief?.terraforming||[];
    if(terraformEdits.length){
      const terraces=terraformEdits.filter(e=>e.mode==='walled');
      // Cut the ground exactly at terrace edges. Sampling a height discontinuity
      // would create diagonal triangles instead of a vertical masonry wall.
      const halfPlane=(poly,a,b,inside)=>{
        const result=[],side=p=>(b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x);
        for(let i=0;i<poly.length;i++){
          const p=poly[i],q=poly[(i+1)%poly.length],dp=side(p),dq=side(q);
          const pin=inside?dp>=0:dp<=0,qin=inside?dq>=0:dq<=0;
          if(pin)result.push(p);
          if(pin!==qin){const t=dp/(dp-dq);result.push({x:p.x+(q.x-p.x)*t,y:p.y+(q.y-p.y)*t,z:p.z+(q.z-p.z)*t})}
        }
        return result;
      };
      const emit=poly=>{for(let i=1;i<poly.length-1;i++)for(const p of [poly[0],poly[i],poly[i+1]])push(p.x,p.y,p.z)};
      const ground=tri=>{
        let pieces=[tri];
        for(const edit of terraces){
          if(tri.every(p=>p.x<edit.center.x-edit.radius)||tri.every(p=>p.x>edit.center.x+edit.radius)||
             tri.every(p=>p.y<edit.center.y-edit.radius)||tri.every(p=>p.y>edit.center.y+edit.radius))continue;
          const next=[];
          for(const piece of pieces){
            let inner=piece;
            for(let i=0;i<edit.top.length&&inner.length>=3;i++){
              const a=edit.top[i],b=edit.top[(i+1)%edit.top.length];
              const outside=halfPlane(inner,a,b,false);
              if(outside.length>=3)next.push(outside);
              inner=halfPlane(inner,a,b,true);
            }
          }
          pieces=next;
        }
        pieces.forEach(emit);
      };
      // Once the player edits elevation, sample the single authoritative terrainElevation
      // contract. A denser build-area grid preserves terrace and excavation silhouettes;
      // the untouched world buffer stays coarse to limit upload cost.
      const grid=(x0,y0,x1,y1,step)=>{
        for(let y=y0;y<y1-1e-6;y+=step)for(let x=x0;x<x1-1e-6;x+=step){
          const xa=Math.min(x1,x+step),ya=Math.min(y1,y+step);
          const p00={x,y},p10={x:xa,y},p11={x:xa,y:ya},p01={x,y:ya};
          for(const p of [p00,p10,p11,p01])p.z=window.ConquerTerraforming.elevationAt(p,terrainBaseElevation(p),{excludeWalled:true});
          ground([p00,p10,p11]);ground([p00,p11,p01]);
        }
      };
      grid(0,0,W,BUILD_MIN,2);
      grid(0,BUILD_MAX,W,W,2);
      grid(0,BUILD_MIN,BUILD_MIN,BUILD_MAX,2);
      grid(BUILD_MAX,BUILD_MIN,W,BUILD_MAX,2);
      grid(BUILD_MIN,BUILD_MIN,BUILD_MAX,BUILD_MAX,.5);
      for(const edit of terraces)emit(edit.top.map(p=>({...p,z:edit.targetZ})));
      return new Float32Array(v);
    }
    for(const [x,y] of [[0,0],[W,0],[W,W],[0,0],[W,W],[0,W]])push(x,y,0);
    for(const level of reliefLevels()){
      const top=level.top||[];if(top.length<3)continue;
      const tri=earcut(top);
      for(let i=0;i<tri.length;i+=3)clipped([tri[i],tri[i+1],tri[i+2]].map(k=>({x:top[k].x,y:top[k].y,z:level.z1})));
      for(const band of reliefEdgeBands(level)){
        const [oa,ob,b,a]=band.poly;
        clipped([{...oa,z:band.z0},{...ob,z:band.z0},{...b,z:band.z1}]);
        clipped([{...oa,z:band.z0},{...b,z:band.z1},{...a,z:band.z1}]);
      }
    }
    return new Float32Array(v);
  }
  // Mountains as raised fans (drawRaisedFan): outline on the ground, apex 3.6U over the centre,
  // faces alternating the same two tones. The ground bake only shows them from above.
  const MOUNTAIN_HEIGHT=3.6,MOUNTAIN_FACES=['#55493d','#66584a'];
  function buildMountains(){
    const m=meshBuilder();
    for(const f of State.environment||[]){
      if(f.type!=='mountain'||!(f.points?.length>=3))continue;
      const apex={x:f.x,y:f.y,z:f.height||MOUNTAIN_HEIGHT};
      // Rock up to the snow line (75% of the height), snow cap above it.
      // Map-wide snow line (75% of the tallest summit): lower peaks may stay bare.
      const k=typeof mountainSnowZ==='function'?Math.min(1,mountainSnowZ()/apex.z):1,s=p=>({x:f.x+(p.x-f.x)*(1-k),y:f.y+(p.y-f.y)*(1-k),z:apex.z*k});
      for(let i=0;i<f.points.length;i++){
        const a=f.points[i],b=f.points[(i+1)%f.points.length];
        const rock=typeof mountainFaceColor==='function'?mountainFaceColor(f,a,b,i):MOUNTAIN_FACES[i%2];
        m.face([{x:a.x,y:a.y,z:0},{x:b.x,y:b.y,z:0},s(b),s(a)],rock);
        if(k<1)m.face([s(a),s(b),apex],mountainSnowColor(f,a,b,i));
      }
    }
    return new Float32Array(m.tris);
  }
  // Vertical cross-section closing hills where the map edge cuts them: follows the terrain
  // height along each border so the section meets the clipped surface.
  const EDGE_STEP=.1,EDGE_SECTION=['#5d5144','#4e443a'];
  function buildTerrainEdges(){
    const m=meshBuilder(),W=WORLD,n=Math.round(W/EDGE_STEP);
    for(const edit of window.ConquerTerraforming?.edits?.()||[]){
      if(edit.mode!=='walled')continue;
      for(let i=0;i<edit.top.length;i++){
        const a=edit.top[i],b=edit.top[(i+1)%edit.top.length];
        m.face([{...a,z:edit.baseZ},{...b,z:edit.baseZ},{...b,z:edit.targetZ},{...a,z:edit.targetZ}],i%2?'#49443f':'#686057');
      }
    }
    const borders=[t=>({x:t,y:0}),t=>({x:W,y:t}),t=>({x:W-t,y:W}),t=>({x:0,y:W-t})];
    borders.forEach((at,side)=>{
      let prev=at(0),hp=terrainElevation(prev);
      for(let i=1;i<=n;i++){
        const p=at(i*EDGE_STEP),h=terrainElevation(p);
        if(hp>.001||h>.001)m.face([{...prev,z:0},{...p,z:0},{...p,z:h},{...prev,z:hp}],EDGE_SECTION[side%2]);
        prev=p;hp=h;
      }
    });
    return new Float32Array(m.tris);
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
    const m=meshBuilder(true),winter=State.season==='winter';
    // Houses: urbanHouseFaces gives walls, then either 2 slopes + 2 gables or a turret cone.
    for(const entry of urbanHouseGeometry()){
      const house=entry.house;if(underConstruction(house))continue;
      withStructureVisualMaterial(house,()=>{
      const lvl=houseLevel(house);
      for(const part of entry.parts){
        if(part.kind==='outbuilding'){addOutbuilding(m,house,part,winter);continue}
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
          const rA=winter?WINTER_ROOF[0]:lvl===1?HOUSE_THATCH.a:'#303237',rB=winter?WINTER_ROOF[1]:lvl===1?HOUSE_THATCH.b:'#3a3d42';
          const gable=lvl===1?'#654936':'#d9c184';
          m.face(roof(faces[n]),rA);m.face(roof(faces[n+1]),rB);m.face(roof(faces[n+2]),gable);m.face(roof(faces[n+3]),gable);
        }
      }
      for(const c of chimneySpecs(house)){
        const g=terrainElevation(c.center);
        m.prism(rectWorldPoints(c.center.x,c.center.y,.22,.20,c.angle||0),g+c.z0,g+c.z1,'#3b302c','#332824','#493732');
      }
      });
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
      if(isCivic(s))withStructureVisualMaterial(s,()=>addCivic(m,s,winter));
      else if(isCivicAnnex(s))withStructureVisualMaterial(s,()=>addCivicAnnex(m,s,winter));
      else if(window.ConquerIndustries?.is(s)){
        const def=ConquerIndustries.definition(s),g=Number.isFinite(s.groundZ)?s.groundZ:ConquerIndustries.groundLevel(s);
        if(!window.ConquerIndustries3D?.addToBuilder(m,s,g))m.prism(ConquerIndustries.footprint(s),g,g+.35,def.color,def.edge,def.edge);
      }else if(s.type==='well')withStructureVisualMaterial(s,()=>{
        const g=terrainElevation(s);
        m.prism(rectWorldPoints(s.x,s.y,WELL_PLAZA_SIZE,WELL_PLAZA_SIZE,0),g,g+.055,'#8d816e','#655b4f','#74695a');
        m.prism(circleWorldPoints(s.x,s.y,.62,20),g+.055,g+.42,'#84796d','#4e4740','#5d554d');
        m.face(circleWorldPoints(s.x,s.y,.36,16).map(p=>({x:p.x,y:p.y,z:g+.425})),'#172023');
      });
    }
    return new Float32Array(m.tris);
  }
  // L3/L4 yard outbuildings (urbanLotOutbuildings), same palette as drawUrbanOutbuilding.
  function addOutbuilding(m,house,part,winter){
    const faces=urbanHouseFaces(house,part),n=part.points.length,P=f=>f.map(({p,z})=>({x:p.x,y:p.y,z}));
    const roofA=winter?WINTER_ROOF[0]:'#5b3d30',roofB=winter?WINTER_ROOF[1]:'#6b4938';
    if(part.type==='store'){
      for(let i=0;i<n;i++)m.face(P(faces[i]),i%2?'#5d4431':'#71543c');
      m.face(P(faces[n]),roofA);m.face(P(faces[n+1]),roofB);m.face(P(faces[n+2]),'#6b4f39');m.face(P(faces[n+3]),'#6b4f39');
      return;
    }
    const c=part.center,sa=Math.sin(part.roofAngle),ca=Math.cos(part.roofAngle),base=terrainElevation(c);
    const ly=p=>-(p.x-c.x)*sa+(p.y-c.y)*ca;
    for(let i=0;i<n;i++)if(faces[i].slice(0,2).every(v=>Math.abs(ly(v.p)+part.h/2)<1e-6))m.face(P(faces[i]),'#5d4431');
    m.face(P(faces[n]),roofB);
    for(const t of part.w>1.3?[-.5,0,.5]:[-.5,.5]){
      const x=t*(part.w-.08),y=part.h/2-.04,p={x:c.x+x*ca-y*sa,y:c.y+x*sa+y*ca};
      m.prism(rectWorldPoints(p.x,p.y,.07,.07,part.roofAngle),base,base+part.bodyH,'#4a3626','#3d2c1f','#4a3626');
    }
  }
  function addCivicAnnex(m,s,winter){
    const spec=civicAnnexDefinition(s);if(!spec)return;
    const g=Number.isFinite(s.groundZ)?s.groundZ:terrainElevation(s),kind=spec.kind,poly=civicAnnexFootprint(s);
    if(window.ConquerCivic3D?.addToBuilder(m,s,g))return;
    const height=kind==='garden'?.13:kind==='yard'?.09:kind==='stall'?.75:1.32;
    const color=kind==='garden'?'#6a8452':kind==='yard'?'#ad9a7a':kind==='stone'?'#85847d':'#9b7c57';
    m.prism(poly,g,g+height,color,kind==='stone'?'#696862':'#79563b',kind==='stone'?'#777671':'#876446');
    if(kind==='garden'){
      for(const offset of [-.45,0,.45]){
        const p=houseLocalToWorld(s,offset,0);
        m.prism(rectWorldPoints(p.x,p.y,.08,1.4,s.angle||0),g+.13,g+.19,'#426738','#385d30','#426738');
      }
    }else if(kind!=='yard'&&kind!=='stall'){
      const roof=winter?WINTER_ROOF[0]:kind==='stone'?'#595a60':'#694a38';
      m.gabled({x:s.x,y:s.y},spec.w,spec.h,0,s.angle||0,g+height,.001,.34,color,color,roof,roof,color);
    }
  }
  function addCivic(m,s,winter){
    const g=Number.isFinite(placementGroundZ(s))?placementGroundZ(s):terrainElevation(s),angle=s.angle||0;
    const L=(x,y)=>houseLocalToWorld(s,x,y);
    if(window.ConquerCivic3D?.addToBuilder(m,s,g))return;   // Blender model (+ cemetery)
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
      }else if(s.type==='plaza'){
        const level=civicLevel(s),variant=plazaVariant(s);
        m.prism(part.points,g,g+.10,
          variant==='garden'?'#8c9776':variant==='fountain'?'#a5a9a8':'#b3a28e',
          '#777269','#868076');
        if(variant==='garden'){
          for(const x of [-1.08,1.08])for(const y of [-1.08,1.08]){
            const c=L(x,y);
            m.prism(rectWorldPoints(c.x,c.y,1.15,1.15,angle),g+.10,g+.15,'#698555','#80725b','#80725b');
          }
        }else{
          const c=L(0,0),size=variant==='fountain'?1.45:1.25;
          m.prism(rectWorldPoints(c.x,c.y,size,size,angle),g+.10,g+(variant==='fountain'?.29:.135),
            variant==='fountain'?'#697e82':'#c2b7a4','#787c7b','#8c9190');
          if(variant==='fountain')m.prism(rectWorldPoints(c.x,c.y,.65,.65,angle),g+.29,g+.35+level*.12,
            '#b3b8b5','#858c89','#969e9b');
          else if(level>=3)m.prism(rectWorldPoints(c.x,c.y,.45,.45,angle),g+.135,g+.60,
            '#c0b7a9','#827b72','#938a80');
        }
        if(level>=2)for(const x of [-2,2])for(const y of [-2,2]){
          const c=L(x,y);
          m.prism(rectWorldPoints(c.x,c.y,.24,.24,angle),g+.10,g+.27,'#a49c8c','#696659','#777164');
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
    if(s.type==='church')addCivicCemetery(m,s,g);
  }
  function addCivicCemetery(m,church,ground){
    const area=civicCemeteryArea(church);if(!area)return;
    m.prism(area.points,ground,ground+.035,'#827b69','#665e51','#756d5d');
    for(const grave of civicCemeteryGraves(church)){
      m.prism(grave.points,ground+.035,ground+.08,'#675c4f','#4b443c','#5b5146');
      const head=houseLocalToWorld({x:grave.center.x,y:grave.center.y,angle:grave.angle},0,-.23);
      m.prism(rectWorldPoints(head.x,head.y,.25,.14,grave.angle),
        ground+.08,ground+.39,'#b5b1a6','#78766f','#96928b');
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
    // Mountain pines (96x128 canvases), two tones.
    if(typeof mountainPineSprite==='function')for(const v of [0,1])tiles.push({key:'pine:'+v,img:mountainPineSprite(v,season==='winter'),aspect:1,pine:true});
    const rows=Math.ceil(tiles.length/ATLAS_COLS)||1,c=document.createElement('canvas');
    c.width=ATLAS_COLS*ATLAS_TILE;c.height=rows*ATLAS_TILE;const g=c.getContext('2d'),map=new Map();
    tiles.forEach((t,i)=>{const x=(i%ATLAS_COLS)*ATLAS_TILE,y=Math.floor(i/ATLAS_COLS)*ATLAS_TILE,h=Math.round(ATLAS_TILE*t.aspect);
      // Pines keep their 3:4 shape centred in the square tile.
      if(t.pine)g.drawImage(t.img,x+ATLAS_TILE*.125,y,ATLAS_TILE*.75,h);else g.drawImage(t.img,x,y,ATLAS_TILE,h);
      map.set(t.key,[x/c.width,y/c.height,(x+ATLAS_TILE)/c.width,(y+h)/c.height])});
    return{canvas:c,map,season};
  }
  function buildTrees(atlas){
    const v=[];if(!atlas)return new Float32Array(0);
    const groves=(State.environment||[]).filter(f=>f.type==='forest').map(forestTreeLayout);
    groves.push(urbanLotCornerTrees());                  // single trees on plot corners
    for(const trees of groves){
      for(const t of trees){
        const uv=atlas.map.get(t.shapeIndex+':'+(atlas.season==='winter'?0:t.colorIndex));if(!uv)continue;
        let [u0,v0,u1,v1]=uv;if(t.flip)[u0,u1]=[u1,u0];
        const size=2.25*t.scale,z=t.z||0;
        const C=[[-.5,-.94,u0,v0],[.5,-.94,u1,v0],[.5,.06,u1,v1],[-.5,.06,u0,v1]];
        for(const k of [0,1,2,0,2,3]){const [cx,cy,u,w]=C[k];v.push(t.p.x,t.p.y,z,cx,cy,size,u,w)}
      }
    }
    // Pines on the lower half of the mountains, standing on the cone surface.
    for(const f of State.environment||[]){
      if(f.type!=='mountain'||!f.height||typeof mountainPineLayout!=='function')continue;
      for(const t of mountainPineLayout(f)){
        const uv=atlas.map.get('pine:'+t.shade);if(!uv)continue;
        let [u0,v0,u1,v1]=uv;if(t.flip)[u0,u1]=[u1,u0];
        const size=2.4*t.scale,C=[[-.5,-.97,u0,v0],[.5,-.97,u1,v0],[.5,.03,u1,v1],[-.5,.03,u0,v1]];
        for(const k of [0,1,2,0,2,3]){const [cx,cy,u,w]=C[k];v.push(t.p.x,t.p.y,t.z,cx,cy,size,u,w)}
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
  const DECAL_KEYS=['gatePortal','towerDoor','arrowSlit','gothicL1','gothicL2','gothicL3','arcade2','arcade3','gatePortalDamaged','gatePortalBroken'];
  function buildDecalAtlas(){
    const T=256,cols=4,c=document.createElement('canvas');c.width=cols*T;c.height=3*T;
    const g=c.getContext('2d'),map=new Map();
    const tiles=[...DECAL_KEYS,'__white','__glow'];
    tiles.forEach((k,i)=>{
      const x=(i%cols)*T,y=Math.floor(i/cols)*T;
      if(k==='__white'){g.fillStyle='#fff';g.fillRect(x,y,16,16);map.set(k,[(x+4)/c.width,(y+4)/c.height,(x+12)/c.width,(y+12)/c.height]);return}
      if(k==='__glow'){
        const radial=g.createRadialGradient(x+T/2,y+T/2,0,x+T/2,y+T/2,T/2-2);
        radial.addColorStop(0,'rgba(255,239,190,0.90)');
        radial.addColorStop(.22,'rgba(255,194,103,0.56)');
        radial.addColorStop(.58,'rgba(255,141,55,0.15)');
        radial.addColorStop(1,'rgba(255,141,55,0)');
        g.fillStyle=radial;g.fillRect(x+1,y+1,T-2,T-2);
        map.set(k,[(x+1)/c.width,(y+1)/c.height,(x+T-1)/c.width,(y+T-1)/c.height]);return;
      }
      const img=architectureSprite(k);if(!img)return;
      g.drawImage(img,x,y);map.set(k,[x/c.width,y/c.height,(x+img.width)/c.width,(y+img.height)/c.height]);
    });
    return{canvas:c,map};
  }
  function buildDecals(atlas){
    const v=[],lights=[],WHITE=[1,1,1,1];
    const quad=(a,b,z0,z1,key,out,col=WHITE,push=.012,dest=v)=>{
      const uv=atlas.map.get(key);if(!uv)return;
      const [u0,v0,u1,v1]=uv,A={x:a.x+out.x*push,y:a.y+out.y*push},B={x:b.x+out.x*push,y:b.y+out.y*push};
      const P=[[A,z1,u0,v0],[B,z1,u1,v0],[B,z0,u1,v1],[A,z0,u0,v1]];
      for(const k of [0,1,2,0,2,3]){const [p,z,u,w]=P[k];dest.push(p.x,p.y,z,u,w,col[0],col[1],col[2],col[3])}
    };
    const outward=(edge,c)=>{
      const dx=edge.b.x-edge.a.x,dy=edge.b.y-edge.a.y,L=Math.hypot(dx,dy)||1;let nx=-dy/L,ny=dx/L;
      const mx=(edge.a.x+edge.b.x)/2-c.x,my=(edge.a.y+edge.b.y)/2-c.y;if(nx*mx+ny*my<0){nx=-nx;ny=-ny}
      return{x:nx,y:ny};
    };
    // These emissive panes and soft halos are generated only when facade geometry changes.
    // Intensity is a uniform: sunset/sunrise never recreate their buffers.
    const lightWindow=(edge,centerZ,width,height,offset,ground,out)=>{
      const halo=facadeAssetWorldSpan(edge,width*3.4,offset);
      quad(halo.a,halo.b,ground+centerZ-height*1.7,ground+centerZ+height*1.7,
        '__glow',out,[1,.67,.32,.33],.032,lights);
      const glass=facadeAssetWorldSpan(edge,width*.8,offset);
      quad(glass.a,glass.b,ground+centerZ-height*.4,ground+centerZ+height*.4,
        '__white',out,[1,.77,.38,.77],.027,lights);
    };
    const onEdge=(edge,centerZ,width,height,key,offset,ground,out)=>{
      const span=facadeAssetWorldSpan(edge,width,offset);
      quad(span.a,span.b,ground+centerZ-height/2,ground+centerZ+height/2,key,out);
      if(key.startsWith('gothic'))lightWindow(edge,centerZ,width,height,offset,ground,out);
    };
    const edgesOf=fp=>fp.map((a,i)=>({a,b:fp[(i+1)%fp.length],index:i}));
    // A beam from wall point p0 to p1 ({off,z}), `width` thick within the wall plane.
    const strip=(at,ground,p0,p1,width,out,col,push)=>{
      const uv=atlas.map.get('__white');if(!uv)return;
      const doff=p1.off-p0.off,dz=p1.z-p0.z,len=Math.hypot(doff,dz)||1,no=-dz/len*width/2,nz=doff/len*width/2;
      const corner=(p,s)=>{const c=at(p.off+no*s);return{x:c.x+out.x*push,y:c.y+out.y*push,z:ground+p.z+nz*s}};
      const P=[corner(p0,1),corner(p1,1),corner(p1,-1),corner(p0,-1)],[u0,v0,u1,v1]=uv;
      for(const k of [0,1,2,0,2,3]){const q=P[k];v.push(q.x,q.y,q.z,k===1||k===2?u1:u0,k<2?v0:v1,col[0],col[1],col[2],col[3])}
    };
    const houseGeometry=new Map(urbanHouseGeometry().map(e=>[e.house.id,e]));
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
          // front / rear; the door shows its state (cracked, broken in: settlement-siege.js)
          if(edge.index===1||edge.index===3)onEdge(edge,.705,.90,1.35,window.ConquerSiege?.doorAsset?.(s)||'gatePortal',0,ground,o);
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
        if(builtSkin(s)==='arcade'){                                            // drawBuiltArcade, interior facade
          const edge=linearFacadeEdge(s,inside),h=Math.min(1.46,structureHeight(s)-.16);
          if(h>.18&&edge.length>=.35){
            const count=Math.max(1,Math.round(edge.length/2.55)),cell=edge.length/count,centerZ=.04+h/2,key=cell<2.25?'arcade2':'arcade3';
            const ground=terrainElevation({x:(edge.a.x+edge.b.x)/2,y:(edge.a.y+edge.b.y)/2}),o=outward(edge,center),DARK=[36/255,33/255,31/255,1];
            for(let i=0;i<count;i++){
              const off=(i+.5)*cell-edge.length/2,w=cell*.96,span=facadeAssetWorldSpan(edge,w,off);
              quad(span.a,span.b,ground+centerZ-h*.43,ground+centerZ+h*.43,'__white',o,DARK,.008);   // drawFacadeAssetBackdrop
              onEdge(edge,centerZ,w,h,key,off,ground,o);
            }
          }
        }
      }else if(s.type==='house'){
        const WIN=[35/255*.82,29/255*.82,24/255*.82,.82],TIMBER=[59/255,42/255,30/255,1];
        const entry=houseGeometry.get(s.id);
        for(const part of entry?.parts||[]){
          if(part.kind==='turret'||part.kind==='outbuilding')continue;
          const ground=terrainElevation(part.center);
          for(const edge of edgesOf(part.points)){
            const o=outward(edge,part.center),m={x:(edge.a.x+edge.b.x)/2,y:(edge.a.y+edge.b.y)/2};
            const dx=edge.b.x-edge.a.x,dy=edge.b.y-edge.a.y,L=Math.hypot(dx,dy)||1,ux=dx/L,uy=dy/L,hw=HOUSE_WINDOW_HALF_W,hh=HOUSE_WINDOW_HALF_H;
            const plan=houseFacadePlan(s,part,edge),at=off=>({x:m.x+ux*off,y:m.y+uy*off});
            // Timber frame strips sit just under the windows (smaller wall offset).
            for(const [p0,p1] of plan.beams)strip(at,ground,p0,p1,HOUSE_TIMBER_W,o,TIMBER,.009);
            // drawWindowOnEdge: 2.1 x 3.25 px per view-scale unit -> .175U x ~.30U
            for(const w of plan.windows){
              const c=at(w.off);
              quad({x:c.x-ux*hw,y:c.y-uy*hw},{x:c.x+ux*hw,y:c.y+uy*hw},ground+w.z-hh,ground+w.z+hh,'__white',o,WIN);
              lightWindow(edge,w.z,hw*2,hh*2,w.off,ground,o);
            }
          }
        }
        const d=houseDoorInfo(s),hw=Math.min(.08,(Number(s.w)||1.5)*.0533),g=terrainElevation(d.surface),DOOR=[57/255,39/255,30/255,1];
        quad({x:d.surface.x-d.tangent.x*hw,y:d.surface.y-d.tangent.y*hw},{x:d.surface.x+d.tangent.x*hw,y:d.surface.y+d.tangent.y*hw},g+.04,g+.552,'__white',d.normal,DOOR);
      }
    }
    return{decals:new Float32Array(v),lights:new Float32Array(lights)};
  }
  // All world-space torch anchors are camera-independent: depth testing, not
  // towerDoorVisible(), decides which flames are hidden behind a tower.
  function allWorldFireSources(){
    const sources=battlementBrazierSources();
    for(const tower of State.structures){
      if(tower.type!=='tower'||underConstruction(tower))continue;
      for(const spec of towerDoorSpecs(tower)){
        if(spec.kind!=='front')continue;
        const doorTop=spec.baseZ+Math.max(.18,spec.apexZ-spec.baseZ)/3;
        for(const side of [-1,1]){
          sources.push({
            kind:'torch',id:tower.id+':torch:'+side,
            p:{
              x:spec.contact.x+spec.tangent.x*.18*side+spec.outward.x*.035,
              y:spec.contact.y+spec.tangent.y*.18*side+spec.outward.y*.035
            },
            z:doorTop+.10,groundZ:placementGroundZ(tower)
          });
        }
      }
    }
    return sources;
  }
  function buildFireLights(atlas){
    const uv=atlas.map.get('__glow'),v=[];if(!uv)return new Float32Array(v);
    const [u0,v0,u1,v1]=uv;
    for(const src of allWorldFireSources()){
      const ground=Number.isFinite(src.groundZ)?src.groundZ:terrainElevation(src.p);
      const z=ground+src.z+(src.kind==='brazier'?.08:0);
      const size=src.kind==='brazier'?2:1.5;
      const seed=(peasantHash(String(src.id)+'-fire')%1000)/1000;
      const corners=[[-.5,-.5,u0,v0],[.5,-.5,u1,v0],[.5,.5,u1,v1],[-.5,.5,u0,v1]];
      for(const i of [0,1,2,0,2,3]){
        const q=corners[i];v.push(src.p.x,src.p.y,z,q[0],q[1],size,q[2],q[3],seed);
      }
    }
    return new Float32Array(v);
  }

  // ---------- shadows ----------
  function buildShadows(){
    const sun=sunShadowState();if(!sun)return{data:new Float32Array(0),alpha:0};
    const v=[];
    for(const s of State.structures){
      if(underConstruction(s)||!['house','tower','gate','wall','palisade','built','market','tavern','church','plaza','civicAnnex'].includes(s.type))continue;
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
  // One pass per check: each structure is hashed once and folded into the categories it belongs to.
  // Category tests look at fields only (no terrain sampling), so this stays well under a millisecond.
  let sigPass=null;
  function computeSigPass(){
    const acc=new Map();
    for(const s of State.structures){
      const str=s.id+(underConstruction(s)?'u':'c')+(s.level||'')+(s.houseLevel||'')+(s.x??s.a?.x??'')+(s.y??s.a?.y??'')+(s.b?.x??'')+(s.b?.y??'')+(s.angle||0)+(s.roofStyle||'')+(s.baseStyle||'')+(s.skin||'')+(s.masonryMaterial||'stone')+(s.cutaway?1:0)+(s.width||'')+(s.groundZ??'')+(s.aSnap||'')+(s.bSnap||'')+(s.flip?1:0)
        // Moat fill patches are baked into the ground: filling must re-bake it.
        +(s.fills?.length?s.fills.map(f=>(+f.at).toFixed(2)+':'+f.span+':'+(+f.progress).toFixed(3)).join(','):'')
        // The gate door's state swaps its facade decal.
        +(s.type==='gate'?(window.ConquerSiege?.doorStage?.(s)||''):'')+(s.brokenTop?'B':'');
      let h=0;for(let i=0;i<str.length;i++)h=(Math.imul(h,31)+str.charCodeAt(i))|0;
      for(const cat of SIG_CATEGORIES)if(cat.test(s))acc.set(cat.name,(Math.imul(acc.get(cat.name)||0,33)^h)|0);
    }
    sigPass=acc;
  }
  const SIG_CATEGORIES=[
    {name:'ground',test:s=>s.type==='road'||s.type==='field'||s.type==='house'||s.type==='moat'||s.type==='bridge'||s.type==='palisade'},
    {name:'buildings',test:s=>s.type==='house'||s.type==='field'||s.type==='well'||CIVIC_TYPES.includes(s.type)||!!window.ConquerIndustries?.TYPES?.[s.type]},
    {name:'castle',test:s=>!s.auto&&['tower','gate','wall','built'].includes(s.type)},
    {name:'hedges',test:s=>s.type==='house'||s.type==='field'},
    {name:'all',test:()=>true}
  ];
  function structuresSig(name){return sigPass?.get(name)||0}
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
    S.contentDirty=false;S.lastUrbanRev=urbanRev();computeSigPass();
    const t0=performance.now(),st=S.stats;
    const season=State.season||'summer',rot=State.view.rotation||0,plan=isPlanView();
    // envRev: main roads cut grooves into a continuous woodland in place.
    const envRev=typeof environmentRevision!=='undefined'?environmentRevision:0;
    const terraformEdits=window.ConquerTerraforming?.edits?.()||State.relief?.terraforming||[];
    const terraformSig=terraformEdits.map(e=>[e.id,e.targetZ,e.radius,e.edgeWidth,e.mode,e.material].join(':')).join(',');
    const tSig=[season,State.biome,State.relief?.seed,terraformSig,(State.environment||[]).length,envRev,wet(),urbanRev(),structuresSig('ground')].join('|');
    if(S.sig.terrain!==tSig){
      const a=performance.now();
      upload(gl,'terrain',buildTerrain());upload(gl,'mountains',buildMountains());upload(gl,'terrainEdges',buildTerrainEdges());
      uploadTexture(gl,'world',bakeGround(0,0,WORLD));
      uploadTexture(gl,'detail',bakeGround(DETAIL.x0,DETAIL.y0,DETAIL.size));
      S.sig.terrain=tSig;st.groundBakeMs=performance.now()-a;
    }
    const bSig=[season,State.visualPalette,urbanRev(),structuresSig('buildings')].join('|');
    if(S.sig.buildings!==bSig){const a=performance.now();upload(gl,'buildings',buildBuildings());S.sig.buildings=bSig;st.buildingsMs=performance.now()-a}
    // Castle side tones and the near/far battlement split depend on the quarter-turn: keep one mesh set
    // per rotation/plan variant so turning the camera back and forth never rebuilds.
    const castleContent=[season,State.visualPalette,structuresSig('castle')].join('|');
    if(S.castleContent!==castleContent){
      for(const v of S.castleVariants?.values()||[])for(const p of Object.values(v))gl.deleteBuffer(p.b);
      S.castleContent=castleContent;S.castleVariants=new Map();
    }
    const cSig=castleContent+'|'+rot+'|'+plan;
    if(S.sig.castle!==cSig&&window.ConquerCastle3D?.worldMeshes){
      const a=performance.now(),key=rot+'|'+plan;
      let v=S.castleVariants.get(key);
      if(!v){
        const cm=ConquerCastle3D.worldMeshes(),mk=d=>{const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,d,gl.STATIC_DRAW);return{b,n:d.length}};
        v={body:mk(new Float32Array(cm.body)),lines:mk(new Float32Array(cm.body.lines||[])),front:mk(new Float32Array(cm.front)),frontLines:mk(new Float32Array(cm.front.lines||[]))};
        S.castleVariants.set(key,v);
      }
      for(const [name,part] of [['castleBody','body'],['castleLines','lines'],['castleFront','front'],['castleFrontLines','frontLines']]){S.buf[name]=v[part].b;S.buf[name+'#n']=v[part].n}
      S.sig.castle=cSig;st.castleMs=performance.now()-a;
    }
    const treeSig=[season,forestTreeSpritesReady,(State.environment||[]).length,envRev,State.seed,urbanRev(),structuresSig('hedges'),
      Object.keys((typeof boundaryBushSprites!=='undefined'&&boundaryBushSprites[season])||{}).length].join('|');
    if(S.sig.trees!==treeSig){
      const a=performance.now(),atlas=buildTreeAtlas();
      if(atlas)uploadTexture(gl,'atlas',atlas.canvas);
      upload(gl,'trees',buildTrees(atlas));S.sig.trees=treeSig;st.treesMs=performance.now()-a;
    }
    const dSig=[structuresSig('all'),Object.keys(architectureSprites).length].join('|');
    if(S.sig.decals!==dSig){
      const a=performance.now(),atlas=buildDecalAtlas();uploadTexture(gl,'decalAtlas',atlas.canvas);
      const baked=buildDecals(atlas);
      upload(gl,'decals',baked.decals);
      upload(gl,'nightWindows',baked.lights);
      upload(gl,'fireLights',buildFireLights(atlas));
      S.sig.decals=dSig;st.decalsMs=performance.now()-a;
    }
    // Environmental scatter (settlement-scatter.js): the layout follows content, the two-tone
    // side shading follows the camera quarter-turn, so keep one buffer per rotation.
    if(window.ConquerScatter&&window.ConquerScatterModel){
      const scContent=[season,State.seed,State.relief?.seed,(State.environment||[]).length,urbanRev(),structuresSig('all')].join('|');
      if(S.scatterContent!==scContent){
        const a=performance.now();
        for(const v of S.scatterVariants?.values()||[])gl.deleteBuffer(v.b);
        S.scatterContent=scContent;S.scatterVariants=new Map();S.scatterProps=ConquerScatter.layout();
        st.scatterLayoutMs=performance.now()-a;st.scatterProps=S.scatterProps.length;
      }
      let v=S.scatterVariants.get(rot);
      if(!v){
        const a=performance.now(),d=ConquerScatter.worldMesh(S.scatterProps,rot),b=gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,d,gl.STATIC_DRAW);
        v={b,n:d.length};S.scatterVariants.set(rot,v);st.scatterMeshMs=performance.now()-a;
      }
      S.buf.scatter=v.b;S.buf['scatter#n']=v.n;
    }
    const sun=sunShadowState(),sSig=[sun?Math.round(sun.phase*64):'night',S.sig.buildings,S.castleContent].join('|');
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
    drawMesh(gl,r,'mountains');drawMesh(gl,r,'terrainEdges');drawMesh(gl,r,'buildings');drawMesh(gl,r,'scatter');drawMesh(gl,r,'castleBody');
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
  // Light is composited AFTER the Canvas ambient tint, while reusing the 3D
  // back/front depth buffer. Clearing only colour preserves occlusion by masonry and soldiers.
  function renderNightLights(r,nf){
    const gl=S.gl;
    if(!gl||nf<=.01)return;
    gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.depthMask(false);
    gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
    if(S.buf['nightWindows#n']&&S.tex.decalAtlas){
      const pr=S.prog.light;gl.useProgram(pr.p);setCamera(gl,pr,r);
      gl.uniform1f(pr.loc.uNight,nf);
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,S.tex.decalAtlas);gl.uniform1i(pr.loc.uAtlas,0);
      bindAttrib(gl,pr,'aPos',S.buf.nightWindows,3,36,0);
      bindAttrib(gl,pr,'aUV',S.buf.nightWindows,2,36,12);
      bindAttrib(gl,pr,'aCol',S.buf.nightWindows,4,36,20);
      gl.drawArrays(gl.TRIANGLES,0,S.buf['nightWindows#n']/9);
    }
    if(S.buf['fireLights#n']&&S.tex.decalAtlas){
      const pr=S.prog.fireLight;gl.useProgram(pr.p);setCamera(gl,pr,r);
      gl.uniform1f(pr.loc.uNight,nf);gl.uniform1f(pr.loc.uTime,visualCycleDay());
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,S.tex.decalAtlas);gl.uniform1i(pr.loc.uAtlas,0);
      bindAttrib(gl,pr,'aAnchor',S.buf.fireLights,3,36,0);
      bindAttrib(gl,pr,'aCorner',S.buf.fireLights,2,36,12);
      bindAttrib(gl,pr,'aSize',S.buf.fireLights,1,36,20);
      bindAttrib(gl,pr,'aUV',S.buf.fireLights,2,36,24);
      bindAttrib(gl,pr,'aSeed',S.buf.fireLights,1,36,32);
      gl.drawArrays(gl.TRIANGLES,0,S.buf['fireLights#n']/9);
    }
    gl.disable(gl.BLEND);gl.depthMask(true);
  }
  function renderFront(r,soldiers,dynamic){
    // Soldiers and near-half battlements, depth-tested against the back pass (depth kept): masonry in
    // front of a soldier hides it, merlons on the near edge cover the patrol's legs, far ones do not.
    const gl=S.gl;gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);gl.depthMask(true);
    // Moving meshes (siege engines and their loads), uploaded every frame, depth-tested and written
    // so the soldiers sort against them too.
    if(dynamic&&dynamic.length){
      let b=S.buf.dynamic;if(!b){b=gl.createBuffer();S.buf.dynamic=b}
      gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,dynamic,gl.STREAM_DRAW);
      const pr=S.prog.mesh;gl.useProgram(pr.p);setCamera(gl,pr,r);
      bindAttrib(gl,pr,'aPos',b,3,24,0);bindAttrib(gl,pr,'aCol',b,3,24,12);
      gl.drawArrays(gl.TRIANGLES,0,dynamic.length/6);
    }
    if(soldiers.length&&soldierAtlas.canvas){
      if(soldierAtlas.dirty){uploadTexture(gl,'soldierAtlas',soldierAtlas.canvas);soldierAtlas.dirty=false}
      let b=S.buf.soldiers;if(!b){b=gl.createBuffer();S.buf.soldiers=b}
      gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,soldiers,gl.STREAM_DRAW);
      const sp=S.prog.sprite;gl.useProgram(sp.p);setCamera(gl,sp,r);
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,S.tex.soldierAtlas);gl.uniform1i(sp.loc.uAtlas,0);
      bindAttrib(gl,sp,'aAnchor',b,3,32,0);bindAttrib(gl,sp,'aCorner',b,2,32,12);bindAttrib(gl,sp,'aSize',b,1,32,20);bindAttrib(gl,sp,'aUV',b,2,32,24);
      gl.drawArrays(gl.TRIANGLES,0,soldiers.length/8);
    }
    gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(1,1);
    drawMesh(gl,r,'castleFront');gl.disable(gl.POLYGON_OFFSET_FILL);drawMesh(gl,r,'castleFrontLines',gl.LINES);
  }

  // ---------- soldiers: depth-tested billboards + invisible capsule colliders ----------
  // While a 3D frame is being drawn, drawSoldierFigure() calls (gate guards, wall/palisade patrols,
  // tower archers, training knights, cutaway occupants) are collected instead of painted. Each one is
  // rendered as a billboard in the front pass, depth-tested against the whole scene, and registers a
  // vertical capsule collider in world units for picking and future combat queries.
  const SOLDIER_TILE=128,SOLDIER_SR=8,SOLDIER_FEET=.75;          // sprite px, sprite view scale, feet row
  const SOLDIER_SIZE_U=SOLDIER_TILE/(U*SOLDIER_SR);               // 1.333U card
  const CAPSULE={r:.12,below:.11,above:.38};                       // figure body + head around the feet point
  const soldierAtlas={canvas:null,map:new Map(),next:0,dirty:false,heraldry:null};
  let collecting=null,colliders=[];
  if(typeof drawSoldierFigure==='function'){
    const original=drawSoldierFigure;
    drawSoldierFigure=function(p,z,type,id,phase=0,livery=null){
      if(!collecting)return original.apply(this,arguments);
      const ground=Number.isFinite(structureProjectionGroundZ)?structureProjectionGroundZ:terrainElevation(p);
      collecting.push({p:{x:p.x,y:p.y},z:z+ground,type,id,phase,livery});
      return true;
    };
  }
  function soldierTile(type,phase,livery){
    // Only the knight's sword swings with phase; everything else is a single pose.
    const isDot=window.ConquerLOD?.militaryTier()==='dot';
    const bucket=!isDot&&type==='knight'?Math.floor((((phase%1)+1)%1)*8):0;
    const herald=JSON.stringify(State.heraldry||null);
    if(soldierAtlas.heraldry!==herald){soldierAtlas.map.clear();soldierAtlas.next=0;soldierAtlas.heraldry=herald}
    const key=(isDot?'dot|':'figure|')+type+'|'+bucket+'|'+(livery?JSON.stringify(livery):'realm');
    let uv=soldierAtlas.map.get(key);if(uv)return uv;
    if(!soldierAtlas.canvas){soldierAtlas.canvas=document.createElement('canvas');soldierAtlas.canvas.width=soldierAtlas.canvas.height=1024}
    const cols=1024/SOLDIER_TILE,i=soldierAtlas.next++%(cols*cols),x=(i%cols)*SOLDIER_TILE,y=Math.floor(i/cols)*SOLDIER_TILE;
    const g=soldierAtlas.canvas.getContext('2d');g.clearRect(x,y,SOLDIER_TILE,SOLDIER_TILE);
    if(isDot){
      // The same sprite/billboard and depth-tested capsule stay in place, but
      // the distant soldier is a single colored point instead of a figure.
      const cy=y+SOLDIER_TILE*.54,r=SOLDIER_TILE*.34;
      g.fillStyle=window.ConquerLOD.militaryColor(type,livery);
      g.strokeStyle='#28302a';g.lineWidth=5;
      g.beginPath();g.arc(x+SOLDIER_TILE/2,cy,r,0,Math.PI*2);g.fill();g.stroke();
    }else{
      const keepView=State.view,keepW2s=w2s;
      State.view={...keepView,scale:SOLDIER_SR};
      w2s=()=>({x:x+SOLDIER_TILE/2,y:y+SOLDIER_TILE*SOLDIER_FEET});      // drawSoldierFigureUnmasked projects only the feet
      try{withRenderContext(g,()=>drawSoldierFigureUnmasked({x:0,y:0},0,type,'atlas',bucket/8,livery))}
      finally{State.view=keepView;w2s=keepW2s}
    }
    uv=[x/1024,y/1024,(x+SOLDIER_TILE)/1024,(y+SOLDIER_TILE)/1024];
    soldierAtlas.map.set(key,uv);soldierAtlas.dirty=true;return uv;
  }
  function buildSoldiers(list){
    const v=[],out=[];
    for(const s of list){
      const [u0,v0,u1,v1]=soldierTile(s.type,s.phase,s.livery);
      const C=[[-.5,-SOLDIER_FEET,u0,v0],[.5,-SOLDIER_FEET,u1,v0],[.5,1-SOLDIER_FEET,u1,v1],[-.5,1-SOLDIER_FEET,u0,v1]];
      for(const k of [0,1,2,0,2,3]){const [cx,cy,u,w]=C[k];v.push(s.p.x,s.p.y,s.z,cx,cy,SOLDIER_SIZE_U,u,w)}
      out.push({id:s.id,type:s.type,x:s.p.x,y:s.p.y,z0:s.z-CAPSULE.below,z1:s.z+CAPSULE.above,r:CAPSULE.r});
    }
    colliders=out;
    return new Float32Array(v);
  }
  // Ray through a screen point (CSS px of #c): world points P(z) = s2wAtElevation(sx, sy, z) are collinear.
  function screenRay(sx,sy){
    const a=s2wAtElevation(sx,sy,0),b=s2wAtElevation(sx,sy,10);
    return{o:{x:a.x,y:a.y,z:0},d:{x:b.x-a.x,y:b.y-a.y,z:10}};
  }
  // Distance between the ray line and a capsule axis segment (closest points of two 3D lines, clamped).
  function rayCapsule(ray,c){
    if(isPlanView()){const dx=ray.o.x-c.x,dy=ray.o.y-c.y;return{dist:Math.hypot(dx,dy),t:c.z1}}
    const u=ray.d,v={x:0,y:0,z:c.z1-c.z0},w={x:ray.o.x-c.x,y:ray.o.y-c.y,z:ray.o.z-c.z0};
    const a=u.x*u.x+u.y*u.y+u.z*u.z,b=u.z*v.z,cc=v.z*v.z,d=u.x*w.x+u.y*w.y+u.z*w.z,e=v.z*w.z,den=a*cc-b*b;
    let sN=den>1e-12?(b*e-cc*d)/den:0,tN=den>1e-12?(a*e-b*d)/den:0;
    tN=clamp(tN,0,1);sN=(b*tN-d)/a;                                 // re-project onto the ray after clamping
    const px=ray.o.x+u.x*sN-c.x,py=ray.o.y+u.y*sN-c.y,pz=ray.o.z+u.z*sN-(c.z0+v.z*tN);
    return{dist:Math.hypot(px,py,pz),t:c.z0+v.z*tN};
  }
  function pickSoldier(sx,sy){
    const ray=screenRay(sx,sy);let best=null;
    for(const c of colliders){
      const h=rayCapsule(ray,c);if(h.dist>c.r)continue;
      const q=rotateViewPoint(c),depth=isPlanView()?c.z1:q.x+q.y+ISO_Z*h.t;  // nearest = largest view depth
      if(!best||depth>best.depth)best={collider:c,depth,distance:h.dist};
    }
    return best;
  }
  function drawColliderDebug(){
    ctx.save();ctx.lineWidth=1;
    for(const c of colliders){
      const ring=z=>circleWorldPoints(c.x,c.y,c.r,16).map(p=>w2sRaw(p,z));
      const hl=S.hover&&S.hover.id===c.id;ctx.strokeStyle=hl?'rgba(255,214,90,.95)':'rgba(120,220,255,.75)';
      for(const z of [c.z0,c.z1]){const pts=ring(z);ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.stroke()}
      const l0=w2sRaw({x:c.x-c.r,y:c.y},c.z0),l1=w2sRaw({x:c.x-c.r,y:c.y},c.z1),r0=w2sRaw({x:c.x+c.r,y:c.y},c.z0),r1=w2sRaw({x:c.x+c.r,y:c.y},c.z1);
      ctx.beginPath();ctx.moveTo(l0.x,l0.y);ctx.lineTo(l1.x,l1.y);ctx.moveTo(r0.x,r0.y);ctx.lineTo(r1.x,r1.y);ctx.stroke();
    }
    ctx.restore();
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
    try{
    collecting=[];                           // soldiers drawn this frame go to the 3D front pass
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
    if(gl.isContextLost()||gl.getError()!==gl.NO_ERROR)throw new Error('WebGL2 renderer failure');
    return true;
    }catch(err){
      // Never leave gameplay blank when the optional renderer fails.
      S.failed='world3d-draw: '+String(err?.message||err);
      enabled=false;collecting=null;
      const gpu=document.getElementById('gpuCanvas');if(gpu)gpu.style.visibility='';
      window.ConquerWebGPU?.invalidate?.();
      invalidateSceneCache();
      console.warn('World 3D disabled; Canvas fallback:',S.failed);
      return false;
    }
  }
  function nightLightsEnabled(){return useGpuNightLights}
  function setNightLightsEnabled(on){useGpuNightLights=!!on;draw()}
  function drawNightLights3D(r){
    const nf=nightFactor();if(nf<=.01)return;
    const started=performance.now();
    renderNightLights(r,nf);
    ctx.drawImage(S.canvas,0,0,r.width,r.height);
    // Animated flame shapes stay on the dynamic Canvas overlay; their light no longer does.
    drawFireFlamesOnly(nf);
    const p=perf(),ms=performance.now()-started;
    p.world3dNightLightMs=ms;
    const windowQuads=(S.buf['nightWindows#n']||0)/54;
    const fireSources=(S.buf['fireLights#n']||0)/54;
    window.__conquerAnalytics?.measure('NIGHTLIGHT_3D',ms,{windowQuads,fireSources});
    if(!S.nightLightReported){
      S.nightLightReported=true;
      window.__conquerAnalytics?.event('NIGHTLIGHT_3D_ACTIVE',{windowQuads,fireSources,mode:'webgl2'},'info');
    }
  }
  function drawCastleOverlays(){
    // Arcades are 3D decals now; only cutaway interiors keep their 2.5D drawing.
    if(State.structures.some(s=>structureCutaway(s)&&!underConstruction(s)))drawCutawayStructures();
  }
  // Mastio heraldic drape stays 2D for now: run the facade pass on the mastio towers only.
  function drawMastioDrapes(){
    const all=State.structures,mastio=all.filter(s=>s.isMastio&&!underConstruction(s));
    if(!mastio.length)return;
    try{State.structures=mastio;drawFacadeWindows(false,1,false)}finally{State.structures=all}
  }
  // ---------- dynamic meshes: queued during the frame like soldiers ----------
  // mesh: {pos: 9 world coords per triangle, col: one CSS hex per triangle}. Flat colours take the
  // castle's two-tone side shading for the current view rotation (tops full, sides light/dark).
  let dynamicQueue=[];
  function addMesh(mesh){if(collecting&&mesh&&mesh.col&&mesh.col.length)dynamicQueue.push(mesh)}
  const hexRgb=new Map();
  function meshRgb(hex){
    let v=hexRgb.get(hex);if(v)return v;
    const h=hex.replace('#','');v=[0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255);hexRgb.set(hex,v);return v;
  }
  function buildDynamic(list){
    let n=0;for(const m of list)n+=m.col.length;
    const out=new Float32Array(n*18);let o=0;
    for(const m of list){
      const p=m.pos;
      for(let t=0;t<m.col.length;t++){
        const i=t*9,ux=p[i+3]-p[i],uy=p[i+4]-p[i+1],uz=p[i+5]-p[i+2],vx=p[i+6]-p[i],vy=p[i+7]-p[i+1],vz=p[i+8]-p[i+2];
        const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,len=Math.hypot(nx,ny,nz)||1;
        let f;
        if(nz/len>.5)f=1;else if(nz/len<-.5)f=.5;
        else{const q=rotateViewPoint({x:-ny,y:nx}),z0=rotateViewPoint({x:0,y:0});f=Math.cos(2*(Math.atan2(q.y-z0.y,q.x-z0.x)-Math.PI/6))>=0?.84:.68}
        const c=meshRgb(m.col[t]),pale=(c[0]+c[1]+c[2])/3>.7;if(pale)f=1-(1-f)*.55;
        for(let k=0;k<3;k++){out[o++]=p[i+k*3];out[o++]=p[i+k*3+1];out[o++]=p[i+k*3+2];out[o++]=c[0]*f;out[o++]=c[1]*f;out[o++]=c[2]*f}
      }
    }
    return out;
  }
  function drawFront(r){
    const t0=performance.now(),list=collecting||[];collecting=null;
    // Breach rubble (siege) and ladders/assault towers set against the walls (combat).
    for(const source of [window.ConquerSiege,window.ConquerCombat]){
      try{for(const m of source?.dynamicMeshes?.()||[])dynamicQueue.push(m)}catch(e){console.error(e)}
    }
    const dyn=buildDynamic(dynamicQueue);dynamicQueue=[];
    renderFront(r,buildSoldiers(list),dyn);ctx.drawImage(S.canvas,0,0,r.width,r.height);
    if(S.debugColliders)drawColliderDebug();
    // 2.5D front pieces only exist for palisades, wood towers and cutaways; the battlement occlusion
    // frame is expensive, so skip the call entirely when none of them is present.
    const all=State.structures;
    const residual=all.filter(s=>!underConstruction(s)&&(s.type==='palisade'||isWoodTower(s)||structureCutaway(s)));
    if(residual.length){try{State.structures=all.filter(s=>!window.ConquerCastle3D?.castleVolume?.(s)||structureCutaway(s));drawCastleBattlements()}finally{State.structures=all}}
    perf().world3dFrontMs=performance.now()-t0;
  }
  function setEnabled(on){enabled=!!on;try{localStorage.setItem(STORE_KEY,enabled?'1':'0')}catch{}location.reload()}
  // Benchmark hook: switch modes in place (no reload). Restores the WebGPU canvas when leaving 3D.
  function _setActiveForTest(on){
    enabled=!!on;
    if(!enabled){const gpu=document.getElementById('gpuCanvas');if(gpu)gpu.style.visibility='';window.ConquerWebGPU?.invalidate?.()}
    invalidateSceneCache();
  }
  // Debug: show capsules; hovering highlights the soldier picked by the camera ray.
  function setColliderDebug(on){
    S.debugColliders=!!on;
    if(on&&!S.hoverBound){
      S.hoverBound=true;
      canvas.addEventListener('mousemove',e=>{
        if(!S.debugColliders||!active())return;
        const rc=canvas.getBoundingClientRect(),hit=pickSoldier(e.clientX-rc.left,e.clientY-rc.top);
        const id=hit?.collider.id||null;if(id!==(S.hover?.id||null)){S.hover=hit?.collider||null;draw()}
      });
    }
    draw();
  }
  window.ConquerWorld3D={active,supported,setEnabled,drawBack,drawCastleOverlays,drawFront,
    drawNightLights3D,nightLightsEnabled,setNightLightsEnabled,drawMastioDrapes,_setActiveForTest,
    pickSoldier,colliders:()=>colliders.slice(),setColliderDebug,addMesh,
    invalidate:()=>{S.sig={};S.contentDirty=true},
    _debugBake:bakeGround,
    status:()=>({enabled,supported:supported(),failed:S.failed,stats:{...S.stats},sig:{...S.sig},buffers:Object.fromEntries(Object.entries(S.buf).filter(([k])=>k.endsWith('#n')))})};
})();
